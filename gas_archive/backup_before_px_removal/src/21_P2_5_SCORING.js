/**
 * 💰 P2.5: Smart_Money_Score 評分計算
 * 
 * 計算綜合籌碼面評分（Smart_Money_Score）
 * 
 * @version SSOT V7.1
 * @date 2025-01-15
 */

/**
 * 計算 Smart_Money_Score（綜合籌碼面評分）
 * @param {Object} executorOutput - 執行者輸出
 * @param {Object} smartMoneyData - 籌碼面數據
 * @return {Object} 每個股票的 Smart_Money_Score（0-100）
 */
function calculateSmartMoneyScores(executorOutput, smartMoneyData) {
  const smartMoneyAnalysis = executorOutput.smart_money_analysis || {};
  const tickers = Object.keys(smartMoneyAnalysis);
  const scores = {};
  
  for (const ticker of tickers) {
    const analysis = smartMoneyAnalysis[ticker] || {};
    
    // 1. 機構持倉評分（權重 35%）
    const institutionalScore = calculateInstitutionalHoldingsScore(analysis.institutional_holdings || {});
    
    // 2. 內部人交易評分（權重 25%）
    const insiderScore = calculateInsiderTradingScore(analysis.insider_trading || {});
    
    // 3. 期權活動評分（權重 20%）
    const optionsScore = calculateOptionsFlowScore(analysis.options_flow || {});
    
    // 4. Dark Pool 活動評分（權重 20%）
    const darkPoolScore = calculateDarkPoolScore(analysis.dark_pool_activity || {});
    
    // 5. 對沖基金 Clone 評分（額外加分，最高 10 分）
    const cloneBonus = (analysis.hedge_fund_clone?.clone_score || 0) * 10;
    
    // 加權平均
    const weightedScore = 
      institutionalScore * P2_5_CONFIG.scoring_weights.institutional_holdings +
      insiderScore * P2_5_CONFIG.scoring_weights.insider_trading +
      optionsScore * P2_5_CONFIG.scoring_weights.options_flow +
      darkPoolScore * P2_5_CONFIG.scoring_weights.dark_pool +
      cloneBonus;
    
    // 限制在 0-100 範圍
    scores[ticker] = Math.max(0, Math.min(100, weightedScore));
  }
  
  return scores;
}

/**
 * 計算內部人交易評分（0-100）
 * @param {Object} insiderTrading - 內部人交易數據
 * @return {number} 評分（0-100）
 */
function calculateInsiderTradingScore(insiderTrading) {
  const signal = insiderTrading.signal || "NEUTRAL";
  const buyCount = insiderTrading.buy_count || 0;
  const sellCount = insiderTrading.sell_count || 0;
  const totalBuyAmount = insiderTrading.total_buy_amount || 0;
  const totalSellAmount = insiderTrading.total_sell_amount || 0;
  
  let score = 50;  // 基礎分數 50
  
  if (signal === "BULLISH") {
    score += 30;
  } else if (signal === "BEARISH") {
    score -= 30;
  }
  
  // 根據交易金額調整
  if (totalBuyAmount > totalSellAmount * 2) {
    score += 10;
  } else if (totalSellAmount > totalBuyAmount * 2) {
    score -= 10;
  }
  
  // 根據交易頻率調整
  if (buyCount > sellCount * 2) {
    score += 10;
  } else if (sellCount > buyCount * 2) {
    score -= 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 計算期權活動評分（0-100）
 * @param {Object} optionsFlow - 期權活動數據
 * @return {number} 評分（0-100）
 */
function calculateOptionsFlowScore(optionsFlow) {
  const sentiment = optionsFlow.sentiment || "NEUTRAL";
  const unusualActivity = optionsFlow.unusual_activity || false;
  const putCallRatio = optionsFlow.put_call_ratio || 0.5;
  
  let score = 50;  // 基礎分數 50
  
  if (sentiment === "BULLISH") {
    score += 25;
  } else if (sentiment === "BEARISH") {
    score -= 25;
  }
  
  // 異常活動加分（表示機構關注度高）
  if (unusualActivity) {
    score += 10;
  }
  
  // Put/Call Ratio 極端值調整
  if (putCallRatio < 0.4) {
    score += 10;  // 極度看漲
  } else if (putCallRatio > 1.5) {
    score -= 10;  // 極度看跌
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 計算 Dark Pool 活動評分（0-100）
 * @param {Object} darkPoolActivity - Dark Pool 活動數據
 * @return {number} 評分（0-100）
 */
function calculateDarkPoolScore(darkPoolActivity) {
  const sentiment = darkPoolActivity.sentiment || "NEUTRAL";
  const unusualVolume = darkPoolActivity.unusual_volume || false;
  const netFlow = darkPoolActivity.net_flow || 0;
  
  let score = 50;  // 基礎分數 50
  
  if (sentiment === "BULLISH") {
    score += 25;
  } else if (sentiment === "BEARISH") {
    score -= 25;
  }
  
  // 異常成交量加分（表示 Smart Money 活動）
  if (unusualVolume) {
    score += 15;
  }
  
  // 根據淨流量調整
  if (netFlow > 0) {
    score += 10;
  } else if (netFlow < 0) {
    score -= 10;
  }
  
  return Math.max(0, Math.min(100, score));
}
