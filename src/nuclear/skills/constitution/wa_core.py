
"""
WA Core Skill.
Encapsulates SSOT logic for Patch Contracts.
"""
from typing import Dict, Any
from nuclear.skills.contracts import SchemaSkill

class WACoreSkill(SchemaSkill):
    id = "constitution.wa_core"
    version = "v1"
    
    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Logic:
        Enforce WA Output contract:
        - wa_confidence default (0.5)
        - wa_mode default ("stub")
        """
        payload = context.get("payload", {})
        
        # Enforce defaults
        if payload.get("wa_confidence") is None:
            payload["wa_confidence"] = 0.5
            
        if not payload.get("wa_mode"):
            payload["wa_mode"] = "stub"
            
        # Helper: Ensure patches exist
        if "worldview_patch" not in payload:
            payload["worldview_patch"] = {}
        if "identity_patch" not in payload:
             payload["identity_patch"] = {}

        # Trace
        # WA output has looser schema? 
        # Actually WAOutput definition does not show specific support for meta?
        # But we injected meta in SSOTCore which ran on WA in integration test?
        # Let's check WAOutput definition in future if needed.
        
        context["payload"] = payload
        return context

    def get_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "wa_confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "wa_mode": {"type": "string"}
            },
            "required": ["wa_confidence", "wa_mode"]
        }
