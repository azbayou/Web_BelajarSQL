import React, { useState, useEffect } from "react";
import * as duckdb from "@duckdb/duckdb-wasm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import questionData from "./question.json";

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

// Nilai harus sama persis dengan field "difficulty" di question.json
const DIFFICULTIES = ["Beginner", "Intermediate", "Advance"];
const diffKey = (level) => level.toLowerCase();

const FIRST_QUESTION =
  questionData.find((q) => q.difficulty === "Beginner") || questionData[0];

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

export default function App() {
  // ---------- State UI ----------
  const [activeTab, setActiveTab] = useState("SOAL");
  const [difficulty, setDifficulty] = useState(FIRST_QUESTION.difficulty);
  const [currentId, setCurrentId] = useState(FIRST_QUESTION.questionId);

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
    questionData.find((q) => q.questionId === currentId) || questionData[0];
  const filteredQuestions = questionData.filter(
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

        if (!cancelled) {
          setQuery(currentQuestion.defaultQuery || "");
          setQueryResult("Database Ready! Klik Run untuk melihat hasil.");
        }
      } catch (err) {
        if (!cancelled) setQueryResult(`Gagal memuat soal: ${err.message}`);
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
    const first = questionData.find((q) => q.difficulty === level);
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

  // ---------- Handler: jalankan query ----------
  const handleRunQuery = async () => {
    if (!conn || isQuestionLoading) return;
    setQueryResult("Running...");
    try {
      const result = await conn.query(query);
      const rows = result.toArray().map((row) => row.toJSON());

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
      const userRows = userResult.toArray().map((row) => row.toJSON());

      const refResult = await conn.query(currentQuestion.referenceQuery);
      const refRows = refResult.toArray().map((row) => row.toJSON());

      const isCorrect = serialize(userRows) === serialize(refRows);

      if (isCorrect) {
        setAiResponse(
          "🎉 **BENAR SEKALI!**\n\nHasil tabelmu sudah sama persis dengan yang diharapkan. Kamu sudah memahami konsep ini dengan baik."
        );
      } else if (!GEMINI_API_KEY) {
        setAiResponse(
          "❌ **Belum sesuai.**\n\nHasil tabelmu belum sama dengan yang diharapkan. Cek lagi kolom, urutan, dan kondisi filter-mu."
        );
      } else {
        setAiResponse(await askTutor());
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

          <hr className="divider" />

          <h2 className="question-title">{currentQuestion.title}</h2>
          <p className="question-case">{currentQuestion.businessCase}</p>

          <div className="section">
            <h3 className="section-title">Schema Explorer</h3>
            {currentQuestion.tables.map((table) => (
              <div key={table.name} className="table-card">
                <div className="table-card-header">
                  <span>📁 {table.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- Panel kanan: editor & hasil ---------- */}
        <div className="panel-right">
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
        </div>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="footer">
        <button onClick={handleTanyaAI} className="btn-ai">
          ✨ Tanya AI
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