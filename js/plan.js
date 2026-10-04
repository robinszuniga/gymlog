// Generador de planes según objetivo, días, experiencia y equipo (funciones puras, sin DOM).
// Las cifras son guías generales para adultos sanos, no una prescripción médica.
import { EXERCISES } from './data.js';

export const GOALS = {
  fuerza: {
    label: 'Fuerza',
    desc: 'Levantar más peso en los movimientos principales, subiendo la carga poco a poco.',
    cardio: 'opcional',
  },
  musculo: {
    label: 'Ganar músculo',
    desc: 'Suficientes series por semana para cada grupo muscular, con repeticiones medias.',
    cardio: 'opcional',
  },
  grasa: {
    label: 'Perder grasa',
    desc: 'Mantener el trabajo de fuerza y sumar una actividad cardiovascular que puedas sostener. La pérdida de grasa depende sobre todo de la alimentación y no se puede dirigir a una zona del cuerpo.',
    cardio: 'recomendado',
  },
  general: {
    label: 'Condición física general',
    desc: 'Combinar fuerza para todo el cuerpo con cardio que va subiendo de a poco.',
    cardio: 'incluido',
  },
};

export const LEVELS = {
  principiante: { label: 'Principiante', desc: 'Menos de 6 meses entrenando', n: 1 },
  intermedio: { label: 'Intermedio', desc: 'Entre 6 meses y 2 años', n: 2 },
  avanzado: { label: 'Avanzado', desc: 'Más de 2 años constantes', n: 3 },
};

// Equipo que la persona puede marcar. 'corporal' (sin equipo) siempre está disponible.
export const EQUIPMENT = {
  maquina: 'Máquinas',
  polea: 'Poleas',
  barra: 'Barra y discos',
  mancuernas: 'Mancuernas',
  banda: 'Bandas elásticas',
  barra_fija: 'Barra de dominadas',
};

export const EQUIP_LABEL = { ...EQUIPMENT, corporal: 'Sin equipo' };

export const EQUIP_PRESETS = {
  gimnasio: { label: 'Gimnasio completo', equip: ['maquina', 'polea', 'barra', 'mancuernas', 'barra_fija'] },
  casa: { label: 'Casa con mancuernas', equip: ['mancuernas'] },
  nada: { label: 'Sin equipo', equip: [] },
};

// Movimientos que la persona puede preferir evitar (sin preguntar el motivo).
export const AVOID = {
  overhead: 'Empujar por encima de la cabeza',
  axial: 'Barra pesada sobre la espalda o desde el piso',
  impact: 'Saltos e impacto',
  hang: 'Colgarse de una barra',
  floor: 'Ejercicios acostado en el piso',
};

export const CARDIO_OPTIONS = ['caminar', 'bici', 'eliptica', 'correr', 'cardioLibre', 'hiit'];

export const MUSCLES = {
  cuadriceps: 'Cuádriceps',
  isquios: 'Isquiotibiales',
  gluteos: 'Glúteos',
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombros: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  core: 'Core',
};

// Zonas que todo plan debe cubrir.
export const AREAS = {
  piernas: { label: 'Piernas', patterns: ['sentadilla', 'unilateral'] },
  posterior: { label: 'Cadera e isquiotibiales', patterns: ['bisagra', 'curl_femoral'] },
  empuje: { label: 'Empuje', patterns: ['empuje_h', 'empuje_v'] },
  traccion: { label: 'Tracción', patterns: ['traccion_h', 'traccion_v'] },
  core: { label: 'Core', patterns: ['core'] },
};

export function areaOf(exKey) {
  const p = EXERCISES[exKey]?.pattern;
  return Object.keys(AREAS).find((a) => AREAS[a].patterns.includes(p)) || null;
}

// Cada espacio del día: patrones aceptados en orden de preferencia; role decide series y repeticiones.
const SLOTS = {
  SQ: { patterns: ['sentadilla', 'unilateral'], role: 'main' },
  HI: { patterns: ['bisagra', 'curl_femoral'], role: 'main' },
  PH: { patterns: ['empuje_h', 'empuje_v'], role: 'main' },
  PV: { patterns: ['empuje_v', 'empuje_h'], role: 'main' },
  LV: { patterns: ['traccion_v', 'traccion_h'], role: 'main' },
  LH: { patterns: ['traccion_h', 'traccion_v'], role: 'main' },
  UL: { patterns: ['unilateral', 'sentadilla'], role: 'acc' },
  HC: { patterns: ['curl_femoral', 'bisagra'], role: 'acc' },
  QX: { patterns: ['aislado'], muscle: 'cuadriceps', role: 'iso', optional: true },
  DL: { patterns: ['aislado'], muscle: 'hombros', role: 'iso', optional: true },
  RD: { patterns: ['aislado'], muscle: 'espalda', role: 'iso', optional: true },
  BI: { patterns: ['aislado'], muscle: 'biceps', role: 'iso', optional: true },
  TR: { patterns: ['aislado'], muscle: 'triceps', role: 'iso', optional: true },
  CO: { patterns: ['core'], role: 'core' },
};

const DAYS = {
  fullA: { name: 'Cuerpo completo A', short: 'Completo A', slots: ['SQ', 'PH', 'LH', 'HC', 'CO'] },
  fullB: { name: 'Cuerpo completo B', short: 'Completo B', slots: ['HI', 'PV', 'LV', 'UL', 'CO'] },
  fullC: { name: 'Cuerpo completo C', short: 'Completo C', slots: ['SQ', 'HI', 'PH', 'LV', 'CO'] },
  upperA: { name: 'Torso A', short: 'Torso A', slots: ['PH', 'LH', 'PV', 'LV', 'TR', 'CO'] },
  upperB: { name: 'Torso B', short: 'Torso B', slots: ['PV', 'LV', 'PH', 'LH', 'BI', 'CO'] },
  lowerA: { name: 'Pierna A', short: 'Pierna A', slots: ['SQ', 'HI', 'UL', 'HC', 'CO'] },
  lowerB: { name: 'Pierna B', short: 'Pierna B', slots: ['HI', 'SQ', 'HC', 'QX', 'CO'] },
  push: { name: 'Empuje', short: 'Empuje', slots: ['PH', 'PV', 'DL', 'TR', 'CO'] },
  pull: { name: 'Tracción', short: 'Tracción', slots: ['LV', 'LH', 'RD', 'BI', 'CO'] },
  legs: { name: 'Pierna', short: 'Pierna', slots: ['SQ', 'HI', 'UL', 'HC', 'CO'] },
  cardio: { name: 'Cardio y core', short: 'Cardio', slots: ['CARDIO', 'CO'] },
};

const STRENGTH_SPLITS = {
  2: ['fullA', 'fullB'],
  3: ['fullA', 'fullB', 'fullC'],
  4: ['upperA', 'lowerA', 'upperB', 'lowerB'],
  5: ['upperA', 'lowerA', 'push', 'pull', 'legs'],
  6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
};

// Reparto de la semana. 'cardio' es un día solo de cardio; '+c' agrega cardio corto al final.
function split(goal, days) {
  const n = Math.max(2, Math.min(6, days));
  if (goal === 'fuerza') {
    // Con 5 días se repite torso/pierna para trabajar cada grupo principal dos veces.
    if (n === 5) return ['upperA', 'lowerA', 'upperB', 'lowerB', 'fullC'];
    return STRENGTH_SPLITS[n];
  }
  if (goal === 'musculo') return STRENGTH_SPLITS[n];
  if (goal === 'grasa') {
    // La fuerza se conserva; el cardio se suma sin reemplazarla.
    return {
      2: ['fullA+c', 'fullB+c'],
      3: ['fullA+c', 'fullB+c', 'fullC+c'],
      4: ['fullA', 'cardio', 'fullB', 'fullC'],
      5: ['fullA', 'cardio', 'fullB', 'cardio', 'fullC'],
      6: ['upperA', 'lowerA', 'cardio', 'upperB', 'lowerB', 'cardio'],
    }[n];
  }
  return {
    2: ['fullA+c', 'fullB+c'],
    3: ['fullA', 'cardio', 'fullB'],
    4: ['fullA', 'cardio', 'fullB', 'cardio'],
    5: ['fullA', 'cardio', 'fullB', 'cardio', 'fullC'],
    6: ['fullA', 'cardio', 'fullB', 'cardio', 'fullC', 'cardio'],
  }[n];
}

// Series, repeticiones y descanso según objetivo, experiencia y tipo de ejercicio.
// Los rangos dejan margen: no hace falta llegar al fallo para progresar.
export function prescribe(goal, level, exKey, role) {
  const ex = EXERCISES[exKey];
  const lv = LEVELS[level]?.n || 1;
  if (ex.kind === 'cardio') return null;
  let sets = lv === 1 ? 2 : 3;
  let reps = [8, 12];
  let rest = 75;

  if (ex.kind === 'time') {
    sets = lv === 1 ? 2 : 3;
    reps = lv === 1 ? [20, 40] : [30, 60];
    rest = 45;
  } else if (role === 'core') {
    reps = [10, 15];
    rest = 45;
  } else if (role === 'iso') {
    sets = lv === 1 ? 2 : 3;
    reps = [10, 15];
    rest = 60;
  } else if (ex.kind === 'reps') {
    // Sin carga externa: se progresa con repeticiones.
    sets = 3;
    reps = [8, 15];
    rest = 75;
  } else if (goal === 'fuerza' && role === 'main' && ex.main) {
    sets = lv === 1 ? 3 : 4;
    reps = lv === 1 ? [5, 8] : [4, 6];
    rest = 150;
  } else if (goal === 'fuerza') {
    sets = 3;
    reps = [6, 10];
    rest = 120;
  } else if (goal === 'musculo') {
    sets = role === 'main' && lv > 1 ? 4 : 3;
    reps = [8, 12];
    rest = 90;
  } else {
    // 'grasa' y 'general': mismo trabajo de fuerza moderado; no se suben repeticiones "para quemar".
    sets = lv === 1 ? 2 : 3;
    reps = [8, 12];
    rest = 75;
  }

  const item = {
    ex: exKey, sets, setsMax: sets + 1, repMin: reps[0], repMax: reps[1],
    key: `r${reps[0]}-${reps[1]}`, rest, role, adaptive: true,
  };
  // En fuerza los aumentos son más pequeños para poder sostenerlos.
  if (goal === 'fuerza' && role === 'main') { item.incMin = 2.5; item.incMax = 5; }
  return item;
}

export function cardioItem(exKey, level, short = false) {
  const lv = LEVELS[level]?.n || 1;
  const range = short ? [10, 20] : [[15, 30], [20, 40], [25, 45]][lv - 1];
  return { ex: exKey, min: range[0], max: range[1], key: 'cardio', role: 'cardio', progressive: true };
}

function has(profile, exKey) {
  const ex = EXERCISES[exKey];
  return ex.equip === 'corporal' || (profile.equipment || []).includes(ex.equip);
}

function avoided(profile, exKey) {
  const ex = EXERCISES[exKey];
  if ((profile.exclude || []).includes(exKey)) return true;
  return (ex.flags || []).some((f) => (profile.avoid || []).includes(f));
}

function matches(ex, slot, pattern) {
  if (ex.pattern !== pattern) return false;
  return !slot.muscle || ex.muscles[0] === slot.muscle;
}

function score(exKey, profile, used, goal) {
  const ex = EXERCISES[exKey];
  let s = 0;
  const free = ex.equip === 'barra' || ex.equip === 'mancuernas';
  const guided = ex.equip === 'maquina' || ex.equip === 'polea';
  if (profile.prefer === 'libre' && free) s += 2;
  if (profile.prefer === 'maquinas' && guided) s += 2;
  if (profile.level === 'principiante' && guided) s += 1;
  if (ex.kind === 'weight') s += 1.5; // con carga externa es más fácil medir el progreso
  if (goal === 'fuerza' && ex.main) s += 2;
  s -= (used[exKey] || 0) * 1.25; // variar entre días
  return s;
}

// Elige el mejor ejercicio disponible para un espacio. Devuelve null si no hay ninguno.
function pick(slot, profile, used, dayKeys, goal) {
  const lv = LEVELS[profile.level]?.n || 1;
  const keys = Object.keys(EXERCISES);
  for (const strictLevel of [true, false]) {
    for (const pattern of slot.patterns) {
      const cands = keys.filter((k) => {
        const ex = EXERCISES[k];
        if (!matches(ex, slot, pattern) || dayKeys.includes(k)) return false;
        if (!has(profile, k) || avoided(profile, k)) return false;
        return !strictLevel || ex.lvl <= Math.max(1, Math.min(2, lv));
      });
      if (cands.length) {
        return cands
          .map((k, i) => ({ k, s: score(k, profile, used, goal) - i * 0.001 }))
          .sort((a, b) => b.s - a.s)[0].k;
      }
    }
  }
  return null;
}

/**
 * profile: { goal, days, level, equipment: [], prefer: 'libre' | 'maquinas' | 'igual',
 *            avoid: [flags], exclude: [exKeys], cardio: exKey | null }
 */
export function buildPlan(profile) {
  const goal = GOALS[profile.goal] ? profile.goal : 'general';
  const level = LEVELS[profile.level] ? profile.level : 'principiante';
  const daysPerWeek = Math.max(2, Math.min(6, Number(profile.days) || 3));
  const p = { ...profile, goal, level, equipment: profile.equipment || [], avoid: profile.avoid || [], exclude: profile.exclude || [] };
  const wantsCardio = p.cardio && EXERCISES[p.cardio]?.kind === 'cardio';
  const cardioKey = wantsCardio ? p.cardio : (goal === 'general' ? 'caminar' : null);
  const used = {};
  const notes = [];
  // Sin cardio elegido no tiene sentido un día "solo cardio": se usa el reparto de fuerza.
  const codes = goal === 'grasa' && !cardioKey ? STRENGTH_SPLITS[daysPerWeek] : split(goal, daysPerWeek);
  // En fuerza y músculo el cardio es opcional: si se eligió, va corto al final de días alternos.
  const extraCardio = cardioKey && (goal === 'fuerza' || goal === 'musculo');

  const days = codes.map((code, i) => {
    const withCardio = code.endsWith('+c');
    const tpl = DAYS[withCardio ? code.slice(0, -2) : code];
    const items = [];
    for (const code2 of tpl.slots) {
      if (code2 === 'CARDIO') {
        if (cardioKey) items.push(cardioItem(cardioKey, level));
        continue;
      }
      const slot = SLOTS[code2];
      const exKey = pick(slot, p, used, items.map((it) => it.ex), goal);
      if (!exKey) continue;
      used[exKey] = (used[exKey] || 0) + 1;
      // Si el espacio era principal pero solo hubo una alternativa de otro tipo, se trata como accesorio.
      const role = slot.role === 'main' && !EXERCISES[exKey].main ? 'acc' : slot.role;
      items.push(prescribe(goal, level, exKey, role));
    }
    if (cardioKey && (withCardio || (extraCardio && i % 2 === 0))) items.push(cardioItem(cardioKey, level, true));
    return { id: `P${i + 1}`, name: `Día ${i + 1} · ${tpl.name}`, short: tpl.short, items };
  }).filter((d) => d.items.length);

  const plan = {
    goal, level, daysPerWeek, equipment: p.equipment, prefer: p.prefer || 'igual',
    avoid: p.avoid, exclude: p.exclude, cardio: cardioKey, days, notes,
  };

  const cov = coverage(plan);
  for (const [area, n] of Object.entries(cov)) {
    if (!n) notes.push(`Con tu equipo y preferencias no hay ejercicio de ${AREAS[area].label.toLowerCase()}. Puedes agregar equipo o cambiar lo que evitas.`);
  }
  if (goal === 'grasa' && !cardioKey) {
    notes.push('No elegiste cardio. El plan conserva la fuerza; puedes sumar una actividad cuando quieras.');
  }
  return plan;
}

// Cuántos días de la semana trabaja cada zona.
export function coverage(plan) {
  const out = Object.fromEntries(Object.keys(AREAS).map((a) => [a, 0]));
  for (const d of plan.days) {
    const seen = new Set(d.items.map((it) => areaOf(it.ex)).filter(Boolean));
    seen.forEach((a) => { out[a] += 1; });
  }
  return out;
}

// Cuánto cuenta una serie para cada músculo del ejercicio: el primero de la lista es el
// principal (1 serie); los demás trabajan de forma indirecta (media serie).
export function muscleShares(exKey) {
  return (EXERCISES[exKey]?.muscles || []).map((m, i) => [m, i === 0 ? 1 : 0.5]);
}

// Series planeadas por semana para cada músculo.
export function plannedSets(plan) {
  const out = Object.fromEntries(Object.keys(MUSCLES).map((m) => [m, 0]));
  for (const d of plan.days) {
    for (const it of d.items) {
      for (const [m, w] of muscleShares(it.ex)) out[m] += (it.sets || 0) * w;
    }
  }
  return out;
}

export function plannedCardio(plan) {
  let min = 0;
  for (const d of plan.days) for (const it of d.items) if (it.key === 'cardio') min += it.min || 0;
  return min;
}

// Alternativas para sustituir un ejercicio: mismo patrón (o mismo músculo principal).
// Devuelve [{ ex, available }] con las que el equipo permite primero.
export function alternativesFor(exKey, profile = {}) {
  const cur = EXERCISES[exKey];
  if (!cur) return [];
  const area = areaOf(exKey);
  const out = Object.keys(EXERCISES).filter((k) => {
    if (k === exKey) return false;
    const ex = EXERCISES[k];
    if (cur.kind === 'cardio') return ex.kind === 'cardio';
    if (ex.kind === 'cardio') return false;
    if (cur.pattern === 'aislado') return ex.pattern === 'aislado' && ex.muscles[0] === cur.muscles[0];
    return area ? areaOf(k) === area : ex.pattern === cur.pattern;
  });
  return out
    .map((k) => ({
      ex: k,
      available: has(profile, k) && !(EXERCISES[k].flags || []).some((f) => (profile.avoid || []).includes(f)),
      same: EXERCISES[k].pattern === cur.pattern,
    }))
    .sort((a, b) => (b.available - a.available) || (b.same - a.same));
}

// Sustituye un ejercicio del plan conservando el tipo de trabajo. Devuelve un plan nuevo.
export function swapExercise(plan, dayIndex, itemIndex, newKey) {
  const days = plan.days.map((d, di) => {
    if (di !== dayIndex) return d;
    const items = d.items.map((it, ii) => {
      if (ii !== itemIndex) return it;
      if (EXERCISES[newKey].kind === 'cardio') return { ...it, ex: newKey };
      const role = it.role === 'main' && !EXERCISES[newKey].main ? 'acc' : (it.role || 'acc');
      return prescribe(plan.goal, plan.level, newKey, role);
    });
    return { ...d, items };
  });
  return { ...plan, days };
}

// Ejercicios con carga de una rutina (uno por ejercicio y rango de repeticiones), para preguntar
// el peso inicial. Devuelve [{ ex, key, repMin, repMax }].
export function weightedExercises(plan) {
  const seen = new Map();
  for (const d of plan.days) for (const it of d.items) {
    const id = `${it.ex}|${it.key}`;
    if (EXERCISES[it.ex]?.kind === 'weight' && !seen.has(id)) {
      seen.set(id, { ex: it.ex, key: it.key, repMin: it.repMin, repMax: it.repMax });
    }
  }
  return [...seen.values()];
}
