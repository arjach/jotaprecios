export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key no configurada" });

  try {
    let { texto, url } = req.body;

    // Si viene una URL, la fetcheamos desde el servidor (sin CORS)
    if (url && !texto) {
      let intentos = [
        // Intento 1: headers de navegador real
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
          }
        },
        // Intento 2: headers simples
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Accept": "text/html,*/*",
          }
        }
      ];

      let html = null;
      let lastError = null;

      for (const opts of intentos) {
        try {
          const pageRes = await fetch(url, { ...opts, redirect: "follow" });
          if (pageRes.ok) {
            html = await pageRes.text();
            break;
          }
        } catch(e) {
          lastError = e.message;
        }
      }

      if (!html) {
        // Intento 3: usar allorigins como fallback
        try {
          const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
          if (proxyRes.ok) {
            const pd = await proxyRes.json();
            html = pd.contents || "";
          }
        } catch(e) {
          lastError = e.message;
        }
      }

      if (!html) throw new Error(`No se pudo acceder a la URL. El sitio puede bloquear bots. Intentá descargar el PDF de lista de precios y subirlo directamente.`);

      texto = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Intentar extraer solo tablas de precios si el texto es muy largo
      if (texto.length < 50) {
        throw new Error("La página no tiene contenido legible. Probá descargando el PDF de lista de precios y subiéndolo directamente.");
      }
    }

    if (!texto || texto.length < 10) return res.status(400).json({ error: "Contenido vacío o muy corto. La página puede requerir login o bloquear bots." });

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
