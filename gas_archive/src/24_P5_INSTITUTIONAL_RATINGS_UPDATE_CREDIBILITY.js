/**
 * 📊 機構評級可信度定期更新機制（V8.9 新增；V8.19 N2 簡化時間維度）
 * 
 * 功能：
 * - 在 P5 Daily 執行時，檢查並更新已到期的機構評級可信度評分
 * - ⭐ V8.19 N2：簡化為 短期 7d、中期 15d（移除長期維度）
 * - 最終可信度：短期 + 中期完成後更新
 * 
 * @version V8.19
 * @date 2026-01-25
 */

/**
 * 批量更新機構評級可信度評分（P5 Daily 調用）
 * 
 * @return {Object} 更新結果
 */
function updateInstitutionalRatingsCredibilityBatch() {
  Logger.log("P5 Daily：開始批量更新機構評級可信度評分（V8.9）");
  
  const results = {
    total_checked: 0,
    short_term_updated: 0,
    mid_term_updated: 0,
    long_term_updated: 0,
    final_updated: 0,
    errors: []
  };
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ratingsSheet = ss.getSheetByName("INSTITUTIONAL_RATINGS_DAILY");
    
    if (!ratingsSheet || ratingsSheet.getLastRow() <= 1) {
      Logger.log("P5 Daily：INSTITUTIONAL_RATINGS_DAILY 表格不存在或無數據，跳過可信度更新");
      return { success: true, ...results, message: "無數據可更新" };
    }
    
    const lastRow = ratingsSheet.getLastRow();
    const dataRange = ratingsSheet.getRange(2, 1, lastRow - 1, 19);
    const data = dataRange.getValues();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 遍歷所有評級記錄，檢查是否需要更新可信度
    for (let i = 0; i < data.length; i++) {
      try {
        const ratingDate = data[i][0]; // date
        const ticker = data[i][1]; // ticker
        const market = data[i][2]; // market
        const ratingFirm = data[i][3]; // rating_firm
        const ratingAction = data[i][4]; // rating_action
        const superseded = data[i][18]; // superseded_by
        
        // 跳過被取代的評級
        if (superseded && superseded !== "") {
          continue;
        }
        
        if (!ratingDate || !ticker || !market || !ratingFirm || !ratingAction) {
          continue;
        }
        
        const ratingDateObj = ratingDate instanceof Date ? ratingDate : new Date(ratingDate);
        if (isNaN(ratingDateObj.getTime())) {
          continue;
        }
        
        ratingDateObj.setHours(0, 0, 0, 0);
        const daysSinceRating = Math.floor((today.getTime() - ratingDateObj.getTime()) / (1000 * 60 * 60 * 24));
        
        // 生成 rating_id
        const ratingId = `${ticker}_${ratingFirm}_${Utilities.formatDate(ratingDateObj, Session.getScriptTimeZone(), "yyyy-MM-dd")}`;
        
        results.total_checked++;
        
        // 檢查是否需要更新 ⭐ V8.19 N2：短期 7d、中期 15d
        let needsUpdate = false;
        
        if (daysSinceRating >= 7) {
          // 短期可信度需要更新（7 天）
          needsUpdate = true;
        } else if (daysSinceRating >= 15) {
          // 中期可信度與最終可信度需要更新（15 天）
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          if (typeof updateInstitutionalRatingsCredibility === "function") {
            updateInstitutionalRatingsCredibility(
              ratingId,
              ticker,
              market,
              ratingFirm,
              ratingAction,
              Utilities.formatDate(ratingDateObj, Session.getScriptTimeZone(), "yyyy-MM-dd")
            );
            
            if (daysSinceRating >= 7 && daysSinceRating < 15) {
              results.short_term_updated++;
            } else if (daysSinceRating >= 15) {
              results.mid_term_updated++;
              results.final_updated++;
            }
            
            Logger.log(`P5 Daily：更新 ${ticker} (${market}) ${ratingFirm} 的可信度評分（發布後 ${daysSinceRating} 天）`);
          } else {
            Logger.log(`P5 Daily：⚠️ updateInstitutionalRatingsCredibility 函數未定義，跳過可信度更新`);
          }
          
          // 避免更新過快
          Utilities.sleep(500);
        }
        
      } catch (error) {
        results.errors.push({
          row: i + 2,
          error: error.message
        });
        Logger.log(`P5 Daily：更新第 ${i + 2} 筆評級的可信度失敗：${error.message}`);
      }
    }
    
    Logger.log(`P5 Daily：機構評級可信度批量更新完成（檢查 ${results.total_checked} 筆，短期 ${results.short_term_updated}，中期 ${results.mid_term_updated}，長期 ${results.long_term_updated}，最終 ${results.final_updated}）`);
    
    return {
      success: true,
      ...results
    };
    
  } catch (error) {
    Logger.log(`P5 Daily：批量更新機構評級可信度失敗：${error.message}`);
    return {
      success: false,
      ...results,
      error: error.message
    };
  }
}
