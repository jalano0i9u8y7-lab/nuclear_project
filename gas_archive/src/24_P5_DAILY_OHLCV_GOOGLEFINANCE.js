/**
 * 📊 P5 Daily: OHLCV 數據收集 - GOOGLEFINANCE 數據源
 * 
 * ⭐ V8.0 新增：使用 GOOGLEFINANCE 獲取 OHLCV 數據（優先數據源）
 * 優點：免費、穩定、無需 API Key、適合高頻監控
 * 
 * @version V8.0
 * @date 2026-01-17
 */

// ==========================================
// GOOGLEFINANCE OHLCV 數據收集
// ==========================================

/**
 * 從 GOOGLEFINANCE 獲取單個股票的 OHLCV 數據
 * 
 * @param {string} ticker - 股票代碼（例如："NVDA", "2330", "8035"）
 * @param {string} market - 市場（"US", "TW", "JP"）
 * @returns {Object|null} ohlcvData - OHLCV 數據
 */
function fetchOHLCVFromGoogleFinance(ticker, market) {
  try {
    // 檢查 fetchGoogleFinanceSafe 函數是否存在
    if (typeof fetchGoogleFinanceSafe !== 'function') {
      Logger.log(`P5 Daily：⚠️ fetchGoogleFinanceSafe 函數不存在，無法使用 GOOGLEFINANCE`);
      return null;
    }
    
    // 轉換為 GOOGLEFINANCE 格式
    let googleTicker = convertTickerToGoogleFinance(ticker, market);
    if (!googleTicker) {
      Logger.log(`P5 Daily：${ticker} (${market}) 無法轉換為 GOOGLEFINANCE 格式`);
      return null;
    }
    
    Logger.log(`P5 Daily：從 GOOGLEFINANCE 獲取 ${ticker} (${market} → ${googleTicker}) OHLCV 數據`);
    
    // ⭐ V8.2 修正：使用智能多重代碼讀取器（已內建備用代碼機制 + 價格合理性檢查）
    // fetchGoogleFinanceSafe 現在會自動嘗試備用代碼，並且會檢查價格合理性
    let price = fetchGoogleFinanceSafe(googleTicker, "price");
    
    // ⭐ V8.2 新增：日股價格合理性檢查（防止抓到錯誤市場的數據，如 0.05 這種鬼數據）
    if (price !== null && market === "JP") {
      if (price < 1) {
        Logger.log(`P5 Daily：⚠️ ${ticker} 價格異常過低 (${price})，可能是錯誤市場數據，視為無效`);
        price = null; // 強制失敗，觸發備援機制
      }
    }
    
    if (price === null) {
      Logger.log(`P5 Daily：${ticker} GOOGLEFINANCE 價格獲取失敗（已嘗試所有備用代碼或價格異常）`);
      return null;
    }
    
    // 獲取各個屬性（使用成功後的 googleTicker）
    // ⚠️ 注意：如果價格成功，後續屬性應該使用相同的 ticker 格式
    // 但由於 fetchGoogleFinanceSafe 會自動嘗試備用代碼，這裡直接使用 googleTicker 即可
    const priceOpen = fetchGoogleFinanceSafe(googleTicker, "priceopen");
    const high = fetchGoogleFinanceSafe(googleTicker, "high");
    const low = fetchGoogleFinanceSafe(googleTicker, "low");
    const volume = fetchGoogleFinanceSafe(googleTicker, "volume");
    
    // ⭐ V8.2 新增：日股其他屬性也進行合理性檢查
    if (market === "JP") {
      if ((priceOpen !== null && priceOpen < 1) || 
          (high !== null && high < 1) || 
          (low !== null && low < 1)) {
        Logger.log(`P5 Daily：⚠️ ${ticker} OHLC 數據異常過低，可能是錯誤市場數據，視為無效`);
        return null;
      }
    }
    
    // 驗證數據
    if (price === null || priceOpen === null || high === null || low === null || volume === null) {
      Logger.log(`P5 Daily：${ticker} GOOGLEFINANCE 獲取失敗（部分數據為 null）`);
      return null;
    }
    
    // 計算變化
    const change = price - priceOpen;
    const change_pct = priceOpen !== 0 ? (change / priceOpen) * 100 : 0;
    
    const ohlcvData = {
      ticker: ticker,
      market: market,
      open: priceOpen,
      high: high,
      low: low,
      close: price,
      volume: volume,
      change: change,
      change_pct: change_pct,
      status: "SUCCESS",
      data_source: "GOOGLE_INTERNAL",
      timestamp: new Date()
    };
    
    Logger.log(`P5 Daily：✅ 成功從 GOOGLEFINANCE 獲取 ${ticker} OHLCV 數據：開=${priceOpen.toFixed(2)}, 高=${high.toFixed(2)}, 低=${low.toFixed(2)}, 收=${price.toFixed(2)}, 量=${volume.toLocaleString()}`);
    
    return ohlcvData;
    
  } catch (error) {
    Logger.log(`P5 Daily：❌ ${ticker} GOOGLEFINANCE 發生錯誤: ${error.message}`);
    return null;
  }
}

/**
 * 轉換股票代碼為 GOOGLEFINANCE 格式
 * 
 * @param {string} ticker - 股票代碼（例如："NVDA", "2330", "8035"）
 * @param {string} market - 市場（"US", "TW", "JP"）
 * @returns {string|null} googleTicker - GOOGLEFINANCE 格式代碼
 */
function convertTickerToGoogleFinance(ticker, market) {
  if (!ticker || !market) {
    return null;
  }
  
  // 移除可能的後綴（例如 ".TW", ".US"）
  const cleanTicker = ticker.replace(/\.(TW|US|JP)$/i, '').trim();
  
  switch (market.toUpperCase()) {
    case "US":
      // 美股：需要判斷是 NASDAQ 還是 NYSE
      // 簡化處理：先嘗試 NASDAQ，如果失敗再嘗試 NYSE
      // 這裡先返回 NASDAQ 格式，實際使用時可以根據需要調整
      return `NASDAQ:${cleanTicker}`;
      
    case "TW":
      // 台股：TPE 格式
      return `TPE:${cleanTicker}`;
      
    case "JP":
      // ⚠️ V8.2 修正：日股必須使用明確的交易所前綴（TYO: 或 SHE:）
      // 絕對不能使用純數字（如 "8035"），因為 Google 可能會抓到錯誤市場（如香港 8035）
      // 智能多重代碼讀取器會嘗試 TYO:8035 -> SHE:8035，若都失敗則回傳 null 交由備援機制
      return `TYO:${cleanTicker}`;  // 使用明確的 TYO: 前綴，避免模糊匹配
      
    default:
      Logger.log(`P5 Daily：不支援的市場：${market}`);
      return null;
  }
}

/**
 * 從 GOOGLEFINANCE 獲取歷史 OHLCV 數據
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場（"US", "TW", "JP"）
 * @param {number} days - 需要多少天的數據
 * @returns {Array|null} historicalData - 歷史數據陣列
 */
function fetchHistoricalOHLCVFromGoogleFinance(ticker, market, days) {
  try {
    // 檢查 fetchGoogleFinanceHistorySafe 函數是否存在
    if (typeof fetchGoogleFinanceHistorySafe !== 'function') {
      Logger.log(`P5 Daily：⚠️ fetchGoogleFinanceHistorySafe 函數不存在，無法使用 GOOGLEFINANCE`);
      return null;
    }
    
    // 轉換為 GOOGLEFINANCE 格式
    const googleTicker = convertTickerToGoogleFinance(ticker, market);
    if (!googleTicker) {
      Logger.log(`P5 Daily：${ticker} (${market}) 無法轉換為 GOOGLEFINANCE 格式`);
      return null;
    }
    
    Logger.log(`P5 Daily：從 GOOGLEFINANCE 獲取 ${ticker} (${market} → ${googleTicker}) 歷史 ${days} 天數據`);
    
    // 使用安全的歷史數據讀取函數
    const data = fetchGoogleFinanceHistorySafe(googleTicker, days);
    
    if (!data || data.length === 0) {
      Logger.log(`P5 Daily：${ticker} GOOGLEFINANCE 歷史數據獲取失敗`);
      return null;
    }
    
    // 解析歷史數據（GOOGLEFINANCE 返回的格式：第一行是標題，後續是數據）
    // 格式：["Date", "Open", "High", "Low", "Close", "Volume"]
    if (data[0][0] !== "Date") {
      Logger.log(`P5 Daily：${ticker} GOOGLEFINANCE 歷史數據格式不正確`);
      return null;
    }
    
    const historicalData = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.length >= 6) {
        historicalData.push({
          date: row[0],      // Date
          open: row[1],      // Open
          high: row[2],      // High
          low: row[3],       // Low
          close: row[4],     // Close
          volume: row[5]     // Volume
        });
      }
    }
    
    Logger.log(`P5 Daily：✅ 成功從 GOOGLEFINANCE 獲取 ${ticker} 歷史數據，共 ${historicalData.length} 筆`);
    
    return historicalData;
    
  } catch (error) {
    Logger.log(`P5 Daily：❌ ${ticker} GOOGLEFINANCE 歷史數據獲取失敗: ${error.message}`);
    return null;
  }
}

/**
 * 判斷美股是 NASDAQ 還是 NYSE（簡化版本）
 * 注意：這是一個簡化實現，實際使用時可能需要更完整的清單
 * 
 * @param {string} ticker - 股票代碼
 * @returns {string} exchange - "NASDAQ" 或 "NYSE"
 */
function guessUSExchange(ticker) {
  // 簡化處理：大部分科技股在 NASDAQ，傳統股在 NYSE
  // 實際使用時可以維護一個完整的清單或使用其他方法判斷
  const nasdaqCommon = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "NFLX", "AMD", "INTC"];
  
  if (nasdaqCommon.includes(ticker.toUpperCase())) {
    return "NASDAQ";
  }
  
  // 預設返回 NASDAQ（可以根據需要調整）
  return "NASDAQ";
}
