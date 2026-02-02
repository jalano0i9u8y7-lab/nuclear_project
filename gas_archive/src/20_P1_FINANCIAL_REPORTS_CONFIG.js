/**
 * ⭐ V8.17.1 新增：SEC Cloud Run 代理配置
 * 
 * 設置和管理 SEC 數據抓取的 Cloud Run 代理 URL
 * 
 * @version V8.17.1
 * @date 2026-01-22
 */

/**
 * ⭐ V8.17.1 新增：設置 SEC Cloud Run 代理 URL
 * 
 * 使用方式：
 * 1. 在 GAS 編輯器中執行此函數
 * 2. 將 cloudRunUrl 替換為您的實際 Cloud Run URL
 * 3. 執行後，系統會自動使用代理訪問 SEC
 * 
 * @param {string} cloudRunUrl - Cloud Run 服務 URL（例如：https://fetchSecData-XXXXX-XX.a.run.app）
 */
function setupSECProxy(cloudRunUrl) {
  if (!cloudRunUrl) {
    throw new Error("請提供 Cloud Run URL");
  }
  
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty("CLOUD_FUNCTION_SEC_URL", cloudRunUrl);
  
  Logger.log("✓ SEC Cloud Run 代理 URL 已設置：");
  Logger.log(cloudRunUrl);
  
  return cloudRunUrl;
}

/**
 * ⭐ V8.17.1 新增：手動設置 SEC Cloud Run 代理 URL（不需要參數）
 * 
 * 使用方式：
 * 1. 在函數內部修改 cloudFunctionUrl 為您的實際 Cloud Run URL
 * 2. 在 GAS 編輯器中執行此函數
 * 3. 執行後，系統會自動使用代理訪問 SEC
 */
function setupSECProxyManually() {
  const properties = PropertiesService.getScriptProperties();
  
  // ⚠️ 替換為您的實際 Cloud Run URL
  const cloudFunctionUrl = "https://fetchSecData-XXXXX-XX.a.run.app";
  
  properties.setProperty("CLOUD_FUNCTION_SEC_URL", cloudFunctionUrl);
  
  Logger.log("✓ SEC Cloud Run 代理 URL 已設置：");
  Logger.log(cloudFunctionUrl);
  
  return cloudFunctionUrl;
}

/**
 * ⭐ V8.17.1 新增：檢查 SEC Cloud Run 代理配置
 * 
 * @return {string|null} 代理 URL 或 null
 */
function checkSECProxyConfig() {
  const properties = PropertiesService.getScriptProperties();
  const cloudRunUrl = properties.getProperty("CLOUD_FUNCTION_SEC_URL");
  
  if (cloudRunUrl) {
    Logger.log(`✓ SEC 代理 URL 已設置：${cloudRunUrl}`);
    return cloudRunUrl;
  } else {
    Logger.log("⚠️ SEC 代理 URL 未設置");
    Logger.log("請執行 setupSECProxy() 函數設置代理 URL");
    return null;
  }
}

/**
 * ⭐ V8.17.1 新增：測試 SEC Cloud Run 代理
 * 
 * 測試代理是否正常工作
 */
function testSECProxy() {
  const properties = PropertiesService.getScriptProperties();
  const cloudRunUrl = properties.getProperty("CLOUD_FUNCTION_SEC_URL");
  
  if (!cloudRunUrl) {
    Logger.log("❌ SEC 代理 URL 未設置");
    Logger.log("請先執行 setupSECProxy() 函數設置代理 URL");
    return;
  }
  
  Logger.log(`🧪 開始測試 SEC Cloud Run 代理：${cloudRunUrl}`);
  
  // 測試 0：健康檢查（優先測試）
  try {
    Logger.log("測試 0：健康檢查...");
    const healthResponse = UrlFetchApp.fetch(`${cloudRunUrl}/health`, {
      method: "GET",
      muteHttpExceptions: true,
      timeout: 10000
    });
    
    const healthCode = healthResponse.getResponseCode();
    if (healthCode === 200) {
      const healthData = JSON.parse(healthResponse.getContentText());
      Logger.log(`✅ 健康檢查通過：${JSON.stringify(healthData)}`);
    } else {
      Logger.log(`❌ 健康檢查失敗（HTTP ${healthCode}）`);
      Logger.log(`錯誤內容：${healthResponse.getContentText().substring(0, 500)}`);
      Logger.log("⚠️ 建議：檢查 Cloud Run 服務狀態，可能需要重新部署");
      return; // 健康檢查失敗，不繼續其他測試
    }
  } catch (healthError) {
    Logger.log(`❌ 健康檢查異常：${healthError.message}`);
    Logger.log("⚠️ 建議：檢查 Cloud Run 服務是否正常運行");
    return; // 健康檢查失敗，不繼續其他測試
  }
  
  // 測試 1：測試 master.gz 下載
  try {
    Logger.log("測試 1：下載 master.gz...");
    const testUrl = "https://www.sec.gov/Archives/edgar/full-index/2026/QTR1/master.gz";
    const response = UrlFetchApp.fetch(`${cloudRunUrl}?url=${encodeURIComponent(testUrl)}&type=gzip`, {
      method: "GET",
      muteHttpExceptions: true,
      timeout: 60000
    });
    
    if (response.getResponseCode() === 200) {
      const content = response.getContentText();
      Logger.log(`✓ 測試 1 成功：下載了 ${content.length} 字符`);
    } else {
      Logger.log(`❌ 測試 1 失敗：HTTP ${response.getResponseCode()}`);
      Logger.log(response.getContentText().substring(0, 500));
    }
  } catch (error) {
    Logger.log(`❌ 測試 1 失敗：${error.message}`);
  }
  
  // 測試 2：測試 JSON 響應處理（使用一個已知存在的 SEC JSON API）
  try {
    Logger.log("測試 2：測試 JSON 響應處理...");
    // 使用 SEC 的 company_tickers.json（這個文件通常存在）
    const testUrl = "https://www.sec.gov/files/company_tickers.json";
    const proxyUrl = `${cloudRunUrl}?url=${encodeURIComponent(testUrl)}&type=json`;
    Logger.log(`測試 URL：${testUrl}`);
    
    const response = UrlFetchApp.fetch(proxyUrl, {
      method: "GET",
      muteHttpExceptions: true,
      timeout: 60000
    });
    
    const code = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`HTTP 狀態碼：${code}`);
    Logger.log(`響應長度：${responseText.length} 字符`);
    
    if (code === 200) {
      // 檢查響應是否為 JSON
      if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
        try {
          const content = JSON.parse(responseText);
          const keyCount = typeof content === 'object' ? Object.keys(content).length : 0;
          Logger.log(`✓ 測試 2 成功：解析了 JSON，包含 ${keyCount} 個鍵/元素`);
        } catch (parseError) {
          Logger.log(`❌ 測試 2 失敗：JSON 解析錯誤：${parseError.message}`);
          Logger.log(`響應內容前 500 字符：${responseText.substring(0, 500)}`);
        }
      } else if (responseText.trim().toLowerCase().includes('placeholder')) {
        Logger.log(`❌ 測試 2 失敗：代理服務返回了 Cloud Run placeholder 頁面`);
        Logger.log(`這表示代理服務可能沒有正確處理請求，或服務未正確部署`);
        Logger.log(`響應內容前 500 字符：${responseText.substring(0, 500)}`);
      } else {
        Logger.log(`❌ 測試 2 失敗：響應不是 JSON 格式`);
        Logger.log(`響應內容前 500 字符：${responseText.substring(0, 500)}`);
      }
    } else if (code === 404) {
      // 404 是正常的（如果文件不存在），但這表示代理正確處理了請求
      Logger.log(`⚠️ 測試 2：HTTP 404（文件不存在），但代理正確處理了請求`);
      Logger.log(`這表示 Cloud Run 代理工作正常，只是測試 URL 不存在`);
    } else {
      Logger.log(`❌ 測試 2 失敗：HTTP ${code}`);
      Logger.log(`響應內容前 500 字符：${responseText.substring(0, 500)}`);
    }
  } catch (error) {
    Logger.log(`❌ 測試 2 失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
  }
  
  // 測試 3：快速驗證 master.gz 解壓（新增）
  try {
    Logger.log("測試 3：快速驗證 master.gz 解壓...");
    const testUrl = "https://www.sec.gov/Archives/edgar/full-index/2025/QTR4/master.gz";
    const proxyUrl = `${cloudRunUrl}?url=${encodeURIComponent(testUrl)}&type=gzip`;
    Logger.log(`測試 URL：${proxyUrl.substring(0, 100)}...`);
    
    const response = UrlFetchApp.fetch(proxyUrl, {
      method: "GET",
      muteHttpExceptions: true,
      timeout: 60000
    });
    
    const code = response.getResponseCode();
    if (code === 200) {
      const text = response.getContentText();
      const preview = text.substring(0, 200);
      Logger.log(`✓ 測試 3 成功：獲取內容，前 200 字符：`);
      Logger.log(preview);
      
      // 檢查是否為正確的解壓內容
      if (preview.includes('CIK|Company Name|Form Type|Date Filed|Filename')) {
        Logger.log(`✅ 測試 3：確認 master.gz 已正確解壓（包含表頭）`);
      } else if (preview.startsWith('\x1f\x8b') || preview.includes('\\x1f\\x8b')) {
        Logger.log(`❌ 測試 3：master.gz 未解壓（仍為壓縮格式）`);
      } else {
        Logger.log(`⚠️ 測試 3：內容格式不確定，請手動檢查`);
      }
      
      // 檢查 X-Debug header
      const debugHeader = response.getHeaders()['X-Debug'];
      if (debugHeader) {
        Logger.log(`ℹ️ X-Debug header: ${debugHeader}`);
      }
    } else {
      Logger.log(`❌ 測試 3 失敗：HTTP ${code}`);
      Logger.log(response.getContentText().substring(0, 500));
    }
  } catch (error) {
    Logger.log(`❌ 測試 3 失敗：${error.message}`);
  }
  
  // 測試 3：快速驗證 master.gz 解壓（新增）
  try {
    Logger.log("測試 3：快速驗證 master.gz 解壓...");
    const testUrl = "https://www.sec.gov/Archives/edgar/full-index/2025/QTR4/master.gz";
    const proxyUrl = `${cloudRunUrl}?url=${encodeURIComponent(testUrl)}&type=gzip`;
    Logger.log(`測試 URL：${proxyUrl.substring(0, 100)}...`);
    
    const response = UrlFetchApp.fetch(proxyUrl, {
      method: "GET",
      muteHttpExceptions: true,
      timeout: 60000
    });
    
    const code = response.getResponseCode();
    if (code === 200) {
      const text = response.getContentText();
      const preview = text.substring(0, 300);
      Logger.log(`✓ 測試 3 成功：獲取內容，前 300 字符：`);
      Logger.log(preview);
      
      // 檢查是否為正確的解壓內容
      if (preview.includes('CIK|Company Name|Form Type|Date Filed|Filename')) {
        Logger.log(`✅ 測試 3：確認 master.gz 已正確解壓（包含表頭）`);
      } else if (preview.charCodeAt(0) === 0x1F && preview.charCodeAt(1) === 0x8B) {
        Logger.log(`❌ 測試 3：master.gz 未解壓（仍為壓縮格式，magic bytes: 0x1F 0x8B）`);
        Logger.log(`⚠️ 請確認 Cloud Run 服務已重新部署最新代碼`);
      } else {
        Logger.log(`⚠️ 測試 3：內容格式不確定，請手動檢查`);
        Logger.log(`前 10 個字符的 charCode：${Array.from(preview.substring(0, 10)).map(c => '0x' + c.charCodeAt(0).toString(16)).join(', ')}`);
      }
      
      // 檢查 X-Debug header
      const headers = response.getHeaders();
      const debugHeader = headers['X-Debug'] || headers['x-debug'];
      if (debugHeader) {
        Logger.log(`ℹ️ X-Debug header: ${debugHeader}`);
      } else {
        Logger.log(`⚠️ 未找到 X-Debug header（可能使用舊版本 Cloud Run）`);
      }
    } else {
      Logger.log(`❌ 測試 3 失敗：HTTP ${code}`);
      Logger.log(response.getContentText().substring(0, 500));
    }
  } catch (error) {
    Logger.log(`❌ 測試 3 失敗：${error.message}`);
  }
  
  Logger.log("🧪 測試完成");
}
