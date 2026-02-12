
import json
from pathlib import Path
from typing import Dict, Any, List
from nuclear.skills.contracts import SchemaSkill

class VolatilityRegimeSkill(SchemaSkill):
    """
    M65: Volatility Regime Skill.
    Classifies volatility based on VIX levels.
    """
    id = "rubrics.volatility_regime"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Classifies volatility regime and injects into context.
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

        # Logic
        if vix_val >= 30:
            regime = "crisis_volatility"
        elif vix_val >= 20:
            regime = "high_volatility"
        else:
            regime = "normal_volatility"

        # SSOT V12: Constitution Article 1 Logic
        future_projection = self._build_future_projection(regime, vix_val)
        falsification_checkpoints = self._build_falsification_checkpoints(regime, vix_val)
        verification_timeline = self._build_verification_timeline(regime)

        result = {
            "regime": regime,
            "vix": float(vix_val),
            "confidence": 0.6,
            "future_projection": future_projection,
            "falsification_checkpoints": falsification_checkpoints,
            "verification_timeline": verification_timeline,
            "failure_modes": ["VIX measurement error", "Unexpected macro shock"]
        }

        # Injection
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["volatility_regime"] = result

        payload = context.get("payload")
        if isinstance(payload, dict):
            payload["_volatility_regime"] = result

        return context

    def _build_future_projection(self, regime: str, vix_val: float) -> Dict[str, Any]:
        from datetime import datetime
        if regime == "normal_volatility":
            return {
                "direction": "STABLE",
                "time_window": "1 week",
                "confidence": 0.7,
                "key_drivers": ["Market Stability"],
                "alternative_scenarios": ["Spike to High Volatility"]
            }
        elif regime == "high_volatility":
            return {
                "direction": "VOLATILITY_DECLINING" if vix_val < 25 else "STABLE",
                "time_window": "3-5 days",
                "confidence": 0.5,
                "key_drivers": ["Fear Premium"],
                "alternative_scenarios": ["Escalation to Crisis"]
            }
        else: # Crisis
             return {
                "direction": "EXTREME_VOLATILITY",
                "time_window": "immediate",
                "confidence": 0.8,
                "key_drivers": ["Panic"],
                "alternative_scenarios": ["V-Shape Recovery"]
            }

    def _build_falsification_checkpoints(self, regime: str, vix_val: float) -> List[Dict[str, Any]]:
        checks = []
        if regime == "normal_volatility":
             checks.append({
                 "signal": "vix_spike",
                 "condition": f"VIX > {vix_val * 1.5}",
                 "timeline": "within 48 hours",
                 "severity": "HIGH"
             })
        elif regime == "high_volatility":
             checks.append({
                 "signal": "vix_mellow",
                 "condition": "VIX < 18",
                 "timeline": "within 3 days",
                 "severity": "MEDIUM"
             })
        else:
             checks.append({
                 "signal": "vix_collapse",
                 "condition": "VIX < 25",
                 "timeline": "within 24 hours",
                 "severity": "HIGH"
             })
        return checks

    def _build_verification_timeline(self, regime: str) -> Dict[str, Any]:
        from datetime import datetime, timedelta
        days = 5
        if regime == "crisis_volatility":
            days = 1
        elif regime == "high_volatility":
            days = 3
            
        next_review = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")
        return {
            "next_review_date": next_review,
            "confidence_decay_rate": 0.1 if regime == "normal_volatility" else 0.3,
            "recheck_triggers": ["Major News"]
        }

    def get_schema(self) -> Dict[str, Any]:
        schema_path = Path(__file__).parent / "schema.json"
        with open(schema_path, "r") as f:
            return json.load(f)

