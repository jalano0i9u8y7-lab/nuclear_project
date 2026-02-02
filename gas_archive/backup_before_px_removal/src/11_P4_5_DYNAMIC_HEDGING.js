/**
 * 🛡️ P4.5: 動態對沖系統（Dynamic Hedging）
 * 
 * DEFCON 驅動的對沖策略
 * 漸進式對沖（輕/中/重）
 * 成本效益優化
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// P4.5 配置參數
// ==========================================

const P4_5_CONFIG = {
  // DEFCON 驅動的對沖策略
  hedging_strategy: {
    "DEFCON_1": {
      hedge_ratio_min: 0.60,
      hedge_ratio_max: 0.80,
      instruments: ["SPY_PUT", "TLT"],
      frequency: "DAILY",
      priority: "MAXIMUM_PROTECTION"
    },
    "DEFCON_2": {
      hedge_ratio_min: 0.40,
      hedge_ratio_max: 0.60,
      instruments: ["SPY_PUT", "INVERSE_ETF"],
      frequency: "WEEKLY",
      priority: "BALANCED"
    },
    "DEFCON_3": {
      hedge_ratio_min: 0.20,
      hedge_ratio_max: 0.40,
      instruments: ["SELECTIVE_PUT"],
      frequency: "MONTHLY",
      priority: "COST_EFFICIENT"
    },
    "DEFCON_4": {
      hedge_ratio_min: 0.10,
      hedge_ratio_max: 0.20,
      instruments: ["LEAPS"],
      frequency: "QUARTERLY",
      priority: "LIGHT_PROTECTION"
    },
    "DEFCON_5": {
      hedge_ratio_min: 0.00,
      hedge_ratio_max: 0.10,
      instruments: [],
      frequency: "MONITOR_ONLY",
      priority: "NO_HEDGE"
    }
  },
  
  // 對沖工具配置
  hedge_instruments: {
    "SPY_PUT": {
      type: "PUT_OPTION",
      underlying: "SPY",
      strike_selection: "ATM_MINUS_5PCT",  // 價外 5%
      expiration: "SHORT_TERM",  // 短期（1-2 週）
      cost_estimate: 0.02  // 預估成本（佔對沖倉位比例）
    },
    "TLT": {
      type: "BOND_ETF",
      ticker: "TLT",
      description: "20+ 年期美國國債 ETF",
      cost_estimate: 0.001  // 僅交易成本
    },
    "INVERSE_ETF": {
      type: "INVERSE_ETF",
      examples: ["SH", "SDS", "SPXU"],
      cost_estimate: 0.0015
    },
    "SELECTIVE_PUT": {
      type: "PUT_OPTION",
      underlying: "SELECTIVE",  // 選擇性對沖高風險標的
      strike_selection: "ATM_MINUS_10PCT",
      expiration: "MEDIUM_TERM",  // 中期（1-2 個月）
      cost_estimate: 0.015
    },
    "LEAPS": {
      type: "PUT_OPTION",
      underlying: "SPY",
      strike_selection: "ATM_MINUS_15PCT",  // 深度價外
      expiration: "LONG_TERM",  // 長期（6-12 個月）
      cost_estimate: 0.01  // 成本較低
    }
  },
  
  // 成本效益分析參數
  cost_benefit: {
    max_hedge_cost_pct: 0.05,  // 對沖成本不超過 5%
    min_protection_pct: 0.20,  // 最小保護比例 20%
    correlation_threshold: 0.70  // 相關性閾值
  }
};

// ==========================================
// P4.5 核心函數
// ==========================================

/**
 * P4.5 動態對沖主函數
 * @param {Object} params - 參數
 * @param {string} params.defcon_level - DEFCON 等級（DEFCON_1 到 DEFCON_5）
 * @param {Object} params.current_positions - 當前持倉結構
 * @param {Object} params.market_data - 市場數據（VIX、相關性等）
 * @return {Object} 對沖建議
 */
function P4_5_DynamicHedging(params) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P4.5 動態對沖開始：DEFCON=${params.defcon_level}`);
    
    // ========================================
    // Step 1: 獲取 DEFCON 對沖策略
    // ========================================
    
    const strategy = P4_5_CONFIG.hedging_strategy[params.defcon_level];
    if (!strategy) {
      throw new Error(`未知的 DEFCON 等級：${params.defcon_level}`);
    }
    
    // ========================================
    // Step 2: 計算對沖比例
    // ========================================
    
    const hedgeRatio = calculateHedgeRatio(
      params.defcon_level,
      params.market_data,
      strategy
    );
    
    // ========================================
    // Step 3: 選擇對沖工具
    // ========================================
    
    const hedgeInstruments = selectHedgeInstruments(
      strategy.instruments,
      params.market_data,
      hedgeRatio
    );
    
    // ========================================
    // Step 4: 計算對沖成本
    // ========================================
    
    const costAnalysis = calculateHedgeCost(
      hedgeInstruments,
      params.current_positions,
      hedgeRatio
    );
    
    // ========================================
    // Step 5: 成本效益分析
    // ========================================
    
    const costBenefit = analyzeCostBenefit(
      costAnalysis,
      hedgeRatio,
      params.market_data
    );
    
    // ========================================
    // Step 6: 生成對沖建議
    // ========================================
    
    const recommendation = {
      defcon_level: params.defcon_level,
      hedge_ratio: hedgeRatio,
      hedge_instruments: hedgeInstruments,
      cost_analysis: costAnalysis,
      cost_benefit: costBenefit,
      execution_frequency: strategy.frequency,
      priority: strategy.priority,
      timestamp: new Date().toISOString()
    };
    
    const duration = Date.now() - startTime;
    Logger.log(`P4.5 動態對沖完成：對沖比例=${hedgeRatio}, 耗時=${duration}ms`);
    
    return recommendation;
    
  } catch (error) {
    Logger.log(`P4.5 動態對沖失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 對沖比例計算
// ==========================================

/**
 * 計算對沖比例
 */
function calculateHedgeRatio(defconLevel, marketData, strategy) {
  let baseRatio = (strategy.hedge_ratio_min + strategy.hedge_ratio_max) / 2;
  
  // 根據 VIX 調整
  const vix = marketData.vix || 0;
  if (vix > 50) {
    baseRatio = strategy.hedge_ratio_max;  // 使用最大對沖比例
  } else if (vix > 40) {
    baseRatio = strategy.hedge_ratio_min + (strategy.hedge_ratio_max - strategy.hedge_ratio_min) * 0.75;
  } else if (vix > 30) {
    baseRatio = strategy.hedge_ratio_min + (strategy.hedge_ratio_max - strategy.hedge_ratio_min) * 0.5;
  }
  
  // 根據市場波動率調整
  const realizedVol = marketData.realized_volatility || 0;
  if (realizedVol > 0.30) {  // 30% 以上波動率
    baseRatio = Math.min(strategy.hedge_ratio_max, baseRatio * 1.1);
  }
  
  // 確保在範圍內
  return Math.max(
    strategy.hedge_ratio_min,
    Math.min(strategy.hedge_ratio_max, baseRatio)
  );
}

// ==========================================
// 對沖工具選擇
// ==========================================

/**
 * 選擇對沖工具
 */
function selectHedgeInstruments(instrumentTypes, marketData, hedgeRatio) {
  const selected = [];
  
  for (const instrumentType of instrumentTypes) {
    const instrumentConfig = P4_5_CONFIG.hedge_instruments[instrumentType];
    if (!instrumentConfig) {
      Logger.log(`警告：未知的對沖工具類型：${instrumentType}`);
      continue;
    }
    
    // 根據對沖比例選擇工具
    if (instrumentType === "SPY_PUT" && hedgeRatio >= 0.40) {
      selected.push({
        type: instrumentType,
        config: instrumentConfig,
        allocation: hedgeRatio * 0.6  // 60% 的對沖比例用 SPY Put
      });
    } else if (instrumentType === "TLT" && hedgeRatio >= 0.60) {
      selected.push({
        type: instrumentType,
        config: instrumentConfig,
        allocation: hedgeRatio * 0.4  // 40% 的對沖比例用 TLT
      });
    } else if (instrumentType === "INVERSE_ETF" && hedgeRatio >= 0.40) {
      selected.push({
        type: instrumentType,
        config: instrumentConfig,
        allocation: hedgeRatio * 0.5
      });
    } else if (instrumentType === "SELECTIVE_PUT" && hedgeRatio >= 0.20) {
      selected.push({
        type: instrumentType,
        config: instrumentConfig,
        allocation: hedgeRatio * 0.8
      });
    } else if (instrumentType === "LEAPS" && hedgeRatio >= 0.10) {
      selected.push({
        type: instrumentType,
        config: instrumentConfig,
        allocation: hedgeRatio
      });
    }
  }
  
  return selected;
}

// ==========================================
// 對沖成本計算
// ==========================================

/**
 * 計算對沖成本
 */
function calculateHedgeCost(hedgeInstruments, currentPositions, hedgeRatio) {
  let totalCost = 0;
  const positionValue = calculateTotalPositionValue(currentPositions);
  const hedgeValue = positionValue * hedgeRatio;
  
  const costBreakdown = [];
  
  for (const instrument of hedgeInstruments) {
    const instrumentCost = hedgeValue * instrument.allocation * instrument.config.cost_estimate;
    totalCost += instrumentCost;
    
    costBreakdown.push({
      instrument_type: instrument.type,
      allocation: instrument.allocation,
      cost: instrumentCost,
      cost_pct: (instrumentCost / positionValue) * 100
    });
  }
  
  return {
    total_cost: totalCost,
    total_cost_pct: (totalCost / positionValue) * 100,
    hedge_value: hedgeValue,
    position_value: positionValue,
    cost_breakdown: costBreakdown
  };
}

/**
 * 計算總持倉價值
 */
function calculateTotalPositionValue(currentPositions) {
  let totalValue = 0;
  
  if (Array.isArray(currentPositions)) {
    for (const position of currentPositions) {
      totalValue += (position.shares || 0) * (position.price || 0);
    }
  } else if (typeof currentPositions === 'object') {
    // 如果是對象格式
    for (const [ticker, position] of Object.entries(currentPositions)) {
      totalValue += (position.shares || 0) * (position.price || 0);
    }
  }
  
  return totalValue;
}

// ==========================================
// 成本效益分析
// ==========================================

/**
 * 分析成本效益
 */
function analyzeCostBenefit(costAnalysis, hedgeRatio, marketData) {
  const maxCostPct = P4_5_CONFIG.cost_benefit.max_hedge_cost_pct;
  const minProtectionPct = P4_5_CONFIG.cost_benefit.min_protection_pct;
  
  const costPct = costAnalysis.total_cost_pct / 100;
  const protectionPct = hedgeRatio;
  
  // 成本效益比
  const costBenefitRatio = protectionPct / (costPct + 0.001);  // 避免除零
  
  // 是否通過成本效益檢查
  const isCostEffective = costPct <= maxCostPct && protectionPct >= minProtectionPct;
  
  // 建議
  let recommendation = "執行對沖";
  if (!isCostEffective) {
    if (costPct > maxCostPct) {
      recommendation = "對沖成本過高，建議降低對沖比例或選擇更便宜的對沖工具";
    } else if (protectionPct < minProtectionPct) {
      recommendation = "對沖保護不足，建議增加對沖比例";
    }
  }
  
  return {
    cost_benefit_ratio: costBenefitRatio,
    is_cost_effective: isCostEffective,
    recommendation: recommendation,
    cost_pct: costPct,
    protection_pct: protectionPct
  };
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 獲取對沖策略配置
 */
function getHedgingStrategy(defconLevel) {
  return P4_5_CONFIG.hedging_strategy[defconLevel] || null;
}

/**
 * 檢查是否需要調整對沖
 */
function shouldAdjustHedging(currentHedgeRatio, recommendedHedgeRatio, threshold = 0.05) {
  return Math.abs(currentHedgeRatio - recommendedHedgeRatio) > threshold;
}
