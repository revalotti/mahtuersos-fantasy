// Campo de la alineación dibujado con los datos de Biwenger (en lugar de su imagen). Formato tomado del diseño aprobado:
// campo en perspectiva, píldora por jugador con sus puntos, capitán (C) y ariete, formación en la esquina y 4 suplentes.
// `mountField(host, data, { crestUrl })` pinta dentro de `host` y se recoloca solo al cambiar de tamaño; devuelve una función que lo detiene.
//   w: 1 = sin puntos porque su partido está por jugar
//   data: { formacion, PT, DF, MC, DL: [{ n, p, c?, a?, eq } | { v: 1, p: -4 } (posición sin jugador: resta 4)], banquillo: [{ n, p, eq, pos } | null ×4] }   (p = null: sin puntuar)

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Color de los puntos: valor máximo incluido → clase. El 0 no es negativo: se ve neutro, como quien no ha jugado.
const TRAMOS = [[-0.01, 'neg'], [0, 'none'], [5, 'low'], [9, 'mid'], [Infinity, 'high']];
const vacio = p => p === null || p === undefined || p === '-';
const clase = p => vacio(p) ? 'none' : TRAMOS.find(([m]) => p <= m)[1];

const GENERICO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#cfd4de" stroke="#fff" stroke-width="1.2" d="M12 2.5l8 2.8v6.1c0 4.9-3.4 8.6-8 10.1-4.6-1.5-8-5.2-8-10.1V5.3z"/></svg>');
// Icono "shoe-cleat" de Material Design Icons (pictogrammers.com, licencia Apache-2.0)
const BOTA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8C20.76 8 20.53 8 20.3 8L20.25 7.97C18.14 7.84 16.38 7.17 15.53 6.23L14 7C13.95 7.1 13.89 7.19 13.84 7.28C14.55 7.89 15 8.65 15 9.5C15 9.83 14.91 10.14 14.79 10.45L12.92 8.58C12.7 8.83 12.47 9.07 12.22 9.29L14.25 11.32C14.04 11.57 13.8 11.79 13.5 12L11.43 9.91C11.14 10.11 10.85 10.28 10.55 10.45L12.58 12.5C12.25 12.63 11.89 12.74 11.5 12.82L9.59 10.91C9.25 11.05 8.91 11.18 8.56 11.29L10.26 13C10.17 13 10.09 13 10 13C8.5 13 7.2 12.54 6.28 11.82C5.46 11.95 4.68 12 4 12C2 12 2 15 2 15V15C2 16.11 2.89 17 4 17H4V18C4 18.55 4.45 19 5 19S6 18.55 6 18V17H7V18C7 18.55 7.45 19 8 19S9 18.55 9 18V17H10V18C10 18.55 10.45 19 11 19S12 18.55 12 18V17H15V18C15 18.55 15.45 19 16 19S17 18.55 17 18V17H18V18C18 18.55 18.45 19 19 19S20 18.55 20 18V17H21C21 17 22 17 22 12.5C22 9 21 8 21 8Z"/></svg>';
// Reloj (mismo icono que la etiqueta «Partidos pendientes»): el partido de ese jugador aún no se ha jugado
const RELOJ = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const puntos = j => j.w ? `<span class="fv-pts wait" role="img" aria-label="Partido pendiente" title="Partido pendiente">${RELOJ}</span>` : `<span class="fv-pts ${clase(j.p)}">${vacio(j.p) ? '-' : j.p}</span>`;
// Cambio de suplente, como en Biwenger: flecha verde hacia arriba en el que entra, roja hacia abajo en el que sale.
const FLECHA = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const swap = j => j.si ? `<span class="fv-badge swap in" role="img" aria-label="Entra por ${esc(j.si)}" title="Entra por ${esc(j.si)}">${FLECHA('M12 19V6M6 11l6-6 6 6')}</span>`
  : j.so ? `<span class="fv-badge swap out" role="img" aria-label="Sustituido por ${esc(j.so)}" title="Sustituido por ${esc(j.so)}">${FLECHA('M12 5v13M6 13l6 6 6-6')}</span>` : '';
const POS = { PT: 'Portero', DF: 'Defensa', MC: 'Centrocampista', DL: 'Delantero' };

// Perspectiva del campo (como la vista de Biwenger): ancho arriba/abajo y altura que ocupa
const PERSP = { arriba: .075, abajo: .935, anchoArriba: .63, anchoAbajo: .95, fondo: 1.55 };
const LINEAS = ['DL', 'MC', 'DF', 'PT'];
/* Posiciones de las formaciones de Biwenger, medidas en sus capturas (px sobre un ancho de 1080).
   Cada jugador: [x, y] del centro de su píldora. Línea de fondo de arriba en y=785, la de abajo en y=1632;
   el ancho del campo va de 666 px arriba a 1006 px abajo. Los jugadores se listan de izquierda a derecha
   (en líneas de 6, los dos del centro: primero el de arriba y luego el de abajo). */
const PT_ = [[540, 1659]];
const DF3 = [[298, 1379], [540, 1448], [780, 1379]];
const DF4 = [[235, 1345], [403, 1414], [675, 1414], [845, 1345]];
const DF5 = [[213, 1311], [370, 1379], [540, 1448], [700, 1379], [860, 1311]];
const BIWENGER = {
  '3-4-3': { DL: [[325, 890], [540, 958], [750, 890]], MC: [[240, 1102], [405, 1170], [675, 1170], [840, 1102]], DF: DF3 },
  '3-5-2': { DL: [[403, 925], [675, 925]], MC: [[228, 1068], [385, 1136], [540, 1204], [695, 1136], [858, 1068]], DF: DF3 },
  '4-3-3': { DL: [[330, 890], [540, 958], [750, 890]], MC: [[310, 1136], [540, 1204], [763, 1136]], DF: DF4 },
  '4-4-2': { DL: [[403, 925], [675, 925]], MC: [[235, 1102], [403, 1170], [675, 1170], [840, 1102]], DF: DF4 },
  '4-5-1': { DL: [[540, 890]], MC: [[230, 1068], [380, 1136], [540, 1204], [695, 1136], [850, 1068]], DF: DF4 },
  '5-2-3': { DL: [[330, 890], [540, 958], [750, 890]], MC: [[403, 1170], [675, 1170]], DF: DF5 },
  '5-3-2': { DL: [[403, 925], [675, 925]], MC: [[310, 1136], [540, 1204], [763, 1136]], DF: DF5 },
  '5-4-1': { DL: [[540, 890]], MC: [[240, 1102], [403, 1170], [675, 1170], [840, 1102]], DF: DF5 },
  // especiales (alineaciones extra)
  '3-2-5': { DL: [[240, 868], [388, 936], [540, 1004], [695, 936], [845, 868]], MC: [[403, 1170], [675, 1170]], DF: DF3 },
  '3-3-4': { DL: [[270, 902], [428, 970], [650, 970], [805, 902]], MC: [[300, 1136], [540, 1204], [763, 1136]], DF: DF3 },
  '3-6-1': { DL: [[540, 890]], MC: [[235, 1068], [380, 1136], [540, 1045], [540, 1204], [695, 1136], [850, 1068]], DF: DF3 },
  '4-2-4': { DL: [[270, 902], [428, 970], [650, 970], [805, 902]], MC: [[403, 1170], [675, 1170]], DF: DF4 },
  '4-6-0': { DL: [], MC: [[235, 1068], [380, 1136], [540, 1045], [540, 1204], [695, 1136], [845, 1068]], DF: DF4 },
  '5-1-4': { DL: [[270, 902], [428, 970], [650, 970], [805, 902]], MC: [[540, 1136]], DF: DF5 },
};
// de coordenadas de la captura a posición relativa en el campo: u = desplazamiento respecto al centro
// en fracciones del ancho del campo a esa altura; t = 0 en la línea de fondo de arriba, 1 en la de abajo
const relativo = ([x, y]) => { const t = (y - 785) / 847, w = 666 + 340 * t; return { u: (x - 540) / w, t }; };
const ESC = 26, PILL = 17, SEP = 1;   // escudo, píldora y separación (px)

/* Proyección del campo (68 × 105 m) en perspectiva, en píxeles del escenario */
function proyeccion(W, H) {
  const yT = PERSP.arriba * H, yB = PERSP.abajo * H, r = PERSP.fondo;
  const fy = v => v / (v + r * (1 - v));   // la mitad del fondo se ve más corta
  const Y = v => yT + (yB - yT) * fy(v);
  const ancho = y => W * (PERSP.anchoArriba + (PERSP.anchoAbajo - PERSP.anchoArriba) * (y - yT) / (yB - yT));
  const P = (u, v) => { const y = Y(v); return [W / 2 + (u - .5) * ancho(y), y]; };
  return { Y, ancho, P };
}

function campo(stage, svg) {
  const W = stage.clientWidth, H = stage.clientHeight, { P } = proyeccion(W, H);
  const pt = p => p.map(n => n.toFixed(1)).join(' ');
  const poly = (pts, cls) => `<path class="${cls}" d="M${pts.map(p => pt(P(...p))).join('L')}Z"/>`;
  const line = (pts, cls = 'ln') => `<path class="${cls}" d="M${pts.map(p => pt(P(...p))).join('L')}"/>`;
  const rect = (u0, v0, u1, v1, cls = 'ln') => poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], cls);
  const arc = (cu, cv, r, a0, a1) => { const p = []; for (let i = 0; i <= 48; i++) { const a = a0 + (a1 - a0) * i / 48; p.push([cu + r / 68 * Math.cos(a), cv + r / 105 * Math.sin(a)]); } return line(p); };
  const spot = (u, v) => { const [x, y] = P(u, v); return `<ellipse class="dw" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2" ry="1.4"/>`; };
  // césped con franjas en perspectiva (se extiende más allá de las líneas)
  let g = ''; const v0 = -.07, v1 = 1.06, N = 14;
  for (let i = 0; i < N; i++) { const a = v0 + (v1 - v0) * i / N, b = v0 + (v1 - v0) * (i + 1) / N; g += poly([[-.05, a], [1.05, a], [1.05, b], [-.05, b]], i % 2 ? 'gb' : 'ga'); }
  // canto de tierra bajo el césped (como el borde 3D de Biwenger)
  { const [x0, y0] = P(-.05, v1), [x1] = P(1.05, v1); g += `<path class="soil" d="M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y0.toFixed(1)}L${(x1 - 4).toFixed(1)} ${(y0 + 7).toFixed(1)}L${(x0 + 4).toFixed(1)} ${(y0 + 7).toFixed(1)}Z"/>`; }
  // vallas del fondo con el nombre de la liga
  { const hv = Math.max(11, H * .042), yv = 1, [xa] = P(-.04, v0), [xb] = P(1.04, v0);
    g += `<rect class="valla" x="${xa.toFixed(1)}" y="${yv.toFixed(1)}" width="${(xb - xa).toFixed(1)}" height="${hv.toFixed(1)}" rx="2"/>` +
      `<text class="vtxt" x="${(xa + 8).toFixed(1)}" y="${(yv + hv * .72).toFixed(1)}" font-size="${(hv * .62).toFixed(1)}">MAHTUERSOS <tspan class="vst">★ ★ ★ ★ ★</tspan></text>` +
      `<text class="vtxt" text-anchor="end" x="${(xb - 8).toFixed(1)}" y="${(yv + hv * .72).toFixed(1)}" font-size="${(hv * .62).toFixed(1)}"><tspan class="vst">★ ★ ★ ★ ★</tspan> MAHTUERSOS</text>`; }
  const A = Math.PI, box = 16.5 / 105, six = 5.5 / 105, pen = 11 / 105, d = Math.acos(5.5 / 9.15);
  const bw = [.5 - 20.16 / 68, .5 + 20.16 / 68], sw = [.5 - 9.16 / 68, .5 + 9.16 / 68], gw = [.5 - 3.66 / 68, .5 + 3.66 / 68];
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = g +
    '<defs><linearGradient id="fv-sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".25" stop-color="#000" stop-opacity="0"/></linearGradient></defs>' +
    `<rect class="shade" x="0" y="0" width="${W}" height="${H}"/>` +
    rect(0, 0, 1, 1) + line([[0, .5], [1, .5]]) + arc(.5, .5, 9.15, 0, 2 * A) + spot(.5, .5) +
    rect(bw[0], 0, bw[1], box) + rect(sw[0], 0, sw[1], six) + spot(.5, pen) + arc(.5, pen, 9.15, A / 2 - d, A / 2 + d) + rect(gw[0], -2.2 / 105, gw[1], 0, 'net') +
    rect(bw[0], 1 - box, bw[1], 1) + rect(sw[0], 1 - six, sw[1], 1) + spot(.5, 1 - pen) + arc(.5, 1 - pen, 9.15, -A / 2 - d, -A / 2 + d) + rect(gw[0], 1, gw[1], 1 + 2.2 / 105, 'net') +
    arc(0, 0, 1.5, 0, A / 2) + arc(1, 0, 1.5, A / 2, A) + arc(0, 1, 1.5, -A / 2, 0) + arc(1, 1, 1.5, A, 1.5 * A);
}

export function mountField(host, data, { crestUrl }) {
  const crest = j => `<img class="fv-crest" alt="" src="${j.eq ? esc(crestUrl(j.eq)) : GENERICO}" data-fallback>`;
  const pill = j => {
    if (j.v) return `<span class="fv-pill vacia" title="Posición vacía: resta ${Math.abs(j.p)} puntos"><span class="fv-nm">Vacía</span><span class="fv-pts ${clase(j.p)}">${j.p}</span></span>`;
    const b = (j.c ? 1 : 0) + (j.a ? 1 : 0) + (j.si || j.so ? 1 : 0);
    return `<span class="fv-pill${b ? ' b' + b : ''}" title="${esc(j.n)}">` +
      (j.c ? '<span class="fv-badge" aria-label="Capitán">C</span>' : '') +
      (j.a ? `<span class="fv-badge" aria-label="Ariete">${BOTA}</span>` : '') +
      swap(j) +
      `<span class="fv-nm">${esc(j.n)}</span>${puntos(j)}</span>`;
  };
  const banquillo = (data.banquillo || []).slice(0, 4);
  const hayBanquillo = banquillo.some(Boolean);
  host.classList.add('fv');
  const sum = [...data.PT, ...data.DF, ...data.MC, ...data.DL].reduce((t, j) => t + (j.p ?? 0) + (j.c ? (j.p ?? 0) : 0) + (j.a ? (j.ab ?? 0) : 0), 0);
  // Biwenger aún cuenta otros puntos que la suma de esta alineación (suele ser una jornada con partidos aplazados sin recalcular): se enseñan los dos.
  const nota = data.biwenger != null && data.biwenger !== sum
    ? `<p class="fv-note" role="note">Esta alineación suma <strong>${sum}</strong> puntos, pero en la clasificación general Biwenger cuenta <strong>${data.biwenger}</strong>. ${data.aplazado ? 'Biwenger no cuenta a algunos jugadores de un partido aplazado de esta jornada («No cuenta para los puntos de la alineación»).' : 'Un suplente no sustituye a un titular cuyo partido aún no se ha jugado.'}</p>` : '';
  // Capitán / ariete que no jugó y fue sustituido: se explica con una línea bajo el campo (el suplente que entra no hereda la ventaja).
  const perdidas = (data.perdidas || []).map(p => {
    const txt = `Pierde el ${p.r === 'c' ? 'capitán' : 'ariete'}, ${p.n} no jugó`;
    return `<p class="fv-lostnote" title="${esc(txt)}"><span class="fv-badge lost" aria-hidden="true">${p.r === 'c' ? 'C' : BOTA}</span><span class="fv-lostline">${esc(txt)}</span></p>`;
  }).join('');
  host.innerHTML = `<div class="fv-stage"><svg class="fv-lines" aria-hidden="true"></svg><div class="fv-players"></div><span class="fv-chip"></span></div>${perdidas}${nota}` +
    `<h3 class="bench-title">Suplentes</h3>` +
    (hayBanquillo
      // Suplentes con el mismo diseño que los jugadores del campo (escudo con la posición y píldora con nombre y puntos), en una franja.
      ? `<div class="fv-subs">${['PT', 'DF', 'MC', 'DL'].map((pos, k) => { const s = banquillo[k];
          return s
            ? `<div class="fv-bsub" style="--d:${340 + k * 45}"><span class="fv-cab">${crest(s)}<span class="fv-pos ${pos}" title="${POS[pos]}">${pos}</span></span>${pill(s)}</div>`
            : `<div class="fv-bsub empty" style="--d:${340 + k * 45}"><span class="fv-cab"><img class="fv-crest" alt="" src="${GENERICO}"><span class="fv-pos ${pos}" title="${POS[pos]}">${pos}</span></span><span class="fv-pill vacia sin" title="Sin suplente"><span class="fv-nm">Vacío</span></span></div>`; }).join('')}</div>`
      : '<p class="no-bench">Sin suplentes en esta jornada.</p>');

  const stage = host.querySelector('.fv-stage'), svg = host.querySelector('.fv-lines'), cont = host.querySelector('.fv-players');
  const clave = [data.DF, data.MC, data.DL].map(l => (l || []).length).join('-');
  const plan = BIWENGER[clave];
  host.querySelector('.fv-chip').textContent = clave + (plan ? '' : ' · no es de Biwenger');
  let filas = [];
  LINEAS.forEach(k => {
    const js = data[k] || [], n = js.length;
    const items = js.map((j, i) => {
      const el = document.createElement('div'); el.className = 'fv-pl' + (j.v ? ' vacia' : '');
      el.style.setProperty('--d', { PT: 0, DF: 80, MC: 160, DL: 240 }[k] + i * 30);   // aparecen en cascada desde la portería
      el.innerHTML = `<span class="fv-cab">${crest(j)}<span class="fv-pos ${k}" title="${POS[k]}">${k}</span></span>` + pill(j); cont.appendChild(el);
      const pos = k === 'PT' ? PT_[0] : (plan && plan[k][i]) || [540 + (n === 1 ? 0 : (i / (n - 1) - .5)) * 560, { DL: 900, MC: 1150, DF: 1380 }[k]];
      return { el, ...relativo(pos) };
    });
    // simetría exacta: cada pareja izquierda/derecha queda en espejo (las medidas a mano tienen ±5 px)
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const p = items[i], q = items[n - 1 - i];
      if (Math.abs(p.u) > .01 && Math.abs(q.u) > .01) { const u = (q.u - p.u) / 2, t = (p.t + q.t) / 2; p.u = -u; q.u = u; p.t = q.t = t; p.par = q; q.par = p; }
    }
    if (n) filas.push({ k, items });
  });
  for (const img of host.querySelectorAll('img[data-fallback]')) img.addEventListener('error', () => { img.src = GENERICO; }, { once: true });

  /* Coloca los jugadores: cada línea en su zona del campo, sin solapes y dentro del escenario.
     - En horizontal se reparten según el ancho del campo a esa altura (pueden asomar sobre la banda, como en Biwenger).
     - Los niveles de una línea se separan lo justo: solo mucho si un escudo quedaría sobre otra píldora.
     - Si falta sitio vertical, las líneas se separan solas; un nombre solo se acorta con … en último caso. */
  let intentos = 0;
  function colocar() {
    const W = stage.clientWidth, H = stage.clientHeight, { ancho } = proyeccion(W, H), M = 4;
    const yT = PERSP.arriba * H, yB = PERSP.abajo * H, Yt = t => yT + (yB - yT) * t;
    const todos = filas.flatMap(f => f.items);
    // offsetWidth (y no getBoundingClientRect): no le afecta la escala de la animación de entrada
    const medir = (o, font) => { o.el.style.left = '0px'; o.p.style.width = ''; o.p.style.fontSize = font || '';
      o.pw = o.p.offsetWidth + 1; o.p.style.width = o.pw + 'px'; o.w = o.pw + o.oh + 3; };
    filas.forEach(f => f.items.forEach(o => { o.k = f.k; }));
    todos.forEach(o => { o.p = o.el.querySelector('.fv-pill'); o.oh = o.p.querySelector('.fv-badge') ? 3 : 0; medir(o);
      o.y = Yt(o.t); o.x = W / 2 + o.u * ancho(o.y); });
    // cajas: píldora (con insignia y puntos) y escudo+posición encima
    // el escudo puede quedar hasta 4px por debajo del borde de una píldora (Biwenger también deja la foto asomar bajo las píldoras)
    const cajas = o => [[o.x - o.w / 2, o.y - PILL / 2, o.x + o.w / 2, o.y + PILL / 2], [o.x - 11, o.y - 8 - SEP - ESC, o.x + 14, o.y - 8]];
    const choque = (a, b) => a[0] < b[2] + 1 && b[0] < a[2] + 1 && a[1] < b[3] && b[1] < a[3];
    const tocan = (A, B) => cajas(A).some(a => cajas(B).some(b => choque(a, b)));
    // Las posiciones son las de Biwenger. Solo si dos jugadores se tocan (nombres muy largos o pantalla estrecha):
    // a la misma altura se separan los dos por igual; a distinta altura, baja un poco el de abajo (y los de su altura).
    for (let it = 0; it < 2000; it++) {
      let par = null;
      for (let i = 0; i < todos.length && !par; i++) for (let j = i + 1; j < todos.length && !par; j++) if (tocan(todos[i], todos[j])) par = [todos[i], todos[j]];
      todos.forEach(o => {   // dentro del escenario, moviendo siempre la pareja en espejo
        const lim = q => W / 2 - M - q.w / 2;
        if (o.par) { const s = Math.sign(o.x - W / 2) || 1, off = Math.min(Math.abs(o.x - W / 2), lim(o), lim(o.par)); o.x = W / 2 + s * off; o.par.x = W / 2 - s * off; }
        else if (Math.abs(o.x - W / 2) < 2) o.x = W / 2; else o.x = Math.min(Math.max(o.x, M + o.w / 2), W - M - o.w / 2);
      });
      if (!par) break;
      const [a, b] = par;
      // 1) abrir hacia la banda al que esté más fuera (con su pareja simétrica, para conservar la simetría)
      const cabe = o => o.x - o.w / 2 >= M && o.x + o.w / 2 <= W - M;
      const abre = o => { const d = 2 * Math.sign(o.x - W / 2), q = o.par; o.x += d; if (q) q.x -= d;
        if (cabe(o) && (!q || cabe(q))) return true; o.x -= d; if (q) q.x += d; return false; };
      // solo se abre el que está más hacia fuera (abrir el de dentro lo empujaría contra el de fuera)
      const fuera = [a, b].sort((p, q) => Math.abs(q.x - W / 2) - Math.abs(p.x - W / 2))[0];
      if (Math.abs(fuera.x - W / 2) > 2 && abre(fuera)) continue;
      // 2) sin sitio a los lados: si están a la misma altura, letra un punto menor y, en último caso, acortar con …
      if (Math.abs(a.y - b.y) < 4) { [a, b].forEach(o => { if (o.p.style.fontSize !== '9.5px') medir(o, '9.5px'); else { o.pw = Math.max(36, o.pw * .93); o.p.style.width = o.pw + 'px'; o.w = o.pw + o.oh + 3; } }); continue; }
      // 3) a distinta altura: baja un poco solo el nivel del de abajo (y los que tenga debajo en su línea, para no deshacer el escalonado)
      const baja = a.y > b.y ? a : b, y0 = baja.y; todos.forEach(o => { if (o.k === baja.k && o.y >= y0 - 1) o.y += 2; });
    }
    // si el portero o la defensa se salen por abajo, el campo crece lo justo (pantallas muy estrechas)
    const fondo = Math.max(...todos.map(o => o.y)) + PILL / 2 + 3;
    if (fondo > H + 1 && intentos < 6) { intentos++; stage.style.height = Math.ceil(H + (fondo - H) * 1.15 + 6) + 'px'; campo(stage, svg); colocar(); intentos--; return; }
    todos.forEach(o => { o.el.style.left = (o.x - (o.pw + 3 - o.oh) / 2) + 'px'; o.el.style.top = (o.y - 16 / 2 - SEP - ESC) + 'px';
      o.el.querySelector('.fv-cab').style.transform = `translateX(${(3 - o.oh) / 2 - 4}px)`; });
  }

  // Se redibuja cuando cambia el ancho (también al pasar de oculto a visible en móvil, donde el panel arranca con display:none).
  let anchoPrevio = 0;
  const dibujar = () => {
    const w = stage.clientWidth;
    if (!w) return;
    anchoPrevio = w; stage.style.height = ''; campo(stage, svg); colocar();
  };
  const observer = new ResizeObserver(() => { if (stage.clientWidth !== anchoPrevio) dibujar(); });
  observer.observe(stage);
  dibujar();
  document.fonts?.ready.then(() => { if (host.isConnected) dibujar(); });
  return () => observer.disconnect();
}
