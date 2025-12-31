#!/bin/bash
echo "启动后端服务..."
cd backend

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "安装依赖..."
pip install -r requirements.txt
echo "启动服务器..."
uvicorn main:app --reload --port 8000

