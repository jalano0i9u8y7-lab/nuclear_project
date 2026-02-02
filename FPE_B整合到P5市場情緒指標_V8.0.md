# FPE_B 整合到 P5 市場情緒指標 V8.0

**更新日期**：2026-01-16  
**狀態**：✅ 已確認整合方案

---

## ✅ 用戶澄清

P5 的市場情緒指標已經存在，包括：
- **VIX**（恐慌指數）
- **Put/Call Ratio**（看跌/看漲比率）
- **Skew**（偏度指數）
- **AAII Sentiment**（AAII 散戶情緒）
- **CNN Greed Fear Index**（CNN 恐慌/貪婪指數）

---

## 🔍 P5 現有市場情緒指標檢查結果

### 已實現的指標 ✅

1. **VIX**：
   - ✅ 收集位置：`24_P5_DAILY_MACRO.js`（宏觀數據收集）
   - ✅ 存儲位置：`MACRO_DATA_DAILY` 表格（data_type = "indices", symbol = "VIX"）
   - ✅ 使用位置：DEFCON 系統、P5 Weekly 市場綜述

2. **Put/Call Ratio**：
   - ✅ 收集位置：`24_P5_DAILY_DERIVATIVES.js`（衍生品數據收集）
   - ✅ 存儲位置：`DERIVATIVES_DAILY` 表格、`SMART_MONEY_DAILY` 表格
   - ✅ 使用位置：P2.5 籌碼分析、P5 Weekly 市場綜述、DEFCON 系統

3. **Skew**：
   - ✅ 收集位置：`24_P5_DAILY_DERIVATIVES.js`（衍生品數據收集）
   - ✅ 存儲位置：`SMART_MONEY_DAILY` 表格
   - ✅ 使用位置：DEFCON 系統

### 待實現的指標 ⚠️

4. **AAII Sentiment**（AAII 散戶情緒）：
   - ❌ 尚未實現
   - ⚠️ 需要新增收集邏輯

5. **CNN Greed Fear Index**（CNN 恐慌/貪婪指數）：
   - ❌ 尚未實現
   - ⚠️ 需要新增收集邏輯

---

## 💡 FPE_B 整合方案

### 方案：整合到現有市場情緒指標體系

**理由**：
1. ✅ FPE_B 是市場情緒指標之一（分析師共識 Forward P/E）
2. ✅ 與 VIX、Put/Call Ratio、Skew 等指標性質相同（反映市場情緒）
3. ✅ 不需要新增獨立的模組，整合到現有體系即可

---

## 📋 實作計劃

### Step 1：確認數據存儲位置

**選項 A**：存儲到 `SMART_MONEY_DAILY` 表格（推薦）
- 優點：與其他市場情緒指標（VIX、Skew、Put/Call Ratio）統一存儲
- 缺點：表格名稱「SMART_MONEY」可能不夠準確（但已經包含市場情緒指標）

**選項 B**：存儲到 `MACRO_DATA_DAILY` 表格
- 優點：與 VIX 統一存儲
- 缺點：FPE_B 是個股數據，不是宏觀數據

**選項 C**：新增 `MARKET_SENTIMENT_WEEKLY` 表格
- 優點：專門存儲市場情緒指標，結構清晰
- 缺點：需要新增表格，與現有體系分離

**建議**：選項 A（存儲到 `SMART_MONEY_DAILY`），因為：
- 已經包含 VIX、Skew、Put/Call Ratio 等市場情緒指標
- 雖然名稱是「SMART_MONEY」，但實際上已經擴展為「市場情緒指標」表格
- 不需要新增表格，保持體系統一

---

### Step 2：更新 `SMART_MONEY_DAILY` Schema

**檔案**：`src/01_SHEETS_STRUCTURE.js`

**修改內容**：
```javascript
const SMART_MONEY_DAILY_SCHEMA = {
  sheetName: "SMART_MONEY_DAILY",
  headers: [
    "date",
    "ticker",
    "market",  // ⭐ 新增：市場（US/TW/JP）
    "options_flow",
    "vix",
    "skew",
    "put_call_ratio",
    "iv_30d",
    "unusual_options_activity",
    "fpe_b",  // ⭐ 新增：FPE_B（分析師共識 Forward P/E）
    "aaii_sentiment",  // ⭐ 新增：AAII 散戶情緒（待實現）
    "cnn_greed_fear_index",  // ⭐ 新增：CNN 恐慌/貪婪指數（待實現）
    "created_at"
  ]
};
```

---

### Step 3：實作 FPE_B 數據收集

**檔案**：`src/24_P5_WEEKLY_DATA.js`（或新建 `src/24_P5_WEEKLY_SENTIMENT.js`）

**新增函數**：
```javascript
/**
 * 收集市場情緒指標（FPE_B、AAII、CNN Greed Fear Index）
 * @param {Array<string>} tickers - 股票代碼列表
 * @returns {Object} 市場情緒指標數據
 */
function collectMarketSentimentIndicators(tickers) {
  const sentimentData = {};
  
  for (const ticker of tickers) {
    try {
      // 1. 收集 FPE_B（使用現有的 getFPE_B_FromYahooFinance 函數）
      const market = getMarketFromTicker(ticker);  // US/TW/JP
      const yahooTicker = convertToYahooTicker(ticker, market);
      const fpeB = getFPE_B_FromYahooFinance(yahooTicker);
      
      // 2. 計算變化趨勢（從歷史數據讀取）
      const fpeBChange7D = calculateFPE_B_Change(ticker, 7);
      const fpeBChange30D = calculateFPE_B_Change(ticker, 30);
      
      // 3. 判斷分析師共識趨勢
      const analystConsensusTrend = determineAnalystConsensusTrend(fpeBChange7D, fpeBChange30D);
      
      sentimentData[ticker] = {
        fpe_b: fpeB,
        fpe_b_change_7d: fpeBChange7D,
        fpe_b_change_30d: fpeBChange30D,
        analyst_consensus_trend: analystConsensusTrend,
        market_sentiment: determineMarketSentiment(fpeB, analystConsensusTrend)
      };
      
      // 4. 存儲到 SMART_MONEY_DAILY 表格
      saveMarketSentimentToSheet(ticker, market, sentimentData[ticker]);
      
    } catch (error) {
      Logger.log(`P5 Weekly：收集 ${ticker} 市場情緒指標失敗：${error.message}`);
    }
  }
  
  return sentimentData;
}
```

---

### Step 4：整合到 P5 Weekly 執行流程

**檔案**：`src/24_P5_WEEKLY.js`

**修改位置**：
- 在 `P5_Weekly_Execute()` 中，調用 `collectMarketSentimentIndicators()`
- 將數據傳遞給 `buildWorldviewPrompt()`

---

### Step 5：更新 P5 Weekly Prompt

**檔案**：`src/24_P5_WEEKLY_PROMPT.js`

**新增章節**：
```javascript
## 市場情緒指標 ⭐ V8.0 新增

**市場情緒指標數據**：
${JSON.stringify(marketSentimentData, null, 2)}

**現有指標**：
- VIX：${macroData.indices?.VIX?.value || 'N/A'}
- Put/Call Ratio：${derivativesData.avg_put_call_ratio || 'N/A'}
- Skew：${derivativesData.skew || 'N/A'}

**新增指標**：
- FPE_B（分析師共識 Forward P/E）：反映市場對個股的普遍看法
- AAII Sentiment（待實現）：散戶情緒
- CNN Greed Fear Index（待實現）：恐慌/貪婪指數

**重要**：
- FPE_B 反映市場對該公司的普遍看法（樂觀/中性/悲觀）
- FPE_B 變化趨勢（7 天、30 天）反映市場情緒變化
- 分析師共識趨勢（INCREASING/DECREASING/STABLE）應整合到市場 Regime 判斷中
- FPE_B 與 FPE_A 的背離可能反映市場情緒與公司官方預期的差異
- 所有市場情緒指標（VIX、Put/Call Ratio、Skew、FPE_B）應綜合判斷市場 Regime
```

---

### Step 6：從 P2 移除 FPE_B 收集邏輯

**檔案**：`src/21_P2_FUNDAMENTAL_ANALYSIS.js`

**修改內容**：
- 移除 `collectFPE_B_ForCompany()` 的調用
- 保留函數定義（供 P5 Weekly 使用）或移到共用模組（`src/24_P5_WEEKLY_SENTIMENT.js`）
- 更新 Prompt，說明 FPE_B 由 P5 Weekly 收集

---

## 📊 市場情緒指標完整列表

### 已實現 ✅
1. **VIX**（恐慌指數）
2. **Put/Call Ratio**（看跌/看漲比率）
3. **Skew**（偏度指數）

### 待實現 ⚠️
4. **FPE_B**（分析師共識 Forward P/E）⭐ 本次實作
5. **AAII Sentiment**（AAII 散戶情緒）⭐ 待後續實作
6. **CNN Greed Fear Index**（CNN 恐慌/貪婪指數）⭐ 待後續實作

---

## ✅ 總結

### 整合方案
- ✅ **FPE_B 整合到現有市場情緒指標體系**
- ✅ **存儲到 `SMART_MONEY_DAILY` 表格**（與 VIX、Skew、Put/Call Ratio 統一存儲）
- ✅ **在 P5 Weekly 中收集**（週度更新）
- ✅ **整合到 P5 Weekly 市場綜述分析**

### 實作優先級
**高優先級**：
- 更新 `SMART_MONEY_DAILY` Schema，新增 `fpe_b` 欄位
- 實作 `collectMarketSentimentIndicators()` 函數（FPE_B 部分）
- 整合到 P5 Weekly 執行流程

**中優先級**：
- 更新 P5 Weekly Prompt，包含 FPE_B 分析
- 從 P2 移除 FPE_B 收集邏輯

**低優先級**：
- 實作 AAII Sentiment 收集
- 實作 CNN Greed Fear Index 收集

---

**下一步**：開始實作 FPE_B 整合到 P5 市場情緒指標體系。
