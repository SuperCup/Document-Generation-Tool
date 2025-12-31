@echo off
echo ========================================
echo 项目状态检查
echo ========================================
echo.

echo [1] 检查Python环境...
python --version
if errorlevel 1 (
    echo 错误: Python未安装或未添加到PATH
    pause
    exit /b 1
)
echo Python环境正常
echo.

echo [2] 检查Node.js环境...
node --version
if errorlevel 1 (
    echo 错误: Node.js未安装或未添加到PATH
    pause
    exit /b 1
)
echo Node.js环境正常
echo.

echo [3] 检查后端依赖...
cd backend
if not exist venv (
    echo 警告: 虚拟环境不存在，需要创建
) else (
    echo 虚拟环境存在
)
if not exist requirements.txt (
    echo 错误: requirements.txt不存在
) else (
    echo requirements.txt存在
)
cd ..
echo.

echo [4] 检查前端依赖...
cd frontend
if not exist node_modules (
    echo 警告: node_modules不存在，需要安装依赖
) else (
    echo node_modules存在
)
if not exist package.json (
    echo 错误: package.json不存在
) else (
    echo package.json存在
)
cd ..
echo.

echo [5] 检查端口占用...
netstat -ano | findstr ":8000" >nul
if errorlevel 1 (
    echo 端口8000未被占用（后端可以启动）
) else (
    echo 警告: 端口8000已被占用
    netstat -ano | findstr ":8000"
)
netstat -ano | findstr ":5173" >nul
if errorlevel 1 (
    echo 端口5173未被占用（前端可以启动）
) else (
    echo 警告: 端口5173已被占用
    netstat -ano | findstr ":5173"
)
echo.

echo ========================================
echo 检查完成
echo ========================================
pause

