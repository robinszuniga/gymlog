import * as store from './store.js';
import { EXERCISES, MODES, findDay } from './data.js';
import { suggest, entriesFor, fmt } from './progression.js';
import { getImageUrl, cachedUrl, prefetchAll } from './images.js';
import { renderChart } from './chart.js';

const $app = document.getElementById('app');
const $nav = document.getElementById('tabbar');
const $toast = document.getElementById('toast');
const $media = document.getElementById('media');

const SERIES_LABEL = { fuerza: 'Fuerza', def: 'Definición', circuito: 'Circuito', core: 'Core', cardio: 'Cardio' };
const KIND_UNIT = { weight: 'kg', reps: 'reps', time: 's', cardio: 'min' };

let selectedDay = null; // día elegido en modo Definición
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

function restFor(mode) {
  return store.get().settings['rest_' + mode] || MODES[mode].rest;
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

function nextDefDay(sessions) {
  const days = MODES.definicion.days;
  const last = [...sessions].reverse().find((s) => s.mode === 'definicion');
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
function render() {
  const st = store.get();
  const [, page, arg] = (location.hash.slice(1) || '/').split('/');
  window.scrollTo(0, 0);

  if (!st.mode) {
    $nav.hidden = true;
    renderModePicker();
  } else if (page === 'session') {
    $nav.hidden = true;
    if (!st.draft) return go('#/');
    renderSession();
  } else {
    $nav.hidden = false;
    if (page === 'history' && arg) renderExercise(arg);
    else if (page === 'history') renderHistory();
    else if (page === 'settings') renderSettings();
    else renderHome();
    $nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.page === (page || 'home')));
  }
  hydrateImages();
}

// ---------- selector de modo (primera vez) ----------
function renderModePicker() {
  const card = (key) => {
    const m = MODES[key];
    const exs = [...new Set(m.days.flatMap((d) => d.items.map((i) => EXERCISES[i.ex].name)))];
    return `<button class="mode-card" data-act="pick-mode" data-mode="${key}">
      <span class="mode-card-title">${m.label}</span>
      <span class="mode-card-sub">${esc(m.summary)}</span>
      <span class="mode-card-list">${exs.slice(0, 6).map(esc).join(' · ')}${exs.length > 6 ? '…' : ''}</span>
    </button>`;
  };
  $app.innerHTML = `
    <div class="picker">
      <h1 class="brand">GymLog</h1>
      <p class="lead">¿Cómo quieres entrenar?</p>
      ${card('fuerza')}
      ${card('definicion')}
      <p class="muted center">Puedes cambiar de modo cuando quieras.</p>
    </div>`;
}

function modeSwitch(current) {
  return `<div class="seg" role="tablist" aria-label="Modo de entrenamiento">
    ${Object.entries(MODES).map(([k, m]) => `<button role="tab" aria-selected="${k === current}" class="${k === current ? 'on' : ''}" data-act="set-mode" data-mode="${k}">${m.label}</button>`).join('')}
  </div>`;
}

// ---------- inicio ----------
function renderHome() {
  const st = store.get();
  const mode = MODES[st.mode];
  const t = store.today();
  const monday = store.toISO(mondayOf(new Date()));
  const weekDates = new Set(st.sessions.filter((s) => s.date >= monday && s.date <= t).map((s) => s.date));
  const trainedToday = st.sessions.some((s) => s.date === t);

  let draftHtml = '';
  if (st.draft) {
    const d = findDay(st.draft.mode, st.draft.dayId);
    draftHtml = `<section class="card draft">
      <p class="eyebrow">Sesión sin terminar</p>
      <h2>${esc(d?.name || '')}</h2>
      <p class="muted">${MODES[st.draft.mode].label} · ${fDate(st.draft.date)}</p>
      <div class="row">
        <button class="btn primary grow" data-act="continue">Continuar</button>
        <button class="btn ghost" data-act="discard">Descartar</button>
      </div>
    </section>`;
  }

  let today;
  if (st.mode === 'fuerza') {
    const day = mode.days[0];
    const lastF = [...st.sessions].reverse().find((s) => s.mode === 'fuerza');
    const hint = lastF && daysBetween(lastF.date, t) === 1
      ? '<p class="hint">Entrenaste fuerza ayer. Lo ideal es dejar un día de descanso entre sesiones.</p>' : '';
    today = `<section class="card">
      <p class="eyebrow">Hoy</p>
      <h2>${esc(day.name)}</h2>
      <p class="muted">${day.items.map((i) => esc(EXERCISES[i.ex].name)).join(' · ')}</p>
      ${hint}
      <button class="btn primary big" data-act="start" data-day="${day.id}" ${st.draft ? 'disabled' : ''}>Empezar entrenamiento</button>
    </section>`;
  } else {
    const next = nextDefDay(st.sessions);
    if (!selectedDay || !findDay('definicion', selectedDay)) selectedDay = next;
    const day = findDay('definicion', selectedDay);
    today = `<section class="card">
      <p class="eyebrow">${selectedDay === next ? 'Te toca' : 'Elegiste'}</p>
      <h2>${esc(day.name)}</h2>
      <div class="chips" role="radiogroup" aria-label="Día de la rutina">
        ${mode.days.map((d, i) => `<button role="radio" aria-checked="${d.id === selectedDay}" class="chip ${d.id === selectedDay ? 'on' : ''}" data-act="pick-day" data-day="${d.id}">${i + 1}<small>${esc(d.short)}</small></button>`).join('')}
      </div>
      <ul class="plan">${day.items.map((i) => `<li>${esc(EXERCISES[i.ex].name)}<span>${target(i)}</span></li>`).join('')}</ul>
      <button class="btn primary big" data-act="start" data-day="${day.id}" ${st.draft ? 'disabled' : ''}>Empezar ${esc(day.short)}</button>
    </section>`;
  }

  $app.innerHTML = `
    <header class="top"><h1 class="brand">GymLog</h1>${trainedToday ? '<span class="pill ok">✓ Hoy entrenaste</span>' : ''}</header>
    ${modeSwitch(st.mode)}
    ${draftHtml}
    ${today}
    <section class="card">
      <div class="row between"><h3>Esta semana</h3><span class="big-num">${weekDates.size}<small> / ${mode.perWeek}</small></span></div>
      ${calendarStrip(st.sessions)}
    </section>
    ${recent(st.sessions)}`;
}

function target(item) {
  const ex = EXERCISES[item.ex];
  if (ex.kind === 'cardio') return item.min === item.max ? `${item.min} min` : `${item.min}–${item.max} min`;
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
    <div class="legend"><span class="lg m-fuerza"></span>Fuerza <span class="lg m-definicion"></span>Definición</div>`;
}

function recent(sessions) {
  const last = [...sessions].reverse().slice(0, 3);
  if (!last.length) return '<section class="card"><p class="muted center">Cuando termines tu primera sesión aparecerá aquí.</p></section>';
  return `<section class="card"><div class="row between"><h3>Últimas sesiones</h3><a href="#/history" class="link" data-tab="sessions">Ver todo</a></div>
    ${last.map((s) => `<div class="mini-sess"><strong>${fDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}</strong><span>${esc(s.dayName)}</span></div>`).join('')}
  </section>`;
}

// ---------- sesión en curso ----------
function newDraft(mode, dayId) {
  const st = store.get();
  const day = findDay(mode, dayId);
  return {
    id: store.uid(),
    mode,
    dayId,
    date: store.today(),
    createdAt: Date.now(),
    entries: day.items.map((item) => {
      const kind = EXERCISES[item.ex].kind;
      if (kind === 'cardio') return { ex: item.ex, key: 'cardio', kind, minutes: item.min, done: false };
      const s = suggest(st.sessions, item, kind);
      const val = kind === 'time' ? s.reps : item.repMax;
      const kg = kind === 'time' ? '' : (s.kg ?? '');
      return {
        ex: item.ex, key: item.key, kind,
        sets: Array.from({ length: item.sets }, () => ({ kg, reps: val, done: false })),
      };
    }),
  };
}

function renderSession() {
  const st = store.get();
  const d = st.draft;
  const day = findDay(d.mode, d.dayId);
  let groupShown = false;

  const cards = d.entries.map((e, idx) => {
    const item = day.items[idx];
    let head = '';
    if (item.group === 'circuito' && !groupShown) {
      groupShown = true;
      head = `<div class="group-head"><strong>Circuito · 3 rondas × 15 reps</strong><span>Haz los 4 ejercicios seguidos, descansa y repite.</span></div>`;
    }
    return head + (e.kind === 'cardio' ? cardioCard(e, idx, item) : exerciseCard(e, idx, item, st.sessions));
  }).join('');

  $app.innerHTML = `
    <header class="topbar">
      <a href="#/" class="icon-btn" aria-label="Volver al inicio">←</a>
      <div class="grow">
        <h1>${esc(day.name)}</h1>
        <label class="date-lbl">Fecha <input type="date" data-f="date" value="${esc(d.date)}" max="${store.today()}"></label>
      </div>
      <button class="icon-btn" data-act="discard" aria-label="Descartar sesión">✕</button>
    </header>
    <main class="session">${cards}
      <p class="muted center small">Descanso sugerido: ${restFor(d.mode)} s · Toca la imagen para ver la técnica.</p>
    </main>
    <div class="bottom-bar">
      <div id="timer" class="timer" hidden></div>
      <button class="btn primary big" data-act="finish">✓ Terminar · Hoy entrené</button>
    </div>`;
  paintTimer();
  keepAwake();
}

function exerciseCard(e, idx, item, sessions) {
  const ex = EXERCISES[e.ex];
  const s = suggest(sessions, item, e.kind);
  const last = entriesFor(sessions, e.ex, item.key)[0];
  const isTime = e.kind === 'time';
  const icon = { up: '↑', keep: '=', new: '★' }[s.type];
  const allDone = e.sets.length && e.sets.every((x) => x.done);

  const rows = e.sets.map((set, si) => `
    <div class="set-row ${set.done ? 'done' : ''}">
      <span class="n">${si + 1}</span>
      ${isTime ? '' : `<input class="num" type="text" inputmode="decimal" autocomplete="off" data-f="kg" data-i="${idx}" data-s="${si}" value="${esc(set.kg)}" placeholder="${e.kind === 'reps' ? '0' : 'kg'}" aria-label="Peso serie ${si + 1} en kg">`}
      <input class="num" type="text" inputmode="numeric" autocomplete="off" data-f="reps" data-i="${idx}" data-s="${si}" value="${esc(set.reps)}" aria-label="${isTime ? 'Segundos' : 'Repeticiones'} serie ${si + 1}">
      <button class="check" data-act="toggle" data-i="${idx}" data-s="${si}" aria-pressed="${set.done}" aria-label="Serie ${si + 1} hecha">✓</button>
    </div>`).join('');

  return `<section class="card ex-card ${allDone ? 'complete' : ''}" id="ex-${idx}">
    <div class="ex-head">
      ${thumb(e.ex)}
      <div class="ex-info">
        <h2>${esc(ex.name)}</h2>
        <p class="target">${target(item)}${isTime ? '' : ' reps'}</p>
        <span class="sug sug-${s.type}">${icon} ${esc(s.text)}</span>
      </div>
    </div>
    <p class="sug-detail">${esc(s.detail)}</p>
    ${last ? `<p class="last">Última (${fDate(last.date)}): <strong>${esc(setsText(last))}</strong></p>` : ''}
    <div class="sets ${isTime ? 'time' : ''}">
      <div class="set-row head"><span>Serie</span>${isTime ? '' : `<span>${e.kind === 'reps' ? 'kg (opc.)' : 'kg'}</span>`}<span>${isTime ? 'seg' : 'reps'}</span><span></span></div>
      ${rows}
    </div>
    ${item.setsMax > item.sets || e.sets.length > item.sets ? `<div class="row">
      ${e.sets.length < item.setsMax ? `<button class="btn ghost small" data-act="add-set" data-i="${idx}">+ Serie</button>` : ''}
      ${e.sets.length > item.sets ? `<button class="btn ghost small" data-act="del-set" data-i="${idx}">− Serie</button>` : ''}
    </div>` : ''}
  </section>`;
}

function cardioCard(e, idx, item) {
  const ex = EXERCISES[e.ex];
  return `<section class="card ex-card ${e.done ? 'complete' : ''}" id="ex-${idx}">
    <div class="ex-head">
      ${thumb(e.ex)}
      <div class="ex-info">
        <h2>${esc(ex.name)}</h2>
        <p class="target">${target(item)}</p>
      </div>
    </div>
    <p class="sug-detail">${esc(ex.tips[0])}</p>
    <div class="set-row cardio ${e.done ? 'done' : ''}">
      <span class="n">min</span>
      <input class="num" type="text" inputmode="numeric" data-f="minutes" data-i="${idx}" value="${esc(e.minutes)}" aria-label="Minutos">
      <button class="check wide" data-act="toggle-cardio" data-i="${idx}" aria-pressed="${e.done}">${e.done ? '✓ Hecho' : 'Marcar hecho'}</button>
    </div>
  </section>`;
}

function finishSession() {
  const st = store.get();
  const d = st.draft;
  const day = findDay(d.mode, d.dayId);
  const entries = d.entries.map((e) => {
    if (e.kind === 'cardio') return e.done ? { ex: e.ex, key: e.key, kind: e.kind, minutes: num(e.minutes) || 0 } : null;
    const sets = e.sets.filter((s) => s.done).map((s) => ({ kg: num(s.kg) || 0, reps: num(s.reps) || 0, done: true }));
    return sets.length ? { ex: e.ex, key: e.key, kind: e.kind, sets } : null;
  }).filter(Boolean);

  if (!entries.length) {
    toast('Marca con ✓ al menos una serie antes de terminar.');
    return;
  }
  store.addSession({
    id: d.id, date: d.date, mode: d.mode, dayId: d.dayId, dayName: day.name, createdAt: Date.now(), entries,
  });
  stopTimer();
  releaseAwake();
  if (d.mode === 'definicion') selectedDay = null;
  go('#/');
  toast('¡Listo! Sesión guardada 💪');
}

// ---------- temporizador de descanso ----------
const timer = { end: 0, total: 0, id: 0 };

function startTimer(sec) {
  timer.total = sec;
  timer.end = Date.now() + sec * 1000;
  clearInterval(timer.id);
  timer.id = setInterval(paintTimer, 250);
  paintTimer();
}

function stopTimer() {
  clearInterval(timer.id);
  timer.end = 0;
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
    if (!el.classList.contains('over')) {
      el.classList.add('over');
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* no soportado */ }
      beep();
      const end = timer.end;
      setTimeout(() => { if (timer.end === end) stopTimer(); }, 4000);
    }
    txt.textContent = '¡A la siguiente serie!';
    bar.style.width = '0%';
    add.hidden = true;
    return;
  }
  el.classList.remove('over');
  add.hidden = false;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  txt.innerHTML = `Descanso <strong>${mm}:${ss}</strong>`;
  bar.style.width = `${Math.max(0, Math.min(100, (left / timer.total) * 100))}%`;
}

let audioCtx;
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
    <button class="${histTab === 'ex' ? 'on' : ''}" data-act="hist-tab" data-tab="ex">Por ejercicio</button>
    <button class="${histTab === 'sessions' ? 'on' : ''}" data-act="hist-tab" data-tab="sessions">Sesiones</button>
  </div>`;

  let body;
  if (!st.sessions.length) {
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
          <div><strong>${esc(fDateLong(s.date))}</strong><p class="muted small">${esc(MODES[s.mode]?.label || s.mode)} · ${esc(s.dayName)}</p></div>
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
  chartPoints = pts.map((e) => ({ date: e.date, value: e.m.v, series: e.key, label: setsText(e), unit: e.m.unit })).reverse();
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
      ${series.length > 1 ? `<div class="legend">${series.map((s) => `<span class="lg s-${s}"></span>${SERIES_LABEL[s] || s}`).join(' ')}</div>` : ''}
      <div class="stats">
        <div><span>${fmt(best)}</span><small>Mejor (${unit})</small></div>
        <div><span>${hist.length}</span><small>Sesiones</small></div>
        <div><span>${diff > 0 ? '+' : ''}${fmt(diff)}</span><small>Desde el inicio</small></div>
      </div>
    </section>
    <section class="card">
      <h3>Registros</h3>
      <ul class="sess-list">${hist.map((e) => `<li><span>${fDate(e.date)} <small class="tag s-${e.key}">${SERIES_LABEL[e.key] || ''}</small></span><span>${esc(setsText(e))}</span></li>`).join('') || '<li class="muted">Sin registros</li>'}</ul>
    </section>`;
}

// ---------- ajustes ----------
function renderSettings() {
  const st = store.get();
  const restBtns = (mode, opts) => `<div class="seg small">${opts.map((s) => `<button class="${restFor(mode) === s ? 'on' : ''}" data-act="set-rest" data-mode="${mode}" data-sec="${s}">${s} s</button>`).join('')}</div>`;
  $app.innerHTML = `
    <header class="top"><h1>Ajustes</h1></header>
    <section class="card"><h3>Modo de entrenamiento</h3>${modeSwitch(st.mode)}</section>
    <section class="card">
      <h3>Descanso entre series</h3>
      <p class="muted small">Fuerza</p>${restBtns('fuerza', [60, 90, 120, 180])}
      <p class="muted small">Definición</p>${restBtns('definicion', [45, 60, 75])}
    </section>
    <section class="card">
      <h3>Imágenes sin internet</h3>
      <p class="muted small">Descarga una vez las imágenes con wifi para verlas en el gym sin datos.</p>
      <button class="btn" data-act="prefetch" id="prefetch-btn">Descargar imágenes</button>
    </section>
    <section class="card">
      <h3>Copia de seguridad</h3>
      <p class="muted small">Tus registros solo están en este teléfono. Guarda una copia de vez en cuando.</p>
      <div class="row">
        <button class="btn grow" data-act="export">Exportar</button>
        <label class="btn grow">Importar<input type="file" accept="application/json,.json" data-f="import" hidden></label>
      </div>
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
      store.setMode(el.dataset.mode);
      selectedDay = null;
      if (act === 'pick-mode') go('#/');
      else render();
      break;
    case 'pick-day':
      selectedDay = el.dataset.day;
      render();
      break;
    case 'start':
      store.setDraft(newDraft(st.mode, el.dataset.day));
      go('#/session');
      break;
    case 'continue':
      go('#/session');
      break;
    case 'discard':
      if (confirm('¿Descartar esta sesión? Se perderá lo que anotaste.')) {
        store.setDraft(null);
        stopTimer();
        releaseAwake();
        go('#/');
      }
      break;
    case 'toggle': {
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
      if (set.done) {
        const item = findDay(d.mode, d.dayId).items[el.dataset.i];
        const items = findDay(d.mode, d.dayId).items;
        const lastOfCircuit = item.group !== 'circuito' || items[Number(el.dataset.i) + 1]?.group !== 'circuito';
        if (lastOfCircuit) startTimer(restFor(d.mode));
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
      break;
    }
    case 'reset':
      if (confirm('¿Borrar TODOS tus registros? No se puede deshacer.') && confirm('¿Seguro? Se borrará todo el historial.')) {
        store.resetAll();
        go('#/');
      }
      break;
    default:
      break;
  }
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
    if (!confirm('Esto reemplaza tus datos actuales por los del archivo. ¿Continuar?')) return;
    store.importJSON(text);
    toast('Datos importados');
    go('#/');
  } catch {
    toast('No se pudo leer el archivo');
  } finally {
    el.value = '';
  }
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
