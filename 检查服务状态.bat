@echo off
chcp 65001 >nul
echo ========================================
echo 服务状态检查报告
echo ========================================
echo.
echo 检查时间: %date% %time%
echo.

echo [1] 检查端口占用情况
echo ----------------------------------------
echo 后端端口 8000:
netstat -ano | findstr ":8000"
if errorlevel 1 (
    echo   ❌ 端口8000未被占用 - 后端服务未运行
) else (
    echo   ✅ 端口8000已被占用 - 后端服务可能正在运行
)
echo.

echo 前端端口 5173:
netstat -ano | findstr ":5173"
if errorlevel 1 (
    echo   ❌ 端口5173未被占用 - 前端服务未运行
) else (
    echo   ✅ 端口5173已被占用 - 前端服务可能正在运行
)
echo.

echo [2] 测试服务连接
echo ----------------------------------------
echo 测试后端服务 (http://localhost:8000):
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8000' -TimeoutSec 2 -UseBasicParsing; Write-Host '  ✅ 后端服务运行正常'; Write-Host ('  响应: ' + $response.Content) } catch { Write-Host '  ❌ 后端服务未运行或无法访问' }"
echo.

echo 测试前端服务 (http://localhost:5173):
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5173' -TimeoutSec 2 -UseBasicParsing; Write-Host '  ✅ 前端服务运行正常' } catch { Write-Host '  ❌ 前端服务未运行或无法访问' }"
echo.

echo [3] 检查进程
echo ----------------------------------------
echo Python进程:
tasklist | findstr "python"
if errorlevel 1 (
    echo   ❌ 未发现Python进程
) else (
    echo   ✅ 发现Python进程
)
echo.

echo Node.js进程:
tasklist | findstr "node"
if errorlevel 1 (
    echo   ❌ 未发现Node.js进程
) else (
    echo   ✅ 发现Node.js进程
)
echo.

echo [4] 检查项目依赖
echo ----------------------------------------
cd backend
if exist venv (
    echo   ✅ 后端虚拟环境存在
) else (
    echo   ❌ 后端虚拟环境不存在
)
cd ..

cd frontend
if exist node_modules (
    echo   ✅ 前端node_modules存在
) else (
    echo   ❌ 前端node_modules不存在
)
cd ..

echo.
echo ========================================
echo 检查完成
echo ========================================
echo.
echo 如果服务未运行，请执行以下操作：
echo 1. 运行 快速启动.bat 启动所有服务
echo 2. 或分别运行 start_backend.bat 和 start_frontend.bat
echo.
pause

