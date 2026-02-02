/**
 * 📈 P3: 技術分析（Technical Analysis）- 核心執行模組
 * 
 * 混合模式：Layer 1（程式計算）+ Layer 2（AI 分析）
 * - Layer 1：從外部權威數據源獲取技術指標（優先使用，不自己計算）
 * - Layer 2：AI 分析 Cat 分類、買賣點判斷
 * 
 * 執行頻率：
 * - P3_WEEKLY：每週執行
 * - P3_MONTHLY：每月執行
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// P3 配置參數
// ==========================================

const P3_CONFIG = {
  // ⭐ V8.0 新增：批次處理配置
  BATCH_SIZE: 3,  // ⚠️ V8.0 修正：批次大小（3 家/批，避免 Context Window Overflow 風險）
  // 原設定 5 家/批（156K 輸入 + 52K 輸出 = 208K > 200K 限制）會導致 Overflow
  // 修正為 3 家/批後，約 94K 輸入 + 31K 輸出 = 125K，安全邊際充足
  BATCH_DELAY_MS: 2000,  // 批次間延遲（毫秒，避免 API 限流）
  
  // 執行頻率
  frequency_weekly: "WEEKLY",
  frequency_monthly: "MONTHLY",
  
  // 機構級視角整合
  institutional_integration: {
    enabled: true,
    weight: 0.10  // 機構級視角權重 10%（技術分析中較低）
  },
  
  // Cat 分類標準
  cat_criteria: {
    Cat1: { description: "未啟動", condition: "趨勢未確認" },
    Cat2: { description: "啟動期", condition: "趨勢剛啟動" },
    Cat3: { description: "主升段", condition: "趨勢強勁" },
    "Cat4-A": { description: "高位回調", condition: "高位整理" },
    "Cat4-B": { description: "深度回調", condition: "深度調整" },
    Cat5: { description: "趨勢破壞", condition: "趨勢反轉" }
  }
};

// ==========================================
// P3 核心執行函數
// ==========================================

/**
 * P3 主執行函數（週度）
 * 
 * @param {Object} params - 執行參數
 * @returns {Object} result - 執行結果
 */
function P3_Weekly_Execute(params) {
  return P3_Execute({
    ...params,
    frequency: "WEEKLY",
    project_id: "P3"
  });
}

/**
 * P3 主執行函數（月度）
 * 
 * @param {Object} params - 執行參數
 * @returns {Object} result - 執行結果
 */
function P3_Monthly_Execute(params) {
  return P3_Execute({
    ...params,
    frequency: "MONTHLY",
    project_id: "P3"
  });
}

/**
 * P3 主執行函數（通用）
 * 
 * @param {Object} params - 執行參數
 * @returns {Object} result - 執行結果
 */
function P3_Execute(params) {
  try {
    Logger.log(`P3 ${params.frequency} 執行開始`);
    
    // Step 1: 檢查執行前確認
    const jobId = params.job_id || `P3_${params.frequency}_${Date.now()}`;
    const confirmation = checkPreExecutionConfirmation(jobId, params.project_id);
    
    if (confirmation.requires_confirmation && confirmation.status !== "CONFIRMED") {
      if (confirmation.status === "NOT_CREATED") {
        const questions = generatePreExecutionQuestions(params.project_id, params.context);
        const confirmationId = savePreExecutionQuestions(jobId, params.project_id, questions);
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
    
    // Step 2: 讀取 P2 輸出
    // ⭐ V8.0 修正：週度執行時只處理有變動的股票
    let phase2Output = getPhase2OutputFromSheet();
    if (phase2Output.length === 0) {
      throw new Error("P2 輸出不存在，請先執行 P2");
    }
    
    // ⭐ V8.0 新增：週度執行時過濾只處理有變動的股票
    if (params.frequency === "WEEKLY") {
      phase2Output = filterChangedStocksForP3Weekly(phase2Output);
      Logger.log(`P3 週度：過濾後剩餘 ${phase2Output.length} 檔股票需要處理`);
    }
    
    // Step 3: 從外部數據源獲取技術指標（優先使用，不自己計算）
    const technicalData = collectTechnicalDataFromExternalSources(phase2Output);
    
    // Step 3.5: 讀取 P2.5 機構級數據（必須整合）⭐⭐⭐⭐⭐
    const smartMoneyData = getP2_5SmartMoneyData(phase2Output);
    
    // ========================================
    // Step 4: ⭐ V8.0 新增：批次處理邏輯 + ⭐ V8.16 更新：觸發式審查機制 + ⭐ V8.17 更新：Batch API 整合
    // ========================================
    
    Logger.log(`P3：開始處理（共 ${phase2Output.length} 檔股票）`);
    
    // ⭐ V8.17 新增：判斷是否使用 Batch API
    const useBatch = shouldUseBatch(params.project_id);
    const executorModel = TASK_TO_EXECUTOR[params.project_id] || "SONNET";
    const executorConfig = M0_MODEL_CONFIG[executorModel];
    const canUseBatch = useBatch && executorConfig && executorConfig.supportsBatch;
    
    if (canUseBatch) {
      Logger.log(`P3：使用 Batch API（Provider: ${executorConfig.adapter === "M0_Adapter_Claude" ? "anthropic" : "openai"}, Model: ${executorConfig.model}）`);
      
      // ⭐ V8.17 新增：使用 Batch API 處理所有股票
      return P3_ExecuteWithBatch(params, phase2Output, technicalData, smartMoneyData);
    } else {
      Logger.log(`P3：使用同步 API（不適用 Batch 或模型不支援）`);
      
      // ⭐ V8.16 更新：兩階段處理（同步 API）
      return P3_ExecuteWithSyncAPI(params, phase2Output, technicalData, smartMoneyData);
    }
    
  } catch (error) {
    Logger.log(`P3 執行失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.17 新增：P3 使用 Batch API 執行
 * 
 * 收集所有股票的請求，統一提交到 Batch API
 * 
 * @param {Object} params - 執行參數
 * @param {Array} phase2Output - P2 輸出
 * @param {Object} technicalData - 技術指標數據
 * @param {Object} smartMoneyData - 籌碼面數據
 * @returns {Object} 執行結果
 */
function P3_ExecuteWithBatch(params, phase2Output, technicalData, smartMoneyData) {
  try {
    Logger.log(`P3：開始 Batch API 處理（共 ${phase2Output.length} 檔股票）`);
    
    // 讀取快照（用於觸發條件檢查）
    const previousSnapshot = getLatestP3Snapshot();
    const p0_5_snapshot = getLatestP0_5Snapshot();
    const p0_7_snapshot = getLatestP0_7Snapshot();
    const p2_snapshot = getLatestP2Snapshot();
    const p2_5_snapshot = getLatestP2_5Snapshot();
    
    // 確定 Provider 和 Model
    const executorModel = TASK_TO_EXECUTOR[params.project_id] || "SONNET";
    const executorConfig = M0_MODEL_CONFIG[executorModel];
    const provider = executorConfig.adapter === "M0_Adapter_Claude" ? "anthropic" : "openai";
    
    // 構建靜態 System Blocks（可 cache 的內容）
    const staticSystemBlocks = buildP3StaticSystemBlocks(params.frequency);
    
    // 收集所有股票的 Batch Requests
    const batchRequests = [];
    
    for (const stock of phase2Output) {
      const ticker = stock.Company_Code || stock.ticker || stock.company_code;
      if (!ticker) continue;
      
      // 構建單一股票的 User Payload
      const userPayload = {
        ticker: ticker,
        stock_data: stock,
        technical_data: technicalData[ticker] || {},
        smart_money_data: smartMoneyData[ticker] || {},
        previous_snapshot: previousSnapshot?.technical_results?.[ticker] || null,
        p0_5_snapshot: p0_5_snapshot,
        p0_7_snapshot: p0_7_snapshot,
        p2_snapshot: p2_snapshot,
        p2_5_snapshot: p2_5_snapshot
      };
      
      // 構建 User Message（動態內容）
      const userMessage = buildP3UserMessageForBatch(ticker, userPayload, params.frequency);
      
      // 創建 Batch Request
      const batchRequest = createBatchRequest({
        custom_id: `P3_${ticker}_${params.frequency}_${Date.now()}`,
        system_blocks: staticSystemBlocks,  // ⭐ 可 cache 的靜態內容
        user_payload: userMessage,  // 動態內容（轉為字串）
        max_output_tokens: executorConfig.maxOutputTokens || 8000
      });
      
      batchRequests.push(batchRequest);
    }
    
    Logger.log(`P3：已收集 ${batchRequests.length} 個 Batch Requests`);
    
    // 創建內部 Batch Job
    const batchJobId = `P3_${params.frequency}_${Date.now()}`;
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
    Logger.log(`P3：提交 Batch Job 到 ${provider}（${batchRequests.length} 個請求）`);
    const submitResult = submitBatchJob(internalBatchJob);
    
    Logger.log(`P3：Batch Job 已提交，batch_id=${submitResult.batch_id}, provider_batch_id=${submitResult.provider_batch_id}`);
    
    return {
      status: "SUBMITTED_BATCH",
      batch_id: submitResult.batch_id,
      provider_batch_id: submitResult.provider_batch_id,
      request_count: batchRequests.length,
      frequency: params.frequency,
      message: `P3 ${params.frequency} Batch Job 已提交（${batchRequests.length} 個請求），請等待完成後執行 P3_ProcessBatchResults() 處理結果`
    };
    
  } catch (error) {
    Logger.log(`P3 Batch API 處理失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.17 新增：構建 P3 靜態 System Blocks（可 cache 的內容）
 */
function buildP3StaticSystemBlocks(frequency) {
  return [
    {
      type: "text",
      text: `你是 P3 技術分析專家，負責進行機構級預測視角分析。

## 核心原則

1. **機構級預測視角**：以機構主力、大型對沖基金、高盛、摩根等大機構的視角來分析
2. **目標是「預測未來」**：而不是套用公式
3. **分析邏輯**：「量大於價」、解釋主力行為、判斷真正意圖、預測未來操作
4. **禁止事項**：禁止輸出「根據 RSI、MACD、均線、支撐壓力」等程式就能算的結論

## Cat 分類標準

- **Cat1**：未啟動（趨勢未確認）
- **Cat2**：啟動期（趨勢剛啟動）
- **Cat3**：主升段（趨勢強勁）
- **Cat4-A**：高位回調（高位整理）
- **Cat4-B**：深度回調（深度調整）
- **Cat5**：趨勢破壞（趨勢反轉）

## 輸出格式要求

必須以 JSON 格式輸出，包含以下欄位：
- cat: Cat1-5
- cat_reason: 分類理由
- buy_ladder: [{id: "B1", price: number, reason: string}, ...]
- stop_ladder: [{id: "S1", price: number, reason: string}, ...]
- risk_overlay_level: 0-3
- main_force_behavior: 主力行為解釋
- intention_judgment: 意圖判斷
- future_prediction: 未來預測`,
      cache_control: { type: "ephemeral" }  // ⭐ 標記為可 cache
    }
  ];
}

/**
 * ⭐ V8.17 新增：構建 P3 User Message（動態內容）
 */
function buildP3UserMessageForBatch(ticker, userPayload, frequency) {
  const stock = userPayload.stock_data;
  const technical = userPayload.technical_data;
  const smartMoney = userPayload.smart_money_data;
  
  let message = `## 股票資訊

Ticker: ${ticker}
Company: ${stock.Company_Name || stock.company_name || "N/A"}

## 技術指標數據（Layer 1 計算結果）

${JSON.stringify(technical, null, 2)}

## 籌碼面數據（P2.5）

${JSON.stringify(smartMoney, null, 2)}

## P2 基本面數據

${JSON.stringify(stock, null, 2)}

## 上週快照（如果有）

${userPayload.previous_snapshot ? JSON.stringify(userPayload.previous_snapshot, null, 2) : "無上週快照"}

## 你的任務

基於以上數據，進行機構級預測視角分析，輸出 JSON 格式結果。`;

  return message;
}

/**
 * ⭐ V8.16 保留：P3 使用同步 API 執行（兩階段處理）
 */
function P3_ExecuteWithSyncAPI(params, phase2Output, technicalData, smartMoneyData) {
  const BATCH_SIZE = P3_CONFIG.BATCH_SIZE || 5;  // 5 家/批（接近 200K 限制）
  const totalBatches = Math.ceil(phase2Output.length / BATCH_SIZE);
  
  Logger.log(`P3：開始分批處理（共 ${phase2Output.length} 檔股票，分成 ${totalBatches} 批，每批 ${BATCH_SIZE} 檔）`);
  
  // ⭐ V8.16 更新：兩階段處理
  // 第一階段：只執行 EXECUTOR，收集所有輸出
  const requestedFlowExecutor = ["EXECUTOR"];  // 第一階段：只執行 EXECUTOR
  const allBatchJobIds = [];
  const executorJobIds = [];  // ⭐ V8.16 新增：記錄所有 EXECUTOR job ID
  
  // 讀取快照（用於觸發條件檢查）
  const previousSnapshot = getLatestP3Snapshot();
  const p0_5_snapshot = getLatestP0_5Snapshot();
  const p0_7_snapshot = getLatestP0_7Snapshot();
  const p2_snapshot = getLatestP2Snapshot();
  const p2_5_snapshot = getLatestP2_5Snapshot();
  
  // 第一階段：分批執行 EXECUTOR
  for (let i = 0; i < phase2Output.length; i += BATCH_SIZE) {
    const batch = phase2Output.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    
    Logger.log(`P3：處理批次 ${batchNumber}/${totalBatches} (${batch.length} 檔股票) - 第一階段：EXECUTOR`);
    
    try {
      // 提取這批股票的技術指標和籌碼面數據
      const batchTechnicalData = {};
      const batchSmartMoneyData = {};
      const batchTickers = [];
      
      batch.forEach(stock => {
        const ticker = stock.Company_Code || stock.ticker || stock.company_code;
        if (ticker) {
          batchTickers.push(ticker);
          if (technicalData[ticker]) {
            batchTechnicalData[ticker] = technicalData[ticker];
          }
          if (smartMoneyData[ticker]) {
            batchSmartMoneyData[ticker] = smartMoneyData[ticker];
          }
        }
      });
      
      // 準備批次 M0 Job 輸入
      const batchM0InputPayload = {
        phase: params.project_id,
        frequency: params.frequency,
        trigger: params.trigger,
        phase2_output: batch,  // ⭐ 只包含這批股票
        technical_data: batchTechnicalData,  // ⭐ 只包含這批股票的技術指標
        smart_money_data: batchSmartMoneyData,  // ⭐ 只包含這批股票的籌碼面數據
        previous_snapshot: previousSnapshot,
        context: params.context || {},
        batch_number: batchNumber,  // ⭐ V8.0 新增：批次編號
        total_batches: totalBatches,  // ⭐ V8.0 新增：總批數
        is_batch_processing: true,  // ⭐ V8.0 新增：標記為批次處理
        // ⭐ V8.16 新增：傳遞快照數據（用於觸發條件檢查）
        p0_5_snapshot: p0_5_snapshot,
        p0_7_snapshot: p0_7_snapshot,
        p2_snapshot: p2_snapshot,
        p2_5_snapshot: p2_5_snapshot
      };
      
      // 構建批次 Prompt（如果函數存在）
      if (typeof buildP3BatchPrompt === "function") {
        Logger.log(`P3：構建批次 ${batchNumber} 的 Prompt`);
        batchM0InputPayload.p3_prompt = buildP3BatchPrompt(
          params.frequency, 
          batch,  // ⭐ 只傳入這批股票
          batchTechnicalData, 
          batchSmartMoneyData,
          batchNumber,
          totalBatches
        );
      }
      
      // 提交批次到 M0 Job Queue（只執行 EXECUTOR）
      Logger.log(`P3：提交批次 ${batchNumber} 到 M0 Job Queue（第一階段：EXECUTOR）`);
      const batchJobId = submitToM0JobQueue(params.project_id, requestedFlowExecutor, batchM0InputPayload);
      allBatchJobIds.push(batchJobId);
      executorJobIds.push({ jobId: batchJobId, batch: batch, batchNumber: batchNumber });  // ⭐ V8.16 新增：記錄批次資訊
      
      Logger.log(`P3：批次 ${batchNumber} 已提交（EXECUTOR），job_id=${batchJobId}`);
      
      // 批次間延遲，避免 API 限流
      if (i + BATCH_SIZE < phase2Output.length) {
        Utilities.sleep(P3_CONFIG.BATCH_DELAY_MS || 2000);
      }
      
    } catch (error) {
      Logger.log(`P3：批次 ${batchNumber} 處理失敗：${error.message}`);
      // 記錄失敗的批次，但不中斷整個流程
    }
  }
  
  Logger.log(`P3：第一階段完成，所有 EXECUTOR 批次已提交（共 ${executorJobIds.length} 個任務）`);
  Logger.log(`P3：請等待所有 EXECUTOR 執行完成後，執行 P3_ProcessTriggeredReview() 進行第二階段（觸發式審查）`);
  
  return {
    status: "SUBMITTED_PHASE1",
    job_ids: allBatchJobIds,  // ⭐ V8.0 新增：返回所有批次 job ID
    executor_job_ids: executorJobIds,  // ⭐ V8.16 新增：返回 EXECUTOR job ID 列表
    total_batches: totalBatches,
    frequency: params.frequency,
    message: `P3 ${params.frequency} 第一階段（EXECUTOR）已分批提交到 M0 Job Queue（${totalBatches} 批），請等待執行完成後執行 P3_ProcessTriggeredReview()`
  };
}

/**
 * ⭐ V8.17 新增：處理 P3 Batch 結果
 * 
 * 等待 Batch 完成後，處理結果並進行觸發式審查
 * 
 * @param {string} batchId - Batch Job ID（內部 ID）
 * @param {Object} params - 執行參數
 * @returns {Object} 處理結果
 */
function P3_ProcessBatchResults(batchId, params) {
  try {
    Logger.log(`P3：開始處理 Batch 結果：${batchId}`);
    
    // 查詢 Batch 狀態
    let status = getBatchJobStatus(batchId);
    let pollCount = 0;
    const maxPolls = 120;  // 最多輪詢 120 次（2 小時，每次 1 分鐘）
    
    // 輪詢直到完成
    while (status.status !== "ended" && status.status !== "completed" && pollCount < maxPolls) {
      Logger.log(`P3：Batch 狀態：${status.status}，進度：${status.progress.toFixed(1)}%`);
      Utilities.sleep(60000);  // 等待 1 分鐘
      status = getBatchJobStatus(batchId);
      pollCount++;
    }
    
    if (status.status !== "ended" && status.status !== "completed") {
      throw new Error(`Batch 未在預期時間內完成，狀態：${status.status}`);
    }
    
    Logger.log(`P3：Batch 已完成，開始獲取結果`);
    
    // 獲取 Batch 結果
    const batchResults = fetchBatchJobResults(batchId);
    
    Logger.log(`P3：Batch 結果已獲取，成功：${batchResults.summary.succeeded}，失敗：${batchResults.summary.failed}`);
    
    // 讀取快照（用於觸發條件檢查）
    const previousSnapshot = getLatestP3Snapshot();
    const p0_5_snapshot = getLatestP0_5Snapshot();
    const p0_7_snapshot = getLatestP0_7Snapshot();
    const p2_snapshot = getLatestP2Snapshot();
    const p2_5_snapshot = getLatestP2_5Snapshot();
    
    // 處理結果並進行觸發式審查
    const allExecutorOutputs = {};
    const reviewJobIds = [];
    
    for (const result of batchResults.results) {
      const customId = result.custom_id;
      // 從 custom_id 提取 ticker（格式：P3_TICKER_frequency_timestamp）
      const tickerMatch = customId.match(/P3_([A-Z0-9]+)_/);
      const ticker = tickerMatch ? tickerMatch[1] : null;
      
      if (!ticker) {
        Logger.log(`P3：無法從 custom_id 提取 ticker：${customId}`);
        continue;
      }
      
      // 解析執行者輸出
      let executorOutput = result.output;
      if (typeof executorOutput === 'string') {
        try {
          executorOutput = JSON.parse(executorOutput);
        } catch (e) {
          Logger.log(`P3：解析執行者輸出失敗（${ticker}）：${e.message}`);
          continue;
        }
      }
      
      // 準備股票數據（用於觸發條件檢查）
      const stockData = {
        ticker: ticker,
        // 需要從原始輸入中獲取更多數據
        // 這裡簡化處理，實際應該從 Batch Job 的原始請求中獲取
      };
      
      // 檢查是否需要審查
      const reviewDecision = shouldReviewP3Stock(
        stockData,
        executorOutput,
        previousSnapshot,
        p0_5_snapshot,
        p0_7_snapshot,
        p2_snapshot,
        p2_5_snapshot
      );
      
      // 保存執行者輸出
      allExecutorOutputs[ticker] = {
        executor_output: executorOutput,
        needs_review: reviewDecision.needs_review,
        trigger_type: reviewDecision.trigger_type,
        reasons: reviewDecision.reasons,
        score: reviewDecision.score
      };
      
      // 如果需要審查，提交審查任務（使用同步 API，因為審查數量少）
      if (reviewDecision.needs_review) {
        Logger.log(`P3：股票 ${ticker} 觸發審查（${reviewDecision.trigger_type}），原因：${reviewDecision.reasons.join(", ")}`);
        
        // 提交審查任務到 M0 Job Queue（同步 API）
        const reviewM0InputPayload = {
          phase: "P3",
          frequency: params.frequency || "WEEKLY",
          trigger: "TRIGGERED_REVIEW",
          ticker: ticker,
          executor_output: executorOutput,
          review_reasons: reviewDecision.reasons,
          trigger_type: reviewDecision.trigger_type
        };
        
        reviewM0InputPayload.p3_auditor_prompt = buildP3AuditorPrompt(
          executorOutput,
          stockData,
          reviewDecision.reasons
        );
        
        const reviewJobId = submitToM0JobQueue("P3", ["AUDITOR"], reviewM0InputPayload);
        reviewJobIds.push({ jobId: reviewJobId, ticker: ticker, trigger_type: reviewDecision.trigger_type });
        
        Logger.log(`P3：股票 ${ticker} 審查任務已提交，job_id=${reviewJobId}`);
      } else {
        Logger.log(`P3：股票 ${ticker} 不需要審查（Soft Trigger 分數：${reviewDecision.score || 0}）`);
      }
    }
    
    Logger.log(`P3：Batch 結果處理完成，共 ${reviewJobIds.length} 檔股票需要審查（共 ${Object.keys(allExecutorOutputs).length} 檔股票）`);
    
    return {
      status: "PROCESSED",
      batch_id: batchId,
      total_stocks: Object.keys(allExecutorOutputs).length,
      reviewed_stocks: reviewJobIds.length,
      review_job_ids: reviewJobIds,
      executor_outputs: allExecutorOutputs,
      message: `P3 Batch 結果處理完成，${reviewJobIds.length}/${Object.keys(allExecutorOutputs).length} 檔股票需要審查`
    };
    
  } catch (error) {
    Logger.log(`P3 Batch 結果處理失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.16 新增：P3 觸發式審查處理（第二階段）
 * 
 * 等待所有 EXECUTOR 完成後，根據觸發條件決定哪些股票需要審查
 * 
 * @param {Object} params - 參數
 * @param {Array} params.executorJobIds - EXECUTOR job ID 列表（包含 jobId, batch, batchNumber）
 * @param {Object} params.technicalData - 技術指標數據
 * @param {Object} params.smartMoneyData - 籌碼面數據
 * @returns {Object} result - 處理結果
 */
function P3_ProcessTriggeredReview(params) {
  try {
    Logger.log(`P3：開始第二階段（觸發式審查處理）`);
    
    const executorJobIds = params.executorJobIds || [];
    const technicalData = params.technicalData || {};
    const smartMoneyData = params.smartMoneyData || {};
    
    // 讀取快照（用於觸發條件檢查）
    const previousSnapshot = getLatestP3Snapshot();
    const p0_5_snapshot = getLatestP0_5Snapshot();
    const p0_7_snapshot = getLatestP0_7Snapshot();
    const p2_snapshot = getLatestP2Snapshot();
    const p2_5_snapshot = getLatestP2_5Snapshot();
    
    // 收集所有執行者輸出
    const allExecutorOutputs = {};
    const reviewJobIds = [];
    
    for (const executorJob of executorJobIds) {
      const jobId = executorJob.jobId;
      const batch = executorJob.batch;
      const batchNumber = executorJob.batchNumber;
      
      try {
        // 讀取 M0 執行結果
        const m0Result = getM0JobResult(jobId);
        if (!m0Result || m0Result.status !== "DONE") {
          Logger.log(`P3：EXECUTOR job ${jobId} 尚未完成，跳過`);
          continue;
        }
        
        const executorOutput = m0Result.executor_output || {};
        
        // ⭐ V8.16 修正：P3 執行者輸出格式是 technical_results（物件，key 是 ticker）
        // 或者可能是批次輸出（包含多檔股票的 technical_results）
        let technicalResults = {};
        if (executorOutput.technical_results) {
          technicalResults = executorOutput.technical_results;
        } else if (executorOutput.cat || executorOutput.buy_ladder) {
          // 如果輸出本身就是單檔股票的結果，轉換為 technical_results 格式
          const ticker = batch[0]?.Company_Code || batch[0]?.ticker || batch[0]?.company_code;
          if (ticker) {
            technicalResults[ticker] = executorOutput;
          }
        } else {
          // 嘗試直接使用 executorOutput（可能是按 ticker 組織的物件）
          technicalResults = executorOutput;
        }
        
        // 對批次中的每檔股票檢查觸發條件
        for (const stock of batch) {
          const ticker = stock.Company_Code || stock.ticker || stock.company_code;
          if (!ticker) continue;
          
          // 提取該股票的執行者輸出
          const stockExecutorOutput = technicalResults[ticker] || executorOutput;  // 從 technical_results 中提取
          
          // 準備股票數據（用於觸發條件檢查）
          const stockData = {
            ticker: ticker,
            ...stock,
            ...(technicalData[ticker] || {}),
            gap_abs: technicalData[ticker]?.gap_abs || 0,
            return_5d_abs: technicalData[ticker]?.return_5d_abs || 0,
            atr_change_pct: technicalData[ticker]?.atr_change_pct || 0,
            volume_20d_ratio: technicalData[ticker]?.volume_20d_ratio || 1.0,
            high_severity_news_count: technicalData[ticker]?.high_severity_news_count || 0,
            has_earnings_event: technicalData[ticker]?.has_earnings_event || false,
            has_major_conference: technicalData[ticker]?.has_major_conference || false,
            has_regulatory_event: technicalData[ticker]?.has_regulatory_event || false
          };
          
          // 檢查是否需要審查
          const reviewDecision = shouldReviewP3Stock(
            stockData,
            stockExecutorOutput,
            previousSnapshot,
            p0_5_snapshot,
            p0_7_snapshot,
            p2_snapshot,
            p2_5_snapshot
          );
          
          // 保存執行者輸出
          allExecutorOutputs[ticker] = {
            executor_output: stockExecutorOutput,
            needs_review: reviewDecision.needs_review,
            trigger_type: reviewDecision.trigger_type,
            reasons: reviewDecision.reasons,
            score: reviewDecision.score
          };
          
          // 如果需要審查，提交審查任務
          if (reviewDecision.needs_review) {
            Logger.log(`P3：股票 ${ticker} 觸發審查（${reviewDecision.trigger_type}），原因：${reviewDecision.reasons.join(", ")}`);
            
            // 準備審查任務的輸入
            const reviewM0InputPayload = {
              phase: "P3",
              frequency: params.frequency || "WEEKLY",
              trigger: "TRIGGERED_REVIEW",
              ticker: ticker,
              stock_data: stock,
              executor_output: stockExecutorOutput,
              technical_data: technicalData[ticker] || {},
              smart_money_data: smartMoneyData[ticker] || {},
              previous_snapshot: previousSnapshot,
              p0_5_snapshot: p0_5_snapshot,
              p0_7_snapshot: p0_7_snapshot,
              p2_snapshot: p2_snapshot,
              p2_5_snapshot: p2_5_snapshot,
              review_reasons: reviewDecision.reasons,
              trigger_type: reviewDecision.trigger_type
            };
            
            // 構建審查者 Prompt（需要包含原始資料）
            reviewM0InputPayload.p3_auditor_prompt = buildP3AuditorPrompt(
              stockExecutorOutput,
              stockData,
              reviewDecision.reasons
            );
            
            // 提交審查任務到 M0 Job Queue
            const reviewJobId = submitToM0JobQueue("P3", ["AUDITOR"], reviewM0InputPayload);
            reviewJobIds.push({ jobId: reviewJobId, ticker: ticker, trigger_type: reviewDecision.trigger_type });
            
            Logger.log(`P3：股票 ${ticker} 審查任務已提交，job_id=${reviewJobId}`);
          } else {
            Logger.log(`P3：股票 ${ticker} 不需要審查（Soft Trigger 分數：${reviewDecision.score || 0}）`);
          }
        }
        
      } catch (error) {
        Logger.log(`P3：處理 EXECUTOR job ${jobId} 失敗：${error.message}`);
        // 記錄失敗，但不中斷整個流程
      }
    }
    
    Logger.log(`P3：第二階段完成，共 ${reviewJobIds.length} 檔股票需要審查（共 ${Object.keys(allExecutorOutputs).length} 檔股票）`);
    
    return {
      status: "SUBMITTED_PHASE2",
      total_stocks: Object.keys(allExecutorOutputs).length,
      reviewed_stocks: reviewJobIds.length,
      review_job_ids: reviewJobIds,
      executor_outputs: allExecutorOutputs,
      message: `P3 觸發式審查處理完成，${reviewJobIds.length}/${Object.keys(allExecutorOutputs).length} 檔股票需要審查`
    };
    
  } catch (error) {
    Logger.log(`P3 觸發式審查處理失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.16 新增：構建 P3 審查者 Prompt（包含原始資料）
 */
function buildP3AuditorPrompt(executorOutput, stockData, reviewReasons) {
  // 讀取關鍵原始資料
  const p2_snapshot = getLatestP2Snapshot();
  const p2_5_snapshot = getLatestP2_5Snapshot();
  const previousSnapshot = getLatestP3Snapshot();
  
  const ticker = stockData.ticker;
  
  // 提取 P2 evidence_json（關鍵原始資料）
  let p2Evidence = null;
  if (p2_snapshot && p2_snapshot.tier_assignments_json) {
    const tierAssignments = typeof p2_snapshot.tier_assignments_json === 'string' ?
      JSON.parse(p2_snapshot.tier_assignments_json) : p2_snapshot.tier_assignments_json;
    const stockP2Data = tierAssignments[ticker];
    if (stockP2Data && stockP2Data.evidence_json) {
      p2Evidence = stockP2Data.evidence_json;
    }
  }
  
  // 提取 P2.5 數據（關鍵原始資料）
  let p2_5Data = null;
  if (p2_5_snapshot && p2_5_snapshot.p2_5_output_json) {
    const p2_5_output = typeof p2_5_snapshot.p2_5_output_json === 'string' ?
      JSON.parse(p2_5_snapshot.p2_5_output_json) : p2_5_snapshot.p2_5_output_json;
    p2_5Data = p2_5_output[ticker];
  }
  
  // 提取上週快照差異（關鍵原始資料）
  let snapshotDiff = null;
  if (previousSnapshot && previousSnapshot.technical_results) {
    const previousStock = previousSnapshot.technical_results[ticker];
    if (previousStock) {
      snapshotDiff = {
        cat: { previous: previousStock.cat, current: executorOutput.cat },
        risk_overlay_level: { previous: previousStock.risk_overlay_level || 0, current: executorOutput.risk_overlay_level || 0 },
        buy_ladder: { previous: previousStock.buy_ladder, current: executorOutput.buy_ladder },
        stop_ladder: { previous: previousStock.stop_ladder, current: executorOutput.stop_ladder },
        max_position_cap: { previous: previousStock.max_position_cap, current: executorOutput.max_position_cap }
      };
    }
  }
  
  // 提取技術指標（關鍵原始資料，程式算的數值）
  const technicalIndicators = {
    trend_state: stockData.trend_state,
    support_levels: stockData.support_levels,
    resistance_levels: stockData.resistance_levels,
    volume_profile_flags: stockData.volume_profile_flags,
    breakout_validity: stockData.breakout_validity
  };
  
  let prompt = `你是一位資深的審查者，負責審查 P3 技術分析的執行者輸出。

## ⚠️ 重要：你必須使用關鍵原始資料進行對照審查

你必須同時看到：
1. **執行者的輸出**（需要審查的內容）
2. **關鍵原始資料**（用於驗證執行者是否正確）

## 審查觸發原因

以下原因觸發了本次審查：
${reviewReasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## 執行者輸出

${JSON.stringify(executorOutput, null, 2)}

## 關鍵原始資料（用於對照驗證）

### P2 證據資料
${p2Evidence ? JSON.stringify(p2Evidence, null, 2) : "無 P2 證據資料"}

### P2.5 籌碼面數據
${p2_5Data ? JSON.stringify(p2_5Data, null, 2) : "無 P2.5 數據"}

### 技術指標（程式計算的數值）
${JSON.stringify(technicalIndicators, null, 2)}

### 上週 vs 本週差異
${snapshotDiff ? JSON.stringify(snapshotDiff, null, 2) : "無上週快照"}

## 你的審查任務

1. **對照原始資料驗證執行者的分析**：
   - 檢查 Cat 分類是否與技術指標一致
   - 檢查 Buy/Stop 價格是否與支撐壓力位一致
   - 檢查 risk_overlay_level 是否與 P0.5/P0.7 風險訊號一致
   - 檢查是否有邏輯錯誤或硬規則違反

2. **檢查觸發原因是否合理**：
   - 驗證觸發原因是否確實存在
   - 檢查執行者是否正確處理了觸發原因

3. **輸出審查結果**：
   - 必須明確說明是否對照了原始資料
   - 必須明確說明是否發現問題
   - 如果發現問題，必須提供修正建議

## 輸出格式

請以 JSON 格式輸出審查結果：

{
  "review_summary": "整體審查摘要（必須明確說明是否對照了原始資料）",
  "issues_found": [
    {
      "type": "邏輯錯誤|硬規則違反|數據不一致|其他",
      "description": "問題描述",
      "severity": "HIGH|MED|LOW",
      "suggestion": "修正建議"
    }
  ],
  "verification_results": {
    "cat_consistency": "一致|不一致（說明）",
    "price_consistency": "一致|不一致（說明）",
    "overlay_consistency": "一致|不一致（說明）",
    "logic_check": "通過|失敗（說明）"
  },
  "final_decision": "APPROVE|REJECT|MODIFY",
  "modified_output": { /* 如果需要修改，提供修改後的輸出 */ }
}`;

  return prompt;
}

/**
 * ⭐ V8.16 新增：從 M0 Job Queue 讀取執行結果
 */
function getM0JobResult(jobId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const resultSheet = ss.getSheetByName("M0__RESULT");
    
    if (!resultSheet) {
      return null;
    }
    
    const dataRange = resultSheet.getDataRange();
    const rows = dataRange.getValues();
    
    // 跳過標題行，查找匹配的 job_id
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === jobId) {  // job_id
        const resultJson = row[3];  // result_json
        if (resultJson) {
          return typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
        }
      }
    }
    
    return null;
  } catch (error) {
    Logger.log(`讀取 M0 Job 結果失敗：${error.message}`);
    return null;
  }
}

/**
 * 處理 P3 M0 執行結果
 * 
 * @param {string} jobId - Job ID
 * @param {Object} m0Result - M0 執行結果
 * @returns {Object} result - 處理結果
 */
function P3_ProcessM0Result(jobId, m0Result) {
  try {
    Logger.log(`P3 處理 M0 結果：jobId=${jobId}`);
    
    const executorOutput = m0Result.executor_output || {};
    const auditorOutput = m0Result.auditor_output || {};  // ⭐ V8.16 更新：可能為空（觸發式審查）
    const technicalData = m0Result.technical_data || {};
    const smartMoneyData = m0Result.smart_money_data || {};  // ⭐ P2.5 機構級數據
    
    // ⭐ V8.16 新增：檢查是否為觸發式審查（只有 AUDITOR 步驟）
    const isTriggeredReview = m0Result.trigger === "TRIGGERED_REVIEW";
    
    // 整合機構級視角（使用 P2.5 數據）
    const enhancedAnalysis = integrateInstitutionalPerspectiveP3(executorOutput, smartMoneyData || {});
    
    // ⭐ V8.15 新增：讀取 P0.5 和 P0.7 快照（用於 risk_overlay_level 計算）
    const p0_5_snapshot = getLatestP0_5Snapshot();
    const p0_7_snapshot = getLatestP0_7Snapshot();
    
    // 將 P0.5 和 P0.7 數據傳遞給 enhancedAnalysis（用於 risk_overlay_level 計算）
    enhancedAnalysis.p0_5_snapshot = p0_5_snapshot;
    enhancedAnalysis.p0_7_snapshot = p0_7_snapshot;
    
    // 生成 P3 輸出（包含 risk_overlay_level）
    // ⭐ V8.16 更新：如果沒有審查者輸出，只使用執行者輸出
    const p3Output = generateP3Output(enhancedAnalysis, auditorOutput || null, m0Result.frequency || "WEEKLY");
    
    // 保存快照
    const snapshot = saveP3Snapshot({
      job_id: jobId,
      trigger: m0Result.trigger || "WEEKLY",
      frequency: m0Result.frequency || "WEEKLY",
      technical_results: p3Output.technical_results,
      changes: compareWithPreviousSnapshotP3(p3Output),
      auto_trigger: checkAutoTriggerConditionsP3(p3Output),
      data_freshness: checkDataFreshness(technicalData)
    });
    
    // 觸發下游
    if (snapshot.changes && snapshot.changes.has_changes) {
      triggerDownstreamPhasesP3("P3", snapshot);
    }
    
    return {
      status: "COMPLETED",
      snapshot_id: snapshot.snapshot_id,
      p3_output: p3Output
    };
    
  } catch (error) {
    Logger.log(`P3 處理 M0 結果失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// M0 Job Queue 整合
// ==========================================

/**
 * 提交任務到 M0 Job Queue
 * 
 * @param {string} projectId - 專案 ID
 * @param {Array} requestedFlow - 請求的流程（["SONNET", "GPT"]）
 * @param {Object} inputPayload - 輸入數據
 * @returns {string} jobId - Job ID
 */
function submitToM0JobQueue(projectId, requestedFlow, inputPayload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const jobQueueSheet = ss.getSheetByName("M0__JOB_QUEUE");
  
  if (!jobQueueSheet) {
    throw new Error("M0__JOB_QUEUE 表格不存在");
  }
  
  const jobId = `JOB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  jobQueueSheet.appendRow([
    jobId,
    projectId,
    "NEW",
    JSON.stringify(requestedFlow),
    JSON.stringify(inputPayload),
    null,
    null,
    null,
    null,
    0,
    new Date()
  ]);
  
  Logger.log(`P3 任務已提交到 M0 Job Queue：job_id=${jobId}`);
  
  return jobId;
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 過濾有變動的股票（用於 P3 週度執行）
 * ⭐ V8.0 新增：週度只處理有變動的股票
 * 
 * @param {Array} phase2Output - P2 輸出數據（所有股票）
 * @returns {Array} changedStocks - 有變動的股票列表
 */
function filterChangedStocksForP3Weekly(phase2Output) {
  try {
    // 讀取 P2 和 P2.5 的最新快照，檢查變動
    const p2Snapshot = getLatestP2Snapshot();
    const p3Snapshot = getLatestP3Snapshot();
    
    const changedTickers = new Set();
    
    // 檢查 P2 變動
    if (p2Snapshot && p2Snapshot.changes && p2Snapshot.changes.has_changes) {
      // 從 P2 快照的 changes 中提取變動的股票
      if (p2Snapshot.changes.tier_changes) {
        p2Snapshot.changes.tier_changes.forEach(change => {
          if (change.ticker) {
            changedTickers.add(change.ticker);
          }
        });
      }
      if (p2Snapshot.changes.new_stocks) {
        p2Snapshot.changes.new_stocks.forEach(stock => {
          if (stock.ticker) {
            changedTickers.add(stock.ticker);
          }
        });
      }
      if (p2Snapshot.changes.removed_stocks) {
        p2Snapshot.changes.removed_stocks.forEach(stock => {
          if (stock.ticker) {
            changedTickers.add(stock.ticker);
          }
        });
      }
    }
    
    // 檢查 P3 變動（技術指標重大變化）
    if (p3Snapshot && p3Snapshot.changes_json) {
      const p3Changes = typeof p3Snapshot.changes_json === 'string' ? 
        JSON.parse(p3Snapshot.changes_json) : p3Snapshot.changes_json;
      
      if (p3Changes && p3Changes.has_changes) {
        // 檢查 Cat 變動
        if (p3Changes.cat_changes) {
          p3Changes.cat_changes.forEach(change => {
            if (change.ticker) {
              changedTickers.add(change.ticker);
            }
          });
        }
        // 檢查技術指標重大變化（例如：價格突破關鍵位、成交量異常等）
        if (p3Changes.technical_changes) {
          p3Changes.technical_changes.forEach(change => {
            if (change.ticker && change.severity === "HIGH") {
              changedTickers.add(change.ticker);
            }
          });
        }
      }
    }
    
    // 如果沒有快照或沒有變動記錄，返回所有股票（首次執行）
    if (changedTickers.size === 0 && (!p2Snapshot || !p3Snapshot)) {
      Logger.log("P3 週度：首次執行或無快照，處理所有股票");
      return phase2Output;
    }
    
    // 如果沒有變動，返回空陣列（不需要處理）
    if (changedTickers.size === 0) {
      Logger.log("P3 週度：無變動股票，跳過執行");
      return [];
    }
    
    // 過濾出有變動的股票
    const changedStocks = phase2Output.filter(stock => {
      const ticker = stock.Company_Code || stock.ticker || stock.company_code;
      return ticker && changedTickers.has(ticker);
    });
    
    Logger.log(`P3 週度：檢測到 ${changedTickers.size} 檔股票有變動，將處理 ${changedStocks.length} 檔`);
    
    return changedStocks;
    
  } catch (error) {
    Logger.log(`P3 週度：過濾變動股票失敗：${error.message}，將處理所有股票`);
    // 如果過濾失敗，返回所有股票（安全策略）
    return phase2Output;
  }
}

/**
 * 從表格讀取 P2 輸出
 * 
 * @returns {Array} outputs - P2 輸出數據
 */
function getPhase2OutputFromSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase2_Output");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const outputs = [];
    for (let i = 1; i < rows.length; i++) {
      const output = {};
      headers.forEach((header, colIndex) => {
        output[header.toLowerCase().replace(/_/g, "_")] = rows[i][colIndex];
      });
      outputs.push(output);
    }
    
    return outputs;
  } catch (error) {
    Logger.log(`讀取 Phase2_Output 失敗：${error.message}`);
    return [];
  }
}

/**
 * 讀取 P2.5 機構級數據（Smart Money Data）
 * 
 * @param {Array} phase2Output - P2 輸出數據
 * @returns {Object} smartMoneyData - P2.5 機構級數據（以 ticker 為 key）
 */
function getP2_5SmartMoneyData(phase2Output) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase2.5_Output");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P3：Phase2.5_Output 表格不存在或沒有數據，將使用空數據");
      return {};
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    // 建立 ticker 到數據的映射
    const smartMoneyData = {};
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const data = {};
      headers.forEach((header, colIndex) => {
        data[header] = row[colIndex];
      });
      
      const ticker = data.Company_Code || data.company_code;
      if (ticker) {
        smartMoneyData[ticker] = {
          Company_Code: data.Company_Code,
          Company_Name: data.Company_Name,
          Institutional_Holdings_Score: data.Institutional_Holdings_Score,
          Insider_Trading_Signal: data.Insider_Trading_Signal,
          Options_Flow_Sentiment: data.Options_Flow_Sentiment,
          Dark_Pool_Activity: data.Dark_Pool_Activity,
          Hedge_Fund_Clone_Score: data.Hedge_Fund_Clone_Score,
          Smart_Money_Score: data.Smart_Money_Score,
          Recommendations: data.Recommendations,
          Last_Updated: data.Last_Updated
        };
      }
    }
    
    Logger.log(`P3：成功讀取 ${Object.keys(smartMoneyData).length} 個公司的 P2.5 機構級數據`);
    
    return smartMoneyData;
  } catch (error) {
    Logger.log(`P3：讀取 P2.5 機構級數據失敗：${error.message}`);
    return {};
  }
}
