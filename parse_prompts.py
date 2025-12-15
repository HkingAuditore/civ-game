
import re

file_path = 'prompts/building_prompts.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Regex to find lines like: - **key**: Prompt text...
pattern = r'- \*\*(.*?)\*\*: (.*?)$'
matches = re.findall(pattern, content, re.MULTILINE)

for key, prompt in matches:
    print(f"{key}|{prompt}")
