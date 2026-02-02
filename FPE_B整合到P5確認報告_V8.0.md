# FPE_B 整合到 P5 確認報告 V8.0

**確認日期**：2026-01-16  
**更新日期**：2026-01-16（用戶澄清：P5 已有市場情緒指標）  
**狀態**：✅ 已確認整合方案（整合到現有市場情緒指標體系）

---

## ✅ 用戶定案

### FPE_A（已定案）
- ✅ **屬於 P2 範圍**
- ✅ **由 AI 從白名單搜尋到的公司財報或指引中，提取官方公布的預估 EPS 去計算**
- ✅ **更新頻率**：每月/季更新一次

### FPE_B（已定案）
- ✅ **更新頻率**：週度（日度太頻繁沒意義，月度太慢無法及時反應市場情緒）
- ✅ **屬於 P5 範疇**（因為是週度執行）

---

## 🔍 P5 市場情緒指標監控檢查結果

### 用戶澄清

P5 的市場情緒指標已經存在，包括：
- **VIX**（恐慌指數）✅ 已實現
- **Put/Call Ratio**（看跌/看漲比率）✅ 已實現
- **Skew**（偏度指數）✅ 已實現
- **AAII Sentiment**（AAII 散戶情緒）⚠️ 待實現
- **CNN Greed Fear Index**（CNN 恐慌/貪婪指數）⚠️ 待實現

### 檢查結果

1. **已實現的市場情緒指標**：
   - ✅ **VIX**：在 `24_P5_DAILY_MACRO.js` 中收集，存儲到 `MACRO_DATA_DAILY`
   - ✅ **Put/Call Ratio**：在 `24_P5_DAILY_DERIVATIVES.js` 中收集，存儲到 `DERIVATIVES_DAILY` 和 `SMART_MONEY_DAILY`
   - ✅ **Skew**：在 `24_P5_DAILY_DERIVATIVES.js` 中收集，存儲到 `SMART_MONEY_DAILY`

2. **待實現的市場情緒指標**：
   - ⚠️ **AAII Sentiment**：尚未實現
   - ⚠️ **CNN Greed Fear Index**：尚未實現

### 結論

**P5 已有市場情緒指標體系**，FPE_B 應該整合到現有體系中，而不是新增獨立的模組。

---

## 💡 整合方案

### 方案 A：新增「市場情緒指標監控」功能（推薦）

**理由**：
1. ✅ FPE_B 是重要的市場情緒指標
2. ✅ 未來可能還有其他市場情緒指標需要監控
3. ✅ 專門的功能模組更清晰、易於維護

**實作方式**：
1. **新增表格**：`MARKET_SENTIMENT_WEEKLY`
   ```javascript
   {
     "date": "2026-01-16",
     "ticker": "AAPL",
     "market": "US",
     "fpe_b": 28.5,
     "fpe_b_change_7d": 0.5,
     "fpe_b_change_30d": -1.2,
     "analyst_consensus_trend": "INCREASING",
     "market_sentiment": "BULLISH/NEUTRAL/BEARISH",
     "created_at": "2026-01-16T10:00:00Z"
   }
   ```

2. **新增函數**：在 P5 Weekly 中新增 `collectMarketSentimentIndicators()`
   - 收集 FPE_B 數據（使用現有的 `getFPE_B_FromYahooFinance()` 函數）
   - 計算 FPE_B 變化趨勢（7 天、30 天）
   - 判斷分析師共識趨勢（INCREASING/DECREASING/STABLE）

3. **整合到 P5 Weekly 分析**：
   - 在 `buildWorldviewPrompt()` 中新增「市場情緒指標」章節
   - 將 FPE_B 數據納入市場綜述分析
   - 影響 `market_regime` 和 `u_macro_recommendation` 的判斷

---

### 方案 B：整合到現有功能

**選項 B1**：整合到「籌碼面週報」
- 優點：不需要新增功能
- 缺點：FPE_B 是估值數據，不是籌碼數據，性質不同

**選項 B2**：整合到「市場綜述」
- 優點：符合市場綜述的定位
- 缺點：可能不夠突出，未來擴展性較差

**建議**：不推薦方案 B，因為 FPE_B 是專門的市場情緒指標，應該有獨立的功能模組。

---

## 📋 實作計劃

### Step 1：新增表格 Schema

**檔案**：`src/01_SHEETS_STRUCTURE.js`

**新增 Schema**：
```javascript
const MARKET_SENTIMENT_WEEKLY_SCHEMA = {
  sheetName: "MARKET_SENTIMENT_WEEKLY",
  headers: [
    "date",
    "ticker",
    "market",
    "fpe_b",
    "fpe_b_change_7d",
    "fpe_b_change_30d",
    "analyst_consensus_trend",
    "market_sentiment",
    "created_at"
  ]
};
```

---

### Step 2：新增數據收集函數

**檔案**：`src/24_P5_WEEKLY_DATA.js`（或新建 `src/24_P5_WEEKLY_SENTIMENT.js`）

**新增函數**：
```javascript
/**
 * 收集市場情緒指標（FPE_B）
 * @param {Array<string>} tickers - 股票代碼列表
 * @returns {Object} 市場情緒指標數據
 */
function collectMarketSentimentIndicators(tickers) {
  // 1. 收集 FPE_B 數據（使用現有的 getFPE_B_FromYahooFinance 函數）
  // 2. 計算變化趨勢（7 天、30 天）
  // 3. 判斷分析師共識趨勢
  // 4. 存儲到 MARKET_SENTIMENT_WEEKLY 表格
}
```

---

### Step 3：整合到 P5 Weekly 執行流程

**檔案**：`src/24_P5_WEEKLY.js`

**修改位置**：
- 在 `P5_Weekly_Execute()` 中，收集市場情緒指標數據
- 將數據傳遞給 `buildWorldviewPrompt()`

---

### Step 4：更新 P5 Weekly Prompt

**檔案**：`src/24_P5_WEEKLY_PROMPT.js`

**新增章節**：
```javascript
## 市場情緒指標 ⭐ V8.0 新增

**FPE_B（分析師共識 Forward P/E）數據**：
${JSON.stringify(marketSentimentData, null, 2)}

**重要**：
- FPE_B 反映市場對該公司的普遍看法（樂觀/中性/悲觀）
- FPE_B 變化趨勢（7 天、30 天）反映市場情緒變化
- 分析師共識趨勢（INCREASING/DECREASING/STABLE）應整合到市場 Regime 判斷中
- FPE_B 與 FPE_A 的背離可能反映市場情緒與公司官方預期的差異
```

---

### Step 5：從 P2 移除 FPE_B 收集邏輯

**檔案**：`src/21_P2_FUNDAMENTAL_ANALYSIS.js`

**修改內容**：
- 移除 `collectFPE_B_ForCompany()` 的調用
- 保留函數定義（供 P5 Weekly 使用）或移到共用模組
- 更新 Prompt，說明 FPE_B 由 P5 Weekly 收集

---

## ✅ 總結

### 確認結果

1. ✅ **P5 目前沒有專門的「市場情緒指標監控」功能**
2. ✅ **建議新增「市場情緒指標監控」功能**，整合 FPE_B
3. ✅ **FPE_B 屬於 P5 範疇**，週度更新
4. ✅ **FPE_A 屬於 P2 範疇**，每月/季更新

### 實作優先級

**高優先級**：
- 新增 `MARKET_SENTIMENT_WEEKLY` 表格
- 實作 `collectMarketSentimentIndicators()` 函數
- 整合到 P5 Weekly 執行流程

**中優先級**：
- 更新 P5 Weekly Prompt，包含市場情緒指標分析
- 從 P2 移除 FPE_B 收集邏輯

---

**下一步**：開始實作「市場情緒指標監控」功能，整合 FPE_B。
