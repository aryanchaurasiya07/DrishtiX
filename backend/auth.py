"""
F9 — Auth & RBAC: JWT login endpoint (PRD Section 6.1, 11, 13).

POST /auth/login — validates credentials, returns JWT with role + scope claims.
Token expiry controlled by JWT_EXPIRY_HOURS env var (default 8h for demo).
"""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas import LoginRequest, LoginResponse

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

_project_root = Path(__file__).resolve().parent.parent
for _name in (".env", ".env.txt"):
    _candidate = _project_root / _name
    if _candidate.exists():
        load_dotenv(_candidate, override=True)
        break

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET not set in environment")

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "8"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_scope(user: User) -> dict:
    """Build scope dict from user record — used as JWT claim and response."""
    if user.role == "mp":
        return {"mp_id": user.mp_id}
    elif user.role == "district":
        return {"district": user.district, "state": user.state}
    elif user.role == "state":
        return {"state": user.state}
    else:  # ministry
        return {}


def create_access_token(user: User) -> str:
    """Create a signed JWT containing role and scope claims."""
    scope = _build_scope(user)
    payload = {
        "sub": user.username,
        "role": user.role,
        "scope": scope,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# Dependency: get_current_user
# ---------------------------------------------------------------------------

class CurrentUser:
    """Decoded user context from JWT — used by enforce_scope."""
    def __init__(self, username: str, role: str, scope: dict):
        self.username = username
        self.role = role
        self.scope = scope

    @property
    def mp_id(self):
        return self.scope.get("mp_id")

    @property
    def district(self):
        return self.scope.get("district")

    @property
    def state(self):
        return self.scope.get("state")


def get_current_user(token: str = Depends(oauth2_scheme)) -> CurrentUser:
    """FastAPI dependency — decodes JWT and returns CurrentUser."""
    payload = decode_token(token)
    return CurrentUser(
        username=payload.get("sub", ""),
        role=payload.get("role", ""),
        scope=payload.get("scope", {}),
    )


# ---------------------------------------------------------------------------
# Login endpoint
# ---------------------------------------------------------------------------

@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    POST /auth/login
    Validates username + password (bcrypt), returns JWT.
    """
    user = db.query(User).filter(User.username == body.username).first()

    is_valid = False
    if user and user.password_hash:
        try:
            is_valid = bcrypt.checkpw(
                body.password.encode("utf-8"),
                user.password_hash.encode("utf-8"),
            )
        except Exception:
            is_valid = False

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(user)
    scope = _build_scope(user)

    return LoginResponse(
        access_token=token,
        role=user.role,
        scope=scope,
    )
