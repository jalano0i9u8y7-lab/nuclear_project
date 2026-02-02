/**
 * 💰 P2.5: 快照管理
 * 
 * P2.5 快照的讀取、保存、比較
 * 
 * @version SSOT V7.1
 * @date 2025-01-15
 */

/**
 * 獲取最新 P2.5 快照
 * @return {Object|null} 快照數據或 null
 */
function getLatestP2_5Snapshot() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P2_5__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const lastRow = sheet.getLastRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = sheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
    
    const getColIndex = (headerName) => headers.indexOf(headerName);
    
    return {
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
      changes_json: (() => {
        const colIndex = getColIndex("changes_json");
        if (colIndex !== -1 && row[colIndex]) {
          try {
            return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : null;
          } catch (e) {
            return null;
          }
        }
        return null;
      })(),
      version: row[getColIndex("version")] || "V7.1"
    };
  } catch (error) {
    Logger.log(`讀取 P2.5 最新快照失敗：${error.message}`);
    return null;
  }
}

/**
 * 獲取指定 ID 的 P2.5 快照
 * @param {string} snapshotId - 快照 ID
 * @return {Object|null} 快照數據或 null
 */
function getP2_5SnapshotById(snapshotId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P2_5__SNAPSHOT");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    const snapshotIdCol = headers.indexOf("snapshot_id");
    
    if (snapshotIdCol === -1) {
      return null;
    }
    
    // 從最後一行開始往前找（通常最新的在最後）
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rows[i][snapshotIdCol] === snapshotId) {
        const row = rows[i];
        const getColIndex = (headerName) => headers.indexOf(headerName);
        
        return {
          snapshot_id: row[snapshotIdCol],
          created_at: row[getColIndex("created_at")],
          trigger: row[getColIndex("trigger")],
          p2_5_output_json: (() => {
            const colIndex = getColIndex("p2_5_output_json");
            if (colIndex !== -1 && row[colIndex]) {
              try {
                return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : row[colIndex];
              } catch (e) {
                return {};
              }
            }
            return {};
          })(),
          p2_snapshot_id: row[getColIndex("p2_snapshot_id")],
          changes_json: (() => {
            const colIndex = getColIndex("changes_json");
            if (colIndex !== -1 && row[colIndex]) {
              try {
                return typeof row[colIndex] === 'string' ? JSON.parse(row[colIndex]) : null;
              } catch (e) {
                return null;
              }
            }
            return null;
          })(),
          version: row[getColIndex("version")] || "V7.1"
        };
      }
    }
    
    return null;
  } catch (error) {
    Logger.log(`讀取 P2.5 快照 ${snapshotId} 失敗：${error.message}`);
    return null;
  }
}

/**
 * 保存 P2.5 快照
 * @param {Object} snapshotData - 快照數據
 * @return {Object} 保存後的快照信息
 */
function saveP2_5Snapshot(snapshotData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("P2_5__SNAPSHOT");
  
  if (!sheet) {
    sheet = ss.insertSheet("P2_5__SNAPSHOT");
    sheet.appendRow(P2_5_SNAPSHOT_SCHEMA.headers);
    sheet.setFrozenRows(1);
  }
  
  const snapshotId = generateP2_5SnapshotId();
  
  sheet.appendRow([
    snapshotId,
    new Date(),
    snapshotData.trigger,
    JSON.stringify(snapshotData.p2_5_output),
    snapshotData.p2_snapshot_id,
    JSON.stringify(snapshotData.changes),
    "V7.1"
  ]);
  
  Logger.log(`P2.5 快照已保存：snapshot_id=${snapshotId}`);
  
  return {
    snapshot_id: snapshotId,
    changes: snapshotData.changes
  };
}

/**
 * 生成 P2.5 快照 ID
 * @return {string} 快照 ID
 */
function generateP2_5SnapshotId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  
  return `P2_5_${year}${month}${day}_${hour}${minute}${second}`;
}

/**
 * 比較與上一版快照的差異
 * @param {Object} currentOutput - 當前輸出
 * @return {Object} 差異信息
 */
function compareWithPreviousSnapshotP2_5(currentOutput) {
  try {
    const previousSnapshot = getLatestP2_5Snapshot();
    
    if (!previousSnapshot) {
      return {
        has_changes: true,
        message: "這是第一個 P2.5 快照"
      };
    }
    
    const previousOutput = previousSnapshot.p2_5_output_json || {};
    const currentScores = currentOutput.smart_money_analysis || {};
    const previousScores = previousOutput.smart_money_analysis || {};
    
    const changes = [];
    const tickers = new Set([
      ...Object.keys(currentScores),
      ...Object.keys(previousScores)
    ]);
    
    for (const ticker of tickers) {
      const currentScore = currentScores[ticker]?.smart_money_score || 0;
      const previousScore = previousScores[ticker]?.smart_money_score || 0;
      const scoreChange = currentScore - previousScore;
      
      if (Math.abs(scoreChange) > 5) {  // 評分變化超過 5 分
        changes.push({
          ticker: ticker,
          score_change: scoreChange,
          previous_score: previousScore,
          current_score: currentScore
        });
      }
    }
    
    return {
      has_changes: changes.length > 0,
      changes_count: changes.length,
      changes: changes,
      message: changes.length > 0 ? 
        `${changes.length} 檔股票的 Smart_Money_Score 有顯著變化` :
        "無顯著變化"
    };
    
  } catch (error) {
    Logger.log(`比較 P2.5 快照差異失敗：${error.message}`);
    return {
      has_changes: true,
      message: "比較失敗，假設有變化"
    };
  }
}

/**
 * 觸發下游 Phase（P3）
 * @param {string} phase - Phase 名稱
 * @param {Object} snapshot - 快照數據
 */
function triggerDownstreamPhasesP2_5(phase, snapshot) {
  try {
    Logger.log(`P2.5：觸發下游 Phase（P3）`);
    
    // 觸發 P3（技術分析）
    // 注意：P3 會讀取 P2.5 快照來調整 Cat 分類和 Buy 價格
    // 這裡可以發送通知或記錄到日誌
    
    Logger.log(`P2.5：已觸發 P3 重新分析（基於新的籌碼面數據）`);
    
  } catch (error) {
    Logger.log(`P2.5：觸發下游 Phase 失敗：${error.message}`);
  }
}
