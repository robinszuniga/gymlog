// Ejecutar: node tests/store.test.mjs
// Guardado local, migración desde la versión anterior y validación de copias de seguridad.
import assert from 'node:assert/strict';

const KEY = 'gymlog.data.v1';
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
};
globalThis.window = { dispatchEvent() {} };

const { buildPlan } = await import('../js/plan.js');
// Cada import con ?n carga el módulo de nuevo, como si se abriera la app otra vez.
let n = 0;
const open = () => import(`../js/store.js?${++n}`);

const W = (ex, key, kg, reps) => ({ ex, key, kind: 'weight', sets: reps.map((r) => ({ kg, reps: r, done: true })) });

// 1. Instalación nueva: sin modo, sin plan y sin cargas predefinidas
{
  mem.clear();
  const store = await open();
  const st = store.get();
  assert.equal(st.version, 2);
  assert.equal(st.mode, null);
  assert.equal(st.plan, null);
  assert.deepEqual(st.startWeights, {});
}

// 2. Quien ya usaba la rutina clásica de Fuerza conserva sus pesos iniciales y su historial
{
  mem.clear();
  const old = {
    version: 1, mode: 'fuerza', draft: null, settings: { rest_fuerza: 120 },
    sessions: [{ id: 's1', date: '2026-09-20', mode: 'fuerza', dayId: 'F', dayName: 'Sesión de fuerza', createdAt: 5, entries: [W('banca', 'fuerza', 80, [10, 10, 9])] }],
  };
  mem.set(KEY, JSON.stringify(old));
  const store = await open();
  const st = store.get();
  assert.equal(st.version, 2);
  assert.equal(st.mode, 'fuerza');
  assert.equal(st.sessions.length, 1);
  assert.deepEqual(st.startWeights, { 'prensa|fuerza': 137, 'banca|fuerza': 79, 'jalon|fuerza': 89, 'hombro|fuerza': 52 });
  assert.equal(st.settings.rest_fuerza, 120);
  // En modo Definición no se asigna nada
  mem.set(KEY, JSON.stringify({ ...old, mode: 'definicion' }));
  assert.deepEqual((await open()).get().startWeights, {});
}

// 3. Exportar e importar un estado nuevo (plan + pesos + sesiones) lo deja igual
{
  mem.clear();
  const store = await open();
  const plan = buildPlan({ goal: 'musculo', days: 4, level: 'intermedio', equipment: ['maquina', 'polea', 'barra', 'mancuernas'], cardio: 'bici', avoid: ['hang'] });
  store.setPlan(plan);
  store.setStartWeight(store.startId('banca', 'r8-12'), 60);
  store.setStartWeight(store.startId('prensa', 'r8-12'), 0); // 0 o vacío no se guarda
  store.setSetting('rest_plan', 90);
  store.addSession({
    id: 'p1', date: '2026-10-01', mode: 'plan', dayId: 'P1', dayName: plan.days[0].name, createdAt: 10,
    entries: [
      { ...W('banca', 'r8-12', 60, [12, 11, 10]), planSets: 4, repMin: 8, repMax: 12 },
      { ex: 'plancha', key: 'r30-60', kind: 'time', sets: [{ kg: 0, reps: 40, done: true }] },
      { ex: 'bici', key: 'cardio', kind: 'cardio', minutes: 12 },
    ],
  });
  const before = JSON.parse(JSON.stringify(store.get()));
  assert.equal(before.mode, 'plan');
  assert.deepEqual(before.startWeights, { 'banca|r8-12': 60 });

  const text = store.exportJSON();
  store.validateImportJSON(text);
  mem.clear();
  const fresh = await open();
  fresh.importJSON(text);
  const after = fresh.get();
  assert.deepEqual(after.plan, before.plan, 'el plan vuelve igual');
  assert.deepEqual(after.sessions, before.sessions, 'las sesiones vuelven iguales');
  assert.deepEqual(after.startWeights, before.startWeights);
  assert.equal(after.settings.rest_plan, 90);
  assert.equal(after.mode, 'plan');
  // Y queda guardado en el dispositivo
  assert.deepEqual(JSON.parse(mem.get(KEY)).plan, before.plan);
}

// 4. Copias de la versión anterior siguen entrando (incluida la clave "core" de Definición)
{
  mem.clear();
  const store = await open();
  const v1 = {
    version: 1, mode: 'definicion', settings: { rest_definicion: 45 },
    sessions: [{
      id: 'a', date: '2026-09-10', mode: 'definicion', dayId: 'D2', dayName: 'Día 2 · Push', createdAt: 1,
      entries: [W('banca', 'def', 40, [15, 14, 13]), { ex: 'plancha', key: 'core', kind: 'time', sets: [{ reps: 30, done: true }] }],
    }],
  };
  store.importJSON(JSON.stringify(v1));
  assert.equal(store.get().sessions[0].entries[1].key, 'core');
  assert.equal(store.get().version, 2);
  assert.equal(store.get().plan, null);
}

// 5. Copias dañadas se rechazan antes de tocar los datos actuales
{
  mem.clear();
  const store = await open();
  store.setMode('fuerza');
  const good = JSON.parse(store.exportJSON());
  const plan = buildPlan({ goal: 'fuerza', days: 3, level: 'principiante', equipment: ['barra'] });
  const sess = (entries) => [{ id: 'x', date: '2026-10-01', mode: 'plan', dayId: 'P1', dayName: 'Día 1', createdAt: 1, entries }];
  const cases = {
    'modo plan sin plan': { ...good, mode: 'plan', plan: null },
    'objetivo desconocido': { ...good, plan: { ...plan, goal: 'volar' } },
    'ejercicio inexistente en el plan': { ...good, plan: { ...plan, days: [{ ...plan.days[0], items: [{ ...plan.days[0].items[0], ex: 'constructor' }] }] } },
    'series absurdas': { ...good, plan: { ...plan, days: [{ ...plan.days[0], items: [{ ...plan.days[0].items[0], sets: 500 }] }] } },
    'equipo desconocido': { ...good, plan: { ...plan, equipment: ['jetpack'] } },
    'clave de progresión inválida': { ...good, sessions: sess([W('banca', 'x<script>', 50, [10])]) },
    'ejercicio heredado del prototipo': { ...good, sessions: sess([{ ex: 'constructor', key: 'r8-12', sets: [{ kg: 1, reps: 1, done: true }] }]) },
    'cardio con clave de fuerza': { ...good, sessions: sess([{ ex: 'bici', key: 'r8-12', kind: 'cardio', minutes: 10 }]) },
    'peso inicial negativo': { ...good, startWeights: { 'banca|r8-12': -5 } },
    'peso inicial de ejercicio inexistente': { ...good, startWeights: { 'nada|r8-12': 50 } },
    'peso inicial sin rango': { ...good, startWeights: { banca: 50 } },
    'peso inicial con rango inválido': { ...good, startWeights: { 'banca|loquesea': 50 } },
    'versión futura': { ...good, version: 3 },
  };
  for (const [name, data] of Object.entries(cases)) {
    assert.throws(() => store.validateImportJSON(JSON.stringify(data)), Error, name);
    assert.throws(() => store.importJSON(JSON.stringify(data)), Error, name);
  }
  assert.equal(store.get().mode, 'fuerza', 'los datos actuales no cambian tras un intento fallido');
}

// 6. Editar una sesión terminada la reemplaza sin duplicarla y mantiene el orden por fecha
{
  mem.clear();
  const store = await open();
  store.setMode('fuerza');
  const mk = (id, date, kg, createdAt) => ({ id, date, mode: 'fuerza', dayId: 'F', dayName: 'Sesión de fuerza', createdAt, entries: [W('banca', 'fuerza', kg, [10, 10, 10])] });
  store.addSession(mk('a', '2026-09-01', 50, 1));
  store.addSession(mk('b', '2026-09-03', 50, 2));
  store.setDraft({ id: 'a', editing: true });
  assert.equal(store.updateSession({ ...mk('a', '2026-09-05', 55, 1) }), true);
  const st = store.get();
  assert.equal(st.sessions.length, 2);
  assert.deepEqual(st.sessions.map((s) => s.id), ['b', 'a']);
  assert.equal(st.sessions[1].entries[0].sets[0].kg, 55);
  assert.equal(st.draft, null);
  assert.equal(store.updateSession(mk('zzz', '2026-09-05', 1, 9)), false);
  // La copia exportada de la sesión editada sigue siendo válida
  store.validateImportJSON(store.exportJSON());
}

console.log('OK: almacenamiento');
