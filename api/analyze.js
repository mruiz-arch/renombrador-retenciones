export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { fileName, fileText } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Falta OPENAI_API_KEY" });
    }

    const texto = (fileText || fileName || "").slice(0, 4000);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "user",
            content: `
Analizá este comprobante de retención argentino.

Extraé:
- emisor
- tipo_retencion
- fecha

Respondé SOLO JSON:

{
 "emisor":"...",
 "tipo_retencion":"...",
 "fecha":"YYYY-MM-DD",
 "nuevo_nombre":"emisor - tipo_retencion - fecha.pdf"
}

Archivo: ${fileName}

Texto: ${texto}
`
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json(data);
    }

    const text = data.choices?.[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(text);
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({
        emisor: "SIN_IDENTIFICAR",
        tipo_retencion: "Otro",
        fecha: new Date().toISOString().slice(0,10),
        nuevo_nombre: "archivo-renombrado.pdf",
        raw: text
      });
    }

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
