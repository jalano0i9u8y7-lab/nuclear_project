/**
 * 📊 P5 Weekly: 宏觀世界觀分析模組
 * 
 * 負責宏觀世界觀分析：
 * - 整合本週所有新聞快照 + 市場數據資料
 * - 分析出每週的宏觀世界財經觀
 * - 與前幾期（一個月）的世界觀做連接與對照
 * - 學習世界觀的變化
 * - 分析世界觀與現實市場反應的連結（相符/無關/背離）
 * - ⭐ V8.0 新增：籌碼面週報彙總（本週內部人交易異常、期權流向總結、Dark Pool 活動）
 * 
 * @version SSOT V8.0
 * @date 2025-01-14
 */

// ==========================================
// 宏觀世界觀分析主函數
// ==========================================

/**
 * 分析本週宏觀世界觀 ⭐ V8.0 增強：加入籌碼面週報彙總
 * 
 * @param {Object} data - 數據
 * @param {Object} data.macroData - 宏觀數據（油價、匯率、VIX 等）
 * @param {Array} data.worldviewHistory - 歷史世界觀更新
 * @param {Array} data.learningLogHistory - 歷史學習日誌
 * @param {Object} data.weeklyMarketData - 本週市場數據
 * @param {Object} data.smartMoneyData - 籌碼面數據 ⭐ V8.0 新增
 * @returns {Object} worldview - 世界觀分析結果（包含籌碼面週報）
 */
function analyzeWeeklyWorldview(data) {
  try {
    Logger.log("P5 Weekly：開始宏觀世界觀分析（包含籌碼面週報）");
    
    const {
      macroData = {},
      worldviewHistory = [],
      learningLogHistory = [],
      weeklyMarketData = {},
      smartMoneyData = {}  // ⭐ V8.0 新增
    } = data;
    
    // ========================================
    // Step 1: 整合本週所有數據（包含籌碼面數據）⭐ V8.0 增強
    // ========================================
    
    const weeklyIntegration = integrateWeeklyData({
      macroData: macroData,
      weeklyMarketData: weeklyMarketData,
      newsData: getWeeklyNewsData(),  // 從 Daily 數據獲取
      smartMoneyData: smartMoneyData  // ⭐ V8.0 新增：籌碼面數據
    });
    
    // ========================================
    // Step 1.5: 生成籌碼面週報彙總 ⭐ V8.0 新增
    // ========================================
    
    const smartMoneyReport = generateSmartMoneyWeeklyReport(smartMoneyData);
    weeklyIntegration.smart_money_report = smartMoneyReport;
    
    // ========================================
    // Step 1.6: Sector ETF Flow 分析 ⭐ V8.0 新增
    // ========================================
    
    const sectorETFFlows = analyzeSectorETFFlows();
    const rotationSignal = identifyRotation(sectorETFFlows);
    weeklyIntegration.sector_etf_flows = sectorETFFlows;
    weeklyIntegration.rotation_signal = rotationSignal;
    
    // ========================================
    // Step 1.7: Mag 7 集體表現分析 ⭐ V8.0 新增
    // ========================================
    
    const mag7Analysis = analyzeMag7CollectivePerformance();
    weeklyIntegration.mag7_analysis = mag7Analysis;
    
    // ========================================
    // Step 1.8: 整合 P6 異常記錄 ⭐ V8.0 新增
    // ========================================
    
    const p6Anomalies = getP6WeeklyAnomalies();
    const p6EmergencyExits = getP6WeeklyEmergencyExits();
    weeklyIntegration.p6_anomalies = p6Anomalies;
    weeklyIntegration.p6_emergency_exits = p6EmergencyExits;
    
    // ========================================
    // Step 2: 與歷史世界觀對照
    // ========================================
    
    const historicalComparison = compareWorldviewWithHistory(
      weeklyIntegration,
      worldviewHistory
    );
    
    // ========================================
    // Step 3: 分析世界觀與市場反應的連結
    // ========================================
    
    const marketAlignment = analyzeWorldviewMarketAlignment(
      weeklyIntegration,
      weeklyMarketData,
      worldviewHistory
    );
    
    // ========================================
    // Step 4: 構建 Prompt 並提交到 M0
    // ========================================
    
    const prompt = buildWorldviewPrompt({
      macroData: macroData,
      worldviewHistory: worldviewHistory,
      learningLogHistory: learningLogHistory,
      weeklyMarketData: weeklyMarketData,
      smartMoneyReport: smartMoneyReport,  // ⭐ V8.0 新增：籌碼面週報
      sectorETFFlows: sectorETFFlows,      // ⭐ V8.0 新增：Sector ETF Flow
      rotationSignal: rotationSignal,       // ⭐ V8.0 新增：Rotation Signal
      mag7Analysis: mag7Analysis,          // ⭐ V8.0 新增：Mag 7 集體表現分析
      p6Anomalies: p6Anomalies,            // ⭐ V8.0 新增：P6 異常記錄
      p6EmergencyExits: p6EmergencyExits    // ⭐ V8.0 新增：P6 緊急撤退記錄
    });
    
    // 提交到 M0 Job Queue
    const jobId = submitP5ToM0JobQueue(
      "P5_WEEKLY_WORLDVIEW",
      ["OPUS", "GPT"],  // ⭐ V8.17 更新：Opus 執行（宏觀世界觀分析需要深度推理），GPT 審查
      {
        phase: "P5_WEEKLY_WORLDVIEW",
        prompt: prompt,
        weekly_integration: weeklyIntegration,
        historical_comparison: historicalComparison,
        market_alignment: marketAlignment
      }
    );
    
    // 等待結果（簡化實現）
    const m0Result = waitForM0JobResult(jobId);
    
    if (m0Result && m0Result.output) {
      const worldviewResult = m0Result.output;
      
      // ⭐ V8.0 新增：保存 Regime 預測（用於準度追蹤）
      if (worldviewResult.weekly_worldview && worldviewResult.weekly_worldview.market_regime) {
        saveRegimePrediction({
          predicted_regime: worldviewResult.weekly_worldview.market_regime,
          prediction_confidence: worldviewResult.weekly_worldview.regime_confidence || 0.5
        });
      }
      
      // ⭐ V8.0 新增：驗證 7 天前的 Regime 預測
      verifyRegimePredictions();
      
      return {
        status: "SUCCESS",
        worldview: worldviewResult,
        weekly_integration: weeklyIntegration,
        smart_money_report: smartMoneyReport,  // ⭐ V8.0 新增：籌碼面週報
        mag7_analysis: mag7Analysis,           // ⭐ V8.0 新增：Mag 7 集體表現分析
        historical_comparison: historicalComparison,
        market_alignment: marketAlignment,
        p6_anomalies: p6Anomalies,         // ⭐ V8.0 新增：P6 異常記錄
        p6_emergency_exits: p6EmergencyExits // ⭐ V8.0 新增：P6 緊急撤退記錄
      };
    } else {
      // 如果 AI 分析失敗，使用程式化邏輯
      Logger.log("P5 Weekly：世界觀 AI 分析失敗，使用程式化邏輯");
      return generateProgrammaticWorldview({
        weeklyIntegration: weeklyIntegration,
        historicalComparison: historicalComparison,
        marketAlignment: marketAlignment
      });
    }
    
  } catch (error) {
    Logger.log(`P5 Weekly：宏觀世界觀分析失敗：${error.message}`);
    throw error;
  }
}

/**
 * 整合本週所有數據
 * 
 * @param {Object} data - 數據
 * @returns {Object} integration - 整合結果
 */
function integrateWeeklyData(data) {
  try {
    const {
      macroData = {},
      weeklyMarketData = {},
      newsData = {}
    } = data;
    
    return {
      macro_summary: {
        commodities: summarizeMacroCategory(macroData.commodities || {}),
        currencies: summarizeMacroCategory(macroData.currencies || {}),
        bonds: summarizeMacroCategory(macroData.bonds || {}),
        indices: summarizeMacroCategory(macroData.indices || {})
      },
      market_summary: {
        ohlcv_summary: weeklyMarketData.ohlcv_summary || {},
        technical_summary: weeklyMarketData.technical_summary || {},
        sector_performance: weeklyMarketData.sector_performance || {},
        derivatives_summary: weeklyMarketData.derivatives_summary || {}
      },
      news_summary: {
        total_news: newsData.total_news || 0,
        high_importance_news: newsData.high_importance_news || 0,
        news_by_category: newsData.news_by_category || {}
      },
      integration_date: new Date().toISOString()
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：整合本週數據失敗：${error.message}`);
    return {};
  }
}

/**
 * 總結宏觀數據類別
 * 
 * @param {Object} categoryData - 類別數據
 * @returns {Object} summary - 摘要
 */
function summarizeMacroCategory(categoryData) {
  const symbols = Object.keys(categoryData);
  const summary = {
    symbols: symbols,
    latest_values: {},
    trends: {}
  };
  
  for (const symbol of symbols) {
    const dataPoints = categoryData[symbol] || [];
    if (dataPoints.length > 0) {
      const latest = dataPoints[0];  // 最新的數據點
      summary.latest_values[symbol] = {
        value: latest.value,
        change: latest.change,
        change_pct: latest.change_pct,
        date: latest.date
      };
      
      // 計算趨勢（簡化：比較最新和最早的值）
      if (dataPoints.length > 1) {
        const earliest = dataPoints[dataPoints.length - 1];
        const trend = latest.value - earliest.value;
        summary.trends[symbol] = {
          trend: trend > 0 ? "UP" : (trend < 0 ? "DOWN" : "STABLE"),
          change_pct: earliest.value !== 0 ? ((trend / earliest.value) * 100) : 0
        };
      }
    }
  }
  
  return summary;
}

/**
 * 獲取本週新聞數據
 * 
 * @returns {Object} newsData - 新聞數據
 */
function getWeeklyNewsData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("NEWS_ATOMS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {};
    }
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const importanceCol = headers.indexOf("importance");
    const categoryCol = headers.indexOf("category");
    
    if (dateCol === -1) {
      return {};
    }
    
    const newsData = {
      total_news: 0,
      high_importance_news: 0,
      news_by_category: {}
    };
    
    for (let i = 1; i < rows.length; i++) {
      const rowDate = new Date(rows[i][dateCol]);
      if (rowDate >= weekAgo && rowDate <= today) {
        newsData.total_news++;
        
        const importance = rows[i][importanceCol];
        if (importance === "HIGH" || importance === "CRITICAL") {
          newsData.high_importance_news++;
        }
        
        const category = rows[i][categoryCol];
        if (category) {
          if (!newsData.news_by_category[category]) {
            newsData.news_by_category[category] = 0;
          }
          newsData.news_by_category[category]++;
        }
      }
    }
    
    return newsData;
    
  } catch (error) {
    Logger.log(`P5 Weekly：獲取本週新聞數據失敗：${error.message}`);
    return {};
  }
}

/**
 * 與歷史世界觀對照
 * 
 * @param {Object} currentIntegration - 當前整合結果
 * @param {Array} worldviewHistory - 歷史世界觀更新
 * @returns {Object} comparison - 對照結果
 */
function compareWorldviewWithHistory(currentIntegration, worldviewHistory) {
  try {
    if (worldviewHistory.length === 0) {
      return {
        status: "NO_HISTORY",
        message: "無歷史世界觀數據"
      };
    }
    
    const lastWeekWorldview = worldviewHistory[0];  // 最新的（上週）
    const lastMonthWorldview = worldviewHistory.length > 3 ? worldviewHistory[3] : null;  // 一個月前
    
    return {
      vs_last_week: {
        worldview_changes: extractWorldviewChanges(currentIntegration, lastWeekWorldview),
        key_differences: identifyKeyDifferences(currentIntegration, lastWeekWorldview)
      },
      vs_last_month: lastMonthWorldview ? {
        worldview_changes: extractWorldviewChanges(currentIntegration, lastMonthWorldview),
        key_differences: identifyKeyDifferences(currentIntegration, lastMonthWorldview)
      } : null,
      evolution_trend: analyzeEvolutionTrend(worldviewHistory)
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：與歷史世界觀對照失敗：${error.message}`);
    return {};
  }
}

/**
 * 提取世界觀變化
 * 
 * @param {Object} current - 當前世界觀
 * @param {Object} historical - 歷史世界觀
 * @returns {Object} changes - 變化
 */
function extractWorldviewChanges(current, historical) {
  // 簡化實現：比較關鍵指標
  return {
    macro_changes: "需要 AI 分析",
    market_changes: "需要 AI 分析",
    news_changes: "需要 AI 分析"
  };
}

/**
 * 識別關鍵差異
 * 
 * @param {Object} current - 當前世界觀
 * @param {Object} historical - 歷史世界觀
 * @returns {Array} differences - 關鍵差異列表
 */
function identifyKeyDifferences(current, historical) {
  // 簡化實現：返回空數組，實際應該由 AI 分析
  return [];
}

/**
 * 分析演變趨勢
 * 
 * @param {Array} worldviewHistory - 歷史世界觀更新
 * @returns {Object} trend - 演變趨勢
 */
function analyzeEvolutionTrend(worldviewHistory) {
  // 簡化實現：返回基本趨勢
  return {
    direction: "STABLE",  // UPWARD/DOWNWARD/STABLE
    volatility: "LOW",     // LOW/MEDIUM/HIGH
    key_shifts: []
  };
}

/**
 * 分析世界觀與市場反應的連結
 * 
 * @param {Object} worldviewIntegration - 世界觀整合結果
 * @param {Object} marketData - 市場數據
 * @param {Array} worldviewHistory - 歷史世界觀
 * @returns {Object} alignment - 對齊分析
 */
function analyzeWorldviewMarketAlignment(worldviewIntegration, marketData, worldviewHistory) {
  try {
    // 簡化實現：基本對齊分析
    return {
      alignment_status: "NEUTRAL",  // ALIGNED/MISALIGNED/NEUTRAL
      alignment_score: 0.5,         // 0-1，1 為完全對齊
      divergence_factors: [],
      alignment_analysis: "需要 AI 分析"
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：分析世界觀與市場反應連結失敗：${error.message}`);
    return {};
  }
}

/**
 * 生成程式化世界觀（當 AI 分析失敗時使用）
 * 
 * @param {Object} data - 數據
 * @returns {Object} worldview - 世界觀結果
 */
function generateProgrammaticWorldview(data) {
  try {
    return {
      status: "PROGRAMMATIC",
      weekly_worldview: {
        overall_status: "TRANSITION",
        key_themes: [],
        market_regime: "TRANSITION"
      },
      worldview_evolution: {
        changes_from_last_week: "無變化",
        changes_from_last_month: "無變化",
        trend_direction: "STABLE"
      },
      market_alignment: {
        alignment_status: "NEUTRAL",
        alignment_analysis: "程式化分析（AI 分析失敗）"
      },
      key_conclusions: []
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：生成程式化世界觀失敗：${error.message}`);
    return {};
  }
}

// ==========================================
// 籌碼面週報彙總 ⭐ V8.0 新增
// ==========================================

/**
 * 生成籌碼面週報彙總 ⭐ V8.0 新增
 * 
 * @param {Object} smartMoneyData - 籌碼面數據
 * @returns {Object} report - 籌碼面週報
 */
function generateSmartMoneyWeeklyReport(smartMoneyData) {
  try {
    const report = {
      insider_trading_summary: {
        total_transactions: 0,
        buy_signals: 0,
        sell_signals: 0,
        high_importance: []
      },
      dark_pool_summary: {
        total_activities: 0,
        bullish_activities: 0,
        bearish_activities: 0,
        key_tickers: []
      },
      options_flow_summary: {
        put_call_ratio_avg: 0,
        unusual_activity_count: 0,
        key_tickers: []
      },
      overall_signal: "NEUTRAL",  // BULLISH/NEUTRAL/BEARISH
      key_insights: []
    };
    
    // 處理內部人交易數據
    if (smartMoneyData.insider_trading) {
      const insiderData = smartMoneyData.insider_trading;
      report.insider_trading_summary.total_transactions = insiderData.length || 0;
      
      for (const transaction of insiderData) {
        if (transaction.signal === "BUY") {
          report.insider_trading_summary.buy_signals++;
        } else if (transaction.signal === "SELL") {
          report.insider_trading_summary.sell_signals++;
        }
        
        if (transaction.importance === "HIGH" || transaction.importance === "CRITICAL") {
          report.insider_trading_summary.high_importance.push({
            ticker: transaction.ticker,
            signal: transaction.signal,
            amount: transaction.amount,
            date: transaction.date
          });
        }
      }
    }
    
    // 處理 Dark Pool 數據
    if (smartMoneyData.dark_pool) {
      const darkPoolData = smartMoneyData.dark_pool;
      report.dark_pool_summary.total_activities = darkPoolData.length || 0;
      
      for (const activity of darkPoolData) {
        if (activity.sentiment === "BULLISH") {
          report.dark_pool_summary.bullish_activities++;
        } else if (activity.sentiment === "BEARISH") {
          report.dark_pool_summary.bearish_activities++;
        }
        
        if (activity.importance === "HIGH") {
          report.dark_pool_summary.key_tickers.push({
            ticker: activity.ticker,
            sentiment: activity.sentiment,
            volume: activity.volume
          });
        }
      }
    }
    
    // 處理期權流向數據
    if (smartMoneyData.options_flow) {
      const optionsData = smartMoneyData.options_flow;
      let totalPCR = 0;
      let count = 0;
      
      for (const flow of optionsData) {
        if (flow.put_call_ratio) {
          totalPCR += flow.put_call_ratio;
          count++;
        }
        
        if (flow.unusual_activity) {
          report.options_flow_summary.unusual_activity_count++;
          report.options_flow_summary.key_tickers.push({
            ticker: flow.ticker,
            activity_type: flow.activity_type,
            volume: flow.volume
          });
        }
      }
      
      if (count > 0) {
        report.options_flow_summary.put_call_ratio_avg = totalPCR / count;
      }
    }
    
    // 綜合判斷整體信號
    const buySignals = report.insider_trading_summary.buy_signals + report.dark_pool_summary.bullish_activities;
    const sellSignals = report.insider_trading_summary.sell_signals + report.dark_pool_summary.bearish_activities;
    
    if (buySignals > sellSignals * 1.5) {
      report.overall_signal = "BULLISH";
    } else if (sellSignals > buySignals * 1.5) {
      report.overall_signal = "BEARISH";
    } else {
      report.overall_signal = "NEUTRAL";
    }
    
    // 生成關鍵洞察
    if (report.insider_trading_summary.high_importance.length > 0) {
      report.key_insights.push(`本週有 ${report.insider_trading_summary.high_importance.length} 筆高重要性內部人交易`);
    }
    
    if (report.dark_pool_summary.bearish_activities > report.dark_pool_summary.bullish_activities * 2) {
      report.key_insights.push("Dark Pool 活動顯示看跌情緒");
    }
    
    if (report.options_flow_summary.put_call_ratio_avg > 1.2) {
      report.key_insights.push("Put/Call Ratio 偏高，市場避險情緒上升");
    }
    
    return report;
    
  } catch (error) {
    Logger.log(`P5 Weekly：生成籌碼面週報失敗：${error.message}`);
    return {
      overall_signal: "NEUTRAL",
      error: error.message
    };
  }
}

// ==========================================
// Sector ETF Flow 分析 ⭐ V8.0 新增
// ==========================================

/**
 * 分析 Sector ETF Flow（從 Daily 數據計算 5 日/20 日資金流向、momentum）⭐ V8.0 新增
 * 
 * @returns {Object} flows - Sector ETF Flow 分析結果
 */
function analyzeSectorETFFlows() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("SECTOR_ETF_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log("P5 Weekly：SECTOR_ETF_DAILY 表格不存在或沒有數據");
      return {};
    }
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const tickerCol = headers.indexOf("etf_ticker");
    const closeCol = headers.indexOf("close");
    const volumeCol = headers.indexOf("volume") !== -1 ? headers.indexOf("volume") : null;
    
    if (dateCol === -1 || tickerCol === -1 || closeCol === -1) {
      Logger.log("P5 Weekly：SECTOR_ETF_DAILY 表格格式錯誤");
      return {};
    }
    
    // 按 ETF 分組數據
    const etfData = {};
    
    for (let i = 1; i < rows.length; i++) {
      const ticker = rows[i][tickerCol];
      const date = new Date(rows[i][dateCol]);
      const close = parseFloat(rows[i][closeCol]);
      const volume = volumeCol !== null ? parseFloat(rows[i][volumeCol]) : null;
      
      if (!ticker || isNaN(close) || close <= 0) {
        continue;
      }
      
      if (!etfData[ticker]) {
        etfData[ticker] = [];
      }
      
      etfData[ticker].push({
        date: date,
        close: close,
        volume: volume
      });
    }
    
    // 計算每個 ETF 的 Flow
    const flows = {};
    const today = new Date();
    
    for (const ticker in etfData) {
      const data = etfData[ticker].sort((a, b) => b.date - a.date);  // 按日期降序排列
      
      if (data.length < 20) {
        continue;  // 數據不足
      }
      
      const latest = data[0];
      const day5Ago = data.length > 5 ? data[5] : null;
      const day20Ago = data.length > 20 ? data[20] : null;
      
      // 計算 5 日 Flow（簡化：使用價格變化 * 平均成交量）
      let flow_5d = null;
      if (day5Ago && latest.volume && day5Ago.volume) {
        const priceChange = latest.close - day5Ago.close;
        const avgVolume = (latest.volume + day5Ago.volume) / 2;
        flow_5d = priceChange * avgVolume / 1e9;  // 轉換為十億美元
      } else if (day5Ago) {
        const priceChangePct = ((latest.close - day5Ago.close) / day5Ago.close) * 100;
        flow_5d = priceChangePct * 0.1;  // 簡化估算（無成交量數據時）
      }
      
      // 計算 20 日 Flow
      let flow_20d = null;
      if (day20Ago && latest.volume && day20Ago.volume) {
        const priceChange = latest.close - day20Ago.close;
        const avgVolume = (latest.volume + day20Ago.volume) / 2;
        flow_20d = priceChange * avgVolume / 1e9;
      } else if (day20Ago) {
        const priceChangePct = ((latest.close - day20Ago.close) / day20Ago.close) * 100;
        flow_20d = priceChangePct * 0.1;
      }
      
      // 計算 Momentum（5 日 Flow / 20 日 Flow）
      let momentum = null;
      if (flow_5d !== null && flow_20d !== null && flow_20d !== 0) {
        momentum = flow_5d / Math.abs(flow_20d);
      }
      
      flows[ticker] = {
        flow_5d: flow_5d !== null ? Math.round(flow_5d * 100) / 100 : null,
        flow_20d: flow_20d !== null ? Math.round(flow_20d * 100) / 100 : null,
        momentum: momentum !== null ? Math.round(momentum * 100) / 100 : null,
        latest_close: latest.close,
        latest_date: latest.date
      };
    }
    
    Logger.log(`P5 Weekly：完成 Sector ETF Flow 分析，共 ${Object.keys(flows).length} 個 ETF`);
    return flows;
    
  } catch (error) {
    Logger.log(`P5 Weekly：分析 Sector ETF Flow 失敗：${error.message}`);
    return {};
  }
}

/**
 * 識別資金輪動（Rotation Signal）⭐ V8.0 新增
 * 
 * @param {Object} flows - Sector ETF Flow 分析結果
 * @returns {Object} rotation - 資金輪動信號
 */
function identifyRotation(flows) {
  try {
    if (!flows || Object.keys(flows).length === 0) {
      return {
        from_sectors: [],
        to_sectors: [],
        regime: "UNKNOWN",
        confidence: 0
      };
    }
    
    // 按 Flow 排序
    const sortedByFlow5d = Object.entries(flows)
      .map(([ticker, data]) => ({ ticker, flow_5d: data.flow_5d || 0 }))
      .sort((a, b) => b.flow_5d - a.flow_5d);
    
    const sortedByFlow20d = Object.entries(flows)
      .map(([ticker, data]) => ({ ticker, flow_20d: data.flow_20d || 0 }))
      .sort((a, b) => b.flow_20d - a.flow_20d);
    
    // 識別資金流入和流出
    const topInflows = sortedByFlow5d.slice(0, 3).map(item => item.ticker);
    const topOutflows = sortedByFlow5d.slice(-3).map(item => item.ticker);
    
    // 判斷 Regime
    let regime = "ROTATION";
    let confidence = 0.5;
    
    // 檢查是否為 RISK_ON（科技、消費等成長板塊流入）
    const riskOnSectors = ["XLK", "XLY", "XLC"];  // Technology, Consumer Discretionary, Communication
    const riskOffSectors = ["XLU", "XLP", "XLV"];  // Utilities, Consumer Staples, Healthcare
    
    const riskOnInflow = topInflows.filter(t => riskOnSectors.includes(t)).length;
    const riskOffInflow = topInflows.filter(t => riskOffSectors.includes(t)).length;
    
    if (riskOnInflow >= 2 && riskOffInflow === 0) {
      regime = "RISK_ON";
      confidence = 0.7;
    } else if (riskOffInflow >= 2 && riskOnInflow === 0) {
      regime = "RISK_OFF";
      confidence = 0.7;
    } else if (topInflows.length > 0 && topOutflows.length > 0) {
      regime = "ROTATION";
      confidence = 0.6;
    }
    
    // 檢查是否為 CRISIS（所有板塊流出）
    const allNegative = sortedByFlow5d.every(item => item.flow_5d < 0);
    if (allNegative && sortedByFlow5d.length >= 5) {
      regime = "CRISIS";
      confidence = 0.8;
    }
    
    return {
      from_sectors: topOutflows,
      to_sectors: topInflows,
      regime: regime,
      confidence: confidence,
      flow_details: flows
    };
    
  } catch (error) {
    Logger.log(`P5 Weekly：識別資金輪動失敗：${error.message}`);
    return {
      from_sectors: [],
      to_sectors: [],
      regime: "UNKNOWN",
      confidence: 0
    };
  }
}

// ==========================================
// Mag 7 集體表現分析 ⭐ V8.0 新增
// ==========================================

/**
 * 分析 Mag 7 集體表現 ⭐ V8.0 新增
 * 
 * Mag 7 成員：AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA
 * 每檔財報評分：+2（Beat + 指引上調）、+1（Beat + 持平）、0（符合）、-1（Miss + 持平）、-2（Miss + 下調）
 * 總分範圍：-14 to +14
 * Regime 映射：+10 to +14 = BULL_STRONG（U_macro 0.80）、-14 to -10 = BEAR_STRONG（U_macro 0.30，DEFCON 1）
 * 
 * @returns {Object} analysis - Mag 7 集體表現分析結果
 */
function analyzeMag7CollectivePerformance() {
  try {
    const MAG7_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"];
    
    // 從財報數據中讀取 Mag 7 成員的財報結果
    // 這裡需要從 EARNINGS_CALENDAR 或財報結果表格中讀取
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const earningsSheet = ss.getSheetByName("EARNINGS_CALENDAR");
    
    const mag7Scores = {};
    let totalScore = 0;
    
    // 掃描最近 6 週的財報結果（財報季通常持續 4-6 週）
    const today = new Date();
    const sixWeeksAgo = new Date(today.getTime() - 42 * 24 * 60 * 60 * 1000);
    
    if (earningsSheet && earningsSheet.getLastRow() > 1) {
      const dataRange = earningsSheet.getDataRange();
      const rows = dataRange.getValues();
      const headers = rows[0];
      
      const tickerCol = headers.indexOf("ticker");
      const dateCol = headers.indexOf("earnings_date") !== -1 ? headers.indexOf("earnings_date") : headers.indexOf("date");
      const resultCol = headers.indexOf("result") !== -1 ? headers.indexOf("result") : headers.indexOf("earnings_result");
      const guidanceCol = headers.indexOf("guidance") !== -1 ? headers.indexOf("guidance") : headers.indexOf("guidance_change");
      
      for (let i = 1; i < rows.length; i++) {
        const ticker = rows[i][tickerCol];
        if (!MAG7_TICKERS.includes(ticker)) {
          continue;
        }
        
        const earningsDate = new Date(rows[i][dateCol]);
        if (earningsDate < sixWeeksAgo || earningsDate > today) {
          continue;  // 不在最近 6 週內
        }
        
        // 評分邏輯
        const result = rows[i][resultCol] || "";
        const guidance = rows[i][guidanceCol] || "";
        
        let score = 0;
        
        // Beat/Miss 判斷
        const isBeat = result.includes("BEAT") || result.includes("Beat") || result.includes("beat");
        const isMiss = result.includes("MISS") || result.includes("Miss") || result.includes("miss");
        const isMeet = result.includes("MEET") || result.includes("Meet") || result.includes("meet") || result === "";
        
        // Guidance 判斷
        const guidanceUp = guidance.includes("UP") || guidance.includes("Up") || guidance.includes("上調");
        const guidanceDown = guidance.includes("DOWN") || guidance.includes("Down") || guidance.includes("下調");
        const guidanceFlat = guidance.includes("FLAT") || guidance.includes("Flat") || guidance.includes("持平") || guidance === "";
        
        // 計算評分
        if (isBeat && guidanceUp) {
          score = 2;  // Beat + 指引上調
        } else if (isBeat && guidanceFlat) {
          score = 1;  // Beat + 指引持平
        } else if (isMeet && guidanceFlat) {
          score = 0;  // 符合預期
        } else if (isMiss && guidanceFlat) {
          score = -1;  // Miss + 指引持平
        } else if (isMiss && guidanceDown) {
          score = -2;  // Miss + 指引下調
        } else if (isBeat && guidanceDown) {
          score = 0;  // Beat 但指引下調（中性）
        } else if (isMiss && guidanceUp) {
          score = -1;  // Miss 但指引上調（略負）
        }
        
        // 如果該股票已有評分，取較新的（或累加，這裡取較新的）
        if (!mag7Scores[ticker] || earningsDate > mag7Scores[ticker].date) {
          mag7Scores[ticker] = {
            score: score,
            date: earningsDate,
            result: result,
            guidance: guidance
          };
        }
      }
    }
    
    // 計算總分
    for (const ticker of MAG7_TICKERS) {
      if (mag7Scores[ticker]) {
        totalScore += mag7Scores[ticker].score;
      } else {
        // 如果沒有財報數據，視為 0（中性）
        mag7Scores[ticker] = {
          score: 0,
          date: null,
          result: "NO_DATA",
          guidance: "NO_DATA"
        };
      }
    }
    
    // Regime 映射
    let regimeMapping = "NEUTRAL";
    let uMacroRecommendation = 0.60;
    let defconRecommendation = "DEFCON_5";
    
    if (totalScore >= 10) {
      regimeMapping = "BULL_STRONG";
      uMacroRecommendation = 0.80;
      defconRecommendation = "DEFCON_5";
    } else if (totalScore >= 5) {
      regimeMapping = "BULL_WEAK";
      uMacroRecommendation = 0.70;
      defconRecommendation = "DEFCON_5";
    } else if (totalScore >= -4) {
      regimeMapping = "NEUTRAL";
      uMacroRecommendation = 0.60;
      defconRecommendation = "DEFCON_4";
    } else if (totalScore >= -9) {
      regimeMapping = "BEAR_WEAK";
      uMacroRecommendation = 0.50;
      defconRecommendation = "DEFCON_3";
    } else {
      regimeMapping = "BEAR_STRONG";
      uMacroRecommendation = 0.30;
      defconRecommendation = "DEFCON_1";
    }
    
    const analysis = {
      mag7_tickers: MAG7_TICKERS,
      individual_scores: mag7Scores,
      total_score: totalScore,
      score_range: "[-14 to +14]",
      regime_mapping: regimeMapping,
      u_macro_recommendation: uMacroRecommendation,
      defcon_recommendation: defconRecommendation,
      analysis_period: {
        start: sixWeeksAgo.toISOString(),
        end: today.toISOString()
      },
      interpretation: {
        summary: `Mag 7 總分：${totalScore}（範圍：-14 到 +14）`,
        regime_impact: `映射到 Regime：${regimeMapping}`,
        u_macro_impact: `建議 U_macro：${uMacroRecommendation}`,
        defcon_impact: `建議 DEFCON：${defconRecommendation}`
      }
    };
    
    Logger.log(`P5 Weekly：完成 Mag 7 集體表現分析，總分=${totalScore}，Regime=${regimeMapping}`);
    return analysis;
    
  } catch (error) {
    Logger.log(`P5 Weekly：分析 Mag 7 集體表現失敗：${error.message}`);
    return {
      mag7_tickers: ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"],
      individual_scores: {},
      total_score: 0,
      score_range: "[-14 to +14]",
      regime_mapping: "NEUTRAL",
      u_macro_recommendation: 0.60,
      defcon_recommendation: "DEFCON_5",
      error: error.message
    };
  }
}

// ==========================================
// Regime 準度追蹤機制 ⭐ V8.0 新增
// ==========================================

/**
 * 保存 Regime 預測 ⭐ V8.0 新增
 * 
 * @param {Object} prediction - 預測數據
 * @param {string} prediction.predicted_regime - 預測的 Regime
 * @param {number} prediction.prediction_confidence - 預測信心度
 */
function saveRegimePrediction(prediction) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("REGIME_PREDICTION_TRACKING");
    
    if (!sheet) {
      // 創建表格
      sheet = ss.insertSheet("REGIME_PREDICTION_TRACKING");
      sheet.appendRow(REGIME_PREDICTION_TRACKING_SCHEMA.headers);
    }
    
    const today = new Date();
    const predictionId = `REGIME_${today.getFullYear()}_W${getWeekNumber(today)}_${Date.now()}`;
    const verificationDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);  // 7 天後驗證
    
    const row = [
      predictionId,
      Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd"),
      prediction.predicted_regime || "UNKNOWN",
      prediction.prediction_confidence || 0.5,
      Utilities.formatDate(verificationDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
      null,  // actual_regime（待驗證）
      null,  // is_correct（待驗證）
      null,  // accuracy_score（待驗證）
      null,  // notes
      new Date()
    ];
    
    sheet.appendRow(row);
    Logger.log(`P5 Weekly：Regime 預測已保存：${predictionId}, 預測=${prediction.predicted_regime}`);
    
  } catch (error) {
    Logger.log(`P5 Weekly：保存 Regime 預測失敗：${error.message}`);
  }
}

/**
 * 驗證 7 天前的 Regime 預測 ⭐ V8.0 新增
 */
function verifyRegimePredictions() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("REGIME_PREDICTION_TRACKING");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    
    const predictionDateCol = headers.indexOf("prediction_date");
    const verificationDateCol = headers.indexOf("verification_date");
    const predictedRegimeCol = headers.indexOf("predicted_regime");
    const actualRegimeCol = headers.indexOf("actual_regime");
    const isCorrectCol = headers.indexOf("is_correct");
    const accuracyScoreCol = headers.indexOf("accuracy_score");
    
    // 獲取當前實際 Regime（從最新 P5 Weekly 快照）
    const latestWorldview = getLatestP5WeeklySnapshot();
    const actualRegime = latestWorldview && latestWorldview.market_analysis ? 
                         latestWorldview.market_analysis.market_regime : null;
    
    if (!actualRegime) {
      Logger.log("P5 Weekly：無法獲取當前實際 Regime，跳過驗證");
      return;
    }
    
    // 驗證需要驗證的預測（verification_date <= today 且 actual_regime 為空）
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const verificationDate = new Date(row[verificationDateCol]);
      verificationDate.setHours(0, 0, 0, 0);
      
      const currentActualRegime = row[actualRegimeCol];
      const predictedRegime = row[predictedRegimeCol];
      
      // 如果驗證日期已到且尚未驗證
      if (verificationDate <= today && !currentActualRegime) {
        const isCorrect = predictedRegime === actualRegime;
        const accuracyScore = isCorrect ? 1.0 : 0.0;
        
        // 更新行
        sheet.getRange(i + 1, actualRegimeCol + 1).setValue(actualRegime);
        sheet.getRange(i + 1, isCorrectCol + 1).setValue(isCorrect);
        sheet.getRange(i + 1, accuracyScoreCol + 1).setValue(accuracyScore);
        
        Logger.log(`P5 Weekly：驗證 Regime 預測 - 預測=${predictedRegime}, 實際=${actualRegime}, 正確=${isCorrect}`);
      }
    }
    
    // 計算總準度
    const accuracy = calculateRegimeAccuracy();
    Logger.log(`P5 Weekly：Regime 預測總準度=${(accuracy * 100).toFixed(2)}%`);
    
  } catch (error) {
    Logger.log(`P5 Weekly：驗證 Regime 預測失敗：${error.message}`);
  }
}

/**
 * 計算 Regime 預測總準度 ⭐ V8.0 新增
 * 
 * @returns {number} 準度（0-1）
 */
function calculateRegimeAccuracy() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("REGIME_PREDICTION_TRACKING");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return 0;
    }
    
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const isCorrectCol = headers.indexOf("is_correct");
    const accuracyScoreCol = headers.indexOf("accuracy_score");
    
    let totalPredictions = 0;
    let totalScore = 0;
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const isCorrect = row[isCorrectCol];
      const accuracyScore = row[accuracyScoreCol];
      
      // 只計算已驗證的預測
      if (isCorrect !== null && isCorrect !== "" && accuracyScore !== null && accuracyScore !== "") {
        totalPredictions++;
        totalScore += parseFloat(accuracyScore) || 0;
      }
    }
    
    if (totalPredictions === 0) {
      return 0;
    }
    
    const accuracy = totalScore / totalPredictions;
    return accuracy;
    
  } catch (error) {
    Logger.log(`P5 Weekly：計算 Regime 準度失敗：${error.message}`);
    return 0;
  }
}

/**
 * ⭐ V8.0 新增：獲取本週 P6 異常記錄
 * 
 * @returns {Array} anomalies - 本週異常列表
 */
function getP6WeeklyAnomalies() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P6_INTRADAY_ALERTS_DAILY");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    // 獲取本週的異常（過去 7 天）
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const alertTypeCol = headers.indexOf("alert_type");
    const severityCol = headers.indexOf("alert_severity");
    const detailsCol = headers.indexOf("trigger_condition_json");
    
    if (dateCol === -1) {
      return [];
    }
    
    const anomalies = [];
    for (let i = 1; i < rows.length; i++) {
      const rowDate = rows[i][dateCol];
      if (rowDate instanceof Date && rowDate >= weekAgo) {
        anomalies.push({
          date: rowDate,
          alertType: rows[i][alertTypeCol],
          severity: rows[i][severityCol],
          details: rows[i][detailsCol] ? JSON.parse(rows[i][detailsCol]) : {}
        });
      }
    }
    
    Logger.log(`P5 Weekly：讀取到 ${anomalies.length} 筆 P6 異常記錄`);
    
    return anomalies;
    
  } catch (error) {
    Logger.log(`P5 Weekly：讀取 P6 異常記錄失敗：${error.message}`);
    return [];
  }
}

/**
 * ⭐ V8.0 新增：獲取本週 P6 緊急撤退記錄
 * 
 * @returns {Array} emergencyExits - 本週緊急撤退記錄
 */
function getP6WeeklyEmergencyExits() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("P6_EMERGENCY_EXIT_LOG");
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    // 獲取本週的緊急撤退記錄（過去 7 天）
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataRange = sheet.getDataRange();
    const rows = dataRange.getValues();
    const headers = rows[0];
    
    const dateCol = headers.indexOf("date");
    const triggerTypeCol = headers.indexOf("trigger_type");
    const reductionPctCol = headers.indexOf("reduction_pct");
    const executionStatusCol = headers.indexOf("execution_status");
    
    if (dateCol === -1) {
      return [];
    }
    
    const emergencyExits = [];
    for (let i = 1; i < rows.length; i++) {
      const rowDate = rows[i][dateCol];
      if (rowDate instanceof Date && rowDate >= weekAgo) {
        emergencyExits.push({
          date: rowDate,
          triggerType: rows[i][triggerTypeCol],
          reductionPct: rows[i][reductionPctCol],
          executionStatus: rows[i][executionStatusCol]
        });
      }
    }
    
    Logger.log(`P5 Weekly：讀取到 ${emergencyExits.length} 筆 P6 緊急撤退記錄`);
    
    return emergencyExits;
    
  } catch (error) {
    Logger.log(`P5 Weekly：讀取 P6 緊急撤退記錄失敗：${error.message}`);
    return [];
  }
}
