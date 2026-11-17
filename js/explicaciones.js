'use strict';
/* =====================================================================
   DASHBOARD · ¿DE DÓNDE SALE CADA DATO?
   ---------------------------------------------------------------------
   Botones ⓘ junto a cada indicador: explican qué es, cómo se calcula y
   rehacen la cuenta con tus números del periodo seleccionado.
   Depende de: calculos.js, ui.js, dashboard.js (periodLabel)
   ===================================================================== */

function explicacion(k) {
  const months = periodMonths(), st = periodStats(months), P = Calc.patrimonio(), nM = months.length;
  const per = `<b>${periodLabel(months)}</b>`;
  const linea = (l, v, cls = '') => `<div class="exp-l ${cls}"><span>${l}</span><b class="num">${v}</b></div>`;
  const nomina = `La <b>regla de nómina</b> (⚙️ Ajustes) imputa al mes siguiente los ingresos de al menos ${fmtEUR(S.ajustes.nomina_umbral, 0)} cobrados en los últimos ${S.ajustes.nomina_dias} días laborables del mes: la nómina de finales de octubre cuenta como ingreso de noviembre, que es el mes que paga.`;
  const D = {
    ingresos: () => {
      const xs = st.movs.filter(m => m.tipo === 'ingreso').sort((a, b) => num(b.importe) - num(a.importe));
      return { t: 'Ingresos imputados', h: `<p>Todo lo que ha entrado como <b>ingreso</b> (nómina, Bizum que no son devolución de un gasto, intereses…) cuyo <b>mes de imputación</b> está en ${per}.</p>
        <p>${nomina}</p><p>No cuentan las transferencias entre tus cuentas ni las devoluciones de gastos compartidos (esas restan del gasto).</p>
        <div class="exp-box">${xs.slice(0, 8).map(m => linea(`${esc(m.concepto || '—')} <span class="muted small">${fmtDate(m.fecha)}${ymOf(m.fecha) !== ymOf(m.mes_imputacion) ? ` → ${ymLabel(ymOf(m.mes_imputacion), true)}` : ''}</span>`, fmtEUR(num(m.importe)))).join('')}
        ${xs.length > 8 ? linea(`<span class="muted">… y ${xs.length - 8} más</span>`, fmtEUR(sum(xs.slice(8), 'importe'))) : ''}${linea('Total ingresos', fmtEUR(st.ingresos), 'tot')}</div>` };
    },
    gastos: () => ({ t: 'Gastos operativos', h: `<p>Lo que has <b>gastado de verdad</b> en ${per}: todos los movimientos de tipo gasto, quitando la parte de las cuotas de préstamos que es <b>capital</b> (eso no es gasto: reduce tu deuda, es ahorro). La parte de intereses sí es gasto.</p>
        <p>No incluye transferencias entre tus cuentas (pasar dinero a MyInvestor, a ahorro, a anualidades…). Las devoluciones de gastos compartidos (Bizum de amigos) restan.</p>
        <div class="exp-box">${linea('Todos los cargos de tipo gasto', fmtEUR(st.gastosCaja))}${linea('− Capital de deuda amortizado (cuotas y amortizaciones)', '− ' + fmtEUR(st.capital))}${linea('= Gastos operativos', fmtEUR(st.gastos), 'tot')}
        ${nM > 1 ? linea(`Media por mes (${nM} meses)`, fmtEUR(st.gastos / nM)) : ''}</div>` }),
    ahorro: () => {
      const inv = st.aport.inversion, res = st.aport.ahorro, resto = round2(st.ahorro - inv - res - st.capital);
      return { t: 'Capacidad de ahorro', h: `<p>Es lo que te <b>sobra</b> en ${per}: <b>ingresos imputados − gastos operativos</b>. Mide cuánto podrías ahorrar, no cuánto has movido a ahorro.</p>
        <div class="exp-box">${linea('Ingresos imputados', fmtEUR(st.ingresos))}${linea('− Gastos operativos', '− ' + fmtEUR(st.gastos))}${linea('= Capacidad de ahorro', fmtEUR(st.ahorro), 'tot')}
        ${st.ingresos > 0 ? linea('Tasa de ahorro (ahorro ÷ ingresos)', fmtPct(st.ahorro / st.ingresos)) : ''}</div>
        <p><b>¿Dónde ha ido ese dinero?</b></p>
        <div class="exp-box">${linea('A inversión (neto)', fmtEUR(inv))}${linea('A cuentas de ahorro / fondo de emergencia (neto)', fmtEUR(res))}${linea('A reducir deuda (capital de las cuotas)', fmtEUR(st.capital))}
        ${linea(resto >= 0 ? 'Se queda en tus cuentas corrientes y efectivo' : 'Has tirado de dinero que ya tenías en las cuentas', fmtEUR(resto), resto >= 0 ? '' : 'neg')}</div>
        <p class="small muted">Con el mes a medias la cifra engaña: la nómina ya está contada y faltan gastos por llegar. Una referencia sana es una tasa de ahorro del 15-20 % o más.</p>` };
    },
    inversion: () => ({ t: 'Tasa de inversión', h: `<p>Qué parte de tus ingresos de ${per} ha ido a <b>cuentas de inversión</b>: <b>aportaciones netas a inversión ÷ ingresos imputados</b>.</p>
        <p>"Neto" son las transferencias que entran en cuentas de inversión menos las retiradas hacia tus cuentas corrientes. No incluye la revalorización de la cartera, solo el dinero que pones tú.</p>
        <div class="exp-box">${linea('Aportado a inversión (neto)', fmtEUR(st.aport.inversion))}${linea('÷ Ingresos imputados', fmtEUR(st.ingresos))}${linea('= Tasa de inversión', st.ingresos > 0 ? fmtPct(st.aport.inversion / st.ingresos) : '—', 'tot')}</div>` }),
    patrimonio: () => ({ t: 'Patrimonio neto total', h: `<p>Todo lo que tienes menos todo lo que debes, <b>hoy</b> (no depende del periodo elegido).</p>
        <div class="exp-box">${linea('Liquidez (cuentas y efectivo)', fmtEUR(P.liquidez))}${linea('Inversiones (valor de mercado)', fmtEUR(P.inversiones))}${linea('Inmuebles (valor estimado)', fmtEUR(P.inmuebles))}${linea('Vehículos (valor actual)', fmtEUR(P.vehiculos))}
        ${linea('= Activos', fmtEUR(P.activos), 'tot')}${linea('− Deudas pendientes (capital vivo)', '− ' + fmtEUR(P.deudas))}${linea('= Patrimonio neto', fmtEUR(P.neto), 'tot')}</div>
        <p class="small muted">La comparación es con la foto automática del mes anterior (se guarda sola cada mes). La cuota de la hipoteca no baja tu patrimonio por la parte de capital: baja la liquidez pero también la deuda.</p>` }),
    liquidez: () => {
      const det = P.det.filter(d => d.tipo !== 'inversion' && cuentaById(d.id).activa !== false), ca = cuentaAnualidades();
      return { t: 'Liquidez disponible', h: `<p>El dinero de todas tus cuentas que no son de inversión, a día de hoy.</p>
        <ul><li><b>Operativa</b>: cuentas corrientes y efectivo, el dinero del día a día.</li><li><b>Fondo de emergencia</b>: cuentas de tipo ahorro${ca ? `, salvo <b>${esc(ca.nombre)}</b>, que es dinero apartado para pagos anuales` : ''}.</li></ul>
        <div class="exp-box">${det.map(d => linea(`${esc(d.nombre)} <span class="muted small">${ca && d.id === ca.id ? 'anualidades' : TIPO_CUENTA[d.tipo] || d.tipo}</span>`, fmtEUR(d.valor))).join('')}${linea('= Liquidez', fmtEUR(P.liquidez), 'tot')}
        ${linea('Operativa', fmtEUR(P.operativa))}${linea('Fondo de emergencia', fmtEUR(P.reserva))}${P.anualidades ? linea('Apartado para anualidades', fmtEUR(P.anualidades)) : ''}</div>` };
    },
    presupuesto: () => ({ t: 'Presupuesto vs. gastado real', h: `<p>Para cada categoría, lo que has gastado en ${per} frente a su presupuesto mensual × ${nM} ${nM === 1 ? 'mes' : 'meses'}. La <b>desviación</b> es lo que te queda (verde) o lo que te has pasado (rojo).</p>
        <ul><li><b>Más cerca del límite</b>: arriba las partidas con presupuesto que más porcentaje llevan gastado; así ves de un vistazo lo que tienes que vigilar.</li>
        <li><b>Gastos fijos</b> (hipoteca, alquiler, cuotas): van aparte y plegados, porque estar al 100 % es lo normal. La app los detecta sola (importe casi igual cada mes, o la cuota de un préstamo) y puedes marcarlos tú en 🏷️ Categorías.</li>
        <li><b>Anualidades</b> (seguros, IBI…): se comparan con su presupuesto <b>anual</b> y con lo gastado en el año, no con el mes en que se cobran.</li></ul>` }),
    internos: () => ({ t: 'Movimientos internos', h: `<p>Dinero que solo cambia de sitio entre tus cuentas en ${per}. No es gasto ni ingreso.</p>
        <div class="exp-box">${linea('Reajustes de liquidez (entre cuentas corrientes y efectivo)', fmtEUR(st.aport.liquidez))}${linea('A ahorro, neto (entradas − retiradas)', fmtEUR(st.aport.ahorro))}${linea('A inversión, neto (entradas − retiradas)', fmtEUR(st.aport.inversion))}</div>
        <p class="small muted">El tipo de cada transferencia (liquidez, ahorro o inversión) se elige al registrarla o al importar el Excel.</p>` })
  };
  return (D[k] || D.ahorro)();
}

Object.assign(Actions, {
  'kpi-info': el => {
    const x = explicacion(el.dataset.k);
    const m = modal(`<h3>ⓘ ${esc(x.t)}</h3><div class="exp">${x.h}</div><div class="actions" style="margin-top:14px"><button class="btn primary" data-close>Entendido</button></div>`);
    m.el.querySelector('[data-close]').addEventListener('click', m.close);
  }
});
