import enum
import hashlib
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, JSON
)
from sqlalchemy.orm import relationship

from app.core.database import Base


def generate_id():
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    REVIEWER = "REVIEWER"
    DEPT_USER = "DEPT_USER"


class CaseStatus(str, enum.Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    VERIFIED = "VERIFIED"
    ACTIONED = "ACTIONED"
    APPEALED = "APPEALED"
    REJECTED = "REJECTED"


class ActionType(str, enum.Enum):
    COMPLY = "COMPLY"
    APPEAL = "APPEAL"
    INFORM = "INFORM"
    MONITOR = "MONITOR"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_id)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.REVIEWER)
    department = Column(String)
    designation = Column(String)
    mobile = Column(String)
    office_unit = Column(String)
    state = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    actions = relationship("CaseAction", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")


class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, default=generate_id)
    case_number = Column(String, unique=True, nullable=False)
    court = Column(String, nullable=False)
    petitioners = Column(Text, nullable=False)
    respondents = Column(Text, nullable=False)
    judgment_date = Column(DateTime)
    filed_at = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(CaseStatus), default=CaseStatus.PENDING_REVIEW)

    pdf_storage_key = Column(String)
    extracted_text = Column(Text)
    highlights = Column(JSON)

    confidence_score = Column(Float, default=0.0)
    fingerprint = Column(String)

    actions = relationship("CaseAction", back_populates="case")
    audit_logs = relationship("AuditLog", back_populates="case")
    directives = relationship("Directive", back_populates="case")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Directive(Base):
    __tablename__ = "directives"

    id = Column(String, primary_key=True, default=generate_id)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    case = relationship("Case", back_populates="directives")

    text = Column(Text, nullable=False)
    page_number = Column(Integer)
    highlight_coords = Column(JSON)

    action_type = Column(Enum(ActionType), nullable=False)
    department = Column(String, nullable=False)
    deadline = Column(DateTime)
    confidence_score = Column(Float, default=0.0)
    fingerprint = Column(String, nullable=False)

    is_ambiguous = Column(Boolean, default=False)
    ambiguity_reason = Column(String)

    # Appeal limitation period (days remaining at time of ingestion)
    limitation_days = Column(Integer)

    status = Column(Enum(CaseStatus), default=CaseStatus.PENDING_REVIEW)
    reviewed_by = Column(String)
    reviewed_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CaseAction(Base):
    __tablename__ = "case_actions"

    id = Column(String, primary_key=True, default=generate_id)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    case = relationship("Case", back_populates="actions")

    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="actions")

    action_type = Column(String, nullable=False)
    notes = Column(Text)
    previous_data = Column(JSON)
    new_data = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_id)
    case_id = Column(String, ForeignKey("cases.id"))
    case = relationship("Case", back_populates="audit_logs")

    user_id = Column(String, ForeignKey("users.id"))
    user = relationship("User", back_populates="audit_logs")

    event = Column(String, nullable=False)
    details = Column(JSON)

    hash = Column(String, unique=True, nullable=False)
    prev_hash = Column(String, nullable=False)
    sequence = Column(Integer, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)


class Department(Base):
    __tablename__ = "departments"

    id = Column(String, primary_key=True, default=generate_id)
    name = Column(String, unique=True, nullable=False)
    code = Column(String, unique=True, nullable=False)
    email = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
