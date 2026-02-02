/**
 * 🔧 初始化 INSTITUTIONAL_RATINGS_DAILY 表格
 * 
 * ⭐ V8.9 新增：確保機構評級表格存在
 * 
 * 如果表格不存在，會自動創建
 * 
 * @version V8.9
 * @date 2026-01-18
 */

/**
 * 初始化 INSTITUTIONAL_RATINGS_DAILY 表格
 * 
 * 如果表格不存在，會自動創建並設置標題
 */
function initializeInstitutionalRatingsTable() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("INSTITUTIONAL_RATINGS_DAILY");
    
    if (!sheet) {
      Logger.log("創建 INSTITUTIONAL_RATINGS_DAILY 表格...");
      sheet = ss.insertSheet("INSTITUTIONAL_RATINGS_DAILY");
      const headers = INSTITUTIONAL_RATINGS_DAILY_SCHEMA.headers;
      sheet.appendRow(headers);
      
      // 凍結標題行
      sheet.setFrozenRows(1);
      
      Logger.log("✅ INSTITUTIONAL_RATINGS_DAILY 表格創建完成");
    } else {
      // 檢查標題是否匹配
      const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const expectedHeaders = INSTITUTIONAL_RATINGS_DAILY_SCHEMA.headers;
      
      if (JSON.stringify(existingHeaders) !== JSON.stringify(expectedHeaders)) {
        Logger.log("⚠️ INSTITUTIONAL_RATINGS_DAILY 表格標題不匹配，請檢查");
      } else {
        Logger.log("✅ INSTITUTIONAL_RATINGS_DAILY 表格已存在且標題正確");
      }
    }
    
    return sheet;
    
  } catch (error) {
    Logger.log(`初始化 INSTITUTIONAL_RATINGS_DAILY 表格失敗：${error.message}`);
    throw error;
  }
}
