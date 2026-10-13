# Integração MKVideos + OpenMontage + youtube-agent-skill

## O que é

Três fases opcionais no pipeline `buildVideo`, todas **desligadas por omissão**
(nada muda se não ativares as flags):

| Fase | Flag | Módulo | Custo |
|---|---|---|---|
| `ganchos` | `MKV_HOOKS=1` | `src/yt/hooks.ts` → `tools/yt/hookscore.py` | $0 |
| `cortes` | `MKV_CUTS=1` | `src/yt/cuts.ts` → `tools/yt/deadair.py` | $0 |
| `pos` | `MKV_OM_POS=1` | `src/om/bridge.ts` → OpenMontage `silence_cutter` | $0 |
| `pos` pago | `MKV_OM_PAID=1` + confirmar | `src/om/paid.ts` → higgsfield/kling/veo… | pago |

## Licenças (regra dura)

- `tools/yt/*` — **MIT** (youtube-agent-skill). Vendored: pode copiar/adaptar.
- OpenMontage — **AGPLv3**. Fica **fora do repo**, em `MKV_OM_ROOT`
  (omissão `~/workspace/open-montagen`). `src/om/bridge.ts` nunca importa
  esse código: executa `tools/om/run_tool.py` como **processo separado**
  (mesmo padrão do ffmpeg). O MKVideos continua MIT.

## Uso

```bash
# ganchos: pontua candidatos antes do TTS (o melhor vira a narração da cena 1)
MKV_HOOKS=1 npx mkivideos build --titulo "X" --hooks '["gancho 1","gancho 2"]'

# cortes: EDL a partir do SRT (ex.: mkivideos legendas transcrever)
MKV_CUTS=1 npx mkivideos build --titulo "X" --srt transcricao.srt

# pos: corta silêncios do mp4 final (falha aberta: mantém o original se falhar)
MKV_OM_POS=1 npx mkivideos build --titulo "X"
```

## Provedores pagos

```ts
import { runPaidTool } from './src/om/paid.js';
await runPaidTool('higgsfield_video', { image_path, prompt }, {
  confirm: async (msg) => perguntarNaUI(msg), // sempre explícito, por chamada
});
```
Sem `MKV_OM_PAID=1` → `PaidGateError` antes de qualquer chamada.
Sem confirmação → nada é executado.

## Skills no Claude Code (conversa, sem código)

Instaladas em `~/.claude/skills/yt-*`: `/yt-script`, `/yt-edit`, `/yt-shorts`,
`/yt-package`, `/yt-viral`, `/yt-retention`, `/yt-seo`, `/yt-chapters`,
`/yt-audit`, `/yt-comment`, `/yt-plan`. Preencher `~/.claude/youtube/voice.md`
primeiro.
