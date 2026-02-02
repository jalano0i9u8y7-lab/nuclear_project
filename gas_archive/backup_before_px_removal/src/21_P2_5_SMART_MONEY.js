/**
 * 💰 P2.5: 機構級籌碼面分析（Smart Money Analysis）
 * 
 * 基本面是底，籌碼面是因，技術面是果
 * 
 * 基於 P2 的基本面分析，進行機構級籌碼面分析：
 * - 13F 機構持倉變化
 * - 內部人交易
 * - 對沖基金 Clone
 * - 異常期權活動
 * - Dark Pool 活動
 * 
 * 執行頻率：
 * - P2.5_MONTHLY：每月執行（與 P2_MONTHLY 同步）
 * - P2.5_QUARTERLY：每季執行（與 P2_QUARTERLY 同步，包含 13F 分析）
 * 
 * @version SSOT V7.1
 * @date 2025-01-15
 */

// ==========================================
// P2.5 配置參數
// ==========================================

const P2_5_CONFIG = {
  // ⭐ V8.0 新增：批次處理配置
  BATCH_SIZE: 6,  // 批次大小（6 家/批，符合成本估算假設）
  BATCH_DELAY_MS: 2000,  // 批次間延遲（毫秒，避免 API 限流）
  
  // 執行頻率
  frequency_monthly: "MONTHLY",  // 每月執行
  frequency_quarterly: "QUARTERLY",  // 每季執行
  
  // 數據來源（從 P5 Daily 收集的數據中讀取）
  data_sources: {
    institutional_holdings: "SMART_MONEY_DAILY",  // 13F 持倉數據
    insider_trading: "SMART_MONEY_DAILY",         // 內部人交易
    options_flow: "DERIVATIVES_DAILY",            // 期權活動（已存在）
    dark_pool: "SMART_MONEY_DAILY"                // Dark Pool 活動
  },
  
  // 評分權重
  scoring_weights: {
    institutional_holdings: 0.35,  // 機構持倉變化權重 35%
    insider_trading: 0.25,          // 內部人交易權重 25%
    options_flow: 0.20,              // 期權活動權重 20%
    dark_pool: 0.20                  // Dark Pool 活動權重 20%
  },
  
  // 對 P3 的影響權重
  p3_influence: {
    cat_adjustment_weight: 0.30,     // Cat 分類調整權重 30%
    buy_price_adjustment_pct: 0.02   // Buy 價格調整幅度 2%
  }
};

// ==========================================
// P2.5 核心執行函數
// ==========================================

/**
 * P2.5 主執行函數（月度）
 * @param {Object} params - 參數
 * @param {string} params.trigger - 觸發來源（P2_MONTHLY / MONTHLY / MANUAL）
 * @param {string} params.p2_snapshot_id - P2 快照 ID（可選，如果不提供則使用最新）
 * @return {Object} P2.5 分析結果
 */
function P2_5_Monthly_Execute(params) {
  return P2_5_Execute({
    ...params,
    frequency: "MONTHLY",
    project_id: "P2_5_MONTHLY"
  });
}

/**
 * P2.5 主執行函數（季度）
 * @param {Object} params - 參數
 * @param {string} params.trigger - 觸發來源（P2_QUARTERLY / QUARTERLY / MANUAL）
 * @param {string} params.p2_snapshot_id - P2 快照 ID（可選，如果不提供則使用最新）
 * @return {Object} P2.5 分析結果
 */
function P2_5_Quarterly_Execute(params) {
  return P2_5_Execute({
    ...params,
    frequency: "QUARTERLY",
    project_id: "P2_5_QUARTERLY"
  });
}

/**
 * P2.5 主執行函數（內部）
 * @param {Object} params - 參數
 * @param {string} params.frequency - 執行頻率（MONTHLY / QUARTERLY）
 * @param {string} params.project_id - 項目 ID（P2_5_MONTHLY / P2_5_QUARTERLY）
 * @param {string} params.trigger - 觸發來源
 * @param {string} params.p2_snapshot_id - P2 快照 ID（可選）
 * @return {Object} P2.5 分析結果
 */
function P2_5_Execute(params) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P2.5 執行開始：frequency=${params.frequency}, trigger=${params.trigger}`);
    
    // ========================================
    // Step 1: 讀取 P2 快照
    // ========================================
    
    // 讀取 P2 快照
    let p2Snapshot;
    
    // ⭐ V8.17 更新：如果指定了 p2_snapshot_id，使用 getP2SnapshotById 查詢
    if (params.p2_snapshot_id) {
      p2Snapshot = getP2SnapshotById(params.p2_snapshot_id);
      if (!p2Snapshot) {
        Logger.log(`警告：指定的 P2 快照 ID ${params.p2_snapshot_id} 不存在，改用最新快照`);
        p2Snapshot = getLatestP2Snapshot();
      } else {
        Logger.log(`使用指定的 P2 快照：${params.p2_snapshot_id}`);
      }
    } else {
      p2Snapshot = getLatestP2Snapshot();
    }
    
    if (!p2Snapshot) {
      throw new Error("P2 快照不存在，無法執行 P2.5");
    }
    
    // 從 P2 快照中提取股票列表
    const tierAssignments = p2Snapshot.tier_assignments_json ? 
      (typeof p2Snapshot.tier_assignments_json === 'string' ?
        JSON.parse(p2Snapshot.tier_assignments_json) :
        p2Snapshot.tier_assignments_json) : {};
    
    const tickers = Object.keys(tierAssignments);
    
    if (tickers.length === 0) {
      Logger.log("P2.5：P2 快照中無股票，跳過執行");
      return {
        status: "SKIPPED",
        message: "P2 快照中無股票"
      };
    }
    
    // ========================================
    // Step 2: 收集籌碼面數據（從 P5 Daily 讀取）
    // ========================================
    
    Logger.log(`P2.5：開始收集 ${tickers.length} 檔股票的籌碼面數據`);
    
    const smartMoneyData = collectSmartMoneyData(tickers, params.frequency);
    
    // ========================================
    // Step 3: ⭐ V8.17 新增：Batch API 處理邏輯
    // ========================================
    
    Logger.log(`P2.5：開始處理（共 ${tickers.length} 檔股票）`);
    
    // ⭐ V8.17 新增：判斷是否使用 Batch API
    const useBatch = shouldUseBatch(params.project_id);
    const executorModel = TASK_TO_EXECUTOR[params.project_id] || "SONNET";
    const executorConfig = M0_MODEL_CONFIG[executorModel];
    const canUseBatch = useBatch && executorConfig && executorConfig.supportsBatch;
    
    if (canUseBatch) {
      Logger.log(`P2.5：使用 Batch API（Provider: ${executorConfig.adapter === "M0_Adapter_Claude" ? "anthropic" : "openai"}, Model: ${executorConfig.model}）`);
      
      // ⭐ V8.17 新增：使用 Batch API 處理所有股票
      return P2_5_ExecuteWithBatch(params, tickers, smartMoneyData, p2Snapshot);
    } else {
      Logger.log(`P2.5：使用同步 API（不適用 Batch 或模型不支援）`);
      
      // ⭐ V8.0 保留：同步 API 處理（舊邏輯）
      return P2_5_ExecuteWithSyncAPI(params, tickers, smartMoneyData, p2Snapshot);
    }
    
      } catch (error) {
        Logger.log(`P2.5 執行失敗：${error.message}`);
        throw error;
      }
    }

/**
 * ⭐ V8.17 新增：P2.5 使用 Batch API 執行
 * 
 * 收集所有股票的請求，統一提交到 Batch API
 * 
 * @param {Object} params - 執行參數
 * @param {Array<string>} tickers - 股票列表
 * @param {Object} smartMoneyData - 籌碼面數據
 * @param {Object} p2Snapshot - P2 快照
 * @returns {Object} 執行結果
 */
function P2_5_ExecuteWithBatch(params, tickers, smartMoneyData, p2Snapshot) {
  try {
    Logger.log(`P2.5：開始 Batch API 處理（共 ${tickers.length} 檔股票）`);
    
    // 確定 Provider 和 Model
    const executorModel = TASK_TO_EXECUTOR[params.project_id] || "SONNET";
    const executorConfig = M0_MODEL_CONFIG[executorModel];
    const provider = executorConfig.adapter === "M0_Adapter_Claude" ? "anthropic" : "openai";
    
    // 構建靜態 System Blocks（可 cache 的內容）
    const staticSystemBlocks = buildP2_5StaticSystemBlocks(params.frequency);
    
    // 收集所有股票的 Batch Requests
    const batchRequests = [];
    
    for (const ticker of tickers) {
      // 構建單一股票的 User Payload
      const tickerSmartMoneyData = {
        institutional_holdings: smartMoneyData.institutional_holdings?.[ticker] || {},
        insider_trading: smartMoneyData.insider_trading?.[ticker] || {},
        options_flow: smartMoneyData.options_flow?.[ticker] || {},
        dark_pool: smartMoneyData.dark_pool?.[ticker] || {}
      };
      
      const userPayload = {
        ticker: ticker,
        smart_money_data: tickerSmartMoneyData,
        p2_snapshot_id: p2Snapshot.snapshot_id,
        frequency: params.frequency
      };
      
      // 構建 User Message（動態內容）
      const userMessage = buildP2_5Prompt([ticker], tickerSmartMoneyData, params.frequency);
      
      // 創建 Batch Request
      const batchRequest = createBatchRequest({
        custom_id: `P2_5_${ticker}_${params.frequency}_${Date.now()}`,
        system_blocks: staticSystemBlocks,  // ⭐ 可 cache 的靜態內容
        user_payload: userMessage,  // 動態內容（轉為字串）
        max_output_tokens: executorConfig.maxOutputTokens || 8000
      });
      
      batchRequests.push(batchRequest);
    }
    
    Logger.log(`P2.5：已收集 ${batchRequests.length} 個 Batch Requests`);
    
    // 創建內部 Batch Job
    const batchJobId = `P2_5_${params.frequency}_${Date.now()}`;
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
    Logger.log(`P2.5：提交 Batch Job 到 ${provider}（${batchRequests.length} 個請求）`);
    const submitResult = submitBatchJob(internalBatchJob);
    
    Logger.log(`P2.5：Batch Job 已提交，batch_id=${submitResult.batch_id}, provider_batch_id=${submitResult.provider_batch_id}`);
    
    return {
      status: "SUBMITTED_BATCH",
      batch_id: submitResult.batch_id,
      provider_batch_id: submitResult.provider_batch_id,
      request_count: batchRequests.length,
      frequency: params.frequency,
      project_id: params.project_id,
      message: `P2.5 ${params.frequency} Batch Job 已提交（${batchRequests.length} 個請求），請等待完成後執行 P2_5_ProcessBatchResults() 處理結果`
    };
    
  } catch (error) {
    Logger.log(`P2.5 Batch API 處理失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.17 新增：P2.5 使用同步 API 執行（保留舊邏輯）
 * 
 * @param {Object} params - 執行參數
 * @param {Array<string>} tickers - 股票列表
 * @param {Object} smartMoneyData - 籌碼面數據
 * @param {Object} p2Snapshot - P2 快照
 * @returns {Object} 執行結果
 */
function P2_5_ExecuteWithSyncAPI(params, tickers, smartMoneyData, p2Snapshot) {
  const BATCH_SIZE = P2_5_CONFIG.BATCH_SIZE || 6;  // 6 家/批
  const totalBatches = Math.ceil(tickers.length / BATCH_SIZE);
  
  Logger.log(`P2.5：開始分批處理（共 ${tickers.length} 檔股票，分成 ${totalBatches} 批，每批 ${BATCH_SIZE} 檔）`);
  
  const requestedFlow = [
    "EXECUTOR",  // Step 1: 執行者（自動選擇：Claude Sonnet 4.5）
    "AUDITOR"    // Step 2: 審查者（自動選擇：GPT-5.2）
  ];
  
  const allBatchJobIds = [];
  
  // 分批處理
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    
    Logger.log(`P2.5：處理批次 ${batchNumber}/${totalBatches} (${batch.length} 檔股票)`);
    
    try {
      // 提取這批股票的籌碼面數據
      const batchSmartMoneyData = {};
      batch.forEach(ticker => {
        if (smartMoneyData.institutional_holdings && smartMoneyData.institutional_holdings[ticker]) {
          if (!batchSmartMoneyData.institutional_holdings) batchSmartMoneyData.institutional_holdings = {};
          batchSmartMoneyData.institutional_holdings[ticker] = smartMoneyData.institutional_holdings[ticker];
        }
        if (smartMoneyData.insider_trading && smartMoneyData.insider_trading[ticker]) {
          if (!batchSmartMoneyData.insider_trading) batchSmartMoneyData.insider_trading = {};
          batchSmartMoneyData.insider_trading[ticker] = smartMoneyData.insider_trading[ticker];
        }
        if (smartMoneyData.options_flow && smartMoneyData.options_flow[ticker]) {
          if (!batchSmartMoneyData.options_flow) batchSmartMoneyData.options_flow = {};
          batchSmartMoneyData.options_flow[ticker] = smartMoneyData.options_flow[ticker];
        }
        if (smartMoneyData.dark_pool && smartMoneyData.dark_pool[ticker]) {
          if (!batchSmartMoneyData.dark_pool) batchSmartMoneyData.dark_pool = {};
          batchSmartMoneyData.dark_pool[ticker] = smartMoneyData.dark_pool[ticker];
        }
      });
      
      // 準備批次 M0 Job 輸入
      const batchM0InputPayload = {
        trigger: params.trigger || params.frequency,
        frequency: params.frequency,
        p2_snapshot_id: p2Snapshot.snapshot_id,
        tickers: batch,  // ⭐ 只包含這批股票
        smart_money_data: batchSmartMoneyData,  // ⭐ 只包含這批股票的籌碼面數據
        p2_5_prompt: buildP2_5BatchPrompt(batch, batchSmartMoneyData, params.frequency, batchNumber, totalBatches),
        batch_number: batchNumber,  // ⭐ V8.0 新增：批次編號
        total_batches: totalBatches,  // ⭐ V8.0 新增：總批數
        is_batch_processing: true  // ⭐ V8.0 新增：標記為批次處理
      };
      
      // 提交批次到 M0 Job Queue
      Logger.log(`P2.5：提交批次 ${batchNumber} 到 M0 Job Queue`);
      const batchJobId = submitToM0JobQueue(params.project_id, requestedFlow, batchM0InputPayload);
      allBatchJobIds.push(batchJobId);
      
      Logger.log(`P2.5：批次 ${batchNumber} 已提交，job_id=${batchJobId}`);
      
      // 批次間延遲，避免 API 限流
      if (i + BATCH_SIZE < tickers.length) {
        Utilities.sleep(P2_5_CONFIG.BATCH_DELAY_MS || 2000);
      }
      
    } catch (error) {
      Logger.log(`P2.5：批次 ${batchNumber} 處理失敗：${error.message}`);
      // 記錄失敗的批次，但不中斷整個流程
    }
  }
  
  Logger.log(`P2.5：所有批次已提交（共 ${allBatchJobIds.length} 個任務）`);
  
  return {
    status: "SUBMITTED",
    job_ids: allBatchJobIds,  // ⭐ V8.0 新增：返回所有批次 job ID
    total_batches: totalBatches,
    message: `P2.5 任務已分批提交到 M0 Job Queue（${totalBatches} 批），請等待執行完成`
  };
}

/**
 * ⭐ V8.17 新增：構建 P2.5 靜態 System Blocks
 * 
 * @param {string} frequency - 執行頻率
 * @returns {Array} System Blocks
 */
function buildP2_5StaticSystemBlocks(frequency) {
  return [
    {
      type: "text",
      text: `你是 P2.5 機構級籌碼面分析專家。你的任務是基於提供的籌碼面數據，進行機構級分析，識別機構持倉變化、內部人交易、期權活動、Dark Pool 活動和對沖基金 Clone 信號。${frequency === "QUARTERLY" ? "這是季度分析，需要更深入，包含 13F 持倉變化的詳細分析。" : "這是月度分析，重點關注近期變化趨勢。"}`,
      cache_control: { type: "ephemeral" }
    }
  ];
}

/**
 * ⭐ V8.0 新增：提交 P2.5 任務到 M0 Job Queue
 * @param {string} projectId - 專案 ID
 * @param {Array} requestedFlow - 請求的流程步驟
 * @param {Object} inputPayload - 輸入負載
 * @returns {string} jobId - 任務 ID
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
    null,  // started_at
    null,  // finished_at
    null,  // error_code
    null,  // error_message
    0,     // retry_count
    new Date()  // created_at
  ]);
  
  Logger.log(`P2.5 任務已提交到 M0 Job Queue：job_id=${jobId}`);
  
  return jobId;
}

/**
 * 處理 P2.5 M0 執行結果（由 M0 調用）
 * @param {string} jobId - 任務 ID
 * @param {Object} m0Result - M0 執行結果
 * @return {Object} P2.5 處理結果
 */
function P2_5_ProcessM0Result(jobId, m0Result) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P2.5 處理 M0 結果：jobId=${jobId}`);
    
    // ========================================
    // Step 1: 解析 M0 結果
    // ========================================
    
    const executorOutput = m0Result.executor_output || {};
    const auditorOutput = m0Result.auditor_output || {};
    const smartMoneyData = m0Result.smart_money_data || {};
    
    // ========================================
    // Step 2: 計算 Smart_Money_Score
    // ========================================
    
    const smartMoneyScores = calculateSmartMoneyScores(executorOutput, smartMoneyData);
    
    // ========================================
    // Step 3: 生成 P2.5 輸出結構
    // ========================================
    
    const p2_5Output = generateP2_5Output(executorOutput, auditorOutput, smartMoneyScores);
    
    // ========================================
    // Step 4: 保存到 Phase2.5_Output 表格
    // ========================================
    
    const savedCount = saveToPhase2_5Output(p2_5Output.phase2_5_output);
    
    // ========================================
    // Step 5: 保存快照
    // ========================================
    
    const snapshot = saveP2_5Snapshot({
      job_id: jobId,
      trigger: m0Result.trigger || "MONTHLY",
      p2_5_output: p2_5Output,
      p2_snapshot_id: m0Result.p2_snapshot_id,
      changes: compareWithPreviousSnapshotP2_5(p2_5Output)
    });
    
    // ========================================
    // Step 6: 檢查是否需要觸發下游（P3）
    // ========================================
    
    if (snapshot.changes && snapshot.changes.has_changes) {
      // 有變動，觸發 P3
      triggerDownstreamPhasesP2_5("P2_5", snapshot);
    }
    
    const duration = Date.now() - startTime;
    Logger.log(`P2.5 處理完成：snapshot_id=${snapshot.snapshot_id}, 耗時=${duration}ms`);
    
    return {
      status: "COMPLETED",
      snapshot_id: snapshot.snapshot_id,
      p2_5_output: p2_5Output,
      changes: snapshot.changes
    };
    
  } catch (error) {
    Logger.log(`P2.5 處理 M0 結果失敗：${error.message}`);
    throw error;
  }
}

/**
 * ⭐ V8.17 新增：處理 P2.5 Batch 結果
 * 
 * @param {string} batchId - Batch Job ID（內部 ID）
 * @param {Object} params - 參數
 * @param {string} params.project_id - 項目 ID
 * @param {string} params.frequency - 執行頻率
 * @param {string} params.p2_snapshot_id - P2 快照 ID
 * @param {Object} params.smartMoneyData - 籌碼面數據（完整）
 * @returns {Object} 處理結果
 */
function P2_5_ProcessBatchResults(batchId, params) {
  try {
    const projectId = params.project_id || "P2_5_MONTHLY";
    Logger.log(`P2.5：開始處理 Batch 結果：${batchId}`);
    
    // 查詢 Batch 狀態
    let status = getBatchJobStatus(batchId);
    let pollCount = 0;
    const maxPolls = 120;  // 最多輪詢 120 次（2 小時，每次 1 分鐘）
    
    // 輪詢直到完成
    while (status.status !== "ended" && status.status !== "completed" && pollCount < maxPolls) {
      Logger.log(`P2.5：Batch 狀態：${status.status}，進度：${status.progress.toFixed(1)}%`);
      Utilities.sleep(60000);  // 等待 1 分鐘
      status = getBatchJobStatus(batchId);
      pollCount++;
    }
    
    if (status.status !== "ended" && status.status !== "completed") {
      throw new Error(`Batch 未在預期時間內完成，狀態：${status.status}`);
    }
    
    Logger.log(`P2.5：Batch 已完成，開始獲取結果`);
    
    // 獲取 Batch 結果
    const batchResults = fetchBatchJobResults(batchId);
    
    Logger.log(`P2.5：Batch 結果已獲取，成功：${batchResults.summary.succeeded}，失敗：${batchResults.summary.failed}`);
    
    // 處理結果
    const processedResults = {};
    const errors = [];
    
    for (const result of batchResults.results) {
      const customId = result.custom_id;
      
      // 從 custom_id 提取 ticker（格式：P2_5_TICKER_frequency_timestamp）
      const tickerMatch = customId.match(/P2_5_([^_]+)_/);
      const ticker = tickerMatch ? tickerMatch[1] : null;
      
      if (!ticker) {
        Logger.log(`P2.5：無法從 custom_id 提取 ticker：${customId}`);
        continue;
      }
      
      // 解析執行者輸出
      let executorOutput = result.output;
      if (typeof executorOutput === 'string') {
        try {
          // 嘗試移除 markdown 代碼塊
          let jsonString = executorOutput.trim();
          if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
          } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          executorOutput = JSON.parse(jsonString);
        } catch (e) {
          Logger.log(`P2.5：解析執行者輸出失敗（${ticker}）：${e.message}`);
          errors.push({ ticker: ticker, error: e.message, raw_output: executorOutput });
          continue;
        }
      }
      
      // 提取該股票的籌碼面分析結果
      const tickerAnalysis = executorOutput.smart_money_analysis?.[ticker] || executorOutput;
      
      // 準備計算 Smart Money Score 的數據格式
      const executorOutputForScoring = {
        smart_money_analysis: {
          [ticker]: tickerAnalysis
        }
      };
      
      const smartMoneyDataForScoring = {
        institutional_holdings: {
          [ticker]: params.smartMoneyData?.institutional_holdings?.[ticker] || {}
        },
        insider_trading: {
          [ticker]: params.smartMoneyData?.insider_trading?.[ticker] || {}
        },
        options_flow: {
          [ticker]: params.smartMoneyData?.options_flow?.[ticker] || {}
        },
        dark_pool: {
          [ticker]: params.smartMoneyData?.dark_pool?.[ticker] || {}
        }
      };
      
      // 計算 Smart Money Score
      const scores = calculateSmartMoneyScores(executorOutputForScoring, smartMoneyDataForScoring);
      const smartMoneyScore = scores?.[ticker] || tickerAnalysis.smart_money_score || 0;
      
      processedResults[ticker] = {
        ticker: ticker,
        smart_money_analysis: tickerAnalysis,
        smart_money_score: smartMoneyScore,
        confidence_level: executorOutput.confidence_level || 0.5
      };
    }
    
    Logger.log(`P2.5：Batch 結果處理完成，成功：${Object.keys(processedResults).length}，失敗：${errors.length}`);
    
    // 生成 P2.5 輸出結構
    const p2_5Output = {
      phase2_5_output: processedResults,
      summary: {
        total_tickers: Object.keys(processedResults).length,
        succeeded: Object.keys(processedResults).length,
        failed: errors.length,
        errors: errors
      },
      confidence_level: Object.values(processedResults).reduce((sum, r) => sum + (r.confidence_level || 0), 0) / Object.keys(processedResults).length || 0.5,
      analysis_date: new Date().toISOString().split('T')[0]
    };
    
    // 保存到 Phase2.5_Output 表格
    const savedCount = saveToPhase2_5Output(p2_5Output.phase2_5_output);
    
    // 保存快照
    const snapshot = saveP2_5Snapshot({
      job_id: batchId,
      trigger: params.frequency || "MONTHLY",
      p2_5_output: p2_5Output,
      p2_snapshot_id: params.p2_snapshot_id,
      changes: compareWithPreviousSnapshotP2_5(p2_5Output)
    });
    
    // 檢查是否需要觸發下游（P3）
    if (snapshot.changes && snapshot.changes.has_changes) {
      // 有變動，觸發 P3
      triggerDownstreamPhasesP2_5("P2_5", snapshot);
    }
    
    return {
      status: "PROCESSED",
      batch_id: batchId,
      snapshot_id: snapshot.snapshot_id,
      total_tickers: Object.keys(processedResults).length,
      succeeded: Object.keys(processedResults).length,
      failed: errors.length,
      results: processedResults,
      errors: errors,
      p2_5_output: p2_5Output,
      message: `P2.5 Batch 結果處理完成，成功：${Object.keys(processedResults).length}，失敗：${errors.length}`
    };
    
  } catch (error) {
    Logger.log(`P2.5 Batch 結果處理失敗：${error.message}`);
    throw error;
  }
}

// 注意：以下函數在其他檔案中定義：
// - collectSmartMoneyData: 21_P2_5_DATA.js
// - buildP2_5Prompt: 21_P2_5_PROMPT.js
// - calculateSmartMoneyScores: 21_P2_5_SCORING.js
// - generateP2_5Output: 21_P2_5_ANALYSIS.js
// - saveToPhase2_5Output: 21_P2_5_ANALYSIS.js
// - saveP2_5Snapshot: 21_P2_5_SNAPSHOT.js
// - compareWithPreviousSnapshotP2_5: 21_P2_5_SNAPSHOT.js
// - triggerDownstreamPhasesP2_5: 21_P2_5_SNAPSHOT.js
