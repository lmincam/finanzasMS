'use strict';
/* =====================================================================
   SIMULADOR DE INTERÉS COMPUESTO (pestaña Inversiones)
   ---------------------------------------------------------------------
   Capital inicial + aportaciones periódicas (con subida anual), rentabilidad
   anual con la capitalización elegida, comisiones, inflación e impuestos al
   rescatar (escala del ahorro del IRPF 2026). Calcula mes a mes y muestra
   el resultado, escenarios, la aportación necesaria para un objetivo y la
   tabla año a año. No guarda nada: solo los datos del formulario en este
   dispositivo (localStorage pf_sim).
   Depende de: utilidades.js, ui.js, graficos.js
   ===================================================================== */

const SIM_DEF = { inicial: 10000, aport: 200, freq: 12, momento: 'inicio', subida: 0, anios: 20, meses: 0, rent: 6, cap: 12, ter: 0.2, infl: 2, impuestos: true, objetivo: 0, escenario: 2 };
const IRPF_AHORRO = [[6000, 0.19], [50000, 0.21], [200000, 0.23], [300000, 0.27], [Infinity, 0.30]];
/** Impuesto sobre la ganancia al rescatar todo de una vez (escala del ahorro, territorio común). */
function irpfAhorro(g) {
  let t = 0, prev = 0;
  for (const [hasta, tipo] of IRPF_AHORRO) { if (g <= prev) break; t += (Math.min(g, hasta) - prev) * tipo; prev = hasta; }
  return Math.max(0, t);
}
function simDatos() { try { return { ...SIM_DEF, ...(JSON.parse(localStorage.getItem('pf_sim') || 'null') || {}) }; } catch (e) { return { ...SIM_DEF }; } }
function simGuardar(d) { try { localStorage.setItem('pf_sim', JSON.stringify(d)); } catch (e) { /* noop */ } }

/**
 * Simulación mes a mes.
 * rent: rentabilidad anual nominal (%) capitalizada `cap` veces al año → tasa efectiva anual.
 * ter: comisión anual (%) que se descuenta del rendimiento. Aportaciones cada 12/freq meses, al inicio o al final del periodo.
 */
function simular(d, rentOverride) {
  const rent = (rentOverride ?? num(d.rent)) / 100, cap = Math.max(1, num(d.cap) || 12);
  const efBruta = cap >= 365 ? Math.exp(rent) - 1 : Math.pow(1 + rent / cap, cap) - 1;
  const efNeta = (1 + efBruta) * (1 - num(d.ter) / 100) - 1;
  const iB = Math.pow(1 + efBruta, 1 / 12) - 1, iN = Math.pow(1 + efNeta, 1 / 12) - 1;
  const n = Math.max(1, Math.round(num(d.anios) * 12 + num(d.meses))), cada = 12 / (num(d.freq) || 12);
  const infl = num(d.infl) / 100;
  let saldo = num(d.inicial), aportado = saldo, intereses = 0, comisiones = 0, aport = num(d.aport);
  const anual = []; let fila = { anio: 1, aport: 0, int: 0, com: 0 };
  for (let m = 1; m <= n; m++) {
    if ((m - 1) > 0 && (m - 1) % 12 === 0) aport *= 1 + num(d.subida) / 100;         // sube la aportación cada año
    const toca = d.momento === 'inicio' ? (m - 1) % cada === 0 : m % cada === 0;
    if (toca && d.momento === 'inicio' && aport) { saldo += aport; aportado += aport; fila.aport += aport; }
    const g = saldo * iN, c = saldo * (iB - iN);
    saldo += g; intereses += g; comisiones += c; fila.int += g; fila.com += c;
    if (toca && d.momento !== 'inicio' && aport) { saldo += aport; aportado += aport; fila.aport += aport; }
    if (m % 12 === 0 || m === n) {
      const t = m / 12;
      anual.push({ ...fila, anio: Math.ceil(t), meses: m, aportado, intereses, comisiones, saldo, real: saldo / Math.pow(1 + infl, t) });
      fila = { anio: Math.ceil(t) + 1, aport: 0, int: 0, com: 0 };
    }
  }
  const ganancia = saldo - aportado, imp = d.impuestos ? irpfAhorro(Math.max(0, ganancia)) : 0, anios = n / 12;
  const neto = saldo - imp, real = saldo / Math.pow(1 + infl, anios), realNeto = neto / Math.pow(1 + infl, anios);
  return { n, anios, saldo, aportado, intereses, comisiones, ganancia, imp, neto, real, realNeto, efBruta, efNeta, anual, aportFinal: aport };
}
/** Aportación periódica necesaria para llegar al objetivo (búsqueda binaria sobre la simulación). */
function aportacionPara(d, objetivo) {
  if (!(objetivo > 0)) return null;
  if (simular({ ...d, aport: 0 }).saldo >= objetivo) return 0;
  let lo = 0, hi = Math.max(100, objetivo);
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (simular({ ...d, aport: mid }).saldo >= objetivo) hi = mid; else lo = mid; }
  return hi;
}
/** Años (con la aportación actual) hasta llegar al objetivo; null si no se llega en 80 años. */
function aniosPara(d, objetivo) {
  if (!(objetivo > 0)) return null;
  const r = simular({ ...d, anios: 80, meses: 0 }); const f = r.anual.find(x => x.saldo >= objetivo);
  return f ? f.meses / 12 : null;
}

function renderSimInteres(el) {
  const d = simDatos();
  const campo = (id, l, v, extra = '', hint = '') => `<div><label for="sic-${id}">${l}</label><input id="sic-${id}" data-sim="${id}" inputmode="decimal" value="${esc(numInput(v))}" ${extra}>${hint ? `<small class="hint">${hint}</small>` : ''}</div>`;
  const sel = (id, l, v, opts) => `<div><label for="sic-${id}">${l}</label><select id="sic-${id}" data-sim="${id}">${opts.map(([k, t]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
  const cartera = sum(S.cuentas.filter(c => c.tipo === 'inversion' && c.activa !== false), c => Calc.valor(c)), mensual = aportacionMensual();
  el.innerHTML = `
    <div class="section-head"><div><button class="btn sm ghost" data-action="sic-close">‹ Inversiones</button><h2 style="margin-top:8px">Simulador de interés compuesto</h2></div>
      <div class="btn-row">${cartera || mensual ? `<button class="btn sm" data-action="sic-cartera" title="Valor actual de tu cartera y tus aportaciones periódicas">Usar mi cartera (${fmtEUR(cartera, 0)} · ${fmtEUR(mensual, 0)}/mes)</button>` : ''}<button class="btn sm ghost" data-action="sic-reset">Restablecer</button></div></div>
    <div class="sim-wrap">
      <div class="card sim-form">
        <div class="sim-g"><div class="sim-gt">Dinero</div>
          ${campo('inicial', 'Capital inicial (€)', d.inicial)}
          ${campo('aport', 'Aportación periódica (€)', d.aport)}
          ${sel('freq', 'Cada cuánto aportas', d.freq, [[12, 'Cada mes'], [4, 'Cada trimestre'], [2, 'Cada semestre'], [1, 'Cada año']])}
          ${sel('momento', 'Momento de la aportación', d.momento, [['inicio', 'Al principio del periodo'], ['final', 'Al final del periodo']])}
          ${campo('subida', 'Subida anual de la aportación (%)', d.subida, '', 'Ej. 2 % para subirla con el sueldo')}
        </div>
        <div class="sim-g"><div class="sim-gt">Tiempo y rentabilidad</div>
          ${campo('anios', 'Duración (años)', d.anios)}
          ${campo('meses', 'Meses adicionales', d.meses)}
          ${campo('rent', 'Rentabilidad anual esperada (%)', d.rent, '', 'Bruta, antes de comisiones')}
          ${sel('cap', 'Capitalización del interés', d.cap, [[365, 'Diaria'], [12, 'Mensual'], [4, 'Trimestral'], [2, 'Semestral'], [1, 'Anual']])}
          ${campo('escenario', 'Margen de escenarios (± puntos)', d.escenario, '', 'Para el pesimista y el optimista')}
        </div>
        <div class="sim-g"><div class="sim-gt">Costes y realidad</div>
          ${campo('ter', 'Comisiones anuales (%)', d.ter, '', 'TER del fondo + custodia')}
          ${campo('infl', 'Inflación anual (%)', d.infl, '', 'Para ver el valor en euros de hoy')}
          <div class="sim-chk"><label class="chk"><input type="checkbox" id="sic-impuestos" data-sim="impuestos" ${d.impuestos ? 'checked' : ''}> Restar el IRPF al rescatar todo al final (19 %–30 %)</label></div>
          ${campo('objetivo', 'Objetivo (€) · opcional', d.objetivo, '', 'Calcula cuánto aportar o cuántos años faltan')}
        </div>
      </div>
      <div id="sic-res"></div>
    </div>`;
  pintarSimulacion();
}
function leerSim() {
  const d = simDatos();
  $$('[data-sim]').forEach(el => { const k = el.dataset.sim;
    if (el.type === 'checkbox') d[k] = el.checked;
    else if (el.tagName === 'SELECT') d[k] = k === 'momento' ? el.value : num(el.value);
    else { const n = parseNum(el.value); d[k] = n === null || isNaN(n) ? 0 : n; } });
  simGuardar(d); return d;
}
function pintarSimulacion() {
  const box = $('#sic-res'); if (!box) return;
  const d = leerSim(), r = simular(d);
  const marg = num(d.escenario), pes = simular(d, num(d.rent) - marg), opt = simular(d, num(d.rent) + marg);
  const obj = num(d.objetivo), aNec = aportacionPara(d, obj), yNec = aniosPara(d, obj);
  const multip = r.aportado > 0 ? r.saldo / r.aportado : null, duplica = r.efNeta > 0 ? Math.log(2) / Math.log(1 + r.efNeta) : null;
  const pctInt = r.saldo > 0 ? r.intereses / r.saldo : 0;
  const freqTxt = { 12: 'al mes', 4: 'al trimestre', 2: 'al semestre', 1: 'al año' }[d.freq] || '';
  const durTxt = `${fmtNum(Math.floor(r.anios), 0)} años${r.n % 12 ? ` y ${r.n % 12} meses` : ''}`;
  box.innerHTML = `
    <div class="card sim-hero">
      <div class="sh-l">Valor final en ${durTxt}</div>
      <div class="sh-v">${fmtEUR(r.saldo, 0)}</div>
      <div class="sh-bar"><span class="a" style="flex:${Math.max(r.aportado, 0)}"></span><span class="g" style="flex:${Math.max(r.intereses, 0)}"></span></div>
      <div class="sh-leg"><span><i class="a"></i>Aportado <b>${fmtEUR(r.aportado, 0)}</b></span><span><i class="g"></i>Intereses <b>${fmtEUR(r.intereses, 0)}</b> (${fmtPct(pctInt, 0)} del total)</span></div>
    </div>
    <div class="sim-kpis">
      <div class="sk"><span>Ganancia</span><b class="${r.ganancia >= 0 ? 'pos' : 'neg'}">${signed(r.ganancia)}</b><small>${multip ? `× ${fmtNum(multip, 2)} lo aportado` : ''}</small></div>
      <div class="sk"><span>Comisiones pagadas</span><b class="neg">${fmtEUR(r.comisiones, 0)}</b><small>${r.saldo > 0 ? fmtPct(r.comisiones / (r.saldo + r.comisiones), 1) + ' del valor' : ''}</small></div>
      <div class="sk"><span>${d.impuestos ? 'Neto tras IRPF' : 'Sin impuestos'}</span><b>${fmtEUR(r.neto, 0)}</b><small>${d.impuestos ? `IRPF ${fmtEUR(r.imp, 0)}` : 'Marca la casilla para restarlo'}</small></div>
      <div class="sk"><span>En euros de hoy</span><b>${fmtEUR(d.impuestos ? r.realNeto : r.real, 0)}</b><small>con ${fmtNum(num(d.infl), 1)} % de inflación</small></div>
      <div class="sk"><span>Rentabilidad efectiva</span><b>${fmtPct(r.efNeta, 2)}</b><small>anual neta de comisiones (bruta ${fmtPct(r.efBruta, 2)})</small></div>
      <div class="sk"><span>Tu dinero se duplica en</span><b>${duplica ? `${fmtNum(duplica, 1)} años` : '—'}</b><small>sin contar aportaciones</small></div>
    </div>
    ${obj > 0 ? `<div class="card sim-obj"><b>Objetivo ${fmtEUR(obj, 0)}</b>
      <div>${r.saldo >= obj ? `✅ Lo alcanzas: te sobran <b>${fmtEUR(r.saldo - obj, 0)}</b>.` : `Te faltan <b>${fmtEUR(obj - r.saldo, 0)}</b>.`}</div>
      <div>Aportación necesaria en ${durTxt}: <b>${aNec === null ? '—' : fmtEUR(aNec)} ${freqTxt}</b>${num(d.subida) ? ` (subiendo un ${fmtNum(num(d.subida), 1)} % al año)` : ''}.</div>
      <div>Con tu aportación actual llegas en: <b>${yNec === null ? 'más de 80 años' : `${fmtNum(yNec, 1)} años`}</b>.</div></div>` : ''}
    <div class="card"><div class="card-head"><h3>Evolución</h3><span class="sub">Escenarios: ${fmtNum(num(d.rent) - marg, 1)} % · ${fmtNum(num(d.rent), 1)} % · ${fmtNum(num(d.rent) + marg, 1)} %</span></div>
      <div class="chart-box"><canvas id="ch-sic"></canvas></div>
      <div class="sim-esc">
        <div><span>Pesimista</span><b>${fmtEUR(pes.saldo, 0)}</b></div><div><span>Esperado</span><b>${fmtEUR(r.saldo, 0)}</b></div><div><span>Optimista</span><b>${fmtEUR(opt.saldo, 0)}</b></div>
      </div></div>
    <div class="card"><div class="card-head"><h3>Año a año</h3>${num(d.subida) ? `<span class="sub">Aportación del último año: ${fmtEUR(r.aportFinal)} ${freqTxt}</span>` : ''}</div>
      <div class="tbl-wrap sim-tbl"><table class="tbl"><thead><tr><th>Año</th><th class="right">Aportas</th><th class="right">Intereses del año</th><th class="right">Comisiones</th><th class="right">Total aportado</th><th class="right">Intereses acum.</th><th class="right">Valor</th><th class="right">En € de hoy</th></tr></thead>
      <tbody>${r.anual.map(a => `<tr><td>${a.meses % 12 ? `${a.anio - 1} a. ${a.meses % 12} m.` : a.anio}</td><td class="right num">${fmtEUR(a.aport, 0)}</td><td class="right num pos">${fmtEUR(a.int, 0)}</td><td class="right num neg">${fmtEUR(a.com, 0)}</td>
        <td class="right num">${fmtEUR(a.aportado, 0)}</td><td class="right num">${fmtEUR(a.intereses, 0)}</td><td class="right num"><b>${fmtEUR(a.saldo, 0)}</b></td><td class="right num muted">${fmtEUR(a.real, 0)}</td></tr>`).join('')}</tbody></table></div></div>`;
  const labels = r.anual.map(a => a.meses % 12 ? `${(a.meses / 12).toFixed(1)}` : `Año ${a.anio}`);
  mkChart('ch-sic', { type: 'bar', data: { labels, datasets: [
    { label: 'Aportado', data: r.anual.map(a => round2(a.aportado)), backgroundColor: '#64748b', stack: 's', order: 3 },
    { label: 'Intereses', data: r.anual.map(a => round2(a.intereses)), backgroundColor: '#16a34a', stack: 's', order: 3 },
    { type: 'line', label: 'Pesimista', data: pes.anual.map(a => round2(a.saldo)), borderColor: '#f59e0b', borderDash: [5, 4], pointRadius: 0, tension: .25, order: 1 },
    { type: 'line', label: 'Optimista', data: opt.anual.map(a => round2(a.saldo)), borderColor: '#7c3aed', borderDash: [5, 4], pointRadius: 0, tension: .25, order: 1 },
    { type: 'line', label: 'En € de hoy', data: r.anual.map(a => round2(a.real)), borderColor: Tema.oscuro() ? '#e2e8f0' : '#0f1f3a', pointRadius: 0, tension: .25, order: 1 }
  ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmtEUR(c.parsed.y, 0)}` } } },
    scales: { y: { ...euroAxis, stacked: true }, x: { stacked: true, grid: { display: false } } } } });
}

Object.assign(Actions, {
  'sic-open': () => { S.invSim = true; S.invSel = null; render(); window.scrollTo(0, 0); },
  'sic-close': () => { S.invSim = false; render(); window.scrollTo(0, 0); },
  'sic-reset': () => { simGuardar(SIM_DEF); render(); },
  'sic-cartera': () => { const d = simDatos();
    d.inicial = round2(sum(S.cuentas.filter(c => c.tipo === 'inversion' && c.activa !== false), c => Calc.valor(c))); d.aport = round2(aportacionMensual()); d.freq = 12;
    simGuardar(d); render(); }
});
// Cualquier cambio en el formulario recalcula sin repintar los campos (no se pierde el foco)
['inicial', 'aport', 'subida', 'anios', 'meses', 'rent', 'ter', 'infl', 'objetivo', 'escenario'].forEach(k => { Inputs['sic-' + k] = () => pintarSimulacion(); });
['freq', 'momento', 'cap', 'impuestos'].forEach(k => { Changes['sic-' + k] = () => pintarSimulacion(); });
