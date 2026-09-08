# mkivideos — Motor Universal de Vídeos

Gera vídeos narrados, animados e renderizados **100% offline**, sem API do Claude.
Você escreve um **tema** e o motor cria roteiro, narração, cenas animadas e o vídeo final.

Stack: **HyperFrames** (HTML→MP4, Chrome headless + FFmpeg) + **TTS local Kokoro**.
Marca padrão: **OFENSIVA CRIATIVA — Marketing Sem Filtro** (trocável por preset).

---

## O que mudou (v0.3 — motor universal)

- **14 tipos de vídeo** (roteiros por nicho, com ganchos fortes e anti-repetição do tema): `tiktok-viral`, `curiosidades`, `storytelling`, `novela-curta`, `motivacional`, `autoridade`, `vendas`, `produto-digital`, `anuncio`, `explicativo`, `curso`, `tutorial`, `bonequinhas-3d`, `historias-infantis`.
- **15 cenas profissionais**: title, topic, lead, bullets, cards, steps, term, compare, illus, img, imgrow, quote, proof, offer, cta.
- **Gerador de roteiro por tema** (offline, determinístico): gancho → promessa → cenas numeradas → narração → legenda → CTA.
- **2 formatos**: `--vertical` 9:16 (Reels/Shorts/TikTok) e `--horizontal` 16:9 (YouTube/aulas).
- **7 marcas** (paleta + fontes + CTA): `ofensiva-criativa` (default), `cliente`, `curso`, `produto`, `dark-premium`, `clean-branco`, `luxo-dourado`.
- **Sync por áudio real**: o build lê a duração dos WAVs (ffprobe) e ajusta tempo de cena, legenda, animação e transições.
- **Imagem real**: fundo de cena (Ken Burns) e cenas `img`/`imgrow` (figura/fileira) com placeholder quando faltar arquivo.

---

## Instalação

```bash
git clone <url-do-repo> mkivideos
cd mkivideos
npm install
npm run build
```

Requer **Node 20+**. Para usar o comando global:

```bash
npm link        # disponibiliza `mkivideos` no PATH
```

### Dependências de mídia (locais, sem API)

- **FFmpeg** no PATH — `winget install Gyan.FFmpeg` (Windows). Verifique: `ffmpeg -version` e `ffprobe -version`.
- **HyperFrames** roda via `npx` na primeira execução (baixa o Chrome headless).
- **Kokoro TTS (voz offline)** — o HyperFrames chama o `python` do sistema e exige os
  pacotes **`kokoro-onnx`** e **`soundfile`** instalados nele. **Não são baixados
  automaticamente.** Instale uma vez:

  ```bash
  python -m pip install kokoro-onnx soundfile
  ```

  Confirme: `python -c "import kokoro_onnx, soundfile; print('Kokoro OK')"`.
  Sem isso, `mkivideos gerar` falha na fase de narração
  (*"The kokoro-onnx package is not installed"*). O modelo de voz (~27 MB) é
  baixado na primeira síntese. `mkivideos doctor` verifica esses pacotes.
- **Fontes** (Sora / Inter / JetBrains Mono): copiadas da skill `video-explicativo` se instalada, ou baixadas por `fetch-fonts.mjs`.

---

## Como gerar um vídeo de qualquer tema

```bash
# explicativo, 9:16, marca padrão (Ofensiva Criativa)
mkivideos gerar "Como funciona o ChatGPT"

# vendas vertical
mkivideos gerar "5 formas de ganhar dinheiro com IA" --tipo vendas --vertical

# curso horizontal (16:9)
mkivideos gerar "Fundamentos de SEO" --tipo curso --horizontal

# storytelling vertical
mkivideos gerar "A história da minha primeira venda" --tipo storytelling --vertical
```

O motor escreve sozinho: **gancho**, **promessa**, **cenas numeradas**, **narração** (TTS), **legenda** e **CTA** da marca.

### Flags

| Flag | Padrão | Efeito |
|------|--------|--------|
| `--tipo <tipo>` | `explicativo` | tipo de vídeo (ver lista acima) |
| `--vertical` | — | força 9:16 |
| `--horizontal` | — | força 16:9 |
| `--marca <id>` | `ofensiva-criativa` | preset de marca (paleta + CTA) |
| `--cenas <n>` | do tipo/tema | nº de cenas de conteúdo |
| `--tema <texto>` | derivado | eyebrow/tema curto exibido no hook |
| `--pasta <caminho>` | `renders/` | pasta de destino do MP4 |
| `--imagens <pasta>` | — | pasta com `cena1.png`…`cenaN.png` |
| `--voz <nome>` | — | voz personalizada (ver abaixo) |

> **Formato default por tipo:** `curso` e `tutorial` nascem 16:9; o resto nasce 9:16.
> Use `--vertical`/`--horizontal` para sobrescrever.

---

## Imagens próprias

Nomeie as imagens `cena1.png`, `cena2.png`… (`cena1` = primeira cena **depois do hook**) e passe a pasta:

```bash
mkivideos gerar "Tour pelo produto" --tipo vendas --imagens "C:\imagens" --vertical
```

Formatos: `.png`, `.jpg`, `.jpeg`, `.webp`. Cenas sem imagem usam o fundo premium da marca.
As cenas `img`/`imgrow` exibem a imagem em destaque; nas demais, a imagem vira fundo com Ken Burns + overlay.

---

## Voz personalizada

Pasta padrão: `vozes/<nome>/` (ou defina `MKIVIDEOS_VOZES`).

1. **Pré-gravada (melhor):** salve `s1.wav`, `s2.wav`… (na ordem das cenas; `s1` = hook, `sN` = CTA). Faltou algum → Kokoro cobre.
2. **Clonagem XTTS v2:** coloque um `referencia.wav` (10–30s, ambiente silencioso). Requer `pip install TTS`.

```bash
mkivideos gerar "5 dicas de copywriting" --tipo vendas --voz cris
```

---

## Onde sai o vídeo

Por padrão `renders/<slug>-9x16.mp4` (ou `-16x9`). Com `--pasta`, move para o destino:

```bash
mkivideos gerar "Título" --pasta "C:\Videos\Renderizados"
```

---

## Marcas (presets)

`ofensiva-criativa` · `cliente` · `curso` · `produto` · `dark-premium` · `clean-branco` · `luxo-dourado`.
Cada marca define paleta (8 tokens), fontes e a identidade da CTA (nome, tagline, slogan, @, site).
Edite/adicione em [`src/brands/presets.ts`](src/brands/presets.ts).

```bash
mkivideos gerar "Lançamento do app" --tipo anuncio --marca produto --vertical
```

---

## Centro de Operações de Conteúdo

Painel operacional interno: planejar, cadastrar, gerar, **agendar** e **publicar** (worker + publishers mock).

```bash
mkivideos painel --port 3142 [--token minha-senha]
# abre http://localhost:3142/painel  (+ worker de publicação a cada minuto)
```

- **Dashboard + métricas:** pendentes · prontos · agendados · publicados · esta semana; criados e total por plataforma.
- **Biblioteca:** cadastro (tema, tipo, plataforma, idioma, **conta**, produto, data/hora, timezone, marca) e filtros (plataforma, idioma, **produto**, tipo, status).
- **Status:** ideia → roteiro → gerando → renderizando → pronto → **agendado** → publicado.
- **Calendário:** **Hoje / Semana / Mês** (grade mensal com nº de vídeos por dia).
- **Contas:** tabela `accounts` (TikTok PT, TikTok ES, Instagram PT/ES, YouTube Shorts PT/ES, …) — criar, ativar/desativar, excluir; cada conteúdo escolhe a conta destino.
- **Gerar Vídeo:** chama `buildVideo` (formato pela plataforma); status acompanha as fases.
- **Agendar:** item `pronto` com data → `agendado`. O **worker** (1/min) publica os agendados vencidos via `publishers/` (TikTok/Instagram/YouTube/Facebook — **mocks**, sem API real) e marca `publicado`.
- **Lotes:** "duplicar" um item em até ~30 cópias variando só **tema | idioma | data**.
- **Logs:** geração, renderização, agendamento, publicação (e erros) — tudo em banco.

> **Sem publicação real ainda:** os `publishers/` são mocks; a arquitetura já está pronta para as APIs.
> O idioma é metadado de organização (a narração roda em PT-BR). Multilíngue é evolução futura.

Programático: `import { SqliteContentStore, createPanelServer, startScheduler, getPublisher } from 'mkivideos/content'`.

---

## URL → Vídeo (link vira vídeo, via motor content2video)

Cole uma URL (matéria, blog, produto) e o MKVideos analisa o conteúdo, cria
roteiro, storyboard, direção visual e uma **cena-piloto** para você aprovar
antes de produzir o vídeo completo — narração, legendas, motion design e MP4.
Aparece como aba **"URL → Vídeo"** no mesmo `painel` (não é um app separado) e
também tem CLI própria.

```bash
mkivideos painel --port 3142          # abre a aba "URL → Vídeo" em /painel
mkivideos url2video status            # motor, requisitos, defaults
mkivideos url2video "https://exemplo.com/materia" --formato 9:16
mkivideos url2video aprovar <jobId>   # aprova a cena-piloto → produção completa
mkivideos url2video renderizar <slug> # gera o MP4 final
```

Isso é o motor **Content2Video INEMA** (`modules/content2video/`) integrado como
**módulo/engine**, não reescrito: o MKVideos sobe o processo em loopback sob
demanda, nunca serve a UI original dele, e apresenta tudo com a identidade
visual do MKVideos. Detalhes completos, requisitos, variáveis de ambiente,
limitações e a arquitetura de motores/provedores (preparada para Kling, Veo,
Runway, HeyGen, Sora, avatar e mídia local — ainda não implementados): ver
[`docs/url-para-video.md`](docs/url-para-video.md) e
[`docs/arquitetura-motores.md`](docs/arquitetura-motores.md).

> Diferença para o `gerar` acima: `gerar` é 100% offline/determinístico a partir
> de um **tema**; `url2video` parte de uma **URL real**, usa um provedor de IA
> (Codex CLI por padrão) para pesquisar a fonte e escrever o roteiro, e tem um
> gate de aprovação visual antes de produzir tudo.

## Central de vídeo: Música, Otimização, Legendas, Biblioteca

O MKVideos também é a interface única para mais três motores locais, todos como
aba do `painel` e subcomando da CLI. **Nenhum provider pago roda sem confirmação
explícita** (`--autorizo-gasto` na CLI, `confirm()` no painel) — ver
[`docs/modulos-video.md`](docs/modulos-video.md) para o detalhe completo.

| Aba / comando | O que faz | Motor |
|---|---|---|
| **Música + Videoclipe** (`mkivideos musicavideo`) | ideia → plano (letra/estilo/BPM) → aprovar música → capa → clipe cena a cena, reprovando/regenerando só o que não prestou | `modules/musicavideo` (MIT) |
| **Otimizar Vídeo** (`mkivideos otimizevideo`) | vídeo longo → transcrição → cenas → pontuação → seleção → corte de ~2 min. O LLM nunca escolhe timestamps | `modules/otimizevideo` |
| **Legendar** (`mkivideos legendas`) | enviar vídeo → transcrever → revisar/editar/sincronizar → queimar legenda (ou faixa selecionável) | código próprio (transcrição via otimizevideo, queima via FFmpeg) |
| **Biblioteca** (`mkivideos biblioteca`) | lista só-leitura de tudo que já foi produzido localmente (todos os módulos + `gerar`) | código próprio |

```bash
mkivideos painel --port 3142   # abre todas as abas
mkivideos doctor               # Node, Python, FFmpeg, yt-dlp, chaves, módulos
```

Licenças dos módulos vendorizados: [`LICENCAS-MODULOS.md`](LICENCAS-MODULOS.md).

## Modo fila (online, requer Claude logado)

Independente do `gerar` offline: a fila usa `claude -p` para rodar skills de vídeo (explicativo/curso/demo) com agente autônomo.

```bash
mkivideos add explicativo "Tema do vídeo"
mkivideos run --port 3141 --token minha-senha   # processa 1/vez + dashboard
mkivideos fila
```

Painel: `http://localhost:3141/videos?token=minha-senha`.

---

## Arquitetura (`src/`)

```
specs/      tipos de domínio, parser de tema, formatos, gerador de roteiro
templates/  receitas de arco por TIPO de vídeo (7) + bancos de frase
scenes/     15 renderers (html + animação) + registry + CSS por tipo
brands/     7 presets (paleta + fontes + identidade da CTA)
engine/     timing (sync por áudio), motion (M.* + transições), pipeline (orquestra)
audio/      TTS (Kokoro/XTTS/pré-gravado), ffprobe, música de fundo
render/     wrappers HyperFrames + setup do projeto (gsap/fontes/imagens)
composer.ts spec resolvido → index.html final
content/    centro de operações: store SQLite (conteúdo/contas/logs) + painel HTTP (+ aba URL → Vídeo) + scheduler (worker)
publishers/ adapters de publicação por plataforma (tiktok/instagram/youtube/facebook — mocks)
engines/    motores de vídeo plugáveis (interface VideoEngine) + adapter do content2video + providers/ (mídia por cena)
url2video/  funcionalidade "URL → Vídeo": defaults, validação, serviço único usado pelo painel e pela CLI
musicavideo/  adapter do CLI musicavideo (Música + Videoclipe) — spawn Python + leitura de estado.json
otimizevideo/ adapter do CLI otv (Otimizar Vídeo) — fases + gate de custo
legendas/   transcrever/revisar/queimar legenda (reaproveita otimizevideo p/ ASR, FFmpeg próprio p/ queima)
biblioteca/ índice unificado só-leitura de todo o acervo local
cost/       gate de gasto compartilhado — nenhum provider pago roda sem confirmação explícita
video/      wrapper FFmpeg (queima/mux de legenda)
localtools/ helpers de spawn de CLI (Python, timeout, erro) + raiz de dados locais
preflight/  `mkivideos doctor` — verifica Node/Python/FFmpeg/yt-dlp/Codex/chaves/módulos
env.ts      loader de .env sem dependência (nunca versiona segredos)
cli.ts / cli-lib.ts   comandos `gerar` + `painel` + `url2video` + `musicavideo` + `otimizevideo` + `legendas` + `biblioteca` + `doctor` + fila
queue.ts / sqlite-store.ts / dashboard.ts   fila host-agnóstica (ports & adapters)
```

```
modules/content2video/    motor da URL → Vídeo (servidor local; ver ORIGEM.md/PATCHES.md dentro da pasta)
modules/musicavideo/      motor da Música + Videoclipe (CLI Python; MIT)
modules/otimizevideo/     motor da Otimização (CLI Python)
modules/videosub/         referência da técnica de queima de legenda (NÃO executado — ver ORIGEM.md)
modules/musicavideo-pub/  só ORIGEM.md — vitrine pública NÃO integrada (ver ORIGEM.md)
```

Fluxo do `gerar`: **tema → roteiro (specs) → TTS (audio) → composição (composer) → render (render) → MP4**.

---

## Desenvolvimento

```bash
npm run build      # tsc → dist/
npm test           # vitest
npm run typecheck  # checagem de tipos sem build
npm run doctor      # Node, FFmpeg/FFprobe, Codex CLI, motor content2video — ver docs/url-para-video.md
```

> `better-sqlite3` compila um binário nativo no `npm install`. Em máquina Windows sem
> as *Build Tools* do Visual Studio (ou sem prebuild para a versão do Node em uso), o
> install falha só nessa dependência — o resto do projeto (typecheck/build/testes que
> não tocam `content/store` ou `sqlite-store`) funciona normalmente com
> `npm install --ignore-scripts`. Solução definitiva: `winget install
> Microsoft.VisualStudio.2022.BuildTools` (ver RESTAURAR.md) ou usar um Node com
> prebuild disponível para `better-sqlite3`.

Como usar a API programaticamente:

```ts
import { generateScript, compose, buildVideo, getBrand } from 'mkivideos';

const script = generateScript({ titulo: '5 formas de crescer no Instagram', tipo: 'vendas' });
// → { tipo, format, brand, hook, promise, scenes: [...] }

const { html } = compose({ scenes: script.scenes, brand: getBrand(script.brand), vertical: true });

await buildVideo({ titulo: 'Tema', tipo: 'curso', horizontal: true }); // pipeline completo
```
