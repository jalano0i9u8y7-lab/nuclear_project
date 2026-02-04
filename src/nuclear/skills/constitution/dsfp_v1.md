# Dynamic State First Principle (DSFP) v1
# Version: 1.0
# Source: V8.0架構定案文檔_SSOT.md (V8.32)
# Last Updated: 2026-02-05

## 核心定義

任何金融商品的判斷**不得依賴歷史標籤**，必須依賴**當前狀態**。

**公式**：`Asset Identity = Structure × Liquidity × Derivatives × Participants × Rules`

**鐵律**：任何投資決策前，先判斷它是「**哪一個版本的自己**」。結構變了，就不是原本那個資產。

---

## DSFP 五模組

### 1. Relative Position（價格位置）
- P3 趨勢位階
- Weekly Regime
- Sector RS

### 2. Volume & Liquidity（成交與流動性）
- P2.5 籌碼
- ETF Flow
- OI/Volume Delta

### 3. Derivatives & Leverage（衍生品與槓桿密度）
- Gamma/OI
- Options Flow
- Leveraged ETF

### 4. Participant Structure（參與者結構）
- Smart Money
- 13F
- Sector Concentration
- P2.5

### 5. Rules & Mechanics（規則與機制）
- 政策事件
- 新 ETF/新法規
- 行事曆

---

## IDENTITY_DRIFT 判定規則

以下五模組中 **≥3 項**出現顯著變化 → `IDENTITY_DRIFT = TRUE`：
1. 價格區間極端
2. 成交量與 ETF 流異常
3. 衍生品/槓桿密度上升
4. 參與者結構失衡
5. 規則或機制改變

---

## 系統行為

當 `IDENTITY_DRIFT = TRUE` 時：
- **WB-1/WB-2**: 必須下修信任權重、提升風險因子、強制輸出「身份轉變說明」
- **P4**: 自動降低利用率 U、增加現金權重

---

## 輸出要求

- 輸出須含 `ASSET_IDENTITY`、`IDENTITY_SHIFT`
- 資料不足時標記 `INSUFFICIENT_STATE_DATA`，**不得腦補**
