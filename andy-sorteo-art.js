/* ANDY Sorteo Diario · ilustración vectorial premium, local y sin servicios externos. */
(function (root, factory) {
  const api=factory();
  if (typeof module==='object' && module.exports) module.exports=api;
  else root.AndySorteoArt=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const P={dark:'#1c052a',purple:'#350742',plum:'#54125e',ivory:'#fff5dc',muted:'#e4cfa5',
    gold:'#f9d66c',deepGold:'#8d501b',pink:'#a32b79',white:'#fffdf6'};
  const nf=new Intl.NumberFormat('es-VE',{maximumFractionDigits:0});
  function text(ctx,s,x,y,size,color=P.ivory,weight=800,align='left',width=970){
    ctx.save();ctx.font=weight+' '+size+'px system-ui,Arial,sans-serif';
    ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';
    ctx.fillText(String(s),x,y,Math.max(10,width));ctx.restore();
  }
  function pathRect(ctx,x,y,w,h,r,fill,stroke='#d8a646',sw=3){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}
  }
  function gradient(ctx,x,y,w,h,stops){
    const g=ctx.createLinearGradient(x,y,x+w,y+h);
    for(const [t,c] of stops)g.addColorStop(t,c);
    return g;
  }
  function gold(ctx,x,y,w,h){
    return gradient(ctx,x,y,w,h,[[0,'#fff2a8'],[.23,'#efbd4c'],[.48,'#fff5be'],[.7,'#d99427'],[1,'#f8cf63']]);
  }
  function goldText(ctx,s,x,y,size,width=950,align='center'){
    ctx.save();ctx.font='950 '+size+'px system-ui,Arial,sans-serif';
    ctx.textBaseline='alphabetic';ctx.textAlign=align;
    ctx.shadowColor='#06000b';ctx.shadowBlur=19;ctx.shadowOffsetY=9;
    ctx.lineWidth=Math.max(5,size*.052);ctx.lineJoin='round';ctx.strokeStyle='#230631';
    ctx.strokeText(String(s),x,y,width);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.lineWidth=Math.max(2,size*.013);ctx.strokeStyle='#fff2ba';ctx.strokeText(String(s),x,y,width);
    ctx.fillStyle=gold(ctx,x-size*.2,y-size,x+size*.2,size*1.1);
    ctx.fillText(String(s),x,y,width);ctx.restore();
  }
  function sparkle(ctx,x,y,r,opacity=1){
    ctx.save();ctx.globalAlpha=opacity;ctx.strokeStyle='#ffe9a0';ctx.lineWidth=Math.max(1.5,r*.16);
    ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x+r,y);ctx.moveTo(x,y-r);ctx.lineTo(x,y+r);ctx.stroke();
    ctx.beginPath();ctx.arc(x,y,r*.18,0,Math.PI*2);ctx.fillStyle='#fff8db';ctx.fill();ctx.restore();
  }
  function crown(ctx,x,y,scale=1){
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    ctx.shadowColor='#daa348';ctx.shadowBlur=8;ctx.beginPath();
    ctx.moveTo(-43,3);ctx.lineTo(-54,-38);ctx.lineTo(-28,-14);ctx.lineTo(0,-49);
    ctx.lineTo(27,-14);ctx.lineTo(54,-38);ctx.lineTo(42,3);ctx.closePath();
    ctx.fillStyle=gold(ctx,-40,-50,80,60);ctx.fill();ctx.shadowBlur=0;
    pathRect(ctx,-44,5,88,13,3,'#d9952e','#fff1aa',2);
    [-54,0,54].forEach((a,i)=>{ctx.beginPath();ctx.arc(a,i===1?-49:-38,6,0,Math.PI*2);ctx.fillStyle='#ffe6a0';ctx.fill();});
    ctx.restore();
  }
  function background(ctx,w,h,saturday){
    const g=gradient(ctx,0,0,w,h,[[0,'#24052f'],[.3,'#56145e'],[.66,'#310b48'],[1,'#15041f']]);
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    for(let i=0;i<5;i++){
      const cx=(i*309+250)%w,cy=(i*463+119)%h,rad=210+i*40;
      const g=ctx.createRadialGradient(cx,cy,5,cx,cy,rad);
      g.addColorStop(0,i%2?'rgba(253,198,83,.23)':'rgba(206,110,190,.22)');
      g.addColorStop(1,'rgba(255,220,130,0)');
      ctx.fillStyle=g;ctx.fillRect(cx-rad,cy-rad,rad*2,rad*2);
    }
    ctx.save();ctx.globalAlpha=.22;ctx.lineWidth=6;ctx.strokeStyle='#f9cf68';
    for(let j=0;j<6;j++){
      ctx.beginPath();ctx.ellipse(w*.49,-50,w*.45+j*26,h*.29+j*39,-.4,0,Math.PI);ctx.stroke();
    }
    ctx.restore();
    ctx.save();ctx.globalAlpha=.18;ctx.fillStyle='#d2a55c';
    ctx.beginPath();ctx.moveTo(0,h*.92);ctx.lineTo(0,h*.82);ctx.lineTo(170,h*.74);
    ctx.lineTo(320,h*.81);ctx.lineTo(550,h*.66);ctx.lineTo(735,h*.8);
    ctx.lineTo(910,h*.7);ctx.lineTo(w,h*.82);ctx.lineTo(w,h);ctx.closePath();ctx.fill();
    ctx.restore();
    for(let i=0;i<(saturday?110:66);i++){
      const x=(83+i*271)%w,y=(41+i*439)%h;
      if(i%7===0)sparkle(ctx,x,y,saturday?8:5,.65);
      else{ctx.beginPath();ctx.arc(x,y,i%4===0?2.6:1.25,0,Math.PI*2);ctx.fillStyle=i%3?'rgba(255,223,142,.46)':'rgba(255,249,228,.5)';ctx.fill();}
    }
    if(saturday){
      ctx.save();ctx.globalAlpha=.9;
      for(let i=0;i<52;i++){
        const x=(65+i*283)%w,y=(25+i*311)%Math.round(h*.77);
        ctx.translate(x,y);ctx.rotate(i*.73);
        ctx.fillStyle=i%3?'#d8a13d':'#fff4b8';ctx.fillRect(-4,-12,8,24);ctx.rotate(-i*.73);ctx.translate(-x,-y);
      }
      ctx.restore();
    }
    ctx.save();ctx.shadowColor='#d8a154';ctx.shadowBlur=10;
    pathRect(ctx,22,22,w-44,h-44,23,null,'#e8b85b',6);
    ctx.shadowBlur=0;pathRect(ctx,33,33,w-66,h-66,18,null,'rgba(255,228,147,.55)',2);
    ctx.restore();
    sparkle(ctx,42,43,14,.9);sparkle(ctx,w-42,h-43,13,.9);
  }
  function sphere(ctx,x,y,r,index,number){
    const g=ctx.createRadialGradient(x-r*.42,y-r*.55,1,x,y,r);
    const pair=index%3===0?['#fff5da','#e8bc74','#995a2e']:index%3===1?['#fbdff8','#7e278f','#35093e']:['#fdf2a5','#d7a23a','#82551a'];
    g.addColorStop(0,pair[0]);g.addColorStop(.62,pair[1]);g.addColorStop(1,pair[2]);
    ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=g;ctx.fill();
    ctx.strokeStyle='#f5d77e';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.arc(x,y,r*.66,0,2*Math.PI);
    ctx.fillStyle='#fff5e5';ctx.fill();ctx.strokeStyle='#6d2c55';ctx.lineWidth=1.5;ctx.stroke();
    text(ctx,number,x,y+r*.25,r*.77,'#2e103b',950,'center',r*1.3);
  }
  function drum(ctx,cx,cy,r){
    ctx.save();
    ctx.shadowColor='#130019';ctx.shadowBlur=32;ctx.shadowOffsetY=16;
    const back=ctx.createRadialGradient(cx-r*.25,cy-r*.35,8,cx,cy,r);
    back.addColorStop(0,'#71317b');back.addColorStop(.68,'#250c32');back.addColorStop(1,'#15081e');
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=back;ctx.fill();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    const balls=[[-.4,-.45,75],[.12,-.55,16],[.52,-.33,23],[-.63,-.04,8],[-.14,-.06,31],[.39,.07,42],[-.38,.43,5],[.05,.5,52],[.52,.46,61]];
    balls.forEach(([dx,dy,n],i)=>sphere(ctx,cx+dx*r,cy+dy*r,r*.17,i,n));
    ctx.lineWidth=Math.max(4,r*.04);ctx.strokeStyle=gold(ctx,cx-r,cy-r,2*r,2*r);
    for(const scale of [.26,.54,.78]){
      ctx.beginPath();ctx.ellipse(cx,cy,r*scale,r,0,0,Math.PI*2);ctx.stroke();
    }
    for(const scale of [.22,.5,.78]){
      ctx.beginPath();ctx.ellipse(cx,cy,r,r*scale,0,0,Math.PI*2);ctx.stroke();
    }
    ctx.lineWidth=Math.max(7,r*.061);ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle=gold(ctx,cx-r,cy-r,2*r,2*r);ctx.stroke();
    // Gold mounting legs and crank.
    ctx.lineWidth=Math.max(5,r*.055);ctx.strokeStyle='#dba246';
    ctx.beginPath();ctx.moveTo(cx-r*.7,cy+r*.7);ctx.lineTo(cx-r*.84,cy+r*1.42);
    ctx.moveTo(cx+r*.7,cy+r*.7);ctx.lineTo(cx+r*.84,cy+r*1.42);
    ctx.moveTo(cx+r,cy);ctx.lineTo(cx+r*1.35,cy);ctx.lineTo(cx+r*1.35,cy-r*.14);ctx.stroke();
    pathRect(ctx,cx-r*.98,cy+r*1.28,r*1.96,r*.32,r*.1,
      gradient(ctx,cx-r,cy+r*1.28,2*r,r*.3,[[0,'#673118'],[.4,'#e8b75c'],[1,'#5e2b16']]),'#f4d37c',3);
    text(ctx,'BINGO 75',cx,cy+r*1.49,r*.23,'#29072e',900,'center',r*1.6);
    sparkle(ctx,cx-r*.8,cy-r*.8,9,.9);
    ctx.restore();
  }
  function brand(ctx,story,saturday){
    const y=story?92:73;
    text(ctx,'B I N G O',64,y,story?49:41,P.gold,900,'left',440);
    goldText(ctx,'ANDINO',55,y+(story?147:127),story?150:129,story?615:572,'left');
    goldText(ctx,'75',story?638:585,y+(story?149:129),story?155:137,196,'left');
    if(!saturday || story)text(ctx,'T U   M E J O R   J U G A D A',63,y+(story?210:181),story?27:25,P.ivory,850,'left',645);
    if(saturday){
      if(story){
        pathRect(ctx,66,y+228,380,47,15,'#752052','#f4c361',2);
        text(ctx,'★  SÁBADO ESPECIAL  ★',256,y+262,26,'#ffe5a1',900,'center',355);
      }else text(ctx,'★  SÁBADO ESPECIAL  ★',63,y+181,28,P.gold,900,'left',400);
    }
  }
  function finalPanel(ctx,x,y,w,h,final,rounds,story){
    ctx.save();ctx.shadowColor='#0a0217';ctx.shadowBlur=25;ctx.shadowOffsetY=14;
    pathRect(ctx,x,y,w,h,30,gold(ctx,x,y,w,h),'#fff1ae',5);ctx.restore();
    const inG=gradient(ctx,x+11,y+10,w-22,h-20,[[0,'#5e1969'],[.5,'#3b0b52'],[1,'#1c062f']]);
    pathRect(ctx,x+11,y+11,w-22,h-22,25,inG,'#dca24b',3);
    const shine=ctx.createRadialGradient(x+w*.55,y+h*.51,4,x+w*.55,y+h*.51,w*.53);
    shine.addColorStop(0,'rgba(249,197,95,.2)');shine.addColorStop(1,'rgba(249,197,95,0)');
    ctx.fillStyle=shine;ctx.fillRect(x+18,y+17,w-36,h-34);
    // Crown is decorative but the amount is the hero.
    crown(ctx,x+w*.145,y+(story?116:65),story?1.12:.74);
    text(ctx,'LLENO FINAL',x+w*.5,y+(story?111:56),story?66:47,P.ivory,950,'center',w-85);
    text(ctx,'RONDA '+rounds,x+w*.5,y+(story?157:89),story?31:25,P.muted,850,'center',w-100);
    goldText(ctx,'$'+nf.format(final),x+w*.5,y+(story?425:254),story?258:157,w-76,'center');
    text(ctx,'USD · ¡EL GRAN PREMIO!',x+w*.5,y+h-(story?24:13),story?29:21,P.ivory,900,'center',w-70);
    sparkle(ctx,x+w*.08,y+h*.48,15,.85);sparkle(ctx,x+w*.91,y+h*.32,12,.9);
  }
  function statBox(ctx,x,y,w,h,label,value,story,opt={}){
    ctx.save();ctx.shadowColor='#17041d88';ctx.shadowBlur=15;ctx.shadowOffsetY=7;
    pathRect(ctx,x,y,w,h,20,P.ivory,'#d8a454',4);ctx.restore();
    ctx.save();ctx.beginPath();ctx.roundRect(x+6,y+6,w-12,h-12,16);ctx.clip();
    ctx.fillStyle=gradient(ctx,x,y,w,h,[[0,'#fffdf6'],[1,'#f4debc']]);ctx.fillRect(x+6,y+6,w-12,h-12);
    ctx.restore();
    text(ctx,label,x+23,y+(story?60:30),story?37:25,P.purple,950,'left',w-46);
    text(ctx,value,x+24,y+(story?181:(opt.note?96:113)),story?106:(opt.note?61:72),opt.accent||P.purple,950,'left',w-43);
    if(opt.note)text(ctx,opt.note,x+25,y+h-(story?25:9),story?25:15,P.plum,800,'left',w-49);
  }
  function dateInfo(ctx,x,y,w,h,d,story){
    pathRect(ctx,x,y,w,h,20,P.ivory,'#dbac5a',3);
    const dt=new Date(d.date+'T12:00:00Z');
    const dw=new Intl.DateTimeFormat('es-VE',{weekday:'long',timeZone:'UTC'}).format(dt).toUpperCase();
    const when=new Intl.DateTimeFormat('es-VE',{day:'2-digit',month:'long',timeZone:'UTC'}).format(dt).toUpperCase();
    const left=x+23,center=x+w*.53;
    text(ctx,dw+' '+when,left,y+(story?57:37),story?40:29,P.purple,950,'left',w*.51);
    text(ctx,'EN VIVO  '+d.hour+'  ·  YOUTUBE',left,y+(story?117:76),story?36:26,P.plum,900,'left',w*.55);
    ctx.strokeStyle='#d6ae6b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(center,y+15);ctx.lineTo(center,y+h-15);ctx.stroke();
    text(ctx,nf.format(d.tickets)+' CARTONES',x+w-22,y+(story?56:38),story?39:31,P.purple,950,'right',w*.44);
    text(ctx,nf.format(d.priceBs)+' Bs / CARTÓN',x+w-22,y+(story?116:76),story?36:28,P.plum,950,'right',w*.44);
  }
  function prizeBox(ctx,x,y,w,h,label,value,story){
    pathRect(ctx,x,y,w,h,19,P.ivory,'#dfb25f',3);
    const bar=gradient(ctx,x,y,w,46,[[0,'#3f0b53'],[.56,'#742568'],[1,'#360a50']]);
    pathRect(ctx,x+6,y+6,w-12,story?63:42,13,bar,null);
    text(ctx,label,x+w/2,y+(story?51:37),story?30:23,P.ivory,900,'center',w-20);
    text(ctx,'$'+nf.format(value),x+w/2,y+(story?265:119),story?145:64,P.purple,950,'center',w-30);
    text(ctx,'USD C/U',x+w/2,y+h-(story?27:8),story?26:18,P.plum,800,'center',w-30);
  }
  function footer(ctx,story,balls){
    const y=story?1790:1009;
    pathRect(ctx,38,y,1004,story?112:55,15,'#2b073e','#c79744',2);
    text(ctx,'BOMBO REAL   ✦   PAGOS AL INSTANTE   ✦   CON 1 CARTÓN JUEGAS TODAS LAS RONDAS',
      540,y+(story?42:23),story?27:19,P.ivory,820,'center',975);
    text(ctx,'POZO: MÁXIMO '+balls+' BOLITAS   ·   BINGOANDINO75.COM',
      540,y+(story?88:44),story?30:22,P.gold,900,'center',950);
  }
  function poster(ctx,format,d,aiBackground=null){
    const story=format==='story',w=1080,h=story?1920:1080,saturday=d.saturday===true;
    if(!ctx||!Number.isFinite(d.final)||!Number.isFinite(d.total)||!Number.isFinite(d.pot))throw Error('Datos del cartel inválidos');
    if(aiBackground) {
      // AI is art only. Every prize, price and label below is drawn by ANDY from verified numbers.
      ctx.drawImage(aiBackground,0,0,w,h);
      ctx.fillStyle='rgba(28,4,40,.18)';ctx.fillRect(0,0,w,h);
    } else background(ctx,w,h,saturday);
    brand(ctx,story,saturday);
    if(!aiBackground)drum(ctx,story?850:863,story?164:123,story?128:92);
    if(story){
      finalPanel(ctx,37,406,1006,509,d.final,d.rounds,true);
      statBox(ctx,38,946,489,234,'TOTAL A REPARTIR','$'+nf.format(d.total),true,{note:'PREMIOS DEL SORTEO'});
      statBox(ctx,545,946,497,234,'POZO ACUMULADO','$'+nf.format(d.pot),true,{note:'HASTA '+d.balls+' BOLITAS'});
      dateInfo(ctx,38,1212,1004,147,d,true);
      const y=1384,hb=375,gap=15,count=d.rounds===6?3:2,cw=(1004-gap*(count-1))/count;
      prizeBox(ctx,38,y,cw,hb,d.rounds===6?'4 CONSOLACIONES':'3 CONSOLACIONES',10,true);
      prizeBox(ctx,38+cw+gap,y,cw,hb,(d.rounds===6?'3 LLENOS':'4 LLENOS'),d.group1,true);
      if(count===3)prizeBox(ctx,38+(cw+gap)*2,y,cw,hb,'2 LLENOS',d.group2,true);
    }else{
      finalPanel(ctx,36,270,1008,295,d.final,d.rounds,false);
      statBox(ctx,38,583,489,131,'TOTAL A REPARTIR','$'+nf.format(d.total),false);
      statBox(ctx,545,583,497,131,'POZO ACUMULADO','$'+nf.format(d.pot),false,{note:'HASTA '+d.balls+' BOLITAS'});
      dateInfo(ctx,38,732,1004,100,d,false);
      const y=848,hb=150,gap=15,count=d.rounds===6?3:2,cw=(1004-gap*(count-1))/count;
      prizeBox(ctx,38,y,cw,hb,d.rounds===6?'4 CONSOLACIONES':'3 CONSOLACIONES',10,false);
      prizeBox(ctx,38+cw+gap,y,cw,hb,d.rounds===6?'3 LLENOS':'4 LLENOS',d.group1,false);
      if(count===3)prizeBox(ctx,38+(cw+gap)*2,y,cw,hb,'2 LLENOS',d.group2,false);
    }
    footer(ctx,story,d.balls);
  }
  return Object.freeze({poster});
});
