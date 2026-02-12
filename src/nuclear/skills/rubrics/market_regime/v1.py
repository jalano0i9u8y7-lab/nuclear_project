
import structlog
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from nuclear.skills.contracts import SchemaSkill

log = structlog.get_logger()

class MarketRegimeResult(BaseModel):
    regime: str  # risk_on, risk_off, volatility_expansion, range_bound, crisis
    confidence: float = Field(ge=0, le=1.0)
    signals: Dict[str, str] = Field(default_factory=dict)
    # Expected signals: spx_trend (up/down/flat), vix_level (low/medium/high), breadth (strong/weak), volatility (expanding/contracting)

class MarketRegimeSkill(SchemaSkill):
    id = "rubrics.market_regime"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Classify market regime based on input data and inject into context.
        """
        # 1. Extract inputs from context
        # We expect context to have 'd4_history' (List[D4Output]) and 'd3_stats' (Dict)
        # If not present, we attempt to load or return default
        
        d4_history = context.get("d4_history", [])
        d3_stats = context.get("d3_stats", {})
        
        if not d4_history:
            # Fallback: maybe they are in 'input'?
            d4_history = context.get("input", {}).get("d4_history", [])
            
        if not d3_stats:
            d3_stats = context.get("input", {}).get("d3_stats", {})

        result = classify_regime(d4_history, d3_stats)
        
        # 2. Inject into sidecars
        if "sidecars" not in context:
            context["sidecars"] = {}
        
        context["sidecars"]["market_regime"] = result.model_dump()
        
        # 3. Inject into payload metadata if it's a dict
        payload = context.get("payload")
        if isinstance(payload, dict):
            payload["_regime"] = result.model_dump()
            
        return context

    def get_schema(self) -> Dict[str, Any]:
        return MarketRegimeResult.model_json_schema()

def classify_regime(d4_history: List[Dict[str, Any]], d3_stats: Dict[str, Any]) -> MarketRegimeResult:
    """
    Deterministic Market Regime Classification.
    
    Heuristics:
    - VIX > 25: risk_off / crisis bias
    - SPX Trend: Relative change over 5 days (as proxy for 20D MA slope if history limited)
    - Breadth: % of tickers with positive signals in D3
    - Volatility Expansion: VIX rate of change vs SPX rate of change
    """
    # Defaults
    regime = "range_bound"
    confidence = 0.5
    signals = {
        "spx_trend": "flat",
        "vix_level": "medium",
        "breadth": "neutral",
        "volatility": "stable"
    }

    if not d4_history:
        return MarketRegimeResult(regime=regime, confidence=confidence, signals=signals)

    # Assume d4_history is List[Dict] sorted by date DESC
    latest_d4 = d4_history[0]
    series = latest_d4.get("series", {})
    
    vix_data = series.get("VIX") or latest_d4.get("macro_prices_stub", {}).get("VIX")
    spx_data = series.get("SPX") or latest_d4.get("macro_prices_stub", {}).get("SPX")
    
    # --- 1. VIX Level ---
    vix_val = 20.0 # Default medium
    if isinstance(vix_data, dict):
        vix_val = vix_data.get("last_value", 20.0)
    elif isinstance(vix_data, (float, int)):
        vix_val = float(vix_data)

    if vix_val > 25:
        signals["vix_level"] = "high"
    elif vix_val < 15:
        signals["vix_level"] = "low"
    else:
        signals["vix_level"] = "medium"

    # --- 2. SPX Trend ---
    spx_trend = "flat"
    if len(d4_history) >= 5:
        # Calculate 5-day change as trend proxy
        h5 = d4_history[min(4, len(d4_history)-1)]
        spx_latest_val = 0.0
        if isinstance(spx_data, dict):
            spx_latest_val = spx_data.get("last_value", 0.0)
        elif isinstance(spx_data, (float, int)):
            spx_latest_val = float(spx_data)
            
        spx_h5_data = h5.get("series", {}).get("SPX") or h5.get("macro_prices_stub", {}).get("SPX")
        spx_h5_val = 0.0
        if isinstance(spx_h5_data, dict):
            spx_h5_val = spx_h5_data.get("last_value", 0.0)
        elif isinstance(spx_h5_data, (float, int)):
            spx_h5_val = float(spx_h5_data)
            
        if spx_h5_val > 0:
            change = (spx_latest_val - spx_h5_val) / spx_h5_val
            if change > 0.01: spx_trend = "up"
            elif change < -0.01: spx_trend = "down"

    signals["spx_trend"] = spx_trend

    # --- 3. Breadth ---
    breadth = "neutral"
    # D3 stats might have 'bullish_pct' or similar
    # If not, we use what's available
    processed = d3_stats.get("processed", 0)
    failed = d3_stats.get("failed", 0)
    # This is a stub breadth logic
    positive_signals = d3_stats.get("positive_signals", 0) 
    if processed > 0:
        ratio = positive_signals / processed
        if ratio > 0.6: breadth = "strong"
        elif ratio < 0.4: breadth = "weak"
    
    signals["breadth"] = breadth

    # --- 4. Volatility Expansion ---
    vol_state = "stable"
    if len(d4_history) >= 2:
        latest_vix = vix_val
        prev_d4 = d4_history[1]
        prev_vix_data = prev_d4.get("series", {}).get("VIX") or prev_d4.get("macro_prices_stub", {}).get("VIX")
        prev_vix = 20.0
        if isinstance(prev_vix_data, dict):
            prev_vix = prev_vix_data.get("last_value", 20.0)
        elif isinstance(prev_vix_data, (float, int)):
            prev_vix = float(prev_vix_data)
        
        if latest_vix > prev_vix * 1.05:
            vol_state = "expanding"
        elif latest_vix < prev_vix * 0.95:
            vol_state = "contracting"
            
    signals["volatility"] = vol_state

    # --- FINAL REGIME CLASSIFICATION ---
    if vix_val > 35 or (vix_val > 25 and spx_trend == "down"):
        regime = "crisis"
        confidence = 0.8 if vix_val > 35 else 0.6
    elif vix_val > 20 and vol_state == "expanding":
        regime = "volatility_expansion"
        confidence = 0.7
    elif spx_trend == "up" and signals["vix_level"] != "high":
        regime = "risk_on"
        confidence = 0.75 if signals["vix_level"] == "low" else 0.6
    elif spx_trend == "down" or signals["vix_level"] == "high":
        regime = "risk_off"
        confidence = 0.7
    else:
        regime = "range_bound"
        confidence = 0.5

    return MarketRegimeResult(regime=regime, confidence=confidence, signals=signals)
