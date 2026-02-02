/**
 * 🧪 GOOGLEFINANCE 數據源測試模組
 * 
 * 測試 Gemini 建議的所有 GOOGLEFINANCE 代碼
 * 用於驗證數據源可用性，為切換到 GOOGLEFINANCE 做準備
 * 
 * @version V8.0
 * @date 2025-01-17
 */

// ==========================================
// 測試配置（Gemini 建議的代碼）
// ==========================================

const GOOGLEFINANCE_TEST_CONFIG = {
  // 商品 ETF（替代期貨）
  commodities: [
    { name: "WTI 原油", code: "NYSEARCA:USO", type: "ETF", priceRange: [20, 200] },
    { name: "Brent 原油", code: "NYSEARCA:BNO", type: "ETF", priceRange: [20, 200] },
    { name: "黃金", code: "NYSEARCA:GLD", type: "ETF", priceRange: [100, 500] },
    { name: "白銀", code: "NYSEARCA:SLV", type: "ETF", priceRange: [10, 100] },
    { name: "銅", code: "NYSEARCA:CPER", type: "ETF", priceRange: [10, 50] }
  ],
  
  // 匯率
  currencies: [
    { name: "美元指數", code: "NYSEARCA:UUP", type: "ETF", priceRange: [20, 50] },
    { name: "歐元/美元", code: "CURRENCY:EURUSD", type: "CURRENCY", priceRange: [0.8, 1.5] },
    { name: "英鎊/美元", code: "CURRENCY:GBPUSD", type: "CURRENCY", priceRange: [1.0, 2.0] },
    { name: "美元/日圓", code: "CURRENCY:USDJPY", type: "CURRENCY", priceRange: [80, 200] },
    { name: "美元/瑞郎", code: "CURRENCY:USDCHF", type: "CURRENCY", priceRange: [0.7, 1.2] },
    { name: "美元/人民幣", code: "CURRENCY:USDCNY", type: "CURRENCY", priceRange: [5, 10] }
  ],
  
  // 國債利率（需除以 10）
  bonds: [
    { name: "10年美債", code: "INDEXCBOE:TNX", type: "BOND", priceRange: [0, 20], divideBy10: true },
    { name: "5年美債", code: "INDEXCBOE:FVX", type: "BOND", priceRange: [0, 20], divideBy10: true },
    { name: "30年美債", code: "INDEXCBOE:TYX", type: "BOND", priceRange: [0, 20], divideBy10: true },
    { name: "3個月美債", code: "INDEXCBOE:IRX", type: "BOND", priceRange: [0, 10], divideBy10: true }
  ],
  
  // 市場指數
  indices: [
    { name: "VIX", code: "INDEXCBOE:VIX", type: "INDEX", priceRange: [5, 100] }
  ],
  
  // 板塊 ETF
  sectorETFs: [
    { name: "XLK (科技)", code: "NYSEARCA:XLK", type: "ETF", priceRange: [50, 500] },
    { name: "XLF (金融)", code: "NYSEARCA:XLF", type: "ETF", priceRange: [20, 100] },
    { name: "XLE (能源)", code: "NYSEARCA:XLE", type: "ETF", priceRange: [30, 200] },
    { name: "XLV (醫療)", code: "NYSEARCA:XLV", type: "ETF", priceRange: [50, 300] },
    { name: "XLI (工業)", code: "NYSEARCA:XLI", type: "ETF", priceRange: [50, 300] },
    { name: "XLP (必需消費)", code: "NYSEARCA:XLP", type: "ETF", priceRange: [40, 150] },
    { name: "XLY (非必需消費)", code: "NYSEARCA:XLY", type: "ETF", priceRange: [50, 300] },
    { name: "XLU (公用事業)", code: "NYSEARCA:XLU", type: "ETF", priceRange: [30, 150] },
    { name: "XLB (原物料)", code: "NYSEARCA:XLB", type: "ETF", priceRange: [30, 200] },
    { name: "XLRE (房地產)", code: "NYSEARCA:XLRE", type: "ETF", priceRange: [20, 100] },
    { name: "XLC (通訊服務)", code: "NYSEARCA:XLC", type: "ETF", priceRange: [30, 200] }
  ],
  
  // 個股 OHLCV（測試樣本）
  stocks: [
    { name: "NVDA (美股)", code: "NASDAQ:NVDA", type: "STOCK", market: "US" },
    { name: "TSM (美股)", code: "NYSE:TSM", type: "STOCK", market: "US" },
    { name: "2330 (台股)", code: "TPE:2330", type: "STOCK", market: "TW" },
    { name: "8035 (日股)", code: "TYO:8035", type: "STOCK", market: "JP" }
  ]
};

// ==========================================
// 核心測試函數
// ==========================================

/**
 * V8.1 核心工具：智能多重代碼讀取器 (Advanced Ticker Fallback)
 * 解決：匯率和日股在 GAS 環境下對前綴敏感導致 #N/A 的問題
 * 策略：嘗試主要代碼 -> 失敗 -> 嘗試備用代碼 -> 失敗 -> 回傳 null
 * 
 * @param {string} ticker - GOOGLEFINANCE 代碼
 * @param {string} attribute - 屬性（"price", "volume", "changepct" 等）
 * @returns {number|null} 數值，失敗返回 null
 */
function fetchGoogleFinanceSafe(ticker, attribute) {
  attribute = attribute || "price";
  
  // --- 定義備用代碼映射 (Fallback Map) ---
  // 當主要代碼失敗時，自動嘗試這裡的替代方案
  // ⭐ V8.9 修正：匯率只嘗試 CURRENCY:EURUSD -> EURUSD -> CURRENCY:USDEUR，其他都拿掉
  var fallbackMap = {
    // 匯率：簡化fallback邏輯（只嘗試必要的代碼）
    "CURRENCY:EURUSD": ["EURUSD", "CURRENCY:USDEUR"],
    "CURRENCY:GBPUSD": ["GBPUSD", "CURRENCY:USDGBP"],
    "CURRENCY:USDJPY": ["USDJPY", "CURRENCY:JPYUSD"],
    "CURRENCY:USDCHF": ["USDCHF", "CURRENCY:CHFUSD"],
    "CURRENCY:USDCNY": ["USDCNY", "CURRENCY:CNYUSD"],
    
    // 匯率：如果直接使用 EURUSD 等格式失敗，嘗試 CURRENCY: 和反向
    "EURUSD": ["CURRENCY:EURUSD", "CURRENCY:USDEUR"],
    "GBPUSD": ["CURRENCY:GBPUSD", "CURRENCY:USDGBP"],
    "USDJPY": ["CURRENCY:USDJPY", "CURRENCY:JPYUSD"],
    "USDCHF": ["CURRENCY:USDCHF", "CURRENCY:CHFUSD"],
    "USDCNY": ["CURRENCY:USDCNY", "CURRENCY:CNYUSD"],
    
    // ⚠️ V8.3 修正：日股已知 Google Finance 會失敗（週末效應），直接移除 fallback，快速觸發 Stooq 救援
    // 不再嘗試 SHE:8035（已知也會失敗），直接交給 Stooq 救援（更快速）
    // 注意：這裡不設置 fallback，讓它快速失敗並觸發 Stooq 救援
    // 日股 fallback 已移除，直接快速失敗觸發 Stooq 救援
    
    // 台股：保留 TPE，通常沒問題
    // "TPE:2330": ["2330"]  // 移除純數字 fallback，避免混淆
  };

  // 建立嘗試隊列：[原始代碼, 備用代碼1, 備用代碼2...]
  var tryList = [ticker];
  if (fallbackMap[ticker]) {
    tryList = tryList.concat(fallbackMap[ticker]);
  }
  
  // ⚠️ V8.3 修正：移除自動無前綴擴展（避免日股抓到錯誤市場）
  // 如果 ticker 包含 ":" 但沒有定義備用映射，不要自動嘗試無前綴版本
  // 例如：TYO:8035 如果失敗，應該交由備援機制處理（Stooq），而不是嘗試 8035（可能抓到錯誤市場）
  // 這個智能擴展在日股情況下非常危險，已經移除
  // 
  // ⭐ 例外：美股歷史數據（NYSE:TSM, NASDAQ:NVDA）已知無前綴版本會成功，已在 fetchGoogleFinanceHistorySafe 中處理

  // 1. 獲取專用代理 Sheet
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("SYS_G_FINANCE_PROXY");
  if (!sheet) {
    sheet = ss.insertSheet("SYS_G_FINANCE_PROXY");
    sheet.hideSheet();
  }
  
  // 為了避免並發衝突，使用隨機的單元格位置 (Row 1-10)
  var randomRow = Math.floor(Math.random() * 10) + 1;
  var cell = sheet.getRange("A" + randomRow);

  // --- 開始嘗試迴圈 ---
  for (var t = 0; t < tryList.length; t++) {
    var currentTicker = tryList[t];
    // Logger.log("🔍 嘗試獲取: " + currentTicker + " (屬性: " + attribute + ")");

    // 1. 清除舊值並強制刷新
    cell.clearContent();
    SpreadsheetApp.flush();

    // 2. 寫入公式
    cell.setFormula('=GOOGLEFINANCE("' + currentTicker + '", "' + attribute + '")');
    SpreadsheetApp.flush();

    // ⚠️ V8.3 修正：大幅縮短等待時間 (Fail Fast)
    // 原本 16次(8秒) -> 改為 8次(4秒)
    // 如果 Google 4秒不給數據，通常就是掛了（週末/非交易時段），不用浪費時間
    // 這樣可以避免 5個匯率 x 3種前綴 x 20秒 = 300秒的超時問題
    // 
    // ⭐ V8.3 優化：日股已知會失敗，進一步縮短等待時間（2秒）以快速觸發 Stooq 救援
    var isJapaneseStock = ticker.includes("TYO:") || ticker.includes("SHE:") || ticker.includes("8035");
    var maxRetries = isJapaneseStock ? 4 : 8;  // 日股：4次 * 500ms = 2秒，其他：8次 * 500ms = 4秒 
    var success = false;
    var value = null;
    var displayValue = null;

    for (var i = 0; i < maxRetries; i++) {
      Utilities.sleep(500); // 0.5s
      value = cell.getValue();
      displayValue = cell.getDisplayValue();

      // 成功判定：是數字且不是錯誤
      if (typeof value === 'number' && !isNaN(value) && value > 0) {
        // ⭐ V8.2 新增：價格合理性檢查（防止抓到錯誤市場的數據）
        if (attribute === "price") {
          // 日股價格合理性檢查（日股通常 > 100 JPY，如果 < 1 可能是錯誤市場）
          if (ticker.indexOf("TYO") > -1 || ticker.indexOf("SHE") > -1) {
            if (value < 1) {
              Logger.log(`⚠️ 價格異常過低 (${value})，可能是錯誤市場數據，視為無效: ${currentTicker}`);
              break; // 強制失敗，觸發 Yahoo 救援
            }
          }
          // 台股價格合理性檢查（台股通常 > 10 TWD，如果 < 0.1 可能是錯誤市場）
          if (ticker.indexOf("TPE") > -1) {
            if (value < 0.1) {
              Logger.log(`⚠️ 價格異常過低 (${value})，可能是錯誤市場數據，視為無效: ${currentTicker}`);
              break; // 強制失敗，觸發 Yahoo 救援
            }
          }
          // 匯率合理性檢查（匯率通常 > 0.5，如果 < 0.01 可能是錯誤數據）
          if (ticker.indexOf("EURUSD") > -1 || ticker.indexOf("GBPUSD") > -1 || 
              ticker.indexOf("USDJPY") > -1 || ticker.indexOf("USDCHF") > -1 || 
              ticker.indexOf("USDCNY") > -1 || ticker.indexOf("CNY=X") > -1) {
            if (value < 0.01) {
              Logger.log(`⚠️ 匯率價格異常過低 (${value})，可能是錯誤數據，視為無效: ${currentTicker}`);
              break; // 強制失敗，觸發 Yahoo 救援
            }
          }
        }
        
        success = true;
        Logger.log(`✅ fetchGoogleFinanceSafe: ${currentTicker} ${attribute} = ${value}`);
        break;
      }
      
      // 如果出現 #N/A，不要馬上放棄，Google 可能還在算
      // 但如果等到最後一次還是 #N/A，就換下一個代碼
      if (displayValue !== "#N/A" && displayValue !== "Loading..." && displayValue !== "#ERROR!" && displayValue !== "") {
        // 如果回傳了其他值但不是數字，也視為失敗，嘗試下一個代碼
        break;
      }
    }

    if (success) {
      return value;
    } else {
      Logger.log(`⚠️ ${currentTicker} 獲取失敗 (返回: ${displayValue || value})，嘗試下一個...`);
    }
  }

  Logger.log(`❌ 全部代碼嘗試失敗: ${ticker}`);
  return null;
}

/**
 * 測試單個 GOOGLEFINANCE 代碼
 * 
 * @param {Object} config - 測試配置
 * @param {string} attribute - 要測試的屬性（"price", "volume", "changepct" 等）
 * @returns {Object} 測試結果
 */
function testGoogleFinanceCode(config, attribute = "price") {
  const result = {
    name: config.name,
    code: config.code,
    type: config.type,
    attribute: attribute,
    success: false,
    value: null,
    error: null,
    data_source: null,
    timestamp: new Date()
  };
  
  try {
    // ⭐ V8.3 修正：price 和 volume 屬性都使用混合引擎 getSmartData（會自動嘗試 Google -> Stooq/Yahoo 救援）
    // 特別是日股的 volume，Google 失敗時也需要 Stooq 救援（Stooq 返回完整的 OHLCV 數據）
    if ((attribute === "price" || attribute === "volume") && typeof getSmartData === 'function') {
      // 判斷類型
      let dataType = "ETF";
      if (config.type === "CURRENCY") {
        dataType = "FOREX";
      } else if (config.type === "BOND" || config.type === "INDEX") {
        dataType = "INDEX";
      } else if (config.market) {
        dataType = "STOCK";
      }
      
      // 使用混合引擎（傳入 attribute 參數，支持 price 和 volume）
      const smartData = getSmartData(config.name, config.code, dataType, config.priceRange, attribute);
      
      // 根據 attribute 獲取對應的值（price 或 volume）
      // 優先使用動態屬性 [attribute]，如果沒有則使用 price/volume 字段
      const rawValue = smartData && (smartData[attribute] !== undefined ? smartData[attribute] : 
                                     (attribute === "price" ? smartData.price : smartData.volume));
      
      if (smartData && rawValue !== null && rawValue !== undefined && rawValue > 0) {
        // ⭐ V8.3 修正：getSmartData 已經處理了美債的除10邏輯（僅適用於 price）
        // 測試腳本中不應該再次除以 10（會變成除以 100）
        // 因此直接使用 rawValue，不需要檢查 config.divideBy10
        const finalValue = rawValue;
        
        // 合理性檢查（如果有 priceRange，且屬性是 price）
        if (attribute === "price" && config.priceRange) {
          if (finalValue < config.priceRange[0] || finalValue > config.priceRange[1]) {
            result.error = `價格 ${finalValue.toFixed(2)} 超出合理範圍 [${config.priceRange[0]}, ${config.priceRange[1]}]`;
            return result;
          }
        }
        
        // 成功
        result.success = true;
        result.value = finalValue;
        result.data_source = smartData.data_source || smartData.source || "UNKNOWN";
        
        Logger.log(`✅ ${config.name} (${config.code}) ${attribute} = ${result.value} (來源: ${result.data_source})`);
        return result;
      } else {
        result.error = "混合引擎返回錯誤或超時";
        return result;
      }
    } else {
      // 非 price 屬性（volume, changepct 等）或其他情況，使用原來的 fetchGoogleFinanceSafe
      // ⚠️ 注意：volume 等屬性不走混合引擎，因為救援機制主要針對價格
      const value = fetchGoogleFinanceSafe(config.code, attribute);
      
      if (value === null) {
        result.error = "GOOGLEFINANCE 返回錯誤或超時";
        // ⚠️ V8.3 修正：對於非 price 屬性（如 volume），如果 Google 失敗，直接返回失敗
        // 不觸發救援機制（因為 volume 等屬性通常不需要救援）
        return result;
      }
      
      // 合理性檢查（如果有 priceRange）
      if (config.priceRange && attribute === "price") {
        const finalValue = config.divideBy10 ? value / 10 : value;
        if (finalValue < config.priceRange[0] || finalValue > config.priceRange[1]) {
          result.error = `價格 ${finalValue.toFixed(2)} 超出合理範圍 [${config.priceRange[0]}, ${config.priceRange[1]}]`;
          return result;
        }
      }
      
      // 成功
      result.success = true;
      result.value = config.divideBy10 ? value / 10 : value;
      result.data_source = "GOOGLE_INTERNAL";
      
      Logger.log(`✅ ${config.name} (${config.code}) ${attribute} = ${result.value}`);
    }
    
  } catch (error) {
    result.error = error.message;
    Logger.log(`❌ ${config.name} (${config.code}) 測試失敗：${error.message}`);
  }
  
  return result;
}

/**
 * V8.1 核心工具：安全的 Google Finance 歷史數據讀取器（增強版）
 * 解決 Array 擴展與 #N/A 問題 + 加入備用代碼機制（自動嘗試無前綴版本）
 * 
 * @param {string} ticker - GOOGLEFINANCE 代碼（例如 "NYSE:TSM"）
 * @param {number} days - 要獲取的天數
 * @returns {Array|null} 二維陣列，失敗返回 null
 */
function fetchGoogleFinanceHistorySafe(ticker, days) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("SYS_G_HISTORY_PROXY");
  if (!sheet) {
    sheet = ss.insertSheet("SYS_G_HISTORY_PROXY");
    sheet.hideSheet();
  }

  // ⭐ V8.3 修正：美股歷史數據直接使用無前綴版本（從 log 已知 NYSE:TSM 失敗但 TSM 成功）
  // 避免浪費時間嘗試錯誤的代碼
  var tickersToTry = [];
  if (ticker.indexOf(":") > -1) {
    var parts = ticker.split(":");
    if (parts.length === 2) {
      // 美股：直接使用無前綴版本（例如：NYSE:TSM -> TSM, NASDAQ:NVDA -> NVDA）
      tickersToTry.push(parts[1]); // 優先使用無前綴版本
      // 不再嘗試帶前綴的版本（已知會失敗）
    } else {
      tickersToTry.push(ticker);
    }
  } else {
    tickersToTry.push(ticker);
  }

  // 設定日期範圍
  var endDate = new Date();
  var startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  
  var startStr = "DATE(" + startDate.getFullYear() + "," + (startDate.getMonth()+1) + "," + startDate.getDate() + ")";
  var endStr = "DATE(" + endDate.getFullYear() + "," + (endDate.getMonth()+1) + "," + endDate.getDate() + ")";

  // 嘗試每個代碼
  for (var t = 0; t < tickersToTry.length; t++) {
    var currentTicker = tickersToTry[t];
    
    // 強制清除整張表，避免殘留
    sheet.clear();
    SpreadsheetApp.flush();
    
    var formula = '=GOOGLEFINANCE("' + currentTicker + '", "all", ' + startStr + ', ' + endStr + ', "DAILY")';
    
    // 使用不同的起始行避免卡死 (例如 A1, A50, A100)
    var startRow = (t * 50) + 1;
    sheet.getRange(startRow, 1).setFormula(formula);
    SpreadsheetApp.flush();

    // 等待數據載入（最多 10 秒）
    for (var i = 0; i < 20; i++) {
      Utilities.sleep(500);
      
      // 檢查第二行是否有日期（表示數據已展開）
      var checkCell = sheet.getRange(startRow + 1, 1);
      var checkVal = checkCell.getValue();
      var checkDisplay = checkCell.getDisplayValue();
      
      if (checkDisplay === "#N/A" || checkDisplay === "Loading..." || checkDisplay === "#ERROR!") {
        // 繼續等待
        continue;
      }
      
      if (checkVal !== "" && checkVal !== null) {
        // 檢查數據是否已經展開
        var lastRow = sheet.getLastRow();
        if (lastRow > startRow) {
          // 抓取該區塊的數據（從 startRow 開始到 lastRow）
          var dataRange = sheet.getRange(startRow, 1, lastRow - startRow + 1, 6);
          var data = dataRange.getValues();
          
          // 簡單驗證：數據是否包含 "Date" 標題
          if (data.length > 0 && data[0] && data[0][0] === "Date") {
            // 計算有效數據行數（排除標題行）
            var dataCount = 0;
            for (var j = 1; j < data.length; j++) {
              if (data[j] && data[j].length > 0 && data[j][0] !== "" && data[j][0] !== "Date") {
                dataCount++;
              }
            }
            
            if (dataCount > 0) {
              Logger.log("✅ fetchGoogleFinanceHistorySafe: " + currentTicker + " 歷史數據，共 " + dataCount + " 筆");
              return data; // 回傳二維陣列
            }
          }
        }
      }
    }
    
    // ⭐ V8.3 修正：美股歷史數據已知無前綴版本會成功，如果失敗就直接返回（不再嘗試下一個）
    // 只有當 tickersToTry 有多個選項時才嘗試下一個
    if (tickersToTry.length > 1 && t < tickersToTry.length - 1) {
      Logger.log("⚠️ " + currentTicker + " 歷史數據獲取失敗，嘗試下一個代碼...");
    }
  }

  Logger.log("❌ fetchGoogleFinanceHistorySafe: " + ticker + " 歷史數據獲取失敗或超時");
  return null;
}

/**
 * 測試歷史數據獲取
 * 
 * @param {Object} config - 測試配置
 * @param {number} days - 要獲取的天數
 * @returns {Object} 測試結果
 */
function testGoogleFinanceHistory(config, days = 30) {
  const result = {
    name: config.name,
    code: config.code,
    type: config.type,
    days: days,
    success: false,
    dataCount: 0,
    historySheetLocation: null, // ⭐ V8.3 新增：記錄歷史數據存儲位置
    error: null,
    timestamp: new Date()
  };
  
  try {
    // 使用安全的歷史數據讀取函數
    // ⚠️ 注意：歷史數據實際存儲在隱藏的 SYS_G_HISTORY_PROXY sheet 中
    const data = fetchGoogleFinanceHistorySafe(config.code, days);
    
    if (data === null || data.length === 0) {
      result.error = "歷史數據獲取失敗或超時";
      return result;
    }
    
    // 計算有效數據行數（排除標題行）
    let dataCount = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i] && data[i].length > 0 && data[i][0] !== "" && data[i][0] !== "Date") {
        dataCount++;
      }
    }
    
    if (dataCount === 0) {
      result.error = "歷史數據中沒有有效數據行";
      return result;
    }
    
    result.success = true;
    result.dataCount = dataCount;
    result.historySheetLocation = "SYS_G_HISTORY_PROXY (隱藏表格，可在 Google Sheets 中取消隱藏查看)";
    
    Logger.log(`✅ ${config.name} (${config.code}) 歷史數據：${dataCount} 筆（存儲位置：SYS_G_HISTORY_PROXY）`);
    
  } catch (error) {
    result.error = error.message;
    Logger.log(`❌ ${config.name} (${config.code}) 歷史數據測試失敗：${error.message}`);
  }
  
  return result;
}

// ==========================================
// 批量測試函數
// ==========================================

/**
 * 測試所有宏觀數據（商品、匯率、國債、VIX）
 * 
 * @returns {Object} 測試結果摘要
 */
function testAllMacroData() {
  Logger.log("🧪 開始測試宏觀數據...");
  
  const results = {
    commodities: [],
    currencies: [],
    bonds: [],
    indices: [],
    summary: {
      total: 0,
      success: 0,
      failed: 0
    }
  };
  
  // 測試商品 ETF
  Logger.log("📊 測試商品 ETF...");
  for (const config of GOOGLEFINANCE_TEST_CONFIG.commodities) {
    const result = testGoogleFinanceCode(config, "price");
    results.commodities.push(result);
    results.summary.total++;
    if (result.success) results.summary.success++;
    else results.summary.failed++;
    Utilities.sleep(500); // 避免請求過快
  }
  
  // 測試匯率
  Logger.log("💱 測試匯率...");
  for (const config of GOOGLEFINANCE_TEST_CONFIG.currencies) {
    const result = testGoogleFinanceCode(config, "price");
    results.currencies.push(result);
    results.summary.total++;
    if (result.success) results.summary.success++;
    else results.summary.failed++;
    Utilities.sleep(500);
  }
  
  // 測試國債利率
  Logger.log("📈 測試國債利率...");
  for (const config of GOOGLEFINANCE_TEST_CONFIG.bonds) {
    const result = testGoogleFinanceCode(config, "price");
    results.bonds.push(result);
    results.summary.total++;
    if (result.success) results.summary.success++;
    else results.summary.failed++;
    Utilities.sleep(500);
  }
  
  // 測試市場指數
  Logger.log("📊 測試市場指數...");
  for (const config of GOOGLEFINANCE_TEST_CONFIG.indices) {
    const result = testGoogleFinanceCode(config, "price");
    results.indices.push(result);
    results.summary.total++;
    if (result.success) results.summary.success++;
    else results.summary.failed++;
    Utilities.sleep(500);
  }
  
  Logger.log(`✅ 宏觀數據測試完成：${results.summary.success}/${results.summary.total} 成功`);
  
  return results;
}

/**
 * 測試所有板塊 ETF
 * 
 * @returns {Object} 測試結果摘要
 */
function testAllSectorETFs() {
  Logger.log("🧪 開始測試板塊 ETF...");
  
  const results = {
    etfs: [],
    summary: {
      total: 0,
      success: 0,
      failed: 0
    }
  };
  
  for (const config of GOOGLEFINANCE_TEST_CONFIG.sectorETFs) {
    const result = testGoogleFinanceCode(config, "price");
    results.etfs.push(result);
    results.summary.total++;
    if (result.success) results.summary.success++;
    else results.summary.failed++;
    Utilities.sleep(500);
  }
  
  Logger.log(`✅ 板塊 ETF 測試完成：${results.summary.success}/${results.summary.total} 成功`);
  
  return results;
}

/**
 * 測試個股 OHLCV（當前價格和歷史數據）
 * 
 * @returns {Object} 測試結果摘要
 */
function testAllStockOHLCV() {
  Logger.log("🧪 開始測試個股 OHLCV...");
  
  const results = {
    stocks: [],
    history: [],
    summary: {
      total: 0,
      success: 0,
      failed: 0,
      historyTotal: 0,
      historySuccess: 0,
      historyFailed: 0
    }
  };
  
  // 測試當前價格
  for (const config of GOOGLEFINANCE_TEST_CONFIG.stocks) {
    // 測試 price（使用混合引擎，會自動處理救援）
    const priceResult = testGoogleFinanceCode(config, "price");
    results.stocks.push({
      ...priceResult,
      market: config.market
    });
    results.summary.total++;
    if (priceResult.success) results.summary.success++;
    else results.summary.failed++;
    
    Utilities.sleep(500);
    
    // 測試 volume（非 price 屬性，直接使用 fetchGoogleFinanceSafe，不走混合引擎）
    const volumeResult = testGoogleFinanceCode(config, "volume");
    results.stocks.push({
      ...volumeResult,
      attribute: "volume",
      market: config.market
    });
    results.summary.total++;
    if (volumeResult.success) results.summary.success++;
    else results.summary.failed++;
    
    Utilities.sleep(500);
    
    // 測試歷史數據（僅測試美股，因為台股和日股可能不支援）
    // ⭐ V8.3 修正：美股歷史數據直接使用無前綴版本，避免浪費時間
    if (config.market === "US") {
      const historyResult = testGoogleFinanceHistory(config, 30);
      results.history.push(historyResult);
      results.summary.historyTotal++;
      if (historyResult.success) results.summary.historySuccess++;
      else results.summary.historyFailed++;
      
      Utilities.sleep(1000);
    }
  }
  
  Logger.log(`✅ 個股 OHLCV 測試完成：${results.summary.success}/${results.summary.total} 成功，歷史數據：${results.summary.historySuccess}/${results.summary.historyTotal} 成功`);
  
  return results;
}

/**
 * 測試所有 GOOGLEFINANCE 數據源（完整測試）
 * 
 * @returns {Object} 完整測試結果
 */
function testAllGoogleFinance() {
  Logger.log("🚀 開始完整 GOOGLEFINANCE 測試...");
  
  const startTime = Date.now();
  
  const allResults = {
    macro: null,
    sectorETFs: null,
    stocks: null,
    summary: {
      total: 0,
      success: 0,
      failed: 0,
      duration: 0
    }
  };
  
  try {
    // 1. 測試宏觀數據
    allResults.macro = testAllMacroData();
    allResults.summary.total += allResults.macro.summary.total;
    allResults.summary.success += allResults.macro.summary.success;
    allResults.summary.failed += allResults.macro.summary.failed;
    
    // 2. 測試板塊 ETF
    allResults.sectorETFs = testAllSectorETFs();
    allResults.summary.total += allResults.sectorETFs.summary.total;
    allResults.summary.success += allResults.sectorETFs.summary.success;
    allResults.summary.failed += allResults.sectorETFs.summary.failed;
    
    // 3. 測試個股 OHLCV
    allResults.stocks = testAllStockOHLCV();
    allResults.summary.total += allResults.stocks.summary.total;
    allResults.summary.success += allResults.stocks.summary.success;
    allResults.summary.failed += allResults.stocks.summary.failed;
    
    allResults.summary.duration = Date.now() - startTime;
    
    // 保存測試結果到表格
    saveTestResults(allResults);
    
    Logger.log(`✅ 完整測試完成：${allResults.summary.success}/${allResults.summary.total} 成功，耗時 ${(allResults.summary.duration / 1000).toFixed(1)} 秒`);
    
  } catch (error) {
    Logger.log(`❌ 測試過程發生錯誤：${error.message}`);
    allResults.error = error.message;
  }
  
  return allResults;
}

// ==========================================
// 測試結果保存
// ==========================================

/**
 * 保存測試結果到表格
 * 
 * @param {Object} results - 測試結果
 */
function saveTestResults(results) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("GOOGLEFINANCE_TEST_RESULTS");
    
    if (!sheet) {
      sheet = ss.insertSheet("GOOGLEFINANCE_TEST_RESULTS");
      sheet.getRange(1, 1, 1, 9).setValues([[
        "測試時間", "類別", "名稱", "代碼", "屬性", "成功", "數值", "數據來源", "錯誤"
      ]]);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold");
    }
    
    const rows = [];
    const now = new Date();
    
    // 保存宏觀數據結果
    if (results.macro) {
      for (const item of results.macro.commodities) {
        rows.push([
          now,
          "商品ETF",
          item.name,
          item.code,
          item.attribute,
          item.success ? "✅" : "❌",
          item.value || "",
          item.data_source || "",
          item.error || ""
        ]);
      }
      for (const item of results.macro.currencies) {
        rows.push([
          now,
          "匯率",
          item.name,
          item.code,
          item.attribute,
          item.success ? "✅" : "❌",
          item.value || "",
          item.data_source || "",
          item.error || ""
        ]);
      }
      for (const item of results.macro.bonds) {
        rows.push([
          now,
          "國債",
          item.name,
          item.code,
          item.attribute,
          item.success ? "✅" : "❌",
          item.value || "",
          item.data_source || "",
          item.error || ""
        ]);
      }
      for (const item of results.macro.indices) {
        rows.push([
          now,
          "指數",
          item.name,
          item.code,
          item.attribute,
          item.success ? "✅" : "❌",
          item.value || "",
          item.data_source || "",
          item.error || ""
        ]);
      }
    }
    
    // 保存板塊 ETF 結果
    if (results.sectorETFs) {
      for (const item of results.sectorETFs.etfs) {
        rows.push([
          now,
          "板塊ETF",
          item.name,
          item.code,
          item.attribute,
          item.success ? "✅" : "❌",
          item.value || "",
          item.data_source || "",
          item.error || ""
        ]);
      }
    }
    
    // 保存個股結果
    if (results.stocks) {
      for (const item of results.stocks.stocks) {
        rows.push([
          now,
          "個股",
          item.name,
          item.code,
          item.attribute,
          item.success ? "✅" : "❌",
          item.value || "",
          item.data_source || "",
          item.error || ""
        ]);
      }
      for (const item of results.stocks.history) {
        rows.push([
          now,
          "歷史數據",
          item.name,
          item.code,
          `${item.days}天`,
          item.success ? "✅" : "❌",
          item.dataCount ? `${item.dataCount} 筆（存儲在 SYS_G_HISTORY_PROXY 隱藏表格）` : "",
          "", // 歷史數據沒有 data_source
          item.error || ""
        ]);
      }
    }
    
    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, 9).setValues(rows);
    }
    
    Logger.log(`✅ 測試結果已保存到 GOOGLEFINANCE_TEST_RESULTS 表格`);
    
  } catch (error) {
    Logger.log(`❌ 保存測試結果失敗：${error.message}`);
  }
}

// ==========================================
// V8.3 混合引擎測試（Fail Fast + Hybrid）
// ==========================================

/**
 * V8.3 混合引擎完整測試
 * 使用 getSmartData 測試 Google Finance -> Stooq/Yahoo 救援機制
 * 
 * @returns {Object} testResults - 測試結果
 */
function testGoogleFinanceFull() {
  Logger.log("🚀 開始 V8.3 完整混合引擎測試 (Google + Stooq/Yahoo Rescue)...");
  Logger.log("================================================");
  const startTime = Date.now();
  
  // --- 測試清單：包含 Google 必死項目 (匯率/日股) 和 Google 必活項目 (美股/債券) ---
  const testItems = [
    // --- 1. 預期走 Google (速度快) ---
    { name: "WTI原油", google: "NYSEARCA:USO", type: "ETF", priceRange: [20, 200] },
    { name: "10年美債", google: "INDEXCBOE:TNX", type: "INDEX", priceRange: [0, 20] },
    { name: "NVDA", google: "NASDAQ:NVDA", type: "STOCK", priceRange: [50, 1000] },
    
    // --- 2. 預期走 Stooq 救援 (Google 目前全滅 - 週末效應) ---
    { name: "歐元/美元", google: "CURRENCY:EURUSD", type: "FOREX", priceRange: [0.8, 1.5] },
    { name: "英鎊/美元", google: "CURRENCY:GBPUSD", type: "FOREX", priceRange: [1.0, 2.0] },
    { name: "美元/日圓", google: "CURRENCY:USDJPY", type: "FOREX", priceRange: [80, 200] },
    
    // --- 3. 預期走 CSE 救援 (Google 可能抓到錯誤市場) ---
    { name: "8035", google: "TYO:8035", type: "STOCK", priceRange: [1000, 50000] } // 日股
  ];
  
  const results = {
    items: [],
    summary: {
      total: testItems.length,
      success: 0,
      failed: 0,
      google: 0,
      rescue: 0,
      duration: 0
    }
  };
  
  for (let i = 0; i < testItems.length; i++) {
    const item = testItems[i];
    Logger.log("------------------------------------------------");
    Logger.log(`🧪 測試項目 ${i + 1}/${testItems.length}: ${item.name} (${item.google})`);
    
    try {
      // ⚠️ 關鍵：呼叫 getSmartData 指揮官，而不是 fetchGoogleFinanceSafe
      // 這會自動嘗試 Google -> Stooq/Yahoo 救援
      const result = getSmartData(item.name, item.google, item.type, item.priceRange);
      
      if (result && result.price) {
        results.summary.success++;
        const source = result.data_source || result.source || "UNKNOWN";
        
        if (source === "GOOGLE_INTERNAL") {
          results.summary.google++;
        } else {
          results.summary.rescue++;
        }
        
        results.items.push({
          name: item.name,
          google: item.google,
          type: item.type,
          success: true,
          price: result.price,
          source: source,
          change: result.change || 0,
          change_pct: result.change_pct || 0
        });
        
        Logger.log(`🎉 最終結果: ${item.name} = ${result.price} (來源: ${source})`);
      } else {
        results.summary.failed++;
        results.items.push({
          name: item.name,
          google: item.google,
          type: item.type,
          success: false,
          price: null,
          source: null,
          error: "全部失敗 (Google & 救援機制)"
        });
        
        Logger.log(`💀 最終失敗: ${item.name} - 全部失敗 (Google & 救援機制)`);
      }
    } catch (error) {
      results.summary.failed++;
      results.items.push({
        name: item.name,
        google: item.google,
        type: item.type,
        success: false,
        price: null,
        source: null,
        error: error.message
      });
      
      Logger.log(`💀 最終失敗: ${item.name} - 發生錯誤: ${error.message}`);
    }
    
    // 避免過度頻繁請求
    Utilities.sleep(1000);
  }
  
  results.summary.duration = Date.now() - startTime;
  
  // 輸出總結
  Logger.log("================================================");
  Logger.log(`✅ V8.3 混合引擎測試結束`);
  Logger.log(`📊 總結：`);
  Logger.log(`   - 總數：${results.summary.total}`);
  Logger.log(`   - 成功：${results.summary.success} (${((results.summary.success / results.summary.total) * 100).toFixed(1)}%)`);
  Logger.log(`   - 失敗：${results.summary.failed}`);
  Logger.log(`   - Google 成功：${results.summary.google}`);
  Logger.log(`   - 救援成功：${results.summary.rescue}`);
  Logger.log(`   - 耗時：${(results.summary.duration / 1000).toFixed(1)} 秒`);
  Logger.log("================================================");
  
  return results;
}

// ==========================================
// UI 選單函數
// ==========================================

/**
 * UI 選單：測試 V8.3 混合引擎（Fail Fast + Hybrid）
 */
function menuTestV8_3HybridEngine() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    '測試 V8.3 混合引擎',
    '這將測試 V8.3 混合引擎（Google Finance + Stooq/Yahoo 救援）。\n\n測試項目：\n- 商品 ETF（1個）\n- 指數（1個）\n- 個股（1個）\n- 匯率（2個，預期走 Stooq 救援）\n- 日股（1個，預期走 CSE 救援）\n\n⚠️ V8.3 Fail Fast：Google Finance 等待時間縮短至 4 秒\n\n預計耗時：約 30-60 秒\n\n是否開始測試？',
    ui.ButtonSet.YES_NO
  );
  
  if (response == ui.Button.YES) {
    try {
      // 執行 V8.3 混合引擎測試
      const results = testGoogleFinanceFull();
      
      // 顯示結果摘要
      const message = `V8.3 混合引擎測試完成！\n\n` +
        `總數：${results.summary.total}\n` +
        `成功：${results.summary.success} (${((results.summary.success / results.summary.total) * 100).toFixed(1)}%)\n` +
        `失敗：${results.summary.failed}\n` +
        `Google 成功：${results.summary.google}\n` +
        `救援成功：${results.summary.rescue}\n` +
        `耗時：${(results.summary.duration / 1000).toFixed(1)} 秒\n\n` +
        `詳細結果請查看 Logger。`;
      
      ui.alert('測試完成', message, ui.ButtonSet.OK);
      
    } catch (error) {
      Logger.log(`❌ V8.3 混合引擎測試失敗：${error.message}`);
      ui.alert('測試失敗', `發生錯誤：${error.message}`, ui.ButtonSet.OK);
    }
  }
}

/**
 * UI 選單：測試 GOOGLEFINANCE（顯示結果）
 * ⭐ V8.3 更新：現在使用混合引擎（Google + Stooq/Yahoo 救援）
 */
function menuTestGoogleFinance() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    '測試 GOOGLEFINANCE 數據源 (V8.3 混合引擎)',
    '這將測試所有 Gemini 建議的 GOOGLEFINANCE 代碼。\n\n⭐ V8.3 混合引擎：\n- Google Finance 優先（4秒 Fail Fast）\n- 失敗自動切換到 Stooq/Yahoo 救援\n\n測試項目：\n- 商品 ETF（5個）\n- 匯率（6個，預期走 Stooq 救援）\n- 國債利率（4個）\n- VIX（1個）\n- 板塊 ETF（11個）\n- 個股 OHLCV（4個）\n\n預計耗時：約 30-60 秒（V8.3 Fail Fast）\n\n是否開始測試？',
    ui.ButtonSet.YES_NO
  );
  
  if (response == ui.Button.YES) {
    try {
      // ⚠️ 注意：showModalDialog 顯示的對話框無法通過程式碼關閉，只能由用戶手動關閉
      // 因此不顯示進度對話框，直接執行測試
      // 測試進度可以通過 Logger 查看
      
      // 執行測試（現在使用混合引擎）
      const results = testAllGoogleFinance();
      
      // 顯示結果
      const successRate = results.summary.total > 0 ? 
        (results.summary.success / results.summary.total * 100).toFixed(1) : 0;
      
      let message = `測試完成！\n\n`;
      message += `總計：${results.summary.total} 項\n`;
      message += `成功：${results.summary.success} 項\n`;
      message += `失敗：${results.summary.failed} 項\n`;
      message += `成功率：${successRate}%\n`;
      message += `耗時：${(results.summary.duration / 1000).toFixed(1)} 秒\n\n`;
      
      if (results.stocks && results.stocks.summary.historyTotal > 0) {
        message += `歷史數據測試：\n`;
        message += `成功：${results.stocks.summary.historySuccess}/${results.stocks.summary.historyTotal}\n\n`;
      }
      
      message += `詳細結果已保存到「GOOGLEFINANCE_TEST_RESULTS」表格。\n\n`;
      
      if (results.summary.failed === 0) {
        message += `✅ 所有測試通過！可以切換到 GOOGLEFINANCE。`;
      } else {
        message += `⚠️ 有 ${results.summary.failed} 項測試失敗，請檢查詳細結果。`;
      }
      
      ui.alert('測試結果', message, ui.ButtonSet.OK);
      
      // 打開測試結果表格
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName("GOOGLEFINANCE_TEST_RESULTS");
      if (sheet) {
        ss.setActiveSheet(sheet);
      }
      
    } catch (error) {
      ui.alert('測試失敗', `發生錯誤：${error.message}\n\n請查看日誌了解詳情。`, ui.ButtonSet.OK);
    }
  }
}
