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

// Consulta del cliente: cada compra conserva su propio estado y sus cartones.
(function (global) {
  'use strict';
  let instalado = false;
  function instalarConsultaCliente() {
    const campo = document.getElementById('consulta-cedula');
    const cont = document.getElementById('cartones-usuario');
    if (instalado || !campo || !cont || !global.supabase) return;
    instalado = true;
    const seccion = campo.closest('section');
    const boton = seccion?.querySelector('button[onclick="consultarCartones()"]');
    campo.inputMode = 'numeric';
    campo.setAttribute('aria-label', 'Cédula de la compra');
    seccion?.querySelector('h2')?.replaceChildren(document.createTextNode('Verificar tu compra'));
    cont.setAttribute('aria-live', 'polite');
    const estilo = document.createElement('style');
    estilo.textContent = `
      #cartones-usuario{display:block;width:100%;box-sizing:border-box}
      #cartones-usuario .compra-estado{box-sizing:border-box;width:100%;margin:18px 0;padding:20px;border:2px solid var(--borde);border-radius:18px;background:var(--fondo);color:#182033;text-align:left;overflow-wrap:anywhere}
      #cartones-usuario .compra-estado h3{margin:0 0 12px;font-size:1.25rem;color:inherit}
      #cartones-usuario .compra-estado p{margin:8px 0;line-height:1.5;color:inherit}
      #cartones-usuario .compra-estado[data-estado=aprobado]{--fondo:#e6f6ed;--borde:#45a879}
      #cartones-usuario .compra-estado[data-estado=pendiente]{--fondo:#fff5d6;--borde:#ddb142}
      #cartones-usuario .compra-estado[data-estado=rechazado]{--fondo:#fff0ed;--borde:#dc8176}
      #cartones-usuario .compra-estado[data-estado=otro]{--fondo:#eef2fb;--borde:#9baccd}
      #cartones-usuario .compra-ayuda{display:inline-block;margin-top:12px;padding:12px 16px;border-radius:10px;background:#173b57;color:#fff;text-decoration:none;font-weight:bold}
      #cartones-usuario .compra-cartones{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:16px}
      #cartones-usuario .compra-cartones figure{margin:0;width:min(100%,240px);text-align:center}
      #cartones-usuario .compra-cartones img{display:block;max-width:100%;height:auto;margin:8px auto}
      #cartones-usuario .consulta-aviso{padding:18px;border:2px solid #e1bd59;border-radius:14px;color:#fff;background:#17204f;line-height:1.5}
    `;
    document.head.appendChild(estilo);
    const estados = {
      aprobado: {titulo:'✅ Compra aprobada', mensaje:'Tu compra está confirmada. Estos son tus cartones para participar.'},
      pendiente: {titulo:'⏳ Compra pendiente de aprobación', mensaje:'Recibimos tu compra y está en revisión. Estos cartones todavía no están aprobados. No necesitas volver a enviar el comprobante.', paso:'Si han pasado más de 30 minutos desde tu envío, contacta a soporte.'},
      rechazado: {titulo:'❌ Compra rechazada', mensaje:'Esta compra no está aprobada. Los cartones de esta compra pueden quedar libres y ser comprados por otra persona. Contacta a soporte para revisar tu comprobante y saber cómo continuar.', paso:'No vuelvas a pagar sin confirmar primero el motivo con soporte.'},
      otro: {titulo:'ℹ️ Estado por confirmar', mensaje:'No podemos confirmar el estado de esta compra. Contacta a soporte antes de realizar otro pago.'}
    };
    function texto(padre, etiqueta, contenido) {
      const el = document.createElement(etiqueta); el.textContent = contenido; padre.appendChild(el); return el;
    }
    function aviso(mensaje) { cont.replaceChildren(); texto(cont, 'p', mensaje).className = 'consulta-aviso'; }
    function ayuda(padre) {
      const enlace = document.querySelector('#redes-sociales a[href^="https://wa.me/"]');
      if (!enlace) return;
      try {
        const url = new URL(enlace.href);
        if (url.hostname !== 'wa.me' || !/^\/\d+$/.test(url.pathname)) return;
        url.search = ''; url.searchParams.set('text', 'Hola, necesito ayuda para verificar mi compra en BingoAndino75.');
        const a = texto(padre, 'a', 'Contactar a soporte'); a.href = url.href;
        a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'compra-ayuda';
      } catch { /* La orientación de soporte sigue visible aunque no haya enlace. */ }
    }
    function renderizar(compras) {
      cont.replaceChildren();
      if (!compras.length) {
        aviso('No encontramos compras con esta cédula. Revisa el número e inténtalo de nuevo. Si ya enviaste tu comprobante, contacta a soporte antes de realizar otro pago.');
        ayuda(cont); return;
      }
      texto(cont, 'p', `${compras.length === 1 ? 'Se encontró 1 compra' : `Se encontraron ${compras.length} compras`}. Revisa el estado de cada una.`);
      for (const compra of compras) {
        const estado = Object.hasOwn(estados, compra.estado) ? compra.estado : 'otro';
        const info = estados[estado];
        const tarjeta = document.createElement('article'); tarjeta.className = 'compra-estado'; tarjeta.dataset.estado = estado;
        texto(tarjeta, 'h3', info.titulo); texto(tarjeta, 'p', info.mensaje);
        const numeros = Array.isArray(compra.cartones) ? [...new Set(compra.cartones.map(String).filter(n => /^\d{1,7}$/.test(n)))] : [];
        texto(tarjeta, 'p', numeros.length ? `Cartones: ${numeros.join(', ')}` : 'Sin cartones registrados. Contacta a soporte para revisar esta compra.');
        if (info.paso) texto(tarjeta, 'p', info.paso);
        if (estado !== 'aprobado' || !numeros.length) ayuda(tarjeta);
        // Las imágenes rechazadas no se presentan como cartones válidos para jugar.
        if (estado === 'aprobado' || estado === 'pendiente') {
          const galeria = document.createElement('div'); galeria.className = 'compra-cartones';
          if (typeof global.urlCartonWebP === 'function') for (const numero of numeros) {
            const figura = document.createElement('figure');
            texto(figura, 'figcaption', `Cartón ${numero}${estado === 'pendiente' ? ' · Pendiente de aprobación' : ' · Aprobado'}`);
            const img = document.createElement('img'); img.src = global.urlCartonWebP(numero);
            img.alt = `Cartón ${numero}`; img.loading = 'lazy'; img.className = 'carton-consulta-img';
            figura.appendChild(img); galeria.appendChild(figura);
          }
          tarjeta.appendChild(galeria);
        }
        cont.appendChild(tarjeta);
      }
    }
    let version = 0, pendiente = null, cedulaPendiente = null;
    function restaurarBoton() { if (boton) { boton.disabled = false; boton.textContent = 'Consultar'; boton.removeAttribute('aria-busy'); } cont.removeAttribute('aria-busy'); }
    campo.addEventListener('input', () => { version++; pendiente = null; cedulaPendiente = null; cont.replaceChildren(); restaurarBoton(); });
    campo.addEventListener('keydown', evento => { if (evento.key === 'Enter') { evento.preventDefault(); global.consultarCartones(); } });
    global.consultarCartones = function () {
      const cedula = campo.value.trim();
      if (pendiente && cedula === cedulaPendiente) return pendiente;
      const actual = ++version;
      if (!/^\d{5,12}$/.test(cedula)) { restaurarBoton(); aviso('Ingresa la cédula usada en tu compra, solo números.'); campo.focus(); return Promise.resolve(); }
      cedulaPendiente = cedula;
      aviso('Consultando el estado de tu compra…'); cont.setAttribute('aria-busy', 'true');
      if (boton) { boton.disabled = true; boton.textContent = 'Consultando…'; boton.setAttribute('aria-busy', 'true'); }
      pendiente = Promise.resolve().then(async () => {
        let consulta = global.supabase.from('inscripciones').select('id,cartones,estado').eq('cedula', cedula).order('id', {ascending: false});
        if (typeof consulta.abortSignal === 'function' && global.AbortSignal?.timeout) consulta = consulta.abortSignal(global.AbortSignal.timeout(15000));
        const {data, error} = await consulta;
        if (actual !== version) return;
        if (error || !Array.isArray(data)) throw new Error('consulta');
        renderizar(data);
      }).catch(() => {
        if (actual === version) aviso('No pudimos consultar tu compra. Revisa tu conexión y pulsa Consultar para intentarlo de nuevo. Esto no significa que tu compra haya sido rechazada.');
      }).finally(() => { if (actual === version) { pendiente = null; cedulaPendiente = null; restaurarBoton(); } });
      return pendiente;
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalarConsultaCliente, {once: true});
  else instalarConsultaCliente();
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


// Recuperación en esta pestaña y reloj basado en la reserva registrada en el servidor.
(function (global) {
  'use strict';
  function instalarAvance() {
    if (!global.supabase || typeof global.toggleCarton !== 'function' || typeof global.iniciarContadorReserva !== 'function' || !document.getElementById('contadorReserva')) return;
    const clave = 'bingo_compra_en_curso_v1', vigencia = 30 * 60 * 1000;
    const campos = ['nombre', 'telefono', 'cedula', 'referido', 'cantidadCartones', 'referencia4dig'];
    let sellos = new Map(), vence = 0, reloj = null, sincronizando = null, demora = null, enviando = false, restaurando = false, envioIntentado = false, trabajando = false;
    const numeros = () => Array.isArray(usuario.cartones) ? usuario.cartones.map(Number).filter(Number.isSafeInteger) : [];
    function leer() {
      try {
        const valor = JSON.parse(global.sessionStorage.getItem(clave));
        if (!valor || valor.schema !== 1 || !Number.isFinite(valor.guardado) || Date.now() - valor.guardado > vigencia || valor.guardado > Date.now() + 60000) return null;
        if (!valor.campos || !Array.isArray(valor.reservas) || valor.reservas.length > 10000) return null;
        return valor;
      } catch { return null; }
    }
    function escribir(valor) { try { if (valor) global.sessionStorage.setItem(clave, JSON.stringify(valor)); else global.sessionStorage.removeItem(clave); } catch { /* El bloqueo del almacenamiento no impide comprar. */ } }
    function avisar(mensaje) {
      let nodo = document.getElementById('avance-compra-estado');
      if (!nodo) { nodo = document.createElement('p'); nodo.id = 'avance-compra-estado'; nodo.setAttribute('role','status'); nodo.style.cssText='padding:14px;border:2px solid #ffbf36;border-radius:12px;background:#17204f;color:#fff;line-height:1.5'; }
      const seccion = document.querySelector('section:not(.oculto)');
      if (seccion) seccion.prepend(nodo);
      nodo.textContent = mensaje;
    }
    function guardar() {
      if (restaurando || !trabajando) return;
      const valores = Object.fromEntries(campos.map(id => [id, String(document.getElementById(id)?.value || '').slice(0, id === 'referencia4dig' ? 64 : 160)]));
      if (!valores.nombre && !valores.cedula) return;
      const mismaCedula = String(usuario.cedula || '').trim() === valores.cedula.trim();
      const seleccion = mismaCedula ? numeros() : [];
      escribir({schema:1, guardado:Date.now(), campos:valores, cantidad:cantidadPermitida, version:String(versionCartones), precio:precioPorCarton, envioIntentado,
        reservas:seleccion.map(numero => ({numero, sello:sellos.get(numero) || null})), etapa:document.querySelector('section:not(.oculto)')?.id || 'inscripcion'});
    }
    function borrar() { escribir(null); document.getElementById('retomar-compra')?.remove(); }
    function actualizarReloj() {
      const restantes = vence ? Math.max(0, Math.ceil((vence - Date.now()) / 1000)) : null;
      for (const id of ['contadorReserva','contadorReservaSeleccion']) {
        const nodo = document.getElementById(id); if (!nodo) continue;
        nodo.textContent = !numeros().length ? '' : restantes === null ? '⏳ Verificando el tiempo de tu reserva…' : restantes === 0 && enviando ? '⏳ Envío en curso. Espera la confirmación.' : restantes === 0 ? '⛔ La reserva venció. Debes volver a elegir tus cartones.' : `⏳ Tiempo de reserva: ${Math.floor(restantes / 60)}:${String(restantes % 60).padStart(2,'0')}`;
        nodo.style.borderColor = restantes !== null && restantes <= 60 ? '#ef476f' : '#ffbf36';
      }
      if (vence && restantes === 0 && !enviando) {
        usuario.cartones = []; sellos.clear(); vence = 0; global.clearInterval(reloj); reloj = null; guardar(); pintarSeleccion();
        avisar('Tu reserva venció. Vuelve a seleccionar cartones antes de continuar. Si ya realizaste el pago, contacta a soporte antes de pagar nuevamente.');
        // La limpieza del servidor libera las reservas vencidas; aquí nunca se borra una compra enviada.
      }
    }
    function arrancarReloj() {
      if (typeof timerReserva !== 'undefined') global.clearInterval(timerReserva);
      global.clearInterval(reloj); actualizarReloj();
      if (vence && numeros().length) reloj = global.setInterval(actualizarReloj, 1000);
    }
    const contador = document.createElement('div'); contador.id='contadorReservaSeleccion'; contador.className='contador-reserva';
    document.getElementById('cartones')?.querySelector('h2')?.after(contador);
    async function consultar(cedula, seleccion) {
      const limitar = consulta => typeof consulta.abortSignal === 'function' && global.AbortSignal?.timeout ? consulta.abortSignal(global.AbortSignal.timeout(15000)) : consulta;
      const resultados = await Promise.all([
        limitar(global.supabase.from('cartones').select('numero,cedula,reserved_at,created_at,partida_id').eq('cedula', cedula).in('numero', seleccion)),
        limitar(global.supabase.from('inscripciones').select('cartones').eq('cedula', cedula).in('estado', ['pendiente','aprobado']))
      ]);
      if (resultados.some(r => r.error || !Array.isArray(r.data))) throw new Error('No se pudo verificar la reserva');
      return {filas:resultados[0].data, enviadas:new Set(resultados[1].data.flatMap(r => (r.cartones || []).map(Number)))};
    }
    function validar(filas, enviadas, seleccion, anteriores = null) {
      const validas = new Map();
      for (const fila of filas) {
        const numero=Number(fila.numero), sello=fila.reserved_at || fila.created_at, tiempo=Date.parse(sello);
        if (!seleccion.includes(numero) || fila.partida_id != null || enviadas.has(numero) || !Number.isFinite(tiempo) || tiempo + 300000 <= Date.now()) continue;
        if (anteriores && anteriores.get(numero) !== sello) continue;
        validas.set(numero,sello);
      }
      return validas;
    }
    function aplicar(validas) {
      sellos=validas; usuario.cartones=numeros().filter(n => validas.has(n));
      vence=sellos.size ? Math.min(...[...sellos.values()].map(s => Date.parse(s) + 300000)) : 0;
      arrancarReloj(); guardar(); pintarSeleccion();
    }
    const estiloSeleccion=document.createElement('style');
    estiloSeleccion.textContent='#contenedor-cartones .carton.seleccionado{background:linear-gradient(145deg,#168443,#0c6631);border-color:#b5f5c7;color:#fff;box-shadow:0 0 16px #16844366;opacity:1;filter:none}#contenedor-cartones .carton.bloqueado{pointer-events:none}';
    document.head.appendChild(estiloSeleccion);
    function pintarSeleccion() {
      const elegidos = numeros();
      const limite=modoCartones==='fijo'?cantidadFijaCartones:cantidadPermitida;
      const completa=limite>0 && elegidos.length>=limite;
      document.querySelectorAll('#contenedor-cartones .carton').forEach(nodo => {
        const numero=Number(nodo.textContent);
        if (elegidos.includes(numero)) {
          nodo.classList.remove('ocupado','bloqueado'); nodo.classList.add('seleccionado');
          nodo.setAttribute('aria-disabled','false'); nodo.onclick=()=>global.toggleCarton(numero,nodo);
        } else {
          nodo.classList.remove('seleccionado');
          const ocupado=nodo.classList.contains('ocupado') || (typeof cartonesOcupados!=='undefined' && cartonesOcupados.map(Number).includes(numero));
          nodo.classList.toggle('ocupado',ocupado);
          nodo.classList.toggle('bloqueado',completa && !ocupado);
          nodo.setAttribute('aria-disabled',String(ocupado || completa));
          if(ocupado || completa)nodo.onclick=null;
          else if(typeof global.abrirModalCarton==='function')nodo.onclick=()=>global.abrirModalCarton(numero,nodo);
        }
      });
      global.actualizarMonto?.();
    }
    function sincronizar() {
      if (sincronizando) return sincronizando;
      const cedula=String(usuario.cedula || '').trim(), seleccion=numeros();
      if (!cedula || !seleccion.length) { sellos.clear(); vence=0; arrancarReloj(); guardar(); return Promise.resolve(false); }
      sincronizando=consultar(cedula,seleccion).then(({filas,enviadas})=>{
        if (String(usuario.cedula || '').trim() !== cedula || numeros().join(',') !== seleccion.join(',')) { programar(); return false; }
        aplicar(validar(filas,enviadas,seleccion)); return numeros().length === seleccion.length;
      }).catch(()=>{ avisar('No se pudo comprobar tu reserva. Revisa tu conexión antes de continuar.'); return false; }).finally(()=>{sincronizando=null;});
      return sincronizando;
    }
    function programar() { global.clearTimeout(demora); demora=global.setTimeout(sincronizar,350); }
    for (const nombre of ['toggleCarton','seleccionarAleatorioSeguro']) {
      const original=global[nombre]; if (typeof original!=='function') continue;
      global[nombre]=async function(...args) { const resultado=await original.apply(this,args); envioIntentado=false; trabajando=true; pintarSeleccion(); guardar(); programar(); return resultado; };
    }
    const cargar=global.cargarCartones;
    if(typeof cargar==='function') global.cargarCartones=async function(...args){const resultado=await cargar.apply(this,args);pintarSeleccion();return resultado;};
    global.iniciarContadorReserva=function(){ if (!vence) programar(); arrancarReloj(); };
    const abrir=global.mostrarVentana;
    global.mostrarVentana=async function(id,...args) {
      if(id==='pago' && numeros().length) {
        const verificada=await sincronizar();
        if(!verificada || !vence || vence<=Date.now() || sellos.size!==numeros().length || !numeros().length) { avisar('No pudimos confirmar todos tus cartones. Revisa la selección antes de continuar.'); return; }
      }
      const resultado=await abrir.call(this,id,...args); if(['inscripcion','cantidad','cartones','pago'].includes(id)){trabajando=true;guardar();} return resultado;
    };
    const enviar=global.enviarComprobante;
    let envio=null;
    if(typeof enviar==='function') global.enviarComprobante=function(...args) {
      if(envio)return envio;
      const boton=document.getElementById('btnEnviarComprobante'), texto=boton?.textContent, deshabilitado=boton?.disabled;
      if(boton){boton.disabled=true;boton.textContent='Verificando reserva…';boton.setAttribute('aria-busy','true');}
      envio=(async()=>{
        const verificada=await sincronizar();
        if(!verificada || !vence || vence<=Date.now() || !numeros().length) { avisar('La reserva no está vigente o no se pudo verificar. Vuelve a seleccionar tus cartones. Si ya pagaste, contacta a soporte.');return; }
        enviando=true;envioIntentado=true;trabajando=true;guardar();
        try { return await enviar.apply(this,args); }
        finally { enviando=false;actualizarReloj(); }
      })().finally(()=>{envio=null;if(boton){boton.disabled=deshabilitado;boton.textContent=texto;boton.removeAttribute('aria-busy');}});return envio;
    };
    document.addEventListener('input', evento=>{if(campos.includes(evento.target.id)){trabajando=true;guardar();}});
    document.addEventListener('change', evento=>{if(campos.includes(evento.target.id)){trabajando=true;guardar();}});
    global.addEventListener('pagehide',guardar);
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden){actualizarReloj();if(numeros().length)programar();} });
    global.addEventListener('online',()=>{if(numeros().length)programar();});
    const borrador=leer();
    if(!borrador){escribir(null);return;}
    const caja=document.createElement('div');caja.id='retomar-compra';caja.style.cssText='padding:16px;border:2px solid #ffbf36;border-radius:14px;background:#17204f;color:#fff;margin:16px 0';
    const texto=document.createElement('p');texto.textContent=borrador.envioIntentado?'Guardamos tu último intento de compra. Comprueba si el comprobante se envió antes de volver a pagar o enviar.':'Tienes una compra sin terminar en esta pestaña. Puedes recuperar tus datos y comprobar si tus cartones siguen reservados.';caja.appendChild(texto);
    const retomar=document.createElement('button');retomar.type='button';retomar.textContent=borrador.envioIntentado?'Comprobar mi compra':'Retomar compra';caja.appendChild(retomar);
    const descartar=document.createElement('button');descartar.type='button';descartar.textContent='Descartar avance';caja.appendChild(descartar);
    descartar.onclick=()=>{borrar();};
    retomar.onclick=async()=>{
      if(restaurando)return;let recuperado=false;restaurando=true;retomar.disabled=true;retomar.textContent='Comprobando reserva…';
      try{
        const inicio=Date.now();while(!sistemaListo && Date.now()-inicio<15000) await new Promise(resolve=>global.setTimeout(resolve,100));
        if(!sistemaListo)throw new Error('carga');
        const cantidad=Number(borrador.cantidad || borrador.campos.cantidadCartones);
        if(!Number.isInteger(cantidad)||cantidad<1||cantidad>totalCartones) {
          for(const id of ['nombre','telefono','cedula','referido']) if(document.getElementById(id))document.getElementById(id).value=String(borrador.campos[id]||'').slice(0,160);
          await abrir.call(global,'inscripcion');avisar('Recuperamos tus datos. Revisa la inscripción y elige la cantidad de cartones.');borrar();return;
        }
        const seleccion=borrador.reservas.map(r=>Number(r.numero)).filter(n=>Number.isSafeInteger(n)&&n>=1&&n<=totalCartones);
        const cedula=String(borrador.campos.cedula||'').trim();
        const consulta=seleccion.length?await consultar(cedula,seleccion):{filas:[],enviadas:new Set()};
        for(const id of campos){const nodo=document.getElementById(id);if(nodo&&borrador.campos[id]!=null)nodo.value=String(borrador.campos[id]).slice(0,160);}
        recuperado=true;trabajando=true;envioIntentado=!!borrador.envioIntentado;
        for(const id of ['nombre','telefono','cedula','referido'])usuario[id]=String(borrador.campos[id]||'').trim();
        cantidadPermitida=modoCartones==='fijo'?cantidadFijaCartones:cantidad;usuario.cartones=seleccion;
        const anteriores=new Map(borrador.reservas.map(r=>[Number(r.numero),r.sello]));
        const validas=String(borrador.version)===String(versionCartones)?validar(consulta.filas,consulta.enviadas,seleccion,anteriores):new Map();
        aplicar(validas);
        if(seleccion.some(n=>consulta.enviadas.has(n))){usuario.cartones=[];sellos.clear();vence=0;borrar();await abrir.call(global,'usuario');document.getElementById('consulta-cedula').value=cedula;avisar('Ya existe una compra enviada con estos cartones. Consulta su estado antes de volver a enviar o pagar.');return;}
        const completa=numeros().length===cantidadPermitida&&vence>Date.now();
        await abrir.call(global,borrador.etapa==='inscripcion'?'inscripcion':completa&&borrador.etapa==='pago'?'pago':numeros().length?'cartones':'cantidad');
        pintarSeleccion();arrancarReloj();restaurando=false;guardar();caja.remove();
        avisar(completa?'Recuperamos tus datos y la reserva vigente. Revisa el monto y vuelve a seleccionar el archivo del comprobante; el navegador no conserva ese archivo al recargar.':'Recuperamos tus datos. Los cartones vencidos o no confirmados no se recuperaron. Revisa la cantidad y vuelve a elegir los que falten. Si ya pagaste, contacta a soporte antes de pagar nuevamente.');
      }catch{avisar('No se pudo recuperar la compra. Revisa tu conexión y vuelve a pulsar Retomar compra.');}
      finally{restaurando=false;retomar.disabled=false;retomar.textContent='Retomar compra';if(recuperado && document.getElementById('retomar-compra'))guardar();}
    };
    document.getElementById('bienvenida')?.prepend(caja);
    try {
      const recarga=global.performance?.getEntriesByType?.('navigation')?.[0]?.type==='reload';
      const pasoCompra=['inscripcion','cantidad','cartones','pago'].includes(borrador.etapa);
      const administrador=global.sessionStorage.getItem('admin_session_token');
      if(recarga && pasoCompra && !administrador) global.queueMicrotask(()=>{
        avisar('Recuperando tu compra. Estamos comprobando los datos y la reserva…');
        retomar.onclick();
      });
    } catch { /* Si el navegador no informa la recarga, queda disponible Retomar compra. */ }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',instalarAvance,{once:true});else instalarAvance();
})(window);

// Historial público: Atrás/Adelante cambia de paso sin guardar datos del cliente en la URL.
(function (global) {
  'use strict';
  function instalarHistorialCompra() {
    if (typeof global.mostrarVentana !== 'function' || !document.getElementById('bienvenida')) return;
    const publicas=new Set(['bienvenida','inscripcion','cantidad','cartones','pago','usuario','lista-aprobados','top-compradores','ganadores']);
    const pasos=['bienvenida','inscripcion','cantidad','cartones','pago'];
    const campo='_bingoVista';
    const actual=()=>document.querySelector('section:not(.oculto)')?.id;
    let ultima=publicas.has(actual())?actual():'bienvenida', restaurando=false, destino=null;
    function escribir(id,reemplazar=false){
      try{global.history[reemplazar?'replaceState':'pushState']({[campo]:id},'');}catch{/* Si no hay History API, siguen funcionando los botones de la página. */}
    }
    // El historial comienza en la vista visible; la recuperación validada registra luego el paso restaurado.
    escribir(ultima,true);
    function registrar(){
      const id=actual();
      if(restaurando || !publicas.has(id) || id===ultima)return;
      const desde=pasos.indexOf(ultima),hasta=pasos.indexOf(id);
      // Retomar puede abrir pago directamente: Atrás debe encontrar antes los pasos de compra.
      if(desde>=0 && hasta>desde+1)for(let i=desde+1;i<hasta;i++)escribir(pasos[i]);
      escribir(id);ultima=id;
    }
    const observador=new global.MutationObserver(registrar);
    document.querySelectorAll('section').forEach(seccion=>observador.observe(seccion,{attributes:true,attributeFilter:['class']}));
    function rutaPermitida(id){
      if(['cantidad','cartones','pago'].includes(id)){
        if(typeof usuario==='undefined' || !usuario.nombre || !usuario.telefono || !usuario.cedula)return 'inscripcion';
        if(id!=='cantidad' && (typeof cantidadPermitida==='undefined' || cantidadPermitida<1))return 'cantidad';
        if(id==='pago'){
          const requerida=typeof modoCartones!=='undefined' && modoCartones==='fijo'?cantidadFijaCartones:cantidadPermitida;
          if(!Array.isArray(usuario.cartones) || usuario.cartones.length!==requerida)return 'cartones';
        }
      }
      return id;
    }
    global.addEventListener('popstate',evento=>{
      const id=evento.state?.[campo];if(!publicas.has(id))return;
      destino=id;
      if(restaurando)return;
      restaurando=true;
      (async()=>{
        while(destino){
          const solicitado=destino;destino=null;
          const ruta=rutaPermitida(solicitado);
          try{
            if(ruta==='ganadores' && typeof global.mostrarSeccion==='function')await global.mostrarSeccion(ruta);
            else await global.mostrarVentana(ruta);
          }catch{
            await global.mostrarVentana('bienvenida');
          }
          if(destino)continue;
          const mostrada=actual();ultima=publicas.has(mostrada)?mostrada:'bienvenida';
          // Las validaciones de ventas, cantidad y reserva pueden impedir abrir el paso solicitado.
          escribir(ultima,true);
        }
      })().finally(()=>{restaurando=false;registrar();});
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',instalarHistorialCompra,{once:true});else instalarHistorialCompra();
})(window);
