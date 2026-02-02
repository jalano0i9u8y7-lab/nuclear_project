/**
 * P5 Weekly: Scenario Memory & Safety Lock 模組 ⭐ V8.19 新增
 * 
 * 實現 C2 學習系統斷鏈修復：
 * - extractScenarioSignature：提取情境簽章
 * - getHistoricalScenarios：檢索歷史相似情境
 * - checkSafetyLock：檢查是否觸發 Safety Lock
 * 
 * @version V8.19
 * @date 2026-01-25
 */

/**
 * 提取情境簽章（從當前 context 提取環境特徵）
 * 
 * @param {Object} context - 當前上下文
 * @returns {Object} scenarioSignature - 情境簽章
 */
function extractScenarioSignature(context) {
  try {
    const signature = {
      vix_level: getVIXLevel(context.macro_data?.vix || context.macro_weekly_metrics?.vix || null),
      market_regime: context.worldview?.market_regime || context.worldview?.regime || "UNCERTAIN",
      sector_rotation: extractSectorRotation(context),
      macro_indicators: extractMacroIndicators(context),
      news_sentiment: extractNewsSentiment(context),
      technical_signals: extractTechnicalSignals(context),
      p0_7_time_position: context.p0_7_snapshot?.time_position || null,
      p0_7_turning_point_risk: context.p0_7_snapshot?.turning_point_risk || null,
      defcon_level: context.defcon_level || null
    };
    
    return signature;
    
  } catch (error) {
    Logger.log(`提取情境簽章失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取 VIX 水平分類
 */
function getVIXLevel(vix) {
  if (!vix || isNaN(vix)) return "UNKNOWN";
  if (vix < 15) return "LOW";
  if (vix < 20) return "MEDIUM";
  if (vix < 30) return "HIGH";
  return "EXTREME";
}

/**
 * 提取板塊輪動特徵
 */
function extractSectorRotation(context) {
  const sectorFlow = context.macro_flow_context?.sector_etf_flow || {};
  const flows = context.macro_flow_context?.sector_flows || {};
  
  return {
    dominant_sector: Object.keys(flows).reduce((a, b) => 
      (flows[a]?.weekly_flow_usd || 0) > (flows[b]?.weekly_flow_usd || 0) ? a : b, 
      Object.keys(flows)[0] || "UNKNOWN"
    ),
    total_flow: sectorFlow.weekly_flow_usd || 0,
    sector_count: Object.keys(flows).length
  };
}

/**
 * 提取宏觀指標特徵
 */
function extractMacroIndicators(context) {
  return {
    oil_price: context.macro_data?.commodities?.oil?.value || null,
    dollar_index: context.macro_data?.currencies?.dxy?.value || null,
    bond_yield: context.macro_data?.bonds?.tnx?.value || null
  };
}

/**
 * 提取新聞情緒特徵
 */
function extractNewsSentiment(context) {
  const sentiment = context.stockNewsIndex || {};
  const avgSentiment = Object.values(sentiment).reduce((sum, s) => sum + (s.sentiment_score || 0), 0) / 
    Math.max(Object.keys(sentiment).length, 1);
  
  if (avgSentiment > 0.3) return "POSITIVE";
  if (avgSentiment < -0.3) return "NEGATIVE";
  return "NEUTRAL";
}

/**
 * 提取技術信號特徵
 */
function extractTechnicalSignals(context) {
  return {
    market_trend: context.worldview?.market_trend || "UNKNOWN",
    volatility_regime: context.macro_weekly_metrics?.volatility_regime || "UNKNOWN"
  };
}

/**
 * 檢索歷史相似情境
 * 
 * @param {Object} currentSignature - 當前情境簽章
 * @param {number} maxResults - 最多返回結果數（預設 10）
 * @returns {Array} historicalScenarios - 歷史情境列表
 */
function getHistoricalScenarios(currentSignature, maxResults = 10) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__SCENARIO_MEMORY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly Scenario Memory：表格不存在或為空");
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const scenarioIdCol = headers.indexOf("scenario_id");
    const marketTagsCol = headers.indexOf("market_tags_json");
    const resultSummaryCol = headers.indexOf("result_summary");
    const lessonCol = headers.indexOf("lesson");
    const createdAtCol = headers.indexOf("created_at");
    
    if (scenarioIdCol === -1) {
      Logger.log("P5 Weekly Scenario Memory：表格欄位不完整");
      return [];
    }
    
    const scenarios = [];
    
    // 讀取所有歷史情境並計算相似度
    for (let i = 1; i < rows.length; i++) {
      try {
        const marketTags = rows[i][marketTagsCol] ? 
          (typeof rows[i][marketTagsCol] === 'string' ? JSON.parse(rows[i][marketTagsCol]) : rows[i][marketTagsCol]) : [];
        
        // 計算相似度（基於市場標籤重疊）
        const similarity = calculateSignatureSimilarity(currentSignature, marketTags);
        
        if (similarity > 0.3) {  // 相似度閾值
          scenarios.push({
            scenario_id: rows[i][scenarioIdCol],
            market_tags: marketTags,
            result_summary: rows[i][resultSummaryCol] || "",
            lesson: rows[i][lessonCol] || "",
            created_at: rows[i][createdAtCol] || null,
            similarity: similarity
          });
        }
      } catch (parseError) {
        Logger.log(`解析情境記錄失敗（行 ${i}）：${parseError.message}`);
      }
    }
    
    // 按相似度排序，返回前 maxResults 個
    scenarios.sort((a, b) => b.similarity - a.similarity);
    
    Logger.log(`P5 Weekly Scenario Memory：找到 ${scenarios.length} 個相似情境`);
    
    return scenarios.slice(0, maxResults);
    
  } catch (error) {
    Logger.log(`檢索歷史情境失敗：${error.message}`);
    return [];
  }
}

/**
 * 計算情境簽章相似度
 */
function calculateSignatureSimilarity(signature, marketTags) {
  if (!marketTags || !Array.isArray(marketTags) || marketTags.length === 0) {
    return 0.0;
  }
  
  // 簡化實現：基於市場標籤重疊
  // 實際應該比對 signature 的各個維度
  const signatureTags = [];
  
  if (signature.vix_level === "HIGH" || signature.vix_level === "EXTREME") {
    signatureTags.push("VIX_HIGH");
  }
  if (signature.market_regime === "BEAR_MARKET") {
    signatureTags.push("BEAR_MARKET");
  }
  if (signature.p0_7_turning_point_risk === "HIGH") {
    signatureTags.push("VOLATILE");
  }
  
  // 計算標籤重疊率
  const overlap = marketTags.filter(tag => signatureTags.includes(tag)).length;
  const total = Math.max(signatureTags.length, marketTags.length);
  
  return total > 0 ? overlap / total : 0.0;
}

/**
 * 檢查 Safety Lock（基於歷史情境死亡率）
 * 
 * @param {Object} context - 當前上下文
 * @param {Object} stockData - 股票數據（可選，用於個股級 Safety Lock）
 * @returns {Object} safetyLockResult - Safety Lock 檢查結果
 */
function checkSafetyLock(context, stockData = null) {
  try {
    const signature = extractScenarioSignature(context);
    const historicalScenarios = getHistoricalScenarios(signature, 20);
    
    if (historicalScenarios.length === 0) {
      return {
        safety_lock_active: false,
        mortality_rate: 0.0,
        max_exposure: null,
        reason: "無歷史相似情境"
      };
    }
    
    // 計算死亡率（基於 result_summary 中的負面結果）
    let failureCount = 0;
    let totalCount = historicalScenarios.length;
    
    for (const scenario of historicalScenarios) {
      const resultSummary = scenario.result_summary || "";
      // 簡化實現：檢查 result_summary 中是否包含負面關鍵詞
      if (resultSummary.includes("虧損") || 
          resultSummary.includes("失敗") || 
          resultSummary.includes("mdd") ||
          resultSummary.toLowerCase().includes("loss") ||
          resultSummary.toLowerCase().includes("failure")) {
        failureCount++;
      }
    }
    
    const mortalityRate = totalCount > 0 ? failureCount / totalCount : 0.0;
    const SAFETY_LOCK_THRESHOLD = 0.5;  // 死亡率閾值
    
    if (mortalityRate >= SAFETY_LOCK_THRESHOLD) {
      // 觸發 Safety Lock
      const maxExposure = Math.max(0.10, 0.30 - (mortalityRate - SAFETY_LOCK_THRESHOLD) * 0.40);
      
      Logger.log(`[Safety Lock] 觸發：死亡率=${(mortalityRate * 100).toFixed(1)}%，建議 max_exposure=${(maxExposure * 100).toFixed(1)}%`);
      
      return {
        safety_lock_active: true,
        mortality_rate: mortalityRate,
        max_exposure: maxExposure,
        reason: `歷史相似情境死亡率 ${(mortalityRate * 100).toFixed(1)}% 超過閾值 ${(SAFETY_LOCK_THRESHOLD * 100).toFixed(1)}%`,
        historical_cases: historicalScenarios.slice(0, 5).map(s => ({
          scenario_id: s.scenario_id,
          lesson: s.lesson,
          result_summary: s.result_summary
        }))
      };
    }
    
    return {
      safety_lock_active: false,
      mortality_rate: mortalityRate,
      max_exposure: null,
      reason: `歷史相似情境死亡率 ${(mortalityRate * 100).toFixed(1)}% 低於閾值`
    };
    
  } catch (error) {
    Logger.log(`檢查 Safety Lock 失敗：${error.message}`);
    return {
      safety_lock_active: false,
      mortality_rate: 0.0,
      max_exposure: null,
      reason: `檢查失敗：${error.message}`
    };
  }
}

/**
 * 保存情境到 SCENARIO_MEMORY（在策略執行後調用）
 * 
 * @param {Object} context - 策略執行時的上下文
 * @param {Object} outcome - 策略結果（return、mdd 等）
 * @param {Array} marketTags - 市場標籤
 */
function saveScenarioToMemory(context, outcome, marketTags) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P5__SCENARIO_MEMORY");
    
    if (!sheet) {
      // 創建表格
      sheet = ss.insertSheet("P5__SCENARIO_MEMORY");
      sheet.appendRow([
        "scenario_id",
        "market_tags_json",
        "executive_summary",
        "lesson",
        "result_summary",
        "evidence_ids_json",
        "created_at"
      ]);
      sheet.setFrozenRows(1);
    }
    
    const signature = extractScenarioSignature(context);
    const scenarioId = `SCENARIO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const resultSummary = outcome.return ? 
      `Return: ${(outcome.return * 100).toFixed(2)}%` : 
      (outcome.mdd ? `MDD: ${(outcome.mdd * 100).toFixed(2)}%` : "Unknown");
    
    sheet.appendRow([
      scenarioId,
      JSON.stringify(marketTags || []),
      context.executive_summary || "",
      outcome.lesson || "",
      resultSummary,
      JSON.stringify(outcome.evidence_ids || []),
      new Date()
    ]);
    
    Logger.log(`P5 Weekly Scenario Memory：已保存情境 ${scenarioId}`);
    
  } catch (error) {
    Logger.log(`保存情境到記憶失敗：${error.message}`);
  }
}
