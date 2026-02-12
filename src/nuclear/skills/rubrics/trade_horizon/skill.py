
import json
from pathlib import Path
from typing import Dict, Any
from nuclear.skills.contracts import SchemaSkill

class TradeHorizonSkill(SchemaSkill):
    """
    M75: Trade Horizon Skill.
    Maps strategy holding period to trade horizon.
    """
    id = "rubrics.trade_horizon"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Determines trade horizon.
        """
        sidecars = context.get("sidecars", {})
        
        holding_period = sidecars.get("strategy_profile", {}).get("holding_period", "position")
        
        # Logic
        if holding_period == "short":
            horizon = "intraday"
        elif holding_period == "swing":
            horizon = "multi_day"
        else:
            horizon = "multi_week"

        result = {
            "horizon": horizon
        }

        # Injection
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["trade_horizon"] = result

        payload = context.get("payload")
        if isinstance(payload, dict):
            payload["_trade_horizon"] = result

        return context

    def get_schema(self) -> Dict[str, Any]:
        schema_path = Path(__file__).parent / "schema.json"
        with open(schema_path, "r") as f:
            return json.load(f)
