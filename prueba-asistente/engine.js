export const CONFIG=Object.freeze({price:400,total:1200,max:100,bank:'Mercantil · 0105',phone:'0412-0000000',id:'V-00000000',site:'https://bingoandino75.com/'});
const banks={'mercantil':'Mercantil','banesco':'Banesco','venezuela':'Venezuela','provincial':'Provincial','bnc':'BNC','bancamiga':'Bancamiga','bancaribe':'Bancaribe','tesoro':'Tesoro','bfc':'BFC','banplus':'Banplus','0105':'Mercantil','0134':'Banesco','0102':'Venezuela','0108':'Provincial','0191':'BNC','0172':'Bancamiga','0114':'Bancaribe','0163':'Tesoro','0151':'BFC','0174':'Banplus'};
const words={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,quince:15,veinte:20,treinta:30,cuarenta:40,cincuenta:50,cien:100};
export const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const digits=s=>String(s||'').replace(/\D/g,'');
export const money=n=>new Intl.NumberFormat('es-VE',{maximumFractionDigits:2}).format(n);
const title=s=>s.trim().replace(/\s+/g,' ').toLocaleLowerCase('es').replace(/(^|\s)\p{L}/gu,c=>c.toLocaleUpperCase('es'));
const yes=s=>/^(si|si claro|correcto|correctos|esta bien|estan bien|todo bien|confirmo|confirmado|asi es|ok|listo|dale|perfecto|si estan correctos|si estan bien|si confirmo|si todo bien)[.!\s]*$/.test(norm(s).replace(/[,¡!¿?]/g,''));
const text=s=>({type:'text',text:s});
export function quantity(input,allowBare=false){const n=norm(input);let m=n.match(/(?:quiero|deseo|dame|necesito|comprar|serian)\s+(?:comprar\s+)?(\d+|[a-z]+)/)||n.match(/(\d+|[a-z]+)\s+carton(?:es)?\b/);if(!m&&allowBare)m=n.match(/^(\d+|[a-z]+)[.!\s]*$/);if(!m)return null;return /^\d+$/.test(m[1])?Number(m[1]):words[m[1]]??null;}
export function details(input,paymentMode=false,allowName=true){const out={};const lines=String(input).split(/[\n;]+/).map(l=>l.trim()).filter(Boolean);for(const line of lines){const n=norm(line);let m;
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
 if(allowName&&!paymentMode&&!out.name){let first=lines[0]||'';first=first.replace(/(?:\+?58[ -]?)?0?4\d{2}[ -]?\d{3}[ -]?\d{4}/g,'').replace(/\d[\d.]+/g,'').replace(/[,;]+/g,' ').trim();if(/^[\p{L}][\p{L}\s'-]{3,100}$/u.test(first)&&first.split(/\s+/).length>=2&&!/quiero|carton|mismos|cambiar|corrige|referencia|estan|estan|favor|pago|datos|correct|buenas|hola/i.test(first)&&!Object.keys(banks).some(b=>norm(first).includes(b)))out.name=title(first);}
 return out;
}
export function reference(input,allowBare=false){let s=String(input).trim();const match=s.match(/(?:referencia|ref\.?)[\s:#=-]*([\d .-]+)/i);if(match)s=match[1];else if(!allowBare)return null;if(!/^[\d .-]+$/.test(s))return null;const d=digits(s);return d.length>=4&&d.length<=64?d:null;}
export class Assistant{
 constructor(random=Math.random){this.random=random;this.state={step:'welcome',quantity:0,data:{},confirmed:false,cards:[],file:null,ref:'',submitted:false};this.available=new Set(Array.from({length:CONFIG.total},(_,i)=>i+1).filter(n=>n%7!==0&&n%11!==0&&n%13!==0));}
 start(){return [text('¡Hola! 😊 Bienvenido a BingoAndino75. ¿En qué puedo ayudarte?')];}
 payment(){return {type:'payment',quantity:this.state.quantity,total:this.state.quantity*CONFIG.price,copy:`${CONFIG.bank}\n${CONFIG.phone}\n${CONFIG.id}\n${money(this.state.quantity*CONFIG.price)} Bs`};}
 summary(){return {type:'summary',data:{...this.state.data},quantity:this.state.quantity,cards:[...this.state.cards]};}
 advance(){const s=this.state,d=s.data;
 if(!s.quantity){s.step='quantity';return [text('Con gusto 😊 ¿Cuántos cartones deseas?')];}
 const missing=[(!d.name||d.name.length>160||!/^['’\p{L}\s.-]+$/u.test(d.name))&&'nombre y apellido',!/^\d{5,12}$/.test(d.id||'')&&'cédula',!/^\d{10,15}$/.test(d.phone||'')&&'teléfono'].filter(Boolean);
 if(missing.length){s.step='data';return [text(`Envíame ${missing.join(', ')} para el registro 📝`)];}
 const pm=[!d.bank&&'banco',!/^\d{4,12}$/.test(d.payId||'')&&'cédula',!/^\d{10,15}$/.test(d.payPhone||'')&&'teléfono'].filter(Boolean);
 if(pm.length){s.step='paymentData';return [text(`Para recibir tus premios, envíame ${pm.join(', ')} de Pago Móvil. Si la cédula y el teléfono son los mismos del registro, dímelo 😊`)];}
 if(!s.confirmed){s.step='confirm';return [this.summary(),text('¿Están correctos? Revisa bien los números; allí recibirías tus premios.')];}
 if(s.cards.length!==s.quantity){s.step='cards';return [text('¿Tienes números favoritos o quieres que los escoja al azar? 😊')];}
 if(!s.file||!s.ref){s.step='proof';return [text(!s.file&&!s.ref?'Ahora adjunta una imagen de prueba y escribe la referencia 📎':!s.file?'Solo falta adjuntar la imagen de prueba 📎':'Recibí la imagen 😊 Envíame la referencia del pago.')];}
 s.step='final';return [{type:'review',quantity:s.quantity,total:s.quantity*CONFIG.price,cards:[...s.cards],ref:s.ref},text('Todo está listo. ¿Confirmas que registre esta compra de prueba?')];
 }
 choose(cards){const s=this.state;if(s.submitted)return [text('Esta compra de prueba ya está registrada. Puedes iniciar otra con «Nueva prueba».')];const unique=[...new Set(cards.map(Number))];if(unique.length!==s.quantity)return [text(`Necesito ${s.quantity} cartones distintos. Llevas ${unique.length}.`)];const busy=unique.filter(n=>!this.available.has(n));if(busy.length)return [text(`Estos no están disponibles: ${busy.join(', ')}. Dime otros números o pídemelos al azar.`)];s.cards=unique;return [text(`Listo 🎟️ Tus cartones: ${unique.join(', ')}.`),...this.advance()];}
 attach(file){if(this.state.submitted)return [text('La compra de prueba ya está registrada. No necesitas reenviar la imagen.')];this.state.file={name:file.name,size:file.size};return [text('Imagen de prueba recibida 📎'),...this.advance()];}
 receive(input){const raw=String(input).trim(),n=norm(raw),s=this.state;if(!raw)return [];if(raw.length>2000)return [text('Envíame un mensaje más corto, por favor 😊')];
 if(s.submitted)return [text('Tu compra de prueba ya quedó registrada como pendiente ✅ No se enviará otra vez. Para comenzar otra, usa «Nueva prueba».')];
 if(/ignora|aprueb|gratis|borr|elimin.*sorteo|reinicia.*sorteo|clave.*admin|datos de otro|service.role/.test(n))return [text('Puedo ayudarte a preparar una compra. La aprobación del pago corresponde a la verificación bancaria.')];
 if(/cuanto.*(?:cuesta|vale)|precio|costo/.test(n)&&!quantity(n)){if(!s.quantity){s.step='route';return [text(`El cartón de esta prueba cuesta ${money(CONFIG.price)} Bs 😊 ¿Prefieres comprar por la página o que te ayude por aquí?`)];}return [text(`El cartón de esta prueba cuesta ${money(CONFIG.price)} Bs. Tu total es ${money(s.quantity*CONFIG.price)} Bs 😊`)];}
 if(/disponibl|cuales (?:hay|quedan)|ver (?:los )?cartones|ver (?:los )?numeros|quedan cartones/.test(n))return [text('Los cartones blancos están disponibles. Puedes verlos aquí y decirme cuáles te gustan 😊'),{type:'catalog'}];
 if(/por la (?:pagina|web)|lo hago (?:yo|solo)|yo (?:mismo|misma)|comprar (?:yo|solo)/.test(n)&&['welcome','route'].includes(s.step))return [text('Claro 😊 Puedes hacer tu compra aquí:'),{type:'link',url:CONFIG.site,label:'Ir a BingoAndino75'},text('Si prefieres ayuda, escríbeme por aquí.')];
 if(/mismos|misma cedula|mismo telefono|igual.*registro/.test(n)){if(s.data.id)s.data.payId=s.data.id;if(s.data.phone)s.data.payPhone=s.data.phone;}
 const ref=reference(raw,s.step==='proof');if(ref)s.ref=ref;
 const dataLike=['data','paymentData'].includes(s.step)||/nombre|cedula|cédula|telefono|teléfono|banco|titular|celular|tlf/.test(n);
 const extracted=dataLike?details(raw,s.step==='paymentData',s.step==='data'):{};
 // Un cambio nunca equivale a confirmar ni a enviar una compra.
 if(Object.keys(extracted).length){Object.assign(s.data,extracted);s.confirmed=false;}
 if(s.step==='final'&&yes(n)){s.submitted=true;s.step='done';return [{type:'success',quantity:s.quantity,cards:[...s.cards],total:s.quantity*CONFIG.price},text('Es una simulación: no se creó una compra real ni se verificó ningún pago.')];}
 if(s.step==='confirm'&&yes(n)&&!Object.keys(extracted).length){s.confirmed=true;return this.advance();}
 const q=quantity(raw,s.step==='quantity');if(q!==null){if(!Number.isInteger(q)||q<1||q>CONFIG.max)return [text('Puedes probar con una cantidad de 1 a 100 cartones.')];if(q!==s.quantity){s.quantity=q;s.cards=[];s.confirmed=false;return [this.payment(),...this.advance()];}}
 if(s.quantity&&/azar|escoge|escoja|eligelos|elige tu|cualquiera/.test(n)){const candidates=[...this.available];for(let i=candidates.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}return this.choose(candidates.slice(0,s.quantity));}
 if(s.quantity&&(/carton|numero|^el\b|^los\b/.test(n)||s.step==='cards')&&!ref&&!Object.keys(extracted).length){const ids=raw.match(/\b\d{1,4}\b/g);if(ids?.length)return this.choose(ids.map(Number));}
 if(['welcome','route'].includes(s.step)&&/por aqui|ayudame|ayuda por|contigo|hazlo tu|si/.test(n))return this.advance();
 if(s.step==='welcome'&&/comprar|cartones|carton/.test(n)){s.step='route';return [text(`El cartón de esta prueba cuesta ${money(CONFIG.price)} Bs 😊 ¿Prefieres comprar por la página o que te ayude por aquí?`)];}
 if(Object.keys(extracted).length||ref||/mismos|misma cedula|mismo telefono/.test(n))return this.advance();
 if(/^no\b/.test(n)&&['confirm','final'].includes(s.step))return [text('Dime qué dato quieres corregir y escríbelo de nuevo, por ejemplo: «Teléfono: 04120000000».')];
 if(s.step==='proof'&&/ya.*(?:pague|envie)|ya esta|listo/.test(n))return this.advance();
 if(/hola|buenas|buenos dias|buenas tardes|buenas noches/.test(n))return this.start();
 return ['welcome','route'].includes(s.step)?[text('Claro 😊 Cuéntame, ¿en qué puedo ayudarte?')]:this.advance();
 }
}
