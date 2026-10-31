(()=>{
 const box=document.getElementById('installNotice'),button=document.getElementById('installSupport'),help=document.getElementById('installHelp');
 const mode=window.matchMedia?.('(display-mode: standalone)');let request=null,dismissed=false;
 const installed=()=>!!(mode?.matches||navigator.standalone);
 function update(){box.hidden=installed()||dismissed;}
 function instructions(){help.hidden=false;help.textContent=/iPad|iPhone|iPod/.test(navigator.userAgent)?'En Safari, toca Compartir y luego «Añadir a pantalla de inicio».':'Abre el menú del navegador (⋮) y toca «Instalar aplicación» o «Añadir a pantalla de inicio». Si estás dentro de WhatsApp, abre primero el enlace en Chrome.';}
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();request=e;update();});
 window.addEventListener('appinstalled',()=>{dismissed=true;request=null;update();});mode?.addEventListener?.('change',update);
 button.onclick=async()=>{if(!request){instructions();return;}const current=request;request=null;button.disabled=true;try{await current.prompt();const choice=await current.userChoice;if(choice?.outcome==='accepted'){help.hidden=false;help.textContent='Confirma la instalación en el aviso del teléfono.';}}catch{instructions();}finally{button.disabled=false;}};
 document.getElementById('dismissInstall').onclick=()=>{dismissed=true;update();};
 if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(()=>{});
 update();
})();
