/**
 * 📊 P5 Daily: OHLCV 數據收集 - TWSE/TPEX（台股）
 * 
 * 處理通過 TWSE/TPEX 官方 API 獲取台股 OHLCV 數據
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

/**
 * 通過 TWSE/TPEX 獲取台股 OHLCV 數據
 * 
 * @param {string} ticker - 台股代碼（例如 "2330"）
 * @returns {Object|null} ohlcvData - OHLCV 數據，如果失敗則返回 null
 */
function collectOHLCVDataViaTWSE(ticker) {
  try {
    Logger.log(`P5 Daily：開始 TWSE/TPEX fallback 搜尋 ${ticker}`);
    
    // 移除可能的 .tw 後綴
    const stockCode = ticker.replace(/\.tw$/i, '');
    
    // 1. 嘗試 TWSE（台灣證券交易所）
    try {
      Logger.log(`P5 Daily：嘗試從 TWSE 獲取 ${stockCode} 數據`);
      const twseData = fetchTWSEHistoricalData(stockCode);
      if (twseData && twseData.length > 0) {
        Logger.log(`P5 Daily：TWSE 成功獲取 ${twseData.length} 筆數據`);
        return formatTWSEDataToOHLCV(ticker, twseData);
      }
    } catch (twseError) {
      Logger.log(`P5 Daily：TWSE 獲取失敗：${twseError.message}，嘗試 TPEX`);
    }
    
    // 2. 嘗試 TPEX（櫃買中心）
    try {
      Logger.log(`P5 Daily：嘗試從 TPEX 獲取 ${stockCode} 數據`);
      const tpexData = fetchTPEXHistoricalData(stockCode);
      if (tpexData && tpexData.length > 0) {
        Logger.log(`P5 Daily：TPEX 成功獲取 ${tpexData.length} 筆數據`);
        return formatTPEXDataToOHLCV(ticker, tpexData);
      }
    } catch (tpexError) {
      Logger.log(`P5 Daily：TPEX 獲取失敗：${tpexError.message}`);
    }
    
    Logger.log(`P5 Daily：TWSE 和 TPEX 都無法獲取 ${ticker} 數據`);
    return null;
    
  } catch (error) {
    Logger.log(`P5 Daily：TWSE/TPEX fallback 錯誤：${error.message}`);
    return null;
  }
}

/**
 * 從 TWSE 獲取歷史數據
 * 
 * @param {string} stockCode - 股票代碼（例如 "2330"）
 * @returns {Array} historicalData - 歷史數據陣列
 */
function fetchTWSEHistoricalData(stockCode) {
  try {
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth() + 1;
    let day = today.getDate();
    
    const dateStr = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY.php?response=json&date=${dateStr}&stockNo=${stockCode}`;
    
    Logger.log(`P5 Daily：TWSE API URL：${url}`);
    
    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        "Referer": "https://www.twse.com.tw/"
      }
    });
    
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (statusCode !== 200) {
      throw new Error(`TWSE API 返回 HTTP ${statusCode}`);
    }
    
    let data = JSON.parse(responseText);
    
    if (data.stat !== "OK") {
      // 如果查詢當月失敗，嘗試查詢上個月
      if (data.stat === "查詢無資料" || data.stat.includes("無資料")) {
        Logger.log(`P5 Daily：當月數據無資料，嘗試查詢上個月數據`);
        
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
          prevMonth = 12;
          prevYear = year - 1;
        }
        
        const lastDayOfPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
        const prevDateStr = `${prevYear}${String(prevMonth).padStart(2, '0')}${String(lastDayOfPrevMonth).padStart(2, '0')}`;
        const prevUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY.php?response=json&date=${prevDateStr}&stockNo=${stockCode}`;
        
        const prevResponse = UrlFetchApp.fetch(prevUrl, {
          method: "GET",
          muteHttpExceptions: true,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
            "Referer": "https://www.twse.com.tw/"
          }
        });
        
        if (prevResponse.getResponseCode() === 200) {
          const prevData = JSON.parse(prevResponse.getContentText());
          if (prevData.stat === "OK" && prevData.data && prevData.data.length > 0) {
            Logger.log(`P5 Daily：上個月數據獲取成功，共 ${prevData.data.length} 筆`);
            return prevData.data;
          }
        }
      }
      
      throw new Error(`TWSE API 返回錯誤：${data.stat}`);
    }
    
    if (!data.data || data.data.length === 0) {
      throw new Error("TWSE API 返回空數據");
    }
    
    Logger.log(`P5 Daily：TWSE API 成功獲取 ${data.data.length} 筆數據`);
    return data.data;
    
  } catch (error) {
    Logger.log(`P5 Daily：TWSE 獲取錯誤：${error.message}`);
    throw error;
  }
}

/**
 * 從 TPEX 獲取歷史數據
 * 
 * @param {string} stockCode - 股票代碼（例如 "2330"）
 * @returns {Array} historicalData - 歷史數據陣列
 */
function fetchTPEXHistoricalData(stockCode) {
  try {
    const today = new Date();
    const year = today.getFullYear() - 1911; // 民國年
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const dateStr = `${year}/${month}`;
    
    const url = `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43.php?l=zh-tw&d=${dateStr}&stkno=${stockCode}`;
    
    Logger.log(`P5 Daily：TPEX API URL：${url}`);
    
    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8"
      }
    });
    
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (statusCode !== 200) {
      throw new Error(`TPEX API 返回 HTTP ${statusCode}`);
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error("TPEX API 返回 HTML 而非 JSON");
    }
    
    if (!data || !data.data || data.data.length === 0) {
      throw new Error("TPEX API 返回空數據");
    }
    
    return data.data;
    
  } catch (error) {
    Logger.log(`P5 Daily：TPEX 獲取錯誤：${error.message}`);
    throw error;
  }
}

/**
 * 將 TWSE 數據格式轉換為標準 OHLCV 格式
 * 
 * @param {string} ticker - 股票代碼
 * @param {Array} twseData - TWSE 原始數據
 * @returns {Object} ohlcvData - 標準 OHLCV 數據
 */
function formatTWSEDataToOHLCV(ticker, twseData) {
  try {
    if (!twseData || twseData.length === 0) {
      Logger.log(`P5 Daily：TWSE 數據為空，無法格式化`);
      return null;
    }
    
    // 獲取最新一筆數據（第一筆）
    const latest = twseData[0];
    
    if (!latest || latest.length < 7) {
      Logger.log(`P5 Daily：TWSE 數據格式錯誤，欄位不足`);
      return null;
    }
    
    // 解析日期（民國年格式：113/01/15）
    const dateStr = String(latest[0]).trim();
    const dateParts = dateStr.split('/');
    
    if (dateParts.length !== 3) {
      Logger.log(`P5 Daily：TWSE 日期格式錯誤：${dateStr}`);
      return null;
    }
    
    const year = parseInt(dateParts[0]);
    const month = dateParts[1];
    const day = dateParts[2];
    const adYear = year + 1911;
    const date = `${adYear}-${month}-${day}`;
    
    // 解析數據（移除千分位逗號）
    const volume = parseFloat(String(latest[1]).replace(/,/g, '')) || 0;
    const open = parseFloat(String(latest[3]).replace(/,/g, '')) || 0;
    const high = parseFloat(String(latest[4]).replace(/,/g, '')) || 0;
    const low = parseFloat(String(latest[5]).replace(/,/g, '')) || 0;
    const close = parseFloat(String(latest[6]).replace(/,/g, '')) || 0;
    
    // 驗證數據有效性
    if (open === 0 || high === 0 || low === 0 || close === 0) {
      Logger.log(`P5 Daily：TWSE 數據無效（價格為 0）`);
      return null;
    }
    
    if (high < low || close < low || close > high || open < low || open > high) {
      Logger.log(`P5 Daily：TWSE 數據邏輯錯誤（價格範圍不合理）`);
      return null;
    }
    
    return {
      ticker: ticker,
      date: date,
      open: open,
      high: high,
      low: low,
      close: close,
      volume: volume,
      adj_close: close,
      source: "TWSE",
      status: "SUCCESS"
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：TWSE 數據格式轉換錯誤：${error.message}`);
    return null;
  }
}

/**
 * 將 TPEX 數據格式轉換為標準 OHLCV 格式
 * 
 * @param {string} ticker - 股票代碼
 * @param {Array} tpexData - TPEX 原始數據
 * @returns {Object} ohlcvData - 標準 OHLCV 數據
 */
function formatTPEXDataToOHLCV(ticker, tpexData) {
  try {
    if (!tpexData || tpexData.length === 0) {
      return null;
    }
    
    const latest = tpexData[0];
    const dateStr = latest[0];
    const [year, month, day] = dateStr.split('/');
    const adYear = parseInt(year) + 1911;
    const date = `${adYear}-${month}-${day}`;
    
    const volume = parseFloat(latest[1].replace(/,/g, '')) || 0;
    const open = parseFloat(latest[3].replace(/,/g, '')) || 0;
    const high = parseFloat(latest[4].replace(/,/g, '')) || 0;
    const low = parseFloat(latest[5].replace(/,/g, '')) || 0;
    const close = parseFloat(latest[6].replace(/,/g, '')) || 0;
    
    return {
      ticker: ticker,
      date: date,
      open: open,
      high: high,
      low: low,
      close: close,
      volume: volume,
      adj_close: close,
      source: "TPEX",
      status: "SUCCESS"
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：TPEX 數據格式轉換錯誤：${error.message}`);
    return null;
  }
}
