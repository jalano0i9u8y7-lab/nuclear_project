# Nuclear Project - Python 遷移

WB-1 / WB-2 / W-A 主線 | P6 daemon 常駐 | Hermes 4 reasoning_trace | OCI ARM 部署

---

## 完全新手操作（複製貼上即可跑起來）

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
