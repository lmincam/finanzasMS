'use strict';
/* =====================================================================
   CUENTAS · PROVISIÓN DE ANUALIDADES
   ---------------------------------------------------------------------
   Las categorías con presupuesto ANUAL (seguros, IBI, ITV…) se reparten en
   12 meses: cada mes se pasa 1/12 de cada una a la cuenta de anualidades,
   y de ahí se pagan cuando llegan. Esta tarjeta dice cuánto pasar, cuánto
   llevas este mes y si el saldo alcanza para los próximos cargos.
   Depende de: calculos.js (presAnual, cuentaAnualidades), ui.js
   ===================================================================== */

/** Partidas anuales: { c, anual, mensual, ultimo (último cargo), proximo (AAAA-MM previsto), meses (desde el último cargo) }. */
function partidasAnuales() {
  const hoyYm = ymOf(todayISO());
  return S.categorias.filter(c => c.tipo === 'gasto' && presAnual(c)).map(c => {
    const ids = c.parent_id ? [c.id] : [c.id, ...childrenOf(c.id).map(x => x.id)];
    const cargos = S.movimientos.filter(m => m.tipo === 'gasto' && ids.includes(m.categoria_id) && num(m.importe) < 0).sort((a, b) => a.fecha < b.fecha ? 1 : -1);
    const ultimo = cargos[0] || null;
    const proximo = ultimo ? addMonths(ymOf(ultimo.fecha), 12) : null;
    return { c, anual: presAnual(c), mensual: round2(presAnual(c) / 12), ultimo, proximo, meses: ultimo ? Math.max(0, monthsDiff(ymOf(ultimo.fecha) + '-01', hoyYm + '-01')) : null };
  }).sort((a, b) => (a.proximo || '9999') < (b.proximo || '9999') ? -1 : 1);
}

function renderAnualidadesCard() {
  const items = partidasAnuales();
  const ca = cuentaAnualidades();
  const selCuenta = `<select id="anual-cuenta" title="Cuenta donde apartas las anualidades">
      <option value="">— Elige la cuenta de anualidades —</option>${accOpts(ca ? ca.id : '')}</select>`;
  if (!items.length) return ''; // sin pagos anuales no ocupa sitio (se configuran en Presupuestos)
  if (false) return `<div class="card"><div class="card-head"><h3>🗓️ Anualidades</h3>${selCuenta}</div>
    <div class="small muted">Aún no tienes pagos anuales. En 🏷️ Categorías, edita una categoría (p. ej. Seguros) y pon su presupuesto como <b>Anual</b>: aquí verás cuánto pasar cada mes a ${ca ? `<b>${esc(ca.nombre)}</b>` : 'tu cuenta de anualidades'}.</div></div>`;

  const total = round2(sum(items, 'mensual')), hoy = todayISO(), ym = mesActual();
  // Lo que ya has pasado este mes: entradas en la cuenta de anualidades (transferencias desde otras cuentas)
  const pasado = ca ? round2(sum(S.movimientos.filter(m => m.cuenta_id === ca.id && cicloDe(m.fecha) === ym && num(m.importe) > 0 && m.tipo === 'transferencia'), 'importe')) : 0;
  const falta = round2(Math.max(0, total - pasado));
  const saldo = ca ? Calc.valor(ca) : null;
  // Cargos previstos en los próximos 3 meses frente al saldo apartado
  const lim = addMonths(ym, 3), proximos = items.filter(x => x.proximo && x.proximo >= ym && x.proximo < lim);
  const necesario = round2(sum(proximos, 'anual'));
  const aviso = ca && proximos.length && saldo < necesario
    ? `<div class="banner amber" style="margin:10px 0 0">⚠ En los próximos 3 meses vencen ${proximos.map(x => esc(x.c.nombre)).join(', ')} (<strong>${fmtEUR(necesario)}</strong>) y en ${esc(ca.nombre)} hay ${fmtEUR(saldo)}: faltan <strong>${fmtEUR(necesario - saldo)}</strong>.</div>` : '';

  return `<div class="card anual-card">
    <div class="card-head"><div><h3>🗓️ Anualidades</h3><div class="small muted">Pagos anuales repartidos en 12 meses</div></div>${selCuenta}</div>
    <div class="anual-hero">
      <div><div class="small muted">Pasa cada mes${ca ? ` a <b>${esc(ca.nombre)}</b>` : ''}</div><div class="anual-big">${fmtEUR(total)}</div>
        <div class="small muted">${items.map(x => fmtEUR(x.mensual)).join(' + ')}</div></div>
      ${ca ? `<div><div class="small muted">Este mes (${ymLabel(ym)})</div>
        <div class="anual-mid ${falta > 0 ? 'neg' : 'pos'}">${falta > 0 ? `Faltan ${fmtEUR(falta)}` : '✅ Hecho'}</div>
        <div class="small muted">Pasado: ${fmtEUR(pasado)} de ${fmtEUR(total)}</div></div>
      <div><div class="small muted">Saldo apartado</div><div class="anual-mid">${fmtEUR(saldo)}</div><div class="small muted">No cuenta como fondo de emergencia</div></div>`
      : '<div class="small muted" style="align-self:center">Elige arriba la cuenta donde apartas este dinero para ver lo que llevas pasado este mes y el saldo.</div>'}
    </div>
    ${aviso}
    <div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Pago anual</th><th class="right">Al año</th><th class="right">Al mes</th><th>Último cargo</th><th>Próximo previsto</th></tr></thead><tbody>
      ${items.map(x => `<tr><td><span class="cdot" style="background:${esc(x.c.color || '#94a3b8')}"></span>${x.c.parent_id ? `<span class="muted">${esc((catById(x.c.parent_id) || {}).nombre || '')} ›</span> ` : ''}${esc(x.c.nombre)}</td>
        <td class="right num">${fmtEUR(x.anual)}</td><td class="right num"><b>${fmtEUR(x.mensual)}</b></td>
        <td>${x.ultimo ? `${fmtDate(x.ultimo.fecha)} <span class="small muted">${fmtEUR(-num(x.ultimo.importe))}</span>` : '<span class="muted">—</span>'}</td>
        <td>${x.proximo ? ymLabel(x.proximo) : '<span class="muted">—</span>'}</td></tr>`).join('')}
      <tr class="root"><td><b>Total</b></td><td class="right num"><b>${fmtEUR(sum(items, 'anual'))}</b></td><td class="right num"><b>${fmtEUR(total)}</b></td><td colspan="2"></td></tr>
    </tbody></table></div>
    <div class="small muted" style="margin-top:8px">Para que cuente como "pasado", registra la transferencia ${ca ? `hacia ${esc(ca.nombre)}` : 'a la cuenta de anualidades'} con tipo <b>Transferencia</b> (+ Movimiento → Transferencia). Cuando llegue un cargo anual, la app ya no lo trata como gasto extraordinario ni como presupuesto superado del mes.</div>
  </div>`;
}

Object.assign(Changes, {
  'anual-cuenta': async el => {
    const r = await withSaving(null, async () => {
      await DB.upsert('ajustes', { clave: 'cuenta_anualidades', valor: { id: el.value }, updated_at: new Date().toISOString() }, 'clave');
      const row = (S.ajustesRows = S.ajustesRows || []).find(x => x.clave === 'cuenta_anualidades');
      if (row) row.valor = { id: el.value }; else S.ajustesRows.push({ clave: 'cuenta_anualidades', valor: { id: el.value } });
    }, 'Cuenta de anualidades guardada');
    if (r !== FAIL) render();
  }
});
