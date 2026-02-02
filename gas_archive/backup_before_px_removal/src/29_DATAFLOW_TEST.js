/**
 * 🔍 V8.0 數據流測試系統
 * 
 * 測試所有數據收集是否正常（CSE 白名單或爬蟲），檢查資料正確性和筆數合理性
 * 
 * @version SSOT V8.0
 * @date 2026-01-16
 */

// ==========================================
// 測試配置
// ==========================================

const DATAFLOW_TEST_CONFIG = {
  // 測試股票清單
  test_stocks: {
    US: ["AAPL", "MSFT", "GOOGL"],
    TW: ["2330", "2317"],
    JP: ["7203", "6758"]
  },
  
  // 測試關鍵字
  test_keywords: {
    news: ["Apple earnings", "台積電", "TSMC"],
    macro: ["VIX", "oil price", "USD/TWD"]
  },
  
  // 預期筆數範圍
  expected_ranges: {
    cse_search: { min: 3, max: 100 },      // CSE 搜尋結果應 >= 3 筆
    historical_ohlcv: { min: 252, max: 1000 },  // 歷史 OHLCV 應 >= 252 筆（1 年）
    macro_data: { min: 1, max: 10 }        // 宏觀數據應 >= 1 筆
  }
};

// ==========================================
// 測試主函數
// ==========================================

/**
 * 執行數據流測試
 * 
 * @param {Object} params - 測試參數
 * @param {string} params.test_category - 測試類別（ALL/P2/P2_5/P3/P5_DAILY/P5_WEEKLY）
 * @returns {Object} 測試結果
 */
function DataflowTest_Execute(params) {
  const startTime = Date.now();
  
  try {
    Logger.log(`🔍 數據流測試開始：test_category=${params.test_category}`);
    
    const testCategory = params.test_category || "ALL";
    const results = [];
    
    // 根據測試類別執行對應測試
    if (testCategory === "ALL" || testCategory === "P2") {
      results.push(...testP2DataCollection());
    }
    
    if (testCategory === "ALL" || testCategory === "P2_5") {
      results.push(...testP2_5DataCollection());
    }
    
    if (testCategory === "ALL" || testCategory === "P3") {
      results.push(...testP3DataCollection());
    }
    
    if (testCategory === "ALL" || testCategory === "P5_DAILY") {
      results.push(...testP5DailyDataCollection());
    }
    
    if (testCategory === "ALL" || testCategory === "P5_WEEKLY") {
      results.push(...testP5WeeklyDataCollection());
    }
    
    const duration = Date.now() - startTime;
    
    // 統計結果
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === "PASSED").length,
      failed: results.filter(r => r.status === "FAILED").length,
      warning: results.filter(r => r.status === "WARNING").length
    };
    
    return {
      status: summary.failed === 0 ? "COMPLETED" : "PARTIAL",
      summary: summary,
      results: results,
      duration: duration,
      test_category: testCategory
    };
  } catch (error) {
    Logger.log(`🔍 數據流測試失敗：${error.message}`);
    return {
      status: "FAILED",
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

// ==========================================
// P2 數據收集測試
// ==========================================

/**
 * 測試 P2 數據收集
 */
function testP2DataCollection() {
  const results = [];
  
  try {
    Logger.log("🔍 開始測試 P2 數據收集");
    
    // ⭐ 診斷：檢查全局作用域中是否有其他 P2 函數
    Logger.log(`🔍 診斷：typeof P2_Execute = ${typeof P2_Execute}`);
    Logger.log(`🔍 診斷：typeof collectFinancialDataFromExternalSources = ${typeof collectFinancialDataFromExternalSources}`);
    Logger.log(`🔍 診斷：typeof getMasterCandidatesFromSheet = ${typeof getMasterCandidatesFromSheet}`);
    
    // ⭐ 診斷：檢查文件是否載入
    try {
      // 嘗試訪問文件中的其他函數
      if (typeof P2_Execute === 'function') {
        Logger.log("✅ P2_Execute 函數存在，文件已載入");
      } else {
        Logger.log("❌ P2_Execute 函數不存在，文件可能未載入");
      }
    } catch (e) {
      Logger.log(`❌ 診斷錯誤：${e.message}`);
    }
    
    // 1. 測試美股財務數據（CSE）
    const usTestResult = testP2FinancialData("AAPL", "US", "P2_US_TAIWAN");
    results.push(usTestResult);
    
    // 2. 測試台股財務數據（CSE）
    const twTestResult = testP2FinancialData("2330", "TW", "P2_US_TAIWAN");
    results.push(twTestResult);
    
    // 3. 測試日股財務數據（CSE）
    const jpTestResult = testP2FinancialData("7203", "JP", "P2_JAPAN");
    results.push(jpTestResult);
    
    // 4. 測試同業數據收集
    const peerTestResult = testP2PeerData("AAPL", "US");
    results.push(peerTestResult);
    
  } catch (error) {
    Logger.log(`🔍 P2 數據收集測試失敗：${error.message}`);
    results.push({
      test_name: "P2_數據收集",
      status: "FAILED",
      error: error.message
    });
  }
  
  return results;
}

/**
 * 測試 P2 財務數據收集（單個股票）
 */
function testP2FinancialData(ticker, market, cseName) {
  try {
    Logger.log(`🔍 測試 P2 財務數據：ticker=${ticker}, market=${market}, CSE=${cseName}`);
    
    // ⭐ 診斷：檢查全局作用域中是否有這些函數
    Logger.log(`🔍 診斷：typeof collectTaiwanStockFinancialData = ${typeof collectTaiwanStockFinancialData}`);
    Logger.log(`🔍 診斷：typeof collectUSStockFinancialData = ${typeof collectUSStockFinancialData}`);
    Logger.log(`🔍 診斷：typeof collectJapanStockFinancialData = ${typeof collectJapanStockFinancialData}`);
    
    // ⭐ 檢查函數是否存在並嘗試調用
    let collectFunction = null;
    let functionName = "";
    
    if (market === "TW" || market === "Taiwan") {
      functionName = "collectTaiwanStockFinancialData";
      if (typeof collectTaiwanStockFinancialData !== 'function') {
        Logger.log(`🔍 錯誤：${functionName} 未定義（typeof=${typeof collectTaiwanStockFinancialData}）`);
        return {
          test_name: `P2_財務數據_${ticker}`,
          status: "FAILED",
          message: `函數 ${functionName} 未定義（請確認 21_P2_FUNDAMENTAL_ANALYSIS.js 已載入並無語法錯誤）`,
          ticker: ticker,
          market: market,
          diagnostic: `typeof=${typeof collectTaiwanStockFinancialData}`
        };
      }
      collectFunction = collectTaiwanStockFinancialData;
    } else if (market === "US" || market === "United States") {
      functionName = "collectUSStockFinancialData";
      if (typeof collectUSStockFinancialData !== 'function') {
        Logger.log(`🔍 錯誤：${functionName} 未定義（typeof=${typeof collectUSStockFinancialData}）`);
        return {
          test_name: `P2_財務數據_${ticker}`,
          status: "FAILED",
          message: `函數 ${functionName} 未定義（請確認 21_P2_FUNDAMENTAL_ANALYSIS.js 已載入並無語法錯誤）`,
          ticker: ticker,
          market: market,
          diagnostic: `typeof=${typeof collectUSStockFinancialData}`
        };
      }
      collectFunction = collectUSStockFinancialData;
    } else if (market === "JP" || market === "Japan") {
      functionName = "collectJapanStockFinancialData";
      if (typeof collectJapanStockFinancialData !== 'function') {
        Logger.log(`🔍 錯誤：${functionName} 未定義（typeof=${typeof collectJapanStockFinancialData}）`);
        return {
          test_name: `P2_財務數據_${ticker}`,
          status: "FAILED",
          message: `函數 ${functionName} 未定義（請確認 21_P2_FUNDAMENTAL_ANALYSIS.js 已載入並無語法錯誤）`,
          ticker: ticker,
          market: market,
          diagnostic: `typeof=${typeof collectJapanStockFinancialData}`
        };
      }
      collectFunction = collectJapanStockFinancialData;
    } else {
      return {
        test_name: `P2_財務數據_${ticker}`,
        status: "FAILED",
        message: `不支援的市場：${market}`,
        ticker: ticker,
        market: market
      };
    }
    
    // 調用 P2 的數據收集函數
    // ⚠️ 注意：這些函數內部會調用 executeCSESearch，可能需要一些時間
    Logger.log(`🔍 準備調用 ${functionName}(${ticker}, "MONTHLY")`);
    
    let data = null;
    try {
      data = collectFunction(ticker, "MONTHLY");
      Logger.log(`🔍 ${functionName} 執行完成，返回值：${data ? "有數據" : "null"}`);
    } catch (error) {
      Logger.log(`🔍 ${functionName} 執行失敗：${error.message}`);
      return {
        test_name: `P2_財務數據_${ticker}`,
        status: "FAILED",
        message: `函數執行失敗：${error.message}`,
        ticker: ticker,
        market: market,
        error: error.message,
        stack: error.stack
      };
    }
    
    if (!data) {
      return {
        test_name: `P2_財務數據_${ticker}`,
        status: "FAILED",
        message: "無法獲取財務數據（函數返回 null）",
        ticker: ticker,
        market: market,
        note: "可能是 CSE 搜尋失敗或超時，請檢查 executeCSESearch 是否正常運作"
      };
    }
    
    const searchResults = data.search_results || [];
    const extracted = data.extracted || false;
    
    // 檢查搜尋結果筆數
    const resultCount = searchResults.length;
    const expectedMin = DATAFLOW_TEST_CONFIG.expected_ranges.cse_search.min;
    
    if (resultCount < expectedMin) {
      return {
        test_name: `P2_財務數據_${ticker}`,
        status: "WARNING",
        message: `搜尋結果筆數不足（${resultCount} < ${expectedMin}）`,
        ticker: ticker,
        market: market,
        result_count: resultCount,
        expected_min: expectedMin,
        extracted: extracted
      };
    }
    
    // ⚠️ 注意：財務指標由 AI 在 Stage 1 從搜尋結果中提取
    // 這裡只測試 CSE 搜尋功能，不檢查 extracted 狀態
    // extracted 為 false 是正常的，因為財務指標提取是 AI 的任務
    
    // 檢查財務指標是否已提取（在 Stage 1 由 AI 提取）
    // 注意：extracted 可能為 false，因為財務指標由 AI 在 Stage 1 提取
    // 這裡只檢查 CSE 搜尋是否成功，不檢查 extracted 狀態
    
    return {
      test_name: `P2_財務數據_${ticker}`,
      status: "PASSED",
      message: "財務數據 CSE 搜尋成功（財務指標將由 AI 在 Stage 1 提取）",
      ticker: ticker,
      market: market,
      result_count: resultCount,
      extracted: extracted,
      note: "財務指標由 AI 在 Stage 1 從搜尋結果中提取，這裡只測試 CSE 搜尋功能"
    };
  } catch (error) {
    Logger.log(`🔍 P2 財務數據測試失敗：ticker=${ticker}, error=${error.message}`);
    return {
      test_name: `P2_財務數據_${ticker}`,
      status: "FAILED",
      message: error.message,
      ticker: ticker,
      market: market
    };
  }
}

/**
 * 測試 P2 同業數據收集
 */
function testP2PeerData(ticker, market) {
  try {
    Logger.log(`🔍 測試 P2 同業數據：ticker=${ticker}, market=${market}`);
    
    // ⭐ 診斷：檢查全局作用域中是否有這個函數
    Logger.log(`🔍 診斷：typeof collectPeerFinancialData = ${typeof collectPeerFinancialData}`);
    
    // ⭐ 檢查函數是否存在
    if (typeof collectPeerFinancialData !== 'function') {
      Logger.log(`🔍 錯誤：collectPeerFinancialData 未定義（typeof=${typeof collectPeerFinancialData}）`);
      return {
        test_name: "P2_同業數據",
        status: "FAILED",
        message: "函數 collectPeerFinancialData 未定義（請確認 21_P2_FUNDAMENTAL_ANALYSIS.js 已載入並無語法錯誤）",
        ticker: ticker,
        market: market,
        diagnostic: `typeof=${typeof collectPeerFinancialData}`
      };
    }
    const collectPeerFunction = collectPeerFinancialData;
    
    // 調用實際的同業數據收集函數
    // 注意：collectPeerFinancialData 需要目標 ticker、同業列表、數據源和已存在的財務數據
    // 這裡簡化測試，使用示例同業列表
    
    let peerCompanies = [];
    if (market === "US" || market === "United States") {
      // 美股示例同業（科技股）
      if (ticker === "AAPL") {
        peerCompanies = ["MSFT", "GOOGL", "AMZN"];
      } else {
        peerCompanies = ["MSFT", "GOOGL"];  // 預設同業
      }
    } else if (market === "TW" || market === "Taiwan") {
      peerCompanies = ["2330", "2308", "2454"];  // 台股示例同業
    } else if (market === "JP" || market === "Japan") {
      peerCompanies = ["7203", "6758", "9984"];  // 日股示例同業
    }
    
    if (peerCompanies.length === 0) {
      return {
        test_name: "P2_同業數據",
        status: "WARNING",
        message: "無法確定同業列表（需要 AI 在 Stage 1 識別）",
        ticker: ticker,
        market: market,
        note: "同業列表應該由 AI 在 P2 Stage 1 識別，這裡只是測試數據收集功能"
      };
    }
    
    // 確定數據源
    let dataSource = "P2_US_TAIWAN_CSE";
    if (market === "JP" || market === "Japan") {
      dataSource = "P2_JAPAN_CSE";
    }
    
    // 調用同業數據收集函數
    // ⚠️ 注意：這個函數內部會調用 executeCSESearch，可能需要一些時間
    Logger.log(`🔍 準備調用 collectPeerFinancialData(${ticker}, [${peerCompanies.join(", ")}], ${dataSource}, {})`);
    
    let peerData = null;
    try {
      peerData = collectPeerFunction(ticker, peerCompanies, dataSource, {});
      Logger.log(`🔍 collectPeerFinancialData 執行完成，返回值：${peerData ? `${Object.keys(peerData).length} 個同業` : "null"}`);
    } catch (error) {
      Logger.log(`🔍 collectPeerFinancialData 執行失敗：${error.message}`);
      return {
        test_name: "P2_同業數據",
        status: "FAILED",
        message: `函數執行失敗：${error.message}`,
        ticker: ticker,
        market: market,
        error: error.message,
        stack: error.stack
      };
    }
    
    if (!peerData || Object.keys(peerData).length === 0) {
      return {
        test_name: "P2_同業數據",
        status: "WARNING",
        message: "同業數據收集結果為空",
        ticker: ticker,
        market: market,
        peer_companies: peerCompanies,
        note: "可能是 CSE 搜尋未返回結果，或同業 ticker 不正確"
      };
    }
    
    const resultCount = Object.keys(peerData).length;
    
    return {
      test_name: "P2_同業數據",
      status: "PASSED",
      message: `同業數據收集成功（${resultCount}/${peerCompanies.length} 家）`,
      ticker: ticker,
      market: market,
      peer_companies: peerCompanies,
      result_count: resultCount
    };
  } catch (error) {
    Logger.log(`🔍 P2 同業數據測試失敗：error=${error.message}`);
    return {
      test_name: "P2_同業數據",
      status: "FAILED",
      message: error.message,
      ticker: ticker,
      market: market
    };
  }
}

// ==========================================
// P2.5 數據收集測試
// ==========================================

/**
 * 測試 P2.5 數據收集
 */
function testP2_5DataCollection() {
  const results = [];
  
  try {
    Logger.log("🔍 開始測試 P2.5 數據收集");
    
    // 調用實際的 P2.5 數據收集函數
    // collectSmartMoneyData 需要 tickers 和 frequency 參數
    const testTickers = ["AAPL"];  // 測試用股票
    const frequency = "MONTHLY";  // 測試用頻率
    
    const smartMoneyData = collectSmartMoneyData(testTickers, frequency);
    
    if (!smartMoneyData) {
      results.push({
        test_name: "P2_5_數據收集",
        status: "FAILED",
        message: "無法獲取 P2.5 數據"
      });
      return results;
    }
    
    // 檢查各項數據
    const hasInstitutional = smartMoneyData.institutional_holdings && Object.keys(smartMoneyData.institutional_holdings).length > 0;
    const hasInsider = smartMoneyData.insider_trading && Object.keys(smartMoneyData.insider_trading).length > 0;
    const hasOptions = smartMoneyData.options_flow && Object.keys(smartMoneyData.options_flow).length > 0;
    const hasDarkPool = smartMoneyData.dark_pool && Object.keys(smartMoneyData.dark_pool).length > 0;
    
    const successCount = [hasInstitutional, hasInsider, hasOptions, hasDarkPool].filter(v => v).length;
    
    if (successCount === 0) {
      results.push({
        test_name: "P2_5_數據收集",
        status: "WARNING",
        message: "P2.5 數據收集結果為空（可能是 SMART_MONEY_DAILY 表格沒有數據）",
        institutional_holdings: hasInstitutional,
        insider_trading: hasInsider,
        options_flow: hasOptions,
        dark_pool: hasDarkPool,
        note: "P2.5 數據從 SMART_MONEY_DAILY 表格讀取，需要先有數據"
      });
    } else {
      results.push({
        test_name: "P2_5_數據收集",
        status: successCount === 4 ? "PASSED" : "WARNING",
        message: `P2.5 數據收集部分成功（${successCount}/4 項）`,
        institutional_holdings: hasInstitutional,
        insider_trading: hasInsider,
        options_flow: hasOptions,
        dark_pool: hasDarkPool
      });
    }
    
  } catch (error) {
    Logger.log(`🔍 P2.5 數據收集測試失敗：${error.message}`);
    results.push({
      test_name: "P2_5_數據收集",
      status: "FAILED",
      message: error.message
    });
  }
  
  return results;
}

// ==========================================
// P3 數據收集測試
// ==========================================

/**
 * 測試 P3 數據收集
 */
function testP3DataCollection() {
  const results = [];
  
  try {
    Logger.log("🔍 開始測試 P3 數據收集");
    
    // 1. 測試美股歷史 OHLCV（stooq.com）
    const usOHLCVResult = testP3HistoricalOHLCV("AAPL", "US", "stooq.com");
    results.push(usOHLCVResult);
    
    // 2. 測試日股歷史 OHLCV（stooq.com）
    const jpOHLCVResult = testP3HistoricalOHLCV("7203", "JP", "stooq.com");
    results.push(jpOHLCVResult);
    
    // 3. 測試台股歷史 OHLCV（CSE）
    const twOHLCVResult = testP3HistoricalOHLCV("2330", "TW", "TAIWAN_STOCK");
    results.push(twOHLCVResult);
    
    // 4. 測試技術指標讀取（表格）
    const indicatorsResult = testP3TechnicalIndicators("AAPL", "US");
    results.push(indicatorsResult);
    
  } catch (error) {
    Logger.log(`🔍 P3 數據收集測試失敗：${error.message}`);
    results.push({
      test_name: "P3_數據收集",
      status: "FAILED",
      error: error.message
    });
  }
  
  return results;
}

/**
 * 測試 P3 歷史 OHLCV 數據收集
 */
function testP3HistoricalOHLCV(ticker, market, dataSource) {
  try {
    Logger.log(`🔍 測試 P3 歷史 OHLCV：ticker=${ticker}, market=${market}, dataSource=${dataSource}`);
    
    // 調用實際的歷史 OHLCV 獲取函數
    // getHistoricalOHLCV(ticker, days, fetchFromStooq)
    // 優先從 MARKET_OHLCV_DAILY 表格讀取，不足時從 stooq.com 補充
    const days = 252;  // 測試用：獲取最近 252 天（約 1 年）
    const fetchFromStooq = (dataSource === "stooq.com");  // 只有 stooq.com 數據源才允許從 stooq 獲取
    
    const ohlcvData = getHistoricalOHLCV(ticker, days, fetchFromStooq);
    
    if (!ohlcvData || !Array.isArray(ohlcvData) || ohlcvData.length === 0) {
      return {
        test_name: `P3_歷史OHLCV_${ticker}`,
        status: "WARNING",
        message: "歷史 OHLCV 數據為空（可能是表格沒有數據，或 stooq.com 獲取失敗）",
        ticker: ticker,
        market: market,
        data_source: dataSource,
        note: "歷史 OHLCV 優先從 MARKET_OHLCV_DAILY 表格讀取，不足時從 stooq.com 補充"
      };
    }
    
    // 檢查數據格式
    const hasRequiredFields = ohlcvData.every(item => 
      item.date && item.open && item.high && item.low && item.close && item.volume
    );
    
    if (!hasRequiredFields) {
      return {
        test_name: `P3_歷史OHLCV_${ticker}`,
        status: "WARNING",
        message: "歷史 OHLCV 數據格式不完整",
        ticker: ticker,
        market: market,
        data_count: ohlcvData.length
      };
    }
    
    return {
      test_name: `P3_歷史OHLCV_${ticker}`,
      status: "PASSED",
      message: `歷史 OHLCV 數據收集成功（${ohlcvData.length} 天）`,
      ticker: ticker,
      market: market,
      data_source: dataSource,
      data_count: ohlcvData.length,
      latest_date: ohlcvData[ohlcvData.length - 1]?.date || null
    };
  } catch (error) {
    Logger.log(`🔍 P3 歷史 OHLCV 測試失敗：ticker=${ticker}, error=${error.message}`);
    return {
      test_name: `P3_歷史OHLCV_${ticker}`,
      status: "FAILED",
      message: error.message,
      ticker: ticker,
      market: market
    };
  }
}

/**
 * 測試 P3 技術指標讀取
 */
function testP3TechnicalIndicators(ticker, market) {
  try {
    Logger.log(`🔍 測試 P3 技術指標：ticker=${ticker}, market=${market}`);
    
    // 調用實際的技術指標讀取函數
    // getTechnicalIndicatorsFromSheet 從 MARKET_INDICATORS_DAILY 表格讀取
    const indicatorsData = getTechnicalIndicatorsFromSheet(ticker);
    
    if (!indicatorsData || !indicatorsData.indicators) {
      return {
        test_name: `P3_技術指標_${ticker}`,
        status: "WARNING",
        message: "技術指標數據為空（可能是 MARKET_INDICATORS_DAILY 表格沒有數據）",
        ticker: ticker,
        market: market,
        note: "技術指標由 P5 Daily 計算並保存到 MARKET_INDICATORS_DAILY 表格，需要先有數據"
      };
    }
    
    const indicators = indicatorsData.indicators;
    
    // 檢查常見技術指標是否存在
    const hasRSI = indicators.rsi_14 !== null && indicators.rsi_14 !== undefined;
    const hasMACD = indicators.macd_value !== null && indicators.macd_value !== undefined;
    const hasATR = indicators.atr_14 !== null && indicators.atr_14 !== undefined;
    const hasMA = (indicators.ma20 !== null || indicators.ma60 !== null || indicators.ma240 !== null);
    
    const indicatorCount = [hasRSI, hasMACD, hasATR, hasMA].filter(v => v).length;
    
    if (indicatorCount === 0) {
      return {
        test_name: `P3_技術指標_${ticker}`,
        status: "WARNING",
        message: "技術指標數據不完整（缺少主要指標）",
        ticker: ticker,
        market: market,
        has_rsi: hasRSI,
        has_macd: hasMACD,
        has_atr: hasATR,
        has_ma: hasMA
      };
    }
    
    return {
      test_name: `P3_技術指標_${ticker}`,
      status: indicatorCount >= 2 ? "PASSED" : "WARNING",
      message: `技術指標讀取成功（${indicatorCount}/4 項主要指標）`,
      ticker: ticker,
      market: market,
      has_rsi: hasRSI,
      has_macd: hasMACD,
      has_atr: hasATR,
      has_ma: hasMA,
      latest_date: indicatorsData.last_updated || null
    };
  } catch (error) {
    Logger.log(`🔍 P3 技術指標測試失敗：ticker=${ticker}, error=${error.message}`);
    return {
      test_name: `P3_技術指標_${ticker}`,
      status: "FAILED",
      message: error.message,
      ticker: ticker,
      market: market
    };
  }
}

// ==========================================
// P5 Daily 數據收集測試
// ==========================================

/**
 * 測試 P5 Daily 數據收集
 */
function testP5DailyDataCollection() {
  // ⭐ V8.0 版本標記：2026-01-17 17:55 - 已添加詳細日誌
  Logger.log(`🔍 testP5DailyDataCollection 版本 V8.0_20260117_1755 已載入`);
  
  const results = [];
  
  try {
    Logger.log("🔍 開始測試 P5 Daily 數據收集");
    
    // 1. 測試新聞收集（CSE）
    const newsResult = testP5DailyNews("Apple earnings");
    results.push(newsResult);
    
    // 2. 測試宏觀數據（stooq.com）
    const macroResult = testP5DailyMacro();
    results.push(macroResult);
    
    // 3. 測試 OHLCV 數據收集
    const ohlcvResult = testP5DailyOHLCV("AAPL", "US");
    results.push(ohlcvResult);
    
    // 4. 測試衍生品數據（爬蟲）
    const derivativesResult = testP5DailyDerivatives();
    results.push(derivativesResult);
    
    // ⭐ V8.9 新增：測試機構評級收集
    const institutionalRatingsResult = testP5DailyInstitutionalRatings();
    results.push(institutionalRatingsResult);
    
  } catch (error) {
    Logger.log(`🔍 P5 Daily 數據收集測試失敗：${error.message}`);
    results.push({
      test_name: "P5_DAILY_數據收集",
      status: "FAILED",
      error: error.message
    });
  }
  
  return results;
}

/**
 * ⭐ V8.9 新增：測試 P5 Daily 機構評級收集
 */
function testP5DailyInstitutionalRatings() {
  try {
    Logger.log("🔍 測試 P5 Daily 機構評級收集");
    
    if (typeof collectInstitutionalRatings !== "function") {
      return {
        test_name: "P5_DAILY_機構評級收集",
        status: "FAILED",
        message: "collectInstitutionalRatings 未定義（請確認 src/24_P5_DAILY_INSTITUTIONAL_RATINGS.js 已載入）"
      };
    }
    
    const result = collectInstitutionalRatings();
    
    if (!result || !result.success) {
      return {
        test_name: "P5_DAILY_機構評級收集",
        status: "WARNING",
        message: result.message || "機構評級收集失敗或無持股清單",
        count: result.count || 0
      };
    }
    
    return {
      test_name: "P5_DAILY_機構評級收集",
      status: "PASSED",
      message: `機構評級收集成功（共 ${result.count} 筆，原始收集 ${result.total_collected || result.count} 筆，去重後 ${result.deduplicated || result.count} 筆）`,
      count: result.count,
      total_collected: result.total_collected,
      deduplicated: result.deduplicated
    };
  } catch (error) {
    Logger.log(`🔍 P5 Daily 機構評級收集測試失敗：${error.message}`);
    return {
      test_name: "P5_DAILY_機構評級收集",
      status: "FAILED",
      message: error.message
    };
  }
}

/**
 * 測試 P5 Daily 新聞收集
 */
function testP5DailyNews(keyword) {
  try {
    Logger.log(`🔍 測試 P5 Daily 新聞收集：keyword=${keyword}`);
    
    // 調用 P5 Daily 的新聞收集函數
    // collectNewsAtoms 需要 tickers 和 macroData 參數
    // 這裡簡化測試，只測試新聞收集功能
    const tickers = ["AAPL"];  // 測試用股票
    const macroData = {};  // 空宏觀數據
    
    const newsData = collectNewsAtoms(tickers, macroData);
    
    // ⭐ V8.9 修正：測試時也保存數據到表格
    if (newsData && Object.keys(newsData).length > 0) {
      Logger.log(`🔍 測試：準備保存 ${Object.keys(newsData).length} 檔股票的新聞數據到表格`);
      try {
        saveNewsAtomsToSheet(newsData, new Date());
        Logger.log(`🔍 測試：新聞數據已保存到表格`);
      } catch (saveError) {
        Logger.log(`🔍 測試：保存新聞數據失敗：${saveError.message}`);
      }
    }
    
    // 檢查新聞數據結構
    // collectNewsAtoms 返回格式：{ "AAPL": { ticker, date, search_results: [...], status: "COMPLETED" } }
    const resultCount = newsData && typeof newsData === 'object' && !Array.isArray(newsData)
      ? Object.keys(newsData).length 
      : 0;
    
    // 計算實際的新聞條數（從 search_results 中）
    let totalNewsCount = 0;
    if (newsData && typeof newsData === 'object') {
      for (const ticker in newsData) {
        if (newsData[ticker].search_results && Array.isArray(newsData[ticker].search_results)) {
          totalNewsCount += newsData[ticker].search_results.length;
        }
      }
    }
    
    if (resultCount === 0) {
      return {
        test_name: "P5_DAILY_新聞收集",
        status: "WARNING",
        message: "新聞收集結果為空（可能是白名單過濾過於嚴格，或 CSE 搜尋結果不在白名單內）",
        keyword: keyword,
        result_count: 0,
        note: "檢查 P5_NEWS CSE 的白名單設定，確認新聞來源是否在白名單內"
      };
    }
    
    const expectedMin = DATAFLOW_TEST_CONFIG.expected_ranges.cse_search.min;
    
    if (totalNewsCount < expectedMin) {
      return {
        test_name: "P5_DAILY_新聞收集",
        status: "WARNING",
        message: `新聞筆數不足（${totalNewsCount} < ${expectedMin}）`,
        keyword: keyword,
        result_count: totalNewsCount,
        expected_min: expectedMin
      };
    }
    
    return {
      test_name: "P5_DAILY_新聞收集",
      status: "PASSED",
      message: "新聞收集成功",
      keyword: keyword,
      result_count: totalNewsCount,
      tickers_count: resultCount
    };
  } catch (error) {
    Logger.log(`🔍 P5 Daily 新聞收集測試失敗：error=${error.message}`);
    Logger.log(`🔍 錯誤堆疊：${error.stack}`);
    return {
      test_name: "P5_DAILY_新聞收集",
      status: "FAILED",
      message: error.message,
      keyword: keyword
    };
  }
}

/**
 * 測試 P5 Daily 宏觀數據
 */
function testP5DailyMacro() {
  try {
    Logger.log("🔍 測試 P5 Daily 宏觀數據");
    
    // 調用 P5 Daily 的宏觀數據收集函數
    const macroData = collectMacroData();
    
    if (!macroData) {
      return {
        test_name: "P5_DAILY_宏觀數據",
        status: "FAILED",
        message: "無法獲取宏觀數據"
      };
    }
    
    // 檢查宏觀數據完整性
    const hasCommodities = macroData.commodities && Object.keys(macroData.commodities).length > 0;
    const hasCurrencies = macroData.currencies && Object.keys(macroData.currencies).length > 0;
    const hasBonds = macroData.bonds && Object.keys(macroData.bonds).length > 0;
    const hasIndices = macroData.indices && Object.keys(macroData.indices).length > 0;
    
    const successCount = [hasCommodities, hasCurrencies, hasBonds, hasIndices].filter(v => v).length;
    
    if (successCount === 0) {
      return {
        test_name: "P5_DAILY_宏觀數據",
        status: "WARNING",
        message: "所有宏觀數據都無法獲取（可能是 Cloud Function 代理問題，HTTP 500 錯誤）",
        commodities: hasCommodities,
        currencies: hasCurrencies,
        bonds: hasBonds,
        indices: hasIndices,
        note: "檢查 Cloud Function 代理是否正常運作，或 stooq.com 數據源是否可用"
      };
    }
    
    if (successCount < 4) {
      return {
        test_name: "P5_DAILY_宏觀數據",
        status: "WARNING",
        message: `部分宏觀數據無法獲取（成功：${successCount}/4，可能是 Cloud Function 代理問題）`,
        commodities: hasCommodities,
        currencies: hasCurrencies,
        bonds: hasBonds,
        indices: hasIndices,
        note: "部分數據源可能返回 HTTP 500 錯誤，檢查 Cloud Function 代理"
      };
    }
    
    return {
      test_name: "P5_DAILY_宏觀數據",
      status: "PASSED",
      message: "宏觀數據收集成功",
      commodities: hasCommodities,
      currencies: hasCurrencies,
      bonds: hasBonds,
      indices: hasIndices
    };
  } catch (error) {
    Logger.log(`🔍 P5 Daily 宏觀數據測試失敗：error=${error.message}`);
    return {
      test_name: "P5_DAILY_宏觀數據",
      status: "FAILED",
      message: error.message
    };
  }
}

/**
 * 測試 P5 Daily OHLCV 數據收集
 */
function testP5DailyOHLCV(ticker, market) {
  try {
    Logger.log(`🔍 測試 P5 Daily OHLCV：ticker=${ticker}, market=${market}`);
    
    // 調用 P5 Daily 的 OHLCV 數據收集函數
    const ohlcvData = collectOHLCVData([ticker]);
    
    if (!ohlcvData || !ohlcvData[ticker]) {
      return {
        test_name: `P5_DAILY_OHLCV_${ticker}`,
        status: "FAILED",
        message: "無法獲取 OHLCV 數據",
        ticker: ticker,
        market: market
      };
    }
    
    const data = ohlcvData[ticker];
    
    // 檢查數據格式
    const hasRequiredFields = data.date && data.open && data.high && data.low && data.close && data.volume;
    
    if (!hasRequiredFields) {
      return {
        test_name: `P5_DAILY_OHLCV_${ticker}`,
        status: "WARNING",
        message: "OHLCV 數據格式不完整",
        ticker: ticker,
        market: market,
        data_fields: Object.keys(data)
      };
    }
    
    return {
      test_name: `P5_DAILY_OHLCV_${ticker}`,
      status: "PASSED",
      message: "OHLCV 數據收集成功",
      ticker: ticker,
      market: market,
      has_data: true
    };
  } catch (error) {
    Logger.log(`🔍 P5 Daily OHLCV 測試失敗：ticker=${ticker}, error=${error.message}`);
    return {
      test_name: `P5_DAILY_OHLCV_${ticker}`,
      status: "FAILED",
      message: error.message,
      ticker: ticker,
      market: market
    };
  }
}

/**
 * 測試 P5 Daily 衍生品數據
 */
function testP5DailyDerivatives() {
  // ⭐ V8.0 版本標記：2026-01-17 17:55 - 已添加詳細日誌
  Logger.log(`🔍 測試 P5 Daily 衍生品數據 - 版本 V8.0_20260117_1755`);
  Logger.log(`🔍 testP5DailyDerivatives 函數已載入`);
  
  try {
    Logger.log("🔍 測試 P5 Daily 衍生品數據");
    
    // 調用 P5 Daily 的衍生品數據收集函數
    const testTickers = ["AAPL"];  // 測試用股票
    Logger.log(`🔍 testP5DailyDerivatives：準備調用 collectDerivativesData，tickers=${JSON.stringify(testTickers)}`);
    Logger.log(`🔍 testP5DailyDerivatives：collectDerivativesData 函數是否存在：${typeof collectDerivativesData}`);
    
    const derivativesData = collectDerivativesData(testTickers);
    Logger.log(`🔍 testP5DailyDerivatives：collectDerivativesData 執行完成，返回值類型：${typeof derivativesData}, 鍵數量：${derivativesData ? Object.keys(derivativesData).length : 0}`);
    
    if (!derivativesData) {
      return {
        test_name: "P5_DAILY_衍生品數據",
        status: "FAILED",
        message: "無法獲取衍生品數據"
      };
    }
    
    // 檢查衍生品數據完整性
    const hasData = Object.keys(derivativesData).length > 0;
    
    if (!hasData) {
      return {
        test_name: "P5_DAILY_衍生品數據",
        status: "WARNING",
        message: "衍生品數據收集結果為空（函數返回 PENDING 狀態，需要整合 OCC/CBOE/Nasdaq API）",
        note: "目前衍生品數據收集函數尚未完全實作，需要整合交易所 API"
      };
    }
    
    // 檢查是否有常見的衍生品指標
    const firstTicker = Object.keys(derivativesData)[0];
    const tickerData = derivativesData[firstTicker];
    const status = tickerData.status || "UNKNOWN";
    const hasVIX = tickerData.vix !== undefined && tickerData.vix !== null;
    const hasPutCallRatio = tickerData.put_call_ratio !== undefined && tickerData.put_call_ratio !== null;
    
    if (status === "PENDING") {
      return {
        test_name: "P5_DAILY_衍生品數據",
        status: "WARNING",
        message: "衍生品數據收集函數尚未完全實作（狀態：PENDING）",
        has_data: hasData,
        status: status,
        note: "需要整合 OCC/CBOE/Nasdaq API 或使用 CSE 搜尋"
      };
    }
    
    return {
      test_name: "P5_DAILY_衍生品數據",
      status: "PASSED",
      message: "衍生品數據收集成功",
      has_data: hasData,
      has_vix: hasVIX,
      has_put_call_ratio: hasPutCallRatio
    };
  } catch (error) {
    Logger.log(`🔍 P5 Daily 衍生品數據測試失敗：error=${error.message}`);
    return {
      test_name: "P5_DAILY_衍生品數據",
      status: "FAILED",
      message: error.message
    };
  }
}

// ==========================================
// P5 Weekly 數據收集測試
// ==========================================

/**
 * 測試 P5 Weekly 數據收集
 */
function testP5WeeklyDataCollection() {
  const results = [];
  
  try {
    Logger.log("🔍 開始測試 P5 Weekly 數據收集");
    
    // 0. 測試 Institutional Sentiment（Yahoo Upgrades & Downgrades + impliedFPE）
    const instResult1 = testP5WeeklyInstitutionalSentiment("AAPL", "US");
    results.push(instResult1);
    
    const instResult2 = testP5WeeklyInstitutionalSentiment("2330", "TW");
    results.push(instResult2);
    
    const instResult3 = testP5WeeklyInstitutionalSentiment("7203", "JP");
    results.push(instResult3);
    
    // 1. 測試 FPE_B 數據收集（爬蟲 - Yahoo Finance）
    const fpeBResult1 = testP5WeeklyFPE_B("AAPL", "US");
    results.push(fpeBResult1);
    
    const fpeBResult2 = testP5WeeklyFPE_B("2330", "TW");
    results.push(fpeBResult2);
    
    const fpeBResult3 = testP5WeeklyFPE_B("7203", "JP");
    results.push(fpeBResult3);
    
    // 2. 測試 Sector ETF Flow（CSE）
    const etfResult = testP5WeeklySectorETF();
    results.push(etfResult);
    
    // ⭐ V8.9 新增：測試機構評級資料庫讀取
    const dbResult1 = testP5WeeklyInstitutionalRatingsFromDatabase("AAPL", "US");
    results.push(dbResult1);
    const dbResult2 = testP5WeeklyInstitutionalRatingsFromDatabase("2330", "TW");
    results.push(dbResult2);
    
    // ⭐ V8.9 新增：測試新聞品質
    const newsQualityResult = testP5NewsQuality();
    results.push(newsQualityResult);
    
  } catch (error) {
    Logger.log(`🔍 P5 Weekly 數據收集測試失敗：${error.message}`);
    results.push({
      test_name: "P5_WEEKLY_數據收集",
      status: "FAILED",
      error: error.message
    });
  }
  
  return results;
}

/**
 * ⭐ V8.9 新增：測試從資料庫讀取機構評級
 */
function testP5WeeklyInstitutionalRatingsFromDatabase(ticker, market) {
  try {
    Logger.log(`🔍 測試從資料庫讀取機構評級：ticker=${ticker}, market=${market}`);
    
    if (typeof getInstitutionalRatingsFromDatabase !== "function") {
      return {
        test_name: `P5_WEEKLY_INSTITUTIONAL_RATINGS_DB_${ticker}`,
        status: "FAILED",
        message: "getInstitutionalRatingsFromDatabase 未定義（請確認 src/24_P5_WEEKLY_SENTIMENT.js 已載入）",
        ticker: ticker,
        market: market
      };
    }
    
    const ratings = getInstitutionalRatingsFromDatabase(ticker, market, 1);
    
    if (!ratings || ratings.length === 0) {
      return {
        test_name: `P5_WEEKLY_INSTITUTIONAL_RATINGS_DB_${ticker}`,
        status: "WARNING",
        message: "資料庫中無機構評級資料（可能需要先執行 P5 Daily 收集）",
        ticker: ticker,
        market: market,
        ratings_count: 0
      };
    }
    
    return {
      test_name: `P5_WEEKLY_INSTITUTIONAL_RATINGS_DB_${ticker}`,
      status: "PASSED",
      message: `從資料庫讀取成功（${ratings.length} 筆）`,
      ticker: ticker,
      market: market,
      ratings_count: ratings.length,
      sample_rating: ratings[0] || null
    };
  } catch (error) {
    Logger.log(`🔍 測試從資料庫讀取機構評級失敗：ticker=${ticker}, error=${error.message}`);
    return {
      test_name: `P5_WEEKLY_INSTITUTIONAL_RATINGS_DB_${ticker}`,
      status: "FAILED",
      message: error.message,
      ticker: ticker,
      market: market
    };
  }
}

/**
 * ⭐ V8.9 新增：測試 P5 新聞品質（時效性、範圍精準性、雜訊過濾、可驗證性）
 */
function testP5NewsQuality() {
  try {
    Logger.log("🔍 測試 P5 新聞品質（V8.9）");
    
    if (typeof testAllP5NewsQuality !== "function") {
      return {
        test_name: "P5_新聞品質測試",
        status: "FAILED",
        message: "testAllP5NewsQuality 未定義（請確認 src/24_P5_NEWS_QUALITY_TEST.js 已載入）"
      };
    }
    
    const today = new Date();
    const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    const result = testAllP5NewsQuality({ date: dateStr });
    
    if (result.error) {
      return {
        test_name: "P5_新聞品質測試",
        status: "FAILED",
        message: result.error
      };
    }
    
    const totalNews = result.summary.total_news || 0;
    const totalPassed = result.summary.total_passed || 0;
    const totalFailed = result.summary.total_failed || 0;
    const totalWarnings = result.summary.total_warnings || 0;
    const passRate = result.summary.pass_rate || "0%";
    
    // ⭐ V8.9 新增：輸出詳細的失敗原因
    let failedDetails = [];
    let warningDetails = [];
    
    if (result.general_news && result.general_news.details) {
      for (const detail of result.general_news.details) {
        if (detail.overall_status === "FAILED") {
          const failures = [];
          for (const [testName, testResult] of Object.entries(detail.tests)) {
            if (!testResult.passed && !testResult.warning) {
              failures.push(`${testName}: ${testResult.message || "未通過"}`);
            }
          }
          failedDetails.push({
            title: detail.title.substring(0, 50),
            source: detail.source || "未知",
            failures: failures
          });
        } else if (detail.overall_status === "WARNING") {
          const warnings = [];
          for (const [testName, testResult] of Object.entries(detail.tests)) {
            if (testResult.warning) {
              warnings.push(`${testName}: ${testResult.message || "警告"}`);
            }
          }
          warningDetails.push({
            title: detail.title.substring(0, 50),
            source: detail.source || "未知",
            warnings: warnings
          });
        }
      }
    }
    
    if (totalNews === 0) {
      return {
        test_name: "P5_新聞品質測試",
        status: "WARNING",
        message: "當天無新聞資料（可能需要先執行 P5 Daily 收集）",
        total_news: 0
      };
    }
    
    if (totalPassed === totalNews) {
      return {
        test_name: "P5_新聞品質測試",
        status: "PASSED",
        message: `新聞品質測試通過（${totalPassed}/${totalNews}，通過率 ${passRate}）`,
        total_news: totalNews,
        total_passed: totalPassed,
        total_failed: totalFailed,
        total_warnings: totalWarnings,
        pass_rate: passRate,
        general_news: result.general_news ? {
          total: result.general_news.total,
          passed: result.general_news.passed,
          failed: result.general_news.failed,
          warnings: result.general_news.warnings
        } : null,
        institutional_ratings: result.institutional_ratings ? {
          total: result.institutional_ratings.total,
          passed: result.institutional_ratings.passed,
          failed: result.institutional_ratings.failed,
          warnings: result.institutional_ratings.warnings
        } : null
      };
    } else if (totalPassed >= totalNews * 0.8) {
      return {
        test_name: "P5_新聞品質測試",
        status: "WARNING",
        message: `新聞品質測試部分通過（${totalPassed}/${totalNews}，通過率 ${passRate}，目標 > 80%）`,
        total_news: totalNews,
        total_passed: totalPassed,
        total_failed: totalFailed,
        total_warnings: totalWarnings,
        pass_rate: passRate
      };
    } else {
      // 構建失敗詳情訊息
      let failureMessage = `新聞品質測試失敗（${totalPassed}/${totalNews}，通過率 ${passRate}，目標 > 80%）`;
      if (failedDetails.length > 0) {
        failureMessage += "\n失敗原因：\n";
        for (let i = 0; i < Math.min(failedDetails.length, 3); i++) {
          const detail = failedDetails[i];
          failureMessage += `  ${i + 1}. ${detail.title} (${detail.source})\n`;
          detail.failures.forEach(f => {
            failureMessage += `     - ${f}\n`;
          });
        }
        if (failedDetails.length > 3) {
          failureMessage += `  ... 還有 ${failedDetails.length - 3} 筆失敗新聞\n`;
        }
      }
      if (warningDetails.length > 0) {
        failureMessage += "\n警告：\n";
        for (let i = 0; i < Math.min(warningDetails.length, 2); i++) {
          const detail = warningDetails[i];
          failureMessage += `  ${i + 1}. ${detail.title} (${detail.source})\n`;
          detail.warnings.forEach(w => {
            failureMessage += `     - ${w}\n`;
          });
        }
      }
      
      return {
        test_name: "P5_新聞品質測試",
        status: "FAILED",
        message: failureMessage,
        total_news: totalNews,
        total_passed: totalPassed,
        total_failed: totalFailed,
        total_warnings: totalWarnings,
        pass_rate: passRate,
        failed_details: failedDetails,
        warning_details: warningDetails
      };
    }
  } catch (error) {
    Logger.log(`🔍 測試 P5 新聞品質失敗：error=${error.message}`);
    Logger.log(`🔍 錯誤堆疊：${error.stack}`);
    Logger.log(`🔍 P5 新聞品質測試失敗：${error.message}`);
    return {
      test_name: "P5_新聞品質測試",
      status: "FAILED",
      message: error.message
    };
  }
}

/**
 * 測試 P5 Weekly Institutional Sentiment（Yahoo Upgrades/Downgrades）
 */
function testP5WeeklyInstitutionalSentiment(ticker, market) {
  try {
    Logger.log(`🔍 測試 P5 Weekly Institutional Sentiment：ticker=${ticker}, market=${market}`);

    // 構建 Yahoo Finance ticker
    let yahooTicker = ticker;
    if (market === "TW" || market === "Taiwan") {
      yahooTicker = `${ticker}.TW`;
    } else if (market === "JP" || market === "Japan") {
      yahooTicker = `${ticker}.T`;
    }

    if (typeof getInstitutionalSentimentFromYahoo !== "function") {
      return {
        test_name: `P5_WEEKLY_INSTITUTIONAL_SENTIMENT_${ticker}`,
        status: "FAILED",
        message: "getInstitutionalSentimentFromYahoo 未定義（請確認 src/24_P5_WEEKLY_SENTIMENT.js 已載入）",
        ticker: ticker,
        market: market,
        yahoo_ticker: yahooTicker
      };
    }

    const data = getInstitutionalSentimentFromYahoo(yahooTicker, market);

    if (!data) {
      return {
        test_name: `P5_WEEKLY_INSTITUTIONAL_SENTIMENT_${ticker}`,
        status: "WARNING",
        message: "無法獲取 Institutional Sentiment（可能被 Yahoo 擋、或該標的沒有覆蓋）",
        ticker: ticker,
        market: market,
        yahoo_ticker: yahooTicker
      };
    }

    const actionsCount = Array.isArray(data.actions) ? data.actions.length : 0;
    const hasForwardEPS = typeof data.consensus_forward_eps === "number" && data.consensus_forward_eps > 0;

    // 支援度：不是每檔都有 actions（尤其非美股），所以 actions=0 先給 WARNING，不當作整體管線失敗
    if (!hasForwardEPS && actionsCount === 0) {
      return {
        test_name: `P5_WEEKLY_INSTITUTIONAL_SENTIMENT_${ticker}`,
        status: "WARNING",
        message: "成功呼叫，但缺少 forward EPS 且 actions 為空（可能無分析師覆蓋）",
        ticker: ticker,
        market: market,
        yahoo_ticker: yahooTicker,
        actions_count: actionsCount
      };
    }

    if (actionsCount === 0) {
      return {
        test_name: `P5_WEEKLY_INSTITUTIONAL_SENTIMENT_${ticker}`,
        status: "WARNING",
        message: "成功呼叫，但 actions 為空（該標的可能沒有 Upgrade/Downgrade 記錄）",
        ticker: ticker,
        market: market,
        yahoo_ticker: yahooTicker,
        forward_eps: data.consensus_forward_eps,
        forward_eps_period: data.consensus_forward_eps_period,
        actions_count: actionsCount
      };
    }

    return {
      test_name: `P5_WEEKLY_INSTITUTIONAL_SENTIMENT_${ticker}`,
      status: "PASSED",
      message: `Institutional Sentiment 抓取成功（actions=${actionsCount}，sentiment=${data.sentiment_label || "N/A"}）`,
      ticker: ticker,
      market: market,
      yahoo_ticker: yahooTicker,
      forward_eps: data.consensus_forward_eps,
      forward_eps_period: data.consensus_forward_eps_period,
      sentiment_score: data.sentiment_score,
      sentiment_label: data.sentiment_label,
      warnings: data.warnings, // V8.6 新增：誘多/誘空警告
      actions_count: actionsCount,
      sample_action: data.actions && data.actions[0] ? data.actions[0] : null
    };
  } catch (error) {
    Logger.log(`🔍 P5 Weekly Institutional Sentiment 測試失敗：ticker=${ticker}, error=${error.message}`);
    return {
      test_name: `P5_WEEKLY_INSTITUTIONAL_SENTIMENT_${ticker}`,
      status: "FAILED",
      message: error.message,
      ticker: ticker,
      market: market
    };
  }
}

/**
 * 測試 P5 Weekly FPE_B 數據收集
 */
function testP5WeeklyFPE_B(ticker, market) {
  try {
    Logger.log(`🔍 測試 P5 Weekly FPE_B：ticker=${ticker}, market=${market}`);
    
    // 構建 Yahoo Finance ticker
    let yahooTicker = ticker;
    if (market === "TW" || market === "Taiwan") {
      yahooTicker = `${ticker}.TW`;
    } else if (market === "JP" || market === "Japan") {
      yahooTicker = `${ticker}.T`;
    }
    
    // 調用 P5 Weekly 的 FPE_B 收集函數（直接調用 getFPE_B_FromYahooFinance）
    const fpeB = getFPE_B_FromYahooFinance(yahooTicker);
    
    if (fpeB === null || fpeB === undefined) {
      return {
        test_name: `P5_WEEKLY_FPE_B_${ticker}`,
        status: "WARNING",
        message: "無法獲取 FPE_B 數據（可能是 Yahoo Finance HTTP 503 錯誤，或沒有分析師覆蓋）",
        ticker: ticker,
        market: market,
        yahoo_ticker: yahooTicker,
        note: "Yahoo Finance 可能阻擋爬蟲請求（HTTP 503），需要添加重試機制或更好的 User-Agent"
      };
    }
    
    // 檢查 FPE_B 值是否合理
    if (fpeB <= 0 || fpeB > 1000) {
      return {
        test_name: `P5_WEEKLY_FPE_B_${ticker}`,
        status: "WARNING",
        message: `FPE_B 值異常（${fpeB}），可能解析錯誤`,
        ticker: ticker,
        market: market,
        yahoo_ticker: yahooTicker,
        fpe_b: fpeB
      };
    }
    
    return {
      test_name: `P5_WEEKLY_FPE_B_${ticker}`,
      status: "PASSED",
      message: "FPE_B 數據收集成功",
      ticker: ticker,
      market: market,
      yahoo_ticker: yahooTicker,
      fpe_b: fpeB
    };
  } catch (error) {
    Logger.log(`🔍 P5 Weekly FPE_B 測試失敗：ticker=${ticker}, error=${error.message}`);
    return {
      test_name: `P5_WEEKLY_FPE_B_${ticker}`,
      status: "FAILED",
      message: error.message,
      ticker: ticker,
      market: market
    };
  }
}

/**
 * 測試 P5 Weekly Sector ETF Flow
 */
function testP5WeeklySectorETF() {
  try {
    Logger.log("🔍 測試 P5 Weekly Sector ETF Flow");
    
    // 調用實際的 Sector ETF 數據收集函數
    // collectSectorETFData 收集標準美股板塊 ETF 數據（SPDR Sector ETFs）
    const sectorETFData = collectSectorETFData();
    
    if (!sectorETFData || Object.keys(sectorETFData).length === 0) {
      return {
        test_name: "P5_WEEKLY_Sector_ETF_Flow",
        status: "WARNING",
        message: "Sector ETF 數據收集結果為空（可能是 stooq.com 獲取失敗）",
        note: "Sector ETF 數據從 stooq.com 獲取（通過 Cloud Function 代理）"
      };
    }
    
    // 檢查成功收集的 ETF 數量
    const successCount = Object.keys(sectorETFData).filter(k => 
      sectorETFData[k].status === "COMPLETED"
    ).length;
    const totalCount = Object.keys(sectorETFData).length;
    
    if (successCount === 0) {
      return {
        test_name: "P5_WEEKLY_Sector_ETF_Flow",
        status: "WARNING",
        message: "所有 Sector ETF 數據都無法獲取（可能是 Cloud Function 代理問題）",
        total_count: totalCount,
        success_count: successCount
      };
    }
    
    if (successCount < totalCount * 0.5) {
      return {
        test_name: "P5_WEEKLY_Sector_ETF_Flow",
        status: "WARNING",
        message: `部分 Sector ETF 數據無法獲取（成功：${successCount}/${totalCount}）`,
        total_count: totalCount,
        success_count: successCount
      };
    }
    
    return {
      test_name: "P5_WEEKLY_Sector_ETF_Flow",
      status: "PASSED",
      message: `Sector ETF 數據收集成功（${successCount}/${totalCount} 個）`,
      total_count: totalCount,
      success_count: successCount
    };
  } catch (error) {
    Logger.log(`🔍 P5 Weekly Sector ETF Flow 測試失敗：error=${error.message}`);
    return {
      test_name: "P5_WEEKLY_Sector_ETF_Flow",
      status: "FAILED",
      message: error.message
    };
  }
}
