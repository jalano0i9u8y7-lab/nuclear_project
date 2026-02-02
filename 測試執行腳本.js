/**
 * 🧪 Nuclear Project SSOT V7.1 測試執行腳本
 * 
 * 在 Google Apps Script 編輯器中執行此腳本進行測試
 * 
 * 使用方式：
 * 1. 複製此腳本到 GAS 編輯器
 * 2. 執行對應的測試函數
 * 3. 查看執行記錄和結果
 */

// ==========================================
// 測試前準備
// ==========================================

/**
 * 步驟 1：初始化所有表格
 * 
 * 執行此函數來創建所有必要的表格
 */
function testStep1_InitializeSheets() {
  Logger.log("=".repeat(50));
  Logger.log("步驟 1：初始化所有表格");
  Logger.log("=".repeat(50));
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initializeAllSheets(ss);
    Logger.log("✓ 所有表格初始化完成");
    
    // 列出創建的表格
    const sheets = ss.getSheets();
    Logger.log(`\n已創建 ${sheets.length} 個表格：`);
    sheets.forEach(sheet => {
      Logger.log(`  - ${sheet.getName()}`);
    });
    
    return true;
  } catch (error) {
    Logger.log(`✗ 初始化失敗：${error.message}`);
    Logger.log("錯誤堆疊：", error.stack);
    return false;
  }
}

/**
 * 步驟 2：檢查 API Keys 配置
 * 
 * 檢查必要的 API Keys 是否已配置
 */
function testStep2_CheckAPIKeys() {
  Logger.log("=".repeat(50));
  Logger.log("步驟 2：檢查 API Keys 配置");
  Logger.log("=".repeat(50));
  
  const requiredKeys = [
    "API_KEY_OPENAI",
    "API_KEY_ANTHROPIC",
    "API_KEY_GEMINI",
    "GOOGLE_CSE_API_KEY"  // 可選
  ];
  
  const properties = PropertiesService.getScriptProperties();
  let allConfigured = true;
  
  requiredKeys.forEach(keyName => {
    const key = properties.getProperty(keyName);
    if (key) {
      Logger.log(`✓ ${keyName}：已配置`);
    } else {
      Logger.log(`✗ ${keyName}：未配置`);
      if (keyName !== "GOOGLE_CSE_API_KEY") {
        allConfigured = false;
      }
    }
  });
  
  if (allConfigured) {
    Logger.log("\n✓ 所有必要的 API Keys 已配置");
  } else {
    Logger.log("\n✗ 部分 API Keys 未配置，請在 PropertiesService 中設置");
  }
  
  return allConfigured;
}

/**
 * 步驟 3：檢查 CSE CX IDs 配置
 * 
 * 檢查必要的 CSE CX IDs 是否已配置
 */
function testStep3_CheckCSECXIDs() {
  Logger.log("=".repeat(50));
  Logger.log("步驟 3：檢查 CSE CX IDs 配置");
  Logger.log("=".repeat(50));
  
  const requiredCXs = [
    "GOOGLE_CSE_CX_P5_OHLCV",
    "GOOGLE_CSE_CX_P5_SECTOR_ETF",
    "GOOGLE_CSE_CX_P5_DERIVATIVES",
    "GOOGLE_CSE_CX_P5_NEWS",
    "GOOGLE_CSE_CX_P5_WORLD",  // ⭐ 已改名（原 P5_MARKET）
    "GOOGLE_CSE_CX_INSTITUTIONAL",
    "GOOGLE_CSE_CX_P2_TAIWAN",  // ⭐ 已改名（原 TAIWAN_STOCK）
    "GOOGLE_CSE_CX_P2_JAPAN",   // ⭐ 已改名（原 JAPAN_STOCK）
    "GOOGLE_CSE_CX_SUPPLY_CHAIN",
    "GOOGLE_CSE_CX_EARNINGS",
    "GOOGLE_CSE_CX_HUMAN_SIGNAL",  // ⭐ 新增
    "GOOGLE_CSE_ALL"  // ⭐ 無限制 CSE
  ];
  
  const properties = PropertiesService.getScriptProperties();
  let allConfigured = true;
  
  requiredCXs.forEach(cxName => {
    const cxId = properties.getProperty(cxName);
    if (cxId) {
      Logger.log(`✓ ${cxName}：已配置`);
    } else {
      Logger.log(`✗ ${cxName}：未配置`);
      allConfigured = false;
    }
  });
  
  if (allConfigured) {
    Logger.log("\n✓ 所有 CSE CX IDs 已配置");
  } else {
    Logger.log("\n✗ 部分 CSE CX IDs 未配置，請在 PropertiesService 中設置");
  }
  
  return allConfigured;
}

// ==========================================
// 測試執行
// ==========================================

/**
 * 測試 1：M0 系統基礎測試
 * 
 * 測試 M0 Job Queue 的基本功能
 */
function test1_M0Basic() {
  Logger.log("=".repeat(50));
  Logger.log("測試 1：M0 系統基礎測試");
  Logger.log("=".repeat(50));
  
  try {
    // 使用測試輔助函數創建測試任務
    const jobId = createSimpleTestJob("P0", {
      test: true,
      message: "這是一個 M0 基礎測試任務",
      task_prompt: "請簡單介紹一下你自己，並確認系統運作正常。"
    });
    
    Logger.log(`\n已創建測試任務：${jobId}`);
    Logger.log("開始執行任務...");
    
    // 執行任務
    const result = executeTestJob(jobId);
    
    Logger.log("\n任務執行完成！");
    Logger.log("執行結果：", JSON.stringify(result, null, 2));
    
    // 檢查結果
    printTestResultSummary(jobId);
    
    Logger.log("\n✓ 測試 1 完成");
    return true;
  } catch (error) {
    Logger.log(`\n✗ 測試 1 失敗：${error.message}`);
    Logger.log("錯誤堆疊：", error.stack);
    return false;
  }
}

/**
 * 測試 2：自我質疑機制測試
 * 
 * 測試執行者提出問題 → 審查者使用無限制 CSE 回答
 */
function test2_SelfQuestioning() {
  Logger.log("=".repeat(50));
  Logger.log("測試 2：自我質疑機制測試");
  Logger.log("=".repeat(50));
  
  try {
    // 創建包含 FACT_CHECK 的測試任務
    const jobId = createFactCheckTestJob(
      "P0",
      "Apple Inc. (AAPL) 最新財報日期是什麼時候？"
    );
    
    Logger.log(`\n已創建 FACT_CHECK 測試任務：${jobId}`);
    Logger.log("開始執行任務（應自動觸發無限制 CSE 搜尋）...");
    
    // 執行任務
    const result = executeTestJob(jobId);
    
    Logger.log("\n任務執行完成！");
    
    // 檢查結果
    const checkResult = checkTestResult(jobId);
    
    Logger.log("\n檢查結果：");
    Logger.log(`  狀態：${checkResult.status}`);
    Logger.log(`  審計鏈記錄數：${checkResult.crosscheck_log_count}`);
    
    // 檢查是否有無限制 CSE 搜尋記錄
    const hasUnrestrictedCSE = checkResult.crosscheck_logs.some(
      log => log.step === "CSE_SEARCH_UNRESTRICTED"
    );
    
    if (hasUnrestrictedCSE) {
      Logger.log("  ✓ 檢測到無限制 CSE 搜尋記錄");
    } else {
      Logger.log("  ✗ 未檢測到無限制 CSE 搜尋記錄");
    }
    
    printTestResultSummary(jobId);
    
    Logger.log("\n✓ 測試 2 完成");
    return true;
  } catch (error) {
    Logger.log(`\n✗ 測試 2 失敗：${error.message}`);
    Logger.log("錯誤堆疊：", error.stack);
    return false;
  }
}

/**
 * 測試 3：P5 Daily 數據收集測試
 * 
 * 測試 P5 Daily 的 OHLCV 數據收集功能
 */
function test3_P5Daily() {
  Logger.log("=".repeat(50));
  Logger.log("測試 3：P5 Daily 數據收集測試");
  Logger.log("=".repeat(50));
  
  try {
    const testData = prepareP5DailyTestData(["AAPL", "MSFT"]);
    
    Logger.log("\n測試數據：", JSON.stringify(testData, null, 2));
    Logger.log("開始執行 P5 Daily...");
    
    const result = P5_Daily_Execute(testData);
    
    Logger.log("\nP5 Daily 執行完成！");
    Logger.log("執行結果：", JSON.stringify(result, null, 2));
    
    // 檢查表格數據
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ohlcvSheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    const indicatorsSheet = ss.getSheetByName("MARKET_INDICATORS_DAILY");
    
    if (ohlcvSheet && ohlcvSheet.getLastRow() > 1) {
      Logger.log(`\n✓ MARKET_OHLCV_DAILY 表格有 ${ohlcvSheet.getLastRow() - 1} 筆數據`);
    } else {
      Logger.log("\n✗ MARKET_OHLCV_DAILY 表格無數據");
    }
    
    if (indicatorsSheet && indicatorsSheet.getLastRow() > 1) {
      Logger.log(`✓ MARKET_INDICATORS_DAILY 表格有 ${indicatorsSheet.getLastRow() - 1} 筆數據`);
    } else {
      Logger.log("✗ MARKET_INDICATORS_DAILY 表格無數據");
    }
    
    Logger.log("\n✓ 測試 3 完成");
    return true;
  } catch (error) {
    Logger.log(`\n✗ 測試 3 失敗：${error.message}`);
    Logger.log("錯誤堆疊：", error.stack);
    return false;
  }
}

// ==========================================
// 完整測試流程
// ==========================================

/**
 * 執行完整測試流程
 * 
 * 按照順序執行所有測試步驟
 */
function runFullTestSuite() {
  Logger.log("=".repeat(70));
  Logger.log("🧪 Nuclear Project SSOT V7.1 完整測試流程");
  Logger.log("=".repeat(70));
  
  const results = {
    step1_init: false,
    step2_apiKeys: false,
    step3_cseCXs: false,
    test1_m0: false,
    test2_selfQuestioning: false,
    test3_p5Daily: false
  };
  
  // 步驟 1：初始化表格
  Logger.log("\n\n【準備階段】");
  results.step1_init = testStep1_InitializeSheets();
  
  if (!results.step1_init) {
    Logger.log("\n✗ 初始化失敗，停止測試");
    return results;
  }
  
  // 步驟 2：檢查 API Keys
  results.step2_apiKeys = testStep2_CheckAPIKeys();
  
  // 步驟 3：檢查 CSE CX IDs
  results.step3_cseCXs = testStep3_CheckCSECXIDs();
  
  if (!results.step2_apiKeys || !results.step3_cseCXs) {
    Logger.log("\n⚠️ 部分配置未完成，但繼續執行測試...");
  }
  
  // 測試階段
  Logger.log("\n\n【測試階段】");
  
  // 測試 1：M0 基礎測試
  Logger.log("\n");
  results.test1_m0 = test1_M0Basic();
  
  // 等待一下，避免 API 限流
  Utilities.sleep(2000);
  
  // 測試 2：自我質疑機制
  Logger.log("\n");
  results.test2_selfQuestioning = test2_SelfQuestioning();
  
  // 等待一下
  Utilities.sleep(2000);
  
  // 測試 3：P5 Daily
  Logger.log("\n");
  results.test3_p5Daily = test3_P5Daily();
  
  // 測試總結
  Logger.log("\n\n" + "=".repeat(70));
  Logger.log("📊 測試總結");
  Logger.log("=".repeat(70));
  
  Logger.log("\n準備階段：");
  Logger.log(`  初始化表格：${results.step1_init ? "✓" : "✗"}`);
  Logger.log(`  API Keys 配置：${results.step2_apiKeys ? "✓" : "✗"}`);
  Logger.log(`  CSE CX IDs 配置：${results.step3_cseCXs ? "✓" : "✗"}`);
  
  Logger.log("\n測試階段：");
  Logger.log(`  測試 1 - M0 基礎：${results.test1_m0 ? "✓" : "✗"}`);
  Logger.log(`  測試 2 - 自我質疑機制：${results.test2_selfQuestioning ? "✓" : "✗"}`);
  Logger.log(`  測試 3 - P5 Daily：${results.test3_p5Daily ? "✓" : "✗"}`);
  
  const passedTests = Object.values(results).filter(r => r === true).length;
  const totalTests = Object.keys(results).length;
  
  Logger.log(`\n總計：${passedTests}/${totalTests} 項通過`);
  
  if (passedTests === totalTests) {
    Logger.log("\n🎉 所有測試通過！系統運作正常。");
  } else {
    Logger.log("\n⚠️ 部分測試未通過，請檢查執行記錄。");
  }
  
  Logger.log("=".repeat(70));
  
  return results;
}

/**
 * 快速測試（僅執行基礎功能測試）
 */
function runQuickTest() {
  Logger.log("=".repeat(70));
  Logger.log("🚀 Nuclear Project SSOT V7.1 快速測試");
  Logger.log("=".repeat(70));
  
  // 只執行測試 1
  const result = test1_M0Basic();
  
  if (result) {
    Logger.log("\n✓ 快速測試通過！");
  } else {
    Logger.log("\n✗ 快速測試失敗，請檢查執行記錄。");
  }
  
  return result;
}

/**
 * 測試 stooq.com 訪問（排查數據收集問題）
 * 
 * 測試 stooq.com 是否可以正常訪問，用於排查 OHLCV 數據收集問題
 */
function testStooqAccess() {
  Logger.log("=".repeat(50));
  Logger.log("測試：stooq.com 訪問測試");
  Logger.log("=".repeat(50));
  
  const testTickers = ["AAPL.US", "MSFT.US", "2330.TW"];
  
  for (const ticker of testTickers) {
    try {
      const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(ticker)}&i=d`;
      
      Logger.log(`\n測試 ticker：${ticker}`);
      Logger.log(`請求 URL：${url}`);
      
      const response = UrlFetchApp.fetch(url, {
        method: "GET",
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/csv,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://stooq.com/"
        }
      });
      
      const statusCode = response.getResponseCode();
      const content = response.getContentText();
      
      Logger.log(`HTTP 狀態碼：${statusCode}`);
      
      if (statusCode === 200) {
        // 檢查是否為 CSV 格式
        if (content.trim().startsWith('<') || content.includes('<!DOCTYPE')) {
          Logger.log(`✗ ${ticker}：返回 HTML 而非 CSV（可能是 ticker 格式錯誤）`);
          Logger.log(`內容預覽：${content.substring(0, 200)}`);
        } else {
          const lines = content.trim().split('\n');
          Logger.log(`✓ ${ticker}：訪問成功，CSV 行數：${lines.length}`);
          if (lines.length > 0) {
            Logger.log(`第一行（標題）：${lines[0]}`);
            if (lines.length > 1) {
              Logger.log(`最後一行（數據）：${lines[lines.length - 1]}`);
            }
          }
        }
      } else {
        Logger.log(`✗ ${ticker}：HTTP ${statusCode} 錯誤`);
        Logger.log(`錯誤內容：${content.substring(0, 200)}`);
      }
      
      // 每個請求之間稍作延遲
      if (testTickers.indexOf(ticker) < testTickers.length - 1) {
        Utilities.sleep(1000);
      }
      
    } catch (error) {
      Logger.log(`✗ ${ticker}：訪問錯誤：${error.message}`);
      Logger.log(`錯誤類型：${error.name}`);
      Logger.log(`錯誤堆疊：${error.stack}`);
    }
  }
  
  Logger.log("\n" + "=".repeat(50));
  Logger.log("測試完成");
  Logger.log("=".repeat(50));
}

/**
 * 測試 CSE Fallback 機制
 * 
 * 測試當 stooq.com 直接 URL 失敗時，CSE fallback 是否正常工作
 */
function testCSEFallback() {
  Logger.log("=".repeat(50));
  Logger.log("測試：CSE Fallback 機制");
  Logger.log("=".repeat(50));
  
  try {
    // 測試 2330.tw（已知在 stooq.com 中可能沒有數據）
    const ticker = "2330";
    Logger.log(`\n測試 ticker：${ticker}`);
    Logger.log("預期：直接 URL 可能失敗，會觸發 CSE fallback");
    
    // 測試 formatTickerForStooq
    const stooqTicker = formatTickerForStooq(ticker);
    Logger.log(`格式化後的 ticker：${stooqTicker}`);
    
    // 測試 collectOHLCVData（會自動觸發 CSE fallback）
    Logger.log("\n開始收集 OHLCV 數據...");
    const result = collectOHLCVData([ticker]);
    
    Logger.log("\n收集結果：");
    Logger.log(JSON.stringify(result, null, 2));
    
    if (result[ticker]) {
      if (result[ticker].error) {
        Logger.log(`\n✗ ${ticker}：收集失敗：${result[ticker].error}`);
        Logger.log("狀態：", result[ticker].status);
      } else {
        Logger.log(`\n✓ ${ticker}：收集成功`);
        Logger.log(`日期：${result[ticker].date}`);
        Logger.log(`收盤價：${result[ticker].close}`);
        Logger.log(`數據來源：${result[ticker].source || "stooq.com"}`);
        
        if (result[ticker].source && result[ticker].source.includes("CSE")) {
          Logger.log("✓ 確認使用了 CSE fallback 機制");
        }
      }
    } else {
      Logger.log(`\n✗ ${ticker}：未返回結果`);
    }
    
    Logger.log("\n" + "=".repeat(50));
    Logger.log("測試完成");
    Logger.log("=".repeat(50));
    
    return result;
    
  } catch (error) {
    Logger.log(`\n✗ 測試失敗：${error.message}`);
    Logger.log("錯誤堆疊：", error.stack);
    return null;
  }
}

/**
 * 測試 CSE Fallback 直接調用
 * 
 * 直接測試 collectOHLCVDataViaCSE 函數
 */
function testCSEFallbackDirect() {
  Logger.log("=".repeat(50));
  Logger.log("測試：CSE Fallback 直接調用");
  Logger.log("=".repeat(50));
  
  try {
    const ticker = "2330";
    const stooqTicker = formatTickerForStooq(ticker);
    
    Logger.log(`\n測試 ticker：${ticker}`);
    Logger.log(`Stooq 格式：${stooqTicker}`);
    Logger.log("\n直接調用 collectOHLCVDataViaCSE...");
    
    const result = collectOHLCVDataViaCSE(ticker, stooqTicker);
    
    if (result) {
      Logger.log("\n✓ CSE Fallback 成功");
      Logger.log("結果：", JSON.stringify(result, null, 2));
    } else {
      Logger.log("\n✗ CSE Fallback 失敗（返回 null）");
      Logger.log("可能原因：");
      Logger.log("  1. CSE 搜尋未找到相關結果");
      Logger.log("  2. 搜尋結果中沒有可用的 CSV 連結");
      Logger.log("  3. CSE API Key 或 CX ID 未配置");
      Logger.log("  4. CSE 配額已用完");
    }
    
    Logger.log("\n" + "=".repeat(50));
    Logger.log("測試完成");
    Logger.log("=".repeat(50));
    
    return result;
    
  } catch (error) {
    Logger.log(`\n✗ 測試失敗：${error.message}`);
    Logger.log("錯誤堆疊：", error.stack);
    return null;
  }
}
