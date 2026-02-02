/**
 * ✅ P5-B Validator（程式化檢查）
 * 
 * 取代 AI 審查者，使用程式化檢查確保 P5-B 輸出符合規範
 * 
 * @version SSOT V8.16
 * @date 2026-01-19
 */

// ==========================================
// Validator 配置
// ==========================================

const P5_B_VALIDATOR_CONFIG = {
  // Schema 驗證配置
  REQUIRED_FIELDS: [
    "state_vector",
    "parameter_adjustment_vector",
    "escalation_score"
  ],
  
  // Range 驗證配置（硬寫死上下界）
  RANGES: {
    "escalation_score": { min: 0.0, max: 1.0 },
    "state_vector.trend_integrity": { min: 0.0, max: 1.0 },
    "state_vector.momentum_shift": { min: -1.0, max: 1.0 },
    "state_vector.distribution_risk": { min: 0.0, max: 1.0 },
    "state_vector.volatility_regime_change": { min: 0.0, max: 1.0 },
    "parameter_adjustment_vector.buy_bias": { min: -2.0, max: 2.0 },
    "parameter_adjustment_vector.sell_bias": { min: -2.0, max: 2.0 },
    "parameter_adjustment_vector.ladder_spacing_adjustment": { min: -0.5, max: 0.5 },  // ±50%
    "parameter_adjustment_vector.trailing_stop_tightness": { min: -0.5, max: 0.5 },  // ±50%
    "parameter_adjustment_vector.max_position_cap_override": { min: 0.0, max: 1.0 }  // 0-100%
  },
  
  // Enum 驗證配置
  ENUMS: {
    "recommended_action": ["NO_CHANGE", "MINOR_ADJUST", "ESCALATE", "REDUCE_RISK"]
  },
  
  // Drift Control 配置
  DRIFT_CONTROL: {
    // 如果本週 delta 小於閾值，不允許 parameter_vector 大幅改動
    DELTA_THRESHOLD: 0.05,  // 5%
    MAX_PARAMETER_CHANGE: 0.20  // 20%
  }
};

// ==========================================
// B1: Schema Validation
// ==========================================

/**
 * B1: Schema 驗證
 * 檢查必填欄位存在、enum 合法、array 長度固定
 * 
 * @param {Object} p5BOutput - P5-B 輸出
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
function validateP5_BSchema(p5BOutput) {
  const errors = [];
  
  // 檢查必填欄位
  for (const field of P5_B_VALIDATOR_CONFIG.REQUIRED_FIELDS) {
    if (!hasNestedField(p5BOutput, field)) {
      errors.push(`缺少必填欄位：${field}`);
    }
  }
  
  // 檢查 state_vector 結構
  if (p5BOutput.state_vector) {
    const requiredStateFields = ["trend_integrity", "momentum_shift", "distribution_risk", "volatility_regime_change"];
    for (const field of requiredStateFields) {
      if (p5BOutput.state_vector[field] === undefined || p5BOutput.state_vector[field] === null) {
        errors.push(`state_vector 缺少必填欄位：${field}`);
      }
    }
  }
  
  // 檢查 parameter_adjustment_vector 結構
  if (p5BOutput.parameter_adjustment_vector) {
    const requiredParamFields = ["buy_bias", "sell_bias", "ladder_spacing_adjustment", "trailing_stop_tightness"];
    for (const field of requiredParamFields) {
      if (p5BOutput.parameter_adjustment_vector[field] === undefined || p5BOutput.parameter_adjustment_vector[field] === null) {
        errors.push(`parameter_adjustment_vector 缺少必填欄位：${field}`);
      }
    }
  }
  
  // 檢查 enum 欄位
  if (p5BOutput.recommended_action) {
    const validActions = P5_B_VALIDATOR_CONFIG.ENUMS.recommended_action;
    if (!validActions.includes(p5BOutput.recommended_action)) {
      errors.push(`recommended_action 值不合法：${p5BOutput.recommended_action}，必須是 ${validActions.join(", ")} 之一`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * 檢查嵌套欄位是否存在
 */
function hasNestedField(obj, path) {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || !(part in current)) {
      return false;
    }
    current = current[part];
  }
  return true;
}

// ==========================================
// B2: Range Validation
// ==========================================

/**
 * B2: Range 驗證
 * 檢查每個參數是否在上下界內
 * 
 * @param {Object} p5BOutput - P5-B 輸出
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
function validateP5_BRange(p5BOutput) {
  const errors = [];
  
  for (const [path, range] of Object.entries(P5_B_VALIDATOR_CONFIG.RANGES)) {
    const value = getNestedValue(p5BOutput, path);
    
    if (value !== null && value !== undefined) {
      if (typeof value !== "number") {
        errors.push(`${path} 必須是數字，實際類型：${typeof value}`);
        continue;
      }
      
      if (value < range.min || value > range.max) {
        errors.push(`${path} 值 ${value} 超出範圍 [${range.min}, ${range.max}]`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * 獲取嵌套欄位的值
 */
function getNestedValue(obj, path) {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return null;
    }
    current = current[part];
  }
  return current;
}

// ==========================================
// B3: Rule Validation
// ==========================================

/**
 * B3: Rule 驗證
 * 檢查跨欄位一致性
 * 
 * @param {Object} p5BOutput - P5-B 輸出
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
function validateP5_BRules(p5BOutput) {
  const errors = [];
  
  // 規則 1：若 recommended_action = ESCALATE → 必須提供 ≥2 條 escalation_reasons
  if (p5BOutput.recommended_action === "ESCALATE") {
    const escalationReasons = p5BOutput.escalation_reasons || [];
    if (escalationReasons.length < 2) {
      errors.push(`recommended_action = ESCALATE 時，必須提供 ≥2 條 escalation_reasons，實際：${escalationReasons.length}`);
    }
  }
  
  // 規則 2：若 escalation_score > 0.6 → recommended_action 應該是 ESCALATE
  if (p5BOutput.escalation_score > 0.6 && p5BOutput.recommended_action !== "ESCALATE") {
    errors.push(`escalation_score = ${p5BOutput.escalation_score} > 0.6，但 recommended_action = ${p5BOutput.recommended_action}，應該為 ESCALATE`);
  }
  
  // 規則 3：若 distribution_risk > 0.7 → recommended_action 應該是 REDUCE_RISK 或 ESCALATE
  if (p5BOutput.state_vector?.distribution_risk > 0.7) {
    if (p5BOutput.recommended_action !== "REDUCE_RISK" && p5BOutput.recommended_action !== "ESCALATE") {
      errors.push(`distribution_risk = ${p5BOutput.state_vector.distribution_risk} > 0.7，但 recommended_action = ${p5BOutput.recommended_action}，應該為 REDUCE_RISK 或 ESCALATE`);
    }
  }
  
  // 規則 4：buy_bias 和 sell_bias 不能同時為正（邏輯衝突）
  if (p5BOutput.parameter_adjustment_vector) {
    const buyBias = p5BOutput.parameter_adjustment_vector.buy_bias || 0;
    const sellBias = p5BOutput.parameter_adjustment_vector.sell_bias || 0;
    if (buyBias > 0 && sellBias > 0) {
      errors.push(`buy_bias = ${buyBias} 和 sell_bias = ${sellBias} 不能同時為正（邏輯衝突）`);
    }
  }
  
  // 規則 5：若 trend_integrity < 0.4 → 必須提供 escalation_reasons
  if (p5BOutput.state_vector?.trend_integrity < 0.4) {
    const escalationReasons = p5BOutput.escalation_reasons || [];
    if (escalationReasons.length === 0) {
      errors.push(`trend_integrity = ${p5BOutput.state_vector.trend_integrity} < 0.4，但未提供 escalation_reasons`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ==========================================
// B4: Drift Control
// ==========================================

/**
 * B4: Drift Control
 * 防止 LLM 漂移（若本週 delta 小於閾值 → 不允許 parameter_vector 大幅改動）
 * 
 * @param {Object} p5BOutput - P5-B 輸出
 * @param {Object} previousP5BOutput - 上週 P5-B 輸出
 * @param {Object} weeklyDelta - 本週變動摘要（Delta Pack）
 * @returns {Object} { valid: boolean, errors: Array<string>, warnings: Array<string> }
 */
function validateP5_BDrift(p5BOutput, previousP5BOutput, weeklyDelta) {
  const errors = [];
  const warnings = [];
  
  if (!previousP5BOutput || !weeklyDelta) {
    // 如果沒有上週輸出或變動摘要，跳過 drift control
    return { valid: true, errors: [], warnings: [] };
  }
  
  // 計算本週 delta（基於 Delta Pack）
  const weeklyDeltaMagnitude = calculateWeeklyDeltaMagnitude(weeklyDelta);
  
  // 如果本週 delta 小於閾值，檢查 parameter_vector 是否大幅改動
  if (weeklyDeltaMagnitude < P5_B_VALIDATOR_CONFIG.DRIFT_CONTROL.DELTA_THRESHOLD) {
    const parameterChange = calculateParameterChange(
      previousP5BOutput.parameter_adjustment_vector,
      p5BOutput.parameter_adjustment_vector
    );
    
    if (parameterChange > P5_B_VALIDATOR_CONFIG.DRIFT_CONTROL.MAX_PARAMETER_CHANGE) {
      errors.push(`本週 delta 僅 ${(weeklyDeltaMagnitude * 100).toFixed(1)}%，但 parameter_adjustment_vector 變動 ${(parameterChange * 100).toFixed(1)}%，超過允許的 ${(P5_B_VALIDATOR_CONFIG.DRIFT_CONTROL.MAX_PARAMETER_CHANGE * 100).toFixed(1)}%`);
    } else if (parameterChange > P5_B_VALIDATOR_CONFIG.DRIFT_CONTROL.MAX_PARAMETER_CHANGE * 0.7) {
      warnings.push(`本週 delta 僅 ${(weeklyDeltaMagnitude * 100).toFixed(1)}%，但 parameter_adjustment_vector 變動 ${(parameterChange * 100).toFixed(1)}%，接近上限`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

/**
 * 計算本週 delta 幅度（基於 Delta Pack）
 */
function calculateWeeklyDeltaMagnitude(weeklyDelta) {
  // 簡化計算：基於價格變動、波動變動、新聞變動等
  let magnitude = 0.0;
  
  if (weeklyDelta.price_change_abs) {
    magnitude += Math.abs(weeklyDelta.price_change_abs) * 0.5;  // 價格變動權重 0.5
  }
  
  if (weeklyDelta.atr_change_pct) {
    magnitude += Math.abs(weeklyDelta.atr_change_pct) * 0.3;  // 波動變動權重 0.3
  }
  
  if (weeklyDelta.news_cluster_count) {
    magnitude += Math.min(weeklyDelta.news_cluster_count / 10, 0.2);  // 新聞變動權重 0.2（上限）
  }
  
  return Math.min(magnitude, 1.0);  // 上限 1.0
}

/**
 * 計算 parameter_adjustment_vector 的變動幅度
 */
function calculateParameterChange(previousVector, currentVector) {
  if (!previousVector || !currentVector) {
    return 0.0;
  }
  
  const fields = ["buy_bias", "sell_bias", "ladder_spacing_adjustment", "trailing_stop_tightness"];
  let totalChange = 0.0;
  let count = 0;
  
  for (const field of fields) {
    const prev = previousVector[field] || 0;
    const curr = currentVector[field] || 0;
    const change = Math.abs(curr - prev);
    totalChange += change;
    count++;
  }
  
  return count > 0 ? totalChange / count : 0.0;
}

// ==========================================
// 主函數：完整驗證
// ==========================================

/**
 * 完整驗證 P5-B 輸出
 * 
 * @param {Object} p5BOutput - P5-B 輸出
 * @param {Object} previousP5BOutput - 上週 P5-B 輸出（可選，用於 Drift Control）
 * @param {Object} weeklyDelta - 本週變動摘要（可選，用於 Drift Control）
 * @returns {Object} { valid: boolean, errors: Array<string>, warnings: Array<string>, validation_details: Object }
 */
function validateP5_BOutput(p5BOutput, previousP5BOutput, weeklyDelta) {
  const validationDetails = {};
  const allErrors = [];
  const allWarnings = [];
  
  // B1: Schema 驗證
  const schemaResult = validateP5_BSchema(p5BOutput);
  validationDetails.schema = schemaResult;
  allErrors.push(...schemaResult.errors);
  
  // B2: Range 驗證
  const rangeResult = validateP5_BRange(p5BOutput);
  validationDetails.range = rangeResult;
  allErrors.push(...rangeResult.errors);
  
  // B3: Rule 驗證
  const ruleResult = validateP5_BRules(p5BOutput);
  validationDetails.rule = ruleResult;
  allErrors.push(...ruleResult.errors);
  
  // B4: Drift Control（如果有上週輸出和變動摘要）
  if (previousP5BOutput && weeklyDelta) {
    const driftResult = validateP5_BDrift(p5BOutput, previousP5BOutput, weeklyDelta);
    validationDetails.drift = driftResult;
    allErrors.push(...driftResult.errors);
    allWarnings.push(...driftResult.warnings);
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    validation_details: validationDetails
  };
}
