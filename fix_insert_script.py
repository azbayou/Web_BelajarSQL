import codecs
import re

with codecs.open('scripts/generateSoal.js', 'r', 'utf-8') as f:
    content = f.read()

new_prompt = """    const prompt = `Anda adalah AI ahli database dan pembuat soal SQL. Tugas Anda adalah membuat 10 soal latihan SQL interaktif yang fresh dan kreatif.
Level kesulitan harus bervariasi (misal 3 Beginner, 4 Intermediate, 3 Advance).
Konteks / skenario databasenya buatlah beragam (misal e-commerce, rumah sakit, sekolah, logistik, dll).

Buatlah dalam bahasa Indonesia.
Keluarkan output HANYA dalam bentuk array JSON murni (tanpa tag markdown \`\`\`json).
Struktur HANYA boleh seperti ini:
[
  {
    "questionId": "ai_soal_[angka acak]",
    "title": "Judul Soal",
    "difficulty": "Beginner/Intermediate/Advance",
    "businessCase": "Deskripsi masalah yang harus diselesaikan murid.",
    "tables": [
      {
        "name": "nama_tabel",
        "createSql": "CREATE TABLE ...",
        "insertSql": "INSERT INTO ... VALUES (...), (...)"
      }
    ],
    "referenceQuery": "SELECT ...",
    "defaultQuery": "SELECT * FROM nama_tabel;"
  }
]
`;"""

content = re.sub(r'    const prompt = `Anda adalah AI ahli database.*?\]\n`;', new_prompt, content, flags=re.DOTALL)

with codecs.open('scripts/generateSoal.js', 'w', 'utf-8') as f:
    f.write(content)
