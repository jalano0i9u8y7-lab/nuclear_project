/**
 * 🎨 Nuclear Project UI：策略操作模組
 * 
 * 處理每週策略的顯示、確認、拒絕、修改等操作
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

// ==========================================
// 策略操作
// ==========================================

/**
 * 獲取本週待處理策略
 * 
 * @returns {Array} strategies - 策略列表
 */
function UI_GetPendingStrategies() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__WEEKLY_STOCK_STRATEGIES");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    const strategyCol = headers.indexOf("strategy");
    const actionCol = headers.indexOf("action");
    const targetAllocationCol = headers.indexOf("target_allocation");
    const confidenceCol = headers.indexOf("confidence");
    const factorsCol = headers.indexOf("factors_json");
    
    if (dateCol === -1 || tickerCol === -1) {
      return [];
    }
    
    const strategies = [];
    
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo) {
        const strategy = {
          date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
          ticker: rows[i][tickerCol],
          strategy: rows[i][strategyCol] || "HOLD",
          action: rows[i][actionCol] || "NO_ACTION",
          target_allocation: rows[i][targetAllocationCol] || 0,
          confidence: rows[i][confidenceCol] || 0,
          factors: rows[i][factorsCol] ? JSON.parse(rows[i][factorsCol]) : {},
          row_index: i + 1
        };
        strategies.push(strategy);
      }
    }
    
    // 按日期降序排列（最新的在前）
    strategies.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return strategies;
  } catch (error) {
    Logger.log(`獲取待處理策略失敗：${error.message}`);
    return [];
  }
}

/**
 * 確認策略（用戶確認執行）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} date - 策略日期
 * @param {Object} modifications - 用戶修改（可選）
 * @returns {Object} result - 操作結果
 */
function UI_ConfirmStrategy(ticker, date, modifications = {}) {
  try {
    Logger.log(`UI：確認策略 ${ticker} (${date})`);
    
    // 保存用戶決策到 P5__WEEKLY_STRATEGY_TRACKING
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let trackingSheet = ss.getSheetByName("P5__WEEKLY_STRATEGY_TRACKING");
    
    if (!trackingSheet) {
      trackingSheet = ss.insertSheet("P5__WEEKLY_STRATEGY_TRACKING");
      trackingSheet.appendRow(P5_WEEKLY_STRATEGY_TRACKING_SCHEMA.headers);
      trackingSheet.setFrozenRows(1);
    }
    
    // 獲取策略詳情
    const strategies = UI_GetPendingStrategies();
    const strategy = strategies.find(s => s.ticker === ticker && s.date === date);
    
    if (!strategy) {
      return { success: false, message: "策略不存在" };
    }
    
    // 保存追蹤記錄
    const today = new Date();
    trackingSheet.appendRow([
      Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd"),
      ticker,
      `${ticker}_${date}`,  // strategy_id
      date,
      getCurrentPrice(ticker) || 0,  // actual_price_at_strategy
      null,  // actual_price_after_1w
      null,  // actual_price_after_2w
      null,  // actual_price_after_1m
      "PENDING",  // strategy_outcome（待追蹤）
      JSON.stringify(modifications),  // deviation_reason_json
      JSON.stringify([]),  // learning_points_json
      today
    ]);
    
    Logger.log(`✓ 策略已確認：${ticker}`);
    
    // （未來）這裡可以連接下單系統 API
    // if (modifications.execute_order) {
    //   executeOrderAPI(ticker, strategy, modifications);
    // }
    
    return { success: true, message: "策略已確認" };
  } catch (error) {
    Logger.log(`確認策略失敗：${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * 拒絕策略（用戶拒絕執行）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} date - 策略日期
 * @param {string} reason - 拒絕原因
 * @returns {Object} result - 操作結果
 */
function UI_RejectStrategy(ticker, date, reason = "") {
  try {
    Logger.log(`UI：拒絕策略 ${ticker} (${date})，原因：${reason}`);
    
    // 保存拒絕記錄
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let trackingSheet = ss.getSheetByName("P5__WEEKLY_STRATEGY_TRACKING");
    
    if (!trackingSheet) {
      trackingSheet = ss.insertSheet("P5__WEEKLY_STRATEGY_TRACKING");
      trackingSheet.appendRow(P5_WEEKLY_STRATEGY_TRACKING_SCHEMA.headers);
      trackingSheet.setFrozenRows(1);
    }
    
    const today = new Date();
    trackingSheet.appendRow([
      Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd"),
      ticker,
      `${ticker}_${date}`,
      date,
      getCurrentPrice(ticker) || 0,
      null,
      null,
      null,
      "REJECTED",  // strategy_outcome
      JSON.stringify([{ reason: reason, rejected_at: today.toISOString() }]),
      JSON.stringify([]),
      today
    ]);
    
    Logger.log(`✓ 策略已拒絕：${ticker}`);
    
    return { success: true, message: "策略已拒絕" };
  } catch (error) {
    Logger.log(`拒絕策略失敗：${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * 修改策略（用戶修改後確認）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} date - 策略日期
 * @param {Object} modifications - 修改內容
 * @returns {Object} result - 操作結果
 */
function UI_ModifyStrategy(ticker, date, modifications) {
  try {
    Logger.log(`UI：修改策略 ${ticker} (${date})`);
    
    // 修改策略等同於確認策略（帶修改）
    return UI_ConfirmStrategy(ticker, date, {
      ...modifications,
      modified: true,
      modified_at: new Date().toISOString()
    });
  } catch (error) {
    Logger.log(`修改策略失敗：${error.message}`);
    return { success: false, message: error.message };
  }
}
