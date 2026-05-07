"""Immutable SHA-256 hash chain audit log."""
import hashlib
import json
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.base import AuditLog

GENESIS_HASH = "0" * 64


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


def _build_payload(
    *,
    event: str,
    case_id: str | None,
    user_id: str | None,
    details: dict | None,
    sequence: int,
    prev_hash: str,
    ts: str,
) -> str:
    return json.dumps(
        {
            "case_id": case_id,
            "user_id": user_id,
            "event": event,
            "details": details,
            "sequence": sequence,
            "prev_hash": prev_hash,
            "ts": ts,
        },
        sort_keys=True,
    )


async def append_audit_log(
    db: AsyncSession,
    *,
    event: str,
    case_id: str | None = None,
    user_id: str | None = None,
    details: dict | None = None,
) -> AuditLog:
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.sequence.desc()).limit(1)
    )
    last = result.scalar_one_or_none()

    prev_hash = last.hash if last else GENESIS_HASH
    sequence = (last.sequence + 1) if last else 0
    now = datetime.utcnow()
    ts = now.isoformat()

    payload = _build_payload(
        case_id=case_id,
        user_id=user_id,
        event=event,
        details=details,
        sequence=sequence,
        prev_hash=prev_hash,
        ts=ts,
    )
    hash_val = _sha256(payload)

    log = AuditLog(
        case_id=case_id,
        user_id=user_id,
        event=event,
        details=details,
        hash=hash_val,
        prev_hash=prev_hash,
        sequence=sequence,
        created_at=now,
    )
    db.add(log)
    await db.flush()
    return log


async def verify_chain(db: AsyncSession) -> dict:
    result = await db.execute(select(AuditLog).order_by(AuditLog.sequence.asc()))
    logs = result.scalars().all()

    for i, log in enumerate(logs):
        expected_prev = GENESIS_HASH if i == 0 else logs[i - 1].hash
        if log.prev_hash != expected_prev:
            return {"valid": False, "broken_at_sequence": log.sequence}
        expected_hash = _sha256(
            _build_payload(
                case_id=log.case_id,
                user_id=log.user_id,
                event=log.event,
                details=log.details,
                sequence=log.sequence,
                prev_hash=log.prev_hash,
                ts=log.created_at.isoformat(),
            )
        )
        if log.hash != expected_hash:
            return {"valid": False, "broken_at_sequence": log.sequence}

    return {"valid": True, "total_records": len(logs)}
