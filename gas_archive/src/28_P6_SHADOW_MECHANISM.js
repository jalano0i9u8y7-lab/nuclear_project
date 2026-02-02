/**
 * 📊 P6: 20 分鐘動能追蹤（原「殘影機制」Shadow Mechanism）⭐ V8.19 N3 更名
 * 
 * 記錄每次監測的價格點，計算 20 分鐘價格/成交量變化，供急殺急拉檢測使用。
 * 
 * @version V8.19
 * @date 2026-01-25
 */

// ==========================================
// 20 分鐘動能追蹤數據存儲（P6_SHADOW_PRICES 表格）
// ==========================================

/**
 * 保存價格點到 20 分鐘動能追蹤記錄
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @param {number} price - 當前價格
 * @param {number} volume - 成交量
 * @returns {boolean} success - 是否成功
 */
function saveShadowPrice(ticker, market, price, volume) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P6_SHADOW_PRICES");
    
    if (!sheet) {
      sheet = ss.insertSheet("P6_SHADOW_PRICES");
      sheet.appendRow([
        "ticker",
        "market",
        "timestamp",
        "price",
        "volume"
      ]);
      sheet.hideSheet();
    }
    
    const now = new Date();
    sheet.appendRow([
      ticker,
      market,
      now,
      price,
      volume
    ]);
    
    return true;
    
  } catch (error) {
    Logger.log(`P6：保存 20 分鐘動能追蹤價格失敗：${error.message}`);
    return false;
  }
}

/**
 * 獲取 20 分鐘前的價格點
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @returns {Object|null} 20 分鐘前的價格數據（20 分鐘動能追蹤）
 */
function getShadowPrice20MinAgo(ticker, market) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P6_SHADOW_PRICES");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const now = new Date();
    const targetTime = new Date(now.getTime() - 20 * 60 * 1000); // 20 分鐘前
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    // 從後往前找（最新的數據在後面）
    for (let i = rows.length - 1; i >= 1; i--) {
      const rowTicker = rows[i][0];
      const rowMarket = rows[i][1];
      const rowTimestamp = rows[i][2];
      
      if (rowTicker === ticker && rowMarket === market && rowTimestamp instanceof Date) {
        // 檢查時間是否在 20 分鐘前附近（允許 ±2 分鐘誤差）
        const timeDiff = Math.abs(rowTimestamp.getTime() - targetTime.getTime());
        if (timeDiff <= 2 * 60 * 1000) { // 2 分鐘誤差
          return {
            ticker: rowTicker,
            market: rowMarket,
            timestamp: rowTimestamp,
            price: rows[i][3],
            volume: rows[i][4]
          };
        }
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`P6：獲取 20 分鐘動能追蹤價格失敗：${error.message}`);
    return null;
  }
}

/**
 * 計算 20 分鐘價格和成交量變化（價/量變化）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @param {number} currentPrice - 當前價格
 * @param {number} currentVolume - 當前成交量（可選）
 * @returns {Object|null} changeData - 價/量變化數據
 */
function calculate20MinPriceChange(ticker, market, currentPrice, currentVolume = null) {
  try {
    const shadowPrice = getShadowPrice20MinAgo(ticker, market);
    
    if (!shadowPrice || !shadowPrice.price) {
      // 沒有 20 分鐘前的數據，返回 null
      return null;
    }
    
    // 價格變化
    const priceChange = currentPrice - shadowPrice.price;
    const priceChangePct = shadowPrice.price !== 0 
      ? (priceChange / shadowPrice.price) * 100 
      : 0;
    
    // 成交量變化（如果有數據）
    let volumeChange = null;
    let volumeChangePct = null;
    let volumeRatio = null;
    
    if (currentVolume !== null && currentVolume > 0 && shadowPrice.volume !== null && shadowPrice.volume > 0) {
      volumeChange = currentVolume - shadowPrice.volume;
      volumeChangePct = shadowPrice.volume !== 0 
        ? (volumeChange / shadowPrice.volume) * 100 
        : 0;
      volumeRatio = shadowPrice.volume !== 0 
        ? currentVolume / shadowPrice.volume 
        : null;
    }
    
    return {
      ticker: ticker,
      market: market,
      currentPrice: currentPrice,
      price20MinAgo: shadowPrice.price,
      priceChange: priceChange,
      priceChangePct: priceChangePct,
      currentVolume: currentVolume,
      volume20MinAgo: shadowPrice.volume,
      volumeChange: volumeChange,
      volumeChangePct: volumeChangePct,
      volumeRatio: volumeRatio,  // 成交量倍數
      timestamp20MinAgo: shadowPrice.timestamp,
      timestamp: new Date()
    };
    
  } catch (error) {
    Logger.log(`P6：計算 20 分鐘價/量變化失敗：${error.message}`);
    return null;
  }
}

/**
 * 計算波動度（使用 ATR14，從前一日的 MARKET_INDICATORS_DAILY 讀取）
 * 
 * @param {string} ticker - 股票代碼
 * @returns {number|null} atr14 - ATR14 值
 */
function getATR14FromDailyIndicators(ticker) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    // 獲取前一日的數據（不是今天，因為今天可能還沒有計算）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const dateCol = headers.indexOf("date");
    const atrCol = headers.indexOf("atr_14");
    
    if (tickerCol === -1 || dateCol === -1 || atrCol === -1) {
      return null;
    }
    
    // 從後往前找（最新的數據在後面）
    for (let i = rows.length - 1; i >= 1; i--) {
      const rowTicker = rows[i][tickerCol];
      const rowDate = rows[i][dateCol];
      
      if (rowTicker === ticker && rowDate instanceof Date) {
        const rowDateOnly = new Date(rowDate);
        rowDateOnly.setHours(0, 0, 0, 0);
        
        // 檢查是否為昨天或更早（最近的有效數據）
        if (rowDateOnly <= yesterday) {
          const atr14 = rows[i][atrCol];
          if (atr14 !== null && atr14 !== undefined && !isNaN(atr14) && atr14 > 0) {
            return parseFloat(atr14);
          }
        }
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`P6：獲取 ATR14 失敗：${error.message}`);
    return null;
  }
}

/**
 * 清除舊的 20 分鐘動能追蹤數據（保留最近 2 小時）
 * 
 * @returns {number} deletedCount - 刪除的記錄數
 */
function clearOldShadowData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P6_SHADOW_PRICES");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return 0;
    }
    
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 小時前
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    let deletedCount = 0;
    const rowsToKeep = [rows[0]]; // 保留標題行
    
    // 保留最近 2 小時的數據
    for (let i = 1; i < rows.length; i++) {
      const rowTimestamp = rows[i][2];
      if (rowTimestamp instanceof Date && rowTimestamp >= cutoffTime) {
        rowsToKeep.push(rows[i]);
      } else {
        deletedCount++;
      }
    }
    
    // 清除並重新寫入
    sheet.clear();
    if (rowsToKeep.length > 0) {
      sheet.getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
    }
    
    Logger.log(`P6：清除 ${deletedCount} 筆舊 20 分鐘動能追蹤數據，保留 ${rowsToKeep.length - 1} 筆`);
    
    return deletedCount;
    
  } catch (error) {
    Logger.log(`P6：清除舊 20 分鐘動能追蹤數據失敗：${error.message}`);
    return 0;
  }
}
