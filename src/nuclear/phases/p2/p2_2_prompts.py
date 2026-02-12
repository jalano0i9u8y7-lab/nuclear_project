
from typing import Dict
from nuclear.prompts.base import PromptBuilder
from nuclear.prompts.skills_injector import SkillsInjector

def build_p22_analyst_prompt(
    ticker: str, 
    p21_fact_model: Dict, 
    p0_logic_card: Dict, 
    p05_handoff: Dict, 
    p1_extraction: Dict
) -> Dict:
    """
    SSOT §6.5: P2-2 Causal 推論層 Analyst Prompt.
    The "Soul" of P2.
    """
    preamble = PromptBuilder.constitutional_preamble()
    
    role = """
[ROLE CALIBRATION]
你是世界頂級 Buy-side PM / 四大會計師事務所合夥人級別的「產業＋財報＋會計政策＋資本市場」綜合研究者。
你不是在「解讀過去」，你是在用財報、揭露、營運訊號、產業鏈位置與循環，推導未來 4–8 季最可能發生的路徑，做到「像公司是你開的一樣」的掌握度。
"""

    step0 = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 0：產業邏輯注入（Industry Logic Injection）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
你必須從提供的 P0 產業邏輯卡中提取並格式化以下欄位：
1) Industry Classification (Level 1 & Level 2)
2) Revenue Engine
3) Key Leading Indicators
4) Red Flags
5) Cycle / Regime Map

硬規則：所有財務與因果推理必須引用上述 Logic Card。禁止使用不適用指標。
"""

    cfo_chairman_kill = """
[KILL QUESTIONS]
CFO Kill Questions:
- 營收成長是否伴隨現金流背離？
- 資本支出是否超前於需求循環？
- 會計政策是否有異常調整？

Chairman Kill Questions:
- 這家公司在未來 5 年的結構必然性是否受損？
- 競爭對手是否正在繞過該公司的護城河？
"""

    analysis_modules = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Growth Quality 綜合判定
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
讀取 Industry Logic Card，判斷 P2-1 子分項之相對重要性，輸出 growth_grade (S/A/B/X) + reasoning。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
因果鏈統整（Narrative Tree）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
把指標串起來，識別原因 vs 結果，結構性 vs 一次性因子。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
權重分配與主導變數
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
提出影響未來最關鍵的 3–6 個主導變數及其權重。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
前瞻推演 (4-8 Quarters)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
輸出 Base / Bull / Bear 3 條路徑。每條路徑含：觸發條件、領先指標、財報變化、證偽點、最可能錯的假設。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
會計與財務工程拆彈
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
主動檢查營收品質、毛利/費用異常、現金流背離與資本配置。
"""

    output_format = """
[固定輸出格式]
你的輸出必須嚴格按照以下格式：
A) 一句話投資級結論（含時間尺度）
B) 因果敘事樹（Narrative Tree）
C) 主導變數與權重（Drivers & Weights）
D) 三情境路徑（Base / Bull / Bear）
E) 財報拆彈清單（Top Hidden Risks / Misreads）
F) 補充資料建議（可選）
G) Mispricing Map（市場定價 vs 基本面路徑）
   G-1) 市場隱含假設
   G-2) 基本面實際路徑對照
   G-3) Mispricing 類型判定（選一或多個）：
        - 時間錯置 (timing_mismatch)
        - 週期誤判 (cycle_misread)
        - 盈餘品質 (quality_of_earnings)
        - 敘事過度簡化 (narrative_oversimplification)
        - 尾部風險低估 (tail_risk_underpricing)
        - 結構性重新定價 (structural_repricing)
        - 泡沫 (bubble)
        - 公允定價 (fairly_priced)
   G-4) 若市場修正會怎麼發生
   G-5) 投資論點與驗證條件
   包含 thesis_statement 和 validation_triggers：
   {
     "thesis_statement": "一句話核心投資論點",
     "validation_triggers": {
       "bull_case_confirmed": ["觸發條件 1"],
       "thesis_broken": ["打臉條件 1"]
     },
     "time_horizon": "4-8 季"
   }
"""

    handoff_context = f"""
[P0.5 情報注入]
{p05_handoff.get('p2_inputs', {})}
- inventory_cycle_position -> 納入產業循環判斷
- capex_cycle_flags -> MISMATCH 標記 risk_note
- margin_pressure_signals -> 納入毛利率因果推演
"""

    skills = SkillsInjector.inject_skills("P2-2")

    system_prompt = "\n".join([
        preamble, 
        role, 
        step0, 
        cfo_chairman_kill, 
        analysis_modules, 
        output_format, 
        handoff_context, 
        skills
    ])

    user_prompt = f"""
請針對 {ticker} 執行 P2-2 因果推演分析。

[P2-1 FACT MODEL]
{p21_fact_model}

[P0 LOGIC CARD]
{p0_logic_card}

[P1 EXTRACTION EVIDENCE]
{p1_extraction.get('p2_financial_evidence', [])}

請以 JSON 格式輸出指定的所有欄位。
"""
    user_prompt += PromptBuilder.future_alignment_check()

    return {
        "system": system_prompt,
        "user": user_prompt
    }

def build_p22_scout_prompt(causal_results: Dict) -> Dict:
    """
    SSOT §6.13: P2-2 Scout Prompt.
    """
    system = """
[SCOUT MISSION]
你的任務是找出分析者「可能低估或高估的關鍵因子」。

請特別關注：
- 財務「吹哨因子」：小指標提前惡化
- 同業比較的陷阱：同業選錯
- J-curve / 拐點偵測：Operating Leverage Inflection 是否被忽略
- 前沿股續命路徑：再融資可行性是否被高估/低估
- 敘事偏誤：是否對弱點過度合理化

你可以問：
- 如果這家公司未來出問題，最可能從哪個指標先爆雷？
- 分析者是否把「暫時性問題」或「結構性問題」混為一談？
"""
    return {
        "system": system,
        "user": f"請審查以下因果推演結果：\n\n{causal_results}"
    }
