/**
 * 🎈 P5.6: 泡沫導航系統（Bubble Navigation）
 * 
 * 高估值市場識別
 * 泡沫階段判斷
 * 風險控制策略
 * 
 * ⭐ V8.10 戰略升級：
 * - 從「左側減倉」→「右側動態鎖利」：在泡沫末期，不因為「貴」而賣出，只因為「破」而離場
 * - 從「估值預測」→「動能跟隨」：以「流動性」取代「估值」，監控「資金水龍頭」是否關閉
 * - 新增「三層泡沫框架」（定價昂貴、泡沫行為學、結構性脆弱）
 * - 新增「真實成長檢驗」（生產力驗證、CapEx/營收成長一致性）
 * 
 * @version SSOT V8.10
 * @date 2026-01-18
 */

const P5_6_CONFIG = {
  bubble_stages: {
    "EARLY": { risk_multiplier: 1.0, action: "HOLD_REDUCE_WEIGHT", tightrope_mode: false },
    "MID": { risk_multiplier: 1.5, action: "REDUCE_30_50PCT", tightrope_mode: false },
    "LATE": { risk_multiplier: 2.0, action: "TIGHTROPE_MODE", tightrope_mode: true }, // ⭐ V8.10：走鋼索模式，不減倉
    "BURST": { risk_multiplier: 3.0, action: "EMERGENCY_EXIT", tightrope_mode: false }
  },
  
  // ⭐ V8.10 新增：三層泡沫框架閾值
  layer1_valuation: {
    // Layer 1：定價是否「昂貴」（估值類指標）
    // 用途：判斷「報酬是否被透支」，但**不做下車訊號**
    forward_pe_warning: 40,      // Forward P/E 警告閾值
    cape_warning: 35,             // CAPE 警告閾值
    ev_fcf_warning: 25,           // EV/FCF 警告閾值
    market_cap_gdp_warning: 150   // 調整後市值/GDP 警告閾值（考慮全球化調整）
  },
  
  layer2_behavior: {
    // Layer 2：是否進入「泡沫行為學」（情緒/槓桿/交易狂熱）
    // 用途：比估值更準確的泡沫識別
    margin_debt_spike: 1.5,       // 融資餘額相對於 1 年前增長倍數
    option_speculation: 2.0,      // 期權投機強度（Put/Call Ratio 異常）
    turnover_rate_spike: 2.0,     // 成交周轉率相對於平均值增長倍數
    ipo_hotness: 1.5,             // IPO/增發熱度（相對於平均值）
    retail_leverage: 1.3          // 散戶槓桿增長倍數
  },
  
  layer3_fragility: {
    // Layer 3：是否出現「結構性脆弱」
    // 用途：決定「風險控管是否升級」
    market_breadth_warning: 0.3,  // 市場廣度警告（上漲股票占比 < 30%）
    concentration_warning: 0.4,    // 集中度警告（前 5 大權重占比 > 40%）
    correlation_spike: 0.8        // 相關性異常（股票間相關性 > 80%）
  },
  
  // ⭐ V8.10 新增：真實成長檢驗閾值
  growth_validation: {
    min_revenue_growth: 0.20,     // 最低營收成長率（20%）
    capex_revenue_ratio: 0.15,    // CapEx/營收最低占比（15%）
    margin_expansion: true,       // 是否要求毛利/營益率擴張
    cash_flow_positive: true      // 是否要求現金流為正
  }
};

/**
 * P5.6 泡沫導航主函數 ⭐ V8.10 升級
 * 
 * @param {string} ticker - 股票代碼（可選，如果為市場級評估可為 null）
 * @param {Object} marketData - 市場數據
 * @returns {Object} 泡沫導航結果
 */
function P5_6_BubbleNavigation(ticker, marketData) {
  const indicators = assessBubbleIndicators(ticker || "MARKET", marketData);
  const stage = determineBubbleStage(indicators);
  const strategy = P5_6_CONFIG.bubble_stages[stage];
  
  const result = {
    ticker: ticker || "MARKET",
    bubble_stage: stage,
    indicators: indicators,
    risk_multiplier: strategy.risk_multiplier,
    action: strategy.action,
    tightrope_mode: strategy.tightrope_mode || false, // ⭐ V8.10 新增：是否為走鋼索模式
    timestamp: new Date().toISOString(),
    
    // ⭐ V8.10 新增：三層框架摘要
    layer_summary: {
      layer1_expensive: indicators.layer1_valuation.is_expensive,
      layer2_frothy: indicators.layer2_behavior.is_frothy,
      layer3_fragile: indicators.layer3_fragility.is_fragile,
      growth_validated: indicators.growth_validation.passed
    },
    
    // ⭐ V8.10 新增：建議動作
    recommended_action: getRecommendedAction(stage, indicators, strategy.tightrope_mode)
  };
  
  return result;
}

/**
 * ⭐ V8.10 新增：根據泡沫階段和評估結果給出建議動作
 */
function getRecommendedAction(stage, indicators, tightropeMode) {
  const action = {
    u_adjustment: null,
    position_structure: "NORMAL",
    risk_control: "NORMAL",
    p6_trailing_stop: false,
    message: ""
  };
  
  switch (stage) {
    case "EARLY":
      action.u_adjustment = "MAINTAIN_OR_SLIGHT_REDUCE";
      action.position_structure = "NORMAL";
      action.message = "估值開始偏高，維持當前水位，謹慎加碼";
      break;
      
    case "MID":
      action.u_adjustment = "REDUCE_10_20PCT";
      action.position_structure = "CONSERVATIVE";
      action.message = "估值偏高，降低 10-20% 水位，避免追高";
      break;
      
    case "LATE":
      if (tightropeMode) {
        // ⭐ V8.10：走鋼索模式
        action.u_adjustment = "MAINTAIN_HIGH_WATER";
        action.position_structure = "TIGHTROPE_MODE";
        action.risk_control = "TIGHT";
        action.p6_trailing_stop = true; // 啟動移動停利
        action.message = "瘋狗浪階段：維持高水位（80-100%），啟動 P6 移動停利機制（從最高點回落 -4% 觸發撤退）";
      } else {
        action.u_adjustment = "REDUCE_30_50PCT";
        action.message = "LATE 階段（未啟用走鋼索模式）：降低 30-50% 水位";
      }
      break;
      
    case "BURST":
      action.u_adjustment = "EMERGENCY_EXIT";
      action.position_structure = "MINIMAL";
      action.risk_control = "MAXIMUM";
      action.message = "泡沫破裂：緊急撤退至最低水位（30%）";
      break;
      
    default:
      action.u_adjustment = "MAINTAIN";
      action.message = "正常階段：維持當前水位";
  }
  
  return action;
}

/**
 * ⭐ V8.10 升級：三層泡沫框架評估
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} marketData - 市場數據
 * @returns {Object} 三層泡沫評估結果
 */
function assessBubbleIndicators(ticker, marketData) {
  const result = {
    // Layer 1：定價是否「昂貴」
    layer1_valuation: {
      forward_pe: marketData.forward_pe || 0,
      cape: marketData.cape || 0,
      ev_fcf: marketData.ev_fcf || 0,
      market_cap_gdp: marketData.market_cap_gdp || 0,
      is_expensive: false,
      warnings: []
    },
    
    // Layer 2：是否進入「泡沫行為學」
    layer2_behavior: {
      margin_debt_ratio: marketData.margin_debt_ratio || 1.0,
      option_speculation: marketData.option_speculation || 1.0,
      turnover_rate: marketData.turnover_rate || 1.0,
      ipo_hotness: marketData.ipo_hotness || 1.0,
      retail_leverage: marketData.retail_leverage || 1.0,
      is_frothy: false,
      warnings: []
    },
    
    // Layer 3：是否出現「結構性脆弱」
    layer3_fragility: {
      market_breadth: marketData.market_breadth || 0.5,
      concentration: marketData.concentration || 0.2,
      correlation: marketData.correlation || 0.5,
      is_fragile: false,
      warnings: []
    },
    
    // ⭐ V8.10 新增：真實成長檢驗
    growth_validation: {
      revenue_growth: marketData.revenue_growth || 0,
      capex_revenue_ratio: marketData.capex_revenue_ratio || 0,
      margin_expansion: marketData.margin_expansion || false,
      cash_flow_positive: marketData.cash_flow_positive || false,
      passed: false,
      warnings: []
    },
    
    // 舊版兼容性欄位
    valuation: marketData.forward_pe || marketData.pe || 0,
    sentiment: marketData.vix || 0,
    leverage: marketData.margin_debt || 0,
    volume: marketData.volume_anomaly || false
  };
  
  // 評估 Layer 1：定價是否「昂貴」
  const l1 = result.layer1_valuation;
  if (l1.forward_pe > P5_6_CONFIG.layer1_valuation.forward_pe_warning) {
    l1.is_expensive = true;
    l1.warnings.push(`Forward P/E ${l1.forward_pe} 超過警告閾值 ${P5_6_CONFIG.layer1_valuation.forward_pe_warning}`);
  }
  if (l1.cape > P5_6_CONFIG.layer1_valuation.cape_warning) {
    l1.is_expensive = true;
    l1.warnings.push(`CAPE ${l1.cape} 超過警告閾值 ${P5_6_CONFIG.layer1_valuation.cape_warning}`);
  }
  if (l1.ev_fcf > P5_6_CONFIG.layer1_valuation.ev_fcf_warning) {
    l1.is_expensive = true;
    l1.warnings.push(`EV/FCF ${l1.ev_fcf} 超過警告閾值 ${P5_6_CONFIG.layer1_valuation.ev_fcf_warning}`);
  }
  if (l1.market_cap_gdp > P5_6_CONFIG.layer1_valuation.market_cap_gdp_warning) {
    l1.is_expensive = true;
    l1.warnings.push(`調整後市值/GDP ${l1.market_cap_gdp}% 超過警告閾值 ${P5_6_CONFIG.layer1_valuation.market_cap_gdp_warning}%`);
  }
  
  // 評估 Layer 2：是否進入「泡沫行為學」
  const l2 = result.layer2_behavior;
  if (l2.margin_debt_ratio > P5_6_CONFIG.layer2_behavior.margin_debt_spike) {
    l2.is_frothy = true;
    l2.warnings.push(`融資餘額增長 ${(l2.margin_debt_ratio * 100).toFixed(0)}% 超過警告閾值`);
  }
  if (l2.option_speculation > P5_6_CONFIG.layer2_behavior.option_speculation) {
    l2.is_frothy = true;
    l2.warnings.push(`期權投機強度 ${l2.option_speculation} 超過警告閾值`);
  }
  if (l2.turnover_rate > P5_6_CONFIG.layer2_behavior.turnover_rate_spike) {
    l2.is_frothy = true;
    l2.warnings.push(`成交周轉率增長 ${(l2.turnover_rate * 100).toFixed(0)}% 超過警告閾值`);
  }
  
  // 評估 Layer 3：是否出現「結構性脆弱」
  const l3 = result.layer3_fragility;
  if (l3.market_breadth < P5_6_CONFIG.layer3_fragility.market_breadth_warning) {
    l3.is_fragile = true;
    l3.warnings.push(`市場廣度 ${(l3.market_breadth * 100).toFixed(0)}% 低於警告閾值 ${(P5_6_CONFIG.layer3_fragility.market_breadth_warning * 100).toFixed(0)}%`);
  }
  if (l3.concentration > P5_6_CONFIG.layer3_fragility.concentration_warning) {
    l3.is_fragile = true;
    l3.warnings.push(`集中度 ${(l3.concentration * 100).toFixed(0)}% 超過警告閾值 ${(P5_6_CONFIG.layer3_fragility.concentration_warning * 100).toFixed(0)}%`);
  }
  if (l3.correlation > P5_6_CONFIG.layer3_fragility.correlation_spike) {
    l3.is_fragile = true;
    l3.warnings.push(`相關性 ${(l3.correlation * 100).toFixed(0)}% 超過警告閾值 ${(P5_6_CONFIG.layer3_fragility.correlation_spike * 100).toFixed(0)}%`);
  }
  
  // ⭐ V8.10 新增：真實成長檢驗
  const gv = result.growth_validation;
  if (gv.revenue_growth < P5_6_CONFIG.growth_validation.min_revenue_growth) {
    gv.warnings.push(`營收成長率 ${(gv.revenue_growth * 100).toFixed(0)}% 低於最低要求 ${(P5_6_CONFIG.growth_validation.min_revenue_growth * 100).toFixed(0)}%`);
  }
  if (gv.capex_revenue_ratio < P5_6_CONFIG.growth_validation.capex_revenue_ratio) {
    gv.warnings.push(`CapEx/營收占比 ${(gv.capex_revenue_ratio * 100).toFixed(0)}% 低於最低要求 ${(P5_6_CONFIG.growth_validation.capex_revenue_ratio * 100).toFixed(0)}%`);
  }
  if (P5_6_CONFIG.growth_validation.margin_expansion && !gv.margin_expansion) {
    gv.warnings.push("毛利/營益率未擴張");
  }
  if (P5_6_CONFIG.growth_validation.cash_flow_positive && !gv.cash_flow_positive) {
    gv.warnings.push("現金流未為正");
  }
  
  // 判斷是否通過成長檢驗（沒有警告才算通過）
  gv.passed = gv.warnings.length === 0;
  
  return result;
}

/**
 * ⭐ V8.10 升級：根據三層泡沫框架判斷泡沫階段
 * 
 * @param {Object} indicators - 三層泡沫評估結果
 * @returns {string} 泡沫階段（EARLY/MID/LATE/BURST/NORMAL）
 */
function determineBubbleStage(indicators) {
  const l1 = indicators.layer1_valuation;
  const l2 = indicators.layer2_behavior;
  const l3 = indicators.layer3_fragility;
  const gv = indicators.growth_validation;
  
  // ⭐ V8.10 新增：如果成長檢驗失敗，即使估值高也視為 BURST（垃圾泡沫）
  if (!gv.passed && l1.is_expensive) {
    return "BURST"; // 估值高但成長驗證失敗 = 垃圾泡沫
  }
  
  // Layer 3 出現結構性脆弱 → BURST
  if (l3.is_fragile) {
    return "BURST";
  }
  
  // Layer 2 進入泡沫行為學 + Layer 1 昂貴 → LATE（瘋狗浪）
  if (l2.is_frothy && l1.is_expensive) {
    return "LATE";
  }
  
  // Layer 1 昂貴（但成長檢驗通過） → MID
  if (l1.is_expensive && gv.passed) {
    return "MID";
  }
  
  // Layer 1 部分指標警告 → EARLY
  if (l1.warnings.length > 0) {
    return "EARLY";
  }
  
  return "NORMAL";
}
