/**
 * 📊 P6: DEFCON 盤中調整
 * 
 * ⭐ V8.0 新增：Rule-Based DEFCON 調整（不依賴 AI）
 * 
 * @version V8.0
 * @date 2026-01-17
 */

// ==========================================
// P6 DEFCON 調整配置
// ==========================================

const P6_DEFCON_CONFIG = {
  // 異常嚴重程度到 DEFCON 的映射
  anomalyToDEFCON: {
    "CRITICAL": {
      single: "DEFCON_2",      // 單個 CRITICAL 異常 → DEFCON 2
      multiple: "DEFCON_1"     // 多個 CRITICAL 異常 → DEFCON 1
    },
    "HIGH": {
      single: "DEFCON_3",      // 單個 HIGH 異常 → DEFCON 3
      multiple: "DEFCON_2"     // 多個 HIGH 異常 → DEFCON 2
    },
    "MEDIUM": {
      single: null,            // 單個 MEDIUM 異常不調整
      multiple: "DEFCON_4"     // 多個 MEDIUM 異常 → DEFCON 4
    }
  },
  
  // 指數暴跌到 DEFCON 的映射
  indexDropToDEFCON: {
    "INDEX_DROP_CRITICAL": "DEFCON_1",  // 指數暴跌 > 5%
    "INDEX_DROP_HIGH": "DEFCON_2"       // 指數暴跌 > 4%
  }
};

// ==========================================
// P6 DEFCON 調整函數
// ==========================================

/**
 * 盤中調整 DEFCON（Rule-Based）
 * 
 * @param {Array} anomalies - 異常列表
 * @param {Array} majorIndices - 主要指數數據
 * @returns {Object} defconAdjustment - DEFCON 調整結果
 */
function adjustDEFCONIntraday(anomalies, majorIndices) {
  const adjustment = {
    currentDEFCON: null,
    newDEFCON: null,
    reason: null,
    adjusted: false
  };
  
  try {
    // 獲取當前 DEFCON
    const currentDEFCON = getCurrentDEFCON();
    adjustment.currentDEFCON = currentDEFCON;
    
    // 分析異常嚴重程度
    const criticalCount = anomalies.filter(a => a.severity === "CRITICAL").length;
    const highCount = anomalies.filter(a => a.severity === "HIGH").length;
    const mediumCount = anomalies.filter(a => a.severity === "MEDIUM").length;
    
    // 檢查指數暴跌
    let indexDropSeverity = null;
    for (const idx of majorIndices) {
      if (idx.change_pct <= -0.05) {
        indexDropSeverity = "INDEX_DROP_CRITICAL";
        break;
      } else if (idx.change_pct <= -0.04) {
        indexDropSeverity = "INDEX_DROP_HIGH";
      }
    }
    
    // 決定新的 DEFCON（Rule-Based）
    let newDEFCON = currentDEFCON;
    
    // 優先級 1：指數暴跌
    if (indexDropSeverity) {
      newDEFCON = P6_DEFCON_CONFIG.indexDropToDEFCON[indexDropSeverity];
      adjustment.reason = `主要指數暴跌：${indexDropSeverity}`;
    }
    // 優先級 2：多個 CRITICAL 異常
    else if (criticalCount >= 2) {
      newDEFCON = P6_DEFCON_CONFIG.anomalyToDEFCON["CRITICAL"].multiple;
      adjustment.reason = `檢測到 ${criticalCount} 個 CRITICAL 異常`;
    }
    // 優先級 3：單個 CRITICAL 異常
    else if (criticalCount >= 1) {
      newDEFCON = P6_DEFCON_CONFIG.anomalyToDEFCON["CRITICAL"].single;
      adjustment.reason = `檢測到 ${criticalCount} 個 CRITICAL 異常`;
    }
    // 優先級 4：多個 HIGH 異常
    else if (highCount >= 3) {
      newDEFCON = P6_DEFCON_CONFIG.anomalyToDEFCON["HIGH"].multiple;
      adjustment.reason = `檢測到 ${highCount} 個 HIGH 異常`;
    }
    // 優先級 5：單個 HIGH 異常
    else if (highCount >= 1) {
      newDEFCON = P6_DEFCON_CONFIG.anomalyToDEFCON["HIGH"].single;
      adjustment.reason = `檢測到 ${highCount} 個 HIGH 異常`;
    }
    // 優先級 6：多個 MEDIUM 異常
    else if (mediumCount >= 5) {
      newDEFCON = P6_DEFCON_CONFIG.anomalyToDEFCON["MEDIUM"].multiple;
      adjustment.reason = `檢測到 ${mediumCount} 個 MEDIUM 異常`;
    }
    
    // 如果 DEFCON 需要調整
    if (newDEFCON && newDEFCON !== currentDEFCON) {
      adjustment.newDEFCON = newDEFCON;
      adjustment.adjusted = true;
      
      // 更新 DEFCON（調用 DEFCON 系統）
      updateDEFCON(newDEFCON, adjustment.reason);
      
      Logger.log(`P6：DEFCON 調整：${currentDEFCON} → ${newDEFCON}，原因：${adjustment.reason}`);
    } else {
      adjustment.newDEFCON = currentDEFCON;
      adjustment.adjusted = false;
    }
    
  } catch (error) {
    Logger.log(`P6：DEFCON 調整失敗：${error.message}`);
  }
  
  return adjustment;
}

/**
 * 獲取當前 DEFCON
 * 
 * @returns {string} defcon - 當前 DEFCON 等級
 */
function getCurrentDEFCON() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("DEFCON_STATUS");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return "DEFCON_5"; // 預設
    }
    
    // 讀取最新的 DEFCON 狀態
    const lastRow = sheet.getLastRow();
    const defconCol = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].indexOf("defcon_level");
    
    if (defconCol !== -1) {
      const defcon = sheet.getRange(lastRow, defconCol + 1).getValue();
      return defcon || "DEFCON_5";
    }
    
    return "DEFCON_5";
    
  } catch (error) {
    Logger.log(`P6：獲取當前 DEFCON 失敗：${error.message}`);
    return "DEFCON_5";
  }
}

/**
 * 更新 DEFCON
 * 
 * @param {string} newDEFCON - 新的 DEFCON 等級
 * @param {string} reason - 調整原因
 * @returns {boolean} success - 是否成功
 */
function updateDEFCON(newDEFCON, reason) {
  try {
    // 調用 DEFCON 系統的更新函數（如果存在）
    if (typeof updateDEFCONStatus === 'function') {
      updateDEFCONStatus(newDEFCON, reason);
      return true;
    } else {
      // 如果函數不存在，直接寫入表格
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName("DEFCON_STATUS");
      
      if (!sheet) {
        sheet = ss.insertSheet("DEFCON_STATUS");
        sheet.appendRow([
          "timestamp",
          "defcon_level",
          "reason",
          "updated_by"
        ]);
      }
      
      sheet.appendRow([
        new Date(),
        newDEFCON,
        reason,
        "P6_INTRADAY"
      ]);
      
      return true;
    }
    
  } catch (error) {
    Logger.log(`P6：更新 DEFCON 失敗：${error.message}`);
    return false;
  }
}
