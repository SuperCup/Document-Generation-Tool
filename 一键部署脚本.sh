#!/bin/bash
# 云服务器一键部署脚本
# 使用方法: sudo bash 一键部署脚本.sh

set -e  # 遇到错误立即退出

echo "========================================"
echo "文档生成工具 - 一键部署脚本"
echo "========================================"
echo

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用sudo运行此脚本: sudo bash $0"
    exit 1
fi

PROJECT_DIR="/var/www/document-tool"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${GREEN}[$1]${NC} $2"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 步骤1: 更新系统
print_step "1/12" "更新系统..."
apt update -qq
apt upgrade -y -qq
print_success "系统更新完成"

# 步骤2: 安装基础工具
print_step "2/12" "安装基础工具..."
apt install -y curl wget git vim > /dev/null 2>&1
print_success "基础工具安装完成"

# 步骤3: 安装Python
print_step "3/12" "检查Python环境..."
if ! command -v python3 &> /dev/null; then
    apt install -y python3 python3-pip python3-venv > /dev/null 2>&1
    print_success "Python安装完成"
else
    PYTHON_VERSION=$(python3 --version)
    print_success "Python已安装: $PYTHON_VERSION"
fi

# 配置pip镜像（可选）
if [ ! -f ~/.pip/pip.conf ]; then
    mkdir -p ~/.pip
    cat > ~/.pip/pip.conf << 'EOF'
[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple
[install]
trusted-host = pypi.tuna.tsinghua.edu.cn
EOF
    print_success "pip镜像已配置"
fi

# 步骤4: 安装Node.js
print_step "4/12" "检查Node.js环境..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
    apt install -y nodejs > /dev/null 2>&1
    print_success "Node.js安装完成"
else
    NODE_VERSION=$(node --version)
    print_success "Node.js已安装: $NODE_VERSION"
fi

# 配置npm镜像（可选）
npm config set registry https://registry.npmmirror.com > /dev/null 2>&1

# 步骤5: 安装Nginx
print_step "5/12" "检查Nginx..."
if ! command -v nginx &> /dev/null; then
    apt install -y nginx > /dev/null 2>&1
    systemctl start nginx
    systemctl enable nginx > /dev/null 2>&1
    print_success "Nginx安装并启动完成"
else
    print_success "Nginx已安装"
    systemctl start nginx > /dev/null 2>&1
fi

# 步骤6: 安装PM2
print_step "6/12" "检查PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 > /dev/null 2>&1
    print_success "PM2安装完成"
else
    print_success "PM2已安装"
fi

# 步骤7: 创建项目目录
print_step "7/12" "创建项目目录..."
mkdir -p $PROJECT_DIR
print_success "项目目录已创建: $PROJECT_DIR"

# 检查项目文件是否存在
if [ ! -f "$BACKEND_DIR/main.py" ]; then
    print_warning "项目文件未找到，请将项目文件上传到: $PROJECT_DIR"
    echo "可以使用以下方法上传："
    echo "1. 使用FTP工具（FileZilla, WinSCP）"
    echo "2. 使用Git: git clone <your-repo> $PROJECT_DIR"
    echo "3. 使用scp: scp -r . root@服务器IP:$PROJECT_DIR"
    echo "4. 使用部署包: 在Windows上运行 准备部署文件.bat，然后上传 deploy_package 文件夹"
    echo
    read -p "项目文件已上传？(y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "请先上传项目文件"
        exit 1
    fi
    
    # 再次检查
    if [ ! -f "$BACKEND_DIR/main.py" ]; then
        print_error "项目文件仍未找到，请检查上传路径"
        exit 1
    fi
fi

# 步骤8: 构建前端
print_step "8/12" "构建前端..."
if [ -d "$FRONTEND_DIR" ]; then
    cd $FRONTEND_DIR
    
    # 检查是否已有构建好的dist目录
    if [ -d "dist" ] && [ -f "dist/index.html" ]; then
        print_warning "检测到已构建的前端文件，跳过构建"
        print_success "使用现有前端构建文件"
    else
        if [ ! -d "node_modules" ]; then
            echo "安装前端依赖..."
            npm install --silent
            if [ $? -ne 0 ]; then
                print_error "前端依赖安装失败"
                exit 1
            fi
        fi
        
        echo "构建前端..."
        npm run build
        
        if [ $? -ne 0 ]; then
            print_error "前端构建失败，请检查错误信息"
            exit 1
        fi
        
        if [ -d "dist" ] && [ -f "dist/index.html" ]; then
            print_success "前端构建完成"
        else
            print_error "前端构建失败：未找到dist目录或index.html"
            exit 1
        fi
    fi
else
    print_error "前端目录不存在: $FRONTEND_DIR"
    exit 1
fi

# 步骤9: 配置后端
print_step "9/12" "配置后端..."
if [ -d "$BACKEND_DIR" ]; then
    cd $BACKEND_DIR
    
    if [ ! -d "venv" ]; then
        echo "创建虚拟环境..."
        python3 -m venv venv
        if [ $? -ne 0 ]; then
            print_error "虚拟环境创建失败"
            exit 1
        fi
    fi
    
    echo "激活虚拟环境并安装依赖..."
    source venv/bin/activate
    
    # 升级pip
    pip install --upgrade pip --quiet
    
    # 安装依赖
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt --quiet
        if [ $? -ne 0 ]; then
            print_error "后端依赖安装失败"
            exit 1
        fi
    else
        print_error "requirements.txt 文件不存在"
        exit 1
    fi
    
    # 创建必要目录
    mkdir -p uploads outputs
    chmod 755 uploads outputs
    
    print_success "后端配置完成"
else
    print_error "后端目录不存在: $BACKEND_DIR"
    exit 1
fi

# 步骤10: 配置Nginx
print_step "10/12" "配置Nginx..."
NGINX_CONFIG="/etc/nginx/sites-available/document-tool"

# 获取服务器IP或域名
read -p "请输入域名（直接回车使用IP访问）: " DOMAIN
if [ -z "$DOMAIN" ]; then
    SERVER_NAME="_"
    print_warning "将使用IP访问"
else
    SERVER_NAME="$DOMAIN"
    print_success "域名: $DOMAIN"
fi

# 创建Nginx配置
cat > $NGINX_CONFIG << EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    # 前端静态文件
    location / {
        root $FRONTEND_DIR/dist;
        try_files \$uri \$uri/ /index.html;
        index index.html;
    }

    # 后端API代理
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 100M;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root $FRONTEND_DIR/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 启用配置
ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/document-tool
rm -f /etc/nginx/sites-enabled/default

# 测试配置
if nginx -t > /dev/null 2>&1; then
    systemctl reload nginx
    print_success "Nginx配置完成"
else
    print_error "Nginx配置有误，请检查"
    nginx -t
    exit 1
fi

# 步骤11: 启动后端服务
print_step "11/12" "启动后端服务..."
cd $BACKEND_DIR
source venv/bin/activate

# 停止已存在的服务
pm2 delete document-backend 2>/dev/null || true

# 启动服务
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name document-backend
pm2 save

# 配置开机自启
pm2 startup systemd -u root --hp /root > /tmp/pm2_startup.sh 2>/dev/null || true
if [ -f /tmp/pm2_startup.sh ]; then
    bash /tmp/pm2_startup.sh > /dev/null 2>&1 || true
fi

print_success "后端服务已启动"

# 步骤12: 配置防火墙
print_step "12/12" "配置防火墙..."
ufw allow 22/tcp > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
echo "y" | ufw enable > /dev/null 2>&1
print_success "防火墙已配置"

# 获取服务器IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo
echo "========================================"
echo "🎉 部署完成！"
echo "========================================"
echo
echo "访问地址:"
if [ "$SERVER_NAME" != "_" ]; then
    echo "  http://$SERVER_NAME"
else
    echo "  http://$SERVER_IP"
fi
echo
echo "服务状态:"
pm2 status
echo
echo "常用命令:"
echo "  查看后端日志: pm2 logs document-backend"
echo "  重启后端: pm2 restart document-backend"
echo "  重启Nginx: sudo systemctl restart nginx"
echo "  查看Nginx日志: sudo tail -f /var/log/nginx/error.log"
echo
print_warning "请确保云服务器安全组已开放80和443端口！"
echo

