
from typing import Dict, List, Optional
import structlog
from nuclear.phases.p1.p1_schemas import P1FinancialReportExtraction, EvidenceItem
from nuclear.phases.p1.p1_extraction_prompts import build_extraction_prompt

log = structlog.get_logger()

def run_extraction(ticker: str, market: str, run_id: str = "default") -> P1FinancialReportExtraction:
    """
    SSOT §5.3: P1-1.5 Financial Report Extraction pipeline.
    Routing evidence to P1, P2, and P2.5.
    """
    log.info("Starting report extraction", ticker=ticker, market=market)

    # 1. Fetch Report (Stub)
    # SEC for US, Drive for TW/JP
    doc_text = _stub_fetch_report(ticker, market)
    
    if not doc_text:
        return P1FinancialReportExtraction(
            ticker=ticker,
            extraction_status="FAILED",
            p1_industry_evidence=[],
            p2_financial_evidence=[],
            p2_5_institutional_evidence=[]
        )

    # 2. Extract with Gemini Flash 3.0 (Stub)
    raw_extraction = _stub_gemini_flash_extraction(ticker, market)
    
    # 3. Validation & Assembly
    p1_ev = [EvidenceItem(**i) for i in raw_extraction["p1_industry_evidence"]]
    p2_ev = [EvidenceItem(**i) for i in raw_extraction["p2_financial_evidence"]]
    p25_ev = [EvidenceItem(**i) for i in raw_extraction["p2_5_institutional_evidence"]]
    
    status = "EXTRACTED" if (p1_ev or p2_ev or p25_ev) else "INCOMPLETE_EXTRACTION"
    
    # SSOT §5.3.5 Routing logic (Informational Comment)
    # ✅ P1-2 (Tiering) reads -> p1_industry_evidence
    # ✅ P2 (Fundamental) reads -> p2_financial_evidence
    # ✅ P2.5 (Institutional) reads -> p2_5_institutional_evidence

    res = P1FinancialReportExtraction(
        ticker=ticker,
        extraction_status=status,
        p1_industry_evidence=p1_ev,
        p2_financial_evidence=p2_ev,
        p2_5_institutional_evidence=p25_ev
    )
    
    log.info("Extraction completed", ticker=ticker, status=status)
    return res

def _stub_fetch_report(ticker: str, market: str) -> Optional[str]:
    """Stub for SEC/Drive fetching."""
    return "Sample report text for " + ticker

def _stub_gemini_flash_extraction(ticker: str, market: str) -> Dict:
    """Stub for Flash three-field extraction."""
    return {
        "p1_industry_evidence": [
            {"content": f"{ticker} dominates the high-end GPU market with 80%+ share.", "page_number": 12, "source_document": "10-K 2024", "section": "Business"}
        ],
        "p2_financial_evidence": [
            {"content": "R&D expenses increased 20% to support next-gen architecture.", "page_number": 45, "source_document": "10-K 2024", "section": "MD&A"}
        ],
        "p2_5_institutional_evidence": [
            {"content": "BlackRock holds 7% stake as of year end.", "page_number": 88, "source_document": "10-K 2024", "section": "Ownership"}
        ]
    }
