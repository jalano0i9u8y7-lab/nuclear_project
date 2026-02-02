/**
 * 🧪 測試模式按鈕函數（V8.0 測試模式）
 * 
 * 所有 Phase 的獨立測試按鈕
 * 每個按鈕都會：
 * 1. 檢查測試模式是否啟用
 * 2. 檢查前置 Phase 是否已完成
 * 3. 執行對應的 Phase
 * 4. 顯示檢查欄位提示
 * 
 * @version V8.0 測試模式
 * @date 2026-01-19
 */

// ==========================================
// 測試模式檢查
// ==========================================

/**
 * 確保測試模式已啟用
 */
function ensureTestMode() {
  if (typeof SYSTEM_TEST_MODE === 'undefined' || !SYSTEM_TEST_MODE) {
    throw new Error("⚠️ 測試模式未啟用！請在 src/02_M0_CONFIG.js 中設置 SYSTEM_TEST_MODE = true");
  }
  if (typeof GLOBAL_USE_BATCH_API === 'undefined' || GLOBAL_USE_BATCH_API) {
    throw new Error("⚠️ Batch API 未禁用！請在 src/02_M0_CONFIG.js 中設置 GLOBAL_USE_BATCH_API = false");
  }
  Logger.log("✅ 測試模式已確認啟用");
}

// ==========================================
// P0 測試按鈕
// ==========================================

/**
 * 🧪 測試 P0：產業工程學分析
 */
function TEST_P0_Execute() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試 P0");
    
    // 執行 P0
    const result = P0_Execute({ test_mode: true });
    
    // 顯示檢查提示
    const checkPrompt = generateTestCheckPrompt("P0", result);
    Logger.log(checkPrompt);
    SpreadsheetApp.getUi().alert("P0 測試完成", checkPrompt, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return result;
  } catch (error) {
    Logger.log(`❌ P0 測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("P0 測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// ==========================================
// P0.5 測試按鈕
// ==========================================

/**
 * 🧪 測試 P0.5：產業鏈地圖分析
 */
function TEST_P0_5_Execute() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試 P0.5");
    
    // 檢查前置 Phase
    const p0Snapshot = getLatestP0Snapshot();
    if (!p0Snapshot) {
      throw new Error("⚠️ 請先執行 P0 測試");
    }
    
    // 執行 P0.5
    const result = P0_5_Execute({ test_mode: true });
    
    // 顯示檢查提示
    const checkPrompt = generateTestCheckPrompt("P0.5", result);
    Logger.log(checkPrompt);
    SpreadsheetApp.getUi().alert("P0.5 測試完成", checkPrompt, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return result;
  } catch (error) {
    Logger.log(`❌ P0.5 測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("P0.5 測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// ==========================================
// P0.7 測試按鈕
// ==========================================

/**
 * 🧪 測試 P0.7：系統動力學分析
 */
function TEST_P0_7_Execute() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試 P0.7");
    
    // 檢查前置 Phase
    const p0Snapshot = getLatestP0Snapshot();
    if (!p0Snapshot) {
      throw new Error("⚠️ 請先執行 P0 測試");
    }
    
    // 執行 P0.7
    const result = P0_7_Execute({ 
      trigger: "TEST",  // ⭐ V8.17.1 修正：添加 trigger 參數
      test_mode: true,
      context: { test_mode: true }  // ⭐ V8.17.1 新增：確保 context 包含 test_mode
    });
    
    // 顯示檢查提示
    const checkPrompt = generateTestCheckPrompt("P0.7", result);
    Logger.log(checkPrompt);
    SpreadsheetApp.getUi().alert("P0.7 測試完成", checkPrompt, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return result;
  } catch (error) {
    Logger.log(`❌ P0.7 測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("P0.7 測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// ==========================================
// P1 測試按鈕（分開 Step1 和 Step2）
// ==========================================

/**
 * 🧪 測試 P1 Step 1：公司池生成（只執行 Step 1）
 */
function TEST_P1_Step1_Execute() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試 P1 Step 1（公司池生成）");
    
    // 檢查前置 Phase
    const p0Snapshot = getLatestP0Snapshot();
    const p0_5Snapshot = getLatestP0_5Snapshot();
    const p0_7Snapshot = getLatestP0_7Snapshot();
    if (!p0Snapshot || !p0_5Snapshot || !p0_7Snapshot) {
      throw new Error("⚠️ 請先執行 P0、P0.5 和 P0.7 測試");
    }
    
    // ⭐ V8.17.4 新增：只執行 Step 1（通過設置 step 參數）
    const result = P1_Execute({ 
      trigger: "TEST",
      step: 1,  // 只執行 Step 1
      context: { test_mode: true }
    });
    
    // 顯示檢查提示
    const checkPrompt = generateTestCheckPrompt("P1 Step1", result);
    Logger.log(checkPrompt);
    SpreadsheetApp.getUi().alert("P1 Step 1 測試完成", checkPrompt, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return result;
  } catch (error) {
    Logger.log(`❌ P1 Step 1 測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("P1 Step 1 測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

/**
 * 🧪 測試 P1 Step 2：結構分級（只執行 Step 2，需要先有 Step 1 結果）
 */
function TEST_P1_Step2_Execute() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試 P1 Step 2（結構分級）");
    
    // 檢查前置 Phase
    const p0Snapshot = getLatestP0Snapshot();
    const p0_5Snapshot = getLatestP0_5Snapshot();
    const p0_7Snapshot = getLatestP0_7Snapshot();
    if (!p0Snapshot || !p0_5Snapshot || !p0_7Snapshot) {
      throw new Error("⚠️ 請先執行 P0、P0.5 和 P0.7 測試");
    }
    
    // 檢查是否有 P1 Step 1 的結果
    const p1Snapshot = getLatestP1Snapshot();
    if (!p1Snapshot || !p1Snapshot.p1_output_json) {
      throw new Error("⚠️ 請先執行 P1 Step 1，生成公司池");
    }
    
    // 從快照中提取 Step 1 結果
    const p1Output = p1Snapshot.p1_output_json;
    if (!p1Output.company_pool || !Array.isArray(p1Output.company_pool)) {
      throw new Error("⚠️ P1 Step 1 結果格式不正確，缺少 company_pool");
    }
    
    // 構建 step1Result
    const step1Result = {
      status: "COMPLETED",
      job_id: p1Snapshot.snapshot_id || `P1_Step1_${Date.now()}`,
      snapshot_id: p1Snapshot.snapshot_id,
      company_pool: p1Output.company_pool,
      summary: p1Output.summary || {},
      financial_report_status: p1Output.financial_report_status || {}
    };
    
    // 構建 params
    const params = {
      trigger: p1Snapshot.trigger || "TEST",
      p0_snapshot_id: p1Snapshot.p0_snapshot_id || null,
      p0_5_snapshot_id: p1Snapshot.p0_5_snapshot_id || null,
      p0_7_snapshot_id: p1Snapshot.p0_7_snapshot_id || null,
      context: { test_mode: true }
    };
    
    // 執行 Step 2
    Logger.log(`🧪 執行 P1 Step 2，使用 Step 1 結果（${step1Result.company_pool.length} 檔公司）`);
    const result = P1_ExecuteStep2(step1Result, params);
    
    // 顯示檢查提示
    const checkPrompt = generateTestCheckPrompt("P1 Step2", result);
    Logger.log(checkPrompt);
    SpreadsheetApp.getUi().alert("P1 Step 2 測試完成", checkPrompt, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return result;
  } catch (error) {
    Logger.log(`❌ P1 Step 2 測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("P1 Step 2 測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

/**
 * 🧪 測試 P1：公司池生成與結構分級（完整流程，包含 Step1 和 Step2）
 */
function TEST_P1_Execute() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試 P1（完整流程：Step1 + Step2）");
    
    // 檢查前置 Phase
    const p0Snapshot = getLatestP0Snapshot();
    const p0_5Snapshot = getLatestP0_5Snapshot();
    const p0_7Snapshot = getLatestP0_7Snapshot();
    if (!p0Snapshot || !p0_5Snapshot || !p0_7Snapshot) {
      throw new Error("⚠️ 請先執行 P0、P0.5 和 P0.7 測試");
    }
    
    // 執行 P1（內部會執行 Step1 和 Step2）
    const result = P1_Execute({ 
      trigger: "TEST",
      context: { test_mode: true }  // ⭐ V8.17.1 修正：test_mode 應該在 context 中
    });
    
    // 顯示檢查提示（合併 Step1 和 Step2 的檢查項目）
    let checkPrompt = generateTestCheckPrompt("P1 Step1", result);
    checkPrompt += "\n\n";
    checkPrompt += generateTestCheckPrompt("P1 Step2", result);
    
    Logger.log(checkPrompt);
    SpreadsheetApp.getUi().alert("P1 測試完成", checkPrompt, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return result;
  } catch (error) {
    Logger.log(`❌ P1 測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("P1 測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// ==========================================
// P2 測試按鈕
// ==========================================

/**
 * 🧪 測試 P2：基本面分析
 */
function TEST_P2_Execute() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試 P2");
    
    // 檢查前置 Phase
    const p1Snapshot = getLatestP1Snapshot();
    if (!p1Snapshot) {
      throw new Error("⚠️ 請先執行 P1 測試");
    }
    
    // 執行 P2
    const result = P2_Execute({ 
      frequency: "MONTHLY",
      trigger: "TEST",
      test_mode: true 
    });
    
    // 顯示檢查提示
    const checkPrompt = generateTestCheckPrompt("P2", result);
    Logger.log(checkPrompt);
    SpreadsheetApp.getUi().alert("P2 測試完成", checkPrompt, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return result;
  } catch (error) {
    Logger.log(`❌ P2 測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("P2 測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// ==========================================
// P2.5 測試按鈕
// ==========================================

/**
 * 🧪 測試 P2.5：Smart Money 分析
 */
function TEST_P2_5_Execute() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試 P2.5");
    
    // 檢查前置 Phase
    const p2Snapshot = getLatestP2Snapshot();
    if (!p2Snapshot) {
      throw new Error("⚠️ 請先執行 P2 測試");
    }
    
    // 執行 P2.5
    const result = P2_5_Execute({ 
      frequency: "MONTHLY",
      trigger: "TEST",
      test_mode: true 
    });
    
    // 顯示檢查提示
    const checkPrompt = generateTestCheckPrompt("P2.5", result);
    Logger.log(checkPrompt);
    SpreadsheetApp.getUi().alert("P2.5 測試完成", checkPrompt, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return result;
  } catch (error) {
    Logger.log(`❌ P2.5 測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("P2.5 測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// ==========================================
// P3 測試按鈕
// ==========================================

/**
 * 🧪 測試 P3：技術分析
 */
function TEST_P3_Execute() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試 P3");
    
    // 檢查前置 Phase
    const p2Snapshot = getLatestP2Snapshot();
    if (!p2Snapshot) {
      throw new Error("⚠️ 請先執行 P2 測試");
    }
    
    // 執行 P3
    const result = P3_Execute({ 
      trigger: "TEST",
      test_mode: true 
    });
    
    // 顯示檢查提示
    const checkPrompt = generateTestCheckPrompt("P3", result);
    Logger.log(checkPrompt);
    SpreadsheetApp.getUi().alert("P3 測試完成", checkPrompt, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return result;
  } catch (error) {
    Logger.log(`❌ P3 測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("P3 測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// ==========================================
// P4 測試按鈕
// ==========================================

/**
 * 🧪 測試 P4：資金配置計算
 */
function TEST_P4_Execute() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試 P4");
    
    // 檢查前置 Phase
    const p2Snapshot = getLatestP2Snapshot();
    const p3Snapshot = getLatestP3Snapshot();
    if (!p2Snapshot || !p3Snapshot) {
      throw new Error("⚠️ 請先執行 P2 和 P3 測試");
    }
    
    // 執行 P4
    const result = P4_Calculate({ 
      trigger: "TEST",
      reason: "測試模式執行"
    });
    
    // 顯示檢查提示
    const checkPrompt = generateTestCheckPrompt("P4", result);
    Logger.log(checkPrompt);
    SpreadsheetApp.getUi().alert("P4 測試完成", checkPrompt, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return result;
  } catch (error) {
    Logger.log(`❌ P4 測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("P4 測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// ==========================================
// P5 Daily 測試按鈕
// ==========================================

/**
 * 🧪 測試 P5 Daily：每日數據收集
 */
function TEST_P5_Daily_Execute() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試 P5 Daily");
    
    // 執行 P5 Daily
    const result = P5_Daily_Execute({ test_mode: true });
    
    // 顯示檢查提示
    const checkPrompt = generateTestCheckPrompt("P5 Daily", result);
    Logger.log(checkPrompt);
    SpreadsheetApp.getUi().alert("P5 Daily 測試完成", checkPrompt, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return result;
  } catch (error) {
    Logger.log(`❌ P5 Daily 測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("P5 Daily 測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// ==========================================
// P5 Weekly 測試按鈕
// ==========================================

/**
 * 🧪 測試 P5 Weekly：每週策略調整
 */
function TEST_P5_Weekly_Execute() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試 P5 Weekly");
    
    // 檢查前置 Phase
    const p4Snapshot = getLatestP4Snapshot();
    if (!p4Snapshot) {
      throw new Error("⚠️ 請先執行 P4 測試");
    }
    
    // 執行 P5 Weekly
    const result = P5_Weekly_Execute({ test_mode: true });
    
    // 顯示檢查提示
    const checkPrompt = generateTestCheckPrompt("P5 Weekly", result);
    Logger.log(checkPrompt);
    SpreadsheetApp.getUi().alert("P5 Weekly 測試完成", checkPrompt, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return result;
  } catch (error) {
    Logger.log(`❌ P5 Weekly 測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("P5 Weekly 測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// ==========================================
// 完整流程測試按鈕
// ==========================================

/**
 * 🧪 測試完整流程（P0 → P4）
 */
function TEST_Full_Pipeline_P0_to_P4() {
  try {
    ensureTestMode();
    Logger.log("🧪 開始測試完整流程（P0 → P4）");
    
    const results = {};
    
    // P0
    Logger.log("執行 P0...");
    results.P0 = TEST_P0_Execute();
    Utilities.sleep(2000);
    
    // P0.5
    Logger.log("執行 P0.5...");
    results.P0_5 = TEST_P0_5_Execute();
    Utilities.sleep(2000);
    
    // P0.7
    Logger.log("執行 P0.7...");
    results.P0_7 = TEST_P0_7_Execute();
    Utilities.sleep(2000);
    
    // P1（內部包含 Step1 和 Step2）
    Logger.log("執行 P1（包含 Step1 和 Step2）...");
    results.P1 = TEST_P1_Execute();
    Utilities.sleep(2000);
    
    // P2
    Logger.log("執行 P2...");
    results.P2 = TEST_P2_Execute();
    Utilities.sleep(2000);
    
    // P2.5
    Logger.log("執行 P2.5...");
    results.P2_5 = TEST_P2_5_Execute();
    Utilities.sleep(2000);
    
    // P3
    Logger.log("執行 P3...");
    results.P3 = TEST_P3_Execute();
    Utilities.sleep(2000);
    
    // P4
    Logger.log("執行 P4...");
    results.P4 = TEST_P4_Execute();
    
    Logger.log("✅ 完整流程測試完成");
    SpreadsheetApp.getUi().alert("完整流程測試完成", "所有 Phase 已執行完成，請檢查各 Phase 的輸出表格。", SpreadsheetApp.getUi().ButtonSet.OK);
    
    return results;
  } catch (error) {
    Logger.log(`❌ 完整流程測試失敗：${error.message}`);
    SpreadsheetApp.getUi().alert("完整流程測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// ==========================================
// 輔助函數（需要從其他模組導入）
// ==========================================

// ==========================================
// 快照獲取函數（這些函數應該在 06_SNAPSHOT_MANAGER.js 中定義）
// ==========================================

// 注意：這些函數會從 06_SNAPSHOT_MANAGER.js 中自動導入
// ==========================================
// P1 SEC 數據源測試按鈕
// ==========================================

/**
 * 🧪 測試 P1 SEC 數據源：抓取三檔美股財報
 */
function TEST_P1_SEC_DataSource() {
  try {
    Logger.log("🧪 開始測試 P1 SEC 數據源");
    
    const ui = SpreadsheetApp.getUi();
    
    // 測試三檔股票：AAPL, MSFT, NVDA
    const testTickers = ["AAPL", "MSFT", "NVDA"];
    const results = [];
    
    for (const ticker of testTickers) {
      Logger.log(`測試 ${ticker}...`);
      
      // 1. 測試獲取 CIK
      let cik = null;
      let cikError = null;
      try {
        cik = getCIKFromTicker(ticker);
        if (!cik) {
          cikError = "無法獲取 CIK（SEC API 失敗且無已知 CIK）";
          Logger.log(`${ticker}：${cikError}`);
        }
      } catch (e) {
        cikError = `獲取 CIK 時發生錯誤：${e.message}`;
        Logger.log(`${ticker}：${cikError}`);
        Logger.log(`${ticker}：錯誤堆疊：${e.stack}`);
      }
      
      if (!cik) {
        results.push({
          ticker: ticker,
          status: "FAILED",
          step: "getCIK",
          error: cikError || "無法獲取 CIK",
          diagnostic: "請檢查執行記錄（執行 → 查看執行記錄）以獲取詳細錯誤信息"
        });
        continue;
      }
      
      Logger.log(`${ticker} CIK=${cik}`);
      
      // 2. 測試獲取財報列表
      const reportData = fetchSECFinancialReport(ticker);
      if (!reportData || !reportData.quarterly_reports || reportData.quarterly_reports.length === 0) {
        results.push({
          ticker: ticker,
          status: "FAILED",
          step: "fetchFilings",
          error: "無法獲取財報列表",
          cik: cik
        });
        continue;
      }
      
      const reports = reportData.quarterly_reports;
      Logger.log(`${ticker} 找到 ${reports.length} 筆財報`);
      
      // 3. 檢查財報數據（包括 GCS 存儲狀態）
      const latestReport = reports[0];
      let hasContent = false;
      let contentLength = 0;
      let contentSource = null;
      
      if (latestReport.gcs_public_url) {
        // 使用 GCS 存儲
        hasContent = true;
        contentSource = "GCS";
        Logger.log(`${ticker} 財報已存儲到 GCS：${latestReport.gcs_public_url}`);
      } else if (latestReport.html_content) {
        // 直接下載的內容
        hasContent = true;
        contentLength = latestReport.html_content.length;
        contentSource = "DIRECT";
        Logger.log(`${ticker} 成功獲取 HTML，長度=${contentLength} 字符`);
      } else if (latestReport.filing_url) {
        // 有 URL 但沒有內容（可能是 GCS 存儲失敗）
        contentSource = "URL_ONLY";
        Logger.log(`${ticker} 有財報 URL，但內容未下載：${latestReport.filing_url}`);
      }
      
      results.push({
        ticker: ticker,
        status: "SUCCESS",
        cik: cik,
        company_name: reportData.company_name || null,
        filings_count: reports.length,
        latest_filing: {
          form_type: latestReport.filing_type,
          filing_date: latestReport.filing_date,
          file_type: latestReport.file_type || null,
          has_content: hasContent,
          content_length: contentLength,
          content_source: contentSource,
          gcs_path: latestReport.gcs_path || null,
          gcs_public_url: latestReport.gcs_public_url || null,
          filing_url: latestReport.filing_url || null
        }
      });
    }
    
    // 生成報告
    let report = "P1 SEC 數據源測試結果：\n\n";
    for (const result of results) {
      report += `📊 ${result.ticker}${result.company_name ? ` (${result.company_name})` : ''}：\n`;
      if (result.status === "SUCCESS") {
        report += `  ✅ CIK: ${result.cik}\n`;
        report += `  ✅ 財報數量: ${result.filings_count}\n`;
        report += `  ✅ 最新財報: ${result.latest_filing.form_type} (${result.latest_filing.filing_date})\n`;
        report += `  ✅ 文件類型: ${result.latest_filing.file_type || 'N/A'}\n`;
        
        if (result.latest_filing.gcs_public_url) {
          report += `  ✅ 存儲方式: GCS (${result.latest_filing.gcs_public_url.substring(0, 60)}...)\n`;
        } else if (result.latest_filing.has_content) {
          report += `  ✅ 存儲方式: 直接下載 (${result.latest_filing.content_length} 字符)\n`;
        } else if (result.latest_filing.filing_url) {
          report += `  ⚠️ 存儲方式: 僅 URL (內容未下載)\n`;
          report += `  ℹ️ URL: ${result.latest_filing.filing_url.substring(0, 60)}...\n`;
        } else {
          report += `  ⚠️ 存儲方式: 無內容\n`;
        }
      } else {
        report += `  ❌ 失敗於: ${result.step}\n`;
        report += `  ❌ 錯誤: ${result.error}\n`;
        if (result.diagnostic) {
          report += `  💡 診斷: ${result.diagnostic}\n`;
        }
        if (result.cik) {
          report += `  ℹ️ CIK: ${result.cik}\n`;
        }
      }
      report += "\n";
    }
    
    const successCount = results.filter(r => r.status === "SUCCESS").length;
    report += `\n總計：${successCount}/${testTickers.length} 檔成功`;
    
    Logger.log(report);
    ui.alert("P1 SEC 數據源測試完成", report, ui.ButtonSet.OK);
    
    return {
      status: "COMPLETED",
      results: results,
      success_count: successCount,
      total_count: testTickers.length
    };
    
  } catch (error) {
    Logger.log(`❌ P1 SEC 數據源測試失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack}`);
    SpreadsheetApp.getUi().alert("P1 SEC 數據源測試失敗", error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

// 如果函數不存在，會返回 null，測試按鈕會顯示錯誤提示
