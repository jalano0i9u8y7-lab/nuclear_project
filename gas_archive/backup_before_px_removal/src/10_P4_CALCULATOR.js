/**
 * 💰 P4 資金配置計算器
 * 
 * 純計算模組（無 AI）
 * 讀取 P2/P3 最新快照，計算理想配置（W_ideal）和實際應配置（W_now）
 * 
 * @version SSOT V8.15 + V8.18
 * @date 2025-01-11
 * @changes V8.15: 新增 Position_Role → Tier 映射、Cat 權重兩層修正、U 優先級、FRONTIER Runway 處理、Time_Window_Penalty 整合
 * @changes V8.18: 新增 Portfolio Correlation Lock（板塊曝險上限檢查，30-40%）
 */

// ==========================================
// P4 配置參數（SSOT V6.3）
// ==========================================

const P4_CONFIG = {
  // 分層配置範圍
  tier_ranges: {
    CORE: { min: 0.20, max: 0.30, single_max: 0.15 },
    STABLE_SWING: { min: 0.25, max: 0.35, single_max: 0.08 },
    AGGRESSIVE: { min: 0.20, max: 0.25, single_max: 0.05 },
    OPPORTUNISTIC: { min: 0.05, max: 0.10, single_max: 0.03 }
  },
  
  // Cat 權重矩陣 ⭐⭐⭐⭐⭐
  cat_weights: {
    "Cat1": { buy1: 0, buy2: 0, buy3: 0 },      // 未啟動，不配置
    "Cat2": { buy1: 0.3, buy2: 0.5, buy3: 0.2 }, // 啟動期，Buy2 為主
    "Cat3": { buy1: 0.5, buy2: 0.3, buy3: 0.2 }, // 主升段，Buy1 為主
    "Cat4-A": { buy1: 0.2, buy2: 0.3, buy3: 0.5 }, // 高位回調，Buy3 為主
    "Cat4-B": { buy1: 0, buy2: 0, buy3: 1.0 },   // 深度回調，全 Buy3
    "Cat5": { buy1: 0, buy2: 0, buy3: 0 }        // 趨勢破壞，清倉
  },
  
  // U（利用率）配置
  utilization: {
    initial: 0.60,           // 初始 60%
    max: 0.80,               // 最大 80%
    trigger_conditions: {
      "BULL_CONFIRMED": 0.75,      // 牛市確認 → U = 75%
      "STRONG_MOMENTUM": 0.80,     // 強勢動能 → U = 80%
      "BEAR_SIGNAL": 0.40,         // 熊市訊號 → U = 40%
      "HIGH_RISK": 0.30            // 高風險 → U = 30%
    }
  },
  
  // ⭐ V8.18 新增：Portfolio Correlation Lock 配置
  correlation_lock: {
    sector_exposure_cap: 0.35,  // 單一細分產業總持倉上限（35%，保守）
    sector_exposure_cap_aggressive: 0.40,  // 積極模式上限（40%）
    // 優先級規則：超標時優先選最強的（highest score / strongest structure），其餘縮倉或不買
  },
  
  // W_cap_applied（總資金上限）
  total_capital: 10000000  // 1000 萬（示例，應從配置讀取）
};

// ==========================================
// P4 核心計算函數
// ==========================================

/**
 * P4 計算主函數
 * @param {Object} params - 參數
 * @param {string} params.trigger - 觸發來源（P3_AUTO_TRIGGER / P5_WEEKLY_U_ADJUSTMENT / MANUAL）
 * @param {Array} params.changed_stocks - 變動的股票列表（可選）
 * @param {string} params.reason - 觸發原因
 * @return {Object} P4 快照
 */
function P4_Calculate(params) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P4 計算開始：trigger=${params.trigger}, reason=${params.reason}`);
    
    // ========================================
    // Step 1：讀取最新快照
    // ========================================
    
    const p2_snapshot = getLatestP2Snapshot();
    const p3_snapshot = getLatestP3Snapshot();
    
    if (!p2_snapshot || !p3_snapshot) {
      throw new Error("缺少必要的快照數據：P2 或 P3 快照不存在");
    }
    
    // ========================================
    // Step 2：提取資料
    // ========================================
    
    const tier_assignments = p2_snapshot.tier_assignments || {};
    const technical_results = p3_snapshot.technical_results || {};
    
    // ⭐ V8.15 新增：讀取 P0.5 和 P0.7 快照（用於 Tier 降級和 U 優先級）
    const p0_5_snapshot = getLatestP0_5Snapshot();
    const p0_7_snapshot = getLatestP0_7Snapshot();
    
    // ⭐ V8.27 新增：讀取 P0 快照（用於動態集中度上限）
    const p0_snapshot = getLatestP0Snapshot();
    
    // ⭐ V8.15 新增：從 Phase2_Output 讀取 V8.15 新增欄位
    const p2V8_15Fields = readP2V8_15FieldsFromSheet();
    
    // ========================================
    // Step 3：按分層分組（包含 V8.15 Tier 映射）
    // ========================================
    
    const grouped = groupStocksByTierV8_15(tier_assignments, technical_results, p2V8_15Fields, p0_5_snapshot, p0_7_snapshot);
    
    // ========================================
    // Step 4：計算每個分層的理想配置（包含 V8.15 Cat 權重兩層修正）
    // ========================================
    
    const tier_allocations = calculateTierAllocationsV8_15(grouped, p2V8_15Fields, p0_5_snapshot, p0_7_snapshot, p0_snapshot);
    
    // ========================================
    // Step 5：計算實際應配置（W_now）（包含 V8.15 U 優先級）
    // ========================================
    
    const W_cap_applied = P4_CONFIG.total_capital;
    const U = getCurrentUV8_15(p0_7_snapshot, p0_5_snapshot, p2V8_15Fields, technical_results);  // ⭐ V8.15 新增：U 優先級排序
    const W_now = W_cap_applied * U;
    
    const final_allocations = calculateFinalAllocations(tier_allocations, W_now);
    
    // ⭐ V8.15 新增：FRONTIER Runway 硬門檴處理
    // ⭐ V8.17 補丁：注意：風險上限已在 calculateFinalAllocations() 中應用，這裡只處理 Runway < 4 的退出邏輯
    const final_allocations_with_runway = applyFrontierRunwayGate(final_allocations, p2V8_15Fields);
    
    // ⭐ V8.18 新增：Portfolio Correlation Lock（板塊曝險上限檢查）
    const final_allocations_with_correlation = applyPortfolioCorrelationLock(final_allocations_with_runway, W_now);
    
    // ========================================
    // Step 6：總計檢查
    // ========================================
    
    const summary = calculateSummary(final_allocations_with_correlation, grouped, W_cap_applied, U, W_now);
    
    // ========================================
    // Step 7：保存快照
    // ========================================
    
    const snapshot = {
      snapshot_id: generateP4SnapshotId(),
      created_at: new Date(),
      trigger: params.trigger,
      trigger_reason: params.reason,
      
      // 輸入快照 ID（追溯性）
      p2_snapshot_id: p2_snapshot.snapshot_id,
      p3_snapshot_id: p3_snapshot.snapshot_id,
      
      // 配置結果（包含 V8.15 更新 + V8.18 板塊曝險上限）
      allocations: final_allocations_with_correlation,
      
      // 總計
      summary: summary,
      
      // 變動偵測（vs 上一版）
      changes: null,
      
      version: "V8.15"
    };
    
    // ========================================
    // Step 8：比對上一版
    // ========================================
    
    const previousSnapshot = getLatestP4Snapshot();
    
    if (previousSnapshot) {
      snapshot.changes = detectP4Changes({
        current: snapshot.allocations,
        previous: previousSnapshot.allocations
      });
      // 設置 previous_snapshot ID（根據備份設計）
      if (snapshot.changes) {
        snapshot.changes.previous_snapshot = previousSnapshot.snapshot_id;
      }
    }
    
    // ========================================
    // Step 9：保存快照
    // ========================================
    
    saveP4Snapshot(snapshot);
    
    // ⭐ V8.0 新增：P4 完成後，自動執行持股財報完整分析
    try {
      const tickers = final_allocations_with_runway.map(a => a.ticker).filter(t => t);
      const isTestMode = typeof SYSTEM_TEST_MODE !== 'undefined' && SYSTEM_TEST_MODE;
      
      if (tickers.length > 0) {
        Logger.log(`P4 完成後：開始執行持股財報完整分析（${tickers.length} 檔股票）`);
        HoldingsEarningsComplete_Analysis({
          tickers: tickers,
          is_test_mode: isTestMode
        });
      }
    } catch (error) {
      Logger.log(`P4 完成後執行持股財報分析失敗：${error.message}（不影響 P4 結果）`);
    }
    
    // 監控執行時間
    const executionTime = Date.now() - startTime;
    monitorExecutionTime("P4", executionTime);
    
    Logger.log(`P4 計算完成：執行時間 ${executionTime}ms，配置 ${final_allocations.length} 檔股票`);
    
    return snapshot;
  } catch (error) {
    Logger.log(`P4 計算失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 輔助計算函數
// ==========================================

/**
 * 按分層分組股票（V8.15 版本：包含 Position_Role → Tier 映射）
 * ⭐ V8.15 新增：從 Phase2_Output 讀取 Position_Role，映射到 Tier，並應用降級邏輯
 * 
 * @param {Object} tier_assignments - P2 分層結果
 * @param {Object} technical_results - P3 技術分析結果
 * @param {Object} p2V8_15Fields - P2 V8.15 新增欄位（以 ticker 為 key）
 * @param {Object} p0_5_snapshot - P0.5 快照
 * @param {Object} p0_7_snapshot - P0.7 快照
 * @return {Object} 分組結果
 */
function groupStocksByTierV8_15(tier_assignments, technical_results, p2V8_15Fields, p0_5_snapshot, p0_7_snapshot) {
  const grouped = {
    CORE: [],
    STABLE_SWING: [],
    AGGRESSIVE: [],
    OPPORTUNISTIC: [],
    DEFENSIVE: [],
    REJECT: []
  };
  
  for (const [ticker, data] of Object.entries(tier_assignments)) {
    const p2Fields = p2V8_15Fields[ticker] || {};
    const positionRole = p2Fields.position_role;
    const trackType = p2Fields.track_type;
    const runwayQuarters = p2Fields.runway_quarters;
    const safetyGrade = p2Fields.safety_grade;
    
    // ⭐ V8.15 新增：提早過濾 Runway < 4 的 Frontier 股票（Fail Fast）
    if (trackType === "FRONTIER" && runwayQuarters !== null && runwayQuarters !== undefined) {
      if (runwayQuarters < 4) {
        if (safetyGrade === "X") {
          // Runway < 4 且 Safety=X：直接標記為 REJECT，不進入後續計算
          Logger.log(`P4：${ticker} FRONTIER Runway < 4 且 Safety=X，提早過濾（標記為 REJECT）`);
          grouped.REJECT.push({
            ticker: ticker,
            tier: "REJECT",
            cat: technical_results[ticker]?.cat || "Cat1",
            risk_overlay_level: 3,  // 最高風險覆蓋
            orders: null,
            position_role: positionRole,
            track_type: trackType,
            runway_quarters: runwayQuarters,
            time_window_penalty_json: p2Fields.time_window_penalty_json,
            rejection_reason: "FRONTIER_RUNWAY_INSUFFICIENT_SAFETY_X",
            exit_plan: "ACTIVE"
          });
          continue;  // 跳過後續處理
        } else if (safetyGrade === "B") {
          // Runway < 4 但 Safety=B：降級到 OPPORTUNISTIC，但標記警告
          Logger.log(`P4：${ticker} FRONTIER Runway < 4 但 Safety=B，降級到 OPPORTUNISTIC（標記警告）`);
          // 繼續處理，但會在後續計算中限制上限
        }
        // Runway < 4 但 Safety 不是 X 或 B：正常處理（可能是 Safety=A 或 S）
      }
    }
    
    // ⭐ V8.15：先用 Position_Role 決定預設 Tier
    let tier = mapPositionRoleToTier(positionRole, p2Fields);
    
    // ⭐ V8.15：再由 P0.7 + P0.5 flags 做「降級/限額」
    tier = applyTierDowngrade(tier, ticker, p0_7_snapshot, p0_5_snapshot, p2Fields);
    
    if (!grouped[tier]) {
      Logger.log(`警告：未知的分層類型：${tier}，跳過股票 ${ticker}`);
      continue;
    }
    
    grouped[tier].push({
      ticker: ticker,
      tier: tier,
      cat: technical_results[ticker]?.cat || "Cat1",
      risk_overlay_level: technical_results[ticker]?.risk_overlay_level || 0,  // ⭐ V8.15 新增
      orders: technical_results[ticker]?.orders || null,
      position_role: positionRole,  // ⭐ V8.15 新增
      track_type: trackType,  // ⭐ V8.15 新增
      runway_quarters: runwayQuarters,  // ⭐ V8.15 新增
      time_window_penalty_json: p2Fields.time_window_penalty_json,  // ⭐ V8.15 新增
      runway_warning: (trackType === "FRONTIER" && runwayQuarters !== null && runwayQuarters !== undefined && runwayQuarters < 4 && safetyGrade === "B")  // ⭐ V8.15 新增：標記 Runway 警告
    });
  }
  
  return grouped;
}

/**
 * Position_Role → Tier 映射表
 * ⭐ V8.15 新增
 * 
 * @param {string} positionRole - Position Role
 * @param {Object} p2Fields - P2 V8.15 欄位
 * @returns {string} tier - Tier
 */
function mapPositionRoleToTier(positionRole, p2Fields) {
  if (!positionRole) {
    return "OPPORTUNISTIC";  // 預設
  }
  
  switch (positionRole) {
    case "MOMENTUM_COMPOUNDER":
      return "CORE";
    case "EARLY_DIAMOND":
      return "AGGRESSIVE";
    case "FRONTIER_OPTIONALITY":
      return "OPPORTUNISTIC";  // 必須同時標記 OPTIONALITY_ONLY=true
    case "SAFE_BUT_STAGNANT":
      return "DEFENSIVE";  // 或降級到 OPPORTUNISTIC
    case "HOT_BUT_FRAGILE":
      return "REJECT";  // 或只允許極小型短線倉，禁止進 CORE
    case "REJECT":
    case "WATCHLIST":
      return "REJECT";
    default:
      return "OPPORTUNISTIC";
  }
}

/**
 * 應用 Tier 降級邏輯
 * ⭐ V8.15 新增：由 P0.7 + P0.5 flags 做「降級/限額」
 * 
 * @param {string} tier - 原始 Tier
 * @param {string} ticker - 股票代碼
 * @param {Object} p0_7_snapshot - P0.7 快照
 * @param {Object} p0_5_snapshot - P0.5 快照
 * @param {Object} p2Fields - P2 V8.15 欄位
 * @returns {string} tier - 降級後的 Tier
 */
function applyTierDowngrade(tier, ticker, p0_7_snapshot, p0_5_snapshot, p2Fields) {
  // MOMENTUM_COMPOUNDER → CORE
  // 但若 P0.7.turning_point_risk=HIGH 或 P0.5.p5_weekly_flags 有 LATE_CYCLE_RISK / DIVERGENCE_ALERT：CORE → STABLE_SWING
  if (tier === "CORE") {
    const turningPointRisk = p0_7_snapshot?.turning_point_risk;
    const p5WeeklyFlags = p0_5_snapshot?.chain_dynamics_monitor_json?.handoff?.p5_weekly_flags || [];
    
    if (turningPointRisk === "HIGH" || 
        p5WeeklyFlags.includes("LATE_CYCLE_RISK") || 
        p5WeeklyFlags.includes("DIVERGENCE_ALERT")) {
      Logger.log(`P4：${ticker} Tier 降級：CORE → STABLE_SWING（P0.7/P0.5 風險訊號）`);
      return "STABLE_SWING";
    }
  }
  
  // EARLY_DIAMOND → AGGRESSIVE
  // 若 P0.7=Late：AGGRESSIVE → OPPORTUNISTIC
  if (tier === "AGGRESSIVE") {
    const cyclePosition = p0_7_snapshot?.cycle_position;
    if (cyclePosition === "Late") {
      Logger.log(`P4：${ticker} Tier 降級：AGGRESSIVE → OPPORTUNISTIC（P0.7 Late）`);
      return "OPPORTUNISTIC";
    }
  }
  
  return tier;
}

/**
 * 從 Phase2_Output 表格讀取 P2 V8.15 新增欄位
 * ⭐ V8.15 新增
 * 
 * @returns {Object} p2V8_15Fields - 以 ticker 為 key 的 P2 V8.15 欄位
 */
function readP2V8_15FieldsFromSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase2_Output");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const fields = {};
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const getColValue = (colName) => {
        const colIndex = headers.indexOf(colName);
        if (colIndex === -1) return null;
        const value = row[colIndex];
        // 嘗試解析 JSON
        if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
          try {
            return JSON.parse(value);
          } catch (e) {
            return value;
          }
        }
        return value;
      };
      
      const ticker = row[headers.indexOf("Company_Code")];
      if (ticker) {
        fields[ticker] = {
          position_role: getColValue("Position_Role"),
          position_role_reasoning: getColValue("Position_Role_Reasoning"),
          track_type: getColValue("Track_Type"),
          max_position_cap_suggestion: getColValue("Max_Position_Cap_Suggestion"),
          milestones_to_verify_json: getColValue("Milestones_To_Verify_JSON"),
          runway_quarters: getColValue("Runway_Quarters"),
          runway_calculation_json: getColValue("Runway_Calculation_JSON"),
          frontier_risks_json: getColValue("Frontier_Risks_JSON"),
          frontier_conditions_json: getColValue("Frontier_Conditions_JSON"),
          gate_result_for_frontier: getColValue("Gate_Result_For_Frontier"),
          time_window_penalty_json: getColValue("Time_Window_Penalty_JSON"),
          safety_grade: getColValue("Safety_Grade"),
          growth_momentum_grade: getColValue("Growth_Momentum_Grade"),
          future_breakout_grade: getColValue("Future_Breakout_Grade")
        };
      }
    }
    
    return fields;
  } catch (error) {
    Logger.log(`讀取 P2 V8.15 欄位失敗：${error.message}`);
    return {};
  }
}

/**
 * 計算每個分層的理想配置（V8.15 版本：包含 Cat 權重兩層修正）
 * ⭐ V8.15 新增：角色倍率（Position_Role → Cat 風格）+ 風控降檔（P0.7/P0.5 flags → 強制保守）
 * 
 * @param {Object} grouped - 分組結果
 * @param {Object} p2V8_15Fields - P2 V8.15 新增欄位
 * @param {Object} p0_5_snapshot - P0.5 快照
 * @param {Object} p0_7_snapshot - P0.7 快照
 * @param {Object} p0_snapshot - P0 快照（⭐ V8.27 新增：用於動態集中度上限）
 * @return {Object} 分層配置結果
 */
function calculateTierAllocationsV8_15(grouped, p2V8_15Fields, p0_5_snapshot, p0_7_snapshot, p0_snapshot) {
  const tier_allocations = {};
  
  for (const [tier, stocks] of Object.entries(grouped)) {
    if (stocks.length === 0) {
      tier_allocations[tier] = {
        tier_weight: 0,
        stocks: []
      };
      continue;
    }
    
    // 分層總權重（從配置參數讀取）
    const tier_range = P4_CONFIG.tier_ranges[tier] || { min: 0.05, max: 0.10, single_max: 0.03 };
    const tier_weight = (tier_range.min + tier_range.max) / 2; // 取中間值
    
    // ⭐ V8.27 新增：讀取 P0 輸出以獲取 conviction_level
    const p0_output = p0_snapshot?.p0_output_json ? (typeof p0_snapshot.p0_output_json === 'string' ? JSON.parse(p0_snapshot.p0_output_json) : p0_snapshot.p0_output_json) : null;
    
    // 計算每檔配置
    const stock_allocations = [];
    
    for (const stock of stocks) {
      const p2Fields = p2V8_15Fields[stock.ticker] || {};
      
      // ⭐ V8.27 新增：根據 P0 conviction_level 和 Position_Role 動態調整 single_max
      const positionRole = p2Fields.position_role || stock.position_role;
      let single_max = tier_range.single_max;  // 預設值
      let p0Conviction = null;
      
      // 從 P0 輸出中查找該股票對應的 Theme/Subtheme 的 conviction_level
      // 注意：這裡需要根據 Phase1_Company_Pool 中的 Theme_ID/Subtheme_ID 來匹配
      // 簡化實現：先從 P0 themes/subthemes 中查找（未來可以改進為精確匹配）
      if (p0_output && p0_output.themes) {
        for (const theme of p0_output.themes || []) {
          if (theme.conviction_level) {
            p0Conviction = theme.conviction_level;
            break;  // 簡化：使用第一個找到的 conviction_level
          }
        }
        if (!p0Conviction) {
          for (const subtheme of p0_output.subthemes || []) {
            if (subtheme.conviction_level) {
              p0Conviction = subtheme.conviction_level;
              break;  // 簡化：使用第一個找到的 conviction_level
            }
          }
        }
      }
      
      // 動態調整 single_max
      if (positionRole === "MOMENTUM_COMPOUNDER") {
        if (p0Conviction === "ULTRA_HIGH") {
          single_max = 0.30;  // ULTRA_HIGH 允許 30%
        } else if (p0Conviction === "HIGH") {
          single_max = 0.20;  // HIGH 允許 20%
        }
        // MEDIUM 或 LOW 保持預設值（CORE: 0.15）
      }
      
      // 每檔理想權重（受動態調整後的 single_max 約束）
      const ideal_per_stock = Math.min(
        tier_weight / stocks.length,
        single_max
      );
      
      // ⭐ V8.15：Cat 權重矩陣（基礎）
      let cat_weights = P4_CONFIG.cat_weights[stock.cat] || { buy1: 0, buy2: 0, buy3: 0 };
      
      // ⭐ V8.15 兩層修正：(A) 角色倍率
      const roleMultiplier = getRoleMultiplier(stock.position_role, stock.cat);
      cat_weights = applyRoleMultiplier(cat_weights, roleMultiplier, stock.position_role);
      
      // ⭐ V8.15 兩層修正：(B) 風控降檔
      cat_weights = applyRiskControlDowngrade(cat_weights, stock, p0_7_snapshot, p0_5_snapshot);
      
      // ⭐ V8.15：Time_Window_Penalty 整合（調整 Buy 價格和 Stop 設定）
      const timeWindowPenalty = p2Fields.time_window_penalty_json;
      const adjustedOrders = applyTimeWindowPenalty(stock.orders, timeWindowPenalty);
      
      // 每檔在 Buy1/2/3 的配置
      const allocation = {
        ticker: stock.ticker,
        tier: tier,
        cat: stock.cat,
        risk_overlay_level: stock.risk_overlay_level || 0,  // ⭐ V8.15 新增
        
        // 理想配置（W_ideal）
        w_ideal: ideal_per_stock,
        
        // Buy1/2/3 分配（已應用兩層修正）
        buy1_weight: ideal_per_stock * cat_weights.buy1,
        buy2_weight: ideal_per_stock * cat_weights.buy2,
        buy3_weight: ideal_per_stock * cat_weights.buy3,
        
        // 價格（來自 P3，已應用 Time_Window_Penalty）
        buy1_price: adjustedOrders.buy1 || stock.orders?.buy1 || null,
        buy2_price: adjustedOrders.buy2 || stock.orders?.buy2 || null,
        buy3_price: adjustedOrders.buy3 || stock.orders?.buy3 || null,
        
        // Stop（來自 P3，已應用 Time_Window_Penalty）
        stop2: adjustedOrders.stop2 || stock.orders?.stop2 || null,
        stop3: adjustedOrders.stop3 || stock.orders?.stop3 || null,
        
        // ⭐ V8.15 新增欄位
        position_role: stock.position_role,
        track_type: stock.track_type,
        runway_quarters: stock.runway_quarters,
        time_window_penalty_json: timeWindowPenalty,
        // ⭐ V8.17 補丁：添加 Safety Grade 和 Max Position Cap（用於風險上限計算）
        safety_grade: p2Fields.safety_grade,
        max_position_cap_suggestion: p2Fields.max_position_cap_suggestion
      };
      
      stock_allocations.push(allocation);
    }
    
    tier_allocations[tier] = {
      tier_weight: tier_weight,
      stocks: stock_allocations
    };
  }
  
  return tier_allocations;
}

/**
 * 獲取角色倍率（Position_Role → Cat 風格）
 * ⭐ V8.15 新增
 * 
 * @param {string} positionRole - Position Role
 * @param {string} cat - Cat 分類
 * @returns {Object} multiplier - 倍率對象
 */
function getRoleMultiplier(positionRole, cat) {
  const multipliers = {
    MOMENTUM_COMPOUNDER: {
      Cat2: 1.2,
      Cat3: 1.2,
      others: 1.0
    },
    EARLY_DIAMOND: {
      Cat1: 1.2,
      Cat2: 1.2,
      others: 1.0
    },
    FRONTIER_OPTIONALITY: {
      Cat3: 0.5,  // Cat3 權重 ×0.5，只允許 Cat1/2
      others: 1.0
    },
    SAFE_BUT_STAGNANT: {
      Cat4A: 1.2,
      cash: 1.2,  // 現金權重 ×1.2
      others: 1.0
    },
    HOT_BUT_FRAGILE: {
      Cat2: 0.5,
      Cat3: 0.5,
      others: 1.0
    }
  };
  
  const roleMultiplier = multipliers[positionRole] || { others: 1.0 };
  return {
    [cat]: roleMultiplier[cat] || roleMultiplier.others,
    others: roleMultiplier.others
  };
}

/**
 * 應用角色倍率
 * ⭐ V8.15 新增
 * 
 * @param {Object} cat_weights - Cat 權重
 * @param {Object} multiplier - 倍率對象
 * @param {string} positionRole - Position Role
 * @returns {Object} adjusted_weights - 調整後的權重
 */
function applyRoleMultiplier(cat_weights, multiplier, positionRole) {
  const adjusted = { ...cat_weights };
  const cat = Object.keys(multiplier)[0];  // 取得 Cat
  
  // FRONTIER_OPTIONALITY：Cat3 權重 ×0.5，只允許 Cat1/2
  if (positionRole === "FRONTIER_OPTIONALITY" && cat === "Cat3") {
    adjusted.buy1 = adjusted.buy1 * 0.5;
    adjusted.buy2 = adjusted.buy2 * 0.5;
    adjusted.buy3 = adjusted.buy3 * 0.5;
  } else {
    // 其他角色：應用倍率
    const mult = multiplier[cat] || 1.0;
    adjusted.buy1 = adjusted.buy1 * mult;
    adjusted.buy2 = adjusted.buy2 * mult;
    adjusted.buy3 = adjusted.buy3 * mult;
  }
  
  return adjusted;
}

/**
 * 應用風控降檔（P0.7/P0.5 flags → 強制保守）
 * ⭐ V8.15 新增
 * 
 * @param {Object} cat_weights - Cat 權重
 * @param {Object} stock - 股票數據
 * @param {Object} p0_7_snapshot - P0.7 快照
 * @param {Object} p0_5_snapshot - P0.5 快照
 * @returns {Object} adjusted_weights - 調整後的權重
 */
function applyRiskControlDowngrade(cat_weights, stock, p0_7_snapshot, p0_5_snapshot) {
  const adjusted = { ...cat_weights };
  
  // 若 P0.7=Late 或 turning_point_risk=HIGH：直接禁止 Cat3
  const cyclePosition = p0_7_snapshot?.cycle_position;
  const turningPointRisk = p0_7_snapshot?.turning_point_risk;
  
  if ((cyclePosition === "Late" || turningPointRisk === "HIGH") && stock.cat === "Cat3") {
    // 禁止 Cat3，將權重轉移到 Cat2 或 Cat4-A
    adjusted.buy1 = 0;
    adjusted.buy2 = cat_weights.buy2 * 1.5;  // 轉移到 Cat2
    adjusted.buy3 = cat_weights.buy3;
    Logger.log(`P4：${stock.ticker} Cat3 被禁止（P0.7 Late/High risk），權重轉移到 Cat2`);
  }
  
  // 若 DIVERGENCE_ALERT 或 INVENTORY_BUILD_WARNING：Cat2/3 整體降 1 檔
  const p5WeeklyFlags = p0_5_snapshot?.chain_dynamics_monitor_json?.handoff?.p5_weekly_flags || [];
  if ((p5WeeklyFlags.includes("DIVERGENCE_ALERT") || p5WeeklyFlags.includes("INVENTORY_BUILD_WARNING")) &&
      (stock.cat === "Cat2" || stock.cat === "Cat3")) {
    // Cat3 當 Cat2 處理，Cat2 當 Cat1 處理
    if (stock.cat === "Cat3") {
      adjusted.buy1 = cat_weights.buy1 * 0.7;  // 降低
      adjusted.buy2 = cat_weights.buy2 * 1.3;  // 提高
    } else if (stock.cat === "Cat2") {
      adjusted.buy1 = cat_weights.buy1 * 0.5;  // 降低
      adjusted.buy2 = cat_weights.buy2 * 1.5;  // 提高
    }
    Logger.log(`P4：${stock.ticker} ${stock.cat} 降檔處理（P0.5 DIVERGENCE/INVENTORY）`);
  }
  
  return adjusted;
}

/**
 * 應用 Time_Window_Penalty（調整 Buy 價格和 Stop 設定）
 * ⭐ V8.15 新增
 * 
 * @param {Object} orders - 原始訂單價格
 * @param {Object} timeWindowPenalty - Time Window Penalty JSON
 * @returns {Object} adjusted_orders - 調整後的訂單價格
 */
function applyTimeWindowPenalty(orders, timeWindowPenalty) {
  if (!timeWindowPenalty || !timeWindowPenalty.p3_impact) {
    return orders || {};
  }
  
  const p3Impact = timeWindowPenalty.p3_impact;
  const adjusted = { ...orders };
  
  // 調整 Buy 價格（更保守）
  if (p3Impact.buy_price_adjustment) {
    const adjustment = p3Impact.buy_price_adjustment;
    if (adjusted.buy1) adjusted.buy1 = adjusted.buy1 * (1 + adjustment);
    if (adjusted.buy2) adjusted.buy2 = adjusted.buy2 * (1 + adjustment);
    if (adjusted.buy3) adjusted.buy3 = adjusted.buy3 * (1 + adjustment);
  }
  
  // 調整 Stop（更緊）
  if (p3Impact.stop_tightness_adjustment) {
    const adjustment = p3Impact.stop_tightness_adjustment;
    if (adjusted.stop2) adjusted.stop2 = adjusted.stop2 * (1 - adjustment);
    if (adjusted.stop3) adjusted.stop3 = adjusted.stop3 * (1 - adjustment);
  }
  
  return adjusted;
}

/**
 * 應用 FRONTIER Runway 硬門檴處理
 * ⭐ V8.15 新增：兩段式處理（Runway < 4 且 Safety=X → 退出程序；Runway < 4 但 Safety=B → 小倉觀察）
 * 
 * @param {Array} final_allocations - 最終配置列表
 * @param {Object} p2V8_15Fields - P2 V8.15 新增欄位
 * @returns {Array} adjusted_allocations - 調整後的配置列表
 */
function applyFrontierRunwayGate(final_allocations, p2V8_15Fields) {
  const adjusted = [];
  
  for (const allocation of final_allocations) {
    const p2Fields = p2V8_15Fields[allocation.ticker] || {};
    const trackType = p2Fields.track_type;
    // ⭐ V8.17 補丁：確保 runway_quarters 是數字
    const runwayQuarters = (() => {
      const value = p2Fields.runway_quarters;
      if (value === null || value === undefined || value === "") {
        return null;
      }
      const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
      return isFinite(numValue) ? numValue : null;
    })();
    const safetyGrade = p2Fields.safety_grade;
    
    // 只處理 FRONTIER 類型
    if (trackType !== "FRONTIER" || !runwayQuarters) {
      adjusted.push(allocation);
      continue;
    }
    
    // Runway < 4 且 Safety=X：禁止加碼 + 進入退出程序
    if (runwayQuarters < 4 && safetyGrade === "X") {
      Logger.log(`P4：${allocation.ticker} FRONTIER Runway < 4 且 Safety=X，進入退出程序`);
      adjusted.push({
        ...allocation,
        buy1_weight: 0,  // 禁止加碼
        buy2_weight: 0,
        buy3_weight: 0,
        exit_plan: "ACTIVE",  // 退出程序
        exit_reason: "FRONTIER_RUNWAY_INSUFFICIENT_SAFETY_X",
        allow_observation_position: p2Fields.milestones_to_verify_json && 
                                     Array.isArray(p2Fields.milestones_to_verify_json) &&
                                     p2Fields.milestones_to_verify_json.length > 0 &&
                                     p2Fields.milestones_to_verify_json.some(m => {
                                       const daysUntil = m.days_until || 999;
                                       return daysUntil <= 90;  // 1-2 季內
                                     })
      });
    }
    // Runway < 4 但 Safety=B：可保留小倉觀察，但上限降到 OPPORTUNISTIC cap
    else if (runwayQuarters < 4 && safetyGrade === "B") {
      Logger.log(`P4：${allocation.ticker} FRONTIER Runway < 4 但 Safety=B，降低到 OPPORTUNISTIC cap`);
      const opportunisticCap = P4_CONFIG.tier_ranges.OPPORTUNISTIC?.single_max || 0.03;
      adjusted.push({
        ...allocation,
        w_ideal: Math.min(allocation.w_ideal, opportunisticCap),
        buy1_weight: Math.min(allocation.buy1_weight, opportunisticCap * 0.3),
        buy2_weight: Math.min(allocation.buy2_weight, opportunisticCap * 0.3),
        buy3_weight: Math.min(allocation.buy3_weight, opportunisticCap * 0.4),
        runway_warning: true
      });
    }
    // Runway >= 4：正常處理
    else {
      adjusted.push(allocation);
    }
  }
  
  return adjusted;
}

/**
 * 獲取當前 U（利用率）（V8.15 版本：包含優先級排序）
 * ⭐ V8.15 新增：U 優先級排序（P0.7 > P0.5 > P2 > P3）
 * 
 * @param {Object} p0_7_snapshot - P0.7 快照
 * @param {Object} p0_5_snapshot - P0.5 快照
 * @param {Object} p2V8_15Fields - P2 V8.15 新增欄位
 * @param {Object} technical_results - P3 技術分析結果
 * @returns {number} U - 利用率（0.0-1.0）
 */
function getCurrentUV8_15(p0_7_snapshot, p0_5_snapshot, p2V8_15Fields, technical_results) {
  // ⭐ V8.15 優先級排序：P0.7（系統級）> P0.5（產業級）> P2（個股級）> P3（技術狀態）
  // ⭐ V8.19 實戰模擬五：Market Climate Override（Cash is a Position）> 上述所有
  
  // 0. Market Climate 濾網：P0.7 = LATE_CYCLE 且 P5 世界觀 = BEARISH → FORCE_MAX_EXPOSURE = 30%
  if (p0_7_snapshot && p0_7_snapshot.cycle_position === "Late") {
    try {
      const props = PropertiesService.getDocumentProperties();
      const raw = props.getProperty("P5_LATEST_WORLDVIEW_OVERRIDE");
      if (raw) {
        const v = JSON.parse(raw);
        if (v && (v.overall_signal === "BEARISH" || v.overall_signal === "STRONG_BEAR")) {
          Logger.log("P4：Market Climate Override → FORCE_MAX_EXPOSURE = 30%（Late + BEARISH）");
          return 0.30;
        }
      }
    } catch (e) {
      Logger.log("P4：讀取 P5_LATEST_WORLDVIEW_OVERRIDE 失敗：" + (e.message || e));
    }
  }
  
  // 1. P0.7（系統級風險上限）：它是「週期/轉折」的總閘門
  if (p0_7_snapshot) {
    const cyclePosition = p0_7_snapshot.cycle_position;
    const turningPointRisk = p0_7_snapshot.turning_point_risk;
    
    // P0.7 說 Late + High turning point → 全系統 U 上限先被壓到 50%
    if (cyclePosition === "Late" && turningPointRisk === "HIGH") {
      Logger.log("P4：U 被 P0.7 壓到 50%（Late + High turning point）");
      return 0.50;
    }
    // P0.7 說 Late → U 上限壓到 60%
    if (cyclePosition === "Late") {
      Logger.log("P4：U 被 P0.7 壓到 60%（Late）");
      return 0.60;
    }
  }
  
  // 2. P0.5（產業級鏈條狀態）：它是「該產業現在的供需/庫存/背離」
  if (p0_5_snapshot && p0_5_snapshot.chain_dynamics_monitor_json) {
    const p5WeeklyFlags = p0_5_snapshot.chain_dynamics_monitor_json.handoff?.p5_weekly_flags || [];
    
    // 如果有 DIVERGENCE_ALERT 或 INVENTORY_BUILD_WARNING，降低 U
    if (p5WeeklyFlags.includes("DIVERGENCE_ALERT") || p5WeeklyFlags.includes("INVENTORY_BUILD_WARNING")) {
      Logger.log("P4：U 被 P0.5 降低（DIVERGENCE/INVENTORY）");
      return Math.min(getCurrentU(), 0.65);  // 降低到 65% 或更低
    }
  }
  
  // 3. P2（個股級角色與財務三軸）：決定同一個 U 上限下「誰吃到更多份額」
  // （這裡不調整 U，只影響分配）
  
  // 4. P3（技術狀態）：決定「進出場節奏/掛單位置」
  // （這裡不調整 U，只影響掛單）
  
  // 回退到原始邏輯
  return getCurrentU();
}

/**
 * 按分層分組股票（舊版，保留向後兼容）
 * @param {Object} tier_assignments - P2 分層結果
 * @param {Object} technical_results - P3 技術分析結果
 * @return {Object} 分組結果
 */
function groupStocksByTier(tier_assignments, technical_results) {
  return groupStocksByTierV8_15(tier_assignments, technical_results, {}, null, null);
}

/**
 * 計算每個分層的理想配置（舊版，保留向後兼容）
 * @param {Object} grouped - 分組結果
 * @return {Object} 分層配置結果
 */
function calculateTierAllocations(grouped) {
  return calculateTierAllocationsV8_15(grouped, {}, null, null);
}

/**
 * 計算實際應配置（考慮 U）
 * @param {Object} tier_allocations - 分層配置結果
 * @param {number} W_now - 實際應配置資金（W_cap_applied × U）
 * @return {Array} 最終配置列表
 */
function calculateFinalAllocations(tier_allocations, W_now) {
  const final_allocations = [];
  
  for (const [tier, data] of Object.entries(tier_allocations)) {
    for (const stock of data.stocks) {
      // ⭐ V8.17 補丁：計算風險上限（Risk Cap Layer）
      const riskCapResult = calculateRiskCap(stock, tier_allocations);
      
      // 計算理想配置金額
      const buy1_amount_base = stock.buy1_weight * W_now;
      const buy2_amount_base = stock.buy2_weight * W_now;
      const buy3_amount_base = stock.buy3_weight * W_now;
      const total_amount_base = buy1_amount_base + buy2_amount_base + buy3_amount_base;
      
      // 應用風險上限
      const max_position_cap = stock.max_position_cap_suggestion || Infinity;
      const risk_cap_amount = riskCapResult.risk_cap_percent * W_now;
      const final_total_amount = Math.min(
        total_amount_base,
        risk_cap_amount,
        max_position_cap * W_now
      );
      
      // 按比例縮放 Buy1/2/3 金額
      const scale_factor = total_amount_base > 0 ? final_total_amount / total_amount_base : 0;
      
      // 檢查 Infinity 和 NaN ⭐ V8.17 補丁
      const buy1_amount = isFinite(buy1_amount_base * scale_factor) ? buy1_amount_base * scale_factor : 0;
      const buy2_amount = isFinite(buy2_amount_base * scale_factor) ? buy2_amount_base * scale_factor : 0;
      const buy3_amount = isFinite(buy3_amount_base * scale_factor) ? buy3_amount_base * scale_factor : 0;
      const total_amount = isFinite(final_total_amount) ? final_total_amount : 0;
      
      final_allocations.push({
        ticker: stock.ticker,
        tier: stock.tier,
        cat: stock.cat,
        
        // 理想配置（佔總資金比例）
        w_ideal: stock.w_ideal,
        
        // Buy1/2/3 配置（佔總資金比例）
        buy1_weight: stock.buy1_weight,
        buy2_weight: stock.buy2_weight,
        buy3_weight: stock.buy3_weight,
        
        // Buy1/2/3 實際金額（考慮 U 和風險上限）⭐ V8.17 補丁
        buy1_amount: buy1_amount,
        buy2_amount: buy2_amount,
        buy3_amount: buy3_amount,
        
        // 價格
        buy1_price: stock.buy1_price,
        buy2_price: stock.buy2_price,
        buy3_price: stock.buy3_price,
        
        // Stop
        stop2: stock.stop2,
        stop3: stock.stop3,
        
        // 總金額（該檔，已應用風險上限）⭐ V8.17 補丁
        total_amount: total_amount,
        
        // ⭐ V8.17 補丁：風險上限資訊
        risk_cap_percent: riskCapResult.risk_cap_percent,
        risk_cap_reason: riskCapResult.risk_reason,
        risk_cap_applied: total_amount < total_amount_base
      });
    }
  }
  
  return final_allocations;
}

/**
 * ⭐ V8.18 新增：Portfolio Correlation Lock（板塊曝險上限檢查）
 * 避免「假分散」風險：單一細分產業總持倉不得超過 30-40%
 * 超標時優先選最強的，其餘縮倉或不買
 * 
 * @param {Array} final_allocations - 最終配置列表（已應用風險上限）
 * @param {number} W_now - 實際應配置資金
 * @returns {Array} adjusted_allocations - 調整後的配置列表
 */
function applyPortfolioCorrelationLock(final_allocations, W_now) {
  try {
    // 1. 讀取 Phase1_Company_Pool 獲取 Subtheme_ID（細分產業）
    const sectorMap = readSectorMappingFromPhase1();
    
    // 2. 計算每個細分產業的總曝險
    const sectorExposure = {};
    for (const allocation of final_allocations) {
      const ticker = allocation.ticker;
      const subthemeId = sectorMap[ticker] || null;
      
      if (!subthemeId) {
        Logger.log(`P4：${ticker} 無法找到 Subtheme_ID，跳過板塊曝險檢查`);
        continue;
      }
      
      if (!sectorExposure[subthemeId]) {
        sectorExposure[subthemeId] = {
          subtheme_id: subthemeId,
          total_exposure: 0,
          stocks: []
        };
      }
      
      const exposurePercent = allocation.total_amount / W_now;
      sectorExposure[subthemeId].total_exposure += exposurePercent;
      sectorExposure[subthemeId].stocks.push({
        ticker: ticker,
        exposure: exposurePercent,
        allocation: allocation
      });
    }
    
    // 3. 檢查超標的細分產業
    const sectorCap = P4_CONFIG.correlation_lock.sector_exposure_cap;
    const adjusted_allocations = [...final_allocations];
    const adjustments = [];
    
    for (const [subthemeId, sectorData] of Object.entries(sectorExposure)) {
      if (sectorData.total_exposure > sectorCap) {
        Logger.log(`P4：細分產業 ${subthemeId} 曝險超標：${(sectorData.total_exposure * 100).toFixed(2)}% > ${(sectorCap * 100).toFixed(2)}%`);
        
        // 4. 超標處理：優先選最強的，其餘縮倉或不買
        // ⭐ V8.19 實戰模擬二：明確優先序（SSOT）
        // 優先序：1. Tier  2. Early-stage Cat  3. Higher RS  4. Lower vol  5. Existing > New
        const sortedStocks = sectorData.stocks.sort((a, b) => {
          const allocationA = a.allocation;
          const allocationB = b.allocation;
          
          // 優先級 1：Tier（CORE > STABLE_SWING > AGGRESSIVE > OPPORTUNISTIC）
          const tierPriority = { CORE: 4, STABLE_SWING: 3, AGGRESSIVE: 2, OPPORTUNISTIC: 1 };
          const tierDiff = (tierPriority[allocationB.tier] || 0) - (tierPriority[allocationA.tier] || 0);
          if (tierDiff !== 0) return tierDiff;
          
          // 優先級 2：Early-stage Cat > Later-stage（減少時先縮 Cat4-B/Cat5）
          const catOrder = { "Cat2": 4, "Cat3": 3, "Cat4-A": 2, "Cat4-B": 1, "Cat5": 0 };
          const catDiff = (catOrder[allocationB.cat] ?? -1) - (catOrder[allocationA.cat] ?? -1);
          if (catDiff !== 0) return catDiff;
          
          // 優先級 3：Higher RS > Lower RS（從 P3 relative_strength_assessment）
          const rsA = allocationA.p3_data?.relative_strength_assessment?.rs_value ?? allocationA.p3_data?.relative_strength_assessment?.relative_strength ?? 0;
          const rsB = allocationB.p3_data?.relative_strength_assessment?.rs_value ?? allocationB.p3_data?.relative_strength_assessment?.relative_strength ?? 0;
          const rsDiff = rsB - rsA;
          if (Math.abs(rsDiff) > 0.001) return rsDiff;
          
          // 優先級 4：Lower volatility > Higher volatility（從 P3 ATR / volatility）
          const volA = allocationA.p3_data?.atr_14 ?? allocationA.p3_data?.volatility ?? 999999;
          const volB = allocationB.p3_data?.atr_14 ?? allocationB.p3_data?.volatility ?? 999999;
          const volDiff = volA - volB;
          if (Math.abs(volDiff) > 0.001) return volDiff;
          
          // 優先級 5：Existing position > New position
          const existingA = allocationA.current_position || 0;
          const existingB = allocationB.current_position || 0;
          const existingDiff = existingB - existingA;
          if (existingDiff !== 0) return existingDiff;
          
          return (allocationB.w_ideal || 0) - (allocationA.w_ideal || 0);
        });
        
        // 計算需要縮減的總曝險
        const excessExposure = sectorData.total_exposure - sectorCap;
        let remainingExcess = excessExposure;
        
        // 保留最強的 1-2 檔（根據 tier 和 w_ideal）
        const keepCount = Math.min(2, sortedStocks.length);
        const keepStocks = sortedStocks.slice(0, keepCount);
        const reduceStocks = sortedStocks.slice(keepCount);
        
        // 對需要縮減的股票按比例縮倉
        const totalReduceExposure = reduceStocks.reduce((sum, s) => sum + s.exposure, 0);
        
        for (const stockData of reduceStocks) {
          if (remainingExcess <= 0) break;
          
          const allocation = stockData.allocation;
          const reduceRatio = Math.min(1.0, remainingExcess / totalReduceExposure);
          const newExposure = stockData.exposure * (1 - reduceRatio);
          
          // 更新配置
          const scaleFactor = newExposure / stockData.exposure;
          const allocationIndex = adjusted_allocations.findIndex(a => a.ticker === allocation.ticker);
          
          if (allocationIndex >= 0) {
            adjusted_allocations[allocationIndex] = {
              ...allocation,
              total_amount: allocation.total_amount * scaleFactor,
              buy1_amount: allocation.buy1_amount * scaleFactor,
              buy2_amount: allocation.buy2_amount * scaleFactor,
              buy3_amount: allocation.buy3_amount * scaleFactor,
              correlation_lock_applied: true,
              correlation_lock_reason: `細分產業 ${subthemeId} 曝險超標，縮倉 ${(reduceRatio * 100).toFixed(1)}%`
            };
            
            adjustments.push({
              ticker: allocation.ticker,
              subtheme_id: subthemeId,
              original_exposure: stockData.exposure,
              new_exposure: newExposure,
              reduction: reduceRatio
            });
            
            remainingExcess -= stockData.exposure * reduceRatio;
          }
        }
        
        // 如果還有剩餘超標，進一步縮減（包括保留的股票）
        if (remainingExcess > 0 && keepStocks.length > 0) {
          const keepTotalExposure = keepStocks.reduce((sum, s) => sum + s.exposure, 0);
          for (const stockData of keepStocks) {
            const allocation = stockData.allocation;
            const reduceRatio = Math.min(1.0, (remainingExcess * stockData.exposure) / keepTotalExposure);
            const newExposure = stockData.exposure * (1 - reduceRatio);
            
            const allocationIndex = adjusted_allocations.findIndex(a => a.ticker === allocation.ticker);
            if (allocationIndex >= 0) {
              const scaleFactor = newExposure / stockData.exposure;
              adjusted_allocations[allocationIndex] = {
                ...allocation,
                total_amount: allocation.total_amount * scaleFactor,
                buy1_amount: allocation.buy1_amount * scaleFactor,
                buy2_amount: allocation.buy2_amount * scaleFactor,
                buy3_amount: allocation.buy3_amount * scaleFactor,
                correlation_lock_applied: true,
                correlation_lock_reason: `細分產業 ${subthemeId} 曝險超標（保留最強），縮倉 ${(reduceRatio * 100).toFixed(1)}%`
              };
            }
          }
        }
      }
    }
    
    if (adjustments.length > 0) {
      Logger.log(`P4：Portfolio Correlation Lock 已應用，調整 ${adjustments.length} 檔股票`);
    }
    
    return adjusted_allocations;
    
  } catch (error) {
    Logger.log(`P4：Portfolio Correlation Lock 檢查失敗：${error.message}，返回原始配置`);
    return final_allocations;
  }
}

/**
 * ⭐ V8.18 新增：從 Phase1_Company_Pool 讀取 Subtheme_ID 映射
 * 
 * @returns {Object} sectorMap - { ticker: subtheme_id }
 */
function readSectorMappingFromPhase1() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Phase1_Company_Pool");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log(`P4：Phase1_Company_Pool 表格不存在或沒有數據，無法進行板塊曝險檢查`);
      return {};
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("Company_Code");
    const subthemeCol = headers.indexOf("Subtheme_ID");
    
    if (tickerCol === -1 || subthemeCol === -1) {
      Logger.log(`P4：Phase1_Company_Pool 缺少必要欄位（Company_Code 或 Subtheme_ID）`);
      return {};
    }
    
    const sectorMap = {};
    for (let i = 1; i < rows.length; i++) {
      const ticker = rows[i][tickerCol];
      const subthemeId = rows[i][subthemeCol];
      if (ticker && subthemeId) {
        sectorMap[ticker] = subthemeId;
      }
    }
    
    Logger.log(`P4：成功讀取 ${Object.keys(sectorMap).length} 個股票的 Subtheme_ID 映射`);
    return sectorMap;
    
  } catch (error) {
    Logger.log(`P4：讀取 Phase1_Company_Pool 失敗：${error.message}`);
    return {};
  }
}

/**
 * 計算風險上限（Risk Cap Layer）⭐ V8.17 補丁
 * 讓數學負責殘酷，AI 保持創造力
 * 
 * @param {Object} stock - 股票數據
 * @param {Object} tier_allocations - 分層配置結果
 * @returns {Object} riskCapResult - 風險上限結果
 */
function calculateRiskCap(stock, tier_allocations) {
  let risk_cap_percent = 1.0;
  let risk_reason = "";
  
  // FRONTIER 公司風控
  if (stock.track_type === 'FRONTIER') {
    // ⭐ V8.17 補丁：確保 runway_quarters 是數字
    const runwayQuarters = typeof stock.runway_quarters === 'string' 
      ? parseFloat(stock.runway_quarters) 
      : (stock.runway_quarters || Infinity);
    
    if (!isFinite(runwayQuarters)) {
      Logger.log(`P4：${stock.ticker} runway_quarters 不是有效數字，設為預設值`);
      risk_cap_percent = 0.02;  // 預設 2%
      risk_reason = "RUNWAY_UNKNOWN";
    } else if (runwayQuarters < 2) {
      risk_cap_percent = 0.01;
      risk_reason = "EXTREME_LOW_RUNWAY";
    } else if (runwayQuarters < 4) {
      risk_cap_percent = 0.02;
      risk_reason = "LOW_RUNWAY";
    }
  }
  
  // Safety 降權
  if (stock.safety_grade === 'X') {
    risk_cap_percent *= 0.5;
    risk_reason += (risk_reason ? "_" : "") + "LOW_SAFETY";
  }
  
  // 系統性風險加壓（來自 P0.5 / P0.7）
  // 注意：這裡需要從 context 中獲取 system_flags，目前簡化處理
  // 實際應該從 p0_5_snapshot 和 p0_7_snapshot 中讀取
  // 暫時跳過，因為在 applyRiskControlDowngrade 中已經處理
  
  return {
    risk_cap_percent: Math.max(0, Math.min(1, risk_cap_percent)),  // 確保在 0-1 範圍內
    risk_reason: risk_reason || "NORMAL"
  };
}

/**
 * 計算總計
 * @param {Array} final_allocations - 最終配置列表
 * @param {Object} grouped - 分組結果
 * @param {number} W_cap_applied - 總資金上限
 * @param {number} U - 利用率
 * @param {number} W_now - 實際應配置資金
 * @return {Object} 總計結果
 */
function calculateSummary(final_allocations, grouped, W_cap_applied, U, W_now) {
  const total_allocated = final_allocations.reduce((sum, s) => sum + s.total_amount, 0);
  
  const summary = {
    W_cap_applied: W_cap_applied,
    U: U,
    W_now: W_now,
    total_allocated: total_allocated,
    utilization_rate: total_allocated / W_cap_applied,
    
    by_tier: {}
  };
  
  // 按分層統計
  for (const tier of ["CORE", "STABLE_SWING", "AGGRESSIVE", "OPPORTUNISTIC"]) {
    const tier_stocks = final_allocations.filter(s => s.tier === tier);
    
    summary.by_tier[tier] = {
      count: grouped[tier].length,
      total_amount: tier_stocks.reduce((sum, s) => sum + s.total_amount, 0),
      weight: tier_stocks.reduce((sum, s) => sum + s.w_ideal, 0)
    };
  }
  
  return summary;
}

/**
 * 偵測 P4 變動（vs 上一版）
 * @param {Object} params - 參數
 * @param {Array} params.current - 當前配置
 * @param {Array} params.previous - 上一版配置
 * @return {Object} 變動結果
 */
function detectP4Changes(params) {
  const { current, previous } = params;
  
  const changes = {
    previous_snapshot: null,  // 會在外部設置
    allocation_changes: [],
    has_changes: false
  };
  
  // 建立上一版的索引（以 ticker 為 key）
  const previousMap = {};
  if (previous) {
    for (const stock of previous) {
      previousMap[stock.ticker] = stock;
    }
  }
  
  // 比對變動
  for (const currentStock of current) {
    const previousStock = previousMap[currentStock.ticker];
    
    if (!previousStock) {
      // 新增的股票
      changes.allocation_changes.push({
        ticker: currentStock.ticker,
        type: "NEW",
        new_allocation: currentStock
      });
      changes.has_changes = true;
    } else {
      // 比對配置變動
      if (previousStock.cat !== currentStock.cat) {
        // 計算配置變化（根據備份設計的詳細格式）
        const old_buy1_amount = previousStock.buy1_amount || 0;
        const new_buy1_amount = currentStock.buy1_amount || 0;
        const old_buy2_amount = previousStock.buy2_amount || 0;
        const new_buy2_amount = currentStock.buy2_amount || 0;
        const old_buy3_amount = previousStock.buy3_amount || 0;
        const new_buy3_amount = currentStock.buy3_amount || 0;
        
        // 生成 impact 說明（根據備份設計）
        let impact = `Cat 變動（${previousStock.cat} → ${currentStock.cat}）導致配置調整`;
        if (previousStock.cat === "Cat3" && currentStock.cat === "Cat4-A") {
          impact = "降低 Buy1（高位減倉），增加 Buy3（等待深度回調）";
        } else if (previousStock.cat === "Cat4-A" && currentStock.cat === "Cat3") {
          impact = "增加 Buy1（主升段加倉），減少 Buy3（回調結束）";
        } else if (currentStock.cat === "Cat5") {
          impact = "趨勢破壞，清倉";
        }
        
        changes.allocation_changes.push({
          ticker: currentStock.ticker,
          type: "CAT_CHANGE",
          old_cat: previousStock.cat,
          new_cat: currentStock.cat,
          old_buy1_amount: old_buy1_amount,
          new_buy1_amount: new_buy1_amount,
          old_buy2_amount: old_buy2_amount,
          new_buy2_amount: new_buy2_amount,
          old_buy3_amount: old_buy3_amount,
          new_buy3_amount: new_buy3_amount,
          old_allocation: previousStock,
          new_allocation: currentStock,
          impact: impact
        });
        changes.has_changes = true;
      } else if (
        Math.abs(previousStock.buy1_amount - currentStock.buy1_amount) > 1000 ||
        Math.abs(previousStock.buy2_amount - currentStock.buy2_amount) > 1000 ||
        Math.abs(previousStock.buy3_amount - currentStock.buy3_amount) > 1000
      ) {
        // 配置金額變動超過 $1000
        changes.allocation_changes.push({
          ticker: currentStock.ticker,
          type: "ALLOCATION_CHANGE",
          old_allocation: previousStock,
          new_allocation: currentStock,
          impact: "配置金額變動"
        });
        changes.has_changes = true;
      }
    }
  }
  
  // 檢查是否有移除的股票
  const currentMap = {};
  for (const stock of current) {
    currentMap[stock.ticker] = true;
  }
  
  if (previous) {
    for (const previousStock of previous) {
      if (!currentMap[previousStock.ticker]) {
        changes.allocation_changes.push({
          ticker: previousStock.ticker,
          type: "REMOVED",
          old_allocation: previousStock
        });
        changes.has_changes = true;
      }
    }
  }
  
  return changes;
}

// ==========================================
// 快照管理函數（需要實現）
// ==========================================

/**
 * 獲取當前 U（利用率）
 * @return {number} 當前 U 值
 */
function getCurrentU() {
  try {
    // 優先從 PropertiesService 讀取（由 P5 Weekly 或其他模組更新）
    const properties = PropertiesService.getScriptProperties();
    const currentU = properties.getProperty("CURRENT_U");
    
    if (currentU) {
      const uValue = parseFloat(currentU);
      if (!isNaN(uValue) && uValue >= 0 && uValue <= 1) {
        return uValue;
      }
    }
    
    // 如果 PropertiesService 中沒有，嘗試從 P5 Weekly 最新快照讀取
    try {
      const p5WeeklySnapshot = getLatestP5WeeklySnapshot();
      if (p5WeeklySnapshot && p5WeeklySnapshot.u_adjustment_json) {
        const uAdjustment = typeof p5WeeklySnapshot.u_adjustment_json === 'string' 
          ? JSON.parse(p5WeeklySnapshot.u_adjustment_json)
          : p5WeeklySnapshot.u_adjustment_json;
        
        if (uAdjustment && uAdjustment.recommended_u !== undefined) {
          const uValue = parseFloat(uAdjustment.recommended_u);
          if (!isNaN(uValue) && uValue >= 0 && uValue <= 1) {
            Logger.log(`P4：從 P5 Weekly 快照讀取 U 值：${uValue}`);
            return uValue;
          }
        }
      }
    } catch (error) {
      Logger.log(`P4：從 P5 Weekly 快照讀取 U 值失敗：${error.message}`);
    }
    
    // 如果都沒有，返回預設值
    Logger.log(`P4：使用預設 U 值：${P4_CONFIG.utilization.initial}`);
    return P4_CONFIG.utilization.initial;
  } catch (error) {
    Logger.log(`P4：獲取當前 U 值失敗：${error.message}，使用預設值`);
    return P4_CONFIG.utilization.initial;
  }
}

/**
 * 生成 P4 快照 ID
 * @return {string} 快照 ID
 */
function generateP4SnapshotId() {
  const now = new Date();
  const weekNumber = getWeekNumber(now);
  return `P4_${now.getFullYear()}_W${weekNumber}`;
}

/**
 * 獲取週數
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
// 快照管理函數（從快照管理模組導入）
// ==========================================

/**
 * 獲取最新快照（從 06_SNAPSHOT_MANAGER.js 導入）
 * 注意：這些函數已在 06_SNAPSHOT_MANAGER.js 中實現
 * - getLatestP2Snapshot() - 已在 06_SNAPSHOT_MANAGER.js 中定義
 * - getLatestP3Snapshot() - 已在 06_SNAPSHOT_MANAGER.js 中定義
 * - getLatestP4Snapshot() - 已在 06_SNAPSHOT_MANAGER.js 中定義
 * - saveP4Snapshot() - 已在 06_SNAPSHOT_MANAGER.js 中定義（統一版本）
 */
