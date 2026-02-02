# P3 歷史 OHLCV 數據獲取與白名單原則檢查 V8.0

## 📋 檢查問題

1. **P3 執行時所需的個股不同時間的 OHLCV 是否有寫好去網站下載（例如 stooq）？**
2. **是否遵循「不要讓 AI 模型自己去找數據」的大原則？**
3. **重複跑已持倉個股時是否可以使用自己留存的資料？**

---

## ✅ 檢查結果

### 1. P5 Daily 已實現歷史 OHLCV 數據收集與保存

**✅ 已實現的功能**：

1. **`getHistoricalOHLCV(ticker, days, fetchFromStooq = true)`**（`src/24_P5_DAILY.js` 第 1961 行）：
   - ✅ **優先從 `MARKET_OHLCV_DAILY` 表格讀取已保存的數據**
   - ✅ **如果數據不足，自動從 stooq.com 補充**（通過 Cloud Function 代理）
   - ✅ **合併數據（去重，保留表格中的最新數據）**
   - ✅ **返回最近 N 天的歷史數據（從舊到新）**

2. **`saveOHLCVToSheet(ohlcvData, date)`**（`src/24_P5_DAILY.js` 第 1803 行）：
   - ✅ **P5 Daily 收集 OHLCV 數據後保存到 `MARKET_OHLCV_DAILY` 表格**
   - ✅ **每天保存一次，累積歷史數據**

**數據流程**：
```
P5 Daily 執行
  ↓
收集 OHLCV 數據（從 stooq.com 或 TWSE/TPEX）
  ↓
保存到 MARKET_OHLCV_DAILY 表格（累積歷史數據）
  ↓
計算技術指標時使用 getHistoricalOHLCV（優先讀取表格，不足才從 stooq.com 補充）
```

---

### 2. P3 目前沒有讀取歷史 OHLCV 數據 ⚠️

**當前實現**（`src/22_P3_DATA_COLLECTOR.js`）：

1. **`collectTechnicalDataFromExternalSources`**：
   - ✅ 讀取技術指標（從 `MARKET_INDICATORS_DAILY` 表格）
   - ❌ **沒有讀取歷史 OHLCV 數據**

2. **`getTechnicalIndicatorsFromSheet`**：
   - ✅ 只讀取技術指標（RSI、MACD、ATR、MA 等）
   - ❌ **沒有讀取歷史 OHLCV 數據**

**問題**：
- ⚠️ **P3 需要歷史 OHLCV 數據進行技術分析**（例如：判斷支撐壓力、趨勢線、成交量變化等）
- ⚠️ **目前 P3 只讀取了技術指標，沒有讀取歷史 OHLCV 數據**

**解決方案**：
- ✅ **P5 Daily 已經實現了 `getHistoricalOHLCV` 函數**
- ✅ **P3 應該調用 `getHistoricalOHLCV` 函數來獲取歷史 OHLCV 數據**
- ✅ **優先從 `MARKET_OHLCV_DAILY` 表格讀取（已持倉個股可以使用留存的資料）**
- ✅ **如果數據不足，自動從 stooq.com 補充（通過 Cloud Function 代理，使用白名單）**

---

### 3. 白名單原則檢查 ⭐ **大原則**

**原則**：所有系統數據都要由白名單去拿，不能讓 AI 自己去找，以免偏差

#### ✅ 已遵循白名單原則的部分

1. **P5 Daily OHLCV 數據收集**：
   - ✅ 使用 stooq.com（通過 Cloud Function 代理）
   - ✅ 使用 TWSE/TPEX（台股官方數據源）
   - ✅ 使用白名單數據源，不是讓 AI 自己找

2. **P2 財務數據收集**：
   - ✅ 使用 `executeCSESearch` 搜尋財務數據
   - ✅ 使用白名單 CSE：
     - `P2_TAIWAN`：TWSE、TPEX、公開資訊觀測站
     - `INSTITUTIONAL_DATA`：SEC EDGAR
     - `P2_JAPAN`：JPX、TDnet、EDINET、kabutan.jp
   - ✅ **程式控制搜尋，不是讓 AI 自己找**

3. **P5 Daily 新聞收集**：
   - ✅ 使用 `executeCSESearch` 搜尋新聞
   - ✅ 使用白名單 CSE：`P5_NEWS`
   - ✅ **程式控制搜尋，不是讓 AI 自己找**

#### ⚠️ 需要確認的部分

1. **P2 財務指標提取**：
   - ⚠️ 使用 CSE 搜尋後，由 AI 從搜尋結果中提取財務指標
   - ✅ **搜尋是程式控制的（使用白名單 CSE）**
   - ✅ **AI 只是從已搜尋的結果中提取，不是讓 AI 自己去找數據源**

2. **P3 技術指標獲取**：
   - ✅ 優先從 `MARKET_INDICATORS_DAILY` 表格讀取（由 P5 Daily 收集）
   - ✅ 如果沒有，`fetchTechnicalIndicatorsFromExternalSource` 目前返回 null（不讓 AI 自己找）

3. **GEMINI_SEARCH（事實查證）**：
   - ⚠️ 使用 `CSE_SEARCH_UNRESTRICTED`（無白名單限制的 CSE 搜尋）
   - ⚠️ **這是用於自我質疑機制，需要確認是否符合白名單原則**

**結論**：
- ✅ **大部分數據收集都遵循白名單原則**
- ⚠️ **GEMINI_SEARCH 使用無白名單限制的 CSE，需要確認是否符合原則**

---

## ⚠️ 需要修正的問題

### 問題 1：P3 沒有讀取歷史 OHLCV 數據

**當前狀態**：
- ❌ P3 只讀取技術指標（RSI、MACD 等）
- ❌ P3 沒有讀取歷史 OHLCV 數據

**修正要求**：
- ✅ **P3 應該調用 `getHistoricalOHLCV` 函數來獲取歷史 OHLCV 數據**
- ✅ **優先從 `MARKET_OHLCV_DAILY` 表格讀取（已持倉個股可以使用留存的資料）**
- ✅ **如果數據不足，自動從 stooq.com 補充（通過 Cloud Function 代理，使用白名單）**
- ✅ **將歷史 OHLCV 數據傳遞給 AI 模型進行技術分析**

**實現位置**：
- `src/22_P3_DATA_COLLECTOR.js` 的 `collectTechnicalDataFromExternalSources` 函數

---

### 問題 2：P3 Prompt 沒有說明歷史 OHLCV 數據來源

**當前 Prompt**（`src/22_P3_AI_ANALYSIS.js` 第 204 行）：
```
## 外部技術指標數據（已提供）

${JSON.stringify(technicalData, null, 2)}
```

**修正要求**：
- ✅ **在 Prompt 中明確說明歷史 OHLCV 數據已由程式從白名單數據源（stooq.com、TWSE、TPEX）收集**
- ✅ **明確說明不要讓 AI 自己去找數據**

---

## ✅ 已確認正確的部分

1. **P5 Daily 歷史 OHLCV 數據收集**：
   - ✅ 已實現 `getHistoricalOHLCV` 函數
   - ✅ 優先從表格讀取，不足才從 stooq.com 補充
   - ✅ 使用白名單數據源（stooq.com、TWSE、TPEX）

2. **數據保存機制**：
   - ✅ P5 Daily 每天保存 OHLCV 數據到 `MARKET_OHLCV_DAILY` 表格
   - ✅ 重複跑已持倉個股時可以使用留存的資料

3. **白名單原則**：
   - ✅ P2 財務數據收集使用白名單 CSE
   - ✅ P5 Daily 數據收集使用白名單數據源
   - ✅ 大部分數據收集都遵循白名單原則

---

## 📋 修正行動清單

### 立即修正（Critical）

1. **P3 讀取歷史 OHLCV 數據** ⭐⭐⭐⭐⭐（最高優先級）
   - 在 `collectTechnicalDataFromExternalSources` 函數中調用 `getHistoricalOHLCV`
   - 優先從 `MARKET_OHLCV_DAILY` 表格讀取（已持倉個股可以使用留存的資料）
   - 如果數據不足，自動從 stooq.com 補充（通過 Cloud Function 代理）
   - 將歷史 OHLCV 數據傳遞給 AI 模型
   - **預計工時**：2h

2. **P3 Prompt 說明歷史 OHLCV 數據來源** ⭐⭐⭐
   - 在 Prompt 中明確說明歷史 OHLCV 數據已由程式從白名單數據源收集
   - 明確說明不要讓 AI 自己去找數據
   - **預計工時**：0.5h

### 確認事項

3. **確認 GEMINI_SEARCH 是否符合白名單原則** ⭐⭐
   - 檢查 `CSE_SEARCH_UNRESTRICTED` 的使用是否符合原則
   - **預計工時**：0.5h

---

## 🎯 總結

### ✅ 已實現

1. **P5 Daily 歷史 OHLCV 數據收集**：已實現 ✅
2. **數據保存機制**：已實現 ✅
3. **白名單原則**：大部分已遵循 ✅

### ⚠️ 需要修正

1. **P3 讀取歷史 OHLCV 數據**：需要實現 ⚠️
2. **P3 Prompt 說明數據來源**：需要補充 ⚠️

### ✅ 已確認正確

1. **重複跑已持倉個股時可以使用留存的資料**：已實現 ✅
2. **數據不足時自動從 stooq.com 補充**：已實現 ✅
3. **使用白名單數據源**：已實現 ✅

---

**文檔版本**：V1.0  
**最後更新**：2025-01-14  
**狀態**：✅ 檢查完成，發現 2 個需要修正的問題
