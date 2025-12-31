@echo off
chcp 65001 >nul
echo ========================================
echo 文档生成工具 - 部署文件准备
echo ========================================
echo.

REM 检查是否在项目根目录
if not exist "backend\main.py" (
    echo ❌ 错误：请在项目根目录运行此脚本
    pause
    exit /b 1
)

echo [1/4] 检查项目结构...
if not exist "frontend\package.json" (
    echo ❌ 前端目录不存在或缺少package.json
    pause
    exit /b 1
)
if not exist "backend\requirements.txt" (
    echo ❌ 后端目录不存在或缺少requirements.txt
    pause
    exit /b 1
)
echo ✓ 项目结构检查通过
echo.

echo [2/4] 检查前端依赖...
cd frontend
if not exist "node_modules" (
    echo 正在安装前端依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo ❌ 前端依赖安装失败
        cd ..
        pause
        exit /b 1
    )
)
echo ✓ 前端依赖已就绪
cd ..
echo.

echo [3/4] 构建前端...
cd frontend
call npm run build
if errorlevel 1 (
    echo ❌ 前端构建失败
    cd ..
    pause
    exit /b 1
)
if not exist "dist\index.html" (
    echo ❌ 前端构建失败：未找到dist/index.html
    cd ..
    pause
    exit /b 1
)
echo ✓ 前端构建完成
cd ..
echo.

echo [4/4] 创建部署包...
set DEPLOY_DIR=deploy_package
if exist "%DEPLOY_DIR%" (
    echo 清理旧的部署包...
    rmdir /s /q "%DEPLOY_DIR%"
)

mkdir "%DEPLOY_DIR%"
mkdir "%DEPLOY_DIR%\backend"
mkdir "%DEPLOY_DIR%\frontend"

echo 复制后端文件...
xcopy /E /I /Y backend\* "%DEPLOY_DIR%\backend\" /EXCLUDE:deploy_exclude.txt 2>nul
if not exist "%DEPLOY_DIR%\backend\main.py" (
    echo ❌ 后端文件复制失败
    pause
    exit /b 1
)

echo 复制前端文件...
xcopy /E /I /Y frontend\* "%DEPLOY_DIR%\frontend\" /EXCLUDE:deploy_exclude.txt 2>nul
if not exist "%DEPLOY_DIR%\frontend\dist" (
    echo ❌ 前端文件复制失败
    pause
    exit /b 1
)

echo 复制部署脚本...
copy "一键部署脚本.sh" "%DEPLOY_DIR%\" >nul 2>&1
copy "云服务器部署详细指南.md" "%DEPLOY_DIR%\" >nul 2>&1
copy "部署检查清单.md" "%DEPLOY_DIR%\" >nul 2>&1

echo ✓ 部署包创建完成
echo.

echo ========================================
echo 🎉 准备完成！
echo ========================================
echo.
echo 部署包位置: %CD%\%DEPLOY_DIR%
echo.
echo 下一步操作：
echo 1. 将 %DEPLOY_DIR% 文件夹上传到服务器
echo 2. 在服务器上运行: sudo bash 一键部署脚本.sh
echo.
echo 上传方法：
echo - 使用 FileZilla 或 WinSCP 上传整个文件夹
echo - 或使用 scp: scp -r %DEPLOY_DIR% root@服务器IP:/var/www/document-tool
echo.
pause

