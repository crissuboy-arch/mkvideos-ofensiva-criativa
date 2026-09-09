import json, re, time
from pathlib import Path
from otv.provedores.llm import criar_llm
from otv.contratos import validar_notas
from otv.util.custos import registrar

MODOS = {"A": "condensado com a fala original: priorize o que se entende só ouvindo.",
         "B": "sem o apresentador: a narração será refeita; priorize unidades cujo tipo de imagem é demo_tela, grafico ou slide, pois é a imagem que vai ficar.",
         "C": "só demonstrações e gráficos: priorize demo_tela e grafico.",
         "N": ("narração refeita por cima do vídeo inteiro: a fala original será substituída, então "
               "priorize o que é importante pelo CONTEÚDO, sem se importar se a frase se sustenta sozinha "
               "no áudio — a narração vai costurar as pontas.")}

def montar_lista(unidades):
    return "\n".join(f"[{u['id']:03d}] {u['dur']:.1f}s {u.get('visual', 'outro')} \"{u['texto']}\"" for u in unidades)

def montar_prompt(unidades, modo, alvo_s, titulo, duracao_s):
    tpl = (Path(__file__).resolve().parents[2] / "prompts/pontuar.md").read_text(encoding="utf-8")
    return tpl.format(minutos=round(duracao_s / 60), titulo=titulo, alvo=int(alvo_s), modo_desc=MODOS[modo],
                      n=len(unidades), lista=montar_lista(unidades))

# ── [MKVIDEOS PATCH] pontuação heurística local — gratuita/offline ────────────
# NÃO é IA. São regras determinísticas sobre dados que já estão em disco
# (unidades.json + metadata.json): duração, densidade de fala, posição temporal,
# frase completa, presença de número/termo relevante, penalização de
# CTA/saudação/enrolação. Serve para o pipeline ingest→…→render rodar 100%
# offline, sem API paga e sem Ollama/Claude CLI. Os provedores LLM
# (glm/gemini/ollama/claude_cli) continuam disponíveis via `--provedor`.
_CTA = re.compile(
    r"\b(inscrev|se inscrev|curt[ae]\b|deix[ae] o like|deix[ae] seu like|"
    r"coment[ae]\b|coment[áa]rio|link (na|da) (bio|descri)|ativa o sino|toca o sino|"
    r"compartilh|obrigad[oa]|valeu|abra[çc]o|at[ée] (a )?pr[óo]xima|"
    r"tchau|se inscrev|bem[- ]vind[oa]|fala galera|e a[íi],? (pessoal|galera|gente))\b",
    re.I,
)
_FORTE = re.compile(
    r"\d|%|R\$|\b(porqu[êe]|resultado|descobri|descoberta|segredo|erro|dica|passo|"
    r"important|nunca|sempre|chave|prov(a|ei|ou)|estrat[ée]gia|m[ée]todo|t[ée]cnica|"
    r"regra|conclus[ãa]o|resumo|primeiro|segundo|terceiro)\b",
    re.I,
)
_FIM_FRASE = re.compile(r"[.!?][\"'’)\]]?\s*$")


def _nota_unidade(u, pos_rel, palavras_mediana):
    txt = (u.get("texto") or "").strip()
    palavras = txt.split()
    npal = len(palavras)
    dur = max(0.1, float(u.get("dur", 0.0)))
    if _CTA.search(txt):
        return 1, "provável CTA/saudação/enrolação"
    nota = 5.0
    motivos = []
    if npal < 3 or dur < 1.2:
        nota -= 3.0
        motivos.append("trecho muito curto")
    wps = npal / dur
    if wps < 1.2:
        nota -= 1.5
        motivos.append("baixa densidade de fala")
    elif 1.8 <= wps <= 4.5:
        nota += 1.0
        motivos.append("densidade de fala boa")
    if _FIM_FRASE.search(txt):
        nota += 1.0
        motivos.append("frase completa")
    else:
        nota -= 0.5
    if _FORTE.search(txt):
        nota += 1.5
        motivos.append("número/termo relevante")
    if npal >= palavras_mediana and palavras_mediana:
        nota += 0.5
    if pos_rel <= 0.15:
        nota += 1.0
        motivos.append("abertura")
    elif pos_rel >= 0.85:
        nota += 0.5
        motivos.append("fechamento")
    v = int(round(max(0.0, min(10.0, nota))))
    return v, ("; ".join(motivos) or "trecho de conteúdo")[:80]


def pontuar_heuristico(unidades, meta, modo, alvo_s):
    n = len(unidades)
    if n == 0:
        raise RuntimeError("pontuar heurístico: sem unidades")
    dur_total = float(meta.get("duracao_s") or 0.0) or float(unidades[-1].get("fim") or 1.0) or 1.0
    contagens = sorted(len((u.get("texto") or "").split()) for u in unidades)
    mediana = contagens[n // 2]
    ini_rel = {int(u["id"]): float(u.get("ini", 0.0)) / dur_total for u in unidades}
    notas = []
    for u in unidades:
        v, motivo = _nota_unidade(u, ini_rel[int(u["id"])], mediana)
        notas.append({"id": int(u["id"]), "nota": v, "motivo": motivo})
    # gancho: melhores do 1º quarto (ou das 3 primeiras unidades), nunca um CTA
    # (nota baixa). Se nenhuma abre bem, usa a menos ruim das primeiras.
    prim = [x for x in notas if ini_rel[x["id"]] <= 0.25] or notas[:3]
    bons_ini = sorted([x for x in prim if x["nota"] >= 4], key=lambda x: (-x["nota"], x["id"]))
    gancho = [x["id"] for x in bons_ini[:2]] or [max(prim, key=lambda x: (x["nota"], -x["id"]))["id"]]
    # fecho: melhores do último quarto sem CTA; senão a última unidade decente
    ult = [x for x in notas if ini_rel[x["id"]] >= 0.75 and x["nota"] >= 4]
    fecho = [x["id"] for x in sorted(ult, key=lambda x: (-x["nota"], -x["id"]))[:2]]
    if not fecho:
        decentes = [x for x in reversed(notas) if x["nota"] >= 4]
        fecho = [decentes[0]["id"]] if decentes else [notas[-1]["id"]]
    topicos = [{"nome": (str(meta.get("titulo") or "conteúdo"))[:60], "de": 0, "ate": n - 1}]
    return {"manchete": "", "gancho": gancho, "fecho": fecho, "topicos": topicos, "notas": notas}
# ─────────────────────────────────────────────────────────────────────────────


def pontuar(dir, cfg, modo="A", alvo_s=None, provedor=None, forcar=False):
    dir = Path(dir); out = dir / "notas.json"
    prov = provedor or cfg["pontuacao"]
    if out.exists() and not forcar:
        # o prompt de pontuação MUDA com o modo (MODOS[modo] entra no template), então
        # reaproveitar notas de outro modo é validar o modo B com julgamento de modo A.
        # Só pula quando o modo bate; notas antigas sem o campo contam como "A" (era o
        # único modo que existia quando elas foram escritas).
        if json.loads(out.read_text(encoding="utf-8")).get("modo", "A") == modo:
            return out
    us = json.loads((dir / "unidades.json").read_text(encoding="utf-8"))["unidades"]
    meta = json.loads((dir / "metadata.json").read_text(encoding="utf-8"))
    t0 = time.time()
    alvo = alvo_s or cfg["selecao"]["alvo_s"]

    if prov == "local_heuristic":
        # [MKVIDEOS PATCH] caminho 100% local/offline — sem LLM, sem custo.
        notas = validar_notas(pontuar_heuristico(us, meta, modo, alvo), len(us))
        notas["provedor"] = "local_heuristic"; notas["uso"] = {"cost": 0.0}; notas["modo"] = modo
        out.write_text(json.dumps(notas, ensure_ascii=False, indent=0), encoding="utf-8")
        registrar(dir, "pontuar", {"provedor": "local_heuristic", "uso": {"cost": 0.0},
                                   "segundos": round(time.time() - t0, 1)})
        return out

    llm = criar_llm(cfg, prov)
    raw, uso = llm.chat_json(montar_prompt(us, modo, alvo, meta["titulo"], meta["duracao_s"]))
    notas = validar_notas(raw, len(us))
    notas["provedor"] = llm.nome; notas["uso"] = uso; notas["modo"] = modo
    out.write_text(json.dumps(notas, ensure_ascii=False, indent=0), encoding="utf-8")
    registrar(dir, "pontuar", {"provedor": llm.nome, "uso": uso, "segundos": round(time.time() - t0, 1)})
    return out
