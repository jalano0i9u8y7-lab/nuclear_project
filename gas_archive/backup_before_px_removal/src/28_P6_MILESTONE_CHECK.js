/**
 * 🚨 P6: 驗證里程碑未達成檢查 ⭐ V8.17 新增
 * 
 * 檢查 P2 設定的驗證里程碑是否未達成，觸發 P6 緊急退出
 * 
 * @version SSOT V8.17
 * @date 2026-01-19
 */

// ==========================================
// Milestones 失敗檢查函數
// ==========================================

/**
 * 檢查驗證里程碑是否未達成（P6 緊急退出觸發）
 * ⭐ V8.17 新增
 * 
 * @param {Object} currentPositions - 當前持倉（從 P4 快照讀取）
 * @param {Object} p2V8_15Fields - P2 V8.15 新增欄位（所有股票的 milestones_to_verify_json）
 * @param {Object} context - 上下文數據（包含股價、財報、新聞等）
 * @returns {Object} checkResult - 檢查結果
 */
function P6_CheckMilestoneFailure(currentPositions, p2V8_15Fields, context) {
  try {
    Logger.log("P6：開始檢查驗證里程碑未達成");
    
    const checkResult = {
      has_failures: false,
      failed_stocks: [],
      total_checked: 0,
      failed_count: 0,
      details: {}
    };
    
    // 解析持倉數據
    let positions = [];
    if (typeof currentPositions === 'string') {
      positions = JSON.parse(currentPositions);
    } else if (Array.isArray(currentPositions)) {
      positions = currentPositions;
    } else if (currentPositions.allocations) {
      positions = typeof currentPositions.allocations === 'string'
        ? JSON.parse(currentPositions.allocations)
        : currentPositions.allocations;
    }
    
    // 檢查每檔持倉股票的里程碑
    for (const position of positions) {
      const ticker = position.ticker;
      const p2Fields = p2V8_15Fields?.[ticker];
      
      if (!p2Fields || !p2Fields.milestones_to_verify_json) {
        continue;  // 沒有里程碑，跳過
      }
      
      checkResult.total_checked++;
      
      // 檢查里程碑是否失敗
      const milestoneCheck = checkStockMilestoneFailure(
        ticker,
        p2Fields.milestones_to_verify_json,
        context
      );
      
      checkResult.details[ticker] = milestoneCheck;
      
      // 如果有關鍵里程碑失敗，加入失敗列表
      if (milestoneCheck.has_critical_failure) {
        checkResult.has_failures = true;
        checkResult.failed_count++;
        checkResult.failed_stocks.push({
          ticker: ticker,
          failed_milestones: milestoneCheck.failed_milestones,
          failure_reason: milestoneCheck.failure_reason
        });
      }
    }
    
    if (checkResult.has_failures) {
      Logger.log(`P6：發現 ${checkResult.failed_count} 檔股票有驗證里程碑未達成：${checkResult.failed_stocks.map(s => s.ticker).join(", ")}`);
    } else {
      Logger.log("P6：所有檢查的股票里程碑狀態正常");
    }
    
    return checkResult;
    
  } catch (error) {
    Logger.log(`P6：檢查驗證里程碑失敗：${error.message}`);
    return {
      has_failures: false,
      error: error.message,
      failed_stocks: [],
      total_checked: 0,
      failed_count: 0
    };
  }
}

/**
 * 檢查單檔股票的里程碑是否失敗
 * 
 * @param {string} ticker - 股票代碼
 * @param {Array} milestones - 里程碑列表
 * @param {Object} context - 上下文數據
 * @returns {Object} checkResult - 檢查結果
 */
function checkStockMilestoneFailure(ticker, milestones, context) {
  const checkResult = {
    ticker: ticker,
    has_critical_failure: false,
    failed_milestones: [],
    failure_reason: null
  };
  
  if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
    return checkResult;
  }
  
  const today = new Date();
  
  // 檢查每個里程碑
  for (const milestone of milestones) {
    const milestoneType = milestone.type || milestone.milestone_type || "GENERIC";
    const isCritical = milestone.critical !== false;  // 預設為關鍵里程碑
    
    // 解析目標日期
    let targetDate = null;
    if (milestone.target_date) {
      targetDate = new Date(milestone.target_date);
    } else if (milestone.date) {
      targetDate = new Date(milestone.date);
    } else if (milestone.days_until !== null && milestone.days_until !== undefined) {
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + milestone.days_until);
    }
    
    if (!targetDate) {
      continue;  // 沒有目標日期，無法判斷
    }
    
    // 檢查是否已過期（超過目標日期 + 30 天緩衝期）
    const bufferDays = 30;
    const expirationDate = new Date(targetDate);
    expirationDate.setDate(expirationDate.getDate() + bufferDays);
    
    if (today > expirationDate) {
      // 已過期，檢查是否達成
      const isVerified = checkMilestoneAchievementForP6(ticker, milestone, context);
      
      if (!isVerified && isCritical) {
        // 關鍵里程碑未達成且已過期
        checkResult.has_critical_failure = true;
        checkResult.failed_milestones.push({
          milestone_id: milestone.milestone_id || null,
          description: milestone.description || milestone.milestone || "",
          target_date: targetDate,
          expiration_date: expirationDate,
          status: "FAILED"
        });
      }
    }
  }
  
  if (checkResult.has_critical_failure) {
    checkResult.failure_reason = `${checkResult.failed_milestones.length} 個關鍵里程碑未達成且已過期`;
  }
  
  return checkResult;
}

/**
 * 檢查里程碑是否達成（P6 版本，簡化邏輯）
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} milestone - 里程碑對象
 * @param {Object} context - 上下文數據
 * @returns {boolean} isVerified - 是否達成
 */
function checkMilestoneAchievementForP6(ticker, milestone, context) {
  const milestoneType = milestone.type || milestone.milestone_type || "GENERIC";
  
  try {
    switch (milestoneType.toUpperCase()) {
      case "REVENUE_TARGET":
      case "REVENUE":
        const targetRevenue = milestone.target_value || milestone.revenue_target;
        const latestRevenue = context.revenue_data?.[ticker]?.latest_revenue;
        return latestRevenue && targetRevenue && latestRevenue >= targetRevenue;
      
      case "EARNINGS_TARGET":
      case "EARNINGS":
        const targetEarnings = milestone.target_value || milestone.earnings_target;
        const latestEarnings = context.earnings_data?.[ticker]?.latest_earnings;
        return latestEarnings && targetEarnings && latestEarnings >= targetEarnings;
      
      case "PRICE_TARGET":
      case "PRICE":
        const targetPrice = milestone.target_value || milestone.price_target;
        const currentPrice = context.current_price?.[ticker] || context.daily_ohlcv?.[ticker]?.close;
        return currentPrice && targetPrice && currentPrice >= targetPrice;
      
      default:
        // 其他類型的里程碑需要從新聞或公告中檢查
        // 這裡簡化為：如果有 verification_criteria 且滿足，返回 true
        // 否則預設為未達成（需要人工確認）
        return false;
    }
  } catch (error) {
    Logger.log(`P6：檢查里程碑達成失敗（${ticker}）：${error.message}`);
    return false;
  }
}

/**
 * 觸發 P6 緊急退出（如果里程碑失敗）
 * ⭐ V8.17 新增
 * 
 * @param {Object} milestoneCheckResult - 里程碑檢查結果（來自 P6_CheckMilestoneFailure）
 * @param {Object} currentPositions - 當前持倉
 * @returns {Object} exitResult - 退出結果
 */
function P6_TriggerMilestoneFailureExit(milestoneCheckResult, currentPositions) {
  if (!milestoneCheckResult.has_failures) {
    return {
      triggered: false,
      reason: "無里程碑失敗"
    };
  }
  
  // 觸發緊急退出
  const exitResult = P6_EmergencyExit_Intraday(
    "MILESTONE_FAILURE",
    {
      failed_stocks: milestoneCheckResult.failed_stocks.map(s => s.ticker),
      failed_count: milestoneCheckResult.failed_count,
      details: milestoneCheckResult.details
    },
    currentPositions
  );
  
  return {
    triggered: true,
    exitResult: exitResult
  };
}
