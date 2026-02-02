/**
 * 📅 P5 Calendar 預估日期自動更新機制
 * 
 * 實現預估日期的自動搜尋和更新功能：
 * 1. 從官方來源搜尋確切日期
 * 2. 更新 P5__CALENDAR 表格中的日期
 * 3. 定期檢查並更新預估日期
 * 
 * @version V1.0
 * @date 2025-01-14
 */

// ==========================================
// 日期更新主函數
// ==========================================

/**
 * 更新事件日期
 * @param {string} eventId - 事件 ID
 * @param {Date} confirmedDate - 確認的日期
 * @param {string} dateSource - 日期來源（"OFFICIAL", "ESTIMATED", "CALENDAR"）
 * @return {boolean} 是否更新成功
 */
function updateEventDate(eventId, confirmedDate, dateSource) {
  try {
    Logger.log(`更新事件日期：eventId=${eventId}, date=${confirmedDate}, source=${dateSource}`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__CALENDAR");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      throw new Error("P5__CALENDAR 表格不存在或沒有數據");
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const eventIdCol = headers.indexOf("event_id");
    const dateStartCol = headers.indexOf("date_start");
    const dateEndCol = headers.indexOf("date_end");
    const dateEstimatedCol = headers.indexOf("date_estimated");
    const dateSourceCol = headers.indexOf("date_source");
    const lastUpdatedCol = headers.indexOf("last_updated");
    
    if (eventIdCol === -1 || dateStartCol === -1) {
      throw new Error("P5__CALENDAR 表格缺少必要欄位");
    }
    
    // 查找事件
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][eventIdCol] === eventId) {
        // 找到事件，更新日期
        const rowNum = i + 1;
        
        // 更新 date_start
        if (dateStartCol !== -1) {
          sheet.getRange(rowNum, dateStartCol + 1).setValue(confirmedDate);
        }
        
        // 如果 date_end 為空或與 date_start 相同，也更新 date_end
        if (dateEndCol !== -1) {
          const currentDateEnd = rows[i][dateEndCol];
          if (!currentDateEnd || currentDateEnd === rows[i][dateStartCol]) {
            sheet.getRange(rowNum, dateEndCol + 1).setValue(confirmedDate);
          }
        }
        
        // 更新 date_estimated
        if (dateEstimatedCol !== -1) {
          sheet.getRange(rowNum, dateEstimatedCol + 1).setValue(false);
        }
        
        // 更新 date_source
        if (dateSourceCol !== -1) {
          sheet.getRange(rowNum, dateSourceCol + 1).setValue(dateSource || "OFFICIAL");
        }
        
        // 更新 last_updated
        if (lastUpdatedCol !== -1) {
          sheet.getRange(rowNum, lastUpdatedCol + 1).setValue(new Date());
        }
        
        Logger.log(`✓ 事件日期已更新：${eventId}`);
        return true;
      }
    }
    
    Logger.log(`⚠ 事件不存在：${eventId}`);
    return false;
    
  } catch (error) {
    Logger.log(`✗ 更新事件日期失敗：${error.message}`);
    throw error;
  }
}

/**
 * 檢查並更新預估日期
 * 掃描所有 date_estimated=true 的事件，搜尋官方公布的確切日期並更新
 * 
 * @param {number} daysAhead - 只檢查未來 N 天內的事件（預設 30 天）
 * @return {Object} 更新結果
 */
function checkAndUpdateEstimatedDates(daysAhead = 30) {
  const startTime = Date.now();
  Logger.log("=".repeat(60));
  Logger.log(`🔍 開始檢查並更新預估日期（未來 ${daysAhead} 天內）`);
  Logger.log("=".repeat(60));
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__CALENDAR");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5__CALENDAR 表格不存在或沒有數據");
      return { checked: 0, updated: 0, failed: 0 };
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const eventIdCol = headers.indexOf("event_id");
    const dateStartCol = headers.indexOf("date_start");
    const dateEstimatedCol = headers.indexOf("date_estimated");
    const eventNameCol = headers.indexOf("event_name");
    const eventTypeCol = headers.indexOf("event_type");
    const tickerCol = headers.indexOf("prior_dimensions_json");  // 財報事件的 ticker 在 prior_dimensions_json 中
    
    if (eventIdCol === -1 || dateStartCol === -1) {
      throw new Error("P5__CALENDAR 表格缺少必要欄位");
    }
    
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    let checked = 0;
    let updated = 0;
    let failed = 0;
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const eventId = row[eventIdCol];
      const eventDate = new Date(row[dateStartCol]);
      const dateEstimated = row[dateEstimatedCol];
      const eventName = row[eventNameCol] || "";
      const eventType = row[eventTypeCol] || "";
      
      // 只處理預估日期且在未來 N 天內的事件
      if (dateEstimated === true && eventDate >= today && eventDate <= futureDate) {
        checked++;
        Logger.log(`\n檢查事件：${eventName} (${eventId})`);
        
        try {
          // 搜尋官方公布的確切日期
          const confirmedDate = searchOfficialDate(eventName, eventType, row);
          
          if (confirmedDate) {
            // 更新日期
            const dateSource = eventType === "EARNINGS" ? "OFFICIAL_EARNINGS" : "OFFICIAL";
            const success = updateEventDate(eventId, confirmedDate, dateSource);
            
            if (success) {
              updated++;
              Logger.log(`✓ 日期已更新：${eventName} → ${Utilities.formatDate(confirmedDate, Session.getScriptTimeZone(), "yyyy-MM-dd")}`);
            } else {
              failed++;
            }
          } else {
            Logger.log(`⚠ 未找到官方日期：${eventName}`);
          }
          
        } catch (error) {
          failed++;
          Logger.log(`✗ 檢查失敗：${eventName} - ${error.message}`);
        }
      }
    }
    
    const totalTime = Date.now() - startTime;
    Logger.log("\n" + "=".repeat(60));
    Logger.log(`🎉 檢查完成（總時間：${(totalTime / 1000).toFixed(1)} 秒）`);
    Logger.log(`檢查：${checked}，更新：${updated}，失敗：${failed}`);
    Logger.log("=".repeat(60));
    
    return {
      checked,
      updated,
      failed,
      total_time: totalTime
    };
    
  } catch (error) {
    Logger.log(`✗ 檢查預估日期失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 日期搜尋函數
// ==========================================

/**
 * 搜尋官方公布的確切日期
 * @param {string} eventName - 事件名稱
 * @param {string} eventType - 事件類型
 * @param {Array} eventRow - 事件行數據
 * @return {Date|null} 確認的日期或 null
 */
function searchOfficialDate(eventName, eventType, eventRow) {
  try {
    if (eventType === "EARNINGS") {
      // 財報日期：從 SEC、EDINET、公司 IR 官網搜尋
      return searchEarningsDate(eventName, eventRow);
    } else if (eventType === "ECONOMIC_EVENT") {
      // 重大財經事件：從央行官網、政府公告搜尋
      return searchEconomicEventDate(eventName, eventRow);
    } else if (eventType === "CONFERENCE") {
      // 展會：從官方網站搜尋
      return searchConferenceDate(eventName, eventRow);
    }
    
    return null;
  } catch (error) {
    Logger.log(`搜尋官方日期失敗：${eventName} - ${error.message}`);
    return null;
  }
}

/**
 * 搜尋財報日期
 * @param {string} eventName - 事件名稱（如 "NVDA Q4 FY2026 財報"）
 * @param {Array} eventRow - 事件行數據
 * @return {Date|null} 確認的日期或 null
 */
function searchEarningsDate(eventName, eventRow) {
  // 從 prior_dimensions_json 中提取 ticker 和公司信息
  let ticker = null;
  let company = null;
  
  try {
    const priorDimensionsIndex = eventRow.findIndex((cell, idx) => {
      const header = eventRow[0];  // 假設第一行是標題
      // 這裡需要根據實際的表格結構來獲取 prior_dimensions_json
      return false;  // 暫時返回 false，需要實際實現
    });
    
    // TODO: 實現從 SEC、EDINET、公司 IR 官網搜尋財報日期
    // 可以使用 CSE 搜尋功能（EARNINGS_CALENDAR CSE）
    
    Logger.log(`⚠️ searchEarningsDate 需要實現：搜尋 ${eventName} 的財報日期`);
    return null;
  } catch (error) {
    Logger.log(`搜尋財報日期失敗：${eventName} - ${error.message}`);
    return null;
  }
}

/**
 * 搜尋重大財經事件日期
 * @param {string} eventName - 事件名稱（如 "FOMC 2026-01-28"）
 * @param {Array} eventRow - 事件行數據
 * @return {Date|null} 確認的日期或 null
 */
function searchEconomicEventDate(eventName, eventRow) {
  // TODO: 實現從央行官網、政府公告搜尋事件日期
  // 例如：FOMC 從 Fed 官網，NFP 從 BLS 官網等
  
  Logger.log(`⚠️ searchEconomicEventDate 需要實現：搜尋 ${eventName} 的日期`);
  return null;
}

/**
 * 搜尋展會日期
 * @param {string} eventName - 事件名稱（如 "CES 2026"）
 * @param {Array} eventRow - 事件行數據
 * @return {Date|null} 確認的日期或 null
 */
function searchConferenceDate(eventName, eventRow) {
  // TODO: 實現從展會官方網站搜尋日期
  // 例如：CES 從 ces.tech，MWC 從 mwcbarcelona.com 等
  
  Logger.log(`⚠️ searchConferenceDate 需要實現：搜尋 ${eventName} 的日期`);
  return null;
}

// ==========================================
// 定期檢查觸發器
// ==========================================

/**
 * 定期檢查預估日期（可由 P5 Daily 或 P5 Weekly 觸發）
 * 
 * 建議在 P5 Daily 中調用，每天檢查一次即將到來的事件（30天內）
 */
function P5_Calendar_CheckEstimatedDates() {
  try {
    Logger.log("P5 Calendar：開始定期檢查預估日期");
    
    const result = checkAndUpdateEstimatedDates(30);  // 檢查未來 30 天內的事件
    
    if (result.updated > 0) {
      Logger.log(`P5 Calendar：已更新 ${result.updated} 個事件的日期`);
      // 可以觸發通知或更新相關模組
    }
    
    return result;
  } catch (error) {
    Logger.log(`P5 Calendar 檢查預估日期失敗：${error.message}`);
    return { checked: 0, updated: 0, failed: 1 };
  }
}
