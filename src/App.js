import React, { useState, useEffect } from "react";
import * as duckdb from "@duckdb/duckdb-wasm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import questionData from "./question.json";

const currentQuestion = questionData[0];
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

export default function App() {
  const [activeTab, setActiveTab] = useState("SOAL");
  const [query, setQuery] = useState("SELECT * FROM shipments;");
  const [db, setDb] = useState(null);
  const [conn, setConn] = useState(null);
  const [queryResult, setQueryResult] = useState(
    "Menyiapkan engine database..."
  );

  // State AI
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let worker = null;
    let database = null;

    async function initDB() {
      try {
        const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
        const workerUrl = URL.createObjectURL(
          new Blob([`importScripts("${bundle.mainWorker}");`], {
            type: "text/javascript",
          })
        );

        const worker = new Worker(workerUrl);
        const database = new duckdb.AsyncDuckDB(
          new duckdb.ConsoleLogger(),
          worker
        );
        await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(workerUrl);

        const connection = await database.connect();

        // Eksekusi pembuatan tabel dan insert data secara dinamis dari JSON
        for (const table of currentQuestion.tables) {
          await connection.query(table.createSql);
          await connection.query(table.insertSql);
        }

        if (!cancelled) {
          setDb(database);
          setConn(connection);
          setQueryResult("Database Ready! Klik Run untuk melihat hasil.");
        }
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

  const handleRunQuery = async () => {
    if (!conn) return;
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

  const handleTanyaAI = async () => {
    if (!GEMINI_API_KEY) {
      alert("Oops! Kamu belum memasukkan API Key di Environment Variables.");
      return;
    }

    setShowAiModal(true);
    setIsAiLoading(true);
    setAiResponse("");

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-3.5-flash",
      });

      const promptText = `
Kamu adalah tutor SQL yang ahli. Muridmu sedang mengerjakan soal ini:
"${currentQuestion.businessCase}"

Skema tabel yang tersedia:
${currentQuestion.tables.map(t => `- ${t.name}`).join('\n')}

Saat ini muridmu menulis query SQL berikut:
\`\`\`sql
${query}
\`\`\`

Tugasmu:
Berikan HINT atau evaluasi atas sintaksnya. JANGAN berikan jawaban kode SQL secara langsung. Bantu dia berpikir langkah selanjutnya atau kasih tau di mana letak kesalahannya secara ramah.
      `;

      const result = await model.generateContent(promptText);
      const response = await result.response;
      setAiResponse(response.text());
    } catch (error) {
      console.error(error);
      setAiResponse(
        "Maaf, gagal menghubungi AI. Pastikan API Key benar dan internet lancar."
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  // FUNGSI BARU: Auto-Grader / Submit
  const handleSubmit = async () => {
    if (!conn) return;

    setShowAiModal(true);
    setIsAiLoading(true);
    setAiResponse("");

    try {
      const userResult = await conn.query(query);
      const userRows = userResult.toArray().map((row) => row.toJSON());

      // Kunci jawaban sementara (Hardcoded untuk contoh)
      const referenceQuery = currentQuestion.referenceQuery;
      const refResult = await conn.query(referenceQuery);
      const refRows = refResult.toArray().map((row) => row.toJSON());

      const isCorrect =
        JSON.stringify(userRows, (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        ) ===
        JSON.stringify(refRows, (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        );

      if (isCorrect) {
        setIsAiLoading(false);
        setAiResponse(
          "🎉 **BENAR SEKALI!**\n\nHasil tabelmu sudah sama persis dengan yang diharapkan. Kamu sudah memahami konsep ini dengan baik."
        );
      } else {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: "gemini-3.5-flash-lite",
        });

        const promptText = `
          Kamu adalah tutor SQL yang ahli. Muridmu sedang mengerjakan soal ini:
          "${currentQuestion.businessCase}"

          Saat ini muridmu menulis query SQL berikut:
          \`\`\`sql
          ${query}
          \`\`\`

          Tugasmu:
          Berikan HINT atau evaluasi atas sintaksnya. JANGAN berikan jawaban kode SQL secara langsung. Bantu dia berpikir langkah selanjutnya atau kasih tau di mana letak kesalahannya secara ramah.
      `;

        const result = await model.generateContent(promptText);
        const response = await result.response;
        setAiResponse(response.text());
        setIsAiLoading(false);
      }
    } catch (err) {
      setIsAiLoading(false);
      setAiResponse(
        `❌ **Terdapat Error Sintaks SQL:**\n\n\`${err.message}\`\n\nCoba periksa lagi penulisanmu.`
      );
    }
  };

  const tabClass = (tab) =>
    `flex-1 py-3 text-sm font-semibold text-center border-b-2 ${
      activeTab === tab
        ? "border-blue-600 text-blue-600"
        : "border-transparent text-gray-500"
    }`;

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans relative">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center shrink-0">
        <div>
          <h1 className="font-bold text-lg">SQL-AI Academy</h1>
          <p className="text-sm text-gray-500">
            On-Time Delivery Rate & SLA Breach
          </p>
        </div>
        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-200">
          Intermediate
        </span>
      </header>

      <div className="md:hidden flex bg-white border-b border-gray-200 shrink-0">
        <button
          onClick={() => setActiveTab("SOAL")}
          className={tabClass("SOAL")}
        >
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

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div
          className={`w-full md:w-1/3 bg-white p-5 overflow-y-auto ${
            activeTab === "SOAL" ? "block" : "hidden md:block"
          }`}
        >
          <h2 className="text-lg font-bold mb-2">{currentQuestion.title}</h2>
          <p className="text-gray-600 text-sm mb-4 leading-relaxed">
            {currentQuestion.businessCase}
          </p>
          <div className="mt-6">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">
              Schema Explorer
            </h3>
            {/* Render nama tabel otomatis dari JSON */}
            {currentQuestion.tables.map((table, index) => (
              <div key={index} className="border rounded-lg mb-3">
                <div className="bg-gray-100 px-3 py-2 text-sm font-bold flex justify-between items-center cursor-pointer">
                  <span>📁 {table.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full md:w-2/3 flex flex-col flex-1 min-h-0 md:border-l border-gray-200">
          <div
            className={`flex-1 min-h-0 flex-col bg-gray-900 ${
              activeTab === "SQL" ? "flex" : "hidden md:flex"
            }`}
          >
            <div className="bg-gray-800 text-gray-400 text-xs px-4 py-2 uppercase font-semibold">
              SQL Editor (DuckDB)
            </div>
            <textarea
              className="flex-1 bg-gray-900 text-green-400 font-mono p-4 outline-none resize-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
            />
          </div>

          <div
            className={`flex-col bg-white border-t md:h-1/2 ${
              activeTab === "HASIL"
                ? "flex flex-1 md:flex-none"
                : "hidden md:flex"
            }`}
          >
            <div className="bg-gray-100 text-gray-500 text-xs px-4 py-2 uppercase font-semibold flex justify-between">
              <span>Output Console</span>
              <span className="text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>{" "}
                {conn ? "Ready" : "Booting..."}
              </span>
            </div>
            <div className="flex-1 overflow-auto bg-white relative">
              {Array.isArray(queryResult) ? (
                <table className="min-w-full text-left text-sm whitespace-nowrap border-collapse">
                  <thead className="sticky top-0 bg-gray-50 shadow-sm z-10">
                    <tr>
                      {Object.keys(queryResult[0] || {}).map((colName) => (
                        <th
                          key={colName}
                          className="px-4 py-2 font-bold text-gray-700 border-b"
                        >
                          {colName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b hover:bg-orange-50 transition-colors"
                      >
                        {Object.values(row).map((val, j) => (
                          <td
                            key={j}
                            className="px-4 py-2 text-gray-600 font-mono text-xs"
                          >
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 flex items-center justify-center h-full text-gray-500 text-sm font-mono whitespace-pre-wrap">
                  {queryResult}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t p-3 md:p-4 flex justify-between md:justify-end gap-3 shrink-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button
          onClick={handleTanyaAI}
          className="md:mr-auto flex items-center gap-2 text-purple-600 border border-purple-200 bg-purple-50 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-purple-100 transition-colors"
        >
          ✨ Tanya AI
        </button>
        <button
          onClick={handleRunQuery}
          disabled={!conn}
          className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-semibold text-sm border hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          ▶ Run
        </button>
        <button
          onClick={handleSubmit}
          disabled={!conn}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold text-sm shadow-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          Submit 🚀
        </button>
      </footer>

      {/* POP-UP MODAL AI */}
      {showAiModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="bg-purple-600 text-white px-4 py-3 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">✨ AI Tutor</h3>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-white hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-5 overflow-y-auto text-gray-700 text-sm flex-1">
              {isAiLoading ? (
                <div className="flex items-center justify-center h-20 text-purple-600 font-semibold animate-pulse">
                  AI sedang mengevaluasi kodemu...
                </div>
              ) : (
                <div className="text-gray-700 text-sm leading-relaxed space-y-3">
                  <ReactMarkdown
                    components={{
                      p: ({ node, ...props }) => (
                        <p className="mb-2" {...props} />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong
                          className="font-bold text-purple-800"
                          {...props}
                        />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul
                          className="list-disc pl-5 mb-2 space-y-1"
                          {...props}
                        />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol
                          className="list-decimal pl-5 mb-2 space-y-1"
                          {...props}
                        />
                      ),
                      code: ({ node, inline, ...props }) =>
                        inline ? (
                          <code
                            className="bg-gray-100 text-pink-600 px-1 py-0.5 rounded font-mono text-xs"
                            {...props}
                          />
                        ) : (
                          <code
                            className="block bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs overflow-x-auto mb-2"
                            {...props}
                          />
                        ),
                    }}
                  >
                    {aiResponse}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            <div className="bg-gray-50 px-4 py-3 border-t text-right">
              <button
                onClick={() => setShowAiModal(false)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700"
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
