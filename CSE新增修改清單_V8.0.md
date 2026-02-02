# CSE 新增/修改清單 V8.0

**修正日期**：2026-01-16  
**修正原因**：統一數據源設計、避免格式衝突、按市場分開衍生品 CSE

---

## ✅ 已確認正確的 CSE（無需修改）

1. **GOOGLE_CSE_CX_P2_US_TAIWAN** = `76c5f7209c42f4378`
   - 用途：P2 美股和台股財務數據（財報狗網站）
   - 狀態：✅ 已設定，正確

2. **GOOGLE_CSE_CX_P2_JAPAN** = `97d9e077813214cd3`
   - 用途：P2 日股財務數據（buffet code 網站）
   - 狀態：✅ 已設定，正確

3. **GOOGLE_CSE_CX_TAIWAN_STOCK** = `16ad013adacdb43f7`
   - 用途：台股股價資料數據（不用於 P2 財務數據）
   - 狀態：⚠️ 已在 SETUP_CSE_KEYS.js 中設定，但需要在 Google CSE 後台確認設定

---

## ⚠️ 需要修改的 CSE（後台設定）

### 1. GOOGLE_CSE_CX_P5_OHLCV

**當前配置**：包含 `stooq.com`、`nasdaq.com`、`nyse.com`

**需要修改**：
- ✅ **後台設定**：在 Google CSE 後台，將此 CSE 限制為**只搜尋 `stooq.com`**
- ❌ **移除**：`nasdaq.com` 和 `nyse.com`（避免格式衝突）

**重要說明**：
- ⚠️ **stooq.com 只適用於美股和日股 OHLCV**
- ⚠️ **台股 OHLCV 必須使用 `TAIWAN_STOCK` CSE**（stooq.com 無法抓取台股）
- 固定準確的官方數據（每天 OHLCV）應該用來自同一個網站的資料，以免格式衝突問題
- 目前實際使用的是 `stooq.com` 的 CSV 格式（美股和日股）
- `nasdaq.com` 和 `nyse.com` 格式不同（HTML/API），會造成格式衝突

**步驟**：
1. 前往 [Google Custom Search Engine 控制台](https://cse.google.com/cse/all)
2. 找到 CX ID 為 `868b3223efd4e4b95` 的 CSE（P5_OHLCV）
3. 編輯設定，在「要搜尋的網站」中：
   - ✅ **保留**：`stooq.com`（僅用於美股和日股）
   - ❌ **移除**：`nasdaq.com`、`nyse.com`

---

## 🆕 需要新增的 CSE（共 3 個）

### 2. GOOGLE_CSE_CX_P5_DERIVATIVES_US（新增）

**用途**：美股衍生品數據（OI 分布、IV、Greeks）

**網站**：`theocc.com`（Options Clearing Corporation 官方，全美選擇權 OI 唯一權威）

**設定步驟**：
1. 前往 [Google Custom Search Engine 控制台](https://cse.google.com/cse/all)
2. 創建新的 CSE，命名為「P5 Derivatives US（美股衍生品）」
3. 在「要搜尋的網站」中，**只添加**：`theocc.com`
4. 取得 CX ID，更新到 PropertiesService：`GOOGLE_CSE_CX_P5_DERIVATIVES_US`

**重要說明**：
- ⚠️ **stooq.com 不提供衍生品數據**（OI、IV、Greeks）
- 必須使用交易所官方來源（theocc.com），不能用 stooq.com
- 固定準確的官方數據（OI 分布、IV、Greeks）應該用來自同一個網站的資料，以免格式衝突問題
- 美股衍生品統一使用 theocc.com，避免與其他交易所格式混用

---

### 3. GOOGLE_CSE_CX_P5_DERIVATIVES_TAIWAN（新增）

**用途**：台股衍生品數據（OI 分布、IV、Greeks）

**網站**：`taifex.com.tw`（台灣期交所官方）

**設定步驟**：
1. 前往 [Google Custom Search Engine 控制台](https://cse.google.com/cse/all)
2. 創建新的 CSE，命名為「P5 Derivatives Taiwan（台股衍生品）」
3. 在「要搜尋的網站」中，**只添加**：`taifex.com.tw`
4. 取得 CX ID，更新到 PropertiesService：`GOOGLE_CSE_CX_P5_DERIVATIVES_TAIWAN`

**重要說明**：
- ⚠️ **stooq.com 不提供衍生品數據**（OI、IV、Greeks）
- 必須使用交易所官方來源（taifex.com.tw），不能用 stooq.com
- 固定準確的官方數據應該用來自同一個網站的資料，以免格式衝突問題
- 台股衍生品統一使用 taifex.com.tw，避免與其他市場格式混用

---

### 4. GOOGLE_CSE_CX_P5_DERIVATIVES_JAPAN（新增）

**用途**：日股衍生品數據（OI 分布、IV、Greeks）

**網站**：`jpx.co.jp`（JPX 大阪交易所官方）

**設定步驟**：
1. 前往 [Google Custom Search Engine 控制台](https://cse.google.com/cse/all)
2. 創建新的 CSE，命名為「P5 Derivatives Japan（日股衍生品）」
3. 在「要搜尋的網站」中，**只添加**：`jpx.co.jp`
4. 取得 CX ID，更新到 PropertiesService：`GOOGLE_CSE_CX_P5_DERIVATIVES_JAPAN`

**重要說明**：
- ⚠️ **stooq.com 不提供衍生品數據**（OI、IV、Greeks）
- 必須使用交易所官方來源（jpx.co.jp），不能用 stooq.com
- 固定準確的官方數據應該用來自同一個網站的資料，以免格式衝突問題
- 日股衍生品統一使用 jpx.co.jp，避免與其他市場格式混用

---

## 📋 完整的 CSE 清單（修正後）

### P2 財務數據 CSE
1. ✅ `GOOGLE_CSE_CX_P2_US_TAIWAN` = `76c5f7209c42f4378`（財報狗）
2. ✅ `GOOGLE_CSE_CX_P2_JAPAN` = `97d9e077813214cd3`（buffet code）

### P5 OHLCV CSE
3. ⚠️ `GOOGLE_CSE_CX_P5_OHLCV` = `868b3223efd4e4b95`（**需要修改後台：只保留 stooq.com，僅用於美股和日股**）
   - ⚠️ **台股 OHLCV 必須使用 `TAIWAN_STOCK` CSE**（stooq.com 無法抓取台股）

### P5 衍生品 CSE（新增）
4. 🆕 `GOOGLE_CSE_CX_P5_DERIVATIVES_US` = `[待設定]`（theocc.com）
5. 🆕 `GOOGLE_CSE_CX_P5_DERIVATIVES_TAIWAN` = `[待設定]`（taifex.com.tw）
6. 🆕 `GOOGLE_CSE_CX_P5_DERIVATIVES_JAPAN` = `[待設定]`（jpx.co.jp）

### 其他 CSE
7. ✅ `GOOGLE_CSE_CX_TAIWAN_STOCK` = `16ad013adacdb43f7`（台股股價資料，需確認後台設定）
8. ✅ `GOOGLE_CSE_CX_INSTITUTIONAL` = `d61207f09faad4d1e`（P2.5 機構籌碼數據）
9. ✅ `GOOGLE_CSE_CX_P5_SECTOR_ETF` = `2613d6712a9cb4edf`（ETF 數據，多方資料蒐集，合理）
10. ✅ `GOOGLE_CSE_CX_P5_NEWS` = `f1527dbe4d36e4dec`（新聞，多方資料蒐集，合理）
11. ✅ `GOOGLE_CSE_CX_P5_WORLD` = `519d1500d22b24e31`（宏觀數據）
12. ✅ `GOOGLE_CSE_CX_SUPPLY_CHAIN` = `017411de436be4588`（供應鏈）
13. ✅ `GOOGLE_CSE_CX_EARNINGS` = `f797bd6158b6e4d23`（財報日曆）
14. ✅ `GOOGLE_CSE_CX_HUMAN_SIGNAL` = `632b5b00ca7a74ccf`（人類信號）

---

## 📝 總結

### 需要您操作的項目

#### 1. 修改現有 CSE（1 個）
- **GOOGLE_CSE_CX_P5_OHLCV**：後台設定只保留 `stooq.com`，移除 `nasdaq.com` 和 `nyse.com`
  - ⚠️ **注意**：stooq.com 只適用於美股和日股 OHLCV，台股必須用 `TAIWAN_STOCK` CSE

#### 2. 新增 CSE（3 個）
- **GOOGLE_CSE_CX_P5_DERIVATIVES_US**：只搜尋 `theocc.com`
  - ⚠️ **注意**：stooq.com 不提供衍生品數據（OI、IV、Greeks），必須用交易所官方來源
- **GOOGLE_CSE_CX_P5_DERIVATIVES_TAIWAN**：只搜尋 `taifex.com.tw`
  - ⚠️ **注意**：stooq.com 不提供衍生品數據，必須用交易所官方來源
- **GOOGLE_CSE_CX_P5_DERIVATIVES_JAPAN**：只搜尋 `jpx.co.jp`
  - ⚠️ **注意**：stooq.com 不提供衍生品數據，必須用交易所官方來源

#### 3. 確認設定（1 個）
- **GOOGLE_CSE_CX_TAIWAN_STOCK**：確認後台已設定為對應的台股股價資料網站
  - ⚠️ **重要**：台股 OHLCV 必須使用此 CSE，不能用 stooq.com

---

## ⚠️ 重要結論

### 關於 stooq.com 的使用範圍

1. **OHLCV 數據**：
   - ✅ **美股和日股**：可以使用 stooq.com（P5_OHLCV CSE）
   - ❌ **台股**：**不能**使用 stooq.com，必須使用 `TAIWAN_STOCK` CSE

2. **衍生品數據**（OI、IV、Greeks）：
   - ❌ **所有市場**：**不能**使用 stooq.com（stooq.com 不提供衍生品數據）
   - ✅ **必須使用交易所官方來源**：
     - 美股：`theocc.com`（P5_DERIVATIVES_US CSE）
     - 台股：`taifex.com.tw`（P5_DERIVATIVES_TAIWAN CSE）
     - 日股：`jpx.co.jp`（P5_DERIVATIVES_JAPAN CSE）

---

**完成上述設定後，請提供新的 CX IDs，我會更新到 SETUP_CSE_KEYS.js 中。**
