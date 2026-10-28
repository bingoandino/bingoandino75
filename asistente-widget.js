(function(){
 'use strict';
 function install(){if(document.getElementById('asistente-andino-widget'))return;
 const button=document.createElement('button');button.id='asistente-andino-widget';button.type='button';button.textContent='💬 ¿Te ayudo?';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
 const panel=document.createElement('dialog');panel.id='asistente-andino-panel';panel.setAttribute('aria-label','Asistente Andino');const close=document.createElement('button');close.type='button';close.className='asistente-cerrar';close.textContent='×';close.setAttribute('aria-label','Cerrar asistente');let frame;
 button.onclick=()=>{if(!frame){frame=document.createElement('iframe');frame.src='/asistente/?v=20261028-real-2';frame.title='Asistente virtual de BingoAndino75';frame.allow='clipboard-write';panel.append(frame);}panel.showModal();button.setAttribute('aria-expanded','true');};close.onclick=()=>panel.close();panel.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');button.focus();});panel.append(close);document.body.append(button,panel);
 const observe=new MutationObserver(()=>{const admin=document.getElementById('admin');button.hidden=!!admin&&!admin.classList.contains('oculto');});observe.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
