# Prompt 遷移確認報告：GAS → Python 無遺漏清單

**日期**：2026-01-26  
**目的**：確保改寫成 Python 時，SSOT 摘要之外、寫在 GAS 程式碼中的**全部 Prompt 與詳細架構**毫無遺漏搬移。

---

## 一、現狀說明

- **SSOT**：目前為**摘要級**設計文檔，記載原則、流程、模型配置、Phase 職權與 I/O 對接。
- **詳細內容在 GAS**：各 Phase 的**完整 Prompt 正文**、審查者 Prompt、批次 Header、DSFP/憲法注入區塊、角色校準器與未來對齊三問等，均實作在 `gas_archive/src/` 的 `build*Prompt` / `build*Auditor*` 函數內。
- **遷移目標**：Python 實作時，**所有 Prompt 與架構細節**須從 GAS 逐一對照搬移，不得僅依 SSOT 摘要重寫而遺漏。

---

## 二、GAS 中所有 Prompt 建構函數清單（遷移必對照）

以下為 `gas_archive/src/` 內**所有** `build*Prompt` / `build*Auditor*` 函數，遷移時每一項都需從對應 .js 檔抽出全文並落實在 Python 對應模組。

| 序號 | 函數名稱 | 所在檔案 | 對應 Phase / 用途 | SSOT 對照章節 |
|------|----------|----------|-------------------|----------------|
| 1 | `buildP0Prompt` | `09_P0_INDUSTRY_ENGINEERING.js` | P0 產業工程學分析 | P0、憲法、角色校準器、未來對齊三問 |
| 2 | `buildP0_5Prompt` | `08_P0_5_INDUSTRY_CHAIN.js` | P0.5 產業鏈地圖（Mode 1） | P0.5、DSFP 加強塊 |
| 3 | `buildChainDynamicsPrompt` | `08_P0_5_INDUSTRY_CHAIN.js` | P0.5 產業鏈動態監控（Mode 2） | P0.5 Mode 2、Chain Dynamics |
| 4 | `buildP0_7Prompt` | `19_P0_7_SYSTEM_DYNAMICS.js` | P0.7 系統動力學分析 | P0.7、全系統補丁 |
| 5 | `buildP0ReanalysisPrompt` | `09_P0_VALIDATION.js` | P0 時效性驗證後重新分析 | P0 時效性驗證、Gemini+OPUS |
| 6 | `buildP1Prompt` | `20_P1_COMPANY_POOL.js` | P1 公司池（舊版/備用） | P1 |
| 7 | `buildP1Step1Prompt` | `20_P1_V8_14.js` | P1 Step 1 股票池生成 | P1 兩階段、Flash 股票池 |
| 8 | `buildP1Step2Prompt` | `20_P1_V8_14.js` | P1 Step 2 結構分級 | P1 Step 2、Tier S/A/B/X |
| 9 | `buildFinancialReportExtractionPrompt` | `20_P1_FINANCIAL_REPORTS.js` | P1 財報三欄位提取（P1/P2/P3 Evidence） | P1 財報、Flash 三欄位 |
| 10 | `buildP1Step2AuditorPrompt` | `03_M0_CORE.js` | P1 Step 2 審查者（含財報資料） | M0 審查者、原始資料區塊 |
| 11 | `buildP2Prompt` | `21_P2_FUNDAMENTAL_ANALYSIS.js` | P2 基本面分析（單批次） | P2、P2-1/P2-2、同業比較、雙 FPE |
| 12 | `buildP2BatchPrompt` | `21_P2_FUNDAMENTAL_ANALYSIS.js` | P2 批次 Header + 替換符 | P2 Batch、分隔規則 |
| 13 | `buildP2_5Prompt` | `21_P2_5_PROMPT.js` | P2.5 籌碼分析（單檔） | P2.5、NO SIGNAL、機構級 |
| 14 | `buildP2_5BatchPrompt` | `21_P2_5_PROMPT.js` | P2.5 批次 | P2.5 Batch、<<<COMPANY: TICKER>>> |
| 15 | `buildP3Prompt` | `22_P3_AI_ANALYSIS.js` | P3 技術分析（含週線/日線分區） | P3、機構級預測、[WEEKLY_CHART]/[DAILY_CHART] |
| 16 | `buildP3BatchPrompt` | `22_P3_AI_ANALYSIS.js` | P3 批次 Header + 替換 | P3 Batch |
| 17 | `buildP3AuditorPrompt` | `22_P3_CORE.js` | P3 審查者（含原始資料） | P3 審查、V8.16 原始資料 |
| 18 | `buildAuditorPromptWithQuestions` | `03_M0_CORE.js` | 通用審查者（執行者提問 + 原始資料） | M0、originalData 區塊 |
| 19 | `buildAuditorPromptWithFactCheck` | `03_M0_CORE.js` | 審查者 + 事實查證結果 | M0、Gemini Search 融合 |
| 20 | `buildP5_BPrompt` | `24_P5_WEEKLY_DUAL_LAYER.js` | P5-B 輕量版、基準權重、Learning/MISSION_CONSTRAINTS | P5 雙層、硬約束/軟引導、C2 |
| 21 | `buildP5_APrompt` | `24_P5_WEEKLY_DUAL_LAYER.js` | P5-A 深度版、P6 頻率、Delta Pack | P5-A、P6 頻率趨勢、M2 Delta Pack |
| 22 | `buildP5WeeklyIntegratedPrompt` | `24_P5_WEEKLY_PROMPT.js` | P5 Weekly 整合 Prompt（舊/備用） | P5 Weekly 流程 |
| 23 | `buildP5WeeklyPrompt` | `24_P5_WEEKLY_PROMPT.js` 或 `24_P5_WEEKLY.js` | P5 Weekly 單一 Prompt 版 | P5 Weekly |
| 24 | `buildWorldviewPrompt` | `24_P5_WEEKLY_PROMPT.js` | 世界觀分析 | P5.7、WB-1 對齊 |
| 25 | `buildStockStrategyPrompt` | `24_P5_WEEKLY_PROMPT.js` | 單檔策略 | P5 個股策略 |
| 26 | `buildStockStrategyBatchPrompt` | `24_P5_WEEKLY_STOCK_STRATEGY.js` | 批次策略、籌碼/財報日權重 | P5 批次、Order DSL |
| 27 | `buildLearningAnalysisPrompt` | `24_P5_MONTHLY.js` | 學習分析（月度） | P5 Monthly、Learning |
| 28 | `buildP5MonthlyPrompt` | `24_P5_MONTHLY.js` | P5 Monthly 整合 | P5 Monthly |
| 29 | `buildP5QuarterlyPrompt` | `24_P5_QUARTERLY.js` | P5 Quarterly 整合 | P5 Quarterly |
| 30 | `buildDeviationAnalysisPrompt` | `24_P5_WEEKLY_LEARNING.js` | 偏差分析（策略 vs 實際） | Learning、compareStrategyWithReality |
| 31 | `buildEarningsHistoricalExperiencePrompt` | `27_EARNINGS_HISTORICAL_EXPERIENCE.js` | 持股財報五年歷史經驗 | 持股財報完整分析 |
| 32 | `buildEarningsDatesPrompt` | `27_HOLDINGS_EARNINGS_GENERATOR.js` | 預估財報日期 | 財報日期生成 |
| 33 | `buildSingleTickerPrompt` | `27_HOLDINGS_EARNINGS_COMPLETE.js` | 單檔財報完整分析 | P4 完成後觸發 |
| 34 | `buildBatchPrompt` | `27_HOLDINGS_EARNINGS_COMPLETE.js` | 批次持股財報分析 | 同上 |
| 35 | `buildCalendarHistoricalExperiencePrompt` | `18_P5_CALENDAR_MANAGER.js` | 行事曆事件歷史經驗（五年市場反應） | P5 行事曆、重大事件 |
| 36 | （M0 內嵌）| `03_M0_CORE.js` | reliabilityPrompt（來源可信度 5 級） | 事實查證、來源評級 |

**說明**：

- **審查者 / 事實查證**：`buildAuditorPromptWith*`、`buildP1Step2AuditorPrompt`、`buildP3AuditorPrompt` 內含「原始資料區塊」設計（財務數據、master_candidates、p1_financial_report_data、p2_evidence、p2_5_data、technical_indicators、snapshot_diff 等），遷移時須保留結構與欄位對應。
- **批次規則**：P2/P3/P2.5 的批次 Header 與 `<<<COMPANY: TICKER>>>` 等分隔規則需一併搬移。
- **系統級區塊**：憲法六條、DSFP 全域塊（GLOBAL_SYSTEM_BLOCK_DSFP_V1）、各 Phase 加強塊、角色校準器、未來對齊三問，在 GAS 中散落於各 `build*Prompt` 開頭或 M0 注入處，Python 須集中管理並可選注入。

---

## 三、SSOT 中已記載的 Prompt 相關要點（遷移時須對齊）

- **憲法六條**：未來可驗證、未來優先、市場視角高於真相、因果鏈完整性、反敘事義務、角色即主力。各 Phase Prompt 不得抵觸。
- **DSFP**：GLOBAL_SYSTEM_BLOCK_DSFP_V1 及各 Phase 加強塊（P0 INDUSTRY_STATE_SNAPSHOT、P0.5 STRUCTURE_ROLE/FLOW_SENSITIVITY、P1 Step1/Step2、P2-1/P2-2、P3 DISTORTION_RISK、Daily 只標記等），見 SSOT「DSFP 五模組與全 Phase 植入規範」。
- **Hermes 4 / 405B**：所有 Hermes 4 調用須 `include_reasoning: true`，`<think>` 內容存入 `reasoning_trace`（SSOT V8.36）。
- **o3 成本優化**：Prompt 改為「下列檢查已由系統完成，請基於已通過的輸入做分析」；不在 Prompt 內塞入整份 schema/範圍/引用讓 o3 重跑（見工程備忘錄與 o3 成本優化討論總結）。
- **各階段 Prompt 補強參考**：`各階段Prompt補強參考_2026-01-26.md` 內表格（角色、任務、禁止項、Scout/Deep Auditor、WB-1/WB-2/W-A）需與 GAS 內文對齊後一併遷移。
- **P3 週線/日線分區**：`[WEEKLY_CHART]`（約 50 週）、`[DAILY_CHART]`（約 60 日），週線派發/日線吸籌 Bull Trap 否決規則。
- **P5 雙層**：P5-B 基準權重、MISSION_CONSTRAINTS、learning_feedback；P5-A P6 頻率趨勢、Delta Pack 關鍵訊號、硬約束覆寫說明。

---

## 四、遷移檢查清單（Python 實作時逐項打勾）

- [ ] 已從 GAS 抽出上述 36 個（類）Prompt/審查者函數的**完整正文**，並存入 Python 專案（建議：`prompts/` 或 `phases/*/prompts.py`）。
- [ ] 憲法、DSFP 全域塊、角色校準器、未來對齊三問已集中管理，並可依 Phase 注入。
- [ ] 審查者類 Prompt 的「原始資料區塊」與輸入欄位對應已實現，且與 M0/Phase 輸出結構一致。
- [ ] P2/P3/P2.5 批次 Header 與分隔規則已實現。
- [ ] Hermes 4 調用處皆開啟 `include_reasoning`，並將 reasoning 存入 `reasoning_trace`。
- [ ] o3 用處已改為「系統已完成檢查」版 Prompt，無重複 schema/範圍檢查。
- [ ] `各階段Prompt補強參考_2026-01-26.md` 與 GAS 差異已審閱，必要處已更新 SSOT 或 Python 註解。
- [ ] 所有 Prompt 正文已納入版控，且可在 CI/文檔中列出清單，避免遺漏。

---

## 五、結論與建議

- **目前 SSOT 為摘要**：完整 Prompt 與詳細架構確實在 GAS 程式碼中；改寫成 Python 時若只依 SSOT 重寫，**會遺漏**大量正文與區塊設計。
- **建議做法**：  
  1) 依本報告第二節清單，逐檔打開 `gas_archive/src/` 對應 .js，複製每個 `build*Prompt` / `build*Auditor*` 的**完整字串**到 Python 專案。  
  2) 在 Python 中建立「Prompt 註冊表」（函數名 ↔ 檔案路徑 ↔ Phase），方便日後對照 SSOT 與文檔。  
  3) 遷移完成後用本報告第四節檢查清單做一次全勾，並在 SSOT 或工程備忘錄中註記「Prompt 已由 GAS 全量對照搬移」。

完成以上步驟後，**Prompt 與詳細架構可無遺漏搬移至 Python**。

---

## 六、對齊與銜接（必讀）

修改時須同時符合 **`Prompt對齊與銜接原則_2026-01-26.md`**：

- **承襲舊版 GAS**：以 GAS 內完整字串為基底，不憑 SSOT 摘要重寫。
- **對齊憲法與架構**：憲法六條、DSFP、史官鐵律、程式算 vs AI 判讀、Hermes 4 reasoning_trace 等須融入或不得抵觸。
- **不遺漏既有功能**：任務描述、輸出欄位、禁止項、原始資料區塊、批次規則一律保留；僅在與憲法/新架構明確牴觸時才刪減並記錄理由。
- **以最新內容增強**：SSOT/工程備忘錄中的補強版（如 P2 Runway、P4 數學負責、P3 週線/日線、P5 基準權重與 MISSION_CONSTRAINTS、o3 系統已完成檢查）應整合進 Prompt。
- **前後銜接**：上游數據欄位、批次規則、審查者原始資料 key、同 Phase 多步驟、硬約束與學習記憶結構須一致。
- **最高目標與產出精準**：各 Phase 最高目標與產出格式/必填欄位/驗證窗口須對齊，產出可驗證。

詳見該文件第三、四節的銜接檢查要點與最高目標/產出精準要點。
