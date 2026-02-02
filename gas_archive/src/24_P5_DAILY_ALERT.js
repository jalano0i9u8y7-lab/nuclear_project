/**
 * 🚨 P5.4: 每日警報檢測（Daily Alert Detection）
 * 
 * ⭐ V8.0 整合：從獨立模組整合到 P5 Daily
 * 
 * 監測持股大幅度波動
 * 檢測突發黑天鵝新聞
 * 檢查是否符合緊急撤退協議條件
 * 
 * @version SSOT V8.0
 * @date 2025-01-15
 */

const P5_4_ALERT_CONFIG = {
  // 波動警報閾值
  volatility_thresholds: {
    daily_decline: 0.05,  // 單日跌幅 > 5%
    three_day_decline: 0.10,  // 3日累計跌幅 > 10%
    daily_volume_spike: 2.0  // 單日成交量暴增 > 200%
  },
  
  // 黑天鵝新聞檢測
  black_swan_criteria: {
    importance_min: 8,  // 重要性 >= 8（0-10 分）
    sentiment_negative: true,  // 負面情緒
    impact_scope: ["MARKET", "SECTOR", "COMPANY"]  // 影響範圍
  }
};

/**
 * P5.4 主函數：檢查警報並決定是否啟動緊急撤退協議
 * 
 * @param {Array} tickers - 持股列表
 * @param {Object} collectionResult - P5 Daily 收集的數據結果
 * @returns {Object} 警報檢測結果
 */
function P5_4_CheckAlerts(tickers, collectionResult) {
  try {
    Logger.log(`P5.4 警報檢測開始：tickers=${tickers.length}`);
    
    const alerts = {
      volatility_alerts: [],
      black_swan_news: [],
      requires_emergency_exit: false,
      trigger_type: null,
      trigger_details: null
    };
    
    // ========================================
    // Step 1: 檢測大幅度波動
    // ========================================
    
    const volatilityAlerts = detectVolatilityAlert(tickers, collectionResult);
    alerts.volatility_alerts = volatilityAlerts;
    
    // ========================================
    // Step 2: 檢測黑天鵝新聞
    // ========================================
    
    const blackSwanNews = detectBlackSwanNews(tickers, collectionResult);
    alerts.black_swan_news = blackSwanNews;
    
    // ========================================
    // Step 3: 檢查是否符合緊急撤退協議條件
    // ========================================
    
    const emergencyCheck = checkEmergencyExitConditions(alerts, collectionResult);
    
    if (emergencyCheck.requires_emergency_exit) {
      alerts.requires_emergency_exit = true;
      alerts.trigger_type = emergencyCheck.trigger_type;
      alerts.trigger_details = emergencyCheck.trigger_details;
      
      Logger.log(`P5.4：檢測到緊急情況，觸發類型=${alerts.trigger_type}`);
    }
    
    return alerts;
    
  } catch (error) {
    Logger.log(`P5.4 警報檢測失敗：${error.message}`);
    return {
      volatility_alerts: [],
      black_swan_news: [],
      requires_emergency_exit: false,
      error: error.message
    };
  }
}

/**
 * 檢測大幅度波動
 * 
 * @param {Array} tickers - 持股列表
 * @param {Object} collectionResult - 收集的數據
 * @returns {Array} 波動警報列表
 */
function detectVolatilityAlert(tickers, collectionResult) {
  const alerts = [];
  const ohlcv = collectionResult.ohlcv || {};
  const thresholds = P5_4_ALERT_CONFIG.volatility_thresholds;
  
  for (const ticker of tickers) {
    const tickerData = ohlcv[ticker];
    if (!tickerData) {
      continue;
    }
    
    const currentPrice = tickerData.close || tickerData.price || 0;
    const previousClose = tickerData.previous_close || currentPrice;
    const volume = tickerData.volume || 0;
    const avgVolume = tickerData.avg_volume || volume;
    
    // 檢查單日跌幅
    if (previousClose > 0) {
      const dailyChange = (currentPrice - previousClose) / previousClose;
      
      if (dailyChange < -thresholds.daily_decline) {
        alerts.push({
          ticker: ticker,
          type: "DAILY_DECLINE",
          severity: "HIGH",
          daily_change_pct: (dailyChange * 100).toFixed(2),
          threshold: (thresholds.daily_decline * 100).toFixed(2),
          current_price: currentPrice,
          previous_close: previousClose,
          message: `單日跌幅 ${(dailyChange * 100).toFixed(2)}% > ${(thresholds.daily_decline * 100).toFixed(2)}%`
        });
      }
    }
    
    // 檢查成交量暴增
    if (avgVolume > 0 && volume > avgVolume * thresholds.daily_volume_spike) {
      alerts.push({
        ticker: ticker,
        type: "VOLUME_SPIKE",
        severity: "MEDIUM",
        volume_ratio: (volume / avgVolume).toFixed(2),
        current_volume: volume,
        avg_volume: avgVolume,
        message: `成交量暴增 ${(volume / avgVolume).toFixed(2)} 倍`
      });
    }
    
    // 檢查 3 日累計跌幅（需要歷史數據）
    // 這裡簡化處理，實際應該從歷史數據中讀取
    if (tickerData.three_day_change !== undefined) {
      const threeDayChange = tickerData.three_day_change;
      if (threeDayChange < -thresholds.three_day_decline) {
        alerts.push({
          ticker: ticker,
          type: "THREE_DAY_DECLINE",
          severity: "HIGH",
          three_day_change_pct: (threeDayChange * 100).toFixed(2),
          threshold: (thresholds.three_day_decline * 100).toFixed(2),
          message: `3日累計跌幅 ${(threeDayChange * 100).toFixed(2)}% > ${(thresholds.three_day_decline * 100).toFixed(2)}%`
        });
      }
    }
  }
  
  return alerts;
}

/**
 * 檢測黑天鵝新聞
 * 
 * @param {Array} tickers - 持股列表
 * @param {Object} collectionResult - 收集的數據
 * @returns {Array} 黑天鵝新聞列表
 */
function detectBlackSwanNews(tickers, collectionResult) {
  const blackSwanNews = [];
  const newsAtoms = collectionResult.news_atoms || {};
  const criteria = P5_4_ALERT_CONFIG.black_swan_criteria;
  
  // 從 NEWS_ATOMS_DAILY 表格中讀取新聞原子
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const newsSheet = ss.getSheetByName("NEWS_ATOMS_DAILY");
    
    if (newsSheet && newsSheet.getLastRow() > 1) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dataRange = newsSheet.getDataRange();
      const rows = dataRange.getValues();
      const headers = rows[0];
      
      const dateCol = headers.indexOf("date");
      const tickerCol = headers.indexOf("ticker");
      const importanceCol = headers.indexOf("importance");
      const sentimentCol = headers.indexOf("sentiment");
      const impactScopeCol = headers.indexOf("impact_scope");
      const contentCol = headers.indexOf("content");
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const newsDate = new Date(row[dateCol]);
        newsDate.setHours(0, 0, 0, 0);
        
        // 只檢查今天的新聞
        if (newsDate.getTime() !== today.getTime()) {
          continue;
        }
        
        const ticker = row[tickerCol];
        const importance = row[importanceCol] || 0;
        const sentiment = row[sentimentCol] || "NEUTRAL";
        const impactScope = row[impactScopeCol] || "";
        const content = row[contentCol] || "";
        
        // 檢查是否符合黑天鵝標準
        const isHighImportance = importance >= criteria.importance_min;
        const isNegative = criteria.sentiment_negative && 
                          (sentiment === "NEGATIVE" || sentiment === "BEARISH");
        const isRelevantScope = criteria.impact_scope.includes(impactScope) || 
                                (tickers.includes(ticker) && impactScope === "COMPANY");
        
        if (isHighImportance && isNegative && isRelevantScope) {
          blackSwanNews.push({
            ticker: ticker || "MARKET",
            type: "BLACK_SWAN_NEWS",
            severity: "CRITICAL",
            importance: importance,
            sentiment: sentiment,
            impact_scope: impactScope,
            content: content.substring(0, 200),  // 只取前 200 字
            message: `高重要性負面新聞（重要性=${importance}, 情緒=${sentiment}, 影響範圍=${impactScope}）`
          });
        }
      }
    }
  } catch (error) {
    Logger.log(`P5.4：讀取新聞原子失敗：${error.message}`);
  }
  
  return blackSwanNews;
}

/**
 * 檢查是否符合緊急撤退協議條件
 * 
 * @param {Object} alerts - 警報檢測結果
 * @param {Object} collectionResult - 收集的數據
 * @returns {Object} 緊急撤退檢查結果
 */
function checkEmergencyExitConditions(alerts, collectionResult) {
  const result = {
    requires_emergency_exit: false,
    trigger_type: null,
    trigger_details: null
  };
  
  // 條件 1：單日跌幅 > 7%（觸發 DAILY_DECLINE_7PCT）
  const severeVolatilityAlerts = alerts.volatility_alerts.filter(
    alert => alert.type === "DAILY_DECLINE" && 
             Math.abs(alert.daily_change_pct) >= 7.0
  );
  
  if (severeVolatilityAlerts.length > 0) {
    result.requires_emergency_exit = true;
    result.trigger_type = "DAILY_DECLINE_7PCT";
    result.trigger_details = {
      affected_tickers: severeVolatilityAlerts.map(a => a.ticker),
      max_decline: Math.min(...severeVolatilityAlerts.map(a => parseFloat(a.daily_change_pct))),
      alert_count: severeVolatilityAlerts.length
    };
    return result;
  }
  
  // 條件 2：黑天鵝新聞（觸發 MANUAL_TRIGGER，但標記為黑天鵝）
  if (alerts.black_swan_news.length > 0) {
    const criticalNews = alerts.black_swan_news.filter(
      news => news.importance >= 9 || news.severity === "CRITICAL"
    );
    
    if (criticalNews.length > 0) {
      result.requires_emergency_exit = true;
      result.trigger_type = "BLACK_SWAN_NEWS";
      result.trigger_details = {
        news_count: criticalNews.length,
        affected_tickers: [...new Set(criticalNews.map(n => n.ticker))],
        max_importance: Math.max(...criticalNews.map(n => n.importance)),
        news_summary: criticalNews.map(n => ({
          ticker: n.ticker,
          importance: n.importance,
          impact_scope: n.impact_scope
        }))
      };
      return result;
    }
  }
  
  // 條件 3：3日累計跌幅 > 10%（觸發 DAILY_DECLINE_7PCT，但標記為累計跌幅）
  const threeDayAlerts = alerts.volatility_alerts.filter(
    alert => alert.type === "THREE_DAY_DECLINE"
  );
  
  if (threeDayAlerts.length > 0) {
    result.requires_emergency_exit = true;
    result.trigger_type = "DAILY_DECLINE_7PCT";  // 使用相同的觸發類型
    result.trigger_details = {
      affected_tickers: threeDayAlerts.map(a => a.ticker),
      decline_type: "THREE_DAY_CUMULATIVE",
      max_decline: Math.min(...threeDayAlerts.map(a => parseFloat(a.three_day_change_pct))),
      alert_count: threeDayAlerts.length
    };
    return result;
  }
  
  return result;
}
