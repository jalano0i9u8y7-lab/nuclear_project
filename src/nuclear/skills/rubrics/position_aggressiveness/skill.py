
import json
from pathlib import Path
from typing import Dict, Any
from nuclear.skills.contracts import SchemaSkill

class PositionAggressivenessSkill(SchemaSkill):
    """
    M74: Position Aggressiveness Skill.
    Maps strategy posture to position aggressiveness level.
    """
    id = "rubrics.position_aggressiveness"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Determines aggressiveness level.
        """
        sidecars = context.get("sidecars", {})
        
        posture = sidecars.get("strategy_profile", {}).get("posture", "neutral")
        
        # Logic
        if posture == "aggressive":
            level = "high"
        elif posture == "defensive":
            level = "low"
        else:
            level = "medium"

        result = {
            "level": level
        }

        # Injection
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["position_aggressiveness"] = result

        payload = context.get("payload")
        if isinstance(payload, dict):
            payload["_position_aggressiveness"] = result

        return context

    def get_schema(self) -> Dict[str, Any]:
        schema_path = Path(__file__).parent / "schema.json"
        with open(schema_path, "r") as f:
            return json.load(f)
