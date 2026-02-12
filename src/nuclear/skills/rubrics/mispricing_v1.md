# 錯價分析方法論 V1

## Mispricing Map 核心精神 (§6.7)

回答的不是「公司好不好」，而是：
市場目前「假設」了什麼未來？這個假設跟推導出的未來路徑，差在哪裡？

核心精神：區分「重新定價」與「炒作泡沫」。

## G-1) 市場隱含假設 (Implied Expectations)
- 成長是否被視為「線性延續」？
- 毛利是否被假設「結構性改善」？
- EPS 是否被當成可靠的前瞻指標？
- 市場是否忽略了週期、庫存、價格壓力或資本支出後效？

## G-2) 基本面實際路徑對照
- 哪些市場假設與 Base Case 不一致
- 哪些假設只有在 Bull Case 才成立
- 哪些假設一旦失效，會造成非線性修正

## G-3) Mispricing 類型判定

| 類型 | 說明 |
|------|------|
| 時間錯置 | 市場看對方向，但看錯時間 |
| 週期誤判 | 市場把循環當結構，或把結構當循環 |
| 品質誤判 | EPS/營收被過度信任，忽略現金流/一次性 |
| 敘事過度簡化 | 單一故事壓過多重現實 |
| 風險低估 | Tail risk underpricing |
| 結構性重新定價 | 市場正確反映新的定價基礎（非泡沫） |
| 泡沫 | 市場假設遠超基本面可支撐範圍 |
| 公允定價 | 沒有明顯錯價 |

## G-4) 修正機制
- 第一個會裂開的地方是什麼？
- 市場通常在哪一刻才會「承認錯了」？
- 修正是「慢慢滑」還是「跳空式」？

## G-5) Thesis Statement + Validation Triggers
必須輸出：
- thesis_statement：一句話核心投資論點
- validation_triggers.bull_case_confirmed：觸發條件列表
- validation_triggers.thesis_broken：打臉條件列表
- time_horizon：時間窗口

## FPE 分歧度
fpe_divergence = (FPE_A - FPE_B) / FPE_B
分歧度 > ±20% 時須特別說明。
