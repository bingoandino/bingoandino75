const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {PGlite}=require('@electric-sql/pglite');const {JSDOM}=require('jsdom');
test('server records the bot channel but keeps normal reservation, price and pending approval rules',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create schema bingo_security;create schema storage;
 create function bingo_security.token_hash() returns bytea language sql as $$select decode('aa','hex')$$;
 create table public.inscripciones(id bigint generated always as identity primary key,nombre text,telefono text,cedula text,referido text,cartones bigint[],referencia4dig text,comprobante text,estado text,monto_bs numeric,pago_banco text,pago_telefono text,pago_cedula text,usa_promo boolean,promo_desc text,precio_unitario_bs numeric);
 create table public.cartones(numero bigint,cedula text,partida_id bigint,reserved_at timestamptz,created_at timestamptz);
 create table bingo_security.reservation_owners(numero bigint,token_hash bytea);
 create table public.configuracion(clave text,valore text);insert into public.configuracion values('precio_carton','400');
 create table storage.objects(bucket_id text,name text,metadata jsonb);insert into storage.objects values('comprobantes','prueba.jpg','{"mimetype":"image/jpeg","size":1234}');
 insert into public.cartones select n,'12345678',null,now(),now() from generate_series(1,3) n;
 insert into bingo_security.reservation_owners select n,decode('aa','hex') from generate_series(1,3) n;`);
 await db.exec(fs.readFileSync('supabase/compras-origen-bot.sql','utf8'));await db.exec('set role anon');
 const buy=(n,extra={})=>db.query('select public.rpc_registrar_compra_segura($1) id',[JSON.stringify({nombre:'Prueba Cliente',telefono:'04121234567',cedula:'12345678',cartones:[n],referencia4dig:'1234',comprobante:'https://dbkixcpwirjwjvjintkr.supabase.co/storage/v1/object/public/comprobantes/prueba.jpg',pago_banco:'0105',pago_telefono:'04121234567',pago_cedula:'12345678',...extra})]);
 await buy(1,{origen_registro:'bot',estado:'aprobado',monto_bs:0});await buy(2);await buy(3,{origen_registro:'premio_slot'});
 await assert.rejects(()=>buy(4,{origen_registro:'bot'}),/reserva vigente/);await assert.rejects(()=>buy(1,{origen_registro:'bot'}),/ya está registrado/);
 await db.exec('reset role');const rows=(await db.query('select * from public.inscripciones order by id')).rows;
 assert.deepEqual(rows.map(r=>r.origen_registro),['bot','compra','compra']);
 for(const r of rows){assert.equal(r.estado,'pendiente');assert.equal(+r.monto_bs,400);assert.equal(r.referencia4dig,'1234');assert.equal(r.pago_banco,'0105');}
 assert.equal((await db.query("select count(*)::int n from public.inscripciones where origen_registro<>'premio_slot'")).rows[0].n,3);
 }finally{await db.close()}
});
test('admin renders the bot badge with escaped names and filters bot purchases independently',()=>{
 const main=fs.readFileSync('script.js','utf8'),w=new JSDOM('<table><tbody><tr id="fila"></tr></tbody></table>',{runScripts:'outside-only',url:'https://example.test'}).window;
 try{
 w.eval(main.slice(0,main.indexOf('var supabase')));w.item={id:1,nombre:'<img src=x onerror=alert(1)>',telefono:'04121234567',cedula:'12345678',cartones:[1],estado:'pendiente',origen_registro:'bot',comprobante:'https://example.test/receipt'};w.buildWhatsAppLink=()=> 'https://wa.me/580000000000';w.tr=w.document.getElementById('fila');
 const start=main.indexOf('    tr.innerHTML = `',main.indexOf('async function cargarPanelAdmin()')),end=main.indexOf('    const btnAprobar',start);w.eval(main.slice(start,end));
 assert.match(w.tr.textContent,/🤖 Compra del bot/);assert.match(w.tr.textContent,/<img src=x/);assert.equal(w.document.querySelector('img[src=x]'),null);assert.doesNotMatch(w.tr.textContent,/Sin comprobante/);
 const ctx={};vm.runInNewContext(main.match(/^function coincideOrigenInscripcion.*$/m)[0],ctx);
 for(const [filter,origin,expected] of [['bot','bot',true],['bot','compra',false],['bot','premio_slot',false],['compra','bot',true],['compra','compra',true],['compra','premio_slot',false],['todos','bot',true]])assert.equal(ctx.coincideOrigenInscripcion(filter,origin),expected);
 }finally{w.close()}
});
