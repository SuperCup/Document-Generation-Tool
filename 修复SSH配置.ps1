# 修复SSH配置文件问题
# 使用方法：在PowerShell中运行：.\修复SSH配置.ps1

$sshConfigPath = "$env:USERPROFILE\.ssh\config"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "修复SSH连接问题" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $sshConfigPath)) {
    Write-Host "SSH配置文件不存在，无需修复" -ForegroundColor Green
    Write-Host ""
    Write-Host "现在可以连接服务器了：" -ForegroundColor Yellow
    Write-Host "ssh root@8.134.59.82" -ForegroundColor White
    exit 0
}

Write-Host "发现SSH配置文件存在问题" -ForegroundColor Yellow
Write-Host "配置文件位置: $sshConfigPath" -ForegroundColor Gray
Write-Host ""

# 备份配置文件
$backupPath = "$sshConfigPath.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Write-Host "正在备份配置文件..." -ForegroundColor Yellow
Copy-Item $sshConfigPath $backupPath -ErrorAction SilentlyContinue
Write-Host "备份保存到: $backupPath" -ForegroundColor Green
Write-Host ""

# 显示当前配置（前10行）
Write-Host "当前配置文件内容（前10行）：" -ForegroundColor Cyan
Get-Content $sshConfigPath -Head 10 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
Write-Host ""

# 询问是否修复
$choice = Read-Host "选择操作：[1] 临时重命名配置文件（推荐） [2] 查看完整内容 [3] 取消"

if ($choice -eq "3") {
    Write-Host "已取消" -ForegroundColor Yellow
    exit 0
}

if ($choice -eq "2") {
    Write-Host ""
    Write-Host "完整配置文件内容：" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Gray
    Get-Content $sshConfigPath | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
    Write-Host "========================================" -ForegroundColor Gray
    Write-Host ""
    $choice = Read-Host "是否要临时重命名配置文件？[Y/N]"
    if ($choice -ne "Y" -and $choice -ne "y") {
        exit 0
    }
}

# 临时重命名配置文件
$tempName = "config.backup"
$tempPath = "$env:USERPROFILE\.ssh\$tempName"

Write-Host ""
Write-Host "正在重命名配置文件..." -ForegroundColor Yellow
try {
    Rename-Item $sshConfigPath $tempPath -Force -ErrorAction Stop
    Write-Host "✓ 配置文件已重命名为: $tempName" -ForegroundColor Green
} catch {
    Write-Host "✗ 重命名失败: $_" -ForegroundColor Red
    Write-Host "请尝试手动重命名或使用管理员权限运行此脚本" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ 修复完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "现在可以连接服务器了：" -ForegroundColor Yellow
Write-Host "ssh root@8.134.59.82" -ForegroundColor White
Write-Host ""
Write-Host "如果需要恢复配置文件，可以运行：" -ForegroundColor Gray
Write-Host "Rename-Item `"$tempPath`" `"config`"" -ForegroundColor Gray
Write-Host ""
