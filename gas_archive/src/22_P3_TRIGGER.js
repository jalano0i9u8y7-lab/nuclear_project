/**
 * 📈 P3: 技術分析 - 下游觸發模組
 * 
 * 負責觸發下游 Phase（P4）
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// 下游觸發
// ==========================================

/**
 * 觸發下游 Phase（P4）
 * 
 * @param {string} sourcePhase - 來源 Phase（"P3"）
 * @param {Object} snapshot - 快照數據
 */
function triggerDownstreamPhasesP3(sourcePhase, snapshot) {
  if (!snapshot.changes || !snapshot.changes.has_changes) {
    Logger.log("P3：無變動，不觸發下游 Phase");
    return;
  }
  
  try {
    Logger.log("P3 變動檢測，觸發 P4");
    
    // 提取變動信息
    const changedStocks = [];
    if (snapshot.changes.changes) {
      for (const change of snapshot.changes.changes) {
        if (change.type === "CAT_CHANGES" && change.changes) {
          for (const catChange of change.changes) {
            if (catChange.ticker) {
              changedStocks.push(catChange.ticker);
            }
          }
        }
      }
    }
    
    // 調用 P4_Calculate
    const p4Params = {
      trigger: "P3_AUTO_TRIGGER",
      reason: `P3 Cat 變動觸發（來源：${sourcePhase}）`,
      changed_stocks: changedStocks.length > 0 ? changedStocks : undefined,
      p3_snapshot_id: snapshot.snapshot_id || null
    };
    
    Logger.log(`P3：觸發 P4，參數：${JSON.stringify(p4Params)}`);
    
    // 調用 P4 計算函數
    const p4Result = P4_Calculate(p4Params);
    
    Logger.log(`P4 計算完成：snapshot_id=${p4Result.snapshot_id || "N/A"}`);
    
    return {
      triggered: true,
      target_phase: "P4",
      p4_result: p4Result
    };
    
  } catch (error) {
    Logger.log(`P3 觸發 P4 失敗：${error.message}`);
    
    // 如果直接調用失敗，嘗試將任務加入 M0 Job Queue
    try {
      const jobId = submitToM0JobQueue("P4", ["MANUAL"], {
        phase: "P4",
        trigger: "P3_AUTO_TRIGGER",
        reason: `P3 Cat 變動觸發（來源：${sourcePhase}）`,
        p3_snapshot_id: snapshot.snapshot_id || null,
        changed_stocks: snapshot.changes.changes || []
      });
      
      Logger.log(`P3：已將 P4 任務加入 M0 Job Queue：job_id=${jobId}`);
      
      return {
        triggered: true,
        target_phase: "P4",
        method: "M0_JOB_QUEUE",
        job_id: jobId
      };
    } catch (queueError) {
      Logger.log(`P3：將 P4 任務加入 M0 Job Queue 也失敗：${queueError.message}`);
      throw queueError;
    }
  }
}
