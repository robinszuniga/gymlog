// Ejecutar: node tests/summary.test.mjs
import assert from 'node:assert/strict';
import { weekSummary, weekRange, recommendations } from '../js/summary.js';

const W = (ex, key, kg, reps) => ({ ex, key, kind: 'weight', sets: reps.map((r) => ({ kg, reps: r, done: true })) });
const sess = (id, date, entries, createdAt) => ({ id, date, mode: 'plan', dayId: 'P1', dayName: 'Día', createdAt, entries });

// 2026-09-28 es lunes; 2026-10-04 es domingo
assert.deepEqual(weekRange('2026-10-01'), { start: '2026-09-28', end: '2026-10-04' });
assert.deepEqual(weekRange('2026-10-04'), { start: '2026-09-28', end: '2026-10-04' });
assert.deepEqual(weekRange('2026-09-28'), { start: '2026-09-28', end: '2026-10-04' });

const sessions = [
  // Semana anterior
  sess('a', '2026-09-22', [W('banca', 'r8-12', 50, [10, 10, 9]), W('prensa', 'r8-12', 100, [12, 12, 12])], 1),
  sess('b', '2026-09-24', [W('rdl', 'r8-12', 60, [10, 10, 10]), { ex: 'caminar', key: 'cardio', kind: 'cardio', minutes: 20 }], 2),
  // Semana del resumen
  sess('c', '2026-09-28', [
    W('banca', 'r8-12', 52.5, [9, 9, 8]),
    W('prensa', 'r8-12', 100, [12, 12, 10]),
    W('jalon', 'r8-12', 45, [10, 10, 10]),
    { ex: 'plancha', key: 'r30-60', kind: 'time', sets: [{ kg: 0, reps: 30, done: true }, { kg: 0, reps: 35, done: true }] },
  ], 3),
  sess('d', '2026-09-30', [
    W('rdl', 'r8-12', 60, [11, 11, 10]),
    { ex: 'caminar', key: 'cardio', kind: 'cardio', minutes: 25 },
  ], 4),
  // Semana siguiente (no debe contarse)
  sess('e', '2026-10-06', [W('banca', 'r8-12', 55, [8, 8, 8])], 5),
];

const sum = weekSummary(sessions, '2026-10-01');
assert.equal(sum.sessions, 2);
assert.equal(sum.days, 2);
assert.equal(sum.strengthDays, 2);
assert.equal(sum.cardioMin, 25);

// Series por músculo: el principal cuenta 1 y los demás 0,5
assert.equal(sum.setsByMuscle.pecho, 3);
assert.equal(sum.setsByMuscle.triceps, 1.5);
assert.equal(sum.setsByMuscle.cuadriceps, 3);
assert.equal(sum.setsByMuscle.gluteos, 1.5 + 1.5); // prensa + peso muerto rumano
assert.equal(sum.setsByMuscle.isquios, 3);
assert.equal(sum.setsByMuscle.espalda, 3);
assert.equal(sum.setsByMuscle.core, 2);
assert.equal(sum.areas.empuje, 3);
assert.equal(sum.areas.posterior, 3);

// Cambios frente a la sesión anterior de cada ejercicio
const ch = Object.fromEntries(sum.changes.map((c) => [c.ex, c]));
assert.equal(ch.banca.dir, 'up');
assert.equal(ch.banca.unit, 'kg');
assert.equal(ch.banca.to, 52.5);
assert.equal(ch.prensa.dir, 'down'); // mismo peso, menos repeticiones
assert.equal(ch.prensa.unit, 'reps');
assert.equal(ch.rdl.dir, 'up');
assert.equal(ch.rdl.from, 30);
assert.equal(ch.rdl.to, 32);
assert.equal(ch.caminar.to, 25);
assert.equal(ch.jalon, undefined, 'sin sesión anterior no hay comparación');

// Recomendaciones: pocas y apoyadas en datos
let recs = recommendations(sum, { goal: 'musculo', perWeek: 4, hasCardio: false, weekOver: true });
assert.ok(recs.length >= 1 && recs.length <= 3);
assert.ok(recs.some((r) => r.includes('2 de 4')));
assert.ok(!recs.some((r) => /lesi|dolor|médic|enfermedad/i.test(r)), 'sin mensajes médicos');

recs = recommendations(sum, { goal: 'general', perWeek: 2, hasCardio: true, weekOver: true });
assert.ok(recs.some((r) => r.includes('25 min') && r.includes('150')));
// Con la semana en curso no se reclama lo que aún puede hacerse
recs = recommendations(sum, { goal: 'general', perWeek: 4, hasCardio: true, weekOver: false });
assert.ok(!recs.some((r) => r.includes('de 4 días')));
assert.ok(!recs.some((r) => r.includes('OMS')));

// Semana sin registros
const empty = weekSummary(sessions, '2026-08-05');
assert.equal(empty.sessions, 0);
assert.equal(recommendations(empty, { weekOver: true }).length, 1);

// Zona sin trabajar: se menciona
const onlyPush = weekSummary([sess('x', '2026-09-28', [W('banca', 'r8-12', 50, [10, 10, 10])], 1), sess('y', '2026-09-30', [W('banca', 'r8-12', 50, [10, 10, 10])], 2)], '2026-09-30');
recs = recommendations(onlyPush, { goal: 'fuerza', perWeek: 2, weekOver: true });
assert.ok(recs.some((r) => r.includes('piernas') && r.includes('tracción')));

console.log('OK: resumen semanal');
