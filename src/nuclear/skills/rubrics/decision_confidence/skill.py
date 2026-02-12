
import json
from pathlib import Path
from typing import Dict, Any
from nuclear.skills.contracts import SchemaSkill

class DecisionConfidenceSkill(SchemaSkill):
    """
    M73: Decision Confidence Skill.
    Calculates a confidence score based on market regime inputs.
    """
    id = "rubrics.decision_confidence"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates confidence score.
        """
        sidecars = context.get("sidecars", {})
        
        # Extract inputs from previous skills (or Stub for testing)
        vol_regime = sidecars.get("volatility_regime", {}).get("regime", "unknown")
        corr_regime = sidecars.get("correlation_regime", {}).get("regime", "unknown")
        liq_stress = sidecars.get("liquidity_stress", {}).get("stress_level", "unknown")

        # Base confidence
        confidence = 0.5
        
        # Adjustments
        if vol_regime == "normal_volatility":
            confidence += 0.1
        
        if corr_regime == "normal_correlation":
            confidence += 0.1
            
        if liq_stress == "low":
            confidence += 0.1
            
        if vol_regime == "crisis_volatility":
            confidence -= 0.2
            
        # Clamp
        confidence = max(0.0, min(1.0, confidence))

        result = {
            "confidence": float(confidence)
        }

        # Injection
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["decision_confidence"] = result

        payload = context.get("payload")
        if isinstance(payload, dict):
            payload["_decision_confidence"] = result

        return context

    def get_schema(self) -> Dict[str, Any]:
        schema_path = Path(__file__).parent / "schema.json"
        with open(schema_path, "r") as f:
            return json.load(f)
