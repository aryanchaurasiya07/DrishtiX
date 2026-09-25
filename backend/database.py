"""
Database connection and session factory.

Reads DATABASE_URL from .env / .env.txt in the project root.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Load env
_project_root = Path(__file__).resolve().parent.parent
for _name in (".env", ".env.txt"):
    _candidate = _project_root / _name
    if _candidate.exists():
        load_dotenv(_candidate, override=True)
        break

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found in environment or .env / .env.txt")

# Ensure SQLAlchemy uses psycopg2 driver (not psycopg v3 which isn't installed)
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(DATABASE_URL, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session, closes on teardown."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
