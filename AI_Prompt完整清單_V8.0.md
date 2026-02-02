# AI Prompt 完整清單（V8.0）

## 📋 說明

本文檔列出所有會用到 AI 的地方，包含分析者（執行者）和審查者的 prompt。

**重要**：測試時需要評估每個 prompt 的有效程度，AI 回應是否符合預期水準。

---

## 🔍 P0: 產業工程學分析

### 執行者 Prompt
- **檔案**：`src/09_P0_INDUSTRY_ENGINEERING.js`
- **函數**：`buildP0Prompt(userInput, context)`
- **執行者**：OPUS（Claude Opus 4.5）
- **審查者**：GPT（GPT-5.2）

### 核心要求
- 建立「必然位置表」，不是選股清單
- 找出未來 3-10 年內，在物理/工程與制度/通道/流程層面不可或缺且難以被 scale 替代的大主題
- 兩大類：工程瓶頸類（ENG）、服務壟斷類（STRUCT）
- P0-3 強制輸出（五項缺一不可）：Problem_OneLiner、Failure_Mode、No_Alternative_Reason、Convergence_Evidence、Long_Term_Time_Window

### 輸出欄位（需要評估）
- `themes[]`: theme_id, theme_name, description, geographic_scope, time_horizon, analysis_type
- `p0_eng`: system_parameters, physical_failure_modes, alternative_solutions
- `p0_struct`: structural_node_type, failure_modes, alternative_paths
- `problem_oneliner`, `failure_mode`, `no_alternative_reason`, `convergence_evidence`, `long_term_time_window`

---

## 🔍 P0.5: 產業鏈地圖

### 執行者 Prompt
- **檔案**：`src/08_P0_5_INDUSTRY_CHAIN.js`（或 `08_P0_5_SUPPLY_CHAIN.js`）
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 核心要求
- 分析產業鏈上下游關係
- 識別關鍵節點和傳導路徑
- 供應鏈傳導分析（上游 → 中游 → 下游）

### 輸出欄位（需要評估）
- 產業鏈地圖結構
- 關鍵節點識別
- 傳導路徑分析

---

## 🔍 P0.7: 系統動力學分析

### 執行者 Prompt
- **檔案**：`src/19_P0_7_SYSTEM_DYNAMICS.js`
- **函數**：`buildP0_7Prompt(userInput, p0Output)`
- **執行者**：O3（OpenAI o3）
- **審查者**：OPUS（Claude Opus 4.5）⭐ 避免同家盲點

### 核心要求
- 裁決主題在系統演化的時間序位置（Early/Mid/Late/Transition）
- 主導系統的是增強迴路（R）還是調節迴路（B）
- 「最該押的槓桿點」是哪一種公司角色類型
- 必須按照固定順序完成：動態性問題定義 → 關鍵存量與流量辨識 → CLD 因果迴路裁決 → 時間序位置判斷 → 槓桿點角色識別

### 輸出欄位（需要評估）
- `themes[]`: dynamic_problem_oneliner, loop_dominance, time_position, leveraged_role_type, risk_note
- `stocks_and_flows`: 關鍵存量與流量
- `causal_loops`: R 迴路和 B 迴路
- `time_position`: Early/Mid/Late/Transition
- `leveraged_role_type`: 槓桿點角色類型（不是公司名）

---

## 🔍 P1: 公司池篩選

### 執行者 Prompt
- **檔案**：`src/20_P1_COMPANY_POOL.js`
- **函數**：`buildP1Prompt(userInput, p0Output, p0_7Output)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 核心要求
- 建立「公司池」，不是選股
- 三層對位檢查（ENG Fit、STRUCT Fit、Time/Role Fit）
- 必須逐條回答並輸出，不得跳步
- 輸出三池歸屬：Master_Candidates、Tracking_Pool、Rejection_Pool

### 輸出欄位（需要評估）
- `master_candidates[]`: Company_Code, Company_Name, ENG_Fit_Result, STRUCT_Fit_Result, Time_Role_Fit_Result, Moat_Type, Rerate_State
- `tracking_pool[]`: 追蹤池公司
- `rejection_pool[]`: 排除池公司及原因

---

## 🔍 P2: 基本面財務分析

### 執行者 Prompt
- **檔案**：`src/21_P2_FUNDAMENTAL_ANALYSIS.js`
- **函數**：`buildP2Prompt(frequency, userInput, masterCandidates, financialData, previousSnapshot)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 核心要求
- 財務安全性 Gate 檢查
- 分層決策（CORE/STABLE_SWING/AGGRESSIVE/OPPORTUNISTIC）
- 同業比較與相對位置（兩階段流程：AI 識別同業 → 程式計算相對位置）
- 嚴禁回寫或重判前段封存欄位

### 輸出欄位（需要評估）
- `tier_assignments{}`: ticker → { tier, gate_result, tier_reason, peer_comparison, financial_metrics }
- `tier_summary{}`: 各層級統計
- 財務指標：Revenue_YoY, Gross_Margin, Operating_Margin, Net_Margin, CFO, FCF, Net_Debt_EBITDA, ROIC, Current_Ratio

---

## 🔍 P2.5: 機構級籌碼面分析

### 執行者 Prompt
- **檔案**：`src/21_P2_5_PROMPT.js`
- **函數**：`buildP2_5Prompt(tickers, smartMoneyData, frequency)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 核心要求
- 機構持倉變化分析（13F）
- 內部人交易分析
- 期權活動分析
- Dark Pool 活動分析
- 對沖基金 Clone 分析（Top 10 對沖基金清單，Clone 評分邏輯）

### 輸出欄位（需要評估）
- `smart_money_analysis{}`: ticker → { institutional_holdings, insider_trading, options_flow, dark_pool_activity, hedge_fund_clone, smart_money_score, recommendations }
- `institutional_holdings`: 13f_changes, trend, top_buyers, top_sellers
- `insider_trading`: signal, recent_transactions
- `options_flow`: unusual_activity, put_call_ratio, sentiment
- `dark_pool_activity`: unusual_volume, sentiment, net_flow
- `hedge_fund_clone`: similar_holdings, clone_score
- `smart_money_score`: 0-100 綜合評分

---

## 🔍 P3: 技術分析（機構級預測）

### 執行者 Prompt
- **檔案**：`src/22_P3_AI_ANALYSIS.js`
- **函數**：`buildP3Prompt(frequency, phase2Output, technicalData, smartMoneyData)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 核心要求
- ⭐⭐⭐⭐⭐ **機構級預測視角**（最高等級原則）
- 以機構主力、大型對沖基金的視角分析
- 解釋主力行為、判斷意圖、預測未來操作
- Cat 分類（Cat1-Cat5）
- Buy/Stop 價格判斷
- 整合 P2 和 P2.5 數據

### 輸出欄位（需要評估）
- `technical_results{}`: ticker → { cat, cat_reason, institutional_perspective, main_force_behavior, intent_judgment, future_prediction, buy_orders, stop_loss }
- `cat`: Cat1/Cat2/Cat3/Cat4-A/Cat4-B/Cat5
- `institutional_perspective`: 機構級視角分析
- `main_force_behavior`: 主力行為解釋
- `intent_judgment`: 意圖判斷
- `future_prediction`: 未來預測
- `buy_orders[]`: { order_type, price, quantity, reason }
- `stop_loss`: 止損價格

---

## 🔍 P5 Daily: 新聞原子化與數據收集

### 執行者 Prompt
- **檔案**：`src/24_P5_DAILY_NEWS.js`（推測）
- **執行者**：GPT（GPT-5.2）⭐ 多語去重場景
- **審查者**：GEMINI_PRO（Gemini 3.0 Pro）⭐ 多語去重

### 核心要求
- 新聞原子化（去重、分類、重要性評分）
- 多語去重（中文、英文、日文）
- 數據收集（OHLCV、技術指標、Sector ETF、衍生品、宏觀數據）

### 輸出欄位（需要評估）
- `news_atoms[]`: date, ticker, content, importance, sentiment, category, impact_scope
- 數據收集結果：ohlcv, technical_indicators, sector_etf, derivatives, macro_data

---

## 🔍 P5 Weekly: 宏觀世界觀分析

### 執行者 Prompt
- **檔案**：`src/24_P5_WEEKLY_PROMPT.js`
- **函數**：`buildWorldviewPrompt(data)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 核心要求
- 整合本週所有新聞快照 + 市場數據資料
- 分析每週的宏觀世界財經觀
- 與前幾期（一個月）的世界觀做連接與對照
- ⭐ V8.0 新增：籌碼面週報、Sector ETF Flow 分析、Mag 7 集體表現分析
- Regime 分析（BULL_STRONG/BULL_WEAK/RANGE/BEAR_WEAK/BEAR_STRONG）

### 輸出欄位（需要評估）
- `weekly_worldview`: overall_status, key_themes, market_regime, regime_confidence, macro_trends
- `regime_transition`: stay_probability, transition_to, transition_probability, transition_reason
- `u_macro_recommendation`: value, reason, previous_value, mag7_influence
- `risk_assessment`: systemic_risk, primary_risk, hedging_needed, risk_factors
- `worldview_evolution`: changes_from_last_week, changes_from_last_month, trend_direction
- `market_alignment`: alignment_status, alignment_analysis, divergence_factors
- `key_conclusions[]`: conclusion, confidence, supporting_evidence

---

## 🔍 P5 Weekly: 個股策略生成

### 執行者 Prompt
- **檔案**：`src/24_P5_WEEKLY_STOCK_STRATEGY.js`
- **函數**：`buildStockStrategyBatchPrompt(batch, context)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 核心要求
- ⭐⭐⭐ **AI 動態權重決定**（因子權重由 AI 根據當下所有資訊動態決定）
- ⭐⭐⭐ **財報日個股籌碼權重加強**（未來 14 天內有財報公布的持倉個股，smart_money 權重提高到 0.25-0.35，institutional 權重提高到 0.15-0.20）
- 整合 6 個因子：worldview、event、technical、fundamental、institutional、smart_money
- Hitchhiking 監控（機構出貨、內部人賣出、Dark Pool 轉向、期權 Put 保護激增）

### 輸出欄位（需要評估）
- `stock_strategies{}`: ticker → { strategy, action, target_allocation, current_allocation, order_adjustments, confidence, factor_weights, weight_reasoning, factors, final_score, reasoning, hitchhiking }
- `factor_weights`: worldview, event, technical, fundamental, institutional, smart_money（AI 動態決定）
- `weight_reasoning`: 權重決定的理由說明
- `final_score`: 最終融合評分
- `hitchhiking`: { signals, severity, recommendation }

---

## 🔍 P5 Weekly: 整合分析

### 執行者 Prompt
- **檔案**：`src/24_P5_WEEKLY_PROMPT.js`
- **函數**：`buildP5WeeklyIntegratedPrompt(data)`
- **執行者**：SONNET（Claude Sonnet 4.5）
- **審查者**：GPT（GPT-5.2）

### 核心要求
- 整合 P5.7-5.9 的結論
- 市場綜述、因果鏈分析、風險事件識別
- 衍生品策略調整、信念更新、U 調整、行動清單、觸發決策

### 輸出欄位（需要評估）
- `market_analysis`: overall_status, key_events, trend_analysis, market_regime
- `causality_chain`: chains[]
- `risk_events[]`: event, severity, probability, impact
- `derivatives_strategy_adjustment`: recommendations, hedging_ratio, options_strategy
- `belief_update`: updated_beliefs, confidence_changes, worldview_integration
- `u_adjustment`: recommended_u, reason, trigger_condition
- `action_list[]`: action, priority, target
- `trigger_decisions[]`: trigger_phase, reason, parameters

---

## 🔍 M0: 審查者 Prompt

### 審查者 Prompt（通用）
- **檔案**：`src/03_M0_CORE.js`
- **函數**：
  - `buildAuditorPromptWithQuestions(executorQuestions, previousResult)`
  - `buildAuditorPromptWithFactCheck(executorQuestions, previousResult, auditorInitialReview, geminiSearchResult)`
- **審查者**：根據任務類型決定（P5 Daily: GEMINI_PRO, P0.7: OPUS, 其他: GPT）

### 核心要求
- 審查執行者的輸出
- 回答執行者提出的問題
- 事實查證（如果需要的話）
- 提供建議和改進意見

### 輸出欄位（需要評估）
- `review_summary`: 整體審查摘要
- `answers[]`: question_id, question, answer, confidence, sources, needs_verification
- `issues_found[]`: issue, severity, suggestion
- `overall_assessment`: PASS/NEEDS_REVISION/FAIL
- `recommendations[]`: 具體建議

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
