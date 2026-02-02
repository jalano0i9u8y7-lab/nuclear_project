# 🧪 輕測試 AI 回應檢查指南 V8.0

## 📋 概述

本指南明確列出每個 Phase 測試時，需要檢查的 AI 回應欄位位置。**請按照指引複製貼上 AI 回應給我檢查。**

## ⚠️ 重要原則（嚴格執行）

**AI 回應的檢查人必須是這個對話框的 AI 助手（我），不能是程式自動檢查。**

1. **只有對整個計畫完全了解的 AI 才能正確評估 AI 回應是否符合設計精神**
2. **程式只能做初步的欄位檢查，不能做真正的 AI 回應評估**
3. **不能是其他不懂計畫的人或系統來檢查**
4. **如果違反這個原則，寧願手動貼上**

**檢查流程：**
1. 系統自動讀取 AI 原始回應（僅供資料讀取）
2. **您複製貼上 AI 原始回應到這個對話框**
3. **我（這個對話框的 AI 助手）進行最終評估**

---

## 🔍 通用檢查方法

### 方法 1：從 M0__CROSSCHECK_LOG 表格檢查（推薦）

**這是 AI 的原始回應，最準確。**

1. 打開 Google Sheets 中的 `M0__CROSSCHECK_LOG` 表格
2. 找到對應 Phase 的 `job_id`（測試完成後會顯示在日誌中）
3. 篩選 `job_id` 欄位，找到該 Phase 的記錄
4. 應該有 **2 條記錄**：
   - `step = "EXECUTOR"`：執行者的原始回應
   - `step = "AUDITOR"`：審查者的原始回應

**需要複製的欄位：**
- **EXECUTOR 步驟**：`output_snapshot` 欄位（完整 JSON 字串）
- **AUDITOR 步驟**：`output_snapshot` 欄位（完整 JSON 字串）

### 方法 2：從 M0__RESULT 表格檢查

1. 打開 `M0__RESULT` 表格
2. 找到對應的 `job_id`
3. 複製 `final_output` 欄位（這是處理後的結果）

---

## 📊 各 Phase 檢查清單

### ✅ P0（產業工程學分析）

**檢查位置：**
- **表格**：`M0__CROSSCHECK_LOG`
- **篩選條件**：`job_id = [P0 測試的 job_id]`，`step = "EXECUTOR"`
- **需要複製的欄位**：`output_snapshot`（完整內容）

**檢查重點：**
- ✅ `themes` 陣列：應有 **2 個** themes
  - 1 個 `analysis_type: "ENG"`（工程瓶頸類）
  - 1 個 `analysis_type: "STRUCT"`（定價權獨佔類）
- ✅ 每個 theme 必須包含：
  - `theme_id`、`theme_name`、`description`
  - `analysis_type`：`"ENG"` / `"STRUCT"` / `"BOTH"`
  - **P0-3 強制輸出（五項缺一不可）**：
    - `problem_oneliner`
    - `failure_mode`
    - `no_alternative_reason`
    - `convergence_evidence`
    - `long_term_time_window`
- ✅ `subthemes` 陣列：應有 **2 個** subthemes
  - 每個 subtheme 必須有 `theme_id` 關聯

**請複製以下欄位給我：**
```
表格：M0__CROSSCHECK_LOG
篩選：job_id = [你的 P0 job_id], step = "EXECUTOR"
欄位：output_snapshot（完整內容）
```

---

### ✅ P0.7（系統動力學分析）

**檢查位置：**
- **表格**：`M0__CROSSCHECK_LOG`
- **篩選條件**：`job_id = [P0.7 測試的 job_id]`，`step = "EXECUTOR"`
- **需要複製的欄位**：`output_snapshot`（完整內容）

**檢查重點：**
- ✅ `themes` 陣列：應對應 P0 的 2 個 themes
- ✅ 每個 theme 必須包含：
  - `dynamic_problem_oneliner`：動態問題一句話
  - `stocks_and_flows`：存量與流量分析
  - `causal_loops`：因果循環分析
  - `time_position`：`"Early"` / `"Mid"` / `"Late"` / `"Transition"`
  - `leveraged_role_type`：槓桿角色類型
  - `loop_dominance`：`"R"` / `"B"` / `"Mixed"`

**請複製以下欄位給我：**
```
表格：M0__CROSSCHECK_LOG
篩選：job_id = [你的 P0.7 job_id], step = "EXECUTOR"
欄位：output_snapshot（完整內容）
```

---

### ✅ P1（公司池生成）

**檢查位置：**
- **表格**：`M0__CROSSCHECK_LOG`
- **篩選條件**：`job_id = [P1 測試的 job_id]`，`step = "EXECUTOR"`
- **需要複製的欄位**：`output_snapshot`（完整內容）

**檢查重點：**
- ✅ `master_candidates` 陣列：
  - 測試模式：每個 theme/subtheme 應有 **5 間公司**
  - 總計約 **10 間公司**（2 個 themes × 5 間）
- ✅ 每間公司必須包含：
  - `ticker`、`company_name`、`market`
  - `fit_checks`：三項適配檢查結果
    - `ENG_Fit_Result`
    - `STRUCT_Fit_Result`
    - `Time_Role_Fit_Result`
  - `fit_score`：適配分數
  - `Moat_Type`、`Rerate_State`

**請複製以下欄位給我：**
```
表格：M0__CROSSCHECK_LOG
篩選：job_id = [你的 P1 job_id], step = "EXECUTOR"
欄位：output_snapshot（完整內容）
```

---

### ✅ P2（基本面財務分析）

**檢查位置：**
- **表格**：`M0__CROSSCHECK_LOG`
- **篩選條件**：`job_id = [P2 測試的 job_id]`，`step = "EXECUTOR"`
- **需要複製的欄位**：`output_snapshot`（完整內容）

**檢查重點：**
- ✅ `tier_assignments` 對象：
  - 每個 ticker 必須有 `tier` 和 `gate_result`
  - **重要**：不應回寫前段封存欄位（One Way Lock）
- ✅ `financial_analysis`：財務分析結果

**請複製以下欄位給我：**
```
表格：M0__CROSSCHECK_LOG
篩選：job_id = [你的 P2 job_id], step = "EXECUTOR"
欄位：output_snapshot（完整內容）
```

---

### ✅ P2.5（機構級籌碼面分析）

**檢查位置：**
- **表格**：`M0__CROSSCHECK_LOG`
- **篩選條件**：`job_id = [P2.5 測試的 job_id]`，`step = "EXECUTOR"`
- **需要複製的欄位**：`output_snapshot`（完整內容）

**檢查重點：**
- ✅ `smart_money_analysis` 對象：
  - 每個 ticker 必須包含：
    - `institutional_holdings`
    - `insider_trading`
    - `options_flow`
    - `dark_pool_activity`
    - `hedge_fund_clone`
    - `smart_money_score`
- ✅ 檢查是否有 CSE_SEARCH 步驟（數據收集）

**請複製以下欄位給我：**
```
表格：M0__CROSSCHECK_LOG
篩選：job_id = [你的 P2.5 job_id], step = "EXECUTOR"
欄位：output_snapshot（完整內容）
```

---

### ✅ P3（技術分析）

**檢查位置：**
- **表格**：`M0__CROSSCHECK_LOG`
- **篩選條件**：`job_id = [P3 測試的 job_id]`，`step = "EXECUTOR"`
- **需要複製的欄位**：`output_snapshot`（完整內容）

**檢查重點：**
- ✅ `technical_results` 對象：
  - 每個 ticker 必須包含：
    - `institutional_perspective`：機構級預測視角
    - `cat`：`"Cat1"` / `"Cat2"` / `"Cat3"` / `"Cat4-A"` / `"Cat4-B"` / `"Cat5"`
    - `main_force_behavior`：主力行為解釋
    - `buy_orders`：買單建議（陣列）

**請複製以下欄位給我：**
```
表格：M0__CROSSCHECK_LOG
篩選：job_id = [你的 P3 job_id], step = "EXECUTOR"
欄位：output_snapshot（完整內容）
```

---

### ✅ P5 Daily（每日監控）

**檢查位置：**
- **表格**：`M0__CROSSCHECK_LOG`
- **篩選條件**：`job_id = [P5 Daily 測試的 job_id]`，`step = "EXECUTOR"`
- **需要複製的欄位**：`output_snapshot`（完整內容）

**檢查重點：**
- ✅ 主要用於數據收集，AI 用於新聞原子化
- ✅ 檢查數據收集是否完整：
  - OHLCV 數據
  - 新聞數據
  - 技術指標

**請複製以下欄位給我：**
```
表格：M0__CROSSCHECK_LOG
篩選：job_id = [你的 P5 Daily job_id], step = "EXECUTOR"
欄位：output_snapshot（完整內容）
```

---

### ✅ P5 Weekly（週度策略）

**檢查位置：**
- **表格**：`M0__CROSSCHECK_LOG`
- **篩選條件**：`job_id = [P5 Weekly 測試的 job_id]`，`step = "EXECUTOR"`
- **需要複製的欄位**：`output_snapshot`（完整內容）

**檢查重點：**
- ✅ `worldview` 對象：
  - `weekly_worldview`：週度世界觀
  - `market_regime`：市場狀態
  - `mag7_analysis`：Mag 7 分析
- ✅ `stock_strategies` 對象：
  - 每個 ticker 必須包含：
    - `factor_weights`：動態因子權重（AI 動態決定）
    - `weight_reasoning`：權重決定理由
    - `action`：`"BUY"` / `"SELL"` / `"HOLD"` / `"INCREASE"` / `"DECREASE"`
    - `reasoning`：決策理由（應引用多個數據源）
- ✅ 如果有財報事件，檢查 `earnings_smart_money_weight` 是否正確加強

**請複製以下欄位給我：**
```
表格：M0__CROSSCHECK_LOG
篩選：job_id = [你的 P5 Weekly job_id], step = "EXECUTOR"
欄位：output_snapshot（完整內容）
```

---

## 🔍 雙模型系統檢查

### 檢查 EXECUTOR 和 AUDITOR 的回應

**對於每個 Phase，需要檢查兩條記錄：**

1. **EXECUTOR 步驟**：
   - 表格：`M0__CROSSCHECK_LOG`
   - 篩選：`job_id = [你的 job_id]`, `step = "EXECUTOR"`
   - 欄位：`output_snapshot`（執行者的原始回應）

2. **AUDITOR 步驟**：
   - 表格：`M0__CROSSCHECK_LOG`
   - 篩選：`job_id = [你的 job_id]`, `step = "AUDITOR"`
   - 欄位：`output_snapshot`（審查者的審查意見）

**請同時複製兩條記錄的 `output_snapshot` 給我：**
```
表格：M0__CROSSCHECK_LOG
篩選：job_id = [你的 job_id]
記錄 1：step = "EXECUTOR" 的 output_snapshot
記錄 2：step = "AUDITOR" 的 output_snapshot
```

---

## 📝 複製格式建議

**請按照以下格式提供：**

```
Phase: P0
Job ID: JOB_1768506637896_xxx

EXECUTOR 回應：
[複製 M0__CROSSCHECK_LOG 中 step="EXECUTOR" 的 output_snapshot 欄位完整內容]

AUDITOR 回應：
[複製 M0__CROSSCHECK_LOG 中 step="AUDITOR" 的 output_snapshot 欄位完整內容]
```

---

## 🔍 AI 回應評估重點（核心檢查項目）

### ⭐ 重點 1：回應是否符合該工作的主要任務與設計精神

**檢查項目：**
- ✅ AI 回應是否理解了該 Phase 的核心任務
- ✅ 輸出結構是否符合設計精神（例如：P0 的「工程必然」vs「結構性定價權」分類）
- ✅ 是否遺漏了關鍵分析維度

**評估標準：**
- **符合**：回應完整覆蓋該 Phase 的核心任務，輸出結構正確
- **部分符合**：涵蓋大部分任務，但遺漏某些關鍵點
- **不符合**：回應偏離核心任務，或遺漏重要分析維度

**如果不符合 → 表示 Prompt 遺漏重點，必須補上**

---

### ⭐ 重點 2：回應是否強調出該任務重視的部分

**檢查項目：**
- ✅ AI 是否正確強調了該 Phase 重視的部分（例如：P0 的 P0-3 五項強制輸出）
- ✅ 回應是否「在點上」還是「偏移主題」
- ✅ 重要欄位的內容是否深入、具體，還是流於表面

**評估標準：**
- **強調到位**：重要部分內容深入、具體，符合預期
- **強調不足**：重要部分內容較淺，或未充分展開
- **偏移主題**：回答不在點上，或過多無關內容

**如果有問題 → 表示 Prompt 強度不夠，需要更強烈、更硬的要求**

**改進方向：**
- 在 Prompt 中明確標記「必須」、「強制」、「缺一不可」
- 使用更強烈的語言（例如：「必須包含」、「不可省略」）
- 提供具體範例，明確展示期望的深度和格式

---

### ⭐ 重點 3：AI 回答的偏離度（一致性檢查）

**⚠️ 重要定義（必須理解）：**

**一致性指的是「同一分析者（EXECUTOR），相同輸入資料，多次執行是否產生一致結論」。**

**這不是指 EXECUTOR 和 AUDITOR 的一致性：**
- ❌ 錯誤理解：EXECUTOR 和 AUDITOR 應該一致
- ✅ 正確理解：EXECUTOR 和 AUDITOR 應該有不同的視角，用不同模型就是為了交叉驗證

**檢查項目：**
- ✅ **同一份資料，同一分析者（EXECUTOR），不同次執行是否產生一致的結論**
- ✅ 相同輸入條件下，同一分析者的輸出是否穩定
- ✅ 如果存在偏離（例如：EXECUTOR 這次說 BUY，下次說 SELL，但輸入資料完全相同），分析原因

**範例：**
- ✅ **一致性高**：EXECUTOR 對相同資料執行 3 次，都判斷為 BUY → Prompt 語意清晰
- ❌ **一致性低**：EXECUTOR 對相同資料執行 3 次，一次說 BUY，一次說 SELL，一次說 HOLD → Prompt 語意模糊，容易被 AI 誤解

**可能的原因：**
1. **Prompt 語意模糊**：容易造成 AI 不同解讀
2. **缺少決策依據說明**：AI 沒有明確的判斷標準
3. **上下文不足**：缺少必要的背景資訊或規則
4. **溫度參數過高**：導致輸出隨機性過大

**評估標準：**
- **一致性高**：同一分析者，相同輸入產生相似結論，偏離度小
- **一致性中等**：同一分析者，主要結論一致，但細節有差異
- **一致性低**：同一分析者，相同輸入產生不同結論，偏離度大

**如果偏離度過大 → 表示 Prompt 可能有容易造成 AI 判讀誤解的地方，必須檢查修正**

**改進方向：**
1. **明確決策規則**：在 Prompt 中明確列出判斷標準和決策邏輯
2. **減少模糊語言**：避免使用「可能」、「或許」、「根據情況」等模糊表述
3. **提供決策樹**：使用 if-else 邏輯明確說明不同情況下的處理方式
4. **要求說明依據**：要求 AI 明確說明決策依據，便於檢查邏輯一致性
5. **檢查溫度參數**：確認是否設置了合適的 temperature（通常分析任務應 ≤ 0.7）

---

## 📋 評估報告格式

**請在提供 AI 回應時，同時提供以下評估：**

```
Phase: P0
Job ID: JOB_xxx

EXECUTOR 回應：
[完整 JSON 內容]

AUDITOR 回應：
[完整 JSON 內容]

=== 重點評估 ===

1. 是否符合主要任務與設計精神：
   - 評估：✅ 符合 / ⚠️ 部分符合 / ❌ 不符合
   - 說明：[具體說明哪裡符合或不符合]
   - 建議：[如果有問題，提供改進建議]

2. 是否強調出重視的部分：
   - 評估：✅ 強調到位 / ⚠️ 強調不足 / ❌ 偏移主題
   - 說明：[具體說明哪些部分強調到位或不足]
   - 建議：[如果有問題，提供 Prompt 修改建議]

3. 回答偏離度（一致性）：
   - 評估：✅ 一致性高 / ⚠️ 一致性中等 / ❌ 一致性低
   - 說明：[如果有多次執行，比較同一分析者（EXECUTOR）對相同輸入的結果一致性]
   - 注意：這是指同一分析者的多次執行一致性，不是指 EXECUTOR 和 AUDITOR 的一致性（兩者用不同模型，應該有不同的視角）
   - 建議：[如果有問題，提供改進建議]
```

---

## ⚠️ 重要提醒

1. **必須複製完整的 JSON 字串**：不要只複製部分內容
2. **檢查兩條記錄**：EXECUTOR 和 AUDITOR 都要檢查
3. **確認 job_id**：確保是測試時產生的 job_id
4. **如果找不到記錄**：檢查 `M0__JOB_QUEUE` 表格，確認任務狀態為 `"DONE"`
5. **重點評估**：除了檢查欄位完整性，更要評估上述三個重點

---

**最後更新**：2025-01-16
