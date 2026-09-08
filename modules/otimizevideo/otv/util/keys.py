import os
from pathlib import Path
ARQUIVOS = [Path.home() / "projetos/openpcbotv2/.env", Path.home() / "projetos/wifi/.env"]

def key(nome):
    # [MKVIDEOS PATCH] variável de ambiente do processo tem prioridade. O MKVideos
    # centraliza segredos em .env/.env.example/src/env.ts na raiz do projeto e
    # repassa como env do processo filho ao spawnar este CLI — não depende dos
    # arquivos ~/projetos/*/.env do fluxo original (que continuam funcionando
    # como fallback, sem alteração de comportamento pra quem já os usa).
    v = os.environ.get(nome)
    if v and v.strip():
        return v.strip()
    for f in ARQUIVOS:
        if not f.exists():
            continue
        for ln in f.read_text().splitlines():
            if ln.startswith(nome + "="):
                return ln.split("=", 1)[1].strip().strip('"').strip("'")
    raise KeyError(f"{nome} não encontrada em {[str(a) for a in ARQUIVOS]}")
