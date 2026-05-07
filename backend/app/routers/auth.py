from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.catalog import DEPARTMENT_NAMES, ROLE_OPTIONS
from app.core.database import get_db
from app.core.security import verify_password, hash_password, create_access_token
from app.models.base import Department, User, UserRole

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    role: UserRole = UserRole.REVIEWER
    department: str | None = None
    designation: str | None = None
    mobile: str | None = None
    office_unit: str | None = None
    state: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class RoleOption(BaseModel):
    key: str
    label: str
    desc: str


class DepartmentOption(BaseModel):
    id: str
    name: str
    code: str
    email: str | None = None


class RegisterOptionsResponse(BaseModel):
    roles: list[RoleOption]
    departments: list[DepartmentOption]


@router.get("/options", response_model=RegisterOptionsResponse)
async def register_options(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Department))
    departments = result.scalars().all()
    departments_by_name = {department.name: department for department in departments}

    ordered_departments = [
        DepartmentOption(
            id=str(department.id),
            name=department.name,
            code=department.code,
            email=department.email,
        )
        for name in DEPARTMENT_NAMES
        if (department := departments_by_name.get(name)) is not None
    ]

    catalog_names = {item.name for item in ordered_departments}
    extras = sorted(
        (
            DepartmentOption(
                id=str(department.id),
                name=department.name,
                code=department.code,
                email=department.email,
            )
            for department in departments
            if department.name not in catalog_names
        ),
        key=lambda item: item.name.lower(),
    )

    return RegisterOptionsResponse(
        roles=[RoleOption(**role) for role in ROLE_OPTIONS],
        departments=[*ordered_departments, *extras],
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    return TokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "department": user.department,
            "designation": user.designation,
        },
    )


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=req.email,
        name=req.name,
        hashed_password=hash_password(req.password),
        role=req.role,
        department=req.department,
        designation=req.designation,
        mobile=req.mobile,
        office_unit=req.office_unit,
        state=req.state,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "name": user.name, "email": user.email, "role": user.role},
    )
