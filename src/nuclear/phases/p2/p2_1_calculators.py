
from typing import Dict, Any, Optional
from nuclear.phases.p2.p2_schemas import OperatingLeverageInflection

def compute_risk_profile(financial_data: Dict[str, Any], track_type: str = "CORE") -> Dict[str, Any]:
    """
    SSOT §6.2.2 ④ Risk Profile 三級判定（程式計算）
    
    SAFE: CFO > 0 且 Interest Coverage > 2.0 且無重大異質性風險
    CAUTION: CFO > 0 但波動、或 IC 1.5-2.0
    DANGER: CFO < 0（連續 2 季）、或 IC < 1.5、或 Net Debt/EBITDA > 5
    
    Frontier 例外（§6.2.2 ④）：
    - FRONTIER + Runway >= 4 季 → DANGER 不觸發禁止新倉，標記 FRONTIER_CAUTION + max_position_cap = 2%
    - FRONTIER + Runway < 4 季 → 維持 DANGER
    """
    cfo = financial_data.get("cfo", 0)
    interest_coverage = financial_data.get("interest_coverage", 3.0)
    net_debt_ebitda = financial_data.get("net_debt_ebitda", 1.0)
    cfo_consecutive_negative = financial_data.get("cfo_consecutive_negative_quarters", 0)
    
    if cfo_consecutive_negative >= 2 or interest_coverage < 1.5 or net_debt_ebitda > 5:
        profile = "DANGER"
    elif cfo > 0 and interest_coverage > 2.0:
        profile = "SAFE"
    else:
        profile = "CAUTION"
    
    # Frontier 例外
    frontier_caution = False
    max_position_cap = None
    if track_type == "FRONTIER" and profile == "DANGER":
        runway = financial_data.get("runway_quarters", 0)
        if runway >= 4:
            frontier_caution = True
            max_position_cap = 0.02
    
    return {
        "risk_profile": profile,
        "frontier_caution": frontier_caution,
        "max_position_cap": max_position_cap,
    }

def compute_growth_sub_scores(financial_data: Dict[str, Any], peer_data: Dict[str, Any], track_type: str = "CORE") -> Dict[str, Any]:
    """
    SSOT §6.2.2 ③ Growth Quality 子分項計算（程式計算）
    """
    # Stub: Returns reasonable mock scores based on input if possible, otherwise defaults
    growth_rate = financial_data.get("growth_rate", 65.0)
    cash_conversion = financial_data.get("cash_conversion", 60.0)
    
    growth_low_quality_flag = False
    if track_type == "CORE":
        if cash_conversion < 40 and growth_rate > 70:
            growth_low_quality_flag = True
            
    res = {
        "growth_rate_score": growth_rate,
        "growth_consistency_score": financial_data.get("growth_consistency", 70.0),
        "operating_leverage_score": financial_data.get("operating_leverage", 55.0),
        "cash_conversion_score": cash_conversion,
        "growth_low_quality_flag": growth_low_quality_flag,
        "frontier_growth_scores": None,
    }
    
    if track_type == "FRONTIER":
        res["frontier_growth_scores"] = {
            "revenue_growth": growth_rate,
            "rnd_efficiency": financial_data.get("rnd_efficiency", 80.0),
            "revenue_retention": financial_data.get("revenue_retention", 110.0),
            "survival_score": financial_data.get("survival_score", 75.0)
        }
        
    return res

def compute_fpe(financial_data: Dict[str, Any], peer_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    SSOT §6.2.2 ⑤ 與 §3.4 雙 FPE 制度
    """
    fpe_a = financial_data.get("fpe_a")
    fpe_b = financial_data.get("fpe_b")
    
    fpe_divergence = None
    if fpe_a is not None and fpe_b is not None and fpe_b != 0:
        fpe_divergence = (fpe_a - fpe_b) / fpe_b
    
    return {
        "fpe_a": fpe_a,
        "fpe_b": fpe_b,
        "fpe_divergence": fpe_divergence,
    }

def compute_operating_leverage_inflection(financial_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    SSOT §6.2.2 ③ 營運槓桿拐點觀測
    """
    # Stub logic for inflection
    rev_growth = financial_data.get("revenue_growth_trend", [])
    opex_ratio = financial_data.get("opex_ratio_trend", [])
    
    present = False
    evidence = "No clear inflection detected."
    confidence = 0.0
    
    if len(rev_growth) >= 2 and all(g > 0 for g in rev_growth[-2:]):
        if len(opex_ratio) >= 2 and opex_ratio[-1] <= opex_ratio[-2]:
            present = True
            evidence = "Revenue growth sustained with declining or flat Opex ratio."
            confidence = 0.8
            
    return {"present": present, "evidence": evidence, "confidence": confidence}
