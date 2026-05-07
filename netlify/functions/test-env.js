exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      tieneKey: !!apiKey,
      largoKey: apiKey ? apiKey.length : 0,
      empiezaCon: apiKey ? apiKey.substring(0, 10) + "..." : "undefined",
      nodeVersion: process.version,
      env: Object.keys(process.env).filter(k => k.includes("ANTHROPIC")),
    }),
  };
};
