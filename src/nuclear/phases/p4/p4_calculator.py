from typing import List, Dict, Optional, Any
from .p4_schemas import P4Output, UComponents, P4StockAllocation, WIdealComponents, CatAllocation, SectorExposure, PyramidDetails

# --- 5.2.2 Constants & Sub-functions ---

# §9.4.1 Base Weight
BASE_WEIGHT = {
    ("S", "CORE"): 0.12,
    ("A", "CORE"): 0.08,
    ("B", "CORE"): 0.04,
    ("X", "CORE"): 0.00,
    ("A", "FRONTIER"): 0.05,
    ("B", "FRONTIER"): 0.03,
    ("X", "FRONTIER"): 0.02,
    ("A", "EMERGING_STAR"): 0.06,
}

# §9.4.2 Role Multiplier
ROLE_MULTIPLIER = {
    "A_MOMENTUM_COMPOUNDER": 1.3,
    "B_EARLY_DIAMOND": 1.15,
    "C_FRONTIER_OPTIONALITY": 0.85,
    "D_SAFE_BUT_STAGNANT": 0.7,
    "E_HOT_BUT_FRAGILE": 0.0,
    "F_REJECT_WATCHLIST": 0.0,
}

# §9.4.3 Risk Modifier
RISK_MODIFIER = {
    "SAFE": 1.0,
    "CAUTION": 0.8,
    "DANGER": 0.0,
}

# §9.4.6 Growth Modifier
GROWTH_MODIFIER = {"S": 1.10, "A": 1.05, "B": 1.00, "X": 0.93}

# §9.4.7 Future Modifier
FUTURE_MODIFIER = {"S": 1.12, "A": 1.06, "B": 1.00, "X": 0.90}

# §9.4.11 Rerate Modifier
RERATE_MODIFIER = {"R3": 0.05, "R2": 0.03, "R1": 0.0, "R0": -0.05}

def compute_sm_modifier(smart_money_score: float, direction: str, insider_alert: bool) -> float:
    if insider_alert:
        return 0.0
    if smart_money_score >= 80 and direction == "ACCUMULATION":
        return 1.15
    elif smart_money_score >= 50:
        return 1.0
    elif smart_money_score >= 30:
        return 0.85
    else:
        return 0.7

def compute_conviction_boost(mispricing_type: List[str], conviction_level: str, narrative_heavy: bool) -> float:
    if narrative_heavy:
        return 0.7
    
    boost = 1.0
    if "structural_repricing" in mispricing_type:
        boost = 1.25 # Base boost for structural_repricing
    elif "fairly_priced" in mispricing_type:
        boost = 1.0
    elif "timing_mismatch" in mispricing_type or "cycle_misread" in mispricing_type:
        boost = 0.9
    elif "narrative_oversimplification" in mispricing_type or "tail_risk_underpricing" in mispricing_type:
        boost = 0.8
    elif "bubble" in mispricing_type:
        boost = 0.5
    
    # Alpha Amplifier conviction 分級（§9.4.5）
    if "structural_repricing" in mispricing_type:
        if conviction_level == "ULTRA_HIGH":
            pass # 100% 效果
        elif conviction_level == "HIGH":
            boost = 1.0 + (boost - 1.0) * 0.75  # 75% 效果
        elif conviction_level == "MEDIUM":
            boost = 1.0 + (boost - 1.0) * 0.40  # 40% 效果
    
    return boost

def compute_ol_boost(ol_inflection: Dict, future_grade: str) -> float:
    if not ol_inflection.get("present"):
        return 1.0
    conf = ol_inflection.get("confidence", 0)
    if future_grade in ["X"]:
        return 1.0
    if conf > 0.7 and future_grade in ["S", "A", "B"]:
        return 1.25
    elif conf >= 0.5 and future_grade in ["S", "A", "B"]:
        return 1.10
    return 1.0

def compute_risk_combined(risk_modifier: float, valuation_brake: float, future_grade: str) -> float:
    raw = risk_modifier * valuation_brake
    floors = {"S": 0.50, "A": 0.40, "B": 0.30}
    floor = floors.get(future_grade, 0.0)
    return max(raw, floor)

def compute_w_ideal(inputs: Dict) -> Dict:
    tier = inputs["tier"]
    track = inputs["track_type"]
    
    base = BASE_WEIGHT.get((tier, track), 0.0)
    role = ROLE_MULTIPLIER.get(inputs["position_role"], 0.0)
    risk = RISK_MODIFIER.get(inputs["risk_profile"], 0.0)
    sm = compute_sm_modifier(inputs["smart_money_score"], inputs["smart_money_direction"], inputs["insider_alert"])
    conviction = compute_conviction_boost(inputs["mispricing_type"], inputs["conviction_level"], inputs.get("narrative_heavy", False))
    growth = GROWTH_MODIFIER.get(inputs["growth_grade"], 1.0)
    future = FUTURE_MODIFIER.get(inputs["future_breakout_grade"], 1.0)
    ol = compute_ol_boost(inputs["operating_leverage_inflection"], inputs["future_breakout_grade"])
    rerate = RERATE_MODIFIER.get(inputs["rerate_state"], 0.0)
    
    raw_positive = role * sm * conviction * growth * future * ol
    positive_clip = max(0.5, min(raw_positive, 2.2))
    
    w_raw = base * positive_clip + rerate
    
    valuation_brake = inputs.get("valuation_brake", 1.0)
    risk_combined = compute_risk_combined(risk, valuation_brake, inputs["future_breakout_grade"])
    
    w_ideal = w_raw * risk_combined
    
    return {
        "W_ideal": w_ideal,
        "components": {
            "base_weight": base,
            "role_multiplier": role,
            "risk_modifier": risk,
            "sm_modifier": sm,
            "conviction_boost": conviction,
            "growth_modifier": growth,
            "future_modifier": future,
            "ol_boost": ol,
            "rerate_modifier": rerate,
            "valuation_brake": valuation_brake,
            "positive_clip": positive_clip,
            "risk_combined": risk_combined,
            "risk_floor": {"S": 0.50, "A": 0.40, "B": 0.30}.get(inputs["future_breakout_grade"], 0.0),
        }
    }

# --- 5.2.1 U Value ---

def compute_u_final(
    p07_time_position: str,
    p07_turning_point_risk: str,
    market_regime: str,
    defcon_level: int,
    identity_drift: bool,
    offensive_mode_active: bool
) -> Dict:
    U_base = 0.65
    U_max = 1.0
    components = {"base": U_base}
    
    if p07_time_position == "LATE" and market_regime in ["BULL", "BULL_CONFIRMED", "STRONG_MOMENTUM"]:
        U_max = min(U_max, 0.60)
        components["p07_cap"] = 0.60
    elif p07_time_position == "LATE" and market_regime in ["BEAR", "BEAR_SIGNAL"]:
        U_max = min(U_max, 0.40)
        components["p07_cap"] = 0.40
    if p07_turning_point_risk == "HIGH":
        tp_max = 0.50
        if tp_max < U_max:
            U_max = tp_max
            components["p07_cap"] = 0.50
    
    DEFCON_U_MACRO = {1: 0.20, 2: 0.40, 3: 0.65, 4: 0.80, 5: 0.90}
    if defcon_level <= 2:
        defcon_cap = DEFCON_U_MACRO[defcon_level]
        U_max = min(U_max, defcon_cap)
        components["defcon_cap"] = defcon_cap
    
    if market_regime == "CRISIS":
        U_max = min(U_max, 0.20)
        components["climate_cap"] = 0.20
    elif market_regime == "BEAR_SIGNAL":
        U_max = min(U_max, 0.40)
        components["climate_cap"] = 0.40
    
    if market_regime in ["BULL_CONFIRMED"]:
        U_base = 0.75
    elif market_regime in ["STRONG_MOMENTUM"]:
        U_base = 0.80
    
    if offensive_mode_active:
        components["offensive_boost"] = 0.90 # Note: cap still applies in min() later
    
    if identity_drift:
        U_max = U_max * 0.7
        components["drift_adj"] = U_max
    
    U_final = min(U_base, U_max)
    
    return {"U_final": U_final, "U_components": components}

# --- 5.2.3 Cat Matrix ---

CAT_MATRIX = {
    1: {"buy1": 0.10, "buy2": 0.30, "buy3": 0.60, "sell": 0.00},
    2: {"buy1": 0.30, "buy2": 0.50, "buy3": 0.20, "sell": 0.00},
    3: {"buy1": 0.00, "buy2": 0.00, "buy3": 0.00, "sell": 0.00},
    4: {"buy1": 0.00, "buy2": 0.20, "buy3": 0.30, "sell": 0.50},
    5: {"buy1": 0.00, "buy2": 0.00, "buy3": 0.00, "sell": 1.00},
}

def apply_cat_role_adjustment(cat_alloc: Dict, position_role: str, cat: int) -> Dict:
    result = dict(cat_alloc)
    if position_role == "A_MOMENTUM_COMPOUNDER" and cat == 2:
        result["buy1"] *= 1.2
    elif position_role == "B_EARLY_DIAMOND" and cat == 1:
        result["buy3"] *= 1.2
    elif position_role == "C_FRONTIER_OPTIONALITY":
        result["buy1"] *= 0.5
        result["buy2"] *= 0.5
        result["buy3"] *= 0.5
    elif position_role == "D_SAFE_BUT_STAGNANT" and cat == 4:
        result["buy3"] *= 1.2
    return result

def apply_risk_overlay_to_cat(cat: int, risk_overlay_level: int) -> int:
    if risk_overlay_level >= 3 and cat == 3:
        return -1
    if risk_overlay_level >= 2 and cat == 2:
        return 1
    return cat

# --- 5.2.4 Risk Locks ---

def apply_sector_lock(allocations: List[Dict], sector_limit: float = 0.35) -> List[Dict]:
    # Stub implementation as per instructions
    return allocations

def compute_single_max(conviction_level: str) -> float:
    limits = {"ULTRA_HIGH": 0.30, "HIGH": 0.20, "MEDIUM": 0.12, "LOW": 0.08}
    return limits.get(conviction_level, 0.08)

def compute_frontier_max(future_grade: str, conviction_level: str, runway: int, has_institutional_flow: bool) -> float:
    if future_grade == "S" and conviction_level in ["ULTRA_HIGH", "HIGH"] and runway >= 6:
        return 0.04
    if runway >= 3 and has_institutional_flow:
        return 0.03
    return 0.02

def apply_floor_protection(w_ideal: float, position_role: str, future_grade: str, risk_profile: str) -> float:
    if risk_profile == "DANGER":
        return w_ideal
    if position_role == "B_EARLY_DIAMOND" and future_grade in ["S", "A"]:
        return max(w_ideal, 0.015)
    if position_role == "C_FRONTIER_OPTIONALITY" and future_grade in ["S", "A"]:
        return max(w_ideal, 0.008)
    return w_ideal

# --- 5.2.5 Offensive Mechanisms ---

def check_offensive_mode(
    defcon_level: int,
    p07_time_position: str,
    market_regime: str,
    learning_failure_rate: float,
    p07_loop_dominance: str,
    alpha_exempt_count: int
) -> Dict:
    active = False
    reason = ""
    
    min_defcon = 4
    if p07_loop_dominance == "REINFORCING":
        min_defcon = 3
    
    if (defcon_level >= min_defcon and
        p07_time_position in ["EARLY", "MID"] and
        market_regime in ["BULL_CONFIRMED", "STRONG_MOMENTUM"] and
        learning_failure_rate < 0.30):
        active = True
        reason = "Standard Bull Accelerator"
    
    if (p07_time_position == "LATE" and
        market_regime in ["BULL", "BULL_CONFIRMED"] and
        alpha_exempt_count >= 2 and
        defcon_level >= 3):
        active = True
        reason = "LATE Special with Alpha Exemption"
    
    return {"active": active, "reason": reason}

def check_alpha_amplifier(stock: Dict, offensive_active: bool) -> Dict:
    if not offensive_active:
        return {"eligible": False}
    
    if (stock["risk_profile"] == "SAFE" and
        stock["growth_grade"] in ["S", "A"] and
        stock["future_breakout_grade"] in ["S", "A"] and
        stock["smart_money_direction"] == "ACCUMULATION" and
        "structural_repricing" in stock.get("mispricing_type", []) and
        stock["conviction_level"] in ["ULTRA_HIGH", "HIGH"]):
        
        multipliers = {"ULTRA_HIGH": 1.2, "HIGH": 1.15, "MEDIUM": 1.08}
        return {
            "eligible": True,
            "multiplier": multipliers.get(stock["conviction_level"], 1.0)
        }
    return {"eligible": False}

# --- 5.2.6 Full Calculation Flow ---

def run_p4_calculation(
    stocks: List[Dict],
    p07_output: Dict,
    market_regime: str,
    defcon_level: int,
    identity_drift: bool,
    learning_state: Dict,
) -> P4Output:
    offensive = check_offensive_mode(
        defcon_level, p07_output["time_position"], market_regime,
        learning_state.get("failure_rate", 0.0), p07_output["loop_dominance"],
        sum(1 for s in stocks if s.get("alpha_exempt"))
    )
    
    u_result = compute_u_final(
        p07_output["time_position"], p07_output["turning_point_risk"],
        market_regime, defcon_level, identity_drift, offensive["active"]
    )
    
    allocations = []
    for stock in stocks:
        w = compute_w_ideal(stock)
        
        amp = check_alpha_amplifier(stock, offensive["active"])
        if amp["eligible"]:
            w["W_ideal"] *= amp["multiplier"]
        
        single_max = compute_single_max(stock["conviction_level"])
        if stock["track_type"] == "FRONTIER":
            frontier_max = compute_frontier_max(
                stock["future_breakout_grade"], stock["conviction_level"],
                stock.get("runway", 0), stock.get("institutional_flow", False)
            )
            single_max = min(single_max, frontier_max)
        
        w_final = apply_floor_protection(
            w["W_ideal"], stock["position_role"],
            stock["future_breakout_grade"], stock["risk_profile"]
        )
        w_final = min(w_final, single_max)
        
        allocations.append({
            "ticker": stock["ticker"],
            "W_ideal": w_final,
            "W_ideal_components": w["components"],
            "single_max": single_max,
            "stock": stock,
        })
    
    total = sum(a["W_ideal"] for a in allocations)
    if total > u_result["U_final"] and total > 0:
        scale = u_result["U_final"] / total
        for a in allocations:
            a["W_ideal"] = min(a["W_ideal"] * scale, a["single_max"])
    
    allocations = apply_sector_lock(allocations)
    
    frontier_total = sum(a["W_ideal"] for a in allocations if a["stock"]["track_type"] == "FRONTIER")
    if frontier_total > 0.20:
        frontier_scale = 0.20 / frontier_total
        for a in allocations:
            if a["stock"]["track_type"] == "FRONTIER":
                a["W_ideal"] *= frontier_scale
    
    stock_allocs = []
    for a in allocations:
        cat = a["stock"]["cat"]
        risk_overlay = a["stock"].get("risk_overlay_level", 0)
        effective_cat = apply_risk_overlay_to_cat(cat, risk_overlay)
        
        if effective_cat == -1:
            cat_alloc_dict = {"buy1": 0.0, "buy2": 0.0, "buy3": 0.0, "sell": 0.0}
        elif effective_cat in CAT_MATRIX:
            cat_alloc_dict = dict(CAT_MATRIX[effective_cat])
            cat_alloc_dict = apply_cat_role_adjustment(cat_alloc_dict, a["stock"]["position_role"], effective_cat)
        else:
            cat_alloc_dict = {"buy1": 0.0, "buy2": 0.0, "buy3": 0.0, "sell": 0.0}
        
        if risk_overlay == 1 and effective_cat == 2:
            cat_alloc_dict["buy1"] *= 0.9
            
        stock_allocs.append(P4StockAllocation(
            ticker=a["ticker"],
            W_ideal=a["W_ideal"],
            W_ideal_components=WIdealComponents(**a["W_ideal_components"]),
            W_now=0.0,
            delta=a["W_ideal"],
            cat_allocation=CatAllocation(
                buy1_pct=cat_alloc_dict.get("buy1", 0.0),
                buy2_pct=cat_alloc_dict.get("buy2", 0.0),
                buy3_pct=cat_alloc_dict.get("buy3", 0.0),
                sell_pct=cat_alloc_dict.get("sell", 0.0)
            ),
            single_max=a["single_max"],
            pyramid_eligible=False,
            oversold_recovery=False,
            alpha_exempt=a["stock"].get("alpha_exempt", False)
        ))
    
    return P4Output(
        U_final=u_result["U_final"],
        U_components=UComponents(**u_result["U_components"]),
        offensive_mode="ACTIVE" if offensive["active"] else "INACTIVE",
        defcon_level=defcon_level,
        per_stock=stock_allocs,
        sector_exposure=[],
        frontier_total=frontier_total,
        snapshot_id="stub",
        version_chain_id="stub"
    )
