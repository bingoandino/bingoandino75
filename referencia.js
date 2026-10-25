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
