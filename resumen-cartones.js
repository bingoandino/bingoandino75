(function(global){
 'use strict';
 function install(){
  const grid=document.getElementById('contenedor-cartones');if(!grid||document.getElementById('resumen-seleccion-cartones'))return;
  const style=document.createElement('style');
  style.textContent='#resumen-seleccion-cartones{position:sticky;top:8px;z-index:20;box-sizing:border-box;margin:14px auto;padding:12px 14px;border:2px solid #bb9c52;border-radius:16px;background:#fffdf8;color:#4b174f;box-shadow:0 4px 12px #4b174f18;text-align:center;width:100%}#resumen-seleccion-cartones strong{display:block;font-size:20px;line-height:1.35;font-weight:800}#numeros-seleccionados-cartones{display:flex;justify-content:center;flex-wrap:wrap;gap:7px;max-height:90px;overflow-y:auto;overscroll-behavior:contain;margin-top:8px}#numeros-seleccionados-cartones span{display:inline-block;min-width:38px;box-sizing:border-box;border-radius:9px;padding:6px 10px;background:#087f4b;color:#fff;font-size:20px;font-weight:800;line-height:1.2}#numeros-seleccionados-cartones p{margin:0;color:#705d73;font-size:17px;line-height:1.35}@media(prefers-reduced-motion:reduce){#numeros-seleccionados-cartones{scroll-behavior:auto}}';
  document.head.append(style);
  style.textContent+='body:has(#cartones:not(.oculto)){overflow-x:clip}';
  const box=document.createElement('div');box.id='resumen-seleccion-cartones';box.setAttribute('role','region');box.setAttribute('aria-label','Tus cartones seleccionados');
  const heading=document.createElement('strong');heading.setAttribute('aria-live','polite');heading.setAttribute('aria-atomic','true');
  const numbers=document.createElement('div');numbers.id='numeros-seleccionados-cartones';numbers.setAttribute('role','list');numbers.setAttribute('aria-label','Números de tus cartones');numbers.tabIndex=0;
  box.append(heading,numbers);grid.before(box);
  let previous='';
  function update(){
   const selected=typeof usuario!=='undefined'&&Array.isArray(usuario.cartones)?[...new Set(usuario.cartones.map(Number).filter(Number.isSafeInteger))]:[];
   const limit=typeof modoCartones!=='undefined'&&modoCartones==='fijo'&&typeof cantidadFijaCartones!=='undefined'?Number(cantidadFijaCartones):typeof cantidadPermitida!=='undefined'?Number(cantidadPermitida):0;
   const signature=selected.join(',')+'|'+limit;if(signature===previous)return;previous=signature;
   heading.textContent=selected.length+(limit>0?' de '+limit:'')+' '+(selected.length===1?'cartón seleccionado':'cartones seleccionados');
   const fragment=document.createDocumentFragment();
   if(!selected.length){const empty=document.createElement('p');empty.textContent='Aquí verás los números que vayas eligiendo.';fragment.append(empty);}
   for(const n of selected){const chip=document.createElement('span');chip.textContent=String(n);chip.setAttribute('role','listitem');chip.setAttribute('aria-label','Cartón '+n);fragment.append(chip);}
   numbers.replaceChildren(fragment);
   numbers.scrollTop=numbers.scrollHeight;
  }
  const original=global.actualizarMonto;
  if(typeof original==='function')global.actualizarMonto=function(...args){const result=original.apply(this,args);update();return result;};
  update();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
