# Cursor CLI 全自動測試迴圈可行性分析（2026-01-28）

## 問題

是否可以用 Cursor 新增的 CLI，讓系統**全自動不斷迴圈**：  
測試 → 報錯 → 修復 → 測試 → 報錯 → 再修復 → … 一直到完全沒問題為止，**中間完全不需要任何指令**？

---

## 結論：可以，但迴圈要由「外層腳本」負責

- **可以**做到：一次啟動後，全程自動「測試 → 取錯 → 修復 → 上傳 → 再測」，直到沒有錯誤為止，中間**不需要再下任何指令**。
- **做法**：用 Cursor CLI 的 **Headless / 非互動模式**（`-p --force`）在**每一輪**做「讀錯誤 → 改程式碼 → 可選 clasp push」；**迴圈邏輯**（何時再測、何時結束）寫在**你自己的腳本**裡，由腳本反覆呼叫 Cursor CLI，而不是靠 Cursor 內建「一個指令就跑無限輪」。

---

## Cursor CLI 與全自動相關的能力

### 1. 非互動模式（Print mode）

- 指令：`agent -p "你的 prompt"` 或 `agent --print "你的 prompt"`
- 用途：在腳本、CI、自動化流程裡跑 Agent，**不需要人機互動**。
- 文件：適合 scripts、CI pipelines、automation。

### 2. 允許直接改檔（Headless 改檔）

- 指令：`agent -p --force "你的 prompt"`
- 用途：在非互動模式下，**允許 Agent 直接修改檔案**，不需每次手動批准。
- 文件：*"The --force flag allows the agent to make direct file changes without confirmation"*（[Headless](https://cursor.com/docs/cli/headless)）。

因此：  
- **單輪**「讀錯誤 → 分析 → 改程式碼」可以完全自動，不需任何鍵盤輸入。  
- 要「不斷迴圈」到沒錯誤為止，就要由**外層腳本**反覆呼叫 `agent -p --force "..."`。

### 3. 輸出格式

- `--output-format text`：純文字，方便 log。
- `--output-format json`：給腳本解析，例如判斷「本輪是否修復成功、是否還有錯誤」。
- `--output-format stream-json`：即時進度，可選用。

### 4. Cloud Agent（選用）

- 用法：在訊息前加 `&`，例如 `&refactor the auth module and add tests`。
- 用途：把任務交給 Cloud Agent，在網頁/手機上可接續，**但文件未說**可自動「多輪測試→修復」迴圈，目前較像「把一輪任務交出去」，迴圈仍建議用腳本做。

### 5. 小結

- Cursor CLI 提供的是：  
  **單次、無需人工確認的修復**（`-p --force`）+ **可被腳本/CI 反覆呼叫**。  
- **沒有**內建「一個指令就自動跑 N 輪測試→修復直到通過」的語法；  
  要實現「全自動不斷迴圈」，需要**自己寫一個腳本**，在腳本裡做迴圈並反覆呼叫 `agent -p --force`。

---

## 建議架構：全自動「測試 → 報錯 → 修復」迴圈

概念上可以這樣串（和之前 PX 討論的流程一致，只是「修復」改由 Cursor CLI 執行）：

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 觸發 GAS 測試（手動一次 / 排程 / 或腳本內觸發）            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 錯誤寫入 GAS（例如 Sheet / 或 GAS 寫入專案內檔案）         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 同步到本地（例如 sync_fix_queue.js → .cursor/fix_queue.json）│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 外層腳本（PowerShell / Bash）                             │
│    while (還有錯誤) {                                        │
│      a. 呼叫 Cursor CLI:                                     │
│         agent -p --force "讀 .cursor/fix_queue.json，        │
│         依錯誤修復程式碼，修完後執行 clasp push"              │
│      b. 等待 GAS 跑完新一輪（sleep / 輪詢 Sheet）             │
│      c. 再同步錯誤到 .cursor/fix_queue.json                  │
│      d. 若無新錯誤 → break                                   │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
```

- 你**只執行一次**：例如 `./run-auto-fix-loop.ps1` 或 `./run-auto-fix-loop.sh`。  
- 腳本內部：迴圈「取錯 → 呼叫 Cursor 修復（+ clasp push）→ 再測 → 再取錯」，直到沒有錯誤為止。  
- 因此：**中間完全不需要再下任何指令**，符合「全自動不斷迴圈」的目標。

---

## 實作要點

### 1. 單輪修復指令範例（Windows PowerShell）

```powershell
# 單輪：讀錯誤、修復、並執行 clasp push
agent -p --force "讀取 .cursor/fix_queue.json 的第一筆錯誤，根據錯誤訊息與 stacktrace 修復對應程式碼，修復完成後在終端執行 clasp push"
```

- 若錯誤來源是專案內檔案（例如 `errors.json`），可改成：  
  `agent -p --force "讀取 errors.json，依內容修復程式碼並執行 clasp push"`。

### 2. 迴圈腳本概念（偽代碼）

```text
# 1. 同步 GAS 錯誤到本地
node scripts/sync_fix_queue.js

# 2. 迴圈
while (test -f .cursor/fix_queue.json 且內容有 PENDING 錯誤) {
  agent -p --force "讀 .cursor/fix_queue.json，修復第一個錯誤，完成後執行 clasp push"
  Start-Sleep -Seconds 60   # 等 GAS 跑完
  node scripts/sync_fix_queue.js
}
```

- 實際可依你現有 `sync_fix_queue.js` 與錯誤格式，改為判斷「是否還有錯誤」的條件（例如讀 JSON 的 `length` 或 `status`）。

### 3. 環境需求

- 已安裝並登入 **Cursor CLI**（[安裝](https://cursor.com/docs/cli/installation)）。
- 腳本執行環境可呼叫 `agent`、`clasp`、`node`。
- 若在 CI/排程跑，需設定 **CURSOR_API_KEY**（見 [Headless](https://cursor.com/docs/cli/headless)）。
- 僅在**可信環境**使用 `--force`（Agent 會直接改檔）。

### 4. 已知限制（文件與社群）

- Headless 有時會 hang，若長時間跑建議加 timeout / 重試。
- 部分情境需先做過**一次互動**（例如信任目錄、MCP）。
- CLI 仍在 beta，安全與行為可能調整。

---

## 與「對話框內 Agent」的差異

| 項目 | 對話框內 Agent（之前） | Cursor CLI + 外層腳本（現在） |
|------|------------------------|-------------------------------|
| 觸發 | 每次都要你發一則訊息 | 腳本可反覆呼叫，無需再輸入 |
| 改檔 | 可改，但通常要你同意 | `-p --force` 可完全不互動改檔 |
| 迴圈 | 無法自己「隔 N 秒再跑下一輪」 | 腳本 while 迴圈 + sleep + 再呼叫 |
| 適用 | 單次修復、手動多輪 | 全自動「測試→報錯→修復」迴圈 |

所以：**是的，有了 CLI 之後，可以做到「全自動不斷迴圈測試與修復，中間完全不需要任何指令」**，差別在於迴圈是由**你寫的腳本**驅動，而不是 Cursor 內建一個「迴圈指令」。

---

## 建議下一步（若你要實作）

1. **沿用現有設計**  
   - 保留 GAS 測試 + 錯誤寫入 Sheet（或寫入專案內檔案）。  
   - 保留或改寫 `sync_fix_queue.js`，讓錯誤來源在本地有單一入口（例如 `.cursor/fix_queue.json`）。

2. **寫一個「全自動迴圈」腳本**  
   - 語言：PowerShell（Windows）或 Bash（WSL/本機）。  
   - 內容：  
     - 同步錯誤 → 若無錯誤則結束；  
     - 若有錯誤則：  
       - 呼叫 `agent -p --force "讀取錯誤來源，修復並執行 clasp push"`；  
       - 等待 GAS 跑完；  
       - 再同步錯誤，回到判斷。  

3. **可選**  
   - 用 `--output-format json` 讓腳本解析「本輪是否成功」；  
   - 設定最大輪數 / timeout，避免無限迴圈；  
   - 若 Cursor 之後提供 Background Agents API 或 Cloud Agent 多輪重試，再考慮把迴圈遷到那邊。

---

**文件日期**：2026-01-28  
**依據**：Cursor Docs（CLI Overview、Using Agent in CLI、Headless）、Cursor Blog（CLI）、社群回報（headless 限制）。
