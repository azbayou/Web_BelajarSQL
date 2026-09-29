import React, { useState, useEffect } from "react";
import * as duckdb from "@duckdb/duckdb-wasm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import questionDataStatic from "./question.json";
import aiQuestions from "./ai_questions.json";

const questionData = [...questionDataStatic, ...aiQuestions];

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

// Nilai harus sama persis dengan field "difficulty" di question.json
const DIFFICULTIES = ["Beginner", "Intermediate", "Advance"];
const diffKey = (level) => level.toLowerCase();

const FIRST_QUESTION = questionData.find((q) => q.difficulty === "Beginner") || questionData[0];

// Komponen render untuk ReactMarkdown (react-markdown v9 tidak punya prop `inline`,
// jadi blok kode dideteksi lewat className "language-xxx" atau adanya baris baru)
const mdComponents = {
  p: ({ node, ...props }) => <p className="md-p" {...props} />,
  strong: ({ node, ...props }) => <strong className="md-strong" {...props} />,
  ul: ({ node, ...props }) => <ul className="md-ul" {...props} />,
  ol: ({ node, ...props }) => <ol className="md-ol" {...props} />,
  code: ({ node, className, children, ...props }) => {
    const isBlock =
      /language-/.test(className || "") || String(children).includes("\n");
    return (
      <code
        className={isBlock ? "md-code-block" : "md-code-inline"}
        {...props}
      >
        {children}
      </code>
    );
  },
};

// BigInt (hasil COUNT/SUM DuckDB) tidak bisa di-stringify langsung
const serialize = (rows) =>
  JSON.stringify(rows, (key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );

// Ubah hasil query DuckDB jadi array of object.
// Kolom DECIMAL dari DuckDB-WASM datang sebagai angka "tanpa koma" (mis. 1.5 dengan
// scale 3 jadi 1500), jadi di sini dikembalikan ke nilai aslinya.
const rowsFromResult = (result) => {
  const scales = {};
  result.schema.fields.forEach((f) => {
    if (
      f.type &&
      typeof f.type.scale === "number" &&
      typeof f.type.precision === "number"
    ) {
      scales[f.name] = f.type.scale;
    }
  });

  return result.toArray().map((row) => {
    const obj = row.toJSON();
    for (const [name, scale] of Object.entries(scales)) {
      if (obj[name] == null) continue;
      try {
        obj[name] = Number(BigInt(String(obj[name]))) / 10 ** scale;
      } catch (e) {
        // biarkan apa adanya kalau format tidak dikenali
      }
    }
    return obj;
  });
};

// Ambil daftar kolom (nama + tipe) dari string CREATE TABLE
const parseColumns = (createSql) => {
  const start = createSql.indexOf("(");
  const end = createSql.lastIndexOf(")");
  if (start === -1 || end === -1) return [];

  const body = createSql.slice(start + 1, end);
  const parts = [];
  let depth = 0;
  let buf = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf);

  return parts
    .map((p) => {
      const tokens = p.trim().split(/\s+/);
      return { name: tokens[0], type: tokens.slice(1).join(" ") };
    })
    .filter((c) => c.name);
};

export default function App() {
  const [dynamicQuestions, setDynamicQuestions] = useState([...questionDataStatic, ...aiQuestions]);
  // ---------- State UI ----------
  const [activeTab, setActiveTab] = useState("SOAL");
  const [difficulty, setDifficulty] = useState(FIRST_QUESTION.difficulty);
  const [currentId, setCurrentId] = useState(FIRST_QUESTION.questionId);
  const [openTables, setOpenTables] = useState({}); // { namaTabel: true/false }
  const [expectedRows, setExpectedRows] = useState(null); // hasil referenceQuery
  const [sqlSyntaxText, setSqlSyntaxText] = useState("");

  useEffect(() => {
    fetch('/index_sql_sintaks.txt')
      .then(res => res.text())
      .then(text => setSqlSyntaxText(text))
      .catch(err => console.error("Gagal memuat sintaks:", err));
  }, []);

  // ---------- State database & editor ----------
  const [conn, setConn] = useState(null);
  const [isQuestionLoading, setIsQuestionLoading] = useState(true);
  const [query, setQuery] = useState(FIRST_QUESTION.defaultQuery || "");
  const [queryResult, setQueryResult] = useState(
    "Menyiapkan engine database..."
  );

  // ---------- State AI ----------
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // ---------- Turunan ----------
  const currentQuestion =
    dynamicQuestions.find((q) => q.questionId === currentId) || dynamicQuestions[0];
  const filteredQuestions = dynamicQuestions.filter(
    (q) => q.difficulty === difficulty
  );

  // ---------- (A) Nyalakan engine DuckDB sekali saja ----------
  useEffect(() => {
    let cancelled = false;
    let worker = null;

    async function initDB() {
      try {
        const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
        const workerUrl = URL.createObjectURL(
          new Blob([`importScripts("${bundle.mainWorker}");`], {
            type: "text/javascript",
          })
        );

        worker = new Worker(workerUrl);
        const database = new duckdb.AsyncDuckDB(
          new duckdb.ConsoleLogger(),
          worker
        );
        await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(workerUrl);

        if (cancelled) {
          worker.terminate();
          return;
        }

        const connection = await database.connect();
        if (!cancelled) setConn(connection);
      } catch (err) {
        if (!cancelled) {
          setQueryResult(`Gagal memuat database: ${err.message}`);
        }
      }
    }

    initDB();

    return () => {
      cancelled = true;
      if (worker) worker.terminate();
    };
  }, []);

  // ---------- (B) Muat tabel setiap kali soal berganti ----------
  useEffect(() => {
    if (!conn) return;
    let cancelled = false;

    async function loadQuestion() {
      setIsQuestionLoading(true);
      setQueryResult("Menyiapkan data soal...");
      setOpenTables({});
      setExpectedRows(null);
      setShowAiModal(false);
      setAiResponse("");

      try {
        // Buang semua tabel dari soal sebelumnya (nama tabel bisa sama, skema beda)
        const existing = await conn.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
        );
        for (const row of existing.toArray()) {
          await conn.query(`DROP TABLE IF EXISTS "${row.toJSON().table_name}"`);
        }

        // Buat tabel + isi data untuk soal yang dipilih
        for (const table of currentQuestion.tables) {
          await conn.query(table.createSql);
          await conn.query(table.insertSql);
        }

        // Jalankan referenceQuery untuk tabel "Expected Table"
        const refResult = await conn.query(currentQuestion.referenceQuery);
        if (!cancelled) setExpectedRows(rowsFromResult(refResult));

        if (!cancelled) {
          setQuery(currentQuestion.defaultQuery || "");
          setQueryResult("Database Ready! Klik Run untuk melihat hasil.");
        }
      } catch (err) {
        if (!cancelled) {
          setExpectedRows([]);
          setQueryResult(`Gagal memuat soal: ${err.message}`);
        }
      } finally {
        if (!cancelled) setIsQuestionLoading(false);
      }
    }

    loadQuestion();

    return () => {
      cancelled = true;
    };
  }, [conn, currentId]);

  // ---------- Handler: pilih difficulty / soal ----------
  const handleChangeDifficulty = (level) => {
    setDifficulty(level);
    const first = dynamicQuestions.find((q) => q.difficulty === level);
    if (first) setCurrentId(first.questionId);
  };

  const handleSelectQuestion = (id) => {
    setCurrentId(id);
    setActiveTab("SOAL");
  };

  // Soal acak dari difficulty yang sedang dipilih (selain soal saat ini)
  const handleRandomQuestion = () => {
    const pool = filteredQuestions.filter((q) => q.questionId !== currentId);
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    handleSelectQuestion(pick.questionId);
  };

  const toggleTable = (name) =>
    setOpenTables((prev) => ({ ...prev, [name]: !prev[name] }));

  // ---------- Handler: jalankan query ----------
  const handleRunQuery = async () => {
    if (!conn || isQuestionLoading) return;
    setQueryResult("Running...");
    try {
      const result = await conn.query(query);
      const rows = rowsFromResult(result);

      if (rows.length === 0) {
        setQueryResult("Query berhasil, tapi tidak ada data (0 rows).");
      } else {
        setQueryResult(rows);
      }
      if (window.innerWidth < 768) setActiveTab("HASIL");
    } catch (err) {
      setQueryResult(`Error: ${err.message}`);
    }
  };

  // ---------- AI Tutor ----------
  const askTutor = async () => {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-lite-latest",
    });

    const promptText = `
Kamu adalah tutor SQL yang ahli. Muridmu sedang mengerjakan soal ini:
"${currentQuestion.businessCase}"

Skema tabel yang tersedia:
${currentQuestion.tables.map((t) => t.createSql).join("\n")}

Saat ini muridmu menulis query SQL berikut:
\`\`\`sql
${query}
\`\`\`

Tugasmu:
Berikan HINT atau evaluasi atas sintaksnya. JANGAN berikan jawaban kode SQL secara langsung. Bantu dia berpikir langkah selanjutnya atau kasih tau di mana letak kesalahannya secara ramah.
    `;

    const result = await model.generateContent(promptText);
    const response = await result.response;
    return response.text();
  };

    const handleRefreshSoal = async () => {
    if (!GEMINI_API_KEY && !GROQ_API_KEY) {
      alert("API Key Kosong! Cek Environment Variable.");
      return;
    }
    setIsQuestionLoading(true);
    setShowAiModal(true);
    setIsAiLoading(true);
    setAiResponse("Sedang men-generate soal baru dengan AI (mencoba Gemini)...");

    const promptText = `Buatkan 10 soal SQL baru untuk level ${difficulty} dengan format JSON murni.
Formatnya harus persis berupa JSON array berisi 10 object tanpa markdown blok sama sekali. Pastikan setiap soal memiliki "questionId" yang unik, misal ai_1, ai_2, dst.
Contoh struktur 1 soal (buat 10 seperti ini dalam array):
[{
  "questionId": "ai_unique_id_1",
  "title": "Soal Baru: [Judul Bebas]",
  "difficulty": "${difficulty}",
  "businessCase": "Deskripsi studi kasus unik.",
  "tables": [ { "name": "...", "createSql": "CREATE TABLE ...;" } ],
  "referenceQuery": "SELECT ...;"
}]`;

    let text = "";
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const result = await model.generateContent(promptText);
      text = await result.response.text();
    } catch (err) {
      console.warn("Gemini gagal, beralih ke GROQ:", err.message);
      if (GROQ_API_KEY) {
        setAiResponse("Gemini sibuk, beralih ke GROQ AI (openai/gpt-oss-120b)...");
        try {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "openai/gpt-oss-120b",
              messages: [{ role: "user", content: promptText }]
            })
          });
          const data = await res.json();
          if(data.error) throw new Error(data.error.message);
          text = data.choices[0].message.content;
        } catch(groqErr) {
          setAiResponse(`Gagal generate soal dari Gemini maupun Groq: ${groqErr.message}`);
          setIsQuestionLoading(false);
          setIsAiLoading(false);
          return;
        }
      } else {
        setAiResponse(`Gagal generate soal baru: ${err.message}`);
        setIsQuestionLoading(false);
        setIsAiLoading(false);
        return;
      }
    }

    try {
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const newQuestions = JSON.parse(text);
      if (newQuestions && newQuestions.length > 0) {
        setDynamicQuestions(newQuestions);
        setCurrentId(newQuestions[0].questionId);
        setShowAiModal(false);
      }
    } catch (parseErr) {
      setAiResponse("Gagal membaca format JSON dari AI. Coba klik refresh lagi.");
    } finally {
      setIsQuestionLoading(false);
      setIsAiLoading(false);
    }
  };

  const handleTanyaAI = async () => {
    if (!GEMINI_API_KEY) {
      alert(
        "❌ API Key Kosong/Tidak Terbaca! Cek Environment Variable di Netlify."
      );
      return;
    }

    setShowAiModal(true);
    setIsAiLoading(true);
    setAiResponse("");

    try {
      setAiResponse(await askTutor());
    } catch (error) {
      console.error(error);
      setAiResponse(
        "Maaf, gagal menghubungi AI. Pastikan API Key benar dan internet lancar."
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  // ---------- Auto-Grader / Submit ----------
  const handleSubmit = async () => {
    if (!conn || isQuestionLoading) return;

    setShowAiModal(true);
    setIsAiLoading(true);
    setAiResponse("");

    try {
      const userResult = await conn.query(query);
      const userRows = rowsFromResult(userResult);

      const refResult = await conn.query(currentQuestion.referenceQuery);
      const refRows = rowsFromResult(refResult);

      const isCorrect = serialize(userRows) === serialize(refRows);

      if (isCorrect) {
        setAiResponse(
          "🎉 **BENAR SEKALI!**\n\nHasil tabelmu sudah sama persis dengan yang diharapkan. Kamu sudah memahami konsep ini dengan baik."
        );
      } else {
        setAiResponse(
          "❌ **Belum sesuai.**\n\nHasil tabelmu belum sama dengan yang diharapkan. Cek lagi kolom, urutan, dan kondisi filter-mu."
          );
        }
      } catch (err) {
      setAiResponse(
        `❌ **Terdapat Error Sintaks SQL:**\n\n\`${err.message}\`\n\nCoba periksa lagi penulisanmu.`
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const tabClass = (tab) => `tab${activeTab === tab ? " active" : ""}`;

  return (
    <div className="app">
      {/* ---------- Header ---------- */}
      <header className="header">
        <div className="header-left">
          <div>
            <h1 className="app-title">SQL-AI Academy</h1>
            <p className="app-subtitle">{currentQuestion.title}</p>
          </div>
        </div>
        <span
          className={`badge badge-${diffKey(currentQuestion.difficulty)}`}
        >
          {currentQuestion.difficulty}
        </span>
      </header>

      {/* ---------- Tab mobile ---------- */}
      <div className="tabs">
        <button onClick={() => setActiveTab("SOAL")} className={tabClass("SOAL")}>
          📖 Soal & Data
        </button>
        <button onClick={() => setActiveTab("SINTAKS")} className={tabClass("SINTAKS")}>
          📘 Sintaks SQL
        </button>
        <button onClick={() => setActiveTab("SQL")} className={tabClass("SQL")}>
          💻 Tulis SQL
        </button>
        <button
          onClick={() => setActiveTab("HASIL")}
          className={tabClass("HASIL")}
        >
          📊 Hasil
        </button>
      </div>

      <main className="main">
        {/* ---------- Panel kiri: soal & data ---------- */}
        <div className={`panel-left${activeTab === "SOAL" ? " active" : ""}`}>
          {/* Pilihan difficulty */}
          <div className="difficulty-tabs">
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                onClick={() => handleChangeDifficulty(level)}
                className={`difficulty-btn${
                  difficulty === level ? ` active-${diffKey(level)}` : ""
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Daftar soal sesuai difficulty */}
          <div className="question-list">
            {filteredQuestions.map((q, i) => (
              <button
                key={q.questionId}
                disabled={isQuestionLoading}
                onClick={() => handleSelectQuestion(q.questionId)}
                className={`question-item${
                  q.questionId === currentId ? " active" : ""
                }`}
              >
                {i + 1}. {q.title}
              </button>
            ))}
          </div>

          <button
            onClick={handleRandomQuestion}
            disabled={isQuestionLoading || filteredQuestions.length < 2}
            className="btn-random"
          >
            🔀 Soal Acak ({difficulty})
          </button>

          <button
            onClick={handleRefreshSoal}
            disabled={isQuestionLoading}
            className="btn-random"
            style={{ marginTop: "10px", backgroundColor: "#007bff", color: "white" }}
          >
            ?? Refresh Soal Baru (AI)
          </button>

          <hr className="divider" />

          <h2 className="question-title">{currentQuestion.title}</h2>
          <p className="question-case">{currentQuestion.businessCase}</p>

          <div className="section">
            <h3 className="section-title">Schema Explorer</h3>
            {currentQuestion.tables.map((table) => {
              const columns = parseColumns(table.createSql);
              const isOpen = !!openTables[table.name];
              return (
                <div key={table.name} className="table-card">
                  <button
                    type="button"
                    className="table-card-header"
                    onClick={() => toggleTable(table.name)}
                    aria-expanded={isOpen}
                  >
                    <span>
                      {isOpen ? "📂" : "📁"} {table.name}
                    </span>
                    <span className="column-count">
                      {columns.length} kolom {isOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="column-list">
                      {columns.map((col) => (
                        <div key={col.name} className="column-row">
                          <span className="column-name">{col.name}</span>
                          <span className="column-type">{col.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="section">
            <h3 className="section-title">Expected Table</h3>
            {expectedRows === null ? (
              <p className="helper-text">Menyiapkan tabel referensi...</p>
            ) : expectedRows.length === 0 ? (
              <p className="helper-text">Tabel referensi tidak tersedia.</p>
            ) : (
              <>
                <div className="target-wrapper">
                  <table className="target-table">
                    <thead>
                      <tr>
                        {Object.keys(expectedRows[0]).map((colName) => (
                          <th key={colName}>{colName}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {expectedRows.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j}>{String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="helper-text">
                  Hasil querymu harus sama dengan tabel ini (nama kolom, nilai,
                  dan urutan baris).
                </p>
              </>
            )}
          </div>
        </div>

        {/* ---------- Panel kanan: editor & hasil ---------- */}
                <div className="panel-right">
          <div className="desktop-tabs" style={{display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb'}}>
            <button onClick={() => setActiveTab("SQL")} className={tabClass("SQL")} style={{flex: 1, padding: '10px', border: 'none', background: activeTab !== "SINTAKS" ? '#e0f2fe' : 'transparent', cursor: 'pointer', fontWeight: 'bold'}}>💻 Tulis SQL</button>
            <button onClick={() => setActiveTab("SINTAKS")} className={tabClass("SINTAKS")} style={{flex: 1, padding: '10px', border: 'none', background: activeTab === "SINTAKS" ? '#e0f2fe' : 'transparent', cursor: 'pointer', fontWeight: 'bold'}}>📓 Index Query (Sintaks)</button>
          </div>
          {activeTab === "SINTAKS" ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", backgroundColor: "#1e1e1e" }}>
              <div className="editor-header" style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #333", color: "#ccc", fontWeight: "bold" }}>
                📘 Referensi Sintaks SQL (Bisa diedit di /public/index_sql_sintaks.txt)
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                <CodeMirror
                  value={sqlSyntaxText}
                  height="100%"
                  extensions={[sql()]}
                  theme={vscodeDark}
                  readOnly={true}
                  editable={false}
                />
              </div>
            </div>
          ) : (
            <>
              <div className={`editor-pane${activeTab === "SQL" ? " active" : ""}`}>
                <div className="editor-header">SQL Editor (DuckDB)</div>
                <textarea
                  className="sql-textarea"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  spellCheck={false}
                />
              </div>

          <div
            className={`result-pane${activeTab === "HASIL" ? " active" : ""}`}
          >
            <div className="result-header">
              <span>Output Console</span>
              <span className="status">
                <span className="status-dot"></span>{" "}
                {conn ? "Ready" : "Booting..."}
              </span>
            </div>
            <div className="result-body">
              {Array.isArray(queryResult) ? (
                <table className="result-table">
                  <thead>
                    <tr>
                      {Object.keys(queryResult[0] || {}).map((colName) => (
                        <th key={colName}>{colName}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val, j) => (
                          <td key={j}>{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="result-message">{queryResult}</div>
              )}
            </div>
          </div>
            </>
          )}
        </div>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="footer">
                <button onClick={handleTanyaAI} className="btn-ai">
          ? Tanya AI
        </button>
        <button
          onClick={() => {
            setAiResponse("Kunci Jawaban:\n\n`sql\n" + currentQuestion.referenceQuery + "\n`");
            setShowAiModal(true);
          }}
          className="btn-ai"
          style={{ backgroundColor: "#f39c12", marginLeft: "10px" }}
        >
          ?? Cheat Code
        </button>
        <button
          onClick={handleRunQuery}
          disabled={!conn || isQuestionLoading}
          className="btn btn-run"
        >
          ▶ Run
        </button>
        <button
          onClick={handleSubmit}
          disabled={!conn || isQuestionLoading}
          className="btn btn-submit"
        >
          Submit 🚀
        </button>
      </footer>

      {/* ---------- Pop-up modal AI ---------- */}
      {showAiModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">✨ AI Tutor</h3>
              <button
                onClick={() => setShowAiModal(false)}
                className="modal-close"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              {isAiLoading ? (
                <div className="modal-loading">
                  AI sedang mengevaluasi kodemu...
                </div>
              ) : (
                <div className="modal-content">
                  <ReactMarkdown components={mdComponents}>
                    {aiResponse}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowAiModal(false)}
                className="btn-close"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Trigger Vercel rebuild for env var

// Trigger rebuild for new project env var















