/**
 * 📊 P5 Monthly: 月度分析（擴展版）⭐ V8.0 增強
 * 
 * 每月進行市場分析：
 * - 月度趨勢分析
 * - 持倉表現評估
 * - 策略調整建議
 * 
 * ⭐ V7.1 新增功能：
 * - 月營收追蹤（台灣股票）
 * - 統整四週 Weekly 結論
 * - 月度時間維度分析（世界觀與市場反應對照）
 * - 歷史事件連結（前三個月）
 * 
 * ⭐ V8.0 新增功能：
 * - 動態學習機制（AI 模型驅動）
 * - 提供前三個月歷史快照（Weekly 策略 + 實際結果）
 * - AI 模型分析預測 vs 實際偏移度
 * - 雙模型交叉驗證（Claude Sonnet 4.5 + GPT-5.2）
 * 
 * 執行頻率：每月 1 次
 * 執行者：Claude Sonnet 4.5
 * 審查者：GPT-5.1
 * 
 * @version SSOT V8.0
 * @date 2025-01-14
 */

// ==========================================
// P5 Monthly 核心執行函數
// ==========================================

/**
 * P5 Monthly 主執行函數
 * 
 * @param {Object} params - 執行參數
 * @param {string} params.trigger - 觸發來源（MONTHLY / MANUAL）
 * @returns {Object} result - 執行結果
 */
function P5_Monthly_Execute(params) {
  try {
    Logger.log(`P5 Monthly 執行開始：trigger=${params.trigger}`);
    
    // Step 1: 檢查決策權限
    const context = {
      defcon: getCurrentDEFCON(),
      p4_6_triggered: false
    };
    
    if (!checkP5DecisionHierarchy("MONTHLY", context)) {
      Logger.log("P5 Monthly：決策權限檢查未通過，執行受限");
      return {
        status: "RESTRICTED",
        reason: "決策權限檢查未通過"
      };
    }
    
    // Step 2: 收集所有月度數據
    Logger.log("P5 Monthly：開始收集所有月度數據");
    const monthlyData = collectP5MonthlyAllData();
    
    // Step 3: 月營收追蹤（台灣股票）
    Logger.log("P5 Monthly：開始月營收追蹤");
    const revenueData = collectMonthlyRevenueData();
    
    // Step 4: 統整四週 Weekly 結論
    Logger.log("P5 Monthly：統整四週 Weekly 結論");
    const weeklyIntegration = integrateFourWeeksWeekly();
    
    // Step 5: 歷史事件連結（前三個月）
    Logger.log("P5 Monthly：分析歷史事件連結");
    const historicalEvents = analyzeHistoricalEvents(3);  // 前三個月
    
    // Step 5.5: ⭐ V8.13 新增：比對上一月的策略與市場真實反應（動態學習系統核心）
    Logger.log("P5 Monthly V8.13：開始比對上一月的策略與市場真實反應");
    let previousMonthStrategyComparison = null;
    try {
      // ⭐ V8.13修正：移除V7設計的錯誤方向，使用現有版本
      previousMonthStrategyComparison = compareStrategyWithReality(1, "MONTH");
      
      if (previousMonthStrategyComparison && previousMonthStrategyComparison.strategies_compared > 0) {
        Logger.log(`P5 Monthly V8.13：策略比對完成 - 對齊率：${((previousMonthStrategyComparison.performance_summary?.alignment_rate || 0) * 100).toFixed(1)}%，對齊：${previousMonthStrategyComparison.aligned_strategies?.length || 0}，未對齊：${previousMonthStrategyComparison.misaligned_strategies?.length || 0}`);
        
        // 保存比對結果到學習日誌（作為前一月的策略比對紀錄）
        saveStrategyComparisonToLearningLog(previousMonthStrategyComparison, "MONTHLY");
      } else {
        Logger.log("P5 Monthly V8.13：無上一月的策略數據可對照（可能是首次執行）");
      }
    } catch (error) {
      Logger.log(`P5 Monthly V8.13：策略比對失敗：${error.message}（不中斷主流程）`);
      // 不中斷主流程，只記錄錯誤
    }
    
    // Step 5.6: 收集前三個月歷史快照（用於學習機制）⭐ V8.0 新增
    Logger.log("P5 Monthly：收集前三個月歷史快照（用於學習機制）");
    const historicalSnapshots = collectThreeMonthsHistoricalSnapshots();
    
    // Step 5.7: AI 模型分析預測 vs 實際偏移度 ⭐ V8.0 新增
    Logger.log("P5 Monthly：AI 模型分析預測 vs 實際偏移度");
    const learningAnalysis = analyzeLearningWithAI(historicalSnapshots);
    
    // Step 6: 準備 M0 Job
    const m0InputPayload = {
      phase: "P5_MONTHLY",
      frequency: "MONTHLY",
      trigger: params.trigger,
      monthly_market_data: monthlyData,
      revenue_data: revenueData,
      weekly_integration: weeklyIntegration,
      historical_events: historicalEvents,
      institutional_data: collectInstitutionalDataMonthly(),
      context: params.context || {}
    };
    
    // Step 7: 構建 M0 流程
    const requestedFlow = ["SONNET", "GPT"];
    m0InputPayload.p5_monthly_prompt = buildP5MonthlyPrompt({
      monthlyData: monthlyData,
      revenueData: revenueData,
      weeklyIntegration: weeklyIntegration,
      historicalEvents: historicalEvents,
      historicalSnapshots: historicalSnapshots,  // ⭐ V8.0 新增
      learningAnalysis: learningAnalysis,  // ⭐ V8.0 新增
      previousMonthStrategyComparison: previousMonthStrategyComparison  // ⭐ V8.13 新增：前一月策略比對結果
    });
    
    // Step 5: 提交到 M0 Job Queue
    const jobId_final = submitP5ToM0JobQueue("P5_MONTHLY", requestedFlow, m0InputPayload);
    
    return {
      status: "SUBMITTED",
      job_id: jobId_final,
      frequency: "MONTHLY"
    };
    
  } catch (error) {
    Logger.log(`P5 Monthly 執行失敗：${error.message}`);
    throw error;
  }
}

/**
 * 處理 P5 Monthly M0 執行結果
 * 
 * @param {string} jobId - Job ID
 * @param {Object} m0Result - M0 執行結果
 * @returns {Object} result - 處理結果
 */
function P5_Monthly_ProcessM0Result(jobId, m0Result) {
  try {
    Logger.log(`P5 Monthly 處理 M0 結果：jobId=${jobId}`);
    
    const executorOutput = m0Result.executor_output || {};
    const auditorOutput = m0Result.auditor_output || {};
    
    // 整合機構級視角
    const enhancedAnalysis = integrateInstitutionalPerspectiveP5(executorOutput, m0Result.institutional_data || {});
    
    // 生成 P5 Monthly 輸出
    const p5MonthlyOutput = generateP5MonthlyOutput(enhancedAnalysis, auditorOutput);
    
    // 保存快照
    const snapshot = saveP5MonthlySnapshot({
      p2_snapshot_id: m0Result.p2_snapshot?.snapshot_id || null,
      p3_snapshot_id: m0Result.p3_snapshot?.snapshot_id || null,
      p4_snapshot_id: m0Result.p4_snapshot?.snapshot_id || null,
      monthly_trend_analysis: p5MonthlyOutput.monthly_trend_analysis,
      portfolio_performance: p5MonthlyOutput.portfolio_performance,
      strategy_adjustments: p5MonthlyOutput.strategy_adjustments,
      institutional_insights: p5MonthlyOutput.institutional_insights,
      learning_results: m0Result.learning_analysis || null  // ⭐ V8.0 新增：學習結果
    });
    
    return {
      status: "COMPLETED",
      snapshot_id: snapshot.snapshot_id,
      p5_monthly_output: p5MonthlyOutput,
      learning_analysis: m0Result.learning_analysis || null  // ⭐ V8.0 新增
    };
    
  } catch (error) {
    Logger.log(`P5 Monthly 處理 M0 結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 數據收集與 Prompt 構建
// ==========================================

/**
 * 收集月度市場數據
 * 
 * @returns {Object} monthlyData - 月度市場數據
 */
function collectMonthlyMarketData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const today = new Date();
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    // 從 MARKET_OHLCV_DAILY 讀取月度數據
    const ohlcvSheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    const indicatorsSheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
    
    const monthlyData = {
      ohlcv_summary: {},
      technical_indicators_summary: {},
      portfolio_performance: {},
      sector_performance: {}
    };
    
    // 收集 OHLCV 月度摘要
    if (ohlcvSheet && ohlcvSheet.getLastRow() > 1) {
      const ohlcvRows = ohlcvSheet.getDataRange().getValues();
      const ohlcvHeaders = ohlcvRows[0];
      const dateCol = ohlcvHeaders.indexOf("date");
      const tickerCol = ohlcvHeaders.indexOf("ticker");
      const closeCol = ohlcvHeaders.indexOf("close");
      
      if (dateCol !== -1 && tickerCol !== -1 && closeCol !== -1) {
        const tickerData = {};
        for (let i = 1; i < ohlcvRows.length; i++) {
          const rowDate = new Date(ohlcvRows[i][dateCol]);
          if (rowDate >= monthAgo && rowDate <= today) {
            const ticker = ohlcvRows[i][tickerCol];
            if (!tickerData[ticker]) {
              tickerData[ticker] = {
                month_start_price: null,
                month_end_price: null,
                month_high: null,
                month_low: null
              };
            }
            
            const close = parseFloat(ohlcvRows[i][closeCol]);
            if (!tickerData[ticker].month_start_price || rowDate < new Date(tickerData[ticker].month_start_date)) {
              tickerData[ticker].month_start_price = close;
              tickerData[ticker].month_start_date = rowDate;
            }
            if (!tickerData[ticker].month_end_price || rowDate > new Date(tickerData[ticker].month_end_date)) {
              tickerData[ticker].month_end_price = close;
              tickerData[ticker].month_end_date = rowDate;
            }
          }
        }
        
        // 計算月度變動
        for (const ticker in tickerData) {
          if (tickerData[ticker].month_start_price && tickerData[ticker].month_end_price) {
            tickerData[ticker].month_change = tickerData[ticker].month_end_price - tickerData[ticker].month_start_price;
            tickerData[ticker].month_change_pct = (tickerData[ticker].month_change / tickerData[ticker].month_start_price) * 100;
          }
        }
        
        monthlyData.ohlcv_summary = tickerData;
      }
    }
    
    return monthlyData;
  } catch (error) {
    Logger.log(`收集月度市場數據失敗：${error.message}`);
    return {};
  }
}

/**
 * 收集月度機構數據
 * 
 * @returns {Object} institutionalData - 月度機構數據
 */
function collectInstitutionalDataMonthly() {
  // TODO: 收集月度機構數據（13F、Dark Pool、Options Flow、Insider Trading）
  return {
    f13f: null,
    dark_pool: null,
    options_flow: null,
    insider_trading: null
  };
}

/**
 * 收集 P5 Monthly 所需的所有數據
 * 
 * @returns {Object} allData - 所有月度數據
 */
function collectP5MonthlyAllData() {
  try {
    const monthlyMarketData = collectMonthlyMarketData();
    const monthlyWorldview = collectMonthlyWorldview();
    const monthlyLearningLog = collectMonthlyLearningLog();
    
    return {
      market_data: monthlyMarketData,
      worldview: monthlyWorldview,
      learning_log: monthlyLearningLog
    };
  } catch (error) {
    Logger.log(`P5 Monthly：收集所有數據失敗：${error.message}`);
    return {};
  }
}

/**
 * 收集月度世界觀更新
 * 
 * @returns {Array} worldviewUpdates - 月度世界觀更新列表
 */
function collectMonthlyWorldview() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("WORLDVIEW_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const today = new Date();
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const worldviewCol = headers.indexOf("worldview_update_json");
    
    if (dateCol === -1 || worldviewCol === -1) {
      return [];
    }
    
    const worldviewUpdates = [];
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= monthAgo && rowDate <= today) {
        try {
          const worldview = rows[i][worldviewCol] ? JSON.parse(rows[i][worldviewCol]) : {};
          worldviewUpdates.push({
            date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
            worldview: worldview
          });
        } catch (e) {
          Logger.log(`P5 Monthly：解析世界觀更新失敗：${e.message}`);
        }
      }
    }
    
    return worldviewUpdates;
  } catch (error) {
    Logger.log(`P5 Monthly：收集月度世界觀失敗：${error.message}`);
    return [];
  }
}

/**
 * 收集月度學習日誌
 * 
 * @returns {Array} learningLogs - 月度學習日誌列表
 */
function collectMonthlyLearningLog() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__LEARNING_LOG");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const today = new Date();
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const periodCol = headers.indexOf("period");
    
    if (dateCol === -1) {
      return [];
    }
    
    const learningLogs = [];
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= monthAgo && rowDate <= today) {
        const period = rows[i][periodCol] || "";
        if (period === "WEEKLY" || period === "MONTHLY") {
          learningLogs.push({
            date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
            period: period,
            row: rows[i]
          });
        }
      }
    }
    
    return learningLogs;
  } catch (error) {
    Logger.log(`P5 Monthly：收集月度學習日誌失敗：${error.message}`);
    return [];
  }
}

/**
 * 收集月度營收數據（台灣股票）
 * 
 * @returns {Object} revenueData - 月度營收數據
 */
function collectMonthlyRevenueData() {
  try {
    Logger.log("P5 Monthly：開始收集台灣股票月營收數據");
    
    const tickers = getHoldingsTickers();
    const taiwanTickers = tickers.filter(ticker => isTaiwanStock(ticker));
    
    Logger.log(`P5 Monthly：找到 ${taiwanTickers.length} 檔台灣股票需要追蹤月營收`);
    
    const revenueData = {};
    
    // 從 CSE 或官方數據源收集月營收
    // TODO: 實現具體的月營收收集邏輯（使用 CSE 搜尋或 TWSE/TPEX API）
    for (const ticker of taiwanTickers) {
      try {
        // 簡化實現：使用 CSE 搜尋月營收
        const searchResults = executeCSESearch(
          `台灣股票 ${ticker} 月營收`,
          "P5_MARKET"  // 使用市場數據 CSE
        );
        
        // 解析搜尋結果，提取月營收數據
        const revenue = parseRevenueFromCSE(ticker, searchResults);
        if (revenue) {
          revenueData[ticker] = revenue;
        }
      } catch (error) {
        Logger.log(`P5 Monthly：收集 ${ticker} 月營收失敗：${error.message}`);
      }
    }
    
    Logger.log(`P5 Monthly：成功收集 ${Object.keys(revenueData).length} 檔股票的月營收數據`);
    
    return revenueData;
  } catch (error) {
    Logger.log(`P5 Monthly：收集月度營收數據失敗：${error.message}`);
    return {};
  }
}

/**
 * 從 CSE 搜尋結果解析月營收數據
 * 
 * @param {string} ticker - 股票代碼
 * @param {Array} searchResults - CSE 搜尋結果
 * @returns {Object|null} revenue - 月營收數據
 */
function parseRevenueFromCSE(ticker, searchResults) {
  try {
    if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
      return null;
    }
    
    // 從搜尋結果中提取月營收數據
    // 嘗試從標題和摘要中提取數字
    for (const result of searchResults) {
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 檢查是否包含月營收相關關鍵字
      const hasRevenueKeywords = /月營收|月營|營收|revenue/i.test(title + snippet);
      if (!hasRevenueKeywords) {
        continue;
      }
      
      // 嘗試提取數字（可能是營收金額）
      // 格式可能是：月營收 XXX 億元、營收 XXX 萬、revenue XXX million 等
      const revenueMatch = (title + snippet).match(/(\d+(?:\.\d+)?)\s*(?:億|萬|million|billion|M|B)/i);
      if (revenueMatch) {
        const revenueValue = parseFloat(revenueMatch[1]);
        const unit = revenueMatch[0].toLowerCase();
        
        // 轉換為統一單位（億元）
        let revenueInBillions = revenueValue;
        if (unit.includes("萬") || unit.includes("million") || unit.includes("m")) {
          revenueInBillions = revenueValue / 10000; // 萬轉億
        } else if (unit.includes("billion") || unit.includes("b")) {
          revenueInBillions = revenueValue; // 已經是億
        }
        
        // 嘗試提取年月
        const dateMatch = (title + snippet).match(/(\d{4})[年\-/](\d{1,2})[月\-/]/);
        let year = new Date().getFullYear();
        let month = new Date().getMonth() + 1;
        if (dateMatch) {
          year = parseInt(dateMatch[1]);
          month = parseInt(dateMatch[2]);
        }
        
        // 嘗試提取 YoY 和 MoM 變化
        const yoyMatch = (title + snippet).match(/年增[率]?[：:]?\s*([+-]?\d+(?:\.\d+)?)%?/i);
        const momMatch = (title + snippet).match(/月增[率]?[：:]?\s*([+-]?\d+(?:\.\d+)?)%?/i);
        
        const revenue = {
          ticker: ticker,
          date: `${year}-${String(month).padStart(2, '0')}-01`,
          revenue: revenueInBillions,
          revenue_yoy_pct: yoyMatch ? parseFloat(yoyMatch[1]) : null,
          revenue_mom_pct: momMatch ? parseFloat(momMatch[1]) : null,
          source: link,
          source_title: title,
          source_snippet: snippet,
          parsed_at: new Date().toISOString()
        };
        
        Logger.log(`P5 Monthly：成功解析 ${ticker} 月營收：${revenueInBillions} 億元`);
        return revenue;
      }
    }
    
    Logger.log(`P5 Monthly：無法從搜尋結果中解析 ${ticker} 月營收`);
    return null;
  } catch (error) {
    Logger.log(`P5 Monthly：解析 ${ticker} 月營收失敗：${error.message}`);
    return null;
  }
}

/**
 * 統整四週 Weekly 結論
 * 
 * @returns {Object} integration - 四週 Weekly 統整結果
 */
function integrateFourWeeksWeekly() {
  try {
    Logger.log("P5 Monthly：開始統整四週 Weekly 結論");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__WEEKLY_SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Monthly：無 Weekly 快照數據");
      return {
        weekly_count: 0,
        weekly_snapshots: [],
        trend_changes: [],
        key_events: []
      };
    }
    
    const today = new Date();
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const createdAtCol = headers.indexOf("created_at");
    const marketAnalysisCol = headers.indexOf("market_analysis_json");
    const actionListCol = headers.indexOf("action_list_json");
    
    if (createdAtCol === -1) {
      return {};
    }
    
    const weeklySnapshots = [];
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][createdAtCol]);
      if (rowDate >= monthAgo && rowDate <= today) {
        try {
          const marketAnalysis = rows[i][marketAnalysisCol] ? JSON.parse(rows[i][marketAnalysisCol]) : {};
          const actionList = rows[i][actionListCol] ? JSON.parse(rows[i][actionListCol]) : [];
          
          weeklySnapshots.push({
            date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
            market_analysis: marketAnalysis,
            action_list: actionList
          });
        } catch (e) {
          Logger.log(`P5 Monthly：解析 Weekly 快照失敗：${e.message}`);
        }
      }
    }
    
    // 識別週間趨勢變化
    const trendChanges = identifyWeeklyTrendChanges(weeklySnapshots);
    
    Logger.log(`P5 Monthly：統整完成，找到 ${weeklySnapshots.length} 個 Weekly 快照`);
    
    return {
      weekly_count: weeklySnapshots.length,
      weekly_snapshots: weeklySnapshots,
      trend_changes: trendChanges,
      key_events: extractKeyEventsFromWeekly(weeklySnapshots)
    };
    
  } catch (error) {
    Logger.log(`P5 Monthly：統整四週 Weekly 結論失敗：${error.message}`);
    return {};
  }
}

/**
 * 識別週間趨勢變化
 * 
 * @param {Array} weeklySnapshots - Weekly 快照列表
 * @returns {Array} trendChanges - 趨勢變化列表
 */
function identifyWeeklyTrendChanges(weeklySnapshots) {
  const trendChanges = [];
  
  for (let i = 1; i < weeklySnapshots.length; i++) {
    const prevWeek = weeklySnapshots[i - 1];
    const currentWeek = weeklySnapshots[i];
    
    const prevStatus = prevWeek.market_analysis?.overall_status || "UNKNOWN";
    const currentStatus = currentWeek.market_analysis?.overall_status || "UNKNOWN";
    
    if (prevStatus !== currentStatus) {
      trendChanges.push({
        date: currentWeek.date,
        from: prevStatus,
        to: currentStatus,
        change_type: "STATUS_CHANGE"
      });
    }
  }
  
  return trendChanges;
}

/**
 * 從 Weekly 快照中提取關鍵事件
 * 
 * @param {Array} weeklySnapshots - Weekly 快照列表
 * @returns {Array} keyEvents - 關鍵事件列表
 */
function extractKeyEventsFromWeekly(weeklySnapshots) {
  const keyEvents = [];
  
  for (const snapshot of weeklySnapshots) {
    const actionList = snapshot.action_list || [];
    for (const action of actionList) {
      if (action.priority === "HIGH" || action.priority === "CRITICAL") {
        keyEvents.push({
          date: snapshot.date,
          action: action
        });
      }
    }
  }
  
  return keyEvents;
}

/**
 * 分析歷史事件連結（前 N 個月）
 * 
 * @param {number} months - 回溯月數（預設 3）
 * @returns {Object} historicalEvents - 歷史事件分析結果
 */
function analyzeHistoricalEvents(months = 3) {
  try {
    Logger.log(`P5 Monthly：分析前 ${months} 個月的歷史事件連結`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__MONTHLY_SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Monthly：無歷史 Monthly 快照");
      return {
        months_analyzed: 0,
        historical_snapshots: [],
        event_links: [],
        long_term_trends: []
      };
    }
    
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - months, today.getDate());
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getDataRange().getValues();
    const headers = rows[0];
    
    const createdAtCol = headers.indexOf("created_at");
    const monthlyTrendCol = headers.indexOf("monthly_trend_analysis_json");
    
    if (createdAtCol === -1) {
      return {};
    }
    
    const historicalSnapshots = [];
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][createdAtCol]);
      if (rowDate >= startDate && rowDate < today) {
        try {
          const monthlyTrend = rows[i][monthlyTrendCol] ? JSON.parse(rows[i][monthlyTrendCol]) : {};
          historicalSnapshots.push({
            date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
            monthly_trend: monthlyTrend
          });
        } catch (e) {
          Logger.log(`P5 Monthly：解析歷史快照失敗：${e.message}`);
        }
      }
    }
    
    // 分析事件連結
    const eventLinks = analyzeEventLinks(historicalSnapshots);
    
    // 分析長期趨勢
    const longTermTrends = analyzeLongTermTrends(historicalSnapshots);
    
    Logger.log(`P5 Monthly：歷史事件分析完成，找到 ${historicalSnapshots.length} 個歷史快照`);
    
    return {
      months_analyzed: months,
      historical_snapshots: historicalSnapshots,
      event_links: eventLinks,
      long_term_trends: longTermTrends
    };
    
  } catch (error) {
    Logger.log(`P5 Monthly：分析歷史事件連結失敗：${error.message}`);
    return {};
  }
}

/**
 * 分析事件連結
 * 
 * @param {Array} historicalSnapshots - 歷史快照列表
 * @returns {Array} eventLinks - 事件連結列表
 */
function analyzeEventLinks(historicalSnapshots) {
  // 簡化實現：識別跨月事件連結
  // 實際應該由 AI 分析
  return [];
}

/**
 * 分析長期趨勢
 * 
 * @param {Array} historicalSnapshots - 歷史快照列表
 * @returns {Array} longTermTrends - 長期趨勢列表
 */
function analyzeLongTermTrends(historicalSnapshots) {
  // 簡化實現：識別長期趨勢
  // 實際應該由 AI 分析
  return [];
}

// ==========================================
// 學習機制（AI 模型驅動）⭐ V8.0 新增
// ==========================================

/**
 * 收集前三個月歷史快照（Weekly 策略 + 實際結果）
 * 
 * @returns {Object} historicalSnapshots - 歷史快照數據
 */
function collectThreeMonthsHistoricalSnapshots() {
  try {
    Logger.log("P5 Monthly：開始收集前三個月歷史快照");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const weeklySnapshotSheet = ss.getSheetByName("P5__WEEKLY_SNAPSHOT");
    const stockStrategiesSheet = ss.getSheetByName("P5__WEEKLY_STOCK_STRATEGIES");
    const ohlcvSheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!weeklySnapshotSheet || weeklySnapshotSheet.getLastRow() <= 1) {
      Logger.log("P5 Monthly：無歷史 Weekly 快照數據");
      return { weekly_snapshots: [], stock_strategies: [], actual_results: [] };
    }
    
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    // 讀取前三個月的 Weekly 快照
    const weeklySnapshots = [];
    const weeklySnapshotData = weeklySnapshotSheet.getDataRange().getValues();
    const weeklySnapshotHeaders = weeklySnapshotData[0];
    
    const snapshotIdCol = weeklySnapshotHeaders.indexOf("snapshot_id");
    const createdAtCol = weeklySnapshotHeaders.indexOf("created_at");
    const stockStrategiesCol = weeklySnapshotHeaders.indexOf("stock_strategies_json");
    
    for (let i = 1; i < weeklySnapshotData.length; i++) {
      const createdAt = new Date(weeklySnapshotData[i][createdAtCol]);
      if (createdAt >= threeMonthsAgo && createdAt <= today) {
        try {
          const stockStrategiesJson = weeklySnapshotData[i][stockStrategiesCol];
          const stockStrategies = stockStrategiesJson ? JSON.parse(stockStrategiesJson) : {};
          
          weeklySnapshots.push({
            snapshot_id: weeklySnapshotData[i][snapshotIdCol],
            created_at: createdAt,
            stock_strategies: stockStrategies
          });
        } catch (error) {
          Logger.log(`P5 Monthly：解析快照 ${weeklySnapshotData[i][snapshotIdCol]} 失敗：${error.message}`);
        }
      }
    }
    
    // 讀取前三個月的個股策略
    const stockStrategies = [];
    if (stockStrategiesSheet && stockStrategiesSheet.getLastRow() > 1) {
      const stockStrategiesData = stockStrategiesSheet.getDataRange().getValues();
      const stockStrategiesHeaders = stockStrategiesData[0];
      
      const dateCol = stockStrategiesHeaders.indexOf("date");
      const tickerCol = stockStrategiesHeaders.indexOf("ticker");
      const strategyCol = stockStrategiesHeaders.indexOf("strategy");
      const actionCol = stockStrategiesHeaders.indexOf("action");
      const targetAllocationCol = stockStrategiesHeaders.indexOf("target_allocation");
      
      for (let i = 1; i < stockStrategiesData.length; i++) {
        const strategyDate = new Date(stockStrategiesData[i][dateCol]);
        if (strategyDate >= threeMonthsAgo && strategyDate <= today) {
          stockStrategies.push({
            date: strategyDate,
            ticker: stockStrategiesData[i][tickerCol],
            strategy: stockStrategiesData[i][strategyCol],
            action: stockStrategiesData[i][actionCol],
            target_allocation: stockStrategiesData[i][targetAllocationCol]
          });
        }
      }
    }
    
    // 收集實際結果（股價變化）
    const actualResults = [];
    if (ohlcvSheet && ohlcvSheet.getLastRow() > 1) {
      const ohlcvData = ohlcvSheet.getDataRange().getValues();
      const ohlcvHeaders = ohlcvData[0];
      
      const dateCol = ohlcvHeaders.indexOf("date");
      const tickerCol = ohlcvHeaders.indexOf("ticker");
      const closeCol = ohlcvHeaders.indexOf("close");
      
      // 為每個策略找到對應的實際股價變化
      for (const strategy of stockStrategies) {
        const strategyDate = strategy.date;
        const ticker = strategy.ticker;
        
        // 找到策略日期和今天的價格
        let priceAtStrategy = null;
        let priceToday = null;
        
        for (let i = ohlcvData.length - 1; i >= 1; i--) {
          const rowDate = new Date(ohlcvData[i][dateCol]);
          const rowTicker = ohlcvData[i][tickerCol];
          
          if (rowTicker === ticker) {
            if (!priceToday && rowDate <= today) {
              priceToday = parseFloat(ohlcvData[i][closeCol]) || null;
            }
            if (!priceAtStrategy && rowDate <= strategyDate) {
              priceAtStrategy = parseFloat(ohlcvData[i][closeCol]) || null;
            }
            if (priceToday && priceAtStrategy) {
              break;
            }
          }
        }
        
        if (priceAtStrategy && priceToday) {
          const priceChange = priceToday - priceAtStrategy;
          const priceChangePct = ((priceToday - priceAtStrategy) / priceAtStrategy) * 100;
          
          actualResults.push({
            ticker: ticker,
            strategy_date: strategyDate,
            price_at_strategy: priceAtStrategy,
            price_today: priceToday,
            price_change: priceChange,
            price_change_pct: priceChangePct,
            strategy: strategy.strategy,
            action: strategy.action
          });
        }
      }
    }
    
    Logger.log(`P5 Monthly：收集到 ${weeklySnapshots.length} 個 Weekly 快照，${stockStrategies.length} 個策略，${actualResults.length} 個實際結果`);
    
    return {
      weekly_snapshots: weeklySnapshots,
      stock_strategies: stockStrategies,
      actual_results: actualResults,
      period: {
        start: threeMonthsAgo,
        end: today
      }
    };
    
  } catch (error) {
    Logger.log(`P5 Monthly：收集歷史快照失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
    return { weekly_snapshots: [], stock_strategies: [], actual_results: [] };
  }
}

/**
 * AI 模型分析預測 vs 實際偏移度 ⭐ V8.0 新增
 * 
 * @param {Object} historicalSnapshots - 歷史快照數據
 * @returns {Object} learningAnalysis - 學習分析結果
 */
function analyzeLearningWithAI(historicalSnapshots) {
  try {
    Logger.log("P5 Monthly：開始 AI 模型分析預測 vs 實際偏移度");
    
    // ========================================
    // Step 1: 構建學習分析 Prompt
    // ========================================
    
    const learningPrompt = buildLearningAnalysisPrompt(historicalSnapshots);
    
    // ========================================
    // Step 2: 使用雙模型交叉驗證
    // ========================================
    
    // 模型 1：Claude Sonnet 4.5
    const sonnetJobId = submitP5ToM0JobQueue("P5_MONTHLY_LEARNING", ["SONNET"], {
      phase: "P5_MONTHLY_LEARNING",
      prompt: learningPrompt,
      historical_snapshots: historicalSnapshots,
      analysis_type: "LEARNING_ANALYSIS"
    });
    
    // 模型 2：GPT-5.2
    const gptJobId = submitP5ToM0JobQueue("P5_MONTHLY_LEARNING", ["GPT"], {
      phase: "P5_MONTHLY_LEARNING",
      prompt: learningPrompt,
      historical_snapshots: historicalSnapshots,
      analysis_type: "LEARNING_ANALYSIS"
    });
    
    // 等待兩個模型完成（簡化實現：實際應該異步處理）
    Logger.log("P5 Monthly：等待 Sonnet 和 GPT 模型完成學習分析...");
    
    // TODO: 實現異步等待機制
    // 目前簡化為同步等待（實際應該使用異步機制）
    let sonnetResult = null;
    let gptResult = null;
    
    // 簡化實現：嘗試讀取結果（實際應該等待 M0 Job 完成）
    try {
      sonnetResult = getM0JobResult(sonnetJobId);
    } catch (error) {
      Logger.log(`P5 Monthly：獲取 Sonnet 結果失敗：${error.message}`);
    }
    
    try {
      gptResult = getM0JobResult(gptJobId);
    } catch (error) {
      Logger.log(`P5 Monthly：獲取 GPT 結果失敗：${error.message}`);
    }
    
    // 如果無法獲取結果，使用程式化邏輯生成基本分析
    if (!sonnetResult || !gptResult) {
      Logger.log("P5 Monthly：AI 模型結果不可用，使用程式化邏輯生成基本分析");
      return generateProgrammaticLearningAnalysis(historicalSnapshots);
    }
    
    // ========================================
    // Step 3: 交叉驗證兩個模型的結果
    // ========================================
    
    const crossValidation = crossValidateLearningResults(sonnetResult, gptResult);
    
    // ========================================
    // Step 4: 生成最終學習分析結果
    // ========================================
    
    const learningAnalysis = {
      sonnet_analysis: sonnetResult?.output || null,
      gpt_analysis: gptResult?.output || null,
      cross_validation: crossValidation,
      final_recommendations: generateFinalLearningRecommendations(crossValidation),
      timestamp: new Date()
    };
    
    Logger.log("P5 Monthly：AI 模型學習分析完成");
    
    return learningAnalysis;
    
  } catch (error) {
    Logger.log(`P5 Monthly：AI 模型學習分析失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
    return {
      error: error.message,
      timestamp: new Date()
    };
  }
}

/**
 * 構建學習分析 Prompt
 * 
 * @param {Object} historicalSnapshots - 歷史快照數據
 * @returns {string} prompt - AI Prompt
 */
function buildLearningAnalysisPrompt(historicalSnapshots) {
  return `
你是一位資深的市場分析師和機器學習專家，負責進行 Nuclear Project 的 P5 Monthly 動態學習分析。

## 任務目標

基於前三個月的歷史快照（Weekly 策略 + 實際結果），進行全面的學習分析：
1. **預測 vs 實際偏移度分析**：分析每個策略的預測與實際結果的偏差
2. **方向偏差分析**：判斷預測方向（看多/看空）是否正確
3. **幅度偏差分析**：判斷預測幅度是否準確
4. **時機偏差分析**：判斷預測時機是否準確
5. **權重調整建議**：根據分析結果，建議調整各因子的權重
6. **閾值調整建議**：根據分析結果，建議調整各判斷閾值
7. **模式識別**：識別成功的策略模式和失敗的策略模式

## 歷史快照數據（前三個月）

### Weekly 快照
${JSON.stringify(historicalSnapshots.weekly_snapshots || [], null, 2)}

### 個股策略
${JSON.stringify(historicalSnapshots.stock_strategies || [], null, 2)}

### 實際結果（股價變化）
${JSON.stringify(historicalSnapshots.actual_results || [], null, 2)}

## 分析要求

1. **預測 vs 實際偏移度**：
   - 對於每個策略，計算預測與實際結果的偏差
   - 識別偏差的類型（方向偏差、幅度偏差、時機偏差）
   - 評估偏差的嚴重程度

2. **權重調整**：
   - 分析哪些因子（worldview, event, technical, fundamental, institutional, smart_money）表現良好
   - 分析哪些因子表現不佳
   - 建議調整各因子的權重

3. **閾值調整**：
   - 分析哪些判斷閾值需要調整（例如：加碼/減碼的評分閾值）
   - 建議新的閾值

4. **模式識別**：
   - 識別成功的策略模式（例如：在特定市場狀態下，某些因子組合表現良好）
   - 識別失敗的策略模式（例如：在特定市場狀態下，某些因子組合表現不佳）

## 輸出格式（必須是 JSON）

{
  "prediction_vs_actual_analysis": {
    "total_strategies": 0,
    "aligned_strategies": 0,
    "misaligned_strategies": 0,
    "direction_accuracy": 0.0-1.0,
    "magnitude_accuracy": 0.0-1.0,
    "timing_accuracy": 0.0-1.0,
    "detailed_deviations": [
      {
        "ticker": "TICKER",
        "strategy_date": "2025-01-01",
        "predicted_action": "INCREASE/DECREASE/HOLD",
        "actual_result": "PRICE_CHANGE_PCT",
        "deviation_type": "DIRECTION/MAGNITUDE/TIMING",
        "deviation_severity": "LOW/MEDIUM/HIGH",
        "analysis": "偏差分析說明"
      }
    ]
  },
  "weight_adjustments": {
    "worldview": {
      "current_weight": 0.25,
      "recommended_weight": 0.30,
      "reason": "調整理由"
    },
    "event": {
      "current_weight": 0.15,
      "recommended_weight": 0.12,
      "reason": "調整理由"
    },
    "technical": {
      "current_weight": 0.20,
      "recommended_weight": 0.22,
      "reason": "調整理由"
    },
    "fundamental": {
      "current_weight": 0.15,
      "recommended_weight": 0.15,
      "reason": "調整理由"
    },
    "institutional": {
      "current_weight": 0.10,
      "recommended_weight": 0.10,
      "reason": "調整理由"
    },
    "smart_money": {
      "current_weight": 0.15,
      "recommended_weight": 0.11,
      "reason": "調整理由"
    }
  },
  "threshold_adjustments": {
    "increase_threshold": {
      "current": 0.3,
      "recommended": 0.35,
      "reason": "調整理由"
    },
    "decrease_threshold": {
      "current": -0.3,
      "recommended": -0.25,
      "reason": "調整理由"
    }
  },
  "pattern_recognition": {
    "successful_patterns": [
      {
        "pattern_description": "模式描述",
        "market_conditions": "市場條件",
        "factor_combination": ["factor1", "factor2"],
        "success_rate": 0.0-1.0
      }
    ],
    "failed_patterns": [
      {
        "pattern_description": "模式描述",
        "market_conditions": "市場條件",
        "factor_combination": ["factor1", "factor2"],
        "failure_rate": 0.0-1.0
      }
    ]
  },
  "key_insights": [
    "關鍵洞察 1",
    "關鍵洞察 2"
  ],
  "confidence_level": 0.0-1.0
}
`;
}

/**
 * 交叉驗證兩個模型的學習結果
 * 
 * @param {Object} sonnetResult - Sonnet 分析結果
 * @param {Object} gptResult - GPT 分析結果
 * @returns {Object} crossValidation - 交叉驗證結果
 */
function crossValidateLearningResults(sonnetResult, gptResult) {
  try {
    Logger.log("P5 Monthly：開始交叉驗證兩個模型的學習結果");
    
    const crossValidation = {
      agreement_score: 0.0,  // 0-1，1 為完全一致
      agreed_recommendations: [],
      disagreed_recommendations: [],
      final_consensus: {}
    };
    
    if (!sonnetResult || !sonnetResult.output) {
      Logger.log("P5 Monthly：Sonnet 結果不可用，跳過交叉驗證");
      return crossValidation;
    }
    
    if (!gptResult || !gptResult.output) {
      Logger.log("P5 Monthly：GPT 結果不可用，跳過交叉驗證");
      return crossValidation;
    }
    
    const sonnetAnalysis = typeof sonnetResult.output === 'string' ? JSON.parse(sonnetResult.output) : sonnetResult.output;
    const gptAnalysis = typeof gptResult.output === 'string' ? JSON.parse(gptResult.output) : gptResult.output;
    
    // 比較權重調整建議
    const sonnetWeights = sonnetAnalysis.weight_adjustments || {};
    const gptWeights = gptAnalysis.weight_adjustments || {};
    
    let agreedWeights = 0;
    let totalWeights = 0;
    
    for (const factor in sonnetWeights) {
      if (gptWeights[factor]) {
        totalWeights++;
        const sonnetWeight = sonnetWeights[factor].recommended_weight || sonnetWeights[factor].current_weight;
        const gptWeight = gptWeights[factor].recommended_weight || gptWeights[factor].current_weight;
        
        // 如果權重差異小於 0.05，視為一致
        if (Math.abs(sonnetWeight - gptWeight) < 0.05) {
          agreedWeights++;
          crossValidation.agreed_recommendations.push({
            type: "weight_adjustment",
            factor: factor,
            recommended_weight: (sonnetWeight + gptWeight) / 2,
            sonnet_reason: sonnetWeights[factor].reason,
            gpt_reason: gptWeights[factor].reason
          });
        } else {
          crossValidation.disagreed_recommendations.push({
            type: "weight_adjustment",
            factor: factor,
            sonnet_recommended: sonnetWeight,
            gpt_recommended: gptWeight,
            sonnet_reason: sonnetWeights[factor].reason,
            gpt_reason: gptWeights[factor].reason
          });
        }
      }
    }
    
    // 計算一致性分數
    if (totalWeights > 0) {
      crossValidation.agreement_score = agreedWeights / totalWeights;
    }
    
    // 生成最終共識（取兩個模型的平均值或優先級較高的建議）
    crossValidation.final_consensus = generateFinalConsensus(sonnetAnalysis, gptAnalysis);
    
    Logger.log(`P5 Monthly：交叉驗證完成（一致性：${(crossValidation.agreement_score * 100).toFixed(1)}%）`);
    
    return crossValidation;
    
  } catch (error) {
    Logger.log(`P5 Monthly：交叉驗證失敗：${error.message}`);
    return {
      agreement_score: 0.0,
      agreed_recommendations: [],
      disagreed_recommendations: [],
      final_consensus: {},
      error: error.message
    };
  }
}

/**
 * 生成最終共識（基於兩個模型的結果）
 * 
 * @param {Object} sonnetAnalysis - Sonnet 分析結果
 * @param {Object} gptAnalysis - GPT 分析結果
 * @returns {Object} finalConsensus - 最終共識
 */
function generateFinalConsensus(sonnetAnalysis, gptAnalysis) {
  try {
    const finalConsensus = {
      weight_adjustments: {},
      threshold_adjustments: {},
      pattern_recognition: {
        successful_patterns: [],
        failed_patterns: []
      },
      key_insights: []
    };
    
    // 權重調整：取平均值（如果兩個模型都建議）
    const sonnetWeights = sonnetAnalysis.weight_adjustments || {};
    const gptWeights = gptAnalysis.weight_adjustments || {};
    
    for (const factor in sonnetWeights) {
      if (gptWeights[factor]) {
        const sonnetWeight = sonnetWeights[factor].recommended_weight || sonnetWeights[factor].current_weight;
        const gptWeight = gptWeights[factor].recommended_weight || gptWeights[factor].current_weight;
        
        finalConsensus.weight_adjustments[factor] = {
          current_weight: sonnetWeights[factor].current_weight || gptWeights[factor].current_weight,
          recommended_weight: (sonnetWeight + gptWeight) / 2,
          reason: `Sonnet: ${sonnetWeights[factor].reason || ""} | GPT: ${gptWeights[factor].reason || ""}`
        };
      } else {
        // 只有 Sonnet 建議，使用 Sonnet 的建議
        finalConsensus.weight_adjustments[factor] = sonnetWeights[factor];
      }
    }
    
    // 閾值調整：取平均值
    const sonnetThresholds = sonnetAnalysis.threshold_adjustments || {};
    const gptThresholds = gptAnalysis.threshold_adjustments || {};
    
    for (const threshold in sonnetThresholds) {
      if (gptThresholds[threshold]) {
        const sonnetValue = sonnetThresholds[threshold].recommended || sonnetThresholds[threshold].current;
        const gptValue = gptThresholds[threshold].recommended || gptThresholds[threshold].current;
        
        finalConsensus.threshold_adjustments[threshold] = {
          current: sonnetThresholds[threshold].current || gptThresholds[threshold].current,
          recommended: (sonnetValue + gptValue) / 2,
          reason: `Sonnet: ${sonnetThresholds[threshold].reason || ""} | GPT: ${gptThresholds[threshold].reason || ""}`
        };
      } else {
        finalConsensus.threshold_adjustments[threshold] = sonnetThresholds[threshold];
      }
    }
    
    // 模式識別：合併兩個模型的結果
    const sonnetPatterns = sonnetAnalysis.pattern_recognition || {};
    const gptPatterns = gptAnalysis.pattern_recognition || {};
    
    finalConsensus.pattern_recognition.successful_patterns = [
      ...(sonnetPatterns.successful_patterns || []),
      ...(gptPatterns.successful_patterns || [])
    ];
    
    finalConsensus.pattern_recognition.failed_patterns = [
      ...(sonnetPatterns.failed_patterns || []),
      ...(gptPatterns.failed_patterns || [])
    ];
    
    // 關鍵洞察：合併兩個模型的洞察
    finalConsensus.key_insights = [
      ...(sonnetAnalysis.key_insights || []),
      ...(gptAnalysis.key_insights || [])
    ];
    
    return finalConsensus;
    
  } catch (error) {
    Logger.log(`P5 Monthly：生成最終共識失敗：${error.message}`);
    return {};
  }
}

/**
 * 生成最終學習建議
 * 
 * @param {Object} crossValidation - 交叉驗證結果
 * @returns {Object} finalRecommendations - 最終建議
 */
function generateFinalLearningRecommendations(crossValidation) {
  try {
    const finalRecommendations = {
      weight_adjustments: crossValidation.final_consensus.weight_adjustments || {},
      threshold_adjustments: crossValidation.final_consensus.threshold_adjustments || {},
      pattern_recognition: crossValidation.final_consensus.pattern_recognition || {},
      confidence: crossValidation.agreement_score || 0.5,
      implementation_priority: []
    };
    
    // 根據一致性分數決定實施優先級
    if (crossValidation.agreement_score >= 0.8) {
      finalRecommendations.implementation_priority.push("HIGH");
    } else if (crossValidation.agreement_score >= 0.6) {
      finalRecommendations.implementation_priority.push("MEDIUM");
    } else {
      finalRecommendations.implementation_priority.push("LOW");
    }
    
    return finalRecommendations;
    
  } catch (error) {
    Logger.log(`P5 Monthly：生成最終學習建議失敗：${error.message}`);
    return {};
  }
}

function buildP5MonthlyPrompt(data) {
  const {
    monthlyData = {},
    revenueData = {},
    weeklyIntegration = {},
    historicalEvents = {}
  } = data;
  
  return `
你是一位資深的市場分析師，負責進行 Nuclear Project 的 P5 Monthly 月度分析。

## 任務目標

基於月度市場數據、月營收數據、四週 Weekly 統整和歷史事件連結，進行全面的月度分析：
1. **月度趨勢分析**：用更大的時間幅度來看待一個月以來的世界觀與策略對現實事件與市場的對照關係
2. **時間維度學習**：按月的時間維度來學習分析事件與市場的連結性（例如：一個突發消息利空，在當天是跳空下跌，但一整週最後卻是拉漲，但用一個月來看還是下跌）
3. **持倉表現評估**：評估持倉在月度時間維度下的表現
4. **策略調整建議**：基於月度分析提出策略調整建議
5. **歷史事件連結**：分析當月與前三個月的事件連結，回溯更長時間的歷史，對於長期市場動態較為宏觀

## 月度市場數據

${JSON.stringify(monthlyData, null, 2)}

## 月營收數據（台灣股票）

${JSON.stringify(revenueData, null, 2)}

## 四週 Weekly 統整

${JSON.stringify(weeklyIntegration, null, 2)}

## 歷史事件連結（前三個月）

${JSON.stringify(historicalEvents, null, 2)}

## 輸出格式（必須是 JSON）

{
  "monthly_trend_analysis": {
    "overall_status": "BULL/BEAR/TRANSITION",
    "monthly_worldview": "月度世界觀描述",
    "market_reaction_alignment": {
      "alignment_status": "ALIGNED/MISALIGNED/NEUTRAL",
      "time_dimension_analysis": "時間維度分析（日/週/月視角對照）",
      "key_insights": ["洞察1", "洞察2"]
    }
  },
  "revenue_analysis": {
    "taiwan_stocks_revenue_summary": {},
    "revenue_changes": [],
    "revenue_impact_analysis": "營收變化對策略的影響分析"
  },
  "weekly_integration_analysis": {
    "four_weeks_summary": "四週統整摘要",
    "trend_changes_identified": [],
    "key_events_timeline": []
  },
  "historical_event_links": {
    "cross_month_events": [],
    "long_term_trends": [],
    "macro_perspective": "宏觀視角分析"
  },
  "portfolio_performance": {
    "monthly_performance": {},
    "vs_weekly_expectations": "與週間預期的對照"
  },
  "strategy_adjustments": [
    {
      "adjustment": "調整描述",
      "reason": "調整理由",
      "time_dimension_rationale": "時間維度理由"
    }
  ]
}
`;
}

function generateP5MonthlyOutput(enhancedAnalysis, auditorOutput) {
  return {
    monthly_trend_analysis: enhancedAnalysis.monthly_trend_analysis || {},
    portfolio_performance: enhancedAnalysis.portfolio_performance || {},
    strategy_adjustments: enhancedAnalysis.strategy_adjustments || [],
    institutional_insights: enhancedAnalysis.institutional_insights || {},
    auditor_review: auditorOutput.audit_review || null,
    timestamp: new Date().toISOString()
  };
}
