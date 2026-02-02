/**
 * 📊 P5 Weekly: 技術指標完整計算（每週）
 * 
 * ⭐ V8.0 新增：每週完整計算技術指標
 * - MACD（需要至少 26 天）
 * - RSI（需要至少 15 天）
 * - Bollinger Bands（需要至少 20 天）
 * 
 * 由 P5 Weekly 觸發，更新 MARKET_INDICATORS_DAILY 表格
 * 
 * @version SSOT V8.0
 * @date 2025-01-14
 */

// ==========================================
// P5 Weekly 技術指標完整計算
// ==========================================

/**
 * 計算完整技術指標（每週）
 * 
 * @param {Array} tickers - 股票代碼列表
 * @returns {Object} indicatorsData - 完整技術指標數據
 */
function calculateFullTechnicalIndicatorsWeekly(tickers) {
  const indicatorsData = {};
  
  Logger.log(`P5 Weekly：開始計算完整技術指標（${tickers.length} 檔）`);
  
  for (const ticker of tickers) {
    try {
      // 從 MARKET_OHLCV_DAILY 讀取歷史數據（如果不足，會自動從 stooq.com 補充）
      const historicalData = getHistoricalOHLCV(ticker, 240, true);  // 獲取 240 天數據
      
      // 檢查數據充足性（至少需要 26 天用於 MACD）
      if (!historicalData || historicalData.length < 26) {
        Logger.log(`P5 Weekly：${ticker} 歷史數據不足（${historicalData ? historicalData.length : 0}/26），跳過完整技術指標計算`);
        indicatorsData[ticker] = {
          ticker: ticker,
          error: `歷史數據不足（需要至少 26 天，目前 ${historicalData ? historicalData.length : 0} 天）`,
          status: "INSUFFICIENT_DATA"
        };
        continue;
      }
      
      // 計算完整技術指標
      const indicators = {
        ticker: ticker,
        date: new Date(),
        calculation_type: "WEEKLY_FULL"  // ⭐ V8.0：標記為每週完整計算
      };
      
      // 1. RSI（需要至少 15 天）
      if (historicalData.length >= 15) {
        indicators.rsi_14 = calculateRSI(historicalData, 14);
      }
      
      // 2. MACD（需要至少 26 天）
      if (historicalData.length >= 26) {
        indicators.macd = calculateMACD(historicalData);
      }
      
      // 3. Bollinger Bands（需要至少 20 天）
      if (historicalData.length >= 20) {
        indicators.bollinger_bands = calculateBollingerBands(historicalData, 20, 2);
      }
      
      // 4. ATR（需要至少 15 天）
      if (historicalData.length >= 15) {
        indicators.atr_14 = calculateATR(historicalData, 14);
      }
      
      // 5. MA（多個週期）
      if (historicalData.length >= 20) {
        indicators.ma20 = calculateMA(historicalData, 20);
        // ⭐ V8.19 實戰模擬四：Parabolic Exit 用於 volume / avg_volume / close_latest
        const last = historicalData[historicalData.length - 1];
        const last20 = historicalData.slice(-20);
        indicators.volume_latest = last.volume != null ? last.volume : null;
        indicators.avg_volume_20d = last20.reduce(function (s, d) { return s + (d.volume || 0); }, 0) / last20.length;
        indicators.close_latest = last.close != null ? last.close : null;
      }
      if (historicalData.length >= 50) {
        indicators.ma50 = calculateMA(historicalData, 50);
      }
      if (historicalData.length >= 200) {
        indicators.ma200 = calculateMA(historicalData, 200);
      }
      
      indicators.status = "COMPLETED";
      indicatorsData[ticker] = indicators;
      
      // 更新到 MARKET_INDICATORS_DAILY 表格
      updateTechnicalIndicatorsToSheet(ticker, indicators);
      
    } catch (error) {
      Logger.log(`P5 Weekly：計算 ${ticker} 完整技術指標失敗：${error.message}`);
      indicatorsData[ticker] = {
        ticker: ticker,
        error: error.message,
        status: "ERROR"
      };
    }
  }
  
  Logger.log(`P5 Weekly：完整技術指標計算完成（成功：${Object.keys(indicatorsData).filter(k => indicatorsData[k].status === "COMPLETED").length} 檔）`);
  
  return indicatorsData;
}

/**
 * 計算 Bollinger Bands（布林帶）
 * 
 * @param {Array} data - 歷史數據（按日期升序，從舊到新）
 * @param {number} period - 週期（通常為 20）
 * @param {number} stdDev - 標準差倍數（通常為 2）
 * @returns {Object} bb - Bollinger Bands 指標
 */
function calculateBollingerBands(data, period, stdDev) {
  if (data.length < period) return null;
  
  // 計算移動平均線（中線）
  const ma = calculateMA(data, period);
  
  // 計算標準差
  let sumSquaredDiff = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const diff = data[i].close - ma;
    sumSquaredDiff += diff * diff;
  }
  const variance = sumSquaredDiff / period;
  const standardDeviation = Math.sqrt(variance);
  
  // 計算上軌和下軌
  const upperBand = ma + (standardDeviation * stdDev);
  const lowerBand = ma - (standardDeviation * stdDev);
  
  // 計算 %B（當前價格在布林帶中的位置）
  const currentPrice = data[data.length - 1].close;
  const percentB = (currentPrice - lowerBand) / (upperBand - lowerBand);
  
  // 計算帶寬（Bandwidth）
  const bandwidth = ((upperBand - lowerBand) / ma) * 100;
  
  return {
    upper_band: Math.round(upperBand * 100) / 100,
    middle_band: Math.round(ma * 100) / 100,
    lower_band: Math.round(lowerBand * 100) / 100,
    percent_b: Math.round(percentB * 100) / 100,
    bandwidth: Math.round(bandwidth * 100) / 100,
    current_price: currentPrice
  };
}

/**
 * 更新技術指標到 MARKET_INDICATORS_DAILY 表格
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} indicators - 技術指標數據
 */
function updateTechnicalIndicatorsToSheet(ticker, indicators) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
    
    if (!sheet) {
      Logger.log(`P5 Weekly：MARKET_INDICATORS_DAILY 表格不存在，跳過更新`);
      return;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const dateCol = headers.indexOf("date");
    
    if (tickerCol === -1 || dateCol === -1) {
      Logger.log(`P5 Weekly：MARKET_INDICATORS_DAILY 表格格式錯誤，跳過更新`);
      return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 查找今天的記錄
    let foundRow = -1;
    for (let i = 1; i < rows.length; i++) {
      const rowTicker = rows[i][tickerCol];
      const rowDate = rows[i][dateCol];
      
      if (rowTicker === ticker && rowDate && new Date(rowDate).getTime() === today.getTime()) {
        foundRow = i + 1;  // Sheet 行號（1-based）
        break;
      }
    }
    
    // 準備更新數據
    const updateData = {};
    for (const [key, value] of Object.entries(indicators)) {
      if (key !== "ticker" && key !== "date" && key !== "status" && key !== "calculation_type") {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          updateData[colIndex] = value;
        }
      }
    }
    
    // 更新或新增記錄
    if (foundRow > 0) {
      // 更新現有記錄
      for (const [colIndex, value] of Object.entries(updateData)) {
        sheet.getRange(foundRow, parseInt(colIndex) + 1).setValue(value);
      }
      // 更新 calculation_type
      const calcTypeCol = headers.indexOf("calculation_type");
      if (calcTypeCol !== -1) {
        sheet.getRange(foundRow, calcTypeCol + 1).setValue("WEEKLY_FULL");
      }
    } else {
      // 新增記錄
      const newRow = [today, ticker];
      headers.forEach((header, colIndex) => {
        if (header === "date") {
          newRow[colIndex] = today;
        } else if (header === "ticker") {
          newRow[colIndex] = ticker;
        } else if (updateData[colIndex] !== undefined) {
          newRow[colIndex] = updateData[colIndex];
        } else if (header === "calculation_type") {
          newRow[colIndex] = "WEEKLY_FULL";
        } else {
          newRow[colIndex] = "";
        }
      });
      sheet.appendRow(newRow);
    }
    
    Logger.log(`P5 Weekly：${ticker} 完整技術指標已更新到 MARKET_INDICATORS_DAILY`);
    
  } catch (error) {
    Logger.log(`P5 Weekly：更新 ${ticker} 技術指標到表格失敗：${error.message}`);
  }
}

// ==========================================
// 重用 P5 Daily 的計算函數
// ==========================================

// 以下函數從 24_P5_DAILY_TECHNICAL.js 重用：
// - calculateRSI
// - calculateMACD
// - calculateATR
// - calculateMA
// - calculateEMAValues
// - calculateEMAFromValues
