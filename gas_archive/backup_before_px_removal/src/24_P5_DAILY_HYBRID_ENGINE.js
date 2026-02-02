/**
 * 📊 P5 Daily: 混合雙引擎（Hybrid Engine）V8.3
 * 
 * ⭐ V8.3 最終版：智能數據獲取指揮官（Google Finance 優先，失敗自動切換到 Stooq/Yahoo）
 * 解決：Google Finance 匯率鎖死、日股數據錯誤、週末超時等問題
 * 
 * ⚠️ V8.3 Fail Fast 機制：Google Finance 等待時間縮短至 4 秒，避免週末超時
 * 
 * @version V8.3
 * @date 2026-01-17
 */

// ==========================================
// V8.2 混合雙引擎指揮官
// ==========================================

/**
 * V8.2 核心指揮官：智能數據獲取 (Hybrid Engine)
 * 邏輯：Google Finance (優先) -> 失敗/異常 -> Stooq/Yahoo (救援)
 * 
 * @param {string} itemName - 項目名稱（用於 Yahoo 代碼對照）
 * @param {string} googleTicker - Google Finance ticker（例如："CURRENCY:EURUSD", "NYSEARCA:USO"）
 * @param {string} type - 數據類型（"FOREX", "ETF", "STOCK", "INDEX"）
 * @param {Array} priceRange - 合理價格範圍 [min, max]（用於驗證）
 * @param {string} attribute - 要獲取的屬性（"price" 或 "volume"，預設為 "price"）
 * @returns {Object|null} data - 數據 {price/volume, change, change_pct, data_source}
 */
function getSmartData(itemName, googleTicker, type, priceRange, attribute = "price") {
  // 1. 嘗試 Google Finance
  if (googleTicker) {
    // 檢查 fetchGoogleFinanceSafe 函數是否存在
    if (typeof fetchGoogleFinanceSafe === 'function') {
      const value = fetchGoogleFinanceSafe(googleTicker, attribute);
      
      // 如果拿到有效數字
      if (value !== null && value > 0) {
        // ⭐ V8.3 修正：美債類（INDEX 類型且名稱包含"美債"）需要先除以10再檢查價格範圍（僅適用於 price）
        let finalValue = value;
        let needDivideBy10 = false;
        
        if (attribute === "price" && type === "INDEX" && itemName && (itemName.includes("美債") || itemName.includes("BOND"))) {
          finalValue = value / 10;
          needDivideBy10 = true;
        }
        
        // 價格合理性檢查（如果有提供 priceRange，且屬性是 price）
        if (attribute === "price" && priceRange && (finalValue < priceRange[0] || finalValue > priceRange[1])) {
          Logger.log(`P5 Daily：⚠️ [Google] ${itemName} 價格 ${finalValue} 超出合理範圍 [${priceRange[0]}, ${priceRange[1]}]，視為異常`);
        } else {
          Logger.log(`✅ [Google] ${itemName} ${attribute} 獲取成功: ${finalValue}${needDivideBy10 ? ` (原始: ${value}, 已除10)` : ""}`);
          return {
            [attribute]: finalValue, // 動態返回 price 或 volume
            price: attribute === "price" ? finalValue : undefined, // 兼容性：如果請求 volume，price 為 undefined
            volume: attribute === "volume" ? finalValue : undefined, // 兼容性：如果請求 price，volume 為 undefined
            change: 0, // Google Finance 單點抓取較難抓漲跌幅，先設 0
            change_pct: 0,
            data_source: "GOOGLE_INTERNAL",
            source: "GOOGLE_INTERNAL" // 為了兼容性，同時提供 source 字段
          };
        }
      }
    }
    
    Logger.log(`⚠️ [Google] ${itemName} 失敗/異常（已嘗試所有備用代碼），啟動救援...`);
  }

  // 2. 根據類型啟動不同的救援機制
  if (type === "FOREX") {
    // 匯率：優先使用 Stooq 救援（因為 Stooq 匯率正常）
    // 從 itemName 提取對應的 Stooq ticker（例如："歐元/美元" -> "EURUSD"）
    const stooqTickerMap = {
      "歐元/美元": "EURUSD",
      "英鎊/美元": "GBPUSD",
      "美元/日圓": "USDJPY",
      "美元/瑞郎": "USDCHF",
      "美元/人民幣": "USDCNY"
    };
    
    const stooqTicker = stooqTickerMap[itemName];
    if (stooqTicker) {
      Logger.log(`⚠️ ${itemName} 啟動 Stooq 救援 (${stooqTicker})...`);
      
      // 檢查 fetchMacroDataFromStooq 函數是否存在
      if (typeof fetchMacroDataFromStooq === 'function') {
        const symbol = stooqTicker; // Stooq 使用 ticker 作為 symbol
        const stooqData = fetchMacroDataFromStooq(symbol, stooqTicker);
        
        if (stooqData && stooqData.price) {
          Logger.log(`✅ [Stooq救援] ${itemName} 獲取成功: ${stooqData.price}`);
          return {
            price: stooqData.price,
            change: stooqData.change || 0,
            change_pct: stooqData.change_pct || 0,
            data_source: "STOOQ_RESCUE",
            source: "STOOQ_RESCUE" // 為了兼容性，同時提供 source 字段
          };
        } else {
          Logger.log(`❌ [Stooq救援] ${itemName} 也失敗`);
        }
      }
    }
    
    // 如果 Stooq 也失敗（或美元指數等特殊情況），嘗試 CSE 搜尋
    const yahooTicker = getYahooTickerMap(itemName);
    
    // 如果 Stooq 也失敗，嘗試 CSE 搜尋（美元指數等特殊情況）
    if (typeof getMacroDataFromCSE === 'function') {
      Logger.log(`⚠️ [Stooq救援] ${itemName} 也失敗，嘗試 CSE 搜尋...`);
      const searchQuery = `${itemName} ${yahooTicker || itemName} price today`;
      const cseData = getMacroDataFromCSE(searchQuery, itemName, priceRange);
      
      if (cseData && cseData.price) {
        Logger.log(`✅ [CSE救援] ${itemName} 獲取成功: ${cseData.price}`);
        // 確保返回的數據有 source 字段
        if (!cseData.source) {
          cseData.source = cseData.data_source || "CSE_RESCUE";
        }
        return cseData;
      }
    }
  } else if (type === "STOCK") {
    // ⭐ V8.3 修正：日股優先使用 Stooq 救援（Stooq 日股數據正常），台股仍使用 CSE
    // 判斷是否為日股：檢查名稱中包含 "(日股)" 或 googleTicker 包含 "TYO:"、"SHE:" 或名稱是純數字且可能為日股
    const isJapaneseStock = itemName.includes("(日股)") || 
                            (googleTicker && (googleTicker.includes("TYO:") || googleTicker.includes("SHE:"))) ||
                            (/^\d{4}$/.test(itemName) && !itemName.includes("(台股)")); // 4位數字且不是台股
    
    if (isJapaneseStock) {
      // 日股：優先使用 Stooq 救援
      // 提取純數字代碼（例如："8035 (日股)" -> "8035"，"TYO:8035" -> "8035"）
      let jpStockCode = itemName.replace(/[^0-9]/g, ''); // 提取所有數字
      if (googleTicker && (googleTicker.includes("TYO:") || googleTicker.includes("SHE:"))) {
        const match = googleTicker.match(/(\d{4})/);
        if (match && match[1]) {
          jpStockCode = match[1];
        }
      }
      
      if (jpStockCode && /^\d{4}$/.test(jpStockCode)) {
        const stooqTicker = jpStockCode + ".jp"; // Stooq 日股格式：8035.jp
        Logger.log(`⚠️ ${itemName} 啟動 Stooq 救援 (${stooqTicker})...`);
        
        // 檢查 fetchOHLCVFromStooq 函數是否存在
        if (typeof fetchOHLCVFromStooq === 'function') {
          try {
            const stooqData = fetchOHLCVFromStooq(jpStockCode, stooqTicker);
            
            // ⭐ V8.3 修正：Stooq 返回完整的 OHLCV 數據，根據 attribute 返回對應的值
            if (stooqData) {
              let returnValue = null;
              if (attribute === "price" && stooqData.close) {
                returnValue = stooqData.close;
              } else if (attribute === "volume" && stooqData.volume) {
                returnValue = stooqData.volume;
              }
              
              if (returnValue !== null) {
                Logger.log(`✅ [Stooq救援] ${itemName} ${attribute} 獲取成功: ${returnValue}`);
                return {
                  [attribute]: returnValue, // 動態返回 price 或 volume
                  price: attribute === "price" ? returnValue : (stooqData.close || undefined),
                  volume: attribute === "volume" ? returnValue : (stooqData.volume || undefined),
                  change: stooqData.change || 0,
                  change_pct: stooqData.change_pct || 0,
                  data_source: "STOOQ_RESCUE",
                  source: "STOOQ_RESCUE"
                };
              }
            }
          } catch (error) {
            Logger.log(`⚠️ [Stooq救援] ${itemName} 發生錯誤: ${error.message}`);
          }
        }
        
        Logger.log(`⚠️ [Stooq救援] ${itemName} 失敗，嘗試 CSE 救援...`);
      }
    }
    
    // 如果 Stooq 失敗或非日股，使用 CSE 搜尋救援
    const yahooTicker = getYahooTickerMap(itemName);
    Logger.log(`⚠️ ${itemName} 啟動 CSE 救援 (${yahooTicker})...`);
    
    // 使用 CSE 搜尋作為日股/台股的救援機制
    if (typeof getMacroDataFromCSE === 'function') {
      const searchQuery = `${itemName} ${yahooTicker || itemName} price today`;
      const cseData = getMacroDataFromCSE(searchQuery, itemName, priceRange);
      
      if (cseData && cseData.price) {
        Logger.log(`✅ [CSE救援] ${itemName} 獲取成功: ${cseData.price}`);
        // 確保返回的數據有 source 字段
        if (!cseData.source) {
          cseData.source = cseData.data_source || "CSE_RESCUE";
        }
        return cseData;
      }
    }
    
    Logger.log(`⚠️ [CSE救援] ${itemName} 也失敗`);
  } else if (type === "ETF" || type === "INDEX") {
    // ETF 和指數：Google 通常很穩定，如果失敗嘗試 CSE
    const yahooTicker = getYahooTickerMap(itemName);
    if (typeof getMacroDataFromCSE === 'function') {
      Logger.log(`⚠️ [Google] ${itemName} 失敗，嘗試 CSE 搜尋...`);
      const searchQuery = `${itemName} ${yahooTicker || itemName} price today`;
      const cseData = getMacroDataFromCSE(searchQuery, itemName, priceRange);
      
      if (cseData && cseData.price) {
        Logger.log(`✅ [CSE救援] ${itemName} 獲取成功: ${cseData.price}`);
        // 確保返回的數據有 source 字段
        if (!cseData.source) {
          cseData.source = cseData.data_source || "CSE_RESCUE";
        }
        return cseData;
      }
    }
  }

  Logger.log(`❌ [ALL FAIL] ${itemName} 全部失敗 (Google & 救援機制)`);
  return null;
}

/**
 * 輔助函數：Yahoo 代碼對照表
 * 
 * @param {string} name - 項目名稱（例如："歐元/美元", "8035", "WTI原油"）
 * @returns {string} yahooTicker - Yahoo Finance ticker
 */
function getYahooTickerMap(name) {
  const map = {
    // 匯率 (Yahoo 代碼通常是 XXX=X)
    "歐元/美元": "EURUSD=X",
    "英鎊/美元": "GBPUSD=X",
    "美元/日圓": "USDJPY=X",
    "美元/瑞郎": "USDCHF=X",
    "美元/人民幣": "CNY=X",
    "美元指數": "DX-Y.NYB",
    
    // 日股 (Yahoo 代碼是 .T)
    "8035": "8035.T",
    "東京威力科創": "8035.T",
    
    // 台股 (Yahoo 代碼是 .TW)
    "2330": "2330.TW",
    "台積電": "2330.TW",
    
    // 商品期貨 (Yahoo 代碼是 XXX=F)
    "WTI原油": "CL=F",
    "Brent原油": "BZ=F",
    "黃金": "GC=F",
    "白銀": "SI=F",
    "銅": "HG=F",
    
    // 指數 (Yahoo 代碼是 ^XXX)
    "VIX": "^VIX",
    "10年美債": "^TNX",
    "5年美債": "^FVX",
    "30年美債": "^TYX",
    "3個月美債": "^IRX"
  };
  
  // ⭐ V8.3 新增：處理 Google 格式轉 Yahoo 格式
  // 例如：TYO:8035 -> 8035.T, TPE:2330 -> 2330.TW, NASDAQ:NVDA -> NVDA
  if (name.indexOf(":") > -1) {
    const parts = name.split(":");
    if (parts.length === 2) {
      const prefix = parts[0].toUpperCase();
      const ticker = parts[1];
      
      // 日股：TYO:8035 -> 8035.T
      if (prefix === "TYO" || prefix === "SHE") {
        return ticker + ".T";
      }
      // 台股：TPE:2330 -> 2330.TW
      if (prefix === "TPE") {
        return ticker + ".TW";
      }
      // 美股：NASDAQ:NVDA -> NVDA (直接返回 ticker)
      return ticker;
    }
  }
  
  // ⭐ V8.3 修正：處理測試腳本中的格式 "8035 (日股)" -> "8035.T"
  if (name.indexOf("(日股)") > -1) {
    const match = name.match(/(\d+)\s*\(日股\)/);
    if (match && match[1]) {
      return match[1] + ".T";
    }
  }
  if (name.indexOf("(台股)") > -1) {
    const match = name.match(/(\d+)\s*\(台股\)/);
    if (match && match[1]) {
      return match[1] + ".TW";
    }
  }
  if (name.indexOf("(美股)") > -1) {
    const match = name.match(/([A-Z]+)\s*\(美股\)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return map[name] || name;
}
