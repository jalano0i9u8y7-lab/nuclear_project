/**
 * 📊 P5 Weekly: 主執行函數（重構版）
 * 
 * 整合所有 P5 Weekly 模組：
 * - 數據收集（24_P5_WEEKLY_DATA.js）
 * - 宏觀世界觀分析（24_P5_WEEKLY_WORLDVIEW.js）
 * - 事件監控與觸發（24_P5_WEEKLY_EVENTS.js）
 * - 個股策略生成（24_P5_WEEKLY_STOCK_STRATEGY.js，帶 Batch 機制）
 * - 學習機制（24_P5_WEEKLY_LEARNING.js）
 * - Prompt 構建（24_P5_WEEKLY_PROMPT.js）
 * 
 * ⭐ V8.15 新增模組：
 * - 雙層 AI 架構（24_P5_WEEKLY_DUAL_LAYER.js）
 * - Strategy Skeleton（24_P5_WEEKLY_STRATEGY_SKELETON.js）
 * - 最終產出格式（24_P5_WEEKLY_FINAL_OUTPUT.js）
 * 
 * @version SSOT V8.15
 * @date 2026-01-19
 */

// ==========================================
// P5 Weekly 主執行函數（重構版）
// ==========================================

/**
 * P5 Weekly 主執行函數（重構版，整合所有模組）
 * 
 * @param {Object} params - 執行參數
 * @param {string} params.trigger - 觸發來源（WEEKLY / MANUAL）
 * @param {Object} params.context - 上下文
 * @returns {Object} result - 執行結果
 */
function P5_Weekly_Execute(params) {
  try {
    Logger.log(`P5 Weekly 執行開始（重構版）：trigger=${params.trigger}`);
    
    // ========================================
    // Step 1: 檢查執行前確認
    // ========================================
    
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
    
    // ========================================
    // Step 2: 檢查決策權限（在收集籌碼面數據後，結合籌碼面信號評估 DEFCON）⭐ V8.0 調整
    // ========================================
    
    // 先收集籌碼面數據（用於 DEFCON 評估）
    Logger.log("P5 Weekly：先收集籌碼面數據（用於 DEFCON 評估）");
    const smartMoneyDataForDEFCON = collectSmartMoneyDataWeekly({
      holdings: getHoldingsTickers(),
      trigger: params.trigger
    });
    
    // 結合籌碼面信號評估 DEFCON ⭐ V8.0 新增
    const marketDataForDEFCON = {
      derivatives: getWeeklyDerivativesSummary(),
      macro_data: collectP5WeeklyAllData({ macroDays: 7 }).macro_data || {}
    };
    const defconResult = calculateDEFCON(marketDataForDEFCON, smartMoneyDataForDEFCON.smart_money_signal);
    const defcon = defconResult.defcon_level || "DEFCON_5";
    const p4_6_triggered = isP4_6Triggered();  // 從 P4.6 模組讀取
    
    const decisionContext = {
      defcon: defcon.defcon_level || "DEFCON_5",
      defcon_risk_score: defcon.risk_score || 0,
      smart_money_signal: smartMoneyDataForDEFCON.smart_money_signal || "NEUTRAL",  // ⭐ V8.0 新增
      p4_6_triggered: p4_6_triggered
    };
    
    if (!checkP5DecisionHierarchy("WEEKLY", decisionContext)) {
      Logger.log("P5 Weekly：決策權限檢查未通過，執行受限");
      return {
        status: "RESTRICTED",
        reason: "決策權限檢查未通過",
        defcon: defcon.defcon_level,
        smart_money_signal: smartMoneyDataForDEFCON.smart_money_signal,
        p4_6_triggered: p4_6_triggered
      };
    }
    
    // ========================================
    // Step 3: P2/P2.5/P3 統一調度器 ⭐ V8.0 新增
    // ========================================
    
    Logger.log("P5 Weekly：開始 P2/P2.5/P3 統一調度");
    const unifiedSchedulerResult = executeP2P25P3UnifiedScheduler({
      trigger: "P5_WEEKLY",
      context: params.context || {}
    });
    
    Logger.log(`P5 Weekly：統一調度完成 - P2: ${unifiedSchedulerResult.p2_status}, P2.5: ${unifiedSchedulerResult.p2_5_status}, P3: ${unifiedSchedulerResult.p3_status}`);
    
    // ========================================
    // Step 4: 使用已收集的籌碼面數據（已在 Step 2 收集用於 DEFCON 評估）
    // ========================================
    
    const smartMoneyData = smartMoneyDataForDEFCON;  // 重用已收集的數據
    
    // ========================================
    // Step 5: 收集所有數據（使用 24_P5_WEEKLY_DATA.js）
    // ========================================
    
    Logger.log("P5 Weekly：開始收集所有數據");
    const allData = collectP5WeeklyAllData({
      macroDays: 7,
      worldviewWeeks: 4,
      learningWeeks: 4,
      p2_snapshot_id: unifiedSchedulerResult.p2_snapshot_id,
      p2_5_snapshot_id: unifiedSchedulerResult.p2_5_snapshot_id,
      p3_snapshot_id: unifiedSchedulerResult.p3_snapshot_id,
      smart_money_data: smartMoneyData  // ⭐ V8.0 新增：籌碼面數據
    });
    
    // ========================================
    // Step 5.5: ⭐ V8.13 新增：比對上一週的策略與市場真實反應（動態學習系統核心）
    // ========================================
    
    Logger.log("P5 Weekly V8.13：開始比對上一週的策略與市場真實反應");
    let previousWeekStrategyComparison = null;
    try {
      // ⭐ V8.13修正：移除V7設計的錯誤方向，使用現有版本
      previousWeekStrategyComparison = compareStrategyWithReality(1);
      
      if (previousWeekStrategyComparison && previousWeekStrategyComparison.strategies_compared > 0) {
        Logger.log(`P5 Weekly V8.13：策略比對完成 - 對齊率：${((previousWeekStrategyComparison.performance_summary?.alignment_rate || 0) * 100).toFixed(1)}%，對齊：${previousWeekStrategyComparison.aligned_strategies?.length || 0}，未對齊：${previousWeekStrategyComparison.misaligned_strategies?.length || 0}`);
        
        // 保存比對結果到學習日誌（作為前一週的策略比對紀錄）
        saveStrategyComparisonToLearningLog(previousWeekStrategyComparison, "WEEKLY");
      } else {
        Logger.log("P5 Weekly V8.13：無上一週的策略數據可對照（可能是首次執行）");
      }
    } catch (error) {
      Logger.log(`P5 Weekly V8.13：策略比對失敗：${error.message}（不中斷主流程）`);
      // 不中斷主流程，只記錄錯誤
    }
    
    // ========================================
    // Step 6: 宏觀世界觀分析（使用 24_P5_WEEKLY_WORLDVIEW.js）⭐ V8.0 增強：加入籌碼面週報
    // ========================================
    
    Logger.log("P5 Weekly：開始宏觀世界觀分析（包含籌碼面週報）");
    const worldview = analyzeWeeklyWorldview({
      macroData: allData.macro_data,
      worldviewHistory: allData.worldview_history,
      learningLogHistory: allData.learning_log_history,
      weeklyMarketData: collectWeeklyMarketData(),  // 從現有函數獲取
      smartMoneyData: smartMoneyData  // ⭐ V8.0 新增：籌碼面數據
    });
    
    // ⭐ V8.19 實戰模擬五：Cash is a Position — 儲存世界觀供 P4 Market Climate Override 使用
    try {
      const sig = (worldview && worldview.weekly_worldview && worldview.weekly_worldview.overall_signal) 
        ? worldview.weekly_worldview.overall_signal 
        : "NEUTRAL";
      PropertiesService.getDocumentProperties().setProperty("P5_LATEST_WORLDVIEW_OVERRIDE", JSON.stringify({ overall_signal: sig }));
      Logger.log("P5 Weekly V8.19：已寫入 P5_LATEST_WORLDVIEW_OVERRIDE（overall_signal=" + sig + "）");
    } catch (e) {
      Logger.log("P5 Weekly：寫入 P5_LATEST_WORLDVIEW_OVERRIDE 失敗：" + (e.message || e));
    }
    
    // ========================================
    // Step 6: 事件監控與觸發（使用 24_P5_WEEKLY_EVENTS.js）
    // ========================================
    
    Logger.log("P5 Weekly：開始事件監控與觸發");
    const events = scanUpcomingEventsAndTrigger({
      scanDate: new Date(),
      holdings: getHoldingsTickers(),
      worldview: worldview
    });
    
    // ========================================
    // Step 7: 獲取所有持股
    // ========================================
    
    const tickers = getHoldingsTickers();
    Logger.log(`P5 Weekly：獲取到 ${tickers.length} 檔持股`);
    
    if (tickers.length === 0) {
      Logger.log("P5 Weekly：無持股，跳過個股策略生成");
      return {
        status: "NO_HOLDINGS",
        message: "無持股需要分析"
      };
    }
    
    // ========================================
    // Step 7.5: 計算完整技術指標（使用 24_P5_WEEKLY_TECHNICAL.js）⭐ V8.0 新增
    // ========================================
    
    Logger.log(`P5 Weekly：開始計算完整技術指標（${tickers.length} 檔）`);
    const fullTechnicalIndicators = calculateFullTechnicalIndicatorsWeekly(tickers);
    
    // ========================================
    // Step 8: 分批生成個股策略（使用 24_P5_WEEKLY_STOCK_STRATEGY.js，帶 Batch 機制）
    // ========================================
    
    // ⭐ V8.12 新增：讀取優化後的索引和波動度數據
    Logger.log("P5 Weekly V8.12：讀取優化後的索引和波動度數據");
    const stockNewsIndex = getStockNewsIndexForWeek(tickers);
    const sectorNewsIndex = getSectorNewsIndexForWeek();
    const eventsIndex = getEventsIndexForWeek(tickers);
    const macroWeeklyMetrics = getMacroWeeklyMetrics();
    const technicalWeeklyMetrics = getTechnicalWeeklyMetrics(tickers);
    
    Logger.log(`P5 Weekly V8.12：索引數據讀取完成 - 個股新聞：${Object.keys(stockNewsIndex).length}，板塊/產業：${Object.keys(sectorNewsIndex).length}，事件：${Object.keys(eventsIndex).length}，技術指標：${Object.keys(technicalWeeklyMetrics).length}`);
    
    Logger.log(`P5 Weekly V8.15：開始雙層 AI 架構執行（共 ${tickers.length} 檔）`);
    
    // ⭐ V8.17 地雷修復：可重入設計（防止 6 分鐘斷頭台）
    const weekId = getCurrentWeekId();
    const processedState = loadProcessedTickers(weekId);
    
    // 過濾已處理的股票
    const remainingTickers = tickers.filter(ticker => !processedState.processed.includes(ticker));
    const skippedTickers = tickers.filter(ticker => processedState.processed.includes(ticker));
    
    if (skippedTickers.length > 0) {
      Logger.log(`P5 Weekly 可重入：跳過 ${skippedTickers.length} 檔已處理股票：${skippedTickers.join(', ')}`);
    }
    
    if (remainingTickers.length === 0) {
      Logger.log(`P5 Weekly 可重入：所有股票已處理完成，檢查是否標記週次為完成`);
      
      // 檢查是否所有股票都處理完成
      if (checkAllTickersCompleted(weekId, tickers)) {
        markWeeklyDone(weekId);
        return {
          status: "ALREADY_COMPLETED",
          week_id: weekId,
          message: "所有股票已處理完成"
        };
      }
    }
    
    Logger.log(`P5 Weekly 可重入：剩餘 ${remainingTickers.length} 檔股票待處理`);
    
    // ⭐ V8.15 新增：雙層 AI 架構
    // Step 1: P5-B（每檔都跑，低成本）
    const contextForDualLayer = {
      allSnapshots: {
        p0_snapshot: allData.p0_snapshot,
        p0_5_snapshot: allData.p0_5_snapshot,  // ⭐ V8.15 新增
        p0_7_snapshot: allData.p0_7_snapshot,
        p1_snapshot: allData.p1_snapshot,
        p2_snapshot: allData.p2_snapshot,
        p2_5_snapshot: allData.p2_5_snapshot,  // ⭐ V8.15 新增
        p3_snapshot: allData.p3_snapshot,
        p4_snapshot: allData.p4_snapshot
      },
      p6_weekly_summary: allData.p6_weekly_summary,  // ⭐ V8.15 新增：P6 週度摘要（頻率趨勢）
      calendar: allData.calendar,  // ⭐ V8.15 新增
      p5_weekly_calendar: allData.calendar,  // ⭐ V8.0 新增：明確標記為 p5_weekly_calendar（用於 P5-B/A 策略生成）
      // ⭐ V8.0 新增：當週事件和高優先級事件（最高權重）
      current_week_events: allData.calendar?.current_week_events || [],  // 當週事件（最高權重）
      high_priority_events: allData.calendar?.high_priority_events || [],  // 高優先級事件（14天內）
      macro_flow_context: allData.macro_flow_context,  // ⭐ V8.15 新增：Sector ETF Flow 與 Mag 7 分析
      learning_feedback: allData.learning_feedback,  // ⭐ V8.15 新增：動態學習系統反饋
      learning_state: getLatestLearningState(allData.learning_log_history),  // ⭐ V8.19 實戰模擬三：Learning 斷鏈修復
      learning_params: getLatestLearningState(allData.learning_log_history).learning_params || {}  // ⭐ V8.19 新增：學習參數注入
    };
    
    // ⭐ V8.19 新增：檢查 Safety Lock（在決策前檢查）
    for (const ticker of remainingTickers) {
      try {
        const stockContext = integrateStockFactors(ticker, contextForDualLayer);
        const safetyLockResult = checkSafetyLock(contextForDualLayer, stockContext);
        
        if (safetyLockResult.safety_lock_active) {
          Logger.log(`[${ticker}] Safety Lock 觸發：${safetyLockResult.reason}`);
          // 將 Safety Lock 結果注入到 context，供硬約束檢查使用
          stockContext.safety_lock_active = true;
          stockContext.safety_lock_max_exposure = safetyLockResult.max_exposure;
        }
      } catch (error) {
        Logger.log(`檢查 ${ticker} Safety Lock 失敗：${error.message}`);
      }
    }
    
    // 執行 P5-B（只處理剩餘股票）
    const p5BExecuteResult = P5_B_Execute(remainingTickers, {
      ...contextForDualLayer,
      dailyData: {
        ohlcv: getWeeklyOHLCVSummary(),
        technical_indicators: fullTechnicalIndicators,
        derivatives: getWeeklyDerivativesSummary(),
        institutional_data: collectInstitutionalDataWeekly()
      },
      worldview: worldview,
      events: events,
      smartMoneyData: smartMoneyData,
      stockNewsIndex: stockNewsIndex,
      sectorNewsIndex: sectorNewsIndex,
      eventsIndex: eventsIndex,
      macroWeeklyMetrics: macroWeeklyMetrics,
      technicalWeeklyMetrics: technicalWeeklyMetrics
    });
    
    // ⭐ V8.17 新增：處理 Batch API 結果
    let p5BResults = {};
    if (p5BExecuteResult.status === "SUBMITTED_BATCH") {
      Logger.log(`P5 Weekly：P5-B 使用 Batch API，等待結果處理（batch_id=${p5BExecuteResult.batch_id}）`);
      // 等待 Batch 完成並處理結果
      const batchProcessResult = P5_B_ProcessBatchResults(
        p5BExecuteResult.batch_id,
        {
          ...contextForDualLayer,
          dailyData: {
            ohlcv: getWeeklyOHLCVSummary(),
            technical_indicators: fullTechnicalIndicators,
            derivatives: getWeeklyDerivativesSummary(),
            institutional_data: collectInstitutionalDataWeekly()
          },
          worldview: worldview,
          events: events,
          smartMoneyData: smartMoneyData,
          stockNewsIndex: stockNewsIndex,
          sectorNewsIndex: sectorNewsIndex,
          eventsIndex: eventsIndex,
          macroWeeklyMetrics: macroWeeklyMetrics,
          technicalWeeklyMetrics: technicalWeeklyMetrics
        }
      );
      p5BResults = batchProcessResult.results || {};
    } else {
      // 同步 API 結果（直接使用）
      p5BResults = p5BExecuteResult;
    }
    
    // Step 2: 篩選需要升級到 P5-A 的股票
    const escalatedTickers = [];
    for (const ticker of tickers) {
      const p5BResult = p5BResults[ticker];
      if (p5BResult && p5BResult.escalation_result && p5BResult.escalation_result.should_escalate) {
        escalatedTickers.push(ticker);
      }
    }
    
    Logger.log(`P5 Weekly V8.15：P5-B 完成，${escalatedTickers.length} 檔股票需要升級到 P5-A（${((escalatedTickers.length / tickers.length) * 100).toFixed(1)}%）`);
    
    // Step 3: P5-A（僅升級少數）
    let p5AResults = {};
    if (escalatedTickers.length > 0) {
      const p5AExecuteResult = P5_A_Execute(escalatedTickers, {
        ...contextForDualLayer,
        dailyData: {
          ohlcv: getWeeklyOHLCVSummary(),
          technical_indicators: fullTechnicalIndicators,
          derivatives: getWeeklyDerivativesSummary(),
          institutional_data: collectInstitutionalDataWeekly()
        },
        worldview: worldview,
        events: events,
        smartMoneyData: smartMoneyData,
        stockNewsIndex: stockNewsIndex,
        sectorNewsIndex: sectorNewsIndex,
        eventsIndex: eventsIndex,
        macroWeeklyMetrics: macroWeeklyMetrics,
        technicalWeeklyMetrics: technicalWeeklyMetrics
      }, p5BResults);
      
      // ⭐ V8.17 新增：處理 Batch API 結果
      if (p5AExecuteResult.status === "SUBMITTED_BATCH") {
        Logger.log(`P5 Weekly：P5-A 使用 Batch API，等待結果處理（batch_id=${p5AExecuteResult.batch_id}）`);
        // 等待 Batch 完成並處理結果
        const batchProcessResult = P5_A_ProcessBatchResults(
          p5AExecuteResult.batch_id,
          {
            ...contextForDualLayer,
            dailyData: {
              ohlcv: getWeeklyOHLCVSummary(),
              technical_indicators: fullTechnicalIndicators,
              derivatives: getWeeklyDerivativesSummary(),
              institutional_data: collectInstitutionalDataWeekly()
            },
            worldview: worldview,
            events: events,
            smartMoneyData: smartMoneyData,
            stockNewsIndex: stockNewsIndex,
            sectorNewsIndex: sectorNewsIndex,
            eventsIndex: eventsIndex,
            macroWeeklyMetrics: macroWeeklyMetrics,
            technicalWeeklyMetrics: technicalWeeklyMetrics
          },
          p5BResults
        );
        p5AResults = batchProcessResult.results || {};
      } else {
        // 同步 API 結果（直接使用）
        p5AResults = p5AExecuteResult;
      }
    }
    
    // Step 4: 合併 P5-B 和 P5-A 結果，並應用硬約束
    // ⭐ V8.17 地雷修復：使用可重入處理，每檔股票都是原子操作
    // ⭐ V8.19 新增：整合三層決策架構（硬約束檢查）
    const stockStrategies = {};
    for (const ticker of remainingTickers) {
      try {
        // ⭐ V8.17 地雷修復：可重入處理單檔股票
        let tickerResult = processTickerReentrant(
          weekId,
          ticker,
          (ticker, context) => {
            // 處理函數：合併 P5-B 和 P5-A 結果
            let aiOutput;
            if (p5AResults[ticker]) {
              // 使用 P5-A 結果（深度重評估）
              aiOutput = {
                ...p5BResults[ticker],
                ...p5AResults[ticker],
                evaluation_layer: "P5_A",
                escalation_reason: p5BResults[ticker].escalation_result?.reasons || []
              };
            } else {
              // 使用 P5-B 結果（輕量評估）
              aiOutput = {
                ...p5BResults[ticker],
                evaluation_layer: "P5_B"
              };
            }
            
            // ⭐ V8.19 新增：應用硬約束檢查
            const stockContext = integrateStockFactors(ticker, contextForDualLayer);
            const constraintCheck = enforceHardConstraints(stockContext, aiOutput);
            
            if (constraintCheck.hasViolations) {
              Logger.log(`[${ticker}] 檢測到硬約束違反：${JSON.stringify(constraintCheck.violations.map(v => v.constraint).join(", "))}`);
              aiOutput = applyHardConstraints(aiOutput, constraintCheck.enforcedAdjustments, stockContext);
              aiOutput.constraints_applied = constraintCheck.violations;
            }
            
            return aiOutput;
          },
          {
            p5BResults: p5BResults,
            p5AResults: p5AResults,
            contextForDualLayer: contextForDualLayer  // ⭐ V8.19 新增：傳遞 context 供硬約束檢查使用
          }
        );
        
        if (!tickerResult.skipped) {
          stockStrategies[ticker] = tickerResult;
        }
      } catch (error) {
        Logger.log(`處理股票失敗（${ticker}）：${error.message}`);
        // 繼續處理下一檔股票（不中斷整個流程）
      }
    }
    
    // 合併已處理的股票結果（從之前的執行中恢復）
    for (const ticker of skippedTickers) {
      // 從處理狀態中讀取已完成的結果
      const processedState = loadProcessedTickers(weekId);
      // 這裡可以從結果表格中讀取已處理的結果
      // 簡化實現：跳過已處理的股票
    }
    
    // 舊版邏輯（保留作為備用）
    for (const ticker of remainingTickers) {
      if (stockStrategies[ticker]) {
        continue; // 已由可重入處理完成
      }
      
      // 舊版合併邏輯（備用）
      if (p5AResults[ticker]) {
        // 使用 P5-A 結果（深度重評估）
        stockStrategies[ticker] = {
          ...p5BResults[ticker],
          ...p5AResults[ticker],
          evaluation_layer: "P5_A",
          escalation_reason: p5BResults[ticker].escalation_result?.reasons || []
        };
      } else {
        // 使用 P5-B 結果（輕量評估）
        stockStrategies[ticker] = {
          ...p5BResults[ticker],
          evaluation_layer: "P5_B"
        };
      }
    }
    
    // ⭐ V8.15 保留：舊版 generateStockStrategiesInBatches（向後兼容）
    // 如果雙層架構失敗，回退到舊版
    if (Object.keys(stockStrategies).length === 0) {
      Logger.log("P5 Weekly V8.15：雙層架構失敗，回退到舊版 generateStockStrategiesInBatches");
      const fallbackStockStrategies = generateStockStrategiesInBatches(tickers, {
        allSnapshots: {
          p0_snapshot: allData.p0_snapshot,
          p0_5_snapshot: allData.p0_5_snapshot,  // ⭐ V8.15 新增
          p0_7_snapshot: allData.p0_7_snapshot,
          p1_snapshot: allData.p1_snapshot,
          p2_snapshot: allData.p2_snapshot,
          p2_5_snapshot: allData.p2_5_snapshot,  // ⭐ V8.15 新增
          p3_snapshot: allData.p3_snapshot,
          p4_snapshot: allData.p4_snapshot
        },
        dailyData: {
          ohlcv: getWeeklyOHLCVSummary(),
          technical_indicators: fullTechnicalIndicators,  // ⭐ V8.0：使用完整技術指標
          derivatives: getWeeklyDerivativesSummary(),
          institutional_data: collectInstitutionalDataWeekly()
        },
        worldview: worldview,
        events: events,
        smartMoneyData: smartMoneyData,  // ⭐ V8.0 新增：籌碼面數據
        // ⭐ V8.12 新增：優化後的索引和波動度數據
        stockNewsIndex: stockNewsIndex,
        sectorNewsIndex: sectorNewsIndex,
        eventsIndex: eventsIndex,
        macroWeeklyMetrics: macroWeeklyMetrics,
        technicalWeeklyMetrics: technicalWeeklyMetrics
      });
      // 合併回退結果
      Object.assign(stockStrategies, fallbackStockStrategies);
    }
    
    // ========================================
    // Step 8.5: ⭐ V8.13新增：組裝Memory Pack（歷史學習經驗）
    // ========================================
    
    Logger.log("P5 Weekly V8.13：開始組裝Memory Pack（歷史學習經驗）");
    let memoryPack = null;
    try {
      // 生成當前市場標籤
      const currentMarketTags = typeof generateMarketTags === "function" 
        ? generateMarketTags(allData.macro_data, worldview)
        : [];
      
      const currentContext = {
        market_tags: currentMarketTags,
        worldview: worldview,
        events: events,
        macro_data: allData.macro_data
      };
      
      // 組裝Memory Pack
      if (typeof buildWeeklyMemoryPack === "function") {
        memoryPack = buildWeeklyMemoryPack(currentContext);
        Logger.log(`P5 Weekly V8.13：Memory Pack組裝完成 - Principles: ${memoryPack.layer_1_principles ? '有' : '無'}, Short-term: ${memoryPack.layer_2_short_term.length}週, Contextual: ${memoryPack.layer_3_contextual_recall.length}案例`);
      } else {
        Logger.log("P5 Weekly V8.13：⚠️ buildWeeklyMemoryPack 未定義，跳過Memory Pack組裝");
      }
    } catch (error) {
      Logger.log(`P5 Weekly V8.13：組裝Memory Pack失敗：${error.message}（不中斷主流程）`);
      // 不中斷主流程，只記錄錯誤
    }
    
    // ========================================
    // Step 9: 構建整合 Prompt（使用 24_P5_WEEKLY_PROMPT.js）
    // ========================================
    
    Logger.log("P5 Weekly：構建整合 Prompt");
    const integratedPrompt = buildP5WeeklyIntegratedPrompt({
      worldview: worldview,
      events: events,
      stockStrategies: stockStrategies,
      allData: allData,
      memoryPack: memoryPack  // ⭐ V8.13新增：Memory Pack（歷史學習經驗）
    });
    
    // ========================================
    // Step 8.5: P2 Milestones 自動對帳 ⭐ V8.17 新增
    // ========================================
    
    Logger.log("P5 Weekly V8.17：開始 P2 Milestones 自動對帳");
    try {
      // 收集所有股票的 P2 V8.15 欄位
      const allP2V8_15Fields = {};
      for (const ticker of tickers) {
        allP2V8_15Fields[ticker] = extractP2V8_15Fields(ticker);
      }
      
      // 整合 Milestones 對帳結果
      stockStrategies = integrateMilestoneVerification(stockStrategies, {
        ...contextForDualLayer,
        p2_v8_15_fields: allP2V8_15Fields,
        stockNewsIndex: stockNewsIndex,
        revenue_data: revenueData,
        earnings_data: revenueData  // 簡化：使用 revenueData 作為 earnings_data
      });
      
      Logger.log("P5 Weekly V8.17：P2 Milestones 自動對帳完成");
    } catch (error) {
      Logger.log(`P5 Weekly V8.17：P2 Milestones 自動對帳失敗：${error.message}`);
      // 不中斷執行，繼續後續步驟
    }
    
    // ========================================
    // Step 9.5: ⭐ V8.15 新增：生成最終產出格式（對齊 IB 批次下單）
    // ========================================
    
    Logger.log("P5 Weekly V8.15：生成最終產出格式（weekly_trade_actions）");
    let weeklyTradeActions = null;
    try {
      // 獲取完整的技術指標數據（如果尚未獲取）
      let technicalIndicatorsForOutput = fullTechnicalIndicators;
      if (!technicalIndicatorsForOutput) {
        technicalIndicatorsForOutput = getWeeklyTechnicalIndicatorsSummary();
      }
      
      // ⭐ V8.17 地雷修復：檢查是否所有股票處理完成
      const allTickersProcessed = checkAllTickersCompleted(weekId, tickers);
      
      if (!allTickersProcessed) {
        Logger.log(`P5 Weekly 可重入：尚未完成所有股票處理（${weekId}），不生成最終產出`);
        return {
          status: "PARTIAL_COMPLETED",
          week_id: weekId,
          processed_count: Object.keys(stockStrategies).length,
          total_count: tickers.length,
          message: "部分股票處理完成，請等待下次執行完成剩餘股票"
        };
      }
      
      weeklyTradeActions = generateWeeklyTradeActions(stockStrategies, {
        current_positions: allData.current_positions,
        open_orders: allData.open_orders,
        dailyData: {
          ohlcv: getWeeklyOHLCVSummary(),
          technical_indicators: technicalIndicatorsForOutput
        }
      });
      Logger.log(`P5 Weekly V8.15：最終產出生成完成 - 共 ${weeklyTradeActions.weekly_trade_actions.length} 檔股票`);
    } catch (error) {
      Logger.log(`P5 Weekly V8.15：生成最終產出失敗：${error.message}（不中斷主流程）`);
      // 不中斷主流程，只記錄錯誤
    }
    
    // ========================================
    // Step 10: 提交到 M0 Job Queue（宏觀分析）
    // ========================================
    
    const m0InputPayload = {
      phase: "P5_WEEKLY",
      frequency: "WEEKLY",
      trigger: params.trigger,
      prompt: integratedPrompt,
      worldview: worldview,
      events: events,
      stock_strategies: stockStrategies,
      all_snapshots: allData,
      context: params.context || {},
      weekly_trade_actions: weeklyTradeActions  // ⭐ V8.15 新增：最終產出格式
    };
    
    const requestedFlow = ["SONNET", "GPT"];  // Sonnet 執行，GPT 審查
    const jobId_final = submitP5ToM0JobQueue("P5_WEEKLY", requestedFlow, m0InputPayload);
    
    Logger.log(`P5 Weekly：已提交到 M0 Job Queue（job_id=${jobId_final}）`);
    
    return {
      status: "SUBMITTED",
      job_id: jobId_final,
      frequency: "WEEKLY",
      tickers_analyzed: tickers.length,
      stock_strategies_count: Object.keys(stockStrategies).length,
      worldview_analyzed: !!worldview,
      events_scanned: events.upcoming_events?.length || 0,
      weekly_trade_actions: weeklyTradeActions  // ⭐ V8.15 新增：最終產出格式
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly 執行失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
    throw error;
  }
}

// ==========================================
// P2/P2.5/P3 統一調度器 ⭐ V8.0 新增
// ==========================================

/**
 * P2/P2.5/P3 統一調度器
 * 
 * 確保 P2 和 P2.5 都完成後才觸發 P3，避免競態條件
 * 
 * @param {Object} params - 參數
 * @param {string} params.trigger - 觸發來源（P5_WEEKLY / P5_MONTHLY）
 * @param {Object} params.context - 上下文
 * @returns {Object} result - 調度結果
 */
function executeP2P25P3UnifiedScheduler(params) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P2/P2.5/P3 統一調度器開始：trigger=${params.trigger}`);
    
    // ========================================
    // Step 1: 檢查是否需要執行 P2 和 P2.5
    // ========================================
    
    // 讀取最新快照，判斷是否需要重新執行
    const latestP2Snapshot = getLatestP2Snapshot();
    const latestP2_5Snapshot = getLatestP2_5Snapshot();
    const latestP1Snapshot = getLatestP1Snapshot();
    
    // 判斷邏輯：如果 P1 有更新，或 P2/P2.5 快照不存在，需要重新執行
    const p1SnapshotId = latestP1Snapshot?.snapshot_id || null;
    const p2SnapshotId = latestP2Snapshot?.snapshot_id || null;
    const p2_5SnapshotId = latestP2_5Snapshot?.snapshot_id || null;
    
    const needP2 = !p2SnapshotId || (p1SnapshotId && latestP2Snapshot?.p1_snapshot_id !== p1SnapshotId);
    const needP2_5 = !p2_5SnapshotId || (p1SnapshotId && latestP2_5Snapshot?.p1_snapshot_id !== p1SnapshotId);
    
    Logger.log(`P2/P2.5/P3 統一調度器：需要執行 P2=${needP2}, P2.5=${needP2_5}`);
    
    // ========================================
    // Step 2: 執行 P2（如果需要）
    // ========================================
    
    let p2Result = null;
    let p2SnapshotId_final = p2SnapshotId;
    
    if (needP2) {
      Logger.log("P2/P2.5/P3 統一調度器：開始執行 P2");
      try {
        p2Result = P2_Monthly_Execute({
          trigger: params.trigger,
          context: {
            ...params.context,
            prevent_recursive: true  // 防止自動觸發下游
          }
        });
        
        if (p2Result && p2Result.snapshot_id) {
          p2SnapshotId_final = p2Result.snapshot_id;
          Logger.log(`P2/P2.5/P3 統一調度器：P2 執行完成，snapshot_id=${p2SnapshotId_final}`);
        } else {
          Logger.log(`P2/P2.5/P3 統一調度器：P2 執行完成，但未返回 snapshot_id`);
          // 嘗試讀取最新快照
          const newP2Snapshot = getLatestP2Snapshot();
          if (newP2Snapshot) {
            p2SnapshotId_final = newP2Snapshot.snapshot_id;
          }
        }
      } catch (error) {
        Logger.log(`P2/P2.5/P3 統一調度器：P2 執行失敗：${error.message}`);
        // 繼續執行，使用現有快照
      }
    } else {
      Logger.log(`P2/P2.5/P3 統一調度器：跳過 P2（使用現有快照：${p2SnapshotId_final}）`);
    }
    
    // ========================================
    // Step 3: 執行 P2.5（如果需要）
    // ========================================
    
    let p2_5Result = null;
    let p2_5SnapshotId_final = p2_5SnapshotId;
    
    if (needP2_5) {
      Logger.log("P2/P2.5/P3 統一調度器：開始執行 P2.5");
      try {
        p2_5Result = P2_5_Monthly_Execute({
          trigger: params.trigger,
          context: {
            ...params.context,
            prevent_recursive: true  // 防止自動觸發下游
          }
        });
        
        if (p2_5Result && p2_5Result.snapshot_id) {
          p2_5SnapshotId_final = p2_5Result.snapshot_id;
          Logger.log(`P2/P2.5/P3 統一調度器：P2.5 執行完成，snapshot_id=${p2_5SnapshotId_final}`);
        } else {
          Logger.log(`P2/P2.5/P3 統一調度器：P2.5 執行完成，但未返回 snapshot_id`);
          // 嘗試讀取最新快照
          const newP2_5Snapshot = getLatestP2_5Snapshot();
          if (newP2_5Snapshot) {
            p2_5SnapshotId_final = newP2_5Snapshot.snapshot_id;
          }
        }
      } catch (error) {
        Logger.log(`P2/P2.5/P3 統一調度器：P2.5 執行失敗：${error.message}`);
        // 繼續執行，使用現有快照
      }
    } else {
      Logger.log(`P2/P2.5/P3 統一調度器：跳過 P2.5（使用現有快照：${p2_5SnapshotId_final}）`);
    }
    
    // ========================================
    // Step 4: 等待 P2 和 P2.5 都完成（如果正在執行）
    // ========================================
    
    // 如果 P2 或 P2.5 正在執行（返回 SUBMITTED 狀態），等待完成
    const maxWaitTime = 10 * 60 * 1000;  // 最多等待 10 分鐘
    const waitStartTime = Date.now();
    
    while (Date.now() - waitStartTime < maxWaitTime) {
      let p2Completed = true;
      let p2_5Completed = true;
      
      // 檢查 P2 是否完成
      if (p2Result && p2Result.status === "SUBMITTED") {
        // 檢查 M0 Job Queue 中的任務狀態
        const p2JobStatus = checkM0JobStatus(p2Result.job_id);
        if (p2JobStatus !== "DONE" && p2JobStatus !== "ERROR") {
          p2Completed = false;
        } else if (p2JobStatus === "DONE") {
          // 讀取最新快照
          const newP2Snapshot = getLatestP2Snapshot();
          if (newP2Snapshot) {
            p2SnapshotId_final = newP2Snapshot.snapshot_id;
          }
        }
      }
      
      // 檢查 P2.5 是否完成
      if (p2_5Result && p2_5Result.status === "SUBMITTED") {
        const p2_5JobStatus = checkM0JobStatus(p2_5Result.job_id);
        if (p2_5JobStatus !== "DONE" && p2_5JobStatus !== "ERROR") {
          p2_5Completed = false;
        } else if (p2_5JobStatus === "DONE") {
          const newP2_5Snapshot = getLatestP2_5Snapshot();
          if (newP2_5Snapshot) {
            p2_5SnapshotId_final = newP2_5Snapshot.snapshot_id;
          }
        }
      }
      
      if (p2Completed && p2_5Completed) {
        break;
      }
      
      // 等待 5 秒後再次檢查
      Utilities.sleep(5000);
    }
    
    // ========================================
    // Step 5: 確保 P2 和 P2.5 快照都存在
    // ========================================
    
    if (!p2SnapshotId_final) {
      const latestP2 = getLatestP2Snapshot();
      if (latestP2) {
        p2SnapshotId_final = latestP2.snapshot_id;
      } else {
        Logger.log(`P2/P2.5/P3 統一調度器：警告 - P2 快照不存在`);
      }
    }
    
    if (!p2_5SnapshotId_final) {
      const latestP2_5 = getLatestP2_5Snapshot();
      if (latestP2_5) {
        p2_5SnapshotId_final = latestP2_5.snapshot_id;
      } else {
        Logger.log(`P2/P2.5/P3 統一調度器：警告 - P2.5 快照不存在`);
      }
    }
    
    // ========================================
    // Step 6: 觸發 P3（確保使用最新的 P2 + P2.5 數據）
    // ========================================
    
    let p3Result = null;
    let p3SnapshotId_final = null;
    
    if (p2SnapshotId_final && p2_5SnapshotId_final) {
      Logger.log(`P2/P2.5/P3 統一調度器：開始觸發 P3（P2: ${p2SnapshotId_final}, P2.5: ${p2_5SnapshotId_final}）`);
      try {
        p3Result = P3_Weekly_Execute({
          trigger: params.trigger,
          context: {
            ...params.context,
            p2_snapshot_id: p2SnapshotId_final,
            p2_5_snapshot_id: p2_5SnapshotId_final,
            prevent_recursive: true  // 防止自動觸發下游
          }
        });
        
        if (p3Result && p3Result.snapshot_id) {
          p3SnapshotId_final = p3Result.snapshot_id;
          Logger.log(`P2/P2.5/P3 統一調度器：P3 執行完成，snapshot_id=${p3SnapshotId_final}`);
        } else {
          Logger.log(`P2/P2.5/P3 統一調度器：P3 執行完成，但未返回 snapshot_id`);
          // 嘗試讀取最新快照
          const newP3Snapshot = getLatestP3Snapshot();
          if (newP3Snapshot) {
            p3SnapshotId_final = newP3Snapshot.snapshot_id;
          }
        }
      } catch (error) {
        Logger.log(`P2/P2.5/P3 統一調度器：P3 執行失敗：${error.message}`);
        // 嘗試讀取現有快照
        const latestP3 = getLatestP3Snapshot();
        if (latestP3) {
          p3SnapshotId_final = latestP3.snapshot_id;
        }
      }
    } else {
      Logger.log(`P2/P2.5/P3 統一調度器：跳過 P3（P2 或 P2.5 快照不存在）`);
      // 嘗試讀取現有 P3 快照
      const latestP3 = getLatestP3Snapshot();
      if (latestP3) {
        p3SnapshotId_final = latestP3.snapshot_id;
      }
    }
    
    const duration = Date.now() - startTime;
    Logger.log(`P2/P2.5/P3 統一調度器完成（耗時：${duration}ms）`);
    
    return {
      p2_status: p2Result ? (p2Result.status || "COMPLETED") : "SKIPPED",
      p2_snapshot_id: p2SnapshotId_final,
      p2_5_status: p2_5Result ? (p2_5Result.status || "COMPLETED") : "SKIPPED",
      p2_5_snapshot_id: p2_5SnapshotId_final,
      p3_status: p3Result ? (p3Result.status || "COMPLETED") : "SKIPPED",
      p3_snapshot_id: p3SnapshotId_final,
      duration: duration
    };
    
  } catch (error) {
    Logger.log(`P2/P2.5/P3 統一調度器失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
    
    // 嘗試讀取現有快照作為備用
    return {
      p2_status: "ERROR",
      p2_snapshot_id: getLatestP2Snapshot()?.snapshot_id || null,
      p2_5_status: "ERROR",
      p2_5_snapshot_id: getLatestP2_5Snapshot()?.snapshot_id || null,
      p3_status: "ERROR",
      p3_snapshot_id: getLatestP3Snapshot()?.snapshot_id || null,
      error: error.message
    };
  }
}

/**
 * 檢查 M0 Job 狀態
 * 
 * @param {string} jobId - Job ID
 * @returns {string} status - Job 狀態（NEW / RUNNING / DONE / ERROR）
 */
function checkM0JobStatus(jobId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("M0__JOB_QUEUE");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return "UNKNOWN";
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const jobIdCol = headers.indexOf("job_id");
    const statusCol = headers.indexOf("status");
    
    if (jobIdCol === -1 || statusCol === -1) {
      return "UNKNOWN";
    }
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][jobIdCol] === jobId) {
        return rows[i][statusCol] || "UNKNOWN";
      }
    }
    
    return "UNKNOWN";
  } catch (error) {
    Logger.log(`檢查 M0 Job 狀態失敗：${error.message}`);
    return "UNKNOWN";
  }
}

/**
 * 獲取最新 P2.5 快照
 * 
 * @returns {Object|null} snapshot - P2.5 快照
 */
function getLatestP2_5Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P2_5__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const snapshotIdCol = headers.indexOf("snapshot_id");
    const createdAtCol = headers.indexOf("created_at");
    
    if (snapshotIdCol === -1) {
      return null;
    }
    
    // 找到最新的快照（最後一行）
    const lastRow = rows[rows.length - 1];
    const snapshot = {};
    
    headers.forEach((header, colIndex) => {
      snapshot[header.toLowerCase()] = lastRow[colIndex];
    });
    
    return snapshot;
  } catch (error) {
    Logger.log(`獲取最新 P2.5 快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 處理 P5 Weekly M0 執行結果（重構版）
 * 
 * @param {string} jobId - Job ID
 * @param {Object} m0Result - M0 執行結果
 * @returns {Object} result - 處理結果
 */
function P5_Weekly_ProcessM0Result(jobId, m0Result) {
  try {
    Logger.log(`P5 Weekly 處理 M0 結果（重構版）：jobId=${jobId}`);
    
    const executorOutput = m0Result.executor_output || {};
    const auditorOutput = m0Result.auditor_output || {};
    
    // 整合機構級視角
    const enhancedAnalysis = integrateInstitutionalPerspectiveP5(
      executorOutput,
      m0Result.institutional_data || {}
    );
    
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
      trigger_decisions: p5WeeklyOutput.trigger_decisions,
      stock_strategies: m0Result.stock_strategies || {}  // 個股策略
    });
    
    // ⭐ V8.10 新增：收集真實成長檢驗數據（用於泡沫監控系統）
    let growthData = {};
    try {
      if (typeof collectGrowthDataForBubbleNavigation === "function") {
        growthData = collectGrowthDataForBubbleNavigation();
        Logger.log(`P5 Weekly：真實成長檢驗完成（通過率 ${(growthData.growth_pass_rate * 100).toFixed(1)}%，${growthData.validated_count}/${growthData.validated_count + growthData.failed_count} 檔通過）`);
      } else {
        Logger.log(`P5 Weekly：⚠️ collectGrowthDataForBubbleNavigation 函數未定義，跳過成長檢驗`);
      }
    } catch (error) {
      Logger.log(`P5 Weekly：收集成長檢驗數據失敗：${error.message}`);
    }
    
    // ⭐ V8.0 新增：P5.9 泡沫監控系統整合（影響 U 調整）
    let bubbleNavigationResult = null;
    try {
      // ⭐ V8.10 新增：整合真實成長檢驗數據到 marketData
      const bubbleStage = P5_6_BubbleNavigation("MARKET", {
        pe: worldview.worldview?.market_regime || "NEUTRAL",
        vix: allData.macro_data?.vix || 20,
        margin_debt: allData.macro_data?.margin_debt || 0,
        volume_anomaly: false,
        // ⭐ V8.10 新增：真實成長檢驗數據
        revenue_growth: growthData.revenue_growth || 0,
        capex_revenue_ratio: growthData.capex_revenue_ratio || null,
        margin_expansion: growthData.margin_expansion !== null ? growthData.margin_expansion : true, // 預設為 true（保守策略）
        cash_flow_positive: growthData.cash_flow_positive !== null ? growthData.cash_flow_positive : true, // 預設為 true（保守策略）
        // 市場級指標
        forward_pe: null,  // 需要從市場數據獲取
        cape: null,
        ev_fcf: null,
        market_cap_gdp: null,
        market_breadth: allData.market_breadth || 0.5,
        concentration: null,
        correlation: null
      });
      
      bubbleNavigationResult = bubbleStage;
      
      // 根據泡沫階段調整 U（總資金水位）
      // ⭐ V8.10 新增：啟用走鋼索模式（預設啟用）
      const uAdjustment = calculateUAdjustmentFromBubbleStage(bubbleStage.bubble_stage, {
        enableTightropeMode: true // V8.10：LATE 階段不減倉，改用走鋼索模式
      });
      
      if (uAdjustment && uAdjustment !== getCurrentU()) {
        const isTightropeMode = bubbleStage.bubble_stage === "LATE";
        const growthValidationSummary = growthData && growthData.growth_validated ? 
          `，成長檢驗通過率 ${(growthData.growth_pass_rate * 100).toFixed(1)}%（${growthData.validated_count}/${growthData.validated_count + growthData.failed_count} 檔通過）` : 
          (growthData && growthData.failed_count > 0 ? `，⚠️ 成長檢驗失敗 ${growthData.failed_count} 檔` : "");
        
        Logger.log(`P5 Weekly：泡沫階段=${bubbleStage.bubble_stage}，建議 U 調整=${uAdjustment}${isTightropeMode ? "（走鋼索模式：維持高水位，風險由 P6 移動停利控管）" : ""}${growthValidationSummary}`);
        
        // 將 U 調整建議記錄到 worldview 的 u_macro_recommendation 中
        if (worldview && worldview.worldview) {
          worldview.worldview.u_macro_recommendation = {
            value: uAdjustment,
            reason: `泡沫監控系統：泡沫階段=${bubbleStage.bubble_stage}${isTightropeMode ? "（走鋼索模式：不因為「貴」而賣出，維持高水位以吃到最後一段漲幅，風險由 P6 移動停利控管）" : ""}${growthValidationSummary}`,
            bubble_stage: bubbleStage.bubble_stage,
            tightrope_mode: isTightropeMode, // ⭐ V8.10 新增：標記是否為走鋼索模式
            growth_validation: growthData && growthData.growth_validated !== undefined ? {
              passed: growthData.growth_validated,
              pass_rate: growthData.growth_pass_rate,
              validated_count: growthData.validated_count,
              failed_count: growthData.failed_count,
              failed_stocks: growthData.stock_validations ? 
                growthData.stock_validations.filter(s => !s.validation.passed).map(s => s.ticker) : []
            } : null, // ⭐ V8.10 新增：成長檢驗結果
            previous_value: getCurrentU()
          };
        }
        
        // ⭐ V8.10 新增：如果成長檢驗失敗，建議剔除失敗的股票（垃圾泡沫）
        if (growthData && growthData.stock_validations) {
          const failedStocks = growthData.stock_validations.filter(s => !s.validation.passed);
          
          if (failedStocks.length > 0) {
            const failedTickers = failedStocks.map(s => s.ticker);
            Logger.log(`P5 Weekly：⚠️ 成長檢驗失敗 ${failedStocks.length} 檔股票，建議剔除：${failedTickers.join(", ")}`);
            
            // 將剔除建議記錄到 worldview 中（供 AI 參考）
            // 注意：P5 Weekly 只負責「建議」，實際剔除需要用戶確認或由 P4 執行
            if (worldview && worldview.worldview) {
              if (!worldview.worldview.trigger_decisions) {
                worldview.worldview.trigger_decisions = [];
              }
              
              // 新增剔除建議（如果還不存在）
              const existingRemovalDecision = worldview.worldview.trigger_decisions.find(
                d => d.trigger_phase === "P4" && d.reason && d.reason.indexOf("成長檢驗失敗") > -1
              );
              
              if (!existingRemovalDecision) {
                worldview.worldview.trigger_decisions.push({
                  trigger_phase: "P4",
                  reason: `真實成長檢驗失敗：${failedStocks.length} 檔股票被判定為垃圾泡沫（估值高但成長驗證失敗），建議剔除`,
                  parameters: {
                    tickers: failedTickers,
                    growth_validation_failures: failedStocks.map(s => ({
                      ticker: s.ticker,
                      market: s.market,
                      warnings: s.validation.warnings
                    }))
                  },
                  institutional_sentiment_triggers: null,
                  institutional_credibility_reference: null
                });
              }
            }
          }
        }
        
        // ⭐ V8.10 新增：保存泡沫階段到 PropertiesService（供 P6 讀取）
        const properties = PropertiesService.getScriptProperties();
        properties.setProperty("P5_9_BUBBLE_STAGE", bubbleStage.bubble_stage);
        Logger.log(`P5 Weekly：泡沫階段已保存到 PropertiesService：${bubbleStage.bubble_stage}（供 P6 移動停利機制讀取）`);
        
        // ⭐ V8.10 修正：LATE 階段不觸發 P4 U 調整（因為 U 不降低）
        // 但如果 U 調整建議與當前值差異過大，仍需觸發（例如從 50% 提升到 80%）
        if (bubbleStage.bubble_stage === "LATE" && uAdjustment >= getCurrentU()) {
          // LATE 階段且 U 不降低：只記錄，不觸發 P4（維持高水位）
          Logger.log(`P5 Weekly：LATE 階段走鋼索模式，維持高水位（U=${uAdjustment}），不觸發 P4 U 調整`);
        } else if (Math.abs(uAdjustment - getCurrentU()) > 0.05) {
          // 差異 > 5% 才觸發（MID/EARLY/BURST 階段）
          P4_Calculate({
            trigger: "P5_WEEKLY_U_ADJUSTMENT",
            reason: `泡沫監控系統：泡沫階段=${bubbleStage.bubble_stage}，U 調整=${uAdjustment}`
          });
        }
      }
    } catch (error) {
      Logger.log(`P5 Weekly：泡沫監控系統整合失敗：${error.message}`);
    }
    
/**
 * 根據泡沫階段計算 U 調整 ⭐ V8.0 新增 → ⭐ V8.10 戰略升級
 * 
 * ⭐ V8.10 核心哲學轉變：
 * - 從「左側減倉」→「右側動態鎖利」：在泡沫末期，不因為「貴」而賣出，只因為「破」而離場
 * - 從「估值預測」→「動能跟隨」：以「流動性」取代「估值」，監控「資金水龍頭」是否關閉
 * - 索羅斯式泡沫論：「當我看到泡沫形成時，我會衝進去買，而不是賣出」
 * 
 * @param {string} bubbleStage - 泡沫階段（EARLY/MID/LATE/BURST/NORMAL）
 * @param {Object} options - 選項（可選）
 * @param {boolean} options.enableTightropeMode - 是否啟用走鋼索模式（V8.10 新增）
 * @returns {number} 建議的 U 值（0.0-1.0）
 */
function calculateUAdjustmentFromBubbleStage(bubbleStage, options) {
  options = options || {};
  const enableTightropeMode = options.enableTightropeMode !== false; // 預設啟用
  const currentU = getCurrentU();
  
  switch (bubbleStage) {
    case "EARLY":
      // EARLY: U 不變或微調（維持高水位）
      return Math.max(0.30, currentU * 0.95);
      
    case "MID":
      // MID: U 降低 10-20%（謹慎加碼）
      return Math.max(0.30, currentU * 0.80);
      
    case "LATE":
      // ⭐ V8.10 修正：LATE（瘋狗浪）- 走鋼索模式
      // 原 V8.0：U 降低 30-50%（因為「貴」而賣出）
      // V8.10：U 不強制降低，維持高水位（80-100%）以吃到最後一段漲幅
      if (enableTightropeMode) {
        // 走鋼索模式：不因為「貴」而賣出，維持高水位
        // 風險控管由 P6 移動停利機制負責
        return Math.max(0.80, Math.min(1.0, currentU)); // 維持 80-100%
      } else {
        // 向後兼容：如果禁用走鋼索模式，使用原邏輯
        return Math.max(0.30, currentU * 0.60);
      }
      
    case "BURST":
      // BURST: U 降低至最低（30%），緊急撤退
      return 0.30;
      
    default:
      // NORMAL: 維持當前 U
      return currentU;
  }
}

    // 執行觸發決策（例如：觸發 P4 U 調整、P5.5、P5.6）
    if (p5WeeklyOutput.trigger_decisions && p5WeeklyOutput.trigger_decisions.length > 0) {
      executeP5WeeklyTriggerDecisions(p5WeeklyOutput.trigger_decisions);
    }
    
    // 保存學習日誌（使用 24_P5_WEEKLY_LEARNING.js）
    if (p5WeeklyOutput.belief_update || m0Result.stock_strategies) {
      saveP5WeeklyLearningLog(p5WeeklyOutput, snapshot, m0Result.stock_strategies || {});
    }
    
    // 追蹤個股策略（使用 24_P5_WEEKLY_LEARNING.js）
    if (m0Result.stock_strategies) {
        // ⭐ V8.13 新增：記錄策略使用的數據來源（用於建立數據-策略-結果追蹤鏈）
            const dataSources = {
              macro_data: allData.macro_data ? true : false,
              news_data: allData.news_data ? true : false,
              technical_indicators: fullTechnicalIndicators ? true : false,
              derivatives: getWeeklyDerivativesSummary() ? true : false,
              institutional_data: collectInstitutionalDataWeekly() ? true : false,
              smart_money_data: smartMoneyData ? true : false,
              worldview: worldview ? true : false,
              events: events ? true : false,
              stock_news_index: stockNewsIndex ? true : false,  // ⭐ V8.12 新增
              sector_news_index: sectorNewsIndex ? true : false,  // ⭐ V8.12 新增
              events_index: eventsIndex ? true : false,  // ⭐ V8.12 新增
              macro_weekly_metrics: macroWeeklyMetrics ? true : false,  // ⭐ V8.12 新增
              technical_weekly_metrics: technicalWeeklyMetrics ? true : false  // ⭐ V8.12 新增
            };
            
            // ⭐ V8.13修正：移除V7設計的錯誤方向，使用現有版本
            trackStockStrategies(m0Result.stock_strategies, snapshot, dataSources);
    }
    
    return {
      status: "COMPLETED",
      snapshot_id: snapshot.snapshot_id,
      p5_weekly_output: p5WeeklyOutput,
      stock_strategies_count: Object.keys(m0Result.stock_strategies || {}).length
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly 處理 M0 結果失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
    throw error;
  }
}
