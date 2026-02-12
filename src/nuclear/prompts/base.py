
from typing import List, Dict, Optional

class PromptBuilder:
    """
    SSOT V12.0: Unified Prompt Builder (§1.2, §1.10, §2.5.3).
    Ensures every prompt adheres to the Constitution and Structure.
    """

    @staticmethod
    def constitutional_preamble() -> str:
        """
        Returns the core 6 Articles of the Constitution (Simplified).
        System Prompt Top Layer.
        """
        return """
[SYSTEM CONSTITUTION]
1. Future Verifiability: Every conclusion MUST be falsifiable and pinned to a specific future time window. Vague predictions are banned.
2. Future Priority: The future weighs more than the past. Historical data is context; future projection is the goal.
3. Cognitive Separation: AI handles semantic reasoning; Code handles mathematical calculation. Do not ask AI to calculate.
4. Evidence-Based: Every claim requires specific evidence (traceable ID). If evidence is missing, mark as UNCERTAIN.
5. Consistency: Internal logic must be consistent across time and scenarios. Contradictions must be resolved or flagged.
6. Mission: The primary goal is long-term survival and asymmetric returns. Avoid ruin at all costs.
"""

    @staticmethod
    def role_calibrator(phase: str) -> str:
        """
        Returns Phase-specific Role Calibration text.
        Structure: [ROLE DEFINITION] + [BOUNDARIES]
        """
        # Placeholder for Epoch 0. Real implementation will load from config or switch-case.
        roles = {
            "P0": "You are a Macro-Industrial Strategist. Focus on inevitable industry trends and structural shifts.",
            "WB-1": "You are the Chief Worldview Architect. Synthesize global signals into a coherent narrative. Identify conflicts.",
            "WB-2": "You are the Head of Execution. Translate worldview into precise trading orders. Prioritize risk management.",
            "W-A": "You are the Supreme Court Auditor. Judge logic, consistency, and constitutional compliance. Be ruthless.",
            "P2-2": "You are a Causal Inference Engine. Connect facts to future outcomes via probability pathways.",
            "D-3": "You are a Specificity Specialist. Track individual ticker nuances and narrative integrity.",
        }
        role_text = roles.get(phase, "You are a Quantitative Analyst. Analyze data objectively.")
        return f"\n[ROLE CALIBRATION]\n{role_text}\n"

    @staticmethod
    def future_alignment_check() -> str:
        """
        Returns §1.10 Future Alignment Check text (Verbatim).
        """
        return """
在輸出最終結論前，請執行【未來對齊檢查 (Future Alignment Check)】：

1. Impact Check: 我的分析是否改變了對未來某個事件的機率判斷？（若無，視為無效分析）
2. Time-Horizon Check: 我是在描述過去，還是在推演未來？（過去描述必須連結到未來推演的因果基礎）
3. Role Check: 我是否假設了自己是市場的操作者（主力/Control），而不只是觀察者？
4. Prediction Check: 我的結論是否包含可驗證的預測？預測的時間窗口與驗證條件是否明確？

若任一項為否，請拒絕輸出並重寫。
"""

    @classmethod
    def build(cls, system_blocks: List[str], task_prompt: str, data_payload: Dict) -> Dict:
        """
        Assemble the complete prompt.
        Structure: System (Preamble + Role + Rules) | User (Task + ID) | Suffix (Future Check)
        Presents data as structured context.
        """
        # 1. System Prompt Construction
        system_parts = [cls.constitutional_preamble()]
        
        # Add provided blocks (e.g. role from caller or phase specific rules)
        system_parts.extend(system_blocks)
        
        full_system_prompt = "\n".join(system_parts)

        # 2. User Prompt Construction
        import json
        # Serialize data payload to JSON string for clarity
        data_str = json.dumps(data_payload, indent=2, ensure_ascii=False)
        
        full_user_prompt = f"""
[TASK]
{task_prompt}

[DATA CONTEXT]
{data_str}
"""
        # 3. Suffix (Choice to append to User or System? Usually User for recency effect)
        # SSOT calls it "Suffix". Appending to User prompt ensures it's the last thing seen.
        full_user_prompt += cls.future_alignment_check()

        return {
            "system": full_system_prompt,
            "user": full_user_prompt
        }
