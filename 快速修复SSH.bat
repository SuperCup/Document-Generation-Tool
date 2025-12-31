@echo off
chcp 65001 >nul
echo ========================================
echo 快速修复SSH连接问题
echo ========================================
echo.

set SSH_CONFIG=%USERPROFILE%\.ssh\config

if not exist "%SSH_CONFIG%" (
    echo SSH配置文件不存在，无需修复
    echo.
    echo 现在可以连接服务器了：
    echo ssh root@8.134.59.82
    pause
    exit /b 0
)

echo 发现SSH配置文件存在问题
echo 配置文件位置: %SSH_CONFIG%
echo.

echo 选项：
echo 1. 备份并重命名配置文件（推荐，最简单）
echo 2. 查看配置文件内容
echo 3. 取消
echo.

choice /C 123 /N /M "请选择 (1/2/3): "
if errorlevel 3 exit /b 0
if errorlevel 2 goto view
if errorlevel 1 goto backup

:backup
echo.
echo 正在备份配置文件...
copy "%SSH_CONFIG%" "%SSH_CONFIG%.backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%" >nul 2>&1
echo 备份完成

echo.
echo 正在重命名配置文件...
ren "%SSH_CONFIG%" config.backup >nul 2>&1
if errorlevel 1 (
    echo 重命名失败，可能需要管理员权限
    echo 请手动重命名: %SSH_CONFIG%
    pause
    exit /b 1
)

echo 配置文件已重命名为: config.backup
echo.
echo ========================================
echo ✓ 修复完成！
echo ========================================
echo.
echo 现在可以连接服务器了：
echo ssh root@8.134.59.82
echo.
echo 如果需要恢复配置文件，可以运行：
echo ren "%USERPROFILE%\.ssh\config.backup" config
echo.
pause
exit /b 0

:view
echo.
echo 配置文件内容：
echo ========================================
type "%SSH_CONFIG%"
echo ========================================
echo.
echo 按任意键继续...
pause >nul
goto backup
