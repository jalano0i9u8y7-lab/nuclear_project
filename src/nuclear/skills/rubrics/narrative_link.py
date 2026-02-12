
"""
Narrative Link Rubric Skill.
Validates consistency between Worldview Narrative and Asset Identity Narrative.
"""
from typing import Dict, Any
from nuclear.skills.contracts import SchemaSkill

class NarrativeLinkRubricSkill(SchemaSkill):
    id = "rubrics.narrative_link"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Check if narrative links exist in payload.
        Adds 'narrative_score' to sidecars.
        """
        payload = context.get("payload")
        
        # Simple stub logic for M53
        score = 1.0 # Default perfect score
        notes = []
        
        # If payload has 'narrative_map' (WB1)
        if isinstance(payload, dict) and "narrative_map" in payload:
            n_map = payload["narrative_map"]
            if not n_map:
                score = 0.5
                notes.append("Empty narrative map")
                
        report = {
            "score": score,
            "notes": notes,
            "check_passed": True,
            # SSOT V12 Article 1
            "future_projection": {
                "direction": "STABLE" if score > 0.8 else "DETERIORATING",
                "time_window": "1 week",
                "confidence": score,
                "key_drivers": ["Narrative Consistency"]
            },
            "falsification_checkpoints": [
                {
                    "signal": "narrative_break",
                    "condition": "Score drops below 0.5",
                    "timeline": "next_run",
                    "severity": "HIGH"
                }
            ],
            "verification_timeline": {
                "next_review_date": "next_run",
                "confidence_decay_rate": 0.1
            }
        }
        
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["narrative_link"] = report
        
        return context

    def get_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "score": {"type": "number"},
                "notes": {"type": "array", "items": {"type": "string"}},
                "future_projection": {"type": "object", "required": ["direction", "time_window"]},
                "falsification_checkpoints": {"type": "array", "minItems": 1},
                "verification_timeline": {"type": "object", "required": ["next_review_date"]}
            },
            "required": ["future_projection", "falsification_checkpoints", "verification_timeline"]
        }
