
import os
from PIL import Image
import shutil

# Source path (from the generation step)
source_path = r"C:/Users/hkinghuang/.gemini/antigravity/brain/a8d58ad7-afb0-4c82-a087-f6875dca2859/magistrate_office_1767062693569.png"
# Destination directory
dest_dir = r"c:/Users/hkinghuang/Documents/GitHub/simple_nation_game/civ-game/src/assets/images/buildings"
dest_path = os.path.join(dest_dir, "magistrate_office.webp")

if not os.path.exists(source_path):
    print(f"Error: Source file not found at {source_path}")
    exit(1)

try:
    with Image.open(source_path) as img:
        # Resize/Crop logic if needed. 
        # The prompt asked for 16:9. Let's ensure it's a standard web-friendly size, e.g., width 1024 or similar if it's too huge.
        # But usually just converting to webp is enough if the aspect ratio is correct.
        # Let's check size.
        print(f"Original size: {img.size}")
        
        # Save as WebP
        img.save(dest_path, "WEBP", quality=85)
        print(f"Successfully saved to {dest_path}")
except Exception as e:
    print(f"Error converting image: {e}")
    exit(1)
