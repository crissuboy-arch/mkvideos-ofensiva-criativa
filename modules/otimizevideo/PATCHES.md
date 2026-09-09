# Patches locais sobre o upstream (otimizevideo)

Marcado no código com `# [MKVIDEOS PATCH]`.

## `otv/util/keys.py`

`key()` passa a checar `os.environ.get(nome)` **antes** de escanear
`~/projetos/openpcbotv2/.env` / `~/projetos/wifi/.env`. O MKVideos repassa
`GROQ_API_KEY`/`OPENROUTER_API_KEY`/`ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID`/
`FAL_KEY` (lidas do `.env` centralizado na raiz do MKVideos) como env do
processo filho ao spawnar `otv.py`. O fallback original é preservado.

## I/O de JSON em UTF-8 explícito (`otv/fases/transcrever.py`, `otv/fases/ingest.py`, `otv/util/custos.py`)

`Path.write_text()` / `Path.read_text()` sem `encoding=` usam o locale do SO. No
Windows isso é `cp1252`: `transcript.json` (e `metadata.json`, `custos.json`)
saíam gravados em cp1252 e o lado JS do MKVideos (`src/legendas/service.ts`,
`readFileSync(..., 'utf-8')`) os lia como UTF-8, trocando cada acento por `�`
(`Vídeo`→`V�deo`, `atenção`→`aten��o`). Os `read_text`/`write_text` desses três
arquivos passam a fixar `encoding="utf-8"` — que é o que o JSON exige (RFC 8259) e
o que os consumidores já esperavam. Comportamento em Linux/macOS (default já
UTF-8) não muda.

Nenhuma outra linha do upstream foi alterada.
