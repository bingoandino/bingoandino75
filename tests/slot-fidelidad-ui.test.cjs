const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../slot/fidelidad.html'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'../slot/fidelidad.js'),'utf8').replace(/^import .*;$/gm,'');
const flush=()=>new Promise(resolve=>setTimeout(resolve,35));

function setup(api,auth=true){
 const dom=new JSDOM(html,{url:'https://bingoandino75.com/slot/fidelidad.html',runScripts:'outside-only'});
 const w=dom.window;
 w.matchMedia=()=>({matches:true});
 w.confirm=()=>true;
 Object.defineProperty(w.crypto,'randomUUID',{configurable:true,value:()=>'10000000-0000-4000-8000-000000000001'});
 Object.assign(w,{hasSession:()=>auth,fidelidadApi:api,spinCylinder:async()=>({}),celebrate:()=>null});
 w.eval(source);
 return {w,dom,close:()=>dom.window.close()};
}
const person=(name,ticket)=>({name,ticket,personId:name});
test('UI Fidelidad: bloquea cuando falta historial y no solicita giro',async()=>{
 const calls=[];
 const f=setup(async action=>{calls.push(action);return {ready:false,faltan:['2026-11-03'],error:'Faltan resultados'}});
 try{
  await flush();
  assert.equal(f.w.document.getElementById('blocked').hidden,false);
  assert.equal(f.w.document.getElementById('spin').disabled,true);
  f.w.document.getElementById('spin').click();await flush();
  assert.deepEqual(calls,['estado']);
 }finally{f.close();}
});
test('UI Fidelidad: muestra lista cuando está completa, gira y mantiene modo separado',async()=>{
 const calls=[],people=[person('Ana','111'),person('Zoe','222')],winners=[];
 const f=setup(async (action,payload)=>{
  calls.push([action,payload]);
  if(action==='estado')return {ready:true,participants:people,winners:[...winners],cantidad:2};
  if(action==='girar'){
   const target=people[winners.length];
   if(!target)throw Error('No quedan participantes');
   const winner={name:target.name,ticket:target.ticket,drawId:payload.drawId,prize:payload.premio};
   winners.push(winner);return {winner};
  }
  throw Error('Acción inesperada');
 });
 try{
  await flush();
  assert.equal(f.w.document.getElementById('blocked').hidden,true);
  assert.equal(f.w.document.getElementById('spin').disabled,false);
  assert.equal(f.w.document.querySelectorAll('#participants>div').length,2);
  f.w.document.getElementById('spin').click();await flush();await flush();
  assert.equal(f.w.document.querySelectorAll('#winners article').length,1);
  assert.equal(f.w.document.getElementById('slotName').textContent,'Ana');
  assert.ok(calls.some(x=>x[0]==='girar'));
  assert.equal(f.w.document.getElementById('spin').disabled,false);
  f.w.document.getElementById('spin').click();await flush();await flush();
  assert.equal(f.w.document.querySelectorAll('#winners article').length,2);
  assert.equal(f.w.document.getElementById('spin').disabled,true);
  assert.equal(calls.filter(x=>x[0]==='girar').length,2);
 }finally{f.close();}
});
test('UI Fidelidad: exige sesión de tragamonedas y nunca gira sin ella',async()=>{
 const calls=[];
 const f=setup(async action=>{calls.push(action);return {}},false);
 try{
  await flush();
  assert.equal(f.w.document.getElementById('blocked').hidden,false);
  assert.equal(f.w.document.getElementById('spin').disabled,true);
  assert.equal(calls.length,0);
 }finally{f.close();}
});
