const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const owner='5121c2ba-c8f1-40f8-8b3e-130a75f60ac5';
async function fixture(){const db=new PGlite();await db.exec(`
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create schema privado_resultados;create table privado_resultados.publicadores_resultados(usuario_id uuid,activo boolean);
insert into privado_resultados.publicadores_resultados values('${owner}',true);
create table public.inscripciones(id bigint primary key,nombre text,cedula text,cartones bigint[],estado text,pago_cedula text);
insert into public.inscripciones values(80,'Ana','V-123',array[1,2],'aprobado','999'),(81,'Luis','456',array[3,4],'aprobado','999'),(82,'Pendiente','789',array[5],'pendiente','111');
grant usage on schema public,auth to anon,authenticated,service_role;
`);await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/slot-rondas.sql'),'utf8'));return db;}
const groups=[{orden:1,tipo:'ronda',cartones:[1,3]},{orden:6,tipo:'final',cartones:[2]}];
async function send(db,rounds=groups,source='80'){return (await db.query('select public.slot_enviar_rondas($1,$2,$3) r',[source,'2026-10-29',JSON.stringify(rounds)])).rows[0].r;}
async function status(db){return (await db.query('select public.slot_estado_rondas() r')).rows[0].r;}
test('SQL includes every winner, registration identity not payment identity; writes only isolated list; public output has no private data',async()=>{
 const db=await fixture();try{
 const before=(await db.query('select * from public.inscripciones order by id')).rows;
 await db.exec(`set test.uid='${owner}';set role authenticated;`);
 const r=await send(db);assert.equal(r.people,2);assert.equal(r.winners.length,3);assert.equal(r.sent,true);assert.ok(r.winners.every(w=>!('cedula' in w)));
 await db.exec('reset role');const privateRows=(await db.query('select ganadores from public.slot_rondas_excluidos')).rows[0].ganadores;assert.deepEqual(privateRows.map(w=>w.cedula),['123','456','123']);
 assert.deepEqual((await db.query('select * from public.inscripciones order by id')).rows,before);
 await db.exec('set role anon');assert.deepEqual(await status(db),r);await assert.rejects(()=>db.query('select * from public.slot_rondas_excluidos'),/permission denied/);await assert.rejects(()=>send(db),/permission denied/);
 }finally{await db.close();}
});
test('only authorized publisher can send; validates source and every card; invalid replacement retains prior list',async()=>{
 const db=await fixture();try{
 await db.exec("set role authenticated;set test.uid='10000000-0000-4000-8000-000000000001'");await assert.rejects(()=>send(db),/no autorizado/);
 await db.exec(`set test.uid='${owner}'`);const r=await send(db);
 await assert.rejects(()=>send(db,groups,'old'),/sorteo cambió/);
 for(const rounds of [[{orden:1,tipo:'ronda',cartones:[1,5]}],[{orden:1,tipo:'ronda',cartones:[1,1]}],[{orden:1,tipo:'consolacion',cartones:[1]}],[]])await assert.rejects(()=>send(db,rounds));
 assert.deepEqual(await status(db),r);
 }finally{await db.close();}
});
test('re-sending replaces corrections; historical lists never apply after bingo reset',async()=>{
 const db=await fixture();try{
 await db.exec(`set test.uid='${owner}';set role authenticated`);await send(db);const r=await send(db,[{orden:2,tipo:'ronda',cartones:[3]}]);assert.equal(r.people,1);assert.equal(r.winners[0].name,'Luis');
 await db.exec("reset role;delete from public.inscripciones;insert into public.inscripciones values(200,'Nuevo','123',array[1],'aprobado','999');set role anon");const next=await status(db);assert.equal(next.sent,false);assert.deepEqual(next.winners,[]);assert.equal(next.source,'200');
 }finally{await db.close();}
});
