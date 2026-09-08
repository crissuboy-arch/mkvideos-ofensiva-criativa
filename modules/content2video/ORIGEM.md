# modules/content2video — origem, licença e provenance

Este diretório é uma **cópia vendorizada** do projeto Content2Video INEMA, usado pelo
MKVideos como **motor** ("engine") da funcionalidade **URL → Vídeo**. Ele **não** é um
aplicativo separado: o MKVideos consome apenas a API deste motor e apresenta tudo pela
sua própria interface (painel + CLI).

## Fonte

| Campo | Valor |
|---|---|
| Repositório | https://github.com/inematds/content2video.git |
| Commit vendorizado | `12b885ca1bada26fd5112a5917aceac3af88ffbc` |
| `package.json` version | `1.7.2` (exibida como `v1.07.02`) |
| Data da cópia | 2026-09-01 |

## O que foi copiado

```
app/server.mjs              orquestrador HTTP (motor): gate visual, produção, render, CTA, checkpoints
app/public/                 UI original do upstream — DESATIVADA por padrão (ver "Patches locais")
config/*.json               defaults de produção + presets visuais
scripts/video.mjs           modo headless (create/list/check/preview/render)
AGENTS.md / DESIGN.md        regras editoriais e design system do upstream (referência)
PRODUCT.md / ROADMAP.md      contexto de produto do upstream (referência)
docs/                       plano e relatório de MVP do upstream (referência)
UPSTREAM-README.md          README original do upstream
env.example.reference       .env.example original (referência; o .env real fica na raiz do MKVideos)
```

## O que NÃO foi copiado (regra da integração)

`.git/`, `node_modules/`, `output/`, `.runtime/`, `capa/`, `guia/assets/`, `.impeccable/`,
`.github/` (GitHub Pages), `start.sh`/`stop.sh` (o ciclo de vida é gerido pelo MKVideos).

## Patches locais (mínimos)

Ver `PATCHES.md`. Resumo: a UI estática empacotada (`GET /`, `/app.js`, `/app.css`, …)
só responde quando `C2V_ALLOW_BUNDLED_UI=1`. Por padrão o motor expõe **somente** a API
JSON e `/project-media/*`. Nenhuma outra linha do upstream foi alterada.

## Licença

O upstream declara: **"Uso interno e educacional INEMA. Verifique os direitos do
conteúdo-fonte e das mídias antes de distribuir cada vídeo."** Não há arquivo `LICENSE`
OSI no repositório de origem.

Implicações para o MKVideos (licença `MIT`):

- Este módulo **não** é redistribuído sob MIT. Ele mantém os termos do upstream
  ("uso interno e educacional INEMA") e os créditos originais (`UPSTREAM-README.md`,
  `AGENTS.md`, `DESIGN.md`, `PRODUCT.md`).
- Antes de qualquer distribuição pública do MKVideos que inclua este diretório,
  obter autorização da INEMA ou remover `modules/content2video/`. O restante do
  MKVideos continua MIT e a funcionalidade URL → Vídeo degrada com erro claro
  quando o motor não está presente.
- Cada vídeo gerado herda responsabilidade sobre direitos do conteúdo-fonte e das
  mídias capturadas da página de origem (ver `AGENTS.md` e `UPSTREAM-README.md`).

## Como atualizar a partir do upstream

```bash
git clone https://github.com/inematds/content2video.git /tmp/c2v
# copiar app/ config/ scripts/ AGENTS.md DESIGN.md docs/ por cima deste diretório
# reaplicar os patches de PATCHES.md
# atualizar o commit acima e rodar: npm run doctor && npm test
```
