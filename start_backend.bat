@echo off
chcp 65001 >nul
echo ========================================
echo 启动后端服务
echo ========================================
echo.

cd /d %~dp0
cd backend

if not exist venv (
    echo [1/4] 创建虚拟环境...
    python -m venv venv
    if errorlevel 1 (
        echo 错误: 无法创建虚拟环境，请检查Python是否正确安装
        pause
        exit /b 1
    )
) else (
    echo [1/4] 虚拟环境已存在
)

echo [2/4] 激活虚拟环境...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo 错误: 无法激活虚拟环境
    pause
    exit /b 1
)

echo [3/4] 安装/更新依赖...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo 警告: 依赖安装可能有问题，但继续启动...
)

echo [4/4] 启动服务器...
echo.
echo 后端服务将在 http://localhost:8000 运行
echo 按 Ctrl+C 停止服务
echo.
uvicorn main:app --reload --host 0.0.0.0 --port 8000
if errorlevel 1 (
    echo.
    echo 错误: 服务器启动失败
    echo 可能的原因:
    echo 1. 端口8000已被占用
    echo 2. 依赖未正确安装
    echo 3. 代码有错误
    echo.
    pause
)

