import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_prompt = '''const promptText = Buatkan 10 soal SQL baru untuk level  dengan format JSON murni.
      Formatnya harus persis berupa JSON array berisi 10 object (tanpa markdown blok sama sekali).
      Pastikan setiap soal memiliki "questionId" yang unik (misalnya "ai_1", "ai_2", dst).
      Contoh struktur 1 soal (buat 10 seperti ini dalam array):
      [{
        "questionId": "ai_unique_id_1",
        "title": "Soal Baru: [Judul Bebas]",
        "difficulty": "",
        "businessCase": "Deskripsi studi kasus unik.",
        "tables": [ { "name": "...", "createSql": "CREATE TABLE ...;" } ],
        "referenceQuery": "SELECT ...;"
      }];'''

content = re.sub(r'const promptText = Buatkan 10 soal.*?\}\]\;', new_prompt, content, flags=re.DOTALL)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
