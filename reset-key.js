(function(global){
 'use strict';
 const doc=global.document;
 let resetting=false;
 function input(label,type,autocomplete){
  const wrap=doc.createElement('label');wrap.className='reset-key-label';wrap.textContent=label;
  const el=doc.createElement('input');el.type=type;el.autocomplete=autocomplete;el.required=true;wrap.append(el);return {wrap,el};
 }
 function install(){
  const panel=doc.getElementById('admin-panel');if(!panel)return;
  const style=doc.createElement('style');style.textContent='.reset-key-settings{margin:20px 0;padding:20px;border:1px solid #d9c7dc;border-radius:20px;background:#f7f0f7;color:#4b174f}.reset-key-settings summary{font-size:22px;font-weight:800;cursor:pointer}.reset-key-label{display:block;margin:16px 0;font-size:18px;font-weight:700}.reset-key-label input{display:block;box-sizing:border-box;width:100%;margin-top:8px;padding:14px;font:inherit;border:1px solid #bda6c1;border-radius:12px;background:#fff;color:#4b174f}.reset-key-settings p,.reset-key-modal p{font-size:18px;line-height:1.5}.reset-key-modal{box-sizing:border-box;width:min(92vw,480px);max-height:90dvh;overflow:auto;padding:24px;border:1px solid #c8af67;border-radius:22px;background:#fffdf8;color:#4b174f}.reset-key-modal::backdrop{background:#24102bd9}.reset-key-modal h3{margin-top:0;font-size:24px}.reset-key-modal button,.reset-key-settings button{width:100%;min-height:52px;margin:8px 0;padding:12px;border:1px solid #c8af67;border-radius:12px;background:#4b174f;color:#fffdf8;font-size:18px;font-weight:800}.reset-key-modal button[type=button]{background:#fffdf8;color:#4b174f}.reset-key-status{min-height:1.5em;font-weight:700}.reset-key-modal button:disabled,.reset-key-settings button:disabled{opacity:.6}';doc.head.append(style);
  const settings=doc.createElement('details');settings.className='reset-key-settings';
  const heading=doc.createElement('summary');heading.textContent='Seguridad · Clave de reinicio';
  const intro=doc.createElement('p');intro.textContent='Para configurar o cambiar esta clave debes confirmar un código enviado al correo de tu cuenta de administrador.';
  const send=doc.createElement('button');send.type='button';send.textContent='Enviar código a mi correo';
  const form=doc.createElement('form');form.hidden=true;
  const code=input('Código recibido por correo','text','one-time-code');code.el.inputMode='numeric';code.el.pattern='[0-9]{6}';code.el.maxLength=6;
  const key=input('Nueva clave de reinicio (10 a 64 caracteres)','password','new-password');key.el.minLength=10;key.el.maxLength=64;
  const repeat=input('Repite la nueva clave','password','new-password');repeat.el.minLength=10;repeat.el.maxLength=64;
  const save=doc.createElement('button');save.type='submit';save.textContent='Verificar código y guardar clave';
  const status=doc.createElement('p');status.className='reset-key-status';status.setAttribute('role','status');
  form.append(code.wrap,key.wrap,repeat.wrap,save);settings.append(heading,intro,send,form,status);panel.append(settings);
  let busy=false;
  async function call(body){
   const {data,error}=await global.supabase.auth.getSession();
   if(error || !data?.session?.access_token)throw new Error('Vuelve a entrar al administrador.');
   const response=await global.fetch('https://dbkixcpwirjwjvjintkr.supabase.co/functions/v1/reset-key',{method:'POST',headers:{'Content-Type':'application/json',apikey:global.supabase.supabaseKey,Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(body)});
   const result=await response.json();if(!response.ok || !result.ok)throw new Error(result.error||'No se pudo completar la solicitud.');return result;
  }
  send.onclick=async()=>{
   if(busy)return;busy=true;send.disabled=true;save.disabled=true;status.textContent='Enviando código…';
   try{const result=await call({action:'request'});form.hidden=false;code.el.value='';status.textContent=result.message;code.el.focus();}
   catch(error){status.textContent=error.message||'No se pudo enviar el código.';}
   finally{busy=false;send.disabled=false;save.disabled=false;}
  };
  form.onsubmit=async event=>{
   event.preventDefault();if(busy)return;
   if(key.el.value!==repeat.el.value){status.textContent='Las claves no coinciden.';repeat.el.focus();return;}
   if(new TextEncoder().encode(key.el.value).length>72){status.textContent='La clave es demasiado larga. Usa menos caracteres.';return;}
   busy=true;send.disabled=true;save.disabled=true;status.textContent='Verificando código…';
   try{const result=await call({action:'save',code:code.el.value.trim(),key:key.el.value});form.reset();form.hidden=true;status.textContent=result.message;}
   catch(error){status.textContent=error.message||'No se pudo guardar la clave.';}
   finally{key.el.value='';repeat.el.value='';busy=false;send.disabled=false;save.disabled=false;}
  };
  global.reiniciarTodo=async function(){
   if(resetting)return;resetting=true;
   try{
    const {data:configured,error}=await global.supabase.rpc('rpc_estado_clave_reinicio');if(error)throw error;
    if(!configured){settings.open=true;status.textContent='Primero configura tu clave de reinicio. Solicita el código a tu correo.';settings.scrollIntoView({behavior:'smooth',block:'center'});resetting=false;return;}
   }catch{global.alert('No se pudo verificar tu acceso. Vuelve a entrar al administrador.');resetting=false;return;}
   const dialog=doc.createElement('dialog');dialog.className='reset-key-modal';
   const title=doc.createElement('h3');title.textContent='Reiniciar sorteo';
   const text=doc.createElement('p');text.textContent='Introduce tu clave exclusiva de reinicio. Después deberás confirmar la eliminación de las compras y reservas actuales.';
   const resetForm=doc.createElement('form');
   const password=input('Clave de reinicio','password','off');password.el.maxLength=64;
   const notice=doc.createElement('p');notice.setAttribute('role','status');notice.className='reset-key-status';
   const submit=doc.createElement('button');submit.type='submit';submit.textContent='Continuar';
   const cancel=doc.createElement('button');cancel.type='button';cancel.textContent='Cancelar';
   let running=false;
   const close=()=>{password.el.value='';dialog.close();dialog.remove();resetting=false;};
   cancel.onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();if(!running)close();});
   resetForm.onsubmit=async event=>{
    event.preventDefault();if(running)return;
    if(!global.confirm('¿Seguro que deseas reiniciar el sorteo? Se guardará un respaldo antes de borrar las compras y reservas. Los ganadores publicados se conservarán.'))return;
    running=true;submit.disabled=true;cancel.disabled=true;notice.textContent='Guardando respaldo y reiniciando…';
    try{
     const {data,error}=await global.supabase.rpc('rpc_reiniciar_sorteo_con_clave',{_clave:password.el.value});
     if(error)throw error;if(!data?.ok)throw new Error(data?.error||'No se pudo reiniciar el sorteo.');
     close();global.alert('Sorteo reiniciado. Se conservaron el respaldo y los ganadores publicados.');global.location.reload();
    }catch(error){notice.textContent=error.message||'No se pudo reiniciar. Intenta nuevamente.';}
    finally{password.el.value='';running=false;submit.disabled=false;cancel.disabled=false;}
   };
   resetForm.append(password.wrap,notice,submit,cancel);dialog.append(title,text,resetForm);doc.body.append(dialog);dialog.showModal();password.el.focus();
  };
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
