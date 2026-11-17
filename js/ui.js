'use strict';
/* =====================================================================
   COMPONENTES DE INTERFAZ
   ---------------------------------------------------------------------
   Toasts, loader, modales, formularios genéricos, selects y piezas de tarjetas.
   Depende de: utilidades.js, estado.js
   ===================================================================== */

function toast(msg, type = 'ok', ms = 3200) {
  const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), ms);
}
function loading(on, txt = 'Cargando…') { $('#loader').classList.toggle('hidden', !on); $('#loader-txt').textContent = txt; }
async function withSaving(btn, fn, okMsg, busyTxt = 'Guardando…') {
  const orig = btn ? btn.innerHTML : null;
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin"></span> ${busyTxt}`; }
  setConn('busy', 'Guardando…');
  try { const r = await fn(); if (okMsg) toast(okMsg, 'ok'); setConn('ok', 'Conectado'); return r; }
  catch (e) { console.error(e); setConn(S.connected ? 'ok' : 'err', S.connected ? 'Conectado' : 'Error'); toast('Error: ' + (e.message || e), 'err', 5000); return FAIL; }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = orig; } }
}
function modal(html, { onClose } = {}) {
  const back = document.createElement('div'); back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="modal-x" type="button" aria-label="Cerrar">×</button>${html}</div>`;
  $('#modal-root').appendChild(back);
  let closed = false;
  const close = () => { if (closed) return; closed = true; back.remove(); if (onClose) onClose(); };
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  back.querySelector('.modal-x').addEventListener('click', close);
  const first = back.querySelector('input:not([type=checkbox]):not([type=hidden]),select');
  if (first && window.innerWidth > 700) setTimeout(() => { if (!back.contains(document.activeElement)) first.focus(); }, 50); // no robar el foco si ya estás escribiendo
  return { el: back.querySelector('.modal'), close };
}
function confirmDlg(msg, okLabel = 'Confirmar', danger = true) {
  return new Promise(res => {
    const m = modal(`<h3>Confirmar</h3><p style="line-height:1.5">${msg}</p><div class="actions"><button class="btn ghost" data-c="0">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-c="1">${okLabel}</button></div>`, { onClose: () => res(false) });
    m.el.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; res(b.dataset.c === '1'); m.close(); });
  });
}
function fieldHtml(f, v) {
  const id = 'f_' + f.name; let input;
  switch (f.type) {
    case 'select': {
      const opts = typeof f.options === 'function' ? f.options(v) : f.options;
      input = `<select id="${id}" name="${f.name}">${opts.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(v ?? '') ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`; break;
    }
    case 'rawselect': input = `<select id="${id}" name="${f.name}">${f.html(v)}</select>`; break;
    case 'textarea': input = `<textarea id="${id}" name="${f.name}" placeholder="${esc(f.ph || '')}">${esc(v ?? '')}</textarea>`; break;
    case 'checkbox': input = `<label class="chk"><input type="checkbox" id="${id}" name="${f.name}" ${v === false ? '' : (v || f.def) ? 'checked' : ''}> ${esc(f.label)}</label>`; break;
    case 'number': input = `<input id="${id}" name="${f.name}" inputmode="decimal" autocomplete="off" value="${esc(numInput(v))}" placeholder="${esc(f.ph || '0,00')}">`; break;
    case 'int': input = `<input id="${id}" name="${f.name}" type="number" step="1" inputmode="numeric" value="${esc(v ?? '')}">`; break;
    default: input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v ?? (f.type === 'color' ? '#1e3a5f' : ''))}" placeholder="${esc(f.ph || '')}" autocomplete="off">`;
  }
  return `<div class="${f.full ? 'full ' : ''}${f.cls || ''}">${f.type === 'checkbox' ? '' : `<label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>`}${input}${f.hint ? `<small class="hint">${f.hint}</small>` : ''}</div>`;
}
function collect(form, fields) {
  const o = {};
  for (const f of fields) {
    const el = form.elements[f.name]; if (!el) continue;
    if (f.type === 'checkbox') o[f.name] = el.checked;
    else if (f.type === 'number') { const n = parseNum(el.value); o[f.name] = (n === null || isNaN(n)) ? null : round2(n); }
    else if (f.type === 'int') o[f.name] = el.value === '' ? null : parseInt(el.value, 10);
    else o[f.name] = el.value.trim() === '' ? null : el.value.trim();
  }
  return o;
}
function openForm({ title, fields, values = {}, submitLabel = 'Guardar', onSubmit, intro = '', onMount }) {
  const m = modal(`<h3>${esc(title)}</h3>${intro}<form class="form-grid" novalidate>${fields.map(f => fieldHtml(f, values[f.name])).join('')}
    <div class="full actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn primary">${submitLabel}</button></div></form>`);
  const form = m.el.querySelector('form');
  m.el.querySelector('[data-close]').addEventListener('click', m.close);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const vals = collect(form, fields);
    for (const f of fields) {
      if (f.required && (vals[f.name] === null || vals[f.name] === '')) { toast(`Falta el campo: ${f.label}`, 'warn'); return; }
      if (f.type === 'number' && form.elements[f.name] && form.elements[f.name].value.trim() !== '' && vals[f.name] === null) { toast(`Número no válido en: ${f.label}`, 'warn'); return; }
    }
    const r = await withSaving(form.querySelector('[type=submit]'), () => onSubmit(vals, form));
    if (r !== FAIL) { m.close(); render(); }
  });
  if (onMount) onMount(form, m);
  return m;
}

/* ---------- Opciones de selects ---------- */
function accOpts(sel, { exclude = null, empty = null, soloActivas = true } = {}) {
  const list = [...S.cuentas].sort(byOrden).filter(c => c.id !== exclude && (!soloActivas || c.activa !== false || c.id === sel));
  return (empty !== null ? `<option value="">${esc(empty)}</option>` : '') +
    list.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}${c.entidad ? ' · ' + esc(c.entidad) : ''}</option>`).join('');
}
function catOptsTipo(tipo, sel) {
  return S.categorias.filter(c => c.tipo === tipo && !c.parent_id).sort(byOrden).map(r =>
    `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(r.nombre)}</option>` +
    childrenOf(r.id).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>   ↳ ${esc(c.nombre)}</option>`).join('')).join('');
}
const catOpts = (tipo, sel, empty = '— Sin categoría —') => `<option value="">${empty}</option>` + catOptsTipo(tipo, sel);
const catOptsAll = sel => `<option value="">— Sin categoría —</option><optgroup label="GASTOS">${catOptsTipo('gasto', sel)}</optgroup><optgroup label="INGRESOS">${catOptsTipo('ingreso', sel)}</optgroup>`;
const subOpts = sel => Object.entries(SUBTIPO).map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${l}</option>`).join('');

/* ---------- Piezas de tarjetas ---------- */
/** Indicador: título, dato grande y, si hay detalle, un ⓘ que lo muestra (visible = true lo deja a la vista). */
const KPI_TXT = new Map(); let _kpiN = 0;
const kpi = (l, v, s = '', cls = '', visible = false) => {
  let info = '';
  if (s && !visible) { const id = 'k' + (++_kpiN); KPI_TXT.set(id, { t: String(l).replace(/<[^>]+>/g, '').trim(), s }); if (KPI_TXT.size > 400) KPI_TXT.delete(KPI_TXT.keys().next().value);
    info = ` <button class="info-btn" data-action="kpi-txt" data-id="${id}" title="Más detalle">ⓘ</button>`; }
  return `<div class="kpi ${cls}"><div class="l">${l}${info}</div><div class="v">${v}</div>${s && visible ? `<div class="s">${s}</div>` : ''}</div>`;
};
/** KPI que se puede pulsar para ver el detalle (lista de movimientos). */
const kpiLink = (k, l, v, s = '', cls = '') => `<div class="kpi ${cls} clickable" data-action="dash-detalle" data-k="${k}" role="button" tabindex="0" title="Ver el detalle">${'<div class="l">' + l + '</div>'}<div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}<span class="kpi-arrow" aria-hidden="true">›</span></div>`;
const metric = (l, v, cls = '') => `<div class="metric"><div class="l">${l}</div><div class="v ${cls}">${v}</div></div>`;
const pctBar = (p, cls = '') => `<div class="bar ${cls}"><span style="width:${Math.max(0, Math.min(100, (p || 0) * 100)).toFixed(1)}%"></span></div>`;

Object.assign(Actions, {
  'kpi-txt': el => { const x = KPI_TXT.get(el.dataset.id); if (!x) return;
    const m = modal(`<h3>${esc(x.t)}</h3><div class="exp" style="margin-top:10px"><p>${x.s}</p></div><div class="actions" style="margin-top:12px"><button class="btn primary" data-close>Entendido</button></div>`);
    m.el.querySelector('[data-close]').addEventListener('click', m.close); }
});
