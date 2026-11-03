(function(global){
 'use strict';
 function install(){
  const grid=document.getElementById('contenedor-cartones');if(!grid||document.getElementById('resumen-seleccion-cartones'))return;
  const style=document.createElement('style');
  style.textContent='#resumen-seleccion-cartones{position:sticky;top:8px;z-index:20;box-sizing:border-box;margin:14px auto;padding:12px 14px;border:2px solid #bb9c52;border-radius:16px;background:#fffdf8;color:#4b174f;box-shadow:0 4px 12px #4b174f18;text-align:center;width:100%}#resumen-seleccion-cartones strong{display:block;font-size:20px;line-height:1.35;font-weight:800}#numeros-seleccionados-cartones{display:flex;justify-content:center;flex-wrap:wrap;gap:7px;max-height:90px;overflow-y:auto;overscroll-behavior:contain;margin-top:8px}#numeros-seleccionados-cartones span{display:inline-block;min-width:38px;box-sizing:border-box;border-radius:9px;padding:6px 10px;background:#087f4b;color:#fff;font-size:20px;font-weight:800;line-height:1.2}#numeros-seleccionados-cartones p{margin:0;color:#705d73;font-size:17px;line-height:1.35}@media(prefers-reduced-motion:reduce){#numeros-seleccionados-cartones{scroll-behavior:auto}}';
  style.textContent+='#resumen-seleccion-cartones{display:flex;align-items:center;gap:10px;margin:10px auto;padding:7px 10px;border-width:1px;border-radius:12px;min-height:46px;text-align:left}#resumen-seleccion-cartones strong{flex:0 0 auto;font-size:15px;line-height:1.2}#numeros-seleccionados-cartones{flex:1;min-width:0;flex-wrap:nowrap;justify-content:flex-start;gap:5px;max-height:none;overflow-x:auto;overflow-y:hidden;margin:0;scrollbar-width:thin}#numeros-seleccionados-cartones span{flex:0 0 auto;min-width:29px;padding:4px 6px;font-size:16px;border-radius:7px;text-align:center}#numeros-seleccionados-cartones p{font-size:13px;white-space:nowrap}';
  style.textContent+='#continuar-seleccion-cartones{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-height:42px;margin:0;padding:8px 14px;border:2px solid #bb9c52;border-radius:11px;background:#4b174f;color:#fffdf8;font:800 14px/1.15 system-ui,sans-serif;white-space:nowrap;cursor:pointer;box-shadow:0 2px 8px #4b174f22}#continuar-seleccion-cartones[hidden]{display:none!important}#continuar-seleccion-cartones:focus-visible{outline:3px solid #bb9c52;outline-offset:3px}@media(max-width:370px){#resumen-seleccion-cartones:has(#continuar-seleccion-cartones:not([hidden])){flex-wrap:wrap}#continuar-seleccion-cartones{width:100%}}';
  document.head.append(style);
  style.textContent+='body:has(#cartones:not(.oculto)){overflow-x:clip}';
  const box=document.createElement('div');box.id='resumen-seleccion-cartones';box.setAttribute('role','region');box.setAttribute('aria-label','Tus cartones seleccionados');
  const heading=document.createElement('strong');heading.setAttribute('aria-live','polite');heading.setAttribute('aria-atomic','true');
  const numbers=document.createElement('div');numbers.id='numeros-seleccionados-cartones';numbers.setAttribute('role','list');numbers.setAttribute('aria-label','Números de tus cartones');numbers.tabIndex=0;
  const continuar=document.createElement('button');
  continuar.id='continuar-seleccion-cartones';
  continuar.type='button';
  continuar.textContent='Continuar al pago →';
  continuar.setAttribute('aria-label','Continuar al pago con los cartones elegidos');
  continuar.hidden=true;
  continuar.disabled=true;
  continuar.addEventListener('click',()=>{
   const elegidos=typeof usuario!=='undefined'&&Array.isArray(usuario.cartones)?usuario.cartones.length:0;
   const limite=typeof modoCartones!=='undefined'&&modoCartones==='fijo'&&typeof cantidadFijaCartones!=='undefined'?Number(cantidadFijaCartones):typeof cantidadPermitida!=='undefined'?Number(cantidadPermitida):0;
   // Validar otra vez al tocar. mostrarVentana conserva su validación de cantidad.
   if(limite>0&&elegidos===limite&&typeof global.mostrarVentana==='function')global.mostrarVentana('pago');
  });
  box.append(heading,numbers,continuar);grid.before(box);
  let previous='';
  function update(){
   const selected=typeof usuario!=='undefined'&&Array.isArray(usuario.cartones)?[...new Set(usuario.cartones.map(Number).filter(Number.isSafeInteger))]:[];
   const limit=typeof modoCartones!=='undefined'&&modoCartones==='fijo'&&typeof cantidadFijaCartones!=='undefined'?Number(cantidadFijaCartones):typeof cantidadPermitida!=='undefined'?Number(cantidadPermitida):0;
   const signature=selected.join(',')+'|'+limit;if(signature===previous)return;previous=signature;
   const completo=limit>0&&selected.length===limit;
   continuar.hidden=!completo;
   continuar.disabled=!completo;
   heading.textContent=selected.length+(limit>0?' de '+limit:'')+' elegidos';
   const fragment=document.createDocumentFragment();
   if(!selected.length){const empty=document.createElement('p');empty.textContent='Toca un número';fragment.append(empty);}
   for(const n of selected){const chip=document.createElement('span');chip.textContent=String(n);chip.setAttribute('role','listitem');chip.setAttribute('aria-label','Cartón '+n);fragment.append(chip);}
   numbers.replaceChildren(fragment);
   numbers.scrollLeft=numbers.scrollWidth;
  }
  const original=global.actualizarMonto;
  if(typeof original==='function')global.actualizarMonto=function(...args){const result=original.apply(this,args);update();return result;};
  update();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
