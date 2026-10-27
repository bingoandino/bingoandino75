/** Smooth cylindrical projection: text bends around a continuous curved surface. */
export function spinCylinder(reel,{participants,winner,prize,duration=1800,reduced=false,onTick=()=>{}}){
 if(reduced)return Promise.resolve();
 if(!participants.length)return Promise.reject(new Error('No hay participantes cargados.'));
 const bounds=reel.getBoundingClientRect(),width=Math.max(1,Math.round(bounds.width)),height=Math.max(1,Math.round(bounds.height)),dpr=Math.min(devicePixelRatio||1,2),count=6,panelHeight=height*.55,textureHeight=count*panelHeight;
 const canvas=document.createElement('canvas');canvas.className='cylinder-canvas';canvas.setAttribute('aria-hidden','true');canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);
 const ctx=canvas.getContext('2d'),texture=document.createElement('canvas');texture.width=Math.ceil(width*dpr);texture.height=Math.ceil(textureHeight*dpr);const ink=texture.getContext('2d');
 if(!ctx||!ink)return Promise.reject(new Error('No se pudo dibujar el cilindro.'));
 ctx.scale(dpr,dpr);ink.scale(dpr,dpr);ink.fillStyle='#fff5df';ink.fillRect(0,0,width,textureHeight);ink.textAlign='center';
 const seed=new Uint32Array(1);crypto.getRandomValues(seed);const offset=seed[0]%participants.length;
 function text(value,y,size,color,weight='bold'){while(size>16){ink.font=weight+' '+size+'px Georgia';if(ink.measureText(value).width<width-42)break;size--;}ink.fillStyle=color;ink.fillText(value,width/2,y);}
 for(let i=0;i<count;i++){const p=i===0?winner:participants[(offset+i)%participants.length],top=i*panelHeight;text(p.name,top+panelHeight*.37,Math.min(60,panelHeight*.25),'#2b103b');text('CARTÓN '+p.ticket,top+panelHeight*.65,Math.min(65,panelHeight*.28),'#2b103b');text(prize,top+panelHeight*.85,Math.min(23,panelHeight*.12),'#8b6128');}
 reel.append(canvas);
 function band(sourceY,sourceHeight,y,bandHeight){const sy=((sourceY%textureHeight)+textureHeight)%textureHeight,first=Math.min(sourceHeight,textureHeight-sy),firstHeight=bandHeight*first/sourceHeight;ctx.drawImage(texture,0,sy*dpr,texture.width,Math.max(.1,first*dpr),0,y,width,firstHeight+.2);if(first<sourceHeight)ctx.drawImage(texture,0,0,texture.width,(sourceHeight-first)*dpr,0,y+firstHeight,width,bandHeight-firstHeight+.2);}
 function paint(rotation){const center=height/2,radius=height/2,phase=rotation/(2*Math.PI)*textureHeight+panelHeight/2;ctx.clearRect(0,0,width,height);for(let y=0;y<height;y+=2){const h=Math.min(2,height-y),a=Math.asin(Math.max(-1,(y-center)/radius)),b=Math.asin(Math.min(1,(y+h-center)/radius)),sy=phase+a/(2*Math.PI)*textureHeight,sh=(b-a)/(2*Math.PI)*textureHeight;band(sy,sh,y,h);const norm=(y+h/2-center)/radius,light=Math.sqrt(Math.max(0,1-norm*norm));ctx.fillStyle='rgba(25,7,35,'+((1-light)*.88)+')';ctx.fillRect(0,y,width,h);const shine=.12*Math.exp(-Math.pow((norm+.28)/.15,2));if(shine>.003){ctx.fillStyle='rgba(255,255,235,'+shine+')';ctx.fillRect(0,y,width,h);}}}
 const startAngle=Math.PI/3,endAngle=Math.PI*2*(duration>2000?5:3),travel=endAngle-startAngle;paint(startAngle);
 return new Promise((resolve,reject)=>{let start,lastTick=-1;function frame(time){try{if(start===undefined)start=time;const t=Math.min(1,(time-start)/duration),eased=t<.6?t*1.3:.78+.22*(1-Math.pow(1-(t-.6)/.4,2.5)),angle=startAngle+travel*eased;paint(angle);const tick=Math.floor(angle/(Math.PI*2/count));if(tick!==lastTick&&t<.92){onTick();lastTick=tick;}if(t===1){canvas.remove();resolve();return;}requestAnimationFrame(frame);}catch(error){canvas.remove();reject(error);}}requestAnimationFrame(frame);});
}
