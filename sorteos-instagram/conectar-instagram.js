const base='https://dbkixcpwirjwjvjintkr.supabase.co', key='sb_publishable__XuvzJpG8lgar0uxD7Jv4Q_HZCaYUaF';
const $=id=>document.getElementById(id), authKey='bingo_instagram_admin', email='bingoandino75@gmail.com';
const show=message=>{$('status').textContent=message};
const token=()=>sessionStorage.getItem(authKey)||'';
async function call(op, data={},access=token()){
 const r=await fetch(base+'/functions/v1/instagram-sorteos',{method:'POST',headers:{'Content-Type':'application/json',apikey:key,...(access?{Authorization:'Bearer '+access}:{})},body:JSON.stringify({op,...data})});
 const value=await r.json();
 if(!r.ok)throw Error(value.error||'No se pudo completar la operación.');
 return value;
}
async function check(){
 try{const status=await call('session');if(status.owner){$('login').hidden=true;$('connect').hidden=false;show('Administrador verificado. Puedes conectar Instagram.');}}
 catch{sessionStorage.removeItem(authKey);}
}
async function action(button,work){button.disabled=true;try{await work()}catch(e){show(e instanceof Error?e.message:'Error de conexión.')}finally{button.disabled=false}}
$('send').addEventListener('click',()=>action($('send'),async()=>{await call('admin_otp',{email},'');$('verify-wrap').hidden=false;show('Se solicitó un código al correo del administrador.');}));
$('verify').addEventListener('click',()=>action($('verify'),async()=>{
 const input=$('otp');const otp=input.value.trim();
 if(!/^\d{4,10}$/.test(otp))throw Error('Escribe el código recibido en el correo.');
 const r=await fetch(base+'/auth/v1/verify',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,token:otp,type:'email'})});
 const data=await r.json();
 input.value='';
 if(!r.ok||!data.access_token)throw Error('No se pudo validar el código. Comprueba el correo.');
 const status=await call('session',{},data.access_token);
 if(!status.owner)throw Error('Este correo no tiene permisos para reconectar Instagram.');
 sessionStorage.setItem(authKey,data.access_token);
 $('login').hidden=true;$('connect').hidden=false;show('Administrador verificado. Ya puedes colocar el token nuevo de Meta.');
}));
$('save').addEventListener('click',()=>action($('save'),async()=>{
 const input=$('ig-token'),fresh=input.value.trim();
 if(fresh.length<50)throw Error('Pega el token completo obtenido en Meta. No uses tu contraseña.');
 show('Comprobando cuenta, publicaciones y comentarios con Meta...');
 const data=await call('instagram_connect',{instagram_token:fresh});
 input.value='';
 show(data.message||'Conexión guardada. Ya puedes volver al sorteo.');
}));
check();