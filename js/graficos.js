'use strict';
/* =====================================================================
   GRÁFICOS
   ---------------------------------------------------------------------
   Configuración común de Chart.js y registro de gráficos activos.
   Depende de: utilidades.js
   ===================================================================== */

const Charts = {};
function setupChartDefaults() {
  if (!window.Chart) return;
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.color = '#475569';
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.tooltip.callbacks.label = ctx => {
    const v = typeof ctx.parsed === 'number' ? ctx.parsed : (ctx.chart.options.indexAxis === 'y' ? ctx.parsed.x : ctx.parsed.y);
    return ` ${ctx.dataset.label && ctx.chart.config.type !== 'doughnut' ? ctx.dataset.label : ctx.label}: ${fmtEUR(v)}`;
  };
}
function destroyCharts() { for (const k of Object.keys(Charts)) { try { Charts[k].destroy(); } catch (e) { /* noop */ } delete Charts[k]; } }
function mkChart(id, cfg) {
  const el = document.getElementById(id); if (!el || !window.Chart) return;
  if (Charts[id]) Charts[id].destroy();
  Charts[id] = new Chart(el, cfg);
}
const euroAxis = { ticks: { callback: v => fmtNum(v, 0) + ' €' }, grid: { color: () => Tema.rejilla() } };
