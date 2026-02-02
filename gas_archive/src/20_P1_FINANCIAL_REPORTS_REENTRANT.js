/**
 * ⚡ P1 財報下載：可重入設計（Re-entrant Design）⭐ V8.17 地雷修復
 * 
 * 防止 GAS 6 分鐘斷頭台：
 * - 每檔公司都是原子操作
 * - 系統狀態必須可回復
 * - 任何 crash 都不能造成邏輯不一致
 * 
 * Processing Contract:
 * - 每檔公司處理完成後：saveResult(ticker) + markProcessed(ticker, timestamp)
 * - 系統啟動時：loadProcessedCompanies() + skip already processed
 * - 系統結束時：only mark JOB_DONE if all companies processed
 * 
 * @version V8.17 地雷修復
 * @date 2026-01-24
 */

// ==========================================
// 可重入狀態管理
// ==========================================

/**
 * 處理狀態表格 Schema
 */
const P1_FINANCIAL_REPORT_STATE_SCHEMA = {
  sheetName: "P1__FINANCIAL_REPORT_STATE",
  headers: [
    "job_id",           // Job ID
    "ticker",           // 股票代碼
    "market",           // 市場（US/TW/JP）
    "status",           // PROCESSING / COMPLETED / FAILED
    "started_at",       // 開始處理時間
    "completed_at",     // 完成時間
    "reports_count",    // 處理的財報數量
    "extraction_status", // 提取狀態（JSON）
    "error_message",    // 錯誤訊息（如果有）
    "retry_count"       // 重試次數
  ]
};

/**
 * 載入已處理的公司列表（系統啟動時調用）
 * 
 * @param {string} jobId - Job ID
 * @returns {Object} processedState - 已處理狀態 {processed: [], processing: [], failed: []}
 */
function loadProcessedFinancialReportCompanies(jobId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(P1_FINANCIAL_REPORT_STATE_SCHEMA.sheetName);
    
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
    
    const jobIdCol = headers.indexOf("job_id");
    const tickerCol = headers.indexOf("ticker");
    const statusCol = headers.indexOf("status");
    
    if (jobIdCol === -1 || tickerCol === -1 || statusCol === -1) {
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
      if (rows[i][jobIdCol] === jobId) {
        const ticker = rows[i][tickerCol];
        const status = rows[i][statusCol];
        
        if (status === "COMPLETED") {
          processed.push(ticker);
        } else if (status === "PROCESSING") {
          // 檢查是否超時（超過10分鐘視為失敗，需要重試）
          const startedAtCol = headers.indexOf("started_at");
          if (startedAtCol !== -1 && rows[i][startedAtCol]) {
            const startedAt = new Date(rows[i][startedAtCol]);
            const elapsed = Date.now() - startedAt.getTime();
            if (elapsed > 10 * 60 * 1000) {  // 10分鐘超時
              Logger.log(`P1 財報可重入：${ticker} 處理超時（${Math.floor(elapsed / 1000)}秒），標記為失敗以便重試`);
              failed.push(ticker);
              // 更新狀態為失敗
              markFinancialReportCompanyFailed(jobId, ticker, "處理超時（超過10分鐘）");
              continue;
            }
          }
          processing.push(ticker);
        } else if (status === "FAILED") {
          failed.push(ticker);
        }
      }
    }
    
    Logger.log(`P1 財報可重入：載入已處理狀態（${jobId}）- 已完成：${processed.length}，處理中：${processing.length}，失敗：${failed.length}`);
    
    return {
      processed: processed,
      processing: processing,
      failed: failed
    };
  } catch (error) {
    Logger.log(`載入已處理公司列表失敗：${error.message}`);
    return {
      processed: [],
      processing: [],
      failed: []
    };
  }
}

/**
 * 標記公司為處理中（原子操作）
 * 
 * @param {string} jobId - Job ID
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場（US/TW/JP）
 * @returns {boolean} success - 是否成功
 */
function markFinancialReportCompanyProcessing(jobId, ticker, market) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(P1_FINANCIAL_REPORT_STATE_SCHEMA.sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(P1_FINANCIAL_REPORT_STATE_SCHEMA.sheetName);
      sheet.appendRow(P1_FINANCIAL_REPORT_STATE_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    // 檢查是否已存在記錄
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const jobIdCol = headers.indexOf("job_id");
    const tickerCol = headers.indexOf("ticker");
    const statusCol = headers.indexOf("status");
    const startedAtCol = headers.indexOf("started_at");
    
    let existingRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][jobIdCol] === jobId && rows[i][tickerCol] === ticker) {
        existingRowIndex = i + 1;  // +1 因為是行號（1-based）
        break;
      }
    }
    
    const now = new Date().toISOString();
    
    if (existingRowIndex > 0) {
      // 更新現有記錄
      sheet.getRange(existingRowIndex, statusCol + 1).setValue("PROCESSING");
      if (startedAtCol !== -1) {
        sheet.getRange(existingRowIndex, startedAtCol + 1).setValue(now);
      }
    } else {
      // 新增記錄
      const newRow = [
        jobId,
        ticker,
        market,
        "PROCESSING",
        now,
        null,  // completed_at
        null,  // reports_count
        null,  // extraction_status
        null,  // error_message
        0      // retry_count
      ];
      sheet.appendRow(newRow);
    }
    
    return true;
  } catch (error) {
    Logger.log(`標記公司為處理中失敗（${ticker}）：${error.message}`);
    return false;
  }
}

/**
 * 標記公司為已完成（原子操作）
 * 
 * @param {string} jobId - Job ID
 * @param {string} ticker - 股票代碼
 * @param {number} reportsCount - 處理的財報數量
 * @param {Object} extractionStatus - 提取狀態
 * @returns {boolean} success - 是否成功
 */
function markFinancialReportCompanyCompleted(jobId, ticker, reportsCount, extractionStatus) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(P1_FINANCIAL_REPORT_STATE_SCHEMA.sheetName);
    
    if (!sheet) {
      return false;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const jobIdCol = headers.indexOf("job_id");
    const tickerCol = headers.indexOf("ticker");
    const statusCol = headers.indexOf("status");
    const completedAtCol = headers.indexOf("completed_at");
    const reportsCountCol = headers.indexOf("reports_count");
    const extractionStatusCol = headers.indexOf("extraction_status");
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][jobIdCol] === jobId && rows[i][tickerCol] === ticker) {
        const rowIndex = i + 1;  // +1 因為是行號（1-based）
        sheet.getRange(rowIndex, statusCol + 1).setValue("COMPLETED");
        if (completedAtCol !== -1) {
          sheet.getRange(rowIndex, completedAtCol + 1).setValue(new Date().toISOString());
        }
        if (reportsCountCol !== -1) {
          sheet.getRange(rowIndex, reportsCountCol + 1).setValue(reportsCount);
        }
        if (extractionStatusCol !== -1 && extractionStatus) {
          sheet.getRange(rowIndex, extractionStatusCol + 1).setValue(JSON.stringify(extractionStatus));
        }
        return true;
      }
    }
    
    return false;
  } catch (error) {
    Logger.log(`標記公司為已完成失敗（${ticker}）：${error.message}`);
    return false;
  }
}

/**
 * 標記公司為失敗（原子操作）
 * 
 * @param {string} jobId - Job ID
 * @param {string} ticker - 股票代碼
 * @param {string} errorMessage - 錯誤訊息
 * @returns {boolean} success - 是否成功
 */
function markFinancialReportCompanyFailed(jobId, ticker, errorMessage) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(P1_FINANCIAL_REPORT_STATE_SCHEMA.sheetName);
    
    if (!sheet) {
      return false;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const jobIdCol = headers.indexOf("job_id");
    const tickerCol = headers.indexOf("ticker");
    const statusCol = headers.indexOf("status");
    const errorMessageCol = headers.indexOf("error_message");
    const retryCountCol = headers.indexOf("retry_count");
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][jobIdCol] === jobId && rows[i][tickerCol] === ticker) {
        const rowIndex = i + 1;  // +1 因為是行號（1-based）
        sheet.getRange(rowIndex, statusCol + 1).setValue("FAILED");
        if (errorMessageCol !== -1) {
          sheet.getRange(rowIndex, errorMessageCol + 1).setValue(errorMessage);
        }
        if (retryCountCol !== -1) {
          const currentRetry = rows[i][retryCountCol] || 0;
          sheet.getRange(rowIndex, retryCountCol + 1).setValue(currentRetry + 1);
        }
        return true;
      }
    }
    
    return false;
  } catch (error) {
    Logger.log(`標記公司為失敗失敗（${ticker}）：${error.message}`);
    return false;
  }
}

/**
 * 可重入處理單檔公司（原子操作）
 * 
 * @param {string} jobId - Job ID
 * @param {Object} company - 公司資訊
 * @param {Function} processFunction - 處理函數
 * @returns {Object} result - 處理結果
 */
function processFinancialReportCompanyReentrant(jobId, company, processFunction) {
  try {
    // 檢查是否已處理
    const processedState = loadProcessedFinancialReportCompanies(jobId);
    if (processedState.processed.includes(company.ticker)) {
      Logger.log(`P1 財報可重入：跳過已處理公司（${company.ticker}）`);
      return {
        skipped: true,
        reason: "already_processed"
      };
    }
    
    // 標記為處理中
    markFinancialReportCompanyProcessing(jobId, company.ticker, company.market);
    
    // 執行處理（原子操作）
    const result = processFunction(company);
    
    // 標記為已完成
    const reportsCount = result.reports_count || (result.reports && result.reports.length) || 0;
    const extractionStatus = {
      success: result.success || false,
      reports_processed: reportsCount,
      extraction_results: result.extraction_results || []
    };
    markFinancialReportCompanyCompleted(jobId, company.ticker, reportsCount, extractionStatus);
    
    return result;
  } catch (error) {
    // 標記為失敗
    markFinancialReportCompanyFailed(jobId, company.ticker, error.message);
    
    Logger.log(`處理公司失敗（${company.ticker}）：${error.message}`);
    throw error;
  }
}
