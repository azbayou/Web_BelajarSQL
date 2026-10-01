import codecs
import re

file_path = 'src/App.jsx'
with codecs.open(file_path, 'r', 'utf-8') as f:
    content = f.read()

# 1. State for solvedQuestions
if 'const [solvedQuestions, setSolvedQuestions]' not in content:
    old_state = '  // ---------- State UI ----------'
    new_state = '''  // ---------- State UI ----------
  const [solvedQuestions, setSolvedQuestions] = useState(() => {
    try {
      const saved = localStorage.getItem("solvedQuestions");
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return {};
  });'''
    content = content.replace(old_state, new_state)

# 2. Update handleSubmit
if 'const newSolved =' not in content:
    old_submit = '''      if (isCorrect) {
        setAiResponse(
          "🎉 **BENAR SEKALI!**\\n\\nHasil tabelmu sudah sama persis dengan yang diharapkan. Kamu sudah memahami konsep ini dengan baik."
        );'''
    new_submit = '''      if (isCorrect) {
        const newSolved = { ...solvedQuestions, [currentId]: true };
        setSolvedQuestions(newSolved);
        localStorage.setItem("solvedQuestions", JSON.stringify(newSolved));
        setAiResponse(
          "🎉 **BENAR SEKALI!**\\n\\nHasil tabelmu sudah sama persis dengan yang diharapkan. Kamu sudah memahami konsep ini dengan baik."
        );'''
    content = content.replace(old_submit, new_submit)

# 3. Dropdown UI
if '<select' not in content:
    old_ui = r'<div className="question-list">.*?</div>'
    new_ui = '''<div className="question-list" style={{ margin: "10px 0" }}>
            <select
              value={currentId}
              onChange={(e) => handleSelectQuestion(e.target.value)}
              disabled={isQuestionLoading}
              className="question-dropdown"
              style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ccc", fontSize: "16px", cursor: "pointer", backgroundColor: "#f8f9fa", outline: "none" }}
            >
              {filteredQuestions.map((q, i) => (
                <option key={q.questionId} value={q.questionId}>
                  {solvedQuestions[q.questionId] ? "✅ " : ""}{i + 1}. {q.title}
                </option>
              ))}
            </select>
          </div>'''
    content = re.sub(old_ui, new_ui, content, flags=re.DOTALL)

with codecs.open(file_path, 'w', 'utf-8') as f:
    f.write(content)

print("Restored UI changes.")
