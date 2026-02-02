/**
 * 🔌 M0 Batch Adapters（Provider 適配器）
 * 
 * 實現 Anthropic 和 OpenAI 的 Batch API 適配器
 * 將內部 Batch Job 格式轉換為 Provider API 格式
 * 
 * @version SSOT V8.17
 * @date 2026-01-19
 */

// ==========================================
// Anthropic Batch Adapter
// ==========================================

/**
 * 提交 Anthropic Batch
 * 
 * @param {Object} internalJob - 內部 Batch Job 物件
 * @returns {Object} { provider_batch_id: string, status: string }
 */
function submitAnthropicBatch(internalJob) {
  try {
    const apiKey = getAPIKey("ANTHROPIC");
    const apiUrl = "https://api.anthropic.com/v1/messages/batches";
    
    // 轉換內部格式為 Anthropic 格式
    const anthropicRequests = internalJob.requests.map(req => {
      // 構建 system blocks（支援 prompt caching）
      const systemBlocks = [];
      for (const block of req.system_blocks || []) {
        if (typeof block === 'string') {
          // 如果是字串，視為可 cache 的靜態內容
          systemBlocks.push({
            type: "text",
            text: block,
            cache_control: { type: "ephemeral" }  // ⭐ 標記為可 cache
          });
        } else if (block.type === "text") {
          // 如果已經是物件格式，保留 cache_control
          systemBlocks.push(block);
        }
      }
      
      // 構建 user message
      const userContent = typeof req.user_payload === 'string' 
        ? req.user_payload 
        : JSON.stringify(req.user_payload, null, 2);
      
      return {
        custom_id: req.custom_id,
        params: {
          model: internalJob.model,
          max_tokens: req.max_output_tokens || 8000,
          temperature: 0.7,
          system: systemBlocks.length > 0 ? systemBlocks : undefined,
          messages: [
            {
              role: "user",
              content: userContent
            }
          ]
        }
      };
    });
    
    // 構建請求體
    const requestBody = {
      requests: anthropicRequests
    };
    
    // 發送請求
    const options = {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseBody = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Anthropic Batch API 錯誤：${responseBody.error?.message || response.getResponseCode()}`);
    }
    
    Logger.log(`Anthropic Batch 已提交：${responseBody.id} (${internalJob.requests.length} 個請求)`);
    
    return {
      provider_batch_id: responseBody.id,
      status: responseBody.processing_status || "in_progress"
    };
  } catch (error) {
    Logger.log(`提交 Anthropic Batch 失敗：${error.message}`);
    throw error;
  }
}

/**
 * 查詢 Anthropic Batch 狀態
 */
function getAnthropicBatchStatus(providerBatchId) {
  try {
    const apiKey = getAPIKey("ANTHROPIC");
    const apiUrl = `https://api.anthropic.com/v1/messages/batches/${providerBatchId}`;
    
    const options = {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseBody = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Anthropic Batch API 錯誤：${responseBody.error?.message || response.getResponseCode()}`);
    }
    
    return {
      processing_status: responseBody.processing_status,
      request_counts: responseBody.request_counts || {},
      ended_at: responseBody.ended_at,
      expires_at: responseBody.expires_at
    };
  } catch (error) {
    Logger.log(`查詢 Anthropic Batch 狀態失敗：${error.message}`);
    throw error;
  }
}

/**
 * 獲取 Anthropic Batch 結果
 */
function fetchAnthropicBatchResults(providerBatchId) {
  try {
    const apiKey = getAPIKey("ANTHROPIC");
    
    // 先查詢 Batch 狀態，獲取 results_url
    const status = getAnthropicBatchStatus(providerBatchId);
    
    if (status.processing_status !== "ended") {
      throw new Error(`Batch 尚未完成，狀態：${status.processing_status}`);
    }
    
    // 從 Console 或 API 獲取 results_url（這裡簡化處理）
    // 實際實現需要先查詢 Batch 詳情獲取 results_url
    const batchDetail = getAnthropicBatchDetail(providerBatchId);
    const resultsUrl = batchDetail.results_url;
    
    if (!resultsUrl) {
      throw new Error("無法獲取 Batch 結果 URL");
    }
    
    // 下載結果（.jsonl 格式）
    const options = {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(resultsUrl, options);
    const jsonlContent = response.getContentText();
    
    // 解析 .jsonl 格式（每行一個 JSON 物件）
    const results = [];
    const lines = jsonlContent.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        results.push(JSON.parse(line));
      } catch (e) {
        Logger.log(`解析 Batch 結果行失敗：${e.message}`);
      }
    }
    
    return results;
  } catch (error) {
    Logger.log(`獲取 Anthropic Batch 結果失敗：${error.message}`);
    throw error;
  }
}

/**
 * 獲取 Anthropic Batch 詳情（包含 results_url）
 */
function getAnthropicBatchDetail(providerBatchId) {
  try {
    const apiKey = getAPIKey("ANTHROPIC");
    const apiUrl = `https://api.anthropic.com/v1/messages/batches/${providerBatchId}`;
    
    const options = {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseBody = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Anthropic Batch API 錯誤：${responseBody.error?.message || response.getResponseCode()}`);
    }
    
    return responseBody;
  } catch (error) {
    Logger.log(`獲取 Anthropic Batch 詳情失敗：${error.message}`);
    throw error;
  }
}

/**
 * 取消 Anthropic Batch
 */
function cancelAnthropicBatch(providerBatchId) {
  try {
    const apiKey = getAPIKey("ANTHROPIC");
    const apiUrl = `https://api.anthropic.com/v1/messages/batches/${providerBatchId}/cancel`;
    
    const options = {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseBody = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Anthropic Batch API 錯誤：${responseBody.error?.message || response.getResponseCode()}`);
    }
    
    return {
      status: responseBody.processing_status || "canceling"
    };
  } catch (error) {
    Logger.log(`取消 Anthropic Batch 失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// OpenAI Batch Adapter
// ==========================================

/**
 * 提交 OpenAI Batch
 * 
 * @param {Object} internalJob - 內部 Batch Job 物件
 * @returns {Object} { provider_batch_id: string, status: string }
 */
function submitOpenAIBatch(internalJob) {
  try {
    const apiKey = getAPIKey("OPENAI");
    
    // Step 1: 創建 .jsonl 文件內容
    const jsonlLines = [];
    for (const req of internalJob.requests) {
      // 構建 messages（OpenAI 格式）
      const messages = [];
      
      // 添加 system message（固定模板，可達到 cached input 效果）
      if (req.system_blocks && req.system_blocks.length > 0) {
        const systemContent = req.system_blocks
          .map(block => typeof block === 'string' ? block : block.text)
          .join('\n\n');
        messages.push({
          role: "system",
          content: systemContent
        });
      }
      
      // 添加 user message
      const userContent = typeof req.user_payload === 'string' 
        ? req.user_payload 
        : JSON.stringify(req.user_payload, null, 2);
      messages.push({
        role: "user",
        content: userContent
      });
      
      // 構建請求體（OpenAI Batch 格式）
      const requestBody = {
        custom_id: req.custom_id,
        method: "POST",
        url: "/v1/chat/completions",
        body: {
          model: internalJob.model,
          messages: messages,
          max_completion_tokens: req.max_output_tokens || 8000,
          temperature: 0.7
        }
      };
      
      jsonlLines.push(JSON.stringify(requestBody));
    }
    
    // Step 2: 上傳 .jsonl 文件到 OpenAI Files API
    const jsonlContent = jsonlLines.join('\n');
    const blob = Utilities.newBlob(jsonlContent, 'application/x-ndjson', 'batch_input.jsonl');
    
    const uploadUrl = "https://api.openai.com/v1/files";
    const uploadOptions = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      },
      payload: {
        file: blob,
        purpose: "batch"
      },
      muteHttpExceptions: true
    };
    
    const uploadResponse = UrlFetchApp.fetch(uploadUrl, uploadOptions);
    const uploadBody = JSON.parse(uploadResponse.getContentText());
    
    if (uploadResponse.getResponseCode() !== 200) {
      throw new Error(`OpenAI Files API 錯誤：${uploadBody.error?.message || uploadResponse.getResponseCode()}`);
    }
    
    const fileId = uploadBody.id;
    Logger.log(`OpenAI Batch 輸入文件已上傳：${fileId}`);
    
    // Step 3: 創建 Batch
    const batchUrl = "https://api.openai.com/v1/batches";
    const batchOptions = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify({
        input_file_id: fileId,
        endpoint: "/v1/chat/completions",
        completion_window: "24h"
      }),
      muteHttpExceptions: true
    };
    
    const batchResponse = UrlFetchApp.fetch(batchUrl, batchOptions);
    const batchBody = JSON.parse(batchResponse.getContentText());
    
    if (batchResponse.getResponseCode() !== 200) {
      throw new Error(`OpenAI Batch API 錯誤：${batchBody.error?.message || batchResponse.getResponseCode()}`);
    }
    
    Logger.log(`OpenAI Batch 已提交：${batchBody.id} (${internalJob.requests.length} 個請求)`);
    
    return {
      provider_batch_id: batchBody.id,
      status: batchBody.status || "validating"
    };
  } catch (error) {
    Logger.log(`提交 OpenAI Batch 失敗：${error.message}`);
    throw error;
  }
}

/**
 * 查詢 OpenAI Batch 狀態
 */
function getOpenAIBatchStatus(providerBatchId) {
  try {
    const apiKey = getAPIKey("OPENAI");
    const apiUrl = `https://api.openai.com/v1/batches/${providerBatchId}`;
    
    const options = {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseBody = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`OpenAI Batch API 錯誤：${responseBody.error?.message || response.getResponseCode()}`);
    }
    
    return {
      status: responseBody.status,
      request_counts: responseBody.request_counts || {},
      completed_at: responseBody.completed_at,
      failed_at: responseBody.failed_at,
      expired_at: responseBody.expired_at
    };
  } catch (error) {
    Logger.log(`查詢 OpenAI Batch 狀態失敗：${error.message}`);
    throw error;
  }
}

/**
 * 獲取 OpenAI Batch 結果
 */
function fetchOpenAIBatchResults(providerBatchId) {
  try {
    const apiKey = getAPIKey("OPENAI");
    
    // 先查詢 Batch 狀態，獲取 output_file_id
    const status = getOpenAIBatchStatus(providerBatchId);
    
    if (status.status !== "completed") {
      throw new Error(`Batch 尚未完成，狀態：${status.status}`);
    }
    
    // 從 Batch 詳情獲取 output_file_id
    const batchDetail = getOpenAIBatchDetail(providerBatchId);
    const outputFileId = batchDetail.output_file_id;
    
    if (!outputFileId) {
      throw new Error("無法獲取 Batch 輸出文件 ID");
    }
    
    // 下載結果文件（.jsonl 格式）
    const fileUrl = `https://api.openai.com/v1/files/${outputFileId}/content`;
    const options = {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(fileUrl, options);
    const jsonlContent = response.getContentText();
    
    // 解析 .jsonl 格式（每行一個 JSON 物件）
    const results = [];
    const lines = jsonlContent.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        results.push(JSON.parse(line));
      } catch (e) {
        Logger.log(`解析 Batch 結果行失敗：${e.message}`);
      }
    }
    
    return results;
  } catch (error) {
    Logger.log(`獲取 OpenAI Batch 結果失敗：${error.message}`);
    throw error;
  }
}

/**
 * 獲取 OpenAI Batch 詳情（包含 output_file_id）
 */
function getOpenAIBatchDetail(providerBatchId) {
  try {
    const apiKey = getAPIKey("OPENAI");
    const apiUrl = `https://api.openai.com/v1/batches/${providerBatchId}`;
    
    const options = {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseBody = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`OpenAI Batch API 錯誤：${responseBody.error?.message || response.getResponseCode()}`);
    }
    
    return responseBody;
  } catch (error) {
    Logger.log(`獲取 OpenAI Batch 詳情失敗：${error.message}`);
    throw error;
  }
}

/**
 * 取消 OpenAI Batch
 */
function cancelOpenAIBatch(providerBatchId) {
  try {
    const apiKey = getAPIKey("OPENAI");
    const apiUrl = `https://api.openai.com/v1/batches/${providerBatchId}/cancel`;
    
    const options = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseBody = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`OpenAI Batch API 錯誤：${responseBody.error?.message || response.getResponseCode()}`);
    }
    
    return {
      status: responseBody.status || "cancelling"
    };
  } catch (error) {
    Logger.log(`取消 OpenAI Batch 失敗：${error.message}`);
    throw error;
  }
}
