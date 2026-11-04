// ANDY Marketing Pro: generación por API desactivada para evitar cargos.
// Las imágenes premium se elaboran en ChatGPT. Sin acceso a compras ni pagos.
Deno.serve((req: Request) => {
  const origin=req.headers.get("origin");
  const allowed=origin==="https://bingoandino75.com"||origin==="https://www.bingoandino75.com";
  const headers={
    "Cache-Control":"no-store","Content-Type":"application/json",
    "Access-Control-Allow-Origin":allowed?origin:"https://bingoandino75.com",
    "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"
  };
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  return Response.json({ready:false,disabled:true,
    error:"La generación de imágenes por API fue desactivada. Prepara las imágenes premium en ChatGPT."},
    {status:410,headers});
});
