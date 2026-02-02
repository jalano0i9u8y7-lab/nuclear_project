# GAS 妥協清算與 Python 重建工程備忘錄（待定案）

**狀態**：待討論定案；定案後正式更新 SSOT 並將本備忘錄列為 Python 重建之依循文件。  
**原則**：本次 Python 版本為「架構重建」，不是語法翻譯。所有因 GAS 限制造成的妥協、簡化、分段、延遲、非同步 workaround，必須視為技術債並清除，不得原樣複製。  
**最重要的一句話**：我們不是把舊房子搬到新地基，我們是把地基換成鋼筋混凝土。

**對應 SSOT**：`V8.0架構定案文檔_SSOT.md`（V8.30 WB-1/WB-2/W-A、V8.32 DSFP、M0/Batch/可重入/數據源/Validator 等）

---

## Python 開發標準流程（不遺漏）⭐ 寫 Python 時必須按此執行

**目的**：之後寫 Python 時按標準流程執行，不遺漏 SSOT 更新、Prompt 搬移、缺口對照、數據白名單與來源對齊。

### 步驟一：設計與 SSOT 對齊

1. 確認本功能在 SSOT 中的章節與原則（憲法、DSFP、史官鐵律、Layer 1/2/3、Daily 最高目標等）。
2. 若有待定案討論（如 `P2.5與Daily_Weekly微調討論整理_待定案.md`），須等用戶定案並更新 SSOT 後再實作對應模組。
3. 對照《SSOT細節缺口與遷移備忘錄》與《Daily每日蒐集清單與白名單_SSOT級》確認該模組涉及的數據、表結構、閾值、觸發條件。

### 步驟二：Prompt 與舊碼對照

1. 依《Prompt遷移確認報告_GAS至Python_2026-01-26.md》清單，找出該 Phase 對應的 `build*Prompt` / `build*Auditor*`。
2. 從 **gas_archive/src/** 對應 .js 複製**完整 Prompt 正文**到 Python 專案（不憑 SSOT 摘要重寫）。
3. 依《Prompt對齊與銜接原則_2026-01-26.md》做憲法/DSFP/史官/銜接/最高目標檢查與增強。

### 步驟三：缺口備忘錄與舊程式碼再對照

1. 依《SSOT細節缺口與遷移備忘錄_2026-01-26.md》中該模組相關段落，檢查表結構、公式、閾值、狀態機、觸發條件、錯誤處理、配置。
2. **正式寫程式時仍須將舊程式碼（gas_archive/src/）再對照一次**：備忘錄為檢查清單與索引，無法涵蓋每一行細節；實作前應打開對應 .js 檔逐函數/逐區塊確認，避免僅依備忘錄而遺漏邊界條件、枚舉值、fallback 順序等。
3. 若有 SSOT 未記載但舊碼有的邏輯，判斷是否為「應保留的業務規則」→ 若是，補進 SSOT 或備忘錄並實作；若為 GAS 妥協則不複製。

### 步驟四：數據來源與白名單

1. 該模組所需數據是否已列入《Daily每日蒐集清單與白名單_SSOT級_2026-01-26.md》或 SSOT「白名單數據源」。
2. **所有蒐集來源必須來自白名單**；Python 實作時選用與 SSOT 對齊的數據源（見該文「Python 數據來源選項」），並實作抽象層 + cache + fallback。
3. 不得讓 AI 模型自行搜尋數據；所有 Raw 數據由 Collector 層（程式）抓取。

### 步驟五：實作與測試

1. 依架構（任務隊列、DB、Layer 1/2/3、DSFP、P6 清除鎖等）實作；Hard Constraints 程式覆寫、審查觸發條件、Batch 失敗處理等依 SSOT/備忘錄。
2. 單元/整合測試；必要時 Golden snapshot regression、P6 Replay。
3. 每 Phase 輸出須通過 Schema 驗證；completeness + reasons 若有要求則一併產出。

### 步驟六：SSOT 與文檔更新

1. 程式變動完成後**立即更新 SSOT**（新增功能的位置、關鍵函數、實現狀態、版本標記）。
2. 若發現缺口備忘錄未列之細節，補入備忘錄或 SSOT 附錄，供後續模組參照。
3. 依 .cursorrules：SSOT 更新後若有程式變動，需執行 clasp 上傳（若仍維護 GAS）或更新 Python 專案文檔/CHANGELOG。

**檢查清單（每模組完成後打勾）**  
- [ ] SSOT 章節與原則已對照  
- [ ] Prompt 已從 GAS 完整搬移並對齊憲法/銜接  
- [ ] 缺口備忘錄已對照，且**已再對照 gas_archive/src/ 對應舊碼**  
- [ ] 數據來源為白名單且與 SSOT 一致  
- [ ] 測試通過；SSOT/備忘錄已更新  

---

## 一、討論串結論統整

### 0) 全域級：GAS 時代被迫妥協

| 主題 | GAS 妥協 | Python 可恢復/升級 |
|------|----------|---------------------|
| **0.1 執行時間與觸發器** | 6 分鐘斷頭台；任務拆碎、Trigger 串 Trigger、可重入、殭屍 Trigger | 真正 Job Queue + Worker（Redis Queue / Celery / Dramatiq 或 Cloud Tasks）；長任務原生支援；可控並行 + 每 provider 節流；任務狀態機 RUNNING/PARTIAL/RETRYING/FAILED/COMPLETED |
| **0.2 Sheets 當 DB** | 大量 I/O、競態、鎖格、欄位變更痛苦、回溯與查詢弱；GOOGLEFINANCE 非同步/#N/A/timeout、fetchGoogleFinanceSafe 土法煉鋼 | 真正 DB（Postgres/Supabase；起步可 SQLite）；snapshots/events/narratives/learning_state/orders/alerts/audit_log 全結構化；Sheets 降級為 Dashboard/手動介面；資料源抽象層 + cache + fallback；OHLCV 主來源改 yfinance/官方 API，GOOGLEFINANCE 僅 P6 快速或備援 |
| **0.3 測試、型別、版本** | 難單元/整合測試、難 staging/prod 分環境、版本易漂移 | pytest + mypy + ruff + pre-commit；Golden snapshot regression（固定 tickers + 歷史資料跑 P0–P6+Weekly 對比）；Config 分環境 dev/test/prod |
| **0.4 觀測性** | Log 難集中、難全鏈路追蹤、出錯難定位 | 全鏈路 Trace ID（每次 run 一個 run_id，所有階段打上）；Metrics（成功率、耗時、成本、token、資料完整性、fallback 次數）；告警（資料源成功率、模型 JSON 失敗率、Phase 連續重試） |

### 1) 資料層

| 主題 | GAS 妥協 | Python 可恢復/升級 |
|------|----------|---------------------|
| **1.1 完整性與一致性** | Validator 分散、難跨表一致性（如 P2 同業 vs 程式計算） | Schema 驗證 Pydantic/JSON Schema（每 Phase 輸出一律先過）；Cross-phase invariants（P2 Stage1 同業→Stage2 全數有數據或標記缺失；Delta Pack CRITICAL_SIGNALS 必出現；learning_state 須被 P5-B/WB-1 prompt 引用）；資料血緣（結論可追溯到原始新聞/財報/宏觀/價格→中間轉換→最終策略） |
| **1.2 長文本與多文件** | 大文本切段、跨段一致性靠 prompt；PDF/OCR 受限 | 財報 PDF→解析→chunking→引用對齊（頁碼/段落）→存 DB；RAG 用於引用一致性（P1-1.5 原文→P2-2 必須引用同一批）；多語/繁中斷詞、同義詞表、台股黑話、公司別名映射 |

### 2) 計算層

| 主題 | GAS 妥協 | Python 可恢復/升級 |
|------|----------|---------------------|
| **2.1 P2/P4/P6 計算** | 計算要省要快要分段；很多檢查只能簡化版 | 全量 OHLCV 指標 TA-Lib/pandas-ta（一致性與可重現）；風險引擎 P4 可插拔：rolling correlation + stress correlation、VaR/ES 監控；資料品質數學檢查：Infinity/NaN、除以零、單位錯、幣別錯、時間序錯位 |

### 3) AI 層

| 主題 | GAS 妥協 | Python 可恢復/升級 |
|------|----------|---------------------|
| **3.1 Weekly 拆分** | Weekly B 裝太多：整合、判讀、學習、決策、輸出；一次 prompt 太長、品質不穩 | 直接對齊 SSOT V8.30：**WB-1** 世界觀/DSFP 判讀/觸發；**WB-2** 在既定框架下策略/掛單；若 WB-1 觸發→o3 重建→WB-2 在新框架下產出；不再把「判讀世界」和「下單」塞同一段 prompt |
| **3.2 Hard Constraints** | 硬約束靠 prompt，缺程式層 enforce & explain；AI 輸出怪東西難機械修正 | Hard Constraints 一律程式覆寫：AI 提案→程式檢查→不合格則自動降級（如 MOMENTUM_BUY→TRAP_ALERT）或 re-run with constraint violation report；每次覆寫寫入 audit_log（哪條規則、前後差異、影響資金量） |

### 4) 批次與吞吐

| 主題 | GAS 妥協 | Python 可恢復/升級 |
|------|----------|---------------------|
| **4.1 Batch** | 概念上做，工程上被 trigger 和 sheet I/O 拖死 | Provider-level batch adapter（OpenAI/xAI/Gemini batch）；每家 provider 一個 queue + rate limiter；分層優先級隊列：P6 emergency > Daily > Weekly1 > Weekly2 > Monthly/Quarterly；輸出先行（partial + completeness flag） |

### 5) P6 盤中

| 主題 | GAS 妥協 | Python 可恢復/升級 |
|------|----------|---------------------|
| **5.1 時間驅動與即時** | time-driven trigger 不穩、延遲、易漏；通知不即時 | 真正排程器 cron + APScheduler + 持久化 job store；事件驅動：價格異常→寫 alerts→推播（Line/Telegram/Email）；盤中快照持久化、回放（replay）驗證規則 |

### 6) DSFP 從口號變向量

| 主題 | GAS 妥協 | Python 可恢復/升級 |
|------|----------|---------------------|
| **6.1 DSFP State Vector** | 只能寫在 Prompt 裡 | 機器可計算狀態向量：price_position_score、liquidity_state、derivatives_density_proxy、participant_proxy、rules_mechanics_flags；Daily 更新 DSFP raw；Weekly1 給出「此資產是哪一個版本的自己」；Weekly2 嚴格在此框架下下單；所有 Phase 共用同一份 DSFP |

### 7) 安全性與供應鏈

| 主題 | GAS 妥協 | Python 可恢復/升級 |
|------|----------|---------------------|
| **7.1** | Secrets 管理弱、審計弱、權限分離弱 | Secrets：GitHub Secrets + KMS/Secret Manager；權限最小化（資料源 API key、交易 API key、模型 key 分開）；審計：每次下單 DSL 生成過程可追溯（哪個模型、哪個 snapshot） |

### 8) 易忽略但必恢復

- **回測/模擬框架（Strategy Sandbox）**：規則回歸測試（同樣輸入是否同樣輸出）。  
- **可重現性**：同一 snapshot + 同一 prompt + 同一模型設定 → 可重現。  
- **資料源健康度儀表板**：匯率源失效、新聞源重複、provider latency 爆炸。  
- **錯誤分類（Error Taxonomy）**：資料缺失、解析失敗、模型 JSON 壞、推理不一致、硬約束覆寫…可統計。  
- **「部分完成」正式化**：每個 Phase 輸出 completeness + reasons，避免半套成功半套失敗不知哪裡不完整。

---

## 二、與現有 SSOT / 程式設計比對

### 已對齊或已部分實現（Python 時可強化，非從零開始）

| 項目 | 現有 SSOT/實現 | 比對結果 |
|------|----------------|----------|
| **M0 統一調用 / Job 隊列** | 所有 AI 經 M0__JOB_QUEUE、M0_Execute()；Batch 抽象層、Provider Adapter | ✅ 概念已有；GAS 無真正 Queue/Worker，Python 改為 Redis/Celery/Cloud Tasks + 狀態機 |
| **Batch API** | 適用 Phase 預設 Batch、內部 Batch Job Schema、50% 成本折扣 | ✅ 設計已有；GAS 被 6 分鐘與 Sheet I/O 拖累，Python 可真正並行 + 每 provider rate limiter |
| **可重入設計** | P1 財報、P5 Weekly 可重入（分段、state 保存、續跑）；地雷修復「6 分鐘斷頭台」「殭屍 Trigger 清掃」 | ✅ 已實現；Python 可改為長任務單次執行或自訂分段，不再依賴 Trigger 串接 |
| **Validator** | P5-B Validator（Schema/Range/Rule/Drift）；P2 兩階段、P4 Safety_Score 等 | ✅ 已有；Python 改為 Pydantic/JSON Schema 每 Phase 必過 + cross-phase invariants |
| **Delta Pack** | 變動三層 Market/Sector/Stock、What/Why/So what；CRITICAL_SIGNALS 補強（V8.19） | ✅ 已有；Python 強制 CRITICAL_SIGNALS 必出現（含 UNCHANGED） |
| **Learning 斷鏈修復** | learning_feedback 寫入並在 P5-B/P5-A Prompt 引用 | ✅ 已修復；Python 強制 learning_state 被 WB-1 引用 + feedback loop 正式化 |
| **Weekly 拆分** | V8.30 WB-1/WB-2/W-A 定案（世界觀判讀 vs 策略產出） | ✅ SSOT 已定；GAS 仍為 P5-B/P5-A 單體，Python 直接實現 WB-1/WB-2/W-A |
| **DSFP** | V8.32 定案（五模組、身份裁決、WB-1 執行層） | ✅ SSOT 已定；GAS 僅 Prompt 層，Python 做 DSFP State Vector 可計算 + 全 Phase 共用 |
| **數據源** | 白名單、GOOGLEFINANCE 整合、stooq 備援、fetchGoogleFinanceSafe | ✅ 策略已有；Python 主來源改 yfinance/官方 API，GOOGLEFINANCE 僅 P6 或備援，並做資料源抽象層 + cache + fallback |
| **P6** | 盤中監測、緊急退出、20 分鐘動能追蹤、Milestone 觸發 | ✅ 設計已有；GAS time trigger 不穩，Python 做真正排程 + 事件驅動 + 回放 |
| **Hard Constraints / 三層決策** | 硬約束/軟引導/自由空間；V8.19 三層決策架構 | ✅ 已有；Python 硬約束一律程式覆寫 + audit_log |

### 目前 SSOT/實現不足或未明文化（須在 Python 備忘錄中補齊）

| 項目 | 現狀 | 須強化/優化 |
|------|------|--------------|
| **run_id / trace_id** | SSOT 未見全鏈路 run_id、trace_id | Python 必做：每次 run 一個 run_id，所有階段打上，全鏈路追蹤 |
| **觀測性與告警** | 無集中 Log、Metrics、告警門檻 | Python 必做：成功率、耗時、成本、token、fallback 次數、資料源健康度、告警 |
| **資料血緣（lineage）** | 未明文化 | Python 必做：結論可追溯到原始數據→轉換→策略 |
| **Golden snapshot regression** | 未在 SSOT 寫明 | Python 必做：固定 tickers + 歷史資料跑全鏈，對比輸出 |
| **Replay（P6 回放）** | 未在 SSOT 寫明 | Python 必做：拿某天盤中資料重播 P6 驗證規則 |
| **completeness 輸出** | 未要求每 Phase 輸出 completeness + reasons | Python 必做：部分完成正式化，避免半套成功不知不完整 |
| **Error Taxonomy** | 未分類統計 | Python 必做：資料缺失、解析失敗、JSON 壞、硬約束覆寫等可統計 |
| **Secrets / 審計** | SSOT 未單獨章節 | Python 必做：Secrets 管理、權限分離、下單 DSL 生成可追溯 |
| **DB 取代 Sheets** | SSOT 仍以 Sheets 表名為核心存儲 | Python 必做：Postgres/SQLite/Supabase 為核心；Sheets 僅 Dashboard/手動 |
| **DSFP State Vector 結構** | DSFP 為五模組與裁決規則，無機器可算「向量」欄位定義 | Python 必做：新增 price_position_score、liquidity_state、derivatives_density_proxy、participant_proxy、rules_mechanics_flags 等欄位與寫入/讀取介面 |

---

## 三、須強化與優化的部分（清單）

### 執行層

1. **Job Queue + Worker**：以 Redis Queue / Celery / Dramatiq 或 Cloud Tasks 取代 GAS Trigger 串接；任務狀態機 RUNNING/PARTIAL/RETRYING/FAILED/COMPLETED。  
2. **長任務**：Monthly/Quarterly 全跑、P0.7 模擬、P5 Weekly 全面整合可一次跑到完（或自訂分段，不再因 6 分鐘切段）。  
3. **並行與節流**：對上百檔 concurrency + 每 provider 一個 rate limiter。  
4. **分層優先級隊列**：P6 emergency > Daily > Weekly1 > Weekly2 > Monthly/Quarterly。

### 資料層

5. **核心 DB**：Postgres/Supabase（或起步 SQLite）；snapshots、events、narratives、learning_state、orders、alerts、audit_log 全結構化；Sheets 僅 Dashboard/手動介面。  
6. **資料源抽象層**：price/macros/news/filings/earnings/calendar 各自接口 + cache + fallback；主 OHLCV 改 yfinance/官方 API，GOOGLEFINANCE 僅 P6 或備援。  
7. **Schema 與 Cross-phase invariants**：每 Phase 輸出 Pydantic/JSON Schema 驗證；P2 Stage1→Stage2、Delta Pack CRITICAL_SIGNALS、learning_state 引用等跨階段不變量。  
8. **資料血緣**：結論可追溯到原始新聞/財報/宏觀/價格→中間轉換→最終策略。  
9. **文件管線**：財報 PDF→解析→chunking→引用對齊→存 DB；P1-1.5 原文與 P2-2 引用一致性。

### 計算層

10. **全量指標與風險**：TA-Lib/pandas-ta、rolling/stress correlation、VaR/ES 監控；資料品質數學檢查（Infinity/NaN、除以零、單位/幣別/時間序錯位）。  
11. **P4 風險引擎可插拔**：相關性鎖擴充、VaR/ES 監控。

### AI 層

12. **Weekly 拆分落地**：依 SSOT V8.30 實現 WB-1（世界觀/DSFP/觸發）與 WB-2（策略/掛單）；若觸發則 o3 重建後 WB-2 再產出。  
13. **Hard Constraints 程式覆寫**：AI 提案→程式檢查→不合格則自動降級或 re-run with violation report；每次覆寫寫入 audit_log。  
14. **DSFP State Vector**：可計算欄位（price_position_score、liquidity_state、derivatives_density_proxy、participant_proxy、rules_mechanics_flags）；Daily 更新 raw；Weekly1 產出身份判定；Weekly2 與各 Phase 共用同一份。

### 觀測、測試、安全

15. **run_id / trace_id**：每次 run 唯一 ID，全階段打上，全鏈路追蹤。  
16. **Metrics 與告警**：成功率、耗時、成本、token、fallback、資料源健康度；告警門檻（資料源成功率、模型 JSON 失敗率、Phase 連續重試）。  
17. **Golden snapshot regression**：固定 tickers + 歷史資料跑 P0–P6+Weekly，對比輸出。  
18. **Replay**：P6 盤中資料重播驗證規則。  
19. **Error Taxonomy**：資料缺失、解析失敗、JSON 壞、推理不一致、硬約束覆寫等可統計。  
20. **completeness**：每 Phase 輸出 completeness + reasons。  
21. **Secrets 與審計**：Secrets 管理、權限分離、下單 DSL 生成可追溯（模型、snapshot）。  
22. **pytest + mypy + ruff + pre-commit**；Config 分環境 dev/test/prod。

### P6

23. **排程與事件驅動**：cron + APScheduler + 持久化 job store；價格異常→alerts→推播（Line/Telegram/Email）；盤中快照持久化與回放。

---

## 架構提前納入檢查（SSOT V8.36 最終審查報告定案）

**說明**：以下四點為「你一定要提前納入架構」的項目；實作時必須一次到位，否則後續重構成本極高。

### 1) Hermes 4 輸出表須含 reasoning_trace（影響 DB schema）

- **snapshots / ai_outputs / strategy_executions** 須有：
  - `final_answer`（熱：摘要/短）
  - `reasoning_trace`（冷：可存 R2 或 TEXT，索引須能追到）
  - `storage_key`（若 reasoning_trace 存冷儲存，指標指向冷檔案）
  - `model_name` + `include_reasoning`（可稽核）
- **M0 Adapter** 須有「think 抽取器」（Parser）與「禁止 OpenRouter 過濾 think」的保護
- 若沒做：花錢買白箱結果白箱被丟掉；Debug / 風控追溯能力直接少一半

### 2) Weekly 目標架構為 WB-1 / WB-2 / W-A（非 P5-A/P5-B）

- **資料模型**須支援 `worldview_version`、`identity_context`
- **Order DSL** 須帶此兩欄位（WB-2 每個 order 須引用）
- **Weekly pipeline** 須支援「條件式重跑範圍」（escalation → P1–P4，不含 P0）
- 須用**任務圖/狀態機**寫法，不得硬寫死 P5 流水線

### 3) P6 資料保留/清除規則（業務規則，非通用 cron）

- **P6 表**須區分「一般監測」vs「異常需保留」（至少 flag）
- **清除對象**：僅 P6 產出之一般監測數據，**不包含**已寫入共用 OHLCV 表的資料
- **清除時機**：**本週策略產出完成後**，才允許清除上週一般數據；須有**清除鎖**（Weekly 完成 → 解鎖 → 才執行清除）
- **不得**用 cron 亂刪（如「30 天搬 R2」那種通用清理會違反 SSOT 業務規則）

### 4) DSFP 為全域規則，產物須能被下游引用

- `world_state_snapshot`、`asset_identity_map`、`narrative_map` 等 WB-1 產物須能存（熱索引 + 冷內容）
- **DB 須有「worldview / identity」類型的 snapshot 分支**
- WB-2 下單時須讀這些身份裁決，並寫進每筆 order 的 `identity_context`

### 問題 A：最小表結構缺少 reasoning_trace

**修正**：ai_outputs / strategy_executions 須有 `final_answer`、`reasoning_trace`、`storage_key`、`model_name`、`include_reasoning`；詳見第五節 Hermes 4 實作指南。

### 問題 B：P6 清除邏輯不能只靠通用清理

**修正**：P6 retention 須為**業務規則**：Weekly 完成 → 才觸發刪除上週一般數據；詳見 SSOT P6 數據保留規則。

---

## 四、o3 成本優化：省「隱形思考」tokens 三招（完全不犧牲品質）

**背景**：o3 的 reasoning（隱形思考）全部計入 output tokens 費用；目標是「不降品質、不降思考深度」下省這些 token。

---

### 4.1 招式 A：Prompt Caching（降 input 成本）

**原理**：將「長且每檔重複」的內容放在**固定前綴**（system / 固定 developer message），變動內容放後段；OpenAI 對 o3 支援 prompt caching（>1024 tokens 以 128 token 為單位自動 cache，cached input 約 50% 折扣）。

**適用場景**：P1-2 到 P5（每檔個股）、D1-4（每則新聞/每檔索引）都是**重複 prompt 呼叫 100 次**，固定前綴必須 cache。

**實作要點**：
- **固定前綴**（可 cache）：SSOT / Phase rules / 評分標準 / schema / 硬約束條文
- **變動內容**（per-request）：delta pack / ticker 事實 / 新聞片段 id / 當次 snapshot
- **關鍵**：固定前綴須**完全一致**（同一 batch/run 內不可變動），才能多檔吃到 cache
- **邊界**：**Scout/Deep Auditor 的 context 不可省**（省掉 = 降品質），但固定規則仍可 cache

**品質影響**：無（同一內容，只改結構）

---

### 4.2 招式 B：Batch API（降整單成本）

**原理**：OpenAI Batch API 提供 50% 折扣（input + output 含 reasoning tokens）；非同步執行（24h 內完成）。

**適用場景**：o3 batch 已用於：P2-2 Scout、P2.5、P3、WB-2 Scout；所有「每檔獨立 + 不需即時」的任務。

**品質影響**：無（同一模型、同一 prompt，僅非同步）

---

### 4.3 招式 C：程式前置裁剪（降 o3 reasoning 體積）

**原理**：不是用程式取代分析，而是用程式砍掉「o3 在腦中重跑規則引擎」的負擔；讓 o3 的推理**變短、變聚焦**（少很多「檢查邊界、執行規則」的分支），但**不減分析深度**。

**邊界（關鍵）**：
- ✅ **可移走**：確定性檢查 + 已寫死規則（純公式運算 + 格式檢查）
- ❌ **不可移走**：需判斷、需語義理解的項目

---

#### 4.3.1 可程式前置的清單（完全不影響品質）

| 項目 | 可程式化？ | 說明 |
|------|-----------|------|
| **Schema / 範圍檢查** | ✅ 是 | JSON 欄位/型態、0-100、權重總和、position_cap ≤ max_allowed |
| **NaN/Inf/除零** | ✅ 是 | 數學邊界檢查 |
| **Hard Caps** | ✅ 是 | CFO < 0 → cap 59；runway < 4 → cap 55（SSOT 已有）；結果寫 audit_log |
| **P2 Stage 2 相對位置** | ✅ 是 | 程式從**權威網站**抓同業數據（AI 只給「應該比誰」的判斷）→ 程式算排名/百分位 |
| **Evidence_id 格式檢查** | ✅ 是 | 檢查引用的 id 是否在 DB/snapshot 中（格式存在性檢查） |
| **Kill switch / defcon 觸發** | ✅ 是 | `defcon=1` / `emergencyExit=TRUE` → 程式直接執行，不需 o3 推理 |
| **規則優先權（已寫死）** | ✅ 是 | 例如「風控 > 市場氣候」→ 程式先裁掉違反項，o3 只處理「無法形式化」的衝突 |

---

#### 4.3.2 不可程式前置的清單（會降品質）

| 項目 | 為何不可？ |
|------|-----------|
| **同業分類是否正確** | 判定「龍頭 vs 中大型 vs 新創」需 AI 推理（規模、市占、業務成熟度），不是公式 |
| **引用邏輯是否合理** | 「這個引用合不合理/會不會跨期」需**語義理解**，程式抓不出來（timestamp 範圍檢查只是格式，不是邏輯） |
| **是否假突破 / identity drift / escalation** | 全是判斷，不是公式 |
| **Scout/Deep Auditor 的 prompt 與 context** | 省掉 = 降品質；Scout 需要完整 context（原始資料 + Analyst 輸出）才能補強視角 |

---

#### 4.3.3 實作要點

1. **執行順序**：在**呼叫 o3 前**跑完所有「可程式化」檢查（Schema / 範圍 / Hard Caps / Kill switch 等）
2. **Prompt 調整**：改為「下列檢查已由系統完成，請基於已通過的輸入做分析」；**不要**在 prompt 裡塞一整份「請你先檢查 schema/範圍/引用」讓 o3 重跑
3. **品質紅線**：Scout/Deep Auditor 需要完整 context，固定規則可 cache，但變動 context 不能省

---

### 4.4 總結：三招並用，邊界嚴守

| 招式 | 省的是 | 品質影響 | 優先順序 |
|------|--------|----------|----------|
| **A. Prompt Caching** | Input（固定前綴約 50% 折扣） | 無 | 高（P1-5 每檔重複，效益最大） |
| **B. Batch API** | 整單（input + output 含 reasoning 約 50% 折扣） | 無 | 高（已定案，立刻有效） |
| **C. 程式前置裁剪** | Reasoning 體積（o3 少跑規則引擎分支） | 無（前提：只移確定性檢查） | 中（需確保邊界，部分已實現） |

**強制原則**：
- 省成本的方法必須建立在**完全不影響品質**的大前提下
- 任何會影響輸出品質的省成本方式**絕對不可照做**
- 程式只做「純公式運算 + 格式存在性檢查 + 已寫死規則執行」，其餘全留給 AI

---

## 五、Hermes 4 思考過程強制回傳與保存（實作指南）

**原則**：Hermes 4 會顯示思考過程，且**這些思考全部計費**。既然每一分錢都花在 Token 上，不把它的「大腦切片（思考過程）」存下來簡直是浪費。Hermes 4 相比 OpenAI o3 的優勢：**OpenAI 是「付費買黑箱」，Hermes 4 是「付費買白箱」。**

### 4.1 原理說明

Hermes 4 的輸出通常是一個完整字串，結構如下；**需做兩件事**：(1) **API 端**：告訴 OpenRouter 不要過濾掉 `<think>` 標籤；(2) **程式端**：Parser 把 `<think>` 內內容切出存進 DB 的 `reasoning_trace`，其餘存 `final_answer` 傳給下游。

```xml
<think>
這裡開始是思考過程...
1. 分析使用者需求...
2. 檢查 P4 資金公式...
3. 發現風險係數過高...
</think>
根據上述分析，建議本週資金配置為...
```

### 4.2 Python 實作（M0 模組）

#### 步驟 A：呼叫 API（Payload 設定）

經 OpenRouter 呼叫時加上 `include_reasoning`，確保完整回傳思考過程。

```python
payload = {
    "model": "nousresearch/hermes-4-405b",
    "messages": messages,
    "include_reasoning": True,  # 關鍵：完整回傳 <think> 標籤
    # 備用：有些 Provider 需要
    "provider": { "reasoning": "true" }
}
```

#### 步驟 B：清洗與分流（Parser）

拿到回應後先解析再給下游：用 Regex 抓取 `<think>...</think>` 內內容，存入 `reasoning_trace`；移除後剩餘為 `final_answer`。

```python
import re

def parse_hermes_response(raw_content):
    think_match = re.search(r"<think>(.*?)</think>", raw_content, re.DOTALL)
    if think_match:
        reasoning_trace = think_match.group(1).strip()
        final_answer = re.sub(r"<think>.*?</think>", "", raw_content, flags=re.DOTALL).strip()
    else:
        reasoning_trace = None
        final_answer = raw_content.strip()
    return { "reasoning_trace": reasoning_trace, "final_answer": final_answer }
```

### 4.3 資料庫設計建議（PostgreSQL / Supabase）

**Table: `strategy_executions`（策略執行紀錄表）**

| 欄位名稱 | 型態 | 用途 |
| --- | --- | --- |
| `id` | UUID | 主鍵 |
| `phase` | VARCHAR | P3 / P4 / P5 |
| `input_snapshot` | JSONB | 當時餵給 AI 的資料 |
| **`reasoning_trace`** | **TEXT** | **AI 思考過程（<think> 內容）** |
| `final_output` | JSONB | 最終產出的決策/JSON |
| `token_usage` | JSON | 紀錄花費 |

### 4.4 戰略意義（為何必存）

1. **P4 風控黑盒解密**：系統建議「全倉做空 NVDA」時，查 `reasoning_trace` 可見 AI 寫「檢測到 P2.5 內部人大量拋售、P6 連續急殺…」，才敢執行。
2. **Debug 邏輯死鎖**：P5 輸出格式一直錯時，看 Trace 發現「這裡應輸出 A 但 System Prompt 禁止 A…」→ 可知是 Prompt 打架。
3. **未來微調**：累積大量 Hermes 4 高品質思考路徑，可訓練自有小模型（7B/8B），成本約 1/100。

---

### 4.5 三大應用場景：稽核、回溯、訓練

#### 4.5.1 稽核（Audit）：黑盒解密與決策透明化

**目標**：當策略結果不符預期時，可追溯 AI 的完整思考路徑。

**實作方式**：

```python
# 稽核查詢範例：P4 風控為何否決某標的
def audit_p4_rejection(ticker, week_id):
    """
    查詢某週 P4 為何否決某標的
    """
    record = db.query("""
        SELECT 
            reasoning_trace,
            final_answer,
            phase_id,
            created_at
        FROM strategy_executions
        WHERE phase_id = 'P4'
          AND week_id = ?
          AND ticker = ?
    """, week_id, ticker)
    
    # 解析思考過程
    if record.reasoning_trace:
        print(f"[P4 思考過程]\n{record.reasoning_trace}")
        # 可進一步做關鍵詞提取：
        # - 觸發了哪些風控規則（correlation, drawdown, concentration）
        # - AI 是否有「掙扎」（先說可以，後來說不行）
        # - 是否引用了 Learning State 的歷史教訓
    
    print(f"[P4 最終決策]\n{record.final_answer}")
    
    return record

# 稽核場景：
# 1. **P4 風控黑盒解密**：為何某標的被否決？是因為相關性、回撤、集中度？
# 2. **P3 技術面誤判**：為何 AI 判讀為突破但實際是假突破?
# 3. **WB-1 世界觀漂移**：為何 AI 認為市場氣候從 RECOVERY 轉 RECESSION？
```

**稽核儀表板（建議）**：
- **決策路徑可視化**：將 `reasoning_trace` 解析為結構化步驟（例如：Step 1: 檢查相關性 → Step 2: 計算風險分數 → Step 3: 判定是否超限）
- **規則引用統計**：哪些風控規則最常被觸發？
- **異常決策標記**：AI 思考過程中出現 "I'm not sure" / "This is unusual" 等關鍵詞時自動標記。

---

#### 4.5.2 回溯（Debug）：定位邏輯死鎖與循環依賴

**目標**：當系統陷入重複錯誤（例如連續三週否決同一標的，或 Learning State 振盪）時，可追溯完整思考鏈。

**實作方式**：

```python
# 回溯查詢範例：Learning State 為何振盪
def debug_learning_state_oscillation(ticker):
    """
    查詢某標的的 Learning State 調整歷史與對應的 AI 思考過程
    """
    records = db.query("""
        SELECT 
            week_id,
            reasoning_trace,
            final_answer,
            learning_state_before,
            learning_state_after
        FROM strategy_executions
        WHERE phase_id = 'P5-B' OR phase_id = 'WB-1'
          AND ticker = ?
        ORDER BY week_id DESC
        LIMIT 10
    """, ticker)
    
    for r in records:
        print(f"\n=== Week {r.week_id} ===")
        print(f"State Before: {r.learning_state_before}")
        print(f"State After: {r.learning_state_after}")
        print(f"[AI 思考]\n{r.reasoning_trace}")
        
        # 檢查振盪模式：
        # - 權重來回調整（+0.05 → -0.05 → +0.05）
        # - AI 是否反覆提到「上週失敗」但沒有新資訊
        # - 是否出現「因為上次調整失敗，所以這次調回來」的死循環
    
    return records

# 回溯場景：
# 1. **Learning State 振盪**：AI 來回調整同一標的權重，陷入「反射弧循環」
# 2. **P2-2 因果推演跳躍**：為何 AI 從「營收成長」直接跳到「嚴重風險」？
# 3. **WB-1/WB-2 不一致**：WB-1 說「市場恐慌」，但 WB-2 卻產生激進配置
```

**Debug 工具（建議）**：
- **思考路徑 Diff**：比對同一標的連續兩週的 `reasoning_trace`，找出思考模式變化
- **循環檢測**：自動掃描 `reasoning_trace` 中是否出現「因為上週...所以這週...但上週也是因為上上週...」的遞迴引用
- **數據引用完整性**：檢查 AI 是否真的讀取了 Delta Pack / Learning State（在 `reasoning_trace` 中搜尋關鍵欄位名稱）

---

#### 4.5.3 訓練（Fine-tuning / Distillation）：累積優質決策路徑

**目標**：將 Hermes 4 的高品質思考過程蒸餾（Distill）成自己的小模型，降低未來推理成本。

**資料準備**：

```python
# 訓練資料集生成範例
def prepare_finetuning_dataset():
    """
    從 reasoning_trace 提取訓練資料
    """
    # 1. 篩選「高品質決策」
    good_decisions = db.query("""
        SELECT 
            prompt_input,
            reasoning_trace,
            final_answer,
            outcome_score  -- 需事後標註：策略執行後的實際報酬率
        FROM strategy_executions
        WHERE phase_id IN ('P4', 'WB-2')
          AND outcome_score > 0.8  -- 只取表現優異的決策
          AND reasoning_trace IS NOT NULL
    """)
    
    # 2. 轉換為訓練格式 (OpenAI / Hugging Face)
    training_data = []
    for record in good_decisions:
        training_data.append({
            "messages": [
                {"role": "system", "content": "你是專業的量化投資決策助手..."},
                {"role": "user", "content": record.prompt_input},
                {"role": "assistant", "content": f"<think>{record.reasoning_trace}</think>\n{record.final_answer}"}
            ]
        })
    
    # 3. 儲存為 JSONL
    with open("hermes4_distillation_dataset.jsonl", "w") as f:
        for item in training_data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
    
    return training_data

# 訓練策略：
# Phase 1（6 個月）：累積至少 500 筆「高品質決策 + 完整思考過程」
# Phase 2（3 個月）：用 Hermes 4 資料 Fine-tune Llama 3.3 70B（或 Qwen 2.5 72B）
# Phase 3（持續）：A/B 測試 Hermes 4 vs Fine-tuned Model，逐步替換低風險模組（如 P3）
```

**訓練目標**：
1. **P3 技術面分析**：訓練小模型接手 K 線型態、支撐壓力判讀（低風險模組）
2. **P2-2 因果推演**：訓練小模型理解「營收成長 + 毛利率下降 → 價格戰風險」的推理模式
3. **WB-1 輕度更新**：訓練小模型處理「無重大事件」情境下的常規世界觀維護

**成本收益分析**：
- **當前成本**（假設）：Hermes 4 405B，每次 P4 決策約 $0.50（含思考過程）
- **訓練後**：Llama 3.3 70B（自部署或 Groq），每次約 $0.05
- **Break-even**：累積 500 筆訓練資料後，每週可節省 80% 成本（$20 → $4）

---

#### 4.5.4 資料庫設計補充

為支援上述三大場景，建議在原 `strategy_executions` 表基礎上新增：

```sql
-- 原表
CREATE TABLE strategy_executions (
    id UUID PRIMARY KEY,
    phase_id VARCHAR(20),      -- 'P3', 'P4', 'WB-1', 'WB-2'
    ticker VARCHAR(20),
    week_id VARCHAR(20),
    prompt_input TEXT,         -- 餵給 AI 的完整 Prompt
    reasoning_trace TEXT,      -- <think>...</think> 原始內容
    final_answer TEXT,         -- 去除 <think> 後的答案
    created_at TIMESTAMP
);

-- 新增：結果標註表（用於訓練資料篩選）
CREATE TABLE strategy_outcomes (
    execution_id UUID REFERENCES strategy_executions(id),
    outcome_score FLOAT,       -- 0.0 ~ 1.0（策略執行後的實際報酬率標準化）
    outcome_type VARCHAR(20),  -- 'PROFIT', 'LOSS', 'NEUTRAL', 'AVOIDED_LOSS'
    annotated_at TIMESTAMP,
    annotator VARCHAR(50)      -- 'AUTO' / 'HUMAN_REVIEW'
);

-- 新增：思考路徑解析表（加速稽核查詢）
CREATE TABLE reasoning_analysis (
    execution_id UUID REFERENCES strategy_executions(id),
    triggered_rules JSON,      -- ["CORRELATION_LIMIT", "DRAWDOWN_ALERT"]
    key_factors JSON,          -- {"correlation": 0.85, "drawdown": -0.12}
    uncertainty_level VARCHAR(10),  -- 'LOW', 'MEDIUM', 'HIGH'（從 reasoning_trace 中提取「不確定」關鍵詞）
    parsed_at TIMESTAMP
);
```

---

### 4.6 總結指令（規格書必加）

> **「對於所有使用 Hermes 4 的模組（特別是 P3、P4、WB-1/WB-2、Deep Auditor），必須強制開啟 `include_reasoning`，並且在寫入資料庫時，務必將 `<think>` 標籤內的內容獨立提取並存入 `reasoning_trace` 欄位。這是我們未來的資產，絕對不能丟棄。」**

---

## 六、十大類 GAS 妥協清算清單（Python 必須恢復）

| 大類 | GAS 問題 | Python 必須恢復 |
|------|----------|------------------|
| **1. 執行層** | 6 分鐘斷頭台、任務拆碎、Trigger 串 Trigger、半套狀態、重入扭曲 | 任務隊列、Worker、狀態機 RUNNING/RETRY/FAILED/DONE、長任務原生支援；禁止以切段為核心、禁止以時間觸發為主邏輯 |
| **2. 資料層** | Sheets 當 DB、競態、鎖格、無結構查詢、無版本追蹤、無回溯 | Postgres/SQLite/Supabase；snapshots/narratives/alerts/learning_state；Run ID + Snapshot ID；資料血緣；Sheets 僅 Dashboard/手動，絕對不是 DB |
| **3. 資料來源** | GOOGLEFINANCE 非同步/#N/A/等待 hack/週末 timeout | 主來源 yfinance/官方 API；備援 Stooq；GOOGLEFINANCE 只限 P6 快速監控，不得當核心 |
| **4. 計算層** | 指標與數學簡化、相關性太重被放棄 | TA-Lib/pandas-ta、Rolling correlation、Z-score、VaR/ES 監控、完整 OHLCV 指標 |
| **5. AI Prompt** | Weekly B 一次塞全部、世界觀+策略+記憶+風控同一 prompt | Weekly 拆分：WB-1 世界觀/DSFP/觸發/記憶寫入；WB-2 策略/掛單；若觸發則 o3 重建後 WB-2 再輸出 |
| **6. 監控與告警** | Log 分散、難追蹤 | Trace ID、Run ID、Error taxonomy、Metrics dashboard（成功率/成本/fallback） |
| **7. 學習系統** | 記憶寫入但未被使用、學習斷鏈 | learning_state 必須被 WB-1 引用；每次策略輸出帶 feedback loop；死亡/成功案例寫入 |
| **8. P6** | Time trigger 不準、延遲、通知不即時 | 真正排程器、即時事件觸發、Replay 回放、異常資料持久化 |
| **9. DSFP** | 只能寫在 Prompt | DSFP State Vector 可計算；所有 Phase 共用同一份；Daily 更新 raw、Weekly1 判定、Weekly2 依框架下單 |
| **10. 測試** | 幾乎無回歸 | Golden Snapshot Regression、Replay 測試、Unit+Integration、Strategy Sandbox |

---

### 六附、可選優化建議（O1–O3，不進 SSOT 主文）⭐ V8.42

以下三項為檢查報告優化建議，**不寫入 SSOT 憲法**，僅列於本備忘錄供實作時可選採用：

- **O1. Delta Pack 累積變動**：若單日變動未達閾值但累積 N 日變動超過閾值（例如 VIX 連日小漲），可選納入 Delta Pack 或突變檢測；實作時可於 Delta Pack 邏輯中加「累積 N 日變動超過閾值亦納入」。
- **O2. P2-2 產業邏輯卡版本管理**：P0 季度更新時產業邏輯卡版本須可追溯；P2-2 讀取時應帶版本或時間範圍，避免月度執行用到過舊邏輯；實作時可於 P2-2 Step 0 注入時帶入 logic_card_version 或 as_of_date。
- **O3. reasoning_trace 冷熱儲存策略**：reasoning_trace 可存冷儲存（R2）或 TEXT（SSOT 已規範）；冷熱比例與成本估算為工程決策，可於本備忘錄或配置表記載（例如熱存 10%、冷存 90% 以節省成本），不必改 SSOT 主文。

---

## 七、工程師搬遷必查表（定案後勾選）

- [ ] 是否已用 DB 取代 Sheets 當核心資料庫？Sheets 是否只剩 Dashboard？  
- [ ] 是否已引入 Job Queue / Worker（取代 Trigger 串接）？  
- [ ] 是否每個 Phase 都有 schema validation + cross-phase invariants？  
- [ ] 是否每個 run 有 run_id / trace_id，且能全鏈路追蹤？  
- [ ] 是否 Provider adapter + rate limiter + retry/backoff 全部落地？  
- [ ] 是否 Weekly 已拆為 WB-1（判讀/觸發/學習）與 WB-2（策略/掛單）？  
- [ ] 是否 DSFP 已做成可計算 state vector，並被 WB-1/WB-2 使用？  
- [ ] 是否 Hard Constraints 一律程式 enforce + audit log？  
- [ ] 是否具備 replay（回放）與 golden snapshot regression 測試？  
- [ ] 是否具備 data quality dashboard + alert（成功率、延遲、fallback、成本）？  
- [ ] **Hermes 4**：是否所有 Hermes 4 呼叫皆開啟 `include_reasoning`，並將 `<think>` 內容獨立存入 `reasoning_trace`（見第五節）？  
- [ ] **o3 成本優化三招**（見第四節）：  
  - [ ] **A. Prompt Caching**：P1-5 每檔個股、D1-4 每則新聞的 prompt 是否已拆分為「固定前綴」（SSOT/rules/schema）+ 「變動內容」（delta pack/ticker 事實），且固定前綴完全一致以吃到 cache？  
  - [ ] **B. Batch API**：o3 適用場景（P2-2 Scout、P2.5、P3、WB-2 Scout）是否全部走 batch？  
  - [ ] **C. 程式前置裁剪**：Schema/範圍/Hard Caps/Kill switch/P2 Stage 2 相對位置等「可程式化檢查」是否在**呼叫 o3 前**執行，且 prompt 已調整為「下列檢查已由系統完成」（不讓 o3 重跑）？邊界是否嚴守（只移確定性檢查，不移判斷）？
- [ ] **架構提前納入檢查**（見「架構提前納入檢查」專節）：  
  - [ ] **Hermes 4 輸出表**：ai_outputs / strategy_executions 是否含 final_answer、reasoning_trace、storage_key、model_name、include_reasoning？M0 是否有 think 抽取器與禁止 OpenRouter 過濾 think？  
  - [ ] **Weekly / Order DSL**：Order DSL 是否帶 worldview_version、identity_context？Weekly pipeline 是否用任務圖/狀態機支援 escalation → P1–P4？  
  - [ ] **P6 清除鎖**：P6 是否區分「一般監測」vs「異常需保留」？清除是否依「Weekly 完成 → 解鎖 → 才清除上週」業務規則（非 cron 亂刪）？  
  - [ ] **DSFP worldview 快照**：是否有 worldview/identity 類型 snapshot 分支？WB-2 下單時是否讀並寫 identity_context？

---

## 八、給工程師的強制聲明（定案後置於文件最前）

- 本專案不是 GAS to Python 的語法轉換。  
- 所有 GAS 時代 workaround 必須視為技術債清除。  
- 若發現原邏輯因 GAS 限制而產生，Python 版本必須重設計而非翻譯。  
- 若出現 Trigger-like 或 Sheets-like 核心依賴，視為架構錯誤。  

---

**下一步**：討論定案後，將本備忘錄正式納入 SSOT 引用（如「Python 重建時依《GAS 妥協清算與 Python 重建工程備忘錄》執行」），並視需要於 SSOT 新增「Python 重建與 GAS 妥協清算」專節或附錄，列出上述須強化與優化項與十大類清單之對應關係。
