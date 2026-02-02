/**
 * 📈 P3: 技術分析 - AI 分析模組
 * 
 * 負責構建 AI Prompt、整合機構級視角、生成輸出
 * 
 * @version SSOT V7.1
 * @date 2025-01-11
 */

// ==========================================
// 機構級視角整合
// ==========================================

/**
 * 整合機構級視角到技術分析結果
 * 
 * @param {Object} technicalAnalysis - 技術分析結果
 * @param {Object} institutionalData - 機構級數據
 * @returns {Object} enhancedAnalysis - 增強後的分析結果
 */
function integrateInstitutionalPerspectiveP3(technicalAnalysis, institutionalData) {
  const enhanced = {
    ...technicalAnalysis,
    institutional_insights: {}
  };
  
  if (!institutionalData || Object.keys(institutionalData).length === 0) {
    Logger.log("P3：無機構級數據，跳過整合");
    return enhanced;
  }
  
  // 獲取機構數據權重配置
  const weights = getAllInstitutionalWeights();
  
  // 整合各類機構數據
  const insights = {
    f13f: null,              // 13F 數據（權重 20%，用於選池子）
    dark_pool: null,         // Dark Pool 數據（權重 30%，用於選時機）
    options_flow: null,      // Options Flow 數據（權重 40%，用於選時機）
    insider_trading: null,   // Insider Trading 數據（權重 10%，用於選時機）
    weighted_signal: null,   // 加權後的綜合信號
    divergence_flags: []     // 分歧標記
  };
  
  // 處理 13F 數據（權重 20%，用於選池子）
  if (institutionalData.f13f) {
    const f13fData = institutionalData.f13f;
    const delayDays = f13fData.delay_days || 45;
    const adjustedWeight = calculateWeightDecay("13F", delayDays);
    
    insights.f13f = {
      data: f13fData,
      weight: adjustedWeight,
      usage: "POOL_SELECTION",  // 用於選池子，不用於選時機
      note: delayDays > 45 ? `數據延遲 ${delayDays} 天，權重已衰減` : "數據正常"
    };
  }
  
  // 處理 Dark Pool 數據（權重 30%，用於選時機）
  if (institutionalData.dark_pool) {
    const darkPoolData = institutionalData.dark_pool;
    insights.dark_pool = {
      data: darkPoolData,
      weight: weights.DARK_POOL.weight,
      usage: "TIMING",
      divergence: darkPoolData.divergence || 0  // Dark Pool vs Lit Market 分歧
    };
    
    // 檢查分歧（規則 A4）
    if (darkPoolData.divergence && darkPoolData.divergence > 0.20) {
      insights.divergence_flags.push({
        type: "DARK_POOL_DIVERGENCE",
        value: darkPoolData.divergence,
        severity: "HIGH",
        note: "Dark Pool vs Lit Market 分歧 > 20%，建議觸發 DEFCON +5"
      });
    }
  }
  
  // 處理 Options Flow 數據（權重 40%，用於選時機）
  if (institutionalData.options_flow) {
    const optionsFlowData = institutionalData.options_flow;
    insights.options_flow = {
      data: optionsFlowData,
      weight: weights.OPTIONS_FLOW.weight,
      usage: "TIMING",
      unusual_activity: optionsFlowData.unusual_activity || false
    };
  }
  
  // 處理 Insider Trading 數據（權重 10%，用於選時機）
  if (institutionalData.insider_trading) {
    const insiderData = institutionalData.insider_trading;
    insights.insider_trading = {
      data: insiderData,
      weight: weights.INSIDER_TRADING.weight,
      usage: "TIMING"
    };
  }
  
  // 計算加權後的綜合信號
  let weightedBuySignal = 0;
  let weightedSellSignal = 0;
  let totalWeight = 0;
  
  // 13F 只用於選池子，不參與時機信號計算
  // Dark Pool、Options Flow、Insider Trading 用於時機信號
  
  if (insights.dark_pool && insights.dark_pool.data.signal) {
    const signal = insights.dark_pool.data.signal === "BUY" ? 1 : -1;
    weightedBuySignal += signal * insights.dark_pool.weight;
    totalWeight += insights.dark_pool.weight;
  }
  
  if (insights.options_flow && insights.options_flow.data.signal) {
    const signal = insights.options_flow.data.signal === "BUY" ? 1 : -1;
    weightedBuySignal += signal * insights.options_flow.weight;
    totalWeight += insights.options_flow.weight;
  }
  
  if (insights.insider_trading && insights.insider_trading.data.signal) {
    const signal = insights.insider_trading.data.signal === "BUY" ? 1 : -1;
    weightedBuySignal += signal * insights.insider_trading.weight;
    totalWeight += insights.insider_trading.weight;
  }
  
  if (totalWeight > 0) {
    const normalizedSignal = weightedBuySignal / totalWeight;
    insights.weighted_signal = {
      value: normalizedSignal,
      interpretation: normalizedSignal > 0.3 ? "BUY" : (normalizedSignal < -0.3 ? "SELL" : "NEUTRAL"),
      confidence: Math.abs(normalizedSignal)
    };
  }
  
  // 檢查機構行為分歧（規則 A1）
  if (insights.f13f && insights.f13f.data.signal) {
    const f13fSignal = insights.f13f.data.signal;
    const timingSignal = insights.weighted_signal?.interpretation;
    
    if (f13fSignal === "BUY" && timingSignal === "SELL") {
      insights.divergence_flags.push({
        type: "13F_VS_TIMING",
        f13f: "BUY",
        timing: "SELL",
        severity: "HIGH",
        note: "13F 顯示買入，但 Dark Pool/Options Flow 顯示賣出，標記分歧，禁止加碼"
      });
    } else if (f13fSignal === "SELL" && timingSignal === "BUY") {
      insights.divergence_flags.push({
        type: "13F_VS_TIMING",
        f13f: "SELL",
        timing: "BUY",
        severity: "MEDIUM",
        note: "13F 顯示賣出，但 Dark Pool/Options Flow 顯示買入"
      });
    }
  }
  
  enhanced.institutional_insights = insights;
  
  Logger.log(`P3：機構級視角整合完成，加權信號：${insights.weighted_signal?.interpretation || "N/A"}`);
  
  return enhanced;
}

// ==========================================
// P3 輸出生成
// ==========================================

/**
 * 生成 P3 輸出
 * 
 * @param {Object} enhancedAnalysis - 增強後的分析結果
 * @param {Object} auditorOutput - 審查者輸出
 * @param {string} frequency - 執行頻率（WEEKLY/MONTHLY）
 * @returns {Object} p3Output - P3 輸出
 */
/**
 * 生成 P3 輸出
 * ⭐ V8.15 新增：添加 risk_overlay_level 計算
 * 
 * @param {Object} enhancedAnalysis - 增強後的分析結果
 * @param {Object} auditorOutput - 審查者輸出
 * @param {string} frequency - 執行頻率
 * @returns {Object} p3Output - P3 輸出
 */
function generateP3Output(enhancedAnalysis, auditorOutput, frequency) {
  const technicalResults = enhancedAnalysis.technical_results || {};
  
  // ⭐ V8.15 新增：為每檔股票計算 risk_overlay_level
  const technicalResultsWithRiskOverlay = {};
  for (const [ticker, result] of Object.entries(technicalResults)) {
    technicalResultsWithRiskOverlay[ticker] = {
      ...result,
      risk_overlay_level: calculateRiskOverlayLevel(ticker, enhancedAnalysis)
    };
  }
  
  // ⭐ V8.16 更新：處理沒有審查者輸出的情況（觸發式審查）
  const hasAuditorOutput = auditorOutput && Object.keys(auditorOutput).length > 0;
  
  return {
    technical_results: technicalResultsWithRiskOverlay,
    cat_assignments: enhancedAnalysis.cat_assignments || {},
    orders: enhancedAnalysis.orders || {},
    institutional_insights: enhancedAnalysis.institutional_insights || {},
    auditor_review: hasAuditorOutput ? (auditorOutput.audit_review || null) : null,
    confidence_level: hasAuditorOutput ? (auditorOutput.confidence || 0.7) : 0.8,  // ⭐ V8.16 更新：沒有審查者時使用較高信心度（因為已經通過觸發條件檢查）
    review_status: hasAuditorOutput ? "REVIEWED" : "NO_REVIEW_NEEDED",  // ⭐ V8.16 新增：標記審查狀態
    frequency: frequency,
    timestamp: new Date().toISOString()
  };
}

/**
 * 計算 risk_overlay_level（風控覆蓋層級）
 * ⭐ V8.15 新增：由 P0.5 p5_weekly_flags + P0.7 決定
 * 
 * @param {string} ticker - 股票代碼
 * @param {Object} enhancedAnalysis - 增強後的分析結果
 * @returns {number} risk_overlay_level - 0/1/2/3
 */
function calculateRiskOverlayLevel(ticker, enhancedAnalysis) {
  try {
    // 讀取 P0.7 快照
    const p0_7_snapshot = getLatestP0_7Snapshot();
    const p0_5_snapshot = getLatestP0_5Snapshot();
    
    let riskLevel = 0;  // 預設無風控覆蓋
    
    // 檢查 P0.7 時間窗口
    if (p0_7_snapshot) {
      const cyclePosition = p0_7_snapshot.cycle_position;
      const turningPointRisk = p0_7_snapshot.turning_point_risk;
      
      // P0.7=Late 或 turning_point_risk=HIGH → risk_overlay_level = 3（禁止 Cat3）
      if (cyclePosition === "Late" || turningPointRisk === "HIGH") {
        riskLevel = 3;
        Logger.log(`P3：${ticker} risk_overlay_level = 3（P0.7 Late 或 High turning point risk）`);
        return riskLevel;
      }
    }
    
    // 檢查 P0.5 p5_weekly_flags
    if (p0_5_snapshot && p0_5_snapshot.chain_dynamics_monitor_json) {
      const p5WeeklyFlags = p0_5_snapshot.chain_dynamics_monitor_json.handoff?.p5_weekly_flags || [];
      
      // DIVERGENCE_ALERT 或 INVENTORY_BUILD_WARNING → risk_overlay_level = 2（Cat2/3 降檔）
      if (p5WeeklyFlags.includes("DIVERGENCE_ALERT") || p5WeeklyFlags.includes("INVENTORY_BUILD_WARNING")) {
        riskLevel = Math.max(riskLevel, 2);
        Logger.log(`P3：${ticker} risk_overlay_level = 2（P0.5 DIVERGENCE_ALERT 或 INVENTORY_BUILD_WARNING）`);
      }
      
      // LATE_CYCLE_RISK → risk_overlay_level = 1（輕度保守）
      if (p5WeeklyFlags.includes("LATE_CYCLE_RISK")) {
        riskLevel = Math.max(riskLevel, 1);
        Logger.log(`P3：${ticker} risk_overlay_level = 1（P0.5 LATE_CYCLE_RISK）`);
      }
    }
    
    return riskLevel;
    
  } catch (error) {
    Logger.log(`計算 risk_overlay_level 失敗（${ticker}）：${error.message}`);
    return 0;  // 預設無風控覆蓋
  }
}

// ==========================================
// Prompt 構建
// ==========================================

/**
 * ⭐ V8.0 新增：構建 P3 批次處理 Prompt
 * @param {string} frequency - 執行頻率（WEEKLY/MONTHLY）
 * @param {Array} batchPhase2Output - 批次 P2 輸出數據（5 檔）
 * @param {Object} batchTechnicalData - 批次技術指標數據
 * @param {Object} batchSmartMoneyData - 批次籌碼面數據
 * @param {number} batchNumber - 批次編號
 * @param {number} totalBatches - 總批數
 * @returns {string} 批次 Prompt
 */
function buildP3BatchPrompt(frequency, batchPhase2Output, batchTechnicalData, batchSmartMoneyData, batchNumber, totalBatches) {
  return `
**⭐ V8.0 批次處理說明（重要）**

本次分析為**批次處理模式**，批次 ${batchNumber}/${totalBatches}。

**批次隔離規則**：
- 使用 \`<<<COMPANY: TICKER>>>\` 分隔符分隔每檔股票
- 每檔股票必須獨立分析，不得混線或交叉污染
- 輸出時必須為每檔股票分別輸出結果，不得合併或簡化
- 必須確保每檔股票分析的完整性和獨立性

---

` + buildP3Prompt(frequency, batchPhase2Output, batchTechnicalData, batchSmartMoneyData).replace(
    /## Layer 1 計算結果（已提供，包含所有技術指標和歷史 OHLCV 數據）/,
    `## Layer 1 計算結果（已提供，包含所有技術指標和歷史 OHLCV 數據）（批次 ${batchNumber}/${totalBatches}）

**重要**：這是批次處理模式，請使用 \`<<<COMPANY: TICKER>>>\` 分隔符分隔每檔股票，確保獨立分析。

`
  );
}

/**
 * 構建 P3 AI Prompt
 * 
 * @param {string} frequency - 執行頻率（WEEKLY/MONTHLY）
 * @param {Array} phase2Output - P2 輸出數據
 * @param {Object} technicalData - 技術指標數據
 * @returns {string} prompt - AI Prompt
 */
/**
 * ⭐ V8.19 實戰模擬一：將 technicalData 格式化為 [WEEKLY_CHART] / [DAILY_CHART] 分區
 * 避免 AI 用日線腦補週線；週線與日線必須明確分區提供。
 * @param {Object} technicalData - key = ticker, value = { weekly_ohlcv, historical_ohlcv, indicators, ... }
 * @returns {string} 格式化字串
 */
function formatTechnicalDataWithWeeklyDailyBlocks(technicalData) {
  if (!technicalData || typeof technicalData !== "object") {
    return JSON.stringify(technicalData || {}, null, 2);
  }
  const lines = [];
  const WEEKLY_MAX = 50;
  const DAILY_MAX = 60;
  for (const [ticker, data] of Object.entries(technicalData)) {
    lines.push("\n<<<COMPANY: " + ticker + ">>>\n");
    const weekly = data.weekly_ohlcv;
    const daily = data.historical_ohlcv || data.ohlcv;
    const weeklyIndicators = data.weekly_indicators;  // ⭐ V8.19 M1 新增：週線技術指標
    
    lines.push("[WEEKLY_CHART]");
    lines.push("- last " + WEEKLY_MAX + " weekly candles（趨勢結構、派發/吸籌證據請由此判斷，禁止用日線推測）");
    if (weekly && Array.isArray(weekly) && weekly.length > 0) {
      const slice = weekly.slice(-WEEKLY_MAX);
      lines.push(JSON.stringify(slice, null, 2));
    } else {
      lines.push("// 週線數據不足，請標註「週線數據不足，無法進行趨勢位階檢查」");
    }
    
    // ⭐ V8.19 M1 新增：週線技術指標
    if (weeklyIndicators) {
      lines.push("");
      lines.push("週線技術指標（MA20/50/200、RSI、MACD）：");
      lines.push(JSON.stringify(weeklyIndicators, null, 2));
    } else {
      lines.push("");
      lines.push("// 週線技術指標：數據不足，無法計算");
    }
    
    lines.push("");
    lines.push("[DAILY_CHART]");
    lines.push("- last " + DAILY_MAX + " daily candles（觸發與進場時機僅由此判斷）");
    if (daily && Array.isArray(daily) && daily.length > 0) {
      const slice = daily.slice(-DAILY_MAX);
      lines.push(JSON.stringify(slice, null, 2));
    } else {
      lines.push("// 日線數據不足");
    }
    
    const rest = {};
    for (const k of Object.keys(data)) {
      if (k !== "weekly_ohlcv" && k !== "historical_ohlcv" && k !== "ohlcv" && k !== "weekly_indicators") rest[k] = data[k];
    }
    if (Object.keys(rest).length > 0) {
      lines.push("");
      lines.push("其餘指標（indicators、relative_strength 等）：");
      lines.push(JSON.stringify(rest, null, 2));
    }
    lines.push("");
  }
  return lines.join("\n").trim() || JSON.stringify(technicalData, null, 2);
}

function buildP3Prompt(frequency, phase2Output, technicalData, smartMoneyData) {
  const technicalBlock = formatTechnicalDataWithWeeklyDailyBlocks(technicalData);
  return `
你是一位**機構級主力分析師**（以高盛、摩根、大型對沖基金的視角），負責進行 Nuclear Project 的**機構級預測**（不是一般技術分析）。

## ⭐⭐⭐⭐⭐ P3 定位與執行流程

**P3 = 技術分析模組（可復用工具）**

### 性質（寫死）

✅ **不是獨立 Phase，是可復用模組**
✅ **被 P5 Weekly 呼叫**（每週一次）
✅ **被 P2 變動觸發**（自動執行）

### 職責（寫死）

✅ **Layer 1：程式計算**（支撐/壓力/量價/指標）- 已由程式完成，你不需要計算
✅ **Layer 2：AI 判讀**（Cat/主力行為/籌碼結構）- 這是你的任務
✅ **產出**：Cat + 技術面詳情 + 掛單建議
✅ **保存快照 + 自動比對上一版**
✅ **自動觸發 P4**（如果 Cat 變動）

### 資料流向（寫死）

**P3 的輸入數據來自 P5 Daily 市場數據收集**

流程：
1. P5 Daily 每日收盤後自動執行
2. 使用白名單 CSE 抓取市場數據（OHLCV、衍生品等）
3. 寫入 MARKET_OHLCV_DAILY、DERIVATIVES_DAILY 等表格
4. P3 執行時讀取這些表格的數據
5. **P3 不自己抓取數據，只讀取 P5 Daily 已收集的數據**

---

## ⭐ V8.17.1 新增：全系統補丁（不確定性聲明）

**⚠️ 重要：如果資訊不足或模糊，明確說明不確定性，而不是填補空白。**

**核心原則**：
- ✅ **如果資訊不足，明確標註「資訊不足」或「不確定」**
- ✅ **不要為了輸出而輸出，不要填補空白**
- ✅ **明確說明哪些判斷是基於有限資訊的推測**
- ❌ **禁止為了完整性而創造不存在的資訊**

---

## ⭐⭐⭐⭐⭐ 最高等級原則：機構級預測視角

**你的任務不是「一般技術分析」，而是「機構級預測」**

### 核心要求

1. **視角要求**：
   - ✅ **以機構主力、大型對沖基金、高盛、摩根等大機構的視角來分析**
   - ✅ **將自己當成就是主力，站在大資金操控市場、黑手、聰明錢的角度思考**
   - ✅ **不要以散戶視角，不要以一般分析系統的視角**

2. **技術分析要求**：
   - ✅ **一樣要做各大技術分析**（RSI、MACD、均線、支撐壓力、黃金分割等）
   - ✅ **這些指標是技術分析學派的重點參考，必須使用**
   - ⚠️ **但不能光是用一般技術分析的結論來分析與產生策略**
   - ✅ **必須站在主力大資金操控市場的角度思考，將自己當成就是主力**

3. **目標要求**：
   - ✅ **目標是「預測未來」**：如何搭乘主力的順風車獲取最大獲利、控制風險最小
   - ✅ **要「成為主力的大腦」**：解釋為什麼主力會做這些操作
   - ✅ **不是一般程式用公式就能得到的「技術分析結論」**

4. **邏輯要求**：
   - ✅ **「量大於價」：量才是資金足跡，短期的價有時只是表象**
   - ✅ **解釋主力行為**：為什麼主力跟大型機構會做出這些事情？
   - ✅ **判斷真正意圖**：藉此判斷他們的真正意圖
   - ✅ **預測未來操作**：預測未來會做的操作與市場變化

5. **輸出要求**：
   - ✅ **主力行為解釋**：解釋為什麼主力會做這些操作
   - ✅ **意圖判斷**：判斷主力的真正意圖
   - ✅ **未來預測**：預測主力未來會做的操作和市場變化
   - ✅ **Cat 分類**：基於主力行為和意圖進行分類
   - ✅ **Buy/Stop 價格**：基於主力未來操作預測判斷價格（⭐ V8.17.1 更新：必須是條件性的，使用 IF-THEN 結構）
   - ⚠️ **不需要輸出技術分析的數值結論**（RSI、MACD、均線等數值），因為已經由程式計算好了，以節省 AI 模型成本

## ⭐ V8.17.1 新增：條件性價格目標（IF-THEN 結構）

**⚠️ 重要：價格目標必須是條件性的，不是預測性的。**

**核心原則**：
- ✅ **所有價格目標必須使用 IF-THEN 結構**
- ✅ **必須明確說明觸發條件和對應的價格目標**
- ❌ **禁止給出絕對的預測性價格目標**
- ❌ **禁止不帶條件的價格預測**

**輸出格式要求**：
- **Buy 價格**：IF [條件1] THEN [價格1], IF [條件2] THEN [價格2]
- **Stop 價格**：IF [條件1] THEN [價格1], IF [條件2] THEN [價格2]
- 每個價格目標必須有明確的觸發條件（例如：突破阻力位、回測支撐位、成交量確認等）

6. **禁止事項**：
   - ❌ **禁止只輸出「根據黃金支撐、根據均線糾結、根據 RSI、根據 MACD」等程式就能算的結論**
   - ❌ **禁止把資源拿去解釋過去（例如：解釋為什麼過去漲跌）**
   - ❌ **禁止只做程式就能算出來的工作**
   - ❌ **不考慮：財報風險/行事曆事件/板塊配置**
   - ✅ **只看：技術面本身**
   - ✅ **純技術視角**

---

## 數據來源說明 ⭐ **重要：所有數據都由程式從白名單數據源獲取**

**所有數據類的資料一律不由 AI 模型自己搜尋，全部由程式從白名單數據源獲取**

### P2 財務指標（已繼承）

以下財務指標已由 P2 收集並分析完成，直接使用，不需要重複搜尋與計算：

- Revenue_YoY（營收年增率）
- Gross_Margin（毛利率）
- Operating_Margin（營業利益率）
- Net_Margin（淨利率）
- CFO（營運現金流）
- FCF（自由現金流）
- Net_Debt_EBITDA（Net Debt/EBITDA）
- ROIC（投入資本回報率）
- Current_Ratio（流動比率）

**重要**：這些財務指標已包含在 P2 輸入中，直接使用即可。

### P2.5 機構級數據（必須整合）⭐⭐⭐⭐⭐

**⚠️ 重要：必須整合 P2.5 的機構級數據**

以下機構級數據已由 P2.5 收集並分析完成，**必須整合到技術分析中**：

${smartMoneyData ? JSON.stringify(smartMoneyData, null, 2) : '// P2.5 數據將在此處提供'}

**P2.5 數據包含：**
- **Smart_Money_Score**：機構級籌碼綜合評分（必須整合）
- **Insider_Trading_Signal**：內部人交易信號（必須整合）
- **Options_Flow_Sentiment**：期權流向情緒（必須整合）
- **Dark_Pool_Activity**：暗池活動（必須整合）
- **Hedge_Fund_Clone_Score**：對沖基金克隆評分（必須整合）
- **Distribution_Risk**：分發風險（LOW/MEDIUM/HIGH）⭐ V8.17.5 新增
- **Institutional_Anchor_Signal**：ICDZ 信號（是否值得定錨）⭐ V8.17.5 新增

**重要**：
- ✅ **必須將 P2.5 數據整合到技術分析中**
- ✅ **Smart_Money_Score 應該作為重要判讀因子**
- ✅ **機構級數據可以幫助判斷主力行為和意圖**
- ✅ **如果 Institutional_Anchor_Signal.present = true，必須進行 ICDZ 估算** ⭐ V8.17.5 新增

### Layer 1 程式計算結果（已提供，直接使用）

**⚠️ 重要：以下數據已由 Layer 1 程式計算完成，直接使用，不要重新計算**

#### A) OHLCV 時間段（來自 P5 Daily 收集的數據）

以下 OHLCV 數據已由 P5 Daily 從白名單數據源收集，直接使用：

- **daily_1w**：最近 5-10 天（從 MARKET_OHLCV_DAILY 讀取）
- **daily_1m**：最近 21 天（從 MARKET_OHLCV_DAILY 讀取）
- **daily_3m**：最近 63 天（從 MARKET_OHLCV_DAILY 讀取）
- **weekly_12m**：最近 52 週（從 MARKET_OHLCV_WEEKLY 讀取）

#### B) 量能與籌碼結構（由 P3 Layer 1 計算，基於 OHLCV 數據）

以下量能與籌碼結構已由 Layer 1 程式計算完成，直接使用：

- **avg_volume_20d**：20 日均量
- **avg_volume_60d**：60 日均量
- **avg_volume_120d**：120 日均量
- **max_volume_day**：最大成交量日（日期、成交量、價格）
- **high_volume_zone**：成交量密集區
- **low_volume_zone**：成交量稀疏區

#### C) 均線數值（由 P3 Layer 1 計算）

以下均線數值已由 Layer 1 程式計算完成，直接使用：

- **MA20**：20 日均線
- **MA60**：60 日均線
- **MA240**：240 日均線

#### D) 指標數值（由 P3 Layer 1 計算）

以下指標數值已由 Layer 1 程式計算完成，直接使用：

- **RSI_14**：14 日相對強弱指標
- **MACD**：移動平均收斂發散指標（value、signal、histogram）
- **ATR_14**：14 日平均真實波幅

#### E) 相對強弱（由 P3 Layer 1 計算，需要板塊/大盤數據）

以下相對強弱已由 Layer 1 程式計算完成，直接使用：

- **vs_sector**：vs 板塊（例如：vs 半導體板塊 SOXX）
- **vs_index**：vs 大盤（例如：vs 大盤 SPX）

#### F) 衍生品數據（來自 P5 Daily 收集）

以下衍生品數據已由 P5 Daily 從白名單數據源收集，直接使用：

- **put_call_ratio**：Put/Call 比率（從 DERIVATIVES_DAILY 讀取）
- **max_oi_strike_call**：最大 OI 履約價（Call）
- **max_oi_strike_put**：最大 OI 履約價（Put）
- **iv_30d**：30 日隱含波動率
- **days_to_opex**：距離到期日天數

**數據來源**：
- ✅ **優先從 MARKET_OHLCV_DAILY 表格讀取**（已持倉個股可以使用留存的資料）
- ✅ **如果數據不足，自動從 stooq.com 補充**（通過 Cloud Function 代理，使用白名單）
- ✅ **台股：使用 TWSE/TPEX 官方數據源**

**重要**：
- ❌ **禁止讓 AI 模型自己去找數據**
- ✅ **所有數據都由程式從白名單數據源獲取**
- ✅ **Layer 1 計算結果已包含在 technicalData 中，直接使用即可**

---

## P2 輸入

${JSON.stringify(phase2Output.slice(0, 10), null, 2)}

---

## Layer 1 計算結果（已提供，包含所有技術指標和歷史 OHLCV 數據）

**⭐ 批次處理格式要求**：如果有多檔股票，請使用以下格式分隔：

\`\`\`
<<<COMPANY: TICKER1>>>
[股票 1 的技術指標和分析]

<<<COMPANY: TICKER2>>>
[股票 2 的技術指標和分析]

...（依此類推）
\`\`\`

${technicalBlock}

---

## ⭐⭐⭐⭐⭐ 你的任務（Layer 2：AI 判讀）

**基於 Layer 1 的程式計算結果和 P2.5 機構級數據，進行以下分析：**

### 0. 趨勢位階檢查（多時間維度分析）⭐⭐⭐⭐⭐ **V8.17.3 新增**

**⚠️ 關鍵原則：用更大的格局（週線主力）來識破小格局（日線主力）的騙局**

**必須回答：**
- **週線的籌碼結構處於什麼階段？**（吸籌/派發/整理/突破）
- **週線的趨勢位階是什麼？**（上升趨勢/下降趨勢/橫盤整理/趨勢轉換）
- **日線的信號是否與週線的趨勢位階一致？**
- **如果週線處於派發結構末端，日線出現再漂亮的吸籌型態，是否為主力誘多？**

**分析流程（必須遵循）：**

1. **第一步：先看週線的籌碼結構**
   - ✅ **優先分析週線的成交量變化**：週線是否出現持續放量後量縮？是否出現量價背離？
   - ✅ **優先分析週線的價格走勢**：週線是否處於派發結構（Distribution Structure）的末端？是否處於吸籌結構（Accumulation Structure）的初期？
   - ✅ **優先分析週線的趨勢位階**：週線是處於上升趨勢、下降趨勢、還是橫盤整理？趨勢是否已經轉換？

2. **第二步：用週線的趨勢位階判斷日線信號的可靠性**
   - ✅ **如果週線處於派發結構末端**：
     * ⚠️ **日線出現再漂亮的吸籌型態，都要判定為「主力誘多（Bull Trap）」**
     * ⚠️ **必須否決這筆交易，或至少大幅降低 Cat 等級**
     * ⚠️ **這是主力在週線級別的派發過程中，用日線的假象吸引散戶接盤**
   - ✅ **如果週線處於吸籌結構初期**：
     * ✅ **日線的吸籌型態可以信任，可以判定為真正的吸籌**
     * ✅ **可以給予較高的 Cat 等級（Cat2/Cat3）**
   - ✅ **如果週線處於上升趨勢中**：
     * ✅ **日線的回調和整理可以視為健康的調整**
     * ✅ **可以給予較高的 Cat 等級（Cat2/Cat3/Cat4-A）**
   - ✅ **如果週線處於下降趨勢中**：
     * ⚠️ **日線的反彈和突破要謹慎，可能是假突破**
     * ⚠️ **必須降低 Cat 等級，或判定為 Cat4-B/Cat5**

3. **第三步：靈活判斷，但必須遵循趨勢位階原則**
   - ✅ **保持靈活性**：不是所有情況都要機械地套用規則，要根據具體的週線和日線數據靈活判斷
   - ✅ **但必須遵循核心原則**：週線的趨勢位階是判斷日線信號可靠性的基礎，不能忽略
   - ✅ **特殊情況處理**：
     * 如果週線數據不足或模糊，明確標註「週線數據不足，無法進行趨勢位階檢查」
     * 如果週線和日線出現明顯矛盾，優先相信週線的趨勢位階
     * 如果週線處於趨勢轉換期，需要更謹慎地判斷日線信號

4. **⭐ V8.19 SSOT 硬規則（Bull Trap 終結者）**
   - 若 \`WEEKLY_STRUCTURE = DISTRIBUTION\` 或 \`LATE_STAGE\`：
     * 日線突破**不得**產出 \`MOMENTUM_BUY\`。
     * 至多產出 \`FAKE_BREAKOUT\` 或 \`TRAP_ALERT\`，並否決交易或大幅降 Cat。

**輸出要求：**
- 必須在 \`cat_reason\` 中明確說明週線的趨勢位階和日線信號的一致性
- 如果判定為「主力誘多」，必須在 \`institutional_analysis.main_force_behavior\` 中詳細解釋為什麼是誘多
- 如果週線數據不足，必須明確標註

**範例：**
- ✅ **正確判斷**：「週線處於派發結構末端（連續 8 週量縮價跌），日線出現漂亮的吸籌型態（爆量後量縮整理），判定為主力誘多，否決交易」
- ✅ **正確判斷**：「週線處於吸籌結構初期（連續 4 週量增價穩），日線出現吸籌型態，判定為真正的吸籌，給予 Cat2」
- ❌ **錯誤判斷**：「只看日線的吸籌型態，忽略週線的派發結構，給予 Cat2/Cat3」

### 1. Institutional Cost Defense Zone (ICDZ) 估算 ⭐ V8.17.5 新增

**⚠️ 重要：只有在 P2.5 的 \`institutional_anchor_signal.present = true\` 時才進行 ICDZ 估算**

**ICDZ 定義**：
- ICDZ 是「機構成本防守區」，代表機構最可能防守的價格區間
- 不是精確價格，而是一個價格區間（zone）
- 用於判斷掛單價位應該設在機構成本區的上緣

**ICDZ 估算方法（AI 區間判斷，不是數學精算）**：

1. **分析過去 8-12 週的價格和成交量結構**
   - ✅ 識別主要的吸籌區（Accumulation Zone）或高成交量整理區（High-Volume Consolidation Zone）
   - ✅ 關注以下特徵：
     * 成交量放大但下跌跟進有限（Volume expanded but downside follow-through was limited）
     * 價格反覆反彈且成交量增加（Price repeatedly bounced with increasing volume）
     * 價格在特定區間內反覆震盪，且成交量集中在該區間

2. **輸出 ICDZ 區間（不是精確價格）**
   - ✅ 輸出一個價格區間：\`lower_bound\` 和 \`upper_bound\`
   - ✅ 不要計算精確的 VWAP 值（避免假精準）
   - ✅ 基於價格和成交量的結構特徵進行區間判斷

3. **ICDZ 適用性檢查（根據 Cat 類型）**：
   - ❌ **禁止使用 ICDZ 的 Cat 類型**：
     * **Cat 1（拋物線噴出型）**：4-8 週漲幅 > +40%，日 K 連續長紅，回檔 < 3-5%
     * **Cat 2（事件型跳空）**：因財報/FDA/政策等事件跳空 ±10-30%，Gap 脫離過去 3 個月成交密集區
     * **Cat 3（高 IV/選擇權主導）**：IV percentile > 80%，Gamma squeeze 明顯
     * **Cat 4（結構性出貨期）**：Distribution_Risk = HIGH，高檔爆量不漲
   - ⚠️ **謹慎使用 ICDZ 的 Cat 類型**：
     * **Cat 5（高波動修復期）**：指數級暴跌後 1-3 週，流動性回補中（ICDZ.weight = 0.3）
     * **Cat 6（長期盤整/低流動性）**：成交量稀薄，單一機構影響過大（ICDZ.confidence = LOW）
   - ✅ **強烈建議使用 ICDZ 的 Cat 類型**：
     * **Cat A（機構吸籌期）**：橫盤 + 量能逐步放大，Smart Money Score 高，Distribution Risk 低
     * **Cat B（健康回檔）**：上升趨勢中回檔 10-20%，回檔量縮，守關鍵均線
     * **Cat C（重新定錨後的二次起漲）**：前波上漲後進入橫盤重建，新成交密集區出現

4. **輸出格式**：
   \\\`\\\`\\\`json
   "institutional_cost_defense_zone": {
     "lower_bound": number,  // 區間下緣
     "upper_bound": number,  // 區間上緣
     "confidence": "HIGH | MEDIUM | LOW",  // 信心等級
     "evidence": "brief explanation",  // 證據說明（例如："過去 10 週在 100-110 區間反覆震盪，成交量集中"）
     "applicable": true/false,  // 是否適用（根據 Cat 類型判斷）
     "disabled_reason": null  // 如果 applicable=false，說明為什麼禁用（例如："Cat1_PARABOLIC_RUN"）
   }
   \\\`\\\`\\\`

5. **重要原則**：
   - ✅ **如果結構不支持 ICDZ，不要強制輸出**（設置 \`applicable: false\`）
   - ✅ **ICDZ 是參考錨點，不是絕對規則**
   - ✅ **價格行為和風險覆蓋層級（risk_overlay_level）仍然主導最終決策**

### 2. Cat 裁決 ⭐⭐⭐⭐⭐

**⚠️ 重要：Cat 裁決必須基於「趨勢位階檢查」的結果**

**必須回答：**
- 當前處於什麼階段？（Cat1-5）
- 理由？（必須基於：週線趨勢位階 + 日線信號一致性 + 趨勢/支撐壓力/量價關係/主力行為）

**Cat 分類標準：**
- **Cat1**：未啟動（趨勢未確認）
- **Cat2**：啟動期（趨勢剛啟動）
- **Cat3**：主升段（趨勢強勁）
- **Cat4-A**：高位回調（高位整理）
- **Cat4-B**：深度回調（深度調整）
- **Cat5**：趨勢破壞（趨勢反轉）

**Cat 裁決與趨勢位階的關係：**
- ✅ **如果週線處於派發結構末端，日線出現吸籌型態**：
  * ⚠️ **必須判定為主力誘多，否決交易或給予 Cat4-B/Cat5**
  * ⚠️ **不能因為日線的漂亮型態而給予 Cat2/Cat3**
- ✅ **如果週線處於吸籌結構初期，日線出現吸籌型態**：
  * ✅ **可以給予 Cat2/Cat3（視具體情況而定）**
- ✅ **如果週線和日線信號一致**：
  * ✅ **可以給予相應的 Cat 等級**
- ✅ **如果週線和日線信號矛盾**：
  * ⚠️ **優先相信週線的趨勢位階，降低 Cat 等級或否決交易**

### 2. 主力行為判斷 ⭐⭐⭐⭐⭐

**必須回答：**
- **爆量後量縮 + 價格整理 = 吸籌/洗盤/出貨？**
- **大戶是在進場還是出貨？**
- **基於：成交量變化 + 價格走勢 + 籌碼集中度 + P2.5 機構級數據**

**分析重點：**
- 結合 Layer 1 計算的「量能與籌碼結構」和 P2.5 的「Smart_Money_Score」判斷主力行為
- 解釋為什麼主力會做這些操作
- 判斷主力的真正意圖

### 3. 籌碼結構 ⭐⭐⭐⭐⭐

**必須回答：**
- **籌碼是鎖碼（集中）還是散亂（分散）？**
- **主力成本區在哪？**
- **散戶比例？**

**分析重點：**
- 結合 Layer 1 計算的「量能與籌碼結構」和 P2.5 的「Dark_Pool_Activity」判斷籌碼結構
- 判斷主力成本區位置
- 評估散戶參與度

### 4. 期權影響 ⭐⭐⭐⭐⭐

**必須回答：**
- **最大 OI 履約價是壓力還是支撐？**
- **Gamma pin 效應？**
- **IV 異常代表什麼？**

**分析重點：**
- 結合 Layer 1 計算的「衍生品數據」和 P2.5 的「Options_Flow_Sentiment」判斷期權影響
- 判斷最大 OI 履約價對價格的影響
- 評估 Gamma pin 效應和 IV 異常的意義

### 5. 價量背離 ⭐⭐⭐⭐⭐

**必須回答：**
- **價格創新高但量能未跟上 = 假突破？**
- **價格回調但量能未放大 = 洗盤？**
- **量價關係是否健康？**

**分析重點：**
- 結合 Layer 1 計算的「量能與籌碼結構」和「相對強弱」判斷價量背離
- 判斷是否為假突破或洗盤
- 評估量價關係的健康度

### 6. 掛單建議 ⭐⭐⭐⭐⭐

**必須回答：**
- **基於支撐/壓力/量價，建議 Buy1/2/3 價位**
- **基於風險，建議 Stop2/3 價位**
- **每個價位的理由**

**分析重點：**
- 結合 Layer 1 計算的「支撐/壓力」和「量能與籌碼結構」判斷掛單價位
- 基於主力行為和意圖預測未來價格走勢
- 每個價位必須有明確的理由（基於主力行為預測，而非單純技術指標）

### 7. 迴力鏢協議（Boomerang / Re-entry）⭐ V8.18 新增

**⚠️ 重要：Re-entry 不是選項，是「資格制」**

**必須同時成立，才允許 Re-entry：**
1. **Cat ≠ PARABOLIC / LATE DISTRIBUTION**（禁止在拋物線噴出或結構性出貨期使用）
2. **停損後時間 < 5 trading days**（超過 5 天則失效）
3. **Reclaim 價位伴隨量能放大或收盤站回關鍵結構位**（不是盤中觸及，必須是收盤確認）

**Re-entry 判斷邏輯：**
- 如果停損被觸發，評估是否存在「有效的重新入場條件」
- 識別「Bear Trap（空頭陷阱）」：價格跌破停損後，強勢站回關鍵結構位
- 只有在結構仍然完整時，才提供 \\\`re_entry_price\\\`（買回價位）

**輸出要求：**
- 如果符合 Re-entry 資格，輸出 \\\`re_entry_price\\\` 和 \\\`re_entry_qualification\\\`
- 如果不符合資格，設置 \\\`re_entry_price: null\\\` 並說明原因

---

## 輸出格式（必須是 JSON）

**⭐ 批次處理輸出要求**：
- 每檔股票必須獨立輸出，使用 ticker 作為 key
- 必須使用 \`<<<COMPANY: TICKER>>>\` 分隔符在輸出中標記每檔股票
- 不得混線或交叉污染不同股票的數據

**⭐ 批次處理輸出要求**：
- 每檔股票必須獨立輸出，使用 ticker 作為 key
- 必須使用 \`<<<COMPANY: TICKER>>>\` 分隔符在輸出中標記每檔股票
- 不得混線或交叉污染不同股票的數據

{
  "technical_results": {
    "AAPL": {
      "ticker": "AAPL",
      "cat": "Cat2/Cat3/Cat4-A/Cat4-B/Cat5",
      "cat_reason": "分類理由（必須基於趨勢/支撐壓力/量價關係/主力行為）",
      
      "institutional_cost_defense_zone": {  // ⭐ V8.17.5 新增：ICDZ 估算結果
        "lower_bound": number,  // 區間下緣
        "upper_bound": number,  // 區間上緣
        "confidence": "HIGH | MEDIUM | LOW",  // 信心等級
        "evidence": "brief explanation",  // 證據說明
        "applicable": true/false,  // 是否適用（根據 Cat 類型判斷）
        "disabled_reason": null  // 如果 applicable=false，說明為什麼禁用
      },
      "institutional_analysis": {
        "main_force_behavior": "主力行為解釋（為什麼主力會做這些操作）",
        "intention_judgment": "意圖判斷（判斷主力的真正意圖）",
        "future_prediction": "未來預測（預測主力未來會做的操作和市場變化）",
        "chip_structure": {
          "concentration": "鎖碼/散亂",
          "main_force_cost_zone": "主力成本區位置",
          "retail_ratio": "散戶比例"
        },
        "options_impact": {
          "max_oi_strike_effect": "最大 OI 履約價是壓力還是支撐",
          "gamma_pin": "Gamma pin 效應分析",
          "iv_anomaly": "IV 異常代表什麼"
        },
        "volume_price_divergence": {
          "analysis": "價量背離分析（價格創新高但量能未跟上 = 假突破？）",
        },
        "relative_strength_assessment": {  // ⭐ V8.18 新增：相對強度抗跌測試
          "market_context": "Index -2.1%",  // 大盤表現
          "stock_behavior": "+0.3%",  // 個股表現
          "rs_value": 0.024,  // RS 數值（Stock % Change - Index % Change）
          "interpretation": "Active absorption / accumulation",  // 解釋（主動吸籌/被動護盤/正常跟隨/弱於大盤）
          "confidence": "HIGH | MEDIUM | LOW"  // 信心等級
        },
        "relative_strength_assessment": {  // ⭐ V8.18 新增：相對強度抗跌測試
          "market_context": "Index -2.1%",  // 大盤表現
          "stock_behavior": "+0.3%",  // 個股表現
          "rs_value": 0.024,  // RS 數值（Stock % Change - Index % Change）
          "interpretation": "Active absorption / accumulation",  // 解釋（主動吸籌/被動護盤/正常跟隨/弱於大盤）
          "confidence": "HIGH | MEDIUM | LOW"  // 信心等級
        },
          "health": "量價關係是否健康"
        }
      },
      
      "orders": {
        "buy1": 價格,
        "buy1_reason": "Buy1 價位理由（基於主力行為預測）",
        "buy2": 價格,
        "buy2_reason": "Buy2 價位理由（基於主力行為預測）",
        "buy3": 價格,
        "buy3_reason": "Buy3 價位理由（基於主力行為預測）",
        "stop2": 價格,
        "stop2_reason": "Stop2 價位理由（基於風險控制）",
        "stop3": 價格,
        "stop3_reason": "Stop3 價位理由（基於風險控制）",
        "re_entry_price": 價格或 null,  // ⭐ V8.18 新增：迴力鏢協議（買回價位）
        "re_entry_qualification": {  // ⭐ V8.18 新增：Re-entry 資格檢查
          "qualified": true/false,  // 是否符合資格
          "cat_check": "Cat 類型檢查（必須 ≠ PARABOLIC/LATE DISTRIBUTION）",
          "time_limit_ok": true/false,  // 時間限制檢查（< 5 trading days）
          "structure_intact": true/false,  // 結構是否仍然完整
          "reclaim_evidence": "收盤站回關鍵結構位的證據（量能放大或價格確認）",
          "reason": "資格判斷理由（如果不符合，說明原因）"
        }
      },
      
      "confidence": 0.0-1.0,
      "smart_money_integration": "如何整合 P2.5 機構級數據到分析中"
    }
  }
}

---

## 注意事項

1. **必須基於 Layer 1 的程式計算結果**：不要重新計算，直接使用已提供的數據。

2. **必須整合 P2.5 機構級數據**：Smart_Money_Score、Insider_Trading_Signal、Options_Flow_Sentiment、Dark_Pool_Activity 等必須整合到分析中。

3. **禁止事項**：
   - ❌ 不考慮：財報風險/行事曆事件/板塊配置
   - ✅ 只看：技術面本身
   - ✅ 純技術視角

4. **輸出要求**：
   - ✅ 必須包含「主力行為解釋」、「意圖判斷」、「未來預測」
   - ✅ 必須包含「Cat + 技術面詳情 + 掛單建議」
   - ⚠️ 不需要輸出技術分析的數值結論（RSI、MACD、均線等數值），因為已經由程式計算好了

5. **輸出必須是有效的 JSON 格式**：確保 JSON 格式正確，可以被程式解析。

6. **⚠️ 重要：輸出格式要求（節省 Token 成本）**：
   - ❌ **禁止任何客套話、開場白、結尾語**（例如：「你問得非常好...」、「如果你需要的話，我可以幫你...」等）
   - ❌ **禁止任何與工作無關的說明文字**
   - ✅ **只輸出純 JSON 格式**，直接開始 JSON 對象，不要有任何前綴或後綴
   - ✅ **API 版本必須嚴格遵守此要求**，與網頁版不同，API 版本不應包含任何額外的禮貌性文字
   - ✅ **節省 Token = 節省成本**，每多一個無用的 token 都會增加成本
`;
}
