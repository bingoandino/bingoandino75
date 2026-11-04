/* ANDY -> ChatGPT: instrucciones editoriales, sin API externa ni imágenes básicas. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.AndyChatGPTBrief=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const clean=(v,max=2000)=>String(v??"").trim().slice(0,max);
  const brand="Bingo Andino 75";
  const look=[
    "Identidad visual de Bingo Andino 75: morado profundo, marfil cálido y dorado metálico.",
    "Estética publicitaria premium inspirada en Las Vegas y los Andes: bombo real de bingo elegantemente iluminado, montañas discretas, destellos dorados, lujo, profundidad, composición impecable y gran legibilidad.",
    "Evita azul, turquesa, vinotinto, marcas ajenas, errores tipográficos y elementos recargados.",
    "No inventes premios, montos, fechas, horarios, testimonios, ganadores ni promociones.",
    "Usa los textos exactos indicados; ante dudas con cifras, pregunta antes de generar."
  ].join("\n");
  function editorBrief(input){
    if(!input||!["post","story","reel"].includes(input.format))throw Error("Selecciona un formato válido.");
    const title=clean(input.title,75),body=clean(input.body,180),caption=clean(input.caption,1100),cta=clean(input.cta,70),script=clean(input.script,1800);
    if(!title&&!body&&!caption)throw Error("Escribe al menos un título o un texto antes de preparar el contenido.");
    const format=input.format==="post"?"POST CUADRADO · 1080 × 1080 (1:1)":
      input.format==="story"?"HISTORIA VERTICAL · 1080 × 1920 (9:16)":"PORTADA DE REEL · 1080 × 1920 (9:16)";
    const lines=[
      "Crea una pieza visual de calidad profesional para "+brand+".",
      "Formato: "+format+".",
      "Objetivo: aumentar el interés genuino y comunicar claramente, sin prometer resultados ni presionar.",
      look,"",
      "TEXTOS AUTORIZADOS PARA LA PIEZA:",
      "Título: "+(title||"Defínelo a partir del mensaje, sin inventar cifras."),
      "Mensaje breve: "+(body||"No hay mensaje secundario especificado."),
      "Llamado a la acción: "+(cta||"bingoandino75.com"),
      "Web: bingoandino75.com.",
      "",
      "TEXTO PARA ACOMPAÑAR LA PUBLICACIÓN (no colocarlo entero dentro de la imagen):",
      caption||"Redáctalo de forma breve y cercana, para la familia binguera.",
      "",
      "Composición: título protagonista, texto fácil de leer en teléfono, márgenes de seguridad y acabado de diseñador profesional. Entrega UNA imagen final lista para revisar, no una plantilla básica."
    ];
    if(input.format==="reel"){
      lines.push("IMPORTANTE: esta solicitud es para la PORTADA estática del reel, no un video generado.");
      if(script)lines.push("Guion de referencia para la portada / posible grabación posterior:\n"+script);
    }
    if(clean(input.date,10))lines.push("Fecha editorial sugerida (no afirmar que sea fecha del sorteo): "+clean(input.date,10)+".");
    return lines.join("\n");
  }
  function sorteoBrief(input){
    if(!input||!["post","story"].includes(input.format)||![5,6].includes(input.rounds))throw Error("Formato o rondas inválidos.");
    const nums=["tickets","priceBs","total","pot","final","group1","consolCount","consolValue","balls"];
    if(nums.some(k=>!Number.isSafeInteger(Number(input[k]))||Number(input[k])<0))throw Error("Revisa las cifras del sorteo.");
    if(input.rounds===6&&(!Number.isSafeInteger(Number(input.group2))||Number(input.group2)<0))throw Error("Falta el premio de las rondas 4 y 5.");
    const format=input.format==="post"?"CUADRADO · 1080 × 1080 (1:1)":"HISTORIA VERTICAL · 1080 × 1920 (9:16)";
    const date=clean(input.date,15),hour=clean(input.hour,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(hour))throw Error("Falta fecha u hora.");
    const expected=input.consolCount*input.consolValue+(input.rounds===6?3:4)*input.group1+(input.rounds===6?2*input.group2:0)+input.final;
    if(expected!==input.total)throw Error("Los premios no coinciden con el total anunciado.");
    const lines=[
      "Genera una imagen PUBLICITARIA PREMIUM para el sorteo de "+brand+".",
      "Formato: "+format+".",
      input.saturday?"ESTILO SÁBADO ESPECIAL: atmósfera Las Vegas más lujosa, confeti dorado discreto y luces elegantes.":"ESTILO TRADICIONAL: elegante, limpio y emocionante.",
      look,"",
      "CIFRAS CONFIRMADAS: transcríbelas literalmente; nunca las recalcules ni las cambies.",
      "Fecha del sorteo: "+date,
      "Hora de transmisión: "+hour+" · YouTube",
      "Cartones anunciados: "+input.tickets,
      "Precio por cartón: "+input.priceBs+" Bs",
      "TOTAL A REPARTIR EN PREMIOS: $"+input.total+" USD",
      "POZO ACUMULADO: $"+input.pot+" USD (aparte, no sumarlo al total a repartir).",
      "Condición del pozo: máximo "+input.balls+" bolitas.",
      input.consolCount+" premios de consolación de $"+input.consolValue+" USD cada uno.",
      (input.rounds===6?"Rondas 1, 2 y 3":"Rondas 1, 2, 3 y 4")+": $"+input.group1+" USD cada una.",
      ...(input.rounds===6?["Rondas 4 y 5: $"+input.group2+" USD cada una."]:[]),
      "RONDA "+input.rounds+" · LLENO FINAL: $"+input.final+" USD.",
      "",
      "Jerarquía obligatoria: el LLENO FINAL y su importe son el elemento MÁS GRANDE y llamativo, más importantes visualmente que «Total a repartir».",
      "Incluir «Con un solo cartón participas en todas las rondas», «Bombo real» y bingoandino75.com.",
      "Mantén cifras exactas y buena lectura en pantalla móvil. No inventes otros premios. Entrega UNA imagen final lista para revisar, no una plantilla básica."
    ];
    return lines.join("\n");
  }
  return Object.freeze({editorBrief,sorteoBrief});
});
