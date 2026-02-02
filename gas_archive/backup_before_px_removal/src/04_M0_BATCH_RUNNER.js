/**
 * 📦 M0 Batch Runner（統一 Batch 抽象層）
 * 
 * 工程師只處理統一的內部 Batch Job 格式，不直接處理各 Provider API
 * 
 * @version SSOT V8.17
 * @date 2026-01-19
 */

// ==========================================
// 內部 Batch Job Schema（統一格式）
// ==========================================

/**
 * 創建內部 Batch Job
 * 
 * @param {Object} params - 參數
 * @param {string} params.job_id - Job ID（例如：P5B_2026W04）
 * @param {string} params.provider - Provider（anthropic|openai）
 * @param {string} params.model - 模型名稱
 * @param {Array} params.requests - 請求列表
 * @param {Object} params.postprocess - 後處理配置
 * @returns {Object} 內部 Batch Job 物件
 */
function createInternalBatchJob(params) {
  return {
    job_id: params.job_id || `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    provider: params.provider,  // anthropic|openai
    model: params.model,
    requests: params.requests || [],
    postprocess: params.postprocess || {
      schema_validate: true,
      rule_validate: true
    },
    created_at: new Date().toISOString(),
    status: "CREATED"
  };
}

/**
 * 創建 Batch Request（單一請求）
 * 
 * @param {Object} params - 參數
 * @param {string} params.custom_id - 唯一 ID（例如：P5B_NVDA_2026W04）
 * @param {Array} params.system_blocks - System blocks（可 cache 的靜態內容）
 * @param {Object} params.user_payload - User payload（動態內容）
 * @param {number} params.max_output_tokens - 最大輸出 tokens
 * @returns {Object} Batch Request 物件
 */
function createBatchRequest(params) {
  return {
    custom_id: params.custom_id,
    system_blocks: params.system_blocks || [],
    user_payload: params.user_payload || {},
    max_output_tokens: params.max_output_tokens || 8000
  };
}

// ==========================================
// BatchRunner 介面（統一）
// ==========================================

/**
 * 提交 Batch Job
 * 
 * @param {Object} internalJob - 內部 Batch Job 物件
 * @returns {Object} { batch_id: string, provider_batch_id: string, status: string }
 */
function submitBatchJob(internalJob) {
  try {
    Logger.log(`提交 Batch Job：${internalJob.job_id} (Provider: ${internalJob.provider}, Model: ${internalJob.model})`);
    
    // 根據 Provider 選擇對應的 Adapter
    let result;
    if (internalJob.provider === "anthropic") {
      result = submitAnthropicBatch(internalJob);
    } else if (internalJob.provider === "openai") {
      result = submitOpenAIBatch(internalJob);
    } else {
      throw new Error(`不支援的 Provider：${internalJob.provider}`);
    }
    
    // 保存 Batch Job 狀態到 M0__BATCH_JOBS 表格
    saveBatchJobStatus({
      job_id: internalJob.job_id,
      provider: internalJob.provider,
      provider_batch_id: result.provider_batch_id,
      model: internalJob.model,
      request_count: internalJob.requests.length,
      status: "SUBMITTED",
      created_at: new Date()
    });
    
    return {
      batch_id: internalJob.job_id,
      provider_batch_id: result.provider_batch_id,
      status: "SUBMITTED"
    };
  } catch (error) {
    Logger.log(`提交 Batch Job 失敗：${error.message}`);
    throw error;
  }
}

/**
 * 查詢 Batch Job 狀態
 * 
 * @param {string} batchId - Batch Job ID（內部 ID）
 * @returns {Object} { status: string, request_counts: Object, progress: number }
 */
function getBatchJobStatus(batchId) {
  try {
    // 從 M0__BATCH_JOBS 表格讀取狀態
    const batchJob = getBatchJobFromDB(batchId);
    if (!batchJob) {
      throw new Error(`Batch Job 不存在：${batchId}`);
    }
    
    // 根據 Provider 查詢實際狀態
    let providerStatus;
    if (batchJob.provider === "anthropic") {
      providerStatus = getAnthropicBatchStatus(batchJob.provider_batch_id);
    } else if (batchJob.provider === "openai") {
      providerStatus = getOpenAIBatchStatus(batchJob.provider_batch_id);
    } else {
      throw new Error(`不支援的 Provider：${batchJob.provider}`);
    }
    
    // 更新本地狀態
    updateBatchJobStatus(batchId, providerStatus);
    
    return {
      status: providerStatus.processing_status || providerStatus.status,
      request_counts: providerStatus.request_counts || {},
      progress: calculateBatchProgress(providerStatus),
      provider_status: providerStatus
    };
  } catch (error) {
    Logger.log(`查詢 Batch Job 狀態失敗：${error.message}`);
    throw error;
  }
}

/**
 * 獲取 Batch Job 結果
 * 
 * @param {string} batchId - Batch Job ID（內部 ID）
 * @returns {Object} { results: Array, errors: Array, summary: Object }
 */
function fetchBatchJobResults(batchId) {
  try {
    // 從 M0__BATCH_JOBS 表格讀取資訊
    const batchJob = getBatchJobFromDB(batchId);
    if (!batchJob) {
      throw new Error(`Batch Job 不存在：${batchId}`);
    }
    
    // 根據 Provider 獲取結果
    let providerResults;
    if (batchJob.provider === "anthropic") {
      providerResults = fetchAnthropicBatchResults(batchJob.provider_batch_id);
    } else if (batchJob.provider === "openai") {
      providerResults = fetchOpenAIBatchResults(batchJob.provider_batch_id);
    } else {
      throw new Error(`不支援的 Provider：${batchJob.provider}`);
    }
    
    // 轉換為統一格式
    const results = convertProviderResultsToInternal(providerResults, batchJob);
    
    // 執行後處理（驗證）
    if (batchJob.postprocess && batchJob.postprocess.schema_validate) {
      results.validated_results = validateBatchResults(results.results, batchJob);
    }
    
    // 更新本地狀態
    updateBatchJobResults(batchId, results);
    
    return results;
  } catch (error) {
    Logger.log(`獲取 Batch Job 結果失敗：${error.message}`);
    throw error;
  }
}

/**
 * 取消 Batch Job
 * 
 * @param {string} batchId - Batch Job ID（內部 ID）
 * @returns {Object} { status: string, message: string }
 */
function cancelBatchJob(batchId) {
  try {
    // 從 M0__BATCH_JOBS 表格讀取資訊
    const batchJob = getBatchJobFromDB(batchId);
    if (!batchJob) {
      throw new Error(`Batch Job 不存在：${batchId}`);
    }
    
    // 根據 Provider 取消
    let result;
    if (batchJob.provider === "anthropic") {
      result = cancelAnthropicBatch(batchJob.provider_batch_id);
    } else if (batchJob.provider === "openai") {
      result = cancelOpenAIBatch(batchJob.provider_batch_id);
    } else {
      throw new Error(`不支援的 Provider：${batchJob.provider}`);
    }
    
    // 更新本地狀態
    updateBatchJobStatus(batchId, { status: "CANCELLED" });
    
    return {
      status: "CANCELLED",
      message: "Batch Job 已取消"
    };
  } catch (error) {
    Logger.log(`取消 Batch Job 失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 計算 Batch 進度
 */
function calculateBatchProgress(providerStatus) {
  const counts = providerStatus.request_counts || {};
  const total = counts.total || counts.processing || 0;
  const completed = counts.completed || counts.succeeded || 0;
  const failed = counts.failed || counts.errored || 0;
  
  if (total === 0) return 0;
  return ((completed + failed) / total) * 100;
}

/**
 * 轉換 Provider 結果為內部格式
 */
function convertProviderResultsToInternal(providerResults, batchJob) {
  const results = [];
  const errors = [];
  
  // 根據 Provider 格式轉換
  if (batchJob.provider === "anthropic") {
    // Anthropic 格式：.jsonl 文件，每行一個結果
    for (const result of providerResults) {
      if (result.result && result.result.type === "succeeded") {
        results.push({
          custom_id: result.custom_id,
          output: result.result.message?.content || result.result,
          input_tokens: result.result.usage?.input_tokens || 0,
          output_tokens: result.result.usage?.output_tokens || 0
        });
      } else if (result.result && result.result.type === "errored") {
        errors.push({
          custom_id: result.custom_id,
          error: result.result.error || result.error
        });
      }
    }
  } else if (batchJob.provider === "openai") {
    // OpenAI 格式：.jsonl 文件，每行一個結果
    for (const result of providerResults) {
      if (result.response && result.response.status_code === 200) {
        const body = result.response.body;
        results.push({
          custom_id: result.custom_id,
          output: body.choices?.[0]?.message?.content || body,
          input_tokens: body.usage?.prompt_tokens || 0,
          output_tokens: body.usage?.completion_tokens || 0
        });
      } else if (result.error) {
        errors.push({
          custom_id: result.custom_id,
          error: result.error
        });
      }
    }
  }
  
  return {
    results: results,
    errors: errors,
    summary: {
      total: results.length + errors.length,
      succeeded: results.length,
      failed: errors.length
    }
  };
}

/**
 * 驗證 Batch 結果
 */
function validateBatchResults(results, batchJob) {
  const validated = [];
  const invalid = [];
  
  for (const result of results) {
    try {
      // Schema 驗證（如果輸出是 JSON）
      if (typeof result.output === 'string') {
        const parsed = JSON.parse(result.output);
        result.output = parsed;
      }
      
      // 基本驗證（根據 Phase 不同，驗證邏輯不同）
      // 這裡可以調用對應 Phase 的 Validator
      validated.push(result);
    } catch (error) {
      invalid.push({
        ...result,
        validation_error: error.message
      });
    }
  }
  
  return {
    validated: validated,
    invalid: invalid
  };
}

// ==========================================
// 資料庫操作（M0__BATCH_JOBS 表格）
// ==========================================

/**
 * 保存 Batch Job 狀態
 */
function saveBatchJobStatus(batchJob) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("M0__BATCH_JOBS");
    
    if (!sheet) {
      // 創建表格（如果不存在）
      sheet = ss.insertSheet("M0__BATCH_JOBS");
      sheet.appendRow([
        "job_id",
        "provider",
        "provider_batch_id",
        "model",
        "request_count",
        "status",
        "created_at",
        "updated_at",
        "results_json"
      ]);
    }
    
    sheet.appendRow([
      batchJob.job_id,
      batchJob.provider,
      batchJob.provider_batch_id,
      batchJob.model,
      batchJob.request_count,
      batchJob.status,
      batchJob.created_at,
      new Date().toISOString(),
      null
    ]);
  } catch (error) {
    Logger.log(`保存 Batch Job 狀態失敗：${error.message}`);
  }
}

/**
 * 從資料庫讀取 Batch Job
 */
function getBatchJobFromDB(batchId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("M0__BATCH_JOBS");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    // 跳過標題行，查找匹配的 job_id
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === batchId) {  // job_id
        return {
          job_id: row[0],
          provider: row[1],
          provider_batch_id: row[2],
          model: row[3],
          request_count: row[4],
          status: row[5],
          created_at: row[6],
          updated_at: row[7]
        };
      }
    }
    
    return null;
  } catch (error) {
    Logger.log(`讀取 Batch Job 失敗：${error.message}`);
    return null;
  }
}

/**
 * 更新 Batch Job 狀態
 */
function updateBatchJobStatus(batchId, status) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("M0__BATCH_JOBS");
    
    if (!sheet) return;
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    // 查找匹配的 job_id
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === batchId) {
        // 更新狀態
        sheet.getRange(i + 1, 6).setValue(status.status || status.processing_status || "UNKNOWN");
        sheet.getRange(i + 1, 8).setValue(new Date().toISOString());
        break;
      }
    }
  } catch (error) {
    Logger.log(`更新 Batch Job 狀態失敗：${error.message}`);
  }
}

/**
 * 更新 Batch Job 結果
 */
function updateBatchJobResults(batchId, results) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("M0__BATCH_JOBS");
    
    if (!sheet) return;
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    // 查找匹配的 job_id
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === batchId) {
        // 更新結果
        sheet.getRange(i + 1, 9).setValue(JSON.stringify(results));
        sheet.getRange(i + 1, 6).setValue("COMPLETED");
        sheet.getRange(i + 1, 8).setValue(new Date().toISOString());
        break;
      }
    }
  } catch (error) {
    Logger.log(`更新 Batch Job 結果失敗：${error.message}`);
  }
}
