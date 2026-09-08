# modules/otimizevideo — origem, licença e provenance

Cópia vendorizada do projeto **otimizevideo (`otv`)**, motor da funcionalidade
**Otimizar Vídeo** do MKVideos. Ver `src/otimizevideo/` para o adapter.

## Fonte

| Campo | Valor |
|---|---|
| Repositório | https://github.com/inematds/otimizevideo.git |
| Commit vendorizado | `8983500234c8856b841571e66bf88d53f3d7368b` |
| Data da cópia | 2026-09-01 |
| Licença upstream | **não declarada** (sem `LICENSE`, sem seção de licença no README) |

## O que foi copiado

```
otv.py           entrypoint (argparse: run/ingest/transcrever/cenas/pontuar/selecionar/render/narrar/substituir/status/custo)
otv/             fases/ provedores/ util/ config.py contratos.py
prompts/         prompts de classificação/pontuação/narração (Markdown)
config.yaml      defaults de slots/seleção (o MKVideos gera uma cópia com saida/trabalho absolutos — ver adapter)
requirements.txt dependências pip (não instaladas automaticamente — ver `mkivideos doctor`)
FALHAS.md        problemas reais já resolvidos (referência)
```

## O que NÃO foi copiado

`.git/`, `.github/`, `guia/`, `capa/`, `docs/` (specs/plans internos), `tests/`
(permanecem no clone upstream), `assets/` (ex.: `cta.mp4` fixo do autor — o
MKVideos não assume um CTA de terceiros; configurável via `config.yaml` se o
usuário quiser um próprio).

## Dependências externas (não vendorizadas, ver `mkivideos doctor`)

FFmpeg/FFprobe (obrigatório), yt-dlp (opcional, só para `otv run <url>`),
Python 3.10+ com `pip install -r requirements.txt`. Providers opcionais e
pesados (`openai-whisper`, `whisperx`, `torch`) **não** estão no
`requirements.txt` — só necessários se o usuário escolher os slots
`whisper_local`/`whisperx`.

## Patches locais

Ver `PATCHES.md`. Resumo: `otv/util/keys.py::key()` passa a checar
`os.environ` antes dos arquivos `~/projetos/*/.env` do fluxo original.

## Licença

**Sem licença OSI declarada.** Mesma situação do `modules/content2video` — ver
`LICENCAS-MODULOS.md` na raiz do MKVideos para o resumo consolidado e o que
isso implica antes de qualquer distribuição comercial.

## Como atualizar a partir do upstream

```bash
git clone https://github.com/inematds/otimizevideo.git /tmp/otv
# copiar otv.py otv/ prompts/ config.yaml requirements.txt FALHAS.md por cima deste diretório
# reaplicar o patch de PATCHES.md (key())
# atualizar o commit acima
```
