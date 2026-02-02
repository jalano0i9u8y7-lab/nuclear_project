/**
 * 📊 P5 Weekly: 雙層 AI 架構模組 ⭐ V8.15 新增
 * 
 * 實現 P5-B（低成本評估器）和 P5-A（深度重評估）雙層架構
 * - P5-B：每檔都跑（低成本，Claude Sonnet 4.5）
 * - P5-A：僅升級少數（10-20%，Claude Sonnet 4.5 或 Opus）
 * - Escalation Gate：決定是否觸發 P5-A
 * 
 * @version SSOT V8.15
 * @date 2026-01-19
 * 
 * ⭐ V8.15 依賴：
 * - 24_P5_WEEKLY_STRATEGY_SKELETON.js（Strategy Skeleton 與 Parameter Adjustment Vector）
 * - 24_P5_WEEKLY_STOCK_STRATEGY.js（integrateStockFactors、extractP2_5StockData）
 */

// ==========================================
// P5-B（Weekly State Evaluator）配置
// ==========================================

const P5_B_CONFIG = {
  MODEL: "CLAUDE_SONNET_4_5",
  BATCH_SIZE: 10,  // P5-B 可以批次更大（低成本）
  BATCH_DELAY_MS: 1000
};

// ==========================================
// P5-A（Weekly Deep Re-evaluation）配置
// ==========================================

const P5_A_CONFIG = {
  MODEL: "OPUS",  // ⭐ V8.17 更新：Batch 版本一律使用 Opus（因為已經只處理 20%+ Batch，沒必要妥協用便宜的模型）
  BATCH_SIZE: 3,  // P5-A 批次較小（深度分析）
  BATCH_DELAY_MS: 2000
};

// ==========================================
// Escalation Gate 配置
// ==========================================

const ESCALATION_GATE_CONFIG = {
  // 軟觸發條件（基於 escalation_score）
  ESCALATION_SCORE_THRESHOLD: 0.6,
  TREND_INTEGRITY_THRESHOLD: 0.4,
  DISTRIBUTION_RISK_THRESHOLD: 0.7,
  
  // 硬觸發條件（P2.5 異常）
  P2_5_INSIDER_SELLING_ALERT: true,  // 直接觸發
  P2_5_ABNORMAL_13F_DISTRIBUTION: true,  // 直接觸發
  
  // Chain Dynamics 觸發
  CHAIN_DYNAMICS_DIVERGENCE: "DIVERGENCE"
};

/**
 * 計算 Escalation Score（決定是否觸發 P5-A）
 * ⭐ V8.15 新增：整合 P2.5 異常硬觸發
 * 
 * @param {Object} stockData - 股票數據（已整合所有因子）
 * @returns {Object} escalationResult - 升級結果
 */
function calculateEscalationScore(stockData) {
  try {
    let escalationScore = 0.0;
    const reasons = [];
    let forcedEscalation = false;
    
    // ⭐ V8.15 硬觸發條件 1：P2.5 異常警報
    if (stockData.p2_5_data) {
      if (stockData.p2_5_data.insider_selling_alert === true) {
        escalationScore = 1.0;  // 強制升級
        forcedEscalation = true;
        reasons.push({
          type: "P2_5_INSIDER_SELLING",
          severity: "HIGH",
          message: "內部人大量賣出，強制深度重評估"
        });
      } else if (stockData.p2_5_data.abnormal_13f_distribution === true) {
        escalationScore = 1.0;  // 強制升級
        forcedEscalation = true;
        reasons.push({
          type: "P2_5_ABNORMAL_13F",
          severity: "HIGH",
          message: "13F 異常分布，強制深度重評估"
        });
      }
    }
    
    // 如果已硬觸發，直接返回
    if (forcedEscalation) {
      return {
        escalation_score: escalationScore,
        should_escalate: true,
        forced_escalation: {
          trigger: "P2.5",
          type: reasons[0].type,
          confidence: "HIGH",
          note: reasons[0].message
        },
        reasons: reasons
      };
    }
    
    // 軟觸發條件（基於 state_vector）
    const stateVector = stockData.state_vector || {};
    
    // 1. Trend Integrity 檢查
    if (stateVector.trend_integrity !== undefined) {
      if (stateVector.trend_integrity < ESCALATION_GATE_CONFIG.TREND_INTEGRITY_THRESHOLD) {
        escalationScore += 0.3;
        reasons.push({
          type: "LOW_TREND_INTEGRITY",
          severity: "MEDIUM",
          message: `趨勢完整性低（${stateVector.trend_integrity.toFixed(2)}）`
        });
      }
    }
    
    // 2. Distribution Risk 檢查
    if (stateVector.distribution_risk !== undefined) {
      if (stateVector.distribution_risk > ESCALATION_GATE_CONFIG.DISTRIBUTION_RISK_THRESHOLD) {
        escalationScore += 0.3;
        reasons.push({
          type: "HIGH_DISTRIBUTION_RISK",
          severity: "MEDIUM",
          message: `派發風險高（${stateVector.distribution_risk.toFixed(2)}）`
        });
      }
    }
    
    // 3. Chain Dynamics Divergence 檢查
    if (stockData.p0_5_data && stockData.p0_5_data.chain_monitor) {
      const chainState = stockData.p0_5_data.chain_monitor.diagnosis?.current_chain_state;
      if (chainState === ESCALATION_GATE_CONFIG.CHAIN_DYNAMICS_DIVERGENCE) {
        escalationScore += 0.2;
        reasons.push({
          type: "CHAIN_DYNAMICS_DIVERGENCE",
          severity: "MEDIUM",
          message: "產業鏈出現背離訊號"
        });
      }
    }
    
    // 4. P6 頻率趨勢檢查
    if (stockData.p6_frequency_trend === "SURGE") {
      escalationScore += 0.2;
      reasons.push({
        type: "P6_FREQUENCY_SURGE",
        severity: "MEDIUM",
        message: "盤中異常頻率暴增"
      });
    }
    
    // 5. Milestone Check（P2 Milestones 自動對帳）⭐ V8.15 增強
    if (stockData.p2_v8_15_fields && stockData.p2_v8_15_fields.milestones_to_verify_json) {
      const milestones = stockData.p2_v8_15_fields.milestones_to_verify_json;
      if (Array.isArray(milestones) && milestones.length > 0) {
        // ⭐ V8.15：執行完整的 Milestone Check
        const milestoneCheckResult = performMilestoneCheck(
          stockData.ticker,
          milestones,
          stockData.stock_news_index || {}
        );
        
        // 如果有里程碑達成，增加 escalation_score
        if (milestoneCheckResult.matched && milestoneCheckResult.matched.length > 0) {
          escalationScore += 0.2;  // 里程碑達成是重要事件
          reasons.push({
            type: "MILESTONE_MET",
            severity: "MEDIUM",
            message: `有 ${milestoneCheckResult.matched.length} 個里程碑已達成`,
            matched_milestones: milestoneCheckResult.matched.map(m => m.milestone.description || m.milestone.milestone)
          });
        }
        
        // 如果有里程碑錯過，增加 escalation_score
        if (milestoneCheckResult.missed && milestoneCheckResult.missed.length > 0) {
          escalationScore += 0.15;
          reasons.push({
            type: "MILESTONE_MISSED",
            severity: "MEDIUM",
            message: `有 ${milestoneCheckResult.missed.length} 個里程碑已錯過`,
            missed_milestones: milestoneCheckResult.missed.map(m => m.milestone.description || m.milestone.milestone)
          });
        }
        
        // 如果有里程碑接近達成時間，輕微增加 escalation_score
        const nearMilestones = milestoneCheckResult.pending.filter(m => {
          return m.days_until <= 30;  // 30 天內
        });
        if (nearMilestones.length > 0) {
          escalationScore += 0.1;
          reasons.push({
            type: "MILESTONE_NEAR",
            severity: "LOW",
            message: `有 ${nearMilestones.length} 個里程碑接近達成時間`
          });
        }
        
        // 將 Milestone Check 結果附加到 stockData
        stockData.milestone_check_result = milestoneCheckResult;
      }
    }
    
    // 判斷是否觸發 P5-A
    const shouldEscalate = escalationScore >= ESCALATION_GATE_CONFIG.ESCALATION_SCORE_THRESHOLD;
    
    return {
      escalation_score: Math.min(1.0, escalationScore),
      should_escalate: shouldEscalate,
      forced_escalation: null,
      reasons: reasons
    };
    
  } catch (error) {
    Logger.log(`計算 Escalation Score 失敗（${stockData.ticker}）：${error.message}`);
    return {
      escalation_score: 0.0,
      should_escalate: false,
      forced_escalation: null,
      reasons: []
    };
  }
}

/**
 * P5-B（Weekly State Evaluator）
 * 每檔都跑（低成本，Claude Sonnet 4.5）
 * 
 * @param {Array} tickers - 股票列表
 * @param {Object} context - 上下文數據
 * @returns {Object} p5BResults - P5-B 結果
 */
function P5_B_Execute(tickers, context) {
  try {
    Logger.log(`P5-B 執行開始：共 ${tickers.length} 檔股票`);
    
    // ⭐ V8.17 新增：判斷是否使用 Batch API
    const useBatch = shouldUseBatch("P5_B_WEEKLY_STATE_EVALUATOR");
    const executorModel = TASK_TO_EXECUTOR["P5_B_WEEKLY_STATE_EVALUATOR"] || "SONNET";
    const executorConfig = M0_MODEL_CONFIG[executorModel];
    const canUseBatch = useBatch && executorConfig && executorConfig.supportsBatch;
    
    if (canUseBatch) {
      Logger.log(`P5-B：使用 Batch API（Provider: ${executorConfig.adapter === "M0_Adapter_Claude" ? "anthropic" : "openai"}, Model: ${executorConfig.model}）`);
      
      // ⭐ V8.17 新增：使用 Batch API 處理所有股票
      return P5_B_ExecuteWithBatch(tickers, context);
    } else {
      Logger.log(`P5-B：使用同步 API（不適用 Batch 或模型不支援）`);
      
      // ⭐ V8.16 保留：同步 API 處理（作為備用）
      return P5_B_ExecuteWithSyncAPI(tickers, context);
    }
    
  } catch (error) {
    Logger.log(`P5-B 執行失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.17 新增：P5-B 使用 Batch API 執行
 */
function P5_B_ExecuteWithBatch(tickers, context) {
  try {
    Logger.log(`P5-B：開始 Batch API 處理（共 ${tickers.length} 檔股票）`);
    
    // 為每檔股票整合因子數據
    const allStockData = [];
    for (const ticker of tickers) {
      const stockData = integrateStockFactors(ticker, context);
      
      // ⭐ V8.15 新增：生成 Strategy Skeleton
      const strategySkeleton = generateStrategySkeleton(
        ticker,
        stockData.p3_data,
        stockData.p4_data,
        {
          close: stockData.daily_ohlcv?.close || null,
          atr: stockData.daily_technical?.atr || null,
          ohlcv: stockData.daily_ohlcv,
          technical_indicators: stockData.daily_technical
        }
      );
      stockData.strategy_skeleton = strategySkeleton;
      
      // ⭐ V8.15：計算 state_vector（簡化版，由 AI 輸出完整版）
      stockData.state_vector = {
        trend_integrity: calculateTrendIntegrity(stockData),
        momentum_shift: calculateMomentumShift(stockData),
        distribution_risk: calculateDistributionRisk(stockData),
        volatility_regime_change: calculateVolatilityRegimeChange(stockData)
      };
      
      // 計算 escalation_score
      const escalationResult = calculateEscalationScore(stockData);
      stockData.escalation_result = escalationResult;
      
      allStockData.push({ ticker: ticker, stockData: stockData });
    }
    
    // ⭐ V8.15 新增：確保 p6_weekly_summary 正確傳遞到 context
    const contextWithP6 = {
      ...context,
      p6_weekly_summary: context.p6_weekly_summary || context.allSnapshots?.p6_weekly_summary || null,
      p5_b_batch_items: allStockData.map(item => ({ ticker: item.ticker, stockData: item.stockData }))  // ⭐ V8.17 新增：保存 items 供後續處理使用
    };
    
    // 使用通用 Batch 執行函數
    const batchResult = executeBatchJob({
      project_id: "P5_B_WEEKLY_STATE_EVALUATOR",
      frequency: "WEEKLY",
      items: contextWithP6.p5_b_batch_items,
      buildSystemBlocks: (ctx) => buildP5_BSystemBlocks(ctx),
      buildUserPayload: (item, ctx) => buildP5_BUserPayloadForBatch(item.ticker, item.stockData, ctx),
      context: contextWithP6
    });
    
    Logger.log(`P5-B：Batch Job 已提交，batch_id=${batchResult.batch_id}`);
    
    // 返回 Batch Job ID，需要後續調用 processBatchJobResults 處理結果
    return {
      status: "SUBMITTED_BATCH",
      batch_id: batchResult.batch_id,
      provider_batch_id: batchResult.provider_batch_id,
      request_count: batchResult.request_count,
      message: `P5-B Batch Job 已提交（${batchResult.request_count} 個請求），請等待完成後執行 P5_B_ProcessBatchResults() 處理結果`
    };
    
  } catch (error) {
    Logger.log(`P5-B Batch API 處理失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.17 新增：構建 P5-B System Blocks（可 cache 的內容）
 */
function buildP5_BSystemBlocks(context) {
  return [
    {
      type: "text",
      text: `你是 P5-B（Weekly State Evaluator）分析專家。

## 核心職責

1. **狀態評估**：評估股票當前的趨勢完整性、動量變化、分發風險、波動率制度變化
2. **參數調整**：輸出 Parameter Adjustment Vector，調整 Strategy Skeleton 的參數
3. **升級判斷**：計算 escalation_score，決定是否需要升級到 P5-A

## ⚠️ 重要：momentum_shift 判斷規則

**在判斷 momentum_shift 時，Sector ETF Flow 與 Mag7 相對強弱為高優先權因子。**

即使個股與產業鏈未出現明顯惡化，也必須考慮資金撤出造成的系統性壓力。

具體規則：
- 如果 Sector ETF Flow 顯示資金大量流出（weekly_flow_usd < -1e9 且 trend = "OUTFLOW_ACCELERATING"），必須降低 momentum_shift
- 如果 Mag7 相對強弱 vs SP500 < -2% 且 trend = "WEAKENING"，必須降低 momentum_shift
- 即使個股技術面良好，若 Sector Flow 和 Mag7 同時惡化，momentum_shift 不得 > 0.2

## 輸出格式要求

必須以 JSON 格式輸出，包含以下欄位：
- state_vector: { trend_integrity, momentum_shift, distribution_risk, volatility_regime_change }
- parameter_adjustment_vector: { buy_bias, sell_bias, ladder_spacing_adjustment, trailing_stop_tightness, max_position_cap_override }
- escalation_score: 0-1
- reasoning: 分析理由（必須說明 Sector ETF Flow 和 Mag7 對 momentum_shift 的影響）`,
      cache_control: { type: "ephemeral" }  // ⭐ 標記為可 cache
    }
  ];
}

/**
 * ⭐ V8.17 新增：構建 P5-B User Payload（動態內容）
 */
function buildP5_BUserPayloadForBatch(ticker, stockData, context) {
  // ⭐ V8.17 新增：構建 Delta Pack（變動摘要）
  const previousP5BOutput = context.previous_p5_b_results?.[ticker] || null;
  const weeklyDelta = buildDeltaPack(ticker, stockData, previousP5BOutput, context);
  
  // ⭐ V8.0 新增：獲取重大事件歷史經驗（作為最重要考量因素）
  // 優先級排序：當週事件 > 高優先級事件 > 其他事件
  const currentWeekEvents = context.current_week_events || [];
  const highPriorityEvents = context.high_priority_events || [];
  const otherEvents = (context.p5_weekly_calendar?.all_events || []).filter(e => 
    !currentWeekEvents.find(cwe => cwe.event_id === e.event_id) &&
    !highPriorityEvents.find(hpe => hpe.event_id === e.event_id)
  );
  
  // 合併事件（按優先級排序）
  const allEvents = [...currentWeekEvents, ...highPriorityEvents, ...otherEvents];
  
  const eventHistoricalContext = allEvents.map(event => {
    const historicalData = event.historical_performance_json ? JSON.parse(event.historical_performance_json) : null;
    const riskWarnings = event.risk_warnings_json ? JSON.parse(event.risk_warnings_json) : [];
    const trackingSuggestions = event.tracking_recommendations_json ? JSON.parse(event.tracking_recommendations_json) : {};
    
    return {
      event_name: event.event_name,
      event_type: event.event_type,
      date_start: event.date_start,
      days_until_event: event.days_until_event || null,
      alert_level: event.alert_level || "NONE",
      historical_performance: historicalData,
      risk_warnings: riskWarnings,
      tracking_suggestions: trackingSuggestions,
      prior_weight: event.prior_weight || 0.5,
      prior_confidence: event.prior_confidence || 0.5
    };
  });
  
  return `## 股票資訊

Ticker: ${ticker}

## Strategy Skeleton（策略骨架）

${JSON.stringify(stockData.strategy_skeleton, null, 2)}

## 當前狀態向量（基礎計算）

${JSON.stringify(stockData.state_vector, null, 2)}

## Delta Pack（變動摘要）⭐ V8.17 新增

${JSON.stringify(weeklyDelta, null, 2)}

## ⭐ V8.0 新增：重大事件歷史經驗（最重要考量因素）

${JSON.stringify(eventHistoricalContext, null, 2)}

**⚠️ 最高權重規則（必須嚴格遵守）**：

1. **當週事件（7天內）**：
   - **必須列為最高權重，短期內只看這件事情**
   - 必須根據歷史表現和監控數據調整策略參數
   - 如果存在監控數據（monitoring_data），必須優先考慮異常檢測結果
   - 如果歷史經驗顯示強烈市場反應，必須相應調整 parameter_adjustment_vector
   - 如果風險警示存在，必須降低倉位或調整止損

2. **高優先級事件（14天內）**：
   - 必須在 reasoning 中明確說明事件影響
   - 必須納入 parameter_adjustment_vector 的考量
   - 如果存在監控數據，必須納入考量

3. **歷史經驗索引**：
   - 必須優先考慮歷史經驗中的統計規律（上漲機率、平均漲幅等）
   - 如果歷史經驗顯示特定模式，必須在 reasoning 中說明

4. **事前監控數據**：
   - 如果存在 10-14 天前的監控數據（monitoring_data），必須納入考量
   - 異常檢測結果（anomalies）必須影響 parameter_adjustment_vector
   - 關鍵數據變化（key_metrics）必須在 reasoning 中說明

5. **風險警示**：
   - 歷史經驗中的「風險警示」必須納入 parameter_adjustment_vector 的考量
   - 必要時降低倉位或調整止損
   - 如果存在多個風險警示，必須累積影響

**重要**：如果當週有重大事件，該事件的影響必須覆蓋所有其他因素，成為策略調整的主要驅動力。

## 完整股票數據

${JSON.stringify(stockData, null, 2)}

## 上下文數據

${JSON.stringify({
  p0_5_snapshot: context.p0_5_snapshot || null,
  p0_7_snapshot: context.p0_7_snapshot || null,
  p2_snapshot: context.p2_snapshot || null,
  p2_5_snapshot: context.p2_5_snapshot || null,
  p3_snapshot: context.p3_snapshot || null,
  p4_snapshot: context.p4_snapshot || null,
  p6_weekly_summary: context.p6_weekly_summary || null,
  macro_flow_context: context.macro_flow_context || null
}, null, 2)}

## [MISSION_CONSTRAINTS] ⭐ V8.19 實戰模擬三：學習斷鏈修復

**Learning constraints override strategy preferences.**

${(function () {
  const ls = context.learning_state || {};
  const fp = ls.failed_patterns || [];
  const ct = ls.constraints_text || "";
  if (fp.length === 0 && !ct) return "（目前無近期失敗模式或約束；若之後有，將列於下方）";
  var out = "";
  if (fp.length > 0) out += "Recent failures / failed_patterns:\n- " + fp.slice(0, 10).join("\n- ") + "\n\n";
  if (ct) out += "Constraints:\n- " + ct;
  return out.trim();
})()}

## ⭐ 工程師修復：動態學習系統反饋（必須納入決策）⭐ V8.26 C2 修復

**⚠️ 重要：系統會不斷重複犯同樣的錯誤，除非你參考學習反饋**

${(function () {
  const lf = context.learning_feedback || null;
  if (!lf) return "（目前無學習反饋；若之後有，將列於下方）";
  
  var out = "**學習反饋數據**：\n\n";
  out += JSON.stringify(lf, null, 2);
  out += "\n\n**你必須參考以下內容**：\n\n";
  
  if (lf.parameter_bias_adjustment) {
    out += "1. **Parameter_Bias_Adjustment（參數偏差調整建議）**：\n";
    out += JSON.stringify(lf.parameter_bias_adjustment, null, 2);
    out += "\n   - 如果學習系統發現「在某種盤勢下 RSI 失靈」，你必須降低對 RSI 的依賴\n";
    out += "   - 如果學習系統發現「某種策略在特定 Regime 下失敗率高」，你必須調整策略參數\n\n";
  }
  
  if (lf.safety_lock_recommendations) {
    out += "2. **Safety_Lock_Recommendations（安全鎖建議）**：\n";
    out += JSON.stringify(lf.safety_lock_recommendations, null, 2);
    out += "\n   - 如果學習系統標記「某種情境簽章死亡率 > 50%」，你必須提高風險意識\n";
    out += "   - 必須在 \`parameter_adjustment_vector\` 中反映這些警告\n\n";
  }
  
  if (lf.recent_reflections) {
    out += "3. **Recent_Reflections（最近的反思）**：\n";
    out += JSON.stringify(lf.recent_reflections, null, 2);
    out += "\n   - 學習系統的近期反思必須納入你的決策考量\n";
    out += "   - 如果系統發現「上週犯了什麼錯」，你必須避免重複同樣的錯誤\n\n";
  }
  
  if (lf.similar_failure_cases) {
    out += "4. **Similar_Failure_Cases（相似失敗案例）**：\n";
    out += JSON.stringify(lf.similar_failure_cases, null, 2);
    out += "\n   - 如果當前情境與歷史失敗案例相似，你必須調整策略\n";
    out += "   - 必須在 \`reasoning\` 中說明如何避免歷史錯誤\n\n";
  }
  
  return out.trim();
})()}

## 你的任務

基於以上數據，進行狀態評估並輸出 JSON 格式結果。

**特別注意**：
1. **momentum_shift 判斷規則**：在判斷 momentum_shift 時，必須優先考慮 macro_flow_context 中的 sector_etf_flow 和 mag7_relative_strength。即使個股技術面良好，若 Sector Flow 和 Mag7 同時惡化，必須降低 momentum_shift（不得 > 0.2）。
2. **重大事件優先級**：重大事件歷史經驗是短期最大影響力因素，必須優先考慮。如果事件在 7 天內，必須根據歷史表現調整策略參數；如果事件在 14 天內，必須在 reasoning 中明確說明事件影響。
3. **必須在 reasoning 中明確說明**：
   - Sector ETF Flow 和 Mag7 對判斷的影響
   - 重大事件歷史經驗對策略調整的影響
   - 為什麼這樣調整 momentum_shift 和 parameter_adjustment_vector`;
}

/**
 * ⭐ V8.17 新增：處理 P5-B Batch 結果
 */
function P5_B_ProcessBatchResults(batchId, context) {
  try {
    Logger.log(`P5-B：開始處理 Batch 結果：${batchId}`);
    
    // 使用通用 Batch 結果處理函數
    const processResult = (executorOutput, item, ctx) => {
      const ticker = item.ticker;
      const stockData = item.stockData;
      
      // 解析執行者輸出
      let p5BResult = executorOutput;
      if (typeof p5BResult === 'string') {
        try {
          let jsonString = p5BResult.trim();
          if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
          } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          p5BResult = JSON.parse(jsonString);
        } catch (e) {
          Logger.log(`P5-B：解析執行者輸出失敗（${ticker}）：${e.message}`);
          throw e;
        }
      }
      
      // ⭐ V8.16 新增：使用 Validator 驗證 P5-B 輸出
      const previousP5BOutput = ctx.previous_p5_b_results?.[ticker] || null;
      const weeklyDelta = ctx.weekly_delta?.[ticker] || null;
      
      const validationResult = validateP5_BOutput(p5BResult, previousP5BOutput, weeklyDelta);
      
      if (!validationResult.valid) {
        Logger.log(`P5-B：股票 ${ticker} Validator 驗證失敗：${validationResult.errors.join(", ")}`);
        // 回退到程式化邏輯
        const programmaticResult = generateP5_BProgrammaticResult(stockData);
        return {
          ...programmaticResult,
          validation_failed: true,
          validation_errors: validationResult.errors,
          original_ai_output: p5BResult
        };
      }
      
      // 驗證通過
      p5BResult.validation_passed = true;
      p5BResult.validation_details = validationResult.validation_details;
      
      if (validationResult.warnings.length > 0) {
        p5BResult.validation_warnings = validationResult.warnings;
      }
      
      // ⭐ V8.15 新增：應用 Parameter Adjustment Vector 到 Strategy Skeleton
      if (stockData.strategy_skeleton && p5BResult.parameter_adjustment_vector) {
        try {
          const currentPrice = stockData.daily_ohlcv?.close || null;
          const atr = stockData.daily_technical?.atr || null;
          
          if (currentPrice && atr) {
            const finalOrders = applyParameterAdjustmentVector(
              stockData.strategy_skeleton,
              p5BResult.parameter_adjustment_vector,
              currentPrice,
              atr
            );
            p5BResult.final_orders = finalOrders;
          }
        } catch (error) {
          Logger.log(`P5-B：應用 Parameter Adjustment Vector 失敗（${ticker}）：${error.message}`);
        }
      }
      
      return p5BResult;
    };
    
    // 從 Batch Job 中提取 items（需要從 context 或 Batch Job 記錄中獲取）
    // 這裡簡化處理，實際應該從 Batch Job 記錄中獲取原始 items
    const items = context.p5_b_batch_items || [];
    
    const results = processBatchJobResults(batchId, {
      project_id: "P5_B_WEEKLY_STATE_EVALUATOR",
      processResult: processResult,
      items: items,
      context: context
    });
    
    Logger.log(`P5-B：Batch 結果處理完成，成功：${results.succeeded}，失敗：${results.failed}`);
    
    return {
      status: "PROCESSED",
      batch_id: batchId,
      results: results.results,
      errors: results.errors,
      summary: {
        total: results.total_items,
        succeeded: results.succeeded,
        failed: results.failed
      }
    };
    
  } catch (error) {
    Logger.log(`P5-B Batch 結果處理失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.16 保留：P5-B 使用同步 API 執行（作為備用）
 */
function P5_B_ExecuteWithSyncAPI(tickers, context) {
  const BATCH_SIZE = P5_B_CONFIG.BATCH_SIZE;
  const allResults = {};
  
  // 分批處理（同步 API）
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    
    Logger.log(`P5-B：處理批次 ${batchNumber} (${batch.length} 檔)`);
    
    try {
      // 為每檔股票整合因子數據
      const batchStockData = [];
      for (const ticker of batch) {
        const stockData = integrateStockFactors(ticker, context);
        
        // ⭐ V8.15 新增：生成 Strategy Skeleton
        const strategySkeleton = generateStrategySkeleton(
          ticker,
          stockData.p3_data,
          stockData.p4_data,
          {
            close: stockData.daily_ohlcv?.close || null,
            atr: stockData.daily_technical?.atr || null,
            ohlcv: stockData.daily_ohlcv,
            technical_indicators: stockData.daily_technical
          }
        );
        stockData.strategy_skeleton = strategySkeleton;
        
        // ⭐ V8.15：計算 state_vector（簡化版，由 AI 輸出完整版）
        stockData.state_vector = {
          trend_integrity: calculateTrendIntegrity(stockData),
          momentum_shift: calculateMomentumShift(stockData),
          distribution_risk: calculateDistributionRisk(stockData),
          volatility_regime_change: calculateVolatilityRegimeChange(stockData)
        };
        
        // 計算 escalation_score
        const escalationResult = calculateEscalationScore(stockData);
        stockData.escalation_result = escalationResult;
        
        batchStockData.push(stockData);
      }
      
      // ⭐ V8.15 新增：確保 p6_weekly_summary 正確傳遞到 context
      const contextWithP6 = {
        ...context,
        p6_weekly_summary: context.p6_weekly_summary || context.allSnapshots?.p6_weekly_summary || null
      };
      
      // 構建 P5-B Prompt（輕量版）
      const p5BPrompt = buildP5_BPrompt(batchStockData, contextWithP6);
      
      // 提交到 M0 Job Queue
      const jobId = submitP5ToM0JobQueue(
        "P5_B_WEEKLY_STATE_EVALUATOR",
        ["SONNET"],  // 只用 Sonnet（低成本）
        {
          batch_number: batchNumber,
          tickers: batch,
          prompt: p5BPrompt,
          context: context
        }
      );
      
      // 等待結果
      const batchResult = waitForM0JobResult(jobId);
      
      if (batchResult && batchResult.p5_b_results) {
        // 合併結果
        for (const ticker of batch) {
          if (batchResult.p5_b_results[ticker]) {
            const p5BResult = batchResult.p5_b_results[ticker];
            
            // ⭐ V8.16 新增：使用 Validator 驗證 P5-B 輸出（取代 AI 審查者）
            const stockData = batchStockData.find(s => s.ticker === ticker);
            const previousP5BOutput = context.previous_p5_b_results?.[ticker] || null;
            const weeklyDelta = context.weekly_delta?.[ticker] || null;
            
            const validationResult = validateP5_BOutput(p5BResult, previousP5BOutput, weeklyDelta);
            
            if (!validationResult.valid) {
              Logger.log(`P5-B：股票 ${ticker} Validator 驗證失敗：${validationResult.errors.join(", ")}`);
              // 如果驗證失敗，使用程式化邏輯生成結果
              p5BResult.validation_failed = true;
              p5BResult.validation_errors = validationResult.errors;
              p5BResult.validation_warnings = validationResult.warnings;
              
              // 回退到程式化邏輯
              const programmaticResult = generateP5_BProgrammaticResult(stockData);
              allResults[ticker] = {
                ...programmaticResult,
                validation_failed: true,
                validation_errors: validationResult.errors,
                original_ai_output: p5BResult
              };
              continue;
            }
            
            // 如果有警告，記錄但不阻止
            if (validationResult.warnings.length > 0) {
              Logger.log(`P5-B：股票 ${ticker} Validator 警告：${validationResult.warnings.join(", ")}`);
              p5BResult.validation_warnings = validationResult.warnings;
            }
            
            // 驗證通過，標記驗證狀態
            p5BResult.validation_passed = true;
            p5BResult.validation_details = validationResult.validation_details;
            
            // ⭐ V8.15 新增：應用 Parameter Adjustment Vector 到 Strategy Skeleton
            if (stockData.strategy_skeleton && p5BResult.parameter_adjustment_vector) {
              try {
                const currentPrice = stockData.daily_ohlcv?.close || null;
                const atr = stockData.daily_technical?.atr || null;
                
                if (currentPrice && atr) {
                  const finalOrders = applyParameterAdjustmentVector(
                    stockData.strategy_skeleton,
                    p5BResult.parameter_adjustment_vector,
                    currentPrice,
                    atr
                  );
                  p5BResult.final_orders = finalOrders;
                }
              } catch (error) {
                Logger.log(`P5-B：應用 Parameter Adjustment Vector 失敗（${ticker}）：${error.message}`);
              }
            }
            
            allResults[ticker] = p5BResult;
          }
        }
      } else {
        // 如果 AI 分析失敗，使用程式化邏輯
        Logger.log(`P5-B：批次 ${batchNumber} AI 分析失敗，使用程式化邏輯`);
        for (const ticker of batch) {
          const stockData = batchStockData.find(s => s.ticker === ticker);
          allResults[ticker] = generateP5_BProgrammaticResult(stockData);
        }
      }
      
      // 批次間延遲
      if (i + BATCH_SIZE < tickers.length) {
        Utilities.sleep(P5_B_CONFIG.BATCH_DELAY_MS);
      }
      
    } catch (error) {
      Logger.log(`P5-B：批次 ${batchNumber} 處理失敗：${error.message}`);
      for (const ticker of batch) {
        allResults[ticker] = {
          ticker: ticker,
          status: "ERROR",
          error: error.message,
          escalation_result: {
            escalation_score: 0.0,
            should_escalate: false
          }
        };
      }
    }
  }
  
  Logger.log(`P5-B 執行完成：成功 ${Object.keys(allResults).length} 檔`);
  
  return allResults;
}

/**
 * P5-A（Weekly Deep Re-evaluation）
 * 僅升級少數（10-20%，Claude Sonnet 4.5 或 Opus）
 * 
 * @param {Array} escalatedTickers - 需要升級的股票列表
 * @param {Object} context - 上下文數據
 * @param {Object} p5BResults - P5-B 結果
 * @returns {Object} p5AResults - P5-A 結果
 */
function P5_A_Execute(escalatedTickers, context, p5BResults) {
  try {
    Logger.log(`P5-A 執行開始：共 ${escalatedTickers.length} 檔股票（${((escalatedTickers.length / Object.keys(p5BResults).length) * 100).toFixed(1)}%）`);
    
    // ⭐ V8.17 新增：判斷是否使用 Batch API
    const useBatch = shouldUseBatch("P5_A_WEEKLY_DEEP_RE_EVALUATION");
    const executorModel = TASK_TO_EXECUTOR["P5_A_WEEKLY_DEEP_RE_EVALUATION"] || "SONNET";
    const executorConfig = M0_MODEL_CONFIG[executorModel];
    const canUseBatch = useBatch && executorConfig && executorConfig.supportsBatch;
    
    if (canUseBatch) {
      Logger.log(`P5-A：使用 Batch API（Provider: ${executorConfig.adapter === "M0_Adapter_Claude" ? "anthropic" : "openai"}, Model: ${executorConfig.model}）`);
      
      // ⭐ V8.17 新增：使用 Batch API 處理所有股票
      return P5_A_ExecuteWithBatch(escalatedTickers, context, p5BResults);
    } else {
      Logger.log(`P5-A：使用同步 API（不適用 Batch 或模型不支援）`);
      
      // ⭐ V8.16 保留：同步 API 處理（作為備用）
      return P5_A_ExecuteWithSyncAPI(escalatedTickers, context, p5BResults);
    }
    
  } catch (error) {
    Logger.log(`P5-A 執行失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.17 新增：P5-A 使用 Batch API 執行
 */
function P5_A_ExecuteWithBatch(escalatedTickers, context, p5BResults) {
  try {
    Logger.log(`P5-A：開始 Batch API 處理（共 ${escalatedTickers.length} 檔股票）`);
    
    // 為每檔股票整合因子數據（深度版）
    const allStockData = [];
    for (const ticker of escalatedTickers) {
      const stockData = integrateStockFactors(ticker, context);
      const p5BResult = p5BResults[ticker];
      
      // ⭐ V8.15 新增：如果 P5-B 沒有生成 Strategy Skeleton，在這裡生成
      if (!stockData.strategy_skeleton) {
        const strategySkeleton = generateStrategySkeleton(
          ticker,
          stockData.p3_data,
          stockData.p4_data,
          {
            close: stockData.daily_ohlcv?.close || null,
            atr: stockData.daily_technical?.atr || null,
            ohlcv: stockData.daily_ohlcv,
            technical_indicators: stockData.daily_technical
          }
        );
        stockData.strategy_skeleton = strategySkeleton;
      }
      
      // 合併 P5-B 結果
      stockData.p5_b_result = p5BResult;
      stockData.escalation_reason = p5BResult.escalation_result?.reasons || [];
      
      allStockData.push({ ticker: ticker, stockData: stockData, p5BResult: p5BResult });
    }
    
    // ⭐ V8.17 更新：P5-A Batch 版本一律使用 Opus（因為已經只處理 20%+ Batch，沒必要妥協用便宜的模型）
    const executorModel = "OPUS";
    
    Logger.log(`P5-A：使用模型 ${executorModel}（Batch 版本一律使用 Opus，確保深度分析品質）`);
    
    // ⭐ V8.15 新增：確保 p6_weekly_summary 正確傳遞到 context
    const contextWithP6 = {
      ...context,
      p6_weekly_summary: context.p6_weekly_summary || context.allSnapshots?.p6_weekly_summary || null,
      p5_b_results: p5BResults,
      p5_a_batch_items: allStockData.map(item => ({ ticker: item.ticker, stockData: item.stockData, p5BResult: item.p5BResult }))  // ⭐ V8.17 新增：保存 items 供後續處理使用
    };
    
    // ⭐ V8.17 修正：P5-A 需要根據 escalation_score 動態選擇模型，不能直接使用 executeBatchJob
    // 因為 executeBatchJob 會從 TASK_TO_EXECUTOR 讀取配置，無法動態選擇
    // 所以需要自己實現 Batch 邏輯
    
    // 確定 Provider 和 Model Config
    const executorConfig = M0_MODEL_CONFIG[executorModel];
    if (!executorConfig || !executorConfig.supportsBatch) {
      throw new Error(`P5-A 使用的模型 ${executorModel} 不支援 Batch API`);
    }
    
    const provider = executorConfig.adapter === "M0_Adapter_Claude" ? "anthropic" : "openai";
    
    // 構建靜態 System Blocks（可 cache 的內容）
    const staticSystemBlocks = buildP5_ASystemBlocks(contextWithP6);
    
    // 收集所有股票的 Batch Requests
    const batchRequests = [];
    
    for (const item of allStockData) {
      // 構建單一股票的 User Payload
      const userPayload = buildP5_AUserPayloadForBatch(item.ticker, item.stockData, item.p5BResult, contextWithP6);
      
      // 構建 User Message（動態內容）
      const userMessage = typeof userPayload === 'string' ? userPayload : JSON.stringify(userPayload, null, 2);
      
      // 創建 Batch Request
      const batchRequest = createBatchRequest({
        custom_id: `P5_A_${item.ticker}_WEEKLY_${Date.now()}`,
        system_blocks: staticSystemBlocks,  // ⭐ 可 cache 的靜態內容
        user_payload: userMessage,  // 動態內容（轉為字串）
        max_output_tokens: executorConfig.maxOutputTokens || 8000
      });
      
      batchRequests.push(batchRequest);
    }
    
    Logger.log(`P5-A：已收集 ${batchRequests.length} 個 Batch Requests（模型：${executorModel}）`);
    
    // 創建內部 Batch Job
    const batchJobId = `P5_A_WEEKLY_${Date.now()}`;
    const internalBatchJob = createInternalBatchJob({
      job_id: batchJobId,
      provider: provider,
      model: executorConfig.model,
      requests: batchRequests,
      postprocess: {
        schema_validate: true,
        rule_validate: true
      }
    });
    
    // 提交 Batch Job
    Logger.log(`P5-A：提交 Batch Job 到 ${provider}（${batchRequests.length} 個請求，模型：${executorConfig.model}）`);
    const submitResult = submitBatchJob(internalBatchJob);
    
    Logger.log(`P5-A：Batch Job 已提交，batch_id=${submitResult.batch_id}, provider_batch_id=${submitResult.provider_batch_id}`);
    
    // 返回 Batch Job ID，需要後續調用 processBatchJobResults 處理結果
    return {
      status: "SUBMITTED_BATCH",
      batch_id: submitResult.batch_id,
      provider_batch_id: submitResult.provider_batch_id,
      request_count: batchRequests.length,
      model: executorModel,
      message: `P5-A Batch Job 已提交（${batchRequests.length} 個請求，模型：${executorModel}），請等待完成後執行 P5_A_ProcessBatchResults() 處理結果`
    };
    
  } catch (error) {
    Logger.log(`P5-A Batch API 處理失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.17 新增：構建 P5-A System Blocks（可 cache 的內容）
 */
function buildP5_ASystemBlocks(context) {
  return [
    {
      type: "text",
      text: `你是 P5-A（Weekly Deep Re-evaluation）分析專家。

## 核心職責

1. **深度重評估**：對升級的股票進行深度分析，局部重跑 P3（主力意圖），必要時影響 P4（風險權重）
2. **策略重寫**：在必要時重寫策略母版，而非僅調參
3. **參數調整**：輸出 Parameter Adjustment Vector，調整 Strategy Skeleton 的參數

## 輸出格式要求

必須以 JSON 格式輸出，包含以下欄位：
- state_vector: { trend_integrity, momentum_shift, distribution_risk, volatility_regime_change }
- parameter_adjustment_vector: { buy_bias, sell_bias, ladder_spacing_adjustment, trailing_stop_tightness, max_position_cap_override }
- escalation_score: 0-1
- reasoning: 深度分析理由
- auditor_review: 審查者評論（如果有）`,
      cache_control: { type: "ephemeral" }  // ⭐ 標記為可 cache
    }
  ];
}

/**
 * ⭐ V8.17 新增：構建 P5-A User Payload（動態內容）
 */
function buildP5_AUserPayloadForBatch(ticker, stockData, p5BResult, context) {
  // ⭐ V8.17 新增：構建 Delta Pack（變動摘要）
  const previousP5AOutput = context.previous_p5_a_results?.[ticker] || null;
  const weeklyDelta = buildDeltaPack(ticker, stockData, previousP5AOutput, context);
  
  return `## 股票資訊

Ticker: ${ticker}

## P5-B 結果（升級原因）

${JSON.stringify(p5BResult, null, 2)}

## Strategy Skeleton（策略骨架）

${JSON.stringify(stockData.strategy_skeleton, null, 2)}

## 當前狀態向量（基礎計算）

${JSON.stringify(stockData.state_vector, null, 2)}

## Delta Pack（變動摘要）⭐ V8.17 新增

${JSON.stringify(weeklyDelta, null, 2)}

## 完整股票數據（深度版）

${JSON.stringify(stockData, null, 2)}

## 上下文數據

${JSON.stringify({
  p0_5_snapshot: context.p0_5_snapshot || null,
  p0_7_snapshot: context.p0_7_snapshot || null,
  p2_snapshot: context.p2_snapshot || null,
  p2_5_snapshot: context.p2_5_snapshot || null,
  p3_snapshot: context.p3_snapshot || null,
  p4_snapshot: context.p4_snapshot || null,
  p6_weekly_summary: context.p6_weekly_summary || null,
  macro_flow_context: context.macro_flow_context || null
}, null, 2)}

## [MISSION_CONSTRAINTS] ⭐ V8.19 實戰模擬三：學習斷鏈修復

**Learning constraints override strategy preferences.**

${(function () {
  const ls = context.learning_state || {};
  const fp = ls.failed_patterns || [];
  const ct = ls.constraints_text || "";
  if (fp.length === 0 && !ct) return "（目前無近期失敗模式或約束）";
  var out = "";
  if (fp.length > 0) out += "Recent failures:\n- " + fp.slice(0, 10).join("\n- ") + "\n\n";
  if (ct) out += "Constraints:\n- " + ct;
  return out.trim();
})()}

## 你的任務

基於以上數據，進行深度重評估並輸出 JSON 格式結果。`;
}

/**
 * ⭐ V8.17 新增：處理 P5-A Batch 結果
 */
function P5_A_ProcessBatchResults(batchId, context, p5BResults) {
  try {
    Logger.log(`P5-A：開始處理 Batch 結果：${batchId}`);
    
    // 使用通用 Batch 結果處理函數
    const processResult = (executorOutput, item, ctx) => {
      const ticker = item.ticker;
      const stockData = item.stockData;
      const p5BResult = item.p5BResult;
      
      // 解析執行者輸出
      let p5AResult = executorOutput;
      if (typeof p5AResult === 'string') {
        try {
          let jsonString = p5AResult.trim();
          if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
          } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          p5AResult = JSON.parse(jsonString);
        } catch (e) {
          Logger.log(`P5-A：解析執行者輸出失敗（${ticker}）：${e.message}`);
          // 回退到 P5-B 結果
          return p5BResult;
        }
      }
      
      // ⭐ V8.15 新增：應用 Parameter Adjustment Vector 到 Strategy Skeleton
      if (stockData.strategy_skeleton && p5AResult.parameter_adjustment_vector) {
        try {
          const currentPrice = stockData.daily_ohlcv?.close || null;
          const atr = stockData.daily_technical?.atr || null;
          
          if (currentPrice && atr) {
            const finalOrders = applyParameterAdjustmentVector(
              stockData.strategy_skeleton,
              p5AResult.parameter_adjustment_vector,
              currentPrice,
              atr
            );
            p5AResult.final_orders = finalOrders;
          }
        } catch (error) {
          Logger.log(`P5-A：應用 Parameter Adjustment Vector 失敗（${ticker}）：${error.message}`);
        }
      }
      
      return p5AResult;
    };
    
    // 從 Batch Job 中提取 items（需要從 context 或 Batch Job 記錄中獲取）
    const items = context.p5_a_batch_items || [];
    
    const results = processBatchJobResults(batchId, {
      project_id: "P5_A_WEEKLY_DEEP_RE_EVALUATION",
      processResult: processResult,
      items: items,
      context: context
    });
    
    Logger.log(`P5-A：Batch 結果處理完成，成功：${results.succeeded}，失敗：${results.failed}`);
    
    return {
      status: "PROCESSED",
      batch_id: batchId,
      results: results.results,
      errors: results.errors,
      summary: {
        total: results.total_items,
        succeeded: results.succeeded,
        failed: results.failed
      }
    };
    
  } catch (error) {
    Logger.log(`P5-A Batch 結果處理失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.16 保留：P5-A 使用同步 API 執行（作為備用）
 */
function P5_A_ExecuteWithSyncAPI(escalatedTickers, context, p5BResults) {
  const BATCH_SIZE = P5_A_CONFIG.BATCH_SIZE;
  const allResults = {};
  
  // 分批處理（同步 API）
  for (let i = 0; i < escalatedTickers.length; i += BATCH_SIZE) {
    const batch = escalatedTickers.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    
    Logger.log(`P5-A：處理批次 ${batchNumber} (${batch.length} 檔)`);
    
    try {
      // 為每檔股票整合因子數據（深度版）
      const batchStockData = [];
      for (const ticker of batch) {
        const stockData = integrateStockFactors(ticker, context);
        const p5BResult = p5BResults[ticker];
        
        // ⭐ V8.15 新增：如果 P5-B 沒有生成 Strategy Skeleton，在這裡生成
        if (!stockData.strategy_skeleton) {
          const strategySkeleton = generateStrategySkeleton(
            ticker,
            stockData.p3_data,
            stockData.p4_data,
            {
              close: stockData.daily_ohlcv?.close || null,
              atr: stockData.daily_technical?.atr || null,
              ohlcv: stockData.daily_ohlcv,
              technical_indicators: stockData.daily_technical
            }
          );
          stockData.strategy_skeleton = strategySkeleton;
        }
        
        // 合併 P5-B 結果
        stockData.p5_b_result = p5BResult;
        stockData.escalation_reason = p5BResult.escalation_result?.reasons || [];
        
        batchStockData.push(stockData);
      }
      
      // 決定使用哪個模型（基於 escalation_score）
      // ⭐ V8.17 更新：同步版本也一律使用 Opus（確保深度分析品質）
      const model = "OPUS";
      
      Logger.log(`P5-A：批次 ${batchNumber} 使用模型 ${model}（一律使用 Opus，確保深度分析品質）`);
      
      // ⭐ V8.15 新增：確保 p6_weekly_summary 正確傳遞到 context
      const contextWithP6 = {
        ...context,
        p6_weekly_summary: context.p6_weekly_summary || context.allSnapshots?.p6_weekly_summary || null
      };
      
      // 構建 P5-A Prompt（深度版）
      const p5APrompt = buildP5_APrompt(batchStockData, contextWithP6);
      
      // 提交到 M0 Job Queue
      const requestedFlow = ["OPUS", "GPT"];
      const jobId = submitP5ToM0JobQueue(
        "P5_A_WEEKLY_DEEP_RE_EVALUATION",
        requestedFlow,
        {
          batch_number: batchNumber,
          tickers: batch,
          prompt: p5APrompt,
          context: context,
          p5_b_results: p5BResults
        }
      );
      
      // 等待結果
      const batchResult = waitForM0JobResult(jobId);
      
      if (batchResult && batchResult.p5_a_results) {
        // 合併結果
        for (const ticker of batch) {
          if (batchResult.p5_a_results[ticker]) {
            const p5AResult = batchResult.p5_a_results[ticker];
            
            // ⭐ V8.15 新增：應用 Parameter Adjustment Vector 到 Strategy Skeleton
            const stockData = batchStockData.find(s => s.ticker === ticker);
            if (stockData.strategy_skeleton && p5AResult.parameter_adjustment_vector) {
              try {
                const currentPrice = stockData.daily_ohlcv?.close || null;
                const atr = stockData.daily_technical?.atr || null;
                
                if (currentPrice && atr) {
                  const finalOrders = applyParameterAdjustmentVector(
                    stockData.strategy_skeleton,
                    p5AResult.parameter_adjustment_vector,
                    currentPrice,
                    atr
                  );
                  p5AResult.final_orders = finalOrders;
                }
              } catch (error) {
                Logger.log(`P5-A：應用 Parameter Adjustment Vector 失敗（${ticker}）：${error.message}`);
              }
            }
            
            allResults[ticker] = p5AResult;
          }
        }
      } else {
        // 如果 AI 分析失敗，回退到 P5-B 結果
        Logger.log(`P5-A：批次 ${batchNumber} AI 分析失敗，回退到 P5-B 結果`);
        for (const ticker of batch) {
          allResults[ticker] = p5BResults[ticker];
        }
      }
      
      // 批次間延遲
      if (i + BATCH_SIZE < escalatedTickers.length) {
        Utilities.sleep(P5_A_CONFIG.BATCH_DELAY_MS);
      }
      
    } catch (error) {
      Logger.log(`P5-A：批次 ${batchNumber} 處理失敗：${error.message}`);
      for (const ticker of batch) {
        // 回退到 P5-B 結果
        allResults[ticker] = p5BResults[ticker];
      }
    }
  }
  
  Logger.log(`P5-A 執行完成：成功 ${Object.keys(allResults).length} 檔`);
  
  return allResults;
}

/**
 * 構建 P5-B Prompt（輕量版）
 * 
 * @param {Array} batchStockData - 批次股票數據
 * @param {Object} context - 上下文數據
 * @returns {string} prompt - AI Prompt
 */
function buildP5_BPrompt(batchStockData, context) {
  // ⭐ V8.15 新增：提取 P0.5 的 p5_weekly_flags（系統級旗標）
  const systemFlags = {};
  for (const stockData of batchStockData) {
    const flags = stockData.p0_5_data?.p5_weekly_flags || [];
    if (flags.length > 0) {
      systemFlags[stockData.ticker] = flags;
    }
  }
  
  // ⭐ V8.15 新增：提取 P6 頻率趨勢（基準線描述）
  const p6Summary = context.p6_weekly_summary || {};
  const p6FrequencyDescription = p6Summary.alert_count !== undefined && p6Summary.avg_4w !== undefined
    ? `P6 Alert Frequency: ${p6Summary.alert_count} (vs 4-Week Avg: ${p6Summary.avg_4w.toFixed(1)}). Trend: ${p6Summary.frequency_trend || "NORMAL"}`
    : "P6 Alert Frequency: Data not available";
  
  return `
## ⚠️ CRITICAL RULE: 越獄防護指令

**CRITICAL RULE: You are a PARAMETER ADJUSTER, NOT a Price Setter. You MUST output a parameter_adjustment_vector JSON. Any attempt to output absolute price levels (e.g. 'Buy at 150') will cause a SYSTEM FAILURE.**

---

你是一位資深的股票策略分析師，負責為 Nuclear Project 的 P5 Weekly 進行**輕量級狀態評估**（P5-B）。

## 任務目標

為以下 ${batchStockData.length} 檔股票進行狀態評估，輸出 state_vector、parameter_adjustment_vector 和 escalation_score：
${batchStockData.map(s => s.ticker).join(", ")}

## ⚠️ 重要：Strategy Skeleton 與 Parameter Adjustment Vector

**你必須遵守以下規則：**

1. **Strategy Skeleton（策略骨架）**：由程式生成，你**不得修改結構**，只能通過 \`parameter_adjustment_vector\` 調整參數
2. **Parameter Adjustment Vector（參數調整向量）**：你**只輸出參數調整**，不輸出實際價位
3. **實際掛單價格**：由程式根據 Strategy Skeleton 和你的參數調整計算得出

## ⭐ SYSTEM_FLAGS（系統級旗標 - 來自 P0.5 產業鏈監控）

**這些旗標直接影響你的決策，必須在 state_vector 和 parameter_adjustment_vector 中反映：**

${Object.keys(systemFlags).length > 0 
  ? Object.entries(systemFlags).map(([ticker, flags]) => 
      `- **${ticker}**: ${flags.length > 0 ? flags.map(f => `\`${f}\``).join(", ") : "無旗標"}`
    ).join("\n")
  : "- 無系統級旗標（所有股票正常）"}

**旗標說明：**
- \`DIVERGENCE_ALERT\`: 產業鏈出現背離訊號 → 必須降低 \`momentum_shift\` 和 \`trend_integrity\`
- \`INVENTORY_BUILD_WARNING\`: 庫存累積警告 → 必須提高 \`distribution_risk\`
- \`LATE_CYCLE_RISK\`: 週期晚期風險 → 必須提高 \`sell_bias\` 和 \`trailing_stop_tightness\`
- \`UPSTREAM_WEAKNESS\`: 上游轉弱 → 必須降低 \`buy_bias\`
- \`DEMAND_SLOWDOWN\`: 需求放緩 → 必須提高 \`distribution_risk\`

## ⭐ P6 盤中監測頻率趨勢（基準線）

**${p6FrequencyDescription}**

**趨勢說明：**
- \`SURGE\`: 頻率暴增（> 2x 平均）→ 必須提高 \`volatility_regime_change\` 和降低 \`trend_integrity\`
- \`ELEVATED\`: 頻率升高（> 1.5x 平均）→ 必須提高 \`volatility_regime_change\`
- \`NORMAL\`: 頻率正常 → 維持正常評估
- \`DECREASED\`: 頻率降低（< 0.5x 平均）→ 可降低 \`volatility_regime_change\`

**Strategy Skeleton（已由程式生成）：**
${JSON.stringify(batchStockData.map(s => ({
  ticker: s.ticker,
  strategy_skeleton: s.strategy_skeleton?.strategy_skeleton || null
})), null, 2)}

## ⭐ V8.26 C1 修復：因子權重決定指引

**⚠️ 重要：權重決定必須基於邏輯推理，不是隨意猜測**

**基準權重**（作為起點，不是強制規則）：
- **Fundamental（基本面）**：30%
- **Chips（籌碼面）**：25%
- **Tech（技術面）**：25%
- **Macro（宏觀面）**：10%
- **Sentiment（情緒面）**：10%

**允許偏差範圍**：±15%（例如：fundamental 可以在 15%-45% 範圍內）

**調整原則**（建議，不是命令）：
1. **系統級風險訊號（P0.7, P0.5）優先於個股訊號** → 提高 macro 權重
2. **籌碼面與基本面衝突時，優先相信籌碼** → 提高 chips 權重
3. **技術面與基本面衝突時，短期看技術，長期看基本面** → 根據持有期調整
4. **財報季（未來 14 天有財報）** → 提高 chips 權重（機構提前佈局）
5. **突破型態（Cat2/Cat3 + volume_surge）** → 提高 tech 權重
6. **高波動環境（VIX > 25）** → 提高 macro 權重，降低 tech/sentiment 權重
7. **P2 Milestone 驗證期** → 提高 fundamental 權重

**輸出要求**：
- 你必須在 \`reasoning\` 中明確說明權重決定的理由
- 如果權重偏離基準超過 ±20%，必須提供明確的反向證據
- 你的權重決定應該是基於邏輯推理，不是隨意猜測
- 如果某個因子權重為 0%，必須說明為什麼完全忽略該因子

**注意**：本 Prompt 不要求你輸出權重配置（權重由程式根據你的 \`parameter_adjustment_vector\` 和 \`state_vector\` 計算），但你的決策邏輯應該遵循上述原則。

## ⭐ V8.27 新增：根據 P0 必然性等級動態調整因子權重基準

**當前股票 P0 必然性等級**: ${batchStockData.map(s => `${s.ticker}: ${s.p0_conviction_level || "未知"}`).join(", ")}

**建議因子權重**（可調整 ±10%）：

**如果 P0 必然性 = ULTRA_HIGH 且 Position_Role = MOMENTUM_COMPOUNDER**：
  - P0 產業必然性: 40%
  - P2 基本面: 30%
  - P2.5 籌碼面: 20%
  - P3 技術面: 10%
  
  **關鍵原則**：
  - ⭐ P0 長期必然性優先於 P3 短期技術面
  - ⭐ 技術面破位（Cat4-B/Cat5）不應該觸發清倉
  - ⭐ 只有 P0 必然性降級或 P2 基本面惡化才應該減倉

**如果 P0 必然性 = MEDIUM 或 Position_Role = FRONTIER_OPTIONALITY**：
  - P0 產業必然性: 15%
  - P2 基本面: 25%
  - P2.5 籌碼面: 30%
  - P3 技術面: 30%
  
  **關鍵原則**：
  - ⭐ P3 短期技術面優先（靈活調整）
  - ⭐ 技術面破位應該觸發減倉或清倉

**重要**：
- 這些權重是「基準」，不是強制規則
- 你可以根據具體情況調整（±10%）
- 但必須在 reasoning 中明確說明調整理由

## ⭐ V8.27 新增：P2 安全閘門（硬約束，覆蓋所有權重）

**⚠️ 重要：以下是硬約束，不可討論**

如果 P2 月度更新發現以下任一情況：
1. Safety Score 降級到 C 或以下
2. CFO（經營現金流）轉負
3. 財報造假或重大訴訟
4. Gate 檢查失敗（營收/毛利率/現金流低於閾值）

→ **必須立即清倉或大幅減倉（降到 OPPORTUNISTIC 上限 3%）**
→ **不論 P0 必然性多強**
→ **這是安全閘門，覆蓋所有其他因素**

**理由**：
- P2 基本面惡化是致命信號
- 公司可能面臨破產或重大危機
- 不能因為「P0 必然性強」就忽視基本面惡化

## ⭐ V8.27 新增：反覆矛盾新聞的深度思考指引

**⚠️ 重要：不要直接忽略反覆矛盾的新聞，而是要深度思考為什麼會這樣**

你收到的新聞數據中，已經由 Daily 的 Gemini Pro 3.0 標記了 \`event_stability\`。

**處理原則**：

1. **如果 \`event_stability = "REVERSAL_NOISE"\`**：
   - ❌ **不要直接忽略**：這不是讓你忽略的理由
   - ✅ **深度思考**：
     * 為什麼會反覆矛盾？是媒體配合主力炒作？還是政策尚未穩定？
     * 如果 P0 必然性依然 ULTRA_HIGH（例如：AI 晶片長期需求依然強勁），短期政策反覆不應影響長期投資決策
     * 如果 P2 基本面健康，短期噪音不應觸發清倉
   - ✅ **在 reasoning 中明確說明**：
     * 你看到了反覆矛盾的新聞（例如：H200 出貨政策反覆）
     * 但你基於 P0 必然性（AI 晶片需求依然強勁）和 P2 基本面健康，維持積極策略
     * 你判斷這是「短期政策反覆」而非「長期結構性變化」

2. **如果 \`event_stability = "STABLE_EVENT"\`**：
   - ✅ 正常處理，納入決策考量

3. **如果 \`event_stability = "EVOLVING"\`**：
   - ✅ 持續觀察，但可以納入決策考量

**關鍵原則**：
- ⭐ Daily 的標記是「提示」，不是「命令」
- ⭐ 你的任務是「深度思考」，不是「直接忽略」
- ⭐ 基於 P0 必然性和 P2 基本面制定策略，而非被短期噪音影響

## ⭐ V8.27 新增：逆向投資信號檢測

**定義**：市場恐慌時的「黃金買點」

**觸發條件**（必須全部成立）：
1. P0 必然性 = ULTRA_HIGH 或 HIGH（長期邏輯依然成立）
2. P2 基本面健康（Safety >= B，無財報造假/重大訴訟）
3. P3 技術面破位（Cat4-B 或 Cat5，市場恐慌性拋售）
4. P2.5 機構開始建倉（Smart Money Score 上升 或 機構持倉流入）
5. 市場情緒極度悲觀（VIX > 30 或 Fear & Greed Index < 20）

**如果檢測到逆向投資信號**：

你應該調整 parameter_adjustment_vector：

1. **buy_aggressiveness（買入激進度）**：
   - 正常情況：0.5（中性）
   - 逆向投資：0.8-0.9（高度激進）
   - 含義：掛單價格「更接近市價」，避免踏空

2. **buy_bias（買入偏移）**：
   - 正常情況：-0.10（價格下調 1%，等待回調）
   - 逆向投資：+0.15（價格上調 1.5%，更積極買入）
   - 含義：不等待深跌，在恐慌中買入

3. **max_position_cap_override（倉位上限覆蓋）**：
   - 如果 Position_Role = MOMENTUM_COMPOUNDER 且 P0 = ULTRA_HIGH
   - 考慮提高倉位上限（從 20% → 25%）
   - 理由：恐慌時的黃金買點，應該加大倉位

**範例（NVDA 2022-10 @ 110）**：

檢測結果：
  → P0 必然性：ULTRA_HIGH（AI 晶片需求依然強勁）✅
  → P2 基本面：Safety = A（財務健康）✅
  → P3 技術面：Cat5（恐慌性破位）✅
  → P2.5 機構：Smart Money Score 上升（機構建倉）✅
  → 市場情緒：VIX = 35（極度恐慌）✅
  → 觸發「逆向投資信號」！

parameter_adjustment_vector（你應該輸出）：
  {
    "buy_aggressiveness": 0.85,  // 高度激進
    "buy_bias": "+0.15",  // 價格上調 1.5%
    "sell_bias": "-0.20",  // 賣出更保守（不急著賣）
    "max_position_cap_override": 0.25,  // 提高倉位上限
    "reasoning": "檢測到逆向投資信號（P0 強勁 + 市場恐慌 + 機構建倉），應在恐慌中積極買入"
  }

## 股票數據

${JSON.stringify(batchStockData.map(s => {
  // 移除 strategy_skeleton 的詳細結構，只保留引用（避免 Prompt 過長）
  const { strategy_skeleton, ...rest } = s;
  return {
    ...rest,
    strategy_skeleton_ref: strategy_skeleton ? "已生成（見上方）" : null
  };
}), null, 2)}

## ✅ Weekly Output Upgrade: Broker-Executable Order Plan (IBKR-ready) ⭐ V8.17.3 新增

**⚠️ 重要：你必須為每檔股票輸出 \`order_plan\` 陣列，這是可直接給券商執行的掛單策略代碼，不是建議價格。**

### Order Plan 輸出要求

你必須輸出一個 \`order_plan\` 陣列，包含所有掛單指令。這些指令必須是 IBKR（Interactive Brokers）支援的進階掛單類型，可以直接批次下單。

### 1) 每個訂單的必填欄位

- **order_id**: 唯一訂單 ID（例如："BUY_BREAKOUT_AAPL_001"）
- **side**: BUY 或 SELL
- **order_type**: LIMIT | STOP_LIMIT | STOP | TRAIL | MARKET（避免 MARKET，除非緊急情況）
- **qty_percent**: 目標倉位的百分比（必須遵守 CORE >= 50% 規則）
- **trigger** (可選): 觸發價格（例如：STOP_LIMIT 的 stop_price）
- **limit_price** (可選): 限價（LIMIT 或 STOP_LIMIT 需要）
- **time_in_force**: DAY | GTC | GTD（週度系統預設 GTC）
- **oco_group_id** (可選): OCO 群組 ID（同一群組的訂單會互相取消）
- **attached_orders** (可選): BRACKET 附帶訂單，格式為 {take_profit, stop_loss} 或 trailing_stop

### 2) 訂單類型選擇規則（不要寫死，根據結構選擇）

**STOP_LIMIT（突破買進）**：
- ✅ **適用於**：Cat2/Cat3（啟動期/主升段）且 risk_overlay_level 不是 HIGH
- ✅ **或**：本週有明確催化劑 + 明確壓力位 + risk_overlay_level 不是 HIGH
- ⚠️ **謹慎使用**：如果 P0.7 是 Late 或 turning_point_risk 是 HIGH
  - 預設不使用，除非有強力催化劑（例如：FDA 批准、併購公告、超預期財報、重大政策轉向）
  - 如果使用，必須在 \`reasoning\` 中明確說明例外理由
  - 如果使用，必須降低倉位（max_position_cap 減半）
  - 如果使用，必須標記 \`hard_constraint_exception = true\`
- ⚠️ **謹慎使用**：如果 p5_weekly_flags 包含 DIVERGENCE_ALERT 或 LATE_CYCLE_RISK
  - 預設不使用，除非有明確反向證據
  - 如果使用，必須在 \`reasoning\` 中明確說明例外理由

**LIMIT（拉回買進）**：
- ✅ **通用、最安全**：適用於 Cat3 回踩、Cat4-A、Cat4-B、不確定 Regime
- ✅ **多數股票都應該以這個為主**（尤其 100 檔批次）

**BRACKET（區間操作）**：
- ✅ **適用於**：波段倉、噴出倉
- ✅ **對「不盯盤」很重要**：買進後自動停損停利
- ⚠️ **核心倉限制**：核心倉（至少 50%）通常不要 bracket 的 take-profit（避免太早賣光）
- ✅ **可以附帶**：stop_loss（必須）和 take_profit（可選，但核心倉不建議）

**OCO（互斥訂單）**：
- ⚠️ **關鍵要求**：如果同時提供 Breakout Buy（STOP_LIMIT）與 Pullback Buy（LIMIT），**必須用 OCO 綁定**，避免兩邊都成交造成超倉
- ✅ **使用場景**：Breakout 和 Pullback 策略互斥時

### 3) 訂單保鮮期管理（Order Freshness / GTD）⭐ V8.18 新增

**⚠️ 重要：不是所有掛單都能 GTC，只有「等待型」可以。動能型訂單必須設定有效期，避免「過期牛奶」問題。**

**核心原則**：
- 技術分析不是只有價格，**時間就是動能的另一個維度**
- 一個「磨了 4 天才突破」的突破，**和當天突破完全不是同一件事**
- 過期的掛單就像過期的牛奶，喝了會拉肚子

**Time in Force 規則（根據 Setup 類型）**：

| Setup 類型                  | Order Type            | Time in Force                     | 理由                                 |
| ------------------------- | --------------------- | --------------------------------- | ------------------------------------ |
| Momentum / Breakout       | Buy Stop / Stop Limit | **DAY 或 GTD = +1~2 trading days** | 動能單必須快速，如果週二收盤前沒攻過去，這筆單自動作廢。我們不想要「拖泥帶水」的突破。 |
| Pullback / Mean Reversion | Buy Limit             | **GTC 或 本週五**                     | 接刀可以等，但追價不能等。拉回買進是等待型策略，可以設定較長有效期。 |
| Re-entry / Trap Play      | Buy Stop / Limit      | **DAY**                           | 重新入場單必須快速，避免錯過最佳時機。 |

**具體規則**：

1. **Momentum / Breakout 訂單（STOP_LIMIT）**：
   - ✅ **必須設定**：\`time_in_force = "DAY"\` 或 \`time_in_force = "GTD"\`（到期日 = 本週二或週三收盤）
   - ✅ **理由**：如果週二收盤前沒攻過去，這筆單自動作廢。我們不想要「拖泥帶水」的突破。
   - ❌ **禁止使用 GTC**：動能型訂單不能無限期掛單

2. **Pullback / Mean Reversion 訂單（LIMIT）**：
   - ✅ **可以設定**：\`time_in_force = "GTC"\` 或 \`time_in_force = "GTD"\`（到期日 = 本週五）
   - ✅ **理由**：接刀可以等，但追價不能等。拉回買進是等待型策略，可以設定較長有效期。
   - ⚠️ **建議**：如果本週五前沒觸發，可以考慮下週重新評估

3. **Re-entry / Trap Play 訂單**：
   - ✅ **必須設定**：\`time_in_force = "DAY"\`
   - ✅ **理由**：重新入場單必須快速，避免錯過最佳時機。

**輸出要求**：
- 在 \`order_plan\` 的每個訂單中，必須明確設定 \`time_in_force\`
- 必須在 \`strategy_script\` 中說明為什麼選擇這個有效期：
  - 例如：「Buy Stop Limit @ 110，有效期至本週二收盤（動能單，不拖泥帶水）」
  - 例如：「Buy Limit @ 100，有效期 GTC（拉回買進，可以等待）」

### 4) 財報前強制清倉（Earnings Ejection）⭐ V8.18 新增

**⚠️ 硬規則：週度波段 + 不處理財報風險 = 在賭命**

**核心原則**：
- 財報是賭博。再好的技術面，財報一句話就能跌 20%
- 如果持倉剛好在本週公佈財報，而我們採取「射後不理」的掛單模式，這是在賭運氣
- 不要讓辛苦賺來的波段利潤，毀在一次財報上

**強烈建議規則（除非有明確反向證據，否則應遵守）**：
- ✅ **檢查未來 7 天內是否有財報公佈**（從 EARNINGS_CALENDAR 或 HOLDINGS_EARNINGS_CALENDAR 讀取）
- ✅ **如果有財報在未來 7 天內**：
  - ⚠️ **強烈建議不開新倉**（除非是賭財報的特殊策略，但通常不建議）
  - ✅ **現有持倉強烈建議減倉**：減倉 50% 或設寬鬆停損（根據 Cat 類型決定）
  - ✅ **防禦策略選項**：
    * **選項 1**：減倉 50%，鎖住獲利
    * **選項 2**：設寬鬆停損（例如：從 -5% 放寬到 -8% 或 -10%）
    * **選項 3**：完全清倉（若已有獲利且 Cat 不是強勢結構）
  - **例外條件**：如果 Cat = Cat3（主升段）且結構非常強勁，可以考慮只減倉 30% 而不是 50%
  - **如果例外**：必須在 \`reasoning\` 中明確說明例外理由

**輸出要求**：
- 在每檔股票的 \`strategy_script\` 中，如果未來 7 天內有財報，必須明確說明：
  - 例如：「未來 7 天內有財報（2026-01-30），禁止開新倉，現有持倉減倉 50% 鎖住獲利」
- 在 \`order_plan\` 中，如果未來 7 天內有財報：
  - 新倉訂單必須標記為 \`earnings_ejection_applied: true\`，並設置 \`action: "CANCEL"\` 或 \`action: "REDUCE"\`
  - 現有持倉的訂單必須調整（減倉或設寬鬆停損）

**特殊情況**：
- ⚠️ **如果 Cat = Cat3（主升段）且結構非常強勁**：可以考慮只減倉 30%，而不是 50%
- ⚠️ **如果 Cat = Cat4-B（深度回調）或 Cat5（趨勢破壞）**：建議完全清倉，不要冒險

### 5) 風險優先約束（強烈建議，不是絕對禁止）

- ⚠️ **如果 P0.7 是 Late 或 turning_point_risk 是 HIGH**：強烈建議減少突破單使用，優先使用拉回買進
  - 例外條件：超級催化劑、P0 必然性結論變化
  - 如果例外，必須在 \`reasoning\` 中明確說明
- ⚠️ **如果 p5_weekly_flags 包含 DIVERGENCE_ALERT 或 LATE_CYCLE_RISK**：強烈建議收緊停損，降低攻擊性
  - 例外條件：明確反向證據
  - 如果例外，必須在 \`reasoning\` 中明確說明

### 5) 輸出格式要求

- ✅ 提供簡短的 \`strategy_script\`（2-4 行）解釋劇本
- ✅ 提供 \`order_plan\` 作為 JSON 陣列（只輸出 JSON，不要額外敘述）

### 6) 範例

**範例 1：突破買進（Cat2/Cat3）**
\`\`\`json
{
  "strategy_script": "股價突破 110 代表主力發動攻勢，我們要追。如果股價沒碰到 110，這筆單永遠不會成交。",
  "order_plan": [
    {
      "order_id": "BUY_BREAKOUT_001",
      "side": "BUY",
      "order_type": "STOP_LIMIT",
      "trigger": 110.0,
      "limit_price": 110.5,
      "qty_percent": 0.30,
      "time_in_force": "GTC",
      "attached_orders": {
        "stop_loss": 105.0,
        "take_profit": 125.0
      }
    }
  ]
}
\`\`\`

**範例 2：拉回買進（Cat4-A）**
\`\`\`json
{
  "strategy_script": "主力在 100 有防守，跌下來我要接。",
  "order_plan": [
    {
      "order_id": "BUY_PULLBACK_001",
      "side": "BUY",
      "order_type": "LIMIT",
      "limit_price": 100.0,
      "qty_percent": 0.50,
      "time_in_force": "GTC"
    }
  ]
}
\`\`\`

**範例 3：Breakout + Pullback OCO 互斥**
\`\`\`json
{
  "strategy_script": "如果突破 110 就追，如果回調到 100 就接。兩者互斥，只能成交一個。",
  "order_plan": [
    {
      "order_id": "BUY_BREAKOUT_001",
      "side": "BUY",
      "order_type": "STOP_LIMIT",
      "trigger": 110.0,
      "limit_price": 110.5,
      "qty_percent": 0.30,
      "time_in_force": "GTC",
      "oco_group_id": "OCO_GROUP_001"
    },
    {
      "order_id": "BUY_PULLBACK_001",
      "side": "BUY",
      "order_type": "LIMIT",
      "limit_price": 100.0,
      "qty_percent": 0.30,
      "time_in_force": "GTC",
      "oco_group_id": "OCO_GROUP_001"
    }
  ]
}
\`\`\`

## 輸出格式（必須是 JSON）

{
  "p5_b_results": {
    "TICKER1": {
      "ticker": "TICKER1",
      "state_vector": {
        "trend_integrity": 0.82,        // 0.0-1.0，趨勢完整性
        "momentum_shift": -0.10,        // -1.0 到 1.0，動量變化（⭐ 注意：Sector ETF Flow 與 Mag7 相對強弱為高優先權因子；若 SYSTEM_FLAGS 有 DIVERGENCE_ALERT 或 UPSTREAM_WEAKNESS，必須降低此值）
        "distribution_risk": 0.35,      // 0.0-1.0，派發風險（⭐ 注意：必須包含 P2.5 的內部人拋售與 13F 異常；若 SYSTEM_FLAGS 有 INVENTORY_BUILD_WARNING 或 DEMAND_SLOWDOWN，必須提高此值）
        "volatility_regime_change": 0.60  // 0.0-1.0，波動率制度變化（⭐ 注意：必須參考 P6 頻率趨勢；若 P6 Trend 為 SURGE 或 ELEVATED，必須提高此值）
      },
      "parameter_adjustment_vector": {
        "buy_bias": -0.15,              // -1.0 到 1.0，買入偏向
        "sell_bias": 0.20,              // -1.0 到 1.0，賣出偏向
        "ladder_spacing_adjustment": "+10%",  // 掛單間距調整
        "trailing_stop_tightness": "+15%",    // 追蹤停利緊度調整
        "max_position_cap_override": null      // 倉位上限覆蓋（null 表示不覆蓋）
      },
      "escalation_score": 0.22,        // 0.0-1.0，升級分數
      "reasoning": "簡短理由",
      "strategy_script": "2-4 行解釋劇本（例如：如果股價突破 110，代表主力發動攻勢，我們要追）",
      "order_plan": [
        {
          "order_id": "BUY_BREAKOUT_001",
          "side": "BUY",
          "order_type": "STOP_LIMIT",
          "trigger": 110.0,
          "limit_price": 110.5,
          "qty_percent": 0.30,
          "time_in_force": "GTC",
          "oco_group_id": null,
          "attached_orders": {
            "stop_loss": 105.0,
            "take_profit": 125.0
          }
        }
      ]
    }
  }
}

## ⚠️ 重要：輸出格式要求

- ❌ **禁止任何客套話、開場白、結尾語**
- ✅ **只輸出純 JSON 格式**
`;
}

/**
 * 構建 P5-A Prompt（深度版）
 * 
 * @param {Array} batchStockData - 批次股票數據
 * @param {Object} context - 上下文數據
 * @returns {string} prompt - AI Prompt
 */
function buildP5_APrompt(batchStockData, context) {
  // ⭐ V8.15 新增：提取 P0.5 的 p5_weekly_flags（系統級旗標）
  const systemFlags = {};
  for (const stockData of batchStockData) {
    const flags = stockData.p0_5_data?.p5_weekly_flags || [];
    if (flags.length > 0) {
      systemFlags[stockData.ticker] = flags;
    }
  }
  
  // ⭐ V8.15 新增：提取 P6 頻率趨勢（基準線描述）
  const p6Summary = context.p6_weekly_summary || {};
  const p6FrequencyDescription = p6Summary.alert_count !== undefined && p6Summary.avg_4w !== undefined
    ? `P6 Alert Frequency: ${p6Summary.alert_count} (vs 4-Week Avg: ${p6Summary.avg_4w.toFixed(1)}). Trend: ${p6Summary.frequency_trend || "NORMAL"}`
    : "P6 Alert Frequency: Data not available";
  
  return `
## ⚠️ CRITICAL RULE: 越獄防護指令

**CRITICAL RULE: You are a PARAMETER ADJUSTER, NOT a Price Setter. You MUST output a parameter_adjustment_vector JSON. Any attempt to output absolute price levels (e.g. 'Buy at 150') will cause a SYSTEM FAILURE.**

---

你是一位資深的股票策略分析師，負責為 Nuclear Project 的 P5 Weekly 進行**深度重評估**（P5-A）。

## ⭐ SYSTEM_FLAGS（系統級旗標 - 來自 P0.5 產業鏈監控）

**這些旗標直接影響你的決策，必須在深度分析中重點考慮：**

${Object.keys(systemFlags).length > 0 
  ? Object.entries(systemFlags).map(([ticker, flags]) => 
      `- **${ticker}**: ${flags.length > 0 ? flags.map(f => `\`${f}\``).join(", ") : "無旗標"}`
    ).join("\n")
  : "- 無系統級旗標（所有股票正常）"}

## ⭐ P6 盤中監測頻率趨勢（基準線）

**${p6FrequencyDescription}**

## 任務目標

以下股票已通過 P5-B 評估，觸發升級條件，需要進行深度重評估：
${batchStockData.map(s => `${s.ticker}（升級原因：${s.escalation_reason.map(r => r.type).join(", ")}）`).join(", ")}

## 股票數據（包含 P5-B 結果）

${JSON.stringify(batchStockData, null, 2)}

## 上下文數據

${JSON.stringify({
  p0_5_snapshot: context.p0_5_snapshot || null,
  p0_7_snapshot: context.p0_7_snapshot || null,
  p2_snapshot: context.p2_snapshot || null,
  p2_5_snapshot: context.p2_5_snapshot || null,
  p3_snapshot: context.p3_snapshot || null,
  p4_snapshot: context.p4_snapshot || null,
  p6_weekly_summary: context.p6_weekly_summary || null,
  macro_flow_context: context.macro_flow_context || null,
  learning_feedback: context.learning_feedback || null  // ⭐ 工程師修復：動態學習系統反饋（必須納入決策）
}, null, 2)}

## ⭐ 工程師修復：動態學習系統反饋（必須納入決策）

**⚠️ 重要：系統會不斷重複犯同樣的錯誤，除非你參考學習反饋**

如果 \`learning_feedback\` 存在，你必須：

1. **參考 Parameter_Bias_Adjustment**：
   - 如果學習系統發現「在某種盤勢下 RSI 失靈」，你必須降低對 RSI 的依賴
   - 如果學習系統發現「某種策略在特定 Regime 下失敗率高」，你必須調整策略參數

2. **參考 Safety_Lock_Recommendations**：
   - 如果學習系統標記「某種情境簽章死亡率 > 50%」，你必須提高風險意識
   - 必須在 \`parameter_adjustment_vector\` 中反映這些警告

3. **參考 Recent_Reflections**：
   - 學習系統的近期反思必須納入你的決策考量
   - 如果系統發現「上週犯了什麼錯」，你必須避免重複同樣的錯誤

4. **參考 Similar_Failure_Cases**：
   - 如果當前情境與歷史失敗案例相似，你必須調整策略
   - 必須在 \`reasoning\` 中說明如何避免歷史錯誤

**如果 \`learning_feedback\` 為 null 或不存在**：
- 標註「無學習反饋可用」
- 但決策邏輯不受影響（向後兼容）

## ⭐ V8.26 C1 修復：因子權重決定指引

**⚠️ 重要：權重決定必須基於邏輯推理，不是隨意猜測**

**基準權重**（作為起點，不是強制規則）：
- **Fundamental（基本面）**：30%
- **Chips（籌碼面）**：25%
- **Tech（技術面）**：25%
- **Macro（宏觀面）**：10%
- **Sentiment（情緒面）**：10%

**允許偏差範圍**：±15%（例如：fundamental 可以在 15%-45% 範圍內）

**調整原則**（建議，不是命令）：
1. **系統級風險訊號（P0.7, P0.5）優先於個股訊號** → 提高 macro 權重
2. **籌碼面與基本面衝突時，優先相信籌碼** → 提高 chips 權重
3. **技術面與基本面衝突時，短期看技術，長期看基本面** → 根據持有期調整
4. **財報季（未來 14 天有財報）** → 提高 chips 權重（機構提前佈局）
5. **突破型態（Cat2/Cat3 + volume_surge）** → 提高 tech 權重
6. **高波動環境（VIX > 25）** → 提高 macro 權重，降低 tech/sentiment 權重
7. **P2 Milestone 驗證期** → 提高 fundamental 權重

**輸出要求**：
- 你必須在 \`reasoning\` 中明確說明權重決定的理由
- 如果權重偏離基準超過 ±20%，必須提供明確的反向證據
- 你的權重決定應該是基於邏輯推理，不是隨意猜測
- 如果某個因子權重為 0%，必須說明為什麼完全忽略該因子

**注意**：本 Prompt 不要求你輸出權重配置（權重由程式根據你的 \`parameter_adjustment_vector\` 和 \`state_vector\` 計算），但你的決策邏輯應該遵循上述原則。

## ⭐ V8.27 新增：根據 P0 必然性等級動態調整因子權重基準

**當前股票 P0 必然性等級**: ${batchStockData.map(s => `${s.ticker}: ${s.p0_conviction_level || "未知"}`).join(", ")}

**建議因子權重**（可調整 ±10%）：

**如果 P0 必然性 = ULTRA_HIGH 且 Position_Role = MOMENTUM_COMPOUNDER**：
  - P0 產業必然性: 40%
  - P2 基本面: 30%
  - P2.5 籌碼面: 20%
  - P3 技術面: 10%
  
  **關鍵原則**：
  - ⭐ P0 長期必然性優先於 P3 短期技術面
  - ⭐ 技術面破位（Cat4-B/Cat5）不應該觸發清倉
  - ⭐ 只有 P0 必然性降級或 P2 基本面惡化才應該減倉

**如果 P0 必然性 = MEDIUM 或 Position_Role = FRONTIER_OPTIONALITY**：
  - P0 產業必然性: 15%
  - P2 基本面: 25%
  - P2.5 籌碼面: 30%
  - P3 技術面: 30%
  
  **關鍵原則**：
  - ⭐ P3 短期技術面優先（靈活調整）
  - ⭐ 技術面破位應該觸發減倉或清倉

**重要**：
- 這些權重是「基準」，不是強制規則
- 你可以根據具體情況調整（±10%）
- 但必須在 reasoning 中明確說明調整理由

## ⭐ V8.27 新增：P2 安全閘門（硬約束，覆蓋所有權重）

**⚠️ 重要：以下是硬約束，不可討論**

如果 P2 月度更新發現以下任一情況：
1. Safety Score 降級到 C 或以下
2. CFO（經營現金流）轉負
3. 財報造假或重大訴訟
4. Gate 檢查失敗（營收/毛利率/現金流低於閾值）

→ **必須立即清倉或大幅減倉（降到 OPPORTUNISTIC 上限 3%）**
→ **不論 P0 必然性多強**
→ **這是安全閘門，覆蓋所有其他因素**

**理由**：
- P2 基本面惡化是致命信號
- 公司可能面臨破產或重大危機
- 不能因為「P0 必然性強」就忽視基本面惡化

## ⭐ V8.27 新增：反覆矛盾新聞的深度思考指引

**⚠️ 重要：不要直接忽略反覆矛盾的新聞，而是要深度思考為什麼會這樣**

你收到的新聞數據中，已經由 Daily 的 Gemini Pro 3.0 標記了 \`event_stability\`。

**處理原則**：

1. **如果 \`event_stability = "REVERSAL_NOISE"\`**：
   - ❌ **不要直接忽略**：這不是讓你忽略的理由
   - ✅ **深度思考**：
     * 為什麼會反覆矛盾？是媒體配合主力炒作？還是政策尚未穩定？
     * 如果 P0 必然性依然 ULTRA_HIGH（例如：AI 晶片長期需求依然強勁），短期政策反覆不應影響長期投資決策
     * 如果 P2 基本面健康，短期噪音不應觸發清倉
   - ✅ **在 reasoning 中明確說明**：
     * 你看到了反覆矛盾的新聞（例如：H200 出貨政策反覆）
     * 但你基於 P0 必然性（AI 晶片需求依然強勁）和 P2 基本面健康，維持積極策略
     * 你判斷這是「短期政策反覆」而非「長期結構性變化」

2. **如果 \`event_stability = "STABLE_EVENT"\`**：
   - ✅ 正常處理，納入決策考量

3. **如果 \`event_stability = "EVOLVING"\`**：
   - ✅ 持續觀察，但可以納入決策考量

**關鍵原則**：
- ⭐ Daily 的標記是「提示」，不是「命令」
- ⭐ 你的任務是「深度思考」，不是「直接忽略」
- ⭐ 基於 P0 必然性和 P2 基本面制定策略，而非被短期噪音影響

## ⭐ V8.27 新增：逆向投資信號檢測

**定義**：市場恐慌時的「黃金買點」

**觸發條件**（必須全部成立）：
1. P0 必然性 = ULTRA_HIGH 或 HIGH（長期邏輯依然成立）
2. P2 基本面健康（Safety >= B，無財報造假/重大訴訟）
3. P3 技術面破位（Cat4-B 或 Cat5，市場恐慌性拋售）
4. P2.5 機構開始建倉（Smart Money Score 上升 或 機構持倉流入）
5. 市場情緒極度悲觀（VIX > 30 或 Fear & Greed Index < 20）

**如果檢測到逆向投資信號**：

你應該調整 parameter_adjustment_vector：

1. **buy_aggressiveness（買入激進度）**：
   - 正常情況：0.5（中性）
   - 逆向投資：0.8-0.9（高度激進）
   - 含義：掛單價格「更接近市價」，避免踏空

2. **buy_bias（買入偏移）**：
   - 正常情況：-0.10（價格下調 1%，等待回調）
   - 逆向投資：+0.15（價格上調 1.5%，更積極買入）
   - 含義：不等待深跌，在恐慌中買入

3. **max_position_cap_override（倉位上限覆蓋）**：
   - 如果 Position_Role = MOMENTUM_COMPOUNDER 且 P0 = ULTRA_HIGH
   - 考慮提高倉位上限（從 20% → 25%）
   - 理由：恐慌時的黃金買點，應該加大倉位

**範例（NVDA 2022-10 @ 110）**：

檢測結果：
  → P0 必然性：ULTRA_HIGH（AI 晶片需求依然強勁）✅
  → P2 基本面：Safety = A（財務健康）✅
  → P3 技術面：Cat5（恐慌性破位）✅
  → P2.5 機構：Smart Money Score 上升（機構建倉）✅
  → 市場情緒：VIX = 35（極度恐慌）✅
  → 觸發「逆向投資信號」！

parameter_adjustment_vector（你應該輸出）：
  {
    "buy_aggressiveness": 0.85,  // 高度激進
    "buy_bias": "+0.15",  // 價格上調 1.5%
    "sell_bias": "-0.20",  // 賣出更保守（不急著賣）
    "max_position_cap_override": 0.25,  // 提高倉位上限
    "reasoning": "檢測到逆向投資信號（P0 強勁 + 市場恐慌 + 機構建倉），應在恐慌中積極買入"
  }

## 深度分析要求

1. **重新評估 P3 技術面**：基於最新數據，重新分析技術結構和主力意圖
2. **重新評估 P2 基本面**：檢查是否有新的財務風險或機會
3. **整合 P0.5 產業鏈訊號**：考慮產業鏈動態監控的結論
4. **整合 P0.7 時間窗口**：考慮系統動力學的時間定位
5. **整合 P2.5 籌碼面異常**：如果觸發硬升級，必須重點分析籌碼面

## ✅ Weekly Output Upgrade: Broker-Executable Order Plan (IBKR-ready) ⭐ V8.17.3 新增

**⚠️ 重要：你必須為每檔股票輸出 \`order_plan\` 陣列，這是可直接給券商執行的掛單策略代碼，不是建議價格。**

### Order Plan 輸出要求

你必須輸出一個 \`order_plan\` 陣列，包含所有掛單指令。這些指令必須是 IBKR（Interactive Brokers）支援的進階掛單類型，可以直接批次下單。

### 1) 每個訂單的必填欄位

- **order_id**: 唯一訂單 ID（例如："BUY_BREAKOUT_AAPL_001"）
- **side**: BUY 或 SELL
- **order_type**: LIMIT | STOP_LIMIT | STOP | TRAIL | MARKET（避免 MARKET，除非緊急情況）
- **qty_percent**: 目標倉位的百分比（必須遵守 CORE >= 50% 規則）
- **trigger** (可選): 觸發價格（例如：STOP_LIMIT 的 stop_price）
- **limit_price** (可選): 限價（LIMIT 或 STOP_LIMIT 需要）
- **time_in_force**: DAY | GTC | GTD（週度系統預設 GTC）
- **oco_group_id** (可選): OCO 群組 ID（同一群組的訂單會互相取消）
- **attached_orders** (可選): BRACKET 附帶訂單，格式為 {take_profit, stop_loss} 或 trailing_stop

### 2) 訂單類型選擇規則（不要寫死，根據結構選擇）

**STOP_LIMIT（突破買進）**：
- ✅ **適用於**：Cat2/Cat3（啟動期/主升段）且 risk_overlay_level 不是 HIGH
- ✅ **或**：本週有明確催化劑 + 明確壓力位 + risk_overlay_level 不是 HIGH
- ⚠️ **謹慎使用**：如果 P0.7 是 Late 或 turning_point_risk 是 HIGH
  - 預設不使用，除非有強力催化劑（例如：FDA 批准、併購公告、超預期財報、重大政策轉向）
  - 如果使用，必須在 \`reasoning\` 中明確說明例外理由
  - 如果使用，必須降低倉位（max_position_cap 減半）
  - 如果使用，必須標記 \`hard_constraint_exception = true\`
- ⚠️ **謹慎使用**：如果 p5_weekly_flags 包含 DIVERGENCE_ALERT 或 LATE_CYCLE_RISK
  - 預設不使用，除非有明確反向證據
  - 如果使用，必須在 \`reasoning\` 中明確說明例外理由

**LIMIT（拉回買進）**：
- ✅ **通用、最安全**：適用於 Cat3 回踩、Cat4-A、Cat4-B、不確定 Regime
- ✅ **多數股票都應該以這個為主**（尤其 100 檔批次）

**BRACKET（區間操作）**：
- ✅ **適用於**：波段倉、噴出倉
- ✅ **對「不盯盤」很重要**：買進後自動停損停利
- ⚠️ **核心倉限制**：核心倉（至少 50%）通常不要 bracket 的 take-profit（避免太早賣光）
- ✅ **可以附帶**：stop_loss（必須）和 take_profit（可選，但核心倉不建議）

**OCO（互斥訂單）**：
- ⚠️ **關鍵要求**：如果同時提供 Breakout Buy（STOP_LIMIT）與 Pullback Buy（LIMIT），**必須用 OCO 綁定**，避免兩邊都成交造成超倉
- ✅ **使用場景**：Breakout 和 Pullback 策略互斥時

### 3) 財報前強制清倉（Earnings Ejection）⭐ V8.18 新增

**⚠️ 硬規則：週度波段 + 不處理財報風險 = 在賭命**

**核心原則**：
- 財報是賭博。再好的技術面，財報一句話就能跌 20%
- 如果持倉剛好在本週公佈財報，而我們採取「射後不理」的掛單模式，這是在賭運氣
- 不要讓辛苦賺來的波段利潤，毀在一次財報上

**強烈建議規則（除非有明確反向證據，否則應遵守）**：
- ✅ **檢查未來 7 天內是否有財報公佈**（從 EARNINGS_CALENDAR 或 HOLDINGS_EARNINGS_CALENDAR 讀取）
- ✅ **如果有財報在未來 7 天內**：
  - ⚠️ **強烈建議不開新倉**（除非是賭財報的特殊策略，但通常不建議）
  - ✅ **現有持倉強烈建議減倉**：減倉 50% 或設寬鬆停損（根據 Cat 類型決定）
  - ✅ **防禦策略選項**：
    * **選項 1**：減倉 50%，鎖住獲利
    * **選項 2**：設寬鬆停損（例如：從 -5% 放寬到 -8% 或 -10%）
    * **選項 3**：完全清倉（若已有獲利且 Cat 不是強勢結構）
  - **例外條件**：如果 Cat = Cat3（主升段）且結構非常強勁，可以考慮只減倉 30% 而不是 50%
  - **如果例外**：必須在 \`reasoning\` 中明確說明例外理由

**輸出要求**：
- 在每檔股票的 \`strategy_script\` 中，如果未來 7 天內有財報，必須明確說明：
  - 例如：「未來 7 天內有財報（2026-01-30），禁止開新倉，現有持倉減倉 50% 鎖住獲利」
- 在 \`order_plan\` 中，如果未來 7 天內有財報：
  - 新倉訂單必須標記為 \`earnings_ejection_applied: true\`，並設置 \`action: "CANCEL"\` 或 \`action: "REDUCE"\`
  - 現有持倉的訂單必須調整（減倉或設寬鬆停損）

**特殊情況**：
- ⚠️ **如果 Cat = Cat3（主升段）且結構非常強勁**：可以考慮只減倉 30%，而不是 50%
- ⚠️ **如果 Cat = Cat4-B（深度回調）或 Cat5（趨勢破壞）**：建議完全清倉，不要冒險

### 4) 風險優先約束

- ⚠️ **如果 P0.7 是 Late 或 turning_point_risk 是 HIGH**：減少突破單使用，優先使用拉回買進
- ⚠️ **如果 p5_weekly_flags 包含 DIVERGENCE_ALERT 或 LATE_CYCLE_RISK**：收緊停損，降低攻擊性

### 5) 輸出格式要求

- ✅ 提供簡短的 \`strategy_script\`（2-4 行）解釋劇本
- ✅ 提供 \`order_plan\` 作為 JSON 陣列（只輸出 JSON，不要額外敘述）

## 輸出格式（必須是 JSON）

{
  "p5_a_results": {
    "TICKER1": {
      "ticker": "TICKER1",
      "deep_re_evaluation": {
        "p3_re_analysis": "重新分析的技術面結論",
        "p2_re_analysis": "重新分析的基本面結論",
        "p0_5_integration": "產業鏈訊號整合",
        "p0_7_integration": "時間窗口整合",
        "p2_5_integration": "籌碼面異常整合"
      },
      "parameter_adjustment_vector": {
        "buy_bias": -0.20,
        "sell_bias": 0.30,
        "ladder_spacing_adjustment": "+15%",
        "trailing_stop_tightness": "+20%",
        "max_position_cap_override": 0.10  // 降低倉位上限
      },
      "strategy_recommendation": "INCREASE/DECREASE/HOLD/EXIT",
      "confidence": 0.85,
      "reasoning": "詳細分析理由",
      "strategy_script": "2-4 行解釋劇本（例如：如果股價突破 110，代表主力發動攻勢，我們要追）",
      "order_plan": [
        {
          "order_id": "BUY_BREAKOUT_001",
          "side": "BUY",
          "order_type": "STOP_LIMIT",
          "trigger": 110.0,
          "limit_price": 110.5,
          "qty_percent": 0.30,
          "time_in_force": "GTC",
          "oco_group_id": null,
          "attached_orders": {
            "stop_loss": 105.0,
            "take_profit": 125.0
          }
        }
      ]
    }
  }
}

## ⚠️ 重要：輸出格式要求

- ❌ **禁止任何客套話、開場白、結尾語**
- ✅ **只輸出純 JSON 格式**
`;
}

// ==========================================
// 輔助函數（簡化版，實際應由 AI 輸出）
// ==========================================

function calculateTrendIntegrity(stockData) {
  // 簡化實現，實際應由 AI 輸出
  return 0.8;
}

function calculateMomentumShift(stockData) {
  // 簡化實現，實際應由 AI 輸出
  return 0.0;
}

function calculateDistributionRisk(stockData) {
  // 簡化實現，實際應由 AI 輸出
  return 0.3;
}

function calculateVolatilityRegimeChange(stockData) {
  // 簡化實現，實際應由 AI 輸出
  return 0.5;
}

function generateP5_BProgrammaticResult(stockData) {
  return {
    ticker: stockData.ticker,
    status: "PROGRAMMATIC",
    state_vector: stockData.state_vector || {},
    parameter_adjustment_vector: {
      buy_bias: 0.0,
      sell_bias: 0.0,
      ladder_spacing_adjustment: "0%",
      trailing_stop_tightness: "0%",
      max_position_cap_override: null
    },
    escalation_result: stockData.escalation_result || {
      escalation_score: 0.0,
      should_escalate: false
    }
  };
}
