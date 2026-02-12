
"""
WB2 Core Skill.
Encapsulates SSOT logic for Order Validation.
"""
from typing import Dict, Any, List
from nuclear.skills.contracts import SchemaSkill

class WB2CoreSkill(SchemaSkill):
    id = "constitution.wb2_core"
    version = "v1"
    
    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Logic:
        1. Iterate over orders in payload (List[Dict]).
        2. Enforce SSOT V8.42: each order must have `worldview_version` and `identity_context`.
        """
        payload = context.get("payload", [])
        
        if not isinstance(payload, list):
             # WB2 might pass dict if it was wrapped?
             # But phase code returns list of models, converted to list of dicts.
             # If wrapped in snapshot dict, we need to extract orders.
             # The binding injection in WB2.py passes `payload` which is List[Dict] (from `out.model_dump() list`).
             # Wait, WB2 output is List[OrderPlan]. `payload` var in WB2.py is List[Dict].
             # Skill receives {payload: List[Dict]}.
             pass

        new_payload = []
        for i, order in enumerate(payload):
            if not isinstance(order, dict):
                continue
                
            wv = order.get("worldview_version")
            idc = order.get("identity_context")
            
            if not wv or not idc:
                raise ValueError(
                    f"SSOT V8.42 Violation (Order {i}): "
                    "Each order must have worldview_version and identity_context."
                )
            
            # Trace in individual order? or separate meta?
            # Order schema is strict. We probably can't easily inject meta into order unless schema allows extra.
            # We'll skip trace injection on order object itself for now to avoid validation errors,
            # unless we know OrderPlan supports extra fields.
            
            new_payload.append(order)
            
        context["payload"] = new_payload
        return context

    def get_schema(self) -> Dict[str, Any]:
        # Schema for atomic order item? Or for the whole list?
        # Validator expects item schema usually.
        return {
            "type": "object",
            "properties": {
                "worldview_version": {"type": "string", "minLength": 1},
                "identity_context": {"type": "object"}
            },
            "required": ["worldview_version", "identity_context"]
        }
