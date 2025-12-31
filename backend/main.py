from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from typing import List, Optional
import os
import sys
import uuid
from pathlib import Path
import json
import httpx
import tempfile
import logging

from services.ppt_service import PPTService
from services.excel_service import ExcelService

app = FastAPI(title="文档生成工具 API")

# 配置CORS
# 从环境变量读取允许的源，默认允许所有（开发环境）
# 生产环境建议设置环境变量：ALLOWED_ORIGINS=http://your-domain.com,https://your-domain.com
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
if allowed_origins_env == "*":
    # 允许所有来源（开发环境）
    origins = ["*"]
    allow_creds = False  # 使用["*"]时不能设置allow_credentials=True
else:
    # 限制特定来源（生产环境）
    origins = [origin.strip() for origin in allowed_origins_env.split(",")]
    allow_creds = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建必要的目录
# 使用绝对路径，确保在backend目录下运行
def get_base_dir():
    """获取后端基础目录"""
    if getattr(sys, 'frozen', False):
        # 打包后的exe环境
        # PyInstaller会在临时目录中运行，需要找到实际的数据目录
        exe_dir = Path(sys.executable).parent
        # 尝试找到backend目录
        backend_dir = exe_dir / "backend"
        if backend_dir.exists():
            return backend_dir
        # 如果不存在，使用exe所在目录
        return exe_dir
    else:
        # 开发环境
        return Path(__file__).parent

BASE_DIR = get_base_dir()
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

ppt_service = PPTService()
excel_service = ExcelService()

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def safe_delete_image(image_path: str) -> bool:
    """安全删除图片文件"""
    try:
        if not image_path:
            return False
            
        # 确保路径在UPLOAD_DIR下，防止路径遍历攻击
        path = Path(image_path)
        
        # 如果是绝对路径，确保在UPLOAD_DIR下
        if path.is_absolute():
            try:
                # 检查路径是否在UPLOAD_DIR下
                path.relative_to(UPLOAD_DIR)
            except ValueError:
                logger.warning(f"尝试删除不在UPLOAD_DIR下的文件: {image_path}")
                return False
        else:
            # 如果是相对路径，转换为绝对路径（只取文件名，防止路径遍历）
            path = UPLOAD_DIR / path.name
        
        # 只删除图片文件
        if path.exists() and path.is_file():
            # 检查是否是图片文件（通过文件名前缀或扩展名）
            # 允许删除：images_开头的、remote_开头的、或者有图片扩展名的文件
            is_image_file = (
                path.name.startswith(('images_', 'remote_')) or 
                path.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
            )
            
            if is_image_file:
                path.unlink()
                logger.info(f"已删除临时图片: {path}")
                return True
            else:
                logger.warning(f"文件不是临时图片格式，跳过删除: {path}")
                return False
        else:
            logger.debug(f"图片文件不存在或不是文件: {path}")
            return False
    except Exception as e:
        logger.error(f"删除图片文件失败 {image_path}: {str(e)}")
        return False


def delete_images_after_insertion(image_paths) -> None:
    """插入完成后删除图片文件"""
    if isinstance(image_paths, str):
        # 如果是JSON字符串，先解析
        try:
            image_paths = json.loads(image_paths)
        except:
            image_paths = [image_paths]
    elif not isinstance(image_paths, list):
        image_paths = [image_paths]
    
    for image_path in image_paths:
        if image_path:
            safe_delete_image(image_path)


def safe_delete_output_file(file_path: str) -> None:
    """安全删除输出文件（后台任务）"""
    import time
    
    # 等待一小段时间，确保文件传输完成
    time.sleep(1)
    
    try:
        if not file_path:
            return
            
        path = Path(file_path)
        
        # 确保路径在OUTPUT_DIR下，防止路径遍历攻击
        if path.is_absolute():
            try:
                # 检查路径是否在OUTPUT_DIR下
                path.relative_to(OUTPUT_DIR)
            except ValueError:
                logger.warning(f"尝试删除不在OUTPUT_DIR下的文件: {file_path}")
                return
        else:
            # 如果是相对路径，转换为绝对路径（只取文件名，防止路径遍历）
            path = OUTPUT_DIR / path.name
        
        # 只删除输出文件
        if path.exists() and path.is_file():
            # 检查是否是输出文件（以_modified.结尾）
            if path.name.endswith('_modified.pptx') or path.name.endswith('_modified.ppt') or \
               path.name.endswith('_modified.xlsx') or path.name.endswith('_modified.xls'):
                path.unlink()
                logger.info(f"已删除输出文件: {path}")
            else:
                logger.warning(f"文件不是输出文件格式，跳过删除: {path}")
        else:
            logger.debug(f"输出文件不存在或不是文件: {path}")
    except Exception as e:
        logger.error(f"删除输出文件失败 {file_path}: {str(e)}")


def safe_delete_uploaded_file(file_id: str) -> None:
    """安全删除原始上传的文件（后台任务）"""
    import time
    
    # 等待一小段时间，确保文件传输完成
    time.sleep(1)
    
    try:
        if not file_id:
            return
        
        # 尝试删除可能的文件扩展名
        extensions = ['.pptx', '.ppt', '.xlsx', '.xls']
        deleted_count = 0
        
        for ext in extensions:
            file_path = UPLOAD_DIR / f"{file_id}{ext}"
            if file_path.exists() and file_path.is_file():
                try:
                    # 确保文件在UPLOAD_DIR下
                    file_path.relative_to(UPLOAD_DIR)
                    file_path.unlink()
                    logger.info(f"已删除原始上传文件: {file_path}")
                    deleted_count += 1
                except ValueError:
                    logger.warning(f"尝试删除不在UPLOAD_DIR下的文件: {file_path}")
                except Exception as e:
                    logger.error(f"删除原始上传文件失败 {file_path}: {str(e)}")
        
        if deleted_count == 0:
            logger.debug(f"未找到原始上传文件: file_id={file_id}")
    except Exception as e:
        logger.error(f"删除原始上传文件失败 file_id={file_id}: {str(e)}")


@app.get("/")
async def root():
    return {"message": "文档生成工具 API"}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传文件并返回文件信息"""
    try:
        # 检查文件类型
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ['.pptx', '.ppt', '.xlsx', '.xls']:
            raise HTTPException(status_code=400, detail="不支持的文件类型，仅支持PPT和Excel文件")
        
        # 保存文件
        file_id = str(uuid.uuid4())
        file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
        
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # 解析文件
        if file_ext in ['.pptx', '.ppt']:
            file_info = await ppt_service.parse_file(str(file_path))
        else:
            file_info = await excel_service.parse_file(str(file_path))
        
        file_info['file_id'] = file_id
        file_info['file_path'] = str(file_path)
        file_info['file_name'] = file.filename
        
        return file_info
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")


@app.get("/api/ppt/pages/{file_id}")
async def get_ppt_pages(file_id: str):
    """获取PPT的所有页面信息"""
    try:
        file_path = UPLOAD_DIR / f"{file_id}.pptx"
        if not file_path.exists():
            file_path = UPLOAD_DIR / f"{file_id}.ppt"
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        pages = await ppt_service.get_pages(str(file_path))
        return {"pages": pages}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取页面信息失败: {str(e)}")


@app.post("/api/upload-images")
async def upload_images(files: List[UploadFile] = File(...)):
    """上传图片文件"""
    try:
        image_paths = []
        for file in files:
            # 检查文件类型
            if not file.content_type or not file.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail=f"文件 {file.filename} 不是图片格式")
            
            # 保存图片
            image_id = str(uuid.uuid4())
            file_ext = Path(file.filename).suffix or '.jpg'
            image_path = UPLOAD_DIR / f"images_{image_id}{file_ext}"
            
            with open(image_path, "wb") as f:
                content = await file.read()
                f.write(content)
            
            image_paths.append(str(image_path))
        
        return {"success": True, "image_paths": image_paths}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片上传失败: {str(e)}")


@app.post("/api/ppt/insert-page")
async def insert_ppt_page(
    file_id: str = Form(...),
    after_page: int = Form(...),
    title: str = Form(...),
    images: str = Form(...),  # JSON字符串
    layout: str = Form("single")
):
    """在PPT中插入新页面"""
    try:
        file_path = UPLOAD_DIR / f"{file_id}.pptx"
        if not file_path.exists():
            file_path = UPLOAD_DIR / f"{file_id}.ppt"
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        # 解析图片路径列表
        image_paths = json.loads(images) if isinstance(images, str) else images
        
        output_path = OUTPUT_DIR / f"{file_id}_modified.pptx"
        await ppt_service.insert_page(
            str(file_path),
            str(output_path),
            after_page,
            title,
            image_paths,
            layout
        )
        
        # 插入成功后删除临时图片文件
        delete_images_after_insertion(image_paths)
        
        return {"success": True, "output_file": str(output_path)}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"插入页面失败: {str(e)}")


@app.get("/api/excel/cells/{file_id}")
async def get_excel_cells(file_id: str):
    """获取Excel的单元格信息"""
    try:
        # 优先使用已修改的文件
        file_path = OUTPUT_DIR / f"{file_id}_modified.xlsx"
        if not file_path.exists():
            file_path = UPLOAD_DIR / f"{file_id}.xlsx"
            if not file_path.exists():
                file_path = UPLOAD_DIR / f"{file_id}.xls"
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        cells = await excel_service.get_cells(str(file_path))
        return {"cells": cells}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取单元格信息失败: {str(e)}")


@app.post("/api/excel/insert-image")
async def insert_excel_image(
    file_id: str = Form(...),
    cell: str = Form(...),
    image_path: str = Form(...),
    sheet_name: Optional[str] = Form(None)
):
    """在Excel中插入图片（单张）"""
    try:
        file_path = UPLOAD_DIR / f"{file_id}.xlsx"
        if not file_path.exists():
            file_path = UPLOAD_DIR / f"{file_id}.xls"
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        output_path = OUTPUT_DIR / f"{file_id}_modified.xlsx"
        await excel_service.insert_image(
            str(file_path),
            str(output_path),
            cell,
            image_path,
            sheet_name
        )
        
        # 插入成功后删除临时图片文件
        delete_images_after_insertion(image_path)
        
        return {"success": True, "output_file": str(output_path)}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"插入图片失败: {str(e)}")


@app.post("/api/excel/insert-images-batch")
async def insert_excel_images_batch(
    file_id: str = Form(...),
    start_cell: str = Form(...),
    images: str = Form(...),  # JSON字符串
    sheet_name: Optional[str] = Form(None),
    cell_width_cm: float = Form(5.0),
    cell_height_cm: float = Form(4.0)
):
    """批量插入图片到Excel（支持多次插入）"""
    try:
        # 优先使用已修改的文件（支持多次插入）
        output_path = OUTPUT_DIR / f"{file_id}_modified.xlsx"
        if output_path.exists():
            input_path = output_path
        else:
            # 如果没有修改过的文件，使用原始文件
            input_path = UPLOAD_DIR / f"{file_id}.xlsx"
            if not input_path.exists():
                input_path = UPLOAD_DIR / f"{file_id}.xls"
        
        if not input_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        # 解析图片路径列表
        image_paths = json.loads(images) if isinstance(images, str) else images
        
        # 插入图片（输入和输出使用同一个文件，实现多次插入）
        inserted_cells = await excel_service.insert_images_batch(
            str(input_path),
            str(output_path),
            start_cell,
            image_paths,
            sheet_name,
            cell_width_cm,
            cell_height_cm
        )
        
        # 构建单元格图片映射（单元格地址 -> 图片路径）
        cell_images = {}
        for cell_info in inserted_cells:
            cell_images[cell_info["cell"]] = cell_info["image_path"]
        
        # 插入成功后删除临时图片文件
        delete_images_after_insertion(image_paths)
        
        return {
            "success": True,
            "output_file": str(output_path),
            "inserted_cells": inserted_cells,
            "cell_images": cell_images
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量插入图片失败: {str(e)}")


@app.post("/api/excel/insert-row")
async def insert_excel_row(
    file_id: str = Form(...),
    row_number: int = Form(...),
    sheet_name: Optional[str] = Form(None),
    direction: str = Form('before')  # 'before' 或 'after'
):
    """在Excel中插入新行（支持向上或向下插入）"""
    try:
        # 优先使用已修改的文件
        input_path = OUTPUT_DIR / f"{file_id}_modified.xlsx"
        if not input_path.exists():
            input_path = UPLOAD_DIR / f"{file_id}.xlsx"
            if not input_path.exists():
                input_path = UPLOAD_DIR / f"{file_id}.xls"
        
        if not input_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        output_path = OUTPUT_DIR / f"{file_id}_modified.xlsx"
        await excel_service.insert_row(
            str(input_path),
            str(output_path),
            row_number,
            sheet_name,
            direction
        )
        
        return {"success": True}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"插入行失败: {str(e)}")


@app.post("/api/excel/update-cell")
async def update_excel_cell(
    file_id: str = Form(...),
    cell_address: str = Form(...),
    value: str = Form(...),
    sheet_name: Optional[str] = Form(None)
):
    """更新Excel单元格的值"""
    try:
        # 优先使用已修改的文件
        input_path = OUTPUT_DIR / f"{file_id}_modified.xlsx"
        if not input_path.exists():
            input_path = UPLOAD_DIR / f"{file_id}.xlsx"
            if not input_path.exists():
                input_path = UPLOAD_DIR / f"{file_id}.xls"
        
        if not input_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        output_path = OUTPUT_DIR / f"{file_id}_modified.xlsx"
        await excel_service.update_cell(
            str(input_path),
            str(output_path),
            cell_address,
            value,
            sheet_name
        )
        
        return {"success": True}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新单元格失败: {str(e)}")


@app.get("/api/image/{image_path:path}")
async def get_image(image_path: str):
    """获取上传的图片文件"""
    try:
        # 安全处理：只允许访问uploads目录下的图片
        file_path = UPLOAD_DIR / Path(image_path).name
        if not file_path.exists() or not str(file_path).startswith(str(UPLOAD_DIR)):
            raise HTTPException(status_code=404, detail="图片不存在")
        
        return FileResponse(
            path=str(file_path),
            media_type='image/jpeg'
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取图片失败: {str(e)}")


@app.get("/api/download/{file_id}")
async def download_file(file_id: str, background_tasks: BackgroundTasks):
    """下载生成的文件（下载后自动删除导出文件和原始上传文件）"""
    try:
        # 查找输出文件
        output_files = list(OUTPUT_DIR.glob(f"{file_id}_modified.*"))
        if not output_files:
            raise HTTPException(status_code=404, detail="文件不存在")
        
        file_path = output_files[0]
        file_path_str = str(file_path)
        
        # 在后台任务中删除文件（下载完成后）
        # 1. 删除导出文件
        background_tasks.add_task(safe_delete_output_file, file_path_str)
        # 2. 删除原始上传文件
        background_tasks.add_task(safe_delete_uploaded_file, file_id)
        
        return FileResponse(
            path=file_path_str,
            filename=file_path.name,
            media_type='application/octet-stream'
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载文件失败: {str(e)}")


# ==================== 远程文件服务代理接口 ====================

REMOTE_FILE_SERVICE_URL = "https://op.ismartgo.cn/docsv/docset/list"
REMOTE_FILE_DOWNLOAD_URL = "https://op.ismartgo.cn/docsv/docset/download"


@app.post("/api/remote/files")
async def get_remote_files(
    tk: str = Form(...),
    folderid: int = Form(0)
):
    """获取远程文件列表（代理接口）"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                REMOTE_FILE_SERVICE_URL,
                data={"tk": tk, "folderid": folderid},
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": "https://op.ismartgo.cn",
                    "Referer": f"https://op.ismartgo.cn/docsv/docset.html?tk={tk}",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                }
            )
            
            if response.status_code != 200:
                logger.error(f"远程服务HTTP错误: {response.status_code}, 响应: {response.text[:200]}")
                raise HTTPException(status_code=response.status_code, detail="远程服务请求失败")
            
            result = response.json()
            logger.info(f"远程API响应: errcode={result.get('errcode')}, errmsg={result.get('errmsg', '')}")
            
            # 检查远程API返回的错误码
            errcode = result.get("errcode")
            if errcode is not None and errcode != 0:
                error_msg = result.get("errmsg", "未知错误")
                logger.warning(f"远程API返回错误: errcode={errcode}, errmsg={error_msg}")
                
                # 根据不同的错误提供更友好的提示
                error_msg_lower = error_msg.lower()
                if any(keyword in error_msg for keyword in ["过期", "已过期", "expired", "expire"]):
                    raise HTTPException(status_code=400, detail="访问链接已过期，请获取新的访问令牌")
                elif any(keyword in error_msg_lower for keyword in ["无效", "invalid", "不存在", "not found"]):
                    raise HTTPException(status_code=400, detail="访问令牌无效，请检查令牌是否正确")
                elif any(keyword in error_msg for keyword in ["权限", "permission", "denied", "forbidden"]):
                    raise HTTPException(status_code=403, detail="没有访问权限，请检查令牌权限")
                else:
                    # 直接返回原始错误信息，让用户看到具体问题
                    raise HTTPException(status_code=400, detail=f"远程服务错误: {error_msg}")
            
            # 成功返回
            logger.info(f"成功获取文件列表: folderid={folderid}, folders={len(result.get('result', {}).get('folders', []))}, files={len(result.get('result', {}).get('files', []))}")
            return result
    
    except httpx.TimeoutException:
        logger.error("请求超时")
        raise HTTPException(status_code=504, detail="请求超时，请检查网络连接")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取远程文件列表异常: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取远程文件列表失败: {str(e)}")


@app.post("/api/remote/get-image-preview")
async def get_image_preview(
    tk: str = Form(...),
    fileid: int = Form(...)
):
    """获取远程图片预览URL（代理接口）"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                REMOTE_FILE_DOWNLOAD_URL,
                data={"tk": tk, "fileid": fileid},
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": "https://op.ismartgo.cn",
                    "Referer": f"https://op.ismartgo.cn/docsv/docset.html?tk={tk}",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                }
            )
            
            if response.status_code != 200:
                logger.error(f"获取图片预览失败: {response.status_code}, 响应: {response.text[:200]}")
                raise HTTPException(status_code=response.status_code, detail="获取图片预览失败")
            
            result = response.json()
            logger.info(f"图片预览响应: errcode={result.get('errcode')}, fileid={fileid}")
            
            # 检查远程API返回的错误码
            errcode = result.get("errcode")
            if errcode is not None and errcode != 0:
                error_msg = result.get("errmsg", "未知错误")
                raise HTTPException(status_code=400, detail=f"获取图片预览失败: {error_msg}")
            
            preview_url = result.get("result", "")
            if not preview_url:
                raise HTTPException(status_code=404, detail="未找到图片预览URL")
            
            return {
                "success": True,
                "preview_url": preview_url
            }
    
    except httpx.TimeoutException:
        logger.error("获取图片预览超时")
        raise HTTPException(status_code=504, detail="请求超时，请检查网络连接")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取图片预览异常: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取图片预览失败: {str(e)}")


@app.post("/api/remote/download-image")
async def download_remote_image(
    tk: str = Form(...),
    file_url: str = Form(...)
):
    """下载远程图片并保存到本地（代理接口）"""
    try:
        # 构建完整的下载URL
        if not file_url.startswith("http"):
            download_url = f"https://op.ismartgo.cn{file_url}"
        else:
            download_url = file_url
        
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            response = await client.get(
                download_url,
                headers={
                    "Accept": "image/*,*/*",
                    "Referer": f"https://op.ismartgo.cn/docsv/docset.html?tk={tk}"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="图片下载失败")
            
            # 从URL或Content-Type判断文件扩展名
            content_type = response.headers.get("content-type", "image/jpeg")
            ext = ".jpg"
            if "png" in content_type:
                ext = ".png"
            elif "gif" in content_type:
                ext = ".gif"
            elif "webp" in content_type:
                ext = ".webp"
            
            # 保存图片到本地
            image_id = str(uuid.uuid4())
            image_path = UPLOAD_DIR / f"remote_{image_id}{ext}"
            
            with open(image_path, "wb") as f:
                f.write(response.content)
            
            return {
                "success": True,
                "image_path": str(image_path),
                "file_name": f"remote_{image_id}{ext}"
            }
    
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="图片下载超时")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载远程图片失败: {str(e)}")

