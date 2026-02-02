/**
 * 📊 P5 Weekly: 動態學習機制模組 ⭐ V8.0 增強
 * 
 * 負責動態持續學習機制：
 * - 市場與事件所有分析，事件後都要對照與當初分析策略的相符與背離程度
 * - 作為後續調整權重與認知的依據
 * - 個股策略也要留存並追蹤個股實際股價變化
 * - 從前幾週的策略與後來的股價漲跌變化來學習分析策略的相符與背離程度
 * - 作為後續調整權重與認知的依據
 * 
 * ⭐ V8.0 增強：
 * - AI 模型分析偏移度（預測 vs 實際、方向偏差、幅度偏差、時機偏差）
 * - 配合 P5 Monthly 提供前三個月歷史快照
 * - 雙模型交叉驗證（Claude Sonnet 4.5 + GPT-5.2）
 * 
 * @version SSOT V8.0
 * @date 2025-01-14
 */

// ==========================================
// 個股策略追蹤
// ==========================================

/**
 * 追蹤個股策略（保存策略並準備追蹤）⭐ V8.13 增強：記錄數據來源
 * 
 * @param {Object} stockStrategies - 個股策略結果
 * @param {Object} snapshot - P5 Weekly 快照
 * @param {Object} dataSources - ⭐ V8.13 新增：策略產出時使用的數據來源（用於建立數據-策略-結果追蹤鏈）
 */
function trackStockStrategies(stockStrategies, snapshot, dataSources = {}) {
  try {
    Logger.log(`P5 Weekly：開始追蹤 ${Object.keys(stockStrategies).length} 檔股票的策略`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P5__WEEKLY_STOCK_STRATEGIES");
    
    if (!sheet) {
      sheet = ss.insertSheet("P5__WEEKLY_STOCK_STRATEGIES");
      sheet.appendRow([
        "date",
        "week_id",
        "ticker",
        "strategy",
        "action",
        "target_allocation",
        "current_allocation",
        "confidence",
        "factors_json",
        "order_adjustments_json",
        "reasoning",
        "snapshot_id",
        "data_sources_json",  // ⭐ V8.13 新增：記錄策略使用的數據來源
        "created_at"
      ]);
      sheet.setFrozenRows(1);
    }
    
    const today = new Date();
    const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    const weekId = `WEEK_${Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-'W'ww")}`;
    
    // ⭐ V8.13 新增：記錄策略使用的數據來源（用於建立數據-策略-結果追蹤鏈）
    const dataSourcesRecord = {
      macro_data: dataSources.macro_data ? "USED" : "NOT_USED",
      news_data: dataSources.news_data ? "USED" : "NOT_USED",
      technical_indicators: dataSources.technical_indicators ? "USED" : "NOT_USED",
      derivatives: dataSources.derivatives ? "USED" : "NOT_USED",
      institutional_data: dataSources.institutional_data ? "USED" : "NOT_USED",
      smart_money_data: dataSources.smart_money_data ? "USED" : "NOT_USED",
      worldview: dataSources.worldview ? "USED" : "NOT_USED",
      events: dataSources.events ? "USED" : "NOT_USED",
      stock_news_index: dataSources.stock_news_index ? "USED" : "NOT_USED",  // ⭐ V8.12 新增
      sector_news_index: dataSources.sector_news_index ? "USED" : "NOT_USED",  // ⭐ V8.12 新增
      events_index: dataSources.events_index ? "USED" : "NOT_USED",  // ⭐ V8.12 新增
      macro_weekly_metrics: dataSources.macro_weekly_metrics ? "USED" : "NOT_USED",  // ⭐ V8.12 新增
      technical_weekly_metrics: dataSources.technical_weekly_metrics ? "USED" : "NOT_USED"  // ⭐ V8.12 新增
    };
    
    // 保存每檔股票的策略
    for (const ticker in stockStrategies) {
      const strategy = stockStrategies[ticker];
      
      if (strategy.status === "SUCCESS" || strategy.status === "PROGRAMMATIC") {
        const row = [
          dateStr,
          weekId,
          ticker,
          strategy.strategy || "HOLD",
          strategy.action || "HOLD",
          strategy.target_allocation || null,
          strategy.current_allocation || null,
          strategy.confidence || 0.5,
          JSON.stringify(strategy.factors || {}),
          JSON.stringify(strategy.order_adjustments || []),
          strategy.reasoning || "",
          snapshot.snapshot_id || null,
          JSON.stringify(dataSourcesRecord),  // ⭐ V8.13 新增：記錄數據來源
          new Date()
        ];
        
        sheet.appendRow(row);
      }
    }
    
    Logger.log(`P5 Weekly V8.13：個股策略追蹤完成（保存 ${Object.keys(stockStrategies).length} 檔，已記錄數據來源）`);
    
  } catch (error) {
    Logger.log(`P5 Weekly：追蹤個股策略失敗：${error.message}`);
  }
}

/**
 * AI 模型分析偏移度（預測 vs 實際）⭐ V8.0 新增
 * 
 * @param {Object} strategyData - 策略數據
 * @param {Object} actualData - 實際結果數據
 * @returns {Object} deviationAnalysis - 偏移度分析結果
 */
function analyzeDeviationWithAI(strategyData, actualData) {
  try {
    Logger.log("P5 Weekly：開始 AI 模型分析偏移度");
    
    // 構建偏移度分析 Prompt
    const deviationPrompt = buildDeviationAnalysisPrompt(strategyData, actualData);
    
    // 使用雙模型交叉驗證
    const sonnetJobId = submitP5ToM0JobQueue("P5_WEEKLY_LEARNING", ["SONNET"], {
      phase: "P5_WEEKLY_LEARNING",
      prompt: deviationPrompt,
      strategy_data: strategyData,
      actual_data: actualData,
      analysis_type: "DEVIATION_ANALYSIS"
    });
    
    const gptJobId = submitP5ToM0JobQueue("P5_WEEKLY_LEARNING", ["GPT"], {
      phase: "P5_WEEKLY_LEARNING",
      prompt: deviationPrompt,
      strategy_data: strategyData,
      actual_data: actualData,
      analysis_type: "DEVIATION_ANALYSIS"
    });
    
    // 等待結果（簡化實現）
    const sonnetResult = getM0JobResult(sonnetJobId);
    const gptResult = getM0JobResult(gptJobId);
    
    // 交叉驗證
    const crossValidation = crossValidateDeviationResults(sonnetResult, gptResult);
    
    return {
      sonnet_analysis: sonnetResult?.output || null,
      gpt_analysis: gptResult?.output || null,
      cross_validation: crossValidation,
      timestamp: new Date()
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：AI 模型分析偏移度失敗：${error.message}`);
    return {
      error: error.message,
      timestamp: new Date()
    };
  }
}

/**
 * 構建偏移度分析 Prompt
 * 
 * @param {Object} strategyData - 策略數據
 * @param {Object} actualData - 實際結果數據
 * @returns {string} prompt - AI Prompt
 */
function buildDeviationAnalysisPrompt(strategyData, actualData) {
  return `
你是一位資深的市場分析師，負責進行 Nuclear Project 的 P5 Weekly 偏移度分析。

## 任務目標

分析策略預測與實際結果的偏移度：
1. **方向偏差**：預測方向（看多/看空）是否正確
2. **幅度偏差**：預測幅度是否準確
3. **時機偏差**：預測時機是否準確

## 策略數據

${JSON.stringify(strategyData, null, 2)}

## 實際結果數據

${JSON.stringify(actualData, null, 2)}

## 輸出格式（必須是 JSON）

{
  "direction_deviation": {
    "correct_predictions": 0,
    "incorrect_predictions": 0,
    "accuracy": 0.0-1.0,
    "detailed_analysis": []
  },
  "magnitude_deviation": {
    "avg_deviation": 0.0,
    "max_deviation": 0.0,
    "detailed_analysis": []
  },
  "timing_deviation": {
    "avg_timing_error_days": 0,
    "detailed_analysis": []
  },
  "key_insights": []
}
`;
}

/**
 * 交叉驗證偏移度分析結果
 * 
 * @param {Object} sonnetResult - Sonnet 分析結果
 * @param {Object} gptResult - GPT 分析結果
 * @returns {Object} crossValidation - 交叉驗證結果
 */
function crossValidateDeviationResults(sonnetResult, gptResult) {
  try {
    if (!sonnetResult || !gptResult) {
      return {
        agreement_score: 0.0,
        consensus: {}
      };
    }
    
    const sonnetAnalysis = typeof sonnetResult.output === 'string' ? JSON.parse(sonnetResult.output) : sonnetResult.output;
    const gptAnalysis = typeof gptResult.output === 'string' ? JSON.parse(gptResult.output) : gptResult.output;
    
    // 比較方向準確率
    const sonnetDirectionAccuracy = sonnetAnalysis.direction_deviation?.accuracy || 0;
    const gptDirectionAccuracy = gptAnalysis.direction_deviation?.accuracy || 0;
    
    const directionAccuracyDiff = Math.abs(sonnetDirectionAccuracy - gptDirectionAccuracy);
    const directionAccuracyConsensus = (sonnetDirectionAccuracy + gptDirectionAccuracy) / 2;
    
    return {
      agreement_score: directionAccuracyDiff < 0.1 ? 0.9 : 0.5,  // 如果差異小於 0.1，視為高度一致
      consensus: {
        direction_accuracy: directionAccuracyConsensus,
        magnitude_deviation: (sonnetAnalysis.magnitude_deviation?.avg_deviation || 0 + gptAnalysis.magnitude_deviation?.avg_deviation || 0) / 2,
        timing_deviation: (sonnetAnalysis.timing_deviation?.avg_timing_error_days || 0 + gptAnalysis.timing_deviation?.avg_timing_error_days || 0) / 2
      }
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：交叉驗證偏移度結果失敗：${error.message}`);
    return {
      agreement_score: 0.0,
      consensus: {}
    };
  }
}

/**
 * 獲取 M0 Job 結果（輔助函數，重用 P5 Monthly 的實現）
 * 
 * @param {string} jobId - Job ID
 * @returns {Object|null} result - M0 Job 結果
 */
function getM0JobResult(jobId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("M0__RESULT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const jobIdCol = headers.indexOf("job_id");
    const finalOutputCol = headers.indexOf("final_output");
    
    if (jobIdCol === -1 || finalOutputCol === -1) {
      return null;
    }
    
    // 找到對應的 Job
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rows[i][jobIdCol] === jobId) {
        const finalOutputJson = rows[i][finalOutputCol];
        if (finalOutputJson) {
          try {
            return JSON.parse(finalOutputJson);
          } catch (e) {
            Logger.log(`P5 Weekly：解析 M0 結果失敗：${e.message}`);
            return null;
          }
        }
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`P5 Weekly：獲取 M0 Job 結果失敗：${error.message}`);
    return null;
  }
}

/**
 * 對照策略與實際股價變化（通用函數，支援週/月/季）⭐ V8.13 增強
 * 
 * @param {number} periodsAgo - 對照 N 個時間週期前的策略
 * @param {string} periodType - 時間週期類型（"WEEK"/"MONTH"/"QUARTER"），預設為"WEEK"
 * @returns {Object} comparison - 對照結果
 */
function compareStrategyWithReality(periodsAgo = 1, periodType = "WEEK") {
  try {
    const periodName = periodType === "WEEK" ? "週" : periodType === "MONTH" ? "月" : "季";
    Logger.log(`P5 ${periodType}：對照 ${periodsAgo} ${periodName}前的策略與實際股價變化`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const strategiesSheet = ss.getSheetByName("P5__WEEKLY_STOCK_STRATEGIES");
    const ohlcvSheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!strategiesSheet || strategiesSheet.getLastRow() <= 1) {
      Logger.log(`P5 ${periodType}：無歷史策略數據`);
      return {};
    }
    
    if (!ohlcvSheet || ohlcvSheet.getLastRow() <= 1) {
      Logger.log(`P5 ${periodType}：無 OHLCV 數據`);
      return {};
    }
    
    const today = new Date();
    let targetDate;
    let targetPeriodId;
    
    if (periodType === "WEEK") {
      targetDate = new Date(today.getTime() - periodsAgo * 7 * 24 * 60 * 60 * 1000);
      targetPeriodId = `WEEK_${Utilities.formatDate(targetDate, Session.getScriptTimeZone(), "yyyy-'W'ww")}`;
    } else if (periodType === "MONTH") {
      targetDate = new Date(today);
      targetDate.setMonth(targetDate.getMonth() - periodsAgo);
      targetPeriodId = `MONTH_${Utilities.formatDate(targetDate, Session.getScriptTimeZone(), "yyyy-MM")}`;
    } else if (periodType === "QUARTER") {
      targetDate = new Date(today);
      const quarter = Math.floor(targetDate.getMonth() / 3);
      targetDate.setMonth((quarter - periodsAgo) * 3);
      targetPeriodId = `QUARTER_${targetDate.getFullYear()}_Q${Math.floor(targetDate.getMonth() / 3) + 1}`;
    }
    
    // 讀取目標時間週期的策略
    const strategiesData = strategiesSheet.getDataRange().getValues();
    const strategiesHeaders = strategiesData[0];
    
    const dateCol = strategiesHeaders.indexOf("date");
    const weekIdCol = strategiesHeaders.indexOf("week_id");
    const tickerCol = strategiesHeaders.indexOf("ticker");
    const strategyCol = strategiesHeaders.indexOf("strategy");
    const targetAllocationCol = strategiesHeaders.indexOf("target_allocation");
    
    if (dateCol === -1 || tickerCol === -1 || strategyCol === -1) {
      Logger.log(`P5 ${periodType}：策略表格欄位不完整`);
      return {};
    }
    
    const comparison = {
      period_id: targetPeriodId,
      period_type: periodType,
      strategies_compared: 0,
      aligned_strategies: [],
      misaligned_strategies: [],
      performance_summary: {}
    };
    
    // 找到目標時間週期的策略（根據日期範圍）
    const periodStartDate = new Date(targetDate);
    const periodEndDate = new Date(targetDate);
    
    if (periodType === "WEEK") {
      // 週：找到該週的所有策略
      const weekStart = new Date(periodStartDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 週日
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // 週六
      
      for (let i = 1; i < strategiesData.length; i++) {
        const strategyDate = new Date(strategiesData[i][dateCol]);
        if (strategyDate >= weekStart && strategyDate <= weekEnd) {
          const ticker = strategiesData[i][tickerCol];
          const strategy = strategiesData[i][strategyCol];
          const targetAllocation = strategiesData[i][targetAllocationCol];
          
          // 獲取該股票在策略日期和今天的價格
          const priceAtStrategy = getPriceAtDate(ticker, strategyDate);
          const priceToday = getCurrentPrice(ticker);
          
          if (priceAtStrategy && priceToday) {
            const priceChange = priceToday - priceAtStrategy;
            const priceChangePct = (priceChange / priceAtStrategy) * 100;
            
            // 判斷策略是否與實際結果相符
            const aligned = isStrategyAligned(strategy, priceChangePct);
            
            comparison.strategies_compared++;
            
            const comparisonResult = {
              ticker: ticker,
              strategy: strategy,
              price_at_strategy: priceAtStrategy,
              price_today: priceToday,
              price_change: priceChange,
              price_change_pct: priceChangePct,
              aligned: aligned,
              target_allocation: targetAllocation
            };
            
            if (aligned) {
              comparison.aligned_strategies.push(comparisonResult);
            } else {
              comparison.misaligned_strategies.push(comparisonResult);
            }
          }
        }
      }
    } else if (periodType === "MONTH") {
      // 月：找到該月的所有策略
      periodStartDate.setDate(1); // 月初
      periodEndDate = new Date(periodStartDate);
      periodEndDate.setMonth(periodEndDate.getMonth() + 1);
      periodEndDate.setDate(0); // 月末
      
      for (let i = 1; i < strategiesData.length; i++) {
        const strategyDate = new Date(strategiesData[i][dateCol]);
        if (strategyDate >= periodStartDate && strategyDate <= periodEndDate) {
          const ticker = strategiesData[i][tickerCol];
          const strategy = strategiesData[i][strategyCol];
          const targetAllocation = strategiesData[i][targetAllocationCol];
          
          const priceAtStrategy = getPriceAtDate(ticker, strategyDate);
          const priceToday = getCurrentPrice(ticker);
          
          if (priceAtStrategy && priceToday) {
            const priceChange = priceToday - priceAtStrategy;
            const priceChangePct = (priceChange / priceAtStrategy) * 100;
            const aligned = isStrategyAligned(strategy, priceChangePct);
            
            comparison.strategies_compared++;
            const comparisonResult = {
              ticker: ticker,
              strategy: strategy,
              price_at_strategy: priceAtStrategy,
              price_today: priceToday,
              price_change: priceChange,
              price_change_pct: priceChangePct,
              aligned: aligned,
              target_allocation: targetAllocation
            };
            
            if (aligned) {
              comparison.aligned_strategies.push(comparisonResult);
            } else {
              comparison.misaligned_strategies.push(comparisonResult);
            }
          }
        }
      }
    } else if (periodType === "QUARTER") {
      // 季：找到該季的所有策略
      const quarter = Math.floor(periodStartDate.getMonth() / 3);
      periodStartDate.setMonth(quarter * 3);
      periodStartDate.setDate(1);
      periodEndDate = new Date(periodStartDate);
      periodEndDate.setMonth(periodEndDate.getMonth() + 3);
      periodEndDate.setDate(0);
      
      for (let i = 1; i < strategiesData.length; i++) {
        const strategyDate = new Date(strategiesData[i][dateCol]);
        if (strategyDate >= periodStartDate && strategyDate <= periodEndDate) {
          const ticker = strategiesData[i][tickerCol];
          const strategy = strategiesData[i][strategyCol];
          const targetAllocation = strategiesData[i][targetAllocationCol];
          
          const priceAtStrategy = getPriceAtDate(ticker, strategyDate);
          const priceToday = getCurrentPrice(ticker);
          
          if (priceAtStrategy && priceToday) {
            const priceChange = priceToday - priceAtStrategy;
            const priceChangePct = (priceChange / priceAtStrategy) * 100;
            const aligned = isStrategyAligned(strategy, priceChangePct);
            
            comparison.strategies_compared++;
            const comparisonResult = {
              ticker: ticker,
              strategy: strategy,
              price_at_strategy: priceAtStrategy,
              price_today: priceToday,
              price_change: priceChange,
              price_change_pct: priceChangePct,
              aligned: aligned,
              target_allocation: targetAllocation
            };
            
            if (aligned) {
              comparison.aligned_strategies.push(comparisonResult);
            } else {
              comparison.misaligned_strategies.push(comparisonResult);
            }
          }
        }
      }
    }
    
    // 計算績效摘要
    comparison.performance_summary = {
      total_strategies: comparison.strategies_compared,
      aligned_count: comparison.aligned_strategies.length,
      misaligned_count: comparison.misaligned_strategies.length,
      alignment_rate: comparison.strategies_compared > 0 
        ? (comparison.aligned_strategies.length / comparison.strategies_compared) 
        : 0
    };
    
    Logger.log(`P5 ${periodType}：策略對照完成（對齊率：${(comparison.performance_summary.alignment_rate * 100).toFixed(1)}%）`);
    
    return comparison;
    
  } catch (error) {
    Logger.log(`P5 ${periodType}：對照策略與實際股價變化失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取特定日期的價格
 * 
 * @param {string} ticker - 股票代碼
 * @param {Date} date - 日期
 * @returns {number|null} price - 價格
 */
function getPriceAtDate(ticker, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    const closeCol = headers.indexOf("close");
    
    if (dateCol === -1 || tickerCol === -1 || closeCol === -1) {
      return null;
    }
    
    // 找到最接近該日期的數據
    let closestPrice = null;
    let closestDateDiff = Infinity;
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][tickerCol] === ticker) {
        const rowDate = new Date(rows[i][dateCol]);
        const dateDiff = Math.abs(rowDate - date);
        
        if (dateDiff < closestDateDiff) {
          closestDateDiff = dateDiff;
          closestPrice = parseFloat(rows[i][closeCol]);
        }
      }
    }
    
    return closestPrice;
    
  } catch (error) {
    Logger.log(`P5 Weekly：獲取特定日期價格失敗（${ticker}）：${error.message}`);
    return null;
  }
}

/**
 * 判斷策略是否與實際結果相符
 * 
 * @param {string} strategy - 策略類型（INCREASE/DECREASE/HOLD/EXIT）
 * @param {number} priceChangePct - 實際股價變化百分比
 * @returns {boolean} aligned - 是否相符
 */
function isStrategyAligned(strategy, priceChangePct) {
  // 簡化邏輯：
  // INCREASE：股價上漲 > 2% 為相符
  // DECREASE：股價下跌 > 2% 為相符
  // HOLD：股價變化在 -2% 到 2% 之間為相符
  // EXIT：股價下跌 > 5% 為相符
  
  if (strategy === "INCREASE") {
    return priceChangePct > 2;
  } else if (strategy === "DECREASE") {
    return priceChangePct < -2;
  } else if (strategy === "HOLD") {
    return Math.abs(priceChangePct) <= 2;
  } else if (strategy === "EXIT") {
    return priceChangePct < -5;
  }
  
  return false;
}

// ==========================================
// 權重動態調整
// ==========================================

/**
 * 更新因子權重（根據學習結果）
 * 
 * @param {Object} learningResults - 學習結果
 * @returns {Object} updatedWeights - 更新後的權重
 */
function updateWeightsAndBeliefs(learningResults) {
  try {
    Logger.log("P5 Weekly：開始更新因子權重");
    
    // 從學習結果中提取權重調整建議
    const weightAdjustments = extractWeightAdjustments(learningResults);
    
    // 更新權重配置（保存到 PropertiesService 或表格）
    const updatedWeights = applyWeightAdjustments(weightAdjustments);
    
    Logger.log("P5 Weekly：因子權重更新完成");
    
    return updatedWeights;
    
  } catch (error) {
    Logger.log(`P5 Weekly：更新因子權重失敗：${error.message}`);
    return {};
  }
}

/**
 * 從學習結果中提取權重調整建議
 * 
 * @param {Object} learningResults - 學習結果
 * @returns {Object} adjustments - 權重調整建議
 */
function extractWeightAdjustments(learningResults) {
  // 簡化實現：從對照結果中提取調整建議
  // 實際應該由 AI 分析學習結果後生成
  
  const adjustments = {
    worldview: 0,
    event: 0,
    technical: 0,
    fundamental: 0,
    institutional: 0
  };
  
  // 分析對齊和未對齊的策略，提取權重調整建議
  const alignedStrategies = learningResults.aligned_strategies || [];
  const misalignedStrategies = learningResults.misaligned_strategies || [];
  
  // 簡化邏輯：如果某個因子的策略對齊率高，增加其權重
  // 實際應該更複雜的分析
  
  return adjustments;
}

/**
 * 應用權重調整
 * 
 * @param {Object} adjustments - 權重調整建議
 * @returns {Object} updatedWeights - 更新後的權重
 */
function applyWeightAdjustments(adjustments) {
  try {
    // 從配置中讀取當前權重
    const currentWeights = P5_WEEKLY_STOCK_STRATEGY_CONFIG.FACTOR_WEIGHTS;
    
    // 應用調整（限制調整幅度，避免劇烈變化）
    const maxAdjustment = 0.1;  // 每次最多調整 10%
    
    const updatedWeights = {};
    for (const factor in currentWeights) {
      const adjustment = adjustments[factor] || 0;
      const adjustedValue = currentWeights[factor] + Math.max(-maxAdjustment, Math.min(maxAdjustment, adjustment));
      
      // 確保權重在合理範圍內（0 到 1）
      updatedWeights[factor] = Math.max(0, Math.min(1, adjustedValue));
    }
    
    // 歸一化權重（確保總和為 1）
    const totalWeight = Object.values(updatedWeights).reduce((a, b) => a + b, 0);
    if (totalWeight > 0) {
      for (const factor in updatedWeights) {
        updatedWeights[factor] = updatedWeights[factor] / totalWeight;
      }
    }
    
    // 保存更新後的權重（可以保存到 PropertiesService 或表格）
    // 這裡簡化為只記錄日誌
    Logger.log(`P5 Weekly：權重已更新：${JSON.stringify(updatedWeights)}`);
    
    return updatedWeights;
    
  } catch (error) {
    Logger.log(`P5 Weekly：應用權重調整失敗：${error.message}`);
    return P5_WEEKLY_STOCK_STRATEGY_CONFIG.FACTOR_WEIGHTS;
  }
}

// ==========================================
// 策略比對紀錄保存 ⭐ V8.13 新增
// ==========================================

/**
 * 保存策略比對結果到學習日誌 ⭐ V8.13 新增
 * 
 * 這是動態記憶學習系統的核心：將每次比對後學習到的觀念都儲存在永久大腦之中
 * 
 * @param {Object} comparison - 策略比對結果（來自 compareStrategyWithReality）
 * @param {string} frequency - 頻率（WEEKLY/MONTHLY/QUARTERLY）
 */
function saveStrategyComparisonToLearningLog(comparison, frequency = "WEEKLY") {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P5__LEARNING_LOG");
    
    if (!sheet) {
      sheet = ss.insertSheet("P5__LEARNING_LOG");
      sheet.appendRow(P5_LEARNING_LOG_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // 提取比對結果
    const performanceSummary = comparison.performance_summary || {};
    const alignedStrategies = comparison.aligned_strategies || [];
    const misalignedStrategies = comparison.misaligned_strategies || [];
    
    // 構建學習點
    const keyLessons = [];
    if (performanceSummary.alignment_rate !== undefined) {
      keyLessons.push(`${frequency}策略對齊率：${(performanceSummary.alignment_rate * 100).toFixed(1)}%`);
    }
    if (alignedStrategies.length > 0) {
      keyLessons.push(`對齊策略數量：${alignedStrategies.length}（策略與市場反應相符）`);
    }
    if (misalignedStrategies.length > 0) {
      keyLessons.push(`未對齊策略數量：${misalignedStrategies.length}（策略與市場反應不符，需要學習）`);
    }
    
    // 構建系統化學習數據
    const systematicLearning = {
      strategy_comparison: {
        week_id: comparison.week_id || null,
        strategies_compared: performanceSummary.total_strategies || 0,
        aligned_count: performanceSummary.aligned_count || 0,
        misaligned_count: performanceSummary.misaligned_count || 0,
        alignment_rate: performanceSummary.alignment_rate || null,
        aligned_strategies: alignedStrategies,
        misaligned_strategies: misalignedStrategies
      },
      frequency: frequency,
      comparison_date: dateStr
    };
    
    // 構建信念驗證
    const beliefVerification = {
      strategy_alignment_rate: performanceSummary.alignment_rate || null,
      verified_strategies: alignedStrategies.length,
      unverified_strategies: misalignedStrategies.length,
      note: `${frequency}策略比對：對比前一${frequency === "WEEKLY" ? "週" : frequency === "MONTHLY" ? "月" : "季"}的策略與市場真實反應`
    };
    
    const row = [
      dateStr,
      frequency,
      "STRATEGY_COMPARISON",  // learning_type
      JSON.stringify([]),  // success_cases_json
      JSON.stringify(misalignedStrategies),  // failure_cases_json（未對齊的策略）
      JSON.stringify(keyLessons),  // key_lessons_json
      JSON.stringify(beliefVerification),  // belief_verification_json
      JSON.stringify(systematicLearning),  // systematic_learning_json
      JSON.stringify({}),  // event_weight_calibration_json
      JSON.stringify({}),  // next_quarter_suggestions_json
      new Date()
    ];
    
    sheet.appendRow(row);
    Logger.log(`P5 ${frequency} V8.13：策略比對紀錄已保存到學習日誌（對齊率：${((performanceSummary.alignment_rate || 0) * 100).toFixed(1)}%）`);
    
  } catch (error) {
    Logger.log(`P5 ${frequency} V8.13：保存策略比對紀錄失敗：${error.message}`);
  }
}

// ==========================================
// 學習日誌保存（擴展版）
// ==========================================

/**
 * 保存 P5 Weekly 學習日誌（擴展版，包含個股策略追蹤）
 * 
 * @param {Object} p5WeeklyOutput - P5 Weekly 的最終輸出
 * @param {Object} snapshot - P5 Weekly 快照
 * @param {Object} stockStrategies - 個股策略結果
 */
function saveP5WeeklyLearningLog(p5WeeklyOutput, snapshot, stockStrategies = {}) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P5__LEARNING_LOG");
    
    if (!sheet) {
      sheet = ss.insertSheet("P5__LEARNING_LOG");
      sheet.appendRow(P5_LEARNING_LOG_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // 提取學習相關數據
    const beliefUpdate = p5WeeklyOutput.belief_update || {};
    const causalityChain = p5WeeklyOutput.causality_chain?.chains || [];
    const riskEvents = p5WeeklyOutput.risk_events || [];
    
    const successCases = [];
    const failureCases = [];
    const keyLessons = [];
    
    // 從信念更新中提取成功案例和教訓
    if (beliefUpdate.updated_beliefs && Array.isArray(beliefUpdate.updated_beliefs)) {
      for (const belief of beliefUpdate.updated_beliefs) {
        if (belief.confidence_increase) {
          successCases.push({
            belief: belief.belief || belief,
            confidence_change: belief.confidence_increase
          });
        }
        if (belief.lesson) {
          keyLessons.push(belief.lesson);
        }
      }
    }
    
    // 從個股策略中提取學習點
    const stockStrategyLessons = extractLessonsFromStockStrategies(stockStrategies);
    keyLessons.push(...stockStrategyLessons);
    
    // 從因果鏈和風險事件中提取模式和教訓
    keyLessons.push(...extractKeyPatterns(causalityChain, riskEvents));
    
    // 對照歷史策略（如果有的話）
    const strategyComparison = compareStrategyWithReality(1);  // 對照 1 週前的策略
    
    // 信念驗證（對比歷史預測與實際結果）
    const beliefVerification = {
      verified_beliefs: [],
      unverified_beliefs: [],
      strategy_alignment_rate: strategyComparison.performance_summary?.alignment_rate || null,
      note: "需要對比歷史預測與實際結果進行驗證"
    };
    
    // ⭐ V8.9 新增：獲取機構評級可信度摘要
    const institutionalCredibility = {};
    if (typeof getInstitutionalCredibilitySummary === "function") {
      const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
      institutionalCredibility.institutional_ratings_credibility = getInstitutionalCredibilitySummary(dateStr);
    }
    
    // 系統化學習（從本週分析中提取）
    const systematicLearning = {
      market_regime_shifts: p5WeeklyOutput.market_analysis?.market_regime || null,
      new_causal_links: causalityChain,
      emerging_risks: riskEvents,
      institutional_signal_strength: p5WeeklyOutput.institutional_insights?.weighted_signal || null,
      institutional_sentiment_data: p5WeeklyOutput.market_sentiment_indicators?.institutional_sentiment || {}, // V8.6 新增：機構言行一致性分析數據
      institutional_ratings_credibility: institutionalCredibility.institutional_ratings_credibility || {}, // ⭐ V8.9 新增：機構評級可信度評分
      strategy_performance: strategyComparison.performance_summary || {}
    };
    
    // 權重調整建議
    const weightAdjustments = extractWeightAdjustments(strategyComparison);
    const eventWeightCalibration = {
      current_weights: P5_WEEKLY_STOCK_STRATEGY_CONFIG.FACTOR_WEIGHTS,
      suggested_adjustments: weightAdjustments,
      adjustment_reason: "基於策略對照結果"
    };
    
    const row = [
      dateStr,
      "WEEKLY",
      "BELIEF_UPDATE_AND_STRATEGY_TRACKING",
      JSON.stringify(successCases),
      JSON.stringify(failureCases),
      JSON.stringify(keyLessons),
      JSON.stringify(beliefVerification),
      JSON.stringify(systematicLearning),
      JSON.stringify(eventWeightCalibration),
      JSON.stringify({}),  // next_quarter_suggestions_json
      new Date()
    ];
    
    sheet.appendRow(row);
    Logger.log(`P5 Weekly：學習日誌已保存（成功案例：${successCases.length}，關鍵教訓：${keyLessons.length}，策略對齊率：${(strategyComparison.performance_summary?.alignment_rate || 0) * 100}%）`);
    
  } catch (error) {
    Logger.log(`P5 Weekly：保存學習日誌失敗：${error.message}`);
  }
}

/**
 * 從個股策略中提取學習點
 * 
 * @param {Object} stockStrategies - 個股策略結果
 * @returns {Array} lessons - 學習點列表
 */
function extractLessonsFromStockStrategies(stockStrategies) {
  const lessons = [];
  
  // 分析策略模式
  const strategyCounts = {
    INCREASE: 0,
    DECREASE: 0,
    HOLD: 0,
    EXIT: 0
  };
  
  for (const ticker in stockStrategies) {
    const strategy = stockStrategies[ticker];
    if (strategy.strategy) {
      strategyCounts[strategy.strategy] = (strategyCounts[strategy.strategy] || 0) + 1;
    }
  }
  
  // 提取學習點
  if (strategyCounts.INCREASE > strategyCounts.DECREASE) {
    lessons.push("本週策略傾向於加碼，反映市場樂觀情緒");
  } else if (strategyCounts.DECREASE > strategyCounts.INCREASE) {
    lessons.push("本週策略傾向於減碼，反映市場謹慎情緒");
  }
  
  return lessons;
}

/**
 * 從因果鏈和風險事件中提取關鍵模式和教訓
 * 
 * @param {Array} causalityChain - 因果鏈數據
 * @param {Array} riskEvents - 風險事件數據
 * @returns {Array} patterns - 提取的關鍵模式和教訓
 */
function extractKeyPatterns(causalityChain, riskEvents) {
  const patterns = [];
  
  for (const chain of causalityChain) {
    patterns.push(`因果鏈：${chain.cause} 導致 ${chain.effect} (信心度: ${chain.confidence})`);
  }
  
  for (const event of riskEvents) {
    patterns.push(`風險事件：${event.event} (嚴重性: ${event.severity}, 概率: ${event.probability})`);
  }
  
  return patterns;
}
