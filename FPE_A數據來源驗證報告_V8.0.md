# FPE_A 數據來源驗證報告 V8.0

**驗證日期**：2026-01-16  
**目的**：確認財報狗和 buffet code 是否提供官方財報公布的 **Forward P/E**，並確認是官方口徑而非分析師預估

---

## 📋 驗證需求

根據用戶說明：
- **財報狗**裡面有按照官方財報公布算好的 **Forward P/E**（不是 EPS）
- 需要確認：
  1. **日股的 buffet code 裡面有沒有**官方財報公布的 **Forward P/E**
  2. **確定這些 Forward P/E 都是官方口徑公布的絕對數字**，而非 FPE_B（分析師預估）

**⚠️ 重要澄清**：
- FPE_A = 公司官方財報公布的 **Forward P/E**（本益比），不是 EPS
- FPE_B = 市場分析師共識的 **Forward P/E**（本益比），不是 EPS

---

## 🔍 驗證方法

### 1. 財報狗（美股/台股）

**測試方式**：
- 使用 P2_US_TAIWAN CSE 搜尋財報狗網站
- 搜尋關鍵字：`{ticker} 財務報表 Forward P/E 本益比 預估本益比`
- 檢查搜尋結果中是否包含：
  - ✅ **官方財報公布的 Forward P/E**（官方、財報、已公布、實際 + Forward P/E、本益比）
  - ❌ **分析師預估 Forward P/E**（分析師、預估、預測 + Forward P/E、本益比）

**測試案例**：
- 美股：AAPL（蘋果）
- 台股：2330（台積電）

---

### 2. buffet code（日股）

**測試方式**：
- 使用 P2_JAPAN CSE 搜尋 buffet code 網站
- 搜尋關鍵字：`{ticker} 決算 Forward PER 予想PER 株価収益率`
- 檢查搜尋結果中是否包含：
  - ✅ **官方財報公布的 Forward P/E**（公式、決算、実績、実際 + PER、株価収益率）
  - ❌ **分析師預估 Forward P/E**（アナリスト、予想、予測 + PER、株価収益率）

**測試案例**：
- 日股：7203（豐田）、6758（索尼）

---

## 🧪 測試腳本

已建立測試腳本：`src/TEST_FPE_A_DATA_SOURCE.js`

### 可用測試函數

1. **`testStatementDog_EPS(ticker, market)`** - 測試財報狗
   - 測試指定公司的財報狗搜尋結果
   - 例如：`testStatementDog_EPS("AAPL", "US")`

2. **`testBuffetCode_EPS(ticker)`** - 測試 buffet code
   - 測試指定公司的 buffet code 搜尋結果
   - 例如：`testBuffetCode_EPS("7203")`

3. **`testFPE_A_DataSource_Full()`** - 完整測試
   - 測試多個公司，涵蓋不同市場
   - 自動統計結果

---

## 📊 檢查項目

### 需要確認的項目

1. ✅ **官方財報公布的 Forward P/E**（FPE_A）
   - 關鍵字：官方、財報、已公布、實際、決算、実績 + Forward P/E、本益比、PER
   - 這些應該是**官方公布的 Forward P/E**，不是分析師預估

2. ❌ **分析師預估 Forward P/E**（這些是 FPE_B，不是 FPE_A）
   - 關鍵字：分析師、預估、預測、予想、アナリスト + Forward P/E、本益比、PER
   - 這些是**分析師預估的 Forward P/E**，不是官方公布的

3. ⚠️ **區分 FPE_A 和 FPE_B**
   - FPE_A：官方財報公布的 Forward P/E（確切數據）
   - FPE_B：分析師預估的 Forward P/E（不準確數據，市場氣氛）

---

## 📋 預期結果

### 如果確認有官方 EPS

**FPE_A 的計算方式**：
- FPE_A = 當前股價 / 官方財報公布的 Forward EPS
- 或 FPE_A = 官方財報公布的 Forward P/E（如果財報狗/buffet code 直接提供）

**提取方式調整**：
- ⚠️ **不需要 AI 提取**，可以直接從搜尋結果中提取
- 需要實作解析邏輯，從財報狗/buffet code 的搜尋結果中提取官方 EPS
- 類似於 FPE_B 的解析方式，但數據來源是 CSE 搜尋結果

---

## ⚠️ 注意事項

### 1. 區分官方 Forward P/E 和分析師預估 Forward P/E

**官方 Forward P/E（FPE_A）**：
- 來自公司官方財報
- 是官方公布的 Forward P/E（基於官方預測的 EPS）
- 確切數據，非預估

**分析師預估 Forward P/E（FPE_B）**：
- 來自市場分析師的預估
- 是分析師預估的 Forward P/E（基於分析師預估的 EPS）
- 不準確數據，偏向市場氣氛

### 2. Forward P/E vs Trailing P/E

- **Trailing P/E**：基於過去 12 個月的實際 EPS（已公布）
- **Forward P/E**：基於未來 12 個月的預估 EPS
  - 如果是**官方預測的 EPS** → FPE_A（官方 Forward P/E）
  - 如果是**分析師預估的 EPS** → FPE_B（分析師 Forward P/E）

---

## 🔄 後續步驟

### 如果確認有官方 EPS

1. ✅ 調整 FPE_A 提取方式
   - 不需要 AI 提取
   - 實作解析邏輯，直接從 CSE 搜尋結果中提取
   - 類似於 FPE_B 的解析方式

2. ✅ 更新 Prompt
   - 移除 FPE_A 的 AI 提取要求
   - 說明 FPE_A 已由程式自動提取

3. ✅ 驗證數據準確性
   - 確認提取的 EPS 是官方口徑
   - 確認不是分析師預估

---

**下一步**：執行 `testFPE_A_DataSource_Full()` 開始驗證。
