# Ghost Author — Setup Guide

## Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL 15+ running locally (or via Docker)

---

## 1. PostgreSQL — create the database

```sql
CREATE USER ghost WITH PASSWORD 'secret';
CREATE DATABASE ghost_author OWNER ghost;
```

Or with Docker (quickest):
```bash
docker run -d --name ghost-pg \
  -e POSTGRES_USER=ghost \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=ghost_author \
  -p 5432:5432 \
  postgres:15-alpine
```

---

## 2. Python backend

```bash
# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Copy env file and fill in your keys
copy .env.example .env
# Edit .env: add GEMINI_API_KEY, GITHUB_TOKEN, etc.

# Start the API server (auto-creates DB tables on first run)
python start.py
```

API runs at: http://localhost:8000  
Swagger docs: http://localhost:8000/docs

---

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5176

---

## 4. Alembic migrations (for production)

```bash
# Generate first migration
alembic revision --autogenerate -m "initial schema"

# Apply migrations
alembic upgrade head
```

---

## Environment Variables (.env)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL async URL |
| `GEMINI_API_KEY` | ✅ | For AI refactoring |
| `GITHUB_TOKEN` | Optional | For PR creation |
| `GITHUB_CLIENT_ID` | Optional | For GitHub OAuth login |
| `GITHUB_CLIENT_SECRET` | Optional | For GitHub OAuth login |
| `SECRET_KEY` | ✅ | JWT signing secret |
| `FRONTEND_URL` | Optional | Defaults to http://localhost:5176 |

---

## Architecture

```
Browser (React/Vite :5176)
        │  REST + WebSocket
        ▼
FastAPI API (:8000)
  ├── /api/runs      — trigger, list, detail, WS streaming
  ├── /api/repos     — repo management
  ├── /api/metrics   — live aggregated stats from Postgres
  ├── /api/settings  — persistent agent config
  └── /api/auth      — GitHub OAuth + JWT
        │
        ▼
PostgreSQL (ghost_author DB)
  tables: users, repos, runs, smell_reports, run_logs,
          agent_settings, metrics_snapshots

Agent pipeline (runs as BackgroundTask):
  DiffIngestor → PolicyGuard → SmellAnalyzer (ALL smells, v2)
  → SandboxManager (git worktree) → RetryLoop (Gemini + tests)
  → PRWriter → GitHubClient → DB persist → WS broadcast
```
