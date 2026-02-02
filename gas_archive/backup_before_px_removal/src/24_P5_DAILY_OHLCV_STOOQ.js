/**
 * 📊 P5 Daily: OHLCV 數據收集 - Stooq.com（美股、日股）
 * 
 * 處理通過 stooq.com 獲取 OHLCV 數據：
 * - 美股：AAPL.us, MSFT.us 等
 * - 日股：7203.jp 等
 * - CSE Fallback 機制
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

/**
 * 格式化股票代碼以符合 stooq.com 格式
 * 
 * Stooq 官方格式規則（SSOT）：
 * - 美股：<symbol>.us（小寫，如 AAPL.us）
 * - 台股：<股票代碼>.tw（小寫，如 2330.tw）
 * - 日股：<股票代碼>.jp（小寫，如 7203.jp）
 * - 指數：^<symbol>（小寫，如 ^twii, ^nikkei, ^spx）
 * 
 * @param {string} ticker - 原始股票代碼
 * @returns {string} stooqTicker - stooq.com 格式的代碼（小寫後綴）
 */
function formatTickerForStooq(ticker) {
  // 如果已經包含 ^，轉換為小寫（指數）
  if (ticker.startsWith('^')) {
    return ticker.toLowerCase();
  }
  
  // 如果已經包含市場後綴，轉換為小寫
  const lowerTicker = ticker.toLowerCase();
  if (lowerTicker.includes('.us') || lowerTicker.includes('.tw') || lowerTicker.includes('.jp')) {
    return lowerTicker;
  }
  
  // 如果包含大寫後綴，轉換為小寫
  if (ticker.includes('.US') || ticker.includes('.TW') || ticker.includes('.JP')) {
    return lowerTicker;
  }
  
  // 美股：添加 .us 後綴（小寫）
  // 判斷邏輯：全大寫字母，長度 <= 5
  if (/^[A-Z]+$/.test(ticker) && ticker.length <= 5) {
    return ticker.toLowerCase() + ".us";
  }
  
  // 台股：4 位數字，添加 .tw 後綴（小寫）
  // 注意：台股和日股都是 4 位數字，預設為台股
  // 如果需要日股，應該在調用時明確指定（如 7203.jp）
  if (/^\d{4}$/.test(ticker)) {
    return ticker + ".tw";
  }
  
  // 其他情況：返回原樣（可能需要手動指定市場）
  return ticker;
}

/**
 * 解析 stooq.com CSV 數據
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} csvText - CSV 文本
 * @returns {Object} ohlcvData - OHLCV 數據
 */
function parseStooqCSV(ticker, csvText) {
  const lines = csvText.trim().split('\n');
  
  if (lines.length < 2) {
    throw new Error("CSV 數據不足");
  }
  
  // 解析 CSV（跳過標題行，取最後一行作為最新數據）
  const lastLine = lines[lines.length - 1];
  const values = lastLine.split(',');
  
  if (values.length < 6) {
    throw new Error("CSV 格式錯誤");
  }
  
  // stooq.com 格式：Date,Open,High,Low,Close,Volume
  const dateStr = values[0].trim();
  const open = parseFloat(values[1]);
  const high = parseFloat(values[2]);
  const low = parseFloat(values[3]);
  const close = parseFloat(values[4]);
  const volume = parseFloat(values[5]);
  
  // 轉換日期格式（stooq.com 使用 YYYYMMDD）
  const date = new Date(
    parseInt(dateStr.substring(0, 4)),
    parseInt(dateStr.substring(4, 6)) - 1,
    parseInt(dateStr.substring(6, 8))
  );
  
  return {
    date: date,
    ticker: ticker,
    open: open,
    high: high,
    low: low,
    close: close,
    volume: volume,
    adj_close: close,  // stooq.com 的 CSV 不包含 adj_close，使用 close
    source: "stooq.com"
  };
}

/**
 * 從 stooq.com 獲取 OHLCV 數據（通過 Cloud Function 代理）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} stooqTicker - stooq.com 格式的代碼
 * @returns {Object|null} ohlcvData - OHLCV 數據，如果失敗則返回 null
 */
function fetchOHLCVFromStooq(ticker, stooqTicker) {
  try {
    Logger.log(`P5 Daily：從 stooq.com 獲取 ${ticker} (${stooqTicker}) OHLCV 數據（通過代理）`);
    
    // 直接使用 Cloud Function 代理（不嘗試直接訪問）
    const properties = PropertiesService.getScriptProperties();
    const cloudFunctionUrl = properties.getProperty("CLOUD_FUNCTION_STOOQ_URL");
    
    if (!cloudFunctionUrl) {
      throw new Error("未配置 Cloud Function 代理 URL（CLOUD_FUNCTION_STOOQ_URL）");
    }
    
    const response = UrlFetchApp.fetch(`${cloudFunctionUrl}?ticker=${encodeURIComponent(stooqTicker)}`, {
      method: "GET",
      muteHttpExceptions: true,
      followRedirects: true
    });
    
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    // 處理 HTTP 錯誤
    if (statusCode !== 200) {
      const errorText = responseText.substring(0, 200);
      Logger.log(`P5 Daily：${ticker} HTTP ${statusCode} 錯誤：${errorText}`);
      
      // 檢查是否為 "CSV 數據不足" 錯誤（來自代理）
      if (statusCode === 500 && errorText.includes("CSV 數據不足")) {
        Logger.log(`P5 Daily：${ticker} 代理返回 CSV 數據不足`);
        return null;  // 返回 null，讓調用者處理 fallback
      }
      
      // 其他 HTTP 錯誤
      throw new Error(`HTTP ${statusCode}: ${errorText.substring(0, 100)}`);
    }
    
    const csvText = responseText;
    
    // 檢查響應是否為 HTML（可能是錯誤頁面）
    if (csvText.trim().startsWith('<') || csvText.includes('<!DOCTYPE')) {
      Logger.log(`P5 Daily：${ticker} 返回 HTML 而非 CSV`);
      throw new Error(`stooq.com 返回 HTML 而非 CSV，請檢查 ticker 格式：${stooqTicker}`);
    }
    
    const lines = csvText.trim().split('\n');
    
    // 檢查是否為訪問限制錯誤
    if (csvText.includes("Exceeded the daily hits limit") || csvText.includes("daily hits limit")) {
      Logger.log(`P5 Daily：${ticker} stooq.com 超過每日訪問限制`);
      return null;  // 返回 null，讓調用者處理 fallback
    }
    
    // 檢查是否為 "no data" 錯誤
    if (csvText.toLowerCase().includes("no data") || csvText.toLowerCase().includes("nodata")) {
      Logger.log(`P5 Daily：${ticker} stooq.com 返回 "no data"`);
      return null;
    }
    
    if (lines.length < 2) {
      Logger.log(`P5 Daily：${ticker} CSV 數據不足（只有 ${lines.length} 行）`);
      
      // 特殊情況：如果只有標題行，可能是該股票在 stooq.com 中沒有數據
      if (lines.length === 1 && lines[0].includes('Date')) {
        Logger.log(`P5 Daily：${ticker} 在 stooq.com 中沒有數據`);
        return null;
      }
      
      throw new Error("CSV 數據不足");
    }
    
    // 解析 CSV
    const ohlcvData = parseStooqCSV(ticker, csvText);
    ohlcvData.status = "COMPLETED";
    
    Logger.log(`P5 Daily：成功收集 ${ticker} OHLCV 數據（日期：${ohlcvData.date}，收盤價：${ohlcvData.close}）`);
    
    return ohlcvData;
    
  } catch (error) {
    Logger.log(`P5 Daily：從 stooq.com 獲取 ${ticker} 數據失敗：${error.message}`);
    return null;
  }
}

/**
 * 通過 CSE 搜尋獲取 OHLCV 數據（Fallback 機制）
 * 
 * @param {string} ticker - 原始股票代碼
 * @param {string} stooqTicker - stooq.com 格式的代碼
 * @returns {Object|null} ohlcvData - OHLCV 數據，如果失敗則返回 null
 */
function collectOHLCVDataViaCSE(ticker, stooqTicker) {
  try {
    Logger.log(`P5 Daily：開始 CSE fallback 搜尋 ${ticker} (${stooqTicker})`);
    
    // 1. 構建搜尋查詢
    const searchQueries = [
      `stooq.com ${stooqTicker} CSV download`,
      `stooq.com ${stooqTicker} historical data`,
      `${stooqTicker} OHLCV data stooq`,
      `site:stooq.com ${stooqTicker}`
    ];
    
    // 2. 使用 P5_OHLCV CSE 搜尋
    const jobId = `CSE_FALLBACK_${ticker}_${Date.now()}`;
    
    for (const query of searchQueries) {
      try {
        Logger.log(`P5 Daily：CSE 搜尋查詢：${query}`);
        
        const payload = {
          search_query: query,
          cse_type: "P5_OHLCV",
          max_results: 5
        };
        
        const result = executeCSESearch(jobId, "CSE_SEARCH", payload);
        
        if (result && result.output && result.output.search_results) {
          const searchResults = result.output.search_results;
          Logger.log(`P5 Daily：CSE 找到 ${searchResults.length} 筆結果`);
          
          // 3. 如果搜尋結果中有 stooq.com 的連結，使用 Cloud Run 代理訪問 CSV URL
          const hasStooqLink = searchResults.some(item => {
            const url = item.link || "";
            return url.includes("stooq.com");
          });
          
          if (hasStooqLink) {
            Logger.log(`P5 Daily：搜尋結果確認 stooq.com 可訪問，使用 Cloud Run 代理訪問 CSV URL`);
            
            const properties = PropertiesService.getScriptProperties();
            const cloudFunctionUrl = properties.getProperty("CLOUD_FUNCTION_STOOQ_URL");
            
            if (cloudFunctionUrl) {
              try {
                const response = UrlFetchApp.fetch(`${cloudFunctionUrl}?ticker=${encodeURIComponent(stooqTicker)}`, {
                  method: "GET",
                  muteHttpExceptions: true,
                  followRedirects: true
                });
                
                const statusCode = response.getResponseCode();
                const csvText = response.getContentText();
                
                if (statusCode === 200) {
                  if (csvText.includes("Exceeded the daily hits limit") || csvText.includes("daily hits limit")) {
                    continue;  // 嘗試下一個查詢
                  }
                  
                  const lines = csvText.trim().split('\n');
                  if (lines.length >= 2) {
                    Logger.log(`P5 Daily：通過代理成功獲取 ${ticker} 數據（${lines.length} 行）`);
                    const ohlcvData = parseStooqCSV(ticker, csvText);
                    ohlcvData.source = "stooq.com (via CSE)";
                    ohlcvData.status = "COMPLETED";
                    return ohlcvData;
                  }
                }
              } catch (proxyError) {
                Logger.log(`P5 Daily：代理訪問失敗：${proxyError.message}`);
              }
            }
          }
        }
      } catch (searchError) {
        Logger.log(`P5 Daily：CSE 搜尋失敗：${searchError.message}`);
        continue;
      }
    }
    
    Logger.log(`P5 Daily：所有 CSE fallback 嘗試都失敗`);
    return null;
    
  } catch (error) {
    Logger.log(`P5 Daily：CSE fallback 機制錯誤：${error.message}`);
    return null;
  }
}
