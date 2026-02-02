/**
 * 📈 P3: 技術分析 - 數據收集模組
 * 
 * 負責從外部權威數據源收集技術指標
 * 優先使用外部計算好的指標，不自己計算
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// 外部技術數據收集（優先使用權威數據源）
// ==========================================

/**
 * 從外部權威數據源收集技術指標（優先使用，不自己計算）
 * ⭐ 所有數據都由程式從白名單數據源獲取，不讓 AI 自己去找
 * 
 * @param {Array} phase2Output - P2 輸出數據
 * @returns {Object} technicalData - 技術指標數據（包含歷史 OHLCV 數據）
 */
function collectTechnicalDataFromExternalSources(phase2Output) {
  const technicalData = {};
  
  for (const output of phase2Output) {
    const ticker = output.company_code || output.ticker;
    const market = output.market || "US";
    
    if (!ticker) continue;
    
    try {
      // ========================================
      // Step 1: 讀取技術指標（由 P5 Daily 收集）
      // ========================================
      
      // 優先從 MARKET_INDICATORS_DAILY 表格讀取（由 P5 Daily 收集）
      let data = getTechnicalIndicatorsFromSheet(ticker);
      
      // 如果表格沒有數據，嘗試從外部數據源獲取
      if (!data || !data.rsi_14) {
        data = fetchTechnicalIndicatorsFromExternalSource(ticker, market);
      }
      
      // ========================================
      // Step 2: 讀取歷史 OHLCV 數據（由 P5 Daily 收集）
      // ⭐ 優先從 MARKET_OHLCV_DAILY 表格讀取（已持倉個股可以使用留存的資料）
      // ⭐ 如果數據不足，自動從 stooq.com 補充（通過 Cloud Function 代理，使用白名單）
      // ========================================
      
      let historicalOHLCV = null;
      try {
        // 獲取最近 240 天的歷史 OHLCV 數據（用於技術分析）
        // getHistoricalOHLCV 函數會：
        // 1. 優先從 MARKET_OHLCV_DAILY 表格讀取已保存的數據
        // 2. 如果數據不足，自動從 stooq.com 補充（通過 Cloud Function 代理）
        // 3. 合併數據（去重，保留表格中的最新數據）
        historicalOHLCV = getHistoricalOHLCV(ticker, 240, true);
        
        if (historicalOHLCV && historicalOHLCV.length > 0) {
          Logger.log(`P3：成功獲取 ${ticker} 歷史 OHLCV 數據（${historicalOHLCV.length} 天）`);
        } else {
          Logger.log(`P3：${ticker} 歷史 OHLCV 數據為空`);
        }
      } catch (ohlcvError) {
        Logger.log(`P3：獲取 ${ticker} 歷史 OHLCV 數據失敗：${ohlcvError.message}`);
        historicalOHLCV = null;
      }
      
      // ========================================
      // Step 3: ⭐ 工程師修復：獲取週線 OHLCV 數據（用於趨勢位階檢查）
      // ========================================
      
      let weeklyOHLCV = null;
      try {
        // 獲取最近 52 週的週線數據（用於趨勢位階檢查）
        // ⚠️ 重要：週線數據是判斷「週線結構否決權」的基礎，不能缺失
        weeklyOHLCV = fetchWeeklyOHLCV(ticker, market, 52);
        
        if (weeklyOHLCV && weeklyOHLCV.length > 0) {
          Logger.log(`P3：成功獲取 ${ticker} 週線 OHLCV 數據（${weeklyOHLCV.length} 週）`);
        } else {
          Logger.log(`P3：${ticker} 週線 OHLCV 數據為空（將在 Prompt 中標註數據不足）`);
        }
      } catch (weeklyError) {
        Logger.log(`P3：獲取 ${ticker} 週線 OHLCV 數據失敗：${weeklyError.message}`);
        weeklyOHLCV = null;
      }
      
      // ========================================
      // Step 4: ⭐ V8.18 新增：計算相對強度（Relative Strength）
      // ========================================
      
      let relativeStrength = null;
      try {
        // 計算 RS = Stock % Change - Index % Change
        // 使用最近 N 天的數據（建議 5-20 天，根據市場狀況）
        const nDays = 10;  // 使用最近 10 天的數據
        if (historicalOHLCV && historicalOHLCV.length >= nDays) {
          const stockData = historicalOHLCV.slice(-nDays);
          const stockStartPrice = stockData[0].close;
          const stockEndPrice = stockData[stockData.length - 1].close;
          const stockChange = (stockEndPrice - stockStartPrice) / stockStartPrice;
          
          // 獲取大盤指數數據（SPX for US, TAIEX for TW, NIKKEI for JP）
          const indexTicker = market === "US" ? "SPX" : (market === "TW" ? "TAIEX" : "NIKKEI");
          const indexOHLCV = getHistoricalOHLCV(indexTicker, nDays, true);
          
          if (indexOHLCV && indexOHLCV.length >= nDays) {
            const indexData = indexOHLCV.slice(-nDays);
            const indexStartPrice = indexData[0].close;
            const indexEndPrice = indexData[indexData.length - 1].close;
            const indexChange = (indexEndPrice - indexStartPrice) / indexStartPrice;
            
            // 計算 RS
            const rs = stockChange - indexChange;
            
            relativeStrength = {
              period_days: nDays,
              stock_change: stockChange,
              index_change: indexChange,
              index_ticker: indexTicker,
              relative_strength: rs,
              calculated_at: new Date().toISOString()
            };
            
            Logger.log(`P3：計算 ${ticker} 相對強度：RS = ${(rs * 100).toFixed(2)}% (Stock: ${(stockChange * 100).toFixed(2)}%, Index: ${(indexChange * 100).toFixed(2)}%)`);
          } else {
            Logger.log(`P3：無法獲取 ${indexTicker} 指數數據，跳過相對強度計算`);
          }
        } else {
          Logger.log(`P3：${ticker} 歷史 OHLCV 數據不足（需要至少 ${nDays} 天），跳過相對強度計算`);
        }
      } catch (rsError) {
        Logger.log(`P3：計算 ${ticker} 相對強度失敗：${rsError.message}}`);
      }
      
      // ========================================
      // Step 5: ⭐ V8.19 M1 新增：計算週線技術指標
      // ========================================
      
      let weeklyIndicators = null;
      if (weeklyOHLCV && weeklyOHLCV.length >= 20) {
        try {
          weeklyIndicators = calculateWeeklyIndicators(weeklyOHLCV);
          if (weeklyIndicators) {
            Logger.log(`P3：成功計算 ${ticker} 週線技術指標（MA20=${weeklyIndicators.ma20 ? weeklyIndicators.ma20.toFixed(2) : "N/A"}, RSI=${weeklyIndicators.rsi ? weeklyIndicators.rsi.toFixed(2) : "N/A"}）`);
          }
        } catch (wiError) {
          Logger.log(`P3：計算 ${ticker} 週線技術指標失敗：${wiError.message}`);
        }
      }
      
      // ========================================
      // Step 6: 組合技術數據
      // ========================================
      
      technicalData[ticker] = {
        ticker: ticker,
        market: market,
        data_source: data ? data.source : "NONE",
        indicators: data ? data.indicators : null,
        historical_ohlcv: historicalOHLCV,  // ⭐ 歷史日線 OHLCV 數據（用於日線分析）
        weekly_ohlcv: weeklyOHLCV,  // ⭐ 工程師修復：週線 OHLCV 數據（用於趨勢位階檢查）
        weekly_indicators: weeklyIndicators,  // ⭐ V8.19 M1 新增：週線技術指標（MA20/50/200, RSI, MACD）
        relative_strength: relativeStrength,  // ⭐ V8.18 新增：相對強度數據
        last_updated: data ? data.last_updated : null,
        // 保留舊的 ohlcv 欄位（向後兼容）
        ohlcv: historicalOHLCV && historicalOHLCV.length > 0 ? historicalOHLCV[historicalOHLCV.length - 1] : null
      };
      
    } catch (error) {
      Logger.log(`P3：收集 ${ticker} 技術數據失敗：${error.message}`);
      technicalData[ticker] = {
        ticker: ticker,
        market: market,
        data_source: "ERROR",
        error: error.message
      };
    }
  }
  
  return technicalData;
}

/**
 * 從表格讀取技術指標（由 P5 Daily 收集）
 * 
 * @param {string} ticker - 股票代碼
 * @returns {Object|null} - 技術指標數據或 null
 */
function getTechnicalIndicatorsFromSheet(ticker) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const dateCol = headers.indexOf("date");
    
    if (tickerCol === -1 || dateCol === -1) {
      return null;
    }
    
    // 找到該 ticker 的最新數據
    let latestRow = null;
    let latestDate = null;
    
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rows[i][tickerCol] === ticker) {
        const rowDate = rows[i][dateCol];
        if (!latestDate || rowDate > latestDate) {
          latestDate = rowDate;
          latestRow = rows[i];
        }
      }
    }
    
    if (!latestRow) {
      return null;
    }
    
    // 解析技術指標
    const indicators = {};
    headers.forEach((header, colIndex) => {
      if (header !== "ticker" && header !== "date" && header !== "created_at") {
        indicators[header] = latestRow[colIndex];
      }
    });
    
    return {
      source: "MARKET_INDICATORS_DAILY",
      indicators: indicators,
      date: latestDate,
      last_updated: latestDate
    };
    
  } catch (error) {
    Logger.log(`從表格讀取技術指標失敗：${error.message}`);
    return null;
  }
}

/**
 * 從外部數據源獲取技術指標（stooq.com 等權威數據源）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場（US/TW/JP）
 * @returns {Object|null} - 技術指標數據或 null
 */
function fetchTechnicalIndicatorsFromExternalSource(ticker, market) {
  try {
    // 優先使用外部計算好的指標，不自己計算
    // stooq.com 提供 OHLCV 數據，但技術指標需要從其他來源獲取
    
    // 方案 1：嘗試從 M0 CSE 搜尋獲取技術指標（如果配置了相關 CSE）
    // 方案 2：從其他權威數據源獲取（如 Yahoo Finance API、Alpha Vantage 等）
    // 方案 3：如果沒有外部計算好的指標，返回 OHLCV 數據，讓 AI 分析
    
    // 目前先返回 OHLCV 數據結構，供後續擴展
    // 注意：實際技術指標（RSI、MACD等）應該由 P5 Daily 收集並存儲在 MARKET_INDICATORS_DAILY 表格中
    
    Logger.log(`P3：嘗試從外部數據源獲取 ${ticker} 技術指標（市場：${market}）`);
    
    // 暫時返回 null，因為技術指標應該由 P5 Daily 收集
    // 如果 P5 Daily 沒有數據，說明系統尚未運行 P5 Daily，需要先運行 P5 Daily
    Logger.log(`P3：${ticker} 的技術指標應由 P5 Daily 收集，請先運行 P5 Daily`);
    
    return null;
  } catch (error) {
    Logger.log(`P3：從外部數據源獲取 ${ticker} 技術指標失敗：${error.message}`);
    return null;
  }
}

/**
 * ⭐ 工程師修復：獲取週線 OHLCV 數據（用於趨勢位階檢查）
 * 
 * 從日線數據聚合為週線數據，或從外部數據源獲取週線數據
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場（US/TW/JP）
 * @param {number} weeks - 需要多少週的數據（預設 52 週）
 * @returns {Array|null} - 週線 OHLCV 數據陣列，如果失敗則返回 null
 */
function fetchWeeklyOHLCV(ticker, market, weeks = 52) {
  try {
    // 方案 1：優先從日線數據聚合為週線數據
    // 需要足夠的日線數據（至少 weeks * 5 個交易日）
    const requiredDays = weeks * 5 + 10;  // 多取一些以確保有足夠數據
    const dailyData = getHistoricalOHLCV(ticker, requiredDays, true);
    
    if (dailyData && dailyData.length >= 5) {
      // 將日線數據聚合為週線數據
      const weeklyData = aggregateDailyToWeekly(dailyData, weeks);
      
      if (weeklyData && weeklyData.length > 0) {
        Logger.log(`P3：從日線數據聚合得到 ${ticker} 週線數據（${weeklyData.length} 週）`);
        return weeklyData;
      }
    }
    
    // 方案 2：如果日線數據不足，嘗試從外部數據源獲取週線數據
    // 注意：stooq.com 支持週線數據（在 URL 中添加 &f=w）
    Logger.log(`P3：日線數據不足，嘗試從外部數據源獲取 ${ticker} 週線數據`);
    
    // 暫時返回 null，標記為數據不足
    // 未來可以擴展：從 stooq.com 直接獲取週線數據（需要修改 Cloud Function）
    return null;
    
  } catch (error) {
    Logger.log(`P3：獲取 ${ticker} 週線 OHLCV 數據失敗：${error.message}`);
    return null;
  }
}

/**
 * ⭐ 工程師修復：將日線數據聚合為週線數據
 * 
 * @param {Array} dailyData - 日線 OHLCV 數據（按日期升序）
 * @param {number} maxWeeks - 最多返回多少週的數據
 * @returns {Array} - 週線 OHLCV 數據陣列
 */
function aggregateDailyToWeekly(dailyData, maxWeeks = 52) {
  if (!dailyData || dailyData.length < 5) {
    return [];
  }
  
  const weeklyData = [];
  const weekMap = new Map();  // key: "YYYY-WW" (年-週數)
  
  // 將日線數據按週分組
  for (const day of dailyData) {
    const date = day.date instanceof Date ? day.date : new Date(day.date);
    const year = date.getFullYear();
    const weekNumber = getWeekNumber(date);
    const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        week: weekKey,
        date: date,  // 使用該週的第一個交易日作為週日期
        open: day.open,
        high: day.high,
        low: day.low,
        close: day.close,
        volume: day.volume,
        days: 1
      });
    } else {
      const weekData = weekMap.get(weekKey);
      // 週線數據：open = 週一開盤，high = 週內最高，low = 週內最低，close = 週五收盤，volume = 週內總量
      weekData.high = Math.max(weekData.high, day.high);
      weekData.low = Math.min(weekData.low, day.low);
      weekData.close = day.close;  // 更新為該週最後一個交易日的收盤價
      weekData.volume += day.volume;
      weekData.days += 1;
    }
  }
  
  // 轉換為陣列並按日期排序（從舊到新）
  for (const [weekKey, weekData] of weekMap) {
    weeklyData.push({
      date: weekData.date,
      week: weekKey,
      open: weekData.open,
      high: weekData.high,
      low: weekData.low,
      close: weekData.close,
      volume: weekData.volume,
      trading_days: weekData.days
    });
  }
  
  // 按日期排序（從舊到新）
  weeklyData.sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
    const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
    return dateA - dateB;
  });
  
  // 返回最近 maxWeeks 週的數據
  return weeklyData.slice(-maxWeeks);
}

/**
 * 計算週線技術指標（MA20/50/200、RSI、MACD）⭐ V8.19 M1 新增
 * 
 * @param {Array} weeklyOHLCV - 週線 OHLCV 數據
 * @returns {Object} weeklyIndicators - 週線技術指標
 */
function calculateWeeklyIndicators(weeklyOHLCV) {
  if (!weeklyOHLCV || weeklyOHLCV.length < 20) {
    Logger.log("P3：週線數據不足，無法計算技術指標（需要至少 20 週）");
    return null;
  }
  
  const indicators = {
    ma20: null,
    ma50: null,
    ma200: null,
    rsi: null,
    macd: null,
    current_price: weeklyOHLCV[weeklyOHLCV.length - 1].close
  };
  
  // 計算移動平均線
  if (weeklyOHLCV.length >= 20) {
    const closes = weeklyOHLCV.map(w => w.close);
    indicators.ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  }
  if (weeklyOHLCV.length >= 50) {
    const closes = weeklyOHLCV.map(w => w.close);
    indicators.ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
  }
  if (weeklyOHLCV.length >= 200) {
    const closes = weeklyOHLCV.map(w => w.close);
    indicators.ma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
  }
  
  // 計算 RSI（14 週）
  if (weeklyOHLCV.length >= 15) {
    indicators.rsi = calculateRSI(weeklyOHLCV.slice(-15), 14);
  }
  
  // 計算 MACD（12, 26, 9）
  if (weeklyOHLCV.length >= 35) {
    indicators.macd = calculateMACD(weeklyOHLCV.slice(-35), 12, 26, 9);
  }
  
  return indicators;
}

/**
 * 計算 RSI（相對強弱指標）
 */
function calculateRSI(weeklyData, period = 14) {
  if (weeklyData.length < period + 1) return null;
  
  const closes = weeklyData.map(w => w.close);
  const gains = [];
  const losses = [];
  
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * 計算 MACD（移動平均收斂發散指標）
 */
function calculateMACD(weeklyData, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (weeklyData.length < slowPeriod + signalPeriod) return null;
  
  const closes = weeklyData.map(w => w.close);
  
  // 計算 EMA
  const emaFast = calculateEMA(closes, fastPeriod);
  const emaSlow = calculateEMA(closes, slowPeriod);
  
  // MACD 線 = EMA(12) - EMA(26)
  const macdLine = emaFast[emaFast.length - 1] - emaSlow[emaSlow.length - 1];
  
  // 信號線 = EMA(9) of MACD Line
  const macdValues = [];
  for (let i = slowPeriod - fastPeriod; i < emaFast.length; i++) {
    if (i >= 0 && i < emaSlow.length) {
      macdValues.push(emaFast[i] - emaSlow[i]);
    }
  }
  
  const signalLine = macdValues.length >= signalPeriod ? 
    calculateEMA(macdValues, signalPeriod)[calculateEMA(macdValues, signalPeriod).length - 1] : null;
  
  // 柱狀圖 = MACD 線 - 信號線
  const histogram = signalLine !== null ? macdLine - signalLine : null;
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram
  };
}

/**
 * 計算 EMA（指數移動平均）
 */
function calculateEMA(data, period) {
  const multiplier = 2 / (period + 1);
  const ema = [data[0]];
  
  for (let i = 1; i < data.length; i++) {
    ema.push((data[i] - ema[i - 1]) * multiplier + ema[i - 1]);
  }
  
  return ema;
}
