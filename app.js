/* DOPA · app
 * Web app para iPhone. Todo se guarda en el propio dispositivo (localStorage)
 * y, si lo conectas, se copia en tu Google Sheets con Apps Script.
 */
'use strict';
const VERSION = '1.1.0';

/* =====================================================================
   utilidades
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const hoyStr = () => ymd(new Date());
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = s => { const d = parseYmd(s); return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; };
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const minus = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const mmss = ms => { ms = Math.max(0, ms); const t = Math.ceil(ms / 1000); return pad(Math.floor(t / 60)) + ':' + pad(t % 60); };
const minTxt = m => { m = Math.round(m); return m >= 60 ? (Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + m % 60 + ' min' : '')) : m + ' min'; };
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const horaMin = s => { const [h, m] = (s || '00:00').split(':').map(Number); return h * 60 + m; };
const ahoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
const NUMTXT = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
function rnd(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/* =====================================================================
   estado
   ===================================================================== */
const NIVELES = [
  { n: 'Nuclear', d: 'Solo lo básico.', c: 'var(--n)', hex: '#5FC9A2' },
  { n: 'Estándar', d: 'Un día normal.', c: 'var(--s)', hex: '#FFB23A' },
  { n: 'Óptimo', d: 'Con energía de sobra.', c: 'var(--o)', hex: '#F2705E' }];
const COL = { n: '#5FC9A2', s: '#FFB23A', o: '#F2705E', acc: '#1F86AA', ink: '#1F2E35', cream: '#FFF5E8', hot: '#D2533F' };
const PROY_COL = ['#5FC9A2', '#FFB23A', '#F2705E', '#1F86AA', '#9B8AF0', '#E9A6C4'];
const TERMO = [COL.n, COL.n, COL.n, COL.s, COL.s, COL.o, COL.o, COL.hot, COL.hot, COL.hot];

const RUT_DEF = () => ({
  manana: [
    { id: 'm1', txt: 'Beber un vaso de agua', niv: 0 },
    { id: 'm2', txt: 'Mirar mis cosas de hoy', niv: 0 },
    { id: 'm3', txt: 'Ducha', niv: 1 },
    { id: 'm4', txt: 'Desayunar algo con proteína', niv: 1 },
    { id: 'm5', txt: 'Salir a la calle diez minutos', niv: 2 }],
  noche: [
    { id: 'n1', txt: 'Bajar la luz', niv: 0, sec: 0 },
    { id: 'n2', txt: 'Dejar listo lo de mañana', niv: 1, sec: 0 },
    { id: 'n3', txt: 'Apuntar lo que me ronda', niv: 0, sec: 1, acc: 'captura' },
    { id: 'n4', txt: 'Leer en papel', niv: 1, sec: 2 },
    { id: 'n5', txt: 'Respiración coherente 5-5', niv: 2, sec: 2, acc: 'resp55' }]
});
const PREMIOS_DEF = () => [
  { id: 'p1', txt: 'Un café fuera', para: 'Para tareas largas' },
  { id: 'p2', txt: 'Un capítulo de una serie', para: 'Al final del día' },
  { id: 'p3', txt: 'Diez minutos de música', para: 'Para cualquier tarea' },
  { id: 'p4', txt: 'Un paseo corto', para: 'Entre tareas' }];

const DEF = () => ({
  v: 2, onb: false,
  aj: { nombre: '', niv: [1, 3, 5], dur: 5, cuenta: true, sonido: true, aviso: 5, checkins: true, resp: '478', limP: 3,
        hCierre: '21:00', hPant: '23:00', tema: 'auto', url: '', clave: '', ultCopia: null, copiaError: false,
        hiper: { que: ['agua', 'estirar', 'lejos'], cada: 45, salida: '' } },
  dias: {}, cosas: [], proy: [], arr: [], pau: [], diario: [], guiones: [],
  rut: RUT_DEF(), premios: PREMIOS_DEF(), rev: [],
  ui: { gcat: 'Todos', semana: 0 }
});
function migrar(x) {
  if (!x.v || x.v < 2) {
    Object.values(x.dias || {}).forEach(d => { (d.piezas || []).forEach(p => { if (p.t === 'sol') p.t = 'anillo'; }); delete d.ritual; });
    (x.arr || []).forEach(a => { if (a.hecha == null) a.hecha = null; });
    if (x.aj && x.aj.resp === '46') x.aj.resp = '46';
    x.v = 2;
  }
  return x;
}
let S;
try {
  const raw = migrar(JSON.parse(localStorage.getItem('dopa') || '{}'));
  S = Object.assign(DEF(), raw); S.aj = Object.assign(DEF().aj, raw.aj || {}); S.aj.hiper = Object.assign(DEF().aj.hiper, (raw.aj || {}).hiper || {});
  S.ui = Object.assign(DEF().ui, raw.ui || {});
} catch (e) { S = DEF(); }
function save() { try { localStorage.setItem('dopa', JSON.stringify(S)); } catch (e) {} }
save();

/* deshacer / rehacer */
let PILA = [], REHACER = [];
function commit(fn, aviso, conDeshacer = true, sinRefresh = false) {
  PILA.push(JSON.stringify(S)); if (PILA.length > 30) PILA.shift(); REHACER = [];
  fn(); save(); if (!sinRefresh) refresh();
  if (aviso) toast(aviso, conDeshacer);
}
function deshacer() { if (!PILA.length) return; REHACER.push(JSON.stringify(S)); S = JSON.parse(PILA.pop()); save(); refresh(); toast('Deshecho'); }

/* acceso a datos */
function dia(f = hoyStr()) {
  if (!S.dias[f]) S.dias[f] = { nivel: null, sueno: null, piezas: [], mejor: '', cerrado: false, rutM: [], rutN: [], checks: [] };
  const d = S.dias[f]; d.rutM = d.rutM || []; d.rutN = d.rutN || []; d.checks = d.checks || []; return d;
}
const nivelHoy = () => (S.dias[hoyStr()] || {}).nivel;
const capHoy = () => { const n = nivelHoy(); return n == null ? 3 : S.aj.niv[n]; };
const cosasHoy = () => S.cosas.filter(c => c.hoy === hoyStr());
const pendHoy = () => cosasHoy().filter(c => !c.hecha);
const hechasHoy = () => cosasHoy().filter(c => c.hecha).sort((a, b) => b.hecha - a.hecha);
const huecos = () => Math.max(0, capHoy() - cosasHoy().length);
const luego = () => S.cosas.filter(c => !c.hecha && c.hoy !== hoyStr() && !(c.hoy && c.hoy > hoyStr()));
const proyAbiertos = () => S.proy.filter(p => p.abierto);
const proyDe = id => S.proy.find(p => p.id === id);
const cosa = id => S.cosas.find(x => x.id === id);
function pieza(t, ref) { dia().piezas.push({ t, ts: Date.now(), ref: ref || null }); }
function quitarPieza(t, ref) { const d = dia(), k = d.piezas.findIndex(p => p.t === t && p.ref === ref); if (k >= 0) d.piezas.splice(k, 1); }
/* calibrador: mediana de real/estimado de las tareas terminadas */
function medidas() { return S.arr.filter(a => a.est && a.real && a.hecha); }
function factor() {
  const xs = medidas().slice(-10).map(a => a.real / a.est).sort((a, b) => a - b);
  if (xs.length < 3) return 1;
  const m = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
  return Math.round(Math.min(3, Math.max(.7, m)) * 10) / 10;
}
const conFactor = m => Math.round(m * factor());
const fx = f => String(f).replace('.', ',');
const totalHoy = () => pendHoy().reduce((a, c) => a + (c.est ? conFactor(c.est) : 0), 0);
const sinEst = () => pendHoy().filter(c => !c.est).length;

/* =====================================================================
   dibujos: piezas e iconos
   ===================================================================== */
let _g = 0;
const LEAF = 'M0 -50 C27 -34 33 -6 23 22 C17 38 7 47 0 52 C-7 47 -19 37 -25 19 C-33 -7 -24 -34 0 -50Z';
const leafG = (cx, cy, s, r, fill) => `<g transform="translate(${cx} ${cy}) rotate(${r}) scale(${s})"><path d="${LEAF}" fill="${fill}"/></g>`;
const semiG = (cx, cy, r, fill, rot = 0) => `<path d="M${cx - r} ${cy + r * .35} A${r} ${r} 0 0 1 ${cx + r} ${cy + r * .35}Z" fill="${fill}" transform="rotate(${rot} ${cx} ${cy})"/>`;
const ringG = (cx, cy, r, w, c) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
const svg = (w, h, b, extra = '') => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${extra}>${b}</svg>`;

/* las cuatro piezas: cada una significa siempre lo mismo */
const P = {
  hoja: (s = 20, c = COL.acc, r = 30) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><g transform="translate(20 20) rotate(${r}) scale(.36)"><path d="${LEAF}" fill="${c}"/></g></svg>`,
  anillo: (s = 20, c = COL.o) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="13" fill="none" stroke="${c}" stroke-width="7"/></svg>`,
  pausa: (s = 20, c = COL.n) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><path d="M5 27 A15 15 0 0 1 35 27Z" fill="${c}"/></svg>`
};
function nivelIcon(i, s = 36, c = '#1F2E35') {
  const id = 'nv' + (++_g), f = [1 / 3, 2 / 3, 1][i], h = 30 * f;
  return `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><defs><clipPath id="${id}"><circle cx="20" cy="20" r="15"/></clipPath></defs><circle cx="20" cy="20" r="14" fill="none" stroke="${c}" stroke-width="2.6"/><rect x="5" y="${35 - h}" width="30" height="${h}" fill="${c}" clip-path="url(#${id})"/></svg>`;
}
/* círculo de nivel con líquido (para animarlo) */
function nivelLiquido(i, s, f0) {
  const id = 'lq' + (++_g);
  return `<svg width="${s}" height="${s}" viewBox="0 0 40 40" class="lq" data-i="${i}"><defs><clipPath id="${id}"><circle cx="20" cy="20" r="15"/></clipPath></defs><circle cx="20" cy="20" r="14" fill="none" stroke="#1F2E35" stroke-width="2.6"/><path class="wave" d="${onda(f0, 0, 0)}" fill="#1F2E35" clip-path="url(#${id})"/></svg>`;
}
function onda(f, a, ph) { let d = 'M0 40'; for (let x = 0; x <= 40; x += 2) d += ` L${x} ${(35 - 30 * f + a * Math.sin(x / 40 * Math.PI * 3 + ph)).toFixed(2)}`; return d + ' L40 40Z'; }

/* iconos de línea (todo lo que no es una pieza) */
const LP = {
  ajustes: '<path d="M4 8h16M4 16h16"/><circle cx="9" cy="8" r="2.4" fill="var(--bg)"/><circle cx="15" cy="16" r="2.4" fill="var(--bg)"/>',
  semaforo: '<rect x="8" y="2.5" width="8" height="19" rx="4"/><circle cx="12" cy="7" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="17" r="1.6"/>',
  lapiz: '<path d="M15.5 4.5l4 4L9 19H5v-4z"/><path d="M13 7l4 4"/>',
  bocadillo: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V16h.5A2.5 2.5 0 0 1 4 13.5z"/>',
  crono: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18 6.5l1.3-1.3"/>',
  carpeta: '<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2h8A1.5 1.5 0 0 1 20.5 9v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  cama: '<path d="M3 18V7M3 14h18v4M21 14v-2.5A2.5 2.5 0 0 0 18.5 9H11v5"/><circle cx="7" cy="11" r="1.8"/>',
  regalo: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9C10 5 6.5 5.5 7.5 8M12 9c2-4 5.5-3.5 4.5-1"/>',
  capas: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5"/><path d="M3.5 16.5L12 21l8.5-4.5"/>',
  dado: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/><circle cx="9" cy="15" r="1.1" fill="currentColor"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  calendario: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  pasos: '<path d="M5 19h4v-4h4v-4h4V7h3"/>',
  pausar: '<rect x="7" y="5" width="3.2" height="14" rx="1"/><rect x="13.8" y="5" width="3.2" height="14" rx="1"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  agua: '<path d="M12 3.5c3.5 4.5 6 7.5 6 10.5a6 6 0 0 1-12 0c0-3 2.5-6 6-10.5z"/>',
  estirar: '<circle cx="12" cy="5" r="1.8"/><path d="M5 9l7 1.5L19 9M12 10.5V15l-3 5M12 15l3 5"/>',
  comer: '<path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7M9 3v7M16 21V3c2 1 3 4 3 7h-3"/>',
  ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  bano: '<path d="M5 12h14v1.5A5.5 5.5 0 0 1 13.5 19h-3A5.5 5.5 0 0 1 5 13.5zM7 12V6a2 2 0 0 1 4 0"/>',
  trabajo: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12.5h17"/>',
  casa: '<path d="M4 11l8-6.5 8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>',
  corazon: '<path d="M12 19.5s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10z"/>',
  personas: '<circle cx="9" cy="8.5" r="3"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14.5 15.2a4.5 4.5 0 0 1 6 3.8"/>',
  ola: '<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>',
  olvido: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16v.5"/>',
  estrella: '<path d="M12 3.8l2.4 5 5.4.6-4 3.7 1.1 5.4L12 15.8l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
  altavoz: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  campana: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  flecha: '<path d="M5 12h13M13 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  ayuda: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2.9-1.2 1.7M12 16.5v.5"/>',
  atras: '<path d="M14.5 5l-7 7 7 7"/>',
  sig: '<path d="M9.5 5l7 7-7 7"/>',
  abajo: '<path d="M6 9.5l6 6 6-6"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  enchufe: '<path d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0zM12 16.5V21"/>',
  movil: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  copia: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  papelera: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  grafico: '<path d="M5 19V13M10 19V8M15 19v-6M20 19V5"/>'
};
const ic = (k, s = 22, w = 1.7) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${LP[k] || ''}</svg>`;

function tabIcon(k, on) {
  if (k === 'hoy') return on ? nivelIcon(nivelHoy() == null ? 1 : nivelHoy(), 26, 'currentColor') : `<svg width="26" height="26" viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M6 24h28" stroke="currentColor" stroke-width="2.6"/></svg>`;
  if (k === 'arrancar') return `<svg width="26" height="26" viewBox="0 0 40 40"><circle cx="20" cy="20" r="13" fill="none" stroke="${on ? COL.o : 'currentColor'}" stroke-width="${on ? 7 : 2.8}"/></svg>`;
  if (k === 'pausa') return `<svg width="26" height="26" viewBox="0 0 40 40"><path d="M5 27 A15 15 0 0 1 35 27Z" fill="${on ? COL.n : 'none'}" stroke="${on ? COL.n : 'currentColor'}" stroke-width="2.6" stroke-linejoin="round"/></svg>`;
  return `<span style="color:${on ? COL.acc : 'currentColor'}">${ic('grafico', 26, on ? 2.6 : 1.7)}</span>`;
}

/* collage del día: cada pieza en su hueco, sin cortarse */
function collagePiezas(piezas, w = 255, h = 150, seed = 'x') {
  const r = rnd(seed), cells = [], ps = piezas.slice(0, 15);
  const n = ps.length, cols = n <= 4 ? 3 : n <= 8 ? 4 : 5, rows = Math.max(2, Math.ceil(n / cols));
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push([(x + .5) * w / cols, (y + .5) * h / rows]);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const sz = Math.min(1, 2.6 / rows, 3.6 / cols);
  return ps.map((p, i) => {
    const [cx0, cy0] = cells[i], cx = cx0 + (r() - .5) * 18 * sz, cy = cy0 + (r() - .5) * 12 * sz, rot = Math.round((r() - .5) * 80);
    let inner;
    if (p.t === 'hoja') inner = `<g transform="scale(${(.56 * sz).toFixed(3)})"><path d="${LEAF}" fill="${COL.acc}"/></g>`;
    else if (p.t === 'anillo') { const rr = (16 + r() * 10) * sz; inner = `<circle r="${rr.toFixed(1)}" fill="none" stroke="${COL.o}" stroke-width="${(rr * .52).toFixed(1)}"/>`; }
    else { const rr = 30 * sz; inner = `<path d="M${-rr} ${rr * .35} A${rr} ${rr} 0 0 1 ${rr} ${rr * .35}Z" fill="${COL.n}"/>`; }
    return { x: +cx.toFixed(1), y: +cy.toFixed(1), rot, inner };
  });
}
function collageSvg(piezas, w = 255, h = 150, seed = 'x', id = '') {
  const ps = collagePiezas(piezas, w, h, seed);
  const b = ps.map((p, i) => `<g class="cp" data-i="${i}" data-x="${p.x}" data-y="${p.y}" data-r="${p.rot}" transform="translate(${p.x} ${p.y}) rotate(${p.rot})">${p.inner}</g>`).join('');
  return `<svg ${id ? `id="${id}"` : ''} width="100%" viewBox="0 0 ${w} ${h}" style="overflow:visible;display:block">${b || `<text x="${w / 2}" y="${h / 2 + 5}" text-anchor="middle" font-size="14" fill="#1F2E35" opacity=".65">Todavía no hay piezas hoy</text>`}</svg>`;
}

/* =====================================================================
   animación: muelles (spring) con Web Animations
   ===================================================================== */
function muelle(t, w = 14, z = 7) { return t <= 0 ? 0 : 1 - Math.exp(-z * t) * Math.cos(w * t); }
/* devuelve keyframes de un valor de a → b siguiendo un muelle */
function kfMuelle(fn, { w = 14, z = 7, n = 36 } = {}) {
  const T = Math.min(1.6, 5.5 / z), out = [];
  for (let i = 0; i <= n; i++) { const t = T * i / n; out.push(fn(i === n ? 1 : muelle(t, w, z), i / n)); }
  return { kf: out, dur: T * 1000 };
}
function animar(el, fn, op = {}) {
  if (!el || !el.animate) return null;
  if (reduceMotion()) { const f = fn(1, 1); return el.animate([{ opacity: 0 }, Object.assign({}, f, { opacity: f.opacity == null ? 1 : f.opacity })], { duration: 220, fill: op.fill || 'none' }); }
  const { kf, dur } = kfMuelle(fn, op);
  return el.animate(kf, { duration: dur, delay: op.delay || 0, easing: 'linear', fill: op.fill || 'backwards' });
}
const espera = ms => new Promise(r => setTimeout(r, ms));

/* =====================================================================
   navegación
   ===================================================================== */
const TABS = ['hoy', 'arrancar', 'pausa', 'patrones'];
const PANT_COLOR = { cuenta: 'acc', ahora: 'acc', respirar: 'n', noche: 'dark' };
let ACT = null, HIST = [], ZOOM = {};
function el(name) {
  let s = document.getElementById('s-' + name);
  if (!s) { s = document.createElement('section'); s.className = 'scr'; s.id = 's-' + name; $('#screens').appendChild(s); }
  return s;
}
function render(name) {
  const s = el(name); if (R[name]) s.innerHTML = R[name]();
  s.classList.toggle('nightmode', name === 'noche');
  if (A_RENDER[name]) A_RENDER[name](s);
}
function go(name, modo = 'push', sinHist = false, desde = null) {
  if (name === ACT) { render(name); return; }
  cerrarHoja(true); cerrarPop();
  const prevName = ACT, prev = ACT ? el(ACT) : null;
  if (ACT && !sinHist && modo !== 'tab') HIST.push(ACT);
  if (modo === 'tab') HIST = [];
  if (A_SALIR[prevName]) A_SALIR[prevName]();
  ACT = name; render(name);
  const s = el(name);
  s.classList.add('on');
  if (prev) {
    prev.classList.add('saliendo');
    const fn = modo === 'back' ? (v => ({ opacity: 1 - v, transform: `translateX(${v * 30}px)` }))
      : modo === 'push' ? (v => ({ opacity: 1 - v, transform: `translateX(${-v * 24}px)` }))
      : (v => ({ opacity: 1 - v }));
    const a = reduceMotion() ? prev.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 })
      : prev.animate([fn(0), fn(1)], { duration: modo === 'zoom' ? 380 : 260, easing: 'ease' });
    const pn = prev;
    a.onfinish = () => { if ('s-' + ACT !== pn.id) pn.classList.remove('on'); pn.classList.remove('saliendo'); };
  }
  entrar(s, modo, desde, name);
  const tb = $('#tabbar'); tb.hidden = false;
  tb.classList.toggle('hide', !TABS.includes(name));
  tb.querySelectorAll('button').forEach(b => { const on = b.dataset.x === name; b.classList.toggle('on', on); b.querySelector('.ti').innerHTML = tabIcon(b.dataset.x, on); });
  themeColor(name);
}
function entrar(s, modo, desde, name) {
  if (reduceMotion()) { s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 }); return; }
  if (modo === 'zoom' && desde) {
    const a = $('#app').getBoundingClientRect(), r = desde.getBoundingClientRect();
    const ins = [r.top - a.top, a.right - r.right, a.bottom - r.bottom, r.left - a.left].map(v => Math.max(0, v));
    ZOOM[name] = ins;
    animar(s, v => ({ clipPath: `inset(${ins.map(x => (x * (1 - v)).toFixed(1) + 'px').join(' ')} round ${(24 * (1 - v)).toFixed(1)}px)` }), { w: 12, z: 9 });
    const b = s.querySelector('.col'); if (b) animar(b, v => ({ opacity: Math.min(1, v * 1.4), transform: `scale(${.96 + .04 * v})` }), { w: 12, z: 9 });
    return;
  }
  const fn = modo === 'back' ? (v => ({ opacity: Math.min(1, v * 1.6), transform: `translateX(${(1 - v) * -36}px)` }))
    : modo === 'push' ? (v => ({ opacity: Math.min(1, v * 1.6), transform: `translateX(${(1 - v) * 44}px)` }))
    : (v => ({ opacity: Math.min(1, v * 1.4), transform: `translateY(${(1 - v) * 14}px)` }));
  animar(s, fn, { w: 13, z: 8 });
}
function atras() {
  const p = HIST.pop() || 'hoy', cur = ACT, ins = ZOOM[cur];
  if (ins && !reduceMotion()) {
    const s = el(cur); delete ZOOM[cur];
    s.style.zIndex = 5;
    const a = s.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: `inset(${ins.map(x => x + 'px').join(' ')} round 24px)`, opacity: .3 }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)' });
    a.onfinish = () => { s.style.zIndex = ''; };
    go(p, 'fade', true);
    return;
  }
  go(p, 'back', true);
}
function refresh() {
  if (ACT) { const s = el(ACT), sc = s.querySelector('.body'), y = sc ? sc.scrollTop : 0; render(ACT); const sc2 = s.querySelector('.body'); if (sc2) sc2.scrollTop = y; }
  $('#tabbar').querySelectorAll('button').forEach(b => { b.querySelector('.ti').innerHTML = tabIcon(b.dataset.x, b.classList.contains('on')); });
}
const A_RENDER = {}, A_SALIR = {};

/* cabeceras */
const topTab = () => `<div class="top"><div class="l"></div><div class="r"><button class="ib" data-a="captura" aria-label="Apuntar rápido">${ic('mas', 23)}</button><button class="ib" data-a="ir" data-x="ajustes" aria-label="Ajustes">${ic('ajustes', 23)}</button></div></div>`;
const topBack = (txt = 'Atrás', right = '') => `<div class="top"><div class="l"><button class="back" data-a="atras">${ic('atras', 20, 2.2)}<span>${txt}</span></button></div><div class="r">${right}</div></div>`;
const topPlain = (right = '') => `<div class="top"><div class="l"></div><div class="r">${right}</div></div>`;

/* =====================================================================
   pantallas
   ===================================================================== */
const R = {};

/* ---------- Bienvenida: 9 pasos ---------- */
let ONB = 0, ONB_DIR = 1;
const ONB_N = 9;
R.bienvenida = () => {
  const ejemploHoy = `<div class="card sm demo"><div class="drow"><span class="ck0"></span>Preparar la clase<em>unos 25 min</em></div><div class="drow"><span class="ck0"></span>Pagar el recibo<em>unos 10 min</em></div><div class="drow"><span class="ck0"></span>Pasear 15 minutos<em>por la tarde</em></div></div>
    <div class="pillsd"><span>${ic('reloj', 16)} Más tarde · 6 cosas esperando</span></div>`;
  const pasos = [
    () => ['<div class="wmk">dopa</div>', 'Una app para el TDAH que se adapta a tu energía.',
      'Hay días que puedes con todo y días que no. Dopa te pregunta cada mañana cómo vienes y solo te pide lo que cabe ese día.',
      `<div class="mini">${[[nivelIcon(1, 28, 'currentColor'), 'Eliges tu energía cada mañana'], [P.anillo(28), 'Empiezas poco a poco, sin agobio'], [P.pausa(28), 'Paras cuando lo necesitas']].map(([i, t], k) => `<div style="--i:${k}">${i}<span>${t}</span></div>`).join('')}</div>`],
    () => ['', 'Cada mañana, tu nivel.',
      'No es una nota: es cuánta gasolina tienes hoy. Según el nivel que elijas, caben más o menos cosas en tu día. Puedes cambiarlo cuando quieras.',
      `<div class="lvls">${[0, 1, 2].map(i => `<div class="lvl" style="background:${NIVELES[i].c};--i:${i}">${nivelIcon(i, 36)}<b>${NIVELES[i].n}</b><small>${['Lo básico', 'Un día normal', 'Energía de sobra'][i]}<br>${plural(S.aj.niv[i], 'cosa', 'cosas')}</small></div>`).join('')}</div>`],
    () => ['', 'Solo ves lo que cabe hoy.',
      'Si vienes Estándar, tu lista tiene 3 huecos. Lo que no cabe se queda en «Más tarde», sin fecha y sin culpa, hasta que quieras traerlo.', ejemploHoy],
    () => [`<div class="center">${anilloTiempo(150, .72, 'var(--soft)', COL.o, 16, '03:36', 'var(--ink)')}</div>`, 'Empezar es lo más difícil.',
      'Eliges una tarea, escribes un primer paso ridículo de pequeño (por ejemplo, «abrir el documento») y arrancas solo unos minutos. Al acabar, decides si sigues.', ''],
    () => ['', 'Dopa aprende cuánto tardas de verdad.',
      'Mientras trabajas, la pantalla completa te enseña el tiempo y el paso. Cuando se acaba, suena y te pregunta si necesitas más. Si calculas 15 minutos y tardas 25, lo apunta; con unos días, tus estimaciones salen ya corregidas.',
      `<div class="card sm"><div class="row">${ic('crono')}<b>Calibrador de tiempo</b></div>${barrasCalib(15, 25, 'Calculas', 'Tardas')}<div class="s2">Tu factor: ×1,6. Ya lo aplico yo.</div></div>`],
    () => ['', 'Cuando algo se dispara, para.',
      'Dices del 1 al 10 cuánto lo sientes. Según el número, Dopa te propone algo concreto: seguir, respirar, alejarte un rato o hacer el STOP. También puedes escribir lo que ha pasado o buscar una frase preparada.',
      `<div class="thermo demo">${TERMO.map((c, k) => `<span>${P.pausa(22 + k, c)}</span>`).join('')}</div><div class="trm"><span style="background:var(--n)">1–3 Sigue</span><span style="background:var(--s)">4–5 Respira</span><span style="background:var(--o)">6–7 Para</span><span style="background:var(--hot);color:#fff">8–10 STOP</span></div>`],
    () => ['', 'Cada cosa que haces deja una pieza.',
      'Al final del día las ves juntas en tu collage. No hay puntos ni rachas que se rompan: solo lo que has hecho. Cada pieza significa siempre lo mismo.',
      `<div class="card sm legend">${[[P.hoja(28), 'Hoja', 'Una cosa hecha'], [P.anillo(26), 'Anillo', 'Un arranque'], [P.pausa(28), 'Semicírculo', 'Una pausa'], [nivelIcon(1, 26, 'currentColor'), 'Círculo', 'Tu energía del día']].map(([a, b, c], k) => `<div class="lg" style="--i:${k}">${a}<div><b>${b}</b><small>${c}</small></div></div>`).join('')}</div>`],
    () => ['', 'Date premios pequeños y mira qué te funciona.',
      'Apunta en tu menú de dopamina cosas que te gustan (un café, un capítulo). Al terminar algo que te ha costado, Dopa te propone una. Y en Patrones ves a qué hora rindes más y qué te ayuda.',
      `<div class="card sm"><div class="row">${ic('regalo')}<b>Tu menú de dopamina</b></div><div class="chips sm" style="margin-top:10px"><span class="ch">Un café fuera</span><span class="ch">Un capítulo</span><span class="ch">Diez minutos de música</span></div></div>`],
    () => ['', 'Lo último: ¿cómo te llamas?',
      'Para saludarte por la mañana. Debajo puedes ajustar cuántas cosas caben en cada nivel; si no lo tienes claro, deja estos números.',
      `<input class="inp big" id="onb-nombre" style="margin-top:14px" placeholder="Tu nombre" value="${esc(S.aj.nombre)}" autocomplete="given-name">
       <div class="card sm" style="margin-top:12px">${[0, 1, 2].map(i => `<div class="srow"><span class="row">${nivelIcon(i, 22, NIVELES[i].hex)}${NIVELES[i].n}</span>${stepper('niv' + i, S.aj.niv[i])}</div>`).join('')}</div>
       <p class="note">Tus datos se quedan en este iPhone. En Ajustes puedes guardar una copia en tu Google Sheets y poner avisos con la app Atajos.</p>`]
  ];
  const [arte, t, lead, extra] = pasos[ONB]();
  return `<div class="body nt"><div class="col">${topPlain(ONB < ONB_N - 1 ? '<button class="link sk" data-a="onb-saltar">Saltar</button>' : '')}
    <div class="onb enter" data-dir="${ONB_DIR}">${arte ? `<div class="art" style="--i:0">${arte}</div>` : ''}<h1 style="--i:1">${t}</h1><p class="lead" style="--i:2">${lead}</p><div style="--i:3">${extra}</div></div>
    <div class="sp"></div>
    <div class="dots">${Array.from({ length: ONB_N }, (_, i) => `<i class="${i === ONB ? 'on' : ''}"></i>`).join('')}</div>
    <button class="btn" data-a="onb-sig">${ONB < ONB_N - 1 ? 'Siguiente' : 'Empezar'}</button>
    ${ONB > 0 ? '<button class="link" data-a="onb-atras">Atrás</button>' : '<div style="height:44px"></div>'}</div></div>`;
};
A_RENDER.bienvenida = s => {
  const o = s.querySelector('.onb'); if (o && !reduceMotion()) animar(o, v => ({ transform: `translateX(${(1 - v) * 40 * ONB_DIR}px)` }), { w: 13, z: 8 });
  let x0 = null; const b = s.querySelector('.body');
  b.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  b.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (dx < -60 && ONB < ONB_N - 1) ACC['onb-sig'](); else if (dx > 60 && ONB > 0) ACC['onb-atras'](); });
};
function anilloTiempo(size, frac, track, col, w, txt, tcol) {
  const r = size / 2 - w / 2 - 2, c = 2 * Math.PI * r;
  return svg(size, size, `<circle cx="${size / 2}" cy="${size / 2}" r="${r.toFixed(1)}" fill="none" stroke="${track}" stroke-width="${w}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>${txt ? `<text x="${size / 2}" y="${size / 2 + size * .07}" text-anchor="middle" font-size="${size * .2}" font-weight="700" fill="${tcol}">${txt}</text>` : ''}`);
}
function barrasCalib(est, real, a = 'Habías calculado', b = 'Has tardado') {
  const mx = Math.max(est, real, 1);
  return `<div class="calib"><div><span style="width:${Math.round(est / mx * 52)}%;background:var(--s)"></span><em>${a} ${minTxt(est)}</em></div><div><span style="width:${Math.round(real / mx * 52)}%;background:var(--o)"></span><em>${b} ${minTxt(real)}</em></div></div>`;
}

/* ---------- Buenos días ---------- */
let BD = null;
R.buenos = () => {
  const d = dia(), n = S.aj.nombre ? ', ' + esc(S.aj.nombre) : '';
  if (BD == null) BD = d.nivel;
  const h = new Date().getHours(), saludo = h < 13 ? 'Buenos días' : (h < 20 ? 'Buenas tardes' : 'Buenas noches');
  const pend = S.cosas.filter(c => !c.hecha && c.hoy && c.hoy < hoyStr()).length;
  const cambiar = d.nivel != null;
  return `<div class="body nt"><div class="col">${cambiar ? topBack('Hoy') : topPlain()}
    <div class="kick">${cap(fechaLarga(hoyStr()))}</div><h1>${saludo}${n}.</h1>
    <div class="q">¿Con cuánta energía vienes hoy?</div>
    <div class="enter">${[0, 1, 2].map(i => `<button class="lv ${BD === i ? 'sel' : ''} ${BD != null && BD !== i ? 'dim' : ''}" style="background:${NIVELES[i].c};--i:${i}" data-a="nivel" data-x="${i}">
      <div><b>${NIVELES[i].n}</b><p>${NIVELES[i].d} ${S.aj.niv[i] === 1 ? 'Cabe 1 cosa.' : `Caben ${S.aj.niv[i]} cosas.`}</p></div>${nivelLiquido(i, 58, BD === i ? [1 / 3, 2 / 3, 1][i] : 0)}</button>`).join('')}</div>
    <div class="card sm row sleepc">${ic('cama', 30)}<div class="grow"><b>¿Qué tal has dormido?</b><div class="seg sm" style="margin-top:8px">${['Mal', 'Regular', 'Bien'].map((t, i) => `<button class="${d.sueno === i ? 'on' : ''}" data-a="sueno" data-x="${i}">${t}</button>`).join('')}</div></div></div>
    ${pend && !cambiar ? `<p class="foot">De días anteriores te quedan ${plural(pend, 'cosa', 'cosas')}. Al empezar el día pasan a hoy si caben; si no, a Más tarde.</p>` : ''}
    <div class="sp"></div>
    <div class="bdbtn ${BD == null ? 'off' : ''}"><button class="btn" data-a="empezar-dia">${cambiar ? (BD === d.nivel ? 'Volver a Hoy' : `Cambiar a ${NIVELES[BD].n}`) : 'Empezar el día'} ${ic('flecha', 20)}</button></div>
    ${BD == null ? '<p class="foot" style="margin-top:8px">Elige un nivel para continuar.</p>' : ''}
  </div></div>`;
};
function llenarLiquido(svgEl, objetivo) {
  const w = svgEl.querySelector('.wave'); if (!w) return;
  if (reduceMotion()) { w.setAttribute('d', onda(objetivo, 0, 0)); return; }
  const t0 = performance.now();
  const paso = now => { const t = (now - t0) / 1000; const f = objetivo * muelle(t, 6, 3.2), a = 2.4 * Math.exp(-t * 1.1);
    w.setAttribute('d', onda(Math.max(0, f), a, t * 7)); if (t < 2.2) requestAnimationFrame(paso); else w.setAttribute('d', onda(objetivo, 0, 0)); };
  requestAnimationFrame(paso);
}

/* ---------- Hoy ---------- */
function filaCosa(c) {
  const p = proyDe(c.proy), hecha = !!c.hecha;
  const meta = hecha ? [`hecha a las ${pad(new Date(c.hecha).getHours())}:${pad(new Date(c.hecha).getMinutes())}`]
    : [c.est ? `unos ${minTxt(conFactor(c.est))}` : '', c.cuando ? (c.cuando === 'manana' ? 'por la mañana' : 'por la tarde') : ''].filter(Boolean);
  return `<div class="task ${hecha ? 'done' : ''}" data-press="cosa" data-x="${c.id}" data-k="${c.id}">
    <button class="ck" data-a="hecha" data-x="${c.id}" aria-label="${hecha ? 'Desmarcar' : 'Marcar como hecha'}">${hecha ? `<span class="leafck">${P.hoja(30)}</span>` : '<span class="ck0"></span>'}</button>
    <div class="t" data-a="editar" data-x="${c.id}"><span class="tt">${esc(c.txt)}</span>
    <div class="m">${meta.map(x => `<span>${x}</span>`).join('<span>·</span>')}${p && !hecha ? `<span class="tag" style="background:${p.color}">${esc(p.nombre)}</span>` : ''}</div></div></div>`;
}
R.hoy = () => {
  const n = nivelHoy(), lvl = n == null ? null : NIVELES[n];
  const pend = pendHoy(), hechas = hechasHoy(), capN = capHoy(), sig = pend[0], hu = huecos();
  const tot = totalHoy(), se = sinEst();
  const hero = lvl
    ? `<button class="hero" style="background:${lvl.c}" data-a="ir-zoom" data-x="buenos"><div><small>Hoy vienes</small><b>${lvl.n}</b><p>${capN === 1 ? 'Cabe 1 cosa' : `Caben ${capN} cosas`}${tot ? ` · unos ${minTxt(tot)} en total${se ? ' (sin contar ' + plural(se, 'cosa sin tiempo', 'cosas sin tiempo') + ')' : ''}` : ''}.</p></div>${nivelIcon(n, 66, '#1F2E35')}</button>`
    : `<button class="hero" style="background:var(--card);color:var(--ink)" data-a="ir-zoom" data-x="buenos"><div><small>Todavía no has elegido</small><b>¿Cómo vienes hoy?</b><p>Toca aquí para elegir tu nivel de energía.</p></div></button>`;
  const h = new Date().getHours(), d = dia();
  const rm = rutVisibles('manana'), rmHechas = rm.filter(x => d.rutM.includes(x.id)).length;
  const avisos = [];
  if (SES) avisos.push(`<button class="close-card" data-a="volver-ses" style="background:var(--ko)">${P.anillo(30)}<div class="grow"><b>En marcha: ${esc(SES.txt)}</b><div class="s2" id="hoy-ses">Toca para volver al temporizador.</div></div><span class="chev">${ic('sig', 20)}</span></button>`);
  if (h < 13 && rm.length && rmHechas < rm.length) avisos.push(`<button class="close-card" data-a="rutina" data-x="manana">${ic('capas', 28)}<div class="grow"><b>Rutina de mañana</b><div class="s2">${rmHechas} de ${rm.length} hechas. Tu versión ${NIVELES[n == null ? 1 : n].n}.</div></div><span class="chev">${ic('sig', 20)}</span></button>`);
  const tarde = ahoraMin() >= horaMin(S.aj.hCierre) && !d.cerrado;
  if (tarde) avisos.push(`<button class="close-card" data-a="ir-zoom" data-x="cierre" style="background:var(--ks)">${P.hoja(30)}<div class="grow"><b>Cerrar el día</b><div class="s2">Mira tu collage y decide qué hacer con lo pendiente. Son 20 segundos.</div></div><span class="chev">${ic('sig', 20)}</span></button>`);
  else if (ahoraMin() >= horaMin(S.aj.hPant) - 90) avisos.push(`<button class="close-card" data-a="rutina" data-x="noche">${ic('cama', 28)}<div class="grow"><b>Rutina de noche</b><div class="s2">Pantallas fuera a las ${S.aj.hPant}. Tres pasos cortos.</div></div><span class="chev">${ic('sig', 20)}</span></button>`);
  const lista = pend.length || hechas.length ? pend.map(filaCosa).join('') + hechas.map(filaCosa).join('')
    : `<div class="empty">Todavía no tienes nada para hoy. Añade la primera cosa: algo concreto que quieras hacer.</div>`;
  return `<div class="body"><div class="col">${topTab()}
    <div class="kick">${cap(fechaLarga(hoyStr()))}</div><h1>Hoy</h1>${hero}${avisos.join('')}
    <div class="card"><div class="cl"><span>${capN === 1 ? 'Tu cosa de hoy' : `Tus ${capN} cosas de hoy`}</span><em id="cnt-hechas">${hechas.length ? plural(hechas.length, 'hecha', 'hechas') : ''}</em></div>
      <div class="list">${lista}</div>
      <button class="addrow" data-a="anadir">${ic('mas', 20)}<span>${hu ? `Añadir · ${hu === 1 ? 'te queda 1 hueco' : `te quedan ${hu} huecos`}` : 'Añadir · hoy ya está lleno, irá a Más tarde'}</span></button>
    </div>
    <div class="pills"><button data-a="ir" data-x="proyectos">${ic('carpeta', 17)}<b>Proyectos</b></button><button data-a="ir" data-x="luego">${ic('reloj', 17)}<b>Más tarde</b>${luego().length ? `<em>${luego().length}</em>` : ''}</button><button data-a="elige">${ic('dado', 17)}<b>Elige por mí</b></button></div>
    ${sig && !SES ? `<div style="height:14px"></div><button class="btn" data-a="preparar" data-x="${sig.id}"><span class="ell">Arrancar «${esc(sig.txt)}»</span></button>` : ''}
  </div></div>`;
};

/* animación de «hecha»: la casilla se convierte en hoja, vuela al contador y la fila baja */
async function animarHecha(id, boton) {
  const row = boton.closest('.task'), cnt = $('#cnt-hechas');
  if (reduceMotion() || !row) { marcarHecha(id); return; }
  BLOQ = true;
  boton.innerHTML = `<span class="leafck">${P.hoja(30)}</span>`;
  const lf = boton.querySelector('.leafck');
  animar(lf, v => ({ transform: `scale(${v}) rotate(${-60 + 90 * v}deg)` }), { w: 16, z: 6.5 });
  row.classList.add('done');
  const r = boton.getBoundingClientRect(), a = $('#app').getBoundingClientRect();
  const cr = cnt ? cnt.getBoundingClientRect() : { left: r.left + 200, top: r.top - 40, width: 0, height: 0 };
  const fly = document.createElement('div'); fly.className = 'fly'; fly.innerHTML = P.hoja(30);
  fly.style.left = (r.left - a.left) + 'px'; fly.style.top = (r.top - a.top) + 'px'; $('#app').appendChild(fly);
  const x1 = cr.left - r.left + cr.width - 24, y1 = cr.top - r.top - 6, kf = [];
  for (let i = 0; i <= 20; i++) { const u = i / 20, x = 2 * u * (1 - u) * (x1 * .45) + u * u * x1, y = 2 * u * (1 - u) * (-90) + u * u * y1;
    kf.push({ transform: `translate(${x}px,${y}px) scale(${1 - .45 * u}) rotate(${30 + 200 * u}deg)`, opacity: u > .8 ? (1 - u) * 5 : 1 }); }
  await espera(280);
  fly.animate(kf, { duration: 620, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' }).onfinish = () => fly.remove();
  await espera(600);
  const pos = {}; $$('#s-hoy .task').forEach(t => pos[t.dataset.k] = t.getBoundingClientRect().top);
  BLOQ = false;
  marcarHecha(id, true);
  $$('#s-hoy .task').forEach(t => { const y0 = pos[t.dataset.k]; if (y0 == null) return; const dy = y0 - t.getBoundingClientRect().top;
    if (Math.abs(dy) > 1) animar(t, v => ({ transform: `translateY(${dy * (1 - v)}px)` }), { w: 11, z: 6 }); });
  const c2 = $('#cnt-hechas'); if (c2) animar(c2, v => ({ transform: `scale(${1 + .35 * Math.sin(Math.PI * Math.min(1, v))})` }), { w: 10, z: 8 });
}
let BLOQ = false;
function marcarHecha(id, sinAviso) {
  commit(() => { const c = cosa(id); if (!c || c.hecha) return; c.hecha = Date.now(); if (!c.hoy) c.hoy = hoyStr(); pieza('hoja', id); },
    sinAviso ? null : 'Hecha. Una hoja más para tu collage.', true);
  if (sinAviso) toast('Hecha. Una hoja más para tu collage.', true);
}

/* ---------- Añadir / editar cosa (hoja) ---------- */
let F = null;
const ESTS = [5, 10, 15, 30, 60];
function abrirCosa(id, dest) {
  const c = id ? cosa(id) : null;
  F = c ? { id: c.id, txt: c.txt, paso: c.paso || '', est: c.est || null, otro: c.est && !ESTS.includes(c.est), proy: c.proy || null, cuando: c.cuando || '', dest: c.hoy === hoyStr() ? 'hoy' : 'luego' }
        : { id: null, txt: '', paso: '', est: 15, otro: false, proy: null, cuando: '', dest: dest || (huecos() ? 'hoy' : 'luego') };
  hoja(htmlCosa(), () => { if (!F.id) setTimeout(() => { const i = $('#f-txt'); if (i && $('#sheet').classList.contains('on')) i.focus({ preventScroll: true }); }, 380); });
}
function htmlCosa() {
  const yaHoy = F.id && (cosa(F.id) || {}).hoy === hoyStr(), hu = huecos(), cabe = hu > 0 || yaHoy;
  const f = factor();
  const lHoy = yaHoy ? 'Para hoy' : (hu ? `Para hoy · ${hu === 1 ? 'te queda 1 hueco' : `te quedan ${hu} huecos`}` : 'Para hoy · lleno');
  return `<h2>${F.id ? 'Editar' : 'Nueva cosa'}</h2>
    <input class="inp big" id="f-txt" style="margin-top:12px" placeholder="¿Qué hay que hacer?" value="${esc(F.txt)}" data-f="txt" enterkeyhint="next">
    <div class="lab">¿Cuál es el primer paso, el más pequeño posible?</div>
    <input class="inp" id="f-paso" placeholder="${esc(sugerirPaso(F.txt))}" value="${esc(F.paso)}" data-f="paso">
    <div class="lab">¿Cuánto crees que vas a tardar?</div>
    <div class="chips sm">${ESTS.map(m => `<button class="ch ${!F.otro && F.est === m ? 'on' : ''}" data-a="f-est" data-x="${m}">${minTxt(m)}</button>`).join('')}<button class="ch ${F.otro ? 'on' : ''}" data-a="f-est" data-x="otro">Otro</button></div>
    ${F.otro ? `<div class="row" style="margin-top:8px"><input class="inp" id="f-otro" type="number" inputmode="numeric" min="1" max="600" style="width:110px" value="${F.est || ''}" placeholder="45"><span class="note" style="margin:0">minutos</span></div>` : ''}
    <p class="note">${f === 1 ? 'Dopa irá aprendiendo cuánto tardas de verdad y corregirá esta cifra.' : (F.est ? `Según lo que sueles tardar (×${fx(f)}), calcula unos <b>${minTxt(conFactor(F.est))}</b>.` : '')}</p>
    ${proyAbiertos().length ? `<div class="lab">¿Es de algún proyecto?</div><div class="chips sm">${[{ id: null, nombre: 'Ninguno' }].concat(proyAbiertos()).map(p => `<button class="ch ${F.proy === p.id ? 'on' : ''}" data-a="f-proy" data-x="${p.id || ''}">${esc(p.nombre)}</button>`).join('')}</div>` : ''}
    <div class="lab">¿Cuándo te va mejor?</div>
    <div class="chips sm">${[['manana', 'Por la mañana'], ['tarde', 'Por la tarde'], ['', 'Me da igual']].map(([k, t]) => `<button class="ch ${F.cuando === k ? 'on' : ''}" data-a="f-cuando" data-x="${k}">${t}</button>`).join('')}</div>
    <div class="lab">¿Dónde la guardo?</div>
    <div class="seg"><button class="${F.dest === 'hoy' ? 'on' : ''}" data-a="f-dest" data-x="hoy" ${cabe ? '' : 'disabled'}>${lHoy}</button><button class="${F.dest === 'luego' ? 'on' : ''}" data-a="f-dest" data-x="luego">Más tarde</button></div>
    ${!cabe ? `<p class="note">Hoy ya está lleno (caben ${capHoy()}). La guardo en Más tarde; cuando acabes algo, la traes.</p>` : ''}
    <div style="height:16px"></div><button class="btn" data-a="f-guardar">Guardar</button>
    ${F.id ? '<button class="link" data-a="f-borrar" style="color:var(--hot)">Borrar esta cosa</button>' : ''}`;
}
function sugerirPaso(t) {
  t = (t || '').toLowerCase();
  if (/correo|email|mail|mensaje|whats/.test(t)) return 'Ej.: abrir el correo y escribir solo el saludo';
  if (/pagar|recibo|banco|factura/.test(t)) return 'Ej.: abrir la app del banco';
  if (/clase|examen|corregir|rúbrica|rubrica|preparar|informe|documento/.test(t)) return 'Ej.: abrir el documento';
  if (/llamar|teléfono|telefono|cita|médico|medico|dentista/.test(t)) return 'Ej.: buscar el número';
  if (/limpiar|ordenar|recoger|lavadora|platos/.test(t)) return 'Ej.: recoger solo una cosa';
  if (/pasear|correr|andar|ejercicio|gimnasio|gym/.test(t)) return 'Ej.: ponerme las zapatillas';
  if (/comprar|compra|super/.test(t)) return 'Ej.: abrir la lista de la compra';
  return 'Ej.: abrir lo que necesitas';
}

/* ---------- Captura rápida (hoja) ---------- */
function abrirCaptura(marcaRut) {
  CAPT_RUT = marcaRut || null;
  hoja(`<h2>Apuntar rápido</h2><p class="sub">Lo guardo en Más tarde para que no se te olvide y puedas seguir con lo tuyo. Luego decides qué hacer con ello.</p>
    <input class="inp" id="cap-t" style="margin-top:14px" placeholder="Lo que se te ha ocurrido" enterkeyhint="done">
    <div style="height:14px"></div><button class="btn" data-a="cap-ok">Guardar en Más tarde</button>`,
  () => setTimeout(() => { const i = $('#cap-t'); if (i && $('#sheet').classList.contains('on')) i.focus({ preventScroll: true }); }, 380));
}
let CAPT_RUT = null;

/* ---------- Elige por mí (hoja) ---------- */
let ELIGE = 0;
function candidatas() {
  const tarde = new Date().getHours() >= 14;
  return pendHoy().map((c, i) => ({ c, i, m: c.est ? conFactor(c.est) : 30, hora: c.cuando === (tarde ? 'tarde' : 'manana') }))
    .sort((a, b) => (b.hora - a.hora) || (a.m - b.m) || (a.i - b.i));
}
function htmlElige() {
  const xs = candidatas();
  if (!xs.length) return `<div class="center" style="padding:10px 0">${ic('dado', 46)}</div><h2 class="center">No tienes nada pendiente para hoy</h2><p class="sub center">Añade una cosa o trae una de Más tarde, y te ayudo a elegir.</p><div style="height:14px"></div><button class="btn" data-a="anadir">Añadir una cosa</button>`;
  const k = ELIGE % xs.length, x = xs[k], c = x.c;
  const porque = x.hora ? `Es buena hora: la apuntaste para ${c.cuando === 'manana' ? 'por la mañana' : 'por la tarde'}.`
    : (k === 0 && xs.length > 1 ? `Es la más corta${c.est ? ` (unos ${minTxt(x.m)})` : ''} y te quita algo de encima.` : (c.est ? `Te llevará unos ${minTxt(x.m)}.` : 'Es una buena para empezar.'));
  return `<div class="center dado" style="padding:6px 0 4px;color:var(--acc)">${ic('dado', 50)}</div>
    <h2 class="center">Te toca: ${esc(c.txt)}</h2><p class="sub center">${porque}${c.paso ? ` Primer paso: ${esc(minus(c.paso))}.` : ''}</p>
    <div style="height:16px"></div><button class="btn" data-a="preparar" data-x="${c.id}">Ir a arrancarla</button>
    ${xs.length > 1 ? '<button class="link" data-a="elige-otra">Prefiero otra</button>' : '<button class="link" data-a="cerrar-hoja">Cerrar</button>'}`;
}

/* ---------- Proyectos ---------- */
let NUEVO_PROY = false;
R.proyectos = () => {
  const ab = proyAbiertos(), ap = S.proy.filter(p => !p.abierto);
  const slot = (p, i) => { const n = S.cosas.filter(c => c.proy === p.id && !c.hecha), h = n.filter(c => c.hoy === hoyStr()).length;
    return `<div class="pslot" data-press="proy" data-x="${p.id}" style="--i:${i}"><span class="dot" style="background:${p.color}"></span><div class="grow"><b>${esc(p.nombre)}</b><small>${plural(n.length, 'cosa', 'cosas')}${h ? ` · ${h} para hoy` : ''}</small></div><button class="pill2" data-a="aparcar" data-x="${p.id}">Aparcar</button></div>`; };
  return `<div class="body"><div class="col">${topBack('Hoy')}
    <h1>Proyectos</h1><div class="sub">Un proyecto agrupa cosas que van juntas (Clases, Casa, Mudanza…). Como mucho ${S.aj.limP} abiertos a la vez, para que la cabeza no se disperse. Llevas ${ab.length}.</div>
    <div class="enter">${ab.map(slot).join('')}</div>
    ${NUEVO_PROY ? `<div class="card sm"><input class="inp" id="np" placeholder="Nombre del proyecto" style="box-shadow:none;padding:6px 0" enterkeyhint="done"><div class="two" style="margin-top:10px"><button class="btn ghost" data-a="np-cancelar">Cancelar</button><button class="btn" data-a="np-ok">Abrir</button></div></div>`
      : (ab.length < S.aj.limP ? `<button class="pslot empty" data-a="np">${ic('mas', 18)} Abrir otro proyecto</button>` : `<div class="foot">Los ${S.aj.limP} huecos están llenos. Para abrir otro, aparca uno: no se pierde nada.</div>`)}
    ${ap.length ? `<div class="lab" style="margin-top:22px">Aparcados (no se pierden)</div><div class="card sm">${ap.map(p => `<div class="lrow" data-press="proy" data-x="${p.id}"><span class="row"><span class="dot" style="background:${p.color}"></span>${esc(p.nombre)}</span><button class="pill2" data-a="reabrir" data-x="${p.id}">Volver a abrir</button></div>`).join('')}</div>` : ''}
    <p class="foot">Mantén pulsado un proyecto para borrarlo.</p>
  </div></div>`;
};
A_RENDER.proyectos = () => { const i = $('#np'); if (i) i.focus({ preventScroll: true }); };

/* ---------- Más tarde ---------- */
R.luego = () => {
  const xs = luego(), grupos = {};
  xs.forEach(c => { const k = c.proy || '_'; (grupos[k] = grupos[k] || []).push(c); });
  const viejo = xs.find(c => (Date.now() - (c.creada || Date.now())) > 14 * 864e5 && !c.preguntada);
  const keys = Object.keys(grupos).sort((a, b) => a === '_' ? 1 : b === '_' ? -1 : 0);
  const manana = S.cosas.filter(c => !c.hecha && c.hoy && c.hoy > hoyStr());
  return `<div class="body"><div class="col">${topBack('Hoy', `<button class="ib" data-a="captura" aria-label="Apuntar rápido">${ic('mas', 23)}</button>`)}
    <h1>Más tarde</h1><div class="sub">Aquí espera lo que no cabe hoy. No tiene fecha ni te lo voy a recordar: lo traes a Hoy cuando quieras.</div>
    ${viejo ? `<div class="card old"><b>${esc(viejo.txt)}</b><div class="s2">Lleva más de dos semanas aquí. ¿Sigue importándote?</div><div class="two" style="margin-top:12px"><button class="btn soft" data-a="soltar" data-x="${viejo.id}">Ya no, quitarlo</button><button class="btn" data-a="a-hoy" data-x="${viejo.id}">Sí, pasar a hoy</button></div></div>` : ''}
    ${xs.length ? keys.map(k => `<div class="lab">${k === '_' ? 'Sin proyecto' : ic('carpeta', 15) + ' ' + esc((proyDe(k) || {}).nombre || 'Proyecto')}</div><div class="card sm">${grupos[k].map(c => `<div class="lrow" data-press="cosa" data-x="${c.id}"><span data-a="editar" data-x="${c.id}" style="flex:1">${esc(c.txt)}</span><button class="pill2" data-a="a-hoy" data-x="${c.id}">Pasar a hoy</button></div>`).join('')}</div>`).join('')
      : '<div class="empty">Ahora mismo no hay nada esperando. Cuando algo no quepa hoy, vendrá aquí.</div>'}
    ${manana.length ? `<div class="lab">Para mañana</div><div class="card sm">${manana.map(c => `<div class="lrow" data-press="cosa" data-x="${c.id}"><span style="flex:1">${esc(c.txt)}</span><button class="pill2" data-a="a-hoy" data-x="${c.id}">Pasar a hoy</button></div>`).join('')}</div>` : ''}
    <div style="height:14px"></div><button class="btn soft" data-a="anadir-luego">${ic('mas', 18)} Apuntar para más tarde</button>
  </div></div>`;
};

/* ---------- Rutinas por capas (mañana y noche) ---------- */
let RUTK = 'manana', RUTV = null, RUTED = false;
const SECN = ['1 · Preparar', '2 · Vaciar la cabeza', '3 · Desconectar'];
function rutVisibles(k, nv) { if (nv == null) nv = nivelHoy() == null ? 1 : nivelHoy(); return (S.rut[k] || []).filter(x => x.niv <= nv); }
function nocheCompleta(f) { const d = S.dias[f]; if (!d) return false; const nv = d.nivel == null ? 1 : d.nivel, vis = rutVisibles('noche', nv); return vis.length > 0 && vis.every(x => (d.rutN || []).includes(x.id)); }
function rutinaHtml(k) {
  RUTK = k;
  const d = dia(), nv = RUTV == null ? (nivelHoy() == null ? 1 : nivelHoy()) : RUTV;
  const done = k === 'manana' ? d.rutM : d.rutN, items = S.rut[k] || [], vis = items.filter(x => x.niv <= nv);
  const fila = x => `<button class="zr ${done.includes(x.id) ? 'done' : ''}" data-a="rut-ck" data-x="${x.id}">${done.includes(x.id) ? `<span class="ckh">${P.hoja(26)}</span>` : '<span class="ck0"></span>'}<span class="grow">${esc(x.txt)}</span>${x.acc ? `<span class="chev">${ic('sig', 18)}</span>` : ''}</button>`;
  const quedan = horaMin(S.aj.hPant) - ahoraMin();
  const cab = k === 'manana'
    ? `<h1>Rutina de mañana</h1><div class="sub">Una rutina por capas: según tu nivel ves la versión corta o la completa. Vienes ${NIVELES[nivelHoy() == null ? 1 : nivelHoy()].n}, así que te enseño esa.</div>`
    : `<div class="kick">${ic('cama', 15)} Rutina de noche</div><h1>Pantallas fuera a las ${S.aj.hPant}</h1><div class="sub">${quedan > 0 ? `Quedan ${minTxt(quedan)}. ` : 'Ya es la hora. '}Tres pasos cortos para que te cueste menos dormir.</div>`;
  const seg = `<div class="seg sm" style="margin-top:12px">${[0, 1, 2].map(i => `<button class="${nv === i ? 'on' : ''}" data-a="rut-nv" data-x="${i}">${nivelIcon(i, 15, NIVELES[i].hex)} ${NIVELES[i].n}</button>`).join('')}</div>`;
  if (RUTED) {
    return `<div class="body nt"><div class="col">${topBack('Listo', '')}
      <h1>Editar la rutina</h1><div class="sub">Cada paso aparece desde un nivel: los de Nuclear salen siempre; los de Óptimo, solo los días con energía de sobra.</div>
      <div class="card sm">${items.map(x => `<div class="lrow"><span class="grow">${esc(x.txt)}${k === 'noche' ? `<small class="s2" style="display:block">${SECN[x.sec || 0]}</small>` : ''}</span><span class="nvp">${[0, 1, 2].map(i => `<button class="${x.niv === i ? 'on' : ''}" data-a="rut-niv" data-x="${x.id}" data-n="${i}" aria-label="${NIVELES[i].n}">${nivelIcon(i, 20, x.niv === i ? NIVELES[i].hex : 'currentColor')}</button>`).join('')}</span><button class="ib" data-a="rut-del" data-x="${x.id}" aria-label="Quitar">${ic('papelera', 19)}</button></div>`).join('') || '<div class="empty">Sin pasos todavía.</div>'}</div>
      <div class="lab">Añadir un paso</div><input class="inp" id="rut-new" placeholder="Ej.: preparar la mochila" enterkeyhint="done">
      ${k === 'noche' ? `<div class="chips sm" style="margin-top:8px">${SECN.map((t, i) => `<button class="ch ${RUTSEC === i ? 'on' : ''}" data-a="rut-sec" data-x="${i}">${t}</button>`).join('')}</div>` : ''}
      <div style="height:12px"></div><button class="btn" data-a="rut-add">Añadir</button>
      <p class="foot">Los iconos de cada paso dicen desde qué nivel aparece.</p></div></div>`;
  }
  const cuerpo = k === 'noche'
    ? [0, 1, 2].map(s => { const xs = vis.filter(x => (x.sec || 0) === s); return xs.length ? `<div class="zc"><div class="zt">${SECN[s]}</div>${xs.map(fila).join('')}</div>` : ''; }).join('')
    : `<div class="zc">${vis.map(fila).join('') || '<div class="empty">No hay pasos en este nivel.</div>'}</div>`;
  return `<div class="body nt"><div class="col">${topBack('Hoy')}${cab}${seg}${cuerpo}
    <button class="link acc" data-a="rut-editar">Editar mi rutina</button>
    <div class="sp"></div>
    ${k === 'noche' ? '<button class="btn light" data-a="buenas-noches">Buenas noches</button>' : '<button class="btn" data-a="atras">Listo</button>'}
  </div></div>`;
};
let RUTSEC = 0;
R.rutina = () => rutinaHtml('manana');
R.noche = () => rutinaHtml('noche');

/* =====================================================================
   sonido (suena aunque el iPhone esté en silencio: va por el volumen multimedia)
   ===================================================================== */
const AUD = {};
['fin', 'aviso'].forEach(k => { try { const a = new Audio('sonidos/' + k + '.wav'); a.preload = 'auto'; AUD[k] = a; } catch (e) {} });
let AUD_OK = false;
function desbloquearAudio() {
  if (AUD_OK) return; AUD_OK = true;
  Object.values(AUD).forEach(a => { try { a.muted = true; const p = a.play(); if (p) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; AUD_OK = false; }); } catch (e) {} });
}
document.addEventListener('pointerdown', desbloquearAudio, { passive: true });
function sonar(k) { if (!S.aj.sonido || !AUD[k]) return; try { const a = AUD[k]; a.muted = false; a.currentTime = 0; const p = a.play(); if (p) p.catch(() => {}); } catch (e) {} }

/* pantalla encendida mientras corre el temporizador */
let WL = null;
async function pantallaEncendida(si) {
  try {
    if (si && 'wakeLock' in navigator && !WL) { WL = await navigator.wakeLock.request('screen'); WL.addEventListener('release', () => { WL = null; }); }
    if (!si && WL) { await WL.release(); WL = null; }
  } catch (e) { WL = null; }
}

/* =====================================================================
   Arrancar
   ===================================================================== */
const DURS = [1, 2, 5, 10, 15];
const ARnuevo = () => ({ cosa: null, paso: '', dur: S.aj.dur, otro: false, hiper: false });
let AR = ARnuevo();
let SES = null; try { SES = JSON.parse(localStorage.getItem('dopa.ses') || 'null'); } catch (e) {}
const saveSes = () => { try { localStorage.setItem('dopa.ses', JSON.stringify(SES)); } catch (e) {} };
function masMin(m) { const d = new Date(Date.now() + m * 6e4); d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function minHasta(hhmm) { let m = horaMin(hhmm) - ahoraMin(); if (m <= 0) m += 1440; return m; }
const HQ = { agua: ['Beber agua', 'beber agua'], estirar: ['Estirarme', 'estirarte'], comer: ['Comer algo', 'comer algo'], lejos: ['Mirar lejos', 'mirar lejos un momento'], bano: ['Ir al baño', 'ir al baño'] };
const HQI = { agua: 'agua', estirar: 'estirar', comer: 'comer', lejos: 'ojo', bano: 'bano' };
function listaY(xs) { return xs.length < 2 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]; }
function textoRecordatorio(h) { const xs = (h.que || []).map(k => HQ[k] ? HQ[k][1] : null).filter(Boolean); if (h.otro) xs.push(minus(h.otro)); return xs.length ? 'Hora de ' + listaY(xs) + '.' : 'Un momento para ti.'; }
function textoCada(c) { return c === 'mitad' ? 'a mitad de la sesión' : c === 'final' ? 'solo al final' : `cada ${c} min`; }

R.arrancar = () => {
  const pend = pendHoy();
  if (AR.cosa && !pend.find(c => c.id === AR.cosa)) AR.cosa = null;
  if (AR.cosa === null && pend[0]) { AR.cosa = pend[0].id; AR.paso = pend[0].paso || ''; }
  const c = cosa(AR.cosa), h = S.aj.hiper;
  if (AR.hiper && !h.salida) h.salida = masMin(90);
  const todo = c && c.est ? conFactor(c.est) : null;
  if (!pend.length && !SES) return `<div class="body"><div class="col">${topTab()}
    <h1>Arrancar</h1><div class="sub">Aquí empiezas una de tus cosas de hoy, solo unos minutos. Al acabar, decides si sigues.</div>
    <div class="empty" style="margin-top:20px">${P.anillo(46)}<br><br>Ahora mismo no tienes nada pendiente para hoy. Añade una cosa o trae una de Más tarde.</div>
    <button class="btn" data-a="anadir">Añadir una cosa para hoy</button><button class="link acc" data-a="ir" data-x="luego">Ver Más tarde</button></div></div>`;
  return `<div class="body"><div class="col">${topTab()}
    <h1>Arrancar</h1><div class="sub">Elige una de tus cosas de hoy y empieza solo unos minutos. Al acabar, decides si sigues.</div>
    ${SES ? `<button class="close-card" data-a="volver-ses" style="background:var(--ko)">${P.anillo(30)}<div class="grow"><b>Tienes uno en marcha</b><div class="s2">${esc(SES.txt)}. Toca para volver.</div></div><span class="chev">${ic('sig', 20)}</span></button>` : ''}
    <div class="lab">¿Con cuál empiezas?</div>
    <div class="chips">${pend.map(x => `<button class="ch ${AR.cosa === x.id ? 'on' : ''}" data-a="ar-cosa" data-x="${x.id}">${esc(x.txt)}</button>`).join('')}</div>
    <div class="lab">El primer paso, lo más pequeño posible</div>
    <input class="inp" id="ar-paso" placeholder="${esc(sugerirPaso(c ? c.txt : ''))}" value="${esc(AR.paso)}">
    ${AR.hiper ? '' : `<div class="lab">¿Cuánto rato, de momento?</div>
    <div class="chips sm">${DURS.map(m => `<button class="ch ${!AR.otro && AR.dur === m ? 'on' : ''}" data-a="ar-dur" data-x="${m}">${m} min</button>`).join('')}${todo && !DURS.includes(todo) ? `<button class="ch ${!AR.otro && AR.dur === todo ? 'on' : ''}" data-a="ar-dur" data-x="${todo}">Toda: ${minTxt(todo)}</button>` : ''}<button class="ch ${AR.otro ? 'on' : ''}" data-a="ar-dur" data-x="otro">Otro</button></div>
    ${AR.otro ? `<div class="row" style="margin-top:8px"><input class="inp" id="ar-otro" type="number" inputmode="numeric" min="1" max="240" style="width:110px" value="${AR.dur || ''}"><span class="note" style="margin:0">minutos</span></div>` : ''}
    ${c && c.est ? `<p class="note">Habías calculado ${minTxt(c.est)}${factor() !== 1 ? `; con lo que sueles tardar, unos <b>${minTxt(conFactor(c.est))}</b>` : ''}.</p>` : ''}`}
    <div class="card sm row" style="margin-top:14px">${ic('ola', 24)}<div class="grow"><b>Modo hiperfoco</b><div class="s2">Para sesiones largas: trabajas hasta una hora y te recuerdo lo que elijas, sin cortarte.</div></div><button class="tgl ${AR.hiper ? 'on' : ''}" data-a="ar-hiper" aria-label="Modo hiperfoco"><i></i></button></div>
    ${AR.hiper ? `<button class="card sm row" style="width:100%;text-align:left" data-a="ir" data-x="hiperfoco"><div class="grow"><b>Hasta las ${h.salida}</b><div class="s2">${esc(cap(textoRecordatorio(h).replace('Hora de ', 'Te recuerdo ')).replace(/\.$/, ''))}, ${textoCada(h.cada)}.</div></div><span class="pill2">Cambiar</span></button>` : ''}
    <div class="sp"></div><div style="height:16px"></div>
    <button class="btn" data-a="empezar">${AR.hiper ? `Empezar hasta las ${h.salida}` : `Empezar ${minTxt(AR.dur || 5)}`}</button>
  </div></div>`;
};

/* ---------- Hiperfoco: qué y cuándo te recuerdo ---------- */
let HOTRO = false;
R.hiperfoco = () => {
  const h = S.aj.hiper;
  if (!h.salida) h.salida = masMin(90);
  return `<div class="body"><div class="col">${topBack('Arrancar')}
    <h1>Modo hiperfoco</h1><div class="sub">Para cuando te metes a fondo y se te pasa el tiempo. Te aviso con un sonido suave de lo que elijas, sin cortarte.</div>
    <div class="lab">¿Qué quieres que te recuerde?</div>
    <div class="chips sm">${Object.keys(HQ).map(k => `<button class="ch ${h.que.includes(k) ? 'on' : ''}" data-a="hq" data-x="${k}">${ic(HQI[k], 15)} ${HQ[k][0]}</button>`).join('')}<button class="ch ${h.otro ? 'on' : ''}" data-a="hq-otro">${ic('mas', 15)} ${h.otro ? esc(h.otro) : 'Otro'}</button></div>
    ${HOTRO ? `<div class="row" style="margin-top:8px"><input class="inp" id="hq-otro" placeholder="Ej.: revisar el móvil del trabajo" value="${esc(h.otro || '')}" enterkeyhint="done"><button class="pill2" data-a="hq-otro-ok">Vale</button></div>` : ''}
    <div class="lab">¿Cada cuánto?</div>
    <div class="chips sm">${[25, 45, 60, 'mitad', 'final'].map(c => `<button class="ch ${h.cada === c ? 'on' : ''}" data-a="hq-cada" data-x="${c}">${c === 'mitad' ? 'A mitad' : c === 'final' ? 'Solo al final' : c === 60 ? 'Cada hora' : 'Cada ' + c + ' min'}</button>`).join('')}</div>
    <div class="card sm row" style="margin-top:14px">${ic('reloj', 22)}<span class="grow">Termino a las</span><input type="time" id="hq-salida" value="${h.salida}" style="font-size:17px;color:var(--acc);font-weight:700"></div>
    <p class="note">Diez minutos antes de esa hora te aviso para que cierres con calma y apuntes dónde te quedas.</p>
    <div class="sp"></div><div style="height:16px"></div><button class="btn" data-a="atras">Listo</button>
  </div></div>`;
};

/* ---------- Cuenta atrás 3-2-1 ---------- */
let CD = 3, CDT = null;
R.cuenta = () => `<div class="body nt full"><div class="col" style="text-align:center">${topPlain()}
  <div class="kick">Vas a empezar</div><h1 class="tarea">${esc(SES ? SES.txt : '')}</h1>
  <div class="timer"><svg width="260" height="260" viewBox="0 0 260 260"><circle cx="130" cy="130" r="112" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="16"/><circle id="cd-arc" cx="130" cy="130" r="112" fill="none" stroke="#FFF5E8" stroke-width="16" stroke-linecap="round" stroke-dasharray="0 704" transform="rotate(-90 130 130)"/><text x="130" y="176" text-anchor="middle" class="cd-num" id="cd-n">${CD}</text></svg></div>
  <p class="paso-cd">Primer paso: ${esc(minus(SES && SES.paso ? SES.paso : 'empieza por lo más pequeño'))}.</p>
  <button class="link" data-a="cd-ya">Empezar ya</button></div></div>`;
function pulsoCuenta() {
  const n = $('#cd-n'), a = $('#cd-arc');
  if (n) { n.textContent = CD; animar(n, v => ({ transform: `scale(${.4 + .6 * v})`, opacity: Math.min(1, v * 3) }), { w: 16, z: 7 }); n.style.transformOrigin = '130px 130px'; n.style.transformBox = 'view-box'; }
  if (a && a.animate) a.animate([{ strokeDasharray: '0 704' }, { strokeDasharray: '704 704' }], { duration: reduceMotion() ? 1 : 920, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
}
function arrancarCuenta() {
  CD = 3; SES.fase = 'cuenta'; saveSes(); go('cuenta', 'fade', true);
  clearInterval(CDT); setTimeout(pulsoCuenta, 30);
  CDT = setInterval(() => { CD--; if (CD <= 0) { clearInterval(CDT); empezarAhora(); return; } pulsoCuenta(); }, 1000);
}

/* ---------- Modo «Ahora»: pantalla completa ---------- */
const RING_R = 118, RING_C = 2 * Math.PI * RING_R;
function restante() { if (!SES || !SES.ini) return 0; const ahora = SES.pausado || Date.now(); return SES.ini + SES.dur * 6e4 + (SES.pausas || 0) - ahora; }
function trabajado() { if (!SES || !SES.ini) return 0; const ahora = SES.pausado || Date.now(); return Math.max(0, ahora - SES.ini - (SES.pausas || 0)); }
R.ahora = () => {
  if (!SES) return `<div class="body nt">${topBack()}<div class="empty">No hay nada en marcha.</div></div>`;
  const durTxt = SES.hiper ? `hasta las ${SES.salida}` : `de ${minTxt(SES.dur)}`;
  return `<div class="ahora ${SES.fin ? 'fin' : ''} ${SES.pausado ? 'pausado' : ''}" id="ah">
    <div class="ah-top"><button class="back" data-a="ahora-salir">${ic('atras', 20, 2.2)}<span>Hoy</span></button><span class="ah-pz">${SES.pausado ? 'En pausa' : ''}</span></div>
    <div class="ah-ring"><svg width="280" height="280" viewBox="0 0 280 280" id="ah-svg"><circle id="ah-flash" cx="140" cy="140" r="${RING_R}" fill="#fff" opacity="0"/><circle cx="140" cy="140" r="${RING_R}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="18"/><circle id="ah-arc" cx="140" cy="140" r="${RING_R}" fill="none" stroke="#FFF5E8" stroke-width="18" stroke-linecap="round" stroke-dasharray="${RING_C} ${RING_C}" transform="rotate(-90 140 140)"/>
      <g class="ah-txt"><text id="ah-t" x="140" y="150" text-anchor="middle" font-size="62" font-weight="700" fill="#fff">--:--</text><text id="ah-sub" x="140" y="182" text-anchor="middle" font-size="15" fill="rgba(255,255,255,.75)">${durTxt}</text></g>
      <path id="ah-check" d="M96 142 l30 30 l60 -64" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="140" stroke-dashoffset="140"/></svg></div>
    <div class="ah-info"><div class="kick">${SES.hiper ? 'Hiperfoco' : 'Ahora'}</div><h1 class="tarea">${esc(SES.txt)}</h1>${SES.paso ? `<p class="ah-paso" id="ah-paso">Paso: ${esc(minus(SES.paso))}</p>` : ''}</div>
    <div class="ah-run">
      <p class="ah-hint">Toca la pantalla para ver los botones</p>
      <div class="ah-ctrl"><div class="ctrls"><button data-a="ah-mas" data-x="5">${ic('mas', 24)}<small>+5 min</small></button><button data-a="ah-pausa">${ic(SES.pausado ? 'play' : 'pausar', 24)}<small>${SES.pausado ? 'Seguir' : 'Pausar'}</small></button><button data-a="atasco">${ic('ayuda', 24)}<small>Me he atascado</small></button></div>
        <button class="btn dark" data-a="terminar">Terminar</button></div></div>
    <div class="ah-end"><h2>${Math.round(SES.dur) === 1 ? 'Ha pasado 1 minuto' : `Han pasado ${minTxt(SES.dur)}`}.</h2><p>Ya has arrancado, que era lo difícil. ¿Necesitas más tiempo?</p>
      <div class="three"><button data-a="ah-mas" data-x="5">+5 min</button><button data-a="ah-mas" data-x="10">+10 min</button><button data-a="ah-mas" data-x="15">+15 min</button></div>
      <button class="btn light" data-a="terminar">Ya está, he terminado</button></div>
    <div class="banner" id="ah-banner"></div>
  </div>`;
};
let CTL_T = null, RAF = null;
A_RENDER.ahora = s => {
  pantallaEncendida(true);
  s.querySelector('#ah').addEventListener('click', e => { if (e.target.closest('button')) { mostrarCtl(true); return; } mostrarCtl(!s.querySelector('#ah').classList.contains('ctl')); });
  cancelAnimationFrame(RAF); const loop = () => { if (ACT !== 'ahora') return; pintarAhora(); RAF = requestAnimationFrame(loop); }; RAF = requestAnimationFrame(loop);
};
A_SALIR.ahora = () => { cancelAnimationFrame(RAF); pantallaEncendida(false); };
A_SALIR.cuenta = () => clearInterval(CDT);
function mostrarCtl(si) {
  const a = $('#ah'); if (!a) return; a.classList.toggle('ctl', si); clearTimeout(CTL_T);
  if (si && !(SES && SES.pausado)) CTL_T = setTimeout(() => { const b = $('#ah'); if (b) b.classList.remove('ctl'); }, 3500);
}
function pintarAhora() {
  if (!SES || !SES.ini) return;
  const rest = restante(), total = SES.dur * 6e4, arc = $('#ah-arc'), t = $('#ah-t');
  if (!arc) return;
  const fr = SES.fin ? 1 : Math.max(0, Math.min(1, rest / total));
  if (!SES.fin) arc.setAttribute('stroke-dasharray', `${(RING_C * fr).toFixed(1)} ${RING_C}`);
  if (t && !SES.fin) t.textContent = mmss(rest);
  const ah = $('#ah'); if (ah) ah.classList.toggle('late', !SES.fin && !SES.pausado && rest <= 10000 && rest > 0);
}
function empezarAhora() {
  SES.ini = Date.now(); SES.fase = 'ahora'; SES.fin = false; SES.pausas = 0; SES.pausado = null; SES.avisos = {}; saveSes();
  go('ahora', 'fade', true); arrancarTick();
  const r = $('#s-ahora .ah-ring'); if (r) animar(r, v => ({ transform: `scale(${.82 + .18 * v})` }), { w: 10, z: 6 });
  const i = $('#s-ahora .ah-info'); if (i) animar(i, v => ({ opacity: Math.min(1, v * 1.3), transform: `translateY(${(1 - v) * 30}px)` }), { w: 10, z: 7, delay: 120 });
}
let TICK = null;
function arrancarTick() { clearInterval(TICK); TICK = setInterval(tick, 500); tick(); }
function tick() {
  if (!SES || !SES.ini) return;
  const rest = restante(), total = SES.dur * 6e4, el_ = trabajado(), av = SES.avisos || (SES.avisos = {});
  if (!SES.pausado) {
    /* aviso antes de acabar */
    const antes = (SES.hiper ? 10 : S.aj.aviso) * 6e4;
    if (!av.antes && total >= antes * 2 && rest <= antes && rest > 0) { av.antes = 1; saveSes(); aviso(SES.hiper ? `Quedan 10 minutos para las ${SES.salida}` : `Quedan ${S.aj.aviso} minutos`, 'Ve cerrando lo que estás haciendo y apunta dónde te quedas para retomarlo.'); }
    /* recordatorios del hiperfoco */
    if (SES.hiper && SES.rec) {
      const c = SES.rec.cada;
      if (typeof c === 'number') { const n = Math.floor(el_ / (c * 6e4)); if (n > (av.rec || 0) && rest > 6e4) { av.rec = n; saveSes(); aviso(textoRecordatorio(SES.rec), `Llevas ${minTxt(el_ / 6e4)}. Cuando lo hagas, sigue con lo tuyo.`); } }
      else if (c === 'mitad' && !av.mitad && el_ >= total / 2) { av.mitad = 1; saveSes(); aviso(textoRecordatorio(SES.rec), 'Vas por la mitad. Cuando lo hagas, sigue con lo tuyo.'); }
    }
  }
  if (rest <= 0 && !SES.fin && !SES.pausado) finTiempo();
  if (ACT === 'hoy') { const h = $('#hoy-ses'); if (h) h.textContent = SES.fin ? 'Se ha acabado el tiempo. Toca para decidir.' : `Quedan ${mmss(rest)}. Toca para volver.`; }
}
function aviso(t, s) {
  sonar('aviso');
  if (ACT === 'ahora') { const b = $('#ah-banner'); if (!b) return; b.innerHTML = `${ic('campana', 26)}<div class="grow"><b>${esc(t)}</b><small>${esc(s)}</small></div>`; b.classList.add('on'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('on'), 9000); }
  else toast(t);
}
function finTiempo() {
  SES.fin = true; saveSes(); sonar('fin');
  const ah = $('#ah'); if (!ah) return;
  ah.classList.remove('late', 'ctl'); ah.classList.add('fin');
  const arc = $('#ah-arc');
  if (arc && arc.animate && !reduceMotion()) {
    arc.animate([{ strokeDasharray: `0 ${RING_C}`, stroke: '#FFF5E8' }, { strokeDasharray: `${RING_C} ${RING_C}`, stroke: '#FFB23A', offset: .6 }, { strokeDasharray: `${RING_C} ${RING_C}`, stroke: '#FFF5E8' }], { duration: 1100, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    const fl = $('#ah-flash'); if (fl) fl.animate([{ r: RING_R, opacity: .45 }, { r: RING_R + 60, opacity: 0 }], { duration: 700, delay: 400, easing: 'ease-out' });
    const sv = $('#ah-svg'); if (sv) animar(sv, v => ({ transform: `scale(${1 + .05 * Math.sin(Math.PI * Math.min(1, v))})` }), { w: 9, z: 7, delay: 400 });
  } else if (arc) arc.setAttribute('stroke-dasharray', `${RING_C} ${RING_C}`);
  $$('#ah .ah-end > *').forEach((x, i) => animar(x, v => ({ opacity: Math.min(1, v * 1.5), transform: `translateY(${(1 - v) * 40}px)` }), { w: 13, z: 6, delay: 700 + i * 80 }));
}

/* ---------- Me he atascado (hoja) ---------- */
function htmlAtasco(paso2) {
  if (paso2) return `<h2>Más pequeño</h2><p class="sub">¿Cuál sería un paso todavía más pequeño? Tan pequeño que dé casi risa.</p>
    <input class="inp" id="at-paso" style="margin-top:14px" placeholder="Ej.: escribir solo el título" enterkeyhint="done">
    <div style="height:14px"></div><button class="btn" data-a="at-paso-ok">Seguir con este paso</button>`;
  const o = [['pasos', 'Es demasiado grande', 'Lo partimos en un paso más pequeño', 'grande'],
    ['ojo', 'Me he distraído', 'Te enseño solo el paso en el que estabas', 'distraido'],
    ['reloj', 'No me apetece nada', 'Haz solo 2 minutos y luego decides', 'apetece'],
    ['ola', 'Estoy saturado', 'Lo dejamos aquí y vamos a Pausa, sin culpa', 'saturado']];
  return `<h2>¿Qué te ha pasado?</h2><p class="sub">Atascarse es normal. Elige lo que más se parece y te ayudo a seguir.</p>
    ${o.map(([i, t, s, k]) => `<button class="opt" data-a="at" data-x="${k}">${ic(i, 26)}<div class="grow"><b>${t}</b><small>${s}</small></div><span class="chev">${ic('sig', 18)}</span></button>`).join('')}
    <button class="link" data-a="cerrar-hoja">Cancelar</button>`;
}

/* ---------- Has arrancado ---------- */
let FIN = null;
R.fin = () => {
  if (!FIN) return `<div class="body nt">${topBack()}</div>`;
  const { est, real, extra } = FIN;
  const pr = FIN.premio;
  return `<div class="body nt"><div class="col">${topPlain()}
    <div class="center finpz">${P.anillo(118)}</div>
    <h1 class="center">¡Has arrancado!</h1><div class="sub center">Un anillo más para tu collage. Has estado ${minTxt(real)}${extra ? ` (habías pedido ${minTxt(extra)} más)` : ''}.</div>
    ${est ? `<div class="card sm"><div class="row">${ic('crono')}<b>Calibrador de tiempo</b></div>${barrasCalib(est, real)}<div class="s2">${FIN.cosa ? 'Si me dices que la has terminado, lo apunto para afinar tus próximas estimaciones.' : ''}</div></div>` : ''}
    ${pr ? `<div class="card sm row" style="background:var(--ks)">${ic('regalo', 28)}<div class="grow"><b>Te lo has ganado</b><div class="s2">De tu menú de dopamina: «${esc(pr.txt)}».</div></div></div>` : ''}
    ${FIN.cosa ? `<div class="q center">¿Has terminado la tarea?</div>` : ''}
    <div class="sp"></div>
    ${FIN.cosa ? `${FIN.sigue ? `<input class="inp" id="fin-paso" placeholder="¿Dónde te quedas? Apunta el siguiente paso" style="margin-bottom:12px" enterkeyhint="done"><button class="btn" data-a="fin-sigue-ok">Guardar y volver a Hoy</button>`
      : `<div class="two"><button class="btn soft" data-a="fin-sigue">No, sigue luego</button><button class="btn" data-a="fin-hecha">Sí, terminada</button></div>`}`
      : '<button class="btn" data-a="fin-ok">Volver a Hoy</button>'}
  </div></div>`;
};
A_RENDER.fin = s => { const p = s.querySelector('.finpz svg'); if (p) animar(p, v => ({ transform: `scale(${v}) rotate(${(1 - v) * -90}deg)` }), { w: 12, z: 5 }); };

function terminarSesion(conFin) {
  clearInterval(TICK); clearInterval(CDT); pantallaEncendida(false);
  if (!SES) { go('hoy', 'tab'); return; }
  const ms = SES.ini ? trabajado() : 0, s = SES;
  SES = null; saveSes(); AR = ARnuevo();
  if (ms < 60000) {
    if (conFin) { toast('Menos de un minuto: no cuenta como arranque. Cuando quieras, vuelves.'); go('arrancar', 'tab'); }
    return;
  }
  const real = Math.max(1, Math.round(ms / 6e4));
  commit(() => { S.arr.push({ id: s.id, cosa: s.cosa, ini: s.ini, real, est: s.est || null, extra: s.extra || 0, dur0: s.dur0, hecha: null, hiper: !!s.hiper }); pieza('anillo', s.cosa); }, null, false, true);
  if (conFin) {
    const prem = S.premios.length && (real >= 10 || s.extra) ? S.premios[Math.floor(rnd(s.id)() * S.premios.length)] : null;
    FIN = { cosa: s.cosa, est: s.est ? s.est : null, real, extra: s.extra || 0, id: s.id, premio: prem, sigue: false };
    go('fin', 'fade', true);
  }
}

/* =====================================================================
   Pausa
   ===================================================================== */
let TV = null, TV_ANT = null, PAUSA_ID = null;
const TRAMO = v => v <= 3 ? 0 : v <= 5 ? 1 : v <= 7 ? 2 : 3;
const TRAMOS = [
  { t: 'Estás bien.', d: 'No hace falta hacer nada más. Si quieres, lo apunto y sigues con lo tuyo.', b: 'Apuntar y seguir', a: 'p-guardar' },
  { t: 'Empieza a notarse.', d: 'Te propongo un minuto de respiración 4-6: coger aire en 4 segundos y soltarlo en 6. Baja el ritmo antes de que suba más.', b: 'Respirar 4-6', a: 'p-resp', x: '46' },
  { t: 'Es bastante.', d: 'Te propongo la respiración 4-7-8: es la que más calma el cuerpo. Si puedes, cambia de sitio cinco minutos.', b: 'Respirar 4-7-8', a: 'p-resp', x: '478' },
  { t: 'Para todo.', d: 'Ahora no es momento de decidir ni de contestar. Haz el STOP: cuatro pasos de veinte segundos para bajar el volumen.', b: 'Hacer el STOP', a: 'p-stop' }];
R.pausa = () => {
  const v = TV, tr = v ? TRAMOS[TRAMO(v)] : null;
  const th = Array.from({ length: 10 }, (_, k) => { const i = k + 1, r = 8 + i * 1.05, c = TERMO[k], on = v && i <= v;
    return `<button data-a="tv" data-x="${i}" aria-label="${i}">${svg(28, 40, `<path d="M${14 - r} 36 A${r} ${r} 0 0 1 ${14 + r} 36Z" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".35"/><path class="tf" d="M${14 - r} 36 A${r} ${r} 0 0 1 ${14 + r} 36Z" fill="${c}" style="transform-origin:14px 36px;transform:scale(${on ? 1 : 0})"/>`)}</button>`; }).join('');
  return `<div class="body"><div class="col">${topTab()}
    <h1>Pausa</h1><div class="sub">Para cuando algo se dispara: enfado, agobio, frustración… Dime cuánto lo sientes y te propongo qué hacer.</div>
    <div class="q">Del 1 al 10, ¿cuánto lo sientes ahora?</div>
    <div class="bignum" id="p-num"><span style="color:${v ? TERMO[v - 1] : 'var(--ink3)'}">${v || '–'}</span></div>
    <div class="thermo">${th}</div><div class="sl"><span>Casi nada</span><span>Muchísimo</span></div>
    <div id="p-prop">${tr ? `<div class="card sm"><b style="display:inline;font-size:15.5px">${tr.t}</b> <span style="font-size:15px;line-height:1.45">${tr.d}</span></div>` : '<div class="card sm"><span style="font-size:15px;color:var(--ink2);line-height:1.45">Toca un semicírculo. No hay respuesta mala: es solo para saber desde dónde partes.</span></div>'}</div>
    <div class="minis"><button data-a="ir-zoom" data-x="semaforo">${ic('semaforo', 19)}Semáforo</button><button data-a="ir-trace">${ic('lapiz', 19)}Escribirlo</button><button data-a="ir-zoom" data-x="guiones">${ic('bocadillo', 19)}Guiones</button></div>
    <div class="sp"></div><div style="height:16px"></div>
    <div id="p-btn">${tr ? `<button class="btn" data-a="${tr.a}" data-x="${tr.x || ''}">${tr.b}</button>` : `<button class="btn soft" data-a="ir" data-x="respirar">Solo quiero respirar</button>`}</div>
  </div></div>`;
};
/* termómetro: los semicírculos se rellenan en cascada y el número rueda */
function animarTermo(v, antes) {
  const tfs = $$('#s-pausa .tf');
  tfs.forEach((t, k) => { const on = k < v, era = antes && k < antes;
    if (on && !era) { const d = (k - (antes || 0)) * 60; t.style.transform = 'scale(0)'; animar(t, x => ({ transform: `scale(${Math.max(0, x)})` }), { w: 15, z: 6, delay: d, fill: 'forwards' }); setTimeout(() => { t.style.transform = 'scale(1)'; }, d + 900); }
    else t.style.transform = `scale(${on ? 1 : 0})`; });
  const n = $('#p-num');
  if (n) { const viejo = n.firstElementChild, nuevo = document.createElement('span'); nuevo.textContent = v; nuevo.style.color = TERMO[v - 1];
    n.appendChild(nuevo);
    if (viejo && !reduceMotion()) { const up = v > (antes || 0) ? 1 : -1;
      viejo.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-60 * up}px)`, opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' }).onfinish = () => viejo.remove();
      animar(nuevo, x => ({ transform: `translateY(${(1 - x) * 70 * up}px)`, opacity: Math.min(1, x * 2) }), { w: 14, z: 7 }); }
    else if (viejo) viejo.remove(); }
  const tr = TRAMOS[TRAMO(v)], pp = $('#p-prop'), pb = $('#p-btn');
  if (pp) { pp.innerHTML = `<div class="card sm"><b style="display:inline;font-size:15.5px">${tr.t}</b> <span style="font-size:15px;line-height:1.45">${tr.d}</span></div>`; animar(pp.firstElementChild, x => ({ opacity: Math.min(1, x * 1.5), transform: `translateY(${(1 - x) * 18}px)` }), { w: 12, z: 7 }); }
  if (pb) { pb.innerHTML = `<button class="btn" data-a="${tr.a}" data-x="${tr.x || ''}">${tr.b}</button>`; animar(pb.firstElementChild, x => ({ transform: `scale(${.92 + .08 * x})` }), { w: 14, z: 7 }); }
}
function guardarPausa(v) {
  const id = uid(); PAUSA_ID = id; TV_ANT = v;
  commit(() => { S.pau.push({ id, ts: Date.now(), v, despues: null }); pieza('pausa', id); }, null, false, true);
}

/* ---------- Respirar ---------- */
const RESP = {
  '46': { n: '4-6 · un minuto', d: 'Coge aire en 4 y suéltalo en 6. Para empezar a calmarte.', f: [['Coge aire', 4, 1], ['Suelta despacio', 6, 0]], r: 6 },
  caja: { n: 'Caja 4-4-4-4', d: 'Dentro, aguanta, fuera, aguanta. Para centrarte antes de algo.', f: [['Coge aire', 4, 1], ['Aguanta', 4, 1], ['Suelta despacio', 4, 0], ['Aguanta', 4, 0]], r: 4 },
  '478': { n: '4-7-8 · la que más calma', d: 'Dentro 4, aguanta 7, fuera 8. Para cuando lo sientes alto.', f: [['Coge aire', 4, 1], ['Aguanta', 7, 1], ['Suelta despacio', 8, 0]], r: 4 },
  doble: { n: 'Suspiro doble', d: 'Dos tomas de aire por la nariz y una salida larga por la boca. Es la más rápida.', f: [['Coge aire', 2, .8], ['Un poco más', 1, 1], ['Suelta despacio', 6, 0]], r: 5 },
  '55': { n: 'Coherente 5-5', d: 'Cinco segundos dentro y cinco fuera, durante seis minutos. Para antes de dormir.', f: [['Coge aire', 5, 1], ['Suelta despacio', 5, 0]], r: 36 }
};
const RESP_ORD = ['46', 'caja', '478', 'doble', '55'];
let RTIPO = null, RS = null, RT = null;
R.respirar = () => {
  if (!RTIPO) RTIPO = S.aj.resp in RESP ? S.aj.resp : '478';
  const T = RESP[RTIPO];
  if (!RS) return `<div class="body"><div class="col">${topBack('Pausa')}
    <h1>Respirar</h1><div class="sub">Elige cómo. Si no sabes cuál, la 4-7-8 es la que más calma.</div>
    ${RESP_ORD.map(k => [k, RESP[k]]).map(([k, x]) => `<button class="opt ${RTIPO === k ? 'sel' : ''}" data-a="r-tipo" data-x="${k}"><div class="grow"><b>${x.n}</b><small>${x.d}</small></div><span class="radio ${RTIPO === k ? 'on' : ''}"></span></button>`).join('')}
    <div class="sp"></div><div style="height:16px"></div><button class="btn" data-a="r-go">Empezar</button>
  </div></div>`;
  if (RS.fin) {
    const antes = TV_ANT;
    return `<div class="body nt resp"><div class="col" style="text-align:center">${topPlain()}
      <div class="center" style="margin-top:10px">${svg(150, 150, `<circle cx="75" cy="75" r="68" fill="#fff" opacity=".4"/><path class="chk" d="M45 77l20 20 42-44" fill="none" stroke="#1F2E35" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="100" stroke-dashoffset="100"/>`)}</div>
      <h1>${RS.hechas ? `${cap(NUMTXT[RS.hechas] || String(RS.hechas))} ${RS.hechas === 1 ? 'ronda hecha' : 'rondas hechas'}.` : 'Has parado un momento.'}</h1>
      <div class="sub" style="color:#1F2E35">${antes ? `Antes lo sentías a ${antes}. ` : ''}Del 1 al 10, ¿cómo estás ahora?</div>
      <div class="nums">${TERMO.map((c, k) => `<button style="background:${c};--i:${k}" data-a="r-despues" data-x="${k + 1}">${k + 1}</button>`).join('')}</div>
      <div class="sp"></div><button class="link" data-a="r-salir" style="color:#1F2E35">Prefiero no apuntarlo</button></div></div>`;
  }
  return `<div class="body nt resp"><div class="col">${topPlain()}
    <div class="kick" id="r-k">${T.n.split(' · ')[0]} · ronda ${RS.ronda} de ${T.r}</div><h1>Respirar</h1>
    <div class="breath"><svg width="290" height="290" viewBox="0 0 290 290"><g class="bg" id="r-g"><circle cx="145" cy="145" r="140" fill="#fff" opacity=".28"/><circle cx="145" cy="145" r="104" fill="#fff" opacity=".45"/></g><circle class="bc" id="r-c" cx="145" cy="145" r="72" fill="#FFF5E8"/></svg>
      <div class="bt"><small id="r-f">Prepárate</small><div class="roll" id="r-n"><span>·</span></div></div></div>
    <p class="center" style="font-size:15px;margin-bottom:16px">Suelta los hombros. Mandíbula floja.</p>
    <button class="btn light" data-a="r-fin">Terminar</button>
  </div></div>`;
};
function rodillo(el_, txt) {
  if (!el_) return; const viejo = el_.lastElementChild; if (viejo && viejo.textContent === String(txt)) return;
  const n = document.createElement('span'); n.textContent = txt; el_.appendChild(n);
  if (viejo && !reduceMotion()) { viejo.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-56px)', opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' }).onfinish = () => viejo.remove();
    n.animate([{ transform: 'translateY(56px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1.15)' }); }
  else if (viejo) viejo.remove();
}
function respirarGo() {
  const T = RESP[RTIPO]; S.aj.resp = RTIPO; save();
  RS = { ronda: 1, fase: 0, hechas: 0, fin: false }; render('respirar'); themeColor('respirar');
  const g = $('#r-g'), c = $('#r-c'); const esc_ = v => .58 + .42 * v;
  if (g) g.style.transform = `scale(${esc_(0)})`; if (c) c.style.transform = `scale(${.82 + .18 * esc_(0)})`;
  let seg = 0;
  const paso = () => {
    if (!RS || RS.fin || ACT !== 'respirar') return;
    const [nom, dur, v] = T.f[RS.fase];
    if (seg === 0) { const gg = $('#r-g'), cc = $('#r-c');
      [gg, cc].forEach((e, k) => { if (!e) return; e.style.transitionDuration = dur + 's'; e.style.transform = `scale(${k ? .82 + .18 * esc_(v) : esc_(v)})`; });
      const f = $('#r-f'); if (f) f.textContent = nom; }
    rodillo($('#r-n'), dur - seg);
    seg++;
    if (seg >= dur) { seg = 0; RS.fase++; if (RS.fase >= T.f.length) { RS.fase = 0; RS.hechas++; RS.ronda++; if (RS.ronda > T.r) { RS.ronda = T.r; terminarResp(); return; } const k = $('#r-k'); if (k) k.textContent = `${T.n.split(' · ')[0]} · ronda ${RS.ronda} de ${T.r}`; } }
    RT = setTimeout(paso, 1000);
  };
  clearTimeout(RT); RT = setTimeout(paso, 500);
}
function terminarResp() {
  clearTimeout(RT); if (!RS) RS = { hechas: 0 };
  RS.fin = true;
  if (!PAUSA_ID) guardarPausa(null);
  render('respirar');
  const ch = $('#s-respirar .chk'); if (ch && ch.animate) ch.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: reduceMotion() ? 1 : 500, delay: 150, easing: 'ease-out', fill: 'forwards' }); else if (ch) ch.style.strokeDashoffset = 0;
  $$('#s-respirar .nums button').forEach((b, k) => animar(b, v => ({ transform: `scale(${v})`, opacity: Math.min(1, v * 2) }), { w: 14, z: 7, delay: 250 + k * 35 }));
}
A_SALIR.respirar = () => { clearTimeout(RT); };

/* ---------- Semáforo y STOP: no se pueden saltar ---------- */
const SEMS = [
  { c: COL.hot, n: 'Para.', t: 'Rojo · Para', d: 'Deja lo que estés haciendo. Respira hondo tres veces y ponle nombre a lo que sientes: «esto es frustración», «esto es agobio».', s: 20, sig: 'Siguiente: observa' },
  { c: COL.s, n: 'Observa.', t: '¿Dónde lo notas?', d: 'Recorre el cuerpo: mandíbula, pecho, hombros, estómago. Solo míralo; no hace falta cambiar nada.', s: 30, sig: 'Siguiente: elige' },
  { c: COL.n, n: 'Elige.', t: '¿Qué haces ahora?', d: 'Decide desde la calma, no desde el impulso: seguir, parar un rato o hablarlo más tarde. Las tres valen.', s: 20, sig: 'Hecho' }];
let SEMI = 0, SEMT0 = 0, STT = null;
R.semaforo = () => {
  const x = SEMS[SEMI];
  return `<div class="body nt"><div class="col">${topBack('Pausa')}
    <div class="kick">Semáforo · paso ${SEMI + 1} de 3</div><h1>${x.n}</h1><div class="sub">Tres pasos cortos para no reaccionar en caliente. Cada uno tiene su tiempo; cuando acaba, puedes seguir.</div>
    <div class="semc" key="${SEMI}"><div class="lights">${SEMS.map((y, i) => `<i style="background:${y.c};${i === SEMI ? 'box-shadow:0 0 0 6px var(--ks)' : 'opacity:.22'}"></i>`).join('')}</div>
      <b>${x.t}</b><p>${x.d}</p><div class="tmr" id="st-t"></div></div>
    <div class="sp"></div><div style="height:16px"></div><button class="btn" id="st-b" data-a="sem-sig" disabled>${x.sig}</button></div></div>`;
};
const STOP = [['S', 'Para', 'Detén lo que estés haciendo. Las manos quietas y nada de responder ahora.'],
  ['T', 'Da un paso atrás', 'Literalmente: aléjate un metro de lo que estabas haciendo y suelta los hombros.'],
  ['O', 'Observa', 'Qué notas en el cuerpo, qué piensas y qué emoción es. Sin juzgarte.'],
  ['P', 'Sigue con calma', 'Ahora sí: elige qué haces. Si no lo tienes claro, puede esperar a mañana.']];
let ST = { i: 0, t0: 0 };
R.stop = () => {
  const s = STOP[ST.i];
  return `<div class="body nt"><div class="col">${topBack('Pausa')}
    <div class="kick">Técnica STOP · ${ST.i + 1} de 4</div><h1>Sin prisa.</h1>
    <div class="stopc"><div class="stopl">${s[0]}</div><b>${s[1]}</b><p>${s[2]}</p><div class="tmr" id="st-t"></div></div>
    <div class="letters">${STOP.map((x, i) => `<span class="${i < ST.i ? 'd' : i === ST.i ? 'on' : ''}">${x[0]} · ${['Para', 'Atrás', 'Observa', 'Sigue'][i]}</span>`).join('')}</div>
    <div class="card sm row" style="margin-top:16px"><span class="bdot"><i></i></span><div class="grow"><b>Mientras, respira</b><div class="s2" id="st-r">Coge aire en 4…</div></div></div>
    <div class="sp"></div><div style="height:16px"></div><button class="btn" id="st-b" data-a="st-sig" disabled>Siguiente</button></div></div>`;
};
function pasoTick() {
  const t = $('#st-t'), b = $('#st-b'); if (!t || !b) { clearInterval(STT); return; }
  const total = ACT === 'semaforo' ? SEMS[SEMI].s : 20, t0 = ACT === 'semaforo' ? SEMT0 : ST.t0;
  const r = Math.max(0, total - Math.floor((Date.now() - t0) / 1000)), fr = (total - r) / total, C = 2 * Math.PI * 10;
  t.innerHTML = svg(26, 26, `<circle cx="13" cy="13" r="10" fill="none" stroke="rgba(31,46,53,.2)" stroke-width="3.5"/><circle cx="13" cy="13" r="10" fill="none" stroke="#1F2E35" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${(C * fr).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 13 13)"/>`) + `<span>${r ? r + ' s' : 'Listo'}</span>`;
  const sig = ACT === 'semaforo' ? SEMS[SEMI].sig : (ST.i < 3 ? 'Siguiente: ' + ['Para', 'atrás', 'observa', 'sigue'][ST.i + 1].toLowerCase() : 'Hecho');
  const lab = r ? `${sig.split(':')[0]} en ${r} s` : sig;
  if (b.textContent !== lab) b.textContent = lab;
  if (!r && b.disabled) { b.disabled = false; animar(b, v => ({ transform: `scale(${.94 + .06 * v})` }), { w: 16, z: 6 }); }
  const rr = $('#st-r'); if (rr) { const ciclo = ((Date.now() - t0) / 1000) % 10; rr.textContent = ciclo < 4 ? 'Coge aire en 4…' : 'Suéltalo en 6…'; }
}
function empezarPasos() { clearInterval(STT); STT = setInterval(pasoTick, 250); pasoTick(); const c = $('#s-' + ACT + ' .semc, #s-' + ACT + ' .stopc'); if (c) animar(c, v => ({ opacity: Math.min(1, v * 1.4), transform: `translateX(${(1 - v) * 40}px)` }), { w: 12, z: 7 }); }
A_SALIR.semaforo = () => clearInterval(STT); A_SALIR.stop = () => clearInterval(STT);

/* ---------- Escribirlo ---------- */
const TR_OP = {
  t: ['Trabajo', 'Una persona', 'Una tarea', 'Un mensaje', 'Un cambio de planes', 'Una crítica', 'Un olvido', 'Prisa', 'Ruido', 'Cansancio', 'Hambre'],
  r: ['Ansiedad', 'Frustración', 'Agobio', 'Enfado', 'Tristeza', 'Impaciencia', 'Vergüenza', 'Culpa', 'Rechazo', 'Aburrimiento'],
  c: ['Estómago', 'Cabeza', 'Pecho', 'Hombros', 'Mandíbula', 'Garganta', 'Manos', 'Todo el cuerpo'],
  a: ['Respirar', 'Comer algo', 'STOP', 'Alejarme un rato', 'Moverme', 'Hablar con alguien', 'Beber agua', 'Nada todavía'],
  e: ['Partir la tarea antes de empezar', 'Parar antes de saturarme', 'Comer antes', 'Avisar de que necesito tiempo', 'No contestar en caliente']
};
let TRF = null;
const trNew = () => ({ t: [], r: [], c: [], a: [], f: null, e: '', v: TV || null, otro: null });
function ordenados(k) {
  const cnt = {}; S.diario.forEach(d => (d[k] || []).forEach(x => cnt[x] = (cnt[x] || 0) + 1));
  const extra = Object.keys(cnt).concat(TRF ? TRF[k] : []).filter((x, i, a) => !TR_OP[k].includes(x) && a.indexOf(x) === i);
  return TR_OP[k].concat(extra).map((x, i) => [x, i]).sort((a, b) => (cnt[b[0]] || 0) - (cnt[a[0]] || 0) || a[1] - b[1]).map(x => x[0]);
}
R.trace = () => {
  if (!TRF) TRF = trNew();
  const chips = k => { const xs = ordenados(k), sel = TRF[k], vis = xs.slice(0, 12); sel.forEach(x => { if (!vis.includes(x)) vis.push(x); });
    return `<div class="chips sm">${vis.map(x => `<button class="ch ${sel.includes(x) ? 'on' : ''}" data-a="tr" data-k="${k}" data-x="${esc(x)}">${esc(x)}</button>`).join('')}<button class="ch add" data-a="tr-otro" data-k="${k}">${ic('mas', 14)} Otro</button></div>
    ${TRF.otro === k ? `<div class="row" style="margin-top:8px"><input class="inp" id="tr-otro" placeholder="Escríbelo" enterkeyhint="done"><button class="pill2" data-a="tr-otro-ok" data-k="${k}">Añadir</button></div>` : ''}`; };
  return `<div class="body"><div class="col">${topBack('Pausa')}
    <h1>Escribirlo</h1><div class="sub">Apuntar lo que ha pasado te ayuda a ver qué te dispara y qué te funciona. No hace falta escribir: toca las opciones que encajen (puedes marcar varias).</div>
    <div class="lab2">1 · ¿Qué lo ha provocado?</div>${chips('t')}
    <div class="lab2">2 · ¿Qué has sentido?${TRF.v ? `<em>lo sentías a ${TRF.v} de 10</em>` : ''}</div>${chips('r')}
    <div class="lab2">3 · ¿Dónde lo notas en el cuerpo?</div>${chips('c')}
    <div class="lab2">4 · ¿Qué has probado para calmarte?</div>${chips('a')}
    <div class="lab2">5 · ¿Te ha servido?</div>
    <div class="seg">${['Sí', 'Un poco', 'No'].map((x, i) => `<button class="${TRF.f === i ? 'on' : ''}" data-a="tr-f" data-x="${i}">${x}</button>`).join('')}</div>
    <div class="lab2">6 · ¿Qué harás distinto la próxima vez?</div>
    <input class="inp" id="tr-e" placeholder="Una sola cosa (opcional)" value="${esc(TRF.e)}">
    <div class="chips sm" style="margin-top:8px">${ordenadosE().map(x => `<button class="ch" data-a="tr-e" data-x="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <div style="height:18px"></div><button class="btn" data-a="tr-guardar">Guardar en mi diario</button>
    ${S.diario.length ? `<button class="link acc" data-a="ir" data-x="diario">Ver mi diario (${S.diario.length} ${S.diario.length === 1 ? 'nota' : 'notas'})</button>` : ''}
  </div></div>`;
};
const ordenadosE = () => { const prev = S.diario.map(d => d.e).filter(Boolean); return [...new Set(prev.reverse().concat(TR_OP.e))].slice(0, 5); };
R.diario = () => `<div class="body"><div class="col">${topBack('Escribirlo')}<h1>Tu diario</h1><div class="sub">Lo más reciente, arriba. Mantén pulsada una nota para borrarla.</div>
  ${S.diario.slice().reverse().slice(0, 60).map(d => { const dt = new Date(d.ts), F_ = ['Sí', 'Un poco', 'No del todo'];
    const filas = [['Causa', (d.t || []).join(' · ')], ['Emoción', (d.r || []).join(' · ')], ['En el cuerpo', (d.c || []).join(' · ')], ['Para calmarte', (d.a || []).join(' · ')], ['¿Ha servido?', d.f != null ? F_[d.f] : ''], ['La próxima vez', d.e || '']].filter(x => x[1]);
    return `<div class="card" data-press="diario" data-x="${d.ts}"><div class="dh"><small>${cap(fechaLarga(ymd(dt)))} · ${pad(dt.getHours())}:${pad(dt.getMinutes())}</small>${d.v ? `<span class="pill" style="background:${TERMO[d.v - 1]}">${d.v} de 10</span>` : ''}</div>
      ${filas.map(([a, b]) => `<div class="dr"><small>${a}</small><b>${esc(b)}</b></div>`).join('')}</div>`; }).join('') || '<div class="empty">Todavía no has escrito nada.</div>'}
  </div></div>`;

/* ---------- Guiones ---------- */
const GUIONES = [
  ['Trabajo', 'Necesito tiempo para pensarlo', 'Gracias por contármelo. Necesito un poco de tiempo para pensarlo bien. ¿Lo retomamos mañana a las 10? Quiero darte una buena respuesta.'],
  ['Trabajo', 'No tengo claras las prioridades', 'Tengo varias cosas encima y quiero hacerlas bien. ¿Me dices cuál va primero y para cuándo necesitas cada una?'],
  ['Trabajo', 'Me están interrumpiendo', 'Ahora mismo estoy con algo que necesita toda mi atención. ¿Lo vemos a las 12? Así te escucho bien.'],
  ['Trabajo', 'Decir que no a algo más', 'Me gustaría ayudarte, pero ahora no puedo hacerlo bien. Si lo dejamos para el lunes, me comprometo.'],
  ['Trabajo', 'Pedirlo por escrito', 'Para no dejarme nada, ¿me lo mandas por escrito en tres puntos? Así lo tengo delante.'],
  ['Trabajo', 'Una reunión que se alarga', 'Tengo que irme a las 18:00. ¿Dejamos claros los siguientes pasos antes de cerrar?'],
  ['Trabajo', 'Pedir más plazo', 'Quiero entregarlo bien y con el plazo actual no llego. ¿Te vale si lo tienes el jueves a primera hora?'],
  ['Trabajo', 'Me he equivocado', 'Me he equivocado en esto y ya lo estoy corrigiendo. Te aviso en cuanto esté, como muy tarde a la una.'],
  ['Trabajo', 'No he entendido la tarea', 'Para no hacerlo mal, ¿me explicas qué esperas exactamente y cómo sabré que está terminado?'],
  ['Trabajo', 'Pedir un sitio tranquilo', 'Me concentro mucho mejor sin ruido. ¿Puedo trabajar en la sala pequeña esta mañana?'],
  ['Trabajo', 'Me piden algo urgente', 'Ahora mismo estoy con otra cosa. Si esto es más urgente, la dejo; si no, me pongo a las 12. ¿Qué prefieres?'],
  ['Trabajo', 'Un correo difícil', 'Gracias por tu correo. Lo he leído con atención y quiero responderte bien. Te escribo mañana con calma.'],
  ['Trabajo', 'Pedir una pausa en una reunión', '¿Podemos parar cinco minutos? Así sigo atento el resto de la reunión.'],
  ['Familia', 'Necesito un rato a solas', 'Estoy a gusto con vosotros, pero necesito un rato a solas para recargar. Vuelvo en veinte minutos.'],
  ['Familia', 'He contestado mal', 'Perdona, he contestado mal. No era por ti, estaba saturado. ¿Lo hablamos con calma?'],
  ['Familia', 'Pedir ayuda', 'Me está costando organizar esto. ¿Me echas una mano con la primera parte?'],
  ['Familia', 'Un cambio de planes', 'Me cuesta cuando los planes cambian de repente. Dame cinco minutos para reorganizarme y te digo.'],
  ['Familia', 'Explicar cómo funciono', 'No es que no me importe: a mi cabeza le cuesta arrancar. Si me lo recuerdas con un mensaje, me ayudas mucho.'],
  ['Familia', 'Me lo decís de pasada', 'Si me lo decís de pasada, se me va. ¿Me lo mandáis por mensaje y así lo apunto?'],
  ['Familia', 'Una comida que se alarga', 'Me lo estoy pasando bien, pero llevo mucho rato y necesito salir a tomar el aire diez minutos.'],
  ['Familia', 'Poner un límite', 'Sé que lo dices con cariño, pero prefiero no hablar de esto hoy. ¿Lo dejamos?'],
  ['Familia', 'Me ha dolido una crítica', 'Me ha dolido cómo lo has dicho. Si me lo dices de otra forma, te escucho mejor.'],
  ['Familia', 'Repartir las tareas de casa', '¿Hacemos una lista de lo que hay que hacer y cada uno elige? Si está escrito, me organizo mucho mejor.'],
  ['Familia', 'Llamar más tarde', 'Ahora no puedo hablar bien. ¿Te llamo esta tarde a las siete?'],
  ['Pareja', 'Bajar el tono', 'Te quiero y quiero entenderte. Ahora estoy demasiado alterado para hablar bien. ¿Paramos diez minutos y seguimos?'],
  ['Pareja', 'Me he perdido mientras hablabas', 'Perdona, me he perdido un momento. No es que no me interese. ¿Me lo repites?'],
  ['Pareja', 'Pedir lo que necesito', 'Me ayudaría mucho dejarlo apuntado en un sitio que veamos los dos. Así no depende de mi memoria.'],
  ['Pareja', 'Necesito silencio', 'No estoy enfadado: tengo la cabeza llena. Un rato de silencio y vuelvo a estar contigo.'],
  ['Pareja', 'Repartir tareas', '¿Hacemos una lista de lo de casa y elegimos cada uno? Me organizo mucho mejor si está escrito.'],
  ['Pareja', 'Se me ha olvidado algo nuestro', 'Se me ha olvidado y entiendo que te moleste. No es falta de interés. ¿Lo apuntamos en un calendario compartido?'],
  ['Pareja', 'Avísame antes', 'Me cuesta mucho cambiar de plan de golpe. Si me avisas con un poco de tiempo, lo llevo mucho mejor.'],
  ['Pareja', 'No he visto el móvil', 'Perdona, me he metido de lleno en algo y no he visto el móvil. Ya estoy aquí.'],
  ['Pareja', 'Pedir perdón bien', 'Lo siento. No ha estado bien cómo he reaccionado. ¿Me cuentas cómo te has sentido?'],
  ['Pareja', 'Un plan tranquilo', 'Esta semana voy muy cargado. ¿Hacemos algo tranquilo en casa el viernes?'],
  ['Pareja', 'Dar las gracias', 'Gracias por tener paciencia cuando se me va la cabeza. Lo noto y lo valoro mucho.'],
  ['Amistades', 'Llego tarde', 'Lo siento, llego unos quince minutos tarde. Pedid sin mí, que ahora os alcanzo.'],
  ['Amistades', 'Me retiro antes', 'Me lo estoy pasando muy bien, pero estoy llegando a mi límite. Me voy yendo. ¡Repetimos pronto!'],
  ['Amistades', 'No he contestado', 'Perdona por tardar en contestar: lo leí y se me pasó. Me apetece mucho, ¿quedamos el sábado?'],
  ['Amistades', 'Cancelar sin culpa', 'Hoy no voy a estar bien para quedar y prefiero decírtelo. ¿Lo movemos a la semana que viene?'],
  ['Amistades', 'Pedir un plan tranquilo', 'Me apetece veros, pero hoy necesito algo tranquilo. ¿Un café en vez de una cena?'],
  ['Amistades', 'Llevo tiempo sin escribir', 'Llevo un tiempo desaparecido, pero me acuerdo mucho de ti. ¿Nos ponemos al día esta semana?'],
  ['Amistades', 'No me acuerdo del plan', 'Perdona, ¿me recuerdas a qué hora y dónde habíamos quedado? Lo apunto ahora mismo.'],
  ['Amistades', 'Demasiada gente', 'Me apetece verte, pero los sitios con mucha gente me agotan. ¿Quedamos tú y yo?'],
  ['Amistades', 'Decir que no a un plan', 'Gracias por contar conmigo. Esta vez paso, que necesito descansar. ¡Avísame para la próxima!'],
  ['Amistades', 'Te he cortado', 'Perdona, te he cortado. Sigue, que quiero escucharte.'],
  ['Amistades', 'Me he equivocado de día', '¡Qué despiste! Me he equivocado de día. ¿Te va bien mañana a la misma hora?'],
  ['Saturación', 'Estoy saturado', 'Ahora mismo estoy saturado y no puedo responder bien. Necesito diez minutos y vuelvo.'],
  ['Saturación', 'Demasiado ruido', 'Hay demasiado ruido para mí. ¿Nos vamos a un sitio más tranquilo para seguir hablando?'],
  ['Saturación', 'Demasiadas cosas a la vez', 'Me estás contando muchas cosas a la vez. ¿Vamos una a una?'],
  ['Saturación', 'Necesito procesarlo', 'Esto me ha removido. Déjame procesarlo y te contesto con calma esta tarde.'],
  ['Saturación', 'Un mensaje en caliente', 'Para ti: escríbelo, déjalo en borradores treinta minutos y vuelve a leerlo antes de enviarlo.'],
  ['Saturación', 'Salir un momento', 'Necesito salir un momento a tomar el aire. Vuelvo en cinco minutos.'],
  ['Saturación', 'No puedo decidir ahora', 'Ahora mismo no puedo decidir bien. Déjame pensarlo y te digo esta tarde.'],
  ['Saturación', 'Bajar el volumen', 'Me cuesta seguirte con este volumen. ¿Lo hablamos un poco más bajo?'],
  ['Saturación', 'Silenciar el móvil', 'Voy a silenciar el móvil una hora para centrarme. Si es urgente, llámame.'],
  ['Saturación', 'Para ti: es saturación', 'Esto es saturación y se pasa. Primero respiro; luego decido.'],
  ['Saturación', 'Para ti: demasiado en la cabeza', 'Voy a apuntarlo todo en una lista. Luego elijo una sola cosa.'],
  ['Olvidos', 'He olvidado algo importante', 'Tienes razón, se me olvidó y entiendo que es un fastidio. ¿Te parece si lo arreglo así: …?'],
  ['Olvidos', 'Se me ha pasado el plazo', 'Se me ha pasado el plazo y lo siento. Puedo tenerlo mañana a las 12. ¿Te vale?'],
  ['Olvidos', 'No recuerdo lo que hablamos', 'Quiero hacerlo bien, pero no me acuerdo de los detalles. ¿Me los recuerdas o me los mandas por escrito?'],
  ['Olvidos', 'Una cita olvidada', 'Me he olvidado de la cita y lo siento de verdad. ¿Buscamos otro hueco? Esta vez lo apunto delante de ti.'],
  ['Olvidos', 'Un cumpleaños olvidado', '¡Felicidades con retraso! Se me pasó la fecha, pero no tú. ¿Te invito a algo esta semana?'],
  ['Olvidos', 'No he contestado un mensaje', 'Perdona, vi tu mensaje y se me pasó contestarte. Te respondo ahora.'],
  ['Olvidos', 'No he traído algo', 'Se me ha olvidado traerlo. Te lo traigo mañana a primera hora o te lo mando ahora por correo.'],
  ['Olvidos', 'Repetir las instrucciones', '¿Me lo repites despacio? Quiero apuntarlo para no olvidarlo.'],
  ['Olvidos', 'Se me ha pasado una reunión', 'Lo siento, se me ha pasado la reunión. ¿Me cuentas lo importante o buscamos otro hueco?'],
  ['Olvidos', 'Para ti: he perdido algo', 'Mira primero en los tres sitios de siempre. Respira: casi siempre aparece en el segundo.'],
  ['Olvidos', 'Para ti: la regla de los dos minutos', 'Si se hace en menos de dos minutos, hazlo ahora. Si no, apúntalo en Más tarde.'],
  ['Para ti', 'Cuando no arrancas', 'No tengo que hacerlo entero. Solo el primer paso.'],
  ['Para ti', 'Cuando te comparas', 'Mi cabeza funciona distinto, no peor. Hoy hago lo que cabe.'],
  ['Para ti', 'Cuando te culpas por un olvido', 'Olvidar no es no importar. Lo arreglo y sigo.'],
  ['Para ti', 'Cuando lo dejas para el final', 'Diez minutos ahora valen más que una hora con prisas.'],
  ['Para ti', 'Cuando hay mucho pendiente', 'No tengo que hacerlo todo hoy. Elijo una cosa.'],
  ['Para ti', 'Después de un mal día', 'Un mal día no es una mala vida. Mañana empiezo de nuevo.'],
  ['Para ti', 'Antes de algo que te agobia', 'Respiro, parto la tarea y empiezo por lo más fácil.'],
  ['Para ti', 'Cuando te pierdes en el móvil', 'Dejo el móvil boca abajo y vuelvo al paso en el que estaba.'],
  ['Para ti', 'Cuando te saturas', 'Parar también es avanzar.'],
  ['Para ti', 'Cuando algo sale bien', 'Lo he conseguido. Lo apunto para acordarme la próxima vez que dude.'],
  ['Para ti', 'Cuando te cuesta pedir ayuda', 'Pedir ayuda es una forma de organizarme, no de fallar.'],
  ['Para ti', 'Cuando te saltas la rutina', 'No pasa nada. Vuelvo a la versión Nuclear y sigo.']
];
const GCATS = [['Todos', ''], ['Trabajo', 'trabajo'], ['Familia', 'casa'], ['Pareja', 'corazon'], ['Amistades', 'personas'], ['Saturación', 'ola'], ['Olvidos', 'olvido'], ['Para ti', 'sol'], ['Míos', 'estrella']];
const GIC = Object.fromEntries(GCATS);
let GOPEN = null, GNEW = false;
R.guiones = () => {
  const mios = S.guiones.map(g => ['Míos', g.titulo, g.texto, g.id]);
  const todos = GUIONES.concat(mios), all = todos.filter(g => S.ui.gcat === 'Todos' || g[0] === S.ui.gcat);
  return `<div class="body"><div class="col">${topBack('Pausa', `<button class="ib" data-a="g-new" aria-label="Nuevo guion">${ic('mas', 23)}</button>`)}
    <h1>Guiones</h1><div class="sub">Frases preparadas para cuando cuesta hablar. Ábrelas, cópialas y cámbialas a tu manera. Las que dicen «Para ti» son para decírtelas a ti.</div>
    <div class="chips sm" style="margin-top:12px">${GCATS.map(([c, i]) => `<button class="ch ${S.ui.gcat === c ? 'on' : ''}" data-a="g-cat" data-x="${c}">${i ? ic(i, 14) : ''}${c}${c === 'Todos' ? ' · ' + todos.length : ''}</button>`).join('')}</div>
    ${GNEW ? `<div class="card"><b>Nuevo guion</b><input class="inp" id="g-t" placeholder="Para cuándo (ej.: me piden algo urgente)" style="margin-top:10px"><textarea class="inp" id="g-x" placeholder="La frase, tal cual la dirías" style="margin-top:8px"></textarea><div class="two" style="margin-top:10px"><button class="btn ghost" data-a="g-new">Cancelar</button><button class="btn" data-a="g-save">Guardar</button></div></div>` : ''}
    <div class="enter">${all.map((g, i) => { const k = g[3] || g[1]; const on = GOPEN === k;
      return `<div class="card sm gcard ${on ? 'on' : ''}" style="--i:${Math.min(i, 10)}" ${g[3] ? `data-press="guion" data-x="${g[3]}"` : ''}><button class="gc" data-a="g-open" data-x="${esc(k)}">${ic(GIC[g[0]] || 'bocadillo', 22)}<b>${esc(g[1])}</b><span class="chev">${ic('sig', 18)}</span></button>
        <div class="gtxt"><p>«${esc(g[2])}»</p><div class="row" style="margin-top:10px"><span style="font-size:12px;color:var(--ink2);flex:1">${g[0]}</span><button class="pill2" data-a="g-copy" data-x="${esc(g[2])}">Copiar</button></div></div></div>`; }).join('') || '<div class="empty">Aún no tienes guiones tuyos. Toca + arriba para crear uno.</div>'}</div>
  </div></div>`;
};

/* =====================================================================
   Cierre del día
   ===================================================================== */
function mejorDelDia() {
  const d = dia(), n = t => d.piezas.filter(p => p.t === t).length, h = n('hoja'), s = n('anillo'), p = n('pausa');
  if (s && d.nivel === 0) return 'Has arrancado en un día de Nuclear.';
  if (s >= 2) return 'Has empezado aunque no te apetecía, y más de una vez.';
  if (s) return 'Has empezado aunque no te apetecía.';
  if (h) return h === 1 ? 'Has hecho una cosa. Cuenta.' : `Has hecho ${h} cosas.`;
  if (p) return 'Has parado cuando lo necesitabas.';
  return 'Hoy tocaba descansar. También vale.';
}
let CI = {};
R.cierre = () => {
  const d = dia(), ps = d.piezas, n = t => ps.filter(p => p.t === t).length;
  const pend = pendHoy();
  return `<div class="body nt"><div class="col">${topBack('Hoy')}
    <h1>Cierre del día</h1><div class="sub">Así ha ido hoy. Mira tu collage, decide qué hacer con lo pendiente y guárdalo. Son veinte segundos.</div>
    <div class="card colla" id="ci-col">${collageSvg(ps, 255, 150, hoyStr(), 'ci-svg')}</div>
    <div class="legend"><span>${P.hoja(15)} <b class="cu" data-n="${n('hoja')}">0</b> ${n('hoja') === 1 ? 'cosa hecha' : 'cosas hechas'}</span><span>${P.anillo(14)} <b class="cu" data-n="${n('anillo')}">0</b> ${n('anillo') === 1 ? 'arranque' : 'arranques'}</span><span>${P.pausa(16)} <b class="cu" data-n="${n('pausa')}">0</b> ${n('pausa') === 1 ? 'pausa' : 'pausas'}</span></div>
    <div class="lab" style="margin-top:16px">Lo mejor de hoy (puedes cambiarlo)</div><input class="inp" id="ci-mejor" value="${esc(d.mejor || mejorDelDia())}" enterkeyhint="done">
    ${pend.length ? `<div class="lab">Te ha quedado (y no pasa nada)</div><div class="card sm">${pend.map(c => `<div class="lrow"><span style="flex:1">${esc(c.txt)}</span><span class="two mini"><button class="${CI[c.id] === 'luego' ? 'on' : ''}" data-a="ci-dest" data-x="${c.id}" data-d="luego">Más tarde</button><button class="${CI[c.id] === 'manana' ? 'on' : ''}" data-a="ci-dest" data-x="${c.id}" data-d="manana">Mañana</button></span></div>`).join('')}</div><p class="note">Lo que no decidas, mañana pasa a Hoy si cabe; si no, a Más tarde.</p>` : ''}
    <div class="sp"></div><div style="height:16px"></div><button class="btn" data-a="ci-guardar">Guardar el día</button>
  </div></div>`;
};
A_RENDER.cierre = s => {
  const gs = s.querySelectorAll('#ci-svg .cp');
  gs.forEach((g, i) => { const x = +g.dataset.x, y = +g.dataset.y, r = +g.dataset.r;
    animar(g, v => ({ transform: `translate(${x}px,${(y - 240 * (1 - v)).toFixed(1)}px) rotate(${(r + 50 * (1 - v)).toFixed(1)}deg)`, opacity: v > 0 ? 1 : 0 }), { w: 10, z: 4.6, delay: 250 + i * 160 }); });
  const fin = 250 + gs.length * 160 + 500;
  if (gs.length) setTimeout(() => { const c = $('#ci-col'); if (c && ACT === 'cierre') animar(c, v => ({ transform: `scale(${1 + .045 * Math.sin(Math.PI * Math.min(1, v))})` }), { w: 9, z: 8 }); }, fin);
  contar(s, gs.length ? 250 : 0, Math.max(400, gs.length * 160));
};
function contar(s, delay, dur) {
  s.querySelectorAll('.cu').forEach(b => { const n = +b.dataset.n; if (!n || reduceMotion()) { b.textContent = n; return; }
    const t0 = performance.now() + delay; const f = now => { const u = Math.max(0, Math.min(1, (now - t0) / dur)); b.textContent = Math.round(n * u); if (u < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); });
}

/* =====================================================================
   Patrones
   ===================================================================== */
function semana(off) { const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow + off * 7); return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return ymd(x); }); }
function pilas(dias7) {
  let b = ''; const base = 128, L = ['L', 'M', 'X', 'J', 'V', 'S', 'D'], H = { hoja: 15, anillo: 21, pausa: 14 };
  dias7.forEach((f, i) => {
    const cx = 18 + i * 36.5, ps = ((S.dias[f] || {}).piezas || []), nv = (S.dias[f] || {}).nivel;
    const alto = ps.reduce((a, p) => a + (H[p.t] || 14), 0), sc = Math.min(1, 112 / Math.max(1, alto));
    let y = base;
    ps.forEach((p, j) => {
      const d = (i * 60 + j * 45) + 'ms'; let g;
      if (p.t === 'hoja') { g = leafG(cx, y - 8 * sc, .22 * sc, j % 2 ? 90 : -90, COL.acc); y -= 15 * sc; }
      else if (p.t === 'anillo') { g = ringG(cx, y - 10 * sc, 8 * sc, 5 * sc, COL.o); y -= 21 * sc; }
      else { g = `<path d="M${cx - 11 * sc} ${y - 2} A${11 * sc} ${11 * sc} 0 0 1 ${cx + 11 * sc} ${y - 2}Z" fill="${COL.n}"/>`; y -= 14 * sc; }
      b += `<g class="pp" style="--d:${d}">${g}</g>`;
    });
    if (!ps.length) b += `<circle cx="${cx}" cy="${base - 4}" r="2.6" fill="currentColor" opacity=".2"/>`;
    const hoy = f === hoyStr();
    b += `<text x="${cx}" y="${base + 18}" text-anchor="middle" font-size="12" fill="currentColor" opacity="${hoy ? 1 : .55}" font-weight="${hoy ? 700 : 400}">${L[i]}</text>`;
    if (nv != null) b += `<rect x="${cx - 9}" y="${base + 24}" width="18" height="4" rx="2" fill="${NIVELES[nv].hex}"/>`;
  });
  return svg(255, 160, b, 'style="width:100%;height:auto"');
}
function decisionSemana() { const lunes = semana(0)[0]; const r = S.rev.slice().reverse().find(x => x.semana >= addDays(lunes, -1)); return r ? r.txt : null; }
R.patrones = () => {
  const off = S.ui.semana || 0, dias7 = semana(off);
  const total = dias7.reduce((a, f) => a + (((S.dias[f] || {}).piezas || []).length), 0);
  const desc = descubrimientos(), meds = medidas().slice(-10);
  const est = meds.reduce((a, x) => a + x.est, 0) / (meds.length || 1), real = meds.reduce((a, x) => a + x.real, 0) / (meds.length || 1);
  const r0 = parseYmd(dias7[0]), r6 = parseYmd(dias7[6]), rango = `${r0.getDate()} ${MESES[r0.getMonth()].slice(0, 3)} – ${r6.getDate()} ${MESES[r6.getMonth()].slice(0, 3)}`;
  const dec = decisionSemana(), dom = new Date().getDay();
  return `<div class="body"><div class="col">${topTab()}
    <h1>Patrones</h1><div class="sub">Lo que has hecho cada día y lo que voy descubriendo de ti.</div>
    <div class="wk"><button class="ib" data-a="sem-off" data-x="-1" aria-label="Semana anterior">${ic('atras', 20)}</button><b>${off === 0 ? 'Esta semana' : (off === -1 ? 'La semana pasada' : rango)}</b><button class="ib" data-a="sem-off" data-x="1" ${off >= 0 ? 'disabled' : ''} aria-label="Semana siguiente">${ic('sig', 20)}</button></div>
    <div class="card"><div class="cl"><span>Lo que has hecho cada día</span><em>${total ? plural(total, 'pieza', 'piezas') : ''}</em></div>${pilas(dias7)}
      <div class="legend sm"><span>${P.hoja(13)} hecha</span><span>${P.anillo(12)} arranque</span><span>${P.pausa(14)} pausa</span><span><i class="bar0"></i> nivel</span></div>
      ${!total ? '<div class="s2 center" style="margin-top:6px">Cada cosa hecha, arranque o pausa aparecerá aquí.</div>' : ''}</div>
    ${dec ? `<div class="card sm row" style="background:var(--ka)">${ic('check', 24)}<div class="grow"><small>Tu decisión para esta semana</small><b>${esc(dec)}</b></div></div>` : ''}
    ${desc.map(([i, t, s]) => `<div class="card sm row">${i}<div class="grow"><b>${t}</b><div class="s2">${s}</div></div></div>`).join('')}
    <div class="card sm"><div class="row">${ic('crono', 24)}<b>Calibrador de tiempo</b></div>
      ${meds.length ? barrasCalib(est, real, 'Calculas', 'Tardas') : ''}
      <div class="s2">${meds.length < 3 ? `Cuando termines tres tareas que tenían tiempo calculado (llevas ${meds.length}), sabré cuánto tardas de verdad.` : `Tardas ${fx(factor())} veces lo que calculas. Ya lo aplico yo a tus estimaciones.`}</div></div>
    <button class="card sm row lnk ${dom === 0 || dom === 1 ? 'hl' : ''}" data-a="ir-zoom" data-x="revision">${ic('calendario', 24)}<div class="grow"><b>Revisión del domingo</b><div class="s2">Dos minutos para mirar la semana y decidir una cosa.</div></div><span class="chev">${ic('sig', 18)}</span></button>
    <button class="card sm row lnk" data-a="ir-zoom" data-x="racha">${P.hoja(26)}<div class="grow"><b>Racha sin culpa</b><div class="s2">Tu mes en piezas. Un día en blanco no rompe nada.</div></div><span class="chev">${ic('sig', 18)}</span></button>
    <button class="card sm row lnk" data-a="ir-zoom" data-x="premios">${ic('regalo', 24)}<div class="grow"><b>Menú de dopamina</b><div class="s2">Tus recompensas para cuando terminas algo que te ha costado.</div></div><span class="chev">${ic('sig', 18)}</span></button>
  </div></div>`;
};
function descubrimientos() {
  const out = [], arr = S.arr.filter(a => a.ini);
  if (arr.length >= 5) {
    const man = arr.filter(a => new Date(a.ini).getHours() < 14).length;
    if (man / arr.length >= .6) out.push([ic('reloj', 24), 'Rindes más por la mañana', `${man} de tus ${arr.length} arranques han sido antes de las 14:00. Deja lo difícil para entonces.`]);
    else if (man / arr.length <= .4) out.push([ic('reloj', 24), 'Arrancas mejor por la tarde', `${arr.length - man} de tus ${arr.length} arranques han sido después de las 14:00.`]);
  }
  const pp = S.pau.filter(p => p.despues != null && p.v);
  if (pp.length >= 3) { const m = pp.reduce((a, p) => a + (p.v - p.despues), 0) / pp.length; if (m > .5) out.push([ic('ola', 24), 'Respirar te funciona', `De media te baja ${m.toFixed(1).replace('.', ',')} puntos.`]); }
  const porDow = {}; Object.entries(S.dias).forEach(([f, d]) => { if (d.nivel != null) { const k = parseYmd(f).getDay(); (porDow[k] = porDow[k] || []).push(d.nivel); } });
  Object.entries(porDow).forEach(([k, xs]) => { if (xs.length >= 3 && xs.filter(x => x === 0).length / xs.length >= .6 && out.length < 3) out.push([nivelIcon(0, 24, 'currentColor'), `Los ${DIAS[k]} sueles venir en Nuclear`, 'Planifica poco ese día. Lo que haya, sumará.']); });
  const tr = {}; S.diario.forEach(d => (d.t || []).forEach(x => tr[x] = (tr[x] || 0) + 1));
  const top = Object.entries(tr).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 3 && out.length < 3) out.push([ic('lapiz', 24), `Lo que más te dispara: ${top[0].toLowerCase()}`, `Aparece en ${top[1]} de tus notas del diario.`]);
  if (!out.length) out.push([ic('grafico', 24), 'Aún te estoy conociendo', 'Con una semana de uso empezarán a salir tus patrones: a qué hora rindes más, qué te calma y qué te dispara.']);
  return out.slice(0, 3);
}

/* ---------- Racha sin culpa ---------- */
R.racha = () => {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth(), first = new Date(y, m, 1), nd = new Date(y, m + 1, 0).getDate();
  const off = (first.getDay() + 6) % 7;
  let cells = '', con = 0, ult7 = 0, k = 0;
  for (let i = 0; i < off; i++) cells += '<span></span>';
  for (let dd = 1; dd <= nd; dd++) {
    const f = ymd(new Date(y, m, dd)), ps = ((S.dias[f] || {}).piezas || []), fut = f > hoyStr();
    if (!fut && ps.length) con++;
    if (!fut && ps.length && (parseYmd(hoyStr()) - parseYmd(f)) / 864e5 < 7) ult7++;
    if (ps.length && !fut) {
      const cnt = { hoja: 0, anillo: 0, pausa: 0 }; ps.forEach(p => { if (cnt[p.t] != null) cnt[p.t]++; });
      const t = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
      cells += `<span class="pz" style="--d:${(k++) * 45}ms" title="${dd}">${P[t](t === 'anillo' ? 20 : 24)}</span>`;
    } else cells += `<span class="${f === hoyStr() ? 'today' : ''}">${dd}</span>`;
  }
  const noches = Object.keys(S.dias).filter(f => f.startsWith(y + '-' + pad(m + 1)) && nocheCompleta(f)).length;
  return `<div class="body"><div class="col">${topBack('Patrones')}
    <h1>Tu mes</h1><div class="sub">Cada día muestra la pieza que más se ha repetido. Un día en blanco no rompe nada: aquí no hay rachas que perder.</div>
    <div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><b>${cap(MESES[m])}</b><small style="margin:0"><b class="cu" data-n="${con}" style="display:inline;font-size:12.5px">0</b> ${con === 1 ? 'día' : 'días'} con piezas</small></div>
      <div class="cal">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<i>${x}</i>`).join('')}${cells}</div>
      <div class="legend sm" style="margin-top:10px"><span>${P.hoja(13)} hechas</span><span>${P.anillo(12)} arranques</span><span>${P.pausa(14)} pausas</span></div></div>
    <div class="card sm" style="background:var(--kn);color:#1F2E35"><b style="display:inline;font-size:15px">Llevas ${ult7} de los últimos 7 días.</b> <span style="font-size:15px">${ult7 < 7 ? 'Los días en blanco también cuentan como descanso.' : 'Toda la semana. Acuérdate de descansar también.'}</span></div>
    <div class="card sm row">${ic('cama', 26)}<div class="grow"><b>Rutina de noche</b><div class="s2">${noches ? `${plural(noches, 'noche completa', 'noches completas')} este mes.` : 'Todavía ninguna noche completa este mes.'}</div></div></div>
  </div></div>`;
};
A_RENDER.racha = s => contar(s, 100, 700);

/* ---------- Revisión del domingo ---------- */
let REV = { sel: null, otra: false };
function datosSemana() {
  const ds = Array.from({ length: 7 }, (_, i) => addDays(hoyStr(), -6 + i));
  const arr = S.arr.filter(a => a.ini && ds.includes(ymd(new Date(a.ini))));
  const hechas = S.cosas.filter(c => c.hecha && ds.includes(ymd(new Date(c.hecha)))).length;
  const man = arr.filter(a => new Date(a.ini).getHours() < 14).length;
  const nuc = ds.filter(f => (S.dias[f] || {}).nivel === 0);
  const pau = S.pau.filter(p => ds.includes(ymd(new Date(p.ts)))).length;
  const tr = {}; S.diario.filter(d => ds.includes(ymd(new Date(d.ts)))).forEach(d => (d.t || []).forEach(x => tr[x] = (tr[x] || 0) + 1));
  const disp = Object.entries(tr).sort((a, b) => b[1] - a[1])[0];
  return { arr, hechas, man, nuc, pau, disp };
}
R.revision = () => {
  const w = datosSemana();
  const bien = w.arr.length ? `Has arrancado ${plural(w.arr.length, 'vez', 'veces')}${w.arr.length >= 3 ? (w.man / w.arr.length >= .6 ? ', la mayoría por la mañana' : (w.man / w.arr.length <= .4 ? ', la mayoría por la tarde' : '')) : ''}${w.hechas ? ` y has terminado ${plural(w.hechas, 'cosa', 'cosas')}` : ''}.`
    : (w.hechas ? `Has terminado ${plural(w.hechas, 'cosa', 'cosas')}.` : 'Ha sido una semana tranquila. También cuenta.');
  const costado = w.nuc.length >= 2 ? `Has venido en Nuclear ${w.nuc.length} días (${w.nuc.map(f => DIAS[parseYmd(f).getDay()]).filter((x, i, a) => a.indexOf(x) === i).join(', ')}).`
    : (w.pau >= 3 ? `Has necesitado ${w.pau} pausas.${w.disp ? ` Lo que más te ha disparado: ${w.disp[0].toLowerCase()}.` : ''}` : (w.disp ? `Lo que más te ha disparado: ${w.disp[0].toLowerCase()}.` : 'Nada destacable. Bien.'));
  const sug = [];
  if (w.nuc.length >= 2) sug.push(`Planificar poco el ${DIAS[parseYmd(w.nuc[0]).getDay()]}`);
  if (w.arr.length >= 3 && w.man / w.arr.length >= .6) sug.push('Lo difícil, por la mañana');
  if (w.disp && /hambre/i.test(w.disp[0])) sug.push('Comer antes de las 14:00');
  if (w.pau >= 3) sug.push('Parar antes de saturarme');
  ['Una sola cosa grande al día', 'Preparar la noche anterior', 'Arrancar aunque sea dos minutos'].forEach(x => { if (sug.length < 4) sug.push(x); });
  return `<div class="body nt"><div class="col">${topBack('Patrones')}
    <div style="color:var(--acc);margin-top:4px">${ic('calendario', 36)}</div><h1>Tu semana, en dos minutos</h1>
    <div class="sub">Esto no es un examen. Solo mirar los últimos siete días y decidir una cosa para la semana que viene.</div>
    <div class="card sm"><small>Lo que ha ido bien</small><b>${bien}</b></div>
    <div class="card sm"><small>Lo que más te ha costado</small><b>${costado}</b></div>
    <div class="lab">Una decisión para la semana</div>
    <div class="chips sm">${sug.map(x => `<button class="ch ${REV.sel === x ? 'on' : ''}" data-a="rev-dec" data-x="${esc(x)}">${esc(x)}</button>`).join('')}<button class="ch ${REV.otra ? 'on' : ''}" data-a="rev-otra">Otra</button></div>
    ${REV.otra ? `<input class="inp" id="rev-t" style="margin-top:8px" placeholder="Escribe tu decisión" value="${esc(REV.sel && !sug.includes(REV.sel) ? REV.sel : '')}">` : ''}
    <div class="sp"></div><div style="height:16px"></div><button class="btn" data-a="rev-guardar">Guardar mi decisión</button>
    <p class="foot">La verás arriba en Patrones toda la semana.</p>
  </div></div>`;
};

/* ---------- Menú de dopamina ---------- */
let PRPARA = 'Para cualquier tarea';
R.premios = () => `<div class="body"><div class="col">${topBack('Atrás')}
  <h1>Menú de dopamina</h1><div class="sub">Cosas pequeñas que te gustan. Cuando terminas algo que te ha costado, te propongo una para que el cerebro lo asocie a algo bueno. Mantén pulsada una para borrarla.</div>
  <div class="enter">${S.premios.map((p, i) => `<div class="card sm row" style="--i:${i}" data-press="premio" data-x="${p.id}">${ic('estrella', 22)}<div class="grow"><b>${esc(p.txt)}</b><div class="s2">${esc(p.para)}</div></div></div>`).join('') || '<div class="empty">Todavía no tienes recompensas. Apunta la primera abajo.</div>'}</div>
  <div class="lab" style="margin-top:20px">Añadir una recompensa</div>
  <input class="inp" id="pr-new" placeholder="Ej.: un helado, diez minutos de juego" enterkeyhint="done">
  <div class="chips sm" style="margin-top:8px">${['Para cualquier tarea', 'Para tareas largas', 'Entre tareas', 'Al final del día'].map(x => `<button class="ch ${PRPARA === x ? 'on' : ''}" data-a="pr-para" data-x="${x}">${x}</button>`).join('')}</div>
  <div style="height:12px"></div><button class="btn soft" data-a="pr-add">${ic('mas', 18)} Añadir</button>
</div></div>`;

/* ---------- ¿Cómo vas? (a mediodía y por la tarde) ---------- */
function ventanaCheck() { const m = ahoraMin(); if (m >= 750 && m < 900) return 'm'; if (m >= 1020 && m < 1170) return 't'; return null; }
function quizasCheckin() {
  if (!S.aj.checkins || !S.onb || SES || nivelHoy() == null || !TABS.includes(ACT) || $('#sheet').classList.contains('on')) return;
  const w = ventanaCheck(), d = dia(); if (!w || d.checks.includes(w)) return;
  d.checks.push(w); save();
  const sig = pendHoy()[0];
  hoja(`<h2>¿Cómo vas?</h2><p class="sub">${w === 'm' ? 'Es mediodía' : 'Es media tarde'}: un momento para mirar cómo va el día. ${hechasHoy().length ? `Llevas ${plural(hechasHoy().length, 'cosa hecha', 'cosas hechas')}.` : ''}${sig ? ` Lo siguiente: «${esc(sig.txt)}».` : ''}</p>
    ${[['check', 'Bien, sigo con lo mío', 'bien'], ['reloj', 'Me he atascado', 'atasco'], ['ola', 'Estoy saturado', 'saturado'], ['capas', 'Tengo menos energía que esta mañana', 'energia']].map(([i, t, k]) => `<button class="opt" data-a="checkin" data-x="${k}">${ic(i, 24)}<div class="grow"><b>${t}</b></div><span class="chev">${ic('sig', 18)}</span></button>`).join('')}`);
}

/* =====================================================================
   Ajustes
   ===================================================================== */
function stepper(k, v) { return `<span class="stp"><button data-a="stp" data-k="${k}" data-x="-1" aria-label="Menos">−</button><b>${v}</b><button data-a="stp" data-k="${k}" data-x="1" aria-label="Más">+</button></span>`; }
const tgl = (k, on) => `<button class="tgl ${on ? 'on' : ''}" data-a="aj-tgl" data-x="${k}" aria-label="Activar o desactivar"><i></i></button>`;
R.ajustes = () => {
  const a = S.aj, ult = a.ultCopia ? new Date(a.ultCopia) : null;
  const copia = !a.url ? 'Sin conectar' : (a.copiaError ? 'No se ha podido guardar' : (ult ? `Guardado ${ult.toDateString() === new Date().toDateString() ? 'hoy a las ' + pad(ult.getHours()) + ':' + pad(ult.getMinutes()) : 'el ' + ult.getDate() + ' de ' + MESES[ult.getMonth()]}` : 'Conectado'));
  return `<div class="body"><div class="col">${topBack('Atrás')}
    <h1>Ajustes</h1>
    <div class="lab">Tú</div><div class="card sm"><div class="srow"><span>Nombre</span><input class="tx" data-aj="nombre" value="${esc(a.nombre)}" placeholder="Tu nombre"></div></div>
    <div class="lab">Cuántas cosas caben en cada nivel</div><div class="card sm">${[0, 1, 2].map(i => `<div class="srow"><span class="row">${nivelIcon(i, 22, NIVELES[i].hex)}${NIVELES[i].n}</span>${stepper('niv' + i, a.niv[i])}</div>`).join('')}</div>
    <div class="lab">Arrancar</div><div class="card sm">
      <div class="srow"><span>Tiempo por defecto</span>${stepper('dur', a.dur + ' min')}</div>
      <div class="srow"><span>Cuenta atrás 3-2-1 antes de empezar</span>${tgl('cuenta', a.cuenta)}</div>
      <div class="srow"><span class="grow">Sonido al acabar<small class="s2" style="display:block">Suena con el volumen multimedia, aunque el iPhone esté en silencio. Necesita la app abierta.</small></span>${tgl('sonido', a.sonido)}</div>
      <button class="srow" data-a="probar-sonido"><span style="color:var(--acc);font-weight:700">Probar el sonido</span>${ic('altavoz', 20)}</button></div>
    <div class="lab">Avisos</div><div class="card sm">
      <div class="srow"><span class="grow">Aviso antes de acabar<small class="s2" style="display:block">Para cerrar con calma y apuntar dónde te quedas.</small></span>${stepper('aviso', a.aviso + ' min')}</div>
      <div class="srow"><span class="grow">«¿Cómo vas?» a mediodía y por la tarde<small class="s2" style="display:block">Te lo pregunto al abrir Dopa a esas horas, una vez.</small></span>${tgl('checkins', a.checkins)}</div>
      <button class="srow" data-a="atajos"><span>Recordatorios con Atajos</span><em>Cómo se ponen ${ic('sig', 16)}</em></button></div>
    <div class="lab">Rutinas y horarios</div><div class="card sm">
      <button class="srow" data-a="rutina" data-x="manana"><span>Rutina de mañana</span><em>${(S.rut.manana || []).length} pasos ${ic('sig', 16)}</em></button>
      <button class="srow" data-a="rutina" data-x="noche"><span>Rutina de noche</span><em>${(S.rut.noche || []).length} pasos ${ic('sig', 16)}</em></button>
      <div class="srow"><span>Cerrar el día desde</span><input type="time" data-aj="hCierre" value="${a.hCierre}"></div>
      <div class="srow"><span>Pantallas fuera</span><input type="time" data-aj="hPant" value="${a.hPant}"></div>
      <div class="srow"><span>Proyectos abiertos a la vez</span>${stepper('limP', a.limP)}</div></div>
    <div class="lab">Pausa: respiración que te propongo primero</div>
    <div class="chips sm">${RESP_ORD.map(k => [k, RESP[k]]).map(([k, x]) => `<button class="ch ${a.resp === k ? 'on' : ''}" data-a="aj-resp" data-x="${k}">${x.n.split(' · ')[0]}</button>`).join('')}</div>
    <div class="lab">Recompensas</div><div class="card sm"><button class="srow" data-a="ir" data-x="premios"><span>Menú de dopamina</span><em>${S.premios.length} ${ic('sig', 16)}</em></button></div>
    <div class="lab">Apariencia</div><div class="seg">${[['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Automático']].map(([k, t]) => `<button class="${a.tema === k ? 'on' : ''}" data-a="tema" data-x="${k}">${t}</button>`).join('')}</div>
    <div class="lab">Copia en Google Sheets</div><div class="card sm">
      <div class="srow"><span>Estado</span><span class="${a.copiaError ? 'err' : 'ok'}">${copia}</span></div>
      <div class="srow"><span>URL del script</span><input class="tx" data-aj="url" value="${esc(a.url)}" placeholder="https://script.google.com/…"></div>
      <div class="srow"><span>Clave</span><input class="tx" data-aj="clave" value="${esc(a.clave)}" placeholder="la de tu script"></div>
      ${a.url ? '<div class="two" style="margin:10px 0 4px"><button class="btn soft sm" data-a="recuperar">Recuperar copia</button><button class="btn sm" data-a="copiar">Guardar ahora</button></div>' : ''}</div>
    <div class="lab">Tus datos</div><div class="card sm">
      <button class="srow" data-a="exportar"><span>Exportar a un archivo</span>${ic('sig', 16)}</button>
      <label class="srow" style="position:relative"><span>Importar desde un archivo</span>${ic('sig', 16)}<input type="file" accept=".json,application/json" data-a="importar" style="position:absolute;inset:0;opacity:0"></label>
      <button class="srow" data-a="borrar-todo" style="color:var(--hot)"><span>Borrar todo</span></button></div>
    <button class="link acc" data-a="ver-bienvenida">Ver la bienvenida otra vez</button>
    <div class="ver">Dopa · versión ${VERSION}<br>Tus datos están en este iPhone${a.url ? ' y en tu Google Sheets' : ''}.</div>
  </div></div>`;
};
function htmlAtajos() {
  const base = location.origin + location.pathname;
  const h = [['08:30', 'Buenos días: ¿con cuánta energía vienes?'], ['13:30', '¿Cómo vas? Abre Dopa'], ['18:00', '¿Cómo vas? Abre Dopa'], [S.aj.hCierre, 'Cierra el día en Dopa: son 20 segundos'], [pad(Math.floor((horaMin(S.aj.hPant) - 30) / 60)) + ':' + pad((horaMin(S.aj.hPant) - 30) % 60), 'Rutina de noche: pantallas fuera a las ' + S.aj.hPant]];
  return `<h2>Recordatorios con Atajos</h2>
    <p class="sub">Las web apps del iPhone no pueden mandar avisos por sí solas de forma fiable. Con la app Atajos se arregla en dos minutos, sin Siri:</p>
    <ol class="pasos-at"><li>Abre <b>Atajos</b> › pestaña <b>Automatización</b> › <b>Nueva automatización</b> › <b>Hora del día</b>.</li><li>Elige la hora, marca <b>Diariamente</b> y <b>Ejecutar inmediatamente</b>.</li><li>Añade la acción <b>Mostrar notificación</b> y escribe el texto.</li><li>Cuando veas el aviso, abre Dopa desde su icono.</li></ol>
    <div class="lab">Te sugiero estas</div><div class="card sm">${h.map(([t, x]) => `<div class="srow"><span><b style="display:inline;font-size:15px">${t}</b> · ${esc(x)}</span><button class="ib" data-a="copiar-txt" data-x="${esc(x)}" aria-label="Copiar">${ic('copia', 19)}</button></div>`).join('')}</div>
    <p class="note">Si abres Dopa a mediodía o por la tarde, te pregunto «¿Cómo vas?» (se puede desactivar en Ajustes). Dirección de la app: ${esc(base)}</p>
    <div style="height:12px"></div><button class="btn" data-a="cerrar-hoja">Entendido</button>`;
}

/* =====================================================================
   hoja (bottom sheet) que sigue al dedo
   ===================================================================== */
function hoja(html, cb) {
  $('#sheet-body').innerHTML = html; $('#sheet-body').scrollTop = 0;
  $('#scrim').classList.add('on'); const sh = $('#sheet'); sh.style.transform = ''; sh.classList.add('on');
  if (cb) cb();
}
function cerrarHoja(silencio) {
  const sh = $('#sheet'); if (!sh.classList.contains('on')) return;
  $('#scrim').classList.remove('on'); sh.style.transform = ''; sh.classList.remove('on'); F = null;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
(function arrastre() {
  const sh = $('#sheet'); let y0 = null, dy = 0, t0 = 0, desde = false;
  sh.addEventListener('touchstart', e => {
    const enGrab = e.target.closest('.grab-zone'), body = $('#sheet-body');
    if (!enGrab && body.scrollTop > 0) { y0 = null; return; }
    if (!enGrab && e.target.closest('input,textarea,button')) { y0 = null; return; }
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); desde = !!enGrab;
  }, { passive: true });
  sh.addEventListener('touchmove', e => {
    if (y0 == null) return; dy = e.touches[0].clientY - y0;
    const d = dy > 0 ? dy : -Math.sqrt(-dy) * 2;
    sh.classList.add('drag'); sh.style.transform = `translateY(${d}px)`; if (dy > 0 && !desde) e.preventDefault();
  }, { passive: false });
  sh.addEventListener('touchend', () => {
    if (y0 == null) return; sh.classList.remove('drag');
    const v = dy / Math.max(1, Date.now() - t0);
    if (dy > 120 || v > .6) cerrarHoja();
    else { const d0 = dy > 0 ? dy : -Math.sqrt(-dy) * 2; sh.style.transform = ''; animar(sh, x => ({ transform: `translateY(${d0 * (1 - x)}px)` }), { w: 16, z: 8 }); }
    y0 = null;
  });
})();

/* =====================================================================
   menú de pulsación larga
   ===================================================================== */
let PRESS = null, LIFT = null;
function abrirPop(target, items) {
  const pop = $('#pop'), app = $('#app').getBoundingClientRect(), r = target.getBoundingClientRect();
  pop.innerHTML = items.map(([t, a, x, cls]) => `<button data-a="${a}" data-x="${esc(x)}" class="${cls || ''}">${t}</button>`).join('');
  target.classList.add('lift'); LIFT = target;
  pop.style.left = Math.max(10, Math.min(r.left - app.left + 10, app.width - 236)) + 'px';
  const top = r.bottom - app.top + 6, h = items.length * 47 + 12;
  pop.style.top = (top + h > app.height - 30 ? r.top - app.top - h - 6 : top) + 'px';
  pop.classList.add('on'); $('#pop-scrim').classList.add('on');
}
function cerrarPop() { $('#pop').classList.remove('on'); $('#pop-scrim').classList.remove('on'); if (LIFT) LIFT.classList.remove('lift'); LIFT = null; }
function menuDe(kind, id, node) {
  if (kind === 'cosa') { const c = cosa(id); if (!c) return;
    abrirPop(node, [c.hecha ? null : ['Arrancar', 'preparar', id], ['Editar', 'editar', id], c.hoy === hoyStr() ? (c.hecha ? null : ['Pasar a Más tarde', 'a-luego', id]) : ['Pasar a hoy', 'a-hoy', id], ['Borrar', 'borrar', id, 'del']].filter(Boolean)); }
  if (kind === 'proy') { const p = proyDe(id); abrirPop(node, [[p.abierto ? 'Aparcar' : 'Volver a abrir', p.abierto ? 'aparcar' : 'reabrir', id], ['Borrar proyecto', 'borrar-proy', id, 'del']]); }
  if (kind === 'guion') abrirPop(node, [['Borrar guion', 'borrar-guion', id, 'del']]);
  if (kind === 'diario') abrirPop(node, [['Borrar nota', 'borrar-diario', id, 'del']]);
  if (kind === 'premio') abrirPop(node, [['Borrar recompensa', 'borrar-premio', id, 'del']]);
}
document.addEventListener('touchstart', e => {
  const n = e.target.closest('[data-press]'); if (!n) return;
  PRESS = { n, t: setTimeout(() => { PRESS.done = true; menuDe(n.dataset.press, n.dataset.x, n); }, 480), x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
document.addEventListener('touchmove', e => { if (PRESS && (Math.abs(e.touches[0].clientX - PRESS.x) > 8 || Math.abs(e.touches[0].clientY - PRESS.y) > 8)) { clearTimeout(PRESS.t); PRESS = null; } }, { passive: true });
document.addEventListener('touchend', e => { if (PRESS) { clearTimeout(PRESS.t); if (PRESS.done) e.preventDefault(); PRESS = null; } });
document.addEventListener('contextmenu', e => { const n = e.target.closest('[data-press]'); if (n) { e.preventDefault(); menuDe(n.dataset.press, n.dataset.x, n); } });

/* =====================================================================
   aviso flotante
   ===================================================================== */
let TT = null;
function toast(t, conDeshacer = false) {
  const el_ = $('#toast'); $('#toast-t').textContent = t; $('#toast-b').hidden = !conDeshacer;
  el_.classList.toggle('arriba', $('#sheet').classList.contains('on') || !TABS.includes(ACT));
  el_.classList.remove('on'); void el_.offsetWidth; el_.classList.add('on');
  clearTimeout(TT); TT = setTimeout(() => el_.classList.remove('on'), conDeshacer ? 4500 : Math.max(2400, t.length * 55));
}

/* =====================================================================
   acciones
   ===================================================================== */
const ACC = {};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.tagName === 'INPUT' || b.disabled || BLOQ) return;
  const a = b.dataset.a; if (ACC[a]) ACC[a](b.dataset.x, b, e);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.f && F) F[t.dataset.f] = t.value;
  if (t.id === 'f-txt') { const p = $('#f-paso'); if (p) p.placeholder = sugerirPaso(t.value); }
  if (t.id === 'f-otro' && F) F.est = Math.max(1, Math.min(600, parseInt(t.value, 10) || 0)) || null;
  if (t.id === 'ar-paso') AR.paso = t.value;
  if (t.id === 'ar-otro') { AR.dur = Math.max(1, Math.min(240, parseInt(t.value, 10) || 0)) || null; const b = $('#s-arrancar .btn[data-a="empezar"]'); if (b && !AR.hiper) b.textContent = AR.dur ? `Empezar ${minTxt(AR.dur)}` : 'Escribe los minutos'; }
  if (t.id === 'tr-e' && TRF) TRF.e = t.value;
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.aj) { S.aj[t.dataset.aj] = t.value.trim(); if (t.dataset.aj === 'url' || t.dataset.aj === 'clave') S.aj.copiaError = false; save(); if (t.dataset.aj === 'url') refresh(); }
  if (t.id === 'hq-salida') { S.aj.hiper.salida = t.value; save(); }
  if (t.dataset.a === 'importar') importar(t.files[0]);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = e.target.id, m = { np: 'np-ok', 'cap-t': 'cap-ok', 'rut-new': 'rut-add', 'at-paso': 'at-paso-ok', 'fin-paso': 'fin-sigue-ok', 'hq-otro': 'hq-otro-ok', 'pr-new': 'pr-add' };
  if (m[id]) { e.preventDefault(); ACC[m[id]](); return; }
  if (id === 'tr-otro') { e.preventDefault(); ACC['tr-otro-ok'](null, document.querySelector('[data-a="tr-otro-ok"]')); return; }
  if (id === 'f-txt') { e.preventDefault(); const p = $('#f-paso'); if (p) p.focus(); return; }
  if (id === 'ci-mejor' || id === 'rev-t') e.target.blur();
});
const resetPausa = () => { TV = null; PAUSA_ID = null; TV_ANT = null; };
const asegurarPausa = () => { if (!PAUSA_ID) guardarPausa(TV); };

Object.assign(ACC, {
  'tab': x => { if (x === 'pausa' && ACT !== 'pausa') resetPausa(); if (x === 'buenos') BD = null; go(x, 'tab'); },
  'ir': x => {
    if (x === 'respirar') { RS = null; RTIPO = null; resetPausa(); }
    if (x === 'semaforo') { SEMI = 0; SEMT0 = Date.now(); }
    if (x === 'revision') REV = { sel: null, otra: false };
    go(x); if (x === 'semaforo') empezarPasos();
  },
  'ir-zoom': (x, b) => { if (x === 'buenos') BD = null; if (x === 'semaforo') { SEMI = 0; SEMT0 = Date.now(); } if (x === 'revision') REV = { sel: null, otra: false };
    go(x, 'zoom', false, b); if (x === 'semaforo') empezarPasos(); },
  'ir-trace': (x, b) => { TRF = null; go('trace', 'zoom', false, b); },
  'atras': () => atras(),
  'deshacer': () => deshacer(),
  'cerrar-hoja': () => cerrarHoja(), 'pop-cerrar': () => cerrarPop(),

  /* bienvenida */
  'onb-sig': () => {
    if (ONB === ONB_N - 1) { const n = $('#onb-nombre'); S.aj.nombre = n ? n.value.trim() : S.aj.nombre; S.onb = true; save(); HIST = []; BD = null; go('buenos', 'push', true); HIST = []; return; }
    ONB++; ONB_DIR = 1; render('bienvenida');
  },
  'onb-atras': () => { ONB = Math.max(0, ONB - 1); ONB_DIR = -1; render('bienvenida'); },
  'onb-saltar': () => { ONB = ONB_N - 1; ONB_DIR = 1; render('bienvenida'); },
  'ver-bienvenida': () => { ONB = 0; ONB_DIR = 1; go('bienvenida'); },

  /* buenos días */
  'nivel': x => {
    const i = +x, antes = BD; BD = i;
    const s = el('buenos');
    s.querySelectorAll('.lv').forEach((b, k) => {
      b.classList.toggle('sel', k === i); b.classList.toggle('dim', k !== i);
      const w = b.querySelector('.wave'); if (k !== i && w) w.setAttribute('d', onda(0, 0, 0));
    });
    const sel = s.querySelectorAll('.lv')[i];
    if (antes !== i) { llenarLiquido(sel.querySelector('.lq'), [1 / 3, 2 / 3, 1][i]); animar(sel, v => ({ transform: `scale(${1 + .03 * Math.sin(Math.PI * Math.min(1, v))})` }), { w: 10, z: 8 }); }
    const bb = s.querySelector('.bdbtn'), d = dia(), cambiar = d.nivel != null;
    if (bb) { bb.querySelector('.btn').innerHTML = `${cambiar ? (i === d.nivel ? 'Volver a Hoy' : `Cambiar a ${NIVELES[i].n}`) : 'Empezar el día'} ${ic('flecha', 20)}`;
      if (bb.classList.contains('off')) { bb.classList.remove('off'); animar(bb, v => ({ transform: `translateY(${(1 - v) * 120}px)`, opacity: Math.min(1, v * 2) }), { w: 12, z: 6 }); } }
    const f = s.querySelector('.bdbtn + .foot'); if (f) f.remove();
  },
  'sueno': x => { commit(() => { dia().sueno = +x; }, null, false, true); $$('#s-buenos .sleepc .seg button').forEach((b, i) => b.classList.toggle('on', i === +x)); },
  'empezar-dia': () => {
    if (BD == null) return;
    const i = BD, d = dia(), primera = d.nivel == null, cambio = d.nivel !== i;
    commit(() => {
      d.nivel = i;
      if (primera) { let caben = S.aj.niv[i] - cosasHoy().length;
        S.cosas.filter(c => !c.hecha && c.hoy && c.hoy < hoyStr()).forEach(c => { if (caben > 0) { c.hoy = hoyStr(); caben--; } else c.hoy = null; }); }
    }, null, false, true);
    go('hoy', 'tab');
    if (!primera && cambio && cosasHoy().length > capHoy()) toast(`Ahora caben ${capHoy()} y tienes ${cosasHoy().length} para hoy. Si quieres, pasa alguna a Más tarde.`);
    else if (primera) toast(`Hoy vienes ${NIVELES[i].n}: ${capHoy() === 1 ? 'cabe 1 cosa' : `caben ${capHoy()} cosas`}.`);
  },

  /* hoy */
  'hecha': (id, b) => {
    const c = cosa(id); if (!c) return;
    if (c.hecha) { commit(() => { c.hecha = null; quitarPieza('hoja', id); }, 'Desmarcada', true); return; }
    animarHecha(id, b);
  },
  'anadir': () => abrirCosa(null),
  'anadir-luego': () => abrirCosa(null, 'luego'),
  'editar': id => { cerrarPop(); abrirCosa(id); },
  'f-est': x => { if (x === 'otro') { F.otro = true; } else { F.otro = false; F.est = +x; } $('#sheet-body').innerHTML = htmlCosa(); if (F.otro) { const i = $('#f-otro'); if (i) i.focus({ preventScroll: true }); } },
  'f-proy': x => { F.proy = x || null; $('#sheet-body').innerHTML = htmlCosa(); },
  'f-cuando': x => { F.cuando = x; $('#sheet-body').innerHTML = htmlCosa(); },
  'f-dest': x => { F.dest = x; $('#sheet-body').innerHTML = htmlCosa(); },
  'f-guardar': () => {
    const txt = (F.txt || '').trim(); if (!txt) { const i = $('#f-txt'); if (i) { i.focus(); i.placeholder = 'Escribe qué hay que hacer'; } return; }
    const f = F, yaHoy = f.id && (cosa(f.id) || {}).hoy === hoyStr(), dest = f.dest === 'hoy' && (huecos() > 0 || yaHoy) ? 'hoy' : 'luego';
    commit(() => {
      let c = f.id ? cosa(f.id) : null;
      if (!c) { c = { id: uid(), creada: Date.now(), hecha: null }; S.cosas.push(c); }
      Object.assign(c, { txt, paso: (f.paso || '').trim(), est: f.est || null, proy: f.proy, cuando: f.cuando, hoy: dest === 'hoy' ? hoyStr() : (c.hoy && c.hoy > hoyStr() ? c.hoy : null) });
    }, f.id ? 'Guardado' : (dest === 'hoy' ? 'Apuntada para hoy' : 'Apuntada en Más tarde'), true);
    cerrarHoja();
  },
  'f-borrar': () => { const id = F.id; cerrarHoja(); ACC.borrar(id); },
  'borrar': id => { cerrarPop(); commit(() => { S.cosas = S.cosas.filter(x => x.id !== id); quitarPieza('hoja', id); }, 'Borrada', true); },
  'a-luego': id => { cerrarPop(); commit(() => { cosa(id).hoy = null; }, 'Pasada a Más tarde', true); },
  'a-hoy': id => {
    cerrarPop();
    if (!huecos()) { toast(`Hoy ya caben ${capHoy()} y está lleno. Pasa una a Más tarde primero o cambia tu nivel.`); return; }
    commit(() => { const c = cosa(id); c.hoy = hoyStr(); c.preguntada = true; }, 'Pasada a hoy', true);
  },
  'soltar': id => commit(() => { S.cosas = S.cosas.filter(x => x.id !== id); }, 'Quitada. Una cosa menos en la cabeza.', true),
  'captura': () => abrirCaptura(),
  'cap-ok': () => {
    const v = (($('#cap-t') || {}).value || '').trim(); if (!v) { cerrarHoja(); return; }
    const rut = CAPT_RUT;
    commit(() => { S.cosas.push({ id: uid(), txt: v, creada: Date.now(), hecha: null, hoy: null, est: null }); if (rut) { const d = dia(); if (!d.rutN.includes(rut)) d.rutN.push(rut); } }, 'Guardado en Más tarde. Sigue con lo tuyo.', true);
    CAPT_RUT = null; cerrarHoja();
  },
  'elige': () => { ELIGE = 0; hoja(htmlElige()); const d = $('#sheet-body .dado svg'); if (d) animar(d, v => ({ transform: `rotate(${(1 - v) * -200}deg) scale(${.6 + .4 * v})` }), { w: 11, z: 5 }); },
  'elige-otra': () => { ELIGE++; $('#sheet-body').innerHTML = htmlElige(); const d = $('#sheet-body .dado svg'); if (d) animar(d, v => ({ transform: `rotate(${(1 - v) * 180}deg)` }), { w: 11, z: 5 }); },

  /* proyectos */
  'np': () => { if (proyAbiertos().length >= S.aj.limP) { toast('Aparca uno para abrir otro'); return; } NUEVO_PROY = true; refresh(); },
  'np-cancelar': () => { NUEVO_PROY = false; refresh(); },
  'np-ok': () => { const i = $('#np'), v = i ? i.value.trim() : ''; if (!v) return; NUEVO_PROY = false;
    commit(() => { S.proy.push({ id: uid(), nombre: v, color: PROY_COL[S.proy.length % PROY_COL.length], abierto: true }); }, 'Proyecto abierto', true); },
  'aparcar': id => { cerrarPop(); commit(() => { proyDe(id).abierto = false; }, 'Aparcado. Sus cosas siguen guardadas.', true); },
  'reabrir': id => { cerrarPop(); if (proyAbiertos().length >= S.aj.limP) { toast(`Ya tienes ${S.aj.limP} abiertos. Aparca uno primero.`); return; } commit(() => { proyDe(id).abierto = true; }, 'Abierto otra vez', true); },
  'borrar-proy': id => { cerrarPop(); commit(() => { S.proy = S.proy.filter(p => p.id !== id); S.cosas.forEach(c => { if (c.proy === id) c.proy = null; }); }, 'Proyecto borrado. Sus cosas siguen en Más tarde.', true); },

  /* rutinas */
  'rutina': x => { RUTV = null; RUTED = false; go(x === 'noche' ? 'noche' : 'rutina', 'zoom', false, null); },
  'rut-ck': x => {
    const k = ACT === 'noche' ? 'noche' : 'manana', it = (S.rut[k] || []).find(i => i.id === x); if (!it) return;
    const d = dia(), arr = k === 'manana' ? d.rutM : d.rutN, ya = arr.includes(x);
    if (!ya && it.acc === 'captura') { abrirCaptura(x); return; }
    if (!ya && it.acc === 'resp55') { commit(() => { arr.push(x); }, null, false, true); RS = null; RTIPO = '55'; resetPausa(); go('respirar'); respirarGo(); return; }
    commit(() => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); else arr.push(x); });
    if (!ya) { const b = $(`#s-${ACT} [data-a="rut-ck"][data-x="${x}"] .ckh svg`); if (b) animar(b, v => ({ transform: `scale(${v}) rotate(${-60 + 60 * v}deg)` }), { w: 16, z: 6.5 }); }
  },
  'rut-nv': x => { RUTV = +x; refresh(); },
  'rut-editar': () => { RUTED = true; refresh(); },
  'rut-niv': (x, b) => { const k = ACT === 'noche' ? 'noche' : 'manana'; commit(() => { const it = S.rut[k].find(i => i.id === x); it.niv = +b.dataset.n; }); },
  'rut-del': x => { const k = ACT === 'noche' ? 'noche' : 'manana'; commit(() => { S.rut[k] = S.rut[k].filter(i => i.id !== x); }, 'Paso quitado', true); },
  'rut-sec': x => { RUTSEC = +x; refresh(); },
  'rut-add': () => { const v = (($('#rut-new') || {}).value || '').trim(); if (!v) return; const k = ACT === 'noche' ? 'noche' : 'manana';
    commit(() => { S.rut[k].push({ id: uid(), txt: v, niv: 0, sec: k === 'noche' ? RUTSEC : undefined }); }, 'Paso añadido', true); },
  'buenas-noches': () => { toast('Buenas noches. Mañana, más.'); go('hoy', 'tab'); },

  /* arrancar */
  'preparar': id => { cerrarPop(); cerrarHoja(); const c = cosa(id); AR = ARnuevo(); AR.cosa = id; AR.paso = c ? (c.paso || '') : ''; go('arrancar', 'tab'); },
  'ar-cosa': x => { AR.cosa = x; const c = cosa(x); AR.paso = c ? (c.paso || '') : ''; refresh(); },
  'ar-dur': x => { if (x === 'otro') { AR.otro = true; AR.dur = AR.dur || S.aj.dur; refresh(); const i = $('#ar-otro'); if (i) { i.focus({ preventScroll: true }); i.select(); } return; } AR.otro = false; AR.dur = +x; refresh(); },
  'ar-hiper': () => { AR.hiper = !AR.hiper; if (AR.hiper && (!S.aj.hiper.salida || minHasta(S.aj.hiper.salida) > 600)) S.aj.hiper.salida = masMin(90); save(); refresh(); },
  'hq': x => { const q = S.aj.hiper.que, i = q.indexOf(x); if (i >= 0) q.splice(i, 1); else q.push(x); save(); refresh(); },
  'hq-otro': () => { HOTRO = !HOTRO; refresh(); if (HOTRO) setTimeout(() => { const i = $('#hq-otro'); if (i) i.focus(); }, 60); },
  'hq-otro-ok': () => { S.aj.hiper.otro = (($('#hq-otro') || {}).value || '').trim(); HOTRO = false; save(); refresh(); },
  'hq-cada': x => { S.aj.hiper.cada = isNaN(+x) ? x : +x; save(); refresh(); },
  'empezar': () => {
    const c = cosa(AR.cosa); if (!c) { toast('Elige primero una de tus cosas de hoy'); return; }
    const paso = (AR.paso || '').trim() || c.paso || '';
    if (paso && !c.paso) { c.paso = paso; save(); }
    let dur = AR.dur;
    if (AR.hiper) { if (!S.aj.hiper.salida) S.aj.hiper.salida = masMin(90); dur = minHasta(S.aj.hiper.salida); if (dur < 5) { toast('Esa hora está demasiado cerca. Elige una más tarde.'); return; } }
    if (!dur) { toast('Escribe cuántos minutos'); return; }
    desbloquearAudio();
    SES = { id: uid(), cosa: c.id, txt: c.txt, paso, dur, dur0: dur, est: c.est || null, ini: null, hiper: AR.hiper, salida: AR.hiper ? S.aj.hiper.salida : '', rec: AR.hiper ? JSON.parse(JSON.stringify(S.aj.hiper)) : null, extra: 0, primer: Date.now() };
    saveSes();
    if (S.aj.cuenta) arrancarCuenta(); else empezarAhora();
  },
  'cd-ya': () => { clearInterval(CDT); empezarAhora(); },
  'volver-ses': () => { if (!SES) return; if (!SES.ini) { empezarAhora(); return; } arrancarTick(); go('ahora', 'fade', true); },
  'ahora-salir': () => go('hoy', 'tab'),
  'ah-mas': x => {
    const n = +x; SES.dur += n; SES.extra = (SES.extra || 0) + n; const eraFin = SES.fin; SES.fin = false;
    if (SES.avisos) SES.avisos.antes = 0;
    if (eraFin && SES.pausado == null) { const sobra = -restante(); if (sobra > 0) SES.pausas = (SES.pausas || 0) + sobra; }
    saveSes(); render('ahora'); toast(`${n} minutos más. Lo apunto para el calibrador.`);
  },
  'ah-pausa': () => {
    if (SES.pausado) { SES.pausas = (SES.pausas || 0) + (Date.now() - SES.pausado); SES.pausado = null; toast('Seguimos'); }
    else { SES.pausado = Date.now(); toast('En pausa. El tiempo no corre.'); }
    saveSes(); render('ahora'); mostrarCtl(true);
  },
  'atasco': () => hoja(htmlAtasco(false)),
  'at': x => {
    if (x === 'grande') { $('#sheet-body').innerHTML = htmlAtasco(true); setTimeout(() => { const i = $('#at-paso'); if (i) i.focus({ preventScroll: true }); }, 100); return; }
    cerrarHoja();
    if (x === 'distraido') { toast('Vuelve solo a esto: ' + minus(SES.paso || 'el primer paso, lo más pequeño')); const p = $('#ah-paso'); if (p) animar(p, v => ({ transform: `scale(${1 + .12 * Math.sin(Math.PI * Math.min(1, v))})` }), { w: 8, z: 5 }); }
    if (x === 'apetece') { SES.dur = (trabajado() + 2 * 6e4) / 6e4; SES.fin = false; if (SES.avisos) SES.avisos.antes = 1; saveSes(); render('ahora'); toast('Solo 2 minutos. Luego decides si sigues.'); }
    if (x === 'saturado') { terminarSesion(false); resetPausa(); go('pausa', 'tab'); toast('Lo dejamos aquí. Ahora, una pausa.'); }
  },
  'at-paso-ok': () => { const v = (($('#at-paso') || {}).value || '').trim(); if (!v) return; SES.paso = v; saveSes(); const c = cosa(SES.cosa); if (c) { c.paso = v; save(); } cerrarHoja(); render('ahora'); toast('Con este paso. Solo eso.'); },
  'terminar': () => terminarSesion(true),
  'fin-hecha': () => { const id = FIN.cosa, aid = FIN.id;
    commit(() => { const c = cosa(id); if (c && !c.hecha) { c.hecha = Date.now(); if (!c.hoy) c.hoy = hoyStr(); pieza('hoja', id); } const a = S.arr.find(x => x.id === aid); if (a) a.hecha = true; }, null, false, true);
    FIN = null; go('hoy', 'tab'); toast('Hecha. Una hoja más para tu collage.'); },
  'fin-sigue': () => { FIN.sigue = true; render('fin'); setTimeout(() => { const i = $('#fin-paso'); if (i) i.focus({ preventScroll: true }); }, 80); },
  'fin-sigue-ok': () => { const id = FIN.cosa, aid = FIN.id, v = (($('#fin-paso') || {}).value || '').trim();
    commit(() => { const c = cosa(id); if (c && v) c.paso = v; const a = S.arr.find(x => x.id === aid); if (a) a.hecha = false; }, null, false, true);
    FIN = null; go('hoy', 'tab'); toast(v ? 'Siguiente paso apuntado. La próxima vez empiezas por ahí.' : 'Vale. Sigue en tu lista de hoy.'); },
  'fin-ok': () => { FIN = null; go('hoy', 'tab'); },

  /* pausa */
  'tv': x => { const antes = TV; TV = +x; PAUSA_ID = null; animarTermo(TV, antes); },
  'p-guardar': () => { guardarPausa(TV); toast('Apuntado. Sigue con lo tuyo.'); resetPausa(); render('pausa'); },
  'p-resp': x => { asegurarPausa(); RTIPO = x; RS = null; go('respirar'); respirarGo(); },
  'p-stop': () => { asegurarPausa(); ST = { i: 0, t0: Date.now() }; go('stop'); empezarPasos(); },
  'r-tipo': (x, b) => { RTIPO = x; $$('#s-respirar .opt').forEach(o => { const on = o.dataset.x === x; o.classList.toggle('sel', on); o.querySelector('.radio').classList.toggle('on', on); }); },
  'r-go': () => respirarGo(),
  'r-fin': () => terminarResp(),
  'r-despues': x => {
    const v = +x, p = S.pau.find(q => q.id === PAUSA_ID), antes = TV_ANT;
    if (p) { p.despues = v; save(); }
    let m = `Apuntado: estás a ${v} de 10.`;
    if (antes) { const d = antes - v; m = d > 0 ? `De ${antes} a ${v}: te ha bajado ${plural(d, 'punto', 'puntos')}.` : d === 0 ? 'Sigue igual. Si no baja, prueba el STOP o aléjate un rato.' : 'Ha subido. Prueba el STOP: ayuda más cuando está alto.'; }
    toast(m); RS = null; resetPausa(); go('pausa', 'tab');
  },
  'r-salir': () => { RS = null; resetPausa(); go('pausa', 'tab'); },
  'sem-sig': () => { if (SEMI < 2) { SEMI++; SEMT0 = Date.now(); render('semaforo'); empezarPasos(); } else { clearInterval(STT); asegurarPausa(); toast('Semáforo hecho. Has parado antes de reaccionar.'); resetPausa(); go('pausa', 'tab'); } },
  'st-sig': () => { if (ST.i < 3) { ST.i++; ST.t0 = Date.now(); render('stop'); empezarPasos(); } else { clearInterval(STT); toast('STOP hecho. Ahora decide con calma qué haces.'); resetPausa(); go('pausa', 'tab'); } },
  'tr': (x, b) => { const k = b.dataset.k, arr = TRF[k]; const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); else arr.push(x); b.classList.toggle('on'); },
  'tr-otro': (x, b) => { TRF.otro = TRF.otro === b.dataset.k ? null : b.dataset.k; refresh(); setTimeout(() => { const i = $('#tr-otro'); if (i) i.focus({ preventScroll: true }); }, 60); },
  'tr-otro-ok': (x, b) => { const v = (($('#tr-otro') || {}).value || '').trim(), k = b ? b.dataset.k : TRF.otro; TRF.otro = null;
    if (v && k) { const ex = ordenados(k).find(o => o.toLowerCase() === v.toLowerCase()) || cap(v); if (!TRF[k].includes(ex)) TRF[k].push(ex); }
    refresh(); },
  'tr-f': x => { TRF.f = +x; $$('#s-trace .seg button').forEach((b, i) => b.classList.toggle('on', i === +x)); },
  'tr-e': x => { TRF.e = x; const i = $('#tr-e'); if (i) i.value = x; },
  'tr-guardar': () => { const d = Object.assign({ ts: Date.now() }, TRF); delete d.otro; if (!d.t.length && !d.r.length && !d.a.length && !d.c.length && !d.e) { toast('Toca al menos una opción'); return; }
    commit(() => { S.diario.push(d); }, 'Guardado en tu diario', true); TRF = null; atras(); },
  'borrar-diario': x => { cerrarPop(); commit(() => { S.diario = S.diario.filter(d => String(d.ts) !== String(x)); }, 'Nota borrada', true); },
  'g-cat': x => { S.ui.gcat = x; save(); GOPEN = null; refresh(); },
  'g-open': x => { GOPEN = GOPEN === x ? null : x; $$('#s-guiones .gcard').forEach(c => { const k = c.querySelector('.gc').dataset.x; c.classList.toggle('on', k === GOPEN); }); },
  'g-copy': x => copiarTexto(x),
  'copiar-txt': x => copiarTexto(x),
  'g-new': () => { GNEW = !GNEW; refresh(); if (GNEW) setTimeout(() => { const i = $('#g-t'); if (i) i.focus(); }, 50); },
  'g-save': () => { const t = ($('#g-t') || {}).value || '', x = ($('#g-x') || {}).value || ''; if (!t.trim() || !x.trim()) return; GNEW = false;
    commit(() => { S.guiones.push({ id: uid(), titulo: t.trim(), texto: x.trim() }); S.ui.gcat = 'Míos'; }, 'Guion guardado', true); },
  'borrar-guion': x => { cerrarPop(); commit(() => { S.guiones = S.guiones.filter(g => g.id !== x); }, 'Guion borrado', true); },

  /* cierre */
  'ci-dest': (id, b) => { const d = b.dataset.d; CI[id] = d; commit(() => { cosa(id).hoy = d === 'manana' ? addDays(hoyStr(), 1) : null; }, d === 'manana' ? 'Para mañana' : 'A Más tarde', true); },
  'ci-guardar': () => {
    const d = dia(); const m = (($('#ci-mejor') || {}).value || '').trim();
    commit(() => { d.mejor = m; d.cerrado = true; }, 'Día guardado. Buen trabajo.', false, true);
    CI = {}; copiaSheets(true);
    if (ahoraMin() >= horaMin(S.aj.hPant) - 120) { RUTV = null; RUTED = false; go('noche', 'push'); } else go('hoy', 'tab');
  },

  /* patrones */
  'sem-off': x => { S.ui.semana = Math.min(0, (S.ui.semana || 0) + (+x)); save(); refresh(); },
  'rev-dec': x => { REV.sel = x; REV.otra = false; refresh(); },
  'rev-otra': () => { REV.otra = true; REV.sel = null; refresh(); setTimeout(() => { const i = $('#rev-t'); if (i) i.focus({ preventScroll: true }); }, 60); },
  'rev-guardar': () => { const v = REV.otra ? (($('#rev-t') || {}).value || '').trim() : REV.sel; if (!v) { toast('Elige o escribe una decisión'); return; }
    commit(() => { S.rev.push({ ts: Date.now(), semana: semana(0)[0], txt: v }); }, 'Decisión guardada para esta semana', true); atras(); },
  'pr-para': x => { PRPARA = x; $$('#s-premios .chips .ch').forEach(b => b.classList.toggle('on', b.dataset.x === x)); },
  'pr-add': () => { const v = (($('#pr-new') || {}).value || '').trim(); if (!v) return; commit(() => { S.premios.push({ id: uid(), txt: v, para: PRPARA }); }, 'Recompensa añadida', true); },
  'borrar-premio': x => { cerrarPop(); commit(() => { S.premios = S.premios.filter(p => p.id !== x); }, 'Recompensa borrada', true); },
  'checkin': x => {
    cerrarHoja();
    if (x === 'bien') toast('Genial. Sigue con lo tuyo.');
    if (x === 'atasco') { AR = ARnuevo(); go('arrancar', 'tab'); toast('Elige la más fácil y empieza solo dos minutos.'); }
    if (x === 'saturado') { resetPausa(); go('pausa', 'tab'); }
    if (x === 'energia') { BD = null; go('buenos'); }
  },

  /* ajustes */
  'stp': (x, b) => {
    const k = b.dataset.k, d = +x;
    const lim = { dur: [1, 60], aviso: [1, 15], limP: [1, 6], niv0: [1, 3], niv1: [1, 7], niv2: [2, 10] };
    let v = k.startsWith('niv') ? S.aj.niv[+k.slice(3)] : S.aj[k];
    v = Math.min(lim[k][1], Math.max(lim[k][0], v + d));
    if (k.startsWith('niv')) S.aj.niv[+k.slice(3)] = v; else S.aj[k] = v;
    save(); refresh();
  },
  'aj-tgl': x => { S.aj[x] = !S.aj[x]; save(); refresh(); },
  'aj-resp': x => { S.aj.resp = x; save(); refresh(); },
  'probar-sonido': () => { desbloquearAudio(); const s = S.aj.sonido; S.aj.sonido = true; sonar('fin'); S.aj.sonido = s; toast('Si no lo oyes, sube el volumen con los botones del lateral.'); },
  'atajos': () => hoja(htmlAtajos()),
  'tema': x => { S.aj.tema = x; save(); aplicarTema(true); refresh(); },
  'copiar': () => copiaSheets(false),
  'recuperar': () => recuperar(),
  'exportar': () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dopa-' + hoyStr() + '.json'; document.body.appendChild(a); a.click(); a.remove();
    toast('Archivo creado');
  },
  'borrar-todo': (x, b) => {
    if (b.dataset.conf !== '1') { b.dataset.conf = '1'; b.innerHTML = '<span>Toca otra vez para borrarlo todo</span>'; setTimeout(() => { b.dataset.conf = ''; b.innerHTML = '<span>Borrar todo</span>'; }, 3500); return; }
    commit(() => { const keep = S.aj; S = DEF(); S.aj = keep; S.onb = true; }, 'Todo borrado', true);
  }
});
function copiarTexto(x) { (navigator.clipboard ? navigator.clipboard.writeText(x) : Promise.reject()).then(() => toast('Copiado'), () => toast('No se ha podido copiar')); }

function importar(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => { try { const d = migrar(JSON.parse(r.result)); if (!d || !d.aj) throw 0; commit(() => { S = Object.assign(DEF(), d); S.aj = Object.assign(DEF().aj, d.aj); }, 'Datos importados', true); } catch (e) { toast('Ese archivo no es de Dopa'); } };
  r.readAsText(file);
}

/* =====================================================================
   copia en Google Sheets (Apps Script)
   ===================================================================== */
async function llamar(accion, extra) {
  const r = await fetch(S.aj.url, { method: 'POST', body: JSON.stringify(Object.assign({ accion, clave: S.aj.clave }, extra || {})) });
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'error'); return j;
}
async function copiaSheets(silencioso) {
  if (!S.aj.url) { if (!silencioso) toast('Primero pega la URL del script'); return; }
  try { await llamar('guardar', { version: VERSION, datos: S }); S.aj.ultCopia = Date.now(); S.aj.copiaError = false; save(); if (!silencioso) toast('Copia guardada en tu Google Sheets'); }
  catch (e) { S.aj.copiaError = true; save(); toast('No se ha podido guardar la copia. Mira Ajustes.'); }
  if (ACT === 'ajustes') refresh();
}
async function recuperar() {
  if (!S.aj.url) return;
  try { const j = await llamar('recuperar'); if (!j.datos) { toast('Todavía no hay ninguna copia'); return; }
    commit(() => { const aj = S.aj; const d = migrar(j.datos); S = Object.assign(DEF(), d); S.aj = Object.assign(DEF().aj, d.aj || {}); S.aj.url = aj.url; S.aj.clave = aj.clave; }, 'Copia recuperada', true); }
  catch (e) { toast('No se ha podido recuperar. Revisa la URL y la clave.'); }
}

/* =====================================================================
   tema y color de la barra de arriba
   ===================================================================== */
function oscuro() { const t = S.aj.tema; return t === 'oscuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); }
function aplicarTema(anim) {
  const r = document.documentElement;
  if (anim && !reduceMotion()) { r.classList.add('theme-anim'); setTimeout(() => r.classList.remove('theme-anim'), 500); }
  r.dataset.theme = oscuro() ? 'dark' : 'light'; themeColor(ACT);
}
function themeColor(name) {
  const k = name === 'respirar' && !RS ? null : PANT_COLOR[name], c = k === 'acc' ? COL.acc : k === 'n' ? COL.n : k === 'dark' ? '#142026' : (oscuro() ? '#142026' : COL.cream);
  $$('meta[name="theme-color"]').forEach(m => { m.content = c; });
  document.documentElement.style.backgroundColor = c; document.body.style.backgroundColor = c;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.aj.tema === 'auto') { aplicarTema(true); refresh(); } });

/* =====================================================================
   arranque
   ===================================================================== */
function inicio() {
  aplicarTema(false);
  $('#tabbar').querySelectorAll('button').forEach(b => { b.querySelector('.ti').innerHTML = tabIcon(b.dataset.x, false); });
  const q = new URLSearchParams(location.search).get('abrir');
  if (!S.onb) { go('bienvenida', 'fade'); return; }
  if (SES) { if (SES.ini) { arrancarTick(); go('ahora', 'fade'); } else empezarAhora(); return; }
  if (nivelHoy() == null) { BD = null; go('buenos', 'fade'); return; }
  if (q === 'captura') { go('hoy', 'tab'); setTimeout(abrirCaptura, 400); return; }
  if (q === 'noche') { go('noche', 'fade'); return; }
  if (q && R[q] && q !== 'ahora' && q !== 'fin') { go(q, TABS.includes(q) ? 'tab' : 'fade'); return; }
  go('hoy', 'tab');
  setTimeout(quizasCheckin, 1200);
}
let DIA = hoyStr();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (hoyStr() !== DIA) { DIA = hoyStr(); if (!SES) { HIST = []; BD = null; go(nivelHoy() == null ? 'buenos' : 'hoy', 'fade'); return; } }
  if (SES && SES.ini) { tick(); if (ACT === 'ahora') pantallaEncendida(true); }
  else if (!$('#sheet').classList.contains('on') && !['respirar', 'semaforo', 'stop', 'cuenta'].includes(ACT)) refresh();
  setTimeout(quizasCheckin, 600);
});
/* el contenedor nunca se desplaza (el foco en un campo podría moverlo) */
$('#app').addEventListener('scroll', () => { $('#app').scrollTop = 0; $('#app').scrollLeft = 0; });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
inicio();
