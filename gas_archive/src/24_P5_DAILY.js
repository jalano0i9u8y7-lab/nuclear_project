/**
 * 📊 P5 Daily: 市場數據收集
 * 
 * 每日收集市場數據：
 * - OHLCV 數據（從 stooq.com）
 * - 技術指標計算（RSI、MACD、ATR、MA 等）
 * - 板塊 ETF 數據
 * - 衍生品數據（Put/Call Ratio、IV 等）
 * - 新聞原子化數據
 * - 台股掛單監控檢查
 * 
 * 執行頻率：每日 1 次
 * 執行者：GPT-5.1（多語去重場景）
 * 審查者：Gemini 2.5 Pro
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
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
      p4_6_triggered: false  // TODO: 從 P4.6 模組讀取
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
    // ⭐ V8.0 修正：使用 24_P5_DAILY_MACRO.js 中的 collectMacroData() 函數
    // ⚠️ V8.0 重要：商品/波動率/利率不再使用 Stooq，直接使用 Yahoo Finance JSON API
    // Stooq 只保留用於 FX（匯率），因為 FX 目前正常
    try {
      // 注意：這裡調用的是 24_P5_DAILY_MACRO.js 中的 collectMacroData() 函數
      // 由於函數名相同，在 Google Apps Script 中會自動使用最後定義的版本
      // ⚠️ 如果日誌顯示還從 Stooq 開始，請重新部署/刷新 Google Apps Script
      collectionResult.macro_data = collectMacroData();
    } catch (error) {
      Logger.log(`P5 Daily：宏觀數據收集失敗：${error.message}`);
    }
    
    try {
      collectionResult.news_atoms = collectNewsAtoms(tickers, collectionResult.macro_data);
      
      // ⭐ V8.12 新增：建立個股新聞索引（反向索引）
      if (collectionResult.news_atoms && Object.keys(collectionResult.news_atoms).length > 0) {
        try {
          const today = new Date();
          const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
          const tickerIndex = buildTickerNewsIndex(collectionResult.news_atoms, dateStr);
          
          // 保存個股新聞索引到表格
          if (Object.keys(tickerIndex).length > 0) {
            saveTickerNewsIndexToSheet(tickerIndex, dateStr);
            Logger.log(`P5 Daily V8.12：個股新聞索引建立完成，共 ${Object.keys(tickerIndex).length} 個ticker`);
          }
        } catch (error) {
          Logger.log(`P5 Daily V8.12：建立個股新聞索引失敗：${error.message}`);
        }
      }
      
      // ⭐ V8.12 新增：週度聚合優化（在週五執行）
      const today = new Date();
      const dayOfWeek = today.getDay();  // 0=Sunday, 1=Monday, ..., 5=Friday
      if (dayOfWeek === 5) {  // 週五
        Logger.log("P5 Daily V8.12：今天是週五，開始執行週度聚合優化");
        try {
          executeWeeklyOptimization({
            trigger: params.trigger,
            newsAtoms: collectionResult.news_atoms,
            tickers: tickers
          });
        } catch (error) {
          Logger.log(`P5 Daily V8.12：週度聚合優化失敗：${error.message}`);
          // 不中斷主流程，只記錄錯誤
        }
      }
    } catch (error) {
      Logger.log(`P5 Daily：新聞原子化數據收集失敗：${error.message}`);
    }
    
    try {
      collectionResult.taiwan_order_check = checkTaiwanOrders(tickers);
    } catch (error) {
      Logger.log(`P5 Daily：台股掛單檢查失敗：${error.message}`);
    }
    
    // Step 4: 保存數據到表格
    saveDailyDataToSheets(collectionResult);
    
    // Step 5: 更新 P5 Daily 狀態
    updateP5DailyStatus(collectionResult);
    
    // Step 6: 檢查並更新預估日期 ⭐ V8.0 新增
    try {
      P5_Calendar_CheckEstimatedDates();
    } catch (error) {
      Logger.log(`P5 Daily：檢查預估日期失敗（${error.message}），不影響主流程`);
    }
    
    Logger.log(`P5 Daily 執行完成：收集了 ${tickers.length} 檔股票的數據`);
    
    return {
      status: "COMPLETED",
      tickers_count: tickers.length,
      collection_result: collectionResult
    };
    
  } catch (error) {
    Logger.log(`P5 Daily 執行失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 數據收集函數
// ==========================================

/**
 * 收集 OHLCV 數據（從 stooq.com）
 * 
 * @param {Array} tickers - 股票代碼列表
 * @returns {Object} ohlcvData - OHLCV 數據
 */
function collectOHLCVData(tickers) {
  const ohlcvData = {};
  
  for (const ticker of tickers) {
    try {
      // 檢查是否為台股，如果是台股，直接使用 TWSE/TPEX（stooq.com 對台股個股沒有數據）
      const stooqTicker = formatTickerForStooq(ticker);
      
      if (stooqTicker.includes('.tw')) {
        Logger.log(`P5 Daily：${ticker} 是台股，跳過 stooq.com，直接使用 TWSE/TPEX 數據源`);
        
        try {
          const twseResult = collectOHLCVDataViaTWSE(ticker);
          if (twseResult && twseResult.status === "SUCCESS") {
            Logger.log(`P5 Daily：${ticker} 通過 TWSE/TPEX 成功獲取數據`);
            ohlcvData[ticker] = twseResult;
            continue;  // 成功獲取，繼續處理下一個
          } else {
            Logger.log(`P5 Daily：${ticker} TWSE/TPEX 獲取失敗，返回結果：${JSON.stringify(twseResult)}`);
            ohlcvData[ticker] = {
              ticker: ticker,
              error: "TWSE/TPEX 無法獲取此股票的數據",
              status: "NO_DATA",
              source: "TWSE/TPEX",
              suggestion: "檢查股票代碼是否正確，或股票是否已下市"
            };
            continue;
          }
        } catch (twseError) {
          Logger.log(`P5 Daily：${ticker} TWSE/TPEX 異常：${twseError.message}`);
          Logger.log(`P5 Daily：${ticker} 錯誤堆疊：${twseError.stack}`);
          ohlcvData[ticker] = {
            ticker: ticker,
            error: `TWSE/TPEX 異常：${twseError.message}`,
            status: "NO_DATA",
            source: "TWSE/TPEX",
            suggestion: "檢查網絡連接或 API 可用性"
          };
          continue;
        }
      }
      
      // 非台股，使用 stooq.com（通過 Cloud Function 代理）
      // 注意：GAS 無法直接訪問 stooq.com，必須使用代理
      Logger.log(`P5 Daily：從 stooq.com 獲取 ${ticker} (${stooqTicker}) OHLCV 數據（通過代理）`);
      
      // 直接使用 Cloud Function 代理（不嘗試直接訪問）
      const properties = PropertiesService.getScriptProperties();
      const cloudFunctionUrl = properties.getProperty("CLOUD_FUNCTION_STOOQ_URL");
      
      if (!cloudFunctionUrl) {
        throw new Error("未配置 Cloud Function 代理 URL（CLOUD_FUNCTION_STOOQ_URL）");
      }
      
      let response;
      try {
        response = UrlFetchApp.fetch(`${cloudFunctionUrl}?ticker=${encodeURIComponent(stooqTicker)}`, {
          method: "GET",
          muteHttpExceptions: true,
          followRedirects: true
        });
      } catch (proxyError) {
        Logger.log(`P5 Daily：Cloud Function 代理失敗：${proxyError.message}`);
        throw new Error(`Cloud Function 代理失敗：${proxyError.message}`);
      }
      
      const statusCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      // 處理 HTTP 錯誤（特別是 500 錯誤，可能是 CSV 數據不足）
      if (statusCode !== 200) {
        const errorText = responseText.substring(0, 200);
        Logger.log(`P5 Daily：${ticker} HTTP ${statusCode} 錯誤：${errorText}`);
        
        // 檢查是否為 "CSV 數據不足" 錯誤（來自代理）
        if (statusCode === 500 && errorText.includes("CSV 數據不足")) {
          Logger.log(`P5 Daily：${ticker} 代理返回 CSV 數據不足，嘗試使用 CSE fallback 機制`);
          
          try {
            const cseResult = collectOHLCVDataViaCSE(ticker, stooqTicker);
            if (cseResult) {
              Logger.log(`P5 Daily：${ticker} 通過 CSE fallback 成功獲取數據`);
              ohlcvData[ticker] = cseResult;
              continue;  // 成功獲取，繼續處理下一個
            } else {
              Logger.log(`P5 Daily：${ticker} CSE fallback 也失敗，跳過此股票`);
              continue;  // 跳過此股票，繼續處理下一個
            }
          } catch (cseError) {
            Logger.log(`P5 Daily：${ticker} CSE fallback 失敗：${cseError.message}`);
            continue;  // 跳過此股票，繼續處理下一個
          }
        } else {
          // 其他 HTTP 錯誤，拋出異常
          throw new Error(`HTTP ${statusCode}: ${errorText.substring(0, 100)}`);
        }
      }
      
      const csvText = responseText;
      
      // 檢查響應是否為 HTML（可能是錯誤頁面）
      if (csvText.trim().startsWith('<') || csvText.includes('<!DOCTYPE')) {
        Logger.log(`P5 Daily：${ticker} 返回 HTML 而非 CSV，可能是 ticker 格式錯誤或數據不存在`);
        throw new Error(`stooq.com 返回 HTML 而非 CSV，請檢查 ticker 格式：${stooqTicker}`);
      }
      
      const lines = csvText.trim().split('\n');
      
      // 檢查是否為訪問限制錯誤
      if (csvText.includes("Exceeded the daily hits limit") || csvText.includes("daily hits limit")) {
        Logger.log(`P5 Daily：${ticker} stooq.com 超過每日訪問限制，嘗試使用 CSE fallback 機制`);
        
        try {
          const cseResult = collectOHLCVDataViaCSE(ticker, stooqTicker);
          if (cseResult) {
            Logger.log(`P5 Daily：${ticker} 通過 CSE fallback 成功獲取數據`);
            ohlcvData[ticker] = cseResult;
            continue;  // 成功獲取，繼續處理下一個
          } else {
            Logger.log(`P5 Daily：${ticker} CSE fallback 也失敗，跳過此股票`);
            continue;  // 跳過此股票，繼續處理下一個
          }
        } catch (cseError) {
          Logger.log(`P5 Daily：${ticker} CSE fallback 失敗：${cseError.message}`);
          continue;  // 跳過此股票，繼續處理下一個
        }
      }
      
      // 檢查是否為 "no data" 錯誤（stooq.com 對某些股票沒有數據）
      if (csvText.toLowerCase().includes("no data") || csvText.toLowerCase().includes("nodata")) {
        Logger.log(`P5 Daily：${ticker} stooq.com 返回 "no data"，此股票在 stooq.com 中沒有數據`);
        
        // 對於台股，直接使用 TWSE/TPEX（不依賴 stooq.com）
        if (stooqTicker.includes('.tw')) {
          Logger.log(`P5 Daily：${ticker} 是台股，stooq.com 沒有數據，直接使用 TWSE/TPEX 數據源`);
          
          try {
            const twseResult = collectOHLCVDataViaTWSE(ticker);
            if (twseResult && twseResult.status === "SUCCESS") {
              Logger.log(`P5 Daily：${ticker} 通過 TWSE/TPEX 成功獲取數據`);
              ohlcvData[ticker] = twseResult;
              continue;  // 成功獲取，繼續處理下一個
            } else {
              Logger.log(`P5 Daily：${ticker} TWSE/TPEX 獲取失敗，返回結果：${JSON.stringify(twseResult)}`);
              ohlcvData[ticker] = {
                ticker: ticker,
                error: "TWSE/TPEX 無法獲取此股票的數據",
                status: "NO_DATA",
                source: "TWSE/TPEX",
                suggestion: "檢查股票代碼是否正確，或股票是否已下市"
              };
              continue;  // 跳過此股票，繼續處理下一個
            }
          } catch (twseError) {
            Logger.log(`P5 Daily：${ticker} TWSE/TPEX fallback 異常：${twseError.message}`);
            Logger.log(`P5 Daily：${ticker} 錯誤堆疊：${twseError.stack}`);
            ohlcvData[ticker] = {
              ticker: ticker,
              error: `TWSE/TPEX fallback 異常：${twseError.message}`,
              status: "NO_DATA",
              source: "TWSE/TPEX",
              suggestion: "檢查網絡連接或 API 可用性"
            };
            continue;  // 跳過此股票，繼續處理下一個
          }
        } else {
          // 其他市場也返回 no data，跳過
          Logger.log(`P5 Daily：${ticker} stooq.com 沒有數據，跳過此股票`);
          continue;
        }
      }
      
      if (lines.length < 2) {
        Logger.log(`P5 Daily：${ticker} CSV 數據不足（只有 ${lines.length} 行）`);
        Logger.log(`CSV 內容預覽：${csvText.substring(0, 200)}`);
        
        // 特殊情況：如果只有標題行，可能是該股票在 stooq.com 中沒有數據
        // 嘗試使用 CSE fallback 機制
        if (lines.length === 1 && lines[0].includes('Date')) {
          Logger.log(`P5 Daily：${ticker} 在 stooq.com 中沒有數據，嘗試使用 CSE fallback 機制`);
          
          try {
            const cseResult = collectOHLCVDataViaCSE(ticker, stooqTicker);
            if (cseResult) {
              Logger.log(`P5 Daily：${ticker} 通過 CSE fallback 成功獲取數據`);
              ohlcvData[ticker] = cseResult;
              continue;  // 成功獲取，繼續處理下一個
            } else {
              Logger.log(`P5 Daily：${ticker} CSE fallback 也失敗，跳過此股票`);
              continue;  // 跳過此股票，繼續處理下一個
            }
          } catch (cseError) {
            Logger.log(`P5 Daily：${ticker} CSE fallback 失敗：${cseError.message}`);
            continue;  // 跳過此股票，繼續處理下一個
          }
        } else {
          // 其他情況：拋出錯誤
          throw new Error("CSV 數據不足");
        }
      }
      
      // 解析 CSV（跳過標題行，取最後一行作為最新數據）
      // stooq.com 格式：Date,Open,High,Low,Close,Volume
      const lastLine = lines[lines.length - 1];
      const values = lastLine.split(',');
      
      if (values.length < 6) {
        Logger.log(`P5 Daily：${ticker} CSV 格式錯誤（只有 ${values.length} 個欄位）`);
        Logger.log(`最後一行內容：${lastLine}`);
        throw new Error("CSV 格式錯誤");
      }
      
      const dateStr = values[0].trim();
      const open = parseFloat(values[1]);
      const high = parseFloat(values[2]);
      const low = parseFloat(values[3]);
      const close = parseFloat(values[4]);
      const volume = parseFloat(values[5]);
      
      // 驗證數據有效性
      if (isNaN(close) || close <= 0) {
        throw new Error(`無效的收盤價：${close}`);
      }
      
      // 解析日期（格式：YYYYMMDD）
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const date = new Date(year, month, day);
      
      ohlcvData[ticker] = {
        ticker: ticker,
        date: date,
        open: open,
        high: high,
        low: low,
        close: close,
        volume: volume,
        adj_close: close,  // stooq.com 的 CSV 不包含 adj_close，使用 close
        source: "stooq.com",
        status: "COMPLETED"
      };
      
      Logger.log(`P5 Daily：成功收集 ${ticker} OHLCV 數據（日期：${dateStr}，收盤價：${close}）`);
      
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
 * 格式化股票代碼以符合 stooq.com 格式
 * 
 * Stooq 官方格式規則（SSOT）：
 * - 美股：<symbol>.us（小寫，如 AAPL.us）
 * - 台股：<股票代碼>.tw（小寫，如 2330.tw）
 * - 日股：<股票代碼>.jp（小寫，如 7203.jp）
 * - 指數：^<symbol>（小寫，如 ^twii, ^nikkei, ^spx）
 * - FX：無點無斜線（如 usdjpy, eurusd）
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
 * 通過 TWSE/TPEX 獲取台股 OHLCV 數據（Fallback 機制）
 * 
 * 當 stooq.com 返回 "no data" 時，使用 TWSE/TPEX 官方數據源
 * 
 * @param {string} ticker - 台股代碼（例如 "2330"）
 * @returns {Object|null} ohlcvData - OHLCV 數據，如果失敗則返回 null
 */
function collectOHLCVDataViaTWSE(ticker) {
  try {
    Logger.log(`P5 Daily：開始 TWSE/TPEX fallback 搜尋 ${ticker}`);
    
    // 移除可能的 .tw 後綴
    const stockCode = ticker.replace(/\.tw$/i, '');
    
    // 判斷是上市（TWSE）還是上櫃（TPEX）
    // 上市股票：通常 4 位數字，範圍較廣
    // 上櫃股票：通常也是 4 位數字，但範圍不同
    // 這裡先嘗試 TWSE，如果失敗再嘗試 TPEX
    
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
    // TWSE API：獲取最近一個月的數據
    // 格式：https://www.twse.com.tw/exchangeReport/STOCK_DAY.php?response=json&date=20250101&stockNo=2330
    // 注意：TWSE API 需要查詢當月或上個月的數據，不能查詢未來日期
    
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth() + 1;
    let day = today.getDate();
    
    // 如果今天是月初（1-3號），可能需要查詢上個月的數據（因為當月數據可能還不完整）
    // 但先嘗試當月數據
    const dateStr = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    
    const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY.php?response=json&date=${dateStr}&stockNo=${stockCode}`;
    
    Logger.log(`P5 Daily：TWSE API URL：${url}`);
    
    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        "Referer": "https://www.twse.com.tw/"
      }
    });
    
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`P5 Daily：TWSE API 響應狀態碼：${statusCode}`);
    Logger.log(`P5 Daily：TWSE API 響應內容預覽：${responseText.substring(0, 500)}`);
    
    if (statusCode !== 200) {
      throw new Error(`TWSE API 返回 HTTP ${statusCode}：${responseText.substring(0, 200)}`);
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      Logger.log(`P5 Daily：TWSE API 響應不是有效的 JSON：${responseText.substring(0, 500)}`);
      throw new Error(`TWSE API 返回非 JSON 格式：${parseError.message}`);
    }
    
    // TWSE API 返回格式：
    // {
    //   "stat": "OK" 或 "查詢無資料" 或其他錯誤訊息,
    //   "data": [
    //     ["日期", "成交股數", "成交金額", "開盤價", "最高價", "最低價", "收盤價", "漲跌價差", "成交筆數"],
    //     ...
    //   ],
    //   "fields": ["日期", "成交股數", ...]
    // }
    
    Logger.log(`P5 Daily：TWSE API 返回 stat：${data.stat}`);
    
    if (data.stat !== "OK") {
      // 如果查詢當月失敗，嘗試查詢上個月
      if (data.stat === "查詢無資料" || data.stat.includes("無資料")) {
        Logger.log(`P5 Daily：當月數據無資料，嘗試查詢上個月數據`);
        
        // 計算上個月的日期
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
          prevMonth = 12;
          prevYear = year - 1;
        }
        
        // 使用上個月的最後一天
        const lastDayOfPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
        const prevDateStr = `${prevYear}${String(prevMonth).padStart(2, '0')}${String(lastDayOfPrevMonth).padStart(2, '0')}`;
        const prevUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY.php?response=json&date=${prevDateStr}&stockNo=${stockCode}`;
        
        Logger.log(`P5 Daily：嘗試上個月 TWSE API URL：${prevUrl}`);
        
        const prevResponse = UrlFetchApp.fetch(prevUrl, {
          method: "GET",
          muteHttpExceptions: true,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
            "Referer": "https://www.twse.com.tw/"
          }
        });
        
        const prevStatusCode = prevResponse.getResponseCode();
        const prevResponseText = prevResponse.getContentText();
        
        if (prevStatusCode === 200) {
          const prevData = JSON.parse(prevResponseText);
          if (prevData.stat === "OK" && prevData.data && prevData.data.length > 0) {
            Logger.log(`P5 Daily：上個月數據獲取成功，共 ${prevData.data.length} 筆`);
            return prevData.data;
          }
        }
      }
      
      throw new Error(`TWSE API 返回錯誤：${data.stat}`);
    }
    
    if (!data.data || data.data.length === 0) {
      throw new Error("TWSE API 返回空數據（stat=OK 但 data 為空）");
    }
    
    Logger.log(`P5 Daily：TWSE API 成功獲取 ${data.data.length} 筆數據`);
    return data.data;
    
  } catch (error) {
    Logger.log(`P5 Daily：TWSE 獲取錯誤：${error.message}`);
    Logger.log(`P5 Daily：TWSE 錯誤堆疊：${error.stack}`);
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
    // TPEX API：獲取最近一個月的數據
    // 格式：https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43.php?l=zh-tw&d=114/01&stkno=2330
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
    
    // TPEX 可能返回 JSON 或 HTML，需要解析
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      // 如果不是 JSON，可能是 HTML，需要解析 HTML
      throw new Error("TPEX API 返回 HTML 而非 JSON，需要解析 HTML");
    }
    
    // TPEX API 返回格式可能不同，需要根據實際情況調整
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
    // TWSE 數據格式：
    // ["日期", "成交股數", "成交金額", "開盤價", "最高價", "最低價", "收盤價", "漲跌價差", "成交筆數"]
    // 例如：["113/01/15", "12345678", "1234567890", "500.00", "510.00", "495.00", "505.00", "5.00", "12345"]
    // 注意：數據是從新到舊排列，第一筆是最新的
    
    if (!twseData || twseData.length === 0) {
      Logger.log(`P5 Daily：TWSE 數據為空，無法格式化`);
      return null;
    }
    
    Logger.log(`P5 Daily：TWSE 數據筆數：${twseData.length}`);
    Logger.log(`P5 Daily：TWSE 第一筆數據：${JSON.stringify(twseData[0])}`);
    
    // 獲取最新一筆數據（第一筆）
    const latest = twseData[0];
    
    if (!latest || latest.length < 7) {
      Logger.log(`P5 Daily：TWSE 數據格式錯誤，欄位不足：${JSON.stringify(latest)}`);
      return null;
    }
    
    // 解析日期（民國年格式：113/01/15）
    const dateStr = String(latest[0]).trim(); // "113/01/15"
    Logger.log(`P5 Daily：TWSE 日期字串：${dateStr}`);
    
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) {
      Logger.log(`P5 Daily：TWSE 日期格式錯誤：${dateStr}`);
      return null;
    }
    
    const year = parseInt(dateParts[0]);
    const month = dateParts[1];
    const day = dateParts[2];
    const adYear = year + 1911; // 轉換為西元年
    const date = `${adYear}-${month}-${day}`;
    
    Logger.log(`P5 Daily：TWSE 轉換後日期：${date}`);
    
    // 解析數據（移除千分位逗號）
    const volumeStr = String(latest[1]).replace(/,/g, '');
    const openStr = String(latest[3]).replace(/,/g, '');
    const highStr = String(latest[4]).replace(/,/g, '');
    const lowStr = String(latest[5]).replace(/,/g, '');
    const closeStr = String(latest[6]).replace(/,/g, '');
    
    const volume = parseFloat(volumeStr) || 0; // 成交股數
    const open = parseFloat(openStr) || 0; // 開盤價
    const high = parseFloat(highStr) || 0; // 最高價
    const low = parseFloat(lowStr) || 0; // 最低價
    const close = parseFloat(closeStr) || 0; // 收盤價
    
    Logger.log(`P5 Daily：TWSE 解析結果 - 日期：${date}, 開：${open}, 高：${high}, 低：${low}, 收：${close}, 量：${volume}`);
    
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
      adj_close: close, // TWSE 沒有調整後收盤價，使用收盤價
      source: "TWSE",
      status: "SUCCESS"
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：TWSE 數據格式轉換錯誤：${error.message}`);
    Logger.log(`P5 Daily：TWSE 錯誤堆疊：${error.stack}`);
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
    // TPEX 數據格式可能與 TWSE 類似，但需要根據實際 API 返回調整
    // 這裡先使用與 TWSE 相同的格式假設
    
    if (!tpexData || tpexData.length === 0) {
      return null;
    }
    
    // 獲取最新一筆數據（第一筆）
    const latest = tpexData[0];
    
    // 解析日期和數據（格式可能與 TWSE 相同）
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

/**
 * 通過 CSE 搜尋獲取 OHLCV 數據（Fallback 機制）
 * 
 * 當直接 URL 失敗時，使用 CSE 搜尋 stooq.com 或其他數據源
 * 
 * @param {string} ticker - 原始股票代碼
 * @param {string} stooqTicker - stooq.com 格式的代碼
 * @returns {Object|null} ohlcvData - OHLCV 數據，如果失敗則返回 null
 */
function collectOHLCVDataViaCSE(ticker, stooqTicker) {
  try {
    Logger.log(`P5 Daily：開始 CSE fallback 搜尋 ${ticker} (${stooqTicker})`);
    
    // 1. 構建搜尋查詢
    // 嘗試多種搜尋策略
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
          
          // 記錄搜尋結果的連結（用於調試）
          if (searchResults.length > 0) {
            Logger.log(`P5 Daily：搜尋結果連結預覽：`);
            searchResults.slice(0, 3).forEach((item, idx) => {
              Logger.log(`  ${idx + 1}. ${item.link || item.title || '無連結'}`);
            });
          }
          
          // 3. 從搜尋結果中尋找 stooq.com CSV 下載連結
          for (const item of searchResults) {
            const url = item.link || "";
            
            // 檢查是否為 stooq.com CSV 下載連結
            if (url.includes("stooq.com/q/d/l/") && url.includes("i=d")) {
              Logger.log(`P5 Daily：找到 stooq.com CSV 連結：${url}`);
              
              // 4. 嘗試訪問該連結
              try {
                const response = UrlFetchApp.fetch(url, {
                  method: "GET",
                  muteHttpExceptions: true,
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "text/csv,text/plain,*/*",
                    "Referer": "https://stooq.com/"
                  }
                });
                
                if (response.getResponseCode() === 200) {
                  const csvText = response.getContentText();
                  const lines = csvText.trim().split('\n');
                  
                  if (lines.length >= 2) {
                    // 成功獲取數據，解析並返回
                    Logger.log(`P5 Daily：CSE fallback 成功獲取 ${ticker} 數據（${lines.length} 行）`);
                    return parseStooqCSV(ticker, csvText);
                  }
                }
              } catch (fetchError) {
                Logger.log(`P5 Daily：訪問 CSE 搜尋結果連結失敗：${fetchError.message}`);
                continue;  // 嘗試下一個結果
              }
            }
          }
          
          // 如果搜尋結果中有任何 stooq.com 的連結，確認 stooq.com 可訪問
          // 然後直接構建 CSV URL（因為我們已經知道格式）
          const hasStooqLink = searchResults.some(item => {
            const url = item.link || "";
            return url.includes("stooq.com");
          });
          
          if (hasStooqLink) {
            Logger.log(`P5 Daily：搜尋結果確認 stooq.com 可訪問，使用 Cloud Run 代理訪問 CSV URL`);
            
            // 使用 Cloud Run 代理訪問 CSV URL（因為 GAS 無法直接訪問 stooq.com）
            const properties = PropertiesService.getScriptProperties();
            const cloudFunctionUrl = properties.getProperty("CLOUD_FUNCTION_STOOQ_URL");
            
            if (cloudFunctionUrl) {
              Logger.log(`P5 Daily：通過 Cloud Run 代理訪問：${cloudFunctionUrl}?ticker=${encodeURIComponent(stooqTicker)}`);
              
              try {
                const response = UrlFetchApp.fetch(`${cloudFunctionUrl}?ticker=${encodeURIComponent(stooqTicker)}`, {
                  method: "GET",
                  muteHttpExceptions: true,
                  followRedirects: true
                });
                
                const statusCode = response.getResponseCode();
                const csvText = response.getContentText();
                
                if (statusCode === 200) {
                  // 檢查是否為訪問限制錯誤
                  if (csvText.includes("Exceeded the daily hits limit") || csvText.includes("daily hits limit")) {
                    Logger.log(`P5 Daily：代理也遇到訪問限制，無法獲取數據`);
                    continue;  // 嘗試下一個查詢
                  }
                  
                  const lines = csvText.trim().split('\n');
                  
                  if (lines.length >= 2) {
                    Logger.log(`P5 Daily：通過代理成功獲取 ${ticker} 數據（${lines.length} 行）`);
                    return parseStooqCSV(ticker, csvText);
                  } else {
                    Logger.log(`P5 Daily：代理返回數據不足（${lines.length} 行）`);
                    Logger.log(`P5 Daily：CSV 內容預覽：${csvText.substring(0, 200)}`);
                  }
                } else {
                  Logger.log(`P5 Daily：代理返回 HTTP ${statusCode}`);
                  Logger.log(`P5 Daily：響應內容：${csvText.substring(0, 200)}`);
                }
              } catch (proxyError) {
                Logger.log(`P5 Daily：代理訪問失敗：${proxyError.message}`);
              }
            } else {
              Logger.log(`P5 Daily：Cloud Run 代理未配置，無法通過代理訪問`);
            }
          } else {
            Logger.log(`P5 Daily：CSE 搜尋結果中沒有找到 stooq.com 連結`);
          }
        }
      } catch (searchError) {
        Logger.log(`P5 Daily：CSE 搜尋失敗：${searchError.message}`);
        continue;  // 嘗試下一個查詢
      }
    }
    
    Logger.log(`P5 Daily：所有 CSE fallback 嘗試都失敗`);
    return null;
    
  } catch (error) {
    Logger.log(`P5 Daily：CSE fallback 機制錯誤：${error.message}`);
    return null;
  }
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
    source: "stooq.com (via CSE)"
  };
}

/**
 * 計算技術指標
 * 
 * @param {Array} tickers - 股票代碼列表
 * @returns {Object} indicatorsData - 技術指標數據
 */
function calculateTechnicalIndicators(tickers) {
  const indicatorsData = {};
  
  for (const ticker of tickers) {
    try {
      // 從 MARKET_OHLCV_DAILY 讀取歷史數據（如果不足，會自動從 stooq.com 補充）
      const historicalData = getHistoricalOHLCV(ticker, 240, true);  // 獲取 240 天數據（用於 MA240）
      
      // 檢查數據充足性（至少需要 26 天用於 MACD）
      if (!historicalData || historicalData.length < 26) {
        Logger.log(`P5 Daily：${ticker} 歷史數據不足（${historicalData ? historicalData.length : 0}/26），跳過技術指標計算`);
        indicatorsData[ticker] = {
          ticker: ticker,
          error: `歷史數據不足（需要至少 26 天，目前 ${historicalData ? historicalData.length : 0} 天）`,
          status: "INSUFFICIENT_DATA"
        };
        continue;
      }
      
      // 計算技術指標（按所需最小數據量分級計算）
      const indicators = {
        ticker: ticker,
        date: new Date()
      };
      
      // RSI（需要至少 15 天）
      if (historicalData.length >= 15) {
        indicators.rsi_14 = calculateRSI(historicalData, 14);
      }
      
      // MACD（需要至少 26 天）
      if (historicalData.length >= 26) {
        indicators.macd = calculateMACD(historicalData);
      }
      
      // ATR（需要至少 15 天）
      if (historicalData.length >= 15) {
        indicators.atr_14 = calculateATR(historicalData, 14);
      }
      
      // MA（按可用數據計算）
      if (historicalData.length >= 20) {
        indicators.ma20 = calculateMA(historicalData, 20);
      }
      if (historicalData.length >= 60) {
        indicators.ma60 = calculateMA(historicalData, 60);
      }
      if (historicalData.length >= 240) {
        indicators.ma240 = calculateMA(historicalData, 240);
      }
      
      indicators.status = "COMPLETED";
      indicatorsData[ticker] = indicators;
    } catch (error) {
      Logger.log(`P5 Daily：計算 ${ticker} 技術指標失敗：${error.message}`);
      indicatorsData[ticker] = {
        ticker: ticker,
        error: error.message,
        status: "ERROR"
      };
    }
  }
  
  return indicatorsData;
}

/**
 * 收集板塊 ETF 數據
 * 
 * @returns {Object} sectorETFData - 板塊 ETF 數據
 */
function collectSectorETFData() {
  // 標準美股板塊 ETF（SPDR Sector ETFs）
  const sectorETFs = [
    { ticker: "XLK", sector: "Technology" },
    { ticker: "XLF", sector: "Financials" },
    { ticker: "XLE", sector: "Energy" },
    { ticker: "XLV", sector: "Healthcare" },
    { ticker: "XLI", sector: "Industrials" },
    { ticker: "XLP", sector: "Consumer Staples" },
    { ticker: "XLY", sector: "Consumer Discretionary" },
    { ticker: "XLU", sector: "Utilities" },
    { ticker: "XLB", sector: "Materials" },
    { ticker: "XLRE", sector: "Real Estate" },
    { ticker: "XLC", sector: "Communication Services" }
  ];
  
  const sectorETFData = {};
  
  Logger.log(`P5 Daily：開始收集 ${sectorETFs.length} 個板塊 ETF 數據`);
  
  for (const etf of sectorETFs) {
    try {
      // 從 stooq.com 獲取 ETF 數據（通過代理）
      const stooqTicker = formatTickerForStooq(etf.ticker);
      
      Logger.log(`P5 Daily：收集 ${etf.ticker} 數據（通過代理）`);
      
      // 使用 Cloud Function 代理（GAS 無法直接訪問 stooq.com）
      const properties = PropertiesService.getScriptProperties();
      const cloudFunctionUrl = properties.getProperty("CLOUD_FUNCTION_STOOQ_URL");
      
      if (!cloudFunctionUrl) {
        Logger.log(`P5 Daily：收集 ${etf.ticker} 數據失敗：未配置 Cloud Function 代理 URL`);
        continue;
      }
      
      const response = UrlFetchApp.fetch(`${cloudFunctionUrl}?ticker=${encodeURIComponent(stooqTicker)}`, {
        method: "GET",
        muteHttpExceptions: true,
        followRedirects: true
      });
      
      if (response.getResponseCode() !== 200) {
        Logger.log(`P5 Daily：${etf.ticker} HTTP ${response.getResponseCode()} 錯誤`);
        continue;
      }
      
      const csvText = response.getContentText();
      
      if (csvText.trim().startsWith('<') || csvText.includes('<!DOCTYPE')) {
        Logger.log(`P5 Daily：${etf.ticker} 返回 HTML 而非 CSV`);
        continue;
      }
      
      const lines = csvText.trim().split('\n');
      
      if (lines.length < 2) {
        Logger.log(`P5 Daily：${etf.ticker} CSV 數據不足`);
        continue;
      }
      
      // 解析 CSV（取最後一行作為最新數據）
      const lastLine = lines[lines.length - 1];
      const values = lastLine.split(',');
      
      if (values.length < 6) {
        Logger.log(`P5 Daily：${etf.ticker} CSV 格式錯誤`);
        continue;
      }
      
      const dateStr = values[0].trim();
      const close = parseFloat(values[4]);
      
      if (isNaN(close) || close <= 0) {
        Logger.log(`P5 Daily：${etf.ticker} 無效的收盤價`);
        continue;
      }
      
      // 計算週表現和月表現（需要歷史數據）
      let weekPerformance = null;
      let monthPerformance = null;
      
      if (lines.length >= 6) {
        // 週表現：比較 5 個交易日前的收盤價
        const weekAgoLine = lines[lines.length - 6];
        const weekAgoValues = weekAgoLine.split(',');
        if (weekAgoValues.length >= 5) {
          const weekAgoClose = parseFloat(weekAgoValues[4]);
          if (!isNaN(weekAgoClose) && weekAgoClose > 0) {
            weekPerformance = ((close - weekAgoClose) / weekAgoClose) * 100;
          }
        }
      }
      
      if (lines.length >= 22) {
        // 月表現：比較 21 個交易日前的收盤價（約一個月）
        const monthAgoLine = lines[lines.length - 22];
        const monthAgoValues = monthAgoLine.split(',');
        if (monthAgoValues.length >= 5) {
          const monthAgoClose = parseFloat(monthAgoValues[4]);
          if (!isNaN(monthAgoClose) && monthAgoClose > 0) {
            monthPerformance = ((close - monthAgoClose) / monthAgoClose) * 100;
          }
        }
      }
      
      sectorETFData[etf.ticker] = {
        etf_ticker: etf.ticker,
        sector: etf.sector,
        date: new Date(),
        close: close,
        week_performance: weekPerformance ? Math.round(weekPerformance * 100) / 100 : null,
        month_performance: monthPerformance ? Math.round(monthPerformance * 100) / 100 : null,
        status: "COMPLETED"
      };
      
      Logger.log(`P5 Daily：成功收集 ${etf.ticker} (${etf.sector}) 數據（收盤價：${close}）`);
      
      // 避免請求過快
      Utilities.sleep(300);
      
    } catch (error) {
      Logger.log(`P5 Daily：收集 ${etf.ticker} 數據失敗：${error.message}`);
      sectorETFData[etf.ticker] = {
        etf_ticker: etf.ticker,
        sector: etf.sector,
        error: error.message,
        status: "ERROR"
      };
    }
  }
  
  Logger.log(`P5 Daily：完成收集，成功 ${Object.keys(sectorETFData).filter(k => sectorETFData[k].status === "COMPLETED").length}/${sectorETFs.length} 個 ETF`);
  
  return sectorETFData;
}

/**
 * 收集衍生品數據
 * 
 * @param {Array} tickers - 股票代碼列表
 * @returns {Object} derivativesData - 衍生品數據
 */
function collectDerivativesData(tickers) {
  const derivativesData = {};
  
  // 分類股票：美股、台股、日股
  const usTickers = tickers.filter(t => {
    return /^[A-Z]+$/.test(t) && t.length <= 5 && !t.includes('.');
  });
  
  const taiwanTickers = tickers.filter(t => {
    return /^\d{4}$/.test(t) || t.toLowerCase().includes('.tw');
  });
  
  const japanTickers = tickers.filter(t => {
    return /^\d{4}$/.test(t) && !t.toLowerCase().includes('.tw') || t.toLowerCase().includes('.jp');
  });
  
  Logger.log(`P5 Daily：開始收集衍生品數據（美股：${usTickers.length}，台股：${taiwanTickers.length}，日股：${japanTickers.length}）`);
  
  // 收集美股衍生品數據
  if (usTickers.length > 0) {
    for (const ticker of usTickers) {
      try {
        const derivatives = collectUSDerivatives(ticker);
        if (derivatives) {
          derivativesData[ticker] = derivatives;
        }
        Utilities.sleep(500);
      } catch (error) {
        Logger.log(`P5 Daily：收集 ${ticker} 美股衍生品數據失敗：${error.message}`);
      }
    }
  }
  
  // 收集台股衍生品數據（TAIFEX）
  if (taiwanTickers.length > 0) {
    try {
      const taiwanDerivatives = collectTaiwanDerivatives();
      Object.assign(derivativesData, taiwanDerivatives);
    } catch (error) {
      Logger.log(`P5 Daily：收集台股衍生品數據失敗：${error.message}`);
    }
  }
  
  // 收集日股衍生品數據（JPX）
  if (japanTickers.length > 0) {
    try {
      const japanDerivatives = collectJapanDerivatives();
      Object.assign(derivativesData, japanDerivatives);
    } catch (error) {
      Logger.log(`P5 Daily：收集日股衍生品數據失敗：${error.message}`);
    }
  }
  
  const successCount = Object.keys(derivativesData).filter(k => derivativesData[k].status === "COMPLETED").length;
  Logger.log(`P5 Daily：完成衍生品數據收集，成功 ${successCount} 筆`);
  
  return derivativesData;
}

/**
 * 收集美股衍生品數據
 * 
 * @param {string} ticker - 股票代碼
 * @returns {Object} derivatives - 衍生品數據
 */
function collectUSDerivatives(ticker) {
  // TODO: 整合 OCC/CBOE/Nasdaq API
  // 目前使用 CSE 搜尋作為備選方案
  
  return {
    ticker: ticker,
    date: new Date(),
    put_call_ratio: null,
    max_oi_strike_call: null,
    max_oi_strike_put: null,
    iv_30d: null,
    days_to_opex: null,
    status: "PENDING",
    note: "需要整合 OCC/CBOE/Nasdaq API 或使用 CSE 搜尋"
  };
}

/**
 * 收集台股衍生品數據（TAIFEX）
 * 
 * @returns {Object} derivativesData - 台股衍生品數據
 */
function collectTaiwanDerivatives() {
  // TAIFEX 官方數據源：
  // 1. 期貨：https://www.taifex.com.tw/cht/3/futContractsDate
  // 2. 選擇權：https://www.taifex.com.tw/cht/3/optContractsDate
  // 3. 大戶/法人部位：https://www.taifex.com.tw/cht/3/futIndx
  
  Logger.log("P5 Daily：開始收集台股衍生品數據（TAIFEX）");
  
  const derivativesData = {};
  
  try {
    // TODO: 實現 TAIFEX 數據抓取
    // TAIFEX 提供 CSV/TXT/ZIP 格式，每天固定時間更新
    // 需要解析 HTML 頁面或直接下載 CSV 文件
    
    // 範例：收集台指選擇權數據
    const taifexOptUrl = "https://www.taifex.com.tw/cht/3/optContractsDate";
    
    // 注意：TAIFEX 可能需要處理中文編碼和表單提交
    // 這裡先標記為待實現
    
    derivativesData["TAIFEX_OPTIONS"] = {
      ticker: "TAIFEX_OPTIONS",
      date: new Date(),
      put_call_ratio: null,
      max_oi_strike_call: null,
      max_oi_strike_put: null,
      iv_30d: null,
      days_to_opex: null,
      status: "PENDING",
      note: "需要實現 TAIFEX 數據抓取邏輯"
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：收集台股衍生品數據失敗：${error.message}`);
  }
  
  return derivativesData;
}

/**
 * 收集日股衍生品數據（JPX）
 * 
 * @returns {Object} derivativesData - 日股衍生品數據
 */
function collectJapanDerivatives() {
  // JPX 官方數據源：
  // 1. 日經225選擇權：https://www.jpx.co.jp/markets/derivatives/option/closing-price/index.html
  // 2. 日經225期貨：https://www.jpx.co.jp/markets/derivatives/futures/index.html
  // 3. 交易人部位：https://www.jpx.co.jp/markets/derivatives/participant-volume/index.html
  
  Logger.log("P5 Daily：開始收集日股衍生品數據（JPX）");
  
  const derivativesData = {};
  
  try {
    // TODO: 實現 JPX 數據抓取
    // JPX 提供 CSV 格式的每日完整 option chain
    // 包含每個履約價的 Call/Put、成交量、OI、結算價
    
    // 範例：收集日經225選擇權數據
    const jpxOptUrl = "https://www.jpx.co.jp/markets/derivatives/option/closing-price/index.html";
    
    // 注意：JPX 可能需要處理日文編碼
    // 這裡先標記為待實現
    
    derivativesData["NIKKEI225_OPTIONS"] = {
      ticker: "NIKKEI225_OPTIONS",
      date: new Date(),
      put_call_ratio: null,
      max_oi_strike_call: null,
      max_oi_strike_put: null,
      iv_30d: null,
      days_to_opex: null,
      status: "PENDING",
      note: "需要實現 JPX 數據抓取邏輯"
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：收集日股衍生品數據失敗：${error.message}`);
  }
  
  return derivativesData;
}

/**
 * 從 CSE 獲取衍生品數據（輔助函數）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場（US/TW/JP）
 * @returns {Object|null} derivativesData - 衍生品數據
 */
function collectDerivativesFromCSE(ticker, market = "US") {
  // 注意：此函數需要整合 M0 CSE 搜尋功能
  // 目前返回 null，表示需要後續實現
  
  // 可以使用的搜尋策略：
  // 美股：
  // 1. 搜尋 "CBOE [ticker] put call ratio"
  // 2. 搜尋 "OCC [ticker] options data"
  // 3. 搜尋 "[ticker] implied volatility 30 day"
  
  // 台股：
  // 1. 搜尋 "TAIFEX 台指選擇權"
  // 2. 搜尋 "TAIFEX Put Call Ratio"
  
  // 日股：
  // 1. 搜尋 "JPX 日經225選擇權"
  // 2. 搜尋 "JPX Nikkei 225 options"
  
  // 由於需要 M0 整合，這裡先返回 null
  // 實際實現時應該：
  // 1. 調用 M0 的 CSE_SEARCH 功能
  // 2. 使用 P5_DERIVATIVES_US/TAIWAN/JAPAN CSE 配置（按市場分開）
  // 3. 解析搜尋結果提取數據
  
  return null;
}

/**
 * 收集宏觀數據（油價、貴金屬、匯率、國債利率等）
 * 
 * ⭐ V8.0 修正：此函數已被 24_P5_DAILY_MACRO.js 中的 collectMacroData() 取代
 * 該函數使用 fetchMacroDataFromStooq()，有完善的錯誤處理、重試機制和備用方案
 * 
 * 注意：由於函數名相同，在 Google Apps Script 中會自動使用最後定義的版本
 * 因此 24_P5_DAILY_MACRO.js 中的 collectMacroData() 會覆蓋此函數
 * 
 * @returns {Object} macroData - 宏觀數據
 */
// ⭐ V8.0 修正：此函數已被 24_P5_DAILY_MACRO.js 中的 collectMacroData() 取代
// 該函數使用 fetchMacroDataFromStooq()，有完善的錯誤處理、重試機制和備用方案
// 
// 注意：在 Google Apps Script 中，如果兩個文件都定義了同名的函數，會使用最後定義的版本
// 為了確保使用 24_P5_DAILY_MACRO.js 中的版本，此函數定義已被刪除
// 如果此函數被調用，會自動使用 24_P5_DAILY_MACRO.js 中的版本
//
// 如果出現 "collectMacroData is not defined" 錯誤，請檢查：
// 1. 24_P5_DAILY_MACRO.js 是否已正確上傳
// 2. 文件加載順序（確保 24_P5_DAILY_MACRO.js 在 24_P5_DAILY.js 之後加載）

/**
 * ⚠️ V8.12 廢棄：此函數已移至 24_P5_DAILY_NEWS.js
 * 
 * 新的 collectNewsAtoms 函數在 24_P5_DAILY_NEWS.js 中實現，支持：
 * - 一般新聞收集（不依賴tickers）
 * - 多語去重（Gemini Pro）
 * - 多維度標籤分類
 * - 新聞驗證機制
 * 
 * ⭐ V8.13 修正：已刪除此舊版本函數，避免函數名稱衝突
 * 所有調用都應該使用 24_P5_DAILY_NEWS.js 中的新版本
 */

/**
 * 檢查台股掛單（整合台股掛單監控）
 * 
 * @param {Array} tickers - 股票代碼列表
 * @returns {Object} checkResult - 檢查結果
 */
function checkTaiwanOrders(tickers) {
  try {
    // 只檢查台灣股票
    const taiwanTickers = tickers.filter(t => isTaiwanStock(t));
    
    if (taiwanTickers.length === 0) {
      return {
        checked: 0,
        triggered: 0
      };
    }
    
    // 獲取當前價格（從 OHLCV 數據）
    const triggeredOrders = [];
    
    for (const ticker of taiwanTickers) {
      const currentPrice = getCurrentPrice(ticker);
      if (!currentPrice) {
        Logger.log(`P5 Daily：無法獲取 ${ticker} 當前價格，跳過掛單檢查`);
        continue;
      }
      
      // 調用台股掛單監控函數檢查
      try {
        const triggered = checkTaiwanOrderTriggered(ticker, currentPrice);
        if (triggered && triggered.length > 0) {
          triggeredOrders.push(...triggered);
          Logger.log(`P5 Daily：${ticker} 有 ${triggered.length} 筆掛單已觸發`);
        }
      } catch (error) {
        Logger.log(`P5 Daily：檢查 ${ticker} 掛單失敗：${error.message}`);
      }
    }
    
    return {
      checked: taiwanTickers.length,
      triggered: triggeredOrders.length,
      triggered_orders: triggeredOrders
    };
  } catch (error) {
    Logger.log(`P5 Daily：檢查台股掛單失敗：${error.message}`);
    return {
      checked: 0,
      triggered: 0,
      error: error.message
    };
  }
}

// ==========================================
// 數據保存函數
// ==========================================

/**
 * 保存每日數據到表格
 * 
 * @param {Object} collectionResult - 收集結果
 */
function saveDailyDataToSheets(collectionResult) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  
  // 保存 OHLCV 數據
  if (collectionResult.ohlcv) {
    saveOHLCVToSheet(collectionResult.ohlcv, today);
  }
  
  // 保存技術指標
  if (collectionResult.technical_indicators) {
    saveTechnicalIndicatorsToSheet(collectionResult.technical_indicators, today);
  }
  
  // 保存板塊 ETF 數據
  if (collectionResult.sector_etf) {
    saveSectorETFToSheet(collectionResult.sector_etf, today);
  }
  
  // 保存衍生品數據
  if (collectionResult.derivatives) {
    saveDerivativesToSheet(collectionResult.derivatives, today);
  }
  
  // 保存宏觀數據（油價、貴金屬、匯率、國債利率等）
  if (collectionResult.macro_data) {
    saveMacroDataToSheet(collectionResult.macro_data, today);
  }
  
  // 保存新聞原子化數據
  if (collectionResult.news_atoms) {
    saveNewsAtomsToSheet(collectionResult.news_atoms, today);
  }
  
  Logger.log("P5 Daily：數據已保存到表格");
}

/**
 * 更新 P5 Daily 狀態
 * 
 * @param {Object} collectionResult - 收集結果
 */
function updateP5DailyStatus(collectionResult) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P5__DAILY_STATUS");
  
  if (!sheet) {
    sheet = ss.insertSheet("P5__DAILY_STATUS");
    sheet.appendRow(P5_DAILY_STATUS_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  const ohlcvCount = Object.keys(collectionResult.ohlcv || {}).length;
  const sectorETFCount = Object.keys(collectionResult.sector_etf || {}).length;
  const derivativesCount = Object.keys(collectionResult.derivatives || {}).length;
  const macroDataCount = Object.keys(collectionResult.macro_data?.commodities || {}).length + 
                         Object.keys(collectionResult.macro_data?.currencies || {}).length +
                         Object.keys(collectionResult.macro_data?.bonds || {}).length +
                         Object.keys(collectionResult.macro_data?.indices || {}).length;
  const newsAtomsCount = Object.keys(collectionResult.news_atoms || {}).length;
  
  sheet.appendRow([
    new Date(),
    "COMPLETED",
    ohlcvCount,
    sectorETFCount,
    derivativesCount,
    newsAtomsCount,
    new Date()
  ]);
  
  Logger.log(`P5 Daily 狀態已更新：OHLCV=${ohlcvCount}, ETF=${sectorETFCount}, Derivatives=${derivativesCount}, Macro=${macroDataCount}, News=${newsAtomsCount}`);
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 獲取持倉股票列表
 * 
 * @returns {Array} tickers - 股票代碼列表
 */
function getHoldingsTickers() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("HOLDINGS");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Daily：HOLDINGS 表格不存在或沒有數據，嘗試從 P4 快照讀取");
      
      // Fallback：從 P4 快照讀取
      try {
        const p4Snapshot = getLatestP4Snapshot();
        if (p4Snapshot && p4Snapshot.allocations_json) {
          const allocations = typeof p4Snapshot.allocations_json === 'string' 
            ? JSON.parse(p4Snapshot.allocations_json) 
            : p4Snapshot.allocations_json;
          
          const tickers = [];
          if (allocations && allocations.allocations) {
            for (const alloc of allocations.allocations) {
              if (alloc.ticker && alloc.status === "ACTIVE") {
                tickers.push(alloc.ticker);
              }
            }
          }
          
          if (tickers.length > 0) {
            Logger.log(`P5 Daily：從 P4 快照讀取到 ${tickers.length} 檔持倉股票`);
            return tickers;
          }
        }
      } catch (error) {
        Logger.log(`P5 Daily：從 P4 快照讀取失敗：${error.message}`);
      }
      
      Logger.log("P5 Daily：無法獲取持倉股票列表，返回空數組");
      return [];
    }
    
    // 從 HOLDINGS 表格讀取
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const statusCol = headers.indexOf("status");
    
    if (tickerCol === -1) {
      Logger.log("P5 Daily：HOLDINGS 表格缺少 ticker 欄位");
      return [];
    }
    
    const tickers = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const ticker = row[tickerCol];
      const status = statusCol !== -1 ? row[statusCol] : "ACTIVE";
      
      // 只包含 ACTIVE 狀態的持倉
      if (ticker && status === "ACTIVE") {
        tickers.push(ticker);
      }
    }
    
    Logger.log(`P5 Daily：從 HOLDINGS 表格讀取到 ${tickers.length} 檔持倉股票`);
    return tickers;
    
  } catch (error) {
    Logger.log(`P5 Daily：獲取持倉股票列表失敗：${error.message}`);
    return [];
  }
}

/**
 * 獲取歷史 OHLCV 數據
 * 
 * @param {string} ticker - 股票代碼
 * @param {number} days - 天數
 * @param {boolean} fetchFromStooq - 如果表格數據不足，是否從 stooq.com 獲取
 * @returns {Array} historicalData - 歷史數據（按日期升序排列，從舊到新）
 */
function getHistoricalOHLCV(ticker, days, fetchFromStooq = true) {
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
        // 找到該 ticker 的數據
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
    
    // 按日期升序排序（從舊到新，技術指標計算需要）
    tickerData.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
      const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
      return dateA - dateB;
    });
    
    // 如果數據不足且允許從 stooq.com 獲取，則補充數據
    if (tickerData.length < days && fetchFromStooq) {
      Logger.log(`P5 Daily：${ticker} 表格數據不足（${tickerData.length}/${days}），嘗試從 stooq.com 獲取歷史數據`);
      
      try {
        const stooqTicker = formatTickerForStooq(ticker);
        
        Logger.log(`P5 Daily：從 stooq.com 獲取歷史數據：${ticker} (${stooqTicker})（通過代理）`);
        
        // 使用 Cloud Function 代理（GAS 無法直接訪問 stooq.com）
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
              
              // 合併數據（去重，保留表格中的最新數據）
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
      } catch (error) {
        Logger.log(`P5 Daily：從 stooq.com 獲取歷史數據失敗：${error.message}`);
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
 * 計算 RSI（相對強弱指標）
 * 
 * @param {Array} data - 歷史數據（按日期升序，從舊到新）
 * @param {number} period - 週期（通常為 14）
 * @returns {number} rsi - RSI 值（0-100）
 */
function calculateRSI(data, period) {
  if (data.length < period + 1) return null;
  
  // RSI 計算：使用 Wilder's Smoothing Method
  // 1. 計算價格變化
  const changes = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close);
  }
  
  // 2. 計算初始平均收益和平均損失（前 period 天）
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }
  
  avgGain = avgGain / period;
  avgLoss = avgLoss / period;
  
  // 3. 使用 Wilder's Smoothing 計算後續值
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }
  
  // 4. 計算 RSI
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return Math.round(rsi * 100) / 100;  // 保留兩位小數
}

/**
 * 計算 MACD（移動平均收斂發散指標）
 * 
 * @param {Array} data - 歷史數據（按日期升序，從舊到新）
 * @returns {Object} macd - MACD 指標
 */
function calculateMACD(data) {
  if (data.length < 26) return null;
  
  // MACD 參數：快線 12，慢線 26，信號線 9
  const fastPeriod = 12;
  const slowPeriod = 26;
  const signalPeriod = 9;
  
  // 計算 EMA12 和 EMA26
  const ema12Values = calculateEMAValues(data, fastPeriod);
  const ema26Values = calculateEMAValues(data, slowPeriod);
  
  if (!ema12Values || !ema26Values || ema12Values.length === 0 || ema26Values.length === 0) {
    return null;
  }
  
  // 計算 MACD 線（EMA12 - EMA26）
  // 需要對齊長度（取較短的長度）
  const minLength = Math.min(ema12Values.length, ema26Values.length);
  const macdValues = [];
  
  for (let i = 0; i < minLength; i++) {
    const idx12 = ema12Values.length - minLength + i;
    const idx26 = ema26Values.length - minLength + i;
    macdValues.push(ema12Values[idx12] - ema26Values[idx26]);
  }
  
  // 當前 MACD 值（最後一個）
  const macdLine = macdValues[macdValues.length - 1];
  
  // 計算信號線（MACD 的 9 日 EMA）
  const signalLine = calculateEMAFromValues(macdValues, signalPeriod);
  
  // 柱狀圖 = MACD 線 - 信號線
  const histogram = macdLine - signalLine;
  
  return {
    value: Math.round(macdLine * 100) / 100,
    signal: Math.round(signalLine * 100) / 100,
    histogram: Math.round(histogram * 100) / 100
  };
}

/**
 * 計算 EMA 值序列（指數移動平均）
 * 
 * @param {Array} data - 歷史數據（按日期升序，從舊到新）
 * @param {number} period - 週期
 * @returns {Array} emaValues - EMA 值序列
 */
function calculateEMAValues(data, period) {
  if (data.length < period) return null;
  
  const emaValues = [];
  
  // 先計算 SMA（簡單移動平均）作為初始值
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  const sma = sum / period;
  emaValues.push(sma);
  
  // 計算平滑係數
  const multiplier = 2 / (period + 1);
  
  // 計算後續 EMA 值
  for (let i = period; i < data.length; i++) {
    const ema = (data[i].close - emaValues[emaValues.length - 1]) * multiplier + emaValues[emaValues.length - 1];
    emaValues.push(ema);
  }
  
  return emaValues;
}

/**
 * 從值序列計算 EMA（用於信號線）
 * 
 * @param {Array} values - 值序列（按時間升序）
 * @param {number} period - 週期
 * @returns {number} ema - 最後一個 EMA 值
 */
function calculateEMAFromValues(values, period) {
  if (values.length < period) {
    // 如果數據不足，使用簡單平均
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }
  
  // 先計算 SMA 作為初始值
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let ema = sum / period;
  
  // 計算平滑係數
  const multiplier = 2 / (period + 1);
  
  // 計算後續 EMA 值
  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * 計算 ATR（平均真實波幅）
 * 
 * @param {Array} data - 歷史數據（按日期升序，從舊到新）
 * @param {number} period - 週期（通常為 14）
 * @returns {number} atr - ATR 值
 */
function calculateATR(data, period) {
  if (data.length < period + 1) return null;
  
  // 計算 True Range (TR)
  const trValues = [];
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,  // 當日最高價 - 當日最低價
      Math.abs(data[i].high - data[i - 1].close),  // 當日最高價 - 前日收盤價
      Math.abs(data[i].low - data[i - 1].close)   // 當日最低價 - 前日收盤價
    );
    trValues.push(tr);
  }
  
  // 計算 ATR（使用 Wilder's Smoothing，類似 RSI）
  // 初始值：前 period 個 TR 的平均值
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trValues[i];
  }
  let atr = sum / period;
  
  // 使用 Wilder's Smoothing 計算後續值
  for (let i = period; i < trValues.length; i++) {
    atr = (atr * (period - 1) + trValues[i]) / period;
  }
  
  return Math.round(atr * 100) / 100;  // 保留兩位小數
}

/**
 * 計算移動平均線（MA）
 * 
 * @param {Array} data - 歷史數據（按日期升序，從舊到新）
 * @param {number} period - 週期
 * @returns {number} ma - 移動平均值
 */
function calculateMA(data, period) {
  if (data.length < period) return null;
  
  // 取最後 period 天的收盤價計算平均值
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    sum += data[i].close;
  }
  
  return Math.round((sum / period) * 100) / 100;  // 保留兩位小數
}

/**
 * 判斷是否為台灣股票
 */
function isTaiwanStock(ticker) {
  // 台灣股票代碼通常是 4 位數字，或包含 .tw（小寫）
  return /^\d{4}$/.test(ticker) || ticker.toLowerCase().includes(".tw");
}

/**
 * 獲取當前價格
 */
function getCurrentPrice(ticker) {
  // 從 OHLCV 數據獲取最新收盤價
  const historicalData = getHistoricalOHLCV(ticker, 1);
  if (historicalData && historicalData.length > 0) {
    return historicalData[0].close;
  }
  return null;
}

// ==========================================
// 表格保存函數
// ==========================================

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

/**
 * 保存技術指標到表格
 * 
 * @param {Object} indicatorsData - 技術指標數據
 * @param {Date} date - 日期
 */
function saveTechnicalIndicatorsToSheet(indicatorsData, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("MARKET_INDICATORS_DAILY");
      sheet.appendRow(MARKET_INDICATORS_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const rows = [];
    for (const [ticker, data] of Object.entries(indicatorsData)) {
      if (data.status === "COMPLETED") {
        rows.push([
          date,
          ticker,
          data.rsi_14,
          data.macd ? data.macd.value : null,
          data.macd ? data.macd.signal : null,
          data.macd ? data.macd.histogram : null,
          data.atr_14,
          data.ma20,
          data.ma60,
          data.ma240,
          new Date()
        ]);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily：已保存 ${rows.length} 筆技術指標數據到表格`);
    }
  } catch (error) {
    Logger.log(`保存技術指標數據到表格失敗：${error.message}`);
  }
}

/**
 * 保存板塊 ETF 數據到表格
 * 
 * @param {Object} sectorETFData - 板塊 ETF 數據
 * @param {Date} date - 日期
 */
function saveSectorETFToSheet(sectorETFData, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("SECTOR_ETF_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("SECTOR_ETF_DAILY");
      sheet.appendRow(SECTOR_ETF_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const rows = [];
    for (const [ticker, data] of Object.entries(sectorETFData)) {
      if (data.status === "COMPLETED") {
        rows.push([
          date,
          data.etf_ticker,
          data.sector,
          data.close,
          data.week_performance,
          data.month_performance,
          new Date()
        ]);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily：已保存 ${rows.length} 筆板塊 ETF 數據到表格`);
    }
  } catch (error) {
    Logger.log(`保存板塊 ETF 數據到表格失敗：${error.message}`);
  }
}

/**
 * 保存衍生品數據到表格
 * 
 * @param {Object} derivativesData - 衍生品數據
 * @param {Date} date - 日期
 */
function saveDerivativesToSheet(derivativesData, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("DERIVATIVES_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("DERIVATIVES_DAILY");
      sheet.appendRow(DERIVATIVES_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const rows = [];
    for (const [ticker, data] of Object.entries(derivativesData)) {
      if (data.status === "COMPLETED" || data.status === "PENDING") {
        rows.push([
          date,
          ticker,
          data.put_call_ratio,
          data.max_oi_strike_call,
          data.max_oi_strike_put,
          data.iv_30d,
          data.days_to_opex,
          new Date()
        ]);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily：已保存 ${rows.length} 筆衍生品數據到表格`);
    }
  } catch (error) {
    Logger.log(`保存衍生品數據到表格失敗：${error.message}`);
  }
}

/**
 * 保存宏觀數據到表格
 * 
 * @param {Object} macroData - 宏觀數據
 * @param {Date} date - 日期
 */
function saveMacroDataToSheet(macroData, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("MACRO_DATA_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("MACRO_DATA_DAILY");
      sheet.appendRow(MACRO_DATA_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const rows = [];
    const dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // 保存商品價格
    if (macroData.commodities) {
      for (const [symbol, data] of Object.entries(macroData.commodities)) {
        rows.push([
          dateStr,
          "commodities",
          symbol,
          data.name || symbol,
          data.price || data.value,
          data.change || 0,
          data.change_pct || 0,
          new Date()
        ]);
      }
    }
    
    // 保存匯率
    if (macroData.currencies) {
      for (const [symbol, data] of Object.entries(macroData.currencies)) {
        rows.push([
          dateStr,
          "currencies",
          symbol,
          data.name || symbol,
          data.rate || data.value,
          data.change || 0,
          data.change_pct || 0,
          new Date()
        ]);
      }
    }
    
    // 保存國債利率
    if (macroData.bonds) {
      for (const [symbol, data] of Object.entries(macroData.bonds)) {
        rows.push([
          dateStr,
          "bonds",
          symbol,
          data.name || symbol,
          data.yield || data.value,
          data.change || 0,
          data.change_pct || 0,
          new Date()
        ]);
      }
    }
    
    // 保存市場指數
    if (macroData.indices) {
      for (const [symbol, data] of Object.entries(macroData.indices)) {
        rows.push([
          dateStr,
          "indices",
          symbol,
          data.name || symbol,
          data.value,
          data.change || 0,
          data.change_pct || 0,
          new Date()
        ]);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily：已保存 ${rows.length} 筆宏觀數據到表格`);
    }
  } catch (error) {
    Logger.log(`P5 Daily：保存宏觀數據失敗：${error.message}`);
  }
}

/**
 * 保存新聞原子化數據到表格
 * 
 * @param {Object} newsAtomsData - 新聞原子化數據
 * @param {Date} date - 日期
 */
// ⭐ V8.9 修正：此函數已移至 24_P5_DAILY_SAVE.js，這裡保留為空以避免覆蓋
// 如果出現 "saveNewsAtomsToSheet is not defined" 錯誤，請檢查 24_P5_DAILY_SAVE.js 是否已正確載入
function saveNewsAtomsToSheet(newsAtomsData, date) {
  // 調用 24_P5_DAILY_SAVE.js 中的版本
  // 注意：在 GAS 中，如果兩個文件都定義了同名函數，會使用最後定義的版本
  // 為了確保使用正確的版本，這裡直接調用（如果 24_P5_DAILY_SAVE.js 已載入，會使用該版本）
  Logger.log(`P5 Daily：調用 saveNewsAtomsToSheet（應使用 24_P5_DAILY_SAVE.js 中的版本）`);
  
  // 如果 24_P5_DAILY_SAVE.js 中的版本存在，這裡會被覆蓋
  // 如果不存在，這裡會執行（但應該不會發生，因為 24_P5_DAILY_SAVE.js 應該先載入）
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("NEWS_ATOMS_DAILY");
    
    if (!sheet) {
      sheet = ss.insertSheet("NEWS_ATOMS_DAILY");
      sheet.appendRow(NEWS_ATOMS_DAILY_SCHEMA.headers);
      sheet.setFrozenRows(1);
      Logger.log("P5 Daily：創建 NEWS_ATOMS_DAILY 表格");
    }
    
    if (!newsAtomsData || Object.keys(newsAtomsData).length === 0) {
      Logger.log("P5 Daily：無新聞原子化數據需要保存（newsAtomsData 為空）");
      return;
    }
    
    Logger.log(`P5 Daily：收到新聞數據，tickers: ${Object.keys(newsAtomsData).join(", ")}`);
    
    const dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
    const rows = [];
    
    // ⭐ V8.9 修正：處理兩種數據格式
    for (const [key, item] of Object.entries(newsAtomsData)) {
      Logger.log(`P5 Daily：處理新聞數據 - key: ${key}, status: ${item.status}, has search_results: ${!!item.search_results}`);
      
      // 檢查是否為格式 2（包含 search_results 陣列）
      if (item.search_results && Array.isArray(item.search_results) && item.status === "COMPLETED") {
        const ticker = item.ticker || key;
        Logger.log(`P5 Daily：從 ${ticker} 的 search_results 解析出 ${item.search_results.length} 筆新聞`);
        
        for (let i = 0; i < item.search_results.length; i++) {
          const result = item.search_results[i];
          const atomId = `NEWS_${dateStr}_${ticker}_${i + 1}_${Date.now()}`;
          
          // 從 CSE 搜尋結果中提取數據
          rows.push([
            dateStr,
            atomId,
            categorizeNewsByContent(result.title || result.snippet || ""),
            ticker,
            result.title || "",
            result.snippet || result.description || "",
            extractSourceFromUrl(result.link) || "未知來源",
            "MEDIUM",
            result.link || "",
            "{}",
            new Date()
          ]);
        }
      } else if (item.atom_id || item.title) {
        // 格式 1：已經解析好的格式
        rows.push([
          dateStr,
          item.atom_id || key,
          item.category || "其他",
          item.ticker || "",
          item.title || "",
          item.summary || "",
          item.source || "",
          item.importance || "MEDIUM",
          item.url || "",
          item.macro_context_json || "{}",
          item.created_at || new Date()
        ]);
      } else {
        Logger.log(`P5 Daily：跳過未知格式的新聞數據：${key}, item keys: ${Object.keys(item).join(", ")}`);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(`P5 Daily：已保存 ${rows.length} 筆新聞原子化數據到 NEWS_ATOMS_DAILY 表格`);
    } else {
      Logger.log("P5 Daily：沒有有效的新聞數據需要保存（rows.length = 0）");
    }
  } catch (error) {
    Logger.log(`保存新聞原子化數據到表格失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
  }
}
