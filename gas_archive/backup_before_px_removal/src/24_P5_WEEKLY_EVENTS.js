/**
 * 📊 P5 Weekly: 事件監控與策略制定模組 ⭐ V8.0 重構
 * 
 * ⭐ V8.0 變更：重新定義職責分工
 * - **每週職責（P5 Weekly）**：檢查未來 2 週財報日曆，制定 if-then 策略，將策略傳遞給 Daily 監控
 * - **每日職責（P5 Daily）**：不做策略制定，僅監控 Weekly 制定的策略條件，如果條件觸發 → 通知使用者執行
 * 
 * 負責事件監控與策略制定：
 * - 監控重大財經行事曆是否兩週內有事件
 * - 監控所有持股與觀察清單是否兩週內有財報公布或法會
 * - 按照該事件歷史經驗 + 目前世界財經背景，綜合分析對下一步持股策略調整的因子與權重
 * - 制定 if-then 策略（例如：if 股價跌破 X，then 減倉 Y%）
 * - 將策略傳遞給 Daily 監控
 * 
 * @version SSOT V8.0
 * @date 2025-01-14
 */

// ==========================================
// 事件監控配置
// ==========================================

const P5_WEEKLY_EVENTS_CONFIG = {
  // 掃描時間窗口
  SCAN_WINDOW_DAYS: 14,  // 掃描下兩週事件
  
  // 財報監控時間表（調整為 14/7/3/1 天）
  EARNINGS_MONITORING_SCHEDULE: {
    "14_DAYS_BEFORE": {
      days_before: 14,
      analysis_type: "MID_TERM",  // 中期籌碼面分析
      frequency: "WEEKLY",  // 每週 1 次
      focus: ["INSTITUTIONAL_HOLDINGS", "INSIDER_TRADING", "OPTIONS_FLOW"]
    },
    "7_DAYS_BEFORE": {
      days_before: 7,
      analysis_type: "SHORT_TERM",  // 短期籌碼面分析
      frequency: "WEEKLY_2X",  // 每週 2 次
      focus: ["OPTIONS_FLOW", "DARK_POOL", "INSTITUTIONAL_HOLDINGS"]
    },
    "3_DAYS_BEFORE": {
      days_before: 3,
      analysis_type: "INTENSIVE",  // 密集監控
      frequency: "DAILY",  // 每日 1 次
      focus: ["ALL_SIGNALS", "ANOMALY_DETECTION"]
    },
    "1_DAY_BEFORE": {
      days_before: 1,
      analysis_type: "REAL_TIME",  // 實時監控（實際為每日 4 次檢查）
      frequency: "4X_DAILY",  // 盤中 4 次檢查
      focus: ["PRICE_ACTION", "VOLUME_ANALYSIS", "OPTIONS_ACTIVITY"]
    }
  },
  
  // 事件類型
  EVENT_TYPES: {
    EARNINGS: "EARNINGS",           // 財報
    CONFERENCE: "CONFERENCE",       // 法說會
    MAJOR_EVENT: "MAJOR_EVENT",    // 重大事件
    FED_MEETING: "FED_MEETING",    // 聯準會會議
    CPI: "CPI",                    // CPI 數據
    NFP: "NFP"                     // 非農就業數據
  }
};

// ==========================================
// 事件掃描與觸發主函數
// ==========================================

/**
 * 掃描即將到來的事件並觸發相應監控
 * 
 * @param {Object} params - 參數
 * @param {Date} params.scanDate - 掃描日期
 * @param {Array} params.holdings - 持股列表
 * @param {Object} params.worldview - 世界觀分析結果
 * @returns {Object} events - 事件分析結果
 */
function scanUpcomingEventsAndTrigger(params) {
  try {
    Logger.log("P5 Weekly：開始掃描即將到來的事件");
    
    const {
      scanDate = new Date(),
      holdings = [],
      worldview = {}
    } = params;
    
    // ========================================
    // Step 1: 掃描重大財經行事曆（下兩週）
    // ⭐ V8.0 新增：同時觸發關鍵數據監控（10-14天前的事件）
    // ========================================
    
    const calendarEvents = P5_Calendar_ScanNextTwoWeeks(scanDate);
    
    // ⭐ V8.0 新增：為每個事件觸發關鍵數據監控（如果符合條件）
    if (typeof startEventKeyMetricsMonitoring === 'function') {
      for (const event of calendarEvents) {
        const eventDate = new Date(event.date_start);
        const today = new Date();
        const daysUntilEvent = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
        
        // 如果事件在 10-14 天內，觸發監控
        if (daysUntilEvent >= 10 && daysUntilEvent <= 14) {
          try {
            const monitoringResult = startEventKeyMetricsMonitoring(event.event_id, eventDate);
            event.monitoring_data = monitoringResult;  // 將監控數據附加到事件
            Logger.log(`P5 Weekly：事件 ${event.event_id} 關鍵數據監控已觸發（距離 ${daysUntilEvent} 天）`);
          } catch (e) {
            Logger.log(`P5 Weekly：觸發事件 ${event.event_id} 監控失敗：${e.message}`);
          }
        }
      }
    }
    
    // ========================================
    // Step 2: 識別持股相關的財報/法說會事件
    // ========================================
    
    const earningsEvents = identifyEarningsEvents(holdings, scanDate);
    
    // ========================================
    // Step 3: 合併所有事件
    // ========================================
    
    const allEvents = {
      calendar_events: calendarEvents,
      earnings_events: earningsEvents,
      upcoming_events: [...calendarEvents, ...earningsEvents]
    };
    
    // ========================================
    // Step 4: 分析事件影響
    // ========================================
    
    const eventImpact = analyzeEventImpact(allEvents, worldview);
    
    // ========================================
    // Step 5: 制定財報 if-then 策略（每週）⭐ V8.0 重構
    // ========================================
    
    const earningsStrategies = formulateEarningsStrategies(earningsEvents, scanDate, worldview);
    
    // ========================================
    // Step 6: 生成事件因子（用於個股策略調整）
    // ========================================
    
    const eventFactors = generateEventFactors(allEvents, eventImpact);
    
    return {
      status: "SUCCESS",
      upcoming_events: allEvents.upcoming_events,
      calendar_events: calendarEvents,
      earnings_events: earningsEvents,
      event_impact: eventImpact,
      earnings_strategies: earningsStrategies,  // ⭐ V8.0：改為策略列表（供 Daily 監控）
      event_factors: eventFactors,
      scan_date: scanDate.toISOString()
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：掃描即將到來的事件失敗：${error.message}`);
    throw error;
  }
}

/**
 * 識別持股相關的財報/法說會事件
 * 
 * @param {Array} holdings - 持股列表
 * @param {Date} scanDate - 掃描日期
 * @returns {Array} earningsEvents - 財報事件列表
 */
function identifyEarningsEvents(holdings, scanDate) {
  try {
    Logger.log(`P5 Weekly：識別 ${holdings.length} 檔持股的財報/法說會事件`);
    
    const earningsEvents = [];
    const scanWindowEnd = new Date(scanDate);
    scanWindowEnd.setDate(scanWindowEnd.getDate() + P5_WEEKLY_EVENTS_CONFIG.SCAN_WINDOW_DAYS);
    
    // 從 P5__CALENDAR 表格讀取事件
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__CALENDAR");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly：P5__CALENDAR 表格不存在或為空");
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const eventIdCol = headers.indexOf("event_id");
    const dateStartCol = headers.indexOf("date_start");
    const eventNameCol = headers.indexOf("event_name");
    const eventTypeCol = headers.indexOf("event_type");
    const marketCol = headers.indexOf("market");
    
    if (dateStartCol === -1) {
      return [];
    }
    
    // 找到與持股相關的事件
    for (let i = 1; i < rows.length; i++) {
      const eventDate = new Date(rows[i][dateStartCol]);
      if (eventDate >= scanDate && eventDate <= scanWindowEnd) {
        const eventType = rows[i][eventTypeCol];
        const eventName = rows[i][eventNameCol] || "";
        
        // 檢查是否為財報或法說會
        if (eventType === P5_WEEKLY_EVENTS_CONFIG.EVENT_TYPES.EARNINGS ||
            eventType === P5_WEEKLY_EVENTS_CONFIG.EVENT_TYPES.CONFERENCE) {
          
          // 嘗試從事件名稱中提取 ticker
          const ticker = extractTickerFromEventName(eventName, holdings);
          
          if (ticker) {
            const daysUntilEvent = Math.floor((eventDate - scanDate) / (1000 * 60 * 60 * 24));
            
            earningsEvents.push({
              event_id: rows[i][eventIdCol] || null,
              ticker: ticker,
              event_name: eventName,
              event_type: eventType,
              event_date: Utilities.formatDate(eventDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
              days_until_event: daysUntilEvent,
              market: rows[i][marketCol] || null,
              requires_monitoring: daysUntilEvent <= 14,  // 14 天內需要監控
              monitoring_schedule: getMonitoringSchedule(daysUntilEvent)
            });
          }
        }
      }
    }
    
    Logger.log(`P5 Weekly：找到 ${earningsEvents.length} 個持股相關的財報/法說會事件`);
    
    return earningsEvents;
    
  } catch (error) {
    Logger.log(`P5 Weekly：識別財報事件失敗：${error.message}`);
    return [];
  }
}

/**
 * 從事件名稱中提取 ticker
 * 
 * @param {string} eventName - 事件名稱
 * @param {Array} holdings - 持股列表
 * @returns {string|null} ticker - 股票代碼
 */
function extractTickerFromEventName(eventName, holdings) {
  if (!eventName) {
    return null;
  }
  
  // 嘗試從事件名稱中匹配持股
  for (const ticker of holdings) {
    // 移除可能的後綴（如 .US, .TW）
    const tickerBase = ticker.replace(/\.(US|TW|JP)$/i, "");
    
    // 檢查事件名稱是否包含 ticker
    if (eventName.toUpperCase().includes(tickerBase.toUpperCase()) ||
        eventName.toUpperCase().includes(ticker.toUpperCase())) {
      return ticker;
    }
  }
  
  return null;
}

/**
 * 獲取監控時間表
 * 
 * @param {number} daysUntilEvent - 距離事件天數
 * @returns {Object|null} schedule - 監控時間表
 */
function getMonitoringSchedule(daysUntilEvent) {
  const schedule = P5_WEEKLY_EVENTS_CONFIG.EARNINGS_MONITORING_SCHEDULE;
  
  if (daysUntilEvent <= 1) {
    return schedule["1_DAY_BEFORE"];
  } else if (daysUntilEvent <= 3) {
    return schedule["3_DAYS_BEFORE"];
  } else if (daysUntilEvent <= 7) {
    return schedule["7_DAYS_BEFORE"];
  } else if (daysUntilEvent <= 14) {
    return schedule["14_DAYS_BEFORE"];
  }
  
  return null;
}

/**
 * 分析事件影響
 * 
 * @param {Object} events - 所有事件
 * @param {Object} worldview - 世界觀分析結果
 * @returns {Object} impact - 事件影響分析
 */
function analyzeEventImpact(events, worldview) {
  try {
    // 簡化實現：基本影響分析
    // 實際應該結合歷史經驗和世界觀進行 AI 分析
    
    const impact = {
      high_impact_events: [],
      medium_impact_events: [],
      low_impact_events: [],
      overall_impact: "NEUTRAL",  // POSITIVE/NEGATIVE/NEUTRAL
      impact_analysis: "需要 AI 分析"
    };
    
    // 分類事件
    for (const event of events.upcoming_events || []) {
      const daysUntil = event.days_until_event || 0;
      const eventType = event.event_type || "";
      
      // 根據距離和類型判斷影響
      if (daysUntil <= 3 && eventType === P5_WEEKLY_EVENTS_CONFIG.EVENT_TYPES.EARNINGS) {
        impact.high_impact_events.push(event);
      } else if (daysUntil <= 7) {
        impact.medium_impact_events.push(event);
      } else {
        impact.low_impact_events.push(event);
      }
    }
    
    return impact;
    
  } catch (error) {
    Logger.log(`P5 Weekly：分析事件影響失敗：${error.message}`);
    return {};
  }
}

/**
 * 制定財報 if-then 策略（每週）⭐ V8.0 重構：Weekly 制定策略，Daily 監控
 * 
 * @param {Array} earningsEvents - 財報事件列表
 * @param {Date} scanDate - 掃描日期
 * @param {Object} worldview - 世界觀分析結果
 * @returns {Object} strategies - 制定的策略列表
 */
function formulateEarningsStrategies(earningsEvents, scanDate, worldview) {
  try {
    Logger.log(`P5 Weekly：開始制定財報 if-then 策略（${earningsEvents.length} 個事件）`);
    
    const strategies = {
      strategies_count: 0,
      strategies_list: []
    };
    
    for (const event of earningsEvents) {
      const daysUntil = event.days_until_event || 0;
      const ticker = event.ticker;
      
      // 僅為未來 2 週內的事件制定策略
      if (daysUntil > 14 || daysUntil < 0) {
        continue;
      }
      
      Logger.log(`P5 Weekly：為 ${ticker} 制定財報策略（距離財報 ${daysUntil} 天）`);
      
      try {
        // 制定 if-then 策略
        const strategy = formulateIfThenStrategyForEarnings({
          ticker: ticker,
          earnings_date: event.event_date,
          days_until: daysUntil,
          worldview: worldview,
          event: event
        });
        
        if (strategy) {
          strategies.strategies_list.push(strategy);
          strategies.strategies_count++;
          
          // 保存策略到表格，供 Daily 監控使用
          saveEarningsStrategyToSheet(strategy);
        }
        
      } catch (error) {
        Logger.log(`P5 Weekly：為 ${ticker} 制定策略失敗：${error.message}`);
      }
    }
    
    Logger.log(`P5 Weekly：財報策略制定完成（${strategies.strategies_count} 個策略）`);
    
    return strategies;
    
  } catch (error) {
    Logger.log(`P5 Weekly：制定財報策略失敗：${error.message}`);
    return { strategies_count: 0, strategies_list: [] };
  }
}

/**
 * 為單個財報事件制定 if-then 策略
 * 
 * @param {Object} params - 參數
 * @param {string} params.ticker - 股票代碼
 * @param {string} params.earnings_date - 財報日期
 * @param {number} params.days_until - 距離財報天數
 * @param {Object} params.worldview - 世界觀分析結果
 * @param {Object} params.event - 事件信息
 * @returns {Object} strategy - if-then 策略
 */
function formulateIfThenStrategyForEarnings(params) {
  try {
    const { ticker, earnings_date, days_until, worldview, event } = params;
    
    // 讀取歷史財報表現和當前市場狀態
    const historicalAnalysis = analyzeHistoricalEarnings(ticker);
    const currentMarketData = getCurrentMarketDataForTicker(ticker);
    
    // 構建 if-then 策略
    const strategy = {
      strategy_id: `EARNINGS_STRATEGY_${ticker}_${earnings_date}_${Date.now()}`,
      ticker: ticker,
      earnings_date: earnings_date,
      days_until: days_until,
      created_at: new Date(),
      status: "ACTIVE",  // ACTIVE / TRIGGERED / EXPIRED
      
      // if-then 條件列表
      conditions: [],
      
      // 策略說明
      reasoning: `基於歷史表現（Beat Rate: ${historicalAnalysis.beat_rate}）和當前市場狀態制定的策略`
    };
    
    // 根據距離財報天數制定不同策略
    if (days_until <= 3) {
      // 3 天內：密集監控策略
      strategy.conditions.push({
        condition_id: "COND_1",
        condition_type: "PRICE_BREAKDOWN",
        if_condition: `股價跌破 ${currentMarketData.current_price * 0.95}（-5%）`,
        then_action: "REDUCE_POSITION_30PCT",
        priority: "HIGH"
      });
      
      strategy.conditions.push({
        condition_id: "COND_2",
        condition_type: "VOLUME_SPIKE",
        if_condition: "成交量超過 20 日均量 2 倍",
        then_action: "ALERT_USER",
        priority: "MEDIUM"
      });
    } else if (days_until <= 7) {
      // 7 天內：短期策略
      strategy.conditions.push({
        condition_id: "COND_1",
        condition_type: "PRICE_BREAKDOWN",
        if_condition: `股價跌破 ${currentMarketData.current_price * 0.92}（-8%）`,
        then_action: "REDUCE_POSITION_20PCT",
        priority: "MEDIUM"
      });
    } else if (days_until <= 14) {
      // 14 天內：中期策略
      strategy.conditions.push({
        condition_id: "COND_1",
        condition_type: "PRICE_BREAKDOWN",
        if_condition: `股價跌破 ${currentMarketData.current_price * 0.90}（-10%）`,
        then_action: "REDUCE_POSITION_10PCT",
        priority: "LOW"
      });
    }
    
    // 根據歷史表現調整策略
    if (historicalAnalysis.recent_trend === "NEGATIVE") {
      // 最近財報表現不佳，策略更保守
      strategy.conditions.forEach(cond => {
        if (cond.then_action.includes("REDUCE")) {
          // 增加減倉比例
          cond.then_action = cond.then_action.replace(/\d+PCT/, (match) => {
            const currentPct = parseInt(match);
            return `${currentPct + 10}PCT`;
          });
        }
      });
    }
    
    return strategy;
    
  } catch (error) {
    Logger.log(`P5 Weekly：制定 ${params.ticker} 財報策略失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存財報策略到表格（供 Daily 監控使用）
 * 
 * @param {Object} strategy - 策略對象
 */
function saveEarningsStrategyToSheet(strategy) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("EARNINGS_STRATEGIES");  // ⭐ V8.0 新增表格
    
    if (!sheet) {
      sheet = ss.insertSheet("EARNINGS_STRATEGIES");
      sheet.appendRow([
        "strategy_id",
        "ticker",
        "earnings_date",
        "days_until",
        "status",
        "conditions_json",
        "reasoning",
        "created_at",
        "triggered_at",
        "expired_at"
      ]);
      sheet.setFrozenRows(1);
    }
    
    // 檢查是否已存在相同策略
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const strategyIdCol = rows[0].indexOf("strategy_id");
    
    let foundRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][strategyIdCol] === strategy.strategy_id) {
        foundRow = i + 1;
        break;
      }
    }
    
    const row = [
      strategy.strategy_id,
      strategy.ticker,
      strategy.earnings_date,
      strategy.days_until,
      strategy.status,
      JSON.stringify(strategy.conditions),
      strategy.reasoning,
      strategy.created_at,
      null,  // triggered_at
      null   // expired_at
    ];
    
    if (foundRow > 0) {
      // 更新現有策略
      sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
    } else {
      // 新增策略
      sheet.appendRow(row);
    }
    
    Logger.log(`P5 Weekly：財報策略已保存（${strategy.ticker}，${strategy.strategy_id}）`);
    
  } catch (error) {
    Logger.log(`P5 Weekly：保存財報策略失敗：${error.message}`);
  }
}

/**
 * 獲取當前市場數據（用於制定策略）
 * 
 * @param {string} ticker - 股票代碼
 * @returns {Object} marketData - 市場數據
 */
function getCurrentMarketDataForTicker(ticker) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { current_price: 0, volume: 0 };
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const closeCol = headers.indexOf("close");
    const volumeCol = headers.indexOf("volume");
    const dateCol = headers.indexOf("date");
    
    if (tickerCol === -1 || closeCol === -1) {
      return { current_price: 0, volume: 0 };
    }
    
    // 找到該 ticker 的最新數據
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rows[i][tickerCol] === ticker) {
        return {
          current_price: parseFloat(rows[i][closeCol]) || 0,
          volume: parseFloat(rows[i][volumeCol]) || 0,
          date: rows[i][dateCol]
        };
      }
    }
    
    return { current_price: 0, volume: 0 };
    
  } catch (error) {
    Logger.log(`P5 Weekly：獲取 ${ticker} 市場數據失敗：${error.message}`);
    return { current_price: 0, volume: 0 };
  }
}

/**
 * 觸發財報監控（14/7/3/1 天）⚠️ V8.0 已廢棄：改為制定策略
 * 
 * @deprecated 此函數已由 formulateEarningsStrategies 取代
 * @param {Array} earningsEvents - 財報事件列表
 * @param {Date} scanDate - 掃描日期
 * @returns {Object} monitoring - 觸發的監控結果
 */
function triggerEarningsMonitoring(earningsEvents, scanDate) {
  Logger.log(`P5 Weekly：警告 - triggerEarningsMonitoring 已廢棄，請使用 formulateEarningsStrategies`);
  return { triggered_count: 0, monitoring_results: {} };
}

/**
 * 生成事件因子（用於個股策略調整）
 * 
 * @param {Object} events - 所有事件
 * @param {Object} eventImpact - 事件影響分析
 * @returns {Object} factors - 事件因子
 */
function generateEventFactors(events, eventImpact) {
  try {
    const factors = {};
    
    // 為每個持股生成事件因子
    const tickerEvents = {};
    
    for (const event of events.upcoming_events || []) {
      const ticker = event.ticker;
      if (ticker) {
        if (!tickerEvents[ticker]) {
          tickerEvents[ticker] = [];
        }
        tickerEvents[ticker].push(event);
      }
    }
    
    // 計算每檔股票的事件因子
    for (const ticker in tickerEvents) {
      const tickerEventList = tickerEvents[ticker];
      
      // 計算綜合事件因子（-1 到 1）
      let totalFactor = 0;
      for (const event of tickerEventList) {
        const daysUntil = event.days_until_event || 0;
        const eventType = event.event_type || "";
        
        // 距離越近，影響越大
        const timeWeight = daysUntil <= 1 ? 1.0 : (daysUntil <= 3 ? 0.8 : (daysUntil <= 7 ? 0.5 : 0.3));
        
        // 事件類型影響（財報通常為負面風險）
        const eventTypeWeight = eventType === P5_WEEKLY_EVENTS_CONFIG.EVENT_TYPES.EARNINGS ? -0.3 : 0.1;
        
        totalFactor += timeWeight * eventTypeWeight;
      }
      
      // 歸一化到 -1 到 1
      factors[ticker] = Math.max(-1, Math.min(1, totalFactor));
    }
    
    return factors;
    
  } catch (error) {
    Logger.log(`P5 Weekly：生成事件因子失敗：${error.message}`);
    return {};
  }
}
