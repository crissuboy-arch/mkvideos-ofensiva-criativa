# Pendências — decisões em aberto (mkivideos)

Itens levantados que precisam de **decisão do dono do projeto**. Não implementar sem aval.

---

## P1 — Concorrência da fila: manter `1` ou permitir `~3` paralelo?

**Status:** em aberto, aguardando decisão.
**Origem:** medição real no projeto FEP (`~/projetos/videos-explicativos/fep-videos/`, ver `RELATORIO-FEP-VIDEOS.md` §5), 2026-06-04.

### Contexto
O README do mkivideos parte da premissa: *"render satura CPU; rodar vários trava a máquina; por isso a fila serializa (concorrência = 1)."* A medição empírica **refina** essa premissa.

### Dados medidos (host atual)
- **20 núcleos de CPU** + 1 GPU NVIDIA GB10.
- Cada render HyperFrames usa **~6 workers de Chrome ≈ 6 núcleos**.
- Rodando **1 por vez** (concorrência atual), só ~6 de 20 núcleos são usados → **~14 núcleos ociosos** (load ~11–16, muita folga).
- **GPU NÃO ajuda** este pipeline: o gargalo é a **captura de frames** (CPU); GPU fica 0% mesmo com `--gpu --browser-gpu` (NVENC existe, mas encode é fração mínima do tempo).
- 18 módulos do FEP rodaram **em série** e levaram horas; em paralelo de ~3 teriam levado **~1/3**.

### Proposta a decidir
Tornar a concorrência **configurável** (ex.: env/flag `CONCURRENCY`, default conservador), em vez de `1` fixo:
- Regra de segurança: `concorrência × workers_por_render ≲ núcleos` (ex.: 3 × 6 ≈ 18 ≤ 20).
- Ou auto: `floor(nproc / workers_por_render) - 1`.
- Opcional: só subir a concorrência quando `load < núcleos` (coordenar com outras sessões/projetos no mesmo host).

### Trade-offs
- ✅ **~3× throughput** sem GPU, aproveitando CPU ociosa — relevante para produção em **volume** (muitos cursos/vídeos).
- ⚠️ Em host **compartilhado** (outras sessões renderizando), paralelizar volta a saturar (foi o que deixou o FEP lento no início, load 27–33). Por isso a premissa original de serializar **não está errada** — depende do host estar livre.
- ⚠️ Mais RAM (cada worker Chrome ~256 MB; 18 workers ≈ vários GB).

### Recomendação (não decisão)
Manter default = **1** (seguro, host-agnóstico), mas **expor** concorrência configurável + checagem de load, pra quem tem máquina folgada (como esta, 20 núcleos) ligar o paralelo e ganhar ~3×.

---

## P2 — (menor) Alinhar nomes de saída com prefixo ordenável

No FEP os finais foram renomeados para `<trilha>-<módulo>-...mp4` (ex.: `1-1-...`, `4-6-...`) para ordenar na sequência do curso. Avaliar se a fila do mkivideos deve gerar nomes já ordenáveis por padrão (prefixo numérico configurável), em vez de pós-renomear.

---

## P3 — Licença de `modules/content2video/` antes de qualquer distribuição pública

**Status:** em aberto, aguardando decisão.
**Origem:** integração da URL → Vídeo (motor content2video), 2026-09-01.

O upstream (`inematds/content2video`) não tem licença OSI — se declara "uso
interno e educacional INEMA". `modules/content2video/ORIGEM.md` documenta os
termos herdados e os créditos. Antes de publicar/distribuir o MKVideos com esse
diretório embutido (repositório público, build distribuído a terceiros, etc.),
confirmar com a INEMA ou remover `modules/content2video/` do pacote distribuído
(a funcionalidade URL → Vídeo degrada com erro claro — `mkivideos doctor` avisa
— o resto do MKVideos, MIT, não é afetado).

## P4 — Estado dos jobs da URL → Vídeo é por sessão do processo do motor

**Status:** limitação conhecida, não uma decisão pendente — registrada para
não surpreender quem usar `mkivideos url2video` via script/CI.
**Origem:** comportamento herdado do motor content2video (jobs em memória).

Ver `docs/url-para-video.md` § "Estado por sessão do motor". Resumo: cada
chamada one-shot de `mkivideos url2video` sobe e derruba um motor próprio; para
um fluxo criar → aprovar → editar → renderizar via CLI, use `MKIVIDEOS_C2V_URL`
apontando para um motor já rodando (ex.: `mkivideos painel` em outro terminal),
ou opere pelo painel. Se algum dia isso incomodar (ex.: automação sem painel
aberto), a solução seria um daemon próprio do MKVideos para o motor (pidfile
tipo `start.sh`/`stop.sh` do upstream) — não implementado agora por não ter
sido pedido.

---

## P5 — Licença: `otimizevideo` e `videosub` sem licença OSI declarada

**Status:** em aberto, aguardando decisão (igual ao P3, agora com mais módulos).

`modules/otimizevideo` e `modules/videosub` não têm `LICENSE` nem seção de
licença. `modules/musicavideo` é **MIT** (sem risco). `modules/musicavideo-pub`
não teve código vendorizado. Detalhe e caminho de mitigação consolidados em
[`LICENCAS-MODULOS.md`](LICENCAS-MODULOS.md). **Não bloqueia uso local.**

## P6 — Upload de vídeo no painel é por caminho de arquivo, não multipart

**Status:** limitação conhecida, próximo passo claro.

As abas **Otimizar Vídeo** e **Legendar** pedem o **caminho local** do arquivo
de vídeo (o painel é local; o CLI dos motores também trabalha com caminhos).
Upload real por `<input type=file>` + parsing multipart no servidor `node:http`
do painel é um próximo passo — não foi feito para não introduzir um parser de
multipart no servidor sem-dependências.

## P7 — Publicação para a vitrine pública (Hugging Face / musicavideo-pub) não integrada

**Status:** fora do escopo desta integração, por decisão de arquitetura.

`musicavideo nuvem` / `publica-hf` (aprovar produção → subir para um dataset do
Hugging Face → commitar o `manifest.json` no repo do `musicavideo-pub` e dar
push) exige credenciais de HF e permissão de push num repositório de terceiros —
e a instrução foi explícita em **não** transformar o `musicavideo-pub` num
segundo app. Quem quiser publicar continua usando o clone upstream do
`musicavideo` direto para esses dois comandos. Ver
`modules/musicavideo-pub/ORIGEM.md`.

## P8 — Providers pagos alternativos (`kling`, `fal`) nunca exercitados

Herdado do upstream `musicavideo`: `kling` e `fal` (alternativas pagas de clipe)
têm teste de contrato mas nunca rodaram contra a API real. Se forem usados via
`--motor clipe=kling:...`, tratar como não testado ponta a ponta.
