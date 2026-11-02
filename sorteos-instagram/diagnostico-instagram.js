// Diagnóstico protegido de la conexión entre el sorteo y Meta.
(() => {
  'use strict';
  const endpoint='https://dbkixcpwirjwjvjintkr.supabase.co/functions/v1/instagram-sorteos';
  const publicKey='sb_publishable__XuvzJpG8lgar0uxD7Jv4Q_HZCaYUaF';
  function addControl(){
    const parent=document.querySelector('.setup');
    if(!parent || parent.querySelector('button.diagnose')) return;
    const load=parent.querySelector('button.load');
    if(!load)return;
    const button=document.createElement('button');
    button.type='button';
    button.className='diagnose';
    button.textContent='Revisar conexión con Instagram';
    const status=document.createElement('p');
    status.className='diagnostic-result';
    status.setAttribute('role','status');
    status.hidden=true;
    button.addEventListener('click',async()=>{
      button.disabled=true;
      button.textContent='Revisando conexión…';
      status.hidden=false;
      status.textContent='Comprobando la cuenta, las publicaciones y los comentarios…';
      try{
        const auth=sessionStorage.getItem('bingo_instagram_admin') || sessionStorage.getItem('bingo_instagram_operator');
        if(!auth){status.textContent='Inicia sesión nuevamente para revisar la conexión.';return;}
        const response=await fetch(endpoint,{
          method:'POST',
          headers:{'Content-Type':'application/json',apikey:publicKey,Authorization:'Bearer '+auth},
          body:JSON.stringify({op:'instagram',action:'diagnose'})
        });
        const data=await response.json();
        if(!response.ok){
          status.textContent=String(data.error||'No se pudo completar la comprobación.');
          return;
        }
        status.textContent=(data.ok?'✅ ':'⚠️ ')+(data.stage?data.stage+': ':'')+String(data.message||'No se pudo completar la revisión.');
      }catch{
        status.textContent='No se pudo comunicar con la aplicación. Comprueba la conexión e inténtalo otra vez.';
      }finally{
        button.disabled=false;
        button.textContent='Revisar conexión con Instagram';
      }
    });
    load.insertAdjacentElement('afterend',status);
    load.insertAdjacentElement('afterend',button);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addControl,{once:true});
  else addControl();
  const observer=new MutationObserver(addControl);
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
