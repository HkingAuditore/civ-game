from PIL import Image
import sys
import os
import math

def remove_background(input_path, output_path, target_color=(255, 0, 255), tolerance=60, soft_edge=40):
    """
    Removes background with specialized 'Magenta Despill' for Gold objects.
    
    Args:
        input_path (str): Input file
        output_path (str): Output file
        target_color (tuple): Target color (default Magenta)
        tolerance (int): Distance for 0 alpha
        soft_edge (int): Transition distance
    """
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        datas = img.getdata()
        
        tr, tg, tb = target_color
        
        newData = []
        
        for item in datas:
            r, g, b, a = item
            
            # 1. Calculate Alpha (Chroma Key)
            # Euclidean distance in RGB space
            # We treat Magenta (255, 0, 255) as the enemy.
            dist = math.sqrt((r - tr)**2 + (g - tg)**2 + (b - tb)**2)
            
            alpha = 255
            if dist < tolerance:
                alpha = 0
            elif dist < (tolerance + soft_edge):
                factor = (dist - tolerance) / soft_edge
                alpha = int(factor * 255)
            
            # 2. Apply Despill (The Secret Sauce)
            # Logic: Magenta has High B, Low G. Gold has High G, Low B.
            # If B > G, it is likely Magenta spill or Background.
            # We clamp B to G. And we reduce R by the same amount to maintain balance.
            
            new_r, new_g, new_b = r, g, b
            
            if b > g:
                delta = b - g
                # Clamp Blue to Green
                new_b = g 
                # Reduce Red by the same amount (because Magenta is R+B)
                new_r = max(0, r - delta)
                
                # Note: This effectively turns (255, 0, 255) -> (0, 0, 0)
                # And (128, 0, 128) -> (0, 0, 0)
            
            # If the pixel was fully transparent, the RGB doesn't matter much, 
            # but for semi-transparent edge pixels (alpha ~ 128), this Despill
            # changes them from Pink-ish to Dark-Grey/Gold-ish.
            
            newData.append((new_r, new_g, new_b, alpha))

        img.putdata(newData)
        
        if os.path.dirname(output_path):
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
        img.save(output_path, "PNG")
        print(f"Successfully processed {input_path}")
        print(f"Saved to {output_path}")
        
    except Exception as e:
        print(f"Error processing image: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python remove_bg.py <input_file> <output_file> [run_mode] [tolerance] [softness]")
    else:
        input_file = sys.argv[1]
        output_file = sys.argv[2]
        
        # We assume Magenta workflow as default now since that's what we are fixing
        target_col = (255, 0, 255) 
        
        if len(sys.argv) > 3:
            mode = sys.argv[3].lower()
            if mode == 'white':
                target_col = (255, 255, 255)
            # if magenta, it's already set
        
        tol = int(sys.argv[4]) if len(sys.argv) > 4 else 80
        soft = int(sys.argv[5]) if len(sys.argv) > 5 else 40
        
        remove_background(input_file, output_file, target_col, tol, soft)
