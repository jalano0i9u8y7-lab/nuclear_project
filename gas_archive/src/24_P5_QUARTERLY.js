/**
 * 📊 P5 Quarterly: 季度分析（擴展版）⭐ V8.0 增強
 * 
 * 每季進行市場分析：
 * - 季度回顧
 * - 策略檢討
 * - 下季度展望
 * 
 * ⭐ V7.1 新增功能：
 * - 季財報追蹤（台灣 + 美國股票）
 * - 基本面變化判斷（觸發 P2-P4 重跑）
 * - 產業面與趨勢面變化判斷（觸發 P0-P5 重跑）
 * - 新興產業識別
 * - 市場熱度板塊識別
 * 
 * ⭐ V8.0 新增功能：
 * - 持倉整合邏輯（A/B/C 分類，Phase_Out 策略）
 * - 每季重跑一次 P0，產生新清單
 * - 整合現有持倉與新清單，分類處理
 * 
 * 執行頻率：每季 1 次
 * 執行者：Claude Sonnet 4.5
 * 審查者：GPT-5.1
 * 
 * @version SSOT V8.0
 * @date 2025-01-14
 */

// ==========================================
// P5 Quarterly 核心執行函數
// ==========================================

/**
 * P5 Quarterly 主執行函數
 * 
 * @param {Object} params - 執行參數
 * @param {string} params.trigger - 觸發來源（QUARTERLY / MANUAL）
 * @returns {Object} result - 執行結果
 */
function P5_Quarterly_Execute(params) {
  try {
    Logger.log(`P5 Quarterly 執行開始：trigger=${params.trigger}`);
    
    // Step 1: 檢查決策權限
    const context = {
      defcon: getCurrentDEFCON(),
      p4_6_triggered: false
    };
    
    if (!checkP5DecisionHierarchy("QUARTERLY", context)) {
      Logger.log("P5 Quarterly：決策權限檢查未通過，執行受限");
      return {
        status: "RESTRICTED",
        reason: "決策權限檢查未通過"
      };
    }
    
    // Step 2: 每季重跑一次 P0，產生新清單 ⭐ V8.0 新增
    Logger.log("P5 Quarterly：開始重跑 P0，產生新清單");
    const p0Result = P0_Execute({
      trigger: "P5_QUARTERLY",
      reason: "季度重置：每季重跑一次 P0",
      context: params.context || {}
    });
    
    // 等待 P0 完成（如果返回 SUBMITTED，需要等待）
    if (p0Result && p0Result.status === "SUBMITTED") {
      Logger.log(`P5 Quarterly：P0 已提交到 M0 Job Queue，等待完成...`);
      // TODO: 實現等待機制
    }
    
    // 觸發 P0.7 和 P1（產生新的 master candidates）
    Logger.log("P5 Quarterly：觸發 P0.7 和 P1，產生新的 master candidates");
    const p0_7Result = P0_7_Execute({
      trigger: "P5_QUARTERLY",
      reason: "季度重置：P0 完成後觸發 P0.7",
      context: params.context || {}
    });
    
    const p1Result = P1_Execute({
      trigger: "P5_QUARTERLY",
      reason: "季度重置：P0.7 完成後觸發 P1",
      context: params.context || {}
    });
    
    // Step 3: 持倉整合邏輯 ⭐ V8.0 新增
    Logger.log("P5 Quarterly：開始持倉整合邏輯");
    const holdingsIntegration = integrateHoldingsWithNewList({
      existing_holdings: getHoldingsTickers(),
      new_master_candidates: getNewMasterCandidatesFromP1()
    });
    
    // Step 3.5: ⭐ V8.13 新增：比對上一季的策略與市場真實反應（動態學習系統核心）
    Logger.log("P5 Quarterly V8.13：開始比對上一季的策略與市場真實反應");
    let previousQuarterStrategyComparison = null;
    try {
      // ⭐ V8.13修正：移除V7設計的錯誤方向，使用現有版本
      previousQuarterStrategyComparison = compareStrategyWithReality(1, "QUARTER");
      
      if (previousQuarterStrategyComparison && previousQuarterStrategyComparison.strategies_compared > 0) {
        Logger.log(`P5 Quarterly V8.13：策略比對完成 - 對齊率：${((previousQuarterStrategyComparison.performance_summary?.alignment_rate || 0) * 100).toFixed(1)}%，對齊：${previousQuarterStrategyComparison.aligned_strategies?.length || 0}，未對齊：${previousQuarterStrategyComparison.misaligned_strategies?.length || 0}`);
        
        // 保存比對結果到學習日誌（作為前一季的策略比對紀錄）
        saveStrategyComparisonToLearningLog(previousQuarterStrategyComparison, "QUARTERLY");
      } else {
        Logger.log("P5 Quarterly V8.13：無上一季的策略數據可對照（可能是首次執行）");
      }
    } catch (error) {
      Logger.log(`P5 Quarterly V8.13：策略比對失敗：${error.message}（不中斷主流程）`);
      // 不中斷主流程，只記錄錯誤
    }
    
    // Step 4: 收集所有季度數據
    Logger.log("P5 Quarterly：開始收集所有季度數據");
    const quarterlyData = collectP5QuarterlyAllData();
    
    // Step 5: 季財報追蹤（台灣 + 美國股票）
    Logger.log("P5 Quarterly：開始季財報追蹤");
    const earningsData = collectQuarterlyEarningsData();
    
    // Step 6: 基本面變化判斷
    Logger.log("P5 Quarterly：判斷基本面變化");
    const fundamentalChanges = detectFundamentalChanges(earningsData);
    
    // Step 7: 產業面與趨勢面變化判斷
    Logger.log("P5 Quarterly：判斷產業面與趨勢面變化");
    const industryTrendChanges = detectIndustryTrendChanges(quarterlyData);
    
    // Step 8: 準備 M0 Job
    const m0InputPayload = {
      phase: "P5_QUARTERLY",
      frequency: "QUARTERLY",
      trigger: params.trigger,
      holdings_integration: holdingsIntegration,  // ⭐ V8.0 新增：持倉整合結果
      quarterly_market_data: quarterlyData,
      earnings_data: earningsData,
      fundamental_changes: fundamentalChanges,
      industry_trend_changes: industryTrendChanges,
      institutional_data: collectInstitutionalDataQuarterly(),
      context: params.context || {}
    };
    
    // Step 9: 構建 M0 流程
    const requestedFlow = ["SONNET", "GPT"];
    m0InputPayload.p5_quarterly_prompt = buildP5QuarterlyPrompt({
      holdingsIntegration: holdingsIntegration,  // ⭐ V8.0 新增
      quarterlyData: quarterlyData,
      earningsData: earningsData,
      fundamentalChanges: fundamentalChanges,
      industryTrendChanges: industryTrendChanges
    });
    
    // Step 10: 提交到 M0 Job Queue
    const jobId_final = submitP5ToM0JobQueue("P5_QUARTERLY", requestedFlow, m0InputPayload);
    
    return {
      status: "SUBMITTED",
      job_id: jobId_final,
      frequency: "QUARTERLY"
    };
    
  } catch (error) {
    Logger.log(`P5 Quarterly 執行失敗：${error.message}`);
    throw error;
  }
}

/**
 * 處理 P5 Quarterly M0 執行結果
 * 
 * @param {string} jobId - Job ID
 * @param {Object} m0Result - M0 執行結果
 * @returns {Object} result - 處理結果
 */
function P5_Quarterly_ProcessM0Result(jobId, m0Result) {
  try {
    Logger.log(`P5 Quarterly 處理 M0 結果：jobId=${jobId}`);
    
    const executorOutput = m0Result.executor_output || {};
    const auditorOutput = m0Result.auditor_output || {};
    
    // 整合機構級視角
    const enhancedAnalysis = integrateInstitutionalPerspectiveP5(executorOutput, m0Result.institutional_data || {});
    
    // 生成 P5 Quarterly 輸出
    const p5QuarterlyOutput = generateP5QuarterlyOutput(enhancedAnalysis, auditorOutput);
    
    // 保存快照
    const snapshot = saveP5QuarterlySnapshot({
      p2_snapshot_id: m0Result.p2_snapshot?.snapshot_id || null,
      p3_snapshot_id: m0Result.p3_snapshot?.snapshot_id || null,
      p4_snapshot_id: m0Result.p4_snapshot?.snapshot_id || null,
      quarterly_review: p5QuarterlyOutput.quarterly_review,
      strategy_review: p5QuarterlyOutput.strategy_review,
      next_quarter_outlook: p5QuarterlyOutput.next_quarter_outlook,
      institutional_insights: p5QuarterlyOutput.institutional_insights,
      phase_triggers: p5QuarterlyOutput.phase_triggers || []  // Phase 重跑觸發列表
    });
    
    // Step 9: 執行持倉整合後的 P2-P4 重跑 ⭐ V8.0 新增
    if (m0Result.holdings_integration) {
      Logger.log("P5 Quarterly：開始執行持倉整合後的 P2-P4 重跑");
      executeHoldingsIntegrationP2P4(m0Result.holdings_integration);
    }
    
    // Step 10: 執行 Phase 重跑觸發
    if (p5QuarterlyOutput.phase_triggers && p5QuarterlyOutput.phase_triggers.length > 0) {
      Logger.log(`P5 Quarterly：開始執行 ${p5QuarterlyOutput.phase_triggers.length} 個 Phase 重跑觸發`);
      executePhaseTriggers(p5QuarterlyOutput.phase_triggers);
    }
    
    return {
      status: "COMPLETED",
      snapshot_id: snapshot.snapshot_id,
      p5_quarterly_output: p5QuarterlyOutput,
      holdings_integration: m0Result.holdings_integration || null,  // ⭐ V8.0 新增
      phase_triggers_executed: p5QuarterlyOutput.phase_triggers?.length || 0
    };
    
  } catch (error) {
    Logger.log(`P5 Quarterly 處理 M0 結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 數據收集與 Prompt 構建
// ==========================================

/**
 * 收集季度市場數據
 * 
 * @returns {Object} quarterlyData - 季度市場數據
 */
function collectQuarterlyMarketData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const today = new Date();
    const quarterAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
    
    // 從 MARKET_OHLCV_DAILY 讀取季度數據
    const ohlcvSheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    const quarterlyData = {
      ohlcv_summary: {},
      portfolio_performance: {},
      strategy_performance: {}
    };
    
    // 收集 OHLCV 季度摘要
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
          if (rowDate >= quarterAgo && rowDate <= today) {
            const ticker = ohlcvRows[i][tickerCol];
            if (!tickerData[ticker]) {
              tickerData[ticker] = {
                quarter_start_price: null,
                quarter_end_price: null,
                quarter_high: null,
                quarter_low: null
              };
            }
            
            const close = parseFloat(ohlcvRows[i][closeCol]);
            if (!tickerData[ticker].quarter_start_price || rowDate < new Date(tickerData[ticker].quarter_start_date)) {
              tickerData[ticker].quarter_start_price = close;
              tickerData[ticker].quarter_start_date = rowDate;
            }
            if (!tickerData[ticker].quarter_end_price || rowDate > new Date(tickerData[ticker].quarter_end_date)) {
              tickerData[ticker].quarter_end_price = close;
              tickerData[ticker].quarter_end_date = rowDate;
            }
          }
        }
        
        // 計算季度變動
        for (const ticker in tickerData) {
          if (tickerData[ticker].quarter_start_price && tickerData[ticker].quarter_end_price) {
            tickerData[ticker].quarter_change = tickerData[ticker].quarter_end_price - tickerData[ticker].quarter_start_price;
            tickerData[ticker].quarter_change_pct = (tickerData[ticker].quarter_change / tickerData[ticker].quarter_start_price) * 100;
          }
        }
        
        quarterlyData.ohlcv_summary = tickerData;
      }
    }
    
    return quarterlyData;
  } catch (error) {
    Logger.log(`收集季度市場數據失敗：${error.message}`);
    return {};
  }
}

/**
 * 收集季度機構數據
 * 
 * @returns {Object} institutionalData - 季度機構數據
 */
function collectInstitutionalDataQuarterly() {
  // TODO: 收集季度機構數據（13F、Dark Pool、Options Flow、Insider Trading）
  return {
    f13f: null,
    dark_pool: null,
    options_flow: null,
    insider_trading: null
  };
}

/**
 * 收集 P5 Quarterly 所需的所有數據
 * 
 * @returns {Object} allData - 所有季度數據
 */
function collectP5QuarterlyAllData() {
  try {
    const quarterlyMarketData = collectQuarterlyMarketData();
    const quarterlyWorldview = collectQuarterlyWorldview();
    const quarterlyLearningLog = collectQuarterlyLearningLog();
    const quarterlyMonthlySnapshots = collectQuarterlyMonthlySnapshots();
    const quarterlyWeeklySnapshots = collectQuarterlyWeeklySnapshots();
    
    return {
      market_data: quarterlyMarketData,
      worldview: quarterlyWorldview,
      learning_log: quarterlyLearningLog,
      monthly_snapshots: quarterlyMonthlySnapshots,
      weekly_snapshots: quarterlyWeeklySnapshots
    };
  } catch (error) {
    Logger.log(`P5 Quarterly：收集所有數據失敗：${error.message}`);
    return {};
  }
}

/**
 * 收集季度世界觀更新
 * 
 * @returns {Array} worldviewUpdates - 季度世界觀更新列表
 */
function collectQuarterlyWorldview() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("WORLDVIEW_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const today = new Date();
    const quarterAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
    
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
      if (rowDate >= quarterAgo && rowDate <= today) {
        try {
          const worldview = rows[i][worldviewCol] ? JSON.parse(rows[i][worldviewCol]) : {};
          worldviewUpdates.push({
            date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
            worldview: worldview
          });
        } catch (e) {
          Logger.log(`P5 Quarterly：解析世界觀更新失敗：${e.message}`);
        }
      }
    }
    
    return worldviewUpdates;
  } catch (error) {
    Logger.log(`P5 Quarterly：收集季度世界觀失敗：${error.message}`);
    return [];
  }
}

/**
 * 收集季度學習日誌
 * 
 * @returns {Array} learningLogs - 季度學習日誌列表
 */
function collectQuarterlyLearningLog() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__LEARNING_LOG");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const today = new Date();
    const quarterAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    
    if (dateCol === -1) {
      return [];
    }
    
    const learningLogs = [];
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= quarterAgo && rowDate <= today) {
        learningLogs.push({
          date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
          row: rows[i]
        });
      }
    }
    
    return learningLogs;
  } catch (error) {
    Logger.log(`P5 Quarterly：收集季度學習日誌失敗：${error.message}`);
    return [];
  }
}

/**
 * 收集季度 Monthly 快照
 * 
 * @returns {Array} monthlySnapshots - 季度 Monthly 快照列表
 */
function collectQuarterlyMonthlySnapshots() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__MONTHLY_SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const today = new Date();
    const quarterAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const createdAtCol = headers.indexOf("created_at");
    
    if (createdAtCol === -1) {
      return [];
    }
    
    const monthlySnapshots = [];
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][createdAtCol]);
      if (rowDate >= quarterAgo && rowDate <= today) {
        monthlySnapshots.push({
          date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
          row: rows[i]
        });
      }
    }
    
    return monthlySnapshots;
  } catch (error) {
    Logger.log(`P5 Quarterly：收集季度 Monthly 快照失敗：${error.message}`);
    return [];
  }
}

/**
 * 收集季度 Weekly 快照
 * 
 * @returns {Array} weeklySnapshots - 季度 Weekly 快照列表
 */
function collectQuarterlyWeeklySnapshots() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__WEEKLY_SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const today = new Date();
    const quarterAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const createdAtCol = headers.indexOf("created_at");
    
    if (createdAtCol === -1) {
      return [];
    }
    
    const weeklySnapshots = [];
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][createdAtCol]);
      if (rowDate >= quarterAgo && rowDate <= today) {
        weeklySnapshots.push({
          date: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
          row: rows[i]
        });
      }
    }
    
    return weeklySnapshots;
  } catch (error) {
    Logger.log(`P5 Quarterly：收集季度 Weekly 快照失敗：${error.message}`);
    return [];
  }
}

/**
 * 收集季度財報數據（台灣 + 美國股票）
 * 
 * @returns {Object} earningsData - 季度財報數據
 */
function collectQuarterlyEarningsData() {
  try {
    Logger.log("P5 Quarterly：開始收集季度財報數據");
    
    const tickers = getHoldingsTickers();
    
    Logger.log(`P5 Quarterly：找到 ${tickers.length} 檔股票需要追蹤季財報`);
    
    const earningsData = {
      taiwan_stocks: {},
      us_stocks: {}
    };
    
    // 分類股票
    const taiwanTickers = tickers.filter(ticker => isTaiwanStock(ticker));
    const usTickers = tickers.filter(ticker => !isTaiwanStock(ticker));
    
    // 收集台灣股票季財報
    for (const ticker of taiwanTickers) {
      try {
        const earnings = collectTaiwanStockEarnings(ticker);
        if (earnings) {
          earningsData.taiwan_stocks[ticker] = earnings;
        }
      } catch (error) {
        Logger.log(`P5 Quarterly：收集 ${ticker} 季財報失敗：${error.message}`);
      }
    }
    
    // 收集美國股票季財報
    for (const ticker of usTickers) {
      try {
        const earnings = collectUSStockEarnings(ticker);
        if (earnings) {
          earningsData.us_stocks[ticker] = earnings;
        }
      } catch (error) {
        Logger.log(`P5 Quarterly：收集 ${ticker} 季財報失敗：${error.message}`);
      }
    }
    
    Logger.log(`P5 Quarterly：成功收集 ${Object.keys(earningsData.taiwan_stocks).length} 檔台灣股票和 ${Object.keys(earningsData.us_stocks).length} 檔美國股票的季財報數據`);
    
    return earningsData;
  } catch (error) {
    Logger.log(`P5 Quarterly：收集季度財報數據失敗：${error.message}`);
    return {
      taiwan_stocks: {},
      us_stocks: {}
    };
  }
}

/**
 * 收集台灣股票季財報
 * 
 * @param {string} ticker - 股票代碼
 * @returns {Object|null} earnings - 季財報數據
 */
function collectTaiwanStockEarnings(ticker) {
  // TODO: 從 TWSE/TPEX 或 CSE 收集季財報
  // 簡化實現：使用 CSE 搜尋
  try {
    const searchResults = executeCSESearch(
      `台灣股票 ${ticker} 季財報 2024`,
      "P5_MARKET"
    );
    
    // 解析搜尋結果，提取季財報數據
    return parseEarningsFromCSE(ticker, searchResults);
  } catch (error) {
    Logger.log(`P5 Quarterly：收集台灣股票 ${ticker} 季財報失敗：${error.message}`);
    return null;
  }
}

/**
 * 收集美國股票季財報
 * 
 * @param {string} ticker - 股票代碼
 * @returns {Object|null} earnings - 季財報數據
 */
function collectUSStockEarnings(ticker) {
  // TODO: 從 SEC EDGAR 或 CSE 收集季財報
  // 簡化實現：使用 CSE 搜尋
  try {
    const searchResults = executeCSESearch(
      `${ticker} quarterly earnings 10-Q SEC`,
      "P5_MARKET"
    );
    
    // 解析搜尋結果，提取季財報數據
    return parseEarningsFromCSE(ticker, searchResults);
  } catch (error) {
    Logger.log(`P5 Quarterly：收集美國股票 ${ticker} 季財報失敗：${error.message}`);
    return null;
  }
}

/**
 * 從 CSE 搜尋結果解析季財報數據
 * 
 * @param {string} ticker - 股票代碼
 * @param {Array} searchResults - CSE 搜尋結果
 * @returns {Object|null} earnings - 季財報數據
 */
function parseEarningsFromCSE(ticker, searchResults) {
  try {
    if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
      return null;
    }
    
    // 從搜尋結果中提取季財報數據
    // 嘗試從標題和摘要中提取 EPS、營收等數據
    for (const result of searchResults) {
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 檢查是否包含季財報相關關鍵字
      const hasEarningsKeywords = /季財報|季報|earnings|10-Q|EPS|每股盈餘/i.test(title + snippet);
      if (!hasEarningsKeywords) {
        continue;
      }
      
      // 嘗試提取 EPS
      const epsMatch = (title + snippet).match(/EPS[：:]?\s*([+-]?\d+(?:\.\d+)?)|每股盈餘[：:]?\s*([+-]?\d+(?:\.\d+)?)/i);
      let eps = null;
      if (epsMatch) {
        eps = parseFloat(epsMatch[1] || epsMatch[2]);
      }
      
      // 嘗試提取營收（revenue）
      const revenueMatch = (title + snippet).match(/營收[：:]?\s*(\d+(?:\.\d+)?)\s*(?:億|萬|million|billion|M|B)|revenue[：:]?\s*(\d+(?:\.\d+)?)\s*(?:million|billion|M|B)/i);
      let revenue = null;
      if (revenueMatch) {
        const revenueValue = parseFloat(revenueMatch[1] || revenueMatch[2]);
        const unit = revenueMatch[0].toLowerCase();
        
        // 轉換為統一單位（億元）
        let revenueInBillions = revenueValue;
        if (unit.includes("萬") || unit.includes("million") || unit.includes("m")) {
          revenueInBillions = revenueValue / 10000; // 萬轉億
        } else if (unit.includes("billion") || unit.includes("b")) {
          revenueInBillions = revenueValue; // 已經是億
        }
        revenue = revenueInBillions;
      }
      
      // 嘗試提取季度
      const quarterMatch = (title + snippet).match(/Q([1-4])|第([1-4])季|([1-4])Q/i);
      let quarter = null;
      if (quarterMatch) {
        quarter = parseInt(quarterMatch[1] || quarterMatch[2] || quarterMatch[3]);
      }
      
      // 嘗試提取年份
      const yearMatch = (title + snippet).match(/(\d{4})/);
      let year = new Date().getFullYear();
      if (yearMatch) {
        const matchedYear = parseInt(yearMatch[1]);
        if (matchedYear >= 2020 && matchedYear <= 2030) {
          year = matchedYear;
        }
      }
      
      // 嘗試提取 YoY 變化
      const epsYoyMatch = (title + snippet).match(/EPS.*年增[率]?[：:]?\s*([+-]?\d+(?:\.\d+)?)%?/i);
      const revenueYoyMatch = (title + snippet).match(/營收.*年增[率]?[：:]?\s*([+-]?\d+(?:\.\d+)?)%?/i);
      
      // 如果至少提取到 EPS 或營收，則返回結果
      if (eps !== null || revenue !== null) {
        const earnings = {
          ticker: ticker,
          date: quarter ? `${year}-Q${quarter}` : `${year}-Q${Math.floor((new Date().getMonth() + 1) / 3)}`,
          eps: eps,
          revenue: revenue,
          eps_yoy_pct: epsYoyMatch ? parseFloat(epsYoyMatch[1]) : null,
          revenue_yoy_pct: revenueYoyMatch ? parseFloat(revenueYoyMatch[1]) : null,
          quarter: quarter || Math.floor((new Date().getMonth() + 1) / 3),
          year: year,
          source: link,
          source_title: title,
          source_snippet: snippet,
          parsed_at: new Date().toISOString()
        };
        
        Logger.log(`P5 Quarterly：成功解析 ${ticker} 季財報：EPS=${eps}, Revenue=${revenue}`);
        return earnings;
      }
    }
    
    Logger.log(`P5 Quarterly：無法從搜尋結果中解析 ${ticker} 季財報`);
    return null;
  } catch (error) {
    Logger.log(`P5 Quarterly：解析 ${ticker} 季財報失敗：${error.message}`);
    return null;
  }
}

/**
 * 檢測基本面變化
 * 
 * @param {Object} earningsData - 季財報數據
 * @returns {Object} changes - 基本面變化檢測結果
 */
function detectFundamentalChanges(earningsData) {
  try {
    Logger.log("P5 Quarterly：開始檢測基本面變化");
    
    const changes = {
      stocks_need_p2_rerun: [],
      stocks_need_p3_rerun: [],
      stocks_need_p4_rerun: [],
      change_severity: {}
    };
    
    // 合併所有股票
    const allStocks = {
      ...earningsData.taiwan_stocks,
      ...earningsData.us_stocks
    };
    
    // 對每檔股票進行基本面變化檢測
    for (const ticker in allStocks) {
      const earnings = allStocks[ticker];
      
      // 簡化實現：檢查關鍵財務指標變化
      // 實際應該由 AI 分析
      const changeScore = calculateFundamentalChangeScore(ticker, earnings);
      
      if (changeScore > 0.3) {
        // 基本面有顯著變化，需要重跑 P2-P4
        changes.stocks_need_p2_rerun.push(ticker);
        changes.stocks_need_p3_rerun.push(ticker);
        changes.stocks_need_p4_rerun.push(ticker);
        changes.change_severity[ticker] = changeScore;
      }
    }
    
    Logger.log(`P5 Quarterly：檢測到 ${changes.stocks_need_p2_rerun.length} 檔股票需要重跑 P2-P4`);
    
    return changes;
  } catch (error) {
    Logger.log(`P5 Quarterly：檢測基本面變化失敗：${error.message}`);
    return {
      stocks_need_p2_rerun: [],
      stocks_need_p3_rerun: [],
      stocks_need_p4_rerun: [],
      change_severity: {}
    };
  }
}

/**
 * 計算基本面變化評分
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} earnings - 季財報數據
 * @returns {number} score - 變化評分（0-1）
 */
/**
 * 計算基本面變化評分（使用 AI 分析）
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} earnings - 季財報數據
 * @param {Object} previousEarnings - 上一季財報數據（可選）
 * @returns {number} changeScore - 變化評分（0-1）
 */
function calculateFundamentalChangeScore(ticker, earnings, previousEarnings = null) {
  try {
    // 如果沒有足夠的數據，返回 0
    if (!earnings || (!earnings.eps && !earnings.revenue)) {
      return 0;
    }
    
    // 程式化評分（快速評估）
    let programmaticScore = 0;
    
    // EPS 變化評分
    if (earnings.eps_yoy_pct !== null && earnings.eps_yoy_pct !== undefined) {
      const epsChange = Math.abs(earnings.eps_yoy_pct);
      if (epsChange > 50) {
        programmaticScore += 0.4; // 大幅變化
      } else if (epsChange > 20) {
        programmaticScore += 0.2; // 中等變化
      } else if (epsChange > 10) {
        programmaticScore += 0.1; // 小幅變化
      }
    }
    
    // 營收變化評分
    if (earnings.revenue_yoy_pct !== null && earnings.revenue_yoy_pct !== undefined) {
      const revenueChange = Math.abs(earnings.revenue_yoy_pct);
      if (revenueChange > 30) {
        programmaticScore += 0.3; // 大幅變化
      } else if (revenueChange > 15) {
        programmaticScore += 0.15; // 中等變化
      } else if (revenueChange > 5) {
        programmaticScore += 0.05; // 小幅變化
      }
    }
    
    // 與上一季比較（如果有）
    if (previousEarnings) {
      if (earnings.eps !== null && previousEarnings.eps !== null) {
        const epsChange = Math.abs((earnings.eps - previousEarnings.eps) / previousEarnings.eps) * 100;
        if (epsChange > 20) {
          programmaticScore += 0.2;
        }
      }
      if (earnings.revenue !== null && previousEarnings.revenue !== null) {
        const revenueChange = Math.abs((earnings.revenue - previousEarnings.revenue) / previousEarnings.revenue) * 100;
        if (revenueChange > 15) {
          programmaticScore += 0.15;
        }
      }
    }
    
    // 限制在 0-1 範圍
    return Math.min(1, programmaticScore);
  } catch (error) {
    Logger.log(`計算 ${ticker} 基本面變化評分失敗：${error.message}`);
    return 0;
  }
}

/**
 * 檢測產業面與趨勢面變化
 * 
 * @param {Object} quarterlyData - 季度數據
 * @returns {Object} changes - 產業面與趨勢面變化檢測結果
 */
function detectIndustryTrendChanges(quarterlyData) {
  try {
    Logger.log("P5 Quarterly：開始檢測產業面與趨勢面變化");
    
    const changes = {
      industry_trends_changed: [],
      emerging_industries: [],
      hot_sectors: [],
      needs_p0_rerun: false,
      needs_p0_7_rerun: false,
      needs_p1_rerun: false,
      needs_p5_rerun: false
    };
    
    // 從季度世界觀中提取產業趨勢
    const worldview = quarterlyData.worldview || [];
    
    // 簡化實現：基本檢測邏輯
    // 實際應該由 AI 分析季度世界觀，識別產業面與趨勢面變化
    
    // 檢查是否有新興產業
    const emergingIndustries = identifyEmergingIndustries(worldview);
    if (emergingIndustries.length > 0) {
      changes.emerging_industries = emergingIndustries;
      changes.needs_p0_rerun = true;  // 產業面變化，需要重跑 P0
      changes.needs_p0_7_rerun = true;  // 趨勢面變化，需要重跑 P0.7
      changes.needs_p1_rerun = true;  // 公司池需要更新，需要重跑 P1
    }
    
    // 檢查是否有市場熱度板塊
    const hotSectors = identifyHotSectors(worldview);
    if (hotSectors.length > 0) {
      changes.hot_sectors = hotSectors;
      changes.needs_p0_rerun = true;
      changes.needs_p1_rerun = true;
    }
    
    Logger.log(`P5 Quarterly：檢測到 ${changes.emerging_industries.length} 個新興產業和 ${changes.hot_sectors.length} 個熱度板塊`);
    
    return changes;
  } catch (error) {
    Logger.log(`P5 Quarterly：檢測產業面與趨勢面變化失敗：${error.message}`);
    return {
      industry_trends_changed: [],
      emerging_industries: [],
      hot_sectors: [],
      needs_p0_rerun: false,
      needs_p0_7_rerun: false,
      needs_p1_rerun: false,
      needs_p5_rerun: false
    };
  }
}

/**
 * 識別新興產業（使用 AI 分析）
 * 
 * @param {Array} worldview - 世界觀更新列表
 * @returns {Array} emergingIndustries - 新興產業列表
 */
function identifyEmergingIndustries(worldview) {
  try {
    if (!worldview || worldview.length === 0) {
      return [];
    }
    
    // 構建 AI 分析 Prompt
    const prompt = `
你是一位資深的產業分析師，負責識別新興產業。

## 任務目標

基於以下季度世界觀更新，識別出可能的新興產業：
1. 新興技術領域
2. 新興市場需求
3. 新興商業模式
4. 新興產業鏈

## 季度世界觀更新

${JSON.stringify(worldview.slice(-20), null, 2)}  // 只取最近 20 條

## 輸出格式（必須是 JSON）

{
  "emerging_industries": [
    {
      "industry_name": "產業名稱",
      "description": "產業描述",
      "key_technologies": ["技術1", "技術2"],
      "market_size": "市場規模描述",
      "growth_potential": "HIGH/MEDIUM/LOW",
      "confidence": 0.0-1.0,
      "evidence": ["證據1", "證據2"]
    }
  ]
}
`;
    
    // 提交到 M0 Job Queue（使用 SONNET 執行，GPT 審查）
    const m0InputPayload = {
      phase: "P5_QUARTERLY_EMERGING_INDUSTRIES",
      frequency: "QUARTERLY",
      prompt: prompt,
      context: {
        worldview_count: worldview.length
      }
    };
    
    const requestedFlow = ["SONNET", "GPT"];
    const jobId = submitP5ToM0JobQueue("P5_QUARTERLY_EMERGING_INDUSTRIES", requestedFlow, m0InputPayload);
    
    // 模擬同步執行（實際部署時 M0_Execute 會在背景運行）
    try {
      const m0Result = M0_Execute_Synchronous(jobId, requestedFlow, m0InputPayload);
      const executorOutput = m0Result.executor_output || {};
      
      if (executorOutput.emerging_industries && Array.isArray(executorOutput.emerging_industries)) {
        Logger.log(`P5 Quarterly：AI 識別出 ${executorOutput.emerging_industries.length} 個新興產業`);
        return executorOutput.emerging_industries;
      }
    } catch (error) {
      Logger.log(`P5 Quarterly：AI 識別新興產業失敗：${error.message}`);
    }
    
    // 如果 AI 分析失敗，返回空數組
    return [];
  } catch (error) {
    Logger.log(`P5 Quarterly：識別新興產業失敗：${error.message}`);
    return [];
  }
}

/**
 * 識別市場熱度板塊（使用 AI 分析）
 * 
 * @param {Array} worldview - 世界觀更新列表
 * @returns {Array} hotSectors - 熱度板塊列表
 */
function identifyHotSectors(worldview) {
  try {
    if (!worldview || worldview.length === 0) {
      return [];
    }
    
    // 構建 AI 分析 Prompt
    const prompt = `
你是一位資深的市場分析師，負責識別市場熱度板塊。

## 任務目標

基於以下季度世界觀更新，識別出市場熱度板塊：
1. 資金流入明顯的板塊
2. 新聞關注度高的板塊
3. 價格表現強勁的板塊
4. 機構關注度高的板塊

## 季度世界觀更新

${JSON.stringify(worldview.slice(-20), null, 2)}  // 只取最近 20 條

## 輸出格式（必須是 JSON）

{
  "hot_sectors": [
    {
      "sector_name": "板塊名稱",
      "description": "板塊描述",
      "heat_score": 0.0-1.0,
      "key_drivers": ["驅動因素1", "驅動因素2"],
      "market_performance": "表現描述",
      "institutional_interest": "HIGH/MEDIUM/LOW",
      "confidence": 0.0-1.0,
      "evidence": ["證據1", "證據2"]
    }
  ]
}
`;
    
    // 提交到 M0 Job Queue（使用 SONNET 執行，GPT 審查）
    const m0InputPayload = {
      phase: "P5_QUARTERLY_HOT_SECTORS",
      frequency: "QUARTERLY",
      prompt: prompt,
      context: {
        worldview_count: worldview.length
      }
    };
    
    const requestedFlow = ["SONNET", "GPT"];
    const jobId = submitP5ToM0JobQueue("P5_QUARTERLY_HOT_SECTORS", requestedFlow, m0InputPayload);
    
    // 模擬同步執行（實際部署時 M0_Execute 會在背景運行）
    try {
      const m0Result = M0_Execute_Synchronous(jobId, requestedFlow, m0InputPayload);
      const executorOutput = m0Result.executor_output || {};
      
      if (executorOutput.hot_sectors && Array.isArray(executorOutput.hot_sectors)) {
        Logger.log(`P5 Quarterly：AI 識別出 ${executorOutput.hot_sectors.length} 個熱度板塊`);
        return executorOutput.hot_sectors;
      }
    } catch (error) {
      Logger.log(`P5 Quarterly：AI 識別熱度板塊失敗：${error.message}`);
    }
    
    // 如果 AI 分析失敗，返回空數組
    return [];
  } catch (error) {
    Logger.log(`P5 Quarterly：識別熱度板塊失敗：${error.message}`);
    return [];
  }
}

/**
 * 執行 Phase 重跑觸發
 * 
 * @param {Array} phaseTriggers - Phase 觸發列表
 */
function executePhaseTriggers(phaseTriggers) {
  try {
    Logger.log(`P5 Quarterly：開始執行 ${phaseTriggers.length} 個 Phase 重跑觸發`);
    
    for (const trigger of phaseTriggers) {
      try {
        const phase = trigger.phase;
        const reason = trigger.reason || "P5 Quarterly 檢測到變化";
        const parameters = trigger.parameters || {};
        
        Logger.log(`P5 Quarterly：觸發 ${phase} 重跑，原因：${reason}`);
        
        switch (phase) {
          case "P0":
            // 觸發 P0（產業工程學）
            try {
              const p0Result = P0_Execute({
                trigger: "P5_QUARTERLY",
                reason: reason,
                context: parameters.context || {}
              });
              Logger.log(`P5 Quarterly：P0 重跑完成，快照 ID：${p0Result.snapshot_id || "N/A"}`);
            } catch (error) {
              Logger.log(`P5 Quarterly：P0 重跑失敗：${error.message}`);
            }
            break;
            
          case "P0.7":
            // 觸發 P0.7（系統動力學）
            try {
              const p0_7Result = P0_7_Execute({
                trigger: "P5_QUARTERLY",
                reason: reason,
                context: parameters.context || {}
              });
              Logger.log(`P5 Quarterly：P0.7 重跑完成，快照 ID：${p0_7Result.snapshot_id || "N/A"}`);
            } catch (error) {
              Logger.log(`P5 Quarterly：P0.7 重跑失敗：${error.message}`);
            }
            break;
            
          case "P1":
            // 觸發 P1（公司池）
            try {
              const p1Result = P1_Execute({
                trigger: "P5_QUARTERLY",
                reason: reason,
                context: parameters.context || {}
              });
              Logger.log(`P5 Quarterly：P1 重跑完成，快照 ID：${p1Result.snapshot_id || "N/A"}`);
            } catch (error) {
              Logger.log(`P5 Quarterly：P1 重跑失敗：${error.message}`);
            }
            break;
            
          case "P2":
            // 觸發 P2（基本面分析）
            if (parameters.tickers && Array.isArray(parameters.tickers)) {
              for (const ticker of parameters.tickers) {
                try {
                  // 根據參數決定使用 Quarterly 還是 Monthly
                  const p2Function = parameters.use_monthly ? P2_Monthly_Execute : P2_Quarterly_Execute;
                  const p2Result = p2Function({
                    trigger: "P5_QUARTERLY",
                    ticker: ticker,
                    reason: reason,
                    context: parameters.context || {}
                  });
                  Logger.log(`P5 Quarterly：P2 重跑完成（${ticker}），快照 ID：${p2Result.snapshot_id || "N/A"}`);
                } catch (error) {
                  Logger.log(`P5 Quarterly：P2 重跑失敗（${ticker}）：${error.message}`);
                }
              }
            } else {
              // 如果沒有指定 tickers，則對所有持股進行分析
              try {
                const holdingsTickers = getHoldingsTickers();
                for (const ticker of holdingsTickers) {
                  try {
                    const p2Result = P2_Quarterly_Execute({
                      trigger: "P5_QUARTERLY",
                      ticker: ticker,
                      reason: reason,
                      context: parameters.context || {}
                    });
                    Logger.log(`P5 Quarterly：P2 重跑完成（${ticker}），快照 ID：${p2Result.snapshot_id || "N/A"}`);
                  } catch (error) {
                    Logger.log(`P5 Quarterly：P2 重跑失敗（${ticker}）：${error.message}`);
                  }
                }
              } catch (error) {
                Logger.log(`P5 Quarterly：P2 重跑失敗（獲取持股列表）：${error.message}`);
              }
            }
            break;
            
          case "P3":
            // 觸發 P3（技術分析）
            if (parameters.tickers && Array.isArray(parameters.tickers)) {
              for (const ticker of parameters.tickers) {
                try {
                  const p3Result = P3_Execute({
                    trigger: "P5_QUARTERLY",
                    ticker: ticker,
                    reason: reason,
                    context: parameters.context || {}
                  });
                  Logger.log(`P5 Quarterly：P3 重跑完成（${ticker}），快照 ID：${p3Result.snapshot_id || "N/A"}`);
                } catch (error) {
                  Logger.log(`P5 Quarterly：P3 重跑失敗（${ticker}）：${error.message}`);
                }
              }
            } else {
              // 如果沒有指定 tickers，則對所有持股進行分析
              try {
                const holdingsTickers = getHoldingsTickers();
                for (const ticker of holdingsTickers) {
                  try {
                    const p3Result = P3_Execute({
                      trigger: "P5_QUARTERLY",
                      ticker: ticker,
                      reason: reason,
                      context: parameters.context || {}
                    });
                    Logger.log(`P5 Quarterly：P3 重跑完成（${ticker}），快照 ID：${p3Result.snapshot_id || "N/A"}`);
                  } catch (error) {
                    Logger.log(`P5 Quarterly：P3 重跑失敗（${ticker}）：${error.message}`);
                  }
                }
              } catch (error) {
                Logger.log(`P5 Quarterly：P3 重跑失敗（獲取持股列表）：${error.message}`);
              }
            }
            break;
            
          case "P4":
            // 觸發 P4（資金配置）
            try {
              const p4Result = P4_Calculate({
                trigger: "P5_QUARTERLY",
                reason: reason,
                context: parameters.context || {}
              });
              Logger.log(`P5 Quarterly：P4 重跑完成，快照 ID：${p4Result.snapshot_id || "N/A"}`);
            } catch (error) {
              Logger.log(`P5 Quarterly：P4 重跑失敗：${error.message}`);
            }
            break;
            
          default:
            Logger.log(`P5 Quarterly：未知的 Phase：${phase}`);
        }
      } catch (error) {
        Logger.log(`P5 Quarterly：執行 Phase 觸發失敗（${trigger.phase}）：${error.message}`);
      }
    }
    
    Logger.log(`P5 Quarterly：Phase 重跑觸發執行完成`);
    
  } catch (error) {
    Logger.log(`P5 Quarterly：執行 Phase 重跑觸發失敗：${error.message}`);
  }
}

// ==========================================
// 持倉整合邏輯 ⭐ V8.0 新增
// ==========================================

/**
 * 整合現有持倉與新清單
 * 
 * @param {Object} params - 參數
 * @param {Array} params.existing_holdings - 現有持倉列表
 * @param {Array} params.new_master_candidates - 新 master candidates 列表（從 P1 獲取）
 * @returns {Object} integrationResult - 整合結果
 */
function integrateHoldingsWithNewList(params) {
  try {
    Logger.log(`P5 Quarterly：開始持倉整合（現有持倉：${params.existing_holdings.length}，新清單：${params.new_master_candidates.length}）`);
    
    const { existing_holdings = [], new_master_candidates = [] } = params;
    
    // ========================================
    // Step 1: 分類現有持倉
    // ========================================
    
    const categoryA = [];  // A_仍在新清單：繼續持有，重新跑 P2-P4
    const categoryB = [];  // B_不在新清單但 P2 基本面 OK：標記為 'Phase_Out'，逐步減倉
    const categoryC = [];  // C_不在新清單且 P2 基本面弱：立即清倉
    
    for (const ticker of existing_holdings) {
      const isInNewList = new_master_candidates.includes(ticker);
      
      if (isInNewList) {
        categoryA.push(ticker);
      } else {
        // 檢查 P2 基本面狀態
        const p2Status = checkP2FundamentalStatus(ticker);
        
        if (p2Status && p2Status.is_ok) {
          categoryB.push({
            ticker: ticker,
            p2_status: p2Status,
            phase_out_reason: "不在新清單但基本面 OK，標記為 Phase_Out"
          });
        } else {
          categoryC.push({
            ticker: ticker,
            p2_status: p2Status,
            clearance_reason: "不在新清單且基本面弱，立即清倉"
          });
        }
      }
    }
    
    // ========================================
    // Step 2: 為 Category B 制定 Phase_Out 策略
    // ========================================
    
    const phaseOutPlans = {};
    for (const item of categoryB) {
      phaseOutPlans[item.ticker] = createPhaseOutPlan(item.ticker, item.p2_status);
    }
    
    // ========================================
    // Step 3: 生成整合結果
    // ========================================
    
    const integrationResult = {
      category_a: {
        tickers: categoryA,
        action: "繼續持有，重新跑 P2-P4",
        count: categoryA.length
      },
      category_b: {
        tickers: categoryB.map(item => item.ticker),
        action: "Phase_Out（逐步減倉）",
        count: categoryB.length,
        phase_out_plans: phaseOutPlans
      },
      category_c: {
        tickers: categoryC.map(item => item.ticker),
        action: "立即清倉",
        count: categoryC.length
      },
      new_additions: {
        tickers: new_master_candidates.filter(t => !existing_holdings.includes(t)),
        action: "新增持倉，執行 P2-P4",
        count: new_master_candidates.filter(t => !existing_holdings.includes(t)).length
      },
      summary: {
        total_existing: existing_holdings.length,
        total_new_list: new_master_candidates.length,
        continue_holding: categoryA.length,
        phase_out: categoryB.length,
        immediate_clearance: categoryC.length,
        new_additions: new_master_candidates.filter(t => !existing_holdings.includes(t)).length
      }
    };
    
    Logger.log(`P5 Quarterly：持倉整合完成（A: ${categoryA.length}, B: ${categoryB.length}, C: ${categoryC.length}, 新增: ${integrationResult.new_additions.count}）`);
    
    return integrationResult;
    
  } catch (error) {
    Logger.log(`P5 Quarterly：持倉整合失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
    throw error;
  }
}

/**
 * 檢查 P2 基本面狀態
 * 
 * @param {string} ticker - 股票代碼
 * @returns {Object|null} p2Status - P2 基本面狀態
 */
function checkP2FundamentalStatus(ticker) {
  try {
    const p2Snapshot = getLatestP2Snapshot();
    
    if (!p2Snapshot || !p2Snapshot.tier_assignments) {
      return null;
    }
    
    const tierAssignments = p2Snapshot.tier_assignments;
    const stockData = tierAssignments[ticker];
    
    if (!stockData) {
      return null;
    }
    
    // 判斷基本面是否 OK（根據 tier 和 gate 狀態）
    const tier = stockData.tier || null;
    const gateStatus = stockData.gate_status || "UNKNOWN";
    
    // 如果 tier 為 CORE 或 STABLE_SWING，且 gate_status 為 PASS，視為 OK
    const isOK = (tier === "CORE" || tier === "STABLE_SWING") && gateStatus === "PASS";
    
    return {
      ticker: ticker,
      tier: tier,
      gate_status: gateStatus,
      is_ok: isOK,
      financial_metrics: stockData.financial_metrics || null
    };
    
  } catch (error) {
    Logger.log(`P5 Quarterly：檢查 ${ticker} P2 基本面狀態失敗：${error.message}`);
    return null;
  }
}

/**
 * 創建 Phase_Out 減倉計劃
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} p2Status - P2 基本面狀態
 * @returns {Object} phaseOutPlan - Phase_Out 計劃
 */
function createPhaseOutPlan(ticker, p2Status) {
  try {
    const phaseOutPlan = {
      ticker: ticker,
      status: "PHASE_OUT",
      start_date: new Date(),
      max_duration_weeks: 4,  // 最多保留 4 週
      
      // P3 Stop Loss 設嚴格（-5%）
      stop_loss: {
        enabled: true,
        percentage: -0.05,  // -5%
        strict: true
      },
      
      // P4 權重逐週遞減（-10%/週）
      weight_reduction: {
        weekly_reduction: 0.10,  // 每週減少 10%
        current_week: 0,
        target_weight: 0  // 最終目標為 0
      },
      
      // Weekly 如技術面破位 → 立即清倉
      technical_breakdown_trigger: {
        enabled: true,
        action: "IMMEDIATE_CLEARANCE"
      },
      
      // 監控條件
      monitoring_conditions: [
        "技術面破位",
        "P3 Stop Loss 觸發",
        "達到最大保留期限（4 週）"
      ]
    };
    
    return phaseOutPlan;
    
  } catch (error) {
    Logger.log(`P5 Quarterly：創建 ${ticker} Phase_Out 計劃失敗：${error.message}`);
    return null;
  }
}

/**
 * 獲取新 master candidates（從 P1 獲取）
 * 
 * @returns {Array} masterCandidates - Master candidates 列表
 */
function getNewMasterCandidatesFromP1() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Master_Candidates");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Quarterly：Phase1_Master_Candidates 表格不存在或為空");
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const companyCodeCol = headers.indexOf("Company_Code");
    
    if (companyCodeCol === -1) {
      Logger.log("P5 Quarterly：Phase1_Master_Candidates 表格格式錯誤");
      return [];
    }
    
    const masterCandidates = [];
    for (let i = 1; i < rows.length; i++) {
      const companyCode = rows[i][companyCodeCol];
      if (companyCode) {
        masterCandidates.push(companyCode);
      }
    }
    
    Logger.log(`P5 Quarterly：從 P1 獲取到 ${masterCandidates.length} 個 master candidates`);
    
    return masterCandidates;
    
  } catch (error) {
    Logger.log(`P5 Quarterly：獲取新 master candidates 失敗：${error.message}`);
    return [];
  }
}

/**
 * 執行持倉整合後的 P2-P4 重跑
 * 
 * @param {Object} holdingsIntegration - 持倉整合結果
 */
function executeHoldingsIntegrationP2P4(holdingsIntegration) {
  try {
    Logger.log("P5 Quarterly：開始執行持倉整合後的 P2-P4 重跑");
    
    // Category A：繼續持有，重新跑 P2-P4
    if (holdingsIntegration.category_a && holdingsIntegration.category_a.tickers.length > 0) {
      Logger.log(`P5 Quarterly：Category A - 重新跑 P2-P4（${holdingsIntegration.category_a.tickers.length} 檔）`);
      
      for (const ticker of holdingsIntegration.category_a.tickers) {
        try {
          // 重新跑 P2
          const p2Result = P2_Quarterly_Execute({
            trigger: "P5_QUARTERLY",
            ticker: ticker,
            reason: "Category A：繼續持有，重新分析",
            context: {}
          });
          
          // 重新跑 P2.5（如果需要的話）
          // TODO: 實現 P2.5 重跑
          
          // 重新跑 P3（等待 P2 和 P2.5 完成）
          // TODO: 實現 P3 重跑（需要等待 P2 和 P2.5）
          
          // 重新跑 P4（等待 P2 和 P3 完成）
          // TODO: 實現 P4 重跑（需要等待 P2 和 P3）
          
        } catch (error) {
          Logger.log(`P5 Quarterly：Category A ${ticker} 重跑失敗：${error.message}`);
        }
      }
    }
    
    // Category B：Phase_Out，設置特殊標記
    if (holdingsIntegration.category_b && holdingsIntegration.category_b.tickers.length > 0) {
      Logger.log(`P5 Quarterly：Category B - 設置 Phase_Out 標記（${holdingsIntegration.category_b.tickers.length} 檔）`);
      
      for (const ticker of holdingsIntegration.category_b.tickers) {
        try {
          // 保存 Phase_Out 計劃到表格
          savePhaseOutPlanToSheet(ticker, holdingsIntegration.category_b.phase_out_plans[ticker]);
          
          // 更新 HOLDINGS 表格，標記為 Phase_Out
          updateHoldingsPhaseOutStatus(ticker, "PHASE_OUT");
          
        } catch (error) {
          Logger.log(`P5 Quarterly：Category B ${ticker} 設置失敗：${error.message}`);
        }
      }
    }
    
    // Category C：立即清倉
    if (holdingsIntegration.category_c && holdingsIntegration.category_c.tickers.length > 0) {
      Logger.log(`P5 Quarterly：Category C - 立即清倉（${holdingsIntegration.category_c.tickers.length} 檔）`);
      
      for (const item of holdingsIntegration.category_c.tickers) {
        try {
          const ticker = typeof item === "string" ? item : item.ticker;
          
          // 更新 HOLDINGS 表格，標記為立即清倉
          updateHoldingsPhaseOutStatus(ticker, "IMMEDIATE_CLEARANCE");
          
          // 生成清倉通知
          generateClearanceNotification(ticker, "不在新清單且基本面弱");
          
        } catch (error) {
          Logger.log(`P5 Quarterly：Category C ${ticker} 清倉處理失敗：${error.message}`);
        }
      }
    }
    
    // 新增持倉：執行 P2-P4
    if (holdingsIntegration.new_additions && holdingsIntegration.new_additions.tickers.length > 0) {
      Logger.log(`P5 Quarterly：新增持倉 - 執行 P2-P4（${holdingsIntegration.new_additions.tickers.length} 檔）`);
      
      for (const ticker of holdingsIntegration.new_additions.tickers) {
        try {
          // 執行 P2-P4（新股票）
          // TODO: 實現新股票的 P2-P4 流程
          
        } catch (error) {
          Logger.log(`P5 Quarterly：新增持倉 ${ticker} 處理失敗：${error.message}`);
        }
      }
    }
    
    Logger.log("P5 Quarterly：持倉整合後的 P2-P4 重跑完成");
    
  } catch (error) {
    Logger.log(`P5 Quarterly：執行持倉整合後的 P2-P4 重跑失敗：${error.message}`);
  }
}

/**
 * 保存 Phase_Out 計劃到表格
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} phaseOutPlan - Phase_Out 計劃
 */
function savePhaseOutPlanToSheet(ticker, phaseOutPlan) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("PHASE_OUT_PLANS");  // ⭐ V8.0 新增表格
    
    if (!sheet) {
      sheet = ss.insertSheet("PHASE_OUT_PLANS");
      sheet.appendRow([
        "ticker",
        "status",
        "start_date",
        "max_duration_weeks",
        "stop_loss_json",
        "weight_reduction_json",
        "technical_breakdown_trigger_json",
        "current_week",
        "current_weight",
        "created_at",
        "updated_at"
      ]);
      sheet.setFrozenRows(1);
    }
    
    // 檢查是否已存在
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const tickerCol = rows[0].indexOf("ticker");
    
    let foundRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][tickerCol] === ticker) {
        foundRow = i + 1;
        break;
      }
    }
    
    const row = [
      ticker,
      phaseOutPlan.status,
      phaseOutPlan.start_date,
      phaseOutPlan.max_duration_weeks,
      JSON.stringify(phaseOutPlan.stop_loss),
      JSON.stringify(phaseOutPlan.weight_reduction),
      JSON.stringify(phaseOutPlan.technical_breakdown_trigger),
      phaseOutPlan.weight_reduction.current_week,
      0,  // current_weight（從 P4 獲取）
      new Date(),
      new Date()
    ];
    
    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    
    Logger.log(`P5 Quarterly：Phase_Out 計劃已保存（${ticker}）`);
    
  } catch (error) {
    Logger.log(`P5 Quarterly：保存 Phase_Out 計劃失敗：${error.message}`);
  }
}

/**
 * 更新 HOLDINGS 表格的 Phase_Out 狀態
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} status - 狀態（PHASE_OUT / IMMEDIATE_CLEARANCE）
 */
function updateHoldingsPhaseOutStatus(ticker, status) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("HOLDINGS");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Quarterly：HOLDINGS 表格不存在或為空");
      return;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const statusCol = headers.indexOf("status") || headers.indexOf("phase_out_status");
    
    if (tickerCol === -1) {
      Logger.log("P5 Quarterly：HOLDINGS 表格格式錯誤");
      return;
    }
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][tickerCol] === ticker) {
        if (statusCol !== -1) {
          sheet.getRange(i + 1, statusCol + 1).setValue(status);
        } else {
          // 如果沒有 status 欄位，在最後一列添加
          sheet.getRange(i + 1, headers.length + 1).setValue(status);
        }
        break;
      }
    }
    
    Logger.log(`P5 Quarterly：HOLDINGS 狀態已更新（${ticker}：${status}）`);
    
  } catch (error) {
    Logger.log(`P5 Quarterly：更新 HOLDINGS 狀態失敗：${error.message}`);
  }
}

/**
 * 生成清倉通知
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} reason - 清倉原因
 */
function generateClearanceNotification(ticker, reason) {
  try {
    Logger.log(`P5 Quarterly：生成清倉通知（${ticker}，原因：${reason}）`);
    
    // TODO: 實現通知機制（未來使用 GAS 原生 Line bot）
    // 目前僅記錄到日誌
    
  } catch (error) {
    Logger.log(`P5 Quarterly：生成清倉通知失敗：${error.message}`);
  }
}

function buildP5QuarterlyPrompt(data) {
  const {
    quarterlyData = {},
    earningsData = {},
    fundamentalChanges = {},
    industryTrendChanges = {}
  } = data;
  
  return `
你是一位資深的市場分析師，負責進行 Nuclear Project 的 P5 Quarterly 季度分析。

## 任務目標

基於季度市場數據、季財報數據、基本面變化檢測和產業面與趨勢面變化檢測，進行全面的季度分析：
1. **季度回顧**：回顧本季度的市場表現、策略執行情況
2. **策略檢討**：檢討本季度的策略效果，識別成功和失敗的案例
3. **下季度展望**：基於本季度分析，展望下季度的市場趨勢和策略方向
4. **基本面變化判斷**：從財報中判斷哪些股票基本面已經有變化，需要從 P2-P4 重新分析
5. **產業面與趨勢面變化判斷**：從一季的世界觀中判斷產業面跟趨勢面都已經有變化，需要重跑 P0-P5

## 季度市場數據

${JSON.stringify(quarterlyData, null, 2)}

## 季財報數據

${JSON.stringify(earningsData, null, 2)}

## 基本面變化檢測結果

${JSON.stringify(fundamentalChanges, null, 2)}

## 產業面與趨勢面變化檢測結果

${JSON.stringify(industryTrendChanges, null, 2)}

## 輸出格式（必須是 JSON）

{
  "quarterly_review": {
    "market_performance": "市場表現描述",
    "strategy_performance": "策略表現描述",
    "key_events": ["事件1", "事件2"]
  },
  "strategy_review": {
    "successful_strategies": [],
    "failed_strategies": [],
    "lessons_learned": []
  },
  "next_quarter_outlook": {
    "market_trends": "市場趨勢預測",
    "strategy_recommendations": []
  },
  "fundamental_changes_analysis": {
    "stocks_need_p2_rerun": ["TICKER1", "TICKER2"],
    "stocks_need_p3_rerun": ["TICKER1", "TICKER2"],
    "stocks_need_p4_rerun": ["TICKER1", "TICKER2"],
    "change_reasons": {
      "TICKER1": "變化原因描述"
    }
  },
  "industry_trend_changes_analysis": {
    "emerging_industries": ["產業1", "產業2"],
    "hot_sectors": ["板塊1", "板塊2"],
    "industry_trends_changed": true,
    "needs_p0_rerun": true,
    "needs_p0_7_rerun": true,
    "needs_p1_rerun": true,
    "needs_p5_rerun": false
  },
  "phase_triggers": [
    {
      "phase": "P0/P0.7/P1/P2/P3/P4",
      "reason": "觸發原因",
      "parameters": {
        "tickers": ["TICKER1", "TICKER2"]  // 如果是 P2/P3/P4，需要指定股票
      }
    }
  ]
}
`;
}

function generateP5QuarterlyOutput(enhancedAnalysis, auditorOutput) {
  return {
    quarterly_review: enhancedAnalysis.quarterly_review || {},
    strategy_review: enhancedAnalysis.strategy_review || {},
    next_quarter_outlook: enhancedAnalysis.next_quarter_outlook || {},
    fundamental_changes_analysis: enhancedAnalysis.fundamental_changes_analysis || {},
    industry_trend_changes_analysis: enhancedAnalysis.industry_trend_changes_analysis || {},
    phase_triggers: enhancedAnalysis.phase_triggers || [],
    institutional_insights: enhancedAnalysis.institutional_insights || {},
    auditor_review: auditorOutput.audit_review || null,
    timestamp: new Date().toISOString()
  };
}
