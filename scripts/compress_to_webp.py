#!/usr/bin/env python3
"""
Image Compression Script - Convert PNG to WebP for much smaller file sizes
WebP format can reduce file size by 50-80% compared to PNG
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("[ERROR] Pillow not installed. Run: pip install Pillow")
    sys.exit(1)

def convert_to_webp(input_path, quality=85):
    """
    Convert PNG to WebP format with optional quality setting
    
    Args:
        input_path: Path to input PNG file
        quality: WebP quality (1-100), higher = better quality but larger file
    
    Returns:
        Tuple of (original_size, new_size, output_path) or None if failed
    """
    input_path = Path(input_path)
    output_path = input_path.with_suffix('.webp')
    
    original_size = input_path.stat().st_size
    
    try:
        with Image.open(input_path) as img:
            # Convert to RGB if necessary (WebP doesn't support all modes)
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                # Keep alpha channel for WebP
                img.save(output_path, 'WEBP', quality=quality, method=6, lossless=False)
            else:
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img.save(output_path, 'WEBP', quality=quality, method=6, lossless=False)
        
        new_size = output_path.stat().st_size
        return original_size, new_size, output_path
    except Exception as e:
        print(f"[ERROR] Failed to convert {input_path.name}: {e}")
        return None

def resize_if_too_large(img, max_dimension=1024):
    """
    Resize image if either dimension exceeds max_dimension
    """
    width, height = img.size
    if width > max_dimension or height > max_dimension:
        if width > height:
            new_width = max_dimension
            new_height = int(height * (max_dimension / width))
        else:
            new_height = max_dimension
            new_width = int(width * (max_dimension / height))
        return img.resize((new_width, new_height), Image.Resampling.LANCZOS), True
    return img, False

def compress_png_aggressive(input_path, max_dimension=1024, quality=85):
    """
    Aggressively compress PNG: resize + convert to WebP
    
    Args:
        input_path: Path to input PNG file
        max_dimension: Maximum width or height (resize if larger)
        quality: WebP quality (1-100)
    
    Returns:
        Tuple of (original_size, new_size, was_resized, output_path)
    """
    input_path = Path(input_path)
    output_path = input_path.with_suffix('.webp')
    
    original_size = input_path.stat().st_size
    
    try:
        with Image.open(input_path) as img:
            original_dims = img.size
            
            # Resize if too large
            img, was_resized = resize_if_too_large(img, max_dimension)
            
            # Convert and save as WebP
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                img.save(output_path, 'WEBP', quality=quality, method=6)
            else:
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img.save(output_path, 'WEBP', quality=quality, method=6)
        
        new_size = output_path.stat().st_size
        return original_size, new_size, was_resized, output_path, original_dims, img.size
    except Exception as e:
        print(f"[ERROR] Failed to process {input_path.name}: {e}")
        return None

def main():
    # Define paths
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    images_dir = project_dir / 'public' / 'images'
    
    print("=" * 70)
    print("   Aggressive Image Compression Script")
    print("   PNG -> WebP Conversion (50-80% smaller file sizes)")
    print("=" * 70)
    print()
    
    if not images_dir.exists():
        print(f"[ERROR] Images directory not found: {images_dir}")
        sys.exit(1)
    
    # Find all PNG files recursively
    png_files = list(images_dir.rglob('*.png'))
    
    # Exclude backup directories
    png_files = [f for f in png_files if 'backup' not in str(f).lower()]
    
    if not png_files:
        print("[INFO] No PNG files found")
        sys.exit(0)
    
    # Calculate total original size
    total_original = sum(f.stat().st_size for f in png_files)
    
    print(f"[INFO] Found {len(png_files)} PNG files")
    print(f"[INFO] Total size: {total_original / 1024 / 1024:.2f} MB")
    print()
    
    # Show largest files
    sorted_files = sorted(png_files, key=lambda f: f.stat().st_size, reverse=True)
    print("[INFO] Top 10 largest files:")
    for f in sorted_files[:10]:
        size_mb = f.stat().st_size / 1024 / 1024
        print(f"       {size_mb:.2f} MB - {f.name}")
    print()
    
    # Configuration
    print("[CONFIG] Settings:")
    print("         - Max dimension: 1024px (larger images will be resized)")
    print("         - WebP quality: 85 (good balance of quality/size)")
    print("         - Original PNG files will be DELETED after conversion")
    print()
    
    confirm = input("Continue with compression? (Y/N): ").strip().upper()
    if confirm != 'Y':
        print("[CANCELLED]")
        sys.exit(0)
    
    print()
    print("=" * 70)
    print("   Processing...")
    print("=" * 70)
    print()
    
    total_saved = 0
    converted_count = 0
    
    for png_file in sorted_files:
        rel_path = png_file.relative_to(images_dir)
        print(f"[PROCESS] {rel_path}...", end=" ", flush=True)
        
        result = compress_png_aggressive(png_file, max_dimension=1024, quality=85)
        
        if result:
            original_size, new_size, was_resized, output_path, orig_dims, new_dims = result
            saved = original_size - new_size
            total_saved += saved
            percent = (saved / original_size) * 100 if original_size > 0 else 0
            
            resize_info = f" (resized {orig_dims[0]}x{orig_dims[1]} -> {new_dims[0]}x{new_dims[1]})" if was_resized else ""
            print(f"OK {original_size/1024:.0f}KB -> {new_size/1024:.0f}KB (-{percent:.0f}%){resize_info}")
            
            # Delete original PNG file
            png_file.unlink()
            converted_count += 1
        else:
            print("FAILED")
    
    # Results
    print()
    print("=" * 70)
    print("   Results")
    print("=" * 70)
    print()
    
    total_new = total_original - total_saved
    percent_saved = (total_saved / total_original) * 100 if total_original > 0 else 0
    
    print(f"[RESULT] Files converted: {converted_count}")
    print(f"[RESULT] Original size:   {total_original / 1024 / 1024:.2f} MB")
    print(f"[RESULT] New size:        {total_new / 1024 / 1024:.2f} MB")
    print(f"[RESULT] Space saved:     {total_saved / 1024 / 1024:.2f} MB ({percent_saved:.1f}%)")
    print()
    
    print("[IMPORTANT] You now need to update your code to use .webp instead of .png!")
    print("[IMPORTANT] Run 'npm run build && npx cap sync android' to update the APK.")
    print()
    input("Press Enter to exit...")

if __name__ == '__main__':
    main()
