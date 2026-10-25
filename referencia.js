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
