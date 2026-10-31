const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema bingo_security;create schema storage;
 create function bingo_security.token_hash() returns bytea language sql as $$select case when current_setting('app.token',true)='no' then null else decode('ab','hex') end$$;
 create table public.inscripciones(id bigint generated always as identity primary key,cedula text,referencia4dig text,comprobante text,cartones bigint[],estado text,monto_bs numeric);
 create table public.cartones(numero bigint primary key,cedula text);
 create table storage.objects(bucket_id text,name text,metadata jsonb);
 create function public.rpc_liberar_reserva_seguro(_numero bigint,_cedula text,_partida_id bigint) returns boolean language plpgsql as $$begin delete from public.cartones c where c.numero=_numero and c.cedula=_cedula and not exists(select 1 from public.inscripciones i where c.numero=any(i.cartones) and i.estado in ('pendiente','aprobado'));return true;end$$;
 create function public.rpc_registrar_compra_segura(_compra jsonb) returns bigint language plpgsql as $$declare i bigint;nums bigint[];begin
 select array_agg(value::bigint) into nums from jsonb_array_elements_text(_compra->'cartones');
 if exists(select 1 from unnest(nums)n where not exists(select 1 from public.cartones c where c.numero=n and c.cedula=_compra->>'cedula')) then raise exception 'sin reserva';end if;
 insert into public.inscripciones(cedula,referencia4dig,comprobante,cartones,estado,monto_bs) values(_compra->>'cedula',right(_compra->>'referencia4dig',4),_compra->>'comprobante',nums,'pendiente',cardinality(nums)*890) returning id into i;return i;end$$;
 insert into storage.objects values
 ('comprobantes','uno.webp','{"eTag":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","size":100,"mimetype":"image/webp"}'),
 ('comprobantes','copia.webp','{"eTag":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","size":100,"mimetype":"image/webp"}'),
 ('comprobantes','otro.webp','{"eTag":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","size":100,"mimetype":"image/webp"}');`);
 await db.exec(fs.readFileSync('supabase/reenvios-compras.sql','utf8'));
 const comprar=async({ced='12345678',ref='1234',file='uno.webp',numero=1}={})=>{await db.query('insert into cartones values($1,$2) on conflict do nothing',[numero,ced]);const r=await db.query('select public.rpc_registrar_compra_idempotente($1::jsonb) recibo',[JSON.stringify({cedula:ced,referencia4dig:ref,comprobante:'https://dbkixcpwirjwjvjintkr.supabase.co/storage/v1/object/public/comprobantes/'+file,cartones:[numero]})]);return r.rows[0].recibo;};
 return {db,comprar,count:async()=>Number((await db.query('select count(*) n from public.inscripciones')).rows[0].n)};
}
test('mismo cliente, referencia y capture devuelven la compra original sin duplicar y liberan solo la nueva selección',async()=>{
 const f=await fixture();try{const a=await f.comprar();const b=await f.comprar({file:'copia.webp',numero:2});assert.equal(b.id,a.id);assert.equal(b.reenvio,true);assert.deepEqual(b.cartones,[1]);assert.equal(await f.count(),1);assert.equal((await f.db.query('select numero from public.cartones order by numero')).rows.length,1);}finally{await f.db.close();}
});
test('clientes diferentes pueden coincidir en los cuatro dígitos y hasta en el archivo',async()=>{
 const f=await fixture();try{await f.comprar();const b=await f.comprar({ced:'87654321',numero:2});assert.equal(b.reenvio,false);assert.equal(await f.count(),2);}finally{await f.db.close();}
});
test('la referencia 0000 queda excluida aunque el cliente y capture sean iguales',async()=>{
 const f=await fixture();try{await f.comprar({ref:'0000'});const b=await f.comprar({ref:'0000',numero:2});assert.equal(b.reenvio,false);assert.equal(await f.count(),2);}finally{await f.db.close();}
});
test('otra referencia o un capture diferente no se bloquean',async()=>{
 const f=await fixture();try{await f.comprar();await f.comprar({ref:'9999',numero:2});await f.comprar({file:'otro.webp',numero:3});assert.equal(await f.count(),3);}finally{await f.db.close();}
});
test('un reenvío conserva el estado real de una compra aprobada o rechazada',async()=>{
 const f=await fixture();try{const a=await f.comprar();await f.db.query("update inscripciones set estado='rechazado' where id=$1",[a.id]);const b=await f.comprar({numero:2});assert.equal(b.estado,'rechazado');assert.equal(b.reenvio,true);}finally{await f.db.close();}
});
test('no permite consultas de reenvío sin credencial y no mezcla sorteos ya borrados',async()=>{
 const f=await fixture();try{await f.comprar();await f.db.exec("set app.token='no'");await assert.rejects(()=>f.comprar({numero:2}),/Reserva de compra no válida/);await f.db.exec("set app.token='si';delete from public.inscripciones;delete from public.cartones");const b=await f.comprar({numero:3});assert.equal(b.reenvio,false);}finally{await f.db.close();}
});
