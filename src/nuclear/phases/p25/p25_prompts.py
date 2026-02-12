from typing import Dict
from nuclear.prompts.base import PromptBuilder
from nuclear.prompts.skills_injector import SkillsInjector

def build_p25_analyst_prompt(ticker: str, p2_output: Dict, daily_data: Dict, quarterly_13f: Dict) -> Dict:
    """
    SSOT §7.3: P2.5 Institutional Analyst Prompt.
    """
    preamble = PromptBuilder.constitutional_preamble()
    
    role = """
[ROLE CALIBRATION]
你是機構級籌碼分析師。你的任務是用「真金白銀的流向」驗證基本面故事。

核心問題：
- 聰明錢 (Smart Money) 在買還是在賣？
- 內部人 (Insider) 的行為透露什麼訊號？
- 機構的平均持倉成本在哪裡？他們會防守嗎？
"""

    analysis_dimensions = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
分析維度（SSOT §7.3）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 13F 機構持倉變動（季度數據）：集體吸籌或撤退。
2. Insider Trading（月度聚合）：過濾稅務相關行為，識別真實買賣意圖。
3. Hedge Fund Clone：對比 Top 10 Hedge Funds (Berkshire, Citadel, etc.) 持倉。
4. ICDZ 機構成本防守區估算：結合 13F 與近期大量成交區。
"""

    insider_rules = """
[Insider Alert 分級處理]
- 多位高管集體大量賣出 (> 30% 持股) -> 標記 insider_alert = TRUE（硬規則）。
- 其餘賣出情境 -> AI 評估交易真實意義（角色、10b5-1 plan、時間點、集體模式）。
- 內部人買入 -> 正面信號。
"""

    system_prompt = "\n".join([
        preamble,
        role,
        analysis_dimensions,
        insider_rules,
        SkillsInjector.inject_skills("P2.5")
    ])

    user_prompt = f"""
請針對 {ticker} 進行機構籌碼分析。

[P2 基本面推演結果]
{p2_output}

[DAILY DATA & 13F DATA]
Daily: {daily_data}
Quarterly 13F: {quarterly_13f}

請輸出 JSON 格式的 P2.5 數據，包含 smart_money_score, smart_money_direction, insider_alert, icdz_range 等欄位。
"""
    user_prompt += PromptBuilder.future_alignment_check()

    return {
        "system": system_prompt,
        "user": user_prompt
    }
