/**
 * 🎨 Nuclear Project UI：緊急通知模組
 * 
 * 處理緊急通知（DEFCON、P4.6 等）的顯示和管理
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

// ==========================================
// 緊急通知
// ==========================================

/**
 * 獲取緊急通知列表
 * 
 * @returns {Array} notifications - 通知列表
 */
function UI_GetEmergencyNotifications() {
  try {
    const notifications = [];
    
    // 檢查 DEFCON
    const defcon = getCurrentDEFCON();
    if (defcon >= 3) {
      notifications.push({
        type: "DEFCON",
        title: `🚨 DEFCON ${defcon} 警告`,
        message: getDEFCONMessage(defcon),
        severity: defcon >= 4 ? "CRITICAL" : "HIGH",
        timestamp: new Date().toISOString()
      });
    }
    
    // 檢查 P4.6 緊急撤退
    if (isP4_6Triggered()) {
      const p4_6Log = getP4_6LatestLog();
      notifications.push({
        type: "P4_6",
        title: "🚨 P4.6 緊急撤退觸發",
        message: p4_6Log ? p4_6Log.reason : "系統檢測到緊急情況，已觸發緊急撤退",
        severity: "CRITICAL",
        timestamp: p4_6Log ? p4_6Log.triggered_at : new Date().toISOString()
      });
    }
    
    // ⭐ V8.0 新增：檢查 P5.4 警報（從 P5 Daily 讀取）
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const p5DailySheet = ss.getSheetByName("P5__DAILY_STATUS");
      
      if (p5DailySheet && p5DailySheet.getLastRow() > 1) {
        const lastRow = p5DailySheet.getLastRow();
        const headers = p5DailySheet.getRange(1, 1, 1, p5DailySheet.getLastColumn()).getValues()[0];
        const row = p5DailySheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
        
        const alertsJsonCol = headers.indexOf("alerts_json");
        if (alertsJsonCol !== -1 && row[alertsJsonCol]) {
          try {
            const alerts = typeof row[alertsJsonCol] === 'string' ? 
              JSON.parse(row[alertsJsonCol]) : row[alertsJsonCol];
            
            if (alerts.requires_emergency_exit) {
              notifications.push({
                type: "P5_4",
                title: "🚨 P5.4 警報：檢測到緊急情況",
                message: `觸發類型：${alerts.trigger_type || "未知"}\n波動警報：${alerts.volatility_alerts?.length || 0} 筆\n黑天鵝新聞：${alerts.black_swan_news?.length || 0} 筆`,
                severity: "CRITICAL",
                timestamp: new Date().toISOString()
              });
            } else if (alerts.volatility_alerts && alerts.volatility_alerts.length > 0) {
              notifications.push({
                type: "P5_4",
                title: "⚠️ P5.4 警報：檢測到大幅度波動",
                message: `${alerts.volatility_alerts.length} 檔股票出現大幅度波動`,
                severity: "HIGH",
                timestamp: new Date().toISOString()
              });
            }
          } catch (e) {
            // 忽略解析錯誤
          }
        }
      }
    } catch (error) {
      Logger.log(`檢查 P5.4 警報失敗：${error.message}`);
    }
    
    // 按嚴重程度排序
    const severityOrder = { "CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3 };
    notifications.sort((a, b) => {
      return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
    });
    
    return notifications;
  } catch (error) {
    Logger.log(`獲取緊急通知失敗：${error.message}`);
    return [];
  }
}

/**
 * 獲取 DEFCON 訊息
 * 
 * @param {number} defcon - DEFCON 等級
 * @returns {string} message - 訊息
 */
function getDEFCONMessage(defcon) {
  const messages = {
    1: "正常狀態",
    2: "輕微警戒",
    3: "中等警戒 - 建議減碼或對沖",
    4: "高度警戒 - 建議大幅減碼",
    5: "最高警戒 - 建議清倉"
  };
  
  return messages[defcon] || "未知狀態";
}

/**
 * 獲取 P4.6 最新日誌
 * 
 * @returns {Object|null} log - 日誌數據
 */
function getP4_6LatestLog() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P4_6_EMERGENCY_EXIT_LOG");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const row = sheet.getRange(lastRow, 1, 1, 10).getValues()[0];
    const headers = sheet.getRange(1, 1, 1, 10).getValues()[0];
    
    const log = {};
    headers.forEach((header, index) => {
      log[header] = row[index];
    });
    
    return log;
  } catch (error) {
    Logger.log(`獲取 P4.6 最新日誌失敗：${error.message}`);
    return null;
  }
}
