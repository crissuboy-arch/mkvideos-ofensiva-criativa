# URL → Vídeo

Funcionalidade do MKVideos que transforma uma URL (matéria, blog, produto) em um
vídeo MP4 editável. É construída sobre o motor **Content2Video INEMA**, vendorizado
em [`modules/content2video/`](../modules/content2video/) e tratado como *engine*
— ver [`docs/arquitetura-motores.md`](arquitetura-motores.md) para a camada de
motores/provedores.

## Fluxo

1. Usuário cola a URL no painel (aba **URL → Vídeo**) ou via `mkivideos url2video <url>`.
2. Opcional: **objetivo do vídeo** (público, recorte, mensagem).
3. Escolhe **formato** (9:16 vertical / 16:9 horizontal), **estilo de linguagem**
   (popular/natural/técnico), **ritmo da narração** (calma/natural/rápida) e um
   **preset visual** (ou "automático — plano decide").
4. O sistema analisa a URL, cria roteiro + storyboard + direção visual e uma
   **cena-piloto** — e para (gate). Nada é narrado ou renderizado ainda.
5. Você aprova (`Aprovar visual e produzir` / `mkivideos url2video aprovar <jobId>`)
   ou pede uma nova cena-piloto (`Atualizar cena-piloto`).
6. Depois de aprovado: produção completa — roteiro, mídia local, narração (Edge
   TTS), legendas e composição HyperFrames, com checagem de área segura.
7. Revisão: **Abrir editor** (HyperFrames Studio), **Editar com prompt**
   (reescreve preservando o que você pedir para manter), **Criar cópia** (variação
   sem tocar no original).
8. **Aprovar e renderizar** → MP4 (com CTA opcional da marca anexado ao final).
9. **Baixar** o vídeo final pelo próprio card do projeto/painel.

Todo esse fluxo (gate, fases, checkpoints, retomada, cancelamento) é do motor
upstream — o MKVideos só re-apresenta com sua própria interface. Detalhes finos
de comportamento (regras editoriais, área segura de manchetes, etc.) estão em
[`modules/content2video/AGENTS.md`](../modules/content2video/AGENTS.md).

## Requisitos

| Requisito | Para quê | Obrigatório |
|---|---|---|
| Node.js ≥ 22 | motor content2video (o resto do MKVideos pede ≥ 20) | sim |
| FFmpeg + FFprobe no PATH | narração/vídeo, CTA final | sim |
| Codex CLI autenticado (`codex login`) **ou** `OPENAI_API_KEY` | pesquisa a URL, escreve roteiro/cenas | sim (um dos dois) |
| HyperFrames + Chrome headless | timeline, animação, render | baixado via `npx` na primeira execução |
| Edge TTS | narração `pt-BR-FranciscaNeural` (ou outra voz, sob pedido) | acesso à internet |

Rode `mkivideos doctor` (ou `npm run doctor`) para checar tudo de uma vez —
Node, FFmpeg/FFprobe, Codex/OpenAI, e se `modules/content2video/` está presente.

> **Nenhum provedor de vídeo generativo é usado.** `AI_PROVIDER=codex|openai`
> escolhe só o agente que pesquisa a fonte e escreve roteiro/cenas — não um
> gerador de clipes. O vídeo é motion graphics/tipografia/mídia local via
> HyperFrames. Ver [`modules/content2video/UPSTREAM-README.md`](../modules/content2video/UPSTREAM-README.md#arquitetura-e-provedores-da-versão-atual).

## Variáveis de ambiente

Copie `.env.example` (raiz do MKVideos) para `.env` — nunca versionado. Tudo tem
default seguro. Principais:

```dotenv
AI_PROVIDER=codex                 # codex (OAuth) | openai
OPENAI_API_KEY=                   # SEGREDO — só se AI_PROVIDER=openai
MKIVIDEOS_URL2VIDEO_FORMAT=9:16    # 9:16 | 16:9
MKIVIDEOS_URL2VIDEO_STYLE=popular  # popular | natural | technical
MKIVIDEOS_URL2VIDEO_PACE=natural   # calm | natural | fast
MKIVIDEOS_URL2VIDEO_CTA=1
MKIVIDEOS_C2V_URL=                 # aponte para um motor já rodando em vez de subir um processo
```

Lista completa e comentada em [`.env.example`](../.env.example).

## Como executar

```bash
mkivideos painel --port 3142
# abre http://localhost:3142/painel — aba "URL → Vídeo"

mkivideos url2video status
mkivideos url2video "https://exemplo.com/materia" --objetivo "..." --formato 9:16
mkivideos url2video jobs
mkivideos url2video aprovar <jobId>
mkivideos url2video renderizar <slug>
mkivideos url2video projetos
```

`mkivideos url2video --help`-like: rode sem argumentos para ver todos os subcomandos
(`editar`, `variacao`, `editor`, `cancelar`, `continuar`, …).

### ⚠️ Estado por sessão do motor (importante para uso via CLI)

O motor guarda jobs (fila de produção) **em memória, no processo do servidor**
(comportamento do upstream — ver `UPSTREAM-README.md`). O MKVideos sobe esse
processo sob demanda e o encerra ao final de cada comando `mkivideos url2video`
*one-shot*. Ou seja: `url2video "<url>"` e, numa chamada de terminal **separada**,
`url2video aprovar <jobId>` **não** vão enxergar o mesmo job — cada chamada sobe
um motor novo e vazio.

Duas formas corretas de usar o fluxo completo (criar → aprovar → editar → renderizar):

1. **Painel** (`mkivideos painel`) — recomendado. O processo fica no ar durante
   toda a sessão do painel; a aba "URL → Vídeo" preserva os jobs normalmente.
2. **CLI contra um motor externo já rodando**: inicie o motor uma vez
   (`node modules/content2video/app/server.mjs`, ou `mkivideos painel` em outro
   terminal) e aponte `MKIVIDEOS_C2V_URL=http://127.0.0.1:<porta>` — todas as
   chamadas de `mkivideos url2video` passam a falar com o **mesmo** processo.

Isso é uma limitação herdada do motor (estado em memória por sessão), não do
MKVideos — documentada aqui para não surpreender no uso por script.

## Testar

```bash
npm test -- src/url2video src/engines src/preflight src/content/url2video-routes.test.ts
npm run typecheck
```

Os testes automatizados cobrem validação/normalização, o serviço (`Url2VideoService`
com um motor fake), as rotas HTTP do painel (`handleUrl2Video`, servidor real +
`fetch`) e o registro de motores/provedores. Eles **não** dependem de FFmpeg, Codex
nem de subir o processo do motor — são rápidos e determinísticos. `mkivideos doctor`
e um smoke test manual (`mkivideos url2video status`) cobrem a integração real com
o processo do motor.

## Arquitetura do módulo

```
modules/content2video/         motor vendorizado (ver ORIGEM.md e PATCHES.md dentro da pasta)
  app/server.mjs                orquestrador HTTP: gate visual, produção, render, CTA, checkpoints
  app/public/                   UI original do upstream — DESATIVADA (C2V_ALLOW_BUNDLED_UI=1 para depurar)
  config/                       defaults de produção + presets visuais
  scripts/video.mjs             modo headless do upstream (create/list/check/preview/render)

src/engines/
  types.ts                      contrato VideoEngine (motor plugável)
  registry.ts                   registro de motores por id
  content2video/
    config.ts                    resolve a pasta do módulo + env do processo gerenciado
    process.ts                   sobe/derruba o processo do motor em loopback (ou usa MKIVIDEOS_C2V_URL)
    engine.ts                    cliente HTTP → VideoEngine (normaliza os payloads do upstream)
  providers/                    provedores de mídia por cena (ver arquitetura-motores.md)

src/url2video/
  config.ts / validate.ts       defaults por env + validação/normalização pura (testável sem motor)
  service.ts                    Url2VideoService — camada única usada pelo painel e pela CLI
  cli.ts                        `mkivideos url2video …`

src/content/
  url2video-routes.ts           rotas /api/url2video/* do painel (delegam ao Url2VideoService)
  url2video-view.ts             HTML/CSS/JS da aba "URL → Vídeo", com os tokens visuais do MKVideos
  panel.ts                      injeta a aba quando `PanelOptions.url2video` é passado
```

## Limitações atuais

- Sem geração de clipe por IA, avatar/apresentador ou upload de mídia própria —
  arquitetura preparada em `src/engines/providers/`, nada implementado ainda
  (ver `docs/arquitetura-motores.md`).
- Estado dos jobs é por sessão do processo do motor (ver seção acima).
- Requer Codex CLI autenticado (ou `OPENAI_API_KEY`) — sem isso, o gate visual
  não avança; `mkivideos doctor` sinaliza isso claramente.
- A UI original do Content2Video (`app/public/`) fica vendorizada mas desativada;
  só é reativável manualmente para depuração do upstream isoladamente.
- FFmpeg/FFprobe e Codex **não puderam ser verificados neste ambiente de
  desenvolvimento** (ausentes do PATH desta máquina) — o código foi validado até
  o ponto em que esses binários externos entram (processo do motor sobe, `/healthz`
  responde, `/api/config` reporta corretamente a ausência de autenticação Codex).
  Rode `mkivideos doctor` na máquina de produção para confirmar.
