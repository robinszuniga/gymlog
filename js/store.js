// Almacenamiento local (localStorage). Todo queda en el teléfono.
import { EXERCISES } from './data.js';
import { GOALS, LEVELS, EQUIPMENT, AVOID } from './plan.js';
const KEY = 'gymlog.data.v1';
const MODES_OK = ['fuerza', 'definicion', 'plan'];
// Claves de progresión: las de las rutinas clásicas y las de planes por objetivo (rango de reps).
const KEY_OK = (k) => ['fuerza', 'def', 'circuito', 'core', 'cardio'].includes(k) || /^r\d{1,3}-\d{1,3}$/.test(k);

// version 2 agrega: plan (rutina según objetivo) y startWeights (pesos iniciales elegidos por la persona).
// startWeights se guarda por ejercicio y rango de repeticiones ("banca|r8-12"): el peso con el que se
// empieza a 5 repeticiones no sirve para 15.
const empty = () => ({ version: 2, mode: null, plan: null, startWeights: {}, sessions: [], draft: null, settings: {} });

// Antes de la versión 2 la rutina clásica de Fuerza traía pesos iniciales escritos en el catálogo.
// Para no cambiarle nada a quien ya la usaba, esos valores pasan a ser sus pesos iniciales (editables).
// Las instalaciones nuevas no reciben ninguna carga predefinida.
const LEGACY_START = { 'prensa|fuerza': 137, 'banca|fuerza': 79, 'jalon|fuerza': 89, 'hombro|fuerza': 52 };

export const startId = (ex, key) => `${ex}|${key}`;

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    const next = { ...empty(), ...data, sessions: Array.isArray(data.sessions) ? data.sessions : [] };
    if (!next.startWeights || typeof next.startWeights !== 'object') next.startWeights = {};
    if (data.version !== 2) {
      if (data.mode === 'fuerza' && !data.startWeights) next.startWeights = { ...LEGACY_START };
      next.version = 2;
    }
    if (next.mode === 'plan' && !next.plan) next.mode = null;
    return next;
  } catch {
    return empty();
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    window.dispatchEvent(new CustomEvent('gymlog:storage-error'));
    return false;
  }
}

export function get() {
  return state;
}

export function setMode(mode) {
  state.mode = mode;
  save();
}

export function setDraft(draft) {
  state.draft = draft;
  save();
}

export function addSession(session) {
  state.sessions.push(session);
  state.sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
  state.draft = null;
  save();
}

// Reemplaza una sesión ya guardada (para corregir errores) y cierra la edición.
export function updateSession(session) {
  const i = state.sessions.findIndex((s) => s.id === session.id);
  if (i < 0) return false;
  state.sessions[i] = session;
  state.sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
  state.draft = null;
  return save();
}

// Guarda el plan por objetivo y lo deja como rutina activa.
export function setPlan(plan) {
  state.plan = plan;
  state.mode = 'plan';
  save();
}

// Peso inicial elegido por la persona para un ejercicio y rango (id = startId(ex, key); null lo borra).
export function setStartWeight(id, kg) {
  if (kg == null || !(kg > 0)) delete state.startWeights[id];
  else state.startWeights[id] = kg;
  save();
}

export function deleteSession(id) {
  state.sessions = state.sessions.filter((s) => s.id !== id);
  save();
}

export function setSetting(k, v) {
  state.settings[k] = v;
  save();
}

export function exportJSON() {
  return JSON.stringify({ ...state, draft: null, exportedAt: new Date().toISOString() }, null, 2);
}

export function importJSON(text) {
  const next = validateImport(text);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    throw new Error('No hay espacio disponible para guardar la copia. Libera espacio e inténtalo de nuevo.');
  }
  state = next;
}

export function validateImportJSON(text) {
  validateImport(text);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validateImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no contiene JSON válido.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.sessions)) {
    throw new Error('La copia no tiene el formato de GymLog.');
  }
  if (data.version != null && ![1, 2].includes(data.version)) {
    throw new Error('Esta versión de GymLog no puede importar esa copia.');
  }
  if (data.mode != null && !MODES_OK.includes(data.mode)) {
    throw new Error('La copia contiene un modo de entrenamiento desconocido.');
  }
  const plan = data.plan == null ? null : validatePlan(data.plan);
  if (data.mode === 'plan' && !plan) {
    throw new Error('La copia indica un plan por objetivo pero no lo incluye.');
  }

  const ids = new Set();
  const sessions = data.sessions.map((session, index) => {
    if (!session || typeof session !== 'object' || Array.isArray(session) ||
        typeof session.id !== 'string' || !session.id || ids.has(session.id) ||
        !validDate(session.date) || !MODES_OK.includes(session.mode) ||
        typeof session.dayId !== 'string' || typeof session.dayName !== 'string' ||
        !Array.isArray(session.entries) || session.entries.length === 0) {
      throw new Error(`La sesión ${index + 1} está incompleta o tiene datos inválidos.`);
    }
    ids.add(session.id);
    const createdAt = session.createdAt == null ? Date.parse(`${session.date}T00:00:00Z`) + index : Number(session.createdAt);
    if (!Number.isFinite(createdAt) || createdAt < 0) {
      throw new Error(`La fecha de creación de la sesión ${index + 1} no es válida.`);
    }

    const entries = session.entries.map((entry, entryIndex) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
          typeof entry.ex !== 'string' || !Object.hasOwn(EXERCISES, entry.ex) ||
          entry.kind !== EXERCISES[entry.ex].kind ||
          typeof entry.key !== 'string' || !KEY_OK(entry.key) ||
          (entry.kind === 'cardio') !== (entry.key === 'cardio')) {
        throw new Error(`Un ejercicio de la sesión ${index + 1} tiene datos inválidos.`);
      }
      // Objetivo con el que se hizo el ejercicio (opcional; permite editar la sesión después).
      const target = {};
      for (const f of ['planSets', 'repMin', 'repMax']) {
        if (entry[f] != null) {
          if (!finiteNonNegative(Number(entry[f]))) throw new Error(`Un ejercicio de la sesión ${index + 1} tiene datos inválidos.`);
          target[f] = Number(entry[f]);
        }
      }
      if (entry.kind === 'cardio') {
        if (!finiteNonNegative(entry.minutes)) {
          throw new Error(`Los minutos de cardio de la sesión ${index + 1} no son válidos.`);
        }
        return { ex: entry.ex, key: entry.key, kind: entry.kind, minutes: entry.minutes };
      }
      if (!Array.isArray(entry.sets) || entry.sets.length === 0) {
        throw new Error(`Las series del ejercicio ${entryIndex + 1} en la sesión ${index + 1} no son válidas.`);
      }
      const sets = entry.sets.map((set) => {
        const kg = set && set.kg == null ? 0 : Number(set?.kg);
        const reps = Number(set?.reps);
        if (!set || typeof set !== 'object' || set.done !== true ||
            !finiteNonNegative(kg) || !finiteNonNegative(reps)) {
          throw new Error(`Una serie del ejercicio ${entryIndex + 1} en la sesión ${index + 1} tiene valores inválidos.`);
        }
        return { kg, reps, done: true };
      });
      return { ex: entry.ex, key: entry.key, kind: entry.kind, sets, ...target };
    });
    return {
      id: session.id,
      date: session.date,
      mode: session.mode,
      dayId: session.dayId,
      dayName: session.dayName,
      createdAt,
      entries,
    };
  });

  const settings = {};
  if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) {
    if ([60, 90, 120, 180].includes(Number(data.settings.rest_fuerza))) settings.rest_fuerza = Number(data.settings.rest_fuerza);
    if ([45, 60, 75].includes(Number(data.settings.rest_definicion))) settings.rest_definicion = Number(data.settings.rest_definicion);
    if ([60, 90, 120, 180].includes(Number(data.settings.rest_plan))) settings.rest_plan = Number(data.settings.rest_plan);
    if (validDate(data.settings.lastExport)) settings.lastExport = data.settings.lastExport;
  }

  const startWeights = {};
  if (data.startWeights != null) {
    if (typeof data.startWeights !== 'object' || Array.isArray(data.startWeights)) {
      throw new Error('Los pesos iniciales de la copia no son válidos.');
    }
    for (const [id, kg] of Object.entries(data.startWeights)) {
      const [ex, key, extra] = id.split('|');
      if (extra != null || !Object.hasOwn(EXERCISES, ex) || !KEY_OK(key ?? '') || key === 'cardio' ||
          !finiteNonNegative(kg) || kg > 2000) throw new Error('Los pesos iniciales de la copia no son válidos.');
      if (kg > 0) startWeights[id] = kg;
    }
  }
  return { version: 2, mode: data.mode ?? null, plan, startWeights, sessions, draft: null, settings };
}

const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const listOf = (v, allowed) => Array.isArray(v) && v.every((x) => typeof x === 'string' && allowed(x));

// Revisa el plan por objetivo y devuelve una copia solo con los campos conocidos.
function validatePlan(plan) {
  const bad = () => new Error('El plan de entrenamiento de la copia no es válido.');
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw bad();
  if (!Object.hasOwn(GOALS, plan.goal) || !Object.hasOwn(LEVELS, plan.level) || !intIn(plan.daysPerWeek, 1, 7)) throw bad();
  if (!Array.isArray(plan.days) || plan.days.length < 1 || plan.days.length > 7) throw bad();
  if (!listOf(plan.equipment ?? [], (x) => Object.hasOwn(EQUIPMENT, x))) throw bad();
  if (!listOf(plan.avoid ?? [], (x) => Object.hasOwn(AVOID, x))) throw bad();
  if (!listOf(plan.exclude ?? [], (x) => Object.hasOwn(EXERCISES, x))) throw bad();
  if (plan.cardio != null && (!Object.hasOwn(EXERCISES, plan.cardio) || EXERCISES[plan.cardio].kind !== 'cardio')) throw bad();
  if (!['libre', 'maquinas', 'igual'].includes(plan.prefer ?? 'igual')) throw bad();

  const ids = new Set();
  const days = plan.days.map((d) => {
    if (!d || typeof d.id !== 'string' || !d.id || ids.has(d.id) || typeof d.name !== 'string' ||
        typeof d.short !== 'string' || !Array.isArray(d.items) || d.items.length < 1 || d.items.length > 20) throw bad();
    ids.add(d.id);
    const items = d.items.map((it) => {
      if (!it || typeof it.ex !== 'string' || !Object.hasOwn(EXERCISES, it.ex)) throw bad();
      const ex = EXERCISES[it.ex];
      if (ex.kind === 'cardio') {
        if (!intIn(it.min, 1, 600) || !intIn(it.max, it.min, 600)) throw bad();
        return { ex: it.ex, min: it.min, max: it.max, key: 'cardio', role: 'cardio', progressive: it.progressive === true };
      }
      if (!intIn(it.sets, 1, 10) || !intIn(it.setsMax, it.sets, 12) || !intIn(it.repMin, 1, 600) ||
          !intIn(it.repMax, it.repMin, 600) || typeof it.key !== 'string' || !KEY_OK(it.key) || it.key === 'cardio') throw bad();
      const out = {
        ex: it.ex, sets: it.sets, setsMax: it.setsMax, repMin: it.repMin, repMax: it.repMax, key: it.key,
        rest: intIn(it.rest, 15, 600) ? it.rest : 75,
        role: ['main', 'acc', 'iso', 'core'].includes(it.role) ? it.role : 'acc',
        adaptive: it.adaptive !== false,
      };
      for (const f of ['incMin', 'incMax']) {
        if (it[f] != null) {
          if (typeof it[f] !== 'number' || !(it[f] > 0 && it[f] <= 20)) throw bad();
          out[f] = it[f];
        }
      }
      return out;
    });
    return { id: d.id, name: d.name.slice(0, 80), short: d.short.slice(0, 30), items };
  });

  return {
    goal: plan.goal, level: plan.level, daysPerWeek: plan.daysPerWeek,
    equipment: [...(plan.equipment ?? [])], prefer: plan.prefer ?? 'igual',
    avoid: [...(plan.avoid ?? [])], exclude: [...(plan.exclude ?? [])],
    cardio: plan.cardio ?? null, days,
    notes: Array.isArray(plan.notes) ? plan.notes.filter((n) => typeof n === 'string').map((n) => n.slice(0, 300)).slice(0, 10) : [],
  };
}

export function resetAll() {
  state = empty();
  save();
}

// Fecha local en formato AAAA-MM-DD (sin problemas de zona horaria).
export function today() {
  return toISO(new Date());
}

export function toISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
