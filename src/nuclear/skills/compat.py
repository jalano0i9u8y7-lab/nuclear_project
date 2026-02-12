"""
M55: Skill Compatibility & Drift Detection.
Non-blocking compatibility checks and drift tracking.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import structlog

log = structlog.get_logger()

class CompatibilityReport(BaseModel):
    ok: bool
    phase: str
    required_skill_ids: List[str]
    loaded_skills: List[Dict[str, str]]  # [{id, version, source}]
    missing_required: List[str]
    unknown_loaded: List[str]
    schema_mismatch: List[str]
    warnings: List[str]

def check_compatibility(phase: str) -> CompatibilityReport:
    """
    Check compatibility of loaded skills for a phase.
    Non-blocking: always returns a report, never raises.
    """
    from nuclear.skills.loader import load_registry
    from nuclear.skills.bindings import get_skills_for_phase
    from nuclear.skills.manifest import load_manifest
    
    warnings = []
    missing_required = []
    unknown_loaded = []
    schema_mismatch = []
    
    try:
        reg = load_registry()
        phase_map = reg.get("phase_map", {})
        phase_lower = phase.lower()
        
        required_skill_ids = phase_map.get(phase_lower, [])
        
        # Get loaded skills
        loaded_skills_objs = get_skills_for_phase(phase)
        loaded_skills = []
        manifest = load_manifest()
        
        for skill in loaded_skills_objs:
            source = "manifest_override" if skill.id in manifest else "registry"
            loaded_skills.append({
                "id": skill.id,
                "version": skill.version,
                "source": source
            })
        
        loaded_ids = {s["id"] for s in loaded_skills}
        required_ids = set(required_skill_ids)
        
        # Check missing
        missing_required = list(required_ids - loaded_ids)
        if missing_required:
            warnings.append(f"Missing required skills: {missing_required}")
        
        # Check unknown (manifest pins that don't exist in registry)
        registry_skill_ids = {s["id"] for s in reg.get("skills", [])}
        for skill_id in manifest.keys():
            if skill_id not in registry_skill_ids:
                unknown_loaded.append(skill_id)
                warnings.append(f"Manifest pins unknown skill: {skill_id}")
        
        # Check schema mismatch (simplified: check if phase has schema defined)
        schemas_map = reg.get("schemas", {})
        if phase_lower in schemas_map:
            schema_def = schemas_map[phase_lower]
            if not schema_def.get("path"):
                schema_mismatch.append(f"{phase}: schema path missing")
                warnings.append(f"Schema path missing for {phase}")
        
        ok = len(missing_required) == 0 and len(unknown_loaded) == 0 and len(schema_mismatch) == 0
        
        return CompatibilityReport(
            ok=ok,
            phase=phase,
            required_skill_ids=required_skill_ids,
            loaded_skills=loaded_skills,
            missing_required=missing_required,
            unknown_loaded=unknown_loaded,
            schema_mismatch=schema_mismatch,
            warnings=warnings
        )
    except Exception as e:
        log.error("compat_check_failed", phase=phase, error=str(e))
        return CompatibilityReport(
            ok=False,
            phase=phase,
            required_skill_ids=[],
            loaded_skills=[],
            missing_required=[],
            unknown_loaded=[],
            schema_mismatch=[],
            warnings=[f"Compatibility check failed: {str(e)}"]
        )
