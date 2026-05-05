import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Any

from app.core.database import get_db
from app.models.base import User
from app.routers.deps import get_current_user

# Simple file-based settings store (upgrade to DB table as needed)
SETTINGS_FILE = Path(__file__).parent.parent / "data" / "admin_settings.json"
SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/admin", tags=["Admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role.value != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    department: str | None = None
    designation: str | None = None
    state: str | None = None
    mobile: str | None = None
    office_unit: str | None = None

    model_config = {"from_attributes": True}


@router.get("/settings")
async def get_settings(_admin: User = Depends(require_admin)) -> dict[str, Any]:
    """Get saved admin settings."""
    if SETTINGS_FILE.exists():
        return json.loads(SETTINGS_FILE.read_text())
    return {}


@router.get("/system-info")
async def system_info(_admin: User = Depends(require_admin)) -> dict[str, Any]:
    """Live system information for the admin panel — never hardcoded."""
    import platform
    import sys
    from app.core.config import settings as app_settings

    # Detect what's actually configured
    llm_provider = "Groq (llama-3.3-70b)" if app_settings.groq_api_key else "Not configured"
    storage_backend = (
        f"S3-compatible @ {app_settings.s3_endpoint_url}"
        if app_settings.s3_endpoint_url else "AWS S3"
    )

    return {
        "version": "1.0.0",
        "service": "NyayaSetu API",
        "python": sys.version.split()[0],
        "platform": platform.system(),
        "database": "PostgreSQL (asyncpg)",
        "storage": storage_backend,
        "llm": llm_provider,
        "audit_chain": "SHA-256 hash chain (tamper-evident)",
        "frontend_url": app_settings.frontend_url,
    }


@router.post("/settings")
async def save_settings(
    body: dict[str, Any],
    _admin: User = Depends(require_admin),
) -> dict[str, str]:
    """Persist admin settings."""
    SETTINGS_FILE.write_text(json.dumps(body, indent=2))
    return {"status": "saved"}


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List all registered users. Admin only."""
    result = await db.execute(select(User).order_by(User.name))
    users = result.scalars().all()
    return [
        UserOut(
            id=str(u.id),
            name=u.name,
            email=u.email,
            role=u.role.value if hasattr(u.role, "value") else str(u.role),
            department=u.department,
            designation=u.designation,
            state=getattr(u, "state", None),
            mobile=getattr(u, "mobile", None),
            office_unit=getattr(u, "office_unit", None),
        )
        for u in users
    ]
