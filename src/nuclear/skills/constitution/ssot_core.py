
"""
SSOT Core Constitution Skill (M51 Example).
Implements the connection to Single Source of Truth for WB-1.
"""
from typing import Dict, Any
from nuclear.skills.contracts import SchemaSkill
import json
from pathlib import Path

class SSOTCoreSkill(SchemaSkill):
    id = "constitution.ssot_core"
    version = "v1"
    
    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply SSOT Core logic.
        For now, this is a pass-through or metadata injector since the actual logic is in `wb1.py`.
        In M51, we just verify it runs.
        """
        # Example: Inject a trace indicating this skill ran
        payload = context.get("payload", {})
        
        # If payload is a list (like in WB2), we don't inject trace into individual items 
        # to avoid violating OrderPlan schema. We only inject if it's a dict.
        if not isinstance(payload, dict):
            return context

        if "meta" not in payload:
            payload["meta"] = {}
            
        if "skills_trace" not in payload["meta"]:
            payload["meta"]["skills_trace"] = []
            
        payload["meta"]["skills_trace"].append(self.id)
        
        context["payload"] = payload
        return context

    def get_schema(self) -> Dict[str, Any]:
        """
        SSOTCoreSkill no longer provides a hardcoded schema to avoid polluting other phases.
        Static schemas are loaded via the registry's 'schemas' map.
        """
        return {}
