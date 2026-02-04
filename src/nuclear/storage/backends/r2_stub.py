from typing import Any

class R2StubBackend:
    """
    Stub for R2 storage. No real network calls allowed in M01.
    """
    def write(self, phase: str, snapshot_id: str, payload: Any, created_at: str) -> str:
        raise NotImplementedError("R2 backend is not yet implemented (Stub Only)")
