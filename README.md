# Nuclear Project - Python 遷移

WB-1 / WB-2 / W-A 主線 | P6 daemon 常駐 | Hermes 4 reasoning_trace | OCI ARM 部署

## 📚 Terminology

- **SSOT Terms (Authoritative)**: D-1..D-4 (Daily), WB-1/W-A/WB-2 (Weekly), P6 (Daemon). These drive the business logic.
- **Engineering Milestones (Internal)**: M00/M01/M02... These are build steps only.
  - **M00**: One-command workflow (`dev.ps1`)
  - **M01**: Infra: cold snapshot storage (`outputs/snapshots/`)
  - **M02**: Infra: run index + snapshot index (`outputs/nuclear.db`)
  - **M03**: Daily (D-3/D-4) history reconciliation (read-only)

---

## ⚡ Windows 快速開發指南 (M00)

使用 `dev.ps1` 一鍵管理開發環境，無需手動安裝 Poetry 或設定 Python Path。

### 1. 初始化環境
```powershell
.\dev.ps1 setup
```

### 2. 執行核心流程 (WB-1 -> WB-2)
```powershell
.\dev.ps1 wb
```

### 3. 執行測試 (Mocked)
```powershell
.\dev.ps1 test
```

### 4. 啟動 P6 監控
```powershell
.\dev.ps1 p6
```

### 5. 清理產出物
```powershell
.\dev.ps1 clean
```

---

### 1. 安裝 Poetry

```bash
pip install poetry
```

### 2. 安裝依賴

```bash
cd nuclear_project
poetry install
```

### 3. 複製環境變數

```bash
cp .env.example .env
# 編輯 .env，填入 DATABASE_URL、R2 等
```

### 4. 啟動資料庫（Docker）

```bash
docker compose up -d db
```

### 5. 執行 Migration

```bash
make migrate
# 或：poetry run alembic upgrade head
```

### 6. 啟動 API

```bash
poetry run uvicorn nuclear.main:app --reload
```

### 7. 測試

```bash
curl http://localhost:8000/health
curl http://localhost:8000/version
```

---

## Docker Compose 完整啟動

```bash
make up
# 或：docker compose up -d
```

包含：api（FastAPI）、worker（batch）、p6（daemon）、db（Postgres）

---

## 專案結構

```
src/nuclear/
├── main.py           # FastAPI /health, /version, /jobs/*, /alerts/test
├── config.py         # 環境設定
├── db/               # SQLAlchemy + Alembic
├── models/           # Pydantic I/O schemas
├── storage/          # R2 client (冷資料)
├── llm/              # provider_adapter, hermes_reasoning_parser
├── phases/
│   ├── p6/           # daemon
│   ├── weekly/       # wb1, wa, wb2
│   └── daily/        # skeleton
├── orchestration/    # run graph
└── utils/            # logging, retry
```

---

## Makefile 指令

| 指令 | 說明 |
|------|------|
| `make up` | 啟動 compose |
| `make down` | 停止 compose |
| `make logs` | 查看日誌 |
| `make test` | 執行 pytest |
| `make lint` | ruff check + format |
| `make migrate` | alembic upgrade head |

---

## SSOT 對齊

- Weekly：WB-1 / WB-2 / W-A 唯一主線，無 P5-A/P5-B
- P6：24/7 daemon，與 worker 分離
- 冷熱分離：Postgres 索引，R2 存大內容
- Hermes 4：include_reasoning=true，reasoning_trace 存 R2
- OrderPlan：worldview_version + identity_context

---

## 🤖 AI Read-Scope Rule (Anti-Pollution)

**Agents must read only:**
1. SSOT (`V8.0架構定案文檔_SSOT.md`)
2. Docs Registry (`docs/registry.yaml`)
3. Docs explicitly listed as **present** in registry.yaml
4. Source code (`src/nuclear`, `tests`)

**Agents must NOT infer requirements from legacy files** (e.g., `gas_archive/*`) unless explicitly authorized.
