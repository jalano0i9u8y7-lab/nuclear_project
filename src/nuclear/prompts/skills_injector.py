
import os
from pathlib import Path
from typing import List, Dict

class SkillsInjector:
    """
    SSOT V12.0: Skills Injector (§2.9.2).
    Injects modular skills (Markdown instructions) into Prompts based on Phase.
    """

    # Hardcoded Mapping from SSOT §2.9.2
    PHASE_SKILLS_MAP = {
        "P0": ["ssot_core", "role_calibrator", "evidence_protocol"],
        "P0.5": ["ssot_core", "evidence_protocol", "narrative_link"],
        "P0.7": ["ssot_core", "evidence_protocol"],
        "P1-1": ["ssot_core", "role_calibrator"],
        "P1-1.5": ["evidence_protocol"],
        "P1-2": ["ssot_core", "role_calibrator", "evidence_protocol"],
        "P2-1": ["ssot_core", "evidence_protocol"],
        "P2-2": ["ssot_core", "role_calibrator", "evidence_protocol", "mispricing"],
        "P2.5": ["ssot_core", "evidence_protocol", "derivative_reading"],
        "P3": ["ssot_core", "role_calibrator", "tech_structure", "derivative_reading", "evidence_protocol"],
        "P3-Delta": ["ssot_core", "tech_structure"],
        "D-3": ["ssot_core", "role_calibrator", "evidence_protocol", "narrative_link", "derivative_reading"],
        "D-4": ["ssot_core", "dsfp", "evidence_protocol", "narrative_link", "derivative_reading"],
        "WB-1": ["ssot_core", "dsfp", "role_calibrator", "evidence_protocol"],
        "WB-2": ["ssot_core", "role_calibrator", "risk_overlay", "evidence_protocol"],
        "W-A": ["ssot_core", "role_calibrator", "evidence_protocol"],
        "Monthly": ["ssot_core", "evidence_protocol"],
        "Quarterly": ["ssot_core", "evidence_protocol"],
    }

    # Skill ID to Filename Rule (Simplified)
    # Assumes structure: 
    # constitution/ -> ssot_core, dsfp, role_calibrator
    # rubrics/ -> others
    SKILL_LOCATIONS = {
        "ssot_core": "constitution/ssot_core_v1.md",
        "dsfp": "constitution/dsfp_v1.md",
        "role_calibrator": "constitution/role_calibrator_v1.md",
        "narrative_link": "rubrics/narrative_link_v1.md",
        "derivative_reading": "rubrics/derivative_reading_v1.md",
        "tech_structure": "rubrics/tech_structure_v1.md",
        "risk_overlay": "rubrics/risk_overlay_v1.md",
        "mispricing": "rubrics/mispricing_v1.md",
        "evidence_protocol": "rubrics/evidence_protocol_v1.md",
    }
    
    BASE_PATH = Path("src/nuclear/skills")

    @classmethod
    def inject_skills(cls, phase: str) -> str:
        """
        Returns concatenated text of all skills required for the phase.
        """
        required_skills = cls.PHASE_SKILLS_MAP.get(phase, [])
        if not required_skills:
            return ""

        injected_text = ["\n[INJECTED SKILLS MODULES]\n"]
        
        for skill_id in required_skills:
            content = cls._load_skill_text(skill_id)
            injected_text.append(f"--- Module: {skill_id} ---\n{content}\n")
            
        return "\n".join(injected_text)

    @classmethod
    def _load_skill_text(cls, skill_id: str) -> str:
        """
        Load text from .md file.
        """
        rel_path = cls.SKILL_LOCATIONS.get(skill_id)
        if not rel_path:
            return f"[SKILL ERROR: Unknown path for {skill_id}]"
        
        # Construct absolute path assuming execution from project root
        # Or relative to this file? 
        # Using project root "src/nuclear/skills"
        full_path = cls.BASE_PATH / rel_path
        
        # Check existence
        if not full_path.exists():
            # Fallback: Check if we are running in a test or different cwd
            # Try finding src/nuclear
            if Path("nuclear/skills").exists():
                 full_path = Path("nuclear/skills") / rel_path
            elif Path("../src/nuclear/skills").exists(): # relative from tests
                 full_path = Path("../src/nuclear/skills") / rel_path
        
        if full_path.exists():
            try:
                return full_path.read_text(encoding="utf-8")
            except Exception as e:
                return f"[SKILL LOAD ERROR: {str(e)}]"
        else:
            return f"[SKILL MISSING: {skill_id} at {full_path}]"
