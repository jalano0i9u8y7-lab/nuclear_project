
import json
from pathlib import Path
from typing import Dict, Any
from nuclear.skills.contracts import SchemaSkill

class LLMNarrativeReviewerSkill(SchemaSkill):
    """
    M72: LLM Narrative Reviewer (Stub).
    Always returns agreement with no concerns.
    """
    id = "rubrics.llm_narrative_reviewer"
    version = "v1"

    def apply(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Stub LLM review - always agrees.
        """
        result = {
            "agreement": True,
            "concerns": [],
            "alt_narrative": ""
        }

        # Injection
        if "sidecars" not in context:
            context["sidecars"] = {}
        context["sidecars"]["llm_narrative_reviewer"] = result

        payload = context.get("payload")
        if isinstance(payload, dict):
            payload["_llm_narrative_reviewer"] = result

        return context

    def get_schema(self) -> Dict[str, Any]:
        schema_path = Path(__file__).parent / "schema.json"
        with open(schema_path, "r") as f:
            return json.load(f)
