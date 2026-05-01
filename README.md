# NyayaSetu — Court Judgment Intelligence Engine

AI-Powered Court Judgment Intelligence & Verified Action Engine for Karnataka High Court.

## Architecture

```
nyayasetu/
├── frontend/          # Next.js 16 + Bun (UI)
│   ├── app/(app)/     # Authenticated pages (dashboard, cases, upload, audit)
│   ├── app/login/     # Login page
│   ├── components/    # Reusable UI components
│   └── lib/           # API client, auth context, utils
│
├── backend/           # Python FastAPI
│   └── app/
│       ├── services/
│       │   ├── ingestion/     # PyMuPDF + Tesseract OCR + S3 storage
│       │   ├── chunking/      # Legal Chunking Engine (rule-based)
│       │   ├── llm/           # Claude API entity extraction
│       │   └── action_plan/   # Action Mapper + Timeline Engine + Ambiguity Detector
│       ├── routers/           # FastAPI routes (auth, cases, ingest, review, audit)
│       ├── models/            # SQLAlchemy ORM models
│       └── core/              # Config, DB engine, security
│
└── docker-compose.yml  # PostgreSQL + MinIO + backend + frontend
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 + Bun + Tailwind CSS + Recharts |
| Backend | Python 3.12 + FastAPI + SQLAlchemy (async) |
| OCR | PyMuPDF + Tesseract + pdf2image |
| LLM | Anthropic Claude (text only — no raw PII) |
| Database | PostgreSQL 16 |
| Storage | S3-compatible (MinIO for local dev) |
| Audit | SHA-256 immutable hash chain |
| Auth | JWT (HS256) + role-based access |

## Quick Start

### 1. Prerequisites
- [Bun](https://bun.sh) ≥ 1.0
- Python 3.12+
- Docker & Docker Compose
- Tesseract OCR (`brew install tesseract` on macOS)

### 2. Clone & configure
```bash
cp backend/.env.example backend/.env
# Edit backend/.env — add your ANTHROPIC_API_KEY
```

### 3. Docker (full stack)
```bash
ANTHROPIC_API_KEY=sk-ant-... docker compose up
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs
- MinIO Console: http://localhost:9001

### 4. Local dev (no Docker)

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in ANTHROPIC_API_KEY
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
bun install
bun dev
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register user |
| POST | `/api/ingest` | Upload & process PDF |
| GET | `/api/cases` | List cases |
| GET | `/api/cases/stats` | Dashboard stats |
| GET | `/api/cases/:id` | Case detail + directives |
| POST | `/api/review/directives/:id` | Approve / reject directive |
| POST | `/api/review/cases/:id/status` | Update case status |
| GET | `/api/audit/logs` | Audit log |
| GET | `/api/audit/verify` | Verify hash chain integrity |

## Security & Compliance

- **No raw PII sent to LLM** — only extracted text chunks
- **Data sovereignty** — runs fully on-premise / govt cloud
- **Immutable audit trail** — SHA-256 hash chain (tamper-evident)
- **Role-based access** — ADMIN / REVIEWER / DEPT_USER
- **All actions logged** — ingestion, approvals, edits, rejections
