from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.catalog import seed_departments
from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.models.base import Base
from app.routers import auth, cases, ingest, review, audit, departments, ccms, admin, action_plans, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Safe column additions — idempotent, won't fail if column already exists
        for sql in [
            # users
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS office_unit VARCHAR",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR",
            # cases
            "ALTER TABLE cases ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 0",
            "ALTER TABLE cases ADD COLUMN IF NOT EXISTS received_at TIMESTAMP",
            # directives
            "ALTER TABLE directives ADD COLUMN IF NOT EXISTS deadline_text VARCHAR",
            # action_plans
            "ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS remarks TEXT",
            "ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS affidavit_storage_key VARCHAR",
            "ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS completion_notes TEXT",
            "ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS reviewer_feedback TEXT",
            "ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP",
            "ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP",
        ]:
            await conn.execute(__import__("sqlalchemy").text(sql))
    async with AsyncSessionLocal() as session:
        await seed_departments(session)
    yield


app = FastAPI(
    title="NyayaSetu API",
    description="AI-Powered Court Judgment Intelligence & Verified Action Engine",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(cases.router, prefix="/api")
app.include_router(ingest.router, prefix="/api")
app.include_router(review.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(ccms.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(action_plans.router, prefix="/api")
app.include_router(reports.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "🚀 NyayaSetu API is running!", "docs": "/docs", "health": "/health"}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "NyayaSetu API"}
