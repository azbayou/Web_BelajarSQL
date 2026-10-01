import codecs
import re

with codecs.open('scripts/generateSoal.js', 'r', 'utf-8') as f:
    content = f.read()

groq_fallback = """
    let text = "";
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.1-pro" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      text = response.text();
    } catch (err) {
      console.warn(`[${new Date().toLocaleString()}] Gemini gagal (${err.message}), beralih ke GROQ...`);
      if (process.env.GROQ_API_KEY) {
        const fetch = (await import('node-fetch')).default || globalThis.fetch;
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            messages: [{ role: "user", content: prompt }]
          })
        });
        const data = await res.json();
        if(data.error) throw new Error(data.error.message);
        text = data.choices[0].message.content;
      } else {
        throw err;
      }
    }
"""

content = re.sub(r'    const genAI = new GoogleGenerativeAI\(process\.env\.GEMINI_API_KEY\);\s*const model = genAI\.getGenerativeModel\(\{ model: "gemini-2\.1-pro" \}\);\s*const result = await model\.generateContent\(prompt\);\s*const response = await result\.response;\s*const text = response\.text\(\);', groq_fallback.strip(), content, flags=re.DOTALL)

with codecs.open('scripts/generateSoal.js', 'w', 'utf-8') as f:
    f.write(content)
