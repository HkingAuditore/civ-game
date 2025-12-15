
file_path = 'prompts/building_prompts.md'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_content = content.replace('--ar 1:1', '--ar 16:9')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Updated {file_path}")
