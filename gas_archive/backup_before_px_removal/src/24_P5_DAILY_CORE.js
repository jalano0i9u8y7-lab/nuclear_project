/**
 * 📊 P5 Daily: 核心執行函數
 * 
 * 主執行函數和流程控制
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

// ==========================================
// P5 Daily 核心執行函數
// ==========================================

/**
 * P5 Daily 主執行函數
 * 
 * @param {Object} params - 執行參數
 * @param {string} params.trigger - 觸發來源（DAILY / MANUAL）
 * @param {Array} params.tickers - 要收集的股票列表（可選，如果不提供則從持倉讀取）
 * @returns {Object} result - 執行結果
 */
function P5_Daily_Execute(params) {
  try {
    Logger.log(`P5 Daily 執行開始：trigger=${params.trigger}`);
    
    // Step 1: 檢查決策權限
    // 注意：P5 Daily 是數據收集，不涉及交易決策，應該允許執行
    // checkP5DecisionHierarchy 會自動處理 P5 Daily 的特殊情況
    const context = {
      defcon: getCurrentDEFCON(),
      p4_6_triggered: isP4_6Triggered()  // 從 P4.6 模組讀取觸發狀態
    };
    
    // P5 Daily 數據收集不受 DEFCON 限制（已在 checkP5DecisionHierarchy 中處理）
    const allowed = checkP5DecisionHierarchy("DAILY", context);
    
    if (!allowed) {
      Logger.log("P5 Daily：決策權限檢查未通過，執行受限");
      // 即使受限，數據收集仍可執行（只是標記為受限狀態）
    }
    
    // Step 2: 獲取要收集的股票列表
    const tickers = params.tickers || getHoldingsTickers();
    
    if (tickers.length === 0) {
      Logger.log("P5 Daily：無股票需要收集數據");
      return {
        status: "NO_TICKERS",
        message: "無股票需要收集數據"
      };
    }
    
    // Step 3: 收集市場數據（分批處理，避免超時）
    Logger.log(`P5 Daily：開始收集 ${tickers.length} 檔股票的數據`);
    
    const collectionResult = {
      ohlcv: {},
      technical_indicators: {},
      sector_etf: {},
      derivatives: {},
      macro_data: {},  // ⭐ V7.1 新增：宏觀數據（油價、貴金屬、匯率、國債利率等）
      news_atoms: {},
      taiwan_order_check: {}
    };
    
    // 分批收集 OHLCV 數據（每次最多 10 檔，避免超時）
    const batchSize = 10;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      Logger.log(`P5 Daily：收集批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(tickers.length / batchSize)} (${batch.length} 檔)`);
      
      try {
        const batchOHLCV = collectOHLCVData(batch);
        Object.assign(collectionResult.ohlcv, batchOHLCV);
        
        // 每批次之間稍作延遲，避免請求過快
        if (i + batchSize < tickers.length) {
          Utilities.sleep(500);  // 延遲 0.5 秒
        }
      } catch (error) {
        Logger.log(`P5 Daily：批次 ${Math.floor(i / batchSize) + 1} 收集失敗：${error.message}`);
        // 繼續處理下一批次
      }
    }
    
    // 計算技術指標（基於已收集的 OHLCV 數據）
    try {
      collectionResult.technical_indicators = calculateTechnicalIndicators(tickers);
    } catch (error) {
      Logger.log(`P5 Daily：技術指標計算失敗：${error.message}`);
    }
    
    // 收集其他數據（非關鍵，失敗不影響主流程）
    try {
      collectionResult.sector_etf = collectSectorETFData();
    } catch (error) {
      Logger.log(`P5 Daily：板塊 ETF 數據收集失敗：${error.message}`);
    }
    
    try {
      collectionResult.derivatives = collectDerivativesData(tickers);
    } catch (error) {
      Logger.log(`P5 Daily：衍生品數據收集失敗：${error.message}`);
    }
    
    // 收集宏觀數據（油價、貴金屬、匯率、國債利率等）
    try {
      collectionResult.macro_data = collectMacroData();
    } catch (error) {
      Logger.log(`P5 Daily：宏觀數據收集失敗：${error.message}`);
    }
    
    // ⭐ V8.9 新增：收集機構評級資料
    try {
      if (typeof collectInstitutionalRatings === "function") {
        collectionResult.institutional_ratings = collectInstitutionalRatings();
        Logger.log(`P5 Daily：機構評級收集完成，共 ${collectionResult.institutional_ratings.count || 0} 筆`);
      } else {
        Logger.log(`P5 Daily：⚠️ collectInstitutionalRatings 函數未定義，跳過機構評級收集`);
      }
    } catch (error) {
      Logger.log(`P5 Daily：機構評級收集失敗：${error.message}`);
    }
    
    // ⭐ V8.9 新增：批量更新機構評級可信度評分
    try {
      if (typeof updateInstitutionalRatingsCredibilityBatch === "function") {
        collectionResult.institutional_ratings_credibility_update = updateInstitutionalRatingsCredibilityBatch();
        Logger.log(`P5 Daily：機構評級可信度更新完成`);
      } else {
        Logger.log(`P5 Daily：⚠️ updateInstitutionalRatingsCredibilityBatch 函數未定義，跳過可信度更新`);
      }
    } catch (error) {
      Logger.log(`P5 Daily：機構評級可信度更新失敗：${error.message}`);
    }
    
    try {
      collectionResult.news_atoms = collectNewsAtoms(tickers, collectionResult.macro_data);
    } catch (error) {
      Logger.log(`P5 Daily：新聞原子化數據收集失敗：${error.message}`);
    }
    
    try {
      collectionResult.taiwan_order_check = checkTaiwanOrders(tickers);
    } catch (error) {
      Logger.log(`P5 Daily：台股掛單檢查失敗：${error.message}`);
    }
    
    // ⭐ V8.0 新增：監控 Weekly 制定的財報策略條件（Daily 僅監控，不做策略制定）
    try {
      collectionResult.earnings_strategy_monitoring = monitorEarningsStrategiesFromWeekly(tickers);
    } catch (error) {
      Logger.log(`P5 Daily：財報策略監控失敗：${error.message}`);
    }
    
    // ⭐ V8.0 新增：市場寬度數據收集（用於 Regime 分析）
    try {
      collectionResult.market_breadth = collectMarketBreadthData();
    } catch (error) {
      Logger.log(`P5 Daily：市場寬度數據收集失敗：${error.message}`);
    }
    
    // ⭐ V8.0 新增：P5.4 警報檢測（整合到 P5 Daily）
    let alertResult = null;
    try {
      alertResult = P5_4_CheckAlerts(tickers, collectionResult);
      collectionResult.alerts = alertResult;
      
      // 如果檢測到緊急情況，調用緊急撤退協議
      if (alertResult && alertResult.requires_emergency_exit) {
        Logger.log(`P5 Daily：檢測到緊急情況，觸發類型=${alertResult.trigger_type}`);
        
        // 調用 P4.6 緊急撤退協議
        const emergencyExitResult = P4_6_EmergencyExit({
          trigger_type: alertResult.trigger_type,
          market_data: {
            ohlcv: collectionResult.ohlcv,
            derivatives: collectionResult.derivatives,
            macro_data: collectionResult.macro_data
          },
          current_positions: getCurrentPositionsFromP4Snapshot()  // 從 P4 快照獲取當前持倉
        });
        
        collectionResult.emergency_exit = emergencyExitResult;
        
        // 記錄緊急撤退觸發
        Logger.log(`P5 Daily：緊急撤退協議已觸發，減倉比例=${emergencyExitResult.reduction_pct || 'N/A'}`);
      }
    } catch (error) {
      Logger.log(`P5 Daily：警報檢測失敗：${error.message}`);
    }
    
    // Step 4: 保存數據到表格
    saveDailyDataToSheets(collectionResult);
    
    // Step 5: 更新 P5 Daily 狀態
    updateP5DailyStatus(collectionResult);
    
    Logger.log(`P5 Daily 執行完成：收集了 ${tickers.length} 檔股票的數據`);
    
    return {
      status: "COMPLETED",
      tickers_count: tickers.length,
      collection_result: collectionResult,
      alerts: alertResult,
      emergency_exit_triggered: alertResult && alertResult.requires_emergency_exit
    };
    
  } catch (error) {
    Logger.log(`P5 Daily 執行失敗：${error.message}`);
    throw error;
  }
}

/**
 * 從 P4 快照獲取當前持倉 ⭐ V8.0 新增
 * 
 * @returns {Array} 當前持倉列表
 */
function getCurrentPositionsFromP4Snapshot() {
  try {
    const p4Snapshot = getLatestP4Snapshot();
    if (!p4Snapshot || !p4Snapshot.allocations) {
      return [];
    }
    
    return p4Snapshot.allocations.map(allocation => ({
      ticker: allocation.ticker,
      allocation_pct: allocation.allocation_pct || 0,
      target_amount: allocation.target_amount || 0,
      tier: allocation.tier || "UNKNOWN"
    }));
    
  } catch (error) {
    Logger.log(`P5 Daily：獲取當前持倉失敗：${error.message}`);
    return [];
  }
}

/**
 * 收集市場寬度數據 ⭐ V8.0 新增（Regime 分析補強）
 * 
 * 收集 Advance/Decline、New High/Low、Stocks Above MA50/MA200
 * 
 * @returns {Object} 市場寬度數據
 */
function collectMarketBreadthData() {
  try {
    Logger.log("P5 Daily：開始收集市場寬度數據");
    
    const today = new Date();
    const breadthData = {
      date: today,
      indices: {}
    };
    
    // 主要指數列表
    const indices = ["SPX", "NDX", "RUT"];  // S&P 500, NASDAQ 100, Russell 2000
    
    for (const indexTicker of indices) {
      try {
        // 這裡需要從數據源獲取市場寬度數據
        // 簡化實現：從 MARKET_OHLCV_DAILY 和 MARKET_INDICATORS_DAILY 計算
        const breadth = calculateMarketBreadthForIndex(indexTicker);
        breadthData.indices[indexTicker] = breadth;
      } catch (error) {
        Logger.log(`P5 Daily：收集 ${indexTicker} 市場寬度失敗：${error.message}`);
      }
    }
    
    // 保存到 MARKET_BREADTH_DAILY 表格
    saveMarketBreadthData(breadthData);
    
    Logger.log(`P5 Daily：市場寬度數據收集完成，共 ${Object.keys(breadthData.indices).length} 個指數`);
    return breadthData;
    
  } catch (error) {
    Logger.log(`P5 Daily：收集市場寬度數據失敗：${error.message}`);
    return {};
  }
}

/**
 * 計算單個指數的市場寬度 ⭐ V8.0 新增
 * 
 * @param {string} indexTicker - 指數代碼
 * @returns {Object} 市場寬度數據
 */
function calculateMarketBreadthForIndex(indexTicker) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ohlcvSheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    const indicatorsSheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
    
    if (!ohlcvSheet || ohlcvSheet.getLastRow() <= 1) {
      return {
        advance_count: 0,
        decline_count: 0,
        new_high_count: 0,
        new_low_count: 0,
        stocks_above_ma50: 0,
        stocks_above_ma200: 0,
        total_stocks: 0
      };
    }
    
    // 獲取該指數的成分股列表（簡化：從持倉或配置中獲取）
    const indexComponents = getIndexComponents(indexTicker);
    
    if (indexComponents.length === 0) {
      return {
        advance_count: 0,
        decline_count: 0,
        new_high_count: 0,
        new_low_count: 0,
        stocks_above_ma50: 0,
        stocks_above_ma200: 0,
        total_stocks: 0
      };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 讀取 OHLCV 數據
    const ohlcvData = {};
    const ohlcvRows = ohlcvSheet.getDataRange().getValues();
    const ohlcvHeaders = ohlcvRows[0];
    const dateCol = ohlcvHeaders.indexOf("date");
    const tickerCol = ohlcvHeaders.indexOf("ticker");
    const closeCol = ohlcvHeaders.indexOf("close");
    const highCol = ohlcvHeaders.indexOf("high");
    const lowCol = ohlcvHeaders.indexOf("low");
    
    for (let i = 1; i < ohlcvRows.length; i++) {
      const row = ohlcvRows[i];
      const rowDate = new Date(row[dateCol]);
      rowDate.setHours(0, 0, 0, 0);
      
      if (rowDate.getTime() === today.getTime() && indexComponents.includes(row[tickerCol])) {
        ohlcvData[row[tickerCol]] = {
          close: parseFloat(row[closeCol]) || 0,
          high: parseFloat(row[highCol]) || 0,
          low: parseFloat(row[lowCol]) || 0
        };
      }
    }
    
    // 讀取技術指標數據
    const indicatorsData = {};
    if (indicatorsSheet && indicatorsSheet.getLastRow() > 1) {
      const indicatorsRows = indicatorsSheet.getDataRange().getValues();
      const indicatorsHeaders = indicatorsRows[0];
      const indDateCol = indicatorsHeaders.indexOf("date");
      const indTickerCol = indicatorsHeaders.indexOf("ticker");
      const ma50Col = indicatorsHeaders.indexOf("ma60") !== -1 ? indicatorsHeaders.indexOf("ma60") : null;  // 使用 ma60 近似
      const ma200Col = indicatorsHeaders.indexOf("ma240") !== -1 ? indicatorsHeaders.indexOf("ma240") : null;  // 使用 ma240 近似
      
      for (let i = 1; i < indicatorsRows.length; i++) {
        const row = indicatorsRows[i];
        const rowDate = new Date(row[indDateCol]);
        rowDate.setHours(0, 0, 0, 0);
        
        if (rowDate.getTime() === today.getTime() && indexComponents.includes(row[indTickerCol])) {
          indicatorsData[row[indTickerCol]] = {
            ma50: ma50Col !== null ? parseFloat(row[ma50Col]) || 0 : null,
            ma200: ma200Col !== null ? parseFloat(row[ma200Col]) || 0 : null
          };
        }
      }
    }
    
    // 計算市場寬度指標
    let advanceCount = 0;
    let declineCount = 0;
    let newHighCount = 0;
    let newLowCount = 0;
    let stocksAboveMA50 = 0;
    let stocksAboveMA200 = 0;
    let totalStocks = 0;
    
    // 需要獲取前一天的數據來計算漲跌
    const previousDayData = getPreviousDayOHLCV(indexTicker, indexComponents);
    
    for (const ticker of indexComponents) {
      const currentData = ohlcvData[ticker];
      const prevData = previousDayData[ticker];
      const indData = indicatorsData[ticker];
      
      if (!currentData) {
        continue;
      }
      
      totalStocks++;
      
      // 計算漲跌
      if (prevData && prevData.close > 0) {
        const change = (currentData.close - prevData.close) / prevData.close;
        if (change > 0) {
          advanceCount++;
        } else if (change < 0) {
          declineCount++;
        }
      }
      
      // 計算新高新低（簡化：使用當日最高/最低與前一日比較）
      if (prevData) {
        if (currentData.high > prevData.high) {
          newHighCount++;
        }
        if (currentData.low < prevData.low) {
          newLowCount++;
        }
      }
      
      // 計算在均線以上的股票數
      if (indData && indData.ma50 && currentData.close > indData.ma50) {
        stocksAboveMA50++;
      }
      if (indData && indData.ma200 && currentData.close > indData.ma200) {
        stocksAboveMA200++;
      }
    }
    
    const advanceDeclineRatio = declineCount > 0 ? advanceCount / declineCount : (advanceCount > 0 ? 999 : 0);
    const newHighLowRatio = newLowCount > 0 ? newHighCount / newLowCount : (newHighCount > 0 ? 999 : 0);
    const ma50Percentage = totalStocks > 0 ? (stocksAboveMA50 / totalStocks) * 100 : 0;
    const ma200Percentage = totalStocks > 0 ? (stocksAboveMA200 / totalStocks) * 100 : 0;
    
    return {
      advance_count: advanceCount,
      decline_count: declineCount,
      new_high_count: newHighCount,
      new_low_count: newLowCount,
      stocks_above_ma50: stocksAboveMA50,
      stocks_above_ma200: stocksAboveMA200,
      total_stocks: totalStocks,
      advance_decline_ratio: Math.round(advanceDeclineRatio * 100) / 100,
      new_high_low_ratio: Math.round(newHighLowRatio * 100) / 100,
      ma50_percentage: Math.round(ma50Percentage * 100) / 100,
      ma200_percentage: Math.round(ma200Percentage * 100) / 100
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：計算 ${indexTicker} 市場寬度失敗：${error.message}`);
    return {
      advance_count: 0,
      decline_count: 0,
      new_high_count: 0,
      new_low_count: 0,
      stocks_above_ma50: 0,
      stocks_above_ma200: 0,
      total_stocks: 0
    };
  }
}

/**
 * 獲取指數成分股列表 ⭐ V8.0 新增
 * 
 * @param {string} indexTicker - 指數代碼
 * @returns {Array} 成分股列表
 */
function getIndexComponents(indexTicker) {
  // 簡化實現：從持倉或配置中獲取
  // 實際應該從數據源獲取指數成分股列表
  const holdings = getHoldingsTickers();
  return holdings;  // 簡化：使用持倉列表
}

/**
 * 獲取前一天的 OHLCV 數據 ⭐ V8.0 新增
 * 
 * @param {string} indexTicker - 指數代碼
 * @param {Array} components - 成分股列表
 * @returns {Object} 前一天的 OHLCV 數據
 */
function getPreviousDayOHLCV(indexTicker, components) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ohlcvSheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!ohlcvSheet || ohlcvSheet.getLastRow() <= 1) {
      return {};
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    const previousData = {};
    const rows = ohlcvSheet.getDataRange().getValues();
    const headers = rows[0];
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    const closeCol = headers.indexOf("close");
    const highCol = headers.indexOf("high");
    const lowCol = headers.indexOf("low");
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowDate = new Date(row[dateCol]);
      rowDate.setHours(0, 0, 0, 0);
      
      if (rowDate.getTime() === yesterday.getTime() && components.includes(row[tickerCol])) {
        previousData[row[tickerCol]] = {
          close: parseFloat(row[closeCol]) || 0,
          high: parseFloat(row[highCol]) || 0,
          low: parseFloat(row[lowCol]) || 0
        };
      }
    }
    
    return previousData;
    
  } catch (error) {
    Logger.log(`P5 Daily：獲取前一天 OHLCV 數據失敗：${error.message}`);
    return {};
  }
}

/**
 * 保存市場寬度數據到表格 ⭐ V8.0 新增
 * 
 * @param {Object} breadthData - 市場寬度數據
 */
function saveMarketBreadthData(breadthData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("MARKET_BREADTH_DAILY");
    
    if (!sheet) {
      // 創建表格
      sheet = ss.insertSheet("MARKET_BREADTH_DAILY");
      sheet.appendRow(MARKET_BREADTH_DAILY_SCHEMA.headers);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 保存每個指數的數據
    for (const [indexTicker, data] of Object.entries(breadthData.indices || {})) {
      const row = [
        Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd"),
        indexTicker,
        data.advance_count || 0,
        data.decline_count || 0,
        data.new_high_count || 0,
        data.new_low_count || 0,
        data.stocks_above_ma50 || 0,
        data.stocks_above_ma200 || 0,
        data.total_stocks || 0,
        data.advance_decline_ratio || 0,
        data.new_high_low_ratio || 0,
        data.ma50_percentage || 0,
        data.ma200_percentage || 0,
        new Date()
      ];
      
      sheet.appendRow(row);
    }
    
    Logger.log(`P5 Daily：市場寬度數據已保存到 MARKET_BREADTH_DAILY`);
    
  } catch (error) {
    Logger.log(`P5 Daily：保存市場寬度數據失敗：${error.message}`);
  }
}

// 注意：saveDailyDataToSheets 和 updateP5DailyStatus 在 24_P5_DAILY_SAVE.js 中
// 注意：getHoldingsTickers 在 24_P5_DAILY_UTILS.js 中
