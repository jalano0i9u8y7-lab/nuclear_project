"""
Tests for Skills Loader

執行：pytest tests/test_skills_loader.py -v
"""

import pytest
import json
from pathlib import Path

from nuclear.skills import load_skill, load_skills_for_phase, get_schema
from nuclear.skills.loader import list_available_skills, get_skill_ids_for_phase, PHASE_SKILLS, PHASE_SCHEMA


class TestSkillLoader:
    """測試 Skill 載入功能"""

    def test_load_single_skill(self):
        """驗證單一 skill 可載入"""
        content = load_skill("constitution/ssot_core", version="v1")
        assert content is not None
        assert len(content) > 0
        assert "憲法" in content or "核心原則" in content

    def test_load_dsfp_skill(self):
        """驗證 DSFP skill 可載入"""
        content = load_skill("constitution/dsfp", version="v1")
        assert "DSFP" in content or "五模組" in content or "Asset Identity" in content

    def test_load_missing_skill_raises(self):
        """驗證載入不存在的 skill 會 raise FileNotFoundError"""
        with pytest.raises(FileNotFoundError):
            load_skill("nonexistent/skill", version="v1")

    def test_load_skills_for_phase_d3(self):
        """驗證 D3 phase 的 skills 可載入"""
        skills = load_skills_for_phase("D3")
        assert len(skills) > 0
        # D3 應該包含 ssot_core 和 evidence_protocol
        combined = "\n".join(skills)
        assert "憲法" in combined or "核心原則" in combined

    def test_load_skills_for_phase_wb1(self):
        """驗證 WB1 phase 的 skills 可載入"""
        skills = load_skills_for_phase("WB1")
        assert len(skills) > 0
        # WB1 應該包含 DSFP
        combined = "\n".join(skills)
        assert "DSFP" in combined or "Asset Identity" in combined

    def test_load_skills_for_unknown_phase_raises(self):
        """驗證未知 phase 會 raise ValueError"""
        with pytest.raises(ValueError, match="Unknown phase"):
            load_skills_for_phase("UNKNOWN_PHASE")

    def test_get_skill_ids_for_phase(self):
        """驗證取得 phase 的 skill IDs"""
        ids = get_skill_ids_for_phase("P3")
        assert "constitution/ssot_core" in ids
        assert "rubrics/tech_structure" in ids

    def test_phase_skills_mapping_complete(self):
        """驗證 PHASE_SKILLS 映射有內容"""
        assert len(PHASE_SKILLS) > 0
        assert "D3" in PHASE_SKILLS
        assert "WB1" in PHASE_SKILLS
        assert "P3" in PHASE_SKILLS


class TestSchemaLoader:
    """測試 Schema 載入功能"""

    def test_get_d3_schema(self):
        """驗證 D3 schema 可載入"""
        schema = get_schema("D3")
        assert schema is not None
        assert schema.get("title") == "D3_Output"
        assert "ticker" in schema.get("required", [])

    def test_get_d4_schema(self):
        """驗證 D4 schema 可載入"""
        schema = get_schema("D4")
        assert schema is not None
        assert schema.get("title") == "D4_Output"
        assert "macro_snapshot" in schema.get("required", [])

    def test_get_wb1_schema(self):
        """驗證 WB1 schema 可載入"""
        schema = get_schema("WB1")
        assert schema is not None
        assert schema.get("title") == "WB1_Output"
        assert "worldview_version" in schema.get("required", [])

    def test_get_wb2_schema(self):
        """驗證 WB2 schema 可載入並含必要欄位"""
        schema = get_schema("WB2")
        assert schema is not None
        assert "worldview_version" in schema.get("required", [])
        # 驗證 orders 中每個 order 須含 identity_context
        orders_items = schema.get("properties", {}).get("orders", {}).get("items", {})
        assert "identity_context" in orders_items.get("required", [])

    def test_get_p3_schema(self):
        """驗證 P3 schema 可載入"""
        schema = get_schema("P3")
        assert schema is not None
        assert schema.get("title") == "P3_Output"
        assert "weekly_structure" in schema.get("required", [])

    def test_get_unknown_schema_returns_none(self):
        """驗證未知 phase 的 schema 返回 None"""
        schema = get_schema("UNKNOWN")
        assert schema is None

    def test_schema_files_valid_json(self):
        """驗證所有 schema 檔案是有效 JSON"""
        from nuclear.skills.loader import SKILLS_DIR
        schemas_dir = SKILLS_DIR / "schemas"
        for schema_file in schemas_dir.glob("*.json"):
            content = schema_file.read_text(encoding="utf-8")
            parsed = json.loads(content)  # 應該不會 raise
            assert "$schema" in parsed


class TestListSkills:
    """測試 list_available_skills 功能"""

    def test_list_available_skills(self):
        """驗證 list_available_skills 返回正確結構"""
        skills = list_available_skills()
        assert "constitution" in skills
        assert "rubrics" in skills
        assert "schemas" in skills

    def test_constitution_skills_exist(self):
        """驗證 constitution skills 存在"""
        skills = list_available_skills()
        constitution = skills.get("constitution", [])
        assert len(constitution) >= 3  # ssot_core, dsfp, role_calibrator

    def test_rubrics_skills_exist(self):
        """驗證 rubrics skills 存在"""
        skills = list_available_skills()
        rubrics = skills.get("rubrics", [])
        assert len(rubrics) >= 5  # narrative_link, derivative_reading, tech_structure, risk_overlay, evidence_protocol

    def test_schemas_exist(self):
        """驗證 schemas 存在"""
        skills = list_available_skills()
        schemas = skills.get("schemas", [])
        assert len(schemas) >= 5  # d3, d4, wb1, wb2, p3
