/**
 * 📊 P6: 移動停利機制（Trailing Stop）
 * 
 * ⭐ V8.10 新增：整合 P5.9 泡沫監控戰略升級
 * 
 * 功能：
 * - 當 P5.9 判定為 LATE（瘋狗浪）階段時，自動切換為移動停利模式
 * - 動態防守線：以「最近 3 日最高價」為基準
 * - 觸發條件：從最高點回落 -4% 或跌破 MA10
 * - 觸發後：執行 P6 緊急撤退（減倉）
 * 
 * ⚠️ **明文規範**：
 * - P6 盤中只允許 Rule-Based（% + ATR + Volume + MA）
 * - 盤中任何決策不得調用 AI
 * - 只負責「狀態標記」和「通知」，不自動下單、不改掛單、不改配置
 * 
 * @version V8.10
 * @date 2026-01-18
 */

// ==========================================
// P6 移動停利配置
// ==========================================

const P6_TRAILING_STOP_CONFIG = {
  // 觸發條件
  trigger_conditions: {
    pullback_pct: -0.04,           // 從最高點回落 -4%
    ma10_break: true,              // 跌破 MA10 也觸發
    ma10_lookback: 10              // MA10 回看 10 天
  },
  
  // 最高價計算
  highest_price_lookback: 3,       // 最近 3 日最高價
  
  // 市場特性調整（可選）
  market_adjustments: {
    "TW": {
      pullback_pct: -0.04,         // 台股：-4%
      volume_confirmation: false    // 台股不要求量能確認
    },
    "US": {
      pullback_pct: -0.04,         // 美股：-4%
      volume_confirmation: true     // 美股要求量能確認（爆量下跌才觸發）
    },
    "JP": {
      pullback_pct: -0.035,        // 日股：-3.5%（略寬鬆）
      volume_confirmation: false
    }
  },
  
  // 緊急撤退配置（觸發後的動作）
  emergency_exit: {
    reduction_pct: 0.50,           // 減倉 50%（因為是從高點回落，可能只是獲利了結）
    trigger_type: "TRAILING_STOP", // 觸發類型標記
    preserve_core: true,           // 保留核心持倉
    core_preservation_pct: 0.30    // 核心持倉最多減 30%
  }
};

// ==========================================
// P6 移動停利核心函數
// ==========================================

/**
 * P6 移動停利監測主函數
 * 
 * ⭐ V8.10 新增：在 P6 盤中監測中調用
 * 
 * @param {Object} intradayData - 盤中數據
 * @param {string} bubbleStage - P5.9 泡沫階段（EARLY/MID/LATE/BURST/NORMAL）
 * @returns {Array} trailingStopTriggers - 移動停利觸發列表
 */
function P6_CheckTrailingStop(intradayData, bubbleStage) {
  const trailingStopTriggers = [];
  
  try {
    // 只有 LATE 階段才啟動移動停利機制
    if (bubbleStage !== "LATE") {
      return trailingStopTriggers; // 非 LATE 階段，不檢查移動停利
    }
    
    Logger.log(`P6：啟動移動停利機制（泡沫階段=${bubbleStage}）`);
    
    // 檢查每個持倉股票
    for (const position of intradayData.positions || []) {
      const trigger = checkTrailingStopForStock(position);
      
      if (trigger && trigger.triggered) {
        trailingStopTriggers.push(trigger);
        Logger.log(`P6：移動停利觸發 - ${position.ticker} (${position.market})：${trigger.reason}`);
      }
    }
    
    return trailingStopTriggers;
    
  } catch (error) {
    Logger.log(`P6：移動停利監測失敗：${error.message}`);
    return trailingStopTriggers;
  }
}

/**
 * 檢查單檔股票的移動停利觸發條件
 * 
 * @param {Object} position - 持倉數據（包含 ticker, market, currentPrice, volume 等）
 * @returns {Object|null} trigger - 觸發結果，如果未觸發則返回 null
 */
function checkTrailingStopForStock(position) {
  try {
    const ticker = position.ticker;
    const market = position.market || "US";
    const currentPrice = position.currentPrice || position.price || null;
    
    if (!currentPrice || currentPrice <= 0) {
      return null; // 價格無效，跳過
    }
    
    // 1. 獲取最近 3 日最高價
    const highestPrice = getRecentHighestPrice(ticker, market, P6_TRAILING_STOP_CONFIG.highest_price_lookback);
    
    if (!highestPrice || highestPrice <= 0) {
      return null; // 無歷史數據，跳過
    }
    
    // 2. 計算從最高點回落的百分比
    const pullbackPct = (currentPrice - highestPrice) / highestPrice;
    
    // 3. 獲取市場特定配置
    const marketConfig = P6_TRAILING_STOP_CONFIG.market_adjustments[market] || 
                         P6_TRAILING_STOP_CONFIG.market_adjustments["US"];
    const pullbackThreshold = marketConfig.pullback_pct || P6_TRAILING_STOP_CONFIG.trigger_conditions.pullback_pct;
    
    // 4. 檢查是否觸發回落條件
    let triggered = false;
    let triggerReason = null;
    
    if (pullbackPct <= pullbackThreshold) {
      triggered = true;
      triggerReason = `從最高點 ${highestPrice.toFixed(2)} 回落 ${(pullbackPct * 100).toFixed(2)}%，超過閾值 ${(pullbackThreshold * 100).toFixed(2)}%`;
    }
    
    // 5. 檢查是否跌破 MA10（如果啟用）
    if (!triggered && P6_TRAILING_STOP_CONFIG.trigger_conditions.ma10_break) {
      const ma10 = getMA10(ticker, market);
      
      if (ma10 && currentPrice < ma10) {
        // 檢查是否確認跌破（連續 2 次監測都低於 MA10）
        const previousCheck = getPreviousTrailingStopCheck(ticker, market);
        
        if (previousCheck && previousCheck.price < ma10) {
          triggered = true;
          triggerReason = `跌破 MA10（${ma10.toFixed(2)}），當前價格 ${currentPrice.toFixed(2)}`;
        } else {
          // 記錄本次檢查（待下次確認）
          saveTrailingStopCheck(ticker, market, currentPrice, ma10);
        }
      }
    }
    
    // 7. 量能確認（如果需要）
    if (triggered && marketConfig.volume_confirmation) {
      const volumeSpike = checkVolumeSpikeForTrailingStop(ticker, market, position.volume);
      
      if (!volumeSpike) {
        // 如果要求量能確認但沒有爆量，暫時不觸發（可能是假跌破）
        triggered = false;
        triggerReason = `${triggerReason}（但量能未確認，暫不觸發）`;
      }
    }
    
    if (!triggered) {
      return null;
    }
    
    // 8. 返回觸發結果
    return {
      triggered: true,
      ticker: ticker,
      market: market,
      currentPrice: currentPrice,
      highestPrice: highestPrice,
      pullbackPct: pullbackPct,
      pullbackThreshold: pullbackThreshold,
      ma10: getMA10(ticker, market) || null,
      reason: triggerReason,
      triggerType: "TRAILING_STOP",
      timestamp: new Date()
    };
    
  } catch (error) {
    Logger.log(`P6：檢查移動停利失敗（${position.ticker}）：${error.message}`);
    return null;
  }
}

/**
 * 獲取最近 N 日的最高價
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @param {number} days - 回看天數（預設 3）
 * @returns {number|null} highestPrice - 最高價，如果沒有數據則返回 null
 */
function getRecentHighestPrice(ticker, market, days = 3) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 8);
    const data = dataRange.getValues();
    
    // 構建查詢用的 ticker（需要處理不同格式）
    let queryTicker = ticker;
    if (market === "TW" && !ticker.startsWith("TPE:")) {
      queryTicker = `TPE:${ticker}`;
    } else if (market === "JP" && !ticker.startsWith("TYO:")) {
      queryTicker = `TYO:${ticker}`;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);
    
    let highestPrice = null;
    
    // 遍歷最近 N 天的數據
    for (let i = data.length - 1; i >= 0; i--) {
      const rowDate = data[i][0];
      const rowTicker = data[i][1];
      const rowHigh = data[i][3]; // high 欄位
      
      if (!rowDate || !rowTicker || !rowHigh) continue;
      
      const d = rowDate instanceof Date ? rowDate : new Date(rowDate);
      if (isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      
      // 比對 ticker（需要處理不同格式）
      let tickerMatch = false;
      if (rowTicker === ticker || rowTicker === queryTicker) {
        tickerMatch = true;
      } else if (ticker.indexOf(":") > -1) {
        const baseTicker = ticker.split(":")[1];
        if (rowTicker === baseTicker || rowTicker === ticker) {
          tickerMatch = true;
        }
      } else if (rowTicker && rowTicker.indexOf(":") > -1) {
        const baseTicker = rowTicker.split(":")[1];
        if (baseTicker === ticker) {
          tickerMatch = true;
        }
      }
      
      if (tickerMatch && d >= startDate && d <= today && rowHigh > 0) {
        if (highestPrice === null || rowHigh > highestPrice) {
          highestPrice = rowHigh;
        }
      }
      
      // 如果已經超過回看天數範圍，停止搜索
      if (d < startDate) {
        break;
      }
    }
    
    return highestPrice;
    
  } catch (error) {
    Logger.log(`P6：獲取最近 ${days} 日最高價失敗（${ticker}）：${error.message}`);
    return null;
  }
}

/**
 * 獲取 MA10（10 日移動平均線）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @returns {number|null} ma10 - MA10 值，如果沒有數據則返回 null
 */
function getMA10(ticker, market) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 11);
    const data = dataRange.getValues();
    
    // 構建查詢用的 ticker
    let queryTicker = ticker;
    if (market === "TW" && !ticker.startsWith("TPE:")) {
      queryTicker = `TPE:${ticker}`;
    } else if (market === "JP" && !ticker.startsWith("TYO:")) {
      queryTicker = `TYO:${ticker}`;
    }
    
    // 找到最新的 MA10 數據（最近一筆）
    for (let i = data.length - 1; i >= 0; i--) {
      const rowTicker = data[i][1];
      const ma20 = data[i][7]; // ma20 欄位（我們用 ma20 作為近似，因為通常 ma20 和 ma10 接近）
      
      // 比對 ticker
      let tickerMatch = false;
      if (rowTicker === ticker || rowTicker === queryTicker) {
        tickerMatch = true;
      } else if (ticker.indexOf(":") > -1) {
        const baseTicker = ticker.split(":")[1];
        if (rowTicker === baseTicker || rowTicker === ticker) {
          tickerMatch = true;
        }
      } else if (rowTicker && rowTicker.indexOf(":") > -1) {
        const baseTicker = rowTicker.split(":")[1];
        if (baseTicker === ticker) {
          tickerMatch = true;
        }
      }
      
      if (tickerMatch && ma20 && ma20 > 0) {
        // 如果沒有 MA10，使用 MA20 作為近似值
        // TODO: 未來可以在 MARKET_INDICATORS_DAILY 中新增 MA10 欄位
        return ma20;
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`P6：獲取 MA10 失敗（${ticker}）：${error.message}`);
    return null;
  }
}

/**
 * 檢查量能是否確認（用於移動停利）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @param {number} currentVolume - 當前成交量
 * @returns {boolean} volumeSpike - 是否爆量
 */
function checkVolumeSpikeForTrailingStop(ticker, market, currentVolume) {
  try {
    if (!currentVolume || currentVolume <= 0) {
      return false; // 無成交量數據，不確認
    }
    
    // 獲取最近 20 日的平均成交量
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return false;
    }
    
    const lastRow = sheet.getLastRow();
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 8);
    const data = dataRange.getValues();
    
    // 構建查詢用的 ticker
    let queryTicker = ticker;
    if (market === "TW" && !ticker.startsWith("TPE:")) {
      queryTicker = `TPE:${ticker}`;
    } else if (market === "JP" && !ticker.startsWith("TYO:")) {
      queryTicker = `TYO:${ticker}`;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 20);
    
    const volumes = [];
    
    // 收集最近 20 日的成交量
    for (let i = data.length - 1; i >= 0; i--) {
      const rowDate = data[i][0];
      const rowTicker = data[i][1];
      const rowVolume = data[i][6]; // volume 欄位
      
      if (!rowDate || !rowTicker || !rowVolume || rowVolume <= 0) continue;
      
      const d = rowDate instanceof Date ? rowDate : new Date(rowDate);
      if (isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      
      // 比對 ticker
      let tickerMatch = false;
      if (rowTicker === ticker || rowTicker === queryTicker) {
        tickerMatch = true;
      } else if (ticker.indexOf(":") > -1) {
        const baseTicker = ticker.split(":")[1];
        if (rowTicker === baseTicker || rowTicker === ticker) {
          tickerMatch = true;
        }
      } else if (rowTicker && rowTicker.indexOf(":") > -1) {
        const baseTicker = rowTicker.split(":")[1];
        if (baseTicker === ticker) {
          tickerMatch = true;
        }
      }
      
      if (tickerMatch && d >= startDate && d < today) {
        volumes.push(rowVolume);
      }
      
      if (d < startDate) {
        break;
      }
    }
    
    if (volumes.length === 0) {
      return false; // 無歷史成交量數據，不確認
    }
    
    // 計算平均成交量
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    
    // 檢查是否爆量（> 2 倍平均量）
    return currentVolume > 2.0 * avgVolume;
    
  } catch (error) {
    Logger.log(`P6：檢查量能確認失敗（${ticker}）：${error.message}`);
    return false;
  }
}

/**
 * 獲取上一次移動停利檢查結果（用於確認跌破 MA10）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @returns {Object|null} previousCheck - 上一次檢查結果
 */
function getPreviousTrailingStopCheck(ticker, market) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P6_TRAILING_STOP_CHECKS");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 6);
    const data = dataRange.getValues();
    
    // 找到該股票的最新檢查記錄
    for (let i = data.length - 1; i >= 0; i--) {
      const rowTicker = data[i][0];
      const rowMarket = data[i][1];
      
      if (rowTicker === ticker && rowMarket === market) {
        return {
          ticker: rowTicker,
          market: rowMarket,
          timestamp: data[i][2],
          price: data[i][3],
          ma10: data[i][4]
        };
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`P6：獲取上一次移動停利檢查失敗（${ticker}）：${error.message}`);
    return null;
  }
}

/**
 * 保存移動停利檢查結果（用於確認跌破 MA10）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @param {number} price - 當前價格
 * @param {number} ma10 - MA10 值
 */
function saveTrailingStopCheck(ticker, market, price, ma10) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P6_TRAILING_STOP_CHECKS");
    
    if (!sheet) {
      sheet = ss.insertSheet("P6_TRAILING_STOP_CHECKS");
      sheet.appendRow([
        "ticker",
        "market",
        "timestamp",
        "price",
        "ma10",
        "created_at"
      ]);
      sheet.hideSheet();
    }
    
    const now = new Date();
    sheet.appendRow([
      ticker,
      market,
      now,
      price,
      ma10,
      now
    ]);
    
    // 清理舊記錄（只保留最近 7 天的檢查記錄）
    const lastRow = sheet.getLastRow();
    if (lastRow > 100) { // 如果記錄超過 100 筆，清理舊記錄
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const dataRange = sheet.getRange(2, 3, lastRow - 1, 1); // timestamp 欄位
      const timestamps = dataRange.getValues();
      
      for (let i = timestamps.length - 1; i >= 0; i--) {
        const rowTimestamp = timestamps[i][0];
        if (rowTimestamp instanceof Date && rowTimestamp < sevenDaysAgo) {
          sheet.deleteRow(i + 2); // +2 因為從第 2 行開始
        }
      }
    }
    
  } catch (error) {
    Logger.log(`P6：保存移動停利檢查失敗（${ticker}）：${error.message}`);
  }
}

/**
 * 執行移動停利觸發後的緊急撤退
 * 
 * @param {Object} trigger - 移動停利觸發結果
 * @param {Object|Array} currentPositions - 當前持倉（從 P4 快照讀取）
 * @returns {Object} exitResult - 撤退結果
 */
function executeTrailingStopExit(trigger, currentPositions) {
  try {
    const exitConfig = P6_TRAILING_STOP_CONFIG.emergency_exit;
    
    // 如果 currentPositions 為 null，嘗試從 P4 快照讀取
    if (!currentPositions) {
      if (typeof getCurrentPositionsFromP4Snapshot === "function") {
        currentPositions = getCurrentPositionsFromP4Snapshot();
      } else if (typeof getLatestP4Snapshot === "function") {
        const p4Snapshot = getLatestP4Snapshot();
        currentPositions = p4Snapshot ? (p4Snapshot.allocations || []) : [];
      } else {
        Logger.log(`P6：無法獲取當前持倉，無法執行移動停利撤退`);
        return {
          success: false,
          error: "無法獲取當前持倉"
        };
      }
    }
    
    // 調用 P6 緊急撤退協議
    if (typeof P6_EmergencyExit_Intraday === "function") {
      const exitResult = P6_EmergencyExit_Intraday(
        exitConfig.trigger_type,
        {
          ticker: trigger.ticker,
          market: trigger.market,
          currentPrice: trigger.currentPrice,
          highestPrice: trigger.highestPrice,
          pullbackPct: trigger.pullbackPct,
          ma10: trigger.ma10,
          reason: trigger.reason,
          trailingStop: true // 標記為移動停利觸發
        },
        currentPositions
      );
      
      return exitResult;
    } else {
      Logger.log(`P6：P6_EmergencyExit_Intraday 函數未定義，無法執行移動停利撤退`);
      return {
        success: false,
        error: "P6_EmergencyExit_Intraday 函數未定義"
      };
    }
    
  } catch (error) {
    Logger.log(`P6：執行移動停利撤退失敗：${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}
