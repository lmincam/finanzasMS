'use strict';
/* =====================================================================
   PESTAÑA · CUENTAS Y MOVIMIENTOS
   ---------------------------------------------------------------------
   Cuentas operativas, listado de movimientos, registro rápido y edición.
   Depende de: datos.js, calculos.js, ui.js, importador.js
   ===================================================================== */

const FIELDS_CUENTA = [
  { name: 'nombre', label: 'Nombre', required: true }, { name: 'entidad', label: 'Entidad', ph: 'Unicaja, MyInvestor…' },
  { name: 'tipo', label: 'Tipo', type: 'select', options: [{ v: 'corriente', l: 'Corriente (operativa)' }, { v: 'ahorro', l: 'Ahorro / fondo de emergencia' }, { v: 'efectivo', l: 'Efectivo' }, { v: 'inversion', l: 'Inversión' }] },
  { name: 'color', label: 'Color', type: 'color' },
  { name: 'saldo_inicial', label: 'Saldo de partida (€)', type: 'number', hint: 'Saldo real a cierre del día indicado' }, { name: 'fecha_saldo_inicial', label: 'Fecha del saldo', type: 'date' },
  { name: 'orden', label: 'Orden', type: 'int' }, { name: 'activa', label: 'Cuenta activa', type: 'checkbox', def: true }
];

function abrirMenuCuenta(id) {
  const c = cuentaById(id); if (!c) return; const inv = c.tipo === 'inversion';
  const saldo = Calc.valor(c), k = conciliacionDe(c.id);
  const op = (a, ic, t, st = '') => `<button class="mv-op" data-op="${a}" ${st}><span>${ic}</span>${t}</button>`;
  const md = modal(`<h3 style="margin-bottom:2px">${esc(c.nombre)}</h3>
    <div class="small muted" style="margin-bottom:12px">${esc(c.entidad || '')}${c.entidad ? ' · ' : ''}${TIPO_CUENTA[c.tipo] || c.tipo} · <b class="${saldo < 0 ? 'neg' : ''}">${fmtEUR(saldo)}</b></div>
    ${k ? `<div class="acc-det ${Math.abs(num(k.dif)) < 0.01 ? 'ok' : 'warn'}">🏦 ${Math.abs(num(k.dif)) < 0.01 ? '✅ Cuadra con el banco' : `⚠ Descuadre de ${signed(num(k.dif))} con el banco`} <span class="muted">· ${fmtDate(k.fecha)}</span></div>` : ''}
    ${resumenAnualidades(c)}
    <div class="mv-ops">
    ${inv ? op('cuenta-valor', '📈', 'Actualizar valor') : op('cuenta-conciliar', '🏦', 'Conciliar saldo con el banco')}
    ${op('mov-filtrar-cuenta', '🔎', 'Ver sus movimientos')}
    ${op('cuenta-edit', '✎', 'Editar')}${op('cuenta-del', '🗑', 'Eliminar', 'style="color:var(--red)"')}</div>`);
  md.el.addEventListener('click', e => { if (e.target.closest('[data-action="anual-ver"]')) { md.close(); return; } const b = e.target.closest('[data-op]'); if (!b) return; md.close();
    if (b.dataset.op === 'mov-filtrar-cuenta') { S.movFilter.cuenta = id; S.movLimit = 150; renderCuentas(); const l = $('.mv-head'); if (l) l.scrollIntoView({ behavior: 'smooth' }); return; }
    Actions[b.dataset.op]({ dataset: { id } }); });
}
Actions['cuenta-menu'] = el => abrirMenuCuenta(el.dataset.id);
function renderCuentas() {
  const el = $('#tab-cuentas');
  const P = Calc.patrimonio();
  // Liquidez en cuadrícula 2×2: arriba corriente y efectivo, abajo ahorro (fondo de emergencia) y anualidades
  const ca = cuentaAnualidades();
  const grupo = c => c.tipo === 'corriente' ? 0 : c.tipo === 'efectivo' ? 1 : ca && c.id === ca.id ? 3 : c.tipo === 'ahorro' ? 2 : 4;
  const liq = [...S.cuentas].filter(c => c.tipo !== 'inversion').sort((a, b) => (grupo(a) - grupo(b)) || byOrden(a, b));
  const cards = liq.map(c => {
    const saldo = Calc.saldo(c), val = Calc.valor(c), inv = c.tipo === 'inversion';
    const tieneVM = inv && c.valor_mercado !== null && c.valor_mercado !== undefined;
    const plus = val - saldo;
    return `<div class="acc-card clickable ${c.activa === false ? 'off' : ''}" style="--acc:${esc(c.color || '#1e3a5f')}" data-action="cuenta-menu" data-id="${c.id}" role="button" tabindex="0" title="Conciliar, ver movimientos, editar…">
      <div class="acc-top"><div><div class="acc-name">${esc(c.nombre)}</div><div class="acc-sub">${esc(c.entidad || '')}${c.entidad ? ' · ' : ''}${TIPO_CUENTA[c.tipo] || c.tipo}</div></div>
        ${c.activa === false ? '<span class="badge">Inactiva</span>' : ''}</div>
      <div class="acc-val ${val < 0 ? 'neg' : ''}">${fmtEUR(val)}</div>
      ${tieneVM ? `<div class="acc-meta">Aportado neto: ${fmtEUR(saldo)} · <b class="${plus >= 0 ? 'pos' : 'neg'}">${signed(plus)}</b> ${saldo ? `(${fmtPct(plus / saldo)})` : ''}</div><div class="acc-meta">Valor de mercado a ${fmtDate(c.fecha_valor_mercado)} + aportaciones posteriores</div>`
        : ''}
      <span class="acc-go" aria-hidden="true">›</span></div>`;
  }).join('');

  el.innerHTML = `
    <div class="section-head"><div><h2>Cuentas</h2><div class="acc-total"><span>Liquidez total</span> <b>${fmtEUR(P.liquidez)}</b>${partidasAnuales().length && !cuentaAnualidades() ? ` · <a href="#" data-action="anual-ver">elige tu cuenta de anualidades</a>` : ''}</div></div>
      <div class="acc-btns">
        <button class="btn" data-action="cuenta-new">+ Cuenta</button>
        <button class="btn" data-action="quick-open" data-tipo="gasto">+ Movimiento</button>
        <button class="btn" data-action="quick-open" data-tipo="transferencia">⇄ Transferencia</button>
        <button class="btn btn-ico" data-action="imp-open" title="Importar extracto del banco (Excel o CSV)" aria-label="Importar extracto del banco">${icono('upload')}</button>
      </div></div>
    <div class="acc-grid acc-liq ${liq.length === 4 ? 'acc-4' : ''}">${cards || '<div class="card empty">Sin cuentas</div>'}</div>
    <div class="card" id="import-card" hidden></div>

    <div class="card">
      <div class="card-head mv-head"><h3>Movimientos</h3><div class="btn-row">${chipPendientes()}
        <button class="btn sm" data-action="mov-regla" title="Imputa al mes siguiente los ingresos de los últimos días laborables del mes">⏭ Regla de nómina</button></div></div>
      <div class="mov-filters">
        <div class="mf-mes"><button class="btn ghost" data-action="mf-mes-shift" data-d="-1" aria-label="Mes anterior" ${S.movFilter.mes ? '' : 'disabled'}>‹</button><button type="button" class="mpick" data-action="mf-mes-pick">${S.movFilter.mes ? ymLabel(S.movFilter.mes) + (mesNominaActivo() ? (r => `<small class="mf-rango">${r[1] ? `${fmtDate(r[0]).slice(0, 5)} – ${fmtDate(r[1]).slice(0, 5)}` : `desde el ${fmtDate(r[0]).slice(0, 5)}`}</small>`)(rangoMesMov(S.movFilter.mes)) : '') : 'Todos los meses'}</button><button class="btn ghost" data-action="mf-mes-shift" data-d="1" aria-label="Mes siguiente" ${S.movFilter.mes ? '' : 'disabled'}>›</button></div>
        <select id="mf-cuenta">${accOpts(S.movFilter.cuenta, { empty: 'Todas las cuentas', soloActivas: false })}</select>
        <select id="mf-tipo"><option value="">Todos los tipos</option>${Object.entries(TIPO_MOV).map(([k, l]) => `<option value="${k}" ${S.movFilter.tipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input class="q" id="mf-q" type="search" placeholder="Buscar concepto…" value="${esc(S.movFilter.q)}">
      </div>
      <div id="mov-list"></div>
    </div>`;
  renderImport();
  renderMovList();
}
function filteredMovs() {
  const f = S.movFilter, q = normText(f.q);
  // Con un mes elegido se muestra su mes de nómina (de la nómina al día antes de la siguiente). Orden: lo más reciente arriba (o al revés con el botón ⇅)
  const asc = S.movOrden === 'asc', rango = f.mes ? rangoMesMov(f.mes) : null;
  return S.movimientos.filter(m => (!rango || (m.fecha >= rango[0] && (!rango[1] || m.fecha <= rango[1]))) && (!f.cuenta || m.cuenta_id === f.cuenta) && (!f.tipo || m.tipo === f.tipo) &&
    (!q || normText(`${m.concepto} ${m.notas || ''}`).includes(q)))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.tipo === 'ingreso') !== (b.tipo === 'ingreso') ? (a.tipo === 'ingreso' ? -1 : 1) : String(a.created_at).localeCompare(String(b.created_at))) * (asc ? 1 : -1));
}
/** Primer y último día del mes de nómina ym. Si la nómina que lo cierra aún no ha llegado, no tiene último día (null):
    no se adivina el día de cobro; todo lo anterior a la próxima nómina cuenta en este mes. */
function rangoMesMov(ym) {
  if (!mesNominaActivo()) { const [y, m] = ym.split('-').map(Number); return [ym + '-01', `${ym}-${pad(daysInMonth(y, m))}`]; }
  const C = ciclosNomina(), sig = addMonths(ym, 1), ini = inicioCiclo(ym);
  const fin = C.inicio[sig] ? addDias(C.inicio[sig], -1) : (sig <= mesActual() ? addDias(inicioCiclo(sig), -1) : null);
  return [ini, fin];
}
function renderMovList() {
  const box = $('#mov-list'); if (!box) return;
  const list = filteredMovs();
  const ing = sum(list.filter(m => m.tipo === 'ingreso'), 'importe'), gas = -sum(list.filter(m => m.tipo === 'gasto'), 'importe');
  const shown = list.slice(0, S.movLimit);
  // Agrupados por día, con el neto del día (sin transferencias internas)
  const grupos = []; for (const m of shown) { const g = grupos[grupos.length - 1]; if (g && g.f === m.fecha) g.ms.push(m); else grupos.push({ f: m.fecha, ms: [m] }); }
  box.innerHTML = `<div class="mv-sum"><span>${list.length} movimientos</span><span class="pos">+${fmtEUR(ing)}</span><span class="neg">−${fmtEUR(gas)}</span><button class="mf-orden" data-action="mf-orden" title="Cambiar el orden por fecha">${S.movOrden === 'asc' ? '↑ Más antiguos primero' : '↓ Más recientes primero'}</button></div>` +
    (shown.length ? grupos.map(g => { const neto = sum(g.ms.filter(m => m.tipo !== 'transferencia'), 'importe');
      return `<div class="mv-day"><span>${DIAS[weekday(g.f)]} ${fmtDate(g.f).slice(0, 5)}</span>${neto ? `<span class="${neto >= 0 ? 'pos' : 'neg'}">${signed(neto)}</span>` : ''}</div>${g.ms.map(movRow).join('')}`; }).join('')
      : '<div class="empty">No hay movimientos con estos filtros</div>') +
    (list.length > shown.length ? `<div style="text-align:center;padding:12px"><button class="btn sm" data-action="mov-more">Mostrar más (${list.length - shown.length})</button></div>` : '');
}
/** Fila de movimiento: toca la fila para editar; las acciones extra van en el menú ⋯ */
function movRow(m) {
  const cta = cuentaById(m.cuenta_id), imp = num(m.importe), isT = m.tipo === 'transferencia';
  const c = catById(m.categoria_id), r = c ? rootOf(c) : null, color = isT ? '#94a3b8' : (c && c.color) || (r && r.color) || '#cbd5e1';
  const sub = isT ? `${imp < 0 ? '→' : '←'} ${esc((cuentaById(m.cuenta_contraria_id) || {}).nombre || '?')}` : esc(catName(m.categoria_id) || 'Sin categoría');
  const tags = [];
  if (S.v6 && m.reembolso_de) {
    const o = S.movimientos.find(x => x.id === m.reembolso_de);
    tags.push(o ? `<span class="mv-ref">↩ Devolución de <b>${esc(o.concepto || '—')}</b> · ${fmtDate(o.fecha).slice(0, 5)} · ${fmtEUR(num(o.importe))}</span>` : '<span class="badge green">↩ devolución</span>');
  }
  if (S.v6 && !m.reembolso_de && imp < 0) {
    const dev = S.movimientos.filter(x => x.reembolso_de === m.id);
    if (dev.length) tags.push(`<span class="mv-ref">↩ Te devolvieron <b>${fmtEUR(sum(dev, 'importe'))}</b>${dev.length === 1 && dev[0].concepto ? ` (${esc(dev[0].concepto)})` : ''}</span>`);
  }
  if (S.v6 && num(m.a_cobrar) > 0) { const i = infoCompartido(m); tags.push(`<span class="badge ${i.pendiente > 0.01 ? 'amber' : 'green'}">👥 ${i.pendiente > 0.01 ? `te deben ${fmtEUR(i.pendiente)}` : 'cobrado'}</span>`); }
  if (!isT && ymOf(m.mes_imputacion) !== ymOf(m.fecha)) tags.push(`<span class="badge blue">→ ${ymLabel(ymOf(m.mes_imputacion), true)}</span>`);
  if (!isT && !m.categoria_id) tags.push('<span class="badge amber">sin categoría</span>');
  return `<div class="mv" data-action="mov-edit" data-id="${m.id}" role="button" tabindex="0">
    ${iconoMovimiento(m)}
    <div class="mv-main"><div class="mv-con">${esc(m.concepto || '—')}</div>
      <div class="mv-sub">${sub} · ${esc(cta ? cta.nombre : '?')}${tags.length ? ' ' + tags.join(' ') : ''}</div></div>
    <button class="mv-more" data-action="mov-menu" data-id="${m.id}" aria-label="Más acciones">⋯</button>
    <div class="mv-amt ${isT ? 'muted' : imp >= 0 ? 'pos' : 'neg'}">${signed(imp)}</div>
  </div>`;
}
/** Menú de acciones de un movimiento (en lugar de muchos botones pequeños en cada fila). */
function abrirMenuMov(m) {
  const imp = num(m.importe), op = (a, ic, t, extra = '') => `<button class="mv-op" data-action="${a}" data-id="${m.id}"><span>${ic}</span>${t}${extra}</button>`;
  const ops = [op('mov-edit', '✎', 'Editar')];
  if (m.tipo === 'ingreso') ops.push(op('mov-imput', '⏭', ymOf(m.mes_imputacion) === ymOf(m.fecha) ? 'Imputar al mes siguiente' : 'Imputar al mes de su fecha'));
  if (S.v6 && m.tipo === 'gasto' && imp < 0 && !m.reembolso_de) ops.push(op('mov-compartir', '👥', 'Gasto compartido (cuánto te deben)'));
  if (S.v6 && imp > 0 && m.tipo !== 'transferencia' && !m.reembolso_de) ops.push(op('mov-reembolso', '↩', 'Es la devolución de un gasto (Bizum…)'));
  if (S.v6 && m.reembolso_de) ops.push(op('mov-desvincular', '⛓', 'Quitar vínculo con el gasto'));
  ops.push(op('mov-icono', '🎨', 'Icono de este comercio'));
  ops.push(op('mov-hist', '🕘', 'Ver historial de cambios'));
  ops.push(op('mov-del', '🗑', 'Eliminar'));
  const md = modal(`<h3 style="margin-bottom:4px">${esc(m.concepto || 'Movimiento')}</h3><div class="small muted" style="margin-bottom:12px">${fmtDate(m.fecha)} · <b class="${imp >= 0 ? 'pos' : 'neg'}">${signed(imp)}</b></div><div class="mv-ops">${ops.join('')}</div>`);
  md.el.addEventListener('click', e => { if (e.target.closest('.mv-op')) md.close(); });
}

/* ---------- Guardado de movimientos (incluye parejas de transferencia) ---------- */
async function guardarMovimiento(d, orig) {
  const isT = d.tipo === 'transferencia';
  if (!d.cuenta_id) throw new Error('Selecciona la cuenta');
  if (!d.fecha) throw new Error('Indica la fecha');
  if (!d.importe) throw new Error('El importe no puede ser 0');
  if (isT && !d.cuenta_contraria_id) throw new Error('Indica la cuenta contraria de la transferencia');
  if (isT && d.cuenta_contraria_id === d.cuenta_id) throw new Error('Origen y destino no pueden ser la misma cuenta');
  const main = {
    cuenta_id: d.cuenta_id, fecha: d.fecha, concepto: d.concepto || '', notas: d.notas || null, importe: round2(d.importe), tipo: d.tipo,
    mes_imputacion: (isT ? ymOf(d.fecha) : (d.mes || ymOf(d.fecha))).slice(0, 7) + '-01',
    categoria_id: isT ? null : (d.categoria_id || null),
    subtipo_transferencia: isT ? (d.subtipo_transferencia || subtipoPorCuenta(cuentaById(d.importe < 0 ? d.cuenta_contraria_id : d.cuenta_id))) : null,
    cuenta_contraria_id: isT ? d.cuenta_contraria_id : null,
    transfer_id: isT ? ((orig && orig.transfer_id) || uuid()) : null
  };
  const counterpart = () => ({
    cuenta_id: main.cuenta_contraria_id, cuenta_contraria_id: main.cuenta_id, fecha: main.fecha, mes_imputacion: main.mes_imputacion,
    concepto: main.concepto, notas: main.notas, importe: -main.importe, tipo: 'transferencia', subtipo_transferencia: main.subtipo_transferencia,
    categoria_id: null, transfer_id: main.transfer_id
  });
  if (!orig) {
    const rows = [{ id: uuid(), origen: 'manual', ...main }];
    if (isT) rows.push({ id: uuid(), origen: 'manual', ...counterpart() });
    await DB.insert('movimientos', rows);
  } else {
    const other = orig.transfer_id ? S.movimientos.find(m => m.transfer_id === orig.transfer_id && m.id !== orig.id) : null;
    await DB.update('movimientos', orig.id, main);
    if (isT) { if (other) await DB.update('movimientos', other.id, counterpart()); else await DB.insert('movimientos', [{ id: uuid(), origen: 'manual', ...counterpart() }]); }
    else if (other) await DB.remove('movimientos', other.id);
  }
  await reloadTable('movimientos');
}

/* ---------- Registro rápido (pensado para móvil) ---------- */
function openQuick(tipo = 'gasto', opts = {}) {
  if (!S.connected) { toast('Configura primero Supabase en Ajustes', 'warn'); return; }
  const efectivo = S.cuentas.find(c => c.tipo === 'efectivo' && c.activa !== false);
  const principal = S.cuentas.find(c => c.tipo === 'corriente' && c.activa !== false);
  const st = { tipo };
  const m = modal(`<h3>Registro rápido</h3>
    <div class="seg" id="q-seg" style="margin-bottom:14px">${['gasto', 'ingreso', 'transferencia'].map(t => `<button type="button" data-q="${t}" class="${t === tipo ? 'active' : ''}">${{ gasto: '− Gasto', ingreso: '+ Ingreso', transferencia: '⇄ Transferencia' }[t]}</button>`).join('')}</div>
    <form id="q-form" class="form-grid" novalidate>
      <div class="full"><label>Importe (€)</label><input id="q-imp" class="big" inputmode="decimal" placeholder="0,00" autocomplete="off" value="${opts.importe ? esc(numInput(num(opts.importe))) : ''}"></div>
      <div><label>Fecha</label><input type="date" id="q-fecha" value="${todayISO()}"></div>
      <div id="q-dyn" style="display:contents"></div>
      <div class="full"><label>Concepto</label><input id="q-concepto" placeholder="Ej: Panadería, gasolina…" autocomplete="off" value="${esc(opts.concepto || '')}"></div>
      <div class="full actions"><button type="button" class="btn ghost" data-qclose>Cancelar</button><button type="submit" class="btn success">Guardar</button></div>
    </form>`);
  const dyn = () => {
    const box = m.el.querySelector('#q-dyn');
    if (st.tipo === 'transferencia') {
      const dest = opts.destino || (efectivo ? efectivo.id : '');
      box.innerHTML = `<div><label>Desde</label><select id="q-origen">${accOpts(principal && principal.id)}</select></div>
        <div><label>Hacia</label><select id="q-destino">${accOpts(dest)}</select></div>
        <div class="full"><label>Naturaleza</label><select id="q-sub">${subOpts(subtipoPorCuenta(cuentaById(dest)))}</select>
        <small class="hint">Las transferencias internas nunca computan como gasto.</small></div>`;
      box.querySelector('#q-destino').addEventListener('change', e => { box.querySelector('#q-sub').value = subtipoPorCuenta(cuentaById(e.target.value)); });
    } else {
      const defCta = st.tipo === 'gasto' ? (efectivo || principal) : (principal || efectivo);
      box.innerHTML = `<div><label>Cuenta</label><select id="q-cuenta">${accOpts(defCta && defCta.id)}</select></div>
        <div><label>Categoría</label><select id="q-cat">${catOpts(st.tipo)}</select></div>
        ${st.tipo === 'ingreso' ? `<div><label>Imputar al mes</label><input type="month" id="q-mes" value="${ymOf(todayISO())}"><small class="hint">Nóminas de final de mes → mes siguiente</small></div>` : ''}`;
      if (st.tipo === 'ingreso') {
        const upd = () => { const f = m.el.querySelector('#q-fecha').value, v = parseNum(m.el.querySelector('#q-imp').value); if (f) m.el.querySelector('#q-mes').value = reglaNominaAplica(f, v) ? addMonths(ymOf(f), 1) : ymOf(f); };
        m.el.querySelector('#q-fecha').onchange = upd; m.el.querySelector('#q-imp').onchange = upd;
      } else { m.el.querySelector('#q-fecha').onchange = null; m.el.querySelector('#q-imp').onchange = null; }
    }
  };
  dyn();
  m.el.querySelector('#q-seg').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    st.tipo = b.dataset.q; $$('#q-seg button', m.el).forEach(x => x.classList.toggle('active', x === b)); dyn();
  });
  m.el.querySelector('[data-qclose]').addEventListener('click', m.close);
  setTimeout(() => { if (!m.el.contains(document.activeElement)) m.el.querySelector('#q-imp').focus(); }, 80);
  m.el.querySelector('#q-form').addEventListener('submit', async e => {
    e.preventDefault();
    const v = parseNum(m.el.querySelector('#q-imp').value);
    if (!v || isNaN(v)) { toast('Introduce un importe válido', 'warn'); return; }
    const abs = Math.abs(v), fecha = m.el.querySelector('#q-fecha').value, concepto = m.el.querySelector('#q-concepto').value.trim();
    let d;
    if (st.tipo === 'transferencia') d = { tipo: 'transferencia', fecha, concepto: concepto || 'Transferencia interna', importe: -abs, cuenta_id: m.el.querySelector('#q-origen').value, cuenta_contraria_id: m.el.querySelector('#q-destino').value, subtipo_transferencia: m.el.querySelector('#q-sub').value };
    else d = { tipo: st.tipo, fecha, concepto, importe: st.tipo === 'gasto' ? -abs : abs, cuenta_id: m.el.querySelector('#q-cuenta').value, categoria_id: m.el.querySelector('#q-cat').value || null, mes: st.tipo === 'ingreso' ? m.el.querySelector('#q-mes').value : ymOf(fecha) };
    const r = await withSaving(e.submitter || m.el.querySelector('[type=submit]'), () => guardarMovimiento(d), 'Movimiento guardado ✓');
    if (r !== FAIL) { m.close(); render(); }
  });
}

/* ---------- Edición completa de un movimiento ---------- */
function openMovEdit(mv) {
  const fields = [
    { name: 'tipo', label: 'Tipo', type: 'select', options: Object.entries(TIPO_MOV).map(([v, l]) => ({ v, l })) },
    { name: 'fecha', label: 'Fecha operación', type: 'date', required: true },
    { name: 'cuenta_id', label: 'Cuenta', type: 'rawselect', html: v => accOpts(v, { soloActivas: false }) },
    { name: 'importe', label: 'Importe (€)', type: 'number', required: true, hint: 'Negativo = sale de la cuenta · Positivo = entra' },
    { name: 'concepto', label: 'Concepto', full: true },
    { name: 'categoria_id', label: 'Categoría', type: 'rawselect', html: v => catOptsAll(v), cls: 'only-nt' },
    { name: 'mes', label: 'Mes de imputación', type: 'month', cls: 'only-nt', hint: 'Mes al que computa en presupuestos y KPIs' },
    { name: 'cuenta_contraria_id', label: 'Cuenta contraria', type: 'rawselect', html: v => accOpts(v, { empty: '— Selecciona —', soloActivas: false }), cls: 'only-t' },
    { name: 'subtipo_transferencia', label: 'Naturaleza de la transferencia', type: 'select', options: Object.entries(SUBTIPO).map(([v, l]) => ({ v, l })), cls: 'only-t' },
    { name: 'notas', label: 'Notas / concepto original del banco', type: 'textarea', full: true }
  ];
  openForm({
    title: 'Editar movimiento', fields, values: { ...mv, mes: ymOf(mv.mes_imputacion) },
    onSubmit: vals => guardarMovimiento(vals, mv),
    onMount: form => {
      const t = () => { const isT = form.elements.tipo.value === 'transferencia'; $$('.only-t', form).forEach(x => x.style.display = isT ? '' : 'none'); $$('.only-nt', form).forEach(x => x.style.display = isT ? 'none' : ''); };
      form.elements.tipo.addEventListener('change', t); t();
    }
  });
}

Inputs['mf-q'] = el => { S.movFilter.q = el.value; S.movLimit = 150; renderMovList(); };

Views.cuentas = renderCuentas;

Object.assign(Actions, {
  'quick-open': el => { closeMenu(); return openQuick(el.dataset.tipo || 'gasto', { destino: el.dataset.destino, importe: el.dataset.importe, concepto: el.dataset.concepto }); },
  'cuenta-new': () => openForm({ title: 'Nueva cuenta', fields: FIELDS_CUENTA, values: { tipo: 'corriente', fecha_saldo_inicial: todayISO(), orden: S.cuentas.length + 1, activa: true, color: PALETTE[S.cuentas.length % PALETTE.length] },
    onSubmit: v => saveEntity('cuentas', null, zeroNulls({ ...v, fecha_saldo_inicial: v.fecha_saldo_inicial || todayISO(), ...(S.v7 ? { saldo_actualizado: new Date().toISOString() } : {}) }, ['saldo_inicial', 'orden'])) }),
  'cuenta-edit': el => { const c = cuentaById(el.dataset.id); openForm({ title: 'Editar cuenta', fields: FIELDS_CUENTA, values: c, onSubmit: v => saveEntity('cuentas', c.id, zeroNulls({ ...v, fecha_saldo_inicial: v.fecha_saldo_inicial || todayISO(), ...(S.v7 ? { saldo_actualizado: new Date().toISOString() } : {}) }, ['saldo_inicial', 'orden'])) }); },
  'cuenta-del': async el => {
    const c = cuentaById(el.dataset.id); const n = S.movimientos.filter(m => m.cuenta_id === c.id).length;
    if (!(await confirmDlg(`¿Eliminar la cuenta <b>${esc(c.nombre)}</b>?<br>Se borrarán también sus <b>${n} movimientos</b>. Si solo quieres ocultarla, edítala y desmarca “Cuenta activa”.`, 'Eliminar'))) return;
    await withSaving(null, async () => { await DB.remove('cuentas', c.id); await Promise.all([reloadTable('cuentas'), reloadTable('movimientos')]); }, 'Cuenta eliminada'); render();
  },
  'cuenta-conciliar': el => {
    const c = cuentaById(el.dataset.id);
    openForm({ title: `Conciliar saldo · ${c.nombre}`, intro: `<p class="small muted">Saldo calculado ahora: <b>${fmtEUR(Calc.saldo(c))}</b>. Introduce el saldo real que ves en el banco (o el efectivo contado) tras los movimientos de la fecha indicada. Los movimientos posteriores seguirán sumando.</p>`,
      fields: [{ name: 'saldo', label: 'Saldo real (€)', type: 'number', required: true }, { name: 'fecha', label: 'A cierre del día', type: 'date' }], values: { saldo: Calc.saldo(c), fecha: todayISO() },
      onSubmit: v => saveEntity('cuentas', c.id, Calc.fijarSaldo(c, v.saldo, v.fecha || todayISO())) });
  },
  'mov-menu': el => { const m = S.movimientos.find(x => x.id === el.dataset.id); if (m) abrirMenuMov(m); },
  'mov-edit': el => { const m = S.movimientos.find(x => x.id === el.dataset.id); if (m) openMovEdit(m); },
  'mov-del': async el => {
    const m = S.movimientos.find(x => x.id === el.dataset.id); if (!m) return;
    if (!(await confirmDlg(`¿Eliminar “${esc(m.concepto || '')}” (${fmtEUR(num(m.importe))})?${m.transfer_id ? '<br>Se eliminará también la otra pata de la transferencia.' : ''}`, 'Eliminar'))) return;
    await withSaving(null, async () => {
      // Si es una aportación periódica automática, se anota ese mes como omitido para que no se vuelva a generar
      const auto = S.movimientos.find(x => (x.id === m.id || (m.transfer_id && x.transfer_id === m.transfer_id)) && x.hash_import && x.hash_import.startsWith('auto|'));
      if (auto) { const [, pid, ym] = auto.hash_import.split('|'); const p = S.aportaciones_periodicas.find(x => x.id === pid);
        if (p) { const om = [...new Set([...(p.omitidos || []), ym])]; await DB.update('aportaciones_periodicas', p.id, { omitidos: om }); p.omitidos = om; } }
      if (m.transfer_id) await DB.removeWhere('movimientos', 'transfer_id', m.transfer_id); else await DB.remove('movimientos', m.id);
      await reloadTable('movimientos');
    }, 'Movimiento eliminado');
    render();
  },
  'mov-imput': async el => {
    const m = S.movimientos.find(x => x.id === el.dataset.id); if (!m) return;
    const nuevo = ymOf(m.mes_imputacion) === ymOf(m.fecha) ? addMonths(ymOf(m.fecha), 1) : ymOf(m.fecha);
    const r = await withSaving(null, async () => { await DB.update('movimientos', m.id, { mes_imputacion: nuevo + '-01' }); m.mes_imputacion = nuevo + '-01'; }, `Imputado a ${ymLabel(nuevo)}`);
    if (r !== FAIL) renderMovList();
  },
  'mov-regla': async el => {
    const cands = S.movimientos.filter(m => m.tipo === 'ingreso' && ymOf(m.mes_imputacion) === ymOf(m.fecha) && reglaNominaAplica(m.fecha, m.importe));
    if (!cands.length) { toast('No hay ingresos pendientes de aplicar la regla', 'ok'); return; }
    if (!(await confirmDlg(`Se imputarán al mes siguiente <b>${cands.length}</b> ingreso(s) cobrados en los últimos ${S.ajustes.nomina_dias} días laborables del mes con importe ≥ ${fmtEUR(S.ajustes.nomina_umbral)}:<br><br><span class="small">${cands.slice(0, 8).map(m => `${fmtDate(m.fecha)} · ${esc(m.concepto)} · ${fmtEUR(num(m.importe))}`).join('<br>')}${cands.length > 8 ? '<br>…' : ''}</span>`, 'Aplicar', false))) return;
    await withSaving(el, async () => {
      for (let i = 0; i < cands.length; i += 10) await Promise.all(cands.slice(i, i + 10).map(m => DB.update('movimientos', m.id, { mes_imputacion: addMonths(ymOf(m.fecha), 1) + '-01' })));
      await reloadTable('movimientos');
    }, 'Regla de nómina aplicada ✓', 'Aplicando…');
    render();
  },
  'mf-orden': () => { S.movOrden = S.movOrden === 'asc' ? 'desc' : 'asc'; try { localStorage.setItem('pf_mov_orden', S.movOrden); } catch (e) {} renderMovList(); },
  'mov-allmonths': () => { S.movFilter.mes = ''; S.movLimit = 150; renderCuentas(); },
  'mf-mes-pick': () => selectorMes({ valor: S.movFilter.mes, titulo: 'Movimientos de…', todos: true, onPick: ym => { S.movFilter.mes = ym; S.movLimit = 150; renderCuentas(); } }),
  'mf-mes-shift': el => { if (!S.movFilter.mes) return; S.movFilter.mes = addMonths(S.movFilter.mes, +el.dataset.d); S.movLimit = 150; renderCuentas(); },
  'mov-more': () => { S.movLimit += 300; renderMovList(); }
});

Object.assign(Changes, {
  'mf-mes': el => { S.movFilter.mes = el.value; S.movLimit = 150; renderMovList(); },
  'mf-cuenta': el => { S.movFilter.cuenta = el.value; S.movLimit = 150; renderMovList(); },
  'mf-tipo': el => { S.movFilter.tipo = el.value; S.movLimit = 150; renderMovList(); }
});

// Al cargar, Movimientos abre en el mes de nómina en curso (no en el mes natural)
AfterLoad.push(() => { if (!S._mfIni) { S._mfIni = true; try { S.movOrden = localStorage.getItem('pf_mov_orden') || 'desc'; } catch (e) {} if (S.movFilter.mes === ymOf(todayISO())) S.movFilter.mes = mesActual(); } });
