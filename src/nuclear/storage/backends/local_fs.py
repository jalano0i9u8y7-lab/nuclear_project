import json
import os
from pathlib import Path
from typing import Any

class LocalFSBackend:
    """
    Stores snapshots in outputs/snapshots/<phase>/<timestamp>__<id>.json
    """
    ROOT_DIR = Path("outputs/snapshots")

    def write(self, phase: str, snapshot_id: str, payload: Any, created_at: str) -> str:
        # Create phase dir
        phase_dir = self.ROOT_DIR / phase
        phase_dir.mkdir(parents=True, exist_ok=True)

        # Format filename: YYYY-MM-DDTHH-MM-SSZ__<id>.json (safe for windows)
        # created_at is ISO8601 (e.g. 2026-02-04T04:12:33+00:00). We sanitize it.
        safe_time = created_at.replace(":", "-").replace("+", "Z")
        filename = f"{safe_time}__{snapshot_id}.json"
        file_path = phase_dir / filename

        if file_path.exists():
             raise FileExistsError(f"Snapshot collision: {file_path}")

        # Serialize
        # Handle Pydantic models in payload if any (though usually passed as dict/list)
        # Using default=str for safety
        content = json.dumps(payload, indent=2, ensure_ascii=False, default=str)
        
        # Write
        file_path.write_text(content, encoding="utf-8")
        
        return str(file_path)
