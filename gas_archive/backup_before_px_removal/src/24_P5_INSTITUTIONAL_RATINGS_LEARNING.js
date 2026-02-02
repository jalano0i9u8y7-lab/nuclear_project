/**
 * 📊 機構評級可信度學習系統（V8.9 新增；V8.19 N2 簡化時間維度）
 * 
 * 功能：
 * - 計算各大機構在不同時間維度的可信度評分
 * - ⭐ V8.19 N2：短期 7d、中期 15d（移除長期維度）
 * - 最終可信度（加權平均：短期 50%、中期 50%）
 * 
 * @version V8.19
 * @date 2026-01-25
 */

/**
 * 更新機構評級可信度評分
 * 
 * @param {string} ratingId - 評級 ID（格式：`ticker_firm_date`）
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @param {string} ratingFirm - 機構名稱（標準化後）
 * @param {string} ratingAction - 評級動作（UPGRADE/DOWNGRADE/MAINTAIN/INITIATE）
 * @param {string} ratingDate - 評級發布日期（ISO 格式）
 */
function updateInstitutionalRatingsCredibility(ratingId, ticker, market, ratingFirm, ratingAction, ratingDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("INSTITUTIONAL_RATINGS_LEARNING_LOG");
    
    if (!sheet) {
      // 創建表格
      sheet = ss.insertSheet("INSTITUTIONAL_RATINGS_LEARNING_LOG");
      const headers = INSTITUTIONAL_RATINGS_LEARNING_LOG_SCHEMA.headers;
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    }
    
    // 計算時間差（天數）
    const ratingDateObj = new Date(ratingDate);
    const today = new Date();
    const daysSinceRating = Math.floor((today.getTime() - ratingDateObj.getTime()) / (1000 * 60 * 60 * 24));
    
    // 構建查詢用 ticker（用於 getPriceReaction）
    let queryTicker = ticker;
    if (market === "TW") {
      queryTicker = `TPE:${ticker}`;
    } else if (market === "JP") {
      queryTicker = `TYO:${ticker}`;
    }
    
    // 取得多時間維度的價格反應
    const priceReactions = getPriceReactionMultiTimeframe(queryTicker, ratingDate);
    
    let credibilityScoreShort = null;
    let credibilityScoreMid = null;
    let credibilityScoreFinal = null;
    
    if (daysSinceRating >= 7 && priceReactions && priceReactions.short_term) {
      credibilityScoreShort = calculateCredibilityScore(ratingAction, priceReactions.short_term);
      updateLearningLogRecord(sheet, ratingId, {
        short_term_result: JSON.stringify(priceReactions.short_term),
        credibility_score_short: credibilityScoreShort,
        updated_at: new Date()
      });
    }
    
    if (daysSinceRating >= 15 && priceReactions && priceReactions.mid_term) {
      credibilityScoreMid = calculateCredibilityScore(ratingAction, priceReactions.mid_term);
      credibilityScoreFinal = calculateFinalCredibilityScore(
        credibilityScoreShort,
        credibilityScoreMid,
        null
      );
      updateLearningLogRecord(sheet, ratingId, {
        mid_term_result: JSON.stringify(priceReactions.mid_term),
        credibility_score_mid: credibilityScoreMid,
        credibility_score_final: credibilityScoreFinal,
        updated_at: new Date()
      });
    } else if (credibilityScoreShort !== null || credibilityScoreMid !== null) {
      credibilityScoreFinal = calculateFinalCredibilityScore(
        credibilityScoreShort,
        credibilityScoreMid,
        null
      );
      updateLearningLogRecord(sheet, ratingId, {
        credibility_score_final: credibilityScoreFinal,
        updated_at: new Date()
      });
    }
    
    if (!hasLearningLogRecord(sheet, ratingId)) {
      const row = [
        ratingId,
        ticker,
        market,
        ratingFirm,
        ratingAction,
        ratingDate,
        priceReactions && priceReactions.short_term ? JSON.stringify(priceReactions.short_term) : "",
        priceReactions && priceReactions.mid_term ? JSON.stringify(priceReactions.mid_term) : "",
        "",  // ⭐ V8.19 N2：長期維度移除，留空以兼容 schema
        credibilityScoreShort || "",
        credibilityScoreMid || "",
        "",
        credibilityScoreFinal || "",
        new Date(),
        new Date()
      ];
      sheet.appendRow(row);
    }
    
  } catch (error) {
    Logger.log(`更新機構評級可信度評分失敗（${ratingId}）：${error.message}`);
  }
}

/**
 * 計算可信度評分
 * 
 * @param {string} ratingAction - 評級動作（UPGRADE/DOWNGRADE/MAINTAIN/INITIATE）
 * @param {Object} priceReaction - 價格反應數據 { changePct, volumeSpike }
 * @return {number} 可信度評分（-1 到 +1）
 */
function calculateCredibilityScore(ratingAction, priceReaction) {
  if (!priceReaction || priceReaction.changePct === null || priceReaction.changePct === undefined) {
    return 0; // 無法計算
  }
  
  const changePct = priceReaction.changePct;
  const volumeSpike = priceReaction.volumeSpike || false;
  
  // 評級動作與股價反應的一致性
  let score = 0;
  
  if (ratingAction === "UPGRADE") {
    // Upgrade + 上漲 = 可信（+1）
    // Upgrade + 下跌 = 不可信（-1）
    if (changePct > 0.02 && volumeSpike) {
      score = 1.0; // 大漲 + 爆量 = 完全可信
    } else if (changePct > 0.01) {
      score = 0.5; // 小漲 = 部分可信
    } else if (changePct < -0.01) {
      score = -1.0; // 下跌 = 完全不可信（誘多）
    } else {
      score = 0; // 無明顯反應
    }
  } else if (ratingAction === "DOWNGRADE") {
    // Downgrade + 下跌 = 可信（+1）
    // Downgrade + 上漲 = 不可信（-1）
    if (changePct < -0.02 && volumeSpike) {
      score = 1.0; // 大跌 + 爆量 = 完全可信
    } else if (changePct < -0.01) {
      score = 0.5; // 小跌 = 部分可信
    } else if (changePct > 0.01) {
      score = -1.0; // 上漲 = 完全不可信（誘空）
    } else {
      score = 0; // 無明顯反應
    }
  } else if (ratingAction === "MAINTAIN" || ratingAction === "INITIATE") {
    // Maintain 和 Initiate 通常中性，只要不反向就給 0.5
    if (Math.abs(changePct) < 0.02) {
      score = 0.5; // 價格變化不明顯 = 中性可信
    } else {
      score = 0; // 有明顯變化，但不一定可信或不可信
    }
  }
  
  return score;
}

/**
 * 計算最終可信度評分（加權平均）
 * 
 * @param {number|null} shortScore - 短期可信度
 * @param {number|null} midScore - 中期可信度
 * @param {number|null} longScore - 長期可信度
 * @return {number} 最終可信度評分
 */
function calculateFinalCredibilityScore(shortScore, midScore, longScore) {
  const weights = { short: 0.3, mid: 0.4, long: 0.3 };
  let totalWeight = 0;
  let weightedSum = 0;
  
  if (shortScore !== null && shortScore !== undefined) {
    weightedSum += shortScore * weights.short;
    totalWeight += weights.short;
  }
  
  if (midScore !== null && midScore !== undefined) {
    weightedSum += midScore * weights.mid;
    totalWeight += weights.mid;
  }
  
  if (longScore !== null && longScore !== undefined) {
    weightedSum += longScore * weights.long;
    totalWeight += weights.long;
  }
  
  if (totalWeight === 0) return 0;
  
  return weightedSum / totalWeight;
}

/**
 * 檢查是否已有學習日誌記錄
 */
function hasLearningLogRecord(sheet, ratingId) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;
    
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 1); // rating_id 欄位
    const data = dataRange.getValues();
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === ratingId) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * 更新學習日誌記錄
 */
function updateLearningLogRecord(sheet, ratingId, updates) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;
    
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 16); // 所有欄位
    const data = dataRange.getValues();
    
    const headers = INSTITUTIONAL_RATINGS_LEARNING_LOG_SCHEMA.headers;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === ratingId) {
        const rowIndex = i + 2; // +2 因為從第 2 行開始（第 1 行是標題）
        
        // 更新對應欄位
        for (const [key, value] of Object.entries(updates)) {
          const colIndex = headers.indexOf(key);
          if (colIndex > -1) {
            sheet.getRange(rowIndex, colIndex + 1).setValue(value);
          }
        }
        
        return true;
      }
    }
    
    return false;
  } catch (error) {
    Logger.log(`更新學習日誌記錄失敗（${ratingId}）：${error.message}`);
    return false;
  }
}

/**
 * 獲取機構可信度摘要（用於整合到 P5__LEARNING_LOG）
 * 
 * @param {string} dateStr - 日期（ISO 格式，如 "2026-01-18"）
 * @return {Object} 機構可信度摘要 { "GOLDMAN_SACHS": { short_term: 0.6, mid_term: 0.8, long_term: 0.75, final: 0.72 }, ... }
 */
function getInstitutionalCredibilitySummary(dateStr) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("INSTITUTIONAL_RATINGS_LEARNING_LOG");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const lastRow = sheet.getLastRow();
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 16);
    const data = dataRange.getValues();
    
    // 計算每個機構的平均可信度（只統計有最終可信度評分的記錄）
    const firmScores = {};
    
    for (let i = 0; i < data.length; i++) {
      const ratingDate = data[i][5]; // rating_date
      const ratingDateStr = ratingDate instanceof Date ? 
        Utilities.formatDate(ratingDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : 
        String(ratingDate).split('T')[0];
      
      // 只統計指定日期或之前的評級
      if (ratingDateStr <= dateStr) {
        const firm = data[i][3]; // rating_firm
        const shortScore = data[i][9]; // credibility_score_short
        const midScore = data[i][10]; // credibility_score_mid
        const longScore = data[i][11]; // credibility_score_long
        const finalScore = data[i][12]; // credibility_score_final
        
        if (!firmScores[firm]) {
          firmScores[firm] = {
            short_term_scores: [],
            mid_term_scores: [],
            long_term_scores: [],
            final_scores: []
          };
        }
        
        if (shortScore !== null && shortScore !== undefined && shortScore !== "") {
          firmScores[firm].short_term_scores.push(parseFloat(shortScore));
        }
        if (midScore !== null && midScore !== undefined && midScore !== "") {
          firmScores[firm].mid_term_scores.push(parseFloat(midScore));
        }
        if (longScore !== null && longScore !== undefined && longScore !== "") {
          firmScores[firm].long_term_scores.push(parseFloat(longScore));
        }
        if (finalScore !== null && finalScore !== undefined && finalScore !== "") {
          firmScores[firm].final_scores.push(parseFloat(finalScore));
        }
      }
    }
    
    // 計算平均值
    const summary = {};
    for (const [firm, scores] of Object.entries(firmScores)) {
      summary[firm] = {
        short_term: scores.short_term_scores.length > 0 ? 
          scores.short_term_scores.reduce((a, b) => a + b, 0) / scores.short_term_scores.length : null,
        mid_term: scores.mid_term_scores.length > 0 ? 
          scores.mid_term_scores.reduce((a, b) => a + b, 0) / scores.mid_term_scores.length : null,
        long_term: scores.long_term_scores.length > 0 ? 
          scores.long_term_scores.reduce((a, b) => a + b, 0) / scores.long_term_scores.length : null,
        final: scores.final_scores.length > 0 ? 
          scores.final_scores.reduce((a, b) => a + b, 0) / scores.final_scores.length : null
      };
    }
    
    return summary;
  } catch (error) {
    Logger.log(`獲取機構可信度摘要失敗：${error.message}`);
    return {};
  }
}
