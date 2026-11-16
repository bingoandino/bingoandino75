(() => {
  'use strict';
  const form = document.getElementById('historial-form');
  if (!form) return;
  const status = document.getElementById('historial-status');
  const results = document.getElementById('historial-resultados');
  const prev = document.getElementById('historial-anterior');
  const next = document.getElementById('historial-siguiente');
  const submit = form.querySelector('[type="submit"]');
  let page = 0, filters = null, generation = 0;
  const banks = {'0102':'Venezuela','0134':'Banesco','0105':'Mercantil','0108':'Provincial','0191':'BNC','0151':'BFC','0172':'Bancamiga','0114':'Bancaribe','0163':'Tesoro'};
  function line(card, title, value) {
    const p = document.createElement('p');
    const label = document.createElement('strong');
    label.textContent = title + ': ';
    p.append(label, document.createTextNode(value == null || value === '' ? 'No registrado' : String(value)));
    card.append(p);
  }
  function clear() {
    generation++; results.replaceChildren(); status.textContent = ''; filters = null; page = 0;
    prev.hidden = next.hidden = true; submit.disabled = false;
  }
  async function search(target) {
    const token = sessionStorage.getItem('admin_session_token');
    if (!token) { clear(); status.textContent = 'Vuelve a entrar al administrador.'; return; }
    const current = ++generation;
    submit.disabled = prev.disabled = next.disabled = true;
    results.replaceChildren(); status.textContent = 'Buscando en sorteos anteriores…';
    try {
      const {data,error} = await window.supabase.rpc('rpc_buscar_historial_admin', {
        _session_token: token,
        _device_id: sessionStorage.getItem('device_id') || localStorage.getItem('admin_device_id') || localStorage.getItem('device_id'),
        ...filters, _pagina: target
      });
      if (current !== generation || sessionStorage.getItem('admin_session_token') !== token) return;
      if (error) throw error;
      page = target;
      for (const row of data.registros) {
        const card = document.createElement('article'); card.className = 'historial-card';
        const heading = document.createElement('h4'); heading.textContent = row.nombre || 'Sin nombre'; card.append(heading);
        line(card,'Cédula',row.cedula); line(card,'Teléfono de contacto',row.telefono);
        line(card,'Cartones',Array.isArray(row.cartones) ? row.cartones.join(', ') : row.cartones);
        const gift = ['premio_dinamica','premio_slot'].includes(row.origen);
        line(card,'Registro',gift ? (row.origen==='premio_slot'?'Cartón gratis · Ruleta':'Cartón gratis · Dinámica') : row.origen==='soporte'?'Compra por soporte':'Compra');
        line(card,'Estado',row.estado); line(card,'Monto',row.monto == null ? null : `${row.monto} Bs`);
        line(card,'Referencia',row.referencia);
        line(card,'Pago móvil',`${banks[row.pago_banco] || row.pago_banco || 'Banco no registrado'} · ${row.pago_telefono || 'Sin teléfono'} · C.I. ${row.pago_cedula || 'No registrada'}`);
        line(card,'Respaldado',new Date(row.respaldo).toLocaleString('es-VE',{timeZone:'America/Caracas'}));
        line(card,'N.º de registro',row.id); results.append(card);
      }
      status.textContent = data.total ? `${data.total} registros encontrados · Página ${page+1} de ${Math.ceil(data.total/50)}. Las compras repetidas en respaldos se muestran una sola vez.` : 'No se encontraron registros en los respaldos disponibles.';
      prev.hidden = page===0; next.hidden = (page+1)*50>=data.total;
    } catch (error) {
      if (current !== generation) return;
      status.textContent = error.code==='42501' ? 'Tu sesión venció o no tiene permiso. Vuelve a entrar al administrador.' : 'No se pudo consultar el historial. Revisa la conexión y vuelve a buscar.';
      prev.hidden = next.hidden = true;
    } finally {
      if (current===generation) submit.disabled = prev.disabled = next.disabled = false;
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const text = form.elements.historialTexto.value.trim();
    const from = form.elements.historialDesde.value, to = form.elements.historialHasta.value;
    if (text.length<3 && !from && !to) { status.textContent='Escribe al menos 3 caracteres o selecciona una fecha.'; return; }
    if (from && to && from>to) { status.textContent='La fecha inicial debe ser anterior o igual a la final.'; return; }
    filters = {_texto:text,_desde:from||null,_hasta:to||null}; search(0);
  });
  form.addEventListener('reset',clear);
  prev.addEventListener('click',()=>search(page-1)); next.addEventListener('click',()=>search(page+1));
  const panel = document.getElementById('admin-panel');
  new MutationObserver(()=> { if(panel.classList.contains('oculto')) { clear(); form.reset(); } }).observe(panel,{attributes:true,attributeFilter:['class']});
})();
