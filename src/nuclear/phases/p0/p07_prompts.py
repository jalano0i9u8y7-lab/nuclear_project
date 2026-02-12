
from typing import Dict
from nuclear.prompts.base import PromptBuilder
from nuclear.prompts.skills_injector import SkillsInjector

def build_p07_prompt(p0_output: Dict, p05_evidence_pack: Dict) -> Dict:
    """
    SSOT §4.3: P0.7 System Dynamics Prompt Builder.
    Role: Howard Marks + Ray Dalio.
    """
    preamble = PromptBuilder.constitutional_preamble()
    
    role = """
[ROLE CALIBRATION]
你是霍華·馬克斯 (Howard Marks) 與雷·達里奧 (Ray Dalio) 的合體。你專注於「鐘擺的位置」與「信貸循環的階段」。你不預測點位，你只判斷週期。

重點：
- 拒絕線性外推：現在好不代表未來好，重點是二階導數（加速度）
- 識別反身性 (Reflexivity)：價格上漲是否反過來刺激了更瘋狂的需求？（索羅斯邏輯）
- 時間定位：現在是派對剛開始 (Early)，還是最後的狂歡 (Late)？
"""

    skills = SkillsInjector.inject_skills("P0.7")
    
    analysis_modules = """
[SIX-STAGE ANALYSIS MODULES]
你必須按照以下六個模組**按順序**逐一分析，不得跳步：

A) 動態性問題定義
必須用「隨時間變化」的句子定義，而非靜態描述。
✅ 正確：「在商業化過程中，算力成本與效益是否仍形成可持續正回饋？」
❌ 錯誤：「這個產業會不會成長？」

B) 關鍵存量（Stocks）與流量（Flows）辨識
- Stocks：會累積的東西（能力、滲透率、風險、成本壓力…）
- Flows：讓 Stocks 增減的速度（導入速度、擴產速度、認證速度…）

C) CLD 因果迴路裁決
至少要辨識：1 個主要 R 迴路（引擎）、1 個主要 B 迴路（抑制器），並寫出其因果鏈

D) 時間序位置裁決（四分法）
- Early：結構成形中，滲透率低，R 開始增強
- Mid：R 主導，擴散加速，複利期
- Late：B 抬頭，成長收斂，市場已高度共識
- Transition：R→B 或 B→R 的轉折帶（高不確定、高波動）

E) 槓桿點角色類型裁決（只寫類型，不寫公司）
輸出必須是「公司類型」，例如：平台核心層、合規入口層、設備承載層、流程 OS、供給側約束
並說明為何它是槓桿點（牽一髮動全身）

F) 敘事與結構錯位檢查
必須判斷是否存在：
- 敘事 > 結構（炒過頭）
- 結構 > 敘事（被低估）
- 時間錯位（太早/太晚）
並寫出「錯位會造成的投資誤判」
"""

    output_requirements = """
[OUTPUT REQUIREMENTS]
你必須輸出以下五項，缺一不可：
1. Dynamic_Problem_OneLiner：動態問題一句話
2. Loop_Dominance：R / B / Mixed / Transitional (註：對應 REINFORCING / BALANCING / MIXED / TRANSITIONAL)
3. Time_Position：Early / Mid / Late / Transition
4. Leveraged_Role_Type：角色類型＋理由
5. Risk_Note：若跳過 P0.7 最可能犯的錯

[IMPORTANT REMINDER]
- 你判定的是「產業週期」，不是「市場週期」
- 產業週期影響 P2 Future Breakout Grade 上限、P3 Risk Overlay、P4 U 上限、WB-2 板塊權重
- 市場週期由 D4_FINAL 判定，與你無關
"""

    system_prompt = "\n".join([preamble, role, skills, analysis_modules, output_requirements])
    
    user_prompt = f"""
請根據以下數據執行 P0.7 系統動力學分析：

P0 Output: {p0_output}
P0.5 Evidence Pack: {p05_evidence_pack}

請以 JSON 格式輸出指定欄位。 
"""
    user_prompt += PromptBuilder.future_alignment_check()
    
    return {"system": system_prompt, "user": user_prompt}
