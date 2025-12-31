@echo off
chcp 65001 >nul
echo ========================================
echo 文档生成工具 - 快速启动
echo ========================================
echo.
echo 此脚本将启动后端和前端服务
echo 请确保已安装 Python 3.8+ 和 Node.js 16+
echo.
pause

echo.
echo [1/2] 启动后端服务...
start "后端服务" cmd /k "start_backend.bat"

echo 等待后端服务启动...
timeout /t 3 /nobreak >nul

echo.
echo [2/2] 启动前端服务...
start "前端服务" cmd /k "start_frontend.bat"

echo.
echo ========================================
echo 启动完成！
echo ========================================
echo.
echo 后端服务: http://localhost:8000
echo 前端应用: http://localhost:5173
echo.
echo 两个窗口已打开，请勿关闭
echo 在浏览器中访问 http://localhost:5173 使用应用
echo.
pause

