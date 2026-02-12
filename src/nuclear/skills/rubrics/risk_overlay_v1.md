# 風險覆蓋層方法論 V1

## Risk Overlay Level 判定 (§8.4.2)

多條件同時存在時：取 max(all triggered levels)。

| 條件 | risk_overlay_level | 動作 |
|------|-------------------|------|
| P0.7 = Late 或 turning_point_risk = HIGH | 3 | Cat 3 未持倉禁止建倉 |
| P0.7 Loop_Dominance = BALANCING | 2 | Cat 2 視為 Cat 1 矩陣 |
| DIVERGENCE_ALERT 或 INVENTORY_BUILD_WARNING | 2 | Cat 2 視為 Cat 1 矩陣 |
| LATE_CYCLE_RISK | 1 | Buy1 比例 -10% |
| 無特殊 | 0 | 正常 |

Risk Overlay 的數值影響僅作用於 Cat 矩陣的調整。
P4 的 W_ideal 計算不重複考慮 Risk Overlay。（反重複懲罰原則）

## 規則衝突優先權總表 (§2.5.1)

覆寫順序（由高到低）：
1. 生存層（Emergency Exit、DEFCON_1）— 程式強制
2. 系統風控層（P0.7 Time Window Override、DEFCON ≤ 2）
3. 市場氣候層（Market Climate Override）
4. 配置層（P4 Allocation、Portfolio Correlation Lock、IDENTITY_DRIFT）
5. 學習層（Learning constraints override strategy preferences）
6. 進攻層（牛市加速器、Alpha 放大器）
7. 策略層（WB-2 個股策略）
8. 個股買入層

## Cat 3 分級處理 (§8.4.1a)

| 情境 | 處理 |
|------|------|
| Cat 3 未持倉 | W_ideal = 0，不新建倉位（鐵律） |
| Cat 3 已持倉 — INDEPENDENT_ALPHA | 減倉 25%，剩餘 trailing stop 12% |
| Cat 3 已持倉 — 一般 | 減倉 50%，剩餘嚴格停損 |
