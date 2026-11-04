const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');

const migration=fs.readFileSync(path.join(__dirname,'../supabase/fidelidad-semanal.sql'),'utf8');
const start=new Date('2026-10-26T12:00:00Z');
const iso=i=>new Date(start.getTime()+i*86400000).toISOString().slice(0,10);
const id=num=>'10000000-0000-4000-8000-'+String(num).padStart(12,'0');

async function setup(){
 const db=new PGlite();
 await db.exec([
 'create role anon; create role authenticated; create role service_role bypassrls;',
 'create table public.inscripciones(id bigint primary key,nombre text,cedula text,cartones bigint[],estado text,monto_bs numeric,origen_registro text);',
 'create table public.resultados_publicados(fecha date primary key,resultado jsonb not null,publicado_en timestamptz default now());',
 'grant usage on schema public to anon,authenticated,service_role;',
 'grant all on all tables in schema public to service_role;'
 ].join('\n'));
 await db.exec(migration);
 return db;
}
async function day(db,index,{withoutMary=false,missingWinner=false}={}){
 const date=iso(index),base=index*100;
 await db.exec('delete from public.inscripciones;');
 const people=[
 [base+1,'Ana','111111',100+index,'aprobado',890,'compra'],
 [base+2,'Luis','222222',200+index,'aprobado',890,'compra'],
 [base+3,'María','333333',300+index,'aprobado',890,'compra'],
 [base+4,'Pedro','444444',400+index,'aprobado',890,'compra'],
 [base+5,'Ganador','555555',500+index,'aprobado',890,'compra'],
 [base+6,'Premio slot','666666',600+index,'aprobado',0,'premio_slot'],
 [base+7,'Pendiente','777777',700+index,'pendiente',890,'compra'],
 [base+8,'Zoe','888888',800+index,'aprobado',890,'compra']
 ].filter(x=>!(withoutMary&&x[2]==='333333')&&!(index===0&&x[2]==='444444'));
 for(const x of people){
  await db.query('insert into public.inscripciones(id,nombre,cedula,cartones,estado,monto_bs,origen_registro) values($1,$2,$3,ARRAY[$4]::bigint[],$5,$6,$7)',x);
 }
 const winner=index===1?200+index:500+index;
 const result={fecha:date,version:1,grupos:[
  {tipo:'ronda',orden:1,ganadores:[{carton:missingWinner?999999:winner,premio:5000}]},
  {tipo:'final',orden:6,ganadores:[{carton:500+index,premio:12000}]},
  {tipo:'consolacion',orden:0,ganadores:index===5?[{carton:300+index,premio:8500}]:[]}
 ]};
 await db.query('insert into public.resultados_publicados(fecha,resultado) values($1,$2)',[date,JSON.stringify(result)]);
}
test('Fidelidad: solo compras aprobadas y pagadas; excluye rondas y consolación; un cupo por persona',async()=>{
 const db=await setup();
 try{
  for(let i=0;i<6;i++)await day(db,i);
  const r=(await db.query('select public.fidelidad_estado($1::date) state',[iso(5)])).rows[0].state;
  assert.equal(r.ready,true);
  // Ana compró seis días sin premios; Luis ganó una ronda, María ganó consolación,
  // Pedro faltó lunes, y los premios gratuitos no cuentan como compra.
  assert.equal(r.cantidad,2);
  assert.equal(r.participants.length,2);
  assert.equal(r.participants[0].name,'Ana');
  assert.equal(r.participants[0].ticket,105);
  const before=r.participants;
  await db.exec("insert into public.inscripciones values(909,'Compra tardía','111111',array[909], 'aprobado',890,'compra')");
  const later=(await db.query('select public.fidelidad_estado($1::date) state',[iso(5)])).rows[0].state;
  assert.deepEqual(later.participants,before,'La lista no cambia después del cierre publicado');
  assert.equal((await db.query('select count(*)::int n from fidelidad.dias')).rows[0].n,6);
  assert.equal((await db.query('select count(*)::int n from fidelidad.giros')).rows[0].n,0);
 }finally{await db.close();}
});
test('Fidelidad: bloquea si falta uno de los seis días; ninguna compra ni pago cambia',async()=>{
 const db=await setup();
 try{
  for(let i=0;i<5;i++)await day(db,i);
  const before=(await db.query('select * from public.inscripciones order by id')).rows;
  const r=(await db.query('select public.fidelidad_estado($1::date) state',[iso(5)])).rows[0].state;
  assert.equal(r.ready,false);assert.deepEqual(r.faltan,[iso(5)]);
  assert.deepEqual((await db.query('select * from public.inscripciones order by id')).rows,before);
  assert.equal((await db.query('select count(*)::int n from fidelidad.giros')).rows[0].n,0);
 }finally{await db.close();}
});
test('Fidelidad: un ganador no identificable no interrumpe publicación, y bloquea el día',async()=>{
 const db=await setup();
 try{
  await day(db,0,{missingWinner:true});
  assert.equal((await db.query('select count(*)::int n from public.resultados_publicados')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from fidelidad.dias')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from fidelidad.errores_captura')).rows[0].n,1);
 }finally{await db.close();}
});
test('Fidelidad: sin permisos públicos, no acepta sorteo fuera del sábado actual',async()=>{
 const db=await setup();
 try{
  const perms=(await db.query("select has_function_privilege('anon','public.fidelidad_estado(date)','EXECUTE') a,has_function_privilege('authenticated','public.fidelidad_girar(date,uuid,text)','EXECUTE') b")).rows[0];
  assert.equal(perms.a,false);assert.equal(perms.b,false);
  await assert.rejects(()=>db.query('select public.fidelidad_girar($1::date,$2::uuid,$3::text)',[iso(5),id(1),'Premio Fidelidad']));
 }finally{await db.close();}
});

test('Fidelidad: dos giros distintos dan dos personas distintas, un reintento no duplica y no hay tercer ganador',async()=>{
 const db=await setup();
 try{
  for(let i=0;i<6;i++)await day(db,i);
  const query='select fidelidad.girar_en_fecha($1::date,$2::uuid,$3::text,$4::date) r';
  const first=(await db.query(query,[iso(5),id(1),'Premio de prueba',iso(5)])).rows[0].r;
  const repeat=(await db.query(query,[iso(5),id(1),'No debe reemplazar premio',iso(5)])).rows[0].r;
  assert.deepEqual(repeat,first,'Un reintento nunca gira de nuevo ni cambia el premio');
  const second=(await db.query(query,[iso(5),id(2),'Premio de prueba',iso(5)])).rows[0].r;
  assert.notEqual(second.ticket,first.ticket,'No se repite persona premiada');
  await assert.rejects(()=>db.query(query,[iso(5),id(3),'Premio de prueba',iso(5)]));
  assert.equal((await db.query('select count(*)::int n from fidelidad.giros')).rows[0].n,2);
 }finally{await db.close();}
});
