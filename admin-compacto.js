(function () {
  'use strict';
  function instalar() {
    const panel = document.getElementById('admin-panel');
    const tabla = document.getElementById('tabla-comprobantes');
    const contenedor = tabla?.closest('.table-wrapper');
    if (!panel || !tabla || !contenedor) return;
    const movil = window.matchMedia('(max-width: 900px)');
    function ajustar() {
      if (!movil.matches) { tabla.style.removeProperty('--admin-table-scale'); return; }
      const estilo = window.getComputedStyle(contenedor);
      const ancho = contenedor.clientWidth - (parseFloat(estilo.paddingLeft) || 0) - (parseFloat(estilo.paddingRight) || 0);
      if (ancho <= 0) return;
      const escala = Math.min(1, ancho / 1100);
      const valor = escala.toFixed(4);
      if (tabla.style.getPropertyValue('--admin-table-scale') !== valor) tabla.style.setProperty('--admin-table-scale', valor);
    }
    const ayuda = document.createElement('p');
    ayuda.className = 'admin-tabla-ayuda';
    ayuda.textContent = 'Tabla completa · Amplía con dos dedos para revisar los datos o aprobar.';
    contenedor.before(ayuda);
    if (typeof ResizeObserver === 'function') new ResizeObserver(ajustar).observe(contenedor);
    const cambios = new MutationObserver(ajustar);
    cambios.observe(panel, {attributes: true, attributeFilter: ['class']});
    const ventas = document.getElementById('tab-ventas');
    if (ventas) cambios.observe(ventas, {attributes: true, attributeFilter: ['class']});
    window.addEventListener('resize', ajustar);
    movil.addEventListener?.('change', ajustar);
    ajustar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalar, {once: true});
  else instalar();
})();
