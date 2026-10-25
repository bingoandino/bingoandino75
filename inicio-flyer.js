/* Ampliar el flyer vigente sin modificar su archivo ni el acceso del logo. */
(() => {
  const imagen = document.getElementById('imagenPremiosInicio');
  if (!imagen) return;
  imagen.tabIndex = 0;
  imagen.setAttribute('role', 'button');
  imagen.setAttribute('aria-label', 'Ampliar imagen del sorteo');
  imagen.setAttribute('aria-haspopup', 'dialog');
  const ayuda = document.createElement('p');
  ayuda.className = 'flyer-ayuda';
  ayuda.textContent = 'Toca la imagen para ampliarla';
  imagen.after(ayuda);
  const sincronizar = () => { ayuda.hidden = imagen.classList.contains('oculto') || !imagen.getAttribute('src'); };
  new MutationObserver(sincronizar).observe(imagen, {attributes:true, attributeFilter:['src','class']});
  sincronizar();
  const dialogo = document.createElement('dialog');
  dialogo.id = 'flyer-ampliado';
  dialogo.setAttribute('aria-label', 'Imagen del sorteo');
  const completa = document.createElement('img');
  completa.alt = 'Información completa del sorteo';
  const cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.textContent = 'Cerrar';
  dialogo.append(completa, cerrar);
  document.body.append(dialogo);
  const abrir = () => {
    if (imagen.classList.contains('oculto') || !imagen.getAttribute('src') || dialogo.open) return;
    completa.src = imagen.currentSrc || imagen.src;
    dialogo.showModal();
  };
  imagen.addEventListener('click', abrir);
  imagen.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
  });
  cerrar.addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('click', e => { if (e.target === dialogo) {
    const r = dialogo.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialogo.close();
  }});
  dialogo.addEventListener('close', () => { completa.removeAttribute('src'); imagen.focus({preventScroll:true}); });
})();
