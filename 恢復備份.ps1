# 恢復備份腳本
# 使用方法：.\恢復備份.ps1 "測試通過_2026-01-25_003000"

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupName
)

$BackupPath = "backups\$BackupName"

if (-not (Test-Path $BackupPath)) {
    Write-Host "❌ 錯誤：找不到備份目錄 $BackupPath" -ForegroundColor Red
    exit 1
}

Write-Host "🔄 正在恢復備份：$BackupPath" -ForegroundColor Yellow

# 備份當前版本（以防萬一）
$CurrentBackup = "backups\恢復前備份_$(Get-Date -Format 'yyyy-MM-dd_HHmmss')"
New-Item -ItemType Directory -Force -Path $CurrentBackup | Out-Null
Copy-Item -Path "src\*" -Destination "$CurrentBackup\" -Recurse -Force
Write-Host "📦 已備份當前版本到：$CurrentBackup" -ForegroundColor Cyan

# 恢復備份
Copy-Item -Path "$BackupPath\src\*" -Destination "src\" -Recurse -Force

if (Test-Path "$BackupPath\appsscript.json") {
    Copy-Item "$BackupPath\appsscript.json" "." -Force
}

Write-Host "✅ 恢復完成！" -ForegroundColor Green
Write-Host "📝 請執行 clasp push --force 上傳到 GAS" -ForegroundColor Cyan
