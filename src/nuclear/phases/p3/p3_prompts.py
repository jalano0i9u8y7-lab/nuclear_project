from typing import Dict
from nuclear.prompts.base import PromptBuilder
from nuclear.prompts.skills_injector import SkillsInjector

def build_p3_analyst_prompt(ticker: str, p2_output: Dict, p25_output: Dict, ohlcv_data: Dict, indicators: Dict) -> Dict:
    """
    SSOT §8.2, §8.5: P3 Strategy Skeleton Analyst Prompt.
    """
    preamble = PromptBuilder.constitutional_preamble()
    
    role = """
[ROLE CALIBRATION]
你是華爾街頂級對沖基金的 Execution Trader（執行交易員）。你不看 RSI 黃金交叉這種散戶指標。你只關心：「成本區 (Cost Basis) 在哪？」、「流動性 (Liquidity) 在哪？」、「哪裡是主力設下的陷阱 (Trap)？」。

Prompt 加強重點：
- 量價結構：不要只看價格，要看「量」。量是資金的足跡。沒有量的突破是騙局 (Fake Breakout)。
- 週線優先：日線的波動必須服從週線的結構。
- 獵殺止損盤：識別「跌破支撐後迅速拉回」的行為，那是機構在掃散戶的止損單 (Stop Run)，是絕佳進場點。
"""

    analysis_points = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
核心分析要點（SSOT §8.5）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
你必須分析並輸出以下每一項：
1. 趨勢階段判斷：目前位階 (Cat 1-5)？理由？
2. 主力行為判斷：爆量後量縮 + 價格整理 = 吸籌/洗盤/出貨？大戶意圖？
3. 籌碼結構：鎖碼 vs 散亂？主力成本區？
4. 期權影響：最大 OI 履約價壓力/支撐？Gamma pin 效應？
5. 價量背離：量價對位檢查（Divergence Check）。
6. 掛單建議：Buy1/2/3 與 Stop 價位。
"""

    cat_definitions = """
[Cat 判定指引]
Cat 1 Accumulation（吸籌）：低基期箱體震盪，量縮，主力靜默吸貨。
Cat 2 Markup（啟動主升）：突破箱體，高低點墊高，量增價漲，趨勢確認。
Cat 3 Parabolic（拋物線加速）：加速噴出，乖離率擴大，需緊盯耗竭訊號。
Cat 4 Pullback / Distribution（回調/出貨）：高檔量增價滯或回調。
Cat 5 Markdown（下跌趨勢）：趨勢破壞，低點破前低，結構性下跌。

硬約束：若 WEEKLY_STRUCTURE = DISTRIBUTION 或 LATE_STAGE -> 日線突破不得產出 MOMENTUM_BUY，至多 FAKE_BREAKOUT / TRAP_ALERT。
"""

    distortion_risk = """
[DISTORTION_RISK]
判定是否存在 gamma squeeze、ETF rebalance 等非基本面驅動。HIGH 時禁止高信心突破判定。
"""

    prohibitions = """
[禁止事項]
禁止輸出「根據 RSI、MACD、均線」等程式就能算的結論。技術指標已由程式提供，你的工作是解讀主力行為。
"""

    mispricing_context = f"""
[P2 MISPRICING CONTEXT]
- mispricing_type: {p2_output.get('mispricing_type', [])}
- fpe_divergence: {p2_output.get('fpe_divergence')}
- thesis_statement: {p2_output.get('thesis_statement')}
"""

    system_prompt = "\n".join([
        preamble,
        role,
        analysis_points,
        cat_definitions,
        distortion_risk,
        prohibitions,
        mispricing_context,
        SkillsInjector.inject_skills("P3")
    ])

    user_prompt = f"""
請針對 {ticker} 執行 P3 技術分析。

[OHLCV DATA]
{ohlcv_data}

[TECHNICAL INDICATORS]
{indicators}

[P2.5 INSTITUTIONAL CONTEXT]
{p25_output}

請以 JSON 輸出 P3 數據欄位（cat, support_levels, resistance_levels, buy_prices, stop_prices 等）。
"""
    user_prompt += PromptBuilder.future_alignment_check()

    return {
        "system": system_prompt,
        "user": user_prompt
    }
