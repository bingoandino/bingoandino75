'use client';
import {useEffect,useRef,useState} from 'react';
import {Sparkles,Trophy} from 'lucide-react';

export const DRAW_DURATION_MS=3800;
export function DrawAnimation({names}:{names:string[]}){
 const [index,setIndex]=useState(0);
 useEffect(()=>{
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let timer:ReturnType<typeof setTimeout>;let step=0;const start=performance.now();
  const tick=()=>{const elapsed=performance.now()-start;setIndex(++step%Math.max(1,names.length));if(elapsed<DRAW_DURATION_MS)timer=setTimeout(tick,65+Math.pow(elapsed/DRAW_DURATION_MS,3)*300);};
  timer=setTimeout(tick,65);return()=>clearTimeout(timer);
 },[names.length]);
 return <div className="drawing-stage" role="status" aria-label="Eligiendo al ganador. Espera el resultado."><div className="drawing-orbit" aria-hidden="true"><Trophy size={30}/><span/><span/><span/></div><span className="eyebrow">LA SUERTE ESTÁ EN MARCHA</span><div className="name-reel" aria-hidden="true"><span className="reel-neighbor">@{names[(index+names.length-1)%names.length]}</span><strong key={index}>@{names[index]}</strong><span className="reel-neighbor">@{names[(index+1)%names.length]}</span></div><div className="draw-progress" aria-hidden="true"><span/></div><p>¡El próximo nombre puede ser el tuyo!</p><Sparkles className="drawing-spark" size={22} aria-hidden="true"/></div>;
}

type Particle={x:number;y:number;vx:number;vy:number;size:number;spin:number;angle:number;color:string;round:boolean};
export function WinnerConfetti(){
 const ref=useRef<HTMLCanvasElement>(null);const [done,setDone]=useState(false);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setDone(true);return;}
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const colors=['#eebc38','#64c6b1','#a790dd','#ee97b8','#dceba3','#ffffff'];
  let width=window.innerWidth,height=window.innerHeight,frame=0,previous=performance.now(),start=previous;
  const resize=()=>{width=window.innerWidth;height=window.innerHeight;const scale=Math.min(window.devicePixelRatio||1,2);canvas.width=width*scale;canvas.height=height*scale;canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(scale,0,0,scale,0,0);};resize();
  const count=width<600?130:210;
  // Decorative randomness only: the giveaway winner is selected separately with crypto.
  const particles:Particle[]=Array.from({length:count},(_,i)=>{const side=i%2,angle=(side?Math.PI:0)+(side?1:-1)*(0.5+Math.random()*0.8),speed=500+Math.random()*650;return {x:side?width:0,y:height*.7,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,size:5+Math.random()*7,spin:(Math.random()-.5)*15,angle:Math.random()*6.28,color:colors[i%colors.length],round:i%4===0};});
  const paint=(now:number)=>{const age=(now-start)/1000,dt=Math.min((now-previous)/1000,.04);previous=now;ctx.clearRect(0,0,width,height);ctx.globalAlpha=Math.max(0,Math.min(1,(5-age)/1.2));for(const p of particles){p.vx*=Math.pow(.985,dt*60);p.vy+=520*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle=p.color;if(p.round){ctx.beginPath();ctx.ellipse(0,0,p.size*.45,p.size*.45,0,0,Math.PI*2);ctx.fill();}else{ctx.scale(Math.cos(p.angle*1.7),1);ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*.55);}ctx.restore();}if(age<5)frame=requestAnimationFrame(paint);else{ctx.clearRect(0,0,width,height);setDone(true);}};
  frame=requestAnimationFrame(paint);window.addEventListener('resize',resize);return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);ctx.clearRect(0,0,width,height);};
 },[]);
 return done?null:<canvas className="winner-confetti" ref={ref} aria-hidden="true"/>;
}
