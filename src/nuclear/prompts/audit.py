
from typing import Dict
from .base import PromptBuilder

class AuditPromptBuilder(PromptBuilder):
    """
    SSOT V12.0: Audit Prompt Builder (§2.6).
    Constructs prompts for W-A (Auditor), Scout, and Deep Auditor.
    """

    @classmethod
    def build_scout_prompt(cls, analyst_output: Dict, phase: str) -> Dict:
        """
        Builds the Scout prompt (§2.6.5).
        Explores "What if the analyst is wrong?"
        """
        system_blocks = [
            cls.role_calibrator("P2-2"), # Scout uses P2-2 reasoning style but adversarial
            "[SCOUT MISSION]",
            "You are the Scout. Your job is NOT to critique, but to find ALTERNATIVE PATHS.",
            "Assume the Analyst's conclusion is plausible but incomplete. Find what they missed.",
            "Output Format (JSON):",
            "{",
            "  'most_probable_alternative': '...',",
            "  'weight_sensitivity': 'Which input variable has the highest leverage?',",
            "  'hidden_signal_candidates': ['Signal 1', 'Signal 2', 'Signal 3'],",
            "  'decisive_tests': ['Test A', 'Test B']",
            "}"
        ]
        
        task_prompt = f"Analyze the following {phase} output. Identify the blind spots."
        
        return cls.build(system_blocks, task_prompt, analyst_output)

    @classmethod
    def build_deep_auditor_prompt(cls, analyst_output: Dict, scout_output: Dict, phase: str) -> Dict:
        """
        Builds the Deep Auditor prompt (§2.6.6).
        Synthesizes Analyst vs Scout into a final judgment.
        """
        system_blocks = [
            cls.role_calibrator("W-A"),
            "[DEEP AUDITOR MISSION]",
            "You are the Supreme Court. Judge the conflict between Analyst Logic and Scout Alternatives.",
            "You must output:",
            "1. Rebuild the Causal Chain: How X leads to Y.",
            "2. Scenario Probability Table (at least 3 scenarios).",
            "3. Action Under Uncertainty: What should we do given the unknowns?",
            "4. What Analyst Missed: Critical gaps.",
            "Output Format (JSON):",
            "{",
            "  'rebuild_causal_chain': '...',",
            "  'scenario_probability_table': [",
            "     {'scenario': 'A', 'prob': '40%', 'outcome': '...'},",
            "     {'scenario': 'B', 'prob': '30%', 'outcome': '...'},",
            "     {'scenario': 'C', 'prob': '30%', 'outcome': '...'}",
            "  ],",
            "  'action_under_uncertainty': '...',",
            "  'what_analyst_missed': '...'",
            "}"
        ]
        
        payload = {
            "analyst_output": analyst_output,
            "scout_output": scout_output
        }
        
        task_prompt = f"Conduct a Deep Audit on the {phase} decision."
        
        return cls.build(system_blocks, task_prompt, payload)
