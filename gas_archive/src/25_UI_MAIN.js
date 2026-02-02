/**
 * 🎨 Nuclear Project UI：主入口模組
 * 
 * 提供側邊欄顯示、菜單項等功能
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

// ==========================================
// 側邊欄顯示
// ==========================================

/**
 * 顯示 UI 側邊欄（在 Spreadsheet 打開時自動顯示）
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  const menu = ui.createMenu('🚀 Nuclear Project')
    .addItem('📊 打開控制面板', 'showSidebar')
    .addSeparator()
    .addItem('🚀 一鍵執行完整流程', 'menuExecuteFullPipeline')
    .addItem('📋 查看本週策略', 'menuShowStrategies')
    .addItem('📝 輸入 Human Signal', 'menuShowHumanSignal')
    .addItem('🚨 緊急通知', 'menuShowNotifications')
    .addSeparator();
  
  // ⭐ V8.0 測試模式：添加測試模式子菜單
  if (typeof SYSTEM_TEST_MODE !== 'undefined' && SYSTEM_TEST_MODE) {
    menu.addSubMenu(
      ui.createMenu('🧪 測試模式（獨立 Phase 測試）')
        .addItem('🧪 P0：產業工程學分析', 'TEST_P0_Execute')
        .addItem('🧪 P0.5：產業鏈地圖分析', 'TEST_P0_5_Execute')
        .addItem('🧪 P0.7：系統動力學分析', 'TEST_P0_7_Execute')
        .addSeparator()
        .addItem('🧪 P1 Step 1：公司池生成', 'TEST_P1_Step1_Execute')
        .addItem('🧪 P1 Step 2：結構分級', 'TEST_P1_Step2_Execute')
        .addItem('🧪 P1：完整流程（Step1+Step2）', 'TEST_P1_Execute')
        .addSeparator()
        .addItem('🧪 P2：基本面分析', 'TEST_P2_Execute')
        .addItem('🧪 P2.5：Smart Money 分析', 'TEST_P2_5_Execute')
        .addItem('🧪 P3：技術分析', 'TEST_P3_Execute')
        .addItem('🧪 P4：資金配置計算', 'TEST_P4_Execute')
        .addItem('🧪 P5 Daily：每日數據收集', 'TEST_P5_Daily_Execute')
        .addItem('🧪 P5 Weekly：每週策略調整', 'TEST_P5_Weekly_Execute')
        .addSeparator()
        .addItem('🚀 完整流程測試（P0 → P4）', 'TEST_Full_Pipeline_P0_to_P4')
        .addSeparator()
        .addItem('📊 查看 Token 使用量', 'menuShowTestTokenUsage')
        .addItem('🔄 重置 Token 計數器', 'menuResetTestTokenCounter')
        .addSeparator()
        .addItem('📄 P1 SEC 數據源測試（抓取三檔財報）', 'TEST_P1_SEC_DataSource')
        .addItem('📅 檢查行事曆和財報數據', 'menuCheckCalendarAndEarnings')
        .addSeparator()
        .addItem('🔍 P1 檢查 GCS 存儲內容', 'TEST_P1_CheckGCSContent')
        .addItem('📖 P1 美股 Flash 自動讀檔與擷取', 'TEST_P1_US_FlashExtraction')
        .addItem('📖 P1 台日股 Flash 手動讀檔', 'TEST_P1_TWJP_FlashExtraction')
    );
  }
  
  menu.addSeparator()
    .addItem('🧪 數據源測試（Daily市場數據）', 'menuTestDailyMarketData')
    .addItem('📰 一般新聞源測試（一般當日新聞）', 'menuTestDailyNews')
    .addItem('⭐ 機構評級源測試（機構評級新聞）', 'menuTestInstitutionalRatings')
    .addSeparator()
    .addItem('🧪 測試 GOOGLEFINANCE 數據源', 'menuTestGoogleFinance')
    .addSeparator()
    .addItem('⚙️ 系統設定', 'menuShowSettings')
    .addToUi();
  
  // 自動顯示側邊欄（可選）
  // showSidebar();
}

/**
 * 顯示側邊欄
 */
function showSidebar() {
  try {
    // 嘗試多種路徑方式
    let html;
    
    // 方法 1：直接從文件讀取（如果文件在根目錄）
    try {
      html = HtmlService.createHtmlOutputFromFile('25_UI_SIDEBAR')
        .setTitle('Nuclear Project 控制面板')
        .setWidth(400);
    } catch (e1) {
      // 方法 2：嘗試 src/ 路徑
      try {
        html = HtmlService.createHtmlOutputFromFile('src/25_UI_SIDEBAR')
          .setTitle('Nuclear Project 控制面板')
          .setWidth(400);
      } catch (e2) {
        // 方法 3：使用 createHtmlOutput 直接創建（如果文件不存在）
        Logger.log(`無法找到 HTML 文件，使用內嵌 HTML`);
        html = HtmlService.createHtmlOutput(getSidebarHTML())
          .setTitle('Nuclear Project 控制面板')
          .setWidth(400);
      }
    }
    
    SpreadsheetApp.getUi().showSidebar(html);
  } catch (error) {
    Logger.log(`顯示側邊欄失敗：${error.message}`);
    SpreadsheetApp.getUi().alert('錯誤', '無法載入側邊欄。請確認 HTML 文件已正確上傳。\n\n錯誤：' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 獲取側邊欄 HTML 內容（備用方案）
 */
function getSidebarHTML() {
  // 如果 HTML 文件無法讀取，返回簡化版本
  return `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <title>Nuclear Project SSOT V7.1 控制面板</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .btn { padding: 10px 20px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%; margin-bottom: 10px; }
    .btn:hover { background: #1557b0; }
    .section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>🚀 Nuclear Project SSOT V7.1</h1>
  <div class="section">
    <h2>🚀 一鍵執行完整流程</h2>
    <button class="btn" onclick="google.script.run.withSuccessHandler(function(r){alert('執行完成');}).withFailureHandler(function(e){alert('執行失敗：'+e.message);}).UI_ExecuteFullPipeline({skip_user_confirmation:true})">執行完整流程（P0 → P4）</button>
  </div>
  <div class="section">
    <h2>📋 本週策略</h2>
    <button class="btn" onclick="loadStrategies()">查看本週策略</button>
    <div id="strategies"></div>
  </div>
  <div class="section">
    <h2>📝 Human Signal</h2>
    <button class="btn" onclick="showHumanSignal()">輸入 Human Signal</button>
  </div>
  <script>
    function loadStrategies() {
      google.script.run.withSuccessHandler(function(strategies){
        document.getElementById('strategies').innerHTML = '<p>找到 ' + strategies.length + ' 筆策略</p>';
      }).withFailureHandler(function(e){
        alert('載入失敗：' + e.message);
      }).UI_GetPendingStrategies();
    }
    function showHumanSignal() {
      alert('Human Signal 功能開發中...');
    }
  </script>
</body>
</html>
  `;
}

/**
 * 菜單：執行完整流程
 */
function menuExecuteFullPipeline() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '一鍵執行完整流程',
    '這將執行 P0 → P0.7 → P1 → P2 → P3 → P4 的完整流程。\n\n是否繼續？',
    ui.ButtonSet.YES_NO
  );
  
  if (response == ui.Button.YES) {
    try {
      const result = UI_ExecuteFullPipeline({ skip_user_confirmation: true });
      
      if (result.status === 'COMPLETED' || result.status === 'PARTIAL') {
        ui.alert('執行完成', `執行時間：${(result.total_time / 1000).toFixed(1)} 秒\n\n請查看執行記錄了解詳細結果。`, ui.ButtonSet.OK);
      } else {
        ui.alert('執行失敗', result.error || '未知錯誤', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('執行失敗', error.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * 菜單：顯示策略
 */
function menuShowStrategies() {
  showSidebar();
  // 可以通過 URL 參數或全局變量來切換到策略頁面
  // 這裡簡化為只顯示側邊欄
}

/**
 * 菜單：顯示 Human Signal
 */
function menuShowHumanSignal() {
  showSidebar();
}

/**
 * 菜單：顯示通知
 */
function menuShowNotifications() {
  showSidebar();
}

/**
 * 菜單：顯示設定
 */
function menuShowSettings() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('系統設定', '設定功能開發中...', ui.ButtonSet.OK);
}

// ==========================================
// 測試模式菜單函數 ⭐ V8.0 新增
// ==========================================

/**
 * 菜單：顯示測試 Token 使用量
 */
function menuShowTestTokenUsage() {
  try {
    const usage = getTestTokenUsage();
    const report = formatTestTokenReport();
    
    SpreadsheetApp.getUi().alert(
      '測試模式 Token 使用量',
      report,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert('錯誤', `獲取 Token 使用量失敗：${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 菜單：重置測試 Token 計數器
 */
function menuResetTestTokenCounter() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '重置 Token 計數器',
    '確定要重置測試模式的 Token 計數器嗎？',
    ui.ButtonSet.YES_NO
  );
  
  if (response == ui.Button.YES) {
    try {
      resetTestTokenCounter();
      ui.alert('成功', 'Token 計數器已重置', ui.ButtonSet.OK);
    } catch (error) {
      ui.alert('錯誤', `重置失敗：${error.message}`, ui.ButtonSet.OK);
    }
  }
}

/**
 * 菜單：檢查行事曆和財報數據
 */
function menuCheckCalendarAndEarnings() {
  try {
    const checkResult = check2026CalendarAndEarnings();
    const report = formatCalendarCheckResult(checkResult);
    
    SpreadsheetApp.getUi().alert(
      '行事曆和財報數據檢查',
      report,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert('錯誤', `檢查失敗：${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ==========================================
// HTML 模板輔助函數（用於 HtmlService）
// ==========================================

/**
 * 包含 HTML 文件（用於 HtmlService.createTemplateFromFile）
 * 
 * @param {string} filename - 文件名
 * @returns {string} HTML 內容
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
