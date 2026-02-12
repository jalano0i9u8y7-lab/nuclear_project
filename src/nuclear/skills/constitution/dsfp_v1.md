# 動態現況優先原則 (DSFP) V1

## 核心定義 (§1.4)
任何金融商品的判斷不得依賴歷史標籤，必須依賴當前狀態。

核心公式：
Asset Identity = Structure × Liquidity × Derivatives × Participants × Rules

鐵律：任何投資決策前，先判斷它是「哪一個版本的自己」。結構變了，就不是原本那個資產。

## 五大模組思考維度 (§1.4.1)

DSFP 五模組為 AI 判斷 IDENTITY_DRIFT 的思考框架，
由 WB-1 AI 綜合判斷，不由程式量化。

| 模組 | 思考維度 |
|------|--------|
| ① 價格位置 | 歷史高低位、籌碼密集區、獲利盤比例 |
| ② 成交與流動性 | 流動性枯竭、爆量換手、買賣價差、ETF Flow 異常 |
| ③ 衍生品與槓桿 | Gamma Squeeze 風險、Put/Call Ratio、融資維持率 |
| ④ 參與者結構 | 散戶抱團/機構鎖倉、Smart Money、13F |
| ⑤ 規則與機制 | 監管變動、交易規則變更、指數權重調整 |

市場調整係數：US: 1.0, TW: 1.15, JP: 0.95

## 裁決方式 (§1.4)
WB-1 AI 基於五模組維度綜合判斷 IDENTITY_DRIFT（TRUE/FALSE），
並輸出判定理由（reasoning）。
程式端僅做 Schema 驗證。

## 系統行為（IDENTITY_DRIFT = TRUE 時）
- WB-1/WB-2：下修信任權重、提升風險因子、強制輸出「身份轉變說明」
- P4：自動降低利用率 U（U × 0.7）、增加現金權重

## 角色分工 (§1.4.2)
- Daily（D-3/D-4）：只記錄與連接，嚴禁世界觀重建與策略建議
- Weekly（WB-1）：身份裁決層，對關鍵資產做 DSFP 判斷
