# Nuclear Project - Skills Module
"""
Skills are reusable knowledge units extracted from SSOT.
- constitution/: Core principles (always included)
- rubrics/: Method templates (injected per phase)
- schemas/: Output JSON schemas
"""

from .loader import load_skill, load_skills_for_phase, get_schema

__all__ = ["load_skill", "load_skills_for_phase", "get_schema"]
