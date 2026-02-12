
"""
WB1 Core Skill.
Encapsulates SSOT logic for Stability and Rebuild Recommendation.
"""
from typing import Dict, Any
from nuclear.skills.contracts import SchemaSkill

class WB1CoreSkill(SchemaSkill):
    id = "constitution.wb1_core"
    version = "v1"
    
    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Logic:
        1. Parse signals from payload/input.
        2. Compute `framework_stability_score`.
        3. Determine `rebuild_recommendation`.
        """
        payload = context.get("payload", {})
        
        # Parse inputs from payload (populated by phase logic before skill)
        signals = payload.get("identity_shift_signals_summary", {})
        drift = signals.get("identity_drift", False)
        sig_count = signals.get("significant_count", 0)
        top_signals = signals.get("top_signals", [])
        
        # Stability Score Rule
        stability_score = 80
        if drift:
            stability_score = max(30, 80 - 10 * sig_count)
            
        # Rebuild Rule
        rebuild = drift or (sig_count >= 3)
        rebuild_reasons = []
        if rebuild:
            rebuild_reasons = top_signals + ["Identity Drift Detected"]
            # Deduplicate
            rebuild_reasons = list(dict.fromkeys(rebuild_reasons)) 
            
        # Apply output
        payload["framework_stability_score"] = stability_score
        payload["rebuild_recommendation"] = rebuild
        payload["rebuild_reason_top5"] = rebuild_reasons[:5]
        
        # Trace
        if "meta" not in payload:
            payload["meta"] = {}
        trace = payload["meta"].get("skills_trace", [])
        trace.append(self.id)
        payload["meta"]["skills_trace"] = trace
            
        context["payload"] = payload
        return context

    def get_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "framework_stability_score": {"type": "integer", "minimum": 0, "maximum": 100},
                "rebuild_recommendation": {"type": "boolean"},
                "rebuild_reason_top5": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["framework_stability_score", "rebuild_recommendation"]
        }
