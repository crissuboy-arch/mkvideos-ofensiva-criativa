# Patches locais sobre o upstream

Todos os patches são marcados no código com o comentário `// [MKVIDEOS PATCH]`.
Mantê-los mínimos facilita atualizar a partir do upstream.

## `app/server.mjs`

1. **UI estática desativada por padrão.**
   Nova flag `ALLOW_BUNDLED_UI` (`C2V_ALLOW_BUNDLED_UI=1`). Sem ela, `GET /`,
   `/index.html` e os assets de `app/public/` retornam `404` com uma mensagem
   apontando para o painel/CLI do MKVideos. A API JSON e `/project-media/*`
   continuam intactas. Objetivo: o Content2Video **não** aparece como app separado.

2. **`GET /healthz` (e `/api/healthz`).**
   Readiness leve `{ ok, version, bundledUi }` que **não** dispara
   `codex login status` (ao contrário de `/api/config`), para o MKVideos poder
   fazer probe de subida do processo sem custo.

Nenhuma outra linha do upstream foi alterada. `app/public/`, `scripts/video.mjs`,
`config/` e a documentação permanecem idênticos ao commit vendorizado.
