import React, { useState, useEffect } from 'react'
import axios from 'axios'
import RemoteFileBrowser from './RemoteFileBrowser'
import './PPTEditor.css'

interface PPTEditorProps {
  fileInfo: any
  onBack: () => void
}

interface Page {
  index: number
  title: string
  shapes_count: number
}

const PPTEditor: React.FC<PPTEditorProps> = ({ fileInfo, onBack }) => {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPage, setSelectedPage] = useState<number>(0)
  const [pageTitle, setPageTitle] = useState('')
  const [selectedImages, setSelectedImages] = useState<Array<{ preview: string; serverPath: string; fileName?: string }>>([])
  const [layout, setLayout] = useState<'single' | 'grid' | 'horizontal' | 'vertical'>('single')
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showRemoteBrowser, setShowRemoteBrowser] = useState(false)

  useEffect(() => {
    loadPages()
  }, [])

  const loadPages = async () => {
    try {
      const response = await axios.get(`/api/ppt/pages/${fileInfo.file_id}`)
      setPages(response.data.pages)
      setLoading(false)
    } catch (err: any) {
      setMessage({ type: 'error', text: '加载页面信息失败' })
      setLoading(false)
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files)
      
      // 先创建预览URL
      const previewUrls = files.map(file => URL.createObjectURL(file))
      
      // 上传图片到服务器
      try {
        const formData = new FormData()
        files.forEach(file => formData.append('files', file))
        
        const response = await axios.post('/api/upload-images', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
        
        // 合并预览URL和服务器路径
        const newImages = previewUrls.map((preview, index) => ({
          preview,
          serverPath: response.data.image_paths[index],
          fileName: files[index].name
        }))
        
        setSelectedImages(prev => [...prev, ...newImages])
        setMessage(null) // 清除之前的错误消息
      } catch (err: any) {
        setMessage({ type: 'error', text: '图片上传失败: ' + (err.response?.data?.detail || err.message) })
      } finally {
        // 重置input，允许再次选择相同文件
        input.value = ''
      }
    }
  }

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index))
  }

  const handleRemoteImagesSelected = (images: Array<{ preview: string; serverPath: string; fileName?: string }>) => {
    setSelectedImages(prev => [...prev, ...images])
  }

  const handleInsertPage = async () => {
    if (!pageTitle.trim()) {
      setMessage({ type: 'error', text: '请输入页面标题' })
      return
    }

    if (selectedImages.length === 0) {
      setMessage({ type: 'error', text: '请至少选择一张图片' })
      return
    }

    setProcessing(true)
    setMessage(null)

    try {
      // 提取服务器路径
      const imagePaths = selectedImages.map(img => img.serverPath)
      
      const formData = new FormData()
      formData.append('file_id', fileInfo.file_id)
      formData.append('after_page', selectedPage.toString())
      formData.append('title', pageTitle)
      formData.append('images', JSON.stringify(imagePaths))
      formData.append('layout', layout)

      await axios.post('/api/ppt/insert-page', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setMessage({ type: 'success', text: '页面插入成功！可以下载文件了。' })
      
      // 重置表单
      setPageTitle('')
      setSelectedImages([])
      setSelectedPage(0)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || '插入页面失败' })
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    window.open(`/api/download/${fileInfo.file_id}`, '_blank')
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div className="ppt-editor">
      <div className="editor-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← 返回
        </button>
        <h2>PPT 编辑器 - {fileInfo.file_name}</h2>
        <div className="file-info-badge">
          共 {pages.length} 页
        </div>
      </div>

      <div className="editor-content">
        <div className="card">
          <h3>选择插入位置</h3>
          <div className="pages-list">
            {pages.map((page) => (
              <div
                key={page.index}
                className={`page-item ${selectedPage === page.index ? 'selected' : ''}`}
                onClick={() => setSelectedPage(page.index)}
              >
                <div className="page-number">第 {page.index + 1} 页</div>
                <div className="page-title">{page.title}</div>
              </div>
            ))}
          </div>
          <p className="hint">将在选中的页面后插入新页面</p>
        </div>

        <div className="card">
          <h3>新页面设置</h3>
          
          <div className="form-group">
            <label className="label">页面标题</label>
            <input
              type="text"
              className="input"
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              placeholder="输入新页面标题"
            />
          </div>

          <div className="form-group">
            <label className="label">选择图片</label>
            <div className="image-source-buttons">
              <label className="btn btn-secondary image-source-btn">
                📁 本地文件
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                className="btn btn-secondary image-source-btn"
                onClick={() => setShowRemoteBrowser(true)}
              >
                🌐 远程文件
              </button>
            </div>
            {selectedImages.length > 0 && (
              <div className="images-preview">
                {selectedImages.map((img, index) => (
                  <div key={index} className="image-preview-item">
                    <img src={img.preview} alt={`预览 ${index + 1}`} />
                    <div className="image-name" title={img.fileName || `图片 ${index + 1}`}>
                      {img.fileName || `图片 ${index + 1}`}
                    </div>
                    <button
                      className="remove-image-btn"
                      onClick={() => removeImage(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="label">图片排版</label>
            <select
              className="input"
              value={layout}
              onChange={(e) => setLayout(e.target.value as any)}
            >
              <option value="single">单图居中</option>
              <option value="grid">网格排列</option>
              <option value="horizontal">水平排列</option>
              <option value="vertical">垂直排列</option>
            </select>
          </div>

          {message && (
            <div className={message.type === 'success' ? 'success' : 'error'}>
              {message.text}
            </div>
          )}

          <div className="editor-actions">
            <button
              className="btn btn-primary"
              onClick={handleInsertPage}
              disabled={processing}
            >
              {processing ? '处理中...' : '插入页面'}
            </button>
            {message?.type === 'success' && (
              <button className="btn btn-success" onClick={handleDownload}>
                下载文件
              </button>
            )}
          </div>
        </div>
      </div>

      {showRemoteBrowser && (
        <RemoteFileBrowser
          onImagesSelected={handleRemoteImagesSelected}
          onClose={() => setShowRemoteBrowser(false)}
        />
      )}
    </div>
  )
}

export default PPTEditor

