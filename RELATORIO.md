# MKVideos — relatório da missão web + API ScalaFlow (atualizado 2026-11-23)

Branch: `feat/web-api-scalaflow` (a partir da main @ cf1b85f). **Sem merge.**

## Ambiente provado nesta máquina
- **Node 22 obrigatório** (v22.21.1 em ~/workspace/node22): com Node 24 o
  `better-sqlite3` falha a compilar (node-gyp). `npm install` + `npm run build` OK.
- **Kokoro TTS**: venv Python 3.12 em `.venv/` com `kokoro-onnx` + `soundfile`.
  Correr o CLI/painel com `.venv/bin` e `node22/bin` no PATH.
- **Doctor: "Requisitos obrigatórios OK"** (Node 22, FFmpeg/ffprobe 8.1.2, Kokoro, módulos).
- **Testes: 237/237 PASS** (228 originais + 9 novos).

## HyperFrames — causa do bloqueio encontrada e corrigida
A cache do npx (`~/.npm/_npx`) tinha uma instalação **incompleta** do
`hyperframes@0.6.80` (só `dist/`, sem `package.json`) deixada por uma
tentativa interrompida — o CLI morria em silêncio no `init`. Correção:
apagar a entrada da cache e deixar a instalação completa terminar (o
postinstall é lento, ~minutos). Depois disso, `hyperframes init` cria o
projeto corretamente (provado em pasta de teste: hyperframes.json,
index.html, package.json).

## O que foi implementado (commit f5ca532)
1. **Itens com roteiro próprio, imagens e voz**: colunas `roteiro`,
   `imagens_dir`, `voz` (migração leve no store); formulário do painel com
   os três campos; o `generate` do CLI passa `scenes` (roteiro → cenas,
   1 parágrafo = 1 cena, via `src/content/roteiro.ts`), `imagens_dir` e
   `voz` ao `buildVideo` — capacidades que o motor já tinha e o painel não
   expunha.
2. **Ver e baixar o MP4 no painel**: `GET /api/items/:id/video` (streaming;
   `?dl=1` força download) e links ▶ Ver / ⬇ MP4 na biblioteca.
3. **API ScalaFlow** (`src/content/scalaflow-routes.ts`), ativa só com
   `MKVIDEOS_API_KEY` no ambiente (fail-closed), Bearer em tempo constante:
   - `POST /api/scalaflow/projects/:projectId/videos`
     { titulo, descricao?, publico?, oferta?, roteiro?, tipo? (vsl→vendas),
       formato? (9:16|16:9), marca?, voz?, imagens_dir? } → 202 { jobId }
     Sem roteiro, compõe um a partir de descrição/público/oferta.
   - `GET /api/scalaflow/jobs/:jobId` → queued|running|done|error (+erro)
   - `GET /api/scalaflow/jobs/:jobId/download` → MP4 (409 se não pronto)
   Trabalhos na tabela `scalaflow_jobs` (mesmo SQLite); item criado com
   `produto = "scalaflow:<projectId>"` (organização por projeto); fila
   serial partilha a mesma geração única do painel.
   Testes: 401 sem/com chave errada, 400 sem título, ciclo completo com
   download byte-a-byte, fila FIFO, 404/409, API desligada sem chave.
   Smoke ao vivo (servidor real): painel 200, API 401 sem chave, 404 com
   chave para job inexistente.

## Falta (depende de aprovação manual nesta máquina)
- **A prova final: gerar o MP4 real** pelo motor (init + narração Kokoro +
  render HyperFrames) e validar com ffprobe. O passo de execução abre um
  cartão de aprovação que precisa de ser aceite pela Cristiane.
  Comando: `node dist/cli.js gerar "<tema>" --tipo vendas --vertical
  --marca ofensiva-criativa --cenas 3 --pasta <saida>` (PATH com .venv +
  node22; `MKIVIDEOS_LOW_MEMORY=1`).

## Hospedagem (análise, nada contratado)
A Vercel **não serve** para o render (serverless: sem FFmpeg/Chrome/modelos
locais, tempo e disco limitados). O servidor do painel+API é um processo
Node simples (porta 3142) e corre onde o motor corre:
- **PC da Cristiane** (custo 0): painel acessível na rede local; para o
  ScalaFlow (na Vercel) o alcançar, é preciso um túnel/URL pública.
- **VPS pequena com Node 22 + FFmpeg + Chrome** (paga — só com autorização).
- **RunPod por hora** (pago — só com autorização) para renders pesados.
Recomendação: validar primeiro no PC dela; a API já está pronta para o
botão "Criar VSL" do ScalaFlow apontar para o URL onde o painel correr,
com a mesma MKVIDEOS_API_KEY dos dois lados.

## Custos
$0 até agora. Nenhum serviço contratado, nada publicado, main intacta.
