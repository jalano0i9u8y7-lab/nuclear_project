# Weekly-B 拆分為 B1/B2 與觸發 o3 重建 — 討論整理（增強與融合）

**狀態**：✅ **已定案**（2026-01-26）  
**定案依據**：SSOT `V8.0架構定案文檔_SSOT.md` **⭐ V8.30 新設計：WB-1 / WB-2 / W-A**（模型配置表 + Weekly_final 流程與產出專節）；融合對照見 `P5-A與WB1_WB2_WA關係_審查與融合對照.md`。  
**原則**：不刪除、不遺漏現有功能，以**增強**概念融合進原本設計。  
**整理日期**：2026-01-26  
**關聯**：與 `DSFP身份動態化原則_討論整理_待定案.md` 搭配（B1 為 DSFP 身份裁決的執行層）。

---

## 一、討論重點摘要

### 1. 角色切分：Weekly-B → B1（認知層）+ B2（決策產出層）

| 層級 | 名稱 | 任務 | 輸出 | 禁止 |
|------|------|------|------|------|
| **B1** | 世界觀與身份判讀層（Cognitive Layer） | 宏觀敘事與個股敘事整合（Daily 連接）、DSFP 身份判斷、寫入動態記憶腦 | WORLD_STATE、ASSET_IDENTITY_MAP、NARRATIVE_CONFLICTS；FRAMEWORK_STABILITY_SCORE；rebuild_recommendation | 掛單、倉位、策略決策 |
| **B2** | 決策與產出層（Execution Layer） | 在**既定框架**下做倉位、掛單、Risk Overlay、Exposure | 策略、掛單 DSL、risk overlay、exposure；每筆決策須引用 worldview_version、identity_context | 自行改寫世界框架；框架只能來自 B1 或 Weekly-A |

### 2. 流程關係（誰先誰後、何時觸發 o3）

- **順序**：**B1 →（若觸發則）Weekly-A（o3）→ B2**。
- **B1**：只做世界觀/資產身份判讀 + 是否建議重建框架（Trigger）。不做任何掛單與策略。
- **觸發條件**：B1 輸出 `rebuild_recommendation = YES`（例如 FRAMEWORK_STABILITY_SCORE < 60 或等同邏輯）。
- **Weekly-A（o3）**：**僅在 B1 觸發時**執行；用 o3 重建「新世界觀框架」（NEW_WORLDVIEW_FRAMEWORK）；產出可寫入記憶腦、可機器讀取。
- **B2**：  
  - 若**未**觸發重建 → 使用 **B1 的 world_state_snapshot** 作為框架。  
  - 若**已**觸發重建 → 使用 **Weekly-A 的 NEW_WORLDVIEW_FRAMEWORK**（取代 B1 快照）作為框架。  
  - 在該框架下產出策略、倉位、掛單；**嚴禁**自行改寫世界框架；每個 order 必須引用 `worldview_version` 與 `identity_context`。

### 3. B1 輸入 / 輸出 / Prompt 要點

- **輸入**：本週 Daily（宏觀事件叢、個股事件叢，連接後）、宏觀數據 snapshot（利率/匯率/商品/股債/波動）、重大制度變更/新 ETF/新衍生品/新玩家摘要（若有）。
- **目標**：統整敘事、產出世界快照（不下單）、做 DSFP 身份判定、決定是否觸發 o3 重建。
- **Prompt 定位**：「世界觀判讀官」，不是策略交易員。必須先對關鍵資產（至少：美元、美債、VIX、油、金、銅、主要股指/板塊）做 DSFP-5 身份判斷。
- **輸出（建議 JSON）**：
  - `world_state_snapshot`
  - `asset_identity_map`（每資產：identity_label, shift, drivers）
  - `narrative_map`（本週主線敘事 + 分支）
  - `identity_shift_signals_summary`
  - `framework_stability_score`（0–100）：80+ 穩定、60–79 有漂移可調參、<60 建議觸發重建
  - `rebuild_recommendation`：YES / NO
  - `rebuild_reason_top5`（必須具體）

### 4. Weekly-A（o3）— 僅在 B1 觸發時執行

- **條件**：`rebuild_recommendation = YES`（由 B1 輸出）。
- **目標**：在 DSFP 基礎上重建「新框架」— 哪些資產不再是傳統角色？新的風險傳導路徑？
- **輸出（須可寫入記憶腦、可機器讀取）**：
  - `worldview_version_bump`
  - `new_assumption_set`
  - `new_risk_transmission_graph`
  - `deprecated_heuristics`（哪些舊規則作廢）
  - `updated_watchlist`（本週要加強監控什麼）

### 5. B2 輸入 / 任務 / Prompt 要點

- **輸入**：B1 結論（或 Weekly-A 的 NEW_WORLDVIEW_FRAMEWORK）、P2/P2.5/P3、風控模組。
- **任務**：倉位、掛單、Risk Overlay、Exposure；產出策略與 Order DSL。
- **Prompt 定位**：「策略交易員/基金經理」。**嚴禁自行改寫世界框架**；世界框架只能來自 B1（穩定時）或 Weekly-A（重建後）。每個 order 必須引用 `worldview_version` 與 `identity_context`（例如：Gold currently behaves as risk-on momentum asset）。

---

## 二、與現有 SSOT 的對齊（融合不推翻）

| 現有設計 | 本調整對應 | 融合方式 |
|----------|------------|----------|
| **P5-B（Weekly State Evaluator）** | 拆成 **B1 + B2** | B1 = 世界觀/身份判讀 + Trigger（新增，可視為 P5-B 的「前置步驟」）；B2 = 現有 P5-B 的決策與產出部分（state_vector、parameter_adjustment_vector、Strategy Skeleton、掛單），但**輸入**改為必須接收 B1 或 NEW_WORLDVIEW_FRAMEWORK，且**禁止**改寫框架、須引用 worldview_version / identity_context。 |
| **P5-A（Weekly Deep Re-evaluation）** | 保留；與「o3 重建」並存 | **兩種觸發**：(1) **現有 P5-A**：escalation_score、A～F 類觸發，對**個股**做深度覆審（Opus + Scout）；(2) **Weekly-A（o3）重建**：由 **B1 的 rebuild_recommendation = YES** 觸發，對**整體世界觀框架**做一次 o3 重建，產出 NEW_WORLDVIEW_FRAMEWORK。兩者並存，不互斥。 |
| **W-2 觸發** | 收斂為「B1 → rebuild → o3」 | 現有「Weekly B → Weekly A 嚴格觸發條件」可收斂為：**B1 產出 rebuild_recommendation = YES（含 FRAMEWORK_STABILITY_SCORE < 60 等）** 即觸發 **Weekly-A（o3）** 做世界觀重建；重建完成後 B2 才在新框架下產出。 |
| **Delta Pack、Learning State、記憶包** | B1 寫入動態記憶腦；B2 讀取 | B1 產出（world_state_snapshot、asset_identity_map、narrative_map 等）寫入「動態記憶腦」或既有記憶/快照表；B2 與後續 Weekly 讀取。Delta Pack、Learning State 仍供 B2 使用；B2 同時讀取「本週框架」（B1 或 NEW_WORLDVIEW_FRAMEWORK）。 |
| **Strategy Skeleton、Validator** | 保留在 B2 | B2 仍由程式產生 Strategy Skeleton，AI 產出 parameter_adjustment_vector 與掛單；Validator 仍驗證 B2 輸出。B2 新增約束：不得改寫框架、須引用 worldview_version / identity_context。 |
| **P5.7 世界觀統整** | 與 B1 職責對齊 | 現有 P5.7「本週數據分析並世界觀統整」可明確對齊為 **B1 的輸入準備**（宏觀事件叢、個股事件叢、Regime、Sector Flow 等彙總後供 B1 使用），或 B1 即為該統整的**裁決輸出**（世界快照 + 身份圖 + 穩定度 + 是否重建）。 |

---

## 三、可增強融合的部分（分層整理）

### A. 架構層：Weekly 內部順序與觸發

- **明文化**：P5 Weekly 執行順序為 **B1 →（若 rebuild_recommendation = YES）Weekly-A（o3）→ B2**。
- **B1**：單一或少量呼叫（宏觀/世界觀層），不做 per-stock 掛單；產出 world_state_snapshot、asset_identity_map、framework_stability_score、rebuild_recommendation、rebuild_reason_top5；寫入動態記憶/快照。
- **Weekly-A（o3）**：僅在 B1 輸出 rebuild_recommendation = YES 時執行；產出 NEW_WORLDVIEW_FRAMEWORK（worldview_version_bump、new_assumption_set、new_risk_transmission_graph、deprecated_heuristics、updated_watchlist）；可寫入記憶腦。
- **B2**：輸入 = B1 結論 或 NEW_WORLDVIEW_FRAMEWORK；產出 = 策略、倉位、掛單、risk overlay、exposure；禁止改寫世界框架；每筆決策引用 worldview_version 與 identity_context。
- **與現有 P5-A 並存**：個股 escalation（escalation_score、A～F）仍可觸發「P5-A 深度覆審」；與「B1 觸發 o3 世界觀重建」為兩條獨立觸發鏈。

### B. B1 輸出格式與寫入

- **輸出欄位**（建議 JSON，可寫入 SSOT 附錄）：  
  `world_state_snapshot`、`asset_identity_map`、`narrative_map`、`identity_shift_signals_summary`、`framework_stability_score`、`rebuild_recommendation`、`rebuild_reason_top5`。
- **寫入**：動態記憶腦 / 週度快照表（例如 P5__WORLDVIEW_SNAPSHOT 或等效），供 B2、Learning、下游讀取。
- **FRAMEWORK_STABILITY_SCORE 規則**：80+ 穩定、60–79 有漂移可調參、<60 建議觸發重建（可與 rebuild_recommendation 邏輯綁定）。

### C. Weekly-A（o3）重建輸出與寫入

- **輸出欄位**：`worldview_version_bump`、`new_assumption_set`、`new_risk_transmission_graph`、`deprecated_heuristics`、`updated_watchlist`；須可機器讀取、可寫入記憶腦。
- **寫入**：當週「當前有效框架」表或版本化快照，B2 讀取時若存在 NEW_WORLDVIEW_FRAMEWORK 則優先使用，否則用 B1 的 world_state_snapshot。

### D. B2 輸入與約束（不改主體、加約束）

- **輸入**：  
  - 本週框架：B1 的 world_state_snapshot **或** Weekly-A 的 NEW_WORLDVIEW_FRAMEWORK（若已執行重建）。  
  - 既有：P2/P2.5/P3、風控模組、Delta Pack、Learning State、記憶包等。
- **新增約束（System/User block）**：  
  - 嚴禁自行改寫世界框架；世界框架只能來自 B1（穩定時）或 Weekly-A（重建後）。  
  - 每個 order / 策略決策必須引用 `worldview_version` 與 `identity_context`（可簡化為必填欄位或說明欄）。
- **保留**：Strategy Skeleton、parameter_adjustment_vector、Validator、既有硬約束/軟引導/自由空間、基準權重、learning_feedback 等，全部保留在 B2。

### E. DSFP 與 B1 的銜接

- B1 為 DSFP「身份裁決」的**執行層**：對關鍵資產做 DSFP-5 判斷，產出 asset_identity_map、identity_shift_signals_summary，並彙總為 framework_stability_score 與 rebuild_recommendation。
- 若 DSFP 討論定案，B1 的 Prompt 與輸出格式須與 DSFP 五模組、IDENTITY_DRIFT 等對齊；B2 使用的 identity_context 可來自 B1 的 asset_identity_map。

### F. 實作與命名對齊

- **命名**：  
  - 現有「P5-B」可保留為總稱，內部細分為 **P5-B1**（世界觀/身份判讀 + Trigger）、**P5-B2**（決策與掛單產出）；或 SSOT 直接寫「Weekly B1」「Weekly B2」以利閱讀。  
  - 「Weekly-A（o3）重建」與現有「P5-A」區分：P5-A = 個股深度覆審（Opus+Scout）；Weekly-A（o3）= 世界觀框架重建（僅 o3，僅 B1 觸發時）。
- **呼叫順序**：先跑 B1（1 次或少量）；若 rebuild_recommendation = YES 則跑 o3 重建；再跑 B2（per-stock batch 或既有 P5-B 流程），B2 讀取「當前有效框架」與 P2/P2.5/P3 等。

---

## 四、融合時注意事項（定案後改 SSOT 時）

1. **不刪不減**：現有 P5-B 的 state_vector、parameter_adjustment_vector、Strategy Skeleton、Validator、Delta Pack、Learning、基準權重、硬約束等一律保留，收納在 **B2**；僅新增 **B1** 與 **Weekly-A（o3）重建** 的流程與輸出。
2. **兩條觸發鏈分開**：  
   - **B1 → rebuild_recommendation = YES → Weekly-A（o3）→ 更新框架 → B2 用新框架**。  
   - **B2 per-stock escalation_score / A～F → P5-A 深度覆審（個股）**。  
   兩者皆保留，不互斥。
3. **B2 禁止改寫框架**：在 SSOT 與 Prompt 中明文化「世界框架只能來自 B1 或 Weekly-A」；B2 輸出須帶 worldview_version 與 identity_context（可為欄位或說明）。
4. **記憶與版本**：B1 與 Weekly-A 的產出須可寫入動態記憶/快照，並有 worldview_version 或等效版本標識，供 B2 與未來 Learning 使用。
5. **與 DSFP 文件對齊**：若 DSFP 身份動態化原則已定案，本調整中的 B1 輸出格式（asset_identity_map、framework_stability_score）須與 DSFP 裁決規則、五模組一致。

---

## 五、建議定案檢查清單（討論通過後再動 SSOT）

- [ ] Weekly 內部順序明文化：B1 →（若觸發）Weekly-A（o3）→ B2。
- [ ] B1 輸入來源：Daily 事件叢、宏觀 snapshot、制度/ETF/衍生品/玩家摘要；輸出：world_state_snapshot、asset_identity_map、narrative_map、framework_stability_score、rebuild_recommendation、rebuild_reason_top5；寫入動態記憶/快照。
- [ ] FRAMEWORK_STABILITY_SCORE 門檻：80+ / 60–79 / <60 與 rebuild_recommendation 的對應規則。
- [ ] Weekly-A（o3）觸發條件：僅當 B1 的 rebuild_recommendation = YES；輸出 NEW_WORLDVIEW_FRAMEWORK 及欄位；寫入記憶腦/版本化快照。
- [ ] B2 輸入：本週框架（B1 或 NEW_WORLDVIEW_FRAMEWORK）+ P2/P2.5/P3 + 風控等；約束：禁止改寫框架、須引用 worldview_version 與 identity_context。
- [ ] P5-A（個股深度覆審）與 Weekly-A（o3 世界觀重建）在 SSOT 中區分清楚，兩條觸發鏈並存。
- [ ] 與 DSFP 討論整理對齊：B1 的 DSFP-5 判斷、asset_identity_map 格式、IDENTITY_DRIFT 與 framework_stability 的關係。

---

**以上為第二項調整（Weekly-B 拆分 B1/B2 + 觸發 o3 重建）的討論整理與可增強融合部分；待定案後再依此修改 SSOT、全系統 AI 工作紀錄、各階段 Prompt 補強參考、定案用檢查清單等。**
