import codecs

with codecs.open('src/App.jsx', 'r', 'utf-8') as f:
    content = f.read()

start_idx = content.find('Buatkan 10 soal SQL')
end_idx = content.find('}];', start_idx) + 4

if start_idx != -1 and end_idx != -1 + 4:
    new_prompt = '''Buatkan 10 soal SQL baru untuk level  dengan format JSON murni.
      Formatnya harus persis berupa JSON array berisi 10 object (tanpa markdown blok sama sekali).
      Pastikan setiap soal memiliki "questionId" yang unik.
      Contoh struktur 1 soal (buat 10 seperti ini dalam array):
      [{
        "questionId": "ai_unique_id_1",
        "title": "Soal Baru: [Judul Bebas]",
        "difficulty": "",
        "businessCase": "Deskripsi studi kasus unik.",
        "tables": [ { "name": "...", "createSql": "CREATE TABLE ...;" } ],
        "referenceQuery": "SELECT ...;"
      }];'''
    content = content[:start_idx] + new_prompt + content[end_idx:]

    with codecs.open('src/App.jsx', 'w', 'utf-8') as f:
        f.write(content)
