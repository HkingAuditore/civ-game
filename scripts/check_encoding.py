
import os

path = 'f:\\Developent\\civ-game\\src\\logic\\simulation.js'

try:
    with open(path, 'rb') as f:
        # Read around line 3450
        content = f.read()
        
    print(f"File size: {len(content)}")
    
    # Try decoding as utf-8
    try:
        decoded = content.decode('utf-8')
        print("UTF-8 Decode: Success")
        lines = decoded.splitlines()
        for i, line in enumerate(lines):
            if i > 3445 and i < 3460:
                print(f"Line {i+1}: {line}")
    except Exception as e:
        print(f"UTF-8 Decode: Failed ({e})")
        
        # Try GBK
        try:
            decoded = content.decode('gbk')
            print("GBK Decode: Success")
            lines = decoded.splitlines()
            for i, line in enumerate(lines):
                if i > 3445 and i < 3460:
                    print(f"Line {i+1}: {line}")
        except Exception as e2:
             print(f"GBK Decode: Failed ({e2})")

except Exception as e:
    print(f"Error: {e}")
