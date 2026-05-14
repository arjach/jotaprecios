export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key no configurada" });

  try {
    const { texto } = req.body;
    if (!texto || texto.length < 10) return res.status(400).json({ error: "Texto muy corto" });

    const prompt = `Analizá esta lista de precios de proveedor y extraé todos los productos con sus precios.

Contenido:
${texto.substring(0, 8000)}

Respondé SOLO con un JSON válido, sin texto adicional, sin backticks markdown, en este formato exacto:
{
  "proveedor": "nombre del proveedor o null",
  "fecha": "fecha si aparece o null",
  "insumos": [
    {
      "nombre": "nombre del producto",
      "precio": 12345,
      "unidad": "gr o kg o u o hoja o impresion",
      "tipo": "3D o SUB o General",
      "notas": "presentacion o aclaracion o null"
    }
  ]
}
Reglas: precio siempre como número sin símbolos. tipo "3D" para filamentos/resinas, "SUB" para sustratos/tintas/papel sublimación, "General" para otros. Incluí solo productos con precio claro.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 }
        }),
      }
    );

    const data = await geminiRes.json();
    if (!geminiRes.ok) throw new Error(data.error?.message || "Error de Gemini");

    const txt = data.candidates[0].content.parts[0].text
      .trim()
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const resultado = JSON.parse(txt);
    return res.status(200).json({ ok: true, ...resultado });

  } catch (e) {
    console.error("Error en gemini-proxy:", e);
    return res.status(500).json({ error: e.message || "Error interno" });
  }
}
