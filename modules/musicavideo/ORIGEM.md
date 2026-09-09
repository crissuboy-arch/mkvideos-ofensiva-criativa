# modules/musicavideo — origem, licença e provenance

Cópia vendorizada do projeto **musicavideo**, motor da funcionalidade
**Música + Videoclipe** do MKVideos. Tratado como módulo/CLI local — ver
`src/musicavideo/` para o adapter que o MKVideos usa.

## Fonte

| Campo | Valor |
|---|---|
| Repositório | https://github.com/inematds/musicavideo.git |
| Commit vendorizado | `f00ef573bc21f2868a7ee36dbcfe3ed960218991` |
| Data da cópia | 2026-09-01 |
| Licença upstream | **MIT** (declarada no `UPSTREAM-README.md`, seção "Licença") |

## O que foi copiado

```
src/            CLI (planner, executor, estado, custo, indexer, painel de leitura, arte, montagem…)
providers/      adapters de provider (kie/suno, agnes, fal, kling, inemaimg) + registry
data/           config de runtime: estilos.json (catálogo de estilos), templates-capa/clipe.json,
                fontes/*.ttf (composição da capa). Lido por planner.py e arte.py via `RAIZ/"data"`.
musicavideo.sh  roteador fino: delega para `python3 src/main.py`
CHANGELOG.md / FALHAS.md   histórico e problemas reais já resolvidos (referência)
env.example.reference       .env.example original (referência — o `.env` real fica na raiz do MKVideos)
```

> **Correção 2026-09-09:** `data/` foi copiado agora — a vendorização inicial o
> tratou como "acervo de exemplo", mas `data/estilos.json` e
> `data/templates-*.json` são dependências de runtime do `planner.py`
> (`plano` quebrava com `FileNotFoundError: …/tests/fixtures/estilos.json`).

## O que NÃO foi copiado

`.git/`, `.github/` (GitHub Pages), `guia/`, `capa/` (imagens de exemplo),
`tests/` (133 testes pytest — permanecem no clone upstream se precisar rodá-los),
`SKILL.md`/`HELP.md`/`flow.json` (integração com o bot Telegram `inemaccbot`,
fora do escopo do MKVideos), `musicavideo-painel.service` (systemd, Linux-only).

## Patches locais

Ver `PATCHES.md`. Resumo: `providers/base.py::ler_env_chave` passa a checar
`os.environ` antes dos arquivos `~/projetos/*/.env` do fluxo original — permite
o MKVideos injetar as chaves centralizadas em `.env` sem escrever arquivos fora
do projeto. Nenhuma outra linha foi alterada.

## Licença

MIT — igual ao resto do MKVideos. Sem risco de licença para uso/distribuição.

## Como atualizar a partir do upstream

```bash
git clone https://github.com/inematds/musicavideo.git /tmp/mvd
# copiar src/ providers/ data/ musicavideo.sh CHANGELOG.md FALHAS.md por cima deste diretório
# reaplicar o patch de PATCHES.md (ler_env_chave)
# atualizar o commit acima
```
