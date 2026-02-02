/**
 * 📊 P5 Daily: 板塊 ETF 數據收集
 * 
 * 收集標準美股板塊 ETF 數據（SPDR Sector ETFs）
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

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
