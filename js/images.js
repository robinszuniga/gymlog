// Imágenes de ejercicios desde la API pública de ExerciseDB.
// La URL encontrada se guarda en el teléfono y el service worker guarda la imagen para usarla sin internet.
import { EXERCISES } from './data.js';

const API = 'https://oss.exercisedb.dev/api/v1/exercises';
const CACHE_KEY = 'gymlog.img.v1';
const pending = {};

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeCache(map) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch { /* sin espacio: se vuelve a pedir la próxima vez */ }
}

export function cachedUrl(exKey) {
  return readCache()[exKey] || null;
}

async function fetchJSON(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// Busca por id conocido; si falla, busca por nombre y toma la coincidencia exacta (o la primera).
async function resolve(exKey) {
  const ex = EXERCISES[exKey];
  if (!ex) return null;
  try {
    const byId = await fetchJSON(`${API}/${ex.apiId}`);
    if (byId?.data?.gifUrl) return byId.data.gifUrl;
  } catch { /* probar por nombre */ }
  const res = await fetchJSON(`${API}/search?search=${encodeURIComponent(ex.apiName)}&limit=10`);
  const list = res?.data || [];
  const hit = list.find((x) => x.name?.toLowerCase() === ex.apiName.toLowerCase()) || list[0];
  return hit?.gifUrl || null;
}

export function getImageUrl(exKey) {
  const hit = cachedUrl(exKey);
  if (hit) return Promise.resolve(hit);
  if (!pending[exKey]) {
    pending[exKey] = resolve(exKey)
      .then((url) => {
        if (url) {
          const map = readCache();
          map[exKey] = url;
          writeCache(map);
        }
        return url;
      })
      .catch(() => null)
      .finally(() => { delete pending[exKey]; });
  }
  return pending[exKey];
}

// Descarga todas las imágenes para que queden guardadas (uso sin internet en el gym).
export async function prefetchAll(onProgress) {
  const keys = Object.keys(EXERCISES);
  let ok = 0;
  for (const [i, k] of keys.entries()) {
    const url = await getImageUrl(k);
    if (url) {
      try {
        await fetch(url, { mode: 'no-cors' });
        ok++;
      } catch { /* sin conexión */ }
    }
    onProgress?.(i + 1, keys.length);
  }
  return { ok, total: keys.length };
}
