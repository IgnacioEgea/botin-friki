// Tarea diaria de Botín Friki: busca anuncios nuevos de figuras, extrae los datos con
// Workers AI (Cloudflare) y los añade a src/data/lanzamientos.json tras validarlos.
// Sin dependencias: Node 22 (fetch integrado).
//
// Variables de entorno (secretos de GitHub):
//   CF_ACCOUNT_ID  -> ID de la cuenta de Cloudflare
//   CF_API_TOKEN   -> token con permiso solo para Workers AI
// Sin ellas, el script actualiza la fecha de revisión y termina sin llamar a la IA.

import { readFile, writeFile } from 'node:fs/promises';

const RUTA_DATOS = new URL('../src/data/lanzamientos.json', import.meta.url);
const RUTA_FUENTES = new URL('./fuentes.json', import.meta.url);
const MODELO = '@cf/meta/llama-3.1-8b-instruct';
const MAX_ARTICULOS = 12; // límite por ejecución para no gastar de más
const AGENTE = 'BotinFrikiBot/1.0 (+https://botin-friki.pages.dev/es/como-elegimos/)';

const MESES_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const hoy = new Date();
const hoyISO = hoy.toISOString().slice(0, 10);
const mesActual = hoyISO.slice(0, 7);
const limite = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 18, 1)).toISOString().slice(0, 7);

const log = (...m) => console.log('[botin]', ...m);

// ---------- RSS ----------
const sinHtml = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ').trim();

const etiqueta = (xml, nombre) => {
  const m = xml.match(new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)<\\/${nombre}>`, 'i'));
  return m ? m[1] : '';
};

async function leerFuente(fuente) {
  const r = await fetch(fuente.rss, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => {
    const item = m[1];
    const texto = sinHtml(etiqueta(item, 'content:encoded') || etiqueta(item, 'description'));
    return {
      titulo: sinHtml(etiqueta(item, 'title')),
      enlace: sinHtml(etiqueta(item, 'link')),
      texto: texto.slice(0, 6000),
    };
  });
}

// ---------- IA ----------
const INSTRUCCIONES = `Extract collectible figure releases from the article. Answer ONLY with JSON:
{"figuras":[{"nombre":"","serie":"","linea":"","marca":"Banpresto|Bandai Spirits","tamano_cm":null,"fecha":"YYYY-MM or YYYY-MM-DD"}]}
Rules: include a figure only if the article explicitly states its release month and year. Use names exactly as written in the article. "linea" is the product line (e.g. Grandista, Q posket, Ichiban Kuji). tamano_cm is a number only if the article states the size in cm, else null. If nothing qualifies, answer {"figuras":[]}.`;

async function extraer(articulo) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${MODELO}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: INSTRUCCIONES },
        { role: 'user', content: `TITLE: ${articulo.titulo}\n\nARTICLE: ${articulo.texto}` },
      ],
      max_tokens: 700,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error(`Workers AI HTTP ${r.status}`);
  const datos = await r.json();
  const respuesta = String(datos?.result?.response ?? '');
  const json = respuesta.match(/\{[\s\S]*\}/);
  if (!json) return [];
  try {
    const obj = JSON.parse(json[0]);
    return Array.isArray(obj.figuras) ? obj.figuras : [];
  } catch {
    return [];
  }
}

// ---------- Validación: todo lo que se guarda tiene que estar en el texto original ----------
function validar(f, articulo) {
  const texto = `${articulo.titulo} ${articulo.texto}`.toLowerCase();
  const nombre = String(f.nombre ?? '').trim();
  const serie = String(f.serie ?? '').trim();
  const linea = String(f.linea ?? '').trim();
  const fecha = String(f.fecha ?? '').trim();
  if (!nombre || !serie || nombre.length > 90) return 'faltan nombre o serie';
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(fecha)) return 'fecha con formato no válido';
  if (fecha.slice(0, 7) < mesActual || fecha.slice(0, 7) > limite) return 'fecha fuera de rango';

  // El mes y el año tienen que aparecer en el artículo.
  const anio = fecha.slice(0, 4);
  const mesEn = MESES_EN[Number(fecha.slice(5, 7)) - 1];
  if (!texto.includes(anio) || !(texto.includes(mesEn) || texto.includes(fecha.slice(0, 7)))) return 'la fecha no aparece en el texto';

  // La mayoría de las palabras del nombre y de la serie tienen que estar en el artículo.
  const cubre = (s) => {
    const palabras = s.toLowerCase().split(/[^a-z0-9áéíóúñ×]+/i).filter((p) => p.length >= 3);
    if (palabras.length === 0) return false;
    return palabras.filter((p) => texto.includes(p)).length / palabras.length >= 0.7;
  };
  if (!cubre(nombre)) return 'el nombre no aparece en el texto';
  if (!cubre(serie)) return 'la serie no aparece en el texto';

  let tamano = 'Tamaño por confirmar';
  if (typeof f.tamano_cm === 'number' && f.tamano_cm > 2 && f.tamano_cm < 100) {
    if (new RegExp(`${f.tamano_cm}\\s?cm`).test(texto)) tamano = `Unos ${f.tamano_cm} cm de alto`;
  }
  const marca = /bandai spirits/i.test(String(f.marca)) && !/banpresto/i.test(linea) ? 'Bandai Spirits' : 'Banpresto';

  return {
    fecha,
    nombre,
    linea: linea || 'Por confirmar',
    marca,
    serie,
    tamano,
    nota: 'Añadida automáticamente a partir del anuncio enlazado.',
    fuente: articulo.enlace,
    url: null,
    auto: true,
  };
}

// ---------- Principal ----------
const datos = JSON.parse(await readFile(RUTA_DATOS, 'utf8'));
const config = JSON.parse(await readFile(RUTA_FUENTES, 'utf8'));
const fuentesConocidas = new Set(datos.lanzamientos.map((l) => l.fuente));
const clave = (l) => `${l.nombre.toLowerCase()}|${l.fecha.slice(0, 7)}`;
const yaEsta = new Set(datos.lanzamientos.map(clave));
let anadidas = 0;

if (!process.env.CF_ACCOUNT_ID || !process.env.CF_API_TOKEN) {
  log('Sin credenciales de Cloudflare: solo se actualiza la fecha de revisión.');
} else {
  const candidatos = [];
  for (const fuente of config.fuentes) {
    try {
      const items = await leerFuente(fuente);
      const relevantes = items.filter((a) =>
        a.enlace && !fuentesConocidas.has(a.enlace) &&
        config.palabrasClave.some((p) => `${a.titulo} ${a.texto}`.toLowerCase().includes(p)));
      log(`${fuente.nombre}: ${items.length} artículos, ${relevantes.length} nuevos y relevantes`);
      candidatos.push(...relevantes);
    } catch (e) {
      log(`${fuente.nombre}: no se pudo leer (${e.message})`);
    }
  }

  for (const articulo of candidatos.slice(0, MAX_ARTICULOS)) {
    try {
      const figuras = await extraer(articulo);
      for (const f of figuras) {
        const r = validar(f, articulo);
        if (typeof r === 'string') {
          log(`Descartada "${f?.nombre ?? '?'}": ${r}`);
          continue;
        }
        if (yaEsta.has(clave(r))) continue;
        datos.lanzamientos.push(r);
        yaEsta.add(clave(r));
        anadidas++;
        log(`Añadida: ${r.nombre} (${r.serie}, ${r.fecha})`);
      }
    } catch (e) {
      log(`Error con ${articulo.enlace}: ${e.message}`);
    }
  }
}

datos.lanzamientos.sort((a, b) => a.fecha.localeCompare(b.fecha));
datos.actualizado = hoyISO;
await writeFile(RUTA_DATOS, JSON.stringify(datos, null, 2) + '\n');
log(`Listo: ${anadidas} figuras nuevas. Revisión del ${hoyISO}.`);
