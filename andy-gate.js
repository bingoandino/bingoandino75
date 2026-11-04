/* ANDY Studio: entrada aislada. No se carga editor sin sesión admin verificada.
   No comparte scripts o CSS con la portada del bingo. */
(async function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const status = $("andy-gate-status");
  const container = $("tab-andy-estudio");
  const errorBox = $("andy-gate-error");
  function fail(message) {
    status.textContent = "Acceso no disponible";
    errorBox.textContent = message;
    errorBox.hidden = false;
    container.hidden = true;
  }
  let sessionToken, deviceId;
  try {
    sessionToken = sessionStorage.getItem("admin_session_token");
    deviceId = sessionStorage.getItem("device_id") || localStorage.getItem("admin_device_id");
  } catch (_) {
    fail("Este navegador impide acceder a la sesión del administrador. Abre ANDY desde Chrome después de iniciar sesión.");
    return;
  }
  if (!sessionToken || !deviceId) {
    fail("Inicia sesión como administrador en la página principal y abre ANDY desde esa misma pestaña. No se ha perdido ningún borrador.");
    return;
  }
  async function loadSdk() {
    if (typeof window.supabase?.createClient === "function") return window.supabase;
    return await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      let settled = false;
      const done = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else if (typeof window.supabase?.createClient === "function") resolve(window.supabase);
        else reject(new Error("El servicio de autenticación no está disponible."));
      };
      const timer = setTimeout(() => done(new Error("No se pudo cargar la autenticación. Intenta más tarde.")), 6000);
      script.onload = () => done();
      script.onerror = () => done(new Error("No se pudo cargar la autenticación. Comprueba tu conexión."));
      document.head.appendChild(script);
    });
  }
  try {
    const sdk = await loadSdk();
    // Public anon key (same public key used on the website). Never place service_role here.
    const endpoint = "https://dbkixcpwirjwjvjintkr.supabase.co";
    const anon = document.querySelector('meta[name="andy-public-anon-key"]')?.content;
    if (!anon) throw new Error("Falta la configuración pública de acceso.");
    const client = sdk.createClient(endpoint, anon);
    const auth = await Promise.race([
      client.auth.getSession(),
      new Promise((_,reject) => setTimeout(() => reject(new Error("La comprobación tardó demasiado.")), 7000))
    ]);
    const jwt = auth?.data?.session?.access_token;
    if (!jwt) throw new Error("La sesión administrativa no pudo verificarse.");
    const response = await fetch(endpoint + "/functions/v1/verify-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: "Bearer " + jwt
      },
      body: JSON.stringify({ sessionToken, deviceId }),
      signal: AbortSignal.timeout(7000),
      referrerPolicy: "no-referrer"
    });
    if (!response.ok) throw new Error("La sesión no fue autorizada.");
    const info = await response.json();
    if (info.valid !== true || info.sameDevice !== true)
      throw new Error("La sesión expiró. Entra nuevamente al administrador.");
    status.textContent = "Administrador verificado";
    container.hidden = false;
    errorBox.hidden = true;
    // Carga diferida: un fallo del estudio no afecta nunca la página principal.
    const script = document.createElement("script");
    script.src = "/andy-studio.js?v=20261104-isolado-1";
    script.onerror = () => {
      container.hidden = true;
      fail("No se pudo cargar el editor de ANDY. La página principal permanece independiente.");
    };
    document.body.appendChild(script);
  } catch (e) {
    fail(e && e.message ? e.message : "No fue posible verificar el acceso.");
  }
})();
