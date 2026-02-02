/**
 * 📊 P6: 日誌記錄與數據保留機制
 * 
 * ⭐ V8.0 新增：記錄異常事件，實現數據保留規則
 * 
 * @version V8.0
 * @date 2026-01-17
 */

// ==========================================
// P6 日誌記錄函數
// ==========================================

/**
 * 記錄盤中監測日誌
 * 
 * @param {Object} monitorResult - 監測結果
 * @param {Object} intradayData - 盤中數據
 * @returns {boolean} success - 是否成功
 */
function logIntradayMonitoring(monitorResult, intradayData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P6_INTRADAY_LOG");
    
    if (!sheet) {
      // 表格應該已經由 initializeAllSheets 創建
      sheet = ss.insertSheet("P6_INTRADAY_LOG");
      sheet.appendRow([
        "log_id",
        "timestamp",
        "date",
        "ticker",
        "market",
        "monitor_type",
        "price",
        "price_20min_ago",
        "price_change_pct",
        "volume",
        "volume_avg_20d",
        "volume_ratio",
        "atr_14",
        "is_anomaly",
        "anomaly_type",
        "needs_retention",
        "created_at"
      ]);
    }
    
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const now = new Date();
    
    // 記錄所有監測的標的
    const allMonitored = [
      ...intradayData.positions.map(p => ({ ...p, type: "POSITION" })),
      ...intradayData.optionStocks.map(o => ({ ...o, type: "OPTION" })),
      ...intradayData.majorIndices.map(i => ({ ...i, type: "INDEX" })),
      ...intradayData.sectorETFs.map(e => ({ ...e, type: "ETF" })),
      ...intradayData.trackingPool.map(t => ({ ...t, type: "TRACKING" }))
    ];
    
    for (const item of allMonitored) {
      // 檢查是否為異常
      const anomaly = monitorResult.anomalies.find(a => a.ticker === item.ticker);
      const isAnomaly = anomaly !== undefined;
      const needsRetention = isAnomaly && (anomaly.severity === "CRITICAL" || anomaly.severity === "HIGH");
      
      // 獲取 20 分鐘前價格（20 分鐘動能追蹤）
      const change20Min = item.ticker && item.market 
        ? calculate20MinPriceChange(item.ticker, item.market, item.price)
        : null;
      
      // 保存 20 分鐘動能追蹤價格
      if (item.ticker && item.market && item.price) {
        saveShadowPrice(item.ticker, item.market, item.price, item.volume || 0);
      }
      
      sheet.appendRow([
        `P6_LOG_${Date.now()}_${item.ticker}`,
        now,
        today,
        item.ticker,
        item.market || "US",
        item.type || "UNKNOWN",
        item.price,
        change20Min ? change20Min.price20MinAgo : null,
        change20Min ? change20Min.priceChangePct : (item.change_pct || 0),
        item.volume || 0,
        item.volume_avg_20d || null,
        item.volume && item.volume_avg_20d ? (item.volume / item.volume_avg_20d) : null,
        item.atr_14 || null,
        isAnomaly,
        anomaly ? anomaly.anomalyType : null,
        needsRetention,
        now
      ]);
    }
    
    return true;
    
  } catch (error) {
    Logger.log(`P6：記錄盤中監測日誌失敗：${error.message}`);
    return false;
  }
}

/**
 * 標記異常數據為需保留
 * 
 * @param {Array} anomalies - 異常列表
 * @returns {boolean} success - 是否成功
 */
function markAnomaliesForRetention(anomalies) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P6_INTRADAY_ALERTS_DAILY");
    
    if (!sheet) {
      // 表格應該已經由 initializeAllSheets 創建
      sheet = ss.insertSheet("P6_INTRADAY_ALERTS_DAILY");
      sheet.appendRow([
        "alert_id",
        "date",
        "ticker",
        "market",
        "alert_type",
        "alert_severity",
        "trigger_time",
        "price_data_json",
        "volume_data_json",
        "technical_data_json",
        "trigger_condition_json",
        "action_taken_json",
        "integrated_to_daily",
        "p5_daily_reference",
        "created_at",
        "updated_at"
      ]);
    }
    
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const now = new Date();
    
    // 只記錄 CRITICAL 和 HIGH 級別的異常
    const criticalAnomalies = anomalies.filter(a => 
      a.severity === "CRITICAL" || a.severity === "HIGH"
    );
    
    for (const anomaly of criticalAnomalies) {
      sheet.appendRow([
        `P6_ALERT_${Date.now()}_${anomaly.ticker}`,
        today,
        anomaly.ticker,
        anomaly.market,
        anomaly.anomalyType,
        anomaly.severity,
        now,
        JSON.stringify({
          price: anomaly.details.price || anomaly.details.currentPrice,
          price20MinAgo: anomaly.details.price20MinAgo || null,
          change_pct: anomaly.details.change_pct || anomaly.details.priceChange20Min
        }),
        JSON.stringify({
          volume: anomaly.details.volume || null,
          volumeRatio: anomaly.details.volumeRatio || null
        }),
        JSON.stringify({}), // 技術指標數據（可擴展）
        JSON.stringify(anomaly.details),
        JSON.stringify({}), // 執行動作（可擴展）
        false, // integrated_to_daily
        null,  // p5_daily_reference
        now,
        now
      ]);
    }
    
    Logger.log(`P6：標記 ${criticalAnomalies.length} 個異常為需保留`);
    
    return true;
    
  } catch (error) {
    Logger.log(`P6：標記異常數據失敗：${error.message}`);
    return false;
  }
}

/**
 * 清除一般正常情況的數據（隔天清除）
 * 
 * @returns {number} deletedCount - 刪除的記錄數
 */
function clearNormalIntradayData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P6_INTRADAY_LOG");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return 0;
    }
    
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = Utilities.formatDate(yesterday, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const needsRetentionCol = headers.indexOf("needs_retention");
    
    if (dateCol === -1 || needsRetentionCol === -1) {
      return 0;
    }
    
    let deletedCount = 0;
    const rowsToKeep = [rows[0]]; // 保留標題行
    
    // 保留今天的數據和標記為需保留的數據
    for (let i = 1; i < rows.length; i++) {
      const rowDate = rows[i][dateCol];
      const needsRetention = rows[i][needsRetentionCol];
      
      if (rowDate === today || needsRetention === true) {
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
    
    Logger.log(`P6：清除 ${deletedCount} 筆一般正常數據，保留 ${rowsToKeep.length - 1} 筆`);
    
    return deletedCount;
    
  } catch (error) {
    Logger.log(`P6：清除一般數據失敗：${error.message}`);
    return 0;
  }
}
