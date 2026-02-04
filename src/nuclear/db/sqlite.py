import sqlite3
import structlog
from pathlib import Path
from contextlib import contextmanager

log = structlog.get_logger()

class SQLiteEngine:
    DB_PATH = Path("outputs/nuclear.db")

    @classmethod
    def get_db_path(cls) -> Path:
        return cls.DB_PATH

    @classmethod
    def ensure_db_dir(cls):
        cls.DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    @classmethod
    def connect(cls) -> sqlite3.Connection:
        cls.ensure_db_dir()
        conn = sqlite3.connect(cls.DB_PATH)
        # Enable ROW mode for dictionary-like access if needed, 
        # but mostly we just stick to standard cursor.
        conn.row_factory = sqlite3.Row
        return conn

    @classmethod
    @contextmanager
    def transaction(cls):
        conn = cls.connect()
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
