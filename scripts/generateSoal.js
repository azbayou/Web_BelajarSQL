const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// Coba load dotenv untuk local, abaikan jika tidak ada (untuk GitHub Actions)
try {
  require("dotenv").config();
} catch (e) {}

const API_KEY = process.env.GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("API Key Gemini tidak ditemukan. Pastikan sudah diset di .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

async function generateSoal() {
  console.log(`[${new Date().toLocaleString()}] Memulai proses generate soal SQL AI...`);
  
  const prompt = `Anda adalah AI ahli database dan pembuat soal SQL. Tugas Anda adalah membuat 10 soal latihan SQL interaktif yang fresh dan kreatif.
Level kesulitan harus bervariasi (misal 3 Beginner, 4 Intermediate, 3 Advance).
Konteks / skenario databasenya buatlah beragam (misal e-commerce, rumah sakit, sekolah, logistik, dll).

Buatlah dalam bahasa Indonesia.
Format output Anda HARUS murni JSON array tanpa format markdown (tanpa tag \`\`\`json).
Setiap objek soal harus memiliki struktur berikut secara persis karena akan dimasukkan ke engine DuckDB Web:

[
  {
    "questionId": "unik, misal: q_ai_001",
    "title": "Judul Soal",
    "difficulty": "Pilih salah satu: Beginner, Intermediate, Advance",
    "businessCase": "Penjelasan singkat kasus bisnis atau instruksi yang harus dijawab",
    "tables": [
      {
        "name": "nama_tabel",
        "createSql": "CREATE TABLE nama_tabel (kolom1 TIPE, kolom2 TIPE);",
        "insertSql": "INSERT INTO nama_tabel VALUES (val1, val2), (val3, val4);"
      }
    ],
    "referenceQuery": "Query SQL yang benar untuk menyelesaikan soal (harus kompatibel dengan PostgreSQL/DuckDB syntax)",
    "defaultQuery": "Query awalan untuk user, misalnya SELECT * FROM nama_tabel;"
  }
]

Pastikan semua nilai syntax valid, tanda kutip benar, insert data cukup representatif untuk di-test, dan output Anda bisa langsung di-parse oleh JSON.parse().`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const questions = JSON.parse(cleanText);
    
    if (!Array.isArray(questions) || questions.length < 10) {
      throw new Error("Output tidak valid atau kurang dari 10 soal.");
    }

    const outputPath = path.join(__dirname, "..", "src", "ai_questions.json");
    fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2), "utf8");
    console.log(`[${new Date().toLocaleString()}] Berhasil membuat dan menyimpan 10 soal baru ke ${outputPath}`);
    
  } catch (error) {
    console.error(`[${new Date().toLocaleString()}] Gagal meng-generate soal:`, error.message);
  }
}

if (require.main === module) {
  generateSoal();
}

module.exports = { generateSoal };
