/**
 * 📊 財報歷史經驗生成與事後學習系統 ⭐ V8.0 新增
 * 
 * 功能：
 * 1. AI 生成歷史經驗（如果沒有歷史數據）
 * 2. 總結五年內的事件歷史經驗，建立快照與索引
 * 3. 財報後3-7天監控結束，收集市場反應
 * 4. 事後學習機制
 * 
 * @version SSOT V8.0
 * @date 2026-01-19
 */

// ==========================================
// AI 生成歷史經驗
// ==========================================

/**
 * 生成財報歷史經驗（如果沒有歷史數據）
 * @param {string} ticker - 股票代碼
 * @param {string} quarter - 季度（例如：Q1, Q2, Q3, Q4）
 * @returns {Object} 歷史經驗數據
 */
function generateEarningsHistoricalExperience(ticker, quarter) {
  try {
    Logger.log(`生成財報歷史經驗：ticker=${ticker}, quarter=${quarter}`);
    
    // 檢查是否已有歷史經驗
    const existingExperience = getEarningsHistoricalExperience(ticker, quarter);
    if (existingExperience && existingExperience.experience_count > 0) {
      Logger.log(`已有歷史經驗，跳過生成：${existingExperience.experience_count} 次記錄`);
      return existingExperience;
    }
    
    // 使用 AI 模型生成歷史經驗
    const prompt = buildEarningsHistoricalExperiencePrompt(ticker, quarter);
    
    // ⭐ V8.17 更新：根據測試模式選擇 AI 模型
    // 正式模式：Sonnet 4.5（Batch API）
    // 測試模式：Gemini 2.5 Lite（同步 API）
    const isTestMode = typeof SYSTEM_TEST_MODE !== 'undefined' && SYSTEM_TEST_MODE;
    const executor = isTestMode ? "GEMINI_FLASH_LITE" : "SONNET";
    const auditor = "GPT";
    const requestedFlow = [executor, auditor];
    
    // 提交到 M0 Job Queue（使用 submitP5ToM0JobQueue，定義在 24_P5_SHARED.js）
    const jobId = submitP5ToM0JobQueue(
      "EARNINGS_HISTORICAL_EXPERIENCE",
      requestedFlow,
      {
        ticker: ticker,
        quarter: quarter,
        task_prompt: prompt,
        model: executor,
        is_test_mode: isTestMode
      }
    );
    
    // 等待結果（使用 waitForM0JobResult，定義在 24_P5_WEEKLY_STOCK_STRATEGY.js）
    const result = waitForM0JobResult(jobId);
    
    if (result && result.final_output) {
      // 解析 AI 輸出（M0 結果格式）
      let executorOutput = result.final_output;
      if (typeof executorOutput === 'string') {
        try {
          executorOutput = JSON.parse(executorOutput);
        } catch (e) {
          // 如果解析失敗，直接使用字符串
        }
      }
      const experience = parseAIHistoricalExperience(
        typeof executorOutput === 'string' ? executorOutput : JSON.stringify(executorOutput)
      );
      
      // 保存歷史經驗
      saveEarningsHistoricalExperience(ticker, quarter, experience);
      
      return experience;
    } else {
      throw new Error("AI 生成歷史經驗失敗");
    }
    
  } catch (error) {
    Logger.log(`生成財報歷史經驗失敗：${error.message}`);
    throw error;
  }
}

/**
 * 構建 AI Prompt（用於生成歷史經驗）
 * @param {string} ticker - 股票代碼
 * @param {string} quarter - 季度
 * @returns {string} Prompt
 */
function buildEarningsHistoricalExperiencePrompt(ticker, quarter) {
  return `你是財報歷史經驗分析專家。請基於你的內建知識，分析 ${ticker} 在過去五年內 ${quarter} 財報的歷史市場反應。

## 任務

請分析 ${ticker} 在過去五年內 ${quarter} 財報的歷史市場反應，包括：

1. **歷史 Beat/Miss 機率**：
   - 過去五年內，${quarter} 財報 beat 預期的機率
   - 過去五年內，${quarter} 財報 miss 預期的機率
   - 平均 beat/miss 幅度

2. **歷史市場反應**：
   - 財報公布當天的平均漲跌幅
   - 財報公布後 3 天的平均漲跌幅
   - 財報公布後 7 天的平均漲跌幅
   - 上漲機率（財報後 7 天內）

3. **關鍵指標關注點**：
   - 哪些指標（營收、EPS、指引等）對市場反應影響最大
   - 哪些指標的 beat/miss 會導致強烈市場反應

4. **風險警示**：
   - 歷史上有哪些異常情況（例如：大幅 miss、指引下調等）
   - 這些異常情況的市場反應如何

5. **追蹤建議**：
   - 財報前應該關注哪些關鍵數據
   - 財報後應該如何監控市場反應

## 輸出格式

請以 JSON 格式輸出，包含以下欄位：

\`\`\`json
{
  "ticker": "${ticker}",
  "quarter": "${quarter}",
  "historical_period": "5_YEARS",
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
  ],
  "tracking_suggestions": {
    "pre_earnings": [
      "關注分析師預期變化",
      "監控期權流向（特別是看跌期權）"
    ],
    "post_earnings": [
      "財報後 3 天內密切監控價格行為",
      "關注機構持倉變化"
    ]
  },
  "confidence": 0.8,
  "data_source": "AI_INFERRED",
  "generated_at": "${new Date().toISOString()}"
}
\`\`\`

**注意**：如果某些數據無法確定，請標記為 null 或使用合理的估計值，並在 confidence 欄位中反映不確定性。`;
}

/**
 * 解析 AI 輸出的歷史經驗
 * @param {string} aiOutput - AI 輸出
 * @returns {Object} 歷史經驗數據
 */
function parseAIHistoricalExperience(aiOutput) {
  try {
    let jsonString = aiOutput.trim();
    
    // 移除可能的 markdown 代碼塊
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const experience = JSON.parse(jsonString);
    
    // 驗證必要欄位
    if (!experience.ticker || !experience.quarter) {
      throw new Error("AI 輸出缺少必要欄位");
    }
    
    return experience;
    
  } catch (error) {
    Logger.log(`解析 AI 歷史經驗失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 歷史經驗總結與索引
// ==========================================

/**
 * 總結五年內的事件歷史經驗，建立快照與索引
 * @param {string} ticker - 股票代碼
 * @returns {Object} 總結結果
 */
function summarizeEarningsHistoricalExperience(ticker) {
  try {
    Logger.log(`總結財報歷史經驗：ticker=${ticker}`);
    
    // 讀取所有歷史經驗記錄
    const allExperiences = getAllEarningsHistoricalExperiences(ticker);
    
    if (allExperiences.length === 0) {
      Logger.log(`沒有歷史經驗記錄：ticker=${ticker}`);
      return null;
    }
    
    // 按季度分組
    const experiencesByQuarter = {};
    for (const exp of allExperiences) {
      const quarter = exp.quarter || "UNKNOWN";
      if (!experiencesByQuarter[quarter]) {
        experiencesByQuarter[quarter] = [];
      }
      experiencesByQuarter[quarter].push(exp);
    }
    
    // 為每個季度生成總結
    const summaries = {};
    for (const [quarter, experiences] of Object.entries(experiencesByQuarter)) {
      summaries[quarter] = summarizeQuarterExperiences(quarter, experiences);
    }
    
    // 建立快照
    const snapshot = {
      snapshot_id: `EARNINGS_EXP_${ticker}_${Date.now()}`,
      ticker: ticker,
      summary_date: new Date(),
      quarter_summaries: summaries,
      total_experiences: allExperiences.length,
      years_covered: calculateYearsCovered(allExperiences),
      created_at: new Date()
    };
    
    // 保存快照
    saveEarningsExperienceSnapshot(snapshot);
    
    // 建立索引
    createEarningsExperienceIndex(ticker, snapshot);
    
    return snapshot;
    
  } catch (error) {
    Logger.log(`總結財報歷史經驗失敗：${error.message}`);
    throw error;
  }
}

/**
 * 總結單一季度經驗
 * @param {string} quarter - 季度
 * @param {Array} experiences - 經驗列表
 * @returns {Object} 總結
 */
function summarizeQuarterExperiences(quarter, experiences) {
  // 計算平均 Beat/Miss 機率
  const beatProbabilities = experiences.map(e => e.beat_miss_statistics?.beat_probability || 0).filter(p => p > 0);
  const avgBeatProbability = beatProbabilities.length > 0 ? 
    beatProbabilities.reduce((a, b) => a + b, 0) / beatProbabilities.length : 0.5;
  
  // 計算平均市場反應
  const day0Changes = experiences.map(e => e.market_reaction?.day_0_avg_change || 0).filter(c => c !== 0);
  const day7Changes = experiences.map(e => e.market_reaction?.day_7_avg_change || 0).filter(c => c !== 0);
  
  const avgDay0Change = day0Changes.length > 0 ? 
    day0Changes.reduce((a, b) => a + b, 0) / day0Changes.length : 0;
  const avgDay7Change = day7Changes.length > 0 ? 
    day7Changes.reduce((a, b) => a + b, 0) / day7Changes.length : 0;
  
  // 收集風險警示（去重）
  const riskWarnings = [];
  const warningTypes = new Set();
  for (const exp of experiences) {
    if (exp.risk_warnings) {
      for (const warning of exp.risk_warnings) {
        if (!warningTypes.has(warning.type)) {
          warningTypes.add(warning.type);
          riskWarnings.push(warning);
        }
      }
    }
  }
  
  return {
    quarter: quarter,
    experience_count: experiences.length,
    beat_probability: avgBeatProbability,
    avg_day_0_change: avgDay0Change,
    avg_day_7_change: avgDay7Change,
    risk_warnings: riskWarnings,
    key_metrics_focus: experiences[0]?.key_metrics_focus || [],
    tracking_suggestions: experiences[0]?.tracking_suggestions || {}
  };
}

// ==========================================
// 財報後市場反應收集（3-7天）
// ==========================================

/**
 * 收集財報後的市場反應（財報後3-7天）
 * @param {string} ticker - 股票代碼
 * @param {Date} earningsDate - 財報日期
 * @returns {Object} 市場反應數據
 */
function collectPostEarningsMarketReaction(ticker, earningsDate) {
  try {
    Logger.log(`收集財報後市場反應：ticker=${ticker}, earningsDate=${earningsDate}`);
    
    const today = new Date();
    const daysSinceEarnings = Math.floor((today - earningsDate) / (1000 * 60 * 60 * 24));
    
    // 檢查是否在監控窗口內（財報後3-7天）
    const POST_EARNINGS_MONITORING_END = 7;  // 從 EARNINGS_REVENUE_CONFIG 讀取，這裡使用常量
    if (daysSinceEarnings < 3 || daysSinceEarnings > POST_EARNINGS_MONITORING_END) {
      Logger.log(`財報 ${ticker} 不在監控窗口內（當前距離 ${daysSinceEarnings} 天）`);
      return { status: "OUT_OF_WINDOW", days_since_earnings: daysSinceEarnings };
    }
    
    // 收集市場反應數據
    const marketReaction = {
      ticker: ticker,
      earnings_date: earningsDate,
      collection_date: today,
      days_since_earnings: daysSinceEarnings,
      
      // 價格反應
      price_reaction: collectPriceReaction(ticker, earningsDate, today),
      
      // 成交量反應
      volume_reaction: collectVolumeReaction(ticker, earningsDate, today),
      
      // 期權反應
      options_reaction: collectOptionsReaction(ticker, earningsDate, today),
      
      // 機構反應
      institutional_reaction: collectInstitutionalReaction(ticker, earningsDate, today),
      
      // 分析師反應
      analyst_reaction: collectAnalystReaction(ticker, earningsDate, today)
    };
    
    // 建立經驗快照
    const experienceSnapshot = createEarningsExperienceSnapshot(ticker, earningsDate, marketReaction);
    
    // 保存到學習系統記憶庫
    saveToEarningsLearningMemory(ticker, experienceSnapshot);
    
    return {
      status: "COLLECTED",
      market_reaction: marketReaction,
      experience_snapshot: experienceSnapshot
    };
    
  } catch (error) {
    Logger.log(`收集財報後市場反應失敗：${error.message}`);
    throw error;
  }
}

/**
 * 收集價格反應
 * @param {string} ticker - 股票代碼
 * @param {Date} earningsDate - 財報日期
 * @param {Date} today - 今天日期
 * @returns {Object} 價格反應數據
 */
function collectPriceReaction(ticker, earningsDate, today) {
  // 從 OHLCV 數據讀取
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return {};
  }
  
  // 讀取財報當天和後續幾天的價格數據
  // 這裡簡化處理，實際應該讀取具體的價格數據
  return {
    day_0_change: null,  // 需要實際讀取
    day_3_change: null,
    day_7_change: null
  };
}

/**
 * 收集成交量反應
 * @param {string} ticker - 股票代碼
 * @param {Date} earningsDate - 財報日期
 * @param {Date} today - 今天日期
 * @returns {Object} 成交量反應數據
 */
function collectVolumeReaction(ticker, earningsDate, today) {
  return {
    day_0_volume_ratio: null,  // 相對於平均成交量的倍數
    day_3_volume_ratio: null,
    day_7_volume_ratio: null
  };
}

/**
 * 收集期權反應
 * @param {string} ticker - 股票代碼
 * @param {Date} earningsDate - 財報日期
 * @param {Date} today - 今天日期
 * @returns {Object} 期權反應數據
 */
function collectOptionsReaction(ticker, earningsDate, today) {
  return {
    put_call_ratio: null,
    implied_volatility_change: null
  };
}

/**
 * 收集機構反應
 * @param {string} ticker - 股票代碼
 * @param {Date} earningsDate - 財報日期
 * @param {Date} today - 今天日期
 * @returns {Object} 機構反應數據
 */
function collectInstitutionalReaction(ticker, earningsDate, today) {
  return {
    institutional_flow: null,
    holdings_change: null
  };
}

/**
 * 收集分析師反應
 * @param {string} ticker - 股票代碼
 * @param {Date} earningsDate - 財報日期
 * @param {Date} today - 今天日期
 * @returns {Object} 分析師反應數據
 */
function collectAnalystReaction(ticker, earningsDate, today) {
  return {
    rating_changes: null,
    target_price_changes: null
  };
}

/**
 * 建立財報經驗快照
 * @param {string} ticker - 股票代碼
 * @param {Date} earningsDate - 財報日期
 * @param {Object} marketReaction - 市場反應數據
 * @returns {Object} 經驗快照
 */
function createEarningsExperienceSnapshot(ticker, earningsDate, marketReaction) {
  return {
    snapshot_id: `EARNINGS_EXP_${ticker}_${Utilities.formatDate(earningsDate, Session.getScriptTimeZone(), "yyyyMMdd")}`,
    ticker: ticker,
    earnings_date: earningsDate,
    collection_date: marketReaction.collection_date,
    days_since_earnings: marketReaction.days_since_earnings,
    
    // 市場反應摘要
    market_reaction_summary: {
      price_change: marketReaction.price_reaction?.day_7_change || 0,
      volume_ratio: marketReaction.volume_reaction?.day_7_volume_ratio || 1,
      options_sentiment: marketReaction.options_reaction?.put_call_ratio || 1,
      institutional_sentiment: marketReaction.institutional_reaction?.institutional_flow || 0
    },
    
    // 原始數據引用
    raw_data_ref: marketReaction,
    
    created_at: new Date()
  };
}

// ==========================================
// 數據存儲函數
// ==========================================

/**
 * 保存財報歷史經驗
 * @param {string} ticker - 股票代碼
 * @param {string} quarter - 季度
 * @param {Object} experience - 歷史經驗數據
 */
function saveEarningsHistoricalExperience(ticker, quarter, experience) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("EARNINGS_HISTORICAL_EXPERIENCE");
  
  if (!sheet) {
    sheet = ss.insertSheet("EARNINGS_HISTORICAL_EXPERIENCE");
    sheet.appendRow([
      "experience_id",
      "ticker",
      "quarter",
      "historical_period",
      "experience_json",
      "data_source",
      "confidence",
      "created_at"
    ]);
    sheet.setFrozenRows(1);
  }
  
  sheet.appendRow([
    `EXP_${ticker}_${quarter}_${Date.now()}`,
    ticker,
    quarter,
    experience.historical_period || "5_YEARS",
    JSON.stringify(experience),
    experience.data_source || "AI_INFERRED",
    experience.confidence || 0.5,
    new Date()
  ]);
}

/**
 * 獲取財報歷史經驗
 * @param {string} ticker - 股票代碼
 * @param {string} quarter - 季度
 * @returns {Object} 歷史經驗數據
 */
function getEarningsHistoricalExperience(ticker, quarter) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("EARNINGS_HISTORICAL_EXPERIENCE");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return null;
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const tickerCol = headers.indexOf("ticker");
  const quarterCol = headers.indexOf("quarter");
  const expCol = headers.indexOf("experience_json");
  
  if (tickerCol === -1 || quarterCol === -1 || expCol === -1) {
    return null;
  }
  
  const experiences = [];
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][tickerCol] === ticker && rows[i][quarterCol] === quarter) {
      try {
        const exp = JSON.parse(rows[i][expCol]);
        experiences.push(exp);
      } catch (e) {
        // 解析失敗，跳過
      }
    }
  }
  
  return {
    experience_count: experiences.length,
    experiences: experiences,
    latest: experiences.length > 0 ? experiences[experiences.length - 1] : null
  };
}

/**
 * 獲取所有財報歷史經驗
 * @param {string} ticker - 股票代碼
 * @returns {Array} 歷史經驗列表
 */
function getAllEarningsHistoricalExperiences(ticker) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("EARNINGS_HISTORICAL_EXPERIENCE");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  const headers = rows[0];
  
  const tickerCol = headers.indexOf("ticker");
  const expCol = headers.indexOf("experience_json");
  
  if (tickerCol === -1 || expCol === -1) {
    return [];
  }
  
  const experiences = [];
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][tickerCol] === ticker) {
      try {
        const exp = JSON.parse(rows[i][expCol]);
        experiences.push(exp);
      } catch (e) {
        // 解析失敗，跳過
      }
    }
  }
  
  return experiences;
}

/**
 * 保存財報經驗快照
 * @param {Object} snapshot - 快照數據
 */
function saveEarningsExperienceSnapshot(snapshot) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("EARNINGS_EXPERIENCE_SNAPSHOT");
  
  if (!sheet) {
    sheet = ss.insertSheet("EARNINGS_EXPERIENCE_SNAPSHOT");
    sheet.appendRow([
      "snapshot_id",
      "ticker",
      "summary_date",
      "quarter_summaries_json",
      "total_experiences",
      "years_covered",
      "created_at"
    ]);
    sheet.setFrozenRows(1);
  }
  
  sheet.appendRow([
    snapshot.snapshot_id,
    snapshot.ticker,
    snapshot.summary_date,
    JSON.stringify(snapshot.quarter_summaries),
    snapshot.total_experiences,
    snapshot.years_covered,
    new Date()
  ]);
}

/**
 * 建立財報經驗索引
 * @param {string} ticker - 股票代碼
 * @param {Object} snapshot - 快照數據
 */
function createEarningsExperienceIndex(ticker, snapshot) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("EARNINGS_EXPERIENCE_INDEX");
  
  if (!sheet) {
    sheet = ss.insertSheet("EARNINGS_EXPERIENCE_INDEX");
    sheet.appendRow([
      "index_id",
      "ticker",
      "snapshot_id",
      "quarter",
      "beat_probability",
      "avg_day_0_change",
      "avg_day_7_change",
      "risk_warnings_count",
      "last_updated"
    ]);
    sheet.setFrozenRows(1);
  }
  
  // 為每個季度建立索引
  for (const [quarter, summary] of Object.entries(snapshot.quarter_summaries)) {
    sheet.appendRow([
      `IDX_${ticker}_${quarter}_${Date.now()}`,
      ticker,
      snapshot.snapshot_id,
      quarter,
      summary.beat_probability,
      summary.avg_day_0_change,
      summary.avg_day_7_change,
      summary.risk_warnings?.length || 0,
      new Date()
    ]);
  }
}

/**
 * 保存到財報學習記憶庫
 * @param {string} ticker - 股票代碼
 * @param {Object} experienceSnapshot - 經驗快照
 */
function saveToEarningsLearningMemory(ticker, experienceSnapshot) {
  // 保存到 EARNINGS_LEARNING_MEMORY 表格
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("EARNINGS_LEARNING_MEMORY");
  
  if (!sheet) {
    sheet = ss.insertSheet("EARNINGS_LEARNING_MEMORY");
    sheet.appendRow([
      "memory_id",
      "ticker",
      "earnings_date",
      "experience_snapshot_json",
      "created_at"
    ]);
    sheet.setFrozenRows(1);
  }
  
  sheet.appendRow([
    experienceSnapshot.snapshot_id,
    ticker,
    experienceSnapshot.earnings_date,
    JSON.stringify(experienceSnapshot),
    new Date()
  ]);
}

/**
 * 計算覆蓋年數
 * @param {Array} experiences - 經驗列表
 * @returns {number} 年數
 */
function calculateYearsCovered(experiences) {
  if (experiences.length === 0) {
    return 0;
  }
  
  // 從經驗數據中提取年份範圍
  // 這裡簡化處理，實際應該從經驗數據中讀取
  return 5;  // 預設 5 年
}
