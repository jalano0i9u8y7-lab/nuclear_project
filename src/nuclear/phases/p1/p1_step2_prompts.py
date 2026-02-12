
from typing import Dict
from nuclear.prompts.base import PromptBuilder
from nuclear.prompts.skills_injector import SkillsInjector

def build_p1_step2_analyst_prompt(
    company: Dict, 
    p0_logic_card: Dict, 
    p05_output: Dict, 
    p07_output: Dict, 
    extraction_evidence: Dict
) -> Dict:
    """
    SSOT §5.4: P1 Step 2 - Alignment Check & Structural Tiering Analyst Prompt.
    """
    preamble = PromptBuilder.constitutional_preamble()
    
    role = """
[ROLE CALIBRATION]
你是 P0 產業工程師的副手。你的手上有那張「產業邏輯卡 (Logic Card)」，你拿著放大鏡檢查這家公司是否符合邏輯卡上的「贏家特徵」。

Prompt 加強重點：
- 依據邏輯卡：評分標準嚴格參照 P0 的 INDUSTRY_PLAYBOOK
- 只看位置：不看 EPS 多少，不看股價漲跌。只看它是否卡在供應鏈的關鍵位置（Choke Point）
- 分級定義：嚴格區分 Tier S (Kingmaker)、Tier A (Contender)、Tier B (Beneficiary) 與 Tier X (Victim)。
- 獵殺舊技術：主動識別並標記 Tier X（被新技術取代的舊霸主）
"""

    three_layer_check = """
[三層對位檢查指令]
你必須對這家公司執行三層對位檢查。每一層都必須回答所有問題並判斷是否通過。

═══ 第一層：工程對位檢查（ENG Fit） ═══
必須回答並輸出：
1. 公司提供的產品/技術/材料/製程是否直接對應 Subtheme？
2. 若不用該公司產品，工程上是否有可 scale 替代？
3. 是否符合 P0-ENG 的失效模式？
4. 是否符合工程收斂方向（標準/Roadmap）？
5. 是否存在不可逆 lock-in（客戶換供應商代價高）？

不通過條件（任一成立即不得進正式候選池）：
- 只是「沾邊」：產品可有可無
- 可降規避開
- 可平替且多供應商已成熟

═══ 第二層：結構對位檢查（STRUCT Fit） ═══
必須回答並輸出：
1. 公司是否位於「必經節點/合規入口/流程 OS/樞紐」？
2. 不用會怎樣？（交易/合規/責任/流程失效）
3. 替代者要重建哪些門檻？（法規/網路效應/資料/控制權/切換成本）
4. 是否有制度/標準/行為收斂證據支持「逃不掉」？
5. 是否存在再定價觸發器（新層疊加造成質變）？

不通過條件（任一成立即不得進正式候選池）：
- 只有市占/品牌，無失效模式
- 替代路徑合理時間可完成
- 只是一個產品紅利，無通道/制度控制權

═══ 第三層：時間角色對位檢查（Time & Role Fit｜P0.7） ═══
必須回答並輸出：
1. 公司屬於 P0.7 指定的 Leveraged_Role_Type 嗎？
2. 若不是，它屬於哪一層？（例如：最先承壓層/成熟收斂層）
3. 在當前 Time_Position 下，它是否是最優受益角色？
4. 若主導迴路從 R 轉 B（或 B 轉 R），該公司角色會變強或變弱？
5. 是否存在「工程對但時間錯」的錯位？

不通過條件：
- 工程/結構對，但在當前時間位置是「最先承壓」或「已成熟無再定價」角色 → 必須進 Tracking 或 Rejection，不得進正式候選池
"""

    moat_guide = """
[Moat_Type 分類指引]
為每家公司判斷 Moat_Type（可多選但需標註主/次）：
M1: 工程/物理硬牆
M2: 法規/認證硬牆
M3: 通道/樞紐硬牆
M4: 生態/系統控制硬牆
M5: 流程/切換成本硬牆
M6: 供給側約束硬牆

M4 生態系防呆條款（任一不滿足不得標 M4）：
以下三條必須全部成立：
1. 不可拆模組 ≥ 3：產品/服務至少三個模組互相依賴，拆掉就失效或價值大幅下降
2. 系統控制權或預設路徑至少 1：OS/入口/分發/身份/路由/預設協議/預設工作流
3. 資料飛輪或行為收斂至少 1：越用越好、越多人用越難離開（或形成產業習慣/標準）
"""

    rerate_guide = """
[Rerate_State 分類指引]
判斷 Rerate_State：
R0: 敘事已完成（Mature Moat）— 護城河共識化多年，偏防守/複利型
R1: 部分定價（Under-appreciated）— 護城河存在，市場理解不完整
R2: 未定價（Pre-narrative）— 護城河正在形成或剛跨臨界點
R3: 再定價引擎（Old Moat + New Layer）— 新技術層使定價權質變放大
"""

    boost_rules = """
[加成規則]
- P0 conviction = ULTRA_HIGH → Tier 評分 +1.0
- P0.5 new_beneficiary_candidates 中包含此公司 → Tier 評分 +0.5
- P0.5 new_victim_candidates 中包含此公司 → Tier 評分 -1.0
"""

    skills = SkillsInjector.inject_skills("P1-2")

    system_prompt = "\n".join([
        preamble, 
        role, 
        three_layer_check, 
        moat_guide, 
        rerate_guide, 
        boost_rules, 
        skills
    ])

    user_prompt = f"""
請針對以下公司執行 P1 Step 2 分級分析：

[COMPANY INFO]
{company}

[P0 LOGIC CARD]
{p0_logic_card}

[P0.5 CONTEXT]
{p05_output}

[P0.7 CONTEXT]
{p07_output}

[EXTRACTION EVIDENCE]
{extraction_evidence}

請以 JSON 格式輸出 P1CompanyEntry 規定的所有欄位，包含完整的對位檢查理由。
"""
    user_prompt += PromptBuilder.future_alignment_check()

    return {
        "system": system_prompt,
        "user": user_prompt
    }

def build_p1_step2_scout_prompt(tiering_output: Dict) -> Dict:
    """
    SSOT §5.9: P1 Step 2 Scout Prompt.
    """
    system = """
[SCOUT MISSION]
你的任務是檢查「排序是否合理」，而不是挑單一公司。

請關注：
- 是否有公司被高估了結構地位？
- 是否有被低估、但其實更接近瓶頸角色的公司？
- 分析者是否把「市場敘事強度」誤認為「結構控制力」？

你可以問：
- 如果產業出現供需緊張，誰會最先提高議價權？
- 若利潤下降，誰會最先被擠壓？

請避免：
- 為每一個 Tier 都提出反對
- 對邊界案例過度糾歡
"""
    return {
        "system": system,
        "user": f"請審查以下分級結果的「合理性」：\n\n{tiering_output}"
    }
