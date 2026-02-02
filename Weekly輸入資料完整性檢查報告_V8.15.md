# Weekly 輸入資料完整性檢查報告（V8.15）

## 📋 檢查目的

確保所有 Phase 的分析結論/數據快照都正確提供給 Weekly 做決策因子：
1. **確保沒有遺漏**：不要有分析或數據做了沒有用到
2. **確保都是快照**：Weekly 吃的都是快照，而非原始龐大資料（避免 100 檔股票策略爆炸）

---

## 📊 一、Phase 輸出檢查（逐 Phase 掃描）

### **P0（產業紅利敘事）** ⚠️ **部分遺漏**

#### **P0 產出（SSOT 定義）**：
- `industry_thesis`（Why must win）
- `key_drivers` / `risk_factors`
- `validation_questions` + 研究摘要
- `p0_confidence`（高/中/低）
- `thesis_validity_window`（有效期/下次重跑時間）

#### **Weekly 必須吃到的用途**：
- 變成每檔股票的「長期假設」：不然 Weekly 會只剩技術面，失去核彈計畫初衷
- 當風險訊號出現時，用來判斷「減倉是砍噪音還是砍 thesis」

#### **現有程式碼狀態**：
- ✅ **已實現**：`getLatestP0Snapshot()` 在 `24_P5_WEEKLY_DATA.js` 中
- ✅ **已傳遞**：`p0_snapshot` 在 `collectP5WeeklyAllData()` 中收集
- ✅ **已使用**：`p0_data` 在 `integrateStockFactors()` 中提取

#### **⚠️ 遺漏點 #1：P0 Thesis 引用標記**
- **問題**：Weekly Input 裡沒有明確欄位：`p0_thesis_snapshot_ref`（引用哪次 P0 結論）
- **風險**：無法追溯每檔股票的長期假設來源
- **補強**：在 `integrateStockFactors()` 中明確標記 `p0_thesis_ref`（引用 P0 snapshot_id）

---

### **P0.5（產業鏈地圖＋動態監控）** ❌ **嚴重遺漏**

#### **P0.5 產出（V8.15 定案）**：
- **A) Map（靜態）**：
  - `chain_map_nodes`（上中下游/互補/替代/受害）
  - `node_bottlenecks` / `pricing_power_nodes`
  - `company↔node mapping`（若 P1 建完後回填）
- **B) Monitor（動態，月度/季度才有）**：
  - `chain_dynamics_monitor_json`（4 區結構）
  - `signals`（8 個核心信號）
  - `state_inference`（三階段推理輸出）
  - `alerts`（供 P0.7/Weekly 使用）

#### **Weekly 必須吃到的用途**：
- 直接影響「本週風控與倉位」：例如 chain 出現上游轉弱＝提前進入 risk-off 或減碼窗口
- 與 P0.7 的週期定位互相校準（V8.15 已定案雙向接口）

#### **現有程式碼狀態**：
- ❌ **未實現**：沒有 `getLatestP0_5Snapshot()` 函數
- ❌ **未傳遞**：`collectP5WeeklyAllData()` 中沒有收集 P0.5 快照
- ❌ **未使用**：`integrateStockFactors()` 中沒有提取 P0.5 數據

#### **⚠️ 遺漏點 #2：P0.5 Monitor 結論沒有被 Weekly 消化**
- **問題**：Weekly Input 必須有：
  - `p0_5_chain_map_ref`（引用 P0.5 Map 快照）
  - `p0_5_chain_monitor_latest`（可能 null；第一次跑會沒有）
  - `p0_5_monitor_effective_date`（監控生效日期）
- **風險**：P0.5 的產業鏈動態監控結論（特別是月度/季度更新）沒有進入 Weekly 決策
- **補強**：
  1. 新增 `getLatestP0_5Snapshot()` 函數
  2. 在 `collectP5WeeklyAllData()` 中收集 `p0_5_snapshot`
  3. 在 `integrateStockFactors()` 中提取 `p0_5_data`（包含 `chain_map` 和 `chain_monitor`）

---

### **P0.7（系統動力學與時間定位）** ⚠️ **部分遺漏**

#### **P0.7 產出（SSOT 定義）**：
- `cycle_position`（Early/Mid/Late）
- `delay_map`（供給/需求延遲）
- `turning_point_risk`（拐點風險與時間窗）
- `failure_modes`（供過於求、技術替代、政策等）
- `time_window_recommendation`（持有到何時/何時開始防守）

#### **Weekly 必須吃到的用途**：
- 這是「右側動態鎖利」的時間框架，不吃就等於 P0.7 白做
- 直接影響每檔股票的：`risk_budget`、`profit_lock_aggressiveness`、`position_cap`

#### **現有程式碼狀態**：
- ✅ **已實現**：`getLatestP0_7Snapshot()` 在 `24_P5_WEEKLY_DATA.js` 中
- ✅ **已傳遞**：`p0_7_snapshot` 在 `collectP5WeeklyAllData()` 中收集
- ✅ **已使用**：`p0_7_data` 在 `integrateStockFactors()` 中提取

#### **⚠️ 遺漏點 #3：P0.7 Time Window 可機器讀格式**
- **問題**：Weekly Input 若沒有 `p0_7_dynamics_warning_ref` 與「可機器讀的 window」
- **風險**：如果 P0.7 判定現在是 "Late Cycle"（派對尾聲），P5 Weekly 調整 U（水位）和 Stop Loss（停損）時必須知道這件事，才能啟動「移動停利（Trailing Stop）」
- **補強**：
  1. P0.7 快照必須包含結構化的 `time_window_constraints`（可機器讀）
  2. Weekly 讀取 `p0_7_snapshot.cycle_position` 和 `p0_7_snapshot.turning_point_risk`
  3. 若 `cycle_position === "Late"` 或 `turning_point_risk === "HIGH"` → 觸發 Tightrope Mode

---

### **P1（產業鏈公司定位與 Tier 分級）** ✅ **完整**

#### **P1 產出（V8.14 定案）**：
- 股票池（15–30/產業面）+ `chain_role`（上中下游/互補/受害）
- `tier_S/A/B/X`（結構分級）
- `benefit_mechanism` / `hurt_mechanism`
- `confidence`（High/Med/Low）
- 財報段落證據：三欄位提取（給 P1/P2/P3 分離使用）

#### **Weekly 必須吃到的用途**：
- 決定策略預設模板：S/A 更偏「追蹤鎖利」，X 偏「風控警戒/反向觀察」
- 用於「板塊輪動」時，先動誰、後動誰的排序

#### **現有程式碼狀態**：
- ✅ **已實現**：`getLatestP1Snapshot()` 在 `24_P5_WEEKLY_DATA.js` 中
- ✅ **已傳遞**：`p1_snapshot` 在 `collectP5WeeklyAllData()` 中收集
- ✅ **已使用**：`p1_data` 在 `integrateStockFactors()` 中提取

#### **狀態**：✅ **完整。P5 Weekly 不需要看 P1 原文，看 P2 的結論即可。**

---

### **P2（同業比較＋三軸評級＋矩陣分類＋milestones）** ⚠️ **部分遺漏**

#### **P2 產出（V8.15 定案）**：
- 三軸：`safety_grade` / `growth_momentum_grade` / `future_breakout_grade` + evidence
- 六類矩陣：MOMENTUM / DIAMOND / OPTIONALITY / DEFENSIVE / HYPE_BUBBLE / REJECT
- `milestones_to_verify`（DIAMOND/OPTIONALITY 必備）
- `Runway` hard gate（Frontier）
- `Position_Role`、`Track_Type`、`Max_Position_Cap_Suggestion`
- `Time_Window_Penalty_JSON`

#### **Weekly 必須吃到的用途**：
- 策略分層的唯一依據（避免每週用昂貴模型重跑基本面）
- `milestones` 必須接到 Daily/Weekly 的追蹤與提醒（否則變成寫爽的）

#### **現有程式碼狀態**：
- ✅ **已實現**：`getLatestP2Snapshot()` 在 `06_SNAPSHOT_MANAGER.js` 中
- ✅ **已傳遞**：`p2_snapshot` 在 `collectP5WeeklyAllData()` 中收集
- ✅ **已使用**：`p2_data` 在 `integrateStockFactors()` 中提取

#### **⚠️ 遺漏點 #4：P2 Milestones 自動對帳機制**
- **問題**：P2 列出了「2025 Q3 量產」這個里程碑，但 P5 Weekly 目前的設計是「看新聞索引」，卻沒有一個明確的機制去**「主動比對」**里程碑是否達成
- **風險**：P2 說「量產才加碼」，結果新聞真的報量產了，P5 Weekly 卻因為沒去對照 P2 清單而漏掉這個加碼訊號
- **補強**：
  1. P5 Weekly 必須有一個專屬子任務：「Milestone Check」
  2. 讀取 P2 `milestones_to_verify`，去搜 P5 Daily 新聞庫
  3. 回報 MET / MISSED / PENDING
  4. 若匹配成功（Milestone Met），將 `escalation_score` 加分，觸發 P5-A 進行加碼評估

#### **⚠️ 遺漏點 #5：P2 V8.15 新增欄位未完整提取**
- **問題**：Weekly Input 若沒有：
  - `p2_position_role`（MOMENTUM / DIAMOND / OPTIONALITY / DEFENSIVE / HYPE_BUBBLE / REJECT）
  - `p2_milestones_to_verify`（驗證里程碑列表）
  - `runway_status`（Frontier Runway 狀態）
  - `time_window_penalty`（P0.7 窗口懲罰）
- **風險**：P2 的 V8.15 新架構（三軸評級、交互矩陣、驗證里程碑）沒有被 Weekly 使用
- **補強**：在 `extractStockDataFromSnapshot()` 中明確提取這些欄位

---

### **P2.5（籌碼/機構/內部人/13F）** ⚠️ **部分遺漏**

#### **P2.5 產出（V7.1 定案）**：
- `insider buy/sell` 異常
- `13F` 異常（建倉/撤退）
- `distribution risk flags`
- `confidence` + evidence pointers
- `Smart_Money_Score`

#### **Weekly 必須吃到的用途**：
- Escalation Gate（硬觸發）：`insider_selling_alert`、`abnormal_13f_distribution` → 直接觸發 P5-A
- 直接影響：降低持倉上限/提高鎖利強度/禁止加碼

#### **現有程式碼狀態**：
- ✅ **已實現**：`collectSmartMoneyDataWeekly()` 在 `24_P5_WEEKLY_CORE.js` 中
- ✅ **已傳遞**：`smartMoneyData` 在 `P5_Weekly_Execute()` 中收集
- ✅ **已使用**：`smart_money_factor` 在 `integrateStockFactors()` 中計算

#### **⚠️ 遺漏點 #6：P2.5 異常訊號的直接警報**
- **問題**：P2.5 的月度報告有這些數據，但 P5 Weekly 需要的是**「突發的異常」**（例如：本週 CEO 突然大賣股票）
- **風險**：若 Weekly Input 沒有 `p2_5_alerts_latest`（本週異常警報），只能等月度報告
- **補強**：
  1. 在 P5-B（Layer 1）的輸入向量中，必須包含一個 `P2_5_Weekly_Alert` 欄位（由 P5.3 週度數據提供）
  2. 若出現 `CEO_SELL` 或 `CLONE_FUND_BUY`，直接作為 P5-B 的 `momentum_shift` 參數因子
  3. 若 `p2_5.insider_selling_alert === true` 或 `p2_5.abnormal_13f_distribution === true` → 硬觸發 P5-A

---

### **P3（機構級預測技術面）** ⚠️ **部分遺漏**

#### **P3 產出（SSOT 定義）**：
- `regime`（趨勢/震盪/崩跌）
- `key_levels`（但不要用傳統 MA/RSI 說詞；要用你定義的主力行為與意圖）
- `scenario_1w` / `1m` / `3m`（三周期劇本）
- `trade_plan_candidates`（Buy1/2/3 & Sell1/2 生成所需的結構化輸入）
- `invalidation_levels`（錯了在哪裡）
- `liquidity/volatility markers`（用於掛單間距與風控）

#### **Weekly 必須吃到的用途**：
- 透過 Strategy Skeleton 完整傳遞（V8.15 設計）
- 但 Weekly 不一定要用最貴模型「完整重推理」才能做到

#### **現有程式碼狀態**：
- ✅ **已實現**：`getLatestP3Snapshot()` 在 `06_SNAPSHOT_MANAGER.js` 中
- ✅ **已傳遞**：`p3_snapshot` 在 `collectP5WeeklyAllData()` 中收集
- ✅ **已使用**：`p3_data` 在 `integrateStockFactors()` 中提取

#### **⚠️ 遺漏點 #7：P3 輸出結構化欄位**
- **問題**：若 P3 的輸出目前只是「文字報告」沒有結構化欄位
- **風險**：P3 不能被程式拿來自動生成掛單
- **補強**：
  1. P3 快照必須包含結構化的 `technical_results_json`（包含 `regime`、`key_levels`、`trade_plan_candidates`、`invalidation_levels`）
  2. Weekly 讀取這些結構化欄位，用於 Strategy Skeleton 生成

---

### **P4（下單策略組裝＋IB 掛單/取消）** ⚠️ **部分遺漏**

#### **P4 必須吃的輸入**：
- `current_positions`（股數/均價/核心倉比例）
- `open_orders`（未成交掛單）
- `fills_since_last_week`（上週成交）
- `cash/margin/risk_budget`（含瑞郎借款風險）
- `p3_trade_plan`（結構化）
- `p2_role`（決定模板）

#### **P4 必須輸出**：
- `orders_to_cancel[]`
- `orders_to_place[]`
- `order_conflict_check` 結果（避免買賣衝突）
- `core_position_protection`（至少保留 50% 核心倉）

#### **現有程式碼狀態**：
- ✅ **已實現**：`getLatestP4Snapshot()` 在 `06_SNAPSHOT_MANAGER.js` 中
- ✅ **已傳遞**：`p4_snapshot` 在 `collectP5WeeklyAllData()` 中收集
- ✅ **已使用**：`p4_data` 在 `integrateStockFactors()` 中提取

#### **⚠️ 遺漏點 #8：狀態更新順序不保證**
- **問題**：若 Weekly 沒有明確「先更新持倉/掛單狀態 → 再產生策略」的順序保障
- **風險**：狀態更新順序不保證，會導致策略與實際倉位不一致
- **補強**：
  1. Weekly 執行前必須先讀取 `current_positions`、`open_orders`、`fills_since_last_week`
  2. 在 `collectP5WeeklyAllData()` 中明確收集這些狀態數據
  3. 確保策略生成時使用的是最新狀態

---

### **P5 Daily/Weekly（新聞/宏觀/板塊資金流/學習系統）** ⚠️ **部分遺漏**

#### **P5 Daily/Weekly 產出（V8.12/V8.13 定案）**：
- **V8.12（已實現）**：
  - `MACRO_DATA_WEEKLY_METRICS`（Sector ETF Flow, style rotation, risk-on/off）
  - `mag7_leadership`（相對強弱/風向）
  - 個股新聞索引、板塊新聞索引、事件索引
- **V8.13（動態學習）**：
  - `LEARNING_STATE.principles_summary`（憲法）
  - `recent_reflections`（最近 4 週）
  - `similar_failure_cases`（情境喚醒）
  - `safety_lock_recommendations`（不得硬鎖但要建議）
- **財經行事曆**：
  - `macro_calendar`（FOMC, CPI, NFP…）
  - `earnings_calendar`（持股 + 板塊龍頭）
  - `options_expiration/quad_witch`（若有）

#### **現有程式碼狀態**：
- ✅ **已實現**：V8.12 優化數據（`stockNewsIndex`、`sectorNewsIndex`、`eventsIndex`、`macroWeeklyMetrics`、`technicalWeeklyMetrics`）
- ✅ **已傳遞**：在 `P5_Weekly_Execute()` 中收集並傳遞
- ✅ **已使用**：在 `integrateStockFactors()` 中使用

#### **⚠️ 遺漏點 #9：學習系統產出沒有餵回 Weekly**
- **問題**：若 Weekly Input 沒有明確把「learning memory pack」塞進去
- **風險**：學習系統產出沒有餵回 Weekly，Closed-loop 斷了
- **補強**：
  1. 在 `collectP5WeeklyAllData()` 中明確收集 `LEARNING_STATE`
  2. 在 `P5_Weekly_Execute()` 中組裝 `memoryPack`（V8.13 已部分實現，需確認完整性）
  3. 確保 `LEARNING_STATE.principles_summary`、`recent_reflections`、`similar_failure_cases`、`safety_lock_recommendations` 都被傳遞給 AI

#### **⚠️ 遺漏點 #10：重大財經行事曆整合**
- **問題**：Weekly Input 若沒有明確包含：
  - `macro_calendar`（FOMC, CPI, NFP…）
  - `earnings_calendar`（持股 + 板塊龍頭）
  - `options_expiration/quad_witch`（若有）
- **風險**：重大事件沒有被 Weekly 考慮，可能錯過重要時機
- **現有程式碼狀態**：
  - ✅ **已實現**：`18_P5_CALENDAR_MANAGER.js` 存在，有 `P5_Calendar_ScanNextTwoWeeks()` 函數
  - ❌ **未使用**：`collectP5WeeklyAllData()` 中沒有調用行事曆管理器
- **補強**：
  1. 在 `24_P5_WEEKLY_DATA.js` 的 `collectP5WeeklyAllData()` 中調用 `P5_Calendar_ScanNextTwoWeeks(new Date())`
  2. 收集 `macro_calendar`、`earnings_calendar`、`options_expiration`
  3. 將行事曆數據加入 `allData` 對象（例如：`allData.calendar = { macro: ..., earnings: ..., options: ... }`）
  4. 在 `24_P5_WEEKLY_PROMPT.js` 中將行事曆數據傳遞給 Weekly AI 作為決策因子

---

### **P6（盤中監測）** ⚠️ **部分遺漏**

#### **P6 產出（V8.0 定案）**：
- `intraday_exceptions`（本週曾觸發的異常：跳空、急殺、熔斷、異常量）
- `auto_actions_taken`（若有自動風控）
- `unresolved_alerts`（未結案事項）

#### **Weekly 必須吃到的用途**：
- 盤中異常沒有回到週策略，會重複犯錯

#### **現有程式碼狀態**：
- ⚠️ **部分實現**：P6 有記錄異常到 `P6_INTRADAY_ALERTS_DAILY`
- ❌ **未傳遞**：`collectP5WeeklyAllData()` 中沒有收集 P6 週度摘要
- ❌ **未使用**：`integrateStockFactors()` 中沒有使用 P6 數據

#### **⚠️ 遺漏點 #11：P6 週度摘要沒有進入 Weekly**
- **問題**：若 Weekly 沒有 ingest P6 weekly summary
- **風險**：盤中異常沒有回到週策略，會重複犯錯
- **現有程式碼狀態**：
  - ⚠️ **部分實現**：P6 有記錄異常到 `P6_INTRADAY_ALERTS_DAILY`（假設存在）
  - ❌ **未實現**：沒有 `getP6WeeklySummary()` 函數
  - ❌ **未傳遞**：`collectP5WeeklyAllData()` 中沒有收集 P6 週度摘要
- **補強**：
  1. 在 `24_P5_WEEKLY_DATA.js` 中新增 `getP6WeeklySummary()` 函數：
     - 從 `P6_INTRADAY_ALERTS_DAILY` 讀取本週（過去 7 天）的異常事件
     - 計算 `P6_Alert_Frequency_Trend`（本週事件數 vs 過去 4 週平均）
     - 返回 `{ weekly_events: [...], frequency_trend: {...}, alert_count: N, avg_4w: M }`
  2. 在 `collectP5WeeklyAllData()` 中收集 `p6_weekly_summary: getP6WeeklySummary()`
  3. 在 P5-B 的 `state_vector` 計算中：
     - 若 `p6_weekly_summary.frequency_trend > 2 sigma`（本週警報次數暴增）→ 調降 `volatility_regime` 分數（預防性減倉）
     - 即使技術面未跌破支撐，也要考慮盤中異常頻率上升的風險

---

## 📊 二、橫向接口檢查（跨 Phase 共用）

### **Portfolio-level 風險與保證金狀態** ⚠️ **待確認**

#### **必須包含**：
- 券商層級限制/風控（IB margin、借券、可下單股數、最小跳動）
- 匯率/利率的 regime（CHF/USD、短端利率、risk-off 會放大槓桿風險）
- 持倉分類（核心/波段/噴出）與倉位上限

#### **現有程式碼狀態**：
- ⚠️ **待確認**：需要檢查是否有收集這些數據

---

### **資料新鮮度/版本號** ⚠️ **待確認**

#### **必須包含**：
- SSOT 規則：只信最新版本
- 資料缺失處理（缺資料要降級決策、不能硬猜）

#### **現有程式碼狀態**：
- ⚠️ **待確認**：需要檢查是否有版本號檢查機制

---

## 📋 三、檢查結果總結

### **✅ 已完整實現**：
1. ✅ P1 快照讀取和使用
2. ✅ P2 快照讀取和使用（基本欄位）
3. ✅ P3 快照讀取和使用
4. ✅ P4 快照讀取和使用
5. ✅ P5 Daily 優化數據（V8.12）

### **⚠️ 部分遺漏（需要補強）**：
1. ⚠️ **P0 Thesis 引用標記**：需要明確標記 `p0_thesis_ref`
2. ⚠️ **P0.7 Time Window 可機器讀格式**：需要結構化的 `time_window_constraints`
3. ⚠️ **P2 Milestones 自動對帳機制**：需要「Milestone Check」子任務
4. ⚠️ **P2 V8.15 新增欄位未完整提取**：需要提取 `position_role`、`milestones_to_verify`、`runway_status`、`time_window_penalty`
5. ⚠️ **P2.5 異常訊號的直接警報**：需要 `P2_5_Weekly_Alert` 欄位
6. ⚠️ **P3 輸出結構化欄位**：需要確認 `technical_results_json` 是否結構化
7. ⚠️ **P4 狀態更新順序**：需要明確收集 `current_positions`、`open_orders`、`fills_since_last_week`
8. ⚠️ **學習系統產出沒有餵回 Weekly**：需要確認 `LEARNING_STATE` 是否完整傳遞
9. ⚠️ **重大財經行事曆整合**：需要從 `18_P5_CALENDAR_MANAGER.js` 讀取
10. ⚠️ **P6 週度摘要沒有進入 Weekly**：需要 `getP6WeeklySummary()` 函數

### **❌ 嚴重遺漏（必須補強）**：

#### **1. P0.5 快照完全未讀取**
- **問題**：`P0_5_SNAPSHOT_SCHEMA` 已定義（在 `01_SHEETS_STRUCTURE.js`），但沒有 `getLatestP0_5Snapshot()` 函數
- **影響**：
  - P0.5 的 `chain_dynamics_monitor_json`（包含 `p5_weekly_flags`）沒有進入 Weekly 決策
  - 產業鏈動態監控結論（月度/季度更新）無法影響 Weekly 風控與倉位
- **補強**：
  1. 在 `06_SNAPSHOT_MANAGER.js` 中新增 `getLatestP0_5Snapshot()` 函數（參考 `getLatestP0Snapshot()` 實現）
  2. 在 `24_P5_WEEKLY_DATA.js` 的 `collectP5WeeklyAllData()` 中收集 `p0_5_snapshot: getLatestP0_5Snapshot()`
  3. 在 `24_P5_WEEKLY_STOCK_STRATEGY.js` 的 `integrateStockFactors()` 中提取 `p0_5_data`（包含 `chain_map` 和 `chain_monitor`）
  4. **特別注意**：`chain_dynamics_monitor_json.handoff.p5_weekly_flags` 必須被提取並使用（例如：`LATE_CYCLE_RISK`、`DIVERGENCE_ALERT`）

#### **2. P2.5 快照完全未讀取**
- **問題**：`P2_5_SNAPSHOT_SCHEMA` 已定義（在 `01_SHEETS_STRUCTURE.js`），但沒有 `getLatestP2_5Snapshot()` 函數
- **影響**：
  - P2.5 的異常警報（`insider_selling_alert`、`abnormal_13f_distribution`）無法硬觸發 P5-A
  - 籌碼面異常（CEO 突然大賣股票、13F 異常）無法直接影響 Weekly 決策
- **補強**：
  1. 在 `06_SNAPSHOT_MANAGER.js` 中新增 `getLatestP2_5Snapshot()` 函數（參考 `getLatestP2Snapshot()` 實現）
  2. 在 `24_P5_WEEKLY_DATA.js` 的 `collectP5WeeklyAllData()` 中收集 `p2_5_snapshot: getLatestP2_5Snapshot()`
  3. 在 `24_P5_WEEKLY_STOCK_STRATEGY.js` 的 `integrateStockFactors()` 中提取 `p2_5_data`
  4. **實現 Escalation Gate 硬觸發邏輯**：
     - 在 P5-B 的 `escalation_score` 計算中，若 `p2_5.insider_selling_alert === true` 或 `p2_5.abnormal_13f_distribution === true` → 直接觸發 P5-A（`escalation_score = 1.0`，強制升級）
     - 在輸出中標記 `forced_escalation: { trigger: "P2.5", type: "INSIDER_OR_13F", confidence: "HIGH" }`

---

## 📋 四、補強優先級建議

### **Phase 1：嚴重遺漏（必須先補）**：
1. **P0.5 快照讀取**：新增 `getLatestP0_5Snapshot()`，在 `collectP5WeeklyAllData()` 中收集，在 `integrateStockFactors()` 中使用

### **Phase 2：重要補強（核心功能）**：
2. **P2 Milestones 自動對帳**：新增「Milestone Check」子任務
3. **P2 V8.15 新增欄位提取**：完整提取所有 V8.15 新增欄位
4. **P2.5 異常硬觸發**：實現 Escalation Gate 硬觸發邏輯
5. **P6 週度摘要**：新增 `getP6WeeklySummary()` 函數

### **Phase 3：優化補強（提升品質）**：
6. **P0 Thesis 引用標記**：明確標記 `p0_thesis_ref`
7. **P0.7 Time Window 結構化**：確保可機器讀格式
8. **P3 輸出結構化**：確認並補強結構化欄位
9. **P4 狀態更新順序**：明確收集狀態數據
10. **學習系統完整傳遞**：確認 `LEARNING_STATE` 完整傳遞
11. **重大財經行事曆整合**：從行事曆管理器讀取

---

## 📋 五、最終補強清單（工程實施版）

### **🔴 優先級 1：嚴重遺漏（必須先補）**

#### **1. P0.5 快照讀取與整合**
- **檔案**：`06_SNAPSHOT_MANAGER.js`、`24_P5_WEEKLY_DATA.js`、`24_P5_WEEKLY_STOCK_STRATEGY.js`
- **任務**：
  1. 新增 `getLatestP0_5Snapshot()` 函數（參考 `getLatestP0Snapshot()`）
  2. 在 `collectP5WeeklyAllData()` 中收集 `p0_5_snapshot`
  3. 在 `integrateStockFactors()` 中提取 `p0_5_data`（包含 `chain_map` 和 `chain_monitor`）
  4. 特別提取 `chain_dynamics_monitor_json.handoff.p5_weekly_flags`（例如：`LATE_CYCLE_RISK`、`DIVERGENCE_ALERT`）

#### **2. P2.5 快照讀取與 Escalation Gate 硬觸發**
- **檔案**：`06_SNAPSHOT_MANAGER.js`、`24_P5_WEEKLY_DATA.js`、`24_P5_WEEKLY_STOCK_STRATEGY.js`、`24_P5_WEEKLY_CORE.js`
- **任務**：
  1. 新增 `getLatestP2_5Snapshot()` 函數（參考 `getLatestP2Snapshot()`）
  2. 在 `collectP5WeeklyAllData()` 中收集 `p2_5_snapshot`
  3. 在 `integrateStockFactors()` 中提取 `p2_5_data`
  4. **實現 Escalation Gate 硬觸發邏輯**：
     - 在 P5-B 的 `escalation_score` 計算中，若 `p2_5.insider_selling_alert === true` 或 `p2_5.abnormal_13f_distribution === true` → 直接觸發 P5-A（`escalation_score = 1.0`，強制升級）
     - 在輸出中標記 `forced_escalation: { trigger: "P2.5", type: "INSIDER_OR_13F", confidence: "HIGH" }`

### **🟡 優先級 2：重要補強（核心功能）**

#### **3. P2 Milestones 自動對帳機制**
- **檔案**：`24_P5_WEEKLY_STOCK_STRATEGY.js`、`24_P5_WEEKLY_CORE.js`
- **任務**：
  1. 在 P5-B 中新增「Milestone Check」子任務
  2. 讀取 `p2_data.milestones_to_verify`（從 P2 快照中提取）
  3. 執行 `CrossReference(Milestones, Weekly_News_Index)`
  4. 若匹配成功（Milestone Met）→ 將 `escalation_score` 加分，觸發 P5-A 進行加碼評估

#### **4. P2 V8.15 新增欄位完整提取**
- **檔案**：`24_P5_WEEKLY_STOCK_STRATEGY.js`
- **任務**：
  1. 在 `extractStockDataFromSnapshot()` 或 `integrateStockFactors()` 中完整提取所有 V8.15 新增欄位：
     - `position_role`（MOMENTUM/DIAMOND/OPTIONALITY/DEFENSIVE/REJECT）
     - `milestones_to_verify`（JSON）
     - `runway_quarters`（Frontier 硬門檻）
     - `time_window_penalty_json`（P0.7 窗口懲罰）
     - `track_type`（CORE/FRONTIER）
     - `max_position_cap_suggestion`

#### **5. P6 週度摘要讀取與頻率趨勢**
- **檔案**：`24_P5_WEEKLY_DATA.js`、`24_P5_WEEKLY_STOCK_STRATEGY.js`
- **任務**：
  1. 新增 `getP6WeeklySummary()` 函數：
     - 從 `P6_INTRADAY_ALERTS_DAILY` 讀取本週（過去 7 天）的異常事件
     - 計算 `P6_Alert_Frequency_Trend`（本週事件數 vs 過去 4 週平均）
     - 返回 `{ weekly_events: [...], frequency_trend: {...}, alert_count: N, avg_4w: M }`
  2. 在 `collectP5WeeklyAllData()` 中收集 `p6_weekly_summary`
  3. 在 P5-B 的 `state_vector` 計算中：
     - 若 `p6_weekly_summary.frequency_trend > 2 sigma`（本週警報次數暴增）→ 調降 `volatility_regime` 分數（預防性減倉）

### **🟢 優先級 3：優化補強（提升品質）**

#### **6. P0 Thesis 引用標記**
- **檔案**：`24_P5_WEEKLY_STOCK_STRATEGY.js`
- **任務**：在 `integrateStockFactors()` 中明確標記 `p0_thesis_ref`（引用 P0 snapshot_id）

#### **7. P0.7 Time Window 結構化**
- **檔案**：`24_P5_WEEKLY_STOCK_STRATEGY.js`、`24_P5_WEEKLY_CORE.js`
- **任務**：
  1. 確認 P0.7 快照包含結構化的 `time_window_constraints`（可機器讀）
  2. Weekly 讀取 `p0_7_snapshot.cycle_position` 和 `p0_7_snapshot.turning_point_risk`
  3. 若 `cycle_position === "Late"` 或 `turning_point_risk === "HIGH"` → 觸發 Tightrope Mode（收緊 ATR 停利參數）

#### **8. 重大財經行事曆整合**
- **檔案**：`24_P5_WEEKLY_DATA.js`、`24_P5_WEEKLY_PROMPT.js`
- **任務**：
  1. 在 `collectP5WeeklyAllData()` 中調用 `P5_Calendar_ScanNextTwoWeeks(new Date())`
  2. 收集 `macro_calendar`、`earnings_calendar`、`options_expiration`
  3. 將行事曆數據加入 `allData` 對象（例如：`allData.calendar = { macro: ..., earnings: ..., options: ... }`）
  4. 在 `24_P5_WEEKLY_PROMPT.js` 中將行事曆數據傳遞給 Weekly AI 作為決策因子

#### **9. 學習系統完整傳遞確認**
- **檔案**：`24_P5_WEEKLY_CORE.js`、`24_P5_WEEKLY_MEMORY_MANAGER.js`
- **任務**：
  1. 確認 `buildWeeklyMemoryPack()` 是否完整傳遞 `LEARNING_STATE.principles_summary`、`recent_reflections`、`similar_failure_cases`、`safety_lock_recommendations`
  2. 若未完整傳遞，補強 `buildWeeklyMemoryPack()` 函數

#### **10. P4 狀態更新順序保障**
- **檔案**：`24_P5_WEEKLY_DATA.js`、`24_P5_WEEKLY_CORE.js`
- **任務**：
  1. 在 `collectP5WeeklyAllData()` 中明確收集 `current_positions`、`open_orders`、`fills_since_last_week`
  2. 確保策略生成時使用的是最新狀態

---

**報告完成日期**：2026-01-19  
**版本**：V8.15  
**狀態**：✅ **檢查完成，待討論定案**
