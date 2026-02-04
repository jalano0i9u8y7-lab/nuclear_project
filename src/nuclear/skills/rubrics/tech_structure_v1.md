# Technical Structure Template v1
# Version: 1.0
# Source: V8.0架構定案文檔_SSOT.md (P3 設計)
# Last Updated: 2026-02-05

## 技術結構判讀模板

多時間維度分析框架：週 → 日 → 盤中

---

## 時間層級原則

**鐵律**：高時間尺度觀點 > 低時間尺度觀點
- WEEKLY > DAILY > INTRADAY
- 若 WEEKLY 為空頭，DAILY 多頭訊號只能當反彈，不可當趨勢反轉

---

## 週線結構判定

### 趨勢狀態
- **UPTREND**：價格 > MA20W > MA50W，高點低點上移
- **DOWNTREND**：價格 < MA20W < MA50W，高點低點下移
- **RANGE**：價格在 MA20W/MA50W 之間震盪
- **TRANSITION**：從一狀態轉換至另一狀態

### 週線結構類型
- **ACCUMULATION**：低位放量，籌碼收集
- **DISTRIBUTION**：高位放量，籌碼派發
- **BREAKOUT**：突破關鍵結構位
- **BREAKDOWN**：跌破關鍵結構位
- **LATE_STAGE**：趨勢末端特徵

---

## 日線結構判定

僅用於：
1. 進場時機確認
2. 短期觸發點識別
3. 驗證週線結構

**禁止**：用日線推翻週線結構

---

## Bull Trap 識別

**條件**：週線 DISTRIBUTION / LATE_STAGE + 日線 ACCUMULATION 型態
**結論**：標記 FAKE_BREAKOUT / TRAP_ALERT
**禁止**：產出 MOMENTUM_BUY

---

## 輸出格式

```json
{
  "weekly_structure": {
    "trend_state": "UPTREND | DOWNTREND | RANGE | TRANSITION",
    "structure_type": "ACCUMULATION | DISTRIBUTION | BREAKOUT | BREAKDOWN | LATE_STAGE | NEUTRAL",
    "key_levels": {"support": 0.0, "resistance": 0.0}
  },
  "daily_structure": {
    "trigger_type": "BREAKOUT | PULLBACK | REVERSAL | CONTINUATION | NONE",
    "entry_zone": {"low": 0.0, "high": 0.0}
  },
  "trap_risk": "NONE | LOW | MEDIUM | HIGH",
  "trap_type": "BULL_TRAP | BEAR_TRAP | NONE",
  "structure_confidence": 0.0-1.0
}
```

---

## 判定原則

1. **先看週線再看日線**：週線定方向，日線定時機
2. **量能驗證結構**：突破無量 = 假突破風險高
3. **主力視角優先**：解讀背後意圖，非僅描述型態
