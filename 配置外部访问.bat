@echo off
chcp 65001 >nul
echo ========================================
echo 配置外部访问支持
echo ========================================
echo.
echo 此脚本将修改后端CORS配置以支持外部访问
echo.

cd /d %~dp0
cd backend

echo 正在备份 main.py...
copy main.py main.py.backup >nul
echo ✓ 备份完成

echo.
echo 正在修改CORS配置...
powershell -Command "(Get-Content main.py) -replace 'allow_origins=\[.*?\]', 'allow_origins=[\"*\"]' | Set-Content main.py"

echo.
echo ========================================
echo 配置完成！
echo ========================================
echo.
echo CORS已配置为允许所有来源访问
echo 注意：生产环境建议限制特定域名
echo.
echo 备份文件：backend\main.py.backup
echo.
pause

