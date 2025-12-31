from openpyxl import load_workbook
from openpyxl.drawing.image import Image
from openpyxl.utils import get_column_letter, column_index_from_string
from openpyxl.utils.cell import coordinate_from_string
from typing import List, Dict, Optional
import asyncio
from pathlib import Path
from PIL import Image as PILImage


class ExcelService:
    """Excel文件处理服务"""
    
    async def parse_file(self, file_path: str) -> Dict:
        """解析Excel文件，返回基本信息"""
        def _parse():
            wb = load_workbook(file_path, data_only=True)
            sheets_info = []
            
            for sheet_name in wb.sheetnames:
                sheet = wb[sheet_name]
                max_row = sheet.max_row
                max_col = sheet.max_column
                
                # 获取一些示例单元格信息
                sample_cells = []
                for row in range(1, min(6, max_row + 1)):
                    for col in range(1, min(6, max_col + 1)):
                        cell = sheet.cell(row, col)
                        if cell.value:
                            sample_cells.append({
                                "address": cell.coordinate,
                                "value": str(cell.value)[:50]
                            })
                
                sheets_info.append({
                    "name": sheet_name,
                    "max_row": max_row,
                    "max_col": max_col,
                    "sample_cells": sample_cells[:10]  # 限制数量
                })
            
            return {
                "type": "excel",
                "total_sheets": len(wb.sheetnames),
                "sheets": sheets_info
            }
        
        return await asyncio.to_thread(_parse)
    
    async def get_cells(self, file_path: str, sheet_name: Optional[str] = None) -> Dict:
        """获取Excel的单元格信息（用于预览）"""
        def _get_cells():
            wb = load_workbook(file_path, data_only=True)
            
            if sheet_name and sheet_name in wb.sheetnames:
                sheets_to_process = [wb[sheet_name]]
            else:
                sheets_to_process = [wb[sheet] for sheet in wb.sheetnames]
            
            result = {}
            for sheet in sheets_to_process:
                # 获取表格数据（限制行数和列数用于预览）
                max_preview_row = min(sheet.max_row, 100)
                max_preview_col = min(sheet.max_column, 50)
                
                # 获取合并单元格信息
                merged_cells = {}
                for merged_range in sheet.merged_cells.ranges:
                    min_col, min_row, max_col, max_row = merged_range.bounds
                    # 记录合并单元格的主单元格（左上角）
                    for row in range(min_row, max_row + 1):
                        for col in range(min_col, max_col + 1):
                            cell_key = f"{row}_{col}"
                            merged_cells[cell_key] = {
                                "is_merged": True,
                                "is_main": (row == min_row and col == min_col),
                                "rowspan": max_row - min_row + 1,
                                "colspan": max_col - min_col + 1,
                                "main_row": min_row,
                                "main_col": min_col
                            }
                
                # 构建表格数据
                table_data = []
                for row in range(1, max_preview_row + 1):
                    row_data = []
                    for col in range(1, max_preview_col + 1):
                        cell_key = f"{row}_{col}"
                        cell = sheet.cell(row, col)
                        cell_value = cell.value
                        if cell_value is not None:
                            # 格式化值
                            if isinstance(cell_value, (int, float)):
                                cell_value = str(cell_value)
                            else:
                                cell_value = str(cell_value)[:100]  # 限制长度
                        else:
                            cell_value = ""
                        
                        cell_info = {
                            "value": cell_value,
                            "address": cell.coordinate,
                            "row": row,
                            "col": col
                        }
                        
                        # 添加合并单元格信息
                        if cell_key in merged_cells:
                            merge_info = merged_cells[cell_key]
                            cell_info["is_merged"] = merge_info["is_merged"]
                            cell_info["is_main"] = merge_info["is_main"]
                            cell_info["rowspan"] = merge_info["rowspan"]
                            cell_info["colspan"] = merge_info["colspan"]
                        else:
                            cell_info["is_merged"] = False
                            cell_info["is_main"] = True
                            cell_info["rowspan"] = 1
                            cell_info["colspan"] = 1
                        
                        row_data.append(cell_info)
                    table_data.append(row_data)
                
                result[sheet.title] = {
                    "max_row": sheet.max_row,
                    "max_col": sheet.max_column,
                    "preview_rows": max_preview_row,
                    "preview_cols": max_preview_col,
                    "table_data": table_data
                }
            
            return result
        
        return await asyncio.to_thread(_get_cells)
    
    async def insert_image(
        self,
        input_path: str,
        output_path: str,
        cell_address: str,
        image_path: str,
        sheet_name: Optional[str] = None,
        width: Optional[int] = None,
        height: Optional[int] = None
    ):
        """在指定单元格插入图片"""
        def _insert():
            wb = load_workbook(input_path)
            
            # 选择工作表
            if sheet_name and sheet_name in wb.sheetnames:
                sheet = wb[sheet_name]
            else:
                sheet = wb.active
            
            # 检查图片文件是否存在
            if not Path(image_path).exists():
                raise FileNotFoundError(f"图片文件不存在: {image_path}")
            
            # 创建图片对象
            img = Image(image_path)
            
            # 调整图片大小
            if width:
                img.width = width
            if height:
                img.height = height
            
            # 如果没有指定大小，使用默认大小
            if not width and not height:
                # 默认大小：适应单元格
                img.width = 200
                img.height = 150
            
            # 将图片锚定到指定单元格
            sheet.add_image(img, cell_address)
            
            # 保存文件
            wb.save(output_path)
        
        await asyncio.to_thread(_insert)
    
    @staticmethod
    def cm_to_excel_width(cm: float) -> float:
        """将厘米转换为Excel列宽单位（字符宽度）
        Excel列宽单位：1个字符宽度 ≈ 7像素（默认字体）
        1厘米 ≈ 37.795像素 ≈ 5.4个字符宽度
        """
        return cm * 5.4
    
    @staticmethod
    def cm_to_excel_height(cm: float) -> float:
        """将厘米转换为Excel行高单位（磅）
        Excel行高单位：磅（points）
        1厘米 = 28.35磅
        """
        return cm * 28.35
    
    @staticmethod
    def cm_to_pixels(cm: float) -> int:
        """将厘米转换为像素（用于图片尺寸）
        1厘米 ≈ 37.795像素
        """
        return int(cm * 37.795)
    
    @staticmethod
    def cm_to_emu(cm: float) -> int:
        """将厘米转换为EMU（English Metric Units）
        注意：openpyxl的Image对象实际使用像素单位，此方法保留用于其他用途
        1厘米 = 360000 EMU
        """
        return int(cm * 360000)
    
    async def insert_images_batch(
        self,
        input_path: str,
        output_path: str,
        start_cell: str,
        image_paths: List[str],
        sheet_name: Optional[str] = None,
        cell_width_cm: float = 5.0,
        cell_height_cm: float = 4.0
    ):
        """批量插入图片到Excel
        
        Args:
            input_path: 输入文件路径
            output_path: 输出文件路径
            start_cell: 起始单元格地址（如 'A1'）
            image_paths: 图片路径列表
            sheet_name: 工作表名称
            cell_width_cm: 单元格宽度（厘米）
            cell_height_cm: 单元格默认高度（厘米）
        """
        def _insert_batch():
            wb = load_workbook(input_path)
            
            # 选择工作表
            if sheet_name and sheet_name in wb.sheetnames:
                sheet = wb[sheet_name]
            else:
                sheet = wb.active
            
            # 解析起始单元格
            col_letter, row_num = coordinate_from_string(start_cell)
            start_col = column_index_from_string(col_letter)
            start_row = int(row_num)
            
            # 转换单位
            # openpyxl的Image对象使用像素单位，1厘米 ≈ 37.795像素（96 DPI）
            cell_width_px = self.cm_to_pixels(cell_width_cm)
            cell_height_px = self.cm_to_pixels(cell_height_cm)
            excel_col_width = self.cm_to_excel_width(cell_width_cm)
            excel_row_height = self.cm_to_excel_height(cell_height_cm)
            
            # 记录需要设置大小的单元格（行和列分开记录）
            rows_to_resize = set()
            cols_to_resize = set()
            
            # 记录每行哪些列有长图（超出默认高度，会遮挡下一行）
            # key: row, value: set of cols
            tall_image_cols_by_row = {}
            
            # 记录插入图片的单元格信息
            inserted_cells = []
            
            current_row = start_row
            current_col = start_col
            
            # 按顺序插入图片（一直往右插入，不限制每行数量）
            for image_path in image_paths:
                if not Path(image_path).exists():
                    continue
                
                # 获取图片原始尺寸（像素）
                try:
                    with PILImage.open(image_path) as pil_img:
                        img_width_px, img_height_px = pil_img.size
                except Exception:
                    img_width_px, img_height_px = cell_width_px, cell_height_px
                
                # 计算图片显示尺寸（宽度固定为单元格宽度，高度按比例）
                # 宽度：固定为单元格宽度（像素）
                display_width_px = cell_width_px
                # 高度：按原始比例计算（像素）
                # 先计算高度比例：原始高度/原始宽度
                aspect_ratio = img_height_px / img_width_px if img_width_px > 0 else 1
                # 计算显示高度（像素）：宽度 * 比例
                display_height_px = int(cell_width_px * aspect_ratio)
                
                # 检查图片高度是否超出单元格默认高度（像素）
                is_tall_image = display_height_px > cell_height_px
                
                # 检查当前位置是否被上一行的长图遮挡
                while current_row > start_row:
                    prev_row = current_row - 1
                    if prev_row in tall_image_cols_by_row and current_col in tall_image_cols_by_row[prev_row]:
                        # 当前位置被遮挡，跳过（往右移动）
                        current_col += 1
                    else:
                        break
                
                # 计算目标单元格地址
                target_col_letter = get_column_letter(current_col)
                target_cell = f"{target_col_letter}{current_row}"
                
                # 记录需要设置大小的行和列
                rows_to_resize.add(current_row)
                cols_to_resize.add(target_col_letter)
                
                # 如果图片超出高度，记录该列有长图（会遮挡下一行）
                if is_tall_image:
                    if current_row not in tall_image_cols_by_row:
                        tall_image_cols_by_row[current_row] = set()
                    tall_image_cols_by_row[current_row].add(current_col)
                
                # 创建图片对象
                img = Image(image_path)
                # openpyxl的Image对象使用像素单位
                img.width = display_width_px
                img.height = display_height_px
                
                # 插入图片（按选择顺序）
                sheet.add_image(img, target_cell)
                
                # 记录插入的单元格
                inserted_cells.append({
                    "cell": target_cell,
                    "row": current_row,
                    "col": current_col,
                    "image_path": image_path
                })
                
                # 记录插入图片的位置（用于判断正下方）
                inserted_row = current_row
                inserted_col = current_col
                
                # 移动到下一个位置（一直往右）
                current_col += 1
                
                # 如果刚插入的图片高度超出，跳过正下方的位置
                # 注意：由于是一直往右插入，正下方位置会在换行时处理
                # 这里不需要额外处理，因为换行时会自动检查上一行的长图
            
            # 设置插入图片的列宽（每列只设置一次）
            for col_letter in cols_to_resize:
                sheet.column_dimensions[col_letter].width = excel_col_width
            
            # 设置插入图片的行高（每行只设置一次）
            for row_num in rows_to_resize:
                sheet.row_dimensions[row_num].height = excel_row_height
            
            # 保存文件
            wb.save(output_path)
            
            return inserted_cells
        
        result = await asyncio.to_thread(_insert_batch)
        return result
    
    async def insert_row(
        self,
        input_path: str,
        output_path: str,
        row_number: int,
        sheet_name: Optional[str] = None,
        direction: str = 'before'  # 'before' 或 'after'
    ):
        """在指定行前或行后插入新行
        
        Args:
            direction: 'before' 表示在行前插入，'after' 表示在行后插入
        """
        def _insert_row():
            wb = load_workbook(input_path)
            
            if sheet_name and sheet_name in wb.sheetnames:
                sheet = wb[sheet_name]
            else:
                sheet = wb.active
            
            # 根据方向决定插入位置
            if direction == 'after':
                # 在行后插入，即在下一行前插入
                insert_row = row_number + 1
            else:
                # 在行前插入（默认）
                insert_row = row_number
            
            # 插入新行
            sheet.insert_rows(insert_row)
            
            wb.save(output_path)
        
        await asyncio.to_thread(_insert_row)
    
    async def update_cell(
        self,
        input_path: str,
        output_path: str,
        cell_address: str,
        value: str,
        sheet_name: Optional[str] = None
    ):
        """更新单元格的值"""
        def _update_cell():
            wb = load_workbook(input_path)
            
            if sheet_name and sheet_name in wb.sheetnames:
                sheet = wb[sheet_name]
            else:
                sheet = wb.active
            
            # 更新单元格值
            sheet[cell_address] = value
            
            wb.save(output_path)
        
        await asyncio.to_thread(_update_cell)

