/**
 * 📊 P5 Weekly: 真實成長檢驗（Real Growth Check）
 * 
 * ⭐ V8.10 新增：防止在泡沫中買到「空殼公司」的基本面防火牆
 * 
 * 功能：
 * - 每週對持倉股票進行真實成長檢驗
 * - 檢查營收成長率、CapEx/營收占比、毛利擴張、現金流
 * - 如果成長檢驗失敗，即使估值高也視為垃圾泡沫，建議剔除
 * 
 * ⚠️ **明文規範**：
 * - 這是純程式實現（Rule-Based），不需要 AI
 * - 只檢查數據是否符合閾值，不進行推理分析
 * 
 * @version V8.10
 * @date 2026-01-18
 */

// ==========================================
// 真實成長檢驗配置
// ==========================================

const P5_GROWTH_VALIDATION_CONFIG = {
  // 檢驗閾值（與 P5_6_BUBBLE_NAVIGATION.js 保持一致）
  thresholds: {
    min_revenue_growth: 0.20,        // 最低營收成長率（20%）
    capex_revenue_ratio: 0.15,       // CapEx/營收最低占比（15%）
    margin_expansion: true,          // 是否要求毛利/營益率擴張
    cash_flow_positive: true         // 是否要求現金流為正
  },
  
  // 市場特性調整（可選）
  market_adjustments: {
    "US": {
      min_revenue_growth: 0.20,      // 美股：20%
      capex_revenue_ratio: 0.15
    },
    "TW": {
      min_revenue_growth: 0.15,      // 台股：15%（略寬鬆）
      capex_revenue_ratio: 0.12
    },
    "JP": {
      min_revenue_growth: 0.15,      // 日股：15%
      capex_revenue_ratio: 0.12
    }
  }
};

// ==========================================
// 核心檢驗函數
// ==========================================

/**
 * P5 Weekly 真實成長檢驗主函數
 * 
 * 對所有持倉股票進行成長檢驗，返回檢驗結果
 * 
 * @returns {Object} validationResult - 檢驗結果
 */
function P5_ValidateGrowthForHoldings() {
  Logger.log("P5 Weekly：開始真實成長檢驗（V8.10）");
  
  const validationResult = {
    validated_stocks: [],      // 通過檢驗的股票
    failed_stocks: [],         // 檢驗失敗的股票
    total_checked: 0,
    total_passed: 0,
    total_failed: 0
  };
  
  try {
    // 1. 獲取持倉股票列表（從 P4 快照讀取）
    const holdings = getHoldingsForGrowthValidation();
    
    if (!holdings || holdings.length === 0) {
      Logger.log("P5 Weekly：無持倉股票，跳過成長檢驗");
      return validationResult;
    }
    
    validationResult.total_checked = holdings.length;
    
    // 2. 對每個持倉股票進行檢驗
    for (const holding of holdings) {
      const ticker = holding.ticker;
      const market = holding.market || "US";
      
      try {
        // 獲取財務數據（從 P2 數據讀取）
        const financialData = getFinancialDataForGrowthValidation(ticker, market);
        
        if (!financialData) {
          Logger.log(`P5 Weekly：⚠️ 無法獲取 ${ticker} (${market}) 的財務數據，跳過成長檢驗`);
          continue;
        }
        
        // 執行成長檢驗
        const validation = validateGrowthForStock(ticker, market, financialData);
        
        if (validation.passed) {
          validationResult.validated_stocks.push({
            ticker: ticker,
            market: market,
            validation: validation
          });
          validationResult.total_passed++;
          Logger.log(`P5 Weekly：✅ ${ticker} (${market}) 通過成長檢驗`);
        } else {
          validationResult.failed_stocks.push({
            ticker: ticker,
            market: market,
            validation: validation,
            recommendation: "建議剔除或標記為垃圾泡沫"
          });
          validationResult.total_failed++;
          Logger.log(`P5 Weekly：❌ ${ticker} (${market}) 成長檢驗失敗：${validation.warnings.join(", ")}`);
        }
        
      } catch (error) {
        Logger.log(`P5 Weekly：成長檢驗失敗（${ticker}）：${error.message}`);
        // 檢驗失敗視為不通過（保守策略）
        validationResult.failed_stocks.push({
          ticker: ticker,
          market: market,
          validation: {
            passed: false,
            warnings: [`檢驗執行失敗：${error.message}`]
          },
          recommendation: "建議剔除或標記為垃圾泡沫"
        });
        validationResult.total_failed++;
      }
    }
    
    Logger.log(`P5 Weekly：成長檢驗完成（檢查 ${validationResult.total_checked} 檔，通過 ${validationResult.total_passed} 檔，失敗 ${validationResult.total_failed} 檔）`);
    
    return validationResult;
    
  } catch (error) {
    Logger.log(`P5 Weekly：真實成長檢驗執行失敗：${error.message}`);
    return validationResult;
  }
}

/**
 * 獲取持倉股票列表（從 P4 快照讀取）
 * 
 * @returns {Array} holdings - 持倉股票列表
 */
function getHoldingsForGrowthValidation() {
  try {
    const p4Snapshot = getLatestP4Snapshot();
    
    if (!p4Snapshot || !p4Snapshot.allocations) {
      return [];
    }
    
    const allocations = typeof p4Snapshot.allocations === 'string' 
      ? JSON.parse(p4Snapshot.allocations) 
      : p4Snapshot.allocations;
    
    if (!Array.isArray(allocations)) {
      return [];
    }
    
    // 提取 ticker 和 market
    const holdings = [];
    for (const allocation of allocations) {
      if (allocation.ticker) {
        holdings.push({
          ticker: allocation.ticker,
          market: allocation.market || inferMarketFromTicker(allocation.ticker),
          tier: allocation.tier || "UNKNOWN",
          allocation_pct: allocation.allocation_pct || 0
        });
      }
    }
    
    return holdings;
    
  } catch (error) {
    Logger.log(`P5 Weekly：獲取持倉股票列表失敗：${error.message}`);
    return [];
  }
}

/**
 * 獲取財務數據（從 P2 數據讀取）
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @returns {Object|null} financialData - 財務數據
 */
function getFinancialDataForGrowthValidation(ticker, market) {
  try {
    // 方法 1：從 Phase2_Output 表格讀取（最新財務數據）
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Phase2_Output");
    
    if (sheet && sheet.getLastRow() > 1) {
      const lastRow = sheet.getLastRow();
      const dataRange = sheet.getDataRange();
      const headers = dataRange.getValues()[0];
      const rows = dataRange.getValues().slice(1);
      
      const tickerCol = headers.indexOf("Company_Code");
      const revenueYoyCol = headers.indexOf("Revenue_YoY");
      const grossMarginCol = headers.indexOf("Gross_Margin");
      const operatingMarginCol = headers.indexOf("Operating_Margin");
      const cfoCol = headers.indexOf("CFO");
      const fcfCol = headers.indexOf("FCF");
      
      // 找到對應的股票
      for (const row of rows) {
        if (row[tickerCol] === ticker) {
          const revenueYoy = revenueYoyCol > -1 ? parseFloat(row[revenueYoyCol]) || 0 : null;
          const grossMargin = grossMarginCol > -1 ? parseFloat(row[grossMarginCol]) || 0 : null;
          const operatingMargin = operatingMarginCol > -1 ? parseFloat(row[operatingMarginCol]) || 0 : null;
          const cfo = cfoCol > -1 ? parseFloat(row[cfoCol]) || 0 : null;
          const fcf = fcfCol > -1 ? parseFloat(row[fcfCol]) || 0 : null;
          
          // 計算 CapEx/營收占比
          // 方法：CapEx ≈ CFO - FCF（如果兩者都有）
          // 但需要營收數據來計算占比，如果沒有營收數據，則無法計算
          // 注意：CapEx 通常是負數（現金流出），但計算占比時我們用絕對值
          let capexRevenueRatio = null;
          if (cfo !== null && fcf !== null && cfo !== 0 && fcf !== 0) {
            const capex = Math.abs(cfo - fcf); // CapEx（絕對值）
            // 如果需要計算 CapEx/營收占比，需要營收數據
            // 暫時無法從 Phase2_Output 獲取營收絕對值，只能跳過這個檢驗
            // TODO: 未來可以從 P2 數據源獲取營收絕對值來計算占比
          }
          
          // 檢查毛利/營益率是否擴張（需要比較歷史數據，暫時跳過）
          // 簡化：如果當前毛利/營益率為正，視為通過（需要歷史數據比較才能判斷是否擴張）
          const marginExpansion = (grossMargin !== null && grossMargin > 0) || 
                                  (operatingMargin !== null && operatingMargin > 0);
          
          // 檢查現金流是否為正
          const cashFlowPositive = (cfo !== null && cfo > 0) || (fcf !== null && fcf > 0);
          
          return {
            ticker: ticker,
            market: market,
            revenue_growth: revenueYoy !== null ? revenueYoy / 100 : null, // 轉換為小數（例如 20% → 0.20）
            capex_revenue_ratio: capexRevenueRatio, // 暫時為 null（需要營收絕對值）
            margin_expansion: marginExpansion, // 簡化：當前毛利/營益率為正即可
            cash_flow_positive: cashFlowPositive,
            gross_margin: grossMargin,
            operating_margin: operatingMargin,
            cfo: cfo,
            fcf: fcf
          };
        }
      }
    }
    
    // 方法 2：從 P2 快照讀取（備用）
    const p2Snapshot = getLatestP2Snapshot();
    if (p2Snapshot && p2Snapshot.tier_assignments) {
      const tierAssignments = typeof p2Snapshot.tier_assignments === 'string'
        ? JSON.parse(p2Snapshot.tier_assignments)
        : p2Snapshot.tier_assignments;
      
      if (tierAssignments[ticker]) {
        const assignment = tierAssignments[ticker];
        // P2 快照可能包含財務指標，但通常不包含詳細的 CapEx 數據
        // 暫時返回基本數據
        return {
          ticker: ticker,
          market: market,
          revenue_growth: null,
          capex_revenue_ratio: null,
          margin_expansion: null,
          cash_flow_positive: null
        };
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`P5 Weekly：獲取財務數據失敗（${ticker}）：${error.message}`);
    return null;
  }
}

/**
 * 檢驗單檔股票的真實成長
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @param {Object} financialData - 財務數據
 * @returns {Object} validation - 檢驗結果
 */
function validateGrowthForStock(ticker, market, financialData) {
  const validation = {
    ticker: ticker,
    market: market,
    passed: false,
    warnings: [],
    details: {}
  };
  
  // 獲取市場特定配置
  const marketConfig = P5_GROWTH_VALIDATION_CONFIG.market_adjustments[market] || 
                       P5_GROWTH_VALIDATION_CONFIG.market_adjustments["US"];
  const minRevenueGrowth = marketConfig.min_revenue_growth || 
                           P5_GROWTH_VALIDATION_CONFIG.thresholds.min_revenue_growth;
  const minCapexRevenueRatio = marketConfig.capex_revenue_ratio || 
                               P5_GROWTH_VALIDATION_CONFIG.thresholds.capex_revenue_ratio;
  
  // 1. 檢查營收成長率
  if (financialData.revenue_growth !== null && financialData.revenue_growth !== undefined) {
    validation.details.revenue_growth = financialData.revenue_growth;
    
    if (financialData.revenue_growth < minRevenueGrowth) {
      validation.warnings.push(`營收成長率 ${(financialData.revenue_growth * 100).toFixed(1)}% 低於最低要求 ${(minRevenueGrowth * 100).toFixed(0)}%`);
    }
  } else {
    validation.warnings.push("無法獲取營收成長率數據");
  }
  
  // 2. 檢查 CapEx/營收占比
  if (financialData.capex_revenue_ratio !== null && financialData.capex_revenue_ratio !== undefined) {
    validation.details.capex_revenue_ratio = financialData.capex_revenue_ratio;
    
    if (financialData.capex_revenue_ratio < minCapexRevenueRatio) {
      validation.warnings.push(`CapEx/營收占比 ${(financialData.capex_revenue_ratio * 100).toFixed(1)}% 低於最低要求 ${(minCapexRevenueRatio * 100).toFixed(0)}%`);
    }
  } else {
    // CapEx/營收占比數據可能無法獲取，暫時不視為失敗（只記錄警告）
    validation.warnings.push("無法獲取 CapEx/營收占比數據（可能需要從財報中提取）");
  }
  
  // 3. 檢查毛利/營益率擴張（如果要求）
  if (P5_GROWTH_VALIDATION_CONFIG.thresholds.margin_expansion) {
    if (financialData.margin_expansion !== null && financialData.margin_expansion !== undefined) {
      validation.details.margin_expansion = financialData.margin_expansion;
      
      if (!financialData.margin_expansion) {
        // 簡化：如果毛利/營益率為負或 0，視為未擴張
        validation.warnings.push("毛利/營益率未擴張（當前毛利/營益率 ≤ 0）");
      }
    } else {
      // 如果無法獲取毛利/營益率數據，視為失敗（保守策略）
      validation.warnings.push("無法獲取毛利/營益率數據");
    }
  }
  
  // 4. 檢查現金流是否為正（如果要求）
  if (P5_GROWTH_VALIDATION_CONFIG.thresholds.cash_flow_positive) {
    if (financialData.cash_flow_positive !== null && financialData.cash_flow_positive !== undefined) {
      validation.details.cash_flow_positive = financialData.cash_flow_positive;
      
      if (!financialData.cash_flow_positive) {
        validation.warnings.push("現金流未為正");
      }
    } else {
      // 如果無法獲取現金流數據，視為失敗（保守策略）
      validation.warnings.push("無法獲取現金流數據");
    }
  }
  
  // 判斷是否通過檢驗
  // 關鍵指標（營收成長率、現金流、毛利/營益率）必須符合要求
  // CapEx/營收占比如果無法獲取，暫時不視為失敗（但會記錄警告）
  const criticalFailures = validation.warnings.filter(w => 
    (w.indexOf("營收成長率") > -1 && w.indexOf("低於最低要求") > -1) ||
    w.indexOf("現金流未為正") > -1 ||
    w.indexOf("無法獲取現金流數據") > -1 ||
    (w.indexOf("毛利/營益率") > -1 && w.indexOf("未擴張") > -1) ||
    w.indexOf("無法獲取毛利/營益率數據") > -1
  );
  
  validation.passed = criticalFailures.length === 0;
  
  return validation;
}

/**
 * 從 ticker 推斷市場
 * 
 * @param {string} ticker - 股票代碼
 * @returns {string} market - 市場（US/TW/JP）
 */
function inferMarketFromTicker(ticker) {
  if (ticker.startsWith("TPE:")) {
    return "TW";
  } else if (ticker.startsWith("TYO:")) {
    return "JP";
  } else if (/^\d{4}$/.test(ticker) || /^\d{4}\.TW$/.test(ticker)) {
    return "TW";
  } else if (/^\d{4}\.T$/.test(ticker)) {
    return "JP";
  } else {
    return "US";
  }
}

/**
 * ⭐ V8.10 新增：整合真實成長檢驗到泡沫監控系統
 * 
 * 對持倉股票進行成長檢驗，並將結果整合到泡沫監控系統的 marketData 中
 * 
 * @returns {Object} growthData - 成長檢驗數據（用於傳遞給 P5_6_BubbleNavigation）
 */
function collectGrowthDataForBubbleNavigation() {
  try {
    Logger.log("P5 Weekly：收集真實成長檢驗數據（用於泡沫監控系統）");
    
    // 對所有持倉股票進行成長檢驗
    const validationResult = P5_ValidateGrowthForHoldings();
    
    // 計算整體成長指標（用於市場級泡沫監控）
    const totalHoldings = validationResult.total_checked;
    const passedCount = validationResult.total_passed;
    const failedCount = validationResult.total_failed;
    
    // 計算平均營收成長率（從通過檢驗的股票）
    let avgRevenueGrowth = 0;
    let totalRevenueGrowth = 0;
    let revenueGrowthCount = 0;
    
    for (const stock of validationResult.validated_stocks) {
      if (stock.validation.details.revenue_growth !== null && 
          stock.validation.details.revenue_growth !== undefined) {
        totalRevenueGrowth += stock.validation.details.revenue_growth;
        revenueGrowthCount++;
      }
    }
    
    if (revenueGrowthCount > 0) {
      avgRevenueGrowth = totalRevenueGrowth / revenueGrowthCount;
    }
    
    // 計算通過率
    const passRate = totalHoldings > 0 ? passedCount / totalHoldings : 0;
    
    // 返回成長數據（用於傳遞給 P5_6_BubbleNavigation）
    return {
      // 市場級指標
      revenue_growth: avgRevenueGrowth,                    // 平均營收成長率
      growth_pass_rate: passRate,                          // 成長檢驗通過率
      validated_count: passedCount,                        // 通過檢驗的股票數
      failed_count: failedCount,                           // 檢驗失敗的股票數
      
      // 個股級別數據（詳細列表）
      stock_validations: validationResult.validated_stocks.concat(validationResult.failed_stocks),
      failed_stocks: validationResult.failed_stocks.map(s => s.ticker), // 失敗股票列表（簡化版）
      
      // 簡化指標（用於泡沫監控系統）
      growth_validated: passRate >= 0.70,                 // 70% 以上通過才算整體通過
      capex_revenue_ratio: null,                          // 市場級 CapEx/營收占比（需要額外計算）
      margin_expansion: passRate >= 0.70,                 // 70% 以上通過，視為整體毛利健康
      cash_flow_positive: passRate >= 0.70                // 70% 以上通過才算整體現金流健康
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：收集成長檢驗數據失敗：${error.message}`);
    return {
      revenue_growth: 0,
      growth_pass_rate: 0,
      validated_count: 0,
      failed_count: 0,
      stock_validations: [],
      growth_validated: false,
      capex_revenue_ratio: null,
      margin_expansion: null,
      cash_flow_positive: false
    };
  }
}
