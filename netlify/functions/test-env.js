exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      mensaje: "función corriendo OK",
      vars: Object.keys(process.env).length,
      algunasVars: Object.keys(process.env).slice(0, 10),
    }),
  };
};
