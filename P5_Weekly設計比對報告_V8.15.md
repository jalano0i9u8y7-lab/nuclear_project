# P5 Weekly 設計比對報告（V8.15）

## 📋 報告目的

比對「P5 Weekly 工程增強修改建議」與現有程式碼設計，找出：
1. **已實現**的部分
2. **需要增強補充**的部分
3. **被省略的原設計**

---

## 📊 一、核心設計比對

### **1. Strategy Skeleton + AI Parameter Layer** ⭐ **重要**

#### **討論內容要求**：
- 新增概念：Strategy Skeleton（策略骨架）
  - 由程式生成，AI 不得修改結構
  - 包含 `buy_ladder`、`sell_ladder`、`risk_frame`
- AI 只輸出「參數調整向量」，不輸出價位
  - `parameter_adjustment_vector`：`buy_bias`、`sell_bias`、`ladder_spacing_adjustment`、`trailing_stop_tightness`、`max_position_cap_override`
- 實際掛單價格 = 程式套公式算出

#### **現有程式碼狀態**：
- ❌ **未實現**：沒有 Strategy Skeleton 概念
- ❌ **未實現**：AI 仍然輸出完整策略（包含價位）
- ✅ **部分實現**：有 Batch 機制（`generateStockStrategiesInBatches`）
- ✅ **部分實現**：有因子權重參考配置（`FACTOR_WEIGHTS_REFERENCE`）

#### **需要增強**：
- ⏳ **待實現**：導入 Strategy Skeleton 概念
- ⏳ **待實現**：修改 AI Prompt，要求只輸出 Parameter Adjustment Vector
- ⏳ **待實現**：程式根據 Skeleton + Adjustment Vector 計算實際掛單價格

---

### **2. 雙層 AI 架構（P5-B / P5-A）** ⭐ **重要**

#### **討論內容要求**：
- **Layer 1：P5-B（Weekly State Evaluator）**：
  - 每檔都跑（低成本）
  - 模型：Claude Sonnet 4.5
  - 輸出：`state_vector`、`parameter_adjustment_vector`、`escalation_score`
- **Layer 2：P5-A（Weekly Deep Re-evaluation）**：
  - 僅升級少數（10-20%）
  - 觸發 Gate：`escalation_score > 0.6`、`trend_integrity < 0.4`、`distribution_risk > 0.7`、`chain_dynamics_signal === "DIVERGENCE"`
  - 模型：Claude Sonnet 4.5 或 Opus（極少數）

#### **現有程式碼狀態**：
- ❌ **未實現**：沒有雙層架構
- ✅ **部分實現**：有 Batch 機制（可視為輕量處理）
- ❌ **未實現**：沒有 Escalation Gate 機制
- ❌ **未實現**：沒有 `state_vector`、`escalation_score` 概念

#### **需要增強**：
- ⏳ **待實現**：建立 P5-B / P5-A 雙層架構
- ⏳ **待實現**：實現 Escalation Gate 邏輯
- ⏳ **待實現**：P5-B 輸出 `state_vector` 和 `escalation_score`
- ⏳ **待實現**：P5-A 觸發條件判斷

---

### **3. Weekly Snapshot 必須納入的資料** ⭐ **重要**

#### **討論內容要求**：
必須納入（缺一不可）：
- P0–P2 Snapshot（只讀）
- P3 上一版結論（結構、偏多偏空）
- Chain Dynamics Monitor JSON（若該產業啟用）
- Daily 新聞索引（摘要，不是全文）
- Dynamic Learning System：`STRATEGY_SNAPSHOT`、`OUTCOME_SNAPSHOT`、`LEARNING_STATE`
- 重大財經行事曆：FOMC / CPI / 非農、板塊龍頭財報
- 上週策略執行結果：是否成交、持股變化、平均成本

#### **現有程式碼狀態**：
- ✅ **已實現**：讀取 P2/P3/P4 快照（`getLatestP2Snapshot()`、`getLatestP3Snapshot()`、`getLatestP4Snapshot()`）
- ✅ **已實現**：讀取 Daily 新聞索引（V8.12 優化）
- ✅ **已實現**：讀取 Sector Flow（V8.12 優化）
- ⚠️ **部分實現**：讀取 Chain Dynamics Monitor（需要確認是否完整）
- ⚠️ **部分實現**：Dynamic Learning System（V8.13 設計，需要確認是否完整實現）
- ❌ **未實現**：重大財經行事曆整合（需要確認）
- ❌ **未實現**：上週策略執行結果整合（需要確認）

#### **需要增強**：
- ⏳ **待確認**：Chain Dynamics Monitor JSON 是否完整讀取
- ⏳ **待確認**：Dynamic Learning System 是否完整實現（STRATEGY_SNAPSHOT、OUTCOME_SNAPSHOT、LEARNING_STATE）
- ⏳ **待實現**：重大財經行事曆整合（FOMC / CPI / 非農、板塊龍頭財報）
- ⏳ **待實現**：上週策略執行結果整合（是否成交、持股變化、平均成本）

---

### **4. 動態學習系統在 Weekly 的角色明確化** ⭐ **重要**

#### **討論內容要求**：
- 學習不是改策略，學習是調整信任度與偏好
- 學習影響的是「參數邊界」，不是策略結構
- 輸出：`learning_feedback`（`similar_past_scenarios`、`historical_outcome_bias`、`parameter_bias_adjustment`）

#### **現有程式碼狀態**：
- ✅ **已實現**：V8.13 動態學習系統設計（策略比對機制）
- ⚠️ **部分實現**：`compareStrategyWithReality()` 已實現，但需要確認是否完整
- ❌ **未實現**：`learning_feedback` 結構（`similar_past_scenarios`、`historical_outcome_bias`、`parameter_bias_adjustment`）

#### **需要增強**：
- ⏳ **待確認**：動態學習系統是否完整實現
- ⏳ **待實現**：`learning_feedback` 結構整合到 Weekly 輸出

---

### **5. Sector ETF Flow 與 Mag 7 分析** ⭐ **補強 1**

#### **討論內容要求**：
- P5-B Input 明確新增：`macro_flow_context`
  - `sector_etf_flow`：`sector`、`weekly_flow_usd`、`trend`、`source`
  - `mag7_relative_strength`：`vs_sp500`、`trend`
- P5-B Prompt 補一句：在判斷 `momentum_shift` 時，Sector ETF Flow 與 Mag7 相對強弱為高優先權因子

#### **現有程式碼狀態**：
- ✅ **已實現**：Sector ETF Flow 分析（V8.12）
- ⚠️ **部分實現**：Mag 7 分析（V8.0 設計，需要確認是否完整）
- ❌ **未實現**：`macro_flow_context` 結構化輸入
- ❌ **未實現**：P5-B Prompt 中明確標註 Sector Flow 和 Mag7 優先權

#### **需要增強**：
- ⏳ **待確認**：Mag 7 分析是否完整實現
- ⏳ **待實現**：`macro_flow_context` 結構化輸入
- ⏳ **待實現**：P5-B Prompt 中明確標註 Sector Flow 和 Mag7 優先權

---

### **6. P2.5 籌碼面異常 → Escalation Gate** ⭐ **補強 2**

#### **討論內容要求**：
- Escalation Gate 修改（硬觸發）：
  ```javascript
  if (
    p2_5.insider_selling_alert === true ||
    p2_5.abnormal_13f_distribution === true
  ) {
    escalate_to_P5A({
      reason: "P2.5_CHIP_ALERT",
      priority: "HIGH",
      override_score: true
    });
  }
  ```
- 輸出標記：`forced_escalation`（`trigger`、`type`、`confidence`、`note`）

#### **現有程式碼狀態**：
- ✅ **已實現**：P2.5 籌碼面數據讀取（`smartMoneyData`）
- ✅ **已實現**：籌碼面因子計算（`calculateSmartMoneyFactor()`）
- ❌ **未實現**：P2.5 異常 → Escalation Gate 硬觸發
- ❌ **未實現**：`forced_escalation` 輸出標記

#### **需要增強**：
- ⏳ **待實現**：P2.5 異常 → Escalation Gate 硬觸發邏輯
- ⏳ **待實現**：`forced_escalation` 輸出標記

---

### **7. 最終產出（對齊 IB 批次下單）** ⭐ **重要**

#### **討論內容要求**：
- P5 Weekly 最終輸出（給交易系統）：
  ```json
  {
    "weekly_trade_actions": [
      {
        "ticker": "NVDA",
        "cancel_previous_orders": true,
        "new_orders": [
          {"type": "BUY", "price": 123.4, "qty": 100},
          {"type": "SELL", "price": 145.6, "qty": 100}
        ],
        "strategy_version": "W2026-03"
      }
    ]
  }
  ```

#### **現有程式碼狀態**：
- ✅ **已實現**：個股策略生成（`generateStockStrategiesInBatches`）
- ❌ **未實現**：`weekly_trade_actions` 結構化輸出
- ❌ **未實現**：`cancel_previous_orders` 邏輯
- ❌ **未實現**：`strategy_version` 標記

#### **需要增強**：
- ⏳ **待實現**：`weekly_trade_actions` 結構化輸出
- ⏳ **待實現**：`cancel_previous_orders` 邏輯
- ⏳ **待實現**：`strategy_version` 標記

---

## 📝 二、已實現功能清單

1. ✅ **Batch 機制**：`generateStockStrategiesInBatches()`（3 檔/批）
2. ✅ **因子權重參考配置**：`FACTOR_WEIGHTS_REFERENCE`
3. ✅ **P2/P3/P4 快照讀取**：`getLatestP2Snapshot()`、`getLatestP3Snapshot()`、`getLatestP4Snapshot()`
4. ✅ **Daily 新聞索引**：V8.12 優化（`STOCK_NEWS_INDEX_DAILY`、`SECTOR_NEWS_INDEX_DAILY`）
5. ✅ **Sector Flow 分析**：V8.12 實現
6. ✅ **籌碼面數據讀取**：`smartMoneyData`、`calculateSmartMoneyFactor()`
7. ✅ **動態學習系統設計**：V8.13 設計（策略比對機制）
8. ✅ **個股策略生成**：`generateStockStrategiesInBatches()`

---

## ⏳ 三、待實現功能清單

### **高優先級（核心設計）**：
1. ⏳ **Strategy Skeleton 概念**：導入策略骨架，AI 只輸出參數調整向量
2. ⏳ **雙層 AI 架構**：P5-B（每檔都跑）+ P5-A（僅升級少數）
3. ⏳ **Escalation Gate 機制**：觸發條件判斷（`escalation_score`、`trend_integrity`、`distribution_risk`、`chain_dynamics_signal`）
4. ⏳ **Parameter Adjustment Vector**：AI 只輸出參數調整，不輸出價位
5. ⏳ **程式計算掛單價格**：根據 Skeleton + Adjustment Vector 計算實際掛單價格

### **中優先級（補強設計）**：
6. ⏳ **重大財經行事曆整合**：FOMC / CPI / 非農、板塊龍頭財報
7. ⏳ **上週策略執行結果整合**：是否成交、持股變化、平均成本
8. ⏳ **`macro_flow_context` 結構化輸入**：Sector Flow + Mag7 相對強弱
9. ⏳ **P2.5 異常 → Escalation Gate 硬觸發**：`insider_selling_alert`、`abnormal_13f_distribution`
10. ⏳ **`forced_escalation` 輸出標記**：記錄強制升級原因

### **低優先級（輸出格式）**：
11. ⏳ **`weekly_trade_actions` 結構化輸出**：對齊 IB 批次下單
12. ⏳ **`cancel_previous_orders` 邏輯**：取消上一週掛單
13. ⏳ **`strategy_version` 標記**：策略版本追蹤
14. ⏳ **`learning_feedback` 結構整合**：動態學習反饋

---

## 🔍 四、被省略的原設計

### **需要確認是否被省略**：
1. ❓ **P0.5 Chain Dynamics Monitor 完整讀取**：需要確認是否完整整合到 Weekly
2. ❓ **Dynamic Learning System 完整實現**：需要確認 STRATEGY_SNAPSHOT、OUTCOME_SNAPSHOT、LEARNING_STATE 是否完整實現
3. ❓ **Mag 7 分析完整實現**：需要確認是否完整實現（V8.0 設計）

---

## 📋 五、實施優先級建議

### **Phase 1：核心架構重構**（必須先完成）
1. Strategy Skeleton 概念導入
2. 雙層 AI 架構（P5-B / P5-A）
3. Escalation Gate 機制
4. Parameter Adjustment Vector 輸出

### **Phase 2：數據整合補強**（核心架構完成後）
5. 重大財經行事曆整合
6. 上週策略執行結果整合
7. `macro_flow_context` 結構化輸入
8. P2.5 異常 → Escalation Gate 硬觸發

### **Phase 3：輸出格式優化**（最後完成）
9. `weekly_trade_actions` 結構化輸出
10. `cancel_previous_orders` 邏輯
11. `strategy_version` 標記
12. `learning_feedback` 結構整合

---

**報告完成日期**：2026-01-19  
**版本**：V8.15  
**狀態**：✅ **比對完成，待討論定案**
