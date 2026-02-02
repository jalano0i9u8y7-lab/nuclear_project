# 🔧 使用 clasp 自動同步 Google Apps Script 檔案

## 前置需求

### 1. 安裝 Node.js
如果還沒有安裝 Node.js，請先安裝：

**Windows：**
1. 前往 [Node.js 官網](https://nodejs.org/)
2. 下載 LTS 版本（推薦）
3. 執行安裝程式（預設會自動加入 PATH）
4. 重新開啟終端機

**驗證安裝：**
```bash
node --version
npm --version
```

### 2. 安裝 clasp
```bash
npm install -g @google/clasp
```

**驗證安裝：**
```bash
clasp --version
```

## 使用 clasp 同步檔案

### 步驟 1：登入 Google 帳號

```bash
clasp login
```

這會：
1. 開啟瀏覽器
2. 要求你登入 Google 帳號
3. 授權 clasp 存取 Google Apps Script

### 步驟 2：取得 Google Apps Script 專案的 Script ID

1. **在 Google Apps Script 編輯器中：**
   - 前往 [script.google.com](https://script.google.com)
   - 開啟你的專案（核彈計畫 SSOT V6.3）

2. **取得 Script ID：**
   - 點擊左側「專案設定」（齒輪圖示）
   - 或在「檔案」→「專案設定」
   - 找到「指令碼 ID」（Script ID）
   - 複製這個 ID（格式類似：`1abc123def456ghi789jkl012mno345pqr678stu`）

### 步驟 3：Clone 專案

在本地專案目錄（`nuclear_project`）執行：

```bash
clasp clone <SCRIPT_ID>
```

例如：
```bash
clasp clone 1abc123def456ghi789jkl012mno345pqr678stu
```

這會：
- 下載所有 `.gs` 檔案到當前目錄
- 建立 `.clasp.json` 配置檔案

### 步驟 4：重新命名檔案（可選）

clasp 下載的檔案是 `.gs` 副檔名，如果需要轉換為 `.js`：

**Windows PowerShell：**
```powershell
Get-ChildItem -Filter *.gs | Rename-Item -NewName { $_.Name -replace '\.gs$', '.js' }
```

**或者手動重新命名每個檔案**

### 步驟 5：移動到 src 目錄

```bash
# 將所有 .gs 或 .js 檔案移動到 src 目錄
move *.js src\
```

## 自動化腳本

我也可以為你建立一個自動化腳本，自動執行所有步驟！

## 替代方案

如果不想安裝 Node.js，可以：
1. **手動複製**：從 Google Apps Script 編輯器複製內容給我
2. **使用 Google Apps Script 的版本控制**：下載專案為 ZIP

## 注意事項

1. **授權**：第一次使用 `clasp login` 需要授權
2. **Script ID**：必須是正確的 Script ID
3. **檔案權限**：確保你有權限存取該 Google Apps Script 專案
4. **.clasp.json**：不要提交這個檔案到版本控制（包含個人資訊）

## 下一步

如果你已經安裝了 Node.js，我可以直接幫你執行 clasp 命令！
如果你還沒安裝，我可以：
1. 提供更詳細的安裝指南
2. 或使用替代方案（手動複製）

你想用哪種方式？
