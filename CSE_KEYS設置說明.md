# CSE Keys 設置說明

## 📋 概述

本文檔說明如何將所有 Google CSE (Custom Search Engine) 的 CX ID 和 API Key 設置到系統中。

## 🔑 已配置的 CSE Keys

根據您提供的圖片，以下 CSE Keys 已準備好：

### API Key
- **GOOGLE_CSE_API_KEY**: `AlzaSyDrs_Z1eqvLkfgHOgdAZQP-7A3gjsc6`

### CSE CX IDs

1. **GOOGLE_CSE_ALL**: `e1233d78fb9a54e77` (通用搜尋)
2. **GOOGLE_CSE_CX_P5_OHLCV**: `868b3223efd4e4b95` (OHLCV 數據)
3. **GOOGLE_CSE_CX_P5_SECTOR_ETF**: `2613d6712a9cb4edf` (板塊 ETF)
4. **GOOGLE_CSE_CX_P5_DERIVATIVES**: `b213b70051fbb4671` (衍生品)
5. **GOOGLE_CSE_CX_P5_NEWS**: `f1527dbe4d36e4dec` (新聞)
6. **GOOGLE_CSE_CX_P5_WORLD**: `519d1500d22b24e31` (宏觀數據)
7. **GOOGLE_CSE_CX_P2_US_TAIWAN**: `76c5f7209c42f4378` (⭐⭐⭐ V8.0 SSOT 定案：P2 美股和台股財務數據 - 財報狗網站)
8. **GOOGLE_CSE_CX_P2_JAPAN**: `97d9e077813214cd3` (⭐⭐⭐ V8.0 SSOT 定案：P2 日股財務數據 - buffet code 網站)
9. **GOOGLE_CSE_CX_TAIWAN_STOCK**: `16ad013adacdb43f7` (⚠️ 台股股價資料數據 - 不用於 P2 財務數據)
10. **GOOGLE_CSE_CX_INSTITUTIONAL**: `d61207f09faad4d1e` (機構數據 - P2.5 機構籌碼數據用)
11. **GOOGLE_CSE_CX_SUPPLY_CHAIN**: `017411de436be4588` (供應鏈)
12. **GOOGLE_CSE_CX_EARNINGS**: `f797bd6158b6e4d23` (財報日曆)
13. **GOOGLE_CSE_CX_HUMAN_SIGNAL**: `632b5b00ca7a74ccf` (人類信號)

---

## 🚀 設置步驟

### 方法 1：使用設置腳本（推薦）

1. **打開 Google Apps Script 編輯器**
   - 在 Google Sheets 中，點擊「擴充功能」→「Apps Script」
   - 或直接訪問 [script.google.com](https://script.google.com)

2. **添加設置腳本**
   - 在編輯器中，點擊「檔案」→「新增」→「指令碼」
   - 將檔案命名為 `SETUP_CSE_KEYS`
   - 複製 `src/SETUP_CSE_KEYS.js` 的內容到新檔案

3. **執行設置函數**
   - 在編輯器中選擇 `setupAllCSEKeys` 函數
   - 點擊「執行」按鈕（▶️）
   - 首次執行時，系統會要求授權，請點擊「授權」

4. **驗證設置**
   - 執行 `verifyCSEKeys()` 函數
   - 檢查日誌，確認所有 keys 都已正確設置

### 方法 2：手動設置（備選）

如果設置腳本無法執行，可以手動設置：

1. **打開 PropertiesService**
   - 在 Apps Script 編輯器中，執行以下代碼：
   ```javascript
   function manualSetup() {
     const properties = PropertiesService.getScriptProperties();
     
     // 設置 API Key
     properties.setProperty("GOOGLE_CSE_API_KEY", "AlzaSyDrs_Z1eqvLkfgHOgdAZQP-7A3gjsc6");
     
     // 設置所有 CSE CX IDs
     properties.setProperty("GOOGLE_CSE_CX_P5_OHLCV", "868b3223efd4e4b95");
     properties.setProperty("GOOGLE_CSE_CX_P5_SECTOR_ETF", "2613d6712a9cb4edf");
     properties.setProperty("GOOGLE_CSE_CX_P5_DERIVATIVES", "b213b70051fbb4671");
     properties.setProperty("GOOGLE_CSE_CX_P5_NEWS", "f1527dbe4d36e4dec");
     properties.setProperty("GOOGLE_CSE_CX_P5_WORLD", "519d1500d22b24e31");
     // ⭐⭐⭐ V8.0 SSOT 定案：P2 統一數據源設計
     properties.setProperty("GOOGLE_CSE_CX_P2_US_TAIWAN", "76c5f7209c42f4378");  // 財報狗網站
     properties.setProperty("GOOGLE_CSE_CX_P2_JAPAN", "97d9e077813214cd3");      // buffet code 網站
     // ⚠️ 注意：台股股價資料（不是財務數據）
     properties.setProperty("GOOGLE_CSE_CX_TAIWAN_STOCK", "16ad013adacdb43f7");  // 台股股價資料
     properties.setProperty("GOOGLE_CSE_CX_INSTITUTIONAL", "d61207f09faad4d1e");
     properties.setProperty("GOOGLE_CSE_CX_SUPPLY_CHAIN", "017411de436be4588");
     properties.setProperty("GOOGLE_CSE_CX_EARNINGS", "f797bd6158b6e4d23");
     properties.setProperty("GOOGLE_CSE_CX_HUMAN_SIGNAL", "632b5b00ca7a74ccf");
     
     Logger.log("所有 CSE Keys 已設置完成");
   }
   ```

2. **執行函數**
   - 選擇 `manualSetup` 函數
   - 點擊「執行」按鈕

---

## ✅ 驗證設置

執行以下函數驗證所有 keys 是否已正確設置：

```javascript
verifyCSEKeys()
```

預期輸出：
```
✅ GOOGLE_CSE_API_KEY = AlzaSyDrs...
✅ GOOGLE_CSE_CX_P5_OHLCV = 868b3223...
✅ GOOGLE_CSE_CX_P5_SECTOR_ETF = 2613d671...
...（所有 keys）
```

如果看到所有 keys 都有 ✅ 標記，表示設置成功。

---

## 🔍 檢查已設置的 Keys

執行以下函數查看所有已設置的 keys（值會被部分隱藏以保護隱私）：

```javascript
getAllCSEKeys()
```

---

## ⚠️ 重要：P2 統一數據源設計（V8.0 SSOT 定案）

### ⭐⭐⭐ P2 統一數據源設計

**設計目的**：防止財報計算方式偏移，P2 的持股清單與同業財報數據都要來自同一個權威財報網站。

**配置要求**：

1. **P2_US_TAIWAN CSE**（美股和台股財務數據）
   - 網站：**財報狗網站**
   - 必須在 Google CSE 後台設定為**僅搜尋財報狗網站**
   - 用途：P2 美股和台股的目標公司與同業財務數據收集

2. **P2_JAPAN CSE**（日股財務數據）
   - 網站：**buffet code 網站**
   - 必須在 Google CSE 後台設定為**僅搜尋 buffet code 網站**
   - 用途：P2 日股的目標公司與同業財務數據收集

**設定步驟**：

1. **前往 Google Custom Search Engine 控制台**
   - 訪問 [https://cse.google.com/cse/all](https://cse.google.com/cse/all)

2. **P2_US_TAIWAN CSE**（已設定）⭐⭐⭐
   - CX ID：`76c5f7209c42f4378`
   - 網站：**財報狗網站**
   - 用途：**P2 美股和台股的目標公司與同業財務數據收集**
   - ⚠️ **已設定完成**，無需再次設定
   - ⚠️ **重要**：此 CSE 專門用於 P2 財務數據，不是股價資料

3. **P2_JAPAN CSE**（已設定）⭐⭐⭐
   - CX ID：`97d9e077813214cd3`
   - 網站：**buffet code 網站**
   - 用途：**P2 日股的目標公司與同業財務數據收集**
   - ⚠️ **已設定完成**，無需再次設定

4. **TAIWAN_STOCK CSE**（⚠️ 注意：不是財務數據，是股價資料）
   - CX ID：`16ad013adacdb43f7`
   - 用途：**台股股價資料數據**（不用於 P2 財務數據）
   - ⚠️ **重要**：此 CSE 專門用於台股股價資料，不是財務報表數據，P2 不應使用此 CSE

4. **驗證設定**
   - 執行測試搜尋，確認只返回對應網站的結果
   - 確保目標公司和同業公司都從同一數據源獲取數據

---

## ⚠️ 注意事項

1. **安全性**
   - CSE Keys 存儲在 PropertiesService 中，只有專案擁有者可以訪問
   - 不要在代碼中硬編碼 keys
   - 不要將 keys 提交到公開的版本控制系統

2. **API 限制**
   - Google Custom Search API 有每日查詢限制（通常為 100 次/天）
   - 請注意各 CSE 的 `daily_limit` 配置

3. **更新 Keys**
   - 如果需要更新單個 key，可以使用 `updateSingleCSEKey(keyName, keyValue)` 函數
   - 例如：`updateSingleCSEKey("GOOGLE_CSE_API_KEY", "新的APIKey")`

4. **CSE 後台設定**
   - 每個 CSE 都應該在 Google CSE 後台設定對應的網站限制
   - 程式碼中的 `sites` 配置僅用於結果過濾，不能替代 CSE 後台設定

---

## 📝 相關檔案

- **設置腳本**: `src/SETUP_CSE_KEYS.js`
- **配置檔案**: `src/02_M0_CONFIG.js` (GOOGLE_CSE_CONFIG)
- **核心執行**: `src/03_M0_CORE.js` (executeCSESearch)

---

## 🆘 故障排除

### 問題 1：執行時出現「需要授權」錯誤

**解決方案**：
- 點擊「授權」按鈕
- 選擇您的 Google 帳號
- 點擊「進階」→「前往 [專案名稱]（不安全）」
- 點擊「允許」

### 問題 2：設置後仍無法使用 CSE

**檢查清單**：
1. 確認所有 keys 都已設置（執行 `verifyCSEKeys()`）
2. 確認 API Key 有效（檢查 Google Cloud Console）
3. 確認 CSE CX ID 正確（檢查 Google Custom Search Engine 控制台）
4. 檢查日誌中的錯誤訊息

### 問題 3：CSE 搜尋返回空結果

**可能原因**：
1. CSE 的白名單網站配置不正確
2. 搜尋查詢格式不正確
3. API 配額已用完

**解決方案**：
- 檢查 `src/02_M0_CONFIG.js` 中的 `GOOGLE_CSE_CONFIG` 配置
- 確認白名單網站已正確添加到 CSE 中
- 檢查 Google Cloud Console 中的 API 使用量

---

**更新日期**: 2026-01-16  
**版本**: V8.0
