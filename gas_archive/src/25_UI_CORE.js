/**
 * 🎨 Nuclear Project UI 核心模組
 * 
 * 提供一鍵執行完整流程、策略操作、Human Signal 輸入、緊急通知等功能
 * 
 * @version SSOT V7.1
 * @date 2025-01-12
 */

// ==========================================
// UI 配置
// ==========================================

const UI_CONFIG = {
  // 自動執行配置
  auto_execute: {
    enabled: true,
    phases: ["P0", "P0.7", "P1", "P2", "P3", "P4"],  // 自動執行的 Phase
    skip_user_confirmation: true  // 跳過用戶確認（P0-P4 自動運行）
  },
  
  // 通知配置
  notifications: {
    emergency_enabled: true,
    strategy_enabled: true,
    check_interval_minutes: 5  // 檢查間隔（分鐘）
  }
};

// ==========================================
// M0 Job 等待輔助函數
// ==========================================

/**
 * 等待 M0 Job 執行完成並獲取快照 ID
 * @param {string} jobId - Job ID
 * @param {string} phase - Phase 名稱（P0, P0_7, P1, P2, P3）
 * @param {number} maxWaitTime - 最大等待時間（毫秒），預設 5 分鐘
 * @returns {string|null} 快照 ID，如果超時或失敗則返回 null
 */
function waitForM0JobAndGetSnapshot(jobId, phase, maxWaitTime = 5 * 60 * 1000) {
  const startTime = Date.now();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const jobQueueSheet = ss.getSheetByName("M0__JOB_QUEUE");
  
  if (!jobQueueSheet) {
    Logger.log(`等待 M0 Job：M0__JOB_QUEUE 表格不存在`);
    return null;
  }
  
  Logger.log(`等待 M0 Job 執行完成：jobId=${jobId}, phase=${phase}`);
  
  // 先執行一次 M0_Execute 來處理 Job Queue
  try {
    M0_Execute();
  } catch (error) {
    Logger.log(`M0_Execute 執行失敗：${error.message}`);
  }
  
  // 輪詢檢查 Job 狀態
  while (Date.now() - startTime < maxWaitTime) {
    const dataRange = jobQueueSheet.getDataRange();
    const rows = dataRange.getValues();
    
    // 查找對應的 Job
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === jobId) {
        const status = row[2];  // status
        
        if (status === "DONE") {
          Logger.log(`M0 Job 執行完成：jobId=${jobId}`);
          
          // 從快照表格讀取最新快照 ID
          let snapshotId = null;
          
          if (phase === "P0") {
            const snapshot = getLatestP0Snapshot();
            snapshotId = snapshot ? snapshot.snapshot_id : null;
          } else if (phase === "P0_7") {
            const snapshot = getLatestP0_7Snapshot();
            snapshotId = snapshot ? snapshot.snapshot_id : null;
          } else if (phase === "P1") {
            const snapshot = getLatestP1Snapshot();
            snapshotId = snapshot ? snapshot.snapshot_id : null;
          } else if (phase === "P2") {
            const snapshot = getLatestP2Snapshot();
            snapshotId = snapshot ? snapshot.snapshot_id : null;
          } else if (phase === "P3") {
            const snapshot = getLatestP3Snapshot();
            snapshotId = snapshot ? snapshot.snapshot_id : null;
          }
          
          return snapshotId;
        } else if (status === "ERROR") {
          Logger.log(`M0 Job 執行失敗：jobId=${jobId}`);
          return null;
        } else if (status === "NEW" || status === "RUNNING") {
          // 繼續等待，再次執行 M0_Execute
          try {
            M0_Execute();
          } catch (error) {
            Logger.log(`M0_Execute 執行失敗：${error.message}`);
          }
          
          // 等待 2 秒後再次檢查
          Utilities.sleep(2000);
          break;
        }
      }
    }
    
    // 如果沒找到 Job，可能已經被處理完，嘗試從快照表格讀取
    if (Date.now() - startTime > 10000) {  // 等待至少 10 秒
      let snapshotId = null;
      
      if (phase === "P0") {
        const snapshot = getLatestP0Snapshot();
        snapshotId = snapshot ? snapshot.snapshot_id : null;
      } else if (phase === "P0_7") {
        const snapshot = getLatestP0_7Snapshot();
        snapshotId = snapshot ? snapshot.snapshot_id : null;
      } else if (phase === "P1") {
        const snapshot = getLatestP1Snapshot();
        snapshotId = snapshot ? snapshot.snapshot_id : null;
      }
      
      if (snapshotId) {
        Logger.log(`從快照表格讀取到快照 ID：${snapshotId}`);
        return snapshotId;
      }
    }
    
    Utilities.sleep(2000);  // 等待 2 秒
  }
  
  Logger.log(`等待 M0 Job 超時：jobId=${jobId}, phase=${phase}`);
  return null;
}

// ==========================================
// 一鍵執行完整流程
// ==========================================

/**
 * 一鍵執行完整流程（P0 → P0.7 → P1 → P2 → P3 → P4）
 * 
 * @param {Object} options - 執行選項
 * @param {boolean} options.skip_user_confirmation - 是否跳過用戶確認（預設 true）
 * @param {Object} options.user_input - 用戶輸入（來自執行前確認，可選）
 * @returns {Object} result - 執行結果
 */
function UI_ExecuteFullPipeline(options = {}) {
  const startTime = Date.now();
  Logger.log("=".repeat(60));
  Logger.log("🚀 UI：開始一鍵執行完整流程");
  Logger.log("=".repeat(60));
  
  try {
    const skipConfirmation = options.skip_user_confirmation !== false;  // 預設跳過確認
    const userInput = options.user_input || {};
    
    const results = {
      phases: {},
      total_time: 0,
      status: "RUNNING",
      errors: []
    };
    
    // Phase 0：產業工程學
    Logger.log("\n📊 Phase 0：產業工程學分析");
    try {
      const p0Result = P0_Execute({
        trigger: "UI_FULL_PIPELINE",
        user_input: userInput.p0 || {},
        context: { skip_confirmation: skipConfirmation }
      });
      
      // 如果返回的是 SUBMITTED 狀態，需要等待 M0 執行完成
      if (p0Result.status === "SUBMITTED" && p0Result.job_id) {
        Logger.log(`P0 任務已提交到 M0 Job Queue，等待執行完成...`);
        const snapshotId = waitForM0JobAndGetSnapshot(p0Result.job_id, "P0", 10 * 60 * 1000);  // 最多等待 10 分鐘
        if (!snapshotId) {
          throw new Error("P0 執行超時或失敗，無法獲取快照 ID");
        }
        results.phases.P0 = {
          status: "COMPLETED",
          snapshot_id: snapshotId,
          job_id: p0Result.job_id,
          execution_time: 0
        };
        Logger.log(`✓ P0 完成，快照 ID：${snapshotId}`);
      } else if (p0Result.snapshot_id) {
        // 如果已經有快照 ID（同步執行）
        results.phases.P0 = {
          status: "COMPLETED",
          snapshot_id: p0Result.snapshot_id,
          execution_time: p0Result.execution_time || 0
        };
        Logger.log(`✓ P0 完成，快照 ID：${p0Result.snapshot_id}`);
      } else {
        // 其他狀態（如 REQUIRES_CONFIRMATION）
        results.phases.P0 = {
          status: p0Result.status || "UNKNOWN",
          message: p0Result.message || "未知狀態"
        };
        Logger.log(`⚠ P0 狀態：${p0Result.status || "UNKNOWN"}`);
      }
    } catch (error) {
      Logger.log(`✗ P0 失敗：${error.message}`);
      results.phases.P0 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P0", error: error.message });
    }
    
    Utilities.sleep(1000);  // 避免請求過快
    
    // Phase 0.5：產業鏈地圖與供應鏈情報網（V8.0 新增）
    Logger.log("\n🗺️ Phase 0.5：產業鏈地圖與供應鏈情報網");
    try {
      const p0Snapshot = getLatestP0Snapshot();
      if (p0Snapshot && p0Snapshot.p0_output_json) {
        const p0Output = typeof p0Snapshot.p0_output_json === 'string' ? 
          JSON.parse(p0Snapshot.p0_output_json) : p0Snapshot.p0_output_json;
        
        // 檢查 P0 是否有選出主題
        if (p0Output.themes && p0Output.themes.length > 0) {
          // P0.5 是可選的，目前簡化為記錄日誌
          Logger.log(`P0.5：P0 已選出 ${p0Output.themes.length} 個主題，P0.5 功能開發中`);
          results.phases.P0_5 = {
            status: "SKIPPED",
            message: "P0.5 功能開發中（V8.0 架構已定義，待實現）"
          };
        } else {
          Logger.log("⚠ P0.5：P0 沒有選出主題，跳過");
          results.phases.P0_5 = { status: "SKIPPED", reason: "P0 沒有選出主題" };
        }
      } else {
        Logger.log("⚠ P0.5：P0 快照不存在，跳過");
        results.phases.P0_5 = { status: "SKIPPED", reason: "P0 快照不存在" };
      }
    } catch (error) {
      Logger.log(`⚠ P0.5 執行失敗（可選模組，不影響主流程）：${error.message}`);
      results.phases.P0_5 = { status: "SKIPPED", reason: error.message };
    }
    
    Utilities.sleep(1000);
    
    // Phase 0.7：系統動力學
    Logger.log("\n🔄 Phase 0.7：系統動力學分析");
    try {
      const p0_7Result = P0_7_Execute({
        trigger: "UI_FULL_PIPELINE",
        user_input: userInput.p0_7 || {},
        context: { skip_confirmation: skipConfirmation }
      });
      
      // 如果返回的是 SUBMITTED 狀態，需要等待 M0 執行完成
      if (p0_7Result.status === "SUBMITTED" && p0_7Result.job_id) {
        Logger.log(`P0.7 任務已提交到 M0 Job Queue，等待執行完成...`);
        const snapshotId = waitForM0JobAndGetSnapshot(p0_7Result.job_id, "P0_7", 10 * 60 * 1000);  // 最多等待 10 分鐘
        if (!snapshotId) {
          throw new Error("P0.7 執行超時或失敗，無法獲取快照 ID");
        }
        results.phases.P0_7 = {
          status: "COMPLETED",
          snapshot_id: snapshotId,
          job_id: p0_7Result.job_id,
          execution_time: 0
        };
        Logger.log(`✓ P0.7 完成，快照 ID：${snapshotId}`);
      } else if (p0_7Result.snapshot_id) {
        results.phases.P0_7 = {
          status: "COMPLETED",
          snapshot_id: p0_7Result.snapshot_id,
          execution_time: p0_7Result.execution_time || 0
        };
        Logger.log(`✓ P0.7 完成，快照 ID：${p0_7Result.snapshot_id}`);
      } else {
        results.phases.P0_7 = {
          status: p0_7Result.status || "UNKNOWN",
          message: p0_7Result.message || "未知狀態"
        };
        Logger.log(`⚠ P0.7 狀態：${p0_7Result.status || "UNKNOWN"}`);
      }
    } catch (error) {
      Logger.log(`✗ P0.7 失敗：${error.message}`);
      results.phases.P0_7 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P0.7", error: error.message });
    }
    
    Utilities.sleep(1000);
    
    // Phase 1：公司池建立
    Logger.log("\n🏢 Phase 1：公司池建立");
    try {
      const p1Result = P1_Execute({
        trigger: "UI_FULL_PIPELINE",
        user_input: userInput.p1 || {},
        context: { skip_confirmation: skipConfirmation }
      });
      
      // 如果返回的是 SUBMITTED 狀態，需要等待 M0 執行完成
      if (p1Result.status === "SUBMITTED" && p1Result.job_id) {
        Logger.log(`P1 任務已提交到 M0 Job Queue，等待執行完成...`);
        const snapshotId = waitForM0JobAndGetSnapshot(p1Result.job_id, "P1", 10 * 60 * 1000);  // 最多等待 10 分鐘
        if (!snapshotId) {
          throw new Error("P1 執行超時或失敗，無法獲取快照 ID");
        }
        results.phases.P1 = {
          status: "COMPLETED",
          snapshot_id: snapshotId,
          job_id: p1Result.job_id,
          execution_time: 0
        };
        Logger.log(`✓ P1 完成，快照 ID：${snapshotId}`);
      } else if (p1Result.snapshot_id) {
        results.phases.P1 = {
          status: "COMPLETED",
          snapshot_id: p1Result.snapshot_id,
          execution_time: p1Result.execution_time || 0
        };
        Logger.log(`✓ P1 完成，快照 ID：${p1Result.snapshot_id}`);
      } else {
        results.phases.P1 = {
          status: p1Result.status || "UNKNOWN",
          message: p1Result.message || "未知狀態"
        };
        Logger.log(`⚠ P1 狀態：${p1Result.status || "UNKNOWN"}`);
      }
    } catch (error) {
      Logger.log(`✗ P1 失敗：${error.message}`);
      results.phases.P1 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P1", error: error.message });
    }
    
    Utilities.sleep(1000);
    
    // Phase 2.5：機構級籌碼分析（V8.0 新增，可選）
    Logger.log("\n💰 Phase 2.5：機構級籌碼分析（可選）");
    try {
      const p2Snapshot = getLatestP2Snapshot();
      if (p2Snapshot) {
        // P2.5 是可選的，如果沒有籌碼面數據會跳過
        const p2_5Result = P2_5_Quarterly_Execute({
          trigger: "UI_FULL_PIPELINE",
          context: { skip_confirmation: skipConfirmation }
        });
        
        if (p2_5Result.status === "SUBMITTED" && p2_5Result.job_id) {
          Logger.log(`P2.5 任務已提交到 M0 Job Queue（可選，可能因缺少數據而跳過）`);
          results.phases.P2_5 = {
            status: "SUBMITTED",
            job_id: p2_5Result.job_id,
            message: "P2.5 已提交（可選模組）"
          };
        } else {
          results.phases.P2_5 = {
            status: p2_5Result.status || "SKIPPED",
            message: p2_5Result.message || "P2.5 跳過（可能缺少籌碼面數據）"
          };
        }
      } else {
        results.phases.P2_5 = { status: "SKIPPED", reason: "P2 快照不存在" };
      }
    } catch (error) {
      Logger.log(`⚠ P2.5 執行失敗（可選模組，不影響主流程）：${error.message}`);
      results.phases.P2_5 = { status: "SKIPPED", reason: error.message };
    }
    
    Utilities.sleep(1000);
    
    // Phase 2：基本面分析
    Logger.log("\n📈 Phase 2：基本面分析");
    try {
      // P2 需要對每個股票執行，這裡簡化為對所有 Master Candidates 執行
      const p1Snapshot = getLatestP1Snapshot();
      
      if (!p1Snapshot) {
        Logger.log("⚠ P2：P1 快照不存在，跳過");
        results.phases.P2 = { status: "SKIPPED", reason: "P1 快照不存在" };
      } else {
        // 檢查 p1_output_json 是否存在且有效
        let p1Output = null;
        
        if (p1Snapshot.p1_output_json) {
          try {
            p1Output = typeof p1Snapshot.p1_output_json === 'string' 
              ? JSON.parse(p1Snapshot.p1_output_json)
              : p1Snapshot.p1_output_json;
          } catch (parseError) {
            Logger.log(`⚠ P2：P1 快照 JSON 解析失敗：${parseError.message}`);
          }
        }
        
        // 如果 p1_output_json 不存在或解析失敗，嘗試從 Phase1_Master_Candidates 表格讀取
        if (!p1Output || !p1Output.master_candidates || p1Output.master_candidates.length === 0) {
          Logger.log("⚠ P2：P1 快照中沒有 master_candidates，嘗試從表格讀取");
          
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          const masterSheet = ss.getSheetByName("Phase1_Master_Candidates");
          
          if (masterSheet && masterSheet.getLastRow() > 1) {
            const masterCount = masterSheet.getLastRow() - 1;
            Logger.log(`P2：從表格讀取到 ${masterCount} 檔 Master Candidates`);
            
            // 即使沒有 p1_output_json，也可以執行 P2（P2 會從表格讀取）
            const p2Result = P2_Quarterly_Execute({
              trigger: "UI_FULL_PIPELINE",
              user_input: userInput.p2 || {},
              context: { skip_confirmation: skipConfirmation }
            });
            
            // 如果返回的是 SUBMITTED 狀態，需要等待 M0 執行完成
            if (p2Result.status === "SUBMITTED" && p2Result.job_id) {
              Logger.log(`P2 任務已提交到 M0 Job Queue，等待執行完成...`);
              const snapshotId = waitForM0JobAndGetSnapshot(p2Result.job_id, "P2", 10 * 60 * 1000);
              if (!snapshotId) {
                throw new Error("P2 執行超時或失敗，無法獲取快照 ID");
              }
              results.phases.P2 = {
                status: "COMPLETED",
                snapshot_id: snapshotId,
                job_id: p2Result.job_id,
                execution_time: 0,
                stocks_analyzed: masterCount
              };
              Logger.log(`✓ P2 完成，快照 ID：${snapshotId}`);
            } else if (p2Result.snapshot_id) {
              results.phases.P2 = {
                status: "COMPLETED",
                snapshot_id: p2Result.snapshot_id,
                execution_time: p2Result.execution_time || 0,
                stocks_analyzed: masterCount
              };
              Logger.log(`✓ P2 完成，快照 ID：${p2Result.snapshot_id}`);
            } else {
              results.phases.P2 = {
                status: p2Result.status || "UNKNOWN",
                message: p2Result.message || "未知狀態"
              };
              Logger.log(`⚠ P2 狀態：${p2Result.status || "UNKNOWN"}`);
            }
          } else {
            Logger.log("⚠ P2：Phase1_Master_Candidates 表格也不存在或為空，跳過");
            results.phases.P2 = { status: "SKIPPED", reason: "P1 數據不存在（快照和表格都為空）" };
          }
        } else {
          const masterCandidates = p1Output.master_candidates || [];
          Logger.log(`P2：將對 ${masterCandidates.length} 檔股票進行基本面分析`);
          
          // 執行 P2
          const p2Result = P2_Quarterly_Execute({
            trigger: "UI_FULL_PIPELINE",
            user_input: userInput.p2 || {},
            context: { skip_confirmation: skipConfirmation }
          });
          
          // 如果返回的是 SUBMITTED 狀態，需要等待 M0 執行完成
          if (p2Result.status === "SUBMITTED" && p2Result.job_id) {
            Logger.log(`P2 任務已提交到 M0 Job Queue，等待執行完成...`);
            const snapshotId = waitForM0JobAndGetSnapshot(p2Result.job_id, "P2", 10 * 60 * 1000);
            if (!snapshotId) {
              throw new Error("P2 執行超時或失敗，無法獲取快照 ID");
            }
            results.phases.P2 = {
              status: "COMPLETED",
              snapshot_id: snapshotId,
              job_id: p2Result.job_id,
              execution_time: 0,
              stocks_analyzed: masterCandidates.length
            };
            Logger.log(`✓ P2 完成，快照 ID：${snapshotId}`);
          } else if (p2Result.snapshot_id) {
            results.phases.P2 = {
              status: "COMPLETED",
              snapshot_id: p2Result.snapshot_id,
              execution_time: p2Result.execution_time || 0,
              stocks_analyzed: masterCandidates.length
            };
            Logger.log(`✓ P2 完成，快照 ID：${p2Result.snapshot_id}`);
          } else {
            results.phases.P2 = {
              status: p2Result.status || "UNKNOWN",
              message: p2Result.message || "未知狀態"
            };
            Logger.log(`⚠ P2 狀態：${p2Result.status || "UNKNOWN"}`);
          }
        }
      }
    } catch (error) {
      Logger.log(`✗ P2 失敗：${error.message}`);
      results.phases.P2 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P2", error: error.message });
    }
    
    Utilities.sleep(1000);
    
    // Phase 3：技術分析
    Logger.log("\n📊 Phase 3：技術分析");
    try {
      // P3 需要對每個股票執行
      const p2Snapshot = getLatestP2Snapshot();
      
      if (!p2Snapshot) {
        Logger.log("⚠ P3：P2 快照不存在，跳過");
        results.phases.P3 = { status: "SKIPPED", reason: "P2 快照不存在" };
      } else {
        // 檢查 tier_assignments 是否存在且有效
        let tierAssignments = null;
        
        // 嘗試從 tier_assignments 欄位讀取（已解析的對象）
        if (p2Snapshot.tier_assignments && typeof p2Snapshot.tier_assignments === 'object') {
          tierAssignments = p2Snapshot.tier_assignments;
        } 
        // 嘗試從 tier_assignments_json 欄位讀取（JSON 字符串）
        else if (p2Snapshot.tier_assignments_json) {
          try {
            tierAssignments = typeof p2Snapshot.tier_assignments_json === 'string'
              ? JSON.parse(p2Snapshot.tier_assignments_json)
              : p2Snapshot.tier_assignments_json;
          } catch (parseError) {
            Logger.log(`⚠ P3：P2 快照 JSON 解析失敗：${parseError.message}`);
          }
        }
        
        // 如果 tier_assignments 不存在，嘗試從 Phase2_Output 表格讀取
        if (!tierAssignments || Object.keys(tierAssignments).length === 0) {
          Logger.log("⚠ P3：P2 快照中沒有 tier_assignments，嘗試從表格讀取");
          
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          const p2OutputSheet = ss.getSheetByName("Phase2_Output");
          
          if (p2OutputSheet && p2OutputSheet.getLastRow() > 1) {
            const stockCount = p2OutputSheet.getLastRow() - 1;
            Logger.log(`P3：從表格讀取到 ${stockCount} 檔股票`);
            
            // 即使沒有 tier_assignments，也可以執行 P3（P3 會從表格讀取）
            // ⭐ V8.0 修正：P3_Execute 需要 frequency 參數
            const p3Result = P3_Weekly_Execute({
              trigger: "UI_FULL_PIPELINE",
              user_input: userInput.p3 || {},
              context: { skip_confirmation: skipConfirmation }
            });
            
            results.phases.P3 = {
              status: "COMPLETED",
              snapshot_id: p3Result.snapshot_id,
              execution_time: p3Result.execution_time || 0,
              stocks_analyzed: stockCount
            };
            Logger.log(`✓ P3 完成，快照 ID：${p3Result.snapshot_id}`);
          } else {
            Logger.log("⚠ P3：Phase2_Output 表格也不存在或為空，跳過");
            results.phases.P3 = { status: "SKIPPED", reason: "P2 數據不存在（快照和表格都為空）" };
          }
        } else {
          const stocksToAnalyze = Object.keys(tierAssignments || {});
          Logger.log(`P3：將對 ${stocksToAnalyze.length} 檔股票進行技術分析`);
          
          // 批量執行 P3
          // ⭐ V8.0 修正：P3_Execute 需要 frequency 參數
          const p3Result = P3_Weekly_Execute({
            trigger: "UI_FULL_PIPELINE",
            user_input: userInput.p3 || {},
            context: { skip_confirmation: skipConfirmation }
          });
          
          results.phases.P3 = {
            status: "COMPLETED",
            snapshot_id: p3Result.snapshot_id,
            execution_time: p3Result.execution_time || 0,
            stocks_analyzed: stocksToAnalyze.length
          };
          Logger.log(`✓ P3 完成，快照 ID：${p3Result.snapshot_id}`);
        }
      }
    } catch (error) {
      Logger.log(`✗ P3 失敗：${error.message}`);
      results.phases.P3 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P3", error: error.message });
    }
    
    Utilities.sleep(1000);
    
    // Phase 4：資金配置
    Logger.log("\n💰 Phase 4：資金配置計算");
    try {
      // 檢查 P2 和 P3 快照是否存在
      const p2Snapshot = getLatestP2Snapshot();
      const p3Snapshot = getLatestP3Snapshot();
      
      if (!p2Snapshot || !p3Snapshot) {
        const missingSnapshots = [];
        if (!p2Snapshot) missingSnapshots.push("P2");
        if (!p3Snapshot) missingSnapshots.push("P3");
        
        Logger.log(`⚠ P4：缺少必要的快照數據：${missingSnapshots.join(", ")} 快照不存在，跳過`);
        results.phases.P4 = { 
          status: "SKIPPED", 
          reason: `缺少必要的快照數據：${missingSnapshots.join(", ")} 快照不存在` 
        };
      } else {
        // 檢查 P4 配置參數
        if (!P4_CONFIG || !P4_CONFIG.total_capital) {
          Logger.log("⚠ P4：P4_CONFIG.total_capital 未設定，使用預設值 10000000");
          // 設定預設值（如果 P4_CONFIG 不存在）
          if (typeof P4_CONFIG === 'undefined') {
            // P4_CONFIG 應該在 10_P4_CALCULATOR.js 中定義，這裡只是警告
            Logger.log("警告：P4_CONFIG 未定義，P4 可能無法正常執行");
          }
        }
        
        const p4Result = P4_Calculate({
          trigger: "UI_FULL_PIPELINE",
          reason: "一鍵執行完整流程",
          context: { skip_confirmation: skipConfirmation }
        });
        
        results.phases.P4 = {
          status: "COMPLETED",
          snapshot_id: p4Result.snapshot_id,
          execution_time: p4Result.execution_time || 0
        };
        Logger.log(`✓ P4 完成，快照 ID：${p4Result.snapshot_id}`);
      }
    } catch (error) {
      Logger.log(`✗ P4 失敗：${error.message}`);
      Logger.log(`P4 錯誤堆疊：${error.stack || "無"}`);
      results.phases.P4 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P4", error: error.message });
    }
    
    // 計算總執行時間
    results.total_time = Date.now() - startTime;
    results.status = results.errors.length === 0 ? "COMPLETED" : "PARTIAL";
    
    // 更新 UI 控制面板狀態
    updateUIControlPanel("last_full_pipeline_execution", {
      timestamp: new Date().toISOString(),
      status: results.status,
      total_time: results.total_time,
      phases: results.phases
    });
    
    Logger.log("\n" + "=".repeat(60));
    Logger.log(`🎉 完整流程執行完成（總時間：${(results.total_time / 1000).toFixed(1)} 秒）`);
    Logger.log("=".repeat(60));
    
    return results;
    
  } catch (error) {
    Logger.log(`✗ 完整流程執行失敗：${error.message}`);
    return {
      status: "FAILED",
      error: error.message,
      total_time: Date.now() - startTime
    };
  }
}

// ==========================================
// UI 控制面板狀態管理
// ==========================================

/**
 * 更新 UI 控制面板狀態
 * 
 * @param {string} key - 狀態鍵
 * @param {*} value - 狀態值
 */
function updateUIControlPanel(key, value) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("UI_CONTROL_PANEL");
    
    if (!sheet) {
      // 如果表格不存在，創建它
      sheet = ss.insertSheet("UI_CONTROL_PANEL");
      sheet.appendRow(UI_CONTROL_PANEL_SCHEMA.headers);
      sheet.setFrozenRows(1);
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    // 查找現有記錄
    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        // 更新現有記錄
        sheet.getRange(i + 1, 2).setValue(JSON.stringify(value));
        sheet.getRange(i + 1, 3).setValue(new Date());
        found = true;
        break;
      }
    }
    
    if (!found) {
      // 添加新記錄
      sheet.appendRow([key, JSON.stringify(value), new Date()]);
    }
  } catch (error) {
    Logger.log(`更新 UI 控制面板狀態失敗：${error.message}`);
  }
}

/**
 * 獲取 UI 控制面板狀態
 * 
 * @param {string} key - 狀態鍵
 * @returns {*} 狀態值
 */
function getUIControlPanelStatus(key) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("UI_CONTROL_PANEL");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        try {
          return JSON.parse(rows[i][1]);
        } catch (e) {
          return rows[i][1];
        }
      }
    }
    
    return null;
  } catch (error) {
    Logger.log(`獲取 UI 控制面板狀態失敗：${error.message}`);
    return null;
  }
}

/**
 * 獲取系統狀態摘要（供 UI 調用）
 * ⭐ V8.0 更新：加入 P2.5、P5.4、P5.9 狀態
 * 
 * @returns {Object} status - 系統狀態
 */
function getSystemStatus() {
  try {
    const status = {
      last_full_pipeline: getUIControlPanelStatus("last_full_pipeline_execution"),
      last_p5_daily: null,
      defcon: getCurrentDEFCON(),
      p4_6_triggered: isP4_6Triggered(),
      pending_strategies: getPendingStrategiesCount(),
      emergency_notifications: getEmergencyNotificationsCount(),
      // ⭐ V8.0 新增
      p2_5_available: false,  // P2.5 快照是否存在
      p5_4_alerts: 0,  // P5.4 警報數量
      p5_9_bubble_stage: null,  // P5.9 泡沫階段
      current_u: null,  // 當前 U（總資金水位）
      timestamp: new Date().toISOString()
    };
    
    // 嘗試獲取最後 P5 Daily 日期
    try {
      const lastP5Daily = getLastP5DailyDate();
      if (lastP5Daily) {
        status.last_p5_daily = lastP5Daily;
      }
    } catch (e) {
      // 忽略錯誤
    }
    
    // ⭐ V8.0：檢查 P2.5 快照是否存在
    try {
      const p2_5Snapshot = getLatestP2_5Snapshot();
      status.p2_5_available = !!p2_5Snapshot;
    } catch (e) {
      // 忽略錯誤
    }
    
    // ⭐ V8.0：檢查 P5.4 警報
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const p5DailySheet = ss.getSheetByName("P5__DAILY_STATUS");
      
      if (p5DailySheet && p5DailySheet.getLastRow() > 1) {
        const lastRow = p5DailySheet.getLastRow();
        const headers = p5DailySheet.getRange(1, 1, 1, p5DailySheet.getLastColumn()).getValues()[0];
        const row = p5DailySheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
        
        const alertsJsonCol = headers.indexOf("alerts_json");
        if (alertsJsonCol !== -1 && row[alertsJsonCol]) {
          try {
            const alerts = typeof row[alertsJsonCol] === 'string' ? 
              JSON.parse(row[alertsJsonCol]) : row[alertsJsonCol];
            
            status.p5_4_alerts = (alerts.volatility_alerts?.length || 0) + 
                                (alerts.black_swan_news?.length || 0);
          } catch (e) {
            // 忽略解析錯誤
          }
        }
      }
    } catch (e) {
      // 忽略錯誤
    }
    
    // ⭐ V8.0：檢查 P5.9 泡沫監控結果（從 P5 Weekly 快照讀取）
    try {
      const p5WeeklySnapshot = getLatestP5WeeklySnapshot();
      if (p5WeeklySnapshot && p5WeeklySnapshot.bubble_result_json) {
        try {
          const bubbleResult = typeof p5WeeklySnapshot.bubble_result_json === 'string' ?
            JSON.parse(p5WeeklySnapshot.bubble_result_json) : p5WeeklySnapshot.bubble_result_json;
          
          status.p5_9_bubble_stage = bubbleResult.bubble_stage || null;
        } catch (e) {
          // 忽略解析錯誤
        }
      }
      
      // 從 P5 Weekly 快照讀取 U 調整
      if (p5WeeklySnapshot && p5WeeklySnapshot.u_adjustment_json) {
        try {
          const uAdjustment = typeof p5WeeklySnapshot.u_adjustment_json === 'string' ?
            JSON.parse(p5WeeklySnapshot.u_adjustment_json) : p5WeeklySnapshot.u_adjustment_json;
          
          status.current_u = uAdjustment.new_u || uAdjustment.current_u || null;
        } catch (e) {
          // 忽略解析錯誤
        }
      }
      
      // 如果沒有從快照讀取到 U，嘗試從 PropertiesService 讀取
      if (!status.current_u) {
        try {
          status.current_u = getCurrentU();
        } catch (e) {
          // 忽略錯誤
        }
      }
    } catch (e) {
      // 忽略錯誤
    }
    
    return status;
  } catch (error) {
    Logger.log(`獲取系統狀態失敗：${error.message}`);
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 獲取待處理策略數量
 * 
 * @returns {number} count - 待處理策略數量
 */
function getPendingStrategiesCount() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P5__WEEKLY_STOCK_STRATEGIES");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return 0;
    }
    
    // 簡化實現：返回最近一週的策略數量
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const dateCol = rows[0].indexOf("date");
    
    if (dateCol === -1) {
      return 0;
    }
    
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo) {
        count++;
      }
    }
    
    return count;
  } catch (error) {
    Logger.log(`獲取待處理策略數量失敗：${error.message}`);
    return 0;
  }
}

/**
 * 獲取緊急通知數量
 * 
 * @returns {number} count - 緊急通知數量
 */
function getEmergencyNotificationsCount() {
  try {
    let count = 0;
    
    // 檢查 DEFCON
    const defcon = getCurrentDEFCON();
    if (defcon >= 3) {
      count++;
    }
    
    // 檢查 P4.6
    if (isP4_6Triggered()) {
      count++;
    }
    
    return count;
  } catch (error) {
    Logger.log(`獲取緊急通知數量失敗：${error.message}`);
    return 0;
  }
}

/**
 * UI：從 P2 開始執行（使用現有 P1 資料）⭐ V8.0 新增
 * @param {Object} options - 選項
 * @returns {Object} 執行結果
 */
function UI_ExecuteFromP2(options = {}) {
  // ⭐ 在最開始就記錄日誌，確保函數被調用時有輸出
  try {
    Logger.log("=".repeat(60));
    Logger.log("🚀 UI_ExecuteFromP2 函數開始執行");
    Logger.log("=".repeat(60));
  } catch (e) {
    // 如果 Logger 出錯，至少嘗試用其他方式記錄
    console.log("UI_ExecuteFromP2 開始執行");
  }
  
  const startTime = Date.now();
  
  try {
    Logger.log(`UI_ExecuteFromP2 參數：${JSON.stringify(options)}`);
    const skipConfirmation = options.skip_user_confirmation !== false;
    const userInput = options.user_input || {};
    
    const results = {
      phases: {},
      total_time: 0,
      status: "RUNNING",
      errors: []
    };
    
    // 檢查 P1 資料是否存在
    Logger.log("\n📋 檢查 P1 資料...");
    const p1Snapshot = getLatestP1Snapshot();
    
    if (!p1Snapshot) {
      throw new Error("P1 快照不存在，請先執行 P0 → P1");
    }
    
    // 檢查 Master_Candidates 是否存在
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName("Phase1_Master_Candidates");
    
    if (!masterSheet || masterSheet.getLastRow() <= 1) {
      throw new Error("Phase1_Master_Candidates 表格不存在或為空，請先執行 P1");
    }
    
    const masterCount = masterSheet.getLastRow() - 1;
    Logger.log(`✓ 找到 P1 資料：${masterCount} 檔 Master Candidates`);
    
    // Phase 2.5：機構級籌碼分析（可選）
    Logger.log("\n💰 Phase 2.5：機構級籌碼分析（可選）");
    try {
      const p2Snapshot = getLatestP2Snapshot();
      if (p2Snapshot) {
        const p2_5Result = P2_5_Quarterly_Execute({
          trigger: "UI_FROM_P2",
          context: { skip_confirmation: skipConfirmation }
        });
        
        if (p2_5Result.status === "SUBMITTED" && p2_5Result.job_id) {
          Logger.log(`P2.5 任務已提交到 M0 Job Queue（可選，可能因缺少數據而跳過）`);
          results.phases.P2_5 = {
            status: "SUBMITTED",
            job_id: p2_5Result.job_id,
            message: "P2.5 已提交（可選模組）"
          };
        } else {
          results.phases.P2_5 = {
            status: p2_5Result.status || "SKIPPED",
            message: p2_5Result.message || "P2.5 跳過（可能缺少籌碼面數據）"
          };
        }
      } else {
        results.phases.P2_5 = { status: "SKIPPED", reason: "P2 快照不存在（P2.5 需要 P2 先完成）" };
      }
    } catch (error) {
      Logger.log(`⚠ P2.5 執行失敗（可選模組，不影響主流程）：${error.message}`);
      results.phases.P2_5 = { status: "SKIPPED", reason: error.message };
    }
    
    Utilities.sleep(1000);
    
    // Phase 2：基本面分析
    Logger.log("\n📈 Phase 2：基本面分析");
    try {
      Logger.log(`P2：將對 ${masterCount} 檔股票進行基本面分析`);
      Logger.log(`P2 調試：準備調用 P2_Quarterly_Execute`);
      
      const p2Result = P2_Quarterly_Execute({
        trigger: "UI_FROM_P2",
        user_input: userInput.p2 || {},
        context: { skip_confirmation: skipConfirmation }
      });
      
      Logger.log(`P2 調試：P2_Quarterly_Execute 返回，status=${p2Result.status || "未設置"}`);
      
      // 如果返回的是 SUBMITTED 狀態，需要等待 M0 執行完成
      if (p2Result.status === "SUBMITTED" && p2Result.job_id) {
        Logger.log(`P2 任務已提交到 M0 Job Queue，等待執行完成...`);
        const snapshotId = waitForM0JobAndGetSnapshot(p2Result.job_id, "P2", 10 * 60 * 1000);
        if (!snapshotId) {
          throw new Error("P2 執行超時或失敗，無法獲取快照 ID");
        }
        results.phases.P2 = {
          status: "COMPLETED",
          snapshot_id: snapshotId,
          job_id: p2Result.job_id,
          execution_time: 0,
          stocks_analyzed: masterCount
        };
        Logger.log(`✓ P2 完成，快照 ID：${snapshotId}`);
      } else if (p2Result.snapshot_id) {
        results.phases.P2 = {
          status: "COMPLETED",
          snapshot_id: p2Result.snapshot_id,
          execution_time: p2Result.execution_time || 0,
          stocks_analyzed: masterCount
        };
        Logger.log(`✓ P2 完成，快照 ID：${p2Result.snapshot_id}`);
      } else {
        results.phases.P2 = {
          status: p2Result.status || "UNKNOWN",
          message: p2Result.message || "未知狀態"
        };
        Logger.log(`⚠ P2 狀態：${p2Result.status || "UNKNOWN"}`);
      }
    } catch (error) {
      Logger.log(`✗ P2 失敗：${error.message}`);
      Logger.log(`✗ P2 錯誤堆疊：${error.stack || "無堆疊資訊"}`);
      results.phases.P2 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P2", error: error.message });
    }
    
    Utilities.sleep(1000);
    
    // Phase 3：技術分析
    Logger.log("\n📊 Phase 3：技術分析");
    try {
      const p2Snapshot = getLatestP2Snapshot();
      
      if (!p2Snapshot) {
        Logger.log("⚠ P3：P2 快照不存在，跳過");
        results.phases.P3 = { status: "SKIPPED", reason: "P2 快照不存在" };
      } else {
        const p3Result = P3_Weekly_Execute({
          trigger: "UI_FROM_P2",
          frequency: "WEEKLY",
          user_input: userInput.p3 || {},
          context: { skip_confirmation: skipConfirmation }
        });
        
        if (p3Result.status === "SUBMITTED" && p3Result.job_id) {
          Logger.log(`P3 任務已提交到 M0 Job Queue，等待執行完成...`);
          const snapshotId = waitForM0JobAndGetSnapshot(p3Result.job_id, "P3", 10 * 60 * 1000);
          if (!snapshotId) {
            throw new Error("P3 執行超時或失敗，無法獲取快照 ID");
          }
          results.phases.P3 = {
            status: "COMPLETED",
            snapshot_id: snapshotId,
            job_id: p3Result.job_id,
            execution_time: 0
          };
          Logger.log(`✓ P3 完成，快照 ID：${snapshotId}`);
        } else if (p3Result.snapshot_id) {
          results.phases.P3 = {
            status: "COMPLETED",
            snapshot_id: p3Result.snapshot_id,
            execution_time: p3Result.execution_time || 0
          };
          Logger.log(`✓ P3 完成，快照 ID：${p3Result.snapshot_id}`);
        } else {
          results.phases.P3 = {
            status: p3Result.status || "UNKNOWN",
            message: p3Result.message || "未知狀態"
          };
          Logger.log(`⚠ P3 狀態：${p3Result.status || "UNKNOWN"}`);
        }
      }
    } catch (error) {
      Logger.log(`✗ P3 失敗：${error.message}`);
      results.phases.P3 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P3", error: error.message });
    }
    
    Utilities.sleep(1000);
    
    // Phase 4：資金配置計算
    Logger.log("\n💰 Phase 4：資金配置計算");
    try {
      const p2Snapshot = getLatestP2Snapshot();
      const p3Snapshot = getLatestP3Snapshot();
      
      if (!p2Snapshot || !p3Snapshot) {
        Logger.log("⚠ P4：缺少必要的快照數據：P2, P3 快照不存在，跳過");
        results.phases.P4 = { 
          status: "SKIPPED", 
          reason: `缺少快照：P2=${!!p2Snapshot}, P3=${!!p3Snapshot}` 
        };
      } else {
        const p4Result = P4_Calculate({
          trigger: "UI_FROM_P2",
          reason: "UI 從 P2 開始執行"
        });
        
        results.phases.P4 = {
          status: "COMPLETED",
          snapshot_id: p4Result.snapshot_id,
          execution_time: 0
        };
        Logger.log(`✓ P4 完成，快照 ID：${p4Result.snapshot_id}`);
      }
    } catch (error) {
      Logger.log(`✗ P4 失敗：${error.message}`);
      results.phases.P4 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P4", error: error.message });
    }
    
    // 計算總時間
    results.total_time = Date.now() - startTime;
    results.status = results.errors.length > 0 ? "PARTIAL" : "COMPLETED";
    
    Logger.log("=".repeat(60));
    Logger.log("🎉 從 P2 開始執行完成（總時間：" + (results.total_time / 1000).toFixed(1) + " 秒）");
    Logger.log("=".repeat(60));
    
    return results;
  } catch (error) {
    Logger.log(`✗ UI 從 P2 開始執行失敗：${error.message}`);
    Logger.log(`✗ 錯誤堆疊：${error.stack || "無堆疊資訊"}`);
    
    // 確保錯誤被記錄
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const errorSheet = ss.getSheetByName("UI_ERROR_LOG") || ss.insertSheet("UI_ERROR_LOG");
      errorSheet.appendRow([
        new Date(),
        "UI_ExecuteFromP2",
        error.message,
        error.stack || "無堆疊資訊"
      ]);
    } catch (e) {
      // 忽略記錄錯誤的錯誤
    }
    
    return {
      status: "FAILED",
      error: error.message,
      phases: {},
      total_time: Date.now() - startTime
    };
  }
}
