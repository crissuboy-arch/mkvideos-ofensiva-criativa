# Patches locais sobre o upstream (otimizevideo)

Marcado no código com `# [MKVIDEOS PATCH]`.

## `otv/util/keys.py`

`key()` passa a checar `os.environ.get(nome)` **antes** de escanear
`~/projetos/openpcbotv2/.env` / `~/projetos/wifi/.env`. O MKVideos repassa
`GROQ_API_KEY`/`OPENROUTER_API_KEY`/`ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID`/
`FAL_KEY` (lidas do `.env` centralizado na raiz do MKVideos) como env do
processo filho ao spawnar `otv.py`. O fallback original é preservado.

Nenhuma outra linha do upstream foi alterada.
