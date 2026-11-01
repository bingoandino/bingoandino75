const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const migration=fs.readFileSync('supabase/security/claves_heredadas_privadas.sql','utf8');
const script=fs.readFileSync('script.js','utf8');

test('no se envían claves de configuración al navegador al borrar imágenes',()=>{
  const section=script.slice(script.indexOf('async function borrarCartones()'),script.indexOf('async function entrarAdmin()'));
  assert.match(section,/rpc_validar_clave_borrar_cartones/);
  assert.doesNotMatch(section,/\.from\(['"]configuracion['"]\)/);
  assert.doesNotMatch(section,/claveCorrecta/);
  assert.match(section,/if \(!claveValida\)/);
  assert.match(section,/\.remove\(fileNames\)/);
});

test('anon y authenticated no leen secretos, solo el admin valida en SQL',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated;
      create table public.configuracion(clave text primary key,valore text,valor boolean);
      insert into public.configuracion(clave,valore) values
      ('precio_carton','890'),('clave_admin','ficticia-admin'),
      ('clave_borrar_cartones','ficticia-eliminar'),('clave_reinicio','ficticia-reinicio');
      grant usage on schema public to anon,authenticated;
      grant select on public.configuracion to anon,authenticated;
      alter table public.configuracion enable row level security;
      create policy public_read_configuracion on public.configuracion for select to public using (true);
      create function public.es_admin_bingo() returns boolean language sql stable as
      $$ select current_setting('app.test_admin',true)='yes' $$;
      grant execute on function public.es_admin_bingo() to authenticated;`);
    await db.exec(migration);
    await db.exec("set role anon");
    let result=await db.query('select clave from public.configuracion order by clave');
    assert.deepEqual(result.rows.map(x=>x.clave),['precio_carton']);
    await assert.rejects(()=>db.query("select public.rpc_validar_clave_borrar_cartones('ficticia-eliminar')"),/permission denied/i);
    await db.exec("reset role; set role authenticated; set app.test_admin='no'");
    result=await db.query('select clave from public.configuracion order by clave');
    assert.deepEqual(result.rows.map(x=>x.clave),['precio_carton']);
    await assert.rejects(()=>db.query("select public.rpc_validar_clave_borrar_cartones('ficticia-eliminar')"),/No autorizado/);
    await db.exec("set app.test_admin='yes'");
    result=await db.query('select clave from public.configuracion order by clave');
    assert.deepEqual(result.rows.map(x=>x.clave),['precio_carton']);
    const valid=await db.query("select public.rpc_validar_clave_borrar_cartones('ficticia-eliminar') as ok");
    assert.equal(valid.rows[0].ok,true);
    const invalid=await db.query("select public.rpc_validar_clave_borrar_cartones('incorrecta') as ok");
    assert.equal(invalid.rows[0].ok,false);
  } finally {await db.close()}
});
