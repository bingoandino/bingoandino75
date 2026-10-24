import {test} from 'node:test';import assert from 'node:assert/strict';
import {eligible,randomIndex,reelCode,fingerprint,validateDownload} from '../frontend/src/giveaway.mjs';
import {createInstagram,page} from '../backend/instagram.mjs';
const c=[{id:'1',username:'Ana',text:'hola'},{id:'2',username:'ana',text:'otra'},{id:'2',username:'ana'},{id:'3',username:'Luis'},{id:'4',username:'bingoandino75'},{id:'5',text:'sin autor'},{id:'6',username:'Oculto',hidden:true}];
test('una oportunidad por persona, sin duplicados, organizador ni ocultos',()=>assert.equal(eligible(c,'person').length,2));
test('cada comentario cuenta, sin duplicar páginas',()=>assert.equal(eligible(c,'comment').length,3));
test('acepta from.username',()=>assert.equal(eligible([{id:'9',from:{username:'Maria'}}],'person')[0].username,'Maria'));
test('valida enlace real sin dominios suplantados',()=>{assert.equal(reelCode('https://www.instagram.com/reel/DerctSBuTXS/?x=1'),'DerctSBuTXS');assert.throws(()=>reelCode('https://instagram.com.evil.com/reel/abc/'));});
test('aleatoriedad sin sesgo, rechazo del extremo sobrante',()=>{let calls=0;assert.equal(randomIndex(3,{getRandomValues(a){a[0]=++calls===1?4294967295:5;}}),2);assert.equal(calls,2);assert.throws(()=>randomIndex(0));});
test('huella independiente del orden y sensible a reglas',async()=>{assert.equal(await fingerprint(c,'person','x'),await fingerprint([...c].reverse(),'person','x'));assert.notEqual(await fingerprint(c,'person','x'),await fingerprint(c,'comment','x'));});
test('token solo en cabecera al servidor de Meta',async()=>{let target,opts;await createInstagram('secret',async(u,o)=>{target=u;opts=o;return Response.json({data:[]});})('123/media');assert.equal(target.origin,'https://graph.instagram.com');assert.equal(target.searchParams.has('access_token'),false);assert.equal(opts.headers.Authorization,'Bearer secret');});
test('no sigue URL next externa y detecta páginas incompletas',()=>{assert.deepEqual(page({data:[],paging:{next:'https://evil',cursors:{after:'abc'}}}),{items:[],next:'abc'});assert.throws(()=>page({data:[],paging:{next:'https://evil'}}));});
test('errores no filtran clave ni respuesta cruda de Meta',async()=>{await assert.rejects(createInstagram('secret',async()=>Response.json({error:{code:190,message:'secret'}},{status:400}))('me'),e=>e.message.includes('venció')&&!e.message.includes('secret'));});

test('bloquea cero comentarios cuando Instagram reporta comentarios existentes',()=>{assert.throws(()=>validateDownload([],4823),/Meta no entregó ninguno/);assert.deepEqual(validateDownload([],0),[]);assert.equal(validateDownload(c,4823),c);});

test('tres etiquetas: varias oportunidades por persona solo con combinaciones diferentes',()=>{
 const list=[
 {id:'t1',username:'Ana',text:'@luis @maria @carmen'},
 {id:'t2',username:'ana',text:'Otro texto @CARMEN @luis @MARIA 🎉'},
 {id:'t3',username:'ANA',text:'@luis @maria @jose'},
 {id:'t4',username:'Luis',text:'@ana @maria @carmen'},
 {id:'t5',username:'Ana',text:'@maria @carmen'},
 {id:'t6',username:'Ana',text:'@maria @maria @carmen'},
 {id:'t7',username:'Ana',text:'@ana @maria @carmen'},
 {id:'t8',username:'Ana',text:'@bingoandino75 @maria @carmen'},
 {id:'t9',username:'Ana',text:'@luis @maria @carmen',hidden:true},
 {id:'t10',username:'Ana',text:'@luis @maria @carmen @jose'},
 ];
 assert.deepEqual(eligible(list,'unique_tags').map(c=>c.id),['t1','t3','t4','t10']);
 assert.equal(eligible(list,'comment').length,9);
 assert.equal(eligible(list,'person').length,2);
});
test('correos y menciones inválidas no completan las tres etiquetas',()=>{
 const list=[{id:'a',username:'x',text:'correo@banco.com @maria @carmen'},{id:'b',username:'x',text:'@maria @carmen @usuario_con_nombre_demasiado_largo_123456789'},{id:'c',username:'x',text:'@luis, @maria; @carmen.'}];
 assert.deepEqual(eligible(list,'unique_tags').map(c=>c.id),['c']);
});
test('misma combinación entre autores distintos permite una oportunidad a cada uno',()=>{
 assert.equal(eligible([{id:'a',username:'x',text:'@ana @luis @maria'},{id:'b',username:'y',text:'@maria @luis @ana'}],'unique_tags').length,2);
});
