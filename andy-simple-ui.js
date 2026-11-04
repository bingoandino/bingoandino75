/* ANDY: navegación reducida. No altera datos, borradores ni conexiones. */
(function(){
  "use strict";
  const container=document.getElementById("tab-andy-estudio");
  const nav=document.getElementById("andy-simple-nav");
  const marketing=document.getElementById("andy-marketing-pro");
  if(!container||!nav||!marketing)return;
  const buttons=[...nav.querySelectorAll("[data-andy-tab]")];
  const targets=[...container.querySelectorAll("[data-andy-view]")];
  const validViews=new Set(["inicio","campanas","contenido","resultados"]);
  let current="inicio";
  function home(){
    const model=window.AndyMarketingPro;
    if(!model)return;
    const next=model.comingDrawDates(model.todayVE(),1)[0];
    const goal=document.getElementById("andy-mp-goal")?.value||"ventas";
    const item=model.planFor(next,goal);
    const when=new Intl.DateTimeFormat("es-VE",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"})
      .format(new Date(next+"T12:00:00Z"));
    document.getElementById("andy-today-date").textContent="PRÓXIMO SORTEO · "+when.toUpperCase();
    document.getElementById("andy-today-title").textContent=item.title;
    document.getElementById("andy-today-summary").textContent=item.body+
      " · "+item.channel+". Puedes preparar el texto y adaptarlo antes de publicarlo.";
  }
  function open(view,scroll=false){
    if(!validViews.has(view))return;
    current=view;
    for(const el of targets)el.hidden=el.dataset.andyView!==view;
    for(const btn of buttons){
      const active=btn.dataset.andyTab===view;
      if(active)btn.setAttribute("aria-current","page");
      else btn.removeAttribute("aria-current");
    }
    marketing.hidden=view==="contenido";
    if(view==="inicio")home();
    if(scroll)nav.scrollIntoView({behavior:"auto",block:"start"});
  }
  nav.addEventListener("click",e=>{
    const button=e.target.closest("button[data-andy-tab]");
    if(button&&nav.contains(button))open(button.dataset.andyTab,true);
  });
  nav.addEventListener("keydown",e=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;
    const active=buttons.indexOf(document.activeElement);
    if(active<0)return;
    e.preventDefault();
    const index=e.key==="Home"?0:e.key==="End"?buttons.length-1:
      (active+(e.key==="ArrowRight"?1:-1)+buttons.length)%buttons.length;
    buttons[index].focus();open(buttons[index].dataset.andyTab);
  });
  container.querySelectorAll("[data-andy-go]").forEach(button=>{
    button.addEventListener("click",()=>open(button.dataset.andyGo,true));
  });
  document.getElementById("andy-today-prepare")?.addEventListener("click",()=>{
    const first=document.querySelector("#andy-mp-plan .andy-mp-day-card .andy-mp-btn");
    if(first)first.click();
    else open("campanas",true);
  });
  document.getElementById("andy-mp-goal")?.addEventListener("change",home);
  window.addEventListener("andy:navigate",e=>open(e.detail?.view||"contenido",true));
  window.AndySimpleUI=Object.freeze({open,home,getView:()=>current});
  open("inicio");
})();
