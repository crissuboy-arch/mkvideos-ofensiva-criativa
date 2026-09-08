# modules/musicavideo-pub — origem, licença e provenance (referência, NÃO vendorizado como app)

## Fonte

| Campo | Valor |
|---|---|
| Repositório | https://github.com/inematds/musicavideo-pub.git |
| Commit analisado | `322e6a5c129dcb215719caa7ebeffd55c7f42c26` |
| Data da análise | 2026-09-01 |
| Licença upstream | não declarada |

## Decisão de arquitetura: por que este módulo NÃO foi vendorizado como código

`musicavideo-pub` é a **vitrine pública** do acervo do `musicavideo`: um app
Next.js implantado na Vercel, servindo mídia de um dataset do Hugging Face e um
contador de likes num Redis (Upstash/Vercel KV). É, por natureza, um segundo
aplicativo com stack própria (Next.js/React/Vercel) e infraestrutura externa
(HF + Redis) — exatamente o que a instrução do projeto pediu para **não**
recriar dentro do MKVideos.

Nada do código dele roda ou é importado pelo MKVideos. O único reaproveitamento
real é **conceitual**: o formato do `manifest.json` que ele consome (produzido
pelo `musicavideo publica-hf`) — um card por produção, com `mvd`, `slug`,
`titulo`, `quando`, faixas/capas/clipe, versão aprovada — inspirou o formato de
item da aba **Biblioteca** do MKVideos (`src/biblioteca/types.ts`), que lista
o que já existe **localmente** (musicavideo, otimizevideo, legendas,
content2video, `gerar`), sem precisar de HF/Vercel/Redis.

## O que foi copiado

Só `UPSTREAM-README.md`, para referência. Nenhum código (`app/`, `lib/`,
`next.config.mjs`, etc.) foi copiado — evitar isso é o ponto desta decisão.

## Publicação para a vitrine pública — fora do escopo desta integração

Os comandos `musicavideo nuvem`/`musicavideo publica-hf` (aprovar produção →
subir para o Hugging Face → republicar o `manifest.json` no repo do
`musicavideo-pub` via commit+push) **não foram conectados ao MKVideos**. Isso
exigiria credenciais de Hugging Face e permissão de push num repositório GitHub
de terceiros — decisão de produto e de custo que cabe ao usuário tomar fora
desta automação. Quem quiser publicar para a vitrine pública continua usando o
clone upstream do `musicavideo` diretamente para esses dois comandos.

## Licença

Sem licença OSI declarada — ver `LICENCAS-MODULOS.md`. Como o código não é
usado, o risco prático para o MKVideos é nulo; documentado por completude.
