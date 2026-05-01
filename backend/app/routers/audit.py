from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.base import AuditLog, User
from app.routers.deps import get_current_user
from app.services.audit import verify_chain

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs")
async def get_audit_logs(
    case_id: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(AuditLog).order_by(desc(AuditLog.sequence))
    if case_id:
        q = q.where(AuditLog.case_id == case_id)
    q = q.offset(offset).limit(limit)

    result = await db.execute(q)
    logs = result.scalars().all()

    return [
        {
            "id": log.id,
            "sequence": log.sequence,
            "event": log.event,
            "case_id": log.case_id,
            "user_id": log.user_id,
            "details": log.details,
            "hash": log.hash,
            "prev_hash": log.prev_hash,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.get("/verify")
async def verify_audit_chain(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await verify_chain(db)
