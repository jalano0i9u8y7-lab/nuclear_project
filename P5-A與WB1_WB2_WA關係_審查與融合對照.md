# P5-A 與 WB-1 / WB-2 / W-A 關係 — 審查與融合對照

**狀態**：✅ **已定案**（2026-01-26）；**已納入 SSOT V8.30**（模型配置表 + Weekly_final 流程與產出專節）。  
**日期**：2026-01-26  
**依據**：您整理的流程 + SSOT V8.0 + Weekly-B 討論整理待定案

---

## 一、審查結論摘要

- **原設計與新設計的融合方向正確**，兩條觸發鏈（世界觀劇變 vs 個股 escalation）與 WB-1 → W-A → WB-2 的角色切分一致。
- **W-A 雙重角色**（世界觀重建審查 + 個股 escalation 審查）與「僅兩種情況觸發」的敘述正確對齊。
- 以下為**已正確融合**的對照、**建議明文化補強**（原設計不可遺漏）。**P0 不因個股 escalation 重跑**：產業論述（P0）不涉及個股，產業面變化已有季度與重跑機制，W-A 觸發個股重跑維持 **P1–P4** 即可。

---

## 二、您整理中「已正確融合」的對照

| 您的整理 | 原 SSOT / 討論稿 | 對齊結果 |
|----------|------------------|----------|
| 原 P5-A 設計：僅觸發 escalation 的持股才做「從頭健檢」；其餘同策略下輕度更新（價量/新聞/籌碼/掛單調整） | P5-B 每檔都跑 → escalation 門檻 → P5-A 僅升級少數；Strategy Skeleton + parameter_adjustment_vector | ✅ 一致；您把「輕度 vs 重度」對應到「同策略微調 vs 從頭檢討」 |
| WB-1 宏觀：統整與分析當週宏觀 → 連結上週世界觀 → 同向/中性/反向/轉折/劇變 → 當週世界觀快照 | B1 世界觀/身份判讀、framework_stability_score、rebuild_recommendation | ✅ 一致；您補強了「分析」與「連貫性判斷」 |
| 世界觀劇變 → W-A 先審查 WB-1 重建要求 → 審查報告 → 合理則重建 → 系統在新世界觀下工作 | B1 rebuild_recommendation = YES → Weekly-A(o3) 重建 | ✅ 一致；您新增「先審查再重建」為合理補強 |
| WB-1 個股：融合分析本週個股新資訊 → 當週個股狀態快照；觸發 escalation → 送 W-A 審查 + P1–P4 更新 + WB-2 重度 | P5-B 每檔 state_vector / escalation_score；觸發 → P5-A 深度覆審 | ✅ 一致；您將 P5-A 拆成「W-A 審查報告 + P1–P4 重跑 + WB-2 重度更新」 |
| 未觸發 escalation → 送 WB-2 同策略輕度更新（掛單/倉位等） | P5-B 未升級者僅由 B2 產出策略/掛單 | ✅ 一致 |
| WB-2：兩類個股（輕度/重度）各自結合當週資訊產出本週策略 | B2 輸入 B1 或 NEW_WORLDVIEW_FRAMEWORK + P2/P2.5/P3 等，產出策略/掛單 | ✅ 一致；重度路徑需強調 W-A 報告與緊急調整 |
| W-A 僅兩種觸發：① 世界觀劇變 ② 個股原分析結論改變（escalation） | 討論稿：Weekly-A(o3) 世界觀重建 + P5-A 個股深度覆審 兩條鏈 | ✅ 一致 |

---

## 三、原設計需「明文化融合」的項目（不可遺漏）

以下在原 SSOT / 實作中已存在，建議在定案時寫進 WB-1 / WB-2 / W-A 流程說明，避免遺漏。

### 3.1 資料與上下文（WB-1 / WB-2 輸入）

- **Delta Pack**：變動分三層（Market / Sector / Stock），What changed / Why / So what；WB-1 個股分析與 WB-2 應繼續使用。
- **Learning State / learning_feedback**：principles_summary、recent_reflections、similar_failure_cases、safety_lock_recommendations、parameter_bias_adjustment；WB-2 必須可讀取並在 Prompt 中要求參考。
- **記憶包（三層記憶）**：STM 6 週、MTM 7–12 週、LTM 教訓；WB-1 宏觀/個股與 WB-2 決策應可讀取。
- **重大行事曆與事件權重**：FOMC/CPI/非農、板塊龍頭財報、持股財報；當週/高優先級事件在決策中的最高權重規則（含 WB-2）需保留。
- **Sector ETF Flow / Mag7**：macro_flow_context 在判斷 momentum_shift 與風險時為高優先權因子；WB-1 個股狀態或 WB-2 輸入應保留。

### 3.2 Escalation 觸發條件（維持不縮減）

- **硬觸發**：`p2_5.insider_selling_alert === true`、`p2_5.abnormal_13f_distribution === true` → 強制進入 W-A 審查 + P1–P4 更新 + WB-2 重度。
- **軟觸發**：`escalation_score ≥ 0.6`（含 trend_integrity、distribution_risk、chain_dynamics_signal、P6 SURGE、Milestone 達標/錯過/接近等）；計算方式與現行 `calculateEscalationScore()` 邏輯一致，僅「觸發後動作」改為 W-A 審查 + P1–P4 + WB-2 重度。

### 3.3 WB-2 產出與品質（原 P5-B/B2 設計）

- **Strategy Skeleton**：由程式產生（buy_ladder、sell_ladder、risk_frame），AI 不改結構；**輕度路徑**仍為 Skeleton + parameter_adjustment_vector。
- **Validator**：對 WB-2 輸出做 schema / range / rule / drift 驗證（原 P5-B Validator 精神）；重度路徑若有獨立產出格式，也需定義驗證規則。
- **最終產出**：weekly_trade_actions（cancel_previous_orders、new_orders、strategy_version）、order_validity/expiration_date（GTD）；WB-2 產出仍對齊此結構。

### 3.4 世界觀重建（W-A 宏觀路徑）

- **觸發條件**：WB-1 宏觀產出「世界觀劇變」且通過 W-A 審查；對應討論稿之 rebuild_recommendation = YES（如 FRAMEWORK_STABILITY_SCORE < 60）。
- **重建產出**：NEW_WORLDVIEW_FRAMEWORK（worldview_version_bump、new_assumption_set、new_risk_transmission_graph、deprecated_heuristics、updated_watchlist）；寫入版本化快照，WB-2 讀取「當前有效框架」。

### 3.5 執行順序（建議明文化）

1. **WB-1 宏觀** → 當週世界觀快照；若劇變 → **W-A 審查** → 通過則重建 → 系統切換至新世界觀。
2. **WB-1 個股** → 每檔當週個股狀態快照 + escalation 判定；未觸發 → 標記「輕度」；觸發 → **W-A 個股審查**（報告）→ **P1–P4 完整更新** → 標記「重度」並附 W-A 報告。
3. **WB-2**：在**已確定的世界觀**下，對兩類個股分別產出本週策略（輕度：同策略微調；重度：含 W-A 報告與緊急調整結論）。

確保「世界觀重建若發生，必須在 WB-2 之前完成」，以便 WB-2 一律在最新框架下產出。

---

## 四、P0 不納入個股 escalation 重跑（定案）

- **產業論述（P0）**不涉及個股，理應不需因個股變化而重跑。
- **產業面變化**已有季度與重跑機制，故 W-A 觸發的個股重跑維持 **P1–P4** 即可。
- **escalation 重跑範圍**：**P1–P4**（不含 P0）。

---

## 五、新設計 AI 模型選用（定案）

| 階段 | 分析（執行） | 審查 | 備註 |
|------|----------------|------|------|
| **WB-1** | Hermes 4 405B | 無（沒觸發時無審查） | 宏觀世界觀 + 個股狀態快照與 escalation 判定；僅觸發時才進 W-A |
| **WB-2** | Hermes 4 405B | o3（原廠 batch） | 兩類個股（輕度/重度）產出本週策略、掛單 |
| **W-A** | — | o3（不 batch） | 僅被觸發時工作：① 世界觀劇變 審查 WB-1 重建要求 → 通過則 o3 重建 ② 個股 escalation 審查 → 產出審查報告 |

---

## 六、W-A 雙重角色的對應關係

| 觸發類型 | W-A 角色 | 產出 | 後續步驟 |
|----------|----------|------|----------|
| 世界觀劇變（WB-1 宏觀） | 審查 WB-1 重建要求是否正確合理 | 審查報告；若通過則執行 o3 重建 NEW_WORLDVIEW_FRAMEWORK | 系統在新世界觀下運行；WB-2 讀取新框架 |
| 個股 escalation（WB-1 個股） | 審查觸發原因 + 世界觀 + 該股歷史與資料 | 審查報告（嚴重問題與原因、重點變化） | 該股 P1–P4 更新 → WB-2 重度更新（附報告、緊急調整結論） |

原 P5-A「Opus 執行 + Scout 審查」的「深度覆審」在此架構下 = **W-A 審查（報告）** + **P1–P4 更新** + **WB-2 重度策略產出**；Scout/o3 角色對應 W-A 審查階段。

---

## 七、建議定案檢查清單（融合後）

- [ ] WB-1 宏觀：輸入（當週宏觀 + 上週世界觀）、輸出（當週世界觀快照、劇變與否）、劇變時送 W-A 審查 → 重建；**分析 = Hermes 4 405B**，沒觸發則無審查。
- [ ] WB-1 個股：輸入（當週個股新資訊 + 上週個股狀態）、輸出（當週個股狀態快照、escalation 與否）；觸發則 W-A 審查 → **P1–P4** 更新 → 標記重度 + 附報告；**分析 = Hermes 4 405B**。
- [ ] W-A：僅兩種觸發；**o3（不 batch）**；宏觀路徑產出審查報告 + 可選重建；個股路徑產出審查報告；重建產出寫入版本化快照。
- [ ] WB-2：**分析 = Hermes 4 405B，審查 = o3（原廠 batch）**；輸入為「當前世界觀」+ 兩類個股（輕度/重度）+ Delta Pack、Learning、記憶包、行事曆、Sector Flow/Mag7 等；重度路徑必帶 W-A 報告與緊急調整要求；產出符合 Strategy Skeleton + Validator + weekly_trade_actions。
- [ ] Escalation 條件：硬觸發（P2.5）+ 軟觸發（escalation_score ≥ 0.6）維持原設計；**重跑範圍 = P1–P4（不含 P0）**。
- [ ] 執行順序：WB-1 宏觀（含必要時 W-A 重建）→ WB-1 個股（含必要時 W-A 審查 + P1–P4）→ WB-2。

---

**結論**：您的整理已正確融合原 P5-A 設計與新 WB-1 / WB-2 / W-A 概念；P0 不因個股 escalation 重跑，重跑範圍維持 P1–P4；新設計 AI 模型為 WB-1 分析 Hermes 4 405B（無審查）、WB-2 分析 Hermes 4 405B + 審查 o3 batch、W-A 僅觸發時 o3 不 batch。**已定案並寫入 SSOT V8.30。**
