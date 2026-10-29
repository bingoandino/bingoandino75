import test from 'node:test';import assert from 'node:assert/strict';
import {spinSeconds,animationParticipants,createSpinPlan} from '../slot/spin-plan.js';
import {spinCylinder} from '../slot/spin-cylinder.js';
const pool=Array.from({length:300},(_,i)=>({name:'Persona '+i,personId:'p'+i,ticket:String(i+1)}));
test('3, 5 and 8 second settings persist; prior fast/normal settings migrate safely',()=>{
 for(const n of [3,5,8])assert.equal(spinSeconds({speed:String(n),speedRevision:3}),n);
 assert.equal(spinSeconds({speed:'fast',speedRevision:2}),3);assert.equal(spinSeconds({speed:'normal',speedRevision:2}),5);
 for(const s of [{},{speed:'999',speedRevision:3},{speed:'0',speedRevision:3}])assert.equal(spinSeconds(s),5);
});
test('visual plans vary across the full pool, keep name/ticket paired and finish on the supplied winner',()=>{
 const before=structuredClone(pool),winner={...pool[289],drawId:'w'};
 for(const seconds of [3,5,8]){
 const plan=createSpinPlan(pool,winner,seconds*1000,n=>n-1),seen=Array.from({length:plan.finalIndex},(_,i)=>plan.panel(i));
 assert(new Set(seen.map(p=>p.personId)).size>20);assert.equal(plan.panel(plan.finalIndex),winner);
 for(const p of seen)assert.equal(p.name,pool.find(x=>x.ticket===p.ticket).name);
 const other=createSpinPlan(pool,winner,seconds*1000,()=>0);assert.notDeepEqual(seen.map(x=>x.ticket),Array.from({length:plan.finalIndex},(_,i)=>other.panel(i).ticket));
 }
 assert.deepEqual(pool,before);
});
test('many tickets from one person do not crowd out other visible names; tiny pools work',()=>{
 const p=[...Array.from({length:100},(_,i)=>({...pool[0],ticket:String(1000+i)})),...pool.slice(1,20)];
 const plan=createSpinPlan(p,pool[2],8000,()=>0);
 assert.equal(new Set(Array.from({length:20},(_,i)=>plan.panel(i-2).personId)).size,20);
 for(const n of [1,2]){const small=pool.slice(0,n),p=createSpinPlan(small,small[0],3000,()=>0);assert.equal(p.panel(p.finalIndex).ticket,small[0].ticket);}
});
test('visual eligibility respects current exclusion rules and includes the winner of this draw',()=>{
 const winner={...pool[2],drawId:'current'},previous={...pool[0],drawId:'previous'},s={participants:pool,winners:[previous,winner]};
 const eligible=animationParticipants(s,winner);assert(!eligible.some(p=>p.personId===previous.personId));assert(eligible.includes(pool[2]));
 assert.equal(animationParticipants(s,winner,{excludeWinners:false}).length,pool.length);
});
test('cylinder lasts exactly the selected duration, draws more than six names with bounded canvas size, and removes overlay',async()=>{
 const originals={};for(const k of ['document','devicePixelRatio','requestAnimationFrame'])originals[k]=globalThis[k];
 try{
 for(const seconds of [3,5,8]){
 const names=new Set(),canvases=[],frames=[];let removed=false;
 const ctx=()=>new Proxy({scale(){},measureText:t=>({width:t.length*7}),fillText:t=>{if(t.startsWith('Persona '))names.add(t);}}, {get:(o,k)=>k in o?o[k]:()=>{}});
 globalThis.devicePixelRatio=2;globalThis.document={createElement:()=>{const c={setAttribute(){},getContext:()=>ctx(),remove(){removed=true}};canvases.push(c);return c;}};
 globalThis.requestAnimationFrame=fn=>frames.push(fn);
 const winner=pool[299],reel={getBoundingClientRect:()=>({width:700,height:240}),append(){}};
 const promise=spinCylinder(reel,{participants:pool,winner,prize:'1 cartón gratis',duration:seconds*1000});
 for(let t=0;t<seconds*1000;t+=20){const frame=frames.shift();assert(frame);frame(t);assert.equal(removed,false);}
 frames.shift()(seconds*1000);const neighbors=await promise;
 assert.equal(removed,true);assert(names.size>6);assert.equal(canvases.length,2);assert(canvases[1].height<2000);assert(neighbors.before.ticket);assert(neighbors.after.ticket);
 }
 }finally{for(const [k,v] of Object.entries(originals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
test('reduced motion skips the animated overlay',async()=>{await spinCylinder(null,{participants:pool,winner:pool[0],reduced:true});});
