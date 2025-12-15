#!/usr/bin/env python3
"""
Advanced Image Compression Script
- Detects actual file format (not just extension)
- Uses pngquant for real PNG files
- Uses Pillow for JPEG files (with mozjpeg-style compression)
"""

import os
import subprocess
import shutil
from pathlib import Path
from PIL import Image
import sys

def get_actual_format(filepath):
    """Detect actual image format by reading file header"""
    with open(filepath, 'rb') as f:
        header = f.read(8)
    
    # PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if header[:8] == b'\x89PNG\r\n\x1a\n':
        return 'PNG'
    # JPEG signature: FF D8 FF
    elif header[:3] == b'\xff\xd8\xff':
        return 'JPEG'
    # WebP signature: RIFF....WEBP
    elif header[:4] == b'RIFF' and header[8:12] == b'WEBP':
        return 'WEBP'
    else:
        return 'UNKNOWN'

def compress_png_with_pngquant(filepath, quality_min=75, quality_max=100):
    """Compress PNG using pngquant for significant size reduction"""
    original_size = os.path.getsize(filepath)
    
    # Create temp output file
    temp_path = str(filepath) + '.tmp.png'
    
    try:
        # Run pngquant with high quality settings
        # --quality 75-100: Allow lossy compression for big gains while maintaining quality
        # --speed 1: Slowest but best compression
        # --strip: Remove metadata
        result = subprocess.run([
            'pngquant',
            '--quality', f'{quality_min}-{quality_max}',
            '--speed', '1',
            '--strip',
            '--force',
            '--output', temp_path,
            str(filepath)
        ], capture_output=True, text=True)
        
        if result.returncode == 0 and os.path.exists(temp_path):
            new_size = os.path.getsize(temp_path)
            if new_size < original_size:
                shutil.move(temp_path, filepath)
                return original_size, new_size
            else:
                os.remove(temp_path)
                return original_size, original_size
        else:
            # pngquant failed or quality couldn't be achieved
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return original_size, original_size
            
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        print(f"    [WARN] pngquant error: {e}")
        return original_size, original_size

def compress_jpeg_with_pillow(filepath, quality=85):
    """Compress JPEG using Pillow"""
    original_size = os.path.getsize(filepath)
    temp_path = str(filepath) + '.tmp.jpg'
    
    try:
        img = Image.open(filepath)
        
        # Convert to RGB if necessary (remove alpha channel for JPEG)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Save with optimized compression
        img.save(
            temp_path,
            'JPEG',
            quality=quality,
            optimize=True,
            progressive=True
        )
        img.close()
        
        new_size = os.path.getsize(temp_path)
        
        if new_size < original_size:
            shutil.move(temp_path, filepath)
            return original_size, new_size
        else:
            os.remove(temp_path)
            return original_size, original_size
            
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        print(f"    [WARN] JPEG compression error: {e}")
        return original_size, original_size

def main():
    # Define paths
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    images_dir = project_dir / 'public' / 'images' / 'events'
    backup_dir = images_dir / 'backup_original'
    
    print("=" * 70)
    print("   Advanced Image Compression (pngquant + JPEG optimization)")
    print("=" * 70)
    print()
    
    # Check pngquant availability
    try:
        result = subprocess.run(['pngquant', '--version'], capture_output=True)
        pngquant_available = result.returncode == 0
        print("[OK] pngquant is available")
    except:
        pngquant_available = False
        print("[WARN] pngquant not found - will use Pillow for PNG")
    
    print()
    
    # Get all image files (excluding backup directory)
    image_files = []
    for ext in ['*.png', '*.jpg', '*.jpeg']:
        for f in images_dir.glob(ext):
            if 'backup' not in str(f):
                image_files.append(f)
    
    if not image_files:
        print("[INFO] No image files found")
        sys.exit(0)
    
    # Analyze files
    print(f"[INFO] Found {len(image_files)} files to analyze")
    print()
    
    file_info = []
    for f in image_files:
        actual_format = get_actual_format(f)
        size = os.path.getsize(f)
        file_info.append({
            'path': f,
            'name': f.name,
            'extension': f.suffix.lower(),
            'actual_format': actual_format,
            'size': size
        })
    
    # Group by format
    png_files = [f for f in file_info if f['actual_format'] == 'PNG']
    jpeg_files = [f for f in file_info if f['actual_format'] == 'JPEG']
    other_files = [f for f in file_info if f['actual_format'] not in ['PNG', 'JPEG']]
    
    print(f"[INFO] File analysis:")
    print(f"       - Real PNG files: {len(png_files)} ({sum(f['size'] for f in png_files) / 1024 / 1024:.2f} MB)")
    print(f"       - Real JPEG files: {len(jpeg_files)} ({sum(f['size'] for f in jpeg_files) / 1024 / 1024:.2f} MB)")
    if other_files:
        print(f"       - Other formats: {len(other_files)}")
    
    # Show mislabeled files
    mislabeled = [f for f in file_info if 
                  (f['extension'] == '.png' and f['actual_format'] == 'JPEG') or
                  (f['extension'] in ['.jpg', '.jpeg'] and f['actual_format'] == 'PNG')]
    
    if mislabeled:
        print()
        print(f"[INFO] Found {len(mislabeled)} mislabeled files (extension doesn't match content):")
        for f in mislabeled[:5]:
            print(f"       - {f['name']}: extension={f['extension']}, actual={f['actual_format']}")
        if len(mislabeled) > 5:
            print(f"       ... and {len(mislabeled) - 5} more")
    
    print()
    total_original = sum(f['size'] for f in file_info)
    print(f"[INFO] Total size before compression: {total_original / 1024 / 1024:.2f} MB")
    print()
    
    # Ask to proceed
    proceed = input("Proceed with compression? (Y/N): ").strip().upper()
    if proceed != 'Y':
        print("Cancelled.")
        sys.exit(0)
    
    print()
    print("=" * 70)
    print("   Compressing Images")
    print("=" * 70)
    print()
    
    results = []
    
    # Compress PNG files
    if png_files:
        print(f"[STAGE 1] Compressing {len(png_files)} PNG files with pngquant...")
        print()
        
        for f in sorted(png_files, key=lambda x: x['size'], reverse=True):
            print(f"  {f['name']}...", end=" ", flush=True)
            
            if pngquant_available:
                orig, new = compress_png_with_pngquant(f['path'], quality_min=75, quality_max=100)
            else:
                # Fallback to Pillow
                orig, new = compress_png_with_pillow(f['path'])
            
            saved = orig - new
            if saved > 0:
                percent = (saved / orig) * 100
                print(f"✓ {orig/1024:.0f}KB → {new/1024:.0f}KB (saved {saved/1024:.0f}KB, {percent:.0f}%)")
            else:
                print(f"✓ Already optimal ({orig/1024:.0f}KB)")
            
            results.append({
                'name': f['name'],
                'format': 'PNG',
                'original': orig,
                'new': new,
                'saved': saved
            })
        print()
    
    # Compress JPEG files  
    if jpeg_files:
        print(f"[STAGE 2] Compressing {len(jpeg_files)} JPEG files...")
        print()
        
        for f in sorted(jpeg_files, key=lambda x: x['size'], reverse=True):
            print(f"  {f['name']}...", end=" ", flush=True)
            
            orig, new = compress_jpeg_with_pillow(f['path'], quality=85)
            
            saved = orig - new
            if saved > 0:
                percent = (saved / orig) * 100
                print(f"✓ {orig/1024:.0f}KB → {new/1024:.0f}KB (saved {saved/1024:.0f}KB, {percent:.0f}%)")
            else:
                print(f"✓ Already optimal ({orig/1024:.0f}KB)")
            
            results.append({
                'name': f['name'],
                'format': 'JPEG',
                'original': orig,
                'new': new,
                'saved': saved
            })
        print()
    
    # Summary
    print("=" * 70)
    print("   Compression Summary")
    print("=" * 70)
    print()
    
    total_original = sum(r['original'] for r in results)
    total_new = sum(r['new'] for r in results)
    total_saved = sum(r['saved'] for r in results)
    
    print(f"[RESULT] Original total:   {total_original / 1024 / 1024:.2f} MB")
    print(f"[RESULT] Compressed total: {total_new / 1024 / 1024:.2f} MB")
    print(f"[RESULT] Space saved:      {total_saved / 1024 / 1024:.2f} MB ({(total_saved/total_original)*100:.1f}%)")
    print()
    
    # Top savings
    print("Top 10 files by savings:")
    print("-" * 70)
    for r in sorted(results, key=lambda x: x['saved'], reverse=True)[:10]:
        if r['saved'] > 0:
            pct = (r['saved'] / r['original']) * 100
            print(f"  {r['name']:<40} saved {r['saved']/1024:>6.0f}KB ({pct:>4.0f}%)")
    
    print()
    print("[OK] Compression completed!")
    print()
    
    if backup_dir.exists():
        print(f"[INFO] Original backups available at: {backup_dir}")
    
    input("Press Enter to exit...")

def compress_png_with_pillow(filepath):
    """Fallback PNG compression using Pillow"""
    from PIL import Image
    original_size = os.path.getsize(filepath)
    temp_path = str(filepath) + '.tmp.png'
    
    try:
        img = Image.open(filepath)
        img.save(temp_path, 'PNG', optimize=True, compress_level=9)
        img.close()
        
        new_size = os.path.getsize(temp_path)
        if new_size < original_size:
            shutil.move(temp_path, filepath)
            return original_size, new_size
        else:
            os.remove(temp_path)
            return original_size, original_size
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return original_size, original_size

if __name__ == '__main__':
    main()
