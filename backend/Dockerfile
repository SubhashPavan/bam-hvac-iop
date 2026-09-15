FROM python:3.12-slim

WORKDIR /app

# System deps for asyncpg / psycopg (Postgres in production)
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run injects PORT (default 8080)
ENV PORT=8080

CMD exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1 --timeout-keep-alive 120
