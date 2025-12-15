import os
import glob
from PIL import Image

ARTIFACTS_DIR = "C:/Users/HkingAuditore/.gemini/antigravity/brain/00e1b459-ff95-436a-9524-d701496b7d14/"
OUTPUT_DIR = "public/images/buildings/"

buildings = [
    "trading_post",
    "lumber_camp",
    "quarry",
    "loom_house",
    "hut",
    "brickworks",
    "stone_tool_workshop",
    "library",
    "barracks",
    "copper_mine",
    "dye_works",
    "bronze_foundry",
    "sawmill",
    "granary",
    "amphitheater"
]

def process_building(name):
    # Find all matching files
    pattern = os.path.join(ARTIFACTS_DIR, f"{name}_*.png")
    files = glob.glob(pattern)
    
    if not files:
        print(f"No image found for {name}")
        return

    # Get the latest file
    latest_file = max(files, key=os.path.getctime)
    
    output_path = os.path.join(OUTPUT_DIR, f"{name}.webp")
    
    try:
        with Image.open(latest_file) as img:
            width, height = img.size
            target_height = int(width * 9 / 16)
            
            if height > target_height:
                top = (height - target_height) // 2
                bottom = top + target_height
                img = img.crop((0, top, width, bottom))
                print(f"Cropped {name} to {width}x{target_height}")
            
            img.save(output_path, "WEBP", quality=90)
            print(f"Saved {output_path}")
            
    except Exception as e:
        print(f"Failed to process {name}: {e}")

if __name__ == "__main__":
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    for b in buildings:
        process_building(b)
