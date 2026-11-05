const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const s=fs.readFileSync(path.join(__dirname,'../slot/app.js'),'utf8'),code=s.slice(s.indexOf('var sendingPayments=false;'));
test('send button publishes saved money winners only on click; blocks duplicate in-flight sends',async()=>{
 const nodes={};let resolve,calls=0;const c={session:{id:'s',winners:[{drawId:'cash',prize:'10 USD'},{drawId:'free',prize:'1 cartón gratis'}]},phase:'winner',pending:null,removingWinner:false,awardBusy:false,demo:false,isFreeCardPrize:p=>p==='1 cartón gratis',$:id=>nodes[id]||(nodes[id]={}),toast(){},fail(e){throw e;},api:(action,payload)=>{assert.equal(action,'send-payments');assert.equal(payload.sessionId,'s');calls++;return new Promise(r=>resolve=r);}};
 vm.createContext(c);vm.runInContext(code,c);assert.equal(calls,0);c.renderPaymentSend();assert.equal(nodes['#sendPayments'].disabled,false);
 const p=nodes['#sendPayments'].onclick();await nodes['#sendPayments'].onclick();assert.equal(calls,1);
 resolve({session:{...c.session,paymentSubmission:{drawIds:['cash']}},sent:1});await p;assert.match(nodes['#sendPaymentsStatus'].textContent,/1 ganador\(es\) enviados/);
 c.session.winners=[{drawId:'free',prize:'1 cartón gratis'}];c.renderPaymentSend();assert.equal(nodes['#sendPayments'].disabled,true);
});
