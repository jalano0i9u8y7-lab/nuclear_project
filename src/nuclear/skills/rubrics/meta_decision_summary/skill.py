
import json
from pathlib import Path
from typing import Dict, Any
from nuclear.skills.contracts import SchemaSkill

class MetaDecisionSummarySkill(SchemaSkill):
    """
    M76: Meta Decision Summary Skill.
    Synthesizes a summary sentence from meta decision outputs.
    """
    id = "rubrics.meta_decision_summary"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Synthesizes summary.
        """
        sidecars = context.get("sidecars", {})
        
        confidence = sidecars.get("decision_confidence", {}).get("confidence", 0.0)
        posture = sidecars.get("strategy_profile", {}).get("posture", "unknown")
        aggressiveness = sidecars.get("position_aggressiveness", {}).get("level", "unknown")
        horizon = sidecars.get("trade_horizon", {}).get("horizon", "unknown")
        
        summary = f"Confidence {confidence:.1f}, posture {posture}, aggressiveness {aggressiveness}, horizon {horizon}."

        result = {
            "summary": summary
        }

        # Injection
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["meta_decision_summary"] = result

        payload = context.get("payload")
        if isinstance(payload, dict):
            payload["_meta_decision_summary"] = result

        return context

    def get_schema(self) -> Dict[str, Any]:
        schema_path = Path(__file__).parent / "schema.json"
        with open(schema_path, "r") as f:
            return json.load(f)
