/**
 * 📸 快照管理模組
 * 
 * 統一管理所有 Phase 的快照讀取與保存功能
 * 
 * @version SSOT V8.15
 * @date 2025-01-11
 * @changes V8.15: 新增 P0.5 和 P2.5 快照讀取函數
 */

// ==========================================
// P0.5 快照管理 ⭐ V8.15 新增
// ==========================================

/**
 * 獲取最新 P0.5 快照（產業鏈地圖與動態監控）
 * ⭐ V8.15 新增：支援 Mode 1 (Baseline Builder) 和 Mode 2 (Chain Dynamics Monitor)
 * @return {Object|null} 最新 P0.5 快照，如果沒有則返回 null
 */
function getLatestP0_5Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0_5__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P0_5__SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    // 讀取最後一行（最新快照）
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = sheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
    
    // 根據欄位名稱解析（更可靠）
    const getColIndex = (headerName) => headers.indexOf(headerName);
    
    // 解析快照數據
    const snapshot = {
      snapshot_id: row[getColIndex("snapshot_id")] || null,
      created_at: row[getColIndex("created_at")] || null,
      trigger: row[getColIndex("trigger")] || null,
      mode: row[getColIndex("mode")] || null,  // ⭐ V8.15: BASELINE_BUILDER 或 CHAIN_DYNAMICS_MONITOR
      cadence: row[getColIndex("cadence")] || null,  // ⭐ V8.15: MONTHLY 或 QUARTERLY
      p0_5_output_json: (() => {
        const colIndex = getColIndex("p0_5_output_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            Logger.log(`P0.5 快照 p0_5_output_json 解析失敗：${e.message}`);
            return {};
          }
        }
        return {};
      })(),
      industry_chain_map_json: (() => {
        const colIndex = getColIndex("industry_chain_map_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            return {};
          }
        }
        return {};
      })(),
      chain_dynamics_monitor_json: (() => {
        const colIndex = getColIndex("chain_dynamics_monitor_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            return null;
          }
        }
        return null;
      })(),
      p0_7_time_window_constraints_json: (() => {
        const colIndex = getColIndex("p0_7_time_window_constraints_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            return null;
          }
        }
        return null;
      })(),
      changes: (() => {
        const colIndex = getColIndex("changes_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            return null;
          }
        }
        return null;
      })(),
      version: row[getColIndex("version")] || "V8.15"
    };
    
    Logger.log(`讀取 P0.5 最新快照：${snapshot.snapshot_id} (Mode: ${snapshot.mode})`);
    return snapshot;
  } catch (error) {
    Logger.log(`讀取 P0.5 最新快照失敗：${error.message}`);
    return null;
  }
}

// ==========================================
// P0.7 快照管理 ⭐ V8.16 新增
// ==========================================

/**
 * 獲取最新 P0.7 快照（系統動力學驗證）
 * ⭐ V8.16 新增
 * @return {Object|null} 最新 P0.7 快照，如果沒有則返回 null
 */
function getLatestP0_7Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P0_7__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P0_7__SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    // 讀取最後一行（最新快照）
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = sheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
    
    // 根據欄位名稱解析（更可靠）
    const getColIndex = (headerName) => headers.indexOf(headerName);
    
    // 解析快照數據
    const snapshot = {
      snapshot_id: row[getColIndex("snapshot_id")] || null,
      created_at: row[getColIndex("created_at")] || null,
      trigger: row[getColIndex("trigger")] || null,
      p0_7_output_json: (() => {
        const colIndex = getColIndex("p0_7_output_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            Logger.log(`P0.7 快照 p0_7_output_json 解析失敗：${e.message}`);
            return {};
          }
        }
        return {};
      })(),
      cycle_position: row[getColIndex("cycle_position")] || null,  // Early/Mid/Late
      turning_point_risk: row[getColIndex("turning_point_risk")] || null,  // HIGH/MED/LOW
      version: row[getColIndex("version")] || "V8.0"
    };
    
    Logger.log(`讀取 P0.7 最新快照：${snapshot.snapshot_id}`);
    return snapshot;
  } catch (error) {
    Logger.log(`讀取 P0.7 最新快照失敗：${error.message}`);
    return null;
  }
}

// ==========================================
// P2 快照管理
// ==========================================

/**
 * 獲取最新 P2 快照
 * @return {Object|null} 最新 P2 快照，如果沒有則返回 null
 */
function getLatestP2Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P2__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P2__SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    // 讀取最後一行（最新快照）
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = sheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
    
    // 根據欄位名稱解析（更可靠）
    const getColIndex = (headerName) => headers.indexOf(headerName);
    
    // 解析快照數據
    const snapshot = {
      snapshot_id: row[getColIndex("snapshot_id")] || null,
      created_at: row[getColIndex("created_at")] || null,
      trigger: row[getColIndex("trigger")] || null,
      tier_assignments: (() => {
        const colIndex = getColIndex("tier_assignments_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            Logger.log(`P2 快照 tier_assignments_json 解析失敗：${e.message}`);
            return {};
          }
        }
        return {};
      })(),
      tier_assignments_json: (() => {
        const colIndex = getColIndex("tier_assignments_json");
        return colIndex !== -1 ? row[colIndex] : null;
      })(),
      tier_summary: (() => {
        const colIndex = getColIndex("tier_summary_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            return {};
          }
        }
        return {};
      })(),
      changes: (() => {
        const colIndex = getColIndex("changes_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            return null;
          }
        }
        return null;
      })(),
      auto_trigger: (() => {
        const colIndex = getColIndex("auto_trigger_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            return null;
          }
        }
        return null;
      })(),
      version: row[getColIndex("version")] || "V6.3"
    };
    
    Logger.log(`讀取 P2 最新快照：${snapshot.snapshot_id}`);
    return snapshot;
  } catch (error) {
    Logger.log(`讀取 P2 最新快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存 P2 快照
 * @param {Object} snapshot - P2 快照對象
 * @return {boolean} 是否保存成功
 */
function saveP2Snapshot(snapshot) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P2__SNAPSHOT");
    
    if (!sheet) {
      throw new Error("P2__SNAPSHOT 表格不存在，請先執行 initializeSheets()");
    }
    
    // 準備保存數據
    const row = [
      snapshot.snapshot_id || generateP2SnapshotId(),
      snapshot.created_at || new Date(),
      snapshot.trigger || "MANUAL",
      JSON.stringify(snapshot.tier_assignments || {}),
      JSON.stringify(snapshot.tier_summary || {}),
      snapshot.changes ? JSON.stringify(snapshot.changes) : null,
      snapshot.auto_trigger ? JSON.stringify(snapshot.auto_trigger) : null,
      snapshot.version || "V6.3"
    ];
    
    // 寫入最後一行
    sheet.appendRow(row);
    
    Logger.log(`P2 快照已保存：${snapshot.snapshot_id || row[0]}`);
    return true;
  } catch (error) {
    Logger.log(`保存 P2 快照失敗：${error.message}`);
    throw error;
  }
}

/**
 * 根據 ID 獲取 P2 快照
 * ⭐ V8.17 新增：支援根據 snapshot_id 查詢特定快照
 * @param {string} snapshotId - 快照 ID
 * @return {Object|null} P2 快照，如果沒有則返回 null
 */
function getP2SnapshotById(snapshotId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P2__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log(`P2__SNAPSHOT 表格不存在或沒有數據，無法查詢快照：${snapshotId}`);
      return null;
    }
    
    // 讀取所有數據
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dataRange = sheet.getRange(2, 1, lastRow - 1, headers.length);
    const rows = dataRange.getValues();
    
    // 根據欄位名稱解析（更可靠）
    const getColIndex = (headerName) => headers.indexOf(headerName);
    const snapshotIdCol = getColIndex("snapshot_id");
    
    if (snapshotIdCol === -1) {
      Logger.log("P2__SNAPSHOT 表格缺少 snapshot_id 欄位");
      return null;
    }
    
    // 查找匹配的快照
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[snapshotIdCol] === snapshotId) {
        // 找到匹配的快照，解析數據
        const snapshot = {
          snapshot_id: row[snapshotIdCol] || null,
          created_at: row[getColIndex("created_at")] || null,
          trigger: row[getColIndex("trigger")] || null,
          tier_assignments: (() => {
            const colIndex = getColIndex("tier_assignments_json");
            if (colIndex !== -1 && row[colIndex]) {
              try {
                return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
              } catch (e) {
                Logger.log(`P2 快照 tier_assignments_json 解析失敗：${e.message}`);
                return {};
              }
            }
            return {};
          })(),
          tier_assignments_json: (() => {
            const colIndex = getColIndex("tier_assignments_json");
            return colIndex !== -1 ? row[colIndex] : null;
          })(),
          tier_summary: (() => {
            const colIndex = getColIndex("tier_summary_json");
            if (colIndex !== -1 && row[colIndex]) {
              try {
                return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
              } catch (e) {
                return {};
              }
            }
            return {};
          })(),
          changes: (() => {
            const colIndex = getColIndex("changes_json");
            if (colIndex !== -1 && row[colIndex]) {
              try {
                return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
              } catch (e) {
                return null;
              }
            }
            return null;
          })(),
          auto_trigger: (() => {
            const colIndex = getColIndex("auto_trigger_json");
            if (colIndex !== -1 && row[colIndex]) {
              try {
                return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
              } catch (e) {
                return null;
              }
            }
            return null;
          })(),
          version: row[getColIndex("version")] || "V6.3"
        };
        
        Logger.log(`讀取 P2 快照（ID：${snapshotId}）：${snapshot.snapshot_id}`);
        return snapshot;
      }
    }
    
    Logger.log(`未找到 P2 快照：${snapshotId}`);
    return null;
  } catch (error) {
    Logger.log(`讀取 P2 快照（ID：${snapshotId}）失敗：${error.message}`);
    return null;
  }
}

/**
 * 生成 P2 快照 ID
 * @return {string} P2 快照 ID
 */
function generateP2SnapshotId() {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `P2_${year}_Q${quarter}`;
}

// ==========================================
// P3 快照管理
// ==========================================

/**
 * 獲取最新 P3 快照
 * @return {Object|null} 最新 P3 快照，如果沒有則返回 null
 */
function getLatestP3Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P3__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P3__SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    // 讀取最後一行（最新快照）
    const lastRow = sheet.getLastRow();
    const row = sheet.getRange(lastRow, 1, 1, 9).getValues()[0];
    
    // 解析快照數據
    const snapshot = {
      snapshot_id: row[0] || null,
      created_at: row[1] || null,
      trigger: row[2] || null,
      prevent_recursive: row[3] || false,  // ⭐ 錯誤 1 修正：防止遞迴標記
      technical_results: row[4] ? JSON.parse(row[4]) : {},
      changes: row[5] ? JSON.parse(row[5]) : null,
      auto_trigger: row[6] ? JSON.parse(row[6]) : null,
      data_freshness: row[7] ? JSON.parse(row[7]) : null,  // ⭐ 錯誤 2 修正：數據時效性記錄
      version: row[8] || "V6.3"
    };
    
    Logger.log(`讀取 P3 最新快照：${snapshot.snapshot_id}`);
    return snapshot;
  } catch (error) {
    Logger.log(`讀取 P3 最新快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存 P3 快照
 * @param {Object} snapshot - P3 快照對象
 * @return {boolean} 是否保存成功
 */
function saveP3Snapshot(snapshot) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P3__SNAPSHOT");
    
    if (!sheet) {
      throw new Error("P3__SNAPSHOT 表格不存在，請先執行 initializeSheets()");
    }
    
    // 準備保存數據
    const row = [
      snapshot.snapshot_id || generateP3SnapshotId(),
      snapshot.created_at || new Date(),
      snapshot.trigger || "MANUAL",
      snapshot.prevent_recursive || false,  // ⭐ 錯誤 1 修正：防止遞迴標記
      JSON.stringify(snapshot.technical_results || {}),
      snapshot.changes ? JSON.stringify(snapshot.changes) : null,
      snapshot.auto_trigger ? JSON.stringify(snapshot.auto_trigger) : null,
      snapshot.data_freshness ? JSON.stringify(snapshot.data_freshness) : null,  // ⭐ 錯誤 2 修正：數據時效性記錄
      snapshot.version || "V6.3"
    ];
    
    // 寫入最後一行
    sheet.appendRow(row);
    
    Logger.log(`P3 快照已保存：${snapshot.snapshot_id || row[0]}`);
    return true;
  } catch (error) {
    Logger.log(`保存 P3 快照失敗：${error.message}`);
    throw error;
  }
}

/**
 * 生成 P3 快照 ID
 * @return {string} P3 快照 ID
 */
function generateP3SnapshotId() {
  const now = new Date();
  const year = now.getFullYear();
  const weekNumber = getWeekNumber(now);
  return `P3_${year}_W${weekNumber}`;
}

/**
 * 獲取週數（輔助函數）
 * @param {Date} date - 日期
 * @return {number} 週數
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ==========================================
// P4 快照管理
// ==========================================

/**
 * 獲取最新 P4 快照
 * @return {Object|null} 最新 P4 快照，如果沒有則返回 null
 */
function getLatestP4Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P4__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P4__SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    // 讀取最後一行（最新快照）
    const lastRow = sheet.getLastRow();
    const row = sheet.getRange(lastRow, 1, 1, 10).getValues()[0];
    
    // 解析快照數據
    const snapshot = {
      snapshot_id: row[0] || null,
      created_at: row[1] || null,
      trigger: row[2] || null,
      trigger_reason: row[3] || null,
      p2_snapshot_id: row[4] || null,
      p3_snapshot_id: row[5] || null,
      allocations: row[6] ? JSON.parse(row[6]) : [],
      summary: row[7] ? JSON.parse(row[7]) : {},
      changes: row[8] ? JSON.parse(row[8]) : null,
      version: row[9] || "V6.3"
    };
    
    Logger.log(`讀取 P4 最新快照：${snapshot.snapshot_id}`);
    return snapshot;
  } catch (error) {
    Logger.log(`讀取 P4 最新快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存 P4 快照（已存在於 10_P4_CALCULATOR.js，這裡提供統一版本）
 * @param {Object} snapshot - P4 快照對象
 * @return {boolean} 是否保存成功
 */
function saveP4Snapshot(snapshot) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P4__SNAPSHOT");
    
    if (!sheet) {
      throw new Error("P4__SNAPSHOT 表格不存在，請先執行 initializeSheets()");
    }
    
    // 準備保存數據
    const row = [
      snapshot.snapshot_id || generateP4SnapshotId(),
      snapshot.created_at || new Date(),
      snapshot.trigger || "MANUAL",
      snapshot.trigger_reason || null,
      snapshot.p2_snapshot_id || null,
      snapshot.p3_snapshot_id || null,
      JSON.stringify(snapshot.allocations || []),
      JSON.stringify(snapshot.summary || {}),
      snapshot.changes ? JSON.stringify(snapshot.changes) : null,
      snapshot.version || "V6.3"
    ];
    
    // 寫入最後一行
    sheet.appendRow(row);
    
    Logger.log(`P4 快照已保存：${snapshot.snapshot_id || row[0]}`);
    return true;
  } catch (error) {
    Logger.log(`保存 P4 快照失敗：${error.message}`);
    throw error;
  }
}

/**
 * 生成 P4 快照 ID（已在 10_P4_CALCULATOR.js 中定義，這裡提供備用）
 * @return {string} P4 快照 ID
 */
function generateP4SnapshotId() {
  const now = new Date();
  const year = now.getFullYear();
  const weekNumber = getWeekNumber(now);
  return `P4_${year}_W${weekNumber}`;
}

// ==========================================
// P2.5 快照管理 ⭐ V8.15 新增
// ==========================================

/**
 * 獲取最新 P2.5 快照（機構級籌碼分析）
 * ⭐ V8.15 新增：支援籌碼面異常警報讀取
 * @return {Object|null} 最新 P2.5 快照，如果沒有則返回 null
 */
function getLatestP2_5Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P2_5__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P2_5__SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    // 讀取最後一行（最新快照）
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = sheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
    
    // 根據欄位名稱解析（更可靠）
    const getColIndex = (headerName) => headers.indexOf(headerName);
    
    // 解析快照數據
    const snapshot = {
      snapshot_id: row[getColIndex("snapshot_id")] || null,
      created_at: row[getColIndex("created_at")] || null,
      trigger: row[getColIndex("trigger")] || null,
      p2_5_output_json: (() => {
        const colIndex = getColIndex("p2_5_output_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            Logger.log(`P2.5 快照 p2_5_output_json 解析失敗：${e.message}`);
            return {};
          }
        }
        return {};
      })(),
      p2_snapshot_id: row[getColIndex("p2_snapshot_id")] || null,
      changes: (() => {
        const colIndex = getColIndex("changes_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
          } catch (e) {
            return null;
          }
        }
        return null;
      })(),
      version: row[getColIndex("version")] || "V8.15"
    };
    
    // ⭐ V8.15: 提取異常警報（用於 Escalation Gate 硬觸發）
    if (snapshot.p2_5_output_json) {
      // 嘗試從 output_json 中提取異常警報
      snapshot.insider_selling_alert = snapshot.p2_5_output_json.insider_selling_alert || false;
      snapshot.abnormal_13f_distribution = snapshot.p2_5_output_json.abnormal_13f_distribution || false;
      snapshot.distribution_risk_flags = snapshot.p2_5_output_json.distribution_risk_flags || [];
    }
    
    Logger.log(`讀取 P2.5 最新快照：${snapshot.snapshot_id}`);
    return snapshot;
  } catch (error) {
    Logger.log(`讀取 P2.5 最新快照失敗：${error.message}`);
    return null;
  }
}

// ==========================================
// P5 Weekly 快照管理
// ==========================================

/**
 * 獲取最新 P5 Weekly 快照
 * @return {Object|null} 最新 P5 Weekly 快照，如果沒有則返回 null
 */
function getLatestP5WeeklySnapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__WEEKLY_SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5__WEEKLY_SNAPSHOT 表格不存在或沒有數據");
      return null;
    }
    
    // 讀取最後一行（最新快照）
    const lastRow = sheet.getLastRow();
    const row = sheet.getRange(lastRow, 1, 1, 14).getValues()[0];
    
    // 解析快照數據
    const snapshot = {
      snapshot_id: row[0] || null,
      created_at: row[1] || null,
      p2_snapshot_id: row[2] || null,
      p3_snapshot_id: row[3] || null,
      p4_snapshot_id: row[4] || null,
      market_analysis: row[5] ? JSON.parse(row[5]) : {},
      causality_chain: row[6] ? JSON.parse(row[6]) : [],
      risk_events: row[7] ? JSON.parse(row[7]) : [],
      derivatives_strategy_adjustment: row[8] ? JSON.parse(row[8]) : [],
      belief_update: row[9] ? JSON.parse(row[9]) : null,
      u_adjustment: row[10] ? JSON.parse(row[10]) : null,
      action_list: row[11] ? JSON.parse(row[11]) : [],
      trigger_decisions: row[12] ? JSON.parse(row[12]) : null,
      version: row[13] || "V6.3"
    };
    
    Logger.log(`讀取 P5 Weekly 最新快照：${snapshot.snapshot_id}`);
    return snapshot;
  } catch (error) {
    Logger.log(`讀取 P5 Weekly 最新快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存 P5 Weekly 快照
 * @param {Object} snapshot - P5 Weekly 快照對象
 * @return {boolean} 是否保存成功
 */
function saveP5WeeklySnapshot(snapshot) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P5__WEEKLY_SNAPSHOT");
    
    if (!sheet) {
      throw new Error("P5__WEEKLY_SNAPSHOT 表格不存在，請先執行 initializeSheets()");
    }
    
    // 準備保存數據
    const row = [
      snapshot.snapshot_id || generateP5WeeklySnapshotId(),
      snapshot.created_at || new Date(),
      snapshot.p2_snapshot_id || null,
      snapshot.p3_snapshot_id || null,
      snapshot.p4_snapshot_id || null,
      JSON.stringify(snapshot.market_analysis || {}),
      JSON.stringify(snapshot.causality_chain || []),
      JSON.stringify(snapshot.risk_events || []),
      JSON.stringify(snapshot.derivatives_strategy_adjustment || []),
      snapshot.belief_update ? JSON.stringify(snapshot.belief_update) : null,
      snapshot.u_adjustment ? JSON.stringify(snapshot.u_adjustment) : null,
      JSON.stringify(snapshot.action_list || []),
      snapshot.trigger_decisions ? JSON.stringify(snapshot.trigger_decisions) : null,
      snapshot.version || "V6.3"
    ];
    
    // 寫入最後一行
    sheet.appendRow(row);
    
    Logger.log(`P5 Weekly 快照已保存：${snapshot.snapshot_id || row[0]}`);
    return true;
  } catch (error) {
    Logger.log(`保存 P5 Weekly 快照失敗：${error.message}`);
    throw error;
  }
}

/**
 * 生成 P5 Weekly 快照 ID
 * @return {string} P5 Weekly 快照 ID
 */
function generateP5WeeklySnapshotId() {
  const now = new Date();
  const year = now.getFullYear();
  const weekNumber = getWeekNumber(now);
  return `P5_WEEKLY_${year}_W${weekNumber}`;
}

// ==========================================
// 通用快照輔助函數
// ==========================================

/**
 * 獲取所有快照（用於調試）
 * @param {string} phase - Phase 名稱（P2、P3、P4、P5_WEEKLY）
 * @param {number} limit - 限制數量，預設 10
 * @return {Array} 快照列表
 */
function getAllSnapshots(phase, limit = 10) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetName;
    
    switch (phase) {
      case "P2":
        sheetName = "P2__SNAPSHOT";
        break;
      case "P3":
        sheetName = "P3__SNAPSHOT";
        break;
      case "P4":
        sheetName = "P4__SNAPSHOT";
        break;
      case "P5_WEEKLY":
        sheetName = "P5__WEEKLY_SNAPSHOT";
        break;
      default:
        throw new Error(`未知的 Phase：${phase}`);
    }
    
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    // 讀取最後 limit 行（最新的快照）
    const totalRows = sheet.getLastRow() - 1;  // 減去標題行
    const startRow = Math.max(2, sheet.getLastRow() - limit + 1);  // 從倒數第 limit 行開始
    const numRows = Math.min(limit, totalRows);
    
    if (numRows <= 0) {
      return [];
    }
    
    const rows = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();
    
    // 根據 Phase 解析數據
    const snapshots = [];
    
    for (const row of rows) {
      let snapshot;
      
      switch (phase) {
        case "P2":
          snapshot = {
            snapshot_id: row[0],
            created_at: row[1],
            trigger: row[2],
            tier_assignments: row[3] ? JSON.parse(row[3]) : {},
            tier_summary: row[4] ? JSON.parse(row[4]) : {}
          };
          break;
        case "P3":
          snapshot = {
            snapshot_id: row[0],
            created_at: row[1],
            trigger: row[2],
            prevent_recursive: row[3],
            technical_results: row[4] ? JSON.parse(row[4]) : {}
          };
          break;
        case "P4":
          snapshot = {
            snapshot_id: row[0],
            created_at: row[1],
            trigger: row[2],
            allocations: row[6] ? JSON.parse(row[6]) : [],
            summary: row[7] ? JSON.parse(row[7]) : {}
          };
          break;
        case "P5_WEEKLY":
          snapshot = {
            snapshot_id: row[0],
            created_at: row[1],
            market_analysis: row[5] ? JSON.parse(row[5]) : {},
            action_list: row[11] ? JSON.parse(row[11]) : []
          };
          break;
      }
      
      snapshots.push(snapshot);
    }
    
    return snapshots;
  } catch (error) {
    Logger.log(`獲取 ${phase} 快照列表失敗：${error.message}`);
    return [];
  }
}

/**
 * 刪除舊快照（用於數據封存）
 * @param {string} phase - Phase 名稱
 * @param {number} keepDays - 保留天數，預設 90 天
 * @return {number} 刪除的快照數量
 */
function archiveOldSnapshots(phase, keepDays = 90) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetName;
    
    switch (phase) {
      case "P2":
        sheetName = "P2__SNAPSHOT";
        break;
      case "P3":
        sheetName = "P3__SNAPSHOT";
        break;
      case "P4":
        sheetName = "P4__SNAPSHOT";
        break;
      case "P5_WEEKLY":
        sheetName = "P5__WEEKLY_SNAPSHOT";
        break;
      default:
        throw new Error(`未知的 Phase：${phase}`);
    }
    
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return 0;
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    let deletedCount = 0;
    
    // 從最後一行開始往前檢查（保留標題行和最新的快照）
    for (let i = rows.length - 1; i >= 2; i--) {  // 從倒數第二行開始（跳過標題行）
      const created_at = rows[i][1];  // created_at 在第二列
      
      if (created_at instanceof Date && created_at < cutoffDate) {
        // 刪除這一行
        sheet.deleteRow(i + 1);  // +1 因為陣列索引從 0 開始，表格行數從 1 開始
        deletedCount++;
      }
    }
    
    Logger.log(`封存 ${phase} 舊快照：刪除 ${deletedCount} 筆（保留最近 ${keepDays} 天）`);
    return deletedCount;
  } catch (error) {
    Logger.log(`封存 ${phase} 舊快照失敗：${error.message}`);
    return 0;
  }
}
