/**
 * 🧪 簡化測試腳本
 * 
 * 按照用戶要求進行簡化測試：
 * 1. P0-0.7: 隨便找一個符合計劃案要求的產業，觀察兩個模型的交互分析審查
 * 2. P1: 繼承 P0 的產業，隨便找五間公司，進入公司對位判斷，觀察兩個模型的交互分析審查
 * 3. P2-P4: 用這五間公司當範例，看最終結果是否正常
 * 4. P5: 測試各項功能（若有需要用到或監測到 P0-P4 成果的，一樣就用上面五間公司當範例）
 * 
 * @version V7.1_TEST
 * @date 2025-01-13
 */

/**
 * 執行簡化測試流程
 */
function runSimplifiedTest() {
  Logger.log("=".repeat(60));
  Logger.log("🧪 開始簡化測試流程");
  Logger.log("=".repeat(60));
  
  const results = {
    phases: {},
    errors: [],
    start_time: new Date()
  };
  
  try {
    // ========================================
    // Step 1: P0 - 產業工程學分析（簡化版）
    // ========================================
    Logger.log("\n📊 Step 1: P0 - 產業工程學分析（簡化版）");
    Logger.log("目標：隨便找一個符合計劃案要求的產業");
    
    try {
      const p0Result = P0_Execute({
        trigger: "TEST",
        user_input: {
          theme_focus: "AI/半導體/新能源",  // 簡化：指定一個產業方向
          geographic_focus: "ALL",
          time_horizon: "MEDIUM"
        },
        context: { 
          skip_confirmation: true,
          test_mode: true  // 標記為測試模式
        }
      });
      
      if (p0Result.status === "SUBMITTED" && p0Result.job_id) {
        Logger.log(`P0 任務已提交，等待執行完成...`);
        const snapshotId = waitForM0JobAndGetSnapshot(p0Result.job_id, "P0", 10 * 60 * 1000);
        if (snapshotId) {
          results.phases.P0 = { status: "COMPLETED", snapshot_id: snapshotId };
          Logger.log(`✓ P0 完成，快照 ID：${snapshotId}`);
        } else {
          throw new Error("P0 執行超時或失敗");
        }
      } else {
        results.phases.P0 = { status: p0Result.status || "UNKNOWN", message: p0Result.message };
      }
    } catch (error) {
      Logger.log(`✗ P0 失敗：${error.message}`);
      results.phases.P0 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P0", error: error.message });
      throw error;  // P0 失敗，停止測試
    }
    
    Utilities.sleep(2000);
    
    // ========================================
    // Step 2: P0.7 - 系統動力學分析（簡化版）
    // ========================================
    Logger.log("\n🔄 Step 2: P0.7 - 系統動力學分析（簡化版）");
    Logger.log("目標：觀察兩個模型的交互分析審查是否正常");
    
    try {
      const p0_7Result = P0_7_Execute({
        trigger: "TEST",
        user_input: {},
        context: { 
          skip_confirmation: true,
          test_mode: true
        }
      });
      
      if (p0_7Result.status === "SUBMITTED" && p0_7Result.job_id) {
        Logger.log(`P0.7 任務已提交，等待執行完成...`);
        const snapshotId = waitForM0JobAndGetSnapshot(p0_7Result.job_id, "P0_7", 10 * 60 * 1000);
        if (snapshotId) {
          results.phases.P0_7 = { status: "COMPLETED", snapshot_id: snapshotId };
          Logger.log(`✓ P0.7 完成，快照 ID：${snapshotId}`);
        } else {
          throw new Error("P0.7 執行超時或失敗");
        }
      } else {
        results.phases.P0_7 = { status: p0_7Result.status || "UNKNOWN", message: p0_7Result.message };
      }
    } catch (error) {
      Logger.log(`✗ P0.7 失敗：${error.message}`);
      results.phases.P0_7 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P0.7", error: error.message });
      throw error;  // P0.7 失敗，停止測試
    }
    
    Utilities.sleep(2000);
    
    // ========================================
    // Step 3: P1 - 公司池建立（簡化版）
    // ========================================
    Logger.log("\n🏢 Step 3: P1 - 公司池建立（簡化版）");
    Logger.log("目標：繼承 P0 的產業，隨便找五間公司，進入公司對位判斷");
    
    try {
      const p1Result = P1_Execute({
        trigger: "TEST",
        user_input: {
          max_companies: 5  // 簡化：只找 5 間公司
        },
        context: { 
          skip_confirmation: true,
          test_mode: true
        }
      });
      
      if (p1Result.status === "SUBMITTED" && p1Result.job_id) {
        Logger.log(`P1 任務已提交，等待執行完成...`);
        const snapshotId = waitForM0JobAndGetSnapshot(p1Result.job_id, "P1", 10 * 60 * 1000);
        if (snapshotId) {
          results.phases.P1 = { status: "COMPLETED", snapshot_id: snapshotId };
          Logger.log(`✓ P1 完成，快照 ID：${snapshotId}`);
        } else {
          throw new Error("P1 執行超時或失敗");
        }
      } else {
        results.phases.P1 = { status: p1Result.status || "UNKNOWN", message: p1Result.message };
      }
    } catch (error) {
      Logger.log(`✗ P1 失敗：${error.message}`);
      results.phases.P1 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P1", error: error.message });
      throw error;  // P1 失敗，停止測試
    }
    
    Utilities.sleep(2000);
    
    // ========================================
    // Step 4: P2 - 基本面分析（簡化版）
    // ========================================
    Logger.log("\n📈 Step 4: P2 - 基本面分析（簡化版）");
    Logger.log("目標：用這五間公司當範例，看最終結果是否正常");
    
    try {
      // 從 P1 快照讀取公司列表
      const p1Snapshot = getLatestP1Snapshot();
      if (!p1Snapshot || !p1Snapshot.p1_output_json) {
        throw new Error("P1 快照不存在，無法執行 P2");
      }
      
      const p1Output = typeof p1Snapshot.p1_output_json === 'string' 
        ? JSON.parse(p1Snapshot.p1_output_json)
        : p1Snapshot.p1_output_json;
      
      const masterCandidates = p1Output.master_candidates || [];
      Logger.log(`P2：將對 ${masterCandidates.length} 檔股票進行基本面分析`);
      
      if (masterCandidates.length === 0) {
        Logger.log("⚠ P2：沒有 Master Candidates，跳過");
        results.phases.P2 = { status: "SKIPPED", reason: "沒有 Master Candidates" };
      } else {
        const p2Result = P2_Quarterly_Execute({
          trigger: "TEST",
          user_input: {},
          context: { 
            skip_confirmation: true,
            test_mode: true
          }
        });
        
        results.phases.P2 = {
          status: "COMPLETED",
          snapshot_id: p2Result.snapshot_id,
          stocks_analyzed: masterCandidates.length
        };
        Logger.log(`✓ P2 完成，快照 ID：${p2Result.snapshot_id}`);
      }
    } catch (error) {
      Logger.log(`✗ P2 失敗：${error.message}`);
      results.phases.P2 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P2", error: error.message });
    }
    
    Utilities.sleep(2000);
    
    // ========================================
    // Step 5: P3 - 技術分析（簡化版）
    // ========================================
    Logger.log("\n📊 Step 5: P3 - 技術分析（簡化版）");
    
    try {
      const p2Snapshot = getLatestP2Snapshot();
      if (!p2Snapshot || !p2Snapshot.tier_assignments) {
        Logger.log("⚠ P3：P2 快照不存在，跳過");
        results.phases.P3 = { status: "SKIPPED", reason: "P2 快照不存在" };
      } else {
        const p3Result = P3_Execute({
          trigger: "TEST",
          user_input: {},
          context: { 
            skip_confirmation: true,
            test_mode: true
          }
        });
        
        results.phases.P3 = {
          status: "COMPLETED",
          snapshot_id: p3Result.snapshot_id
        };
        Logger.log(`✓ P3 完成，快照 ID：${p3Result.snapshot_id}`);
      }
    } catch (error) {
      Logger.log(`✗ P3 失敗：${error.message}`);
      results.phases.P3 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P3", error: error.message });
    }
    
    Utilities.sleep(2000);
    
    // ========================================
    // Step 6: P4 - 資金配置（簡化版）
    // ========================================
    Logger.log("\n💰 Step 6: P4 - 資金配置（簡化版）");
    
    try {
      const p4Result = P4_Calculate({
        trigger: "TEST",
        reason: "簡化測試",
        context: { 
          skip_confirmation: true,
          test_mode: true
        }
      });
      
      results.phases.P4 = {
        status: "COMPLETED",
        snapshot_id: p4Result.snapshot_id
      };
      Logger.log(`✓ P4 完成，快照 ID：${p4Result.snapshot_id}`);
    } catch (error) {
      Logger.log(`✗ P4 失敗：${error.message}`);
      results.phases.P4 = { status: "FAILED", error: error.message };
      results.errors.push({ phase: "P4", error: error.message });
    }
    
    // ========================================
    // Step 7: P5 測試（可選）
    // ========================================
    Logger.log("\n📅 Step 7: P5 測試（可選）");
    Logger.log("提示：P5 測試可以單獨執行，這裡只記錄完成狀態");
    results.phases.P5 = { status: "SKIPPED", reason: "P5 測試需單獨執行" };
    
  } catch (error) {
    Logger.log(`\n✗ 測試流程中斷：${error.message}`);
    results.errors.push({ phase: "GENERAL", error: error.message });
  }
  
  // ========================================
  // 總結
  // ========================================
  results.end_time = new Date();
  results.duration = results.end_time - results.start_time;
  
  Logger.log("\n" + "=".repeat(60));
  Logger.log("🧪 簡化測試流程完成");
  Logger.log("=".repeat(60));
  Logger.log(`總執行時間：${(results.duration / 1000).toFixed(1)} 秒`);
  Logger.log(`成功階段：${Object.values(results.phases).filter(p => p.status === "COMPLETED").length}`);
  Logger.log(`失敗階段：${Object.values(results.phases).filter(p => p.status === "FAILED").length}`);
  Logger.log(`跳過階段：${Object.values(results.phases).filter(p => p.status === "SKIPPED").length}`);
  
  if (results.errors.length > 0) {
    Logger.log("\n錯誤列表：");
    results.errors.forEach((err, idx) => {
      Logger.log(`${idx + 1}. ${err.phase}: ${err.error}`);
    });
  }
  
  return results;
}
