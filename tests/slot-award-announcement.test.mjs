import test from 'node:test';
import assert from 'node:assert/strict';
import {announcementText} from '../slot/award-announcement.js';

test('copy announcement matches the approved vertical message with celebration for each recipient',()=>{
 const text=announcementText({awards:[{name:'María Pérez',assignedTicket:'258',winningTicket:'999'},{name:'Carlos Rojas',assignedTicket:'643'}]});
 assert.equal(text,'🎉 *¡Felicidades, familia binguera!* 💜💛\n\nSus cartones de regalo fueron asignados al azar:\n\n🎊 *María Pérez*\n🎟️ Cartón asignado: *258*\n\n🎊 *Carlos Rojas*\n🎟️ Cartón asignado: *643*\n\n✅ Ya están verificados. Pueden ver su cartón en *«Verificar tu compra»* con sus datos registrados.\n\n🍀 ¡Mucha suerte!');
 assert(!text.includes('999'));
});
test('copy includes all ten confirmed deliveries only, preserves exact ticket, and omits private fields',()=>{
 const awards=Array.from({length:10},(_,i)=>({name:'Persona '+i,assignedTicket:String(i+1).padStart(4,'0'),cedula:'PRIVADO',telefono:'PRIVADO',pago_banco:'PRIVADO'}));
 const text=announcementText({awards:[...awards,{name:'Sin entrega'}],winners:[{name:'Pendiente',ticket:'999'}]});
 assert.equal(text.match(/🎊 /g).length,10);assert.equal(text.match(/🎟️ Cartón asignado/g).length,10);
 assert(text.includes('*0010*'));assert(!/PRIVADO|Pendiente|Sin entrega/.test(text));
 assert.equal(announcementText({winners:[{prize:'1 cartón gratis'}]}),'');
 assert.equal(announcementText({awards:[{assignedTicket:''}]}),'');
});
test('demo copy is clearly marked and names cannot inject lines or messaging formatting',()=>{
 const text=announcementText({awards:[{name:'*María*\n_fake_',assignedTicket:'0258'}]},{example:true});
 assert(text.startsWith('🧪 *EJEMPLO · Sin cartones reales*\n\n'));
 assert(text.includes('🎊 *María fake*\n🎟️ Cartón asignado: *0258*'));
});
