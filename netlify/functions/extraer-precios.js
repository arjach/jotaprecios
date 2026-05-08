// Netlify Functions corren en Node 18+ que tiene fetch nativo
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Método no permitido" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "API key no configurada" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { tipo, contenido, url } = body;

    if (!tipo || (!contenido && !url)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Faltan parámetros" }) };
    }

    let textoParaAnalizar = contenido || "";

    // Si es URL, la fetcheamos
    if (tipo === "url" && url) {
      const pageRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; JotaPrecios/1.0)" }
      });
      if (!pageRes.ok) throw new Error(`No se pudo acceder a la URL (${pageRes.status})`);
      const html = await pageRes.text();
      // Limpiar HTML
      textoParaAnalizar = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 10000);
    }

    if (!textoParaAnalizar || textoParaAnalizar.length < 20) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Contenido vacío o muy corto" }) };
    }

    const prompt = `Analizá esta lista de precios de proveedor y extraé todos los productos con sus precios.

Contenido:
${textoParaAnalizar.substring(0, 8000)}

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

Reglas importantes:
- precio siempre como número sin símbolos ($, puntos de miles, comas)
- tipo "3D" para filamentos, resinas, materiales de impresión 3D
- tipo "SUB" para sustratos (tazas, remeras, etc), tintas, papeles de sublimación  
- tipo "General" para cualquier otro insumo
- unidad "gr" si precio es por gramo, "kg" si es por kilo, "u" si es por unidad
- si el precio está por kg pero el campo es costo/gramo, dejá el precio por kg con unidad "kg"
- incluí solo productos con precio claro y visible
- ignorá subtotales, totales, descuentos y envíos`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const claudeData = await claudeRes.json();

    if (!claudeRes.ok) {
      throw new Error(`Claude API error: ${claudeData.error?.message || claudeRes.status}`);
    }

    const texto = claudeData.content[0].text.trim();
    const limpio = texto.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const resultado = JSON.parse(limpio);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, ...resultado }),
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Error interno" }),
    };
  }
};
