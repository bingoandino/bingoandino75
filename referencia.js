(function (global) {
  'use strict';
  function normalizar(valor) {
    const referencia = String(valor || '').trim().replace(/[\s.\-]/g, '');
    if (!/^\d{4,64}$/.test(referencia)) {
      throw new Error('Ingresa la referencia bancaria completa o sus últimos 4 dígitos, solo números.');
    }
    return referencia;
  }
  global.ReferenciaBancaria = {
    normalizar,
    ultimos4: valor => normalizar(valor).slice(-4)
  };
  global.pegarReferenciaBancaria = async function () {
    const campo = document.getElementById('referencia4dig');
    const boton = document.getElementById('btnPegarReferencia');
    const estado = document.getElementById('referencia-estado');
    if (!campo || !boton || !estado) return;
    estado.textContent = '';
    boton.disabled = true;
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
        throw new Error('Mantén pulsado el campo y elige «Pegar», o usa Ctrl+V en tu computadora.');
      }
      let texto;
      try { texto = await navigator.clipboard.readText(); }
      catch { throw new Error('No se pudo acceder al portapapeles. Mantén pulsado el campo y elige «Pegar», o usa Ctrl+V.'); }
      campo.value = normalizar(texto);
      campo.dispatchEvent(new Event('input', {bubbles: true}));
      estado.textContent = 'Referencia pegada.';
    } catch (error) {
      estado.textContent = error.message || 'No se pudo pegar la referencia. Puedes ingresarla directamente.';
    } finally {
      boton.disabled = false;
      campo.focus();
    }
  };
})(window);

// Navegación pública disponible mientras se carga la configuración del sorteo.
(function (global) {
  'use strict';
  let instalado = false;
  function instalarNavegacionCliente() {
    if (instalado || typeof global.mostrarVentana !== 'function') return;
    instalado = true;
    const abrirOriginal = global.mostrarVentana;
    const verificarOriginal = global.verificarSesionInicial;
    const estaListo = () => typeof sistemaListo !== 'undefined' && sistemaListo === true;
    let pendiente = null, reloj = null, fallo = false;
    const origenActual = () => document.querySelector('section:not(.oculto)')?.id;
    function avisar(mensaje) {
      let aviso = document.getElementById('estado-navegacion');
      if (!aviso) {
        aviso = document.createElement('p');
        aviso.id = 'estado-navegacion';
        aviso.setAttribute('role', 'status');
        aviso.setAttribute('aria-live', 'polite');
        aviso.style.cssText = 'position:fixed;left:16px;right:16px;bottom:18px;z-index:10000;max-width:540px;margin:0 auto;padding:14px 18px;border:2px solid #ffb300;border-radius:12px;background:#17204f;color:#fff;text-align:center;font-size:15px;line-height:1.5;box-shadow:0 4px 20px #0005;pointer-events:none';
        document.body.appendChild(aviso);
      }
      aviso.textContent = mensaje;
      aviso.hidden = !mensaje;
    }
    function cancelarEspera() {
      pendiente = null;
      if (reloj !== null) global.clearInterval(reloj);
      reloj = null;
      avisar('');
    }
    function comprobarEspera() {
      if (!pendiente || origenActual() !== pendiente.origen) { cancelarEspera(); return; }
      if (!estaListo()) return;
      const id = pendiente.id;
      cancelarEspera();
      Promise.resolve(abrirOriginal(id)).catch(() => avisar('No se pudo abrir esta sección. Revisa tu conexión y vuelve a intentarlo.'));
    }
    global.mostrarVentana = async function (id) {
      if (estaListo()) { cancelarEspera(); return abrirOriginal(id); }
      if (['bienvenida', 'inscripcion', 'usuario'].includes(id)) {
        cancelarEspera();
        document.querySelectorAll('section').forEach(seccion => seccion.classList.add('oculto'));
        document.getElementById(id)?.classList.remove('oculto');
        global.requestAnimationFrame(() => { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; });
        return;
      }
      pendiente = {id, origen: origenActual()};
      avisar(fallo ? 'No se pudo cargar la configuración. Revisa tu conexión y vuelve a cargar la página.' : 'Cargando los datos del sorteo. Abriremos esta sección en cuanto esté lista…');
      if (reloj === null) reloj = global.setInterval(comprobarEspera, 250);
    };
    function conservarPantallaActual() {
      if (document.querySelector('section:not(.oculto):not(#bienvenida)')) {
        document.getElementById('bienvenida')?.classList.add('oculto');
      }
    }
    if (typeof verificarOriginal === 'function') {
      global.verificarSesionInicial = function (...args) {
        const resultado = verificarOriginal.apply(this, args);
        conservarPantallaActual();
        return Promise.resolve(resultado).finally(conservarPantallaActual);
      };
    }
    global.addEventListener('unhandledrejection', () => {
      if (estaListo()) return;
      fallo = true;
      if (pendiente) avisar('No se pudo cargar la configuración. Revisa tu conexión y vuelve a cargar la página.');
    });
    // Los formularios públicos pueden abrirse mientras continúa la carga inicial.
    const overlay = document.getElementById('overlay-carga');
    if (overlay) overlay.style.display = 'none';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalarNavegacionCliente, {once: true});
  else instalarNavegacionCliente();
})(window);

// Agrupa lecturas de disponibilidad; las reservas siguen pasando por los RPC originales.
(function (global) {
  'use strict';
  let instalado = false;
  function instalarDisponibilidadAgrupada() {
    if (instalado || !global.supabase || typeof global.cargarBarraProgresoInicio !== 'function') return;
    instalado = true;
    const cliente = global.supabase;
    let canal = null, cache = null, leyendoConfig = null, version = 0;
    let enCurso = null, temporizador = null, pendiente = false;
    const visible = () => !document.hidden && !document.getElementById('bienvenida')?.classList.contains('oculto');
    function invalidarConfig() { cache = null; version++; }
    async function configuracionBarra() {
      if (cache && cache.hasta > Date.now()) return cache;
      if (leyendoConfig) return leyendoConfig;
      const actual = version;
      leyendoConfig = (async () => {
        const {data, error} = await cliente.from('configuracion').select('clave,valore,valor').in('clave', ['mostrar_barra_progreso', 'total_cartones']);
        if (error) throw error;
        const valores = new Map((data || []).map(fila => [fila.clave, fila.valore ?? fila.valor]));
        const configuracion = {mostrar: String(valores.get('mostrar_barra_progreso')) === 'true', total: Math.max(0, parseInt(valores.get('total_cartones'), 10) || 0), hasta: Date.now() + 30000};
        if (actual === version) cache = configuracion;
        return configuracion;
      })().finally(() => { leyendoConfig = null; });
      return leyendoConfig;
    }
    function registrarError(error) { console.error('No se pudo actualizar la disponibilidad:', error); }
    function programar() {
      pendiente = true;
      if (!visible() || enCurso || temporizador !== null) return;
      temporizador = global.setTimeout(() => {
        temporizador = null;
        actualizar().catch(registrarError);
      }, 1500 + Math.floor(Math.random() * 250));
    }
    function actualizar() {
      if (!visible()) { pendiente = true; return Promise.resolve(); }
      if (enCurso) return enCurso;
      if (temporizador !== null) global.clearTimeout(temporizador);
      temporizador = null;
      pendiente = false;
      enCurso = (async () => {
        const contenedor = document.getElementById('barraProgresoInicio');
        const texto = document.getElementById('textoProgresoCartones');
        const relleno = document.getElementById('rellenoProgresoCartones');
        if (!contenedor || !texto || !relleno) return;
        const config = await configuracionBarra();
        if (!config.mostrar) { contenedor.classList.add('oculto'); return; }
        const {count, error} = await cliente.from('cartones').select('numero', {count: 'exact', head: true}).gte('numero', 1).lte('numero', config.total);
        if (error) throw error;
        if (typeof totalCartones !== 'undefined') totalCartones = config.total;
        const vendidos = Number(count) || 0, disponibles = Math.max(config.total - vendidos, 0);
        const porcentaje = config.total ? Math.round(disponibles / config.total * 100) : 0;
        const totalVendidos = document.getElementById('total-vendidos');
        if (totalVendidos) totalVendidos.textContent = String(vendidos);
        texto.textContent = `${porcentaje}% disponibles · ${disponibles} de ${config.total} cartones`;
        relleno.style.width = `${porcentaje}%`;
        contenedor.classList.remove('oculto');
      })().finally(() => {
        enCurso = null;
        if (pendiente) programar();
      });
      return enCurso;
    }
    global.cargarBarraProgresoInicio = actualizar;
    global.activarProgresoCartonesRealtime = function () {
      if (canal) return canal;
      let conectadoAntes = false;
      canal = cliente.channel('progreso-cartones-inicio')
        .on('postgres_changes', {event: '*', schema: 'public', table: 'cartones'}, programar)
        .on('postgres_changes', {event: '*', schema: 'public', table: 'configuracion'}, payload => {
          global.invalidarConfiguracionInicio?.();
          const claves = [payload.new?.clave, payload.old?.clave].filter(Boolean);
          if (!claves.length || claves.some(clave => ['mostrar_barra_progreso', 'total_cartones'].includes(clave))) { invalidarConfig(); programar(); }
        })
        .subscribe(estado => {
          if (estado === 'SUBSCRIBED') {
            if (conectadoAntes) { invalidarConfig(); programar(); }
            conectadoAntes = true;
          }
        });
      return canal;
    };
    document.addEventListener('visibilitychange', () => { if (visible()) programar(); });
    for (const nombre of ['mostrarVentana', 'mostrarSeccion']) {
      const original = global[nombre];
      if (typeof original !== 'function') continue;
      global[nombre] = function (id, ...args) {
        const resultado = original.call(this, id, ...args);
        if (id === 'bienvenida') Promise.resolve(resultado).then(actualizar).catch(registrarError);
        return resultado;
      };
    }
    const cargarOriginal = global.cargarCartones;
    if (typeof cargarOriginal === 'function') {
      let cargando = null;
      global.cargarCartones = function (...args) {
        if (!cargando) cargando = Promise.resolve().then(() => cargarOriginal.apply(this, args)).finally(() => { cargando = null; });
        return cargando;
      };
    }
    const toggleOriginal = global.toggleCarton;
    if (typeof toggleOriginal === 'function') {
      const enEspera = new Map();
      let cola = Promise.resolve();
      global.toggleCarton = function (numero, elemento) {
        const clave = Number(numero);
        if (enEspera.has(clave)) return enEspera.get(clave);
        elemento?.setAttribute('aria-busy', 'true');
        const tarea = cola.catch(() => {}).then(() => toggleOriginal.call(this, numero, elemento)).finally(() => {
          enEspera.delete(clave);
          elemento?.removeAttribute('aria-busy');
        });
        enEspera.set(clave, tarea);
        cola = tarea;
        return tarea;
      };
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalarDisponibilidadAgrupada, {once: true});
  else instalarDisponibilidadAgrupada();
})(window);

// Una sola lectura de configuración para iniciar la compra; presentación en segundo plano.
(function (global) {
  'use strict';
  let instalado = false;
    const claves = ['total_cartones', 'precio_carton', 'modo_cartones', 'cartones_obligatorios', 'link_whatsapp', 'version_cartones', 'imagen_premios_inicio', 'mostrar_barra_progreso'];
    let cache = null, peticion = null, version = 0;
    function invalidar() { cache = null; version++; }
    async function leer(fresca = false) {
      if (!fresca && cache && cache.hasta > Date.now()) return cache.valores;
      if (peticion) return peticion;
      const actual = version;
      peticion = (async () => {
        let consulta = global.supabase.from('configuracion').select('clave,valore,valor').in('clave', claves);
        if (typeof consulta.abortSignal === 'function' && global.AbortSignal?.timeout) consulta = consulta.abortSignal(global.AbortSignal.timeout(12000));
        const {data, error} = await consulta;
        if (error || !Array.isArray(data)) throw new Error('No se pudieron cargar los datos del sorteo. Revisa tu conexión e inténtalo de nuevo.');
        const valores = new Map(data.map(fila => [fila.clave, fila.valore ?? fila.valor]));
        if (actual === version) cache = {valores, hasta: Date.now() + 5000};
        return valores;
      })().finally(() => { peticion = null; });
      return peticion;
    }
  function instalarInicioAgrupado() {
    if (instalado || !global.supabase || typeof global.cargarPromocionesConfig !== 'function' || typeof global.cargarPrecioPorCarton !== 'function') return;
    instalado = true;
    global.invalidarConfiguracionInicio = invalidar;
    const getOriginal = global.getConfigValue;
    if (typeof getOriginal === 'function') global.getConfigValue = async function (clave, fallback = null) {
      if (!claves.includes(clave)) return getOriginal(clave, fallback);
      return (await leer()).get(clave) ?? fallback;
    };
    global.obtenerTotalCartones = async function () {
      const valor = (await leer()).get('total_cartones');
      const total = Number(valor);
      if (!Number.isInteger(total) || total < 1) throw new Error('No se pudo cargar la cantidad de cartones del sorteo.');
      totalCartones = total;
    };
    global.cargarPrecioPorCarton = async function () {
      const valor = (await leer()).get('precio_carton');
      const precio = Number(valor);
      if (valor == null || valor === '' || !Number.isFinite(precio) || precio < 0) throw new Error('No se pudo cargar el precio del sorteo.');
      precioPorCarton = precio;
    };
    global.cargarConfiguracionModoCartones = async function () {
      const valores = await leer();
      modoCartones = valores.get('modo_cartones') || 'libre';
      const fijo = modoCartones === 'fijo';
      if (fijo) cantidadFijaCartones = parseInt(valores.get('cartones_obligatorios'), 10) || 1;
      const cantidad = document.getElementById('cantidadCartones');
      if (cantidad) { cantidad.readOnly = fijo; if (fijo) cantidad.value = cantidadFijaCartones; }
      for (const id of ['btnMas', 'btnMenos']) { const boton = document.getElementById(id); if (boton) boton.disabled = fijo; }
    };
    function desactivarPromocionesPublicas() {
      // Conserva los registros históricos: solo se retiran de la compra actual.
      if (typeof promociones !== 'undefined') promociones.forEach(promo => { promo.activa = false; });
      if (typeof promocionSeleccionada !== 'undefined') promocionSeleccionada = null;
      document.getElementById('promoBox')?.classList.add('oculto');
    }
    global.cargarPromocionesConfig = async function () { desactivarPromocionesPublicas(); };
    global.renderizarBotonesPromociones = desactivarPromocionesPublicas;
    desactivarPromocionesPublicas();
    global.cargarLinkWhatsapp = async function () {
      const link = (await leer()).get('link_whatsapp');
      const boton = document.getElementById('btnWhatsapp');
      if (boton && link) { boton.href = link; boton.style.display = 'inline-block'; }
    };
    global.cargarImagenPremiosInicio = async function () {
      const imagen = document.getElementById('imagenPremiosInicio');
      if (!imagen) return;
      const url = (await leer()).get('imagen_premios_inicio');
      if (!url) { imagen.classList.add('oculto'); return; }
      imagen.src = url;
      imagen.classList.remove('oculto');
    };
    // Estas tareas no habilitan compras ni conceden acceso al administrador.
    for (const nombre of ['cargarBarraProgresoInicio', 'cargarConfigBarraProgresoAdmin', 'cargarImagenPremiosInicio']) {
      const original = global[nombre];
      if (typeof original !== 'function') continue;
      global[nombre] = function (...args) {
        const tarea = Promise.resolve().then(() => original.apply(this, args));
        if (typeof sistemaListo !== 'undefined' && !sistemaListo) {
          tarea.catch(error => console.error('No se pudo completar una actualización de presentación:', error));
          return Promise.resolve();
        }
        return tarea;
      };
    }
    const verificarInicial = global.verificarSesionInicial;
    let verificando = Promise.resolve();
    if (typeof verificarInicial === 'function') global.verificarSesionInicial = function (...args) {
      verificando = Promise.resolve().then(() => verificarInicial.apply(this, args)).catch(error => console.error('No se pudo completar la verificación inicial:', error));
      return typeof sistemaListo !== 'undefined' && !sistemaListo ? Promise.resolve() : verificando;
    };
    const entrarOriginal = global.entrarAdmin;
    if (typeof entrarOriginal === 'function') global.entrarAdmin = async function (...args) {
      await verificando;
      // EntrarAdmin conserva su verificación de sesión obligatoria antes de abrir el panel.
      return entrarOriginal.apply(this, args);
    };
  }
  // Empieza la consulta mientras termina de descargarse el script principal.
  if (global.supabase && document.getElementById('cantidadCartones') && document.getElementById('btnEnviarComprobante')) leer().catch(() => {});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalarInicioAgrupado, {once: true});
  else instalarInicioAgrupado();
})(window);

// Solo tiempos y nombres fijos de etapas; nunca argumentos, respuestas ni datos del cliente.
(function (global) {
  'use strict';
  const muestras = [];
  const ahora = () => global.performance?.now() ?? Date.now();
  function registrar(etapa, inicio, resultado) {
    muestras.push({etapa, ms: Math.max(0, Math.round(ahora() - inicio)), resultado});
    if (muestras.length > 100) muestras.shift();
  }
  global.DiagnosticoCompra = Object.freeze({
    resumen: () => muestras.map(fila => ({...fila})),
    limpiar: () => { muestras.length = 0; }
  });
  // Resource Timing observa peticiones existentes; no envía telemetría ni conserva URLs.
  if (typeof global.PerformanceObserver === 'function') {
    try {
      const observador = new global.PerformanceObserver(lista => {
        for (const recurso of lista.getEntries()) {
          try {
            const url = new URL(recurso.name);
            if (url.origin !== new URL(global.supabase.supabaseUrl).origin) continue;
            const ruta = url.pathname;
            const etapa = ruta === '/rest/v1/configuracion' ? 'red_configuracion'
              : ruta === '/rest/v1/cartones' ? 'red_cartones'
              : ruta === '/rest/v1/inscripciones' ? 'red_inscripciones'
              : ruta.startsWith('/storage/v1/object/comprobantes/') ? 'red_comprobante' : null;
            if (etapa && Number.isFinite(recurso.duration)) registrar(etapa, ahora() - recurso.duration, 'recurso');
          } catch { /* Un recurso ajeno o sin información de tiempo se ignora. */ }
        }
      });
      observador.observe({type: 'resource', buffered: true});
      global.addEventListener('pagehide', () => observador.disconnect(), {once: true});
    } catch { /* Las mediciones son opcionales; nunca bloquean la compra. */ }
  }
  let instalado = false;
  function instalar() {
    if (instalado) return;
    instalado = true;
    const etapas = {
      obtenerTotalCartones: 'configuracion', cargarPrecioPorCarton: 'precio',
      cargarConfiguracionModoCartones: 'modalidad', cargarCartones: 'cartones',
      prepararComprobanteSeguro: 'preparar_imagen'
    };
    for (const [nombre, etapa] of Object.entries(etapas)) {
      const original = global[nombre];
      if (typeof original !== 'function') continue;
      global[nombre] = async function (...args) {
        const inicio = ahora();
        try { const valor = await original.apply(this, args); registrar(etapa, inicio, 'terminado'); return valor; }
        catch (error) { registrar(etapa, inicio, 'error'); throw error; }
      };
    }
    const original = global.enviarComprobante;
    if (typeof original !== 'function') return;
    let pendiente = null;
    global.enviarComprobante = function (...args) {
      if (pendiente) return pendiente;
      const boton = document.getElementById('btnEnviarComprobante');
      const texto = boton?.textContent;
      const deshabilitado = boton?.disabled;
      const inicio = ahora();
      if (boton) { boton.disabled = true; boton.setAttribute('aria-busy', 'true'); }
      // La promesa se asigna antes de ejecutar el envío: también cubre llamadas directas.
      pendiente = Promise.resolve().then(() => original.apply(this, args))
        .then(valor => { registrar('envio_completo', inicio, 'terminado'); return valor; }, error => {
          registrar('envio_completo', inicio, 'error'); throw error;
        }).finally(() => {
          pendiente = null;
          if (boton) { boton.disabled = deshabilitado; boton.textContent = texto; boton.removeAttribute('aria-busy'); }
        });
      return pendiente;
    };
  }
  // Se instala después de los otros adaptadores para medir las funciones definitivas.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalar, {once: true});
  else instalar();
})(window);

