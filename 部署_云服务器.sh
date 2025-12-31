#!/bin/bash
# 云服务器部署脚本 - Ubuntu/Debian

echo "========================================"
echo "文档生成工具 - 云服务器部署"
echo "========================================"
echo

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    echo "请使用sudo运行此脚本"
    exit 1
fi

# 更新系统
echo "[1/8] 更新系统..."
apt update && apt upgrade -y

# 安装Python
echo "[2/8] 安装Python..."
apt install -y python3 python3-pip python3-venv

# 安装Node.js
echo "[3/8] 安装Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 安装Nginx
echo "[4/8] 安装Nginx..."
apt install -y nginx

# 安装PM2
echo "[5/8] 安装PM2..."
npm install -g pm2

# 创建项目目录
echo "[6/8] 创建项目目录..."
PROJECT_DIR="/var/www/document-tool"
mkdir -p $PROJECT_DIR
echo "项目目录: $PROJECT_DIR"
echo "请将项目文件上传到此目录"

# 配置防火墙
echo "[7/8] 配置防火墙..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 创建Nginx配置
echo "[8/8] 创建Nginx配置..."
cat > /etc/nginx/sites-available/document-tool << 'EOF'
server {
    listen 80;
    server_name _;  # 替换为你的域名

    # 前端静态文件
    location / {
        root /var/www/document-tool/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # 后端API代理
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100M;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        root /var/www/document-tool/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/document-tool /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo
echo "========================================"
echo "部署脚本执行完成！"
echo "========================================"
echo
echo "下一步操作："
echo "1. 将项目文件上传到: $PROJECT_DIR"
echo "2. 构建前端: cd $PROJECT_DIR/frontend && npm install && npm run build"
echo "3. 配置后端: cd $PROJECT_DIR/backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
echo "4. 启动后端: pm2 start 'uvicorn main:app --host 0.0.0.0 --port 8000' --name backend"
echo "5. 修改Nginx配置中的server_name为你的域名或IP"
echo "6. 配置SSL证书（可选）: certbot --nginx -d your-domain.com"
echo

