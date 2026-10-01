import codecs

with codecs.open('scripts/generateSoal.js', 'r', 'utf-8') as f:
    content = f.read()

groq_fallback = """    let responseText = "";
    try {
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    } catch (err) {
      console.warn(`[${new Date().toLocaleString()}] Gemini gagal (${err.message}), beralih ke GROQ...`);
      if (process.env.GROQ_API_KEY) {
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
        responseText = data.choices[0].message.content;
      } else {
        throw err;
      }
    }"""

content = content.replace("    const result = await model.generateContent(prompt);\n    const responseText = result.response.text();", groq_fallback)
content = content.replace("    const result = await model.generateContent(prompt);\r\n    const responseText = result.response.text();", groq_fallback)

with codecs.open('scripts/generateSoal.js', 'w', 'utf-8') as f:
    f.write(content)
