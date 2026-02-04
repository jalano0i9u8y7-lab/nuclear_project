"""
Skill Loader - 載入與管理 Skills 模組

用法：
    from nuclear.skills import load_skill, load_skills_for_phase, get_schema
    
    # 載入單一 skill
    content = load_skill("constitution/ssot_core", version="v1")
    
    # 載入 Phase 所需的所有 skills
    skills = load_skills_for_phase("D3")
    
    # 取得輸出 schema
    schema = get_schema("d3")
"""

import json
from pathlib import Path
from typing import Optional

# Skills 根目錄
SKILLS_DIR = Path(__file__).parent

# Phase → Skills 硬編碼映射（未來可升級為 config 或 Router）
PHASE_SKILLS: dict[str, list[str]] = {
    # Daily
    "D1": ["constitution/ssot_core", "rubrics/evidence_protocol"],
    "D2": ["constitution/ssot_core", "rubrics/evidence_protocol"],
    "D3": [
        "constitution/ssot_core",
        "constitution/role_calibrator",
        "rubrics/evidence_protocol",
        "rubrics/narrative_link",
        "rubrics/derivative_reading",
    ],
    "D4": [
        "constitution/ssot_core",
        "constitution/dsfp",
        "rubrics/evidence_protocol",
        "rubrics/narrative_link",
        "rubrics/derivative_reading",
    ],
    # Weekly
    "WB1": [
        "constitution/ssot_core",
        "constitution/dsfp",
        "constitution/role_calibrator",
        "rubrics/evidence_protocol",
    ],
    "WB2": [
        "constitution/ssot_core",
        "constitution/role_calibrator",
        "rubrics/risk_overlay",
        "rubrics/evidence_protocol",
    ],
    # P3
    "P3": [
        "constitution/ssot_core",
        "constitution/role_calibrator",
        "rubrics/tech_structure",
        "rubrics/derivative_reading",
        "rubrics/evidence_protocol",
    ],
    # P2.5
    "P2.5": [
        "constitution/ssot_core",
        "constitution/dsfp",
        "rubrics/derivative_reading",
        "rubrics/evidence_protocol",
    ],
}

# Phase → Schema 映射
PHASE_SCHEMA: dict[str, str] = {
    "D3": "d3_output.json",
    "D4": "d4_output.json",
    "WB1": "wb1_output.json",
    "WB2": "wb2_output.json",
    "P3": "p3_output.json",
}


def load_skill(skill_id: str, version: str = "v1") -> str:
    """
    載入單一 skill 內容
    
    Args:
        skill_id: Skill 路徑，例如 "constitution/ssot_core"
        version: 版本號，預設 "v1"
    
    Returns:
        Skill 內容（markdown 字串）
    
    Raises:
        FileNotFoundError: 找不到 skill 檔案
    """
    # 構建檔案路徑
    skill_path = SKILLS_DIR / f"{skill_id}_{version}.md"
    
    if not skill_path.exists():
        raise FileNotFoundError(f"Skill not found: {skill_path}")
    
    return skill_path.read_text(encoding="utf-8")


def load_skills_for_phase(phase: str) -> list[str]:
    """
    載入指定 Phase 所需的所有 skills 內容
    
    Args:
        phase: Phase 名稱，例如 "D3", "WB1", "P3"
    
    Returns:
        Skills 內容列表
    
    Raises:
        ValueError: 未知的 Phase
    """
    phase_upper = phase.upper()
    
    if phase_upper not in PHASE_SKILLS:
        raise ValueError(f"Unknown phase: {phase}. Available: {list(PHASE_SKILLS.keys())}")
    
    skills = []
    for skill_id in PHASE_SKILLS[phase_upper]:
        try:
            content = load_skill(skill_id)
            skills.append(content)
        except FileNotFoundError as e:
            # 記錄警告但不中斷
            print(f"Warning: {e}")
    
    return skills


def get_skill_ids_for_phase(phase: str) -> list[str]:
    """
    取得指定 Phase 所需的 skill IDs（不載入內容）
    
    Args:
        phase: Phase 名稱
    
    Returns:
        Skill ID 列表
    """
    phase_upper = phase.upper()
    return PHASE_SKILLS.get(phase_upper, [])


def get_schema(phase: str) -> Optional[dict]:
    """
    取得指定 Phase 的輸出 JSON Schema
    
    Args:
        phase: Phase 名稱，例如 "D3", "WB1"
    
    Returns:
        JSON Schema dict，或 None 如果無對應 schema
    """
    phase_upper = phase.upper()
    
    if phase_upper not in PHASE_SCHEMA:
        return None
    
    schema_path = SKILLS_DIR / "schemas" / PHASE_SCHEMA[phase_upper]
    
    if not schema_path.exists():
        return None
    
    return json.loads(schema_path.read_text(encoding="utf-8"))


def list_available_skills() -> dict[str, list[str]]:
    """
    列出所有可用的 skills
    
    Returns:
        按類別分組的 skill 列表
    """
    result = {
        "constitution": [],
        "rubrics": [],
        "schemas": [],
    }
    
    for category in result.keys():
        category_dir = SKILLS_DIR / category
        if category_dir.exists():
            if category == "schemas":
                result[category] = [f.stem for f in category_dir.glob("*.json")]
            else:
                result[category] = [f.stem for f in category_dir.glob("*.md")]
    
    return result
