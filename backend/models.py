"""
SQLAlchemy ORM models — mirrors the existing PostgreSQL schema exactly (PRD Section 10).

These are read-only reflections of the tables already created in Supabase.
Do NOT modify column names/types here without changing the DB schema first.
"""

from sqlalchemy import (
    Column, Integer, String, Text, Float, Numeric, Date, DateTime,
    ForeignKey, func,
)
from backend.database import Base


class MP(Base):
    __tablename__ = "mps"

    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    house = Column(String(20), nullable=False)
    constituency = Column(String(150))
    state = Column(String(100), nullable=False)
    district = Column(String(100), nullable=False)


class Agency(Base):
    __tablename__ = "agencies"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    district = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)


class Work(Base):
    __tablename__ = "works"

    id = Column(Integer, primary_key=True)
    mp_id = Column(Integer, ForeignKey("mps.id"))
    agency_id = Column(Integer, ForeignKey("agencies.id"))
    category = Column(String(100), nullable=False)
    description = Column(Text)
    state = Column(String(100), nullable=False)
    district = Column(String(100), nullable=False)
    sanctioned_amt = Column(Numeric(14, 2))
    released_amt = Column(Numeric(14, 2))
    expenditure = Column(Numeric(14, 2))
    sanction_date = Column(Date)
    expected_completion = Column(Date)
    actual_completion = Column(Date)
    status = Column(String(20), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class CategoryBaseline(Base):
    __tablename__ = "category_baselines"

    category = Column(String(100), primary_key=True)
    median_cost = Column(Numeric(14, 2))
    std_cost = Column(Numeric(14, 2))
    median_duration_days = Column(Integer)


class RiskScore(Base):
    __tablename__ = "risk_scores"

    work_id = Column(Integer, ForeignKey("works.id"), primary_key=True)
    cost_score = Column(Float)
    duplicate_score = Column(Float)
    delay_score = Column(Float)
    risk_score = Column(Float)
    risk_band = Column(String(30))
    computed_at = Column(DateTime, server_default=func.now())


class Flag(Base):
    __tablename__ = "flags"

    id = Column(Integer, primary_key=True)
    work_id = Column(Integer, ForeignKey("works.id"))
    source = Column(String(20), nullable=False)
    reason_text = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class DuplicatePair(Base):
    __tablename__ = "duplicate_pairs"

    id = Column(Integer, primary_key=True)
    work_id_a = Column(Integer, ForeignKey("works.id"))
    work_id_b = Column(Integer, ForeignKey("works.id"))
    similarity_score = Column(Float, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    mp_id = Column(Integer, ForeignKey("mps.id"))
    district = Column(String(100))
    state = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())
