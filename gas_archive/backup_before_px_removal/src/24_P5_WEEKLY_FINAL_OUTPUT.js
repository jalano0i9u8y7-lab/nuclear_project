/**
 * 📊 P5 Weekly: 最終產出格式模組
 * ⭐ V8.15 新增
 * 
 * 實現 P5 Weekly 最終產出格式（對齊 IB 批次下單）：
 * - weekly_trade_actions：包含所有股票的掛單動作
 * - cancel_previous_orders：取消上週掛單
 * - new_orders：新掛單列表
 * - strategy_version：策略版本標記
 * 
 * @version SSOT V8.15
 * @date 2026-01-19
 */

/**
 * ⭐ V8.19 實戰模擬四：程式化 Parabolic Exit 檢查（賣給瘋子）
 * 規則：price > MA20 * 1.3 AND volume > avg_volume_20d * 2 → 觸發，建議賣出 30–50%
 * @param {string} ticker
 * @param {Object} context - 含 dailyData.technical_indicators[ticker], dailyData.ohlcv
 * @returns {{ triggered: boolean, suggest_sell_pct: number }} 
 */
function checkParabolicExhaustion(ticker, context) {
  try {
    const ti = context.dailyData && context.dailyData.technical_indicators ? context.dailyData.technical_indicators[ticker] : null;
    if (!ti || ti.ma20 == null || ti.volume_latest == null || ti.avg_volume_20d == null) {
      return { triggered: false, suggest_sell_pct: 0 };
    }
    const price = context.current_positions && context.current_positions[ticker] && context.current_positions[ticker].current_price != null
      ? context.current_positions[ticker].current_price
      : (ti.close_latest != null ? ti.close_latest : null);
    if (price == null || ti.avg_volume_20d <= 0) return { triggered: false, suggest_sell_pct: 0 };
    const overMa = price > ti.ma20 * 1.3;
    const volSpike = ti.volume_latest > ti.avg_volume_20d * 2;
    if (overMa && volSpike) {
      Logger.log("P5 Weekly V8.19：Parabolic Exhaustion 觸發 " + ticker + "（price > MA20*1.3, volume > avg*2）");
      return { triggered: true, suggest_sell_pct: 40 };
    }
    return { triggered: false, suggest_sell_pct: 0 };
  } catch (e) {
    Logger.log("P5 Weekly：checkParabolicExhaustion " + ticker + " 錯誤 " + e.message);
    return { triggered: false, suggest_sell_pct: 0 };
  }
}

/**
 * 生成 P5 Weekly 最終產出（對齊 IB 批次下單）
 * ⭐ V8.15 新增：整合 Strategy Skeleton 和 Parameter Adjustment Vector
 * ⭐ V8.19 新增：程式化 Parabolic Exit 檢查（實戰模擬四）
 * 
 * @param {Object} stockStrategies - 所有股票的策略結果（來自 P5-B/P5-A）
 * @param {Object} context - 上下文數據
 * @returns {Object} weekly_trade_actions - 最終產出格式
 */
function generateWeeklyTradeActions(stockStrategies, context) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const weekNumber = getWeekNumber(now);
    const strategyVersion = `W${year}-${weekNumber.toString().padStart(2, '0')}`;
    
    const weeklyTradeActions = {
      generated_at: now.toISOString(),
      strategy_version: strategyVersion,
      weekly_trade_actions: []
    };
    
    // 處理每檔股票
    for (const ticker in stockStrategies) {
      const strategy = stockStrategies[ticker];
      
      // ⭐ V8.17 地雷修復：檢查 Human Lock（優先級最高）
      const humanLock = typeof checkHumanLock === 'function' ? checkHumanLock(ticker) : null;
      
      if (humanLock && humanLock.locked === true) {
        Logger.log(`⚠️ P5 Weekly：${ticker} 存在 Human Lock，跳過 AI 策略，應用人類決策`);
        
        // 應用 Human Lock
        const humanDecision = typeof applyHumanLockIfExists === 'function' 
          ? applyHumanLockIfExists(ticker, strategy)
          : {
              action: humanLock.action,
              reason: humanLock.reason,
              human_override: true
            };
        
        // 構建該股票的 trade action（使用人類決策）
        const tradeAction = {
          ticker: ticker,
          cancel_previous_orders: true,  // 取消上週掛單
          previous_orders: context.open_orders?.[ticker] || [],
          new_orders: humanLock.action === "SELL" ? [
            {
              type: "SELL",
              price: null,  // 市價賣出
              qty: null,    // 全部
              order_id: `HUMAN_SELL_${ticker}_${Date.now()}`,
              formula: "HUMAN_LOCK",
              human_override: true,
              human_reason: humanLock.reason
            }
          ] : humanLock.action === "BUY" ? [
            {
              type: "BUY",
              price: null,  // 由人類指定或使用當前價格
              qty: null,    // 由人類指定
              order_id: `HUMAN_BUY_${ticker}_${Date.now()}`,
              formula: "HUMAN_LOCK",
              human_override: true,
              human_reason: humanLock.reason
            }
          ] : [],  // HOLD 或 ADJUST 不生成新訂單
          strategy_version: strategyVersion,
          evaluation_layer: "HUMAN_LOCK",
          escalation_reason: [`Human Lock: ${humanLock.reason}`],
          risk_frame: null,
          reasoning: `人類決策覆蓋：${humanLock.reason}`,
          human_override: true,
          human_lock_id: humanLock.signal_id
        };
        
        weeklyTradeActions.weekly_trade_actions.push(tradeAction);
        continue;  // 跳過 AI 策略處理
      }
      
      // ⭐ V8.17.3 新增：優先使用 AI 輸出的 order_plan
      const orderPlan = strategy.order_plan || 
                       strategy.p5_b_result?.order_plan || 
                       strategy.p5_a_result?.order_plan || null;
      
      // 獲取 Strategy Skeleton 和 Parameter Adjustment Vector（作為備用）
      const strategySkeleton = strategy.strategy_skeleton || null;
      const parameterAdjustmentVector = strategy.parameter_adjustment_vector || 
                                        strategy.p5_b_result?.parameter_adjustment_vector || null;
      
      // 獲取當前價格和 ATR
      const currentPrice = context.current_positions?.[ticker]?.current_price || 
                          context.dailyData?.ohlcv?.[ticker]?.close || 
                          context.dailyData?.technical_indicators?.[ticker]?.close_latest || null;
      const atr = context.dailyData?.technical_indicators?.[ticker]?.atr || null;
      
      // ⭐ V8.19 實戰模擬四：程式化 Parabolic Exit 檢查（賣給瘋子）
      const parabolicCheck = checkParabolicExhaustion(ticker, context);
      
      // 生成最終掛單
      let finalOrders = null;
      
      // ⭐ V8.17.3 新增：優先使用 AI 輸出的 order_plan
      if (orderPlan && Array.isArray(orderPlan) && orderPlan.length > 0) {
        var sellOrders = orderPlan.filter(function (o) { return o.side === "SELL"; }).map(function (order) {
          return {
            id: order.order_id,
            type: order.order_type,
            price: order.limit_price || null,
            trigger: order.trigger || null,
            qty: null,
            qty_percent: order.qty_percent || null,
            formula: order.order_type === "TRAIL" ? "TRAILING_STOP" : order.order_type === "STOP" ? "STOP @ " + order.trigger : order.order_type,
            is_trailing: order.order_type === "TRAIL",
            time_in_force: order.time_in_force || "GTC",
            expiration_date: order.expiration_date || null,
            order_validity: order.order_validity || null,
            oco_group_id: order.oco_group_id || null,
            attached_orders: order.attached_orders || null,
            execution_preference: order.execution_preference || "LIMIT_ONLY"
          };
        });
        if (parabolicCheck.triggered) {
          sellOrders.unshift({
            id: "PARABOLIC_EXHAUSTION_" + ticker + "_" + Date.now(),
            type: "MARKET",
            price: null,
            trigger: null,
            qty: null,
            qty_percent: parabolicCheck.suggest_sell_pct,
            formula: "PARABOLIC_EXHAUSTION: Sell " + parabolicCheck.suggest_sell_pct + "% into strength",
            is_trailing: false,
            time_in_force: "DAY",
            expiration_date: null,
            order_validity: "DAY",
            oco_group_id: null,
            attached_orders: null,
            execution_preference: "ADAPTIVE",
            sell_reason: "Price > MA20*1.3, volume > avg*2; parabolic run detected."
          });
        }
        finalOrders = {
          buy_orders: orderPlan.filter(function (o) { return o.side === "BUY"; }).map(function (order) {
            return {
              id: order.order_id,
              type: order.order_type,
              price: order.limit_price || null,
              trigger: order.trigger || null,
              qty: null,
              qty_percent: order.qty_percent || null,
              formula: order.order_type === "STOP_LIMIT" ? "STOP_LIMIT @ " + order.trigger + " (limit: " + order.limit_price + ")" : order.order_type === "LIMIT" ? "LIMIT @ " + order.limit_price : order.order_type,
              time_in_force: order.time_in_force || "GTC",
              oco_group_id: order.oco_group_id || null,
              attached_orders: order.attached_orders || null,
              execution_preference: order.execution_preference || "LIMIT_ONLY"
            };
          }),
          sell_orders: sellOrders
        };
        Logger.log("P5 Weekly：使用 AI 輸出的 order_plan（" + ticker + "，共 " + orderPlan.length + " 筆訂單）" + (parabolicCheck.triggered ? "；已注入 Parabolic Exhaustion 賣單" : ""));
      } else if (strategySkeleton && parameterAdjustmentVector && currentPrice && atr) {
        try {
          finalOrders = applyParameterAdjustmentVector(
            strategySkeleton,
            parameterAdjustmentVector,
            currentPrice,
            atr
          );
          if (finalOrders && parabolicCheck.triggered && finalOrders.sell_orders) {
            finalOrders.sell_orders.unshift({
              id: "PARABOLIC_EXHAUSTION_" + ticker + "_" + Date.now(),
              type: "MARKET",
              price: null,
              trigger: null,
              qty: null,
              qty_percent: parabolicCheck.suggest_sell_pct,
              formula: "PARABOLIC_EXHAUSTION: Sell " + parabolicCheck.suggest_sell_pct + "% into strength",
              is_trailing: false,
              time_in_force: "DAY",
              expiration_date: null,
              order_validity: "DAY",
              oco_group_id: null,
              attached_orders: null,
              execution_preference: "ADAPTIVE",
              sell_reason: "Price > MA20*1.3, volume > avg*2; parabolic run detected."
            });
          }
          Logger.log("P5 Weekly：使用 Strategy Skeleton 方式生成訂單（" + ticker + "）" + (parabolicCheck.triggered ? "；已注入 Parabolic Exhaustion 賣單" : ""));
        } catch (error) {
          Logger.log("P5 Weekly：應用 Parameter Adjustment Vector 失敗（" + ticker + "）：" + error.message);
        }
      }
      
      // 獲取上週掛單（用於取消）
      const previousOrders = context.open_orders?.[ticker] || [];
      
      // 獲取 strategy_script（如果有的話）
      const strategyScript = strategy.strategy_script || 
                            strategy.p5_b_result?.strategy_script || 
                            strategy.p5_a_result?.strategy_script || null;
      
      // 構建該股票的 trade action
      const tradeAction = {
        ticker: ticker,
        cancel_previous_orders: previousOrders.length > 0,
        previous_orders: previousOrders.map(order => ({
          order_id: order.order_id || order.id,
          type: order.type || order.side,
          price: order.price,
          qty: order.qty || order.quantity
        })),
        new_orders: finalOrders ? [
          ...finalOrders.buy_orders.map(order => ({
            type: "BUY",
            order_type: order.type || "LIMIT",
            price: order.price,
            trigger: order.trigger || null,
            qty: order.qty || null,  // 數量由 P4 決定（基於 qty_percent）
            qty_percent: order.qty_percent || null,
            order_id: order.id,
            formula: order.formula,
            time_in_force: order.time_in_force || "GTC",
            expiration_date: order.expiration_date || null,  // ⭐ 工程師修復：GTD 訂單的到期日（格式：YYYY-MM-DD）
            order_validity: order.order_validity || null,  // ⭐ 工程師修復：訂單有效期說明（例如："DAY"、"GTC"、"GTD until 2026-01-25"）
            oco_group_id: order.oco_group_id || null,
            attached_orders: order.attached_orders || null,
            execution_preference: order.execution_preference || "LIMIT_ONLY"  // ⭐ V8.18 新增：掛單滑價優化
          })),
          ...finalOrders.sell_orders.map(order => ({
            type: "SELL",
            order_type: order.type || "LIMIT",
            price: order.price,
            trigger: order.trigger || null,
            qty: order.qty || null,  // 數量由 P4 決定
            qty_percent: order.qty_percent || null,
            order_id: order.id,
            formula: order.formula,
            is_trailing: order.is_trailing || false,
            time_in_force: order.time_in_force || "GTC",
            oco_group_id: order.oco_group_id || null,
            attached_orders: order.attached_orders || null,
            execution_preference: order.execution_preference || "LIMIT_ONLY"  // ⭐ V8.18 新增：掛單滑價優化
          }))
        ] : [],
        strategy_version: strategyVersion,
        evaluation_layer: strategy.evaluation_layer || "P5_B",
        escalation_reason: strategy.escalation_reason || [],
        risk_frame: finalOrders?.risk_frame || null,
        reasoning: strategy.reasoning || strategy.p5_b_result?.reasoning || null,
        strategy_script: strategyScript  // ⭐ V8.17.3 新增：策略劇本說明
      };
      
      weeklyTradeActions.weekly_trade_actions.push(tradeAction);
    }
    
    Logger.log(`P5 Weekly：生成最終產出 - 共 ${weeklyTradeActions.weekly_trade_actions.length} 檔股票`);
    
    return weeklyTradeActions;
    
  } catch (error) {
    Logger.log(`P5 Weekly：生成最終產出失敗：${error.message}`);
    throw error;
  }
}

/**
 * 獲取週數（輔助函數）
 * 
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
