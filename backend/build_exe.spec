# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

import os
import sys
from pathlib import Path

# 获取路径 - PyInstaller会设置SPECPATH
try:
    # SPECPATH是spec文件所在目录
    spec_dir = Path(SPECPATH)
    backend_dir = spec_dir.resolve()
    root_dir = backend_dir.parent.resolve()
except NameError:
    # 如果没有SPECPATH，使用当前文件路径
    spec_file = Path(__file__).resolve()
    backend_dir = spec_file.parent.resolve()
    root_dir = backend_dir.parent.resolve()

# 确保launcher.py存在
launcher_path = backend_dir / 'launcher.py'
if not launcher_path.exists():
    raise FileNotFoundError(f"找不到 launcher.py: {launcher_path}")

a = Analysis(
    [str(launcher_path)],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=[
        (str(root_dir / 'frontend_dist'), 'frontend_dist'),
        (str(backend_dir / 'main.py'), 'backend'),
        (str(backend_dir / 'services'), 'backend/services'),
    ],
    hiddenimports=[
        'uvicorn',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'pydantic',
        'pydantic.fields',
        'pydantic.types',
        'multipart',
        'python_pptx',
        'openpyxl',
        'PIL',
        'httpx',
        'services.ppt_service',
        'services.excel_service',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='DocumentGenerationTool',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # 禁用UPX压缩，避免兼容性问题
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
