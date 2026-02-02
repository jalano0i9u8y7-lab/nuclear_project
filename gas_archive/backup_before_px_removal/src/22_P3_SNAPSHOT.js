/**
 * 📈 P3: 技術分析 - 快照管理模組
 * 
 * 負責快照的讀取、保存、比對、自動觸發檢查
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// 快照讀取
// ==========================================

/**
 * 獲取最新的 P3 快照
 * 
 * @returns {Object|null} snapshot - 快照數據或 null
 */
function getLatestP3Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P3__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const row = sheet.getRange(lastRow, 1, 1, 9).getValues()[0];
    
    return {
      snapshot_id: row[0],
      created_at: row[1],
      trigger: row[2],
      prevent_recursive: row[3] || false,
      technical_results_json: row[4] ? JSON.parse(row[4]) : {},
      changes_json: row[5] ? JSON.parse(row[5]) : null,
      auto_trigger_json: row[6] ? JSON.parse(row[6]) : null,
      data_freshness_json: row[7] ? JSON.parse(row[7]) : null,
      version: row[8] || "V7.1"
    };
  } catch (error) {
    Logger.log(`讀取 P3 最新快照失敗：${error.message}`);
    return null;
  }
}

// ==========================================
// 快照保存
// ==========================================

/**
 * 保存 P3 快照
 * 
 * @param {Object} snapshotData - 快照數據
 * @returns {Object} snapshot - 保存後的快照信息
 */
function saveP3Snapshot(snapshotData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P3__SNAPSHOT");
  
  if (!sheet) {
    sheet = ss.insertSheet("P3__SNAPSHOT");
    sheet.appendRow(P3_SNAPSHOT_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  const snapshotId = generateP3SnapshotId(snapshotData.frequency);
  
  sheet.appendRow([
    snapshotId,
    new Date(),
    snapshotData.trigger,
    snapshotData.prevent_recursive || false,
    JSON.stringify(snapshotData.technical_results),
    JSON.stringify(snapshotData.changes),
    JSON.stringify(snapshotData.auto_trigger),
    JSON.stringify(snapshotData.data_freshness),
    "V7.1"
  ]);
  
  Logger.log(`P3 快照已保存：snapshot_id=${snapshotId}`);
  
  return {
    snapshot_id: snapshotId,
    changes: snapshotData.changes
  };
}

/**
 * ⭐ 工程師修復：驗證 Cat 轉換是否符合規則（SSOT 層規則）
 * 
 * Cat 轉換規則：
 * - Cat 只能「往後走」，不能自由跳來跳去
 * - 例如：BASE → MOMENTUM → LATE（允許）
 * - 例如：LATE → MOMENTUM（禁止，除非明確 Reset 條件）
 * 
 * Reset 條件（允許反向轉換）：
 * - multi-week base rebuild（多週基礎重建）
 * - volume structure reset（量能結構重置）
 * - system-level regime change（系統級 Regime 轉換）
 * 
 * @param {string|null} previousCat - 上週的 Cat（null 表示新股票）
 * @param {string} currentCat - 本週的 Cat
 * @param {string} ticker - 股票代碼
 * @returns {Object} validationResult - { valid: boolean, warning: string|null }
 */
function validateCatTransition(previousCat, currentCat, ticker) {
  // 如果是新股票，允許任何 Cat
  if (!previousCat) {
    return { valid: true, warning: null };
  }
  
  // Cat 優先級定義（從低到高）
  const catPriority = {
    "Cat1": 1,      // 未啟動
    "Cat2": 2,      // 啟動期
    "Cat3": 3,      // 主升段
    "Cat4-A": 4,    // 高位回調
    "Cat4-B": 5,    // 深度回調
    "Cat5": 6       // 趨勢破壞
  };
  
  const previousPriority = catPriority[previousCat] || 0;
  const currentPriority = catPriority[currentCat] || 0;
  
  // 允許「往後走」（優先級增加或相同）
  if (currentPriority >= previousPriority) {
    return { valid: true, warning: null };
  }
  
  // 禁止「往前跳」（優先級降低），除非是 Reset 條件
  // ⚠️ 注意：Reset 條件需要從 P3 輸出中檢查（例如：volume_structure_reset、regime_change 等）
  // 目前先標記警告，未來可以擴展為硬性檢查
  
  const warning = `Cat 轉換違反單調性規則：${previousCat} (priority ${previousPriority}) → ${currentCat} (priority ${currentPriority})。需要檢查是否為 Reset 條件（多週基礎重建、量能結構重置、系統級 Regime 轉換）。`;
  
  return { valid: false, warning: warning };
}

/**
 * 生成 P3 快照 ID
 * 
 * @param {string} frequency - 執行頻率（WEEKLY/MONTHLY）
 * @returns {string} snapshotId - 快照 ID
 */
function generateP3SnapshotId(frequency) {
  const date = new Date();
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  const month = date.getMonth() + 1;
  
  if (frequency === "WEEKLY") {
    return `P3_W${year}W${week}_${Date.now()}`;
  } else {
    return `P3_M${year}M${month}_${Date.now()}`;
  }
}

/**
 * 計算週數
 * 
 * @param {Date} date - 日期
 * @returns {number} week - 週數
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ==========================================
// 快照比對
// ==========================================

/**
 * 比對當前輸出與上一版快照
 * 
 * @param {Object} currentOutput - 當前輸出
 * @returns {Object} changes - 變動信息
 */
function compareWithPreviousSnapshotP3(currentOutput) {
  const previousSnapshot = getLatestP3Snapshot();
  
  if (!previousSnapshot) {
    return {
      has_changes: true,
      is_first_run: true,
      changes: []
    };
  }
  
  const previousResults = previousSnapshot.technical_results_json || {};
  const currentResults = currentOutput.technical_results || {};
  const changes = [];
  
  // 比對 Cat 變動
  const catChanges = [];
  const catValidationWarnings = [];
  for (const [ticker, currentResult] of Object.entries(currentResults)) {
    const previousResult = previousResults[ticker];
    
    if (!previousResult || previousResult.cat !== currentResult.cat) {
      const previousCat = previousResult ? previousResult.cat : null;
      const currentCat = currentResult.cat;
      
      // ⭐ V8.26 C4 修復：驗證 Cat 轉換是否符合規則
      const validation = validateCatTransition(previousCat, currentCat, ticker);
      
      if (!validation.valid) {
        // Cat 轉換違規，記錄警告並強制回退
        Logger.log(`P3 Cat 轉換違規（${ticker}）：${validation.warning}`);
        catValidationWarnings.push({
          ticker: ticker,
          previous_cat: previousCat,
          current_cat: currentCat,
          warning: validation.warning
        });
        
        // ⭐ V8.26 C4 修復：強制回退到上週的 Cat（防止 AI 亂跳）
        currentResult.cat = previousCat;
        Logger.log(`P3 Cat 轉換已回退（${ticker}）：${currentCat} → ${previousCat}`);
      }
      
      catChanges.push({
        ticker: ticker,
        from: previousCat || "NEW",
        to: currentResult.cat,  // 使用驗證後的 Cat（可能已被回退）
        validation_warning: validation.warning || null
      });
    }
  }
  
  if (catChanges.length > 0) {
    changes.push({
      type: "CAT_CHANGES",
      changes: catChanges
    });
  }
  
  // ⭐ V8.26 C4 修復：如果有 Cat 轉換違規警告，添加到 changes 中
  if (catValidationWarnings.length > 0) {
    changes.push({
      type: "CAT_VALIDATION_WARNINGS",
      warnings: catValidationWarnings
    });
  }
  
  return {
    has_changes: changes.length > 0 || catChanges.length > 0,
    is_first_run: false,
    changes: changes,
    cat_validation_warnings: catValidationWarnings  // ⭐ V8.26 C4 修復：返回驗證警告
  };
}

// ==========================================
// 自動觸發檢查
// ==========================================

/**
 * 檢查自動觸發條件
 * 
 * @param {Object} p3Output - P3 輸出
 * @returns {Object} autoTrigger - 自動觸發信息
 */
function checkAutoTriggerConditionsP3(p3Output) {
  const autoTriggers = [];
  const catChanges = p3Output.changes?.find(c => c.type === "CAT_CHANGES");
  
  if (catChanges && catChanges.changes.length > 0) {
    // Cat 變動 → 自動觸發 P4
    autoTriggers.push({
      type: "CAT_CHANGE",
      trigger_phase: "P4",
      changed_stocks: catChanges.changes.map(c => c.ticker)
    });
  }
  
  return {
    triggers: autoTriggers,
    should_trigger_p4: autoTriggers.length > 0
  };
}

// ==========================================
// 數據新鮮度檢查
// ==========================================

/**
 * 檢查技術數據新鮮度
 * 
 * @param {Object} technicalData - 技術指標數據
 * @returns {Object} freshness - 新鮮度信息
 */
function checkDataFreshness(technicalData) {
  const freshness = {};
  
  for (const [ticker, data] of Object.entries(technicalData)) {
    if (data.last_updated) {
      const daysSinceUpdate = (new Date() - new Date(data.last_updated)) / (1000 * 60 * 60 * 24);
      freshness[ticker] = {
        last_updated: data.last_updated,
        days_since_update: daysSinceUpdate,
        is_fresh: daysSinceUpdate <= 1  // 1 天內為新鮮
      };
    }
  }
  
  return freshness;
}
