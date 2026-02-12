
from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from nuclear.models.constitutional import ConstitutionalOutput

class IndustryPlaybook(BaseModel):
    nature: str = Field(..., description="e.g. Infrastructure_Cycle")
    winning_pattern: str = Field(..., description="e.g. DSP_Integration")

class ChairmanLens(BaseModel):
    vision_check: str
    red_flags: List[str]

class IndustryLogicCard(BaseModel):
    industry_name: str
    logic_version: str  # 例如 "V12.0_2026Q1"
    industry_playbook: IndustryPlaybook
    industry_type: str  # "cyclical" | "structural_growth" | "hybrid"
    primary_truth_metrics: List[str]
    forbidden_metrics: List[str]
    recommended_alternatives: Dict[str, str]  # 例如 {"Interest_Coverage": "Tier_1_Capital_Ratio"}
    cfo_questions_top10: List[str]
    chairman_forward_view_lens: ChairmanLens
    conviction_level: str  # "ULTRA_HIGH" | "HIGH" | "MEDIUM" | "LOW"
    conviction_reasoning: str
    conviction_confidence: float  # 0-1

class P0ThemeOutput(BaseModel):
    theme_id: str
    subtheme_id: str
    analysis_type: str  # "ENG" | "STRUCT"
    problem_one_liner: str  # 工程/結構問題一句話
    failure_mode: str  # 不用會怎樣
    no_alternative_reason: str  # 為何不可替代
    convergence_evidence: str  # 收斂證據
    long_term_time_window: str  # 3-10 年窗口
    rejected: bool  # 是否被否決
    rejection_reason: Optional[str] = None # 否決原因

class P0Output(ConstitutionalOutput):
    """
    P0 Industry Engineering Analysis Output.
    Inherits from ConstitutionalOutput for Article 1 compliance.
    """
    themes: List[P0ThemeOutput]
    industry_logic_cards: List[IndustryLogicCard]
    validation_status: str  # "PASSED" | "PENDING" | "FAILED"
    validation_questions: List[str]  # 時效性防呆問題
    snapshot_id: str
    version_chain_id: str
    run_id: str
    created_at: str
