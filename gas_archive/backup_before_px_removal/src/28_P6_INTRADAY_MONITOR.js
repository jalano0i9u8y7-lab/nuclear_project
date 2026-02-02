/**
 * 📊 P6: 盤中監測核心邏輯
 * 
 * ⭐ V8.0 新增：整合所有盤中監測功能
 * ⭐ V8.10 新增：整合移動停利機制（Trailing Stop）
 * 
 * ⚠️ **明文規範**：
 * - P6 只做 3 件事：盤中感測、狀態標記（Append-only）、通知你（LINE Bot）
 * - P6 永遠不做：不自動下單、不改 P3 掛單、不改 P4 配置、不讓 AI 即時裁決
 * - 盤中任何決策不得調用 AI（完全對齊 SSOT 的 One-Way / 不回寫）
 * - AI 僅能在盤後（P5 Daily/Weekly、P3 週更）使用 P6 事件作為輔助因子
 * 
 * @version V8.10
 * @date 2026-01-18
 */

// ==========================================
// P6 波動度配置
// ==========================================

const P6_VOLATILITY_CONFIG = {
  // 市場特性調整
  market_adjustments: {
    "TW": {
      drop_threshold: -0.07,      // 台股：-7%
      spike_threshold: 0.10,       // 台股：+10%
      interval_drop: -0.02,       // 20分鐘急殺：-2%
      interval_spike: 0.03,        // 20分鐘急拉：+3%
      volume_threshold: 2.5,      // 爆量：2.5倍
      range_threshold: 0.08        // 振幅：8%
    },
    "US": {
      drop_threshold: -0.06,      // 美股：-6%
      spike_threshold: 0.08,       // 美股：+8%
      interval_drop: -0.02,
      interval_spike: 0.03,
      volume_threshold: 3.0,      // 美股大盤股需要更大爆量
      range_threshold: 0.07
    },
    "JP": {
      drop_threshold: -0.06,
      spike_threshold: 0.08,
      interval_drop: -0.015,       // 日股：-1.5%
      interval_spike: 0.025,       // 日股：+2.5%
      volume_threshold: 2.5,
      range_threshold: 0.06        // 日股：6%
    }
  },
  
  // 選擇權個股調整（因為監控頻率更高，可放寬）
  options_adjustments: {
    drop_threshold_multiplier: 1.15,     // 放寬 15%
    spike_threshold_multiplier: 1.15,
    interval_drop: -0.015,                // 5分鐘急殺：-1.5%
    interval_spike: 0.025                 // 5分鐘急拉：+2.5%
  }
};

// ==========================================
// P6 核心監測函數
// ==========================================

/**
 * P6 盤中監測主函數（Time-driven Trigger 調用）
 * 
 * @returns {Object} monitorResult - 監測結果
 */
function P6_RunIntradayMonitor() {
  const startTime = Date.now();
  const monitorResult = {
    timestamp: new Date(),
    anomalies: [],
    emergencyExits: [],
    targetPriceAlerts: [],
    earningsTriggers: [],
    defconAdjustments: [],
    // ⭐ V8.10 新增：移動停利相關欄位
    trailingStopTriggers: [],
    bubbleStage: null
  };
  
  try {
    Logger.log(`P6：開始執行盤中監測`);
    
    // 檢查是否在市場開盤時段
    if (!isMarketHours()) {
      Logger.log(`P6：當前不在市場開盤時段，跳過監測`);
      return monitorResult;
    }
    
    // 清除舊的 20 分鐘動能追蹤數據（每天第一次執行時）
    clearOldShadowDataIfNeeded();
    
    // 1. 收集盤中數據
    const intradayData = collectIntradayData();
    
    // 2. 檢測異常（持倉股票、選擇權個股、主要指數、板塊 ETF、追蹤池）
    monitorResult.anomalies = detectAnomalies(intradayData);
    
    // ⭐ V8.10 新增：檢查 P5.9 泡沫階段，如果為 LATE 則啟動移動停利機制
    const bubbleStage = getCurrentBubbleStage();
    let trailingStopTriggers = [];
    
    if (bubbleStage === "LATE") {
      Logger.log(`P6：泡沫階段=LATE（瘋狗浪），啟動移動停利機制（Trailing Stop）`);
      
      // 檢查移動停利觸發條件
      if (typeof P6_CheckTrailingStop === "function") {
        trailingStopTriggers = P6_CheckTrailingStop(intradayData, bubbleStage);
        
        // 如果觸發移動停利，執行緊急撤退
        for (const trigger of trailingStopTriggers) {
          if (trigger && trigger.triggered) {
            const currentPositions = getCurrentPositionsFromP4Snapshot();
            if (currentPositions) {
              if (typeof executeTrailingStopExit === "function") {
                const exitResult = executeTrailingStopExit(trigger, currentPositions);
                if (exitResult && exitResult.success) {
                  monitorResult.emergencyExits.push(exitResult);
                  Logger.log(`P6：🚨 移動停利觸發緊急撤退 - ${trigger.ticker} (${trigger.market})：${trigger.reason}`);
                }
              } else {
                Logger.log(`P6：⚠️ executeTrailingStopExit 函數未定義，無法執行移動停利撤退`);
              }
            } else {
              Logger.log(`P6：⚠️ 無法獲取當前持倉，跳過移動停利撤退`);
            }
          }
        }
        
        if (trailingStopTriggers.length > 0) {
          Logger.log(`P6：移動停利機制檢查完成，${trailingStopTriggers.filter(t => t && t.triggered).length} 個觸發`);
        }
      } else {
        Logger.log(`P6：⚠️ P6_CheckTrailingStop 函數未定義，跳過移動停利檢查`);
      }
    }
    
    // 3. 檢查緊急撤退觸發條件（原有邏輯）
    const standardEmergencyExits = checkEmergencyExitTriggers(intradayData, monitorResult.anomalies);
    monitorResult.emergencyExits.push(...standardEmergencyExits);
    
    // ⭐ V8.10 新增：記錄移動停利觸發結果（用於日誌）
    monitorResult.trailingStopTriggers = trailingStopTriggers;
    monitorResult.bubbleStage = bubbleStage;
    
    // 4. 檢查目標價（台股）
    monitorResult.targetPriceAlerts = checkTargetPrices(intradayData.positions);
    
    // 5. 檢查財報 if-then 策略觸發（從 P5 Weekly 讀取）
    monitorResult.earningsTriggers = checkEarningsTriggers(intradayData.positions);
    
    // 6. DEFCON 盤中調整
    monitorResult.defconAdjustments = adjustDEFCONIntraday(monitorResult.anomalies, intradayData.majorIndices);
    
    // 7. 記錄日誌
    logIntradayMonitoring(monitorResult, intradayData);
    
    // 8. 標記需保留的異常數據
    markAnomaliesForRetention(monitorResult.anomalies);
    
    const executionTime = Date.now() - startTime;
    const trailingStopCount = monitorResult.trailingStopTriggers ? monitorResult.trailingStopTriggers.length : 0;
    Logger.log(`P6：盤中監測完成，執行時間 ${executionTime}ms，檢測到 ${monitorResult.anomalies.length} 個異常，${monitorResult.emergencyExits.length} 個緊急撤退觸發${trailingStopCount > 0 ? `，${trailingStopCount} 個移動停利觸發` : ""}（泡沫階段=${monitorResult.bubbleStage || "NORMAL"}）`);
    
    return monitorResult;
    
  } catch (error) {
    Logger.log(`P6：盤中監測執行失敗：${error.message}`);
    return monitorResult;
  }
}

/**
 * ⭐ V8.10 新增：獲取當前 P5.9 泡沫階段
 * 
 * 從最新的 P5 Weekly 快照或配置中讀取泡沫階段
 * 
 * @returns {string} bubbleStage - 泡沫階段（EARLY/MID/LATE/BURST/NORMAL），如果無法獲取則返回 "NORMAL"
 */
function getCurrentBubbleStage() {
  try {
    // 方法 1：從 P5 Weekly 快照中讀取（如果最新快照包含泡沫階段信息）
    if (typeof getLatestP5WeeklySnapshot === "function") {
      const p5WeeklySnapshot = getLatestP5WeeklySnapshot();
      
      if (p5WeeklySnapshot) {
        // 檢查 worldview 中是否有 bubble_stage
        if (p5WeeklySnapshot.worldview && p5WeeklySnapshot.worldview.u_macro_recommendation) {
          const uRecommendation = p5WeeklySnapshot.worldview.u_macro_recommendation;
          if (uRecommendation.bubble_stage) {
            return uRecommendation.bubble_stage;
          }
        }
        
        // 檢查是否有 bubbleNavigationResult
        if (p5WeeklySnapshot.bubbleNavigationResult && p5WeeklySnapshot.bubbleNavigationResult.bubble_stage) {
          return p5WeeklySnapshot.bubbleNavigationResult.bubble_stage;
        }
      }
    }
    
    // 方法 2：從 PropertiesService 讀取（如果 P5 Weekly 有保存）
    const properties = PropertiesService.getScriptProperties();
    const savedBubbleStage = properties.getProperty("P5_9_BUBBLE_STAGE");
    
    if (savedBubbleStage) {
      return savedBubbleStage;
    }
    
    // 方法 3：即時計算（調用 P5.6 泡沫監控系統）
    if (typeof P5_6_BubbleNavigation === "function") {
      // 獲取市場數據（簡化版，只讀取主要指數）
      const marketData = {
        forward_pe: null,  // 需要從數據源獲取
        cape: null,
        vix: null
      };
      
      // TODO: 從 MARKET_OHLCV_DAILY 或 MARKET_INDICATORS_DAILY 讀取最新市場數據
      // 暫時跳過即時計算（因為需要市場數據）
      // const bubbleResult = P5_6_BubbleNavigation("MARKET", marketData);
      // return bubbleResult.bubble_stage || "NORMAL";
    }
    
    // 預設返回 NORMAL（未啟動移動停利）
    return "NORMAL";
    
  } catch (error) {
    Logger.log(`P6：獲取當前泡沫階段失敗：${error.message}，預設返回 NORMAL`);
    return "NORMAL";
  }
}

/**
 * 檢測異常（Rule-Based）
 * 
 * @param {Object} intradayData - 盤中數據
 * @returns {Array} anomalies - 異常列表
 */
function detectAnomalies(intradayData) {
  const anomalies = [];
  
  try {
    // 檢測持倉股票異常
    for (const pos of intradayData.positions) {
      const anomaly = detectStockAnomaly(pos, "POSITION");
      if (anomaly) {
        anomalies.push(anomaly);
      }
    }
    
    // 檢測選擇權個股異常（使用更寬鬆的閾值）
    for (const opt of intradayData.optionStocks) {
      const anomaly = detectStockAnomaly(opt, "OPTION");
      if (anomaly) {
        anomalies.push(anomaly);
      }
    }
    
    // 檢測主要指數異常
    for (const idx of intradayData.majorIndices) {
      const anomaly = detectIndexAnomaly(idx);
      if (anomaly) {
        anomalies.push(anomaly);
      }
    }
    
    // 檢測板塊 ETF 異常
    for (const etf of intradayData.sectorETFs) {
      const anomaly = detectETFAnomaly(etf);
      if (anomaly) {
        anomalies.push(anomaly);
      }
    }
    
  } catch (error) {
    Logger.log(`P6：檢測異常失敗：${error.message}`);
  }
  
  return anomalies;
}

/**
 * 檢測單個股票異常（雙向監控：暴跌 + 暴漲，使用 % + ATR 兩層門檻）
 * 
 * @param {Object} stockData - 股票數據
 * @param {string} monitorType - 監控類型（"POSITION", "OPTION"）
 * @returns {Object|null} anomaly - 異常數據
 */
function detectStockAnomaly(stockData, monitorType) {
  try {
    const market = stockData.market || "US";
    const config = P6_VOLATILITY_CONFIG.market_adjustments[market] || P6_VOLATILITY_CONFIG.market_adjustments["US"];
    
    // 調整閾值（選擇權個股放寬）
    let dropThresholdPct = config.drop_threshold;      // 例如：-6%
    let spikeThresholdPct = config.spike_threshold;    // 例如：+8%
    let intervalDrop = config.interval_drop;
    let intervalSpike = config.interval_spike;
    let volumeThreshold = config.volume_threshold;
    
    // 暴跌 ATR 門檻（兩層門檻之一）
    const dropATRThreshold = 1.6;  // abs(price - prevClose) >= 1.6 * ATR14
    
    // 暴漲 ATR 門檻（兩層門檻之一）
    const spikeATRThreshold = 1.8;  // abs(price - prevClose) >= 1.8 * ATR14
    
    if (monitorType === "OPTION") {
      dropThresholdPct *= P6_VOLATILITY_CONFIG.options_adjustments.drop_threshold_multiplier;
      spikeThresholdPct *= P6_VOLATILITY_CONFIG.options_adjustments.spike_threshold_multiplier;
      intervalDrop = P6_VOLATILITY_CONFIG.options_adjustments.interval_drop;
      intervalSpike = P6_VOLATILITY_CONFIG.options_adjustments.interval_spike;
    }
    
    // 獲取 ATR14（從前一日的 MARKET_INDICATORS_DAILY）
    const atr14 = getATR14FromDailyIndicators(stockData.ticker);
    
    // 獲取前一日的收盤價（用於計算 ATR 門檻）
    const prevClose = getPreviousClosePrice(stockData.ticker);
    
    const anomaly = {
      ticker: stockData.ticker,
      market: market,
      monitorType: monitorType,
      anomalyType: null,
      severity: null,
      details: {}
    };
    
    // ========================================
    // A. 暴跌事件檢測（Risk Containment）- 兩層門檻：% + ATR
    // ========================================
    
    // Pct 門檻檢查
    const pctDropMet = stockData.change_pct <= dropThresholdPct;
    
    // ATR 門檻檢查（如果有 ATR14 和 prevClose）
    let atrDropMet = false;
    if (atr14 !== null && atr14 > 0 && prevClose !== null && prevClose > 0) {
      const priceChangeAbs = Math.abs(stockData.price - prevClose);
      atrDropMet = priceChangeAbs >= dropATRThreshold * atr14;
    } else {
      // 沒有 ATR14 數據時，只用 % 門檻
      atrDropMet = true; // 允許只用 % 門檻觸發
    }
    
    // 爆量確認（可選加權）
    const volumeSpike = stockData.volume && stockData.volume_avg_20d 
      ? (stockData.volume / stockData.volume_avg_20d >= 2.0) 
      : false;
    
    // 暴跌觸發：同時滿足 Pct 門檻 + ATR 門檻（爆量為可選加權）
    if (pctDropMet && atrDropMet) {
      anomaly.anomalyType = "INTRADAY_DOWNSHOCK";
      anomaly.severity = volumeSpike ? "CRITICAL" : "HIGH";
      anomaly.details = {
        change_pct: stockData.change_pct,
        dropThresholdPct: dropThresholdPct,
        atr14: atr14,
        atrDropThreshold: dropATRThreshold,
        atrMet: atrDropMet,
        priceChangeAbs: prevClose ? Math.abs(stockData.price - prevClose) : null,
        prevClose: prevClose,
        price: stockData.price,
        volumeSpike: volumeSpike,
        volumeRatio: stockData.volume && stockData.volume_avg_20d 
          ? (stockData.volume / stockData.volume_avg_20d) 
          : null
      };
      return anomaly;
    }
    
    // ========================================
    // B. 暴漲事件檢測（Overextension）- 兩層門檻：% + ATR
    // ========================================
    
    // Pct 門檻檢查
    const pctSpikeMet = stockData.change_pct >= spikeThresholdPct;
    
    // ATR 門檻檢查（如果有 ATR14 和 prevClose）
    let atrSpikeMet = false;
    if (atr14 !== null && atr14 > 0 && prevClose !== null && prevClose > 0) {
      const priceChangeAbs = Math.abs(stockData.price - prevClose);
      atrSpikeMet = priceChangeAbs >= spikeATRThreshold * atr14;
    } else {
      // 沒有 ATR14 數據時，只用 % 門檻
      atrSpikeMet = true; // 允許只用 % 門檻觸發
    }
    
    // 爆量確認（可選加權）
    const volumeSpike2 = stockData.volume && stockData.volume_avg_20d 
      ? (stockData.volume / stockData.volume_avg_20d >= 2.5) 
      : false;
    
    // 暴漲觸發：同時滿足 Pct 門檻 + ATR 門檻（爆量為可選加權）
    if (pctSpikeMet && atrSpikeMet) {
      anomaly.anomalyType = "INTRADAY_UPSHOCK";
      anomaly.severity = volumeSpike2 ? "HIGH" : "MEDIUM";
      anomaly.details = {
        change_pct: stockData.change_pct,
        spikeThresholdPct: spikeThresholdPct,
        atr14: atr14,
        atrSpikeThreshold: spikeATRThreshold,
        atrMet: atrSpikeMet,
        priceChangeAbs: prevClose ? Math.abs(stockData.price - prevClose) : null,
        prevClose: prevClose,
        price: stockData.price,
        volumeSpike: volumeSpike2,
        volumeRatio: stockData.volume && stockData.volume_avg_20d 
          ? (stockData.volume / stockData.volume_avg_20d) 
          : null
      };
      return anomaly;
    }
    
    // ========================================
    // C. 20 分鐘急殺/急拉檢測（使用 20 分鐘動能追蹤，價/量變化）
    // ========================================
    
    const change20Min = calculate20MinPriceChange(
      stockData.ticker, 
      market, 
      stockData.price,
      stockData.volume || null
    );
    
    if (change20Min) {
      // 急殺檢測
      if (change20Min.priceChangePct <= intervalDrop) {
        anomaly.anomalyType = "FLASH_CRASH";
        anomaly.severity = "HIGH";
        anomaly.details = {
          priceChange20Min: change20Min.priceChangePct,
          threshold: intervalDrop,
          currentPrice: stockData.price,
          price20MinAgo: change20Min.price20MinAgo,
          volumeRatio: change20Min.volumeRatio,
          volumeChangePct: change20Min.volumeChangePct
        };
        return anomaly;
      }
      
      // 急拉檢測
      if (change20Min.priceChangePct >= intervalSpike) {
        anomaly.anomalyType = "OVEREXTENDED_UP";
        anomaly.severity = "MEDIUM";
        anomaly.details = {
          priceChange20Min: change20Min.priceChangePct,
          threshold: intervalSpike,
          currentPrice: stockData.price,
          price20MinAgo: change20Min.price20MinAgo,
          volumeRatio: change20Min.volumeRatio,
          volumeChangePct: change20Min.volumeChangePct
        };
        return anomaly;
      }
    }
    
    // ========================================
    // D. 純爆量檢測（不伴隨價格異常）
    // ========================================
    
    if (stockData.volume && stockData.volume_avg_20d) {
      const volumeRatio = stockData.volume / stockData.volume_avg_20d;
      if (volumeRatio >= volumeThreshold) {
        anomaly.anomalyType = "VOLUME_SPIKE";
        anomaly.severity = "MEDIUM";
        anomaly.details = {
          volumeRatio: volumeRatio,
          threshold: volumeThreshold,
          volume: stockData.volume,
          volumeAvg20d: stockData.volume_avg_20d
        };
        return anomaly;
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`P6：檢測股票異常失敗：${error.message}`);
    return null;
  }
}

/**
 * 獲取前一日的收盤價
 * 
 * @param {string} ticker - 股票代碼
 * @returns {number|null} prevClose - 前一日的收盤價
 */
function getPreviousClosePrice(ticker) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("MARKET_OHLCV_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return null;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const dateCol = headers.indexOf("date");
    const closeCol = headers.indexOf("close");
    
    if (tickerCol === -1 || dateCol === -1 || closeCol === -1) {
      return null;
    }
    
    // 從後往前找（最新的數據在後面）
    for (let i = rows.length - 1; i >= 1; i--) {
      const rowTicker = rows[i][tickerCol];
      const rowDate = rows[i][dateCol];
      
      if (rowTicker === ticker && rowDate instanceof Date) {
        const rowDateOnly = new Date(rowDate);
        rowDateOnly.setHours(0, 0, 0, 0);
        
        // 檢查是否為昨天或更早（最近的有效數據）
        if (rowDateOnly <= yesterday) {
          const close = rows[i][closeCol];
          if (close !== null && close !== undefined && !isNaN(close) && close > 0) {
            return parseFloat(close);
          }
        }
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`P6：獲取前一日期盤價失敗：${error.message}`);
    return null;
  }
}

/**
 * 檢測指數異常
 * 
 * @param {Object} indexData - 指數數據
 * @returns {Object|null} anomaly - 異常數據
 */
function detectIndexAnomaly(indexData) {
  try {
    const market = indexData.market || "US";
    const config = P6_VOLATILITY_CONFIG.market_adjustments[market] || P6_VOLATILITY_CONFIG.market_adjustments["US"];
    
    // 指數使用更寬鬆的閾值
    const indexDropThreshold = config.drop_threshold * 0.8;  // 指數：-4.8%（美股）
    const indexSpikeThreshold = config.spike_threshold * 0.8; // 指數：+6.4%（美股）
    
    if (indexData.change_pct <= indexDropThreshold) {
      return {
        ticker: indexData.ticker,
        name: indexData.name,
        market: market,
        monitorType: "INDEX",
        anomalyType: "INDEX_DROP",
        severity: "CRITICAL",
        details: {
          change_pct: indexData.change_pct,
          threshold: indexDropThreshold,
          price: indexData.price
        }
      };
    }
    
    if (indexData.change_pct >= indexSpikeThreshold) {
      return {
        ticker: indexData.ticker,
        name: indexData.name,
        market: market,
        monitorType: "INDEX",
        anomalyType: "INDEX_SPIKE",
        severity: "HIGH",
        details: {
          change_pct: indexData.change_pct,
          threshold: indexSpikeThreshold,
          price: indexData.price
        }
      };
    }
    
    return null;
    
  } catch (error) {
    Logger.log(`P6：檢測指數異常失敗：${error.message}`);
    return null;
  }
}

/**
 * 檢測 ETF 異常
 * 
 * @param {Object} etfData - ETF 數據
 * @returns {Object|null} anomaly - 異常數據
 */
function detectETFAnomaly(etfData) {
  // ETF 異常檢測邏輯類似指數
  return detectIndexAnomaly({
    ticker: etfData.ticker,
    name: etfData.name,
    market: "US",
    change_pct: etfData.change_pct,
    price: etfData.price
  });
}

/**
 * 檢查緊急撤退觸發條件
 * 
 * @param {Object} intradayData - 盤中數據
 * @param {Array} anomalies - 異常列表
 * @returns {Array} emergencyExits - 緊急撤退觸發列表
 */
function checkEmergencyExitTriggers(intradayData, anomalies) {
  const emergencyExits = [];
  
  try {
    // 檢查單檔持倉暴跌
    for (const anomaly of anomalies) {
      if (anomaly.monitorType === "POSITION" && 
          (anomaly.anomalyType === "DROP" || anomaly.anomalyType === "FLASH_CRASH")) {
        const currentPositions = getCurrentPositionsFromP4Snapshot();
        if (currentPositions) {
          const exitResult = P6_EmergencyExit_Intraday(
            anomaly.anomalyType === "FLASH_CRASH" ? "FLASH_CRASH" : "SINGLE_STOCK_DROP",
            {
              ticker: anomaly.ticker,
              change_pct: anomaly.details.change_pct || anomaly.details.priceChange20Min,
              anomaly: anomaly
            },
            currentPositions
          );
          if (exitResult.success) {
            emergencyExits.push(exitResult);
          }
        }
      }
    }
    
    // 檢查持倉組合整體跌幅
    const portfolioDrop = calculatePortfolioDrop(intradayData.positions);
    if (portfolioDrop <= -0.05) {
      const currentPositions = getCurrentPositionsFromP4Snapshot();
      if (currentPositions) {
        const exitResult = P6_EmergencyExit_Intraday(
          "PORTFOLIO_DROP",
          {
            portfolioDrop: portfolioDrop,
            positions: intradayData.positions
          },
          currentPositions
        );
        if (exitResult.success) {
          emergencyExits.push(exitResult);
        }
      }
    }
    
    // 檢查主要指數暴跌
    for (const idx of intradayData.majorIndices) {
      if (idx.change_pct <= -0.04) {
        const currentPositions = getCurrentPositionsFromP4Snapshot();
        if (currentPositions) {
          const exitResult = P6_EmergencyExit_Intraday(
            "INDEX_DROP",
            {
              index: idx.name,
              change_pct: idx.change_pct
            },
            currentPositions
          );
          if (exitResult.success) {
            emergencyExits.push(exitResult);
          }
        }
      }
    }
    
    // 檢查多檔同時爆量
    const volumeSpikeCount = anomalies.filter(a => a.anomalyType === "VOLUME_SPIKE" && a.monitorType === "POSITION").length;
    if (volumeSpikeCount >= 3) {
      const currentPositions = getCurrentPositionsFromP4Snapshot();
      if (currentPositions) {
        const exitResult = P6_EmergencyExit_Intraday(
          "MULTI_VOLUME",
          {
            volumeSpikeCount: volumeSpikeCount,
            affectedStocks: anomalies.filter(a => a.anomalyType === "VOLUME_SPIKE").map(a => a.ticker)
          },
          currentPositions
        );
        if (exitResult.success) {
          emergencyExits.push(exitResult);
        }
      }
    }
    
  } catch (error) {
    Logger.log(`P6：檢查緊急撤退觸發條件失敗：${error.message}`);
  }
  
  return emergencyExits;
}

/**
 * 計算持倉組合整體跌幅
 * 
 * @param {Array} positions - 持倉列表
 * @returns {number} portfolioDrop - 組合跌幅（加權平均）
 */
function calculatePortfolioDrop(positions) {
  if (!positions || positions.length === 0) {
    return 0;
  }
  
  let totalValue = 0;
  let totalChange = 0;
  
  for (const pos of positions) {
    const value = pos.allocation_pct || 0;
    const change = pos.change_pct || 0;
    totalValue += value;
    totalChange += value * change;
  }
  
  return totalValue !== 0 ? totalChange / totalValue : 0;
}

/**
 * 檢查目標價（台股）
 * 
 * @param {Array} positions - 持倉列表
 * @returns {Array} alerts - 目標價警報列表
 */
function checkTargetPrices(positions) {
  const alerts = [];
  
  try {
    // 只檢查台股
    const twPositions = positions.filter(p => p.market === "TW");
    if (twPositions.length === 0) {
      return alerts;
    }
    
    // 從 P3 快照讀取目標價
    const p3Snapshot = getLatestP3Snapshot();
    if (!p3Snapshot || !p3Snapshot.technical_results) {
      return alerts;
    }
    
    const technicalResults = typeof p3Snapshot.technical_results === 'string'
      ? JSON.parse(p3Snapshot.technical_results)
      : p3Snapshot.technical_results;
    
    for (const pos of twPositions) {
      const techData = technicalResults[pos.ticker];
      if (!techData) {
        continue;
      }
      
      // 檢查買入目標價（使用 buy2_price 或 buy3_price）
      const buyTarget = techData.buy2_price || techData.buy3_price;
      if (buyTarget && pos.price <= buyTarget * 1.005) { // 0.5% 緩衝
        // 檢查 Cooldown（24 小時內只通知一次）
        if (!isTargetPriceAlertCooldown(pos.ticker, buyTarget, "BUY")) {
          alerts.push({
            ticker: pos.ticker,
            alertType: "TARGET_PRICE_BUY",
            currentPrice: pos.price,
            targetPrice: buyTarget,
            timestamp: new Date()
          });
          
          // 記錄到 P6_INTRADAY_ALERTS_DAILY 並標記已通知
          saveTargetPriceAlert(pos.ticker, "TW", "TARGET_PRICE_BUY", pos.price, buyTarget);
        }
      }
      
      // 檢查賣出目標價（使用 sell1_price 或 sell2_price）
      const sellTarget = techData.sell1_price || techData.sell2_price;
      if (sellTarget && pos.price >= sellTarget * 0.995) { // 0.5% 緩衝
        // 檢查 Cooldown（24 小時內只通知一次）
        if (!isTargetPriceAlertCooldown(pos.ticker, sellTarget, "SELL")) {
          alerts.push({
            ticker: pos.ticker,
            alertType: "TARGET_PRICE_SELL",
            currentPrice: pos.price,
            targetPrice: sellTarget,
            timestamp: new Date()
          });
          
          // 記錄到 P6_INTRADAY_ALERTS_DAILY 並標記已通知
          saveTargetPriceAlert(pos.ticker, "TW", "TARGET_PRICE_SELL", pos.price, sellTarget);
        }
      }
    }
    
  } catch (error) {
    Logger.log(`P6：檢查目標價失敗：${error.message}`);
  }
  
  return alerts;
}

/**
 * 檢查目標價警報是否在 Cooldown 期間（24 小時內只通知一次）
 * 
 * @param {string} ticker - 股票代碼
 * @param {number} targetPrice - 目標價格
 * @param {string} orderType - 訂單類型（"BUY" 或 "SELL"）
 * @returns {boolean} inCooldown - 是否在 Cooldown 期間
 */
function isTargetPriceAlertCooldown(ticker, targetPrice, orderType) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P6_INTRADAY_ALERTS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return false; // 沒有記錄，不在 Cooldown
    }
    
    const now = new Date();
    const cooldownHours = 24; // 24 小時 Cooldown
    const cooldownTime = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const alertTypeCol = headers.indexOf("alert_type");
    const triggerTimeCol = headers.indexOf("trigger_time");
    const detailsCol = headers.indexOf("trigger_condition_json");
    
    if (tickerCol === -1 || alertTypeCol === -1 || triggerTimeCol === -1) {
      return false;
    }
    
    // 檢查是否有相同 ticker、相同目標價、相同類型的警報在 24 小時內
    for (let i = 1; i < rows.length; i++) {
      const rowTicker = rows[i][tickerCol];
      const rowAlertType = rows[i][alertTypeCol];
      const rowTriggerTime = rows[i][triggerTimeCol];
      
      if (rowTicker === ticker && 
          rowAlertType === `TARGET_PRICE_${orderType}` &&
          rowTriggerTime instanceof Date &&
          rowTriggerTime >= cooldownTime) {
        // 檢查目標價是否相同（允許 0.1% 誤差）
        try {
          const details = rows[i][detailsCol] ? JSON.parse(rows[i][detailsCol]) : {};
          const previousTargetPrice = details.targetPrice;
          if (previousTargetPrice && Math.abs(previousTargetPrice - targetPrice) / targetPrice <= 0.001) {
            Logger.log(`P6：${ticker} ${orderType} 目標價 ${targetPrice} 在 24 小時內已通知過，跳過`);
            return true; // 在 Cooldown 期間
          }
        } catch (e) {
          // 解析失敗，繼續檢查
        }
      }
    }
    
    return false; // 不在 Cooldown 期間
    
  } catch (error) {
    Logger.log(`P6：檢查目標價 Cooldown 失敗：${error.message}`);
    return false; // 錯誤時不阻止通知
  }
}

/**
 * 保存目標價警報到 P6_INTRADAY_ALERTS_DAILY
 * 
 * @param {string} ticker - 股票代碼
 * @param {string} market - 市場
 * @param {string} alertType - 警報類型
 * @param {number} currentPrice - 當前價格
 * @param {number} targetPrice - 目標價格
 * @returns {boolean} success - 是否成功
 */
function saveTargetPriceAlert(ticker, market, alertType, currentPrice, targetPrice) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("P6_INTRADAY_ALERTS_DAILY");
    
    if (!sheet) {
      // 表格應該已經由 initializeAllSheets 創建
      sheet = ss.insertSheet("P6_INTRADAY_ALERTS_DAILY");
      sheet.appendRow([
        "alert_id",
        "date",
        "ticker",
        "market",
        "alert_type",
        "alert_severity",
        "trigger_time",
        "price_data_json",
        "volume_data_json",
        "technical_data_json",
        "trigger_condition_json",
        "action_taken_json",
        "integrated_to_daily",
        "p5_daily_reference",
        "created_at",
        "updated_at"
      ]);
    }
    
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const now = new Date();
    
    sheet.appendRow([
      `P6_ALERT_${Date.now()}_${ticker}`,
      today,
      ticker,
      market,
      alertType,
      "MEDIUM", // 目標價警報為中等嚴重程度
      now,
      JSON.stringify({
        currentPrice: currentPrice,
        targetPrice: targetPrice
      }),
      JSON.stringify({}), // 成交量數據（無）
      JSON.stringify({}), // 技術指標數據（無）
      JSON.stringify({
        targetPrice: targetPrice,
        currentPrice: currentPrice,
        priceDiff: currentPrice - targetPrice,
        priceDiffPct: ((currentPrice - targetPrice) / targetPrice * 100).toFixed(2) + "%"
      }),
      JSON.stringify({
        action: "NOTIFICATION_SENT",
        message: `【台股${alertType === "TARGET_PRICE_BUY" ? "買入" : "賣出"}提醒】${ticker} 已達到目標價位 ${targetPrice.toFixed(2)}，目前價格：${currentPrice.toFixed(2)}`
      }),
      false, // integrated_to_daily
      null,  // p5_daily_reference
      now,
      now
    ]);
    
    Logger.log(`P6：目標價警報已記錄：${ticker} ${alertType} 目標價=${targetPrice.toFixed(2)}, 當前價=${currentPrice.toFixed(2)}`);
    
    return true;
    
  } catch (error) {
    Logger.log(`P6：保存目標價警報失敗：${error.message}`);
    return false;
  }
}

/**
 * 檢查財報 if-then 策略觸發
 * 
 * @param {Array} positions - 持倉列表
 * @returns {Array} triggers - 財報觸發列表
 */
function checkEarningsTriggers(positions) {
  const triggers = [];
  
  try {
    // 從 EARNINGS_STRATEGIES 表格讀取 if-then 策略
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("EARNINGS_STRATEGIES");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return triggers;
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const tickerCol = headers.indexOf("ticker");
    const ifConditionCol = headers.indexOf("if_condition");
    const thenActionCol = headers.indexOf("then_action");
    const earningsDateCol = headers.indexOf("earnings_date");
    
    if (tickerCol === -1 || ifConditionCol === -1 || thenActionCol === -1) {
      return triggers;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 檢查未來 14 天內有財報的持倉
    for (let i = 1; i < rows.length; i++) {
      const ticker = rows[i][tickerCol];
      const earningsDate = rows[i][earningsDateCol];
      const ifCondition = rows[i][ifConditionCol];
      const thenAction = rows[i][thenActionCol];
      
      if (!ticker || !earningsDate || !ifCondition) {
        continue;
      }
      
      // 檢查是否為持倉股票
      const position = positions.find(p => p.ticker === ticker);
      if (!position) {
        continue;
      }
      
      // 檢查財報日期是否在未來 14 天內
      const earningsDateObj = earningsDate instanceof Date ? earningsDate : new Date(earningsDate);
      const daysDiff = Math.floor((earningsDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff >= 0 && daysDiff <= 14) {
        // 檢查 if 條件是否觸發（簡化處理，實際需要解析條件）
        // 這裡假設條件是價格變化或成交量
        const conditionMet = evaluateEarningsCondition(ifCondition, position);
        
        if (conditionMet) {
          triggers.push({
            ticker: ticker,
            earningsDate: earningsDateObj,
            ifCondition: ifCondition,
            thenAction: thenAction,
            conditionMet: true,
            timestamp: new Date()
          });
        }
      }
    }
    
  } catch (error) {
    Logger.log(`P6：檢查財報觸發失敗：${error.message}`);
  }
  
  return triggers;
}

/**
 * 評估財報條件（簡化版本）
 * 
 * @param {string} condition - 條件字符串
 * @param {Object} position - 持倉數據
 * @returns {boolean} met - 條件是否滿足
 */
function evaluateEarningsCondition(condition, position) {
  // 簡化處理：實際需要解析條件字符串
  // 例如："price_change > 5%" 或 "volume > 2x"
  // 這裡先返回 false，實際實現時需要完整的條件解析器
  return false;
}

/**
 * 檢查是否在市場開盤時段
 * 
 * @returns {boolean} isOpen - 是否在開盤時段
 */
function isMarketHours() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const time = hour * 60 + minute;
  
  // 台股：09:00 - 13:30（台灣時間）
  const twOpen = 9 * 60;   // 09:00
  const twClose = 13 * 60 + 30; // 13:30
  
  // 日股：08:00 - 14:00（台灣時間）
  const jpOpen = 8 * 60;   // 08:00
  const jpClose = 14 * 60; // 14:00
  
  // 美股：盤前 17:00 - 22:30，盤中 22:30 - 05:00，盤後 05:00 - 08:00（台灣時間，冬令）
  const usPreOpen = 17 * 60;   // 17:00
  const usPreClose = 22 * 60 + 30; // 22:30
  const usOpen = 22 * 60 + 30;  // 22:30
  const usClose = 29 * 60;      // 05:00（次日）
  const usAfterOpen = 5 * 60;  // 05:00
  const usAfterClose = 8 * 60; // 08:00
  
  // 檢查是否在任何市場的開盤時段
  if ((time >= twOpen && time <= twClose) ||      // 台股
      (time >= jpOpen && time <= jpClose) ||      // 日股
      (time >= usPreOpen && time <= usPreClose) || // 美股盤前
      (time >= usOpen || time <= usClose) ||       // 美股盤中（跨日）
      (time >= usAfterOpen && time <= usAfterClose)) { // 美股盤後
    return true;
  }
  
  return false;
}

/**
 * 清除舊 20 分鐘動能追蹤數據（如果需要）
 */
function clearOldShadowDataIfNeeded() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const lastClearDate = properties.getProperty("P6_LAST_CLEAR_DATE");
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    if (lastClearDate !== today) {
      clearOldShadowData();
      properties.setProperty("P6_LAST_CLEAR_DATE", today);
    }
  } catch (error) {
    Logger.log(`P6：清除舊 20 分鐘動能追蹤數據檢查失敗：${error.message}`);
  }
}
