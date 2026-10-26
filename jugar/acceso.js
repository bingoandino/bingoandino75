(function(global){'use strict';
global.agregarAccesoJuego=function(container,cedula,compras){
if(!Array.isArray(compras)||!compras.some(c=>c.estado==='aprobado'&&Array.isArray(c.cartones)&&c.cartones.length))return;
const canonical=String(cedula).replace(/[.\s]/g,'');if(!/^\d{5,12}$/.test(canonical))return;
const button=document.createElement('button');button.type='button';button.textContent='Jugar con mis cartones';button.className='compra-ver-todos';button.style.cssText='width:100%;margin:8px 0 18px;background:#4b174f;color:#fff;border:1px solid #bb9c52;font-weight:800';
button.onclick=()=>{try{sessionStorage.setItem('bingo_juego_acceso_v1',JSON.stringify({cedula:canonical}));global.location.assign('/jugar/');}catch{button.textContent='Tu navegador no permite abrir el juego. Revisa el almacenamiento.';}};
container.appendChild(button);
};})(window);
