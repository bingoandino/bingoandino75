export const CONFIG=Object.freeze({price:0,total:0,max:100,bank:'Mercantil · 0105',phone:'',id:'',site:'https://bingoandino75.com/',verify:'https://bingoandino75.com/?verificar=1'});
const banks={'mercantil':'Mercantil','banesco':'Banesco','venezuela':'Venezuela','provincial':'Provincial','bnc':'BNC','bancamiga':'Bancamiga','bancaribe':'Bancaribe','tesoro':'Tesoro','bfc':'BFC','banplus':'Banplus','0105':'Mercantil','0134':'Banesco','0102':'Venezuela','0108':'Provincial','0191':'BNC','0172':'Bancamiga','0114':'Bancaribe','0163':'Tesoro','0151':'BFC','0174':'Banplus'};
const words={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veintiuno:21,veintiun:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,cien:100};
export const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
// Conversación venezolana cotidiana; se aplica a intenciones, nunca altera los datos enviados.
export const conversationText=s=>norm(s).replace(/^[¿¡]+/,'').replace(/\bq\b|\bk\b/g,'que').replace(/\bkiero\b/g,'quiero').replace(/\bnesecito\b/g,'necesito').replace(/\bpa\b/g,'para').replace(/^(?:(?:y|pero|mira|mire|oye|epa|aja|hola|buenas(?: tardes| noches| dias)?|por favor)[,!.\s]+)+/,'').trim();
export function websiteIntent(input){const n=conversationText(input).replace(/[.!?]+$/,'').trim();
 if(/^(?:(?:por|en|desde) (?:la )?|(?:mejor|prefiero) (?:por |en )?(?:la )?|la )?(?:pagina|web)(?: por favor)?$/.test(n)||/^(?:lo hago yo|yo sol[oa]|yo mism[oa])$/.test(n))return 'choice';
 return /\b(?:pagina|web)\b/.test(n)&&/como|compr|jugar|hago|hacer|pasos/.test(n)?'instructions':null;
}
function websiteGuide(config){return [text('Claro 😊\n1. Toca COMPRAR y escribe tus datos.\n2. Escoge tus cartones.\n3. Sigue los pasos para pagar y mandar el capture y la referencia.'),{type:'link',url:config.site,label:'Comprar en la página'}];}
export function wantsCancellation(input,step){let n=conversationText(input).replace(/[,;:]/g,' ').replace(/[.!?]+$/,'').replace(/\s+/g,' ').trim();
 if(n==='no gracias')return true;
 n=n.replace(/ (?:gracias|porfa|por favor)$/,'');
 if(/^(?:no quiero|ya no quiero)(?: (?:comprar|jugar|participar|seguir|continuar|enviar|nada|nada mas|ayuda|tu ayuda|que me ayudes|cartones|la compra|comprar cartones))?$/.test(n))return true;
 if(/^(?:no necesito ayuda|no necesito tu ayuda|no me ayudes|no voy a comprar|ya no voy a comprar|ahorita no|no por ahora|no me interesa|otro dia|despues compro|me arrepenti|mejor no|olvidalo|cancelalo|cancela eso|cancelar|cancelar compra|cancelar la compra|cancelar mi compra|cancela(?: la compra| mi compra| todo)?|dejalo(?: asi)?|no gracias)$/.test(n))return true;
 return n==='no'&&!['confirm','final'].includes(step);
}
export function wantsRandom(input){const n=conversationText(input);if(/yo.*(?:escojo|escoger|elijo|elegir)|no.*(?:azar|aleatori)/.test(n))return false;return /\b(?:azar|aleatorios|aleatorio|escoge|escoja|eligelos|elige tu|elija|cualquiera|cualesquiera|agarralos)\b|los que (?:tu )?(?:quieras|salgan|sean)|como sea/.test(n);}
const digits=s=>String(s||'').replace(/\D/g,'');
export const money=n=>new Intl.NumberFormat('es-VE',{maximumFractionDigits:2}).format(n);
const title=s=>s.trim().replace(/\s+/g,' ').toLocaleLowerCase('es').replace(/(^|\s)\p{L}/gu,c=>c.toLocaleUpperCase('es'));
const yes=s=>/^(si|si claro|correcto|correctos|esta bien|estan bien|todo bien|confirmo|confirmado|asi es|ok|listo|dale|perfecto|si estan correctos|si estan bien|si confirmo|si todo bien)[.!\s]*$/.test(norm(s).replace(/[,¡!¿?]/g,''));
const text=s=>({type:'text',text:s});
// Intenciones de inicio: separadas de los campos del registro y de la confirmación.
export function openingIntent(input){const n=conversationText(input);
 if(/\b(?:verificar|consultar|estado|pendiente|aprobada|aprobado|pague|hice|realice)\b/.test(n))return null;
 if(/\bno (?:quiero|deseo|necesito|voy a)\b.*\b(?:comprar|compra|carton|cartones|jugar|participar|anotarme)\b/.test(n))return 'decline';
 return /\b(?:comprar|compra|comprarme|adquirir|carton|cartones|jugar|participar|anotarme|inscribirme)\b/.test(n)?'purchase':null;
}
export function isQuestion(input){return /[¿?]/.test(String(input))||/^(?:(?:hola|disculpa|oye)[,\s]+)?(?:a\s+q(?:ue)?\s+hora|que|q\s|como|donde|cuando|cual(?:es)?|cuanto(?:s)?|por\s+que|puedo|se\s+puede|hay|sabes|me\s+puedes|tengo\s+(?:una\s+)?(?:duda|pregunta))\b/.test(conversationText(input));}
function faq(input,CONFIG){const n=conversationText(input);
 if(/^(?:que es (?:esto|eso|esta pagina|este sitio|bingoandino75|el bingo andino)|para que (?:es|sirve) (?:esto|eso|esta pagina)|de que (?:se )?trata (?:esto|esta pagina)|que (?:hacen|se hace) aqui)[.!?\s]*$/.test(n))return [text('Este es el asistente de BingoAndino75 😊 Te ayudo a comprar cartones y a revisar tu compra, paso a paso.')];
 if(/quien eres|eres (?:un |una )?(?:bot|robot|persona|asistente)|con quien (?:hablo|estoy hablando)|que eres/.test(n))return [text('Soy el asistente virtual de BingoAndino75 😊 Te ayudo con tus cartones y te voy guiando en la compra.')];
 if(/hablar.*(?:persona|alguien|soporte|operador)|(?:quiero|necesito|comunicarme).*soporte|(?:ayude|atienda).*persona|^soporte[.!?\s]*$/.test(n))return [text('Claro 😊 Puedes escribirle a soporte al 0424-7221608, de lunes a sábado de 9 a. m. a 8 p. m.')];
 if(/a\s+q(?:ue)?\s+hora|(?:hora|horario).*(?:sorteo|bingo|vivo)|cuando.*(?:sorteo|bingo|empieza|comienza)/.test(n))return [text('El horario del sorteo está en el anuncio de inicio de la página 😊 Revísalo allí para confirmar la hora de hoy.')];
 if(/(?:donde|como).*(?:mi carton|mis cartones|mi compra)|(?:verificar|consultar|buscar).*(?:mi compra|mis cartones)|^(?:mis cartones|mi carton|mi compra)$/.test(n))return [text('Puedes consultar tu compra en la página con tu cédula 😊'),{type:'link',url:CONFIG.verify,label:'Verificar mi compra y ver mis cartones'}];
 if(/(?:donde|por donde|como).*(?:ver\b.*(?:vivo|bingo|sorteo|transmision)|transmi|vivo)|(?:canal|youtube).*(?:sorteo|bingo|vivo)/.test(n))return [text('Jugamos en vivo por YouTube 😊 Puedes abrir la transmisión desde la página.'),{type:'link',url:CONFIG.site,label:'Ver la página del bingo'}];
 if(/como (?:se )?juega|como (?:es|funciona) (?:eso|el juego|el bingo)|de que (?:se )?trata|(?:un|mismo|solo) carton.*(?:todas|rondas)/.test(n))return [text('Con tu cartón juegas en todas las rondas 🎟️ Sacamos las bolitas del bombo y el sistema indica quién gana. Si quieres jugar, te ayudo por aquí.')];
 if(/cuantas rondas|cuales (?:son los )?premios|cuanto.*(?:premio|reparte)/.test(n))return [text('Los premios y las rondas dependen del sorteo del día 😊 Puedes consultarlos en el anuncio de inicio.'),{type:'link',url:CONFIG.site,label:'Consultar el anuncio del bingo'}];
 if(/como.*(?:comprobante|captura|capture|imagen|foto)|donde.*(?:adjunt|subo|comprobante|capture|foto)/.test(n))return [text('Para mandar el capture, toca el clip 📎 al lado de donde escribes y busca la foto del pago en tu teléfono.')];
 if(/(?:que|cual|donde).*referencia|referencia.*(?:que es|donde)/.test(n))return [text('La referencia es el número que aparece en el recibo de tu Pago Móvil. Envíame ese número completo, tal como sale allí 😊')];
 if(/como.*(?:pago movil|transferir|pagar)/.test(n))return [text('Haces tu Pago Móvil con el monto exacto y los datos que te mostraré. Después me mandas el capture y la referencia 😊')];
 return null;
}
export function quantity(input,allowBare=false){const n=conversationText(input).replace(/\s+(?:porfa|por favor|por favorcito|nada mas|para hoy)[.!?\s]*$/,'');const amount='(\\d+|(?:treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)(?:\\s+y\\s+(?:uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve))?|[a-z]+)';const candidates=[n.match(new RegExp('(?:quiero|quisiera|deseo|dame|deme|necesito|comprar|serian|me das|me da|mandame|anotame|ponme)\\s+(?:comprar\\s+)?'+amount)),n.match(new RegExp(amount+'\\s+carton(?:es)?\\b')),allowBare?n.match(new RegExp('^'+amount+'[.!?\\s]*$')):null];for(const m of candidates){if(!m)continue;const value=/^\d+$/.test(m[1])?Number(m[1]):m[1].includes(' y ')?m[1].split(/\s+y\s+/).reduce((sum,w)=>sum+(words[w]??NaN),0):words[m[1]];if(value!==undefined&&Number.isFinite(value))return value;}return null;}

export function details(input,paymentMode=false,allowName=true){const out={};if(isQuestion(input))return out;const lines=String(input).split(/[\n;]+/).map(l=>l.trim()).filter(Boolean);for(const line of lines){const n=norm(line);let m;
 if((m=line.match(/^(?:nombre(?:\s+y\s+apellido)?|titular)\s*[:=-]\s*(.+)$/i)))out.name=title(m[1]);
 const isPay=/pago|premio|titular/.test(n)||paymentMode;
 if((m=line.match(/(?:c[eé]dula(?:\s+(?:de\s+)?(?:pago\s*m[oó]vil|pago|premios))?|^ci|^v|^e)\s*[:=-]?\s*([\d.\s-]{4,30})/i))){const d=digits(m[1]);if(d.length>=4&&d.length<=12)out[isPay?'payId':'id']=d;}
 if((m=line.match(/(?:tel[eé]fono(?:\s+(?:de\s+)?(?:pago\s*m[oó]vil|pago|premios))?|celular|tlf)\s*[:=-]?\s*([+\d() .-]{10,30})/i))){const d=digits(m[1]);if(d.length>=10&&d.length<=15)out[isPay?'payPhone':'phone']=d;}
 for(const [key,value] of Object.entries(banks))if(new RegExp('(?:^|\\W)'+key+'(?:$|\\W)').test(n)){out.bank=value;break;}
 }
 const numbers=String(input).match(/(?:\+?58[ -]?)?0?4\d{2}[ -]?\d{3}[ -]?\d{4}/g)||[];
 if(numbers.length&&!out[paymentMode?'payPhone':'phone'])out[paymentMode?'payPhone':'phone']=digits(numbers[0]);
 let remaining=String(input);for(const number of numbers)remaining=remaining.replace(number,' ');
 if(!out[paymentMode?'payId':'id']){const match=remaining.match(/(?:^|[\s,;])(\d[\d.]{3,14})(?=[\s,;]|$)/);if(match){const d=digits(match[1]);if(d.length>=4&&d.length<=12)out[paymentMode?'payId':'id']=d;}}
 if(allowName&&!paymentMode&&!out.name){let first=(lines[0]||'').replace(/^(?:me llamo|mi nombre es|soy)\s+/i,'');first=first.replace(/(?:\+?58[ -]?)?0?4\d{2}[ -]?\d{3}[ -]?\d{4}/g,'').replace(/\d[\d.]+/g,'').replace(/[,;]+/g,' ').trim();if(/^[\p{L}][\p{L}\s'-]{3,100}$/u.test(first)&&first.split(/\s+/).length>=2&&!/\b(?:no|yo|usted|tu|eso|puedo|puede|tengo|claro|dale|chevere|listo|perfecto|nueva|nuevo)\b/i.test(first)&&!/quiero|carton|mismos|cambiar|corrige|referencia|estan|favor|pago|datos|correct|buenas|hola|necesito|ayuda|duda|sorteo|hora|gracias|entiendo|enrede|explica|jugar|participar|miedo|complicado|enredo/i.test(first)&&!Object.keys(banks).some(b=>norm(first).includes(b)))out.name=title(first);}
 return out;
}
export function reference(input,allowBare=false){let s=String(input).trim();const match=s.match(/(?:referencia|ref\.?)[\s:#=-]*([\d .-]+)/i);if(match)s=match[1];else if(!allowBare)return null;if(!/^[\d .-]+$/.test(s))return null;const d=digits(s);return d.length>=4&&d.length<=64?d:null;}
export class Assistant{
 constructor(config,random=Math.random){this.config={...CONFIG,...config};this.random=random;this.state={step:'welcome',quantity:0,data:{},confirmed:false,cards:[],file:null,ref:'',submitted:false};this.available=new Set();}
 start(){return [text('¡Hola! 😊 Bienvenido a BingoAndino75. Cuéntame, ¿en qué te ayudo?')];}
 payment(){return {type:'payment',quantity:this.state.quantity,total:this.state.quantity*this.config.price,copy:`${this.config.bank}\n${this.config.phone}\n${this.config.id}\n${money(this.state.quantity*this.config.price)} Bs`};}
 summary(){return {type:'summary',data:{...this.state.data},quantity:this.state.quantity,cards:[...this.state.cards]};}
 guidance(){const step=this.state.step;
 const help={done:'Tu compra ya fue enviada 😊 Puedes revisar si está aprobada en «Verificar tu compra». No hagas otro pago.',quantity:'Vamos con calma 😊 Dime cuántos cartones quieres. Por ejemplo, puedes escribir: dos.',data:'Vamos con calma 😊 Mándame tu nombre y apellido, tu cédula y tu teléfono. Juntos o uno por uno, como te sea más fácil.',paymentData:'Son los datos de tu Pago Móvil para recibir los premios: banco, cédula y teléfono. Si la cédula y teléfono son los que ya mandaste, escribe «son los mismos» 😊',confirm:'Revisa los datos que te mostré. Si están bien, escribe «sí». Si hay un error, dime cuál dato quieres corregir 😊',cards:'Puedes decirme tus números favoritos o escribir «escoge tú» y yo los busco por ti 😊',proof:'Toca el clip 📎 para mandar el capture del pago. Después escribe la referencia que aparece en ese recibo.',final:'Si todo está bien, escribe «confirmo». Tu compra quedará pendiente hasta que se revise el pago 😊'};
 if(help[step])return [text(help[step])];
 if(step==='route')return this.advance();
 return [text('Claro, vamos paso a paso 😊 Para jugar necesitas comprar tu cartón. ¿Quieres que te ayude por aquí?')];
 }
 advance(){const s=this.state,d=s.data;
 if(!s.quantity){s.step='quantity';return [text('Con gusto 😊 ¿Cuántos cartones deseas?')];}
 const missing=[(!d.name||d.name.length>160||!/^['’\p{L}\s.-]+$/u.test(d.name))&&'nombre y apellido',!/^\d{5,12}$/.test(d.id||'')&&'cédula',!/^\d{10,15}$/.test(d.phone||'')&&'teléfono'].filter(Boolean);
 if(missing.length){s.step='data';return [text(`Envíame ${missing.join(', ')} para anotarte 📝 Puedes mandarlos juntos o por partes.`)];}
 const pm=[!d.bank&&'banco',!/^\d{4,12}$/.test(d.payId||'')&&'cédula',!/^\d{10,15}$/.test(d.payPhone||'')&&'teléfono'].filter(Boolean);
 if(pm.length){s.step='paymentData';return [text(`Ahora mándame ${pm.join(', ')} de tu Pago Móvil para los premios. Si usas la misma cédula y teléfono, escribe «son los mismos» 😊`)];}
 if(!s.confirmed){s.step='confirm';return [this.summary(),text('Revisa bien tu cédula y teléfono 😊 ¿Los datos están bien? Allí recibirías tus premios.')];}
 if(s.cards.length!==s.quantity){s.step='cards';return [text('¿Cuáles números quieres? Si te da igual, escribe «escoge tú» y los busco por ti 😊')];}
 if(!s.file||!s.ref){s.step='proof';return [text(!s.file&&!s.ref?'Ahora mándame el capture del pago y la referencia 📎 Usa el clip para mandar la foto.':!s.file?'Solo falta el capture del pago 📎 Toca el clip para mandarlo.':'Ya tengo el capture 😊 Ahora mándame la referencia que sale en el recibo del pago.')];}
 s.step='final';return [{type:'review',quantity:s.quantity,total:s.quantity*this.config.price,cards:[...s.cards],ref:s.ref},text('Ya está todo listo 😊 ¿Confirmas que mande tu compra para revisar el pago?')];
 }
 choose(cards){const s=this.state;if(s.submitted)return [text('Esta compra ya está registrada. Puedes iniciar otra con «Nueva conversación».')];const unique=[...new Set(cards.map(Number))];if(unique.length!==s.quantity)return [text(`Necesito ${s.quantity} cartones distintos. Llevas ${unique.length}.`)];const busy=unique.filter(n=>!this.available.has(n));if(busy.length)return [text(`Estos no están disponibles: ${busy.join(', ')}. Dime otros números o pídemelos al azar.`)];s.cards=unique;return [text(`Listo 🎟️ Tus cartones: ${unique.join(', ')}.`),...this.advance()];}
 attach(file){if(this.state.submitted)return [text('La compra ya está registrada. No necesitas reenviar la imagen.')];this.state.file={name:file.name,size:file.size};return [text('Comprobante recibido 📎'),...this.advance()];}
 receive(input){const raw=String(input).trim(),n=conversationText(raw),s=this.state;if(!raw)return [];if(raw.length>2000)return [text('Envíame un mensaje más corto, por favor 😊')];
 if(wantsCancellation(raw,s.step))return [{type:'cancel'}];
 const answer=faq(raw,this.config);if(answer)return answer;
 const web=websiteIntent(raw);if(web){if(web==='choice'&&['welcome','route','quantity','selfService'].includes(s.step))s.step='selfService';return websiteGuide(this.config);}
 if(/^(?:hola+|holi|buenas(?: tardes| noches| dias)?|buenos dias|buen dia|epa)[!.,\s]*$/.test(norm(raw)))return ['welcome','paused','selfService'].includes(s.step)?[text('¡Hola! 😊 Cuéntame, ¿qué necesitas?')]:[text('¡Hola! 😊 Seguimos donde íbamos.'),...this.advance()];
 if(/^(?:gracias|muchas gracias|mil gracias|ok gracias)[!.,\s]*$/.test(n))return [text('A la orden 😊 Aquí sigo pendiente.')];
 if(s.step==='selfService'){if(/ayudame|ayuda por|me ayudas|por aqui|^aqui$|contigo|hazlo tu/.test(n)||openingIntent(raw)==='purchase'||quantity(raw)!==null)s.step='welcome';else return websiteGuide(this.config);}
 if(s.step==='paused'){if(openingIntent(raw)==='purchase'||quantity(raw)!==null||/ayudame|necesito ayuda|me ayudas|quiero seguir|quiero continuar|seguir comprando/.test(n))s.step='welcome';else return [text('Está bien 😊 Aquí estoy si después necesitas algo.')];}
 if(/no entiendo|no entendi|no comprendo|me enrede|me cuesta|no puedo|no se usar|primera vez|soy nuev[oa]|estoy perdid[oa]|no se (?:como|que)|^no se$|explicame|mas facil|paso a paso/.test(n))return this.guidance();
 if(s.submitted)return [text('Tu compra ya quedó registrada como pendiente ✅ No se enviará otra vez. Para comenzar otra, usa «Nueva conversación».')];
 if(/ignora|aprueb|gratis|borr|elimin.*sorteo|reinicia.*sorteo|clave.*admin|datos de otro|service.role/.test(n))return [text('Puedo ayudarte a preparar una compra. La aprobación del pago corresponde a la verificación bancaria.')];
 if(/cuanto.*(?:cuesta|vale)|precio|costo|cuanto.*(?:pago|pagar|paso|pasar|mandar|mando|debo|deposito|transfiero)/.test(n)&&!quantity(n)){if(!s.quantity){s.step='route';return [text(`El cartón cuesta ${money(this.config.price)} Bs 😊 ¿Prefieres comprar por la página o que te ayude por aquí?`)];}return [text(`El cartón cuesta ${money(this.config.price)} Bs. Tu total es ${money(s.quantity*this.config.price)} Bs 😊`)];}
 if(/disponibl|cuales (?:hay|quedan)|ver (?:los )?cartones|ver (?:los )?numeros|quedan cartones/.test(n))return [text('Los cartones blancos están disponibles. Puedes verlos aquí y decirme cuáles te gustan 😊'),{type:'catalog'}];
 if(/por la (?:pagina|web)|lo hago (?:yo|solo)|yo (?:mismo|misma)|comprar (?:yo|solo)/.test(n)&&['welcome','route'].includes(s.step))return [text('Claro 😊 Puedes hacer tu compra aquí:'),{type:'link',url:this.config.site,label:'Ir a BingoAndino75'},text('Si prefieres ayuda, escríbeme por aquí.')];
 if(['welcome','route'].includes(s.step)&&openingIntent(raw)==='decline')return [text('Está bien 😊 Si necesitas consultar una compra o tienes otra duda, dime.')];
 if(s.step==='route'&&/^(?:no(?: gracias)?[.!]*|no (?:quiero|necesito) (?:tu )?ayuda[.!]*)$/.test(n))return [text('Está bien 😊 Puedes comprar directamente en la página.'),{type:'link',url:this.config.site,label:'Ir a la página'}];
 if(['welcome','route'].includes(s.step)&&!/(?:no (?:quiero|necesito) (?:tu )?ayuda|no me ayudes)/.test(n)&&(/\b(?:(?:por )?aqui|(?:por )?aca|por (?:este |el )?chat|en el chat|tu|usted|ayudame|ayuda por|contigo|hazlo tu|me ayud(?:es|as|a|e)|me (?:puedes|puede|podrias|podria) ayudar|(?:quiero|necesito) (?:tu )?ayuda)\b/.test(n)||yes(n)||/^ayuda[.!?]*$/.test(n)))return this.advance();
 if(['welcome','route'].includes(s.step)&&openingIntent(raw)==='purchase'&&quantity(raw)===null){if(s.step==='route')return this.advance();s.step='route';return [text(`El cartón cuesta ${money(this.config.price)} Bs 😊 ¿Prefieres comprar por la página o que te ayude por aquí?`)];}
 if(/^[¿?]+$/.test(raw)||/^(?:no entiendo|no entendi|como asi|que hago|no se)[.!?]*$/.test(n))return ['welcome'].includes(s.step)?this.start():this.advance();
 if(isQuestion(raw)&&quantity(raw)===null)return [{type:'question',text:raw}];
 if(/mismos|misma cedula|mismo telefono|igual.*registro|mis datos son los mismos/.test(n)){if(s.data.id)s.data.payId=s.data.id;if(s.data.phone)s.data.payPhone=s.data.phone;}
 const ref=reference(raw,s.step==='proof');if(ref)s.ref=ref;
 const dataLike=['data','paymentData'].includes(s.step)||/nombre|cedula|cédula|telefono|teléfono|banco|titular|celular|tlf/.test(n);
 const extracted=dataLike?details(raw,s.step==='paymentData',s.step==='data'):{};
 // Un cambio nunca equivale a confirmar ni a enviar una compra.
 if(Object.keys(extracted).length){Object.assign(s.data,extracted);s.confirmed=false;}
 if(s.step==='final'&&yes(n))return [{type:'submit'}];
 if(s.step==='confirm'&&yes(n)&&!Object.keys(extracted).length){s.confirmed=true;return this.advance();}
 const q=quantity(raw,['quantity','route'].includes(s.step));if(q!==null){if(!Number.isInteger(q)||q<1||q>this.config.max)return [text('Puedes comprar una cantidad de 1 a 100 cartones.')];if(q!==s.quantity){s.quantity=q;s.cards=[];s.confirmed=false;return [text(`Serían ${money(q*this.config.price)} Bs por ${q} cartones 😊`),...this.advance()];}}
 if(s.quantity&&wantsRandom(n)){const candidates=[...this.available];for(let i=candidates.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}return this.choose(candidates.slice(0,s.quantity));}
 if(s.quantity&&(/carton|numero|^el\b|^los\b/.test(n)||s.step==='cards')&&!ref&&!Object.keys(extracted).length){const ids=raw.match(/\b\d{1,4}\b/g);if(ids?.length)return this.choose(ids.map(Number));}
 if(Object.keys(extracted).length||ref||/mismos|misma cedula|mismo telefono/.test(n))return this.advance();
 if(/^no\b/.test(n)&&['confirm','final'].includes(s.step))return [text('Dime qué dato quieres corregir y escríbelo de nuevo, por ejemplo: «Teléfono: 04120000000».')];
 if(s.step==='proof'&&/ya.*(?:pague|envie)|ya esta|listo/.test(n))return this.advance();
 return s.step==='welcome'?[text('Claro, te ayudo 😊 ¿Quieres jugar, saber el precio o buscar una compra?')]:this.advance();
 }
}
