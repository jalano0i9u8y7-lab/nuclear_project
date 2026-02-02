# AI Prompt 完整清單（V8.0 完整版）

## 📋 說明

本文檔列出所有會用到 AI 的地方，包含**完整的 prompt 內容**（不只是摘要），用於評估 prompt 的有效程度。

**重要**：測試時需要評估每個 prompt 的有效程度，AI 回應是否符合預期水準。

---

## 🔍 P0: 產業工程學分析

### 執行者 Prompt
- **檔案**：`src/09_P0_INDUSTRY_ENGINEERING.js`
- **函數**：`buildP0Prompt(userInput, context)`
- **執行者**：OPUS（Claude Opus 4.5）
- **審查者**：GPT（GPT-5.2）

### 完整 Prompt 內容

請參考 `src/09_P0_INDUSTRY_ENGINEERING.js` 的 `buildP0Prompt` 函數（第 539 行開始）。

**關鍵內容**：
- 核心任務定位：建立「必然位置表」，不是選股清單
- P0-2 分析模組（固定順序，不得跳步）
- P0-ENG 工程必然分析模組（A-E 五個步驟）
- P0-STRUCT 結構性定價權分析模組（A-E 五個步驟）
- P0-3 強制輸出（五項缺一不可）
- P0-4 否決檢查
- 輸出格式（必須是 JSON）

**完整 prompt 長度**：約 1200+ 行（包含正式模式和測試模式）

---

## 🔍 P0.7: 系統動力學分析

### 執行者 Prompt
- **檔案**：`src/19_P0_7_SYSTEM_DYNAMICS.js`
- **函數**：`buildP0_7Prompt(userInput, p0Output)`
- **執行者**：O3（OpenAI o3）
- **審查者**：OPUS（Claude Opus 4.5）⭐ 避免同家盲點

### 完整 Prompt 內容

請參考 `src/19_P0_7_SYSTEM_DYNAMICS.js` 的 `buildP0_7Prompt` 函數（第 380 行開始）。

**關鍵內容**：
- 核心任務定位：裁決時間序位置、Loop_Dominance、Leveraged_Role_Type
- P0.7-2 核心概念定義（R 迴路、B 迴路）
- P0.7-3 分析模組（固定順序，不得跳步）：
  - A) 動態性問題定義
  - B) 關鍵存量與流量辨識
  - C) CLD 因果迴路裁決
  - D) 時間序位置裁決（四分法）
  - E) 槓桿點角色類型裁決
  - F) 敘事與結構錯位檢查
- P0.7-4 強制輸出（五項缺一不可）
- 輸出格式（必須是 JSON）

**完整 prompt 長度**：約 300+ 行

---

## 🔍 P1: 公司池篩選

### 執行者 Prompt
- **檔案**：`src/20_P1_COMPANY_POOL.js`
- **函數**：`buildP1Prompt(userInput, p0Output, p0_7Output)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 完整 Prompt 內容

請參考 `src/20_P1_COMPANY_POOL.js` 的 `buildP1Prompt` 函數（第 653 行開始）。

**關鍵內容**：
- 核心任務定位：建立「公司池」，不是選股
- P1-2 三層對位檢查（操作級，逐條寫死）：
  - 第一層：工程對位檢查（ENG Fit）- 5 個問題
  - 第二層：結構對位檢查（STRUCT Fit）- 5 個問題
  - 第三層：時間角色對位檢查（Time & Role Fit）- 5 個問題
- P1-3 Moat_Type（M1-M6）定義（完整寫死）
- P1-4 Rerate_State（R0-R3）定義＋防呆（完整寫死）
- 輸出格式（必須是 JSON）

**完整 prompt 長度**：約 1000+ 行

---

## 🔍 P2: 基本面財務分析

### 執行者 Prompt
- **檔案**：`src/21_P2_FUNDAMENTAL_ANALYSIS.js`
- **函數**：`buildP2Prompt(frequency, userInput, masterCandidates, financialData, previousSnapshot)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 完整 Prompt 內容

請參考 `src/21_P2_FUNDAMENTAL_ANALYSIS.js` 的 `buildP2Prompt` 函數（第 668 行開始）。

**關鍵內容**：
- P2-0 Phase 2 定位（雙重職責）
- P2-1 明確禁止事項（寫死）
- ⭐⭐⭐⭐⭐ 核心原則：同業比較與相對位置
- P2-4 核心安全性模組（寫死）：三層結構分析
- P2-5 安全性 Gate（三級制）：PASS/WATCH/FAIL
- 分層決策標準（基於 P0.7 槓桿角色 + 財務安全性）
- 同業比較執行流程（兩階段）
- 輸出格式（必須是 JSON，符合 P2-10 Mandatory Schema）

**完整 prompt 長度**：約 1200+ 行

---

## 🔍 P2.5: 機構級籌碼面分析

### 執行者 Prompt
- **檔案**：`src/21_P2_5_PROMPT.js`
- **函數**：`buildP2_5Prompt(tickers, smartMoneyData, frequency)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 完整 Prompt 內容

請參考 `src/21_P2_5_PROMPT.js` 的 `buildP2_5Prompt` 函數（第 17 行開始）。

**關鍵內容**：
- 投資哲學：基本面是底，籌碼面是因，技術面是果
- 任務目標：機構持倉變化、內部人交易、期權活動、Dark Pool、對沖基金 Clone
- Top 10 對沖基金清單（按影響力排序）
- Clone 評分邏輯（強力信號/中等信號/弱信號）
- 輸出格式（必須是 JSON）

**完整 prompt 長度**：約 180 行

---

## 🔍 P3: 技術分析（機構級預測）

### 執行者 Prompt
- **檔案**：`src/22_P3_AI_ANALYSIS.js`
- **函數**：`buildP3Prompt(frequency, phase2Output, technicalData, smartMoneyData)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 完整 Prompt 內容

請參考 `src/22_P3_AI_ANALYSIS.js` 的 `buildP3Prompt` 函數（第 204 行開始）。

**關鍵內容**：
- ⭐⭐⭐⭐⭐ 最高等級原則：機構級預測視角
- 核心要求：視角要求、技術分析要求、目標要求、邏輯要求、輸出要求、禁止事項
- 數據來源說明：P2 財務指標、P2.5 機構級數據、技術指標數據
- Cat 分類標準
- 輸出格式（必須是 JSON）

**完整 prompt 長度**：約 500+ 行

---

## 🔍 P5 Weekly: 宏觀世界觀分析

### 執行者 Prompt
- **檔案**：`src/24_P5_WEEKLY_PROMPT.js`
- **函數**：`buildWorldviewPrompt(data)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 完整 Prompt 內容

請參考 `src/24_P5_WEEKLY_PROMPT.js` 的 `buildWorldviewPrompt` 函數（第 27 行開始）。

**關鍵內容**：
- 任務目標：整合本週所有新聞快照和市場數據、與歷史世界觀對照
- ⭐ V8.0 新增：籌碼面週報、Sector ETF Flow 分析、Mag 7 集體表現分析
- Regime 分析（BULL_STRONG/BULL_WEAK/RANGE/BEAR_WEAK/BEAR_STRONG）
- 輸出格式（必須是 JSON）

**完整 prompt 長度**：約 160 行

---

## 🔍 P5 Weekly: 個股策略生成

### 執行者 Prompt
- **檔案**：`src/24_P5_WEEKLY_STOCK_STRATEGY.js`
- **函數**：`buildStockStrategyBatchPrompt(batch, context)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 完整 Prompt 內容

請參考 `src/24_P5_WEEKLY_STOCK_STRATEGY.js` 的 `buildStockStrategyBatchPrompt` 函數（第 510 行開始）。

**關鍵內容**：
- ⭐⭐⭐ **AI 動態權重決定**（因子權重由 AI 根據當下所有資訊動態決定）
- ⭐⭐⭐ **財報日個股籌碼權重加強**（未來 14 天內有財報公布的持倉個股）
- 因子權重配置（僅供參考，AI 必須動態決定）
- Hitchhiking 監控（順風車監控）
- 輸出格式（必須是 JSON）

**完整 prompt 長度**：約 170 行

---

## 🔍 M0: 審查者 Prompt

### 審查者 Prompt（通用）
- **檔案**：`src/03_M0_CORE.js`
- **函數**：
  - `buildAuditorPromptWithQuestions(executorQuestions, previousResult)`
  - `buildAuditorPromptWithFactCheck(executorQuestions, previousResult, auditorInitialReview, geminiSearchResult)`
- **審查者**：根據任務類型決定（P5 Daily: GEMINI_PRO, P0.7: OPUS, 其他: GPT）

### 完整 Prompt 內容

請參考 `src/03_M0_CORE.js` 的審查者 prompt 函數（第 739 行和第 778 行開始）。

**關鍵內容**：
- 審查執行者的輸出
- 回答執行者提出的問題
- 事實查證（如果需要的話）
- 提供建議和改進意見
- 輸出格式（必須是 JSON）

**完整 prompt 長度**：約 100+ 行

---

## 📊 測試評估重點

### 1. Prompt 完整性
- ✅ 是否包含所有必要的指令和要求？
- ✅ 是否明確說明輸出格式？
- ✅ 是否包含禁止事項和注意事項？

### 2. AI 回應品質
- ✅ 輸出欄位是否完整？
- ✅ 欄位內容是否符合預期格式？
- ✅ 邏輯是否合理？
- ✅ 是否遵循了 prompt 中的要求？

### 3. 數據使用
- ✅ AI 是否正確使用了提供的數據？
- ✅ 是否沒有自己去找數據（違反白名單原則）？
- ✅ 是否正確整合了多個數據源？

### 4. 特殊要求
- ✅ P0: 是否產出兩大類各一個（工程瓶頸類、服務壟斷類）？
- ✅ P0.7: 是否按照固定順序完成分析？
- ✅ P1: 是否完成三層對位檢查？
- ✅ P2: 是否沒有回寫前段封存欄位？
- ✅ P2.5: 是否正確使用 Top 10 對沖基金清單和 Clone 評分邏輯？
- ✅ P3: 是否以機構級預測視角分析？
- ✅ P5 Weekly: 是否動態決定因子權重？是否加強財報日個股籌碼權重？

---

**最後更新**：2025-01-15

**注意**：由於 prompt 內容非常長（每個 prompt 都有數百到上千行），本文檔只列出關鍵內容和檔案位置。完整的 prompt 內容請直接查看對應的源代碼檔案。
