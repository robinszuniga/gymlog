// Ejecutar: node tests/progression.test.mjs
import assert from 'node:assert/strict';
import { suggest } from '../js/progression.js';

const item = { ex: 'banca', sets: 3, setsMax: 3, repMin: 8, repMax: 10, key: 'fuerza' };
const S = (date, kg, reps, key = 'fuerza') => ({
  date, mode: 'fuerza',
  entries: [{ ex: 'banca', key, kind: 'weight', sets: reps.map((r) => ({ kg, reps: r, done: true })) }],
});

// Sin historial
assert.equal(suggest([], item, 'weight').type, 'new');

// Dos sesiones 3×10 con 50 kg → subir 5–10 %
let r = suggest([S('2026-09-01', 50, [10, 10, 10]), S('2026-09-03', 50, [10, 10, 10])], item, 'weight');
assert.equal(r.type, 'up');
assert.equal(r.kg, 52.5);
assert.equal(r.kgMax, 55);

// Solo una sesión completa → mantener (1 de 2)
r = suggest([S('2026-09-01', 50, [10, 10, 9]), S('2026-09-03', 50, [10, 10, 10])], item, 'weight');
assert.equal(r.type, 'keep');
assert.equal(r.streak, 1);
assert.equal(r.kg, 50);

// Falló la última → mantener
r = suggest([S('2026-09-01', 50, [10, 10, 10]), S('2026-09-03', 50, [10, 9, 8])], item, 'weight');
assert.equal(r.type, 'keep');
assert.equal(r.streak, 0);

// Subió de peso en la última y la completó → todavía no vuelve a subir
r = suggest([S('2026-09-01', 50, [10, 10, 10]), S('2026-09-03', 52.5, [10, 10, 10])], item, 'weight');
assert.equal(r.type, 'keep');
assert.equal(r.kg, 52.5);

// Solo 2 series hechas → no cuenta como completa
r = suggest([S('2026-09-01', 50, [10, 10, 10]), S('2026-09-03', 50, [10, 10])], item, 'weight');
assert.equal(r.type, 'keep');

// Pesos livianos: paso de 1 kg
r = suggest([S('2026-09-01', 8, [10, 10, 10]), S('2026-09-03', 8, [10, 10, 10])], item, 'weight');
assert.equal(r.kg, 9);

// Historial de definición no mezcla con fuerza
r = suggest([S('2026-09-01', 30, [15, 15, 15], 'def'), S('2026-09-03', 30, [15, 15, 15], 'def')], item, 'weight');
assert.equal(r.type, 'new');

// Plancha por tiempo: +5 s tras dos sesiones completas
const plank = { ex: 'plancha', sets: 3, repMin: 30, repMax: 60, key: 'fuerza' };
const P = (date, secs) => ({ date, entries: [{ ex: 'plancha', key: 'fuerza', kind: 'time', sets: secs.map((s) => ({ reps: s, done: true })) }] });
r = suggest([P('2026-09-01', [40, 40, 40]), P('2026-09-03', [45, 42, 40])], plank, 'time');
assert.equal(r.type, 'up');
assert.equal(r.reps, 45);

console.log('OK: progresión');
