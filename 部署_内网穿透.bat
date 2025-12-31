@echo off
chcp 65001 >nul
echo ========================================
echo 内网穿透部署 - 快速启动
echo ========================================
echo.
echo 此脚本将：
echo 1. 配置CORS支持外部访问
echo 2. 启动后端服务
echo 3. 启动前端服务
echo 4. 提供ngrok使用说明
echo.
pause

cd /d %~dp0

echo.
echo [1/4] 配置CORS...
call 配置外部访问.bat

echo.
echo [2/4] 启动后端服务...
start "后端服务" cmd /k "start_backend.bat"

echo 等待后端启动...
timeout /t 3 /nobreak >nul

echo.
echo [3/4] 启动前端服务...
start "前端服务" cmd /k "start_frontend.bat"

echo 等待前端启动...
timeout /t 3 /nobreak >nul

echo.
echo [4/4] 内网穿透配置
echo ========================================
echo.
echo 请按照以下步骤配置ngrok：
echo.
echo 1. 下载ngrok: https://ngrok.com/download
echo 2. 注册账号并获取authtoken
echo 3. 配置token: ngrok config add-authtoken YOUR_TOKEN
echo 4. 启动ngrok: ngrok http 5173
echo.
echo 或者使用其他内网穿透工具：
echo - frp: https://github.com/fatedier/frp
echo - ZeroTier: https://www.zerotier.com/
echo - Tailscale: https://tailscale.com/
echo.
echo ========================================
echo 服务已启动！
echo ========================================
echo.
echo 后端: http://localhost:8000
echo 前端: http://localhost:5173
echo.
echo 配置ngrok后，通过ngrok提供的地址访问
echo.
pause

