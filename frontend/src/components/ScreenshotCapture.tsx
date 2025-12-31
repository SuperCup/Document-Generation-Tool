import React, { useState, useRef, useEffect } from 'react'
import html2canvas from 'html2canvas'
import axios from 'axios'
import './ScreenshotCapture.css'

interface ScreenshotCaptureProps {
  onScreenshotSaved?: (imagePath: string, imageInfo: ImageInfo) => void
}

interface ImageInfo {
  name: string
  description: string
  tags?: string
}

const ScreenshotCapture: React.FC<ScreenshotCaptureProps> = ({ onScreenshotSaved }) => {
  const [isCapturing, setIsCapturing] = useState(false)
  const [isLongScreenshot, setIsLongScreenshot] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [imageInfo, setImageInfo] = useState<ImageInfo>({
    name: '',
    description: '',
    tags: ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const captureBoxRef = useRef<HTMLDivElement>(null)
  const [boxPosition, setBoxPosition] = useState({ x: 100, y: 100 })
  const [boxSize, setBoxSize] = useState({ width: 400, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [_droppedContent, setDroppedContent] = useState<string | null>(null)
  const [droppedImage, setDroppedImage] = useState<string | null>(null)

  // 处理文件拖入
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))

    if (imageFile) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string
        setDroppedImage(imageUrl)
        setDroppedContent(null)
      }
      reader.readAsDataURL(imageFile)
    } else if (files.length > 0) {
      setMessage({ type: 'error', text: '请拖入图片文件' })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  // 处理拖动
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('capture-box-header')) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - boxPosition.x,
        y: e.clientY - boxPosition.y
      })
    }
  }

  // 处理调整大小
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: boxSize.width,
      height: boxSize.height
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setBoxPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        })
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y
        setBoxSize({
          width: Math.max(200, resizeStart.width + deltaX),
          height: Math.max(200, resizeStart.height + deltaY)
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, dragStart, resizeStart])

  // 截图功能
  const captureScreenshot = async () => {
    if (!captureBoxRef.current) return

    setIsCapturing(true)
    setMessage(null)

    try {
      const box = captureBoxRef.current
      const contentElement = box.querySelector('.capture-content') as HTMLElement
      
      if (!contentElement) {
        throw new Error('未找到截图内容区域')
      }

      let canvas: HTMLCanvasElement

      if (isLongScreenshot) {
        // 滚动截图：捕获整个可滚动区域
        const originalScrollTop = contentElement.scrollTop
        const originalScrollLeft = contentElement.scrollLeft
        
        // 获取滚动容器的完整尺寸
        const scrollHeight = contentElement.scrollHeight
        const scrollWidth = contentElement.scrollWidth
        const clientWidth = contentElement.clientWidth
        const clientHeight = contentElement.clientHeight
        
        // 如果内容可以滚动，使用滚动截图
        if (scrollHeight > clientHeight || scrollWidth > clientWidth) {
          canvas = await html2canvas(contentElement, {
            width: scrollWidth,
            height: scrollHeight,
            scrollX: -contentElement.scrollLeft,
            scrollY: -contentElement.scrollTop,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false
          })
        } else {
          // 如果内容不需要滚动，使用普通截图
          canvas = await html2canvas(contentElement, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false
          })
        }
        
        // 恢复滚动位置
        contentElement.scrollTop = originalScrollTop
        contentElement.scrollLeft = originalScrollLeft
      } else {
        // 普通截图：只捕获可见区域
        canvas = await html2canvas(contentElement, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        })
      }

      const imageDataUrl = canvas.toDataURL('image/png', 0.95)
      setCapturedImage(imageDataUrl)
      setMessage({ type: 'success', text: '截图成功！请填写图片信息并保存' })
    } catch (error: any) {
      setMessage({ type: 'error', text: '截图失败: ' + (error.message || '未知错误') })
    } finally {
      setIsCapturing(false)
    }
  }

  // 保存截图
  const saveScreenshot = async () => {
    if (!capturedImage || !imageInfo.name.trim()) {
      setMessage({ type: 'error', text: '请填写图片名称' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      // 将 base64 转换为 Blob
      const response = await fetch(capturedImage)
      const blob = await response.blob()
      const file = new File([blob], `${imageInfo.name}.png`, { type: 'image/png' })

      // 上传图片
      const formData = new FormData()
      formData.append('files', file)

      const uploadResponse = await axios.post('/api/upload-images', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // 保存图片信息（可以扩展后端API来保存元数据）
      const savedInfo = {
        ...imageInfo,
        imagePath: uploadResponse.data.image_paths[0],
        timestamp: new Date().toISOString()
      }

      setMessage({ type: 'success', text: '图片保存成功！' })
      
      if (onScreenshotSaved) {
        onScreenshotSaved(savedInfo.imagePath, savedInfo)
      }

      // 重置状态
      setTimeout(() => {
        setCapturedImage(null)
        setImageInfo({ name: '', description: '', tags: '' })
        setMessage(null)
      }, 2000)
    } catch (error: any) {
      setMessage({ type: 'error', text: '保存失败: ' + (error.response?.data?.detail || error.message) })
    } finally {
      setSaving(false)
    }
  }

  // 重置
  const handleReset = () => {
    setCapturedImage(null)
    setImageInfo({ name: '', description: '', tags: '' })
    setMessage(null)
  }

  return (
    <div className="screenshot-capture">
      <div className="screenshot-controls">
        <div className="control-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isLongScreenshot}
              onChange={(e) => setIsLongScreenshot(e.target.checked)}
            />
            <span>滚动截图（长图）</span>
          </label>
        </div>
        <button
          className="btn btn-primary"
          onClick={captureScreenshot}
          disabled={isCapturing}
        >
          {isCapturing ? '截图中...' : '截图'}
        </button>
      </div>

      <div
        ref={captureBoxRef}
        className="capture-box"
        style={{
          left: `${boxPosition.x}px`,
          top: `${boxPosition.y}px`,
          width: `${boxSize.width}px`,
          height: `${boxSize.height}px`
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="capture-box-header">
          <span>📷 截图框 - 将需要截图的内容拖入此框</span>
          <span className="capture-hint">可拖动 | 可调整大小</span>
        </div>
        <div 
          className="capture-content"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {droppedImage ? (
            <div className="dropped-image-container">
              <img src={droppedImage} alt="拖入的图片" className="dropped-image" />
              <button 
                className="btn btn-secondary remove-image-btn"
                onClick={() => {
                  setDroppedImage(null)
                  setDroppedContent(null)
                }}
              >
                移除图片
              </button>
            </div>
          ) : (
            <div className="capture-placeholder">
              <p>📱 将小程序界面、模拟器或其他内容拖入此框</p>
              <p className="hint-small">提示：可以调整框的大小和位置来框选目标区域</p>
              <p className="hint-small">💡 使用方式：</p>
              <ul className="usage-tips">
                <li>将图片文件直接拖入此框进行截图</li>
                <li>将需要截图的应用窗口拖到浏览器中，然后调整此框覆盖目标区域</li>
                <li>在框内可以滚动查看长内容，启用"滚动截图"可捕获完整内容</li>
              </ul>
            {isLongScreenshot ? (
              <div className="long-screenshot-demo">
                <p>📜 滚动截图模式已启用：将自动捕获完整的长内容</p>
                <div className="demo-content">
                  <div className="demo-item">内容项 1</div>
                  <div className="demo-item">内容项 2</div>
                  <div className="demo-item">内容项 3</div>
                  <div className="demo-item">内容项 4</div>
                  <div className="demo-item">内容项 5</div>
                  <div className="demo-item">内容项 6</div>
                  <div className="demo-item">内容项 7</div>
                  <div className="demo-item">内容项 8</div>
                  <div className="demo-item">内容项 9</div>
                  <div className="demo-item">内容项 10</div>
                </div>
                <p className="hint-small">⬆️ 可以滚动查看完整内容，截图时将自动捕获全部</p>
              </div>
            ) : (
              <div className="normal-screenshot-demo">
                <p>📸 普通截图模式：只捕获当前可见区域</p>
                <div className="demo-box">
                  <div className="demo-content-short">
                    <div className="demo-item">可见内容 1</div>
                    <div className="demo-item">可见内容 2</div>
                    <div className="demo-item">可见内容 3</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
        <div
          className="resize-handle"
          onMouseDown={handleResizeMouseDown}
        />
      </div>

      {capturedImage && (
        <div className="screenshot-preview">
          <div className="card">
            <h3>截图预览</h3>
            <div className="preview-image-container">
              <img src={capturedImage} alt="截图预览" className="preview-image" />
            </div>
            <div className="image-info-form">
              <div className="form-group">
                <label className="label">图片名称 *</label>
                <input
                  type="text"
                  className="input"
                  value={imageInfo.name}
                  onChange={(e) => setImageInfo({ ...imageInfo, name: e.target.value })}
                  placeholder="请输入图片名称"
                />
              </div>
              <div className="form-group">
                <label className="label">图片描述</label>
                <textarea
                  className="input"
                  rows={3}
                  value={imageInfo.description}
                  onChange={(e) => setImageInfo({ ...imageInfo, description: e.target.value })}
                  placeholder="请输入图片描述（可选）"
                />
              </div>
              <div className="form-group">
                <label className="label">标签</label>
                <input
                  type="text"
                  className="input"
                  value={imageInfo.tags}
                  onChange={(e) => setImageInfo({ ...imageInfo, tags: e.target.value })}
                  placeholder="请输入标签，用逗号分隔（可选）"
                />
              </div>
              <div className="form-actions">
                <button
                  className="btn btn-success"
                  onClick={saveScreenshot}
                  disabled={saving || !imageInfo.name.trim()}
                >
                  {saving ? '保存中...' : '保存图片'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleReset}
                  disabled={saving}
                >
                  重新截图
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  )
}

export default ScreenshotCapture

