(function(global){
 'use strict';
 const doc=global.document;
 const redes=[
  {key:'inicio_whatsapp',name:'WhatsApp',label:'WhatsApp de atención',hosts:['wa.me','whatsapp.com','www.whatsapp.com','api.whatsapp.com','chat.whatsapp.com'],placeholder:'https://wa.me/58…'},
  {key:'inicio_youtube',name:'YouTube',label:'Canal de YouTube',hosts:['youtube.com','www.youtube.com','m.youtube.com','youtu.be'],placeholder:'https://www.youtube.com/@…'},
  {key:'inicio_facebook',name:'Facebook',label:'Facebook',hosts:['facebook.com','www.facebook.com','m.facebook.com','fb.com','www.fb.com'],placeholder:'https://www.facebook.com/…'},
  {key:'inicio_instagram',name:'Instagram',label:'Instagram',hosts:['instagram.com','www.instagram.com'],placeholder:'https://www.instagram.com/…'}
 ];
 const inputs=new Map();let group;let latest;
 function validate(text,hosts){
  let url;try{url=new URL(text);}catch{throw new Error('Pega un enlace completo que comience por https://.');}
  if(url.protocol!=='https:' || url.username || url.password || (url.port && url.port!=='443') || !hosts.includes(url.hostname))throw new Error('Utiliza un enlace https:// válido de esta red social.');
  return url.href;
 }
 function apply(values){
  latest=values;
  for(const red of redes){
   const link=values.get(red.key);const anchor=doc.querySelector('#redes-sociales a[title="'+red.name+'"]');const field=inputs.get(red.key);
   if(link && anchor){try{anchor.href=validate(link,red.hosts);}catch{}}
   if(field && field.dataset.dirty!=='true')field.value=anchor?.href||'';
  }
  if(group && group.dataset.dirty!=='true')group.value=values.get('link_whatsapp')||'';
 }
 global.aplicarEnlacesInicio=apply;
 function install(){
  const target=doc.querySelector('#tab-config .panel-section');if(!target)return;
  const box=doc.createElement('div');box.className='panel-section';box.id='enlaces-botones-inicio';
  const title=doc.createElement('h3');title.textContent='Enlaces de los botones del inicio';
  const explanation=doc.createElement('p');explanation.textContent='Actualiza aquí los iconos de tus redes sociales. Los cambios se mostrarán en la página de inicio.';
  box.append(title,explanation);
  const status=doc.createElement('p');status.setAttribute('role','status');
  for(const red of redes){
   const form=doc.createElement('form');form.className='config-group';
   const label=doc.createElement('label');label.htmlFor='enlace-'+red.key;label.textContent=red.label+':';
   const row=doc.createElement('div');row.className='input-row';row.style.cssText='display:flex;gap:10px;flex-wrap:wrap';
   const field=doc.createElement('input');field.id=label.htmlFor;field.type='url';field.required=true;field.maxLength=2048;field.placeholder=red.placeholder;field.autocomplete='url';field.style.cssText='flex:1;min-width:180px';
   field.value=doc.querySelector('#redes-sociales a[title="'+red.name+'"]')?.href||'';
   field.addEventListener('input',()=>field.dataset.dirty='true');inputs.set(red.key,field);
   const save=doc.createElement('button');save.type='submit';save.className='btn-primary';save.textContent='Guardar '+red.name;
   let busy=false;
   form.onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    let link;try{link=validate(field.value.trim(),red.hosts);}catch(error){status.textContent=error.message;field.focus();return;}
    busy=true;save.disabled=true;status.textContent='Guardando…';
    try{
     const {error}=await global.supabase.from('configuracion').upsert([{clave:red.key,valore:link}],{onConflict:'clave'});if(error)throw error;
     global.invalidarConfiguracionInicio?.();field.dataset.dirty='false';field.value=link;doc.querySelector('#redes-sociales a[title="'+red.name+'"]')?.setAttribute('href',link);status.textContent='Enlace de '+red.name+' guardado.';
    }catch{status.textContent='No se pudo guardar. Verifica tu sesión de administrador y vuelve a intentar.';}
    finally{busy=false;save.disabled=false;}
   };
   row.append(field,save);form.append(label,row);box.append(form);
  }
  box.append(status);target.append(box);
  group=doc.getElementById('inputWhatsapp');group?.addEventListener('input',()=>group.dataset.dirty='true');
  const live=doc.getElementById('inputYoutube');
  if(latest)apply(latest);
  // Read only when the administrator opens Configuration; public startup shares its existing query.
  const original=global.cambiarTab;
  if(typeof original==='function')global.cambiarTab=function(tab){
   const result=original.apply(this,arguments);
   if(tab==='tab-config'){
    status.textContent='Cargando enlaces actuales…';
    global.leerConfiguracionInicio(true).then(values=>{apply(values);status.textContent='';}).catch(()=>{status.textContent='No se pudieron cargar los enlaces guardados. Reintenta abriendo Configuración.';});
    if(live && live.dataset.dirty!=='true')global.supabase.from('configuracion').select('valore').eq('clave','youtube_live').maybeSingle().then(({data,error})=>{if(!error && data && live.dataset.dirty!=='true')live.value=data.valore||'';});
   }
   return result;
  };
  live?.addEventListener('input',()=>live.dataset.dirty='true');
  let savingGroup=false;
  global.guardarLinkWhatsapp=async function(){
   if(savingGroup)return;let link;
   try{link=validate(group.value.trim(),redes[0].hosts);}catch(error){global.alert(error.message);return;}
   savingGroup=true;
   try{
    const {error}=await global.supabase.from('configuracion').upsert([{clave:'link_whatsapp',valore:link}],{onConflict:'clave'});if(error)throw error;
    global.invalidarConfiguracionInicio?.();group.dataset.dirty='false';group.value=link;
    const button=doc.getElementById('btnWhatsapp');if(button){button.href=link;button.style.display='inline-block';}
    global.alert('Enlace del grupo o canal de WhatsApp guardado.');
   }catch{global.alert('No se pudo guardar. Verifica tu sesión de administrador.');}
   finally{savingGroup=false;}
  };
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
