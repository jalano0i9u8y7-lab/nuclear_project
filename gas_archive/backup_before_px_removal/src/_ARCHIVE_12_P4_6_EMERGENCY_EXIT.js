/**
 * 🚨 P4.6: 緊急撤退協議（Emergency Exit Protocol）
 * 
 * ⚠️ V8.0 變更：此檔案已部分廢棄
 * - 盤中緊急撤退功能已搬移到 P6（28_P6_EMERGENCY_EXIT.js）
 * - 此檔案保留用於日結後的戰略評估（由 P5 Weekly 觸發）
 * 
 * @version SSOT V8.0（部分廢棄）
 * @date 2026-01-17
 */

// ==========================================
// P4.6 配置參數
// ==========================================

const P4_6_CONFIG = {
  // 觸發條件
  trigger_conditions: {
    "DAILY_DECLINE_7PCT": {
      threshold: 0.07,  // 市場單日跌幅 > 7%
      reduction_pct: 0.50,  // 立即減倉 50%
      priority: "HIGH"
    },
    "DEFCON_1_VIX_50": {
      defcon_level: "DEFCON_1",
      vix_threshold: 50,
      reduction_pct: 0.70,  // 立即減倉 70%
      priority: "CRITICAL"
    },
    "LIQUIDITY_CRISIS": {
      hy_spread_threshold: 1000,  // 高收益債利差 > 1000 bps
      reduction_pct_min: 0.30,
      reduction_pct_max: 0.50,
      priority: "HIGH"
    },
    "SKEW_EXTREME": {
      skew_threshold: 160,
      reduction_pct: 0.50,
      priority: "CRITICAL"
    },
    "MANUAL_TRIGGER": {
      reduction_pct: null,  // 用戶自定義
      priority: "MANUAL"
    }
  },
  
  // 執行邏輯
  execution: {
    // 分批減倉時間表
    batch_reduction: [
      { batch: 1, reduction_pct: 0.30, time_window_minutes: 10 },
      { batch: 2, reduction_pct: 0.20, time_window_minutes: 60 },
      { batch: 3, reduction_pct: 0.20, time_window_minutes: 240 },
      { batch: 4, reduction_pct: 0.30, condition: "RESERVE" }  // 保留觀察
    ],
    
    // 流動性優先級
    liquidity_priority: {
      "HIGH": {
        min_volume: 1000000,  // 最小成交量（美元）
        min_daily_volume: 5000000,  // 最小日均成交量
        max_spread_pct: 0.01  // 最大買賣價差 1%
      },
      "MEDIUM": {
        min_volume: 500000,
        min_daily_volume: 2000000,
        max_spread_pct: 0.02
      },
      "LOW": {
        min_volume: 100000,
        min_daily_volume: 500000,
        max_spread_pct: 0.05
      }
    },
    
    // 保留核心持倉
    preserve_core: true,
    core_tier: "CORE",  // 保留 CORE Tier 的持倉
    core_preservation_pct: 0.50  // 至少保留 50% 的核心持倉
  },
  
  // 恢復條件
  recovery_conditions: {
    defcon_below: "DEFCON_3",  // DEFCON 降至 3 以下
    market_stable_days: 2,  // 市場連續 2 日穩定
    require_manual_approval: true  // 需要用戶手動批准
  }
};

// ==========================================
// P4.6 核心函數
// ==========================================

/**
 * P4.6 緊急撤退協議主函數
 * @param {Object} params - 參數
 * @param {string} params.trigger_type - 觸發類型
 * @param {Object} params.market_data - 市場數據
 * @param {Object} params.current_positions - 當前持倉
 * @param {number} params.custom_reduction_pct - 自定義減倉比例（可選）
 * @return {Object} 撤退計劃
 */
function P4_6_EmergencyExit(params) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P4.6 緊急撤退協議觸發：trigger=${params.trigger_type}`);
    
    // ========================================
    // Step 1: 檢查觸發條件
    // ========================================
    
    const trigger = checkTriggerCondition(params.trigger_type, params.market_data);
    if (!trigger.triggered) {
      return {
        triggered: false,
        reason: trigger.reason,
        timestamp: new Date().toISOString()
      };
    }
    
    // ========================================
    // Step 2: 確定減倉比例
    // ========================================
    
    const reductionPct = determineReductionPercentage(
      params.trigger_type,
      params.market_data,
      params.custom_reduction_pct
    );
    
    // ========================================
    // Step 3: 評估流動性
    // ========================================
    
    const liquidityAssessment = assessLiquidity(params.current_positions);
    
    // ========================================
    // Step 4: 生成撤退計劃
    // ========================================
    
    const exitPlan = generateExitPlan(
      params.current_positions,
      reductionPct,
      liquidityAssessment,
      trigger
    );
    
    // ========================================
    // Step 5: 執行分批減倉（模擬）
    // ========================================
    
    const executionPlan = createExecutionPlan(exitPlan, reductionPct);
    
    // ========================================
    // Step 6: 生成結果
    // ========================================
    
    const result = {
      triggered: true,
      trigger_type: params.trigger_type,
      trigger_details: trigger,
      reduction_pct: reductionPct,
      liquidity_assessment: liquidityAssessment,
      exit_plan: exitPlan,
      execution_plan: executionPlan,
      timestamp: new Date().toISOString(),
      status: "PENDING_EXECUTION"  // 需要用戶確認後執行
    };
    
    const duration = Date.now() - startTime;
    Logger.log(`P4.6 緊急撤退協議完成：減倉比例=${reductionPct}, 耗時=${duration}ms`);
    
    return result;
    
  } catch (error) {
    Logger.log(`P4.6 緊急撤退協議失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 觸發條件檢查
// ==========================================

/**
 * 檢查觸發條件
 */
function checkTriggerCondition(triggerType, marketData) {
  const conditions = P4_6_CONFIG.trigger_conditions;
  const condition = conditions[triggerType];
  
  if (!condition) {
    return {
      triggered: false,
      reason: `未知的觸發類型：${triggerType}`
    };
  }
  
  // 條件 1: 市場單日跌幅 > 7%
  if (triggerType === "DAILY_DECLINE_7PCT") {
    const dailyDecline = marketData.daily_decline || 0;
    if (dailyDecline > condition.threshold) {
      return {
        triggered: true,
        reason: `市場單日跌幅 ${(dailyDecline * 100).toFixed(2)}% > 7%`,
        priority: condition.priority
      };
    }
  }
  
  // 條件 2: DEFCON 1 + VIX > 50
  if (triggerType === "DEFCON_1_VIX_50") {
    const defconLevel = marketData.defcon_level || "DEFCON_5";
    const vix = marketData.vix || 0;
    if (defconLevel === condition.defcon_level && vix > condition.vix_threshold) {
      return {
        triggered: true,
        reason: `DEFCON 1 且 VIX ${vix} > 50`,
        priority: condition.priority
      };
    }
  }
  
  // 條件 3: 流動性危機
  if (triggerType === "LIQUIDITY_CRISIS") {
    const hySpread = marketData.hy_spread || 0;
    if (hySpread > condition.hy_spread_threshold) {
      return {
        triggered: true,
        reason: `高收益債利差 ${hySpread} bps > 1000 bps`,
        priority: condition.priority
      };
    }
  }
  
  // 條件 4: SKEW 極端
  if (triggerType === "SKEW_EXTREME") {
    const skew = marketData.skew || 100;
    if (skew > condition.skew_threshold) {
      return {
        triggered: true,
        reason: `SKEW 指數 ${skew} > 160`,
        priority: condition.priority
      };
    }
  }
  
  // 條件 5: 手動觸發
  if (triggerType === "MANUAL_TRIGGER") {
    return {
      triggered: true,
      reason: "用戶手動觸發",
      priority: condition.priority
    };
  }
  
  return {
    triggered: false,
    reason: "觸發條件未滿足"
  };
}

// ==========================================
// 減倉比例確定
// ==========================================

/**
 * 確定減倉比例
 */
function determineReductionPercentage(triggerType, marketData, customReductionPct) {
  // 如果用戶自定義，優先使用
  if (customReductionPct !== null && customReductionPct !== undefined) {
    return Math.max(0, Math.min(1, customReductionPct));
  }
  
  const conditions = P4_6_CONFIG.trigger_conditions;
  const condition = conditions[triggerType];
  
  if (!condition) {
    return 0.50;  // 默認減倉 50%
  }
  
  // 流動性危機使用範圍
  if (triggerType === "LIQUIDITY_CRISIS") {
    const hySpread = marketData.hy_spread || 0;
    if (hySpread > 1200) {
      return condition.reduction_pct_max;  // 50%
    } else {
      return condition.reduction_pct_min;  // 30%
    }
  }
  
  return condition.reduction_pct || 0.50;
}

// ==========================================
// 流動性評估
// ==========================================

/**
 * 評估持倉流動性
 */
function assessLiquidity(currentPositions) {
  const assessment = {
    high_liquidity: [],
    medium_liquidity: [],
    low_liquidity: [],
    total_value: 0
  };
  
  if (Array.isArray(currentPositions)) {
    for (const position of currentPositions) {
      const liquidity = assessPositionLiquidity(position);
      assessment[liquidity].push(position);
      assessment.total_value += (position.shares || 0) * (position.price || 0);
    }
  } else if (typeof currentPositions === 'object') {
    for (const [ticker, position] of Object.entries(currentPositions)) {
      const liquidity = assessPositionLiquidity(position);
      assessment[liquidity].push({ ticker, ...position });
      assessment.total_value += (position.shares || 0) * (position.price || 0);
    }
  }
  
  return assessment;
}

/**
 * 評估單一持倉流動性
 */
function assessPositionLiquidity(position) {
  const volume = position.daily_volume || 0;
  const spread = position.bid_ask_spread || 0;
  
  const highCriteria = P4_6_CONFIG.execution.liquidity_priority.HIGH;
  const mediumCriteria = P4_6_CONFIG.execution.liquidity_priority.MEDIUM;
  
  if (volume >= highCriteria.min_daily_volume && spread <= highCriteria.max_spread_pct) {
    return "high_liquidity";
  } else if (volume >= mediumCriteria.min_daily_volume && spread <= mediumCriteria.max_spread_pct) {
    return "medium_liquidity";
  } else {
    return "low_liquidity";
  }
}

// ==========================================
// 撤退計劃生成
// ==========================================

/**
 * 生成撤退計劃
 */
function generateExitPlan(currentPositions, reductionPct, liquidityAssessment, trigger) {
  const exitPlan = {
    total_reduction_value: liquidityAssessment.total_value * reductionPct,
    reduction_pct: reductionPct,
    sell_orders: [],
    preserve_positions: []
  };
  
  // 優先賣出流動性高的標的
  const sellPriority = [
    ...liquidityAssessment.high_liquidity,
    ...liquidityAssessment.medium_liquidity,
    ...liquidityAssessment.low_liquidity
  ];
  
  let remainingReduction = exitPlan.total_reduction_value;
  
  // 保留核心持倉
  const preserveCore = P4_6_CONFIG.execution.preserve_core;
  const coreTier = P4_6_CONFIG.execution.core_tier;
  
  for (const position of sellPriority) {
    // 如果是核心持倉且需要保留
    if (preserveCore && position.tier === coreTier) {
      const positionValue = (position.shares || 0) * (position.price || 0);
      const preserveValue = positionValue * P4_6_CONFIG.execution.core_preservation_pct;
      const sellValue = positionValue - preserveValue;
      
      if (sellValue > 0 && remainingReduction > 0) {
        const sellAmount = Math.min(sellValue, remainingReduction);
        exitPlan.sell_orders.push({
          ticker: position.ticker || position.code,
          shares: Math.floor(sellAmount / (position.price || 1)),
          value: sellAmount,
          reason: "緊急撤退（保留部分核心持倉）"
        });
        remainingReduction -= sellAmount;
      }
      
      exitPlan.preserve_positions.push({
        ticker: position.ticker || position.code,
        shares: Math.floor(preserveValue / (position.price || 1)),
        value: preserveValue,
        reason: "核心持倉保留"
      });
    } else {
      // 非核心持倉，優先賣出
      const positionValue = (position.shares || 0) * (position.price || 0);
      
      if (remainingReduction > 0) {
        const sellAmount = Math.min(positionValue, remainingReduction);
        exitPlan.sell_orders.push({
          ticker: position.ticker || position.code,
          shares: Math.floor(sellAmount / (position.price || 1)),
          value: sellAmount,
          reason: "緊急撤退"
        });
        remainingReduction -= sellAmount;
      }
    }
    
    if (remainingReduction <= 0) {
      break;
    }
  }
  
  return exitPlan;
}

// ==========================================
// 執行計劃生成
// ==========================================

/**
 * 創建執行計劃（分批減倉）
 */
function createExecutionPlan(exitPlan, reductionPct) {
  const batches = P4_6_CONFIG.execution.batch_reduction;
  const executionPlan = {
    batches: [],
    total_reduction_pct: reductionPct
  };
  
  let remainingOrders = [...exitPlan.sell_orders];
  let orderIndex = 0;
  
  for (const batch of batches) {
    if (batch.condition === "RESERVE") {
      // 保留批次，不執行
      executionPlan.batches.push({
        batch_number: batch.batch,
        reduction_pct: batch.reduction_pct,
        orders: [],
        status: "RESERVE",
        note: "保留觀察，等待市場穩定"
      });
      continue;
    }
    
    const batchReductionValue = exitPlan.total_reduction_value * batch.reduction_pct;
    const batchOrders = [];
    let batchValue = 0;
    
    while (orderIndex < remainingOrders.length && batchValue < batchReductionValue) {
      const order = remainingOrders[orderIndex];
      const orderValue = order.value;
      
      if (batchValue + orderValue <= batchReductionValue) {
        batchOrders.push(order);
        batchValue += orderValue;
        orderIndex++;
      } else {
        // 部分訂單
        const partialValue = batchReductionValue - batchValue;
        batchOrders.push({
          ...order,
          shares: Math.floor(partialValue / (order.value / order.shares)),
          value: partialValue
        });
        batchValue = batchReductionValue;
        // 更新原訂單
        remainingOrders[orderIndex].shares -= batchOrders[batchOrders.length - 1].shares;
        remainingOrders[orderIndex].value -= partialValue;
        break;
      }
    }
    
    executionPlan.batches.push({
      batch_number: batch.batch,
      reduction_pct: batch.reduction_pct,
      orders: batchOrders,
      time_window_minutes: batch.time_window_minutes,
      status: "PENDING",
      estimated_value: batchValue
    });
  }
  
  return executionPlan;
}

// ==========================================
// 恢復條件檢查
// ==========================================

/**
 * 檢查恢復條件
 */
function checkRecoveryConditions(marketData, exitHistory) {
  const conditions = P4_6_CONFIG.recovery_conditions;
  
  // 條件 1: DEFCON 降至 3 以下
  const defconLevel = marketData.defcon_level || "DEFCON_5";
  const defconBelow = defconLevel !== "DEFCON_1" && defconLevel !== "DEFCON_2";
  
  // 條件 2: 市場連續穩定（需要歷史數據）
  // 這裡簡化處理，實際應該檢查過去 N 天的市場數據
  
  return {
    can_recover: defconBelow,
    defcon_check: defconBelow,
    market_stable: true,  // 簡化，實際需要檢查歷史
    require_manual_approval: conditions.require_manual_approval
  };
}

// ==========================================
// 輔助函數：檢查 P4.6 是否已觸發
// ==========================================

/**
 * 檢查 P4.6 是否已觸發（從日誌表格讀取）
 * @return {boolean} 是否已觸發
 */
function isP4_6Triggered() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P4_6_EMERGENCY_EXIT_LOG");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return false;  // 沒有日誌，表示未觸發
    }
    
    // 讀取最後一行（最新的退出記錄）
    const lastRow = sheet.getLastRow();
    const exitId = sheet.getRange(lastRow, 1).getValue();
    const timestamp = sheet.getRange(lastRow, 2).getValue();
    
    if (!exitId || !timestamp) {
      return false;
    }
    
    // 檢查是否在最近 24 小時內觸發
    const exitTime = new Date(timestamp);
    const now = new Date();
    const hoursSinceExit = (now - exitTime) / (1000 * 60 * 60);
    
    // 如果最近 24 小時內有觸發記錄，且狀態不是已恢復，則認為已觸發
    if (hoursSinceExit <= 24) {
      // 可以進一步檢查狀態欄位（如果有）
      return true;
    }
    
    return false;
    
  } catch (error) {
    Logger.log(`檢查 P4.6 觸發狀態失敗：${error.message}`);
    return false;  // 出錯時默認未觸發
  }
}
