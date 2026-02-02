# 快速清理 Cursor 對話歷史（無確認，清理 3 天前的歷史）
# 用途：快速清理舊對話，避免壓縮卡住

$historyPath = "$env:APPDATA\Cursor\User\History"
$DaysOld = 3  # 清理 3 天前的歷史

if (-not (Test-Path $historyPath)) {
    Write-Host "❌ 找不到對話歷史資料夾" -ForegroundColor Red
    exit 1
}

$cutoffDate = (Get-Date).AddDays(-$DaysOld)
$foldersToDelete = Get-ChildItem $historyPath -Directory | Where-Object { $_.LastWriteTime -lt $cutoffDate }
$deleteCount = $foldersToDelete.Count

if ($deleteCount -eq 0) {
    Write-Host "✅ 沒有需要清理的對話歷史" -ForegroundColor Green
    exit 0
}

Write-Host "🗑️  正在清理 $deleteCount 個舊對話歷史..." -ForegroundColor Cyan

$deletedCount = 0
foreach ($folder in $foldersToDelete) {
    try {
        Remove-Item $folder.FullName -Recurse -Force -ErrorAction Stop
        $deletedCount++
    }
    catch {
        Write-Host "   ✗ 刪除失敗: $($folder.Name)" -ForegroundColor Red
    }
}

$remainingFolders = (Get-ChildItem $historyPath -Directory).Count
Write-Host "✅ 清理完成！刪除 $deletedCount 個，剩餘 $remainingFolders 個" -ForegroundColor Green
