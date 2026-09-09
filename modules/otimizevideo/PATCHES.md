# Patches locais sobre o upstream (otimizevideo)

Marcado no código com `# [MKVIDEOS PATCH]`.

## `otv/util/keys.py`

`key()` passa a checar `os.environ.get(nome)` **antes** de escanear
`~/projetos/openpcbotv2/.env` / `~/projetos/wifi/.env`. O MKVideos repassa
`GROQ_API_KEY`/`OPENROUTER_API_KEY`/`ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID`/
`FAL_KEY` (lidas do `.env` centralizado na raiz do MKVideos) como env do
processo filho ao spawnar `otv.py`. O fallback original é preservado.

## I/O de JSON em UTF-8 explícito

`Path.write_text()` / `Path.read_text()` sem `encoding=` usam o locale do SO. No
Windows isso é `cp1252`: os `*.json` das fases saíam gravados em cp1252 e o lado
JS do MKVideos (`readFileSync(..., 'utf-8')`) os lia como UTF-8, trocando cada
acento por `�` (`Vídeo`→`V�deo`, `atenção`→`aten��o`). Os `read_text`/`write_text`
das fases do pipeline passam a fixar `encoding="utf-8"` — que é o que o JSON exige
(RFC 8259) e o que os consumidores já esperavam. Comportamento em Linux/macOS
(default já UTF-8) não muda.

Arquivos: `otv/fases/transcrever.py`, `otv/fases/ingest.py`, `otv/util/custos.py`,
`otv/fases/unidades.py`, `otv/fases/selecionar.py`, `otv/fases/render.py`,
`otv/fases/pontuar.py`.

## `otv/fases/pontuar.py` — provedor `local_heuristic` (offline, sem LLM)

`pontuar()` ganha o provedor **`local_heuristic`**: pontuação determinística por
**regras** (não IA) sobre os dados já em disco (`unidades.json` + `metadata.json`)
— duração, densidade de fala (palavras/s), posição temporal, frase completa,
número/termo relevante, penalização de CTA/saudação/enrolação. Escreve o mesmo
`notas.json` que a rota LLM (passa pelo `validar_notas`), com `provedor:
"local_heuristic"` e custo `0`. Permite o pipeline `ingest → transcrever → cenas →
pontuar → selecionar → render` rodar **100% offline**. Os provedores LLM
(`glm`/`gemini`/`ollama`/`claude_cli`) seguem disponíveis via `--provedor`.

Nenhuma outra linha do upstream foi alterada.
