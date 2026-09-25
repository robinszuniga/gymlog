// Lógica de progresión (funciones puras, sin DOM).

// Historial de un ejercicio para una misma prescripción (key), del más reciente al más antiguo.
export function entriesFor(sessions, ex, key) {
  const out = [];
  for (const s of sessions) {
    for (const e of s.entries) {
      if (e.ex === ex && (key == null || e.key === key)) out.push({ date: s.date, mode: s.mode, ...e });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
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

// Devuelve { type: 'new' | 'up' | 'keep', kg, kgMax, reps, text, detail, streak }
export function suggest(sessions, item, kind) {
  const hist = entriesFor(sessions, item.ex, item.key);
  const last = hist[0];
  const prev = hist[1];

  if (kind === 'time') return suggestTime(hist, item);

  if (!last) {
    return {
      type: 'new', kg: null, reps: item.repMax, streak: 0,
      text: 'Primera vez',
      detail: `Elige un peso con el que logres ${item.repMax} reps con buena técnica.`,
    };
  }

  const kg = workingKg(last);
  const ok0 = isSuccess(last, item);
  const ok1 = prev ? isSuccess(prev, item) && workingKg(prev) >= kg : false;
  const streak = ok0 ? (ok1 ? 2 : 1) : 0;

  if (streak === 2) {
    if (kg === 0) {
      return {
        type: 'up', kg: 0, reps: item.repMax, streak,
        text: 'Sube la dificultad',
        detail: 'Dominas el rango: agrega algo de peso o haz más reps.',
      };
    }
    const step = stepFor(kg);
    const lo = Math.max(kg + step, roundTo(kg * 1.05, step));
    const hi = Math.max(lo, roundTo(kg * 1.1, step));
    return {
      type: 'up', kg: lo, kgMax: hi, reps: item.repMin, streak,
      text: lo === hi ? `Sube a ${fmt(lo)} kg` : `Sube a ${fmt(lo)}–${fmt(hi)} kg`,
      detail: `${item.sets}×${item.repMax} completas dos sesiones seguidas con ${fmt(kg)} kg.`,
    };
  }

  const repsTxt = (last.sets || []).filter((s) => s.done).map((s) => s.reps).join(', ') || '—';
  return {
    type: 'keep', kg, reps: item.repMax, streak,
    text: kg ? `Mantén ${fmt(kg)} kg` : 'Mantén',
    detail: streak === 1
      ? `Vas 1 de 2: repite ${item.sets}×${item.repMax} y la próxima subes.`
      : `Última vez: ${repsTxt} reps. Meta: ${item.sets}×${item.repMax} dos sesiones seguidas.`,
  };
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
