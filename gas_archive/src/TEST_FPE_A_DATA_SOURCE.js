/**
 * 🧪 FPE_A 數據來源驗證腳本
 * 
 * 驗證財報狗和 buffet code 是否提供官方財報公布的 EPS
 * 確認這些是官方口徑（已公布），而非分析師預估（FPE_B）
 * 
 * @version V8.0
 * @date 2026-01-16
 */

/**
 * 測試財報狗（美股/台股）是否提供官方財報公布的 Forward P/E（FPE_A）
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場（US/TW）
 */
function testStatementDog_EPS(ticker, market) {
  Logger.log("=".repeat(80));
  Logger.log(`🧪 測試財報狗官方 Forward P/E（FPE_A）：${ticker} (${market})`);
  Logger.log("=".repeat(80));
  
  try {
    // 使用 CSE 搜尋財報狗
    const searchQuery = `${ticker} 財務報表 Forward P/E 本益比 預估本益比`;
    const cseType = "P2_US_TAIWAN";  // 財報狗 CSE
    
    const jobId = `TEST_FPE_A_${ticker}_${Date.now()}`;
    const m0Payload = {
      search_query: searchQuery,
      cse_type: cseType,
      max_results: 10,
      ticker: ticker,
      market: market
    };
    
    Logger.log(`開始 CSE 搜尋：ticker=${ticker}, query="${searchQuery}"`);
    
    const cseResult = executeCSESearch(jobId, "CSE_SEARCH", m0Payload);
    
    if (cseResult && cseResult.output && cseResult.output.search_results) {
      const results = cseResult.output.search_results;
      Logger.log(`\n找到 ${results.length} 筆搜尋結果`);
      
      // 分析搜尋結果
      Logger.log("\n📊 搜尋結果分析：");
      for (let i = 0; i < Math.min(results.length, 5); i++) {
        const result = results[i];
        Logger.log(`\n[${i + 1}] ${result.title || "無標題"}`);
        Logger.log(`    URL: ${result.link || "無 URL"}`);
        Logger.log(`    Snippet: ${(result.snippet || "").substring(0, 200)}...`);
        
        // 檢查是否包含 Forward P/E 相關資訊
        const content = `${result.title || ""} ${result.snippet || ""}`.toLowerCase();
        if (content.includes("forward") || content.includes("p/e") || content.includes("本益比") || content.includes("per")) {
          Logger.log(`    ✅ 包含 Forward P/E/本益比相關資訊`);
        }
      }
      
      // 檢查是否有官方財報公布的 Forward P/E（FPE_A）
      Logger.log("\n🔍 檢查是否有官方財報公布的 Forward P/E（FPE_A）：");
      let foundOfficialForwardPE = false;
      let foundAnalystForwardPE = false;
      let foundAnalystEstimate = false;
      
      for (const result of results) {
        const content = `${result.title || ""} ${result.snippet || ""}`.toLowerCase();
        
        // 檢查官方財報公布的 Forward P/E（FPE_A）
        // 關鍵字：官方、財報、已公布、實際 + Forward P/E、本益比、P/E
        if (content.includes("官方") || content.includes("財報") || content.includes("已公布") || content.includes("實際")) {
          if (content.includes("forward") || content.includes("p/e") || content.includes("本益比") || content.includes("per")) {
            // 確認不是分析師預估
            if (!content.includes("分析師") && !content.includes("預估") && !content.includes("預測")) {
              foundOfficialForwardPE = true;
              Logger.log(`  ✅ 找到官方財報公布的 Forward P/E（FPE_A）`);
              Logger.log(`     來源：${result.link || "無 URL"}`);
            }
          }
        }
        
        // 檢查分析師預估的 Forward P/E（這是 FPE_B，不是 FPE_A）
        if (content.includes("分析師") || content.includes("預估") || content.includes("預測") || content.includes("consensus")) {
          if (content.includes("forward") || content.includes("p/e") || content.includes("本益比") || content.includes("per")) {
            foundAnalystForwardPE = true;
            Logger.log(`  ⚠️  找到分析師預估的 Forward P/E（這是 FPE_B，不是 FPE_A）`);
          }
          foundAnalystEstimate = true;
        }
      }
      
      Logger.log("\n📋 檢查結果摘要：");
      Logger.log(`  - 官方財報公布的 Forward P/E（FPE_A）：${foundOfficialForwardPE ? "✅ 有" : "❌ 無"}`);
      Logger.log(`  - 分析師預估的 Forward P/E（FPE_B）：${foundAnalystForwardPE ? "⚠️  有" : "✅ 無"}`);
      Logger.log(`  - 分析師預估相關：${foundAnalystEstimate ? "⚠️  有" : "✅ 無"}`);
      
      return {
        success: true,
        ticker: ticker,
        market: market,
        results_count: results.length,
        found_official_eps: foundOfficialEPS,
        found_forward_pe: foundForwardPE,
        found_analyst_estimate: foundAnalystEstimate,
        search_results: results
      };
    } else {
      Logger.log(`❌ CSE 搜尋未返回結果`);
      return {
        success: false,
        ticker: ticker,
        market: market,
        reason: "CSE 搜尋未返回結果"
      };
    }
  } catch (error) {
    Logger.log(`❌ 測試失敗：${error.message}`);
    Logger.log(`堆疊：${error.stack}`);
    return {
      success: false,
      ticker: ticker,
      market: market,
      error: error.message
    };
  }
}

/**
 * 測試 buffet code（日股）是否提供官方財報公布的 Forward P/E（FPE_A）
 * @param {string} ticker - 股票代碼
 */
function testBuffetCode_EPS(ticker) {
  Logger.log("=".repeat(80));
  Logger.log(`🧪 測試 buffet code 官方 Forward P/E（FPE_A）：${ticker} (JP)`);
  Logger.log("=".repeat(80));
  
  try {
    // 使用 CSE 搜尋 buffet code
    const searchQuery = `${ticker} 決算 Forward PER 予想PER 株価収益率`;
    const cseType = "P2_JAPAN";  // buffet code CSE
    
    const jobId = `TEST_FPE_A_${ticker}_${Date.now()}`;
    const m0Payload = {
      search_query: searchQuery,
      cse_type: cseType,
      max_results: 10,
      ticker: ticker,
      market: "JP"
    };
    
    Logger.log(`開始 CSE 搜尋：ticker=${ticker}, query="${searchQuery}"`);
    
    const cseResult = executeCSESearch(jobId, "CSE_SEARCH", m0Payload);
    
    if (cseResult && cseResult.output && cseResult.output.search_results) {
      const results = cseResult.output.search_results;
      Logger.log(`\n找到 ${results.length} 筆搜尋結果`);
      
      // 分析搜尋結果
      Logger.log("\n📊 搜尋結果分析：");
      for (let i = 0; i < Math.min(results.length, 5); i++) {
        const result = results[i];
        Logger.log(`\n[${i + 1}] ${result.title || "無標題"}`);
        Logger.log(`    URL: ${result.link || "無 URL"}`);
        Logger.log(`    Snippet: ${(result.snippet || "").substring(0, 200)}...`);
        
        // 檢查是否包含 Forward P/E 相關資訊
        const content = `${result.title || ""} ${result.snippet || ""}`.toLowerCase();
        if (content.includes("forward") || content.includes("per") || content.includes("株価収益率") || content.includes("予想per")) {
          Logger.log(`    ✅ 包含 Forward P/E/PER 相關資訊`);
        }
      }
      
      // 檢查是否有官方財報公布的 Forward P/E（FPE_A）
      Logger.log("\n🔍 檢查是否有官方財報公布的 Forward P/E（FPE_A）：");
      let foundOfficialForwardPE = false;
      let foundAnalystForwardPE = false;
      let foundAnalystEstimate = false;
      
      for (const result of results) {
        const content = `${result.title || ""} ${result.snippet || ""}`.toLowerCase();
        
        // 檢查官方財報公布的 Forward P/E（FPE_A）（日文關鍵字）
        // 關鍵字：公式、決算、実績、実際 + PER、株価収益率
        if (content.includes("公式") || content.includes("決算") || content.includes("実績") || content.includes("実際")) {
          if (content.includes("per") || content.includes("株価収益率") || content.includes("forward")) {
            // 確認不是分析師預估
            if (!content.includes("アナリスト") && !content.includes("予想") && !content.includes("予測")) {
              foundOfficialForwardPE = true;
              Logger.log(`  ✅ 找到官方財報公布的 Forward P/E（FPE_A）`);
              Logger.log(`     來源：${result.link || "無 URL"}`);
            }
          }
        }
        
        // 檢查分析師預估的 Forward P/E（這是 FPE_B，不是 FPE_A）（日文關鍵字）
        if (content.includes("アナリスト") || content.includes("予想") || content.includes("予測") || content.includes("consensus")) {
          if (content.includes("per") || content.includes("株価収益率") || content.includes("forward")) {
            foundAnalystForwardPE = true;
            Logger.log(`  ⚠️  找到分析師預估的 Forward P/E（這是 FPE_B，不是 FPE_A）`);
          }
          foundAnalystEstimate = true;
        }
      }
      
      Logger.log("\n📋 檢查結果摘要：");
      Logger.log(`  - 官方財報公布的 Forward P/E（FPE_A）：${foundOfficialForwardPE ? "✅ 有" : "❌ 無"}`);
      Logger.log(`  - 分析師預估的 Forward P/E（FPE_B）：${foundAnalystForwardPE ? "⚠️  有" : "✅ 無"}`);
      Logger.log(`  - 分析師預估相關：${foundAnalystEstimate ? "⚠️  有" : "✅ 無"}`);
      
      return {
        success: true,
        ticker: ticker,
        market: "JP",
        results_count: results.length,
        found_official_eps: foundOfficialEPS,
        found_forward_pe: foundForwardPE,
        found_analyst_estimate: foundAnalystEstimate,
        search_results: results
      };
    } else {
      Logger.log(`❌ CSE 搜尋未返回結果`);
      return {
        success: false,
        ticker: ticker,
        market: "JP",
        reason: "CSE 搜尋未返回結果"
      };
    }
  } catch (error) {
    Logger.log(`❌ 測試失敗：${error.message}`);
    Logger.log(`堆疊：${error.stack}`);
    return {
      success: false,
      ticker: ticker,
      market: "JP",
      error: error.message
    };
  }
}

/**
 * 完整測試（測試多個公司）
 */
function testFPE_A_DataSource_Full() {
  Logger.log("=".repeat(80));
  Logger.log(`🧪 FPE_A 數據來源完整測試`);
  Logger.log("=".repeat(80));
  
  const testResults = {
    statementdog: [],
    buffetcode: []
  };
  
  // 測試財報狗（美股/台股）
  Logger.log("\n" + "=".repeat(80));
  Logger.log("📊 測試財報狗（美股/台股）");
  Logger.log("=".repeat(80));
  
  const statementdogTests = [
    { ticker: "AAPL", market: "US" },
    { ticker: "2330", market: "TW" }
  ];
  
  for (const test of statementdogTests) {
    Logger.log(`\n測試：${test.ticker} (${test.market})`);
    const result = testStatementDog_EPS(test.ticker, test.market);
    testResults.statementdog.push(result);
    
    // 避免請求過於頻繁
    Utilities.sleep(2000);
  }
  
  // 測試 buffet code（日股）
  Logger.log("\n" + "=".repeat(80));
  Logger.log("📊 測試 buffet code（日股）");
  Logger.log("=".repeat(80));
  
  const buffetcodeTests = [
    { ticker: "7203" },  // 豐田
    { ticker: "6758" }    // 索尼
  ];
  
  for (const test of buffetcodeTests) {
    Logger.log(`\n測試：${test.ticker} (JP)`);
    const result = testBuffetCode_EPS(test.ticker);
    testResults.buffetcode.push(result);
    
    // 避免請求過於頻繁
    Utilities.sleep(2000);
  }
  
  // 統計結果
  Logger.log("\n" + "=".repeat(80));
  Logger.log("📊 測試結果摘要");
  Logger.log("=".repeat(80));
  
  Logger.log("\n財報狗（美股/台股）：");
  const statementdogOfficialFPE = testResults.statementdog.filter(r => r.found_official_forward_pe).length;
  Logger.log(`  - 找到官方 Forward P/E（FPE_A）：${statementdogOfficialFPE}/${testResults.statementdog.length}`);
  
  Logger.log("\nbuffet code（日股）：");
  const buffetcodeOfficialFPE = testResults.buffetcode.filter(r => r.found_official_forward_pe).length;
  Logger.log(`  - 找到官方 Forward P/E（FPE_A）：${buffetcodeOfficialFPE}/${testResults.buffetcode.length}`);
  
  Logger.log("\n" + "=".repeat(80));
  Logger.log("✅ 測試完成");
  Logger.log("=".repeat(80));
  
  return testResults;
}
