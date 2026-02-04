# Derivative Reading Rubric v1
# Version: 1.0
# Source: V8.0架構定案文檔_SSOT.md (DSFP 五模組)
# Last Updated: 2026-02-05

## 衍生品解讀標準

解讀衍生品與槓桿相關數據時的判斷框架。

---

## 核心指標

### 1. Open Interest (OI)
- **OI 上升 + 價格上漲**：新多頭進場，趨勢確認
- **OI 上升 + 價格下跌**：新空頭進場，看空壓力
- **OI 下降 + 價格上漲**：空頭平倉，可能為軋空
- **OI 下降 + 價格下跌**：多頭平倉，趨勢減弱

### 2. Gamma Exposure
- **正 Gamma**：做市商與價格同向操作（穩定器）
- **負 Gamma**：做市商與價格反向操作（放大器）
- **Gamma Flip Point**：關鍵結構位，突破可能引發快速移動

### 3. Implied Volatility (IV)
- **IV Rank > 80%**：市場恐慌/預期大波動
- **IV Rank < 20%**：市場自滿/低估風險
- **IV Crush**：事件後波動率驟降

### 4. Skew
- **Put Skew > 1.1**：下行保護需求高（機構避險）
- **Call Skew > 1.1**：上行投機需求高（散戶 FOMO）
- **Skew 極端化**：市場單邊預期過度

---

## DISTORTION_RISK 判定

當以下條件出現時，須標記扭曲風險：

| 等級 | 條件 |
|------|------|
| NONE | 無異常 |
| LOW | 單一指標異常 |
| MED | 兩項指標異常或 Gamma 負向 |
| HIGH | ≥3 項異常或極端 Gamma/Skew |

---

## 輸出格式

```json
{
  "derivative_state": "NEUTRAL | BULLISH_TILT | BEARISH_TILT | HIGHLY_LEVERAGED",
  "distortion_risk": "NONE | LOW | MED | HIGH",
  "gamma_regime": "POSITIVE | NEGATIVE | NEAR_FLIP",
  "vol_state": "LOW | NORMAL | ELEVATED | EXTREME",
  "key_signals": ["OI_SURGE", "SKEW_EXTREME", "IV_CRUSH"],
  "dealer_positioning": "LONG_GAMMA | SHORT_GAMMA | NEUTRAL"
}
```

---

## 判定原則

1. **HIGH 時禁止高信心突破**：改為 TRAP_RISK 或 WAIT_CONFIRMATION
2. **多指標交叉驗證**：單一指標不可定論
3. **結構位優先**：Gamma Flip Point 比絕對數值重要
