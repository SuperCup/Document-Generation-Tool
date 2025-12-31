from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from typing import List, Dict, Optional
import asyncio
from pathlib import Path


class PPTService:
    """PPT文件处理服务"""
    
    async def parse_file(self, file_path: str) -> Dict:
        """解析PPT文件，返回基本信息"""
        def _parse():
            prs = Presentation(file_path)
            pages = []
            
            for i, slide in enumerate(prs.slides):
                title = ""
                # 尝试获取标题
                if slide.shapes.title:
                    title = slide.shapes.title.text
                elif len(slide.shapes) > 0:
                    # 如果没有标题占位符，尝试获取第一个文本框
                    for shape in slide.shapes:
                        if hasattr(shape, "text") and shape.text:
                            title = shape.text[:50]  # 限制长度
                            break
                
                pages.append({
                    "index": i,
                    "title": title or f"页面 {i + 1}",
                    "shapes_count": len(slide.shapes)
                })
            
            return {
                "type": "ppt",
                "total_pages": len(prs.slides),
                "pages": pages
            }
        
        return await asyncio.to_thread(_parse)
    
    async def get_pages(self, file_path: str) -> List[Dict]:
        """获取所有页面信息"""
        def _get_pages():
            prs = Presentation(file_path)
            pages = []
            
            for i, slide in enumerate(prs.slides):
                title = ""
                if slide.shapes.title:
                    title = slide.shapes.title.text
                
                pages.append({
                    "index": i,
                    "title": title or f"页面 {i + 1}",
                    "shapes_count": len(slide.shapes)
                })
            
            return pages
        
        return await asyncio.to_thread(_get_pages)
    
    async def insert_page(
        self,
        input_path: str,
        output_path: str,
        after_page: int,
        title: str,
        image_paths: List[str],
        layout: str = "single"
    ):
        """在指定页面后插入新页面"""
        def _insert():
            prs = Presentation(input_path)
            
            # 创建新幻灯片
            # 使用标题和内容布局
            blank_slide_layout = prs.slide_layouts[6]  # 空白布局
            new_slide = prs.slides.add_slide(blank_slide_layout)
            
            # 添加标题
            if title:
                title_shape = new_slide.shapes.add_textbox(
                    Inches(0.5), Inches(0.5), Inches(9), Inches(0.8)
                )
                title_frame = title_shape.text_frame
                title_frame.text = title
                title_paragraph = title_frame.paragraphs[0]
                title_paragraph.font.size = Pt(24)
                title_paragraph.font.bold = True
            
            # 插入图片
            if layout == "single":
                # 单图布局：图片居中（只显示第一张）
                if image_paths and Path(image_paths[0]).exists():
                    left = Inches(1)
                    top = Inches(2) if title else Inches(1)
                    width = Inches(8)
                    height = Inches(5)
                    new_slide.shapes.add_picture(image_paths[0], left, top, width, height)
            
            elif layout == "grid":
                # 网格布局：多图排列
                cols = 2
                rows = (len(image_paths) + cols - 1) // cols
                img_width = Inches(4)
                img_height = Inches(3)
                
                for i, img_path in enumerate(image_paths):
                    if Path(img_path).exists():
                        col = i % cols
                        row = i // cols
                        left = Inches(0.5) + col * (img_width + Inches(0.5))
                        top = Inches(2) + row * (img_height + Inches(0.5)) if title else Inches(1) + row * (img_height + Inches(0.5))
                        new_slide.shapes.add_picture(img_path, left, top, img_width, img_height)
            
            elif layout == "horizontal":
                # 水平布局：图片横向排列
                img_width = Inches(8 / len(image_paths)) if image_paths else Inches(4)
                img_height = Inches(4)
                
                for i, img_path in enumerate(image_paths):
                    if Path(img_path).exists():
                        left = Inches(0.5) + i * (img_width + Inches(0.2))
                        top = Inches(2) if title else Inches(1)
                        new_slide.shapes.add_picture(img_path, left, top, img_width, img_height)
            
            elif layout == "vertical":
                # 垂直布局：图片纵向排列
                img_width = Inches(6)
                img_height = Inches(4 / len(image_paths)) if image_paths else Inches(2)
                
                for i, img_path in enumerate(image_paths):
                    if Path(img_path).exists():
                        left = Inches(2)
                        top = (Inches(2) if title else Inches(1)) + i * (img_height + Inches(0.2))
                        new_slide.shapes.add_picture(img_path, left, top, img_width, img_height)
            
            # 将新幻灯片移动到指定位置
            # python-pptx中，新幻灯片默认添加到最后
            # 我们需要将其移动到正确位置
            slides_list = list(prs.slides._sldIdLst)
            new_slide_id = new_slide._element
            
            # 移除新幻灯片
            slides_list.remove(new_slide_id)
            
            # 在指定位置后插入
            insert_position = min(after_page + 1, len(slides_list))
            slides_list.insert(insert_position, new_slide_id)
            
            # 重新排序
            prs.slides._sldIdLst.clear()
            for slide_id in slides_list:
                prs.slides._sldIdLst.append(slide_id)
            
            # 保存文件
            prs.save(output_path)
        
        await asyncio.to_thread(_insert)

