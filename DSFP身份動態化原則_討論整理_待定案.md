# DSFP（身份動態化原則）討論整理 — 可增強融合部分

**狀態**：✅ **已定案**（2026-01-26）  
**定案依據**：SSOT `V8.0架構定案文檔_SSOT.md` **⭐ V8.32 定案**（「動態現況優先原則（DSFP）」專節 + 「DSFP 五模組與全 Phase 植入規範」專節）。  
**原則**：不刪除、不遺漏現有功能，以**增強**概念融合進原本設計。  
**整理日期**：2026-01-26  

---

## 一、討論重點摘要

### 1. 核心觀念：金融商品「身份動態化」（Identity Drift Principle）

- **問題**：傳統用「歷史標籤」判斷資產（黃金＝避險、美債＝安全、科技 ETF＝成長），但現實中同一商品會隨時間變成不同東西（黃金→短期投機、美債→流動性風險來源、科技 ETF→過度擁擠泡沫）。
- **結論**：任何金融商品的「定位」必須視為**隨時間變化的函數**，不是固定標籤。**Weekly 宏觀層不能用「歷史身份」判斷，只能用「當前狀態」判斷。**

### 2. DSFP 定義（Dynamic State First Principle）

- **一句話**：任何資產的判斷**不得依賴歷史標籤**，必須依賴**當前狀態**。
- **公式**：`Asset Identity = Structure × Liquidity × Derivatives × Participants × Rules`（或五模組等價表述）。
- **鐵律**：任何投資決策前，先判斷它是「**哪一個版本的自己**」。結構變了，就不是原本那個資產。

### 3. 身份判斷的完整維度（8 維 → 收斂為 5 模組）

討論中先給出 8 大維度，後收斂為 **DSFP 五模組**，可直接對應到現有系統：

| 五模組 | 內容要點 | 系統對應（討論中已列） |
|--------|----------|------------------------|
| 1. 價格位置（Relative Position） | 長期區間位置、標準差偏離、ATH 距離、相對他資產（金銀比、股債比） | P3 趨勢位階、Weekly Regime、Sector RS |
| 2. 成交與流動性（Volume & Liquidity） | 量能、ETF 流量、點差、做市商行為 | P2.5 籌碼、ETF Flow、OI/Volume Delta |
| 3. 衍生品與槓桿密度（Derivatives & Leverage） | OI、Gamma、槓桿/反向 ETF、永續資金費率、結構性商品 | Gamma/OI、Options Flow、Leveraged ETF |
| 4. 參與者結構（Participant Structure） | 散戶/機構/對沖/做市/政府/被動資金比例 | Smart Money、13F、Sector Concentration、P2.5 |
| 5. 規則與機制（Rules & Mechanics） | 新 ETF、新監管、交易制度、稅制、結算、政策性買盤 | 政策事件、新 ETF/新法規、行事曆 |

### 4. 角色分工（與現有 Daily / Weekly 對齊）

- **Daily（D-3/D-4）**：**記錄與連接**，**不裁決身份**。只輸出 `IDENTITY_SHIFT_SIGNALS`（signal 有/無）、`EVENT_CLUSTER_UPDATE`、`WEEKLY_ESCALATION_HINT`；**嚴禁**「世界觀重建」與「策略建議」—與現有「史官鐵律」一致。
- **Weekly**：**身份裁決層**。判斷「商品身份是否改變」；若五模組中 **≥3 項顯著變化** → `IDENTITY_DRIFT = TRUE`，觸發下修信任權重、提升風險因子、強制輸出「身份轉變說明」；P4 可自動降 U、增現金。

### 5. 裁決規則（寫進 SSOT 的版本）

- **觸發條件**：以下五模組中 **3 項以上**出現顯著變化  
  - 價格區間極端  
  - 成交量與 ETF 流異常  
  - 衍生品/槓桿密度上升  
  - 參與者結構失衡  
  - 規則或機制改變  
- **標記**：`IDENTITY_DRIFT = TRUE`  
- **系統行為**：  
  - P5 Weekly：下修信任權重、提升風險因子、強制輸出「身份轉變說明」。  
  - P4：自動降低利用率 U、增加現金權重。

---

## 二、與現有 SSOT 的對齊關係（融合不推翻）

| 現有 SSOT 概念 | DSFP 對應 | 融合方式 |
|----------------|-----------|----------|
| 世界觀更新（P5 Weekly） | 動態身份判斷 | Weekly 增加「身份裁決子模組」與 DSFP 五模組檢查 |
| 敘事 vs 結構、Regime 分析 | 價格位置 + 規則與玩家模組 | 納入 DSFP 檢查框架，不取代既有 Regime |
| Sector ETF Flow、Mag 7 | 參與者結構、流動性 | 作為 DSFP 參與者/流動性輸入之一 |
| P2.5 籌碼、機構/散戶 | 參與者結構模組 | 輸出可標記 PARTICIPANT_IMBALANCE、FLOW_DISTORTION |
| P3 趨勢位階、Bull Trap | 價格位置 + 衍生品扭曲 | P3 增加 DISTORTION_RISK（gamma/ETF 扭曲），高則不給高信心突破 |
| 泡沫監控、Layer 2/3 | 衍生品密度、參與者結構 | 與 DSFP 衍生品/參與者模組共用概念 |
| Daily 史官鐵律 | Daily 只記錄、不裁決身份 | 明文化：只輸出 IDENTITY_SHIFT_SIGNALS，不做世界觀/策略 |
| Milestone / 驗證時間窗口 | 未來可驗證 | 與憲法第一條一致；DSFP 的 RECHECK_TRIGGER 可對接 |

---

## 三、可增強融合的部分（分層整理）

### A. 憲法 / 最高原則層（可選）

- **選項**：將「**動態現況優先原則（DSFP）**」寫入憲法或緊接憲法之「核心原則」—例如：「任何金融商品之判斷不得依賴歷史標籤，必須依賴當前狀態（結構×流動性×衍生品×參與者×規則）。」
- **備註**：與現有「未來可驗證」「未來優先」並存，不取代；可列為憲法補充或架構總覽中的「宏觀判斷原則」。

### B. 架構總覽 / 層級定位

- **明確寫出**：  
  - **Daily**：記錄事件、連接、標記；**不裁決**身份與世界觀。  
  - **Weekly**：世界觀與**身份裁決**；DSFP 為 Weekly「世界觀裁決層」的**核心判斷框架之一**（不是獨立 Phase）。  
- **放置位置**：P5 Daily 與 P5 Weekly 的職責邊界（與現有史官鐵律、Delta Pack、三層記憶等並列）。

### C. Weekly 宏觀層：身份裁決子模組

- **新增**：P5 Weekly 內「**身份裁決**」固定流程。  
  - 對**重要金融商品**（指數、板塊、黃金/債/匯/比特幣等）做**當前身份狀態**評估。  
  - **禁止**使用歷史標籤；必須依 **DSFP 五模組**交叉驗證。  
  - 若 **≥3 項顯著變化** → `IDENTITY_DRIFT = TRUE`。  
- **行為**：  
  - 下修信任權重、提升風險因子、強制輸出「身份轉變說明」。  
  - 與 P4 對接：IDENTITY_DRIFT 時 P4 可自動降 U、增現金（具體規則在 P4/Weekly 介面定）。

### D. Weekly Prompt 原型（固定模組）

- **名稱**：例如 `Weekly Macro Identity Evaluation` 或 `DSFP_IDENTITY_CHECK`。  
- **核心段落要點**：  
  - 評估每一重要金融商品的「**當前身份狀態**」，不得使用歷史標籤，須依八維度/五模組交叉驗證。  
  - 若三項以上顯著變化 → 標記 `Identity Drift`（即 IDENTITY_DRIFT = TRUE）。  
  - **動態現況優先原則（DSFP）**：只用當下狀態判斷，不用歷史印象。  
- **產出**：身份標籤、是否漂移、必要時「身份轉變說明」。

### E. 各 Phase「加強用」Prompt 區塊（只加 block，不改主體）

以下皆為**增量**：在既有 Prompt 前/中注入 System 或 User block，不刪減原有邏輯。

| Phase | 加強塊要點 | 目的 |
|-------|------------|------|
| **P0** | INDUSTRY_STATE_SNAPSHOT、INDUSTRY_IDENTITY_SHIFT；產業候選只來自「結構性必然」或「狀態漂移造成之新定價」 | 避免用傳統產業印象找題材；先判斷產業當前是否換了玩家/規則/槓桿 |
| **P0.5** | 節點標記 STRUCTURE_ROLE、FLOW_SENSITIVITY、DERIVATIVE_SENSITIVITY；若產業狀態漂移可輸出 CHAIN_MAP_VERSION_BUMP | 瓶頸與鏈圖隨狀態漂移更新 |
| **P1 Step1** | INDUSTRY_FIT、REPRICING_VECTOR、STATE_FIT_EVIDENCE；禁止只用「題材對」入選 | 候選公司須符合**當前**產業身份 |
| **P1 財報提取** | 只輸出原文與位置；分類到 Demand/Pricing/Capacity/…；若遇身份漂移線索標記 IDENTITY_SIGNAL_QUOTE | 證據切片不污染；為身份判斷留線索 |
| **P1 Step2** | INDUSTRY_TYPE、BUSINESS_MODEL_SIGNATURE、PRIMARY_TRUTH_METRICS、FORBIDDEN_METRICS；後續判斷須引用 PRIMARY_TRUTH_METRICS | 產業邏輯注入、禁止錯用指標（如拿硬體 EPS 看軟體） |
| **P2-1** | 同業須「狀態一致」（同一 regime/資金/定價機制）；輸出 STATE_DEPENDENCE、RECHECK_TRIGGER（高狀態依賴時下週重算） | 同業比較「狀態感知」 |
| **P2-2** | Step0 Industry Logic Injection：INDUSTRY_PLAYBOOK、CFO_QUESTIONS_TOP10、CHAIRMAN_FORWARD_VIEW_LENS；Step1 僅引用白名單+原文，無證據則 UNKNOWN_NOT_GUESS | CFO/董事長視角、產業真相指標與毒辣問題 |
| **P3** | 型態判斷前先輸出 DISTORTION_RISK（NONE/LOW/MED/HIGH）；若為 gamma/ETF/槓桿扭曲；HIGH 時禁止高信心突破、改為 TRAP_RISK 或 WAIT_CONFIRMATION | 技術面先檢查衍生品/ETF 扭曲 |
| **Daily D3/D4** | 嚴禁世界觀重建與策略建議；只允許 EVENT_CLUSTER_UPDATE、IDENTITY_SHIFT_SIGNALS（僅 signal）、WEEKLY_ESCALATION_HINT | 與史官鐵律一致，Daily 只記錄+標記 |

### F. 全系統共用 System Block（可選）

- **名稱**：例如 `GLOBAL_SYSTEM_BLOCK_DSFP_V1`。  
- **要點**：  
  - 禁止依「資產名稱」套用歷史標籤；須先做 DSFP 身份判定再分析/分類/結論。  
  - 五模組（Relative Position, Liquidity & Flow, Derivatives & Leverage, Participant Structure, Rules & Mechanics）。  
  - 輸出須含 ASSET_IDENTITY、IDENTITY_SHIFT；資料不足時標記 INSUFFICIENT_STATE_DATA，不得腦補。  
- **使用方式**：各 Phase 的 System prompt 前可選擇性注入（或做成可重用模板），**不強制全部 Phase 同一長度**，可依 Phase 取用相關子集。

### G. P2.5 / P4 行為（與現有規則並存）

- **P2.5**：若機構比例極端 → 標記 PARTICIPANT_IMBALANCE；若 ETF 流量極端 → 標記 FLOW_DISTORTION（與現有 Smart Money、異常警報並存）。  
- **P4**：當 **IDENTITY_DRIFT = TRUE**（由 Weekly 傳入）時，自動降低 U、增加現金權重；具體係數與上限與現有 Market Climate Override、Portfolio Correlation Lock 等並存，不覆蓋既有風控。

---

## 四、融合時注意事項（定案後改 SSOT 時）

1. **不刪不減**：所有既有功能（Regime、Sector Flow、泡沫監控、史官鐵律、Milestone 驗證等）保留，DSFP 以**補充**與**明文化**為主。  
2. **定位清楚**：DSFP 是 **Weekly 世界觀裁決層的判斷框架**，不是新 Phase；Daily 僅標記 signal，不裁決。  
3. **Prompt 只加 block**：各 Phase 以「加入 System/User block」或可重用模板為主，不重寫原有主體邏輯。  
4. **輸出欄位與下游**：新增欄位（如 IDENTITY_DRIFT、IDENTITY_SHIFT_SIGNALS、DISTORTION_RISK、STATE_DEPENDENCE 等）需在 SSOT 與資料流中註明寫入處與下游讀取處（含 P4、Weekly、Learning）。  
5. **與憲法一致**：DSFP「當前狀態優先」與憲法「未來可驗證」並存；RECHECK_TRIGGER 可對接驗證時間窗口與 Milestone。

---

## 五、建議定案檢查清單（討論通過後再動 SSOT）

- [ ] 憲法或核心原則是否新增「DSFP / 動態現況優先」一條（或僅在架構/Weekly 章節明文化）。  
- [ ] Weekly 身份裁決子模組：觸發條件（≥3 項）、輸出（IDENTITY_DRIFT、身份轉變說明）、與 P4 的介面。  
- [ ] Daily D3/D4 邊界：僅輸出 IDENTITY_SHIFT_SIGNALS、EVENT_CLUSTER_UPDATE、WEEKLY_ESCALATION_HINT；嚴禁世界觀/策略。  
- [ ] 各 Phase 加強塊：哪些 Phase 採用哪些 block（P0、P0.5、P1-1、P1-1.5、P1-2、P2-1、P2-2、P3、Daily）及對應輸出欄位。  
- [ ] GLOBAL_SYSTEM_BLOCK_DSFP：是否全 Phase 注入或僅部分 Phase；若部分，清單與縮減版內容。  
- [ ] P4 行為：IDENTITY_DRIFT 時 U 與現金權重的具體規則，與現有 Override 的優先序。

---

**以上為討論整理與可增強融合部分；已定案並寫入 SSOT V8.32、全系統 AI 工作紀錄、各階段 Prompt 補強參考、定案用檢查清單已對齊。**
