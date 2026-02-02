/**
 * 📊 監控與日誌功能
 * 
 * 執行時間監控、成本監控、數據完整性監控、錯誤日誌
 * 
 * @version SSOT V6.3
 * @date 2025-01-11
 */

// ==========================================
// 執行時間監控
// ==========================================

/**
 * 監控執行時間（超過閾值告警）
 * @param {string} phase - Phase 名稱
 * @param {number} duration - 執行時間（毫秒）
 */
function monitorExecutionTime(phase, duration) {
  const threshold = getExecutionTimeThreshold(phase);
  
  if (duration > threshold) {
    // 超過閾值，記錄警告
    appendToMonitoringLog({
      phase: phase,
      duration_ms: duration,
      status: "WARNING",
      message: `執行時間超過閾值：${duration}ms > ${threshold}ms`
    });
    
    // 發送告警（可選）
    sendAlert({
      type: "EXECUTION_TIME_EXCEEDED",
      phase: phase,
      duration: duration,
      threshold: threshold
    });
  } else {
    // 正常，記錄 OK
    appendToMonitoringLog({
      phase: phase,
      duration_ms: duration,
      status: "OK",
      message: null
    });
  }
}

/**
 * 記錄到監控日誌
 * @param {Object} logData - 日誌數據
 */
function appendToMonitoringLog(logData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("MONITORING_LOG");
    
    if (!sheet) {
      // 如果表不存在，創建它
      sheet = ss.insertSheet("MONITORING_LOG");
      sheet.appendRow([
        "timestamp",
        "phase",
        "duration_ms",
        "status",
        "job_id",
        "error_message",
        "cost_estimate"
      ]);
    }
    
    sheet.appendRow([
      new Date(),
      logData.phase || "",
      logData.duration_ms || 0,
      logData.status || "OK",
      logData.job_id || "",
      logData.error_message || logData.message || "",
      logData.cost_estimate || 0
    ]);
  } catch (error) {
    Logger.log(`記錄監控日誌失敗：${error.message}`);
  }
}

// ==========================================
// 成本監控
// ==========================================

/**
 * 監控成本（每日成本超過預算告警）
 * @param {string} jobId - 任務 ID
 * @param {string} phase - Phase 名稱
 * @param {Object} costData - 成本數據
 */
function monitorCost(jobId, phase, costData) {
  const dailyCost = getDailyCost();
  const monthlyBudget = 24;  // $24/月
  const dailyBudget = monthlyBudget / 30;  // 每日預算約 $0.8
  
  // 估算成本
  const estimatedCost = costData.cost || estimateCost(costData.model, costData.inputTokens || 0, costData.outputTokens || 0);
  
  // 更新每日成本
  updateDailyCost(estimatedCost);
  
  // 記錄到監控日誌
  appendToMonitoringLog({
    phase: phase,
    job_id: jobId,
    cost_estimate: estimatedCost,
    status: "OK",
    message: null
  });
  
  // 檢查是否超過預算
  const newDailyCost = getDailyCost();
  
  if (newDailyCost > dailyBudget) {
    sendAlert({
      type: "COST_EXCEEDED",
      daily_cost: newDailyCost,
      daily_budget: dailyBudget,
      monthly_budget: monthlyBudget
    });
  }
}

/**
 * 獲取今日成本（從 PropertiesService 讀取）
 * @return {number} 今日成本（美元）
 */
function getDailyCost() {
  const properties = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const keyName = `DAILY_COST_${today}`;
  const cost = properties.getProperty(keyName);
  
  return cost ? parseFloat(cost) : 0;
}

/**
 * 更新每日成本
 * @param {number} cost - 新增成本（美元）
 */
function updateDailyCost(cost) {
  const properties = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const keyName = `DAILY_COST_${today}`;
  
  const currentCost = getDailyCost();
  const newCost = currentCost + cost;
  
  properties.setProperty(keyName, newCost.toString());
  
  Logger.log(`更新每日成本：${today} = $${newCost.toFixed(4)}`);
}

/**
 * 重置每日成本（供定時任務調用，每天午夜重置）
 */
function resetDailyCost() {
  const properties = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const keyName = `DAILY_COST_${today}`;
  
  properties.deleteProperty(keyName);
  Logger.log(`重置每日成本：${today}`);
}

// ==========================================
// 數據完整性監控
// ==========================================

/**
 * 監控數據完整性（檢查快照完整性、數據時效性）
 */
function monitorDataIntegrity() {
  const issues = [];
  
  try {
    // 檢查必要快照是否存在
    const p2_latest = getLatestP2Snapshot();
    const p3_latest = getLatestP3Snapshot();
    const p4_latest = getLatestP4Snapshot();
    
    if (!p2_latest) {
      issues.push({
        type: "MISSING_SNAPSHOT",
        phase: "P2",
        message: "缺少 P2 最新快照"
      });
    }
    
    if (!p3_latest) {
      issues.push({
        type: "MISSING_SNAPSHOT",
        phase: "P3",
        message: "缺少 P3 最新快照"
      });
    }
    
    if (!p4_latest) {
      issues.push({
        type: "MISSING_SNAPSHOT",
        phase: "P4",
        message: "缺少 P4 最新快照"
      });
    }
    
    // 檢查數據時效性
    const p5_daily_last = getLastP5DailyDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!p5_daily_last || p5_daily_last < today) {
      issues.push({
        type: "DATA_STALENESS",
        phase: "P5_DAILY",
        message: `P5 Daily 數據超過 1 天未更新（最後更新：${p5_daily_last || '無'}）`
      });
    }
    
    // 如果有問題，發送告警
    if (issues.length > 0) {
      sendAlert({
        type: "DATA_INTEGRITY_ERROR",
        issues: issues
      });
      
      Logger.log(`數據完整性檢查發現 ${issues.length} 個問題：${JSON.stringify(issues)}`);
    } else {
      Logger.log("數據完整性檢查通過");
    }
  } catch (error) {
    Logger.log(`數據完整性檢查失敗：${error.message}`);
    
    sendAlert({
      type: "MONITORING_ERROR",
      message: `數據完整性檢查失敗：${error.message}`
    });
  }
}

// ==========================================
// 錯誤日誌
// ==========================================

/**
 * 記錄錯誤日誌
 * @param {Object} errorData - 錯誤數據
 */
function logError(errorData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("MONITORING_LOG");
    
    if (!sheet) {
      sheet = ss.insertSheet("MONITORING_LOG");
      sheet.appendRow([
        "timestamp",
        "phase",
        "duration_ms",
        "status",
        "job_id",
        "error_message",
        "cost_estimate"
      ]);
    }
    
    sheet.appendRow([
      errorData.timestamp || new Date(),
      errorData.phase || errorData.job_id?.split("_")[0] || "UNKNOWN",
      errorData.execution_time || 0,
      "ERROR",
      errorData.job_id || "",
      `${errorData.error}${errorData.stack ? '\n' + errorData.stack : ''}`.substring(0, 5000),  // 限制長度
      0
    ]);
  } catch (error) {
    Logger.log(`記錄錯誤日誌失敗：${error.message}`);
  }
}

/**
 * 記錄重試日誌
 * @param {Object} retryData - 重試數據
 */
function logRetry(retryData) {
  Logger.log(`任務 ${retryData.job_id} 重試（第 ${retryData.retry_count} 次）：${retryData.error}`);
  
  // 也可以記錄到監控日誌
  appendToMonitoringLog({
    phase: retryData.job_id?.split("_")[0] || "UNKNOWN",
    job_id: retryData.job_id,
    status: "RETRY",
    message: `重試第 ${retryData.retry_count} 次：${retryData.error}`,
    duration_ms: 0,
    cost_estimate: 0
  });
}

// ==========================================
// 告警機制（可選，可擴展為 Email、Slack 等）
// ==========================================

/**
 * 發送告警（目前僅記錄到日誌，可擴展為 Email、Slack 等）
 * @param {Object} alertData - 告警數據
 */
function sendAlert(alertData) {
  Logger.log(`告警 [${alertData.type}]：${JSON.stringify(alertData)}`);
  
  // TODO: 可擴展為發送 Email、Slack 等
  // 例如：
  // MailApp.sendEmail({
  //   to: "admin@example.com",
  //   subject: `告警：${alertData.type}`,
  //   body: JSON.stringify(alertData, null, 2)
  // });
}

// ==========================================
// 輔助函數（從快照管理模組導入）
// ==========================================

/**
 * 獲取最新快照（從 06_SNAPSHOT_MANAGER.js 導入）
 * @param {string} phase - Phase 名稱
 * @return {Object|null} 最新快照
 */
// 注意：這些函數已在 06_SNAPSHOT_MANAGER.js 中實現
// getLatestP2Snapshot() - 已在 06_SNAPSHOT_MANAGER.js 中定義
// getLatestP3Snapshot() - 已在 06_SNAPSHOT_MANAGER.js 中定義
// getLatestP4Snapshot() - 已在 06_SNAPSHOT_MANAGER.js 中定義
