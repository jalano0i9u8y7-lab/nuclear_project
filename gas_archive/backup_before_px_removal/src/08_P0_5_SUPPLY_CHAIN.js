/**
 * 🔗 P0.5: 供應鏈風險監控（Supply Chain Risk Monitoring）
 * 
 * ⭐ V8.0 統整：從 P0.6 遷移，整合到 P0.5
 * 
 * 供應鏈風險監控
 * 上下游影響分析
 * 供應商財務追蹤
 * 
 * @version SSOT V8.0
 * @date 2025-01-15
 */

const P0_5_SUPPLY_CHAIN_CONFIG = {
  risk_levels: {
    "LOW": { action: "MONITOR", threshold: 30 },
    "MEDIUM": { action: "REDUCE_EXPOSURE", threshold: 50 },
    "HIGH": { action: "EXIT_OR_HEDGE", threshold: 70 }
  },
  
  // 供應商財務健康指標
  supplier_health_indicators: {
    "HEALTHY": { score_range: [70, 100], action: "MONITOR" },
    "WARNING": { score_range: [40, 70], action: "REDUCE_EXPOSURE" },
    "CRITICAL": { score_range: [0, 40], action: "EXIT_OR_HEDGE" }
  }
};

/**
 * P0.5 供應鏈風險監控主函數
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} supplyChainData - 供應鏈數據
 * @returns {Object} 風險評估結果
 */
function P0_5_SupplyChainRiskMonitoring(ticker, supplyChainData) {
  try {
    Logger.log(`P0.5 供應鏈風險監控：ticker=${ticker}`);
    
    // 功能 4：供應鏈風險監控
    const riskAssessment = assessSupplyChainRisk(ticker, supplyChainData);
    
    // 功能 5：上下游影響分析
    const impact = analyzeUpstreamDownstream(ticker, supplyChainData);
    
    // 功能 6：供應商財務追蹤
    const financialTracking = trackSupplierFinancials(ticker, supplyChainData);
    
    return {
      ticker,
      risk_level: riskAssessment.level,
      risk_score: riskAssessment.score,
      impact_analysis: impact,
      financial_tracking: financialTracking,
      recommendation: P0_5_SUPPLY_CHAIN_CONFIG.risk_levels[riskAssessment.level].action,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    Logger.log(`P0.5 供應鏈風險監控失敗：${error.message}`);
    throw error;
  }
}

/**
 * 功能 4：評估供應鏈風險
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} data - 供應鏈數據
 * @returns {Object} 風險評估結果
 */
function assessSupplyChainRisk(ticker, data) {
  const riskFactors = {
    supplier_concentration: data.supplier_concentration || 0,  // 供應商集中度
    geographic_risk: data.geographic_risk || 0,  // 地理風險
    financial_health: data.supplier_financial_health || 50,  // 供應商財務健康度
    interruption_history: data.interruption_history || 0,  // 中斷歷史
    alternative_suppliers: data.alternative_suppliers || 0  // 替代供應商數量
  };
  
  // 計算風險評分（0-100，越高越危險）
  let riskScore = 0;
  
  // 供應商集中度風險（權重 30%）
  if (riskFactors.supplier_concentration > 0.7) {
    riskScore += 30;  // 高度集中，風險高
  } else if (riskFactors.supplier_concentration > 0.5) {
    riskScore += 15;
  }
  
  // 地理風險（權重 20%）
  if (riskFactors.geographic_risk > 0.7) {
    riskScore += 20;  // 高地理風險（例如：單一國家依賴）
  } else if (riskFactors.geographic_risk > 0.5) {
    riskScore += 10;
  }
  
  // 財務健康風險（權重 30%）
  if (riskFactors.financial_health < 40) {
    riskScore += 30;  // 財務健康度低
  } else if (riskFactors.financial_health < 60) {
    riskScore += 15;
  }
  
  // 中斷歷史風險（權重 10%）
  if (riskFactors.interruption_history > 2) {
    riskScore += 10;  // 過去有多次中斷
  }
  
  // 替代供應商緩解（權重 10%，負向）
  if (riskFactors.alternative_suppliers >= 3) {
    riskScore -= 10;  // 有足夠替代供應商，降低風險
  } else if (riskFactors.alternative_suppliers === 0) {
    riskScore += 10;  // 無替代供應商，增加風險
  }
  
  // 限制在 0-100 範圍
  riskScore = Math.max(0, Math.min(100, riskScore));
  
  // 確定風險等級
  let riskLevel = "LOW";
  if (riskScore >= P0_5_SUPPLY_CHAIN_CONFIG.risk_levels.HIGH.threshold) {
    riskLevel = "HIGH";
  } else if (riskScore >= P0_5_SUPPLY_CHAIN_CONFIG.risk_levels.MEDIUM.threshold) {
    riskLevel = "MEDIUM";
  }
  
  return {
    level: riskLevel,
    score: riskScore,
    factors: riskFactors
  };
}

/**
 * 功能 5：分析上下游影響
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} data - 供應鏈數據
 * @returns {Object} 影響分析結果
 */
function analyzeUpstreamDownstream(ticker, data) {
  const upstreamImpact = {
    cost_sensitivity: data.upstream_cost_sensitivity || 0,  // 上游成本敏感度
    supply_chain_depth: data.supply_chain_depth || 0,  // 供應鏈深度
    bottleneck_risk: data.bottleneck_risk || 0  // 瓶頸風險
  };
  
  const downstreamImpact = {
    demand_sensitivity: data.downstream_demand_sensitivity || 0,  // 下游需求敏感度
    customer_concentration: data.customer_concentration || 0,  // 客戶集中度
    pricing_power: data.pricing_power || 0  // 定價權
  };
  
  // 計算上游風險
  let upstreamRisk = "LOW";
  if (upstreamImpact.cost_sensitivity > 0.7 || upstreamImpact.bottleneck_risk > 0.7) {
    upstreamRisk = "HIGH";
  } else if (upstreamImpact.cost_sensitivity > 0.5 || upstreamImpact.bottleneck_risk > 0.5) {
    upstreamRisk = "MEDIUM";
  }
  
  // 計算下游影響
  let downstreamImpactLevel = "LOW";
  if (downstreamImpact.demand_sensitivity > 0.7 || downstreamImpact.customer_concentration > 0.7) {
    downstreamImpactLevel = "HIGH";
  } else if (downstreamImpact.demand_sensitivity > 0.5 || downstreamImpact.customer_concentration > 0.5) {
    downstreamImpactLevel = "MEDIUM";
  }
  
  return {
    upstream_risk: upstreamRisk,
    upstream_factors: upstreamImpact,
    downstream_impact: downstreamImpactLevel,
    downstream_factors: downstreamImpact,
    capital_flow: {
      inflow: data.capital_inflow || 0,
      outflow: data.capital_outflow || 0,
      net_flow: (data.capital_inflow || 0) - (data.capital_outflow || 0)
    }
  };
}

/**
 * 功能 6：追蹤供應商財務健康
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} data - 供應鏈數據
 * @returns {Object} 財務追蹤結果
 */
function trackSupplierFinancials(ticker, data) {
  const suppliers = data.suppliers || [];
  const financialTracking = {
    total_suppliers: suppliers.length,
    healthy_count: 0,
    warning_count: 0,
    critical_count: 0,
    suppliers_detail: []
  };
  
  for (const supplier of suppliers) {
    const financialHealth = supplier.financial_health || 50;
    const creditRating = supplier.credit_rating || "UNKNOWN";
    const bankruptcyRisk = supplier.bankruptcy_risk || 0;
    
    let healthStatus = "HEALTHY";
    if (financialHealth < P0_5_SUPPLY_CHAIN_CONFIG.supplier_health_indicators.CRITICAL.score_range[1]) {
      healthStatus = "CRITICAL";
      financialTracking.critical_count++;
    } else if (financialHealth < P0_5_SUPPLY_CHAIN_CONFIG.supplier_health_indicators.WARNING.score_range[1]) {
      healthStatus = "WARNING";
      financialTracking.warning_count++;
    } else {
      financialTracking.healthy_count++;
    }
    
    financialTracking.suppliers_detail.push({
      supplier_name: supplier.name || "UNKNOWN",
      financial_health: financialHealth,
      credit_rating: creditRating,
      bankruptcy_risk: bankruptcyRisk,
      health_status: healthStatus,
      last_update: supplier.last_update || new Date().toISOString()
    });
  }
  
  // 計算整體財務健康評分
  const avgFinancialHealth = suppliers.length > 0 ?
    suppliers.reduce((sum, s) => sum + (s.financial_health || 50), 0) / suppliers.length :
    50;
  
  return {
    ...financialTracking,
    average_financial_health: avgFinancialHealth,
    overall_status: avgFinancialHealth >= 70 ? "HEALTHY" :
                    avgFinancialHealth >= 40 ? "WARNING" : "CRITICAL"
  };
}
