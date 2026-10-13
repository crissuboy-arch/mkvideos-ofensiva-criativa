# tools/yt — scripts do youtube-agent-skill (vendored)

Origem: https://github.com/Jakeschincariol/youtube-agent-skill
Licença: **MIT** — cópia e adaptação livres, sem restrições.

Ficheiros:
- `hookscore.py` + `hooks.json` — pontua ganchos (usado por `src/yt/hooks.ts`)
- `deadair.py` — lista de cortes a partir de SRT/VTT/whisper-json (usado por `src/yt/cuts.ts`)
- `title.py` — lint título+thumbnail
- `retention.py` — leitura de retenção do YouTube Studio
- `swipe.py` — motor de viralidade do nicho
- `chapters.py` — capítulos a partir da transcrição

Estes scripts são chamados como subprocesso via `src/localtools/exec.ts`
(`runTool`), o mesmo padrão do ffmpeg. Nada aqui é importado como módulo.
