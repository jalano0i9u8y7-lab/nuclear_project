/**
 * 📊 Google Sheets 表格結構定義
 * 
 * 定義所有必要的表格及其 Schema
 * 
 * @version SSOT V8.0
 * @date 2025-01-15
 * @changes V8.0: 新增 P0_5__SNAPSHOT 快照表
 */

// ==========================================
// M0 工具機表格
// ==========================================

/**
 * M0__JOB_QUEUE（入口）
 * Headers（寫死，不可改）：
 * job_id | project_id | status | requested_flow | input_payload | started_at | finished_at | error_code | retry_count
 */
const M0_JOB_QUEUE_SCHEMA = {
  sheetName: "M0__JOB_QUEUE",
  headers: [
    "job_id",
    "project_id",
    "status",
    "requested_flow",
    "input_payload",
    "started_at",
    "finished_at",
    "error_code",
    "error_message",
    "retry_count",
    "created_at"
  ],
  statusValues: ["NEW", "RUNNING", "DONE", "ERROR", "RETRY"]
};

/**
 * M0__RESULT（出口）
 * Headers（寫死，不可改）：
 * job_id | project_id | final_output | used_models | finished_at | status
 */
/**
 * M0__RESULT（出口）
 * ⭐ V8.0 新增：Token 使用量追蹤欄位
 * Headers（寫死，不可改）：
 * job_id | project_id | final_output | used_models | finished_at | status | execution_time_ms | input_tokens | output_tokens | estimated_cost | token_usage_json
 */
const M0_RESULT_SCHEMA = {
  sheetName: "M0__RESULT",
  headers: [
    "job_id",
    "project_id",
    "final_output",
    "used_models",
    "finished_at",
    "status",
    "execution_time_ms",
    "input_tokens",  // ⭐ V8.0 新增：總輸入 tokens
    "output_tokens",  // ⭐ V8.0 新增：總輸出 tokens
    "estimated_cost",  // ⭐ V8.0 新增：估算成本（USD）
    "token_usage_json"  // ⭐ V8.0 新增：詳細 Token 使用量（JSON 格式，包含各模型的 tokens 和成本）
  ]
};

/**
 * M0__CROSSCHECK_LOG（審計鏈）
 * Headers（寫死，不可改）：
 * job_id | step | model_id | conversationId | input_snapshot | output_snapshot | note | created_at
 */
const M0_CROSSCHECK_LOG_SCHEMA = {
  sheetName: "M0__CROSSCHECK_LOG",
  headers: [
    "job_id",
    "step",
    "model_id",
    "conversation_id",
    "input_snapshot",
    "output_snapshot",
    "note",
    "created_at"
  ]
};

/**
 * M0__BATCH_JOBS（Batch API 任務追蹤）⭐ V8.17 新增
 * Headers（寫死，不可改）：
 * job_id | provider | provider_batch_id | model | request_count | status | created_at | updated_at | results_json
 */
const M0_BATCH_JOBS_SCHEMA = {
  sheetName: "M0__BATCH_JOBS",
  headers: [
    "job_id",
    "provider",
    "provider_batch_id",
    "model",
    "request_count",
    "status",
    "created_at",
    "updated_at",
    "results_json"
  ],
  statusValues: ["CREATED", "SUBMITTED", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"]
};

// ==========================================
// External Contracts 表格
// ==========================================

/**
 * SYS__EXTERNAL_CONTRACTS（全系統共享唯讀 Tab）
 * Schema: module_id | contract_type | version | schema_json | created_at | status
 */
const SYS_EXTERNAL_CONTRACTS_SCHEMA = {
  sheetName: "SYS__EXTERNAL_CONTRACTS",
  headers: [
    "module_id",
    "contract_type",
    "version",
    "schema_json",
    "created_at",
    "status",
    "updated_at"
  ]
};

// ==========================================
// Phase 0 表格
// ==========================================

/**
 * P0__SNAPSHOT（P0 快照表）
 * ⭐ V8.14 新增：時效性防呆機制欄位
 */
const P0_SNAPSHOT_SCHEMA = {
  sheetName: "P0__SNAPSHOT",
  headers: [
    "snapshot_id",
    "created_at",
    "trigger",
    "p0_output_json",
    "institutional_data_json",
    "changes_json",
    "version",
    // ⭐ V8.14 新增：時效性防呆機制
    "initial_analysis_json",  // OPUS 第一次完整分析結果（JSON）
    "validation_questions_json",  // 關鍵驗證問題列表（JSON）
    "validation_status",  // PENDING / IN_PROGRESS / COMPLETED / SKIPPED
    "gemini_validation_results_json",  // Gemini 提取的驗證結果（JSON）
    "final_analysis_json"  // OPUS 重新分析結果（JSON，包含影響標註）
  ]
};

/**
 * P0_5__SNAPSHOT（P0.5 快照表）⭐ V8.15 更新
 * 
 * Mode 1（Baseline Builder）：輸出 industry_chain_map_json
 * Mode 2（Chain Dynamics Monitor）：輸出 chain_dynamics_monitor_json
 */
const P0_5_SNAPSHOT_SCHEMA = {
  sheetName: "P0_5__SNAPSHOT",
  headers: [
    "snapshot_id",
    "created_at",
    "trigger",
    "mode",  // ⭐ V8.15 新增：BASELINE_BUILDER 或 CHAIN_DYNAMICS_MONITOR
    "cadence",  // ⭐ V8.15 新增：MONTHLY / QUARTERLY
    "p0_5_output_json",
    "p0_snapshot_id",
    "industry_chain_map_json",  // Mode 1 輸出（保留）
    "chain_dynamics_monitor_json",  // ⭐ V8.15 新增：Mode 2 輸出（4區結構：meta/signals/diagnosis/handoff）
    "p0_7_time_window_constraints_json",  // ⭐ V8.15 新增：P0.7 回寫的時間窗口約束
    "supply_chain_risk_json",  // 保留（舊格式，可逐步遷移）
    "changes_json",
    "version"
  ]
};

/**
 * P0_7__SNAPSHOT（P0.7 快照表）
 */
const P0_7_SNAPSHOT_SCHEMA = {
  sheetName: "P0_7__SNAPSHOT",
  headers: [
    "snapshot_id",
    "created_at",
    "trigger",
    "p0_7_output_json",
    "p0_snapshot_id",
    "institutional_data_json",
    "changes_json",
    "version"
  ]
};

// ==========================================
// Phase 1 表格
// ==========================================

/**
 * Phase1_Company_Pool（公司池）⭐ V8.14 更新：改用 Tier S/A/B/X 分級系統
 * 取代舊的三池分類（Master_Candidates, Tracking_Pool, Rejection_Pool）
 */
const PHASE1_COMPANY_POOL_SCHEMA = {
  sheetName: "Phase1_Company_Pool",
  headers: [
    "Theme_Track",
    "Theme_ID",
    "Subtheme_ID",
    "Company_Code",
    "Company_Name",
    "Market",
    "Primary_Technology_or_Node",
    "Tier",  // ⭐ V8.14 新增：Tier S/A/B/X（取代舊的三池分類）
    "Tier_Reason",  // ⭐ V8.14 新增：Tier 分級理由
    "Benefit_Mechanism",  // ⭐ V8.14 新增：受益機制描述
    "Detriment_Mechanism",  // ⭐ V8.14 新增：受害機制描述（Tier X 使用）
    "Revenue_Exposure",  // ⭐ V8.14 新增：業務結構佔比（Revenue Exposure / Mix）
    "Financial_Report_Proof",  // ⭐ V8.14 新增：財報證明段落（Business Description）
    "Financial_Report_Source",  // ⭐ V8.14 新增：財報來源（SEC/MOPS/EDINET）
    "Financial_Report_Status",  // ⭐ V8.14 新增：財報狀態（AVAILABLE / MISSING / INSUFFICIENT / FAILED / PENDING）
    "P1_Industry_Evidence_JSON",  // ⭐ V8.14 新增：Flash 提取的 P1 產業證據（JSON）
    "P2_Financial_Evidence_JSON",  // ⭐ V8.14 新增：Flash 提取的 P2 財務證據（JSON）
    "P3_Technical_Evidence_JSON",  // ⭐ V8.14 新增：Flash 提取的 P3 股權證據（JSON）
    "Financial_Report_Extraction_Status",  // ⭐ V8.14 新增：提取狀態（PENDING / EXTRACTED / FAILED）
    "Supply_Chain_Position",  // ⭐ V8.14 新增：供應鏈位置（Upstream/Midstream/Downstream/Complementary/Victim）
    "P0_5_Chain_Map_Node",  // ⭐ V8.14 新增：對應的 P0.5 產業鏈節點
    "P0.7_Loop_Dominance",
    "P0.7_Time_Position",
    "P0.7_Leveraged_Role_Type",
    "Confidence_Level",
    "Evidence_Sufficiency",  // ⭐ V8.14 新增：證據充足性（High/Medium/Low）
    "Source_Type",
    "Phase_Version",
    "Notes",
    "created_at",
    "updated_at"
  ]
};

/**
 * Phase1_Master_Candidates（正式候選池）⭐ V8.14 標記為已棄用
 * 保留此 Schema 以維持向後兼容性，但新系統應使用 Phase1_Company_Pool
 */
const PHASE1_MASTER_CANDIDATES_SCHEMA = {
  sheetName: "Phase1_Master_Candidates",
  headers: [
    "Theme_Track",
    "Theme_ID",
    "Subtheme_ID",
    "Company_Code",
    "Company_Name",
    "Market",
    "Primary_Technology_or_Node",
    "Moat_Type",
    "Rerate_State",
    "Problem_OneLiner",
    "Failure_Mode",
    "No_Alternative_Reason",
    "Convergence_Evidence",
    "Long_Term_Time_Window",
    "P0.7_Loop_Dominance",
    "P0.7_Time_Position",
    "P0.7_Leveraged_Role_Type",
    "Role_in_Theme",
    "ENG_Fit_Result",
    "STRUCT_Fit_Result",
    "TIME_ROLE_Fit_Result",
    "Confidence_Level",
    "Source_Type",
    "Phase_Version",
    "Notes",
    "created_at",
    "updated_at"
  ]
};

/**
 * Phase1_Tracking_Pool（追蹤池）
 */
const PHASE1_TRACKING_POOL_SCHEMA = {
  sheetName: "Phase1_Tracking_Pool",
  headers: [
    "Theme_Track",
    "Theme_ID",
    "Subtheme_ID",
    "Company_Code",
    "Company_Name",
    "Market",
    "Primary_Technology_or_Node",
    "Moat_Type",
    "Rerate_State",
    "Problem_OneLiner",
    "Why_Still_Unproven",
    "Tracking_Trigger",
    "P0.7_Time_Position",
    "P0.7_Leveraged_Role_Type",
    "Confidence_Level",
    "Phase_Version",
    "Notes",
    "created_at",
    "updated_at"
  ]
};

/**
 * Phase1_Rejection_Pool（排除池）
 */
const PHASE1_REJECTION_POOL_SCHEMA = {
  sheetName: "Phase1_Rejection_Pool",
  headers: [
    "Theme_Track",
    "Theme_ID",
    "Subtheme_ID",
    "Company_Code",
    "Company_Name",
    "Market",
    "Primary_Technology_or_Node",
    "Moat_Type",
    "Rejection_Reason",
    "Rejection_Type",
    "Phase_Version",
    "Notes",
    "created_at"
  ]
};

/**
 * P1__SNAPSHOT（P1 快照表）
 */
const P1_SNAPSHOT_SCHEMA = {
  sheetName: "P1__SNAPSHOT",
  headers: [
    "snapshot_id",
    "created_at",
    "trigger",
    "p1_output_json",
    "pool_results_json",
    "p0_snapshot_id",
    "p0_7_snapshot_id",
    "institutional_data_json",
    "changes_json",
    "version"
  ]
};

// ==========================================
// Phase 2 表格
// ==========================================

/**
 * P2__SNAPSHOT（P2 快照表）
 */
const P2_SNAPSHOT_SCHEMA = {
  sheetName: "P2__SNAPSHOT",
  headers: [
    "snapshot_id",
    "created_at",
    "trigger",
    "tier_assignments_json",
    "tier_summary_json",
    "changes_json",
    "auto_trigger_json",
    "version"
  ]
};

/**
 * Phase2_Output（P2 輸出表格）
 * ⭐ V8.15 新增：三軸評級系統欄位
 */
const PHASE2_OUTPUT_SCHEMA = {
  sheetName: "Phase2_Output",
  headers: [
    // Phase 1 繼承（只讀）
    "Theme_Track",
    "Theme_ID",
    "Subtheme_ID",
    "Primary_Technology_or_Node",
    "Company_Code",
    "Company_Name",
    "Market",
    "Moat_Type",
    "Rerate_State",
    "Role_in_Theme",
    "P0.7_Time_Position",
    "P0.7_Leveraged_Role_Type",
    "Phase1_Version",
    
    // Phase 2 核心輸出
    "Gate_Result",
    "Tier",
    "Tier_Reason",
    
    // ⭐ V8.15 新增：三軸評級系統
    "Safety_Grade",  // S/A/B/X
    "Safety_Score",  // 0-100
    "Safety_Evidence_JSON",  // JSON格式：最低必要證據
    "Growth_Momentum_Grade",  // S/A/B/X
    "Growth_Quality_Score",  // 0-100
    "Growth_Momentum_Evidence_JSON",  // JSON格式：最低必要證據
    "Future_Breakout_Grade",  // S/A/B/X
    "Future_Potential_Score",  // 0-100
    "Future_Breakout_Evidence_JSON",  // JSON格式：最低必要證據
    
    // ⭐ V8.15 新增：Position Role 和 Track Type
    "Position_Role",  // MOMENTUM/DIAMOND/OPTIONALITY/DEFENSIVE/REJECT
    "Position_Role_Reasoning",  // 理由（基於三軸評級）
    "Track_Type",  // CORE/FRONTIER
    "Max_Position_Cap_Suggestion",  // 僅當 position_role = OPTIONALITY 時降低（例如 0.03）
    
    // ⭐ V8.15 新增：驗證里程碑
    "Milestones_To_Verify_JSON",  // JSON格式：僅當 Future Breakout = S/S+ 時
    
    // ⭐ V8.15 新增：Frontier 特殊欄位
    "Runway_Quarters",  // 生存跑道（季度數）
    "Runway_Calculation_JSON",  // JSON格式：Runway 計算詳情
    "Frontier_Risks_JSON",  // JSON格式：Frontier 風險評估
    "Frontier_Conditions_JSON",  // JSON格式：Frontier 條件列表
    "Gate_Result_For_Frontier",  // OPTIONALITY_ONLY（僅當 track_type = FRONTIER 且 Safety = X 時）
    
    // ⭐ V8.15 新增：Time Window Penalty
    "Time_Window_Penalty_JSON",  // JSON格式：P0.7 窗口懲罰詳情
    
    // ⭐ V8.15 新增：P1 財報段落對照
    "Narrative_Consistency_Check",  // 一致/不一致/需特別審
    "Narrative_Consistency_Evidence_JSON",  // JSON格式：引用 P1 段落
    
    // 財務指標
    "Revenue_YoY",
    "Gross_Margin",
    "Operating_Margin",
    "Net_Margin",
    "CFO",
    "FCF",
    "Net_Debt_EBITDA",
    "ROIC",
    "Current_Ratio",
    
    // 同業比較
    "Peer_Comparison",
    
    // 其他
    "FPE_A",
    "FPE_B",
    "Phase2_Version",
    "Last_Updated",
    "Notes"
  ]
};

/**
 * P2_5__SNAPSHOT（P2.5 快照表）
 */
const P2_5_SNAPSHOT_SCHEMA = {
  sheetName: "P2_5__SNAPSHOT",
  headers: [
    "snapshot_id",
    "created_at",
    "trigger",
    "p2_5_output_json",
    "p2_snapshot_id",
    "changes_json",
    "version"
  ]
};

/**
 * Phase2.5_Output（P2.5 輸出表格）
 */
const PHASE2_5_OUTPUT_SCHEMA = {
  sheetName: "Phase2.5_Output",
  headers: [
    "Company_Code",
    "Company_Name",
    "Institutional_Holdings_Score",
    "Insider_Trading_Signal",
    "Options_Flow_Sentiment",
    "Dark_Pool_Activity",
    "Hedge_Fund_Clone_Score",
    "Smart_Money_Score",
    "Recommendations",
    "Last_Updated"
  ]
};

// ==========================================
// Phase 3 表格
// ==========================================

/**
 * P3__SNAPSHOT（P3 快照表）
 */
const P3_SNAPSHOT_SCHEMA = {
  sheetName: "P3__SNAPSHOT",
  headers: [
    "snapshot_id",
    "created_at",
    "trigger",
    "prevent_recursive",
    "technical_results_json",
    "changes_json",
    "auto_trigger_json",
    "data_freshness_json",
    "version"
  ]
};

/**
 * MARKET_OHLCV_DAILY（市場 OHLCV 數據，由 P5 Daily 收集）
 */
const MARKET_OHLCV_DAILY_SCHEMA = {
  sheetName: "MARKET_OHLCV_DAILY",
  headers: [
    "date",
    "ticker",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "adj_close",
    "created_at"
  ]
};

/**
 * MARKET_INDICATORS_DAILY（技術指標，由 P5 Daily 計算）
 * ⭐ V8.19 新增：Parabolic Exit 相關欄位（volume_latest, avg_volume_20d, close_latest）
 */
const MARKET_INDICATORS_DAILY_SCHEMA = {
  sheetName: "MARKET_INDICATORS_DAILY",
  headers: [
    "date",
    "ticker",
    "rsi_14",
    "macd_value",
    "macd_signal",
    "macd_histogram",
    "atr_14",
    "ma20",
    "ma60",
    "ma240",
    "volume_latest",  // ⭐ V8.19 新增：最新成交量（用於 Parabolic Exit）
    "avg_volume_20d",  // ⭐ V8.19 新增：20 日平均成交量（用於 Parabolic Exit）
    "close_latest",  // ⭐ V8.19 新增：最新收盤價（用於 Parabolic Exit）
    "created_at"
  ]
};

// ==========================================
// Phase 4 表格
// ==========================================

/**
 * P4__SNAPSHOT（P4 快照表）
 */
const P4_SNAPSHOT_SCHEMA = {
  sheetName: "P4__SNAPSHOT",
  headers: [
    "snapshot_id",
    "created_at",
    "trigger",
    "trigger_reason",
    "p2_snapshot_id",
    "p3_snapshot_id",
    "allocations_json",
    "summary_json",
    "changes_json",
    "version"
  ]
};

// ==========================================
// Phase 5 表格
// ==========================================

/**
 * SECTOR_ETF_DAILY（板塊 ETF 數據，由 P5 Daily 收集）
 */
const SECTOR_ETF_DAILY_SCHEMA = {
  sheetName: "SECTOR_ETF_DAILY",
  headers: [
    "date",
    "etf_ticker",
    "sector",
    "close",
    "week_performance",
    "month_performance",
    "created_at"
  ]
};

/**
 * DERIVATIVES_DAILY（衍生品數據，由 P5 Daily 收集）
 */
const DERIVATIVES_DAILY_SCHEMA = {
  sheetName: "DERIVATIVES_DAILY",
  headers: [
    "date",
    "ticker",
    "put_call_ratio",
    "max_oi_strike_call",
    "max_oi_strike_put",
    "iv_30d",
    "days_to_opex",
    "created_at"
  ]
};

/**
 * SMART_MONEY_DAILY（機構級籌碼面數據，由 P5 Daily 收集）
 * ⚠️ V8.0 變更：此表格主要用於期權數據（每日），籌碼數據移至 SMART_MONEY_WEEKLY
 * ⭐ V8.0 新增：市場情緒指標（FPE_B）
 */
const SMART_MONEY_DAILY_SCHEMA = {
  sheetName: "SMART_MONEY_DAILY",
  headers: [
    "date",
    "ticker",
    "market",  // ⭐ V8.0 新增：市場（US/TW/JP）
    "options_flow",  // ⭐ V8.0：主要用於期權數據
    "vix",
    "skew",
    "put_call_ratio",
    "iv_30d",
    "unusual_options_activity",
    "fpe_b",  // ⭐ V8.0 新增：FPE_B（分析師共識 Forward P/E，由 P5 Weekly 收集）
    "created_at"
  ]
};

/**
 * MARKET_BREADTH_DAILY（市場寬度數據，由 P5 Daily 收集）⭐ V8.0 新增
 */
const MARKET_BREADTH_DAILY_SCHEMA = {
  sheetName: "MARKET_BREADTH_DAILY",
  headers: [
    "date",
    "index_ticker",  // 指數代碼（如 SPX, NDX, RUT）
    "advance_count",  // 上漲股票數
    "decline_count",  // 下跌股票數
    "new_high_count",  // 創新高股票數
    "new_low_count",  // 創新低股票數
    "stocks_above_ma50",  // 在 50MA 以上的股票數
    "stocks_above_ma200",  // 在 200MA 以上的股票數
    "total_stocks",  // 總股票數
    "advance_decline_ratio",  // 漲跌比
    "new_high_low_ratio",  // 新高新低比
    "ma50_percentage",  // 在 50MA 以上的百分比
    "ma200_percentage",  // 在 200MA 以上的百分比
    "created_at"
  ]
};

/**
 * REGIME_PREDICTION_TRACKING（Regime 預測準度追蹤）⭐ V8.0 新增
 */
const REGIME_PREDICTION_TRACKING_SCHEMA = {
  sheetName: "REGIME_PREDICTION_TRACKING",
  headers: [
    "prediction_id",
    "prediction_date",
    "predicted_regime",  // 預測的 Regime
    "prediction_confidence",  // 預測信心度
    "verification_date",  // 驗證日期（預測後 7 天）
    "actual_regime",  // 實際 Regime
    "is_correct",  // 是否正確
    "accuracy_score",  // 準度評分（0-1）
    "notes",
    "created_at"
  ]
};

/**
 * SMART_MONEY_WEEKLY（機構級籌碼面數據，由 P5 Weekly 收集）⭐ V8.0 新增
 */
const SMART_MONEY_WEEKLY_SCHEMA = {
  sheetName: "SMART_MONEY_WEEKLY",
  headers: [
    "week_start_date",
    "week_end_date",
    "ticker",
    "insider_trading_json",  // 本週內部人交易（SEC Form 4）
    "dark_pool_activity_json",  // 本週 Dark Pool 活動（僅持倉 10-20 檔）
    "f13f_holdings_json",  // 13F 持倉（季度，配合 P2.5 Quarterly）
    "smart_money_signal",  // BULLISH/NEUTRAL/BEARISH
    "summary_json",
    "created_at"
  ]
};

/**
 * MACRO_DATA_DAILY（宏觀數據，由 P5 Daily 收集）
 * ⭐ V7.1 新增：油價、貴金屬、匯率、國債利率等
 */
const MACRO_DATA_DAILY_SCHEMA = {
  sheetName: "MACRO_DATA_DAILY",
  headers: [
    "date",
    "data_type",  // commodities, currencies, bonds, indices
    "symbol",     // CL=F, GC=F, EURUSD=X, ^TNX, ^VIX 等
    "name",       // WTI 原油、黃金、歐元/美元、十年美債利率、VIX 等
    "value",
    "change",
    "change_pct",
    "created_at"
  ]
};

/**
 * NEWS_ATOMS_DAILY（新聞原子化數據，由 P5 Daily 收集）
 * ⭐ V8.12 升級：從平面分類 → 多維度標籤系統
 */
const NEWS_ATOMS_DAILY_SCHEMA = {
  sheetName: "NEWS_ATOMS_DAILY",
  headers: [
    "date",
    "atom_id",
    "category",  // ⭐ V8.12：保留作為兼容性欄位（將遷移至多維度標籤）
    "ticker",  // ⭐ V8.12：保留（個股新聞索引將使用related_tickers_json）
    "title",
    "summary",
    "source",
    "importance",  // ⭐ V8.12：保留作為兼容性欄位
    "url",
    "macro_context_json",  // ⭐ V7.1 新增：宏觀數據上下文（用於世界觀分析）
    // ⭐ V8.12 新增：多維度標籤系統
    "event_type_json",  // 事件屬性（JSON格式，包含主要和次要事件類型）
    "impact_scope",  // 影響層級：GLOBAL / SECTOR / STOCK
    "sentiment_polarity",  // 情緒極性：VERY_BULLISH / SLIGHTLY_BULLISH / NEUTRAL / SLIGHTLY_BEARISH / VERY_BEARISH
    "related_tickers_json",  // 關聯股票代碼列表（JSON格式，用於個股新聞索引）
    // ⭐ V8.12 新增：新聞驗證標記
    "data_type",  // 數據類型：HARD / SEMI_STRUCTURED / NARRATIVE
    "data_recency",  // 數據時效性：OK / STALE / UNCLEAR
    "data_coherence",  // 數據語意一致性：CONSISTENT / QUESTIONABLE / INCONSISTENT
    "data_verification",  // 數據驗證狀態：VERIFIED / NOT_VERIFIED / NOT_APPLICABLE
    "narrative_direction",  // 敘事方向檢驗：CONSISTENT / UNCONFIRMED / CONFLICTING
    "market_confirmation",  // 市場重要性檢驗：STRONG / MODERATE / WEAK
    "cross_asset_resonance",  // 共振檢驗：STRONG / MODERATE / WEAK
    "verification_details_json",  // 驗證詳細信息（JSON格式，包含驗證過程和數據來源）
    "created_at"
  ]
};

/**
 * INSTITUTIONAL_RATINGS_DAILY（機構評級資料，由 P5 Daily 收集）⭐ V8.9 新增
 * 定位：⚠️ 「帶風向面」的資料，用於事後驗證指標（非預先判斷）
 * 獨立於 NEWS_ATOMS_DAILY，不共用表格
 */
const INSTITUTIONAL_RATINGS_DAILY_SCHEMA = {
  sheetName: "INSTITUTIONAL_RATINGS_DAILY",
  headers: [
    "date",                    // 評級發布日期
    "ticker",                  // 股票代碼
    "market",                  // 市場（US/TW/JP）
    "rating_firm",             // 機構名稱（標準化後，如 GOLDMAN_SACHS）
    "rating_action",           // 評級動作（標準化後：UPGRADE/DOWNGRADE/MAINTAIN/INITIATE）
    "from_grade",              // 原評級（如 Buy, Hold）
    "to_grade",                // 新評級（如 Strong Buy, Buy）
    "from_price",              // 原目標價
    "to_price",                // 新目標價
    "target_change",           // 目標價變化（格式化的文字，如 "$150 -> $180"）
    "news_title",              // 新聞標題
    "news_summary",            // 新聞摘要
    "news_url",                // 新聞連結
    "news_source",             // 新聞來源（The Fly, 鉅亨網, Minkabu）
    "rating_date",             // 評級發布日期（從新聞中提取）
    "rating_time",             // 評級發布時間（如果可提取）
    "implied_fpe",             // 隱含 FPE（計算：to_price / consensus_forward_eps）
    "superseded_by",           // 如果同一個機構在一個月內發布兩次評級，標記為被哪一筆取代（rating_id）
    "created_at"               // 資料創建時間
  ]
};

/**
 * STOCK_NEWS_INDEX_DAILY（個股新聞索引，由 P5 Daily 聚合）⭐ V8.12 新增
 * 定位：反向索引 (Inverted Index)，讓 Weekly 可以用「股票代碼」反查所有相關新聞
 * 主要功能：上標籤，讓weekly做"個股當周策略"時，能夠快速引入做為決策因子之一
 */
const STOCK_NEWS_INDEX_DAILY_SCHEMA = {
  sheetName: "STOCK_NEWS_INDEX_DAILY",
  headers: [
    "date",                    // 日期
    "ticker",                  // 股票代碼
    "news_count",              // 關聯新聞總數
    "bullish_count",           // 利多新聞數量
    "bearish_count",           // 利空新聞數量
    "neutral_count",           // 中性新聞數量
    "news_ids_json",           // 關聯新聞ID列表（JSON格式）
    "sentiment_summary_json",  // 情緒摘要（JSON格式，包含詳細分析）
    "created_at"               // 資料創建時間
  ]
};

/**
 * SECTOR_NEWS_INDEX_DAILY（板塊/產業新聞索引，由 P5 Daily 聚合）⭐ V8.12 新增
 * 定位：反向索引，讓 Weekly 可以用「板塊/產業」反查所有相關新聞
 * 主要功能：避免Weekly重複搜尋板塊/產業新聞100次
 */
const SECTOR_NEWS_INDEX_DAILY_SCHEMA = {
  sheetName: "SECTOR_NEWS_INDEX_DAILY",
  headers: [
    "date",                    // 日期
    "sector_or_industry",      // 板塊或產業名稱
    "sector_type",             // 類型（SECTOR/INDUSTRY）
    "news_count",              // 關聯新聞總數
    "bullish_count",           // 利多新聞數量
    "bearish_count",           // 利空新聞數量
    "neutral_count",           // 中性新聞數量
    "news_ids_json",           // 關聯新聞ID列表（JSON格式）
    "sentiment_summary_json",  // 情緒摘要（JSON格式）
    "key_events_json",         // 關鍵事件列表（JSON格式）
    "created_at"               // 資料創建時間
  ]
};

/**
 * EVENTS_INDEX_WEEKLY（事件索引，由 P5 Daily 在週五聚合）⭐ V8.12 新增
 * 定位：反向索引，讓 Weekly 可以用「ticker」反查所有相關事件
 * 主要功能：避免Weekly重複過濾事件列表100次
 */
const EVENTS_INDEX_WEEKLY_SCHEMA = {
  sheetName: "EVENTS_INDEX_WEEKLY",
  headers: [
    "week_start_date",         // 週開始日期
    "week_end_date",           // 週結束日期
    "ticker",                  // 股票代碼
    "event_count",             // 關聯事件總數
    "upcoming_events_json",    // 即將發生的事件列表（JSON格式）
    "event_types_json",        // 事件類型列表（JSON格式）
    "alert_levels_json",       // 警報級別列表（JSON格式）
    "created_at"               // 資料創建時間
  ]
};

/**
 * MACRO_DATA_WEEKLY_METRICS（宏觀數據週度波動度計算結果）⭐ V8.12 新增
 * 定位：程式計算的硬數據，避免Weekly重新計算
 * 主要功能：提供五天內各數據的價量波動度、背離度、與上週比對結果
 */
const MACRO_DATA_WEEKLY_METRICS_SCHEMA = {
  sheetName: "MACRO_DATA_WEEKLY_METRICS",
  headers: [
    "week_start_date",         // 週開始日期
    "week_end_date",           // 週結束日期
    "data_type",               // 數據類型（commodities/currencies/bonds/indices）
    "symbol",                  // 數據符號（如 WTI, BTCUSD, ^TNX等）
    "name",                    // 數據名稱
    "price_volatility",        // 價格波動度（標準差）
    "price_max_amplitude",     // 價格最大振幅
    "volume_volatility",       // 成交量波動度（如果有）
    "price_volume_correlation", // 價量相關性係數
    "divergence_score",        // 背離度評分（0-1，1為完全背離）
    "prev_week_volatility",    // 上一週的波動度
    "volatility_change_pct",   // 波動度變化百分比
    "trend_change",            // 趨勢變化（ACCELERATING/DECELERATING/STABLE）
    "created_at"               // 資料創建時間
  ]
};

/**
 * TECHNICAL_INDICATORS_WEEKLY_METRICS（技術指標週度波動度計算結果）⭐ V8.12 新增
 * 定位：程式計算的硬數據，避免Weekly重新計算技術指標趨勢
 * 主要功能：提供五天內技術指標變化趨勢、與上週比對結果
 */
const TECHNICAL_INDICATORS_WEEKLY_METRICS_SCHEMA = {
  sheetName: "TECHNICAL_INDICATORS_WEEKLY_METRICS",
  headers: [
    "week_start_date",         // 週開始日期
    "week_end_date",           // 週結束日期
    "ticker",                  // 股票代碼
    "rsi_change_range",        // RSI變化範圍（JSON格式：{min, max, change}）
    "macd_divergence",         // MACD背離（JSON格式：{has_divergence, type}）
    "ma_crossovers_json",      // 均線交叉情況（JSON格式）
    "volume_trend",            // 成交量趨勢（INCREASING/DECREASING/STABLE）
    "prev_week_comparison_json", // 與上週對比（JSON格式）
    "created_at"               // 資料創建時間
  ]
};

/**
 * INSTITUTIONAL_RATINGS_LEARNING_LOG（機構評級可信度學習日誌）⭐ V8.9 新增
 * 記錄各大機構在不同時間維度的可信度評分
 */
const INSTITUTIONAL_RATINGS_LEARNING_LOG_SCHEMA = {
  sheetName: "INSTITUTIONAL_RATINGS_LEARNING_LOG",
  headers: [
    "rating_id",               // 評級記錄 ID（關聯到 INSTITUTIONAL_RATINGS_DAILY）
    "ticker",                   // 股票代碼
    "market",                   // 市場
    "rating_firm",              // 機構名稱（標準化後的機構名稱，例如 "GOLDMAN_SACHS"）
    "rating_action",            // 評級動作（標準化後：UPGRADE/DOWNGRADE/MAINTAIN/INITIATE）
    "rating_date",              // 評級發布日期
    "short_term_result",        // 短期（1-5 天）股價反應結果（JSON）
    "mid_term_result",          // 中期（7-15 天）股價反應結果（JSON）
    "long_term_result",         // 長期（16-30 天）股價反應結果（JSON）
    "credibility_score_short",  // 短期可信度評分（根據股價反應計算）
    "credibility_score_mid",    // 中期可信度評分
    "credibility_score_long",   // 長期可信度評分
    "credibility_score_final",  // 最終可信度評分（加權平均：短期 30%、中期 40%、長期 30%）
    "created_at",              // 記錄創建時間
    "updated_at"                // 更新時間（每個時間維度完成後更新）
  ]
};

/**
 * WORLDVIEW_DAILY（每日世界觀快照表，由 P5 Daily 簡單留存）
 * ⭐ V8.0 修正：只做簡單快照留存，不進行推理分析
 * 整週的快照連貫性動態分析是 Weekly 的工作
 */
const WORLDVIEW_DAILY_SCHEMA = {
  sheetName: "WORLDVIEW_DAILY",
  headers: [
    "date",
    "worldview_snapshot_json",  // 世界觀快照（JSON 格式，僅記錄事實）
    "news_summary_json",        // 新聞摘要（JSON 格式，按類別整理）
    "macro_summary_json",       // 宏觀數據摘要（JSON 格式）
    "created_at",
    "version"
  ]
};

/**
 * P5__CALENDAR（財經事件行事曆）
 * ⭐ V8.0 擴展：添加 date_estimated 和 date_source 欄位，支持預估日期自動更新機制
 */
const P5_CALENDAR_SCHEMA = {
  sheetName: "P5__CALENDAR",
  headers: [
    "event_id",
    "date_start",
    "date_end",
    "date_estimated",  // ⭐ V8.0 新增：日期是否為預估（true/false）
    "date_source",     // ⭐ V8.0 新增：日期來源（"OFFICIAL", "ESTIMATED", "CALENDAR"等）
    "market",
    "event_name",
    "event_type",
    "mechanism",
    "pre_window",      // ⭐ V8.0 新增：監控開始天數（事件前 N 天）
    "post_window",    // ⭐ V8.0 新增：監控結束天數（事件後 N 天）
    "prior_weight",
    "prior_confidence",
    "prior_dimensions_json",
    "current_weight",
    "last_updated",
    "learning_history_json",
    "consecutive_success",
    "consecutive_failure",
    "kill_switch_triggered",
    "verification_condition",
    "invalidation_clause",
    "status",
    // ⭐ V8.0 增強：歷史經驗數據
    "historical_performance_json",      // 歷史市場反應數據（JSON：包含 pre_window, event_day, post_window 的歷史表現）
    "monitoring_suggestions_json",      // 監控建議（JSON：追蹤建議列表）
    "risk_warnings_json",               // 風險警示（JSON：風險警示列表）
    "tracking_recommendations_json"     // 追蹤建議（JSON：詳細的監控建議）
  ]
};

/**
 * P5__WEEKLY_SNAPSHOT（P5 Weekly 快照表）
 */
const P5_WEEKLY_SNAPSHOT_SCHEMA = {
  sheetName: "P5__WEEKLY_SNAPSHOT",
  headers: [
    "snapshot_id",
    "created_at",
    "p2_snapshot_id",
    "p3_snapshot_id",
    "p4_snapshot_id",
    "market_analysis_json",
    "causality_chain_json",
    "risk_events_json",
    "derivatives_strategy_adjustment_json",
    "belief_update_json",
    "u_adjustment_json",
    "action_list_json",
    "trigger_decisions_json",
    "version"
  ]
};

/**
 * P5__DAILY_STATUS（P5 Daily 執行狀態）⭐ V8.0 擴展：支持 P5.4 警報數據
 */
const P5_DAILY_STATUS_SCHEMA = {
  sheetName: "P5__DAILY_STATUS",
  headers: [
    "last_execution_date",
    "status",
    "ohlcv_count",
    "sector_etf_count",
    "derivatives_count",
    "news_atoms_count",
    "alerts_json",  // ⭐ V8.0 新增：P5.4 警報數據（JSON 格式）
    "created_at"
  ]
};

/**
 * P5__LEARNING_LOG（學習日誌）
 */
const P5_LEARNING_LOG_SCHEMA = {
  sheetName: "P5__LEARNING_LOG",
  headers: [
    "date",
    "period",
    "type",
    "success_cases_json",
    "failure_cases_json",
    "key_lessons_json",
    "belief_verification_json",
    "systematic_learning_json",
    "event_weight_calibration_json",
    "next_quarter_suggestions_json",
    "created_at"
  ]
};

/**
 * P5__WEEKLY_STOCK_STRATEGIES（P5 Weekly 個股策略表）
 * ⭐ V7.1 新增：保存每週生成的個股策略，用於追蹤和學習
 * ⭐ V8.13 增強：加入數據來源記錄（用於建立數據-策略-結果追蹤鏈）
 */
const P5_WEEKLY_STOCK_STRATEGIES_SCHEMA = {
  sheetName: "P5__WEEKLY_STOCK_STRATEGIES",
  headers: [
    "date",
    "week_id",
    "ticker",
    "strategy",
    "action",
    "target_allocation",
    "current_allocation",
    "confidence",
    "factors_json",
    "order_adjustments_json",
    "reasoning",
    "snapshot_id",
    "data_sources_json",  // ⭐ V8.13 新增：記錄策略使用的數據來源（用於建立數據-策略-結果追蹤鏈）
    "created_at"
  ]
};

/**
 * P5__WEEKLY_STRATEGY_TRACKING（P5 Weekly 策略追蹤結果表）
 * ⭐ V7.1 新增：追蹤策略執行結果，用於學習和優化
 */
const P5_WEEKLY_STRATEGY_TRACKING_SCHEMA = {
  sheetName: "P5__WEEKLY_STRATEGY_TRACKING",
  headers: [
    "tracking_id",
    "date",
    "week_id",
    "strategy_id",
    "ticker",
    "action",
    "target_price",
    "actual_price",
    "execution_status",
    "performance_result",
    "lessons_learned_json",
    "adjustments_json",
    "created_at",
    "updated_at"
  ]
};

/**
 * P5__STRATEGY_SNAPSHOT（策略快照）⭐ V8.13修正：Memory Manager架構
 * 
 * 系統每次輸出策略時寫入，包含當下資料摘要與「可驗證命題（Claims）」
 * 
 * ⚠️ V8.13修正：從Rule Engine轉向Memory Manager
 * - executive_summary：短摘要（必填，<=300字，由Weekly AI生成）
 * - market_tags_json：市場標籤（必填，must in allow-list）
 * - claims_json：MVP claims（DIRECTION / RISK_REGIME / FOCUS_BUCKET）
 * - full_strategy_json：原始大檔（僅存檔，不進Prompt）
 */
const P5_STRATEGY_SNAPSHOT_SCHEMA = {
  sheetName: "P5__STRATEGY_SNAPSHOT",
  headers: [
    "snapshot_id",           // 快照ID（UUID）
    "period_id",             // 時間週期ID（如 2026-W03）
    "period_start",           // 週期開始日期（YYYY-MM-DD）
    "period_end",             // 週期結束日期（YYYY-MM-DD）
    "executive_summary",      // 短摘要（必填，<=300字，由Weekly AI生成）
    "market_tags_json",       // 市場標籤（必填，must in allow-list）
    "claims_json",           // 可驗證命題（Claims MVP only：DIRECTION / RISK_REGIME / FOCUS_BUCKET）
    "full_strategy_json",    // 原始大檔（僅存檔，不進Prompt）
    "data_sources_json",     // 數據來源記錄（JSON格式）
    "created_at"             // 創建時間
  ]
};

/**
 * P5__OUTCOME_SNAPSHOT（結果快照）⭐ V8.13修正：Memory Manager架構
 * 
 * 對應觀察窗結束後寫入（Weekly T+1），形成可回放的追蹤鏈
 * 
 * ⚠️ V8.13修正：
 * - scorecard_json：只做數學計算，禁止解釋
 * - reflection_json：由AI生成（Reflection Agent），不做程式歸因樹
 */
const P5_OUTCOME_SNAPSHOT_SCHEMA = {
  sheetName: "P5__OUTCOME_SNAPSHOT",
  headers: [
    "outcome_id",            // 結果ID（UUID）
    "ref_snapshot_id",       // 對應的策略快照ID（外鍵）
    "period_id",             // 時間週期ID（如 2026-W03）
    "scorecard_json",        // Scorecard（只做數學：accuracy, timing_gap_days, magnitude_bias, max_drawdown）
    "reflection_json",       // Reflection Agent輸出（root_cause, lessons, evidence_pointers, confidence, parameter_suggestions）
    "created_at"             // 創建時間（觀察窗結束後）
  ]
};

/**
 * P5__LEARNING_STATE（學習狀態）⭐ V8.13修正：Calibration Summary + Principles
 * 
 * ⚠️ V8.13重大修正：不再是程式自動調參的控制器，而是「給AI的校準摘要」
 * 
 * 結構：
 * - principles_summary：長期原則（Markdown，<=12條，只允許Monthly更新一次）
 * - active_calibration：建議摘要（供prompt參考，不直接改執行）
 * 
 * Principles更新治理：
 * - 只允許Monthly更新一次（Monthly Review）
 * - 必須去重合併、限制條數（<=12）
 * - 每條原則需附：scope（適用情境）、exceptions（例外）、supporting_cases[]（案例id）、last_updated
 * - 禁止修改SSOT憲法級原則（權責分離等）
 */
const P5_LEARNING_STATE_SCHEMA = {
  sheetName: "P5__LEARNING_STATE",
  headers: [
    "state_id",              // 狀態ID（UUID）
    "updated_at",            // 最後更新時間（只允許Monthly更新）
    "principles_summary",    // 長期原則（Markdown，<=12條）
    "active_calibration"    // 建議摘要（JSON格式；供prompt參考，不直接改執行）
  ]
};

/**
 * P5__SCENARIO_MEMORY（情境記憶）⭐ V8.13修正：Context Retriever（標籤檢索）
 * 
 * ⚠️ V8.13修正：簡化為Tag Retrieval，不再使用複雜的情境簽章
 * 
 * 每週產生market_tags[]（allow-list），寫入strategy/outcome snapshot
 * 使用retrieveSimilarCases(tags)檢索相似歷史案例
 * 
 * 注意：此表格已簡化，主要使用market_tags進行檢索，不再需要複雜的scenario_signature
 * 保留此Schema以備未來擴展，但主要邏輯在Memory Pack Builder中實現
 */
const P5_SCENARIO_MEMORY_SCHEMA = {
  sheetName: "P5__SCENARIO_MEMORY",
  headers: [
    "scenario_id",              // 情境ID（UUID，可選，用於未來擴展）
    "market_tags_json",         // 市場標籤（用於檢索）
    "executive_summary",        // 短摘要（用於Memory Pack）
    "lesson",                   // 教訓（1段）
    "result_summary",           // 結果摘要（1行：return/mdd）
    "evidence_ids_json",        // 證據ID列表（用於追溯）
    "created_at"                // 創建時間
  ]
};

/**
 * P5__MONTHLY_SNAPSHOT（P5 Monthly 快照表）
 */
const P5_MONTHLY_SNAPSHOT_SCHEMA = {
  sheetName: "P5__MONTHLY_SNAPSHOT",
  headers: [
    "snapshot_id",
    "created_at",
    "p2_snapshot_id",
    "p3_snapshot_id",
    "p4_snapshot_id",
    "monthly_trend_analysis_json",
    "portfolio_performance_json",
    "strategy_adjustments_json",
    "institutional_insights_json",
    "version"
  ]
};

/**
 * P5__QUARTERLY_SNAPSHOT（P5 Quarterly 快照表）
 */
const P5_QUARTERLY_SNAPSHOT_SCHEMA = {
  sheetName: "P5__QUARTERLY_SNAPSHOT",
  headers: [
    "snapshot_id",
    "created_at",
    "p2_snapshot_id",
    "p3_snapshot_id",
    "p4_snapshot_id",
    "quarterly_review_json",
    "strategy_review_json",
    "next_quarter_outlook_json",
    "institutional_insights_json",
    "version"
  ]
};

/**
 * MONITORING_LOG（監控日誌）
 */
const MONITORING_LOG_SCHEMA = {
  sheetName: "MONITORING_LOG",
  headers: [
    "timestamp",
    "phase",
    "duration_ms",
    "status",
    "job_id",
    "error_message",
    "cost_estimate"
  ]
};

// ==========================================
// ⭐ V8.0 新增：行事曆相關表格
// ==========================================

/**
 * P5__CALENDAR_HISTORY（行事曆歷史經驗表）⭐ V8.0 新增
 * 存儲重大財經事件的歷史市場反應經驗
 */
const P5_CALENDAR_HISTORY_SCHEMA = {
  sheetName: "P5__CALENDAR_HISTORY",
  headers: [
    "history_id",
    "event_id",
    "event_name",
    "year",
    "window_type",  // PRE_WINDOW / EVENT_DAY / POST_WINDOW / EXTENDED_POST
    "date_range_start",
    "date_range_end",
    "ticker_performance_json",  // {NVDA: +8.2%, TSLA: +6.5%, ...}
    "index_performance_json",  // {name: "納斯達克", change_pct: +3.1%}
    "statistics_json",  // {上漲機率: 70%, 平均漲幅: +4.2%}
    "experience_snapshot_json",  // 完整的經驗快照（JSON）
    "created_at"
  ]
};

/**
 * P5__CALENDAR_MONITORING（行事曆監控記錄表）⭐ V8.0 新增
 * 存儲事件監控期間的關鍵數據記錄
 */
const P5_CALENDAR_MONITORING_SCHEMA = {
  sheetName: "P5__CALENDAR_MONITORING",
  headers: [
    "monitoring_id",
    "event_id",
    "monitoring_date",
    "days_until_event",
    "key_metrics_json",  // Sector ETF Flow, Mag7, VIX 等關鍵數據
    "anomalies_json",  // 異常檢測結果
    "status",  // MONITORING / COMPLETED / CANCELLED
    "created_at"
  ]
};

/**
 * P5__CALENDAR_ALERTS（行事曆異常報警表）⭐ V8.0 新增
 * 存儲事件監控期間的異常報警記錄
 */
const P5_CALENDAR_ALERTS_SCHEMA = {
  sheetName: "P5__CALENDAR_ALERTS",
  headers: [
    "alert_id",
    "event_id",
    "alert_date",
    "anomalies_json",  // 異常列表（JSON）
    "severity",  // HIGH / MEDIUM / LOW
    "status",  // ACTIVE / RESOLVED / DISMISSED
    "created_at"
  ]
};

// ==========================================
// ⭐ V8.0 新增：財報相關表格
// ==========================================

/**
 * EARNINGS_HISTORICAL_EXPERIENCE（財報歷史經驗表）⭐ V8.0 新增
 * 存儲板塊龍頭財報的歷史經驗數據
 */
const EARNINGS_HISTORICAL_EXPERIENCE_SCHEMA = {
  sheetName: "EARNINGS_HISTORICAL_EXPERIENCE",
  headers: [
    "experience_id",
    "ticker",
    "quarter",
    "historical_period",  // 5_YEARS
    "experience_json",  // 完整的歷史經驗數據（JSON）
    "data_source",  // AI_INFERRED / USER_INPUT / CONFIRMED
    "confidence",  // 0-1
    "created_at"
  ]
};

/**
 * EARNINGS_EXPERIENCE_SNAPSHOT（財報經驗快照表）⭐ V8.0 新增
 * 存儲財報歷史經驗的總結快照
 */
const EARNINGS_EXPERIENCE_SNAPSHOT_SCHEMA = {
  sheetName: "EARNINGS_EXPERIENCE_SNAPSHOT",
  headers: [
    "snapshot_id",
    "ticker",
    "summary_date",
    "quarter_summaries_json",  // 按季度分組的總結（JSON）
    "total_experiences",
    "years_covered",
    "created_at"
  ]
};

/**
 * EARNINGS_EXPERIENCE_INDEX（財報經驗索引表）⭐ V8.0 新增
 * 存儲財報歷史經驗的快速索引
 */
const EARNINGS_EXPERIENCE_INDEX_SCHEMA = {
  sheetName: "EARNINGS_EXPERIENCE_INDEX",
  headers: [
    "index_id",
    "ticker",
    "snapshot_id",
    "quarter",
    "beat_probability",  // Beat 機率
    "avg_day_0_change",  // 財報當天平均漲跌幅
    "avg_day_7_change",  // 財報後7天平均漲跌幅
    "risk_warnings_count",  // 風險警示數量
    "last_updated"
  ]
};

/**
 * EARNINGS_LEARNING_MEMORY（財報學習記憶庫）⭐ V8.0 新增
 * 存儲財報後市場反應的學習記憶
 */
const EARNINGS_LEARNING_MEMORY_SCHEMA = {
  sheetName: "EARNINGS_LEARNING_MEMORY",
  headers: [
    "memory_id",
    "ticker",
    "earnings_date",
    "experience_snapshot_json",  // 完整的經驗快照（JSON，包含 quarter 等信息）
    "created_at"
  ]
};

/**
 * HOLDINGS_EARNINGS_INDEX（持股財報索引表）⭐ V8.0 新增
 * 存儲持股財報日期的快速索引
 */
const HOLDINGS_EARNINGS_INDEX_SCHEMA = {
  sheetName: "HOLDINGS_EARNINGS_INDEX",
  headers: [
    "index_id",
    "ticker",
    "total_earnings_dates",
    "next_earnings_date",
    "next_earnings_quarter",
    "last_updated"
  ]
};

// ==========================================
// V7.1 新增表格（DEFCON、對沖、緊急退出、財報戰爭、泡沫導航、供應鏈、產業鏈）
// ==========================================

/**
 * DEFCON_STATUS（DEFCON 狀態表）
 */
const DEFCON_STATUS_SCHEMA = {
  sheetName: "DEFCON_STATUS",
  headers: [
    "timestamp",
    "defcon_level",
    "risk_score",
    "category_scores_json",
    "signal_details_json",
    "u_macro_adjustment",
    "recommendations_json",
    "version"
  ]
};

/**
 * P4_5_HEDGING_SNAPSHOT（P4.5 動態對沖快照表）
 */
const P4_5_HEDGING_SNAPSHOT_SCHEMA = {
  sheetName: "P4_5_HEDGING_SNAPSHOT",
  headers: [
    "snapshot_id",
    "created_at",
    "defcon_level",
    "hedging_strategy_json",
    "hedging_ratio",
    "positions_json",
    "risk_assessment_json",
    "version"
  ]
};

/**
 * P4_6_EMERGENCY_EXIT_LOG（P4.6 緊急退出日誌表）
 * ⚠️ V8.0 變更：此表格已廢棄，功能已搬移到 P6_EMERGENCY_EXIT_LOG
 * 保留此表格僅為向後兼容，新功能請使用 P6_EMERGENCY_EXIT_LOG
 */
const P4_6_EMERGENCY_EXIT_LOG_SCHEMA = {
  sheetName: "P4_6_EMERGENCY_EXIT_LOG",
  headers: [
    "exit_id",
    "timestamp",
    "trigger_reason",
    "trigger_condition_json",
    "positions_exited_json",
    "exit_performance_json",
    "version"
  ]
};

/**
 * P5_5_EARNINGS_RISK（P5.5 財報戰爭風險表）
 */
const P5_5_EARNINGS_RISK_SCHEMA = {
  sheetName: "P5_5_EARNINGS_RISK",
  headers: [
    "risk_id",
    "ticker",
    "earnings_date",
    "days_to_earnings",
    "risk_assessment_json",
    "chip_distribution_json",
    "recommendations_json",
    "created_at",
    "version"
  ]
};

/**
 * EARNINGS_STRATEGIES（財報策略表）⭐ V8.0 新增
 * 
 * 存儲 P5 Weekly 制定的財報 if-then 策略
 * 例如：if 財報 Beat then 加碼 20%
 */
const EARNINGS_STRATEGIES_SCHEMA = {
  sheetName: "EARNINGS_STRATEGIES",
  headers: [
    "strategy_id",
    "ticker",
    "market",
    "earnings_date",
    "strategy_type",  // if_then / conditional
    "condition_json",  // if 條件（例如：{"beat": true, "revenue_growth": 0.20}）
    "action_json",  // then 動作（例如：{"increase_allocation": 0.20, "target_price": 180}）
    "status",  // PENDING / TRIGGERED / EXPIRED
    "created_at",
    "triggered_at",
    "version"
  ]
};

/**
 * EARNINGS_NOTIFICATIONS（財報通知表）⭐ V8.0 新增
 * 
 * 存儲財報相關的通知記錄
 */
const EARNINGS_NOTIFICATIONS_SCHEMA = {
  sheetName: "EARNINGS_NOTIFICATIONS",
  headers: [
    "notification_id",
    "ticker",
    "market",
    "earnings_date",
    "notification_type",  // REMINDER / RESULT / STRATEGY_TRIGGER
    "message",
    "sent_at",
    "status",  // SENT / FAILED
    "created_at"
  ]
};

/**
 * P5_6_BUBBLE_STATUS（P5.6 泡沫導航狀態表）
 */
const P5_6_BUBBLE_STATUS_SCHEMA = {
  sheetName: "P5_6_BUBBLE_STATUS",
  headers: [
    "status_id",
    "timestamp",
    "bubble_level",
    "shiller_pe",
    "liquidity_indicators_json",
    "regime_identification_json",
    "navigation_strategy_json",
    "version"
  ]
};

/**
 * P5_7_SUPPLY_CHAIN_RISK（P5.7 供應鏈風險表）
 */
const P5_7_SUPPLY_CHAIN_RISK_SCHEMA = {
  sheetName: "P5_7_SUPPLY_CHAIN_RISK",
  headers: [
    "risk_id",
    "ticker",
    "supply_chain_map_json",
    "upstream_risks_json",
    "downstream_risks_json",
    "inventory_days",
    "bullwhip_effect_indicators_json",
    "risk_assessment_json",
    "created_at",
    "version"
  ]
};

/**
 * P0_5_INDUSTRY_CHAIN_MAP（P0.5 產業鏈地圖表）
 */
const P0_5_INDUSTRY_CHAIN_MAP_SCHEMA = {
  sheetName: "P0_5_INDUSTRY_CHAIN_MAP",
  headers: [
    "map_id",
    "theme_id",
    "industry_chain_json",
    "node_companies_json",
    "relationships_json",
    "cycle_position_json",
    "created_at",
    "version"
  ]
};

/**
 * PHASE_OUT_PLANS（Phase_Out 計劃表）⭐ V8.0 新增
 * 
 * 存儲持倉整合邏輯中的 Phase_Out 策略
 * 用於記錄不在新清單但 P2 基本面 OK 的股票，逐步減倉計劃
 */
const PHASE_OUT_PLANS_SCHEMA = {
  sheetName: "PHASE_OUT_PLANS",
  headers: [
    "plan_id",
    "ticker",
    "market",
    "company_name",
    "phase_out_reason",  // 不在新清單但 P2 基本面 OK
    "current_allocation_pct",  // 當前配置百分比
    "stop_loss_price",  // 止損價
    "reduction_plan_json",  // 減倉計劃（JSON 格式，包含減倉時間表和百分比）
    "status",  // PENDING / IN_PROGRESS / COMPLETED / CANCELLED
    "created_at",
    "updated_at",
    "completed_at",
    "version"
  ]
};

// ==========================================
// V7.1 新增表格（執行前確認、台股掛單監控）
// ==========================================

/**
 * M0__JOB_CONFIRMATION（執行前確認表）
 */
const M0_JOB_CONFIRMATION_SCHEMA = {
  sheetName: "M0__JOB_CONFIRMATION",
  headers: [
    "confirmation_id",
    "job_id",
    "phase",
    "questions_json",
    "answers_json",
    "status",
    "created_at",
    "confirmed_at"
  ]
};

/**
 * TAIWAN_ORDER_MONITOR（台股掛單監控表）
 */
const TAIWAN_ORDER_MONITOR_SCHEMA = {
  sheetName: "TAIWAN_ORDER_MONITOR",
  headers: [
    "monitor_id",
    "ticker",
    "name",
    "order_type",
    "target_price",
    "quantity",
    "reason",
    "source_phase",
    "current_price",
    "triggered",
    "notified",
    "created_at",
    "triggered_at",
    "notified_at",
    "status"
  ]
};

/**
 * TAIWAN_ORDER_NOTIFICATIONS（台股掛單通知記錄表）
 */
const TAIWAN_ORDER_NOTIFICATIONS_SCHEMA = {
  sheetName: "TAIWAN_ORDER_NOTIFICATIONS",
  headers: [
    "notification_id",
    "monitor_id",
    "ticker",
    "notification_message",
    "sent_at",
    "status"
  ]
};

/**
 * DECISION_CONFLICT_LOG（決策衝突日誌表）
 */
const DECISION_CONFLICT_LOG_SCHEMA = {
  sheetName: "DECISION_CONFLICT_LOG",
  headers: [
    "timestamp",
    "ticker",
    "original_signal",
    "final_decision",
    "conflicts_json",
    "reasons_json",
    "warnings_json"
  ]
};

/**
 * HUMAN_SIGNAL（人工信號輸入表）
 * ⭐ V7.1 新增：用於用戶輸入分析文章、新聞等資訊
 */
const HUMAN_SIGNAL_SCHEMA = {
  sheetName: "HUMAN_SIGNAL",
  headers: [
    "signal_id",
    "date",
    "type",           // ARTICLE / NEWS / ANALYSIS / TRADE_ACTION / OTHER ⭐ V8.17 新增：TRADE_ACTION
    "tags_json",      // ["市場", "個股", "宏觀", "產業"] 等標籤
    "content",        // 文字內容
    "url",            // 來源 URL（如果有）
    "tickers_json",   // 相關股票代碼列表
    "importance",     // LOW / MEDIUM / HIGH / CRITICAL
    "processed",      // true / false（是否已處理）
    "processed_at",
    "processed_by",   // P5_DAILY / MANUAL
    "created_at",
    "created_by",     // USER / SYSTEM
    "human_lock_json" // ⭐ V8.17 地雷修復：Human Lock 配置（JSON：{locked, action, reason, timestamp, expiry}）
  ]
};

/**
 * HOLDINGS（持倉表）
 * ⭐ V7.1 新增：記錄當前持倉股票
 */
const HOLDINGS_SCHEMA = {
  sheetName: "HOLDINGS",
  headers: [
    "ticker",
    "name",
    "market",         // US / JP / TW
    "allocation_pct", // 配置百分比
    "entry_date",
    "entry_price",
    "current_price",
    "current_allocation_pct",
    "status",         // ACTIVE / CLOSED
    "notes",
    "updated_at"
  ]
};

/**
 * PHASE_REVIEW（Phase 結果審查表）⭐ V8.0 新增
 */
const PHASE_REVIEW_SCHEMA = {
  sheetName: "PHASE_REVIEW",
  headers: [
    "review_id",
    "phase",              // P0, P1, P2, P3, P4
    "snapshot_id",        // 對應的快照 ID
    "result_json",        // Phase 結果（JSON 格式）
    "questions_json",     // 審查問題（JSON 格式）
    "answers_json",        // 使用者答案（JSON 格式）
    "status",             // PENDING, APPROVED, REJECTED, SKIPPED
    "user_feedback",      // 使用者意見
    "action_taken",       // CONTINUE, MODIFY, RERUN, SKIP
    "created_at",
    "updated_at"
  ]
};

// ==========================================
// Phase 6 表格（盤中監測系統）⭐ V8.0 新增
// ==========================================

/**
 * P6_INTRADAY_LOG（盤中監測日誌表）
 * ⭐ V8.0 新增：記錄所有盤中監測數據（一般正常情況隔天清除）
 */
const P6_INTRADAY_LOG_SCHEMA = {
  sheetName: "P6_INTRADAY_LOG",
  headers: [
    "log_id",
    "timestamp",
    "date",
    "ticker",
    "market",              // US / TW / JP
    "monitor_type",        // POSITION / OPTION / INDEX / ETF / TRACKING
    "price",
    "price_20min_ago",     // 20 分鐘前價格（20 分鐘動能追蹤）
    "price_change_pct",    // 20 分鐘價格變化百分比
    "volume",
    "volume_avg_20d",      // 20 日平均成交量
    "volume_ratio",        // 成交量倍數
    "atr_14",              // ATR(14) 用於判斷是否急漲急跌
    "is_anomaly",          // 是否異常（TRUE / FALSE）
    "anomaly_type",        // DROP / SPIKE / VOLUME / NONE
    "needs_retention",     // 是否需要保留到 Daily（TRUE / FALSE）
    "created_at"
  ]
};

/**
 * P6_EMERGENCY_EXIT_LOG（緊急撤退記錄表）
 * ⭐ V8.0 新增：從 P4.6 搬移，記錄盤中緊急撤退計劃
 */
const P6_EMERGENCY_EXIT_LOG_SCHEMA = {
  sheetName: "P6_EMERGENCY_EXIT_LOG",
  headers: [
    "exit_id",
    "timestamp",
    "date",
    "trigger_type",        // SINGLE_STOCK_DROP / PORTFOLIO_DROP / INDEX_DROP / FLASH_CRASH / MULTI_VOLUME / DEFCON
    "trigger_details_json", // 觸發詳情（JSON）
    "reduction_pct",       // 減倉比例（寫死，例如 0.5 = 50%）
    "stocks_to_sell_json", // 要賣出的股票列表（JSON）
    "sell_quantities_json", // 每檔股票的賣出數量（JSON）
    "execution_status",    // PENDING / EXECUTED / CANCELLED
    "human_override_json", // 人類調整（JSON，如果有）
    "p5_weekly_analysis_json", // P5 Weekly AI 分析結果（JSON，盤後填入）
    "created_at",
    "updated_at"
  ]
};

/**
 * P6_INTRADAY_ALERTS_DAILY（盤中異常警報表，需保留的數據）
 * ⭐ V8.0 新增：記錄觸發異常的個股或市場詳細數據，需保留到 P5 Daily 日更資料
 */
const P6_INTRADAY_ALERTS_DAILY_SCHEMA = {
  sheetName: "P6_INTRADAY_ALERTS_DAILY",
  headers: [
    "alert_id",
    "date",
    "ticker",
    "market",              // US / TW / JP
    "alert_type",          // DROP / SPIKE / VOLUME / TARGET_PRICE / EARNINGS_TRIGGER / EMERGENCY_EXIT
    "alert_severity",      // LOW / MEDIUM / HIGH / CRITICAL
    "trigger_time",        // 觸發時間
    "price_data_json",     // 詳細價格數據（JSON）
    "volume_data_json",    // 詳細成交量數據（JSON）
    "technical_data_json", // 技術指標數據（JSON）
    "trigger_condition_json", // 觸發條件詳情（JSON）
    "action_taken_json",   // 執行動作（JSON）
    "integrated_to_daily", // 是否已整合到 P5 Daily（TRUE / FALSE）
    "p5_daily_reference",  // P5 Daily 表格引用（例如：MARKET_OHLCV_DAILY 的 row_id）
    "created_at",
    "updated_at"
  ]
};

/**
 * UI_CONTROL_PANEL（UI 控制面板表）
 * ⭐ V7.1 新增：用於 UI 狀態和快速操作
 */
const UI_CONTROL_PANEL_SCHEMA = {
  sheetName: "UI_CONTROL_PANEL",
  headers: [
    "key",
    "value",
    "updated_at"
  ]
};

// ==========================================
// 初始化所有表格的函數
// ==========================================

/**
 * 初始化所有必要的表格（如果不存在則創建）
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - Spreadsheet 對象（可選，如果不提供則自動獲取）
 */
function initializeAllSheets(ss) {
  // 如果 ss 未提供，自動獲取當前活動的 Spreadsheet
  if (!ss) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  if (!ss) {
    throw new Error("無法獲取 Spreadsheet 對象，請確保在 Google Sheets 中執行此函數");
  }
  
  const sheetsToCreate = [
    M0_JOB_QUEUE_SCHEMA,
    M0_RESULT_SCHEMA,
    M0_CROSSCHECK_LOG_SCHEMA,
    M0_BATCH_JOBS_SCHEMA,  // ⭐ V8.17 新增：Batch API 任務追蹤
    SYS_EXTERNAL_CONTRACTS_SCHEMA,
    P0_SNAPSHOT_SCHEMA,
    P0_5_SNAPSHOT_SCHEMA,  // ⭐ V8.0 新增：P0.5 快照表
    P0_7_SNAPSHOT_SCHEMA,
    P1_SNAPSHOT_SCHEMA,
    PHASE1_COMPANY_POOL_SCHEMA,  // ⭐ V8.14 新增：統一公司池（取代舊的三池分類，用於存儲 P1 提取結果）
    PHASE1_MASTER_CANDIDATES_SCHEMA,
    PHASE1_TRACKING_POOL_SCHEMA,
    PHASE1_REJECTION_POOL_SCHEMA,
    P2_SNAPSHOT_SCHEMA,
    PHASE2_OUTPUT_SCHEMA,
    P2_5_SNAPSHOT_SCHEMA,  // ⭐ V8.0 新增：P2.5 快照表（籌碼成本定錨）
    PHASE2_5_OUTPUT_SCHEMA,  // ⭐ V8.0 新增：P2.5 輸出表
    P3_SNAPSHOT_SCHEMA,
    MARKET_OHLCV_DAILY_SCHEMA,
    MARKET_INDICATORS_DAILY_SCHEMA,
    P4_SNAPSHOT_SCHEMA,
    SECTOR_ETF_DAILY_SCHEMA,
    DERIVATIVES_DAILY_SCHEMA,
    SMART_MONEY_DAILY_SCHEMA,
    SMART_MONEY_WEEKLY_SCHEMA,  // ⭐ V8.0 新增：籌碼面週報
    MACRO_DATA_DAILY_SCHEMA,  // ⭐ V7.1 新增：宏觀數據
    NEWS_ATOMS_DAILY_SCHEMA,
    STOCK_NEWS_INDEX_DAILY_SCHEMA,  // ⭐ V8.12 新增：個股新聞索引（反向索引）
    SECTOR_NEWS_INDEX_DAILY_SCHEMA,  // ⭐ V8.12 新增：板塊/產業新聞索引
    EVENTS_INDEX_WEEKLY_SCHEMA,  // ⭐ V8.12 新增：事件索引（週度）
    MACRO_DATA_WEEKLY_METRICS_SCHEMA,  // ⭐ V8.12 新增：宏觀數據週度波動度
    TECHNICAL_INDICATORS_WEEKLY_METRICS_SCHEMA,  // ⭐ V8.12 新增：技術指標週度波動度
    INSTITUTIONAL_RATINGS_DAILY_SCHEMA,  // ⭐ V8.9 新增：機構評級獨立資料庫
    INSTITUTIONAL_RATINGS_LEARNING_LOG_SCHEMA,  // ⭐ V8.9 新增：機構評級可信度學習日誌
    WORLDVIEW_DAILY_SCHEMA,  // ⭐ V7.1 新增：世界觀更新
    P5_CALENDAR_SCHEMA,
    P5_WEEKLY_SNAPSHOT_SCHEMA,
    P5_DAILY_STATUS_SCHEMA,
    P5_LEARNING_LOG_SCHEMA,
    P5_WEEKLY_STOCK_STRATEGIES_SCHEMA,  // ⭐ V7.1 新增：個股策略追蹤表
    P5_WEEKLY_STRATEGY_TRACKING_SCHEMA,  // ⭐ V7.1 新增：策略追蹤結果表
    MONITORING_LOG_SCHEMA,
    // V7.1 新增表格
    DEFCON_STATUS_SCHEMA,
    P4_5_HEDGING_SNAPSHOT_SCHEMA,
    P4_6_EMERGENCY_EXIT_LOG_SCHEMA,
    P5_5_EARNINGS_RISK_SCHEMA,
    EARNINGS_STRATEGIES_SCHEMA,  // ⭐ V8.0 新增：財報策略表
    EARNINGS_NOTIFICATIONS_SCHEMA,  // ⭐ V8.0 新增：財報通知表
    P5_6_BUBBLE_STATUS_SCHEMA,
    P5_7_SUPPLY_CHAIN_RISK_SCHEMA,
    P0_5_INDUSTRY_CHAIN_MAP_SCHEMA,
    // V7.1 執行前確認與台股掛單監控
    M0_JOB_CONFIRMATION_SCHEMA,
    TAIWAN_ORDER_MONITOR_SCHEMA,
    TAIWAN_ORDER_NOTIFICATIONS_SCHEMA,
    // V7.1 決策權限系統
    DECISION_CONFLICT_LOG_SCHEMA,
    // V7.1 P5 Monthly/Quarterly 快照
    P5_MONTHLY_SNAPSHOT_SCHEMA,
    P5_QUARTERLY_SNAPSHOT_SCHEMA,
    // V7.1 UI 系統
    HUMAN_SIGNAL_SCHEMA,
    HOLDINGS_SCHEMA,
    UI_CONTROL_PANEL_SCHEMA,
    // V8.0 Phase Review 系統
    PHASE_REVIEW_SCHEMA,
    // V8.0 持倉整合系統
    PHASE_OUT_PLANS_SCHEMA,  // ⭐ V8.0 新增：Phase_Out 計劃表
    // V8.0 P6 盤中監測系統
    P6_INTRADAY_LOG_SCHEMA,  // ⭐ V8.0 新增：盤中監測日誌
    P6_EMERGENCY_EXIT_LOG_SCHEMA,  // ⭐ V8.0 新增：緊急撤退記錄（從 P4.6 搬移）
    P6_INTRADAY_ALERTS_DAILY_SCHEMA  // ⭐ V8.0 新增：盤中異常警報（需保留的數據）
  ];
  
  for (const schema of sheetsToCreate) {
    let sheet = ss.getSheetByName(schema.sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(schema.sheetName);
      sheet.appendRow(schema.headers);
      
      // 凍結標題行
      sheet.setFrozenRows(1);
      
      Logger.log(`創建表格：${schema.sheetName}`);
    } else {
      // 檢查標題是否匹配
      const existingHeaders = sheet.getRange(1, 1, 1, schema.headers.length).getValues()[0];
      const headersMatch = JSON.stringify(existingHeaders) === JSON.stringify(schema.headers);
      
      if (!headersMatch) {
        Logger.log(`警告：表格 ${schema.sheetName} 的標題不匹配，請檢查`);
      }
    }
  }
  
  Logger.log("所有表格初始化完成");
}

/**
 * 執行初始化（供手動調用或觸發器調用）
 */
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  initializeAllSheets(ss);
  // ⭐ V8.0 新增：遷移現有表格以支持新欄位
  migrateSheetsToV8_0(ss);
}

/**
 * 遷移現有表格到 V8.0 架構（添加新欄位）
 * ⭐ V8.0 新增：自動更新現有表格的標題以支持新功能
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - Spreadsheet 對象（可選，如果不提供則自動獲取）
 */
function migrateSheetsToV8_0(ss) {
  try {
    // 如果 ss 未提供，自動獲取當前活動的 Spreadsheet
    if (!ss) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    if (!ss) {
      Logger.log("警告：無法獲取 Spreadsheet 對象，跳過表格遷移");
      return;
    }
    
    Logger.log("開始遷移表格到 V8.0...");
    
    // 1. 更新 P5__DAILY_STATUS：添加 alerts_json 欄位
    const p5DailyStatusSheet = ss.getSheetByName("P5__DAILY_STATUS");
    if (p5DailyStatusSheet) {
      const currentHeaders = p5DailyStatusSheet.getRange(1, 1, 1, p5DailyStatusSheet.getLastColumn()).getValues()[0];
      const expectedHeaders = P5_DAILY_STATUS_SCHEMA.headers;
      
      // 檢查是否缺少 alerts_json 欄位
      if (currentHeaders.indexOf("alerts_json") === -1) {
        Logger.log("更新 P5__DAILY_STATUS：添加 alerts_json 欄位");
        // 在 news_atoms_count 之後插入 alerts_json
        const newsAtomsIndex = currentHeaders.indexOf("news_atoms_count");
        if (newsAtomsIndex !== -1) {
          p5DailyStatusSheet.insertColumnAfter(newsAtomsIndex + 1);
          p5DailyStatusSheet.getRange(1, newsAtomsIndex + 2).setValue("alerts_json");
          Logger.log("✓ P5__DAILY_STATUS 已更新：添加 alerts_json 欄位");
        }
      }
    }
    
    // 2. 更新 NEWS_ATOMS_DAILY：確保有 macro_context_json 欄位
    const newsAtomsSheet = ss.getSheetByName("NEWS_ATOMS_DAILY");
    if (newsAtomsSheet) {
      const currentHeaders = newsAtomsSheet.getRange(1, 1, 1, newsAtomsSheet.getLastColumn()).getValues()[0];
      const expectedHeaders = NEWS_ATOMS_DAILY_SCHEMA.headers;
      
      // 檢查是否缺少 macro_context_json 欄位
      if (currentHeaders.indexOf("macro_context_json") === -1) {
        Logger.log("更新 NEWS_ATOMS_DAILY：添加 macro_context_json 欄位");
        // 在 url 之後插入 macro_context_json
        const urlIndex = currentHeaders.indexOf("url");
        if (urlIndex !== -1) {
          newsAtomsSheet.insertColumnAfter(urlIndex + 1);
          newsAtomsSheet.getRange(1, urlIndex + 2).setValue("macro_context_json");
          Logger.log("✓ NEWS_ATOMS_DAILY 已更新：添加 macro_context_json 欄位");
        }
      }
    }
    
    // 3. 更新 P5__CALENDAR：添加 date_estimated 和 date_source 欄位 ⭐ V8.0 新增
    const p5CalendarSheet = ss.getSheetByName("P5__CALENDAR");
    if (p5CalendarSheet) {
      const currentHeaders = p5CalendarSheet.getRange(1, 1, 1, p5CalendarSheet.getLastColumn()).getValues()[0];
      const expectedHeaders = P5_CALENDAR_SCHEMA.headers;
      
      // 檢查是否缺少 date_estimated 欄位
      if (currentHeaders.indexOf("date_estimated") === -1) {
        Logger.log("更新 P5__CALENDAR：添加 date_estimated 欄位");
        // 在 date_end 之後插入 date_estimated
        const dateEndIndex = currentHeaders.indexOf("date_end");
        if (dateEndIndex !== -1) {
          p5CalendarSheet.insertColumnAfter(dateEndIndex + 1);
          p5CalendarSheet.getRange(1, dateEndIndex + 2).setValue("date_estimated");
          Logger.log("✓ P5__CALENDAR 已更新：添加 date_estimated 欄位");
        }
      }
      
      // 檢查是否缺少 date_source 欄位
      if (currentHeaders.indexOf("date_source") === -1) {
        Logger.log("更新 P5__CALENDAR：添加 date_source 欄位");
        // 在 date_estimated 之後插入 date_source
        const dateEstimatedIndex = currentHeaders.indexOf("date_estimated");
        if (dateEstimatedIndex !== -1) {
          p5CalendarSheet.insertColumnAfter(dateEstimatedIndex + 1);
          p5CalendarSheet.getRange(1, dateEstimatedIndex + 2).setValue("date_source");
          Logger.log("✓ P5__CALENDAR 已更新：添加 date_source 欄位");
        } else {
          // 如果 date_estimated 也不存在，在 date_end 之後插入
          const dateEndIndex = currentHeaders.indexOf("date_end");
          if (dateEndIndex !== -1) {
            p5CalendarSheet.insertColumnAfter(dateEndIndex + 1);
            p5CalendarSheet.getRange(1, dateEndIndex + 2).setValue("date_source");
            Logger.log("✓ P5__CALENDAR 已更新：添加 date_source 欄位");
          }
        }
      }
    }
    
    Logger.log("表格遷移到 V8.0 完成");
  } catch (error) {
    Logger.log(`表格遷移失敗：${error.message}`);
    // 不中斷流程，只記錄錯誤
  }
}
