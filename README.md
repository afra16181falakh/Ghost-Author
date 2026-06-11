# Ghost Author

Ghost Author is an AI-powered autonomous code quality agent. It detects code smells, generates safe refactors using Gemini, validates changes with your tests, and (optionally) opens documented draft PRs.

- **Backend:** FastAPI + PostgreSQL (async) + Celery/Redis for agent runs
- **Frontend:** React (Vite) dashboard + live run status via WebSocket

---

## Features

- **AST-based smell detection** (static analysis)
- **LLM refactoring** (Gemini) with iterative retry when tests fail
- **Safety sandboxing** using isolated **git worktrees** / branches
- **Test-driven validation** before persisting results / publishing PRs
- **Live UI updates** (WebSocket streaming)
- **Observability hooks**: Swagger, /health endpoints, optional Prometheus metrics

---

## Demo repository

This repo includes a local test harness under `demo_repo/`.

---

## Architecture (high level)

```text
Browser (React/Vite)
   │  REST + WebSocket
   ▼
FastAPI API (:8000)
   ├─ /api/* routers (runs, repos, metrics, settings, audit)
   ├─ Celery dispatch (or in-process fallback)
   └─ WebSocket manager for run streaming

PostgreSQL (ghost_author db)
Redis (Celery + websocket pubsub)

Agent pipeline (background task)
  DiffIngestor → PolicyGuard → SmellAnalyzer → SandboxManager
  → RetryLoop (LLM + tests) → PRWriter → persistence + WS broadcast
```

---

## Prerequisites

- **Python 3.11+**
- **Node.js 20+**
- **PostgreSQL 15+**

---

## Local development (Python + React)

### 1) Backend

```bash
python -m venv .venv
.venv\Scripts\activate

pip install -r requirements.txt

copy .env.example .env
# edit .env with GEMINI_API_KEY, SECRET_KEY, DATABASE_URL, etc.

python start.py
```

API:
- http://localhost:8000
- Swagger: http://localhost:8000/docs

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend:
- http://localhost:5176 (or 3000 depending on config)

---

## Docker / Docker Compose

```bash
docker compose up --build
```

Services:
- `db` (Postgres)
- `redis`
- `api` (FastAPI)
- `worker` (Celery worker)
- `frontend` (Nginx serving built React)

Ports:
- API: `8000`
- Frontend: `3000`

---

## Environment variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` — PostgreSQL async URL
- `GEMINI_API_KEY` — AI provider key
- `SECRET_KEY` — JWT signing secret
- `GITHUB_TOKEN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — optional (GitHub login / PR creation)
- `FRONTEND_URL` — optional (CORS)

For the full list, see `SETUP.md`.

---

## GitHub webhook support

The API includes a GitHub webhook endpoint:

- `POST /webhook/github`

Register it in your GitHub repo settings with payload URL:

- `http://<your-host>/webhook/github`

Supported events:
- `push`
- `pull_request`

---

## Testing

Run backend tests:

```bash
pytest
```

The `demo_repo/` includes parser tests used for local validation.

---

## Repository layout

- `api/` — FastAPI backend (routes, auth, schemas, WS manager, Celery integration)
- `app/` — repository and webhook listeners
- `domain/` — core domain logic (diff ingestion, policy guard, smell registry)
- `services/` — LLM + patch/PR services
- `runners/` — sandboxing, retry loop, runner orchestration
- `frontend/` — React UI
- `demo_repo/` — test repository with intentional quality smells

<<<<<<< HEAD
---

## License

Add your license here.
=======

>>>>>>> 563e455dcf2292dd1a8ad10290d21e643b74ccdf

