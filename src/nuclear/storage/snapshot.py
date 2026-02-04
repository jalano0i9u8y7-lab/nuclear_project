import structlog
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

"""
M01 Cold Storage Layer.
Semantic Mapping: Infra support for Snapshot Persistence vs Hot DB Index (M02).
Stores immutable payloads for D-1..D-4 and WB-1..WB-2 outputs.
"""

# Lazy import to avoid circular dependency issues if backends need config
# For M01 we will import backends inside save or dynamically, but direct import is fine for now
from nuclear.storage.backends.local_fs import LocalFSBackend
from nuclear.storage.backends.r2_stub import R2StubBackend

log = structlog.get_logger()

class SnapshotMetadata(BaseModel):
    snapshot_id: str
    phase: str
    run_id: str
    created_at: str
    backend: str
    payload_ref: str

class SnapshotWriter:
    """
    Persists outputs to cold storage (LocalFS or R2).
    Append-only. No logic mutation.
    """
    
    def __init__(self, backend_type: str = "local_fs"):
        self.backend_type = backend_type
        if backend_type == "local_fs":
            self.backend = LocalFSBackend()
        elif backend_type == "r2":
            self.backend = R2StubBackend()
        else:
            raise ValueError(f"Unknown backend type: {backend_type}")

    def save(self, phase: str, payload: Any, run_id: str = "default_run") -> SnapshotMetadata:
        """
        Save payload to storage, return metadata.
        """
        snapshot_id = self._generate_snapshot_id()
        created_at = datetime.now(timezone.utc).isoformat()
        
        # 1. Save payload via backend
        payload_ref = self.backend.write(
            phase=phase,
            snapshot_id=snapshot_id,
            payload=payload,
            created_at=created_at
        )

        # 2. Compute SHA256 (for immutability check)
        import hashlib
        import json
        # Re-serialize deterministically to compute hash, or use what was written if backend returned bytes.
        # But backend.write just returns path.
        # We ensure consistency by serializing same way.
        json_bytes = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
        payload_sha256 = hashlib.sha256(json_bytes).hexdigest()

        # 3. Write Index Limit
        from nuclear.db.repos import SnapshotRepo
        from nuclear.db.schema import create_tables
        
        # Ensure tables exist (lazy init)
        create_tables()

        SnapshotRepo.insert_snapshot_index(
            snapshot_id=snapshot_id,
            run_id=run_id,
            phase=phase,
            created_at=created_at,
            backend=self.backend_type,
            payload_ref=payload_ref,
            payload_sha256=payload_sha256
        )

        # 4. Construct metadata
        meta = SnapshotMetadata(
            snapshot_id=snapshot_id,
            phase=phase,
            run_id=run_id,
            created_at=created_at,
            backend=self.backend_type,
            payload_ref=payload_ref
        )
        
        log.info("Snapshot saved & indexed", snapshot_id=snapshot_id, phase=phase, ref=payload_ref)
        return meta

    def _generate_snapshot_id(self) -> str:
        return str(uuid.uuid4())
