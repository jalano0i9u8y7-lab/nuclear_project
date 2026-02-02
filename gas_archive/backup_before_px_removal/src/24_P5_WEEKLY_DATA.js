/**
 * 📊 P5 Weekly: 數據收集模組
 * 
 * 負責收集 P5 Weekly 所需的所有數據：
 * - 宏觀數據（油價、匯率、VIX 等）
 * - 世界觀更新（歷史對照）
 * - 學習日誌（歷史學習結果）
 * - P0/P0.7/P1 快照（產業分析）
 * - P2/P3/P4 快照（基本面、技術面、資金配置）
 * - Daily 數據摘要（OHLCV、技術指標、ETF、衍生品、新聞）
 * 
 * ⭐ 本模組包含從原 24_P5_WEEKLY.js 遷移過來的數據收集函數，確保模組化
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

// ==========================================
// 宏觀數據收集
// ==========================================

/**
 * 收集本週宏觀數據
 * ⭐ V8.12 優化：優先讀取週度波動度計算結果（如果存在）
 * 
 * @param {number} days - 收集最近 N 天的數據（預設 7 天）
 * @returns {Object} macroData - 宏觀數據（包含週度波動度指標）
 */
function collectWeeklyMacroData(days = 7) {
  // ⭐ V8.12 新增：優先讀取週度波動度計算結果
  try {
    const weeklyMetrics = getMacroWeeklyMetrics();
    if (weeklyMetrics && Object.keys(weeklyMetrics).length > 0) {
      Logger.log("P5 Weekly V8.12：使用週度波動度計算結果（優化）");
      // 如果存在週度波動度數據，直接返回（避免重新讀取7天原始數據）
      return {
        weekly_metrics: weeklyMetrics,
        _source: "WEEKLY_METRICS"  // 標記數據來源
      };
    }
  } catch (error) {
    Logger.log(`P5 Weekly：讀取週度波動度失敗，回退到原始數據讀取：${error.message}`);
  }
  try {
    Logger.log(`P5 Weekly：收集最近 ${days} 天的宏觀數據`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MACRO_DATA_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly：MACRO_DATA_DAILY 表格不存在或為空");
      return {};
    }
    
    const today = new Date();
    const startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const dataTypeCol = headers.indexOf("data_type");
    const symbolCol = headers.indexOf("symbol");
    const nameCol = headers.indexOf("name");
    const valueCol = headers.indexOf("value");
    const changeCol = headers.indexOf("change");
    const changePctCol = headers.indexOf("change_pct");
    
    if (dateCol === -1 || dataTypeCol === -1 || symbolCol === -1 || valueCol === -1) {
      Logger.log("P5 Weekly：MACRO_DATA_DAILY 表格欄位不完整");
      return {};
    }
    
    const macroData = {
      commodities: {},  // 商品（油價、貴金屬）
      currencies: {},   // 匯率
      bonds: {},        // 債券利率
      indices: {}       // 指數（VIX 等）
    };
    
    // 收集數據
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= startDate && rowDate <= today) {
        const dataType = rows[i][dataTypeCol];
        const symbol = rows[i][symbolCol];
        const name = rows[i][nameCol] || symbol;
        const value = parseFloat(rows[i][valueCol]);
        const change = rows[i][changeCol] ? parseFloat(rows[i][changeCol]) : null;
        const changePct = rows[i][changePctCol] ? parseFloat(rows[i][changePctCol]) : null;
        
        if (!isNaN(value)) {
          const dataPoint = {
            date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
            symbol: symbol,
            name: name,
            value: value,
            change: change,
            change_pct: changePct
          };
          
          // 按類型分類
          if (dataType === "commodities" || dataType === "commodity") {
            if (!macroData.commodities[symbol]) {
              macroData.commodities[symbol] = [];
            }
            macroData.commodities[symbol].push(dataPoint);
          } else if (dataType === "currencies" || dataType === "currency") {
            if (!macroData.currencies[symbol]) {
              macroData.currencies[symbol] = [];
            }
            macroData.currencies[symbol].push(dataPoint);
          } else if (dataType === "bonds" || dataType === "bond") {
            if (!macroData.bonds[symbol]) {
              macroData.bonds[symbol] = [];
            }
            macroData.bonds[symbol].push(dataPoint);
          } else if (dataType === "indices" || dataType === "index") {
            if (!macroData.indices[symbol]) {
              macroData.indices[symbol] = [];
            }
            macroData.indices[symbol].push(dataPoint);
          }
        }
      }
    }
    
    // 對每個數據點按日期排序（最新的在前）
    for (const category of Object.keys(macroData)) {
      for (const symbol of Object.keys(macroData[category])) {
        macroData[category][symbol].sort((a, b) => new Date(b.date) - new Date(a.date));
      }
    }
    
    Logger.log(`P5 Weekly：收集到宏觀數據 - 商品：${Object.keys(macroData.commodities).length}，匯率：${Object.keys(macroData.currencies).length}，債券：${Object.keys(macroData.bonds).length}，指數：${Object.keys(macroData.indices).length}`);
    
    return macroData;
    
  } catch (error) {
    Logger.log(`P5 Weekly：收集宏觀數據失敗：${error.message}`);
    return {};
  }
}

// ==========================================
// 世界觀更新收集
// ==========================================

/**
 * 收集歷史世界觀更新（用於對照學習）
 * 
 * @param {number} weeks - 收集最近 N 週的數據（預設 4 週，約一個月）
 * @returns {Array} worldviewHistory - 歷史世界觀更新列表
 */
function collectWeeklyWorldviewUpdates(weeks = 4) {
  try {
    Logger.log(`P5 Weekly：收集最近 ${weeks} 週的世界觀更新`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("WORLDVIEW_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly：WORLDVIEW_DAILY 表格不存在或為空");
      return [];
    }
    
    const today = new Date();
    const startDate = new Date(today.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const worldviewCol = headers.indexOf("worldview_update_json");
    const conclusionsCol = headers.indexOf("conclusions_json");
    const macroContextCol = headers.indexOf("macro_context_summary_json");
    
    if (dateCol === -1 || worldviewCol === -1) {
      Logger.log("P5 Weekly：WORLDVIEW_DAILY 表格欄位不完整");
      return [];
    }
    
    const worldviewHistory = [];
    
    // 收集數據
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= startDate && rowDate <= today) {
        try {
          const worldviewUpdate = rows[i][worldviewCol] ? JSON.parse(rows[i][worldviewCol]) : null;
          const conclusions = rows[i][conclusionsCol] ? JSON.parse(rows[i][conclusionsCol]) : null;
          const macroContext = rows[i][macroContextCol] ? JSON.parse(rows[i][macroContextCol]) : null;
          
          worldviewHistory.push({
            date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
            worldview_update: worldviewUpdate,
            conclusions: conclusions,
            macro_context: macroContext
          });
        } catch (parseError) {
          Logger.log(`P5 Weekly：解析世界觀數據失敗（日期：${rows[i][dateCol]}）：${parseError.message}`);
        }
      }
    }
    
    // 按日期排序（最新的在前）
    worldviewHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    Logger.log(`P5 Weekly：收集到 ${worldviewHistory.length} 筆歷史世界觀更新`);
    
    return worldviewHistory;
    
  } catch (error) {
    Logger.log(`P5 Weekly：收集世界觀更新失敗：${error.message}`);
    return [];
  }
}

// ==========================================
// 學習日誌收集
// ==========================================

/**
 * 收集歷史學習日誌
 * 
 * @param {number} weeks - 收集最近 N 週的數據（預設 4 週）
 * @returns {Array} learningLogHistory - 歷史學習日誌列表
 */
function collectHistoricalLearningLog(weeks = 4) {
  try {
    Logger.log(`P5 Weekly：收集最近 ${weeks} 週的學習日誌`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__LEARNING_LOG");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly：P5__LEARNING_LOG 表格不存在或為空");
      return [];
    }
    
    const today = new Date();
    const startDate = new Date(today.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const periodCol = headers.indexOf("period");
    const typeCol = headers.indexOf("type");
    const successCasesCol = headers.indexOf("success_cases_json");
    const failureCasesCol = headers.indexOf("failure_cases_json");
    const keyLessonsCol = headers.indexOf("key_lessons_json");
    const beliefVerificationCol = headers.indexOf("belief_verification_json");
    const systematicLearningCol = headers.indexOf("systematic_learning_json");
    
    if (dateCol === -1) {
      Logger.log("P5 Weekly：P5__LEARNING_LOG 表格欄位不完整");
      return [];
    }
    
    const learningLogHistory = [];
    
    // 收集數據
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= startDate && rowDate <= today) {
        try {
          const logEntry = {
            date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
            period: rows[i][periodCol] || null,
            type: rows[i][typeCol] || null,
            success_cases: rows[i][successCasesCol] ? JSON.parse(rows[i][successCasesCol]) : [],
            failure_cases: rows[i][failureCasesCol] ? JSON.parse(rows[i][failureCasesCol]) : [],
            key_lessons: rows[i][keyLessonsCol] ? JSON.parse(rows[i][keyLessonsCol]) : [],
            belief_verification: rows[i][beliefVerificationCol] ? JSON.parse(rows[i][beliefVerificationCol]) : {},
            systematic_learning: rows[i][systematicLearningCol] ? JSON.parse(rows[i][systematicLearningCol]) : {}
          };
          
          learningLogHistory.push(logEntry);
        } catch (parseError) {
          Logger.log(`P5 Weekly：解析學習日誌失敗（日期：${rows[i][dateCol]}）：${parseError.message}`);
        }
      }
    }
    
    // 按日期排序（最新的在前）
    learningLogHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    Logger.log(`P5 Weekly：收集到 ${learningLogHistory.length} 筆歷史學習日誌`);
    
    return learningLogHistory;
    
  } catch (error) {
    Logger.log(`P5 Weekly：收集學習日誌失敗：${error.message}`);
    return [];
  }
}

// ==========================================
// P0/P0.7/P1 快照收集（產業分析）
// ==========================================

/**
 * 獲取最新 P0 快照（產業工程學）
 * 
 * @returns {Object|null} p0Snapshot - P0 快照
 */
function getLatestP0Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly：P0__SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const row = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const snapshot = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const value = row[i];
      
      // 嘗試解析 JSON
      if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
        try {
          snapshot[header] = JSON.parse(value);
        } catch (e) {
          snapshot[header] = value;
        }
      } else {
        snapshot[header] = value;
      }
    }
    
    Logger.log(`P5 Weekly：讀取 P0 最新快照：${snapshot.snapshot_id || "未知"}`);
    return snapshot;
    
  } catch (error) {
    Logger.log(`P5 Weekly：讀取 P0 快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 獲取最新 P0.7 快照（系統動力學）
 * 
 * @returns {Object|null} p0_7Snapshot - P0.7 快照
 */
function getLatestP0_7Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0_7__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly：P0_7__SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const row = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const snapshot = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const value = row[i];
      
      // 嘗試解析 JSON
      if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
        try {
          snapshot[header] = JSON.parse(value);
        } catch (e) {
          snapshot[header] = value;
        }
      } else {
        snapshot[header] = value;
      }
    }
    
    Logger.log(`P5 Weekly：讀取 P0.7 最新快照：${snapshot.snapshot_id || "未知"}`);
    return snapshot;
    
  } catch (error) {
    Logger.log(`P5 Weekly：讀取 P0.7 快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 獲取最新 P1 快照（公司池）
 * 
 * @returns {Object|null} p1Snapshot - P1 快照
 */
function getLatestP1Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P1__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly：P1__SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const row = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const snapshot = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const value = row[i];
      
      // 嘗試解析 JSON
      if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
        try {
          snapshot[header] = JSON.parse(value);
        } catch (e) {
          snapshot[header] = value;
        }
      } else {
        snapshot[header] = value;
      }
    }
    
    Logger.log(`P5 Weekly：讀取 P1 最新快照：${snapshot.snapshot_id || "未知"}`);
    return snapshot;
    
  } catch (error) {
    Logger.log(`P5 Weekly：讀取 P1 快照失敗：${error.message}`);
    return null;
  }
}

// ==========================================
// 整合數據收集（主函數）
// ==========================================

/**
 * 收集 P5 Weekly 所需的所有數據
 * 
 * @param {Object} options - 選項
 * @param {number} options.macroDays - 宏觀數據天數（預設 7）
 * @param {number} options.worldviewWeeks - 世界觀週數（預設 4）
 * @param {number} options.learningWeeks - 學習日誌週數（預設 4）
 * @returns {Object} allData - 所有收集的數據
 */
function collectP5WeeklyAllData(options = {}) {
  try {
    Logger.log("P5 Weekly：開始收集所有數據");
    
    const macroDays = options.macroDays || 7;
    const worldviewWeeks = options.worldviewWeeks || 4;
    const learningWeeks = options.learningWeeks || 4;
    
    const allData = {
      // 宏觀數據
      macro_data: collectWeeklyMacroData(macroDays),
      
      // 世界觀更新
      worldview_history: collectWeeklyWorldviewUpdates(worldviewWeeks),
      
      // 學習日誌
      learning_log_history: collectHistoricalLearningLog(learningWeeks),
      
      // 產業分析快照
      p0_snapshot: getLatestP0Snapshot(),
      p0_5_snapshot: getLatestP0_5Snapshot(),  // ⭐ V8.15 新增：P0.5 產業鏈動態監控快照
      p0_7_snapshot: getLatestP0_7Snapshot(),
      p1_snapshot: getLatestP1Snapshot(),
      
      // 基本面/技術面/資金配置快照（使用現有函數）
      p2_snapshot: getLatestP2Snapshot(),
      p2_5_snapshot: getLatestP2_5Snapshot(),  // ⭐ V8.15 新增：P2.5 籌碼面分析快照
      p3_snapshot: getLatestP3Snapshot(),
      p4_snapshot: getLatestP4Snapshot(),
      
      // 前一次 P5 Weekly 快照
      previous_p5_weekly_snapshot: getLatestP5WeeklySnapshot(),
      
      // ⭐ V8.15 新增：P6 週度摘要（盤中異常頻率趨勢）
      p6_weekly_summary: getP6WeeklySummary(),
      
      // ⭐ V8.15 新增：重大財經行事曆
      calendar: getP5WeeklyCalendar(),
      
      // ⭐ V8.15 新增：macro_flow_context（Sector ETF Flow 與 Mag 7 分析）
      macro_flow_context: getMacroFlowContext(),
      
      // ⭐ V8.15 新增：上週策略執行結果
      previous_strategy_results: getPreviousStrategyResults(),
      current_positions: getCurrentPositions(),
      open_orders: getOpenOrders(),
      fills_since_last_week: getFillsSinceLastWeek(),
      
      // ⭐ V8.15 新增：動態學習系統反饋
      learning_feedback: getLearningFeedback(),
      
      // 收集時間戳
      collected_at: new Date().toISOString()
    };
    
    Logger.log("P5 Weekly：所有數據收集完成");
    
    return allData;
    
  } catch (error) {
    Logger.log(`P5 Weekly：收集所有數據失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// Daily 數據摘要函數（從原 24_P5_WEEKLY.js 遷移）
// ==========================================

/**
 * 收集本週市場數據（從 P5 Daily 收集的數據中提取）
 * 
 * @returns {Object} weeklyMarketData - 本週市場數據
 */
function collectWeeklyMarketData() {
  // 從 P5 Daily 收集的數據中提取本週數據
  // 包括：OHLCV、技術指標、板塊 ETF、衍生品、新聞等
  // ⭐ V8.0 新增：市場情緒指標（FPE_B、CNN Greed Fear Index）
  
  // 獲取持倉股票列表（從 P4 或 P2 快照中獲取）
  const p2Snapshot = getLatestP2Snapshot();
  const tickers = [];
  const tickerMarkets = {};
  
  if (p2Snapshot && p2Snapshot.tier_assignments) {
    // 從 P2 快照中提取 ticker 列表
    for (const tier in p2Snapshot.tier_assignments) {
      if (p2Snapshot.tier_assignments[tier] && Array.isArray(p2Snapshot.tier_assignments[tier])) {
        for (const stock of p2Snapshot.tier_assignments[tier]) {
          if (stock.ticker && !tickers.includes(stock.ticker)) {
            tickers.push(stock.ticker);
            tickerMarkets[stock.ticker] = stock.market || "US";
          }
        }
      }
    }
  }
  
  // 收集市場情緒指標（FPE_B、CNN Greed Fear Index）
  let marketSentimentIndicators = {};
  try {
    marketSentimentIndicators = collectMarketSentimentIndicators(tickers, tickerMarkets);
  } catch (error) {
    Logger.log(`P5 Weekly：收集市場情緒指標失敗：${error.message}`);
  }
  
  return {
    ohlcv_summary: getWeeklyOHLCVSummary(),
    technical_indicators_summary: getWeeklyTechnicalIndicatorsSummary(),
    sector_performance: getWeeklySectorPerformance(),
    derivatives_summary: getWeeklyDerivativesSummary(),
    news_summary: getWeeklyNewsSummary(),
    institutional_activity: getWeeklyInstitutionalActivity(),
    market_sentiment_indicators: marketSentimentIndicators  // ⭐ V8.0 新增
  };
}

/**
 * 獲取本週 OHLCV 摘要
 * 
 * @returns {Object} summary - 本週 OHLCV 摘要
 */
function getWeeklyOHLCVSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    const closeCol = headers.indexOf("close");
    
    if (dateCol === -1 || tickerCol === -1 || closeCol === -1) {
      return {};
    }
    
    const summary = {};
    
    // 找到本週的數據
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo && rowDate <= today) {
        const ticker = rows[i][tickerCol];
        if (!summary[ticker]) {
          summary[ticker] = {
            ticker: ticker,
            week_start_price: null,
            week_end_price: null,
            week_high: null,
            week_low: null,
            week_change: null,
            week_change_pct: null
          };
        }
        
        const close = parseFloat(rows[i][closeCol]);
        if (!summary[ticker].week_start_price || rowDate < new Date(summary[ticker].week_start_date)) {
          summary[ticker].week_start_price = close;
          summary[ticker].week_start_date = rowDate;
        }
        if (!summary[ticker].week_end_price || rowDate > new Date(summary[ticker].week_end_date)) {
          summary[ticker].week_end_price = close;
          summary[ticker].week_end_date = rowDate;
        }
      }
    }
    
    // 計算變動
    for (const ticker in summary) {
      if (summary[ticker].week_start_price && summary[ticker].week_end_price) {
        summary[ticker].week_change = summary[ticker].week_end_price - summary[ticker].week_start_price;
        summary[ticker].week_change_pct = (summary[ticker].week_change / summary[ticker].week_start_price) * 100;
      }
    }
    
    return summary;
  } catch (error) {
    Logger.log(`獲取本週 OHLCV 摘要失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取本週技術指標摘要
 * ⭐ V8.12 優化：優先讀取週度波動度計算結果（如果存在）
 * 
 * @returns {Object} summary - 本週技術指標摘要（包含週度波動度指標）
 */
function getWeeklyTechnicalIndicatorsSummary() {
  // ⭐ V8.12 新增：優先讀取週度波動度計算結果
  try {
    const weeklyMetrics = getTechnicalWeeklyMetrics();
    if (weeklyMetrics && Object.keys(weeklyMetrics).length > 0) {
      Logger.log("P5 Weekly V8.12：使用技術指標週度波動度計算結果（優化）");
      // 如果存在週度波動度數據，直接返回（避免重新讀取原始數據）
      return {
        weekly_metrics: weeklyMetrics,
        _source: "WEEKLY_METRICS"  // 標記數據來源
      };
    }
  } catch (error) {
    Logger.log(`P5 Weekly：讀取技術指標週度波動度失敗，回退到原始數據讀取：${error.message}`);
  }
  
  // 回退到原始數據讀取
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    
    if (dateCol === -1 || tickerCol === -1) {
      return {};
    }
    
    const summary = {};
    
    // 找到本週的最新數據（每個 ticker 只取最新一筆）
    for (let i = rows.length - 1; i >= 1; i--) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo && rowDate <= today) {
        const ticker = rows[i][tickerCol];
        if (!summary[ticker]) {
          summary[ticker] = {};
          headers.forEach((header, colIndex) => {
            if (header !== "date" && header !== "ticker" && header !== "created_at") {
              summary[ticker][header] = rows[i][colIndex];
            }
          });
        }
      }
    }
    
    return summary;
  } catch (error) {
    Logger.log(`獲取本週技術指標摘要失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取本週板塊表現
 * 
 * @returns {Object} summary - 本週板塊表現
 */
function getWeeklySectorPerformance() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("SECTOR_ETF_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const etfTickerCol = headers.indexOf("etf_ticker");
    const sectorCol = headers.indexOf("sector");
    const closeCol = headers.indexOf("close");
    const weekPerfCol = headers.indexOf("week_performance");
    
    if (dateCol === -1 || etfTickerCol === -1) {
      return {};
    }
    
    const summary = {};
    
    // 找到本週的數據
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo && rowDate <= today) {
        const etfTicker = rows[i][etfTickerCol];
        const sector = rows[i][sectorCol] || "未知";
        
        if (!summary[sector]) {
          summary[sector] = {
            sector: sector,
            etfs: [],
            avg_week_performance: 0,
            best_performer: null,
            worst_performer: null
          };
        }
        
        const close = parseFloat(rows[i][closeCol]) || 0;
        const weekPerf = parseFloat(rows[i][weekPerfCol]) || 0;
        
        summary[sector].etfs.push({
          etf_ticker: etfTicker,
          close: close,
          week_performance: weekPerf
        });
      }
    }
    
    // 計算每個板塊的平均表現和最佳/最差表現
    for (const sector in summary) {
      const etfs = summary[sector].etfs;
      if (etfs.length > 0) {
        const totalPerf = etfs.reduce((sum, etf) => sum + (etf.week_performance || 0), 0);
        summary[sector].avg_week_performance = totalPerf / etfs.length;
        
        // 找出最佳和最差表現
        const sorted = [...etfs].sort((a, b) => (b.week_performance || 0) - (a.week_performance || 0));
        summary[sector].best_performer = sorted[0] || null;
        summary[sector].worst_performer = sorted[sorted.length - 1] || null;
      }
    }
    
    return summary;
  } catch (error) {
    Logger.log(`獲取本週板塊表現失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取本週衍生品摘要
 * 
 * @returns {Object} summary - 本週衍生品摘要
 */
function getWeeklyDerivativesSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("DERIVATIVES_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    const putCallRatioCol = headers.indexOf("put_call_ratio");
    const iv30dCol = headers.indexOf("iv_30d");
    
    if (dateCol === -1 || tickerCol === -1) {
      return {};
    }
    
    const summary = {};
    
    // 找到本週的最新數據（每個 ticker 只取最新一筆）
    for (let i = rows.length - 1; i >= 1; i--) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo && rowDate <= today) {
        const ticker = rows[i][tickerCol];
        if (!summary[ticker]) {
          summary[ticker] = {
            ticker: ticker,
            put_call_ratio: parseFloat(rows[i][putCallRatioCol]) || null,
            iv_30d: parseFloat(rows[i][iv30dCol]) || null,
            date: rowDate
          };
        }
      }
    }
    
    // 計算整體統計
    const tickers = Object.keys(summary);
    const putCallRatios = tickers.map(t => summary[t].put_call_ratio).filter(v => v !== null);
    const iv30dValues = tickers.map(t => summary[t].iv_30d).filter(v => v !== null);
    
    return {
      tickers: summary,
      statistics: {
        total_tickers: tickers.length,
        avg_put_call_ratio: putCallRatios.length > 0 ? putCallRatios.reduce((a, b) => a + b, 0) / putCallRatios.length : null,
        avg_iv_30d: iv30dValues.length > 0 ? iv30dValues.reduce((a, b) => a + b, 0) / iv30dValues.length : null
      }
    };
  } catch (error) {
    Logger.log(`獲取本週衍生品摘要失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取本週新聞摘要
 * 
 * @returns {Object} summary - 本週新聞摘要
 */
function getWeeklyNewsSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("NEWS_ATOMS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const importanceCol = headers.indexOf("importance");
    
    if (dateCol === -1) {
      return {};
    }
    
    const summary = {
      total_news: 0,
      high_importance_news: 0,
      news_by_ticker: {},
      news_by_category: {}
    };
    
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo && rowDate <= today) {
        summary.total_news++;
        
        const importance = rows[i][importanceCol];
        if (importance === "HIGH" || importance === "CRITICAL") {
          summary.high_importance_news++;
        }
        
        const ticker = rows[i][headers.indexOf("ticker")];
        if (ticker) {
          if (!summary.news_by_ticker[ticker]) {
            summary.news_by_ticker[ticker] = 0;
          }
          summary.news_by_ticker[ticker]++;
        }
        
        const category = rows[i][headers.indexOf("category")];
        if (category) {
          if (!summary.news_by_category[category]) {
            summary.news_by_category[category] = 0;
          }
          summary.news_by_category[category]++;
        }
      }
    }
    
    return summary;
  } catch (error) {
    Logger.log(`獲取本週新聞摘要失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取本週機構活動摘要
 * 
 * @returns {Object} summary - 本週機構活動摘要
 */
function getWeeklyInstitutionalActivity() {
  try {
    // 從本週收集的機構數據中生成摘要
    const institutionalData = collectInstitutionalDataWeekly();
    
    return {
      f13f_updates: Object.keys(institutionalData.f13f || {}).length,
      f13f_holdings: institutionalData.f13f || {},
      dark_pool_activity: institutionalData.dark_pool || {},
      dark_pool_count: Object.keys(institutionalData.dark_pool || {}).length,
      options_flow_activity: institutionalData.options_flow || {},
      options_flow_count: Object.keys(institutionalData.options_flow || {}).length,
      insider_trading: institutionalData.insider_trading || [],
      insider_trading_count: (institutionalData.insider_trading || []).length,
      summary: {
        total_signals: Object.keys(institutionalData.f13f || {}).length +
                      Object.keys(institutionalData.dark_pool || {}).length +
                      Object.keys(institutionalData.options_flow || {}).length +
                      (institutionalData.insider_trading || []).length,
        most_active_tickers: extractMostActiveTickers(institutionalData)
      }
    };
  } catch (error) {
    Logger.log(`獲取本週機構活動摘要失敗：${error.message}`);
    return {
      f13f_updates: 0,
      dark_pool_activity: {},
      options_flow_activity: {},
      insider_trading: []
    };
  }
}

/**
 * 收集機構級數據（每週）
 * 
 * @returns {Object} institutionalData - 機構級數據
 */
function collectInstitutionalDataWeekly() {
  Logger.log("P5 Weekly：開始收集機構級數據");
  
  const institutionalData = {
    f13f: {},
    dark_pool: {},
    options_flow: {},
    insider_trading: []
  };
  
  const jobId = `INSTITUTIONAL_DATA_${Date.now()}`;
  
  try {
    // 1. 收集 13F 數據（季度機構持倉報告）
    try {
      const f13fQueries = [
        "13F filing institutional holdings latest",
        "SEC 13F institutional holdings Q4 2024",
        "13F holdings changes institutional investors"
      ];
      
      for (const query of f13fQueries) {
        try {
          const result = executeCSESearch(jobId, "CSE_SEARCH", {
            search_query: query,
            cse_type: "INSTITUTIONAL_DATA",
            max_results: 10
          });
          
          if (result && result.output && result.output.search_results) {
            const parsed = parseF13FDataFromCSE(result.output.search_results);
            Object.assign(institutionalData.f13f, parsed);
          }
          
          Utilities.sleep(500); // 避免請求過快
        } catch (error) {
          Logger.log(`P5 Weekly：13F 搜尋失敗 (${query})：${error.message}`);
        }
      }
      
      Logger.log(`P5 Weekly：收集到 ${Object.keys(institutionalData.f13f).length} 筆 13F 數據`);
    } catch (error) {
      Logger.log(`P5 Weekly：13F 數據收集失敗：${error.message}`);
    }
    
    // 2. 收集 Dark Pool 數據（暗池交易數據）
    try {
      const darkPoolQueries = [
        "FINRA ATS dark pool trading data",
        "dark pool activity institutional trading",
        "ATS trading volume dark pool"
      ];
      
      for (const query of darkPoolQueries) {
        try {
          const result = executeCSESearch(jobId, "CSE_SEARCH", {
            search_query: query,
            cse_type: "INSTITUTIONAL_DATA",
            max_results: 10
          });
          
          if (result && result.output && result.output.search_results) {
            const parsed = parseDarkPoolDataFromCSE(result.output.search_results);
            Object.assign(institutionalData.dark_pool, parsed);
          }
          
          Utilities.sleep(500);
        } catch (error) {
          Logger.log(`P5 Weekly：Dark Pool 搜尋失敗 (${query})：${error.message}`);
        }
      }
      
      Logger.log(`P5 Weekly：收集到 ${Object.keys(institutionalData.dark_pool).length} 筆 Dark Pool 數據`);
    } catch (error) {
      Logger.log(`P5 Weekly：Dark Pool 數據收集失敗：${error.message}`);
    }
    
    // 3. 收集 Options Flow 數據（期權流向數據）
    try {
      const optionsQueries = [
        "unusual options activity flow",
        "options flow institutional trading",
        "CBOE options open interest flow"
      ];
      
      for (const query of optionsQueries) {
        try {
          // ⭐⭐⭐ V8.0 修正：使用 P5_DERIVATIVES_US（美股衍生品）
          // Options Flow 主要用於美股，統一使用 theocc.com，避免格式衝突
          const result = executeCSESearch(jobId, "CSE_SEARCH", {
            search_query: query,
            cse_type: "P5_DERIVATIVES_US",  // ⭐ 修正：使用美股專用的衍生品 CSE
            max_results: 10
          });
          
          if (result && result.output && result.output.search_results) {
            const parsed = parseOptionsFlowDataFromCSE(result.output.search_results);
            Object.assign(institutionalData.options_flow, parsed);
          }
          
          Utilities.sleep(500);
        } catch (error) {
          Logger.log(`P5 Weekly：Options Flow 搜尋失敗 (${query})：${error.message}`);
        }
      }
      
      Logger.log(`P5 Weekly：收集到 ${Object.keys(institutionalData.options_flow).length} 筆 Options Flow 數據`);
    } catch (error) {
      Logger.log(`P5 Weekly：Options Flow 數據收集失敗：${error.message}`);
    }
    
    // 4. 收集 Insider Trading 數據（內部人交易數據）
    try {
      const insiderQueries = [
        "SEC insider trading Form 4",
        "insider trading transactions latest",
        "insider buying selling SEC filings"
      ];
      
      for (const query of insiderQueries) {
        try {
          const result = executeCSESearch(jobId, "CSE_SEARCH", {
            search_query: query,
            cse_type: "INSTITUTIONAL_DATA",
            max_results: 10
          });
          
          if (result && result.output && result.output.search_results) {
            const parsed = parseInsiderTradingDataFromCSE(result.output.search_results);
            institutionalData.insider_trading = parsed;
          }
          
          Utilities.sleep(500);
        } catch (error) {
          Logger.log(`P5 Weekly：Insider Trading 搜尋失敗 (${query})：${error.message}`);
        }
      }
      
      Logger.log(`P5 Weekly：收集到 ${institutionalData.insider_trading.length || 0} 筆 Insider Trading 數據`);
    } catch (error) {
      Logger.log(`P5 Weekly：Insider Trading 數據收集失敗：${error.message}`);
    }
    
    Logger.log(`P5 Weekly：機構級數據收集完成（13F: ${Object.keys(institutionalData.f13f).length}, Dark Pool: ${Object.keys(institutionalData.dark_pool).length}, Options Flow: ${Object.keys(institutionalData.options_flow).length}, Insider: ${institutionalData.insider_trading.length || 0}）`);
    
  } catch (error) {
    Logger.log(`P5 Weekly：機構級數據收集失敗：${error.message}`);
  }
  
  return institutionalData;
}

/**
 * 從 CSE 搜尋結果解析 13F 數據
 * 
 * @param {Array} searchResults - CSE 搜尋結果
 * @returns {Object} f13fData - 13F 數據
 */
function parseF13FDataFromCSE(searchResults) {
  const f13fData = {};
  
  for (const result of searchResults) {
    try {
      // 從搜尋結果中提取 ticker 和持倉信息
      // 實際實現需要根據數據源格式解析
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 簡單的 ticker 提取（可以改進）
      const tickerMatch = title.match(/\b([A-Z]{1,5})\b/) || snippet.match(/\b([A-Z]{1,5})\b/);
      if (tickerMatch && link.includes("sec.gov")) {
        const ticker = tickerMatch[1];
        if (!f13fData[ticker]) {
          f13fData[ticker] = {
            ticker: ticker,
            source: "SEC 13F",
            url: link,
            snippet: snippet,
            last_updated: new Date()
          };
        }
      }
    } catch (error) {
      Logger.log(`解析 13F 數據失敗：${error.message}`);
    }
  }
  
  return f13fData;
}

/**
 * 從 CSE 搜尋結果解析 Dark Pool 數據
 * 
 * @param {Array} searchResults - CSE 搜尋結果
 * @returns {Object} darkPoolData - Dark Pool 數據
 */
function parseDarkPoolDataFromCSE(searchResults) {
  const darkPoolData = {};
  
  for (const result of searchResults) {
    try {
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 簡單的 ticker 提取
      const tickerMatch = title.match(/\b([A-Z]{1,5})\b/) || snippet.match(/\b([A-Z]{1,5})\b/);
      if (tickerMatch && (link.includes("finra.org") || link.includes("dark"))) {
        const ticker = tickerMatch[1];
        if (!darkPoolData[ticker]) {
          darkPoolData[ticker] = {
            ticker: ticker,
            source: "FINRA ATS",
            url: link,
            snippet: snippet,
            last_updated: new Date()
          };
        }
      }
    } catch (error) {
      Logger.log(`解析 Dark Pool 數據失敗：${error.message}`);
    }
  }
  
  return darkPoolData;
}

/**
 * 從 CSE 搜尋結果解析 Options Flow 數據
 * 
 * @param {Array} searchResults - CSE 搜尋結果
 * @returns {Object} optionsFlowData - Options Flow 數據
 */
function parseOptionsFlowDataFromCSE(searchResults) {
  const optionsFlowData = {};
  
  for (const result of searchResults) {
    try {
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 簡單的 ticker 提取
      const tickerMatch = title.match(/\b([A-Z]{1,5})\b/) || snippet.match(/\b([A-Z]{1,5})\b/);
      if (tickerMatch && (link.includes("cboe.com") || link.includes("options") || link.includes("unusual"))) {
        const ticker = tickerMatch[1];
        if (!optionsFlowData[ticker]) {
          optionsFlowData[ticker] = {
            ticker: ticker,
            source: "CBOE/Options Flow",
            url: link,
            snippet: snippet,
            last_updated: new Date()
          };
        }
      }
    } catch (error) {
      Logger.log(`解析 Options Flow 數據失敗：${error.message}`);
    }
  }
  
  return optionsFlowData;
}

/**
 * 從 CSE 搜尋結果解析 Insider Trading 數據
 * 
 * @param {Array} searchResults - CSE 搜尋結果
 * @returns {Array} insiderTradingData - Insider Trading 數據列表
 */
function parseInsiderTradingDataFromCSE(searchResults) {
  const insiderTradingData = [];
  
  for (const result of searchResults) {
    try {
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 簡單的 ticker 提取
      const tickerMatch = title.match(/\b([A-Z]{1,5})\b/) || snippet.match(/\b([A-Z]{1,5})\b/);
      if (tickerMatch && link.includes("sec.gov")) {
        insiderTradingData.push({
          ticker: tickerMatch[1],
          source: "SEC Form 4",
          url: link,
          snippet: snippet,
          last_updated: new Date()
        });
      }
    } catch (error) {
      Logger.log(`解析 Insider Trading 數據失敗：${error.message}`);
    }
  }
  
  return insiderTradingData;
}

/**
 * 提取最活躍的股票代碼（從機構數據中）
 * 
 * @param {Object} institutionalData - 機構數據
 * @returns {Array} mostActiveTickers - 最活躍的股票代碼列表
 */
function extractMostActiveTickers(institutionalData) {
  const tickerCount = {};
  
  // 統計 13F
  for (const ticker in institutionalData.f13f || {}) {
    tickerCount[ticker] = (tickerCount[ticker] || 0) + 1;
  }
  
  // 統計 Dark Pool
  for (const ticker in institutionalData.dark_pool || {}) {
    tickerCount[ticker] = (tickerCount[ticker] || 0) + 1;
  }
  
  // 統計 Options Flow
  for (const ticker in institutionalData.options_flow || {}) {
    tickerCount[ticker] = (tickerCount[ticker] || 0) + 1;
  }
  
  // 統計 Insider Trading
  for (const item of institutionalData.insider_trading || []) {
    if (item.ticker) {
      tickerCount[item.ticker] = (tickerCount[item.ticker] || 0) + 1;
    }
  }
  
  // 排序並返回前 10 名
  const sorted = Object.entries(tickerCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ticker, count]) => ({ ticker, signal_count: count }));
  
  return sorted;
}

// ==========================================
// P6 週度摘要讀取 ⭐ V8.15 新增
// ==========================================

/**
 * 獲取 P6 週度摘要（盤中異常頻率趨勢）
 * ⭐ V8.15 新增：計算本週 P6 警報頻率 vs 過去 4 週平均
 * 
 * @returns {Object} p6WeeklySummary - P6 週度摘要
 */
function getP6WeeklySummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P6_INTRADAY_ALERTS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly：P6_INTRADAY_ALERTS_DAILY 表格不存在或沒有數據");
      return {
        weekly_events: [],
        frequency_trend: null,
        alert_count: 0,
        avg_4w: 0,
        trend_ratio: 1.0
      };
    }
    
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourWeeksAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    if (dateCol === -1) {
      return {
        weekly_events: [],
        frequency_trend: null,
        alert_count: 0,
        avg_4w: 0,
        trend_ratio: 1.0
      };
    }
    
    const weeklyEvents = [];
    const fourWeekEvents = [];
    
    // 收集本週和過去 4 週的事件
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= fourWeeksAgo && rowDate <= today) {
        if (rowDate >= oneWeekAgo) {
          weeklyEvents.push(rows[i]);
        } else {
          fourWeekEvents.push(rows[i]);
        }
      }
    }
    
    // 計算過去 4 週平均（排除本週）
    const avg4W = fourWeekEvents.length / 3;  // 過去 3 週的平均
    const currentWeekCount = weeklyEvents.length;
    const trendRatio = avg4W > 0 ? currentWeekCount / avg4W : 1.0;
    
    // 判斷頻率趨勢
    let frequencyTrend = "NORMAL";
    if (trendRatio > 2.0) {  // 超過 2 sigma（簡化為 2 倍）
      frequencyTrend = "SURGE";
    } else if (trendRatio > 1.5) {
      frequencyTrend = "ELEVATED";
    } else if (trendRatio < 0.5) {
      frequencyTrend = "DECREASED";
    }
    
    Logger.log(`P5 Weekly：P6 週度摘要 - 本週：${currentWeekCount}，過去4週平均：${avg4W.toFixed(2)}，趨勢：${frequencyTrend}`);
    
    return {
      weekly_events: weeklyEvents,
      frequency_trend: frequencyTrend,
      alert_count: currentWeekCount,
      avg_4w: avg4W,
      trend_ratio: trendRatio
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：讀取 P6 週度摘要失敗：${error.message}`);
    return {
      weekly_events: [],
      frequency_trend: null,
      alert_count: 0,
      avg_4w: 0,
      trend_ratio: 1.0
    };
  }
}

/**
 * 獲取重大財經行事曆
 * ⭐ V8.15 新增：整合重大財經行事曆到 Weekly
 * 
 * @returns {Object} calendar - 財經行事曆
 */
function getP5WeeklyCalendar() {
  try {
    // 檢查是否有 P5 Calendar Manager
    if (typeof P5_Calendar_ScanNextTwoWeeks === "function") {
      const events = P5_Calendar_ScanNextTwoWeeks(new Date());
      const today = new Date();
      
      // ⭐ V8.0 新增：為每個事件添加歷史經驗數據和監控數據
      const enhancedEvents = events.map(event => {
        // 從 P5__CALENDAR 表格讀取歷史經驗數據
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName("P5__CALENDAR");
        
        if (sheet && sheet.getLastRow() > 1) {
          const dataRange = sheet.getDataRange();
          const rows = dataRange.getValues();
          const headers = rows[0];
          
          const eventIdCol = headers.indexOf("event_id");
          const historicalPerfCol = headers.indexOf("historical_performance_json");
          const riskWarningsCol = headers.indexOf("risk_warnings_json");
          const trackingRecCol = headers.indexOf("tracking_recommendations_json");
          const priorWeightCol = headers.indexOf("prior_weight");
          const priorConfidenceCol = headers.indexOf("prior_confidence");
          const preWindowCol = headers.indexOf("pre_window");
          const postWindowCol = headers.indexOf("post_window");
          
          if (eventIdCol !== -1) {
            for (let i = 1; i < rows.length; i++) {
              if (rows[i][eventIdCol] === event.event_id) {
                // 找到對應事件，讀取歷史經驗數據
                try {
                  event.historical_performance_json = rows[i][historicalPerfCol] || null;
                  event.risk_warnings_json = rows[i][riskWarningsCol] || null;
                  event.tracking_recommendations_json = rows[i][trackingRecCol] || null;
                  event.prior_weight = rows[i][priorWeightCol] || 0.5;
                  event.prior_confidence = rows[i][priorConfidenceCol] || 0.5;
                  event.pre_window = rows[i][preWindowCol] || 7;
                  event.post_window = rows[i][postWindowCol] || 7;
                } catch (e) {
                  Logger.log(`P5 Weekly：讀取事件 ${event.event_id} 歷史經驗失敗：${e.message}`);
                }
                break;
              }
            }
          }
        }
        
        // ⭐ V8.0 新增：計算是否為當週事件（最高權重）
        const eventDate = new Date(event.date_start);
        const daysUntilEvent = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
        event.is_current_week = daysUntilEvent >= 0 && daysUntilEvent <= 7;  // 當週事件
        event.is_high_priority = daysUntilEvent >= 0 && daysUntilEvent <= 14;  // 高優先級（14天內）
        
        // ⭐ V8.0 新增：獲取10-14天前的監控數據（如果存在）
        if (daysUntilEvent >= 0 && daysUntilEvent <= 14 && typeof getEventMonitoringData === "function") {
          try {
            const monitoringData = getEventMonitoringData(event.event_id);
            event.monitoring_data = monitoringData;  // 10-14天前的關鍵數據監控結果
          } catch (e) {
            Logger.log(`P5 Weekly：獲取事件 ${event.event_id} 監控數據失敗：${e.message}`);
          }
        }
        
        return event;
      });
      
      // ⭐ V8.0 新增：分離當週事件（最高權重）和其他事件
      const currentWeekEvents = enhancedEvents.filter(e => e.is_current_week);
      const highPriorityEvents = enhancedEvents.filter(e => e.is_high_priority && !e.is_current_week);
      const otherEvents = enhancedEvents.filter(e => !e.is_high_priority);
      
      // 分類事件
      const macroCalendar = [];
      const earningsCalendar = [];
      const optionsExpiration = [];
      
      enhancedEvents.forEach(event => {
        if (event.type === "MACRO" || event.type === "FOMC" || event.type === "CPI" || event.type === "NFP") {
          macroCalendar.push(event);
        } else if (event.type === "EARNINGS") {
          earningsCalendar.push(event);
        } else if (event.type === "OPTIONS_EXPIRATION" || event.type === "QUAD_WITCH") {
          optionsExpiration.push(event);
        }
      });
      
      return {
        macro_calendar: macroCalendar,
        earnings_calendar: earningsCalendar,
        options_expiration: optionsExpiration,
        all_events: enhancedEvents,  // ⭐ 返回增強後的事件列表（包含歷史經驗）
        // ⭐ V8.0 新增：分級事件列表（用於策略生成時優先級排序）
        current_week_events: currentWeekEvents,  // 當週事件（最高權重）
        high_priority_events: highPriorityEvents,  // 高優先級事件（14天內）
        other_events: otherEvents  // 其他事件
      };
    } else {
      Logger.log("P5 Weekly：P5_Calendar_ScanNextTwoWeeks 函數不存在，跳過行事曆整合");
      return {
        macro_calendar: [],
        earnings_calendar: [],
        options_expiration: [],
        all_events: [],
        current_week_events: [],
        high_priority_events: [],
        other_events: []
      };
    }
  } catch (error) {
    Logger.log(`P5 Weekly：讀取財經行事曆失敗：${error.message}`);
    return {
      macro_calendar: [],
      earnings_calendar: [],
      options_expiration: [],
      all_events: []
    };
  }
}

/**
 * 獲取 macro_flow_context（Sector ETF Flow 與 Mag 7 分析）
 * ⭐ V8.15 新增：整合 V8.12 的 MACRO_DATA_WEEKLY_METRICS
 * 
 * @returns {Object} macro_flow_context - 宏觀資金流向上下文
 */
function getMacroFlowContext() {
  try {
    // 嘗試讀取 MACRO_DATA_WEEKLY_METRICS（如果存在）
    let sectorEtfFlow = null;
    let mag7RelativeStrength = null;
    
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName("MACRO_DATA_WEEKLY_METRICS");
      
      if (sheet && sheet.getLastRow() > 1) {
        const lastRow = sheet.getLastRow();
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const row = sheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
        
        const getColValue = (colName) => {
          const colIndex = headers.indexOf(colName);
          if (colIndex === -1) return null;
          const value = row[colIndex];
          if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
            try {
              return JSON.parse(value);
            } catch (e) {
              return value;
            }
          }
          return value;
        };
        
        sectorEtfFlow = getColValue("sector_etf_flow_json");
        mag7RelativeStrength = getColValue("mag7_relative_strength_json");
      }
    } catch (error) {
      Logger.log(`P5 Weekly：讀取 MACRO_DATA_WEEKLY_METRICS 失敗：${error.message}`);
    }
    
    return {
      sector_etf_flow: sectorEtfFlow || null,
      mag7_relative_strength: mag7RelativeStrength || null,
      source: "V8.12_MACRO_DATA_WEEKLY_METRICS"
    };
  } catch (error) {
    Logger.log(`P5 Weekly：獲取 macro_flow_context 失敗：${error.message}`);
    return {
      sector_etf_flow: null,
      mag7_relative_strength: null,
      source: null
    };
  }
}

/**
 * 獲取上週策略執行結果
 * ⭐ V8.15 新增：從上一版 P5 Weekly 快照讀取策略執行結果
 * 
 * @returns {Object} previous_strategy_results - 上週策略執行結果（以 ticker 為 key）
 */
function getPreviousStrategyResults() {
  try {
    const previousSnapshot = getLatestP5WeeklySnapshot();
    if (!previousSnapshot || !previousSnapshot.strategy_results) {
      return {};
    }
    
    // 將策略結果轉換為以 ticker 為 key 的格式
    const results = {};
    if (Array.isArray(previousSnapshot.strategy_results)) {
      previousSnapshot.strategy_results.forEach(result => {
        if (result.ticker) {
          results[result.ticker] = result;
        }
      });
    } else if (typeof previousSnapshot.strategy_results === "object") {
      Object.assign(results, previousSnapshot.strategy_results);
    }
    
    return results;
  } catch (error) {
    Logger.log(`P5 Weekly：讀取上週策略執行結果失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取當前持倉
 * ⭐ V8.15 新增：從 P4 快照或 IB 帳戶讀取當前持倉
 * 
 * @returns {Object} current_positions - 當前持倉（以 ticker 為 key）
 */
function getCurrentPositions() {
  try {
    // 優先從 P4 快照讀取
    const p4Snapshot = getLatestP4Snapshot();
    if (p4Snapshot && p4Snapshot.allocations) {
      const positions = {};
      p4Snapshot.allocations.forEach(allocation => {
        if (allocation.ticker && allocation.current_shares > 0) {
          positions[allocation.ticker] = {
            ticker: allocation.ticker,
            shares: allocation.current_shares,
            avg_cost: allocation.avg_cost || null,
            current_price: allocation.current_price || null,
            market_value: allocation.market_value || null
          };
        }
      });
      return positions;
    }
    
    // 如果 P4 快照沒有，嘗試從 IB 帳戶讀取（如果函數存在）
    if (typeof getIBPositions === "function") {
      try {
        return getIBPositions();
      } catch (error) {
        Logger.log(`P5 Weekly：從 IB 讀取持倉失敗：${error.message}`);
      }
    }
    
    return {};
  } catch (error) {
    Logger.log(`P5 Weekly：獲取當前持倉失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取未成交掛單
 * ⭐ V8.15 新增：從 IB 帳戶讀取未成交掛單
 * 
 * @returns {Object} open_orders - 未成交掛單（以 ticker 為 key）
 */
function getOpenOrders() {
  try {
    // 嘗試從 IB 帳戶讀取（如果函數存在）
    if (typeof getIBOpenOrders === "function") {
      try {
        return getIBOpenOrders();
      } catch (error) {
        Logger.log(`P5 Weekly：從 IB 讀取未成交掛單失敗：${error.message}`);
      }
    }
    
    return {};
  } catch (error) {
    Logger.log(`P5 Weekly：獲取未成交掛單失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取上週成交記錄
 * ⭐ V8.15 新增：從 IB 帳戶或交易日誌讀取上週成交記錄
 * 
 * @returns {Object} fills_since_last_week - 上週成交記錄（以 ticker 為 key）
 */
function getFillsSinceLastWeek() {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // 嘗試從 IB 帳戶讀取（如果函數存在）
    if (typeof getIBFillsSince === "function") {
      try {
        return getIBFillsSince(oneWeekAgo);
      } catch (error) {
        Logger.log(`P5 Weekly：從 IB 讀取成交記錄失敗：${error.message}`);
      }
    }
    
    // 嘗試從交易日誌讀取（如果表格存在）
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName("TRADE_LOG");
      
      if (sheet && sheet.getLastRow() > 1) {
        const fills = {};
        const dataRange = sheet.getDataRange();
        const rows = dataRange.getValues();
        const headers = rows[0];
        
        const dateCol = headers.indexOf("date") || headers.indexOf("execution_date");
        const tickerCol = headers.indexOf("ticker") || headers.indexOf("symbol");
        const qtyCol = headers.indexOf("quantity") || headers.indexOf("qty");
        const priceCol = headers.indexOf("price") || headers.indexOf("execution_price");
        
        if (dateCol !== -1 && tickerCol !== -1) {
          for (let i = 1; i < rows.length; i++) {
            const rowDate = new Date(rows[i][dateCol]);
            if (rowDate >= oneWeekAgo) {
              const ticker = rows[i][tickerCol];
              if (!fills[ticker]) {
                fills[ticker] = [];
              }
              fills[ticker].push({
                date: rowDate,
                ticker: ticker,
                quantity: rows[i][qtyCol] || null,
                price: rows[i][priceCol] || null
              });
            }
          }
        }
        
        return fills;
      }
    } catch (error) {
      Logger.log(`P5 Weekly：從交易日誌讀取成交記錄失敗：${error.message}`);
    }
    
    return {};
  } catch (error) {
    Logger.log(`P5 Weekly：獲取上週成交記錄失敗：${error.message}`);
    return {};
  }
}

/**
 * ⭐ V8.19 實戰模擬三：獲取最新學習狀態（用於 MISSION_CONSTRAINTS 注入）
 * 彙總 learning_log 的 failure_cases、key_lessons → failed_patterns、constraints_text。
 * 「Learning constraints override strategy preferences.」
 *
 * @param {Array} learningLogHistory - 來自 collectHistoricalLearningLog(4)
 * @returns {Object} { failed_patterns: string[], constraints_text: string }
 */
function getLatestLearningState(learningLogHistory) {
  const failed_patterns = [];
  const constraintLines = [];
  const learning_params = {};
  
  if (!learningLogHistory || !Array.isArray(learningLogHistory)) {
    return { failed_patterns: [], constraints_text: "", learning_params: {} };
  }
  
  for (const entry of learningLogHistory) {
    const fc = entry.failure_cases || [];
    const kl = entry.key_lessons || [];
    for (const c of fc) {
      const s = typeof c === "string" ? c : (c.ticker ? `${c.ticker}: ${c.strategy_summary || "策略未對齊"}` : JSON.stringify(c).slice(0, 120));
      if (s && !failed_patterns.includes(s)) failed_patterns.push(s);
    }
    for (const l of kl) {
      const line = typeof l === "string" ? l : (l.summary || JSON.stringify(l).slice(0, 100));
      if (line && !constraintLines.includes(line)) constraintLines.push(line);
    }
    
    // ⭐ V8.19 新增：提取學習參數（從 systematic_learning 中提取）
    const sl = entry.systematic_learning || {};
    if (sl.breathing_weights) {
      learning_params.breathing_weights = sl.breathing_weights;
    }
    if (sl.entry_confirmation_atr_multiple !== undefined) {
      learning_params.entry_confirmation_atr_multiple = sl.entry_confirmation_atr_multiple;
    }
    if (sl.lock_profit_atr_multiple !== undefined) {
      learning_params.lock_profit_atr_multiple = sl.lock_profit_atr_multiple;
    }
  }
  
  const constraints_text = constraintLines.length
    ? constraintLines.join("\n- ") + "\n\n**Learning constraints override strategy preferences.**"
    : "";
  
  return { 
    failed_patterns, 
    constraints_text,
    learning_params: learning_params  // ⭐ V8.19 新增：學習參數（breathing_weights、entry_confirmation_atr_multiple 等）
  };
}

/**
 * 獲取動態學習系統反饋
 * ⭐ V8.15 新增：從學習系統讀取反饋數據
 * 
 * @returns {Object} learning_feedback - 學習系統反饋
 */
function getLearningFeedback() {
  try {
    // 嘗試讀取學習系統狀態（如果函數存在）
    if (typeof getLearningState === "function") {
      try {
        const learningState = getLearningState();
        return {
          principles_summary: learningState.principles_summary || null,
          recent_reflections: learningState.recent_reflections || [],
          similar_failure_cases: learningState.similar_failure_cases || [],
          safety_lock_recommendations: learningState.safety_lock_recommendations || [],
          parameter_bias_adjustment: learningState.parameter_bias_adjustment || null
        };
      } catch (error) {
        Logger.log(`P5 Weekly：讀取學習系統狀態失敗：${error.message}`);
      }
    }
    
    // 嘗試從表格讀取（如果存在）
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName("LEARNING_STATE");
      
      if (sheet && sheet.getLastRow() > 1) {
        const lastRow = sheet.getLastRow();
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const row = sheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
        
        const getColValue = (colName) => {
          const colIndex = headers.indexOf(colName);
          if (colIndex === -1) return null;
          const value = row[colIndex];
          if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
            try {
              return JSON.parse(value);
            } catch (e) {
              return value;
            }
          }
          return value;
        };
        
        return {
          principles_summary: getColValue("principles_summary"),
          recent_reflections: getColValue("recent_reflections_json") || [],
          similar_failure_cases: getColValue("similar_failure_cases_json") || [],
          safety_lock_recommendations: getColValue("safety_lock_recommendations_json") || [],
          parameter_bias_adjustment: getColValue("parameter_bias_adjustment_json") || null
        };
      }
    } catch (error) {
      Logger.log(`P5 Weekly：從表格讀取學習系統狀態失敗：${error.message}`);
    }
    
    return null;
  } catch (error) {
    Logger.log(`P5 Weekly：獲取學習系統反饋失敗：${error.message}`);
    return null;
  }
}
