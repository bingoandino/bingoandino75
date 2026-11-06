(function(){
'use strict';
const fecha=new URL(window.location.href).searchParams.get('premios');
const valida=typeof fecha==='string'&&/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(fecha)&&!Number.isNaN(Date.parse(fecha+'T00:00:00Z'))&&new Date(fecha+'T00:00:00Z').toISOString().slice(0,10)===fecha;
if(!valida)return;
const destino=new URL('/',window.location.origin);destino.searchParams.set('premios',fecha);
const enlace=document.getElementById('ver-pagos');enlace.href=destino.href;enlace.textContent='Ver los pagos a los ganadores';
document.getElementById('estado').textContent='Abriendo los pagos del sorteo…';
window.location.replace(destino.href);
})();
