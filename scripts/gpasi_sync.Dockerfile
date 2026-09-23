FROM python:3.12-slim
WORKDIR /opt/gpasi-sync
RUN pip install --no-cache-dir redis==5.2.1
# Scripts are bind-mounted from /opt/gpasi-sync on the host at runtime.
CMD ["python", "/opt/gpasi-sync/gpasi_redis_sync.py", "--full"]
