'use strict';
/* =====================================================================
   CHEQUEO DE DATOS (Ajustes › Revisar mis datos)
   ---------------------------------------------------------------------
   Repasa los datos reales buscando lo que suele descuadrar las cifras:
   duplicados, transferencias sin pareja o descuadradas, devoluciones
   huérfanas, movimientos sin categoría o con cuenta/categoría borrada,
   fechas raras, saldos imposibles y préstamos que no cuadran.
   Solo lee: cada aviso lleva a su movimiento para corregirlo a mano.
   Depende de: calculos.js, cuentas.js, deudas.js
   ===================================================================== */

function chequeoDatos() {
  const hoy = todayISO(), M = S.movimientos, secciones = [];
  const add = (nivel, titulo, explica, items, ver = 'mov') => secciones.push({ nivel, titulo, explica, items, ver });
  const cta = id => cuentaById(id), catOk = id => !id || !!catById(id);

  // 1. Posibles duplicados: misma cuenta, fecha, importe y concepto
  const grupos = new Map();
  for (const m of M) {
    if (m.tipo === 'transferencia') continue;
    const k = [m.cuenta_id, m.fecha, round2(num(m.importe)), normText(m.concepto || '')].join('|');
    (grupos.get(k) || grupos.set(k, []).get(k)).push(m);
  }
  add('alto', 'Posibles movimientos duplicados', 'Misma cuenta, fecha, importe y concepto. Si no son dos cargos reales, borra uno: inflan gastos e ingresos.',
    [...grupos.values()].filter(g => g.length > 1).map(g => g[0]));

  // 2. Transferencias sin pareja o descuadradas
  const tr = M.filter(m => m.tipo === 'transferencia');
  const porId = new Map(); for (const m of tr) if (m.transfer_id) (porId.get(m.transfer_id) || porId.set(m.transfer_id, []).get(m.transfer_id)).push(m);
  add('alto', 'Transferencias sin su otra mitad', 'Una transferencia mueve dinero entre dos cuentas tuyas: le falta el movimiento de la otra cuenta, así que una de las dos tiene el saldo mal.',
    tr.filter(m => m.transfer_id ? porId.get(m.transfer_id).length < 2 : !tr.some(x => x !== m && x.cuenta_id === m.cuenta_contraria_id && Math.abs(num(x.importe) + num(m.importe)) < 0.01 && Math.abs(diasEntre(x.fecha, m.fecha)) <= 3)));
  add('alto', 'Transferencias con importes distintos en cada cuenta', 'Lo que sale de una cuenta debe ser exactamente lo que entra en la otra.',
    [...porId.values()].filter(g => g.length === 2 && Math.abs(num(g[0].importe) + num(g[1].importe)) > 0.009).map(g => g[0]));

  // 3. Devoluciones
  add('alto', 'Devoluciones de un gasto que ya no existe', 'Están vinculadas a un gasto borrado: restan de una categoría sin su gasto.',
    M.filter(m => m.reembolso_de && !M.some(x => x.id === m.reembolso_de)));
  add('medio', 'Devoluciones mayores que el gasto', 'Te devolvieron más de lo que pagaste: revisa el vínculo o el importe.',
    M.filter(m => m.reembolso_de && num(m.importe) > 0).filter(m => { const o = M.find(x => x.id === m.reembolso_de); return o && sum(M.filter(x => x.reembolso_de === o.id), 'importe') > Math.abs(num(o.importe)) + 0.01; }));
  add('bajo', 'Gastos en positivo sin vincular', 'Un gasto con importe positivo que no es la devolución de nada. Si es un reembolso (Bizum, tienda), vincúlalo con «Es la devolución de un gasto».',
    M.filter(m => m.tipo === 'gasto' && num(m.importe) > 0 && !m.reembolso_de));
  add('medio', 'Ingresos en negativo', 'Un ingreso con importe negativo resta de los ingresos: suele ser un gasto mal clasificado.',
    M.filter(m => m.tipo === 'ingreso' && num(m.importe) < 0));

  // 4. Referencias rotas
  add('alto', 'Movimientos de una cuenta borrada', 'No suman en ninguna cuenta.', M.filter(m => !cta(m.cuenta_id)));
  add('alto', 'Movimientos con una categoría borrada', 'No aparecen en su categoría del presupuesto.', M.filter(m => !catOk(m.categoria_id)));
  add('medio', 'Movimientos sin categoría (últimos 120 días)', 'Van a «Sin categoría» en el presupuesto y en los gráficos.',
    M.filter(m => m.tipo !== 'transferencia' && !m.categoria_id && !m.reembolso_de && m.fecha >= addDias(hoy, -120)));

  // 5. Fechas
  add('medio', 'Movimientos con fecha futura', 'Cuentan ya en el saldo de hoy aunque todavía no han pasado.', M.filter(m => m.fecha > hoy));
  add('bajo', 'Imputados a un mes muy lejano', 'Su «mes» está a más de 2 meses de la fecha del cargo: revisa el mes de imputación.',
    M.filter(m => m.mes_imputacion && Math.abs(monthsDiff(ymOf(m.fecha) + '-01', ymOf(m.mes_imputacion) + '-01')) > 2));
  add('medio', 'Apuntados tras conciliar, con fecha anterior', 'No suman al saldo de su cuenta. Ábrelos desde la tarjeta de la cuenta para que cuenten si hace falta.',
    M.filter(m => typeof Calc.fueraDeSaldo === 'function' && Calc.fueraDeSaldo(m)));

  // 6. Cuentas
  add('alto', 'Cuentas del día a día con saldo negativo', 'El efectivo o una cuenta corriente en negativo casi siempre es un movimiento de más o un saldo inicial mal puesto.',
    S.cuentas.filter(c => c.activa !== false && (c.tipo === 'efectivo' || c.tipo === 'corriente') && Calc.valor(c) < -0.005), 'cuenta');

  // 7. Préstamos
  const deudas = S.deudas.filter(d => d.activa !== false && (num(d.interes) || num(d.cuota_mensual)));
  add('alto', 'Préstamos que pueden no cuadrar', 'El capital pendiente (y tu patrimonio) puede no ser el real. Entra en el préstamo para ver qué revisar.',
    deudas.filter(d => typeof avisosCuadreDeuda === 'function' && avisosCuadreDeuda(d).length), 'deuda');

  return secciones;
}

function abrirChequeo() {
  const sec = chequeoDatos(), con = sec.filter(s => s.items.length), sin = sec.filter(s => !s.items.length);
  const orden = { alto: 0, medio: 1, bajo: 2 };
  con.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
  const fila = (s, x) => {
    if (s.ver === 'cuenta') return `<div class="ch-r"><span>${esc(x.nombre)}</span><b class="neg">${fmtEUR(Calc.valor(x))}</b></div>`;
    if (s.ver === 'deuda') return `<div class="ch-r ch-go" data-go-deuda="${x.id}"><span>${esc(x.nombre)}</span><span class="ch-ver">Ver ›</span></div>`;
    const c = cuentaById(x.cuenta_id);
    return `<div class="ch-r ch-go" data-go-mov="${x.id}"><span>${fmtDate(x.fecha).slice(0, 8)} · ${esc(x.concepto || '—')}${c ? ` <small>· ${esc(c.nombre)}</small>` : ''}</span><b class="${num(x.importe) < 0 ? 'neg' : 'pos'}">${fmtEUR(num(x.importe))}</b></div>`;
  };
  const md = modal(`<h3 style="margin-bottom:2px">Revisión de tus datos</h3>
    <div class="small muted" style="margin-bottom:12px">${con.length ? `${con.length} punto${con.length > 1 ? 's' : ''} que revisar · ${S.movimientos.length} movimientos analizados` : `Todo en orden · ${S.movimientos.length} movimientos analizados`}</div>
    ${con.map(s => `<details class="ch-sec ${s.nivel}" ${s.nivel === 'alto' ? 'open' : ''}><summary><span class="ch-dot"></span><b>${s.titulo}</b><span class="ch-n">${s.items.length}</span></summary>
      <div class="small muted" style="margin:4px 0 8px">${s.explica}</div>${s.items.slice(0, 30).map(x => fila(s, x)).join('')}${s.items.length > 30 ? `<div class="small muted">…y ${s.items.length - 30} más</div>` : ''}</details>`).join('')}
    ${sin.length ? `<div class="ch-ok">✅ Sin problemas: ${sin.map(s => s.titulo.toLowerCase()).join(' · ')}.</div>` : ''}
    <div class="actions"><button class="btn primary" data-close>Cerrar</button></div>`);
  md.el.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return md.close();
    const m = e.target.closest('[data-go-mov]'), d = e.target.closest('[data-go-deuda]');
    if (m) { md.close(); Actions['mov-edit']({ dataset: { id: m.dataset.goMov } }); }
    if (d) { md.close(); S.tab = 'deudas'; Actions['deu-open']({ dataset: { id: d.dataset.goDeuda } }); }
  });
}
Actions['chequeo-datos'] = abrirChequeo;
