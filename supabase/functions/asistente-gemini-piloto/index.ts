// Diagnóstico terminado. No lee secretos ni llama a Gemini.
// La prueba temporal se ejecuta mediante una capacidad con caducidad;
// este archivo es el estado seguro que debe quedar desplegado al terminar.
Deno.serve(() => Response.json({ok: false, reason: 'pilot_closed'}, {
  status: 410,
  headers: {'Cache-Control': 'no-store'},
}));
