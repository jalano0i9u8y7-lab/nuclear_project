/**
 * 📊 P5 Daily: 財報策略監控（每日）
 * 
 * ⭐ V8.0 新增：Daily 僅監控，不做策略制定
 * - 讀取 Weekly 制定的 if-then 策略
 * - 監控策略條件是否觸發
 * - 如果條件觸發 → 通知使用者執行
 * 
 * @version SSOT V8.0
 * @date 2025-01-14
 */

// ==========================================
// P5 Daily 財報策略監控
// ==========================================

/**
 * 監控 Weekly 制定的財報策略條件
 * 
 * @param {Array} tickers - 股票代碼列表
 * @returns {Object} monitoringResult - 監控結果
 */
function monitorEarningsStrategiesFromWeekly(tickers) {
  try {
    Logger.log(`P5 Daily：開始監控財報策略（${tickers.length} 檔）`);
    
    const monitoringResult = {
      checked_strategies: 0,
      triggered_strategies: [],
      notifications: []
    };
    
    // 讀取所有活躍的財報策略
    const activeStrategies = getActiveEarningsStrategies(tickers);
    monitoringResult.checked_strategies = activeStrategies.length;
    
    Logger.log(`P5 Daily：找到 ${activeStrategies.length} 個活躍的財報策略`);
    
    // 為每個策略檢查條件
    for (const strategy of activeStrategies) {
      try {
        const checkResult = checkStrategyConditions(strategy);
        
        if (checkResult.triggered) {
          monitoringResult.triggered_strategies.push({
            strategy_id: strategy.strategy_id,
            ticker: strategy.ticker,
            triggered_conditions: checkResult.triggered_conditions,
            actions: checkResult.actions
          });
          
          // 生成通知
          const notification = generateEarningsStrategyNotification(strategy, checkResult);
          monitoringResult.notifications.push(notification);
          
          // 標記策略為已觸發
          markStrategyAsTriggered(strategy.strategy_id);
          
          // 發送通知（未來使用 GAS 原生 Line bot）
          sendEarningsStrategyNotification(notification);
        }
      } catch (error) {
        Logger.log(`P5 Daily：檢查策略 ${strategy.strategy_id} 失敗：${error.message}`);
      }
    }
    
    Logger.log(`P5 Daily：財報策略監控完成（觸發：${monitoringResult.triggered_strategies.length} 個）`);
    
    return monitoringResult;
    
  } catch (error) {
    Logger.log(`P5 Daily：監控財報策略失敗：${error.message}`);
    return { checked_strategies: 0, triggered_strategies: [], notifications: [] };
  }
}

/**
 * 獲取活躍的財報策略
 * 
 * @param {Array} tickers - 股票代碼列表
 * @returns {Array} strategies - 策略列表
 */
function getActiveEarningsStrategies(tickers) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("EARNINGS_STRATEGIES");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const strategyIdCol = headers.indexOf("strategy_id");
    const tickerCol = headers.indexOf("ticker");
    const statusCol = headers.indexOf("status");
    const conditionsCol = headers.indexOf("conditions_json");
    const earningsDateCol = headers.indexOf("earnings_date");
    const daysUntilCol = headers.indexOf("days_until");
    
    if (strategyIdCol === -1 || tickerCol === -1 || statusCol === -1) {
      return [];
    }
    
    const strategies = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 1; i < rows.length; i++) {
      const rowTicker = rows[i][tickerCol];
      const rowStatus = rows[i][statusCol];
      
      // 只處理活躍策略且屬於當前 tickers
      if (rowStatus === "ACTIVE" && tickers.includes(rowTicker)) {
        const earningsDate = new Date(rows[i][earningsDateCol]);
        const daysUntil = rows[i][daysUntilCol];
        
        // 檢查策略是否已過期（財報日期已過）
        if (earningsDate < today) {
          // 標記為過期
          markStrategyAsExpired(rows[i][strategyIdCol]);
          continue;
        }
        
        try {
          const conditions = JSON.parse(rows[i][conditionsCol] || "[]");
          
          strategies.push({
            strategy_id: rows[i][strategyIdCol],
            ticker: rowTicker,
            earnings_date: earningsDate,
            days_until: daysUntil,
            conditions: conditions,
            status: rowStatus
          });
        } catch (error) {
          Logger.log(`P5 Daily：解析策略條件失敗：${error.message}`);
        }
      }
    }
    
    return strategies;
    
  } catch (error) {
    Logger.log(`P5 Daily：獲取活躍策略失敗：${error.message}`);
    return [];
  }
}

/**
 * 檢查策略條件是否觸發
 * 
 * @param {Object} strategy - 策略對象
 * @returns {Object} checkResult - 檢查結果
 */
function checkStrategyConditions(strategy) {
  try {
    const { ticker, conditions } = strategy;
    
    // 獲取當前市場數據
    const currentMarketData = getCurrentMarketDataForTicker(ticker);
    
    const triggeredConditions = [];
    const actions = [];
    
    for (const condition of conditions || []) {
      let triggered = false;
      
      // 根據條件類型檢查
      if (condition.condition_type === "PRICE_BREAKDOWN") {
        // 檢查股價是否跌破條件價格
        const priceThreshold = extractPriceFromCondition(condition.if_condition);
        if (priceThreshold && currentMarketData.current_price < priceThreshold) {
          triggered = true;
        }
      } else if (condition.condition_type === "VOLUME_SPIKE") {
        // 檢查成交量是否超過條件
        const volumeThreshold = getVolumeMA(ticker, 20);
        if (volumeThreshold && currentMarketData.volume > volumeThreshold * 2) {
          triggered = true;
        }
      }
      
      if (triggered) {
        triggeredConditions.push(condition);
        actions.push({
          condition_id: condition.condition_id,
          action: condition.then_action,
          priority: condition.priority || "MEDIUM"
        });
      }
    }
    
    return {
      triggered: triggeredConditions.length > 0,
      triggered_conditions: triggeredConditions,
      actions: actions
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：檢查策略條件失敗：${error.message}`);
    return { triggered: false, triggered_conditions: [], actions: [] };
  }
}

/**
 * 從條件字符串中提取價格
 * 
 * @param {string} conditionStr - 條件字符串
 * @returns {number|null} price - 價格
 */
function extractPriceFromCondition(conditionStr) {
  try {
    // 簡單解析：尋找數字（價格）
    const match = conditionStr.match(/(\d+\.?\d*)/);
    if (match) {
      return parseFloat(match[1]);
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 獲取成交量移動平均
 * 
 * @param {string} ticker - 股票代碼
 * @param {number} period - 週期
 * @returns {number|null} volumeMA - 成交量移動平均
 */
function getVolumeMA(ticker, period) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const volumeCol = headers.indexOf("volume");
    const dateCol = headers.indexOf("date");
    
    if (tickerCol === -1 || volumeCol === -1) {
      return null;
    }
    
    // 找到該 ticker 最近 period 天的成交量
    const volumes = [];
    for (let i = rows.length - 1; i >= 1 && volumes.length < period; i--) {
      if (rows[i][tickerCol] === ticker) {
        const volume = parseFloat(rows[i][volumeCol]) || 0;
        volumes.push(volume);
      }
    }
    
    if (volumes.length === 0) {
      return null;
    }
    
    const sum = volumes.reduce((a, b) => a + b, 0);
    return sum / volumes.length;
    
  } catch (error) {
    Logger.log(`P5 Daily：獲取成交量移動平均失敗：${error.message}`);
    return null;
  }
}

/**
 * 生成財報策略通知
 * 
 * @param {Object} strategy - 策略對象
 * @param {Object} checkResult - 檢查結果
 * @returns {Object} notification - 通知對象
 */
function generateEarningsStrategyNotification(strategy, checkResult) {
  return {
    notification_id: `EARNINGS_NOTIF_${strategy.strategy_id}_${Date.now()}`,
    ticker: strategy.ticker,
    earnings_date: strategy.earnings_date,
    days_until: strategy.days_until,
    triggered_conditions: checkResult.triggered_conditions.map(c => c.if_condition),
    actions: checkResult.actions.map(a => a.action),
    priority: Math.max(...checkResult.actions.map(a => a.priority === "HIGH" ? 3 : (a.priority === "MEDIUM" ? 2 : 1))),
    message: `財報策略觸發：${strategy.ticker} 距離財報 ${strategy.days_until} 天，條件已觸發，建議執行：${checkResult.actions.map(a => a.action).join(", ")}`,
    timestamp: new Date()
  };
}

/**
 * 標記策略為已觸發
 * 
 * @param {string} strategyId - 策略 ID
 */
function markStrategyAsTriggered(strategyId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("EARNINGS_STRATEGIES");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const strategyIdCol = headers.indexOf("strategy_id");
    const statusCol = headers.indexOf("status");
    const triggeredAtCol = headers.indexOf("triggered_at");
    
    if (strategyIdCol === -1 || statusCol === -1) {
      return;
    }
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][strategyIdCol] === strategyId) {
        sheet.getRange(i + 1, statusCol + 1).setValue("TRIGGERED");
        if (triggeredAtCol !== -1) {
          sheet.getRange(i + 1, triggeredAtCol + 1).setValue(new Date());
        }
        break;
      }
    }
    
  } catch (error) {
    Logger.log(`P5 Daily：標記策略為已觸發失敗：${error.message}`);
  }
}

/**
 * 標記策略為已過期
 * 
 * @param {string} strategyId - 策略 ID
 */
function markStrategyAsExpired(strategyId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("EARNINGS_STRATEGIES");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const strategyIdCol = headers.indexOf("strategy_id");
    const statusCol = headers.indexOf("status");
    const expiredAtCol = headers.indexOf("expired_at");
    
    if (strategyIdCol === -1 || statusCol === -1) {
      return;
    }
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][strategyIdCol] === strategyId) {
        sheet.getRange(i + 1, statusCol + 1).setValue("EXPIRED");
        if (expiredAtCol !== -1) {
          sheet.getRange(i + 1, expiredAtCol + 1).setValue(new Date());
        }
        break;
      }
    }
    
  } catch (error) {
    Logger.log(`P5 Daily：標記策略為已過期失敗：${error.message}`);
  }
}

/**
 * 發送財報策略通知（未來使用 GAS 原生 Line bot）
 * 
 * @param {Object} notification - 通知對象
 */
function sendEarningsStrategyNotification(notification) {
  try {
    Logger.log(`P5 Daily：發送財報策略通知（${notification.ticker}，優先級：${notification.priority}）`);
    
    // TODO: 實現 GAS 原生 Line bot 通知
    // 目前僅記錄到日誌
    
    // 保存通知到表格（供 UI 顯示）
    saveNotificationToSheet(notification);
    
  } catch (error) {
    Logger.log(`P5 Daily：發送通知失敗：${error.message}`);
  }
}

/**
 * 保存通知到表格
 * 
 * @param {Object} notification - 通知對象
 */
function saveNotificationToSheet(notification) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("EARNINGS_NOTIFICATIONS");  // ⭐ V8.0 新增表格
    
    if (!sheet) {
      sheet = ss.insertSheet("EARNINGS_NOTIFICATIONS");
      sheet.appendRow([
        "notification_id",
        "ticker",
        "earnings_date",
        "days_until",
        "message",
        "priority",
        "triggered_conditions_json",
        "actions_json",
        "created_at",
        "read_at"
      ]);
      sheet.setFrozenRows(1);
    }
    
    sheet.appendRow([
      notification.notification_id,
      notification.ticker,
      notification.earnings_date,
      notification.days_until,
      notification.message,
      notification.priority,
      JSON.stringify(notification.triggered_conditions),
      JSON.stringify(notification.actions),
      notification.timestamp,
      null  // read_at
    ]);
    
  } catch (error) {
    Logger.log(`P5 Daily：保存通知失敗：${error.message}`);
  }
}
