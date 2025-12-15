#!/usr/bin/env python3
"""
PNG Image Lossless Compression Script
Uses Pillow for PNG optimization with maximum compression settings
"""

import os
import shutil
from pathlib import Path
from PIL import Image
import sys

def get_file_size_kb(path):
    """Get file size in KB"""
    return os.path.getsize(path) / 1024

def compress_png(input_path, output_path=None):
    """
    Compress PNG image using Pillow with maximum lossless compression
    
    Args:
        input_path: Path to input PNG file
        output_path: Path to output file (defaults to overwriting input)
    
    Returns:
        Tuple of (original_size, new_size) in bytes
    """
    if output_path is None:
        output_path = input_path
    
    original_size = os.path.getsize(input_path)
    
    # Open the image
    img = Image.open(input_path)
    
    # Get original mode and info
    original_mode = img.mode
    
    # Convert RGBA to palette mode if possible for better compression
    # Only do this if image has limited colors
    if img.mode == 'RGBA':
        # Check if image actually uses alpha channel
        if img.split()[-1].getextrema() == (255, 255):
            # Alpha channel is all opaque, convert to RGB
            img = img.convert('RGB')
    
    # Save with maximum compression
    # compress_level: 0-9, where 9 is maximum compression (slower but smaller)
    temp_path = str(input_path) + '.tmp'
    
    try:
        img.save(
            temp_path,
            'PNG',
            optimize=True,
            compress_level=9
        )
        
        new_size = os.path.getsize(temp_path)
        
        # Only replace if new file is smaller
        if new_size < original_size:
            shutil.move(temp_path, output_path)
            return original_size, new_size
        else:
            os.remove(temp_path)
            return original_size, original_size
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise e
    finally:
        img.close()

def main():
    # Define paths
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    images_dir = project_dir / 'public' / 'images' / 'events'
    backup_dir = images_dir / 'backup_original'
    
    print("=" * 60)
    print("   PNG Lossless Compression Script")
    print("   Target: events folder PNG images")
    print("=" * 60)
    print()
    
    # Check if images directory exists
    if not images_dir.exists():
        print(f"[ERROR] Images directory not found: {images_dir}")
        sys.exit(1)
    
    # Get all PNG files (excluding backup directory)
    png_files = [
        f for f in images_dir.glob('*.png')
        if f.parent != backup_dir
    ]
    
    if not png_files:
        print("[INFO] No PNG files found to compress")
        sys.exit(0)
    
    print(f"[INFO] Found {len(png_files)} PNG files to compress")
    print(f"[INFO] Images directory: {images_dir}")
    print()
    
    # Calculate original total size
    total_original = sum(os.path.getsize(f) for f in png_files)
    print(f"[INFO] Total original size: {total_original / 1024 / 1024:.2f} MB")
    print()
    
    # Ask for backup
    backup_choice = input("Create backup of original files? (Y/N): ").strip().upper()
    
    if backup_choice == 'Y':
        print()
        print("[INFO] Creating backup...")
        backup_dir.mkdir(exist_ok=True)
        for f in png_files:
            backup_path = backup_dir / f.name
            shutil.copy2(f, backup_path)
            print(f"[BACKUP] {f.name}")
        print(f"[OK] Backup completed to: {backup_dir}")
    
    print()
    print("=" * 60)
    print("   Starting Compression")
    print("=" * 60)
    print()
    
    # Compress each file
    results = []
    total_saved = 0
    
    for png_file in sorted(png_files):
        print(f"[COMPRESS] {png_file.name}...", end=" ")
        
        try:
            original_size, new_size = compress_png(png_file)
            saved = original_size - new_size
            total_saved += saved
            
            if saved > 0:
                percent = (saved / original_size) * 100
                print(f"✓ Saved {saved / 1024:.1f} KB ({percent:.1f}%)")
            else:
                print("✓ Already optimized")
            
            results.append({
                'name': png_file.name,
                'original': original_size,
                'new': new_size,
                'saved': saved
            })
        except Exception as e:
            print(f"✗ Error: {e}")
            results.append({
                'name': png_file.name,
                'original': 0,
                'new': 0,
                'saved': 0,
                'error': str(e)
            })
    
    # Show results
    print()
    print("=" * 60)
    print("   Compression Results")
    print("=" * 60)
    print()
    
    total_new = sum(r['new'] for r in results if 'error' not in r)
    
    print(f"[RESULT] Original size:   {total_original / 1024 / 1024:.2f} MB ({total_original / 1024:.0f} KB)")
    print(f"[RESULT] Compressed size: {total_new / 1024 / 1024:.2f} MB ({total_new / 1024:.0f} KB)")
    print(f"[RESULT] Space saved:     {total_saved / 1024 / 1024:.2f} MB ({total_saved / 1024:.0f} KB)")
    
    if total_original > 0:
        percent = (total_saved / total_original) * 100
        print(f"[RESULT] Reduction:       {percent:.1f}%")
    
    print()
    print("=" * 60)
    print("   Individual File Results")
    print("=" * 60)
    print()
    print(f"{'Filename':<35} {'Original':>10} {'New':>10} {'Saved':>10}")
    print("-" * 70)
    
    for r in sorted(results, key=lambda x: x['saved'], reverse=True):
        if 'error' not in r:
            print(f"{r['name']:<35} {r['original']/1024:>8.1f}KB {r['new']/1024:>8.1f}KB {r['saved']/1024:>8.1f}KB")
        else:
            print(f"{r['name']:<35} ERROR: {r['error']}")
    
    print()
    print("[OK] Compression completed!")
    
    if backup_choice == 'Y':
        print()
        print(f"[INFO] Original files backed up to: {backup_dir}")
        print("[INFO] To restore originals, copy files from backup folder.")
    
    print()
    input("Press Enter to exit...")

if __name__ == '__main__':
    main()
