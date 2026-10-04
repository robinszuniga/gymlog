// Resumen semanal a partir de los registros (funciones puras, sin DOM).
// Solo describe lo que está anotado; no saca conclusiones médicas.
import { EXERCISES } from './data.js';
import { MUSCLES, AREAS, areaOf, muscleShares } from './plan.js';
import { entriesFor, workingKg, fmt } from './progression.js';

// Guías generales para adultos sanos (OMS): 150–300 min/semana de actividad aeróbica moderada
// y fortalecimiento muscular 2 o más días. Referencia orientativa de series por grupo: ~10.
export const GUIDE = { cardioMin: 150, cardioMax: 300, strengthDays: 2, setsRef: 10 };

const iso = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Lunes y domingo de la semana que contiene la fecha (AAAA-MM-DD).
export function weekRange(dateISO) {
  const d = new Date(dateISO + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return { start: iso(d), end: iso(end) };
}

const doneSets = (e) => (e.sets || []).filter((s) => s.done);
const totalReps = (e) => doneSets(e).reduce((n, s) => n + (Number(s.reps) || 0), 0);

/**
 * Devuelve lo registrado en la semana:
 * { start, end, sessions, days, strengthDays, setsByMuscle, areas, cardioMin, changes }
 * changes: por ejercicio, comparación con la sesión anterior del mismo ejercicio y rango.
 */
export function weekSummary(sessions, dateISO) {
  const { start, end } = weekRange(dateISO);
  const week = sessions.filter((s) => s.date >= start && s.date <= end);
  const setsByMuscle = Object.fromEntries(Object.keys(MUSCLES).map((m) => [m, 0]));
  const areas = Object.fromEntries(Object.keys(AREAS).map((a) => [a, 0]));
  const strengthDates = new Set();
  let cardioMin = 0;

  for (const s of week) {
    for (const e of s.entries) {
      if (e.kind === 'cardio') { cardioMin += Number(e.minutes) || 0; continue; }
      const n = doneSets(e).length;
      if (!n) continue;
      for (const [m, w] of muscleShares(e.ex)) if (m in setsByMuscle) setsByMuscle[m] += n * w;
      const area = areaOf(e.ex);
      if (area) areas[area] += n;
      if (area && area !== 'core') strengthDates.add(s.date);
    }
  }

  // Cambios: último registro de la semana de cada ejercicio frente al anterior (de cualquier fecha).
  const changes = [];
  const seen = new Set();
  for (const s of [...week].reverse()) {
    for (const e of s.entries) {
      const id = `${e.ex}|${e.key}`;
      if (seen.has(id) || !EXERCISES[e.ex]) continue;
      seen.add(id);
      const hist = entriesFor(sessions, e.ex, e.key);
      const idx = hist.findIndex((h) => h.date === s.date && h.createdAt === s.createdAt);
      const cur = hist[idx];
      const prev = hist[idx + 1];
      if (!cur || !prev) continue;
      changes.push(compare(cur, prev));
    }
  }
  changes.sort((a, b) => rank(a.dir) - rank(b.dir));

  return {
    start, end,
    sessions: week.length,
    days: new Set(week.map((s) => s.date)).size,
    strengthDays: strengthDates.size,
    setsByMuscle, areas, cardioMin, changes,
  };
}

const rank = (dir) => ({ up: 0, down: 1, same: 2 }[dir]);

function compare(cur, prev) {
  const name = EXERCISES[cur.ex].name;
  const base = { ex: cur.ex, key: cur.key, name };
  if (cur.kind === 'cardio') {
    const a = Number(prev.minutes) || 0;
    const b = Number(cur.minutes) || 0;
    return { ...base, unit: 'min', from: a, to: b, dir: dirOf(b - a), text: `${fmt(a)} → ${fmt(b)} min` };
  }
  if (cur.kind === 'time') {
    const best = (e) => Math.max(0, ...doneSets(e).map((s) => Number(s.reps) || 0));
    const a = best(prev);
    const b = best(cur);
    return { ...base, unit: 's', from: a, to: b, dir: dirOf(b - a), text: `${fmt(a)} → ${fmt(b)} s` };
  }
  const ka = workingKg(prev);
  const kb = workingKg(cur);
  if (ka !== kb) {
    return { ...base, unit: 'kg', from: ka, to: kb, dir: dirOf(kb - ka), text: `${fmt(ka)} → ${fmt(kb)} kg` };
  }
  const ra = totalReps(prev);
  const rb = totalReps(cur);
  const kgTxt = kb ? `${fmt(kb)} kg · ` : '';
  return { ...base, unit: 'reps', from: ra, to: rb, dir: dirOf(rb - ra), text: `${kgTxt}${ra} → ${rb} reps en total` };
}

const dirOf = (diff) => (diff > 0 ? 'up' : diff < 0 ? 'down' : 'same');

/**
 * Pocas recomendaciones (máximo 3), cada una apoyada en un dato del resumen.
 * ctx: { goal, perWeek, hasCardio, weekOver } — weekOver indica si la semana ya terminó.
 */
export function recommendations(sum, ctx = {}) {
  const out = [];
  const { goal, perWeek, hasCardio, weekOver } = ctx;
  if (!sum.sessions) {
    return [weekOver ? 'No hay sesiones registradas en esta semana.' : 'Aún no registras sesiones esta semana.'];
  }

  if (weekOver && perWeek && sum.days < perWeek) {
    out.push(`Registraste ${sum.days} de ${perWeek} días planeados. Si esto se repite, un plan con menos días puede ser más fácil de sostener.`);
  }

  const missing = Object.keys(AREAS).filter((a) => a !== 'core' && sum.areas[a] === 0);
  if (missing.length && (weekOver || sum.days >= 2)) {
    out.push(`Esta semana no hay series registradas de: ${missing.map((a) => AREAS[a].label.toLowerCase()).join(', ')}.`);
  }

  if (goal === 'musculo') {
    const low = ['cuadriceps', 'isquios', 'pecho', 'espalda']
      .filter((m) => sum.setsByMuscle[m] > 0 && sum.setsByMuscle[m] < GUIDE.setsRef)
      .sort((a, b) => sum.setsByMuscle[a] - sum.setsByMuscle[b]);
    if (low.length && weekOver) {
      const m = low[0];
      out.push(`${MUSCLES[m]}: ${fmt(Math.round(sum.setsByMuscle[m]))} series esta semana. Como referencia orientativa se usan unas ${GUIDE.setsRef}; puedes agregar una serie si te recuperas bien.`);
    }
  }

  if (hasCardio && weekOver && sum.cardioMin < GUIDE.cardioMin) {
    out.push(`Registraste ${fmt(sum.cardioMin)} min de cardio. La guía general de la OMS para adultos es de ${GUIDE.cardioMin}–${GUIDE.cardioMax} min semanales de actividad moderada, contando también lo que hagas fuera de la app.`);
  }

  const ups = sum.changes.filter((c) => c.dir === 'up');
  const downs = sum.changes.filter((c) => c.dir === 'down' && c.unit !== 'min');
  if (ups.length) {
    out.push(`Subiste en ${ups.length === 1 ? ups[0].name : `${ups.length} ejercicios`} frente a la sesión anterior.`);
  } else if (downs.length >= 2) {
    out.push(`Bajaste carga o repeticiones en ${downs.length} ejercicios. Puede ser una semana pesada: mantener los pesos unos días también es avanzar.`);
  }

  return out.slice(0, 3);
}
