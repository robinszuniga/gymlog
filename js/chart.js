// Gráfico de progreso en SVG (sin librerías, funciona sin internet).
// points: [{ date: 'AAAA-MM-DD', value: Number, series: 'fuerza' | 'def' | ..., label: String }]
import { fmt } from './progression.js';

const W = 340;
const H = 200;
const PAD = { t: 16, r: 14, b: 26, l: 38 };

const day = (iso) => new Date(iso + 'T12:00:00').getTime();

export function renderChart(points, unit) {
  if (!points.length) return '<p class="muted center">Aún no hay registros.</p>';

  const xs = points.map((p) => day(p.date));
  const ys = points.map((p) => p.value);
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
  // Eje Y con valores redondos (paso de 1, 2, 2.5 o 5 × 10^n)
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const raw = Math.max((hi - lo) / 3, hi * 0.03, 1);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const tick = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  const y0 = Math.max(0, Math.floor(lo / tick) * tick - (lo % tick === 0 ? tick : 0));
  const y1 = Math.ceil(hi / tick) * tick + (hi % tick === 0 ? tick : 0);
  const nTicks = Math.round((y1 - y0) / tick);

  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const sx = (x) => PAD.l + ((x - x0) / (x1 - x0)) * iw;
  const sy = (y) => PAD.t + ih - ((y - y0) / (y1 - y0)) * ih;

  // Líneas guía horizontales (una por paso, máximo ~6 etiquetas)
  let grid = '';
  const every = Math.ceil(nTicks / 5);
  for (let i = 0; i <= nTicks; i += every) {
    const v = y0 + tick * i;
    const y = sy(v);
    grid += `<line class="c-grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}"/>`;
    grid += `<text class="c-axis" x="${PAD.l - 6}" y="${y + 4}" text-anchor="end">${fmt(v)}</text>`;
  }

  const dfmt = (t) => new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  const xlab = `<text class="c-axis" x="${PAD.l}" y="${H - 6}">${dfmt(x0)}</text>`
    + `<text class="c-axis" x="${W - PAD.r}" y="${H - 6}" text-anchor="end">${dfmt(x1)}</text>`;

  // Una línea por serie (fuerza / definición / circuito…)
  const bySeries = {};
  points.forEach((p, i) => { (bySeries[p.series] ||= []).push({ ...p, i }); });
  let lines = '';
  let dots = '';
  for (const [s, pts] of Object.entries(bySeries)) {
    pts.sort((a, b) => day(a.date) - day(b.date));
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${sx(day(p.date)).toFixed(1)},${sy(p.value).toFixed(1)}`).join(' ');
    lines += `<path class="c-line s-${s}" d="${d}"/>`;
    dots += pts.map((p) => `<circle class="c-dot s-${s}" data-i="${p.i}" cx="${sx(day(p.date)).toFixed(1)}" cy="${sy(p.value).toFixed(1)}" r="5"/>`).join('');
  }

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progreso en ${unit}">${grid}${xlab}${lines}${dots}</svg>`;
}
