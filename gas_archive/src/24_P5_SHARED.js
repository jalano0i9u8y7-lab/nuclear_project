/**
 * 📊 P5: Alpha 挖掘 - 共用模組
 * 
 * 提供 P5 所有頻率（Daily、Weekly、Monthly、Quarterly）共用的功能：
 * - 配置參數
 * - 快照管理
 * - 決策權限檢查
 * - 機構級視角整合
 * - M0 Job Queue 整合
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// P5 配置參數
// ==========================================

const P5_CONFIG = {
  // 執行頻率
  frequencies: {
    DAILY: "DAILY",
    WEEKLY: "WEEKLY",
    MONTHLY: "MONTHLY",
    QUARTERLY: "QUARTERLY"
  },
  
  // 機構級視角整合
  institutional_integration: {
    enabled: true,
    weight: 0.15  // 機構級視角權重 15%（P5 是 Alpha 挖掘，機構視角較重要）
  },
  
  // 數據收集配置
  data_collection: {
    ohlcv_sources: ["stooq.com"],  // OHLCV 數據源
    sector_etf_sources: ["stooq.com", "etfdb.com"],
    derivatives_sources: ["cboe.com", "theocc.com"],
    news_sources: ["reuters.com", "bloomberg.com", "wsj.com", "nikkei.com"]
  }
};

// ==========================================
// 快照管理
// ==========================================

/**
 * 獲取最新的 P5 Weekly 快照
 * 
 * @returns {Object|null} snapshot - 快照數據或 null
 */
function getLatestP5WeeklySnapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__WEEKLY_SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const row = sheet.getRange(lastRow, 1, 1, 14).getValues()[0];
    
    return {
      snapshot_id: row[0],
      created_at: row[1],
      p2_snapshot_id: row[2],
      p3_snapshot_id: row[3],
      p4_snapshot_id: row[4],
      market_analysis_json: row[5] ? JSON.parse(row[5]) : {},
      causality_chain_json: row[6] ? JSON.parse(row[6]) : {},
      risk_events_json: row[7] ? JSON.parse(row[7]) : {},
      derivatives_strategy_adjustment_json: row[8] ? JSON.parse(row[8]) : {},
      belief_update_json: row[9] ? JSON.parse(row[9]) : {},
      u_adjustment_json: row[10] ? JSON.parse(row[10]) : {},
      action_list_json: row[11] ? JSON.parse(row[11]) : {},
      trigger_decisions_json: row[12] ? JSON.parse(row[12]) : {},
      version: row[13] || "V7.1"
    };
  } catch (error) {
    Logger.log(`讀取 P5 Weekly 最新快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存 P5 Weekly 快照
 * 
 * @param {Object} snapshotData - 快照數據
 * @returns {Object} snapshot - 保存後的快照信息
 */
function saveP5WeeklySnapshot(snapshotData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P5__WEEKLY_SNAPSHOT");
  
  if (!sheet) {
    sheet = ss.insertSheet("P5__WEEKLY_SNAPSHOT");
    sheet.appendRow(P5_WEEKLY_SNAPSHOT_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  const snapshotId = generateP5SnapshotId("WEEKLY");
  
  sheet.appendRow([
    snapshotId,
    new Date(),
    snapshotData.p2_snapshot_id || null,
    snapshotData.p3_snapshot_id || null,
    snapshotData.p4_snapshot_id || null,
    JSON.stringify(snapshotData.market_analysis || {}),
    JSON.stringify(snapshotData.causality_chain || {}),
    JSON.stringify(snapshotData.risk_events || {}),
    JSON.stringify(snapshotData.derivatives_strategy_adjustment || {}),
    JSON.stringify(snapshotData.belief_update || {}),
    JSON.stringify(snapshotData.u_adjustment || {}),
    JSON.stringify(snapshotData.action_list || {}),
    JSON.stringify(snapshotData.trigger_decisions || {}),
    "V7.1"
  ]);
  
  Logger.log(`P5 Weekly 快照已保存：snapshot_id=${snapshotId}`);
  
  return {
    snapshot_id: snapshotId
  };
}

/**
 * 保存 P5 Monthly 快照
 * 
 * @param {Object} snapshotData - 快照數據
 * @returns {Object} snapshot - 保存後的快照信息
 */
function saveP5MonthlySnapshot(snapshotData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P5__MONTHLY_SNAPSHOT");
  
  if (!sheet) {
    sheet = ss.insertSheet("P5__MONTHLY_SNAPSHOT");
    sheet.appendRow(P5_MONTHLY_SNAPSHOT_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  const snapshotId = generateP5SnapshotId("MONTHLY");
  
  sheet.appendRow([
    snapshotId,
    new Date(),
    snapshotData.p2_snapshot_id || null,
    snapshotData.p3_snapshot_id || null,
    snapshotData.p4_snapshot_id || null,
    JSON.stringify(snapshotData.monthly_trend_analysis || {}),
    JSON.stringify(snapshotData.portfolio_performance || {}),
    JSON.stringify(snapshotData.strategy_adjustments || []),
    JSON.stringify(snapshotData.institutional_insights || {}),
    "V7.1"
  ]);
  
  Logger.log(`P5 Monthly 快照已保存：snapshot_id=${snapshotId}`);
  
  return {
    snapshot_id: snapshotId
  };
}

/**
 * 保存 P5 Quarterly 快照
 * 
 * @param {Object} snapshotData - 快照數據
 * @returns {Object} snapshot - 保存後的快照信息
 */
function saveP5QuarterlySnapshot(snapshotData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P5__QUARTERLY_SNAPSHOT");
  
  if (!sheet) {
    sheet = ss.insertSheet("P5__QUARTERLY_SNAPSHOT");
    sheet.appendRow(P5_QUARTERLY_SNAPSHOT_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  const snapshotId = generateP5SnapshotId("QUARTERLY");
  
  sheet.appendRow([
    snapshotId,
    new Date(),
    snapshotData.p2_snapshot_id || null,
    snapshotData.p3_snapshot_id || null,
    snapshotData.p4_snapshot_id || null,
    JSON.stringify(snapshotData.quarterly_review || {}),
    JSON.stringify(snapshotData.strategy_review || {}),
    JSON.stringify(snapshotData.next_quarter_outlook || {}),
    JSON.stringify(snapshotData.institutional_insights || {}),
    "V7.1"
  ]);
  
  Logger.log(`P5 Quarterly 快照已保存：snapshot_id=${snapshotId}`);
  
  return {
    snapshot_id: snapshotId
  };
}

/**
 * 生成 P5 快照 ID
 * 
 * @param {string} frequency - 執行頻率（DAILY/WEEKLY/MONTHLY/QUARTERLY）
 * @returns {string} snapshotId - 快照 ID
 */
function generateP5SnapshotId(frequency) {
  const date = new Date();
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  const month = date.getMonth() + 1;
  const quarter = Math.floor((date.getMonth() + 3) / 3);
  
  switch (frequency) {
    case "DAILY":
      return `P5_D${year}${String(date.getDate()).padStart(2, '0')}${String(month).padStart(2, '0')}_${Date.now()}`;
    case "WEEKLY":
      return `P5_W${year}W${week}_${Date.now()}`;
    case "MONTHLY":
      return `P5_M${year}M${month}_${Date.now()}`;
    case "QUARTERLY":
      return `P5_Q${year}Q${quarter}_${Date.now()}`;
    default:
      return `P5_${frequency}_${Date.now()}`;
  }
}

/**
 * 計算週數
 * 
 * @param {Date} date - 日期
 * @returns {number} week - 週數
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ==========================================
// 決策權限檢查
// ==========================================

/**
 * 檢查 P5 執行前的決策權限（快速檢查）
 * 
 * @param {string} frequency - 執行頻率（DAILY / WEEKLY / MONTHLY / QUARTERLY）
 * @param {Object} context - 上下文
 * @returns {boolean} allowed - 是否允許執行
 */
function checkP5DecisionHierarchy(frequency, context) {
  // 獲取 DEFCON 等級
  const defcon = context.defcon || getCurrentDEFCON();
  const p4_6_triggered = context.p4_6_triggered || false;
  
  // ⭐ P5 Daily 是數據收集，不應該被 DEFCON 限制（數據收集是基礎功能）
  // 只有在 P4.6 緊急撤退時才限制數據收集
  if (frequency === "DAILY") {
    if (p4_6_triggered) {
      Logger.log(`P5 ${frequency}：P4.6 緊急撤退觸發，數據收集仍可執行但標記為受限`);
      // 數據收集仍然允許，但會標記為受限狀態
      return true;
    }
    // P5 Daily 數據收集不受 DEFCON 限制
    return true;
  }
  
  // 其他頻率（WEEKLY / MONTHLY / QUARTERLY）需要檢查 DEFCON
  // 第一層檢查：系統級生存權
  if (defcon >= 3) {
    Logger.log(`P5 ${frequency}：DEFCON ${defcon} >= 3，執行受限（只能減碼或對沖）`);
    return false;  // 分析類操作受 DEFCON 限制
  }
  
  if (p4_6_triggered) {
    Logger.log(`P5 ${frequency}：P4.6 緊急撤退觸發，執行受限`);
    return false;
  }
  
  return true;
}

/**
 * 獲取當前 DEFCON 等級
 * 
 * @returns {number} defcon - DEFCON 等級（1-5）
 */
function getCurrentDEFCON() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("DEFCON_STATUS");  // 修正表格名稱（單下劃線）
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return 5;  // 默認 DEFCON 5（正常）
    }
    
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const defconCol = headers.indexOf("defcon_level");
    
    if (defconCol === -1) {
      // 如果找不到列，嘗試使用第 2 列（向後兼容）
      const defconValue = sheet.getRange(lastRow, 2).getValue();
      return defconValue || 5;
    }
    
    const defconValue = sheet.getRange(lastRow, defconCol + 1).getValue();
    return defconValue || 5;
  } catch (error) {
    Logger.log(`獲取當前 DEFCON 等級失敗：${error.message}`);
    return 5;  // 默認正常
  }
}

// ==========================================
// 機構級視角整合
// ==========================================

/**
 * 整合機構級視角到 P5 分析結果
 * 
 * @param {Object} p5Analysis - P5 分析結果
 * @param {Object} institutionalData - 機構級數據
 * @returns {Object} enhancedAnalysis - 增強後的分析結果
 */
function integrateInstitutionalPerspectiveP5(p5Analysis, institutionalData) {
  const enhanced = {
    ...p5Analysis,
    institutional_insights: {}
  };
  
  if (!institutionalData || Object.keys(institutionalData).length === 0) {
    Logger.log("P5：無機構級數據，跳過整合");
    return enhanced;
  }
  
  // 使用與 P3 類似的整合邏輯，但權重可能不同
  // 這裡先提供基礎框架，具體邏輯可根據 P5 的需求調整
  
  enhanced.institutional_insights = {
    f13f: institutionalData.f13f || null,
    dark_pool: institutionalData.dark_pool || null,
    options_flow: institutionalData.options_flow || null,
    insider_trading: institutionalData.insider_trading || null,
    weighted_signal: null  // 待計算
  };
  
  Logger.log("P5：機構級視角整合完成");
  
  return enhanced;
}

// ==========================================
// M0 Job Queue 整合
// ==========================================

/**
 * M0 同步執行（用於 P5 模組直接調用，不通過 Job Queue）
 * 
 * @param {string} jobId - 任務 ID
 * @param {Array} requestedFlow - 請求的流程步驟
 * @param {Object} inputPayload - 輸入負載
 * @returns {Object} executionResult - 執行結果
 */
function M0_Execute_Synchronous(jobId, requestedFlow, inputPayload) {
  try {
    // 從 inputPayload 中提取 projectId
    const projectId = inputPayload.phase || inputPayload.project_id || "P5_UNKNOWN";
    
    // 直接調用 executeFlow（不通過 Job Queue）
    const executionResult = executeFlow(jobId, projectId, requestedFlow, inputPayload);
    
    // 保存結果到 M0__RESULT（可選，如果需要持久化）
    try {
      saveJobResult(jobId, projectId, executionResult, 0); // executionTime 設為 0（同步執行）
    } catch (error) {
      Logger.log(`M0_Execute_Synchronous：保存結果失敗（可忽略）：${error.message}`);
    }
    
    return executionResult;
  } catch (error) {
    Logger.log(`M0_Execute_Synchronous：執行失敗：${error.message}`);
    throw error;
  }
}

/**
 * 提交任務到 M0 Job Queue
 * 
 * @param {string} projectId - 專案 ID（"P5_DAILY", "P5_WEEKLY", "P5_MONTHLY", "P5_QUARTERLY"）
 * @param {Array} requestedFlow - 請求的流程（例如：["GPT", "GEMINI_PRO"]）
 * @param {Object} inputPayload - 輸入數據
 * @returns {string} jobId - Job ID
 */
function submitP5ToM0JobQueue(projectId, requestedFlow, inputPayload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const jobQueueSheet = ss.getSheetByName("M0__JOB_QUEUE");
  
  if (!jobQueueSheet) {
    throw new Error("M0__JOB_QUEUE 表格不存在");
  }
  
  const jobId = `JOB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  jobQueueSheet.appendRow([
    jobId,
    projectId,
    "NEW",
    JSON.stringify(requestedFlow),
    JSON.stringify(inputPayload),
    null,
    null,
    null,
    null,
    0,
    new Date()
  ]);
  
  Logger.log(`P5 任務已提交到 M0 Job Queue：job_id=${jobId}, project_id=${projectId}`);
  
  return jobId;
}
