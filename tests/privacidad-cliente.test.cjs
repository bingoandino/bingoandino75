const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const {JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('las lecturas privadas envían la credencial y los comprobantes se firman antes de mostrarse',async()=>{
 const w=new JSDOM('',{url:'https://example.test',runScripts:'outside-only'}).window;const headers=[];let paths;
 try{
 const prefix='https://dbkixcpwirjwjvjintkr.supabase.co/storage/v1/object/public/comprobantes/';
 const rows=[{comprobante:prefix+'prueba.jpg'}];
 w.supabase={auth:{},rpc:()=>({}),storage:{from:bucket=>({createSignedUrls:async(p,seconds)=>{assert.equal(bucket,'comprobantes');assert.equal(seconds,3600);paths=p;return{data:[{signedUrl:'https://example.invalid/temporal'}]};}})},from:()=>({select:()=>({setHeader(k,v){headers.push([k,v]);return this;},eq(){return this;},then(resolve,reject){return Promise.resolve({data:rows}).then(resolve,reject);}})})};
 w.eval(read('referencia.js').split('(function (global) {')[0]);
 const result=await w.supabase.from('inscripciones').select('*').eq('id',1);
 assert.equal(headers[0][0],'x-bingo-reserva');assert.match(headers[0][1],/^[a-f0-9]{64}$/);assert.equal(paths[0],'prueba.jpg');assert.equal(result.data[0].comprobante,'https://example.invalid/temporal');
 }finally{w.close();}
});
test('la firma fallida oculta el comprobante y no conserva una URL pública',async()=>{
 const w=new JSDOM('',{url:'https://example.test',runScripts:'outside-only'}).window;
 try{w.supabase={storage:{from:()=>({createSignedUrls:async()=>({error:{message:'sin permiso'}})})}};w.eval(read('referencia.js').split('(function (global) {')[0]);const rows=[{comprobante:'https://dbkixcpwirjwjvjintkr.supabase.co/storage/v1/object/public/comprobantes/x.jpg'}];await w.prepararComprobantesPrivados(rows);assert.equal(rows[0].comprobante,'');}finally{w.close();}
});
test('solo admite enlaces públicos o firmados del bucket de comprobantes correcto',()=>{
 const w=new JSDOM('',{url:'https://example.test',runScripts:'outside-only'}).window;
 try{w.eval(read('script.js').split('var supabase')[0]);const base='https://dbkixcpwirjwjvjintkr.supabase.co';assert.ok(w.comprobanteURLSegura(base+'/storage/v1/object/sign/comprobantes/x.jpg?token=prueba'));for(const url of ['javascript:alert(1)',base+'.evil.example/storage/v1/object/sign/comprobantes/x.jpg',base+'/storage/v1/object/sign/cartones/x.jpg'])assert.equal(w.comprobanteURLSegura(url),'');}finally{w.close();}
});
