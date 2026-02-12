# SSOT Reference: §2.9.2
import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Any

# Map Phases to required Skills
PHASE_SKILLS_MAP = {
    "P0":        ["ssot_core", "role_calibrator", "evidence_protocol"],
    "P0.5":      ["ssot_core", "evidence_protocol", "narrative_link"],
    "P0.7":      ["ssot_core", "evidence_protocol"],
    "P1-1":      ["ssot_core", "role_calibrator"],
    "P1-1.5":    ["evidence_protocol"],
    "P1-2":      ["ssot_core", "role_calibrator", "evidence_protocol"],
    "P2-1":      ["ssot_core", "evidence_protocol"],
    "P2-2":      ["ssot_core", "role_calibrator", "evidence_protocol", "mispricing"],
    "P2.5":      ["ssot_core", "evidence_protocol", "derivative_reading"],
    "P3":        ["ssot_core", "role_calibrator", "tech_structure", "derivative_reading", "evidence_protocol"],
    "P3-Delta":  ["ssot_core", "tech_structure"],
    "D-3":       ["ssot_core", "role_calibrator", "evidence_protocol", "narrative_link", "derivative_reading"],
    "D-4":       ["ssot_core", "dsfp", "evidence_protocol", "narrative_link", "derivative_reading"],
    "WB-1":      ["ssot_core", "dsfp", "role_calibrator", "evidence_protocol"],
    "WB-2":      ["ssot_core", "role_calibrator", "risk_overlay", "evidence_protocol"],
    "W-A":       ["ssot_core", "role_calibrator", "evidence_protocol"],
    "Monthly":   ["ssot_core", "evidence_protocol"],
    "Quarterly": ["ssot_core", "evidence_protocol"],
}

# Map Phases to Output JSON Schemas
PHASE_SCHEMA_MAP = {
    "D-3":       "d3_output.json",
    "D-4":       "d4_output.json",
    "WB-1":      "wb1_output.json",
    "WB-2":      "wb2_output.json",
    "P3":        "p3_output.json",
    "P3-Delta":  "p3_delta_output.json",
}

class SkillNotFoundError(Exception):
    pass

class PhaseNotFoundError(Exception):
    pass

class SchemaNotFoundError(Exception):
    pass

class SkillLoader:
    """
    Skills 模組化系統的核心載入器 (§2.9.2).
    """

    def __init__(self, base_path: Optional[str] = None):
        if base_path:
            self.base_path = Path(base_path)
        else:
            # Default to current file's directory
            self.base_path = Path(__file__).parent

    def load_skill(self, skill_id: str, version: str = "v1") -> str:
        """
        Loads a single skill markdown file.
        Automatically checks 'constitution' or 'rubrics' folder.
        """
        filename = f"{skill_id}_{version}.md"
        
        # Determine category
        if skill_id in ["ssot_core", "dsfp", "role_calibrator"]:
            category = "constitution"
        else:
            category = "rubrics"
            
        file_path = self.base_path / category / filename
        
        if not file_path.exists():
            raise SkillNotFoundError(f"Skill file not found: {file_path}")
            
        try:
            return file_path.read_text(encoding="utf-8")
        except Exception as e:
            raise SkillNotFoundError(f"Error reading skill {skill_id}: {e}")

    def load_skills_for_phase(self, phase: str) -> Dict[str, str]:
        """
        Loads all required skills for a given phase as a dictionary.
        """
        if phase not in PHASE_SKILLS_MAP:
            raise PhaseNotFoundError(f"Phase {phase} not defined in PHASE_SKILLS_MAP")
            
        required_skills = PHASE_SKILLS_MAP[phase]
        loaded_content = {}
        
        for skill_id in required_skills:
            loaded_content[skill_id] = self.load_skill(skill_id)
            
        return loaded_content

    def get_schema(self, phase: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves the JSON Schema for a phase's output.
        Returns None if no schema is defined for the phase.
        """
        if phase not in PHASE_SCHEMA_MAP:
            # Check if phase is valid but just has no schema
            if phase in PHASE_SKILLS_MAP:
                return None
            else:
                # Optional: could raise PhaseNotFoundError here too, 
                # but map check implies we only have schemas for subset.
                # If phase is totally unknown, return None is safer or raise?
                # Prompt says: "無 schema 的 Phase → 返回 None"
                return None
                
        schema_filename = PHASE_SCHEMA_MAP[phase]
        schema_path = self.base_path / "schemas" / schema_filename
        
        if not schema_path.exists():
            raise SchemaNotFoundError(f"Schema file not found: {schema_path}")
            
        try:
            with open(schema_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise SchemaNotFoundError(f"Error parsing schema {schema_filename}: {e}")

    def list_available_skills(self) -> List[Dict[str, str]]:
        """
        Lists all available skills found in the directories.
        """
        skills = []
        
        # Constitution
        const_dir = self.base_path / "constitution"
        if const_dir.exists():
            for f in const_dir.glob("*_v1.md"):
                skill_id = f.stem.replace("_v1", "")
                skills.append({
                    "id": skill_id,
                    "version": "v1",
                    "category": "constitution",
                    "file_path": str(f)
                })
                
        # Rubrics
        rubric_dir = self.base_path / "rubrics"
        if rubric_dir.exists():
            for f in rubric_dir.glob("*_v1.md"):
                skill_id = f.stem.replace("_v1", "")
                skills.append({
                    "id": skill_id,
                    "version": "v1",
                    "category": "rubrics",
                    "file_path": str(f)
                })
                
        return skills

    def list_phases(self) -> List[str]:
        """
        Lists all registered phases.
        """
        return list(PHASE_SKILLS_MAP.keys())

    def validate_skill_integrity(self) -> Dict[str, Any]:
        """
        Checks if all mapped skills and schemas actually exist on disk.
        """
        missing_skills = []
        missing_schemas = []
        
        # Check all skills in map
        all_skills = set()
        for skills in PHASE_SKILLS_MAP.values():
            all_skills.update(skills)
            
        for skill_id in all_skills:
            try:
                self.load_skill(skill_id)
            except SkillNotFoundError:
                missing_skills.append(skill_id)
                
        # Check all schemas in map
        for phase, filename in PHASE_SCHEMA_MAP.items():
            schema_path = self.base_path / "schemas" / filename
            if not schema_path.exists():
                missing_schemas.append(f"{phase}:{filename}")
                
        return {
            "missing_skills": missing_skills,
            "missing_schemas": missing_schemas,
            "valid": len(missing_skills) == 0 and len(missing_schemas) == 0
        }
