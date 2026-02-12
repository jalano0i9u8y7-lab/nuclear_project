
import json
from pathlib import Path
from typing import Dict, Any, List
from nuclear.skills.contracts import SchemaSkill

class OrderIntentSkill(SchemaSkill):
    """
    M71: Order Intent Skill.
    Classifies order intents as 'add' or 'reduce' based on order side.
    """
    id = "rubrics.order_intent"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Classifies order intents from payload orders.
        """
        payload = context.get("payload", {})
        
        # Extract orders from payload
        # Expected: payload["orders"] or payload["proposed_orders"]
        orders = payload.get("orders", payload.get("proposed_orders", []))
        
        intent_orders = []
        for order in orders:
            symbol = order.get("symbol", "UNKNOWN")
            side = order.get("side", "").upper()
            
            # Logic
            if side == "BUY":
                intent = "add"
            elif side == "SELL":
                intent = "reduce"
            else:
                intent = "add"  # Default fallback
            
            intent_orders.append({
                "symbol": symbol,
                "intent": intent
            })
        
        result = {
            "orders": intent_orders
        }

        # Injection
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["order_intent"] = result

        if isinstance(payload, dict):
            payload["_order_intent"] = result

        return context

    def get_schema(self) -> Dict[str, Any]:
        schema_path = Path(__file__).parent / "schema.json"
        with open(schema_path, "r") as f:
            return json.load(f)
