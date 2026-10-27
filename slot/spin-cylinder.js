/** A rotating CSS 3D drum. Each face keeps a participant and their ticket together. */
export function spinCylinder(reel,{participants,winner,prize,duration=1800,reduced=false,onTick=()=>{}}){
 if(reduced)return Promise.resolve();
 if(!participants.length)return Promise.reject(new Error('No hay participantes cargados.'));
 const count=12,step=360/count,height=Math.max(170,Math.round(reel.getBoundingClientRect().height*.72)),radius=height/(2*Math.tan(Math.PI/count));
 const stage=document.createElement('div');stage.className='cylinder-stage';stage.setAttribute('aria-hidden','true');
 const rotor=document.createElement('div');rotor.className='cylinder-rotor';rotor.style.setProperty('--face-height',height+'px');
 const faces=[];const seed=new Uint32Array(1);crypto.getRandomValues(seed);const offset=seed[0]%participants.length;
 for(let i=0;i<count;i++){
  const participant=i===0?winner:participants[(offset+i)%participants.length];
  const face=document.createElement('div');face.className='cylinder-face';face.style.transform='rotateX('+(-i*step)+'deg) translateZ('+radius+'px)';
  const name=document.createElement('div');name.className='cylinder-name';name.textContent=participant.name;
  const ticket=document.createElement('div');ticket.className='cylinder-ticket';ticket.textContent='CARTÓN '+participant.ticket;
  const badge=document.createElement('div');badge.className='cylinder-prize';badge.textContent=prize;
  face.append(name,ticket,badge);rotor.append(face);faces.push(face);
 }
 stage.append(rotor);reel.append(stage);
 const startAngle=step*2,endAngle=duration>2000?360*6:360*4,travel=endAngle-startAngle;
 function paint(angle){rotor.style.transform='translateZ('+(-radius)+'px) rotateX('+angle+'deg)';for(let i=0;i<count;i++){const front=Math.max(0,Math.cos((angle-i*step)*Math.PI/180));faces[i].style.setProperty('--face-light',String(.56+front*.44));}}
 paint(startAngle);
 return new Promise((resolve,reject)=>{
  let start,lastTick=-1;
  function frame(time){try{if(start===undefined)start=time;const t=Math.min(1,(time-start)/duration);const eased=t<.6?t*1.3:.78+.22*(1-Math.pow(1-(t-.6)/.4,2.5));const angle=startAngle+travel*eased;paint(angle);const tick=Math.floor(angle/step);if(tick!==lastTick&&t<.92){onTick();lastTick=tick;}
   if(t===1){stage.remove();resolve();return;}requestAnimationFrame(frame);
  }catch(error){stage.remove();reject(error);}}
  requestAnimationFrame(frame);
 });
}
