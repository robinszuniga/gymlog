// Pantallas del plan por objetivo: asistente de configuración, vista del plan y resumen semanal.
import * as store from './store.js';
import { EXERCISES, MODES } from './data.js';
import {
  GOALS, LEVELS, EQUIPMENT, EQUIP_LABEL, EQUIP_PRESETS, AVOID, CARDIO_OPTIONS, MUSCLES, AREAS,
  buildPlan, coverage, plannedSets, plannedCardio, alternativesFor, swapExercise, weightedExercises,
} from './plan.js';
import { weekSummary, recommendations, GUIDE } from './summary.js';
import { fmt } from './progression.js';

// Utilidades que presta app.js (esc, num, toast, go, render, target, fDate, openDialog, closeDialog, swapInSession).
let h;
export function init(helpers) { h = helpers; }

const STEPS = 5;
let wiz = null; // respuestas del asistente mientras se configura
let weekOffset = 0; // 0 = semana actual, -1 = la anterior…
let swapCtx = null; // qué ejercicio se está sustituyendo

const DISCLAIMER = 'Son guías generales para adultos sanos, no una indicación médica. Ajusta el plan a cómo te sientes y consulta a un profesional de salud si tienes dudas.';

function newWizard(plan) {
  if (plan) {
    return {
      step: 1, goal: plan.goal, days: plan.daysPerWeek, level: plan.level, equipment: [...plan.equipment],
      prefer: plan.prefer || 'igual', avoid: [...(plan.avoid || [])], exclude: [...(plan.exclude || [])],
      cardio: plan.cardio, cardioSet: true, plan: null,
    };
  }
  return {
    step: 1, goal: null, days: 3, level: 'principiante', equipment: [...EQUIP_PRESETS.gimnasio.equip],
    prefer: 'igual', avoid: [], exclude: [], cardio: null, cardioSet: false, plan: null,
  };
}

const profileOf = (w) => ({
  goal: w.goal, days: w.days, level: w.level, equipment: w.equipment, prefer: w.prefer,
  avoid: w.avoid, exclude: w.exclude, cardio: w.cardio,
});

const cardioChoices = (w) => CARDIO_OPTIONS.filter((k) => !(EXERCISES[k].flags || []).some((f) => w.avoid.includes(f)));

// ---------- asistente ----------
export function renderSetup() {
  const st = store.get();
  if (!wiz) wiz = newWizard(st.mode === 'plan' ? st.plan : null);
  const w = wiz;
  const body = [stepGoal, stepTime, stepEquipment, stepPrefs, stepReview][w.step - 1](w, st);
  const back = w.step > 1
    ? '<button class="icon-btn" data-act="wiz-back" aria-label="Paso anterior">←</button>'
    : (st.mode ? '<button class="icon-btn" data-act="wiz-cancel" aria-label="Cancelar">✕</button>' : '');
  return `
    <header class="topbar wiz-top">
      ${back}
      <div class="grow">
        <h1>${w.step === 1 && !st.mode ? 'GymLog' : 'Tu plan'}</h1>
        <div class="steps" role="progressbar" aria-valuemin="1" aria-valuemax="${STEPS}" aria-valuenow="${w.step}" aria-label="Paso ${w.step} de ${STEPS}">
          ${Array.from({ length: STEPS }, (_, i) => `<span class="${i < w.step ? 'on' : ''}"></span>`).join('')}
        </div>
      </div>
    </header>
    <main class="wizard">${body}</main>`;
}

function stepGoal(w, st) {
  const cards = Object.entries(GOALS).map(([k, g]) => `
    <button class="mode-card ${w.goal === k ? 'on' : ''}" data-act="wiz-goal" data-v="${k}" aria-pressed="${w.goal === k}">
      <span class="mode-card-title">${h.esc(g.label)}</span>
      <span class="mode-card-list">${h.esc(g.desc)}</span>
    </button>`).join('');
  const classic = Object.entries(MODES).map(([k, m]) => `
    <button class="btn ghost" data-act="pick-mode" data-mode="${k}">${h.esc(m.label)} clásica<small>${h.esc(m.summary)}</small></button>`).join('');
  return `
    <p class="lead">¿Qué quieres lograr?</p>
    ${cards}
    <p class="muted small center">Puedes cambiar el plan cuando quieras. Tu historial se conserva.</p>
    <details class="card fold">
      <summary>Usar una rutina fija</summary>
      <p class="muted small">Rutinas con ejercicios ya definidos, sin preguntas.</p>
      <div class="stack">${classic}</div>
      ${st.plan && st.mode !== 'plan' ? `<button class="btn" data-act="use-plan">Volver a mi plan (${h.esc(GOALS[st.plan.goal].label)})</button>` : ''}
    </details>`;
}

function stepTime(w) {
  const days = [2, 3, 4, 5, 6].map((n) => `<button class="chip ${w.days === n ? 'on' : ''}" role="radio" aria-checked="${w.days === n}" data-act="wiz-set" data-k="days" data-v="${n}">${n}<small>días</small></button>`).join('');
  const levels = Object.entries(LEVELS).map(([k, l]) => `
    <button class="opt ${w.level === k ? 'on' : ''}" role="radio" aria-checked="${w.level === k}" data-act="wiz-set" data-k="level" data-v="${k}">
      <strong>${h.esc(l.label)}</strong><small>${h.esc(l.desc)}</small>
    </button>`).join('');
  return `
    <p class="lead">¿Cuántos días por semana puedes entrenar?</p>
    <div class="chips" role="radiogroup" aria-label="Días por semana" style="grid-template-columns:repeat(5,1fr)">${days}</div>
    <p class="muted small">Elige los que de verdad puedas cumplir. No son días fijos: marcas cada sesión el día que vayas.</p>
    <p class="lead">¿Cuánta experiencia tienes?</p>
    <div class="stack" role="radiogroup" aria-label="Experiencia">${levels}</div>
    <button class="btn primary big" data-act="wiz-next">Continuar</button>`;
}

function stepEquipment(w) {
  const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const presets = Object.entries(EQUIP_PRESETS).map(([k, p]) => `<button class="opt ${same(p.equip, w.equipment) ? 'on' : ''}" data-act="wiz-preset" data-v="${k}"><strong>${h.esc(p.label)}</strong></button>`).join('');
  const items = Object.entries(EQUIPMENT).map(([k, label]) => `<button class="tag-btn ${w.equipment.includes(k) ? 'on' : ''}" aria-pressed="${w.equipment.includes(k)}" data-act="wiz-toggle" data-k="equipment" data-v="${k}">${h.esc(label)}</button>`).join('');
  const prefer = [['igual', 'Me da igual'], ['libre', 'Peso libre'], ['maquinas', 'Máquinas']]
    .map(([k, label]) => `<button class="${w.prefer === k ? 'on' : ''}" data-act="wiz-set" data-k="prefer" data-v="${k}">${label}</button>`).join('');
  return `
    <p class="lead">¿Con qué equipo cuentas?</p>
    <div class="stack">${presets}</div>
    <p class="muted small">O marca lo que tengas:</p>
    <div class="tags">${items}</div>
    <p class="muted small">Los ejercicios sin equipo siempre están disponibles.</p>
    <p class="lead">¿Qué prefieres usar?</p>
    <div class="seg">${prefer}</div>
    <button class="btn primary big" data-act="wiz-next">Continuar</button>`;
}

function stepPrefs(w) {
  const avoid = Object.entries(AVOID).map(([k, label]) => `<button class="tag-btn ${w.avoid.includes(k) ? 'on' : ''}" aria-pressed="${w.avoid.includes(k)}" data-act="wiz-toggle" data-k="avoid" data-v="${k}">${h.esc(label)}</button>`).join('');
  const mode = GOALS[w.goal].cardio;
  const opts = cardioChoices(w).map((k) => `<button class="tag-btn ${w.cardio === k ? 'on' : ''}" aria-pressed="${w.cardio === k}" data-act="wiz-set" data-k="cardio" data-v="${k}">${h.esc(EXERCISES[k].name)}</button>`).join('');
  const none = mode === 'incluido' ? '' : `<button class="tag-btn ${w.cardio == null ? 'on' : ''}" aria-pressed="${w.cardio == null}" data-act="wiz-set" data-k="cardio" data-v="">Por ahora no</button>`;
  const cardioIntro = {
    incluido: 'El plan incluye cardio que va subiendo de a poco. Elige la actividad que más te guste.',
    recomendado: 'Elige una actividad que puedas sostener en el tiempo. No hace falta que sea intensa: caminar cuenta. El trabajo de fuerza se mantiene igual.',
    opcional: 'El cardio es opcional en este objetivo. Si quieres, se agrega corto al final de algunos días.',
  }[mode];
  return `
    <p class="lead">¿Hay movimientos que prefieras evitar?</p>
    <div class="tags">${avoid}</div>
    <p class="muted small">Es opcional y no hace falta decir por qué. La app solo deja esos ejercicios por fuera; no evalúa lesiones ni dolores. Después también puedes cambiar cualquier ejercicio.</p>
    <p class="lead">Cardio</p>
    <p class="muted small">${cardioIntro}</p>
    <div class="tags">${opts}${none}</div>
    <button class="btn primary big" data-act="wiz-next">Ver mi plan</button>`;
}

function stepReview(w, st) {
  return `
    <p class="lead">Este es tu plan</p>
    ${planView(w.plan, 'wiz', st)}
    <button class="btn primary big" data-act="wiz-save">Guardar plan</button>
    <p class="muted small center">${DISCLAIMER}</p>`;
}

// ---------- vista del plan (asistente y pantalla "Tu plan") ----------
function planView(plan, where, st) {
  const cov = coverage(plan);
  const sets = plannedSets(plan);
  const cardio = plannedCardio(plan);
  const covChips = Object.entries(AREAS).map(([k, a]) => `<span class="pill ${cov[k] ? 'ok' : 'warn'}">${cov[k] ? '✓' : '!'} ${h.esc(a.label)}${cov[k] > 1 ? ` ×${cov[k]}` : ''}</span>`).join('');

  const days = plan.days.map((d, di) => `
    <section class="card">
      <h2>${h.esc(d.name)}</h2>
      <ul class="plan">${d.items.map((it, ii) => `
        <li>
          <span class="grow">${h.esc(EXERCISES[it.ex].name)}<small>${h.target(it)}${EXERCISES[it.ex].kind === 'weight' || EXERCISES[it.ex].kind === 'reps' ? ' reps' : ''} · ${h.esc(EQUIP_LABEL[EXERCISES[it.ex].equip] || '')}</small></span>
          <button class="btn ghost small" data-act="swap" data-where="${where}" data-day="${di}" data-i="${ii}" aria-label="Cambiar ${h.esc(EXERCISES[it.ex].name)}">Cambiar</button>
        </li>`).join('')}
      </ul>
    </section>`).join('');

  const weighted = weightedExercises(plan);
  const weights = weighted.length ? `
    <details class="card fold" ${where === 'wiz' ? 'open' : ''}>
      <summary>Pesos iniciales (opcional)</summary>
      <p class="muted small">Escribe el peso con el que quieres empezar cada ejercicio. Si lo dejas vacío, lo eliges en tu primera sesión. Empieza con un peso que domines.</p>
      ${startRows(weighted, st)}
    </details>` : '';

  return `
    <section class="card">
      <p class="eyebrow">${h.esc(GOALS[plan.goal].label)}</p>
      <h2>${plan.days.length} días por semana · ${h.esc(LEVELS[plan.level].label)}</h2>
      <div class="pills">${covChips}</div>
      ${plan.notes.map((n) => `<p class="hint">${h.esc(n)}</p>`).join('')}
      ${plan.goal === 'musculo' ? musclesBlock(sets, 'Series planeadas por semana', true) : ''}
      ${cardio ? `<p class="muted small">Cardio planeado: desde ${cardio} min por semana. Guía general de la OMS para adultos: ${GUIDE.cardioMin}–${GUIDE.cardioMax} min de actividad moderada, contando también caminar o moverte fuera del gym.</p>` : ''}
    </section>
    ${days}
    ${weights}`;
}

// Una fila por ejercicio y rango de repeticiones. El rango solo se muestra si el mismo
// ejercicio aparece con dos rangos distintos.
function startRows(list, st) {
  return list.map((w) => {
    const id = store.startId(w.ex, w.key);
    const v = st.startWeights[id];
    const twice = list.filter((x) => x.ex === w.ex).length > 1;
    const range = w.repMin === w.repMax ? w.repMin : `${w.repMin}–${w.repMax}`;
    const name = EXERCISES[w.ex].name + (twice ? ` (${range} reps)` : '');
    return `<label class="start-row"><span>${h.esc(name)}</span>
      <input class="num sm" type="text" inputmode="decimal" autocomplete="off" data-f="start" data-id="${h.esc(id)}" value="${v ? h.esc(v) : ''}" placeholder="kg" aria-label="Peso inicial de ${h.esc(name)} en kg"></label>`;
  }).join('');
}

function musclesBlock(sets, title, withRef) {
  const max = Math.max(GUIDE.setsRef * 1.5, ...Object.values(sets));
  const rows = Object.entries(MUSCLES).filter(([k]) => sets[k] > 0 || withRef).map(([k, label]) => `
    <div class="bar-row"><span>${h.esc(label)}</span>
      <div class="bar"><i style="width:${Math.min(100, (sets[k] / max) * 100)}%"></i>${withRef ? `<b style="left:${(GUIDE.setsRef / max) * 100}%"></b>` : ''}</div>
      <strong>${fmt(Math.round(sets[k] * 2) / 2)}</strong></div>`).join('');
  if (!rows) return '';
  return `<h3 class="sub">${h.esc(title)}</h3>${rows}
    <p class="muted small">Cada serie cuenta 1 para el músculo principal del ejercicio y media para los que ayudan.${withRef ? ` La línea marca unas ${GUIDE.setsRef} series, una referencia orientativa: no es un mínimo obligatorio.` : ''}</p>`;
}

export function renderPlan() {
  const st = store.get();
  const head = '<header class="topbar"><a href="#/" class="icon-btn" aria-label="Volver al inicio">←</a><h1 class="grow">Tu plan</h1></header>';
  if (st.mode === 'plan' && st.plan) {
    return `${head}
      ${planView(st.plan, 'plan', st)}
      <section class="card">
        <button class="btn" data-act="plan-edit">Cambiar objetivo, días o equipo</button>
        <p class="muted small">Al cambiar el plan tu historial se conserva.</p>
      </section>
      <details class="card fold"><summary>Usar una rutina fija</summary>
        <div class="stack">${Object.entries(MODES).map(([k, m]) => `<button class="btn ghost" data-act="set-mode" data-mode="${k}">${h.esc(m.label)} clásica</button>`).join('')}</div>
      </details>
      <p class="muted small center">${DISCLAIMER}</p>`;
  }
  // Rutina clásica: se muestra tal cual y se pueden editar los pesos iniciales.
  const m = MODES[st.mode];
  const weighted = weightedExercises(m);
  return `${head}
    <section class="card">
      <p class="eyebrow">Rutina fija</p>
      <h2>${h.esc(m.label)} clásica</h2>
      <p class="muted">${h.esc(m.summary)}</p>
      <div class="seg" role="tablist" aria-label="Rutina fija">
        ${Object.entries(MODES).map(([k, x]) => `<button role="tab" aria-selected="${k === st.mode}" class="${k === st.mode ? 'on' : ''}" data-act="set-mode" data-mode="${k}">${h.esc(x.label)}</button>`).join('')}
      </div>
    </section>
    ${m.days.map((d) => `<section class="card"><h2>${h.esc(d.name)}</h2>
      <ul class="plan">${d.items.map((it) => `<li>${h.esc(EXERCISES[it.ex].name)}<span>${h.target(it)}</span></li>`).join('')}</ul></section>`).join('')}
    <details class="card fold"><summary>Pesos iniciales (opcional)</summary>
      <p class="muted small">Solo se usan la primera vez que haces cada ejercicio. Después manda lo que registres.</p>
      ${startRows(weighted, st)}
    </details>
    <section class="card">
      <h3>Plan según tu objetivo</h3>
      <p class="muted small">Responde unas preguntas y la app arma una rutina según tu meta, tus días y tu equipo.</p>
      <button class="btn primary" data-act="plan-edit">${st.plan ? 'Crear otro plan' : 'Crear mi plan'}</button>
      ${st.plan ? `<button class="btn" data-act="use-plan" style="margin-top:10px">Volver a mi plan (${h.esc(GOALS[st.plan.goal].label)})</button>` : ''}
    </section>`;
}

// ---------- sustituir ejercicio ----------
function openSwap(where, di, ii) {
  const st = store.get();
  let exKey;
  let profile;
  if (where === 'session') {
    exKey = st.draft.entries[ii].ex;
    profile = st.plan || {};
  } else {
    const plan = where === 'wiz' ? wiz.plan : st.plan;
    exKey = plan.days[di].items[ii].ex;
    profile = plan;
  }
  swapCtx = { where, di, ii };
  const alts = alternativesFor(exKey, profile);
  const row = (a) => `<button class="alt-row" data-act="swap-pick" data-ex="${a.ex}">
      <strong>${h.esc(EXERCISES[a.ex].name)}</strong>
      <small>${h.esc(EQUIP_LABEL[EXERCISES[a.ex].equip] || '')}${a.same ? '' : ' · movimiento parecido'}</small></button>`;
  const yes = alts.filter((a) => a.available).map(row).join('');
  const no = alts.filter((a) => !a.available).map(row).join('');
  h.openDialog(`<div class="media-box">
    <h2>Cambiar ${h.esc(EXERCISES[exKey].name)}</h2>
    <p class="muted small">Opciones que trabajan la misma zona.</p>
    ${yes || '<p class="muted">No hay alternativas con tu equipo.</p>'}
    ${no ? `<h3 class="sub">Con otro equipo o que marcaste para evitar</h3>${no}` : ''}
    <button class="btn big" data-act="close-media">Cancelar</button>
  </div>`);
}

function pickSwap(newKey) {
  if (!swapCtx || !EXERCISES[newKey]) return;
  const { where, di, ii } = swapCtx;
  swapCtx = null;
  h.closeDialog();
  if (where === 'wiz') {
    wiz.plan = swapExercise(wiz.plan, di, ii, newKey);
  } else if (where === 'plan') {
    store.setPlan(swapExercise(store.get().plan, di, ii, newKey));
  } else {
    h.swapInSession(ii, newKey);
    return;
  }
  h.render(true);
  h.toast('Ejercicio cambiado');
}

// ---------- resumen semanal ----------
export function renderWeek(prog) {
  const st = store.get();
  const ref = new Date();
  ref.setDate(ref.getDate() + weekOffset * 7);
  const sum = weekSummary(st.sessions, store.toISO(ref));
  const weekOver = sum.end < store.today();
  const plan = st.mode === 'plan' ? st.plan : null;
  const hasCardio = plan ? plannedCardio(plan) > 0 : st.mode === 'definicion';
  const recs = recommendations(sum, { goal: plan?.goal, perWeek: prog?.perWeek, hasCardio, weekOver });
  const arrow = { up: '↑', down: '↓', same: '=' };

  const changes = sum.changes.length
    ? `<ul class="sess-list">${sum.changes.map((c) => `<li><span><b class="dir ${c.dir}">${arrow[c.dir]}</b> ${h.esc(c.name)}</span><span>${h.esc(c.text)}</span></li>`).join('')}</ul>`
    : '<p class="muted small">Cuando repitas un ejercicio verás aquí si subiste, bajaste o te mantuviste.</p>';

  return `
    <section class="card">
      <div class="row between week-nav">
        <button class="icon-btn" data-act="week-prev" aria-label="Semana anterior">‹</button>
        <div class="center"><strong>${weekOffset === 0 ? 'Esta semana' : weekOffset === -1 ? 'Semana pasada' : 'Semana'}</strong>
          <p class="muted small">${h.fDate(sum.start)} – ${h.fDate(sum.end)}</p></div>
        <button class="icon-btn" data-act="week-next" aria-label="Semana siguiente" ${weekOffset >= 0 ? 'disabled' : ''}>›</button>
      </div>
      <div class="stats">
        <div><span>${sum.days}${prog?.perWeek ? `<small class="of"> / ${prog.perWeek}</small>` : ''}</span><small>Días entrenados</small></div>
        <div><span>${sum.strengthDays}</span><small>Días con fuerza</small></div>
        <div><span>${fmt(sum.cardioMin)}</span><small>Min de cardio</small></div>
      </div>
    </section>
    <section class="card">
      <h3>Para tener en cuenta</h3>
      <ul class="recs">${recs.map((r) => `<li>${h.esc(r)}</li>`).join('')}</ul>
    </section>
    ${sum.sessions ? `<section class="card">${musclesBlock(sum.setsByMuscle, 'Series hechas por grupo muscular', plan?.goal === 'musculo')}</section>` : ''}
    <section class="card">
      <h3>Cambios frente a la sesión anterior</h3>
      ${changes}
    </section>
    <p class="muted small center">El resumen solo cuenta lo que registras en la app. Guías generales (OMS): ${GUIDE.cardioMin}–${GUIDE.cardioMax} min semanales de actividad moderada y fortalecer los músculos ${GUIDE.strengthDays} o más días. No es una indicación médica.</p>`;
}

export function showWeek(offset = 0) { weekOffset = offset; }

// ---------- eventos ----------
// Devuelve true si la acción era de estas pantallas.
export function handleAction(act, el) {
  const st = store.get();
  const w = wiz;
  switch (act) {
    case 'wiz-goal':
      w.goal = el.dataset.v;
      if (!w.cardioSet) w.cardio = GOALS[w.goal].cardio === 'opcional' ? null : 'caminar';
      w.step = 2;
      break;
    case 'wiz-set': {
      const k = el.dataset.k;
      if (k === 'days') w.days = Number(el.dataset.v);
      else if (k === 'cardio') { w.cardio = el.dataset.v || null; w.cardioSet = true; }
      else if (k === 'level' || k === 'prefer') w[k] = el.dataset.v;
      break;
    }
    case 'wiz-toggle': {
      const list = w[el.dataset.k];
      const v = el.dataset.v;
      if (!Array.isArray(list)) break;
      if (list.includes(v)) list.splice(list.indexOf(v), 1); else list.push(v);
      // Si se evita el impacto, el cardio elegido no puede ser de impacto.
      if (w.cardio && !cardioChoices(w).includes(w.cardio)) w.cardio = GOALS[w.goal]?.cardio === 'opcional' ? null : 'caminar';
      break;
    }
    case 'wiz-preset':
      w.equipment = [...EQUIP_PRESETS[el.dataset.v].equip];
      break;
    case 'wiz-next':
      if (w.step === 4) w.plan = buildPlan(profileOf(w));
      w.step = Math.min(STEPS, w.step + 1);
      break;
    case 'wiz-back':
      w.step = Math.max(1, w.step - 1);
      break;
    case 'wiz-cancel':
      wiz = null;
      h.go('#/');
      return true;
    case 'wiz-save':
      if (st.draft) { h.toast('Termina o descarta la sesión en curso antes de cambiar el plan.'); return true; }
      store.setPlan(w.plan);
      wiz = null;
      h.go('#/');
      h.toast('Plan guardado');
      return true;
    case 'plan-edit':
      wiz = newWizard(st.plan);
      h.go('#/setup');
      return true;
    case 'use-plan':
      if (st.plan) { store.setMode('plan'); wiz = null; h.go('#/'); }
      return true;
    case 'swap':
      openSwap(el.dataset.where, Number(el.dataset.day), Number(el.dataset.i));
      return true;
    case 'swap-pick':
      pickSwap(el.dataset.ex);
      return true;
    case 'week-prev':
      weekOffset -= 1;
      break;
    case 'week-next':
      weekOffset = Math.min(0, weekOffset + 1);
      break;
    default:
      return false;
  }
  // Al cambiar de paso se vuelve arriba; al marcar opciones se conserva la posición.
  h.render(['wiz-set', 'wiz-toggle', 'wiz-preset', 'week-prev', 'week-next'].includes(act));
  return true;
}

// Pesos iniciales: se guardan al escribir.
export function handleInput(el) {
  if (el.dataset.f !== 'start') return false;
  store.setStartWeight(el.dataset.id, h.num(el.value));
  return true;
}

export function resetWizard() { wiz = null; }
