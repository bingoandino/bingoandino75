const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
async function setup(initial={video_id:'Abcd_123-xy',revision:1,expira_en:new Date(Date.now()+3600000).toISOString()}){
 const d=new JSDOM(fs.readFileSync('jugar/index.html','utf8'),{url:'https://bingoandino75.com/jugar/',runScripts:'outside-only',pretendToBeVisual:true}),w=d.window;let row=initial,fail=false,calls=[],errors=[];w.addEventListener('error',e=>errors.push(e.message));
 w.AbortSignal.timeout=()=>undefined;w.fetch=async(url,opts)=>{calls.push({url,opts});if(fail)throw Error('offline');return{ok:true,json:async()=>[row]}};
 w.eval(fs.readFileSync('shared/youtube.js','utf8'));w.eval(fs.readFileSync('jugar/transmision.js','utf8'));const tick=()=>new Promise(r=>setTimeout(r,0));await tick();return{w,errors,el:id=>w.document.getElementById(id),calls,tick,set:r=>row=r,fail:()=>fail=true,close:()=>w.close()};
}
test('video solo tras toque; ocultar y abrir comentarios detienen audio; directo recarga sin tiempos viejos',async()=>{const a=await setup();try{
 assert.equal(a.w.document.querySelectorAll('iframe').length,0);a.el('transmisionVer').click();let f=a.w.document.querySelector('iframe');assert.match(f.src,/embed\/Abcd_123-xy/);assert.equal(f.referrerPolicy,'strict-origin-when-cross-origin');
 a.el('transmisionVer').click();assert.equal(a.w.document.querySelectorAll('iframe').length,0);assert.equal(a.el('transmisionVer').getAttribute('aria-expanded'),'false');
 a.el('transmisionVer').click();f=a.w.document.querySelector('iframe');a.el('transmisionDirecto').click();assert.notEqual(a.w.document.querySelector('iframe'),f);assert.ok(!a.w.document.querySelector('iframe').src.includes('start='));
 a.el('transmisionComentarios').onclick();assert.equal(a.w.document.querySelectorAll('iframe').length,0);assert.match(a.el('transmisionComentarios').href,/watch\?v=Abcd_123-xy/);
 assert.ok(a.calls.every(c=>!c.opts.method||c.opts.method==='GET'));
 }finally{a.close()}});
test('cambio/remoción remotos conservan cartones y marcas; no crea dos reproductores',async()=>{const a=await setup();try{
 a.w.localStorage.setItem('marcas','datos');a.el('cards').textContent='cartones';a.el('transmisionVer').click();
 a.set({video_id:'ZyXw_123-xy',revision:2,expira_en:new Date(Date.now()+3600000).toISOString()});a.el('transmisionActualizar').click();await a.tick();assert.equal(a.w.document.querySelectorAll('iframe').length,1);assert.match(a.w.document.querySelector('iframe').src,/ZyXw_123-xy/);
 a.set({video_id:null,revision:3,expira_en:null});a.el('transmisionActualizar').click();await a.tick();assert.equal(a.w.document.querySelectorAll('iframe').length,0);assert.equal(a.el('transmisionVer').disabled,true);assert.equal(a.w.localStorage.getItem('marcas'),'datos');assert.equal(a.el('cards').textContent,'cartones');
 }finally{a.close()}});
test('expiración, datos malformados y conexión caída no rompen el juego',async()=>{
 for(const row of [{video_id:'<script>',revision:1,expira_en:'bad'},{video_id:'Abcd_123-xy',revision:1,expira_en:'2020-01-01'},null]){const a=await setup(row);try{assert.equal(a.el('transmisionVer').disabled,true);assert.equal(a.w.document.querySelectorAll('iframe').length,0);assert.ok(a.el('undo'));}finally{a.close()}}
 const a=await setup();try{a.fail();a.el('transmisionActualizar').click();await a.tick();assert.match(a.el('transmisionEstado').textContent,/No se pudo/);assert.ok(a.el('undo'));}finally{a.close()}
});
test('salir de pantalla y revocar acceso al juego destruyen el reproductor',async()=>{const a=await setup();try{a.el('transmisionVer').click();Object.defineProperty(a.w.document,'hidden',{value:true,configurable:true});a.w.document.dispatchEvent(new a.w.Event('visibilitychange'));assert.equal(a.w.document.querySelectorAll('iframe').length,0);Object.defineProperty(a.w.document,'hidden',{value:false,configurable:true});a.el('transmisionVer').click();a.w.document.querySelector('main').replaceChildren();await a.tick();assert.equal(a.w.document.querySelectorAll('iframe').length,0);assert.deepEqual(a.errors,[]);}finally{a.close()}});
