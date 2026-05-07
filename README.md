# NyayaSetu

> **AI-Powered Court Judgment Intelligence & Verified Action Engine**
> Built for India's High Courts, Supreme Court, and government departments.

[![Status](https://img.shields.io/badge/status-production--ready-emerald)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Backend](https://img.shields.io/badge/backend-FastAPI-009688)]()
[![Frontend](https://img.shields.io/badge/frontend-Next.js%2016-black)]()

---

## 🎯 The Problem

When a High Court delivers a judgment with directives to government departments, the current process is:
- A clerk **manually reads** 50-page judgments
- **Hand-copies** every "comply within X weeks" directive into spreadsheets
- **Emails** the right department, hopes it reaches them
- **No audit trail** — when a deadline is missed, nobody knows who saw what when

Result: missed compliance deadlines, contempt-of-court risks, wasted lakhs of officer hours.


## 💡 What NyayaSetu Does

A judgment PDF goes in. A **structured, verified, action-ready compliance plan** comes out — with every claim back-traceable to the exact paragraph in the source PDF and every action logged on a tamper-evident audit chain.

```
   📄 Judgment PDF
       ↓
   ┌─────────────────────────────────────────────────────────────┐
   │  1. PyMuPDF text + bbox extraction (Tesseract OCR fallback) │
   │  2. Legal chunker (regex) ──┐                                │
   │  3. Groq LLM (llama-3.3-70b)─┴── merged extraction           │
   │  4. Action plan generator (deadline regex + timeline engine) │
   │  5. SHA-256 audit chain entry                                │
   │  6. Human reviewer verifies in side-by-side PDF + form UI    │
   │  7. Verified directives → routed to responsible departments  │
   └─────────────────────────────────────────────────────────────┘
       ↓
   ✅ Verified Action Plan (JSON export · PDF traceability · audit-logged)
```
<img width="1536" height="1024" alt="Flow1" src="https://github.com/user-attachments/assets/6590a4c6-8963-497e-88a1-92ba66f5653e" />

<img width="1672" height="941" alt="flow2M" src="https://github.com/user-attachments/assets/3baedbef-545c-4cf8-810b-40cde1d4dd10" />

<img width="1536" height="1024" alt="flow3" src="https://github.com/user-attachments/assets/50c9ab99-0438-4b9c-ab82-a3d877e416f5" />

<img width="1536" height="1024" alt="flow4" src="https://github.com/user-attachments/assets/cfcd1b57-d4f1-4cb3-ace4-9804df4c0608" />


---

## 🏆 Why It's Production-Grade (not a prototype)

| Capability | Implementation |
|---|---|
| **Real PDF source highlighting** | PyMuPDF span-level bounding boxes with 60% needle-word matching → reviewer sees the exact phrase highlighted in the original PDF |
| **OCR fallback** | If a PDF has no text layer, falls back to Tesseract via `pdf2image` |
| **Tamper-evident audit chain** | SHA-256 hash chain with `prev_hash` linking + deterministic JSON serialization (`sort_keys=True`). Every event verifiable via `GET /api/audit/verify` |
| **Three-stage extraction with graceful degradation** | LLM (Groq) → regex chunker → manual review. If Groq quota is exhausted, the regex chunker still produces directives |
| **Real deadline parsing** | Regex patterns for "within N days/weeks/months", with action-type defaults (`COMPLY=30d`, `APPEAL=90d`, `INFORM=15d`) |
| **Appeal limitation tracker** | Auto-computes days remaining for `APPEAL` directives — surfaced explicitly in the UI to prevent missed appeal windows |
| **PII protection** | Raw PDF bytes never leave the server — only extracted text chunks are sent to the LLM |
| **CCMS webhook** | HMAC-shared-secret authenticated endpoint for automated judgment intake from Court Case Management Systems |
| **RBAC** | Three roles: `ADMIN`, `REVIEWER`, `DEPT_USER` — admin endpoints gated server-side |
| **Tamper-resistant password storage** | `bcrypt(SHA-256(password))` — sidesteps bcrypt's 72-byte limit and adds a stretching layer |
| **Presigned PDF URLs** | S3-compatible boto3 with time-limited URLs — frontend never holds raw credentials |

---

## 🏗 Architecture

<img width="1536" height="1024" alt="Arch" src="https://github.com/user-attachments/assets/c4202d10-2668-4b4f-bf05-2a55f90b9a33" />


```
nyayasetu/
├── frontend/                          # Next.js 16 + Bun + Tailwind
│   ├── app/
│   │   ├── (app)/                     # 13 authenticated pages
│   │   │   ├── dashboard/             # KPIs + status chart + deadlines
│   │   │   ├── cases/                 # All cases list + filters
│   │   │   │   └── [id]/review/       # ★ Side-by-side PDF + extraction form
│   │   │   ├── verified/              # Verified-only view
│   │   │   ├── calendar/              # Deadline timeline (Overdue → Later)
│   │   │   ├── departments/           # Per-department directive load
│   │   │   ├── audit/                 # Hash-chain log + integrity verifier
│   │   │   ├── downloads/             # Verified-case action plan exports
│   │   │   ├── reports/               # System-wide analytics
│   │   │   ├── upload/                # PDF ingest
│   │   │   └── admin/{users,departments,settings}
│   │   ├── login/  · register/        # Themed dark/light auth
│   │   └── api routes
│   ├── components/
│   │   ├── verification/PdfHighlightViewer.tsx  # Bbox overlay
│   │   └── dashboard/{StatsCard,StatusChart,DeadlinesList}
│   └── lib/{api.ts, auth-context.tsx, utils.ts}
│
├── backend/                           # Python 3.12 + FastAPI (async)
│   └── app/
│       ├── services/
│       │   ├── ingestion/
│       │   │   ├── pdf_extractor.py   # PyMuPDF + Tesseract OCR + bboxes
│       │   │   └── storage.py         # S3 SDK + presigned URLs
│       │   ├── chunking/
│       │   │   └── legal_chunker.py   # Regex-based directive detection
│       │   ├── llm/
│       │   │   └── extractor.py       # Groq llama-3.3-70b + JSON mode
│       │   ├── action_plan/
│       │   │   └── generator.py       # Deadline regex + timeline + ambiguity
│       │   └── audit.py               # SHA-256 hash chain
│       ├── routers/
│       │   ├── auth.py · cases.py · ingest.py · review.py
│       │   ├── audit.py · departments.py · ccms.py · admin.py
│       └── core/{config,database,security}
│
├── docker-compose.yml                 # Postgres + MinIO + backend + frontend
└── scripts/dev.sh                     # One-command local dev
```

---

## 🛠 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | **Next.js 16** + Bun + Tailwind CSS | Modern app router, fast HMR, RSC for the dashboard |
| Backend | **FastAPI** + SQLAlchemy 2.0 (async) + asyncpg | Type-safe APIs, async DB, OpenAPI docs free |
| Database | **PostgreSQL 16** | ACID guarantees for the audit chain |
| LLM | **Groq llama-3.3-70b-versatile** | 128k context, JSON-mode, free tier, sub-second latency |
| OCR | **PyMuPDF** + **Tesseract** (via pdf2image) | Real bbox extraction + scanned PDF fallback |
| Storage | **MinIO** (S3-compatible) via boto3 | Self-hosted, presigned URLs for govt sovereignty |
| Auth | **JWT HS256** + bcrypt with SHA-256 pre-hash | Industry standard, no 72-byte limit |
| Audit | **SHA-256 hash chain** | Tamper-evident, verifiable, no extra deps |
| Deploy | **Docker Compose** (one-command stack) | Reproducible, govt-cloud ready |

---

## 🚀 Quick Start

### Option A — One command (Docker)

```bash
GROQ_API_KEY=gsk-... docker compose up
```

- Frontend  → http://localhost:3000
- Backend   → http://localhost:8000/docs (Swagger UI)
- MinIO UI  → http://localhost:9001 (`minioadmin` / `minioadmin`)

### Option B — Local dev (no Docker)

```bash
# 1. Backend
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add GROQ_API_KEY
uvicorn app.main:app --reload

# 2. Frontend (in a second terminal)
cd frontend
bun install
bun dev
```

Or just run the bundled dev script which auto-handles ports, Postgres conflicts, venv health-checks:

```bash
./scripts/dev.sh
```

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account (role-aware: REVIEWER/DEPT_USER/ADMIN) |
| `POST` | `/api/auth/login` | Returns JWT + user profile |

### Case Lifecycle
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ingest` | Upload PDF → text+bbox extraction → LLM → action plan → DB |
| `POST` | `/api/ccms/webhook` | HMAC-authenticated automated intake from CCMS |
| `GET`  | `/api/cases` | List cases (filter by status/search) |
| `GET`  | `/api/cases/stats` | Dashboard KPIs + upcoming deadlines |
| `GET`  | `/api/cases/{id}` | Full case + directives + action plan summary |
| `GET`  | `/api/cases/{id}/pdf-url` | Presigned S3 URL (time-limited) |
| `GET`  | `/api/cases/{id}/export/action-plan` | JSON export of verified action plan |

### Review Workflow
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/review/directives/{id}` | Approve / reject / edit a directive |
| `POST` | `/api/review/cases/{id}/status` | Mark case VERIFIED / REJECTED / APPEALED |

### Audit Trail
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/audit/logs` | Paginated event log |
| `GET` | `/api/audit/verify` | Walks the hash chain — returns `{valid, total_records, broken_at_sequence?}` |

### Departments
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/departments/summary` | Aggregated counts + earliest deadline per department |
| `GET` | `/api/departments/actions` | Action plans assigned to a department |

### Admin (RBAC: ADMIN role required)
| Method | Endpoint | Description |
|---|---|---|
| `GET`  | `/api/admin/users` | All registered users |
| `GET`  | `/api/admin/settings` · `POST` | Persist platform settings |
| `GET`  | `/api/admin/system-info` | Live runtime info (Python version, LLM provider, storage backend) |

Full interactive docs: **`http://localhost:8000/docs`**

---

## 🛡 Security & Compliance

| Concern | Mitigation |
|---|---|
| **PII leak to external LLM** | Only extracted text chunks sent. Raw PDF bytes never leave the server. |
| **Data sovereignty** | Runs fully on-premise or govt cloud. Self-hosted MinIO. |
| **Tamper-evident logs** | SHA-256 hash chain with `prev_hash` linking. Verifiable via API. |
| **Auth** | JWT with HS256 + bcrypt(SHA-256(pwd)) password hashing |
| **RBAC** | Role-based admin endpoints, server-side enforced |
| **CSRF / replay** | HMAC shared-secret on CCMS webhook |
| **Audit completeness** | Every state transition (ingest, approve, reject, status change) is hash-chained |

---

## 📖 End-to-End Demo Flow

1. **Register** → choose role (Reviewer/Dept User/Admin), department, state
2. **Login** → land on dashboard with live KPIs
3. **Upload** → drag a judgment PDF onto the upload zone
4. **Ingestion runs** (~5–10s): PyMuPDF → Groq LLM → action plan → DB → audit log
5. **Pending Review badge** in sidebar increments
6. **Click "Pending Review"** → see the new case in the list
7. **Click "Review"** → side-by-side: PDF (with extracted directive highlighted) + extraction form
8. **Approve / edit / reject** each directive → status flips
9. **Mark case Verified** → moves to `/verified`, opens for export
10. **Calendar view** → see all deadlines grouped by urgency
11. **Audit page** → hit "Verify" → green chain integrity badge confirms zero tampering
12. **Department view** → see directives routed to each department
13. **Admin → System Info** → live values confirm everything is real (no mocks)

---

## 🧪 What Makes the Demo Believable

- **Audit verifier** — a single API call walks the entire SHA-256 chain and proves zero tampering. Try editing a hash row in the DB and run it again — it'll catch you.
- **PDF highlight overlay** — open the review page; the directive text in the panel maps to a real bbox-rendered highlight on the actual PDF page.
- **Graceful degradation** — kill the Groq API key in `.env` and re-upload; the regex chunker still extracts directives. Re-add the key, the LLM takes over.
- **Live system info** — admin settings panel pulls the real Python version, OS, configured LLM, storage backend. Nothing hardcoded.

---

## 🗺 Roadmap

- **Multi-language judgment support** — Hindi, Tamil, regional courts
- **Vector search across verified judgments** — Postgres `pgvector` for "find similar precedent"
- **Mobile officer app** — push notifications for assigned directives
- **Bulk CCMS sync** — daily cron pulling all new judgments from a court's API
- **Compliance simulator** — "what happens if Department X doesn't act in N days?"
- **Hindi UI** with i18n + bilingual judgment side-by-side

---

## 🙏 Built With

- [FastAPI](https://fastapi.tiangolo.com/) · [SQLAlchemy](https://www.sqlalchemy.org/) · [PyMuPDF](https://pymupdf.readthedocs.io/) · [Tesseract](https://tesseract-ocr.github.io/)
- [Groq](https://groq.com/) for blazing-fast LLM inference
- [Next.js](https://nextjs.org/) · [Tailwind CSS](https://tailwindcss.com/) · [Lucide Icons](https://lucide.dev/)
- [PostgreSQL](https://www.postgresql.org/) · [MinIO](https://min.io/)

---

**Smarter Insights. Assured Compliance.**
