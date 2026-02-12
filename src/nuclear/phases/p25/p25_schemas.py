from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from nuclear.models.constitutional import ConstitutionalOutput

class ICDZRange(BaseModel):
    """
    機構成本防守區（§7.3.4）
    """
    lower: Optional[float] = None
    upper: Optional[float] = None
    confidence: float = Field(..., ge=0.0, le=1.0) # 0-1，三維度加權（§7.3.4）

class P25Output(ConstitutionalOutput):
    """
    P2.5 機構籌碼分析輸出
    """
    ticker: str
    smart_money_score: float # 0-100
    smart_money_direction: str # "ACCUMULATION" | "NEUTRAL" | "DISTRIBUTION"
    insider_alert: bool # 高管集體大量賣出
    insider_alert_detail: Optional[str] = None # AI 評估結果
    abnormal_13f_alert: bool # 機構集體撤退
    hedge_fund_clone_signal: str # "HIGH_CONVICTION_BUY" | "NEUTRAL" | "EXIT_SIGNAL"
    icdz_range: ICDZRange # 機構成本防守區
    institutional_ownership_change: Optional[float] = None # 單季持股比例變動%
    rating_trend_score: Optional[float] = None # 機構評級趨勢
    rating_divergence: Optional[float] = None # 機構間評級分歧度
    snapshot_id: str
    version_chain_id: str
    run_id: str = "default"
    created_at: str = ""

VALID_SM_DIRECTIONS = ["ACCUMULATION", "NEUTRAL", "DISTRIBUTION"]
VALID_CLONE_SIGNALS = ["HIGH_CONVICTION_BUY", "NEUTRAL", "EXIT_SIGNAL"]

def compute_icdz_confidence(data_completeness: float, institutional_consistency: float, price_validation: float) -> float:
    """
    SSOT §7.3.4 ICDZ confidence 計算
    數據完整性 40% + 機構持股一致性 30% + 價格行為驗證 30%
    """
    return 0.4 * data_completeness + 0.3 * institutional_consistency + 0.3 * price_validation

ICDZ_APPLICABILITY = {
    1: "HIGH",    # Cat 1 Accumulation: 機構正在此區間吸籌
    2: "MEDIUM",  # Cat 2 Markup: 作為回調支撐參考
    3: "NONE",    # Cat 3 Parabolic: 價格已遠離成本區
    4: "HIGH",    # Cat 4 Pullback: 機構是否在防守
    5: "LOW",     # Cat 5 Markdown: 機構可能已放棄防守
}

TOP_HEDGE_FUNDS = [
    "Berkshire Hathaway", "Bridgewater", "Renaissance Technologies",
    "Tiger Global", "Coatue", "D1 Capital", "Viking Global",
    "Lone Pine Capital", "Maverick Capital", "Citadel"
]
