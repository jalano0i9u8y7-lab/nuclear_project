# Cursor 對話歷史清理腳本
# 用途：清理指定天數前的對話歷史，避免壓縮功能卡住

param(
    [int]$DaysOld = 7  # 預設清理 7 天前的歷史
)

$historyPath = "$env:APPDATA\Cursor\User\History"

if (-not (Test-Path $historyPath)) {
    Write-Host "❌ 找不到對話歷史資料夾: $historyPath" -ForegroundColor Red
    exit 1
}

Write-Host "🔍 檢查對話歷史..." -ForegroundColor Cyan
$folders = Get-ChildItem $historyPath -Directory
$totalFolders = $folders.Count
$cutoffDate = (Get-Date).AddDays(-$DaysOld)

Write-Host "   總資料夾數: $totalFolders" -ForegroundColor Gray
Write-Host "   清理日期閾值: $($cutoffDate.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray

# 找出需要清理的資料夾
$foldersToDelete = $folders | Where-Object { $_.LastWriteTime -lt $cutoffDate }
$deleteCount = $foldersToDelete.Count

if ($deleteCount -eq 0) {
    Write-Host "✅ 沒有需要清理的對話歷史（所有歷史都在 $DaysOld 天內）" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "📋 準備清理 $deleteCount 個舊對話歷史資料夾..." -ForegroundColor Yellow

# 顯示將要刪除的資料夾（前 10 個）
Write-Host "   將刪除的資料夾（前 10 個）:" -ForegroundColor Gray
$foldersToDelete | Select-Object -First 10 | ForEach-Object {
    Write-Host "   - $($_.Name) (最後修改: $($_.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')))" -ForegroundColor Gray
}

if ($deleteCount -gt 10) {
    Write-Host "   ... 還有 $($deleteCount - 10) 個資料夾" -ForegroundColor Gray
}

Write-Host ""
$confirm = Read-Host "是否繼續清理？(Y/N)"

if ($confirm -ne 'Y' -and $confirm -ne 'y') {
    Write-Host "❌ 已取消清理" -ForegroundColor Yellow
    exit 0
}

# 執行清理
Write-Host ""
Write-Host "🗑️  正在清理..." -ForegroundColor Cyan
$deletedCount = 0
$errorCount = 0

foreach ($folder in $foldersToDelete) {
    try {
        Remove-Item $folder.FullName -Recurse -Force -ErrorAction Stop
        $deletedCount++
        Write-Host "   ✓ 已刪除: $($folder.Name)" -ForegroundColor Green
    }
    catch {
        $errorCount++
        Write-Host "   ✗ 刪除失敗: $($folder.Name) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ 清理完成！" -ForegroundColor Green
Write-Host "   成功刪除: $deletedCount 個資料夾" -ForegroundColor Green
if ($errorCount -gt 0) {
    Write-Host "   刪除失敗: $errorCount 個資料夾" -ForegroundColor Red
}

# 顯示清理後的狀態
$remainingFolders = (Get-ChildItem $historyPath -Directory).Count
Write-Host "   剩餘資料夾: $remainingFolders 個" -ForegroundColor Gray

Write-Host ""
Write-Host "💡 建議：定期執行此腳本（例如每週一次）以避免對話歷史過多" -ForegroundColor Cyan
