# Narrative Link Rubric v1
# Version: 1.0
# Source: V8.0架構定案文檔_SSOT.md (D-3/D-4 設計)
# Last Updated: 2026-02-05

## 敘事連結分類標準

當新事件或新聞出現時，必須判定其與既有敘事的關係。

---

## 分類定義

### CONTINUATION（延續）
- 事件符合既有敘事方向
- 強化原有論述
- 無新資訊，僅確認

### PIVOT（轉折）
- 事件與既有敘事方向相反
- 可能改變結論
- 需要重新評估框架

### FADE（淡化）
- 事件減弱既有敘事強度
- 不改變方向但降低信心
- 需下修權重

### AMPLIFY（強化）
- 事件大幅強化既有敘事
- 可能加速預期時間表
- 需上修權重

### BRANCH（分支）
- 事件開啟新的可能路徑
- 與既有敘事不衝突但新增維度
- 需追蹤新分支

### NEW_NARRATIVE（新敘事）
- 全新敘事線
- 與既有敘事無關
- 需建立新追蹤

---

## 輸出格式

```json
{
  "event_id": "EVT_XXX",
  "narrative_link_type": "CONTINUATION | PIVOT | FADE | AMPLIFY | BRANCH | NEW_NARRATIVE",
  "linked_narrative_ids": ["NAR_001", "NAR_002"],
  "confidence": 0.0-1.0,
  "rationale": "簡述連結理由（≤50字）"
}
```

---

## 判定原則

1. **先連結後判斷**：優先找既有敘事連結，找不到才標新敘事
2. **避免過度分支**：除非明確開啟新維度，否則歸入既有敘事
3. **轉折需強證據**：PIVOT 須有明確反向證據，不可輕易使用
