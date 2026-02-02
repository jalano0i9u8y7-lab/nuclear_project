/**
 * 📊 P5 Daily: 宏觀數據收集
 * 
 * 收集油價、貴金屬、匯率、國債利率、VIX 等宏觀數據
 * 
 * ⭐⭐⭐ 避險指標監控策略（V8.0）：
 * 1. **主要避險貨幣**：USD/CHF（瑞郎）- 地緣風險和市場風險情緒的最大指標
 * 2. **主要避險資產**：黃金（GLD 代理）、白銀（SLV 代理）- 傳統避險資產（GOOGLEFINANCE 不支援期貨，改用 ETF 代理）
 * 3. **避險組合**：瑞郎 + 貴金屬 = 當前最有效的避險指標組合
 * 4. **對照指標**：USD/JPY（日圓）- 保留作為對照（避險地位可能已弱化）
 * 5. **市場情緒指標**：VIX（恐慌指數）- 市場恐慌情緒
 * 
 * 注意：日圓和美金在當前環境下避險貨幣地位可能已弱化，瑞郎和貴金屬是更可靠的避險指標
 * 
 * ⭐⭐⭐ V8.2 混合引擎（Hybrid Engine）：
 * 1. Google Finance（優先，含智能備用代碼機制）
 * 2. Stooq 救援（匯率專用，因為 Stooq 匯率正常）
 * 3. CSE 搜尋（特殊情況備援）
 * 
 * @version SSOT V8.2
 * @date 2026-01-17
 * @changes V8.2: 實裝混合雙引擎，Google Finance 失敗自動切換到 Stooq 救援
 */

/**
 * 收集宏觀數據
 * 
 * @returns {Object} macroData - 宏觀數據
 */
function collectMacroData() {
  Logger.log("P5 Daily：開始收集宏觀數據");
  
  // ⭐ V8.0 新增：重置價格追蹤（防止數據污染檢測誤判）
  collectedPrices = {};
  
  const macroData = {
    commodities: {},
    currencies: {},
    bonds: {},
    indices: {},
    date: new Date()
  };
  
  try {
    // 收集商品價格（油價、貴金屬）
    macroData.commodities = collectCommodityPrices();
    
    // 收集匯率
    macroData.currencies = collectCurrencyRates();
    
    // 收集國債利率
    macroData.bonds = collectBondYields();
    
    // 收集市場指數（VIX 等）
    macroData.indices = collectMarketIndices();
    
    Logger.log(`P5 Daily：完成宏觀數據收集`);
    
  } catch (error) {
    Logger.log(`P5 Daily：收集宏觀數據失敗：${error.message}`);
  }
  
  return macroData;
}

/**
 * ⭐⭐⭐ V8.2 混合引擎：使用 fetchGoogleFinanceSafe 函數獲取宏觀數據（第一優先）
 * 優點：不會被擋，Google 內部數據，穩定可靠，有完善的等待機制和智能備用代碼
 * 如果 Google 失敗，會自動切換到 Stooq（匯率）或 CSE（其他）
 * 
 * @param {string} yahooTicker - Yahoo Finance ticker（例如："CL=F", "GC=F"）
 * @param {string} itemName - 項目名稱（用於日誌）
 * @param {Array} priceRange - 合理價格範圍 [min, max]
 * @returns {Object|null} data - 報價數據
 */
function getMacroFromGoogleFinance(yahooTicker, itemName, priceRange) {
  // ⭐ V8.2 修正：對照表更新為正確的 GOOGLEFINANCE 代碼
  const tickerMap = {
    // 商品期貨：使用 ETF 代理（GOOGLEFINANCE 不支援期貨）
    "CL=F": "NYSEARCA:USO",      // WTI 原油 → USO ETF
    "BZ=F": "NYSEARCA:BNO",      // Brent 原油 → BNO ETF
    "GC=F": "NYSEARCA:GLD",      // 黃金 → GLD ETF
    "SI=F": "NYSEARCA:SLV",      // 白銀 → SLV ETF
    "HG=F": "NYSEARCA:CPER",     // 銅 → CPER ETF
    // 匯率：嘗試直接使用代碼（去掉 CURRENCY: 前綴，Google 有時更喜歡直接代碼）
    // ⭐ V8.2 修正：fetchGoogleFinanceSafe 現在內建智能備用代碼機制（含 FX: 前綴）
    // 會自動嘗試：EURUSD -> 失敗 -> 自動嘗試 CURRENCY:EURUSD -> 失敗 -> 自動嘗試 FX:EURUSD
    "EURUSD=X": "EURUSD",      // V8.2：智能多重代碼讀取器會自動嘗試備用代碼（含 FX:）
    "GBPUSD=X": "GBPUSD",      // V8.2：智能多重代碼讀取器會自動嘗試備用代碼（含 FX:）
    "USDJPY=X": "USDJPY",      // V8.2：智能多重代碼讀取器會自動嘗試備用代碼（含 FX:）
    "USDCHF=X": "USDCHF",      // V8.2：智能多重代碼讀取器會自動嘗試備用代碼（含 FX:）
    "CNY=X": "USDCNY",         // V8.2：智能多重代碼讀取器會自動嘗試備用代碼（含 FX:）
    "DX-Y.NYB": "NYSEARCA:UUP",  // 美元指數 → UUP ETF（INDEXCBOE:DXY 不穩）
    // 國債利率：INDEXCBOE 格式（注意：回傳值需除以 10）
    "^TNX": "INDEXCBOE:TNX",     // 10年美債
    "^FVX": "INDEXCBOE:FVX",     // 5年美債
    "^TYX": "INDEXCBOE:TYX",     // 30年美債
    "^IRX": "INDEXCBOE:IRX",     // 3個月美債
    // 市場指數：INDEXCBOE 格式
    "^VIX": "INDEXCBOE:VIX"      // VIX
  };
  
  let googleTicker = tickerMap[yahooTicker];
  
  // ⭐ V8.13 修正：如果ticker不在映射表中，直接使用ticker（不需要對照表檢查）
  // 對照表僅用於特殊情況（如期貨→ETF代理、匯率格式、國債INDEXCBOE格式）
  if (!googleTicker) {
    // 直接使用原始ticker，fetchGoogleFinanceSafe會自動嘗試不同格式
    googleTicker = yahooTicker;
  }
  
  // 特殊處理：如果 googleTicker 為 null，表示不支援 GOOGLEFINANCE，直接返回 null
  if (googleTicker === null) {
    Logger.log(`P5 Daily：${itemName} (${yahooTicker}) 不支援 GOOGLEFINANCE，跳過`);
    return null;
  }
  
  try {
    // ⭐ V8.2 修正：使用 fetchGoogleFinanceSafe 函數（含智能備用代碼機制）
    // 檢查函數是否存在
    if (typeof fetchGoogleFinanceSafe !== 'function') {
      Logger.log(`P5 Daily：⚠️ fetchGoogleFinanceSafe 函數不存在，無法使用 GOOGLEFINANCE`);
      return null;
    }
    
    // ⭐ V8.2 修正：使用智能多重代碼讀取器（已內建備用代碼機制，含 FX: 前綴）
    // fetchGoogleFinanceSafe 現在會自動嘗試：主要代碼 -> EURUSD -> CURRENCY:EURUSD -> FX:EURUSD
    let value = fetchGoogleFinanceSafe(googleTicker, "price");
    
    // ⭐ V8.13 新增：如果直接使用ticker失敗，且ticker不在映射表中，嘗試加上常見的交易所前綴
    if ((value === null || value === undefined || isNaN(value) || value <= 0) && !tickerMap[yahooTicker]) {
      // 嘗試常見的ETF交易所前綴
      const exchangePrefixes = ["NASDAQ:", "NYSEARCA:", "BATS:"];
      for (const prefix of exchangePrefixes) {
        const prefixedTicker = prefix + yahooTicker;
        Logger.log(`P5 Daily：嘗試使用 ${prefixedTicker} 查詢 ${itemName}`);
        value = fetchGoogleFinanceSafe(prefixedTicker, "price");
        if (value !== null && value !== undefined && !isNaN(value) && value > 0) {
          googleTicker = prefixedTicker;  // 更新為成功的前綴版本
          Logger.log(`P5 Daily：✅ 使用 ${prefixedTicker} 成功獲取 ${itemName}`);
          break;
        }
      }
    }
    
    if (value === null || value === undefined || isNaN(value) || value <= 0) {
      Logger.log(`P5 Daily：⚠️ ${itemName} GOOGLEFINANCE 回傳無效數據或超時（已嘗試所有備用代碼：主要、CURRENCY:、FX:、交易所前綴）`);
      return null;
    }
    
    // ⭐ V8.0 修正：國債利率需要除以 10
    let finalValue = value;
    if (yahooTicker.startsWith("^") && (yahooTicker === "^TNX" || yahooTicker === "^FVX" || yahooTicker === "^TYX" || yahooTicker === "^IRX")) {
      finalValue = value / 10;
      Logger.log(`P5 Daily：${itemName} 國債利率需除以 10：${value} → ${finalValue}%`);
    }
    
    // 合理性檢查
    // ⭐ V8.13 修正：價格範圍檢查改為警告而非直接失敗，避免誤判有效數據
    if (priceRange && (finalValue < priceRange[0] || finalValue > priceRange[1])) {
      Logger.log(`P5 Daily：⚠️ ${itemName} GOOGLEFINANCE 價格 ${finalValue.toFixed(2)} 超出預期範圍 [${priceRange[0]}, ${priceRange[1]}]，但繼續使用（可能是市場波動或範圍設定需調整）`);
      // 不再直接返回null，而是記錄警告後繼續使用數據
      // return null;  // ⭐ V8.13 移除：改為警告而非失敗
    }
    
    Logger.log(`P5 Daily：✅ 從 GOOGLEFINANCE 獲取 ${itemName} (${yahooTicker} → ${googleTicker}) = ${finalValue.toFixed(2)}`);
    
    // 數據污染檢測
    if (!checkDataContamination(itemName, finalValue)) {
      Logger.log(`P5 Daily：⚠️ ${itemName} GOOGLEFINANCE 數據污染檢測失敗，跳過此結果`);
      return null;
    }
    
    return {
      price: finalValue,
      change: 0, // Google Finance 單點抓取較難抓漲跌幅，先設 0
      change_pct: 0,
      data_source: "GOOGLE_INTERNAL"
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：❌ ${itemName} GOOGLEFINANCE 發生錯誤: ${error.message}`);
    return null;
  }
}

/**
 * ⭐⭐⭐ V8.0 備援方案：使用 CSE 搜尋 Yahoo Finance 宏觀數據
 * 
 * @param {string} searchQuery - 搜尋查詢（例如："CL=F price today"）
 * @param {string} itemName - 項目名稱（用於日誌）
 * @param {Array} priceRange - 合理價格範圍 [min, max]
 * @returns {Object|null} data - 報價數據
 */
function getMacroDataFromCSE(searchQuery, itemName, priceRange) {
  try {
    const jobId = `P5_MACRO_CSE_${Date.now()}`;
    const step = "CSE_SEARCH";
    const payload = {
      search_query: searchQuery,
      cse_type: "P5_WORLD",
      max_results: 5
    };
    
    Logger.log(`P5 Daily：使用 CSE 搜尋 ${itemName}，query="${searchQuery}"`);
    
    // 檢查 executeCSESearch 函數是否存在
    if (typeof executeCSESearch !== 'function') {
      Logger.log(`P5 Daily：⚠️ executeCSESearch 函數不存在，無法執行 CSE 搜尋`);
      return null;
    }
    
    // 執行 CSE 搜尋
    const cseResults = executeCSESearch(jobId, step, payload);
    
    if (!cseResults || !cseResults.output || !cseResults.output.search_results || cseResults.output.search_results.length === 0) {
      Logger.log(`P5 Daily：${itemName} CSE 搜尋無結果`);
      return null;
    }
    
    const searchResults = cseResults.output.search_results;
    Logger.log(`P5 Daily：${itemName} CSE 搜尋找到 ${searchResults.length} 筆結果`);
    
    // 從搜尋結果的 snippet 和 title 中提取價格
    // CSE 返回的 snippet 通常包含價格信息，例如："WTI crude oil price today: $62.33 (+0.5%)"
    let price = null;
    let change = 0;
    let change_pct = 0;
    
    // 價格匹配模式（匹配美元金額、百分比變化等）
    const pricePatterns = [
      /\$([\d,]+\.?\d*)/,           // $62.33, $1,234.56
      /(\d+\.?\d*)\s*USD/,          // 62.33 USD
      /price[：:：]?\s*\$?([\d,]+\.?\d*)/i,  // price: $62.33
      /at\s*\$?([\d,]+\.?\d*)/i,    // at $62.33
      /is\s*\$?([\d,]+\.?\d*)/i     // is $62.33
    ];
    
    // 變化匹配模式
    const changePatterns = [
      /([+-]?\d+\.?\d*)%/,          // +0.5%, -2.3%
      /\(([+-]?\d+\.?\d*)%\)/,      // (+0.5%), (-2.3%)
      /([+-]\$?[\d,]+\.?\d*)/,      // +$0.5, -$2.3
      /change[：:：]?\s*([+-]?\d+\.?\d*)%?/i  // change: +0.5%
    ];
    
    for (const result of searchResults) {
      const text = (result.snippet || result.title || "").toLowerCase();
      const fullText = `${result.title || ""} ${result.snippet || ""}`;
      
      // 嘗試提取價格
      for (const pattern of pricePatterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
          const candidatePrice = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(candidatePrice) && candidatePrice > 0) {
            // 合理性檢查
            if (!priceRange || (candidatePrice >= priceRange[0] && candidatePrice <= priceRange[1])) {
              price = candidatePrice;
              Logger.log(`P5 Daily：從 CSE 結果提取 ${itemName} 價格 = ${price.toFixed(2)}（來源：${result.link}）`);
              
              // 嘗試提取變化
              for (const changePattern of changePatterns) {
                const changeMatch = fullText.match(changePattern);
                if (changeMatch && changeMatch[1]) {
                  const candidateChange = parseFloat(changeMatch[1].replace(/,/g, ''));
                  if (!isNaN(candidateChange)) {
                    // 判斷是百分比還是絕對值（如果是絕對值且價格很大，則可能是百分比）
                    if (Math.abs(candidateChange) > 100 && price > 100) {
                      // 可能是百分比，但沒有 % 符號，檢查相對大小
                      if (Math.abs(candidateChange / price) < 0.5) {
                        change_pct = candidateChange;
                      }
                    } else if (fullText.includes('%') || Math.abs(candidateChange) <= 100) {
                      change_pct = candidateChange;
                    } else {
                      change = candidateChange;
                      change_pct = (change / price) * 100;
                    }
                    break;
                  }
                }
              }
              
              // 如果找到價格，停止搜尋
              if (price) break;
            }
          }
        }
      }
      
      if (price) break;
    }
    
    if (!price || isNaN(price) || price <= 0) {
      Logger.log(`P5 Daily：無法從 CSE 結果中提取 ${itemName} 價格`);
      return null;
    }
    
    // 數據驗證
    if (!validateMacroData(itemName, price, change, change_pct)) {
      Logger.log(`P5 Daily：⚠️ ${itemName} CSE 數據驗證失敗，價格=${price}, 變化=${change}, 變化%=${change_pct}%`);
      return null;
    }
    
    // 數據污染檢測
    if (!checkDataContamination(itemName, price)) {
      Logger.log(`P5 Daily：⚠️ ${itemName} CSE 數據污染檢測失敗，跳過此結果`);
      return null;
    }
    
    Logger.log(`P5 Daily：成功從 CSE 獲取 ${itemName} 價格 = ${price.toFixed(2)}，變化 = ${change.toFixed(2)} (${change_pct.toFixed(2)}%)`);
    
    return {
      price: price,
      change: change || 0,
      change_pct: change_pct || 0,
      data_source: "CSE_YAHOO_FINANCE"
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：使用 CSE 搜尋 ${itemName} 失敗：${error.message}`);
    return null;
  }
}

/**
 * 收集商品價格（油價、貴金屬、銅）
 * ⭐ V8.0 修正：改用 CSE 搜尋 Yahoo Finance 數據
 * 
 * @returns {Object} commodities - 商品價格數據
 */
function collectCommodityPrices() {
  const commodities = {};
  
  const today = new Date();
  const month = String(today.getMonth() + 1);
  const day = String(today.getDate());
  const dateStr = `${today.getFullYear()}-${month.length === 1 ? '0' + month : month}-${day.length === 1 ? '0' + day : day}`;
  
  // ⭐ V8.0 修正：改用 CSE 搜尋，確保日期是當天
  const commodityTickers = [
    { 
      symbol: "CL.F", 
      name: "WTI原油", 
      yahooTicker: "CL=F", 
      category: "ENERGY",
      searchQuery: `WTI crude oil CL=F price ${dateStr} today`,
      priceRange: [20, 200]
    },
    { 
      symbol: "BRENT.F", 
      name: "Brent原油", 
      yahooTicker: "BZ=F", 
      category: "ENERGY",
      searchQuery: `Brent crude oil BZ=F price ${dateStr} today`,
      priceRange: [20, 200]
    },
    { 
      symbol: "GC.F", 
      name: "黃金", 
      yahooTicker: "GC=F", 
      category: "SAFE_HAVEN",
      searchQuery: `gold GC=F price ${dateStr} today`,
      // ⭐ V8.3 調整：GOOGLEFINANCE 實際抓到的是 GLD ETF 價格（非黃金期貨）
      priceRange: [100, 1000],
      // ✅ 依用戶指示：Google 失敗就走 Stooq（不走 CSE）
      stooqTicker: "gld.us",
      disableCSEFallback: true
    },
    { 
      symbol: "SI.F", 
      name: "白銀", 
      yahooTicker: "SI=F", 
      category: "SAFE_HAVEN",
      searchQuery: `silver SI=F price ${dateStr} today`,
      priceRange: [10, 100]
    },
    { 
      symbol: "HG.F", 
      name: "銅", 
      yahooTicker: "HG=F", 
      category: "INDUSTRIAL",
      searchQuery: `copper HG=F price ${dateStr} today`,
      // ⭐ V8.3 調整：GOOGLEFINANCE 實際抓到的是 CPER ETF 價格（非銅期貨）
      priceRange: [10, 100],
      // ✅ 依用戶指示：Google 失敗就走 Stooq（不走 CSE）
      stooqTicker: "cper.us",
      disableCSEFallback: true
    }
  ];
  
  for (const item of commodityTickers) {
    try {
      Logger.log(`P5 Daily：收集 ${item.name} (${item.yahooTicker}) 價格`);
      
      // ⭐ V8.0 修正：優先使用 GOOGLEFINANCE，失敗則使用 CSE 搜尋
      let data = getMacroFromGoogleFinance(item.yahooTicker, item.name, item.priceRange);
      if (!data || !data.price) {
        // ✅ 指定品項：Google 失敗 → Stooq（不走 CSE）
        if (item.stooqTicker) {
          Logger.log(`P5 Daily：⚠️ ${item.name} GOOGLEFINANCE 獲取失敗，啟動 Stooq 救援 (${item.stooqTicker})...`);
          data = fetchMacroDataFromStooq(item.symbol, item.stooqTicker);
          if (data && data.price) {
            Logger.log(`P5 Daily：✅ [Stooq救援] ${item.name} 獲取成功: ${data.price}`);
            data.data_source = "STOOQ_RESCUE";
          }
        }

        // 其他品項：仍允許 CSE（除非明確禁用）
        if ((!data || !data.price) && item.disableCSEFallback !== true) {
          Logger.log(`P5 Daily：${item.name} GOOGLEFINANCE 獲取失敗，嘗試 CSE 搜尋`);
          data = getMacroDataFromCSE(item.searchQuery, item.name, item.priceRange);
        } else if ((!data || !data.price) && item.disableCSEFallback === true) {
          Logger.log(`P5 Daily：${item.name} GOOGLEFINANCE 獲取失敗（依設定不啟動 CSE，僅允許 Stooq）`);
        }
      }
      
      if (data && data.price) {
        commodities[item.symbol] = {
          name: item.name,
          price: data.price,
          change: data.change || 0,
          change_pct: data.change_pct || 0,
          status: "COMPLETED",
          data_source: data.data_source || "GOOGLE_INTERNAL"
        };
        Logger.log(`P5 Daily：成功收集 ${item.name} 價格：${data.price}（來源：${commodities[item.symbol].data_source}）`);
      } else {
        commodities[item.symbol] = {
          name: item.name,
          price: null,
          change: null,
          change_pct: null,
          status: "NO_DATA",
          note: item.disableCSEFallback === true ? "GOOGLEFINANCE/Stooq 無數據（依設定不啟動 CSE）" : "無法從 CSE 搜尋獲取數據"
        };
        Logger.log(`P5 Daily：${item.name} 無法獲取數據${item.disableCSEFallback === true ? "（已嘗試 Stooq，且依設定不啟動 CSE）" : "（已嘗試 CSE 搜尋）"}`);
      }
      
      // 避免請求過快
      Utilities.sleep(500);
      
    } catch (error) {
      Logger.log(`P5 Daily：收集 ${item.name} 價格失敗：${error.message}`);
      commodities[item.symbol] = {
        name: item.name,
        price: null,
        change: null,
        change_pct: null,
        status: "ERROR",
        error: error.message
      };
    }
  }
  
  return commodities;
}

/**
 * 收集匯率數據
 * ⭐ V8.0 修正：所有匯率優先使用 GOOGLEFINANCE，失敗則使用 Stooq 或 CSE 備援
 * 
 * @returns {Object} currencies - 匯率數據
 */
function collectCurrencyRates() {
  const currencies = {};
  
  const currencyPairs = [
    { 
      symbol: "DX-Y.NYB", 
      name: "美元指數", 
      yahooTicker: "DX-Y.NYB", 
      category: "INDEX", 
      // ✅ 依用戶指示：Google 失敗就走 Stooq（不走 CSE）
      stooqTicker: "uup.us", // Stooq：UUP ETF
      searchQuery: `US Dollar Index DXY DX-Y.NYB price today`,
      // ⭐ V8.3 調整：GOOGLEFINANCE 實際抓到的是 UUP ETF 價格（非 DXY 指數點位）
      priceRange: [10, 60],
      disableCSEFallback: true
    },
    { 
      symbol: "EURUSD", 
      name: "歐元/美元", 
      stooqTicker: "EURUSD", 
      yahooTicker: "EURUSD=X", 
      category: "MAJOR",
      priceRange: [0.8, 1.5]
    },
    { 
      symbol: "GBPUSD", 
      name: "英鎊/美元", 
      stooqTicker: "GBPUSD", 
      yahooTicker: "GBPUSD=X", 
      category: "MAJOR",
      priceRange: [1.0, 2.0]
    },
    { 
      symbol: "USDJPY", 
      name: "美元/日圓", 
      stooqTicker: "USDJPY", 
      yahooTicker: "USDJPY=X", 
      category: "SAFE_HAVEN_REFERENCE",
      priceRange: [80, 200]
    },
    { 
      symbol: "USDCHF", 
      name: "美元/瑞郎", 
      stooqTicker: "USDCHF", 
      yahooTicker: "USDCHF=X", 
      category: "SAFE_HAVEN_PRIMARY",
      priceRange: [0.7, 1.2]
    },
    { 
      symbol: "USDCNY", 
      name: "美元/人民幣", 
      stooqTicker: "USDCNY", 
      yahooTicker: "CNY=X", 
      category: "EMERGING",
      priceRange: [5, 10]
    }
  ];
  
  for (const item of currencyPairs) {
    try {
      Logger.log(`P5 Daily：收集 ${item.name} 匯率`);
      
      let data = null;

      // ✅ 美元指數（UUP ETF）：Google -> Stooq（不走 CSE / 不走混合引擎）
      if (item.symbol === "DX-Y.NYB" && item.disableCSEFallback === true) {
        data = getMacroFromGoogleFinance(item.yahooTicker, item.name, item.priceRange);
        if (!data || !data.price) {
          Logger.log(`P5 Daily：⚠️ ${item.name} GOOGLEFINANCE 獲取失敗，啟動 Stooq 救援 (${item.stooqTicker})...`);
          data = fetchMacroDataFromStooq(item.symbol, item.stooqTicker);
          if (data && data.price) {
            Logger.log(`P5 Daily：✅ [Stooq救援] ${item.name} 獲取成功: ${data.price}`);
            data.data_source = "STOOQ_RESCUE";
          } else {
            Logger.log(`P5 Daily：⚠️ ${item.name} Stooq 救援也失敗（依設定不啟動 CSE）`);
          }
        }
      } else
      
      // ⭐ V8.2 混合引擎：使用智能數據獲取指揮官（Google Finance 優先，失敗自動切換到 Stooq/Yahoo）
      // 檢查 getSmartData 函數是否存在
      if (typeof getSmartData === 'function') {
        // ⭐ V8.3 修正：直接構建 Google ticker，不需要先調用 getMacroFromGoogleFinance
        const tickerMap = {
          "EURUSD=X": "CURRENCY:EURUSD",
          "GBPUSD=X": "CURRENCY:GBPUSD",
          "USDJPY=X": "CURRENCY:USDJPY",
          "USDCHF=X": "CURRENCY:USDCHF",
          "CNY=X": "CURRENCY:USDCNY",
          "DX-Y.NYB": "NYSEARCA:UUP"
        };
        const googleTicker = item.yahooTicker ? (tickerMap[item.yahooTicker] || item.yahooTicker) : null;
        
        data = getSmartData(item.name, googleTicker, "FOREX", item.priceRange);
      } else {
        // 如果 getSmartData 不存在，使用舊的邏輯
        data = getMacroFromGoogleFinance(item.yahooTicker, item.name, item.priceRange);
        
        if ((!data || !data.price) && item.disableCSEFallback !== true) {
          if (item.stooqTicker) {
            Logger.log(`P5 Daily：⚠️ [Google] ${item.name} 獲取失敗（已嘗試所有備用代碼），啟動 Stooq 救援...`);
            data = fetchMacroDataFromStooq(item.symbol, item.stooqTicker);
            if (data && data.price) {
              Logger.log(`P5 Daily：✅ [Stooq救援] ${item.name} 獲取成功: ${data.price}`);
              data.data_source = "STOOQ_RESCUE";
            }
          } else {
            Logger.log(`P5 Daily：⚠️ [Google] ${item.name} 獲取失敗，嘗試 CSE 搜尋`);
            data = getMacroDataFromCSE(item.searchQuery, item.name, item.priceRange);
          }
        } else if ((!data || !data.price) && item.disableCSEFallback === true) {
          Logger.log(`P5 Daily：⚠️ [Google] ${item.name} 獲取失敗（依設定不啟動 CSE）`);
        }
      }
      
      if (data && data.price) {
        currencies[item.symbol] = {
          name: item.name,
          rate: data.price,
          change: data.change || 0,
          change_pct: data.change_pct || 0,
          status: "COMPLETED",
          data_source: data.data_source || "GOOGLE_INTERNAL"
        };
        Logger.log(`P5 Daily：成功收集 ${item.name} 匯率：${data.price}（來源：${currencies[item.symbol].data_source}）`);
      } else {
        currencies[item.symbol] = {
          name: item.name,
          rate: null,
          change: null,
          change_pct: null,
          status: "NO_DATA",
          note: item.disableCSEFallback === true ? "GOOGLEFINANCE/Stooq 無數據（依設定不啟動 CSE）" : "無法從 GOOGLEFINANCE 或備援方案獲取數據"
        };
        Logger.log(`P5 Daily：${item.name} 無法獲取數據`);
      }
      
      Utilities.sleep(300);
      
    } catch (error) {
      Logger.log(`P5 Daily：收集 ${item.name} 匯率失敗：${error.message}`);
      currencies[item.symbol] = {
        name: item.name,
        rate: null,
        change: null,
        change_pct: null,
        status: "ERROR",
        error: error.message
      };
    }
  }
  
  return currencies;
}

/**
 * 收集國債利率
 * ⭐ V8.0 修正：改用 CSE 搜尋 Yahoo Finance 數據
 * 
 * @returns {Object} bonds - 國債利率數據
 */
function collectBondYields() {
  const bonds = {};
  
  const today = new Date();
  const month = String(today.getMonth() + 1);
  const day = String(today.getDate());
  const dateStr = `${today.getFullYear()}-${month.length === 1 ? '0' + month : month}-${day.length === 1 ? '0' + day : day}`;
  
  const bondTickers = [
    { 
      symbol: "10USY.B", 
      name: "美國10年期國債", 
      yahooTicker: "^TNX", 
      searchQuery: `10 year treasury yield TNX ^TNX ${dateStr} today`,
      priceRange: [0, 20]  // 注意：GOOGLEFINANCE 回傳值需除以 10，所以實際範圍是 0-2%
    },
    { 
      symbol: "5USY.B", 
      name: "美國5年期國債", 
      yahooTicker: "^FVX", 
      searchQuery: `5 year treasury yield FVX ^FVX ${dateStr} today`,
      priceRange: [0, 20]  // 注意：GOOGLEFINANCE 回傳值需除以 10
    },
    { 
      symbol: "30USY.B", 
      name: "美國30年期國債", 
      yahooTicker: "^TYX", 
      searchQuery: `30 year treasury yield TYX ^TYX ${dateStr} today`,
      priceRange: [0, 20]  // 注意：GOOGLEFINANCE 回傳值需除以 10
    },
    { 
      symbol: "3USY.B", 
      name: "美國3個月國債", 
      yahooTicker: "^IRX", 
      searchQuery: `3 month treasury yield IRX ^IRX ${dateStr} today`,
      priceRange: [0, 10]  // 注意：GOOGLEFINANCE 回傳值需除以 10
    }
  ];
  
  for (const item of bondTickers) {
    try {
      Logger.log(`P5 Daily：收集 ${item.name} (${item.yahooTicker}) 利率`);
      
      // ⭐ V8.0 修正：優先使用 GOOGLEFINANCE，失敗則使用 CSE 搜尋
      let data = getMacroFromGoogleFinance(item.yahooTicker, item.name, item.priceRange);
      if (!data || !data.price) {
        Logger.log(`P5 Daily：${item.name} GOOGLEFINANCE 獲取失敗，嘗試 CSE 搜尋`);
        data = getMacroDataFromCSE(item.searchQuery, item.name, item.priceRange);
      }
      
      if (data && data.price) {
        bonds[item.symbol] = {
          name: item.name,
          yield_rate: data.price,  // 國債使用 yield_rate 欄位
          change: data.change || 0,
          change_pct: data.change_pct || 0,
          status: "COMPLETED",
          data_source: data.data_source || "GOOGLE_INTERNAL"
        };
        Logger.log(`P5 Daily：成功收集 ${item.name} 利率：${data.price}%（來源：${bonds[item.symbol].data_source}）`);
      } else {
        bonds[item.symbol] = {
          name: item.name,
          yield_rate: null,
          change: null,
          change_pct: null,
          status: "NO_DATA",
          note: "無法從 CSE 搜尋獲取數據"
        };
        Logger.log(`P5 Daily：${item.name} 無法獲取數據（已嘗試 CSE 搜尋）`);
      }
      
      Utilities.sleep(500);
      
    } catch (error) {
      Logger.log(`P5 Daily：收集 ${item.name} 利率失敗：${error.message}`);
      bonds[item.symbol] = {
        name: item.name,
        yield_rate: null,
        change: null,
        change_pct: null,
        status: "ERROR",
        error: error.message
      };
    }
  }
  
  return bonds;
}

/**
 * 收集市場指數（VIX 等）
 * ⭐ V8.0 修正：改用 CSE 搜尋 Yahoo Finance 數據
 * 
 * @returns {Object} indices - 市場指數數據
 */
function collectMarketIndices() {
  const indices = {};
  
  const today = new Date();
  const month = String(today.getMonth() + 1);
  const day = String(today.getDate());
  const dateStr = `${today.getFullYear()}-${month.length === 1 ? '0' + month : month}-${day.length === 1 ? '0' + day : day}`;
  
  // ⭐ V8.12 擴充：增加Tier 1和Tier 2數據收集
  const indexTickers = [
    // Tier 1：一級硬錨點
    { 
      symbol: "VI.F", 
      name: "VIX", 
      yahooTicker: "^VIX", 
      searchQuery: `VIX index ^VIX volatility ${dateStr} today`,
      priceRange: [5, 100],
      tier: "Tier1"
    },
    // ⭐ V8.12 新增：MOVE Index（債券波動）或Proxy（用TLT的intraday volatility當proxy）
    // 注意：MOVE Index可能無法直接獲取，使用TLT ETF作為proxy
    { 
      symbol: "TLT.VOL", 
      name: "TLT波動率（MOVE Proxy）", 
      yahooTicker: "TLT", 
      searchQuery: `TLT ETF volatility bond volatility ${dateStr} today`,
      priceRange: [0, 100],
      tier: "Tier1",
      note: "MOVE Index Proxy，用於債市流動性緊張早期警報"
    },
    // ⭐ V8.12 新增：LQD（投資級公司債ETF）
    { 
      symbol: "LQD", 
      name: "LQD（投資級公司債）", 
      yahooTicker: "LQD", 
      searchQuery: `LQD investment grade corporate bond ETF ${dateStr} today`,
      priceRange: [50, 200],
      tier: "Tier1",
      note: "用於驗證金融系統緊張（HYG + LQD一起看）"
    },
    // ⭐ V8.12 新增：RSP（SPX equal-weight，可選但非常有價值）
    { 
      symbol: "RSP", 
      name: "RSP（SPX等權重）", 
      yahooTicker: "RSP", 
      searchQuery: `RSP S&P 500 equal weight ETF ${dateStr} today`,
      priceRange: [50, 200],
      tier: "Tier1",
      note: "驗證權值股吸血敘事（SPX漲但RSP跌 = 集中型上漲）"
    },
    // Tier 2：二級代理錨點
    // ⭐ V8.12 新增：BITO / IBIT（BTC proxy）
    { 
      symbol: "BITO", 
      name: "BITO（比特幣ETF）", 
      yahooTicker: "BITO", 
      searchQuery: `BITO bitcoin ETF ${dateStr} today`,
      priceRange: [10, 100],
      tier: "Tier2",
      note: "BTC proxy，Primary"
    },
    { 
      symbol: "IBIT", 
      name: "IBIT（比特幣ETF備用）", 
      yahooTicker: "IBIT", 
      searchQuery: `IBIT bitcoin ETF ${dateStr} today`,
      priceRange: [10, 100],
      tier: "Tier2",
      note: "BTC proxy，Fallback"
    },
    // ⭐ V8.12 新增：XME（Metal & Mining ETF）
    { 
      symbol: "XME", 
      name: "XME（金屬與礦業ETF）", 
      yahooTicker: "XME", 
      searchQuery: `XME metal mining ETF ${dateStr} today`,
      priceRange: [20, 200],  // ⭐ V8.13 修正：實際價格約124，調整上限至200
      tier: "Tier2",
      note: "大宗金屬總體proxy，補足REMX/COPX盲區"
    },
    // ⭐ V8.12 新增：戰略物資ETF
    { 
      symbol: "LIT", 
      name: "LIT（鋰ETF）", 
      yahooTicker: "LIT", 
      searchQuery: `LIT lithium ETF ${dateStr} today`,
      priceRange: [20, 200],
      tier: "Tier2"
    },
    { 
      symbol: "REMX", 
      name: "REMX（稀土ETF）", 
      yahooTicker: "REMX", 
      searchQuery: `REMX rare earth ETF ${dateStr} today`,
      priceRange: [20, 200],
      tier: "Tier2"
    },
    { 
      symbol: "URA", 
      name: "URA（鈾ETF）", 
      yahooTicker: "URA", 
      searchQuery: `URA uranium ETF ${dateStr} today`,
      priceRange: [10, 100],
      tier: "Tier2"
    },
    { 
      symbol: "TAN", 
      name: "TAN（太陽能ETF）", 
      yahooTicker: "TAN", 
      searchQuery: `TAN solar energy ETF ${dateStr} today`,
      priceRange: [20, 200],
      tier: "Tier2"
    },
    // ⭐ V8.12 新增：板塊ETF（用於驗證產業方向）
    { 
      symbol: "XLK", 
      name: "XLK（科技板塊ETF）", 
      yahooTicker: "XLK", 
      searchQuery: `XLK technology sector ETF ${dateStr} today`,
      priceRange: [50, 300],
      tier: "Tier2",
      note: "驗證科技產業方向"
    },
    { 
      symbol: "SOXX", 
      name: "SOXX（半導體ETF）", 
      yahooTicker: "SOXX", 
      searchQuery: `SOXX semiconductor ETF ${dateStr} today`,
      priceRange: [100, 1000],
      tier: "Tier2",
      note: "驗證AI/半導體新聞"
    },
    { 
      symbol: "SMH", 
      name: "SMH（半導體ETF備用）", 
      yahooTicker: "SMH", 
      searchQuery: `SMH semiconductor ETF ${dateStr} today`,
      priceRange: [50, 500],
      tier: "Tier2",
      note: "SOXX備用"
    },
    { 
      symbol: "IGV", 
      name: "IGV（軟體ETF）", 
      yahooTicker: "IGV", 
      searchQuery: `IGV software ETF ${dateStr} today`,
      priceRange: [50, 500],
      tier: "Tier2"
    }
  ];
  
  for (const item of indexTickers) {
    try {
      Logger.log(`P5 Daily：收集 ${item.name} (${item.yahooTicker}) 指數`);
      
      // ⭐ V8.0 修正：優先使用 GOOGLEFINANCE，失敗則使用 CSE 搜尋
      let data = getMacroFromGoogleFinance(item.yahooTicker, item.name, item.priceRange);
      if (!data || !data.price) {
        Logger.log(`P5 Daily：${item.name} GOOGLEFINANCE 獲取失敗，嘗試 CSE 搜尋`);
        data = getMacroDataFromCSE(item.searchQuery, item.name, item.priceRange);
      }
      
      if (data && data.price) {
        indices[item.symbol] = {
          name: item.name,
          value: data.price,
          change: data.change || 0,
          change_pct: data.change_pct || 0,
          status: "COMPLETED",
          data_source: data.data_source || "GOOGLE_INTERNAL",
          tier: item.tier || "Tier2",  // ⭐ V8.12 新增：Tier分級標記
          note: item.note || null
        };
        Logger.log(`P5 Daily V8.12：成功收集 ${item.name} (${item.tier || "Tier2"})：${data.price}（來源：${indices[item.symbol].data_source}）`);
      } else {
        indices[item.symbol] = {
          name: item.name,
          value: null,
          change: null,
          change_pct: null,
          status: "NO_DATA",
          tier: item.tier || "Tier2",  // ⭐ V8.12 新增：Tier分級標記
          note: item.note || "無法從 CSE 搜尋獲取數據"
        };
        Logger.log(`P5 Daily：${item.name} 無法獲取數據（已嘗試 CSE 搜尋）`);
      }
      
      Utilities.sleep(500);
      
    } catch (error) {
      Logger.log(`P5 Daily：收集 ${item.name} 指數失敗：${error.message}`);
      indices[item.symbol] = {
        name: item.name,
        value: null,
        change: null,
        change_pct: null,
        status: "ERROR",
        error: error.message
      };
    }
  }
  
  return indices;
}

/**
 * 從 Stooq 獲取宏觀數據（保留用於匯率，因為 Stooq 匯率正常）
 * ⚠️ 注意：此函數保留用於匯率，商品/指數/國債已改用 CSE 搜尋
 * 
 * @param {string} symbol - 數據符號
 * @param {string} stooqTicker - Stooq ticker
 * @returns {Object|null} data - 數據
 */
function fetchMacroDataFromStooq(symbol, stooqTicker) {
  const maxRetries = 3;
  let retryCount = 0;
  let response = null;
  let statusCode = 0;
  let responseText = "";
  
  const properties = PropertiesService.getScriptProperties();
  const cloudFunctionUrl = properties.getProperty("CLOUD_FUNCTION_STOOQ_URL");
  
  if (!cloudFunctionUrl) {
    Logger.log(`P5 Daily：未配置 Cloud Function 代理 URL（CLOUD_FUNCTION_STOOQ_URL）`);
    return null;
  }
  
  while (retryCount < maxRetries) {
    try {
      Logger.log(`P5 Daily：從 stooq.com 獲取 ${symbol} (${stooqTicker}) 宏觀數據（通過代理）${retryCount > 0 ? `（重試第 ${retryCount} 次）` : ''}`);
      
      response = UrlFetchApp.fetch(`${cloudFunctionUrl}?ticker=${encodeURIComponent(stooqTicker)}`, {
        method: "GET",
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      statusCode = response.getResponseCode();
      responseText = response.getContentText();
      
      if (statusCode === 200) {
        break;
      } else if (statusCode === 500 || statusCode === 503 || statusCode === 429) {
        retryCount++;
        if (retryCount < maxRetries) {
          const delay = Math.min(2000 * retryCount, 10000);
          const errorText = responseText.substring(0, 200);
          Logger.log(`P5 Daily：${symbol} (${stooqTicker}) HTTP ${statusCode} 錯誤，等待 ${delay}ms 後重試（第 ${retryCount} 次）：${errorText}`);
          Utilities.sleep(delay);
          continue;
        } else {
          const errorText = responseText.substring(0, 200);
          Logger.log(`P5 Daily：${symbol} (${stooqTicker}) HTTP ${statusCode} 錯誤（已重試 ${retryCount} 次）：${errorText}`);
          return null;
        }
      } else {
        const errorText = responseText.substring(0, 200);
        Logger.log(`P5 Daily：${symbol} (${stooqTicker}) HTTP ${statusCode} 錯誤：${errorText}`);
        return null;
      }
    } catch (error) {
      retryCount++;
      if (retryCount < maxRetries) {
        const delay = Math.min(2000 * retryCount, 10000);
        Logger.log(`P5 Daily：${symbol} 請求異常，等待 ${delay}ms 後重試（第 ${retryCount} 次）：${error.message}`);
        Utilities.sleep(delay);
        continue;
      } else {
        Logger.log(`P5 Daily：從 stooq.com 獲取 ${symbol} 數據失敗（已重試 ${retryCount} 次）：${error.message}`);
        return null;
      }
    }
  }
  
  if (statusCode !== 200 || retryCount >= maxRetries) {
    return null;
  }
  
  try {
    const csvText = responseText;
    
    if (csvText.trim().startsWith('<') || csvText.includes('<!DOCTYPE')) {
      Logger.log(`P5 Daily：${symbol} 返回 HTML 而非 CSV`);
      return null;
    }
    
    const lines = csvText.trim().split('\n');
    
    if (csvText.includes("Exceeded the daily hits limit") || csvText.includes("daily hits limit")) {
      Logger.log(`P5 Daily：${symbol} stooq.com 超過每日訪問限制`);
      return null;
    }
    
    if (csvText.toLowerCase().includes("no data") || csvText.toLowerCase().includes("nodata")) {
      Logger.log(`P5 Daily：${symbol} stooq.com 返回 "no data"`);
      return null;
    }
    
    if (lines.length < 2) {
      Logger.log(`P5 Daily：${symbol} CSV 數據不足（只有 ${lines.length} 行）`);
      return null;
    }
    
    const lastLine = lines[lines.length - 1];
    const values = lastLine.split(',');
    
    if (values.length < 5) {
      Logger.log(`P5 Daily：${symbol} CSV 格式錯誤`);
      return null;
    }
    
    const dateStr = values[0].trim();
    const close = parseFloat(values[4]);
    
    if (isNaN(close) || close <= 0) {
      Logger.log(`P5 Daily：${symbol} 無效的價格：${close}`);
      return null;
    }
    
    let change = 0;
    let change_pct = 0;
    
    if (lines.length >= 2) {
      const prevLine = lines[lines.length - 2];
      const prevValues = prevLine.split(',');
      if (prevValues.length >= 5) {
        const prevClose = parseFloat(prevValues[4]);
        if (!isNaN(prevClose) && prevClose > 0) {
          change = close - prevClose;
          change_pct = (change / prevClose) * 100;
        }
      }
    }
    
    return {
      price: close,
      change: change,
      change_pct: change_pct,
      date: dateStr
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：從 stooq.com 獲取 ${symbol} 數據失敗：${error.message}`);
    return null;
  }
}

// ⭐ V8.0 新增：追蹤已獲取的價格，防止多個 ticker 回傳相同價格（數據污染檢測）
let collectedPrices = {};

/**
 * 驗證宏觀數據的合理性
 * ⭐ V8.0 新增：防止解析錯誤和數據污染
 * 
 * @param {string} ticker - Ticker 符號
 * @param {number} price - 價格
 * @param {number} change - 變化
 * @param {number} change_pct - 變化百分比
 * @returns {boolean} 是否通過驗證
 */
function validateMacroData(ticker, price, change, change_pct) {
  // 1. 價格合理性檢查
  const reasonableRanges = {
    "CL=F": [20, 200],        // WTI原油
    "BZ=F": [20, 200],        // Brent原油
    "GC=F": [100, 1000],      // ⭐ V8.3：黃金改用 GLD ETF 價格範圍
    "SI=F": [10, 100],        // 白銀（美元/盎司）
    "HG=F": [10, 100],        // ⭐ V8.3：銅改用 CPER ETF 價格範圍
    "^VIX": [5, 100],         // VIX
    "^TNX": [0, 20],          // 10年期美債利率（%）
    "^IRX": [0, 10],          // 3個月美債利率（%）
    "DX-Y.NYB": [10, 60],     // ⭐ V8.3：美元指數改用 UUP ETF 價格範圍
    "EURUSD=X": [0.8, 1.5],   // 歐元/美元
    "GBPUSD=X": [1.0, 2.0],   // 英鎊/美元
    "USDJPY=X": [80, 200],    // 美元/日圓
    "USDCHF=X": [0.7, 1.2],   // 美元/瑞郎
    "CNY=X": [5, 10],         // 美元/人民幣
    // CSE 搜尋可能使用項目名稱而不是 ticker
    "WTI原油": [20, 200],
    "Brent原油": [20, 200],
    "黃金": [100, 1000],
    "白銀": [10, 100],
    "銅": [10, 100],
    "VIX": [5, 100],
    "美國10年期國債": [0, 20],
    "美國3個月國債": [0, 10],
    "美元指數": [10, 60]
  };
  
  const range = reasonableRanges[ticker];
  if (range) {
    if (price < range[0] || price > range[1]) {
      Logger.log(`P5 Daily：⚠️ ${ticker} 價格 ${price.toFixed(2)} 超出合理範圍 [${range[0]}, ${range[1]}]`);
      return false;
    }
  }
  
  // 2. 變動幅度檢查（日變動不應超過 50%）
  if (Math.abs(change_pct) > 50) {
    Logger.log(`P5 Daily：⚠️ ${ticker} 日變動 ${change_pct.toFixed(2)}% 過大，可能是解析錯誤`);
    return false;
  }
  
  // 3. 價格必須是有效數字
  if (isNaN(price) || price <= 0) {
    Logger.log(`P5 Daily：⚠️ ${ticker} 價格 ${price} 無效`);
    return false;
  }
  
  return true;
}

/**
 * 檢查數據污染（多個 ticker 回傳相同價格）
 * ⭐ V8.0 新增：防止解析錯誤導致的數據污染
 * 
 * @param {string} ticker - Ticker 符號
 * @param {number} price - 價格
 * @returns {boolean} 是否通過污染檢測
 */
function checkDataContamination(ticker, price) {
  // 檢查是否有其他 ticker 已經使用相同的價格
  for (const otherTicker in collectedPrices) {
    if (collectedPrices.hasOwnProperty(otherTicker)) {
      const otherPrice = collectedPrices[otherTicker];
      if (otherTicker !== ticker && Math.abs(otherPrice - price) < 0.01) {
        Logger.log(`P5 Daily：⚠️ 數據污染警告：${ticker} 和 ${otherTicker} 回傳相同價格 ${price.toFixed(2)}，可能是解析錯誤`);
        return false;
      }
    }
  }
  
  // 記錄此 ticker 的價格
  collectedPrices[ticker] = price;
  return true;
}
