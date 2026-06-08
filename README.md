# mkivideos — Motor de Vídeos Ofensiva Criativa

Gera vídeos narrados, animados e renderizados **100% offline**, sem API do Claude.

Stack: HyperFrames (HTML→MP4 via Chrome headless + FFmpeg) + TTS local Kokoro.
Marca padrão: **OFENSIVA CRIATIVA — Marketing Sem Filtro**.

---

## O que é

Motor portátil de criação de vídeos explicativos para TikTok/Reels (9:16).
Gera hook + cenas numeradas + CTA da Ofensiva Criativa com:

- Narração sintética via Kokoro (voz `pf_dora`, PT-BR)
- Legendas automáticas com hard-kill
- Transições: fade / zoom / push / fadeBlack
- Ken Burns em todas as cenas
- Música de fundo gerada por FFmpeg
- Paleta dark: `#0A0F1E` bg / `#C9A227` gold accent

---

## Instalação

```bash
# clonar e instalar
git clone <url-do-repo> mkivideos
cd mkivideos
npm install
npm run build
```

Requer Node 20+.

---

## Configurar FFmpeg

O FFmpeg precisa estar no PATH do sistema.

**Windows (WinGet):**
```powershell
winget install Gyan.FFmpeg
# fechar e reabrir o terminal após instalar
ffmpeg -version   # deve mostrar a versão
```

**Verificar:**
```bash
ffmpeg -version
ffprobe -version
```

---

## Configurar Kokoro TTS

O Kokoro roda localmente via HyperFrames — não precisa instalar separado.

O HyperFrames baixa o Kokoro automaticamente na primeira execução:
```bash
npx hyperframes@0.6.80 tts "Olá mundo" --voice pf_dora --output teste.wav
```

Se quiser instalar o Python Kokoro manualmente:
```bash
pip install kokoro-onnx soundfile
```

---

## Como gerar um vídeo

```bash
# gerar vídeo offline (sem API do Claude)
mkivideos gerar "Como ganhar dinheiro com Bonequinhas 3D"

# com opções
mkivideos gerar "Título do vídeo" --vertical --cenas 5 --pasta C:\Videos\Renderizados
```

### Flags disponíveis

| Flag | Padrão | Efeito |
|------|--------|--------|
| `--vertical` | ativado | 9:16 TikTok/Reels (1080×1920) |
| `--cenas <n>` | 5 | número de cenas de conteúdo (+ hook + CTA = n+2 total) |
| `--tema <texto>` | — | dica extra para o gerador de cenas |
| `--pasta <caminho>` | `./renders/` | pasta de destino do MP4 final |

---

## Onde colocar imagens próprias

> Funcionalidade planejada (não implementada ainda).

Quando implementado, as imagens ficam em `assets/img/` dentro do projeto gerado.
Hoje as cenas usam gradientes e tipografia (sem imagens externas).

---

## Onde colocar sua voz

> Funcionalidade planejada (não implementada ainda).

Quando implementado, grave os WAVs com os mesmos nomes (`s1.wav`, `s2.wav`…)
e coloque em `assets/audio/` — o pipeline pula a etapa de TTS automaticamente
se os arquivos já existirem.

---

## Onde saem os vídeos prontos

Por padrão: `<projeto>/renders/<nome>-9x16.mp4`

Com `--pasta`: move para o caminho especificado após o render.

Exemplo:
```bash
mkivideos gerar "Título" --pasta "C:\Users\Voce\Videos\Renderizados"
# → C:\Users\Voce\Videos\Renderizados\titulo-9x16.mp4
```

---

## Modo fila (requer CLI do Claude logado)

O comando `mkivideos run` usa o CLI `claude -p` para processar a fila com agente autônomo.
Requer: `claude` logado com `claude login`.

```bash
# enfileirar
mkivideos add explicativo "Tema do vídeo"

# processar fila
mkivideos run --port 3141 --token minha-senha

# ver fila
mkivideos fila
```

O painel web fica em `http://localhost:3141/videos?token=minha-senha`.

---

## Estrutura do projeto

```
src/
  cli.ts              — entry point CLI
  cli-lib.ts          — comandos: gerar, add, fila, run
  generator.ts        — gerador offline de cenas + HTML
  offline-builder.ts  — pipeline: TTS → HTML → lint → render
  queue.ts            — motor de fila (modo online)
  sqlite-store.ts     — persistência SQLite
  dashboard.ts        — painel HTTP
  types.ts            — interfaces TypeScript
  index.ts            — barrel de exports
templates/
  video-explicativo.json   — config da marca Ofensiva Criativa
docs/
  ecossistema-video.md     — mapa de projetos de vídeo
```

---

## Desenvolvimento

```bash
npm run build      # compila TypeScript → dist/
npm test           # vitest
npm run typecheck  # verificação de tipos sem build
```
