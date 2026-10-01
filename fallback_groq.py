import codecs
import re

with codecs.open('src/App.jsx', 'r', 'utf-8') as f:
    content = f.read()

content = content.replace(
    'const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;',
    'const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;\nconst GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;'
)

ask_tutor_logic = """    const askTutor = async () => {
      const promptText = `
  Kamu adalah tutor SQL yang ahli. Muridmu sedang mengerjakan soal ini:
  "${currentQuestion.businessCase}"
  
  Skema tabel yang tersedia:
  ${currentQuestion.tables.map((t) => t.createSql).join("\\n")}
  
  Saat ini muridmu menulis query SQL berikut:
  \\`\\`\\`sql
  ${query}
  \\`\\`\\`
  
  Tugasmu:
  Berikan HINT atau evaluasi atas sintaksnya. JANGAN berikan jawaban kode SQL secara langsung. Bantu dia berpikir langkah selanjutnya atau kasih tau di mana letak kesalahannya secara ramah.
      `;
      
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const result = await model.generateContent(promptText);
        const response = await result.response;
        return response.text();
      } catch (err) {
        if (GROQ_API_KEY) {
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
          return data.choices[0].message.content;
        }
        throw err;
      }
    };"""
content = re.sub(r'    const askTutor = async \(\) => \{.*?\n    const handleTanyaAI', ask_tutor_logic + '\n\n    const handleTanyaAI', content, flags=re.DOTALL)

refresh_logic = """  const handleRefreshSoal = async () => {
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
  };"""

content = re.sub(r'  const handleRefreshSoal = async \(\) => \{.*?\n  const handleTanyaAI', refresh_logic + '\n\n  const handleTanyaAI', content, flags=re.DOTALL)

with codecs.open('src/App.jsx', 'w', 'utf-8') as f:
    f.write(content)
