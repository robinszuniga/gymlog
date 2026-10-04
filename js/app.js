import * as store from './store.js';
import { EXERCISES, MODES, findDay } from './data.js';
import { suggest, suggestCardio, entriesFor, fmt } from './progression.js';
import { getImageUrl, cachedUrl, prefetchAll } from './images.js';
import { renderChart } from './chart.js';
import { GOALS, swapExercise } from './plan.js';
import * as planUi from './planUi.js';

const $app = document.getElementById('app');
const $nav = document.getElementById('tabbar');
const $toast = document.getElementById('toast');
const $media = document.getElementById('media');

const SERIES_LABEL = { fuerza: 'Fuerza', def: 'Definición', circuito: 'Circuito', core: 'Core', cardio: 'Cardio' };
const KIND_UNIT = { weight: 'kg', reps: 'reps', time: 's', cardio: 'min' };
const LEGACY_RANGE = { fuerza: [8, 10], def: [12, 15], circuito: [15, 15] };

// Nombre de una serie del historial: rutinas clásicas por nombre, planes por rango de repeticiones.
function seriesLabel(key) {
  if (SERIES_LABEL[key]) return SERIES_LABEL[key];
  const m = /^r(\d+)-(\d+)$/.exec(key || '');
  return m ? `${m[1]}–${m[2]} reps` : '';
}

let selectedDay = null; // día elegido cuando la rutina tiene varios días
let histTab = 'ex';
let chartPoints = [];

// ---------- utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const dateObj = (iso) => new Date(iso + 'T12:00:00');
const fDate = (iso, opts = { day: 'numeric', month: 'short' }) => dateObj(iso).toLocaleDateString('es', opts);
const fDateLong = (iso) => {
  const s = fDate(iso, { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const daysBetween = (a, b) => Math.round((dateObj(b) - dateObj(a)) / 86400000);

function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $toast.classList.remove('show'), 2600);
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// Rutina activa: el plan por objetivo o una de las rutinas clásicas.
function program(st, mode = st.mode) {
  if (mode === 'plan' && st.plan) {
    return { key: 'plan', label: GOALS[st.plan.goal].label, perWeek: st.plan.daysPerWeek, days: st.plan.days };
  }
  return MODES[mode] ? { key: mode, ...MODES[mode] } : null;
}

function dayOf(st, mode, dayId) {
  return program(st, mode)?.days.find((d) => d.id === dayId) || null;
}

// Lo que pide el ejercicio número idx de la sesión. Las sesiones nuevas lo llevan guardado
// (así no se rompen si el plan cambia); las anteriores lo buscan en la rutina clásica.
function itemOf(d, idx) {
  return d.entries[idx]?.item || findDay(d.mode, d.dayId)?.items[idx];
}

function modeLabel(st, mode) {
  if (mode === 'plan') return st.plan ? GOALS[st.plan.goal].label : 'Plan';
  return MODES[mode]?.label || mode;
}

function restFor(mode, item) {
  const s = store.get().settings;
  if (mode === 'plan') return s.rest_plan || item?.rest || 75;
  return s['rest_' + mode] || MODES[mode]?.rest || 75;
}

function thumb(exKey, cls = 'thumb') {
  const name = EXERCISES[exKey]?.name || '';
  return `<button class="${cls}" data-act="media" data-ex="${exKey}" aria-label="Ver cómo se hace: ${esc(name)}">
    <span class="thumb-fallback" aria-hidden="true">${esc(name.slice(0, 2))}</span></button>`;
}

// Pone las imágenes (desde el caché o la API) en todos los .thumb de la pantalla.
function hydrateImages(root = $app) {
  root.querySelectorAll('[data-ex]:not([data-img])').forEach((el) => {
    if (!el.matches('.thumb, .thumb-lg')) return;
    el.dataset.img = '1';
    const key = el.dataset.ex;
    const put = (url) => {
      if (!url) { el.classList.add('no-img'); return; }
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.onload = () => el.classList.add('has-img');
      img.onerror = () => { img.remove(); el.classList.add('no-img'); };
      img.src = url;
      el.appendChild(img);
    };
    const hit = cachedUrl(key);
    if (hit) put(hit);
    else getImageUrl(key).then(put);
  });
}

function setsText(entry) {
  if (entry.kind === 'cardio') return `${fmt(entry.minutes)} min`;
  const sets = (entry.sets || []).filter((s) => s.done);
  if (!sets.length) return '—';
  if (entry.kind === 'time') return sets.map((s) => `${fmt(s.reps)} s`).join(' · ');
  const kgs = sets.map((s) => Number(s.kg) || 0);
  const same = kgs.every((k) => k === kgs[0]);
  if (same && kgs[0] === 0) return `${sets.map((s) => s.reps).join(' · ')} reps`;
  if (same) return `${fmt(kgs[0])} kg × ${sets.map((s) => s.reps).join(' · ')}`;
  return sets.map((s) => `${fmt(s.kg || 0)}×${s.reps}`).join(' · ');
}

// Día que sigue en una rutina de varios días, según la última sesión hecha con esa rutina.
function nextDay(sessions, prog) {
  const days = prog.days;
  const last = [...sessions].reverse().find((s) => s.mode === prog.key && days.some((d) => d.id === s.dayId));
  if (!last) return days[0].id;
  const i = days.findIndex((d) => d.id === last.dayId);
  return days[(i + 1) % days.length].id;
}

function mondayOf(d) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// ---------- render principal ----------
// keepScroll: true cuando se redibuja la misma pantalla (marcar una opción) y no hay que volver arriba.
function render(keepScroll = false) {
  const st = store.get();
  const [, page, arg] = (location.hash.slice(1) || '/').split('/');
  const y = keepScroll === true ? window.scrollY : 0;

  if (!st.mode || !program(st) || page === 'setup') {
    // Primera vez (o al cambiar de plan): asistente para armar la rutina según el objetivo.
    $nav.hidden = true;
    $app.innerHTML = planUi.renderSetup();
  } else if (page === 'session') {
    $nav.hidden = true;
    if (!st.draft) return go('#/');
    renderSession();
  } else {
    $nav.hidden = false;
    if (page === 'history' && arg) renderExercise(arg);
    else if (page === 'history') renderHistory();
    else if (page === 'settings') renderSettings();
    else if (page === 'plan') $app.innerHTML = planUi.renderPlan();
    else renderHome();
    const tab = page === 'plan' ? 'home' : (page || 'home');
    $nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.page === tab));
  }
  hydrateImages();
  window.scrollTo(0, y);
}

function modeSwitch(current) {
  return `<div class="seg" role="tablist" aria-label="Modo de entrenamiento">
    ${Object.entries(MODES).map(([k, m]) => `<button role="tab" aria-selected="${k === current}" class="${k === current ? 'on' : ''}" data-act="set-mode" data-mode="${k}">${m.label}</button>`).join('')}
  </div>`;
}

// ---------- inicio ----------
function renderHome() {
  const st = store.get();
  const mode = program(st);
  const t = store.today();
  const monday = store.toISO(mondayOf(new Date()));
  const weekDates = new Set(st.sessions.filter((s) => s.date >= monday && s.date <= t).map((s) => s.date));
  const trainedToday = st.sessions.some((s) => s.date === t);

  let draftHtml = '';
  if (st.draft) {
    const dr = st.draft;
    const name = dr.dayName || findDay(dr.mode, dr.dayId)?.name || '';
    draftHtml = `<section class="card draft">
      <p class="eyebrow">${dr.editing ? 'Corrección sin guardar' : 'Sesión sin terminar'}</p>
      <h2>${esc(name)}</h2>
      <p class="muted">${esc(modeLabel(st, dr.mode))} · ${fDate(dr.date)}</p>
      <div class="row">
        <button class="btn primary grow" data-act="continue">Continuar</button>
        <button class="btn ghost" data-act="discard">Descartar</button>
      </div>
    </section>`;
  }

  let today;
  if (mode.days.length === 1) {
    const day = mode.days[0];
    const lastF = [...st.sessions].reverse().find((s) => s.mode === 'fuerza');
    const hint = st.mode === 'fuerza' && lastF && daysBetween(lastF.date, t) === 1
      ? '<p class="hint">Entrenaste fuerza ayer. Lo ideal es dejar un día de descanso entre sesiones.</p>' : '';
    today = `<section class="card">
      <p class="eyebrow">Hoy</p>
      <h2>${esc(day.name)}</h2>
      <p class="muted">${day.items.map((i) => esc(EXERCISES[i.ex].name)).join(' · ')}</p>
      ${hint}
      <button class="btn primary big" data-act="start" data-day="${day.id}" ${st.draft ? 'disabled' : ''}>Empezar entrenamiento</button>
    </section>`;
  } else {
    const next = nextDay(st.sessions, mode);
    if (!selectedDay || !mode.days.some((d) => d.id === selectedDay)) selectedDay = next;
    const day = mode.days.find((d) => d.id === selectedDay);
    today = `<section class="card">
      <p class="eyebrow">${selectedDay === next ? 'Te toca' : 'Elegiste'}</p>
      <h2>${esc(day.name)}</h2>
      <div class="chips" role="radiogroup" aria-label="Día de la rutina" style="grid-template-columns:repeat(${mode.days.length},1fr)">
        ${mode.days.map((d, i) => `<button role="radio" aria-checked="${d.id === selectedDay}" class="chip ${d.id === selectedDay ? 'on' : ''}" data-act="pick-day" data-day="${d.id}">${i + 1}<small>${esc(d.short)}</small></button>`).join('')}
      </div>
      <ul class="plan">${day.items.map((i) => `<li>${esc(EXERCISES[i.ex].name)}<span>${target(i)}</span></li>`).join('')}</ul>
      <button class="btn primary big" data-act="start" data-day="${day.id}" ${st.draft ? 'disabled' : ''}>Empezar ${esc(day.short)}</button>
    </section>`;
  }

  // Rutina activa: en un plan por objetivo se muestra el plan; en las clásicas, el selector de siempre.
  const routine = st.mode === 'plan'
    ? `<section class="card plan-card"><div class="row between">
        <div><p class="eyebrow">Tu plan</p><strong>${esc(mode.label)} · ${mode.perWeek} días</strong></div>
        <a class="btn ghost small" href="#/plan">Ver o cambiar</a></div></section>`
    : `${modeSwitch(st.mode)}
      <p class="plan-link"><a class="link" href="#/plan">Crear un plan según mi objetivo ›</a></p>`;

  $app.innerHTML = `
    <header class="top"><h1 class="brand">GymLog</h1>${trainedToday ? '<span class="pill ok">✓ Hoy entrenaste</span>' : ''}</header>
    ${routine}
    ${draftHtml}
    ${today}
    <section class="card">
      <div class="row between"><h3>Esta semana</h3><span class="big-num">${weekDates.size}<small> / ${mode.perWeek}</small></span></div>
      ${calendarStrip(st.sessions)}
      <p class="plan-link"><a class="link" href="#/history" data-tab="week">Ver resumen de la semana ›</a></p>
    </section>
    ${recent(st.sessions)}`;
}

function target(item) {
  const ex = EXERCISES[item.ex];
  if (ex.kind === 'cardio') return item.min === item.max ? `${item.min} min` : `${item.min}–${item.max} min`;
  if (item.repMin == null) return `${item.sets} series`;
  const sets = item.sets === item.setsMax ? item.sets : `${item.sets}–${item.setsMax}`;
  const reps = item.repMin === item.repMax ? item.repMin : `${item.repMin}–${item.repMax}`;
  return `${sets} × ${reps}${ex.kind === 'time' ? ' s' : ''}`;
}

function calendarStrip(sessions) {
  const byDate = {};
  sessions.forEach((s) => { byDate[s.date] = s.mode; });
  const t = store.today();
  const start = mondayOf(new Date());
  start.setDate(start.getDate() - 21);
  const heads = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="cal-h">${d}</span>`).join('');
  let cells = '';
  for (let i = 0; i < 28; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = store.toISO(d);
    const m = byDate[iso];
    const cls = ['cal-d', m ? 'm-' + m : '', iso === t ? 'today' : '', iso > t ? 'future' : ''].join(' ');
    cells += `<span class="${cls}" title="${fDate(iso)}">${d.getDate()}</span>`;
  }
  return `<div class="cal" aria-label="Días entrenados en las últimas 4 semanas">${heads}${cells}</div>
    <div class="legend"><span class="lg m-fuerza"></span>Fuerza <span class="lg m-definicion"></span>Definición${sessions.some((s) => s.mode === 'plan') || store.get().mode === 'plan' ? ' <span class="lg m-plan"></span>Plan' : ''}</div>`;
}

function recent(sessions) {
  const last = [...sessions].reverse().slice(0, 3);
  if (!last.length) return '<section class="card"><p class="muted center">Cuando termines tu primera sesión aparecerá aquí.</p></section>';
  return `<section class="card"><div class="row between"><h3>Últimas sesiones</h3><a href="#/history" class="link" data-tab="sessions">Ver todo</a></div>
    ${last.map((s) => `<div class="mini-sess"><strong>${fDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}</strong><span>${esc(s.dayName)}</span></div>`).join('')}
  </section>`;
}

// ---------- sesión en curso ----------
// Lo que pide un ejercicio, con el peso inicial que eligió la persona (si lo hay).
function withStart(st, item) {
  const start = st.startWeights?.[store.startId(item.ex, item.key)];
  return start > 0 ? { ...item, start } : { ...item };
}

// Arma el registro de un ejercicio para la sesión, ya con los valores sugeridos.
function entryFor(st, rawItem) {
  const item = withStart(st, rawItem);
  const kind = EXERCISES[item.ex].kind;
  if (kind === 'cardio') {
    return { ex: item.ex, key: 'cardio', kind, minutes: suggestCardio(st.sessions, item).minutes, done: false, item };
  }
  const s = suggest(st.sessions, item, kind);
  const val = kind === 'time' ? s.reps : item.repMax;
  // En los planes por objetivo la persona decide si acepta el cambio de peso: se parte del
  // último peso usado y el cambio se aplica con un toque. Las rutinas clásicas siguen igual.
  const proposed = item.adaptive && (s.type === 'up' || s.type === 'down') ? s.lastKg : s.kg;
  const kg = kind === 'time' ? '' : (proposed ?? '');
  return {
    ex: item.ex, key: item.key, kind, item,
    sets: Array.from({ length: item.sets }, () => ({ kg, reps: val, done: false })),
  };
}

function newDraft(mode, dayId) {
  const st = store.get();
  const day = dayOf(st, mode, dayId);
  return {
    id: store.uid(),
    mode,
    dayId,
    dayName: day.name,
    date: store.today(),
    createdAt: Date.now(),
    entries: day.items.map((item) => entryFor(st, item)),
  };
}

// Convierte una sesión terminada en una sesión editable, para corregir errores.
function draftFromSession(s) {
  const itemFromEntry = (e) => {
    if (e.kind === 'cardio') return { ex: e.ex, key: 'cardio', min: e.minutes, max: e.minutes };
    const m = /^r(\d+)-(\d+)$/.exec(e.key);
    const range = e.repMin != null && e.repMax != null ? [e.repMin, e.repMax]
      : m ? [Number(m[1]), Number(m[2])] : LEGACY_RANGE[e.key];
    const n = e.planSets || e.sets.length;
    return { ex: e.ex, key: e.key, sets: n, setsMax: Math.max(n, e.sets.length) + 2, repMin: range?.[0], repMax: range?.[1] };
  };
  return {
    id: s.id, editing: true, mode: s.mode, dayId: s.dayId, dayName: s.dayName, date: s.date, createdAt: s.createdAt,
    entries: s.entries.map((e) => {
      const item = itemFromEntry(e);
      if (e.kind === 'cardio') return { ex: e.ex, key: e.key, kind: e.kind, minutes: e.minutes, done: true, item };
      return { ex: e.ex, key: e.key, kind: e.kind, item, sets: e.sets.map((x) => ({ kg: e.kind === 'time' ? '' : x.kg, reps: x.reps, done: true })) };
    }),
  };
}

// Cambia un ejercicio durante la sesión (y en el plan, si la sesión viene del plan actual).
function swapInSession(i, newKey) {
  const st = store.get();
  const d = st.draft;
  const old = d.entries[i];
  if (!old || d.editing) return;
  const di = st.plan ? st.plan.days.findIndex((x) => x.id === d.dayId) : -1;
  let item;
  if (d.mode === 'plan' && di >= 0 && st.plan.days[di].items[i]?.ex === old.ex) {
    const plan = swapExercise(st.plan, di, i, newKey);
    store.setPlan(plan);
    item = plan.days[di].items[i];
  } else {
    const tmp = { goal: st.plan?.goal || 'general', level: st.plan?.level || 'principiante', days: [{ items: [old.item] }] };
    item = swapExercise(tmp, 0, 0, newKey).days[0].items[0];
  }
  d.entries[i] = entryFor(st, item);
  store.setDraft(d);
  rerenderSession();
  toast('Ejercicio cambiado en tu plan');
}

function renderSession() {
  const st = store.get();
  const d = st.draft;
  const name = d.dayName || findDay(d.mode, d.dayId)?.name || '';
  let groupShown = false;

  const cards = d.entries.map((e, idx) => {
    const item = withStart(st, itemOf(d, idx));
    let head = '';
    if (item.group === 'circuito' && !groupShown) {
      groupShown = true;
      head = `<div class="group-head"><strong>Circuito · 3 rondas × 15 reps</strong><span>Haz los 4 ejercicios seguidos, descansa y repite.</span></div>`;
    }
    return head + (e.kind === 'cardio' ? cardioCard(e, idx, item, st.sessions, d) : exerciseCard(e, idx, item, st.sessions, d));
  }).join('');

  const restNote = d.mode === 'plan' && !st.settings.rest_plan
    ? 'El descanso se ajusta a cada ejercicio'
    : `Descanso sugerido: ${restFor(d.mode)} s`;

  $app.innerHTML = `
    <header class="topbar">
      <a href="#/" class="icon-btn" aria-label="Volver al inicio">←</a>
      <div class="grow">
        <h1>${d.editing ? 'Corregir sesión' : esc(name)}</h1>
        <label class="date-lbl">Fecha <input type="date" data-f="date" value="${esc(d.date)}" max="${store.today()}"></label>
      </div>
      <button class="icon-btn" data-act="discard" aria-label="${d.editing ? 'Descartar cambios' : 'Descartar sesión'}">✕</button>
    </header>
    <main class="session">
      ${d.editing ? `<p class="hint">Estás corrigiendo: ${esc(name)}. Cambia los números o desmarca las series que no hiciste y guarda.</p>` : ''}
      ${cards}
      ${d.editing ? '' : `<p class="muted center small">${restNote} · Toca la imagen para ver la técnica.</p>`}
    </main>
    <div class="bottom-bar">
      <div id="timer" class="timer" hidden></div>
      <button class="btn primary big" data-act="finish">${d.editing ? '✓ Guardar cambios' : '✓ Terminar · Hoy entrené'}</button>
    </div>`;
  paintTimer();
  keepAwake();
}

function exerciseCard(e, idx, item, sessions, d) {
  const ex = EXERCISES[e.ex];
  const editing = !!d.editing;
  const s = editing ? null : suggest(sessions, item, e.kind);
  const last = editing ? null : entriesFor(sessions, e.ex, item.key)[0];
  const isTime = e.kind === 'time';
  const icon = s && { up: '↑', keep: '=', new: '★', down: '↓' }[s.type];
  const allDone = e.sets.length && e.sets.every((x) => x.done);
  const anyDone = e.sets.some((x) => x.done);
  const minSets = editing ? 1 : item.sets;

  // Aceptar o no el cambio de peso sugerido: dos botones, se resalta el que está aplicado.
  let choice = '';
  if (s && !isTime && (s.type === 'up' || s.type === 'down') && s.lastKg != null && s.kg !== s.lastKg && !allDone) {
    const cur = num(e.sets.find((x) => !x.done)?.kg);
    const btn = (kg, label) => `<button class="btn small ${cur === kg ? 'primary' : 'ghost'}" aria-pressed="${cur === kg}" data-act="apply-kg" data-i="${idx}" data-kg="${kg}">${label} ${fmt(kg)} kg</button>`;
    choice = `<div class="row choice">${btn(s.kg, s.type === 'up' ? 'Subir a' : 'Bajar a')}${btn(s.lastKg, 'Mantener')}</div>`;
  }

  const rows = e.sets.map((set, si) => `
    <div class="set-row ${set.done ? 'done' : ''}">
      <span class="n">${si + 1}</span>
      ${isTime ? '' : `<input class="num" type="text" inputmode="decimal" autocomplete="off" data-f="kg" data-i="${idx}" data-s="${si}" value="${esc(set.kg)}" placeholder="${e.kind === 'reps' ? '0' : 'kg'}" aria-label="Peso serie ${si + 1} en kg">`}
      <input class="num" type="text" inputmode="numeric" autocomplete="off" data-f="reps" data-i="${idx}" data-s="${si}" value="${esc(set.reps)}" aria-label="${isTime ? 'Segundos' : 'Repeticiones'} serie ${si + 1}">
      ${isTime ? `<button class="play" data-act="plank" data-i="${idx}" data-s="${si}" aria-label="Iniciar cronómetro serie ${si + 1}" ${set.done ? 'disabled' : ''}>▶</button>` : ''}
      <button class="check" data-act="toggle" data-i="${idx}" data-s="${si}" aria-pressed="${set.done}" aria-label="Serie ${si + 1} hecha">✓</button>
    </div>`).join('');

  return `<section class="card ex-card ${allDone ? 'complete' : ''}" id="ex-${idx}">
    <div class="ex-head">
      ${thumb(e.ex)}
      <div class="ex-info">
        <h2>${esc(ex.name)}</h2>
        <p class="target">${editing ? editTarget(item, isTime) : `${target(item)}${isTime ? '' : ' reps'}`}</p>
        ${s ? `<span class="sug sug-${s.type}">${icon} ${esc(s.text)}</span>` : ''}
      </div>
    </div>
    ${s ? `<p class="sug-detail">${esc(s.detail)}</p>` : ''}
    ${choice}
    ${last ? `<p class="last">Última (${fDate(last.date)}): <strong>${esc(setsText(last))}</strong></p>` : ''}
    <div class="sets ${isTime ? 'time' : ''}">
      <div class="set-row head"><span>Serie</span>${isTime ? '' : `<span>${e.kind === 'reps' ? 'kg (opc.)' : 'kg'}</span>`}<span>${isTime ? 'seg' : 'reps'}</span>${isTime ? '<span></span>' : ''}<span></span></div>
      ${rows}
    </div>
    ${item.setsMax > item.sets || e.sets.length > minSets ? `<div class="row">
      ${e.sets.length < item.setsMax ? `<button class="btn ghost small" data-act="add-set" data-i="${idx}">+ Serie</button>` : ''}
      ${e.sets.length > minSets ? `<button class="btn ghost small" data-act="del-set" data-i="${idx}">− Serie</button>` : ''}
    </div>` : ''}
    ${swapLink(d, idx, anyDone)}
  </section>`;
}

// Al corregir una sesión solo se recuerda el rango que se pedía (si se conoce).
function editTarget(item, isTime) {
  if (item.repMin == null) return 'Sesión registrada';
  const range = item.repMin === item.repMax ? item.repMin : `${item.repMin}–${item.repMax}`;
  return `Se pedían ${range} ${isTime ? 's' : 'reps'}`;
}

// En un plan por objetivo se puede cambiar el ejercicio antes de empezarlo.
function swapLink(d, idx, started) {
  if (d.mode !== 'plan' || d.editing || started) return '';
  return `<p class="plan-link"><button class="link-btn" data-act="swap" data-where="session" data-i="${idx}">Cambiar este ejercicio</button></p>`;
}

function cardioCard(e, idx, item, sessions, d) {
  const ex = EXERCISES[e.ex];
  const s = !d.editing && item.progressive ? suggestCardio(sessions, item) : null;
  const icon = s && { up: '↑', keep: '=', new: '★' }[s.type];
  return `<section class="card ex-card ${e.done ? 'complete' : ''}" id="ex-${idx}">
    <div class="ex-head">
      ${thumb(e.ex)}
      <div class="ex-info">
        <h2>${esc(ex.name)}</h2>
        <p class="target">${target(item)}</p>
        ${s && s.type !== 'new' ? `<span class="sug sug-${s.type}">${icon} ${esc(s.text)}</span>` : ''}
      </div>
    </div>
    <p class="sug-detail">${esc(s ? s.detail : ex.tips[0])}</p>
    <div class="set-row cardio ${e.done ? 'done' : ''}">
      <span class="n">min</span>
      <input class="num" type="text" inputmode="numeric" data-f="minutes" data-i="${idx}" value="${esc(e.minutes)}" aria-label="Minutos">
      <button class="check wide" data-act="toggle-cardio" data-i="${idx}" aria-pressed="${e.done}">${e.done ? '✓ Hecho' : 'Marcar hecho'}</button>
    </div>
    ${swapLink(d, idx, e.done)}
  </section>`;
}

function finishSession() {
  const st = store.get();
  const d = st.draft;
  const dayName = d.dayName || findDay(d.mode, d.dayId)?.name || '';
  const entries = d.entries.map((e, idx) => {
    if (e.kind === 'cardio') return e.done ? { ex: e.ex, key: e.key, kind: e.kind, minutes: num(e.minutes) || 0 } : null;
    const sets = e.sets.filter((s) => s.done).map((s) => ({ kg: num(s.kg) || 0, reps: num(s.reps) || 0, done: true }));
    if (!sets.length) return null;
    // Se guarda lo que pedía el plan, para poder corregir la sesión más adelante.
    const item = itemOf(d, idx) || {};
    const goal = item.repMin != null ? { planSets: item.sets, repMin: item.repMin, repMax: item.repMax } : {};
    return { ex: e.ex, key: e.key, kind: e.kind, sets, ...goal };
  }).filter(Boolean);

  if (!entries.length) {
    toast(d.editing
      ? 'Deja al menos una serie marcada. Para quitar la sesión completa, bórrala desde el historial.'
      : 'Marca con ✓ al menos una serie antes de terminar.');
    return;
  }
  const session = { id: d.id, date: d.date, mode: d.mode, dayId: d.dayId, dayName, entries };
  stopTimer();
  releaseAwake();
  selectedDay = null;
  if (d.editing) {
    // Corrección: reemplaza la sesión original y conserva su orden dentro del día.
    store.updateSession({ ...session, createdAt: d.createdAt });
    histTab = 'sessions';
    go('#/history');
    toast('Sesión corregida');
    return;
  }
  store.addSession({ ...session, createdAt: Date.now() });
  go('#/');
  toast('¡Listo! Sesión guardada 💪');
}

// ---------- temporizador (descanso y cronómetro de plancha) ----------
// label: texto que se muestra · onDone: qué hacer al llegar a 0 · noAdd: ocultar "+15 s"
const timer = { end: 0, total: 0, id: 0, label: 'Descanso', onDone: null, noAdd: false };

function startTimer(sec, label = 'Descanso', onDone = null, noAdd = false) {
  timer.total = sec;
  timer.end = Date.now() + sec * 1000;
  timer.label = label;
  timer.onDone = onDone;
  timer.noAdd = noAdd;
  clearInterval(timer.id);
  timer.id = setInterval(paintTimer, 250);
  paintTimer();
}

function stopTimer() {
  clearInterval(timer.id);
  timer.end = 0;
  timer.onDone = null;
  paintTimer();
  const el = document.getElementById('timer');
  if (el) el.innerHTML = '';
}

// Solo se actualizan texto y barra (no se recrean los botones, para que no se pierdan toques).
function paintTimer() {
  const el = document.getElementById('timer');
  if (!el) return;
  if (!timer.end) { el.hidden = true; el.classList.remove('over'); return; }
  el.hidden = false;
  if (!el.firstElementChild) {
    el.innerHTML = `<div class="t-bar"></div><span class="t-txt"></span>
      <button class="btn ghost small" data-act="timer-add">+15 s</button>
      <button class="btn ghost small" data-act="timer-stop">Saltar</button>`;
  }
  const txt = el.querySelector('.t-txt');
  const bar = el.querySelector('.t-bar');
  const add = el.querySelector('[data-act="timer-add"]');
  const left = Math.ceil((timer.end - Date.now()) / 1000);
  if (left <= 0) {
    if (timer.onDone) {
      const fn = timer.onDone;
      timer.onDone = null;
      alertEnd();
      fn();
      return;
    }
    if (!el.classList.contains('over')) {
      el.classList.add('over');
      alertEnd();
      const end = timer.end;
      setTimeout(() => { if (timer.end === end) stopTimer(); }, 4000);
    }
    txt.textContent = '¡A la siguiente serie!';
    bar.style.width = '0%';
    add.hidden = true;
    return;
  }
  el.classList.remove('over');
  add.hidden = timer.noAdd;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  txt.innerHTML = `${esc(timer.label)} <strong>${mm}:${ss}</strong>`;
  bar.style.width = `${Math.max(0, Math.min(100, (left / timer.total) * 100))}%`;
}

function alertEnd() {
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* no soportado */ }
  beep();
}

// Cronómetro de plancha: 5 s para acomodarse, luego los segundos de la serie.
// Al terminar marca la serie como hecha y arranca el descanso.
function startPlank(i, si) {
  const d = store.get().draft;
  const secs = Math.round(num(d.entries[i].sets[si].reps) || 30);
  unlockAudio();
  const finish = () => {
    const dd = store.get().draft;
    const set = dd?.entries[i]?.sets[si];
    if (!set) return;
    set.done = true;
    set.reps = secs;
    store.setDraft(dd);
    if (location.hash.startsWith('#/session')) rerenderSession();
    if (!dd.editing) startTimer(restFor(dd.mode, itemOf(dd, i)));
  };
  startTimer(5, 'Prepárate', () => startTimer(secs, 'Plancha', finish, true), true);
}

function rerenderSession() {
  const y = window.scrollY;
  renderSession();
  hydrateImages();
  window.scrollTo(0, y);
}

let audioCtx;
// En iPhone el sonido solo se habilita después de un toque del usuario.
function unlockAudio() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* sin audio */ }
}

function beep() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.25, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.5);
  } catch { /* sin audio */ }
}

// Mantener la pantalla encendida durante la sesión (si el teléfono lo permite).
let wakeLock = null;
async function keepAwake() {
  try {
    if (!wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { /* no disponible */ }
}
function releaseAwake() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

// ---------- historial ----------
function renderHistory() {
  const st = store.get();
  const tabs = `<div class="seg">
    <button class="${histTab === 'week' ? 'on' : ''}" data-act="hist-tab" data-tab="week">Semana</button>
    <button class="${histTab === 'ex' ? 'on' : ''}" data-act="hist-tab" data-tab="ex">Ejercicios</button>
    <button class="${histTab === 'sessions' ? 'on' : ''}" data-act="hist-tab" data-tab="sessions">Sesiones</button>
  </div>`;

  let body;
  if (histTab === 'week') {
    body = planUi.renderWeek(program(st));
  } else if (!st.sessions.length) {
    body = '<section class="card"><p class="muted center">Todavía no hay sesiones guardadas.</p></section>';
  } else if (histTab === 'ex') {
    const rows = Object.keys(EXERCISES).map((k) => {
      const hist = entriesFor(st.sessions, k);
      if (!hist.length) return '';
      return `<a class="ex-row" href="#/history/${k}">
        ${thumb(k)}
        <span class="grow"><strong>${esc(EXERCISES[k].name)}</strong>
        <small>${fDate(hist[0].date)} · ${esc(setsText(hist[0]))}</small></span>
        <span class="count">${hist.length}<small>ses.</small></span>
      </a>`;
    }).join('');
    body = `<section class="card list">${rows}</section>`;
  } else {
    body = [...st.sessions].reverse().map((s) => `
      <section class="card sess">
        <div class="row between">
          <div class="grow"><strong>${esc(fDateLong(s.date))}</strong><p class="muted small">${esc(MODES[s.mode]?.label || 'Plan')} · ${esc(s.dayName)}</p></div>
          <button class="icon-btn" data-act="edit-session" data-id="${esc(s.id)}" aria-label="Corregir sesión">✎</button>
          <button class="icon-btn danger" data-act="del-session" data-id="${esc(s.id)}" aria-label="Borrar sesión">🗑</button>
        </div>
        <ul class="sess-list">${s.entries.map((e) => `<li><span>${esc(EXERCISES[e.ex]?.name || e.ex)}</span><span>${esc(setsText(e))}</span></li>`).join('')}</ul>
      </section>`).join('');
  }

  $app.innerHTML = `<header class="top"><h1>Historial</h1></header>${tabs}${body}`;
}

function metricOf(e) {
  if (e.kind === 'cardio') return { v: Number(e.minutes) || 0, unit: 'min', label: 'Minutos' };
  const done = (e.sets || []).filter((s) => s.done);
  if (e.kind === 'time') return { v: Math.max(0, ...done.map((s) => Number(s.reps) || 0)), unit: 's', label: 'Mejor serie (segundos)' };
  const kg = Math.max(0, ...done.map((s) => Number(s.kg) || 0));
  if (kg === 0) return { v: Math.max(0, ...done.map((s) => Number(s.reps) || 0)), unit: 'reps', label: 'Mejor serie (reps)' };
  return { v: kg, unit: 'kg', label: 'Peso máximo por sesión (kg)' };
}

function renderExercise(key) {
  const ex = EXERCISES[key];
  if (!ex) return go('#/history');
  const hist = entriesFor(store.get().sessions, key);
  const usesKg = hist.some((e) => metricOf(e).unit === 'kg');
  // Si alguna vez usó peso, el gráfico muestra kg; si no, reps / segundos / minutos.
  const pts = hist.map((e) => ({ ...e, m: metricOf(e) })).filter((e) => !usesKg || e.m.unit === 'kg');
  // Color de cada serie: las rutinas clásicas tienen el suyo; los rangos de los planes rotan entre tres.
  const planKeys = [...new Set(hist.map((e) => e.key).filter((k) => !SERIES_LABEL[k]))];
  const clsOf = (k) => (SERIES_LABEL[k] ? k : `p${planKeys.indexOf(k) % 3}`);
  const labels = {};
  hist.forEach((e) => { labels[clsOf(e.key)] = seriesLabel(e.key); });
  chartPoints = pts.map((e) => ({ date: e.date, value: e.m.v, series: clsOf(e.key), label: setsText(e), unit: e.m.unit })).reverse();
  const unit = pts[0]?.m.unit || KIND_UNIT[ex.kind];
  const label = pts[0]?.m.label || '';
  const series = [...new Set(chartPoints.map((p) => p.series))];
  const best = pts.length ? Math.max(...pts.map((e) => e.m.v)) : 0;
  const lastP = chartPoints[chartPoints.length - 1];
  // Progreso dentro de la misma rutina que el último registro (no mezcla fuerza con definición).
  const first = lastP && chartPoints.find((p) => p.series === lastP.series);
  const diff = first ? lastP.value - first.value : 0;

  $app.innerHTML = `
    <header class="topbar"><a href="#/history" class="icon-btn" aria-label="Volver">←</a><h1 class="grow">${esc(ex.name)}</h1></header>
    <section class="card">
      <div class="ex-head">
        ${thumb(key, 'thumb-lg')}
        <ul class="tips">${ex.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
    </section>
    <section class="card">
      <h3>${esc(label)}</h3>
      <p class="readout" id="readout">${lastP ? `${fDate(lastP.date)} · <strong>${fmt(lastP.value)} ${unit}</strong> · ${esc(lastP.label)}` : ''}</p>
      <div id="chart">${renderChart(chartPoints, unit)}</div>
      ${series.length > 1 ? `<div class="legend">${series.map((s) => `<span class="lg s-${s}"></span>${esc(labels[s])}`).join(' ')}</div>` : ''}
      <div class="stats">
        <div><span>${fmt(best)}</span><small>Mejor (${unit})</small></div>
        <div><span>${hist.length}</span><small>Sesiones</small></div>
        <div><span>${diff > 0 ? '+' : ''}${fmt(diff)}</span><small>Desde el inicio</small></div>
      </div>
    </section>
    <section class="card">
      <h3>Registros</h3>
      <ul class="sess-list">${hist.map((e) => `<li><span>${fDate(e.date)} <small class="tag s-${clsOf(e.key)}">${esc(seriesLabel(e.key))}</small></span><span>${esc(setsText(e))}</span></li>`).join('') || '<li class="muted">Sin registros</li>'}</ul>
    </section>`;
}

// ---------- ajustes ----------
// Días desde la última copia exportada (Infinity si nunca se ha hecho).
function backupAge(st) {
  return st.settings.lastExport ? daysBetween(st.settings.lastExport, store.today()) : Infinity;
}

function backupText(st) {
  const age = backupAge(st);
  if (age === Infinity) return st.sessions.length ? 'Todavía no has exportado una copia.' : 'Cuando tengas sesiones guardadas, exporta una copia de vez en cuando.';
  if (age <= 0) return 'Última copia exportada: hoy.';
  return `Última copia exportada: hace ${age} ${age === 1 ? 'día' : 'días'}.${age > 30 ? ' Conviene hacer una nueva.' : ''}`;
}

function renderSettings() {
  const st = store.get();
  const restBtns = (mode, opts) => `<div class="seg small">${opts.map((s) => `<button class="${restFor(mode) === s ? 'on' : ''}" data-act="set-rest" data-mode="${mode}" data-sec="${s}">${s} s</button>`).join('')}</div>`;
  $app.innerHTML = `
    <header class="top"><h1>Ajustes</h1></header>
    <section class="card">
      <h3>Tu rutina</h3>
      <p><strong>${esc(st.mode === 'plan' ? `${modeLabel(st, 'plan')} · ${st.plan.daysPerWeek} días por semana` : `${modeLabel(st, st.mode)} clásica`)}</strong></p>
      <a class="btn" href="#/plan">Ver o cambiar el plan</a>
    </section>
    <section class="card">
      <h3>Descanso entre series</h3>
      ${st.plan ? `<p class="muted small">Plan por objetivo</p>
      <div class="seg small">${[[0, 'Auto'], [60, '60 s'], [90, '90 s'], [120, '120 s'], [180, '180 s']].map(([s, label]) => `<button class="${(st.settings.rest_plan || 0) === s ? 'on' : ''}" data-act="set-rest" data-mode="plan" data-sec="${s}">${label}</button>`).join('')}</div>` : ''}
      <p class="muted small">Fuerza clásica</p>${restBtns('fuerza', [60, 90, 120, 180])}
      <p class="muted small">Definición clásica</p>${restBtns('definicion', [45, 60, 75])}
    </section>
    <section class="card">
      <h3>Imágenes sin internet</h3>
      <p class="muted small">Descarga una vez las imágenes con wifi para verlas en el gym sin datos.</p>
      <button class="btn" data-act="prefetch" id="prefetch-btn">Descargar imágenes</button>
    </section>
    <section class="card">
      <h3>Tus datos</h3>
      <ul class="tips">
        <li>Tu plan, tus pesos y tus sesiones se guardan <strong>solo en este teléfono</strong>, dentro de este navegador. No hay cuenta ni se envían a ningún servidor.</li>
        <li>Si borras los datos del navegador, desinstalas la app o cambias de teléfono, se pierden.</li>
        <li><strong>Exportar</strong> descarga un archivo con todo. Guárdalo en tu correo o en la nube. Con <strong>Importar</strong> lo recuperas en este u otro teléfono (reemplaza lo que haya).</li>
        <li>Internet solo se usa para descargar las imágenes de los ejercicios.</li>
      </ul>
      <p class="${backupAge(st) > 30 && st.sessions.length ? 'hint' : 'muted small'}">${backupText(st)}</p>
      <div class="row">
        <button class="btn grow" data-act="export">Exportar</button>
        <label class="btn grow">Importar<input type="file" accept="application/json,.json" data-f="import" hidden></label>
      </div>
    </section>
    <section class="card">
      <h3>Sobre las recomendaciones</h3>
      <p class="muted small">Las cifras de la app son guías generales para adultos sanos, no una indicación médica. Adáptalas a ti y consulta a un profesional de salud si tienes una condición, dolor o dudas.</p>
      <ul class="tips">
        <li>Actividad física (OMS): 150–300 min semanales de actividad aeróbica moderada, o el equivalente vigoroso, y fortalecer los músculos al menos 2 días. <a class="link" href="https://www.who.int/initiatives/behealthy/physical-activity/" target="_blank" rel="noopener noreferrer">Ver guía</a></li>
        <li>Fuerza y ganancia muscular: resumen de evidencia del ACSM (2026). <a class="link" href="https://pubmed.ncbi.nlm.nih.gov/41843416/" target="_blank" rel="noopener noreferrer">Ver referencia</a></li>
        <li>Ningún ejercicio reduce la grasa de una zona específica.</li>
      </ul>
    </section>
    <section class="card">
      <button class="btn danger" data-act="reset">Borrar todos los datos</button>
    </section>
    <p class="muted center small">Imágenes: ExerciseDB · ${st.sessions.length} sesiones guardadas</p>`;
}

// ---------- ventana de técnica ----------
function openMedia(key) {
  const ex = EXERCISES[key];
  $media.innerHTML = `<div class="media-box">
    <div class="thumb-xl" data-ex="${key}"><span class="thumb-fallback">Sin imagen (revisa tu conexión)</span></div>
    <h2>${esc(ex.name)}</h2>
    <ul class="tips">${ex.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <button class="btn primary big" data-act="close-media">Cerrar</button>
  </div>`;
  const box = $media.querySelector('.thumb-xl');
  const put = (url) => {
    if (!url) return;
    const img = new Image();
    img.alt = `Ejecución de ${ex.name}`;
    img.onload = () => box.classList.add('has-img');
    img.src = url;
    box.appendChild(img);
  };
  const hit = cachedUrl(key);
  if (hit) put(hit); else getImageUrl(key).then(put);
  $media.showModal();
}

// ---------- eventos ----------
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) {
    const dot = ev.target.closest('.c-dot');
    if (dot) showPoint(Number(dot.dataset.i));
    if (ev.target === $media) $media.close();
    return;
  }
  const act = el.dataset.act;
  const st = store.get();
  const d = st.draft;

  switch (act) {
    case 'pick-mode':
    case 'set-mode':
      if (!MODES[el.dataset.mode]) break;
      store.setMode(el.dataset.mode);
      selectedDay = null;
      planUi.resetWizard();
      if (act === 'pick-mode') go('#/');
      else render(true);
      break;
    case 'pick-day':
      selectedDay = el.dataset.day;
      render(true);
      break;
    case 'start':
      if (!dayOf(st, st.mode, el.dataset.day)) break;
      store.setDraft(newDraft(st.mode, el.dataset.day));
      go('#/session');
      break;
    case 'continue':
      go('#/session');
      break;
    case 'discard':
      if (confirm(d?.editing ? '¿Descartar los cambios? La sesión queda como estaba.' : '¿Descartar esta sesión? Se perderá lo que anotaste.')) {
        const wasEditing = d?.editing;
        store.setDraft(null);
        stopTimer();
        releaseAwake();
        go(wasEditing ? '#/history' : '#/');
      }
      break;
    case 'edit-session': {
      if (st.draft) {
        toast('Termina o descarta la sesión en curso antes de corregir otra.');
        break;
      }
      const s = st.sessions.find((x) => x.id === el.dataset.id);
      if (!s) break;
      store.setDraft(draftFromSession(s));
      go('#/session');
      break;
    }
    case 'apply-kg': {
      // Aceptar (o no) el peso sugerido: se aplica a las series que faltan por hacer.
      const e = d.entries[el.dataset.i];
      const kg = num(el.dataset.kg);
      if (!e || kg == null) break;
      e.sets.forEach((set) => { if (!set.done) set.kg = kg; });
      store.setDraft(d);
      rerenderSession();
      break;
    }
    case 'plank':
      startPlank(Number(el.dataset.i), Number(el.dataset.s));
      break;
    case 'toggle': {
      unlockAudio();
      const e = d.entries[el.dataset.i];
      const set = e.sets[el.dataset.s];
      if (!set.done && e.kind === 'weight' && num(set.kg) == null) {
        toast('Escribe el peso (kg) de la serie');
        document.querySelector(`input[data-f="kg"][data-i="${el.dataset.i}"][data-s="${el.dataset.s}"]`)?.focus();
        break;
      }
      set.done = !set.done;
      store.setDraft(d);
      const y = window.scrollY;
      renderSession();
      hydrateImages();
      window.scrollTo(0, y);
      if (set.done && !d.editing) {
        const i = Number(el.dataset.i);
        const item = itemOf(d, i);
        const lastOfCircuit = item.group !== 'circuito' || itemOf(d, i + 1)?.group !== 'circuito';
        if (lastOfCircuit) startTimer(restFor(d.mode, item));
      }
      break;
    }
    case 'toggle-cardio': {
      const e = d.entries[el.dataset.i];
      e.done = !e.done;
      store.setDraft(d);
      const y = window.scrollY;
      renderSession();
      hydrateImages();
      window.scrollTo(0, y);
      break;
    }
    case 'add-set':
    case 'del-set': {
      const e = d.entries[el.dataset.i];
      if (act === 'add-set') {
        const prev = e.sets[e.sets.length - 1] || { kg: '', reps: '' };
        e.sets.push({ kg: prev.kg, reps: prev.reps, done: false });
      } else {
        e.sets.pop();
      }
      store.setDraft(d);
      const y = window.scrollY;
      renderSession();
      hydrateImages();
      window.scrollTo(0, y);
      break;
    }
    case 'finish':
      finishSession();
      break;
    case 'timer-add':
      timer.end += 15000;
      timer.total += 15;
      paintTimer();
      break;
    case 'timer-stop':
      stopTimer();
      break;
    case 'media':
      openMedia(el.dataset.ex);
      break;
    case 'close-media':
      $media.close();
      break;
    case 'hist-tab':
      histTab = el.dataset.tab;
      render();
      break;
    case 'del-session':
      if (confirm('¿Borrar esta sesión del historial?')) {
        store.deleteSession(el.dataset.id);
        render();
        toast('Sesión borrada');
      }
      break;
    case 'set-rest':
      store.setSetting('rest_' + el.dataset.mode, Number(el.dataset.sec));
      render();
      break;
    case 'prefetch': {
      el.disabled = true;
      const r = await prefetchAll((i, n) => { el.textContent = `Descargando ${i}/${n}…`; });
      el.disabled = false;
      el.textContent = 'Descargar imágenes';
      toast(r.ok ? `Listo: ${r.ok} de ${r.total} imágenes guardadas` : 'Sin conexión. Intenta con internet.');
      break;
    }
    case 'export': {
      const blob = new Blob([store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `gymlog-${store.today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      store.setSetting('lastExport', store.today());
      render(true);
      break;
    }
    case 'reset':
      if (confirm('¿Borrar TODOS tus registros? No se puede deshacer.') && confirm('¿Seguro? Se borrará todo el historial.')) {
        store.resetAll();
        planUi.resetWizard();
        go('#/');
      }
      break;
    default:
      // Asistente del plan, sustituir ejercicios y resumen semanal.
      planUi.handleAction(act, el);
      break;
  }
});

planUi.init({
  esc, num, toast, go, render, target, fDate, swapInSession,
  openDialog(html) {
    $media.innerHTML = html;
    if (!$media.open) $media.showModal();
  },
  closeDialog() {
    if ($media.open) $media.close();
  },
});

// Ir a "Sesiones" desde el enlace "Ver todo" del inicio.
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('a[data-tab]');
  if (a) histTab = a.dataset.tab;
}, true);

function showPoint(i) {
  const p = chartPoints[i];
  const out = document.getElementById('readout');
  if (!p || !out) return;
  out.innerHTML = `${fDate(p.date)} · <strong>${fmt(p.value)} ${esc(p.unit)}</strong> · ${esc(p.label)}`;
  document.querySelectorAll('.c-dot').forEach((c) => c.classList.toggle('sel', Number(c.dataset.i) === i));
}

document.addEventListener('input', (ev) => {
  const el = ev.target;
  const f = el.dataset.f;
  if (planUi.handleInput(el)) return; // pesos iniciales del plan
  const d = store.get().draft;
  if (!f || !d) return;
  if (f === 'date') {
    if (el.value) d.date = el.value;
  } else if (f === 'minutes') {
    d.entries[el.dataset.i].minutes = el.value;
  } else if (f === 'kg' || f === 'reps') {
    const e = d.entries[el.dataset.i];
    const si = Number(el.dataset.s);
    e.sets[si][f] = el.value;
    // Cambiar el peso de una serie lo copia a las siguientes que aún no se hicieron.
    if (f === 'kg') {
      for (let k = si + 1; k < e.sets.length; k++) {
        if (e.sets[k].done) continue;
        e.sets[k].kg = el.value;
        const inp = document.querySelector(`input[data-f="kg"][data-i="${el.dataset.i}"][data-s="${k}"]`);
        if (inp) inp.value = el.value;
      }
    }
  }
  store.setDraft(d);
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.f !== 'import' || !el.files?.[0]) return;
  try {
    const text = await el.files[0].text();
    // Validate before asking to replace current data, so invalid files never
    // reach the destructive confirmation step.
    store.validateImportJSON(text);
    if (!confirm('Esto reemplaza tus datos actuales por los del archivo. ¿Continuar?')) return;
    store.importJSON(text);
    planUi.resetWizard();
    toast('Datos importados');
    go('#/');
  } catch (err) {
    toast(err instanceof Error ? err.message : 'No se pudo importar la copia.');
  } finally {
    el.value = '';
  }
});

window.addEventListener('gymlog:storage-error', () => {
  toast('No se pudieron guardar los cambios. Exporta una copia y libera espacio en el teléfono.');
});

// Al tocar un número se selecciona todo, para escribir encima sin borrar.
document.addEventListener('focusin', (ev) => {
  if (ev.target.matches('input.num')) setTimeout(() => ev.target.select(), 0);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && location.hash.startsWith('#/session')) keepAwake();
});

window.addEventListener('hashchange', render);
render();

// ---------- modo sin conexión ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});

// La primera vez con internet, descarga las imágenes en segundo plano.
try {
  if (navigator.onLine && !localStorage.getItem('gymlog.prefetched')) {
    setTimeout(() => prefetchAll().then((r) => {
      if (r.ok === r.total) localStorage.setItem('gymlog.prefetched', '1');
    }), 4000);
  }
} catch { /* sin almacenamiento */ }
