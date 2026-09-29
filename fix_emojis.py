import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('?? Tulis SQL', '💻 Tulis SQL')
content = content.replace('?? Index Query', '📓 Index Query')

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
