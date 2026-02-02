/**
 * 💰 P2.5: 籌碼面數據收集
 * 
 * 從 P5 Daily 收集的數據中讀取機構級籌碼面數據
 * 
 * @version SSOT V7.1
 * @date 2025-01-15
 */

/**
 * 收集籌碼面數據（從 P5 Daily 讀取）
 * @param {Array<string>} tickers - 股票代碼列表
 * @param {string} frequency - 執行頻率（MONTHLY / QUARTERLY）
 * @return {Object} 籌碼面數據
 */
function collectSmartMoneyData(tickers, frequency) {
  Logger.log(`P2.5：開始收集籌碼面數據：tickers=${tickers.join(',')}, frequency=${frequency}`);
  
  const result = {
    institutional_holdings: {},  // 13F 機構持倉變化
    insider_trading: {},          // 內部人交易
    options_flow: {},             // 期權活動（從 DERIVATIVES_DAILY 讀取）
    dark_pool: {}                 // Dark Pool 活動
  };
  
  // 計算時間範圍
  const endDate = new Date();
  const startDate = new Date();
  
  if (frequency === "QUARTERLY") {
    // 季度：過去 3 個月
    startDate.setMonth(startDate.getMonth() - 3);
  } else {
    // 月度：過去 1 個月
    startDate.setMonth(startDate.getMonth() - 1);
  }
  
  Logger.log(`P2.5：時間範圍：${startDate.toISOString().split('T')[0]} 到 ${endDate.toISOString().split('T')[0]}`);
  
  // 從 SMART_MONEY_DAILY 表格讀取數據
  for (const ticker of tickers) {
    Logger.log(`P2.5：收集 ${ticker} 籌碼面數據`);
    try {
      // 1. 機構持倉變化（13F）
      result.institutional_holdings[ticker] = getInstitutionalHoldings(ticker, startDate, endDate);
      
      // 2. 內部人交易
      result.insider_trading[ticker] = getInsiderTrading(ticker, startDate, endDate);
      
      // 3. Dark Pool 活動
      result.dark_pool[ticker] = getDarkPoolActivity(ticker, startDate, endDate);
      
      // 4. 期權活動（從 DERIVATIVES_DAILY 讀取）
      result.options_flow[ticker] = getOptionsFlow(ticker, startDate, endDate);
      
      Logger.log(`P2.5：${ticker} 數據收集完成（機構持倉：${Object.keys(result.institutional_holdings[ticker] || {}).length > 0 ? '有' : '無'}, 內線交易：${Object.keys(result.insider_trading[ticker] || {}).length > 0 ? '有' : '無'}, 期權：${Object.keys(result.options_flow[ticker] || {}).length > 0 ? '有' : '無'}, Dark Pool：${Object.keys(result.dark_pool[ticker] || {}).length > 0 ? '有' : '無'}）`);
      
    } catch (error) {
      Logger.log(`P2.5：收集 ${ticker} 籌碼面數據失敗：${error.message}`);
      // 繼續處理其他股票
    }
  }
  
  Logger.log(`P2.5：籌碼面數據收集完成，共處理 ${tickers.length} 檔股票`);
  return result;
}

/**
 * 獲取機構持倉變化（13F）
 * @param {string} ticker - 股票代碼
 * @param {Date} startDate - 開始日期
 * @param {Date} endDate - 結束日期
 * @return {Object} 機構持倉數據
 */
function getInstitutionalHoldings(ticker, startDate, endDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("SMART_MONEY_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { net_change: 0, institution_count: 0, top_buyers: [], top_sellers: [] };
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const dateCol = headers.indexOf("date");
    const dataTypeCol = headers.indexOf("data_type");
    const valueCol = headers.indexOf("value");
    
    if (tickerCol === -1 || dateCol === -1) {
      return { net_change: 0, institution_count: 0, top_buyers: [], top_sellers: [] };
    }
    
    // 篩選該股票的 13F 數據
    const relevantRows = rows.slice(1).filter(row => {
      const rowDate = new Date(row[dateCol]);
      return row[tickerCol] === ticker &&
             row[dataTypeCol] === "13F_HOLDINGS" &&
             rowDate >= startDate &&
             rowDate <= endDate;
    });
    
    // 計算淨變化（簡化版，實際需要更複雜的邏輯）
    let netChange = 0;
    let institutionCount = 0;
    const buyers = [];
    const sellers = [];
    
    for (const row of relevantRows) {
      const value = row[valueCol] ? JSON.parse(row[valueCol]) : {};
      netChange += value.net_change || 0;
      institutionCount = Math.max(institutionCount, value.institution_count || 0);
      
      if (value.top_buyers) {
        buyers.push(...value.top_buyers);
      }
      if (value.top_sellers) {
        sellers.push(...value.top_sellers);
      }
    }
    
    return {
      net_change: netChange,
      institution_count: institutionCount,
      top_buyers: [...new Set(buyers)].slice(0, 5),  // 去重，取前 5
      top_sellers: [...new Set(sellers)].slice(0, 5),
      trend: netChange > 0.05 ? "ACCUMULATING" : 
             netChange < -0.05 ? "DISTRIBUTING" : "NEUTRAL"
    };
    
  } catch (error) {
    Logger.log(`獲取 ${ticker} 機構持倉失敗：${error.message}`);
    return { net_change: 0, institution_count: 0, top_buyers: [], top_sellers: [] };
  }
}

/**
 * 獲取內部人交易
 * @param {string} ticker - 股票代碼
 * @param {Date} startDate - 開始日期
 * @param {Date} endDate - 結束日期
 * @return {Object} 內部人交易數據
 */
function getInsiderTrading(ticker, startDate, endDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("SMART_MONEY_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { signal: "NEUTRAL", recent_transactions: [] };
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const dateCol = headers.indexOf("date");
    const dataTypeCol = headers.indexOf("data_type");
    const valueCol = headers.indexOf("value");
    
    if (tickerCol === -1 || dateCol === -1) {
      return { signal: "NEUTRAL", recent_transactions: [] };
    }
    
    // 篩選該股票的內部人交易數據
    const relevantRows = rows.slice(1).filter(row => {
      const rowDate = new Date(row[dateCol]);
      return row[tickerCol] === ticker &&
             row[dataTypeCol] === "INSIDER_TRADING" &&
             rowDate >= startDate &&
             rowDate <= endDate;
    });
    
    const transactions = [];
    let buyCount = 0;
    let sellCount = 0;
    let totalBuyAmount = 0;
    let totalSellAmount = 0;
    
    for (const row of relevantRows) {
      const value = row[valueCol] ? JSON.parse(row[valueCol]) : {};
      if (value.transactions) {
        for (const tx of value.transactions) {
          transactions.push(tx);
          if (tx.type === "BUY") {
            buyCount++;
            totalBuyAmount += tx.amount || 0;
          } else if (tx.type === "SELL") {
            sellCount++;
            totalSellAmount += tx.amount || 0;
          }
        }
      }
    }
    
    // 判斷信號
    let signal = "NEUTRAL";
    if (buyCount > sellCount * 2 && totalBuyAmount > totalSellAmount * 2) {
      signal = "BULLISH";
    } else if (sellCount > buyCount * 2 && totalSellAmount > totalBuyAmount * 2) {
      signal = "BEARISH";
    }
    
    return {
      signal: signal,
      recent_transactions: transactions.slice(-10),  // 最近 10 筆
      buy_count: buyCount,
      sell_count: sellCount,
      total_buy_amount: totalBuyAmount,
      total_sell_amount: totalSellAmount
    };
    
  } catch (error) {
    Logger.log(`獲取 ${ticker} 內部人交易失敗：${error.message}`);
    return { signal: "NEUTRAL", recent_transactions: [] };
  }
}

/**
 * 獲取 Dark Pool 活動
 * @param {string} ticker - 股票代碼
 * @param {Date} startDate - 開始日期
 * @param {Date} endDate - 結束日期
 * @return {Object} Dark Pool 數據
 */
function getDarkPoolActivity(ticker, startDate, endDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("SMART_MONEY_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { unusual_volume: false, sentiment: "NEUTRAL", net_flow: 0 };
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const dateCol = headers.indexOf("date");
    const dataTypeCol = headers.indexOf("data_type");
    const valueCol = headers.indexOf("value");
    
    if (tickerCol === -1 || dateCol === -1) {
      return { unusual_volume: false, sentiment: "NEUTRAL", net_flow: 0 };
    }
    
    // 篩選該股票的 Dark Pool 數據
    const relevantRows = rows.slice(1).filter(row => {
      const rowDate = new Date(row[dateCol]);
      return row[tickerCol] === ticker &&
             row[dataTypeCol] === "DARK_POOL" &&
             rowDate >= startDate &&
             rowDate <= endDate;
    });
    
    let totalInflow = 0;
    let totalOutflow = 0;
    let maxVolume = 0;
    let avgVolume = 0;
    
    for (const row of relevantRows) {
      const value = row[valueCol] ? JSON.parse(row[valueCol]) : {};
      totalInflow += value.inflow || 0;
      totalOutflow += value.outflow || 0;
      const volume = (value.inflow || 0) + (value.outflow || 0);
      maxVolume = Math.max(maxVolume, volume);
      avgVolume += volume;
    }
    
    avgVolume = relevantRows.length > 0 ? avgVolume / relevantRows.length : 0;
    const netFlow = totalInflow - totalOutflow;
    
    // 判斷是否異常（成交量超過平均值的 2 倍）
    const unusualVolume = maxVolume > avgVolume * 2;
    
    // 判斷情緒
    let sentiment = "NEUTRAL";
    if (netFlow > 0 && unusualVolume) {
      sentiment = "BULLISH";
    } else if (netFlow < 0 && unusualVolume) {
      sentiment = "BEARISH";
    }
    
    return {
      unusual_volume: unusualVolume,
      sentiment: sentiment,
      net_flow: netFlow,
      inflow: totalInflow,
      outflow: totalOutflow
    };
    
  } catch (error) {
    Logger.log(`獲取 ${ticker} Dark Pool 活動失敗：${error.message}`);
    return { unusual_volume: false, sentiment: "NEUTRAL", net_flow: 0 };
  }
}

/**
 * 獲取期權活動（從 DERIVATIVES_DAILY 讀取）
 * @param {string} ticker - 股票代碼
 * @param {Date} startDate - 開始日期
 * @param {Date} endDate - 結束日期
 * @return {Object} 期權活動數據
 */
function getOptionsFlow(ticker, startDate, endDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("DERIVATIVES_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { unusual_activity: false, sentiment: "NEUTRAL", put_call_ratio: 0 };
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const dateCol = headers.indexOf("date");
    const putCallRatioCol = headers.indexOf("put_call_ratio");
    const maxOiStrikeCallCol = headers.indexOf("max_oi_strike_call");
    const maxOiStrikePutCol = headers.indexOf("max_oi_strike_put");
    const iv30dCol = headers.indexOf("iv_30d");
    
    if (tickerCol === -1 || dateCol === -1) {
      return { unusual_activity: false, sentiment: "NEUTRAL", put_call_ratio: 0 };
    }
    
    // 篩選該股票的期權數據
    const relevantRows = rows.slice(1).filter(row => {
      const rowDate = new Date(row[dateCol]);
      return row[tickerCol] === ticker &&
             rowDate >= startDate &&
             rowDate <= endDate;
    });
    
    if (relevantRows.length === 0) {
      return { unusual_activity: false, sentiment: "NEUTRAL", put_call_ratio: 0 };
    }
    
    // 計算平均值
    let totalPutCallRatio = 0;
    let maxPutCallRatio = 0;
    let minPutCallRatio = Infinity;
    
    for (const row of relevantRows) {
      const pcr = row[putCallRatioCol] || 0;
      totalPutCallRatio += pcr;
      maxPutCallRatio = Math.max(maxPutCallRatio, pcr);
      minPutCallRatio = Math.min(minPutCallRatio, pcr);
    }
    
    const avgPutCallRatio = relevantRows.length > 0 ? totalPutCallRatio / relevantRows.length : 0;
    
    // 判斷是否異常（Put/Call Ratio 波動超過 30%）
    const unusualActivity = (maxPutCallRatio - minPutCallRatio) > avgPutCallRatio * 0.3;
    
    // 判斷情緒（Put/Call Ratio < 0.6 看漲，> 1.0 看跌）
    let sentiment = "NEUTRAL";
    if (avgPutCallRatio < 0.6) {
      sentiment = "BULLISH";
    } else if (avgPutCallRatio > 1.0) {
      sentiment = "BEARISH";
    }
    
    // 獲取最新一筆數據
    const latestRow = relevantRows[relevantRows.length - 1];
    
    return {
      unusual_activity: unusualActivity,
      sentiment: sentiment,
      put_call_ratio: avgPutCallRatio,
      max_oi_strike_call: latestRow[maxOiStrikeCallCol] || null,
      max_oi_strike_put: latestRow[maxOiStrikePutCol] || null,
      iv_30d: latestRow[iv30dCol] || null
    };
    
  } catch (error) {
    Logger.log(`獲取 ${ticker} 期權活動失敗：${error.message}`);
    return { unusual_activity: false, sentiment: "NEUTRAL", put_call_ratio: 0 };
  }
}
