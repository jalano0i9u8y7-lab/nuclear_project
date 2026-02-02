/**
 * 📊 P5 Daily: 技術指標計算（每日輕量）⭐ V8.0 優化
 * 
 * ⭐ V8.0 變更：僅計算每日必需指標（輕量計算）
 * - Close vs MA(50,200)
 * - Volume vs Volume MA
 * - 基礎破位檢測
 * 
 * 完整指標（MACD, RSI, Bollinger Bands）由 P5 Weekly 觸發計算
 * 
 * @version SSOT V8.0
 * @date 2025-01-14
 */

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
      
      // ⭐ V8.0 優化：僅計算每日輕量指標（節省約 80% 計算量）
      const indicators = {
        ticker: ticker,
        date: new Date()
      };
      
      const latestClose = historicalData[historicalData.length - 1].close;
      const latestVolume = historicalData[historicalData.length - 1].volume || 0;
      
      // 1. Close vs MA(50,200) ⭐ 每日必需
      if (historicalData.length >= 50) {
        indicators.ma50 = calculateMA(historicalData, 50);
        indicators.close_vs_ma50 = latestClose - indicators.ma50;
        indicators.close_vs_ma50_pct = ((latestClose - indicators.ma50) / indicators.ma50) * 100;
      }
      if (historicalData.length >= 200) {
        indicators.ma200 = calculateMA(historicalData, 200);
        indicators.close_vs_ma200 = latestClose - indicators.ma200;
        indicators.close_vs_ma200_pct = ((latestClose - indicators.ma200) / indicators.ma200) * 100;
      }
      
      // 2. Volume vs Volume MA ⭐ 每日必需
      if (historicalData.length >= 20) {
        const volumeMA = calculateVolumeMA(historicalData, 20);
        indicators.volume_ma20 = volumeMA;
        indicators.volume_vs_ma = latestVolume - volumeMA;
        indicators.volume_vs_ma_pct = volumeMA > 0 ? ((latestVolume - volumeMA) / volumeMA) * 100 : 0;
      }
      
      // 3. 基礎破位檢測 ⭐ 每日必需
      if (historicalData.length >= 5) {
        const recentHigh = Math.max(...historicalData.slice(-5).map(d => d.high));
        const recentLow = Math.min(...historicalData.slice(-5).map(d => d.low));
        indicators.recent_high = recentHigh;
        indicators.recent_low = recentLow;
        indicators.breakout_above_high = latestClose > recentHigh;
        indicators.breakdown_below_low = latestClose < recentLow;
      }
      
      // ⚠️ 注意：RSI、MACD、Bollinger Bands 等完整指標由 P5 Weekly 觸發計算
      
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
 * 計算 RSI（相對強弱指標）
 * 
 * @param {Array} data - 歷史數據（按日期升序，從舊到新）
 * @param {number} period - 週期（通常為 14）
 * @returns {number} rsi - RSI 值
 */
function calculateRSI(data, period) {
  if (data.length < period + 1) return null;
  
  // RSI 計算：使用 Wilder's Smoothing Method
  const changes = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close);
  }
  
  // 計算初始平均收益和平均損失
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
  
  // 使用 Wilder's Smoothing 計算後續值
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
  
  // 計算 RSI
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return Math.round(rsi * 100) / 100;
}

/**
 * 計算 MACD（移動平均收斂發散指標）
 * 
 * @param {Array} data - 歷史數據（按日期升序，從舊到新）
 * @returns {Object} macd - MACD 指標
 */
function calculateMACD(data) {
  if (data.length < 26) return null;
  
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
  const minLength = Math.min(ema12Values.length, ema26Values.length);
  const macdValues = [];
  
  for (let i = 0; i < minLength; i++) {
    const idx12 = ema12Values.length - minLength + i;
    const idx26 = ema26Values.length - minLength + i;
    macdValues.push(ema12Values[idx12] - ema26Values[idx26]);
  }
  
  const macdLine = macdValues[macdValues.length - 1];
  const signalLine = calculateEMAFromValues(macdValues, signalPeriod);
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
  
  // 先計算 SMA 作為初始值
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
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }
  
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let ema = sum / period;
  
  const multiplier = 2 / (period + 1);
  
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
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    );
    trValues.push(tr);
  }
  
  // 計算 ATR（使用 Wilder's Smoothing）
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trValues[i];
  }
  let atr = sum / period;
  
  for (let i = period; i < trValues.length; i++) {
    atr = (atr * (period - 1) + trValues[i]) / period;
  }
  
  return Math.round(atr * 100) / 100;
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
  
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    sum += data[i].close;
  }
  
  return Math.round((sum / period) * 100) / 100;
}

/**
 * 計算成交量移動平均線（Volume MA）
 * 
 * @param {Array} data - 歷史數據（按日期升序，從舊到新）
 * @param {number} period - 週期
 * @returns {number} volumeMA - 成交量移動平均值
 */
function calculateVolumeMA(data, period) {
  if (data.length < period) return null;
  
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    sum += data[i].volume || 0;
  }
  
  return Math.round((sum / period) * 100) / 100;
}
