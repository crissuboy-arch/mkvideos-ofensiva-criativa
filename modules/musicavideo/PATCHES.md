# Patches locais sobre o upstream (musicavideo)

Marcados no código com `# [MKVIDEOS PATCH]`.

## `providers/base.py`

`ler_env_chave()` passa a checar `os.environ.get(nome)` **antes** de escanear os
arquivos `~/projetos/openpcbotv2/.env` / `~/projetos/wifi/.env` do fluxo
original. O MKVideos repassa `KIE_API_KEY`/`AGNES_API_KEY`/`FAL_KEY` (lidas do
`.env` centralizado na raiz do MKVideos) como variáveis de ambiente do processo
filho ao spawnar `musicavideo.sh`/`python3 src/main.py` — nunca escreve nem lê
arquivos fora da árvore do projeto. Quem já usa o fluxo original (arquivos
`~/projetos/*/.env`) continua funcionando sem mudança: o fallback é preservado
intacto, só a ordem de checagem muda.

## `data/` — dependência de runtime que faltava na vendorização (2026-09-09)

Não é patch de código: `data/estilos.json`, `data/templates-capa.json`,
`data/templates-clipe.json` e `data/fontes/*.ttf` foram copiados do upstream (o
`planner.py`/`arte.py` os leem por `RAIZ / "data"`). A vendorização inicial os
tinha classificado como "acervo de exemplo" e o `plano` quebrava antes de
qualquer chamada de rede. Arquivos idênticos ao upstream, MIT.

Nenhuma outra linha do upstream foi alterada.
