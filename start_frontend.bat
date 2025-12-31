@echo off
chcp 65001 >nul
echo ========================================
echo 启动前端服务
echo ========================================
echo.

cd /d %~dp0
cd frontend

if not exist node_modules (
    echo [1/2] 安装依赖...
    call npm install
    if errorlevel 1 (
        echo 错误: 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [1/2] 依赖已安装
)

echo [2/2] 启动开发服务器...
echo.
echo 前端应用将在 http://localhost:5173 运行
echo 按 Ctrl+C 停止服务
echo.
call npm run dev
if errorlevel 1 (
    echo.
    echo 错误: 前端服务启动失败
    echo 可能的原因:
    echo 1. 端口5173已被占用
    echo 2. 依赖未正确安装
    echo 3. 代码有错误
    echo.
    pause
)

