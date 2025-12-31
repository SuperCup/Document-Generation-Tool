@echo off
chcp 65001 >nul
echo ========================================
echo 文档生成工具 - 打包脚本
echo ========================================
echo.
echo 此脚本将自动打包项目为Windows exe文件
echo.
pause

python build.py

echo.
echo ========================================
echo 打包完成！
echo ========================================
echo.
pause

