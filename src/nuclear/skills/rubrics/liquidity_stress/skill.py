
import json
from pathlib import Path
from typing import Dict, Any, List
from nuclear.skills.contracts import SchemaSkill

class LiquidityStressSkill(SchemaSkill):
    """
    M67: Liquidity Stress Skill.
    Classifies liquidity stress based on VIX levels and D3 volume proxies.
    """
    id = "rubrics.liquidity_stress"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Classifies liquidity stress and injects into context.
        """
        # Extract VIX from d4_history
        d4_history = context.get("d4_history", [])
        if not d4_history:
            d4_history = context.get("input", {}).get("d4_history", [])

        vix_val = 20.0 # Default
        if d4_history:
            latest_d4 = d4_history[0]
            series = latest_d4.get("series", {})
            vix_data = series.get("VIX") or latest_d4.get("macro_prices_stub", {}).get("VIX")
            
            if isinstance(vix_data, dict):
                vix_val = vix_data.get("last_value", 20.0)
            elif isinstance(vix_data, (float, int)):
                vix_val = float(vix_data)

        # Volume (stub=1 if not present)
        d3_stats = context.get("d3_stats", {})
        volume = d3_stats.get("total_volume", 1.0) 

        # Logic
        if vix_val >= 30:
            stress_level = "high"
        elif vix_val >= 22:
            stress_level = "medium"
        else:
            stress_level = "low"

        result = {
            "stress_level": stress_level,
            "vix": float(vix_val),
            "confidence": 0.6
        }

        # Injection
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["liquidity_stress"] = result

        payload = context.get("payload")
        if isinstance(payload, dict):
            payload["_liquidity_stress"] = result

        return context

    def get_schema(self) -> Dict[str, Any]:
        schema_path = Path(__file__).parent / "schema.json"
        with open(schema_path, "r") as f:
            return json.load(f)
