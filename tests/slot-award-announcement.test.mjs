import test from 'node:test';
import assert from 'node:assert/strict';
import {announcementPages,drawAnnouncement} from '../slot/award-announcement.js';

test('announcement contains only confirmed assigned tickets; ten recipients span two pages',()=>{
 const s={winners:[{name:'Pendiente',ticket:'999',prize:'1 cartón gratis'}],awards:Array.from({length:10},(_,i)=>({name:'Persona '+i,assignedTicket:String(i+1).padStart(4,'0'),winningTicket:'999',cedula:'privado',telefono:'privado'}))};
 const pages=announcementPages(s);
 assert.deepEqual(pages.map(p=>p.length),[8,2]);
 assert.deepEqual(pages.flat()[0],{name:'Persona 0',ticket:'0001'});
 assert.equal(pages.flat().length,s.awards.length);
 assert.deepEqual(announcementPages({winners:s.winners}),[]);
 assert.deepEqual(announcementPages({awards:[{name:'Sin entrega'},{assignedTicket:''}]}),[]);
});

test('announcement draws assigned ticket prominently and marks demo images',async()=>{
 const text=[];globalThis.Image=class{async decode(){throw new Error('Offline background');}};
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),measureText:t=>({width:t.length*18}),fillText:(...args)=>text.push(args)}, {get:(o,k)=>k in o?o[k]:()=>{}});
 const canvas={getContext:()=>ctx};
 await drawAnnouncement(canvas,[{name:'María Pérez',ticket:'0258'}],{date:'28/10/2026',example:true,page:2,pages:2});
 assert.equal(canvas.width,1080);assert.equal(canvas.height,1350);
 assert(text.some(t=>t[0]==='0258'));assert(text.some(t=>t[0]==='CARTÓN ASIGNADO'));
 assert(text.some(t=>t[0]==='EJEMPLO · 28/10/2026 · 2 de 2'));
 delete globalThis.Image;
});
