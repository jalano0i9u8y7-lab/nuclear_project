/**
 * 🔌 M0 API Adapters
 * 
 * 實現 OpenAI、Claude、Gemini 的 API 調用封裝
 * 
 * @version SSOT V6.3
 * @date 2025-01-11
 */

// ==========================================
// OpenAI Adapter（GPT、o3）
// ==========================================

/**
 * 調用 OpenAI API（GPT、o3）
 * @param {string} model - 模型名稱（gpt-5.1、o3）
 * @param {Object} payload - 輸入負載
 * @param {Object} config - 模型配置
 * @return {Object} API 響應結果
 */
function callOpenAI(model, payload, config) {
  const apiKey = getAPIKey("OPENAI");
  const apiUrl = "https://api.openai.com/v1/chat/completions";
  
  // 構建請求消息
  const messages = [];
  
  // 添加系統提示（如果有）
  if (payload.system_prompt) {
    messages.push({
      role: "system",
      content: payload.system_prompt
    });
  }
  
  // 添加用戶消息
  let userContent = "";
  
  if (payload.task_prompt) {
    userContent = payload.task_prompt;
  } else if (payload.message) {
    userContent = payload.message;
  } else {
    userContent = JSON.stringify(payload, null, 2);
  }
  
  messages.push({
    role: "user",
    content: userContent
  });
  
  // 構建請求體
  const requestBody = {
    model: model,
    messages: messages
  };
  
  // ⭐ V8.17.1 新增：某些模型（如 gpt-5-nano）只支持默認 temperature (1)
  // 檢查模型是否支持自定義 temperature
  if (model === "gpt-5-nano") {
    // gpt-5-nano 只支持默認值 1
    requestBody.temperature = 1;
  } else if (model === "o3") {
    // o3 模型完全不使用 temperature（不設置此參數）
    // 不設置 temperature，讓 API 使用默認值
  } else {
    // 其他模型使用配置的 temperature
    requestBody.temperature = config.temperature !== undefined ? config.temperature : 0.7;
  }
  
  // ⭐ V8.0 測試模式：強制開啟 JSON Mode
  const forceJsonMode = config.forceJsonMode || 
                        (typeof SYSTEM_TEST_MODE !== 'undefined' && SYSTEM_TEST_MODE && 
                         typeof M0_MODEL_CONFIG !== 'undefined' && 
                         M0_MODEL_CONFIG[model]?.forceJsonMode);
  
  if (forceJsonMode) {
    // OpenAI 的參數叫 response_format
    requestBody.response_format = { type: "json_object" };
  }
  
  // ⭐ GPT-5.2 及更新版本使用 max_completion_tokens，舊版本使用 max_tokens
  // 優先檢查 config.useMaxCompletionTokens（最可靠）
  // 其次檢查模型名稱模式
  // ⭐ V8.17.1 修正：使用 maxOutputTokens（輸出限制）而不是 maxTokens（context window）
  if (config.useMaxCompletionTokens === true || 
      model === "gpt-5.2" || 
      model.startsWith("gpt-5.2-") || 
      model.startsWith("gpt-5-2") || 
      model.startsWith("gpt-5-") ||
      model.startsWith("o3")) {  // o3 模型也需要 max_completion_tokens
    // 使用 maxOutputTokens（輸出限制），並確保不超過模型限制（128K）
    const maxCompletionTokens = Math.min(config.maxOutputTokens || config.maxTokens || 8192, 128000);
    requestBody.max_completion_tokens = maxCompletionTokens;
    // 確保不設置 max_tokens（避免衝突）
    delete requestBody.max_tokens;
  } else {
    // 舊版本使用 max_tokens，也使用 maxOutputTokens 或 maxTokens（取較小值）
    const maxTokens = Math.min(config.maxOutputTokens || config.maxTokens || 8192, 128000);
    requestBody.max_tokens = maxTokens;
    // 確保不設置 max_completion_tokens（避免衝突）
    delete requestBody.max_completion_tokens;
  }
  
  // ⭐ V8.17.1 修正：o3 模型不使用 temperature（已在上面處理，這裡保留作為備用檢查）
  if (model === "o3" && requestBody.temperature !== undefined) {
    delete requestBody.temperature;
  }
  
  // 發送請求（帶重試機制）
  let response;
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      const options = {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        payload: JSON.stringify(requestBody),
        muteHttpExceptions: true,
        // ⭐ V8.17.1 新增：設置超時時間（GAS 最大 6 分鐘，設置 5 分鐘超時）
        timeout: 300000  // 5 分鐘（300 秒）
      };
      
      Logger.log(`OpenAI API 調用開始：model=${model}, timeout=300s`);
      const fetchStartTime = Date.now();
      response = UrlFetchApp.fetch(apiUrl, options);
      const fetchDuration = Date.now() - fetchStartTime;
      Logger.log(`OpenAI API 調用完成：耗時=${fetchDuration}ms, status=${response.getResponseCode()}`);
      
      if (response.getResponseCode() === 200) {
        break;  // 成功，退出重試循環
      } else if (response.getResponseCode() === 429) {
        // Rate limit，等待後重試
        retryCount++;
        if (retryCount < maxRetries) {
          const delay = calculateRetryDelay(retryCount);
          Logger.log(`OpenAI API Rate Limit，等待 ${delay}ms 後重試（第 ${retryCount} 次）`);
          Utilities.sleep(delay);
          continue;
        }
      } else {
        // 其他錯誤，拋出異常
        const errorText = response.getContentText();
        let errorMessage = `OpenAI API 錯誤：HTTP ${response.getResponseCode()}`;
        try {
          const errorBody = JSON.parse(errorText);
          errorMessage = `OpenAI API 錯誤：${errorBody.error?.message || errorMessage}`;
          Logger.log(`OpenAI API 錯誤詳情：${JSON.stringify(errorBody).substring(0, 500)}`);
        } catch (e) {
          Logger.log(`OpenAI API 錯誤響應（無法解析）：${errorText.substring(0, 500)}`);
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        Logger.log(`OpenAI API 調用最終失敗（已重試 ${retryCount} 次）：${error.message}`);
        throw new Error(`OpenAI API 調用失敗：${error.message}`);
      }
      
      const delay = calculateRetryDelay(retryCount);
      Logger.log(`OpenAI API 調用失敗，等待 ${delay}ms 後重試（第 ${retryCount} 次）：${error.message}`);
      Logger.log(`OpenAI API 錯誤堆疊：${error.stack}`);
      Utilities.sleep(delay);
    }
  }
  
  // ⭐ V8.17.1 新增：檢查響應是否為空
  if (!response) {
    throw new Error("OpenAI API 調用失敗：未收到響應");
  }
  
  // 解析響應
  let responseBody;
  try {
    responseBody = JSON.parse(response.getContentText());
  } catch (e) {
    Logger.log(`OpenAI API 響應解析失敗：${e.message}`);
    Logger.log(`OpenAI API 響應內容（前500字符）：${response.getContentText().substring(0, 500)}`);
    throw new Error(`OpenAI API 響應解析失敗：${e.message}`);
  }
  
  if (!responseBody.choices || responseBody.choices.length === 0) {
    Logger.log(`OpenAI API 返回空結果：${JSON.stringify(responseBody).substring(0, 500)}`);
    throw new Error("OpenAI API 返回空結果");
  }
  
  const content = responseBody.choices[0].message.content;
  
  // ⭐ V8.17.1 新增：處理空字符串情況（JSON Mode 可能輸出空字符串）
  if (!content || content.trim() === "" || content.trim() === '""') {
    Logger.log(`OpenAI API 警告：輸出為空字符串，轉換為空對象`);
    output = {};
  } else {
    // 嘗試解析 JSON（如果輸出是 JSON 格式）
    try {
      output = JSON.parse(content);
    } catch (e) {
      // 如果不是 JSON，直接使用字符串
      Logger.log(`OpenAI API 警告：無法解析為 JSON，使用原始字符串：${content.substring(0, 100)}`);
      output = content;
    }
  }
  
  return {
    output: output,
    conversationId: responseBody.id || null,
    inputTokens: responseBody.usage?.prompt_tokens || 0,
    outputTokens: responseBody.usage?.completion_tokens || 0,
    totalTokens: responseBody.usage?.total_tokens || 0
  };
}

// ==========================================
// Claude Adapter（Sonnet、Opus）
// ==========================================

/**
 * 調用 Claude API（Sonnet、Opus）
 * @param {string} model - 模型名稱（claude-sonnet-4-5-20250929、claude-opus-4-5-20251101）
 * @param {Object} payload - 輸入負載
 * @param {Object} config - 模型配置
 * @return {Object} API 響應結果
 */
function callClaude(model, payload, config) {
  const apiKey = getAPIKey("ANTHROPIC");
  const apiUrl = "https://api.anthropic.com/v1/messages";
  
  // 構建請求消息
  let userContent = "";
  
  if (payload.task_prompt) {
    userContent = payload.task_prompt;
  } else if (payload.message) {
    userContent = payload.message;
  } else {
    userContent = JSON.stringify(payload, null, 2);
  }
  
  // 構建請求體
  const requestBody = {
    model: model,
    max_tokens: config.maxTokens || 8192,
    temperature: config.temperature !== undefined ? config.temperature : 0.7,
    messages: [
      {
        role: "user",
        content: userContent
      }
    ]
  };
  
  // 添加系統提示（如果有）
  if (payload.system_prompt) {
    requestBody.system = payload.system_prompt;
  }
  
  // 發送請求（帶重試機制）
  // 注意：Opus 模型更容易出現 Overloaded，所以增加重試次數
  let response;
  let retryCount = 0;
  const isOpus = model.includes("opus");
  const maxRetries = isOpus ? 5 : 3; // Opus 使用 5 次重試，其他模型使用 3 次
  
  while (retryCount < maxRetries) {
    try {
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
      
      response = UrlFetchApp.fetch(apiUrl, options);
      
      if (response.getResponseCode() === 200) {
        break;  // 成功，退出重試循環
      } else if (response.getResponseCode() === 429) {
        // Rate limit 或 Overloaded，等待後重試
        retryCount++;
        if (retryCount < maxRetries) {
          // Overloaded 錯誤需要更長的等待時間
          const delay = calculateRetryDelay(retryCount) * 2; // 加倍等待時間
          Logger.log(`Claude API Rate Limit/Overloaded，等待 ${delay}ms 後重試（第 ${retryCount} 次）`);
          Utilities.sleep(delay);
          continue;
        }
      } else {
        // 其他錯誤，解析錯誤訊息
        let errorMessage = `HTTP ${response.getResponseCode()}`;
        try {
          const errorBody = JSON.parse(response.getContentText());
          errorMessage = errorBody.error?.message || errorBody.message || errorMessage;
          
          // 檢查是否為 Overloaded 錯誤（可能在錯誤訊息中）
          if (errorMessage.toLowerCase().includes("overloaded") || errorMessage.toLowerCase().includes("overload")) {
            retryCount++;
            if (retryCount < maxRetries) {
              // Overloaded 錯誤需要更長的等待時間（指數退避）
              const delay = calculateRetryDelay(retryCount) * 3; // 三倍等待時間
              Logger.log(`Claude API Overloaded，等待 ${delay}ms 後重試（第 ${retryCount} 次）`);
              Utilities.sleep(delay);
              continue;
            }
          }
          
          // 如果是模型名稱錯誤，提供更清楚的提示
          if (errorMessage.includes("model") || errorMessage.includes("invalid")) {
            errorMessage = `模型名稱錯誤：${model}。請確認使用正確的 Anthropic API 模型名稱（例如：claude-3-5-sonnet-20241022, claude-3-5-opus-20241022）`;
          }
        } catch (e) {
          errorMessage = response.getContentText().substring(0, 200);
        }
        throw new Error(`Claude API 錯誤：${errorMessage}`);
      }
    } catch (error) {
      retryCount++;
      
      // 檢查是否為 Overloaded 錯誤（可能在異常訊息中）
      const isOverloaded = error.message.toLowerCase().includes("overloaded") || 
                          error.message.toLowerCase().includes("overload");
      
      if (retryCount >= maxRetries) {
        throw new Error(`Claude API 調用失敗：${error.message}`);
      }
      
      // Overloaded 錯誤需要更長的等待時間（指數退避）
      const baseDelay = calculateRetryDelay(retryCount);
      const delay = isOverloaded ? baseDelay * 3 : baseDelay; // Overloaded 三倍等待時間
      
      Logger.log(`Claude API 調用失敗，等待 ${delay}ms 後重試（第 ${retryCount} 次）：${error.message}`);
      Utilities.sleep(delay);
    }
  }
  
  // 解析響應
  const responseBody = JSON.parse(response.getContentText());
  
  if (!responseBody.content || responseBody.content.length === 0) {
    throw new Error("Claude API 返回空結果");
  }
  
  let content = responseBody.content[0].text;
  
  // ⭐ 修正：移除 markdown 代碼塊標記（如果有的話）
  content = content.trim();
  if (content.startsWith('```json')) {
    content = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  } else if (content.startsWith('```')) {
    content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  // 嘗試解析 JSON（如果輸出是 JSON 格式）
  let output;
  try {
    output = JSON.parse(content);
  } catch (e) {
    // 如果不是 JSON，直接使用字符串
    output = content;
  }
  
  return {
    output: output,
    conversationId: responseBody.id || null,
    inputTokens: responseBody.usage?.input_tokens || 0,
    outputTokens: responseBody.usage?.output_tokens || 0,
    totalTokens: (responseBody.usage?.input_tokens || 0) + (responseBody.usage?.output_tokens || 0)
  };
}

// ==========================================
// Gemini Adapter（Gemini Pro、Gemini Flash）
// ==========================================

/**
 * 調用 Gemini API（Gemini Pro、Gemini Flash）
 * @param {string} model - 模型名稱（gemini-2.5-pro、gemini-2.5-flash）
 * @param {Object} payload - 輸入負載
 * @param {Object} config - 模型配置
 * @return {Object} API 響應結果
 */
function callGemini(model, payload, config) {
  const apiKey = getAPIKey("GEMINI");
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  // 構建請求消息
  let userContent = "";
  
  if (payload.task_prompt) {
    userContent = payload.task_prompt;
  } else if (payload.message) {
    userContent = payload.message;
  } else {
    userContent = JSON.stringify(payload, null, 2);
  }
  
  // 構建請求體
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: userContent
          }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: config.maxTokens || 8192,
      temperature: config.temperature !== undefined ? config.temperature : 0.7
    }
  };
  
  // ⭐ V8.0 測試模式：強制開啟 JSON Mode
  const forceJsonMode = config.forceJsonMode || 
                        (typeof SYSTEM_TEST_MODE !== 'undefined' && SYSTEM_TEST_MODE && 
                         typeof M0_MODEL_CONFIG !== 'undefined' && 
                         M0_MODEL_CONFIG[model]?.forceJsonMode);
  
  if (forceJsonMode) {
    // Gemini 的參數叫 responseMimeType
    requestBody.generationConfig.responseMimeType = "application/json";
  }
  
  // 發送請求（帶重試機制）
  // ⭐ V8.13 修正：Gemini API 容易過載，增加重試次數和更長的等待時間
  let response;
  let retryCount = 0;
  const maxRetries = 5;  // ⭐ V8.13 修正：從 3 次增加到 5 次
  
  while (retryCount < maxRetries) {
    try {
      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        payload: JSON.stringify(requestBody),
        muteHttpExceptions: true
      };
      
      response = UrlFetchApp.fetch(apiUrl, options);
      
      if (response.getResponseCode() === 200) {
        break;  // 成功，退出重試循環
      } else if (response.getResponseCode() === 429) {
        // Rate limit 或 Overloaded，等待後重試
        retryCount++;
        if (retryCount < maxRetries) {
          // ⭐ V8.13 修正：Overloaded 錯誤需要更長的等待時間（指數退避）
          const delay = calculateRetryDelay(retryCount) * 3;  // 三倍等待時間
          Logger.log(`Gemini API Rate Limit/Overloaded，等待 ${delay}ms 後重試（第 ${retryCount} 次）`);
          Utilities.sleep(delay);
          continue;
        }
      } else {
        // 其他錯誤，解析錯誤訊息
        let errorMessage = `HTTP ${response.getResponseCode()}`;
        try {
          const errorBody = JSON.parse(response.getContentText());
          errorMessage = errorBody.error?.message || errorMessage;
          
          // ⭐ V8.13 修正：檢查是否為 Overloaded 錯誤
          if (errorMessage.toLowerCase().includes("overloaded") || errorMessage.toLowerCase().includes("overload")) {
            retryCount++;
            if (retryCount < maxRetries) {
              // Overloaded 錯誤需要更長的等待時間（指數退避）
              const delay = calculateRetryDelay(retryCount) * 5;  // 五倍等待時間
              Logger.log(`Gemini API Overloaded，等待 ${delay}ms 後重試（第 ${retryCount} 次）`);
              Utilities.sleep(delay);
              continue;
            }
          }
        } catch (e) {
          errorMessage = response.getContentText().substring(0, 200);
        }
        throw new Error(`Gemini API 錯誤：${errorMessage}`);
      }
    } catch (error) {
      retryCount++;
      
      // ⭐ V8.13 修正：檢查是否為 Overloaded 錯誤（可能在異常訊息中）
      const isOverloaded = error.message.toLowerCase().includes("overloaded") || 
                          error.message.toLowerCase().includes("overload");
      
      if (retryCount >= maxRetries) {
        throw new Error(`Gemini API 調用失敗：${error.message}`);
      }
      
      // Overloaded 錯誤需要更長的等待時間（指數退避）
      const baseDelay = calculateRetryDelay(retryCount);
      const delay = isOverloaded ? baseDelay * 5 : baseDelay;  // Overloaded 五倍等待時間
      
      Logger.log(`Gemini API 調用失敗，等待 ${delay}ms 後重試（第 ${retryCount} 次）：${error.message}`);
      Utilities.sleep(delay);
    }
  }
  
  // 解析響應
  const responseBody = JSON.parse(response.getContentText());
  
  if (!responseBody.candidates || responseBody.candidates.length === 0) {
    throw new Error("Gemini API 返回空結果");
  }
  
  const content = responseBody.candidates[0].content.parts[0].text;
  
  // 嘗試解析 JSON（如果輸出是 JSON 格式）
  let output;
  try {
    output = JSON.parse(content);
  } catch (e) {
    // 如果不是 JSON，直接使用字符串
    output = content;
  }
  
  return {
    output: output,
    conversationId: responseBody.modelVersion || null,
    inputTokens: responseBody.usageMetadata?.promptTokenCount || 0,
    outputTokens: responseBody.usageMetadata?.candidatesTokenCount || 0,
    totalTokens: responseBody.usageMetadata?.totalTokenCount || 0
  };
}
