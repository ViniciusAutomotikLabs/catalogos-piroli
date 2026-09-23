FROM python:3.12-slim

WORKDIR /app
RUN pip install --no-cache-dir redis==5.2.1 fastapi==0.115.12 uvicorn==0.34.2

COPY gpasi_search_api.py /app/gpasi_search_api.py

ENV PORT=8080
EXPOSE 8080
CMD ["uvicorn", "gpasi_search_api:app", "--host", "0.0.0.0", "--port", "8080"]
