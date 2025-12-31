@echo off
chcp 65001 >nul
echo ========================================
echo 测试服务连接
echo ========================================
echo.

echo [1] 测试后端服务 (http://localhost:8000)...
curl -s http://localhost:8000 >nul
if errorlevel 1 (
    echo ❌ 后端服务未运行或无法访问
    echo 请先启动后端服务 (运行 start_backend.bat)
) else (
    echo ✅ 后端服务运行正常
    curl -s http://localhost:8000
    echo.
)

echo.
echo [2] 测试前端服务 (http://localhost:5173)...
curl -s http://localhost:5173 >nul
if errorlevel 1 (
    echo ❌ 前端服务未运行或无法访问
    echo 请先启动前端服务 (运行 start_frontend.bat)
) else (
    echo ✅ 前端服务运行正常
)

echo.
echo ========================================
echo 测试完成
echo ========================================
echo.
echo 如果服务未运行，请：
echo 1. 运行 快速启动.bat 启动所有服务
echo 2. 或分别运行 start_backend.bat 和 start_frontend.bat
echo.
pause

