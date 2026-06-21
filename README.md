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
| `--imagens <pasta>` | — | pasta com `cena1.png`…`cenaN.png` para fundos das cenas |
| `--voz <nome>` | — | voz personalizada (ex: `cris`); fallback Kokoro se não encontrar |

---

## Onde colocar imagens próprias

Crie imagens com os nomes `cena1.png`, `cena2.png`… e coloque em qualquer pasta.
Passe o caminho com `--imagens`:

```bash
mkivideos gerar "Título" --imagens "C:\Users\Evand\meus-videos-ia\assets\imagens"
```

Formatos aceitos: `.png`, `.jpg`, `.jpeg`, `.webp`.
Cenas sem imagem usam o fundo premium automático da Ofensiva Criativa.

---

## Onde colocar sua voz

A pasta de vozes fica em:
```
C:\Users\Evand\meus-videos-ia\vozes\cris\
```

### Modo 1 — Arquivos pré-gravados (melhor qualidade)

Grave você mesma cada cena e salve como `s1.wav`, `s2.wav`… na pasta da voz.

| Arquivo | Cena |
|---------|------|
| `s1.wav` | Hook (abertura) |
| `s2.wav` | Cena 1 de conteúdo |
| `s3.wav` … | Cenas seguintes |
| `sN.wav` | CTA final |

Arquivos faltando → sistema usa Kokoro TTS para aquela cena.

### Modo 2 — Clonagem automática com XTTS v2

Coloque um único arquivo `referencia.wav` (10–30 segundos, voz natural, ambiente silencioso).
O sistema gera toda a narração clonando sua voz automaticamente.

Requer instalação:
```bash
pip install TTS
```

### Formato recomendado
- **WAV**, 44100 Hz, mono ou estéreo
- Ambiente silencioso (sem eco, sem barulho)
- Fale no mesmo tom e ritmo que quer nos vídeos

### Como testar a voz

```bash
# Gera vídeo usando voz Cris (com fallback automático)
mkivideos gerar "5 formas de ganhar dinheiro com IA" --voz cris

# Combinando voz + imagens
mkivideos gerar "Título" --voz cris --imagens "C:\caminho\imagens" --pasta "C:\Videos\Renderizados"
```

Se os arquivos `s1.wav`…`sN.wav` não existirem, o sistema avisa quais estão faltando
e usa Kokoro como placeholder — você pode gravar e rodar de novo depois.

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
