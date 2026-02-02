# CSE 使用檢查報告 V8.0

**檢查日期**：2026-01-16  
**檢查範圍**：整個系統程式中的 CSE 使用情況

---

## 📋 檢查原則

根據您的要求：
1. **固定準確的官方數據**（例如每天 OHLCV、OI 分布等）：盡量用來自同一個網站的資料，以免格式衝突問題
2. **需要多方資料蒐集**（單看一個網站容易造成偏差的部分）：可能需要多源搜尋比對

---

## ✅ 正確使用的 CSE

### 1. P2 財務數據收集（✅ 正確）
**檔案**：`src/21_P2_FUNDAMENTAL_ANALYSIS.js`

- ✅ `collectTaiwanStockFinancialData()`：使用 `P2_US_TAIWAN` CSE（財報狗）
- ✅ `collectUSStockFinancialData()`：使用 `P2_US_TAIWAN` CSE（財報狗）
- ✅ `collectJapanStockFinancialData()`：使用 `P2_JAPAN` CSE（buffet code）

**符合 SSOT 定案**：統一數據源設計，防止財報計算方式偏移

---

### 2. P2.5 機構籌碼數據（✅ 正確）
**檔案**：`src/24_P5_WEEKLY.js`, `src/24_P5_WEEKLY_DATA.js`, `src/24_P5_WEEKLY_SMART_MONEY.js`

- ✅ 使用 `INSTITUTIONAL_DATA` CSE
- ✅ 用途：13F 文件、Dark Pool 數據、Options Flow

**符合設計**：INSTITUTIONAL_DATA 專門用於 P2.5 機構籌碼數據

---

### 3. P5 Daily 新聞（✅ 正確）
**檔案**：`src/24_P5_DAILY_NEWS.js`

- ✅ 使用 `P5_NEWS` CSE
- ✅ 配置：包含多個新聞網站（reuters.com, ft.com, wsj.com, nikkei.com）和官方敘事源

**判斷**：✅ **合理** - 新聞需要多方資料蒐集，避免單一來源偏差，這是正確的設計

---

### 4. P5 Daily 衍生品（✅ 基本正確）
**檔案**：`src/24_P5_WEEKLY.js`, `src/24_P5_WEEKLY_DATA.js`

- ✅ 使用 `P5_DERIVATIVES` CSE
- ✅ 配置：包含多個交易所網站（cboe.com, theocc.com, nasdaq.com, taifex.com.tw, jpx.co.jp）

**判斷**：✅ **合理** - 不同市場（美股/台股/日股）需要不同交易所的數據，這是合理的

**但需要確認**：是否不同市場的衍生品數據應該分開處理，避免格式衝突？

---

### 5. P5 Weekly/Monthly/Quarterly 機構數據（✅ 正確）
**檔案**：`src/24_P5_WEEKLY.js`, `src/24_P5_MONTHLY.js`, `src/24_P5_QUARTERLY.js`

- ✅ 使用 `INSTITUTIONAL_DATA` CSE
- ✅ 用途：P5 週度/月度/季度的機構籌碼數據收集

**符合設計**：INSTITUTIONAL_DATA 用於機構籌碼數據

---

## ⚠️ 發現的問題

### 問題 1：TEST_ALL_CSE.js 使用舊的 CSE 名稱

**檔案**：`src/TEST_ALL_CSE.js`

**問題描述**：
- 第 239 行：`"P2_TAIWAN": "台積電 財報"` - 應該改為 `"P2_US_TAIWAN"`
- 第 252-253 行：註解中仍使用 `"P2_TAIWAN"`
- 第 266-267 行：`criticalCSEs` 陣列中使用 `"P2_TAIWAN"` - 應該改為 `"P2_US_TAIWAN"`
- 第 316 行：函數註解中使用 `"P2_TAIWAN"` - 應該改為 `"P2_US_TAIWAN"`

**影響**：測試腳本無法正確測試 P2 財務數據 CSE

**建議修正**：
- 將所有 `"P2_TAIWAN"` 改為 `"P2_US_TAIWAN"`

---

### 問題 2：collectPeerFinancialData 函數未實際使用 CSE

**檔案**：`src/21_P2_FUNDAMENTAL_ANALYSIS.js`（第 2149-2174 行）

**問題描述**：
- 函數 `collectPeerFinancialData()` 目前只是使用已存在的財務數據（`existingFinancialData`）
- 如果同業公司不在 `existingFinancialData` 中，只返回空結構
- 註解說明「在正式環境中，這裡應該從 CSE 搜尋同業財務數據」，但未實現

**影響**：同業財務數據可能缺失，無法完成完整的同業比較分析

**建議確認**：
- 是否需要實現實際的 CSE 搜尋功能？
- 應該使用什麼 CSE？（應該與目標公司相同：`P2_US_TAIWAN` 或 `P2_JAPAN`）

---

### 問題 3：P5_OHLCV CSE 配置包含多個網站（可能的格式衝突）

**檔案**：`src/02_M0_CONFIG.js`（第 185-201 行）

**問題描述**：
- `P5_OHLCV` CSE 配置包含 3 個網站：
  - `stooq.com`（CSV 格式）
  - `nasdaq.com`（官方交易所）
  - `nyse.com`（官方交易所）

**根據您的原則**：
> 固定準確的官方數據（例如每天 OHLCV、OI 分布等）盡量用來自同一個網站的資料，以免格式衝突問題

**問題分析**：
- **格式衝突風險**：不同網站的 OHLCV 數據格式可能不同（CSV vs HTML/API）
- **實際使用**：從代碼看，實際使用的是 `stooq.com` 的 CSV 格式（`24_P5_DAILY_OHLCV_STOOQ.js`）
- **nasdaq.com 和 nyse.com**：可能未實際使用，或僅作為驗證來源

**建議確認**：
- 是否應該將 `P5_OHLCV` CSE 限制為只搜尋 `stooq.com`？
- 或者將 `nasdaq.com` 和 `nyse.com` 保留，但僅作為驗證來源（不混用格式）？

---

### 問題 4：P5_SECTOR_ETF CSE 配置包含多個 ETF 發行人

**檔案**：`src/02_M0_CONFIG.js`（第 202-216 行）

**問題描述**：
- `P5_SECTOR_ETF` CSE 配置包含多個 ETF 發行人網站：
  - `ishares.com`（BlackRock）
  - `ssga.com`（State Street SPDR）
  - `spdrs.com`（State Street SPDR 系列）
  - `vanguard.com`（Vanguard）
  - `etfdb.com`（前端資料庫）

**根據您的原則分析**：
- **ETF NAV、Holdings、Rebalance、Tracking Error** 屬於「固定準確的官方數據」
- **但**：不同的 ETF 屬於不同的發行人，必須從對應的發行人網站獲取

**判斷**：
- ✅ **合理** - 不同 ETF 需要從不同發行人網站獲取，這是正確的設計
- ⚠️ **需要注意**：每個 ETF 應該固定使用其發行人網站，不要混用

**建議確認**：
- 是否需要確保每個 ETF 都固定使用其對應的發行人網站？
- 是否需要在程式碼中實現 ETF 到發行人網站的映射？

---

### 問題 5：P5_DERIVATIVES CSE 多個網站的使用方式

**檔案**：`src/02_M0_CONFIG.js`（第 217-236 行）

**問題描述**：
- `P5_DERIVATIVES` CSE 配置包含多個交易所：
  - 美股：`cboe.com`, `theocc.com`, `cmegroup.com`, `nasdaq.com`
  - 台股：`taifex.com.tw`
  - 日股：`jpx.co.jp`
  - 全球：`lseg.com`

**根據您的原則分析**：
- **OI 分布、IV、Greeks** 屬於「固定準確的官方數據」
- **但**：不同市場（美股/台股/日股）必須從對應的交易所獲取

**判斷**：
- ✅ **基本合理** - 不同市場需要不同交易所
- ⚠️ **需要注意**：應該確保同一市場的數據來源一致（例如：美股期權 OI 統一用 theocc.com，不要混用 cboe.com 和 theocc.com）

**建議確認**：
- 是否需要細分為：
  - `P5_DERIVATIVES_US`（美股：theocc.com 為主）
  - `P5_DERIVATIVES_TAIWAN`（台股：taifex.com.tw）
  - `P5_DERIVATIVES_JAPAN`（日股：jpx.co.jp）
- 或者保留當前設計，但確保程式碼中按市場選擇對應的數據源？

---

### 問題 6：GOOGLE_CSE_CX_TAIWAN_STOCK 未在配置中使用

**檔案**：`src/02_M0_CONFIG.js`

**問題描述**：
- `GOOGLE_CSE_CX_TAIWAN_STOCK`（CX ID: `16ad013adacdb43f7`）已設定在 `SETUP_CSE_KEYS.js` 中
- 但在 `GOOGLE_CSE_CONFIG` 中沒有對應的配置項

**影響**：
- 如果有程式碼嘗試使用 `TAIWAN_STOCK` CSE，會因為配置不存在而失敗
- 無法明確知道這個 CSE 的用途和網站限制

**建議確認**：
- 是否需要為 `TAIWAN_STOCK` CSE 添加配置項？
- 這個 CSE 的具體用途是什麼？（您提到是「台股股價資料數據」，不是財務數據）
- 是否有程式碼需要使用這個 CSE？

---

### 問題 7：P2 Prompt 中仍有舊的數據來源說明

**檔案**：`src/21_P2_FUNDAMENTAL_ANALYSIS.js`（第 1322, 1352 行）

**問題描述**：
- 在 Prompt 的範例 JSON 輸出中，仍使用 `"data_source": "INSTITUTIONAL_DATA CSE (SEC EDGAR)"`
- 應該改為 `"data_source": "P2_US_TAIWAN_CSE"` 或 `"data_source": "P2_JAPAN_CSE"`

**影響**：AI 可能參考錯誤的數據來源說明

**建議修正**：
- 更新 Prompt 範例中的 `data_source` 欄位

---

## 🔍 需要進一步確認的設計決策

### 決策點 1：P5_OHLCV 是否應該統一為單一網站？

**當前配置**：`stooq.com` + `nasdaq.com` + `nyse.com`

**建議選項**：
- **選項 A**：統一使用 `stooq.com`（目前實際使用的）
  - 優點：格式一致（CSV），避免格式衝突
  - 缺點：如果 stooq.com 數據缺失，沒有備用來源
  
- **選項 B**：保留多個網站，但明確區分用途
  - `stooq.com`：主要來源（CSV 格式）
  - `nasdaq.com` / `nyse.com`：僅用於驗證或備用（不混用格式）

**需要您的決定**：選擇哪個選項？

---

### 決策點 2：P5_DERIVATIVES 是否應該按市場分開？

**當前配置**：單一 CSE 包含所有市場的交易所

**建議選項**：
- **選項 A**：保持當前設計（單一 CSE，程式碼按市場選擇）
  - 優點：配置簡單
  - 缺點：可能誤用不同市場的數據源
  
- **選項 B**：分為三個 CSE
  - `P5_DERIVATIVES_US`（美股：theocc.com 為主）
  - `P5_DERIVATIVES_TAIWAN`（台股：taifex.com.tw）
  - `P5_DERIVATIVES_JAPAN`（日股：jpx.co.jp）
  - 優點：明確區分，避免格式衝突
  - 缺點：需要創建多個 CSE

**需要您的決定**：選擇哪個選項？

---

### 決策點 3：collectPeerFinancialData 是否需要實現 CSE 搜尋？

**當前狀態**：函數未實現實際的 CSE 搜尋，只使用已存在的數據

**建議選項**：
- **選項 A**：實現實際的 CSE 搜尋
  - 根據 `dataSource` 參數（`P2_US_TAIWAN` 或 `P2_JAPAN`）使用對應的 CSE
  - 為每個同業公司調用 `collectUSStockFinancialData()`、`collectTaiwanStockFinancialData()` 或 `collectJapanStockFinancialData()`
  
- **選項 B**：保持當前設計（僅使用已存在的數據）
  - 假設同業公司已在 `existingFinancialData` 中
  - 但這不符合實際情況（同業公司通常在第一次分析時不存在）

**需要您的決定**：是否需要實現？

---

## 📊 檢查總結

### ✅ 正確使用的 CSE
1. P2 財務數據：`P2_US_TAIWAN`、`P2_JAPAN` ✅
2. P2.5 機構籌碼：`INSTITUTIONAL_DATA` ✅
3. P5 新聞：`P5_NEWS`（多方資料蒐集）✅

### ⚠️ 需要確認/修正的問題
1. **TEST_ALL_CSE.js** 使用舊的 `P2_TAIWAN` 名稱（應改為 `P2_US_TAIWAN`）
2. **collectPeerFinancialData** 未實現實際的 CSE 搜尋
3. **P5_OHLCV** 配置包含多個網站（可能需要統一為單一網站）
4. **P5_DERIVATIVES** 配置包含多個市場（可能需要按市場分開）
5. **GOOGLE_CSE_CX_TAIWAN_STOCK** 未在配置中定義
6. **P2 Prompt** 範例中仍有舊的數據來源說明

### 🤔 需要您的決策
1. P5_OHLCV 是否應該統一為單一網站（stooq.com）？
2. P5_DERIVATIVES 是否應該按市場分開？
3. collectPeerFinancialData 是否需要實現實際的 CSE 搜尋？

---

## 📝 建議的修正優先級

### 優先級 1（必須修正）
1. **TEST_ALL_CSE.js**：更新舊的 CSE 名稱（影響測試）

### 優先級 2（建議修正）
2. **P2 Prompt 範例**：更新數據來源說明（影響 AI 理解）
3. **GOOGLE_CSE_CX_TAIWAN_STOCK**：添加配置項（如果會使用）

### 優先級 3（等待您的決策）
4. **P5_OHLCV**：是否統一為單一網站？
5. **P5_DERIVATIVES**：是否按市場分開？
6. **collectPeerFinancialData**：是否需要實現實際的 CSE 搜尋？

---

**報告完成時間**：2026-01-16  
**等待您的決策**：請確認以上問題的處理方式後，我再進行修正。
