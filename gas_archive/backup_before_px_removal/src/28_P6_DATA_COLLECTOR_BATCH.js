/**
 * 📊 P6: 批量 GOOGLEFINANCE 數據收集（優化版）
 * 
 * ⭐ V8.0 新增：批量讀取 GOOGLEFINANCE，避免單檔讀取造成的污染和效率問題
 * 
 * @version V8.0
 * @date 2026-01-17
 */

// ==========================================
// 批量 GOOGLEFINANCE 數據收集
// ==========================================

/**
 * 批量獲取盤中價格數據（使用批量公式寫入，避免污染）
 * 
 * @param {Array} tickers - ticker 列表 [{ticker: "NVDA", market: "US", googleTicker: "NASDAQ:NVDA"}, ...]
 * @returns {Object} batchData - 批量數據 {ticker: {price, change_pct, volume, ...}}
 */
function batchFetchIntradayPriceData(tickers) {
  const batchData = {};
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("SYS_G_FINANCE_PROXY");
    
    if (!sheet) {
      sheet = ss.insertSheet("SYS_G_FINANCE_PROXY");
      sheet.hideSheet();
    }
    
    // 清除整個區域
    const maxRows = tickers.length * 10; // 預留空間（每個 ticker 可能需要多行）
    if (sheet.getLastRow() > 0) {
      sheet.getRange(1, 1, Math.max(sheet.getLastRow(), maxRows), 10).clearContent();
    }
    SpreadsheetApp.flush();
    
    // 批量寫入公式（每個 ticker 使用一行，存儲多個屬性）
    // 格式：A 列 = ticker, B 列 = googleTicker, C 列 = price 公式, D 列 = priceopen 公式, E 列 = volume 公式, F 列 = changepct 公式
    const formulas = [];
    const tickerRows = []; // 記錄每個 ticker 對應的行號
    
    for (let i = 0; i < tickers.length; i++) {
      const item = tickers[i];
      const rowNum = i + 1;
      
      const googleTicker = item.googleTicker || convertTickerToGoogleFinance(item.ticker, item.market);
      if (!googleTicker) {
        continue;
      }
      
      // 寫入 ticker 和 googleTicker
      sheet.getRange(rowNum, 1).setValue(item.ticker);
      sheet.getRange(rowNum, 2).setValue(googleTicker);
      
      // 批量寫入公式（price, priceopen, volume, changepct）
      const priceFormula = `=GOOGLEFINANCE(B${rowNum}, "price")`;
      const priceOpenFormula = `=GOOGLEFINANCE(B${rowNum}, "priceopen")`;
      const volumeFormula = `=GOOGLEFINANCE(B${rowNum}, "volume")`;
      const changePctFormula = `=GOOGLEFINANCE(B${rowNum}, "changepct")`;
      
      sheet.getRange(rowNum, 3).setFormula(priceFormula);      // C 列 = price
      sheet.getRange(rowNum, 4).setFormula(priceOpenFormula);  // D 列 = priceopen
      sheet.getRange(rowNum, 5).setFormula(volumeFormula);     // E 列 = volume
      sheet.getRange(rowNum, 6).setFormula(changePctFormula);  // F 列 = changepct
      
      tickerRows.push({
        ticker: item.ticker,
        market: item.market,
        googleTicker: googleTicker,
        rowNum: rowNum
      });
    }
    
    // 強制刷新
    SpreadsheetApp.flush();
    
    // 智慧等待迴圈（批量讀取需要更長時間）
    const maxRetries = 30; // 30次 * 500ms = 15秒
    let allReady = false;
    
    for (let retry = 0; retry < maxRetries; retry++) {
      Utilities.sleep(500);
      
      // 檢查所有 ticker 的 price 是否都準備好了（檢查 C 列）
      let readyCount = 0;
      for (const tickerRow of tickerRows) {
        const cellValue = sheet.getRange(tickerRow.rowNum, 3).getValue();
        const displayValue = sheet.getRange(tickerRow.rowNum, 3).getDisplayValue();
        
        if (displayValue !== "#N/A" && 
            displayValue !== "Loading..." && 
            displayValue !== "#ERROR!" &&
            !isNaN(cellValue) && 
            cellValue > 0) {
          readyCount++;
        }
      }
      
      if (readyCount === tickerRows.length) {
        allReady = true;
        break;
      }
      
      // 如果至少有一半準備好了，再等一次就可以讀取（部分數據也比沒有好）
      if (readyCount >= tickerRows.length * 0.5 && retry >= 10) {
        Logger.log(`P6：批量讀取 ${readyCount}/${tickerRows.length} 個 ticker 已準備好，繼續讀取`);
        break;
      }
    }
    
    // 批量讀取所有數據
    const dataRange = sheet.getRange(1, 1, tickerRows.length, 6);
    const rows = dataRange.getValues();
    
    for (let i = 0; i < tickerRows.length; i++) {
      const tickerRow = tickerRows[i];
      const row = rows[i];
      
      const price = row[2];  // C 列
      const priceOpen = row[3];  // D 列
      const volume = row[4];  // E 列
      const changePct = row[5];  // F 列
      
      // 三段式污染偵測
      const validation = validatePriceData(tickerRow.ticker, tickerRow.market, price, priceOpen, volume);
      
      if (!validation.isValid) {
        Logger.log(`P6：${tickerRow.ticker} 數據驗證失敗：${validation.reason}`);
        batchData[tickerRow.ticker] = {
          ticker: tickerRow.ticker,
          market: tickerRow.market,
          status: "INVALID_DATA",
          error: validation.reason
        };
        continue;
      }
      
      // 計算變化
      const change = price - priceOpen;
      const changePctCalculated = priceOpen !== 0 ? (change / priceOpen) * 100 : 0;
      
      // 使用 GOOGLEFINANCE 的 changepct 或自己計算的
      const finalChangePct = (!isNaN(changePct) && changePct !== null && changePct !== "") 
        ? changePct 
        : changePctCalculated;
      
      batchData[tickerRow.ticker] = {
        ticker: tickerRow.ticker,
        market: tickerRow.market,
        price: price,
        priceOpen: priceOpen,
        change: change,
        change_pct: finalChangePct,
        volume: volume || 0,
        status: "SUCCESS",
        data_source: "GOOGLE_INTERNAL"
      };
    }
    
    Logger.log(`P6：批量讀取完成：${Object.keys(batchData).length}/${tickerRows.length} 個 ticker 成功`);
    
  } catch (error) {
    Logger.log(`P6：批量讀取盤中數據失敗：${error.message}`);
  }
  
  return batchData;
}

/**
 * 三段式污染偵測
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @param {number} price - 價格
 * @param {number} priceOpen - 開盤價
 * @param {number} volume - 成交量
 * @returns {Object} validation - 驗證結果 {isValid: boolean, reason: string}
 */
function validatePriceData(ticker, market, price, priceOpen, volume) {
  // 1. 基本合法性檢查
  if (price === null || price === undefined || isNaN(price) || price <= 0 || price >= 1e6) {
    return {
      isValid: false,
      reason: `價格不合法：${price}`
    };
  }
  
  if (priceOpen === null || priceOpen === undefined || isNaN(priceOpen) || priceOpen <= 0 || priceOpen >= 1e6) {
    return {
      isValid: false,
      reason: `開盤價不合法：${priceOpen}`
    };
  }
  
  // 價格變化合理性檢查（單日不應超過 ±50%）
  if (priceOpen > 0) {
    const changePct = Math.abs((price - priceOpen) / priceOpen);
    if (changePct > 0.5) {
      return {
        isValid: false,
        reason: `價格變化過大：${(changePct * 100).toFixed(2)}%（可能污染）`
      };
    }
  }
  
  // 2. 跨資產 sanity check（需要在調用處傳入已讀取的數據進行比對）
  // 這裡簡化處理，實際應該比對同一批次的其他 ticker
  
  // 3. 短期一致性檢查（需要在調用處傳入上一輪讀取的數據進行比對）
  // 這裡簡化處理，實際應該檢查是否與上一輪差異為 0 且同時多 ticker 完全相同
  
  return {
    isValid: true,
    reason: null
  };
}
