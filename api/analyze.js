export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { fileName, fileText } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Falta ANTHROPIC_API_KEY en Vercel" });
    }

    if (!fileText && !fileName) {
      return res.status(400).json({ error: "No se recibió texto del PDF" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60 segundos

    const prompt = `
Analizá este comprobante de retención argentino.

Necesito que devuelvas SOLO un JSON válido con este formato:

{
  "emisor": "nombre del emisor",
  "tipo_retencion": "IVA/Ganancias/IIBB/SUSS/Otro",
  "fecha": "YYYY-MM-DD",
  "nuevo_nombre": "emisor - tipo_retencion - fecha.pdf"
}

Nombre original del archivo:
${fileName}

Texto extraído del PDF:
${fileText}
`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 500,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({
        error: "Error de Anthropic",
        detail: errorText
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error: "Claude no devolvió JSON válido",
        raw: text
      });
    }

    return res.status(200).json(parsed);

  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Claude tardó demasiado en responder. Intentá con otro PDF o texto más corto."
      });
    }

    return res.status(500).json({
      error: "Error interno en /api/analyze",
      detail: error.message
    });
  }
}
