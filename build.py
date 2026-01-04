"""
打包脚本 - 将项目打包成Windows exe
"""
import os
import sys
import shutil
import subprocess
from pathlib import Path

def find_command(cmd):
    """在Windows上查找命令（处理.cmd扩展名）"""
    if sys.platform == 'win32':
        # 在Windows上，npm可能是npm.cmd
        if cmd == 'npm':
            # 先尝试npm，如果失败再尝试npm.cmd
            try:
                subprocess.run(['npm', '--version'], capture_output=True, check=True)
                return 'npm'
            except (FileNotFoundError, subprocess.CalledProcessError):
                try:
                    subprocess.run(['npm.cmd', '--version'], capture_output=True, check=True)
                    return 'npm.cmd'
                except (FileNotFoundError, subprocess.CalledProcessError):
                    pass
    return cmd

def run_command(cmd, cwd=None, check=True):
    """运行命令"""
    # 处理Windows上的命令查找
    if isinstance(cmd, list) and len(cmd) > 0:
        cmd[0] = find_command(cmd[0])
    
    print(f"执行: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    if cwd:
        print(f"工作目录: {cwd}")
    
    # 在Windows上使用shell=True以确保能找到命令
    use_shell = sys.platform == 'win32'
    
    result = subprocess.run(
        cmd, 
        cwd=cwd, 
        check=False,  # 不立即抛出异常，先检查结果
        capture_output=True, 
        text=True,
        shell=use_shell,
        encoding='utf-8',
        errors='replace'  # 遇到编码错误时替换而不是失败
    )
    
    # 显示输出
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    
    # 如果check=True且返回码非0，抛出异常
    if check and result.returncode != 0:
        print(f"\n错误: 命令执行失败，返回码: {result.returncode}")
        raise subprocess.CalledProcessError(result.returncode, cmd, result.stdout, result.stderr)
    
    return result

def main():
    """主函数"""
    # 设置输出编码为UTF-8
    import io
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    
    print("=" * 60)
    print("文档生成工具 - 打包脚本")
    print("=" * 60)
    print()
    
    root_dir = Path(__file__).parent
    frontend_dir = root_dir / "frontend"
    backend_dir = root_dir / "backend"
    dist_dir = root_dir / "dist"
    frontend_dist = root_dir / "frontend_dist"
    
    # 清理旧的构建文件
    print("[1/5] 清理旧的构建文件...")
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    if frontend_dist.exists():
        shutil.rmtree(frontend_dist)
    print("✓ 清理完成")
    print()
    
    # 构建前端
    print("[2/5] 构建前端...")
    if not frontend_dir.exists():
        print("错误: frontend 目录不存在")
        sys.exit(1)
    
    # 检查node_modules
    if not (frontend_dir / "node_modules").exists():
        print("安装前端依赖...")
        try:
            result = run_command(["npm", "install"], cwd=frontend_dir, check=True)
            print("✓ 依赖安装完成")
        except subprocess.CalledProcessError as e:
            print(f"\n错误: 前端依赖安装失败")
            print("请检查:")
            print("1. Node.js 是否正确安装")
            print("2. 网络连接是否正常")
            sys.exit(1)
    
    # 构建前端
    print("构建前端静态文件...")
    try:
        result = run_command(["npm", "run", "build"], cwd=frontend_dir, check=True)
        print("✓ 前端构建命令执行成功")
    except subprocess.CalledProcessError as e:
        print(f"\n错误: 前端构建失败 (返回码: {e.returncode})")
        print("=" * 60)
        print("构建错误详情:")
        print("=" * 60)
        if e.stdout:
            print("标准输出:")
            print(e.stdout)
        if e.stderr:
            print("错误输出:")
            print(e.stderr)
        print("=" * 60)
        print("\n请检查:")
        print("1. 前端代码是否有语法错误")
        print("2. TypeScript 编译是否通过")
        print("3. 依赖是否完整安装")
        print("4. 可以手动运行: cd frontend && npm run build")
        sys.exit(1)
    
    # 移动构建文件
    frontend_build = frontend_dir / "dist"
    if frontend_build.exists():
        shutil.move(str(frontend_build), str(frontend_dist))
        print("✓ 前端构建完成")
    else:
        print("错误: 前端构建失败")
        sys.exit(1)
    print()
    
    # 检查Python环境
    print("[3/5] 检查Python环境...")
    python_cmd = sys.executable
    print(f"Python: {python_cmd}")
    
    # 检查PyInstaller
    try:
        import PyInstaller
        print("✓ PyInstaller 已安装")
    except ImportError:
        print("安装 PyInstaller...")
        run_command([python_cmd, "-m", "pip", "install", "pyinstaller"])
    
    # 检查Node.js和npm
    print("检查 Node.js 和 npm...")
    try:
        npm_cmd = find_command('npm')
        result = run_command([npm_cmd, "--version"], check=False)
        if result.returncode == 0:
            print(f"✓ npm 已安装 (版本: {result.stdout.strip()})")
        else:
            print("✗ npm 未找到，请先安装 Node.js")
            sys.exit(1)
    except Exception as e:
        print(f"✗ 检查npm失败: {e}")
        print("请确保已安装 Node.js 并添加到 PATH")
        sys.exit(1)
    print()
    
    # 安装后端依赖
    print("[4/5] 安装后端依赖...")
    requirements_file = backend_dir / "requirements.txt"
    if requirements_file.exists():
        run_command([python_cmd, "-m", "pip", "install", "-r", str(requirements_file)])
    print("✓ 依赖安装完成")
    print()
    
    # 打包exe
    print("[5/5] 打包exe文件...")
    spec_file = backend_dir / "build_exe.spec"
    if not spec_file.exists():
        print("错误: build_exe.spec 文件不存在")
        sys.exit(1)
    
    print(f"使用spec文件: {spec_file}")
    
    # 检查前端构建文件是否存在
    if not frontend_dist.exists():
        print(f"错误: 前端构建目录不存在: {frontend_dist}")
        sys.exit(1)
    
    print(f"前端构建目录: {frontend_dist}")
    print(f"包含文件数: {len(list(frontend_dist.rglob('*')))}")
    
    # 运行PyInstaller
    print("正在运行 PyInstaller，这可能需要几分钟...")
    print("注意: 如果看到警告信息，通常可以忽略")
    
    # 检查launcher.py是否存在
    launcher_file = backend_dir / "launcher.py"
    if not launcher_file.exists():
        print(f"错误: launcher.py 文件不存在: {launcher_file}")
        sys.exit(1)
    print(f"✓ 找到 launcher.py: {launcher_file}")
    
    try:
        # 直接运行，不使用run_command，以便更好地捕获输出
        # 使用UTF-8编码避免Windows上的编码问题
        result = subprocess.run(
            [
                python_cmd, "-m", "PyInstaller",
                "--clean",
                "--noconfirm",
                "--log-level=INFO",
                str(spec_file)
            ],
            cwd=root_dir,
            check=False,  # 不立即失败，先检查输出
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'  # 遇到编码错误时替换而不是失败
        )
        
        # 显示输出
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        
        # 检查返回码
        if result.returncode != 0:
            print(f"\n警告: PyInstaller 返回码: {result.returncode}")
            print("但继续检查输出文件...")
    except Exception as e:
        print(f"错误: PyInstaller 执行失败")
        print(f"返回码: {e.returncode}")
        if e.stdout:
            print("标准输出:")
            print(e.stdout)
        if e.stderr:
            print("错误输出:")
            print(e.stderr)
        sys.exit(1)
    
    # 检查输出文件
    print()
    print("检查打包结果...")
    exe_file = dist_dir / "DocumentGenerationTool.exe"
    build_dir = root_dir / "build"
    
    if exe_file.exists():
        file_size = exe_file.stat().st_size / (1024 * 1024)  # MB
        print(f"✓ exe文件已生成: {exe_file}")
        print(f"  文件大小: {file_size:.2f} MB")
    else:
        print(f"✗ exe文件未找到: {exe_file}")
        print("可能的原因:")
        print("1. PyInstaller执行失败但未报错")
        print("2. 输出目录不正确")
        print(f"3. 请检查 build 目录: {build_dir}")
        
        # 检查build目录
        if build_dir.exists():
            print(f"\nbuild目录内容:")
            for item in build_dir.iterdir():
                print(f"  - {item.name}")
        
        # 检查是否有其他输出
        possible_exe = list(root_dir.glob("**/DocumentGenerationTool.exe"))
        if possible_exe:
            print(f"\n找到exe文件在其他位置:")
            for exe in possible_exe:
                print(f"  - {exe}")
        else:
            print("\n未找到exe文件，打包可能失败")
            print("请查看上方的PyInstaller输出以获取错误信息")
            sys.exit(1)
    
    # 检查必要的目录和文件
    print()
    print("检查打包内容...")
    backend_dist = dist_dir / "backend"
    frontend_dist_in_dist = dist_dir / "frontend_dist"
    
    if backend_dist.exists():
        print(f"✓ backend目录存在: {backend_dist}")
    else:
        print(f"✗ backend目录不存在: {backend_dist}")
    
    if frontend_dist_in_dist.exists():
        print(f"✓ frontend_dist目录存在: {frontend_dist_in_dist}")
    else:
        print(f"✗ frontend_dist目录不存在: {frontend_dist_in_dist}")
    
    print()
    print("=" * 60)
    print("打包完成！")
    print("=" * 60)
    print()
    print(f"exe文件位置: {exe_file}")
    print()
    print("提示:")
    print("1. 将整个 dist 目录分发给用户")
    print("2. 用户双击 DocumentGenerationTool.exe 即可运行")
    print()

if __name__ == "__main__":
    main()

