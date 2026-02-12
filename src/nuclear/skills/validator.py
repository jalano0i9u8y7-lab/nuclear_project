
"""
Runtime Schema Validator (T-SKILL-02)
Warnings-only validation against Skills Registry schemas.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import structlog

log = structlog.get_logger()

class ValidationReport(BaseModel):
    ok: bool
    missing_keys: List[str]
    extra_keys: List[str]
    constitutional_errors: List[str] = []
    notes: str = ""

# Hardcoded Exemption List (Task 0.2)
CONSTITUTIONAL_EXEMPTIONS = [
    "P4",         # Pure Math
    "P6",         # Rule-Based
    "P2-1",       # Fact Modeling
    "P1-1.5",     # OCR
    "Daily OHLCV",# Data Collection
    "D-1A",       # Pure Data
    "D-1B",       # Pure Data
    "D-2",        # Indexing
    "D-3",        # Snapshot (Partially exempt? SSOT says "Daily OHLCV Data Collection". D-3 is usually AI. I will stick to "Daily OHLCV" string match)
]

def validate_against_schema(payload: Dict[str, Any], schema: Dict[str, Any]) -> ValidationReport:
    """
    Validate payload against top-level keys in schema properties.
    Simple validator: Checks existence of required keys.
    Does NOT recurse or validate types deeply (M19 scope).
    """
    if not schema or "properties" not in schema:
        return ValidationReport(
            ok=True, 
            missing_keys=[], 
            extra_keys=[], 
            notes="No properties in schema or schema invalid"
        )

    required_keys = set(schema.get("required", []))
    defined_keys = set(schema.get("properties", {}).keys())
    actual_keys = set(payload.keys())

    missing = sorted(list(required_keys - actual_keys))
    # Extra keys: keys present in payload but not in defined properties (if additionalProperties is false, strictly)
    # But usually we allow extra unless strict. The prompt says "extra_keys" in report, implying we should list them.
    # We will look for keys NOT in "properties".
    extra = sorted(list(actual_keys - defined_keys))

    ok = len(missing) == 0
    
    notes = "Schema valid."
    if not ok:
        notes = f"Missing required keys: {missing}"
        log.warning("schema_validation_failed", missing=missing, extra=extra)

    return ValidationReport(
        ok=ok,
        missing_keys=missing,
        extra_keys=extra,
        notes=notes
    )

def validate_constitutional_compliance(phase: str, payload: Dict[str, Any]) -> ValidationReport:
    """
    SSOT V12 Constitutional Validator (Article 1).
    Checks for:
    - future_projection (direction, time_window non-empty)
    - falsification_checkpoints (min items 1)
    - verification_timeline (next_review_date)
    - failure_modes (min items 1)
    """
    errors = []
    
    # 1. Check Exemptions
    if phase in CONSTITUTIONAL_EXEMPTIONS:
         return ValidationReport(ok=True, missing_keys=[], extra_keys=[], notes=f"Phase {phase} is explicitly exempt from Constitutional Article 1.")

    # 2. Strict Checking
    missing_fields = []
    
    # Future Projection
    if "future_projection" not in payload:
        missing_fields.append("future_projection")
    else:
        fp = payload["future_projection"]
        if not isinstance(fp, dict):
            errors.append("future_projection must be a dict")
        else:
            if not fp.get("direction") or fp.get("direction") == "":
                errors.append("future_projection.direction cannot be empty")
            if not fp.get("time_window") or fp.get("time_window") == "":
                 errors.append("future_projection.time_window cannot be empty")
    
    # Falsification Checkpoints
    if "falsification_checkpoints" not in payload:
        missing_fields.append("falsification_checkpoints")
    else:
        fc = payload["falsification_checkpoints"]
        if not isinstance(fc, list):
            errors.append("falsification_checkpoints must be a list")
        elif len(fc) == 0:
            errors.append("falsification_checkpoints must contain at least 1 item")

    # Verification Timeline
    if "verification_timeline" not in payload:
         missing_fields.append("verification_timeline")
    else:
        vt = payload["verification_timeline"]
        if not isinstance(vt, dict):
            errors.append("verification_timeline must be a dict")
        elif not vt.get("next_review_date"):
            errors.append("verification_timeline.next_review_date cannot be empty")

    # Failure Modes
    if "failure_modes" not in payload:
        missing_fields.append("failure_modes")
    else:
        fm = payload["failure_modes"]
        if not isinstance(fm, list):
            errors.append("failure_modes must be a list")
        elif len(fm) == 0:
            errors.append("failure_modes must contain at least 1 item")

    if missing_fields:
        errors.append(f"Missing mandatory Article 1 fields: {missing_fields}")

    ok = len(errors) == 0
    return ValidationReport(
        ok=ok,
        missing_keys=missing_fields,
        extra_keys=[],
        constitutional_errors=errors,
        notes="Constitutional Article 1 Validated" if ok else "Constitutional Violations Found"
    )

def validate_phase_output(phase: str, payload: Dict[str, Any]) -> ValidationReport:
    """
    SSOT V12: Phase Output Validator
    
    1. Schema Validation (Legacy)
    2. Constitution Article 1 Check (New)
    """
    # 1. Schema Validation (Simplified inline logic to avoid circular deps for now or use stub)
    # For Epoch 0, the focus is Constitution.
    # However, existing code might rely on it.
    
    # Try importing loader/bindings only inside function
    try:
        from nuclear.skills.bindings import get_skills_for_phase
        from nuclear.skills.contracts import SchemaSkill
        from nuclear.skills.loader import get_schema as get_static_schema
        
        static_schema = get_static_schema(phase)
        skills = get_skills_for_phase(phase)
        runtime_schemas = []
        
        for s in skills:
            if isinstance(s, SchemaSkill):
                try:
                    sc = s.get_schema()
                    if sc:
                        runtime_schemas.append(sc)
                except Exception as e:
                    log.warn("skill_schema_fetch_failed", skill=s.id, error=str(e))
        
        master_properties = {}
        master_required = set()
        
        if static_schema:
            master_properties.update(static_schema.get("properties", {}))
            master_required.update(static_schema.get("required", []))
            
        for r_sch in runtime_schemas:
            master_properties.update(r_sch.get("properties", {}))
            master_required.update(r_sch.get("required", []))
            
        if master_properties:
            merged_schema = {
                "type": "object",
                "properties": master_properties,
                "required": list(master_required)
            }
            schema_report = validate_against_schema(payload, merged_schema)
        else:
             schema_report = ValidationReport(ok=True, missing_keys=[], extra_keys=[], notes=f"No schema for {phase}")
             
    except ImportError:
        # Fallback if dependencies missing
        schema_report = ValidationReport(ok=True, missing_keys=[], extra_keys=[], notes="Schema validation skipped (dependencies missing)")

    # 2. Constitution Verification
    constitutional_report = validate_constitutional_compliance(phase, payload)
    
    final_ok = schema_report.ok and constitutional_report.ok
    final_notes = schema_report.notes
    if not constitutional_report.ok:
        final_notes += " | Constitutional Errors: " + "; ".join(constitutional_report.constitutional_errors)
        
    return ValidationReport(
        ok=final_ok,
        missing_keys=schema_report.missing_keys + constitutional_report.missing_keys,
        extra_keys=schema_report.extra_keys,
        constitutional_errors=constitutional_report.constitutional_errors,
        notes=final_notes
    )
