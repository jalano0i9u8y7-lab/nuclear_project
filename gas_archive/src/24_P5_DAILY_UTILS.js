/**
 * 📊 P5 Daily: 輔助函數
 * 
 * 通用輔助函數（判斷是否台股、獲取當前價格等）
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

/**
 * 判斷是否為台灣股票
 * 
 * @param {string} ticker - 股票代碼
 * @returns {boolean} 是否為台股
 */
function isTaiwanStock(ticker) {
  // 台灣股票代碼通常是 4 位數字，或包含 .tw（小寫）
  return /^\d{4}$/.test(ticker) || ticker.toLowerCase().includes(".tw");
}

/**
 * 獲取當前價格
 * 
 * @param {string} ticker - 股票代碼
 * @returns {number|null} 當前價格（收盤價）
 */
function getCurrentPrice(ticker) {
  // 從 OHLCV 數據獲取最新收盤價
  const historicalData = getHistoricalOHLCV(ticker, 1);
  if (historicalData && historicalData.length > 0) {
    return historicalData[0].close;
  }
  return null;
}

/**
 * 獲取持倉股票列表
 * 
 * @returns {Array} tickers - 股票代碼列表
 */
function getHoldingsTickers() {
  try {
    // 從 HOLDINGS 表格讀取
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("HOLDINGS");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Daily：HOLDINGS 表格不存在或為空，返回空列表");
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    if (tickerCol === -1) {
      Logger.log("P5 Daily：HOLDINGS 表格沒有 ticker 欄位");
      return [];
    }
    
    const tickers = [];
    for (let i = 1; i < rows.length; i++) {
      const ticker = rows[i][tickerCol];
      if (ticker && ticker.trim()) {
        tickers.push(ticker.trim());
      }
    }
    
    Logger.log(`P5 Daily：從 HOLDINGS 讀取到 ${tickers.length} 檔股票`);
    return tickers;
    
  } catch (error) {
    Logger.log(`P5 Daily：獲取持倉股票列表失敗：${error.message}`);
    return [];
  }
}
