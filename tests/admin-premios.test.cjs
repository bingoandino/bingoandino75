const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const fs=require('node:fs');
test('apartados: load current quantities, use OTP session and version, report stale writes',async()=>{
const d=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://bingoandino75.com',runScripts:'outside-only'});const w=d.window;const calls=[];
w.sessionStorage.setItem('admin_session_token','test');w.sessionStorage.setItem('device_id','device');w.confirm=()=>true;
w.supabase={rpc:async(name,args)=>{calls.push({name,args});return calls.length===3?{error:{message:'Los apartados cambiaron'}}:{data:{ruleta:calls.length===1?7:9,dinamicas:3,disponibles:100,version:'v1'}};}};
w.eval(fs.readFileSync('admin-premios.js','utf8'));w.document.getElementById('premios-apartados-refresh').click();await new Promise(r=>setTimeout(r,0));
const f=w.document.getElementById('premios-apartados-form');assert.equal(f.elements.ruleta.value,'7');f.elements.ruleta.value='9';f.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));
assert.equal(calls[1].args._ruleta,9);assert.equal(calls[1].args._version,'v1');assert.equal(calls[1].args._session_token,'test');assert.equal(calls[1].args._device_id,'device');
f.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(f.querySelector('[type=submit]').disabled,true);assert.match(w.document.getElementById('premios-apartados-status').textContent,/cambiaron/);d.window.close();
});
test('liberar sobrantes keeps the other saved pool and ignores unsaved input',async()=>{
 const d=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://bingoandino75.com',runScripts:'outside-only'}),w=d.window,calls=[];
 w.sessionStorage.setItem('admin_session_token','test');w.sessionStorage.setItem('device_id','device');w.confirm=()=>true;
 w.supabase={rpc:async(name,args)=>{calls.push(args);return {data:{ruleta:calls.length===1?1:0,dinamicas:5,disponibles:80,version:'v1'}};}};
 w.eval(fs.readFileSync('admin-premios.js','utf8'));w.document.getElementById('premios-apartados-refresh').click();await new Promise(r=>setTimeout(r,0));
 w.document.getElementById('premios-apartados-form').elements.dinamicas.value='99';w.document.querySelector('[data-liberar=ruleta]').click();await new Promise(r=>setTimeout(r,0));
 assert.equal(calls[1]._ruleta,0);assert.equal(calls[1]._dinamicas,5);assert.equal(w.document.querySelector('[data-liberar=ruleta]').disabled,true);assert.equal(w.document.querySelector('[data-liberar=dinamicas]').disabled,false);d.window.close();
});
