import {numberRiddle} from './number-riddle.mjs';

// Reviewed, stable facts; original wording. Reference checks:
// Australian Museum: /learn/species-identification/ask-an-expert/what-is-a-monotreme/
// San Diego Zoo: animals.sandiegozoo.org/animals/axolotl
// Waikiki Aquarium: /experience/animal-guide/fishes/seahorses-seadragons-and-pipefishes/seahorse/
// UNESCO: whc.unesco.org/en/list/658/ and /en/list/701/
// NASA: science.nasa.gov/moon/eclipses/ and /earth/earth-observatory/venezuelas-flat-topped-mountains-148520/
// NOAA: oceanservice.noaa.gov/facts/biolum.html
// Inparques: /2018/05/dia-nacional-del-arbol-proveedor-de-vida-en-el-planeta/
// RAE: definitions of casabe, merengue, elipsis, polisemia, palíndromo, anagrama.
const BANK={
 'Objetos del hogar':[
  ['Cremallera','Tengo dos filas de dientes y un viajero que las enlaza o separa. Mi recorrido convierte una abertura en una unión continua. ¿Qué soy?','¿Qué cierre une dos filas de dientes mediante una pieza que se desliza por ellas?','Es un cierre de ropa o bolsos.','El deslizador de la cremallera acopla o separa sus dos filas de dientes.'],
  ['Tornillo','Mi camino es una espiral. Para avanzar debo dar vueltas; para retroceder, deshacerlas. Una ranura en mi cabeza suele recibir la herramienta. ¿Qué soy?','¿Qué elemento de fijación transforma el giro en avance gracias a una rosca helicoidal?','Sirve para fijar piezas.','La rosca permite que el tornillo avance al girar y retroceda al girar en sentido contrario.'],
  ['Termómetro','En mi versión de contacto alcanzo equilibrio térmico con lo que estoy midiendo. Mi escala puede hablar en Celsius o Fahrenheit. ¿Qué instrumento soy?','¿Qué instrumento mide temperatura y puede estar graduado en Celsius o Fahrenheit?','Es un instrumento de medición.','El termómetro mide temperatura; Celsius y Fahrenheit son escalas de temperatura.'],
  ['Brújula','Mi aguja busca una dirección aunque cambies el rumbo. Respondo a un campo que no ves y te ayudo a orientarte sin conocer tu destino. ¿Qué soy?','¿Qué instrumento de orientación utiliza una aguja imantada que responde al campo magnético terrestre?','Sirve para orientarse.','La aguja imantada de la brújula se orienta según el campo magnético terrestre. También se acepta compás magnético.']
 ],
 'Animales':[
  ['Ornitorrinco','Mis crías reciben leche, aunque comienzo mi vida dentro de un huevo. Busco presas acuáticas con un pico capaz de detectar débiles señales eléctricas. ¿Qué animal soy?','¿Qué mamífero australiano pone huevos y utiliza electrorreceptores en su pico para localizar presas acuáticas?','Es un mamífero australiano.','El ornitorrinco es un mamífero ovíparo; su pico detecta señales eléctricas de las presas.'],
  ['Ajolote','Llevo alrededor de la cabeza unas ramas que me ayudan a respirar bajo el agua. Soy una salamandra que normalmente conserva rasgos juveniles al llegar a adulta; Xochimilco forma parte de mi hogar natural. ¿Quién soy?','¿Qué salamandra mexicana, asociada a Xochimilco, conserva normalmente branquias externas y otros rasgos juveniles en la adultez?','Es un anfibio mexicano.','El ajolote conserva normalmente branquias externas y otros rasgos larvarios en la adultez.'],
  ['Caballito de mar','Mi nombre recuerda a un corredor terrestre, pero me desplazo entre algas. Mi cola puede sujetarse a ellas y el macho incuba los huevos en una bolsa. ¿Qué pez soy?','¿Qué pez de postura vertical tiene cola prensil y un macho que incuba huevos en una bolsa ventral?','Es un pez.','El caballito de mar posee cola prensil y los machos incuban los huevos en una bolsa.'],
  ['Luciérnaga','En la oscuridad puedo anunciarme con una luz producida por mi propio cuerpo. Soy un insecto que convierte una reacción química en un mensaje luminoso. Mi nombre tiene diez letras. ¿Quién soy?','¿Qué insecto de diez letras, conocido por sus señales luminosas nocturnas, produce luz mediante bioluminiscencia?','Es un insecto luminoso.','Las luciérnagas producen señales de luz por bioluminiscencia.']
 ],
 'Comida y frutas':[
  ['Casabe','Mi cuerpo es una torta delgada y seca, nacida de la yuca. Acompaño comidas caribeñas y amazónicas; mi nombre procede de una lengua indígena. ¿Qué alimento soy?','¿Qué torta fina tradicional del Caribe y de regiones amazónicas se elabora a partir de yuca?','Es una torta o pan de yuca.','El casabe es una torta fina tradicional elaborada con yuca. También se acepta la grafía cazabe.'],
  ['Merengue','El aire me da volumen cuando baten claras con azúcar. Mi nombre también pertenece a una música y a un baile. ¿Qué preparación soy?','¿Qué preparación de repostería se hace batiendo claras de huevo con azúcar y comparte nombre con un baile?','Se utiliza en repostería.','El merengue de repostería combina claras y azúcar; merengue también nombra un género musical y un baile.'],
  ['Levadura','Estoy viva y trabajo en una masa. Al aprovechar azúcares produzco gas que ayuda a aumentar su volumen. En panadería pertenezco al reino de los hongos. ¿Qué soy?','¿Qué hongo usado en panadería produce dióxido de carbono durante la fermentación y ayuda a que la masa crezca?','Interviene en la fermentación del pan.','La levadura de panadería fermenta azúcares y produce dióxido de carbono, que contribuye al aumento de volumen.'],
  ['Emulsión','En mí, un líquido queda repartido en gotitas dentro de otro con el que no se mezcla fácilmente. En la mayonesa, ingredientes como la yema ayudan a mantener esa unión. Mi nombre tiene ocho letras. ¿Qué tipo de mezcla soy?','¿Cómo se llama la dispersión de un líquido en pequeñas gotas dentro de otro inmiscible, como sucede en la mayonesa?','Es un tipo de mezcla.','Una emulsión dispersa gotas de un líquido en otro inmiscible; la mayonesa es un ejemplo.']
 ],
 'Naturaleza':[
  ['Estalactita','Me alargo desde el techo de una cueva. Las gotas van dejando el material que me construye y mi punta busca el suelo. ¿Qué formación soy?','¿Qué formación mineral de una cueva cuelga del techo y crece por depósitos del agua que gotea?','Es una formación de cueva.','Las estalactitas cuelgan del techo de las cuevas; las estalagmitas crecen desde el suelo.'],
  ['Liquen','Mi cuerpo resulta de una asociación: un hongo se une a un alga o a una cianobacteria. Puedo aparecer sobre rocas o cortezas. Mi nombre tiene seis letras. ¿Qué soy?','¿Qué nombre de seis letras recibe el conjunto formado por un hongo y un alga o una cianobacteria, que puede crecer sobre roca o corteza?','Es una asociación de organismos.','Un liquen está formado por la asociación de un hongo con un organismo fotosintético, como un alga o una cianobacteria.'],
  ['Estoma','Soy una abertura microscópica de la epidermis vegetal. Mis células guardianas regulan el paso de gases y de vapor de agua. ¿Qué estructura soy?','¿Qué poro de la epidermis vegetal, regulado por células oclusivas, interviene en el intercambio de gases y la transpiración?','Es una estructura vegetal microscópica.','El estoma es un poro vegetal cuya apertura está regulada por células oclusivas.'],
  ['Eclipse lunar','La Tierra ocupa el lugar del medio y su sombra alcanza a su compañera nocturna. A veces la vemos teñirse de rojo. ¿Qué fenómeno soy?','¿Qué fenómeno ocurre cuando la Tierra se interpone entre el Sol y la Luna y su sombra alcanza la superficie de esta última?','Es un fenómeno astronómico.','En un eclipse lunar, la Luna atraviesa la sombra de la Tierra.']
 ],
 'Venezuela':[
  ['Canaima','Soy un parque del sureste venezolano, de unos tres millones de hectáreas. Dentro de mis límites hay grandes montañas de cima plana y cascadas. Comparto fronteras con Brasil y Guyana. ¿Cuál es mi nombre?','¿Qué parque nacional del sureste venezolano ocupa unos tres millones de hectáreas, con montañas tabulares, y llega a las fronteras de Brasil y Guyana?','Es un parque nacional venezolano.','El Parque Nacional Canaima está en el sureste de Venezuela y abarca unos tres millones de hectáreas.'],
  ['Coro','Comparto reconocimiento patrimonial con mi puerto de La Vela. Mi arquitectura de tierra conserva adobe, bahareque y tapia; estoy en Falcón. ¿Qué ciudad soy?','¿Qué ciudad falconiana comparte con su puerto de La Vela una inscripción en el Patrimonio Mundial por su arquitectura de tierra?','Es una ciudad del estado Falcón.','Coro y su puerto de La Vela forman el conjunto reconocido por la UNESCO por su arquitectura de tierra.'],
  ['Tepuy','Mi cima puede parecer una mesa y mis paredes son abruptas. Soy una montaña característica del Escudo Guayanés; mi aislamiento permite vida singular en lo alto. ¿Qué tipo de montaña soy?','¿Cómo se llama la montaña tabular de paredes abruptas característica del Escudo Guayanés?','Es un tipo de montaña guayanesa.','Tepuy es el nombre de estas montañas tabulares características del Escudo Guayanés.'],
  ['Araguaney','Soy un emblema vegetal venezolano. Tras perder hojas en la época seca puedo cubrirme de una floración amarilla que hace resaltar mi copa. ¿Qué árbol soy?','¿Qué árbol nacional de Venezuela se distingue por su floración amarilla, que suele aparecer tras perder el follaje en la época seca?','Es un símbolo natural venezolano.','El araguaney es el árbol nacional venezolano y destaca por su floración amarilla.']
 ],
 'Palabras y lenguaje':[
  ['Anagrama','Conservo las letras y sus cantidades, pero cambio sus lugares. Puedo convertir ROMA en AMOR sin añadir ni quitar nada. ¿Qué transformación soy?','¿Cómo se llama una palabra o expresión obtenida al reordenar exactamente las letras de otra, como ROMA y AMOR?','Se relaciona con ordenar letras.','Un anagrama reorganiza las mismas letras, con las mismas cantidades.'],
  ['Palíndromo','Puedes recorrerme de izquierda a derecha y regresar: en una palabra como RECONOCER, las letras siguen el mismo orden. ¿Qué clase de palabra soy?','¿Cómo se llama una palabra que se lee igual en ambos sentidos, como RECONOCER?','Se relaciona con la lectura en dos sentidos.','Un palíndromo se lee igual de izquierda a derecha que de derecha a izquierda.'],
  ['Elipsis','En «Ana pidió café; Luis, té» estoy donde el verbo ya se entiende sin repetirse. Dejo una ausencia que el contexto permite reconstruir. Mi nombre tiene siete letras. ¿Qué recurso soy?','¿Qué término de siete letras nombra la omisión gramatical de palabras recuperables por el contexto, como el verbo en «Ana pidió café; Luis, té»?','Es un recurso gramatical de omisión.','La elipsis omite elementos que se pueden recuperar por el contexto; en el ejemplo se omite pidió.'],
  ['Polisemia','Un mismo nombre puede tener varios sentidos relacionados. La cabeza de una persona y la de una organización muestran mi presencia. ¿Qué fenómeno soy?','¿Qué fenómeno semántico permite que una misma palabra tenga varios sentidos relacionados entre sí?','Es un fenómeno semántico.','La polisemia consiste en la pluralidad de significados de una misma palabra.']
 ],
 'Números y lógica':[
  ['Número primo','Soy un entero mayor que uno y cuento exactamente con dos divisores positivos. El uno y yo agotamos esa lista. ¿Qué clase de número soy?','¿Qué nombre recibe un entero mayor que uno cuyos únicos divisores positivos son uno y él mismo?','Es una clase de número entero.','Un número primo tiene exactamente dos divisores positivos: uno y él mismo.'],
  ['Hipotenusa','Estoy frente al ángulo recto y soy el lado más largo de mi triángulo. El cuadrado de mi longitud equivale a la suma de los cuadrados de los otros dos lados. ¿Cómo me llamo?','¿Cómo se llama el lado opuesto al ángulo recto en un triángulo rectángulo?','Es un lado de un triángulo rectángulo.','La hipotenusa es el lado opuesto al ángulo recto; sus longitudes satisfacen el teorema de Pitágoras.'],
  ['Número perfecto','Soy un entero positivo que se recompone sumando todos sus divisores positivos menores que él. El 6 sirve de ejemplo porque 1 + 2 + 3 = 6. ¿Qué clase de número soy?','¿Cómo se llama un entero positivo igual a la suma de sus divisores positivos propios, como 6 o 28?','Es una clase de número entero.','Un número perfecto es igual a la suma de sus divisores positivos propios: para 28 son 1, 2, 4, 7 y 14.'],
  ['Mínimo común múltiplo','De los múltiplos positivos compartidos por dos enteros positivos, soy el menor. Para 6 y 8 mi valor es 24. ¿Qué concepto soy?','¿Cómo se llama el menor entero positivo que es múltiplo de dos enteros positivos dados?','Se abrevia MCM.','El mínimo común múltiplo es el menor múltiplo positivo compartido por los números dados.']
 ]
};
function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const b=new Uint32Array(1);crypto.getRandomValues(b);const j=b[0]%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const levels={'Fácil':1,'Media':1,'Difícil':2,'Muy difícil':4};
function bankDraft(type,theme,difficulty,previous){
 const pool=(BANK[theme]||Object.values(BANK).flat()).map(x=>({x}));
 const count=levels[difficulty];if(!count)throw Error('difficulty');
 // Avoid an identical full question from the supplied history.
 let lastDraft;
 for(let attempt=0;attempt<60;attempt++){
  const chosen=shuffle(pool).slice(0,count);
  const texts=chosen.map(({x})=>type==='Trivia'?x[2]:x[1]);
  if(chosen.some(({x},i)=>texts.some((q,j)=>i!==j&&normal(q).includes(normal(x[0])))))continue;
  const intro=count===1?(type==='Trivia'?'💡 Conecta las pistas:':'🧩 Descifra la adivinanza:'):(type==='Trivia'?'💡 Reto de '+count+' respuestas:':'🧩 '+count+' adivinanzas encadenadas:')+'\nDebes acertarlas todas y escribir las respuestas en el orden indicado.';
  const question=intro+'\n\n'+texts.map((q,i)=>(count>1?(i+1)+'. ':'')+q+(difficulty==='Fácil'?'\nPista: '+chosen[i].x[3]:'')).join('\n\n');
  const repeated=previous.some(p=>normal(p).includes(normal(question)));
  lastDraft={question,answer:chosen.map(({x},i)=>(count>1?(i+1)+'. ':'')+x[0]).join('\n'),explanation:chosen.map(({x},i)=>(count>1?(i+1)+'. ':'')+x[0]+': '+x[4]).join('\n\n'),source:'Biblioteca revisada · respaldo'};
  if(!repeated)return lastDraft;
 }
 if(!lastDraft)throw Error('fallback_catalog');
 return {...lastDraft,source:'Biblioteca revisada · propuesta ya utilizada'};
}
const photoThemes={
 'Animales':'Dibuja también un animal en el papel de control.',
 'Naturaleza':'Dibuja también una hoja en el papel de control.',
 'Venezuela':'Dibuja una montaña y añade la palabra ANDINO en el papel de control.',
 'Comida y frutas':'Dibuja también una fruta en el papel de control.',
 'Palabras y lenguaje':'Escribe también una palabra que se lea igual al revés en el papel; por ejemplo, RADAR.',
 'Números y lógica':'Escribe también el resultado de 7 × 8 en el papel.'
};
function photoDraft(theme,difficulty){
 const n={'Fácil':2,'Media':3,'Difícil':4,'Muy difícil':5}[difficulty];if(!n)throw Error('difficulty');
 const objects=shuffle(['una taza','una cuchara','una media','un peine','un libro','una tapa de envase','una pinza de ropa','una esponja','un lápiz','un pañito de cocina']).slice(0,n);
 const b=new Uint32Array(1);crypto.getRandomValues(b);const control='RETO-'+String(1000+b[0]%9000);
 const conditions=[objects[0]+' a la izquierda de '+objects[1]];
 if(n>2)conditions.push(objects[2]+' debajo de '+objects[1]);
 if(n>3)conditions.push(objects[3]+' a la derecha de '+objects[1]);
 if(n>4)conditions.push(objects[4]+' encima de '+objects[1]);
 const extra=photoThemes[theme]||'';
 const question='📸 En una sola foto, sobre una mesa o el piso, reúne '+objects.join(', ')+'.\n\nLas posiciones se leen en la imagen, sin apilar objetos. Coloca:\n'+conditions.map((c,i)=>(i+1)+'. '+c+'.').join('\n')+'\n\nDeja los objetos separados y visibles. Incluye al lado un papel que diga '+control+'. '+extra+'\nNo incluyas personas ni datos privados.';
 const criteria='Deben verse los '+n+' objetos, el papel con '+control+' y estas posiciones: '+conditions.join('; ')+'. '+extra;
 return {question,answer:criteria,explanation:'Revisión manual: '+criteria+' Encima y debajo indican posiciones en la imagen, sin apilar objetos. El papel no cuenta entre los '+n+' objetos.',source:'Foto con criterios revisados · respaldo'};
}
export function reviewedFallback(type,theme,difficulty,previous=[]){
 if(type==='Foto en casa')return photoDraft(theme,difficulty);
 if(type==='Adivinanza'&&theme==='Números y lógica')return numberRiddle(theme,difficulty,previous);
 if(type==='Adivinanza'||type==='Trivia')return bankDraft(type,theme,difficulty,previous);
 return null;
}
export const fallbackThemes=['','Cultura general',...Object.keys(BANK)];
