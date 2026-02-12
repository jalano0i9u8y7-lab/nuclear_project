
from typing import Dict
from nuclear.prompts.base import PromptBuilder
from nuclear.prompts.skills_injector import SkillsInjector

def build_p1_step1_prompt(p0_output: Dict, p05_output: Dict, p07_output: Dict) -> Dict:
    """
    SSOT §5.2.2: P1 Step 1 - Company Selection Prompt.
    Core task: "Narrow the World".
    """
    preamble = PromptBuilder.constitutional_preamble()
    
    role = """
[ROLE CALIBRATION]
你是產業結構工程師（承接 P0 / P0.5，而不是股票分析師）。
"""

    task_anchor = """
🎯 P1 Step1 的真正任務（定錨）

不是找所有相關公司，不是擴大題材，
而是回答一句話：

「在 P0 定義的這個『必然結構』裡，哪幾家公司是真正『不能缺席』的？」

你的任務是「縮小世界」，不是擴大世界。

請基於 P0 已定義的關鍵結構、瓶頸、價值捕獲層，思考：
- 如果這家公司不存在，這個產業結構是否會被破壞、延遲或大幅失效？
- 它是否掌握了「不可輕易被繞過」的關鍵節點？
- 它的存在，是否讓其他參與者必須向它妥協（價格、時程、技術或標準）？

納入公司池的正向理由可能包括（但不限於）：
- 物理或工程層面的不可替代性
- 制程、產能、專利、認證或規模所形成的硬門檻
- 定價權或供給控制權
- 高度依存性的產業鏈關係（A 賺錢 → B 幾乎必然跟著賺）

請特別注意：
- 不要因為「題材相關」就納入
- 不要把整個上中下游都抓進來
- 關聯性必須是「結構必然」，不是「敘事合理」

輸出目標：
- 每個產業 30–50 家
- 每家公司都要能清楚回答「為什麼非它不可」
"""

    prohibitions = """
[禁止事項]
嚴格禁止：
❌ 使用財務績效數據（EPS/成長率/毛利率數字）作為納入依據
❌ 使用估值（P/E、FPE、PEG）、技術分析、股價作為證據
✅ 允許使用業務結構佔比（Revenue Exposure / Mix）判斷「純度」
"""

    inheritance = """
[繼承規則]
你必須繼承 P0 + P0.5 + P0.7 的結論，不得自行推翻或另起敘事。
唯一可新增：公司與節點的映射、受益/受害機制、分級理由。
"""

    self_check = """
[結構自檢提示]
在輸出最終公司池前，請你快速自我檢查：
- 是否有公司只是「題材相關」，但不掌握任何結構節點？
- 是否因為市場敘事或知名度，而給了過高的納入權重？
- 是否存在你猶豫但仍納入的公司？請標註為「低信心候選」

請注意：
這不是要求你刪減名單，
而是幫助後續流程理解哪些公司是邊界案例。
"""

    skills = SkillsInjector.inject_skills("P1-1")

    system_prompt = "\n".join([
        preamble, 
        role, 
        task_anchor, 
        prohibitions, 
        inheritance, 
        skills, 
        self_check
    ])

    user_prompt = f"""
請根據以下數據生成 P1 Step 1 公司池：

P0 Output: {p0_output}
P0.5 Output: {p05_output}
P0.7 Output: {p07_output}

請以 JSON 格式輸出公司清單（companies 陣列），包含 ticker, company_name, market, p0_theme_id, p0_subtheme_id, chain_position, inclusion_reason, confidence。
並提供 market_distribution 和 low_confidence_candidates 列表。
"""
    user_prompt += PromptBuilder.future_alignment_check()

    return {
        "system": system_prompt,
        "user": user_prompt
    }
