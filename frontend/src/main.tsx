import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import axios from 'axios'

// 配置axios默认baseURL
// 在打包的exe环境中，前端和后端运行在不同端口
// 前端: 5173 (SimpleHTTPRequestHandler)
// 后端: 8000 (FastAPI)
axios.defaults.baseURL = 'http://127.0.0.1:8000'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

