import test from 'node:test';import assert from 'node:assert/strict';import {randomIndex,chooseWinner,assertSameSource,validateSnapshot,validatePrize} from '../supabase/functions/slot-premios/core.mjs';import {createHandler} from '../supabase/functions/slot-premios/handler.mjs';
import {isConsolationPrize,consolationPool} from '../supabase/functions/slot-premios/round-rules.mjs';
const owner='5121c2ba-c8f1-40f8-8b3e-130a75f60ac5';
const people=[{name:'Ana',personId:'a',ticket:'1'},{name:'Ana',personId:'a',ticket:'2'},{name:'Ana',personId:'a',ticket:'3'},{name:'Luis',personId:'b',ticket:'4'}];
test('one opportunity per person chooses among people then exact owned ticket',()=>{const sizes=[];const w=chooseWinner(people,[],{uniquePerson:true},n=>{sizes.push(n);return n-1});assert.deepEqual(sizes,[2,1]);assert.equal(w.name,'Luis');assert.equal(w.ticket,'4')});
test('exclusion removes all tickets belonging to prior winner only in person mode',()=>{assert.equal(chooseWinner(people,[people[0]],{uniquePerson:true},()=>0).name,'Luis');assert.equal(chooseWinner(people,[people[0]],{uniquePerson:false},()=>0).ticket,'2');assert.throws(()=>chooseWinner([people[0]],[people[0]],{uniquePerson:true}));});
test('unbiased selection rejects the top incomplete range and invalid pools',()=>{let calls=0;assert.equal(randomIndex(3,a=>a[0]=calls++===0?4294967295:4),1);assert.equal(calls,2);assert.throws(()=>randomIndex(0))});
test('changed source or withdrawn approval blocks drawing',()=>{assert.throws(()=>assertSameSource('1','2'));assert.throws(()=>assertSameSource('1',null));assert.throws(()=>validateSnapshot(people,people.slice(1)));assert.doesNotThrow(()=>validateSnapshot(people,[...people,{personId:'c',ticket:'5'}]));assert.throws(()=>validatePrize(' '));assert.equal(validatePrize(' 10 USD '),'10 USD')});
function setup(){
 let state=null,mutations=[],anchor='80',user=owner,time=Date.parse('2026-10-27T18:00:00Z'),proof=null,rounds=[];
 const accesses=new Map(),sid='10000000-0000-4000-8000-000000000001',sid2='10000000-0000-4000-8000-000000000002';
 const registrations=[{id:80,nombre:'Ana',cedula:'V-123',cartones:[1,2]},{id:81,nombre:'Luis',cedula:'456',cartones:[4]}];
 const tokenFor=t=>['good','second','old','password'].includes(t)?'test.'+Buffer.from(JSON.stringify({sub:owner,role:'authenticated',session_id:t==='second'?sid2:sid,amr:[{method:t==='password'?'password':'otp',timestamp:Math.floor(Date.parse('2026-10-27T18:00:00Z')/1000)-(t==='old'?60:0)}]})).toString('base64url')+'.mock':t;
 const validTokens=new Set(['good','second','old','password'].map(tokenFor));
 const fetcher=async(url,options={})=>{
  const path=new URL(url).pathname,q=new URL(url).searchParams;
  if(path==='/auth/v1/user')return Response.json(validTokens.has(options.headers.Authorization.replace('Bearer ',''))?{id:user,email_confirmed_at:'2026-10-01'}:{},{status:validTokens.has(options.headers.Authorization.replace('Bearer ',''))?200:401});
  if(path==='/functions/v1/admin-auth'){const b=JSON.parse(options.body);return Response.json({valid:b.password==='correct'&&b.email==='admin@example.org'},{status:b.password==='correct'&&b.email==='admin@example.org'?200:401});}
  if(path==='/rest/v1/slot_accesos'){
   if(options.method==='POST'){const r=JSON.parse(options.body);accesses.set(r.proof_hash,r);return Response.json([r]);}
   const r=accesses.get((q.get('proof_hash')||'').replace('eq.',''));
   if(!r||q.get('owner_id')!=='eq.'+r.owner_id)return Response.json([]);
   if(options.method==='PATCH'){if(q.get('auth_session_id')==='is.null'&&r.auth_session_id)return Response.json([]);Object.assign(r,JSON.parse(options.body));}
   return Response.json([structuredClone(r)]);
  }
  if(path==='/rest/v1/rpc/slot_asignar_premios'){
   const b=JSON.parse(options.body);assert.equal(b._owner_id,owner);assert.equal(b._session_id,state.id);
   for(const source of b._sources){const original=registrations.find(r=>r.id===source.sourceId);assert.ok(original);assert.equal(source.cedula,original.cedula.replace(/\D/g,''));}
   const eligible=state.state.winners.filter(w=>['1 cartón gratis','1 carton gratis'].includes(w.prize.toLowerCase())&&!(state.state.awards||[]).some(a=>a.drawId===w.drawId));
   assert.equal(b._sources.length,eligible.length);
   const pending=eligible.map(w=>({drawId:w.drawId,name:w.name,winningTicket:w.ticket,paymentComplete:true}));
   if(b._confirm){state.state.awards=[...(state.state.awards||[]),...eligible.map((w,i)=>({drawId:w.drawId,name:w.name,winningTicket:w.ticket,assignedTicket:String(100+i)}))];state.version++;}
   return Response.json({pending:b._confirm?[]:pending,awards:state.state.awards||[],available:10,canAssign:pending.length>0&&!b._confirm});
  }
  if(path==='/rest/v1/slot_rondas_excluidos'){assert.equal(options.method,'GET');return Response.json(q.get('source_anchor')==='eq.'+anchor?rounds:[]);}
  if(path==='/rest/v1/inscripciones'){assert.equal(options.method,'GET','purchases must only be read');return Response.json(q.get('select')==='id'?(anchor?[{id:anchor}]:[]):registrations);}
  if(path==='/rest/v1/slot_premios_sesiones'){
   if(options.method==='POST'){state={...JSON.parse(options.body),created_at:'2026-10-27T18:00:00Z',updated_at:'2026-10-27T18:00:00Z'};mutations.push('history:insert');return Response.json([structuredClone(state)])}
   if(options.method==='PATCH'){if(q.get('version')!=='eq.'+state.version)return Response.json([]);Object.assign(state,JSON.parse(options.body));mutations.push('history:update');return Response.json([structuredClone(state)])}
   return Response.json(state?[structuredClone(state)]:[]);
  }
  throw Error('Unexpected URL '+url)
 };
 const handler=createHandler({url:'https://example.supabase.co',key:'server-test-key',fetcher,pick:()=>0,now:()=>new Date(time).toISOString()});
 async function raw(body,token='good',origin='https://bingoandino75.com'){const r=await handler(new Request('https://example.supabase.co/functions/v1/slot-premios',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokenFor(token),Origin:origin},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()}}
 async function password(){return raw({action:'password-check',email:'admin@example.org',password:'correct'},'anon');}
 async function call(body,token='good',origin='https://bingoandino75.com'){
  if(token==='good'&&!proof){const p=await password();if(p.status!==200)return p;proof=p.body.passwordProof;const a=await raw({action:'authorize',passwordProof:proof});if(a.status!==200)return a;}
  return raw({...body,slotAccess:proof},token,origin);
 }
 return {call,raw,password,mutations,registrations,setRounds:r=>rounds=r,setAnchor:a=>anchor=a,setUser:u=>user=u,setTime:t=>time=t,getState:()=>structuredClone(state)};
}
test('API rejects unauthenticated and nonadmin users before reading data',async()=>{const f=setup();assert.equal((await f.call({action:'load'},'bad')).status,401);f.setUser('someone-else');assert.equal((await f.call({action:'load'})).status,403);assert.deepEqual(f.mutations,[])});
test('API loads only approvals, returns no cedula, and persists only isolated history',async()=>{const f=setup(),r=await f.call({action:'load'});assert.equal(r.status,200);assert.equal(r.body.session.participants.length,3);assert.equal(JSON.stringify(r.body).includes('cedula'),false);assert.deepEqual(f.mutations,['history:insert']);assert.notEqual(r.body.session.participants[0].personId,'123')});
test('server draw is idempotent and preserves exact ticket ownership',async()=>{const f=setup(),s=(await f.call({action:'load'})).body.session;const request={action:'draw',sessionId:s.id,drawId:crypto.randomUUID(),prize:'10 USD',uniquePerson:true,excludeWinners:true};const a=await f.call(request),b=await f.call(request);assert.equal(a.status,200);assert.deepEqual(a.body.winner,b.body.winner);assert.equal(f.getState().state.winners.length,1);assert.equal(a.body.winner.name,'Ana');assert.equal(a.body.winner.ticket,'1');assert.deepEqual(f.mutations,['history:insert','history:update']);const c=await f.call({...request,drawId:crypto.randomUUID()});assert.equal(c.body.winner.name,'Luis')});
test('concurrent draws cannot both claim one session version',async()=>{const f=setup(),s=(await f.call({action:'load'})).body.session;const request={action:'draw',sessionId:s.id,prize:'10 USD',uniquePerson:true,excludeWinners:true};const r=await Promise.all([f.call({...request,drawId:crypto.randomUUID()}),f.call({...request,drawId:crypto.randomUUID()})]);assert.deepEqual(r.map(x=>x.status).sort(),[200,409]);assert.equal(f.getState().state.winners.length,1)});
test('reset or unknown action cannot mutate purchases/history',async()=>{const f=setup(),s=(await f.call({action:'load'})).body.session;f.setAnchor('200');const r=await f.call({action:'draw',sessionId:s.id,drawId:crypto.randomUUID(),prize:'10 USD',uniquePerson:true,excludeWinners:true});assert.equal(r.status,409);assert.equal((await f.call({action:'delete'})).status,400);assert.deepEqual(f.mutations,['history:insert']);assert.equal((await f.call({action:'load'},'good','https://bad.example')).status,403)});

test('remove exactly one winner, keep approvals and tombstone, persist after reload and retry safely',async()=>{
 const f=setup(),s=(await f.call({action:'load'})).body.session;
 const req={action:'draw',sessionId:s.id,drawId:crypto.randomUUID(),prize:'1 cartón gratis',uniquePerson:true,excludeWinners:true};
 await f.call(req);await f.call({...req,drawId:crypto.randomUUID()});
 const r=await f.call({action:'remove-winner',sessionId:s.id,drawId:req.drawId});
 assert.equal(r.status,200);assert.equal(r.body.session.winners.length,1);assert.equal(r.body.session.winners[0].name,'Luis');
 assert.equal(r.body.session.participants.length,3);assert.equal(f.getState().state.removedWinners[0].drawId,req.drawId);
 assert.equal((await f.call({action:'session',sessionId:s.id})).body.session.winners.length,1);
 const version=f.getState().version;assert.equal((await f.call({action:'remove-winner',sessionId:s.id,drawId:req.drawId})).status,200);assert.equal(f.getState().version,version);
 assert.equal((await f.call(req)).status,409);
 assert.equal((await f.call({...req,drawId:crypto.randomUUID()})).body.winner.name,'Ana');
});
test('remove rejects unauthenticated, nonadmin, invalid or unknown winner without mutation',async()=>{
 const f=setup(),s=(await f.call({action:'load'})).body.session,req={action:'remove-winner',sessionId:s.id,drawId:crypto.randomUUID()};
 assert.equal((await f.call(req,'bad')).status,401);f.setUser('someone-else');assert.equal((await f.call(req)).status,403);f.setUser(owner);
 assert.equal((await f.call({...req,drawId:'bad'})).status,400);assert.equal((await f.call(req)).status,404);assert.deepEqual(f.mutations,['history:insert']);
});
test('concurrent draw and removal cannot overwrite either update silently',async()=>{
 const f=setup(),s=(await f.call({action:'load'})).body.session,draw={action:'draw',sessionId:s.id,drawId:crypto.randomUUID(),prize:'10 USD',uniquePerson:true,excludeWinners:true};
 await f.call(draw);
 const r=await Promise.all([f.call({action:'remove-winner',sessionId:s.id,drawId:draw.drawId}),f.call({...draw,drawId:crypto.randomUUID()})]);
 assert.ok(r.every(x=>x.status===200||x.status===409));assert.ok(r.some(x=>x.status===200));if(r.every(x=>x.status===200)){assert.equal(f.getState().state.winners.length,1);assert.equal(f.getState().state.removedWinners[0].drawId,draw.drawId);}
});

test('email OTP alone cannot load, read history, draw, remove or sign out slot',async()=>{
 const f=setup();for(const action of ['load','session','history','draw','remove-winner','sign-out','preview-awards','assign-awards'])assert.equal((await f.raw({action})).status,401,action);
 assert.equal((await f.raw({action:'authorize'})).status,401);assert.deepEqual(f.mutations,[]);
});
test('wrong password produces no usable challenge; fake proof rejected',async()=>{
 const f=setup();assert.equal((await f.raw({action:'password-check',email:'admin@example.org',password:'wrong'},'anon')).status,401);
 assert.equal((await f.raw({action:'authorize',passwordProof:'a'.repeat(64)})).status,401);
});
test('password then fresh email OTP grants only that auth session; refresh session identity remains valid',async()=>{
 const f=setup(),p=(await f.password()).body.passwordProof;
 assert.equal((await f.raw({action:'authorize',passwordProof:p},'old')).status,401);
 assert.equal((await f.raw({action:'authorize',passwordProof:p},'password')).status,401);
 assert.equal((await f.raw({action:'authorize',passwordProof:p},'bad')).status,401);
 assert.equal((await f.raw({action:'authorize',passwordProof:p})).status,200);
 assert.equal((await f.raw({action:'history',slotAccess:p})).status,200);
 assert.equal((await f.raw({action:'authorize',passwordProof:p},'second')).status,401);
 assert.equal((await f.raw({action:'history',slotAccess:p},'second')).status,401);
 assert.equal((await f.raw({action:'history',slotAccess:p})).status,200);
});
test('unredeemed password expires; granted session expires and sign out revokes it',async()=>{
 const f=setup(),p=(await f.password()).body.passwordProof;f.setTime(Date.parse('2026-10-27T18:11:00Z'));
 assert.equal((await f.raw({action:'authorize',passwordProof:p})).status,401);
 const g=setup(),q=(await g.password()).body.passwordProof;await g.raw({action:'authorize',passwordProof:q});
 assert.equal((await g.raw({action:'sign-out',slotAccess:q})).status,200);
 assert.equal((await g.raw({action:'history',slotAccess:q})).status,401);
 const h=setup(),z=(await h.password()).body.passwordProof;await h.raw({action:'authorize',passwordProof:z});h.setTime(Date.parse('2026-10-28T03:00:00Z'));
 assert.equal((await h.raw({action:'history',slotAccess:z})).status,401);
});
test('password challenge cannot be redeemed concurrently by two auth sessions',async()=>{
 const f=setup(),p=(await f.password()).body.passwordProof;
 const r=await Promise.all([f.raw({action:'authorize',passwordProof:p}),f.raw({action:'authorize',passwordProof:p},'second')]);
 assert.equal(r.filter(x=>x.status===200).length,1);assert.equal(r.filter(x=>x.status!==200).length,1);
});

test('award API derives owner and sources on server, previews only free-card winners, protects delivered results',async()=>{
 const f=setup(),s=(await f.call({action:'load'})).body.session;
 const free={action:'draw',sessionId:s.id,drawId:crypto.randomUUID(),prize:'1 cartón gratis',uniquePerson:true,excludeWinners:true};
 await f.call(free);await f.call({...free,drawId:crypto.randomUUID(),prize:'10 USD'});
 const p=await f.call({action:'preview-awards',sessionId:s.id,_sources:[{sourceId:999}],_owner_id:'forged'});
 assert.equal(p.status,200);assert.equal(p.body.preview.pending.length,1);assert.equal(p.body.preview.pending[0].name,'Ana');assert.equal(f.getState().state.awards,undefined);
 const a=await f.call({action:'assign-awards',sessionId:s.id,_sources:[],_owner_id:'forged'});
 assert.equal(a.status,200);assert.equal(a.body.session.awards.length,1);assert.equal(a.body.session.awards[0].drawId,free.drawId);
 assert.equal(JSON.stringify(a.body).includes('cedula'),false);
 assert.equal((await f.call({action:'remove-winner',sessionId:s.id,drawId:free.drawId})).status,409);
 assert.equal((await f.call({action:'assign-awards',sessionId:s.id})).body.session.awards.length,1);
});

test('round exclusions apply to every ticket/person and cannot be bypassed by repetition or ticket mode; all tied round winners included',async()=>{
 for(const uniquePerson of [true,false]){
 const f=setup();f.registrations.push({id:82,nombre:'Mara',cedula:'789',cartones:[5,6]});
 f.setRounds([{fecha:'2026-10-29',enviados_en:'2026-10-29T20:00:00Z',ganadores:[{name:'Ana',cedula:'123',ticket:'1',round:1,type:'ronda'},{name:'Luis',cedula:'456',ticket:'4',round:1,type:'ronda'}]}]);
 const s=(await f.call({action:'load'})).body.session;
 const req={action:'draw',sessionId:s.id,drawId:crypto.randomUUID(),prize:'10 USD',uniquePerson,excludeWinners:false};
 const r=await f.call(req);assert.equal(r.status,200);assert.equal(r.body.winner.name,'Mara');assert.equal(r.body.session.roundExclusions.winners.length,2);assert.equal(r.body.winner.roundsSent,true);assert.ok(!JSON.stringify(r.body).includes('cedula'));
 const retry=await f.call(req);assert.equal(retry.body.winner.drawId,r.body.winner.drawId);
 const gift=await f.call({...req,drawId:crypto.randomUUID(),prize:'1 cartón gratis'});assert.equal(gift.body.winner.name,'Ana');
 }
});
test('missing rounds warn without preventing draw; list updated before next draw; empty eligible pool cannot select an excluded person',async()=>{
 const f=setup(),s=(await f.call({action:'load'})).body.session;
 assert.equal((await f.call({action:'rounds',sessionId:s.id})).body.rounds.sent,false);
 const req={action:'draw',sessionId:s.id,drawId:crypto.randomUUID(),prize:'10 USD',uniquePerson:true,excludeWinners:false};
 const first=await f.call(req);assert.equal(first.status,200);assert.equal(first.body.winner.roundsSent,false);
 f.setRounds([{ganadores:[{name:'Ana',cedula:'123',ticket:'1',round:1,type:'ronda'}]}]);
 assert.equal((await f.call({...req,drawId:crypto.randomUUID()})).body.winner.name,'Luis');
 f.setRounds([{ganadores:[{name:'Ana',cedula:'123'},{name:'Luis',cedula:'456'}]}]);
 assert.equal((await f.call({...req,drawId:crypto.randomUUID()})).status,400);
 assert.equal((await f.raw({action:'rounds',sessionId:s.id})).status,401);
});
test('cash rule narrowly recognizes 10 USD and leaves edited noncash/free prizes unchanged',()=>{
 for(const label of ['10 USD','10 usd',' $10 ','10$'])assert.equal(isConsolationPrize(label),true);
 for(const label of ['1 cartón gratis','110 USD','10 cartones','20 USD'])assert.equal(isConsolationPrize(label),false);
 const r={sent:true,winners:[{personId:'a'}]};assert.deepEqual(consolationPool(people,'10 USD',r),[people[3]]);assert.deepEqual(consolationPool(people,'1 cartón gratis',r),people);
});
