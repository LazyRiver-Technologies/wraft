import os
import re

def fix_imports(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    changed = False
    
    for line in lines:
        if line.startswith('from ..'):
            new_line = re.sub(r'^from \.\.', 'from ', line)
            new_lines.append(new_line)
            changed = True
        elif line.startswith('from .'):
            rel_path = os.path.relpath(os.path.dirname(filepath), '.')
            if rel_path == '.':
                new_line = re.sub(r'^from \.', 'from ', line)
            else:
                prefix = rel_path.replace(os.sep, '.')
                new_line = re.sub(r'^from \.', f'from {prefix}.', line)
            new_lines.append(new_line)
            changed = True
        else:
            new_lines.append(line)
            
    if changed:
        with open(filepath, 'w') as f:
            f.writelines(new_lines)
        print(f"Fixed {filepath}")

for root, _, files in os.walk('.'):
    if 'venv' in root:
        continue
    for file in files:
        if file.endswith('.py') and file != 'fix_imports.py':
            fix_imports(os.path.join(root, file))
print("Fixed relative imports")
