const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { File } = require('node:buffer');

const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const start = source.indexOf('function limpiarNombreArchivo(nombre) {');
const end = source.indexOf('function nombreCartonWebP(numero) {', start);
assert(start >= 0 && end > start);
const isolated = source.slice(start, end);

function contexto(overrides = {}) {
  const alerts = [];
  const ctx = {
    File,
    Uint8Array,
    Number,
    Date,
    String,
    Math,
    Image: class {},
    document: { getElementById: () => null },
    URL: { createObjectURL: () => 'blob:prueba', revokeObjectURL: () => {} },
    console: { warn() {}, log() {} },
    alert: texto => alerts.push(texto),
    setTimeout: callback => { queueMicrotask(callback); return 1; },
    ...overrides
  };
  vm.createContext(ctx);
  vm.runInContext(isolated, ctx);
  return { ctx, alerts };
}
const imagen = (bytes, tipo = 'image/jpeg') => new File([Uint8Array.from(bytes)], 'captura.jpg', { type: tipo });

test('JPG válido se acepta como original cuando un Android no logra decodificarlo', async () => {
  const { ctx, alerts } = contexto();
  ctx.convertirImagenAWebP = async () => { throw Error('Decodificador bloqueado'); };
  ctx.verificarImagenGenerada = async () => { throw Error('No se pudo leer la imagen seleccionada'); };
  const jpg = imagen([255,216,255,224,1,2,3,4,5]);
  const r = await ctx.prepararComprobanteSeguro(jpg);
  assert.equal(r.archivo, jpg);
  assert.equal(r.extension, 'jpg');
  assert.equal(r.contentType, 'image/jpeg');
  assert.equal(r.requiereRevisionVisual, true);
  assert.match(alerts[0], /revisión manual/);
});

test('cabecera PNG conocida corrige metadatos MIME antes de enviar', async () => {
  const { ctx } = contexto();
  const png = imagen([137,80,78,71,13,10,26,10,0,0,0,0], 'application/octet-stream');
  const formato = await ctx.identificarFormatoComprobante(png);
  assert.equal(formato.contentType, 'image/png');
  ctx.convertirImagenAWebP = async () => { throw Error('Conversión'); };
  ctx.verificarImagenGenerada = async () => { throw Error('Sin lector'); };
  const r = await ctx.prepararComprobanteSeguro(png);
  assert.equal(r.extension, 'png');
  assert.equal(r.archivo.type, 'image/png');
});

test('archivo desconocido o vacío no llega a subida', async () => {
  const { ctx } = contexto();
  await assert.rejects(ctx.identificarFormatoComprobante(imagen([0,1,2,3,4], 'image/jpeg')), /no es un JPG/);
  await assert.rejects(ctx.identificarFormatoComprobante(imagen([])), /vacía/);
});

test('imagen detectada completamente blanca o negra se rechaza', async () => {
  const { ctx } = contexto();
  ctx.convertirImagenAWebP = async () => { throw Error('Falló WebP'); };
  ctx.verificarImagenGenerada = async () => ({ valida: false, motivo: 'La imagen quedó prácticamente blanca' });
  await assert.rejects(ctx.prepararComprobanteSeguro(imagen([255,216,255,1,2,3])), /quedó en blanco/);
});

test('si falla blob: pero funciona data:, puede abrir una captura en Android', async () => {
  let revocadas = 0;
  class Imagen {
    constructor() { this.naturalWidth = 0; this.naturalHeight = 0; }
    set src(valor) {
      queueMicrotask(() => {
        if (valor.startsWith('data:')) {
          this.naturalWidth = 400; this.naturalHeight = 900; this.onload();
        } else { this.onerror(); }
      });
    }
  }
  class Lector {
    readAsDataURL() {
      queueMicrotask(() => { this.result = 'data:image/jpeg;base64,/9g='; this.onload(); });
    }
  }
  const { ctx } = contexto({
    Image: Imagen,
    FileReader: Lector,
    URL: { createObjectURL: () => 'blob:fallido', revokeObjectURL: () => { revocadas++; } }
  });
  const salida = await ctx.crearFuenteImagen(imagen([255,216,255,1]));
  assert.equal(salida.width, 400);
  assert.equal(salida.height, 900);
  assert.equal(revocadas, 1);
  salida.liberar();
});


test('la captura se conserva en memoria aunque Android cierre luego su permiso', async () => {
  let lecturas = 0;
  const bytes = Uint8Array.from([255,216,255,224,1,2,3,4,5,6]);
  const original = {
    name:'pago.jpg', type:'image/jpeg', size:bytes.length, lastModified:123,
    async arrayBuffer(){
      if(++lecturas > 1) throw Object.assign(new Error('The requested file could not be read'),{name:'NotReadableError'});
      return bytes.slice().buffer;
    }
  };
  const estado = {textContent:''}, cambiar={hidden:true};
  const input = { files:[original], value:'pago.jpg', addEventListener(tipo,fn){this.listener=fn;} };
  const document = {getElementById:id=>({comprobante:input,'comprobante-estado':estado,btnCambiarComprobante:cambiar})[id]};
  const {ctx} = contexto({document});
  input.listener({target:input});
  const copia = await ctx.obtenerComprobanteSeguro();
  assert.equal(lecturas,1);
  assert.equal(copia.type,'image/jpeg');
  assert.equal(copia.size,bytes.length);
  assert.deepEqual(Array.from(new Uint8Array(await copia.arrayBuffer())),Array.from(bytes));
  assert.match(estado.textContent,/Captura lista/);
  assert.equal(cambiar.hidden,true);
});

test('un permiso de Android revocado se comunica en español y permite elegir otra captura', async () => {
  const errorOriginal=Object.assign(new Error('The requested file could not be read, typically due to permission problems'),{name:'NotReadableError'});
  const archivo={
    name:'pago.jpg',type:'image/jpeg',size:8,
    async arrayBuffer(){throw errorOriginal;},
    slice(){return {arrayBuffer:async()=>{throw errorOriginal;}};}
  };
  class Lector {
    readAsArrayBuffer(){queueMicrotask(()=>{this.error=errorOriginal;this.onerror();});}
  }
  const estado={textContent:''},cambiar={hidden:true};
  const entrada={files:[archivo],value:'pago.jpg',addEventListener(_tipo,fn){this.listener=fn;}};
  const document={getElementById:id=>({comprobante:entrada,'comprobante-estado':estado,btnCambiarComprobante:cambiar})[id]};
  const {ctx}=contexto({document,FileReader:Lector});
  entrada.listener({target:entrada});
  await assert.rejects(ctx.obtenerComprobanteSeguro(),/Tu teléfono no permitió leer/);
  await Promise.resolve();
  assert.equal(entrada.value,'');
  assert.equal(cambiar.hidden,false);
  assert.match(estado.textContent,/Elegir otra captura/);
  assert.equal(estado.textContent.includes('The requested file'),false);
});

test('si el permiso falla al validar la firma, tampoco muestra errores técnicos en inglés', async () => {
  const error=Object.assign(new Error('The requested file could not be read'),{name:'NotReadableError'});
  const archivo={size:8, slice:()=>({arrayBuffer:async()=>{throw error;}})};
  class Lector {
    readAsArrayBuffer(){queueMicrotask(()=>{this.error=error;this.onerror();});}
  }
  const {ctx}=contexto({FileReader:Lector});
  await assert.rejects(ctx.identificarFormatoComprobante(archivo),/Tu teléfono no permitió leer/);
});

test('si Blob.arrayBuffer falla pero FileReader funciona, se conserva la imagen', async () => {
  const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3,4]);
  const archivo={name:'pago.png',type:'image/png',size:bytes.length,lastModified:123,
    async arrayBuffer(){throw Error('fallo Blob.arrayBuffer');}};
  class Lector {
    readAsArrayBuffer(){queueMicrotask(()=>{this.result=bytes.slice().buffer;this.onload();});}
  }
  const {ctx}=contexto({FileReader:Lector});
  const copia=await ctx.copiarComprobanteLegible(archivo);
  assert.equal(copia.size,bytes.length);
  assert.equal(copia.type,'image/png');
});
