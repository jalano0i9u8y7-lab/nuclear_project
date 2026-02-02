# FPE_B 實作總結 V8.0

**實作日期**：2026-01-16  
**狀態**：✅ 已完成基本實作

---

## ✅ 已實作功能

### 1. 核心函數

#### `collectFPE_B_ForCompany(ticker, market)`
- **功能**：根據市場構建 Yahoo Finance ticker，並調用抓取函數
- **參數**：
  - `ticker`：股票代碼（例如：AAPL, 2330, 7203）
  - `market`：市場（US/TW/JP）
- **返回**：FPE_B 值（number）或 null

#### `getFPE_B_FromYahooFinance(yahooTicker)`
- **功能**：從 Yahoo Finance Analysis 頁面抓取 FPE_B
- **⚠️ 重要說明**：
  1. **數據來源**：Yahoo Finance Analysis 頁面提供「分析師共識的預估 EPS」（Avg. Estimate）
     - 這是**多個分析師預估的平均值**（共識），不是單一分析師的預估
     - Yahoo Finance 整合了 Morningstar、Refinitiv 等大行的數據，計算出共識平均值
  2. **計算方式**：我們自己計算 FPE_B = Current Price / Next Year Avg. Estimate EPS
     - Yahoo Finance **不直接提供 FPE**，只提供 EPS 預估
     - 我們需要自己獲取當前股價，然後除以分析師共識預估 EPS
  3. **搜尋方法**：使用**爬蟲（UrlFetchApp）**，**不是 CSE**
     - 因為 FPE_B 不能用 CSE 搜尋（不符合數據定位）
     - 直接抓取 HTML 並解析
- **流程**：
  1. 構建 URL：`https://finance.yahoo.com/quote/{ticker}/analysis`
  2. 使用 `UrlFetchApp` 抓取 HTML（爬蟲方法，非 CSE）
  3. 解析 HTML，提取 Next Year 的「分析師共識預估 EPS」（Avg. Estimate = 多個分析師的平均值）
  4. 獲取當前股價（從 Yahoo Finance Summary 頁面）
  5. 計算 FPE_B = Current Price / Next Year Avg. Estimate EPS
- **返回**：FPE_B 值（number）或 null

#### `parseYahooAnalysisPage(html)`
- **功能**：解析 Yahoo Finance Analysis 頁面 HTML，提取 Next Year 的「分析師共識預估 EPS」（Avg. Estimate）
- **⚠️ 重要說明**：
  - Yahoo Finance Analysis 頁面提供「Earnings Estimate」表格
  - 表格包含多個分析師的預估，Yahoo Finance 會計算平均值（Avg. Estimate）
  - 我們提取的是「Next Year」的「Avg. Estimate」，這是**多個分析師預估的平均值（共識）**
  - **不是單一分析師的預估**，而是市場上多個分析師的共識
- **方法**：
  1. **方法 1**：正則表達式匹配 "Next Year" 行的 "Avg. Estimate" 值（多個分析師的平均值）
  2. **方法 2**：匹配 JSON 數據中的 `earningsEstimate.nextYear.avg`（分析師共識預估 EPS）
  3. **方法 3**：寬鬆匹配（尋找 "Next Year" 後面的第一個有效數值）
- **返回**：分析師共識預估 EPS（多個分析師的平均值，number）或 null

#### `getCurrentPriceFromYahoo(yahooTicker)`
- **功能**：從 Yahoo Finance Summary 頁面獲取當前股價
- **方法**：
  1. **方法 1**：匹配 JSON 數據中的 `regularMarketPrice.raw`
  2. **方法 2**：匹配 `fin-streamer` 標籤中的 `data-value`
  3. **方法 3**：寬鬆匹配常見的價格顯示格式
- **返回**：當前股價（number）或 null

---

### 2. 整合點

**位置**：`collectFinancialDataFromExternalSources()` 函數

**流程**：
1. 收集財務數據（CSE 搜尋）
2. **新增**：收集 FPE_B（Yahoo Finance 抓取）
3. 將 FPE_B 添加到財務數據對象中
4. 如果無法獲取 FPE_B，標註為 `null`，不影響其他數據收集

**錯誤處理**：
- 如果 FPE_B 收集失敗，記錄錯誤但繼續執行
- 符合 `missing_data_policy: IGNORE_CONTINUE` 原則

---

## 📋 實作細節

### Yahoo Finance Ticker 格式

| 市場 | 原始 Ticker | Yahoo Finance Ticker |
|------|------------|---------------------|
| 美股 | `AAPL` | `AAPL` |
| 台股 | `2330` | `2330.TW` |
| 日股 | `7203` | `7203.T` |

### 數據來源

- **主要來源**：Yahoo Finance Analysis 頁面
  - URL：`https://finance.yahoo.com/quote/{ticker}/analysis`
  - 數據：Next Year 的「分析師共識預估 EPS」（Avg. Estimate）
  - ⚠️ **重要**：這是**多個分析師預估的平均值**（共識），不是單一分析師的預估
  - Yahoo Finance 整合了 Morningstar、Refinitiv 等大行的數據，計算出共識平均值

- **股價來源**：Yahoo Finance Summary 頁面
  - URL：`https://finance.yahoo.com/quote/{ticker}`
  - 數據：當前股價（regularMarketPrice）

### 搜尋方法

- **⚠️ 重要**：使用**爬蟲（UrlFetchApp）**，**不是 CSE**
  - 因為 FPE_B 不能用 CSE 搜尋（不符合數據定位）
  - 直接抓取 HTML 並解析
  - 使用 `UrlFetchApp.fetch()` 直接請求網頁

### 計算公式

```
FPE_B = Current Price / Next Year Avg. Estimate EPS
```

**說明**：
- Yahoo Finance **不直接提供 FPE**，只提供「分析師共識預估 EPS」
- 我們自己獲取當前股價，然後除以分析師共識預估 EPS
- Avg. Estimate EPS = 多個分析師預估的平均值（共識）

---

## ⚠️ 注意事項

### 1. HTML 解析穩定性

**風險**：Yahoo Finance 的 HTML 結構可能會變動

**應對措施**：
- 使用多種解析方法（正則表達式、JSON 匹配、寬鬆匹配）
- 設置監控機制，檢測解析失敗率
- 定期測試和更新解析邏輯

### 2. 部分公司沒有分析師覆蓋

**處理方式**：
- 如果無法獲取 FPE_B，標註為 `null`
- **不影響 Gate 檢查和分層決策**（FPE_A 才是唯一依據）
- FPE_B 僅作為輔助/驗證資料

### 3. 請求頻率限制

**風險**：Yahoo Finance 可能會限制自動化請求

**應對措施**：
- 使用適當的 User-Agent
- 考慮添加請求間隔（如果需要）
- 如果被封鎖，可以實作備用方案（Finviz、鉅亨網等）

---

## 🔄 後續優化建議

### Phase 1：測試與驗證

1. **測試不同市場**：
   - 測試美股（例如：AAPL, MSFT）
   - 測試台股（例如：2330, 2317）
   - 測試日股（例如：7203, 6758）

2. **測試邊界情況**：
   - 沒有分析師覆蓋的公司
   - 虧損公司（負 EPS）
   - 特殊格式的股價（例如：ADR、單位股）

3. **監控解析成功率**：
   - 記錄解析失敗的案例
   - 分析失敗原因
   - 優化解析邏輯

### Phase 2：備用方案（視需要）

如果 Yahoo Finance 解析成功率低，可以實作備用方案：

1. **Finviz**（美股）：表格乾淨，解析簡單
2. **鉅亨網/Goodinfo**（台股）：本土數據，有時更準
3. **Minkabu**（日股）：日本權威網站，但需日文解析器

### Phase 3：性能優化

1. **並行請求**：如果 GAS 環境支援，可以並行請求多個公司的數據
2. **緩存機制**：FPE_B 不需要每天更新，可以緩存一段時間
3. **錯誤重試**：添加自動重試機制（最多 3 次）

---

## 📊 測試建議

### 測試函數

可以創建一個測試函數來驗證實作：

```javascript
function testFPE_B_Collection() {
  const testCases = [
    { ticker: "AAPL", market: "US", expected: "should have FPE_B" },
    { ticker: "2330", market: "TW", expected: "should have FPE_B" },
    { ticker: "7203", market: "JP", expected: "should have FPE_B" }
  ];
  
  for (const testCase of testCases) {
    Logger.log(`測試：${testCase.ticker} (${testCase.market})`);
    const fpeB = collectFPE_B_ForCompany(testCase.ticker, testCase.market);
    Logger.log(`結果：FPE_B = ${fpeB}`);
  }
}
```

---

## ✅ 完成狀態

- ✅ **核心函數實作**：已完成
- ✅ **整合到 P2 模組**：已完成
- ✅ **錯誤處理**：已完成
- ⚠️ **測試與驗證**：待進行
- ⚠️ **備用方案**：待需要時實作

---

**下一步**：建議先進行測試，確認解析邏輯是否正確，然後根據實際使用情況進行優化。
