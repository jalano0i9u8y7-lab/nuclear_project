/**
 * 📊 P5 Weekly: 機構級籌碼面數據收集（每週）
 * 
 * ⭐ V8.0 新增：調整籌碼數據收集頻率
 * - 內部人交易：每週收集（SEC Form 4）
 * - Dark Pool 活動：每週收集（僅持倉 10-20 檔）
 * - 13F 持倉：季度收集（配合 P2.5 Quarterly）
 * 
 * @version SSOT V8.0
 * @date 2025-01-14
 */

// ==========================================
// P5 Weekly 籌碼面數據收集
// ==========================================

/**
 * 收集本週機構級籌碼面數據
 * 
 * @param {Object} params - 參數
 * @param {Array} params.holdings - 持倉股票列表（用於 Dark Pool 收集）
 * @param {string} params.trigger - 觸發來源（WEEKLY / MANUAL）
 * @returns {Object} smartMoneyData - 籌碼面數據
 */
function collectSmartMoneyDataWeekly(params) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P5 Weekly：開始收集本週機構級籌碼面數據`);
    
    const holdings = params.holdings || getHoldingsTickers();
    const weekStart = getWeekStartDate();
    const weekEnd = getWeekEndDate();
    
    const smartMoneyData = {
      week_start_date: weekStart,
      week_end_date: weekEnd,
      insider_trading: {},
      dark_pool_activity: {},
      f13f_holdings: {},  // 僅在季度時收集
      summary: {
        total_insider_signals: 0,
        total_dark_pool_signals: 0,
        most_active_tickers: []
      }
    };
    
    // ========================================
    // Step 1: 收集內部人交易（每週）⭐ V8.0 修正
    // ========================================
    
    Logger.log(`P5 Weekly：開始收集本週內部人交易（${holdings.length} 檔持倉）`);
    
    try {
      const insiderData = collectInsiderTradingWeekly(holdings, weekStart, weekEnd);
      smartMoneyData.insider_trading = insiderData;
      smartMoneyData.summary.total_insider_signals = Object.keys(insiderData).length;
      Logger.log(`P5 Weekly：收集到 ${Object.keys(insiderData).length} 筆內部人交易數據`);
    } catch (error) {
      Logger.log(`P5 Weekly：內部人交易收集失敗：${error.message}`);
    }
    
    // ========================================
    // Step 2: 收集 Dark Pool 活動（每週，僅持倉）⭐ V8.0 修正
    // ========================================
    
    Logger.log(`P5 Weekly：開始收集本週 Dark Pool 活動（僅持倉 ${holdings.length} 檔）`);
    
    try {
      const darkPoolData = collectDarkPoolActivityWeekly(holdings, weekStart, weekEnd);
      smartMoneyData.dark_pool_activity = darkPoolData;
      smartMoneyData.summary.total_dark_pool_signals = Object.keys(darkPoolData).length;
      Logger.log(`P5 Weekly：收集到 ${Object.keys(darkPoolData).length} 筆 Dark Pool 活動數據`);
    } catch (error) {
      Logger.log(`P5 Weekly：Dark Pool 活動收集失敗：${error.message}`);
    }
    
    // ========================================
    // Step 3: 收集 13F 持倉（季度，僅在季度時收集）⭐ V8.0 修正
    // ========================================
    
    const isQuarterly = isQuarterlyPeriod();
    if (isQuarterly) {
      Logger.log(`P5 Weekly：季度期間，收集 13F 持倉數據`);
      try {
        const f13fData = collectF13FHoldingsQuarterly(holdings);
        smartMoneyData.f13f_holdings = f13fData;
        Logger.log(`P5 Weekly：收集到 ${Object.keys(f13fData).length} 筆 13F 持倉數據`);
      } catch (error) {
        Logger.log(`P5 Weekly：13F 持倉收集失敗：${error.message}`);
      }
    } else {
      Logger.log(`P5 Weekly：非季度期間，跳過 13F 持倉收集（節省 API 成本）`);
    }
    
    // ========================================
    // Step 4: 生成籌碼面信號
    // ========================================
    
    const smartMoneySignal = generateSmartMoneySignal(smartMoneyData);
    smartMoneyData.smart_money_signal = smartMoneySignal;
    
    // ========================================
    // Step 5: 保存到 SMART_MONEY_WEEKLY 表格
    // ========================================
    
    saveSmartMoneyWeeklyData(smartMoneyData);
    
    const duration = Date.now() - startTime;
    Logger.log(`P5 Weekly：籌碼面數據收集完成（耗時：${duration}ms，信號：${smartMoneySignal}）`);
    
    return smartMoneyData;
    
  } catch (error) {
    Logger.log(`P5 Weekly：籌碼面數據收集失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
    throw error;
  }
}

/**
 * 收集本週內部人交易（每週）
 * 
 * @param {Array} holdings - 持倉股票列表
 * @param {Date} weekStart - 週開始日期
 * @param {Date} weekEnd - 週結束日期
 * @returns {Object} insiderData - 內部人交易數據
 */
function collectInsiderTradingWeekly(holdings, weekStart, weekEnd) {
  const insiderData = {};
  
  Logger.log(`P5 Weekly：開始收集內部人交易（${holdings.length} 檔，期間：${weekStart.toISOString().split('T')[0]} 至 ${weekEnd.toISOString().split('T')[0]}）`);
  
  const jobId = `INSIDER_TRADING_WEEKLY_${Date.now()}`;
  
  for (const ticker of holdings) {
    try {
      const searchQuery = `${ticker} SEC Form 4 insider trading ${weekStart.toISOString().split('T')[0]} ${weekEnd.toISOString().split('T')[0]}`;
      
      const result = executeCSESearch(jobId, "CSE_SEARCH", {
        search_query: searchQuery,
        cse_type: "INSTITUTIONAL_DATA",
        max_results: 10,
        ticker: ticker,
        date_range: {
          start: weekStart,
          end: weekEnd
        }
      });
      
      if (result && result.output && result.output.search_results) {
        const parsed = parseInsiderTradingFromCSE(result.output.search_results, ticker);
        if (parsed && parsed.length > 0) {
          insiderData[ticker] = parsed;
        }
      }
      
      Utilities.sleep(500);  // 避免請求過快
    } catch (error) {
      Logger.log(`P5 Weekly：收集 ${ticker} 內部人交易失敗：${error.message}`);
    }
  }
  
  return insiderData;
}

/**
 * 收集本週 Dark Pool 活動（每週，僅持倉）
 * 
 * @param {Array} holdings - 持倉股票列表（10-20 檔）
 * @param {Date} weekStart - 週開始日期
 * @param {Date} weekEnd - 週結束日期
 * @returns {Object} darkPoolData - Dark Pool 活動數據
 */
function collectDarkPoolActivityWeekly(holdings, weekStart, weekEnd) {
  const darkPoolData = {};
  
  // 限制為持倉 10-20 檔（節省 API 成本）
  const limitedHoldings = holdings.slice(0, 20);
  
  Logger.log(`P5 Weekly：開始收集 Dark Pool 活動（${limitedHoldings.length} 檔持倉，期間：${weekStart.toISOString().split('T')[0]} 至 ${weekEnd.toISOString().split('T')[0]}）`);
  
  const jobId = `DARK_POOL_WEEKLY_${Date.now()}`;
  
  for (const ticker of limitedHoldings) {
    try {
      const searchQuery = `${ticker} FINRA ATS dark pool activity ${weekStart.toISOString().split('T')[0]} ${weekEnd.toISOString().split('T')[0]}`;
      
      const result = executeCSESearch(jobId, "CSE_SEARCH", {
        search_query: searchQuery,
        cse_type: "INSTITUTIONAL_DATA",
        max_results: 10,
        ticker: ticker,
        date_range: {
          start: weekStart,
          end: weekEnd
        }
      });
      
      if (result && result.output && result.output.search_results) {
        const parsed = parseDarkPoolActivityFromCSE(result.output.search_results, ticker);
        if (parsed) {
          darkPoolData[ticker] = parsed;
        }
      }
      
      Utilities.sleep(500);  // 避免請求過快
    } catch (error) {
      Logger.log(`P5 Weekly：收集 ${ticker} Dark Pool 活動失敗：${error.message}`);
    }
  }
  
  return darkPoolData;
}

/**
 * 收集 13F 持倉（季度）
 * 
 * @param {Array} holdings - 持倉股票列表
 * @returns {Object} f13fData - 13F 持倉數據
 */
function collectF13FHoldingsQuarterly(holdings) {
  const f13fData = {};
  
  Logger.log(`P5 Weekly：開始收集 13F 持倉（季度，${holdings.length} 檔）`);
  
  const jobId = `F13F_QUARTERLY_${Date.now()}`;
  const currentQuarter = getCurrentQuarter();
  
  for (const ticker of holdings) {
    try {
      const searchQuery = `${ticker} 13F filing institutional holdings Q${currentQuarter.quarter} ${currentQuarter.year}`;
      
      const result = executeCSESearch(jobId, "CSE_SEARCH", {
        search_query: searchQuery,
        cse_type: "INSTITUTIONAL_DATA",
        max_results: 10,
        ticker: ticker
      });
      
      if (result && result.output && result.output.search_results) {
        const parsed = parseF13FHoldingsFromCSE(result.output.search_results, ticker);
        if (parsed) {
          f13fData[ticker] = parsed;
        }
      }
      
      Utilities.sleep(500);  // 避免請求過快
    } catch (error) {
      Logger.log(`P5 Weekly：收集 ${ticker} 13F 持倉失敗：${error.message}`);
    }
  }
  
  return f13fData;
}

/**
 * 生成籌碼面信號
 * 
 * @param {Object} smartMoneyData - 籌碼面數據
 * @returns {string} signal - 籌碼面信號（BULLISH/NEUTRAL/BEARISH）
 */
function generateSmartMoneySignal(smartMoneyData) {
  let bullishCount = 0;
  let bearishCount = 0;
  
  // 分析內部人交易
  for (const ticker in smartMoneyData.insider_trading || {}) {
    const trades = smartMoneyData.insider_trading[ticker];
    if (Array.isArray(trades)) {
      for (const trade of trades) {
        if (trade.transaction_type === "BUY" || trade.transaction_type === "PURCHASE") {
          bullishCount++;
        } else if (trade.transaction_type === "SELL" || trade.transaction_type === "SALE") {
          bearishCount++;
        }
      }
    }
  }
  
  // 分析 Dark Pool 活動
  for (const ticker in smartMoneyData.dark_pool_activity || {}) {
    const activity = smartMoneyData.dark_pool_activity[ticker];
    if (activity && activity.volume_change) {
      if (activity.volume_change > 0.2) {  // 20% 以上增加
        bullishCount++;
      } else if (activity.volume_change < -0.2) {  // 20% 以上減少
        bearishCount++;
      }
    }
  }
  
  // 判斷信號
  const totalSignals = bullishCount + bearishCount;
  if (totalSignals === 0) {
    return "NEUTRAL";
  }
  
  const bullishRatio = bullishCount / totalSignals;
  
  if (bullishRatio >= 0.6) {
    return "BULLISH";
  } else if (bullishRatio <= 0.4) {
    return "BEARISH";
  } else {
    return "NEUTRAL";
  }
}

/**
 * 保存籌碼面數據到 SMART_MONEY_WEEKLY 表格
 * 
 * @param {Object} smartMoneyData - 籌碼面數據
 */
function saveSmartMoneyWeeklyData(smartMoneyData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("SMART_MONEY_WEEKLY");
    
    if (!sheet) {
      sheet = ss.insertSheet("SMART_MONEY_WEEKLY");
      sheet.appendRow(SMART_MONEY_WEEKLY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    // 為每個 ticker 創建一行
    const allTickers = new Set();
    
    // 收集所有 ticker
    for (const ticker in smartMoneyData.insider_trading || {}) {
      allTickers.add(ticker);
    }
    for (const ticker in smartMoneyData.dark_pool_activity || {}) {
      allTickers.add(ticker);
    }
    for (const ticker in smartMoneyData.f13f_holdings || {}) {
      allTickers.add(ticker);
    }
    
    for (const ticker of allTickers) {
      const row = [
        smartMoneyData.week_start_date,
        smartMoneyData.week_end_date,
        ticker,
        JSON.stringify(smartMoneyData.insider_trading[ticker] || []),
        JSON.stringify(smartMoneyData.dark_pool_activity[ticker] || {}),
        JSON.stringify(smartMoneyData.f13f_holdings[ticker] || {}),
        smartMoneyData.smart_money_signal,
        JSON.stringify(smartMoneyData.summary),
        new Date()
      ];
      
      sheet.appendRow(row);
    }
    
    Logger.log(`P5 Weekly：籌碼面數據已保存到 SMART_MONEY_WEEKLY（${allTickers.size} 檔）`);
  } catch (error) {
    Logger.log(`P5 Weekly：保存籌碼面數據失敗：${error.message}`);
  }
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 獲取本週開始日期
 * 
 * @returns {Date} weekStart - 本週開始日期（週一）
 */
function getWeekStartDate() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);  // 調整為週一開始
  const weekStart = new Date(today.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * 獲取本週結束日期
 * 
 * @returns {Date} weekEnd - 本週結束日期（週日）
 */
function getWeekEndDate() {
  const weekStart = getWeekStartDate();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * 判斷是否為季度期間
 * 
 * @returns {boolean} isQuarterly - 是否為季度期間
 */
function isQuarterlyPeriod() {
  const today = new Date();
  const month = today.getMonth() + 1;  // 1-12
  // 季度月份：3, 6, 9, 12
  return month === 3 || month === 6 || month === 9 || month === 12;
}

/**
 * 獲取當前季度
 * 
 * @returns {Object} quarter - 季度信息
 */
function getCurrentQuarter() {
  const today = new Date();
  const month = today.getMonth() + 1;  // 1-12
  const year = today.getFullYear();
  
  let quarter;
  if (month <= 3) {
    quarter = 1;
  } else if (month <= 6) {
    quarter = 2;
  } else if (month <= 9) {
    quarter = 3;
  } else {
    quarter = 4;
  }
  
  return { quarter, year };
}

/**
 * 從 CSE 搜尋結果解析內部人交易數據
 * 
 * @param {Array} searchResults - CSE 搜尋結果
 * @param {string} ticker - 股票代碼
 * @returns {Array} insiderTrades - 內部人交易列表
 */
function parseInsiderTradingFromCSE(searchResults, ticker) {
  const insiderTrades = [];
  
  for (const result of searchResults) {
    try {
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 檢查是否為 SEC Form 4
      if (link.includes("sec.gov") && (title.includes("Form 4") || snippet.includes("Form 4"))) {
        // 簡單解析（實際應該從 SEC EDGAR 解析詳細數據）
        const transactionType = (title + snippet).toLowerCase().includes("sale") ? "SELL" : "BUY";
        
        insiderTrades.push({
          ticker: ticker,
          form_type: "Form 4",
          transaction_type: transactionType,
          url: link,
          snippet: snippet,
          date: new Date(),
          source: "SEC EDGAR"
        });
      }
    } catch (error) {
      Logger.log(`解析內部人交易數據失敗：${error.message}`);
    }
  }
  
  return insiderTrades;
}

/**
 * 從 CSE 搜尋結果解析 Dark Pool 活動數據
 * 
 * @param {Array} searchResults - CSE 搜尋結果
 * @param {string} ticker - 股票代碼
 * @returns {Object} darkPoolActivity - Dark Pool 活動數據
 */
function parseDarkPoolActivityFromCSE(searchResults, ticker) {
  for (const result of searchResults) {
    try {
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 檢查是否為 FINRA ATS 數據
      if (link.includes("finra.org") || title.toLowerCase().includes("dark pool") || title.toLowerCase().includes("ats")) {
        // 簡單解析（實際應該從 FINRA ATS 數據源解析詳細數據）
        return {
          ticker: ticker,
          source: "FINRA ATS",
          url: link,
          snippet: snippet,
          volume_change: null,  // 需要從實際數據源解析
          date: new Date()
        };
      }
    } catch (error) {
      Logger.log(`解析 Dark Pool 活動數據失敗：${error.message}`);
    }
  }
  
  return null;
}

/**
 * 從 CSE 搜尋結果解析 13F 持倉數據
 * 
 * @param {Array} searchResults - CSE 搜尋結果
 * @param {string} ticker - 股票代碼
 * @returns {Object} f13fHoldings - 13F 持倉數據
 */
function parseF13FHoldingsFromCSE(searchResults, ticker) {
  for (const result of searchResults) {
    try {
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 檢查是否為 13F 文件
      if (link.includes("sec.gov") && (title.includes("13F") || snippet.includes("13F"))) {
        // 簡單解析（實際應該從 SEC EDGAR 解析詳細數據）
        return {
          ticker: ticker,
          form_type: "13F",
          url: link,
          snippet: snippet,
          date: new Date(),
          source: "SEC EDGAR"
        };
      }
    } catch (error) {
      Logger.log(`解析 13F 持倉數據失敗：${error.message}`);
    }
  }
  
  return null;
}
