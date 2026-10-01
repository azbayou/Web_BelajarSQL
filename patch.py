import codecs

file_path = 'src/App.jsx'
with codecs.open(file_path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Add import
if 'import { dummyTables }' not in content:
    content = content.replace(
        'import aiQuestions from "./ai_questions.json";',
        'import aiQuestions from "./ai_questions.json";\nimport { dummyTables } from "./dummy_db.js";'
    )

# 2. Update prompt
old_prompt = '''    const promptText = Buatkan 5 soal SQL baru untuk level  dengan format JSON murni.
berupa JSON array berisi 5 object tanpa markdown blok sama sekali. Pastikan setiap soal memiliki "questionId" yang unik, misal ai_1, ai_2, dst
Contoh struktur 1 soal (buat 5 seperti ini dalam array):
[{
  "questionId": "ai_unique_id_1",
  "title": "Soal Baru: [Judul Bebas]",
  "difficulty": "",
  "businessCase": "Deskripsi studi kasus unik.",
  "tables": [ { "name": "...", "createSql": "CREATE TABLE ...;", "insertSql": "INSERT INTO ... VALUES (...);" } ],
  "referenceQuery": "SELECT ...;"
}];'''

new_prompt = '''    const schemaText = dummyTables.map(t => t.createSql).join("\\n");
    const promptText = Buatkan 5 soal SQL baru untuk level  dengan format JSON murni.
Soal harus menggunakan HANYA skema tabel berikut ini:


TIDAK BOLEH membuat tabel baru. Gunakan tabel yang ada di atas saja.
Berupa JSON array berisi 5 object tanpa markdown blok sama sekali. Pastikan setiap soal memiliki "questionId" yang unik, misal ai_1, ai_2, dst.
TIDAK PERLU menyertakan property "tables" pada output JSON, cukup kembalikan format berikut.

Contoh struktur 1 soal (buat 5 seperti ini dalam array):
[{
  "questionId": "ai_unique_id_1",
  "title": "Soal Baru: [Judul Bebas]",
  "difficulty": "",
  "businessCase": "Deskripsi studi kasus unik.",
  "referenceQuery": "SELECT ...;"
}];'''

if old_prompt in content:
    content = content.replace(old_prompt, new_prompt)
elif 'const schemaText = dummyTables' not in content:
    print("Warning: old prompt not found, could not replace prompt")

# 3. Update parsing logic
old_parse = '''      const newQuestions = JSON.parse(jsonText);
      if (newQuestions && newQuestions.length > 0) {'''

new_parse = '''      const parsed = JSON.parse(jsonText);
      const newQuestions = parsed.map(q => ({ ...q, tables: dummyTables, defaultQuery: "SELECT * FROM users;" }));
      if (newQuestions && newQuestions.length > 0) {'''

if old_parse in content:
    content = content.replace(old_parse, new_parse)

with codecs.open(file_path, 'w', 'utf-8') as f:
    f.write(content)

print("Patch applied.")
