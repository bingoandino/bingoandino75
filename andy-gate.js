/* ANDY Studio — acceso directo con contraseña y OTP usando el backend de admin.
 * Nada se modifica en la portada. Ningún acceso al editor sin JWT + sesión del dispositivo verificadas.
 * La contraseña, el OTP y la prueba de contraseña SOLO viven en memoria.
 */
(async function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const status = $("andy-gate-status");
  const editor = $("tab-andy-estudio");
  const errorBox = $("andy-gate-error");
  const loginBox = $("andy-login-box");
  const passwordForm = $("andy-login-form");
  const codeForm = $("andy-code-form");
  const emailInput = $("andy-login-email");
  const passwordInput = $("andy-login-password");
  const codeInput = $("andy-otp-code");
  const passwordButton = $("andy-login-submit");
  const codeButton = $("andy-otp-submit");
  const resendButton = $("andy-otp-resend");
  const resetButton = $("andy-otp-cancel");
  const codeHint = $("andy-otp-email");
  const base = "https://dbkixcpwirjwjvjintkr.supabase.co";
  const anon = document.querySelector('meta[name="andy-public-anon-key"]')?.content || "";
  const CHALLENGE_TTL = 9 * 60 * 1000;
  const RESEND_COOLDOWN = 60 * 1000;
  const ANDY_SESSION_KEY = "bingo_andy_sesion_24h_v1";
  const REMEMBER_FOR_MS = 24 * 60 * 60 * 1000; // Tope local: el servidor puede vencer antes.
  const KEEPALIVE_MS = 15 * 60 * 1000; // Solo mientras ANDY permanezca abierto y visible.
  let keepAliveTimer = null, checkingSession = false;
  let sdkPromise = null, client = null, pending = null, busy = false, otpLastSent = 0;
  let activeSession = null;
  let loginBooted = false;

  function message(text, error = false) {
    status.textContent = text;
    errorBox.hidden = !error;
    errorBox.textContent = error ? text : "";
  }
  function showLogin(text) {
    editor.hidden = true;
    loginBox.hidden = false;
    passwordForm.hidden = false;
    codeForm.hidden = true;
    if (text) message(text);
    if (!loginBooted) {
      passwordForm.addEventListener("submit", submitPassword);
      codeForm.addEventListener("submit", submitCode);
      resendButton.addEventListener("click", resendCode);
      resetButton.addEventListener("click", () => showLogin("Introduce tu contraseña para solicitar un código nuevo."));
      loginBooted = true;
    }
  }
  function setBusy(flag) {
    busy = flag;
    passwordButton.disabled = flag;
    codeButton.disabled = flag;
    resendButton.disabled = flag;
    resetButton.disabled = flag;
  }
  function getStorage(key, local = false) {
    try { return (local ? localStorage : sessionStorage).getItem(key) || ""; }
    catch { return ""; }
  }
  function setStorage(key, val, local = false) {
    try { (local ? localStorage : sessionStorage).setItem(key, val); return true; }
    catch { return false; }
  }
  function removeStorage(key) {
    try { sessionStorage.removeItem(key); } catch (_) {}
  }
  // La sesión ANDY es específica de este dispositivo; jamás se almacenan contraseña ni OTP.
  // Toda recuperación pasa nuevamente por verify-session en el servidor.
  function readRememberedSession() {
    try {
      const stored = localStorage.getItem(ANDY_SESSION_KEY);
      if (!stored) return null;
      const session = JSON.parse(stored);
      if (!session || typeof session.token !== "string" ||
          !/^sess_[a-f0-9-]{20,90}$/i.test(session.token) ||
          typeof session.deviceId !== "string" || session.deviceId.length > 200 ||
          !Number.isFinite(session.startedAt) || session.startedAt > Date.now() + 60000 ||
          Date.now() - session.startedAt >= REMEMBER_FOR_MS) {
        localStorage.removeItem(ANDY_SESSION_KEY);
        return {expired:true, token:session?.token || ""};
      }
      return session;
    } catch (_) { return null; }
  }
  function rememberSession(token, deviceId, startedAt = Date.now()) {
    if (typeof token !== "string" || !token.startsWith("sess_") ||
        typeof deviceId !== "string" || !deviceId ||
        !Number.isFinite(startedAt) || Date.now() - startedAt >= REMEMBER_FOR_MS) return false;
    try {
      localStorage.setItem(ANDY_SESSION_KEY, JSON.stringify({token,deviceId,startedAt}));
      return true;
    } catch (_) { return false; }
  }
  function forgetRememberedSession(token) {
    try {
      const stored = JSON.parse(localStorage.getItem(ANDY_SESSION_KEY) || "null");
      if (!token || stored?.token === token) localStorage.removeItem(ANDY_SESSION_KEY);
    } catch (_) {
      try { localStorage.removeItem(ANDY_SESSION_KEY); } catch (_) {}
    }
  }
  async function validateVisibleSession() {
    if (checkingSession || editor.hidden || !activeSession) return;
    const stored = readRememberedSession();
    if (stored?.expired) {
      activeSession = null;
      showLogin("Han pasado 24 horas desde el inicio del acceso a ANDY. Introduce de nuevo tu contraseña y código.");
      return;
    }
    checkingSession = true;
    const current = activeSession;
    try {
      const allowed = await checkActive(current.sessionToken,current.deviceId);
      if (!allowed) {
        forgetRememberedSession(current.sessionToken);
        activeSession = null;
        showLogin("La sesión del servidor venció o fue revocada. Inicia sesión nuevamente.");
      }
    } catch (_) {
      activeSession = null;
      showLogin("No se pudo comprobar el acceso por conexión. Recarga ANDY cuando tengas internet.");
    } finally { checkingSession = false; }
  }
  function beginKeepAlive() {
    if (keepAliveTimer) return;
    keepAliveTimer = setInterval(() => {
      if (document.visibilityState === "visible") void validateVisibleSession();
    },KEEPALIVE_MS);
    document.addEventListener("visibilitychange",() => {
      if (document.visibilityState === "visible") void validateVisibleSession();
    });
  }
  function getDeviceId() {
    let id = getStorage("device_id") || getStorage("admin_device_id", true);
    if (!id) {
      if (!window.crypto?.randomUUID) throw new Error("Tu navegador debe actualizarse para iniciar sesión.");
      id = "device_" + window.crypto.randomUUID();
      if (!setStorage("admin_device_id", id, true)) throw new Error("Permite el almacenamiento de sesión en el navegador.");
    }
    return id;
  }
  async function loadSdk() {
    if (typeof window.supabase?.createClient === "function") return window.supabase;
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      let settled = false;
      const finish = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else if (typeof window.supabase?.createClient === "function") resolve(window.supabase);
        else reject(new Error("No se pudo cargar el acceso seguro."));
      };
      const timer = setTimeout(() => finish(new Error("No se pudo contactar con el acceso seguro. Revisa tu conexión.")), 6500);
      script.onload = () => finish();
      script.onerror = () => finish(new Error("No se pudo contactar con el acceso seguro. Revisa tu conexión."));
      document.head.appendChild(script);
    }).catch((err) => {
      sdkPromise = null; // Permite reintentar si el CDN vuelve a funcionar.
      throw err;
    });
    return sdkPromise;
  }
  async function getClient() {
    if (client) return client;
    if (!anon || !base.startsWith("https://")) throw new Error("Configuración de acceso no disponible.");
    const sdk = await loadSdk();
    client = sdk.createClient(base, anon);
    return client;
  }
  async function adminRequest(payload, token) {
    const h = {
      "Content-Type": "application/json",
      apikey: anon
    };
    if (token) h.Authorization = "Bearer " + token;
    const response = await fetch(base + "/functions/v1/admin-auth", {
      method: "POST",
      headers: h,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
      referrerPolicy: "no-referrer"
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }
  async function checkActive(sessionToken, deviceId) {
    const sdkClient = await getClient();
    const auth = await Promise.race([
      sdkClient.auth.getSession(),
      new Promise((_,reject) => setTimeout(() => reject(new Error("La verificación tardó demasiado.")), 8000))
    ]);
    const jwt = auth?.data?.session?.access_token;
    if (!jwt) return false;
    const response = await fetch(base + "/functions/v1/verify-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: "Bearer " + jwt
      },
      body: JSON.stringify({ sessionToken, deviceId }),
      signal: AbortSignal.timeout(8000),
      referrerPolicy: "no-referrer"
    });
    if (!response.ok) return false;
    const info = await response.json();
    if (info.valid !== true || info.sameDevice !== true) return false;
    activeSession = { sessionToken, deviceId };
    if (info.expiresAt) setStorage("session_expires", info.expiresAt);
    return true;
  }
  function openStudio() {
    loginBox.hidden = true;
    editor.hidden = false;
    errorBox.hidden = true;
    status.textContent = "Administrador verificado · ANDY Studio";
    beginKeepAlive();
    if (window.__andyStudioLoaded) return;
    const script = document.createElement("script");
    script.src = "/andy-studio.js?v=20261104-brief-v1";
    script.onload = () => {
      window.__andyStudioLoaded = true;
      message("ANDY listo. Borradores guardados únicamente en este dispositivo.");
    };
    script.onerror = () => {
      editor.hidden = true;
      message("No se pudo cargar ANDY. Puedes volver a intentarlo desde este enlace.", true);
    };
    document.body.appendChild(script);
  }
  async function submitPassword(event) {
    event.preventDefault();
    if (busy) return;
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
      message("Escribe el correo autorizado y la contraseña.", true); return;
    }
    setBusy(true);
    message("Comprobando contraseña…");
    pending = null;
    try {
      const deviceId = getDeviceId();
      // No guardar ni compartir contraseña fuera de esta solicitud autenticada por HTTPS.
      const {response, data} = await adminRequest({ action:"verify_credentials", email, password, deviceId });
      passwordInput.value = "";
      if (!response.ok || data.valid !== true || typeof data.loginProof !== "string") {
        message(response.status === 429
          ? "Hay demasiados intentos. Espera antes de reintentar."
          : "No se pudo verificar el correo o la contraseña.", true);
        return;
      }
      pending = { email, deviceId, proof:data.loginProof, startedAt:Date.now() };
      await sendOtp();
      passwordForm.hidden = true;
      codeForm.hidden = false;
      codeHint.textContent = email;
      codeInput.value = "";
      message("Te enviamos un código a tu correo. Escríbelo para acceder.");
      codeInput.focus();
    } catch (_) {
      passwordInput.value = "";
      pending = null;
      message("No se pudo completar el acceso. Comprueba tu conexión e inténtalo de nuevo.", true);
    } finally {
      setBusy(false);
    }
  }
  async function sendOtp() {
    if (!pending || Date.now()-pending.startedAt > CHALLENGE_TTL)
      throw new Error("La solicitud de acceso caducó.");
    const now = Date.now();
    if (now-otpLastSent < RESEND_COOLDOWN)
      throw new Error("Debes esperar antes de solicitar otro código.");
    const auth = await getClient();
    const {error} = await auth.auth.signInWithOtp({
      email:pending.email,
      options:{shouldCreateUser:false,emailRedirectTo:window.location.origin}
    });
    if (error) {
      if (error.status === 429) otpLastSent = now;
      throw new Error("No se pudo enviar el código. Espera antes de volver a intentarlo.");
    }
    otpLastSent = now;
  }
  async function resendCode() {
    if (busy) return;
    if (!pending || Date.now()-pending.startedAt > CHALLENGE_TTL) {
      showLogin("La verificación venció. Escribe de nuevo tu contraseña.");
      pending = null;
      return;
    }
    setBusy(true);
    try {
      await sendOtp();
      message("Código solicitado. Revisa tu correo y Spam.");
    } catch (e) {
      message(e.message || "No se pudo solicitar el código.", true);
    } finally {setBusy(false);}
  }
  async function submitCode(event) {
    event.preventDefault();
    if (busy) return;
    const otp = codeInput.value.replace(/\D/g,"").slice(0,6);
    if (!pending || Date.now()-pending.startedAt > CHALLENGE_TTL) {
      showLogin("El acceso venció. Verifica la contraseña nuevamente.");
      pending = null; codeInput.value = ""; return;
    }
    if (!/^\d{6}$/.test(otp)) {
      message("Introduce los seis dígitos que llegaron a tu correo.", true);return;
    }
    setBusy(true);
    message("Verificando código y dispositivo…");
    try {
      const sdkClient = await getClient();
      const {data, error} = await sdkClient.auth.verifyOtp({
        email:pending.email, token:otp, type:"email"
      });
      codeInput.value = "";
      if (error || !data?.session?.access_token) {
        message("Código inválido o vencido. Revisa el correo e intenta otra vez.", true);
        return;
      }
      const verified = await adminRequest({
        action:"create_session_otp",
        email:pending.email,
        deviceId:pending.deviceId,
        loginProof:pending.proof
      }, data.session.access_token);
      if (!verified.response.ok || verified.data.success !== true ||
          typeof verified.data.sessionToken !== "string" || !verified.data.sessionToken ||
          typeof verified.data.deviceId !== "string") {
        const err = verified.data?.error;
        message(err === "SESION_ACTIVA" || verified.response.status === 403
          ? "No se pudo abrir otra sesión. Verifica las sesiones activas del administrador."
          : "No se pudo confirmar el acceso. Vuelve a comenzar con tu contraseña.", true);
        pending = null; codeForm.hidden = true; passwordForm.hidden = false;
        return;
      }
      // Verificar la sesión de dispositivo en el servidor ANTES de mostrar el estudio.
      const previousToken = getStorage("admin_session_token");
      const previousId = getStorage("device_id");
      setStorage("admin_session_token",verified.data.sessionToken);
      setStorage("device_id",verified.data.deviceId);
      const verifiedAgain = await checkActive(verified.data.sessionToken,verified.data.deviceId);
      if (!verifiedAgain) {
        if (previousToken) setStorage("admin_session_token",previousToken);
        else removeStorage("admin_session_token");
        if (previousId) setStorage("device_id",previousId);
        else removeStorage("device_id");
        throw new Error("La sesión no pudo confirmarse en el servidor.");
      }
      setStorage("admin_email",pending.email);
      if (verified.data.expiresAt) setStorage("session_expires",verified.data.expiresAt);
      setStorage("admin_device_id",verified.data.deviceId,true);
      rememberSession(verified.data.sessionToken, verified.data.deviceId);
      pending = null;
      openStudio();
    } catch (_) {
      codeInput.value = "";
      pending = null;
      codeForm.hidden = true; passwordForm.hidden = false;
      message("No se pudo finalizar el acceso. Introduce nuevamente tu contraseña.", true);
    } finally {setBusy(false);}
  }
  showLogin("Accede directamente a ANDY con los datos del administrador.");
  // Si ya existe sesión autorizada en esta misma pestaña, evitar pedir OTP de nuevo.
  const remembered = readRememberedSession();
  const tabToken = getStorage("admin_session_token");
  const newerAdminSession = tabToken && tabToken !== remembered?.token;
  const token = newerAdminSession ? tabToken :
    remembered?.expired ? "" : (tabToken || remembered?.token || "");
  const device = newerAdminSession ? (getStorage("device_id") || getStorage("admin_device_id",true)) :
    (remembered?.deviceId || getStorage("device_id") || getStorage("admin_device_id",true));
  if (token && device) {
    message("Recuperando sesión segura de ANDY…");
    try {
      if (await checkActive(token,device)) {
        setStorage("admin_session_token",token);
        setStorage("device_id",device);
        rememberSession(token,device,
          remembered?.token === token && !remembered.expired ? remembered.startedAt : Date.now());
        openStudio();
      } else {
        forgetRememberedSession(token);
        showLogin("La sesión anterior ya no está activa. Entra con contraseña y código del correo.");
      }
    } catch (_) {
      showLogin("No se pudo comprobar la sesión por conexión. Recarga cuando tengas internet o inicia sesión.");
    }
  } else if (remembered?.expired) {
    showLogin("La sesión recordada de ANDY alcanzó las 24 horas. Introduce de nuevo contraseña y código.");
  }
})();
