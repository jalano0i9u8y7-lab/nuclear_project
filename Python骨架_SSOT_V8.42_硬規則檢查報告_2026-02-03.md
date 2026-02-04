# Python 骨架 SSOT V8.42 硬規則檢查報告

**日期**：2026-02-03  
**對照**：Nuclear Project SSOT V8.42 六項硬規則  
**原則**：最少修改

---

## 一、硬規則逐條檢查結果

| 規則 | 是否滿足 | 檔案／行數 | 說明 |
|------|----------|------------|------|
| **1) Weekly 命名 WB-1 / W-A / WB-2；Daily D-1～D-4；P6 24/7** | ✅ 是 | `phases/weekly/wb1.py`, `wa.py`, `wb2.py`；`phases/daily/skeleton.py`；`phases/p6/daemon.py` | Weekly 為 wb1 / wa / wb2；Daily 註解為 D1-D4（建議改為 D-1～D-4 對齊 SSOT）；P6 為獨立 daemon。 |
| **2) 嚴禁 P5-A / P5-B 當新實作目標** | ✅ 是 | `phases/weekly/__init__.py` L1 | 僅註解「no P5-A/P5-B」，無 phase 或主流程使用 P5-A/P5-B。 |
| **3) WB-1 output contract 須含 8 欄位** | ✅ 是（已修） | `phases/weekly/wb1.py`；`models/schemas.py` | 已補齊：worldview_version, world_state_snapshot, asset_identity_map, narrative_map, identity_shift_signals_summary, framework_stability_score, rebuild_recommendation, rebuild_reason_top5；並以 WB1Output schema 約束。 |
| **4) WB-2 每個 order 須引用 worldview_version + identity_context；缺則 raise** | ✅ 是 | `models/schemas.py` L62-66；`phases/weekly/wb2.py` | OrderPlan 必填兩欄位；wb2 新增 _validate_order()，缺則 raise ValueError。 |
| **5) P6 與 Weekly/Daily fault isolation** | ✅ 是 | `phases/p6/daemon.py` L22-23 | P6 可獨立 `python -m nuclear.phases.p6.daemon` 或 `nuclear p6 --daemon`，架構上與 batch 分離。 |
| **6) Hermes4 include_reasoning / reasoning_trace 預留介面** | ✅ 是 | `db/models.py` AiOutput；`llm/hermes_reasoning_parser.py`；`llm/provider_adapter.py` | contract：HermesParsed(reasoning_trace, final_answer)、AiOutput(include_reasoning, reasoning_trace_storage_key)；已加 TODO：接 LLM 後寫入 R2/DB。 |

---

## 二、必改清單（must-fix）— 已處理

| 項目 | 原狀 | 修改 |
|------|------|------|
| **WB-1 輸出缺 5 欄位** | wb1.py 只回傳 world_state_snapshot, asset_identity_map, narrative_map | 新增 `WB1Output`（schemas.py），wb1.py 回傳 8 欄位並用 schema 驗證。 |
| **WB-2 缺則須 raise** | 僅靠 Pydantic 必填 | 在 wb2.py 新增 `_validate_order()`，缺 worldview_version 或 identity_context 時 raise ValueError。 |
| **Hermes4 介面須留 TODO** | 已有欄位與 parser | 在 db/models.py AiOutput 與 llm/provider_adapter.py parse_and_store_reasoning 加註 TODO：接 LLM 後寫入 reasoning_trace。 |

---

## 三、建議清單（nice-to-have）

| 項目 | 位置 | 建議 |
|------|------|------|
| Daily 命名對齊 SSOT | `phases/daily/skeleton.py`、`phases/daily/__init__.py` | 註解改為「D-1～D-4」取代「D1-D4」。 |
| D-1～D-4 模組骨架 | `phases/daily/` | 可新增 d1.py / d2.py / d3.py / d4.py 或單一 skeleton 內標註 D-1～D-4 職責。 |
| WB-2 回傳前統一驗證 | `phases/weekly/wb2.py` | 目前已在回傳前對 list 內每個 OrderPlan 做 _validate_order；若未來改為從外部傳入 list，建議在入口處再驗證一次。 |

---

## 四、已實施之最小修改（patch 摘要）

### 1. `src/nuclear/models/schemas.py`

- 新增 **WB1Output**：worldview_version（必填）, world_state_snapshot, asset_identity_map, narrative_map, identity_shift_signals_summary, framework_stability_score, rebuild_recommendation, rebuild_reason_top5。

### 2. `src/nuclear/phases/weekly/wb1.py`

- 改為使用 WB1Output，回傳 `model_dump()` 含上述 8 欄位（stub 值）。

### 3. `src/nuclear/phases/weekly/wb2.py`

- 新增 `_validate_order(o: OrderPlan)`：若缺 worldview_version 或 identity_context 則 `raise ValueError`。
- run_wb2_light / run_wb2_heavy 回傳前對每個 order 呼叫 _validate_order。

### 4. `src/nuclear/db/models.py`

- AiOutput docstring 加註 SSOT V8.42 與 **TODO**：接 LLM 後寫入 reasoning_trace（R2/DB）並填 reasoning_trace_storage_key。

### 5. `src/nuclear/llm/provider_adapter.py`

- parse_and_store_reasoning 加註 **TODO**：persist reasoning_trace 至 R2/DB、接真實 LLM 呼叫。

### 6. 最小 CLI：`src/nuclear/cli.py`（新增）

- **wb1**：呼叫 run_wb1_macro({})，印 JSON。
- **wa**：呼叫 run_wa_worldview_review({})，印 JSON。
- **wb2**：呼叫 run_wb2_light([], {})，印 orders JSON。
- **p6**：預設跑單次 tick（stub）；`--daemon` 跑 run_p6_daemon() 迴圈。

### 7. `pyproject.toml`

- 新增 `[tool.poetry.scripts] nuclear = "nuclear.cli:main"`，安裝後可執行 `nuclear wb1`、`nuclear wa`、`nuclear wb2`、`nuclear p6`。

---

## 五、CLI 使用方式

```bash
# 安裝後（poetry install）
nuclear wb1
nuclear wa
nuclear wb2
nuclear p6           # 單次 tick stub
nuclear p6 --daemon # P6 daemon 迴圈

# 或未安裝時
cd /path/to/nuclear_project
python -m nuclear.cli wb1
python -m nuclear.cli wa
python -m nuclear.cli wb2
python -m nuclear.cli p6
python -m nuclear.cli p6 --daemon
```

---

## 六、結論

- **六項硬規則**：檢查後皆已滿足；其中規則 3、4、6 已依上述最小 patch 補齊或明文化。
- **必改清單**：已全部實作。
- **建議清單**：僅標註為 nice-to-have，可依需要再補（Daily 註解與 D-1～D-4 模組化）。
