const https = require("https");

// Helper para hacer fetch sin dependencias externas
function fetchJSON(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };
    const req = https.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, json: () => JSON.parse(data), text: () => data }); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Llama a Claude para extraer precios
async function extraerPrecios(contenido, tipo) {
  const prompt = tipo === "pdf"
    ? `Analizá este contenido de una lista de precios de proveedor y extraé todos los productos con sus precios.
       
       Contenido:
       ${contenido}
       
       Respondé SOLO con un JSON válido, sin texto adicional, sin backticks, en este formato exacto:
       {
         "proveedor": "nombre del proveedor si aparece, o null",
         "fecha": "fecha si aparece, o null",
         "insumos": [
           {
             "nombre": "nombre del producto",
             "precio": 12345,
             "unidad": "kg o gr o u o ml o impresion o hoja",
             "tipo": "3D o SUB o General",
             "notas": "presentacion o aclaracion si la hay o null"
           }
         ]
       }
       
       Reglas:
       - precio siempre en número (sin $, sin puntos de miles, sin comas)
       - tipo "3D" para filamentos, resinas, materiales de impresion
       - tipo "SUB" para sustratos, tintas, papeles de sublimacion
       - tipo "General" para cualquier otro insumo
       - unidad "gr" si el precio es por gramo, "kg" si es por kilo, "u" si es por unidad, "hoja" para papel, "impresion" para tinta por impresion
       - si el precio está por kg y el campo es por gramo, dividilo por 1000
       - incluí solo productos con precio claro, ignorá subtotales o totales`
    : `Analizá este contenido de una página web de proveedor y extraé todos los productos con precios.
       
       Contenido:
       ${contenido.substring(0, 8000)}
       
       Respondé SOLO con un JSON válido, sin texto adicional, sin backticks, en este formato exacto:
       {
         "proveedor": "nombre del proveedor si aparece, o null",
         "fecha": null,
         "insumos": [
           {
             "nombre": "nombre del producto",
             "precio": 12345,
             "unidad": "kg o gr o u o ml o impresion o hoja",
             "tipo": "3D o SUB o General",
             "notas": "presentacion o aclaracion si la hay o null"
           }
         ]
       }`;

  const body = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const res = await fetchJSON("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  const data = res.json();

  if (!res.ok) {
    throw new Error(`Claude API error: ${data.error?.message || "Error desconocido"}`);
  }

  const texto = data.content[0].text.trim();
  // Limpiar posibles backticks que Claude pueda agregar
  const limpio = texto.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(limpio);
}

// Fetch simple de URL para obtener texto
async function fetchURL(url) {
  const res = await fetchJSON(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; JotaPrecios/1.0)",
      "Accept": "text/html,text/plain",
    },
  });
  if (!res.ok) throw new Error(`No se pudo acceder a la URL (${res.status})`);
  const html = res.text();
  // Limpiar HTML básico — quitar tags, scripts, styles
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 10000);
}

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Método no permitido" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { tipo, contenido, url } = body;

    if (!tipo || (!contenido && !url)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Faltan parámetros: tipo y contenido o url" }),
      };
    }

    let textoParaAnalizar = contenido;

    // Si es URL, la fetcheamos
    if (tipo === "url" && url) {
      textoParaAnalizar = await fetchURL(url);
    }

    if (!textoParaAnalizar || textoParaAnalizar.length < 20) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "El contenido está vacío o es muy corto" }),
      };
    }

    const resultado = await extraerPrecios(textoParaAnalizar, tipo === "url" ? "url" : "pdf");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, ...resultado }),
    };

  } catch (error) {
    console.error("Error en extraer-precios:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Error interno del servidor" }),
    };
  }
};
