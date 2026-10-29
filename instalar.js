(function () {
  'use strict';
  const boton = document.getElementById('btnInstalarBingo');
  const ayuda = document.getElementById('ayudaInstalarBingo');
  if (!boton || !ayuda) return;
  const modoApp = window.matchMedia?.('(display-mode: standalone)');
  let instalada = Boolean(modoApp?.matches || navigator.standalone);
  let solicitud = null;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function actualizar() {
    boton.hidden = instalada;
    // Las reglas generales de botones de la página no deben anular hidden.
    boton.style.display = instalada ? 'none' : '';
    if (instalada) { ayuda.hidden = true; boton.setAttribute('aria-expanded', 'false'); }
  }
  function instrucciones() {
    ayuda.textContent = ios
      ? 'Abre esta página en Safari. Toca Compartir (o el menú y luego Compartir), elige “Añadir a pantalla de inicio” y confirma “Añadir”. Si aparece “Abrir como app”, actívalo. Necesitas internet para usar el bingo.'
      : 'Abre el menú de tu navegador (⋮ o ⋯) y busca “Instalar aplicación” o “Añadir a pantalla de inicio”. Si no aparece, abre bingoandino75.com en Chrome o Edge actualizado. Necesitas internet para usar el bingo.';
    ayuda.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); solicitud = event; actualizar();
  });
  window.addEventListener('appinstalled', () => { instalada = true; solicitud = null; actualizar(); });
  modoApp?.addEventListener?.('change', event => { instalada = Boolean(event.matches || navigator.standalone); actualizar(); });
  boton.addEventListener('click', async () => {
    if (!solicitud) {
      if (!ayuda.hidden) { ayuda.hidden = true; boton.setAttribute('aria-expanded', 'false'); }
      else instrucciones();
      return;
    }
    const intento = solicitud; solicitud = null; boton.disabled = true;
    try {
      await intento.prompt();
      const eleccion = await intento.userChoice;
      if (eleccion?.outcome === 'accepted') { ayuda.textContent = 'Completa la instalación en el aviso de tu dispositivo.'; ayuda.hidden = false; }
    } catch { instrucciones(); }
    finally { boton.disabled = false; }
  });
  actualizar();
})();
