"""
应用程序启动器
整合后端API服务和前端静态文件服务
"""
import os
import sys
import threading
import time
import webbrowser
from pathlib import Path
import uvicorn
from http.server import HTTPServer, SimpleHTTPRequestHandler
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 获取资源路径
def get_resource_path(relative_path):
    """获取资源文件的绝对路径"""
    try:
        # PyInstaller 创建的临时文件夹路径
        base_path = sys._MEIPASS
    except Exception:
        # 开发环境路径
        base_path = Path(__file__).parent.absolute()
    
    return os.path.join(base_path, relative_path)

# 获取应用根目录
def get_app_root():
    """获取应用程序根目录（exe文件所在目录）"""
    if getattr(sys, 'frozen', False):
        # 打包后的exe文件所在目录
        return Path(sys.executable).parent
    else:
        # 开发环境
        return Path(__file__).parent.parent

# 获取后端目录路径
def get_backend_path():
    """获取后端目录路径"""
    if getattr(sys, 'frozen', False):
        # 打包后的exe环境
        # backend代码被打包在资源目录中
        try:
            resource_backend = Path(sys._MEIPASS) / "backend"
            if resource_backend.exists():
                # 使用资源目录中的backend代码
                return resource_backend
        except Exception:
            pass
        # 如果资源目录中没有，使用exe所在目录下的backend
        return Path(sys.executable).parent / "backend"
    else:
        # 开发环境：launcher.py在backend目录下
        return Path(__file__).parent

# 获取前端目录路径
def get_frontend_dir(app_root):
    """获取前端目录路径"""
    if getattr(sys, 'frozen', False):
        # 打包后的exe环境：从资源目录获取
        try:
            return Path(sys._MEIPASS) / "frontend_dist"
        except Exception:
            return app_root / "frontend_dist"
    else:
        # 开发环境
        return app_root / "frontend_dist"

APP_ROOT = get_app_root()
FRONTEND_DIR = get_frontend_dir(APP_ROOT)
BACKEND_DIR = get_backend_path()

class FrontendHandler(SimpleHTTPRequestHandler):
    """前端静态文件处理器"""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)
    
    def log_message(self, format, *args):
        """禁用默认日志"""
        pass

def start_backend():
    """启动后端API服务"""
    try:
        # 添加backend目录到Python路径
        backend_path = str(BACKEND_DIR)
        if backend_path not in sys.path:
            sys.path.insert(0, backend_path)
        
        # 导入main模块
        from main import app
        
        # 启动uvicorn服务器
        config = uvicorn.Config(
            app=app,
            host="127.0.0.1",
            port=8000,
            log_level="info"
        )
        server = uvicorn.Server(config)
        server.run()
    except Exception as e:
        logger.error(f"后端启动失败: {e}", exc_info=True)
        import traceback
        traceback.print_exc()
        input("按Enter键退出...")
        sys.exit(1)

def start_frontend():
    """启动前端静态文件服务"""
    try:
        if not FRONTEND_DIR.exists():
            logger.error(f"前端目录不存在: {FRONTEND_DIR}")
            return
        
        # 启动HTTP服务器
        server = HTTPServer(("127.0.0.1", 5173), FrontendHandler)
        logger.info("前端服务启动在 http://127.0.0.1:5173")
        server.serve_forever()
    except Exception as e:
        logger.error(f"前端启动失败: {e}", exc_info=True)

def main():
    """主函数"""
    print("=" * 50)
    print("文档生成工具")
    print("=" * 50)
    print()
    
    # 检查前端目录
    if not FRONTEND_DIR.exists():
        print(f"错误: 前端目录不存在: {FRONTEND_DIR}")
        print("请先构建前端: cd frontend && npm run build")
        input("按Enter键退出...")
        sys.exit(1)
    
    # 检查后端目录（仅在开发环境检查）
    if not getattr(sys, 'frozen', False):
        backend_path = Path(BACKEND_DIR)
        if not backend_path.exists():
            print(f"错误: 后端目录不存在: {backend_path}")
            input("按Enter键退出...")
            sys.exit(1)
    
    print("正在启动服务...")
    print()
    
    # 启动后端服务（在后台线程）
    backend_thread = threading.Thread(target=start_backend, daemon=True)
    backend_thread.start()
    
    # 等待后端启动
    print("等待后端服务启动...")
    time.sleep(3)
    
    # 启动前端服务（在后台线程）
    frontend_thread = threading.Thread(target=start_frontend, daemon=True)
    frontend_thread.start()
    
    # 等待前端启动
    print("等待前端服务启动...")
    time.sleep(2)
    
    print()
    print("=" * 50)
    print("服务启动成功！")
    print("=" * 50)
    print()
    print("后端API: http://127.0.0.1:8000")
    print("前端应用: http://127.0.0.1:5173")
    print()
    print("正在打开浏览器...")
    print()
    print("提示: 关闭此窗口将停止所有服务")
    print()
    
    # 打开浏览器
    try:
        webbrowser.open("http://127.0.0.1:5173")
    except Exception as e:
        logger.warning(f"无法自动打开浏览器: {e}")
        print("请手动访问: http://127.0.0.1:5173")
    
    # 保持主线程运行
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n正在关闭服务...")
        sys.exit(0)

if __name__ == "__main__":
    main()

