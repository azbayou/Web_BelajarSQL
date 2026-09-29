# 🎓 SQL-AI Academy — Interactive SQL Learning Platform

> **Belajar SQL secara interaktif langsung di browser — tanpa install database, tanpa backend, sepenuhnya ditenagai oleh AI.**

🔗 **Live Website**: [https://webelajarsql.vercel.app](https://webelajarsql.vercel.app/)

---

## 📸 Gambaran Umum

**SQL-AI Academy** adalah platform latihan SQL berbasis web yang dirancang untuk pemula hingga tingkat lanjut. Pengguna dapat mengerjakan soal SQL langsung di browser, menulis query di editor berwarna ala VS Code, dan melihat hasilnya secara instan — semuanya tanpa perlu menginstal database engine seperti MySQL atau PostgreSQL di komputer mereka.

### ✨ Fitur Utama

| Fitur | Deskripsi |
|---|---|
| **In-Browser SQL Engine** | Menggunakan DuckDB-WASM untuk menjalankan query SQL langsung di browser tanpa server |
| **AI-Powered Question Generator** | Soal-soal baru di-generate oleh AI (Gemini / GROQ) secara real-time |
| **AI Tutor** | Fitur "Tanya AI" untuk meminta hint atau evaluasi query dari AI |
| **Auto-Grader** | Sistem pengecekan jawaban otomatis (membandingkan hasil tabel) |
| **Cheat Code** | Tombol untuk melihat kunci jawaban (referenceQuery) |
| **Index Query** | Referensi sintaks SQL lengkap dengan syntax highlighting |
| **Responsive UI** | Tampilan responsif untuk desktop dan mobile |
| **Question Persistence** | Soal tersimpan di `localStorage` agar tidak hilang saat refresh |
| **Daily Auto-Generate** | GitHub Actions cron job yang memperbarui soal setiap hari |

---

## 🏗️ Arsitektur & Tech Stack

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND (SPA)                  │
│  React 19 + Vite 5 + TailwindCSS               │
│                                                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ CodeMirror│  │ DuckDB    │  │ Gemini /     │  │
│  │ (Editor)  │  │ WASM      │  │ GROQ API     │  │
│  │ VS Code   │  │ (SQL      │  │ (AI Tutor &  │  │
│  │ Dark Theme│  │  Engine)  │  │  Generator)  │  │
│  └──────────┘  └───────────┘  └──────────────┘  │
└─────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌──────────────────┐
│  Vercel (Host)  │          │  GitHub Actions   │
│  Static Deploy  │          │  (Daily Cron Job) │
└─────────────────┘          └──────────────────┘
```

### Frontend

| Teknologi | Versi | Fungsi |
|---|---|---|
| [React](https://react.dev) | 19.0.0 | UI framework utama (SPA) |
| [Vite](https://vitejs.dev) | 5.x | Build tool & dev server (pengganti CRA) |
| [TailwindCSS](https://tailwindcss.com) | 4.3.3 | Utility-first CSS framework |
| [CodeMirror](https://codemirror.net) (`@uiw/react-codemirror`) | 4.25.12 | Code editor dengan syntax highlighting SQL dan tema VS Code Dark |
| [ReactMarkdown](https://github.com/remarkjs/react-markdown) | 9.0.1 | Render respons AI dalam format Markdown |

### Database Engine (In-Browser)

| Teknologi | Versi | Fungsi |
|---|---|---|
| [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview) | 1.28.0 | Engine SQL analitik yang dikompilasi ke WebAssembly dan berjalan 100% di browser |
| [Apache Arrow](https://arrow.apache.org) | 13.0.0 | Format kolumnar untuk transfer data antara DuckDB dan JavaScript |

### AI Integration

| Provider | Model | Fungsi |
|---|---|---|
| [Google Gemini](https://ai.google.dev) (`@google/generative-ai`) | `gemini-flash-latest` / `gemini-flash-lite-latest` | AI Tutor (hint & evaluasi), Generator Soal (frontend & backend) |
| [GROQ](https://groq.com) (OpenAI-compatible API) | `openai/gpt-oss-120b` | **Fallback** otomatis jika Gemini mengalami rate-limit (503 High Demand) |

### Deployment & CI/CD

| Layanan | Fungsi |
|---|---|
| [Vercel](https://vercel.com) | Hosting & auto-deploy dari branch `main` |
| [GitHub Actions](https://github.com/features/actions) | Cron job harian untuk auto-generate soal baru |

---

## 📂 Struktur File

```
Web_BelajarSQL/
├── .github/
│   └── workflows/
│       └── auto_generate_soal.yml   # GitHub Actions: cron job generate soal harian
├── public/
│   └── index_sql_sintaks.txt        # Referensi sintaks SQL (ditampilkan di tab Index Query)
├── scripts/
│   └── generateSoal.js             # Node.js script: generate 10 soal via Gemini/GROQ
├── src/
│   ├── App.jsx                      # Komponen utama React (semua logika ada di sini)
│   ├── index.jsx                    # Entry point React
│   ├── style.css                    # Stylesheet utama (custom CSS, bukan Tailwind classes)
│   ├── question.json                # Bank soal statis (hardcoded, ~15 soal)
│   └── ai_questions.json            # Bank soal AI (di-generate otomatis oleh cron/script)
├── index.html                       # HTML template (Vite entry point)
├── package.json                     # Dependencies & scripts
├── vite.config.js                   # Konfigurasi Vite (output ke folder `build`)
├── vercel.json                      # Konfigurasi Vercel deployment
├── .eslintrc.json                   # Konfigurasi ESLint
└── .gitignore                       # Ignore node_modules
```

---

## 🧠 Cara Kerja Aplikasi

### 1. Inisialisasi Database (DuckDB-WASM)

Saat halaman pertama kali dibuka, aplikasi:
1. Mengunduh bundle DuckDB-WASM dari CDN (jsDelivr)
2. Membuat Web Worker untuk menjalankan engine database di thread terpisah
3. Menyiapkan koneksi database di memori browser

```jsx
// src/App.jsx — Inisialisasi DuckDB
const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
const worker = new Worker(workerUrl);
const database = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
const connection = await database.connect();
```

### 2. Memuat Soal

Setiap kali pengguna memilih soal:
1. Semua tabel dari soal sebelumnya di-DROP
2. Tabel baru dibuat (`CREATE TABLE`) dan diisi data (`INSERT INTO`) sesuai definisi soal
3. `referenceQuery` dijalankan untuk menghasilkan **Expected Table** sebagai acuan jawaban

### 3. Menjalankan Query (Run)

Pengguna menulis SQL di editor CodeMirror, lalu menekan **Run**:
- Query dieksekusi langsung di DuckDB-WASM (in-browser)
- Hasil ditampilkan di panel **Output Console**

### 4. Submit & Auto-Grading

Saat menekan **Submit**:
1. Query pengguna dieksekusi → menghasilkan `userRows`
2. `referenceQuery` dieksekusi → menghasilkan `refRows`
3. Kedua hasil di-serialize (`JSON.stringify` dengan penanganan `BigInt`) dan dibandingkan
4. Jika **identik** → ✅ Benar! Jika **berbeda** → ❌ Belum sesuai

```jsx
const isCorrect = serialize(userRows) === serialize(refRows);
```

> **Catatan:** Pengecekan hanya berdasarkan **hasil tabel**, bukan query-nya. Pengguna bebas menggunakan query apa pun selama menghasilkan output yang sama.

### 5. AI Tutor (Tanya AI)

Fitur **Tanya AI** mengirimkan konteks soal + query pengguna ke AI:
- **Primary**: Google Gemini (`gemini-flash-lite-latest`)
- **Fallback**: GROQ (`openai/gpt-oss-120b`) jika Gemini error 503

AI berperan sebagai tutor dan memberikan **hint** tanpa langsung memberikan jawaban.

### 6. Refresh Soal Baru (AI Generator — Frontend)

Tombol **Refresh Soal Baru (AI)** memicu generate soal secara real-time:
1. Prompt dikirim ke Gemini/GROQ untuk membuat 5 soal baru sesuai difficulty
2. Respons AI di-parse menggunakan regex robust (`/\[[\s\S]*\]/`) untuk ekstraksi JSON
3. Soal baru digabungkan dengan soal lama (deduplicated by `questionId`)
4. Disimpan ke `localStorage` agar persisten saat refresh halaman

### 7. Cheat Code

Tombol **Cheat Code** menampilkan `referenceQuery` soal yang sedang aktif di dalam modal pop-up.

---

## 🤖 Sistem AI & Fallback

### Strategi Multi-Provider

Aplikasi ini menggunakan **dual-provider AI** dengan mekanisme fallback otomatis:

```
Request AI
    │
    ▼
┌──────────────┐    berhasil     ┌──────────┐
│ Google Gemini │ ──────────────→ │ Response │
│ (Primary)    │                 └──────────┘
└──────┬───────┘
       │ gagal (503 / error)
       ▼
┌──────────────┐    berhasil     ┌──────────┐
│ GROQ API     │ ──────────────→ │ Response │
│ (Fallback)   │                 └──────────┘
└──────────────┘
```

### Model yang Digunakan

| Konteks | Provider | Model | Alasan |
|---|---|---|---|
| AI Tutor (hint) | Gemini | `gemini-flash-lite-latest` | Ringan, cepat, cukup untuk evaluasi |
| Generate Soal (frontend) | Gemini → GROQ | `gemini-flash-latest` → `openai/gpt-oss-120b` | Butuh reasoning lebih kuat untuk skema SQL |
| Generate Soal (backend/cron) | Gemini → GROQ | `gemini-flash-latest` → `openai/gpt-oss-120b` | Sama seperti frontend |

---

## ⚙️ Scripts

### `npm run generate-soal`

**File**: [`scripts/generateSoal.js`](scripts/generateSoal.js)

Script Node.js yang menghasilkan 10 soal SQL baru dan menyimpannya ke `src/ai_questions.json`.

**Alur kerja:**
1. Membaca API key dari environment variable (`GEMINI_API_KEY` / `GROQ_API_KEY`)
2. Mengirim prompt ke Gemini untuk membuat 10 soal (3 Beginner, 4 Intermediate, 3 Advance)
3. Jika Gemini gagal → otomatis beralih ke GROQ
4. Respons AI dibersihkan dari markdown dan di-parse sebagai JSON
5. Validasi: harus berupa array dengan minimal 10 elemen
6. Ditulis ke `src/ai_questions.json`

**Penggunaan lokal:**
```bash
# Pastikan API key tersedia
export GEMINI_API_KEY=your_key_here
npm run generate-soal
```

### GitHub Actions Cron Job

**File**: [`.github/workflows/auto_generate_soal.yml`](.github/workflows/auto_generate_soal.yml)

Workflow otomatis yang berjalan **setiap hari pukul 00:00 UTC (07:00 WIB)**:

1. Checkout repository
2. Install dependencies (`npm install`)
3. Jalankan `npm run generate-soal` dengan `GEMINI_API_KEY` dari GitHub Secrets
4. Jika ada perubahan di `src/ai_questions.json`, auto-commit dan push

```yaml
on:
  schedule:
    - cron: '0 0 * * *'   # Setiap hari jam 07:00 WIB
  workflow_dispatch:        # Bisa dijalankan manual
```

---

## 🔐 Environment Variables

### Vercel (Frontend)

| Variable | Tipe | Deskripsi |
|---|---|---|
| `VITE_GEMINI_API_KEY` | Config | API key Google Gemini untuk AI Tutor & Generator |
| `VITE_GROQ_API_KEY` | Config | API key GROQ untuk fallback AI |

> ⚠️ Karena Vite meng-bundle variabel `VITE_*` ke dalam kode frontend, API key **akan terekspos** di browser. Ini acceptable untuk project pembelajaran, namun **tidak direkomendasikan** untuk production.

### GitHub Actions (Backend)

| Secret | Deskripsi |
|---|---|
| `GEMINI_API_KEY` | Digunakan oleh `generateSoal.js` di cron job |
| `GROQ_API_KEY` | _(Opsional)_ Fallback untuk cron job |

---

## 🚀 Deployment

### Vercel

Aplikasi di-deploy secara otomatis ke Vercel setiap kali ada push ke branch `main`.

**Konfigurasi** ([`vercel.json`](vercel.json)):
```json
{
  "buildCommand": "CI=false yarn build",
  "outputDirectory": "build"
}
```

**Build tool**: Vite (output ke folder `build/`)

---

## 🛠️ Pengembangan Lokal

```bash
# Clone repository
git clone https://github.com/azbayou/Web_BelajarSQL.git
cd Web_BelajarSQL

# Install dependencies
npm install

# Buat file .env di root project
echo "VITE_GEMINI_API_KEY=your_gemini_key" > .env
echo "VITE_GROQ_API_KEY=your_groq_key" >> .env

# Jalankan dev server
npm start
# Buka http://localhost:5173
```

---

## 📊 Format Data Soal

Setiap soal (baik statis maupun AI-generated) mengikuti format JSON berikut:

```json
{
  "questionId": "q003",
  "title": "Daftar Driver Aktif",
  "difficulty": "Beginner",
  "businessCase": "Tim operasional membutuhkan daftar semua driver yang berstatus 'ACTIVE'.",
  "tables": [
    {
      "name": "drivers",
      "createSql": "CREATE TABLE drivers (driver_id VARCHAR, name VARCHAR, status VARCHAR);",
      "insertSql": "INSERT INTO drivers VALUES ('D01', 'Budi', 'ACTIVE'), ('D02', 'Anto', 'INACTIVE');"
    }
  ],
  "referenceQuery": "SELECT driver_id, name FROM drivers WHERE status = 'ACTIVE'",
  "defaultQuery": "SELECT * FROM drivers;"
}
```

| Field | Deskripsi |
|---|---|
| `questionId` | ID unik soal |
| `title` | Judul soal |
| `difficulty` | Level: `Beginner`, `Intermediate`, atau `Advance` |
| `businessCase` | Studi kasus / instruksi soal |
| `tables[].name` | Nama tabel |
| `tables[].createSql` | DDL untuk membuat tabel |
| `tables[].insertSql` | DML untuk mengisi data dummy |
| `referenceQuery` | Query SQL kunci jawaban |
| `defaultQuery` | Query awal yang muncul di editor |

---

## 📝 Referensi Sintaks SQL

File [`public/index_sql_sintaks.txt`](public/index_sql_sintaks.txt) berisi referensi lengkap sintaks SQL yang mencakup:

- **DDL** — `CREATE TABLE`, `DROP TABLE`, `ALTER TABLE`
- **DML** — `INSERT`, `UPDATE`, `DELETE`
- **DQL** — `SELECT`, `WHERE`, `ORDER BY`, `LIMIT`
- **Agregasi** — `COUNT`, `SUM`, `AVG`, `MAX`, `MIN`, `GROUP BY`, `HAVING`
- **JOIN** — `INNER JOIN`, `LEFT JOIN`, `RIGHT JOIN`, `FULL OUTER JOIN`
- **Subquery** — `WHERE ... IN (SELECT ...)`, `EXISTS`
- **Window Functions** — `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`
- **String & Date Functions** — `UPPER()`, `LOWER()`, `CONCAT()`, `EXTRACT()`

Referensi ini dapat diakses melalui tab **Index Query (Sintaks)** di panel kanan editor.

---

## 📜 Lisensi

Project ini dibuat untuk tujuan pembelajaran.

---

<p align="center">
  <b>Made with ❤️ for SQL Learners</b><br/>
  <a href="https://webelajarsql.vercel.app">webelajarsql.vercel.app</a>
</p>
