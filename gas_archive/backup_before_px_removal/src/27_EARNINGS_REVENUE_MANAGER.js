/**
 * 📅 財報/營收日期管理與自動觸發系統
 * 
 * 管理所有公司的財報和營收公布日期
 * 自動掃描並在指定天數前觸發分析
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

// ==========================================
// 配置
// ==========================================

const EARNINGS_REVENUE_CONFIG = {
  // 觸發分析的時間點（天數前）
  trigger_days: [14, 7, 3, 1],  // 財報前 14/7/3/1 天
  
  // 營收觸發分析的時間點（天數前）
  revenue_trigger_days: [7, 3, 1],  // 營收前 7/3/1 天
  
  // 掃描範圍（未來多少天）
  scan_horizon_days: 30,
  
  // 已觸發記錄保留天數
  triggered_record_retention_days: 7,
  
  // ⭐ V8.0 新增：財報後監控結束時間（用於事後學習）
  post_earnings_monitoring_end: 7,  // 財報後 3-7 天為監控結束時間
  
  // ⭐ V8.0 新增：歷史經驗配置
  historical_experience: {
    years: 5,  // 總結五年內的事件歷史經驗
    ai_model: "GEMINI_FLASH_3_0",  // 用於生成歷史經驗的 AI 模型
    auto_generate: true  // 如果沒有歷史經驗，自動由 AI 生成
  },
  
  // ⭐ V8.0 新增：關鍵數據監控配置
  key_metrics_monitoring: {
    enabled: true,
    metrics: [
      "options_flow",         // 期權流向
      "insider_trading",      // 內部人交易
      "institutional_holdings", // 機構持倉變化
      "analyst_ratings",      // 分析師評級變化
      "price_action"          // 價格行為
    ],
    anomaly_threshold: 0.15,  // 異常檢測閾值（15%偏差）
    alert_frequency: "DAILY"   // 監控頻率（每日）
  }
};

// ==========================================
// 財報/營收日期管理
// ==========================================

/**
 * 每日掃描財報/營收日期並觸發分析（由時間觸發器調用）
 */
function scanEarningsAndRevenueDates() {
  Logger.log("=".repeat(60));
  Logger.log("📅 開始掃描財報/營收日期");
  Logger.log("=".repeat(60));
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 掃描財報日期
    const earningsTriggers = scanEarningsDates(today);
    Logger.log(`找到 ${earningsTriggers.length} 個需要觸發的財報分析`);
    
    // 掃描營收日期
    const revenueTriggers = scanRevenueDates(today);
    Logger.log(`找到 ${revenueTriggers.length} 個需要觸發的營收分析`);
    
    // 執行觸發
    for (const trigger of earningsTriggers) {
      try {
        triggerEarningsAnalysis(trigger);
      } catch (error) {
        Logger.log(`觸發財報分析失敗（${trigger.ticker}）：${error.message}`);
      }
    }
    
    for (const trigger of revenueTriggers) {
      try {
        triggerRevenueAnalysis(trigger);
      } catch (error) {
        Logger.log(`觸發營收分析失敗（${trigger.ticker}）：${error.message}`);
      }
    }
    
    Logger.log("=".repeat(60));
    Logger.log("✅ 財報/營收日期掃描完成");
    Logger.log("=".repeat(60));
    
    return {
      success: true,
      earnings_triggers: earningsTriggers.length,
      revenue_triggers: revenueTriggers.length
    };
    
  } catch (error) {
    Logger.log(`❌ 掃描財報/營收日期失敗：${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 掃描財報日期
 */
function scanEarningsDates(today) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("EARNINGS_CALENDAR");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    Logger.log("⚠ EARNINGS_CALENDAR 表格不存在或為空");
    return [];
  }
  
  const triggers = [];
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const tickerCol = headers.indexOf("ticker");
  const earningsDateCol = headers.indexOf("earnings_date");
  const quarterCol = headers.indexOf("quarter");
  const yearCol = headers.indexOf("year");
  const triggeredCol = headers.indexOf("triggered_14d");
  
  if (tickerCol === -1 || earningsDateCol === -1) {
    Logger.log("⚠ EARNINGS_CALENDAR 表格缺少必要欄位");
    return [];
  }
  
  // 計算掃描範圍
  const scanEndDate = new Date(today);
  scanEndDate.setDate(scanEndDate.getDate() + EARNINGS_REVENUE_CONFIG.scan_horizon_days);
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const ticker = row[tickerCol];
    const earningsDate = new Date(row[earningsDateCol]);
    earningsDate.setHours(0, 0, 0, 0);
    
    // 只處理未來的事件
    if (earningsDate < today || earningsDate > scanEndDate) {
      continue;
    }
    
    // 計算距離財報天數
    const daysUntilEarnings = Math.floor((earningsDate - today) / (1000 * 60 * 60 * 24));
    
    // 檢查是否需要觸發
    for (const triggerDay of EARNINGS_REVENUE_CONFIG.trigger_days) {
      if (daysUntilEarnings === triggerDay) {
        // 檢查是否已觸發（避免重複觸發）
        const triggerKey = `triggered_${triggerDay}d`;
        const triggeredColIndex = headers.indexOf(triggerKey);
        
        if (triggeredColIndex !== -1 && row[triggeredColIndex] === true) {
          continue;  // 已觸發，跳過
        }
        
        triggers.push({
          ticker: ticker,
          earnings_date: earningsDate,
          quarter: row[quarterCol] || null,
          year: row[yearCol] || new Date().getFullYear(),
          days_until: daysUntilEarnings,
          trigger_day: triggerDay,
          row_index: i + 1
        });
        
        // 標記為已觸發
        if (triggeredColIndex !== -1) {
          sheet.getRange(i + 1, triggeredColIndex + 1).setValue(true);
          sheet.getRange(i + 1, headers.indexOf(`${triggerKey}_at`) + 1).setValue(new Date());
        }
        
        break;  // 只觸發一次
      }
    }
  }
  
  return triggers;
}

/**
 * 掃描營收日期
 */
function scanRevenueDates(today) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("REVENUE_CALENDAR");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    Logger.log("⚠ REVENUE_CALENDAR 表格不存在或為空");
    return [];
  }
  
  const triggers = [];
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const tickerCol = headers.indexOf("ticker");
  const revenueDateCol = headers.indexOf("revenue_date");
  const monthCol = headers.indexOf("month");
  const yearCol = headers.indexOf("year");
  
  if (tickerCol === -1 || revenueDateCol === -1) {
    Logger.log("⚠ REVENUE_CALENDAR 表格缺少必要欄位");
    return [];
  }
  
  // 計算掃描範圍
  const scanEndDate = new Date(today);
  scanEndDate.setDate(scanEndDate.getDate() + EARNINGS_REVENUE_CONFIG.scan_horizon_days);
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const ticker = row[tickerCol];
    const revenueDate = new Date(row[revenueDateCol]);
    revenueDate.setHours(0, 0, 0, 0);
    
    // 只處理未來的事件
    if (revenueDate < today || revenueDate > scanEndDate) {
      continue;
    }
    
    // 計算距離營收公布天數
    const daysUntilRevenue = Math.floor((revenueDate - today) / (1000 * 60 * 60 * 24));
    
    // 檢查是否需要觸發
    for (const triggerDay of EARNINGS_REVENUE_CONFIG.revenue_trigger_days) {
      if (daysUntilRevenue === triggerDay) {
        // 檢查是否已觸發
        const triggerKey = `triggered_${triggerDay}d`;
        const triggeredColIndex = headers.indexOf(triggerKey);
        
        if (triggeredColIndex !== -1 && row[triggeredColIndex] === true) {
          continue;  // 已觸發，跳過
        }
        
        triggers.push({
          ticker: ticker,
          revenue_date: revenueDate,
          month: row[monthCol] || null,
          year: row[yearCol] || new Date().getFullYear(),
          days_until: daysUntilRevenue,
          trigger_day: triggerDay,
          row_index: i + 1
        });
        
        // 標記為已觸發
        if (triggeredColIndex !== -1) {
          sheet.getRange(i + 1, triggeredColIndex + 1).setValue(true);
          sheet.getRange(i + 1, headers.indexOf(`${triggerKey}_at`) + 1).setValue(new Date());
        }
        
        break;  // 只觸發一次
      }
    }
  }
  
  return triggers;
}

/**
 * 觸發財報分析（調用 P5.5）
 */
function triggerEarningsAnalysis(trigger) {
  Logger.log(`📊 觸發財報分析：${trigger.ticker}，${trigger.days_until} 天後（${trigger.trigger_day} 天前觸發）`);
  
  try {
    // 調用 P5.5 Earnings Warfare
    const result = P5_5_EarningsRiskAssessment({
      ticker: trigger.ticker,
      earnings_date: trigger.earnings_date.toISOString(),
      days_until: trigger.days_until,
      quarter: trigger.quarter,
      year: trigger.year
    });
    
    Logger.log(`✅ 財報分析完成：${trigger.ticker}，風險分數：${result.risk_score || 'N/A'}`);
    
    // 記錄觸發歷史
    recordEarningsTrigger(trigger, result);
    
    return result;
  } catch (error) {
    Logger.log(`❌ 財報分析失敗：${error.message}`);
    throw error;
  }
}

/**
 * 觸發營收分析
 */
function triggerRevenueAnalysis(trigger) {
  Logger.log(`📈 觸發營收分析：${trigger.ticker}，${trigger.days_until} 天後（${trigger.trigger_day} 天前觸發）`);
  
  try {
    // 調用 P5 Monthly 的營收分析（或專用函數）
    // 這裡簡化為記錄觸發，實際可以調用專門的營收分析函數
    Logger.log(`✅ 營收分析觸發：${trigger.ticker}`);
    
    // 記錄觸發歷史
    recordRevenueTrigger(trigger);
    
    return { success: true };
  } catch (error) {
    Logger.log(`❌ 營收分析失敗：${error.message}`);
    throw error;
  }
}

/**
 * 記錄財報觸發歷史
 */
function recordEarningsTrigger(trigger, result) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("EARNINGS_TRIGGER_LOG");
    
    if (!sheet) {
      sheet = ss.insertSheet("EARNINGS_TRIGGER_LOG");
      sheet.appendRow([
        "trigger_date",
        "ticker",
        "earnings_date",
        "days_until",
        "trigger_day",
        "risk_score",
        "risk_level",
        "analysis_result_json",
        "created_at"
      ]);
      sheet.setFrozenRows(1);
    }
    
    sheet.appendRow([
      new Date(),
      trigger.ticker,
      trigger.earnings_date,
      trigger.days_until,
      trigger.trigger_day,
      result.risk_score || null,
      result.risk_level || null,
      JSON.stringify(result),
      new Date()
    ]);
  } catch (error) {
    Logger.log(`記錄財報觸發歷史失敗：${error.message}`);
  }
}

/**
 * 記錄營收觸發歷史
 */
function recordRevenueTrigger(trigger) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("REVENUE_TRIGGER_LOG");
    
    if (!sheet) {
      sheet = ss.insertSheet("REVENUE_TRIGGER_LOG");
      sheet.appendRow([
        "trigger_date",
        "ticker",
        "revenue_date",
        "days_until",
        "trigger_day",
        "created_at"
      ]);
      sheet.setFrozenRows(1);
    }
    
    sheet.appendRow([
      new Date(),
      trigger.ticker,
      trigger.revenue_date,
      trigger.days_until,
      trigger.trigger_day,
      new Date()
    ]);
  } catch (error) {
    Logger.log(`記錄營收觸發歷史失敗：${error.message}`);
  }
}

// ==========================================
// 財經事件掃描（與 P5 Calendar 整合）
// ==========================================

/**
 * 每日掃描財經事件並觸發分析（由時間觸發器調用）
 */
function scanFinancialEvents() {
  Logger.log("=".repeat(60));
  Logger.log("📅 開始掃描財經事件");
  Logger.log("=".repeat(60));
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 使用 P5 Calendar Manager 掃描下兩週事件
    const events = P5_Calendar_ScanNextTwoWeeks(today);
    
    Logger.log(`找到 ${events.length} 個下兩週重大事件`);
    
    // 對需要強化分析的事件（前 7 天內）進行強化分析
    const intensiveEvents = events.filter(e => e.requires_intensive_analysis);
    
    for (const event of intensiveEvents) {
      try {
        Logger.log(`對事件進行強化分析：${event.event_name} (${event.event_id})`);
        const analysis = P5_Calendar_IntensiveAnalysis(event.event_id);
        Logger.log(`✅ 強化分析完成：${event.event_name}`);
      } catch (error) {
        Logger.log(`強化分析失敗（${event.event_name}）：${error.message}`);
      }
    }
    
    Logger.log("=".repeat(60));
    Logger.log("✅ 財經事件掃描完成");
    Logger.log("=".repeat(60));
    
    return {
      success: true,
      total_events: events.length,
      intensive_events: intensiveEvents.length
    };
    
  } catch (error) {
    Logger.log(`❌ 掃描財經事件失敗：${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// 財報/營收日期導入工具
// ==========================================

/**
 * 批量導入財報日期（從外部數據源或手動輸入）
 * 
 * @param {Array} earningsData - 財報數據列表
 * @param {Object} earningsData[].ticker - 股票代碼
 * @param {Date|string} earningsData[].earnings_date - 財報日期
 * @param {number} earningsData[].quarter - 季度（1-4）
 * @param {number} earningsData[].year - 年份
 */
function importEarningsDates(earningsData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("EARNINGS_CALENDAR");
    
    if (!sheet) {
      sheet = ss.insertSheet("EARNINGS_CALENDAR");
      sheet.appendRow([
        "ticker",
        "earnings_date",
        "quarter",
        "year",
        "market",
        "triggered_14d",
        "triggered_14d_at",
        "triggered_7d",
        "triggered_7d_at",
        "triggered_3d",
        "triggered_3d_at",
        "triggered_1d",
        "triggered_1d_at",
        "created_at",
        "updated_at"
      ]);
      sheet.setFrozenRows(1);
    }
    
    let imported = 0;
    let updated = 0;
    
    for (const data of earningsData) {
      const ticker = data.ticker;
      const earningsDate = data.earnings_date instanceof Date ? data.earnings_date : new Date(data.earnings_date);
      
      // 檢查是否已存在
      const existingRow = findEarningsDateRow(sheet, ticker, earningsDate);
      
      if (existingRow) {
        // 更新現有記錄
        updateEarningsDateRow(sheet, existingRow, data);
        updated++;
      } else {
        // 添加新記錄
        sheet.appendRow([
          ticker,
          earningsDate,
          data.quarter || null,
          data.year || earningsDate.getFullYear(),
          data.market || "US",
          false,  // triggered_14d
          null,   // triggered_14d_at
          false,  // triggered_7d
          null,   // triggered_7d_at
          false,  // triggered_3d
          null,   // triggered_3d_at
          false,  // triggered_1d
          null,   // triggered_1d_at
          new Date(),
          new Date()
        ]);
        imported++;
      }
    }
    
    Logger.log(`✅ 財報日期導入完成：新增 ${imported} 筆，更新 ${updated} 筆`);
    
    return {
      success: true,
      imported: imported,
      updated: updated
    };
  } catch (error) {
    Logger.log(`❌ 財報日期導入失敗：${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 批量導入營收日期
 */
function importRevenueDates(revenueData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("REVENUE_CALENDAR");
    
    if (!sheet) {
      sheet = ss.insertSheet("REVENUE_CALENDAR");
      sheet.appendRow([
        "ticker",
        "revenue_date",
        "month",
        "year",
        "market",
        "triggered_7d",
        "triggered_7d_at",
        "triggered_3d",
        "triggered_3d_at",
        "triggered_1d",
        "triggered_1d_at",
        "created_at",
        "updated_at"
      ]);
      sheet.setFrozenRows(1);
    }
    
    let imported = 0;
    let updated = 0;
    
    for (const data of revenueData) {
      const ticker = data.ticker;
      const revenueDate = data.revenue_date instanceof Date ? data.revenue_date : new Date(data.revenue_date);
      
      // 檢查是否已存在
      const existingRow = findRevenueDateRow(sheet, ticker, revenueDate);
      
      if (existingRow) {
        // 更新現有記錄
        updateRevenueDateRow(sheet, existingRow, data);
        updated++;
      } else {
        // 添加新記錄
        sheet.appendRow([
          ticker,
          revenueDate,
          data.month || revenueDate.getMonth() + 1,
          data.year || revenueDate.getFullYear(),
          data.market || "TW",
          false,  // triggered_7d
          null,   // triggered_7d_at
          false,  // triggered_3d
          null,   // triggered_3d_at
          false,  // triggered_1d
          null,   // triggered_1d_at
          new Date(),
          new Date()
        ]);
        imported++;
      }
    }
    
    Logger.log(`✅ 營收日期導入完成：新增 ${imported} 筆，更新 ${updated} 筆`);
    
    return {
      success: true,
      imported: imported,
      updated: updated
    };
  } catch (error) {
    Logger.log(`❌ 營收日期導入失敗：${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 查找財報日期記錄
 */
function findEarningsDateRow(sheet, ticker, earningsDate) {
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const tickerCol = headers.indexOf("ticker");
  const dateCol = headers.indexOf("earnings_date");
  
  if (tickerCol === -1 || dateCol === -1) {
    return null;
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][tickerCol] === ticker) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate.getTime() === earningsDate.getTime()) {
        return i + 1;  // 返回行號（1-based）
      }
    }
  }
  
  return null;
}

/**
 * 查找營收日期記錄
 */
function findRevenueDateRow(sheet, ticker, revenueDate) {
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const tickerCol = headers.indexOf("ticker");
  const dateCol = headers.indexOf("revenue_date");
  
  if (tickerCol === -1 || dateCol === -1) {
    return null;
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][tickerCol] === ticker) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate.getTime() === revenueDate.getTime()) {
        return i + 1;  // 返回行號（1-based）
      }
    }
  }
  
  return null;
}

/**
 * 更新財報日期記錄
 */
function updateEarningsDateRow(sheet, rowIndex, data) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (data.quarter !== undefined) {
    const colIndex = headers.indexOf("quarter");
    if (colIndex !== -1) {
      sheet.getRange(rowIndex, colIndex + 1).setValue(data.quarter);
    }
  }
  
  if (data.year !== undefined) {
    const colIndex = headers.indexOf("year");
    if (colIndex !== -1) {
      sheet.getRange(rowIndex, colIndex + 1).setValue(data.year);
    }
  }
  
  const updatedAtCol = headers.indexOf("updated_at");
  if (updatedAtCol !== -1) {
    sheet.getRange(rowIndex, updatedAtCol + 1).setValue(new Date());
  }
}

/**
 * 更新營收日期記錄
 */
function updateRevenueDateRow(sheet, rowIndex, data) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (data.month !== undefined) {
    const colIndex = headers.indexOf("month");
    if (colIndex !== -1) {
      sheet.getRange(rowIndex, colIndex + 1).setValue(data.month);
    }
  }
  
  if (data.year !== undefined) {
    const colIndex = headers.indexOf("year");
    if (colIndex !== -1) {
      sheet.getRange(rowIndex, colIndex + 1).setValue(data.year);
    }
  }
  
  const updatedAtCol = headers.indexOf("updated_at");
  if (updatedAtCol !== -1) {
    sheet.getRange(rowIndex, updatedAtCol + 1).setValue(new Date());
  }
}
