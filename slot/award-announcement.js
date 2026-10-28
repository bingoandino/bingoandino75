// Announce confirmed deliveries only; never include payment or identity fields.
export function announcementText(session,{example=false}={}){
 const delivered=(session?.awards||[]).filter(a=>a.assignedTicket!=null&&String(a.assignedTicket).trim());
 if(!delivered.length)return '';
 const clean=value=>String(value||'').replace(/[\r\n\t]+/g,' ').replace(/[*_~`]/g,'').replace(/\s+/g,' ').trim();
 const list=delivered.map(a=>'🎊 *'+clean(a.name)+'*\n🎟️ Cartón asignado: *'+clean(a.assignedTicket)+'*').join('\n\n');
 return (example?'🧪 *EJEMPLO · Sin cartones reales*\n\n':'')+'🎉 *¡Felicidades, familia binguera!* 💜💛\n\nSus cartones de regalo fueron asignados al azar:\n\n'+list+'\n\n✅ Ya están verificados. Pueden ver su cartón en *«Verificar tu compra»* con sus datos registrados.\n\n🍀 ¡Mucha suerte!';
}
