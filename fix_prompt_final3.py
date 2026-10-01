import codecs

with codecs.open('src/App.jsx', 'r', 'utf-8') as f:
    content = f.read()

content = content.replace('Buatkan 1 soal', 'Buatkan 10 soal')
content = content.replace('hanya JSON array tanpa markdown', 'berupa JSON array berisi 10 object tanpa markdown blok sama sekali. Pastikan setiap soal memiliki "questionId" yang unik, misal ai_1, ai_2, dst')

with codecs.open('src/App.jsx', 'w', 'utf-8') as f:
    f.write(content)
