(function(global){
 'use strict';
 // Enlace público sin cédulas, teléfonos ni datos bancarios en la URL.
 global.abrirEnlaceVerificarCompra=async function(){
  if(new URLSearchParams(global.location.search).get('verificar')!=='1')return false;
  if(typeof global.mostrarVentana!=='function'||!document.getElementById('usuario'))return false;
  document.getElementById('modal-terminos')?.classList.add('oculto');
  await global.mostrarVentana('usuario');
  document.getElementById('consulta-cedula')?.focus({preventScroll:true});
  return true;
 };
 const abrir=()=>global.abrirEnlaceVerificarCompra().catch(()=>{});
 if(document.readyState==='loading')global.addEventListener('DOMContentLoaded',abrir,{once:true});else abrir();
})(window);
