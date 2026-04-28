export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { pdfBase64 } = req.body;
  if (!pdfBase64) return res.status(400).json({ error: 'Missing pdfBase64' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
            },
            {
              type: 'text',
              text: `Analizá este comprobante de retención y generá un nombre de archivo siguiendo EXACTAMENTE este formato:\n\n{razon-social-emisor}_{tipo-retencion}_{fecha}\n\nReglas:\n- razon-social-emisor: nombre de quien EMITE la retención (ej: "plantium-sa"), en minúsculas, sin puntos, sin tildes, espacios reemplazados por guiones\n- tipo-retencion: tipo de impuesto retenido (ej: "retencion-ganancias", "retencion-iva", "retencion-ingresos-brutos"), en minúsculas con guiones\n- fecha: fecha del comprobante en formato DD-MM-YYYY (ej: "16-04-2026")\n- Separar los tres bloques con guión bajo _\n- Sin extensión .pdf\n- Sin espacios\n\nEjemplo de salida correcta: plantium-sa_retencion-ganancias_16-04-2026\n\nRespondé SOLO con el nombre, sin explicaciones, sin comillas, sin extensión.`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Anthropic error' });

    const name = data.content?.map(c => c.text || '').join('').trim();
    return res.status(200).json({ name });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
