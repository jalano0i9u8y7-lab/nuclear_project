
"""
Skill Version Manifest.
Manages explicit version pinning for skills (M54).
"""
import json
from pathlib import Path
from typing import Dict, Optional

# Roots
SKILLS_DIR = Path(__file__).parent
MANIFEST_PATH = SKILLS_DIR / "manifest.json"

def load_manifest() -> Dict[str, str]:
    """
    Load the skill manifest.
    Returns dict of {skill_id: version}.
    """
    if not MANIFEST_PATH.exists():
        return {}
        
    try:
        data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        return data.get("skills", {})
    except Exception:
        # If corrupt, return empty
        return {}

def save_manifest(skills: Dict[str, str]) -> None:
    """Save the manifest."""
    data = {"skills": skills}
    MANIFEST_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")

def pin_skill(skill_id: str, version: str) -> None:
    """Pin a skill to a specific version."""
    current = load_manifest()
    current[skill_id] = version
    save_manifest(current)

def reset_manifest() -> None:
    """Clear all pins (revert to registry defaults)."""
    if MANIFEST_PATH.exists():
        MANIFEST_PATH.unlink()

def get_pinned_version(skill_id: str) -> Optional[str]:
    """Get pinned version for a skill, or None."""
    manifest = load_manifest()
    return manifest.get(skill_id)
