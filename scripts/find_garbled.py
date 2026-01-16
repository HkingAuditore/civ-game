
import os
import re

def search_files(directory):
    pattern = re.compile(r'[`\'"].*?\([^)]*?x\$\{.*?\}', re.IGNORECASE)
    # Also match simpler "x" patterns inside strings
    pattern2 = re.compile(r'x\d+(\.\d+)?') 
    
    # The user text: "蒸汽财团(纸张x15.8"
    # Matches: Name ( Resource xAmount ... )
    # Likely code: `${name}(${resource}x${amount}`
    
    pattern3 = re.compile(r'\$\{.*?\}\s*\(\s*\$\{.*?\}\s*x\s*\$\{', re.VERBOSE) 
    
    hits = []
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if not file.endswith(('.js', '.jsx', '.ts', '.tsx')):
                continue
                
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.splitlines()
                    for i, line in enumerate(lines):
                        if "x" in line and "(" in line and ")" in line:
                            # Heuristic check
                            if "${" in line:
                                hits.append(f"{path}:{i+1}: {line.strip()}")
            except Exception as e:
                print(f"Error reading {path}: {e}")
                
    return hits

results = search_files('f:\\Developent\\civ-game\\src')
for result in results:
    print(result)
