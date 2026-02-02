/**
 * 📅 P5 財經事件行事曆管理器
 * 
 * 管理全年重大財經事件行事曆
 * - 前5年歷史數據作為預測參考
 * - 與 P5 Weekly 結合掃描下兩週事件
 * - 前7天提醒與強化分析（類似財報）
 * - 事件後動態學習修正
 * 
 * @version SSOT V7.1 (基於 V6.3)
 * @date 2025-01-11
 */

// ==========================================
// P5 Calendar 配置
// ==========================================

const P5_CALENDAR_CONFIG = {
  // ⭐ V8.0 更新：預警時間窗口（調整為10-14天前開始監控）
  alert_windows: {
    "WEEKLY_SCAN": 14,           // 每週掃描下兩週事件
    "MONITOR_START": 14,         // ⭐ V8.0 新增：10-14天前開始監控（關鍵數據監控）
    "INTENSIVE_MONITOR": 10,     // ⭐ V8.0 新增：10天前開始強化監控
    "STRONG_ALERT": 7,           // 前7天強化分析（類似財報）
    "MODERATE_ALERT": 14,        // 前14天中度提醒（保留，但不再作為開始時間）
    "POST_MONITOR_END": 10       // ⭐ V8.0 新增：事件後7-10天監控結束（用於事後學習）
  },
  
  // 歷史數據年數
  historical_years: 5,      // 前5年歷史數據作為參考
  
  // ⭐ V8.0 更新：事件後學習修正（調整為事件後7-10天）
  learning_config: {
    post_monitoring_window: 10,  // ⭐ V8.0 新增：事件後7-10天監控窗口（用於收集市場反應）
    weight_adjustment_window: 90,  // 事件後90天內調整權重
    min_events_for_learning: 3,    // 至少3次事件才進行學習
    confidence_threshold: 0.7      // 信心度閾值
  },
  
  // ⭐ V8.0 新增：關鍵數據監控配置
  key_metrics_monitoring: {
    enabled: true,
    metrics: [
      "sector_etf_flow",      // Sector ETF 資金流向
      "mag7_relative_strength", // Mag7 相對強弱
      "vix_level",            // VIX 水平
      "market_breadth",       // 市場廣度
      "options_flow",         // 期權流向
      "insider_trading"       // 內部人交易
    ],
    anomaly_threshold: 0.2,   // 異常檢測閾值（20%偏差）
    alert_frequency: "DAILY"   // 監控頻率（每日）
  }
};

// ==========================================
// P5 Calendar 核心函數
// ==========================================

/**
 * P5 Weekly 掃描下兩週重大事件（與 P5 Weekly 結合）
 * @param {Date} scanDate - 掃描日期（通常為 P5 Weekly 執行日期）
 * @return {Array} 下兩週重大事件列表
 */
function P5_Calendar_ScanNextTwoWeeks(scanDate) {
  try {
    Logger.log(`P5 Calendar 掃描下兩週重大事件：scanDate=${scanDate}`);
    
    const startDate = new Date(scanDate);
    const endDate = new Date(scanDate);
    endDate.setDate(endDate.getDate() + P5_CALENDAR_CONFIG.alert_windows.WEEKLY_SCAN);
    
    // 從 P5__CALENDAR 表格讀取事件
    const events = getUpcomingEvents(startDate, endDate);
    
    // 標記需要強化分析的事件（前7天內）
    const today = new Date();
    const strongAlertDate = new Date(today);
    strongAlertDate.setDate(strongAlertDate.getDate() + P5_CALENDAR_CONFIG.alert_windows.STRONG_ALERT);
    
    const enhancedEvents = events.map(event => {
      const eventDate = new Date(event.date_start);
      const daysUntilEvent = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
      
      return {
        ...event,
        days_until_event: daysUntilEvent,
        requires_intensive_analysis: daysUntilEvent <= P5_CALENDAR_CONFIG.alert_windows.STRONG_ALERT,
        alert_level: getAlertLevel(daysUntilEvent)
      };
    });
    
    Logger.log(`P5 Calendar 找到 ${enhancedEvents.length} 個下兩週重大事件`);
    
    return enhancedEvents;
    
  } catch (error) {
    Logger.log(`P5 Calendar 掃描失敗：${error.message}`);
    throw error;
  }
}

/**
 * 獲取即將到來的事件
 */
function getUpcomingEvents(startDate, endDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("P5__CALENDAR");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  // 找到欄位索引
  const dateStartCol = headers.indexOf("date_start");
  const statusCol = headers.indexOf("status");
  
  if (dateStartCol === -1) {
    throw new Error("P5__CALENDAR 表格缺少 date_start 欄位");
  }
  
  const events = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const eventDate = new Date(row[dateStartCol]);
    const status = row[statusCol] || "ACTIVE";
    
    // 只處理 ACTIVE 狀態的事件，且在時間範圍內
    if (status === "ACTIVE" && eventDate >= startDate && eventDate <= endDate) {
      const event = {};
      headers.forEach((header, colIndex) => {
        event[header.toLowerCase()] = row[colIndex];
      });
      events.push(event);
    }
  }
  
  return events;
}

/**
 * 獲取提醒等級
 */
function getAlertLevel(daysUntilEvent) {
  if (daysUntilEvent <= P5_CALENDAR_CONFIG.alert_windows.STRONG_ALERT) {
    return "STRONG";  // 前7天：強化分析
  } else if (daysUntilEvent <= P5_CALENDAR_CONFIG.alert_windows.MODERATE_ALERT) {
    return "MODERATE";  // 前14天：中度提醒
  } else if (daysUntilEvent <= P5_CALENDAR_CONFIG.alert_windows.LIGHT_ALERT) {
    return "LIGHT";  // 前30天：輕度提醒
  }
  return "NONE";
}

/**
 * 前7天強化分析（類似財報前7天分析）
 * @param {string} eventId - 事件 ID
 * @return {Object} 強化分析結果
 */
function P5_Calendar_IntensiveAnalysis(eventId) {
  try {
    Logger.log(`P5 Calendar 前7天強化分析：eventId=${eventId}`);
    
    // 1. 獲取事件詳情
    const event = getEventById(eventId);
    if (!event) {
      throw new Error(`事件不存在：${eventId}`);
    }
    
    // 2. 獲取前5年歷史數據
    const historicalData = getHistoricalEventData(event);
    
    // 3. 基於歷史數據預測影響
    const prediction = predictEventImpact(event, historicalData);
    
    // ⭐ V8.0 新增：4.5 觸發關鍵數據監控（10-14天前）
    let monitoringData = null;
    if (typeof startEventKeyMetricsMonitoring === 'function') {
      try {
        monitoringData = startEventKeyMetricsMonitoring(eventId, new Date(event.date_start));
        Logger.log(`P5 Calendar：事件 ${eventId} 關鍵數據監控已觸發`);
      } catch (e) {
        Logger.log(`P5 Calendar：觸發關鍵數據監控失敗：${e.message}`);
      }
    }
    
    // 4. 生成強化分析結果
    const analysis = {
      event_id: eventId,
      event_name: event.event_name,
      event_date: event.date_start,
      historical_analysis: historicalData,
      impact_prediction: prediction,
      recommendation: generateRecommendation(event, prediction),
      monitoring_data: monitoringData,  // ⭐ V8.0 新增：關鍵數據監控結果
      timestamp: new Date().toISOString()
    };
    
    Logger.log(`P5 Calendar 強化分析完成：eventId=${eventId}`);
    
    return analysis;
    
  } catch (error) {
    Logger.log(`P5 Calendar 強化分析失敗：${error.message}`);
    throw error;
  }
}

/**
 * 獲取前5年歷史數據
 */
function getHistoricalEventData(event) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("P5__CALENDAR");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return null;
  }
  
  const eventType = event.event_type;
  const market = event.market;
  const currentYear = new Date().getFullYear();
  
  // 查找前5年相同類型的事件
  const historicalEvents = [];
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const dateStartCol = headers.indexOf("date_start");
  const eventTypeCol = headers.indexOf("event_type");
  const marketCol = headers.indexOf("market");
  const learningHistoryCol = headers.indexOf("learning_history_json");
  
  if (dateStartCol === -1 || eventTypeCol === -1) {
    return null;
  }
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const eventDate = new Date(row[dateStartCol]);
    const year = eventDate.getFullYear();
    
    // 檢查是否為前5年的事件，且類型相同
    if (year >= currentYear - P5_CALENDAR_CONFIG.historical_years && 
        year < currentYear &&
        row[eventTypeCol] === eventType &&
        (marketCol === -1 || row[marketCol] === market)) {
      
      const historicalEvent = {};
      headers.forEach((header, colIndex) => {
        historicalEvent[header.toLowerCase()] = row[colIndex];
      });
      
      // 解析學習歷史
      if (learningHistoryCol !== -1 && row[learningHistoryCol]) {
        try {
          historicalEvent.learning_history = JSON.parse(row[learningHistoryCol]);
        } catch (e) {
          historicalEvent.learning_history = null;
        }
      }
      
      historicalEvents.push(historicalEvent);
    }
  }
  
  return {
    event_count: historicalEvents.length,
    events: historicalEvents,
    years_covered: P5_CALENDAR_CONFIG.historical_years
  };
}

/**
 * 生成重大財經事件歷史經驗（如果沒有歷史數據）
 * ⭐ V8.17 新增：當使用者沒有自行輸入歷史數據時，由 AI 自動生成
 * @param {Object} event - 事件對象
 * @returns {Object} 歷史經驗數據
 */
function generateCalendarHistoricalExperience(event) {
  try {
    Logger.log(`生成重大財經事件歷史經驗：eventId=${event.event_id}, eventType=${event.event_type}`);
    
    // 檢查是否已有歷史經驗
    const existingData = getHistoricalEventData(event);
    if (existingData && existingData.events.length > 0) {
      Logger.log(`已有歷史經驗，跳過生成：${existingData.event_count} 次記錄`);
      return existingData;
    }
    
    // ⭐ V8.17 更新：根據測試模式選擇 AI 模型
    // 正式模式：Sonnet 4.5（Batch API）
    // 測試模式：Gemini 2.5 Lite（同步 API）
    const isTestMode = typeof SYSTEM_TEST_MODE !== 'undefined' && SYSTEM_TEST_MODE;
    const executor = isTestMode ? "GEMINI_FLASH_LITE" : "SONNET";
    const auditor = "GPT";
    const requestedFlow = [executor, auditor];
    
    // 構建 AI Prompt
    const prompt = buildCalendarHistoricalExperiencePrompt(event);
    
    // 提交到 M0 Job Queue
    const jobId = submitP5ToM0JobQueue(
      "CALENDAR_HISTORICAL_EXPERIENCE",
      requestedFlow,
      {
        event_id: event.event_id,
        event_type: event.event_type,
        event_name: event.event_name,
        market: event.market,
        task_prompt: prompt,
        model: executor,
        is_test_mode: isTestMode
      }
    );
    
    // 等待結果（使用 waitForM0JobResult，定義在 24_P5_WEEKLY_STOCK_STRATEGY.js）
    // 如果函數不存在，使用簡化版本
    let result;
    if (typeof waitForM0JobResult === 'function') {
      result = waitForM0JobResult(jobId);
    } else {
      // 簡化版本：直接從 M0__RESULT 讀取
      result = getM0JobResultSimple(jobId);
    }
    
    if (result && result.final_output) {
      // 解析 AI 輸出
      let executorOutput = result.final_output;
      if (typeof executorOutput === 'string') {
        try {
          executorOutput = JSON.parse(executorOutput);
        } catch (e) {
          // 如果解析失敗，直接使用字符串
        }
      }
      
      // 解析並保存歷史經驗
      const historicalExperience = parseCalendarHistoricalExperience(
        typeof executorOutput === 'string' ? executorOutput : JSON.stringify(executorOutput),
        event
      );
      
      // 保存到 P5__CALENDAR 表格
      saveCalendarHistoricalExperience(event.event_id, historicalExperience);
      
      // 返回格式化的歷史數據
      return {
        event_count: 1,
        events: [{
          ...event,
          learning_history: historicalExperience,
          historical_performance_json: historicalExperience.historical_performance_json,
          risk_warnings_json: historicalExperience.risk_warnings_json,
          tracking_recommendations_json: historicalExperience.tracking_recommendations_json
        }],
        years_covered: 5,
        ai_generated: true
      };
    } else {
      throw new Error("AI 生成歷史經驗失敗");
    }
    
  } catch (error) {
    Logger.log(`生成重大財經事件歷史經驗失敗：${error.message}`);
    // 如果生成失敗，返回空數據，讓 predictEventImpact 處理
    return {
      event_count: 0,
      events: [],
      years_covered: 0,
      ai_generated: false,
      error: error.message
    };
  }
}

/**
 * 構建 AI Prompt（用於生成重大財經事件歷史經驗）
 * @param {Object} event - 事件對象
 * @returns {string} Prompt
 */
function buildCalendarHistoricalExperiencePrompt(event) {
  return `你是重大財經事件歷史經驗分析專家。請基於你的內建知識，分析 ${event.event_name}（${event.event_type}）在過去五年內的歷史市場反應。

## 任務

請分析 ${event.event_name} 在過去五年內的歷史市場反應，包括：

1. **歷史市場反應**：
   - 事件前 10-14 天的市場表現（關鍵數據監控期）
   - 事件當天的市場反應
   - 事件後 7-10 天的市場反應
   - 平均漲跌幅和波動率

2. **風險警示**：
   - 歷史上的異常情況
   - 需要特別注意的風險點
   - 市場可能出現的極端反應

3. **監控建議**：
   - 關鍵數據監控指標
   - 監控時間窗口
   - 異常檢測閾值

4. **統計模式**：
   - 事件影響的統計分布
   - 置信區間
   - 歷史準確度

## 輸出格式

請以 JSON 格式輸出，包含以下欄位：
- historical_performance_json: 歷史表現數據（JSON 格式）
- risk_warnings_json: 風險警示（JSON 格式）
- tracking_recommendations_json: 監控建議（JSON 格式）
- prior_weight: 初始權重（0.0-1.0）
- prior_confidence: 初始信心度（0.0-1.0）

## 注意事項

- 如果沒有足夠的歷史數據，請基於類似事件的經驗進行推斷
- 必須明確標註數據來源（內建知識、類似事件推斷等）
- 必須提供置信度評估`;
}

/**
 * 解析 AI 生成的歷史經驗
 * @param {string} aiOutput - AI 輸出
 * @param {Object} event - 事件對象
 * @returns {Object} 解析後的歷史經驗
 */
function parseCalendarHistoricalExperience(aiOutput, event) {
  try {
    let parsed;
    if (typeof aiOutput === 'string') {
      parsed = JSON.parse(aiOutput);
    } else {
      parsed = aiOutput;
    }
    
    return {
      historical_performance_json: parsed.historical_performance_json || {},
      risk_warnings_json: parsed.risk_warnings_json || {},
      tracking_recommendations_json: parsed.tracking_recommendations_json || {},
      prior_weight: parsed.prior_weight || 0.5,
      prior_confidence: parsed.prior_confidence || 0.5,
      data_source: "AI_GENERATED",
      generated_at: new Date().toISOString()
    };
  } catch (error) {
    Logger.log(`解析 AI 生成的歷史經驗失敗：${error.message}`);
    // 返回默認值
    return {
      historical_performance_json: {},
      risk_warnings_json: {},
      tracking_recommendations_json: {},
      prior_weight: 0.5,
      prior_confidence: 0.3,
      data_source: "AI_GENERATED",
      generated_at: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * 保存歷史經驗到 P5__CALENDAR 表格
 * @param {string} eventId - 事件 ID
 * @param {Object} historicalExperience - 歷史經驗數據
 */
function saveCalendarHistoricalExperience(eventId, historicalExperience) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__CALENDAR");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log(`P5__CALENDAR 表格不存在或為空，無法保存歷史經驗`);
      return;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const eventIdCol = headers.indexOf("event_id");
    const historicalPerfCol = headers.indexOf("historical_performance_json");
    const riskWarningsCol = headers.indexOf("risk_warnings_json");
    const trackingRecCol = headers.indexOf("tracking_recommendations_json");
    const priorWeightCol = headers.indexOf("prior_weight");
    const priorConfidenceCol = headers.indexOf("prior_confidence");
    
    if (eventIdCol === -1) {
      Logger.log(`找不到 event_id 欄位，無法保存歷史經驗`);
      return;
    }
    
    // 查找對應事件
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][eventIdCol] === eventId) {
        // 更新歷史經驗數據
        if (historicalPerfCol !== -1) {
          sheet.getRange(i + 1, historicalPerfCol + 1).setValue(
            JSON.stringify(historicalExperience.historical_performance_json)
          );
        }
        if (riskWarningsCol !== -1) {
          sheet.getRange(i + 1, riskWarningsCol + 1).setValue(
            JSON.stringify(historicalExperience.risk_warnings_json)
          );
        }
        if (trackingRecCol !== -1) {
          sheet.getRange(i + 1, trackingRecCol + 1).setValue(
            JSON.stringify(historicalExperience.tracking_recommendations_json)
          );
        }
        if (priorWeightCol !== -1) {
          sheet.getRange(i + 1, priorWeightCol + 1).setValue(
            historicalExperience.prior_weight
          );
        }
        if (priorConfidenceCol !== -1) {
          sheet.getRange(i + 1, priorConfidenceCol + 1).setValue(
            historicalExperience.prior_confidence
          );
        }
        
        Logger.log(`已保存事件 ${eventId} 的 AI 生成歷史經驗`);
        return;
      }
    }
    
    Logger.log(`找不到事件 ${eventId}，無法保存歷史經驗`);
    
  } catch (error) {
    Logger.log(`保存歷史經驗失敗：${error.message}`);
  }
}

/**
 * 基於歷史數據預測影響
 */
function predictEventImpact(event, historicalData) {
  // ⭐ V8.17 新增：如果沒有歷史數據，嘗試 AI 生成
  if (!historicalData || historicalData.events.length === 0) {
    Logger.log(`事件 ${event.event_id} 沒有歷史數據，嘗試 AI 生成歷史經驗`);
    
    try {
      const aiGeneratedData = generateCalendarHistoricalExperience(event);
      if (aiGeneratedData && aiGeneratedData.events.length > 0) {
        // 使用 AI 生成的歷史經驗
        historicalData = aiGeneratedData;
        Logger.log(`已使用 AI 生成的歷史經驗進行預測`);
      } else {
        // AI 生成失敗，返回默認值
        return {
          confidence: 0.3,
          predicted_impact: "UNKNOWN",
          reasoning: "無歷史數據參考，AI 生成失敗"
        };
      }
    } catch (error) {
      Logger.log(`AI 生成歷史經驗失敗：${error.message}`);
      return {
        confidence: 0.3,
        predicted_impact: "UNKNOWN",
        reasoning: `無歷史數據參考，AI 生成失敗：${error.message}`
      };
    }
  }
  
  // 分析歷史事件的實際影響
  const impacts = [];
  
  for (const historicalEvent of historicalData.events) {
    if (historicalEvent.learning_history) {
      const actualImpact = historicalEvent.learning_history.actual_impact || "NEUTRAL";
      const weight = historicalEvent.current_weight || historicalEvent.prior_weight || 0.5;
      const confidence = historicalEvent.prior_confidence || 0.5;
      
      impacts.push({
        impact: actualImpact,
        weight: weight,
        confidence: confidence
      });
    }
  }
  
  // 計算加權平均影響
  let weightedImpact = 0;
  let totalWeight = 0;
  
  const impactScores = {
    "POSITIVE": 1,
    "NEUTRAL": 0,
    "NEGATIVE": -1,
    "UNKNOWN": 0
  };
  
  for (const impact of impacts) {
    const score = impactScores[impact.impact] || 0;
    weightedImpact += score * impact.weight * impact.confidence;
    totalWeight += impact.weight * impact.confidence;
  }
  
  const avgImpact = totalWeight > 0 ? weightedImpact / totalWeight : 0;
  
  let predictedImpact;
  if (avgImpact > 0.3) {
    predictedImpact = "POSITIVE";
  } else if (avgImpact < -0.3) {
    predictedImpact = "NEGATIVE";
  } else {
    predictedImpact = "NEUTRAL";
  }
  
  const confidence = Math.min(totalWeight / impacts.length, 1.0);
  
  return {
    confidence: confidence,
    predicted_impact: predictedImpact,
    reasoning: `基於前${P5_CALENDAR_CONFIG.historical_years}年${historicalData.event_count}次類似事件的歷史數據`,
    historical_events_count: historicalData.event_count
  };
}

/**
 * 生成建議
 */
function generateRecommendation(event, prediction) {
  const alertLevel = getAlertLevel(calculateDaysUntilEvent(event.date_start));
  
  if (alertLevel === "STRONG") {
    // 前7天：強化分析，類似財報
    return {
      action: "INTENSIVE_ANALYSIS",
      frequency: "DAILY",  // 每日分析
      focus: ["IMPACT_PREDICTION", "MARKET_SENTIMENT", "POSITION_ADJUSTMENT"]
    };
  } else if (alertLevel === "MODERATE") {
    return {
      action: "MONITOR",
      frequency: "WEEKLY",  // 每週檢查
      focus: ["TREND_ANALYSIS", "RISK_ASSESSMENT"]
    };
  } else {
    return {
      action: "TRACK",
      frequency: "WEEKLY",  // 每週檢查
      focus: ["BASIC_MONITORING"]
    };
  }
}

/**
 * 事件後動態學習修正
 * @param {string} eventId - 事件 ID
 * @param {Object} actualOutcome - 實際結果
 * @return {Object} 學習修正結果
 */
function P5_Calendar_LearningCorrection(eventId, actualOutcome) {
  try {
    Logger.log(`P5 Calendar 事件後學習修正：eventId=${eventId}`);
    
    // 1. 獲取事件詳情
    const event = getEventById(eventId);
    if (!event) {
      throw new Error(`事件不存在：${eventId}`);
    }
    
    // 2. 獲取預測結果
    const priorPrediction = {
      predicted_impact: event.prior_dimensions_json ? 
        (JSON.parse(event.prior_dimensions_json).predicted_impact || "UNKNOWN") : "UNKNOWN",
      weight: event.prior_weight || 0.5,
      confidence: event.prior_confidence || 0.5
    };
    
    // 3. 計算預測準確度
    const accuracy = calculatePredictionAccuracy(priorPrediction, actualOutcome);
    
    // 4. 調整權重和信心度
    const adjustedWeight = adjustWeight(
      priorPrediction.weight,
      accuracy,
      actualOutcome.impact
    );
    
    const adjustedConfidence = adjustConfidence(
      priorPrediction.confidence,
      accuracy
    );
    
    // 5. 更新學習歷史
    const learningHistory = updateLearningHistory(event, actualOutcome, accuracy);
    
    // 6. 更新事件記錄
    updateEventRecord(eventId, {
      current_weight: adjustedWeight,
      prior_confidence: adjustedConfidence,
      learning_history_json: JSON.stringify(learningHistory),
      last_updated: new Date().toISOString(),
      consecutive_success: accuracy > 0.7 ? (event.consecutive_success || 0) + 1 : 0,
      consecutive_failure: accuracy <= 0.7 ? (event.consecutive_failure || 0) + 1 : 0
    });
    
    const result = {
      event_id: eventId,
      prior_prediction: priorPrediction,
      actual_outcome: actualOutcome,
      accuracy: accuracy,
      adjusted_weight: adjustedWeight,
      adjusted_confidence: adjustedConfidence,
      learning_history: learningHistory,
      timestamp: new Date().toISOString()
    };
    
    Logger.log(`P5 Calendar 學習修正完成：accuracy=${accuracy.toFixed(2)}`);
    
    return result;
    
  } catch (error) {
    Logger.log(`P5 Calendar 學習修正失敗：${error.message}`);
    throw error;
  }
}

/**
 * 計算預測準確度
 */
function calculatePredictionAccuracy(prediction, actualOutcome) {
  const predictedImpact = prediction.predicted_impact;
  const actualImpact = actualOutcome.impact;
  
  if (predictedImpact === actualImpact) {
    return 1.0;  // 完全正確
  } else if ((predictedImpact === "POSITIVE" && actualImpact === "NEGATIVE") ||
             (predictedImpact === "NEGATIVE" && actualImpact === "POSITIVE")) {
    return 0.0;  // 完全錯誤
  } else {
    return 0.5;  // 部分正確（例如：預測 POSITIVE，實際 NEUTRAL）
  }
}

/**
 * 調整權重
 */
function adjustWeight(currentWeight, accuracy, actualImpact) {
  // 如果預測準確，增加權重；如果預測錯誤，減少權重
  const adjustment = (accuracy - 0.5) * 0.1;  // 最多調整 ±5%
  const newWeight = Math.max(0.1, Math.min(1.0, currentWeight + adjustment));
  
  return newWeight;
}

/**
 * 調整信心度
 */
function adjustConfidence(currentConfidence, accuracy) {
  // 如果預測準確，增加信心度；如果預測錯誤，減少信心度
  const adjustment = (accuracy - 0.5) * 0.15;  // 最多調整 ±7.5%
  const newConfidence = Math.max(0.1, Math.min(1.0, currentConfidence + adjustment));
  
  return newConfidence;
}

/**
 * 更新學習歷史
 */
function updateLearningHistory(event, actualOutcome, accuracy) {
  let learningHistory = [];
  
  // 解析現有學習歷史
  if (event.learning_history_json) {
    try {
      learningHistory = JSON.parse(event.learning_history_json);
    } catch (e) {
      learningHistory = [];
    }
  }
  
  // 添加新的學習記錄
  learningHistory.push({
    event_date: event.date_start,
    predicted_impact: event.prior_dimensions_json ? 
      (JSON.parse(event.prior_dimensions_json).predicted_impact || "UNKNOWN") : "UNKNOWN",
    actual_impact: actualOutcome.impact,
    actual_magnitude: actualOutcome.magnitude || 0,
    accuracy: accuracy,
    weight_before: event.prior_weight || 0.5,
    weight_after: adjustWeight(event.prior_weight || 0.5, accuracy, actualOutcome.impact),
    confidence_before: event.prior_confidence || 0.5,
    confidence_after: adjustConfidence(event.prior_confidence || 0.5, accuracy),
    timestamp: new Date().toISOString()
  });
  
  // 只保留最近 N 次記錄（例如：最近 10 次）
  if (learningHistory.length > 10) {
    learningHistory = learningHistory.slice(-10);
  }
  
  return learningHistory;
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 根據事件 ID 獲取事件
 */
function getEventById(eventId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("P5__CALENDAR");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return null;
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const eventIdCol = headers.indexOf("event_id");
  if (eventIdCol === -1) {
    return null;
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][eventIdCol] === eventId) {
      const event = {};
      headers.forEach((header, colIndex) => {
        event[header.toLowerCase()] = rows[i][colIndex];
      });
      return event;
    }
  }
  
  return null;
}

/**
 * 更新事件記錄
 */
function updateEventRecord(eventId, updates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("P5__CALENDAR");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    throw new Error("P5__CALENDAR 表格不存在或沒有數據");
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const eventIdCol = headers.indexOf("event_id");
  if (eventIdCol === -1) {
    throw new Error("P5__CALENDAR 表格缺少 event_id 欄位");
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][eventIdCol] === eventId) {
      // 更新對應欄位
      Object.keys(updates).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(i + 1, colIndex + 1).setValue(updates[key]);
        }
      });
      
      Logger.log(`P5 Calendar 事件記錄已更新：eventId=${eventId}`);
      return;
    }
  }
  
  throw new Error(`事件不存在：${eventId}`);
}

/**
 * 計算距離事件天數
 */
function calculateDaysUntilEvent(eventDate) {
  const today = new Date();
  const date = new Date(eventDate);
  return Math.floor((date - today) / (1000 * 60 * 60 * 24));
}
