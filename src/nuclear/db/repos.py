import structlog
from datetime import datetime, timezone
from nuclear.db.sqlite import SQLiteEngine

log = structlog.get_logger()

class RunRepo:
    @staticmethod
    def create_run(run_id: str, trigger: str = "manual", ssot_version: str = "V8.45"):
        now = datetime.now(timezone.utc).isoformat()
        sql = """
        INSERT INTO runs (run_id, created_at, trigger, status, ssot_version)
        VALUES (?, ?, ?, ?, ?)
        """
        with SQLiteEngine.transaction() as conn:
            conn.execute(sql, (run_id, now, trigger, "started", ssot_version))
        log.info("Run created", run_id=run_id)

    @staticmethod
    def mark_completed(run_id: str):
        sql = "UPDATE runs SET status = ? WHERE run_id = ?"
        with SQLiteEngine.transaction() as conn:
            conn.execute(sql, ("completed", run_id))
        log.info("Run completed", run_id=run_id)

    @staticmethod
    def mark_failed(run_id: str):
        sql = "UPDATE runs SET status = ? WHERE run_id = ?"
        with SQLiteEngine.transaction() as conn:
            conn.execute(sql, ("failed", run_id))
        log.error("Run failed", run_id=run_id)

class SnapshotRepo:
    @staticmethod
    def insert_snapshot_index(
        snapshot_id: str,
        run_id: str,
        phase: str,
        created_at: str,
        backend: str,
        payload_ref: str,
        payload_sha256: str
    ):
        sql = """
        INSERT INTO snapshots_index (
            snapshot_id, run_id, phase, created_at, backend, payload_ref, payload_sha256
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        with SQLiteEngine.transaction() as conn:
            conn.execute(sql, (
                snapshot_id, run_id, phase, created_at, backend, payload_ref, payload_sha256
            ))
        log.info("Snapshot indexed", snapshot_id=snapshot_id, run_id=run_id)

class P6Repo:
    @staticmethod
    def upsert_heartbeat(
        instance_id: str,
        started_at: str,
        last_tick_at: str,
        last_ok_at: str,
        last_error_at: str,
        error_count: int,
        last_error_summary: str,
        status: str,
        pid: int,
        updated_at: str
    ):
        sql = """
        INSERT INTO p6_heartbeat (
            instance_id, started_at, last_tick_at, last_ok_at, 
            last_error_at, error_count, last_error_summary, status, pid, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(instance_id) DO UPDATE SET
            last_tick_at=excluded.last_tick_at,
            last_ok_at=excluded.last_ok_at,
            last_error_at=excluded.last_error_at,
            error_count=excluded.error_count,
            last_error_summary=excluded.last_error_summary,
            status=excluded.status,
            pid=excluded.pid,
            updated_at=excluded.updated_at
        """
        with SQLiteEngine.transaction() as conn:
            conn.execute(sql, (
                instance_id, started_at, last_tick_at, last_ok_at,
                last_error_at, error_count, last_error_summary, status, pid, updated_at
            ))
