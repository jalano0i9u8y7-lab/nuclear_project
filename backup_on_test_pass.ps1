# 測試通過自動備份腳本
# 使用方法：.\backup_on_test_pass.ps1 "P1 Step1 測試通過"

param(
    [Parameter(Mandatory=$true)]
    [string]$TestDescription
)

$Timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$BackupDir = "backups\測試通過_$Timestamp"

# 創建備份目錄
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# 複製所有 src/ 文件
Copy-Item -Path "src\*" -Destination "$BackupDir\" -Recurse -Force

# 複製配置文件
if (Test-Path "appsscript.json") {
    Copy-Item "appsscript.json" "$BackupDir\" -Force
}

# 創建備份說明文件
$BackupInfo = @"
測試通過時間：$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
測試內容：$TestDescription
測試結果：通過
備份路徑：$BackupDir
"@

$BackupInfo | Out-File -FilePath "$BackupDir\備份說明.txt" -Encoding UTF8

Write-Host "✅ 備份完成：$BackupDir" -ForegroundColor Green
Write-Host "📝 備份說明：$TestDescription" -ForegroundColor Cyan
