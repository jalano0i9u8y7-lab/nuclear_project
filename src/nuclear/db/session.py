"""SQLAlchemy session."""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from nuclear.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=settings.app_env == "development",
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_session() -> Session:
    """Get database session."""
    return SessionLocal()


def init_db():
    """Initialize database (create tables)."""
    from nuclear.db import models  # noqa: F401
    from nuclear.db.models import Base

    Base.metadata.create_all(bind=engine)
