import { useState } from 'react'
import FileUpload from './components/FileUpload'
import PPTEditor from './components/PPTEditor'
import ExcelEditor from './components/ExcelEditor'
import ScreenshotCapture from './components/ScreenshotCapture'
import './App.css'

interface FileInfo {
  file_id: string
  file_name: string
  type: 'ppt' | 'excel'
  [key: string]: any
}

function App() {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [step, setStep] = useState<'upload' | 'edit' | 'screenshot'>('upload')

  const handleFileUploaded = (info: FileInfo) => {
    setFileInfo(info)
    setStep('edit')
  }

  const handleBack = () => {
    setFileInfo(null)
    setStep('upload')
  }

  const handleScreenshotSaved = (imagePath: string, imageInfo: any) => {
    console.log('截图已保存:', imagePath, imageInfo)
    // 可以在这里添加后续处理，比如自动添加到图片列表
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>文档生成工具</h1>
        <p>支持 PPT 和 Excel 文档编辑，以及智能截图功能</p>
      </header>
      <main className="app-main">
        {step === 'upload' ? (
          <div>
            <div className="mode-selector">
              <button
                className="btn btn-primary mode-btn"
                onClick={() => setStep('screenshot')}
              >
                📷 智能截图
              </button>
            </div>
            <FileUpload onFileUploaded={handleFileUploaded} />
          </div>
        ) : step === 'screenshot' ? (
          <div>
            <div className="back-button-container">
              <button className="btn btn-secondary" onClick={handleBack}>
                ← 返回文件上传
              </button>
            </div>
            <ScreenshotCapture onScreenshotSaved={handleScreenshotSaved} />
          </div>
        ) : fileInfo?.type === 'ppt' ? (
          <PPTEditor fileInfo={fileInfo} onBack={handleBack} />
        ) : (
          <ExcelEditor fileInfo={fileInfo} onBack={handleBack} />
        )}
      </main>
    </div>
  )
}

export default App

