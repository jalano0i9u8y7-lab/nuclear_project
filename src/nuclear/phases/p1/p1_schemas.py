
from typing import List, Dict, Optional
from pydantic import BaseModel, Field, validator
from nuclear.models.constitutional import ConstitutionalOutput

# SSOT §5.7: Moat Types
VALID_MOAT_TYPES = {
    "M1": "工程/物理硬牆",
    "M2": "法規/認證硬牆",
    "M3": "通道/樞紐硬牆",
    "M4": "生態/系統控制硬牆",
    "M5": "流程/切換成本硬牆",
    "M6": "供給側約束硬牆",
}

# SSOT §5.8: Rerate States
VALID_RERATE_STATES = {
    "R0": "敘事已完成（Mature Moat）",
    "R1": "部分定價（Under-appreciated）",
    "R2": "未定價（Pre-narrative）",
    "R3": "再定價引擎（Old Moat + New Layer）",
}

# SSOT §5.6: Tiers
VALID_TIERS = {
    "S": "Kingmaker — 核心瓶頸、絕對定價權、不可取代",
    "A": "Contender — 高連動受益、次核心、關鍵合作夥伴",
    "B": "Beneficiary — 順風受益、邊緣紅利、純度較低",
    "X": "Victim — 結構性受害者",
}

class EngFitResult(BaseModel):
    passes: bool
    product_maps_to_subtheme: bool
    no_scalable_alternative: bool
    matches_failure_mode: bool
    matches_convergence: bool
    has_lock_in: bool
    reasoning: str

class StructFitResult(BaseModel):
    passes: bool
    is_critical_node: bool  # 必經節點/合規入口/流程OS/樞紐
    failure_consequence: str  # 不用會怎樣
    replacement_barriers: List[str]  # 替代者要跨的門檻
    has_convergence_evidence: bool
    has_repricing_trigger: bool
    reasoning: str

class TimeRoleFitResult(BaseModel):
    passes: bool
    matches_leveraged_role_type: bool  # 是否屬於 P0.7 指定的類型
    role_layer: str  # 它屬於哪一層
    optimal_in_current_position: bool  # 在當前 Time_Position 下是否最優
    loop_shift_resilience: str  # R→B 時角色會變強或變弱
    timing_mismatch: bool  # 是否存在「工程對但時間錯」
    reasoning: str

class FrontierChecks(BaseModel):
    market_cap_under_limit: bool  # 美股<$10B, 台股<NT$300B, 日股<¥1T
    rnd_above_median: bool  # R&D_to_Revenue > 同業中位數 × 1.3
    future_potential_eligible: bool  # 預留給 P2: Future_Potential_Score >= 70
    runway_eligible: bool  # 預留給 P2: Runway >= 4 季

class P1CompanyEntry(BaseModel):
    ticker: str
    company_name: str
    market: str  # "US" | "TW" | "JP"
    tier: str  # S / A / B / X
    tier_reasoning: str  # 分級理由（必填，不可為空）
    
    # 三層對位檢查結果（§5.5）
    eng_fit: EngFitResult  # 工程對位
    struct_fit: StructFitResult  # 結構對位
    time_role_fit: TimeRoleFitResult  # 時間角色對位
    
    # Moat 與 Rerate（§5.7, §5.8）
    moat_types: List[str]  # M1-M6，可多選
    moat_primary: str  # 主要 Moat（必填，一個）
    rerate_state: str  # R0-R3
    
    # 板塊歸屬（§5.10）
    primary_sector: str  # P0 subtheme_id（必填，僅一個）
    secondary_sector: Optional[str] = None # 選填，最多一個
    
    # P0 繼承
    p0_theme_id: str
    p0_subtheme_id: str
    chain_position: str  # "upstream" | "midstream" | "downstream" | "complementary" | "substitute"
    
    # FRONTIER 量化門檻（§5.11）
    frontier_eligible: bool
    frontier_checks: Optional[FrontierChecks] = None

    @validator("tier")
    def validate_tier(cls, v):
        if v not in VALID_TIERS:
            raise ValueError(f"Invalid tier: {v}")
        return v

    @validator("moat_primary")
    def validate_moat_primary(cls, v):
        if v not in VALID_MOAT_TYPES:
            raise ValueError(f"Invalid primary moat type: {v}")
        return v

    @validator("rerate_state")
    def validate_rerate_state(cls, v):
        if v not in VALID_RERATE_STATES:
            raise ValueError(f"Invalid rerate state: {v}")
        return v

    @validator("tier_reasoning")
    def validate_non_empty_reasoning(cls, v):
        if not v or not v.strip():
            raise ValueError("tier_reasoning cannot be empty")
        return v

class P1Step1Company(BaseModel):
    ticker: str
    company_name: str
    market: str
    p0_theme_id: str
    p0_subtheme_id: str
    chain_position: str
    inclusion_reason: str  # 為什麼非它不可
    confidence: float  # 0-1

class P1Step1Output(BaseModel):
    companies: List[P1Step1Company]
    total_count: int
    market_distribution: Dict[str, int]  # {"US": int, "TW": int, "JP": int}
    low_confidence_candidates: List[str]  # 低信心候選的 ticker 列表

class P1Step2Output(ConstitutionalOutput):
    """
    SSOT §5.6: P1 Final Output.
    """
    companies: List[P1CompanyEntry]
    tier_distribution: Dict[str, int]  # {"S": int, "A": int, "B": int, "X": int}
    total_count: int
    snapshot_id: str
    version_chain_id: str
    run_id: str
    created_at: str

class EvidenceItem(BaseModel):
    content: str  # 原封不動的原文
    page_number: Optional[int]
    source_document: str  # 例如 "10-K 2024"
    section: str  # 例如 "Business Description"

class P1FinancialReportExtraction(BaseModel):
    ticker: str
    extraction_status: str  # "PENDING" | "EXTRACTED" | "FAILED"
    p1_industry_evidence: List[EvidenceItem]  # → P1-2 Tiering
    p2_financial_evidence: List[EvidenceItem]  # → P2-1 / P2-2
    p2_5_institutional_evidence: List[EvidenceItem]  # → P2.5
