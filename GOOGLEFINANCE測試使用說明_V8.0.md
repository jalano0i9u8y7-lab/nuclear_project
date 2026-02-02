# GOOGLEFINANCE 數據源測試使用說明

> **版本**：V8.0  
> **日期**：2025-01-17  
> **目的**：測試 Gemini 建議的所有 GOOGLEFINANCE 代碼，驗證數據源可用性

---

## 🚀 快速開始

### 一鍵測試

1. 打開 Google Sheets
2. 點擊選單：**🚀 Nuclear Project** → **🧪 測試 GOOGLEFINANCE 數據源**
3. 確認開始測試
4. 等待測試完成（約 2-3 分鐘）
5. 查看測試結果

---

## 📊 測試項目

### 1. 宏觀數據（16 項）

#### 商品 ETF（5 項）
- ✅ WTI 原油：`NYSEARCA:USO`
- ✅ Brent 原油：`NYSEARCA:BNO`
- ✅ 黃金：`NYSEARCA:GLD`
- ✅ 白銀：`NYSEARCA:SLV`
- ✅ 銅：`NYSEARCA:CPER`

#### 匯率（6 項）
- ✅ 美元指數：`NYSEARCA:UUP`
- ✅ 歐元/美元：`CURRENCY:EURUSD`
- ✅ 英鎊/美元：`CURRENCY:GBPUSD`
- ✅ 美元/日圓：`CURRENCY:USDJPY`
- ✅ 美元/瑞郎：`CURRENCY:USDCHF`
- ✅ 美元/人民幣：`CURRENCY:USDCNY`

#### 國債利率（4 項）
- ✅ 10年美債：`INDEXCBOE:TNX`（需除以 10）
- ✅ 5年美債：`INDEXCBOE:FVX`（需除以 10）
- ✅ 30年美債：`INDEXCBOE:TYX`（需除以 10）
- ✅ 3個月美債：`INDEXCBOE:IRX`（需除以 10）

#### 市場指數（1 項）
- ✅ VIX：`INDEXCBOE:VIX`

---

### 2. 板塊 ETF（11 項）

- ✅ XLK (科技)：`NYSEARCA:XLK`
- ✅ XLF (金融)：`NYSEARCA:XLF`
- ✅ XLE (能源)：`NYSEARCA:XLE`
- ✅ XLV (醫療)：`NYSEARCA:XLV`
- ✅ XLI (工業)：`NYSEARCA:XLI`
- ✅ XLP (必需消費)：`NYSEARCA:XLP`
- ✅ XLY (非必需消費)：`NYSEARCA:XLY`
- ✅ XLU (公用事業)：`NYSEARCA:XLU`
- ✅ XLB (原物料)：`NYSEARCA:XLB`
- ✅ XLRE (房地產)：`NYSEARCA:XLRE`
- ✅ XLC (通訊服務)：`NYSEARCA:XLC`

---

### 3. 個股 OHLCV（4 項 + 歷史數據）

#### 當前價格測試
- ✅ NVDA (美股)：`NASDAQ:NVDA`
- ✅ TSM (美股)：`NYSE:TSM`
- ✅ 2330 (台股)：`TPE:2330`
- ✅ 8035 (日股)：`TYO:8035`

#### 歷史數據測試（僅測試美股）
- ⚠️ 測試 30 天歷史數據獲取能力

---

## 📋 測試結果

### 結果保存位置

測試結果會自動保存到 **`GOOGLEFINANCE_TEST_RESULTS`** 表格，包含：

| 欄位 | 說明 |
|------|------|
| **測試時間** | 測試執行時間 |
| **類別** | 數據類別（商品ETF、匯率、國債、指數、板塊ETF、個股、歷史數據） |
| **名稱** | 數據項目名稱 |
| **代碼** | GOOGLEFINANCE 代碼 |
| **屬性** | 測試的屬性（price、volume、changepct 等） |
| **成功** | ✅ 或 ❌ |
| **數值** | 獲取到的數值 |
| **錯誤** | 錯誤訊息（如果失敗） |

---

## ✅ 通過標準

### 完整通過標準

1. **宏觀數據**：16/16 項成功（100%）
2. **板塊 ETF**：11/11 項成功（100%）
3. **個股 OHLCV**：8/8 項成功（100%，包含 price 和 volume）
4. **歷史數據**：至少 1/1 項成功（美股歷史數據可用）

### 最低通過標準

- **總成功率 ≥ 95%**：可以切換到 GOOGLEFINANCE
- **總成功率 < 95%**：需要檢查失敗項目，確認原因後再決定

---

## 🔧 測試函數說明

### 主要函數

#### `testAllGoogleFinance()`
完整測試所有 GOOGLEFINANCE 數據源

**使用方式**：
```javascript
const results = testAllGoogleFinance();
```

**返回結果**：
```javascript
{
  macro: {
    commodities: [...],
    currencies: [...],
    bonds: [...],
    indices: [...],
    summary: { total, success, failed }
  },
  sectorETFs: {
    etfs: [...],
    summary: { total, success, failed }
  },
  stocks: {
    stocks: [...],
    history: [...],
    summary: { total, success, failed, historyTotal, historySuccess, historyFailed }
  },
  summary: {
    total: 總數,
    success: 成功數,
    failed: 失敗數,
    duration: 耗時（毫秒）
  }
}
```

#### `testAllMacroData()`
僅測試宏觀數據（商品、匯率、國債、VIX）

#### `testAllSectorETFs()`
僅測試板塊 ETF

#### `testAllStockOHLCV()`
僅測試個股 OHLCV（當前價格和歷史數據）

---

## ⚠️ 注意事項

### 1. 測試時間

- **完整測試**：約 2-3 分鐘
- **單項測試**：約 30-60 秒

### 2. 測試間隔

每個測試項目之間有 500ms 延遲，避免請求過快導致 Google 限制。

### 3. 臨時表格

測試會創建以下臨時表格（自動隱藏）：
- `TEMP_GOOGLEFINANCE_TEST`：用於當前價格測試
- `TEMP_GOOGLEFINANCE_HISTORY`：用於歷史數據測試

這些表格會在測試過程中自動創建，不會影響正常使用。

### 4. 歷史數據限制

- 目前僅測試美股的歷史數據
- 台股和日股的歷史數據可能不支援，需要額外測試

---

## 🎯 測試後續行動

### 如果測試全部通過（100%）

1. ✅ **更新宏觀數據代碼**
   - 修改 `24_P5_DAILY_MACRO.js`
   - 商品期貨改用 ETF 代碼
   - 美元指數改用 UUP ETF
   - 移除對 CSE 和 stooq.com 的依賴

2. ✅ **更新板塊 ETF 代碼**
   - 修改 `24_P5_DAILY_ETF.js`
   - 改用 GOOGLEFINANCE

3. ✅ **更新個股 OHLCV 代碼**
   - 修改 `24_P5_DAILY_OHLCV_CORE.js`
   - 主要使用 GOOGLEFINANCE
   - Stooq 改為備用（僅用於歷史數據，如果 GOOGLEFINANCE 歷史數據不可用）

4. ✅ **刪除舊數據源代碼**
   - 移除宏觀數據的 CSE 搜尋代碼
   - 移除板塊 ETF 的 stooq.com 代碼
   - **保留** OHLCV 的 stooq.com 代碼（作為備用）

### 如果測試部分失敗

1. ⚠️ **檢查失敗項目**
   - 查看 `GOOGLEFINANCE_TEST_RESULTS` 表格
   - 確認錯誤訊息

2. ⚠️ **分析失敗原因**
   - 代碼格式錯誤？
   - 數據不可用？
   - 網絡問題？

3. ⚠️ **決定處理方式**
   - 如果只是少數項目失敗，可以保留 fallback 機制
   - 如果關鍵項目失敗，需要重新評估

---

## 📝 測試日誌

測試過程中的所有日誌都會記錄在 Google Apps Script 的執行記錄中，可以通過以下方式查看：

1. 打開 Google Apps Script 編輯器
2. 點擊「執行」→「查看執行記錄」
3. 查看最新的測試執行記錄

---

## 🔄 版本歷史

- **V8.0** (2025-01-17)：初始版本，支援完整測試功能

---

**使用問題**：如有問題，請查看日誌或聯繫開發者。
