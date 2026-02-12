from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class UComponents(BaseModel):
    base: float
    p07_cap: Optional[float] = None
    defcon_cap: Optional[float] = None
    climate_cap: Optional[float] = None
    offensive_boost: Optional[float] = None
    drift_adj: Optional[float] = None

class WIdealComponents(BaseModel):
    base_weight: float
    role_multiplier: float
    risk_modifier: float
    sm_modifier: float
    conviction_boost: float
    growth_modifier: float
    future_modifier: float
    ol_boost: float
    rerate_modifier: float
    valuation_brake: float
    positive_clip: float  # clip 後的正面乘積
    risk_combined: float  # Risk_Modifier × Valuation_Brake
    risk_floor: float  # 地板保護值

class CatAllocation(BaseModel):
    buy1_pct: float  # 追價
    buy2_pct: float  # 標準
    buy3_pct: float  # 深跌
    sell_pct: float  # 賣出

class PyramidDetails(BaseModel):
    size: float
    price: float
    stop: float

class P4StockAllocation(BaseModel):
    ticker: str
    W_ideal: float  # 理想權重
    W_ideal_components: WIdealComponents
    W_now: float  # 現有權重（初始為 0）
    delta: float  # W_ideal - W_now
    cat_allocation: CatAllocation
    single_max: float  # 該股上限
    pyramid_eligible: bool
    pyramid_details: Optional[PyramidDetails] = None
    oversold_recovery: bool
    alpha_exempt: bool

class SectorExposure(BaseModel):
    sector_id: str
    current_pct: float
    target_pct: float

class P4Output(BaseModel):
    """P4 資金配置輸出（純數學，無 AI）"""
    U_final: float  # 最終總曝險率
    U_components: UComponents
    offensive_mode: str  # "ACTIVE" | "INACTIVE"
    defcon_level: int  # 1-5
    
    per_stock: List[P4StockAllocation]
    
    sector_exposure: List[SectorExposure]
    frontier_total: float  # FRONTIER 類總倉位
    
    snapshot_id: str
    version_chain_id: str
