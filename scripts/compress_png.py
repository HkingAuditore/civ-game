#!/usr/bin/env python3
"""
PNG Image Compression Script - Resize large images and optimize
No format change needed, just resize oversized images
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("[ERROR] Pillow not installed. Run: pip install Pillow")
    sys.exit(1)

def compress_png(input_path, max_dimension=1024):
    """
    Compress PNG by resizing if too large and optimizing
    
    Args:
        input_path: Path to input PNG file
        max_dimension: Maximum width or height
    
    Returns:
        Tuple of (original_size, new_size, was_resized)
    """
    input_path = Path(input_path)
    original_size = input_path.stat().st_size
    
    try:
        with Image.open(input_path) as img:
            original_dims = img.size
            width, height = img.size
            was_resized = False
            
            # Resize if too large
            if width > max_dimension or height > max_dimension:
                if width > height:
                    new_width = max_dimension
                    new_height = int(height * (max_dimension / width))
                else:
                    new_height = max_dimension
                    new_width = int(width * (max_dimension / height))
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                was_resized = True
            
            # Convert to RGB if fully opaque RGBA (reduces size)
            if img.mode == 'RGBA':
                alpha = img.split()[-1]
                if alpha.getextrema() == (255, 255):
                    img = img.convert('RGB')
            
            # Save with maximum compression
            temp_path = str(input_path) + '.tmp'
            img.save(temp_path, 'PNG', optimize=True, compress_level=9)
            
            new_size = os.path.getsize(temp_path)
            
            # Replace original if smaller or was resized
            if new_size < original_size or was_resized:
                os.replace(temp_path, input_path)
                final_size = new_size
            else:
                os.remove(temp_path)
                final_size = original_size
            
            return original_size, final_size, was_resized, original_dims, img.size
    except Exception as e:
        print(f"[ERROR] Failed to process {input_path.name}: {e}")
        return None

def main():
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    images_dir = project_dir / 'public' / 'images'
    
    print("=" * 70)
    print("   PNG Compression Script")
    print("   Resize large images + optimize (keeps .png format)")
    print("=" * 70)
    print()
    
    if not images_dir.exists():
        print(f"[ERROR] Images directory not found: {images_dir}")
        sys.exit(1)
    
    # Find all PNG files recursively
    png_files = list(images_dir.rglob('*.png'))
    png_files = [f for f in png_files if 'backup' not in str(f).lower()]
    
    if not png_files:
        print("[INFO] No PNG files found")
        sys.exit(0)
    
    total_original = sum(f.stat().st_size for f in png_files)
    
    print(f"[INFO] Found {len(png_files)} PNG files")
    print(f"[INFO] Total size: {total_original / 1024 / 1024:.2f} MB")
    print()
    
    # Show largest files
    sorted_files = sorted(png_files, key=lambda f: f.stat().st_size, reverse=True)
    print("[INFO] Top 10 largest files:")
    for f in sorted_files[:10]:
        size_mb = f.stat().st_size / 1024 / 1024
        with Image.open(f) as img:
            dims = img.size
        print(f"       {size_mb:.2f} MB ({dims[0]}x{dims[1]}) - {f.name}")
    print()
    
    print("[CONFIG] Settings:")
    print("         - Max dimension: 1024px (larger images will be resized)")
    print("         - Format: PNG (no change)")
    print()
    
    confirm = input("Continue? (Y/N): ").strip().upper()
    if confirm != 'Y':
        print("[CANCELLED]")
        sys.exit(0)
    
    print()
    print("=" * 70)
    print("   Processing...")
    print("=" * 70)
    print()
    
    total_saved = 0
    processed = 0
    
    for png_file in sorted_files:
        rel_path = png_file.relative_to(images_dir)
        print(f"[PROCESS] {rel_path}...", end=" ", flush=True)
        
        result = compress_png(png_file, max_dimension=1024)
        
        if result:
            original_size, new_size, was_resized, orig_dims, new_dims = result
            saved = original_size - new_size
            total_saved += saved
            percent = (saved / original_size) * 100 if original_size > 0 else 0
            
            if was_resized:
                print(f"OK {original_size/1024:.0f}KB -> {new_size/1024:.0f}KB (-{percent:.0f}%) [resized {orig_dims[0]}x{orig_dims[1]} -> {new_dims[0]}x{new_dims[1]}]")
            elif saved > 0:
                print(f"OK {original_size/1024:.0f}KB -> {new_size/1024:.0f}KB (-{percent:.0f}%)")
            else:
                print("OK Already optimal")
            processed += 1
        else:
            print("FAILED")
    
    print()
    print("=" * 70)
    print("   Results")
    print("=" * 70)
    print()
    
    total_new = total_original - total_saved
    percent_saved = (total_saved / total_original) * 100 if total_original > 0 else 0
    
    print(f"[RESULT] Files processed: {processed}")
    print(f"[RESULT] Original size:   {total_original / 1024 / 1024:.2f} MB")
    print(f"[RESULT] New size:        {total_new / 1024 / 1024:.2f} MB")
    print(f"[RESULT] Space saved:     {total_saved / 1024 / 1024:.2f} MB ({percent_saved:.1f}%)")
    print()
    print("[NEXT] Run these commands to update the APK:")
    print("       npm run build")
    print("       npx cap sync android")
    print()
    input("Press Enter to exit...")

if __name__ == '__main__':
    main()
