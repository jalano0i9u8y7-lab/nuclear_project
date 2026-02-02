/**
 * 🔍 P3 觸發式審查機制
 * 
 * 實現 Hard Trigger 和 Soft Trigger 邏輯，只對需要升級或疑似不一致的股票進行審查
 * 
 * @version SSOT V8.16
 * @date 2026-01-19
 */

// ==========================================
// P3 觸發式審查配置
// ==========================================

const P3_REVIEW_CONFIG = {
  // Soft Trigger 閾值
  SOFT_TRIGGER_THRESHOLD: 6,  // 累積分數 ≥ 6 分送審
  
  // 策略變更幅度閾值（Hard Trigger H8）
  PRICE_CHANGE_THRESHOLD: 0.08,  // 8%
  STOP_CHANGE_THRESHOLD: 0.05,   // 5%
  MAX_CAP_CHANGE_THRESHOLD: 0.30, // 30%
  
  // Gap 閾值（Hard Trigger H7）
  GAP_THRESHOLD: 0.06,  // 6%
  
  // 報酬閾值（Soft Trigger S3）
  RETURN_THRESHOLD_1: 0.08,  // 8%
  RETURN_THRESHOLD_2: 0.12,  // 12%
  
  // ATR 變化閾值（Soft Trigger S4）
  ATR_CHANGE_THRESHOLD: 0.40,  // 40%
  
  // 量能變化閾值（Soft Trigger S5）
  VOLUME_CHANGE_THRESHOLD: 1.8,  // 1.8x
};

// ==========================================
// Hard Trigger 檢查
// ==========================================

/**
 * 檢查 Hard Trigger 條件（8 條）
 * 任何一條成立 → 直接送 GPT-5.2 審查
 * 
 * @param {Object} stockData - 股票數據
 * @param {Object} executorOutput - 執行者輸出
 * @param {Object} previousSnapshot - 上週快照
 * @param {Object} p0_5_snapshot - P0.5 快照
 * @param {Object} p0_7_snapshot - P0.7 快照
 * @param {Object} p2_snapshot - P2 快照
 * @param {Object} p2_5_snapshot - P2.5 快照
 * @returns {Object} { triggered: boolean, reasons: Array<string> }
 */
function checkP3HardTriggers(stockData, executorOutput, previousSnapshot, p0_5_snapshot, p0_7_snapshot, p2_snapshot, p2_5_snapshot) {
  const reasons = [];
  const ticker = stockData.ticker || stockData.Company_Code || stockData.company_code;
  
  // H1: 輸出違反硬規則 / 不可交易狀態
  if (checkHardRuleViolations(executorOutput)) {
    reasons.push("H1: 輸出違反硬規則或不可交易狀態");
  }
  
  // H2: Cat「跳級」變動
  if (checkCatJump(executorOutput, previousSnapshot, ticker)) {
    reasons.push("H2: Cat 跳級變動");
  }
  
  // H3: risk_overlay_level 跳升
  if (checkOverlayJump(executorOutput, previousSnapshot, ticker)) {
    reasons.push("H3: risk_overlay_level 跳升");
  }
  
  // H4: 產業/宏觀風險旗標硬碰硬衝突
  if (checkMacroRiskConflict(executorOutput, p0_7_snapshot)) {
    reasons.push("H4: 產業/宏觀風險旗標硬碰硬衝突");
  }
  
  // H5: P0.5 產業鏈重大警報 + P3 卻偏進攻
  if (checkP0_5AlertConflict(executorOutput, p0_5_snapshot, ticker)) {
    reasons.push("H5: P0.5 產業鏈重大警報但 P3 偏進攻");
  }
  
  // H6: P2/P2.5 結構性風險已亮紅燈
  if (checkP2P2_5RiskConflict(executorOutput, p2_snapshot, p2_5_snapshot, ticker)) {
    reasons.push("H6: P2/P2.5 結構性風險已亮紅燈");
  }
  
  // H7: 本週發生「狀態翻轉事件」
  if (checkStateFlipEvent(stockData)) {
    reasons.push("H7: 本週發生狀態翻轉事件");
  }
  
  // H8: 「策略變更幅度過大」
  if (checkStrategyChangeTooLarge(executorOutput, previousSnapshot, ticker)) {
    reasons.push("H8: 策略變更幅度過大");
  }
  
  return {
    triggered: reasons.length > 0,
    reasons: reasons
  };
}

/**
 * H1: 檢查硬規則違反
 */
function checkHardRuleViolations(executorOutput) {
  // 檢查必要欄位
  if (!executorOutput.cat || !executorOutput.buy_ladder || !executorOutput.stop_ladder) {
    return true;
  }
  
  const buyLadder = executorOutput.buy_ladder || [];
  const stopLadder = executorOutput.stop_ladder || [];
  
  // 檢查 Buy/Stop 層級邏輯
  if (buyLadder.length >= 3 && stopLadder.length >= 2) {
    const buy3 = buyLadder[2]?.price || 0;
    const stop2 = stopLadder[1]?.price || 0;
    if (stop2 >= buy3) {
      return true;  // Stop2 ≥ Buy3（邏輯錯）
    }
  }
  
  if (buyLadder.length >= 2) {
    const buy1 = buyLadder[0]?.price || 0;
    const buy2 = buyLadder[1]?.price || 0;
    if (buy1 <= buy2) {
      return true;  // Buy1 ≤ Buy2（邏輯錯）
    }
  }
  
  // 檢查核心倉 < 50%（如果這是硬規則）
  if (executorOutput.core_position_ratio !== undefined && executorOutput.core_position_ratio < 0.5) {
    return true;
  }
  
  return false;
}

/**
 * H2: 檢查 Cat 跳級變動
 */
function checkCatJump(executorOutput, previousSnapshot, ticker) {
  if (!previousSnapshot || !previousSnapshot.technical_results) {
    return false;
  }
  
  const previousStock = previousSnapshot.technical_results[ticker];
  if (!previousStock || !previousStock.cat) {
    return false;
  }
  
  const currentCat = executorOutput.cat;
  const previousCat = previousStock.cat;
  
  // Cat 從 Cat4/Cat5 → Cat2/Cat3（保守→進攻）
  if ((previousCat === "Cat4-A" || previousCat === "Cat4-B" || previousCat === "Cat5") &&
      (currentCat === "Cat2" || currentCat === "Cat3")) {
    return true;
  }
  
  // Cat 從 Cat2/Cat3 → Cat4/Cat5（進攻→撤退）且同時伴隨其他異常
  if ((previousCat === "Cat2" || previousCat === "Cat3") &&
      (currentCat === "Cat4-A" || currentCat === "Cat4-B" || currentCat === "Cat5")) {
    // 檢查是否伴隨其他異常（例如 risk_overlay_level 上升）
    const currentOverlay = executorOutput.risk_overlay_level || 0;
    const previousOverlay = previousStock.risk_overlay_level || 0;
    if (currentOverlay > previousOverlay) {
      return true;
    }
  }
  
  return false;
}

/**
 * H3: 檢查 risk_overlay_level 跳升
 */
function checkOverlayJump(executorOutput, previousSnapshot, ticker) {
  if (!previousSnapshot || !previousSnapshot.technical_results) {
    return false;
  }
  
  const previousStock = previousSnapshot.technical_results[ticker];
  if (!previousStock) {
    return false;
  }
  
  const currentOverlay = executorOutput.risk_overlay_level || 0;
  const previousOverlay = previousStock.risk_overlay_level || 0;
  
  // overlay 從 0/1 → 3/4
  if ((previousOverlay === 0 || previousOverlay === 1) && (currentOverlay === 3 || currentOverlay === 4)) {
    return true;
  }
  
  // overlay 連續兩週上升（需要檢查更早的快照）
  // 這裡簡化處理，只檢查本週 vs 上週
  if (currentOverlay > previousOverlay && previousOverlay > 0) {
    return true;  // 簡化：如果上週已經 > 0 且本週繼續上升，視為跳升
  }
  
  return false;
}

/**
 * H4: 檢查產業/宏觀風險旗標硬碰硬衝突
 */
function checkMacroRiskConflict(executorOutput, p0_7_snapshot) {
  if (!p0_7_snapshot) {
    return false;
  }
  
  const cyclePosition = p0_7_snapshot.cycle_position;
  const turningPointRisk = p0_7_snapshot.turning_point_risk;
  const currentCat = executorOutput.cat;
  
  // P0.7=Late 或 turning_point_risk=HIGH 且 P3 給出 Cat2/Cat3
  if ((cyclePosition === "Late" || turningPointRisk === "HIGH") &&
      (currentCat === "Cat2" || currentCat === "Cat3")) {
    return true;
  }
  
  return false;
}

/**
 * H5: 檢查 P0.5 產業鏈重大警報 + P3 卻偏進攻
 */
function checkP0_5AlertConflict(executorOutput, p0_5_snapshot, ticker) {
  if (!p0_5_snapshot) {
    return false;
  }
  
  // ⭐ V8.16 修正：從 chain_dynamics_monitor_json 中提取 p5_weekly_flags
  let flags = {};
  if (p0_5_snapshot.chain_dynamics_monitor_json && p0_5_snapshot.chain_dynamics_monitor_json.handoff) {
    flags = p0_5_snapshot.chain_dynamics_monitor_json.handoff.p5_weekly_flags || {};
  } else if (p0_5_snapshot.p5_weekly_flags) {
    flags = p0_5_snapshot.p5_weekly_flags;
  }
  
  const hasAlert = flags.DIVERGENCE_ALERT === true ||
                   flags.INVENTORY_BUILD_WARNING === true ||
                   flags.PRICING_LOOSENING === true;
  
  if (!hasAlert) {
    return false;
  }
  
  // 檢查 P3 是否提高 Buy1 比例或放寬 Stop
  const buyLadder = executorOutput.buy_ladder || [];
  const buy1 = buyLadder[0];
  if (buy1 && buy1.weight_increase) {
    return true;  // 提高 Buy1 權重
  }
  
  // 檢查 Stop 是否放寬（需要對比上週）
  // 這裡簡化處理
  
  return false;
}

/**
 * H6: 檢查 P2/P2.5 結構性風險已亮紅燈
 */
function checkP2P2_5RiskConflict(executorOutput, p2_snapshot, p2_5_snapshot, ticker) {
  // 檢查 P2 Narrative_Consistency_Check
  if (p2_snapshot && p2_snapshot.tier_assignments_json) {
    const tierAssignments = typeof p2_snapshot.tier_assignments_json === 'string' ?
      JSON.parse(p2_snapshot.tier_assignments_json) : p2_snapshot.tier_assignments_json;
    const stockData = tierAssignments[ticker];
    if (stockData && stockData.Narrative_Consistency_Check !== "一致") {
      // 檢查 P3 是否提高 overlay 或轉為更保守 Cat
      const currentCat = executorOutput.cat;
      const currentOverlay = executorOutput.risk_overlay_level || 0;
      if (!(currentCat === "Cat4-A" || currentCat === "Cat4-B" || currentCat === "Cat5") && currentOverlay < 2) {
        return true;  // 沒有提高 overlay 或轉為更保守 Cat
      }
    }
  }
  
  // 檢查 P2.5 distribution_risk 或 insider_selling_alert
  if (p2_5_snapshot && p2_5_snapshot.p2_5_output_json) {
    const p2_5_output = typeof p2_5_snapshot.p2_5_output_json === 'string' ?
      JSON.parse(p2_5_snapshot.p2_5_output_json) : p2_5_snapshot.p2_5_output_json;
    const stockData = p2_5_output[ticker];
    if (stockData) {
      if (stockData.distribution_risk === "HIGH" || stockData.insider_selling_alert === true) {
        // 檢查 P3 是否提高 overlay 或轉為更保守 Cat
        const currentCat = executorOutput.cat;
        const currentOverlay = executorOutput.risk_overlay_level || 0;
        if (!(currentCat === "Cat4-A" || currentCat === "Cat4-B" || currentCat === "Cat5") && currentOverlay < 2) {
          return true;  // 沒有提高 overlay 或轉為更保守 Cat
        }
      }
    }
  }
  
  return false;
}

/**
 * H7: 檢查本週發生「狀態翻轉事件」
 */
function checkStateFlipEvent(stockData) {
  // 檢查單日 gap ≥ 6%
  if (stockData.gap_abs !== undefined && stockData.gap_abs >= P3_REVIEW_CONFIG.GAP_THRESHOLD) {
    return true;
  }
  
  // 檢查是否有財報週/重大法說/監管事件標記
  if (stockData.has_earnings_event === true ||
      stockData.has_major_conference === true ||
      stockData.has_regulatory_event === true) {
    return true;
  }
  
  return false;
}

/**
 * H8: 檢查「策略變更幅度過大」
 */
function checkStrategyChangeTooLarge(executorOutput, previousSnapshot, ticker) {
  if (!previousSnapshot || !previousSnapshot.technical_results) {
    return false;
  }
  
  const previousStock = previousSnapshot.technical_results[ticker];
  if (!previousStock) {
    return false;
  }
  
  const currentBuyLadder = executorOutput.buy_ladder || [];
  const previousBuyLadder = previousStock.buy_ladder || [];
  
  // 檢查 Buy1/Buy2/Buy3 任一價位相對上週變動 > 8%
  for (let i = 0; i < Math.min(currentBuyLadder.length, previousBuyLadder.length); i++) {
    const currentPrice = currentBuyLadder[i]?.price || 0;
    const previousPrice = previousBuyLadder[i]?.price || 0;
    if (previousPrice > 0) {
      const change = Math.abs((currentPrice - previousPrice) / previousPrice);
      if (change > P3_REVIEW_CONFIG.PRICE_CHANGE_THRESHOLD) {
        return true;
      }
    }
  }
  
  // 檢查 stop 變動 > 5%
  const currentStopLadder = executorOutput.stop_ladder || [];
  const previousStopLadder = previousStock.stop_ladder || [];
  if (currentStopLadder.length > 0 && previousStopLadder.length > 0) {
    const currentStop = currentStopLadder[0]?.price || 0;
    const previousStop = previousStopLadder[0]?.price || 0;
    if (previousStop > 0) {
      const change = Math.abs((currentStop - previousStop) / previousStop);
      if (change > P3_REVIEW_CONFIG.STOP_CHANGE_THRESHOLD) {
        return true;
      }
    }
  }
  
  // 檢查 max cap 變動 > 30%
  const currentMaxCap = executorOutput.max_position_cap || 0;
  const previousMaxCap = previousStock.max_position_cap || 0;
  if (previousMaxCap > 0) {
    const change = Math.abs((currentMaxCap - previousMaxCap) / previousMaxCap);
    if (change > P3_REVIEW_CONFIG.MAX_CAP_CHANGE_THRESHOLD) {
      return true;
    }
  }
  
  return false;
}

// ==========================================
// Soft Trigger 檢查（計分）
// ==========================================

/**
 * 計算 Soft Trigger 分數
 * 累積分數 ≥ 閾值 → 送審
 * 
 * @param {Object} stockData - 股票數據
 * @param {Object} executorOutput - 執行者輸出
 * @param {Object} previousSnapshot - 上週快照
 * @param {Object} p2_snapshot - P2 快照
 * @param {Object} p2_5_snapshot - P2.5 快照
 * @returns {Object} { score: number, reasons: Array<{rule: string, score: number, reason: string}> }
 */
function calculateP3SoftTriggerScore(stockData, executorOutput, previousSnapshot, p2_snapshot, p2_5_snapshot) {
  const reasons = [];
  let totalScore = 0;
  const ticker = stockData.ticker || stockData.Company_Code || stockData.company_code;
  
  // S1: Cat 變動 1 級
  const catChangeScore = checkCatChange(executorOutput, previousSnapshot, ticker);
  if (catChangeScore > 0) {
    totalScore += catChangeScore;
    reasons.push({ rule: "S1", score: catChangeScore, reason: "Cat 變動 1 級" });
  }
  
  // S2: risk_overlay_level 變動
  const overlayChangeScore = checkOverlayChange(executorOutput, previousSnapshot, ticker);
  if (overlayChangeScore > 0) {
    totalScore += overlayChangeScore;
    reasons.push({ rule: "S2", score: overlayChangeScore, reason: "risk_overlay_level 變動" });
  }
  
  // S3: 近 5 交易日報酬
  const returnScore = checkReturnScore(stockData);
  if (returnScore > 0) {
    totalScore += returnScore;
    reasons.push({ rule: "S3", score: returnScore, reason: `近 5 交易日報酬絕對值 ≥ ${stockData.return_5d_abs || 0}` });
  }
  
  // S4: ATR% 較上週增加
  const atrScore = checkATRChange(stockData);
  if (atrScore > 0) {
    totalScore += atrScore;
    reasons.push({ rule: "S4", score: atrScore, reason: "ATR% 較上週增加 ≥ 40%" });
  }
  
  // S5: 量能較上週增加
  const volumeScore = checkVolumeChange(stockData);
  if (volumeScore > 0) {
    totalScore += volumeScore;
    reasons.push({ rule: "S5", score: volumeScore, reason: "量能較上週增加 ≥ 1.8x" });
  }
  
  // S6: 新增「高嚴重度新聞標籤」
  const newsScore = checkHighSeverityNews(stockData);
  if (newsScore > 0) {
    totalScore += newsScore;
    reasons.push({ rule: "S6", score: newsScore, reason: "新增高嚴重度新聞標籤" });
  }
  
  // S7: 觸發 P2 的 milestones 到期但未驗證
  const milestoneScore = checkMilestoneDue(p2_snapshot, ticker);
  if (milestoneScore > 0) {
    totalScore += milestoneScore;
    reasons.push({ rule: "S7", score: milestoneScore, reason: "P2 milestones 到期但未驗證" });
  }
  
  // S8: P2.5 中等警報（MED）新增
  const p2_5Score = checkP2_5MediumAlert(p2_5_snapshot, ticker);
  if (p2_5Score > 0) {
    totalScore += p2_5Score;
    reasons.push({ rule: "S8", score: p2_5Score, reason: "P2.5 中等警報新增" });
  }
  
  return {
    score: totalScore,
    reasons: reasons,
    triggered: totalScore >= P3_REVIEW_CONFIG.SOFT_TRIGGER_THRESHOLD
  };
}

/**
 * S1: 檢查 Cat 變動 1 級
 */
function checkCatChange(executorOutput, previousSnapshot, ticker) {
  if (!previousSnapshot || !previousSnapshot.technical_results) {
    return 0;
  }
  
  const previousStock = previousSnapshot.technical_results[ticker];
  if (!previousStock || !previousStock.cat) {
    return 0;
  }
  
  const currentCat = executorOutput.cat;
  const previousCat = previousStock.cat;
  
  if (currentCat !== previousCat) {
    return 2;  // Cat 變動 1 級：+2
  }
  
  return 0;
}

/**
 * S2: 檢查 risk_overlay_level 變動
 */
function checkOverlayChange(executorOutput, previousSnapshot, ticker) {
  if (!previousSnapshot || !previousSnapshot.technical_results) {
    return 0;
  }
  
  const previousStock = previousSnapshot.technical_results[ticker];
  if (!previousStock) {
    return 0;
  }
  
  const currentOverlay = executorOutput.risk_overlay_level || 0;
  const previousOverlay = previousStock.risk_overlay_level || 0;
  const change = Math.abs(currentOverlay - previousOverlay);
  
  if (change === 1) {
    return 2;  // 變動 ±1：+2
  } else if (change >= 2) {
    return 4;  // 變動 ≥2：+4
  }
  
  return 0;
}

/**
 * S3: 檢查近 5 交易日報酬
 */
function checkReturnScore(stockData) {
  const return5d = Math.abs(stockData.return_5d_abs || 0);
  
  if (return5d >= P3_REVIEW_CONFIG.RETURN_THRESHOLD_2) {
    return 3;  // ≥12%：+3
  } else if (return5d >= P3_REVIEW_CONFIG.RETURN_THRESHOLD_1) {
    return 2;  // ≥8%：+2
  }
  
  return 0;
}

/**
 * S4: 檢查 ATR% 較上週增加
 */
function checkATRChange(stockData) {
  const atrChange = stockData.atr_change_pct || 0;
  
  if (atrChange >= P3_REVIEW_CONFIG.ATR_CHANGE_THRESHOLD) {
    return 2;  // ATR% 週增 ≥ 40%：+2
  }
  
  return 0;
}

/**
 * S5: 檢查量能較上週增加
 */
function checkVolumeChange(stockData) {
  const volumeRatio = stockData.volume_20d_ratio || 1.0;
  
  if (volumeRatio >= P3_REVIEW_CONFIG.VOLUME_CHANGE_THRESHOLD) {
    return 2;  // 量能較上週 ≥ 1.8x：+2
  }
  
  return 0;
}

/**
 * S6: 檢查新增「高嚴重度新聞標籤」
 */
function checkHighSeverityNews(stockData) {
  const highSeverityCount = stockData.high_severity_news_count || 0;
  
  if (highSeverityCount >= 1) {
    return 3;  // 新增高嚴重度新聞標籤 ≥ 1 則：+3
  }
  
  return 0;
}

/**
 * S7: 檢查觸發 P2 的 milestones 到期但未驗證
 */
function checkMilestoneDue(p2_snapshot, ticker) {
  if (!p2_snapshot || !p2_snapshot.tier_assignments_json) {
    return 0;
  }
  
  const tierAssignments = typeof p2_snapshot.tier_assignments_json === 'string' ?
    JSON.parse(p2_snapshot.tier_assignments_json) : p2_snapshot.tier_assignments_json;
  const stockData = tierAssignments[ticker];
  
  if (stockData && stockData.milestones_to_verify) {
    const milestones = Array.isArray(stockData.milestones_to_verify) ?
      stockData.milestones_to_verify : [stockData.milestones_to_verify];
    
    const today = new Date();
    for (const milestone of milestones) {
      if (milestone.due_date) {
        const dueDate = new Date(milestone.due_date);
        const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntilDue <= 30 && daysUntilDue >= 0 && milestone.status !== "MET") {
          return 2;  // 里程碑到期但未驗證：+2
        }
      }
    }
  }
  
  return 0;
}

/**
 * S8: 檢查 P2.5 中等警報（MED）新增
 */
function checkP2_5MediumAlert(p2_5_snapshot, ticker) {
  if (!p2_5_snapshot || !p2_5_snapshot.p2_5_output_json) {
    return 0;
  }
  
  const p2_5_output = typeof p2_5_snapshot.p2_5_output_json === 'string' ?
    JSON.parse(p2_5_snapshot.p2_5_output_json) : p2_5_snapshot.p2_5_output_json;
  const stockData = p2_5_output[ticker];
  
  if (stockData && stockData.distribution_risk === "MED") {
    return 2;  // P2.5 中等警報新增：+2
  }
  
  return 0;
}

// ==========================================
// 主函數：判斷是否需要審查
// ==========================================

/**
 * 判斷股票是否需要審查
 * 
 * @param {Object} stockData - 股票數據（包含 ticker、技術指標、新聞等）
 * @param {Object} executorOutput - 執行者輸出
 * @param {Object} previousSnapshot - 上週快照
 * @param {Object} p0_5_snapshot - P0.5 快照
 * @param {Object} p0_7_snapshot - P0.7 快照
 * @param {Object} p2_snapshot - P2 快照
 * @param {Object} p2_5_snapshot - P2.5 快照
 * @returns {Object} { needs_review: boolean, trigger_type: "HARD"|"SOFT"|null, reasons: Array, score: number }
 */
function shouldReviewP3Stock(stockData, executorOutput, previousSnapshot, p0_5_snapshot, p0_7_snapshot, p2_snapshot, p2_5_snapshot) {
  // 先檢查 Hard Trigger
  const hardTrigger = checkP3HardTriggers(stockData, executorOutput, previousSnapshot, p0_5_snapshot, p0_7_snapshot, p2_snapshot, p2_5_snapshot);
  
  if (hardTrigger.triggered) {
    return {
      needs_review: true,
      trigger_type: "HARD",
      reasons: hardTrigger.reasons,
      score: null
    };
  }
  
  // 再檢查 Soft Trigger
  const softTrigger = calculateP3SoftTriggerScore(stockData, executorOutput, previousSnapshot, p2_snapshot, p2_5_snapshot);
  
  if (softTrigger.triggered) {
    return {
      needs_review: true,
      trigger_type: "SOFT",
      reasons: softTrigger.reasons.map(r => `${r.rule}: ${r.reason} (${r.score}分)`),
      score: softTrigger.score
    };
  }
  
  return {
    needs_review: false,
    trigger_type: null,
    reasons: [],
    score: softTrigger.score
  };
}
