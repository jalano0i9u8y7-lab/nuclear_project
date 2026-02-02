/**
 * P5 Weekly 決策框架 - 三層架構
 * 
 * Layer 1: 硬約束（程式強制執行，AI 無法繞過）
 * Layer 2: 軟引導（建議基準，AI 可調整 ±15%）
 * Layer 3: 自由空間（AI 完全自主的推理空間）
 * 
 * @version V8.19
 * @date 2026-01-25
 */

/**
 * Layer 1: 硬約束（程式強制執行，AI 無法繞過）
 */
const HARD_CONSTRAINTS = {
  systemLevel: {
    lateStageWithHighRisk: {
      condition: (context) => 
        context.p0_7_time_position === 'LATE' && 
        context.p0_7_turning_point_risk === 'HIGH',
      enforcement: {
        forbid_cat3: true,
        max_U: 0.50,
        max_position_cap: 0.05
      }
    },
    defcon1: {
      condition: (context) => context.defcon_level === 1,
      enforcement: {
        forbid_new_buy: true,
        max_U: 0.30,
        force_defensive: true
      }
    },
    emergencyExit: {
      condition: (context) => context.p6_emergency_exit_triggered === true,
      enforcement: {
        halt_all_buy: true,
        execute_exit_plan: true
      }
    }
  },
  industryLevel: {
    divergenceAlert: {
      condition: (context) => context.p0_5_divergence_alert === true,
      enforcement: {
        risk_overlay_level_min: 2,
        downgrade_cat2_cat3: true
      }
    },
    industryPhaseOut: {
      condition: (context) => context.p0_industry_advantage_lost === true,
      enforcement: {
        phase_out_mode: true,
        no_new_position: true,
        weekly_reduce_rate: 0.10
      }
    }
  },
  stockLevel: {
    insiderSelling: {
      condition: (context) => 
        context.p2_5_insider_selling_alert === true ||
        context.p2_5_abnormal_13f_distribution === true,
      enforcement: {
        force_escalation: true,
        max_position_cap: 0.03
      }
    },
    safetyLock: {
      condition: (context) => context.safety_lock_active === true,
      enforcement: {
        max_position_cap: (context) => context.safety_lock_max_exposure || 0.30
      }
    }
  },
  mathematicalBounds: {
    weights: {
      validator: (weights) => {
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        return Math.abs(sum - 1.0) <= 0.01;
      },
      errorMessage: "權重總和必須 = 1.0 (±0.01)"
    },
    positionCap: {
      validator: (cap) => cap >= 0.01 && cap <= 0.20,
      errorMessage: "max_position_cap 必須在 [0.01, 0.20] 範圍內"
    },
    buyLadder: {
      validator: (ladder, currentPrice) => {
        return ladder.buy1 > 0 &&
               ladder.buy1 > ladder.buy2 &&
               ladder.buy2 > ladder.buy3 &&
               ladder.buy3 > 0 &&
               ladder.buy1 <= currentPrice * 1.05;
      },
      errorMessage: "buy_ladder 必須滿足：buy1 > buy2 > buy3 > 0"
    }
  }
};

/**
 * Layer 2: 軟引導（建議基準，AI 可調整 ±15%）
 */
const SOFT_GUIDELINES = {
  baselineWeights: {
    fundamental: 0.30,
    chips: 0.25,
    tech: 0.25,
    macro: 0.10,
    sentiment: 0.10
  },
  allowedDeviation: 0.15,
  scenarioAdjustments: {
    earningsWindow: {
      description: "財報前 1-2 週",
      condition: (context) => context.earnings_in_days && context.earnings_in_days <= 14,
      suggestedWeights: { chips: "+0.10", fundamental: "-0.05", tech: "-0.05" }
    },
    breakoutPattern: {
      description: "突破型態",
      condition: (context) => context.p3_cat === 'Cat3' && context.p3_volume_surge === true,
      suggestedWeights: { tech: "+0.15", chips: "+0.05", fundamental: "-0.10", sentiment: "-0.10" }
    },
    highVolatility: {
      description: "高波動環境（VIX > 25）",
      condition: (context) => context.vix && context.vix > 25,
      suggestedWeights: { macro: "+0.10", sentiment: "-0.05", tech: "-0.05" }
    },
    milestoneVerification: {
      description: "P2 Milestone 驗證期",
      condition: (context) => context.p2_milestone_pending === true,
      suggestedWeights: { fundamental: "+0.15", chips: "-0.10", tech: "-0.05" }
    }
  },
  priorityRules: [
    "系統級風險訊號（P0.7, P0.5）優先於個股訊號",
    "籌碼面與基本面衝突時，優先相信籌碼",
    "技術面與基本面衝突時，短期看技術，長期看基本面",
    "新聞情緒與數據衝突時，優先相信數據"
  ]
};

/**
 * 執行硬約束檢查
 */
function enforceHardConstraints(context, aiOutput) {
  const violations = [];
  const enforcedAdjustments = {};
  
  for (const [name, constraint] of Object.entries(HARD_CONSTRAINTS.systemLevel)) {
    if (constraint.condition(context)) {
      Object.assign(enforcedAdjustments, constraint.enforcement);
      violations.push({ level: 'SYSTEM', constraint: name, enforcement: constraint.enforcement });
      Logger.log(`[Hard Constraint] 系統級約束觸發：${name}`);
    }
  }
  
  for (const [name, constraint] of Object.entries(HARD_CONSTRAINTS.industryLevel)) {
    if (constraint.condition(context)) {
      Object.assign(enforcedAdjustments, constraint.enforcement);
      violations.push({ level: 'INDUSTRY', constraint: name, enforcement: constraint.enforcement });
      Logger.log(`[Hard Constraint] 產業級約束觸發：${name}`);
    }
  }
  
  for (const [name, constraint] of Object.entries(HARD_CONSTRAINTS.stockLevel)) {
    if (constraint.condition(context)) {
      const enforcement = typeof constraint.enforcement === 'function'
        ? constraint.enforcement(context) : constraint.enforcement;
      Object.assign(enforcedAdjustments, enforcement);
      violations.push({ level: 'STOCK', constraint: name, enforcement });
      Logger.log(`[Hard Constraint] 個股級約束觸發：${name}`);
    }
  }
  
  for (const [name, bound] of Object.entries(HARD_CONSTRAINTS.mathematicalBounds)) {
    let isValid = true;
    if (name === 'weights' && aiOutput.factor_weights) {
      isValid = bound.validator(aiOutput.factor_weights);
    } else if (name === 'positionCap' && aiOutput.max_position_cap) {
      isValid = bound.validator(aiOutput.max_position_cap);
    } else if (name === 'buyLadder' && aiOutput.buy_ladder && context.current_price) {
      isValid = bound.validator(aiOutput.buy_ladder, context.current_price);
    }
    if (!isValid) {
      violations.push({ level: 'MATHEMATICAL', constraint: name, error: bound.errorMessage });
      Logger.log(`[Hard Constraint] 數學邊界違反：${name}`);
    }
  }
  
  return { hasViolations: violations.length > 0, violations, enforcedAdjustments };
}

/**
 * 應用硬約束到 AI 輸出
 */
function applyHardConstraints(aiOutput, enforcedAdjustments, context) {
  const adjustedOutput = {...aiOutput};
  const overrides = [];
  
  if (enforcedAdjustments.forbid_cat3 && adjustedOutput.cat === 'Cat3') {
    adjustedOutput.cat = 'Cat2';
    adjustedOutput.constraint_override = 'LATE + HIGH 禁止 Cat3，降級為 Cat2';
    overrides.push('cat: Cat3 → Cat2');
  }
  if (enforcedAdjustments.max_U) {
    adjustedOutput.max_U_override = enforcedAdjustments.max_U;
    adjustedOutput.max_U = Math.min(adjustedOutput.max_U || 1.0, enforcedAdjustments.max_U);
    overrides.push('max_U: ' + enforcedAdjustments.max_U);
  }
  if (enforcedAdjustments.max_position_cap) {
    const cap = typeof enforcedAdjustments.max_position_cap === 'function'
      ? enforcedAdjustments.max_position_cap(context) : enforcedAdjustments.max_position_cap;
    adjustedOutput.max_position_cap = Math.min(adjustedOutput.max_position_cap || 0.15, cap);
    overrides.push('max_position_cap: ' + cap);
  }
  if (enforcedAdjustments.force_escalation) {
    adjustedOutput.escalation_forced = true;
    adjustedOutput.escalation_reason = '籌碼面異常警報觸發強制升級';
    overrides.push('escalation: FORCED');
  }
  if (enforcedAdjustments.halt_all_buy) {
    adjustedOutput.recommended_action = 'HOLD';
    adjustedOutput.new_buy_halted = true;
    overrides.push('action: HOLD');
  }
  if (overrides.length > 0) {
    adjustedOutput.constraint_overrides = overrides;
  }
  return adjustedOutput;
}

/** level 對應（用於 Prompt） */
const LEVEL_MAP = { systemLevel: 'SYSTEM', industryLevel: 'INDUSTRY', stockLevel: 'STOCK' };

/**
 * 獲取觸發的硬約束列表（用於 Prompt）
 */
function getTriggeredConstraints(context) {
  const triggered = [];
  for (const [level, constraints] of Object.entries(HARD_CONSTRAINTS)) {
    if (level === 'mathematicalBounds') continue;
    const levelTag = LEVEL_MAP[level] || level.toUpperCase();
    for (const [name, constraint] of Object.entries(constraints)) {
      if (constraint.condition && constraint.condition(context)) {
        triggered.push({ level: levelTag, name, enforcement: constraint.enforcement });
      }
    }
  }
  return triggered;
}

/**
 * 獲取情境調整建議
 */
function getScenarioSuggestions(context) {
  const suggestions = [];
  for (const [name, scenario] of Object.entries(SOFT_GUIDELINES.scenarioAdjustments)) {
    if (scenario.condition(context)) {
      suggestions.push({ name, description: scenario.description, suggestedWeights: scenario.suggestedWeights });
    }
  }
  return suggestions;
}
