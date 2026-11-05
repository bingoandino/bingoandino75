const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../slot/app.js'),'utf8');
const code=script.slice(script.indexOf('let refreshingRounds=false;'),script.indexOf('var sendingPayments=false;'));
test('exclusions fetch only on button click, avoid overlap and ignore an old session',async()=>{
 let resolve,calls=0,renders=0;const nodes={};
 const c={demo:false,session:{id:'first'},phase:'ready',$:id=>nodes[id]||(nodes[id]={}),renderRounds:()=>renders++,api:()=>{calls++;return new Promise(r=>resolve=r);},setInterval:()=>assert.fail('No polling'),document:{addEventListener:()=>assert.fail('No automatic refresh')},window:{addEventListener:()=>assert.fail('No focus refresh')}};
 vm.createContext(c);vm.runInContext(code,c);assert.equal(calls,0);
 const click=nodes['#refreshRounds'].onclick;
 const first=click();assert.equal(nodes['#refreshRounds'].disabled,true);await click();assert.equal(calls,1);
 c.session={id:'second'};resolve({rounds:{sent:true}});await first;assert.equal(renders,0);assert.equal(nodes['#refreshRounds'].disabled,false);
 const next=click();resolve({rounds:{sent:false,winners:[]}});await next;assert.equal(renders,1);assert.equal(c.session.roundExclusions.sent,false);assert.match(nodes['#refreshRounds'].textContent,/Traer excluidos/);
 assert.ok(!script.includes('renderResults();refreshRounds()'));
 assert.ok(!script.includes('updatePrizes();refreshRounds()'));
});
