"""
Database setup.
- Locally: SQLite (file = inkingi.db, zero config needed)
- Production (Render): PostgreSQL via DATABASE_URL env var
"""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text


# ── Pick the right database URL ───────────────────────────────────────────────
_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./inkingi.db")

# Render gives "postgres://" but SQLAlchemy needs "postgresql+asyncpg://"
if _url.startswith("postgres://"):
    _url = _url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _url.startswith("postgresql://") and "asyncpg" not in _url:
    _url = _url.replace("postgresql://", "postgresql+asyncpg://", 1)

DATABASE_URL = _url

# ── Engine ────────────────────────────────────────────────────────────────────
_connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_async_engine(
    DATABASE_URL,
    echo=False,             # set True to print SQL queries while debugging
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


# ── Base class for all models ─────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── FastAPI dependency — inject a DB session into any route ───────────────────
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Create all tables on startup ──────────────────────────────────────────────
async def init_db():
    # Import every model so SQLAlchemy knows about the tables
    from app.models import alert, transaction, customer, analyst, partner  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables ready.")


# ── Add new columns to existing tables (no Alembic needed) ───────────────────
async def run_migrations():
    """Safely add new columns to existing tables (no Alembic needed)."""
    try:
        async with engine.begin() as conn:
            if "sqlite" in DATABASE_URL:
                # SQLite: check PRAGMA then ALTER TABLE
                for table, col, col_type in [
                    ("analysts",     "face_descriptor", "TEXT"),
                    ("analysts",     "photo_data",      "TEXT"),
                    ("alerts",       "institution",     "TEXT"),
                    ("transactions", "institution",     "TEXT"),
                    ("customers",    "institution",     "TEXT"),
                ]:
                    result = await conn.execute(text(f"PRAGMA table_info({table})"))
                    cols = [row[1] for row in result.fetchall()]
                    if col not in cols:
                        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
            else:
                # PostgreSQL: IF NOT EXISTS
                for table, col, col_type in [
                    ("analysts",     "face_descriptor", "TEXT"),
                    ("analysts",     "photo_data",      "TEXT"),
                    ("alerts",       "institution",     "VARCHAR(100)"),
                    ("transactions", "institution",     "VARCHAR(100)"),
                    ("customers",    "institution",     "VARCHAR(100)"),
                ]:
                    await conn.execute(text(
                        f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type}"
                    ))
        print("✅ Migrations applied.")
    except Exception as e:
        print(f"⚠️  Migration note: {e}")
