# Cursor IDE Windows 安裝指南

**日期**：2026-01-26  
**問題**：`curl https://cursor.com/install -fsS | bash` 在 Windows 上無法執行

---

## 🔍 問題分析

### 為什麼失敗？

1. **該命令是 bash 腳本**：`curl ... | bash` 是為 Linux/macOS 設計的
2. **Windows PowerShell 不支援**：PowerShell 的 `curl` 是 `Invoke-WebRequest` 的別名，不是真正的 curl
3. **該腳本安裝的是 Cursor Agent**：不是 Cursor IDE 本身

---

## ✅ Windows 正確安裝方法

### 方法 1：直接下載安裝程式（推薦）⭐⭐⭐⭐⭐

**步驟**：

1. **訪問下載頁面**：
   - 網址：https://cursor.com/downloads
   - 或：https://cursor.com/download

2. **選擇 Windows 安裝程式**：
   - Windows (x64) (User) - 推薦
   - Windows (x64) (System)
   - Windows (ARM64) (User) - 如果是 ARM 處理器
   - Windows (ARM64) (System) - 如果是 ARM 處理器

3. **下載並安裝**：
   - 雙擊下載的 `.exe` 檔案
   - 按照安裝精靈指示完成安裝

4. **啟動 Cursor**：
   - 從開始選單啟動
   - 或從命令列執行 `cursor`

---

### 方法 2：使用 PowerShell 下載（自動化）

**建立下載腳本**：`download_cursor.ps1`

```powershell
# 下載 Cursor Windows 安裝程式
$downloadUrl = "https://download.todesktop.com/230303maz4dhj2a/Cursor-0.42.7-x64-setup.exe"
$outputPath = "$env:USERPROFILE\Downloads\Cursor-Setup.exe"

Write-Host "正在下載 Cursor..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $downloadUrl -OutFile $outputPath

Write-Host "下載完成！檔案位置：$outputPath" -ForegroundColor Green
Write-Host "請雙擊安裝程式完成安裝" -ForegroundColor Yellow
```

**執行**：
```powershell
.\download_cursor.ps1
```

---

### 方法 3：使用 Chocolatey（如果已安裝）

```powershell
choco install cursor
```

---

### 方法 4：使用 Winget（Windows 11/10）

```powershell
winget install cursor
```

---

## 🔧 如果已經安裝但無法啟動

### 檢查安裝位置

Cursor 通常安裝在：
- `C:\Users\<你的用戶名>\AppData\Local\Programs\cursor\Cursor.exe`

### 手動啟動

```powershell
# 啟動 Cursor
& "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe"
```

### 加入 PATH（可選）

如果需要從命令列啟動：

```powershell
# 加入 PATH（當前會話）
$env:Path += ";$env:LOCALAPPDATA\Programs\cursor"

# 永久加入 PATH（需要管理員權限）
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "User") + ";$env:LOCALAPPDATA\Programs\cursor",
    "User"
)
```

---

## 📋 系統需求

- **作業系統**：Windows 10 或更新版本
- **記憶體**：最少 8GB RAM（建議 16GB）
- **硬碟空間**：至少 500MB
- **網路**：穩定的高速網路連線

---

## 🎯 快速安裝步驟（總結）

1. **訪問**：https://cursor.com/downloads
2. **下載**：選擇 Windows (x64) (User)
3. **安裝**：雙擊 `.exe` 檔案，按照指示完成
4. **啟動**：從開始選單啟動 Cursor

---

## ❓ 常見問題

### Q: 為什麼 `curl ... | bash` 無法執行？

**A**: 因為：
- 這是 bash 腳本，Windows PowerShell 不支援
- PowerShell 的 `curl` 是 `Invoke-WebRequest` 的別名
- 該腳本安裝的是 Cursor Agent（CLI），不是 Cursor IDE

### Q: 我應該下載哪個版本？

**A**: 
- 大多數 Windows 電腦：選擇 **Windows (x64) (User)**
- 如果是 ARM 處理器（如 Surface Pro X）：選擇 **Windows (ARM64) (User)**

### Q: 安裝後無法啟動？

**A**: 
1. 檢查安裝位置：`%LOCALAPPDATA%\Programs\cursor\`
2. 嘗試手動啟動：雙擊 `Cursor.exe`
3. 檢查防毒軟體是否阻擋

---

**狀態**：✅ Windows 安裝指南完成
