// Almacenamiento local (localStorage). Todo queda en el teléfono.
const KEY = 'gymlog.data.v1';

const empty = () => ({ version: 1, mode: null, sessions: [], draft: null, settings: {} });

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    return { ...empty(), ...data, sessions: Array.isArray(data.sessions) ? data.sessions : [] };
  } catch {
    return empty();
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
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
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.sessions)) throw new Error('Archivo no válido');
  state = { ...empty(), ...data, draft: null };
  save();
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
