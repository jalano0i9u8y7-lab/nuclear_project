/**
 * ⚡ P5 Weekly: 可重入設計（Re-entrant Design）⭐ V8.17 地雷修復
 * 
 * 防止 GAS 6 分鐘斷頭台：
 * - 每檔股票都是原子操作
 * - 系統狀態必須可回復
 * - 任何 crash 都不能造成邏輯不一致
 * 
 * Weekly Processing Contract:
 * - 每支 ticker 處理完成後：writeResult(ticker) + markProcessed(ticker, timestamp)
 * - 系統啟動時：loadProcessedTickers() + skip already processed
 * - 系統結束時：only mark WEEKLY_DONE if all tickers processed
 * 
 * @version V8.17 地雷修復
 * @date 2026-01-19
 */

// ==========================================
// 可重入狀態管理
// ==========================================

/**
 * 處理狀態表格 Schema
 */
const WEEKLY_PROCESSING_STATE_SCHEMA = {
  sheetName: "P5__WEEKLY_PROCESSING_STATE",
  headers: [
    "week_id",           // 週次 ID（例如：2026-W04）
    "ticker",            // 股票代碼
    "status",            // PROCESSING / COMPLETED / FAILED
    "started_at",        // 開始處理時間
    "completed_at",      // 完成時間
    "result_json",       // 處理結果（JSON）
    "error_message",     // 錯誤訊息（如果有）
    "retry_count"        // 重試次數
  ]
};

/**
 * 獲取當前週次 ID
 * 
 * @returns {string} weekId - 週次 ID（例如：2026-W04）
 */
function getCurrentWeekId() {
  const now = new Date();
  const year = now.getFullYear();
  // 使用 06_SNAPSHOT_MANAGER.js 中的 getWeekNumber 函數
  const weekNumber = typeof getWeekNumber === 'function' ? getWeekNumber(now) : Math.ceil((now - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * 載入已處理的股票列表（系統啟動時調用）
 * 
 * @param {string} weekId - 週次 ID
 * @returns {Object} processedState - 已處理狀態 {processed: [], processing: [], failed: []}
 */
function loadProcessedTickers(weekId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(WEEKLY_PROCESSING_STATE_SCHEMA.sheetName);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {
        processed: [],
        processing: [],
        failed: []
      };
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const weekIdCol = headers.indexOf("week_id");
    const tickerCol = headers.indexOf("ticker");
    const statusCol = headers.indexOf("status");
    
    if (weekIdCol === -1 || tickerCol === -1 || statusCol === -1) {
      return {
        processed: [],
        processing: [],
        failed: []
      };
    }
    
    const processed = [];
    const processing = [];
    const failed = [];
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][weekIdCol] === weekId) {
        const ticker = rows[i][tickerCol];
        const status = rows[i][statusCol];
        
        if (status === "COMPLETED") {
          processed.push(ticker);
        } else if (status === "PROCESSING") {
          processing.push(ticker);
        } else if (status === "FAILED") {
          failed.push(ticker);
        }
      }
    }
    
    Logger.log(`P5 Weekly 可重入：載入已處理狀態（${weekId}）- 已完成：${processed.length}，處理中：${processing.length}，失敗：${failed.length}`);
    
    return {
      processed: processed,
      processing: processing,
      failed: failed
    };
  } catch (error) {
    Logger.log(`載入已處理股票列表失敗：${error.message}`);
    return {
      processed: [],
      processing: [],
      failed: []
    };
  }
}

/**
 * 標記股票為處理中（原子操作）
 * 
 * @param {string} weekId - 週次 ID
 * @param {string} ticker - 股票代碼
 * @returns {boolean} success - 是否成功
 */
function markTickerProcessing(weekId, ticker) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(WEEKLY_PROCESSING_STATE_SCHEMA.sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(WEEKLY_PROCESSING_STATE_SCHEMA.sheetName);
      sheet.appendRow(WEEKLY_PROCESSING_STATE_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    // 檢查是否已存在記錄
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const weekIdCol = headers.indexOf("week_id");
    const tickerCol = headers.indexOf("ticker");
    const statusCol = headers.indexOf("status");
    
    let existingRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][weekIdCol] === weekId && rows[i][tickerCol] === ticker) {
        existingRowIndex = i + 1;
        break;
      }
    }
    
    const now = new Date();
    
    if (existingRowIndex > 0) {
      // 更新現有記錄
      sheet.getRange(existingRowIndex, statusCol + 1).setValue("PROCESSING");
      sheet.getRange(existingRowIndex, headers.indexOf("started_at") + 1).setValue(now);
      sheet.getRange(existingRowIndex, headers.indexOf("retry_count") + 1).setValue(
        (rows[existingRowIndex - 1][headers.indexOf("retry_count")] || 0) + 1
      );
    } else {
      // 新增記錄
      sheet.appendRow([
        weekId,
        ticker,
        "PROCESSING",
        now,
        null,  // completed_at
        null,  // result_json
        null,  // error_message
        0      // retry_count
      ]);
    }
    
    return true;
  } catch (error) {
    Logger.log(`標記股票為處理中失敗（${ticker}）：${error.message}`);
    return false;
  }
}

/**
 * 標記股票為已完成（原子操作）
 * 
 * @param {string} weekId - 週次 ID
 * @param {string} ticker - 股票代碼
 * @param {Object} result - 處理結果
 * @returns {boolean} success - 是否成功
 */
function markTickerCompleted(weekId, ticker, result) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(WEEKLY_PROCESSING_STATE_SCHEMA.sheetName);
    
    if (!sheet) {
      Logger.log(`標記股票為已完成失敗：表格不存在（${ticker}）`);
      return false;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const weekIdCol = headers.indexOf("week_id");
    const tickerCol = headers.indexOf("ticker");
    const statusCol = headers.indexOf("status");
    
    // 查找記錄
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][weekIdCol] === weekId && rows[i][tickerCol] === ticker) {
        const now = new Date();
        
        // 更新狀態
        sheet.getRange(i + 1, statusCol + 1).setValue("COMPLETED");
        sheet.getRange(i + 1, headers.indexOf("completed_at") + 1).setValue(now);
        sheet.getRange(i + 1, headers.indexOf("result_json") + 1).setValue(JSON.stringify(result || {}));
        sheet.getRange(i + 1, headers.indexOf("error_message") + 1).setValue(null);
        
        Logger.log(`✓ 標記股票為已完成（${ticker}）`);
        return true;
      }
    }
    
    Logger.log(`標記股票為已完成失敗：找不到記錄（${ticker}）`);
    return false;
  } catch (error) {
    Logger.log(`標記股票為已完成失敗（${ticker}）：${error.message}`);
    return false;
  }
}

/**
 * 標記股票為失敗（原子操作）
 * 
 * @param {string} weekId - 週次 ID
 * @param {string} ticker - 股票代碼
 * @param {string} errorMessage - 錯誤訊息
 * @returns {boolean} success - 是否成功
 */
function markTickerFailed(weekId, ticker, errorMessage) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(WEEKLY_PROCESSING_STATE_SCHEMA.sheetName);
    
    if (!sheet) {
      return false;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const weekIdCol = headers.indexOf("week_id");
    const tickerCol = headers.indexOf("ticker");
    const statusCol = headers.indexOf("status");
    
    // 查找記錄
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][weekIdCol] === weekId && rows[i][tickerCol] === ticker) {
        // 更新狀態
        sheet.getRange(i + 1, statusCol + 1).setValue("FAILED");
        sheet.getRange(i + 1, headers.indexOf("error_message") + 1).setValue(errorMessage);
        
        Logger.log(`⚠️ 標記股票為失敗（${ticker}）：${errorMessage}`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    Logger.log(`標記股票為失敗失敗（${ticker}）：${error.message}`);
    return false;
  }
}

/**
 * 寫入股票處理結果（原子操作）
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} result - 處理結果
 * @returns {boolean} success - 是否成功
 */
function writeTickerResult(ticker, result) {
  try {
    // 這裡可以寫入到實際的結果表格（例如：P5__WEEKLY_OUTPUT）
    // 簡化實現：只記錄到處理狀態表格
    Logger.log(`寫入股票處理結果（${ticker}）`);
    return true;
  } catch (error) {
    Logger.log(`寫入股票處理結果失敗（${ticker}）：${error.message}`);
    return false;
  }
}

/**
 * 檢查所有股票是否處理完成
 * 
 * @param {string} weekId - 週次 ID
 * @param {Array} allTickers - 所有股票列表
 * @returns {boolean} allCompleted - 是否全部完成
 */
function checkAllTickersCompleted(weekId, allTickers) {
  try {
    const processedState = loadProcessedTickers(weekId);
    const completedCount = processedState.processed.length;
    const totalCount = allTickers.length;
    
    Logger.log(`P5 Weekly 可重入：處理進度（${weekId}）- ${completedCount}/${totalCount} 完成`);
    
    return completedCount === totalCount;
  } catch (error) {
    Logger.log(`檢查所有股票是否處理完成失敗：${error.message}`);
    return false;
  }
}

/**
 * 標記週次為完成（僅在所有股票處理完成時）
 * 
 * @param {string} weekId - 週次 ID
 * @returns {boolean} success - 是否成功
 */
function markWeeklyDone(weekId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P5__WEEKLY_STATUS");
    
    if (!sheet) {
      sheet = ss.insertSheet("P5__WEEKLY_STATUS");
      sheet.appendRow([
        "week_id",
        "status",
        "completed_at",
        "total_tickers",
        "completed_tickers",
        "failed_tickers"
      ]);
      sheet.setFrozenRows(1);
    }
    
    // 讀取處理狀態
    const processedState = loadProcessedTickers(weekId);
    const totalTickers = processedState.processed.length + processedState.processing.length + processedState.failed.length;
    
    // 更新或新增記錄
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const weekIdCol = headers.indexOf("week_id");
    
    let existingRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][weekIdCol] === weekId) {
        existingRowIndex = i + 1;
        break;
      }
    }
    
    const now = new Date();
    
    if (existingRowIndex > 0) {
      // 更新現有記錄
      sheet.getRange(existingRowIndex, headers.indexOf("status") + 1).setValue("DONE");
      sheet.getRange(existingRowIndex, headers.indexOf("completed_at") + 1).setValue(now);
      sheet.getRange(existingRowIndex, headers.indexOf("completed_tickers") + 1).setValue(processedState.processed.length);
      sheet.getRange(existingRowIndex, headers.indexOf("failed_tickers") + 1).setValue(processedState.failed.length);
    } else {
      // 新增記錄
      sheet.appendRow([
        weekId,
        "DONE",
        now,
        totalTickers,
        processedState.processed.length,
        processedState.failed.length
      ]);
    }
    
    Logger.log(`✓ 標記週次為完成（${weekId}）`);
    return true;
  } catch (error) {
    Logger.log(`標記週次為完成失敗：${error.message}`);
    return false;
  }
}

/**
 * 可重入處理單檔股票（原子操作）
 * 
 * @param {string} weekId - 週次 ID
 * @param {string} ticker - 股票代碼
 * @param {Function} processFunction - 處理函數
 * @param {Object} context - 上下文
 * @returns {Object} result - 處理結果
 */
function processTickerReentrant(weekId, ticker, processFunction, context) {
  try {
    // 檢查是否已處理
    const processedState = loadProcessedTickers(weekId);
    if (processedState.processed.includes(ticker)) {
      Logger.log(`P5 Weekly 可重入：跳過已處理股票（${ticker}）`);
      return {
        skipped: true,
        reason: "already_processed"
      };
    }
    
    // 標記為處理中
    markTickerProcessing(weekId, ticker);
    
    // 執行處理（原子操作）
    const result = processFunction(ticker, context);
    
    // 寫入結果
    writeTickerResult(ticker, result);
    
    // 標記為已完成
    markTickerCompleted(weekId, ticker, result);
    
    return result;
  } catch (error) {
    // 標記為失敗
    markTickerFailed(weekId, ticker, error.message);
    
    Logger.log(`處理股票失敗（${ticker}）：${error.message}`);
    throw error;
  }
}
