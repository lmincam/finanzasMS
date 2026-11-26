'use strict';
/* =====================================================================
   PESTAÑA · PATRIMONIO (resumen)
   ---------------------------------------------------------------------
   Es lo primero que se ve al entrar en Patrimonio: patrimonio neto de la
   familia, en qué está (liquidez, inversiones, inmuebles, vehículos) y
   qué se debe (hipoteca, préstamos). Cada recuadro abre su apartado.
   Depende de: calculos.js, ui.js, inversiones.js, inmuebles.js, vehiculos.js
   ===================================================================== */

function renderResumenPatrimonio() {
  const el = $('#tab-patrimonio');
  const P = Calc.patrimonio();
  const ca = cuentaAnualidades();
  const det = P.det.filter(d => d.tipo !== 'inversion');
  const grupo = f => sum(det.filter(f), 'valor');
  const corrientes = grupo(d => d.tipo === 'corriente'), efectivo = grupo(d => d.tipo === 'efectivo');
  const ahorro = grupo(d => d.tipo === 'ahorro' && (!ca || d.id !== ca.id)), anual = ca ? grupo(d => d.id === ca.id) : 0;

  // Inversiones: valor al último cierre (precios diarios) y lo aportado de tu bolsillo
  const inv = S.cuentas.filter(c => c.tipo === 'inversion' && c.activa !== false).map(c => ({ c, x: invInfo(c), A: valorAutoCuenta(c) }));
  const invAp = sum(inv, o => o.x.aportado), invPlus = P.inversiones - invAp;
  const fechaCierre = inv.map(o => o.A && o.A.fecha).filter(Boolean).sort().pop() || null;

  const inm = S.inmuebles.map(i => ({ i, x: inmuebleInfo(i) }));
  const inmCoste = sum(inm, o => o.x.coste), inmPlus = P.inmuebles - inmCoste;
  const veh = S.vehiculos, vehDep = sum(veh, 'valor_compra') - P.vehiculos;

  const deudas = S.deudas.filter(d => d.activa !== false).map(d => ({ d, x: deudaInfo(d) }));
  const deudaTipo = t => deudas.filter(o => (t === 'hipoteca' ? o.d.tipo === 'hipoteca' : o.d.tipo !== 'hipoteca'));
  const hip = deudaTipo('hipoteca'), prest = deudaTipo('otros');
  const cuotaMes = sum(deudas, o => o.x.cuota);

  // Variación desde el último cierre de mes guardado
  const prev = S.patrimonio_mensual.filter(x => x.anio_mes < ymOf(todayISO())).sort((a, b) => a.anio_mes < b.anio_mes ? 1 : -1)[0];
  const varMes = prev ? P.neto - num(prev.patrimonio_neto) : null;

  const comp = [
    ['Liquidez', P.liquidez, '#0ea5e9'], ['Inversiones', P.inversiones, '#7c3aed'], ['Inmuebles', P.inmuebles, '#1e3a8a'], ['Vehículos', P.vehiculos, '#f59e0b']
  ].filter(c => c[1] > 0);
  const pctA = v => P.activos > 0 ? v / P.activos : 0;
  const linea = (l, v, extra = '') => `<div class="pz-l"><span>${l}</span><b>${fmtEUR(v, 0)}</b>${extra}</div>`;
  const caja = ({ k, tab, ico, titulo, valor, pie = '', lineas = '', cls = '' }) => `
    <div class="card pz-box ${cls}" data-action="tab" data-tab="${tab}" role="button" tabindex="0" data-k="${k}">
      <div class="pz-top"><div class="pz-ico">${ico}</div><div class="pz-t">${titulo}</div><span class="pz-go">›</span></div>
      <div class="pz-v">${valor}</div>${pie ? `<div class="pz-pie">${pie}</div>` : ''}
      ${lineas ? `<div class="pz-lines">${lineas}</div>` : ''}
    </div>`;

  el.innerHTML = `
    <div class="pz-hero card">
      <div class="pz-hero-main">
        <div class="pz-hl">Patrimonio neto de la familia <button class="info-btn" data-action="kpi-info" data-k="patrimonio" title="¿Qué incluye?">ⓘ</button></div>
        <div class="pz-hv">${fmtEUR(P.neto, 0)}</div>
        ${typeof pertOk === 'function' && pertOk() && pertTotales().n ? `<div class="pz-hs pz-ampl" data-action="tab" data-tab="pertenencias" role="button">Con pertenencias: <b>${fmtEUR(P.neto + pertTotales().venta, 0)}</b></div>` : ''}
        ${varMes !== null ? `<div class="pz-hs"><span class="${varMes >= 0 ? 'pos' : 'neg'}"><b>${signed(varMes)}</b></span> desde ${ymLabel(prev.anio_mes)}</div>` : ''}
      </div>
      <div class="pz-hero-side">
        <div><span>Lo que tenéis</span><b>${fmtEUR(P.activos, 0)}</b></div>
        <div><span>Lo que debéis</span><b class="neg">−${fmtEUR(P.deudas, 0)}</b></div>
        <div><span>Endeudamiento</span><b>${P.activos > 0 ? fmtPct(P.deudas / P.activos, 0) : '—'}</b></div>
      </div>
      ${comp.length ? `<div class="pz-bar">${comp.map(c => `<span style="flex:${c[1]};background:${c[2]}" title="${c[0]}: ${fmtEUR(c[1], 0)}"></span>`).join('')}</div>
      <div class="pz-leg">${comp.map(c => `<span><i style="background:${c[2]}"></i>${c[0]} <b>${fmtPct(pctA(c[1]), 0)}</b></span>`).join('')}</div>` : ''}
    </div>

    <div class="pz-sec">Lo que tenéis</div>
    <div class="pz-grid ${typeof pertOk === 'function' && pertOk() ? 'pz-grid-5' : ''}">
      ${caja({ k: 'liquidez', tab: 'cuentas', ico: icono('wallet'), titulo: 'Liquidez disponible', valor: fmtEUR(P.liquidez, 0),
        lineas: [corrientes ? linea('Cuentas corrientes', corrientes) : '', ahorro ? linea('Ahorro / fondo de emergencia', ahorro) : '', anual ? linea('Anualidades (apartado)', anual) : '', efectivo ? linea('Efectivo', efectivo) : ''].join('') })}
      ${caja({ k: 'inversiones', tab: 'inversiones', ico: icono('trend'), titulo: 'Inversiones', valor: fmtEUR(P.inversiones, 0),
        pie: fechaCierre ? `Al cierre del ${fmtDate(fechaCierre)}` : inv.length ? 'Valor manual' : 'Sin cuentas de inversión',
        lineas: inv.length ? linea('Aportado de tu bolsillo', invAp) + `<div class="pz-l"><span>Ganancia</span><b class="${invPlus >= 0 ? 'pos' : 'neg'}">${signed(invPlus)}${invAp > 0 ? ` · ${fmtPct(invPlus / invAp)}` : ''}</b></div>` : '' })}
      ${caja({ k: 'inmuebles', tab: 'inmuebles', ico: icono('home'), titulo: 'Inmuebles', valor: fmtEUR(P.inmuebles, 0),
        pie: inm.length ? `${inm.length} inmueble(s) · valor estimado de venta` : 'Sin inmuebles',
        lineas: inm.length ? inm.map(o => linea(esc(o.i.nombre), o.x.vm)).join('') + (inmCoste ? `<div class="pz-l"><span>Plusvalía latente</span><b class="${inmPlus >= 0 ? 'pos' : 'neg'}">${signed(inmPlus)}</b></div>` : '') : '' })}
      ${caja({ k: 'vehiculos', tab: 'vehiculos', ico: icono('car'), titulo: 'Vehículos', valor: fmtEUR(P.vehiculos, 0),
        pie: veh.length ? `${veh.length} vehículo(s)` : 'Sin vehículos',
        lineas: veh.map(v => linea(esc(v.nombre), num(v.valor_actual))).join('') + (vehDep > 0 ? `<div class="pz-l"><span>Depreciación acumulada</span><b class="neg">−${fmtEUR(vehDep, 0)}</b></div>` : '') })}
      ${typeof pertOk === 'function' && pertOk() ? (T => caja({ k: 'pertenencias', tab: 'pertenencias', ico: icono('bag'), titulo: 'Pertenencias', cls: 'pz-pert', lineas: T.n ? linea('Coste de reponerlo todo', T.repo) : '',
        valor: T.n ? fmtEUR(T.venta, 0) : '—', pie: T.n ? `Venta estimada · no suma al neto` : 'Tecnología, muebles, bebé… (no suma al neto)' }))(pertTotales()) : ''}
    </div>

    <div class="pz-sec">Lo que debéis</div>
    <div class="pz-grid pz-grid-2">
      ${caja({ k: 'hipoteca', tab: 'deudas', ico: icono('bank'), titulo: 'Hipoteca', cls: hip.length ? 'pz-debt' : 'pz-debt pz-cero', valor: hip.length ? `−${fmtEUR(sum(hip, o => o.x.pendienteHoy), 0)}` : '0 €',
        pie: hip.length ? `Cuota ${fmtEUR(sum(hip, o => o.x.cuota))}/mes` : 'Sin hipoteca',
        lineas: hip.length > 1 ? hip.map(o => linea(esc(o.d.nombre), o.x.pendienteHoy)).join('') : '' })}
      ${caja({ k: 'prestamos', tab: 'deudas', ico: icono('card'), titulo: 'Préstamos personales y otros', cls: prest.length ? 'pz-debt' : 'pz-debt pz-cero', valor: prest.length ? `−${fmtEUR(sum(prest, o => o.x.pendienteHoy), 0)}` : '0 €',
        pie: prest.length ? `Cuota ${fmtEUR(sum(prest, o => o.x.cuota))}/mes` : 'Sin préstamos',
        lineas: prest.map(o => linea(`${esc(o.d.nombre)} <small class="muted">${esc(TIPO_DEUDA[o.d.tipo] || '')}</small>`, o.x.pendienteHoy)).join('') })}
    </div>
    ${cuotaMes ? `<div class="small muted pz-nota">Pagáis ${fmtEUR(cuotaMes)} al mes en cuotas de préstamos.</div>` : ''}

    <div class="pz-sec">Seguimiento</div>
    <div class="pz-grid pz-grid-1">
      ${caja({ k: 'evolucion', tab: 'auditoria', ico: icono('chart'), titulo: 'Evolución del patrimonio', valor: prev ? `${signed(P.neto - num(prev.patrimonio_neto))}` : '—',
        pie: prev ? `Respecto al cierre de ${ymLabel(prev.anio_mes)}` : 'Histórico de cierres y fotos trimestrales' })}

    </div>`;
}

Views.patrimonio = renderResumenPatrimonio;
