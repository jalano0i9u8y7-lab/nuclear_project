/**
 * 📊 P5 Daily: OHLCV 數據收集 - 核心入口
 * 
 * ⭐ V8.0 修正：優先使用 GOOGLEFINANCE，備用 stooq.com 和 TWSE/TPEX
 * 
 * @version SSOT V8.0
 * @date 2026-01-17
 */

/**
 * 收集 OHLCV 數據（主入口函數）
 * ⭐ V8.0 修正：優先使用 GOOGLEFINANCE
 * 
 * @param {Array} tickers - 股票代碼列表（格式：["NVDA", "2330", "8035"] 或 [{"ticker": "NVDA", "market": "US"}, ...]）
 * @returns {Object} ohlcvData - OHLCV 數據
 */
function collectOHLCVData(tickers) {
  const ohlcvData = {};
  
  for (const tickerItem of tickers) {
    // 處理 ticker 格式（可能是字符串或對象）
    let ticker, market;
    if (typeof tickerItem === 'string') {
      ticker = tickerItem;
      // 嘗試從 ticker 判斷市場（簡化處理）
      market = guessMarketFromTicker(ticker);
    } else if (typeof tickerItem === 'object' && tickerItem.ticker) {
      ticker = tickerItem.ticker;
      market = tickerItem.market || guessMarketFromTicker(ticker);
    } else {
      Logger.log(`P5 Daily：無效的 ticker 格式：${JSON.stringify(tickerItem)}`);
      continue;
    }
    
    try {
      Logger.log(`P5 Daily：收集 ${ticker} (${market}) OHLCV 數據`);
      
      // ⭐ V8.0 修正：優先使用 GOOGLEFINANCE
      let result = null;
      
      // 1. 優先嘗試 GOOGLEFINANCE
      if (typeof fetchOHLCVFromGoogleFinance === 'function') {
        result = fetchOHLCVFromGoogleFinance(ticker, market);
        if (result && result.status === "SUCCESS") {
          Logger.log(`P5 Daily：${ticker} 通過 GOOGLEFINANCE 成功獲取數據`);
          ohlcvData[ticker] = result;
          continue;
        }
      }
      
      // 2. GOOGLEFINANCE 失敗，嘗試備援方案
      const stooqTicker = formatTickerForStooq(ticker);
      
      // 台股：使用 TWSE/TPEX（stooq.com 對台股個股沒有數據）
      if (market === "TW" || stooqTicker.includes('.tw')) {
        Logger.log(`P5 Daily：${ticker} 是台股，使用 TWSE/TPEX 數據源`);
        
        const twseResult = collectOHLCVDataViaTWSE(ticker);
        if (twseResult && twseResult.status === "SUCCESS") {
          Logger.log(`P5 Daily：${ticker} 通過 TWSE/TPEX 成功獲取數據`);
          ohlcvData[ticker] = twseResult;
          continue;
        } else {
          Logger.log(`P5 Daily：${ticker} TWSE/TPEX 獲取失敗`);
          ohlcvData[ticker] = {
            ticker: ticker,
            error: "TWSE/TPEX 無法獲取此股票的數據",
            status: "NO_DATA",
            source: "TWSE/TPEX"
          };
          continue;
        }
      }
      
      // 非台股（美股、日股等）：使用 stooq.com
      Logger.log(`P5 Daily：從 stooq.com 獲取 ${ticker} (${stooqTicker}) OHLCV 數據`);
      
      // 3. 嘗試直接從 stooq.com 獲取
      result = fetchOHLCVFromStooq(ticker, stooqTicker);
      
      // 4. 如果失敗，嘗試 CSE fallback
      if (!result) {
        Logger.log(`P5 Daily：${ticker} 直接獲取失敗，嘗試 CSE fallback`);
        result = collectOHLCVDataViaCSE(ticker, stooqTicker);
      }
      
      // 5. 處理結果
      if (result) {
        ohlcvData[ticker] = result;
        Logger.log(`P5 Daily：成功收集 ${ticker} OHLCV 數據`);
      } else {
        Logger.log(`P5 Daily：${ticker} 所有數據源都失敗`);
        ohlcvData[ticker] = {
          ticker: ticker,
          error: "所有數據源都無法獲取數據",
          status: "NO_DATA"
        };
      }
      
    } catch (error) {
      Logger.log(`P5 Daily：收集 ${ticker} OHLCV 數據失敗：${error.message}`);
      ohlcvData[ticker] = {
        ticker: ticker,
        error: error.message,
        status: "ERROR"
      };
    }
  }
  
  return ohlcvData;
}

/**
 * 從 ticker 判斷市場（簡化版本）
 * 
 * @param {string} ticker - 股票代碼
 * @returns {string} market - "US", "TW", "JP"
 */
function guessMarketFromTicker(ticker) {
  // 移除可能的後綴
  const cleanTicker = ticker.replace(/\.(TW|US|JP)$/i, '').trim();
  
  // 台股：通常是 4 位數字
  if (/^\d{4}$/.test(cleanTicker)) {
    return "TW";
  }
  
  // 日股：通常是 4 位數字（但可能與台股衝突，需要更精確的判斷）
  // 這裡簡化處理，實際使用時可能需要維護清單
  
  // 預設為美股
  return "US";
}

/**
 * 獲取歷史 OHLCV 數據（從表格、GOOGLEFINANCE 或 stooq.com）
 * ⭐ V8.0 修正：優先使用 GOOGLEFINANCE
 * 
 * @param {string} ticker - 股票代碼
 * @param {number} days - 需要多少天的數據
 * @param {string} market - 市場（"US", "TW", "JP"）
 * @param {boolean} fetchFromStooq - 是否允許從 stooq.com 獲取（備援）
 * @returns {Array} historicalData - 歷史數據陣列
 */
function getHistoricalOHLCV(ticker, days, market = null, fetchFromStooq = true) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    let tickerData = [];
    
    // 先從表格讀取
    if (sheet && sheet.getLastRow() > 1) {
      const dataRange = sheet.getDataRange();
      const rows = dataRange.getValues();
      const headers = rows[0];
      
      const tickerCol = headers.indexOf("ticker");
      const dateCol = headers.indexOf("date");
      
      if (tickerCol !== -1 && dateCol !== -1) {
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][tickerCol] === ticker) {
            const openCol = headers.indexOf("open");
            const highCol = headers.indexOf("high");
            const lowCol = headers.indexOf("low");
            const closeCol = headers.indexOf("close");
            const volumeCol = headers.indexOf("volume");
            
            tickerData.push({
              date: rows[i][dateCol],
              open: rows[i][openCol],
              high: rows[i][highCol],
              low: rows[i][lowCol],
              close: rows[i][closeCol],
              volume: rows[i][volumeCol]
            });
          }
        }
      }
    }
    
    // 按日期升序排序（從舊到新）
    tickerData.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
      const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
      return dateA - dateB;
    });
    
    // ⭐ V8.0 修正：如果數據不足，優先使用 GOOGLEFINANCE，失敗則使用 stooq.com
    if (tickerData.length < days) {
      Logger.log(`P5 Daily：${ticker} 表格數據不足（${tickerData.length}/${days}），嘗試補充數據`);
      
      // 判斷市場（如果未提供）
      if (!market) {
        market = guessMarketFromTicker(ticker);
      }
      
      // 1. 優先嘗試 GOOGLEFINANCE
      if (typeof fetchHistoricalOHLCVFromGoogleFinance === 'function') {
        const googleHistory = fetchHistoricalOHLCVFromGoogleFinance(ticker, market, days);
        if (googleHistory && googleHistory.length > 0) {
          Logger.log(`P5 Daily：${ticker} 通過 GOOGLEFINANCE 成功獲取 ${googleHistory.length} 筆歷史數據`);
          // 合併數據（去重，保留最新的）
          const existingDates = new Set(tickerData.map(d => d.date.toString()));
          for (const row of googleHistory) {
            if (!existingDates.has(row.date.toString())) {
              tickerData.push(row);
            }
          }
          // 重新排序
          tickerData.sort((a, b) => {
            const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
            const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
            return dateA - dateB;
          });
          
          if (tickerData.length >= days) {
            return tickerData.slice(-days); // 返回最後 days 天的數據
          }
        }
      }
      
      // 2. GOOGLEFINANCE 失敗，嘗試 stooq.com（如果允許）
      if (fetchFromStooq) {
        Logger.log(`P5 Daily：${ticker} GOOGLEFINANCE 獲取失敗，嘗試從 stooq.com 獲取歷史數據`);
        
        try {
          const stooqTicker = formatTickerForStooq(ticker);
          
          const properties = PropertiesService.getScriptProperties();
          const cloudFunctionUrl = properties.getProperty("CLOUD_FUNCTION_STOOQ_URL");
          
          if (cloudFunctionUrl) {
            const response = UrlFetchApp.fetch(`${cloudFunctionUrl}?ticker=${encodeURIComponent(stooqTicker)}`, {
              method: "GET",
              muteHttpExceptions: true,
              followRedirects: true
            });
            
            if (response.getResponseCode() === 200) {
              const csvText = response.getContentText();
              
              if (!csvText.trim().startsWith('<') && !csvText.includes('<!DOCTYPE')) {
                const lines = csvText.trim().split('\n');
                
                if (lines.length >= 2) {
                  // 解析 CSV（跳過標題行）
                  const stooqData = [];
                  for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',');
                    if (values.length >= 6) {
                      const dateStr = values[0].trim();
                      const year = parseInt(dateStr.substring(0, 4));
                      const month = parseInt(dateStr.substring(4, 6)) - 1;
                      const day = parseInt(dateStr.substring(6, 8));
                      const date = new Date(year, month, day);
                      
                      stooqData.push({
                        date: date,
                        open: parseFloat(values[1]),
                        high: parseFloat(values[2]),
                        low: parseFloat(values[3]),
                        close: parseFloat(values[4]),
                        volume: parseFloat(values[5])
                      });
                    }
                  }
                  
                  // 合併數據（去重）
                  const existingDates = new Set(tickerData.map(d => d.date.getTime()));
                  for (const data of stooqData) {
                    if (!existingDates.has(data.date.getTime())) {
                      tickerData.push(data);
                    }
                  }
                  
                  // 重新排序
                  tickerData.sort((a, b) => a.date.getTime() - b.date.getTime());
                  
                  Logger.log(`P5 Daily：從 stooq.com 補充了 ${stooqData.length} 筆歷史數據`);
                }
              }
            }
          }
        } catch (error) {
          Logger.log(`P5 Daily：從 stooq.com 獲取歷史數據失敗：${error.message}`);
        }
      }
    }
    
    // 返回最近 N 天（從舊到新）
    return tickerData.slice(-days);
  } catch (error) {
    Logger.log(`獲取歷史 OHLCV 數據失敗：${error.message}`);
    return [];
  }
}

/**
 * 保存 OHLCV 數據到表格
 * 
 * @param {Object} ohlcvData - OHLCV 數據
 * @param {Date} date - 日期
 */
function saveOHLCVToSheet(ohlcvData, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("MARKET_OHLCV_DAILY");
      sheet.appendRow(MARKET_OHLCV_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const rows = [];
    for (const [ticker, data] of Object.entries(ohlcvData)) {
      if (data.status === "COMPLETED" && data.date) {
        rows.push([
          data.date,
          ticker,
          data.open,
          data.high,
          data.low,
          data.close,
          data.volume,
          data.adj_close || data.close,
          new Date()
        ]);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily：已保存 ${rows.length} 筆 OHLCV 數據到表格`);
    }
  } catch (error) {
    Logger.log(`保存 OHLCV 數據到表格失敗：${error.message}`);
  }
}
