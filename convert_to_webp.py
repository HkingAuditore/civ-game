import sys
from PIL import Image
import os

def convert_image(input_path, output_path):
    try:
        with Image.open(input_path) as img:
            # Calculate target height for 16:9 aspect ratio
            width, height = img.size
            target_height = int(width * 9 / 16)
            
            if height > target_height:
                # Center crop
                top = (height - target_height) // 2
                bottom = top + target_height
                img = img.crop((0, top, width, bottom))
                print(f"Cropped to {width}x{target_height} (16:9)")
            
            img.save(output_path, "WEBP", quality=90)
        print(f"Successfully converted {input_path} to {output_path}")
    except Exception as e:
        print(f"Error converting image: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert_to_webp.py <input_path> <output_path>")
        sys.exit(1)
    
    convert_image(sys.argv[1], sys.argv[2])
