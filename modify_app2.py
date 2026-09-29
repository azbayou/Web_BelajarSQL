import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

toggle_btn = '''        <div className="panel-right">
          <div className="desktop-tabs" style={{display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb'}}>
            <button onClick={() => setActiveTab("SQL")} className={tabClass("SQL")} style={{flex: 1, padding: '10px', border: 'none', background: activeTab !== "SINTAKS" ? '#e0f2fe' : 'transparent', cursor: 'pointer', fontWeight: 'bold'}}>?? Tulis SQL</button>
            <button onClick={() => setActiveTab("SINTAKS")} className={tabClass("SINTAKS")} style={{flex: 1, padding: '10px', border: 'none', background: activeTab === "SINTAKS" ? '#e0f2fe' : 'transparent', cursor: 'pointer', fontWeight: 'bold'}}>?? Index Query (Sintaks)</button>
          </div>
          {activeTab === "SINTAKS" ? ('''

content = re.sub(r'<div className="panel-right">\s*\{activeTab === "SINTAKS" \? \(', toggle_btn, content)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
