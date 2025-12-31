import React, { useState } from 'react'
import axios from 'axios'
import './FileUpload.css'

interface FileUploadProps {
  onFileUploaded: (fileInfo: any) => void
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUploaded }) => {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string>('')
  const [dragActive, setDragActive] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError('')
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      const ext = droppedFile.name.split('.').pop()?.toLowerCase()
      if (['pptx', 'ppt', 'xlsx', 'xls'].includes(ext || '')) {
        setFile(droppedFile)
        setError('')
      } else {
        setError('不支持的文件类型，请上传PPT或Excel文件')
      }
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('请先选择文件')
      return
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      onFileUploaded(response.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || '文件上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="file-upload">
      <div className="card">
        <h2>上传文件</h2>
        <p className="upload-hint">支持PPT (.pptx, .ppt) 和 Excel (.xlsx, .xls) 文件</p>

        <div
          className={`upload-area ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-input"
            accept=".pptx,.ppt,.xlsx,.xls"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <label htmlFor="file-input" className="upload-label">
            {file ? (
              <div className="file-info">
                <span className="file-icon">📄</span>
                <span className="file-name">{file.name}</span>
                <span className="file-size">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            ) : (
              <div className="upload-placeholder">
                <span className="upload-icon">📤</span>
                <p>点击选择文件或拖拽文件到此处</p>
                <p className="upload-subtitle">支持 PPT 和 Excel 格式</p>
              </div>
            )}
          </label>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="upload-actions">
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? '上传中...' : '上传文件'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default FileUpload

