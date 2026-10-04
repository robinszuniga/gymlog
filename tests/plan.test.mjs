// Ejecutar: node tests/plan.test.mjs
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/data.js';
import {
  buildPlan, coverage, plannedSets, alternativesFor, swapExercise, areaOf,
  GOALS, LEVELS, EQUIP_PRESETS, AREAS, weightedExercises,
} from '../js/plan.js';

const equipSets = {
  gimnasio: EQUIP_PRESETS.gimnasio.equip,
  mancuernas: ['mancuernas'],
  bandas: ['banda'],
  nada: [],
};
const allowed = (equip, k) => EXERCISES[k].equip === 'corporal' || equip.includes(EXERCISES[k].equip);

// Todas las combinaciones de objetivo × días × nivel × equipo
let combos = 0;
for (const goal of Object.keys(GOALS)) {
  for (let days = 2; days <= 6; days++) {
    for (const level of Object.keys(LEVELS)) {
      for (const [name, equipment] of Object.entries(equipSets)) {
        const plan = buildPlan({ goal, days, level, equipment, cardio: 'caminar' });
        const tag = `${goal}/${days}/${level}/${name}`;
        combos++;
        assert.equal(plan.days.length, days, `${tag}: número de días`);

        // 1. Solo ejercicios que el equipo permite
        for (const d of plan.days) for (const it of d.items) {
          assert.ok(EXERCISES[it.ex], `${tag}: ejercicio desconocido ${it.ex}`);
          assert.ok(allowed(equipment, it.ex), `${tag}: ${it.ex} requiere equipo no disponible`);
        }

        // 2. Cubre piernas, cadera/isquios, empuje, tracción y core.
        //    Sin equipo ni bandas no hay tracción posible: debe avisarlo en las notas.
        const cov = coverage(plan);
        for (const area of Object.keys(AREAS)) {
          if (area === 'traccion' && name === 'nada') {
            assert.ok(cov.traccion === 0 && plan.notes.some((n) => n.includes('tracción')), `${tag}: debe avisar que falta tracción`);
          } else {
            assert.ok(cov[area] >= 1, `${tag}: falta ${area}`);
          }
        }

        // 3. Fuerza: cada zona principal al menos dos veces por semana
        if (goal === 'fuerza' && name !== 'nada') {
          for (const area of ['piernas', 'posterior', 'empuje', 'traccion']) {
            assert.ok(cov[area] >= 2, `${tag}: ${area} solo ${cov[area]} vez por semana`);
          }
        }

        // 4. Sin ejercicios repetidos en un mismo día y con series/reps válidas
        for (const d of plan.days) {
          const keys = d.items.map((it) => it.ex);
          assert.equal(new Set(keys).size, keys.length, `${tag}: ejercicio repetido en ${d.name}`);
          for (const it of d.items) {
            if (it.key === 'cardio') {
              assert.ok(it.min > 0 && it.max >= it.min, `${tag}: minutos de cardio`);
            } else {
              assert.ok(it.sets >= 2 && it.repMin > 0 && it.repMax >= it.repMin, `${tag}: series/reps`);
              assert.match(it.key, /^r\d+-\d+$/);
              assert.equal(it.start, undefined, `${tag}: no debe traer cargas fijas`);
            }
          }
        }
      }
    }
  }
}

// Perder grasa: mismo trabajo de fuerza que músculo/general (sin subir repeticiones) y nunca HIIT por defecto
{
  const grasa = buildPlan({ goal: 'grasa', days: 3, level: 'intermedio', equipment: equipSets.gimnasio, cardio: 'caminar' });
  const strength = grasa.days.flatMap((d) => d.items).filter((it) => EXERCISES[it.ex].kind === 'weight');
  assert.ok(strength.length >= 9, 'grasa conserva el trabajo de fuerza');
  assert.ok(strength.every((it) => it.repMax <= 15 && it.repMin <= 10), 'grasa no usa repeticiones altas por defecto');
  assert.ok(!grasa.days.some((d) => d.items.some((it) => it.ex === 'hiit')), 'grasa no impone HIIT');
  // Sin cardio elegido: no hay días de cardio y se avisa
  const sinCardio = buildPlan({ goal: 'grasa', days: 4, level: 'intermedio', equipment: equipSets.gimnasio, cardio: null });
  assert.ok(!sinCardio.days.some((d) => d.items.some((it) => it.key === 'cardio')));
  assert.ok(sinCardio.days.every((d) => d.items.length >= 4));
  // El cardio elegido es el que se usa
  const bici = buildPlan({ goal: 'grasa', days: 5, level: 'principiante', equipment: [], cardio: 'bici' });
  assert.ok(bici.days.flatMap((d) => d.items).filter((it) => it.key === 'cardio').every((it) => it.ex === 'bici'));
}

// Condición general: combina fuerza y cardio progresivo
{
  const g = buildPlan({ goal: 'general', days: 4, level: 'principiante', equipment: ['mancuernas'] });
  const items = g.days.flatMap((d) => d.items);
  assert.ok(items.some((it) => it.key === 'cardio' && it.progressive), 'general incluye cardio progresivo');
  assert.ok(items.some((it) => EXERCISES[it.ex].kind === 'weight'), 'general incluye fuerza');
}

// Fuerza: los movimientos principales usan menos repeticiones y aumentos pequeños
{
  const f = buildPlan({ goal: 'fuerza', days: 3, level: 'intermedio', equipment: equipSets.gimnasio });
  const mains = f.days.flatMap((d) => d.items).filter((it) => it.role === 'main');
  assert.ok(mains.length >= 6);
  assert.ok(mains.every((it) => EXERCISES[it.ex].main && it.repMax <= 8 && it.incMax <= 5));
}

// Ganar músculo: plan de gimnasio da un número razonable de series por grupo grande
{
  const m = buildPlan({ goal: 'musculo', days: 4, level: 'intermedio', equipment: equipSets.gimnasio });
  const sets = plannedSets(m);
  for (const k of ['cuadriceps', 'isquios', 'pecho', 'espalda']) {
    assert.ok(sets[k] >= 6 && sets[k] <= 20, `musculo: ${k} con ${sets[k]} series`);
  }
}

// Bisagra de cadera / isquios disponibles con distinto equipo
{
  const withBar = buildPlan({ goal: 'fuerza', days: 4, level: 'intermedio', equipment: ['barra'] });
  assert.ok(withBar.days.some((d) => d.items.some((it) => ['rdl', 'pesoMuerto', 'hipThrust'].includes(it.ex))));
  const gym = buildPlan({ goal: 'musculo', days: 4, level: 'intermedio', equipment: equipSets.gimnasio });
  assert.ok(gym.days.some((d) => d.items.some((it) => it.ex === 'curlFemoral')), 'usa curl femoral en gimnasio');
  const home = buildPlan({ goal: 'general', days: 3, level: 'principiante', equipment: ['mancuernas'] });
  assert.ok(home.days.some((d) => d.items.some((it) => it.ex === 'rdlManc')), 'usa peso muerto rumano con mancuernas');
}

// Evitar movimientos: no aparecen ejercicios con esas características
{
  const p = buildPlan({ goal: 'musculo', days: 4, level: 'avanzado', equipment: equipSets.gimnasio, avoid: ['overhead', 'axial', 'hang'] });
  for (const d of p.days) for (const it of d.items) {
    const flags = EXERCISES[it.ex].flags || [];
    assert.ok(!flags.some((f) => ['overhead', 'axial', 'hang'].includes(f)), `${it.ex} debía evitarse`);
  }
  assert.ok(coverage(p).empuje >= 1 && coverage(p).traccion >= 1);
  // Excluir un ejercicio puntual
  const q = buildPlan({ goal: 'fuerza', days: 3, level: 'intermedio', equipment: equipSets.gimnasio, exclude: ['banca', 'sentadilla'] });
  assert.ok(!q.days.some((d) => d.items.some((it) => ['banca', 'sentadilla'].includes(it.ex))));
}

// Sustituir: alternativas de la misma zona, primero las que el equipo permite
{
  const plan = buildPlan({ goal: 'musculo', days: 3, level: 'intermedio', equipment: ['mancuernas'] });
  const di = 0;
  const ii = plan.days[0].items.findIndex((it) => areaOf(it.ex) === 'posterior');
  assert.ok(ii >= 0);
  const alts = alternativesFor(plan.days[di].items[ii].ex, plan);
  assert.ok(alts.length >= 3);
  assert.ok(alts.every((a) => areaOf(a.ex) === 'posterior'));
  assert.ok(alts[0].available, 'la primera alternativa debe estar disponible');
  const next = swapExercise(plan, di, ii, 'puenteGluteo');
  assert.equal(next.days[di].items[ii].ex, 'puenteGluteo');
  assert.notEqual(plan.days[di].items[ii].ex, 'puenteGluteo', 'no modifica el plan original');
  assert.ok(next.days[di].items[ii].repMax >= 12, 'sin carga externa progresa con repeticiones');
  // Cardio solo se sustituye por cardio
  assert.ok(alternativesFor('caminar', plan).every((a) => EXERCISES[a.ex].kind === 'cardio'));
  const ws = weightedExercises(plan);
  assert.ok(ws.length > 0 && ws.every((w) => EXERCISES[w.ex].kind === 'weight' && /^r\d+-\d+$/.test(w.key)));
  assert.equal(new Set(ws.map((w) => `${w.ex}|${w.key}`)).size, ws.length, 'sin filas repetidas');
}

console.log(`OK: plan (${combos} combinaciones)`);
