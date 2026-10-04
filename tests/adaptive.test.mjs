// Ejecutar: node tests/adaptive.test.mjs
// Progresión de los planes por objetivo (adaptive) y cardio progresivo.
import assert from 'node:assert/strict';
import { suggest, suggestCardio } from '../js/progression.js';

const item = { ex: 'banca', sets: 3, setsMax: 4, repMin: 8, repMax: 12, key: 'r8-12', adaptive: true };
const S = (date, kg, reps, createdAt = 0) => ({
  date, mode: 'plan', createdAt,
  entries: [{ ex: 'banca', key: 'r8-12', kind: 'weight', sets: reps.map((r) => ({ kg, reps: r, done: true })) }],
});

// Sin historial: no hay carga fija; con peso elegido por la persona, se usa ese
let r = suggest([], item, 'weight');
assert.equal(r.type, 'new');
assert.equal(r.kg, null);
assert.equal(suggest([], { ...item, start: 40 }, 'weight').kg, 40);

// Una sola sesión completa en el tope del rango basta para proponer subir (~5 %)
r = suggest([S('2026-09-01', 50, [12, 12, 12])], item, 'weight');
assert.equal(r.type, 'up');
assert.equal(r.kg, 52.5);
assert.equal(r.lastKg, 50, 'conserva el peso anterior para poder mantener');
assert.ok(!/fall(o|ar)/i.test(r.text));

// Fuerza: aumentos más pequeños (2,5–5 %)
r = suggest([S('2026-09-01', 100, [12, 12, 12])], { ...item, incMin: 2.5, incMax: 5 }, 'weight');
assert.equal(r.kg, 102.5);
assert.equal(r.kgMax, 105);

// Dentro del rango pero sin llegar al tope: mantener y buscar una repetición más, sin pedir fallo
r = suggest([S('2026-09-01', 50, [12, 10, 9])], item, 'weight');
assert.equal(r.type, 'keep');
assert.equal(r.kg, 50);
assert.match(r.detail, /sin llegar al fallo/);

// Dos sesiones seguidas por debajo del rango con el mismo peso: proponer bajar
r = suggest([S('2026-09-01', 60, [8, 7, 6]), S('2026-09-03', 60, [7, 6, 6])], item, 'weight');
assert.equal(r.type, 'down');
assert.equal(r.kg, 55);
assert.equal(r.lastKg, 60);
// Una sola sesión baja no alcanza para proponer bajar
assert.equal(suggest([S('2026-09-03', 60, [7, 6, 6])], item, 'weight').type, 'keep');
// Las rutinas clásicas (sin adaptive) nunca proponen bajar
assert.equal(suggest([S('2026-09-01', 60, [8, 7, 6]), S('2026-09-03', 60, [7, 6, 6])], { ...item, adaptive: false }, 'weight').type, 'keep');

// Dos sesiones el mismo día: manda la más reciente (createdAt)
r = suggest([S('2026-09-05', 50, [12, 12, 12], 1), S('2026-09-05', 55, [9, 8, 8], 2)], item, 'weight');
assert.equal(r.kg, 55);
assert.equal(r.type, 'keep');

// Cardio progresivo
const c = { ex: 'caminar', min: 15, max: 30, key: 'cardio', progressive: true };
const C = (date, minutes) => ({ date, mode: 'plan', entries: [{ ex: 'caminar', key: 'cardio', kind: 'cardio', minutes }] });
assert.equal(suggestCardio([], c).minutes, 15);
assert.equal(suggestCardio([C('2026-09-01', 15)], c).type, 'keep');
r = suggestCardio([C('2026-09-01', 15), C('2026-09-03', 15)], c);
assert.equal(r.type, 'up');
assert.equal(r.minutes, 17);
r = suggestCardio([C('2026-09-01', 20), C('2026-09-03', 20)], c);
assert.equal(r.minutes, 22);
// No pasa del tope del rango
assert.equal(suggestCardio([C('2026-09-01', 30), C('2026-09-03', 30)], c).minutes, 30);
assert.equal(suggestCardio([C('2026-09-01', 30), C('2026-09-03', 30)], c).type, 'keep');
// Cardio de las rutinas clásicas: siempre el mínimo indicado
assert.equal(suggestCardio([C('2026-09-01', 40)], { ex: 'caminar', min: 20, max: 20, key: 'cardio' }).minutes, 20);

console.log('OK: progresión adaptativa');
