# MoneyPrinterTurbo — motor isolado para o MKVideos (NÃO é um deploy de produção).
#
# Verificado 27/10/2026 contra o pacote pip oficial mpt==1.3.9 (MIT):
# o pacote instala o módulo `app` e `app.asgi:app` importa sem erros, por
# isso a API corre com uvicorn (o console script só expõe `cli` e `webui`;
# não existe `mpt api`).
#
# Construir num anfitrião com Docker (autorização à parte):
#   docker build -t moneyprinterturbo-mkvideos-isolated .
# Correr com o docker-compose.yml deste diretório. A imagem NÃO contém
# credenciais: o config.toml (com api_key) é montado em runtime, ignorado
# pelo git. Nenhuma publicação automática em redes sociais é configurada.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MPT_HOME=/data \
    PATH="/usr/local/bin:$PATH"

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "mpt==1.3.9"

WORKDIR /app
EXPOSE 8080

# Só loopback: o compose publica 127.0.0.1:8080. Nunca expor esta API
# publicamente sem TLS, controlos de rede e api_key configurada.
CMD ["uvicorn", "app.asgi:app", "--host", "127.0.0.1", "--port", "8080"]
