/**
 * 🧪 單獨測試 P5_WORLD CSE
 * 
 * 診斷 P5_WORLD CSE 的 "invalid argument" 錯誤
 * 
 * @version V8.0
 * @date 2026-01-16
 */

/**
 * 單獨測試 P5_WORLD CSE
 */
function testP5WorldCSE() {
  Logger.log("=".repeat(80));
  Logger.log("🧪 單獨測試 P5_WORLD CSE");
  Logger.log("=".repeat(80));
  
  const cseType = "P5_WORLD";
  const properties = PropertiesService.getScriptProperties();
  
  // 1. 檢查配置
  Logger.log("\n1. 檢查配置：");
  const cseConfig = GOOGLE_CSE_CONFIG[cseType];
  if (!cseConfig) {
    Logger.log(`❌ CSE 配置不存在：${cseType}`);
    return;
  }
  Logger.log(`✅ 配置存在`);
  Logger.log(`   說明：${cseConfig.note}`);
  Logger.log(`   白名單網站：${cseConfig.sites.join(", ")}`);
  
  // 2. 檢查 CX ID
  Logger.log("\n2. 檢查 CX ID：");
  let cxId;
  try {
    cxId = getGoogleCSE_CX(cseType);
    Logger.log(`✅ CX ID: ${cxId}`);
    
    // 驗證 CX ID 格式（通常是 17 位數）
    if (cxId.length !== 17 && cxId.length !== 16) {
      Logger.log(`⚠️  CX ID 長度異常：${cxId.length}（通常是 16-17 位）`);
    }
  } catch (error) {
    Logger.log(`❌ CX ID 未設置：${error.message}`);
    return;
  }
  
  // 3. 檢查 API Key
  Logger.log("\n3. 檢查 API Key：");
  let apiKey = properties.getProperty("GOOGLE_CSE_API_KEY");
  if (!apiKey) {
    try {
      apiKey = getAPIKey("GEMINI");
    } catch (e) {
      try {
        apiKey = getAPIKey("GOOGLE");
      } catch (e2) {
        Logger.log(`❌ API Key 未設置`);
        return;
      }
    }
  }
  Logger.log(`✅ API Key: ${apiKey.substring(0, 10)}...`);
  
  // 4. 測試不同的查詢
  Logger.log("\n4. 測試不同的查詢：");
  
  const testQueries = [
    "FRED economic data",
    "GDP growth rate",
    "unemployment rate",
    "FRED",
    "site:fred.stlouisfed.org"
  ];
  
  for (const query of testQueries) {
    Logger.log(`\n   測試查詢："${query}"`);
    
    try {
      // 測試 num=1（最簡單的請求）
      const apiUrl1 = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(query)}&num=1`;
      
      Logger.log(`   發送請求 (num=1)...`);
      const response1 = UrlFetchApp.fetch(apiUrl1, {
        method: "GET",
        muteHttpExceptions: true
      });
      
      const statusCode1 = response1.getResponseCode();
      const responseText1 = response1.getContentText();
      
      if (statusCode1 === 200) {
        const result1 = JSON.parse(responseText1);
        Logger.log(`   ✅ 成功！找到 ${result1.items ? result1.items.length : 0} 筆結果`);
        
        if (result1.items && result1.items.length > 0) {
          Logger.log(`   第一個結果：${result1.items[0].link}`);
        }
        break; // 找到有效的查詢，停止測試
      } else {
        const errorObj1 = JSON.parse(responseText1);
        Logger.log(`   ❌ 失敗 (${statusCode1}): ${errorObj1.error?.message || responseText1.substring(0, 200)}`);
        
        // 如果是 "invalid argument"，可能是 CX ID 或查詢格式問題
        if (errorObj1.error?.message?.includes("invalid argument")) {
          Logger.log(`   💡 建議：`);
          Logger.log(`      - 檢查 CX ID 是否正確：${cxId}`);
          Logger.log(`      - 檢查查詢是否包含特殊字元`);
          Logger.log(`      - 嘗試更簡單的查詢`);
        }
      }
    } catch (error) {
      Logger.log(`   ❌ 異常：${error.message}`);
    }
    
    Utilities.sleep(500); // 避免請求過快
  }
  
  // 5. 檢查 CX ID 是否正確
  Logger.log("\n5. 驗證 CX ID：");
  Logger.log(`   當前 CX ID: ${cxId}`);
  Logger.log(`   預期 CX ID: 519d1500d22b24e31`);
  
  if (cxId === "519d1500d22b24e31") {
    Logger.log(`   ✅ CX ID 匹配`);
  } else {
    Logger.log(`   ⚠️  CX ID 不匹配！`);
    Logger.log(`   💡 建議：執行 setupAllCSEKeys() 重新設置 CX ID`);
  }
  
  Logger.log("\n" + "=".repeat(80));
  Logger.log("📋 測試完成");
  Logger.log("=".repeat(80));
}

/**
 * 驗證並修正 P5_WORLD CX ID
 */
function fixP5WorldCXID() {
  Logger.log("=".repeat(80));
  Logger.log("🔧 驗證並修正 P5_WORLD CX ID");
  Logger.log("=".repeat(80));
  
  const properties = PropertiesService.getScriptProperties();
  const expectedCxId = "519d1500d22b24e31";  // 更新：2026-01-16
  const currentCxId = properties.getProperty("GOOGLE_CSE_CX_P5_WORLD");
  
  Logger.log(`\n當前 CX ID: ${currentCxId || "未設置"}`);
  Logger.log(`預期 CX ID: ${expectedCxId}`);
  
  if (currentCxId === expectedCxId) {
    Logger.log(`\n✅ CX ID 正確，無需修正`);
    return;
  }
  
  Logger.log(`\n⚠️  CX ID 不匹配，正在修正...`);
  properties.setProperty("GOOGLE_CSE_CX_P5_WORLD", expectedCxId);
  Logger.log(`✅ 已更新為：${expectedCxId}`);
  
  // 驗證
  const verifyCxId = properties.getProperty("GOOGLE_CSE_CX_P5_WORLD");
  if (verifyCxId === expectedCxId) {
    Logger.log(`✅ 驗證成功：CX ID 已正確設置`);
  } else {
    Logger.log(`❌ 驗證失敗：設置後仍為 ${verifyCxId}`);
  }
}
