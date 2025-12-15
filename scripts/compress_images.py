#!/usr/bin/env python3
"""
图片压缩脚本 - 使用 Pillow 进行高质量压缩
用法: python compress_images.py
"""

import os
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("正在安装 Pillow...")
    os.system("pip install Pillow")
    from PIL import Image


def compress_png(input_path: Path, quality: int = 85, max_size: int = 1200):
    """
    压缩 PNG 图片
    - 转换 RGBA 到 RGB（如果没有透明度）或保持 RGBA
    - 调整大图片的尺寸
    - 优化 PNG 压缩
    """
    try:
        original_size = input_path.stat().st_size
        
        # 跳过小于 50KB 的文件
        if original_size < 50 * 1024:
            print(f"  跳过 (太小): {input_path.name}")
            return 0
        
        img = Image.open(input_path)
        
        # 如果图片太大，按比例缩小
        if img.width > max_size or img.height > max_size:
            ratio = min(max_size / img.width, max_size / img.height)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # 保存优化后的图片
        if img.mode == 'RGBA':
            # 检查是否真的有透明像素
            has_transparency = any(pixel[3] < 255 for pixel in img.getdata())
            if has_transparency:
                img.save(input_path, 'PNG', optimize=True)
            else:
                # 转换为 RGB 并保存为优化的 PNG
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                rgb_img.paste(img, mask=img.split()[3])
                rgb_img.save(input_path, 'PNG', optimize=True)
        else:
            img.save(input_path, 'PNG', optimize=True)
        
        new_size = input_path.stat().st_size
        saved = original_size - new_size
        
        if saved > 0:
            percent = (saved / original_size) * 100
            print(f"  [OK] {input_path.name}: {original_size//1024}KB -> {new_size//1024}KB (sheng {percent:.1f}%)")
            return saved
        else:
            print(f"  = {input_path.name}: 已是最优")
            return 0
            
    except Exception as e:
        print(f"  [ERR] {input_path.name}: error - {e}")
        return 0


def main():
    # 项目根目录
    script_dir = Path(__file__).parent.parent
    images_dir = script_dir / "public" / "images"
    
    if not images_dir.exists():
        print(f"错误: 找不到图片目录 {images_dir}")
        return
    
    print("=" * 60)
    print("开始压缩图片...")
    print("=" * 60)
    
    total_saved = 0
    total_files = 0
    
    # 遍历所有子目录
    for subdir in ["events", "buildings", "backgrounds", "empire"]:
        dir_path = images_dir / subdir
        if not dir_path.exists():
            continue
        
        print(f"\n[{subdir}]")
        
        for img_file in dir_path.glob("*.png"):
            if ".bak" in img_file.name:
                continue
            saved = compress_png(img_file)
            total_saved += saved
            total_files += 1
    
    print("\n" + "=" * 60)
    print(f"压缩完成!")
    print(f"处理文件数: {total_files}")
    print(f"总共节省: {total_saved / 1024 / 1024:.2f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()
