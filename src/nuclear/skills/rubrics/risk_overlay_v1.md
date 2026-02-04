# Risk Overlay Policy v1
# Version: 1.0
# Source: V8.0架構定案文檔_SSOT.md (V8.34)
# Last Updated: 2026-02-05

## 風險覆蓋政策

定義風控規則的優先級與覆寫機制。

---

## 三層風控架構

### System Level（系統級）
- DEFCON 1 = 禁止所有新開倉
- Emergency Exit = 強制平倉
- LATE_CYCLE + BEARISH = FORCE_MAX_EXPOSURE 30%

### Sector Level（板塊級）
- 板塊曝險上限 30-40%
- Sector Divergence Alert
- Industry Phase Out

### Symbol Level（個股級）
- Safety Lock（死亡率 > 0.5）
- Insider Selling Alert
- Earnings Ejection（財報前 7 天）

---

## 優先級規則

**覆寫順序**（由高到低）：

1. **Hard Constraints**（程式強制，AI 無法繞過）
   - 數學邊界
   - defcon1
   - emergencyExit
   - Safety Lock

2. **Market Climate Override**
   - P0.7 = LATE_CYCLE + 世界觀 = BEARISH → 強制覆寫

3. **P4 配置**
   - Portfolio Correlation Lock
   - IDENTITY_DRIFT 降 U
   - P4 Allocation

4. **Learning / Safety Lock**
   - Learning constraints override strategy preferences
   - 情境記憶死亡率 > 0.5 → max_exposure 上限

5. **P5 策略**
   - WB-2 個股策略
   - 權重與掛單

6. **Individual Buy**
   - 個股買入決策

---

## 核心原則

**更嚴格者優先**：當多條規則衝突時，執行更嚴格的限制。

---

## 輸出格式

```json
{
  "active_overlays": [
    {"level": "SYSTEM | SECTOR | SYMBOL", "rule": "規則名稱", "effect": "具體限制"}
  ],
  "effective_max_exposure": 0.0-1.0,
  "blocked_actions": ["BUY_NEW", "INCREASE_POSITION"],
  "reason": "觸發原因摘要"
}
```
