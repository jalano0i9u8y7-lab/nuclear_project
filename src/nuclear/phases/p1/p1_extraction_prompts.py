
from typing import Dict
from nuclear.prompts.base import PromptBuilder

def build_extraction_prompt(ticker: str, market: str, document_text: str) -> Dict:
    """
    SSOT §5.3: P1-1.5 Financial Report Extraction Prompt.
    Role: Emotionless OCR machine.
    """
    
    role = """
[ROLE CALIBRATION]
你是一個沒有感情的 OCR 掃描機器與數據錄入員。你不思考、不判斷、不摘要，只負責精準地把文字「摳」下來。

禁止分析：絕對不要嘗試解讀數據好壞。如果財報寫「虧損擴大」，你就照抄「虧損擴大」，不要寫「表現不佳」。
原文引用：提取內容必須附上 (Page XX, 10-K 2024) 來源標記。
"""

    three_fields = """
[三欄位分離指令]
請將財報內容提取到以下三個欄位，每個欄位獨立輸出：

欄位 1：P1_Industry_Evidence（供 P1-2 Tiering 使用）
提取範圍：Business Description、Revenue Mix、Supply Chain Role、Competition、R&D、Capacity
用途：判斷公司的產業位置和結構角色

欄位 2：P2_Financial_Evidence（供 P2-1 / P2-2 使用）
提取範圍：Profitability、Growth、Balance Sheet、Cash Flow、Guidance、Risk Factors
用途：判斷公司的財務健康狀況

欄位 3：P2.5_Institutional_Evidence（供 P2.5 Institutional 使用）
提取範圍：Shareholding Structure、Dilution、Capital Actions、Dividends Policy
用途：判斷機構行為和資本結構

提取要求：
- 原封不動提取原文（不得改寫）
- 每段附頁數
- 標註財報年份和季度
- 保留上下文（前後 1-2 句）
- 表格轉 Markdown
"""

    system_prompt = "\n".join([role, three_fields])
    
    user_prompt = f"""
請針對 {ticker} ({market}) 的財報文本執行提取任務：

{document_text[:10000]}  # 限制長度示範

請以 JSON 格式輸出指定的三個欄位。
"""
    return {
        "system": system_prompt,
        "user": user_prompt
    }
