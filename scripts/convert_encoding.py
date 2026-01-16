
import os

file_path = 'f:\\Developent\\civ-game\\src\\logic\\simulation.js'
backup_path = file_path + '.bak'

try:
    # 1. Read as GBK
    with open(file_path, 'r', encoding='gbk') as f:
        content = f.read()
    print(f"Successfully read {len(content)} characters using GBK.")

    # 2. Create backup
    with open(backup_path, 'w', encoding='gbk') as f:
        f.write(content)
    print(f"Created backup at {backup_path}")

    # 3. Write as UTF-8
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Successfully converted {file_path} to UTF-8.")

except Exception as e:
    print(f"Error during conversion: {e}")
    # Restore from backup if backup exists and main file is potentially corrupted (though we haven't written to it if read failed)
    # If write failed, we might have a partial file, but the logic above implies sequential steps.
