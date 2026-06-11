FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Run Alembic migrations, then start API with Gunicorn + Uvicorn workers
CMD ["sh", "-c", "alembic upgrade head && gunicorn api.main:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:8000 --timeout 120 --access-logfile - --error-logfile -"]
