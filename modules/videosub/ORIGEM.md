# modules/videosub — origem, licença e provenance (referência, NÃO executado)

## Fonte

| Campo | Valor |
|---|---|
| Repositório | https://github.com/inematds/videosub.git |
| Commit vendorizado | `aa47bedd2d06fff23a6dffc28ebcce6c3afcf2a4` |
| Data da cópia | 2026-09-01 |
| Licença upstream | não declarada (sem `LICENSE`, sem seção de licença no README) |

## Decisão de arquitetura: por que este módulo é código de REFERÊNCIA, não um adapter rodando

O videosub real (`apps/server` + `apps/web`, Node/pnpm workspace) é um pipeline
completo **conteúdo → roteiro → voz (ElevenLabs) → imagens (Agnes) → movimento →
legenda → render**, muito parecido em forma com o `content2video`. A pedido do
MKVideos, a funcionalidade **Legendar** deveria fazer outra coisa: **enviar um
vídeo já existente e transcrever/legendar ele** — o videosub não tem essa
transcrição de vídeo alheio (as legendas dele nascem do roteiro que ele mesmo
escreveu, com timing derivado da voz gerada, não de ASR sobre um upload).

Rodar o servidor inteiro do videosub só para reaproveitar a técnica de queima de
legenda (`ffmpeg -vf subtitles=...`) duplicaria pipeline (roteiro/voz/imagem que
o MKVideos não precisa aqui) e um terceiro processo Node em loopback (o
`content2video` já é um). Em vez disso:

- A **técnica** de queima de legenda em `apps/server/src/media.ts` (filtro
  `subtitles` do FFmpeg com `force_style`, margens, cor) foi usada como
  **referência de implementação** para `src/video/ffmpeg.ts` (código novo,
  escrito para o MKVideos, citando esta origem em comentário).
- A **transcrição real** (upload → ASR com timestamps por palavra) é feita
  reaproveitando o adapter já existente de `otimizevideo` (fase `transcrever`,
  provider Groq) em vez de implementar um terceiro caminho de ASR — ver
  `docs/legendar.md`.

Por isso só o `apps/server/src` (para leitura/crédito) e os docs foram
copiados — **nada daqui é importado ou executado pelo MKVideos.** `apps/web`
(React/Vite) não foi vendorizado — a UI do MKVideos para "Legendar" é original,
no design system do painel.

## O que foi copiado (referência)

```
apps/server/src/media.ts    técnica de queima de legenda (referência p/ src/video/ffmpeg.ts)
apps/server/src/app.ts      rotas do pipeline completo original (contexto)
apps/server/src/types.ts    modelo de dados original (contexto)
apps/server/src/config.ts   config original (contexto)
DESIGN.md / PRODUCT.md      sistema visual e produto do upstream (NÃO usado — o MKVideos usa seu próprio design system)
env.example.reference        .env.example original (referência)
```

## Licença

Sem licença OSI declarada — ver `LICENCAS-MODULOS.md`. Como nenhum código daqui
roda no MKVideos (é só leitura/crédito), o risco prático é baixo, mas o crédito
de origem é mantido mesmo assim.
