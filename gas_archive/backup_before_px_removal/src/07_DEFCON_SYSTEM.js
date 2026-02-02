/**
 * 🛡️ DEFCON 系統（防禦態勢系統）
 * 
 * 5 級風險評估系統，整合 5 大類市場信號
 * 輸出 DEFCON 等級（1-5）和對應的操作建議
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// DEFCON 配置參數
// ==========================================

const DEFCON_CONFIG = {
  // 5 大類信號權重
  category_weights: {
    "TREND_REVERSAL": 0.25,      // 類別 1: 趨勢轉向
    "VOLATILITY_SPIKE": 0.20,    // 類別 2: 波動率爆發
    "LIQUIDITY_STRESS": 0.20,    // 類別 3: 流動性壓力
    "SENTIMENT_EXTREME": 0.20,   // 類別 4: 情緒極端
    "LIQUIDITY_DRYUP": 0.15      // 類別 5: 流動性枯竭
  },
  
  // 類別內信號權重
  signal_weights: {
    "TREND_REVERSAL": {
      "MA_CROSSOVER": 0.30,      // 均線系統
      "MOMENTUM": 0.30,          // 動量指標
      "INSTITUTIONAL": 0.40      // 機構行為（最高權重）
    },
    "VOLATILITY_SPIKE": {
      "VIX": 0.50,               // VIX 權重最高
      "STOCK_IV": 0.30,          // 個股波動率
      "CROSS_ASSET": 0.20        // 跨資產波動
    },
    "LIQUIDITY_STRESS": {
      "MARKET_DEPTH": 0.40,       // 市場深度
      "VOLUME_ANOMALY": 0.35,    // 成交量異常
      "LIQUIDITY_INDICATOR": 0.25 // 流動性指標
    },
    "SENTIMENT_EXTREME": {
      "SKEW": 0.50,              // SKEW 指數權重最高
      "FEAR_GREED": 0.50         // 恐慌/貪婪指標
    },
    "LIQUIDITY_DRYUP": {
      "HY_SPREAD": 0.40,         // 高收益債利差
      "CREDIT_STRESS": 0.35,     // 信用市場壓力
      "CROSS_ASSET_CORR": 0.25   // 跨資產相關性
    }
  },
  
  // DEFCON 等級判定標準
  defcon_thresholds: {
    "DEFCON_1": { min: 81, max: 100, label: "極度危險" },
    "DEFCON_2": { min: 61, max: 80, label: "高度風險" },
    "DEFCON_3": { min: 41, max: 60, label: "中等風險" },
    "DEFCON_4": { min: 21, max: 40, label: "低風險" },
    "DEFCON_5": { min: 0, max: 20, label: "正常" }
  },
  
  // U_macro 調整（根據 DEFCON）
  u_macro_adjustments: {
    "DEFCON_1": 0.30,  // U = 30%
    "DEFCON_2": 0.50,  // U = 50%
    "DEFCON_3": 0.65,  // U = 65%
    "DEFCON_4": 0.75,  // U = 75%
    "DEFCON_5": 0.80   // U = 80%
  }
};

// ==========================================
// DEFCON 核心計算函數
// ==========================================

/**
 * 計算 DEFCON 等級 ⭐ V8.0 增強：結合籌碼面信號
 * @param {Object} marketData - 市場數據
 * @param {Object} smartMoneySignal - 籌碼面信號 ⭐ V8.0 新增
 * @return {Object} DEFCON 結果
 */
function calculateDEFCON(marketData, smartMoneySignal = null) {
  const startTime = Date.now();
  
  try {
    Logger.log(`DEFCON 計算開始（籌碼面信號：${smartMoneySignal || "未提供"}）`);
    
    // ========================================
    // Step 1: 計算各類別風險評分
    // ========================================
    
    const categoryScores = {
      TREND_REVERSAL: calculateTrendReversalScore(marketData),
      VOLATILITY_SPIKE: calculateVolatilitySpikeScore(marketData),
      LIQUIDITY_STRESS: calculateLiquidityStressScore(marketData),
      SENTIMENT_EXTREME: calculateSentimentExtremeScore(marketData),
      LIQUIDITY_DRYUP: calculateLiquidityDryupScore(marketData)
    };
    
    // ⭐ V8.0 新增：籌碼面信號影響
    if (smartMoneySignal === "BEARISH") {
      // 籌碼面 BEARISH → 提高 DEFCON（增加風險評分）
      Logger.log("DEFCON：籌碼面信號 BEARISH，提高風險評分");
      categoryScores.TREND_REVERSAL = Math.min(100, categoryScores.TREND_REVERSAL + 15);
      categoryScores.SENTIMENT_EXTREME = Math.min(100, categoryScores.SENTIMENT_EXTREME + 10);
    } else if (smartMoneySignal === "BULLISH") {
      // 籌碼面 BULLISH → 降低 DEFCON（降低風險評分）
      Logger.log("DEFCON：籌碼面信號 BULLISH，降低風險評分");
      categoryScores.TREND_REVERSAL = Math.max(0, categoryScores.TREND_REVERSAL - 10);
      categoryScores.SENTIMENT_EXTREME = Math.max(0, categoryScores.SENTIMENT_EXTREME - 5);
    }
    
    // ========================================
    // Step 2: 加權計算總風險評分
    // ========================================
    
    let totalRiskScore = 0;
    const weights = DEFCON_CONFIG.category_weights;
    
    for (const [category, score] of Object.entries(categoryScores)) {
      totalRiskScore += score * weights[category];
    }
    
    // 確保評分在 0-100 範圍內
    totalRiskScore = Math.max(0, Math.min(100, totalRiskScore));
    
    // ========================================
    // Step 3: 判定 DEFCON 等級
    // ========================================
    
    const defconLevel = determineDEFCONLevel(totalRiskScore);
    const uMacro = DEFCON_CONFIG.u_macro_adjustments[defconLevel];
    
    // ========================================
    // Step 4: 檢查觸發條件
    // ========================================
    
    const triggers = checkEmergencyTriggers(defconLevel, marketData);
    
    // ========================================
    // Step 5: 生成結果
    // ========================================
    
    const result = {
      defcon_level: defconLevel,
      risk_score: Math.round(totalRiskScore * 100) / 100,
      category_scores: categoryScores,
      u_macro: uMacro,
      triggers: triggers,
      timestamp: new Date().toISOString(),
      market_data_snapshot: {
        vix: marketData.vix || null,
        skew: marketData.skew || null,
        hy_spread: marketData.hy_spread || null
      }
    };
    
    const duration = Date.now() - startTime;
    Logger.log(`DEFCON 計算完成：${defconLevel}, 風險評分=${result.risk_score}, 耗時=${duration}ms`);
    
    return result;
    
  } catch (error) {
    Logger.log(`DEFCON 計算失敗：${error.message}`);
    throw error;
  }
}

// ==========================================
// 類別 1: 趨勢轉向（Trend Reversal）
// ==========================================

/**
 * 計算趨勢轉向風險評分
 */
function calculateTrendReversalScore(marketData) {
  let score = 0;
  const weights = DEFCON_CONFIG.signal_weights.TREND_REVERSAL;
  
  // 信號 1-1: 均線系統
  if (marketData.ma_50_below_200) {
    score += 15 * weights.MA_CROSSOVER;  // 死叉
  }
  if (marketData.ma_200_slope_negative) {
    score += 10 * weights.MA_CROSSOVER;   // 200 日均線斜率轉負
  }
  if (marketData.price_below_support) {
    score += 5 * weights.MA_CROSSOVER;    // 跌破關鍵支撐
  }
  
  // 信號 1-2: 動量指標
  if (marketData.rsi_overbought_then_fall) {
    score += 10 * weights.MOMENTUM;       // RSI > 70 後快速回落
  }
  if (marketData.macd_death_cross_divergence) {
    score += 15 * weights.MOMENTUM;        // MACD 死叉且背離
  }
  if (marketData.volume_decline_price_fall) {
    score += 5 * weights.MOMENTUM;        // 成交量萎縮但價格續跌
  }
  
  // 信號 1-3: 機構行為（最高權重）
  if (marketData.institutional_massive_selloff) {
    score += 20 * weights.INSTITUTIONAL;  // 大型機構大量減倉
  }
  if (marketData.f13f_show_exit) {
    score += 15 * weights.INSTITUTIONAL;  // 13F 持倉變化顯示撤離
  }
  if (marketData.dark_pool_abnormal_outflow) {
    score += 10 * weights.INSTITUTIONAL;  // Dark Pool 異常流出
  }
  
  return Math.min(100, score);
}

// ==========================================
// 類別 2: 波動率爆發（Volatility Spike）
// ==========================================

/**
 * 計算波動率爆發風險評分
 */
function calculateVolatilitySpikeScore(marketData) {
  let score = 0;
  const weights = DEFCON_CONFIG.signal_weights.VOLATILITY_SPIKE;
  
  // 信號 2-1: VIX 指標（最高權重）
  const vix = marketData.vix || 0;
  if (vix > 50) {
    score += 30 * weights.VIX;  // VIX > 50（極度危險）
  } else if (vix > 40) {
    score += 20 * weights.VIX;  // VIX > 40
  } else if (vix > 30) {
    score += 10 * weights.VIX;  // VIX > 30
  }
  
  // 信號 2-2: 個股波動率
  if (marketData.stock_iv_over_80) {
    score += 10 * weights.STOCK_IV;  // 個股 IV > 80%
  }
  if (marketData.stock_realized_vol_95th) {
    score += 15 * weights.STOCK_IV;  // 個股實際波動率 > 歷史 95% 分位
  }
  
  // 信號 2-3: 跨資產波動
  if (marketData.stock_bond_correlation_abnormal) {
    score += 15 * weights.CROSS_ASSET;  // 股債相關性異常
  }
  if (marketData.commodity_volatility_abnormal) {
    score += 10 * weights.CROSS_ASSET;  // 商品市場異常波動
  }
  
  return Math.min(100, score);
}

// ==========================================
// 類別 3: 流動性壓力（Liquidity Stress）
// ==========================================

/**
 * 計算流動性壓力風險評分
 */
function calculateLiquidityStressScore(marketData) {
  let score = 0;
  const weights = DEFCON_CONFIG.signal_weights.LIQUIDITY_STRESS;
  
  // 信號 3-1: 市場深度
  if (marketData.bid_ask_spread_over_2pct) {
    score += 10 * weights.MARKET_DEPTH;  // 買賣價差擴大 > 2%
  }
  if (marketData.orderbook_depth_drop_over_50pct) {
    score += 15 * weights.MARKET_DEPTH;  // 訂單簿深度下降 > 50%
  }
  
  // 信號 3-2: 成交量異常
  if (marketData.volume_surge_over_300pct) {
    score += 10 * weights.VOLUME_ANOMALY;  // 成交量突然放大 > 300%
  }
  if (marketData.volume_decline_price_crash) {
    score += 15 * weights.VOLUME_ANOMALY;  // 成交量萎縮但價格暴跌
  }
  
  // 信號 3-3: 流動性指標
  if (marketData.bid_ask_spread_95th) {
    score += 10 * weights.LIQUIDITY_INDICATOR;  // Bid-Ask Spread > 歷史 95% 分位
  }
  if (marketData.market_impact_cost_rise) {
    score += 5 * weights.LIQUIDITY_INDICATOR;  // Market Impact 成本上升
  }
  
  return Math.min(100, score);
}

// ==========================================
// 類別 4: 情緒極端（Sentiment Extreme）
// ==========================================

/**
 * 計算情緒極端風險評分
 */
function calculateSentimentExtremeScore(marketData) {
  let score = 0;
  const weights = DEFCON_CONFIG.signal_weights.SENTIMENT_EXTREME;
  
  // 信號 4-1: 恐慌指標
  const vix = marketData.vix || 0;
  if (vix > 40) {
    score += 15 * weights.FEAR_GREED;  // VIX 恐慌指數 > 40
  }
  const putCallRatio = marketData.put_call_ratio || 0;
  if (putCallRatio > 1.5) {
    score += 10 * weights.FEAR_GREED;  // Put/Call Ratio > 1.5（極度恐慌）
  }
  
  // 信號 4-2: 貪婪指標（負分，但風險上升）
  if (vix < 12) {
    score -= 5 * weights.FEAR_GREED;  // VIX < 12（極度貪婪，但風險上升）
  }
  if (putCallRatio < 0.5) {
    score -= 10 * weights.FEAR_GREED;  // Put/Call Ratio < 0.5（極度貪婪，泡沫風險）
  }
  
  // 信號 4-3: SKEW 指數（最高權重）
  const skew = marketData.skew || 100;
  if (skew > 160) {
    score += 30 * weights.SKEW;  // SKEW > 160（極度危險）
  } else if (skew > 150) {
    score += 20 * weights.SKEW;  // SKEW > 150（崩盤風險高）
  } else if (skew > 140) {
    score += 10 * weights.SKEW;  // SKEW 130-140（尾部風險較高）
  }
  
  // SKEW > 150 且 VIX > 40 → 極度危險信號
  if (skew > 150 && vix > 40) {
    score += 20;  // 額外加分
  }
  
  return Math.max(0, Math.min(100, score));
}

// ==========================================
// 類別 5: 流動性枯竭（Liquidity Dry-up）
// ==========================================

/**
 * 計算流動性枯竭風險評分
 */
function calculateLiquidityDryupScore(marketData) {
  let score = 0;
  const weights = DEFCON_CONFIG.signal_weights.LIQUIDITY_DRYUP;
  
  // 信號 5-1: 高收益債利差（最高權重）
  const hySpread = marketData.hy_spread || 0;  // 單位：bps
  if (hySpread > 1000) {
    score += 30 * weights.HY_SPREAD;  // HY Spread > 1000 bps（觸發緊急協議）
  } else if (hySpread > 800) {
    score += 20 * weights.HY_SPREAD;  // HY Spread > 800 bps
  } else if (hySpread > 500) {
    score += 10 * weights.HY_SPREAD;  // HY Spread > 500 bps
  }
  
  // 信號 5-2: 信用市場壓力
  if (marketData.cds_spread_widen) {
    score += 10 * weights.CREDIT_STRESS;  // 信用違約交換（CDS）利差擴大
  }
  const igSpread = marketData.ig_spread || 0;  // 投資級債券利差（bps）
  if (igSpread > 200) {
    score += 15 * weights.CREDIT_STRESS;  // 投資級債券利差擴大 > 200 bps
  }
  if (marketData.interbank_rate_abnormal) {
    score += 10 * weights.CREDIT_STRESS;  // 銀行間拆借利率異常上升
  }
  
  // 信號 5-3: 跨資產相關性（股債同跌）
  const stockBondCorr = marketData.stock_bond_correlation || 0;
  if (stockBondCorr > 0.5) {
    score += 15 * weights.CROSS_ASSET_CORR;  // 股債相關性 > 0.5（正相關）
  }
  if (marketData.stock_bond_both_fall_over_3days) {
    score += 20 * weights.CROSS_ASSET_CORR;  // 股債同跌且持續 > 3 天
  }
  if (marketData.all_asset_classes_fall) {
    score += 25 * weights.CROSS_ASSET_CORR;  // 所有資產類別同時下跌（系統性風險）
  }
  
  return Math.min(100, score);
}

// ==========================================
// DEFCON 等級判定
// ==========================================

/**
 * 根據風險評分判定 DEFCON 等級
 */
function determineDEFCONLevel(riskScore) {
  const thresholds = DEFCON_CONFIG.defcon_thresholds;
  
  if (riskScore >= thresholds.DEFCON_1.min) {
    return "DEFCON_1";
  } else if (riskScore >= thresholds.DEFCON_2.min) {
    return "DEFCON_2";
  } else if (riskScore >= thresholds.DEFCON_3.min) {
    return "DEFCON_3";
  } else if (riskScore >= thresholds.DEFCON_4.min) {
    return "DEFCON_4";
  } else {
    return "DEFCON_5";
  }
}

// ==========================================
// 緊急觸發條件檢查
// ==========================================

/**
 * 檢查是否觸發緊急協議條件
 */
function checkEmergencyTriggers(defconLevel, marketData) {
  const triggers = [];
  
  // 條件 1：市場單日跌幅 > 7%
  if (marketData.daily_decline_over_7pct) {
    triggers.push({
      type: "DAILY_DECLINE_7PCT",
      severity: "HIGH",
      action: "立即減倉 50%"
    });
  }
  
  // 條件 2：DEFCON 1 + VIX > 50
  if (defconLevel === "DEFCON_1" && (marketData.vix || 0) > 50) {
    triggers.push({
      type: "DEFCON_1_VIX_50",
      severity: "CRITICAL",
      action: "立即減倉 70%"
    });
  }
  
  // 條件 3：流動性指標異常
  const hySpread = marketData.hy_spread || 0;
  if (hySpread > 1000) {
    triggers.push({
      type: "HY_SPREAD_1000",
      severity: "HIGH",
      action: "自動減倉 30-50%"
    });
  }
  
  // 條件 4：SKEW > 160（極度危險）
  if ((marketData.skew || 100) > 160) {
    triggers.push({
      type: "SKEW_EXTREME",
      severity: "CRITICAL",
      action: "觸發緊急協議"
    });
  }
  
  return triggers;
}

// ==========================================
// 輔助函數
// ==========================================

/**
 * 獲取 DEFCON 等級標籤
 */
function getDEFCONLabel(defconLevel) {
  return DEFCON_CONFIG.defcon_thresholds[defconLevel]?.label || "未知";
}

/**
 * 獲取 U_macro 調整值
 */
function getUMacroAdjustment(defconLevel) {
  return DEFCON_CONFIG.u_macro_adjustments[defconLevel] || 0.80;
}
