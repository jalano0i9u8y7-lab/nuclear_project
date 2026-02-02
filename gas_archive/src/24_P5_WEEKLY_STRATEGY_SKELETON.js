/**
 * 📊 P5 Weekly: Strategy Skeleton 與 Parameter Adjustment Vector 模組
 * ⭐ V8.15 新增
 * 
 * 實現 Strategy Skeleton（策略骨架）+ AI Parameter Layer（AI 參數調整層）設計：
 * - Strategy Skeleton：由程式生成，AI 不得修改結構
 * - Parameter Adjustment Vector：AI 只輸出參數調整，不輸出價位
 * - 實際掛單價格：由程式套公式算出
 * 
 * @version SSOT V8.15
 * @date 2026-01-19
 */

// ==========================================
// Strategy Skeleton 生成器
// ==========================================

/**
 * 生成 Strategy Skeleton（策略骨架）
 * ⭐ V8.15 新增：由程式生成，AI 不得修改結構
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} p3Data - P3 技術面數據
 * @param {Object} p4Data - P4 資金配置數據
 * @param {Object} dailyData - Daily 數據（OHLCV、ATR 等）
 * @returns {Object} strategy_skeleton - 策略骨架
 */
function generateStrategySkeleton(ticker, p3Data, p4Data, dailyData) {
  try {
    // 從 P3 讀取技術結構
    const technicalResults = p3Data?.technical_results || p3Data || {};
    const keyLevels = technicalResults.key_levels || {};
    const regime = technicalResults.regime || "TRENDING";
    
    // 從 Daily 讀取 ATR 和當前價格
    const currentPrice = dailyData?.close || dailyData?.ohlcv?.close || null;
    const atr = dailyData?.atr || dailyData?.technical_indicators?.atr || null;
    
    if (!currentPrice || !atr) {
      Logger.log(`P5 Weekly：無法生成 Strategy Skeleton（${ticker}），缺少價格或 ATR 數據`);
      return null;
    }
    
    // 從 P3 讀取支撐壓力位
    const support1 = keyLevels.support_1 || currentPrice * 0.95;  // 預設 5% 支撐
    const support2 = keyLevels.support_2 || currentPrice * 0.90;  // 預設 10% 支撐
    const resistance1 = keyLevels.resistance_1 || currentPrice * 1.05;  // 預設 5% 壓力
    const resistance2 = keyLevels.resistance_2 || currentPrice * 1.10;  // 預設 10% 壓力
    
    // 從 P4 讀取倉位上限
    const maxPosition = p4Data?.max_position || p4Data?.allocation?.max_position || 0.15;
    
    // 生成 Buy Ladder（買入階梯）
    const buyLadder = [
      {
        id: "B1",
        formula: `support_1 - k1 * ATR`,
        base_price: support1,
        atr_multiplier: 0.5,  // k1 = 0.5
        description: "第一層買入（接近支撐 1）"
      },
      {
        id: "B2",
        formula: `support_2 - k2 * ATR`,
        base_price: support2,
        atr_multiplier: 0.3,  // k2 = 0.3
        description: "第二層買入（接近支撐 2）"
      },
      {
        id: "B3",
        formula: `support_2 - k3 * ATR`,
        base_price: support2,
        atr_multiplier: 0.5,  // k3 = 0.5
        description: "第三層買入（支撐 2 下方）"
      }
    ];
    
    // 生成 Sell Ladder（賣出階梯）
    const sellLadder = [
      {
        id: "S1",
        formula: `resistance_1 + k3 * ATR`,
        base_price: resistance1,
        atr_multiplier: 0.3,  // k3 = 0.3
        description: "第一層賣出（接近壓力 1）"
      },
      {
        id: "S2",
        formula: `trailing_stop`,
        base_price: currentPrice,
        atr_multiplier: null,  // 追蹤停利，動態計算
        description: "追蹤停利（動態）"
      }
    ];
    
    // 生成 Risk Frame（風險框架）
    const riskFrame = {
      max_position: maxPosition,
      stop_rule: technicalResults.stop_rule || "structure_break",
      invalidation_levels: keyLevels.invalidation_levels || [],
      trailing_stop_base: currentPrice
    };
    
    return {
      strategy_skeleton: {
        buy_ladder: buyLadder,
        sell_ladder: sellLadder,
        risk_frame: riskFrame
      },
      metadata: {
        ticker: ticker,
        generated_at: new Date().toISOString(),
        current_price: currentPrice,
        atr: atr,
        regime: regime,
        key_levels: keyLevels
      }
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：生成 Strategy Skeleton 失敗（${ticker}）：${error.message}`);
    return null;
  }
}

/**
 * 應用 Parameter Adjustment Vector 到 Strategy Skeleton
 * ⭐ V8.15 新增：根據 AI 輸出的參數調整向量，計算實際掛單價格
 * 
 * @param {Object} strategySkeleton - 策略骨架
 * @param {Object} parameterAdjustmentVector - AI 輸出的參數調整向量
 * @param {number} currentPrice - 當前價格
 * @param {number} atr - ATR 值
 * @returns {Object} finalOrders - 最終掛單列表
 */
function applyParameterAdjustmentVector(strategySkeleton, parameterAdjustmentVector, currentPrice, atr) {
  try {
    if (!strategySkeleton || !strategySkeleton.strategy_skeleton) {
      throw new Error("Strategy Skeleton 無效");
    }
    
    const skeleton = strategySkeleton.strategy_skeleton;
    const adjustments = parameterAdjustmentVector || {};
    
    // 解析調整參數
    const buyBias = parseFloat(adjustments.buy_bias) || 0.0;  // -1.0 到 1.0
    const sellBias = parseFloat(adjustments.sell_bias) || 0.0;  // -1.0 到 1.0
    const ladderSpacingAdjustment = parseAdjustmentPercentage(adjustments.ladder_spacing_adjustment) || 0.0;  // 例如 "+10%" = 0.1
    const trailingStopTightness = parseAdjustmentPercentage(adjustments.trailing_stop_tightness) || 0.0;  // 例如 "+15%" = 0.15
    const maxPositionCapOverride = adjustments.max_position_cap_override || null;
    
    // 計算實際掛單價格
    const finalOrders = {
      buy_orders: [],
      sell_orders: [],
      risk_frame: {}
    };
    
    // 處理 Buy Ladder
    skeleton.buy_ladder.forEach((buyStep, index) => {
      let basePrice = buyStep.base_price;
      let atrMultiplier = buyStep.atr_multiplier || 0.5;
      
      // 應用 ladder_spacing_adjustment
      atrMultiplier = atrMultiplier * (1 + ladderSpacingAdjustment);
      
      // 計算原始價格
      let calculatedPrice = basePrice - (atrMultiplier * atr);
      
      // ⭐ V8.27 修正：buy_bias 公式
      // buy_bias 正數 = 價格上調（更積極）
      // buy_bias 負數 = 價格下調（更保守）
      calculatedPrice = calculatedPrice * (1 + buyBias * 0.1);  // buy_bias = +0.15 表示價格上調 1.5%，buy_bias = -0.15 表示價格下調 1.5%
      
      finalOrders.buy_orders.push({
        id: buyStep.id,
        type: "BUY",
        price: Math.round(calculatedPrice * 100) / 100,  // 保留 2 位小數
        qty: null,  // 數量由 P4 決定
        formula: buyStep.formula,
        adjustments_applied: {
          buy_bias: buyBias,
          ladder_spacing_adjustment: ladderSpacingAdjustment
        }
      });
    });
    
    // 處理 Sell Ladder
    skeleton.sell_ladder.forEach((sellStep, index) => {
      if (sellStep.id === "S2" && sellStep.formula === "trailing_stop") {
        // 追蹤停利：動態計算
        const trailingStopBase = skeleton.risk_frame.trailing_stop_base || currentPrice;
        const trailingStopDistance = atr * (1.5 + trailingStopTightness);  // 預設 1.5 ATR，加上調整
        const trailingStopPrice = trailingStopBase - trailingStopDistance;
        
        finalOrders.sell_orders.push({
          id: sellStep.id,
          type: "SELL",
          price: Math.round(trailingStopPrice * 100) / 100,
          qty: null,  // 數量由 P4 決定
          formula: "trailing_stop",
          is_trailing: true,
          adjustments_applied: {
            sell_bias: sellBias,
            trailing_stop_tightness: trailingStopTightness
          }
        });
      } else {
        // 一般賣出階梯
        let basePrice = sellStep.base_price;
        let atrMultiplier = sellStep.atr_multiplier || 0.3;
        
        // 應用 ladder_spacing_adjustment
        atrMultiplier = atrMultiplier * (1 + ladderSpacingAdjustment);
        
        // 計算原始價格
        let calculatedPrice = basePrice + (atrMultiplier * atr);
        
        // 應用 sell_bias（正數表示更積極賣出，負數表示更保守）
        calculatedPrice = calculatedPrice * (1 + sellBias * 0.1);  // sell_bias = 0.20 表示價格上調 2%
        
        finalOrders.sell_orders.push({
          id: sellStep.id,
          type: "SELL",
          price: Math.round(calculatedPrice * 100) / 100,
          qty: null,  // 數量由 P4 決定
          formula: sellStep.formula,
          adjustments_applied: {
            sell_bias: sellBias,
            ladder_spacing_adjustment: ladderSpacingAdjustment
          }
        });
      }
    });
    
    // 處理 Risk Frame
    finalOrders.risk_frame = {
      max_position: maxPositionCapOverride !== null && maxPositionCapOverride !== undefined ? 
                    maxPositionCapOverride : skeleton.risk_frame.max_position,
      stop_rule: skeleton.risk_frame.stop_rule,
      invalidation_levels: skeleton.risk_frame.invalidation_levels,
      trailing_stop_tightness_applied: trailingStopTightness
    };
    
    return finalOrders;
    
  } catch (error) {
    Logger.log(`P5 Weekly：應用 Parameter Adjustment Vector 失敗：${error.message}`);
    throw error;
  }
}

/**
 * 解析調整百分比字符串（例如 "+10%" 或 "-15%"）
 * 
 * @param {string} adjustmentStr - 調整字符串
 * @returns {number} adjustment - 調整值（例如 "+10%" = 0.1）
 */
function parseAdjustmentPercentage(adjustmentStr) {
  if (!adjustmentStr || typeof adjustmentStr !== "string") {
    return 0.0;
  }
  
  // 移除空格和百分號
  const cleaned = adjustmentStr.trim().replace("%", "");
  
  // 解析數字
  const value = parseFloat(cleaned);
  if (isNaN(value)) {
    return 0.0;
  }
  
  // 轉換為小數（例如 10% = 0.1）
  return value / 100.0;
}

/**
 * 執行 Milestone Check（P2 Milestones 自動對帳）
 * ⭐ V8.15 新增：在 P5-B 中執行，比對 P2 milestones_to_verify 與週度新聞
 * 
 * @param {string} ticker - 股票代碼
 * @param {Array} milestones - P2 milestones_to_verify 列表
 * @param {Object} newsIndex - 週度新聞索引
 * @returns {Object} milestoneCheckResult - 里程碑檢查結果
 */
function performMilestoneCheck(ticker, milestones, newsIndex) {
  try {
    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
      return {
        status: "NO_MILESTONES",
        matched: [],
        pending: [],
        missed: []
      };
    }
    
    const matched = [];
    const pending = [];
    const missed = [];
    
    // 獲取該股票的新聞索引
    const stockNews = newsIndex?.[ticker] || [];
    const newsText = stockNews.map(n => (n.title || "") + " " + (n.summary || "")).join(" ").toLowerCase();
    
    // 檢查每個里程碑
    milestones.forEach(milestone => {
      const milestoneText = (milestone.description || milestone.milestone || "").toLowerCase();
      const milestoneKeywords = milestoneText.split(/\s+/).filter(w => w.length > 3);  // 過濾短詞
      
      // 檢查新聞中是否包含里程碑關鍵詞
      const isMatched = milestoneKeywords.some(keyword => newsText.includes(keyword));
      
      // 檢查時間窗口
      const daysUntil = milestone.days_until || milestone.expected_date ? 
        Math.floor((new Date(milestone.expected_date) - new Date()) / (1000 * 60 * 60 * 24)) : 999;
      
      if (isMatched) {
        matched.push({
          milestone: milestone,
          matched_at: new Date().toISOString(),
          news_snippet: stockNews.find(n => {
            const nText = ((n.title || "") + " " + (n.summary || "")).toLowerCase();
            return milestoneKeywords.some(k => nText.includes(k));
          })
        });
      } else if (daysUntil < 0) {
        // 已過期但未達成
        missed.push({
          milestone: milestone,
          days_overdue: Math.abs(daysUntil)
        });
      } else {
        // 待達成
        pending.push({
          milestone: milestone,
          days_until: daysUntil
        });
      }
    });
    
    return {
      status: matched.length > 0 ? "HAS_MATCHED" : (missed.length > 0 ? "HAS_MISSED" : "ALL_PENDING"),
      matched: matched,
      pending: pending,
      missed: missed,
      summary: {
        total: milestones.length,
        matched_count: matched.length,
        pending_count: pending.length,
        missed_count: missed.length
      }
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：Milestone Check 失敗（${ticker}）：${error.message}`);
    return {
      status: "ERROR",
      error: error.message,
      matched: [],
      pending: [],
      missed: []
    };
  }
}
