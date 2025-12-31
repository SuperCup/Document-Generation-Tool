import React, { useState, useEffect } from 'react'
import axios from 'axios'
import ExcelPreview from './ExcelPreview'
import RemoteFileBrowser from './RemoteFileBrowser'
import './ExcelEditor.css'

interface ExcelEditorProps {
  fileInfo: any
  onBack: () => void
}

interface CellData {
  value: string
  address: string
  row: number
  col: number
  is_merged?: boolean
  is_main?: boolean
  rowspan?: number
  colspan?: number
}

interface SheetInfo {
  max_row: number
  max_col: number
  preview_rows: number
  preview_cols: number
  table_data: CellData[][]
}

const ExcelEditor: React.FC<ExcelEditorProps> = ({ fileInfo, onBack }) => {
  const [sheets, setSheets] = useState<Record<string, SheetInfo>>({})
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [startCell, setStartCell] = useState('')
  const [cellWidth, setCellWidth] = useState(5.0)
  const [cellHeight, setCellHeight] = useState(4.0)
  const [selectedImages, setSelectedImages] = useState<Array<{ preview: string; serverPath: string; id: string; fileName?: string }>>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [cellImages, setCellImages] = useState<Record<string, string>>({})
  const [hasInsertedImages, setHasInsertedImages] = useState(false) // 标记是否已插入过图片
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showRemoteBrowser, setShowRemoteBrowser] = useState(false)

  useEffect(() => {
    loadCells()
  }, [])

  useEffect(() => {
    if (Object.keys(sheets).length > 0 && !selectedSheet) {
      setSelectedSheet(Object.keys(sheets)[0])
    }
  }, [sheets])

  const loadCells = async () => {
    try {
      const response = await axios.get(`/api/excel/cells/${fileInfo.file_id}`)
      setSheets(response.data.cells)
      setLoading(false)
    } catch (err: any) {
      setMessage({ type: 'error', text: '加载Excel数据失败: ' + (err.response?.data?.detail || err.message) })
      setLoading(false)
    }
  }

  const handleCellSelect = (address: string, _row: number, _col: number) => {
    setStartCell(address)
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
          id: `img_${Date.now()}_${index}`,
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

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null) return

    const newImages = [...selectedImages]
    const draggedImage = newImages[draggedIndex]
    newImages.splice(draggedIndex, 1)
    newImages.splice(dropIndex, 0, draggedImage)
    
    setSelectedImages(newImages)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleRemoteImagesSelected = (images: Array<{ preview: string; serverPath: string; fileName?: string }>) => {
    const newImages = images.map((img, index) => ({
      ...img,
      id: `remote_${Date.now()}_${index}`
    }))
    setSelectedImages(prev => [...prev, ...newImages])
  }

  const handleInsertImages = async () => {
    if (!startCell.trim()) {
      setMessage({ type: 'error', text: '请选择起始单元格' })
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
      formData.append('start_cell', startCell)
      formData.append('images', JSON.stringify(imagePaths))
      formData.append('cell_width_cm', cellWidth.toString())
      formData.append('cell_height_cm', cellHeight.toString())
      if (selectedSheet) {
        formData.append('sheet_name', selectedSheet)
      }

      const response = await axios.post('/api/excel/insert-images-batch', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setMessage({ 
        type: 'success', 
        text: `成功插入 ${selectedImages.length} 张图片！请在预览表格中选择新的起始位置继续插入。` 
      })
      
      // 标记已插入过图片
      setHasInsertedImages(true)
      
      // 更新单元格图片映射
      if (response.data.cell_images) {
        const newCellImages: Record<string, string> = {}
        Object.keys(response.data.cell_images).forEach(cell => {
          // 将服务器路径转换为可访问的URL
          const imagePath = response.data.cell_images[cell]
          // 提取文件名
          const fileName = imagePath.split(/[/\\]/).pop() || ''
          // 构建API URL
          newCellImages[cell] = `/api/image/${fileName}`
        })
        setCellImages({ ...cellImages, ...newCellImages })
      }
      
      // 重新加载单元格数据以显示合并单元格和最新状态
      await loadCells()
      
      // 插入成功后，清空已选择的图片
      setSelectedImages([])
      // 清空起始单元格，让用户可以选择新的起始位置继续插入
      setStartCell('')
      
      // 滚动到预览表格，方便用户选择新位置
      setTimeout(() => {
        const previewElement = document.querySelector('.excel-preview')
        if (previewElement) {
          previewElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || '插入图片失败' })
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    window.open(`/api/download/${fileInfo.file_id}`, '_blank')
  }

  const handleInsertRow = async (rowNumber: number, direction: 'before' | 'after' = 'before') => {
    try {
      const formData = new FormData()
      formData.append('file_id', fileInfo.file_id)
      formData.append('row_number', rowNumber.toString())
      formData.append('direction', direction)
      if (selectedSheet) {
        formData.append('sheet_name', selectedSheet)
      }

      await axios.post('/api/excel/insert-row', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // 重新加载数据
      await loadCells()
      const directionText = direction === 'before' ? '前' : '后'
      setMessage({ type: 'success', text: `成功在第 ${rowNumber} 行${directionText}插入新行` })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || '插入行失败' })
    }
  }

  const handleUpdateCell = async (cellAddress: string, value: string) => {
    try {
      const formData = new FormData()
      formData.append('file_id', fileInfo.file_id)
      formData.append('cell_address', cellAddress)
      formData.append('value', value)
      if (selectedSheet) {
        formData.append('sheet_name', selectedSheet)
      }

      await axios.post('/api/excel/update-cell', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // 重新加载数据
      await loadCells()
      setHasInsertedImages(true) // 标记已修改文件
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || '更新单元格失败' })
    }
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  const currentSheet = selectedSheet ? sheets[selectedSheet] : null

  return (
    <div className="excel-editor">
      <div className="editor-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← 返回
        </button>
        <h2>Excel 编辑器 - {fileInfo.file_name}</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="file-info-badge">
            {Object.keys(sheets).length} 个工作表
          </div>
          {hasInsertedImages && (
            <button className="btn btn-success" onClick={handleDownload}>
              导出结果
            </button>
          )}
        </div>
      </div>

      <div className="editor-content">
        <div className="card">
          <h3>选择工作表</h3>
          <div className="sheets-list">
            {Object.keys(sheets).map((sheetName) => (
              <button
                key={sheetName}
                className={`sheet-btn ${selectedSheet === sheetName ? 'active' : ''}`}
                onClick={() => setSelectedSheet(sheetName)}
              >
                {sheetName}
              </button>
            ))}
          </div>
        </div>

        {currentSheet && (
          <>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Excel预览</h3>
                {selectedImages.length > 0 && (
                  <div style={{ 
                    padding: '0.5rem 1rem', 
                    background: '#fff3cd', 
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    color: '#856404'
                  }}>
                    已选择 {selectedImages.length} 张图片，请点击表格选择插入位置
                  </div>
                )}
              </div>
              <ExcelPreview
                tableData={currentSheet.table_data}
                maxRow={currentSheet.max_row}
                maxCol={currentSheet.max_col}
                previewRows={currentSheet.preview_rows}
                previewCols={currentSheet.preview_cols}
                onCellSelect={handleCellSelect}
                selectedCell={startCell}
                cellImages={cellImages}
                onInsertRow={handleInsertRow}
                onUpdateCell={handleUpdateCell}
                fileId={fileInfo.file_id}
                sheetName={selectedSheet}
              />
            </div>

            <div className="card">
              <h3>贴图设置</h3>
              
              <div className="form-group">
                <label className="label">起始单元格</label>
                <input
                  type="text"
                  className="input"
                  value={startCell}
                  onChange={(e) => setStartCell(e.target.value.toUpperCase())}
                  placeholder="点击上方表格选择单元格，或手动输入（如：A1）"
                />
                <p className="hint">
                  {startCell 
                    ? `已选择起始位置：${startCell}，将从此位置开始插入图片`
                    : '在预览表格中点击单元格选择起始位置，或手动输入单元格地址'}
                </p>
                {selectedImages.length > 0 && !startCell && (
                  <p className="hint" style={{ color: '#ff9800', fontWeight: 600 }}>
                    ⚠️ 请选择起始单元格位置
                  </p>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="label">单元格宽度（厘米）</label>
                  <input
                    type="number"
                    className="input"
                    value={cellWidth}
                    onChange={(e) => setCellWidth(parseFloat(e.target.value) || 5.0)}
                    min="0.5"
                    max="50"
                    step="0.1"
                  />
                </div>

                <div className="form-group">
                  <label className="label">单元格默认高度（厘米）</label>
                  <input
                    type="number"
                    className="input"
                    value={cellHeight}
                    onChange={(e) => setCellHeight(parseFloat(e.target.value) || 4.0)}
                    min="0.5"
                    max="50"
                    step="0.1"
                  />
                </div>

              </div>
            </div>

            <div className="card">
              <h3>选择图片</h3>
              <div className="form-group">
                <label className="label">选择图片文件</label>
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
                <p className="hint">支持从本地选择图片或从远程文件服务器加载</p>
              </div>

              {selectedImages.length > 0 && (
                <div className="images-preview">
                  <div className="images-header">
                    <span>已选择 {selectedImages.length} 张图片（可拖拽调整顺序）</span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setSelectedImages([])}
                      style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                    >
                      清空
                    </button>
                  </div>
                  <div className="images-scroll-container">
                    <div className="images-scroll">
                      {selectedImages.map((img, index) => (
                        <div
                          key={img.id}
                          className={`image-preview-item ${draggedIndex === index ? 'dragging' : ''}`}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                        >
                          <img src={img.preview} alt={`预览 ${index + 1}`} />
                          <div className="image-index">{index + 1}</div>
                          <div className="image-name" title={img.fileName || `图片 ${index + 1}`}>
                            {img.fileName || `图片 ${index + 1}`}
                          </div>
                          <button
                            className="remove-image-btn"
                            onClick={() => removeImage(index)}
                            title="删除"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {message && (
                <div className={message.type === 'success' ? 'success' : 'error'}>
                  {message.text}
                </div>
              )}

              <div className="editor-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleInsertImages}
                  disabled={processing || selectedImages.length === 0 || !startCell}
                >
                  {processing ? '处理中...' : `插入 ${selectedImages.length} 张图片`}
                </button>
                {hasInsertedImages && (
                  <button className="btn btn-success" onClick={handleDownload}>
                    导出结果
                  </button>
                )}
                {message?.type === 'success' && (
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setStartCell('')
                      setMessage(null)
                      // 滚动到预览表格
                      setTimeout(() => {
                        const previewElement = document.querySelector('.excel-preview')
                        if (previewElement) {
                          previewElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      }, 100)
                    }}
                  >
                    选择新位置继续插入
                  </button>
                )}
              </div>
            </div>
          </>
        )}
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

export default ExcelEditor
