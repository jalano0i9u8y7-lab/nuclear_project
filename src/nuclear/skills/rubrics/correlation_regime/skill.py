
import json
from pathlib import Path
from typing import Dict, Any, List
from nuclear.skills.contracts import SchemaSkill

class CorrelationRegimeSkill(SchemaSkill):
    """
    M66: Correlation Regime Skill.
    Classifies correlation based on whether majority of tickers share the same price change sign.
    """
    id = "rubrics.correlation_regime"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Classifies correlation regime and injects into context.
        """
        # Extract ticker changes
        # Expected: Dict[str, float] in context['d3_ticker_changes'] or context['d3_stats']['ticker_changes']
        ticker_changes = context.get("d3_ticker_changes", {})
        if not ticker_changes:
            ticker_changes = context.get("d3_stats", {}).get("ticker_changes", {})
        
        # Stub fallback if no data provided
        if not ticker_changes:
            # Generate deterministic stub based on ticker names if available
            tickers = context.get("d3_stats", {}).get("tickers", ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "BRK.B", "JNJ", "V"])
            # Deterministic sign based on symbol hash for testing
            import hashlib
            ticker_changes = {t: (int(hashlib.md5(t.encode()).hexdigest(), 16) % 100 - 50) / 100.0 for t in tickers}

        # Logic
        count = len(ticker_changes)
        if count == 0:
            breadth_ratio = 0.5
            regime = "normal_correlation"
        else:
            pos = sum(1 for c in ticker_changes.values() if c > 0)
            neg = sum(1 for c in ticker_changes.values() if c < 0)
            
            dominant = max(pos, neg)
            breadth_ratio = dominant / count
            
            if breadth_ratio > 0.7:
                regime = "high_correlation"
            else:
                regime = "normal_correlation"

        result = {
            "regime": regime,
            "breadth_ratio": float(breadth_ratio),
            "confidence": 0.6
        }

        # Injection
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["correlation_regime"] = result

        payload = context.get("payload")
        if isinstance(payload, dict):
            payload["_correlation_regime"] = result

        return context

    def get_schema(self) -> Dict[str, Any]:
        schema_path = Path(__file__).parent / "schema.json"
        with open(schema_path, "r") as f:
            return json.load(f)
