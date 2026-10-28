// Only confirmed deliveries are announcement material. Never expose registration data.
export function announcementPages(session) {
 const rows=(session?.awards||[]).filter(a=>a.assignedTicket!=null&&String(a.assignedTicket).trim()).map(a=>({name:String(a.name||''),ticket:String(a.assignedTicket)}));
 return Array.from({length:Math.ceil(rows.length/8)},(_,i)=>rows.slice(i*8,i*8+8));
}
function lines(ctx,text,width,size){
 ctx.font='bold '+size+'px Georgia';const result=[];let line='';
 for(const letter of Array.from(text)){if(line&&ctx.measureText(line+letter).width>width){result.push(line.trim());line='';}line+=letter;}if(line)result.push(line.trim());return result;
}
export async function drawAnnouncement(canvas,rows,{date,example=false,page=1,pages=1}={}){
 canvas.width=1080;canvas.height=1350;const x=canvas.getContext('2d');
 x.fillStyle='#281036';x.fillRect(0,0,1080,1350);
 const image=new Image();image.src='mountains.webp';try{await image.decode();const scale=Math.max(1080/image.width,1350/image.height);x.drawImage(image,(1080-image.width*scale)/2,(1350-image.height*scale)/2,image.width*scale,image.height*scale);}catch{}
 const shade=x.createLinearGradient(0,0,0,1350);shade.addColorStop(0,'#240c32bb');shade.addColorStop(.4,'#240c32df');shade.addColorStop(1,'#180821f2');x.fillStyle=shade;x.fillRect(0,0,1080,1350);
 x.strokeStyle='#d7af58';x.lineWidth=3;x.strokeRect(22,22,1036,1306);x.textAlign='center';x.fillStyle='#f2d38b';
 x.font='bold 46px Georgia';x.fillText('BINGO ANDINO 75',540,88);x.font='bold 38px Georgia';x.fillText('¡TU CARTÓN GRATIS YA ESTÁ ASIGNADO!',540,151,980);
 x.font='23px system-ui';x.fillText((example?'EJEMPLO · ': '')+date+(pages>1?' · '+page+' de '+pages:''),540,196);
 const columns=rows.length===1?1:2,rowCount=Math.ceil(rows.length/columns),height=columns===1?560:Math.min(400,960/rowCount-16),start=236+(960-rowCount*(height+16))/2;
 rows.forEach((row,i)=>{
  const width=columns===1?940:472,left=columns===1?70:60+(i%2)*488,top=start+Math.floor(i/columns)*(height+16),mid=left+width/2;
  x.beginPath();x.roundRect(left,top,width,height,18);x.fillStyle='#fff4df';x.fill();x.strokeStyle='#d7af58';x.lineWidth=4;x.stroke();
  let size=columns===1?72:height>300?44:36,wrapped;do{wrapped=lines(x,row.name,width-40,size--);}while(wrapped.length>3&&size>16);
  x.fillStyle='#30133d';wrapped.forEach((line,j)=>x.fillText(line,mid,top+(columns===1?115:height>300?65:40)+j*(size+4),width-40));
  x.fillStyle='#87632f';x.font='bold '+(height>300?26:17)+'px system-ui';x.fillText('CARTÓN ASIGNADO',mid,top+height-(columns===1?180:height>300?135:83));
  x.fillStyle='#30133d';x.font='bold '+(columns===1?144:height>300?96:64)+'px Georgia';x.fillText(row.ticket,mid,top+height-(height>300?45:20),width-35);
 });
 x.fillStyle='#f2d38b';x.font='26px Georgia';x.fillText('1 cartón gratis por persona · ¡Mucha suerte!',540,1243);x.font='italic 30px Georgia';x.fillText('Familia binguera',540,1294);
}
