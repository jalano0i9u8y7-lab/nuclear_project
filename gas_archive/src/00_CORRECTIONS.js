/**
 * 🛠️ 邏輯錯誤修正方案（錯誤 1 + 2）
 * 
 * 錯誤 1：P2 月度執行可能觸發無限循環
 * 錯誤 2：P3 依賴 P5 Daily 數據，執行順序可能錯亂
 * 
 * @version V6.3_SCORRECTION_V1
 * @date 2025-01-11
 */

// ==========================================
// 錯誤 1 修正：防止遞迴觸發
// ==========================================

/**
 * P3 執行完成後，檢查是否允許自動觸發下游
 * @param {Object} trigger - 觸發參數
 * @param {Object} changes - P3 變動偵測結果
 * @returns {Object} autoTrigger 配置
 */
function P3_CheckAutoTrigger(trigger, changes) {
  // ⭐ 修正：檢查 prevent_recursive 標記
  if (trigger && trigger.prevent_recursive === true) {
    // 如果來自 P5 Weekly，不自動觸發 P4
    // 等待下一個 P5 Weekly 週期，由 P5 Weekly 決定是否觸發 P4
    return {
      triggered: false,
      reason: "prevent_recursive 標記：來自 P5 Weekly，不自動觸發 P4"
    };
  }
  
  // 正常流程：Cat 變動 → 自動觸發 P4
  if (changes && changes.cat_changes && changes.cat_changes.length > 0) {
    const changedStocks = changes.cat_changes.map(c => c.ticker);
    
    return {
      triggered: true,
      triggered_phase: "P4",
      triggered_stocks: changedStocks,
      reason: "Cat 變動"
    };
  }
  
  return {
    triggered: false,
    reason: "無 Cat 變動"
  };
}

// ==========================================
// 錯誤 2 修正：P5 Daily 數據時效性檢查
// ==========================================

/**
 * 獲取最後一次 P5 Daily 執行的日期
 * @return {Date|null} 最後一次 P5 Daily 執行的日期，如果沒有則返回 null
 */
function getLastP5DailyDate() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;  // 表格不存在或沒有數據
    }
    
    // 讀取最後一行的日期（假設日期在第一列，格式：YYYY-MM-DD）
    const lastRow = sheet.getLastRow();
    const lastDateValue = sheet.getRange(lastRow, 1).getValue();
    
    if (!lastDateValue) {
      return null;
    }
    
    // 轉換為 Date 對象
    let lastDate;
    if (lastDateValue instanceof Date) {
      lastDate = new Date(lastDateValue);
    } else if (typeof lastDateValue === 'string') {
      lastDate = new Date(lastDateValue);
    } else {
      return null;
    }
    
    lastDate.setHours(0, 0, 0, 0);  // 只保留日期部分
    
    return lastDate;
  } catch (error) {
    Logger.log(`獲取最後 P5 Daily 日期失敗：${error.message}`);
    return null;
  }
}

/**
 * 檢查 P5 Daily 數據時效性，必要時先執行 P5 Daily
 * @param {number} maxWaitTime - 最大等待時間（毫秒），預設 5 分鐘
 * @return {Object} 檢查結果
 */
function ensureP5DailyFresh(maxWaitTime = 5 * 60 * 1000) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastDailyDate = getLastP5DailyDate();
  
  // 如果最後一次 P5 Daily 不是今天，先執行 P5 Daily
  if (!lastDailyDate || lastDailyDate < today) {
    Logger.log(`P5 Daily 數據檢查：數據過期（最後更新：${lastDailyDate || '無'}），先執行 P5 Daily`);
    
    try {
      // 執行 P5 Daily（這裡需要調用實際的 P5_Daily_Execute 函數）
      // 注意：需要確保 P5_Daily_Execute 函數已經定義
      if (typeof P5_Daily_Execute === 'function') {
        const dailyResult = P5_Daily_Execute();
        
        if (!dailyResult || !dailyResult.success) {
          return {
            status: "WARNING",
            message: "P5 Daily 執行失敗，將使用現有數據",
            last_daily_date: lastDailyDate,
            warning: "P5 Daily 執行返回失敗狀態"
          };
        }
      } else {
        Logger.log("警告：P5_Daily_Execute 函數尚未定義，跳過執行");
      }
      
      // 等待 P5 Daily 完成（最多等待 maxWaitTime）
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        Utilities.sleep(5000);  // 等待 5 秒後再次檢查
        
        const currentLastDailyDate = getLastP5DailyDate();
        if (currentLastDailyDate && currentLastDailyDate >= today) {
          Logger.log("P5 Daily 執行完成，數據已更新");
          return {
            status: "SUCCESS",
            message: "P5 Daily 執行完成，數據已更新",
            last_daily_date: currentLastDailyDate
          };
        }
      }
      
      // 如果超時，記錄警告但繼續執行
      const finalDailyDate = getLastP5DailyDate();
      Logger.log(`警告：P5 Daily 執行超時，將使用最新可用數據（最後更新：${finalDailyDate || '無'}）`);
      
      return {
        status: "TIMEOUT",
        message: "P5 Daily 執行超時，將使用最新可用數據",
        last_daily_date: finalDailyDate,
        warning: "等待 P5 Daily 完成超時"
      };
    } catch (error) {
      Logger.log(`P5 Daily 執行失敗：${error.message}，將使用現有數據繼續執行`);
      
      return {
        status: "ERROR",
        message: `P5 Daily 執行失敗：${error.message}`,
        last_daily_date: lastDailyDate,
        error: error.message
      };
    }
  } else {
    Logger.log(`P5 Daily 數據檢查：數據時效性正常（最後更新：${lastDailyDate}）`);
    
    return {
      status: "FRESH",
      message: "P5 Daily 數據時效性正常",
      last_daily_date: lastDailyDate
    };
  }
}

/**
 * 更新 P5 Daily 執行狀態（供 P5_Daily_Execute 調用）
 * @param {Object} status - 狀態資訊
 */
function updateP5DailyStatus(status) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P5__DAILY_STATUS");
    
    // 如果表不存在，創建它
    if (!sheet) {
      sheet = ss.insertSheet("P5__DAILY_STATUS");
      sheet.appendRow([
        "last_execution_date",
        "status",
        "ohlcv_count",
        "sector_etf_count",
        "derivatives_count",
        "news_atoms_count",
        "created_at"
      ]);
    }
    
    // 更新狀態（覆蓋最後一行或新增一行）
    const lastRow = sheet.getLastRow();
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    if (lastRow > 0 && sheet.getRange(lastRow, 1).getValue() === today) {
      // 更新當天記錄
      sheet.getRange(lastRow, 2, 1, 6).setValues([[
        status.status || "COMPLETED",
        status.ohlcv_count || 0,
        status.sector_etf_count || 0,
        status.derivatives_count || 0,
        status.news_atoms_count || 0,
        new Date()
      ]]);
    } else {
      // 新增記錄
      sheet.appendRow([
        status.last_execution_date || new Date(),
        status.status || "COMPLETED",
        status.ohlcv_count || 0,
        status.sector_etf_count || 0,
        status.derivatives_count || 0,
        status.news_atoms_count || 0,
        new Date()
      ]);
    }
  } catch (error) {
    Logger.log(`更新 P5 Daily 狀態失敗：${error.message}`);
  }
}
