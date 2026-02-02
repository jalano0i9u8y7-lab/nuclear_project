/**
 * 🔑 CSE Keys 設置腳本
 * 
 * 用於將所有 Google CSE CX ID 和 API Key 設置到 PropertiesService
 * 
 * ⚠️ 重要：執行此腳本前，請確保已在 Google Apps Script 編輯器中打開專案
 * 
 * @version V8.0
 * @date 2026-01-16
 */

/**
 * 設置所有 CSE Keys
 * 
 * 執行方式：
 * 1. 在 Google Apps Script 編輯器中打開此檔案
 * 2. 執行 setupAllCSEKeys() 函數
 * 3. 檢查日誌確認所有 key 已設置成功
 */
function setupAllCSEKeys() {
  const properties = PropertiesService.getScriptProperties();
  
  // CSE API Key
  // ⚠️ 注意：此 API Key 直接存儲為 GOOGLE_CSE_API_KEY（不加 API_KEY_ 前綴）
  // ⚠️ 重要：Google API Key 應以 "AIza" 開頭（大寫 I），如果看到 "Alza"（小寫 l）請修正
  const CSE_API_KEY = "AIzaSyDrs__Z1eqvLkfgHOgdAZQP-7A3gjsc6lI";  // 更新：2026-01-16
  
  // 所有 CSE CX ID
  const CSE_KEYS = {
    // API Key
    "GOOGLE_CSE_API_KEY": CSE_API_KEY,
    
    // 通用 CSE（如果需要）
    "GOOGLE_CSE_ALL": "e1233d78fb9a54e77",
    
    // P5 相關 CSE
    "GOOGLE_CSE_CX_P5_OHLCV": "868b3223efd4e4b95",
    "GOOGLE_CSE_CX_P5_SECTOR_ETF": "2613d6712a9cb4edf",
    "GOOGLE_CSE_CX_P5_NEWS": "f1527dbe4d36e4dec",
    "GOOGLE_CSE_CX_P5_WORLD": "519d1500d22b24e31",  // 更新：2026-01-16
    
    // P5 衍生品 CSE（⭐⭐⭐ V8.0 修正：按市場分開，避免格式衝突）
    "GOOGLE_CSE_CX_P5_DERIVATIVES_US": "74a662866309c4ff3",      // 美股衍生品
    "GOOGLE_CSE_CX_P5_DERIVATIVES_TAIWAN": "072e597f05d7e4222",  // 台股衍生品
    "GOOGLE_CSE_CX_P5_DERIVATIVES_JAPAN": "06439c62c328545e9",  // 日股衍生品
    
    // P2 相關 CSE（⭐⭐⭐ V8.0 SSOT 定案：統一數據源設計）
    "GOOGLE_CSE_CX_P2_US_TAIWAN": "76c5f7209c42f4378",  // P2 美股和台股財務數據（財報狗）
    "GOOGLE_CSE_CX_P2_JAPAN": "97d9e077813214cd3",      // P2 日股財務數據（buffet code）
    
    // 台股股價資料 CSE（⚠️ 注意：不是財務數據，是股價資料）
    "GOOGLE_CSE_CX_TAIWAN_STOCK": "16ad013adacdb43f7",  // 台股股價資料數據（不用於 P2 財務數據）
    
    // P5 衍生品 CSE（⭐⭐⭐ V8.0 修正：按市場分開，避免格式衝突）
    "GOOGLE_CSE_CX_P5_DERIVATIVES_US": "[待設定]",      // 美股衍生品（theocc.com）
    "GOOGLE_CSE_CX_P5_DERIVATIVES_TAIWAN": "[待設定]",  // 台股衍生品（taifex.com.tw）
    "GOOGLE_CSE_CX_P5_DERIVATIVES_JAPAN": "[待設定]",   // 日股衍生品（jpx.co.jp）
    
    // 機構數據 CSE
    "GOOGLE_CSE_CX_INSTITUTIONAL": "d61207f09faad4d1e",
    
    // 供應鏈 CSE
    "GOOGLE_CSE_CX_SUPPLY_CHAIN": "017411de436be4588",
    
    // 財報日曆 CSE
    "GOOGLE_CSE_CX_EARNINGS": "f797bd6158b6e4d23",
    
    // 人類信號 CSE（手動使用）
    "GOOGLE_CSE_CX_HUMAN_SIGNAL": "632b5b00ca7a74ccf"
  };
  
  Logger.log("開始設置 CSE Keys...");
  Logger.log(`共需設置 ${Object.keys(CSE_KEYS).length} 個 keys`);
  
  let successCount = 0;
  let failCount = 0;
  
  // 設置每個 key
  for (const [keyName, keyValue] of Object.entries(CSE_KEYS)) {
    try {
      properties.setProperty(keyName, keyValue);
      Logger.log(`✅ 設置成功：${keyName} = ${keyValue.substring(0, 10)}...`);
      successCount++;
    } catch (error) {
      Logger.log(`❌ 設置失敗：${keyName} - ${error.message}`);
      failCount++;
    }
  }
  
  Logger.log("\n=== 設置完成 ===");
  Logger.log(`成功：${successCount} 個`);
  Logger.log(`失敗：${failCount} 個`);
  
  // 驗證設置
  Logger.log("\n=== 驗證設置 ===");
  verifyCSEKeys();
  
  return {
    success: successCount,
    failed: failCount,
    total: Object.keys(CSE_KEYS).length
  };
}

/**
 * 驗證所有 CSE Keys 是否已正確設置
 */
function verifyCSEKeys() {
  const properties = PropertiesService.getScriptProperties();
  
  // 需要驗證的 CSE Keys（根據 GOOGLE_CSE_CONFIG）
  const requiredKeys = [
    "GOOGLE_CSE_API_KEY",
    "GOOGLE_CSE_CX_P5_OHLCV",
    "GOOGLE_CSE_CX_P5_SECTOR_ETF",
    "GOOGLE_CSE_CX_P5_NEWS",
    "GOOGLE_CSE_CX_P5_WORLD",
    "GOOGLE_CSE_CX_P2_US_TAIWAN",
    "GOOGLE_CSE_CX_P2_JAPAN",
    "GOOGLE_CSE_CX_TAIWAN_STOCK",
    "GOOGLE_CSE_CX_P5_DERIVATIVES_US",
    "GOOGLE_CSE_CX_P5_DERIVATIVES_TAIWAN",
    "GOOGLE_CSE_CX_P5_DERIVATIVES_JAPAN",
    "GOOGLE_CSE_CX_INSTITUTIONAL",
    "GOOGLE_CSE_CX_SUPPLY_CHAIN",
    "GOOGLE_CSE_CX_EARNINGS",
    "GOOGLE_CSE_CX_HUMAN_SIGNAL"
  ];
  
  Logger.log("開始驗證 CSE Keys...");
  
  let allValid = true;
  const missingKeys = [];
  const existingKeys = [];
  
  for (const keyName of requiredKeys) {
    const keyValue = properties.getProperty(keyName);
    if (keyValue) {
      Logger.log(`✅ ${keyName} = ${keyValue.substring(0, 10)}...`);
      existingKeys.push(keyName);
    } else {
      Logger.log(`❌ ${keyName} 未設置`);
      missingKeys.push(keyName);
      allValid = false;
    }
  }
  
  Logger.log("\n=== 驗證結果 ===");
  Logger.log(`已設置：${existingKeys.length} 個`);
  Logger.log(`未設置：${missingKeys.length} 個`);
  
  if (missingKeys.length > 0) {
    Logger.log("\n未設置的 Keys：");
    missingKeys.forEach(key => Logger.log(`  - ${key}`));
  }
  
  if (allValid) {
    Logger.log("\n✅ 所有 CSE Keys 已正確設置！");
  } else {
    Logger.log("\n⚠️ 部分 CSE Keys 未設置，請執行 setupAllCSEKeys() 函數");
  }
  
  return {
    allValid: allValid,
    existing: existingKeys.length,
    missing: missingKeys.length,
    missingKeys: missingKeys
  };
}

/**
 * 更新單個 CSE Key
 * 
 * @param {string} keyName - Key 名稱
 * @param {string} keyValue - Key 值
 */
function updateSingleCSEKey(keyName, keyValue) {
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(keyName, keyValue);
    Logger.log(`✅ 更新成功：${keyName} = ${keyValue.substring(0, 10)}...`);
    return true;
  } catch (error) {
    Logger.log(`❌ 更新失敗：${keyName} - ${error.message}`);
    return false;
  }
}

/**
 * 獲取所有已設置的 CSE Keys（用於檢查）
 * 
 * @return {Object} 所有 CSE Keys
 */
function getAllCSEKeys() {
  const properties = PropertiesService.getScriptProperties();
  
  const allKeys = {
    "GOOGLE_CSE_API_KEY": properties.getProperty("GOOGLE_CSE_API_KEY"),
    "GOOGLE_CSE_ALL": properties.getProperty("GOOGLE_CSE_ALL"),
    "GOOGLE_CSE_CX_P5_OHLCV": properties.getProperty("GOOGLE_CSE_CX_P5_OHLCV"),
    "GOOGLE_CSE_CX_P5_SECTOR_ETF": properties.getProperty("GOOGLE_CSE_CX_P5_SECTOR_ETF"),
    "GOOGLE_CSE_CX_P5_NEWS": properties.getProperty("GOOGLE_CSE_CX_P5_NEWS"),
    "GOOGLE_CSE_CX_P5_WORLD": properties.getProperty("GOOGLE_CSE_CX_P5_WORLD"),
    "GOOGLE_CSE_CX_P2_US_TAIWAN": properties.getProperty("GOOGLE_CSE_CX_P2_US_TAIWAN"),
    "GOOGLE_CSE_CX_P2_JAPAN": properties.getProperty("GOOGLE_CSE_CX_P2_JAPAN"),
    "GOOGLE_CSE_CX_TAIWAN_STOCK": properties.getProperty("GOOGLE_CSE_CX_TAIWAN_STOCK"),
    "GOOGLE_CSE_CX_P5_DERIVATIVES_US": properties.getProperty("GOOGLE_CSE_CX_P5_DERIVATIVES_US"),
    "GOOGLE_CSE_CX_P5_DERIVATIVES_TAIWAN": properties.getProperty("GOOGLE_CSE_CX_P5_DERIVATIVES_TAIWAN"),
    "GOOGLE_CSE_CX_P5_DERIVATIVES_JAPAN": properties.getProperty("GOOGLE_CSE_CX_P5_DERIVATIVES_JAPAN"),
    "GOOGLE_CSE_CX_INSTITUTIONAL": properties.getProperty("GOOGLE_CSE_CX_INSTITUTIONAL"),
    "GOOGLE_CSE_CX_SUPPLY_CHAIN": properties.getProperty("GOOGLE_CSE_CX_SUPPLY_CHAIN"),
    "GOOGLE_CSE_CX_EARNINGS": properties.getProperty("GOOGLE_CSE_CX_EARNINGS"),
    "GOOGLE_CSE_CX_HUMAN_SIGNAL": properties.getProperty("GOOGLE_CSE_CX_HUMAN_SIGNAL")
  };
  
  return allKeys;
}
