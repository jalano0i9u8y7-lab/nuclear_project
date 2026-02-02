/**
 * 📊 P5 Daily: 衍生品期權數據收集（每日）
 * 
 * ⭐ V8.0 變更：僅收集期權數據（每日）
 * - 期權數據：VIX, SKEW, Put/Call Ratio, IV, 期權異常流向
 * - 籌碼數據（內部人、Dark Pool、13F）已移至 P5 Weekly（每週/季度）
 * 
 * @version SSOT V8.0
 * @date 2025-01-14
 */

/**
 * 收集衍生品數據
 * 
 * @param {Array} tickers - 股票代碼列表
 * @returns {Object} derivativesData - 衍生品數據
 */
function collectDerivativesData(tickers) {
  // ⭐ V8.0 版本標記：2026-01-17 17:50 - 已添加詳細日誌
  Logger.log(`P5 Daily：collectDerivativesData 版本 V8.0_20260117_1750 已載入`);
  Logger.log(`P5 Daily：collectDerivativesData 接收到的 tickers：${JSON.stringify(tickers)}`);
  
  if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
    Logger.log(`P5 Daily：⚠️ collectDerivativesData 接收到的 tickers 為空或無效`);
    return {};
  }
  
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
  Logger.log(`P5 Daily：原始 tickers=${JSON.stringify(tickers)}, 分類後 usTickers=${JSON.stringify(usTickers)}`);
  
  // 收集美股衍生品數據
  if (usTickers && usTickers.length > 0) {
    Logger.log(`P5 Daily：準備收集 ${usTickers.length} 個美股衍生品數據，tickers=${usTickers.join(', ')}`);
    for (const ticker of usTickers) {
      try {
        Logger.log(`P5 Daily：開始循環收集 ${ticker} 美股衍生品數據`);
        const derivatives = collectUSDerivatives(ticker);
        Logger.log(`P5 Daily：${ticker} 衍生品數據收集完成，返回值類型：${typeof derivatives}, 是否有 status：${!!derivatives?.status}`);
        if (derivatives) {
          derivativesData[ticker] = derivatives;
        } else {
          Logger.log(`P5 Daily：⚠️ ${ticker} 衍生品數據收集返回 null 或 undefined`);
        }
        Utilities.sleep(500);
      } catch (error) {
        Logger.log(`P5 Daily：收集 ${ticker} 美股衍生品數據失敗：${error.message}`);
        Logger.log(`P5 Daily：${ticker} 錯誤堆疊：${error.stack}`);
      }
    }
  } else {
    Logger.log(`P5 Daily：⚠️ usTickers 為空，跳過美股衍生品數據收集`);
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
  
  const successCount = Object.keys(derivativesData).filter(k => derivativesData[k].status === "COMPLETED" || derivativesData[k].status === "PARTIAL").length;
  Logger.log(`P5 Daily：完成衍生品數據收集，成功 ${successCount} 筆（包含部分數據）`);
  
  return derivativesData;
}

/**
 * 收集美股衍生品數據
 * 
 * @param {string} ticker - 股票代碼
 * @returns {Object} derivatives - 衍生品數據
 */
function collectUSDerivatives(ticker) {
  Logger.log(`P5 Daily：開始收集 ${ticker} 美股衍生品數據`);
  Logger.log(`P5 Daily：檢查 executeCSESearch 函數是否存在：${typeof executeCSESearch}`);
  
  try {
    // ⭐ 使用 CSE 搜尋獲取期權數據（P5_DERIVATIVES_US）
    // CSE 已配置為搜尋 theocc.com, cboe.com, nasdaq.com 等期權數據來源
    const jobId = `P5_DERIVATIVES_US_${ticker}_${Date.now()}`;
    const step = "CSE_SEARCH";
    const query = `${ticker} options put call ratio open interest IV implied volatility`;
    const payload = {
      search_query: query,
      cse_type: "P5_DERIVATIVES_US",
      max_results: 10
    };
    
    Logger.log(`P5 Daily：使用 CSE 搜尋 ${ticker} 期權數據，query="${query}"`);
    
    // ⭐ V8.0 修正：檢查 executeCSESearch 函數是否存在
    if (typeof executeCSESearch !== 'function') {
      Logger.log(`P5 Daily：⚠️ executeCSESearch 函數不存在，無法執行 CSE 搜尋`);
      Logger.log(`P5 Daily：⚠️ 請確認 03_M0_CORE.js 已正確載入`);
      return {
        ticker: ticker,
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "ERROR",
        note: "executeCSESearch 函數不存在，請確認 03_M0_CORE.js 已正確載入"
      };
    }
    
    // ⭐ V8.0 新增：檢查 CSE 配置是否存在
    const properties = PropertiesService.getScriptProperties();
    const cseCxId = properties.getProperty("GOOGLE_CSE_CX_P5_DERIVATIVES_US");
    if (!cseCxId) {
      Logger.log(`P5 Daily：⚠️ CSE CX ID 未配置：GOOGLE_CSE_CX_P5_DERIVATIVES_US`);
      return {
        ticker: ticker,
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "ERROR",
        note: "CSE CX ID 未配置：GOOGLE_CSE_CX_P5_DERIVATIVES_US，請在 PropertiesService 中設置"
      };
    }
    
    let cseResults;
    try {
      Logger.log(`P5 Daily：執行 CSE 搜尋，jobId=${jobId}, step=${step}, cse_type=${payload.cse_type}`);
      Logger.log(`P5 Daily：${ticker} CSE 搜尋參數：query="${query}", max_results=${payload.max_results}`);
      cseResults = executeCSESearch(jobId, step, payload);
      Logger.log(`P5 Daily：${ticker} CSE 搜尋完成，結果類型：${typeof cseResults}, 是否有 output：${!!cseResults?.output}`);
      if (cseResults?.output) {
        Logger.log(`P5 Daily：${ticker} CSE 搜尋 output 欄位：${Object.keys(cseResults.output).join(', ')}`);
        Logger.log(`P5 Daily：${ticker} CSE 搜尋 search_results 數量：${cseResults.output.search_results?.length || 0}`);
      }
    } catch (cseError) {
      Logger.log(`P5 Daily：${ticker} CSE 搜尋執行失敗：${cseError.message}`);
      Logger.log(`P5 Daily：${ticker} CSE 搜尋錯誤堆疊：${cseError.stack}`);
      return {
        ticker: ticker,
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "ERROR",
        note: `CSE 搜尋執行失敗：${cseError.message}`
      };
    }
    
    if (!cseResults) {
      Logger.log(`P5 Daily：${ticker} CSE 搜尋返回 null`);
      return {
        ticker: ticker,
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "NO_DATA",
        note: "CSE 搜尋返回 null"
      };
    }
    
    if (!cseResults.output) {
      Logger.log(`P5 Daily：${ticker} CSE 搜尋結果無 output 欄位`);
      Logger.log(`P5 Daily：${ticker} CSE 搜尋結果：${JSON.stringify(cseResults).substring(0, 500)}`);
      return {
        ticker: ticker,
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "NO_DATA",
        note: "CSE 搜尋結果無 output 欄位"
      };
    }
    
    // ⭐ V8.0 新增：檢查是否有錯誤訊息
    if (cseResults.output.error) {
      Logger.log(`P5 Daily：${ticker} CSE 搜尋返回錯誤：${cseResults.output.error}`);
      return {
        ticker: ticker,
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "ERROR",
        note: `CSE 搜尋錯誤：${cseResults.output.error}`
      };
    }
    
    if (!cseResults.output.search_results || cseResults.output.search_results.length === 0) {
      Logger.log(`P5 Daily：${ticker} CSE 搜尋無結果（search_results 為空或不存在）`);
      Logger.log(`P5 Daily：${ticker} CSE 搜尋 output：${JSON.stringify(cseResults.output).substring(0, 500)}`);
      Logger.log(`P5 Daily：${ticker} 請確認 Google CSE 後台是否正確配置 P5_DERIVATIVES_US 白名單（theocc.com, cboe.com）`);
      return {
        ticker: ticker,
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "NO_DATA",
        note: "CSE 搜尋無結果，請確認 Google CSE 後台是否正確配置 P5_DERIVATIVES_US 白名單"
      };
    }
    
    const searchResults = cseResults.output.search_results || [];
    Logger.log(`P5 Daily：${ticker} CSE 搜尋找到 ${searchResults.length} 筆結果`);
    
    // 從搜尋結果中提取期權數據
    let putCallRatio = null;
    let maxOIStrikeCall = null;
    let maxOIStrikePut = null;
    let iv30d = null;
    let daysToOpex = null;
    
    for (const result of searchResults) {
      const text = (result.snippet || result.title || "").toLowerCase();
      const link = result.link || "";
      
      // 提取 Put/Call Ratio
      if (!putCallRatio) {
        const pcrPatterns = [
          /put[-\s]?call[-\s]?ratio[：:：\s]*(\d+\.?\d*)/i,
          /p\/c[-\s]?ratio[：:：\s]*(\d+\.?\d*)/i,
          /put\/call[：:：\s]*(\d+\.?\d*)/i,
          /(\d+\.?\d*)[\s]*put[-\s]?call/i
        ];
        for (const pattern of pcrPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const value = parseFloat(match[1]);
            if (!isNaN(value) && value > 0 && value < 10) {
              putCallRatio = value;
              Logger.log(`P5 Daily：從 CSE 結果提取 ${ticker} Put/Call Ratio = ${putCallRatio}`);
              break;
            }
          }
        }
      }
      
      // 提取最大未平倉 Call 履約價
      if (!maxOIStrikeCall) {
        const callPatterns = [
          /max[-\s]?oi[-\s]?call[-\s]?strike[：:：\s]*(\d+)/i,
          /call[-\s]?max[-\s]?oi[-\s]?strike[：:：\s]*(\d+)/i,
          /largest[-\s]?call[-\s]?open[-\s]?interest[-\s]?at[-\s]?(\d+)/i
        ];
        for (const pattern of callPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const value = parseFloat(match[1]);
            if (!isNaN(value) && value > 0) {
              maxOIStrikeCall = value;
              Logger.log(`P5 Daily：從 CSE 結果提取 ${ticker} Max OI Call Strike = ${maxOIStrikeCall}`);
              break;
            }
          }
        }
      }
      
      // 提取最大未平倉 Put 履約價
      if (!maxOIStrikePut) {
        const putPatterns = [
          /max[-\s]?oi[-\s]?put[-\s]?strike[：:：\s]*(\d+)/i,
          /put[-\s]?max[-\s]?oi[-\s]?strike[：:：\s]*(\d+)/i,
          /largest[-\s]?put[-\s]?open[-\s]?interest[-\s]?at[-\s]?(\d+)/i
        ];
        for (const pattern of putPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const value = parseFloat(match[1]);
            if (!isNaN(value) && value > 0) {
              maxOIStrikePut = value;
              Logger.log(`P5 Daily：從 CSE 結果提取 ${ticker} Max OI Put Strike = ${maxOIStrikePut}`);
              break;
            }
          }
        }
      }
      
      // 提取 30 日隱含波動率
      if (!iv30d) {
        const ivPatterns = [
          /30[-\s]?day[-\s]?iv[：:：\s]*(\d+\.?\d*)/i,
          /iv[-\s]?30[-\s]?day[：:：\s]*(\d+\.?\d*)/i,
          /implied[-\s]?volatility[-\s]?30[-\s]?day[：:：\s]*(\d+\.?\d*)/i,
          /30[-\s]?d[-\s]?iv[：:：\s]*(\d+\.?\d*)/i
        ];
        for (const pattern of ivPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const value = parseFloat(match[1]);
            if (!isNaN(value) && value > 0 && value < 500) {
              iv30d = value;
              Logger.log(`P5 Daily：從 CSE 結果提取 ${ticker} 30D IV = ${iv30d}`);
              break;
            }
          }
        }
      }
      
      // 提取到期日天數
      if (!daysToOpex) {
        const daysPatterns = [
          /days[-\s]?to[-\s]?expiration[：:：\s]*(\d+)/i,
          /days[-\s]?to[-\s]?opex[：:：\s]*(\d+)/i,
          /dte[-\s]?[：:：\s]*(\d+)/i,
          /(\d+)[-\s]?days[-\s]?to[-\s]?exp/i
        ];
        for (const pattern of daysPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const value = parseInt(match[1]);
            if (!isNaN(value) && value >= 0 && value <= 365) {
              daysToOpex = value;
              Logger.log(`P5 Daily：從 CSE 結果提取 ${ticker} Days to Opex = ${daysToOpex}`);
              break;
            }
          }
        }
      }
    }
    
    // 如果至少提取到一項數據，標記為 COMPLETED
    const hasData = putCallRatio !== null || maxOIStrikeCall !== null || maxOIStrikePut !== null || iv30d !== null || daysToOpex !== null;
    
    return {
      ticker: ticker,
      date: new Date(),
      put_call_ratio: putCallRatio,
      max_oi_strike_call: maxOIStrikeCall,
      max_oi_strike_put: maxOIStrikePut,
      iv_30d: iv30d,
      days_to_opex: daysToOpex,
      status: hasData ? "COMPLETED" : "PARTIAL",
      note: hasData ? `CSE 搜尋完成，提取到 ${[putCallRatio, maxOIStrikeCall, maxOIStrikePut, iv30d, daysToOpex].filter(v => v !== null).length} 項數據` : "CSE 搜尋完成但未提取到數據"
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：收集 ${ticker} 美股衍生品數據失敗：${error.message}`);
    return {
      ticker: ticker,
      date: new Date(),
      put_call_ratio: null,
      max_oi_strike_call: null,
      max_oi_strike_put: null,
      iv_30d: null,
      days_to_opex: null,
      status: "ERROR",
      error: error.message
    };
  }
}

/**
 * 收集台股衍生品數據（TAIFEX）
 * 
 * @returns {Object} derivativesData - 台股衍生品數據
 */
function collectTaiwanDerivatives() {
  Logger.log("P5 Daily：開始收集台股衍生品數據（TAIFEX）");
  
  const derivativesData = {};
  
  try {
    // ⭐ 使用 CSE 搜尋獲取台股期權數據（P5_DERIVATIVES_TAIWAN）
    // CSE 已配置為搜尋 taifex.com.tw 等台股期權數據來源
    const jobId = `P5_DERIVATIVES_TAIWAN_${Date.now()}`;
    const step = "CSE_SEARCH";
    const query = "台指期 選擇權 未平倉 買賣權比 Put Call Ratio";
    const payload = {
      search_query: query,
      cse_type: "P5_DERIVATIVES_TAIWAN",
      max_results: 10
    };
    
    Logger.log(`P5 Daily：使用 CSE 搜尋台股期權數據，query="${query}"`);
    
    // ⭐ V8.0 新增：檢查 executeCSESearch 函數是否存在
    if (typeof executeCSESearch !== 'function') {
      Logger.log(`P5 Daily：⚠️ executeCSESearch 函數不存在，無法執行台股期權 CSE 搜尋`);
      derivativesData["TAIFEX_OPTIONS"] = {
        ticker: "TAIFEX_OPTIONS",
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "ERROR",
        note: "executeCSESearch 函數不存在"
      };
      return derivativesData;
    }
    
    let cseResults;
    try {
      Logger.log(`P5 Daily：執行台股期權 CSE 搜尋，jobId=${jobId}, step=${step}, cse_type=${payload.cse_type}`);
      cseResults = executeCSESearch(jobId, step, payload);
      Logger.log(`P5 Daily：台股期權 CSE 搜尋完成，結果類型：${typeof cseResults}, 是否有 output：${!!cseResults?.output}`);
    } catch (cseError) {
      Logger.log(`P5 Daily：台股期權 CSE 搜尋執行失敗：${cseError.message}`);
      Logger.log(`P5 Daily：台股期權 CSE 搜尋錯誤堆疊：${cseError.stack}`);
      derivativesData["TAIFEX_OPTIONS"] = {
        ticker: "TAIFEX_OPTIONS",
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "ERROR",
        note: `CSE 搜尋執行失敗：${cseError.message}`
      };
      return derivativesData;
    }
    
    if (!cseResults || !cseResults.output || !cseResults.output.search_results || cseResults.output.search_results.length === 0) {
      Logger.log(`P5 Daily：台股期權 CSE 搜尋無結果`);
      derivativesData["TAIFEX_OPTIONS"] = {
        ticker: "TAIFEX_OPTIONS",
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "NO_DATA",
        note: "CSE 搜尋無結果"
      };
      return derivativesData;
    }
    
    const searchResults = cseResults.output.search_results || [];
    Logger.log(`P5 Daily：台股期權 CSE 搜尋找到 ${searchResults.length} 筆結果`);
    
    // 從搜尋結果中提取台股期權數據（類似美股邏輯）
    let putCallRatio = null;
    let maxOIStrikeCall = null;
    let maxOIStrikePut = null;
    
    for (const result of searchResults) {
      const text = (result.snippet || result.title || "").toLowerCase();
      
      // 提取買賣權比
      if (!putCallRatio) {
        const pcrPatterns = [
          /買賣權比[：:：\s]*(\d+\.?\d*)/i,
          /put[-\s]?call[-\s]?ratio[：:：\s]*(\d+\.?\d*)/i,
          /p\/c[-\s]?ratio[：:：\s]*(\d+\.?\d*)/i
        ];
        for (const pattern of pcrPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const value = parseFloat(match[1]);
            if (!isNaN(value) && value > 0 && value < 10) {
              putCallRatio = value;
              break;
            }
          }
        }
      }
    }
    
    const hasData = putCallRatio !== null || maxOIStrikeCall !== null || maxOIStrikePut !== null;
    
    derivativesData["TAIFEX_OPTIONS"] = {
      ticker: "TAIFEX_OPTIONS",
      date: new Date(),
      put_call_ratio: putCallRatio,
      max_oi_strike_call: maxOIStrikeCall,
      max_oi_strike_put: maxOIStrikePut,
      iv_30d: null,
      days_to_opex: null,
      status: hasData ? "COMPLETED" : "PARTIAL",
      note: hasData ? `CSE 搜尋完成，提取到 ${[putCallRatio, maxOIStrikeCall, maxOIStrikePut].filter(v => v !== null).length} 項數據` : "CSE 搜尋完成但未提取到數據"
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：收集台股衍生品數據失敗：${error.message}`);
    derivativesData["TAIFEX_OPTIONS"] = {
      ticker: "TAIFEX_OPTIONS",
      date: new Date(),
      put_call_ratio: null,
      max_oi_strike_call: null,
      max_oi_strike_put: null,
      iv_30d: null,
      days_to_opex: null,
      status: "ERROR",
      error: error.message
    };
  }
  
  return derivativesData;
}

/**
 * 收集日股衍生品數據（JPX）
 * 
 * @returns {Object} derivativesData - 日股衍生品數據
 */
function collectJapanDerivatives() {
  Logger.log("P5 Daily：開始收集日股衍生品數據（JPX）");
  
  const derivativesData = {};
  
  try {
    // ⭐ 使用 CSE 搜尋獲取日股期權數據（P5_DERIVATIVES_JAPAN）
    // CSE 已配置為搜尋 jpx.co.jp 等日股期權數據來源
    const jobId = `P5_DERIVATIVES_JAPAN_${Date.now()}`;
    const step = "CSE_SEARCH";
    const query = "日經225 オプション 建玉 Put Call Ratio 未平倉";
    const payload = {
      search_query: query,
      cse_type: "P5_DERIVATIVES_JAPAN",
      max_results: 10
    };
    
    Logger.log(`P5 Daily：使用 CSE 搜尋日股期權數據，query="${query}"`);
    
    // ⭐ V8.0 新增：檢查 executeCSESearch 函數是否存在
    if (typeof executeCSESearch !== 'function') {
      Logger.log(`P5 Daily：⚠️ executeCSESearch 函數不存在，無法執行日股期權 CSE 搜尋`);
      derivativesData["NIKKEI225_OPTIONS"] = {
        ticker: "NIKKEI225_OPTIONS",
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "ERROR",
        note: "executeCSESearch 函數不存在"
      };
      return derivativesData;
    }
    
    let cseResults;
    try {
      Logger.log(`P5 Daily：執行日股期權 CSE 搜尋，jobId=${jobId}, step=${step}, cse_type=${payload.cse_type}`);
      cseResults = executeCSESearch(jobId, step, payload);
      Logger.log(`P5 Daily：日股期權 CSE 搜尋完成，結果類型：${typeof cseResults}, 是否有 output：${!!cseResults?.output}`);
    } catch (cseError) {
      Logger.log(`P5 Daily：日股期權 CSE 搜尋執行失敗：${cseError.message}`);
      Logger.log(`P5 Daily：日股期權 CSE 搜尋錯誤堆疊：${cseError.stack}`);
      derivativesData["NIKKEI225_OPTIONS"] = {
        ticker: "NIKKEI225_OPTIONS",
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "ERROR",
        note: `CSE 搜尋執行失敗：${cseError.message}`
      };
      return derivativesData;
    }
    
    if (!cseResults || !cseResults.output || !cseResults.output.search_results || cseResults.output.search_results.length === 0) {
      Logger.log(`P5 Daily：日股期權 CSE 搜尋無結果`);
      derivativesData["NIKKEI225_OPTIONS"] = {
        ticker: "NIKKEI225_OPTIONS",
        date: new Date(),
        put_call_ratio: null,
        max_oi_strike_call: null,
        max_oi_strike_put: null,
        iv_30d: null,
        days_to_opex: null,
        status: "NO_DATA",
        note: "CSE 搜尋無結果"
      };
      return derivativesData;
    }
    
    const searchResults = cseResults.output.search_results || [];
    Logger.log(`P5 Daily：日股期權 CSE 搜尋找到 ${searchResults.length} 筆結果`);
    
    // 從搜尋結果中提取日股期權數據（類似美股邏輯）
    let putCallRatio = null;
    let maxOIStrikeCall = null;
    let maxOIStrikePut = null;
    
    for (const result of searchResults) {
      const text = (result.snippet || result.title || "").toLowerCase();
      
      // 提取 Put/Call Ratio
      if (!putCallRatio) {
        const pcrPatterns = [
          /put[-\s]?call[-\s]?ratio[：:：\s]*(\d+\.?\d*)/i,
          /p\/c[-\s]?ratio[：:：\s]*(\d+\.?\d*)/i,
          /プット[-\s]?コール[-\s]?レシオ[：:：\s]*(\d+\.?\d*)/i
        ];
        for (const pattern of pcrPatterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            const value = parseFloat(match[1]);
            if (!isNaN(value) && value > 0 && value < 10) {
              putCallRatio = value;
              break;
            }
          }
        }
      }
    }
    
    const hasData = putCallRatio !== null || maxOIStrikeCall !== null || maxOIStrikePut !== null;
    
    derivativesData["NIKKEI225_OPTIONS"] = {
      ticker: "NIKKEI225_OPTIONS",
      date: new Date(),
      put_call_ratio: putCallRatio,
      max_oi_strike_call: maxOIStrikeCall,
      max_oi_strike_put: maxOIStrikePut,
      iv_30d: null,
      days_to_opex: null,
      status: hasData ? "COMPLETED" : "PARTIAL",
      note: hasData ? `CSE 搜尋完成，提取到 ${[putCallRatio, maxOIStrikeCall, maxOIStrikePut].filter(v => v !== null).length} 項數據` : "CSE 搜尋完成但未提取到數據"
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：收集日股衍生品數據失敗：${error.message}`);
    derivativesData["NIKKEI225_OPTIONS"] = {
      ticker: "NIKKEI225_OPTIONS",
      date: new Date(),
      put_call_ratio: null,
      max_oi_strike_call: null,
      max_oi_strike_put: null,
      iv_30d: null,
      days_to_opex: null,
      status: "ERROR",
      error: error.message
    };
  }
  
  return derivativesData;
}
