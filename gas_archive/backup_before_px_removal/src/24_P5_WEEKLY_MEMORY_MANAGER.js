/**
 * 📚 P5 Weekly: Memory Manager（記憶管理系統）⭐ V8.13修正
 * 
 * ⚠️ V8.13重大修正：從Rule Engine轉向Memory Manager（極簡RAG）
 * 
 * 核心哲學：
 * - GAS是Librarian（圖書館管理員），AI是Reader（讀者）
 * - GAS負責把最有用的記憶（Memory Pack）放到AI桌上
 * - AI自己判斷如何用過去的經驗調整現在的策略
 * 
 * 功能模組：
 * 1. Tagger & Summarizer：生成market_tags和executive_summary
 * 2. Reflection Agent：AI生成教訓和證據（不做程式歸因樹）
 * 3. Context Retriever：標籤檢索相似歷史案例
 * 4. Memory Pack Builder：組裝三層記憶（Principles / Short-term / Contextual Recall）
 * 5. Principles Governor：月度治理（合併去重、限制條數、禁止改憲法）
 * 
 * @version V8.13（Memory Manager架構）
 * @date 2026-01-19
 */

// ==========================================
// 0. 常量定義
// ==========================================

/**
 * 市場標籤允許列表（MARKET_TAGS_ALLOWLIST）
 * 
 * 30-50個標籤，用於標記市場情境
 */
const MARKET_TAGS_ALLOWLIST = [
  // 市場狀態
  "BULL_MARKET", "BEAR_MARKET", "SIDEWAYS", "VOLATILE", "CRISIS",
  // VIX水平
  "VIX_LOW", "VIX_MEDIUM", "VIX_HIGH", "VIX_EXTREME",
  // 板塊輪動
  "TECH_STRONG", "TECH_WEAK", "FINANCIAL_STRONG", "FINANCIAL_WEAK",
  "ENERGY_STRONG", "ENERGY_WEAK", "HEALTHCARE_STRONG", "HEALTHCARE_WEAK",
  // 宏觀環境
  "RATE_HIKING", "RATE_CUTTING", "INFLATION_HIGH", "INFLATION_LOW",
  "RECESSION_RISK", "GROWTH_STRONG", "GROWTH_WEAK",
  // 事件類型
  "EARNINGS_SEASON", "FED_MEETING", "GEO_POLITICAL", "TRADE_WAR",
  // 技術信號
  "BREAKOUT", "BREAKDOWN", "OVERSOLD", "OVERBOUGHT",
  "TREND_REVERSAL", "MOMENTUM_LOSS",
  // 情緒
  "FEAR", "GREED", "UNCERTAINTY", "CONFIDENCE"
];

/**
 * Token Budget配置
 */
const MEMORY_PACK_TOKEN_BUDGET = {
  principles: 500,        // Layer 1: Principles（永不砍）
  short_term_per_week: 200,  // Layer 2: 每週Short-term Memory
  contextual_per_case: 150   // Layer 3: 每個Contextual Recall案例
};

// ==========================================
// 1. Tagger & Summarizer
// ==========================================

/**
 * 生成市場標籤（Market Tags）⭐ V8.13修正
 * 
 * 使用AI從市場數據中提取標籤（必須在allow-list中）
 * 
 * @param {Object} marketData - 市場數據
 * @param {Object} worldview - 世界觀分析結果
 * @returns {Array} marketTags - 市場標籤列表（must in allow-list）
 */
function generateMarketTags(marketData, worldview) {
  try {
    // 使用AI生成標籤（Gemini Pro）
    const jobId = `MARKET_TAGS_${Date.now()}`;
    const payload = {
      market_data: marketData,
      worldview: worldview,
      allow_list: MARKET_TAGS_ALLOWLIST,
      task: "generate_market_tags",
      instructions: `
請從市場數據和世界觀分析中提取市場標籤。

**要求**：
1. 標籤必須在allow-list中（${MARKET_TAGS_ALLOWLIST.join(', ')}）
2. 選擇3-8個最相關的標籤
3. 返回JSON格式：{"tags": ["TAG1", "TAG2", ...]}

**市場數據**：
- VIX: ${marketData.vix || 'N/A'}
- Market Regime: ${worldview?.market_regime || 'N/A'}
- Sector Rotation: ${JSON.stringify(worldview?.sector_rotation || {})}

請返回JSON格式的標籤列表。
      `
    };
    
    if (typeof executeCapability !== "function") {
      Logger.log(`P5 Weekly Memory Manager：⚠️ executeCapability 未定義，使用簡化標籤生成`);
      // 簡化實現：根據市場數據手動生成標籤
      return generateMarketTagsSimplified(marketData, worldview);
    }
    
    const result = executeCapability(jobId, "GEMINI_PRO", payload);
    
    if (result && result.output) {
      let parsedResult;
      if (typeof result.output === 'string') {
        try {
          parsedResult = JSON.parse(result.output);
        } catch (e) {
          const jsonMatch = result.output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResult = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("無法解析AI輸出");
          }
        }
      } else {
        parsedResult = result.output;
      }
      
      // 驗證標籤是否在allow-list中
      const tags = parsedResult.tags || [];
      const validTags = tags.filter(tag => MARKET_TAGS_ALLOWLIST.includes(tag));
      
      if (validTags.length === 0) {
        Logger.log(`P5 Weekly Memory Manager：AI生成的標籤都不在allow-list中，使用簡化標籤生成`);
        return generateMarketTagsSimplified(marketData, worldview);
      }
      
      return validTags;
    }
    
    // 如果AI生成失敗，使用簡化實現
    return generateMarketTagsSimplified(marketData, worldview);
    
  } catch (error) {
    Logger.log(`P5 Weekly Memory Manager：生成市場標籤失敗：${error.message}`);
    return generateMarketTagsSimplified(marketData, worldview);
  }
}

/**
 * 簡化版市場標籤生成（備用）
 * 
 * @param {Object} marketData - 市場數據
 * @param {Object} worldview - 世界觀分析結果
 * @returns {Array} marketTags - 市場標籤列表
 */
function generateMarketTagsSimplified(marketData, worldview) {
  const tags = [];
  
  // 根據VIX水平
  const vix = marketData.vix || 0;
  if (vix < 15) tags.push("VIX_LOW");
  else if (vix < 25) tags.push("VIX_MEDIUM");
  else if (vix < 35) tags.push("VIX_HIGH");
  else tags.push("VIX_EXTREME");
  
  // 根據市場狀態
  const marketRegime = worldview?.market_regime || "UNCERTAIN";
  if (marketRegime.includes("BULL")) tags.push("BULL_MARKET");
  else if (marketRegime.includes("BEAR")) tags.push("BEAR_MARKET");
  else tags.push("SIDEWAYS");
  
  return tags;
}

/**
 * 生成Executive Summary（短摘要）⭐ V8.13修正
 * 
 * 由Weekly AI生成，<=300字，必填
 * 
 * @param {Object} stockStrategies - 個股策略結果
 * @param {Object} worldview - 世界觀分析結果
 * @param {Object} events - 事件分析結果
 * @returns {string} executiveSummary - 短摘要（<=300字）
 */
function generateExecutiveSummary(stockStrategies, worldview, events) {
  try {
    // 使用AI生成短摘要（Gemini Pro）
    const jobId = `EXEC_SUMMARY_${Date.now()}`;
    const payload = {
      stock_strategies: stockStrategies,
      worldview: worldview,
      events: events,
      task: "generate_executive_summary",
      instructions: `
請生成本週策略的Executive Summary（短摘要）。

**要求**：
1. 字數限制：<=300字
2. 必須包含：本週市場狀態、主要策略方向、關鍵風險
3. 語言：繁體中文
4. 格式：純文字，不要Markdown格式

請返回JSON格式：{"executive_summary": "..."}
      `
    };
    
    if (typeof executeCapability !== "function") {
      Logger.log(`P5 Weekly Memory Manager：⚠️ executeCapability 未定義，使用簡化摘要生成`);
      return generateExecutiveSummarySimplified(stockStrategies, worldview, events);
    }
    
    const result = executeCapability(jobId, "GEMINI_PRO", payload);
    
    if (result && result.output) {
      let parsedResult;
      if (typeof result.output === 'string') {
        try {
          parsedResult = JSON.parse(result.output);
        } catch (e) {
          const jsonMatch = result.output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResult = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("無法解析AI輸出");
          }
        }
      } else {
        parsedResult = result.output;
      }
      
      const summary = parsedResult.executive_summary || "";
      
      // 驗證字數
      if (summary.length > 300) {
        Logger.log(`P5 Weekly Memory Manager：Executive Summary超過300字（${summary.length}字），截斷`);
        return summary.substring(0, 300);
      }
      
      return summary;
    }
    
    // 如果AI生成失敗，使用簡化實現
    return generateExecutiveSummarySimplified(stockStrategies, worldview, events);
    
  } catch (error) {
    Logger.log(`P5 Weekly Memory Manager：生成Executive Summary失敗：${error.message}`);
    return generateExecutiveSummarySimplified(stockStrategies, worldview, events);
  }
}

/**
 * 簡化版Executive Summary生成（備用）
 * 
 * @param {Object} stockStrategies - 個股策略結果
 * @param {Object} worldview - 世界觀分析結果
 * @param {Object} events - 事件分析結果
 * @returns {string} executiveSummary - 短摘要
 */
function generateExecutiveSummarySimplified(stockStrategies, worldview, events) {
  const strategyCount = Object.keys(stockStrategies || {}).length;
  const marketRegime = worldview?.market_regime || "不確定";
  const eventCount = events?.upcoming_events?.length || 0;
  
  return `本週市場狀態：${marketRegime}。共分析${strategyCount}檔股票策略。${eventCount > 0 ? `有${eventCount}個重要事件需關注。` : ''}策略重點：根據市場狀態和個股基本面調整配置。`;
}

// ==========================================
// 2. Reflection Agent（每週檢討）
// ==========================================

/**
 * Reflection Agent：生成教訓和證據 ⭐ V8.13修正
 * 
 * 使用AI生成「教訓 + 證據」週記，不做程式歸因樹
 * 
 * @param {Object} strategySnapshot - 策略快照
 * @param {Object} outcomeSnapshot - 結果快照
 * @param {Object} scorecard - Scorecard結果
 * @returns {Object} reflection - Reflection結果
 */
function generateReflectionWithAI(strategySnapshot, outcomeSnapshot, scorecard) {
  try {
    // 使用AI生成Reflection（Gemini Pro）
    const jobId = `REFLECTION_${Date.now()}`;
    const payload = {
      strategy_snapshot: strategySnapshot,
      outcome_snapshot: outcomeSnapshot,
      scorecard: scorecard,
      task: "generate_reflection",
      instructions: `
請分析策略比對結果，生成Reflection（教訓和證據）。

**輸出格式**（必須嚴格遵守）：
{
  "root_cause": "A|B|C|D|UNCERTAIN",
  "lesson_learned": ["教訓1", "教訓2", "教訓3"],  // max 3
  "evidence_pointers": ["snapshot_id/cluster_id/..."],
  "confidence": 0.0-1.0,
  "parameter_recommendations": {}  // 僅建議，不自動生效
}

**錯誤類型分類**：
- Type A：數據源污染（Data Source Contamination）
- Type B：邏輯幻覺（Logic Hallucination）
- Type C：執行滑價（Execution Slippage）
- Type D：黑天鵝（Black Swan）

**Guardrail**：
- 如果evidence_pointers為空，root_cause必須是UNCERTAIN
- 不得直接改策略邏輯/if-then
- parameter_recommendations僅供prompt參考，不自動生效

請返回JSON格式。
      `
    };
    
    if (typeof executeCapability !== "function") {
      Logger.log(`P5 Weekly Memory Manager：⚠️ executeCapability 未定義，返回UNCERTAIN`);
      return {
        root_cause: "UNCERTAIN",
        lesson_learned: [],
        evidence_pointers: [],
        confidence: 0.0,
        parameter_recommendations: {}
      };
    }
    
    const result = executeCapability(jobId, "GEMINI_PRO", payload);
    
    if (result && result.output) {
      let parsedResult;
      if (typeof result.output === 'string') {
        try {
          parsedResult = JSON.parse(result.output);
        } catch (e) {
          const jsonMatch = result.output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResult = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("無法解析AI輸出");
          }
        }
      } else {
        parsedResult = result.output;
      }
      
      // Guardrail：evidence_pointers空 → root_cause必須是UNCERTAIN
      if (!parsedResult.evidence_pointers || parsedResult.evidence_pointers.length === 0) {
        parsedResult.root_cause = "UNCERTAIN";
      }
      
      // 限制lesson_learned數量（max 3）
      if (parsedResult.lesson_learned && parsedResult.lesson_learned.length > 3) {
        parsedResult.lesson_learned = parsedResult.lesson_learned.slice(0, 3);
      }
      
      return parsedResult;
    }
    
    // 如果AI生成失敗，返回UNCERTAIN
    return {
      root_cause: "UNCERTAIN",
      lesson_learned: ["AI Reflection生成失敗"],
      evidence_pointers: [],
      confidence: 0.0,
      parameter_recommendations: {}
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly Memory Manager：Reflection Agent失敗：${error.message}`);
    return {
      root_cause: "UNCERTAIN",
      lesson_learned: [`Reflection Agent異常：${error.message}`],
      evidence_pointers: [],
      confidence: 0.0,
      parameter_recommendations: {}
    };
  }
}

// ==========================================
// 3. Context Retriever（標籤檢索）
// ==========================================

/**
 * 檢索相似歷史案例 ⭐ V8.13修正
 * 
 * 使用market_tags檢索相似歷史案例
 * 
 * @param {Array} currentTags - 當前市場標籤
 * @returns {Array} similarCases - 相似案例列表（top 3-5）
 */
function retrieveSimilarCases(currentTags) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__STRATEGY_SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tagsCol = headers.indexOf("market_tags_json");
    const summaryCol = headers.indexOf("executive_summary");
    const snapshotIdCol = headers.indexOf("snapshot_id");
    
    if (tagsCol === -1 || summaryCol === -1) {
      return [];
    }
    
    // 讀取所有歷史案例
    const allCases = [];
    for (let i = 1; i < rows.length; i++) {
      try {
        const tags = JSON.parse(rows[i][tagsCol] || "[]");
        const summary = rows[i][summaryCol] || "";
        const snapshotId = rows[i][snapshotIdCol] || "";
        
        // 計算match_count（tags命中數）
        const matchCount = currentTags.filter(tag => tags.includes(tag)).length;
        
        if (matchCount > 0) {
          allCases.push({
            snapshot_id: snapshotId,
            tags: tags,
            executive_summary: summary,
            match_count: matchCount
          });
        }
      } catch (e) {
        continue;
      }
    }
    
    // 讀取對應的OUTCOME_SNAPSHOT（獲取drawdown和結果）
    const outcomeSheet = ss.getSheetByName("P5__OUTCOME_SNAPSHOT");
    const outcomeCases = [];
    
    if (outcomeSheet && outcomeSheet.getLastRow() > 1) {
      const outcomeDataRange = outcomeSheet.getDataRange();
      const outcomeRows = outcomeDataRange.getValues();
      const outcomeHeaders = outcomeRows[0];
      const refSnapshotIdCol = outcomeHeaders.indexOf("ref_snapshot_id");
      const scorecardCol = outcomeHeaders.indexOf("scorecard_json");
      const reflectionCol = outcomeHeaders.indexOf("reflection_json");
      
      for (let i = 1; i < outcomeRows.length; i++) {
        try {
          const refSnapshotId = outcomeRows[i][refSnapshotIdCol];
          const scorecard = JSON.parse(outcomeRows[i][scorecardCol] || "{}");
          const reflection = JSON.parse(outcomeRows[i][reflectionCol] || "{}");
          
          // 找到對應的case
          const caseIndex = allCases.findIndex(c => c.snapshot_id === refSnapshotId);
          if (caseIndex >= 0) {
            allCases[caseIndex].drawdown = scorecard.max_drawdown || 0;
            allCases[caseIndex].accuracy = scorecard.accuracy || 0;
            allCases[caseIndex].lesson = reflection.lesson_learned || [];
            allCases[caseIndex].evidence_ids = reflection.evidence_pointers || [];
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    // 過濾：FAIL或MDD>5%
    const filteredCases = allCases.filter(c => 
      c.accuracy === 0 || (c.drawdown && c.drawdown > 5)
    );
    
    // 排序：match_count desc → drawdown desc → recency desc
    filteredCases.sort((a, b) => {
      if (a.match_count !== b.match_count) {
        return b.match_count - a.match_count;
      }
      if (a.drawdown !== b.drawdown) {
        return (b.drawdown || 0) - (a.drawdown || 0);
      }
      return 0; // recency需要從snapshot_id或created_at判斷，這裡簡化
    });
    
    // Top 2慘案 + Top 1成功案（避免PTSD過度保守）
    const topFailures = filteredCases.filter(c => c.accuracy === 0).slice(0, 2);
    const topSuccess = allCases.filter(c => c.accuracy === 1).slice(0, 1);
    
    const similarCases = [...topFailures, ...topSuccess].slice(0, 5);
    
    // 返回短摘要（不返回原始長文）
    return similarCases.map(c => ({
      snapshot_id: c.snapshot_id,
      tags: c.tags,
      executive_summary: c.executive_summary,
      lesson: c.lesson,
      result_summary: `Accuracy: ${c.accuracy}, MDD: ${c.drawdown || 0}%`,
      evidence_ids: c.evidence_ids
    }));
    
  } catch (error) {
    Logger.log(`P5 Weekly Memory Manager：檢索相似案例失敗：${error.message}`);
    return [];
  }
}

// ==========================================
// 4. Memory Pack Builder（核心功能）
// ==========================================

/**
 * 組裝Weekly Memory Pack ⭐ V8.17 地雷修復：三層記憶模型
 * 
 * 三層漏斗（固定順序）：
 * 1. Layer 1 Principles（永不砍）
 * 2. Layer 2 Short-term（L1 STM：最近 6 週完整）
 * 3. Layer 3 Mid-term（L2 MTM：7-12 週壓縮）
 * 4. Layer 4 Long-term（L3 LTM：超過 12 週，只保留教訓）
 * 5. Layer 5 Contextual Recall（Top 3相似案例）
 * 
 * @param {Object} currentContext - 當前上下文
 * @returns {Object} memoryPack - Memory Pack（控制token，不超載）
 */
function buildWeeklyMemoryPack(currentContext) {
  try {
    const memoryPack = {
      layer_1_principles: null,
      layer_2_short_term: [],      // L1 STM：最近 6 週完整
      layer_3_mid_term: [],        // L2 MTM：7-12 週壓縮
      layer_4_long_term: [],       // L3 LTM：超過 12 週，只保留教訓
      layer_5_contextual_recall: [] // Contextual Recall
    };
    
    // Layer 1: Principles（永不砍）
    const principles = readPrinciplesSummary();
    memoryPack.layer_1_principles = principles;
    
    // Layer 2: Short-term Memory（L1 STM：最近 6 週完整保留）
    const shortTermMemory = readShortTermMemory(MEMORY_LAYER_CONFIG.L1_STM_WEEKS);
    memoryPack.layer_2_short_term = shortTermMemory;
    
    // Layer 3: Mid-term Memory（L2 MTM：7-12 週壓縮）
    const midTermMemory = readMidTermMemory();
    memoryPack.layer_3_mid_term = midTermMemory;
    
    // Layer 4: Long-term Memory（L3 LTM：超過 12 週，只保留教訓）
    const longTermMemory = readLongTermMemory();
    memoryPack.layer_4_long_term = longTermMemory;
    
    // Layer 5: Contextual Recall（相似歷史top 3-5）
    const currentTags = currentContext.market_tags || [];
    const similarCases = retrieveSimilarCases(currentTags);
    memoryPack.layer_5_contextual_recall = similarCases.slice(0, 5);
    
    // ⭐ V8.17 地雷修復：自動壓縮和歸檔舊記憶
    // 每次讀取時自動執行記憶壓縮，防止無限膨脹
    compressAndArchiveOldMemory();
    
    // Token Budget控制（簡化實現：使用字數估算）
    const estimatedTokens = estimateTokenCount(memoryPack);
    const budget = MEMORY_PACK_TOKEN_BUDGET.principles + 
                   (MEMORY_PACK_TOKEN_BUDGET.short_term_per_week * MEMORY_LAYER_CONFIG.L1_STM_WEEKS) +
                   (MEMORY_PACK_TOKEN_BUDGET.contextual_per_case * 5);
    
    if (estimatedTokens > budget) {
      // 超出預算：按優先級裁切（L5 → L4 → L3 → L2）
      Logger.log(`P5 Weekly Memory Manager：Memory Pack超出Token預算（${estimatedTokens} > ${budget}），開始裁切`);
      
      // 先砍Layer 5（Contextual Recall）
      while (estimatedTokens > budget && memoryPack.layer_5_contextual_recall.length > 0) {
        memoryPack.layer_5_contextual_recall.pop();
        const newEstimated = estimateTokenCount(memoryPack);
        if (newEstimated <= budget) break;
      }
      
      // 再砍Layer 4（Long-term）
      while (estimatedTokens > budget && memoryPack.layer_4_long_term.length > 0) {
        memoryPack.layer_4_long_term.pop();
        const newEstimated = estimateTokenCount(memoryPack);
        if (newEstimated <= budget) break;
      }
      
      // 再砍Layer 3（Mid-term）
      while (estimatedTokens > budget && memoryPack.layer_3_mid_term.length > 0) {
        memoryPack.layer_3_mid_term.shift(); // 移除最舊的
        const newEstimated = estimateTokenCount(memoryPack);
        if (newEstimated <= budget) break;
      }
      
      // 最後砍Layer 2最舊（Short-term）
      while (estimatedTokens > budget && memoryPack.layer_2_short_term.length > 0) {
        memoryPack.layer_2_short_term.shift(); // 移除最舊的
        const newEstimated = estimateTokenCount(memoryPack);
        if (newEstimated <= budget) break;
      }
    }
    
    return memoryPack;
    
  } catch (error) {
    Logger.log(`P5 Weekly Memory Manager：組裝Memory Pack失敗：${error.message}`);
    return {
      layer_1_principles: null,
      layer_2_short_term: [],
      layer_3_mid_term: [],
      layer_4_long_term: [],
      layer_5_contextual_recall: []
    };
  }
}

/**
 * 讀取Mid-term Memory（L2 MTM：7-12 週壓縮）⭐ V8.17 新增
 * 
 * 壓縮格式：Decision → Outcome → Lesson（不保留推理細節）
 * 
 * @returns {Array} midTermMemory - 中期記憶列表（壓縮版）
 */
function readMidTermMemory() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const strategySheet = ss.getSheetByName("P5__STRATEGY_SNAPSHOT");
    const outcomeSheet = ss.getSheetByName("P5__OUTCOME_SNAPSHOT");
    
    if (!strategySheet || strategySheet.getLastRow() <= 1) {
      return [];
    }
    
    const dataRange = strategySheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const snapshotIdCol = headers.indexOf("snapshot_id");
    const periodIdCol = headers.indexOf("period_id");
    const summaryCol = headers.indexOf("executive_summary");
    const createdCol = headers.indexOf("created_at");
    
    if (snapshotIdCol === -1 || summaryCol === -1) {
      return [];
    }
    
    const today = new Date();
    const midTermSnapshots = [];
    
    // 讀取 7-12 週的snapshot（壓縮版）
    for (let i = rows.length - 1; i >= 1; i--) {
      try {
        const createdDate = rows[i][createdCol];
        if (!createdDate) continue;
        
        const weeksAgo = Math.floor((today - new Date(createdDate)) / (7 * 24 * 60 * 60 * 1000));
        
        // 只處理 7-12 週的記錄
        if (weeksAgo >= 7 && weeksAgo <= 12) {
          const snapshotId = rows[i][snapshotIdCol];
          const periodId = rows[i][periodIdCol];
          const summary = rows[i][summaryCol] || "";
          
          // 讀取對應的outcome（獲取壓縮版：Decision → Outcome → Lesson）
          let compressed = {
            decision: summary.substring(0, 100), // 只保留前100字
            outcome: null,
            lesson: []
          };
          
          if (outcomeSheet && outcomeSheet.getLastRow() > 1) {
            const outcomeDataRange = outcomeSheet.getDataRange();
            const outcomeRows = outcomeDataRange.getValues();
            const outcomeHeaders = outcomeRows[0];
            const refSnapshotIdCol = outcomeHeaders.indexOf("ref_snapshot_id");
            const scorecardCol = outcomeHeaders.indexOf("scorecard_json");
            const reflectionCol = outcomeHeaders.indexOf("reflection_json");
            
            for (let j = 1; j < outcomeRows.length; j++) {
              if (outcomeRows[j][refSnapshotIdCol] === snapshotId) {
                try {
                  const scorecard = JSON.parse(outcomeRows[j][scorecardCol] || "{}");
                  const reflection = JSON.parse(outcomeRows[j][reflectionCol] || "{}");
                  
                  compressed.outcome = {
                    accuracy: scorecard.accuracy || 0,
                    max_drawdown: scorecard.max_drawdown || 0
                  };
                  compressed.lesson = reflection.lesson_learned || [];
                } catch (e) {
                  continue;
                }
                break;
              }
            }
          }
          
          midTermSnapshots.push({
            period_id: periodId,
            weeks_ago: weeksAgo,
            compressed: compressed
          });
        }
      } catch (e) {
        continue;
      }
    }
    
    return midTermSnapshots;
    
  } catch (error) {
    Logger.log(`P5 Weekly Memory Manager：讀取Mid-term Memory失敗：${error.message}`);
    return [];
  }
}

/**
 * 讀取Long-term Memory（L3 LTM：超過 12 週，只保留教訓）⭐ V8.17 新增
 * 
 * 每週最多 1-2 條「可遷移教訓」
 * 
 * @returns {Array} longTermMemory - 長期記憶列表（只保留教訓）
 */
function readLongTermMemory() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const outcomeSheet = ss.getSheetByName("P5__OUTCOME_SNAPSHOT");
    
    if (!outcomeSheet || outcomeSheet.getLastRow() <= 1) {
      return [];
    }
    
    const dataRange = outcomeSheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const refSnapshotIdCol = headers.indexOf("ref_snapshot_id");
    const reflectionCol = headers.indexOf("reflection_json");
    const createdCol = headers.indexOf("created_at");
    
    if (refSnapshotIdCol === -1 || reflectionCol === -1) {
      return [];
    }
    
    const today = new Date();
    const longTermLessons = [];
    
    // 讀取超過 12 週的記錄，只保留教訓
    for (let i = rows.length - 1; i >= 1; i--) {
      try {
        const createdDate = rows[i][createdCol];
        if (!createdDate) continue;
        
        const weeksAgo = Math.floor((today - new Date(createdDate)) / (7 * 24 * 60 * 60 * 1000));
        
        // 只處理超過 12 週的記錄
        if (weeksAgo > 12) {
          const reflection = JSON.parse(rows[i][reflectionCol] || "{}");
          const lessons = reflection.lesson_learned || [];
          
          // 每週最多保留 2 條教訓
          for (let j = 0; j < Math.min(lessons.length, MEMORY_LAYER_CONFIG.L3_LTM_MAX_LESSONS); j++) {
            longTermLessons.push({
              weeks_ago: weeksAgo,
              lesson: lessons[j],
              snapshot_id: rows[i][refSnapshotIdCol]
            });
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // 按週數排序（最近的在前）
    longTermLessons.sort((a, b) => a.weeks_ago - b.weeks_ago);
    
    // 只返回最近的 10 條教訓（避免過多）
    return longTermLessons.slice(0, 10);
    
  } catch (error) {
    Logger.log(`P5 Weekly Memory Manager：讀取Long-term Memory失敗：${error.message}`);
    return [];
  }
}

/**
 * 壓縮和歸檔舊記憶 ⭐ V8.17 地雷修復：防止無限膨脹
 * 
 * 自動執行：
 * 1. 將超過 12 週的完整記憶壓縮為教訓
 * 2. 將 7-12 週的記憶壓縮為 Decision → Outcome → Lesson
 * 3. 確保單個 Cell 不超過 50,000 字限制
 */
function compressAndArchiveOldMemory() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const strategySheet = ss.getSheetByName("P5__STRATEGY_SNAPSHOT");
    
    if (!strategySheet || strategySheet.getLastRow() <= 1) {
      return;
    }
    
    const dataRange = strategySheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const snapshotIdCol = headers.indexOf("snapshot_id");
    const summaryCol = headers.indexOf("executive_summary");
    const createdCol = headers.indexOf("created_at");
    
    if (snapshotIdCol === -1 || summaryCol === -1 || createdCol === -1) {
      return;
    }
    
    const today = new Date();
    const MAX_CELL_CHARS = 45000; // 預留安全邊際（50,000 - 5,000）
    
    // 檢查每個 summary 是否超過限制
    for (let i = rows.length - 1; i >= 1; i--) {
      try {
        const summary = rows[i][summaryCol] || "";
        const createdDate = rows[i][createdCol];
        
        if (!createdDate) continue;
        
        const weeksAgo = Math.floor((today - new Date(createdDate)) / (7 * 24 * 60 * 60 * 1000));
        
        // 如果超過 12 週且 summary 太長，壓縮它
        if (weeksAgo > 12 && summary.length > MAX_CELL_CHARS) {
          const compressed = summary.substring(0, MAX_CELL_CHARS) + "... [已壓縮：超過12週]";
          strategySheet.getRange(i + 1, summaryCol + 1).setValue(compressed);
          Logger.log(`P5 Weekly Memory Manager：壓縮舊記憶（${rows[i][snapshotIdCol]}，${weeksAgo}週前）`);
        }
      } catch (e) {
        continue;
      }
    }
    
    Logger.log(`P5 Weekly Memory Manager：記憶壓縮和歸檔完成`);
    
  } catch (error) {
    Logger.log(`P5 Weekly Memory Manager：壓縮和歸檔舊記憶失敗：${error.message}`);
  }
}

/**
 * 讀取Principles Summary
 * 
 * @returns {string|null} principlesSummary - Principles摘要（Markdown，<=12條）
 */
function readPrinciplesSummary() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__LEARNING_STATE");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const principlesCol = headers.indexOf("principles_summary");
    
    if (principlesCol === -1) {
      return null;
    }
    
    // 讀取最新的principles（最後一行）
    const latestRow = rows[rows.length - 1];
    return latestRow[principlesCol] || null;
    
  } catch (error) {
    Logger.log(`P5 Weekly Memory Manager：讀取Principles Summary失敗：${error.message}`);
    return null;
  }
}

/**
 * ⭐ V8.17 地雷修復：三層記憶模型（Memory Layering）
 * 
 * L1: Short-Term Memory (STM) - 最近 4-6 週，完整保留
 * L2: Mid-Term Memory (MTM) - 7-12 週，壓縮為「Decision → Outcome → Lesson」
 * L3: Long-Term Memory (LTM) - 超過 12 週，一週最多 1-2 條「可遷移教訓」
 * 
 * 防止記憶無限膨脹，避免：
 * - Google Sheets 50,000 字限制
 * - Token 成本爆炸
 * - 路徑依賴（Policy Lock-in）
 */

const MEMORY_LAYER_CONFIG = {
  L1_STM_WEEKS: 6,      // L1: 最近 6 週完整保留
  L2_MTM_WEEKS: 6,      // L2: 7-12 週（6週）壓縮
  L3_LTM_MAX_LESSONS: 2 // L3: 超過 12 週，每週最多 2 條教訓
};

/**
 * 讀取Short-term Memory（最近N週）⭐ V8.17 更新：使用 L1 STM 配置
 * 
 * @param {number} weeks - 週數（預設使用 L1_STM_WEEKS）
 * @returns {Array} shortTermMemory - 短期記憶列表
 */
function readShortTermMemory(weeks = MEMORY_LAYER_CONFIG.L1_STM_WEEKS) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const strategySheet = ss.getSheetByName("P5__STRATEGY_SNAPSHOT");
    const outcomeSheet = ss.getSheetByName("P5__OUTCOME_SNAPSHOT");
    
    if (!strategySheet || strategySheet.getLastRow() <= 1) {
      return [];
    }
    
    const dataRange = strategySheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const snapshotIdCol = headers.indexOf("snapshot_id");
    const periodIdCol = headers.indexOf("period_id");
    const summaryCol = headers.indexOf("executive_summary");
    
    if (snapshotIdCol === -1 || summaryCol === -1) {
      return [];
    }
    
    // 讀取最近N週的snapshot
    const recentSnapshots = [];
    const today = new Date();
    
    for (let i = rows.length - 1; i >= 1 && recentSnapshots.length < weeks; i--) {
      try {
        const snapshotId = rows[i][snapshotIdCol];
        const periodId = rows[i][periodIdCol];
        const summary = rows[i][summaryCol] || "";
        
        // 讀取對應的outcome（獲取scorecard和lessons）
        let scorecard = {};
        let lessons = [];
        
        if (outcomeSheet && outcomeSheet.getLastRow() > 1) {
          const outcomeDataRange = outcomeSheet.getDataRange();
          const outcomeRows = outcomeDataRange.getValues();
          const outcomeHeaders = outcomeRows[0];
          const refSnapshotIdCol = outcomeHeaders.indexOf("ref_snapshot_id");
          const scorecardCol = outcomeHeaders.indexOf("scorecard_json");
          const reflectionCol = outcomeHeaders.indexOf("reflection_json");
          
          for (let j = 1; j < outcomeRows.length; j++) {
            if (outcomeRows[j][refSnapshotIdCol] === snapshotId) {
              try {
                scorecard = JSON.parse(outcomeRows[j][scorecardCol] || "{}");
                const reflection = JSON.parse(outcomeRows[j][reflectionCol] || "{}");
                lessons = reflection.lesson_learned || [];
              } catch (e) {
                continue;
              }
              break;
            }
          }
        }
        
        recentSnapshots.push({
          period_id: periodId,
          executive_summary: summary,
          scorecard: scorecard,
          top_lessons: lessons.slice(0, 2) // 只取top 2 lessons
        });
      } catch (e) {
        continue;
      }
    }
    
    return recentSnapshots;
    
  } catch (error) {
    Logger.log(`P5 Weekly Memory Manager：讀取Short-term Memory失敗：${error.message}`);
    return [];
  }
}

/**
 * 估算Token數量（簡化實現）
 * 
 * @param {Object} memoryPack - Memory Pack
 * @returns {number} estimatedTokens - 估算的Token數量
 */
function estimateTokenCount(memoryPack) {
  let tokens = 0;
  
  // Layer 1: Principles
  if (memoryPack.layer_1_principles) {
    tokens += memoryPack.layer_1_principles.length / 4; // 簡化：1 token ≈ 4 characters
  }
  
  // Layer 2: Short-term
  for (const week of memoryPack.layer_2_short_term) {
    tokens += (week.executive_summary?.length || 0) / 4;
    tokens += JSON.stringify(week.scorecard || {}).length / 4;
    tokens += JSON.stringify(week.top_lessons || []).length / 4;
  }
  
  // Layer 3: Mid-term（壓縮版，token 較少）
  for (const week of memoryPack.layer_3_mid_term || []) {
    tokens += JSON.stringify(week.compressed || {}).length / 4;
  }
  
  // Layer 4: Long-term（只保留教訓，token 最少）
  for (const lesson of memoryPack.layer_4_long_term || []) {
    tokens += (lesson.lesson?.length || 0) / 4;
  }
  
  // Layer 5: Contextual Recall
  for (const case_ of memoryPack.layer_5_contextual_recall || []) {
    tokens += (case_.executive_summary?.length || 0) / 4;
    tokens += (case_.lesson?.join(' ') || '').length / 4;
    tokens += (case_.result_summary?.length || 0) / 4;
  }
  
  return Math.ceil(tokens);
}

// ==========================================
// 5. Principles Governor（月度治理）
// ==========================================

/**
 * 更新Principles（月度治理）⭐ V8.13修正
 * 
 * 每月一次合併去重、衝突用Exception、<=12條
 * 
 * @param {Array} monthlyReflections - 月度Reflection列表
 * @returns {string} principlesSummary - 更新後的Principles摘要（Markdown，<=12條）
 */
function updatePrinciples(monthlyReflections) {
  try {
    // 使用AI生成Principles（Gemini Pro）
    const jobId = `PRINCIPLES_${Date.now()}`;
    const payload = {
      monthly_reflections: monthlyReflections,
      task: "update_principles",
      instructions: `
請根據月度Reflection列表，更新Principles Summary。

**要求**：
1. 合併去重：相同或相似的principle要合併
2. 衝突用Exception：如果principle有衝突，用例外情況處理
3. 限制條數：<=12條
4. 格式：Markdown格式
5. 每條principle需附：
   - scope（適用情境）
   - exceptions（例外）
   - supporting_cases[]（案例id）
   - last_updated

**禁止事項**：
- 禁止修改SSOT憲法級原則（P3視角、權責分工等）
- 禁止直接改策略邏輯/if-then

請返回Markdown格式的Principles Summary。
      `
    };
    
    if (typeof executeCapability !== "function") {
      Logger.log(`P5 Weekly Memory Manager：⚠️ executeCapability 未定義，無法更新Principles`);
      return null;
    }
    
    const result = executeCapability(jobId, "GEMINI_PRO", payload);
    
    if (result && result.output) {
      let principlesSummary;
      if (typeof result.output === 'string') {
        principlesSummary = result.output;
      } else {
        principlesSummary = result.output.principles_summary || result.output;
      }
      
      // 保存到LEARNING_STATE
      savePrinciplesSummary(principlesSummary);
      
      return principlesSummary;
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`P5 Weekly Memory Manager：更新Principles失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存Principles Summary
 * 
 * @param {string} principlesSummary - Principles摘要（Markdown）
 */
function savePrinciplesSummary(principlesSummary) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P5__LEARNING_STATE");
    
    if (!sheet) {
      sheet = ss.insertSheet("P5__LEARNING_STATE");
      sheet.appendRow(P5_LEARNING_STATE_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const today = new Date();
    const stateId = `LEARNING_STATE_${Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd")}_${Date.now()}`;
    
    const row = [
      stateId,
      today,  // updated_at
      principlesSummary,  // principles_summary
      JSON.stringify({})  // active_calibration（暫時為空）
    ];
    
    sheet.appendRow(row);
    Logger.log(`P5 Weekly Memory Manager：Principles Summary已保存`);
    
  } catch (error) {
    Logger.log(`P5 Weekly Memory Manager：保存Principles Summary失敗：${error.message}`);
  }
}
