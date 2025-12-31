import React, { useState, useCallback } from 'react'
import axios from 'axios'
import './RemoteFileBrowser.css'

interface RemoteFile {
  id: number
  name: string
  title?: string  // 图片标题
  tags?: string
  filecount?: number
  url?: string
  thumb?: string
  ext?: string
  filesid?: number  // 图片文件ID，用于获取预览
  fileid?: number   // 备用字段名
}

interface RemoteFolder {
  id: number
  name: string
  tags?: string
  filecount?: number
}

interface BreadcrumbItem {
  id: number
  name: string
}

interface RemoteFileBrowserProps {
  onImagesSelected: (images: Array<{ preview: string; serverPath: string; fileName?: string }>) => void
  onClose: () => void
}

const RemoteFileBrowser: React.FC<RemoteFileBrowserProps> = ({ onImagesSelected, onClose }) => {
  // 从localStorage加载历史token
  const loadHistoryTokens = (): string[] => {
    try {
      const stored = localStorage.getItem('remote_file_tk_history')
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.warn('加载token历史失败:', e)
    }
    return []
  }

  const saveHistoryToken = (token: string) => {
    if (!token.trim()) return
    try {
      const history = loadHistoryTokens()
      // 移除重复的，然后添加到最前面
      const filtered = history.filter(t => t !== token)
      const updated = [token, ...filtered].slice(0, 10) // 最多保存10个
      localStorage.setItem('remote_file_tk_history', JSON.stringify(updated))
    } catch (e) {
      console.warn('保存token历史失败:', e)
    }
  }

  const [tk, setTk] = useState('')
  const [tkHistory, setTkHistory] = useState<string[]>(loadHistoryTokens())
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [folders, setFolders] = useState<RemoteFolder[]>([])
  const [files, setFiles] = useState<RemoteFile[]>([])
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: 0, name: '根目录' }])
  
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set())
  const [downloadingFiles, setDownloadingFiles] = useState<Set<number>>(new Set())
  const [imagePreviews, setImagePreviews] = useState<Record<number, string>>({}) // fileid -> preview_url
  const [loadingPreviews, setLoadingPreviews] = useState<Set<number>>(new Set())
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; name: string } | null>(null)

  const loadFolder = useCallback(async (folderId: number, folderName?: string) => {
    if (!tk.trim()) {
      setError('请输入访问令牌 (tk)')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('tk', tk)
      formData.append('folderid', folderId.toString())

      const response = await axios.post('/api/remote/files', formData)

      // 后端已经处理了errcode检查，这里直接使用返回的数据
      const result = response.data.result
      setFolders(result.folders || [])
      setFiles(result.files || [])
      setIsConnected(true)
      setSelectedFiles(new Set())
      
      // 为图片文件加载预览
      loadImagePreviews(result.files || [])

      // 更新面包屑
      if (folderId === 0) {
        setBreadcrumbs([{ id: 0, name: '根目录' }])
      } else if (folderName) {
        setBreadcrumbs(prev => {
          const existingIndex = prev.findIndex(item => item.id === folderId)
          if (existingIndex >= 0) {
            return prev.slice(0, existingIndex + 1)
          }
          return [...prev, { id: folderId, name: folderName }]
        })
      }
    } catch (err: any) {
      // 优先显示后端返回的详细错误信息
      const errorMessage = err.response?.data?.detail || err.message || '连接失败，请检查网络或令牌是否正确'
      setError(errorMessage)
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }, [tk])

  const loadImagePreviews = async (files: RemoteFile[]) => {
    if (!tk.trim()) return
    
    const imageFiles = files.filter(isImageFile)
    if (imageFiles.length === 0) return
    
    // 清空之前的预览
    setImagePreviews({})
    
    // 为每个图片文件获取预览URL
    for (const file of imageFiles) {
      const fileid = file.filesid || file.fileid || file.id
      if (!fileid) continue
      
      setLoadingPreviews(prev => new Set(prev).add(fileid))
      
      try {
        const formData = new FormData()
        formData.append('tk', tk)
        formData.append('fileid', fileid.toString())
        
        const response = await axios.post('/api/remote/get-image-preview', formData)
        
        if (response.data.success && response.data.preview_url) {
          setImagePreviews(prev => ({
            ...prev,
            [fileid]: response.data.preview_url
          }))
        }
      } catch (err: any) {
        console.warn(`获取图片预览失败 (fileid: ${fileid}):`, err)
        // 如果获取预览失败，不显示预览，但不影响其他功能
      } finally {
        setLoadingPreviews(prev => {
          const newSet = new Set(prev)
          newSet.delete(fileid)
          return newSet
        })
      }
    }
  }

  const handleConnect = () => {
    if (tk.trim()) {
      saveHistoryToken(tk.trim())
      setTkHistory(loadHistoryTokens())
    }
    loadFolder(0)
  }

  const handleFolderClick = (folder: RemoteFolder) => {
    loadFolder(folder.id, folder.name)
  }

  const handleBreadcrumbClick = (item: BreadcrumbItem) => {
    loadFolder(item.id, item.name)
  }

  const handleFileSelect = (file: RemoteFile, e?: React.MouseEvent) => {
    // 如果点击的是图片本身或图片包装器，不触发选择
    if (e) {
      const target = e.target as HTMLElement
      if (target.tagName === 'IMG' || target.closest('.image-preview-wrapper')) {
        return // 不处理选择，让图片的点击事件处理
      }
    }
    
    setSelectedFiles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(file.id)) {
        newSet.delete(file.id)
      } else {
        newSet.add(file.id)
      }
      return newSet
    })
  }

  const handleImagePreview = (file: RemoteFile, e: React.MouseEvent) => {
    e.stopPropagation()
    const fileid = file.filesid || file.fileid || file.id
    const previewUrl = imagePreviews[fileid]
    if (previewUrl) {
      setEnlargedImage({ url: previewUrl, name: file.name })
    }
  }

  const handleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)))
    }
  }

  const isImageFile = (file: RemoteFile): boolean => {
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
    const ext = file.ext?.toLowerCase() || file.name.split('.').pop()?.toLowerCase() || ''
    return imageExts.includes(ext)
  }

  const handleConfirmSelection = async () => {
    const selectedImageFiles = files.filter(f => selectedFiles.has(f.id) && isImageFile(f))
    
    if (selectedImageFiles.length === 0) {
      setError('请选择至少一张图片')
      return
    }

    setDownloadingFiles(new Set(selectedImageFiles.map(f => f.id)))
    setError('')

    try {
      const downloadedImages: Array<{ preview: string; serverPath: string; fileName?: string }> = []

      for (const file of selectedImageFiles) {
        const fileid = file.filesid || file.fileid || file.id
        // 优先使用预览URL，如果没有则尝试获取
        let fileUrl = imagePreviews[fileid]
        
        // 如果没有预览URL，尝试获取
        if (!fileUrl) {
          try {
            const previewFormData = new FormData()
            previewFormData.append('tk', tk)
            previewFormData.append('fileid', fileid.toString())
            
            const previewResponse = await axios.post('/api/remote/get-image-preview', previewFormData)
            if (previewResponse.data.success && previewResponse.data.preview_url) {
              fileUrl = previewResponse.data.preview_url
            }
          } catch (err) {
            console.warn(`获取预览URL失败:`, err)
          }
        }
        
        // 如果还是没有URL，使用备用方案
        if (!fileUrl) {
          fileUrl = file.url || file.thumb || `/docsv/docset/file/${fileid}`
        }
        
        const formData = new FormData()
        formData.append('tk', tk)
        formData.append('file_url', fileUrl)

        const response = await axios.post('/api/remote/download-image', formData)

        if (response.data.success) {
          downloadedImages.push({
            preview: `/api/image/${response.data.file_name}`,
            serverPath: response.data.image_path,
            fileName: file.title || file.name
          })
        }

        setDownloadingFiles(prev => {
          const newSet = new Set(prev)
          newSet.delete(file.id)
          return newSet
        })
      }

      if (downloadedImages.length > 0) {
        onImagesSelected(downloadedImages)
        onClose()
      } else {
        setError('没有成功下载任何图片')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || '下载图片失败')
      setDownloadingFiles(new Set())
    }
  }

  const imageFiles = files.filter(isImageFile)

  return (
    <div className="remote-browser-overlay">
      <div className="remote-browser-modal">
        <div className="remote-browser-header">
          <h3>📁 远程文件浏览器</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {!isConnected ? (
          <div className="connect-section">
            <div className="connect-form">
              <div className="form-group">
                <label className="label">访问令牌 (tk)</label>
                <div className="token-input-wrapper">
                  <input
                    type="text"
                    className="input"
                    value={tk}
                    onChange={(e) => setTk(e.target.value)}
                    placeholder="请输入访问令牌，如：C9NU9NE"
                    onKeyPress={(e) => e.key === 'Enter' && handleConnect()}
                    list="tk-history-list"
                  />
                  {tkHistory.length > 0 && (
                    <datalist id="tk-history-list">
                      {tkHistory.map((token, index) => (
                        <option key={index} value={token} />
                      ))}
                    </datalist>
                  )}
                  {tkHistory.length > 0 && (
                    <select
                      className="token-history-select"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setTk(e.target.value)
                        }
                      }}
                    >
                      <option value="">选择历史记录...</option>
                      {tkHistory.map((token, index) => (
                        <option key={index} value={token}>
                          {token}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <p className="hint">从文档链接中获取 tk 参数值（如：https://op.ismartgo.cn/docsv/docset.html?tk=C9NU9NE）</p>
              </div>
              
              {error && (
                <div className="error">
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                  {(error.includes('过期') || error.includes('expire')) && (
                    <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>💡 解决方案：</div>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: '1.6' }}>
                        <li>访问原始文档链接：<code style={{ background: 'rgba(0,0,0,0.2)', padding: '0.125rem 0.25rem', borderRadius: '3px' }}>https://op.ismartgo.cn/docsv/docset.html?tk=你的令牌</code></li>
                        <li>从浏览器地址栏复制新的 tk 参数值</li>
                        <li>如果问题持续，请联系管理员检查令牌权限</li>
                      </ul>
                    </div>
                  )}
                  {(error.includes('无效') || error.includes('invalid')) && (
                    <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>💡 检查事项：</div>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: '1.6' }}>
                        <li>确认令牌格式正确（通常为字母数字组合，如：C9NU9NE）</li>
                        <li>检查是否有多余的空格或特殊字符</li>
                        <li>从原始链接中重新复制 tk 参数</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              <button 
                className="btn btn-primary" 
                onClick={handleConnect}
                disabled={loading || !tk.trim()}
              >
                {loading ? '连接中...' : '连接'}
              </button>
            </div>
          </div>
        ) : (
          <div className="browser-section">
            <div className="browser-toolbar">
              <div className="breadcrumbs">
                {breadcrumbs.map((item, index) => (
                  <span key={item.id}>
                    {index > 0 && <span className="breadcrumb-sep">/</span>}
                    <button 
                      className="breadcrumb-item"
                      onClick={() => handleBreadcrumbClick(item)}
                    >
                      {item.name}
                    </button>
                  </span>
                ))}
              </div>
              <div className="toolbar-actions">
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadFolder(breadcrumbs[breadcrumbs.length - 1].id)}
                  disabled={loading}
                >
                  🔄 刷新
                </button>
              </div>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="file-list-container">
              {loading ? (
                <div className="loading-state">加载中...</div>
              ) : (
                <>
                  {folders.length > 0 && (
                    <div className="folders-section">
                      <div className="section-title">📂 文件夹 ({folders.length})</div>
                      <div className="folders-grid">
                        {folders.map((folder) => (
                          <div
                            key={folder.id}
                            className="folder-item"
                            onClick={() => handleFolderClick(folder)}
                          >
                            <span className="folder-icon">📁</span>
                            <span className="folder-name">{folder.name}</span>
                            {folder.filecount !== undefined && folder.filecount > 0 && (
                              <span className="folder-count">{folder.filecount}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {files.length > 0 && (
                    <div className="files-section">
                      <div className="section-header">
                        <div className="section-title">🖼️ 图片文件 ({imageFiles.length})</div>
                        {imageFiles.length > 0 && (
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={handleSelectAll}
                          >
                            {selectedFiles.size === imageFiles.length ? '取消全选' : '全选图片'}
                          </button>
                        )}
                      </div>
                      <div className="files-grid">
                        {files.map((file) => {
                          const isImage = isImageFile(file)
                          const isSelected = selectedFiles.has(file.id)
                          const isDownloading = downloadingFiles.has(file.id)
                          const fileid = file.filesid || file.fileid || file.id
                          const previewUrl = isImage ? imagePreviews[fileid] : null
                          const isLoadingPreview = isImage && loadingPreviews.has(fileid)
                          
                          return (
                            <div
                              key={file.id}
                              className={`file-item ${isImage ? 'image-file' : 'other-file'} ${isSelected ? 'selected' : ''} ${isDownloading ? 'downloading' : ''}`}
                              onClick={(e) => isImage && handleFileSelect(file, e)}
                            >
                              {isImage && previewUrl ? (
                                <div className="image-preview-wrapper">
                                  <img 
                                    src={previewUrl}
                                    alt={file.name}
                                    className="file-thumb"
                                    onClick={(e) => handleImagePreview(file, e)}
                                    onError={(e) => {
                                      // 如果预览加载失败，显示图标
                                      const target = e.target as HTMLImageElement
                                      target.style.display = 'none'
                                      const parent = target.parentElement
                                      if (parent && !parent.querySelector('.file-icon')) {
                                        const iconDiv = document.createElement('div')
                                        iconDiv.className = 'file-icon'
                                        iconDiv.textContent = '🖼️'
                                        parent.insertBefore(iconDiv, target.nextSibling)
                                      }
                                    }}
                                  />
                                  <div className="preview-hint">点击放大</div>
                                </div>
                              ) : isImage && isLoadingPreview ? (
                                <div className="file-icon loading-preview">
                                  <span className="loading-spinner">⏳</span>
                                </div>
                              ) : isImage ? (
                                <div className="file-icon">🖼️</div>
                              ) : (
                                <div className="file-icon">📄</div>
                              )}
                              <div className="file-name" title={file.name}>
                                {file.name}
                              </div>
                              {isSelected && <div className="select-badge">✓</div>}
                              {isDownloading && <div className="downloading-badge">⏳</div>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {folders.length === 0 && files.length === 0 && (
                    <div className="empty-state">
                      <span className="empty-icon">📭</span>
                      <p>当前文件夹为空</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="browser-footer">
              <div className="selection-info">
                已选择 {selectedFiles.size} 个文件
              </div>
              <div className="footer-actions">
                <button className="btn btn-secondary" onClick={onClose}>
                  取消
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleConfirmSelection}
                  disabled={selectedFiles.size === 0 || downloadingFiles.size > 0}
                >
                  {downloadingFiles.size > 0 
                    ? `下载中... (${downloadingFiles.size})` 
                    : `确认选择 (${selectedFiles.size})`
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 图片放大预览模态框 */}
      {enlargedImage && (
        <div className="image-enlarge-overlay" onClick={() => setEnlargedImage(null)}>
          <div className="image-enlarge-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-enlarge-header">
              <span className="image-enlarge-title">{enlargedImage.name}</span>
              <button className="close-btn" onClick={() => setEnlargedImage(null)}>×</button>
            </div>
            <div className="image-enlarge-content">
              <img src={enlargedImage.url} alt={enlargedImage.name} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RemoteFileBrowser

