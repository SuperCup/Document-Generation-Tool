import React, { useState } from 'react'
import './ExcelPreview.css'

interface CellData {
  value: string
  address: string
  row: number
  col: number
  is_merged?: boolean
  is_main?: boolean
  rowspan?: number
  colspan?: number
  has_image?: boolean
  image_url?: string
}

interface ExcelPreviewProps {
  tableData: CellData[][]
  maxRow: number
  maxCol: number
  previewRows: number
  previewCols: number
  onCellSelect?: (address: string, row: number, col: number) => void
  selectedCell?: string
  cellImages?: Record<string, string> // 单元格地址 -> 图片URL
  onInsertRow?: (rowNumber: number, direction?: 'before' | 'after') => void
  onUpdateCell?: (cellAddress: string, value: string) => void
  fileId?: string
  sheetName?: string
}

const ExcelPreview: React.FC<ExcelPreviewProps> = ({
  tableData,
  maxRow,
  maxCol,
  previewRows,
  previewCols,
  onCellSelect,
  selectedCell,
  cellImages = {},
  onInsertRow,
  onUpdateCell,
  fileId: _fileId,
  sheetName: _sheetName
}) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ address: string; value: string } | null>(null)
  const [showInsertRowMenu, setShowInsertRowMenu] = useState<number | null>(null)

  const handleCellClick = async (cell: CellData, e: React.MouseEvent) => {
    try {
      // 如果正在编辑任何单元格，禁止点击其他单元格
      if (editingCell) {
        // 如果点击的是正在编辑的单元格本身，允许（用于确认/取消按钮）
        if (editingCell.address === cell.address) {
          // 双击当前编辑的单元格，不处理
          if (e.detail === 2) {
            e.stopPropagation()
            return
          }
          // 单击当前编辑的单元格，不处理（避免误操作）
          e.stopPropagation()
          return
        } else {
          // 正在编辑其他单元格，禁止点击
          e.preventDefault()
          e.stopPropagation()
          return
        }
      }
      
      // 双击进入编辑模式
      if (e.detail === 2 && onUpdateCell) {
        setEditingCell({ address: cell.address, value: cell.value || '' })
        e.stopPropagation()
        return
      }
      
      // 阻止事件冒泡，避免触发其他操作
      e.stopPropagation()
      
      if (onCellSelect) {
        onCellSelect(cell.address, cell.row, cell.col)
      }
      
      // 如果单元格有图片，显示预览
      if (cellImages[cell.address]) {
        setPreviewImage(cellImages[cell.address])
      } else {
        setPreviewImage(null)
      }
    } catch (error) {
      console.error('处理单元格点击失败:', error)
      // 确保即使出错也不会导致白屏
      setEditingCell(null)
    }
  }

  const handleCellBlur = (e: React.FocusEvent) => {
    // 如果焦点移动到确认按钮，不保存（由确认按钮处理）
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).classList.contains('cell-edit-confirm')) {
      return
    }
    // 如果焦点移动到取消按钮，不保存（由取消按钮处理）
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).classList.contains('cell-edit-cancel')) {
      return
    }
    // 如果焦点移动到输入框本身，不保存
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).classList.contains('cell-edit-input')) {
      return
    }
    
    if (editingCell && onUpdateCell) {
      onUpdateCell(editingCell.address, editingCell.value)
      setEditingCell(null)
    }
  }

  const handleConfirmEdit = () => {
    if (editingCell && onUpdateCell) {
      onUpdateCell(editingCell.address, editingCell.value)
      setEditingCell(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingCell(null)
  }

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (editingCell && onUpdateCell) {
        onUpdateCell(editingCell.address, editingCell.value)
        setEditingCell(null)
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }

  const handleInsertRow = (rowNumber: number, direction: 'before' | 'after') => {
    if (onInsertRow) {
      // 如果是最后一行且方向是after，插入到maxRow+1的位置
      if (direction === 'after' && rowNumber === maxRow) {
        onInsertRow(maxRow + 1, 'before')
      } else {
        onInsertRow(rowNumber, direction)
      }
      setShowInsertRowMenu(null)
    }
  }

  // 生成列标题（A, B, C...）
  const getColumnHeader = (col: number) => {
    let result = ''
    let num = col
    while (num > 0) {
      num--
      result = String.fromCharCode(65 + (num % 26)) + result
      num = Math.floor(num / 26)
    }
    return result || 'A'
  }

  // 检查单元格是否应该显示（合并单元格中非主单元格不显示）
  const shouldDisplayCell = (cell: CellData) => {
    if (cell.is_merged && !cell.is_main) {
      return false
    }
    return true
  }

  return (
    <div className={`excel-preview ${editingCell ? 'has-editing-cell' : ''}`}>
      <div className="preview-header">
        <span>Excel预览</span>
        <span className="preview-info">
          显示 {previewRows} 行 × {previewCols} 列（共 {maxRow} 行 × {maxCol} 列）
          {onInsertRow && <span style={{ marginLeft: '1rem', color: '#667eea' }}>| 右键行号向上/向下插入行</span>}
          {onUpdateCell && <span style={{ marginLeft: '0.5rem', color: '#667eea' }}>| 双击单元格编辑</span>}
        </span>
      </div>
      <div className="excel-table-container">
        <table className="excel-table">
          <thead>
            <tr>
              <th className="row-header"></th>
              {Array.from({ length: previewCols }, (_, i) => (
                <th key={i} className="col-header">
                  {getColumnHeader(i + 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td 
                  className="row-header"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (onInsertRow) {
                      setShowInsertRowMenu(showInsertRowMenu === rowIndex + 1 ? null : rowIndex + 1)
                    }
                  }}
                  title="右键插入行"
                >
                  {rowIndex + 1}
                  {showInsertRowMenu === rowIndex + 1 && (
                    <div className="insert-row-menu">
                      <button
                        className="insert-row-btn-up"
                        onClick={() => handleInsertRow(rowIndex + 1, 'before')}
                        title="在此行前插入新行"
                      >
                        ↑
                      </button>
                      <button
                        className="insert-row-btn-down"
                        onClick={() => handleInsertRow(rowIndex + 1, 'after')}
                        title="在此行后插入新行"
                      >
                        ↓
                      </button>
                    </div>
                  )}
                </td>
                {row.map((cell, colIndex) => {
                  if (!shouldDisplayCell(cell)) {
                    return null
                  }
                  
                  const hasImage = cellImages[cell.address]
                  const isSelected = selectedCell === cell.address
                  const isEditing = editingCell?.address === cell.address
                  
                  return (
                    <td
                      key={colIndex}
                      className={`excel-cell ${
                        isSelected ? 'selected' : ''
                      } ${cell.value ? 'has-value' : ''} ${hasImage ? 'has-image' : ''} ${isEditing ? 'editing' : ''}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleCellClick(cell, e)
                      }}
                      onMouseDown={(e) => {
                        // 如果正在编辑任何单元格，阻止点击其他单元格
                        if (editingCell && editingCell.address !== cell.address) {
                          e.preventDefault()
                          e.stopPropagation()
                          return false
                        }
                      }}
                      style={{
                        cursor: editingCell && editingCell.address !== cell.address ? 'not-allowed' : 'pointer',
                        opacity: editingCell && editingCell.address !== cell.address ? 0.5 : 1,
                        pointerEvents: editingCell && editingCell.address !== cell.address ? 'none' : 'auto'
                      }}
                      title={isEditing ? '按Enter或点击✓保存，Esc或点击×取消' : '双击编辑'}
                      rowSpan={cell.rowspan || 1}
                      colSpan={cell.colspan || 1}
                    >
                      {isEditing ? (
                        <div className="cell-edit-wrapper">
                          <input
                            type="text"
                            className="cell-edit-input"
                            value={editingCell.value}
                            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                            onBlur={handleCellBlur}
                            onKeyDown={handleCellKeyDown}
                            autoFocus
                          />
                          <div className="cell-edit-buttons">
                            <button
                              className="cell-edit-confirm"
                              onClick={handleConfirmEdit}
                              title="确认 (Enter)"
                            >
                              ✓
                            </button>
                            <button
                              className="cell-edit-cancel"
                              onClick={handleCancelEdit}
                              title="取消 (Esc)"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {hasImage && (
                            <div className="cell-image-indicator" title="点击预览图片">
                              🖼️
                            </div>
                          )}
                          {cell.value || ''}
                        </>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedCell && (
        <div className="selected-cell-info">
          已选择单元格: <strong>{selectedCell}</strong>
          {cellImages[selectedCell] && (
            <span className="image-indicator"> (包含图片)</span>
          )}
        </div>
      )}
      
      {previewImage && (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="image-preview-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setPreviewImage(null)}>×</button>
            <img src={previewImage} alt="预览" />
          </div>
        </div>
      )}
    </div>
  )
}

export default ExcelPreview
