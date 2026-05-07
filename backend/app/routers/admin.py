import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Any

from app.core.database import get_db
from app.core.security import hash_password
from app.models.base import Department, User, UserRole
from app.routers.deps import require_admin

# Simple file-based settings store (upgrade to DB table as needed)
SETTINGS_FILE = Path(__file__).parent.parent / "data" / "admin_settings.json"
SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/admin", tags=["Admin"])


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


class AdminCreateUserRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.REVIEWER
    department: str | None = None
    designation: str | None = None
    state: str | None = None
    mobile: str | None = None
    office_unit: str | None = None


class AdminUpdateUserRequest(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    role: UserRole | None = None
    department: str | None = None
    designation: str | None = None
    state: str | None = None
    mobile: str | None = None
    office_unit: str | None = None


class DepartmentOut(BaseModel):
    id: str
    name: str
    code: str
    email: str | None = None

    model_config = {"from_attributes": True}


class DepartmentUpsertRequest(BaseModel):
    name: str
    code: str
    email: EmailStr | None = None


def serialize_user(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        name=user.name,
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        department=user.department,
        designation=user.designation,
        state=getattr(user, "state", None),
        mobile=getattr(user, "mobile", None),
        office_unit=getattr(user, "office_unit", None),
    )


def serialize_department(department: Department) -> DepartmentOut:
    return DepartmentOut(
        id=str(department.id),
        name=department.name,
        code=department.code,
        email=department.email,
    )


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
    return [serialize_user(u) for u in users]


@router.post("/users", response_model=UserOut)
async def create_user(
    body: AdminCreateUserRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        department=body.department,
        designation=body.designation,
        state=body.state,
        mobile=body.mobile,
        office_unit=body.office_unit,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return serialize_user(user)


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: AdminUpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.email and body.email != user.email:
        existing = await db.execute(select(User).where(User.email == body.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = body.email

    if body.name is not None:
        user.name = body.name
    if body.role is not None:
        user.role = body.role
    if body.department is not None:
        user.department = body.department
    if body.designation is not None:
        user.designation = body.designation
    if body.state is not None:
        user.state = body.state
    if body.mobile is not None:
        user.mobile = body.mobile
    if body.office_unit is not None:
        user.office_unit = body.office_unit

    await db.commit()
    await db.refresh(user)
    return serialize_user(user)


@router.get("/departments", response_model=list[DepartmentOut])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(Department).order_by(Department.name.asc()))
    departments = result.scalars().all()
    return [serialize_department(department) for department in departments]


@router.post("/departments", response_model=DepartmentOut)
async def create_department(
    body: DepartmentUpsertRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    existing_name = await db.execute(select(Department).where(Department.name == body.name.strip()))
    if existing_name.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Department name already exists")

    existing_code = await db.execute(select(Department).where(Department.code == body.code.strip().upper()))
    if existing_code.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Department code already exists")

    department = Department(
        name=body.name.strip(),
        code=body.code.strip().upper(),
        email=body.email,
    )
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return serialize_department(department)


@router.patch("/departments/{department_id}", response_model=DepartmentOut)
async def update_department(
    department_id: str,
    body: DepartmentUpsertRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(Department).where(Department.id == department_id))
    department = result.scalar_one_or_none()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    clean_name = body.name.strip()
    clean_code = body.code.strip().upper()

    existing_name = await db.execute(
        select(Department).where(Department.name == clean_name, Department.id != department_id)
    )
    if existing_name.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Department name already exists")

    existing_code = await db.execute(
        select(Department).where(Department.code == clean_code, Department.id != department_id)
    )
    if existing_code.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Department code already exists")

    department.name = clean_name
    department.code = clean_code
    department.email = body.email
    await db.commit()
    await db.refresh(department)
    return serialize_department(department)
