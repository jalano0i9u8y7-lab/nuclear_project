/**
 * 🔍 檢查可用模型腳本
 * 
 * 用於檢查您的 API Keys 可以訪問哪些模型
 * 
 * 在 Google Apps Script 編輯器中執行：
 * - checkOpenAIModels() - 檢查 OpenAI 可用模型
 * - checkClaudeModels() - 檢查 Claude 可用模型（需要手動測試）
 * - checkGeminiModels() - 檢查 Gemini 可用模型（需要手動測試）
 * - checkAllModels() - 檢查所有模型
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

// ==========================================
// OpenAI 模型檢查
// ==========================================

/**
 * 檢查 OpenAI 可用模型
 */
function checkOpenAIModels() {
  Logger.log("=".repeat(70));
  Logger.log("🔍 檢查 OpenAI 可用模型");
  Logger.log("=".repeat(70));
  
  try {
    const apiKey = getAPIKey("OPENAI");
    const apiUrl = "https://api.openai.com/v1/models";
    
    Logger.log("正在查詢 OpenAI API...");
    
    const response = UrlFetchApp.fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      const errorBody = JSON.parse(response.getContentText());
      Logger.log(`✗ OpenAI API 錯誤：${errorBody.error?.message || response.getResponseCode()}`);
      return;
    }
    
    const responseBody = JSON.parse(response.getContentText());
    const models = responseBody.data || [];
    
    Logger.log(`\n找到 ${models.length} 個可用模型：\n`);
    
    // 按模型名稱排序
    const sortedModels = models.sort((a, b) => a.id.localeCompare(b.id));
    
    // 分類顯示
    const gpt5Models = sortedModels.filter(m => m.id.includes("gpt-5") || m.id.includes("gpt-5.2"));
    const gpt4Models = sortedModels.filter(m => m.id.includes("gpt-4") && !m.id.includes("gpt-5"));
    const gpt3Models = sortedModels.filter(m => m.id.includes("gpt-3"));
    const o3Models = sortedModels.filter(m => m.id.includes("o3") || m.id.includes("o1"));
    const otherModels = sortedModels.filter(m => 
      !m.id.includes("gpt-") && 
      !m.id.includes("o3") && 
      !m.id.includes("o1") &&
      !m.id.includes("whisper") &&
      !m.id.includes("tts") &&
      !m.id.includes("dall-e")
    );
    
    if (gpt5Models.length > 0) {
      Logger.log("【GPT-5 系列】");
      gpt5Models.forEach(m => {
        Logger.log(`  ✓ ${m.id}${m.owned_by ? ` (${m.owned_by})` : ""}`);
      });
      Logger.log("");
    }
    
    if (gpt4Models.length > 0) {
      Logger.log("【GPT-4 系列】");
      gpt4Models.forEach(m => {
        Logger.log(`  ✓ ${m.id}${m.owned_by ? ` (${m.owned_by})` : ""}`);
      });
      Logger.log("");
    }
    
    if (o3Models.length > 0) {
      Logger.log("【O3/O1 系列】");
      o3Models.forEach(m => {
        Logger.log(`  ✓ ${m.id}${m.owned_by ? ` (${m.owned_by})` : ""}`);
      });
      Logger.log("");
    }
    
    if (gpt3Models.length > 0) {
      Logger.log("【GPT-3 系列】");
      gpt3Models.forEach(m => {
        Logger.log(`  ✓ ${m.id}${m.owned_by ? ` (${m.owned_by})` : ""}`);
      });
      Logger.log("");
    }
    
    if (otherModels.length > 0) {
      Logger.log("【其他模型】");
      otherModels.forEach(m => {
        Logger.log(`  ✓ ${m.id}${m.owned_by ? ` (${m.owned_by})` : ""}`);
      });
      Logger.log("");
    }
    
    // 檢查關鍵模型
    Logger.log("=".repeat(70));
    Logger.log("📋 關鍵模型檢查");
    Logger.log("=".repeat(70));
    
    const keyModels = [
      "gpt-5.2",
      "gpt-5.2-2025-11-14",
      "gpt-5-2",
      "gpt-4o",
      "gpt-4-turbo",
      "o3",
      "o1"
    ];
    
    keyModels.forEach(modelName => {
      const found = sortedModels.find(m => m.id === modelName || m.id.startsWith(modelName));
      if (found) {
        Logger.log(`✓ ${modelName}：可用 (${found.id})`);
      } else {
        Logger.log(`✗ ${modelName}：不可用`);
      }
    });
    
    Logger.log("\n" + "=".repeat(70));
    Logger.log("💡 建議");
    Logger.log("=".repeat(70));
    
    // 根據可用模型給出建議
    if (gpt5Models.length > 0) {
      const recommendedModel = gpt5Models[0].id;
      Logger.log(`\n建議使用：${recommendedModel}`);
      Logger.log(`\n請在 src/02_M0_CONFIG.js 中更新：`);
      Logger.log(`GPT: {`);
      Logger.log(`  model: "${recommendedModel}",`);
      Logger.log(`  // ...`);
      Logger.log(`}`);
    } else if (gpt4Models.length > 0) {
      const recommendedModel = gpt4Models.find(m => m.id.includes("gpt-4o")) || gpt4Models[0];
      Logger.log(`\n未找到 GPT-5 模型，建議使用：${recommendedModel.id}`);
      Logger.log(`\n請在 src/02_M0_CONFIG.js 中更新：`);
      Logger.log(`GPT: {`);
      Logger.log(`  model: "${recommendedModel.id}",`);
      Logger.log(`  // ...`);
      Logger.log(`}`);
    } else {
      Logger.log(`\n⚠️ 未找到 GPT-4 或 GPT-5 模型，請檢查 API Key 權限`);
    }
    
    Logger.log("=".repeat(70));
    
    return {
      success: true,
      total_models: models.length,
      gpt5_models: gpt5Models.map(m => m.id),
      gpt4_models: gpt4Models.map(m => m.id),
      o3_models: o3Models.map(m => m.id),
      all_models: sortedModels.map(m => m.id)
    };
    
  } catch (error) {
    Logger.log(`✗ 檢查失敗：${error.message}`);
    Logger.log("錯誤堆疊：", error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// Claude 模型檢查（手動測試）
// ==========================================

/**
 * 測試 Claude 模型（需要手動測試，因為 Anthropic API 沒有列出模型的端點）
 */
function testClaudeModel(modelName) {
  Logger.log(`測試 Claude 模型：${modelName}`);
  
  try {
    const apiKey = getAPIKey("ANTHROPIC");
    const apiUrl = "https://api.anthropic.com/v1/messages";
    
    const requestBody = {
      model: modelName,
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: "test"
        }
      ]
    };
    
    const response = UrlFetchApp.fetch(apiUrl, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      Logger.log(`✓ ${modelName}：可用`);
      return true;
    } else {
      const errorBody = JSON.parse(response.getContentText());
      Logger.log(`✗ ${modelName}：${errorBody.error?.message || "不可用"}`);
      return false;
    }
  } catch (error) {
    Logger.log(`✗ ${modelName}：測試失敗 - ${error.message}`);
    return false;
  }
}

/**
 * 檢查 Claude 可用模型（測試常見模型）
 */
function checkClaudeModels() {
  Logger.log("=".repeat(70));
  Logger.log("🔍 檢查 Claude 可用模型");
  Logger.log("=".repeat(70));
  Logger.log("注意：Anthropic API 沒有列出模型的端點，需要逐一測試\n");
  
  const modelsToTest = [
    "claude-opus-4-5-20251101",
    "claude-opus-4-5",
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-5",
    "claude-3-5-opus-20241022",
    "claude-3-5-sonnet-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229"
  ];
  
  const availableModels = [];
  
  modelsToTest.forEach(model => {
    if (testClaudeModel(model)) {
      availableModels.push(model);
    }
    Utilities.sleep(500);  // 避免請求過快
  });
  
  Logger.log("\n" + "=".repeat(70));
  Logger.log("📋 可用模型總結");
  Logger.log("=".repeat(70));
  
  if (availableModels.length > 0) {
    Logger.log(`\n找到 ${availableModels.length} 個可用模型：`);
    availableModels.forEach(m => Logger.log(`  ✓ ${m}`));
    
    // 推薦使用最新的可用模型
    const recommended = availableModels[0];
    Logger.log(`\n💡 建議使用：${recommended}`);
    Logger.log(`\n請在 src/02_M0_CONFIG.js 中更新對應配置`);
  } else {
    Logger.log("\n⚠️ 未找到可用的 Claude 模型，請檢查 API Key 權限");
  }
  
  Logger.log("=".repeat(70));
  
  return {
    success: availableModels.length > 0,
    available_models: availableModels
  };
}

// ==========================================
// Gemini 模型檢查（手動測試）
// ==========================================

/**
 * 測試 Gemini 模型
 */
function testGeminiModel(modelName) {
  Logger.log(`測試 Gemini 模型：${modelName}`);
  
  try {
    const apiKey = getAPIKey("GEMINI");
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: "test"
        }]
      }],
      generationConfig: {
        maxOutputTokens: 10
      }
    };
    
    const response = UrlFetchApp.fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      Logger.log(`✓ ${modelName}：可用`);
      return true;
    } else {
      const errorBody = JSON.parse(response.getContentText());
      Logger.log(`✗ ${modelName}：${errorBody.error?.message || "不可用"}`);
      return false;
    }
  } catch (error) {
    Logger.log(`✗ ${modelName}：測試失敗 - ${error.message}`);
    return false;
  }
}

/**
 * 檢查 Gemini 可用模型
 */
function checkGeminiModels() {
  Logger.log("=".repeat(70));
  Logger.log("🔍 檢查 Gemini 可用模型");
  Logger.log("=".repeat(70));
  Logger.log("注意：需要逐一測試模型\n");
  
  const modelsToTest = [
    "gemini-3-pro-preview-11-2025",
    "gemini-3-pro-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash"
  ];
  
  const availableModels = [];
  
  modelsToTest.forEach(model => {
    if (testGeminiModel(model)) {
      availableModels.push(model);
    }
    Utilities.sleep(500);  // 避免請求過快
  });
  
  Logger.log("\n" + "=".repeat(70));
  Logger.log("📋 可用模型總結");
  Logger.log("=".repeat(70));
  
  if (availableModels.length > 0) {
    Logger.log(`\n找到 ${availableModels.length} 個可用模型：`);
    availableModels.forEach(m => Logger.log(`  ✓ ${m}`));
    
    // 推薦使用最新的可用模型
    const recommendedPro = availableModels.find(m => m.includes("pro")) || availableModels[0];
    const recommendedFlash = availableModels.find(m => m.includes("flash")) || availableModels[0];
    
    Logger.log(`\n💡 建議使用：`);
    Logger.log(`  GEMINI_PRO: ${recommendedPro}`);
    Logger.log(`  GEMINI_FLASH: ${recommendedFlash}`);
    Logger.log(`\n請在 src/02_M0_CONFIG.js 中更新對應配置`);
  } else {
    Logger.log("\n⚠️ 未找到可用的 Gemini 模型，請檢查 API Key 權限");
  }
  
  Logger.log("=".repeat(70));
  
  return {
    success: availableModels.length > 0,
    available_models: availableModels
  };
}

// ==========================================
// 完整檢查
// ==========================================

/**
 * 檢查所有模型的可用性
 */
function checkAllModels() {
  Logger.log("=".repeat(70));
  Logger.log("🔍 完整模型可用性檢查");
  Logger.log("=".repeat(70));
  Logger.log("");
  
  const results = {
    openai: null,
    claude: null,
    gemini: null
  };
  
  // 檢查 OpenAI
  Logger.log("【1/3】檢查 OpenAI 模型...\n");
  results.openai = checkOpenAIModels();
  Logger.log("\n");
  
  // 等待一下
  Utilities.sleep(1000);
  
  // 檢查 Claude
  Logger.log("【2/3】檢查 Claude 模型...\n");
  results.claude = checkClaudeModels();
  Logger.log("\n");
  
  // 等待一下
  Utilities.sleep(1000);
  
  // 檢查 Gemini
  Logger.log("【3/3】檢查 Gemini 模型...\n");
  results.gemini = checkGeminiModels();
  Logger.log("\n");
  
  // 總結
  Logger.log("=".repeat(70));
  Logger.log("📊 檢查總結");
  Logger.log("=".repeat(70));
  
  Logger.log(`\nOpenAI：${results.openai?.success ? "✓" : "✗"}`);
  if (results.openai?.gpt5_models?.length > 0) {
    Logger.log(`  可用 GPT-5 模型：${results.openai.gpt5_models.join(", ")}`);
  }
  
  Logger.log(`\nClaude：${results.claude?.success ? "✓" : "✗"}`);
  if (results.claude?.available_models?.length > 0) {
    Logger.log(`  可用模型：${results.claude.available_models.join(", ")}`);
  }
  
  Logger.log(`\nGemini：${results.gemini?.success ? "✓" : "✗"}`);
  if (results.gemini?.available_models?.length > 0) {
    Logger.log(`  可用模型：${results.gemini.available_models.join(", ")}`);
  }
  
  Logger.log("\n" + "=".repeat(70));
  Logger.log("💡 下一步");
  Logger.log("=".repeat(70));
  Logger.log("\n根據檢查結果，請在 src/02_M0_CONFIG.js 中更新模型配置：");
  Logger.log("\n1. 如果找到 GPT-5 模型，更新 GPT 配置");
  Logger.log("2. 如果找到 Claude 4.5 模型，更新 SONNET/OPUS 配置");
  Logger.log("3. 如果找到 Gemini 3.0 Pro，更新 GEMINI_PRO 配置");
  Logger.log("\n然後執行 clasp push 上傳更新");
  Logger.log("=".repeat(70));
  
  return results;
}
