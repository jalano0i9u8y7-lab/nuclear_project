/**
 * 🧪 FPE_B 數據管線測試腳本
 * 
 * 測試 FPE_B（分析師共識 Forward P/E）數據收集功能
 * 
 * @version V8.0
 * @date 2026-01-16
 */

/**
 * 測試 FPE_B 數據收集（單個公司）
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場（US/TW/JP）
 */
function testFPE_B_Single(ticker, market) {
  Logger.log("=".repeat(80));
  Logger.log(`🧪 測試 FPE_B 數據收集：${ticker} (${market})`);
  Logger.log("=".repeat(80));
  
  try {
    const startTime = Date.now();
    
    // 調用 FPE_B 收集函數
    const fpeB = collectFPE_B_ForCompany(ticker, market);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (fpeB !== null) {
      Logger.log(`✅ 成功：FPE_B = ${fpeB.toFixed(2)}`);
      Logger.log(`⏱️  耗時：${elapsed} 秒`);
      return {
        success: true,
        ticker: ticker,
        market: market,
        fpe_b: fpeB,
        elapsed: elapsed
      };
    } else {
      Logger.log(`❌ 失敗：無法獲取 FPE_B（可能沒有分析師覆蓋）`);
      Logger.log(`⏱️  耗時：${elapsed} 秒`);
      return {
        success: false,
        ticker: ticker,
        market: market,
        fpe_b: null,
        elapsed: elapsed,
        reason: "無法獲取 FPE_B（可能沒有分析師覆蓋）"
      };
    }
  } catch (error) {
    Logger.log(`❌ 錯誤：${error.message}`);
    Logger.log(`堆疊：${error.stack}`);
    return {
      success: false,
      ticker: ticker,
      market: market,
      fpe_b: null,
      error: error.message
    };
  }
}

/**
 * 測試 FPE_B 數據收集（多個公司）
 * @param {Array} testCases - 測試案例陣列 [{ticker, market}, ...]
 */
function testFPE_B_Multiple(testCases) {
  Logger.log("=".repeat(80));
  Logger.log(`🧪 測試 FPE_B 數據收集（多個公司）`);
  Logger.log(`測試案例數：${testCases.length}`);
  Logger.log("=".repeat(80));
  
  const results = [];
  const startTime = Date.now();
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    Logger.log(`\n[${i + 1}/${testCases.length}] 測試：${testCase.ticker} (${testCase.market})`);
    
    const result = testFPE_B_Single(testCase.ticker, testCase.market);
    results.push(result);
    
    // 避免請求過於頻繁（Yahoo Finance 可能有限流）
    if (i < testCases.length - 1) {
      Utilities.sleep(2000); // 等待 2 秒
    }
  }
  
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // 統計結果
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  Logger.log("\n" + "=".repeat(80));
  Logger.log("📊 測試摘要");
  Logger.log("=".repeat(80));
  Logger.log(`總計：${testCases.length} 個測試案例`);
  Logger.log(`✅ 成功：${successCount} 個`);
  Logger.log(`❌ 失敗：${failCount} 個`);
  Logger.log(`⏱️  總耗時：${totalElapsed} 秒`);
  Logger.log("=".repeat(80));
  
  Logger.log("\n📋 詳細結果：");
  for (const result of results) {
    if (result.success) {
      Logger.log(`✅ ${result.ticker} (${result.market}): FPE_B = ${result.fpe_b.toFixed(2)}`);
    } else {
      Logger.log(`❌ ${result.ticker} (${result.market}): ${result.reason || result.error || "失敗"}`);
    }
  }
  
  return {
    total: testCases.length,
    success: successCount,
    failed: failCount,
    results: results,
    totalElapsed: totalElapsed
  };
}

/**
 * 快速測試（預設測試案例）
 */
function testFPE_B_Quick() {
  const testCases = [
    { ticker: "AAPL", market: "US" },   // 蘋果（美股）
    { ticker: "2330", market: "TW" },   // 台積電（台股）
    { ticker: "7203", market: "JP" }     // 豐田（日股）
  ];
  
  return testFPE_B_Multiple(testCases);
}

/**
 * 完整測試（更多測試案例）
 */
function testFPE_B_Full() {
  const testCases = [
    // 美股
    { ticker: "AAPL", market: "US" },   // 蘋果
    { ticker: "MSFT", market: "US" },   // 微軟
    { ticker: "NVDA", market: "US" },   // 輝達
    
    // 台股
    { ticker: "2330", market: "TW" },   // 台積電
    { ticker: "2317", market: "TW" },   // 鴻海
    { ticker: "2454", market: "TW" },   // 聯發科
    
    // 日股
    { ticker: "7203", market: "JP" },   // 豐田
    { ticker: "6758", market: "JP" },   // 索尼
    { ticker: "8035", market: "JP" }    // 東京電子
  ];
  
  return testFPE_B_Multiple(testCases);
}

/**
 * 測試 FPE_B 整合到 P2 數據收集流程
 */
function testFPE_B_Integration() {
  Logger.log("=".repeat(80));
  Logger.log(`🧪 測試 FPE_B 整合到 P2 數據收集流程`);
  Logger.log("=".repeat(80));
  
  // 模擬 master candidates
  const masterCandidates = [
    {
      company_code: "AAPL",
      company_name: "Apple Inc.",
      market: "US"
    },
    {
      company_code: "2330",
      company_name: "台積電",
      market: "TW"
    }
  ];
  
  Logger.log(`測試公司數：${masterCandidates.length}`);
  
  try {
    // 調用財務數據收集函數
    const financialData = collectFinancialDataFromExternalSources(masterCandidates, "MONTHLY");
    
    Logger.log("\n📊 數據收集結果：");
    for (const [ticker, data] of Object.entries(financialData)) {
      Logger.log(`\n${ticker}:`);
      Logger.log(`  - data_source: ${data.data_source || "N/A"}`);
      Logger.log(`  - search_results: ${data.search_results ? data.search_results.length : 0} 筆`);
      Logger.log(`  - fpe_b: ${data.fpe_b !== undefined ? (data.fpe_b !== null ? data.fpe_b.toFixed(2) : "null") : "未設置"}`);
      
      if (data.fpe_b !== undefined && data.fpe_b !== null) {
        Logger.log(`  ✅ FPE_B 已成功收集`);
      } else if (data.fpe_b === null) {
        Logger.log(`  ⚠️  FPE_B 為 null（可能沒有分析師覆蓋）`);
      } else {
        Logger.log(`  ❌ FPE_B 未設置`);
      }
    }
    
    Logger.log("\n" + "=".repeat(80));
    Logger.log("✅ 整合測試完成");
    Logger.log("=".repeat(80));
    
    return financialData;
  } catch (error) {
    Logger.log(`❌ 整合測試失敗：${error.message}`);
    Logger.log(`堆疊：${error.stack}`);
    throw error;
  }
}

/**
 * 測試 Yahoo Finance 解析邏輯（直接測試解析函數）
 */
function testYahooFinanceParsing() {
  Logger.log("=".repeat(80));
  Logger.log(`🧪 測試 Yahoo Finance 解析邏輯`);
  Logger.log("=".repeat(80));
  
  const testTickers = ["AAPL", "2330.TW", "7203.T"];
  
  for (const ticker of testTickers) {
    Logger.log(`\n測試：${ticker}`);
    
    try {
      // 測試股價獲取
      Logger.log(`  1. 測試股價獲取...`);
      const price = getCurrentPriceFromYahoo(ticker);
      if (price) {
        Logger.log(`     ✅ 股價：${price.toFixed(2)}`);
      } else {
        Logger.log(`     ❌ 無法獲取股價`);
      }
      
      // 測試 Analysis 頁面抓取和解析
      Logger.log(`  2. 測試 Analysis 頁面解析...`);
      const url = `https://finance.yahoo.com/quote/${ticker}/analysis`;
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.getResponseCode() === 200) {
        const html = response.getContentText();
        const eps = parseYahooAnalysisPage(html);
        
        if (eps) {
          Logger.log(`     ✅ EPS：${eps.toFixed(2)}`);
          
          if (price) {
            const fpeB = price / eps;
            Logger.log(`     ✅ 計算 FPE_B：${fpeB.toFixed(2)}`);
          }
        } else {
          Logger.log(`     ❌ 無法解析 EPS`);
        }
      } else {
        Logger.log(`     ❌ HTTP ${response.getResponseCode()}`);
      }
      
      // 避免請求過於頻繁
      Utilities.sleep(2000);
      
    } catch (error) {
      Logger.log(`     ❌ 錯誤：${error.message}`);
    }
  }
  
  Logger.log("\n" + "=".repeat(80));
  Logger.log("✅ 解析測試完成");
  Logger.log("=".repeat(80));
}
