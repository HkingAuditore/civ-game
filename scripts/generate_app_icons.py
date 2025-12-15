#!/usr/bin/env python3
"""
APP 图标生成脚本 - 从 logo.png 生成各种尺寸的 Android 图标
用法: python generate_app_icons.py
"""

import os
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("正在安装 Pillow...")
    os.system("pip install Pillow")
    from PIL import Image


def generate_icons():
    script_dir = Path(__file__).parent.parent
    logo_path = script_dir / "public" / "logo.png"
    android_res_dir = script_dir / "android" / "app" / "src" / "main" / "res"
    
    if not logo_path.exists():
        print(f"错误: 找不到 logo 文件 {logo_path}")
        return
    
    # Android 图标尺寸配置
    icon_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    
    print("正在生成 APP 图标...")
    
    # 打开原始 logo
    logo = Image.open(logo_path)
    
    # 确保是 RGBA 模式
    if logo.mode != 'RGBA':
        logo = logo.convert('RGBA')
    
    for folder, size in icon_sizes.items():
        output_dir = android_res_dir / folder
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成方形图标
        icon = logo.resize((size, size), Image.Resampling.LANCZOS)
        
        # 保存 ic_launcher.png
        output_path = output_dir / "ic_launcher.png"
        icon.save(output_path, "PNG")
        print(f"  [OK] {folder}/ic_launcher.png ({size}x{size})")
        
        # 保存 ic_launcher_round.png (圆形图标，这里简单使用同样的图)
        output_path_round = output_dir / "ic_launcher_round.png"
        icon.save(output_path_round, "PNG")
        print(f"  [OK] {folder}/ic_launcher_round.png ({size}x{size})")
        
        # 保存前景图标 (用于自适应图标)
        foreground_path = output_dir / "ic_launcher_foreground.png"
        # 前景需要更大一些以适应自适应图标的安全区域
        fg_size = int(size * 1.5)
        foreground = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
        # 居中放置
        offset = (fg_size - size) // 2
        foreground_icon = logo.resize((size, size), Image.Resampling.LANCZOS)
        foreground.paste(foreground_icon, (offset, offset))
        foreground.save(foreground_path, "PNG")
        print(f"  [OK] {folder}/ic_launcher_foreground.png ({fg_size}x{fg_size})")
    
    print("\n图标生成完成!")
    print("请重新构建 Android 项目以应用新图标。")


if __name__ == "__main__":
    generate_icons()
