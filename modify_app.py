import re
import codecs

with codecs.open('src/App.jsx', 'r', 'utf-8') as f:
    content = f.read()

content = content.replace('?? Tanya AI', '? Tanya AI')
content = content.replace('?? Cheat Code', '?? Cheat Code')
content = content.replace('const questionData = [...questionDataStatic, ...aiQuestions];', 'const [dynamicQuestions, setDynamicQuestions] = useState([...questionDataStatic, ...aiQuestions]);')
content = content.replace('questionData.filter(', 'dynamicQuestions.filter(')

refresh_logic = '''
  const handleRefreshSoal = async () => {
    if (!GEMINI_API_KEY) {
      alert("API Key Kosong! Cek Environment Variable.");
      return;
    }
    setIsQuestionLoading(true);
    setShowAiModal(true);
    setIsAiLoading(true);
    setAiResponse("Sedang men-generate soal baru dengan AI (gemini-2.1-pro)...");

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.1-pro" });

      const promptText = 
        Buatkan 1 soal SQL baru untuk level  + "" +  dengan format JSON murni.
        Formatnya harus persis seperti ini (hanya JSON array tanpa markdown):
        [{
          "questionId": "ai_ + "" + ",
          "title": "Soal Baru: [Judul Bebas]",
          "difficulty": " + "" + ",
          "businessCase": "Deskripsi studi kasus.",
          "tables": [ { "name": "...", "createSql": "CREATE TABLE ...;" } ],
          "referenceQuery": "SELECT ...;"
        }]
      ;

      const result = await model.generateContent(promptText);
      let text = await result.response.text();
      text = text.replace(/`json/g, "").replace(/`/g, "").trim();
      
      const newQuestions = JSON.parse(text);
      if (newQuestions && newQuestions.length > 0) {
        setDynamicQuestions(newQuestions);
        setCurrentId(newQuestions[0].questionId);
        setShowAiModal(false);
      }
    } catch (err) {
      console.error(err);
      setAiResponse("Gagal generate soal baru: " + err.message);
    } finally {
      setIsQuestionLoading(false);
      setIsAiLoading(false);
    }
  };

  const handleTanyaAI
'''
content = content.replace('const handleTanyaAI', refresh_logic.strip())

refresh_btn = '''
          <button
            onClick={handleRefreshSoal}
            disabled={isQuestionLoading}
            className="btn-random"
            style={{ marginTop: "10px", backgroundColor: "#007bff", color: "white" }}
          >
            ?? Refresh Soal Baru (AI)
          </button>

          <hr className="divider" />
'''
content = content.replace('<hr className="divider" />', refresh_btn.strip())

toggle_btn = '''
        <div className="panel-right">
          <div className="desktop-tabs" style={{display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb'}}>
            <button onClick={() => setActiveTab("SQL")} className={tabClass("SQL")} style={{flex: 1, padding: '10px', border: 'none', background: activeTab !== "SINTAKS" ? '#e0f2fe' : 'transparent', cursor: 'pointer', fontWeight: 'bold'}}>?? Tulis SQL</button>
            <button onClick={() => setActiveTab("SINTAKS")} className={tabClass("SINTAKS")} style={{flex: 1, padding: '10px', border: 'none', background: activeTab === "SINTAKS" ? '#e0f2fe' : 'transparent', cursor: 'pointer', fontWeight: 'bold'}}>?? Index Query (Sintaks)</button>
          </div>
          {activeTab === "SINTAKS" ? (
'''
content = content.replace('        <div className="panel-right">\\r\\n          {activeTab === "SINTAKS" ? (', toggle_btn.strip())
content = content.replace('        <div className="panel-right">\\n          {activeTab === "SINTAKS" ? (', toggle_btn.strip())
content = content.replace('        <div className="panel-right">\\n          {activeTab === \\"SINTAKS\\" ? (', toggle_btn.strip())

with codecs.open('src/App.jsx', 'w', 'utf-8') as f:
    f.write(content)
