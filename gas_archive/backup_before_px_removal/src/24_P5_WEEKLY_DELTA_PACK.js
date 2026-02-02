/**
 * 📦 P5 Weekly Delta Pack（變動摘要）模組 ⭐ V8.17 新增
 * 
 * 實現 Delta Pack 設計，只包含「必要的變動」，而非完整資料
 * 用於優化 P5 Weekly 的 Token 使用量
 * 
 * @version SSOT V8.17
 * @date 2026-01-19
 */

// ==========================================
// Delta Pack 配置（閾值定義）
// ==========================================

// ⭐ V8.19 M2 新增：關鍵訊號列表（無論是否有變動都必須包含）
const CRITICAL_SIGNALS = [
  "p0_7_time_position",
  "p0_7_turning_point_risk",
  "p2_5_insider_selling_alert",
  "p2_5_abnormal_13f_distribution",
  "vix",
  "defcon_level",
  "market_regime"
];

const DELTA_PACK_CONFIG = {
  // 市場層級變動閾值
  MARKET_LEVEL: {
    SECTOR_ETF_FLOW_CHANGE_THRESHOLD: 0.05,  // 5%
    REGIME_CHANGE: true,  // 任何 Regime 轉換都記錄
    MACRO_EVENTS: ["FOMC", "CPI", "NFP", "EARNINGS_SEASON"]  // 重大宏觀事件
  },
  
  // 板塊層級變動閾值
  SECTOR_LEVEL: {
    SECTOR_FLOW_CHANGE_THRESHOLD: 0.10,  // 10%
    SECTOR_EARNINGS: true,  // 板塊龍頭財報
    NEWS_SEVERITY_CHANGE_THRESHOLD: 1  // 新聞索引嚴重度變化（級別）
  },
  
  // 個股層級變動閾值
  STOCK_LEVEL: {
    PRICE_CHANGE_THRESHOLD: 0.08,  // 8%
    TECHNICAL_INDICATOR_CHANGE_THRESHOLD: 0.15,  // 15%
    NEWS_HIGH_SEVERITY: true,  // 高嚴重度新聞事件
    P2_5_ALERTS: true,  // P2.5 警報
    P0_7_RISK_CHANGE: true  // P0.7 轉折風險變化
  }
};

// ==========================================
// Delta Pack 構建函數
// ==========================================

/**
 * 構建 Delta Pack（變動摘要）
 * 
 * @param {string} ticker - 股票代號
 * @param {Object} currentData - 當前數據（stockData）
 * @param {Object} previousSnapshot - 上週快照
 * @param {Object} context - 上下文數據
 * @returns {Object} Delta Pack 物件
 */
function buildDeltaPack(ticker, currentData, previousSnapshot, context) {
  try {
    const delta = {
      ticker: ticker,
      timestamp: new Date().toISOString(),
      market_level: buildMarketLevelDelta(currentData, previousSnapshot, context),
      sector_level: buildSectorLevelDelta(ticker, currentData, previousSnapshot, context),
      stock_level: buildStockLevelDelta(ticker, currentData, previousSnapshot, context),
      change_reason_index: [],
      auto_generated_flags: []
    };
    
    // 生成變動原因索引
    delta.change_reason_index = generateChangeReasonIndex(delta);
    
    // 生成自動標記
    delta.auto_generated_flags = generateAutoFlags(delta);
    
    return delta;
    
  } catch (error) {
    Logger.log(`構建 Delta Pack 失敗（${ticker}）：${error.message}`);
    return {
      ticker: ticker,
      timestamp: new Date().toISOString(),
      error: error.message,
      market_level: {},
      sector_level: {},
      stock_level: {},
      change_reason_index: [],
      auto_generated_flags: []
    };
  }
}

/**
 * 構建市場層級變動
 */
function buildMarketLevelDelta(currentData, previousSnapshot, context) {
  const delta = {};
  
  // ⭐ V8.19 M2 新增：關鍵訊號始終包含（無論是否有變動）
  const currentRegime = context.worldview?.regime || null;
  const previousRegime = previousSnapshot?.worldview?.regime || null;
  const currentVIX = context.macro_data?.vix || context.macro_weekly_metrics?.vix || null;
  const previousVIX = previousSnapshot?.macro_data?.vix || previousSnapshot?.macro_weekly_metrics?.vix || null;
  const currentDefcon = context.defcon_level || null;
  const previousDefcon = previousSnapshot?.defcon_level || null;
  
  // VIX（關鍵訊號，始終包含）
  delta.vix = {
    current: currentVIX,
    previous: previousVIX,
    changed: currentVIX !== previousVIX,
    status: currentVIX !== previousVIX ? "CHANGED" : "UNCHANGED"
  };
  
  // Market Regime（關鍵訊號，始終包含）
  delta.market_regime = {
    current: currentRegime,
    previous: previousRegime,
    changed: currentRegime !== previousRegime,
    status: currentRegime !== previousRegime ? "CHANGED" : "UNCHANGED"
  };
  
  // Defcon Level（關鍵訊號，始終包含）
  delta.defcon_level = {
    current: currentDefcon,
    previous: previousDefcon,
    changed: currentDefcon !== previousDefcon,
    status: currentDefcon !== previousDefcon ? "CHANGED" : "UNCHANGED"
  };
  
  // Sector ETF Flow 變化
  const currentSectorFlow = context.macro_flow_context?.sector_etf_flow || null;
  const previousSectorFlow = previousSnapshot?.macro_flow_context?.sector_etf_flow || null;
  
  if (currentSectorFlow && previousSectorFlow) {
    const flowChange = Math.abs((currentSectorFlow.weekly_flow_usd - previousSectorFlow.weekly_flow_usd) / 
      Math.abs(previousSectorFlow.weekly_flow_usd || 1));
    
    if (flowChange > DELTA_PACK_CONFIG.MARKET_LEVEL.SECTOR_ETF_FLOW_CHANGE_THRESHOLD) {
      delta.sector_flow_change = {
        change_percent: flowChange,
        current_flow: currentSectorFlow.weekly_flow_usd,
        previous_flow: previousSectorFlow.weekly_flow_usd,
        trend: currentSectorFlow.trend
      };
    }
  }
  
  // Regime 轉換（已在上面處理，這裡只記錄轉換類型）
  if (currentRegime && previousRegime && currentRegime !== previousRegime) {
    delta.regime_change = {
      from: previousRegime,
      to: currentRegime,
      transition_type: detectRegimeTransitionType(previousRegime, currentRegime)
    };
  }
  
  // 重大宏觀事件
  const macroEvents = extractMacroEvents(context);
  if (macroEvents.length > 0) {
    delta.macro_events = macroEvents;
  }
  
  return delta;
}

/**
 * 構建板塊層級變動
 */
function buildSectorLevelDelta(ticker, currentData, previousSnapshot, context) {
  const delta = {};
  
  // 獲取股票所屬板塊
  const sector = currentData.p2_data?.sector || currentData.p1_data?.sector || null;
  if (!sector) return delta;
  
  // 板塊資金流變化
  const currentSectorFlow = context.macro_flow_context?.sector_flows?.[sector] || null;
  const previousSectorFlow = previousSnapshot?.macro_flow_context?.sector_flows?.[sector] || null;
  
  if (currentSectorFlow && previousSectorFlow) {
    const flowChange = Math.abs((currentSectorFlow.weekly_flow_usd - previousSectorFlow.weekly_flow_usd) / 
      Math.abs(previousSectorFlow.weekly_flow_usd || 1));
    
    if (flowChange > DELTA_PACK_CONFIG.SECTOR_LEVEL.SECTOR_FLOW_CHANGE_THRESHOLD) {
      delta.sector_flow_change = {
        sector: sector,
        change_percent: flowChange,
        current_flow: currentSectorFlow.weekly_flow_usd,
        previous_flow: previousSectorFlow.weekly_flow_usd
      };
    }
  }
  
  // 板塊龍頭財報
  const sectorEarnings = extractSectorEarnings(sector, context);
  if (sectorEarnings.length > 0) {
    delta.sector_earnings = sectorEarnings;
  }
  
  // 板塊新聞索引嚴重度變化
  const currentNewsSeverity = context.sector_news_index?.[sector]?.severity || null;
  const previousNewsSeverity = previousSnapshot?.sector_news_index?.[sector]?.severity || null;
  
  if (currentNewsSeverity !== null && previousNewsSeverity !== null) {
    const severityChange = currentNewsSeverity - previousNewsSeverity;
    if (Math.abs(severityChange) >= DELTA_PACK_CONFIG.SECTOR_LEVEL.NEWS_SEVERITY_CHANGE_THRESHOLD) {
      delta.news_severity_change = {
        sector: sector,
        change: severityChange,
        current_severity: currentNewsSeverity,
        previous_severity: previousNewsSeverity
      };
    }
  }
  
  return delta;
}

/**
 * 構建個股層級變動
 */
function buildStockLevelDelta(ticker, currentData, previousSnapshot, context) {
  const delta = {};
  
  // ⭐ V8.19 M2 新增：關鍵訊號始終包含（無論是否有變動）
  const currentP0_7TimePosition = context.p0_7_snapshot?.time_position || null;
  const previousP0_7TimePosition = previousSnapshot?.p0_7_snapshot?.time_position || null;
  const currentP0_7Risk = context.p0_7_snapshot?.turning_point_risk || null;
  const previousP0_7Risk = previousSnapshot?.p0_7_snapshot?.turning_point_risk || null;
  const currentP2_5Insider = currentData.p2_5_data?.insider_selling_alert || false;
  const previousP2_5Insider = previousSnapshot?.p2_5_data?.[ticker]?.insider_selling_alert || false;
  const currentP2_5Abnormal = currentData.p2_5_data?.abnormal_13f_distribution || false;
  const previousP2_5Abnormal = previousSnapshot?.p2_5_data?.[ticker]?.abnormal_13f_distribution || false;
  
  // P0.7 Time Position（關鍵訊號，始終包含）
  delta.p0_7_time_position = {
    current: currentP0_7TimePosition,
    previous: previousP0_7TimePosition,
    changed: currentP0_7TimePosition !== previousP0_7TimePosition,
    status: currentP0_7TimePosition !== previousP0_7TimePosition ? "CHANGED" : "UNCHANGED"
  };
  
  // P0.7 Turning Point Risk（關鍵訊號，始終包含）
  delta.p0_7_turning_point_risk = {
    current: currentP0_7Risk,
    previous: previousP0_7Risk,
    changed: currentP0_7Risk !== previousP0_7Risk,
    status: currentP0_7Risk !== previousP0_7Risk ? "CHANGED" : "UNCHANGED"
  };
  
  // P2.5 Insider Selling Alert（關鍵訊號，始終包含）
  delta.p2_5_insider_selling_alert = {
    current: currentP2_5Insider,
    previous: previousP2_5Insider,
    changed: currentP2_5Insider !== previousP2_5Insider,
    status: currentP2_5Insider !== previousP2_5Insider ? "CHANGED" : "UNCHANGED"
  };
  
  // P2.5 Abnormal 13F Distribution（關鍵訊號，始終包含）
  delta.p2_5_abnormal_13f_distribution = {
    current: currentP2_5Abnormal,
    previous: previousP2_5Abnormal,
    changed: currentP2_5Abnormal !== previousP2_5Abnormal,
    status: currentP2_5Abnormal !== previousP2_5Abnormal ? "CHANGED" : "UNCHANGED"
  };
  
  // 價格變化
  const currentPrice = currentData.daily_ohlcv?.close || null;
  const previousPrice = previousSnapshot?.daily_ohlcv?.[ticker]?.close || 
    previousSnapshot?.technical_results?.[ticker]?.current_price || null;
  
  if (currentPrice && previousPrice) {
    const priceChange = (currentPrice - previousPrice) / previousPrice;
    if (Math.abs(priceChange) > DELTA_PACK_CONFIG.STOCK_LEVEL.PRICE_CHANGE_THRESHOLD) {
      delta.price_change = {
        change_percent: priceChange,
        current_price: currentPrice,
        previous_price: previousPrice
      };
    }
  }
  
  // 技術指標變化
  const technicalChanges = calculateTechnicalIndicatorChanges(ticker, currentData, previousSnapshot);
  if (Object.keys(technicalChanges).length > 0) {
    delta.technical_indicator_changes = technicalChanges;
  }
  
  // 高嚴重度新聞事件
  const highSeverityNews = extractHighSeverityNews(ticker, context);
  if (highSeverityNews.length > 0) {
    delta.news_events = highSeverityNews;
  }
  
  // P2.5 警報（已在上面處理，這裡只記錄其他警報）
  const p2_5Alerts = extractP2_5Alerts(ticker, context);
  if (p2_5Alerts.length > 0) {
    delta.p2_5_alerts = p2_5Alerts;
  }
  
  // P0.7 轉折風險變化（已在上面處理，這裡只記錄其他變化）
  const p0_7RiskChange = detectP0_7RiskChange(ticker, currentData, previousSnapshot, context);
  if (p0_7RiskChange && p0_7RiskChange.type !== "turning_point_risk") {
    delta.p0_7_risk_change = p0_7RiskChange;
  }
  
  return delta;
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 生成變動原因索引
 */
function generateChangeReasonIndex(delta) {
  const reasons = [];
  
  if (delta.market_level.regime_change) {
    reasons.push("MARKET_REGIME_CHANGE");
  }
  if (delta.market_level.sector_flow_change) {
    reasons.push("MARKET_SECTOR_FLOW_CHANGE");
  }
  if (delta.market_level.macro_events && delta.market_level.macro_events.length > 0) {
    reasons.push("MARKET_MACRO_EVENTS");
  }
  
  if (delta.sector_level.sector_flow_change) {
    reasons.push("SECTOR_FLOW_CHANGE");
  }
  if (delta.sector_level.sector_earnings && delta.sector_level.sector_earnings.length > 0) {
    reasons.push("SECTOR_EARNINGS");
  }
  if (delta.sector_level.news_severity_change) {
    reasons.push("SECTOR_NEWS_SEVERITY_CHANGE");
  }
  
  if (delta.stock_level.price_change) {
    reasons.push("STOCK_PRICE_CHANGE");
  }
  if (delta.stock_level.technical_indicator_changes && Object.keys(delta.stock_level.technical_indicator_changes).length > 0) {
    reasons.push("STOCK_TECHNICAL_CHANGE");
  }
  if (delta.stock_level.news_events && delta.stock_level.news_events.length > 0) {
    reasons.push("STOCK_NEWS_EVENTS");
  }
  if (delta.stock_level.p2_5_alerts && delta.stock_level.p2_5_alerts.length > 0) {
    reasons.push("STOCK_P2_5_ALERTS");
  }
  if (delta.stock_level.p0_7_risk_change) {
    reasons.push("STOCK_P0_7_RISK_CHANGE");
  }
  
  return reasons;
}

/**
 * 生成自動標記
 */
function generateAutoFlags(delta) {
  const flags = [];
  
  // 市場層級標記
  if (delta.market_level.regime_change) {
    flags.push("MARKET_REGIME_TRANSITION");
  }
  if (delta.market_level.macro_events && delta.market_level.macro_events.length > 0) {
    flags.push("MARKET_MACRO_EVENT_WEEK");
  }
  
  // 板塊層級標記
  if (delta.sector_level.sector_earnings && delta.sector_level.sector_earnings.length > 0) {
    flags.push("SECTOR_EARNINGS_WEEK");
  }
  
  // 個股層級標記
  if (delta.stock_level.price_change && Math.abs(delta.stock_level.price_change.change_percent) > 0.15) {
    flags.push("STOCK_LARGE_PRICE_MOVE");
  }
  if (delta.stock_level.p2_5_alerts && delta.stock_level.p2_5_alerts.length > 0) {
    flags.push("STOCK_P2_5_ALERT");
  }
  if (delta.stock_level.p0_7_risk_change && delta.stock_level.p0_7_risk_change.risk_level === "HIGH") {
    flags.push("STOCK_HIGH_P0_7_RISK");
  }
  
  return flags;
}

/**
 * 計算技術指標變化
 */
function calculateTechnicalIndicatorChanges(ticker, currentData, previousSnapshot) {
  const changes = {};
  const threshold = DELTA_PACK_CONFIG.STOCK_LEVEL.TECHNICAL_INDICATOR_CHANGE_THRESHOLD;
  
  const currentTechnical = currentData.daily_technical || {};
  const previousTechnical = previousSnapshot?.technical_results?.[ticker]?.technical_indicators || {};
  
  // 檢查主要技術指標
  const indicators = ["atr", "rsi", "macd", "volume_ratio"];
  
  for (const indicator of indicators) {
    const current = currentTechnical[indicator];
    const previous = previousTechnical[indicator];
    
    if (current !== null && current !== undefined && 
        previous !== null && previous !== undefined) {
      const change = Math.abs((current - previous) / Math.abs(previous || 1));
      
      if (change > threshold) {
        changes[indicator] = {
          change_percent: change,
          current_value: current,
          previous_value: previous
        };
      }
    }
  }
  
  return changes;
}

/**
 * 提取高嚴重度新聞
 */
function extractHighSeverityNews(ticker, context) {
  const news = [];
  
  const stockNewsIndex = context.stock_news_index?.[ticker] || [];
  
  for (const newsItem of stockNewsIndex) {
    if (newsItem.severity >= 3) {  // 高嚴重度（3 或以上）
      news.push({
        title: newsItem.title,
        severity: newsItem.severity,
        tags: newsItem.tags || [],
        timestamp: newsItem.timestamp
      });
    }
  }
  
  return news;
}

/**
 * 提取 P2.5 警報
 */
function extractP2_5Alerts(ticker, context) {
  const alerts = [];
  
  const p2_5Data = context.p2_5_snapshot?.p2_5_output_json?.[ticker] || 
    context.p2_5_data?.[ticker] || {};
  
  if (p2_5Data.insider_selling_alert === true) {
    alerts.push({
      type: "INSIDER_SELLING",
      severity: "HIGH",
      evidence: p2_5Data.insider_selling_evidence || null
    });
  }
  
  if (p2_5Data.abnormal_13f_distribution === true) {
    alerts.push({
      type: "ABNORMAL_13F",
      severity: "HIGH",
      evidence: p2_5Data.abnormal_13f_evidence || null
    });
  }
  
  return alerts;
}

/**
 * 檢測 P0.7 轉折風險變化
 */
function detectP0_7RiskChange(ticker, currentData, previousSnapshot, context) {
  const currentP0_7 = context.p0_7_snapshot?.p0_7_output_json || {};
  const previousP0_7 = previousSnapshot?.p0_7_snapshot?.p0_7_output_json || {};
  
  const currentRisk = currentP0_7.turning_point_risk || null;
  const previousRisk = previousP0_7.turning_point_risk || null;
  
  if (currentRisk && previousRisk && currentRisk !== previousRisk) {
    return {
      risk_level: currentRisk,
      previous_risk_level: previousRisk,
      change_type: currentRisk === "HIGH" ? "RISK_INCREASE" : "RISK_DECREASE"
    };
  }
  
  return null;
}

/**
 * 提取宏觀事件
 */
function extractMacroEvents(context) {
  const events = [];
  
  const calendar = context.p5_calendar || [];
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 7);
  
  for (const event of calendar) {
    const eventDate = new Date(event.date_start || event.date_estimated);
    
    if (eventDate >= weekStart && eventDate <= today) {
      const eventType = event.event_type || "";
      if (DELTA_PACK_CONFIG.MARKET_LEVEL.MACRO_EVENTS.includes(eventType)) {
        events.push({
          type: eventType,
          date: eventDate.toISOString(),
          description: event.description || ""
        });
      }
    }
  }
  
  return events;
}

/**
 * 提取板塊財報
 */
function extractSectorEarnings(sector, context) {
  const earnings = [];
  
  const calendar = context.p5_calendar || [];
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 7);
  
  for (const event of calendar) {
    if (event.event_type === "EARNINGS" && event.sector === sector) {
      const eventDate = new Date(event.date_start || event.date_estimated);
      
      if (eventDate >= weekStart && eventDate <= today) {
        earnings.push({
          ticker: event.ticker,
          date: eventDate.toISOString(),
          description: event.description || ""
        });
      }
    }
  }
  
  return earnings;
}

/**
 * 檢測 Regime 轉換類型
 */
function detectRegimeTransitionType(fromRegime, toRegime) {
  const transitions = {
    "RISK_ON": { "RISK_OFF": "RISK_OFF_TRANSITION", "NEUTRAL": "RISK_REDUCTION" },
    "RISK_OFF": { "RISK_ON": "RISK_ON_TRANSITION", "NEUTRAL": "RISK_REDUCTION" },
    "NEUTRAL": { "RISK_ON": "RISK_ON_TRANSITION", "RISK_OFF": "RISK_OFF_TRANSITION" }
  };
  
  return transitions[fromRegime]?.[toRegime] || "UNKNOWN_TRANSITION";
}
