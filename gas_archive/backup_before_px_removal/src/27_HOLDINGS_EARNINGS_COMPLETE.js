/**
 * 📊 持股財報完整分析系統 ⭐ V8.0 新增（合併版）
 * 
 * 功能（一次完成）：
 * 1. 生成持股清單中個股過去五年內財報歷史經驗
 * 2. 預估今年財報日期（基於季度結束日期 + 規則）
 * 3. 納入行事曆監控制度
 * 4. 建立個股索引與學習機制
 * 
 * 執行時機：P4 完成之後
 * 正式模式：Sonnet 4.5 + Batch API
 * 測試模式：Gemini 2.5 Lite（不使用 Batch）
 * 
 * @version SSOT V8.0
 * @date 2026-01-19
 */

// ==========================================
// 配置
// ==========================================

const HOLDINGS_EARNINGS_COMPLETE_CONFIG = {
  // 財報日期預估規則
  earnings_date_estimation: {
    // 財報發表日 ≈ 季度結束後第 25–35 天
    earnings_announcement_days_range: [25, 35],
    // 公告日期通常在季末後第 10–20 天
    announcement_date_days_range: [10, 20],
    // Q4 財報通常比其他季度晚（延遲 5-10 天）
    q4_delay_days: [5, 10]
  },
  
  // 季度結束日期（標準美股）
  quarter_end_dates: {
    Q1: { month: 2, day: 28 },  // 3/31（但用 2/28 作為基準，因為月份是 0-based）
    Q2: { month: 5, day: 30 },  // 6/30
    Q3: { month: 8, day: 30 },  // 9/30
    Q4: { month: 11, day: 31 }  // 12/31
  },
  
  // AI 模型配置
  ai_models: {
    production: {
      executor: "SONNET",  // Sonnet 4.5
      auditor: "GPT",
      use_batch: true
    },
    test: {
      executor: "GEMINI_FLASH_LITE",  // Gemini 2.5 Lite
      auditor: "GEMINI_FLASH_LITE",  // ⭐ V8.17 修正：測試模式下審查者也使用 Gemini 2.5 Lite
      use_batch: false
    }
  },
  
  // Batch 配置
  batch_config: {
    batch_size: 10,  // 每批處理 10 檔股票
    max_retries: 3
  }
};

// ==========================================
// 主執行函數（P4 完成後調用）
// ==========================================

/**
 * 持股財報完整分析（P4 完成後調用）
 * @param {Object} params - 參數
 * @param {Array} params.tickers - 股票列表（從 P4 讀取）
 * @param {boolean} params.is_test_mode - 是否為測試模式
 * @returns {Object} 執行結果
 */
function HoldingsEarningsComplete_Analysis(params) {
  const startTime = Date.now();
  
  try {
    const { tickers = [], is_test_mode = false } = params;
    
    Logger.log(`="`.repeat(60));
    Logger.log(`📊 開始持股財報完整分析：共 ${tickers.length} 檔股票`);
    Logger.log(`模式：${is_test_mode ? "測試模式（Gemini 2.5 Lite）" : "正式模式（Sonnet 4.5 + Batch）"}`);
    Logger.log(`="`.repeat(60));
    
    if (!tickers || tickers.length === 0) {
      throw new Error("股票列表為空，無法執行分析");
    }
    
    // 選擇執行模式
    const config = is_test_mode ? 
      HOLDINGS_EARNINGS_COMPLETE_CONFIG.ai_models.test : 
      HOLDINGS_EARNINGS_COMPLETE_CONFIG.ai_models.production;
    
    // 執行分析
    let results;
    if (config.use_batch && !is_test_mode) {
      // 正式模式：使用 Batch API
      results = executeHoldingsEarningsBatch(tickers, config);
    } else {
      // 測試模式：同步執行
      results = executeHoldingsEarningsSync(tickers, config);
    }
    
    // 保存結果
    saveHoldingsEarningsResults(results);
    
    // 建立索引
    createHoldingsEarningsIndex(results);
    
    const duration = Date.now() - startTime;
    Logger.log(`="`.repeat(60));
    Logger.log(`✅ 持股財報完整分析完成：成功 ${results.success}，失敗 ${results.failed}`);
    Logger.log(`耗時：${duration}ms`);
    Logger.log(`="`.repeat(60));
    
    return {
      status: "COMPLETED",
      success: results.success,
      failed: results.failed,
      total_tickers: tickers.length,
      total_earnings_dates: results.total_earnings_dates,
      total_historical_experiences: results.total_historical_experiences,
      execution_time_ms: duration
    };
    
  } catch (error) {
    Logger.log(`❌ 持股財報完整分析失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// Batch 執行（正式模式）
// ==========================================

/**
 * 使用 Batch API 執行持股財報分析
 * @param {Array} tickers - 股票列表
 * @param {Object} config - AI 模型配置
 * @returns {Object} 執行結果
 */
function executeHoldingsEarningsBatch(tickers, config) {
  try {
    Logger.log(`開始 Batch 執行：共 ${tickers.length} 檔股票`);
    
    const results = {
      success: 0,
      failed: 0,
      total_earnings_dates: 0,
      total_historical_experiences: 0,
      ticker_results: {}
    };
    
    // 分批處理
    const batchSize = HOLDINGS_EARNINGS_COMPLETE_CONFIG.batch_config.batch_size;
    const batches = [];
    
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      batches.push(batch);
    }
    
    Logger.log(`共 ${batches.length} 個批次，每批 ${batchSize} 檔股票`);
    
    // 構建 Batch 請求
    const batchRequests = [];
    for (const batch of batches) {
      const batchPrompt = buildBatchPrompt(batch);
      const batchRequest = {
        batch_number: batches.indexOf(batch) + 1,
        tickers: batch,
        prompt: batchPrompt,
        config: config
      };
      batchRequests.push(batchRequest);
    }
    
    // 提交到 M0 Batch Job Queue
    const batchJobId = submitHoldingsEarningsBatchJob(batchRequests, config);
    
    // 等待 Batch 完成
    const batchResults = waitForHoldingsEarningsBatchResult(batchJobId);
    
    // 處理結果
    for (const batchResult of batchResults) {
      for (const tickerResult of batchResult.ticker_results) {
        const ticker = tickerResult.ticker;
        
        try {
          // 解析結果
          const parsedResult = parseBatchResult(tickerResult);
          
          // 保存財報日期
          if (parsedResult.earnings_dates && parsedResult.earnings_dates.length > 0) {
            saveEarningsDatesToCalendar(ticker, parsedResult.earnings_dates);
            results.total_earnings_dates += parsedResult.earnings_dates.length;
          }
          
          // 保存歷史經驗
          if (parsedResult.historical_experiences && parsedResult.historical_experiences.length > 0) {
            for (const exp of parsedResult.historical_experiences) {
              saveEarningsHistoricalExperience(ticker, exp.quarter, exp.experience);
            }
            results.total_historical_experiences += parsedResult.historical_experiences.length;
          }
          
          results.ticker_results[ticker] = parsedResult;
          results.success++;
          
        } catch (error) {
          Logger.log(`處理 ${ticker} 結果失敗：${error.message}`);
          results.failed++;
        }
      }
    }
    
    return results;
    
  } catch (error) {
    Logger.log(`Batch 執行失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 同步執行（測試模式）
// ==========================================

/**
 * 同步執行持股財報分析（測試模式）
 * @param {Array} tickers - 股票列表
 * @param {Object} config - AI 模型配置
 * @returns {Object} 執行結果
 */
function executeHoldingsEarningsSync(tickers, config) {
  try {
    Logger.log(`開始同步執行：共 ${tickers.length} 檔股票`);
    
    const results = {
      success: 0,
      failed: 0,
      total_earnings_dates: 0,
      total_historical_experiences: 0,
      ticker_results: {}
    };
    
    // 逐檔處理
    for (const ticker of tickers) {
      try {
        Logger.log(`處理 ${ticker}...`);
        
        // 構建 Prompt
        const prompt = buildSingleTickerPrompt(ticker);
        
        // 提交到 M0 Job Queue
        const jobId = submitP5ToM0JobQueue(
          "HOLDINGS_EARNINGS_COMPLETE",
          [config.executor, config.auditor],
          {
            ticker: ticker,
            task_prompt: prompt,
            model: config.executor
          }
        );
        
        // 等待結果
        const result = waitForM0JobResult(jobId);
        
        if (result && result.final_output) {
          // 解析結果
          const parsedResult = parseSingleTickerResult(ticker, result.final_output);
          
          // 保存財報日期
          if (parsedResult.earnings_dates && parsedResult.earnings_dates.length > 0) {
            saveEarningsDatesToCalendar(ticker, parsedResult.earnings_dates);
            results.total_earnings_dates += parsedResult.earnings_dates.length;
          }
          
          // 保存歷史經驗
          if (parsedResult.historical_experiences && parsedResult.historical_experiences.length > 0) {
            for (const exp of parsedResult.historical_experiences) {
              saveEarningsHistoricalExperience(ticker, exp.quarter, exp.experience);
            }
            results.total_historical_experiences += parsedResult.historical_experiences.length;
          }
          
          results.ticker_results[ticker] = parsedResult;
          results.success++;
          
        } else {
          throw new Error("AI 分析失敗：無有效輸出");
        }
        
      } catch (error) {
        Logger.log(`處理 ${ticker} 失敗：${error.message}`);
        results.failed++;
      }
      
      // 測試模式：批次間延遲
      Utilities.sleep(500);
    }
    
    return results;
    
  } catch (error) {
    Logger.log(`同步執行失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// Prompt 構建
// ==========================================

/**
 * 構建單檔股票 Prompt
 * @param {string} ticker - 股票代碼
 * @returns {string} Prompt
 */
function buildSingleTickerPrompt(ticker) {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  
  // 計算預估財報日期（基於規則）
  const estimatedDates = calculateEstimatedEarningsDates(ticker, currentYear, nextYear);
  
  return `你是財報分析專家。請為 ${ticker} 完成以下兩個任務：

## 任務 1：生成過去五年內財報歷史經驗

請分析 ${ticker} 在過去五年內（${currentYear - 5} 至 ${currentYear - 1}）各季度財報的歷史市場反應，包括：

1. **歷史 Beat/Miss 機率**：
   - 各季度財報 beat 預期的機率
   - 各季度財報 miss 預期的機率
   - 平均 beat/miss 幅度

2. **歷史市場反應**：
   - 財報公布當天的平均漲跌幅
   - 財報公布後 3 天的平均漲跌幅
   - 財報公布後 7 天的平均漲跌幅
   - 上漲機率（財報後 7 天內）

3. **關鍵指標關注點**：
   - 哪些指標（營收、EPS、指引等）對市場反應影響最大

4. **風險警示**：
   - 歷史上有哪些異常情況
   - 這些異常情況的市場反應如何

## 任務 2：預估今年財報日期

基於以下預估規則和歷史節奏，預估 ${ticker} 在 ${currentYear} 和 ${nextYear} 年的財報日期：

**預估規則**：
- 財報發表日 ≈ 季度結束後第 25–35 天
- 公告日期通常在季末後第 10–20 天
- Q4 財報通常比其他季度晚 5-10 天

**預估日期（基於標準規則）**：
${JSON.stringify(estimatedDates, null, 2)}

**注意**：
- 如果 ${ticker} 有固定的歷史節奏（例如：每年同一週、同一個星期幾），請優先使用歷史節奏
- 如果無法確定，使用預估規則
- 如果使用內建知識或搜尋獲取實際日期，請標記 status 為 "CONFIRMED" 並提高 confidence

## 輸出格式

請以 JSON 格式輸出：

\`\`\`json
{
  "ticker": "${ticker}",
  "historical_experiences": [
    {
      "quarter": "Q1",
      "fiscal_year": 2023,
      "beat_miss_statistics": {
        "beat_probability": 0.7,
        "miss_probability": 0.3,
        "average_beat_magnitude": 0.05,
        "average_miss_magnitude": -0.03
      },
      "market_reaction": {
        "day_0_avg_change": 0.02,
        "day_3_avg_change": 0.05,
        "day_7_avg_change": 0.08,
        "positive_probability": 0.65
      },
      "key_metrics_focus": [
        {
          "metric": "Revenue",
          "impact_weight": 0.4,
          "description": "營收 beat/miss 對市場反應影響最大"
        }
      ],
      "risk_warnings": [
        {
          "type": "GUIDANCE_DOWNGRADE",
          "frequency": 0.2,
          "market_reaction": -0.15,
          "description": "指引下調會導致平均 -15% 的市場反應"
        }
      ]
    }
  ],
  "earnings_dates": [
    {
      "quarter": "Q1",
      "fiscal_year": ${currentYear},
      "estimated_earnings_date": "2025-05-23",
      "estimated_announcement_date": "2025-04-20",
      "time": "AFTER_HOURS",
      "status": "ESTIMATED",
      "data_source": "AI_INFERRED",
      "confidence": 0.8,
      "historical_pattern": "通常在季末後第 30 天公布"
    }
  ],
  "confidence": 0.8,
  "data_source": "AI_INFERRED",
  "generated_at": "${new Date().toISOString()}"
}
\`\`\`

**注意**：如果某些數據無法確定，請標記為 null 或使用合理的估計值，並在 confidence 欄位中反映不確定性。`;
}

/**
 * 構建 Batch Prompt
 * @param {Array} tickers - 股票列表
 * @returns {string} Prompt
 */
function buildBatchPrompt(tickers) {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  
  const tickerPrompts = tickers.map(ticker => {
    const estimatedDates = calculateEstimatedEarningsDates(ticker, currentYear, nextYear);
    return {
      ticker: ticker,
      estimated_dates: estimatedDates,
      prompt: buildSingleTickerPrompt(ticker)
    };
  });
  
  return `你是財報分析專家。請為以下 ${tickers.length} 檔股票完成分析：

${tickerPrompts.map(tp => `## ${tp.ticker}\n\n${tp.prompt}`).join("\n\n---\n\n")}

## 輸出格式

請為每檔股票輸出獨立的 JSON 對象，格式如下：

\`\`\`json
{
  "results": [
    {
      "ticker": "AAPL",
      "historical_experiences": [...],
      "earnings_dates": [...]
    },
    {
      "ticker": "MSFT",
      "historical_experiences": [...],
      "earnings_dates": [...]
    }
  ]
}
\`\`\``;
}

// ==========================================
// 財報日期預估邏輯
// ==========================================

/**
 * 計算預估財報日期（基於規則）
 * @param {string} ticker - 股票代碼
 * @param {number} currentYear - 當前年份
 * @param {number} nextYear - 下一年份
 * @returns {Array} 預估日期列表
 */
function calculateEstimatedEarningsDates(ticker, currentYear, nextYear) {
  const estimatedDates = [];
  const quarters = ["Q1", "Q2", "Q3", "Q4"];
  const years = [currentYear, nextYear];
  
  for (const year of years) {
    for (const quarter of quarters) {
      const quarterEnd = getQuarterEndDate(quarter, year);
      const isQ4 = quarter === "Q4";
      
      // 財報發表日：季度結束後 25-35 天（Q4 延遲 5-10 天）
      const earningsDays = isQ4 ? 
        HOLDINGS_EARNINGS_COMPLETE_CONFIG.earnings_date_estimation.earnings_announcement_days_range[1] + 
        HOLDINGS_EARNINGS_COMPLETE_CONFIG.earnings_date_estimation.q4_delay_days[1] :
        HOLDINGS_EARNINGS_COMPLETE_CONFIG.earnings_date_estimation.earnings_announcement_days_range[1];
      
      const estimatedEarningsDate = new Date(quarterEnd);
      estimatedEarningsDate.setDate(estimatedEarningsDate.getDate() + earningsDays);
      
      // 公告日期：季末後 10-20 天
      const announcementDays = HOLDINGS_EARNINGS_COMPLETE_CONFIG.earnings_date_estimation.announcement_date_days_range[1];
      const estimatedAnnouncementDate = new Date(quarterEnd);
      estimatedAnnouncementDate.setDate(estimatedAnnouncementDate.getDate() + announcementDays);
      
      estimatedDates.push({
        quarter: quarter,
        fiscal_year: year,
        quarter_end_date: Utilities.formatDate(quarterEnd, Session.getScriptTimeZone(), "yyyy-MM-dd"),
        estimated_earnings_date: Utilities.formatDate(estimatedEarningsDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
        estimated_announcement_date: Utilities.formatDate(estimatedAnnouncementDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
        estimation_rule: isQ4 ? "Q4_DELAYED" : "STANDARD"
      });
    }
  }
  
  return estimatedDates;
}

/**
 * 獲取季度結束日期
 * @param {string} quarter - 季度（Q1, Q2, Q3, Q4）
 * @param {number} year - 年份
 * @returns {Date} 季度結束日期
 */
function getQuarterEndDate(quarter, year) {
  const config = HOLDINGS_EARNINGS_COMPLETE_CONFIG.quarter_end_dates[quarter];
  const date = new Date(year, config.month, config.day);
  
  // 處理閏年（Q1 結束日期）
  if (quarter === "Q1" && !isLeapYear(year) && config.day === 28) {
    date.setDate(28);  // 非閏年 2 月只有 28 天
  }
  
  return date;
}

/**
 * 判斷是否為閏年
 * @param {number} year - 年份
 * @returns {boolean} 是否為閏年
 */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

// ==========================================
// 結果解析
// ==========================================

/**
 * 解析單檔股票結果
 * @param {string} ticker - 股票代碼
 * @param {*} output - AI 輸出
 * @returns {Object} 解析後的結果
 */
function parseSingleTickerResult(ticker, output) {
  try {
    let jsonString = typeof output === 'string' ? output : JSON.stringify(output);
    
    // 移除可能的 markdown 代碼塊
    if (jsonString.includes('```json')) {
      jsonString = jsonString.replace(/```json\s*/gi, '').replace(/\s*```/g, '');
    } else if (jsonString.includes('```')) {
      jsonString = jsonString.replace(/```\s*/g, '');
    }
    
    const data = JSON.parse(jsonString);
    
    // 驗證必要欄位
    if (!data.ticker || (!data.historical_experiences && !data.earnings_dates)) {
      throw new Error("AI 輸出格式不正確：缺少必要欄位");
    }
    
    return {
      ticker: ticker,
      historical_experiences: data.historical_experiences || [],
      earnings_dates: data.earnings_dates || [],
      confidence: data.confidence || 0.5,
      data_source: data.data_source || "AI_INFERRED"
    };
    
  } catch (error) {
    Logger.log(`解析 ${ticker} 結果失敗：${error.message}`);
    throw error;
  }
}

/**
 * 解析 Batch 結果
 * @param {Object} tickerResult - 單檔股票結果
 * @returns {Object} 解析後的結果
 */
function parseBatchResult(tickerResult) {
  return parseSingleTickerResult(tickerResult.ticker, tickerResult.output);
}

// ==========================================
// Batch Job 管理
// ==========================================

/**
 * 提交 Batch Job
 * @param {Array} batchRequests - Batch 請求列表
 * @param {Object} config - AI 模型配置
 * @returns {string} Batch Job ID
 */
function submitHoldingsEarningsBatchJob(batchRequests, config) {
  // 這裡應該調用 M0 Batch API
  // 暫時使用簡化實現
  const batchJobId = `BATCH_HOLDINGS_EARNINGS_${Date.now()}`;
  
  Logger.log(`提交 Batch Job：${batchJobId}，共 ${batchRequests.length} 個批次`);
  
  // TODO: 實現實際的 Batch API 提交邏輯
  // 應該調用 executeBatchJob 或類似的函數
  
  return batchJobId;
}

/**
 * 等待 Batch 結果
 * @param {string} batchJobId - Batch Job ID
 * @returns {Array} Batch 結果列表
 */
function waitForHoldingsEarningsBatchResult(batchJobId) {
  // TODO: 實現實際的 Batch 結果等待邏輯
  // 應該輪詢 Batch Job 狀態，直到完成
  
  Logger.log(`等待 Batch Job 結果：${batchJobId}`);
  
  // 暫時返回空結果
  return [];
}

// ==========================================
// 數據保存（重用現有函數）
// ==========================================

/**
 * 保存財報日期到行事曆（重用 27_HOLDINGS_EARNINGS_GENERATOR.js 中的函數）
 */
function saveEarningsDatesToCalendar(ticker, earningsDates) {
  // 調用 27_HOLDINGS_EARNINGS_GENERATOR.js 中的函數
  if (typeof saveEarningsDatesToCalendar_Original === 'function') {
    return saveEarningsDatesToCalendar_Original(ticker, earningsDates);
  } else {
    // 如果函數不存在，使用簡化實現
    Logger.log(`保存 ${ticker} 財報日期：${earningsDates.length} 個日期`);
  }
}

/**
 * 保存財報歷史經驗（重用 27_EARNINGS_HISTORICAL_EXPERIENCE.js 中的函數）
 */
function saveEarningsHistoricalExperience(ticker, quarter, experience) {
  // 調用 27_EARNINGS_HISTORICAL_EXPERIENCE.js 中的函數
  if (typeof saveEarningsHistoricalExperience_Original === 'function') {
    return saveEarningsHistoricalExperience_Original(ticker, quarter, experience);
  } else {
    // 如果函數不存在，使用簡化實現
    Logger.log(`保存 ${ticker} ${quarter} 歷史經驗`);
  }
}

/**
 * 保存執行結果
 * @param {Object} results - 執行結果
 */
function saveHoldingsEarningsResults(results) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("HOLDINGS_EARNINGS_COMPLETE_RESULTS");
  
  if (!sheet) {
    sheet = ss.insertSheet("HOLDINGS_EARNINGS_COMPLETE_RESULTS");
    sheet.appendRow([
      "execution_id",
      "ticker",
      "earnings_dates_count",
      "historical_experiences_count",
      "confidence",
      "data_source",
      "status",
      "created_at"
    ]);
    sheet.setFrozenRows(1);
  }
  
  for (const [ticker, result] of Object.entries(results.ticker_results)) {
    sheet.appendRow([
      `EXEC_${Date.now()}`,
      ticker,
      result.earnings_dates?.length || 0,
      result.historical_experiences?.length || 0,
      result.confidence || 0.5,
      result.data_source || "AI_INFERRED",
      "COMPLETED",
      new Date()
    ]);
  }
}

/**
 * 建立索引
 * @param {Object} results - 執行結果
 */
function createHoldingsEarningsIndex(results) {
  // 調用 27_HOLDINGS_EARNINGS_GENERATOR.js 中的 createTickerEarningsIndex
  for (const [ticker, result] of Object.entries(results.ticker_results)) {
    if (result.earnings_dates && result.earnings_dates.length > 0) {
      if (typeof createTickerEarningsIndex === 'function') {
        createTickerEarningsIndex(ticker, result.earnings_dates);
      }
    }
  }
}
