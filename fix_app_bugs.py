import codecs
import re

with codecs.open('src/App.jsx', 'r', 'utf-8') as f:
    content = f.read()

# 1. LocalStorage for dynamicQuestions
old_state = 'const [dynamicQuestions, setDynamicQuestions] = useState([...questionDataStatic, ...aiQuestions]);'
new_state = '''const [dynamicQuestions, setDynamicQuestions] = useState(() => {
    try {
      const saved = localStorage.getItem("savedQuestions");
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return [...questionDataStatic, ...aiQuestions];
  });
  
  useEffect(() => {
    localStorage.setItem("savedQuestions", JSON.stringify(dynamicQuestions));
  }, [dynamicQuestions]);'''
content = content.replace(old_state, new_state)

# 2. Fix JSON Parsing and token limits in handleRefreshSoal
old_refresh = r'    const promptText = `Buatkan 10 soal SQL baru.*?const newQuestions = JSON.parse\(text\);'
new_refresh = r'''    const promptText = `Buatkan 5 soal SQL baru untuk level ${difficulty} dengan format JSON murni.
Formatnya harus persis berupa JSON array berisi 5 object tanpa markdown blok sama sekali. Pastikan setiap soal memiliki "questionId" yang unik, misal ai_1, ai_2, dst.
Contoh struktur 1 soal (buat 5 seperti ini dalam array):
[{
  "questionId": "ai_unique_id_1",
  "title": "Soal Baru: [Judul Bebas]",
  "difficulty": "${difficulty}",
  "businessCase": "Deskripsi studi kasus unik.",
  "tables": [ { "name": "...", "createSql": "CREATE TABLE ...;", "insertSql": "INSERT INTO ... VALUES (...);" } ],
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
      // Robust JSON Extraction
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("JSON Array tidak ditemukan di dalam output AI");
      const jsonText = match[0];
      const newQuestions = JSON.parse(jsonText);'''

content = re.sub(old_refresh, new_refresh, content, flags=re.DOTALL)

# 3. Replace textarea with CodeMirror
old_textarea = '''<div className="editor-header">SQL Editor (DuckDB)</div>
                  <textarea
                    className="sql-textarea"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    spellCheck={false}
                  />'''
new_textarea = '''<div className="editor-header">SQL Editor (DuckDB)</div>
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <CodeMirror
                      value={query}
                      height="100%"
                      extensions={[sql()]}
                      theme={vscodeDark}
                      onChange={(val) => setQuery(val)}
                      basicSetup={{ tabSize: 2, defaultKeymap: true, indentOnInput: true }}
                    />
                  </div>'''
content = content.replace(old_textarea, new_textarea)

# Fix indentation in handleRefreshSoal for setDynamicQuestions merging
content = content.replace('setDynamicQuestions(newQuestions);', 'setDynamicQuestions((prev) => [...newQuestions, ...prev]);')


with codecs.open('src/App.jsx', 'w', 'utf-8') as f:
    f.write(content)
