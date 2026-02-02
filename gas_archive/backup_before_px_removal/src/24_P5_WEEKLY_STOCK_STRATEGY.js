/**
 * 📊 P5 Weekly: 個股策略生成模組（核心）
 * 
 * 負責為每檔股票生成動態策略調整：
 * - 整合 P0-P4 快照
 * - 整合 Daily 數據
 * - 整合世界觀和事件因子
 * - ⭐ V8.0 新增：整合籌碼面信號（影響買入/持有/減倉決策）
 * - 生成加碼/減碼/掛單調整策略
 * 
 * ⭐ 核心特性：Batch 機制（10 檔/批，避免成本爆炸）
 * 
 * @version SSOT V8.0
 * @date 2025-01-14
 */

// ==========================================
// Batch 配置
// ==========================================

const P5_WEEKLY_STOCK_STRATEGY_CONFIG = {
  // Batch 大小（每批處理的股票數量）
  // ⚠️ V8.0 修正：批次大小（3 家/批，避免 Context Window Overflow 風險）
  // 原設定 6 家/批（177K 輸入 + 64K 輸出 = 241K > 200K 限制）會導致 Overflow
  // 修正為 3 家/批後，約 89K 輸入 + 32K 輸出 = 121K，安全邊際充足
  BATCH_SIZE: 3,  // ⚠️ V8.0 修正：批次大小（3 家/批，避免 Context Window Overflow）
  
  // 批次間延遲（毫秒，避免 API 限流）
  BATCH_DELAY_MS: 2000,
  
  // 因子權重參考配置（僅供 AI 參考，實際權重由 AI 動態決定）⭐ V8.0 修正：權重不應寫死，應由 AI 動態決定
  // ⚠️ 注意：此配置僅作為參考，AI 模型必須根據當下所有資訊動態決定各因子的權重
  FACTOR_WEIGHTS_REFERENCE: {
    worldview: 0.25,        // 世界觀因子（參考值）
    event: 0.15,           // 事件因子（參考值）
    technical: 0.20,       // 技術面因子（參考值）
    fundamental: 0.15,     // 基本面因子（參考值）
    institutional: 0.10,   // 機構面因子（參考值）
    smart_money: 0.15      // ⭐ V8.0 新增：籌碼面因子（參考值）
  },
  
  // 策略類型
  STRATEGY_TYPES: {
    INCREASE: "INCREASE",      // 加碼
    DECREASE: "DECREASE",      // 減碼
    HOLD: "HOLD",              // 持有
    EXIT: "EXIT"               // 出清
  },
  
  // 行動類型
  ACTION_TYPES: {
    ADD_POSITION: "ADD_POSITION",        // 加倉
    REDUCE_POSITION: "REDUCE_POSITION",  // 減倉
    ADJUST_ORDER: "ADJUST_ORDER",        // 調整掛單
    EXIT: "EXIT"                         // 出清
  }
};

// ==========================================
// 個股數據整合
// ==========================================

/**
 * 為單檔股票整合所有因子數據
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} context - 上下文數據
 * @param {Object} context.allSnapshots - 所有快照（P0-P4）
 * @param {Object} context.dailyData - Daily 數據
 * @param {Object} context.worldview - 世界觀分析結果
 * @param {Object} context.events - 事件分析結果
 * @returns {Object} integratedData - 整合後的數據
 */
function integrateStockFactors(ticker, context) {
  try {
    const {
      allSnapshots = {},
      dailyData = {},
      worldview = {},
      events = {}
    } = context;
    
    // 從各快照中提取該股票的數據
    const stockData = {
      ticker: ticker,
      
      // P0 產業工程學數據
      p0_data: extractStockDataFromSnapshot(ticker, allSnapshots.p0_snapshot),
      p0_thesis_ref: allSnapshots.p0_snapshot?.snapshot_id || null,  // ⭐ V8.15: P0 Thesis 引用標記
      // ⭐ V8.27 新增：P0 conviction_level（從 P0 輸出中提取）
      p0_conviction_level: (() => {
        const p0_snapshot = allSnapshots.p0_snapshot;
        if (!p0_snapshot || !p0_snapshot.p0_output_json) return null;
        const p0_output = typeof p0_snapshot.p0_output_json === 'string' ? JSON.parse(p0_snapshot.p0_output_json) : p0_snapshot.p0_output_json;
        // 簡化實現：從 themes/subthemes 中查找（未來可以改進為根據 Phase1_Company_Pool 的 Theme_ID/Subtheme_ID 精確匹配）
        if (p0_output && p0_output.themes) {
          for (const theme of p0_output.themes || []) {
            if (theme.conviction_level) {
              return theme.conviction_level;
            }
          }
          for (const subtheme of p0_output.subthemes || []) {
            if (subtheme.conviction_level) {
              return subtheme.conviction_level;
            }
          }
        }
        return null;
      })(),
      
      // ⭐ V8.15 新增：P0.5 產業鏈動態監控數據
      p0_5_data: (() => {
        const p0_5_snapshot = allSnapshots.p0_5_snapshot;
        if (!p0_5_snapshot) return null;
        
        return {
          chain_map: p0_5_snapshot.industry_chain_map_json || null,
          chain_monitor: p0_5_snapshot.chain_dynamics_monitor_json || null,
          p5_weekly_flags: p0_5_snapshot.chain_dynamics_monitor_json?.handoff?.p5_weekly_flags || [],
          mode: p0_5_snapshot.mode || null,
          cadence: p0_5_snapshot.cadence || null,
          p0_7_time_window_constraints: p0_5_snapshot.p0_7_time_window_constraints_json || null
        };
      })(),
      
      // P0.7 系統動力學數據
      p0_7_data: extractStockDataFromSnapshot(ticker, allSnapshots.p0_7_snapshot),
      
      // P1 公司池數據
      p1_data: extractStockDataFromSnapshot(ticker, allSnapshots.p1_snapshot),
      
      // P2 基本面數據
      p2_data: extractStockDataFromSnapshot(ticker, allSnapshots.p2_snapshot),
      
      // ⭐ V8.15 新增：從 Phase2_Output 表格讀取 V8.15 新增欄位
      p2_v8_15_fields: extractP2V8_15Fields(ticker),
      
      // ⭐ V8.15 新增：P2.5 籌碼面數據（用於 Escalation Gate 硬觸發）
      p2_5_data: (() => {
        const p2_5_snapshot = allSnapshots.p2_5_snapshot;
        if (!p2_5_snapshot) return null;
        
        // ⭐ V8.15 補強：從 Phase2.5_Output 表格讀取個股級別異常
        const p2_5_stock_data = extractP2_5StockData(ticker);
        
        return {
          insider_selling_alert: p2_5_stock_data?.insider_selling_alert || 
                                 p2_5_snapshot.insider_selling_alert || false,
          abnormal_13f_distribution: p2_5_stock_data?.abnormal_13f_distribution || 
                                     p2_5_snapshot.abnormal_13f_distribution || false,
          distribution_risk_flags: p2_5_stock_data?.distribution_risk_flags || 
                                   p2_5_snapshot.distribution_risk_flags || [],
          smart_money_score: p2_5_stock_data?.smart_money_score || 
                            p2_5_snapshot.p2_5_output_json?.[ticker]?.smart_money_score || null,
          output_json: p2_5_snapshot.p2_5_output_json || {},
          stock_specific_data: p2_5_stock_data  // ⭐ V8.15 新增：個股級別數據
        };
      })(),
      
      // P3 技術面數據
      p3_data: extractStockDataFromSnapshot(ticker, allSnapshots.p3_snapshot),
      
      // P4 資金配置數據
      p4_data: extractStockDataFromSnapshot(ticker, allSnapshots.p4_snapshot),
      
      // Daily 數據
      daily_ohlcv: dailyData.ohlcv?.[ticker] || null,
      // ⭐ V8.12 優化：優先使用週度波動度數據
      daily_technical: dailyData.technical_indicators?.[ticker] || 
                      (dailyData.technical_indicators?._source === "WEEKLY_METRICS" && dailyData.technical_indicators.weekly_metrics?.[ticker] ? 
                       dailyData.technical_indicators.weekly_metrics[ticker] : null),
      daily_derivatives: dailyData.derivatives?.[ticker] || null,
      
      // 世界觀因子
      worldview_factor: calculateWorldviewFactor(ticker, worldview),
      
      // 事件因子（V8.12 優化：使用事件索引）
      event_factor: calculateEventFactor(ticker, events, context.eventsIndex),
      
      // 機構面因子
      institutional_factor: calculateInstitutionalFactor(ticker, dailyData.institutional_data || {}),
      
      // ⭐ V8.0 新增：籌碼面因子
      smart_money_factor: calculateSmartMoneyFactor(ticker, context.smartMoneyData || {}),
      
      // ⭐ V8.12 新增：優化後的索引數據
      stock_news_index: context.stockNewsIndex?.[ticker] || null,  // 個股新聞索引
      sector_news_index: getSectorNewsForStock(ticker, context.sectorNewsIndex),  // 板塊/產業新聞索引
      events_index: context.eventsIndex?.[ticker] || null,  // 事件索引
      macro_weekly_metrics: context.macroWeeklyMetrics || null,  // 宏觀數據週度波動度
      technical_weekly_metrics: context.technicalWeeklyMetrics?.[ticker] || null,  // 技術指標週度波動度
      
      // ⭐ V8.15 新增：P6 週度摘要（頻率趨勢）
      p6_frequency_trend: context.p6_weekly_summary?.frequency_trend || null,
      p6_alert_count: context.p6_weekly_summary?.alert_count || 0,
      p6_trend_ratio: context.p6_weekly_summary?.trend_ratio || 1.0,
      
      // ⭐ V8.15 新增：重大財經行事曆
      calendar_events: context.calendar || null,
      
      // ⭐ V8.15 新增：macro_flow_context（Sector ETF Flow 與 Mag 7 分析）
      macro_flow_context: context.macro_flow_context || null,
      
      // ⭐ V8.15 新增：上週策略執行結果
      previous_strategy_result: context.previous_strategy_results?.[ticker] || null,
      current_positions: context.current_positions?.[ticker] || null,
      open_orders: context.open_orders?.[ticker] || null,
      fills_since_last_week: context.fills_since_last_week?.[ticker] || null,
      
      // ⭐ V8.15 新增：動態學習系統反饋
      learning_feedback: context.learning_feedback || null
    };
    
    // ⭐ V8.0 新增：Hitchhiking 監控
    stockData.hitchhiking = monitorHitchhiking(ticker, {
      p2_5_data: context.p2_5_data || {},
      derivatives_data: dailyData.derivatives || {},
      avg_put_call_ratio: context.avg_put_call_ratio || 0.8,
      previous_dark_pool_sentiment: context.previous_dark_pool_sentiment || {}
    });
    
    return stockData;
    
  } catch (error) {
    Logger.log(`P5 Weekly：整合股票因子失敗（${ticker}）：${error.message}`);
    return {
      ticker: ticker,
      error: error.message
    };
  }
}

/**
 * 從 Phase2_Output 表格讀取 P2 V8.15 新增欄位
 * ⭐ V8.15 新增：完整提取所有 V8.15 新增欄位
 * 
 * @param {string} ticker - 股票代碼
 * @returns {Object|null} p2V8_15Fields - P2 V8.15 新增欄位
 */
function extractP2V8_15Fields(ticker) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase2_Output");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    // 找到 Company_Code 欄位索引
    const companyCodeCol = headers.indexOf("Company_Code");
    if (companyCodeCol === -1) {
      return null;
    }
    
    // 找到該股票的行
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][companyCodeCol] === ticker) {
        const row = rows[i];
        const getColValue = (colName) => {
          const colIndex = headers.indexOf(colName);
          if (colIndex === -1) return null;
          const value = row[colIndex];
          // 嘗試解析 JSON
          if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
            try {
              return JSON.parse(value);
            } catch (e) {
              return value;
            }
          }
          return value;
        };
        
        return {
          // 三軸評級系統
          safety_grade: getColValue("Safety_Grade"),
          safety_score: getColValue("Safety_Score"),
          safety_evidence_json: getColValue("Safety_Evidence_JSON"),
          growth_momentum_grade: getColValue("Growth_Momentum_Grade"),
          growth_quality_score: getColValue("Growth_Quality_Score"),
          growth_momentum_evidence_json: getColValue("Growth_Momentum_Evidence_JSON"),
          future_breakout_grade: getColValue("Future_Breakout_Grade"),
          future_potential_score: getColValue("Future_Potential_Score"),
          future_breakout_evidence_json: getColValue("Future_Breakout_Evidence_JSON"),
          
          // Position Role 和 Track Type
          position_role: getColValue("Position_Role"),
          position_role_reasoning: getColValue("Position_Role_Reasoning"),
          track_type: getColValue("Track_Type"),
          max_position_cap_suggestion: getColValue("Max_Position_Cap_Suggestion"),
          
          // 驗證里程碑
          milestones_to_verify_json: getColValue("Milestones_To_Verify_JSON"),
          
          // Frontier 特殊欄位
          runway_quarters: getColValue("Runway_Quarters"),
          runway_calculation_json: getColValue("Runway_Calculation_JSON"),
          frontier_risks_json: getColValue("Frontier_Risks_JSON"),
          frontier_conditions_json: getColValue("Frontier_Conditions_JSON"),
          gate_result_for_frontier: getColValue("Gate_Result_For_Frontier"),
          
          // Time Window Penalty
          time_window_penalty_json: getColValue("Time_Window_Penalty_JSON"),
          
          // P1 財報段落對照
          narrative_consistency_check: getColValue("Narrative_Consistency_Check"),
          narrative_consistency_evidence_json: getColValue("Narrative_Consistency_Evidence_JSON")
        };
      }
    }
    
    return null;
  } catch (error) {
    Logger.log(`讀取 P2 V8.15 欄位失敗（${ticker}）：${error.message}`);
    return null;
  }
}

/**
 * 從 Phase2.5_Output 表格讀取 P2.5 個股級別數據
 * ⭐ V8.15 新增：提取個股級別異常警報
 * 
 * @param {string} ticker - 股票代碼
 * @returns {Object|null} p2_5_stock_data - P2.5 個股數據
 */
function extractP2_5StockData(ticker) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase2.5_Output");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const companyCodeCol = headers.indexOf("Company_Code");
    if (companyCodeCol === -1) {
      return null;
    }
    
    // 找到該股票的行
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][companyCodeCol] === ticker) {
        const row = rows[i];
        const getColValue = (colName) => {
          const colIndex = headers.indexOf(colName);
          if (colIndex === -1) return null;
          return row[colIndex];
        };
        
        // 判斷異常警報（基於 Insider_Trading_Signal 和 Smart_Money_Score）
        const insiderSignal = getColValue("Insider_Trading_Signal");
        const smartMoneyScore = getColValue("Smart_Money_Score");
        
        // ⭐ V8.15：判斷內部人賣出警報（簡化邏輯，實際應由 P2.5 模組標記）
        const insiderSellingAlert = (insiderSignal && 
          (insiderSignal.includes("SELL") || insiderSignal.includes("SELLING") || 
           insiderSignal.includes("DISTRIBUTION"))) || false;
        
        // ⭐ V8.15：判斷 13F 異常分布（基於 Smart_Money_Score 和 Hedge_Fund_Clone_Score）
        const hedgeFundCloneScore = getColValue("Hedge_Fund_Clone_Score");
        const abnormal13fDistribution = (smartMoneyScore !== null && smartMoneyScore < 30) || 
                                       (hedgeFundCloneScore !== null && hedgeFundCloneScore < 20) || false;
        
        return {
          insider_selling_alert: insiderSellingAlert,
          abnormal_13f_distribution: abnormal13fDistribution,
          distribution_risk_flags: insiderSellingAlert || abnormal13fDistribution ? ["HIGH_DISTRIBUTION_RISK"] : [],
          smart_money_score: smartMoneyScore,
          insider_trading_signal: insiderSignal,
          hedge_fund_clone_score: hedgeFundCloneScore,
          institutional_holdings_score: getColValue("Institutional_Holdings_Score"),
          options_flow_sentiment: getColValue("Options_Flow_Sentiment"),
          dark_pool_activity: getColValue("Dark_Pool_Activity"),
          recommendations: getColValue("Recommendations")
        };
      }
    }
    
    return null;
  } catch (error) {
    Logger.log(`讀取 P2.5 個股數據失敗（${ticker}）：${error.message}`);
    return null;
  }
}

/**
 * 從快照中提取特定股票的數據
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} snapshot - 快照數據
 * @returns {Object|null} stockData - 股票數據
 */
function extractStockDataFromSnapshot(ticker, snapshot) {
  if (!snapshot) {
    return null;
  }
  
  // 嘗試從不同可能的欄位中提取
  const possibleFields = [
    "tier_assignments",
    "technical_results",
    "allocations",
    "stocks",
    "companies",
    "results"
  ];
  
  for (const field of possibleFields) {
    if (snapshot[field] && typeof snapshot[field] === "object") {
      // 如果是對象，嘗試找到該 ticker
      if (snapshot[field][ticker]) {
        return snapshot[field][ticker];
      }
      
      // 如果是數組，嘗試找到該 ticker
      if (Array.isArray(snapshot[field])) {
        const found = snapshot[field].find(item => 
          item.ticker === ticker || item.symbol === ticker
        );
        if (found) {
          return found;
        }
      }
    }
  }
  
  return null;
}

/**
 * 計算世界觀因子（該股票在世界觀中的評分）
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} worldview - 世界觀分析結果
 * @returns {number} factor - 因子值（-1 到 1，-1 為極度看空，1 為極度看多）
 */
function calculateWorldviewFactor(ticker, worldview) {
  try {
    // 簡化實現：從世界觀中提取相關信息
    // 實際應該根據世界觀的結論和該股票的關聯性計算
    
    if (!worldview || !worldview.market_analysis) {
      return 0;  // 中性
    }
    
    const marketRegime = worldview.market_analysis.market_regime || "";
    const overallStatus = worldview.market_analysis.overall_status || "";
    
    // 根據市場狀態給出因子
    if (overallStatus === "BULL" || marketRegime.includes("BULL")) {
      return 0.3;  // 輕微看多
    } else if (overallStatus === "BEAR" || marketRegime.includes("BEAR")) {
      return -0.3;  // 輕微看空
    }
    
    return 0;  // 中性
    
  } catch (error) {
    Logger.log(`P5 Weekly：計算世界觀因子失敗（${ticker}）：${error.message}`);
    return 0;
  }
}

/**
 * 獲取股票的板塊/產業相關新聞索引 ⭐ V8.12 新增
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} sectorNewsIndex - 板塊/產業新聞索引
 * @returns {Object|null} sectorNews - 該股票所屬板塊/產業的新聞索引
 */
function getSectorNewsForStock(ticker, sectorNewsIndex) {
  if (!sectorNewsIndex || Object.keys(sectorNewsIndex).length === 0) {
    return null;
  }
  
  try {
    // 獲取該股票的板塊/產業歸屬
    const sectorInfo = getStockSectorInfo(ticker);
    
    if (!sectorInfo.sector && !sectorInfo.industry) {
      return null;
    }
  
    // 查找相關的板塊/產業新聞索引
    const relatedNews = {};
    
    if (sectorInfo.sector && sectorNewsIndex && sectorNewsIndex[sectorInfo.sector]) {
      relatedNews[sectorInfo.sector] = sectorNewsIndex[sectorInfo.sector];
    }
    
    if (sectorInfo.industry && sectorNewsIndex && sectorNewsIndex[sectorInfo.industry]) {
      relatedNews[sectorInfo.industry] = sectorNewsIndex[sectorInfo.industry];
    }
    
    return Object.keys(relatedNews).length > 0 ? relatedNews : null;
    
  } catch (error) {
    Logger.log(`P5 Weekly V8.12：獲取股票板塊/產業新聞失敗（${ticker}）：${error.message}`);
    return null;
  }
}

/**
 * 計算事件因子（該股票相關事件的影響）
 * ⭐ V8.12 優化：優先使用事件索引（如果存在）
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} events - 事件分析結果
 * @param {Object} eventsIndex - 事件索引（V8.12 新增，可選）
 * @returns {number} factor - 因子值（-1 到 1）
 */
function calculateEventFactor(ticker, events, eventsIndex = null) {
  try {
    // ⭐ V8.12 優化：優先使用事件索引
    if (eventsIndex && eventsIndex[ticker]) {
      const index = eventsIndex[ticker];
      const upcomingEvents = index.upcoming_events || [];
      
      if (upcomingEvents.length === 0) {
        return 0;
      }
      
      // 計算事件影響（使用索引中的數據）
      let totalImpact = 0;
      for (const event of upcomingEvents) {
        const daysUntil = event.days_until_event || 0;
        const alertLevel = event.alert_level || "LIGHT";
        
        // 距離越近，影響越大
        const timeWeight = daysUntil <= 7 ? 1.0 : (daysUntil <= 14 ? 0.7 : 0.3);
        
        // 警報級別越高，影響越大
        const alertWeight = alertLevel === "STRONG" ? 1.0 : (alertLevel === "MODERATE" ? 0.5 : 0.2);
        
        // 事件類型影響（財報通常為負面風險）
        const eventTypeWeight = event.event_type === "EARNINGS" ? -0.3 : 0.1;
        
        totalImpact += timeWeight * alertWeight * eventTypeWeight;
      }
      
      // 歸一化到 -1 到 1
      return Math.max(-1, Math.min(1, totalImpact));
    }
    
    // 回退到原始邏輯
    if (!events || !Array.isArray(events.upcoming_events)) {
      return 0;
    }
    
    // 找到與該股票相關的事件
    const relatedEvents = events.upcoming_events.filter(event => 
      event.tickers && event.tickers.includes(ticker)
    );
    
    if (relatedEvents.length === 0) {
      return 0;
    }
    
    // 計算事件影響（簡化實現）
    let totalImpact = 0;
    for (const event of relatedEvents) {
      const daysUntil = event.days_until_event || 0;
      const alertLevel = event.alert_level || "LIGHT";
      
      // 距離越近，影響越大
      const timeWeight = daysUntil <= 7 ? 1.0 : (daysUntil <= 14 ? 0.7 : 0.3);
      
      // 警報級別越高，影響越大
      const alertWeight = alertLevel === "STRONG" ? 1.0 : (alertLevel === "MODERATE" ? 0.5 : 0.2);
      
      // 事件類型影響（財報通常為負面風險）
      const eventTypeWeight = event.event_type === "EARNINGS" ? -0.3 : 0.1;
      
      totalImpact += timeWeight * alertWeight * eventTypeWeight;
    }
    
    // 歸一化到 -1 到 1
    return Math.max(-1, Math.min(1, totalImpact));
    
  } catch (error) {
    Logger.log(`P5 Weekly：計算事件因子失敗（${ticker}）：${error.message}`);
    return 0;
  }
}

/**
 * 計算籌碼面因子（籌碼面信號對該股票的影響）⭐ V8.0 新增
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} smartMoneyData - 籌碼面數據
 * @returns {number} factor - 因子值（-1 到 1）
 */
function calculateSmartMoneyFactor(ticker, smartMoneyData) {
  try {
    if (!smartMoneyData || !smartMoneyData.smart_money_signal) {
      return 0;
    }
    
    const signal = smartMoneyData.smart_money_signal;
    const tickerData = {
      insider_trading: smartMoneyData.insider_trading?.[ticker] || [],
      dark_pool: smartMoneyData.dark_pool_activity?.[ticker] || null
    };
    
    let factor = 0;
    
    // 整體信號影響
    if (signal === "BULLISH") {
      factor += 0.3;  // 整體看多
    } else if (signal === "BEARISH") {
      factor -= 0.3;  // 整體看空
    }
    
    // 該股票的內部人交易影響
    if (tickerData.insider_trading && Array.isArray(tickerData.insider_trading)) {
      const buyCount = tickerData.insider_trading.filter(t => 
        t.transaction_type === "BUY" || t.transaction_type === "PURCHASE"
      ).length;
      const sellCount = tickerData.insider_trading.filter(t => 
        t.transaction_type === "SELL" || t.transaction_type === "SALE"
      ).length;
      
      if (buyCount > sellCount * 2) {
        factor += 0.2;  // 內部人大量買入
      } else if (sellCount > buyCount * 2) {
        factor -= 0.2;  // 內部人大量賣出
      }
    }
    
    // 該股票的 Dark Pool 活動影響
    if (tickerData.dark_pool && tickerData.dark_pool.volume_change) {
      if (tickerData.dark_pool.volume_change > 0.2) {
        factor += 0.15;  // Dark Pool 活動增加
      } else if (tickerData.dark_pool.volume_change < -0.2) {
        factor -= 0.15;  // Dark Pool 活動減少
      }
    }
    
    return Math.max(-1, Math.min(1, factor));
    
  } catch (error) {
    Logger.log(`P5 Weekly：計算籌碼面因子失敗（${ticker}）：${error.message}`);
    return 0;
  }
}

/**
 * 計算機構面因子（機構行為對該股票的影響）
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} institutionalData - 機構數據
 * @returns {number} factor - 因子值（-1 到 1）
 */
function calculateInstitutionalFactor(ticker, institutionalData) {
  try {
    if (!institutionalData) {
      return 0;
    }
    
    let factor = 0;
    
    // 13F 持倉變化
    if (institutionalData.f13f && institutionalData.f13f[ticker]) {
      // 簡化：如果有 13F 數據，視為正面信號
      factor += 0.1;
    }
    
    // Dark Pool 活動
    if (institutionalData.dark_pool && institutionalData.dark_pool[ticker]) {
      // 簡化：如果有 Dark Pool 活動，視為正面信號
      factor += 0.1;
    }
    
    // Options Flow
    if (institutionalData.options_flow && institutionalData.options_flow[ticker]) {
      // 簡化：如果有 Options Flow，視為正面信號
      factor += 0.1;
    }
    
    // Insider Trading
    if (institutionalData.insider_trading && Array.isArray(institutionalData.insider_trading)) {
      const insiderActivity = institutionalData.insider_trading.filter(
        item => item.ticker === ticker
      );
      if (insiderActivity.length > 0) {
        // 簡化：如果有內部人交易，視為正面信號
        factor += 0.1;
      }
    }
    
    return Math.max(-1, Math.min(1, factor));
    
  } catch (error) {
    Logger.log(`P5 Weekly：計算機構面因子失敗（${ticker}）：${error.message}`);
    return 0;
  }
}

// ==========================================
// Batch 處理主函數
// ==========================================

/**
 * 分批生成個股策略（核心函數，帶 Batch 機制）
 * 
 * @param {Array} tickers - 股票列表
 * @param {Object} context - 上下文數據
 * @returns {Object} allStrategies - 所有股票的策略結果
 */
function generateStockStrategiesInBatches(tickers, context) {
  try {
    Logger.log(`P5 Weekly：開始分批生成個股策略（共 ${tickers.length} 檔股票）`);
    
    const BATCH_SIZE = P5_WEEKLY_STOCK_STRATEGY_CONFIG.BATCH_SIZE;
    const totalBatches = Math.ceil(tickers.length / BATCH_SIZE);
    const allStrategies = {};
    
    // 分批處理
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      Logger.log(`P5 Weekly：處理個股策略批次 ${batchNumber}/${totalBatches} (${batch.length} 檔)`);
      
      try {
        // 為這批股票構建 Prompt
        const batchPrompt = buildStockStrategyBatchPrompt(batch, context);
        
        // 提交到 M0 Job Queue（異步處理）
        const jobId = submitP5ToM0JobQueue(
          "P5_WEEKLY_STOCK_STRATEGY",
          ["SONNET", "GPT"],  // Sonnet 執行，GPT 審查
          {
            batch_number: batchNumber,
            total_batches: totalBatches,
            tickers: batch,
            prompt: batchPrompt,
            context: context,
            factor_weights_reference: P5_WEEKLY_STOCK_STRATEGY_CONFIG.FACTOR_WEIGHTS_REFERENCE
          }
        );
        
        // 等待結果（同步等待，實際應該異步處理）
        // 注意：這裡簡化為同步等待，實際應該使用異步機制
        const batchResult = waitForM0JobResult(jobId);
        
        if (batchResult && batchResult.stock_strategies) {
          // 合併結果
          Object.assign(allStrategies, batchResult.stock_strategies);
        } else {
          // 如果 AI 分析失敗，使用程式化邏輯生成策略
          Logger.log(`P5 Weekly：批次 ${batchNumber} AI 分析失敗，使用程式化邏輯`);
          for (const ticker of batch) {
            allStrategies[ticker] = generateProgrammaticStrategy(ticker, context);
          }
        }
        
        // 批次間延遲，避免 API 限流
        if (i + BATCH_SIZE < tickers.length) {
          Utilities.sleep(P5_WEEKLY_STOCK_STRATEGY_CONFIG.BATCH_DELAY_MS);
        }
        
      } catch (error) {
        Logger.log(`P5 Weekly：批次 ${batchNumber} 處理失敗：${error.message}`);
        // 記錄失敗的股票，但不中斷整個流程
        for (const ticker of batch) {
          allStrategies[ticker] = {
            ticker: ticker,
            status: "ERROR",
            error: error.message,
            strategy: "HOLD",  // 失敗時預設持有
            action: "HOLD"
          };
        }
      }
    }
    
    Logger.log(`P5 Weekly：個股策略生成完成（成功：${Object.keys(allStrategies).length} 檔）`);
    
    return allStrategies;
    
  } catch (error) {
    Logger.log(`P5 Weekly：分批生成個股策略失敗：${error.message}`);
    throw error;
  }
}

/**
 * 檢查股票是否有財報事件（未來 14 天內）⭐ V8.0 新增
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} events - 事件數據
 * @returns {Object|null} 如果有財報事件則返回事件信息，否則返回 null
 */
function checkEarningsEvent(ticker, events) {
  try {
    if (!events || !Array.isArray(events.upcoming_events)) {
      return null;
    }
    
    const earningsEvent = events.upcoming_events.find(event => 
      event.tickers && event.tickers.includes(ticker) &&
      event.event_type === "EARNINGS" &&
      event.days_until_event !== undefined &&
      event.days_until_event <= 14
    );
    
    if (earningsEvent) {
      return {
        days_until: earningsEvent.days_until_event,
        earnings_date: earningsEvent.event_date || earningsEvent.date
      };
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`P5 Weekly：檢查財報事件失敗（${ticker}）：${error.message}`);
    return null;
  }
}

/**
 * 構建批次 Prompt（用於 AI 分析）⭐ V8.0 增強：加入籌碼面信號 + 財報日個股籌碼權重加強
 * 
 * @param {Array} batch - 批次股票列表
 * @param {Object} context - 上下文數據（包含籌碼面數據）
 * @returns {string} prompt - AI Prompt
 */
function buildStockStrategyBatchPrompt(batch, context) {
  const stockDataList = [];
  const earningsStocks = [];  // ⭐ V8.0 新增：記錄有財報日的股票
  
  // 為每檔股票整合因子數據
  for (const ticker of batch) {
    const integratedData = integrateStockFactors(ticker, context);
    stockDataList.push(integratedData);
    
    // ⭐ V8.0 新增：檢查是否有財報事件（未來 14 天內）
    const hasEarnings = checkEarningsEvent(ticker, context.events);
    if (hasEarnings) {
      earningsStocks.push({
        ticker: ticker,
        days_until: hasEarnings.days_until,
        earnings_date: hasEarnings.earnings_date
      });
    }
  }
  
  // ⭐ V8.0 新增：構建財報日個股籌碼權重加強說明
  let earningsChipWeightSection = "";
  if (earningsStocks.length > 0) {
    earningsChipWeightSection = `
## 財報日個股籌碼權重加強 ⭐⭐⭐ 重要規則

**核心規則**：如果掃描兩週內目前持倉個股有公布財報，必須調整機構籌碼面的權重到短期最高。

**需要加強籌碼權重的股票**：
${earningsStocks.map(s => `- **${s.ticker}**：將於 ${s.days_until} 天後（${s.earnings_date}）公布財報`).join("\n")}

**具體要求**：
- 對於上述未來 14 天內有財報公布的持倉個股：
  - **smart_money 權重**：必須提高到 **0.25-0.35**（短期最高）
  - **institutional 權重**：必須提高到 **0.15-0.20**（短期最高）
  - 其他因子權重相應降低，但總和仍為 1.0
  
**理由**：
- 財報前 1-2 週的籌碼面變化最能反映機構和內部人的真實預期
- 機構和內部人通常提前知道消息並布局（買入或賣出）
- 觀察籌碼面可以提前捕捉信號，財報公布時價格已反應大半

**判斷邏輯**：
1. 檢查 context.events.upcoming_events 中是否有該股票的財報事件（event_type === "EARNINGS"）
2. 如果有，且 days_until_event <= 14，則觸發籌碼權重加強
3. 在 factor_weights 中調整 smart_money 和 institutional 權重
4. 在 weight_reasoning 中明確說明："該股票將於 X 天後公布財報，因此加強籌碼面權重（smart_money: 0.XX, institutional: 0.XX）以捕捉機構提前布局信號"

**⚠️ 重要**：此規則優先於一般權重決定邏輯，必須嚴格執行。
`;
  }
  
  return `
你是一位資深的股票策略分析師，負責為 Nuclear Project 的 P5 Weekly 生成個股策略。

## 任務目標

為以下 ${batch.length} 檔股票生成本週的動態策略調整：
${batch.join(", ")}

## 因子權重配置（僅供參考，AI 必須動態決定）

**重要原則**：因子權重不應寫死，必須由 AI 模型根據當下所有資訊動態決定。

**參考權重（僅供參考，不代表最終權重）**：
${JSON.stringify(P5_WEEKLY_STOCK_STRATEGY_CONFIG.FACTOR_WEIGHTS_REFERENCE, null, 2)}

**AI 必須考慮的所有因子**：
1. **worldview**（世界觀因子）：宏觀市場狀態、Regime、Sector Rotation 等
2. **event**（事件因子）：財報、重大新聞、事件驅動因素
3. **technical**（技術面因子）：技術指標、價格行為、趨勢分析
4. **fundamental**（基本面因子）：財務指標、同業比較、結構性優勢
5. **institutional**（機構面因子）：機構持倉、13F 數據
6. **smart_money**（籌碼面因子）：內部人交易、Dark Pool、期權流向、對沖基金 Clone

**權重決定要求**：
- ✅ AI 必須根據當下所有資訊動態決定各因子的權重
- ✅ AI 必須考慮所有提供的因子數據，不能忽略任何一個
- ✅ AI 必須在輸出中說明權重決定的理由
- ❌ 禁止使用固定的權重配置，必須動態調整
- ❌ 禁止忽略任何因子數據
${earningsChipWeightSection}

## 股票數據

${JSON.stringify(stockDataList, null, 2)}

## 世界觀分析

${JSON.stringify(context.worldview || {}, null, 2)}

## 事件分析

${JSON.stringify(context.events || {}, null, 2)}

## 籌碼面週報 ⭐ V8.0 新增

${JSON.stringify(context.smartMoneyData || {}, null, 2)}

**重要**：籌碼面信號（BULLISH/NEUTRAL/BEARISH）應影響買入/持有/減倉決策：
- **BULLISH**：傾向加碼或持有
- **BEARISH**：傾向減倉或出清
- **NEUTRAL**：維持現有策略

## Hitchhiking 監控（順風車監控）⭐ V8.0 新增

**監控邏輯**：跟隨機構主力（聰明錢）的投資策略，監控機構是否開始出貨。

**監控信號**：
1. **機構開始出貨**：13F 持倉變化顯示機構在減倉（從 P2.5 數據）
2. **內部人開始賣出**：內部人交易顯示大量賣出（從 P2.5 數據）
3. **Dark Pool 轉向**：Dark Pool 活動從看漲轉為看跌（從 P2.5 數據）
4. **期權 Put 保護激增**：Put/Call Ratio 異常上升（從 P5 Daily 期權數據）

**綜合判斷邏輯**：
- 如果同一檔股票有 **2+ 個 HIGH severity 信號** → 機構在出貨，建議減倉
- 如果只有 1 個 HIGH severity 信號 → 警示，但可繼續持有
- 如果所有信號都是 LOW 或無信號 → 維持現有策略

**Hitchhiking 監控數據**（已整合到各股票的因子數據中）：
- 每個股票的 hitchhiking_signals 欄位包含上述 4 個監控信號
- 每個股票的 hitchhiking_severity 欄位包含綜合嚴重程度（LOW/MEDIUM/HIGH）
- 每個股票的 hitchhiking_recommendation 欄位包含減倉建議（HOLD/REDUCE/EXIT）

## 輸出格式（必須是 JSON，每檔股票一個策略）

{
  "stock_strategies": {
    "TICKER1": {
      "ticker": "TICKER1",
      "strategy": "INCREASE/DECREASE/HOLD/EXIT",
      "action": "ADD_POSITION/REDUCE_POSITION/ADJUST_ORDER/EXIT",
      "target_allocation": 0.15,
      "current_allocation": 0.10,
      "order_adjustments": [
        {
          "order_type": "BUY/SELL",
          "price": 150.00,
          "quantity": 100,
          "reason": "策略理由"
        }
      ],
      "confidence": 0.75,
      "factor_weights": {
        "worldview": 0.30,      // ⭐ AI 動態決定的權重
        "event": 0.15,          // ⭐ AI 動態決定的權重
        "technical": 0.20,      // ⭐ AI 動態決定的權重
        "fundamental": 0.15,    // ⭐ AI 動態決定的權重
        "institutional": 0.10,  // ⭐ AI 動態決定的權重
        "smart_money": 0.10     // ⭐ AI 動態決定的權重（總和應為 1.0）
      },
      "weight_reasoning": "說明權重決定的理由，例如：當下籌碼面信號強烈，因此 smart_money 權重較高；技術面出現背離，因此 technical 權重降低",
      "factors": {
        "worldview": 0.3,
        "event": 0.2,
        "technical": 0.25,
        "fundamental": 0.15,
        "institutional": 0.10,
        "smart_money": 0.10
      },
      "final_score": 0.75,      // ⭐ 最終融合評分（基於動態權重）
      "reasoning": "詳細分析理由"
    }
  }
}

---

## ⚠️ 重要：輸出格式要求（節省 Token 成本）

- ❌ **禁止任何客套話、開場白、結尾語**（例如：「你問得非常好...」、「如果你需要的話，我可以幫你...」等）
- ❌ **禁止任何與工作無關的說明文字**
- ✅ **只輸出純 JSON 格式**，直接開始 JSON 對象，不要有任何前綴或後綴
- ✅ **API 版本必須嚴格遵守此要求**，與網頁版不同，API 版本不應包含任何額外的禮貌性文字
- ✅ **節省 Token = 節省成本**，每多一個無用的 token 都會增加成本
`;
}

/**
 * 等待 M0 Job 結果（同步等待，實際應該異步）
 * 
 * @param {string} jobId - Job ID
 * @returns {Object|null} result - 執行結果
 */
function waitForM0JobResult(jobId) {
  try {
    // 簡化實現：直接從 M0__RESULT 讀取
    // 實際應該使用輪詢或回調機制
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("M0__RESULT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const jobIdCol = headers.indexOf("job_id");
    const resultCol = headers.indexOf("result_json");
    
    if (jobIdCol === -1 || resultCol === -1) {
      return null;
    }
    
    // 找到對應的 Job
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rows[i][jobIdCol] === jobId) {
        const resultJson = rows[i][resultCol];
        if (resultJson) {
          try {
            return JSON.parse(resultJson);
          } catch (e) {
            Logger.log(`P5 Weekly：解析 M0 結果失敗：${e.message}`);
            return null;
          }
        }
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`P5 Weekly：等待 M0 Job 結果失敗：${error.message}`);
    return null;
  }
}

/**
 * 生成程式化策略（當 AI 分析失敗時使用）⭐ V8.0 增強：加入籌碼面影響
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} context - 上下文數據（包含籌碼面數據）
 * @returns {Object} strategy - 策略結果
 */
function generateProgrammaticStrategy(ticker, context) {
  try {
    // 簡化實現：基於技術指標和基本面生成策略
    const integratedData = integrateStockFactors(ticker, context);
    
    // 計算綜合評分（包含籌碼面因子）⭐ V8.0 增強
    // ⚠️ V8.0 修正：權重應由 AI 動態決定，此處僅作為程式化策略的備用邏輯
    // 如果 AI 分析失敗，才使用此程式化邏輯（使用參考權重）
    const factorWeights = P5_WEEKLY_STOCK_STRATEGY_CONFIG.FACTOR_WEIGHTS_REFERENCE;
    
    const worldviewScore = (integratedData.worldview_factor || 0) * factorWeights.worldview;
    const eventScore = (integratedData.event_factor || 0) * factorWeights.event;
    const technicalScore = calculateTechnicalScore(integratedData) * factorWeights.technical;
    const fundamentalScore = calculateFundamentalScore(integratedData) * factorWeights.fundamental;
    const institutionalScore = (integratedData.institutional_factor || 0) * factorWeights.institutional;
    const smartMoneyScore = (integratedData.smart_money_factor || 0) * factorWeights.smart_money;  // ⭐ V8.0 新增
    
    const totalScore = worldviewScore + eventScore + technicalScore + fundamentalScore + institutionalScore + smartMoneyScore;
    
    // 根據評分決定策略
    let strategy, action;
    if (totalScore > 0.3) {
      strategy = P5_WEEKLY_STOCK_STRATEGY_CONFIG.STRATEGY_TYPES.INCREASE;
      action = P5_WEEKLY_STOCK_STRATEGY_CONFIG.ACTION_TYPES.ADD_POSITION;
    } else if (totalScore < -0.3) {
      strategy = P5_WEEKLY_STOCK_STRATEGY_CONFIG.STRATEGY_TYPES.DECREASE;
      action = P5_WEEKLY_STOCK_STRATEGY_CONFIG.ACTION_TYPES.REDUCE_POSITION;
    } else {
      strategy = P5_WEEKLY_STOCK_STRATEGY_CONFIG.STRATEGY_TYPES.HOLD;
      action = "HOLD";
    }
    
    return {
      ticker: ticker,
      status: "SUCCESS",
      strategy: strategy,
      action: action,
      confidence: Math.abs(totalScore),
      factors: {
        worldview: worldviewScore,
        event: eventScore,
        technical: technicalScore,
        fundamental: fundamentalScore,
        institutional: institutionalScore,
        smart_money: smartMoneyScore  // ⭐ V8.0 新增：籌碼面因子
      },
      weight_reasoning: "程式化策略使用參考權重，AI 分析應動態決定權重",
      reasoning: `程式化策略（總評分：${totalScore.toFixed(2)}）`
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：生成程式化策略失敗（${ticker}）：${error.message}`);
    return {
      ticker: ticker,
      status: "ERROR",
      strategy: "HOLD",
      action: "HOLD",
      error: error.message
    };
  }
}

/**
 * 計算技術面評分
 * 
 * @param {Object} integratedData - 整合後的股票數據
 * @returns {number} score - 技術面評分（-1 到 1）
 */
function calculateTechnicalScore(integratedData) {
  try {
    // 簡化實現：從 P3 數據和 Daily 技術指標計算
    const p3Data = integratedData.p3_data;
    const dailyTechnical = integratedData.daily_technical;
    
    if (!p3Data && !dailyTechnical) {
      return 0;
    }
    
    // 這裡應該根據實際的技術指標計算
    // 簡化為返回 0（中性）
    return 0;
    
  } catch (error) {
    Logger.log(`P5 Weekly：計算技術面評分失敗：${error.message}`);
    return 0;
  }
}

/**
 * 計算基本面評分
 * 
 * @param {Object} integratedData - 整合後的股票數據
 * @returns {number} score - 基本面評分（-1 到 1）
 */
function calculateFundamentalScore(integratedData) {
  try {
    // 簡化實現：從 P2 數據計算
    const p2Data = integratedData.p2_data;
    
    if (!p2Data) {
      return 0;
    }
    
    // 這裡應該根據實際的基本面數據計算
    // 簡化為返回 0（中性）
    return 0;
    
  } catch (error) {
    Logger.log(`P5 Weekly：計算基本面評分失敗：${error.message}`);
    return 0;
  }
}
