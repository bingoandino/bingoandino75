// Solo servidor. Piloto sin HTTP público ni entrada libre de clientes.
export const CASES = Object.freeze({
  saludo: Object.freeze(['Hola, buenas.']),
  identidad: Object.freeze(['Hola', 'Q es esto?']),
  paciencia: Object.freeze(['No entiendo nada de esto', 'Explícame despacito, por favor']),
  sencillo: Object.freeze(['Me cuesta leer mensajes largos', 'Dímelo cortico y sencillo']),
  humano: Object.freeze(['Prefiero hablar con una persona']),
});

const INSTRUCTIONS = `Eres un asistente virtual de atención general en una prueba ficticia.
Responde en español venezolano cordial, sencillo y profesional. Trata al adulto con respeto,
sin infantilizarlo ni llamarlo abuelo, viejito, mi amor o torpe. Máximo 30 palabras y un emoji.
Saluda con Hola o Buenas, sin asumir la hora del día. No repitas el saludo a mitad del diálogo.
Lee todo el diálogo y responde al último mensaje. Si no entiende, explica con paciencia.
Aclara que eres virtual si pregunta quién eres. Si pide una persona, reconoce esa preferencia;
no inventes que ya transferiste la conversación ni que hablará en persona físicamente.
Si pide atención humana, reconoce la preferencia y termina sin preguntas ni ofrecer seguir
atendiéndolo tú. No inventes teléfonos, enlaces ni funciones.
No ofrezcas ventas, apuestas, compras, premios, transferencias ni acciones sobre cuentas.
No pidas ni reproduzcas datos personales, bancarios, contraseñas o códigos de acceso.
Devuelve únicamente JSON con un campo answer que contenga tu respuesta.`;

export function createPilot({key, model, enabled = false, fetcher = (...args) => globalThis.fetch(...args), timeoutMs = 12000, maxCalls = 5} = {}) {
  let calls = 0;
  const limit = Number.isInteger(maxCalls) ? Math.min(5, Math.max(0, maxCalls)) : 0;
  return async function run(caseId) {
    if (typeof caseId !== 'string' || !Object.hasOwn(CASES, caseId)) return {ok: false, reason: 'invalid_case'};
    if (!enabled) return {ok: false, reason: 'disabled'};
    if (!key || !/^gemini-[a-z0-9.-]+$/.test(model || '')) return {ok: false, reason: 'not_configured'};
    if (calls >= limit) return {ok: false, reason: 'limit'};
    calls++;
    // Solo salen frases sintéticas inmutables. No se aceptan historial, archivos ni texto externo.
    const body = {
      systemInstruction: {parts: [{text: INSTRUCTIONS}]},
      contents: [{role: 'user', parts: [{text: JSON.stringify(CASES[caseId])}]}],
      generationConfig: {
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
        responseSchema: {type: 'OBJECT', properties: {answer: {type: 'STRING'}}, required: ['answer']},
      },
      tools: [],
    };
    const controller = new AbortController();
    let timer;
    try {
      // Promise.race limita también una dependencia que no respete AbortSignal.
      const deadline = new Promise((_, reject) => {timer = setTimeout(() => {controller.abort(); reject(new Error('timeout'));}, timeoutMs);});
      const operation = async () => {
        const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', redirect: 'error', headers: {'Content-Type': 'application/json', 'x-goog-api-key': key},
          body: JSON.stringify(body), signal: controller.signal,
        });
        if (!response.ok) return {ok: false, reason: response.status === 429 ? 'provider_limit' : 'provider_error'};
        // Limitar el cuerpo antes de parsear; no imprimir errores del proveedor ni claves.
        const reader = response.body?.getReader();
        if (!reader) return {ok: false, reason: 'invalid_response'};
        const decoder = new TextDecoder(); let raw = '', size = 0;
        while (true) {
          const {done, value} = await reader.read(); if (done) break;
          size += value.length;
          if (size > 32768) {await reader.cancel(); return {ok: false, reason: 'invalid_response'};}
          raw += decoder.decode(value, {stream: true});
        }
        raw += decoder.decode();
        const data = JSON.parse(raw), candidate = data.candidates?.[0];
        if (data.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP') return {ok: false, reason: 'blocked_or_incomplete'};
        const parts = candidate.content?.parts;
        if (!Array.isArray(parts) || parts.some(p => p.functionCall || p.executableCode)) return {ok: false, reason: 'invalid_response'};
        const text = parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('');
        const result = JSON.parse(text);
        const answer = result?.answer;
        if (!answer || typeof answer !== 'string' || Object.keys(result).length !== 1 || answer.length > 350 || answer.trim().split(/\s+/).length > 30) return {ok: false, reason: 'invalid_response'};
        if (caseId === 'humano' && /[¿?]/.test(answer)) return {ok: false, reason: 'unsafe_response'};
        // Barrera adicional de presentación, no una garantía semántica de seguridad.
        if (/[\d<>]|https?:|www\.|\[[^\]]*\]\(|contraseñ|password|c[oó]digo de acceso|pago m[oó]vil|\b(?:compra|apuesta|transfiere|deposit[ae])\b/i.test(answer)) return {ok: false, reason: 'unsafe_response'};
        return {ok: true, answer: answer.trim()};
      };
      return await Promise.race([operation(), deadline]);
    } catch {
      return {ok: false, reason: controller.signal.aborted ? 'timeout' : 'unavailable'};
    } finally {clearTimeout(timer);}
  };
}
