/**
 * 🧪 測試輔助函數
 * 
 * 提供測試用的輔助函數，方便快速測試系統功能
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// 測試任務創建
// ==========================================

/**
 * 創建測試任務到 M0 Job Queue
 * 
 * @param {string} projectId - 項目 ID（P0, P1, P2, P3, P5_WEEKLY 等）
 * @param {Array} requestedFlow - 請求的流程步驟
 * @param {Object} inputPayload - 輸入負載
 * @returns {string} jobId - 創建的任務 ID
 */
function createTestJob(projectId, requestedFlow, inputPayload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let jobQueueSheet = ss.getSheetByName("M0__JOB_QUEUE");
  
  if (!jobQueueSheet) {
    throw new Error("M0__JOB_QUEUE 表格不存在，請先執行 initializeAllSheets()");
  }
  
  // 生成任務 ID
  const timestamp = new Date().getTime();
  const jobId = `TEST_${projectId}_${timestamp}`;
  
  // 添加任務到表格
  jobQueueSheet.appendRow([
    jobId,
    projectId,
    "NEW",
    JSON.stringify(requestedFlow),
    JSON.stringify(inputPayload),
    null,  // started_at
    null,  // finished_at
    null,  // error_code
    null,  // error_message
    0,     // retry_count
    new Date()  // created_at
  ]);
  
  Logger.log(`測試任務已創建：${jobId}`);
  return jobId;
}

/**
 * 創建簡單的測試任務（使用預設流程）
 * 
 * @param {string} projectId - 項目 ID
 * @param {Object} inputPayload - 輸入負載
 * @returns {string} jobId - 創建的任務 ID
 */
function createSimpleTestJob(projectId, inputPayload) {
  // 預設流程：執行者 → 審查者
  const defaultFlow = ["EXECUTOR", "AUDITOR"];
  return createTestJob(projectId, defaultFlow, inputPayload);
}

/**
 * 創建包含 FACT_CHECK 的測試任務（測試自我質疑機制）
 * 
 * @param {string} projectId - 項目 ID
 * @param {string} question - 問題內容
 * @param {Object} additionalPayload - 額外的輸入負載
 * @returns {string} jobId - 創建的任務 ID
 */
function createFactCheckTestJob(projectId, question, additionalPayload = {}) {
  const inputPayload = {
    ...additionalPayload,
    test: true,
    force_audit_questions: [
      {
        type: "FACT_CHECK",
        question: question,
        context: "測試自我質疑機制",
        importance: "HIGH"
      }
    ],
    // 預先設置 search_query，供 CSE_SEARCH_UNRESTRICTED 使用
    search_query: question
  };
  
  // 包含無限制 CSE 搜尋的流程
  // 注意：CSE_SEARCH_UNRESTRICTED 會在 AUDITOR 步驟中自動觸發，這裡不需要手動添加
  const flow = ["EXECUTOR", "AUDITOR"];
  
  return createTestJob(projectId, flow, inputPayload);
}

// ==========================================
// 測試數據準備
// ==========================================

/**
 * 準備 P5 Daily 測試數據
 * 
 * @param {Array} tickers - 股票代碼列表
 * @returns {Object} testData - 測試數據
 */
function prepareP5DailyTestData(tickers = ["AAPL", "MSFT", "GOOGL"]) {
  return {
    tickers: tickers,
    date: new Date(),
    check_taiwan_orders: false
  };
}

/**
 * 準備 P0 測試數據
 * 
 * @param {Object} options - 測試選項
 * @returns {Object} testData - 測試數據
 */
function prepareP0TestData(options = {}) {
  return {
    theme_focus: options.theme_focus || "AI",
    geographic_focus: options.geographic_focus || "US",
    time_horizon: options.time_horizon || "MEDIUM",
    test: true
  };
}

// ==========================================
// 測試執行
// ==========================================

/**
 * 執行測試任務並返回結果
 * 
 * @param {string} jobId - 任務 ID
 * @returns {Object} result - 執行結果
 */
function executeTestJob(jobId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const jobQueueSheet = ss.getSheetByName("M0__JOB_QUEUE");
  
  if (!jobQueueSheet) {
    throw new Error("M0__JOB_QUEUE 表格不存在");
  }
  
  // 查找任務
  const dataRange = jobQueueSheet.getDataRange();
  const rows = dataRange.getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === jobId) {
      // 執行任務
      const result = executeJob(jobId, rows[i]);
      
      // 更新狀態
      jobQueueSheet.getRange(i + 1, 3).setValue("DONE");
      jobQueueSheet.getRange(i + 1, 7).setValue(new Date());
      
      return result;
    }
  }
  
  throw new Error(`任務 ${jobId} 不存在`);
}

/**
 * 快速測試：創建並執行一個簡單任務
 * 
 * @param {string} projectId - 項目 ID
 * @param {Object} inputPayload - 輸入負載
 * @returns {Object} result - 執行結果
 */
function quickTest(projectId, inputPayload) {
  const jobId = createSimpleTestJob(projectId, inputPayload);
  Logger.log(`快速測試：創建任務 ${jobId}，開始執行...`);
  
  return executeTestJob(jobId);
}

// ==========================================
// 測試結果檢查
// ==========================================

/**
 * 檢查任務執行結果
 * 
 * @param {string} jobId - 任務 ID
 * @returns {Object} checkResult - 檢查結果
 */
function checkTestResult(jobId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 檢查 Job Queue
  const jobQueueSheet = ss.getSheetByName("M0__JOB_QUEUE");
  const jobQueueRows = jobQueueSheet.getDataRange().getValues();
  const jobRow = jobQueueRows.find(row => row[0] === jobId);
  
  if (!jobRow) {
    return {
      found: false,
      error: "任務不存在"
    };
  }
  
  const status = jobRow[2];
  const errorCode = jobRow[7];
  const errorMessage = jobRow[8];
  
  // 檢查 Result
  const resultSheet = ss.getSheetByName("M0__RESULT");
  let resultRow = null;
  if (resultSheet) {
    const resultRows = resultSheet.getDataRange().getValues();
    resultRow = resultRows.find(row => row[0] === jobId);
  }
  
  // 檢查 Crosscheck Log
  const logSheet = ss.getSheetByName("M0__CROSSCHECK_LOG");
  let logRows = [];
  if (logSheet) {
    const allLogRows = logSheet.getDataRange().getValues();
    logRows = allLogRows.filter(row => row[0] === jobId);
  }
  
  return {
    found: true,
    status: status,
    error_code: errorCode,
    error_message: errorMessage,
    has_result: resultRow !== null,
    result: resultRow ? {
      final_output: resultRow[2],
      used_models: resultRow[3],
      finished_at: resultRow[4]
    } : null,
    crosscheck_log_count: logRows.length,
    crosscheck_logs: logRows.map(row => ({
      step: row[1],
      model_id: row[2],
      note: row[6]
    }))
  };
}

/**
 * 打印測試結果摘要
 * 
 * @param {string} jobId - 任務 ID
 */
function printTestResultSummary(jobId) {
  const result = checkTestResult(jobId);
  
  Logger.log("=".repeat(50));
  Logger.log(`測試結果摘要：${jobId}`);
  Logger.log("=".repeat(50));
  Logger.log(`狀態：${result.status}`);
  
  if (result.error_code) {
    Logger.log(`錯誤代碼：${result.error_code}`);
    Logger.log(`錯誤訊息：${result.error_message}`);
  }
  
  Logger.log(`有結果記錄：${result.has_result ? "是" : "否"}`);
  Logger.log(`審計鏈記錄數：${result.crosscheck_log_count}`);
  
  if (result.crosscheck_logs.length > 0) {
    Logger.log("\n審計鏈記錄：");
    result.crosscheck_logs.forEach((log, index) => {
      Logger.log(`  ${index + 1}. ${log.step} (${log.model_id}) - ${log.note || "無備註"}`);
    });
  }
  
  Logger.log("=".repeat(50));
}

// ==========================================
// 完整測試流程
// ==========================================

/**
 * 執行完整的基礎功能測試
 */
function runBasicTests() {
  Logger.log("開始執行基礎功能測試...");
  
  // 測試 1：簡單任務創建和執行
  Logger.log("\n測試 1：簡單任務創建和執行");
  try {
    const jobId1 = createSimpleTestJob("P0", {
      test: true,
      message: "這是一個基礎測試任務"
    });
    const result1 = executeTestJob(jobId1);
    printTestResultSummary(jobId1);
    Logger.log("✓ 測試 1 通過");
  } catch (error) {
    Logger.log(`✗ 測試 1 失敗：${error.message}`);
  }
  
  // 測試 2：FACT_CHECK 機制
  Logger.log("\n測試 2：FACT_CHECK 機制");
  try {
    const jobId2 = createFactCheckTestJob("P0", "Apple Inc. 最新財報日期是什麼時候？");
    const result2 = executeTestJob(jobId2);
    printTestResultSummary(jobId2);
    Logger.log("✓ 測試 2 通過");
  } catch (error) {
    Logger.log(`✗ 測試 2 失敗：${error.message}`);
  }
  
  Logger.log("\n基礎功能測試完成！");
}

/**
 * 測試 P5 Daily 數據收集
 */
function testP5Daily() {
  Logger.log("開始測試 P5 Daily 數據收集...");
  
  try {
    const testData = prepareP5DailyTestData(["AAPL", "MSFT"]);
    const result = P5_Daily_Execute(testData);
    
    Logger.log("P5 Daily 執行結果：", JSON.stringify(result, null, 2));
    Logger.log("✓ P5 Daily 測試通過");
  } catch (error) {
    Logger.log(`✗ P5 Daily 測試失敗：${error.message}`);
    Logger.log("錯誤堆疊：", error.stack);
  }
}
