/**
 * ⏰ 時間觸發器設定模組
 * 
 * 設定所有每日固定時間需蒐集的數據的時間觸發器
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

// ==========================================
// 觸發器配置
// ==========================================

const TRIGGER_CONFIG = {
  // P5 Daily 觸發器（每日市場數據收集）
  p5_daily: {
    function_name: "P5_Daily_Execute",
    time: "09:00",  // 每日 09:00（市場開盤前）
    timezone: "Asia/Taipei",
    description: "P5 Daily 每日市場數據收集"
  },
  
  // P5 Weekly 觸發器（每週市場分析）
  p5_weekly: {
    function_name: "P5_Weekly_Execute",
    day_of_week: ScriptApp.WeekDay.SUNDAY,  // 每週日
    time: "20:00",  // 20:00
    timezone: "Asia/Taipei",
    description: "P5 Weekly 每週市場分析"
  },
  
  // P5 Monthly 觸發器（每月分析）
  p5_monthly: {
    function_name: "P5_Monthly_Execute",
    day_of_month: 1,  // 每月 1 號
    time: "09:00",
    timezone: "Asia/Taipei",
    description: "P5 Monthly 每月分析"
  },
  
  // P5 Quarterly 觸發器（每季分析）
  p5_quarterly: {
    function_name: "P5_Quarterly_Execute",
    months: [1, 4, 7, 10],  // 1月、4月、7月、10月（每季第一個月）
    day_of_month: 1,
    time: "09:00",
    timezone: "Asia/Taipei",
    description: "P5 Quarterly 每季分析"
  },
  
  // 財報/營收日期掃描觸發器（每日掃描）
  earnings_revenue_scan: {
    function_name: "scanEarningsAndRevenueDates",
    time: "08:00",  // 每日 08:00（市場開盤前）
    timezone: "Asia/Taipei",
    description: "每日掃描財報/營收日期並觸發分析"
  },
  
  // 財經事件掃描觸發器（每日掃描）
  calendar_scan: {
    function_name: "scanFinancialEvents",
    time: "08:30",  // 每日 08:30
    timezone: "Asia/Taipei",
    description: "每日掃描財經事件並觸發分析"
  },
  
  // ⭐ V8.0 新增：P6 盤中監測觸發器
  p6_intraday_20min: {
    function_name: "P6_RunIntradayMonitor",
    interval_minutes: 20,  // 每 20 分鐘
    timezone: "Asia/Taipei",
    description: "P6 盤中監測（每 20 分鐘）"
  },
  p6_intraday_5min: {
    function_name: "P6_RunIntradayMonitor_Options",  // 選擇權個股專用
    interval_minutes: 5,   // 每 5 分鐘
    timezone: "Asia/Taipei",
    description: "P6 盤中監測（選擇權個股，每 5 分鐘）"
  },
  p6_clear_data: {
    function_name: "P6_ClearOldData",
    time: "00:00",  // 每日午夜清除舊數據
    timezone: "Asia/Taipei",
    description: "P6 清除舊數據（每日午夜）"
  }
};

// ==========================================
// 觸發器設定函數
// ==========================================

/**
 * 設定所有時間觸發器 ⭐ V8.17 地雷修復：系統啟動順序
 */
function setupAllTriggers() {
  Logger.log("=".repeat(60));
  Logger.log("⏰ 開始設定所有時間觸發器");
  Logger.log("=".repeat(60));
  
  try {
    // ⭐ V8.17 地雷修復：使用系統啟動順序（清理觸發器）
    systemBootSequence();
    
    // 刪除現有觸發器（避免重複，作為備用）
    deleteAllTriggers();
    
    // 設定 P5 Daily 觸發器
    setupP5DailyTrigger();
    
    // 設定 P5 Weekly 觸發器
    setupP5WeeklyTrigger();
    
    // 設定 P5 Monthly 觸發器
    setupP5MonthlyTrigger();
    
    // 設定 P5 Quarterly 觸發器
    setupP5QuarterlyTrigger();
    
    // 設定財報/營收掃描觸發器
    setupEarningsRevenueScanTrigger();
    
    // 設定財經事件掃描觸發器
    setupCalendarScanTrigger();
    
    // ⭐ V8.0 新增：設定 P6 盤中監測觸發器
    setupP6IntradayTriggers();
    
    Logger.log("=".repeat(60));
    Logger.log("✅ 所有時間觸發器設定完成");
    Logger.log("=".repeat(60));
    
    return {
      success: true,
      message: "所有觸發器設定完成",
      triggers: listAllTriggers()
    };
    
  } catch (error) {
    Logger.log(`❌ 設定觸發器失敗：${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 設定 P5 Daily 觸發器（每日 09:00）
 */
function setupP5DailyTrigger() {
  try {
    const config = TRIGGER_CONFIG.p5_daily;
    const [hour, minute] = config.time.split(':').map(Number);
    
    ScriptApp.newTrigger(config.function_name)
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .nearMinute(minute)
      .inTimezone(config.timezone)
      .create();
    
    Logger.log(`✅ P5 Daily 觸發器已設定：每日 ${config.time}`);
  } catch (error) {
    Logger.log(`❌ P5 Daily 觸發器設定失敗：${error.message}`);
    throw error;
  }
}

/**
 * 設定 P5 Weekly 觸發器（每週日 20:00）
 */
function setupP5WeeklyTrigger() {
  try {
    const config = TRIGGER_CONFIG.p5_weekly;
    const [hour, minute] = config.time.split(':').map(Number);
    
    ScriptApp.newTrigger(config.function_name)
      .timeBased()
      .onWeekDay(config.day_of_week)
      .atHour(hour)
      .nearMinute(minute)
      .inTimezone(config.timezone)
      .create();
    
    Logger.log(`✅ P5 Weekly 觸發器已設定：每週日 ${config.time}`);
  } catch (error) {
    Logger.log(`❌ P5 Weekly 觸發器設定失敗：${error.message}`);
    throw error;
  }
}

/**
 * 設定 P5 Monthly 觸發器（每月 1 號 09:00）
 */
function setupP5MonthlyTrigger() {
  try {
    const config = TRIGGER_CONFIG.p5_monthly;
    const [hour, minute] = config.time.split(':').map(Number);
    
    ScriptApp.newTrigger(config.function_name)
      .timeBased()
      .onMonthDay(config.day_of_month)
      .atHour(hour)
      .nearMinute(minute)
      .inTimezone(config.timezone)
      .create();
    
    Logger.log(`✅ P5 Monthly 觸發器已設定：每月 ${config.day_of_month} 號 ${config.time}`);
  } catch (error) {
    Logger.log(`❌ P5 Monthly 觸發器設定失敗：${error.message}`);
    throw error;
  }
}

/**
 * 設定 P5 Quarterly 觸發器（每季第一個月 1 號 09:00）
 * 
 * 注意：GAS 不支援 atMonth()，改用每月觸發 + 函數內判斷季度
 */
function setupP5QuarterlyTrigger() {
  try {
    const config = TRIGGER_CONFIG.p5_quarterly;
    const [hour, minute] = config.time.split(':').map(Number);
    
    // GAS 不支援 atMonth()，改為每月 1 號觸發，在函數內判斷是否為季度第一個月
    // 或者為每個季度創建單獨的觸發器函數
    // 方案：創建一個包裝函數，每月 1 號觸發，內部判斷是否為季度第一個月
    
    ScriptApp.newTrigger("P5_Quarterly_Execute_Wrapper")
      .timeBased()
      .onMonthDay(config.day_of_month)
      .atHour(hour)
      .nearMinute(minute)
      .inTimezone(config.timezone)
      .create();
    
    Logger.log(`✅ P5 Quarterly 觸發器已設定：每月 ${config.day_of_month} 號 ${config.time}（內部判斷季度）`);
  } catch (error) {
    Logger.log(`❌ P5 Quarterly 觸發器設定失敗：${error.message}`);
    throw error;
  }
}

/**
 * P5 Quarterly 觸發器包裝函數（判斷是否為季度第一個月）
 */
function P5_Quarterly_Execute_Wrapper() {
  const today = new Date();
  const month = today.getMonth() + 1;  // 1-12
  
  // 季度第一個月：1月、4月、7月、10月
  const quarterlyMonths = [1, 4, 7, 10];
  
  if (quarterlyMonths.includes(month)) {
    Logger.log(`P5 Quarterly：檢測到季度第一個月（${month}月），執行季度分析`);
    try {
      P5_Quarterly_Execute({
        trigger: "TIME_TRIGGER",
        reason: `季度分析（${month}月）`
      });
    } catch (error) {
      Logger.log(`P5 Quarterly 執行失敗：${error.message}`);
    }
  } else {
    Logger.log(`P5 Quarterly：非季度第一個月（${month}月），跳過執行`);
  }
}

/**
 * 設定財報/營收掃描觸發器（每日 08:00）
 */
function setupEarningsRevenueScanTrigger() {
  try {
    const config = TRIGGER_CONFIG.earnings_revenue_scan;
    const [hour, minute] = config.time.split(':').map(Number);
    
    ScriptApp.newTrigger(config.function_name)
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .nearMinute(minute)
      .inTimezone(config.timezone)
      .create();
    
    Logger.log(`✅ 財報/營收掃描觸發器已設定：每日 ${config.time}`);
  } catch (error) {
    Logger.log(`❌ 財報/營收掃描觸發器設定失敗：${error.message}`);
    throw error;
  }
}

/**
 * 設定財經事件掃描觸發器（每日 08:30）
 */
function setupCalendarScanTrigger() {
  try {
    const config = TRIGGER_CONFIG.calendar_scan;
    const [hour, minute] = config.time.split(':').map(Number);
    
    ScriptApp.newTrigger(config.function_name)
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .nearMinute(minute)
      .inTimezone(config.timezone)
      .create();
    
    Logger.log(`✅ 財經事件掃描觸發器已設定：每日 ${config.time}`);
  } catch (error) {
    Logger.log(`❌ 財經事件掃描觸發器設定失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.0 新增：設定 P6 盤中監測觸發器
 */
function setupP6IntradayTriggers() {
  try {
    const config20min = TRIGGER_CONFIG.p6_intraday_20min;
    const config5min = TRIGGER_CONFIG.p6_intraday_5min;
    const configClear = TRIGGER_CONFIG.p6_clear_data;
    
    // 設定每 20 分鐘觸發器
    ScriptApp.newTrigger(config20min.function_name)
      .timeBased()
      .everyMinutes(config20min.interval_minutes)
      .create();
    
    Logger.log(`✅ P6 盤中監測觸發器已設定：${config20min.function_name}（每 ${config20min.interval_minutes} 分鐘）`);
    
    // 設定每 5 分鐘觸發器（選擇權個股）
    ScriptApp.newTrigger(config5min.function_name)
      .timeBased()
      .everyMinutes(config5min.interval_minutes)
      .create();
    
    Logger.log(`✅ P6 選擇權個股監測觸發器已設定：${config5min.function_name}（每 ${config5min.interval_minutes} 分鐘）`);
    
    // 設定每日清除觸發器
    ScriptApp.newTrigger(configClear.function_name)
      .timeBased()
      .everyDays(1)
      .atHour(0)  // 午夜 00:00
      .create();
    
    Logger.log(`✅ P6 數據清除觸發器已設定：${configClear.function_name}（每日 ${configClear.time}）`);
    
  } catch (error) {
    Logger.log(`❌ P6 觸發器設定失敗：${error.message}`);
  }
}

/**
 * P6 清除舊數據（每日午夜執行）
 */
function P6_ClearOldData() {
  try {
    Logger.log(`P6：開始清除舊數據`);
    
    // 清除一般正常情況的數據
    const deletedCount = clearNormalIntradayData();
    
    // 清除 20 分鐘動能追蹤數據
    clearOldShadowData();
    
    Logger.log(`P6：數據清除完成，共清除 ${deletedCount} 筆一般數據`);
    
  } catch (error) {
    Logger.log(`P6：清除舊數據失敗：${error.message}`);
  }
}

/**
 * P6 盤中監測（選擇權個股專用，每 5 分鐘）
 * 只監測選擇權個股
 */
function P6_RunIntradayMonitor_Options() {
  try {
    // 檢查是否在市場開盤時段（選擇權只能盤中交易）
    if (!isMarketHours()) {
      return;
    }
    
    Logger.log(`P6：開始執行選擇權個股監測（5 分鐘頻率）`);
    
    // 只收集選擇權個股數據
    const intradayData = {
      optionStocks: collectOptionStockData(),
      timestamp: new Date()
    };
    
    // 檢測異常
    const anomalies = [];
    for (const opt of intradayData.optionStocks) {
      const anomaly = detectStockAnomaly(opt, "OPTION");
      if (anomaly) {
        anomalies.push(anomaly);
      }
    }
    
    // 記錄日誌
    logIntradayMonitoring({ anomalies: anomalies }, intradayData);
    
    // 標記需保留的異常
    markAnomaliesForRetention(anomalies);
    
    Logger.log(`P6：選擇權個股監測完成，檢測到 ${anomalies.length} 個異常`);
    
  } catch (error) {
    Logger.log(`P6：選擇權個股監測失敗：${error.message}`);
  }
}

/**
 * ⭐ V8.17 地雷修復：刪除所有現有觸發器（命名空間清掃）
 * 
 * 防止殭屍觸發器堆疊：
 * - 使用命名空間前綴識別
 * - 確保「只有一個我在跑」
 * - 防止觸發器數量達到上限（20個）
 */
function deleteAllTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    Logger.log(`找到 ${triggers.length} 個現有觸發器，開始刪除...`);
    
    for (const trigger of triggers) {
      try {
        ScriptApp.deleteTrigger(trigger);
        Logger.log(`刪除觸發器：${trigger.getHandlerFunction()}`);
      } catch (e) {
        Logger.log(`刪除觸發器失敗（可能已被刪除）：${trigger.getHandlerFunction()} - ${e.message}`);
      }
    }
    
    Logger.log(`✅ 已刪除 ${triggers.length} 個觸發器`);
  } catch (error) {
    Logger.log(`❌ 刪除觸發器失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.17 地雷修復：按命名空間清掃觸發器
 * 
 * 防止殭屍觸發器堆疊：
 * - 使用命名空間前綴（例如：weekly_*, batch_*）
 * - 確保系統啟動時清理舊觸發器
 * 
 * @param {string} prefix - 命名空間前綴（例如："weekly_", "batch_"）
 */
function cleanTriggersByNamespace(prefix) {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let cleanedCount = 0;
    
    for (const trigger of triggers) {
      const handlerFunction = trigger.getHandlerFunction();
      
      // 如果函數名稱以 prefix 開頭，刪除它
      if (handlerFunction.startsWith(prefix)) {
        try {
          ScriptApp.deleteTrigger(trigger);
          cleanedCount++;
          Logger.log(`清掃觸發器（命名空間：${prefix}）：${handlerFunction}`);
        } catch (e) {
          Logger.log(`清掃觸發器失敗：${handlerFunction} - ${e.message}`);
        }
      }
    }
    
    Logger.log(`✅ 已清掃 ${cleanedCount} 個觸發器（命名空間：${prefix}）`);
    return cleanedCount;
  } catch (error) {
    Logger.log(`❌ 按命名空間清掃觸發器失敗：${error.message}`);
    return 0;
  }
}

/**
 * ⭐ V8.17 地雷修復：系統啟動順序（清理觸發器）
 * 
 * System Boot Sequence:
 * 1. Clean triggers (weekly_*, batch_*)
 * 2. Validate system state
 * 3. Create fresh triggers
 */
function systemBootSequence() {
  try {
    Logger.log("=".repeat(60));
    Logger.log("🚀 系統啟動順序（地雷修復：防止殭屍觸發器）");
    Logger.log("=".repeat(60));
    
    // Step 1: 清掃所有命名空間觸發器
    cleanTriggersByNamespace("weekly_");
    cleanTriggersByNamespace("batch_");
    cleanTriggersByNamespace("p5_");
    cleanTriggersByNamespace("p6_");
    
    // Step 2: 驗證系統狀態
    const systemState = validateSystemState();
    if (!systemState.valid) {
      Logger.log(`⚠️ 系統狀態驗證失敗：${systemState.reason}`);
      // 可以選擇是否繼續或停止
    }
    
    // Step 3: 創建新的觸發器（由 setupAllTriggers 執行）
    Logger.log("✅ 系統啟動順序完成，可以創建新觸發器");
    
    return {
      success: true,
      cleaned_triggers: systemState.cleaned_count || 0,
      system_state: systemState
    };
  } catch (error) {
    Logger.log(`❌ 系統啟動順序失敗：${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 驗證系統狀態
 * 
 * @returns {Object} systemState - 系統狀態
 */
function validateSystemState() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const triggerCount = triggers.length;
    const MAX_TRIGGERS = 20; // Google Apps Script 限制
    
    // 檢查觸發器數量
    if (triggerCount >= MAX_TRIGGERS) {
      return {
        valid: false,
        reason: `觸發器數量達到上限（${triggerCount}/${MAX_TRIGGERS}）`,
        trigger_count: triggerCount,
        max_triggers: MAX_TRIGGERS
      };
    }
    
    return {
      valid: true,
      trigger_count: triggerCount,
      max_triggers: MAX_TRIGGERS
    };
  } catch (error) {
    return {
      valid: false,
      reason: `驗證系統狀態失敗：${error.message}`
    };
  }
}

/**
 * 列出所有現有觸發器
 */
function listAllTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const triggerList = [];
    
    for (const trigger of triggers) {
      triggerList.push({
        function_name: trigger.getHandlerFunction(),
        trigger_source: trigger.getTriggerSource().toString(),
        event_type: trigger.getEventType().toString()
      });
    }
    
    return triggerList;
  } catch (error) {
    Logger.log(`❌ 列出觸發器失敗：${error.message}`);
    return [];
  }
}
