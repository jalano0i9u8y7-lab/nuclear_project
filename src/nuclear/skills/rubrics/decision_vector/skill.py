
import json
from pathlib import Path
from typing import Dict, Any
from nuclear.skills.contracts import SchemaSkill

class DecisionVectorSkill(SchemaSkill):
    """
    M69: Decision Vector Builder Skill.
    Collects outputs from all regime skills into a unified decision vector.
    """
    id = "rubrics.decision_vector"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Builds decision vector from sidecar outputs.
        """
        sidecars = context.get("sidecars", {})
        
        # Extract regime outputs
        market_regime = sidecars.get("market_regime", {}).get("regime", "unknown")
        volatility_regime = sidecars.get("volatility_regime", {}).get("regime", "unknown")
        correlation_regime = sidecars.get("correlation_regime", {}).get("regime", "unknown")
        liquidity_stress = sidecars.get("liquidity_stress", {}).get("stress_level", "unknown")
        narrative = sidecars.get("narrative_synthesis", {}).get("summary", "No narrative available")
        
        result = {
            "market_regime": market_regime,
            "volatility_regime": volatility_regime,
            "correlation_regime": correlation_regime,
            "liquidity_stress": liquidity_stress,
            "narrative": narrative
        }

        # Injection
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["decision_vector"] = result

        payload = context.get("payload")
        if isinstance(payload, dict):
            payload["_decision_vector"] = result

        return context

    def get_schema(self) -> Dict[str, Any]:
        schema_path = Path(__file__).parent / "schema.json"
        with open(schema_path, "r") as f:
            return json.load(f)
