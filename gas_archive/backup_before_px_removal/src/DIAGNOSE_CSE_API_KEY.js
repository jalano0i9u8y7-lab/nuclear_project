/**
 * 🔍 CSE API Key 診斷腳本
 * 
 * 診斷 CSE API Key 設置問題
 * 
 * @version V8.0
 * @date 2026-01-16
 */

/**
 * 診斷 CSE API Key 設置
 */
function diagnoseCSEAPIKey() {
  Logger.log("=".repeat(80));
  Logger.log("🔍 CSE API Key 診斷");
  Logger.log("=".repeat(80));
  
  const properties = PropertiesService.getScriptProperties();
  
  // 1. 檢查 GOOGLE_CSE_API_KEY
  Logger.log("\n1. 檢查 GOOGLE_CSE_API_KEY：");
  const cseApiKey = properties.getProperty("GOOGLE_CSE_API_KEY");
  if (cseApiKey) {
    Logger.log(`   ✅ 已設置：${cseApiKey.substring(0, 10)}...${cseApiKey.substring(cseApiKey.length - 5)}`);
    Logger.log(`   長度：${cseApiKey.length} 字元`);
    
    // 檢查格式
    if (cseApiKey.startsWith("AIza")) {
      Logger.log(`   ✅ 格式正確（以 AIza 開頭）`);
    } else {
      Logger.log(`   ⚠️  格式異常（應以 AIza 開頭，實際：${cseApiKey.substring(0, 4)}）`);
    }
  } else {
    Logger.log(`   ❌ 未設置`);
  }
  
  // 2. 檢查備用 API Keys
  Logger.log("\n2. 檢查備用 API Keys：");
  
  try {
    const geminiKey = getAPIKey("GEMINI");
    Logger.log(`   ✅ API_KEY_GEMINI: ${geminiKey.substring(0, 10)}...${geminiKey.substring(geminiKey.length - 5)}`);
    Logger.log(`   長度：${geminiKey.length} 字元`);
    if (geminiKey.startsWith("AIza")) {
      Logger.log(`   ✅ 格式正確`);
    } else {
      Logger.log(`   ⚠️  格式異常`);
    }
  } catch (e) {
    Logger.log(`   ❌ API_KEY_GEMINI: 未設置`);
  }
  
  try {
    const googleKey = getAPIKey("GOOGLE");
    Logger.log(`   ✅ API_KEY_GOOGLE: ${googleKey.substring(0, 10)}...${googleKey.substring(googleKey.length - 5)}`);
    Logger.log(`   長度：${googleKey.length} 字元`);
    if (googleKey.startsWith("AIza")) {
      Logger.log(`   ✅ 格式正確`);
    } else {
      Logger.log(`   ⚠️  格式異常`);
    }
  } catch (e) {
    Logger.log(`   ❌ API_KEY_GOOGLE: 未設置`);
  }
  
  // 3. 測試 API Key 是否有效
  Logger.log("\n3. 測試 API Key 有效性：");
  
  const testKeys = [];
  if (cseApiKey) testKeys.push({ name: "GOOGLE_CSE_API_KEY", key: cseApiKey });
  try {
    testKeys.push({ name: "API_KEY_GEMINI", key: getAPIKey("GEMINI") });
  } catch (e) {}
  try {
    testKeys.push({ name: "API_KEY_GOOGLE", key: getAPIKey("GOOGLE") });
  } catch (e) {}
  
  if (testKeys.length === 0) {
    Logger.log(`   ❌ 沒有可用的 API Key 進行測試`);
    return;
  }
  
  // 使用第一個可用的 CSE CX ID 進行測試
  let testCxId;
  try {
    testCxId = getGoogleCSE_CX("P5_NEWS");
  } catch (e) {
    Logger.log(`   ⚠️  無法獲取測試 CX ID：${e.message}`);
    return;
  }
  
  for (const testKey of testKeys) {
    Logger.log(`\n   測試 ${testKey.name}：`);
    
    try {
      const testUrl = `https://www.googleapis.com/customsearch/v1?key=${testKey.key}&cx=${testCxId}&q=test&num=1`;
      
      const response = UrlFetchApp.fetch(testUrl, {
        method: "GET",
        muteHttpExceptions: true
      });
      
      const statusCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      if (statusCode === 200) {
        Logger.log(`   ✅ 有效！API Key 可以正常使用`);
        const result = JSON.parse(responseText);
        Logger.log(`   搜尋結果：${result.items ? result.items.length : 0} 筆`);
      } else {
        const errorObj = JSON.parse(responseText);
        Logger.log(`   ❌ 無效（${statusCode}）：${errorObj.error?.message || responseText.substring(0, 200)}`);
        
        // 提供具體建議
        if (errorObj.error?.message?.includes("not valid")) {
          Logger.log(`   💡 建議：`);
          Logger.log(`      - 確認 API Key 是否正確複製（完整無遺漏）`);
          Logger.log(`      - 確認是否已啟用 "Custom Search API"`);
          Logger.log(`      - 前往 Google Cloud Console 檢查 API Key 狀態`);
        } else if (errorObj.error?.message?.includes("quota")) {
          Logger.log(`   💡 建議：`);
          Logger.log(`      - API 配額已用完，請檢查 Google Cloud Console`);
        }
      }
    } catch (error) {
      Logger.log(`   ❌ 測試失敗：${error.message}`);
    }
  }
  
  // 4. 檢查所有 CSE CX IDs
  Logger.log("\n4. 檢查所有 CSE CX IDs：");
  const cseTypes = Object.keys(GOOGLE_CSE_CONFIG);
  let cxIdCount = 0;
  let missingCxIds = [];
  
  for (const cseType of cseTypes) {
    if (cseType === "HUMAN_SIGNAL") continue; // 跳過手動使用的
    
    try {
      const cxId = getGoogleCSE_CX(cseType);
      cxIdCount++;
      Logger.log(`   ✅ ${cseType}: ${cxId.substring(0, 10)}...`);
    } catch (e) {
      missingCxIds.push(cseType);
      Logger.log(`   ❌ ${cseType}: 未設置`);
    }
  }
  
  Logger.log(`\n   CX ID 設置情況：${cxIdCount}/${cseTypes.length - 1}（跳過 HUMAN_SIGNAL）`);
  if (missingCxIds.length > 0) {
    Logger.log(`   未設置的 CX IDs：${missingCxIds.join(", ")}`);
  }
  
  // 5. 總結和建議
  Logger.log("\n" + "=".repeat(80));
  Logger.log("📋 診斷總結");
  Logger.log("=".repeat(80));
  
  if (!cseApiKey && testKeys.length === 0) {
    Logger.log("❌ 問題：沒有設置任何可用的 API Key");
    Logger.log("💡 解決方案：");
    Logger.log("   1. 執行 setupAllCSEKeys() 函數設置 API Key");
    Logger.log("   2. 或手動設置 GOOGLE_CSE_API_KEY 到 PropertiesService");
    Logger.log("   3. 確認 API Key 格式正確（應以 AIza 開頭）");
  } else if (cseApiKey && !cseApiKey.startsWith("AIza")) {
    Logger.log("⚠️  問題：GOOGLE_CSE_API_KEY 格式可能不正確");
    Logger.log("💡 解決方案：");
    Logger.log("   1. 確認 API Key 是否完整（通常 39 字元）");
    Logger.log("   2. 確認 API Key 是否以 'AIza' 開頭");
    Logger.log("   3. 重新設置正確的 API Key");
  } else {
    Logger.log("✅ API Key 設置看起來正常");
    Logger.log("💡 如果測試仍失敗，請檢查：");
    Logger.log("   1. 是否已啟用 'Custom Search API'");
    Logger.log("   2. API Key 是否有正確的權限");
    Logger.log("   3. 是否超過 API 配額限制");
  }
  
  Logger.log("=".repeat(80));
}

/**
 * 檢查並修正 API Key 格式
 * 
 * 如果 API Key 格式不正確，嘗試修正
 */
function fixCSEAPIKeyFormat() {
  Logger.log("=".repeat(80));
  Logger.log("🔧 檢查並修正 CSE API Key 格式");
  Logger.log("=".repeat(80));
  
  const properties = PropertiesService.getScriptProperties();
  const cseApiKey = properties.getProperty("GOOGLE_CSE_API_KEY");
  
  if (!cseApiKey) {
    Logger.log("❌ GOOGLE_CSE_API_KEY 未設置");
    Logger.log("💡 請先執行 setupAllCSEKeys() 函數");
    return;
  }
  
  Logger.log(`\n當前 API Key：${cseApiKey.substring(0, 10)}...${cseApiKey.substring(cseApiKey.length - 5)}`);
  Logger.log(`長度：${cseApiKey.length} 字元`);
  
  // 檢查是否需要修正
  if (cseApiKey.startsWith("Alza") && !cseApiKey.startsWith("AIza")) {
    Logger.log("\n⚠️  發現格式問題：以 'Alza' 開頭，應為 'AIza'");
    Logger.log("💡 這可能是複製時的問題（I 被誤認為 l）");
    
    // 嘗試修正
    const correctedKey = "AI" + cseApiKey.substring(2);
    Logger.log(`\n嘗試修正為：${correctedKey.substring(0, 10)}...${correctedKey.substring(correctedKey.length - 5)}`);
    
    // 測試修正後的 key
    try {
      const testCxId = getGoogleCSE_CX("P5_NEWS");
      const testUrl = `https://www.googleapis.com/customsearch/v1?key=${correctedKey}&cx=${testCxId}&q=test&num=1`;
      
      const response = UrlFetchApp.fetch(testUrl, {
        method: "GET",
        muteHttpExceptions: true
      });
      
      if (response.getResponseCode() === 200) {
        Logger.log("✅ 修正後的 API Key 有效！");
        properties.setProperty("GOOGLE_CSE_API_KEY", correctedKey);
        Logger.log("✅ 已更新 GOOGLE_CSE_API_KEY");
      } else {
        Logger.log("❌ 修正後的 API Key 仍無效");
        Logger.log("💡 請確認原始 API Key 是否正確");
      }
    } catch (error) {
      Logger.log(`❌ 測試失敗：${error.message}`);
    }
  } else if (cseApiKey.startsWith("AIza")) {
    Logger.log("\n✅ API Key 格式正確");
  } else {
    Logger.log("\n⚠️  API Key 格式異常");
    Logger.log("💡 Google API Key 通常以 'AIza' 開頭，長度約 39 字元");
  }
}
