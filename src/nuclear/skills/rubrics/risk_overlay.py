
"""
Risk Overlay Rubric Skill.
Migrates logic from nuclear.risk.overlay.
"""
from typing import Dict, Any, List
from datetime import datetime, timezone
import structlog
from nuclear.skills.contracts import SchemaSkill

log = structlog.get_logger()

class RiskOverlayRubricSkill(SchemaSkill):
    id = "rubrics.risk_overlay"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute risk overlay from payload (orders).
        Adds 'risk_report' to payload.
        """
        payload = context.get("payload", [])
        
        # WB2 payload is List[OrderPlan] (dicts)
        # D4 might be different, but registry binds this mainly to WB2 and D4.
        # If D4 payload is different, we need to handle it.
        # For now, targeting WB2 orders.
        
        orders = []
        if isinstance(payload, list):
            orders = payload
        else:
            # If payload is a dict, maybe orders are inside?
            # Or this skill is not applicable?
            pass

        if not orders and isinstance(payload, dict):
             # Try to find orders if wrapped
             orders = payload.get("orders", [])

        report = self._compute_risk(orders)
        
        # Inject into payload? 
        # For WB2, payload is a List of orders. We can't easily add a property to the List.
        # We might need to wrap it or add it to a sidecar in context (if context is preserved).
        # But context['payload'] IS what gets returned to the phase.
        # If the phase expects List[Order], we can't change type to Dict.
        # M53 Goal: "Phases call rubric skills".
        # If the skill analyzes the payload and produces a report, where does it go?
        # Option A: Mutate the orders (add risk score to each?)
        # Option B: Return a new payload structure (Dict containing orders + report).
        # But WB2 phase expects List[OrderPlan] for downstream (snapshot).
        # However, looking at WB2 code: `snapshot_payload = {"orders": payload, "_validation": ...}`
        # If we change payload to include risk, WB2 snapshot logic might need update.
        # BUT, the Implementation Plan said:
        # "[MODIFY] wb2.py ... Expect risk data to be present in payload (or sidecar) populated by Skill."
        
        # Let's attach it to `context` under a new key `sidecars`?
        # The `apply` method returns `context`.
        # The phase binding loop: `skill_ctx = skill.apply(skill_ctx)`.
        # So we can add keys to `skill_ctx`!
        # The phase then extracts `payload`. It SHOULD also extract sidecars if needed.
        
        report["future_projection"] = {
            "direction": "RISK_STABLE",
            "time_window": "on_fill",
            "confidence": 1.0,
            "key_drivers": ["Order Execution"]
        }
        report["falsification_checkpoints"] = [
            {
                "signal": "fill_variance",
                "condition": "Execution price deviates > 1%",
                "timeline": "immediate",
                "severity": "LOW"
            }
        ]
        report["verification_timeline"] = {
            "next_review_date": "post_trade",
            "confidence_decay_rate": 0.0
        }

        if "sidecars" not in context:
            context["sidecars"] = {}
            
        context["sidecars"]["risk_report"] = report
        
        return context

    def _compute_risk(self, orders: List[Dict[str, Any]]) -> Dict[str, Any]:
        long_notional = 0.0
        short_notional = 0.0
        symbol_map: Dict[str, float] = {}
        sector_map: Dict[str, float] = {}

        for order in orders:
            # Logic from risk/overlay.py
            if not isinstance(order, dict):
                continue
                
            symbol = order.get("ticker", "UNKNOWN")
            side_raw = order.get("action", "HOLD").upper()
            qty = float(order.get("quantity", 0))
            price = float(order.get("price", 0))
            
            notional = float(order.get("notional", qty * price))
            
            impact = 0.0
            if "BUY" in side_raw or "LONG" in side_raw:
                impact = notional
            elif "SELL" in side_raw or "SHORT" in side_raw:
                impact = -notional
                
            symbol_map[symbol] = symbol_map.get(symbol, 0.0) + impact
            sector = order.get("sector", "UNKNOWN")
            sector_map[sector] = sector_map.get(sector, 0.0) + impact
            
            if impact > 0:
                long_notional += impact
            elif impact < 0:
                short_notional += abs(impact)
                
        sym_exposures = []
        for s, net in symbol_map.items():
            side = "flat"
            if net > 0: side = "long"
            if net < 0: side = "short"
            sym_exposures.append({"symbol": s, "notional": net, "side": side})
            
        sec_exposures = []
        for s, net in sector_map.items():
            sec_exposures.append({"sector": s, "notional": net})
            
        return {
            "total_notional": long_notional + short_notional,
            "long_notional": long_notional,
            "short_notional": short_notional,
            "net_notional": long_notional - short_notional,
            "symbols": sym_exposures,
            "sectors": sec_exposures,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    def get_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "total_notional": {"type": "number"},
                "net_notional": {"type": "number"},
                "symbols": {"type": "array"},
                "sectors": {"type": "array"},
                "future_projection": {"type": "object", "required": ["direction", "time_window"]},
                "falsification_checkpoints": {"type": "array", "minItems": 1},
                "verification_timeline": {"type": "object", "required": ["next_review_date"]}
            },
            "required": ["future_projection", "falsification_checkpoints", "verification_timeline"]
        }
