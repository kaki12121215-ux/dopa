/* DOPA · app
 * Web app para iPhone. Todo se guarda en el propio dispositivo (localStorage)
 * y, si lo conectas, se copia en tu Google Sheets con Apps Script.
 */
'use strict';
const VERSION = '1.0.0';

/* =====================================================================
   utilidades
   ===================================================================== */
const $ = s => document.querySelector(s);
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
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const mmss = ms => { ms = Math.max(0, ms); const t = Math.ceil(ms / 1000); return pad(Math.floor(t / 60)) + ':' + pad(t % 60); };
const minTxt = m => m >= 60 ? (Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + m % 60 + ' min' : '')) : Math.round(m) + ' min';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const horaMin = s => { const [h, m] = (s || '00:00').split(':').map(Number); return h * 60 + m; };
const ahoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
function rnd(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/* =====================================================================
   estado
   ===================================================================== */
const NIVELES = [
  { n: 'Nuclear', d: 'Solo lo básico.', c: 'var(--n)', hex: '#5FC9A2' },
  { n: 'Estándar', d: 'Un día normal.', c: 'var(--s)', hex: '#FFB23A' },
  { n: 'Óptimo', d: 'Energía de sobra.', c: 'var(--o)', hex: '#F2705E' }];
const COL = { n: '#5FC9A2', s: '#FFB23A', o: '#F2705E', acc: '#1F86AA', ink: '#1F2E35', cream: '#FFF5E8', hot: '#D2533F' };
const PROY_COL = ['#5FC9A2', '#FFB23A', '#F2705E', '#1F86AA', '#9B8AF0', '#E9A6C4'];

const DEF = () => ({
  v: 1, onb: false,
  aj: { nombre: '', niv: [1, 3, 5], dur: 5, bloque: 10, desc: 2, cuenta: true, resp: '478', limP: 3,
        hCierre: '21:00', hPant: '23:00', tema: 'auto', url: '', clave: '', ultCopia: null, copiaError: false },
  dias: {}, cosas: [], proy: [], arr: [], pau: [], diario: [], guiones: [],
  ui: { comp: false, gcat: 'Todos', semana: 0 }
});
let S;
try { S = Object.assign(DEF(), JSON.parse(localStorage.getItem('dopa') || '{}')); S.aj = Object.assign(DEF().aj, S.aj); S.ui = Object.assign(DEF().ui, S.ui); }
catch (e) { S = DEF(); }
function save() { try { localStorage.setItem('dopa', JSON.stringify(S)); } catch (e) {} }

/* deshacer / rehacer */
let PILA = [], REHACER = [];
function commit(fn, aviso, conDeshacer = true) {
  PILA.push(JSON.stringify(S)); if (PILA.length > 30) PILA.shift(); REHACER = [];
  fn(); save(); refresh();
  if (aviso) toast(aviso, conDeshacer);
}
function deshacer() { if (!PILA.length) return; REHACER.push(JSON.stringify(S)); S = JSON.parse(PILA.pop()); save(); refresh(); toast('Deshecho'); }
function rehacer() { if (!REHACER.length) return; PILA.push(JSON.stringify(S)); S = JSON.parse(REHACER.pop()); save(); refresh(); toast('Rehecho'); }

/* acceso a datos */
function dia(f = hoyStr()) { if (!S.dias[f]) S.dias[f] = { nivel: null, sueno: null, piezas: [], mejor: '', manana: '', cerrado: false, ritual: [] }; return S.dias[f]; }
const nivelHoy = () => (S.dias[hoyStr()] || {}).nivel;
const capHoy = () => { const n = nivelHoy(); return n == null ? 3 : S.aj.niv[n]; };
const cosasHoy = () => S.cosas.filter(c => c.hoy === hoyStr());
const pendHoy = () => cosasHoy().filter(c => !c.hecha);
const hechasHoy = () => cosasHoy().filter(c => c.hecha);
const luego = () => S.cosas.filter(c => !c.hecha && c.hoy !== hoyStr());
const proyAbiertos = () => S.proy.filter(p => p.abierto);
const proyDe = id => S.proy.find(p => p.id === id);
function pieza(t, ref) { dia().piezas.push({ t, ts: Date.now(), ref: ref || null }); }
function factor() {
  const xs = S.arr.filter(a => a.est && a.real).slice(-10).map(a => a.real / a.est).sort((a, b) => a - b);
  if (xs.length < 3) return 1;
  const m = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
  return Math.round(Math.min(3, Math.max(.8, m)) * 10) / 10;
}
const conFactor = m => Math.round(m * factor());
const fx = f => '×' + String(f).replace('.', ',');

/* =====================================================================
   dibujos (piezas recortadas)
   ===================================================================== */
let _g = 0;
function sunPts(cx, cy, r, k = 9, dep = .11, a0 = 0, a1 = 360) {
  const n = Math.max(10, Math.round(Math.abs(a1 - a0) * 1.4)), p = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
    const rr = r * (1 - dep + dep * Math.pow(Math.abs(Math.cos(k * a / 2)), .55));
    p.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return p;
}
const ptsD = p => 'M' + p.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L') + 'Z';
const LEAF = 'M0 -50 C27 -34 33 -6 23 22 C17 38 7 47 0 52 C-7 47 -19 37 -25 19 C-33 -7 -24 -34 0 -50Z';
const leafG = (cx, cy, s, r, fill, vein) => `<g transform="translate(${cx} ${cy}) rotate(${r}) scale(${s})"><path d="${LEAF}" fill="${fill}"/>${vein ? `<path d="M0 -36 C3 -8 3 18 0 44" fill="none" stroke="${vein}" stroke-width="${3.2 / s}" stroke-linecap="round"/>` : ''}</g>`;
const semiG = (cx, cy, r, fill, rot = 0) => `<path d="M${cx - r} ${cy + r * .35} A${r} ${r} 0 0 1 ${cx + r} ${cy + r * .35}Z" fill="${fill}" transform="rotate(${rot} ${cx} ${cy})"/>`;
const svg = (w, h, b, extra = '') => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${extra}>${b}</svg>`;

const P = {
  hoja: (s = 20, c = COL.acc) => svg(s, s, leafG(s / 2, s / 2, s / 115, 30, c)),
  sol: (s = 20, c = COL.o) => svg(s, s, `<path d="${ptsD(sunPts(s / 2, s / 2, s * .45, 8, .14))}" fill="${c}"/>`),
  pausa: (s = 20, c = COL.n) => svg(s, s, semiG(s / 2, s * .5, s * .46, c))
};
/* icono de nivel: círculo lleno a 1/3, 2/3 o entero */
function nivelIcon(i, s = 36, c = '#1F2E35') {
  const id = 'nv' + (++_g), f = [1 / 3, 2 / 3, 1][i], h = 30 * f;
  return `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><defs><clipPath id="${id}"><circle cx="20" cy="20" r="15"/></clipPath></defs>
    <circle cx="20" cy="20" r="14" fill="none" stroke="${c}" stroke-width="2.6"/><rect x="5" y="${35 - h}" width="30" height="${h}" fill="${c}" clip-path="url(#${id})"/></svg>`;
}
/* casilla */
function checkSvg(done) {
  return done
    ? `<svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12.5" fill="${COL.acc}"/><path d="M8.6 14.4l3.6 3.6 7.3-8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="11.5" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".55"/></svg>`;
}
/* iconos de línea */
const IC = {
  ajustes: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 7h16M3 15h16"/><circle cx="8" cy="7" r="2.4" fill="var(--bg)"/><circle cx="14" cy="15" r="2.4" fill="var(--bg)"/></svg>',
  undo: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4L3 8l4 4"/><path d="M3 8h9a5 5 0 0 1 0 10H9"/></svg>',
  redo: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4l4 4-4 4"/><path d="M17 8H8a5 5 0 0 0 0 10h3"/></svg>',
  back: '<svg width="11" height="18" viewBox="0 0 11 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2L2 9l7 7"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M11 4v14M4 11h14"/></svg>',
  down: '<svg width="13" height="8" viewBox="0 0 13 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 1.5l5 5 5-5"/></svg>',
  close: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>'
};
function tabIcon(k, on) {
  const c = on ? 'currentColor' : 'currentColor', w = 1.6;
  if (k === 'hoy') return on ? nivelIcon(nivelHoy() == null ? 1 : nivelHoy(), 26, 'currentColor') : `<svg width="26" height="26" viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="none" stroke="${c}" stroke-width="2.6"/><path d="M6 24h28" stroke="${c}" stroke-width="2.6"/></svg>`;
  if (k === 'arrancar') return `<svg width="26" height="26" viewBox="0 0 26 26"><path d="${ptsD(sunPts(13, 13, 10.5, 8, .14))}" fill="${on ? COL.o : 'none'}" stroke="${on ? COL.o : c}" stroke-width="${w}" stroke-linejoin="round"/></svg>`;
  if (k === 'pausa') return `<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 18 A10 10 0 0 1 23 18Z" fill="${on ? COL.n : 'none'}" stroke="${on ? COL.n : c}" stroke-width="${w}" stroke-linejoin="round"/></svg>`;
  return `<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"><path d="M5 21V14M10 21V8M15 21V11M20 21V5" stroke="${on ? COL.acc : c}" stroke-width="${on ? 3.4 : w}"/></svg>`;
}

/* collage del día */
function collageSvg(piezas, w = 255, h = 160, seed = 'x') {
  const r = rnd(seed), cells = [];
  const cols = 4, rows = 3;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push([(x + .5) * w / cols, (y + .5) * h / rows]);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  let b = '';
  const ps = piezas.slice(0, 12);
  ps.forEach((p, i) => {
    const [cx0, cy0] = cells[i % cells.length], cx = cx0 + (r() - .5) * 26, cy = cy0 + (r() - .5) * 18, rot = (r() - .5) * 70, sz = 1 - Math.min(.35, ps.length * .025);
    if (p.t === 'hoja') b += leafG(cx, cy, .62 * sz, rot, COL.acc, COL.s);
    else if (p.t === 'sol') b += `<path d="${ptsD(sunPts(cx, cy, 30 * sz, 9, .12))}" fill="${COL.o}"/>`;
    else b += semiG(cx, cy, 34 * sz, COL.n, rot);
  });
  if (!ps.length) b = `<text x="${w / 2}" y="${h / 2 + 5}" text-anchor="middle" font-size="14" fill="#1F2E35" opacity=".6">Todavía sin piezas</text>`;
  return svg(w, h, b);
}

/* =====================================================================
   navegación
   ===================================================================== */
const TABS = ['hoy', 'arrancar', 'pausa', 'patrones'];
let ACT = null, HIST = [];
function el(name) {
  let s = document.getElementById('s-' + name);
  if (!s) { s = document.createElement('section'); s.className = 'scr'; s.id = 's-' + name; $('#screens').appendChild(s); }
  return s;
}
function render(name) { const s = el(name); if (R[name]) s.innerHTML = R[name](); s.classList.toggle('nightmode', name === 'sueno'); afterRender(name); }
function go(name, modo = 'push', sinHist = false) {
  if (name === ACT) { render(name); return; }
  const prev = ACT ? el(ACT) : null;
  if (ACT && !sinHist && modo !== 'tab') HIST.push(ACT);
  if (modo === 'tab') HIST = [];
  ACT = name; render(name);
  const s = el(name);
  const anim = reduceMotion() ? 'fade' : (modo === 'tab' ? 'fade' : modo);
  if (prev) { prev.className = 'scr out-' + anim; setTimeout(() => { if (ACT !== prev.id.slice(2)) prev.className = 'scr'; }, 320); }
  s.className = 'scr on in-' + anim + (name === 'sueno' ? ' nightmode' : '');
  setTimeout(() => s.classList.remove('in-' + anim), 420);
  const tb = $('#tabbar'); tb.hidden = false;
  tb.classList.toggle('hide', !TABS.includes(name));
  tb.querySelectorAll('button').forEach(b => { const on = b.dataset.x === name; b.classList.toggle('on', on); b.querySelector('.ti').innerHTML = tabIcon(b.dataset.x, on); });
  if (TABS.includes(name)) S.ui.tab = name;
  themeColor();
}
function atras() { const p = HIST.pop() || 'hoy'; go(p, 'back', true); }
function refresh() { if (ACT) { const s = el(ACT), sc = s.querySelector('.body'), y = sc ? sc.scrollTop : 0; render(ACT); const sc2 = s.querySelector('.body'); if (sc2) sc2.scrollTop = y; }
  const tb = $('#tabbar'); tb.querySelectorAll('button').forEach(b => { b.querySelector('.ti').innerHTML = tabIcon(b.dataset.x, b.classList.contains('on')); }); }
function afterRender(name) { if (A_RENDER[name]) A_RENDER[name](); }
const A_RENDER = {};

/* cabeceras */
const topBack = (txt = 'Atrás', right = '') => `<div class="top"><div class="l"><button class="back" data-a="atras">${IC.back}<span>${txt}</span></button></div><div class="r">${right}</div></div>`;
const topHome = () => `<div class="top"><div class="l"></div><div class="r"><button class="ib" data-a="deshacer" ${PILA.length ? '' : 'disabled'} aria-label="Deshacer">${IC.undo}</button><button class="ib" data-a="rehacer" ${REHACER.length ? '' : 'disabled'} aria-label="Rehacer">${IC.redo}</button><button class="ib" data-a="ir" data-x="ajustes" aria-label="Ajustes">${IC.ajustes}</button></div></div>`;
const topPlain = () => `<div class="top"><div class="l"></div><div class="r"></div></div>`;

/* =====================================================================
   pantallas
   ===================================================================== */
const R = {};
let ONB = 0;

/* ---------- 1 · Bienvenida ---------- */
R.bienvenida = () => {
  const pasos = [
    () => `<div class="wmk">dopa</div>
      <div class="center" style="margin:26px 0 6px">${svg(291, 120, `${(() => { let b = ''; [[46, 0], [46, 1], [46, 2]].forEach(() => {}); return b; })()}
        <g transform="translate(20 22)">${nivelIcon(2, 76, COL.s).replace('<svg', '<svg x="0" y="0"')}</g>
        ${leafG(132, 60, .72, 28, COL.acc)}<path d="${ptsD(sunPts(204, 60, 38, 10, .11))}" fill="${COL.o}"/>${semiG(266, 70, 30, COL.n)}`)}</div>
      <h1 class="xl">Empieza por<br>lo más pequeño.</h1>
      <p class="lead">Eliges cómo vienes, arrancas cinco minutos y paras cuando lo necesitas. Cada cosa que haces deja una pieza en tu collage del día.</p>`,
    () => `<h1 style="margin-top:20px">Así funciona</h1><p class="lead">Tres ideas, nada más.</p>
      <div class="enter">
      <div class="howrow" style="--i:0">${nivelIcon(1, 40, 'currentColor')}<div><b>Tu nivel decide</b><p>Nuclear, Estándar u Óptimo: según cómo vienes, caben 1, 3 o 5 cosas.</p></div></div>
      <div class="howrow" style="--i:1">${P.sol(40)}<div><b>Arrancar cinco minutos</b><p>Un primer paso ridículo de pequeño y una cuenta atrás. Seguir es opcional.</p></div></div>
      <div class="howrow" style="--i:2">${P.pausa(40)}<div><b>Parar sin culpa</b><p>Si algo se dispara, mides cuánto y Dopa te propone qué hacer.</p></div></div></div>`,
    () => `<h1 style="margin-top:20px">¿Cómo te llamas?</h1><p class="lead">Para saludarte por la mañana. Puedes cambiarlo en Ajustes.</p>
      <input class="inp big" id="onb-nombre" style="margin-top:18px" placeholder="Tu nombre" value="${esc(S.aj.nombre)}" autocomplete="given-name">
      <div class="lab" style="margin-top:22px">Cuántas cosas caben en cada nivel</div>
      <div class="card sm">${[0, 1, 2].map(i => `<div class="srow"><span class="row">${nivelIcon(i, 22, NIVELES[i].hex)}${NIVELES[i].n}</span>${stepper('niv' + i, S.aj.niv[i])}</div>`).join('')}</div>
      <p class="note">La copia en Google Sheets se conecta luego en Ajustes. Es opcional.</p>`
  ];
  return `<div class="body nt"><div class="col">${topPlain()}${pasos[ONB]()}<div class="sp"></div>
    <div class="dots">${[0, 1, 2].map(i => `<i class="${i === ONB ? 'on' : ''}"></i>`).join('')}</div>
    <button class="btn" data-a="onb-sig">${ONB < 2 ? 'Siguiente' : 'Empezar'}</button>
    ${ONB > 0 ? '<button class="link" data-a="onb-atras">Atrás</button>' : '<div style="height:44px"></div>'}</div></div>`;
};

/* ---------- 2 · Buenos días ---------- */
R.buenos = () => {
  const d = dia(), n = S.aj.nombre ? ', ' + esc(S.aj.nombre) : '';
  const h = new Date().getHours(), saludo = h < 13 ? 'Buenos días' : (h < 20 ? 'Buenas tardes' : 'Buenas noches');
  const pend = S.cosas.filter(c => !c.hecha && c.hoy && c.hoy < hoyStr()).length;
  return `<div class="body nt"><div class="col">${topPlain()}
    <div class="kick">${cap(fechaLarga(hoyStr()))}</div><h1 class="xl">${saludo}${n}.</h1>
    <div class="q">¿Cómo vienes hoy?</div>
    <div class="enter">${[0, 1, 2].map(i => `<button class="lv ${d.nivel === i ? 'sel' : ''}" style="background:${NIVELES[i].c};--i:${i}" data-a="nivel" data-x="${i}">
      <div><b>${NIVELES[i].n}</b><p>${NIVELES[i].d}</p><span class="pill">${S.aj.niv[i]} ${S.aj.niv[i] === 1 ? 'cosa' : 'cosas'}</span></div>${nivelIcon(i, 64, '#1F2E35')}</button>`).join('')}</div>
    <div class="lab" style="margin-top:20px">¿Qué tal has dormido? (opcional)</div>
    <div class="sleep">${['Mal', 'Regular', 'Bien'].map((t, i) => `<button class="${d.sueno === i ? 'on' : ''}" data-a="sueno" data-x="${i}">${t}</button>`).join('')}</div>
    <div class="sp"></div>
    <p class="foot">${pend ? `Ayer quedaron ${pend} ${pend === 1 ? 'cosa' : 'cosas'}: pasarán a hoy si caben; si no, a Más tarde.` : 'Lo que elijas decide cuántas cosas caben hoy.'}</p></div></div>`;
};

/* ---------- 3 · Hoy ---------- */
R.hoy = () => {
  const n = nivelHoy(), lvl = n == null ? null : NIVELES[n];
  const pend = pendHoy(), hechas = hechasHoy(), capN = capHoy();
  const sig = pend[0];
  const hero = lvl
    ? `<button class="hero" style="background:${lvl.c}" data-a="ir" data-x="buenos"><div><small>Hoy vienes</small><b>${lvl.n}</b><p>${capN === 1 ? 'Cabe 1 cosa.' : `Caben ${capN} cosas.`} ${hechas.length ? `Llevas ${hechas.length}.` : 'Ni una más.'}</p></div>${nivelIcon(n, 70, '#1F2E35')}</button>`
    : `<button class="hero" style="background:var(--card);color:var(--ink)" data-a="ir" data-x="buenos"><div><small>Todavía no</small><b>¿Cómo vienes?</b><p>Elige tu nivel para empezar.</p></div></button>`;
  const fila = c => {
    const p = proyDe(c.proy);
    return `<div class="task ${c.hecha ? 'done' : ''}" data-press="cosa" data-x="${c.id}">
      <button class="ck" data-a="hecha" data-x="${c.id}" aria-label="Hecha">${checkSvg(!!c.hecha)}</button>
      <div class="t" data-a="editar" data-x="${c.id}"><span class="tt">${esc(c.txt)}</span>
      <div class="m">${c.est ? `<span>~${minTxt(conFactor(c.est))}</span>` : ''}${c.cuando ? `<span>${c.cuando === 'manana' ? 'por la mañana' : 'por la tarde'}</span>` : ''}${p ? `<span class="tag" style="color:#1F2E35;background:${p.color}">${esc(p.nombre)}</span>` : ''}</div></div></div>`;
  };
  const tarde = ahoraMin() >= horaMin(S.aj.hCierre) && !dia().cerrado;
  const lista = pend.length
    ? pend.map(fila).join('')
    : `<div class="empty">${hechas.length ? 'Por hoy, ya está. Si te apetece, añade algo más.' : 'Nada para hoy todavía.<br>Añade la primera cosa.'}</div>`;
  const lleno = pend.length + hechas.length >= capN;
  return `<div class="body"><div class="col">${topHome()}
    <div class="kick">${cap(fechaLarga(hoyStr()))}</div><h1>Hoy</h1>${hero}
    ${tarde ? `<button class="close-card" data-a="ir" data-x="cierre">${P.sol(30)}<div class="grow"><b style="font-size:16px">Cerrar el día</b><div class="s2" style="font-size:13px;color:var(--ink2)">Tu collage y lo que queda, en un minuto.</div></div><span class="chev">›</span></button>` : ''}
    <div class="card"><div class="cl">${capN === 1 ? 'Una cosa para hoy' : (capN === 3 ? 'Tres cosas para hoy' : (capN === 5 ? 'Cinco cosas para hoy' : capN + ' cosas para hoy'))}</div>
      <div class="list">${lista}</div>
      <button class="addrow" data-a="anadir">${IC.plus}<span>${lleno ? 'Añadir (hoy ya está lleno)' : 'Añadir'}</span></button>
      ${hechas.length ? `<div class="comp ${S.ui.comp ? 'on' : ''}"><button class="comp-h" data-a="comp"><span>Completadas</span><span class="comp-n">${hechas.length}</span><span class="comp-f">${IC.down}</span></button><div class="comp-w">${hechas.map(fila).join('')}</div></div>` : ''}
    </div>
    <div class="quick"><button data-a="ir" data-x="proyectos"><b>Proyectos</b><small>${proyAbiertos().length} de ${S.aj.limP} abiertos</small></button>
      <button data-a="ir" data-x="luego"><b>Más tarde</b><small>${luego().length} ${luego().length === 1 ? 'cosa' : 'cosas'}</small></button></div>
    ${sig ? `<div style="height:14px"></div><button class="btn" data-a="preparar" data-x="${sig.id}"><span class="ell">Arrancar «${esc(sig.txt)}»</span></button>` : ''}
  </div></div>`;
};

/* ---------- 4 · Añadir / editar cosa (hoja) ---------- */
let F = null; // formulario en curso
function abrirCosa(id) {
  const c = id ? S.cosas.find(x => x.id === id) : null;
  F = c ? { id: c.id, txt: c.txt, paso: c.paso || '', est: c.est || 15, proy: c.proy || null, cuando: c.cuando || '', dest: c.hoy === hoyStr() ? 'hoy' : 'luego' }
        : { id: null, txt: '', paso: '', est: 15, proy: null, cuando: '', dest: (pendHoy().length + hechasHoy().length < capHoy()) ? 'hoy' : 'luego' };
  hoja(htmlCosa(), () => { if (!F.id) setTimeout(() => { const i = $('#f-txt'); if (i && $('#sheet').classList.contains('on')) i.focus({ preventScroll: true }); }, 350); });
}
function htmlCosa() {
  const cabe = (pendHoy().length + hechasHoy().length) < capHoy() || (F.id && S.cosas.find(x => x.id === F.id).hoy === hoyStr());
  const ests = [5, 15, 30, 60];
  return `<h2>${F.id ? 'Editar' : 'Nueva cosa'}</h2>
    <input class="inp big" id="f-txt" style="margin-top:12px" placeholder="¿Qué hay que hacer?" value="${esc(F.txt)}" data-f="txt">
    <div class="lab">Primer paso, ridículamente pequeño</div>
    <input class="inp" id="f-paso" placeholder="${esc(sugerirPaso(F.txt))}" value="${esc(F.paso)}" data-f="paso">
    <div class="lab">¿Cuánto crees que tardas?</div>
    <div class="chips">${ests.map(m => `<button class="ch ${F.est === m ? 'on' : ''}" data-a="f-est" data-x="${m}">${minTxt(m)}</button>`).join('')}</div>
    <p class="note">${factor() === 1 ? 'Dopa irá aprendiendo cuánto tardas de verdad.' : `Con tu factor ${fx(factor())} serán unos <b>${minTxt(conFactor(F.est))}</b>.`}</p>
    ${proyAbiertos().length ? `<div class="lab">Proyecto</div><div class="chips">${[{ id: null, nombre: 'Ninguno' }].concat(proyAbiertos()).map(p => `<button class="ch ${F.proy === p.id ? 'on' : ''}" data-a="f-proy" data-x="${p.id || ''}">${esc(p.nombre)}</button>`).join('')}</div>` : ''}
    <div class="lab">Cuándo</div>
    <div class="chips">${[['manana', 'Por la mañana'], ['tarde', 'Por la tarde'], ['', 'Cuando sea']].map(([k, t]) => `<button class="ch ${F.cuando === k ? 'on' : ''}" data-a="f-cuando" data-x="${k}">${t}</button>`).join('')}</div>
    <div class="seg" style="margin-top:16px"><button class="${F.dest === 'hoy' ? 'on' : ''}" data-a="f-dest" data-x="hoy" ${cabe ? '' : 'disabled'}>A hoy · ${pendHoy().length + hechasHoy().length} de ${capHoy()}</button><button class="${F.dest === 'luego' ? 'on' : ''}" data-a="f-dest" data-x="luego">Más tarde</button></div>
    ${!cabe ? `<p class="note">Hoy ya caben ${capHoy()}. Va a Más tarde; si quieres, cambia una de hoy.</p>` : ''}
    <div style="height:16px"></div><button class="btn" data-a="f-guardar">Guardar</button>
    ${F.id ? '<button class="link" data-a="f-borrar" style="color:var(--hot)">Borrar</button>' : ''}`;
}
function sugerirPaso(t) {
  t = (t || '').toLowerCase();
  if (/correo|email|mail|mensaje|whats/.test(t)) return 'Abrir el correo y escribir solo el saludo';
  if (/pagar|recibo|banco|factura/.test(t)) return 'Abrir la app del banco';
  if (/clase|examen|corregir|rúbrica|rubrica|preparar/.test(t)) return 'Abrir el documento';
  if (/llamar|teléfono|telefono|cita/.test(t)) return 'Buscar el número';
  if (/limpiar|ordenar|recoger/.test(t)) return 'Recoger solo una cosa';
  if (/pasear|correr|andar|ejercicio|gimnasio/.test(t)) return 'Ponerme las zapatillas';
  return 'Ej.: abrir lo que necesitas';
}

/* ---------- 5 · Proyectos ---------- */
let NUEVO_PROY = false;
R.proyectos = () => {
  const ab = proyAbiertos(), ap = S.proy.filter(p => !p.abierto);
  const slot = p => { const n = S.cosas.filter(c => c.proy === p.id && !c.hecha), h = n.filter(c => c.hoy === hoyStr()).length;
    return `<div class="pslot" data-press="proy" data-x="${p.id}"><span class="dot" style="background:${p.color};width:18px;height:18px"></span><div class="grow"><b>${esc(p.nombre)}</b><small>${n.length} ${n.length === 1 ? 'cosa' : 'cosas'}${h ? ` · ${h} para hoy` : ''}</small></div><button class="pill2" data-a="aparcar" data-x="${p.id}">Aparcar</button></div>`; };
  return `<div class="body"><div class="col">${topBack('Hoy')}
    <h1>Proyectos</h1><div class="sub">Como mucho ${S.aj.limP} abiertos a la vez. Llevas ${ab.length}.</div>
    <div class="enter">${ab.map((p, i) => slot(p).replace('class="pslot"', `class="pslot" style="--i:${i}"`)).join('')}</div>
    ${NUEVO_PROY ? `<div class="card sm"><input class="inp" id="np" placeholder="Nombre del proyecto" style="box-shadow:none;padding:6px 0"><div class="two" style="margin-top:10px"><button class="btn ghost" data-a="np-cancelar">Cancelar</button><button class="btn" data-a="np-ok">Abrir</button></div></div>`
      : (ab.length < S.aj.limP ? `<button class="pslot empty" data-a="np">+ Abrir proyecto</button>` : `<div class="foot">Los ${S.aj.limP} huecos están llenos. Para abrir otro, aparca uno: no se pierde nada.</div>`)}
    ${ap.length ? `<div class="lab" style="margin-top:22px">Aparcados</div><div class="card sm">${ap.map(p => `<div class="lrow" data-press="proy" data-x="${p.id}"><span class="row"><span class="dot" style="background:${p.color}"></span>${esc(p.nombre)}</span><button class="pill2" data-a="reabrir" data-x="${p.id}">Abrir</button></div>`).join('')}</div>` : ''}
    ${!S.proy.length ? '<div class="empty">Un proyecto agrupa cosas que van juntas (Clases, Casa, Mudanza…). Al limitar cuántos tienes abiertos, la cabeza no se dispersa.</div>' : ''}
  </div></div>`;
};
A_RENDER.proyectos = () => { const i = $('#np'); if (i) i.focus(); };

/* ---------- 6 · Más tarde ---------- */
R.luego = () => {
  const xs = luego(), grupos = {};
  xs.forEach(c => { const k = c.proy || '_'; (grupos[k] = grupos[k] || []).push(c); });
  const viejo = xs.find(c => (Date.now() - (c.creada || Date.now())) > 14 * 864e5 && !c.preguntada);
  const keys = Object.keys(grupos).sort((a, b) => a === '_' ? 1 : b === '_' ? -1 : 0);
  return `<div class="body"><div class="col">${topBack('Hoy')}
    <h1>Más tarde</h1><div class="sub">Sin fecha y sin culpa.</div>
    ${viejo ? `<div class="card old"><b>${esc(viejo.txt)}</b><div class="s2">Lleva más de dos semanas aquí. ¿Sigue importándote?</div><div class="two" style="margin-top:12px"><button class="btn soft" data-a="soltar" data-x="${viejo.id}">Soltar</button><button class="btn" data-a="a-hoy" data-x="${viejo.id}">Sí, a hoy</button></div></div>` : ''}
    ${xs.length ? keys.map(k => `<div class="lab">${k === '_' ? 'Sin proyecto' : esc((proyDe(k) || {}).nombre || 'Proyecto')}</div><div class="card sm">${grupos[k].map(c => `<div class="lrow" data-press="cosa" data-x="${c.id}"><span data-a="editar" data-x="${c.id}" style="flex:1">${esc(c.txt)}</span><button class="pill2" data-a="a-hoy" data-x="${c.id}">A hoy</button></div>`).join('')}</div>`).join('')
      : '<div class="empty">Aquí va lo que no cabe hoy.<br>Ahora mismo, nada. Aprovecha.</div>'}
    <div style="height:14px"></div><button class="btn soft" data-a="anadir-luego">+ Apuntar para más tarde</button>
  </div></div>`;
};

/* ---------- 7 · Arrancar · preparar ---------- */
const AR = { cosa: null, otra: '', paso: '', dur: null, hiper: false, salida: '', estado: null };
/* estado de la sesión en curso: guardado para no perderlo al refrescar */
let SES = null; try { SES = JSON.parse(localStorage.getItem('dopa.ses') || 'null'); } catch (e) {}
const saveSes = () => { try { localStorage.setItem('dopa.ses', JSON.stringify(SES)); } catch (e) {} };
R.arrancar = () => {
  if (AR.dur == null) AR.dur = S.aj.dur;
  const pend = pendHoy();
  if (AR.cosa === null && pend[0]) { AR.cosa = pend[0].id; AR.paso = pend[0].paso || ''; }
  const c = S.cosas.find(x => x.id === AR.cosa);
  return `<div class="body"><div class="col">${topPlain()}
    <h1>Arrancar</h1><div class="sub">¿Qué empiezas ahora?</div>
    ${SES ? `<button class="close-card" data-a="volver-ses" style="background:var(--ko)">${P.sol(30)}<div class="grow"><b style="font-size:16px">Tienes uno en marcha</b><div style="font-size:13px;color:var(--ink2)">${esc(SES.txt)}</div></div><span class="chev">›</span></button>` : ''}
    <div class="lab">Elige una cosa</div>
    <div class="chips">${pend.map(x => `<button class="ch ${AR.cosa === x.id ? 'on' : ''}" data-a="ar-cosa" data-x="${x.id}">${esc(x.txt)}</button>`).join('')}<button class="ch ${AR.cosa === '' ? 'on' : ''}" data-a="ar-cosa" data-x="">Otra cosa</button></div>
    ${AR.cosa === '' || !pend.length ? `<input class="inp" style="margin-top:10px" id="ar-otra" placeholder="¿Qué vas a empezar?" value="${esc(AR.otra)}">` : ''}
    ${c && c.est ? `<p class="note">Calculaste ${minTxt(c.est)}${factor() !== 1 ? `; con tu factor, unos <b>${minTxt(conFactor(c.est))}</b>` : ''}.</p>` : ''}
    <div class="lab">Primer paso, ridículamente pequeño</div>
    <input class="inp" id="ar-paso" placeholder="${esc(sugerirPaso(c ? c.txt : AR.otra))}" value="${esc(AR.paso)}">
    <div class="lab">Solo durante</div>
    <div class="chips">${[2, 5, 10].map(m => `<button class="ch ${AR.dur === m ? 'on' : ''}" data-a="ar-dur" data-x="${m}">${m} min</button>`).join('')}</div>
    <div class="card sm row" style="margin-top:16px"><div class="grow"><b>Modo hiperfoco</b><div class="s2">Pones hora de salida y te recuerdo beber agua y estirarte.</div></div><button class="tgl ${AR.hiper ? 'on' : ''}" data-a="ar-hiper"><i></i></button></div>
    ${AR.hiper ? `<div class="card sm row"><span class="grow">Salgo a las</span><input type="time" id="ar-salida" value="${AR.salida || masMin(90)}" style="font-size:16px;color:var(--acc);font-weight:700"></div>` : ''}
    <div class="sp"></div><div style="height:16px"></div>
    <button class="btn" data-a="empezar">Empezar ${AR.dur} minutos</button>
  </div></div>`;
};
function masMin(m) { const d = new Date(Date.now() + m * 6e4); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

/* ---------- 8 · Cuenta atrás ---------- */
let CD = 5, CDT = null;
R.cuenta = () => `<div class="body nt full" style="background:var(--acc)"><div class="col" style="text-align:center">${topPlain()}
  <div class="kick">${esc(SES ? SES.txt : '')}</div>
  <div class="timer" style="flex-direction:column">${svg(280, 280, `<path d="${ptsD(sunPts(140, 140, 118, 11, .075))}" fill="${COL.cream}"/><text x="140" y="190" text-anchor="middle" class="cd-num" id="cd-n">${CD}</text>`)}
  <div class="cd-dots">${[5, 4, 3, 2, 1].map(n => `<i class="${n >= CD ? 'on' : ''}"></i>`).join('')}</div></div>
  <p style="font-size:17px">Primer paso: ${esc(SES ? SES.paso || 'empieza por lo más pequeño' : '').replace(/^./, m => m.toLowerCase())}.</p>
  <button class="link" data-a="cd-ya" style="margin-top:8px">Ya, empieza ahora</button></div></div>`;
function arrancarCuenta() {
  CD = 5; go('cuenta', 'fade');
  clearInterval(CDT);
  CDT = setInterval(() => {
    CD--; if (CD <= 0) { clearInterval(CDT); empezarMarcha(); return; }
    const n = $('#cd-n'); if (n) { n.textContent = CD; n.classList.remove('cd-go'); void n.getBBox(); n.classList.add('cd-go'); }
    document.querySelectorAll('#s-cuenta .cd-dots i').forEach((d, i) => d.classList.toggle('on', 5 - i >= CD));
  }, 1000);
}

/* ---------- 9 · En marcha ---------- */
function timerSvg(frac) {
  const cx = 130, cy = 128, r = 108, el = Math.min(1, Math.max(0, frac)) * 360;
  if (el < .5) return svg(260, 258, `<path d="${ptsD(sunPts(cx, cy, r, 11, .075))}" fill="${COL.cream}"/>`, 'style="overflow:visible"');
  if (el > 359.5) return svg(260, 258, `<path d="${ptsD(sunPts(cx, cy, r, 11, .075))}" fill="${COL.cream}" opacity=".16"/>`, 'style="overflow:visible"');
  const ri = r * .62, inner = [];
  for (let t = 0; t <= 12; t++) { const a = (-90 + el * t / 12) * Math.PI / 180; inner.push([cx + ri * Math.cos(a), cy + ri * Math.sin(a)]); }
  const pts = sunPts(cx, cy, r, 11, .075, -90 + el, 270).concat(inner);
  let b = `<path d="${ptsD(sunPts(cx, cy, r, 11, .075))}" fill="${COL.cream}" opacity=".16"/><path d="${ptsD(pts)}" fill="${COL.cream}"/>`;
  return svg(260, 258, b, 'style="overflow:visible"');
}
R.marcha = () => {
  if (!SES) return `<div class="body nt">${topBack()}<div class="empty">No hay nada en marcha.</div></div>`;
  return `<div class="body nt full" style="background:var(--acc)"><div class="col">${topPlain()}
    <div class="kick">Arrancar · solo ${SES.dur} minutos</div><h1 style="color:#fff">${esc(SES.txt)}</h1>
    <div class="card sm" style="margin-top:16px;color:var(--ink)"><small>Primer paso</small><b>${esc(SES.paso || 'Empieza por lo más pequeño')}</b></div>
    <div class="timer" style="position:relative"><div id="t-svg"></div><div style="position:absolute;text-align:center;color:#1F2E35"><div id="t-num" style="font-size:58px;font-weight:700;letter-spacing:-2px;line-height:1">--:--</div><div id="t-sub" style="font-size:14px;opacity:.7;margin-top:4px">de ${SES.dur} minutos</div></div></div>
    <div id="t-acc"></div></div></div>`;
};
let TICK = null;
function tick() {
  if (!SES) return;
  if (ACT === 'marcha') {
    const total = SES.dur * 6e4, el = Date.now() - SES.ini, rest = total - el;
    const sv = $('#t-svg'); if (sv) sv.innerHTML = timerSvg(el / total);
    const nu = $('#t-num'); if (nu) nu.textContent = rest > 0 ? mmss(rest) : '¡Hecho!';
    const ac = $('#t-acc'), fin = rest <= 0;
    if (ac && ac.dataset.fin !== String(fin)) {
      ac.dataset.fin = String(fin);
      ac.innerHTML = fin
        ? `<p style="text-align:center;font-size:16px;margin-bottom:12px">Ya has arrancado. ¿Sigues?</p><div class="two"><button class="btn" style="background:#FFF5E8;color:#1F2E35" data-a="seguir5">Seguir ${SES.dur} más</button><button class="btn" style="background:#1F2E35;color:#fff" data-a="a-bloques">Bloques 10/2</button></div><button class="link" data-a="terminar">Terminar aquí</button>`
        : `<button class="link" data-a="atasco" style="color:#fff">Me atasqué</button><button class="btn" style="background:#1F2E35;color:#fff" data-a="seguir5">Seguir ${SES.dur} minutos más</button><button class="link" data-a="terminar">Ya está, lo dejo aquí</button>`;
    }
  }
  if (ACT === 'bloques') tickBloques();
}
function empezarMarcha() { SES.ini = Date.now(); SES.fase = 'marcha'; saveSes(); go('marcha', 'fade', true); clearInterval(TICK); TICK = setInterval(tick, 250); tick(); }

/* ---------- 10 · Me atasqué (hoja) ---------- */
function htmlAtasco(paso2) {
  if (paso2) return `<h2>Más pequeño</h2><p class="sub">¿Cuál sería un paso todavía más pequeño?</p>
    <input class="inp" id="at-paso" style="margin-top:14px" placeholder="Ej.: escribir solo el título">
    <div style="height:14px"></div><button class="btn" data-a="at-paso-ok">Empezar con este paso</button>`;
  const o = [[P.pausa(34, COL.n), 'Es demasiado grande', 'Pártelo en algo más pequeño', 'grande'],
    [P.hoja(34), 'Me he distraído', 'Vuelve solo al primer paso', 'distraido'],
    [P.sol(34), 'No me apetece nada', 'Haz solo 2 minutos y decides', 'apetece'],
    [nivelIcon(0, 34, COL.s), 'Estoy saturado', 'Ve a Pausa, sin culpa', 'saturado']];
  return `<h2>¿Qué ha pasado?</h2><p class="sub">Atascarse es normal. Elige lo que más se parece.</p>
    ${o.map(([i, t, s, k]) => `<button class="opt" data-a="at" data-x="${k}">${i}<div class="grow"><b>${t}</b><small>${s}</small></div><span class="chev">›</span></button>`).join('')}
    <button class="link" data-a="cerrar-hoja">Cancelar</button>`;
}

/* ---------- 11 · Bloques 10/2 ---------- */
R.bloques = () => {
  if (!SES) return `<div class="body nt">${topBack()}<div class="empty">No hay nada en marcha.</div></div>`;
  return `<div class="body nt"><div class="col">${topPlain()}
    <div class="kick" id="b-kick">${SES.salida ? 'Hiperfoco hasta las ' + SES.salida : 'Bloques de ' + S.aj.bloque + ' + ' + S.aj.desc + ' min'}</div><h1>${esc(SES.txt)}</h1>
    <div class="timer" style="flex-direction:column;align-items:stretch"><div class="bigt" id="b-t">--:--</div><div class="sub center" id="b-sub"></div>
      <div class="blocks" id="b-blocks"></div><div class="bl-l"><span id="b-hechos"></span><span>${S.aj.bloque} + ${S.aj.desc} min</span></div></div>
    ${SES.hiper ? `<div class="card sm row">${P.pausa(30)}<div class="grow"><b>Agua y estirarte</b><div class="s2" id="b-agua"></div></div></div>` : ''}
    <div style="height:14px"></div>
    <div class="two"><button class="btn soft" data-a="idea">Apuntar idea suelta</button><button class="btn" data-a="terminar">Terminar</button></div>
    <button class="link" data-a="terminar">Salir y dejar anotado el siguiente paso</button></div></div>`;
};
function tickBloques() {
  const W = S.aj.bloque * 6e4, D = S.aj.desc * 6e4, ciclo = W + D, el = Date.now() - SES.bIni;
  const n = Math.floor(el / ciclo), dentro = el % ciclo, trabajo = dentro < W;
  const rest = trabajo ? W - dentro : ciclo - dentro;
  const t = $('#b-t'); if (!t) return;
  t.textContent = mmss(rest);
  $('#b-sub').textContent = trabajo ? `del bloque ${n + 1} · luego ${S.aj.desc} min de descanso` : 'Descanso: levántate, bebe agua, mira lejos';
  $('#b-hechos').textContent = n === 1 ? '1 bloque hecho' : n + ' bloques hechos';
  let h = '';
  const total = Math.max(4, n + 2);
  for (let i = 0; i < total; i++) {
    const f = i < n ? 100 : (i === n ? (trabajo ? dentro / W * 100 : 100) : 0);
    h += `<span class="bw"><i style="width:${f.toFixed(1)}%"></i></span>`;
    if (i < total - 1) h += `<span class="bb ${i < n || (i === n && !trabajo) ? 'on' : ''}"></span>`;
  }
  const bl = $('#b-blocks'); if (bl.dataset.h !== h) { bl.innerHTML = h; bl.dataset.h = h; }
  const ag = $('#b-agua'); if (ag) { const mins = Math.floor((Date.now() - SES.ini) / 6e4), prox = 50 - (mins % 50); ag.textContent = `En ${prox} min. Llevas ${mins} desde que empezaste.`; }
}

/* ---------- 12 · Fin del arranque ---------- */
let FIN = null;
R.fin = () => {
  if (!FIN) return `<div class="body nt">${topBack()}</div>`;
  const est = FIN.est, real = FIN.real, f = factor();
  const maxv = Math.max(est || 1, real), w1 = est ? Math.round(est / maxv * 55) : 0, w2 = Math.round(real / maxv * 55);
  return `<div class="body nt"><div class="col">${topPlain()}
    <div class="center" style="margin-top:6px">${svg(291, 160, `<ellipse cx="150" cy="128" rx="96" ry="30" fill="${COL.s}" opacity=".45"/><path d="${ptsD(sunPts(150, 76, 58, 10, .11))}" fill="${COL.o}"/>${leafG(222, 72, .55, 40, COL.acc)}${leafG(78, 88, .45, -50, COL.acc)}`)}</div>
    <h1 class="xl center">¡Arrancaste!</h1><div class="sub center">Un sol más para tu collage. Llevas ${minTxt(real)}.</div>
    ${est ? `<div class="card sm"><b>Calibrador de tiempo</b><div class="calib"><div><span style="width:${w1}%;background:${COL.s}"></span><em>Calculaste ${minTxt(est)}</em></div><div><span style="width:${w2}%;background:${COL.o}"></span><em>Llevas ${minTxt(real)}</em></div></div>
      <div class="s2">${S.arr.filter(a => a.est && a.real).length < 3 ? 'Con tres arranques medidos, Dopa calcula tu factor.' : `Tu factor es <b style="display:inline;font-size:13px">${fx(f)}</b>. Ya lo aplico yo a tus estimaciones.`}</div></div>` : ''}
    ${FIN.cosa ? `<div class="q center">¿Está hecha?</div>` : ''}
    <div class="sp"></div>
    ${FIN.cosa ? `<input class="inp" id="fin-paso" placeholder="Si sigue: ¿cuál es el siguiente paso?" style="margin-bottom:12px">
      <div class="two"><button class="btn soft" data-a="fin-sigue">Sigue luego</button><button class="btn" data-a="fin-hecha">Sí, hecha</button></div>`
      : '<button class="btn" data-a="fin-ok">Vale</button>'}
  </div></div>`;
};

/* ---------- 13 · Pausa (termómetro) ---------- */
let TV = null;
const TRAMO = v => v <= 3 ? 0 : v <= 5 ? 1 : v <= 7 ? 2 : 3;
const TRAMOS = [
  { t: 'Estás bien.', d: 'Si quieres, apunta cómo estás y sigue con lo tuyo.', b: 'Guardar y seguir', a: 'p-guardar', c: COL.n },
  { t: 'Empieza a notarse.', d: 'Un minuto de respiración 4-6: cuatro segundos dentro, seis fuera.', b: 'Respirar 4-6', a: 'p-resp46', c: COL.s },
  { t: 'Es bastante.', d: 'Para un momento: respiración 4-7-8 y, si puedes, cambia de sitio cinco minutos.', b: 'Respirar 4-7-8', a: 'p-resp478', c: COL.o },
  { t: 'Para todo.', d: 'No decidas nada ahora. Haz el STOP: cuatro pasos de veinte segundos.', b: 'Hacer el STOP', a: 'p-stop', c: COL.hot }];
R.pausa = () => {
  const v = TV, tr = v ? TRAMOS[TRAMO(v)] : null;
  let th = '';
  for (let i = 1; i <= 10; i++) {
    const r = 8 + i * 1.05, c = [COL.n, COL.n, COL.n, COL.s, COL.s, COL.o, COL.o, COL.hot, COL.hot, COL.hot][i - 1], on = v && i <= v;
    th += `<button data-a="tv" data-x="${i}" aria-label="${i}">${svg(28, 40, `<path d="M${14 - r} 36 A${r} ${r} 0 0 1 ${14 + r} 36Z" fill="${on ? c : 'none'}" stroke="${on ? c : 'currentColor'}" stroke-width="${on ? 0 : 1.4}" opacity="${on ? 1 : .35}"/>${v === i ? `<circle cx="14" cy="${36 - r - 5}" r="2.5" fill="currentColor"/>` : ''}`)}</button>`;
  }
  return `<div class="body"><div class="col">${topPlain()}
    <h1>Pausa</h1><div class="sub">Sin juzgarte.</div>
    <div class="q">¿Cuánto lo sientes ahora?</div>
    <div class="bignum" style="color:${tr ? tr.c : 'var(--ink3)'}">${v || '–'}</div>
    <div class="thermo">${th}</div><div class="sl"><span>Casi nada</span><span>Muchísimo</span></div>
    ${tr ? `<div class="card sm" style="animation:rise .35s var(--ease)"><b style="display:inline;font-size:15px">${tr.t}</b> <span style="font-size:15px">${tr.d}</span></div>` : '<div class="card sm"><span style="font-size:15px;color:var(--ink2)">Toca un número del 1 al 10. No hay respuesta mala.</span></div>'}
    <div class="minis"><button data-a="ir" data-x="semaforo">${svg(14, 14, `<circle cx="7" cy="7" r="6" fill="${COL.hot}"/>`)}Semáforo</button><button data-a="ir" data-x="trace">${P.hoja(16)}Escribirlo</button><button data-a="ir" data-x="guiones">${P.pausa(16, COL.s)}Guiones</button></div>
    <div class="sp"></div><div style="height:16px"></div>
    ${tr ? `<button class="btn" data-a="${tr.a}">${tr.b}</button>` : `<button class="btn soft" data-a="p-resp${S.aj.resp === '46' ? '46' : '478'}">Solo respirar</button>`}
  </div></div>`;
};
function guardarPausa(v) { commit(() => { S.pau.push({ ts: Date.now(), v, despues: null }); pieza('pausa'); }); }

/* ---------- 14 · Respirar ---------- */
let RS = null;
R.respirar = () => {
  const pat = RS ? RS.pat : S.aj.resp;
  const b = `<circle cx="140" cy="140" r="132" fill="#FFFFFF" opacity=".35"/><circle cx="140" cy="140" r="100" fill="${COL.s}"/><path d="${ptsD(sunPts(140, 140, 64, 10, .09))}" fill="${COL.o}"/>`;
  return `<div class="body nt" style="background:var(--n);color:#1F2E35"><div class="col">${topPlain()}
    <h1>Respirar</h1><div class="rnd" id="r-rnd"></div>
    ${!RS || RS.fin ? '' : ''}
    <div class="breath">${svg(280, 280, `<g class="g" id="r-g">${b}</g>`)}<div class="bt"><small id="r-f">Preparado</small><b id="r-n">${pat === '46' ? '4-6' : '4-7-8'}</b></div></div>
    <p class="center" id="r-hint" style="font-size:15px;margin-bottom:16px">${RS && RS.fin ? '' : 'Hombros abajo. Mandíbula suelta.'}</p>
    <div id="r-acc">${!RS ? `<div class="seg" style="background:rgba(255,255,255,.4);margin-bottom:12px"><button class="${pat === '46' ? 'on' : ''}" data-a="r-pat" data-x="46">4-6 · 1 min</button><button class="${pat === '478' ? 'on' : ''}" data-a="r-pat" data-x="478">4-7-8 · 6 rondas</button></div>
      <button class="btn" style="background:#1F2E35;color:#fff" data-a="r-go">Empezar</button><button class="link" data-a="atras" style="color:#1F2E35">Volver</button>`
      : '<button class="btn" style="background:#FFF5E8;color:#1F2E35" data-a="r-fin">Terminar</button>'}</div>
  </div></div>`;
};
let RT = null;
function respirarGo(pat) {
  const fases = pat === '46' ? [['Dentro', 4, 1], ['Fuera', 6, .62]] : [['Dentro', 4, 1], ['Aguanta', 7, 1], ['Fuera', 8, .62]];
  const rondas = pat === '46' ? 6 : 6;
  RS = { pat, ronda: 1, fase: 0, rondas, fin: false }; render('respirar');
  const g = () => $('#r-g');
  const paint = () => { const r = $('#r-rnd'); if (r) r.innerHTML = Array.from({ length: rondas }, (_, i) => `<i class="${i < RS.ronda ? 'on' : ''}"></i>`).join('') + `<span style="margin-left:6px">Ronda ${RS.ronda} de ${rondas}</span>`; };
  paint(); const gg = g(); if (gg) gg.style.transform = 'scale(.62)';
  let seg = 0;
  const paso = () => {
    if (!RS || RS.fin) return;
    const [nom, dur, esc_] = fases[RS.fase];
    if (seg === 0) { const e = g(); if (e) { e.style.transitionDuration = dur + 's'; e.style.transform = `scale(${esc_})`; } }
    const f = $('#r-f'), n = $('#r-n'); if (f) f.textContent = nom; if (n) n.textContent = dur - seg;
    seg++;
    if (seg >= dur) { seg = 0; RS.fase++; if (RS.fase >= fases.length) { RS.fase = 0; RS.ronda++; if (RS.ronda > rondas) { RS.ronda = rondas; terminarResp(); return; } paint(); } }
    RT = setTimeout(paso, 1000);
  };
  RT = setTimeout(paso, 300);
}
function terminarResp() {
  clearTimeout(RT); if (!RS) RS = { pat: S.aj.resp };
  RS.fin = true;
  const ac = $('#r-acc'), f = $('#r-f'), n = $('#r-n'), h = $('#r-hint');
  if (f) f.textContent = 'Hecho'; if (n) n.textContent = '✓';
  const e = $('#r-g'); if (e) { e.style.transitionDuration = '1s'; e.style.transform = 'scale(.8)'; }
  if (h) h.textContent = '¿Y ahora cuánto lo sientes?';
  if (ac) ac.innerHTML = `<div class="chips" style="justify-content:center;margin-bottom:12px">${Array.from({ length: 10 }, (_, i) => `<button class="ch" data-a="r-despues" data-x="${i + 1}">${i + 1}</button>`).join('')}</div><button class="link" data-a="r-salir" style="color:#1F2E35">Salir sin apuntar</button>`;
}

/* ---------- 13b · Semáforo ---------- */
let SEM = 0;
R.semaforo = () => {
  const rows = [[COL.hot, 'Rojo · Para', 'Respira hondo tres veces y ponle nombre: «esto es frustración», «esto es agobio».'],
    [COL.s, 'Amarillo · Observa', '¿Dónde lo notas? Mandíbula, pecho, hombros… Solo míralo, sin juzgarlo.'],
    [COL.n, 'Verde · Elige', '¿Qué haces ahora? Decide desde la calma, no desde el impulso.']];
  return `<div class="body"><div class="col">${topBack('Pausa')}
    <h1>Semáforo</h1><div class="sub">Uno o dos minutos · paso ${SEM + 1} de 3</div>
    ${rows.map(([c, t, d], i) => `<button class="sem ${i === SEM ? 'on' : ''}" data-a="sem" data-x="${i}">${svg(44, 44, `<circle cx="22" cy="22" r="20" fill="${c}"/>`)}<div><b>${t}</b><p>${d}</p></div></button>`).join('')}
    <div class="sp"></div><div style="height:16px"></div><button class="btn" data-a="sem-sig">${SEM < 2 ? 'Siguiente' : 'Hecho'}</button></div></div>`;
};

/* ---------- 15 · STOP ---------- */
let ST = { i: 0, t0: 0 }, STT = null;
const STOP = [['S', 'Para', 'Detén lo que estés haciendo. Las manos quietas, nada de responder ahora.'],
  ['T', 'Da un paso atrás', 'Literalmente: aléjate un metro de lo que estabas haciendo y suelta los hombros.'],
  ['O', 'Observa', 'Qué notas en el cuerpo, qué piensas y qué emoción es. Sin juzgarlo.'],
  ['P', 'Sigue con calma', 'Ahora sí: elige qué haces. Si no lo tienes claro, puede esperar.']];
R.stop = () => {
  const s = STOP[ST.i];
  return `<div class="body nt"><div class="col">${topBack('Pausa')}
    <div class="kick">Técnica STOP · ${ST.i + 1} de 4</div><h1>Sin prisa.</h1>
    <div class="stopc" key="${ST.i}"><div class="stopl">${s[0]}</div><b>${s[1]}</b><p>${s[2]}</p><div class="stopt" id="st-t"></div></div>
    <div class="letters">${STOP.map((x, i) => `<span class="${i < ST.i ? 'd' : i === ST.i ? 'on' : ''}">${x[0]} · ${['Para', 'Atrás', 'Observa', 'Sigue'][i]}</span>`).join('')}</div>
    <div class="sp"></div><button class="btn" data-a="st-sig">${ST.i < 3 ? 'Siguiente' : 'Hecho'}</button></div></div>`;
};
function stopTick() {
  const t = $('#st-t'); if (!t) { clearInterval(STT); return; }
  const r = Math.max(0, 20 - Math.floor((Date.now() - ST.t0) / 1000)), a = (20 - r) / 20 * 360;
  t.innerHTML = svg(26, 26, `<circle cx="13" cy="13" r="10" fill="none" stroke="rgba(31,46,53,.25)" stroke-width="3.5"/>${a > 0 ? `<path d="${a >= 359.9 ? 'M13 3 A10 10 0 1 1 12.99 3' : arcD(13, 13, 10, -90, -90 + a)}" fill="none" stroke="#1F2E35" stroke-width="3.5" stroke-linecap="round"/>` : ''}`) + `<span>${r} s</span>`;
}
function arcD(cx, cy, r, a0, a1) { const p = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; }

/* ---------- 16 · Escribirlo (TRACE) ---------- */
const TR_OP = {
  t: ['Una persona', 'Una tarea', 'Un mensaje', 'Un cambio de planes', 'Una crítica', 'Me he olvidado algo', 'Prisa', 'Ruido', 'Cansancio', 'Hambre'],
  r: ['Frustración', 'Agobio', 'Ansiedad', 'Enfado', 'Tristeza', 'Impaciencia', 'Vergüenza', 'Culpa', 'Rechazo', 'Aburrimiento'],
  c: ['Pecho', 'Estómago', 'Mandíbula', 'Hombros', 'Cabeza', 'Garganta', 'Manos', 'Todo el cuerpo'],
  a: ['Respirar', 'STOP', 'Semáforo', 'Alejarme un rato', 'Moverme', 'Escribirlo', 'Hablar con alguien', 'Beber agua', 'Comer algo', 'Nada todavía'],
  e: ['Partir la tarea antes de empezar', 'Parar antes de saturarme', 'Comer antes', 'Avisar de que necesito tiempo', 'No contestar en caliente']
};
let TRF = null;
const trNew = () => ({ t: [], r: [], c: [], a: [], f: null, e: '', v: TV || null, otro: null });
function ordenados(k) { // lo que más usas, primero
  const cnt = {}; S.diario.forEach(d => (d[k] || []).forEach(x => cnt[x] = (cnt[x] || 0) + 1));
  const extra = Object.keys(cnt).filter(x => !TR_OP[k].includes(x));
  return TR_OP[k].concat(extra).map((x, i) => [x, i]).sort((a, b) => (cnt[b[0]] || 0) - (cnt[a[0]] || 0) || a[1] - b[1]).map(x => x[0]);
}
R.trace = () => {
  if (!TRF) TRF = trNew();
  const L = (ch, c) => `<span class="trl" style="background:${c}">${ch}</span>`;
  const chips = (k, max) => `<div class="chips sm">${ordenados(k).slice(0, max).map(x => `<button class="ch ${TRF[k].includes(x) ? 'on' : ''}" data-a="tr" data-k="${k}" data-x="${esc(x)}">${esc(x)}</button>`).join('')}<button class="ch add" data-a="tr-otro" data-k="${k}">+ Otro</button></div>
    ${TRF.otro === k ? `<div class="row" style="margin-top:8px"><input class="inp" id="tr-otro" placeholder="Escríbelo"><button class="pill2" data-a="tr-otro-ok" data-k="${k}">Añadir</button></div>` : ''}`;
  return `<div class="body"><div class="col">${topBack('Pausa')}
    <h1>Escribirlo</h1><div class="sub">Treinta segundos. Casi todo se toca.</div>
    <div class="tr">${L('T', COL.n)}<b>Qué lo desencadenó</b></div>${chips('t', 10)}
    <div class="tr">${L('R', COL.s)}<b>Qué sentiste</b><em>${TRF.v ? 'Intensidad ' + TRF.v : ''}</em></div>${chips('r', 10)}
    <div class="lab" style="margin:10px 0 6px">Dónde lo notas</div>${chips('c', 8)}
    <div class="tr">${L('A', COL.o)}<b>Qué probaste</b></div>${chips('a', 10)}
    <div class="tr">${L('C', COL.n)}<b>¿Funcionó?</b></div>
    <div class="seg">${['Sí', 'Un poco', 'No'].map((x, i) => `<button class="${TRF.f === i ? 'on' : ''}" data-a="tr-f" data-x="${i}">${x}</button>`).join('')}</div>
    <div class="tr">${L('E', COL.s)}<b>Para la próxima vez</b></div>
    <input class="inp" id="tr-e" placeholder="Una cosa que harás distinta" value="${esc(TRF.e)}">
    <div class="chips sm" style="margin-top:8px">${ordenadosE().map(x => `<button class="ch" data-a="tr-e" data-x="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <div style="height:18px"></div><button class="btn" data-a="tr-guardar">Guardar</button>
    ${S.diario.length ? `<button class="link" data-a="ir" data-x="diario">Ver lo que has escrito (${S.diario.length})</button>` : ''}
  </div></div>`;
};
const ordenadosE = () => { const prev = S.diario.map(d => d.e).filter(Boolean); return [...new Set(prev.reverse().concat(TR_OP.e))].slice(0, 5); };
R.diario = () => `<div class="body"><div class="col">${topBack('Escribirlo')}<h1>Tu diario</h1><div class="sub">Lo más reciente, primero.</div>
  ${S.diario.slice().reverse().slice(0, 40).map(d => { const dt = new Date(d.ts); return `<div class="card sm" data-press="diario" data-x="${d.ts}"><small>${cap(fechaLarga(ymd(dt)))} · ${pad(dt.getHours())}:${pad(dt.getMinutes())}${d.v ? ' · intensidad ' + d.v : ''}</small>
    <b>${esc((d.r || []).join(', ') || 'Sin emoción apuntada')}</b><div class="s2">${esc([(d.t || []).join(', '), (d.a || []).length ? 'Probé: ' + d.a.join(', ') : '', d.f != null ? ['Funcionó', 'Funcionó un poco', 'No funcionó'][d.f] : ''].filter(Boolean).join(' · '))}</div>${d.e ? `<div class="s2"><b style="display:inline;font-size:13px">Próxima vez:</b> ${esc(d.e)}</div>` : ''}</div>`; }).join('') || '<div class="empty">Todavía no has escrito nada.</div>'}
  </div></div>`;

/* ---------- 17 · Guiones ---------- */
const GUIONES = [
  ['Trabajo', 'Necesito tiempo para pensarlo', 'Gracias por contármelo. Necesito un poco de tiempo para pensarlo bien. ¿Lo retomamos mañana a las 10? Quiero darte una buena respuesta.'],
  ['Trabajo', 'No tengo claras las prioridades', 'Tengo varias cosas encima y quiero hacerlas bien. ¿Me dices cuál va primero y para cuándo necesitas cada una?'],
  ['Trabajo', 'Me están interrumpiendo', 'Ahora mismo estoy con algo que necesita toda mi atención. ¿Lo vemos a las 12? Así te escucho bien.'],
  ['Trabajo', 'Decir que no a algo más', 'Me gustaría ayudarte, pero ahora no puedo hacerlo bien. Si lo dejamos para el lunes, me comprometo.'],
  ['Trabajo', 'Pedirlo por escrito', 'Para no dejarme nada, ¿me lo mandas por escrito en tres puntos? Así lo tengo delante.'],
  ['Trabajo', 'Reunión que se alarga', 'Tengo que irme a las 18:00. ¿Dejamos claros los siguientes pasos antes de cerrar?'],
  ['Familia', 'Necesito un rato a solas', 'Estoy a gusto con vosotros, pero necesito un rato a solas para recargar. Vuelvo en veinte minutos.'],
  ['Familia', 'He contestado mal', 'Perdona, he contestado mal. No era por ti, estaba saturado. ¿Lo hablamos con calma?'],
  ['Familia', 'Pedir ayuda', 'Me está costando organizar esto. ¿Me echas una mano con la primera parte?'],
  ['Familia', 'Cambio de planes', 'Me cuesta cuando los planes cambian de repente. Dame cinco minutos para reorganizarme y te digo.'],
  ['Familia', 'Explicar cómo funciono', 'No es que no me importe: a mi cabeza le cuesta arrancar. Si me lo recuerdas con un mensaje, me ayudas mucho.'],
  ['Pareja', 'Bajar el tono', 'Te quiero y quiero entenderte. Ahora estoy demasiado alterado para hablar bien. ¿Paramos diez minutos y seguimos?'],
  ['Pareja', 'Me he perdido mientras hablabas', 'Perdona, me he perdido un momento. No es que no me interese. ¿Me lo repites?'],
  ['Pareja', 'Pedir lo que necesito', 'Me ayudaría mucho dejarlo apuntado en un sitio que veamos los dos. Así no depende de mi memoria.'],
  ['Pareja', 'Necesito silencio', 'No estoy enfadado: tengo la cabeza llena. Un rato de silencio y vuelvo a estar contigo.'],
  ['Pareja', 'Repartir tareas', '¿Hacemos una lista de lo de casa y elegimos cada uno? Me organizo mucho mejor si está escrito.'],
  ['Amistades', 'Llego tarde', 'Lo siento, llego unos 15 minutos tarde. Pedid sin mí, que ahora os alcanzo.'],
  ['Amistades', 'Me retiro antes', 'Me lo estoy pasando muy bien, pero estoy llegando a mi límite. Me voy yendo. ¡Repetimos pronto!'],
  ['Amistades', 'No he contestado', 'Perdona por tardar en contestar: lo leí y se me pasó. Me apetece mucho, ¿quedamos el sábado?'],
  ['Amistades', 'Cancelar sin culpa', 'Hoy no voy a estar bien para quedar y prefiero decírtelo. ¿Lo movemos a la semana que viene?'],
  ['Amistades', 'Pedir un plan tranquilo', 'Me apetece veros, pero hoy necesito algo tranquilo. ¿Un café en vez de una cena?'],
  ['Saturación', 'Estoy saturado', 'Ahora mismo estoy saturado y no puedo responder bien. Necesito diez minutos y vuelvo.'],
  ['Saturación', 'Demasiado ruido', 'Hay demasiado ruido para mí. ¿Nos vamos a un sitio más tranquilo para seguir hablando?'],
  ['Saturación', 'Demasiadas cosas a la vez', 'Me estás contando muchas cosas a la vez. ¿Vamos una a una?'],
  ['Saturación', 'Necesito procesarlo', 'Esto me ha removido. Déjame procesarlo y te contesto con calma esta tarde.'],
  ['Saturación', 'Un mensaje en caliente', 'Para ti: escríbelo, déjalo en borradores 30 minutos y vuelve a leerlo antes de enviarlo.'],
  ['Olvidos', 'He olvidado algo importante', 'Tienes razón, se me olvidó y entiendo que es un fastidio. ¿Te parece si lo arreglo así: …?'],
  ['Olvidos', 'Se me ha pasado el plazo', 'Se me ha pasado el plazo y lo siento. Puedo tenerlo mañana a las 12. ¿Te vale?'],
  ['Olvidos', 'No recuerdo lo que hablamos', 'Quiero hacerlo bien, pero no me acuerdo de los detalles. ¿Me los recuerdas o me los mandas por escrito?'],
  ['Olvidos', 'Una cita olvidada', 'Me he olvidado de la cita y lo siento de verdad. ¿Buscamos otro hueco? Esta vez lo apunto delante de ti.'],
  ['Olvidos', 'Un cumpleaños olvidado', '¡Felicidades con retraso! Se me pasó la fecha, pero no tú. ¿Te invito a algo esta semana?']
];
const GCATS = ['Todos', 'Trabajo', 'Familia', 'Pareja', 'Amistades', 'Saturación', 'Olvidos', 'Míos'];
let GOPEN = null, GNEW = false;
R.guiones = () => {
  const mios = S.guiones.map(g => ['Míos', g.titulo, g.texto, g.id]);
  const all = GUIONES.concat(mios).filter(g => S.ui.gcat === 'Todos' || g[0] === S.ui.gcat);
  const icon = c => ({ Trabajo: P.sol(24), Familia: P.hoja(24), Pareja: P.pausa(24, COL.o), Amistades: P.pausa(24, COL.s), 'Saturación': P.pausa(24, COL.n), Olvidos: nivelIcon(0, 24, COL.acc), 'Míos': P.hoja(24, COL.o) }[c] || '');
  return `<div class="body"><div class="col">${topBack('Pausa', `<button class="ib" data-a="g-new" aria-label="Nuevo guion">${IC.plus}</button>`)}
    <h1>Guiones</h1><div class="sub">Frases preparadas para cuando cuesta. Cópialas y adáptalas.</div>
    <div class="chips sm" style="margin-top:12px">${GCATS.map(c => `<button class="ch ${S.ui.gcat === c ? 'on' : ''}" data-a="g-cat" data-x="${c}">${c}</button>`).join('')}</div>
    ${GNEW ? `<div class="card"><b>Nuevo guion</b><input class="inp" id="g-t" placeholder="Para cuándo (ej.: me piden algo urgente)" style="margin-top:10px"><textarea class="inp" id="g-x" placeholder="La frase, tal cual la dirías" style="margin-top:8px"></textarea><div class="two" style="margin-top:10px"><button class="btn ghost" data-a="g-new">Cancelar</button><button class="btn" data-a="g-save">Guardar</button></div></div>` : ''}
    ${all.map((g, i) => { const k = g[3] || g[1]; const on = GOPEN === k;
      return `<div class="card sm gcard ${on ? 'on' : ''}" ${g[3] ? `data-press="guion" data-x="${g[3]}"` : ''}><button class="gc" data-a="g-open" data-x="${esc(k)}">${icon(g[0])}<b>${esc(g[1])}</b><span class="chev">›</span></button>
        <div class="gtxt"><p style="font-size:15px;line-height:1.5;margin-top:10px">«${esc(g[2])}»</p><div class="row" style="margin-top:10px"><span style="font-size:12px;color:var(--ink2);flex:1">${g[0]}</span><button class="pill2" data-a="g-copy" data-x="${esc(g[2])}">Copiar</button></div></div></div>`; }).join('') || '<div class="empty">Aún no tienes guiones tuyos. Toca + para crear uno.</div>'}
  </div></div>`;
};

/* ---------- 18 · Cierre ---------- */
R.cierre = () => {
  const d = dia(), ps = d.piezas, n = t => ps.filter(p => p.t === t).length;
  const pend = pendHoy();
  const sugerido = d.mejor || mejorDelDia();
  return `<div class="body nt"><div class="col">${topBack('Hoy')}
    <h1>Cierre</h1><div class="sub">Tu collage de hoy</div>
    <div class="card colla">${collageSvg(ps, 255, 156, hoyStr())}</div>
    <div class="legend"><span>${P.hoja(14)} ${n('hoja')} ${n('hoja') === 1 ? 'cosa' : 'cosas'}</span><span>${P.sol(15)} ${n('sol')} ${n('sol') === 1 ? 'arranque' : 'arranques'}</span><span>${P.pausa(16)} ${n('pausa')} ${n('pausa') === 1 ? 'pausa' : 'pausas'}</span></div>
    <div class="lab" style="margin-top:18px">Lo mejor de hoy</div><input class="inp" id="ci-mejor" value="${esc(sugerido)}">
    ${pend.length ? `<div class="lab">No se hizo (y no pasa nada)</div><div class="card sm">${pend.map(c => `<div class="lrow"><span style="flex:1">${esc(c.txt)}</span><button class="pill2" data-a="ci-luego" data-x="${c.id}" style="background:var(--soft);color:var(--ink2)">Más tarde</button><button class="pill2" data-a="ci-manana" data-x="${c.id}">A mañana</button></div>`).join('')}</div>` : ''}
    <div class="lab">Para mañana, una sola cosa grande</div><input class="inp" id="ci-manana" placeholder="Ej.: preparar el examen a primera hora" value="${esc(d.manana)}">
    <div class="sp"></div><div style="height:16px"></div><button class="btn" data-a="ci-guardar">Guardar el día</button>
  </div></div>`;
};
function mejorDelDia() {
  const d = dia(), h = d.piezas.filter(p => p.t === 'hoja').length, s = d.piezas.filter(p => p.t === 'sol').length, p = d.piezas.filter(p => p.t === 'pausa').length;
  if (s && d.nivel === 0) return 'Arrancaste en un día de Nuclear.';
  if (s >= 2) return 'Empezaste aunque no apetecía, y más de una vez.';
  if (s) return 'Empezaste aunque no apetecía.';
  if (h) return h === 1 ? 'Hiciste una cosa. Cuenta.' : `Hiciste ${h} cosas.`;
  if (p) return 'Paraste cuando lo necesitabas.';
  return 'Hoy tocaba descansar. También vale.';
}

/* ---------- 19 · Rutina de sueño ---------- */
const RITUAL = [['1 · Preparar', ['Luz baja', 'Lo de mañana, listo']], ['2 · Descargar la cabeza', ['Apuntar lo que me ronda']], ['3 · Transición', ['Leer en papel', 'Respirar 4-7-8']]];
R.sueno = () => {
  const d = dia(), quedan = horaMin(S.aj.hPant) - ahoraMin();
  let k = 0;
  return `<div class="body nt"><div class="col">${topBack('Hoy')}
    <div class="kick">Rutina de sueño</div><h1>Pantallas fuera<br>a las ${S.aj.hPant}</h1>
    <div class="sub">${quedan > 0 ? 'Quedan ' + minTxt(quedan) + '.' : 'Ya es la hora. Mañana, más.'}</div>
    ${RITUAL.map(([t, items]) => `<div class="zc"><div class="zt">${t}</div>${items.map(x => { const i = k++, on = d.ritual.includes(i);
      return `<button class="zr ${on ? 'done' : ''}" data-a="${i === 2 ? 'ritual-apuntar' : 'ritual'}" data-x="${i}">${checkSvg(on)}<span>${x}</span></button>`; }).join('')}</div>`).join('')}
    ${RAPUNTAR ? `<div class="card sm"><input class="inp" id="rp" placeholder="Lo que te ronda. Va a Más tarde." style="box-shadow:none;padding:6px 0"><div class="two" style="margin-top:8px"><button class="btn ghost" data-a="ritual-apuntar">Cerrar</button><button class="btn" data-a="rp-ok">Apuntar</button></div></div>` : ''}
    <div class="sp"></div><div style="height:16px"></div><button class="btn" style="background:#F3EEE6;color:#1F2E35" data-a="buenas-noches">Buenas noches</button>
  </div></div>`;
};
let RAPUNTAR = false;

/* ---------- 20 · Patrones ---------- */
function semana(off) { const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow + off * 7); return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return ymd(x); }); }
R.patrones = () => {
  const off = S.ui.semana || 0, dias7 = semana(off), L = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  let b = ''; const W = 255, base = 132;
  dias7.forEach((f, i) => {
    const cx = 18 + i * 36.5, ps = (S.dias[f] || {}).piezas || [], nv = (S.dias[f] || {}).nivel;
    let y = base;
    ps.slice(0, 7).forEach((p, j) => {
      if (p.t === 'hoja') { b += leafG(cx, y - 11, .23, j % 2 ? 90 : -90, COL.acc); y -= 15; }
      else if (p.t === 'sol') { b += `<path d="${ptsD(sunPts(cx, y - 11, 11, 8, .14))}" fill="${COL.o}"/>`; y -= 23; }
      else { b += semiG(cx, y - 8, 12, COL.n); y -= 14; }
    });
    if (!ps.length) b += `<circle cx="${cx}" cy="${base - 4}" r="3" fill="currentColor" opacity=".2"/>`;
    b += `<text x="${cx}" y="${base + 18}" text-anchor="middle" font-size="12" fill="currentColor" opacity="${f === hoyStr() ? 1 : .55}" font-weight="${f === hoyStr() ? 700 : 400}">${L[i]}</text>`;
    if (nv != null) b += `<rect x="${cx - 9}" y="${base + 24}" width="18" height="4" rx="2" fill="${NIVELES[nv].hex}"/>`;
  });
  const total = dias7.reduce((a, f) => a + (((S.dias[f] || {}).piezas || []).length), 0);
  const desc = descubrimientos();
  const meds = S.arr.filter(a => a.est && a.real).slice(-10);
  const est = meds.reduce((a, x) => a + x.est, 0) / (meds.length || 1), real = meds.reduce((a, x) => a + x.real, 0) / (meds.length || 1);
  const mx = Math.max(est, real, 1);
  const r0 = dias7[0], r6 = dias7[6], rango = `${parseYmd(r0).getDate()} ${MESES[parseYmd(r0).getMonth()].slice(0, 3)} – ${parseYmd(r6).getDate()} ${MESES[parseYmd(r6).getMonth()].slice(0, 3)}`;
  return `<div class="body"><div class="col">${topPlain()}
    <h1>Patrones</h1>
    <div class="wk"><button class="ib" data-a="sem-off" data-x="-1">${IC.back}</button><b>${off === 0 ? 'Esta semana' : (off === -1 ? 'La semana pasada' : rango)}</b><button class="ib" data-a="sem-off" data-x="1" ${off >= 0 ? 'disabled' : ''} style="transform:scaleX(-1)">${IC.back}</button></div>
    <div class="card"><div class="cl">Tus piezas por día${total ? ' · ' + total + ' en total' : ''}</div>${svg(W, 160, b)}${!total ? '<div class="s2 center" style="margin-top:-6px">Cada cosa hecha, arranque o pausa aparece aquí.</div>' : ''}</div>
    ${desc.map(([ic, t, s]) => `<div class="card sm disc">${ic}<div class="grow"><b>${t}</b><div class="s2">${s}</div></div></div>`).join('')}
    <div class="card sm"><b>Calibrador de tiempo</b>
      ${meds.length ? `<div class="calib"><div><span style="width:${Math.round(est / mx * 55)}%;background:${COL.s}"></span><em>Calculas ${minTxt(est)}</em></div><div><span style="width:${Math.round(real / mx * 55)}%;background:${COL.o}"></span><em>Tardas ${minTxt(real)}</em></div></div>` : ''}
      <div class="s2">${meds.length < 3 ? `Con tres arranques medidos (llevas ${meds.length}) calculo tu factor.` : `Tu factor: <b style="display:inline;font-size:13px">${fx(factor())}</b>. Ya lo aplico a tus estimaciones.`}</div></div>
    <button class="card sm row" style="width:100%;text-align:left" data-a="ir" data-x="racha">${P.hoja(28)}<div class="grow"><b>Racha sin culpa</b><div class="s2">El mes en piezas.</div></div><span class="chev">›</span></button>
  </div></div>`;
};
function descubrimientos() {
  const out = [];
  const arr = S.arr.filter(a => a.ini);
  if (arr.length >= 5) {
    const man = arr.filter(a => new Date(a.ini).getHours() < 14).length;
    if (man / arr.length >= .6) out.push([P.sol(30), 'Rindes más por la mañana', `${man} de tus ${arr.length} arranques fueron antes de las 14:00.`]);
    else if (man / arr.length <= .4) out.push([P.sol(30), 'Arrancas mejor por la tarde', `${arr.length - man} de tus ${arr.length} arranques fueron después de las 14:00.`]);
  }
  const pp = S.pau.filter(p => p.despues != null);
  if (pp.length >= 3) { const m = pp.reduce((a, p) => a + (p.v - p.despues), 0) / pp.length; if (m > .5) out.push([P.pausa(30), 'Respirar te funciona', `Te baja ${m.toFixed(1).replace('.', ',')} puntos de media.`]); }
  const porDow = {}; Object.entries(S.dias).forEach(([f, d]) => { if (d.nivel != null) { const k = parseYmd(f).getDay(); (porDow[k] = porDow[k] || []).push(d.nivel); } });
  Object.entries(porDow).forEach(([k, xs]) => { if (xs.length >= 3 && xs.filter(x => x === 0).length / xs.length >= .6 && out.length < 3) out.push([nivelIcon(0, 30, COL.n), `Los ${DIAS[k]} sueles venir en Nuclear`, 'Planifica poco ese día. Lo que haya, sumará.']); });
  const tr = {}; S.diario.forEach(d => (d.t || []).forEach(x => tr[x] = (tr[x] || 0) + 1));
  const top = Object.entries(tr).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 3 && out.length < 3) out.push([P.hoja(30, COL.o), `Lo que más te dispara: ${top[0].toLowerCase()}`, `Aparece en ${top[1]} de tus notas.`]);
  if (!out.length) out.push([P.sol(30, COL.s), 'Aún te estoy conociendo', 'Con una semana de uso empezarán a salir tus patrones.']);
  return out.slice(0, 3);
}

/* ---------- 21 · Racha ---------- */
R.racha = () => {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth(), first = new Date(y, m, 1), nd = new Date(y, m + 1, 0).getDate();
  const off = (first.getDay() + 6) % 7;
  let cells = '';
  for (let i = 0; i < off; i++) cells += '<span></span>';
  let con = 0, ult7 = 0;
  for (let dd = 1; dd <= nd; dd++) {
    const f = ymd(new Date(y, m, dd)), ps = ((S.dias[f] || {}).piezas || []);
    const fut = f > hoyStr();
    if (!fut && ps.length) con++;
    if (!fut && ps.length && (parseYmd(hoyStr()) - parseYmd(f)) / 864e5 < 7) ult7++;
    if (ps.length && !fut) {
      const cnt = { hoja: 0, sol: 0, pausa: 0 }; ps.forEach(p => cnt[p.t]++);
      const t = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
      cells += `<span title="${dd}">${P[t](24)}</span>`;
    } else cells += `<span class="${f === hoyStr() ? 'today' : ''}">${dd}</span>`;
  }
  const noches = Object.entries(S.dias).filter(([f, x]) => f.startsWith(y + '-' + pad(m + 1)) && (x.ritual || []).length >= 4).length;
  return `<div class="body"><div class="col">${topBack('Patrones')}
    <h1>Racha</h1><div class="sub">Sin culpa, como debe ser.</div>
    <div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><b>${cap(MESES[m])}</b><small style="margin:0">${con} ${con === 1 ? 'día' : 'días'} con piezas</small></div>
      <div class="cal">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<i>${x}</i>`).join('')}${cells}</div></div>
    <div class="card sm" style="background:var(--kn)"><b style="display:inline;font-size:15px">Un día sin pieza no rompe nada.</b> <span style="font-size:15px">Llevas ${ult7} de los últimos 7.</span></div>
    <div class="card sm row">${P.pausa(28, COL.acc)}<div class="grow"><b>Rutina de sueño</b><div class="s2">${noches ? `${noches} ${noches === 1 ? 'noche completa' : 'noches completas'} este mes.` : 'Todavía ninguna noche completa este mes.'}</div></div></div>
  </div></div>`;
};

/* ---------- 22 · Ajustes ---------- */
function stepper(k, v) { return `<span class="stp"><button data-a="stp" data-k="${k}" data-x="-1">−</button><b>${v}</b><button data-a="stp" data-k="${k}" data-x="1">+</button></span>`; }
R.ajustes = () => {
  const a = S.aj, ult = a.ultCopia ? new Date(a.ultCopia) : null;
  const copia = !a.url ? 'Sin conectar' : (a.copiaError ? 'No se pudo guardar' : (ult ? `Guardado ${ult.toDateString() === new Date().toDateString() ? 'hoy a las ' + pad(ult.getHours()) + ':' + pad(ult.getMinutes()) : 'el ' + ult.getDate() + ' de ' + MESES[ult.getMonth()]}` : 'Conectado'));
  return `<div class="body"><div class="col">${topBack('Atrás')}
    <h1>Ajustes</h1>
    <div class="lab">Tú</div><div class="card sm"><div class="srow"><span>Nombre</span><input class="tx" data-aj="nombre" value="${esc(a.nombre)}" placeholder="Tu nombre"></div></div>
    <div class="lab">Niveles: cuántas cosas caben</div><div class="card sm">${[0, 1, 2].map(i => `<div class="srow"><span class="row">${nivelIcon(i, 22, NIVELES[i].hex)}${NIVELES[i].n}</span>${stepper('niv' + i, a.niv[i])}</div>`).join('')}</div>
    <div class="lab">Arrancar</div><div class="card sm">
      <div class="srow"><span>Duración</span>${stepper('dur', a.dur + ' min')}</div>
      <div class="srow"><span>Bloque de trabajo</span>${stepper('bloque', a.bloque + ' min')}</div>
      <div class="srow"><span>Descanso</span>${stepper('desc', a.desc + ' min')}</div>
      <div class="srow"><span>Cuenta atrás 5-4-3-2-1</span><button class="tgl ${a.cuenta ? 'on' : ''}" data-a="aj-cuenta"><i></i></button></div></div>
    <div class="lab">Pausa</div><div class="card sm"><div class="srow"><span>Respiración</span><div class="seg" style="width:170px;padding:3px"><button class="${a.resp === '46' ? 'on' : ''}" data-a="aj-resp" data-x="46">4-6</button><button class="${a.resp === '478' ? 'on' : ''}" data-a="aj-resp" data-x="478">4-7-8</button></div></div></div>
    <div class="lab">Proyectos y horarios</div><div class="card sm">
      <div class="srow"><span>Proyectos abiertos a la vez</span>${stepper('limP', a.limP)}</div>
      <div class="srow"><span>Cerrar el día desde</span><input type="time" data-aj="hCierre" value="${a.hCierre}"></div>
      <div class="srow"><span>Pantallas fuera</span><input type="time" data-aj="hPant" value="${a.hPant}"></div></div>
    <div class="lab">Apariencia</div><div class="seg">${[['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Automático']].map(([k, t]) => `<button class="${a.tema === k ? 'on' : ''}" data-a="tema" data-x="${k}">${t}</button>`).join('')}</div>
    <div class="lab">Copia en Google Sheets</div><div class="card sm">
      <div class="srow"><span>Estado</span><span class="${a.copiaError ? '' : 'ok'}" style="${a.copiaError ? 'color:var(--hot);font-weight:700;font-size:13px' : ''}">${copia}</span></div>
      <div class="srow"><span>URL del script</span><input class="tx" data-aj="url" value="${esc(a.url)}" placeholder="https://script.google.com/…"></div>
      <div class="srow"><span>Clave</span><input class="tx" data-aj="clave" value="${esc(a.clave)}" placeholder="la de tu script"></div>
      ${a.url ? '<div class="two" style="margin:10px 0 4px"><button class="btn soft" data-a="recuperar" style="height:46px;font-size:14.5px">Recuperar</button><button class="btn" data-a="copiar" style="height:46px;font-size:14.5px">Guardar ahora</button></div>' : ''}</div>
    <div class="lab">Tus datos</div><div class="card sm">
      <button class="srow" data-a="exportar"><span>Exportar a un archivo</span><span class="chev">›</span></button>
      <label class="srow" style="position:relative"><span>Importar desde un archivo</span><span class="chev">›</span><input type="file" accept=".json,application/json" data-a="importar" style="position:absolute;inset:0;opacity:0"></label>
      <button class="srow" data-a="borrar-todo" style="color:var(--hot)"><span>Borrar todo</span></button></div>
    <button class="link" data-a="ver-bienvenida">Ver la bienvenida otra vez</button>
    <div class="ver">Dopa · versión ${VERSION}<br>Tus datos están en este iPhone${a.url ? ' y en tu Google Sheets' : ''}.</div>
  </div></div>`;
};

/* =====================================================================
   hoja (bottom sheet) con arrastre
   ===================================================================== */
let HOJA_CB = null;
function hoja(html, cb) {
  $('#sheet-body').innerHTML = html; $('#sheet-body').scrollTop = 0;
  $('#scrim').classList.add('on'); const sh = $('#sheet'); sh.style.transform = ''; sh.classList.add('on');
  HOJA_CB = null; if (cb) cb();
}
function cerrarHoja() { $('#scrim').classList.remove('on'); const sh = $('#sheet'); sh.style.transform = ''; sh.classList.remove('on'); F = null; }
(function arrastre() {
  const sh = $('#sheet'); let y0 = null, dy = 0, t0 = 0, desde = false;
  sh.addEventListener('touchstart', e => {
    const enGrab = e.target.closest('.grab-zone'), body = $('#sheet-body');
    if (!enGrab && body.scrollTop > 0) { y0 = null; return; }
    if (e.target.closest('input,textarea,button')) { if (!enGrab) { y0 = null; return; } }
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); desde = !!enGrab;
  }, { passive: true });
  sh.addEventListener('touchmove', e => {
    if (y0 == null) return; dy = e.touches[0].clientY - y0;
    if (dy > 0) { sh.classList.add('drag'); sh.style.transform = `translateY(${dy}px)`; if (!desde) e.preventDefault(); }
  }, { passive: false });
  sh.addEventListener('touchend', () => {
    if (y0 == null) return; sh.classList.remove('drag');
    const v = dy / Math.max(1, Date.now() - t0);
    if (dy > 120 || v > .6) cerrarHoja(); else sh.style.transform = '';
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
  pop.style.left = Math.min(r.left - app.left + 10, app.width - 236) + 'px';
  const top = r.bottom - app.top + 6, h = items.length * 46 + 12;
  pop.style.top = (top + h > app.height - 30 ? r.top - app.top - h - 6 : top) + 'px';
  pop.classList.add('on'); $('#pop-scrim').classList.add('on');
}
function cerrarPop() { $('#pop').classList.remove('on'); $('#pop-scrim').classList.remove('on'); if (LIFT) LIFT.classList.remove('lift'); LIFT = null; }
function menuDe(kind, id, node) {
  if (kind === 'cosa') { const c = S.cosas.find(x => x.id === id); if (!c) return;
    abrirPop(node, [['Arrancar', 'preparar', id], ['Editar', 'editar', id], c.hoy === hoyStr() ? ['A más tarde', 'a-luego', id] : ['A hoy', 'a-hoy', id], ['Borrar', 'borrar', id, 'del']]); }
  if (kind === 'proy') { const p = proyDe(id); abrirPop(node, [[p.abierto ? 'Aparcar' : 'Abrir', p.abierto ? 'aparcar' : 'reabrir', id], ['Borrar proyecto', 'borrar-proy', id, 'del']]); }
  if (kind === 'guion') abrirPop(node, [['Borrar guion', 'borrar-guion', id, 'del']]);
  if (kind === 'diario') abrirPop(node, [['Borrar nota', 'borrar-diario', id, 'del']]);
}
document.addEventListener('touchstart', e => {
  const n = e.target.closest('[data-press]'); if (!n) return;
  PRESS = { n, t: setTimeout(() => { PRESS.done = true; menuDe(n.dataset.press, n.dataset.x, n); }, 480), x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
document.addEventListener('touchmove', e => { if (PRESS && (Math.abs(e.touches[0].clientX - PRESS.x) > 8 || Math.abs(e.touches[0].clientY - PRESS.y) > 8)) { clearTimeout(PRESS.t); PRESS = null; } }, { passive: true });
document.addEventListener('touchend', e => { if (PRESS) { clearTimeout(PRESS.t); if (PRESS.done) { e.preventDefault(); } PRESS = null; } });
document.addEventListener('contextmenu', e => { const n = e.target.closest('[data-press]'); if (n) { e.preventDefault(); menuDe(n.dataset.press, n.dataset.x, n); } });

/* =====================================================================
   aviso flotante
   ===================================================================== */
let TT = null;
function toast(t, conDeshacer = false) {
  const el_ = $('#toast'); $('#toast-t').textContent = t; $('#toast-b').hidden = !conDeshacer;
  el_.classList.toggle('arriba', $('#sheet').classList.contains('on') || !TABS.includes(ACT));
  el_.classList.add('on'); clearTimeout(TT); TT = setTimeout(() => el_.classList.remove('on'), conDeshacer ? 4200 : 2200);
}

/* =====================================================================
   acciones
   ===================================================================== */
const ACC = {};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.tagName === 'INPUT') return;
  const a = b.dataset.a; if (ACC[a]) { ACC[a](b.dataset.x, b, e); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.f && F) F[t.dataset.f] = t.value;
  if (t.id === 'f-txt') { const p = $('#f-paso'); if (p) p.placeholder = sugerirPaso(t.value); }
  if (t.id === 'ar-paso') AR.paso = t.value;
  if (t.id === 'ar-otra') AR.otra = t.value;
  if (t.id === 'tr-e' && TRF) TRF.e = t.value;
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.aj) { S.aj[t.dataset.aj] = t.value.trim(); if (t.dataset.aj === 'url' || t.dataset.aj === 'clave') S.aj.copiaError = false; save(); if (t.dataset.aj === 'url') refresh(); }
  if (t.id === 'ar-salida') AR.salida = t.value;
  if (t.dataset.a === 'importar') importar(t.files[0]);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = e.target.id;
  if (id === 'np') ACC['np-ok'](); if (id === 'rp') ACC['rp-ok'](); if (id === 'tr-otro') ACC['tr-otro-ok'](null, e.target.closest('.col').querySelector('[data-a="tr-otro-ok"]'));
  if (id === 'f-txt') { const p = $('#f-paso'); if (p) p.focus(); }
});

Object.assign(ACC, {
  'tab': x => go(x, 'tab'),
  'ir': x => { if (x === 'semaforo') SEM = 0; if (x === 'trace') TRF = null; if (x === 'buenos' && nivelHoy() != null) {} go(x); },
  'atras': () => atras(),
  'deshacer': () => deshacer(), 'rehacer': () => rehacer(),
  'cerrar-hoja': () => cerrarHoja(), 'pop-cerrar': () => cerrarPop(),

  /* bienvenida */
  'onb-sig': () => { if (ONB === 2) { const n = $('#onb-nombre'); S.aj.nombre = n ? n.value.trim() : ''; S.onb = true; save(); go('buenos', 'push', true); HIST = []; return; } ONB++; render('bienvenida'); },
  'onb-atras': () => { ONB = Math.max(0, ONB - 1); render('bienvenida'); },
  'ver-bienvenida': () => { ONB = 0; go('bienvenida'); },

  /* buenos días */
  'nivel': x => {
    const i = +x;
    commit(() => {
      const d = dia(); const primera = d.nivel == null; d.nivel = i;
      if (primera) { // lo que quedó de días anteriores: a hoy si cabe, si no a Más tarde
        const cap_ = S.aj.niv[i]; let caben = cap_ - cosasHoy().length;
        S.cosas.filter(c => !c.hecha && c.hoy && c.hoy < hoyStr()).forEach(c => { if (caben > 0) { c.hoy = hoyStr(); caben--; } else c.hoy = null; });
      }
    });
    setTimeout(() => go('hoy', 'tab'), reduceMotion() ? 0 : 260);
  },
  'sueno': x => { commit(() => { dia().sueno = +x; }); },

  /* hoy */
  'hecha': (id, b) => {
    const c = S.cosas.find(x => x.id === id); if (!c) return;
    const ck = b; ck.classList.add('pop'); ck.innerHTML = checkSvg(!c.hecha);
    const row = b.closest('.task'); if (row && !c.hecha) row.classList.add('done');
    setTimeout(() => commit(() => {
      if (c.hecha) { c.hecha = null; const d = dia(); const k = d.piezas.findIndex(p => p.t === 'hoja' && p.ref === id); if (k >= 0) d.piezas.splice(k, 1); }
      else { c.hecha = Date.now(); if (!c.hoy) c.hoy = hoyStr(); pieza('hoja', id); }
    }, c.hecha ? 'Una menos.' : null, true), reduceMotion() ? 0 : 420);
  },
  'comp': () => { S.ui.comp = !S.ui.comp; save(); const n = document.querySelector('#s-hoy .comp'); if (n) n.classList.toggle('on', S.ui.comp); },
  'anadir': () => abrirCosa(null),
  'anadir-luego': () => { abrirCosa(null); F.dest = 'luego'; $('#sheet-body').innerHTML = htmlCosa(); },
  'editar': id => { cerrarPop(); abrirCosa(id); },
  'f-est': x => { F.est = +x; $('#sheet-body').innerHTML = htmlCosa(); },
  'f-proy': x => { F.proy = x || null; $('#sheet-body').innerHTML = htmlCosa(); },
  'f-cuando': x => { F.cuando = x; $('#sheet-body').innerHTML = htmlCosa(); },
  'f-dest': x => { F.dest = x; $('#sheet-body').innerHTML = htmlCosa(); },
  'f-guardar': () => {
    const txt = (F.txt || '').trim(); if (!txt) { const i = $('#f-txt'); if (i) { i.focus(); i.placeholder = 'Escribe qué hay que hacer'; } return; }
    const f = F;
    commit(() => {
      let c = f.id ? S.cosas.find(x => x.id === f.id) : null;
      if (!c) { c = { id: uid(), creada: Date.now(), hecha: null }; S.cosas.push(c); }
      Object.assign(c, { txt, paso: (f.paso || '').trim(), est: f.est, proy: f.proy, cuando: f.cuando, hoy: f.dest === 'hoy' ? hoyStr() : null });
    }, f.id ? 'Guardado' : (f.dest === 'hoy' ? 'Apuntado para hoy' : 'Apuntado para más tarde'), true);
    cerrarHoja();
  },
  'f-borrar': () => { const id = F.id; cerrarHoja(); ACC.borrar(id); },
  'borrar': id => { cerrarPop(); commit(() => { S.cosas = S.cosas.filter(x => x.id !== id); }, 'Borrado', true); },
  'a-luego': id => { cerrarPop(); commit(() => { const c = S.cosas.find(x => x.id === id); c.hoy = null; }, 'A más tarde', true); },
  'a-hoy': id => {
    cerrarPop();
    if (pendHoy().length + hechasHoy().length >= capHoy()) { toast(`Hoy ya caben ${capHoy()}. Pasa una a Más tarde primero.`); return; }
    commit(() => { const c = S.cosas.find(x => x.id === id); c.hoy = hoyStr(); c.preguntada = true; }, 'A hoy', true);
  },
  'soltar': id => commit(() => { S.cosas = S.cosas.filter(x => x.id !== id); }, 'Soltado', true),

  /* proyectos */
  'np': () => { if (proyAbiertos().length >= S.aj.limP) { toast('Aparca uno para abrir otro'); return; } NUEVO_PROY = true; refresh(); },
  'np-cancelar': () => { NUEVO_PROY = false; refresh(); },
  'np-ok': () => { const i = $('#np'), v = i ? i.value.trim() : ''; if (!v) return; NUEVO_PROY = false;
    commit(() => { S.proy.push({ id: uid(), nombre: v, color: PROY_COL[S.proy.length % PROY_COL.length], abierto: true }); }, 'Proyecto abierto', true); },
  'aparcar': id => { cerrarPop(); commit(() => { proyDe(id).abierto = false; }, 'Aparcado', true); },
  'reabrir': id => { cerrarPop(); if (proyAbiertos().length >= S.aj.limP) { toast(`Ya tienes ${S.aj.limP} abiertos. Aparca uno primero.`); return; } commit(() => { proyDe(id).abierto = true; }, 'Abierto', true); },
  'borrar-proy': id => { cerrarPop(); commit(() => { S.proy = S.proy.filter(p => p.id !== id); S.cosas.forEach(c => { if (c.proy === id) c.proy = null; }); }, 'Proyecto borrado', true); },

  /* arrancar */
  'preparar': id => { cerrarPop(); const c = S.cosas.find(x => x.id === id); AR.cosa = id; AR.paso = c ? (c.paso || '') : ''; AR.dur = S.aj.dur; go('arrancar', 'tab'); },
  'ar-cosa': x => { AR.cosa = x; const c = S.cosas.find(y => y.id === x); AR.paso = c ? (c.paso || '') : ''; render('arrancar'); },
  'ar-dur': x => { AR.dur = +x; render('arrancar'); },
  'ar-hiper': () => { AR.hiper = !AR.hiper; render('arrancar'); },
  'empezar': () => {
    const c = S.cosas.find(x => x.id === AR.cosa);
    const txt = c ? c.txt : (AR.otra || '').trim();
    if (!txt) { const i = $('#ar-otra'); if (i) { i.focus(); i.placeholder = 'Escribe qué vas a empezar'; } return; }
    const paso = (AR.paso || '').trim() || (c && c.paso) || '';
    if (c && paso && !c.paso) { c.paso = paso; save(); }
    SES = { id: uid(), cosa: c ? c.id : null, txt, paso, dur: AR.dur, est: c ? c.est : null, ini: null, hiper: AR.hiper, salida: AR.hiper ? (AR.salida || masMin(90)) : '', primer: Date.now() };
    saveSes();
    if (S.aj.cuenta) arrancarCuenta(); else empezarMarcha();
  },
  'cd-ya': () => { clearInterval(CDT); empezarMarcha(); },
  'volver-ses': () => { if (!SES) return; clearInterval(TICK); TICK = setInterval(tick, 250); go(SES.fase === 'bloques' ? 'bloques' : 'marcha', 'fade', true); },
  'seguir5': () => { SES.ini = Date.now(); saveSes(); const ac = $('#t-acc'); if (ac) ac.dataset.fin = ''; tick(); toast(`${SES.dur} minutos más`); },
  'a-bloques': () => { SES.fase = 'bloques'; SES.bIni = Date.now(); saveSes(); go('bloques', 'fade', true); tick(); },
  'atasco': () => hoja(htmlAtasco(false)),
  'at': x => {
    if (x === 'grande') { $('#sheet-body').innerHTML = htmlAtasco(true); setTimeout(() => { const i = $('#at-paso'); if (i) i.focus(); }, 100); return; }
    cerrarHoja();
    if (x === 'distraido') { toast('Solo el primer paso: ' + (SES.paso || 'empieza por lo más pequeño')); }
    if (x === 'apetece') { SES.dur = 2; SES.ini = Date.now(); saveSes(); render('marcha'); tick(); toast('Solo 2 minutos. Luego decides.'); }
    if (x === 'saturado') { terminarSesion(false); TV = null; go('pausa', 'tab'); }
  },
  'at-paso-ok': () => { const v = ($('#at-paso') || {}).value || ''; if (!v.trim()) return; SES.paso = v.trim(); SES.ini = Date.now(); saveSes(); cerrarHoja(); render('marcha'); tick(); toast('Con este paso. Solo eso.'); },
  'idea': () => hoja(`<h2>Idea suelta</h2><p class="sub">La apuntas y sigues. Va a Más tarde.</p><input class="inp" id="idea-t" style="margin-top:14px" placeholder="Lo que se te ha ocurrido"><div style="height:14px"></div><button class="btn" data-a="idea-ok">Apuntar y seguir</button>`, () => setTimeout(() => { const i = $('#idea-t'); if (i) i.focus(); }, 300)),
  'idea-ok': () => { const v = ($('#idea-t') || {}).value || ''; if (v.trim()) { S.cosas.push({ id: uid(), txt: v.trim(), creada: Date.now(), hecha: null, hoy: null, est: null }); save(); toast('Apuntada. Sigue con lo tuyo.'); } cerrarHoja(); },
  'terminar': () => terminarSesion(true),
  'fin-hecha': () => { const id = FIN.cosa; commit(() => { const c = S.cosas.find(x => x.id === id); if (c && !c.hecha) { c.hecha = Date.now(); if (!c.hoy) c.hoy = hoyStr(); pieza('hoja', id); } }, 'Una menos.', true); FIN = null; go('hoy', 'tab'); },
  'fin-sigue': () => { const id = FIN.cosa, v = ($('#fin-paso') || {}).value || ''; commit(() => { const c = S.cosas.find(x => x.id === id); if (c && v.trim()) c.paso = v.trim(); }, v.trim() ? 'Siguiente paso apuntado' : null); FIN = null; go('hoy', 'tab'); },
  'fin-ok': () => { FIN = null; go('hoy', 'tab'); },

  /* pausa */
  'tv': x => { TV = +x; render('pausa'); },
  'p-guardar': () => { guardarPausa(TV); toast('Apuntado. Sigue con lo tuyo.'); TV = null; render('pausa'); },
  'p-resp46': () => { if (TV) guardarPausa(TV); RS = null; S.aj.resp = '46'; save(); go('respirar'); },
  'p-resp478': () => { if (TV) guardarPausa(TV); RS = null; S.aj.resp = '478'; save(); go('respirar'); },
  'p-stop': () => { if (TV) guardarPausa(TV); ST = { i: 0, t0: Date.now() }; go('stop'); clearInterval(STT); STT = setInterval(stopTick, 500); stopTick(); },
  'r-pat': x => { S.aj.resp = x; save(); render('respirar'); },
  'r-go': () => respirarGo(S.aj.resp),
  'r-fin': () => terminarResp(),
  'r-despues': x => { const p = S.pau[S.pau.length - 1]; if (p && Date.now() - p.ts < 30 * 6e4) { p.despues = +x; save(); }
    toast(p && +x < p.v ? `De ${p.v} a ${x}. Bien hecho.` : 'Apuntado.'); RS = null; TV = null; go('pausa', 'tab'); },
  'r-salir': () => { RS = null; TV = null; go('pausa', 'tab'); },
  'sem': x => { SEM = +x; render('semaforo'); },
  'sem-sig': () => { if (SEM < 2) { SEM++; render('semaforo'); } else { toast('Hecho. Tú eliges.'); atras(); } },
  'st-sig': () => { if (ST.i < 3) { ST.i++; ST.t0 = Date.now(); render('stop'); stopTick(); } else { clearInterval(STT); toast('Hecho. Ahora, con calma.'); TV = null; go('pausa', 'tab'); } },
  'tr': (x, b) => { const k = b.dataset.k, arr = TRF[k]; const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); else arr.push(x); b.classList.toggle('on'); },
  'tr-otro': (x, b) => { TRF.otro = b.dataset.k; refresh(); setTimeout(() => { const i = $('#tr-otro'); if (i) i.focus(); }, 50); },
  'tr-otro-ok': (x, b) => { const v = ($('#tr-otro') || {}).value || ''; if (v.trim()) TRF[b.dataset.k].push(v.trim()); TRF.otro = null; refresh(); },
  'tr-f': x => { TRF.f = +x; refresh(); },
  'tr-e': x => { TRF.e = x; const i = $('#tr-e'); if (i) i.value = x; },
  'tr-guardar': () => { const d = Object.assign({ ts: Date.now() }, TRF); delete d.otro; if (!d.t.length && !d.r.length && !d.a.length && !d.e) { toast('Toca al menos una cosa'); return; }
    commit(() => { S.diario.push(d); }, 'Guardado en tu diario', true); TRF = null; atras(); },
  'borrar-diario': x => { cerrarPop(); commit(() => { S.diario = S.diario.filter(d => String(d.ts) !== String(x)); }, 'Nota borrada', true); },
  'g-cat': x => { S.ui.gcat = x; save(); GOPEN = null; refresh(); },
  'g-open': x => { GOPEN = GOPEN === x ? null : x; document.querySelectorAll('#s-guiones .gcard').forEach(c => { const k = c.querySelector('.gc').dataset.x; c.classList.toggle('on', k === GOPEN); }); },
  'g-copy': x => { (navigator.clipboard ? navigator.clipboard.writeText(x) : Promise.reject()).then(() => toast('Copiado'), () => toast('No se pudo copiar')); },
  'g-new': () => { GNEW = !GNEW; refresh(); if (GNEW) setTimeout(() => { const i = $('#g-t'); if (i) i.focus(); }, 50); },
  'g-save': () => { const t = ($('#g-t') || {}).value || '', x = ($('#g-x') || {}).value || ''; if (!t.trim() || !x.trim()) return; GNEW = false;
    commit(() => { S.guiones.push({ id: uid(), titulo: t.trim(), texto: x.trim() }); S.ui.gcat = 'Míos'; }, 'Guion guardado', true); },
  'borrar-guion': x => { cerrarPop(); commit(() => { S.guiones = S.guiones.filter(g => g.id !== x); }, 'Guion borrado', true); },

  /* cierre y noche */
  'ci-luego': id => commit(() => { S.cosas.find(x => x.id === id).hoy = null; }, 'A más tarde', true),
  'ci-manana': id => commit(() => { S.cosas.find(x => x.id === id).hoy = addDays(hoyStr(), 1); }, 'A mañana', true),
  'ci-guardar': () => {
    const d = dia(); d.mejor = ($('#ci-mejor') || {}).value || ''; d.manana = ($('#ci-manana') || {}).value || '';
    commit(() => {
      d.cerrado = true;
      if (d.manana.trim()) { const ya = S.cosas.find(c => c.txt === d.manana.trim() && !c.hecha); if (!ya) S.cosas.push({ id: uid(), txt: d.manana.trim(), creada: Date.now(), hecha: null, hoy: addDays(hoyStr(), 1), est: 30, cuando: 'manana' }); }
    }, 'Día guardado', false);
    copiaSheets(true);
    go(ahoraMin() >= horaMin(S.aj.hPant) - 120 ? 'sueno' : 'hoy', ahoraMin() >= horaMin(S.aj.hPant) - 120 ? 'push' : 'tab');
  },
  'ritual': x => commit(() => { const d = dia(), i = +x, k = d.ritual.indexOf(i); if (k >= 0) d.ritual.splice(k, 1); else d.ritual.push(i); }),
  'ritual-apuntar': () => { RAPUNTAR = !RAPUNTAR; refresh(); if (RAPUNTAR) setTimeout(() => { const i = $('#rp'); if (i) i.focus(); }, 50); },
  'rp-ok': () => { const v = ($('#rp') || {}).value || ''; if (!v.trim()) return;
    commit(() => { S.cosas.push({ id: uid(), txt: v.trim(), creada: Date.now(), hecha: null, hoy: null, est: null }); const d = dia(); if (!d.ritual.includes(2)) d.ritual.push(2); }, 'Apuntado para más tarde', true);
    const i = $('#rp'); if (i) { i.value = ''; i.focus(); } },
  'buenas-noches': () => { toast('Buenas noches'); go('hoy', 'tab'); },

  /* patrones */
  'sem-off': x => { S.ui.semana = Math.min(0, (S.ui.semana || 0) + (+x)); save(); refresh(); },

  /* ajustes */
  'stp': (x, b) => {
    const k = b.dataset.k, d = +x;
    const lim = { dur: [1, 25], bloque: [5, 60], desc: [1, 15], limP: [1, 6], niv0: [1, 3], niv1: [1, 7], niv2: [2, 10] };
    let v = k.startsWith('niv') ? S.aj.niv[+k.slice(3)] : S.aj[k];
    const step = (k === 'bloque') ? 5 : 1;
    v = Math.min(lim[k][1], Math.max(lim[k][0], v + d * step));
    if (k.startsWith('niv')) S.aj.niv[+k.slice(3)] = v; else S.aj[k] = v;
    save(); refresh();
  },
  'aj-cuenta': () => { S.aj.cuenta = !S.aj.cuenta; save(); refresh(); },
  'aj-resp': x => { S.aj.resp = x; save(); refresh(); },
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

function terminarSesion(conFin) {
  clearInterval(TICK); clearInterval(CDT);
  if (!SES) { go('hoy', 'tab'); return; }
  const real = Math.max(1, Math.round((Date.now() - (SES.primer || SES.ini || Date.now())) / 6e4));
  const s = SES; SES = null; saveSes();
  commit(() => { S.arr.push({ id: s.id, cosa: s.cosa, ini: s.primer, real, est: s.est || null }); pieza('sol', s.cosa); });
  if (conFin) { FIN = { cosa: s.cosa, est: s.est, real }; go('fin', 'fade', true); }
}

function importar(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => { try { const d = JSON.parse(r.result); if (!d || !d.aj) throw 0; commit(() => { S = Object.assign(DEF(), d); }, 'Datos importados', true); } catch (e) { toast('Ese archivo no es de Dopa'); } };
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
  try { await llamar('guardar', { version: VERSION, datos: S }); S.aj.ultCopia = Date.now(); S.aj.copiaError = false; save(); if (!silencioso) toast('Copia guardada'); }
  catch (e) { S.aj.copiaError = true; save(); toast('No se pudo guardar la copia. Mira Ajustes.'); }
  if (ACT === 'ajustes') refresh();
}
async function recuperar() {
  if (!S.aj.url) return;
  try { const j = await llamar('recuperar'); if (!j.datos) { toast('No hay ninguna copia todavía'); return; }
    commit(() => { const aj = S.aj; S = Object.assign(DEF(), j.datos); S.aj.url = aj.url; S.aj.clave = aj.clave; }, 'Copia recuperada', true); }
  catch (e) { toast('No se pudo recuperar. Revisa la URL y la clave.'); }
}

/* =====================================================================
   tema
   ===================================================================== */
function aplicarTema(anim) {
  const t = S.aj.tema, dark = t === 'oscuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const r = document.documentElement;
  if (anim && !reduceMotion()) { r.classList.add('theme-anim'); setTimeout(() => r.classList.remove('theme-anim'), 500); }
  r.dataset.theme = dark ? 'dark' : 'light'; themeColor();
}
function themeColor() { const m = $('#theme-color'); if (m) m.content = getComputedStyle(el(ACT || 'hoy')).backgroundColor || '#FFF5E8'; }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.aj.tema === 'auto') { aplicarTema(true); refresh(); } });

/* =====================================================================
   arranque
   ===================================================================== */
function inicio() {
  aplicarTema(false);
  $('#tabbar').querySelectorAll('button').forEach(b => { b.querySelector('.ti').innerHTML = tabIcon(b.dataset.x, false); });
  const q = new URLSearchParams(location.search).get('abrir');
  if (!S.onb) { go('bienvenida', 'fade'); return; }
  if (SES && SES.ini) { clearInterval(TICK); TICK = setInterval(tick, 250); go(SES.fase === 'bloques' ? 'bloques' : 'marcha', 'fade'); return; }
  if (q && R[q]) { go(q, 'fade'); return; }
  if (nivelHoy() == null) { go('buenos', 'fade'); return; }
  go('hoy', 'tab');
}
let DIA = hoyStr();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (hoyStr() !== DIA) { DIA = hoyStr(); if (!SES) { HIST = []; go(nivelHoy() == null ? 'buenos' : 'hoy', 'fade'); return; } }
  if (SES && SES.ini) tick(); else refresh();
});
/* el contenedor nunca se desplaza (el foco en un campo podría moverlo) */
$('#app').addEventListener('scroll', () => { $('#app').scrollTop = 0; $('#app').scrollLeft = 0; });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
inicio();
