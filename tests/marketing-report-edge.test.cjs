const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/marketing-report/index.ts'), 'utf8');
const js = ts.transpileModule(source.replace(/^import .*;\s*$/m, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
}).outputText;

function setup({ token = 'jwt', user = { id: '5121c2ba-c8f1-40f8-8b3e-130a75f60ac5', email_confirmed_at: '2026-01-01' }, active = true, expiry = Date.now()+3600000, fail = false } = {}) {
  const calls = [];
  let handle;
  const admin = {
    auth: { getUser: async (passed) => {
      calls.push('auth');
      return passed === token ? {data:{user},error:null} : {data:{user:null},error:{message:'No autorizado'}};
    }},
    from: (name) => {
      calls.push('table:'+name);
      const builder={
        select(){return this;},
        eq(){return this;},
        maybeSingle:async()=>({data:active ? {expires_at:new Date(expiry).toISOString()} : null,error:null})
      };
      return builder;
    },
    rpc: async (name, params)=>{
      calls.push('rpc:'+name);
      if(fail) return {error:{code:'denied'}};
      return { data:[{fecha_ve:'2026-11-04', tipo:'visita', origen:'instagram', sesiones:15}],error:null };
    }
  };
  vm.runInNewContext(js, {
    createClient:()=>admin,
    Deno: { serve(fn){handle=fn;}, env:{get(k){return ({
      SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'dummy-secret'
    })[k];}} },
    Request, Response, Set, Date, JSON, Number, Array, console
  });
  const run=(data,opts={})=>handle(new Request('https://example.supabase.co/functions/v1/marketing-report',{
    method:'POST',
    headers:{Origin:opts.origin||'https://bingoandino75.com','Content-Type':'application/json',...(opts.token?{Authorization:'Bearer '+opts.token}:{})},
    body:JSON.stringify(data||{sessionToken:'long-demo-session-token',deviceId:'device-123456',days:7})
  }));
  return{run,calls};
}
test('sin JWT no lee las estadísticas',async()=>{
 const s=setup();
 assert.equal((await s.run(null)).status,401);
 assert.equal(s.calls.length,0);
});
test('un origen ajeno no accede aunque adjunte token',async()=>{
 const s=setup();
 assert.equal((await s.run(null,{origin:'https://attacker.example',token:'jwt'})).status,403);
 assert.equal(s.calls.length,0);
});
test('JWT de otra cuenta no concede acceso',async()=>{
 const s=setup({user:{id:'otra-cuenta',email_confirmed_at:'2026-01-01'}});
 assert.equal((await s.run(null,{token:'jwt'})).status,403);
 assert.equal(s.calls.join(','),'auth');
});
test('la sesión admin revocada impide leer',async()=>{
 const s=setup({active:false});
 assert.equal((await s.run(null,{token:'jwt'})).status,401);
 assert.deepEqual(s.calls,['auth','table:sesiones_activas']);
});
test('la sesión admin vencida impide leer',async()=>{
 const s=setup({expiry:Date.now()-60000});
 assert.equal((await s.run(null,{token:'jwt'})).status,401);
 assert.deepEqual(s.calls,['auth','table:sesiones_activas']);
});
test('admin válido recibe únicamente datos agregados',async()=>{
 const s=setup();
 const response=await s.run(null,{token:'jwt'});
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.rows[0].sesiones,15);
 assert.equal('sesion_id' in result.rows[0],false);
 assert.deepEqual(s.calls,['auth','table:sesiones_activas','rpc:marketing_resumen']);
});
test('número de días fuera de límites se rechaza sin DB',async()=>{
 const s=setup();
 assert.equal((await s.run({sessionToken:'long-demo-session-token',deviceId:'device-123456',days:999},{token:'jwt'})).status,400);
 assert.equal(s.calls.length,0);
});
