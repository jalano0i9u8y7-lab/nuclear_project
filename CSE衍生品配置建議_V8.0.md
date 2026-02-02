# CSE 衍生品配置建議 V8.0

**日期**：2026-01-16  
**背景**：原來的 DERIVATIVE CSE 包含多市場多網站，現已拆分成市場專用 CSE

---

## 📊 原來的 DERIVATIVE CSE 分析

### 原來的 CSE 設定（CX ID: `b213b70051fbb4671`）

**包含的網站**：
- **美股**：
  - `*.theocc.com/*` - Options Clearing Corporation（全美選擇權 OI 唯一權威）
  - `*.cboe.com/*` - CBOE（SPX、SPY、QQQ、VIX、0DTE options）
  - `*.cmegroup.com/*` - CME Group（期貨數據）
  - `*.nasdaq.com/*` - Nasdaq Options Market
- **台股**：
  - `*.taifex.com.tw/*` - 台灣期交所官方
- **日股**：
  - `*.jpx.co.jp/*` - JPX 大阪交易所官方

---

## ✅ 新設計的 CSE 配置

### 1. P5_DERIVATIVES_US（CX ID: `74a662866309c4ff3`）

**建議網站清單**：
- ✅ `theocc.com` - Options Clearing Corporation（全美選擇權 OI 唯一權威）
- ✅ `cboe.com` - CBOE（SPX、SPY、QQQ、VIX、0DTE options 等特殊指數選擇權）

**不包含的原因**：
- ❌ `cmegroup.com` - 提供期貨數據，不是選擇權，應該分開處理
- ❌ `nasdaq.com` - Nasdaq Options Market 與 theocc.com 重疊，避免格式衝突

**理由**：
1. **theocc.com** 是**全美選擇權 OI 唯一權威**，涵蓋大部分美股選擇權
2. **cboe.com** 提供 **VIX、SPX 等特殊指數的選擇權**，這些可能不在 theocc.com 中
3. 兩個網站都是官方來源，格式相對統一，可以互補

---

### 2. P5_DERIVATIVES_TAIWAN（CX ID: `072e597f05d7e4222`）

**建議網站清單**：
- ✅ `taifex.com.tw` - 台灣期交所官方（唯一權威來源）

**理由**：
- 台股衍生品只有一個官方來源，無需多源

---

### 3. P5_DERIVATIVES_JAPAN（CX ID: `06439c62c328545e9`）

**建議網站清單**：
- ✅ `jpx.co.jp` - JPX 大阪交易所官方（唯一權威來源）

**理由**：
- 日股衍生品只有一個官方來源，無需多源

---

## 🤔 關於原來的 DERIVATIVE CSE

### 建議：保留但標記為已棄用

**原因**：
1. ✅ **已拆分成市場專用 CSE**，符合「統一數據源」原則
2. ✅ **避免格式衝突**：不同市場的數據格式不同，分開處理更安全
3. ⚠️ **保留作為備用**：如果未來需要跨市場搜尋，可以暫時使用

**操作建議**：
1. 在 `SETUP_CSE_KEYS.js` 中標記為 `⚠️ V8.0 已棄用`
2. 在 `GOOGLE_CSE_CONFIG` 中**不添加**原來的 `P5_DERIVATIVES` 配置
3. 如果程式碼中還有使用，應該更新為新的市場專用 CSE

---

## 📋 最終建議

### ✅ 推薦配置

#### P5_DERIVATIVES_US
- **theocc.com** + **cboe.com**
- 理由：theocc.com 是主要來源，cboe.com 補充特殊指數選擇權

#### P5_DERIVATIVES_TAIWAN
- **taifex.com.tw**（單一來源）

#### P5_DERIVATIVES_JAPAN
- **jpx.co.jp**（單一來源）

### ❌ 不推薦的配置

1. **P5_DERIVATIVES_US 不應包含**：
   - `cmegroup.com` - 期貨數據，不是選擇權
   - `nasdaq.com` - 與 theocc.com 重疊，避免格式衝突

2. **原來的綜合型 CSE**：
   - 不應繼續使用（已拆分成市場專用）

---

## 🔧 需要您確認的事項

1. **P5_DERIVATIVES_US 是否加入 cboe.com？**
   - ✅ **建議加入**：因為 VIX、SPX 等特殊指數選擇權可能不在 theocc.com 中
   - 如果您的使用場景不需要這些特殊指數，可以只用 theocc.com

2. **原來的 DERIVATIVE CSE 是否保留？**
   - ✅ **建議保留但標記為已棄用**：作為備用，但不應在程式碼中使用

3. **是否需要單獨的期貨 CSE？**
   - 如果未來需要期貨數據（cmegroup.com），可以考慮新增 `P5_FUTURES_US` CSE
   - 目前衍生品 CSE 專注於選擇權數據

---

**請確認上述建議後，我會更新配置文件和程式碼。**
