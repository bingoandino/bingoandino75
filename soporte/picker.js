globalThis.BingoCardPicker=class {
 constructor(root,{base,onChange}){
  this.root=root;this.base=base;this.onChange=onChange;this.busy=false;this.viewing=null;
  this.data={total:0,cantidad:1,seleccionados:[],ocupados:[],registrados:[],estado:'activo'};
  root.innerHTML='<div class="picker-summary" aria-live="polite"></div><div class="picker-chips"></div><div class="picker-tools"><label>Buscar número<input class="picker-find" inputmode="numeric" pattern="[0-9]*" placeholder="Número de cartón"></label><button class="picker-go" type="button">Ver cartón</button></div><p class="picker-status hint" role="status"></p><div class="picker-number-grid" aria-label="Números de cartones disponibles"></div>';
  this.el=s=>root.querySelector(s);
  this.preview=document.createElement('dialog');this.preview.className='picker-preview';
  this.preview.innerHTML='<h2></h2><img class="picker-large-image" alt=""><p class="picker-preview-status hint" role="status"></p><div class="actions"><button class="picker-select primary" type="button">Seleccionar cartón</button><button class="picker-back" type="button">Volver a los números</button></div>';
  const heading=this.preview.querySelector('h2');heading.id=(root.id||'picker')+'-preview-title';this.preview.setAttribute('aria-labelledby',heading.id);root.append(this.preview);
  this.preview.querySelector('.picker-back').onclick=()=>this.preview.close();
  this.preview.querySelector('.picker-select').onclick=async()=>{if(await this.toggle(this.viewing))this.preview.close();};
  this.el('.picker-find').oninput=e=>{e.target.value=e.target.value.replace(/\D/g,'');};
  this.el('.picker-go').onclick=()=>this.open(Number(this.el('.picker-find').value));
  this.el('.picker-find').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();this.open(Number(e.target.value));}};
 }
 message(text){this.el('.picker-status').textContent=text;if(this.preview.open)this.preview.querySelector('.picker-preview-status').textContent=text;}
 update(data){const old=JSON.stringify(this.data);this.data={...this.data,...data};if(old!==JSON.stringify(this.data))this.render();}
 available(){const taken=new Set([...(this.data.ocupados||[]),...(this.data.registrados||[])].map(Number)),selected=new Set(this.data.seleccionados.map(Number));return Array.from({length:this.data.total},(_,i)=>i+1).filter(n=>!taken.has(n)||selected.has(n));}
 open(n){if(!Number.isInteger(n)||!this.available().includes(n)){this.message('Ese cartón no está disponible.');return;}this.viewing=n;const img=this.preview.querySelector('img');img.src=this.base+'/storage/v1/object/public/cartones/SERIAL_BINGOANDINO75_CARTON_'+String(n).padStart(5,'0')+'.webp';img.alt='Cartón '+n;this.preview.querySelector('h2').textContent='Cartón '+n;this.preview.querySelector('.picker-preview-status').textContent='';this.refreshPreview();this.preview.showModal();}
 refreshPreview(){if(this.viewing===null)return;const selected=this.data.seleccionados.map(Number).includes(this.viewing),available=this.available().includes(this.viewing),b=this.preview.querySelector('.picker-select');b.textContent=selected?'Quitar de mi selección':'Seleccionar este cartón';b.disabled=this.busy||this.data.estado!=='activo'||this.data.abierto===false||!available;if(!available)this.preview.querySelector('.picker-preview-status').textContent='Este cartón ya no está disponible. Elige otro.';}
 async toggle(n){if(this.busy||this.data.estado!=='activo'||this.data.abierto===false)return false;const nums=[...this.data.seleccionados].map(Number),i=nums.indexOf(n);if(i>=0)nums.splice(i,1);else if(!this.available().includes(n)){this.message('Ese cartón ya no está disponible.');return false;}else if(nums.length<this.data.cantidad)nums.push(n);else{this.message('Ya elegiste los '+this.data.cantidad+' cartones. Quita uno para cambiarlo.');return false;}
  this.busy=true;this.render();this.message('Guardando selección…');try{await this.onChange(nums);this.message('Selección actualizada.');return true;}catch(e){this.message(e.message||'No se pudo guardar. Intenta de nuevo.');return false;}finally{this.busy=false;this.render();}
 }
 render(){const d=this.data,nums=this.available(),chosen=new Set(d.seleccionados.map(Number));this.el('.picker-summary').textContent=chosen.size+' de '+d.cantidad+' seleccionados · '+nums.filter(n=>!chosen.has(n)).length+' disponibles';
  const chips=this.el('.picker-chips');chips.replaceChildren();for(const n of chosen){const b=document.createElement('button');b.type='button';b.textContent='✓ '+n+' ×';b.disabled=this.busy||d.estado!=='activo';b.onclick=()=>this.toggle(n);chips.append(b);}
  const grid=this.el('.picker-number-grid');grid.replaceChildren();for(const n of nums){const b=document.createElement('button');b.type='button';b.dataset.number=n;b.setAttribute('aria-label','Ver cartón '+n+(chosen.has(n)?', seleccionado':''));b.setAttribute('aria-pressed',chosen.has(n)?'true':'false');b.className=chosen.has(n)?'picked':'';b.textContent=String(n);b.onclick=()=>this.open(n);grid.append(b);}this.refreshPreview();
 }
};
