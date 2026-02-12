
from typing import Dict
from nuclear.prompts.base import PromptBuilder

def build_p21_peer_selection_prompt(ticker: str, company_info: Dict, p0_logic_card: Dict) -> Dict:
    """
    SSOT §6.2.2 ①: P2-1 Peer Selection Prompt.
    """
    role = """
[ROLE CALIBRATION]
你的任務是識別「合理的同業比較集合」，而不是判斷公司好壞。

請專注於以下問題：
- 該公司最核心的產品/服務是什麼？
- 它的主要獲利模式與價值來源是什麼？
- 在產業鏈中，它扮演的是什麼角色（瓶頸、平台、代工、品牌、通路等）？

同業定義請優先考慮：
- 相同或高度相似的細分產業
- 相似的商業模式與價值捕捉方式
- 相近的市場定位（而非僅僅同一板塊）

規模分類是必要步驟：
- 先判斷該公司屬於：Market Leader / Mid-to-Large Cap / Small Cap or Startup
- 同業清單必須與目標公司屬於相同規模層級
- 若找不到完全相同規模，請說明差異與合理性

請避免：
- 使用股價表現或近期漲跌作為同業依據
- 提前做出「誰比較好」的價值判斷
- 將整個上中下游全部納入（除非高度依存）

明確禁止：
- 不要用「看起來比較強」當選擇理由
- 不要用股價表現當同業依據
"""

    system_prompt = role
    user_prompt = f"""
請為 {ticker} 選擇合理的同業清單：

[COMPANY INFO]
{company_info}

[P0 LOGIC CARD]
{p0_logic_card}

請以 JSON 格式輸出 peer_group，包含 peers 列表（ticker, company_name, size_classification, selection_reasoning）以及目標公司的 size_classification。
"""
    return {
        "system": system_prompt,
        "user": user_prompt
    }

def build_p21_scout_prompt(peer_selection_results: Dict) -> Dict:
    """
    SSOT §6.2.4: P2-1 Scout Prompt.
    """
    system = """
[SCOUT MISSION]
你的任務不是重做同業名單，而是檢查分析者的「比較前提是否合理」。

請特別關注：
- 是否混合了不同商業模式卻被當成同業？
- 是否存在「規模錯配」（例如龍頭 vs 小型新創）？
- 是否有被忽略但更關鍵的直接競爭者？
- 是否把「產業鏈相關」錯當成「同業競爭」？

你可以提出：
- 哪一家公司其實不該被放在這張比較桌上？為什麼？
- 是否有更合適但被忽略的比較對象？
- 分析者的產業邊界假設是否過窄或過寬？

請避免：
- 僅僅因為敘事不同就否定
- 重複分析者已明確說明且合理的選擇理由

輸出形式：
- 列出「潛在問題點或盲點」
- 若無重大問題，請簡要說明為何這個同業集合是合理的
"""
    return {
        "system": system,
        "user": f"請審查以下同業選擇結果：\n\n{peer_selection_results}"
    }
