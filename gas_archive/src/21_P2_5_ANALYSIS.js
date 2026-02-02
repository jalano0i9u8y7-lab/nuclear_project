/**
 * 💰 P2.5: AI 分析結果處理
 * 
 * 處理 M0 AI 分析的結果，生成 P2.5 輸出結構
 * 
 * @version SSOT V7.1
 * @date 2025-01-15
 */

/**
 * 生成 P2.5 輸出結構
 * @param {Object} executorOutput - 執行者輸出
 * @param {Object} auditorOutput - 審查者輸出
 * @param {Object} smartMoneyScores - Smart_Money_Score 評分
 * @return {Object} P2.5 輸出結構
 */
function generateP2_5Output(executorOutput, auditorOutput, smartMoneyScores) {
  const smartMoneyAnalysis = executorOutput.smart_money_analysis || {};
  const tickers = Object.keys(smartMoneyAnalysis);
  
  // 生成 Phase2.5_Output 表格數據
  const phase2_5Output = [];
  
  for (const ticker of tickers) {
    const analysis = smartMoneyAnalysis[ticker] || {};
    const score = smartMoneyScores[ticker] || 0;
    
    // ⭐ V8.17.5 新增：計算 institutional_anchor_signal（ICDZ 信號）
    const institutionalAnchorSignal = calculateInstitutionalAnchorSignal(analysis, score);
    
    phase2_5Output.push({
      company_code: ticker,
      company_name: analysis.company_name || ticker,
      institutional_holdings_score: calculateInstitutionalHoldingsScore(analysis.institutional_holdings || {}),
      insider_trading_signal: analysis.insider_trading?.signal || "NEUTRAL",
      options_flow_sentiment: analysis.options_flow?.sentiment || "NEUTRAL",
      dark_pool_activity: analysis.dark_pool_activity?.unusual_volume ? "UNUSUAL" : "NORMAL",
      hedge_fund_clone_score: analysis.hedge_fund_clone?.clone_score || 0,
      smart_money_score: score,
      distribution_risk: analysis.distribution_risk || "UNKNOWN",  // ⭐ V8.17.5 新增
      institutional_anchor_signal: institutionalAnchorSignal,  // ⭐ V8.17.5 新增：ICDZ 信號
      recommendations: analysis.recommendations || [],
      last_updated: new Date()
    });
  }
  
  return {
    smart_money_analysis: smartMoneyAnalysis,
    phase2_5_output: phase2_5Output,
    auditor_review: auditorOutput.audit_review || null,
    confidence_level: auditorOutput.confidence || 0.7,
    summary: {
      total_tickers: tickers.length,
      avg_smart_money_score: tickers.length > 0 ? 
        tickers.reduce((sum, t) => sum + (smartMoneyScores[t] || 0), 0) / tickers.length : 0
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * ⭐ V8.17.5 新增：計算 institutional_anchor_signal（ICDZ 信號）
 * 
 * 判斷是否值得進行 ICDZ 定錨（只提供信號，不給價格）
 * 
 * @param {Object} analysis - P2.5 分析結果
 * @param {number} smartMoneyScore - Smart_Money_Score
 * @return {Object} institutional_anchor_signal
 */
function calculateInstitutionalAnchorSignal(analysis, smartMoneyScore) {
  const distributionRisk = analysis.distribution_risk || "UNKNOWN";
  const institutionalHoldings = analysis.institutional_holdings || {};
  const insiderTrading = analysis.insider_trading || {};
  
  // 檢查條件 1：Distribution Risk 必須是 LOW 或 MEDIUM
  if (distributionRisk === "HIGH") {
    return {
      present: false,
      confidence: "N/A",
      anchor_reason: ["Distribution Risk is HIGH - institutions are distributing, not defending"],
      disabled_reason: "DISTRIBUTION_RISK_HIGH"
    };
  }
  
  // 檢查條件 2：Smart Money Score 必須 >= 60（表示機構活動活躍）
  if (smartMoneyScore < 60) {
    return {
      present: false,
      confidence: "N/A",
      anchor_reason: [`Smart Money Score (${smartMoneyScore}) is below threshold (60)`],
      disabled_reason: "SMART_MONEY_SCORE_TOO_LOW"
    };
  }
  
  // 檢查條件 3：機構持倉變化趨勢（必須是 ACCUMULATING 或至少 NEUTRAL）
  const holdingsTrend = institutionalHoldings.trend || "UNKNOWN";
  if (holdingsTrend === "DISTRIBUTING") {
    return {
      present: false,
      confidence: "N/A",
      anchor_reason: ["Institutional holdings trend is DISTRIBUTING"],
      disabled_reason: "HOLDINGS_DISTRIBUTING"
    };
  }
  
  // 收集支持 ICDZ 的證據
  const anchorReasons = [];
  let confidence = "LOW";
  
  // 證據 1：Top 5 機構增持 > 15%
  const top5Increase = institutionalHoldings.top_5_funds_increase;
  if (top5Increase && parseFloat(top5Increase) > 15) {
    anchorReasons.push(`Top 5 funds increased position >${top5Increase}%`);
    confidence = "MEDIUM";
  }
  
  // 證據 2：內部人買入集中在最近 2 個季度
  const insiderBuyClustered = insiderTrading.clustered_buying;
  if (insiderBuyClustered && insiderBuyClustered.quarters && insiderBuyClustered.quarters <= 2) {
    anchorReasons.push(`Insider buying clustered within last ${insiderBuyClustered.quarters} quarters`);
    if (confidence === "MEDIUM") {
      confidence = "HIGH";
    } else {
      confidence = "MEDIUM";
    }
  }
  
  // 證據 3：機構數量增加
  const institutionCountChange = institutionalHoldings.institution_count_change;
  if (institutionCountChange && parseFloat(institutionCountChange) > 10) {
    anchorReasons.push(`Institution count increased by ${institutionCountChange}`);
    if (confidence === "LOW") {
      confidence = "MEDIUM";
    }
  }
  
  // 證據 4：持倉集中度高（少數大型機構主導）
  const concentration = institutionalHoldings.concentration;
  if (concentration === "HIGH") {
    anchorReasons.push("High institutional concentration (few large institutions dominate)");
    if (confidence === "MEDIUM") {
      confidence = "HIGH";
    }
  }
  
  // 如果沒有足夠證據，返回 LOW confidence
  if (anchorReasons.length === 0) {
    return {
      present: true,
      confidence: "LOW",
      anchor_reason: ["Limited evidence for institutional anchor - requires additional confirmation"],
      disabled_reason: null
    };
  }
  
  return {
    present: true,
    confidence: confidence,
    anchor_reason: anchorReasons,
    disabled_reason: null
  };
}

/**
 * 計算機構持倉評分（0-100）
 * @param {Object} institutionalHoldings - 機構持倉數據
 * @return {number} 評分（0-100）
 */
function calculateInstitutionalHoldingsScore(institutionalHoldings) {
  const changes = institutionalHoldings["13f_changes"] || {};
  const netChange = parseFloat(changes.net_change?.replace('%', '') || '0');
  const trend = changes.trend || "NEUTRAL";
  const institutionCount = changes.institution_count || 0;
  
  let score = 50;  // 基礎分數 50
  
  // 根據淨變化調整
  if (netChange > 5) {
    score += 30;
  } else if (netChange > 2) {
    score += 15;
  } else if (netChange < -5) {
    score -= 30;
  } else if (netChange < -2) {
    score -= 15;
  }
  
  // 根據趨勢調整
  if (trend === "ACCUMULATING") {
    score += 10;
  } else if (trend === "DISTRIBUTING") {
    score -= 10;
  }
  
  // 根據機構數量調整
  if (institutionCount > 100) {
    score += 10;
  } else if (institutionCount > 50) {
    score += 5;
  }
  
  // 限制在 0-100 範圍
  return Math.max(0, Math.min(100, score));
}

/**
 * 保存到 Phase2.5_Output 表格
 * @param {Array<Object>} phase2_5Output - Phase2.5_Output 數據
 * @return {number} 保存的記錄數
 */
function saveToPhase2_5Output(phase2_5Output) {
  if (!phase2_5Output || phase2_5Output.length === 0) {
    Logger.log("P2.5：無數據需要保存");
    return 0;
  }
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Phase2.5_Output");
    
    if (!sheet) {
      sheet = ss.insertSheet("Phase2.5_Output");
      sheet.appendRow(PHASE2_5_OUTPUT_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    let savedCount = 0;
    const headers = PHASE2_5_OUTPUT_SCHEMA.headers;
    const now = new Date();
    
    for (const output of phase2_5Output) {
      try {
        // 檢查是否已存在（根據 Company_Code）
        const existingRow = findExistingRowPhase2_5(sheet, output.company_code);
        
        if (existingRow > 0) {
          // 更新現有記錄
          updatePhase2_5OutputRow(sheet, existingRow, output, headers, now);
        } else {
          // 新增記錄
          appendPhase2_5OutputRow(sheet, output, headers, now);
          savedCount++;
        }
      } catch (error) {
        Logger.log(`保存 Phase2.5_Output 失敗：${error.message}`);
      }
    }
    
    Logger.log(`P2.5 Phase2.5_Output 已保存 ${savedCount} 筆新記錄`);
    return savedCount;
    
  } catch (error) {
    Logger.log(`保存 Phase2.5_Output 失敗：${error.message}`);
    throw error;
  }
}

/**
 * 查找現有行（根據 Company_Code）
 * @param {Sheet} sheet - 表格
 * @param {string} companyCode - 公司代碼
 * @return {number} 行號（1-based），如果不存在則返回 -1
 */
function findExistingRowPhase2_5(sheet, companyCode) {
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const companyCodeCol = headers.indexOf("Company_Code");
  if (companyCodeCol === -1) {
    return -1;
  }
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][companyCodeCol] === companyCode) {
      return i + 1;  // 返回行號（1-based）
    }
  }
  
  return -1;
}

/**
 * 新增 Phase2.5_Output 行
 * @param {Sheet} sheet - 表格
 * @param {Object} output - 輸出數據
 * @param {Array<string>} headers - 表頭
 * @param {Date} now - 當前時間
 */
function appendPhase2_5OutputRow(sheet, output, headers, now) {
  const row = [];
  
  for (const header of headers) {
    if (header === "Last_Updated") {
      row.push(now);
    } else {
      const key = header.toLowerCase().replace(/_/g, "_");
      const value = output[key] || output[header] || "";
      
      // 如果是 JSON 欄位，轉換為字符串
      if (header === "Recommendations" && Array.isArray(value)) {
        row.push(JSON.stringify(value));
      } else {
        row.push(value);
      }
    }
  }
  
  sheet.appendRow(row);
}

/**
 * 更新 Phase2.5_Output 行
 * @param {Sheet} sheet - 表格
 * @param {number} rowNum - 行號（1-based）
 * @param {Object} output - 輸出數據
 * @param {Array<string>} headers - 表頭
 * @param {Date} now - 當前時間
 */
function updatePhase2_5OutputRow(sheet, rowNum, output, headers, now) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    
    if (header === "Last_Updated") {
      sheet.getRange(rowNum, i + 1).setValue(now);
    } else if (header !== "Company_Code" && header !== "Company_Name") {
      // 不更新 Company_Code 和 Company_Name（主鍵）
      const key = header.toLowerCase().replace(/_/g, "_");
      const value = output[key] || output[header] || "";
      
      // 如果是 JSON 欄位，轉換為字符串
      if (header === "Recommendations" && Array.isArray(value)) {
        sheet.getRange(rowNum, i + 1).setValue(JSON.stringify(value));
      } else {
        sheet.getRange(rowNum, i + 1).setValue(value);
      }
    }
  }
}
