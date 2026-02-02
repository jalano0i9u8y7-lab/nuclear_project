/**
 * 📊 P5 Daily: 台股掛單監控
 * 
 * 檢查台股掛單是否已觸發
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

/**
 * 檢查台股掛單
 * 
 * @param {Array} tickers - 股票代碼列表
 * @returns {Object} result - 檢查結果
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
    const currentPrices = [];
    
    for (const ticker of taiwanTickers) {
      const currentPrice = getCurrentPrice(ticker);
      if (!currentPrice) {
        Logger.log(`P5 Daily：無法獲取 ${ticker} 當前價格，跳過掛單檢查`);
        continue;
      }
      currentPrices.push({ ticker: ticker, price: currentPrice });
    }
    
    // 調用台股掛單監控函數檢查（一次性檢查所有掛單）
    let triggeredOrders = [];
    try {
      if (currentPrices.length > 0) {
        triggeredOrders = checkTaiwanOrderMonitor(currentPrices);
        if (triggeredOrders && triggeredOrders.length > 0) {
          Logger.log(`P5 Daily：共有 ${triggeredOrders.length} 筆台股掛單已觸發`);
        }
      }
    } catch (error) {
      Logger.log(`P5 Daily：檢查台股掛單失敗：${error.message}`);
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
