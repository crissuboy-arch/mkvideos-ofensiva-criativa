# Módulos de vídeo: Música + Videoclipe, Otimizar Vídeo, Legendar, Biblioteca

Além do `gerar` (offline) e do `URL → Vídeo` (motor content2video), o MKVideos
integra mais três motores locais e uma biblioteca unificada. Todos seguem o
mesmo padrão: **o MKVideos é o núcleo/orquestrador**, os módulos ficam
vendorizados em `modules/` (ver o `ORIGEM.md` de cada um) e o painel/CLI do
MKVideos é a única interface — as UIs originais dos módulos não são servidas.

| Aba | Motor | Stack | modules/ |
|---|---|---|---|
| Música + Videoclipe | `musicavideo` | Python (stdlib) + FFmpeg | `modules/musicavideo` (MIT) |
| Otimizar Vídeo | `otimizevideo` (`otv`) | Python + FFmpeg + yt-dlp | `modules/otimizevideo` (sem licença OSI) |
| Legendar | código próprio do MKVideos | TS + FFmpeg; **transcrição reaproveita** `otimizevideo` | `modules/videosub` (só referência) |
| Biblioteca | código próprio do MKVideos | TS, varre o disco | conceito de `modules/musicavideo-pub` (não vendorizado) |

## Regra crítica de custo (todos os módulos)

**Nenhum provedor pago roda automaticamente.** A camada `src/cost/` centraliza:

- `estimarCusto()` / `estimarFase()` mostram o valor **antes** de qualquer geração.
- `requireAuthorization(estimate, { confirmed, ceilingUsd })` lança
  `CostAuthorizationRequiredError` se o provider é pago e `confirmed !== true`.
- Teto opcional por chamada: `MKIVIDEOS_COST_CEILING_USD` (bloqueia mesmo com
  confirmação).
- `costLedger()` registra o que foi de fato autorizado nesta sessão.

Na CLI, a confirmação é a flag `--autorizo-gasto`. No painel, é um `confirm()`
antes do POST, e o servidor devolve HTTP `402` com `code: PAYMENT_CONFIRM_REQUIRED`
se faltar. Providers gratuitos/locais (Agnes para capa/clipe, `whisper_local`,
`ollama`, `claude_cli`, `inemavox`, `local`) nunca passam pelo gate.

---

## Música + Videoclipe (`mkivideos musicavideo`)

O `musicavideo` já tem gates embutidos: `plano` (não gasta) → `ok <parte>`
(portão do plano) → `faz` (gasta) → `revisa` → `aprova`/`reprova`. O adapter do
MKVideos **preserva esses gates** e **nunca** usa `--aprovar` (que os pularia).
`faz` é a única ação que gasta e exige, além do portão `ok`, a confirmação
`--autorizo-gasto`/`confirm:true`.

- **Motores** (do plano, trocáveis por `--motor parte=prov:modelo`):
  - música: `kie:suno-v4.5` — **pago, ~US$0,08** (traz 2 faixas). Único pago por default.
  - capa: `agnes:agnes-image-2.1-flash` — **US$0**. Alternativa local: `inemaimg:flux2-klein`.
  - clipe: `agnes:agnes-video-v2.0` — **US$0**. Alternativas pagas: `kling`, `fal`.
- Trocar para `kie`/`kling`/`fal` faz o CLI upstream exigir `--autorizo-pago` —
  o adapter só adiciona essa flag quando o chamador de fato pediu um motor pago.
- Fluxo com as 2 faixas do Suno, reprovar shots por número, seleção de faixa 1/2,
  regeneração só das cenas reprovadas — tudo do `musicavideo`, exposto pelo adapter.

```bash
mkivideos musicavideo plano "rock feminino de virada" minha-musica
mkivideos musicavideo ok minha-musica musica
mkivideos musicavideo custo minha-musica                 # mostra a estimativa
mkivideos musicavideo faz minha-musica musica --autorizo-gasto
mkivideos musicavideo revisa minha-musica
mkivideos musicavideo aprova minha-musica musica --faixa 2
mkivideos musicavideo ok minha-musica capa && mkivideos musicavideo ok minha-musica clipe
mkivideos musicavideo faz minha-musica --autorizo-gasto   # capa+clipe (US$0 no default)
```

---

## Otimizar Vídeo (`mkivideos otimizevideo`)

Corte inteligente de vídeo longo → ~2 min, **fase por fase**, reaproveitando
artefatos. Filosofia preservada: **o LLM nunca escolhe timestamps** — a seleção
sai da transcrição real (`transcript.json`, palavras com `ini`/`fim`); o adapter
só orquestra.

| Fase | Custo | Gate |
|---|---|---|
| `ingest` | US$0 | não |
| `transcrever` (groq) | ~US$0,03 | **sim** (grátis com `whisper_local`) |
| `cenas` (local) | US$0 | não |
| `classificar` (glm/gemini) | ~US$0,004 | **sim** (só modo B/C; `claude_cli` = grátis) |
| `pontuar` (glm/gemini) | ~US$0,002 | **sim** (`ollama`/`claude_cli` = grátis) |
| `selecionar` / `render` / `narrar` (inemavox) | US$0 | não — **refazem sempre, sem repagar** |
| `substituir` (fal, modo A+) | variável | **sim** |

```bash
mkivideos otimizevideo ingest "C:\videos\aula.mp4"        # → id
mkivideos otimizevideo transcrever <id> --autorizo-gasto  # ou --provedor whisper_local (grátis)
mkivideos otimizevideo cenas <id>
mkivideos otimizevideo pontuar <id> --modo A --alvo 120 --autorizo-gasto
mkivideos otimizevideo selecionar <id> --modo A --alvo 120   # grátis, quantas vezes quiser
mkivideos otimizevideo render <id>                            # grátis; edite o plan.json antes se quiser
mkivideos otimizevideo status <id>
```

`saida`/`trabalho` do `otv` são redirecionados para `.mkvideos-data/otimizevideo/`
via um `config.yaml` gerado (nunca toca o vendorizado).

---

## Legendar (`mkivideos legendas`)

**Não roda o servidor do videosub.** É código próprio do MKVideos que:

1. registra o vídeo enviado (caminho local);
2. **transcreve reaproveitando o adapter `otimizevideo`** (fase `transcrever` —
   com o gate de custo dele; Groq é pago, `whisper_local` é grátis);
3. converte `transcript.json` → cues (`src/legendas/srt.ts`, função pura);
4. permite revisar/editar (SRT), sincronizar (deslocar N segundos), escolher estilo;
5. exporta o `.srt` ou queima no vídeo com `src/video/ffmpeg.ts`
   (filtro `subtitles` do FFmpeg — técnica referida de `modules/videosub`);
6. também gera MP4 com legenda **selecionável** (soft subs, sem re-encode).

```bash
mkivideos legendas novo "C:\videos\meu.mp4" --titulo "Aula 1"
mkivideos legendas transcrever <id> --autorizo-gasto      # ou --provedor whisper_local
mkivideos legendas cues <id>                              # imprime o SRT
mkivideos legendas importar <id> editado.srt              # aplica um SRT revisado
mkivideos legendas sincronizar <id> -0.4                  # atrasa 0,4s
mkivideos legendas queimar <id> --largura 1080 --altura 1920
```

---

## Biblioteca (`mkivideos biblioteca` / aba do painel)

Índice **só leitura** que varre o disco: `renders/` (gerar),
`modules/content2video/output/` (URL → Vídeo), `.mkvideos-data/musicavideo`,
`.mkvideos-data/otimizevideo`, `.mkvideos-data/legendas`. Um item por MP4, com
título/tamanho/data e link para abrir. Sem Hugging Face, sem Vercel, sem Redis —
o conceito de "card por produção" veio do `manifest.json` do `musicavideo-pub`
(ver `modules/musicavideo-pub/ORIGEM.md`), o resto é local.

---

## Requisitos (rode `mkivideos doctor`)

- **Node ≥ 20**, **FFmpeg + FFprobe** no PATH (todos os módulos).
- **Python 3.10+** + `pip install -r modules/otimizevideo/requirements.txt`
  (para Otimizar Vídeo; `musicavideo` é stdlib pura). No Windows o `doctor`
  detecta `python`/`python3`/`py`.
- **yt-dlp** — opcional, só para "Otimizar Vídeo" a partir de URL de vídeo.
- **Chaves** (centralizadas em `.env`, ver `.env.example`): `KIE_API_KEY`
  (música), `AGNES_API_KEY` (capa/clipe grátis), `GROQ_API_KEY` (transcrição),
  `OPENROUTER_API_KEY` (pontuação). Todas opcionais — sem elas o provider aparece
  indisponível e o MKVideos oferece a alternativa local quando existe.
- **Daemons locais opcionais** (custo zero): Ollama (`:11434`), inemavox (`:8010`).

## Limitações atuais (conhecidas)

- **Upload de vídeo no painel = caminho de arquivo local**, não upload por
  formulário. O painel é local; o usuário cola o caminho do arquivo. Upload
  multipart real é um próximo passo.
- **Estado por sessão**: como no `url2video`, comandos CLI `one-shot` de
  `musicavideo`/`otimizevideo` sobem/derrubam o processo Python a cada chamada —
  mas esses módulos guardam estado **em disco** (`estado.json`, `custos.json`,
  `plan.json`), então retomar entre chamadas funciona (diferente do
  `content2video`, cujos jobs são em memória).
- **Publicação para vitrine pública** (`musicavideo nuvem`/`publica-hf` → Hugging
  Face → `musicavideo-pub`): **não integrada** — exige credenciais de HF e push
  num repo de terceiros. Ver `modules/musicavideo-pub/ORIGEM.md`.
- **FFmpeg/Python/Groq/Codex não foram verificáveis nesta máquina de
  desenvolvimento** (ausentes do PATH). O código foi validado com testes que
  mockam o spawn; `mkivideos doctor` confirma o ambiente real na máquina de uso.
- Providers pagos alternativos de `musicavideo` (`kling`, `fal`) estão
  implementados no upstream mas nunca exercitados contra a API real (ver
  `modules/musicavideo/UPSTREAM-README.md`).
