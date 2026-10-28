(function(){
 'use strict';
 const box=document.getElementById('transmision');if(!box)return;
 const T=window.TransmisionYouTube,el=id=>document.getElementById(id),toggle=el('transmisionVer'),frame=el('transmisionVideo'),panel=el('transmisionPanel'),direct=el('transmisionDirecto'),comments=el('transmisionComentarios');
 let current=null,opened=false,busy=false,stopped=false,timer,expiry;
 const endpoint='https://dbkixcpwirjwjvjintkr.supabase.co/rest/v1/transmision_juego?id=eq.1&select=video_id,revision,expira_en';
 const key=document.querySelector('meta[name="bingo-public-key"]').content;
 function say(text){const message=box.querySelector('#transmisionEstado');if(message)message.textContent=text;box.dataset.notice=/No se pudo|No hay/.test(text)?'true':'false';}
 function close(){opened=false;frame.replaceChildren();panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.textContent='📺 Ver transmisión';direct.hidden=true;say('Video y sonido detenidos. Tus marcas se conservan.');}
 function open(){
  if(!T.active(current)){close();return;}
  frame.replaceChildren();const iframe=document.createElement('iframe');
  iframe.title='Transmisión de Bingo Andino 75 en YouTube';
  iframe.src='https://www.youtube.com/embed/'+current.video_id+'?autoplay=1&playsinline=1&controls=1';
  iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';iframe.allowFullscreen=true;
  iframe.referrerPolicy='strict-origin-when-cross-origin';
  frame.append(iframe);panel.hidden=false;opened=true;toggle.setAttribute('aria-expanded','true');toggle.textContent='Ocultar';direct.hidden=false;say('Al ocultar se detienen el video y el sonido.');
 }
 function apply(data){
  const previous=current;current=data;clearTimeout(expiry);
  const live=T.active(current);toggle.disabled=!live;comments.hidden=!live;
  if(!live){close();say('No hay una transmisión disponible en este momento.');return;}
  comments.href='https://www.youtube.com/watch?v='+current.video_id;
  if(opened&&previous?.video_id!==current.video_id)open();
  say(opened?'Al ocultar se detienen el video y el sonido.':'Toca Ver transmisión para abrir el video.');
  expiry=setTimeout(()=>apply(current),Math.min(2147483647,Math.max(1,Date.parse(current.expira_en)-Date.now())));
 }
 async function update(){
  if(stopped||busy||!box.isConnected||document.hidden)return;
  busy=true;
  try{
   const r=await fetch(endpoint,{headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error();const data=await r.json();
   if(!box.isConnected||stopped)return;
   if(!Array.isArray(data)||data.length!==1)throw Error();apply(T.row(data[0]));
  }catch{if(!stopped&&box.isConnected)say('No se pudo actualizar la transmisión. Reintenta cuando tengas conexión.');}
  finally{busy=false;schedule();}
 }
 function schedule(){clearTimeout(timer);if(!stopped&&box.isConnected&&!document.hidden)timer=setTimeout(update,55000+Math.random()*10000);}
 toggle.onclick=()=>opened?close():open();
 direct.onclick=()=>{open();say('Reproductor recargado. El retraso depende de YouTube y de tu conexión.');};
 comments.onclick=()=>{close();say('Comentarios abiertos en YouTube. Aquí puedes seguir marcando tus cartones.');};
 el('transmisionActualizar').onclick=update;
 function visibility(){if(document.hidden){close();clearTimeout(timer)}else update();}
 document.addEventListener('visibilitychange',visibility);
 window.addEventListener('online',update);
 window.addEventListener('pagehide',()=>{close();clearTimeout(timer);clearTimeout(expiry);});
 window.addEventListener('pageshow',()=>{if(box.isConnected)update()});
 const observer=new MutationObserver(()=>{if(!box.isConnected){stopped=true;close();clearTimeout(timer);clearTimeout(expiry);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',update);observer.disconnect();}});
 observer.observe(document.querySelector('main'),{childList:true});
 update();
})();
