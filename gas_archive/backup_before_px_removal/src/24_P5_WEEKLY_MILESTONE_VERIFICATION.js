/**
 * 📊 P5 Weekly: P2 Milestones 自動對帳機制 ⭐ V8.17 新增
 * 
 * 負責檢查 P2 設定的驗證里程碑是否達成，並在 P5 Weekly 中進行對帳
 * 
 * @version SSOT V8.17
 * @date 2026-01-19
 */

// ==========================================
// Milestones 對帳函數
// ==========================================

/**
 * 檢查 P2 Milestones 是否達成（自動對帳機制）
 * ⭐ V8.17 新增
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} p2V8_15Fields - P2 V8.15 新增欄位（包含 milestones_to_verify_json）
 * @param {Object} context - 上下文數據（包含當前股價、財報數據等）
 * @returns {Object} verificationResult - 對帳結果
 */
function verifyP2Milestones(ticker, p2V8_15Fields, context) {
  try {
    const milestones = p2V8_15Fields?.milestones_to_verify_json;
    
    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
      return {
        ticker: ticker,
        has_milestones: false,
        verified_count: 0,
        total_count: 0,
        verification_status: "NO_MILESTONES"
      };
    }
    
    const verificationResult = {
      ticker: ticker,
      has_milestones: true,
      total_count: milestones.length,
      verified_count: 0,
      failed_count: 0,
      pending_count: 0,
      milestones: [],
      verification_status: "PENDING"
    };
    
    const today = new Date();
    
    // 逐一檢查每個里程碑
    for (const milestone of milestones) {
      const milestoneResult = checkSingleMilestone(ticker, milestone, context, today);
      verificationResult.milestones.push(milestoneResult);
      
      if (milestoneResult.status === "VERIFIED") {
        verificationResult.verified_count++;
      } else if (milestoneResult.status === "FAILED") {
        verificationResult.failed_count++;
      } else {
        verificationResult.pending_count++;
      }
    }
    
    // 判斷整體狀態
    if (verificationResult.failed_count > 0) {
      verificationResult.verification_status = "FAILED";
    } else if (verificationResult.verified_count === verificationResult.total_count) {
      verificationResult.verification_status = "ALL_VERIFIED";
    } else {
      verificationResult.verification_status = "PARTIAL";
    }
    
    return verificationResult;
    
  } catch (error) {
    Logger.log(`P5 Weekly：Milestones 對帳失敗（${ticker}）：${error.message}`);
    return {
      ticker: ticker,
      has_milestones: false,
      error: error.message,
      verification_status: "ERROR"
    };
  }
}

/**
 * 生成 Milestone 驗證時間窗口 ⭐ V8.19 M3 新增
 * 
 * @param {Object} milestone - 里程碑對象
 * @param {Date} today - 當前日期
 * @returns {Object} verificationWindow - 驗證時間窗口
 */
function generateMilestoneVerificationWindow(milestone, today) {
  const targetDate = milestone.target_date ? new Date(milestone.target_date) : null;
  if (!targetDate) {
    return {
      earliest_check: null,
      optimal_check: null,
      latest_check: null,
      current_status: "NO_TARGET_DATE"
    };
  }
  
  // 根據里程碑類型推算驗證窗口
  // 例如：Q2 量產 → 財報後 45 天為 optimal，90 天為 latest
  const milestoneType = milestone.type || milestone.milestone_type || "GENERAL";
  
  let daysAfterTarget = 45;  // 預設 optimal_check 在目標日期後 45 天
  let latestDaysAfterTarget = 90;  // 預設 latest_check 在目標日期後 90 天
  
  if (milestoneType.includes("量產") || milestoneType.includes("PRODUCTION")) {
    daysAfterTarget = 45;  // 量產里程碑：財報後 45 天檢查
    latestDaysAfterTarget = 90;
  } else if (milestoneType.includes("財報") || milestoneType.includes("EARNINGS")) {
    daysAfterTarget = 30;  // 財報里程碑：財報後 30 天檢查
    latestDaysAfterTarget = 60;
  } else if (milestoneType.includes("審批") || milestoneType.includes("APPROVAL")) {
    daysAfterTarget = 60;  // 審批里程碑：審批後 60 天檢查
    latestDaysAfterTarget = 120;
  }
  
  const earliestCheck = new Date(targetDate);
  earliestCheck.setDate(earliestCheck.getDate() + 7);  // 最早檢查：目標日期後 7 天
  
  const optimalCheck = new Date(targetDate);
  optimalCheck.setDate(optimalCheck.getDate() + daysAfterTarget);
  
  const latestCheck = new Date(targetDate);
  latestCheck.setDate(latestCheck.getDate() + latestDaysAfterTarget);
  
  // 判斷當前狀態
  let currentStatus = "BEFORE_WINDOW";
  if (today >= latestCheck) {
    currentStatus = "OVERDUE";
  } else if (today >= optimalCheck) {
    currentStatus = "IN_OPTIMAL_WINDOW";
  } else if (today >= earliestCheck) {
    currentStatus = "IN_EARLY_WINDOW";
  }
  
  return {
    earliest_check: Utilities.formatDate(earliestCheck, Session.getScriptTimeZone(), "yyyy-MM-dd"),
    optimal_check: Utilities.formatDate(optimalCheck, Session.getScriptTimeZone(), "yyyy-MM-dd"),
    latest_check: Utilities.formatDate(latestCheck, Session.getScriptTimeZone(), "yyyy-MM-dd"),
    current_status: currentStatus,
    days_since_target: Math.floor((today - targetDate) / (1000 * 60 * 60 * 24))
  };
}

/**
 * 檢查單個里程碑是否達成 ⭐ V8.19 M3 增強：時間窗口邏輯
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} milestone - 里程碑對象
 * @param {Object} context - 上下文數據
 * @param {Date} today - 當前日期
 * @returns {Object} milestoneResult - 單個里程碑檢查結果
 */
function checkSingleMilestone(ticker, milestone, context, today) {
  // ⭐ V8.19 M3 新增：生成驗證時間窗口
  const verificationWindow = generateMilestoneVerificationWindow(milestone, today);
  
  const milestoneResult = {
    milestone_id: milestone.milestone_id || null,
    description: milestone.description || milestone.milestone || "",
    target_date: milestone.target_date || milestone.date || null,
    days_until: milestone.days_until || null,
    verification_window: verificationWindow,  // ⭐ V8.19 M3 新增：驗證時間窗口
    status: "PENDING",
    verified_date: null,
    failure_reason: null
  };
  
  try {
    // 解析目標日期
    let targetDate = null;
    if (milestoneResult.target_date) {
      if (typeof milestoneResult.target_date === 'string') {
        targetDate = new Date(milestoneResult.target_date);
      } else if (milestoneResult.target_date instanceof Date) {
        targetDate = milestoneResult.target_date;
      }
    } else if (milestoneResult.days_until !== null) {
      // 從 days_until 計算目標日期
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + milestoneResult.days_until);
    }
    
    // 如果沒有目標日期，無法驗證
    if (!targetDate) {
      milestoneResult.status = "PENDING";
      milestoneResult.failure_reason = "缺少目標日期";
      return milestoneResult;
    }
    
    // ⭐ V8.19 M3 新增：使用驗證時間窗口
    const window = verificationWindow;
    
    // 檢查是否在驗證窗口內
    if (window.current_status === "OVERDUE") {
      // 已超過 latest_check，檢查是否達成
      const achievementResult = checkMilestoneAchievementWithPartial(ticker, milestone, context);
      
      if (achievementResult.completion_rate >= 1.0) {
        milestoneResult.status = "VERIFIED";
        milestoneResult.verified_date = today;
      } else if (achievementResult.completion_rate >= 0.70) {  // ⭐ V8.19 M3 新增：部分達成閾值
        milestoneResult.status = "PARTIALLY_VERIFIED";
        milestoneResult.completion_rate = achievementResult.completion_rate;
        milestoneResult.partial_details = achievementResult.details;
      } else {
        milestoneResult.status = "FAILED";
        milestoneResult.failure_reason = "目標日期已過且未達成（完成度 < 70%）";
      }
    } else if (window.current_status === "IN_OPTIMAL_WINDOW" || window.current_status === "IN_EARLY_WINDOW") {
      // 在驗證窗口內，檢查是否達成
      const achievementResult = checkMilestoneAchievementWithPartial(ticker, milestone, context);
      
      if (achievementResult.completion_rate >= 1.0) {
        milestoneResult.status = "VERIFIED";
        milestoneResult.verified_date = today;
      } else if (achievementResult.completion_rate >= 0.70) {
        milestoneResult.status = "PARTIALLY_VERIFIED";
        milestoneResult.completion_rate = achievementResult.completion_rate;
        milestoneResult.partial_details = achievementResult.details;
      } else {
        milestoneResult.status = "PENDING";  // 仍在驗證窗口內，等待後續檢查
      }
    } else {
      // 尚未到驗證窗口
      milestoneResult.status = "PENDING";
    }
    
    return milestoneResult;
    
  } catch (error) {
    Logger.log(`P5 Weekly：檢查單個里程碑失敗（${ticker}）：${error.message}`);
    milestoneResult.status = "ERROR";
    milestoneResult.failure_reason = error.message;
    return milestoneResult;
  }
}

/**
 * 檢查里程碑是否達成（支持部分達成）⭐ V8.19 M3 新增
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} milestone - 里程碑對象
 * @param {Object} context - 上下文數據
 * @returns {Object} achievementResult - 達成結果（包含 completion_rate）
 */
function checkMilestoneAchievementWithPartial(ticker, milestone, context) {
  const milestoneType = milestone.type || milestone.milestone_type || "GENERIC";
  const PARTIAL_COMPLETION_THRESHOLD = 0.70;  // ⭐ V8.19 M3 新增：部分達成閾值
  
  try {
    switch (milestoneType.toUpperCase()) {
      case "REVENUE_TARGET":
      case "REVENUE":
        return checkRevenueMilestoneWithPartial(ticker, milestone, context);
      
      case "EARNINGS_TARGET":
      case "EARNINGS":
        return checkEarningsMilestoneWithPartial(ticker, milestone, context);
      
      default:
        // 預設：完全達成或未達成
        const isVerified = checkMilestoneAchievement(ticker, milestone, context);
        return {
          completion_rate: isVerified ? 1.0 : 0.0,
          details: isVerified ? "已達成" : "未達成"
        };
    }
  } catch (error) {
    Logger.log(`檢查里程碑達成失敗（${ticker}）：${error.message}`);
    return {
      completion_rate: 0.0,
      details: `檢查失敗：${error.message}`
    };
  }
}

/**
 * 檢查里程碑是否達成（根據里程碑類型）
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} milestone - 里程碑對象
 * @param {Object} context - 上下文數據
 * @returns {boolean} isVerified - 是否達成
 */
function checkMilestoneAchievement(ticker, milestone, context) {
  const milestoneType = milestone.type || milestone.milestone_type || "GENERIC";
  
  try {
    switch (milestoneType.toUpperCase()) {
      case "REVENUE_TARGET":
      case "REVENUE":
        return checkRevenueMilestone(ticker, milestone, context);
      
      case "EARNINGS_TARGET":
      case "EARNINGS":
        return checkEarningsMilestone(ticker, milestone, context);
      
      case "PRODUCT_LAUNCH":
      case "LAUNCH":
        return checkProductLaunchMilestone(ticker, milestone, context);
      
      case "PARTNERSHIP":
      case "DEAL":
        return checkPartnershipMilestone(ticker, milestone, context);
      
      case "REGULATORY_APPROVAL":
      case "APPROVAL":
        return checkRegulatoryApprovalMilestone(ticker, milestone, context);
      
      case "PRICE_TARGET":
      case "PRICE":
        return checkPriceTargetMilestone(ticker, milestone, context);
      
      default:
        // 通用檢查：如果有 verification_criteria，使用它
        if (milestone.verification_criteria) {
          return checkGenericMilestone(ticker, milestone, context);
        }
        // 如果沒有明確的驗證標準，預設為未達成（需要人工確認）
        return false;
    }
  } catch (error) {
    Logger.log(`P5 Weekly：檢查里程碑達成失敗（${ticker}，類型：${milestoneType}）：${error.message}`);
    return false;
  }
}

/**
 * 檢查營收目標里程碑（支持部分達成）⭐ V8.19 M3 新增
 */
function checkRevenueMilestoneWithPartial(ticker, milestone, context) {
  const targetRevenue = milestone.target_value || milestone.revenue_target;
  if (!targetRevenue) {
    return { completion_rate: 0.0, details: "缺少目標營收" };
  }
  
  // 從 context 中獲取最新營收數據
  const latestRevenue = context.p2_data?.revenue || context.revenue_data?.[ticker]?.latest_revenue;
  if (!latestRevenue) {
    return { completion_rate: 0.0, details: "無法獲取最新營收數據" };
  }
  
  const completionRate = Math.min(1.0, latestRevenue / targetRevenue);
  return {
    completion_rate: completionRate,
    details: `營收達成度：${(completionRate * 100).toFixed(1)}% (${latestRevenue} / ${targetRevenue})`
  };
}

/**
 * 檢查營收目標里程碑
 */
function checkRevenueMilestone(ticker, milestone, context) {
  const result = checkRevenueMilestoneWithPartial(ticker, milestone, context);
  return result.completion_rate >= 1.0;
}

/**
 * 檢查獲利目標里程碑（支持部分達成）⭐ V8.19 M3 新增
 */
function checkEarningsMilestoneWithPartial(ticker, milestone, context) {
  const targetEarnings = milestone.target_value || milestone.earnings_target;
  if (!targetEarnings) {
    return { completion_rate: 0.0, details: "缺少目標獲利" };
  }
  
  // 從 context 中獲取最新獲利數據
  const latestEarnings = context.p2_data?.earnings || context.earnings_data?.[ticker]?.latest_earnings;
  if (!latestEarnings) {
    return { completion_rate: 0.0, details: "無法獲取最新獲利數據" };
  }
  
  const completionRate = Math.min(1.0, latestEarnings / targetEarnings);
  return {
    completion_rate: completionRate,
    details: `獲利達成度：${(completionRate * 100).toFixed(1)}% (${latestEarnings} / ${targetEarnings})`
  };
}

/**
 * 檢查獲利目標里程碑
 */
function checkEarningsMilestone(ticker, milestone, context) {
  const result = checkEarningsMilestoneWithPartial(ticker, milestone, context);
  return result.completion_rate >= 1.0;
}

/**
 * 檢查產品發布里程碑
 */
function checkProductLaunchMilestone(ticker, milestone, context) {
  // 從新聞或公告中檢查是否有產品發布相關信息
  const news = context.stockNewsIndex?.[ticker] || [];
  const launchKeywords = milestone.keywords || ["launch", "release", "announce", "unveil"];
  
  for (const article of news) {
    const title = (article.title || "").toLowerCase();
    const content = (article.content || "").toLowerCase();
    
    for (const keyword of launchKeywords) {
      if (title.includes(keyword) || content.includes(keyword)) {
        // 檢查日期是否在目標日期附近（±30 天）
        const articleDate = new Date(article.date || article.published_date);
        const targetDate = new Date(milestone.target_date || milestone.date);
        const daysDiff = Math.abs((articleDate - targetDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 30) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * 檢查合作夥伴里程碑
 */
function checkPartnershipMilestone(ticker, milestone, context) {
  // 從新聞中檢查是否有合作夥伴相關信息
  const news = context.stockNewsIndex?.[ticker] || [];
  const partnerName = milestone.partner_name || milestone.target_value;
  
  if (!partnerName) return false;
  
  for (const article of news) {
    const title = (article.title || "").toLowerCase();
    const content = (article.content || "").toLowerCase();
    const partnerLower = partnerName.toLowerCase();
    
    if (title.includes(partnerLower) || content.includes(partnerLower)) {
      // 檢查日期是否在目標日期附近（±30 天）
      const articleDate = new Date(article.date || article.published_date);
      const targetDate = new Date(milestone.target_date || milestone.date);
      const daysDiff = Math.abs((articleDate - targetDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 30) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 檢查監管批准里程碑
 */
function checkRegulatoryApprovalMilestone(ticker, milestone, context) {
  // 從新聞中檢查是否有監管批准相關信息
  const news = context.stockNewsIndex?.[ticker] || [];
  const approvalKeywords = milestone.keywords || ["approval", "approved", "clearance", "authorized", "FDA", "regulatory"];
  
  for (const article of news) {
    const title = (article.title || "").toLowerCase();
    const content = (article.content || "").toLowerCase();
    
    for (const keyword of approvalKeywords) {
      if (title.includes(keyword) || content.includes(keyword)) {
        // 檢查日期是否在目標日期附近（±30 天）
        const articleDate = new Date(article.date || article.published_date);
        const targetDate = new Date(milestone.target_date || milestone.date);
        const daysDiff = Math.abs((articleDate - targetDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 30) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * 檢查價格目標里程碑
 */
function checkPriceTargetMilestone(ticker, milestone, context) {
  const targetPrice = milestone.target_value || milestone.price_target;
  if (!targetPrice) return false;
  
  // 從 context 中獲取當前股價
  const currentPrice = context.daily_ohlcv?.close || context.current_price?.[ticker];
  if (!currentPrice) return false;
  
  return currentPrice >= targetPrice;
}

/**
 * 檢查通用里程碑（使用 verification_criteria）
 */
function checkGenericMilestone(ticker, milestone, context) {
  const criteria = milestone.verification_criteria;
  if (!criteria) return false;
  
  // 這裡可以實現更複雜的邏輯，根據 criteria 進行檢查
  // 目前簡化為：如果有 criteria，預設為需要人工確認
  return false;
}

/**
 * 整合 Milestones 對帳結果到 P5 Weekly 輸出
 * ⭐ V8.17 新增
 * 
 * @param {Object} stockStrategies - 個股策略結果
 * @param {Object} context - 上下文數據
 * @returns {Object} stockStrategiesWithMilestones - 包含 Milestones 對帳結果的策略
 */
function integrateMilestoneVerification(stockStrategies, context) {
  const result = { ...stockStrategies };
  
  for (const ticker in stockStrategies) {
    const strategy = stockStrategies[ticker];
    const p2V8_15Fields = context.allSnapshots?.p2_v8_15_fields?.[ticker] || 
                          context.p2_v8_15_fields?.[ticker] ||
                          strategy.p2_v8_15_fields;
    
    if (p2V8_15Fields) {
      const verificationResult = verifyP2Milestones(ticker, p2V8_15Fields, {
        ...context,
        p2_data: strategy.p2_data,
        daily_ohlcv: strategy.daily_ohlcv,
        stockNewsIndex: context.stockNewsIndex || {}
      });
      
      result[ticker].milestone_verification = verificationResult;
      
      // 如果里程碑驗證失敗，標記風險
      if (verificationResult.verification_status === "FAILED") {
        result[ticker].milestone_risk = {
          level: "HIGH",
          reason: "驗證里程碑未達成",
          failed_milestones: verificationResult.milestones.filter(m => m.status === "FAILED").length
        };
      }
    }
  }
  
  return result;
}
