export const IDS = ['mahtuliga', 'mahtwoliga', 'mahtuchampions'];
export const META = {
  mahtuliga: { name: 'MAHTULIGA', short: 'ML', color: '#ed4b3f', label: 'La liga original', capacity: 10 },
  mahtwoliga: { name: 'MAHTWOLIGA', short: 'MW', color: '#078782', label: 'La otra mitad de la rivalidad', capacity: 10 },
  mahtuchampions: { name: 'MahtuChampions', short: 'MC', color: '#8b6dff', label: 'Dos ligas. Una copa.', capacity: 8 },
};
export function initialState() {
  return { version: 1, revision: 0, season: '2026/27', updatedAt: null, competitions: Object.fromEntries(IDS.map(id => [id, { players: [], rounds: [], honours: [], customRules: '', baseline: null }])) };
}
// Identidad de una jornada: número y, si es una jornada aplazada, su ordinal (1.ª, 2.ª aplazada de ese número).
export const roundKey = r => `${r.number}${r.postponed ? (r.postponed === 1 ? 'a' : 'a' + r.postponed) : ''}`;
export const roundOrder = r => r.number * 10 + (r.postponed || 0);
// Orden cronológico de las jornadas: el normal (jornada y parte), salvo que una parte aplazada que se juega después de empezar jornadas posteriores
// (p. ej. la «Jornada 6 aplazada 2», con partidos tras la J9) se coloca tras la última de ellas que ya había empezado. Usa la fecha propia de la parte.
export function chronological(rounds) {
  const asc = [...rounds].sort((a, b) => roundOrder(a) - roundOrder(b));
  const base = p => asc.find(r => !r.postponed && r.number === p.number);
  // Solo cuentan jornadas posteriores con fechas coherentes (las de las jornadas antiguas importadas no siempre lo son).
  const anchor = p => p.postponed && p.date ? asc.filter(r => !r.postponed && r.number > p.number && r.date && r.date <= p.date && base(p)?.date && r.date >= base(p).date).at(-1) : undefined;
  const moved = asc.filter(r => anchor(r));
  const out = asc.filter(r => !moved.includes(r));
  for (const p of moved) {
    let i = out.indexOf(anchor(p)) + 1;
    while (i < out.length && moved.includes(out[i]) && anchor(out[i]) === anchor(p)) i++;
    out.splice(i, 0, p);
  }
  return out;
}
export const roundLabel = r => `Jornada ${r.number}${r.postponed ? ` · aplazada${r.postponed > 1 ? ' ' + r.postponed : ''}` : ''}`;
export function parseRoundKey(key) {
  const m = /^(\d{1,2})(?:a(\d?))?$/.exec(String(key));
  return m ? { number: Number(m[1]), postponed: m[2] === undefined ? 0 : m[2] === '' ? 1 : Number(m[2]) } : null;
}
// Las jornadas aplazadas se muestran con los puntos de Biwenger, pero solo suman al total lo que añaden de verdad (`counted`).
// Una jornada normal también puede traer `counted`: lo que Biwenger cuenta en la clasificación general cuando difiere de lo que enseña su tabla
// (la suma de las alineaciones, mientras Biwenger no ha recalculado una jornada con partidos aplazados).
const countedScores = r => r.postponed ? (r.counted || []) : (r.counted || r.scores);
export function standings(comp, rounds = comp.rounds) {
  const aggregate = rounds === comp.rounds;
  const base = aggregate ? comp.baseline : null;
  // Una jornada con partidos pendientes (aplazados) suma sus puntos, pero no decide último puesto, récords ni desempates hasta que termina.
  const real = aggregate ? rounds.filter(r => !r.postponed && !r.incomplete) : rounds;
  const counted = aggregate ? rounds.filter(r => !r.postponed) : rounds;
  // Desempate: gana quien hizo más puntos en la última jornada jugada (completa).
  const tieRound = aggregate ? [...real].sort((a, b) => roundOrder(a) - roundOrder(b)).at(-1) : null;
  const rows = comp.players.map(player => {
    // Con clasificación inicial se suman solo las jornadas posteriores a su corte; las aplazadas se consideran ya incluidas en ella.
    const included = base ? counted.filter(r => base.throughRound !== null && r.number > base.throughRound) : rounds;
    const total = included.flatMap(r => (aggregate ? countedScores(r) : r.scores).filter(s => s.playerId === player.id).map(s => s.points));
    const own = real.flatMap(r => r.scores.filter(s => s.playerId === player.id).map(s => s.points));
    return { ...player, points: Math.round((total.reduce((a, b) => a + b, 0) + (base?.scores.find(s => s.playerId === player.id)?.points || 0)) * 100) / 100, tie: tieRound?.scores.find(s => s.playerId === player.id)?.points ?? 0, played: real.filter(r => r.scores.some(s => s.playerId === player.id)).length, best: own.length ? Math.max(...own) : null, last: real.filter(r => r.lastPlayerId === player.id).length };
  }).sort((a, b) => b.points - a.points || b.tie - a.tie || a.name.localeCompare(b.name, 'es'));
  rows.forEach((row, i) => { row.rank = i && rows[i-1].points === row.points && rows[i-1].tie === row.tie ? rows[i-1].rank : i+1; });
  return rows;
}
// Clasificación con el movimiento respecto a la jornada anterior (puestos subidos o bajados) y la diferencia de puntos
// con el puesto de arriba, como la tabla general de Biwenger.
export function standingsWithMovement(comp) {
  const rows = standings(comp);
  const ordered = [...comp.rounds].sort((a, b) => roundOrder(a) - roundOrder(b));
  const hasPrevious = ordered.length >= 2 || (ordered.length === 1 && !!comp.baseline);
  const previous = hasPrevious ? Object.fromEntries(standings({ ...comp, rounds: ordered.slice(0, -1) }).map(r => [r.id, r.rank])) : null;
  return {
    last: ordered.at(-1) ?? null,
    hasPrevious,
    rows: rows.map((r, i) => ({
      ...r,
      change: previous ? previous[r.id] - r.rank : null, // positivo = ha subido puestos
      gap: i ? Math.round((rows[i - 1].points - r.points) * 100) / 100 : null, // puntos hasta el puesto de arriba
    })),
  };
}
export function records(comp, maxRank = 3, ascending = false) {
  const all = comp.rounds.filter(r => !r.postponed && !r.incomplete).flatMap(r => r.scores.map(s => ({ ...s, number: r.number, name: comp.players.find(p => p.id === s.playerId)?.name || 'Participante' }))).sort((a,b) => (ascending ? a.points-b.points : b.points-a.points) || a.number-b.number || a.name.localeCompare(b.name, 'es'));
  all.forEach((r,i) => { r.rank = i && all[i-1].points === r.points ? all[i-1].rank : i+1; });
  return all.filter(r => r.rank <= maxRank);
}
// ---- Estadísticas de récords (solo jornadas terminadas: sin aplazadas ni abiertas) ------------------
const finishedRounds = comp => comp.rounds.filter(r => !r.postponed && !r.incomplete).sort((a, b) => roundOrder(a) - roundOrder(b));
const nameOf = (comp, id) => comp.players.find(p => p.id === id)?.name || 'Participante';
const ranked = (rows, key = 'points') => { rows.forEach((row, i) => { row.rank = i && rows[i - 1][key] === row[key] ? rows[i - 1].rank : i + 1; }); return rows; };
const byPointsThenName = (a, b) => b.points - a.points || a.name.localeCompare(b.name, 'es');
// Posición de cada participante en una jornada (1 = mejor; los empates comparten puesto).
const roundPlaces = round => {
  const sorted = [...round.scores].sort((a, b) => b.points - a.points);
  return sorted.map((s, i) => ({ playerId: s.playerId, place: 1 + sorted.filter(o => o.points > s.points).length, points: s.points, i }));
};
// Quién ha ganado más jornadas (con empate en lo más alto, ganan todos los empatados).
export function roundWins(comp) {
  const wins = new Map();
  for (const r of finishedRounds(comp)) for (const x of roundPlaces(r).filter(p => p.place === 1)) wins.set(x.playerId, [...(wins.get(x.playerId) || []), r.number]);
  return ranked([...wins].map(([id, rounds]) => ({ id, name: nameOf(comp, id), points: rounds.length, rounds })).sort(byPointsThenName));
}
// Veces que cada participante ha quedado entre los tres primeros de una jornada.
export function podiums(comp) {
  const rounds = new Map();
  for (const r of finishedRounds(comp)) for (const x of roundPlaces(r).filter(p => p.place <= 3)) rounds.set(x.playerId, [...(rounds.get(x.playerId) || []), { number: r.number, place: x.place, won: x.place === 1 }]);
  return ranked([...rounds].map(([id, list]) => ({ id, name: nameOf(comp, id), points: list.length, rounds: list })).sort(byPointsThenName));
}
// Estado de forma: puntos en las últimas `size` jornadas (las abiertas por partidos pendientes cuentan, marcadas como provisionales).
export function form(comp, size = 3) {
  const recent = comp.rounds.filter(r => !r.postponed).sort((a, b) => roundOrder(a) - roundOrder(b)).slice(-size);
  const rows = comp.players.map(p => {
    const rounds = recent.flatMap(r => r.scores.filter(s => s.playerId === p.id).map(s => ({ number: r.number, points: s.points })));
    return { id: p.id, name: p.name, rounds, points: Math.round(rounds.reduce((t, x) => t + x.points, 0) * 100) / 100 };
  }).filter(r => r.rounds.length).sort((a, b) => b.points - a.points || (b.rounds.at(-1)?.points ?? 0) - (a.rounds.at(-1)?.points ?? 0) || a.name.localeCompare(b.name, 'es'));
  return { numbers: recent.map(r => r.number), provisional: recent.filter(r => r.incomplete).map(r => r.number), rows: ranked(rows) };
}
// Mejor racha: más puntos en `size` jornadas terminadas y consecutivas (una por participante).
export function bestStreaks(comp, size = 3, maxRank = 3) {
  const rounds = finishedRounds(comp), out = [];
  for (const p of comp.players) for (let i = 0; i + size <= rounds.length; i++) {
    const win = rounds.slice(i, i + size), scores = win.map(r => r.scores.find(s => s.playerId === p.id)?.points);
    if (scores.some(x => x === undefined) || win.some((r, k) => r.number !== win[0].number + k)) continue;
    const entry = { id: p.id, name: p.name, points: Math.round(scores.reduce((a, b) => a + b, 0) * 100) / 100, from: win[0].number, to: win.at(-1).number };
    const own = out.find(o => o.id === p.id);
    if (!own) out.push(entry); else if (entry.points > own.points) Object.assign(own, entry);
  }
  return ranked(out.sort((a, b) => b.points - a.points || a.from - b.from || a.name.localeCompare(b.name, 'es'))).filter(r => r.rank <= maxRank);
}
// Victorias más holgadas: diferencia entre el primero y el segundo de una jornada (sin empate arriba).
export function biggestMargins(comp, maxRank = 3) {
  const out = [];
  for (const r of finishedRounds(comp)) {
    const sorted = [...r.scores].sort((a, b) => b.points - a.points);
    if (sorted.length < 2 || sorted[0].points === sorted[1].points) continue;
    out.push({ id: sorted[0].playerId, name: nameOf(comp, sorted[0].playerId), number: r.number, points: Math.round((sorted[0].points - sorted[1].points) * 100) / 100, top: sorted[0].points });
  }
  return ranked(out.sort((a, b) => b.points - a.points || a.number - b.number)).filter(r => r.rank <= maxRank);
}
export function hallOfFame(comp) {
  const wins = new Map();
  for (const h of comp.honours) {
    const key = normalize(h.name);
    const row = wins.get(key) || { name: h.name, seasons: [], count: 0 };
    row.count++; row.seasons.push(h.season); wins.set(key, row);
  }
  return [...wins.values()].sort((a,b) => b.count-a.count || a.name.localeCompare(b.name, 'es'));
}
export function normalize(s) { return s.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
export function validatePlayers(players, comp, capacity) {
  if (!Array.isArray(players) || players.length > capacity) throw Error(`Máximo ${capacity} participantes.`);
  const names = new Set(), ids = new Set();
  for (const p of players) {
    if (!p || typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,60}$/.test(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 40) throw Error('Revisa los nombres de los participantes (máximo 40 caracteres).');
    if (ids.has(p.id) || names.has(normalize(p.name))) throw Error('Hay participantes repetidos.');
    ids.add(p.id); names.add(normalize(p.name));
  }
  for (const r of [...comp.rounds, ...(comp.baseline ? [comp.baseline] : [])]) for (const s of r.scores) if (!ids.has(s.playerId)) throw Error('No puedes quitar a alguien que tiene resultados. Puedes corregir su nombre.');
  return players.map(p => ({ id: p.id, name: p.name.trim() }));
}
export function validateRound(value, comp, id) {
  const max = id === 'mahtuchampions' ? 50 : 38;
  if (!Number.isInteger(value.number) || value.number < 1 || value.number > max) throw Error(`La jornada debe estar entre 1 y ${max}.`);
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || new Date(value.date+'T12:00:00Z').toISOString().slice(0,10) !== value.date) throw Error('Fecha no válida.');
  if (comp.players.length < 2) throw Error('Añade al menos dos participantes.');
  const phase = value.phase ?? null;
  if (phase !== null) {
    if (id !== 'mahtuchampions') throw Error('Solo MahtuChampions tiene fases.');
    if (!Number.isInteger(phase) || phase < 1 || phase > CHAMPIONS_PHASES.length) throw Error('La fase de la copa debe estar entre 1 y 4.');
    // En cada fase juegan solo los participantes que siguen vivos.
    if (!Array.isArray(value.scores) || value.scores.length !== CHAMPIONS_PHASES[phase - 1].from) throw Error(`La fase ${phase} tiene ${CHAMPIONS_PHASES[phase - 1].from} participantes.`);
  } else if (!Array.isArray(value.scores) || value.scores.length !== comp.players.length) throw Error('Introduce los puntos de todos los participantes.');
  const postponed = value.postponed === undefined ? 0 : value.postponed;
  if (!Number.isInteger(postponed) || postponed < 0 || postponed > 9) throw Error('Jornada aplazada no válida.');
  const seen = new Set();
  for (const score of value.scores) {
    if (!score || !comp.players.some(p => p.id === score.playerId) || seen.has(score.playerId)) throw Error('Participante desconocido o repetido.');
    if (typeof score.points !== 'number' || !Number.isFinite(score.points) || Math.abs(score.points) > 1000 || Math.abs(Math.round(score.points*100)-score.points*100) > 0.00001) throw Error('Los puntos deben ser números entre −1000 y 1000, con hasta dos decimales.');
    seen.add(score.playerId);
  }
  const min = Math.min(...value.scores.map(s => s.points));
  const last = value.scores.filter(s => s.points === min);
  const lastPlayerId = last.length === 1 ? last[0].playerId : value.lastPlayerId;
  if (!last.some(s => s.playerId === lastPlayerId)) throw Error('Hay empate en el último puesto. Selecciona el último según Biwenger.');
  const out = { number: value.number, ...(phase ? { phase } : {}), date: value.date, scores: value.scores.map(s => ({ playerId: s.playerId, points: s.points })), lastPlayerId };
  if (postponed) out.postponed = postponed;
  if (postponed || value.counted) {
    const counted = value.counted ?? [];
    for (const c of counted) if (!comp.players.some(p => p.id === c.playerId) || typeof c.points !== 'number' || !Number.isFinite(c.points) || Math.abs(c.points) > 1000) throw Error('Puntos que suman de la jornada no válidos.');
    out.counted = counted.map(c => ({ playerId: c.playerId, points: c.points }));
  }
  if (value.incomplete) out.incomplete = true;
  if (value.pending !== undefined) {   // partidos que faltan por jugar (los pinta la web junto a «Partidos pendientes»)
    const side = t => t && typeof t === 'object' && typeof t.eq === 'string' && /^[a-z0-9-]{0,40}$/.test(t.eq) && typeof t.n === 'string' && t.n.length <= 40 ? { eq: t.eq, n: t.n } : null;
    if (!Array.isArray(value.pending) || value.pending.length > 20) throw Error('Partidos pendientes no válidos.');
    out.pending = value.pending.map(g => {
      const local = side(g?.local), visitante = side(g?.visitante);
      if (!local || !visitante || !['pendiente', 'aplazado'].includes(g.estado) || (g.fecha !== undefined && !Number.isInteger(g.fecha))) throw Error('Partido pendiente no válido.');
      return { local, visitante, estado: g.estado, ...(g.fecha !== undefined ? { fecha: g.fecha } : {}) };
    });
  }
  if (value.biwengerId !== undefined) { if (!Number.isInteger(value.biwengerId) || value.biwengerId < 1) throw Error('Identificador de Biwenger no válido.'); out.biwengerId = value.biwengerId; }
  return out;
}
export function validateHonours(honours) {
  if (!Array.isArray(honours) || honours.length > 200) throw Error('Palmarés no válido.');
  const seasons = new Set();
  return honours.map(h => {
    if (typeof h.name !== 'string' || !h.name.trim() || h.name.length > 40 || typeof h.season !== 'string' || !/^\d{4}\/\d{2}$/.test(h.season)) throw Error('Indica el campeón y la temporada con formato 2026/27.');
    if (Number(h.season.slice(5)) !== (Number(h.season.slice(0,4))+1)%100) throw Error('La temporada debe abarcar dos años consecutivos.');
    if (seasons.has(h.season)) throw Error('Solo puede haber un campeón por temporada.');
    seasons.add(h.season);
    return { name: h.name.trim(), season: h.season };
  });
}

// Cuadro de eliminatorias de MahtuChampions (semifinales, final y ganador). Todo opcional: se rellena según avanza la copa.
export function validateBracket(b) {
  if (b === null || b === undefined) return null;
  const team = t => {
    if (t === null || t === undefined) return null;
    if (typeof t.nombre !== 'string' || !t.nombre.trim() || t.nombre.length > 40) throw Error('Cuadro: nombre de equipo no válido (máximo 40 caracteres).');
    if (t.puntos !== null && t.puntos !== undefined && (typeof t.puntos !== 'number' || !Number.isFinite(t.puntos) || Math.abs(t.puntos) > 10000)) throw Error('Cuadro: puntos no válidos.');
    return { name: t.nombre.trim(), points: t.puntos ?? null };
  };
  const match = m => ({ a: team(m?.a), b: team(m?.b) });
  const semis = b.semifinales ?? [];
  if (!Array.isArray(semis) || semis.length > 2) throw Error('Cuadro: como máximo dos semifinales.');
  if (b.ganador != null && (typeof b.ganador !== 'string' || b.ganador.length > 40)) throw Error('Cuadro: ganador no válido.');
  return { semifinals: [match(semis[0]), match(semis[1])], final: match(b.final), winner: b.ganador?.trim() || null };
}

// ---- MahtuChampions: fases (8 → 6 → 4 → 2 → campeón) --------------------------------------------
export const CHAMPIONS_PHASES = [
  { n: 1, name: 'Dieciseisavos y octavos', kind: 'liga', from: 8, to: 6, out: 2, desc: 'Formato liga entre los 8 clasificados. Avanzan del 1.º al 6.º; el 7.º y el 8.º quedan eliminados.' },
  { n: 2, name: 'Cuartos de final', kind: 'liga', from: 6, to: 4, out: 2, desc: 'Se mantiene el formato liga entre los 6 clasificados. Avanzan del 1.º al 4.º; el 5.º y el 6.º quedan eliminados.' },
  { n: 3, name: 'Semifinales', kind: 'directo', from: 4, to: 2, note: 'Enfrentamiento directo (sorteo)', desc: 'Los 4 clasificados se enfrentan en eliminatoria directa. Los cruces se deciden por sorteo.' },
  { n: 4, name: 'Final Champions', kind: 'directo', from: 2, to: 1, note: 'Partido único', desc: 'Partido único entre los ganadores de las semifinales para decidir al campeón.' },
];
// Fase actual: la indicada en los ajustes (`currentPhase`) o, si no, la más avanzada con jornadas publicadas.
// current: 0 = sin empezar, 1–4 = fase en curso, 5 = copa terminada (hay campeón).
export function championsProgress(comp) {
  const played = comp.rounds.map(r => r.phase).filter(Boolean);
  const finished = !!comp.bracket?.winner;
  const explicit = Number.isInteger(comp.currentPhase) ? comp.currentPhase : null;
  const current = finished ? 5 : explicit ?? (played.length ? Math.max(...played) : 0);
  return {
    current, finished,
    phases: CHAMPIONS_PHASES.map(p => ({ ...p, start: comp.phaseDates?.[p.n] ?? null, state: current === 0 ? 'pending' : p.n < current ? 'done' : p.n === current ? 'active' : 'pending' })),
  };
}
const phaseRows = (comp, players, n) => standings({ ...comp, players, baseline: null, rounds: comp.rounds.filter(r => r.phase === n) });
// Clasificación de una fase de liga. En las fases posteriores solo cuentan quienes no han sido eliminados antes.
export function phaseStandings(comp, n) {
  let players = comp.players;
  for (let k = 1; k < n; k++) {
    const phase = CHAMPIONS_PHASES[k - 1];
    if (phase.kind !== 'liga' || !comp.rounds.some(r => r.phase === k)) break;
    const keep = new Set(phaseRows(comp, players, k).slice(0, phase.from - phase.out).map(r => r.id));
    players = players.filter(p => keep.has(p.id));
  }
  return { rows: phaseRows(comp, players, n), players };
}

// Fecha de inicio de cada fase (empieza con su ronda de la Champions League). Opcional: { "1": "2027-02-17", … }
export function validatePhaseDates(dates) {
  if (dates === null || dates === undefined) return {};
  if (typeof dates !== 'object' || Array.isArray(dates)) throw Error('"inicioFases" debe ser un objeto fase → fecha (AAAA-MM-DD).');
  const out = {};
  for (const [phase, date] of Object.entries(dates)) {
    if (!CHAMPIONS_PHASES.some(p => String(p.n) === phase)) throw Error(`La fase ${phase} no existe (1 a ${CHAMPIONS_PHASES.length}).`);
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date) throw Error(`Fecha no válida para la fase ${phase}: usa AAAA-MM-DD.`);
    out[phase] = date;
  }
  return out;
}

// ---- Premios de cada liga según el número de participantes ---------------------------------------
// El bote sale solo de la inscripción (30 € por persona) menos el Premium; la fianza (10 €) va aparte y no cuenta.
// Con 10 participantes: 120 / 60 / 30 € y 40 € de aporte a la copa (250 €).
// Con 9 (situación actual) se pierden 30 €: premios de liga 110 / 60 / 30 € y 20 € de aporte a la copa (220 €).
// Con otro número, todos los premios se reducen en la misma proporción y se redondean a múltiplos de 5 €.
export const ENTRY_FEE = 30, PREMIUM_COST = 50, FULL_LEAGUE = 10, BASE_PRIZES = { first: 120, second: 60, third: 30, champions: 40 };
const PRIZES_BY_SIZE = { 10: [120, 60, 30, 40], 9: [110, 60, 30, 20] };
export function prizeTable(n) {
  const collected = n * ENTRY_FEE, pot = collected - PREMIUM_COST, base = Object.values(BASE_PRIZES), expected = base.reduce((a, b) => a + b, 0);
  let amounts = PRIZES_BY_SIZE[n];
  if (!amounts) {
    amounts = base.map(v => Math.round(v * pot / expected / 5) * 5);
    amounts[0] += pot - amounts.reduce((a, b) => a + b, 0);   // el resto del redondeo se lo lleva el 1.º
  }
  const [first, second, third, champions] = amounts;
  return { n, collected, premium: PREMIUM_COST, pot, expected, shortfall: pot - expected, first, second, third, champions };
}
// Premio de MahtuChampions: lo que aporta cada liga.
export const championsPrize = state => IDS.slice(0, 2).reduce((sum, id) => sum + prizeTable(state.competitions[id].players.length).champions, 0);
