export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { fileName, fileText } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: "Falta ANTHROPIC_API_KEY en Vercel"
      });
    }

    const textoCorto = (fileText || fileName || "").slice(0, 3000);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 200,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: `
Sos un asistente que renombra comprobantes de retenciones argentinas.

Del siguiente texto o nombre de archivo extraé:
- emisor
- tipo_retencion
- fecha

Respondé SOLO JSON válido, sin explicación:

{
  "emisor": "nombre limpio",
  "tipo_retencion": "IVA/Ganancias/IIBB/SUSS/Otro",
  "fecha": "YYYY-MM-DD",
  "nuevo_nombre": "emisor - tipo_retencion - fecha.pdf"
}

Archivo:
${fileName}

Texto:
${textoCorto}
`
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: "Error de Anthropic",
        detail: data
      });
    }

    const text = data.content?.[0]?.text || "";

    try {
      const parsed = JSON.parse(text);
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({
        emisor: "SIN_IDENTIFICAR",
        tipo_retencion: "Otro",
        fecha: new Date().toISOString().slice(0, 10),
        nuevo_nombre: `SIN_IDENTIFICAR - Otro - ${new Date().toISOString().slice(0, 10)}.pdf`,
        raw: text
      });
    }

  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Claude tardó demasiado en responder"
      });
    }

    return res.status(500).json({
      error: "Error interno en /api/analyze",
      detail: error.message
    });
  }
}
