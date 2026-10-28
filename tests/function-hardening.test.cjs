const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/function-hardening-before.json','utf8'));
const patch=fs.readFileSync('supabase/security/function_hardening.sql','utf8');
const admin='5121c2ba-c8f1-40f8-8b3e-130a75f60ac5';
async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema bingo_security;
 create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,bingo_security to anon,authenticated,service_role;
 revoke create on schema public from public,anon,authenticated;
 create table public.configuracion(clave text primary key,valore text);
 create table public.cartones(numero bigint primary key,cedula text,partida_id bigint,created_at timestamptz default now(),reserved_at timestamptz);
 create table public.inscripciones(id bigint primary key,nombre text,cartones bigint[],estado text,monto_bs numeric);
 create table public.reservas_temporales(expira_en timestamptz);
 create table bingo_security.definition_backups(id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),kind text not null,payload jsonb not null);
 create table bingo_security.snapshots(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),reason text,payload jsonb);
 create table bingo_security.reservation_owners(numero bigint);
 create function bingo_security.make_snapshot(reason text) returns uuid language plpgsql as $$declare k uuid;begin insert into bingo_security.snapshots(reason,payload) values(reason,'{"inscripciones":[],"cartones":[]}'::jsonb) returning id into k;return k;end$$;
 insert into public.configuracion values('total_cartones','600');
 insert into public.inscripciones values(1,'Persona ficticia',array[4]::bigint[],'pendiente',888);
 insert into public.cartones(numero,cedula,created_at) values(4,'00000000',now()-interval '10 minutes'),(9,'00000000',now()-interval '10 minutes');
 insert into public.reservas_temporales values(now()-interval '1 minute'),(now()+interval '1 hour');
 grant select on public.configuracion to anon,authenticated;
 grant select,insert,update,delete on all tables in schema public to service_role;`);
 for(const f of fixture.helpers)await db.exec(f.definition);
 for(const f of [...fixture.paths,...fixture.guards]){
  await db.exec(f.definition);
  await db.exec(`revoke all on function public.${f.signature} from public,anon,authenticated,service_role;`);
  for(const [role,allowed] of [['anon',f.anon_execute],['authenticated',f.user_execute],['service_role',f.service_execute]])if(allowed)await db.exec(`grant execute on function public.${f.signature} to ${role};`);
 }
 await db.exec(`create trigger validar_numero before insert or update on public.cartones for each row execute function public.trg_validar_numero_carton();
 create trigger validar_inscripcion before insert or update on public.inscripciones for each row execute function public.trg_validar_cartones_inscripcion();
 create trigger validar_config before insert or update on public.configuracion for each row execute function public.trg_validar_total_cartones_config();`);
 return db;
}
async function claims(db,role,uid=''){
 await db.query("select set_config('request.jwt.claim.role',$1,false),set_config('request.jwt.claim.sub',$2,false)",[role,uid]);
}
test('fija siete rutas, conserva firmas y permisos, y guarda respaldo privado',async()=>{
 const db=await setup();try{
  const before=(await db.query("select p.oid::regprocedure::text signature,p.proacl::text acl,p.proowner,p.prorettype,p.proargtypes::text args,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by signature")).rows;
  await db.exec(patch);
  const after=(await db.query("select p.oid::regprocedure::text signature,p.proacl::text acl,p.proowner,p.prorettype,p.proargtypes::text args,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by signature")).rows;
  assert.deepEqual(after.map(({prosrc,...rest})=>rest),before.map(({prosrc,...rest})=>rest));
  for(const f of fixture.paths){
   assert.equal(after.find(x=>x.signature===f.signature).prosrc,before.find(x=>x.signature===f.signature).prosrc);
   const config=(await db.query('select proconfig from pg_proc where oid=$1::regprocedure',['public.'+f.signature])).rows[0].proconfig;
   assert.ok(config.includes('search_path=pg_catalog, public, pg_temp'));
  }
  assert.equal((await db.query('select jsonb_array_length(payload->\'functions\') n from bingo_security.definition_backups')).rows[0].n,11);
  assert.equal((await db.query('select count(*)::int n from public.inscripciones')).rows[0].n,1);
 }finally{await db.close();}
});
test('las tablas temporales no sustituyen la tabla real de limpieza',async()=>{
 const db=await setup();try{
  await db.exec(patch);
  await db.exec("create temporary table reservas_temporales(expira_en timestamptz);insert into pg_temp.reservas_temporales values(now()-interval '1 day');");
  await db.query('select public.limpiar_reservas_expiradas()');
  assert.equal((await db.query('select count(*)::int n from public.reservas_temporales')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from pg_temp.reservas_temporales')).rows[0].n,1);
 }finally{await db.close();}
});
test('claims ausentes y usuarios ajenos se rechazan; admin y servicio conservan acceso',async()=>{
 const db=await setup();try{
  // Reproduce el caso límite previo solo con registros ficticios y un ID inexistente.
  await claims(db,'','');assert.equal((await db.query('select public.rpc_eliminar_inscripcion_seguro(-99) n')).rows[0].n,0);
  await db.exec(patch);
  for(const [role,uid] of [['',''],['authenticated','11111111-1111-4111-8111-111111111111'],['anon',''],['',admin]]){
   await claims(db,role,uid);
   for(const sql of ['select public.rpc_eliminar_inscripcion_seguro(-99)','select * from public.rpc_listar_respaldos()',"select public.rpc_respaldar_sorteo('Prueba ficticia')","select public.rpc_restaurar_sorteo('00000000-0000-4000-8000-000000000000')"])
    await assert.rejects(db.query(sql),/No autorizado/);
  }
  for(const [role,uid] of [['authenticated',admin],['service_role','']]){
   await claims(db,role,uid);
   assert.equal((await db.query('select public.rpc_eliminar_inscripcion_seguro(-99) n')).rows[0].n,0);
   assert.ok((await db.query("select public.rpc_respaldar_sorteo('Prueba ficticia') id")).rows[0].id);
   assert.ok((await db.query('select * from public.rpc_listar_respaldos()')).rows.length);
   await assert.rejects(db.query("select public.rpc_restaurar_sorteo('00000000-0000-4000-8000-000000000000')"),/Respaldo no encontrado/);
  }
 }finally{await db.close();}
});
test('los triggers conservan validaciones y permiten una actualización del verificador con service_role',async()=>{
 const db=await setup();try{
  await db.exec(patch);await claims(db,'service_role');await db.exec('set role service_role');
  await db.query("update public.inscripciones set estado='aprobado' where id=1");
  assert.equal((await db.query('select estado from public.inscripciones where id=1')).rows[0].estado,'aprobado');
  await assert.rejects(db.query('insert into public.cartones(numero) values(601)'),/fuera de rango/);
  await assert.rejects(db.query("update public.inscripciones set cartones=array[601]::bigint[] where id=1"),/fuera de rango/);
  await assert.rejects(db.query("update public.configuracion set valore='3' where clave='total_cartones'"),/ya existe/);
  await db.exec('reset role;set role anon');assert.equal((await db.query('select public.fn_total_cartones_actual() n')).rows[0].n,600);
 }finally{await db.close();}
});
test('la precondición detiene el parche si una definición cambia y no deja modificaciones parciales',async()=>{
 const db=await setup();try{
  await db.exec('alter function public.fn_total_cartones_actual() set search_path=public');
  await assert.rejects(db.exec(patch),/La definición cambió/);await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from bingo_security.definition_backups')).rows[0].n,0);
  assert.equal((await db.query("select proconfig from pg_proc where oid='public.limpiar_reservas_expiradas()'::regprocedure")).rows[0].proconfig,null);
 }finally{await db.close();}
});
