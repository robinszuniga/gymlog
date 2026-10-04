// Lógica de progresión (funciones puras, sin DOM).

// Historial de un ejercicio para una misma prescripción (key), del más reciente al más antiguo.
export function entriesFor(sessions, ex, key) {
  const out = [];
  for (const s of sessions) {
    for (const e of s.entries) {
      if (e.ex === ex && (key == null || e.key === key)) {
        out.push({ date: s.date, mode: s.mode, createdAt: s.createdAt, ...e });
      }
    }
  }
  // The store keeps sessions in chronological order. Use creation time as a
  // tie-breaker so two workouts logged on the same date use the newer one.
  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
  });
}

// Peso de trabajo = el menor peso usado en las series hechas (si hubo pirámide, cuenta el más bajo).
export function workingKg(entry) {
  const kgs = (entry.sets || []).filter((s) => s.done).map((s) => Number(s.kg) || 0);
  return kgs.length ? Math.min(...kgs) : 0;
}

// Sesión "sin fallar": todas las series pedidas hechas y cada una llegó al tope del rango.
export function isSuccess(entry, item) {
  const done = (entry.sets || []).filter((s) => s.done);
  if (done.length < item.sets) return false;
  return done.every((s) => (Number(s.reps) || 0) >= item.repMax);
}

export function roundTo(x, step) {
  return Math.round(x / step) * step;
}

export function stepFor(kg) {
  return kg < 20 ? 1 : 2.5;
}

// Devuelve { type: 'new' | 'up' | 'keep' | 'down', kg, kgMax, lastKg, reps, text, detail, streak }
// Los ítems de planes por objetivo traen adaptive: true. Para ellos basta una sesión completa en el
// tope del rango para proponer subir, los aumentos son pequeños (incMin/incMax en %), se puede
// proponer bajar si dos sesiones seguidas quedaron por debajo del rango, y nunca se pide llegar al fallo.
// Las rutinas clásicas (sin adaptive) conservan la regla original de dos sesiones seguidas.
export function suggest(sessions, item, kind) {
  const hist = entriesFor(sessions, item.ex, item.key);
  const last = hist[0];
  const prev = hist[1];

  if (kind === 'time') return suggestTime(hist, item);

  const adaptive = item.adaptive === true;
  const start = Number(item.start) > 0 ? Number(item.start) : null;

  if (!last && start) {
    return {
      type: 'new', kg: start, lastKg: start, reps: item.repMax, streak: 0,
      text: `Empieza con ${fmt(start)} kg`,
      detail: adaptive
        ? 'Es el peso que elegiste. Ajústalo si lo sientes muy fácil o muy pesado.'
        : `Tu peso actual. Si hoy estás más fuerte, cámbialo. Meta: ${item.sets}×${item.repMax}.`,
    };
  }

  if (!last) {
    return {
      type: 'new', kg: null, lastKg: null, reps: item.repMax, streak: 0,
      text: 'Primera vez',
      detail: !adaptive
        ? `Elige un peso con el que logres ${item.repMax} reps con buena técnica.`
        : kind === 'reps'
          ? `Haz entre ${item.repMin} y ${item.repMax} reps, parando cuando sientas que te quedan 1 o 2 más. El peso es opcional.`
          : `Elige un peso con el que hagas ${item.repMin}–${item.repMax} reps sintiendo que te quedaban 1 o 2 más.`,
    };
  }

  const kg = workingKg(last);
  const ok0 = isSuccess(last, item);
  const ok1 = prev ? isSuccess(prev, item) && workingKg(prev) >= kg : false;
  const streak = ok0 ? (ok1 ? 2 : 1) : 0;
  const need = adaptive ? 1 : 2;

  if (streak >= need) {
    if (kg === 0) {
      return {
        type: 'up', kg: 0, lastKg: 0, reps: item.repMax, streak,
        text: 'Sube la dificultad',
        detail: adaptive
          ? 'Ya haces el tope del rango: prueba una variante más difícil, agrega algo de peso o suma repeticiones.'
          : 'Dominas el rango: agrega algo de peso o haz más reps.',
      };
    }
    const step = stepFor(kg);
    const incMin = (item.incMin ?? 5) / 100;
    const incMax = (item.incMax ?? (adaptive ? 5 : 10)) / 100;
    const lo = Math.max(kg + step, roundTo(kg * (1 + incMin), step));
    const hi = Math.max(lo, roundTo(kg * (1 + incMax), step));
    return {
      type: 'up', kg: lo, kgMax: hi, lastKg: kg, reps: item.repMin, streak,
      text: lo === hi ? `Sube a ${fmt(lo)} kg` : `Sube a ${fmt(lo)}–${fmt(hi)} kg`,
      detail: adaptive
        ? `Hiciste ${item.sets}×${item.repMax} con ${fmt(kg)} kg. Puedes subir un poco o quedarte igual si hoy no te sientes listo.`
        : `${item.sets}×${item.repMax} completas dos sesiones seguidas con ${fmt(kg)} kg.`,
    };
  }

  // Dos sesiones seguidas por debajo del rango con el mismo peso o más: proponer bajar un poco.
  if (adaptive && prev && kg > 0 && belowRange(last, item) && belowRange(prev, item) && workingKg(prev) <= kg) {
    const step = stepFor(kg);
    const down = Math.max(0, Math.min(kg - step, roundTo(kg * 0.9, step)));
    return {
      type: 'down', kg: down, lastKg: kg, reps: item.repMin, streak: 0,
      text: `Prueba con ${fmt(down)} kg`,
      detail: `Dos sesiones con menos de ${item.repMin} reps con ${fmt(kg)} kg. Bajar un poco ayuda a volver al rango.`,
    };
  }

  const repsTxt = (last.sets || []).filter((s) => s.done).map((s) => s.reps).join(', ') || '—';
  let detail;
  if (adaptive) {
    detail = `Última vez: ${repsTxt} reps. Busca sumar una repetición en alguna serie, sin llegar al fallo. Al completar ${item.sets}×${item.repMax} subes de peso.`;
  } else if (streak === 1) {
    detail = `Vas 1 de 2: repite ${item.sets}×${item.repMax} y la próxima subes.`;
  } else {
    detail = `Última vez: ${repsTxt} reps. Meta: ${item.sets}×${item.repMax} dos sesiones seguidas.`;
  }
  return {
    type: 'keep', kg, lastKg: kg, reps: item.repMax, streak,
    text: kg ? `Mantén ${fmt(kg)} kg` : 'Mantén',
    detail,
  };
}

function belowRange(entry, item) {
  const done = (entry.sets || []).filter((s) => s.done);
  return done.length > 0 && done.some((s) => (Number(s.reps) || 0) < item.repMin);
}

// Cardio progresivo: si las dos últimas sesiones duraron parecido, propone ~10 % más (mínimo 2 min)
// hasta el tope del rango. Luego sugiere mantener el tiempo.
export function suggestCardio(sessions, item) {
  const hist = entriesFor(sessions, item.ex, 'cardio');
  const last = hist[0];
  const clamp = (m) => Math.max(item.min, Math.min(item.max, Math.round(m)));
  if (!last || !item.progressive) {
    return { type: 'new', minutes: item.min, text: `${item.min} min`, detail: 'Empieza a un ritmo cómodo, en el que puedas hablar.' };
  }
  const m = Number(last.minutes) || 0;
  const prev = hist[1] ? Number(hist[1].minutes) || 0 : 0;
  if (m >= item.max) {
    return { type: 'keep', minutes: clamp(m), text: `Mantén ${clamp(m)} min`, detail: 'Ya estás en la parte alta del rango. Si te sientes bien, puedes subir un poco el ritmo.' };
  }
  if (m >= item.min && prev >= m * 0.9) {
    const next = clamp(m + Math.max(2, m * 0.1));
    return { type: 'up', minutes: next, lastMinutes: clamp(m), text: `Sube a ${next} min`, detail: `Llevas dos sesiones de unos ${fmt(m)} min. Puedes sumar un poco más o quedarte igual.` };
  }
  return { type: 'keep', minutes: clamp(m), text: `Mantén ${clamp(m)} min`, detail: 'Repite esta duración una vez más antes de subir.' };
}

// Ejercicios por tiempo (plancha): +5 s cuando las últimas 2 sesiones salieron completas.
function suggestTime(hist, item) {
  const last = hist[0];
  if (!last) {
    return { type: 'new', reps: item.repMin, streak: 0, text: 'Primera vez', detail: `Aguanta ${item.repMin} s por serie.` };
  }
  const minSec = (e) => {
    const d = (e.sets || []).filter((s) => s.done).map((s) => Number(s.reps) || 0);
    return d.length >= item.sets ? Math.min(...d) : 0;
  };
  const done = (e) => (e.sets || []).filter((s) => s.done).length >= item.sets && minSec(e) >= item.repMin;
  const secs = minSec(last) || Math.max(...(last.sets || []).map((s) => Number(s.reps) || 0), item.repMin);
  if (done(last) && hist[1] && done(hist[1])) {
    return { type: 'up', reps: secs + 5, streak: 2, text: `Sube a ${secs + 5} s`, detail: 'Dos sesiones completas seguidas: +5 s por serie.' };
  }
  return { type: 'keep', reps: secs, streak: done(last) ? 1 : 0, text: `Mantén ${secs} s`, detail: `Completa las ${item.sets} series dos sesiones seguidas para subir.` };
}

export function fmt(n) {
  const v = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
}
