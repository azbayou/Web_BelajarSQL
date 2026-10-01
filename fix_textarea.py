import codecs
import re

with codecs.open('src/App.jsx', 'r', 'utf-8') as f:
    content = f.read()

new_textarea = """<div className="editor-header">SQL Editor (DuckDB)</div>
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <CodeMirror
                      value={query}
                      height="100%"
                      extensions={[sql()]}
                      theme={vscodeDark}
                      onChange={(val) => setQuery(val)}
                      basicSetup={{ tabSize: 2, defaultKeymap: true, indentOnInput: true }}
                      style={{ fontSize: "14px" }}
                    />
                  </div>"""

content = re.sub(r'<div className="editor-header">SQL Editor \(DuckDB\)</div>\s*<textarea\s*className="sql-textarea"\s*value=\{query\}\s*onChange=\{\(e\) => setQuery\(e\.target\.value\)\}\s*spellCheck=\{false\}\s*/>', new_textarea, content, flags=re.DOTALL)

with codecs.open('src/App.jsx', 'w', 'utf-8') as f:
    f.write(content)
