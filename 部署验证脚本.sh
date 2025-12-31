#!/bin/bash
# 部署验证脚本
# 用于检查部署是否成功

set -e

echo "========================================"
echo "部署验证脚本"
echo "========================================"
echo

PROJECT_DIR="/var/www/document-tool"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. 检查项目目录
echo "[1/10] 检查项目目录..."
if [ -d "$PROJECT_DIR" ]; then
    check_pass "项目目录存在: $PROJECT_DIR"
else
    check_fail "项目目录不存在: $PROJECT_DIR"
    exit 1
fi

# 2. 检查前端构建
echo "[2/10] 检查前端构建..."
if [ -d "$FRONTEND_DIR/dist" ] && [ -f "$FRONTEND_DIR/dist/index.html" ]; then
    check_pass "前端构建文件存在"
else
    check_fail "前端构建文件不存在"
    exit 1
fi

# 3. 检查后端文件
echo "[3/10] 检查后端文件..."
if [ -f "$BACKEND_DIR/main.py" ]; then
    check_pass "后端主文件存在"
else
    check_fail "后端主文件不存在"
    exit 1
fi

# 4. 检查后端虚拟环境
echo "[4/10] 检查后端虚拟环境..."
if [ -d "$BACKEND_DIR/venv" ]; then
    check_pass "后端虚拟环境存在"
else
    check_fail "后端虚拟环境不存在"
    exit 1
fi

# 5. 检查必要目录
echo "[5/10] 检查必要目录..."
if [ -d "$BACKEND_DIR/uploads" ] && [ -d "$BACKEND_DIR/outputs" ]; then
    check_pass "uploads 和 outputs 目录存在"
else
    check_fail "必要目录不存在"
    exit 1
fi

# 6. 检查Nginx配置
echo "[6/10] 检查Nginx配置..."
if [ -f "/etc/nginx/sites-available/document-tool" ]; then
    check_pass "Nginx配置文件存在"
    if nginx -t > /dev/null 2>&1; then
        check_pass "Nginx配置语法正确"
    else
        check_fail "Nginx配置语法错误"
        nginx -t
        exit 1
    fi
else
    check_fail "Nginx配置文件不存在"
    exit 1
fi

# 7. 检查Nginx服务
echo "[7/10] 检查Nginx服务..."
if systemctl is-active --quiet nginx; then
    check_pass "Nginx服务正在运行"
else
    check_fail "Nginx服务未运行"
    exit 1
fi

# 8. 检查PM2服务
echo "[8/10] 检查PM2服务..."
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "document-backend"; then
        STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="document-backend") | .pm2_env.status' 2>/dev/null || echo "unknown")
        if [ "$STATUS" = "online" ]; then
            check_pass "后端服务正在运行 (PM2)"
        else
            check_fail "后端服务状态异常: $STATUS"
            exit 1
        fi
    else
        check_fail "后端服务未在PM2中运行"
        exit 1
    fi
else
    check_fail "PM2未安装"
    exit 1
fi

# 9. 检查端口监听
echo "[9/10] 检查端口监听..."
if netstat -tlnp 2>/dev/null | grep -q ":80 " || ss -tlnp 2>/dev/null | grep -q ":80 "; then
    check_pass "端口80正在监听"
else
    check_warn "端口80未监听（可能使用其他工具）"
fi

if netstat -tlnp 2>/dev/null | grep -q ":8000 " || ss -tlnp 2>/dev/null | grep -q ":8000 "; then
    check_pass "端口8000正在监听"
else
    check_fail "端口8000未监听"
    exit 1
fi

# 10. 测试API连接
echo "[10/10] 测试API连接..."
API_RESPONSE=$(curl -s http://localhost:8000/ || echo "ERROR")
if echo "$API_RESPONSE" | grep -q "文档生成工具"; then
    check_pass "后端API响应正常"
else
    check_fail "后端API无响应或响应异常"
    echo "响应内容: $API_RESPONSE"
    exit 1
fi

# 获取服务器IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo
echo "========================================"
echo "🎉 所有检查通过！"
echo "========================================"
echo
echo "访问地址:"
echo "  前端: http://$SERVER_IP"
echo "  后端API: http://$SERVER_IP/api/"
echo
echo "服务状态:"
pm2 status
echo
echo "常用命令:"
echo "  查看后端日志: pm2 logs document-backend"
echo "  重启后端: pm2 restart document-backend"
echo "  重启Nginx: sudo systemctl restart nginx"
echo

