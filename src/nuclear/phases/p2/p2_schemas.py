
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from nuclear.models.constitutional import ConstitutionalOutput

# SSOT §6.10: 6 Types of Position Roles
POSITION_ROLES = {
    "A_MOMENTUM_COMPOUNDER": {"risk": "SAFE", "growth": ["S", "A"], "future": ["A", "S"], "role": "MOMENTUM"},
    "B_EARLY_DIAMOND": {"risk": ["SAFE", "CAUTION"], "growth": ["B"], "future": ["S", "A"], "role": "DIAMOND"},
    "C_FRONTIER_OPTIONALITY": {"risk": ["CAUTION", "DANGER"], "growth": ["X", "B"], "future": ["S"], "role": "OPTIONALITY"},
    "D_SAFE_BUT_STAGNANT": {"risk": "SAFE", "growth": ["B", "X"], "future": ["B", "X"], "role": "DEFENSIVE"},
    "E_HOT_BUT_FRAGILE": {"risk": "DANGER", "growth": ["S", "A"], "future": ["X", "B"], "role": "REJECT"},
    "F_REJECT_WATCHLIST": {"growth": ["X"], "future": ["X"], "role": "REJECT"},
}

# SSOT §6.7.4: Mispricing Types
VALID_MISPRICING_TYPES = [
    "timing_mismatch",
    "cycle_misread",
    "quality_of_earnings",
    "narrative_oversimplification",
    "tail_risk_underpricing",
    "structural_repricing",
    "bubble",
    "fairly_priced",
]

# --- P2-1 Fact Model Schemas ---

class FrontierGrowthScores(BaseModel):
    """FRONTIER 軌道獨立 Growth Quality 子分項（§6.2.2 ③）"""
    revenue_growth: float  # 30% 權重
    rnd_efficiency: float  # 25% 權重
    revenue_retention: float  # 25% 權重
    survival_score: float  # 20% 權重（含 Cash Runway、Dilution Risk、Inevitability Score）

class OperatingLeverageInflection(BaseModel):
    present: bool
    evidence: str
    confidence: float  # 0-1

class PeerEntry(BaseModel):
    ticker: str
    company_name: str
    size_classification: str  # "Market_Leader" | "Mid_to_Large" | "Small_Cap_Startup"
    selection_reasoning: str
    metrics_vs_peers: Dict[str, float]  # 各指標 vs_peers 百分位

class PeerGroup(BaseModel):
    peers: List[PeerEntry]
    size_classification: str

class P21FactModel(BaseModel):
    """P2-1 事實建模層輸出（內部中間表，不對外暴露）"""
    snapshot_id: str
    version_chain_id: str
    ticker: str
    
    # Risk Profile（§6.2.2 ④）
    risk_profile: str  # "SAFE" | "CAUTION" | "DANGER"
    risk_note: Optional[str] = None
    
    # Growth Quality 四個子分項（§6.2.2 ③）
    growth_rate_score: float
    growth_consistency_score: float
    operating_leverage_score: float
    cash_conversion_score: float
    
    # CORE 軌道硬標記（§6.2.2 ③）
    growth_low_quality_flag: bool
    
    # FRONTIER 軌道獨立評分（§6.2.2 ③）
    frontier_growth_scores: Optional[FrontierGrowthScores] = None
    
    # 營運槓桿拐點（§6.2.2 ③）
    operating_leverage_inflection: OperatingLeverageInflection
    
    # FPE（§6.2.2 ⑤）
    fpe_a: Optional[float] = None
    fpe_b: Optional[float] = None
    fpe_divergence: Optional[float] = None
    
    # 同業（§6.2.2 ①）
    peer_group: PeerGroup
    
    # 財務指標結構化數據
    fact_items: Dict[str, Any]
    
    # P0 邏輯卡排除的指標（§6.2.1）
    forbidden_metrics_skipped: List[str]
    
    source: str
    as_of_date: str

# --- P2-2 Phase2Output Schemas ---

class GrowthSubScores(BaseModel):
    growth_rate_score: float
    growth_consistency_score: float
    operating_leverage_score: float
    cash_conversion_score: float

class ThesisValidationTriggers(BaseModel):
    bull_case_confirmed: List[str]
    thesis_broken: List[str]

class Milestone(BaseModel):
    target: str
    verification_source: str
    verification_method: str
    expected_date: str

class ScenarioPath(BaseModel):
    trigger: str
    leading_indicators: List[str]
    expected_financial_signatures: str
    falsification_checkpoints: List[str]
    failure_mode: str

class ThreeScenarioSummary(BaseModel):
    base: ScenarioPath
    bull: ScenarioPath
    bear: ScenarioPath

class Phase2Output(ConstitutionalOutput):
    """P2-2 因果推演層的正式對外輸出（唯一下游讀取介面）"""
    ticker: str
    
    # 繼承自 P2-1
    risk_profile: str  # SAFE / CAUTION / DANGER
    risk_note: Optional[str] = None
    
    # P2-2 AI 判定
    growth_grade: str  # S / A / B / X
    growth_sub_scores: GrowthSubScores
    growth_grade_reasoning: str
    growth_low_quality_flag: bool
    operating_leverage_inflection: OperatingLeverageInflection
    
    # Future Breakout（§6.8.3）
    future_potential_score: float
    future_breakout_grade: str  # S / A / B / X
    inevitability_score: float
    executability_score: float
    
    # FPE
    fpe_a: Optional[float] = None
    fpe_b: Optional[float] = None
    fpe_b_vs_peers_percentile: Optional[float] = None
    fpe_divergence: Optional[float] = None
    
    # Track & Position
    track_type: str  # "CORE" | "FRONTIER" | "EMERGING_STAR"
    position_role: str  # 6 類分類代碼（§6.10）
    
    # Mispricing（§6.7）
    mispricing_type: List[str]
    
    # Thesis（§6.7.6）
    thesis_statement: str
    thesis_validation_triggers: ThesisValidationTriggers
    
    # Milestones
    milestones: List[Milestone]
    
    # 敘事
    narrative_tree_summary: str
    three_scenario_summary: ThreeScenarioSummary
    
    # 同業
    peer_group: PeerGroup
    
    # 繼承自 P0/P1
    p0_conviction_level: str
    tier: str  # S / A / B / X
    primary_sector: str
    secondary_sector: Optional[str] = None
    rerate_state: str  # R0 / R1 / R2 / R3
    
    # 系統欄位
    snapshot_id: str
    version_chain_id: str
    as_of_date: str
    run_id: str
    created_at: str
