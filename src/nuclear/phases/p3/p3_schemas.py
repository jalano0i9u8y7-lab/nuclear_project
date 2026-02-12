from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from nuclear.models.constitutional import ConstitutionalOutput
from nuclear.phases.p25.p25_schemas import ICDZRange

class PriceLevel(BaseModel):
    price: float
    strength: str  # "STRONG" | "MODERATE" | "WEAK"
    type: str  # "HISTORICAL" | "VOLUME_PROFILE" | "FIBONACCI" | "ICDZ"

class BuyPrices(BaseModel):
    buy1: Optional[float] = None # 追價
    buy2: Optional[float] = None # 標準
    buy3: Optional[float] = None # 深跌

class StopPrices(BaseModel):
    stop1: Optional[float] = None
    stop2: Optional[float] = None

class P3Output(ConstitutionalOutput):
    """P3 技術面與機構視角輸出（Strategy Skeleton）"""
    ticker: str
    
    # Cat 判定（AI 判斷，§8.4.1）
    cat: int = Field(..., ge=1, le=5) # 1-5
    cat_confidence: float = Field(..., ge=0.0, le=1.0) # 0-1
    cat_reasoning: str
    cat_reversal_evidence: Optional[str] = None # 逆轉證據（若適用）
    
    # 支撐壓力
    support_levels: List[PriceLevel]
    resistance_levels: List[PriceLevel]
    
    # 趨勢結構
    trend_structure: str # "BULLISH" | "BEARISH" | "NEUTRAL" | "TRANSITIONING"
    
    # ICDZ（繼承自 P2.5）
    icdz_applied: bool
    icdz_range: Optional[ICDZRange] = None
    
    # Risk Overlay（§8.4.2）
    risk_overlay_level: int = Field(..., ge=0, le=3) # 0-3
    
    # Distortion Risk（§8.4.3）
    distortion_risk: str # "NONE" | "LOW" | "MED" | "HIGH"
    
    # 相對強度（§8.4.5）
    rs_score_5d: Optional[float] = None
    rs_score_20d: Optional[float] = None
    
    # Boomerang（§8.4.4）
    re_entry_signal: bool
    re_entry_price: Optional[float] = None
    
    # FPE（繼承自 P2）
    fpe_a: Optional[float] = None
    fpe_b: Optional[float] = None
    fpe_b_vs_peers_pct: Optional[float] = None
    fpe_divergence: Optional[float] = None
    valuation_flag: str # "VALUATION_ATTRACTIVE" | "VALUATION_STRETCHED" | "FPE_DIVERGENCE_ALERT" | "NONE"
    
    # 掛單建議
    buy_prices: BuyPrices
    stop_prices: StopPrices
    
    # 週線
    weekly_trend: str
    volume_profile: str
    
    # Alpha 豁免（§8.4.1a）
    alpha_exempt: bool
    
    # P3-Delta 控制
    next_delta_run_date: Optional[str] = None
    
    snapshot_id: str
    version_chain_id: str
    run_id: str = "default"
    created_at: str = ""

VALID_CATS = [1, 2, 3, 4, 5]
VALID_TREND_STRUCTURES = ["BULLISH", "BEARISH", "NEUTRAL", "TRANSITIONING"]
VALID_DISTORTION_RISKS = ["NONE", "LOW", "MED", "HIGH"]
VALID_VALUATION_FLAGS = ["VALUATION_ATTRACTIVE", "VALUATION_STRETCHED", "FPE_DIVERGENCE_ALERT", "NONE"]

# --- P3-Delta Schema ---

class CatUpdate(BaseModel):
    previous_cat: int
    current_cat: int
    cat_changed: bool
    change_reason: Optional[str] = None

class KeyLevelBreach(BaseModel):
    support_broken: bool
    resistance_broken: bool
    broken_level: Optional[float] = None
    breach_quality: Optional[str] = None # "HIGH_VOLUME" | "LOW_VOLUME" | "NONE"

class P3DeltaOutput(BaseModel):
    """P3-Delta 週度追蹤輸出"""
    ticker: str
    cat_update: CatUpdate
    key_level_breach: KeyLevelBreach
    volume_anomaly: bool
    rs_score_5d_updated: Optional[float] = None
    boomerang_triggered: bool
    skeleton_validity: str # "VALID" | "STALE" | "CRITICAL"
    weekly_note: str
    snapshot_id: str
    version_chain_id: str
    run_id: str = "default"
    created_at: str = ""

VALID_SKELETON_VALIDITY = ["VALID", "STALE", "CRITICAL"]
