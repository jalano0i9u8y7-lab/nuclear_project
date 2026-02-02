/**
 * 🚨 P6: 盤中緊急撤退協議
 * 
 * ⭐ V8.0 新增：從 P4.6 搬移，盤中即時防禦（Layer 1，寫死，無 AI）
 * 
 * ⚠️ **明文規範**：
 * - P6 盤中只允許 Rule-Based（% + ATR + Volume）
 * - 盤中任何決策不得調用 AI
 * - AI 僅能在盤後（P3/P5）使用 P6 事件作為輔助因子
 * - P6 只負責「狀態標記」和「通知」，不自動下單、不改掛單、不改配置
 * 
 * @version V8.0
 * @date 2026-01-17
 */

// ==========================================
// P6 緊急撤退配置（寫死）
// ==========================================

const P6_EMERGENCY_EXIT_CONFIG = {
  // 觸發條件與對應動作（完全寫死）
  triggerActions: {
    "MILESTONE_FAILURE": {
      threshold: 1,  // 至少 1 個關鍵里程碑未達成
      reduction_pct: 0.30,  // 減倉 30%
      description: "驗證里程碑未達成"  // ⭐ V8.17 新增
    },
    "SINGLE_STOCK_DROP": {
      threshold: -0.06,  // 單檔持倉暴跌 > 6%
      reduction_pct: 0.50,  // 減倉 50%
      description: "單檔持倉暴跌"
    },
    "PORTFOLIO_DROP": {
      threshold: -0.05,  // 持倉組合整體跌幅 > 5%
      reduction_pct: 0.30,  // 整體減倉 30%
      description: "持倉組合整體跌幅"
    },
    "INDEX_DROP": {
      threshold: -0.04,  // 主要指數暴跌 > 4%
      reduction_pct: 0.25,  // 整體減倉 25%
      description: "主要指數暴跌"
    },
    "FLASH_CRASH": {
      threshold: -0.02,  // 20 分鐘內急殺 > 2%
      reduction_pct: 0.40,  // 減倉急殺股票 40%
      description: "20 分鐘內急殺"
    },
    "MULTI_VOLUME": {
      threshold: 3.0,  // 3 檔以上同時爆量（> 3 倍）
      reduction_pct: 0.40,  // 減倉爆量股票 40%
      description: "多檔同時爆量"
    },
    // ⭐ V8.10 新增：移動停利觸發
    "TRAILING_STOP": {
      threshold: -0.04,  // 從最高點回落 > 4%
      reduction_pct: 0.50,  // 減倉 50%（獲利了結）
      description: "移動停利觸發（從最高點回落 > 4% 或跌破 MA10）",
      preserve_core: true,  // 保留核心持倉
      core_preservation_pct: 0.30  // 核心持倉最多減 30%
    },
    "DEFCON_1": {
      defcon_level: "DEFCON_1",
      reduction_pct: 0.60,  // 整體減倉 60%
      description: "DEFCON 升級至 DEFCON_1"
    },
    "DEFCON_2": {
      defcon_level: "DEFCON_2",
      reduction_pct: 0.40,  // 整體減倉 40%
      description: "DEFCON 升級至 DEFCON_2"
    }
  },
  
  // 保留核心持倉
  preserveCore: true,
  coreTier: "CORE",
  corePreservationPct: 0.50  // 至少保留 50% 的核心持倉
};

// ==========================================
// P6 緊急撤退核心函數
// ==========================================

/**
 * P6 盤中緊急撤退協議主函數（Layer 1：寫死的即時防禦）
 * 
 * @param {string} triggerType - 觸發類型
 * @param {Object} triggerDetails - 觸發詳情
 * @param {Object} currentPositions - 當前持倉（從 P4 快照讀取）
 * @returns {Object} exitPlan - 撤退計劃
 */
function P6_EmergencyExit_Intraday(triggerType, triggerDetails, currentPositions) {
  const startTime = Date.now();
  
  try {
    Logger.log(`P6：緊急撤退協議觸發 - 類型：${triggerType}`);
    
    // 檢查觸發條件配置
    const triggerConfig = P6_EMERGENCY_EXIT_CONFIG.triggerActions[triggerType];
    if (!triggerConfig) {
      Logger.log(`P6：未知的觸發類型：${triggerType}`);
      return {
        success: false,
        error: `未知的觸發類型：${triggerType}`
      };
    }
    
    // 獲取減倉比例（寫死）
    const reductionPct = triggerConfig.reduction_pct;
    
    // 計算要賣出的股票和數量
    const exitPlan = calculateExitPlan(currentPositions, reductionPct, triggerType, triggerDetails);
    
    // 生成退出 ID
    const exitId = `P6_EXIT_${Date.now()}`;
    
    // 記錄到 P6_EMERGENCY_EXIT_LOG
    const exitLog = {
      exit_id: exitId,
      timestamp: new Date(),
      date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      trigger_type: triggerType,
      trigger_details_json: JSON.stringify(triggerDetails),
      reduction_pct: reductionPct,
      stocks_to_sell_json: JSON.stringify(exitPlan.stocksToSell),
      sell_quantities_json: JSON.stringify(exitPlan.sellQuantities),
      execution_status: "PENDING",
      human_override_json: null,
      p5_weekly_analysis_json: null,
      created_at: new Date()
    };
    
    // 保存到表格
    saveEmergencyExitLog(exitLog);
    
    Logger.log(`P6：緊急撤退計劃已生成 - Exit ID: ${exitId}，減倉比例: ${(reductionPct * 100).toFixed(0)}%`);
    
    return {
      success: true,
      exitId: exitId,
      exitPlan: exitPlan,
      exitLog: exitLog
    };
    
  } catch (error) {
    Logger.log(`P6：緊急撤退協議執行失敗：${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 計算撤退計劃（寫死邏輯）
 * 
 * @param {Object} currentPositions - 當前持倉
 * @param {number} reductionPct - 減倉比例
 * @param {string} triggerType - 觸發類型
 * @param {Object} triggerDetails - 觸發詳情
 * @returns {Object} exitPlan - 撤退計劃
 */
function calculateExitPlan(currentPositions, reductionPct, triggerType, triggerDetails) {
  const exitPlan = {
    stocksToSell: [],
    sellQuantities: {},
    totalValue: 0,
    reductionValue: 0
  };
  
  try {
    // 解析持倉數據
    let positions = [];
    if (typeof currentPositions === 'string') {
      positions = JSON.parse(currentPositions);
    } else if (Array.isArray(currentPositions)) {
      positions = currentPositions;
    } else if (currentPositions.allocations) {
      positions = typeof currentPositions.allocations === 'string'
        ? JSON.parse(currentPositions.allocations)
        : currentPositions.allocations;
    }
    
    // 根據觸發類型決定減倉策略
    if (triggerType === "TRAILING_STOP") {
      // ⭐ V8.10 新增：移動停利觸發 - 針對特定股票減倉（獲利了結）
      const targetTicker = triggerDetails.ticker;
      
      for (const pos of currentPositions) {
        if (pos.ticker === targetTicker) {
          // 移動停利：獲利了結邏輯
          const sellQuantity = Math.floor((pos.quantity || 0) * reductionPct);
          
          if (sellQuantity > 0) {
            // 如果是核心持倉，最多減 30%
            if (P6_EMERGENCY_EXIT_CONFIG.preserveCore && 
                pos.tier === P6_EMERGENCY_EXIT_CONFIG.coreTier &&
                P6_EMERGENCY_EXIT_CONFIG.triggerActions[triggerType].preserve_core) {
              const coreReductionPct = P6_EMERGENCY_EXIT_CONFIG.triggerActions[triggerType].core_preservation_pct || 0.30;
              const coreSellQuantity = Math.floor((pos.quantity || 0) * coreReductionPct);
              
              if (coreSellQuantity > 0) {
                exitPlan.stocksToSell.push(pos.ticker);
                exitPlan.sellQuantities[pos.ticker] = coreSellQuantity;
                exitPlan.totalValue += pos.value || 0;
                exitPlan.reductionValue += (pos.value || 0) * coreReductionPct;
                Logger.log(`P6：移動停利 - 核心持倉 ${pos.ticker} 減倉 ${coreReductionPct * 100}%（保留核心）`);
              }
            } else {
              // 非核心持倉：正常減倉
              exitPlan.stocksToSell.push(pos.ticker);
              exitPlan.sellQuantities[pos.ticker] = sellQuantity;
              exitPlan.totalValue += pos.value || 0;
              exitPlan.reductionValue += (pos.value || 0) * reductionPct;
              Logger.log(`P6：移動停利 - ${pos.ticker} 減倉 ${reductionPct * 100}%（獲利了結）`);
            }
          }
        }
      }
    } else if (triggerType === "SINGLE_STOCK_DROP" || triggerType === "FLASH_CRASH") {
      // 單檔或急殺：只減倉特定股票
      const targetTicker = triggerDetails.ticker;
      for (const pos of positions) {
        if (pos.ticker === targetTicker) {
          const sellQuantity = Math.floor(pos.quantity * reductionPct);
          exitPlan.stocksToSell.push(pos.ticker);
          exitPlan.sellQuantities[pos.ticker] = sellQuantity;
          exitPlan.totalValue += pos.value || 0;
          exitPlan.reductionValue += (pos.value || 0) * reductionPct;
        }
      }
    } else {
      // 整體減倉：減倉所有非核心持倉
      for (const pos of positions) {
        // 保留核心持倉
        if (P6_EMERGENCY_EXIT_CONFIG.preserveCore && 
            pos.tier === P6_EMERGENCY_EXIT_CONFIG.coreTier) {
          // 核心持倉：只減倉部分（保留至少 50%）
          const coreReductionPct = Math.max(0, reductionPct - P6_EMERGENCY_EXIT_CONFIG.corePreservationPct);
          if (coreReductionPct > 0) {
            const sellQuantity = Math.floor(pos.quantity * coreReductionPct);
            exitPlan.stocksToSell.push(pos.ticker);
            exitPlan.sellQuantities[pos.ticker] = sellQuantity;
            exitPlan.totalValue += pos.value || 0;
            exitPlan.reductionValue += (pos.value || 0) * coreReductionPct;
          }
        } else {
          // 非核心持倉：按比例減倉
          const sellQuantity = Math.floor(pos.quantity * reductionPct);
          exitPlan.stocksToSell.push(pos.ticker);
          exitPlan.sellQuantities[pos.ticker] = sellQuantity;
          exitPlan.totalValue += pos.value || 0;
          exitPlan.reductionValue += (pos.value || 0) * reductionPct;
        }
      }
    }
    
  } catch (error) {
    Logger.log(`P6：計算撤退計劃失敗：${error.message}`);
  }
  
  return exitPlan;
}

/**
 * 保存緊急撤退記錄到表格
 * 
 * @param {Object} exitLog - 撤退記錄
 * @returns {boolean} success - 是否成功
 */
function saveEmergencyExitLog(exitLog) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P6_EMERGENCY_EXIT_LOG");
    
    if (!sheet) {
      // 表格應該已經由 initializeAllSheets 創建，如果不存在則創建
      sheet = ss.insertSheet("P6_EMERGENCY_EXIT_LOG");
      sheet.appendRow([
        "exit_id",
        "timestamp",
        "date",
        "trigger_type",
        "trigger_details_json",
        "reduction_pct",
        "stocks_to_sell_json",
        "sell_quantities_json",
        "execution_status",
        "human_override_json",
        "p5_weekly_analysis_json",
        "created_at",
        "updated_at"
      ]);
    }
    
    sheet.appendRow([
      exitLog.exit_id,
      exitLog.timestamp,
      exitLog.date,
      exitLog.trigger_type,
      exitLog.trigger_details_json,
      exitLog.reduction_pct,
      exitLog.stocks_to_sell_json,
      exitLog.sell_quantities_json,
      exitLog.execution_status,
      exitLog.human_override_json,
      exitLog.p5_weekly_analysis_json,
      exitLog.created_at,
      exitLog.created_at  // updated_at 初始值等於 created_at
    ]);
    
    return true;
    
  } catch (error) {
    Logger.log(`P6：保存緊急撤退記錄失敗：${error.message}`);
    return false;
  }
}

/**
 * 獲取當前持倉（從 P4 快照讀取）
 * 
 * @returns {Object|null} currentPositions - 當前持倉
 */
function getCurrentPositionsFromP4Snapshot() {
  try {
    const p4Snapshot = getLatestP4Snapshot();
    if (!p4Snapshot) {
      Logger.log(`P6：無法獲取 P4 快照`);
      return null;
    }
    
    return p4Snapshot.allocations || [];
    
  } catch (error) {
    Logger.log(`P6：獲取當前持倉失敗：${error.message}`);
    return null;
  }
}
