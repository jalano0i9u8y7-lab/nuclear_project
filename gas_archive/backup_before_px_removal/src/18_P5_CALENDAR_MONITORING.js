/**
 * 📅 P5 財經事件監控與異常檢測系統 ⭐ V8.0 新增
 * 
 * 功能：
 * 1. 關鍵數據監控（10-14天前開始）
 * 2. 異常檢測與報警
 * 3. 市場反應收集（事件後7-10天）
 * 4. 經驗快照建立與索引
 * 
 * @version SSOT V8.0
 * @date 2026-01-19
 */

// ==========================================
// 關鍵數據監控
// ==========================================

/**
 * 開始監控事件的關鍵數據（10-14天前）
 * @param {string} eventId - 事件 ID
 * @param {Date} eventDate - 事件日期
 * @returns {Object} 監控結果
 */
function startEventKeyMetricsMonitoring(eventId, eventDate) {
  try {
    Logger.log(`開始監控事件關鍵數據：eventId=${eventId}, eventDate=${eventDate}`);
    
    const today = new Date();
    const daysUntilEvent = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
    
    // 檢查是否在監控窗口內（10-14天前）
    if (daysUntilEvent < P5_CALENDAR_CONFIG.alert_windows.MONITOR_START || 
        daysUntilEvent > P5_CALENDAR_CONFIG.alert_windows.MONITOR_START + 4) {
      Logger.log(`事件 ${eventId} 不在監控窗口內（當前距離 ${daysUntilEvent} 天）`);
      return { status: "OUT_OF_WINDOW", days_until_event: daysUntilEvent };
    }
    
    // 收集關鍵數據
    const keyMetrics = collectKeyMetrics(eventId);
    
    // 檢測異常
    const anomalies = detectAnomalies(eventId, keyMetrics);
    
    // 保存監控記錄
    saveMonitoringRecord(eventId, {
      monitoring_date: today,
      days_until_event: daysUntilEvent,
      key_metrics: keyMetrics,
      anomalies: anomalies,
      status: "MONITORING"
    });
    
    // 如果有異常，觸發報警
    if (anomalies.length > 0) {
      triggerAnomalyAlert(eventId, anomalies);
    }
    
    return {
      status: "MONITORING",
      days_until_event: daysUntilEvent,
      key_metrics: keyMetrics,
      anomalies: anomalies
    };
    
  } catch (error) {
    Logger.log(`監控事件關鍵數據失敗：${error.message}`);
    throw error;
  }
}

/**
 * 收集關鍵數據
 * @param {string} eventId - 事件 ID
 * @returns {Object} 關鍵數據
 */
function collectKeyMetrics(eventId) {
  const metrics = {};
  
  // Sector ETF Flow
  try {
    const sectorFlow = getSectorETFFlow();
    metrics.sector_etf_flow = sectorFlow;
  } catch (e) {
    Logger.log(`收集 Sector ETF Flow 失敗：${e.message}`);
  }
  
  // Mag7 相對強弱
  try {
    const mag7Strength = getMag7RelativeStrength();
    metrics.mag7_relative_strength = mag7Strength;
  } catch (e) {
    Logger.log(`收集 Mag7 相對強弱失敗：${e.message}`);
  }
  
  // VIX 水平
  try {
    const vix = getVIXLevel();
    metrics.vix_level = vix;
  } catch (e) {
    Logger.log(`收集 VIX 水平失敗：${e.message}`);
  }
  
  // 市場廣度
  try {
    const breadth = getMarketBreadth();
    metrics.market_breadth = breadth;
  } catch (e) {
    Logger.log(`收集市場廣度失敗：${e.message}`);
  }
  
  // 期權流向
  try {
    const optionsFlow = getOptionsFlow();
    metrics.options_flow = optionsFlow;
  } catch (e) {
    Logger.log(`收集期權流向失敗：${e.message}`);
  }
  
  // 內部人交易
  try {
    const insiderTrading = getInsiderTrading();
    metrics.insider_trading = insiderTrading;
  } catch (e) {
    Logger.log(`收集內部人交易失敗：${e.message}`);
  }
  
  return metrics;
}

/**
 * 檢測異常
 * @param {string} eventId - 事件 ID
 * @param {Object} currentMetrics - 當前關鍵數據
 * @returns {Array} 異常列表
 */
function detectAnomalies(eventId, currentMetrics) {
  const anomalies = [];
  const threshold = P5_CALENDAR_CONFIG.key_metrics_monitoring.anomaly_threshold;
  
  // 獲取歷史基準（前30天平均值）
  const historicalBaseline = getHistoricalBaseline(eventId, 30);
  
  // 檢測每個關鍵數據的異常
  for (const [metric, value] of Object.entries(currentMetrics)) {
    if (!historicalBaseline[metric]) {
      continue;  // 沒有歷史基準，跳過
    }
    
    const baseline = historicalBaseline[metric];
    const deviation = Math.abs((value - baseline) / baseline);
    
    if (deviation > threshold) {
      anomalies.push({
        metric: metric,
        current_value: value,
        baseline_value: baseline,
        deviation: deviation,
        severity: deviation > threshold * 2 ? "HIGH" : "MEDIUM"
      });
    }
  }
  
  return anomalies;
}

/**
 * 獲取歷史基準
 * @param {string} eventId - 事件 ID
 * @param {number} days - 歷史天數
 * @returns {Object} 歷史基準數據
 */
function getHistoricalBaseline(eventId, days) {
  // 從監控記錄中讀取歷史數據
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("P5__CALENDAR_MONITORING");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return {};  // 沒有歷史數據，返回空對象
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const eventIdCol = headers.indexOf("event_id");
  const metricsCol = headers.indexOf("key_metrics_json");
  const dateCol = headers.indexOf("monitoring_date");
  
  if (eventIdCol === -1 || metricsCol === -1 || dateCol === -1) {
    return {};
  }
  
  const today = new Date();
  const cutoffDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  
  const historicalMetrics = [];
  
  for (let i = 1; i < rows.length; i++) {
    const rowEventId = rows[i][eventIdCol];
    const rowDate = new Date(rows[i][dateCol]);
    const metricsJson = rows[i][metricsCol];
    
    if (rowEventId === eventId && rowDate >= cutoffDate && metricsJson) {
      try {
        const metrics = JSON.parse(metricsJson);
        historicalMetrics.push(metrics);
      } catch (e) {
        // 解析失敗，跳過
      }
    }
  }
  
  // 計算平均值
  if (historicalMetrics.length === 0) {
    return {};
  }
  
  const baseline = {};
  const metricKeys = Object.keys(historicalMetrics[0]);
  
  for (const key of metricKeys) {
    const values = historicalMetrics.map(m => m[key]).filter(v => v !== null && v !== undefined);
    if (values.length > 0) {
      baseline[key] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }
  
  return baseline;
}

/**
 * 觸發異常報警
 * @param {string} eventId - 事件 ID
 * @param {Array} anomalies - 異常列表
 */
function triggerAnomalyAlert(eventId, anomalies) {
  Logger.log(`⚠️ 事件 ${eventId} 檢測到 ${anomalies.length} 個異常`);
  
  // 保存報警記錄
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P5__CALENDAR_ALERTS");
  
  if (!sheet) {
    sheet = ss.insertSheet("P5__CALENDAR_ALERTS");
    sheet.appendRow([
      "alert_id",
      "event_id",
      "alert_date",
      "anomalies_json",
      "severity",
      "status",
      "created_at"
    ]);
    sheet.setFrozenRows(1);
  }
  
  const maxSeverity = anomalies.reduce((max, a) => {
    return a.severity === "HIGH" ? "HIGH" : max;
  }, "MEDIUM");
  
  sheet.appendRow([
    `ALERT_${eventId}_${Date.now()}`,
    eventId,
    new Date(),
    JSON.stringify(anomalies),
    maxSeverity,
    "ACTIVE",
    new Date()
  ]);
  
  // 可以在此處添加其他報警機制（例如：Email、Telegram 等）
}

/**
 * 保存監控記錄
 * @param {string} eventId - 事件 ID
 * @param {Object} record - 監控記錄
 */
function saveMonitoringRecord(eventId, record) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P5__CALENDAR_MONITORING");
  
  if (!sheet) {
    sheet = ss.insertSheet("P5__CALENDAR_MONITORING");
    sheet.appendRow([
      "monitoring_id",
      "event_id",
      "monitoring_date",
      "days_until_event",
      "key_metrics_json",
      "anomalies_json",
      "status",
      "created_at"
    ]);
    sheet.setFrozenRows(1);
  }
  
  sheet.appendRow([
    `MONITOR_${eventId}_${Date.now()}`,
    eventId,
    record.monitoring_date,
    record.days_until_event,
    JSON.stringify(record.key_metrics),
    JSON.stringify(record.anomalies),
    record.status,
    new Date()
  ]);
}

// ==========================================
// 市場反應收集（事件後7-10天）
// ==========================================

/**
 * 收集事件後的市場反應（事件後7-10天）
 * @param {string} eventId - 事件 ID
 * @param {Date} eventDate - 事件日期
 * @returns {Object} 市場反應數據
 */
function collectPostEventMarketReaction(eventId, eventDate) {
  try {
    Logger.log(`收集事件後市場反應：eventId=${eventId}, eventDate=${eventDate}`);
    
    const today = new Date();
    const daysSinceEvent = Math.floor((today - eventDate) / (1000 * 60 * 60 * 24));
    
    // 檢查是否在監控窗口內（事件後7-10天）
    if (daysSinceEvent < 7 || daysSinceEvent > P5_CALENDAR_CONFIG.alert_windows.POST_MONITOR_END) {
      Logger.log(`事件 ${eventId} 不在監控窗口內（當前距離 ${daysSinceEvent} 天）`);
      return { status: "OUT_OF_WINDOW", days_since_event: daysSinceEvent };
    }
    
    // 收集市場反應數據
    const marketReaction = {
      event_id: eventId,
      event_date: eventDate,
      collection_date: today,
      days_since_event: daysSinceEvent,
      
      // 市場指數反應
      index_reaction: collectIndexReaction(eventDate, today),
      
      // Sector ETF 反應
      sector_reaction: collectSectorReaction(eventDate, today),
      
      // 相關個股反應
      stock_reaction: collectStockReaction(eventId, eventDate, today),
      
      // 異常檢測
      anomalies: detectPostEventAnomalies(eventId, eventDate, today)
    };
    
    // 建立經驗快照
    const experienceSnapshot = createExperienceSnapshot(eventId, marketReaction);
    
    // 保存到學習系統記憶庫
    saveToLearningMemory(eventId, experienceSnapshot);
    
    return {
      status: "COLLECTED",
      market_reaction: marketReaction,
      experience_snapshot: experienceSnapshot
    };
    
  } catch (error) {
    Logger.log(`收集事件後市場反應失敗：${error.message}`);
    throw error;
  }
}

/**
 * 收集指數反應
 * @param {Date} eventDate - 事件日期
 * @param {Date} today - 今天日期
 * @returns {Object} 指數反應數據
 */
function collectIndexReaction(eventDate, today) {
  // 從市場數據表格讀取指數變化
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return {};
  }
  
  // 讀取事件日期和今天的指數數據
  // 這裡簡化處理，實際應該讀取具體的指數數據
  return {
    sp500_change: null,  // 需要實際讀取
    nasdaq_change: null,
    dow_change: null,
    vix_change: null
  };
}

/**
 * 收集 Sector 反應
 * @param {Date} eventDate - 事件日期
 * @param {Date} today - 今天日期
 * @returns {Object} Sector 反應數據
 */
function collectSectorReaction(eventDate, today) {
  // 從 Sector ETF 表格讀取
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("SECTOR_ETF_DAILY");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return {};
  }
  
  // 讀取 Sector ETF 變化
  return {};  // 需要實際讀取
}

/**
 * 收集個股反應
 * @param {string} eventId - 事件 ID
 * @param {Date} eventDate - 事件日期
 * @param {Date} today - 今天日期
 * @returns {Object} 個股反應數據
 */
function collectStockReaction(eventId, eventDate, today) {
  // 從事件配置中獲取相關個股列表
  const event = getEventById(eventId);
  if (!event) {
    return {};
  }
  
  // 從相關個股的 OHLCV 數據讀取反應
  // 這裡簡化處理，實際應該讀取具體的個股數據
  return {};  // 需要實際讀取
}

/**
 * 檢測事件後異常
 * @param {string} eventId - 事件 ID
 * @param {Date} eventDate - 事件日期
 * @param {Date} today - 今天日期
 * @returns {Array} 異常列表
 */
function detectPostEventAnomalies(eventId, eventDate, today) {
  // 與歷史經驗比對，檢測異常
  const historicalExperience = getHistoricalExperience(eventId);
  
  if (!historicalExperience || historicalExperience.length === 0) {
    return [];  // 沒有歷史經驗，無法檢測異常
  }
  
  // 計算歷史平均反應
  const avgReaction = calculateAverageReaction(historicalExperience);
  
  // 獲取當前反應
  const currentReaction = collectPostEventMarketReaction(eventId, eventDate);
  
  // 比對並檢測異常
  const anomalies = [];
  // 這裡簡化處理，實際應該詳細比對各個指標
  
  return anomalies;
}

/**
 * 建立經驗快照
 * @param {string} eventId - 事件 ID
 * @param {Object} marketReaction - 市場反應數據
 * @returns {Object} 經驗快照
 */
function createExperienceSnapshot(eventId, marketReaction) {
  const event = getEventById(eventId);
  
  return {
    snapshot_id: `EXP_${eventId}_${Date.now()}`,
    event_id: eventId,
    event_name: event?.event_name || "",
    event_type: event?.event_type || "",
    event_date: marketReaction.event_date,
    collection_date: marketReaction.collection_date,
    days_since_event: marketReaction.days_since_event,
    
    // 市場反應摘要
    market_reaction_summary: {
      index_change_avg: calculateAverageIndexChange(marketReaction.index_reaction),
      sector_change_avg: calculateAverageSectorChange(marketReaction.sector_reaction),
      stock_change_avg: calculateAverageStockChange(marketReaction.stock_reaction)
    },
    
    // 異常摘要
    anomalies_summary: marketReaction.anomalies,
    
    // 經驗標籤（用於索引）
    experience_tags: generateExperienceTags(marketReaction),
    
    // 原始數據引用
    raw_data_ref: marketReaction,
    
    created_at: new Date()
  };
}

/**
 * 保存到學習系統記憶庫
 * @param {string} eventId - 事件 ID
 * @param {Object} experienceSnapshot - 經驗快照
 */
function saveToLearningMemory(eventId, experienceSnapshot) {
  // 保存到 P5__CALENDAR_HISTORY 表格
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P5__CALENDAR_HISTORY");
  
  if (!sheet) {
    // 如果表格不存在，創建它
    sheet = ss.insertSheet("P5__CALENDAR_HISTORY");
    sheet.appendRow([
      "history_id",
      "event_id",
      "event_name",
      "year",
      "window_type",
      "date_range_start",
      "date_range_end",
      "ticker_performance_json",
      "index_performance_json",
      "statistics_json",
      "experience_snapshot_json",
      "created_at"
    ]);
    sheet.setFrozenRows(1);
  }
  
  const year = new Date(experienceSnapshot.event_date).getFullYear();
  const windowType = experienceSnapshot.days_since_event <= 3 ? "EVENT_DAY" : 
                     experienceSnapshot.days_since_event <= 7 ? "POST_WINDOW" : "EXTENDED_POST";
  
  sheet.appendRow([
    experienceSnapshot.snapshot_id,
    eventId,
    experienceSnapshot.event_name,
    year,
    windowType,
    Utilities.formatDate(experienceSnapshot.event_date, Session.getScriptTimeZone(), "yyyy-MM-dd"),
    Utilities.formatDate(experienceSnapshot.collection_date, Session.getScriptTimeZone(), "yyyy-MM-dd"),
    JSON.stringify(experienceSnapshot.market_reaction_summary.stock_change_avg || {}),
    JSON.stringify(experienceSnapshot.market_reaction_summary.index_change_avg || {}),
    JSON.stringify(experienceSnapshot.market_reaction_summary),
    JSON.stringify(experienceSnapshot),
    new Date()
  ]);
  
  // 更新事件記錄的學習歷史
  updateEventLearningHistory(eventId, experienceSnapshot);
}

/**
 * 更新事件學習歷史
 * @param {string} eventId - 事件 ID
 * @param {Object} experienceSnapshot - 經驗快照
 */
function updateEventLearningHistory(eventId, experienceSnapshot) {
  const event = getEventById(eventId);
  if (!event) {
    return;
  }
  
  // 讀取現有學習歷史
  let learningHistory = [];
  if (event.learning_history_json) {
    try {
      learningHistory = JSON.parse(event.learning_history_json);
    } catch (e) {
      learningHistory = [];
    }
  }
  
  // 添加新的經驗快照
  learningHistory.push({
    snapshot_id: experienceSnapshot.snapshot_id,
    collection_date: experienceSnapshot.collection_date,
    market_reaction_summary: experienceSnapshot.market_reaction_summary,
    experience_tags: experienceSnapshot.experience_tags
  });
  
  // 只保留最近 N 次記錄
  if (learningHistory.length > 10) {
    learningHistory = learningHistory.slice(-10);
  }
  
  // 更新事件記錄
  updateEventRecord(eventId, {
    learning_history_json: JSON.stringify(learningHistory),
    last_updated: new Date().toISOString()
  });
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 生成經驗標籤（用於索引）
 * @param {Object} marketReaction - 市場反應數據
 * @returns {Array} 經驗標籤列表
 */
function generateExperienceTags(marketReaction) {
  const tags = [];
  
  // 根據市場反應生成標籤
  if (marketReaction.index_reaction) {
    const avgChange = calculateAverageIndexChange(marketReaction.index_reaction);
    if (avgChange > 0.02) {
      tags.push("STRONG_POSITIVE");
    } else if (avgChange < -0.02) {
      tags.push("STRONG_NEGATIVE");
    } else {
      tags.push("NEUTRAL");
    }
  }
  
  if (marketReaction.anomalies && marketReaction.anomalies.length > 0) {
    tags.push("HAS_ANOMALIES");
  }
  
  return tags;
}

/**
 * 計算平均指數變化
 * @param {Object} indexReaction - 指數反應數據
 * @returns {number} 平均變化
 */
function calculateAverageIndexChange(indexReaction) {
  // 簡化處理，實際應該計算所有指數的平均變化
  return 0;
}

/**
 * 計算平均 Sector 變化
 * @param {Object} sectorReaction - Sector 反應數據
 * @returns {number} 平均變化
 */
function calculateAverageSectorChange(sectorReaction) {
  return 0;
}

/**
 * 計算平均個股變化
 * @param {Object} stockReaction - 個股反應數據
 * @returns {number} 平均變化
 */
function calculateAverageStockChange(stockReaction) {
  return 0;
}

/**
 * 獲取歷史經驗
 * @param {string} eventId - 事件 ID
 * @returns {Array} 歷史經驗列表
 */
function getHistoricalExperience(eventId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("P5__CALENDAR_HISTORY");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const eventIdCol = headers.indexOf("event_id");
  const snapshotCol = headers.indexOf("experience_snapshot_json");
  
  if (eventIdCol === -1 || snapshotCol === -1) {
    return [];
  }
  
  const experiences = [];
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][eventIdCol] === eventId && rows[i][snapshotCol]) {
      try {
        const snapshot = JSON.parse(rows[i][snapshotCol]);
        experiences.push(snapshot);
      } catch (e) {
        // 解析失敗，跳過
      }
    }
  }
  
  return experiences;
}

// ==========================================
// 數據獲取函數（需要從實際數據源讀取）
// ==========================================

function getSectorETFFlow() {
  // 從 MACRO_DATA_WEEKLY_METRICS 或 SECTOR_ETF_DAILY 讀取
  return {};
}

function getMag7RelativeStrength() {
  // 從市場數據讀取
  return {};
}

function getVIXLevel() {
  // 從市場數據讀取
  return 0;
}

function getMarketBreadth() {
  // 從 MARKET_BREADTH_DAILY 讀取
  return {};
}

function getOptionsFlow() {
  // 從 DERIVATIVES_DAILY 讀取
  return {};
}

function getInsiderTrading() {
  // 從 P2.5 或 SMART_MONEY_DAILY 讀取
  return {};
}
