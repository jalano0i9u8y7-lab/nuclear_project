# Evidence Protocol v1
# Version: 1.0
# Source: V8.0架構定案文檔_SSOT.md (白名單數據源原則)
# Last Updated: 2026-02-05

## 證據引用協議

定義數據來源、證據格式與禁止事項。

---

## Evidence ID 格式

所有引用的證據必須包含唯一 ID：

```
[SOURCE_TYPE]_[DATE]_[SEQUENCE]
```

範例：
- `NEWS_20260205_001` - 新聞來源
- `FILING_10K_20260131_001` - SEC 財報
- `OHLCV_20260204_NVDA` - 價格數據
- `FLOW_13F_20260115_001` - 13F 籌碼

---

## Source Tags

| Tag | 說明 |
|-----|------|
| `OFFICIAL` | 官方來源（SEC、財報、公告）|
| `MARKET_DATA` | 市場數據（OHLCV、OI、IV）|
| `INSTITUTIONAL` | 機構數據（13F、ETF Flow）|
| `NEWS` | 新聞報導（須標明來源可信度）|
| `DERIVED` | 衍生計算（須標明計算公式）|
| `INFERRED` | 推論結果（須標明假設）|

---

## 禁止事項

### ❌ 絕對禁止
1. **腦補**：無證據的推論
2. **自行搜尋**：AI 不得自行搜尋數據
3. **混用來源**：同一分析中混用不同計算方式的財報數據
4. **隱藏假設**：推論必須標明所有假設

### ⚠️ 須標記
1. **INFERRED**：任何推論須標記
2. **UNCERTAIN**：信心度 < 0.6 須標記
3. **INCOMPLETE**：資料不完整須標記

---

## 輸出格式

```json
{
  "evidence_ids": ["NEWS_20260205_001", "OHLCV_20260204_NVDA"],
  "source_tags": ["OFFICIAL", "MARKET_DATA"],
  "data_completeness": "COMPLETE | PARTIAL | INSUFFICIENT",
  "confidence_level": 0.0-1.0,
  "assumptions": ["假設列表"],
  "caveats": ["注意事項"]
}
```

---

## 驗證規則

1. 每個結論必須至少有一個 evidence_id
2. INFERRED 類結論必須列出 assumptions
3. 資料不足時標記 `INSUFFICIENT_DATA`，**不得繼續推論**
