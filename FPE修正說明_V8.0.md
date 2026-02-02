# FPE 修正說明 V8.0

**修正日期**：2026-01-16  
**修正原因**：用戶澄清 FPE_A 和 FPE_B 都是 **Forward P/E**，不是 EPS

---

## ⚠️ 重要澄清

### 之前的誤解

- ❌ FPE_A = 公司官方財報公布的 EPS
- ❌ FPE_B = 分析師共識的 EPS
- ❌ 需要自己計算 FPE = Price / EPS

### 正確理解

- ✅ **FPE_A = 公司官方財報公布的 Forward P/E**（本益比）
- ✅ **FPE_B = 市場分析師共識的 Forward P/E**（本益比）
- ✅ **都是 Forward P/E，不是 EPS**

---

## 📋 數據來源確認

### FPE_A（公司官方財報公布的 Forward P/E）

**數據來源**：
- 美股/台股：財報狗（P2_US_TAIWAN CSE）
- 日股：buffet code（P2_JAPAN CSE）

**提取方式**：
- ⚠️ **不需要 AI 提取**（如果財報狗/buffet code 直接提供 Forward P/E）
- 可以直接從 CSE 搜尋結果中提取 Forward P/E
- 如果財報狗/buffet code 直接提供 Forward P/E，直接提取
- **不需要自己計算** FPE_A = Price / EPS

**需要確認**：
1. 財報狗是否直接提供 Forward P/E？
2. buffet code 是否直接提供 Forward P/E？
3. 這些 Forward P/E 是否為官方口徑（非分析師預估）？

---

### FPE_B（市場分析師共識的 Forward P/E）

**數據來源**：
- Yahoo Finance Analysis 頁面（爬蟲，非 CSE）

**提取方式**：
- ✅ **優先**：直接提取 Yahoo Finance 提供的 Forward P/E（如果有的話）
- ✅ **備用**：如果只提供 EPS 預估，則計算 FPE_B = Current Price / Next Year Avg. Estimate EPS

**已更新實現**：
- 新增 `parseYahooForwardPE()` 函數，優先嘗試直接提取 Forward P/E
- 如果無法直接提取，才使用備用方案（從 EPS 計算）

---

## ✅ 已修正的內容

### 1. 程式碼註解

- ✅ 更新所有函數註解，明確說明 FPE_A 和 FPE_B 都是 Forward P/E
- ✅ 更新 FPE_B 實現，優先直接提取 Forward P/E

### 2. Prompt 說明

- ✅ 更新 Prompt 中的 FPE_A 提取要求
- ✅ 明確說明 FPE_A 是 Forward P/E，不是 EPS
- ✅ 不需要自己計算，直接提取即可

### 3. 函數實現

- ✅ 新增 `parseYahooForwardPE()` 函數
- ✅ 優先嘗試直接提取 Yahoo Finance 的 Forward P/E
- ✅ 備用方案：如果沒有，才從 EPS 計算

---

## 📊 數據流更新

### FPE_A 數據流（更新後）

```
CSE 搜尋 → 財報狗/buffet code → search_results → 直接提取 Forward P/E → 輸出到 financial_metrics[ticker].fpe_a
```

**不需要**：
- ❌ 不需要提取 EPS
- ❌ 不需要自己計算 FPE_A = Price / EPS
- ❌ 不需要 AI 提取（如果財報狗/buffet code 直接提供）

### FPE_B 數據流（更新後）

```
Yahoo Finance 爬蟲 → 優先直接提取 Forward P/E → 輸出到 financial_metrics[ticker].fpe_b
                    ↓（如果沒有）
                    備用方案：提取 EPS → 獲取股價 → 計算 FPE_B = Price / EPS
```

---

## 🔍 待確認項目

### 1. 財報狗（美股/台股）

- ⚠️ 是否直接提供 Forward P/E？
- ⚠️ 這些 Forward P/E 是否為官方口徑（非分析師預估）？

### 2. buffet code（日股）

- ⚠️ 是否直接提供 Forward P/E？
- ⚠️ 這些 Forward P/E 是否為官方口徑（非分析師預估）？

### 3. Yahoo Finance

- ✅ 已確認直接提供 Forward P/E（在 Statistics 或 Key Stats 區塊）
- ✅ 已更新實現，優先直接提取

---

## 📝 測試建議

### 測試 FPE_A

1. 執行 `testFPE_A_DataSource_Full()` 驗證財報狗/buffet code 是否提供 Forward P/E
2. 確認這些 Forward P/E 是官方口徑（非分析師預估）

### 測試 FPE_B

1. 執行 `testFPE_B_Quick()` 驗證 Yahoo Finance 是否直接提供 Forward P/E
2. 確認優先提取 Forward P/E 是否成功
3. 如果失敗，確認備用方案（從 EPS 計算）是否正常

---

**下一步**：執行測試，確認財報狗/buffet code 是否直接提供 Forward P/E，並確認是官方口徑。
