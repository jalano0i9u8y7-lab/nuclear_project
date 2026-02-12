
from typing import Dict
from nuclear.prompts.base import PromptBuilder
from nuclear.prompts.skills_injector import SkillsInjector

def build_p05_mode1_prompt(p0_output: Dict) -> Dict:
    """
    SSOT §4.2.1: Mode 1 - Baseline Builder.
    Role: Chain Structure Translator.
    """
    preamble = PromptBuilder.constitutional_preamble()
    
    role = """
[ROLE CALIBRATION]
你是產業鏈結構分析師。你的任務是將 P0 產出的抽象產業必然性，翻譯為現實世界的產業鏈節點地圖。你不預測、不判斷轉折（那是 P0.7 的工作）、不做投資結論。你只畫地圖。
"""

    skills = SkillsInjector.inject_skills("P0.5")
    
    analysis_focus = """
[ANALYSIS FOCUS: MODE 1]
你必須輸出 industry_chain_map_json：
- 產業鏈地圖（上/中/下游）
- 關鍵製程/模組識別
- Bottleneck 識別
- 定價權分析
- 單點失效節點識別
無監控、無異常、無判斷轉折。
"""

    system_prompt = "\n".join([preamble, role, skills, analysis_focus])
    
    user_prompt = f"""
請根據以下 P0 產出構建產業鏈地圖：

{p0_output}

請以 JSON 格式輸出。
"""
    user_prompt += PromptBuilder.future_alignment_check()
    
    return {"system": system_prompt, "user": user_prompt}

def build_p05_mode2_prompt(p0_output: Dict, p1_company_pool: Dict, p2_financial_data: Dict) -> Dict:
    """
    SSOT §4.2.1: Mode 2 - Chain Dynamics Monitor.
    Four-stage reasoning flow.
    """
    preamble = PromptBuilder.constitutional_preamble()
    
    role = """
[ROLE CALIBRATION]
你是產業鏈動態監控專家。你的任務是比對 P0 的必然性與 P1/P2 的現實觀測，識別產業鏈中的異常與轉折。
"""

    skills = SkillsInjector.inject_skills("P0.5")
    
    reasoning_flow = """
[FOUR-STAGE REASONING FLOW]
你必須按照以下四個步驟逐一執行，不得跳步：

Step 1 產業生態識別（Mandatory）：
識別核心驅動、時間延遲、最早反映段

Step 2 上中下游行為抽象：
使用程式提供的標準化數據（不判斷、不貼標籤）

Step 3 一致性與異常推演：
自行建模，判斷上中下游行為是否一致

Step 4 Handoff 填充：
基於 Step 1-3 的分析結果，填充以下下游接口：
- p1_inputs：chain_position_updates, bottleneck_status, new_beneficiary_candidates, new_victim_candidates
- p2_inputs：revenue_trend_signals, margin_pressure_signals, capex_cycle_flags, inventory_cycle_position
"""

    boundary = """
[職權邊界（嚴格遵守）]
✅ 只畫地圖（Mode 1）、只做偵測與推演（Mode 2）
❌ 不下投資結論
❌ 不做時間定位裁決（Early/Mid/Late 是 P0.7 的職責）
❌ 不進行長期前瞻敘事（P0 的職責）
"""

    bottleneck_scan = """
[瓶頸轉移觀測 (Bottleneck Migration Scan)]
- 檢查哪些關鍵節點的產能/良率/交期/資本支出正在改善
- 推演下一個限制環節
- 原則：觀測任務，非預測任務；禁止引用股價、新聞熱度或市場情緒

[替代瓶頸探測]
- 分析產業鏈瓶頸時，主動尋找替代方案候選
- 輸出 alternative_candidates（含成熟度和時間窗口）
- NEAR_READY 的替代方案直接進 P1 Tier B 評估
- 掃描範圍不限美國，特別關注日本、歐洲、台灣、韓國
"""

    system_prompt = "\n".join([preamble, role, skills, reasoning_flow, boundary, bottleneck_scan])
    
    user_prompt = f"""
請分析以下數據並執行 Mode 2 監控：

P0 Output: {p0_output}
P1 Pool: {p1_company_pool}
P2 Data: {p2_financial_data}

請以 JSON 格式輸出 8 大核心訊號、Diagnosis、Handoff 及 Bottleneck 資訊。 
"""
    user_prompt += PromptBuilder.future_alignment_check()
    
    return {"system": system_prompt, "user": user_prompt}
