/**
 * 📊 P6: 盤中監測數據收集器
 * 
 * ⭐ V8.0 新增：使用 GOOGLEFINANCE 收集盤中數據
 * 
 * @version V8.0
 * @date 2026-01-17
 */

// ==========================================
// P6 監控對象配置
// ==========================================

const P6_MONITOR_CONFIG = {
  // 主要指數
  majorIndices: {
    "US": [
      { name: "S&P 500", ticker: "INDEXSP:.INX", googleTicker: "INDEXSP:.INX" },
      { name: "NASDAQ", ticker: "INDEXNASDAQ:.IXIC", googleTicker: "INDEXNASDAQ:.IXIC" },
      { name: "道瓊", ticker: "INDEXDJX:.DJI", googleTicker: "INDEXDJX:.DJI" }
    ],
    "TW": [
      { name: "台股加權", ticker: "^TWII", googleTicker: "TPE:^TWII" }
    ],
    "JP": [
      { name: "日經225", ticker: "^N225", googleTicker: "TYO:^N225" }
    ]
  },
  
  // 板塊 ETF
  sectorETFs: [
    { name: "XLK (科技)", ticker: "XLK", googleTicker: "NYSEARCA:XLK" },
    { name: "XLF (金融)", ticker: "XLF", googleTicker: "NYSEARCA:XLF" },
    { name: "XLE (能源)", ticker: "XLE", googleTicker: "NYSEARCA:XLE" },
    { name: "XLV (醫療)", ticker: "XLV", googleTicker: "NYSEARCA:XLV" },
    { name: "XLI (工業)", ticker: "XLI", googleTicker: "NYSEARCA:XLI" },
    { name: "XLP (必需消費)", ticker: "XLP", googleTicker: "NYSEARCA:XLP" },
    { name: "XLY (非必需消費)", ticker: "XLY", googleTicker: "NYSEARCA:XLY" },
    { name: "XLU (公用事業)", ticker: "XLU", googleTicker: "NYSEARCA:XLU" },
    { name: "XLB (原物料)", ticker: "XLB", googleTicker: "NYSEARCA:XLB" },
    { name: "XLRE (房地產)", ticker: "XLRE", googleTicker: "NYSEARCA:XLRE" },
    { name: "XLC (通訊服務)", ticker: "XLC", googleTicker: "NYSEARCA:XLC" }
  ]
};

// ==========================================
// P6 數據收集函數
// ==========================================

/**
 * 收集盤中數據（主入口函數）
 * ⭐ V8.0 優化：優先使用批量讀取，提高效率和可靠性
 * 
 * @returns {Object} intradayData - 盤中數據
 */
function collectIntradayData() {
  const intradayData = {
    positions: [],
    optionStocks: [],
    majorIndices: [],
    sectorETFs: [],
    trackingPool: [],
    timestamp: new Date()
  };
  
  try {
    // ⭐ V8.0 優化：使用批量讀取收集所有數據（一次性批量讀取，避免污染）
    const allTickers = [];
    
    // 1. 收集持倉股票 ticker 列表
    const positionTickers = collectPositionTickerList();
    for (const pos of positionTickers) {
      allTickers.push({
        ticker: pos.ticker,
        market: pos.market,
        googleTicker: pos.googleTicker || convertTickerToGoogleFinance(pos.ticker, pos.market),
        type: "POSITION"
      });
    }
    
    // 2. 收集選擇權個股 ticker 列表
    const optionTickers = collectOptionStockTickerList();
    for (const opt of optionTickers) {
      allTickers.push({
        ticker: opt.ticker,
        market: opt.market,
        googleTicker: opt.googleTicker || convertTickerToGoogleFinance(opt.ticker, opt.market),
        type: "OPTION"
      });
    }
    
    // 3. 收集主要指數 ticker 列表
    const indexTickers = collectMajorIndicesTickerList();
    for (const idx of indexTickers) {
      allTickers.push({
        ticker: idx.ticker,
        market: idx.market,
        googleTicker: idx.googleTicker,
        type: "INDEX"
      });
    }
    
    // 4. 收集板塊 ETF ticker 列表
    const etfTickers = collectSectorETFTickerList();
    for (const etf of etfTickers) {
      allTickers.push({
        ticker: etf.ticker,
        market: "US",
        googleTicker: etf.googleTicker,
        type: "ETF"
      });
    }
    
    // 5. 收集追蹤池股票 ticker 列表
    const trackingTickers = collectTrackingPoolTickerList();
    for (const trk of trackingTickers) {
      allTickers.push({
        ticker: trk.ticker,
        market: trk.market,
        googleTicker: trk.googleTicker || convertTickerToGoogleFinance(trk.ticker, trk.market),
        type: "TRACKING"
      });
    }
    
    // 批量讀取所有數據（一次性批量讀取，避免污染和效率問題）
    Logger.log(`P6：準備批量讀取 ${allTickers.length} 個 ticker 的數據`);
    const batchData = batchFetchIntradayPriceData(allTickers);
    
    // 分類整理數據
    for (const item of allTickers) {
      const data = batchData[item.ticker];
      if (!data || data.status !== "SUCCESS") {
        continue;
      }
      
      if (item.type === "POSITION") {
        intradayData.positions.push({
          ticker: item.ticker,
          market: item.market,
          price: data.price,
          change_pct: data.change_pct,
          volume: data.volume,
          priceOpen: data.priceOpen,
          timestamp: new Date()
        });
      } else if (item.type === "OPTION") {
        intradayData.optionStocks.push({
          ticker: item.ticker,
          market: item.market,
          price: data.price,
          change_pct: data.change_pct,
          volume: data.volume,
          timestamp: new Date()
        });
      } else if (item.type === "INDEX") {
        const indexInfo = indexTickers.find(idx => idx.ticker === item.ticker);
        intradayData.majorIndices.push({
          name: indexInfo ? indexInfo.name : item.ticker,
          ticker: item.ticker,
          market: item.market,
          price: data.price,
          change_pct: data.change_pct,
          timestamp: new Date()
        });
      } else if (item.type === "ETF") {
        const etfInfo = etfTickers.find(etf => etf.ticker === item.ticker);
        intradayData.sectorETFs.push({
          name: etfInfo ? etfInfo.name : item.ticker,
          ticker: item.ticker,
          price: data.price,
          change_pct: data.change_pct,
          volume: data.volume,
          timestamp: new Date()
        });
      } else if (item.type === "TRACKING") {
        intradayData.trackingPool.push({
          ticker: item.ticker,
          market: item.market,
          price: data.price,
          change_pct: data.change_pct,
          volume: data.volume,
          timestamp: new Date()
        });
      }
    }
    
    Logger.log(`P6：成功收集盤中數據：持倉 ${intradayData.positions.length} 檔，選擇權 ${intradayData.optionStocks.length} 檔，指數 ${intradayData.majorIndices.length} 個，ETF ${intradayData.sectorETFs.length} 個，追蹤池 ${intradayData.trackingPool.length} 檔`);
    
  } catch (error) {
    Logger.log(`P6：收集盤中數據失敗：${error.message}`);
  }
  
  return intradayData;
}

/**
 * 收集持倉股票 ticker 列表（不讀取數據，只收集 ticker）
 * 
 * @returns {Array} tickerList - ticker 列表
 */
function collectPositionTickerList() {
  const tickerList = [];
  
  try {
    const p4Snapshot = getLatestP4Snapshot();
    if (!p4Snapshot || !p4Snapshot.allocations) {
      return tickerList;
    }
    
    const allocations = typeof p4Snapshot.allocations === 'string'
      ? JSON.parse(p4Snapshot.allocations)
      : p4Snapshot.allocations;
    
    for (const allocation of allocations) {
      if (allocation.ticker && allocation.market) {
        tickerList.push({
          ticker: allocation.ticker,
          market: allocation.market,
          name: allocation.name || allocation.ticker
        });
      }
    }
    
  } catch (error) {
    Logger.log(`P6：收集持倉 ticker 列表失敗：${error.message}`);
  }
  
  return tickerList;
}

/**
 * 收集選擇權個股 ticker 列表
 * 
 * @returns {Array} tickerList - ticker 列表
 */
function collectOptionStockTickerList() {
  const tickerList = [];
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const derivativesSheet = ss.getSheetByName("DERIVATIVES_DAILY");
    
    if (!derivativesSheet || derivativesSheet.getLastRow() <= 1) {
      return tickerList;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const p4Snapshot = getLatestP4Snapshot();
    const holdings = new Set();
    if (p4Snapshot && p4Snapshot.allocations) {
      const allocations = typeof p4Snapshot.allocations === 'string'
        ? JSON.parse(p4Snapshot.allocations)
        : p4Snapshot.allocations;
      for (const alloc of allocations) {
        if (alloc.ticker) {
          holdings.add(alloc.ticker);
        }
      }
    }
    
    const dataRange = derivativesSheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    
    if (dateCol === -1 || tickerCol === -1) {
      return tickerList;
    }
    
    const optionTickers = new Set();
    for (let i = 1; i < rows.length; i++) {
      const rowDate = rows[i][dateCol];
      if (rowDate instanceof Date && rowDate.getTime() === today.getTime()) {
        const ticker = rows[i][tickerCol];
        if (ticker && holdings.has(ticker)) {
          optionTickers.add(ticker);
        }
      }
    }
    
    for (const ticker of optionTickers) {
      tickerList.push({
        ticker: ticker,
        market: guessMarketFromTicker(ticker)
      });
    }
    
  } catch (error) {
    Logger.log(`P6：收集選擇權 ticker 列表失敗：${error.message}`);
  }
  
  return tickerList;
}

/**
 * 收集主要指數 ticker 列表
 * 
 * @returns {Array} tickerList - ticker 列表
 */
function collectMajorIndicesTickerList() {
  const tickerList = [];
  
  try {
    for (const market in P6_MONITOR_CONFIG.majorIndices) {
      const indices = P6_MONITOR_CONFIG.majorIndices[market];
      for (const index of indices) {
        tickerList.push({
          ticker: index.ticker,
          name: index.name,
          market: market,
          googleTicker: index.googleTicker
        });
      }
    }
  } catch (error) {
    Logger.log(`P6：收集指數 ticker 列表失敗：${error.message}`);
  }
  
  return tickerList;
}

/**
 * 收集板塊 ETF ticker 列表
 * 
 * @returns {Array} tickerList - ticker 列表
 */
function collectSectorETFTickerList() {
  const tickerList = [];
  
  try {
    for (const etf of P6_MONITOR_CONFIG.sectorETFs) {
      tickerList.push({
        ticker: etf.ticker,
        name: etf.name,
        googleTicker: etf.googleTicker
      });
    }
  } catch (error) {
    Logger.log(`P6：收集 ETF ticker 列表失敗：${error.message}`);
  }
  
  return tickerList;
}

/**
 * 收集追蹤池股票 ticker 列表
 * 
 * @returns {Array} tickerList - ticker 列表
 */
function collectTrackingPoolTickerList() {
  const tickerList = [];
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Tracking_Pool");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return tickerList;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const codeCol = headers.indexOf("Company_Code");
    const marketCol = headers.indexOf("Market");
    
    if (codeCol === -1 || marketCol === -1) {
      return tickerList;
    }
    
    for (let i = 1; i < rows.length; i++) {
      const ticker = rows[i][codeCol];
      const market = rows[i][marketCol];
      
      if (ticker && market) {
        tickerList.push({
          ticker: ticker,
          market: market
        });
      }
    }
    
  } catch (error) {
    Logger.log(`P6：收集追蹤池 ticker 列表失敗：${error.message}`);
  }
  
  return tickerList;
}

/**
 * 收集持倉股票數據
 * 
 * @returns {Array} positionData - 持倉股票數據
 */
function collectPositionData() {
  const positionData = [];
  
  try {
    // 從 P4 最新快照讀取持倉
    const p4Snapshot = getLatestP4Snapshot();
    if (!p4Snapshot || !p4Snapshot.allocations) {
      Logger.log(`P6：無法獲取 P4 快照，跳過持倉數據收集`);
      return positionData;
    }
    
    const allocations = p4Snapshot.allocations;
    if (typeof allocations === 'string') {
      allocations = JSON.parse(allocations);
    }
    
    for (const allocation of allocations) {
      if (!allocation.ticker || !allocation.market) {
        continue;
      }
      
      // 使用 GOOGLEFINANCE 獲取數據
      const data = fetchIntradayPriceData(allocation.ticker, allocation.market);
      if (data) {
        positionData.push({
          ticker: allocation.ticker,
          name: allocation.name || allocation.ticker,
          market: allocation.market,
          allocation_pct: allocation.allocation_pct || 0,
          price: data.price,
          change_pct: data.change_pct,
          volume: data.volume,
          timestamp: new Date()
        });
      }
      
      // 避免請求過快
      Utilities.sleep(200);
    }
    
  } catch (error) {
    Logger.log(`P6：收集持倉股票數據失敗：${error.message}`);
  }
  
  return positionData;
}

/**
 * 收集選擇權個股數據（僅已持有的）
 * 
 * @returns {Array} optionStockData - 選擇權個股數據
 */
function collectOptionStockData() {
  const optionStockData = [];
  
  try {
    // 從 DERIVATIVES_DAILY 表格讀取有期權數據的個股
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const derivativesSheet = ss.getSheetByName("DERIVATIVES_DAILY");
    
    if (!derivativesSheet || derivativesSheet.getLastRow() <= 1) {
      Logger.log(`P6：DERIVATIVES_DAILY 表格無數據，跳過選擇權個股數據收集`);
      return optionStockData;
    }
    
    // 獲取今天的數據
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dataRange = derivativesSheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    
    if (dateCol === -1 || tickerCol === -1) {
      Logger.log(`P6：DERIVATIVES_DAILY 表格格式不正確`);
      return optionStockData;
    }
    
    // 收集今天有期權數據的個股（且必須是已持有的）
    const p4Snapshot = getLatestP4Snapshot();
    const holdings = new Set();
    if (p4Snapshot && p4Snapshot.allocations) {
      const allocations = typeof p4Snapshot.allocations === 'string' 
        ? JSON.parse(p4Snapshot.allocations) 
        : p4Snapshot.allocations;
      for (const alloc of allocations) {
        if (alloc.ticker) {
          holdings.add(alloc.ticker);
        }
      }
    }
    
    const optionTickers = new Set();
    for (let i = 1; i < rows.length; i++) {
      const rowDate = rows[i][dateCol];
      if (rowDate instanceof Date && rowDate.getTime() === today.getTime()) {
        const ticker = rows[i][tickerCol];
        if (ticker && holdings.has(ticker)) {
          optionTickers.add(ticker);
        }
      }
    }
    
    // 收集這些個股的盤中數據
    for (const ticker of optionTickers) {
      // 判斷市場（簡化處理）
      const market = guessMarketFromTicker(ticker);
      
      const data = fetchIntradayPriceData(ticker, market);
      if (data) {
        optionStockData.push({
          ticker: ticker,
          market: market,
          price: data.price,
          change_pct: data.change_pct,
          volume: data.volume,
          timestamp: new Date()
        });
      }
      
      Utilities.sleep(200);
    }
    
  } catch (error) {
    Logger.log(`P6：收集選擇權個股數據失敗：${error.message}`);
  }
  
  return optionStockData;
}

/**
 * 收集主要指數數據
 * 
 * @returns {Array} indicesData - 主要指數數據
 */
function collectMajorIndicesData() {
  const indicesData = [];
  
  try {
    // 收集所有市場的主要指數
    for (const market in P6_MONITOR_CONFIG.majorIndices) {
      const indices = P6_MONITOR_CONFIG.majorIndices[market];
      
      for (const index of indices) {
        const data = fetchIntradayPriceData(index.googleTicker, market, true); // true 表示是指數
        if (data) {
          indicesData.push({
            name: index.name,
            ticker: index.ticker,
            market: market,
            price: data.price,
            change_pct: data.change_pct,
            timestamp: new Date()
          });
        }
        
        Utilities.sleep(200);
      }
    }
    
  } catch (error) {
    Logger.log(`P6：收集主要指數數據失敗：${error.message}`);
  }
  
  return indicesData;
}

/**
 * 收集板塊 ETF 數據
 * 
 * @returns {Array} etfData - 板塊 ETF 數據
 */
function collectSectorETFData() {
  const etfData = [];
  
  try {
    for (const etf of P6_MONITOR_CONFIG.sectorETFs) {
      const data = fetchIntradayPriceData(etf.googleTicker, "US", true); // ETF 視為指數類型
      if (data) {
        etfData.push({
          name: etf.name,
          ticker: etf.ticker,
          price: data.price,
          change_pct: data.change_pct,
          volume: data.volume,
          timestamp: new Date()
        });
      }
      
      Utilities.sleep(200);
    }
    
  } catch (error) {
    Logger.log(`P6：收集板塊 ETF 數據失敗：${error.message}`);
  }
  
  return etfData;
}

/**
 * 收集追蹤池股票數據
 * 
 * @returns {Array} trackingData - 追蹤池股票數據
 */
function collectTrackingPoolData() {
  const trackingData = [];
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Tracking_Pool");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log(`P6：Phase1_Tracking_Pool 表格無數據，跳過追蹤池數據收集`);
      return trackingData;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const codeCol = headers.indexOf("Company_Code");
    const marketCol = headers.indexOf("Market");
    
    if (codeCol === -1 || marketCol === -1) {
      Logger.log(`P6：Phase1_Tracking_Pool 表格格式不正確`);
      return trackingData;
    }
    
    // 收集追蹤池股票的盤中數據
    for (let i = 1; i < rows.length; i++) {
      const ticker = rows[i][codeCol];
      const market = rows[i][marketCol];
      
      if (!ticker || !market) {
        continue;
      }
      
      const data = fetchIntradayPriceData(ticker, market);
      if (data) {
        trackingData.push({
          ticker: ticker,
          market: market,
          price: data.price,
          change_pct: data.change_pct,
          volume: data.volume,
          timestamp: new Date()
        });
      }
      
      Utilities.sleep(200);
    }
    
  } catch (error) {
    Logger.log(`P6：收集追蹤池股票數據失敗：${error.message}`);
  }
  
  return trackingData;
}

/**
 * 獲取單個標的的盤中價格數據（使用 GOOGLEFINANCE）
 * 
 * @param {string} ticker - 股票代碼或 GOOGLEFINANCE 代碼
 * @param {string} market - 市場（"US", "TW", "JP"）
 * @param {boolean} isIndex - 是否為指數（預設 false）
 * @returns {Object|null} priceData - 價格數據
 */
function fetchIntradayPriceData(ticker, market, isIndex = false) {
  try {
    // 檢查 fetchGoogleFinanceSafe 函數是否存在
    if (typeof fetchGoogleFinanceSafe !== 'function') {
      Logger.log(`P6：⚠️ fetchGoogleFinanceSafe 函數不存在，無法使用 GOOGLEFINANCE`);
      return null;
    }
    
    // 轉換為 GOOGLEFINANCE 格式
    let googleTicker = ticker;
    if (!isIndex) {
      // 如果不是指數，需要轉換格式
      googleTicker = convertTickerToGoogleFinance(ticker, market);
      if (!googleTicker) {
        Logger.log(`P6：${ticker} (${market}) 無法轉換為 GOOGLEFINANCE 格式`);
        return null;
      }
    }
    
    // 獲取價格和變化
    const price = fetchGoogleFinanceSafe(googleTicker, "price");
    const priceOpen = fetchGoogleFinanceSafe(googleTicker, "priceopen");
    const volume = fetchGoogleFinanceSafe(googleTicker, "volume");
    
    if (price === null || priceOpen === null) {
      Logger.log(`P6：${ticker} GOOGLEFINANCE 獲取失敗`);
      return null;
    }
    
    // 計算變化百分比
    const change = price - priceOpen;
    const change_pct = priceOpen !== 0 ? (change / priceOpen) * 100 : 0;
    
    return {
      price: price,
      priceOpen: priceOpen,
      change: change,
      change_pct: change_pct,
      volume: volume || 0
    };
    
  } catch (error) {
    Logger.log(`P6：獲取 ${ticker} 盤中價格數據失敗：${error.message}`);
    return null;
  }
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
  
  // 預設為美股
  return "US";
}
