# 文档生成工具

一款帮助运营人员快速选择图片并生成PPT或Excel交付材料的工具。

**本地运行版本** - 已打包为Windows exe程序，无需安装Python和Node.js环境，双击即可运行。

## 功能特性

- ✅ 支持上传PPT (.pptx, .ppt) 和 Excel (.xlsx, .xls) 文件
- ✅ 自动解析文件内容（PPT页面、Excel单元格）
- ✅ PPT编辑：在指定页面后插入新页面，支持多种图片排版方式
- ✅ Excel编辑：在指定单元格插入图片
- ✅ 现代化的Web界面，操作简单直观
- ✅ 本地运行，数据不上传服务器，隐私安全
- ✅ 自动清理临时文件，节省磁盘空间

## 技术栈

### 后端
- Python 3.8+
- FastAPI - 现代、快速的Web框架
- python-pptx - PPT文件处理
- openpyxl - Excel文件处理
- Pillow - 图片处理

### 前端
- React 18
- TypeScript
- Vite - 快速的前端构建工具
- Axios - HTTP客户端

## 快速开始

### 使用打包好的exe程序（推荐）

1. **运行程序**：双击 `DocumentGenerationTool.exe`
   - 程序会自动启动后端和前端服务
   - 浏览器会自动打开应用界面

2. **访问应用**：如果没有自动打开，请在浏览器中访问 http://localhost:5173

3. **关闭程序**：关闭程序窗口即可停止所有服务

### 开发模式运行（需要Python和Node.js环境）

如果你想修改代码或进行开发：

1. **一键启动**：双击运行 `快速启动.bat`
   - 这将自动启动后端和前端服务
   - 两个服务窗口会自动打开

2. **访问应用**：在浏览器中打开 http://localhost:5173

### 打包exe程序

如果你想自己打包exe程序：

1. **运行打包脚本**：双击 `打包.bat` 或运行 `python build.py`
   - 会自动构建前端
   - 自动打包成exe文件
   - 打包结果在 `dist` 目录

详细说明请查看 `打包说明.md`

### 故障排除

如果遇到问题：
- 运行 `check_status.bat` 检查项目状态
- 运行 `测试连接.bat` 测试服务是否正常运行
- 查看 `故障排除.md` 获取详细帮助

---

## 详细安装说明

### 前置要求

- Python 3.8 或更高版本
- Node.js 16 或更高版本
- npm 或 yarn

### 后端设置

1. 进入后端目录：
```bash
cd backend
```

2. 创建虚拟环境（推荐）：
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

3. 安装依赖：
```bash
pip install -r requirements.txt
```

4. 启动后端服务：
```bash
uvicorn main:app --reload --port 8000
```

后端服务将在 `http://localhost:8000` 运行。

### 前端设置

1. 进入前端目录：
```bash
cd frontend
```

2. 安装依赖：
```bash
npm install
```

3. 启动开发服务器：
```bash
npm run dev
```

前端应用将在 `http://localhost:5173` 运行。

## 使用说明

### PPT编辑

1. **上传文件**：点击上传区域或拖拽PPT文件到页面
2. **选择插入位置**：从页面列表中选择要在哪一页后插入新页面
3. **设置新页面**：
   - 输入页面标题
   - 选择一张或多张图片
   - 选择图片排版方式（单图居中、网格排列、水平排列、垂直排列）
4. **插入页面**：点击"插入页面"按钮
5. **下载文件**：插入成功后，点击"下载文件"按钮获取修改后的PPT

### Excel编辑

1. **上传文件**：上传Excel文件
2. **选择工作表**：如果有多个工作表，先选择要编辑的工作表
3. **选择单元格**：
   - 可以直接输入单元格地址（如：A1, B2）
   - 或从有数据的单元格列表中选择
4. **选择图片**：选择要插入的图片文件
5. **插入图片**：点击"插入图片"按钮
6. **下载文件**：插入成功后，点击"下载文件"按钮获取修改后的Excel

## 项目结构

```
Document-Generation-Tool/
├── backend/                 # 后端代码
│   ├── main.py             # FastAPI主应用
│   ├── services/           # 业务逻辑服务
│   │   ├── ppt_service.py  # PPT处理服务
│   │   └── excel_service.py # Excel处理服务
│   ├── uploads/            # 上传文件存储目录
│   ├── outputs/            # 生成文件存储目录
│   └── requirements.txt    # Python依赖
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── components/     # React组件
│   │   │   ├── FileUpload.tsx
│   │   │   ├── PPTEditor.tsx
│   │   │   └── ExcelEditor.tsx
│   │   ├── App.tsx         # 主应用组件
│   │   └── main.tsx        # 入口文件
│   ├── package.json        # Node.js依赖
│   └── vite.config.ts      # Vite配置
└── README.md              # 项目说明文档
```

## API接口

### 文件上传
- `POST /api/upload` - 上传PPT或Excel文件

### PPT相关
- `GET /api/ppt/pages/{file_id}` - 获取PPT页面列表
- `POST /api/ppt/insert-page` - 插入新页面

### Excel相关
- `GET /api/excel/cells/{file_id}` - 获取Excel单元格信息
- `POST /api/excel/insert-image` - 在单元格插入图片

### 通用
- `POST /api/upload-images` - 上传图片文件
- `GET /api/download/{file_id}` - 下载生成的文件

## 注意事项

1. **文件大小限制**：建议上传的文件不超过50MB
2. **图片格式**：支持常见的图片格式（JPG, PNG, GIF等）
3. **文件路径**：图片路径需要在服务器可访问的位置
4. **浏览器兼容性**：建议使用现代浏览器（Chrome, Firefox, Edge等）

## 开发计划

- [ ] 支持图片拖拽调整位置和大小
- [ ] 支持批量插入多张图片到Excel
- [ ] 支持PPT模板选择
- [ ] 支持图片编辑（裁剪、旋转等）
- [ ] 添加文件预览功能
- [ ] 支持更多文件格式

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

