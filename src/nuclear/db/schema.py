import structlog
from nuclear.db.sqlite import SQLiteEngine

log = structlog.get_logger()

def create_tables():
    """Create M02 tables if they don't exist."""
    
    schema_runs = """
    CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        trigger TEXT,
        status TEXT,
        ssot_version TEXT
    );
    """
    
    schema_snapshots = """
    CREATE TABLE IF NOT EXISTS snapshots_index (
        snapshot_id TEXT PRIMARY KEY,
        run_id TEXT,
        phase TEXT,
        created_at TEXT,
        backend TEXT,
        payload_ref TEXT,
        payload_sha256 TEXT,
        FOREIGN KEY(run_id) REFERENCES runs(run_id)
    );
    """
    
    index_snapshots_run = "CREATE INDEX IF NOT EXISTS idx_snapshots_run_id ON snapshots_index (run_id);"
    index_snapshots_phase = "CREATE INDEX IF NOT EXISTS idx_snapshots_phase_created_at ON snapshots_index (phase, created_at);"

    with SQLiteEngine.transaction() as conn:
        cursor = conn.cursor()
        cursor.execute(schema_runs)
        cursor.execute(schema_snapshots)
        cursor.execute(index_snapshots_run)
        cursor.execute(index_snapshots_phase)

    # --- M04-A Learning State Tables ---
    schema_learning_latest = """
    CREATE TABLE IF NOT EXISTS learning_state_latest (
        version INTEGER PRIMARY KEY,
        generated_at TEXT,
        context_signature_summary TEXT,
        policy_hard_caps_json TEXT,
        policy_soft_bias_json TEXT,
        policy_banned_patterns_json TEXT,
        fail_signatures_topK_json TEXT,
        data_gap_watchlist_json TEXT,
        evidence_index_json TEXT,
        ttl_days INTEGER,
        half_life_days INTEGER
    );
    """

    schema_learning_log = """
    CREATE TABLE IF NOT EXISTS learning_state_log (
        log_id TEXT PRIMARY KEY,
        version INTEGER,
        generated_at TEXT,
        payload_json TEXT,
        payload_sha256 TEXT,
        created_at TEXT
    );
    """

    schema_candidates_log = """
    CREATE TABLE IF NOT EXISTS learning_candidates_log (
        candidate_id TEXT PRIMARY KEY,
        category TEXT,
        level TEXT,
        proposal TEXT,
        payload_json TEXT,
        payload_sha256 TEXT,
        created_at TEXT
    );
    """

    schema_shadow_reports = """
    CREATE TABLE IF NOT EXISTS shadow_enforcement_reports (
        report_id TEXT PRIMARY KEY,
        run_id TEXT,
        learning_version INTEGER,
        payload_json TEXT,
        payload_sha256 TEXT,
        created_at TEXT
    );
    """

    schema_p6_heartbeat = """
    CREATE TABLE IF NOT EXISTS p6_heartbeat (
        instance_id TEXT PRIMARY KEY,
        started_at TEXT,
        last_tick_at TEXT,
        last_ok_at TEXT,
        last_error_at TEXT,
        error_count INTEGER,
        last_error_summary TEXT,
        status TEXT,
        pid INTEGER,
        updated_at TEXT
    );
    """
    
    with SQLiteEngine.transaction() as conn:
        cursor = conn.cursor()
        cursor.execute(schema_learning_latest)
        cursor.execute(schema_learning_log)
        cursor.execute(schema_candidates_log)
        cursor.execute(schema_shadow_reports)
        cursor.execute(schema_p6_heartbeat)
    
    log.info("M04/M06 Learning & Shadow Tables checked/created")
