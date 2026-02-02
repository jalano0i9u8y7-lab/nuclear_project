/**
 * 🧨 決策權限憲法檢查系統（SSOT）
 * 
 * 當 P0–P5、DEFCON、泡沫、財報戰爭、對沖模組彼此衝突時
 * 系統必須有唯一不歧義的裁決順序
 * 
 * 優先級順序（不可變更）：
 * 1. 第一層：系統級生存權（DEFCON、P4.6、風險引擎）
 * 2. 第二層：市場狀態（泡沫導航、產業鏈週期、宏觀流動性）
 * 3. 第三層：機構行為（13F、Dark Pool、Options Flow）
 * 4. 第四層：財報戰爭（P5.5）
 * 5. 第五層：供應鏈分析（P5.7）
 * 6. 第六層：交易引擎（P0–P5）
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// 決策權限檢查主函數
// ==========================================

/**
 * 檢查決策權限（所有 Phase 執行前必須調用）
 * 
 * @param {Object} signal - 交易信號
 * @param {string} signal.action - 動作（"BUY", "SELL", "HOLD", "REDUCE"）
 * @param {string} signal.type - 類型（"GROWTH", "VALUE", "DEFENSIVE"）
 * @param {number} signal.weight - 權重（0-1）
 * @param {string} signal.ticker - 股票代碼
 * @param {Object} context - 上下文
 * @param {number} context.defcon - DEFCON 等級（1-5）
 * @param {boolean} context.p4_6_triggered - P4.6 是否觸發
 * @param {Object} context.risk_engine - 風險引擎狀態
 * @param {string} context.bubble_status - 泡沫狀態（"LOW", "MID", "HIGH"）
 * @param {string} context.regime - 市場狀態（"BULL", "BEAR", "TRANSITION"）
 * @param {string} context.liquidity_status - 流動性狀態（"NORMAL", "TIGHT", "LOOSE"）
 * @param {Object} context.institutional_data - 機構數據
 * @param {number} context.days_to_earnings - 距離財報天數
 * @param {Object} context.supply_chain_risk - 供應鏈風險
 * @returns {Object} decision - 決策結果
 */
function checkDecisionHierarchy(signal, context) {
  const decision = {
    allowed: true,
    adjusted_signal: { ...signal },
    reasons: [],
    conflicts: [],
    warnings: []
  };
  
  // ========================================
  // 第一層：系統級生存權（不可違反）
  // ========================================
  
  // 規則 S1：DEFCON >= 3 時禁止加碼
  if (context.defcon >= 3 && signal.action === "BUY") {
    decision.allowed = false;
    decision.reasons.push(`規則 S1：DEFCON ${context.defcon} >= 3，禁止加碼`);
    decision.conflicts.push({
      layer: 1,
      rule: "S1",
      conflict: "DEFCON vs BUY signal",
      resolution: "DEFCON 優先，禁止加碼"
    });
    decision.adjusted_signal.action = "HOLD";
    decision.adjusted_signal.weight = 0;
    return decision;  // 第一層否決，直接返回
  }
  
  // 規則 S2：P4.6 觸發時強制清倉
  if (context.p4_6_triggered) {
    decision.allowed = false;
    decision.reasons.push("規則 S2：P4.6 緊急撤退觸發，所有信號作廢");
    decision.conflicts.push({
      layer: 1,
      rule: "S2",
      conflict: "P4.6 vs all signals",
      resolution: "P4.6 優先，強制清倉"
    });
    decision.adjusted_signal.action = "REDUCE";
    decision.adjusted_signal.weight = 0;
    return decision;  // 第一層否決，直接返回
  }
  
  // 規則 S3：風險引擎觸發時降倉/鎖倉
  if (context.risk_engine && context.risk_engine.triggered) {
    const riskReason = context.risk_engine.reason || "風險引擎觸發";
    decision.allowed = false;
    decision.reasons.push(`規則 S3：${riskReason}，暫停新開倉`);
    decision.conflicts.push({
      layer: 1,
      rule: "S3",
      conflict: "風險引擎 vs signal",
      resolution: "風險引擎優先，降倉/鎖倉"
    });
    decision.adjusted_signal.action = signal.action === "BUY" ? "HOLD" : signal.action;
    decision.adjusted_signal.weight = 0;
    return decision;  // 第一層否決，直接返回
  }
  
  // ========================================
  // 第二層：市場狀態（Regime）
  // ========================================
  
  // 規則 R1：泡沫狀態 = 高時，降低成長股權重
  if (context.bubble_status === "HIGH" && signal.type === "GROWTH") {
    decision.adjusted_signal.weight *= 0.5;  // 降權 50%
    decision.reasons.push("規則 R1：泡沫狀態 = 高，成長股權重降 50%");
    decision.warnings.push("禁止新增高估值標的");
  }
  
  // 規則 R2：Regime = 轉換期時，需要對沖驗證
  if (context.regime === "TRANSITION") {
    // 檢查是否通過 P4.5 對沖驗證
    const hedgingVerified = context.hedging_verified || false;
    if (!hedgingVerified && signal.action === "BUY") {
      decision.adjusted_signal.weight *= 0.5;  // 降權 50%
      decision.reasons.push("規則 R2：Regime = 轉換期，未通過對沖驗證，權重降 50%");
      decision.warnings.push("建議通過 P4.5 對沖驗證後再加碼");
    }
  }
  
  // 規則 R3：流動性緊縮時，降低 U
  if (context.liquidity_status === "TIGHT") {
    decision.adjusted_signal.weight *= 0.8;  // 降權 20%
    decision.reasons.push("規則 R3：流動性緊縮，權重降 20%");
    decision.warnings.push("需要額外 20% 流動性緩衝");
  }
  
  // ========================================
  // 第三層：機構行為（真正的 Alpha）
  // ========================================
  
  if (context.institutional_data) {
    const instData = context.institutional_data;
    
    // 規則 A1：13F 滯後陷阱修正
    // 如果 13F 顯示買入，但 Dark Pool / Options Flow 顯示賣出 → 標記分歧
    const divergence = checkInstitutionalDivergence(instData);
    if (divergence.has_divergence) {
      if (signal.action === "BUY") {
        decision.allowed = false;
        decision.reasons.push("規則 A1：機構行為分歧，禁止加碼（只允許試單）");
        decision.conflicts.push({
          layer: 3,
          rule: "A1",
          conflict: "13F vs Dark Pool/Options Flow",
          resolution: "標記分歧，禁止加碼"
        });
        decision.adjusted_signal.action = "HOLD";
        decision.adjusted_signal.weight = 0;
        return decision;  // 第三層否決，直接返回
      }
    }
    
    // 規則 A2：機構買 + 價格上行 + Options 支持 → 權重 ×2
    if (instData.institutional_buy && instData.price_trend === "UP" && instData.options_support) {
      decision.adjusted_signal.weight *= 2.0;
      decision.reasons.push("規則 A2：機構買 + 價格上行 + Options 支持，權重 ×2");
    }
    
    // 規則 A3：機構賣 + 價格下行 + Options 支持 → 權重 ×0.5
    if (instData.institutional_sell && instData.price_trend === "DOWN" && instData.options_support) {
      decision.adjusted_signal.weight *= 0.5;
      decision.reasons.push("規則 A3：機構賣 + 價格下行 + Options 支持，權重 ×0.5，建議減碼或對沖");
    }
    
    // 規則 A4：Dark Pool vs Lit Market 分歧 > 20% → 觸發 DEFCON +5
    if (instData.dark_pool_divergence && instData.dark_pool_divergence > 0.20) {
      decision.warnings.push("規則 A4：Dark Pool vs Lit Market 分歧 > 20%，建議觸發 DEFCON +5");
      decision.adjusted_signal.weight *= 0.5;  // 降權 50%
      decision.reasons.push("Dark Pool 異常，暫停相關標的的新開倉");
    }
  }
  
  // ========================================
  // 第四層：財報戰爭（P5.5）
  // ========================================
  
  // 規則 E1：距離財報 < 10 交易日時，需要 P5.5 認證
  if (context.days_to_earnings !== undefined && context.days_to_earnings < 10) {
    const earningsVerified = context.earnings_verified || false;
    if (!earningsVerified && signal.action === "BUY") {
      decision.allowed = false;
      decision.reasons.push("規則 E1：距離財報 < 10 交易日，未通過 P5.5 認證，禁止裸多");
      decision.conflicts.push({
        layer: 4,
        rule: "E1",
        conflict: "財報風險 vs BUY signal",
        resolution: "需要 P5.5 認證或使用對沖結構"
      });
      decision.adjusted_signal.action = "HOLD";
      decision.adjusted_signal.weight = 0;
      decision.warnings.push("建議使用 Options / 對沖結構");
      return decision;  // 第四層否決，直接返回
    }
  }
  
  // 規則 E2：不對稱風險（預期波動率 > 30%）→ 禁止裸多
  if (context.earnings_volatility && context.earnings_volatility > 0.30) {
    if (signal.action === "BUY" && !context.hedging_structure) {
      decision.allowed = false;
      decision.reasons.push("規則 E2：財報不對稱風險（波動率 > 30%），禁止裸多");
      decision.conflicts.push({
        layer: 4,
        rule: "E2",
        conflict: "不對稱風險 vs BUY signal",
        resolution: "必須使用對沖結構（Collar / Protective Put）"
      });
      decision.adjusted_signal.action = "HOLD";
      decision.adjusted_signal.weight = 0;
      return decision;  // 第四層否決，直接返回
    }
  }
  
  // 規則 E3：財報前 7 天，機構大幅減倉 → 自動減倉 50%
  if (context.days_to_earnings !== undefined && context.days_to_earnings < 7) {
    if (context.institutional_data && context.institutional_data.major_reduction) {
      decision.adjusted_signal.weight *= 0.5;
      decision.reasons.push("規則 E3：財報前 7 天，機構大幅減倉，自動減倉 50%");
      decision.warnings.push("轉為觀察模式");
    }
  }
  
  // ========================================
  // 第五層：供應鏈分析（P5.7）
  // ========================================
  
  if (context.supply_chain_risk) {
    const scRisk = context.supply_chain_risk;
    
    // 規則 SC1：存貨周轉天數異常 → 標記泡沫前兆
    if (scRisk.inventory_days_anomaly) {
      decision.adjusted_signal.weight *= 0.5;  // 降權 50%
      decision.reasons.push("規則 SC1：存貨周轉天數異常，標記泡沫破裂前兆，降權 50%");
      decision.warnings.push("觸發 P5.6 泡沫導航重新評估");
    }
    
    // 規則 SC2：供應鏈中斷風險 > 高 → 降權 30%
    if (scRisk.disruption_risk === "HIGH") {
      decision.adjusted_signal.weight *= 0.7;  // 降權 30%
      decision.reasons.push("規則 SC2：供應鏈中斷風險 = 高，降權 30%");
      decision.warnings.push("增加對沖比例");
    }
  }
  
  // ========================================
  // 第六層：交易引擎（P0–P5）
  // ========================================
  
  // 規則 T1：P5 是最後一層，必須通過所有 Gate
  // （這個檢查在 Phase 執行流程中完成，這裡只記錄）
  
  // 規則 T2：當 P5 說 Bull，但 DEFCON=3 時 → DEFCON 贏
  // （已在第一層處理）
  
  // 規則 T3：當 P4 算加碼，但 P4.6 說撤退時 → P4.6 贏
  // （已在第一層處理）
  
  // ========================================
  // 記錄衝突日誌
  // ========================================
  
  if (decision.conflicts.length > 0) {
    logDecisionConflict(signal, context, decision);
  }
  
  // 確保權重不超過 1.0
  if (decision.adjusted_signal.weight > 1.0) {
    decision.adjusted_signal.weight = 1.0;
  }
  
  // 確保權重不小於 0
  if (decision.adjusted_signal.weight < 0) {
    decision.adjusted_signal.weight = 0;
  }
  
  return decision;
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 檢查機構行為分歧
 * 
 * @param {Object} instData - 機構數據
 * @returns {Object} divergence - 分歧信息
 */
function checkInstitutionalDivergence(instData) {
  const divergence = {
    has_divergence: false,
    details: []
  };
  
  // 13F 顯示買入，但 Dark Pool / Options Flow 顯示賣出
  if (instData.f13f_buy && (instData.dark_pool_sell || instData.options_flow_sell)) {
    divergence.has_divergence = true;
    divergence.details.push({
      type: "13F vs Dark Pool/Options Flow",
      f13f: "BUY",
      dark_pool: instData.dark_pool_sell ? "SELL" : "NEUTRAL",
      options_flow: instData.options_flow_sell ? "SELL" : "NEUTRAL"
    });
  }
  
  // 13F 顯示賣出，但 Dark Pool / Options Flow 顯示買入
  if (instData.f13f_sell && (instData.dark_pool_buy || instData.options_flow_buy)) {
    divergence.has_divergence = true;
    divergence.details.push({
      type: "13F vs Dark Pool/Options Flow",
      f13f: "SELL",
      dark_pool: instData.dark_pool_buy ? "BUY" : "NEUTRAL",
      options_flow: instData.options_flow_buy ? "BUY" : "NEUTRAL"
    });
  }
  
  return divergence;
}

/**
 * 記錄決策衝突日誌
 * 
 * @param {Object} signal - 原始信號
 * @param {Object} context - 上下文
 * @param {Object} decision - 決策結果
 */
function logDecisionConflict(signal, context, decision) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName("DECISION_CONFLICT_LOG");
    
    if (!logSheet) {
      logSheet = ss.insertSheet("DECISION_CONFLICT_LOG");
      logSheet.appendRow([
        "timestamp",
        "ticker",
        "original_signal",
        "final_decision",
        "conflicts_json",
        "reasons_json",
        "warnings_json"
      ]);
      logSheet.setFrozenRows(1);
    }
    
    logSheet.appendRow([
      new Date(),
      signal.ticker || "N/A",
      JSON.stringify(signal),
      JSON.stringify(decision.adjusted_signal),
      JSON.stringify(decision.conflicts),
      JSON.stringify(decision.reasons),
      JSON.stringify(decision.warnings)
    ]);
    
    Logger.log(`決策衝突已記錄：ticker=${signal.ticker}, conflicts=${decision.conflicts.length}`);
  } catch (error) {
    Logger.log(`記錄決策衝突失敗：${error.message}`);
  }
}

// ==========================================
// 快速檢查函數（用於 Phase 執行前）
// ==========================================

/**
 * 快速檢查是否允許執行 Phase（簡化版）
 * 
 * @param {string} phase - Phase 名稱（"P0", "P1", "P2", "P3", "P4", "P5"）
 * @param {Object} context - 上下文（至少需要 defcon, p4_6_triggered）
 * @returns {boolean} allowed - 是否允許執行
 */
function quickCheckPhaseAllowed(phase, context) {
  // 第一層檢查：DEFCON >= 3 時，P0-P5 只能減碼或對沖
  if (context.defcon >= 3) {
    // P4 和 P5 可以執行（用於減碼或對沖），但 P0-P3 需要檢查
    if (["P0", "P1", "P2", "P3"].includes(phase)) {
      Logger.log(`快速檢查：DEFCON ${context.defcon} >= 3，${phase} 執行受限`);
      return false;  // 禁止執行（或改為只允許讀取模式）
    }
  }
  
  // P4.6 觸發時，所有 Phase 都受限
  if (context.p4_6_triggered) {
    Logger.log(`快速檢查：P4.6 緊急撤退觸發，${phase} 執行受限`);
    return false;
  }
  
  return true;
}
