/**
 * 📊 P5 Weekly: 市場綜述
 * 
 * 每週進行市場分析：
 * - 市場綜述（Market Analysis）
 * - 因果鏈分析（Causality Chain）
 * - 風險事件識別（Risk Events）
 * - 衍生品策略調整（Derivatives Strategy Adjustment）
 * - 信念更新（Belief Update）
 * - U 調整（Utilization Adjustment）
 * - 行動清單（Action List）
 * - 觸發決策（Trigger Decisions）
 * 
 * 執行頻率：每週 1 次
 * 執行者：Claude Sonnet 4.5
 * 審查者：GPT-5.1
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// P5 Weekly 核心執行函數
// ==========================================

/**
 * P5 Weekly 主執行函數
 * 
 * @param {Object} params - 執行參數
 * @param {string} params.trigger - 觸發來源（WEEKLY / MANUAL）
 * @param {Object} params.context - 上下文
 * @returns {Object} result - 執行結果
 */
function P5_Weekly_Execute(params) {
  try {
    Logger.log(`P5 Weekly 執行開始：trigger=${params.trigger}`);
    
    // Step 1: 檢查執行前確認
    const jobId = params.job_id || `P5_WEEKLY_${Date.now()}`;
    const confirmation = checkPreExecutionConfirmation(jobId, "P5_WEEKLY");
    
    if (confirmation.requires_confirmation && confirmation.status !== "CONFIRMED") {
      if (confirmation.status === "NOT_CREATED") {
        const questions = generatePreExecutionQuestions("P5_WEEKLY", params.context);
        const confirmationId = savePreExecutionQuestions(jobId, "P5_WEEKLY", questions);
        return {
          status: "REQUIRES_CONFIRMATION",
          confirmation_id: confirmationId,
          questions: questions
        };
      }
      return {
        status: "PENDING_CONFIRMATION",
        confirmation_id: confirmation.confirmation_id
      };
    }
    
    // Step 2: 檢查決策權限
    const context = {
      defcon: getCurrentDEFCON(),
      p4_6_triggered: false  // TODO: 從 P4.6 模組讀取
    };
    
    if (!checkP5DecisionHierarchy("WEEKLY", context)) {
      Logger.log("P5 Weekly：決策權限檢查未通過，執行受限");
      return {
        status: "RESTRICTED",
        reason: "決策權限檢查未通過"
      };
    }
    
    // Step 3: 讀取相關快照
    const p2Snapshot = getLatestP2Snapshot();
    const p3Snapshot = getLatestP3Snapshot();
    const p4Snapshot = getLatestP4Snapshot();
    const previousP5WeeklySnapshot = getLatestP5WeeklySnapshot();
    
    // Step 4: 收集本週市場數據
    const weeklyData = collectWeeklyMarketData();
    
    // Step 5: 準備 M0 Job
    const m0InputPayload = {
      phase: "P5_WEEKLY",
      frequency: "WEEKLY",
      trigger: params.trigger,
      p2_snapshot: p2Snapshot,
      p3_snapshot: p3Snapshot,
      p4_snapshot: p4Snapshot,
      previous_p5_weekly_snapshot: previousP5WeeklySnapshot,
      weekly_market_data: weeklyData,
      institutional_data: collectInstitutionalDataWeekly(),
      context: params.context || {}
    };
    
    // Step 6: 構建 M0 流程
    const requestedFlow = ["SONNET", "GPT"];  // Sonnet 執行，GPT 審查
    m0InputPayload.p5_weekly_prompt = buildP5WeeklyPrompt(weeklyData, p2Snapshot, p3Snapshot, p4Snapshot, previousP5WeeklySnapshot);
    
    // Step 7: 提交到 M0 Job Queue
    const jobId_final = submitP5ToM0JobQueue("P5_WEEKLY", requestedFlow, m0InputPayload);
    
    return {
      status: "SUBMITTED",
      job_id: jobId_final,
      frequency: "WEEKLY"
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly 執行失敗：${error.message}`);
    throw error;
  }
}

/**
 * 處理 P5 Weekly M0 執行結果
 * 
 * @param {string} jobId - Job ID
 * @param {Object} m0Result - M0 執行結果
 * @returns {Object} result - 處理結果
 */
function P5_Weekly_ProcessM0Result(jobId, m0Result) {
  try {
    Logger.log(`P5 Weekly 處理 M0 結果：jobId=${jobId}`);
    
    const executorOutput = m0Result.executor_output || {};
    const auditorOutput = m0Result.auditor_output || {};
    
    // 整合機構級視角
    const enhancedAnalysis = integrateInstitutionalPerspectiveP5(executorOutput, m0Result.institutional_data || {});
    
    // 生成 P5 Weekly 輸出
    const p5WeeklyOutput = generateP5WeeklyOutput(enhancedAnalysis, auditorOutput);
    
    // 保存快照
    const snapshot = saveP5WeeklySnapshot({
      p2_snapshot_id: m0Result.p2_snapshot?.snapshot_id || null,
      p3_snapshot_id: m0Result.p3_snapshot?.snapshot_id || null,
      p4_snapshot_id: m0Result.p4_snapshot?.snapshot_id || null,
      market_analysis: p5WeeklyOutput.market_analysis,
      causality_chain: p5WeeklyOutput.causality_chain,
      risk_events: p5WeeklyOutput.risk_events,
      derivatives_strategy_adjustment: p5WeeklyOutput.derivatives_strategy_adjustment,
      belief_update: p5WeeklyOutput.belief_update,
      u_adjustment: p5WeeklyOutput.u_adjustment,
      action_list: p5WeeklyOutput.action_list,
      trigger_decisions: p5WeeklyOutput.trigger_decisions
    });
    
    // 執行觸發決策（例如：觸發 P4 U 調整）
    if (p5WeeklyOutput.trigger_decisions && p5WeeklyOutput.trigger_decisions.length > 0) {
      executeP5WeeklyTriggerDecisions(p5WeeklyOutput.trigger_decisions);
    }
    
    // 保存學習日誌（如果有的話）
    if (p5WeeklyOutput.belief_update) {
      saveP5WeeklyLearningLog(p5WeeklyOutput, snapshot);
    }
    
    return {
      status: "COMPLETED",
      snapshot_id: snapshot.snapshot_id,
      p5_weekly_output: p5WeeklyOutput
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly 處理 M0 結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 數據收集函數
// ==========================================

/**
 * 收集本週市場數據
 * 
 * @returns {Object} weeklyData - 本週市場數據
 */
function collectWeeklyMarketData() {
  // 從 P5 Daily 收集的數據中提取本週數據
  // 包括：OHLCV、技術指標、板塊 ETF、衍生品、新聞等
  // ⭐ V8.0 新增：市場情緒指標（FPE_B、CNN Greed Fear Index）
  
  // 獲取持倉股票列表（從 P4 或 P2 快照中獲取）
  const p2Snapshot = getLatestP2Snapshot();
  const tickers = [];
  const tickerMarkets = {};
  
  if (p2Snapshot && p2Snapshot.tier_assignments) {
    // 從 P2 快照中提取 ticker 列表
    for (const tier in p2Snapshot.tier_assignments) {
      if (p2Snapshot.tier_assignments[tier] && Array.isArray(p2Snapshot.tier_assignments[tier])) {
        for (const stock of p2Snapshot.tier_assignments[tier]) {
          if (stock.ticker && !tickers.includes(stock.ticker)) {
            tickers.push(stock.ticker);
            tickerMarkets[stock.ticker] = stock.market || "US";
          }
        }
      }
    }
  }
  
  // 收集市場情緒指標（FPE_B、CNN Greed Fear Index）
  let marketSentimentIndicators = {};
  try {
    marketSentimentIndicators = collectMarketSentimentIndicators(tickers, tickerMarkets);
  } catch (error) {
    Logger.log(`P5 Weekly：收集市場情緒指標失敗：${error.message}`);
  }
  
  return {
    ohlcv_summary: getWeeklyOHLCVSummary(),
    technical_indicators_summary: getWeeklyTechnicalIndicatorsSummary(),
    sector_performance: getWeeklySectorPerformance(),
    derivatives_summary: getWeeklyDerivativesSummary(),
    news_summary: getWeeklyNewsSummary(),
    institutional_activity: getWeeklyInstitutionalActivity(),
    market_sentiment_indicators: marketSentimentIndicators  // ⭐ V8.0 新增
  };
}

/**
 * 收集機構級數據（每週）
 * 
 * @returns {Object} institutionalData - 機構級數據
 */
function collectInstitutionalDataWeekly() {
  Logger.log("P5 Weekly：開始收集機構級數據");
  
  const institutionalData = {
    f13f: {},
    dark_pool: {},
    options_flow: {},
    insider_trading: {}
  };
  
  const jobId = `INSTITUTIONAL_DATA_${Date.now()}`;
  
  try {
    // 1. 收集 13F 數據（季度機構持倉報告）
    try {
      const f13fQueries = [
        "13F filing institutional holdings latest",
        "SEC 13F institutional holdings Q4 2024",
        "13F holdings changes institutional investors"
      ];
      
      for (const query of f13fQueries) {
        try {
          const result = executeCSESearch(jobId, "CSE_SEARCH", {
            search_query: query,
            cse_type: "INSTITUTIONAL_DATA",
            max_results: 10
          });
          
          if (result && result.output && result.output.search_results) {
            const parsed = parseF13FDataFromCSE(result.output.search_results);
            Object.assign(institutionalData.f13f, parsed);
          }
          
          Utilities.sleep(500); // 避免請求過快
        } catch (error) {
          Logger.log(`P5 Weekly：13F 搜尋失敗 (${query})：${error.message}`);
        }
      }
      
      Logger.log(`P5 Weekly：收集到 ${Object.keys(institutionalData.f13f).length} 筆 13F 數據`);
    } catch (error) {
      Logger.log(`P5 Weekly：13F 數據收集失敗：${error.message}`);
    }
    
    // 2. 收集 Dark Pool 數據（暗池交易數據）
    try {
      const darkPoolQueries = [
        "FINRA ATS dark pool trading data",
        "dark pool activity institutional trading",
        "ATS trading volume dark pool"
      ];
      
      for (const query of darkPoolQueries) {
        try {
          const result = executeCSESearch(jobId, "CSE_SEARCH", {
            search_query: query,
            cse_type: "INSTITUTIONAL_DATA",
            max_results: 10
          });
          
          if (result && result.output && result.output.search_results) {
            const parsed = parseDarkPoolDataFromCSE(result.output.search_results);
            Object.assign(institutionalData.dark_pool, parsed);
          }
          
          Utilities.sleep(500);
        } catch (error) {
          Logger.log(`P5 Weekly：Dark Pool 搜尋失敗 (${query})：${error.message}`);
        }
      }
      
      Logger.log(`P5 Weekly：收集到 ${Object.keys(institutionalData.dark_pool).length} 筆 Dark Pool 數據`);
    } catch (error) {
      Logger.log(`P5 Weekly：Dark Pool 數據收集失敗：${error.message}`);
    }
    
    // 3. 收集 Options Flow 數據（期權流向數據）
    try {
      const optionsQueries = [
        "unusual options activity flow",
        "options flow institutional trading",
        "CBOE options open interest flow"
      ];
      
      for (const query of optionsQueries) {
        try {
          // ⭐⭐⭐ V8.0 修正：使用 P5_DERIVATIVES_US（美股衍生品）
          // Options Flow 主要用於美股，統一使用 theocc.com，避免格式衝突
          const result = executeCSESearch(jobId, "CSE_SEARCH", {
            search_query: query,
            cse_type: "P5_DERIVATIVES_US",  // ⭐ 修正：使用美股專用的衍生品 CSE
            max_results: 10
          });
          
          if (result && result.output && result.output.search_results) {
            const parsed = parseOptionsFlowDataFromCSE(result.output.search_results);
            Object.assign(institutionalData.options_flow, parsed);
          }
          
          Utilities.sleep(500);
        } catch (error) {
          Logger.log(`P5 Weekly：Options Flow 搜尋失敗 (${query})：${error.message}`);
        }
      }
      
      Logger.log(`P5 Weekly：收集到 ${Object.keys(institutionalData.options_flow).length} 筆 Options Flow 數據`);
    } catch (error) {
      Logger.log(`P5 Weekly：Options Flow 數據收集失敗：${error.message}`);
    }
    
    // 4. 收集 Insider Trading 數據（內部人交易數據）
    try {
      const insiderQueries = [
        "SEC insider trading Form 4",
        "insider trading transactions latest",
        "insider buying selling SEC filings"
      ];
      
      for (const query of insiderQueries) {
        try {
          const result = executeCSESearch(jobId, "CSE_SEARCH", {
            search_query: query,
            cse_type: "INSTITUTIONAL_DATA",
            max_results: 10
          });
          
          if (result && result.output && result.output.search_results) {
            const parsed = parseInsiderTradingDataFromCSE(result.output.search_results);
            institutionalData.insider_trading = parsed;
          }
          
          Utilities.sleep(500);
        } catch (error) {
          Logger.log(`P5 Weekly：Insider Trading 搜尋失敗 (${query})：${error.message}`);
        }
      }
      
      Logger.log(`P5 Weekly：收集到 ${institutionalData.insider_trading.length || 0} 筆 Insider Trading 數據`);
    } catch (error) {
      Logger.log(`P5 Weekly：Insider Trading 數據收集失敗：${error.message}`);
    }
    
    Logger.log(`P5 Weekly：機構級數據收集完成（13F: ${Object.keys(institutionalData.f13f).length}, Dark Pool: ${Object.keys(institutionalData.dark_pool).length}, Options Flow: ${Object.keys(institutionalData.options_flow).length}, Insider: ${institutionalData.insider_trading.length || 0}）`);
    
  } catch (error) {
    Logger.log(`P5 Weekly：機構級數據收集失敗：${error.message}`);
  }
  
  return institutionalData;
}

/**
 * 從 CSE 搜尋結果解析 13F 數據
 * 
 * @param {Array} searchResults - CSE 搜尋結果
 * @returns {Object} f13fData - 13F 數據
 */
function parseF13FDataFromCSE(searchResults) {
  const f13fData = {};
  
  for (const result of searchResults) {
    try {
      // 從搜尋結果中提取 ticker 和持倉信息
      // 實際實現需要根據數據源格式解析
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 簡單的 ticker 提取（可以改進）
      const tickerMatch = title.match(/\b([A-Z]{1,5})\b/) || snippet.match(/\b([A-Z]{1,5})\b/);
      if (tickerMatch && link.includes("sec.gov")) {
        const ticker = tickerMatch[1];
        if (!f13fData[ticker]) {
          f13fData[ticker] = {
            ticker: ticker,
            source: "SEC 13F",
            url: link,
            snippet: snippet,
            last_updated: new Date()
          };
        }
      }
    } catch (error) {
      Logger.log(`解析 13F 數據失敗：${error.message}`);
    }
  }
  
  return f13fData;
}

/**
 * 從 CSE 搜尋結果解析 Dark Pool 數據
 * 
 * @param {Array} searchResults - CSE 搜尋結果
 * @returns {Object} darkPoolData - Dark Pool 數據
 */
function parseDarkPoolDataFromCSE(searchResults) {
  const darkPoolData = {};
  
  for (const result of searchResults) {
    try {
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 簡單的 ticker 提取
      const tickerMatch = title.match(/\b([A-Z]{1,5})\b/) || snippet.match(/\b([A-Z]{1,5})\b/);
      if (tickerMatch && (link.includes("finra.org") || link.includes("dark"))) {
        const ticker = tickerMatch[1];
        if (!darkPoolData[ticker]) {
          darkPoolData[ticker] = {
            ticker: ticker,
            source: "FINRA ATS",
            url: link,
            snippet: snippet,
            last_updated: new Date()
          };
        }
      }
    } catch (error) {
      Logger.log(`解析 Dark Pool 數據失敗：${error.message}`);
    }
  }
  
  return darkPoolData;
}

/**
 * 從 CSE 搜尋結果解析 Options Flow 數據
 * 
 * @param {Array} searchResults - CSE 搜尋結果
 * @returns {Object} optionsFlowData - Options Flow 數據
 */
function parseOptionsFlowDataFromCSE(searchResults) {
  const optionsFlowData = {};
  
  for (const result of searchResults) {
    try {
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 簡單的 ticker 提取
      const tickerMatch = title.match(/\b([A-Z]{1,5})\b/) || snippet.match(/\b([A-Z]{1,5})\b/);
      if (tickerMatch && (link.includes("cboe.com") || link.includes("options") || link.includes("unusual"))) {
        const ticker = tickerMatch[1];
        if (!optionsFlowData[ticker]) {
          optionsFlowData[ticker] = {
            ticker: ticker,
            source: "CBOE/Options Flow",
            url: link,
            snippet: snippet,
            last_updated: new Date()
          };
        }
      }
    } catch (error) {
      Logger.log(`解析 Options Flow 數據失敗：${error.message}`);
    }
  }
  
  return optionsFlowData;
}

/**
 * 從 CSE 搜尋結果解析 Insider Trading 數據
 * 
 * @param {Array} searchResults - CSE 搜尋結果
 * @returns {Array} insiderTradingData - Insider Trading 數據列表
 */
function parseInsiderTradingDataFromCSE(searchResults) {
  const insiderTradingData = [];
  
  for (const result of searchResults) {
    try {
      const title = result.title || "";
      const snippet = result.snippet || "";
      const link = result.link || "";
      
      // 簡單的 ticker 提取
      const tickerMatch = title.match(/\b([A-Z]{1,5})\b/) || snippet.match(/\b([A-Z]{1,5})\b/);
      if (tickerMatch && link.includes("sec.gov")) {
        insiderTradingData.push({
          ticker: tickerMatch[1],
          source: "SEC Form 4",
          url: link,
          snippet: snippet,
          last_updated: new Date()
        });
      }
    } catch (error) {
      Logger.log(`解析 Insider Trading 數據失敗：${error.message}`);
    }
  }
  
  return insiderTradingData;
}

// ==========================================
// Prompt 構建
// ==========================================

/**
 * 構建 P5 Weekly AI Prompt
 * 
 * @param {Object} weeklyData - 本週市場數據
 * @param {Object} p2Snapshot - P2 快照
 * @param {Object} p3Snapshot - P3 快照
 * @param {Object} p4Snapshot - P4 快照
 * @param {Object} previousP5WeeklySnapshot - 上一週 P5 Weekly 快照
 * @returns {string} prompt - AI Prompt
 */
function buildP5WeeklyPrompt(weeklyData, p2Snapshot, p3Snapshot, p4Snapshot, previousP5WeeklySnapshot) {
  return `
你是一位資深的市場分析師，負責進行 Nuclear Project 的 P5 Weekly 市場綜述。

## 任務目標

基於本週市場數據和 P2/P3/P4 快照，進行全面的市場分析：
1. **市場綜述**：整體市場狀態、趨勢、關鍵事件
2. **因果鏈分析**：識別市場變動的因果關係
3. **風險事件識別**：識別潛在風險事件
4. **衍生品策略調整**：根據市場狀態調整衍生品策略
5. **信念更新**：更新對市場的信念和預期
6. **U 調整**：建議 U（利用率）調整
7. **行動清單**：生成具體的行動建議
8. **觸發決策**：決定是否觸發其他 Phase

## 本週市場數據

${JSON.stringify(weeklyData, null, 2)}

## P2/P3/P4 快照

P2 快照：${p2Snapshot ? JSON.stringify(p2Snapshot, null, 2) : "無"}
P3 快照：${p3Snapshot ? JSON.stringify(p3Snapshot, null, 2) : "無"}
P4 快照：${p4Snapshot ? JSON.stringify(p4Snapshot, null, 2) : "無"}

## 上一週 P5 Weekly 快照

${previousP5WeeklySnapshot ? JSON.stringify(previousP5WeeklySnapshot, null, 2) : "無（首次執行）"}

## 輸出格式（必須是 JSON）

{
  "market_analysis": {
    "overall_status": "BULL/BEAR/TRANSITION",
    "key_events": [],
    "trend_analysis": {},
    "market_regime": "BULL_STRONG/BULL_WEAK/BEAR_STRONG/BEAR_WEAK/TRANSITION"
  },
  "causality_chain": {
    "chains": [
      {
        "cause": "事件/數據",
        "effect": "影響",
        "confidence": 0.0-1.0
      }
    ]
  },
  "risk_events": [
    {
      "event": "風險事件描述",
      "severity": "LOW/MEDIUM/HIGH/CRITICAL",
      "probability": 0.0-1.0,
      "impact": "影響描述"
    }
  ],
  "derivatives_strategy_adjustment": {
    "recommendations": [],
    "hedging_ratio": 0.0-1.0,
    "options_strategy": {}
  },
  "belief_update": {
    "updated_beliefs": [],
    "confidence_changes": {}
  },
  "u_adjustment": {
    "recommended_u": 0.0-1.0,
    "reason": "調整理由",
    "trigger_condition": "觸發條件"
  },
  "action_list": [
    {
      "action": "行動描述",
      "priority": "HIGH/MEDIUM/LOW",
      "target": "目標標的/Phase"
    }
  ],
  "trigger_decisions": [
    {
      "trigger_phase": "P4/P5.5/P5.6",
      "reason": "觸發理由",
      "parameters": {}
    }
  ]
}
`;
}

// ==========================================
// 輸出生成
// ==========================================

/**
 * 生成 P5 Weekly 輸出
 * 
 * @param {Object} enhancedAnalysis - 增強後的分析結果
 * @param {Object} auditorOutput - 審查者輸出
 * @returns {Object} p5WeeklyOutput - P5 Weekly 輸出
 */
function generateP5WeeklyOutput(enhancedAnalysis, auditorOutput) {
  return {
    market_analysis: enhancedAnalysis.market_analysis || {},
    causality_chain: enhancedAnalysis.causality_chain || {},
    risk_events: enhancedAnalysis.risk_events || [],
    derivatives_strategy_adjustment: enhancedAnalysis.derivatives_strategy_adjustment || {},
    belief_update: enhancedAnalysis.belief_update || {},
    u_adjustment: enhancedAnalysis.u_adjustment || {},
    action_list: enhancedAnalysis.action_list || [],
    trigger_decisions: enhancedAnalysis.trigger_decisions || [],
    institutional_insights: enhancedAnalysis.institutional_insights || {},
    auditor_review: auditorOutput.audit_review || null,
    confidence_level: auditorOutput.confidence || 0.7,
    timestamp: new Date().toISOString()
  };
}

// ==========================================
// 觸發決策執行
// ==========================================

/**
 * 執行 P5 Weekly 觸發決策
 * 
 * @param {Array} triggerDecisions - 觸發決策列表
 */
function executeP5WeeklyTriggerDecisions(triggerDecisions) {
  for (const decision of triggerDecisions) {
    try {
      if (decision.trigger_phase === "P4") {
        // 觸發 P4 U 調整並重新計算
        if (decision.parameters && decision.parameters.u_adjustment) {
          updateP4Utilization({
            new_u: decision.parameters.u_adjustment.new_u || decision.parameters.u_adjustment,
            reason: decision.reason || "P5 Weekly U 調整"
          });
        }
      } else if (decision.trigger_phase === "P5.5") {
        // 觸發 P5.5 財報戰爭分析
        Logger.log(`P5 Weekly：觸發 P5.5，原因：${decision.reason}`);
        try {
          const p5_5Result = P5_5_EarningsRiskAssessment({
            tickers: decision.parameters?.tickers || [],
            earnings_dates: decision.parameters?.earnings_dates || {},
            trigger: "P5_WEEKLY",
            reason: decision.reason
          });
          Logger.log(`P5 Weekly：P5.5 執行完成，評估了 ${Object.keys(p5_5Result.risk_assessments || {}).length} 檔股票`);
        } catch (error) {
          Logger.log(`P5 Weekly：P5.5 執行失敗：${error.message}`);
        }
      } else if (decision.trigger_phase === "P5.6") {
        // 觸發 P5.6 泡沫導航
        Logger.log(`P5 Weekly：觸發 P5.6，原因：${decision.reason}`);
        try {
          // P5.6 需要對每個 ticker 進行評估
          const tickers = decision.parameters?.tickers || [];
          const marketData = decision.parameters?.market_data || {};
          
          const p5_6Results = {};
          for (const ticker of tickers) {
            try {
              const result = P5_6_BubbleNavigation(ticker, marketData[ticker] || marketData);
              p5_6Results[ticker] = result;
            } catch (error) {
              Logger.log(`P5 Weekly：P5.6 評估 ${ticker} 失敗：${error.message}`);
            }
          }
          
          Logger.log(`P5 Weekly：P5.6 執行完成，評估了 ${Object.keys(p5_6Results).length} 檔股票`);
        } catch (error) {
          Logger.log(`P5 Weekly：P5.6 執行失敗：${error.message}`);
        }
      }
    } catch (error) {
      Logger.log(`P5 Weekly：執行觸發決策失敗：${error.message}`);
    }
  }
}

/**
 * 更新 P4 U（利用率）並觸發 P4 重新計算
 * 
 * @param {Object} uAdjustment - U 調整參數
 * @param {number} uAdjustment.new_u - 新的 U 值
 * @param {string} uAdjustment.reason - 調整原因
 */
function updateP4Utilization(uAdjustment) {
  try {
    const newU = uAdjustment.new_u || uAdjustment;
    const reason = uAdjustment.reason || "P5 Weekly U 調整";
    
    // 更新 PropertiesService 中的 U 值
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty("CURRENT_U", newU.toString());
    Logger.log(`P4 U 已更新為：${newU}`);
    
    // ⭐ 自動觸發 P4 重新計算（根據備份設計）
    try {
      Logger.log(`P5 Weekly：U 調整後自動觸發 P4 重新計算（U=${newU}）`);
      const p4Result = P4_Calculate({
        trigger: "P5_WEEKLY_U_ADJUSTMENT",
        reason: reason || `U 調整：${newU}`
      });
      Logger.log(`P5 Weekly：P4 重新計算完成，快照 ID：${p4Result.snapshot_id || "N/A"}`);
    } catch (error) {
      Logger.log(`P5 Weekly：觸發 P4 重新計算失敗：${error.message}`);
    }
  } catch (error) {
    Logger.log(`更新 P4 U 失敗：${error.message}`);
  }
}

// ==========================================
// 輔助函數（簡化版，待完善）
// ==========================================

/**
 * 獲取本週 OHLCV 摘要
 * 
 * @returns {Object} summary - 本週 OHLCV 摘要
 */
function getWeeklyOHLCVSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    const closeCol = headers.indexOf("close");
    
    if (dateCol === -1 || tickerCol === -1 || closeCol === -1) {
      return {};
    }
    
    const summary = {};
    
    // 找到本週的數據
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo && rowDate <= today) {
        const ticker = rows[i][tickerCol];
        if (!summary[ticker]) {
          summary[ticker] = {
            ticker: ticker,
            week_start_price: null,
            week_end_price: null,
            week_high: null,
            week_low: null,
            week_change: null,
            week_change_pct: null
          };
        }
        
        const close = parseFloat(rows[i][closeCol]);
        if (!summary[ticker].week_start_price || rowDate < new Date(summary[ticker].week_start_date)) {
          summary[ticker].week_start_price = close;
          summary[ticker].week_start_date = rowDate;
        }
        if (!summary[ticker].week_end_price || rowDate > new Date(summary[ticker].week_end_date)) {
          summary[ticker].week_end_price = close;
          summary[ticker].week_end_date = rowDate;
        }
      }
    }
    
    // 計算變動
    for (const ticker in summary) {
      if (summary[ticker].week_start_price && summary[ticker].week_end_price) {
        summary[ticker].week_change = summary[ticker].week_end_price - summary[ticker].week_start_price;
        summary[ticker].week_change_pct = (summary[ticker].week_change / summary[ticker].week_start_price) * 100;
      }
    }
    
    return summary;
  } catch (error) {
    Logger.log(`獲取本週 OHLCV 摘要失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取本週技術指標摘要
 * 
 * @returns {Object} summary - 本週技術指標摘要
 */
function getWeeklyTechnicalIndicatorsSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    
    if (dateCol === -1 || tickerCol === -1) {
      return {};
    }
    
    const summary = {};
    
    // 找到本週的最新數據（每個 ticker 只取最新一筆）
    for (let i = rows.length - 1; i >= 1; i--) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo && rowDate <= today) {
        const ticker = rows[i][tickerCol];
        if (!summary[ticker]) {
          summary[ticker] = {};
          headers.forEach((header, colIndex) => {
            if (header !== "date" && header !== "ticker" && header !== "created_at") {
              summary[ticker][header] = rows[i][colIndex];
            }
          });
        }
      }
    }
    
    return summary;
  } catch (error) {
    Logger.log(`獲取本週技術指標摘要失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取本週板塊表現
 * 
 * @returns {Object} summary - 本週板塊表現
 */
function getWeeklySectorPerformance() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("SECTOR_ETF_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const etfTickerCol = headers.indexOf("etf_ticker");
    const sectorCol = headers.indexOf("sector");
    const closeCol = headers.indexOf("close");
    const weekPerfCol = headers.indexOf("week_performance");
    
    if (dateCol === -1 || etfTickerCol === -1) {
      return {};
    }
    
    const summary = {};
    
    // 找到本週的數據
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo && rowDate <= today) {
        const etfTicker = rows[i][etfTickerCol];
        const sector = rows[i][sectorCol] || "未知";
        
        if (!summary[sector]) {
          summary[sector] = {
            sector: sector,
            etfs: [],
            avg_week_performance: 0,
            best_performer: null,
            worst_performer: null
          };
        }
        
        const close = parseFloat(rows[i][closeCol]) || 0;
        const weekPerf = parseFloat(rows[i][weekPerfCol]) || 0;
        
        summary[sector].etfs.push({
          etf_ticker: etfTicker,
          close: close,
          week_performance: weekPerf
        });
      }
    }
    
    // 計算每個板塊的平均表現和最佳/最差表現
    for (const sector in summary) {
      const etfs = summary[sector].etfs;
      if (etfs.length > 0) {
        const totalPerf = etfs.reduce((sum, etf) => sum + (etf.week_performance || 0), 0);
        summary[sector].avg_week_performance = totalPerf / etfs.length;
        
        // 找出最佳和最差表現
        const sorted = [...etfs].sort((a, b) => (b.week_performance || 0) - (a.week_performance || 0));
        summary[sector].best_performer = sorted[0] || null;
        summary[sector].worst_performer = sorted[sorted.length - 1] || null;
      }
    }
    
    return summary;
  } catch (error) {
    Logger.log(`獲取本週板塊表現失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取本週衍生品摘要
 * 
 * @returns {Object} summary - 本週衍生品摘要
 */
function getWeeklyDerivativesSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("DERIVATIVES_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("ticker");
    const putCallRatioCol = headers.indexOf("put_call_ratio");
    const iv30dCol = headers.indexOf("iv_30d");
    
    if (dateCol === -1 || tickerCol === -1) {
      return {};
    }
    
    const summary = {};
    
    // 找到本週的最新數據（每個 ticker 只取最新一筆）
    for (let i = rows.length - 1; i >= 1; i--) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo && rowDate <= today) {
        const ticker = rows[i][tickerCol];
        if (!summary[ticker]) {
          summary[ticker] = {
            ticker: ticker,
            put_call_ratio: parseFloat(rows[i][putCallRatioCol]) || null,
            iv_30d: parseFloat(rows[i][iv30dCol]) || null,
            date: rowDate
          };
        }
      }
    }
    
    // 計算整體統計
    const tickers = Object.keys(summary);
    const putCallRatios = tickers.map(t => summary[t].put_call_ratio).filter(v => v !== null);
    const iv30dValues = tickers.map(t => summary[t].iv_30d).filter(v => v !== null);
    
    return {
      tickers: summary,
      statistics: {
        total_tickers: tickers.length,
        avg_put_call_ratio: putCallRatios.length > 0 ? putCallRatios.reduce((a, b) => a + b, 0) / putCallRatios.length : null,
        avg_iv_30d: iv30dValues.length > 0 ? iv30dValues.reduce((a, b) => a + b, 0) / iv30dValues.length : null
      }
    };
  } catch (error) {
    Logger.log(`獲取本週衍生品摘要失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取本週新聞摘要
 * 
 * @returns {Object} summary - 本週新聞摘要
 */
function getWeeklyNewsSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("NEWS_ATOMS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const importanceCol = headers.indexOf("importance");
    
    if (dateCol === -1) {
      return {};
    }
    
    const summary = {
      total_news: 0,
      high_importance_news: 0,
      news_by_ticker: {},
      news_by_category: {}
    };
    
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo && rowDate <= today) {
        summary.total_news++;
        
        const importance = rows[i][importanceCol];
        if (importance === "HIGH" || importance === "CRITICAL") {
          summary.high_importance_news++;
        }
        
        const ticker = rows[i][headers.indexOf("ticker")];
        if (ticker) {
          if (!summary.news_by_ticker[ticker]) {
            summary.news_by_ticker[ticker] = 0;
          }
          summary.news_by_ticker[ticker]++;
        }
        
        const category = rows[i][headers.indexOf("category")];
        if (category) {
          if (!summary.news_by_category[category]) {
            summary.news_by_category[category] = 0;
          }
          summary.news_by_category[category]++;
        }
      }
    }
    
    return summary;
  } catch (error) {
    Logger.log(`獲取本週新聞摘要失敗：${error.message}`);
    return {};
  }
}

/**
 * 獲取本週機構活動摘要
 * 
 * @returns {Object} summary - 本週機構活動摘要
 */
function getWeeklyInstitutionalActivity() {
  try {
    // 從本週收集的機構數據中生成摘要
    const institutionalData = collectInstitutionalDataWeekly();
    
    return {
      f13f_updates: Object.keys(institutionalData.f13f || {}).length,
      f13f_holdings: institutionalData.f13f || {},
      dark_pool_activity: institutionalData.dark_pool || {},
      dark_pool_count: Object.keys(institutionalData.dark_pool || {}).length,
      options_flow_activity: institutionalData.options_flow || {},
      options_flow_count: Object.keys(institutionalData.options_flow || {}).length,
      insider_trading: institutionalData.insider_trading || [],
      insider_trading_count: (institutionalData.insider_trading || []).length,
      summary: {
        total_signals: Object.keys(institutionalData.f13f || {}).length +
                      Object.keys(institutionalData.dark_pool || {}).length +
                      Object.keys(institutionalData.options_flow || {}).length +
                      (institutionalData.insider_trading || []).length,
        most_active_tickers: extractMostActiveTickers(institutionalData)
      }
    };
  } catch (error) {
    Logger.log(`獲取本週機構活動摘要失敗：${error.message}`);
    return {
      f13f_updates: 0,
      dark_pool_activity: {},
      options_flow_activity: {},
      insider_trading: []
    };
  }
}

/**
 * 提取最活躍的股票代碼（從機構數據中）
 * 
 * @param {Object} institutionalData - 機構數據
 * @returns {Array} mostActiveTickers - 最活躍的股票代碼列表
 */
function extractMostActiveTickers(institutionalData) {
  const tickerCount = {};
  
  // 統計 13F
  for (const ticker in institutionalData.f13f || {}) {
    tickerCount[ticker] = (tickerCount[ticker] || 0) + 1;
  }
  
  // 統計 Dark Pool
  for (const ticker in institutionalData.dark_pool || {}) {
    tickerCount[ticker] = (tickerCount[ticker] || 0) + 1;
  }
  
  // 統計 Options Flow
  for (const ticker in institutionalData.options_flow || {}) {
    tickerCount[ticker] = (tickerCount[ticker] || 0) + 1;
  }
  
  // 統計 Insider Trading
  for (const item of institutionalData.insider_trading || []) {
    if (item.ticker) {
      tickerCount[item.ticker] = (tickerCount[item.ticker] || 0) + 1;
    }
  }
  
  // 排序並返回前 10 名
  const sorted = Object.entries(tickerCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ticker, count]) => ({ ticker, signal_count: count }));
  
  return sorted;
}

// ==========================================
// 學習日誌保存
// ==========================================

/**
 * 保存 P5 Weekly 學習日誌
 * 
 * @param {Object} p5WeeklyOutput - P5 Weekly 輸出
 * @param {Object} snapshot - P5 Weekly 快照
 */
function saveP5WeeklyLearningLog(p5WeeklyOutput, snapshot) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P5__LEARNING_LOG");
    
    if (!sheet) {
      sheet = ss.insertSheet("P5__LEARNING_LOG");
      sheet.appendRow(P5_LEARNING_LOG_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const today = new Date();
    const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    // 提取學習相關數據
    const beliefUpdate = p5WeeklyOutput.belief_update || {};
    const causalityChain = p5WeeklyOutput.causality_chain || {};
    const riskEvents = p5WeeklyOutput.risk_events || [];
    
    // 生成成功/失敗案例（簡化版，實際應該對比預測與實際結果）
    const successCases = [];
    const failureCases = [];
    const keyLessons = [];
    
    // 從信念更新中提取關鍵教訓
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
    
    // 從因果鏈中提取教訓
    if (causalityChain.chains && Array.isArray(causalityChain.chains)) {
      for (const chain of causalityChain.chains) {
        if (chain.confidence > 0.7) {
          keyLessons.push({
            cause: chain.cause,
            effect: chain.effect,
            confidence: chain.confidence
          });
        }
      }
    }
    
    // 從風險事件中提取教訓
    for (const risk of riskEvents) {
      if (risk.severity === "HIGH" || risk.severity === "CRITICAL") {
        keyLessons.push({
          type: "risk_event",
          event: risk.event,
          severity: risk.severity,
          impact: risk.impact
        });
      }
    }
    
    // 信念驗證（簡化版，實際應該對比歷史預測）
    const beliefVerification = {
      verified_beliefs: [],
      unverified_beliefs: [],
      note: "需要對比歷史預測與實際結果進行驗證"
    };
    
    // 系統化學習（從本週分析中提取）
    const systematicLearning = {
      market_regime_identified: p5WeeklyOutput.market_analysis?.market_regime || null,
      key_patterns: extractKeyPatterns(p5WeeklyOutput),
      strategy_adjustments: p5WeeklyOutput.derivatives_strategy_adjustment || {}
    };
    
    // 事件權重校準（簡化版）
    const eventWeightCalibration = {
      high_impact_events: riskEvents.filter(r => r.severity === "HIGH" || r.severity === "CRITICAL").length,
      note: "需要根據實際影響調整事件權重"
    };
    
    // 下一季度建議（從分析中提取）
    const nextQuarterSuggestions = p5WeeklyOutput.action_list || [];
    
    const row = [
      dateStr,
      "WEEKLY",
      "BELIEF_UPDATE",
      JSON.stringify(successCases),
      JSON.stringify(failureCases),
      JSON.stringify(keyLessons),
      JSON.stringify(beliefVerification),
      JSON.stringify(systematicLearning),
      JSON.stringify(eventWeightCalibration),
      JSON.stringify(nextQuarterSuggestions),
      today
    ];
    
    sheet.appendRow(row);
    Logger.log(`P5 Weekly：學習日誌已保存（成功案例：${successCases.length}，關鍵教訓：${keyLessons.length}）`);
    
  } catch (error) {
    Logger.log(`P5 Weekly：保存學習日誌失敗：${error.message}`);
  }
}

/**
 * 提取關鍵模式（從 P5 Weekly 輸出中）
 * 
 * @param {Object} p5WeeklyOutput - P5 Weekly 輸出
 * @returns {Array} keyPatterns - 關鍵模式列表
 */
function extractKeyPatterns(p5WeeklyOutput) {
  const patterns = [];
  
  // 從市場分析中提取模式
  if (p5WeeklyOutput.market_analysis) {
    if (p5WeeklyOutput.market_analysis.market_regime) {
      patterns.push({
        type: "market_regime",
        value: p5WeeklyOutput.market_analysis.market_regime
      });
    }
    if (p5WeeklyOutput.market_analysis.trend_analysis) {
      patterns.push({
        type: "trend",
        value: p5WeeklyOutput.market_analysis.trend_analysis
      });
    }
  }
  
  // 從因果鏈中提取模式
  if (p5WeeklyOutput.causality_chain && p5WeeklyOutput.causality_chain.chains) {
    const highConfidenceChains = p5WeeklyOutput.causality_chain.chains.filter(c => c.confidence > 0.7);
    if (highConfidenceChains.length > 0) {
      patterns.push({
        type: "causality",
        chains: highConfidenceChains.length
      });
    }
  }
  
  return patterns;
}
