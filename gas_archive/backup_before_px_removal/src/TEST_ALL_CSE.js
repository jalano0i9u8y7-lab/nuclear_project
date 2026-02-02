/**
 * 🧪 測試所有 CSE 數據線暢通性
 * 
 * 系統性測試所有配置的 Google CSE 是否能正常運作
 * 
 * @version V8.0
 * @date 2026-01-16
 */

/**
 * 測試所有 CSE 數據線
 * 
 * 執行方式：
 * 1. 在 Google Apps Script 編輯器中執行 testAllCSE() 函數
 * 2. 查看日誌確認每個 CSE 的測試結果
 * 
 * @return {Object} 測試結果摘要
 */
function testAllCSE() {
  const startTime = Date.now();
  Logger.log("=".repeat(80));
  Logger.log("🧪 開始測試所有 CSE 數據線暢通性");
  Logger.log("=".repeat(80));
  
  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    details: {}
  };
  
  // 獲取所有配置的 CSE 類型
  const cseTypes = Object.keys(GOOGLE_CSE_CONFIG);
  
  Logger.log(`\n找到 ${cseTypes.length} 個配置的 CSE 類型`);
  Logger.log("-".repeat(80));
  
  // 測試每個 CSE
  for (const cseType of cseTypes) {
    // 跳過 HUMAN_SIGNAL（手動使用，不自動測試）
    if (cseType === "HUMAN_SIGNAL") {
      Logger.log(`\n⏭️  跳過 ${cseType}（手動使用，不自動測試）`);
      testResults.skipped++;
      continue;
    }
    
    testResults.total++;
    Logger.log(`\n📊 測試 ${testResults.total}/${cseTypes.length}: ${cseType}`);
    Logger.log("-".repeat(80));
    
    try {
      const result = testSingleCSE(cseType);
      testResults.details[cseType] = result;
      
      if (result.success) {
        testResults.passed++;
        Logger.log(`✅ ${cseType}: 測試通過`);
        Logger.log(`   找到 ${result.resultCount} 筆結果`);
        Logger.log(`   結果數量：${result.filteredCount} 筆（白名單由 CSE 後台控制）`);
        if (result.sampleSites && result.sampleSites.length > 0) {
          Logger.log(`   樣本網站：${result.sampleSites.slice(0, 3).join(", ")}`);
        }
      } else {
        testResults.failed++;
        Logger.log(`❌ ${cseType}: 測試失敗`);
        Logger.log(`   錯誤：${result.error}`);
      }
    } catch (error) {
      testResults.failed++;
      testResults.details[cseType] = {
        success: false,
        error: error.message
      };
      Logger.log(`❌ ${cseType}: 測試異常`);
      Logger.log(`   錯誤：${error.message}`);
    }
    
    // 避免請求過快
    Utilities.sleep(1000);
  }
  
  // 輸出測試摘要
  const duration = Date.now() - startTime;
  Logger.log("\n" + "=".repeat(80));
  Logger.log("📊 測試摘要");
  Logger.log("=".repeat(80));
  Logger.log(`總計：${testResults.total} 個 CSE`);
  Logger.log(`✅ 通過：${testResults.passed} 個`);
  Logger.log(`❌ 失敗：${testResults.failed} 個`);
  Logger.log(`⏭️  跳過：${testResults.skipped} 個`);
  Logger.log(`⏱️  耗時：${(duration / 1000).toFixed(2)} 秒`);
  Logger.log("=".repeat(80));
  
  // 詳細結果
  Logger.log("\n📋 詳細結果：");
  for (const [cseType, result] of Object.entries(testResults.details)) {
    if (result.success) {
      Logger.log(`✅ ${cseType}: ${result.resultCount} 筆結果（白名單由 CSE 後台控制）`);
    } else {
      Logger.log(`❌ ${cseType}: ${result.error}`);
    }
  }
  
  return testResults;
}

/**
 * 測試單個 CSE
 * 
 * @param {string} cseType - CSE 類型
 * @return {Object} 測試結果
 */
function testSingleCSE(cseType, maxResults = 10) {
  try {
    // 1. 檢查 CSE 配置是否存在
    const cseConfig = GOOGLE_CSE_CONFIG[cseType];
    if (!cseConfig) {
      return {
        success: false,
        error: `CSE 配置不存在：${cseType}`
      };
    }
    
    Logger.log(`   配置：${cseConfig.note || "無說明"}`);
    Logger.log(`   白名單網站：${cseConfig.sites.length} 個`);
    
    // 2. 檢查 CX ID 是否已設置
    let cxId;
    try {
      cxId = getGoogleCSE_CX(cseType);
      Logger.log(`   CX ID: ${cxId.substring(0, 10)}...`);
    } catch (error) {
      return {
        success: false,
        error: `CX ID 未設置：${error.message}`
      };
    }
    
    // 3. 檢查 API Key 是否已設置
    const properties = PropertiesService.getScriptProperties();
    let apiKey = properties.getProperty("GOOGLE_CSE_API_KEY");
    if (!apiKey) {
      try {
        apiKey = getAPIKey("GEMINI");
      } catch (e) {
        try {
          apiKey = getAPIKey("GOOGLE");
        } catch (e2) {
          return {
            success: false,
            error: "API Key 未設置（GOOGLE_CSE_API_KEY、API_KEY_GEMINI 或 API_KEY_GOOGLE）"
          };
        }
      }
    }
    Logger.log(`   API Key: ${apiKey.substring(0, 10)}...`);
    
    // 4. 構建測試查詢（根據 CSE 類型選擇合適的測試查詢）
    const testQuery = getTestQueryForCSE(cseType);
    Logger.log(`   測試查詢："${testQuery}"`);
    
    // 5. 執行 CSE 搜尋
    // ⚠️ 注意：num 參數最大為 10，超過會報錯 "invalid argument"
    const safeMaxResults = Math.min(maxResults || 10, 10);
    const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cxId}&q=${encodeURIComponent(testQuery)}&num=${safeMaxResults}`;
    
    Logger.log(`   發送請求... (num=${safeMaxResults})`);
    const response = UrlFetchApp.fetch(apiUrl, {
      method: "GET",
      muteHttpExceptions: true
    });
    
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (statusCode !== 200) {
      const errorObj = JSON.parse(responseText);
      return {
        success: false,
        error: `API 錯誤 (${statusCode}): ${errorObj.error?.message || responseText.substring(0, 200)}`
      };
    }
    
    const searchResult = JSON.parse(responseText);
    const items = searchResult.items || [];
    
    Logger.log(`   收到 ${items.length} 筆結果`);
    
    // ⭐⭐⭐ V8.0 定案：所有白名單都由 CSE 後台設定，程式碼中不需要任何白名單過濾機制
    // 完全信任 CSE 後台的白名單設定，直接使用所有返回的結果
    const filteredItems = items;  // 不再過濾，直接使用所有結果
    Logger.log(`   結果數量：${filteredItems.length} 筆（白名單由 CSE 後台控制）`);
    
    // 7. 提取樣本網站（僅用於驗證，不進行過濾）
    const sampleSites = filteredItems.slice(0, 5).map(item => {
      const link = item.link || "";
      // 嘗試匹配配置中列出的站點（僅用於顯示，不影響結果）
      if (cseConfig.sites && cseConfig.sites.length > 0) {
        for (const site of cseConfig.sites) {
          if (link.includes(site)) {
            return site;
          }
        }
      }
      // 從 URL 中提取域名作為樣本
      try {
        const url = new URL(link);
        return url.hostname.replace(/^www\./, '');
      } catch (e) {
        return "unknown";
      }
    });
    
    return {
      success: true,
      resultCount: items.length,
      filteredCount: filteredItems.length,
      sampleSites: [...new Set(sampleSites)],
      searchInfo: searchResult.searchInformation || {}
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 根據 CSE 類型獲取測試查詢
 * 
 * @param {string} cseType - CSE 類型
 * @return {string} 測試查詢
 */
function getTestQueryForCSE(cseType) {
  const testQueries = {
    // P5 Daily 相關 CSE
    "P5_OHLCV": "AAPL stock price",  // stooq.com（美股和日股）
    "P5_SECTOR_ETF": "XLK ETF holdings",
    "P5_DERIVATIVES_US": "SPX options open interest",  // theocc.com + cboe.com
    "P5_DERIVATIVES_TAIWAN": "台指期 選擇權 未平倉",  // taifex.com.tw
    "P5_DERIVATIVES_JAPAN": "日經225 オプション 建玉",  // jpx.co.jp
    "P5_NEWS": "Federal Reserve interest rate",
    "P5_WORLD": "FRED economic data",
    
    // P2 財務數據 CSE
    "P2_US_TAIWAN": "台積電 財報",  // ⭐ V8.0：P2 美股和台股財務數據（財報狗）
    "P2_JAPAN": "ソニー 決算",      // ⭐ V8.0：P2 日股財務數據（buffet code）
    
    // 其他 CSE
    "TAIWAN_STOCK": "台積電 股價",  // ⭐ V8.0：台股股價資料（不用於 P2 財務數據）
    "INSTITUTIONAL_DATA": "13F filing Apple",
    "SUPPLY_CHAIN": "supply chain disruption",
    "EARNINGS_CALENDAR": "earnings calendar 2026"
  };
  
  return testQueries[cseType] || "test query";
}

/**
 * 快速測試（僅測試關鍵 CSE）
 * 
 * 測試以下關鍵 CSE：
 * - P2_US_TAIWAN（P2 財務數據 - 美股和台股）
 * - P2_JAPAN（P2 財務數據 - 日股）
 * - P5_DERIVATIVES_US（P5 Daily 衍生品 - 美股）
 * - P5_DERIVATIVES_TAIWAN（P5 Daily 衍生品 - 台股）
 * - P5_DERIVATIVES_JAPAN（P5 Daily 衍生品 - 日股）
 * - INSTITUTIONAL_DATA（P2.5 籌碼面）
 * - P5_NEWS（P5 Daily 新聞）
 * - P5_OHLCV（P5 Daily OHLCV）
 * - TAIWAN_STOCK（台股股價資料）
 * 
 * @return {Object} 測試結果
 */
function testCriticalCSE() {
  Logger.log("=".repeat(80));
  Logger.log("🚀 快速測試關鍵 CSE");
  Logger.log("=".repeat(80));
  
  const criticalCSEs = [
    "P2_US_TAIWAN",  // ⭐ V8.0：P2 美股和台股財務數據
    "P2_JAPAN",      // ⭐ V8.0：P2 日股財務數據
    "P5_DERIVATIVES_US",      // ⭐ V8.0：美股衍生品
    "P5_DERIVATIVES_TAIWAN",  // ⭐ V8.0：台股衍生品
    "P5_DERIVATIVES_JAPAN",   // ⭐ V8.0：日股衍生品
    "TAIWAN_STOCK",  // ⭐ V8.0：台股股價資料
    "INSTITUTIONAL_DATA",
    "P5_NEWS",
    "P5_OHLCV"
  ];
  
  const results = {
    total: criticalCSEs.length,
    passed: 0,
    failed: 0,
    details: {}
  };
  
  for (const cseType of criticalCSEs) {
    Logger.log(`\n📊 測試：${cseType}`);
    try {
      const result = testSingleCSE(cseType);
      results.details[cseType] = result;
      
      if (result.success) {
        results.passed++;
        Logger.log(`✅ ${cseType}: 通過（${result.filteredCount} 筆結果）`);
      } else {
        results.failed++;
        Logger.log(`❌ ${cseType}: 失敗 - ${result.error}`);
      }
    } catch (error) {
      results.failed++;
      results.details[cseType] = {
        success: false,
        error: error.message
      };
      Logger.log(`❌ ${cseType}: 異常 - ${error.message}`);
    }
    
    Utilities.sleep(1000);
  }
  
  Logger.log("\n" + "=".repeat(80));
  Logger.log(`✅ 通過：${results.passed}/${results.total}`);
  Logger.log(`❌ 失敗：${results.failed}/${results.total}`);
  Logger.log("=".repeat(80));
  
  return results;
}

/**
 * 測試單個 CSE（手動調用）
 * 
 * @param {string} cseType - CSE 類型（例如："P2_US_TAIWAN"）
 * @return {Object} 測試結果
 */
function testOneCSE(cseType) {
  Logger.log(`🧪 測試 CSE: ${cseType}`);
  Logger.log("=".repeat(80));
  
  const result = testSingleCSE(cseType);
  
  if (result.success) {
    Logger.log(`\n✅ 測試通過！`);
    Logger.log(`   總結果數：${result.resultCount}`);
    Logger.log(`   結果數量：${result.filteredCount} 筆（白名單由 CSE 後台控制）`);
    if (result.sampleSites && result.sampleSites.length > 0) {
      Logger.log(`   樣本網站：${result.sampleSites.join(", ")}`);
    }
  } else {
    Logger.log(`\n❌ 測試失敗！`);
    Logger.log(`   錯誤：${result.error}`);
  }
  
  return result;
}
