/**
 * 💰 機構數據權重配置（SSOT）
 * 
 * 根據「13F 滯後陷阱」修正，調整機構數據權重
 * - 13F 權重降至 20%（用於選「池子」，不用於選「時機」）
 * - Options Flow 和 Insider Trading 權重提升至 40%（用於選「時機」）
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// 機構數據權重配置（寫死，不可動態修改）
// ==========================================

const INSTITUTIONAL_DATA_WEIGHTS = {
  // 13F 數據（滯後 45 天）
  "13F": {
    weight: 0.20,              // 權重 20%（降至 20%）
    delay_days: 45,            // 延遲 45 天
    usage: "POOL_SELECTION",   // 用途：選「池子」，不用於選「時機」
    description: "機構持倉變化（季度報告）"
  },
  
  // Dark Pool 數據（即時）
  "DARK_POOL": {
    weight: 0.30,              // 權重 30%
    delay_days: 0,             // 即時
    usage: "TIMING",           // 用途：選「時機」
    description: "暗池資金流（即時監控）"
  },
  
  // Options Flow 數據（即時）
  "OPTIONS_FLOW": {
    weight: 0.40,              // 權重 40%（提升至 40%）
    delay_days: 0,             // 即時
    usage: "TIMING",           // 用途：選「時機」
    description: "期權異常流動（即時監控）"
  },
  
  // Insider Trading 數據（即時）
  "INSIDER_TRADING": {
    weight: 0.10,              // 權重 10%
    delay_days: 0,             // 即時（通常延遲 1-2 天）
    usage: "TIMING",           // 用途：選「時機」
    description: "內部人交易（即時監控）"
  }
};

// ==========================================
// 權重驗證函數
// ==========================================

/**
 * 驗證權重總和是否為 1.0
 * 
 * @returns {boolean} isValid - 是否有效
 */
function validateInstitutionalWeights() {
  const totalWeight = Object.values(INSTITUTIONAL_DATA_WEIGHTS)
    .reduce((sum, config) => sum + config.weight, 0);
  
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    Logger.log(`警告：機構數據權重總和不等於 1.0，當前為 ${totalWeight}`);
    return false;
  }
  
  return true;
}

// ==========================================
// 權重獲取函數
// ==========================================

/**
 * 獲取指定數據源的權重配置
 * 
 * @param {string} dataSource - 數據源名稱（"13F", "DARK_POOL", "OPTIONS_FLOW", "INSIDER_TRADING"）
 * @returns {Object|null} config - 權重配置或 null
 */
function getInstitutionalWeight(dataSource) {
  return INSTITUTIONAL_DATA_WEIGHTS[dataSource] || null;
}

/**
 * 獲取所有機構數據權重配置
 * 
 * @returns {Object} weights - 所有權重配置
 */
function getAllInstitutionalWeights() {
  return INSTITUTIONAL_DATA_WEIGHTS;
}

/**
 * 根據延遲天數計算權重衰減
 * 
 * @param {string} dataSource - 數據源名稱
 * @param {number} actualDelayDays - 實際延遲天數
 * @returns {number} adjustedWeight - 調整後的權重
 */
function calculateWeightDecay(dataSource, actualDelayDays) {
  const config = getInstitutionalWeight(dataSource);
  if (!config) return 0;
  
  const baseWeight = config.weight;
  const expectedDelay = config.delay_days || 0;
  
  // 如果實際延遲超過預期延遲，進行權重衰減
  if (actualDelayDays > expectedDelay) {
    const excessDelay = actualDelayDays - expectedDelay;
    // 每超過 1 天，權重衰減 2%
    const decayFactor = Math.max(0, 1 - (excessDelay * 0.02));
    return baseWeight * decayFactor;
  }
  
  return baseWeight;
}

// ==========================================
// 初始化檢查
// ==========================================

// 在模組載入時驗證權重
if (typeof validateInstitutionalWeights === "function") {
  validateInstitutionalWeights();
}
