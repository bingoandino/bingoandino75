(function(){
 'use strict';
 function install(){if(document.getElementById('asistente-andino-widget'))return;
 const button=document.createElement('button');button.id='asistente-andino-widget';button.type='button';button.setAttribute('aria-label','Abrir asistente de BingoAndino75');
 const icon=document.createElement('span');icon.className='asistente-widget-icon';icon.setAttribute('aria-hidden','true');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M4 13v-2a8 8 0 0 1 16 0v2M4 12H2v7h4v-7Zm16 0h2v7h-4v-7Zm0 7c0 2-3 3-6 3');svg.append(path);icon.append(svg);const label=document.createElement('span');label.textContent='¿Te ayudo?';button.append(icon,label);button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
 const panel=document.createElement('dialog');panel.id='asistente-andino-panel';panel.setAttribute('aria-label','Asistente Andino');const close=document.createElement('button');close.type='button';close.className='asistente-cerrar';close.textContent='×';close.setAttribute('aria-label','Cerrar asistente');let frame;
 button.onclick=()=>{if(!frame){frame=document.createElement('iframe');frame.src='/asistente/?v=20261028-real-10';frame.title='Asistente virtual de BingoAndino75';frame.allow='clipboard-write';panel.append(frame);}panel.showModal();button.setAttribute('aria-expanded','true');};close.onclick=()=>panel.close();panel.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');button.focus();});panel.append(close);document.body.append(button,panel);
 const observe=new MutationObserver(()=>{const admin=document.getElementById('admin');button.hidden=!!admin&&!admin.classList.contains('oculto');});observe.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
