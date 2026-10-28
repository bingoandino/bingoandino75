(function(root){
 'use strict';
 const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id);
 function parse(text){
  if(typeof text!=='string'||text.length>2048)throw Error('Pega el enlace de una transmisión de YouTube.');
  let u;try{u=new URL(text.trim())}catch{throw Error('Pega un enlace completo de YouTube que comience por https://.');}
  if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Utiliza un enlace seguro de YouTube (https://).');
  let id;
  if(u.hostname==='youtu.be')id=u.pathname.slice(1);
  else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)){
   if(u.pathname==='/watch')id=u.searchParams.get('v');
   else id=u.pathname.match(/^\/(?:live|embed|shorts)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  }
  if(!validId(id))throw Error('Pega el enlace del video o directo, no el del canal ni una lista.');
  return {id,url:'https://www.youtube.com/watch?v='+id};
 }
 function row(value){
  if(!value||!Number.isSafeInteger(value.revision)||value.revision<0||
     !(value.video_id===null||validId(value.video_id))||
     !(value.expira_en===null||Number.isFinite(Date.parse(value.expira_en))))throw Error('No se pudo verificar la transmisión.');
  return value;
 }
 function active(value){return value&&validId(value.video_id)&&Date.parse(value.expira_en)>Date.now();}
 root.TransmisionYouTube={parse,validId,row,active};
 if(typeof module==='object'&&module.exports)module.exports=root.TransmisionYouTube;
})(typeof window==='object'?window:globalThis);
