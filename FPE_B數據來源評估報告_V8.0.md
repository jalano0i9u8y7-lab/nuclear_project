# FPE_B 數據來源評估報告 V8.0

**評估日期**：2026-01-16  
**目的**：審查各家模型建議，選出最適合核彈計畫的 FPE_B 數據來源

---

## 📋 評估標準

1. ✅ **免費好抓取**：不需要付費訂閱
2. ✅ **不須登入**：可直接程式化抓取
3. ✅ **盡量完整**：覆蓋美股/台股/日股三大市場
4. ✅ **格式固定**：網頁結構穩定，便於解析
5. ✅ **多分析師共識**：來自多個分析師的共識預估，而非單一來源

---

## 🔍 各家模型建議整理

### Gemini 建議

**主要方案**：Yahoo Finance Analysis 頁面
- **優點**：
  - 跨市場覆蓋最廣（美股、台股 `.TW`、日股 `.T`）
  - 數據格式相對固定（表格結構標準）
  - 包含「Avg. Estimate」概念（多分析師共識）
  - 可直接抓取「Next Year」EPS 預估，自己計算 FPE_B
- **缺點**：
  - 需要 HTML 解析（正則表達式或 Parser）
  - 可能被限流或封鎖（非官方 API）
  - 部分小公司可能沒有分析師覆蓋
- **實作方式**：UrlFetchApp → 解析 HTML → 提取 EPS → 計算 FPE_B

**備用方案**：
- 美股：Finviz（表格乾淨，可直接抓 Forward P/E）
- 台股：鉅亨網/Goodinfo（本土券商數據）
- 日股：Minkabu/株探（日文介面，需專門解析器）

---

### Sonnet 建議

**主要方案**：多源分散策略
- **美股**：
  - yfinance 套件（Python，GAS 無法使用）
  - GuruFocus、Zacks（付費）
  - Alpha Vantage（API，有免費額度限制）
- **台股**：
  - 富聯網、鉅亨網、Goodinfo、CMoney
- **日股**：
  - 野村證券（需手動整理）
  - Minkabu、日經平均網站

**評估**：
- ❌ **不適用**：yfinance 是 Python 套件，GAS 環境無法使用
- ⚠️ **分散策略**：需要為不同市場寫不同的解析器，維護成本高
- ✅ **優點**：涵蓋了較多在地化數據源

---

### GPT 建議

**主要方案**：Yahoo Finance（跨市場覆蓋最廣）
- **優點**：
  - 跨市場 ticker 覆蓋最大
  - estimates 模組包含「共識」概念
  - 可透過 yfinance/yahooquery 套件（但 GAS 無法使用）
- **缺點**：
  - 非官方、易被限流
  - 大量抓取有合規風險

**備用方案**：
1. **StockAnalysis.com**：
   - 直接給 Forward PE（130,000+ 全球股票）
   - 優點：數據欄位方便，不需計算
   - 缺點：不保證是「多分析師共識」，可能是單一來源
2. **Financial Modeling Prep (FMP) API**：
   - 有 Estimates API，包含分析師數量
   - 優點：API 形式，工程友善
   - 缺點：免費額度有限，無法全市場抓取
3. **日股：Minkabu**：
   - 有「アナリスト予想（共識）」概念
   - 需專門解析器（日文介面）

---

## ✅ 綜合評估與最終建議

### 🏆 **最佳方案：Yahoo Finance Analysis 頁面（Gemini 推薦）**

**理由**：

1. ✅ **跨市場覆蓋最廣**：
   - 美股：`NVDA`、`AAPL`
   - 台股：`2330.TW`（台積電）
   - 日股：`7203.T`（豐田）
   - **一套程式碼通吃三個市場**

2. ✅ **多分析師共識**：
   - Yahoo Finance 整合 Morningstar、Refinitiv 等大行數據
   - 「Earnings Estimate」表格明確顯示「Avg. Estimate」（多分析師平均值）
   - 符合「多分析師共識而非單一數字」的要求

3. ✅ **格式相對固定**：
   - 網頁結構（DOM）在不同市場基本一致
   - 「Next Year」列、「Avg. Estimate」欄位位置標準
   - 便於用 UrlFetchApp + 正則表達式解析

4. ✅ **符合系統架構**：
   - GAS 環境已使用 UrlFetchApp（例如 stooq.com OHLCV）
   - 不需要 Python 套件（yfinance 無法使用）
   - 不需要付費 API（完全免費）

5. ✅ **可追溯性**：
   - 抓取「Next Year EPS 預估均值」→ 自己計算 FPE_B = Price / EPS
   - 可控制使用「今日收盤價」還是「本週均價」來計算
   - 比直接抓 Forward PE 更能控制數據來源

---

### ⚠️ **風險與應對措施**

#### 風險 1：Yahoo Finance 改版或封鎖

**應對措施**：
- **備用方案 1（美股）**：Finviz
  - 表格乾淨，可直接抓 Forward P/E
  - 作為 Yahoo Finance 失效時的備援
  
- **備用方案 2（台股）**：鉅亨網/Goodinfo
  - 本土券商數據，有時比 Yahoo Global 更準
  - 注意：中小型台股可能沒有分析師覆蓋

- **備用方案 3（日股）**：Minkabu
  - 日本權威網站，有「予想PER」欄位
  - 需專門解析器（日文介面）

#### 風險 2：部分公司沒有分析師覆蓋

**應對措施**：
- 如果無法獲取 FPE_B，標註為 `null`
- **不影響 Gate 檢查和分層決策**（FPE_A 才是唯一依據）
- FPE_B 僅作為輔助/驗證資料

#### 風險 3：解析穩定性（HTML 結構變動）

**應對措施**：
- 使用多種解析策略（正則表達式 + DOM 解析）
- 設置監控機制，檢測解析失敗率
- 定期測試和更新解析邏輯

---

### 📋 **實作方案**

#### 方案 A：Yahoo Finance Analysis Scraper（推薦）

**函數設計**：

```javascript
/**
 * 從 Yahoo Finance Analysis 頁面抓取 FPE_B（分析師共識 Forward P/E）
 * @param {string} ticker - 股票代碼（美股直接打，台股加 .TW，日股加 .T）
 * @param {number} currentPrice - 當前股價（從 P5 獲取）
 * @return {number|null} FPE_B 值，如果無法獲取則返回 null
 */
function getFPE_B_FromYahooFinance(ticker, currentPrice) {
  try {
    // 1. 構建 URL
    const url = `https://finance.yahoo.com/quote/${ticker}/analysis`;
    
    // 2. 抓取 HTML（使用 UrlFetchApp，已有使用經驗）
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true
    });
    
    if (response.getResponseCode() !== 200) {
      Logger.log(`Yahoo Finance 請求失敗：${ticker}，HTTP ${response.getResponseCode()}`);
      return null;
    }
    
    const html = response.getContentText();
    
    // 3. 解析 HTML（使用正則表達式或更穩健的解析器）
    // 目標：找到 "Earnings Estimate" 表格下的 "Next Year" 的 "Avg. Estimate"
    const consensusEPS = parseYahooAnalysisPage(html);
    
    if (!consensusEPS || consensusEPS <= 0) {
      Logger.log(`無法獲取 ${ticker} 的分析師共識 EPS`);
      return null;
    }
    
    // 4. 計算 FPE_B = Price / EPS
    const fpeB = currentPrice / consensusEPS;
    
    Logger.log(`FPE_B 計算完成：${ticker} = ${fpeB.toFixed(2)} (Price: ${currentPrice}, EPS: ${consensusEPS})`);
    
    return fpeB;
    
  } catch (error) {
    Logger.log(`獲取 FPE_B 失敗：${ticker}，錯誤：${error.message}`);
    return null;
  }
}

/**
 * 解析 Yahoo Finance Analysis 頁面，提取 Next Year 的 Avg. Estimate EPS
 * @param {string} html - HTML 內容
 * @return {number|null} EPS 預估值
 */
function parseYahooAnalysisPage(html) {
  // 實作方式：
  // 1. 使用正則表達式匹配 "Next Year" 行
  // 2. 提取該行中的 "Avg. Estimate" 值
  // 3. 解析為數字（可能需要處理千位分隔符、貨幣符號等）
  
  // 範例正則表達式（需要根據實際網頁結構調整）：
  // 尋找 "Earnings Estimate" 表格中的 "Next Year" 行
  // 提取 "Avg. Estimate" 欄位的數值
  
  // 注意：實際實作時需要處理：
  // - 千位分隔符（逗號）
  // - 貨幣符號（美元、台幣、日圓）
  // - 負數（虧損情況）
  // - 缺失數據（N/A）
  
  // TODO: 實作具體的解析邏輯
  
  return null;
}
```

**整合到 P2 模組**：

```javascript
// 在 collectPeerFinancialData 或相關函數中調用
function collectFPE_B_ForCompany(ticker, market, currentPrice) {
  // 根據市場構建 Yahoo Finance ticker
  let yahooTicker = ticker;
  if (market === "TW") {
    yahooTicker = `${ticker}.TW`;
  } else if (market === "JP") {
    yahooTicker = `${ticker}.T`;
  }
  // market === "US" 時不需要修改
  
  // 調用 Yahoo Finance scraper
  const fpeB = getFPE_B_FromYahooFinance(yahooTicker, currentPrice);
  
  return fpeB;
}
```

---

#### 方案 B：備用方案（Fallback）

**Finviz（美股備用）**：

```javascript
/**
 * 從 Finviz 抓取 Forward P/E（美股備用方案）
 * @param {string} ticker - 美股代碼
 * @return {number|null} Forward P/E 值
 */
function getFPE_B_FromFinviz(ticker) {
  // 實作方式類似，但 Finviz 表格更乾淨，可能更容易解析
  // TODO: 實作
  return null;
}
```

**鉅亨網/Goodinfo（台股備用）**：

```javascript
/**
 * 從鉅亨網/Goodinfo 抓取 FPE_B（台股備用方案）
 * @param {string} ticker - 台股代碼（四位數）
 * @return {number|null} FPE_B 值
 */
function getFPE_B_FromTaiwanSources(ticker) {
  // 實作方式類似，但需要針對台灣網站結構調整
  // TODO: 實作
  return null;
}
```

**Minkabu（日股備用）**：

```javascript
/**
 * 從 Minkabu 抓取予想 PER（日股備用方案）
 * @param {string} ticker - 日股代碼（四位數）
 * @return {number|null} 予想 PER 值
 */
function getFPE_B_FromMinkabu(ticker) {
  // 實作方式類似，但需要處理日文介面
  // TODO: 實作
  return null;
}
```

---

## 📊 各方案對比表

| 方案 | 免費 | 登入 | 跨市場 | 格式固定 | 多分析師共識 | 維護成本 | 推薦度 |
|------|------|------|--------|----------|--------------|----------|--------|
| **Yahoo Finance** | ✅ | ✅ | ✅ | ⚠️ | ✅ | 低 | ⭐⭐⭐⭐⭐ |
| Finviz（美股） | ✅ | ✅ | ❌ | ✅ | ⚠️ | 低 | ⭐⭐⭐⭐ |
| 鉅亨網（台股） | ✅ | ✅ | ❌ | ⚠️ | ✅ | 中 | ⭐⭐⭐ |
| Minkabu（日股） | ✅ | ✅ | ❌ | ⚠️ | ✅ | 高 | ⭐⭐⭐ |
| StockAnalysis | ✅ | ✅ | ✅ | ⚠️ | ❌ | 低 | ⭐⭐⭐ |
| FMP API | ⚠️ | ✅ | ✅ | ✅ | ✅ | 低 | ⭐⭐ |
| yfinance | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ⭐ |

**說明**：
- ⭐⭐⭐⭐⭐：強烈推薦（主要方案）
- ⭐⭐⭐⭐：推薦（備用方案）
- ⭐⭐⭐：可考慮（特定市場）
- ⭐⭐：不推薦（有明顯缺點）
- ⭐：完全不適用（技術限制）

---

## ✅ 最終建議

### 主要方案：Yahoo Finance Analysis 頁面

**理由總結**：
1. ✅ **唯一符合所有評估標準的方案**（免費、不須登入、跨市場、格式相對固定、多分析師共識）
2. ✅ **符合系統架構**（GAS 環境已使用 UrlFetchApp）
3. ✅ **維護成本低**（一套程式碼通吃三個市場）
4. ✅ **數據可追溯**（抓取 EPS 自己計算，可控性高）

### 備用方案（按優先順序）

1. **Finviz**（美股）：表格乾淨，解析簡單
2. **鉅亨網/Goodinfo**（台股）：本土數據，有時更準
3. **Minkabu**（日股）：日本權威網站，但需日文解析器

### 實作步驟建議

1. **Phase 1**：實作 Yahoo Finance Analysis Scraper（主要方案）
   - 實作 `getFPE_B_FromYahooFinance()` 函數
   - 實作 `parseYahooAnalysisPage()` 解析器
   - 測試美股/台股/日股各市場的解析成功率

2. **Phase 2**：整合到 P2 模組
   - 在 `collectPeerFinancialData()` 或相關函數中調用
   - 處理缺失數據情況（標註為 `null`）

3. **Phase 3**：實作備用方案（視需要）
   - 如果 Yahoo Finance 解析成功率低，再實作備用方案
   - 優先實作 Finviz（美股最常用）

---

**下一步**：請確認是否採用 Yahoo Finance 作為主要方案，我將開始實作解析邏輯。
