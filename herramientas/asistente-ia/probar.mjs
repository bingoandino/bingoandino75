// Ejecutar en un servidor con secretos configurados; nunca desde el navegador.
import {DEFAULT_CASE_IDS, createPilot} from './gemini-prueba.mjs';
const run = createPilot({key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_PILOT_MODEL, enabled: process.env.GEMINI_PILOT_ENABLED === 'true'});
let failed = false;
for (const id of DEFAULT_CASE_IDS) {
  const result = await run(id);
  console.log(JSON.stringify({case: id, ...result}));
  if (!result.ok) failed = true;
  if (['disabled', 'not_configured', 'provider_limit', 'provider_error', 'timeout', 'unavailable'].includes(result.reason)) break;
}
process.exitCode = failed ? 1 : 0;
