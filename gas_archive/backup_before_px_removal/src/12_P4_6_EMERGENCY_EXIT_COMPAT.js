/**
 * 🚨 P4.6 兼容層（Compatibility Layer）
 * 
 * ⚠️ V8.15 變更：P4.6 已封存，此文件提供兼容函數
 * - 盤中緊急撤退功能已搬移到 P6（28_P6_EMERGENCY_EXIT.js）
 * - 此文件提供向後兼容的函數接口，實際從 P6 讀取數據
 * 
 * @version SSOT V8.15（兼容層）
 * @date 2026-01-19
 */

/**
 * 檢查 P4.6 是否已觸發（兼容函數，實際從 P6 讀取）
 * ⚠️ V8.15：此函數已遷移到 P6，此處提供兼容接口
 * 
 * @return {boolean} 是否已觸發
 */
function isP4_6Triggered() {
  try {
    // ⭐ V8.15：從 P6 緊急撤退日誌讀取（兼容舊接口）
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P6_EMERGENCY_EXIT_LOG");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      // 如果 P6 表格不存在，嘗試讀取舊的 P4.6 表格（向後兼容）
      const oldSheet = ss.getSheetByName("P4_6_EMERGENCY_EXIT_LOG");
      if (!oldSheet || oldSheet.getLastRow() <= 1) {
        return false;
      }
      // 讀取舊表格的最後一行
      const lastRow = oldSheet.getLastRow();
      const timestamp = oldSheet.getRange(lastRow, 2).getValue();
      if (!timestamp) {
        return false;
      }
      const exitTime = new Date(timestamp);
      const now = new Date();
      const hoursSinceExit = (now - exitTime) / (1000 * 60 * 60);
      return hoursSinceExit <= 24;
    }
    
    // 讀取 P6 表格的最後一行（最新的退出記錄）
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = sheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
    
    const exitIdCol = headers.indexOf("exit_id");
    const timestampCol = headers.indexOf("created_at");
    
    if (exitIdCol === -1 || timestampCol === -1) {
      return false;
    }
    
    const exitId = row[exitIdCol];
    const timestamp = row[timestampCol];
    
    if (!exitId || !timestamp) {
      return false;
    }
    
    // 檢查是否在最近 24 小時內觸發
    const exitTime = new Date(timestamp);
    const now = new Date();
    const hoursSinceExit = (now - exitTime) / (1000 * 60 * 60);
    
    // 如果最近 24 小時內有觸發記錄，則認為已觸發
    return hoursSinceExit <= 24;
    
  } catch (error) {
    Logger.log(`檢查 P4.6 觸發狀態失敗（兼容層）：${error.message}`);
    return false;  // 出錯時默認未觸發
  }
}
