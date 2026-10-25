const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
async function fixture(original, setup=()=>{}){
  const dom=new JSDOM('<button id="btnEnviarComprobante">Enviar comprobante</button>',{runScripts:'outside-only'});
  const w=dom.window;
  w.enviarComprobante=original;
  w.prepararComprobanteSeguro=async value=>value;
  setup(w);
  w.eval(read('referencia.js'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await Promise.resolve();
  return {w,close:()=>w.close(),button:w.document.getElementById('btnEnviarComprobante')};
}
test('veinte llamadas simultáneas hacen un solo envío y mantienen el bloqueo',async()=>{
  let finish,calls=0;const f=await fixture(()=>{calls++;return new Promise(resolve=>finish=resolve);});
  try{const tasks=Array.from({length:20},()=>f.w.enviarComprobante());
    assert.equal(new Set(tasks).size,1);assert.equal(f.button.disabled,true);assert.equal(f.button.getAttribute('aria-busy'),'true');
    await Promise.resolve();assert.equal(calls,1);finish('ok');assert.equal(await tasks[0],'ok');
    assert.equal(f.button.disabled,false);assert.equal(f.button.hasAttribute('aria-busy'),false);
    assert.equal(f.button.textContent,'Enviar comprobante');
  }finally{f.close();}
});
test('los tiempos de red excluyen URLs privadas y recursos de otros servicios',async()=>{
  let observe;
  const f=await fixture(async()=>{},w=>{
    w.supabase={supabaseUrl:'https://ejemplo.supabase.co'};
    w.PerformanceObserver=class {constructor(callback){observe=callback;}observe(){}disconnect(){}};
  });
  try{observe({getEntries:()=>[
    {name:'https://ejemplo.supabase.co/rest/v1/inscripciones?cedula=privado',duration:123},
    {name:'https://ejemplo.supabase.co/storage/v1/object/comprobantes/archivo-privado.jpg',duration:321},
    {name:'https://otro.example/rest/v1/cartones?dato=privado',duration:444}
  ]});
    const rows=f.w.DiagnosticoCompra.resumen();assert.equal(rows.length,2);
    assert.equal(rows[0].ms,123);assert.equal(rows[1].ms,321);
    assert.equal(/privado|https|cedula/.test(JSON.stringify(rows)),false);
  }finally{f.close();}
});
test('un error libera el bloqueo y permite corregir y reintentar',async()=>{
  let calls=0;const f=await fixture(()=>{if(++calls===1)throw Error('error ficticio');return 'ok';});
  try{await assert.rejects(f.w.enviarComprobante(),/ficticio/);assert.equal(f.button.disabled,false);
    assert.equal(await f.w.enviarComprobante(),'ok');assert.equal(calls,2);
    assert.equal(f.w.DiagnosticoCompra.resumen()[0].resultado,'error');
  }finally{f.close();}
});
test('las mediciones no contienen argumentos, archivos, respuestas ni mensajes de error',async()=>{
  const f=await fixture(async()=>({cedula:'dato-privado'}));
  try{await f.w.prepararComprobanteSeguro({name:'comprobante-privado.jpg'});await f.w.enviarComprobante('telefono-privado');
    const rows=f.w.DiagnosticoCompra.resumen();assert.equal(rows.length,2);
    assert.equal(/privado|cedula|telefono|comprobante-privado/.test(JSON.stringify(rows)),false);
    rows.forEach(row=>{assert.deepEqual(Object.keys(row).sort(),['etapa','ms','resultado']);assert.ok(Number.isFinite(row.ms));});
    rows[0].etapa='alterado';assert.equal(f.w.DiagnosticoCompra.resumen()[0].etapa,'preparar_imagen');
    for(let i=0;i<105;i++)await f.w.prepararComprobanteSeguro({});
    assert.equal(f.w.DiagnosticoCompra.resumen().length,100);f.w.DiagnosticoCompra.limpiar();assert.equal(f.w.DiagnosticoCompra.resumen().length,0);
  }finally{f.close();}
});
test('el envío real conserva validaciones y agrupa intentos incluso cuando captura su propio error',async()=>{
  const f=await fixture(async()=>{});
  try{const source=read('script.js');f.w.eval(source.slice(source.indexOf('async function enviarComprobante()'),source.indexOf('// ==================== fUNCIONES DE USUARIO')));
    f.w.eval('var usuario={};');let alerts=0;f.w.alert=()=>alerts++;f.w.console.error=()=>{};
    // Reinstala el adaptador sobre la función real, con un DOM nuevo.
    const block=read('referencia.js').slice(read('referencia.js').indexOf('// Solo tiempos'));
    f.w.eval(block);await Promise.resolve();
    await Promise.all([f.w.enviarComprobante(),f.w.enviarComprobante()]);
    assert.equal(alerts,1);assert.equal(f.button.disabled,false);
  }finally{f.close();}
});
