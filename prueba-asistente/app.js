import {validateFile} from './files.js';
import {Assistant,CONFIG,money} from './engine.js?v=20261027-verificar-1';
const $=id=>document.getElementById(id);let assistant=new Assistant(),queue=Promise.resolve(),generation=0,selection=new Set(),objectURLs=[];
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n;};
function time(){return new Intl.DateTimeFormat('es-VE',{hour:'numeric',minute:'2-digit',timeZone:'America/Caracas'}).format(new Date());}
function toast(value){$('toast').textContent=value;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,2500);}
const scroll=()=>$('messages').scrollTo({top:$('messages').scrollHeight,behavior:'smooth'});
function row(parent,label,value){const line=el('div','data-line');line.append(el('span','',label),el('b','',value));parent.append(line);}
function pills(parent,cards){if(!cards.length)return;const p=el('div','card-pills');for(const c of cards)p.append(el('span','',c));parent.append(p);}
async function copyAll(value,button){try{await navigator.clipboard.writeText(value);button.textContent='✓ Datos copiados';setTimeout(()=>{if(button.isConnected)button.textContent='Copiar datos de pago';},2200);}catch{const area=el('textarea');area.value=value;area.readOnly=true;const d=el('dialog');const h=el('h2','','Copia los datos juntos');const p=el('p','','Mantén presionado el texto y elige Copiar.');const close=el('button','inline-button','Cerrar');close.onclick=()=>d.close();d.append(h,p,area,close);document.body.append(d);d.showModal();area.focus();area.select();d.onclose=()=>d.remove();}}
function bubble(message,user=false){const wrap=el('div','message'+(user?' user':''));if(!user)wrap.append(el('div','mini-avatar','75'));const b=el('div','bubble'+(message.type!=='text'?' card-bubble':''));let content=b;
 if(message.type==='text')b.append(document.createTextNode(message.text));
 else if(message.type==='payment'){
 const top=el('div','payment-top');top.append(el('p','card-label','TOTAL A PAGAR · PRUEBA'));const amount=el('strong','amount',money(message.total)+' ');amount.append(el('small','','Bs'));top.append(amount,el('div','caption',`${message.quantity} cartones × ${money(CONFIG.price)} Bs`));b.append(top);content=el('div','card-content');b.append(content);
 for(const [label,value] of [['Banco',CONFIG.bank],['Teléfono',CONFIG.phone],['Cédula',CONFIG.id]]){const r=el('div','payment-row');r.append(el('span','',label),el('strong','',value));content.append(r);}
 const button=el('button','copy-all','Copiar datos de pago');button.type='button';button.onclick=()=>copyAll(message.copy,button);content.append(button,el('p','card-foot','Copia banco, teléfono, cédula y monto juntos.'));content.append(el('p','card-foot','Datos ficticios. No realices una transferencia.'));
 }else if(message.type==='summary'){
 content=el('div','card-content');b.append(content);content.append(el('h3','summary-title','Revisemos tus datos 📝'));const d=message.data;content.append(el('p','summary-group','Registro'));row(content,'Nombre',d.name);row(content,'Cédula',d.id);row(content,'Teléfono',d.phone);content.append(el('p','summary-group','Pago Móvil para premios'));row(content,'Banco',d.bank);row(content,'Cédula',d.payId);row(content,'Teléfono',d.payPhone);
 }else if(message.type==='review'||message.type==='success'){
 content=el('div','card-content');b.append(content);if(message.type==='success'){content.append(el('div','success-icon','✓'),el('h3','success-text','Compra de prueba registrada'),el('span','state-badge','PENDIENTE · SIMULACIÓN'));}else content.append(el('p','card-label','ANTES DE REGISTRAR'),el('h3','summary-title','Tu compra de prueba'));
 row(content,'Cartones',message.quantity);row(content,'Total',money(message.total)+' Bs');if(message.ref)row(content,'Referencia',message.ref);pills(content,message.cards);if(message.type==='success')content.append(el('p','card-foot','No participa en ningún sorteo real.'));
 }else if(message.type==='catalog'){
 content=el('div','card-content');b.append(content);const button=el('button','inline-button','Ver cartones disponibles');button.onclick=openCatalog;content.append(button);
 }else if(message.type==='link'){
 content=el('div','card-content');b.append(content);const link=el('a','inline-link',message.label);link.href=message.url;link.target='_blank';link.rel='noopener noreferrer';content.append(link);
 }else if(message.type==='receipt'){
 content=el('div','card-content');b.append(content);const img=el('img','receipt-preview');img.src=message.url;img.alt='Imagen de prueba adjunta';content.append(img,el('span','receipt-label',message.name));
 }
 content.append(el('time','time',time()));wrap.append(b);$('messages').append(wrap);scroll();return b;
}
function respond(messages){const epoch=generation;queue=queue.then(async()=>{if(epoch!==generation)return;$('typing').hidden=false;scroll();await new Promise(r=>setTimeout(r,380));if(epoch!==generation)return;$('typing').hidden=true;for(const message of messages)bubble(message);});return queue;}
function send(){const input=$('input'),value=input.value.trim();if(!value)return;input.value='';bubble({type:'text',text:value},true);respond(assistant.receive(value));input.focus();}
$('composer').onsubmit=e=>{e.preventDefault();send();};$('input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send();}};
$('attach').onclick=()=>$('attachment').click();
$('attachment').onchange=async()=>{const file=$('attachment').files[0];$('attachment').value='';if(!file)return;const epoch=generation;try{await validateFile(file);if(epoch!==generation)return;if(assistant.state.submitted){toast('Esta compra de prueba ya está registrada.');return;}const url=URL.createObjectURL(file);objectURLs.push(url);bubble({type:'receipt',name:file.name,url},true);respond(assistant.attach(file));}catch(e){toast(e.message);}};
function renderGrid(){const search=Number($('card-search').value),grid=$('grid');grid.replaceChildren();const numbers=search?[search]:Array.from({length:CONFIG.total},(_,i)=>i+1);for(const n of numbers){if(n<1||n>CONFIG.total)continue;const b=el('button',selection.has(n)?'selected':'',n);b.type='button';b.disabled=!assistant.available.has(n);b.setAttribute('aria-pressed',String(selection.has(n)));b.setAttribute('aria-label',`Cartón ${n}${b.disabled?', ocupado':', disponible'}`);b.onclick=()=>{if(selection.has(n))selection.delete(n);else{if(selection.size>=assistant.state.quantity){toast(`Ya elegiste ${assistant.state.quantity} cartones.`);return;}selection.add(n);}renderGrid();};grid.append(b);}const q=assistant.state.quantity;$('selection-status').textContent=q?`${selection.size} de ${q} elegidos`:'Dime primero cuántos cartones deseas.';$('use-cards').disabled=!q||selection.size!==q;}
function openCatalog(){selection=new Set(assistant.state.cards);$('card-search').value='';renderGrid();$('catalog').showModal();}
$('card-search').oninput=renderGrid;$('close-catalog').onclick=()=>$('catalog').close();$('use-cards').onclick=()=>{const cards=[...selection];$('catalog').close();bubble({type:'text',text:'Quiero estos cartones: '+cards.join(', ')},true);respond(assistant.choose(cards));};
$('reset').onclick=()=>$('restart').showModal();$('cancel-reset').onclick=()=>$('restart').close();$('confirm-reset').onclick=()=>{$('restart').close();generation++;queue=Promise.resolve();$('typing').hidden=true;assistant=new Assistant();for(const url of objectURLs)URL.revokeObjectURL(url);objectURLs=[];$('messages').replaceChildren(el('div','day','Hoy · Demo de atención'));$('input').value='';respond(assistant.start());};
respond(assistant.start());
