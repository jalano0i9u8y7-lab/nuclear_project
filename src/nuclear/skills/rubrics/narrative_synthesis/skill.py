
import json
from pathlib import Path
from typing import Dict, Any, List
from nuclear.skills.contracts import SchemaSkill

class NarrativeSynthesisSkill(SchemaSkill):
    """
    M68: Narrative Synthesis Skill (Stub).
    Combines outputs of multiple regime skills into a simple summary string.
    """
    id = "rubrics.narrative_synthesis"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Synthesizes a narrative from other skill outputs.
        """
        sidecars = context.get("sidecars", {})
        
        # 1. Fetch regimes (with defaults for isolation testing)
        market_regime = sidecars.get("market_regime", {}).get("regime", "unknown")
        vol_regime = sidecars.get("volatility_regime", {}).get("regime", "unknown")
        corr_regime = sidecars.get("correlation_regime", {}).get("regime", "unknown")
        liq_stress = sidecars.get("liquidity_stress", {}).get("stress_level", "unknown")
        
        # 2. Build template
        summary = (
            f"Market is in {market_regime} regime with {vol_regime.replace('_', ' ')} "
            f"and {corr_regime.replace('_', ' ')} under {liq_stress} liquidity stress."
        )

        result = {
            "summary": summary,
            "confidence": 0.5
        }

        # Injection
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["narrative_synthesis"] = result

        payload = context.get("payload")
        if isinstance(payload, dict):
            payload["_narrative_synthesis"] = result

        return context

    def get_schema(self) -> Dict[str, Any]:
        schema_path = Path(__file__).parent / "schema.json"
        with open(schema_path, "r") as f:
            return json.load(f)
