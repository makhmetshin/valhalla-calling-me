FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt ./
RUN python -m venv /opt/venv && /opt/venv/bin/pip install -r requirements.txt


FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    VALHALLA_HOST=0.0.0.0 \
    VALHALLA_PORT=8777 \
    VALHALLA_VAULT_DIR=/vault

RUN groupadd --gid 1000 valhalla \
    && useradd --uid 1000 --gid 1000 --shell /usr/sbin/nologin --no-create-home valhalla

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY valhalla ./valhalla
COPY web ./web
COPY serve.py ./

RUN install -d -o valhalla -g valhalla /vault

USER valhalla
EXPOSE 8777
VOLUME ["/vault"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8777/api/preferences', timeout=4)"

CMD ["python", "serve.py"]
