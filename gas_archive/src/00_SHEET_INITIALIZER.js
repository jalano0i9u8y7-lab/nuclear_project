/**
 * 🔧 Google Sheets 初始化工具
 * 
 * 功能：
 * 1. 初始化所有必要的 tab 和 header（根據 SCHEMA 定義）
 * 2. 刪除不在 SCHEMA 中的 tab（清理用不到的 tab）
 * 3. 更新現有 tab 的 header（確保與 SCHEMA 一致）
 * 
 * @version V8.0
 * @date 2026-01-19
 */

// ==========================================
// 獲取所有 SCHEMA 定義
// ==========================================

/**
 * 獲取所有需要創建的表格 SCHEMA 列表
 * @returns {Array} SCHEMA 列表
 */
function getAllRequiredSchemas() {
  return [
    // M0 工具機表格
    M0_JOB_QUEUE_SCHEMA,
    M0_RESULT_SCHEMA,
    M0_CROSSCHECK_LOG_SCHEMA,
    M0_BATCH_JOBS_SCHEMA,
    SYS_EXTERNAL_CONTRACTS_SCHEMA,
    
    // P0 表格
    P0_SNAPSHOT_SCHEMA,
    P0_5_SNAPSHOT_SCHEMA,
    P0_7_SNAPSHOT_SCHEMA,
    
    // P1 表格
    PHASE1_COMPANY_POOL_SCHEMA,
    PHASE1_MASTER_CANDIDATES_SCHEMA,
    PHASE1_TRACKING_POOL_SCHEMA,
    PHASE1_REJECTION_POOL_SCHEMA,
    P1_SNAPSHOT_SCHEMA,
    
    // P2 表格
    P2_SNAPSHOT_SCHEMA,
    PHASE2_OUTPUT_SCHEMA,
    P2_5_SNAPSHOT_SCHEMA,
    PHASE2_5_OUTPUT_SCHEMA,
    
    // P3 表格
    P3_SNAPSHOT_SCHEMA,
    MARKET_OHLCV_DAILY_SCHEMA,
    MARKET_INDICATORS_DAILY_SCHEMA,
    
    // P4 表格
    P4_SNAPSHOT_SCHEMA,
    SECTOR_ETF_DAILY_SCHEMA,
    DERIVATIVES_DAILY_SCHEMA,
    SMART_MONEY_DAILY_SCHEMA,
    SMART_MONEY_WEEKLY_SCHEMA,
    MACRO_DATA_DAILY_SCHEMA,
    
    // P5 表格
    NEWS_ATOMS_DAILY_SCHEMA,
    STOCK_NEWS_INDEX_DAILY_SCHEMA,
    SECTOR_NEWS_INDEX_DAILY_SCHEMA,
    EVENTS_INDEX_WEEKLY_SCHEMA,
    MACRO_DATA_WEEKLY_METRICS_SCHEMA,
    TECHNICAL_INDICATORS_WEEKLY_METRICS_SCHEMA,
    INSTITUTIONAL_RATINGS_DAILY_SCHEMA,
    INSTITUTIONAL_RATINGS_LEARNING_LOG_SCHEMA,
    WORLDVIEW_DAILY_SCHEMA,
    P5_CALENDAR_SCHEMA,
    P5_WEEKLY_SNAPSHOT_SCHEMA,
    P5_DAILY_STATUS_SCHEMA,
    P5_LEARNING_LOG_SCHEMA,
    P5_WEEKLY_STOCK_STRATEGIES_SCHEMA,
    P5_WEEKLY_STRATEGY_TRACKING_SCHEMA,
    P5_STRATEGY_SNAPSHOT_SCHEMA,  // ⭐ V8.13 新增：策略快照
    P5_OUTCOME_SNAPSHOT_SCHEMA,  // ⭐ V8.13 新增：結果快照
    P5_LEARNING_STATE_SCHEMA,  // ⭐ V8.13 新增：學習狀態
    P5_SCENARIO_MEMORY_SCHEMA,  // ⭐ V8.13 新增：情境記憶
    P5_CALENDAR_HISTORY_SCHEMA,  // ⭐ V8.0 新增：行事曆歷史經驗表
    P5_CALENDAR_MONITORING_SCHEMA,  // ⭐ V8.0 新增：行事曆監控記錄表
    P5_CALENDAR_ALERTS_SCHEMA,  // ⭐ V8.0 新增：行事曆異常報警表
    EARNINGS_HISTORICAL_EXPERIENCE_SCHEMA,  // ⭐ V8.0 新增：財報歷史經驗表
    EARNINGS_EXPERIENCE_SNAPSHOT_SCHEMA,  // ⭐ V8.0 新增：財報經驗快照表
    EARNINGS_EXPERIENCE_INDEX_SCHEMA,  // ⭐ V8.0 新增：財報經驗索引表
    EARNINGS_LEARNING_MEMORY_SCHEMA,  // ⭐ V8.0 新增：財報學習記憶庫
    HOLDINGS_EARNINGS_INDEX_SCHEMA,  // ⭐ V8.0 新增：持股財報索引表
    // ⭐ V8.17 新增：長期記憶和週度處理狀態（在各自的檔案中定義，這裡不引用）
    // P5__LONG_TERM_MEMORY 和 P5__WEEKLY_PROCESSING_STATE 會在需要時自動創建
    MONITORING_LOG_SCHEMA,
    
    // V7.1 新增表格
    DEFCON_STATUS_SCHEMA,
    P4_5_HEDGING_SNAPSHOT_SCHEMA,
    P4_6_EMERGENCY_EXIT_LOG_SCHEMA,
    P5_5_EARNINGS_RISK_SCHEMA,
    EARNINGS_STRATEGIES_SCHEMA,
    EARNINGS_NOTIFICATIONS_SCHEMA,
    P5_6_BUBBLE_STATUS_SCHEMA,
    P5_7_SUPPLY_CHAIN_RISK_SCHEMA,
    P0_5_INDUSTRY_CHAIN_MAP_SCHEMA,
    
    // V7.1 執行前確認與台股掛單監控
    M0_JOB_CONFIRMATION_SCHEMA,
    TAIWAN_ORDER_MONITOR_SCHEMA,
    TAIWAN_ORDER_NOTIFICATIONS_SCHEMA,
    
    // V7.1 決策權限系統
    DECISION_CONFLICT_LOG_SCHEMA,
    
    // V7.1 P5 Monthly/Quarterly 快照
    P5_MONTHLY_SNAPSHOT_SCHEMA,
    P5_QUARTERLY_SNAPSHOT_SCHEMA,
    
    // V7.1 UI 系統
    HUMAN_SIGNAL_SCHEMA,
    HOLDINGS_SCHEMA,
    UI_CONTROL_PANEL_SCHEMA,
    
    // V8.0 Phase Review 系統
    PHASE_REVIEW_SCHEMA,
    
    // V8.0 持倉整合系統
    PHASE_OUT_PLANS_SCHEMA,
    
    // V8.0 P6 盤中監測系統
    P6_INTRADAY_LOG_SCHEMA,
    P6_EMERGENCY_EXIT_LOG_SCHEMA,
    P6_INTRADAY_ALERTS_DAILY_SCHEMA,
    
    // ⭐ V8.0 測試模式
    // TEST_MODE_TOKEN_COUNTER 會在測試模式中自動創建，不需要在這裡定義
    
    // ⭐ V8.0 行事曆相關（如果有的話）
    // EARNINGS_CALENDAR 等會在需要時創建
  ];
}

// ==========================================
// 完整初始化函數
// ==========================================

/**
 * 🔧 完整初始化所有表格（創建/更新 header，刪除不需要的 tab）
 * 
 * 功能：
 * 1. 根據 SCHEMA 創建所有必要的 tab 和 header
 * 2. 更新現有 tab 的 header（確保與 SCHEMA 一致）
 * 3. 刪除不在 SCHEMA 中的 tab（清理用不到的 tab）
 * 
 * ⚠️ 警告：此函數會刪除不在 SCHEMA 中的 tab，請謹慎使用！
 * 
 * @param {boolean} deleteUnusedTabs - 是否刪除不在 SCHEMA 中的 tab（預設：true）
 * @param {boolean} preserveData - 是否保留現有數據（預設：true，只更新 header）
 * @returns {Object} 初始化結果
 */
function initializeAllTabsAndHeaders(deleteUnusedTabs = true, preserveData = true) {
  const startTime = Date.now();
  Logger.log("=".repeat(60));
  Logger.log("🔧 開始初始化所有表格");
  Logger.log("=".repeat(60));
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("無法獲取 Spreadsheet 對象");
    }
    
    // 獲取所有 SCHEMA
    const allSchemas = getAllRequiredSchemas();
    const requiredSheetNames = allSchemas.map(schema => schema.sheetName);
    
    Logger.log(`找到 ${allSchemas.length} 個需要創建的表格`);
    
    // 獲取現有所有 tab
    const existingSheets = ss.getSheets();
    const existingSheetNames = existingSheets.map(sheet => sheet.getName());
    
    Logger.log(`現有 ${existingSheetNames.length} 個表格`);
    
    const result = {
      created: [],
      updated: [],
      deleted: [],
      errors: []
    };
    
    // 步驟 1：創建/更新所有必要的 tab
    for (const schema of allSchemas) {
      try {
        let sheet = ss.getSheetByName(schema.sheetName);
        
        if (!sheet) {
          // 創建新表格
          sheet = ss.insertSheet(schema.sheetName);
          sheet.appendRow(schema.headers);
          sheet.setFrozenRows(1);
          result.created.push(schema.sheetName);
          Logger.log(`✓ 創建表格：${schema.sheetName}`);
        } else {
          // 更新現有表格的 header
          const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          const expectedHeaders = schema.headers;
          
          // 檢查 header 是否匹配
          const headersMatch = JSON.stringify(currentHeaders) === JSON.stringify(expectedHeaders);
          
          if (!headersMatch) {
            // Header 不匹配，需要更新
            if (preserveData && sheet.getLastRow() > 1) {
              // ⭐ V8.19 改進：智能添加缺失欄位（保留現有數據）
              const missingHeaders = expectedHeaders.filter(h => !currentHeaders.includes(h));
              const extraHeaders = currentHeaders.filter(h => !expectedHeaders.includes(h));
              
              if (missingHeaders.length > 0) {
                // 有缺失欄位：在現有欄位後面添加
                let currentLastCol = sheet.getLastColumn();
                
                for (let i = 0; i < missingHeaders.length; i++) {
                  const missingHeader = missingHeaders[i];
                  // 在當前最後一欄後面插入新欄位
                  sheet.insertColumnAfter(currentLastCol);
                  sheet.getRange(1, currentLastCol + 1).setValue(missingHeader);
                  currentLastCol++;  // 更新最後一欄位置（因為插入後 lastCol 會增加）
                }
                
                Logger.log(`✓ 表格 ${schema.sheetName} 已添加 ${missingHeaders.length} 個新欄位：${missingHeaders.join(", ")}`);
              }
              
              if (extraHeaders.length > 0) {
                // 有額外欄位：記錄但不刪除（向後兼容）
                Logger.log(`⚠️ 表格 ${schema.sheetName} 有 ${extraHeaders.length} 個額外欄位（保留）：${extraHeaders.join(", ")}`);
              }
              
              if (missingHeaders.length === 0 && extraHeaders.length > 0) {
                // 只有額外欄位，沒有缺失欄位
                Logger.log(`⚠️ 表格 ${schema.sheetName} 的 header 順序或額外欄位與預期不同，但保留現有數據`);
                Logger.log(`  當前 header: ${currentHeaders.join(", ")}`);
                Logger.log(`  預期 header: ${expectedHeaders.join(", ")}`);
              }
            } else {
              // 不保留數據：直接更新 header
              sheet.clear();
              sheet.appendRow(expectedHeaders);
              sheet.setFrozenRows(1);
              Logger.log(`✓ 更新表格 header：${schema.sheetName}`);
            }
            result.updated.push(schema.sheetName);
          } else {
            Logger.log(`✓ 表格已存在且 header 正確：${schema.sheetName}`);
          }
        }
      } catch (error) {
        Logger.log(`✗ 處理表格失敗：${schema.sheetName} - ${error.message}`);
        result.errors.push({
          sheet: schema.sheetName,
          error: error.message
        });
      }
    }
    
    // 步驟 2：刪除不在 SCHEMA 中的 tab
    if (deleteUnusedTabs) {
      for (const existingSheet of existingSheets) {
        const sheetName = existingSheet.getName();
        
        // 跳過系統保留的表格（例如：測試模式相關的表格）
        if (sheetName === "TEST_MODE_TOKEN_COUNTER") {
          continue;  // 保留測試模式 Token 計數器
        }
        
        if (!requiredSheetNames.includes(sheetName)) {
          try {
            ss.deleteSheet(existingSheet);
            result.deleted.push(sheetName);
            Logger.log(`✓ 刪除不需要的表格：${sheetName}`);
          } catch (error) {
            Logger.log(`✗ 刪除表格失敗：${sheetName} - ${error.message}`);
            result.errors.push({
              sheet: sheetName,
              error: `刪除失敗：${error.message}`
            });
          }
        }
      }
    }
    
    const totalTime = Date.now() - startTime;
    Logger.log("\n" + "=".repeat(60));
    Logger.log(`🎉 初始化完成（總時間：${(totalTime / 1000).toFixed(1)} 秒）`);
    Logger.log(`創建：${result.created.length} 個表格`);
    Logger.log(`更新：${result.updated.length} 個表格`);
    if (deleteUnusedTabs) {
      Logger.log(`刪除：${result.deleted.length} 個表格`);
    }
    if (result.errors.length > 0) {
      Logger.log(`錯誤：${result.errors.length} 個`);
    }
    Logger.log("=".repeat(60));
    
    return {
      status: "COMPLETED",
      created: result.created.length,
      updated: result.updated.length,
      deleted: result.deleted.length,
      errors: result.errors.length,
      details: result,
      total_time: totalTime
    };
    
  } catch (error) {
    Logger.log(`✗ 初始化失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack || "無"}`);
    throw error;
  }
}

/**
 * 🔧 初始化按鈕（供手動調用，帶 UI 確認）
 * 
 * 這是一個安全的版本，會先顯示預覽，讓用戶確認後再執行
 * ⚠️ 注意：此函數需要從 Google Sheets UI 觸發（例如：自訂選單）
 */
function BUTTON_InitializeAllTabs() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      try {
        SpreadsheetApp.getUi().alert("錯誤：無法獲取 Spreadsheet 對象");
      } catch (uiError) {
        Logger.log("錯誤：無法獲取 Spreadsheet 對象（無 UI 環境）");
      }
      return;
    }
    
    // 獲取所有 SCHEMA
    const allSchemas = getAllRequiredSchemas();
    const requiredSheetNames = allSchemas.map(schema => schema.sheetName);
    
    // 獲取現有所有 tab
    const existingSheets = ss.getSheets();
    const existingSheetNames = existingSheets.map(sheet => sheet.getName());
    
    // 找出需要刪除的 tab
    const tabsToDelete = existingSheetNames.filter(name => 
      !requiredSheetNames.includes(name) && name !== "TEST_MODE_TOKEN_COUNTER"
    );
    
    // 顯示預覽
    let preview = "=".repeat(60) + "\n";
    preview += "📋 初始化預覽\n";
    preview += "=".repeat(60) + "\n\n";
    preview += `需要創建/更新的表格：${requiredSheetNames.length} 個\n`;
    preview += `現有表格：${existingSheetNames.length} 個\n`;
    preview += `需要刪除的表格：${tabsToDelete.length} 個\n\n`;
    
    if (tabsToDelete.length > 0) {
      preview += "⚠️ 將刪除以下表格：\n";
      tabsToDelete.forEach(name => {
        preview += `  - ${name}\n`;
      });
      preview += "\n";
    }
    
    preview += "=".repeat(60) + "\n";
    
    Logger.log(preview);
    
    // 嘗試獲取 UI（如果沒有 UI，直接執行）
    let hasUI = false;
    let userConfirmed = false;
    
    try {
      const ui = SpreadsheetApp.getUi();
      if (ui) {
        hasUI = true;
        // 詢問用戶確認
        const response = ui.alert(
          "初始化所有表格",
          preview + "\n\n是否繼續？\n\n⚠️ 警告：此操作會刪除不在 SCHEMA 中的表格！",
          ui.ButtonSet.YES_NO
        );
        userConfirmed = (response === ui.Button.YES);
      }
    } catch (uiError) {
      // 沒有 UI 環境（例如：從編輯器直接執行）
      Logger.log("⚠️ 無法顯示 UI 對話框（從編輯器執行），將直接執行初始化");
      Logger.log("⚠️ 警告：此操作會刪除不在 SCHEMA 中的表格！");
      userConfirmed = true;  // 直接執行
    }
    
    if (userConfirmed) {
      // 執行初始化
      const result = initializeAllTabsAndHeaders(true, true);
      
      // 顯示結果
      let resultMessage = "=".repeat(60) + "\n";
      resultMessage += "✅ 初始化完成\n";
      resultMessage += "=".repeat(60) + "\n\n";
      resultMessage += `創建：${result.created} 個表格\n`;
      resultMessage += `更新：${result.updated} 個表格\n`;
      resultMessage += `刪除：${result.deleted} 個表格\n`;
      if (result.errors > 0) {
        resultMessage += `錯誤：${result.errors} 個\n`;
      }
      resultMessage += "\n";
      resultMessage += `總時間：${(result.total_time / 1000).toFixed(1)} 秒\n`;
      resultMessage += "=".repeat(60) + "\n";
      
      Logger.log(resultMessage);
      
      // 如果有 UI，顯示對話框
      if (hasUI) {
        try {
          SpreadsheetApp.getUi().alert("初始化完成", resultMessage, SpreadsheetApp.getUi().ButtonSet.OK);
        } catch (uiError2) {
          // UI 不可用，只記錄日誌
        }
      }
    } else {
      Logger.log("用戶取消初始化");
    }
  } catch (error) {
    Logger.log(`初始化失敗：${error.message}`);
    Logger.log(`錯誤堆疊：${error.stack || "無"}`);
    
    // 嘗試顯示錯誤對話框（如果有 UI）
    try {
      SpreadsheetApp.getUi().alert("錯誤", `初始化失敗：${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (uiError) {
      // UI 不可用，只記錄日誌
    }
  }
}

/**
 * 🔧 直接初始化所有表格（無 UI 確認，供程式調用）
 * 
 * ⚠️ 警告：此函數會直接執行，不會顯示確認對話框
 * 適合從其他函數或觸發器調用
 * 
 * @param {boolean} deleteUnusedTabs - 是否刪除不在 SCHEMA 中的 tab（預設：true）
 * @param {boolean} preserveData - 是否保留現有數據（預設：true）
 * @returns {Object} 初始化結果
 */
function initializeAllTabsDirectly(deleteUnusedTabs = true, preserveData = true) {
  return initializeAllTabsAndHeaders(deleteUnusedTabs, preserveData);
}
