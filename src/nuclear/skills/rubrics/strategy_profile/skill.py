
import json
from pathlib import Path
from typing import Dict, Any
from nuclear.skills.contracts import SchemaSkill

class StrategyProfileSkill(SchemaSkill):
    """
    M70: Strategy Profile Skill.
    Determines trading posture and holding period based on regime analysis.
    """
    id = "rubrics.strategy_profile"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Determines strategy profile from regime inputs.
        """
        sidecars = context.get("sidecars", {})
        
        market_regime = sidecars.get("market_regime", {}).get("regime", "unknown")
        volatility_regime = sidecars.get("volatility_regime", {}).get("regime", "unknown")
        
        # Logic
        if market_regime == "risk_on" and volatility_regime == "normal_volatility":
            posture = "aggressive"
        elif volatility_regime == "crisis_volatility":
            posture = "defensive"
        else:
            posture = "neutral"
        
        # Holding period mapping
        if posture == "aggressive":
            holding_period = "swing"
        elif posture == "defensive":
            holding_period = "short"
        else:
            holding_period = "position"
        
        result = {
            "posture": posture,
            "holding_period": holding_period,
            "confidence": 0.6
        }

        # Injection
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["strategy_profile"] = result

        payload = context.get("payload")
        if isinstance(payload, dict):
            payload["_strategy_profile"] = result

        return context

    def get_schema(self) -> Dict[str, Any]:
        schema_path = Path(__file__).parent / "schema.json"
        with open(schema_path, "r") as f:
            return json.load(f)
