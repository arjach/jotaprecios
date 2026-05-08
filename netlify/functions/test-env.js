exports.handler = async () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      tieneKey: !!apiKey,
      largoKey: apiKey ? apiKey.length : 0,
      primeros10: apiKey ? apiKey.substring(0, 10) + "..." : "NO ENCONTRADA",
      todasLasVars: Object.keys(process.env).filter(k => 
        k.includes("ANTHROPIC") || k.includes("API") || k.includes("KEY")
      ),
    }),
  };
};
