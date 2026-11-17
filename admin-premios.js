(() => {
 'use strict';const form=document.getElementById('premios-apartados-form');if(!form)return;
 const status=document.getElementById('premios-apartados-status'),refresh=document.getElementById('premios-apartados-refresh'),save=form.querySelector('[type=submit]');let state=null,busy=false;
 async function request(update=false){
 if(busy)return;const token=sessionStorage.getItem('admin_session_token');if(!token){state=null;save.disabled=true;status.textContent='Vuelve a entrar al administrador.';return;}
 if(update&&!state)return;
 const args={_session_token:token,_device_id:sessionStorage.getItem('device_id')||localStorage.getItem('admin_device_id')||localStorage.getItem('device_id')};
 if(update){args._ruleta=Number(form.elements.ruleta.value);args._dinamicas=Number(form.elements.dinamicas.value);args._version=state.version;
 if(![args._ruleta,args._dinamicas].every(n=>Number.isInteger(n)&&n>=0&&n<=10000)){status.textContent='Revisa las cantidades.';return;}
 if(!confirm(`Dejar apartados: ${args._ruleta} para ruleta y ${args._dinamicas} para dinámicas. Los sobrantes que liberes volverán a la venta. ¿Guardar?`))return;}
 busy=true;save.disabled=refresh.disabled=true;status.textContent=update?'Guardando…':'Consultando…';
 try{const {data,error}=await window.supabase.rpc('rpc_apartados_premios',args);if(error)throw error;if(sessionStorage.getItem('admin_session_token')!==token){state=null;return;}state=data;form.elements.ruleta.value=data.ruleta;form.elements.dinamicas.value=data.dinamicas;status.textContent=`${update?'Guardado. ':''}Quedan apartados: ${data.ruleta} para ruleta y ${data.dinamicas} para dinámicas. Disponibles para venta: ${data.disponibles}.`;}
 catch(e){state=null;status.textContent=e.message||'No se pudo guardar. Pulsa Actualizar.';}finally{busy=false;refresh.disabled=false;save.disabled=!state;}}
 refresh.onclick=()=>request();form.onsubmit=e=>{e.preventDefault();request(true);};document.querySelector('[data-premios-tab]').addEventListener('click',()=>request());
})();
