# API请求路径问题修复说明

## 问题描述
用户报告上传文件时出现 501 错误：
```
Error code: 501
Message: Unsupported method ('POST').
Error code explanation: 501 - Server does not support this operation.
```

## 问题分析

### 根本原因
在exe环境中，前端和后端运行在不同的服务器上：
- **前端服务**: `http://127.0.0.1:5173` (SimpleHTTPRequestHandler - 只支持GET)
- **后端API**: `http://127.0.0.1:8000` (FastAPI - 支持所有HTTP方法)

### 问题细节
1. 前端代码使用相对路径发送API请求：`axios.post('/api/upload', ...)`
2. 在开发环境中，Vite的代理配置会将 `/api/*` 请求转发到后端
3. 在exe环境中，没有代理，请求直接发送到前端服务器 (5173端口)
4. SimpleHTTPRequestHandler 不支持POST方法，返回501错误

### 开发环境 vs exe环境对比

**开发环境** (有Vite代理):
```
浏览器 → http://localhost:5173/api/upload
       ↓ (Vite代理)
       → http://localhost:8000/api/upload (FastAPI) ✅
```

**exe环境** (无代理):
```
浏览器 → http://127.0.0.1:5173/api/upload
       → SimpleHTTPRequestHandler ❌ (不支持POST)
```

## 修复方案

### 方案：配置axios默认baseURL

在 `frontend/src/main.tsx` 中添加axios配置：

```typescript
import axios from 'axios'

// 配置axios默认baseURL
// 在打包的exe环境中，前端和后端运行在不同端口
// 前端: 5173 (SimpleHTTPRequestHandler)
// 后端: 8000 (FastAPI)
axios.defaults.baseURL = 'http://127.0.0.1:8000'
```

### 修复后的请求流程

**exe环境** (配置baseURL后):
```
浏览器 → axios.post('/api/upload', ...)
       ↓ (baseURL: http://127.0.0.1:8000)
       → http://127.0.0.1:8000/api/upload (FastAPI) ✅
```

### 为什么这样修复

1. **不影响开发环境**: 开发环境中Vite代理仍然工作
2. **简单有效**: 只需修改一处配置
3. **统一管理**: 所有axios请求都会自动使用正确的baseURL
4. **兼容性好**: 不需要修改每个API调用

## 修改的文件

### frontend/src/main.tsx
```diff
  import React from 'react'
  import ReactDOM from 'react-dom/client'
  import App from './App'
  import './index.css'
+ import axios from 'axios'
+ 
+ // 配置axios默认baseURL
+ axios.defaults.baseURL = 'http://127.0.0.1:8000'

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
```

## 重新构建和打包

### 1. 重新构建前端
```bash
cd frontend
npm run build
```

### 2. 移动构建文件
```bash
cd ..
rm -rf frontend_dist
mv frontend/dist frontend_dist
```

### 3. 重新打包exe
```bash
python build.py
```

## 验证步骤

### 1. 启动程序
```bash
dist\DocumentGenerationTool.exe
```

### 2. 打开浏览器
访问: http://127.0.0.1:5173

### 3. 测试上传
1. 点击"上传文件"按钮
2. 选择一个PPT或Excel文件
3. 点击"上传文件"
4. 确认上传成功

### 4. 检查网络请求
打开浏览器开发者工具 (F12) → Network标签
- 应该看到请求发送到: `http://127.0.0.1:8000/api/upload`
- 状态码应该是: `200 OK`
- 不应该再出现 `501` 错误

## 其他受影响的API调用

所有API调用都会自动使用正确的baseURL：
- ✅ `/api/upload` → `http://127.0.0.1:8000/api/upload`
- ✅ `/api/upload-images` → `http://127.0.0.1:8000/api/upload-images`
- ✅ `/api/ppt/pages/{id}` → `http://127.0.0.1:8000/api/ppt/pages/{id}`
- ✅ `/api/ppt/insert-page` → `http://127.0.0.1:8000/api/ppt/insert-page`
- ✅ `/api/excel/cells/{id}` → `http://127.0.0.1:8000/api/excel/cells/{id}`
- ✅ `/api/excel/insert-images-batch` → `http://127.0.0.1:8000/api/excel/insert-images-batch`
- ✅ `/api/download/{id}` → `http://127.0.0.1:8000/api/download/{id}`

## 注意事项

1. **端口固定**: 当前配置使用固定端口 8000，如果后端端口改变，需要同步修改
2. **CORS配置**: 后端已配置允许跨域请求 (allow_origins=["*"])
3. **开发环境**: 开发环境中Vite代理仍然有效，不受影响

## 总结

✅ 问题已修复
✅ 前端已重新构建
✅ exe已重新打包
✅ 可以进行上传测试

修复后，所有API请求都会正确发送到后端FastAPI服务器，不会再出现501错误。

