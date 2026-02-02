/**
 * 🔗 M0 Batch 整合模組（通用 Batch 執行函數）
 * 
 * 提供統一的 Batch API 執行介面，供各 Phase 使用
 * 
 * @version SSOT V8.17
 * @date 2026-01-19
 */

// ==========================================
// 通用 Batch 執行函數
// ==========================================

/**
 * 執行 Batch Job（通用函數）
 * 
 * @param {Object} params - 參數
 * @param {string} params.project_id - 項目 ID
 * @param {string} params.frequency - 執行頻率（WEEKLY/MONTHLY/QUARTERLY）
 * @param {Array} params.items - 待處理項目列表（例如：股票列表、公司列表）
 * @param {Function} params.buildSystemBlocks - 構建 System Blocks 的函數
 * @param {Function} params.buildUserPayload - 構建 User Payload 的函數（接收 item 作為參數）
 * @param {Object} params.context - 上下文數據
 * @returns {Object} { batch_id, provider_batch_id, status, request_count }
 */
function executeBatchJob(params) {
  try {
    const projectId = params.project_id;
    const items = params.items || [];
    const frequency = params.frequency || "WEEKLY";
    
    Logger.log(`${projectId}：開始 Batch API 處理（共 ${items.length} 個項目）`);
    
    // 判斷是否適用 Batch
    const useBatch = shouldUseBatch(projectId);
    if (!useBatch) {
      throw new Error(`${projectId} 不適用 Batch API`);
    }
    
    // 確定 Provider 和 Model
    const executorModel = TASK_TO_EXECUTOR[projectId] || "SONNET";
    const executorConfig = M0_MODEL_CONFIG[executorModel];
    
    if (!executorConfig || !executorConfig.supportsBatch) {
      throw new Error(`${projectId} 使用的模型 ${executorModel} 不支援 Batch API`);
    }
    
    const provider = executorConfig.adapter === "M0_Adapter_Claude" ? "anthropic" : "openai";
    
    // 構建靜態 System Blocks（可 cache 的內容）
    const staticSystemBlocks = params.buildSystemBlocks ? 
      params.buildSystemBlocks(params.context) : 
      buildDefaultSystemBlocks(projectId, params.context);
    
    // 收集所有項目的 Batch Requests
    const batchRequests = [];
    
    for (const item of items) {
      // 構建單一項目的 User Payload
      const userPayload = params.buildUserPayload ? 
        params.buildUserPayload(item, params.context) : 
        buildDefaultUserPayload(item, params.context);
      
      // 構建 User Message（動態內容）
      const userMessage = typeof userPayload === 'string' ? 
        userPayload : 
        JSON.stringify(userPayload, null, 2);
      
      // 提取 custom_id（從 item 中提取或生成）
      const customId = item.ticker || item.company_code || item.id || 
        `${projectId}_${items.indexOf(item)}_${Date.now()}`;
      
      // 創建 Batch Request
      const batchRequest = createBatchRequest({
        custom_id: `${projectId}_${customId}_${frequency}_${Date.now()}`,
        system_blocks: staticSystemBlocks,  // ⭐ 可 cache 的靜態內容
        user_payload: userMessage,  // 動態內容（轉為字串）
        max_output_tokens: executorConfig.maxOutputTokens || 8000
      });
      
      batchRequests.push(batchRequest);
    }
    
    Logger.log(`${projectId}：已收集 ${batchRequests.length} 個 Batch Requests`);
    
    // 創建內部 Batch Job
    const batchJobId = `${projectId}_${frequency}_${Date.now()}`;
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
    Logger.log(`${projectId}：提交 Batch Job 到 ${provider}（${batchRequests.length} 個請求）`);
    const submitResult = submitBatchJob(internalBatchJob);
    
    Logger.log(`${projectId}：Batch Job 已提交，batch_id=${submitResult.batch_id}, provider_batch_id=${submitResult.provider_batch_id}`);
    
    return {
      status: "SUBMITTED_BATCH",
      batch_id: submitResult.batch_id,
      provider_batch_id: submitResult.provider_batch_id,
      request_count: batchRequests.length,
      frequency: frequency,
      project_id: projectId,
      message: `${projectId} ${frequency} Batch Job 已提交（${batchRequests.length} 個請求），請等待完成後執行對應的 ProcessBatchResults() 函數`
    };
    
  } catch (error) {
    Logger.log(`${params.project_id} Batch API 處理失敗：${error.message}`);
    throw error;
  }
}

/**
 * 處理 Batch 結果（通用函數）
 * 
 * @param {string} batchId - Batch Job ID（內部 ID）
 * @param {Object} params - 參數
 * @param {string} params.project_id - 項目 ID
 * @param {Function} params.processResult - 處理單一結果的函數（接收 result, item, context）
 * @param {Array} params.items - 原始項目列表（用於對應結果）
 * @param {Object} params.context - 上下文數據
 * @returns {Object} 處理結果
 */
function processBatchJobResults(batchId, params) {
  try {
    const projectId = params.project_id;
    Logger.log(`${projectId}：開始處理 Batch 結果：${batchId}`);
    
    // 查詢 Batch 狀態
    let status = getBatchJobStatus(batchId);
    let pollCount = 0;
    const maxPolls = 120;  // 最多輪詢 120 次（2 小時，每次 1 分鐘）
    
    // 輪詢直到完成
    while (status.status !== "ended" && status.status !== "completed" && pollCount < maxPolls) {
      Logger.log(`${projectId}：Batch 狀態：${status.status}，進度：${status.progress.toFixed(1)}%`);
      Utilities.sleep(60000);  // 等待 1 分鐘
      status = getBatchJobStatus(batchId);
      pollCount++;
    }
    
    if (status.status !== "ended" && status.status !== "completed") {
      throw new Error(`Batch 未在預期時間內完成，狀態：${status.status}`);
    }
    
    Logger.log(`${projectId}：Batch 已完成，開始獲取結果`);
    
    // 獲取 Batch 結果
    const batchResults = fetchBatchJobResults(batchId);
    
    Logger.log(`${projectId}：Batch 結果已獲取，成功：${batchResults.summary.succeeded}，失敗：${batchResults.summary.failed}`);
    
    // 處理結果
    const processedResults = {};
    const errors = [];
    
    // 建立 items 索引（用於對應結果）
    const itemsMap = {};
    if (params.items) {
      for (const item of params.items) {
        const key = item.ticker || item.company_code || item.id || items.indexOf(item).toString();
        itemsMap[key] = item;
      }
    }
    
    for (const result of batchResults.results) {
      const customId = result.custom_id;
      
      // 從 custom_id 提取 key（格式：PROJECT_ID_KEY_frequency_timestamp）
      const keyMatch = customId.match(new RegExp(`${projectId}_([^_]+)_`));
      const key = keyMatch ? keyMatch[1] : null;
      
      if (!key) {
        Logger.log(`${projectId}：無法從 custom_id 提取 key：${customId}`);
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
          Logger.log(`${projectId}：解析執行者輸出失敗（${key}）：${e.message}`);
          errors.push({ key: key, error: e.message, raw_output: executorOutput });
          continue;
        }
      }
      
      // 獲取對應的 item
      const item = itemsMap[key] || { id: key };
      
      // 處理結果
      if (params.processResult) {
        try {
          const processed = params.processResult(executorOutput, item, params.context);
          processedResults[key] = processed;
        } catch (error) {
          Logger.log(`${projectId}：處理結果失敗（${key}）：${error.message}`);
          errors.push({ key: key, error: error.message, output: executorOutput });
        }
      } else {
        processedResults[key] = executorOutput;
      }
    }
    
    Logger.log(`${projectId}：Batch 結果處理完成，成功：${Object.keys(processedResults).length}，失敗：${errors.length}`);
    
    return {
      status: "PROCESSED",
      batch_id: batchId,
      total_items: params.items ? params.items.length : 0,
      succeeded: Object.keys(processedResults).length,
      failed: errors.length,
      results: processedResults,
      errors: errors,
      message: `${projectId} Batch 結果處理完成，成功：${Object.keys(processedResults).length}，失敗：${errors.length}`
    };
    
  } catch (error) {
    Logger.log(`${params.project_id} Batch 結果處理失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 構建預設 System Blocks
 */
function buildDefaultSystemBlocks(projectId, context) {
  // 根據 projectId 返回對應的 System Blocks
  // 這裡可以擴展為各 Phase 的專屬 System Blocks
  return [
    {
      type: "text",
      text: `你是 ${projectId} 的分析專家。請根據提供的數據進行分析。`,
      cache_control: { type: "ephemeral" }
    }
  ];
}

/**
 * 構建預設 User Payload
 */
function buildDefaultUserPayload(item, context) {
  return {
    item: item,
    context: context
  };
}
