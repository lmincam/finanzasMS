'use strict';
/* =====================================================================
   PESTAÑA · INMUEBLES
   ---------------------------------------------------------------------
   Valoración, plusvalía y rentabilidad de alquiler. El €/m² de venta se
   actualiza solo cada trimestre con el Índice de Precios de Vivienda del
   INE (segunda mano, por comunidad autónoma) que descarga la tarea
   automática de GitHub (scripts/vivienda.mjs → ajustes.indice_vivienda).
   Depende de: datos.js, calculos.js, ui.js
   ===================================================================== */

function renderInmuebles() {
  const el = $('#tab-inmuebles');
  const infos = S.inmuebles.map(i => ({ i, x: inmuebleInfo(i) }));
  const totVM = sum(infos, o => o.x.vm), totPlus = sum(infos, o => o.x.plusvalia), totNeto = sum(infos, o => o.x.neto);
  el.innerHTML = `
    <div class="section-head"><div><h2>Inmuebles</h2><div class="small muted">${S.inmuebles.length} inmueble(s)${ipvInfo() ? ` · precios de la zona actualizados a ${ipvInfo().ultimo}` : ''}</div></div>
      <button class="btn" data-action="inm-new">+ Inmueble</button></div>
    ${S.inmuebles.length ? `<div class="kpis">
      ${kpi('Valor de los inmuebles', fmtEUR(totVM, 0), '', 'navy', true)}
      ${kpi('Plusvalía latente', `<span class="${totPlus >= 0 ? 'pos' : 'neg'}">${signed(totPlus)}</span>`, '', totPlus >= 0 ? 'pos' : 'neg')}
      ${kpi('Valor neto (sin hipoteca)', fmtEUR(totNeto, 0), '')}
    </div>` : ''}
    ${infos.map(({ i, x }) => `<div class="card">
      <div class="asset-head"><div class="asset-ico">🏠</div><div style="flex:1"><h3>${esc(i.nombre)}</h3><div class="small muted">${esc(i.descripcion || '')}${i.direccion ? ' · ' + esc(i.direccion) : ''}${i.fecha_valoracion ? ` · Valorado a ${fmtDate(i.fecha_valoracion)}` : ''}</div></div>
        <button class="mini" data-action="inm-edit" data-id="${i.id}">✎</button><button class="mini" data-action="inm-del" data-id="${i.id}">🗑</button></div>
      ${bloqueM2(i, x)}
      <div class="sub-title">Valoración patrimonial</div>
      <div class="metrics">
        ${metric('Coste de adquisición', fmtEUR(x.coste, 0))}${metric('Valor de mercado', fmtEUR(x.vm, 0))}
        ${metric('Plusvalía latente', `${signed(x.plusvalia)} <span class="small">${fmtPct(x.plusPct)}</span>`, x.plusvalia >= 0 ? 'pos' : 'neg')}
        ${metric('Hipoteca pendiente', fmtEUR(x.deuda, 0), 'neg')}${metric('Valor neto', fmtEUR(x.neto, 0))}${metric('LTV (deuda/valor)', fmtPct(x.ltv))}
      </div>
      <div class="sub-title">Rentabilidad potencial si se alquilase</div>
      ${x.renta ? `<div class="metrics">
        ${metric('Renta mensual estimada', fmtEUR(x.renta))}${metric('Rent. bruta s/ valor', fmtPct(x.brutaVM, 2))}${metric('Rent. bruta s/ coste', fmtPct(x.brutaCoste, 2))}
        ${metric('Rent. neta s/ valor', fmtPct(x.netaVM, 2), 'pos')}${metric('Rent. neta s/ coste', fmtPct(x.netaCoste, 2), 'pos')}
        ${metric('Cash-flow mensual tras cuota', fmtEUR(x.cashflow), x.cashflow >= 0 ? 'pos' : 'neg')}
      </div>`
      : '<div class="small muted">Introduce una renta mensual estimada (✎) para calcular la rentabilidad bruta y neta.</div>'}
      ${segurosDe('inmueble_id', i.id)}
      ${i.notas ? `<div class="notes">${esc(i.notas)}</div>` : ''}
    </div>`).join('') || `<div class="card"><div class="empty">Aún no has añadido ningún inmueble.<br><br><button class="btn primary" data-action="inm-new">+ Añadir el primero</button></div></div>`}`;
  infos.forEach(({ i }, k) => chartM2(`ch-m2-${k}`, i));
}

/* ---------- Valoración automática por €/m² ---------- */
const CCAA = [
  ['andalucia', 'Andalucía'], ['aragon', 'Aragón'], ['asturias', 'Asturias'], ['balears', 'Illes Balears'], ['canarias', 'Canarias'], ['cantabria', 'Cantabria'],
  ['leon', 'Castilla y León'], ['mancha', 'Castilla-La Mancha'], ['cataluna', 'Cataluña'], ['valenciana', 'Comunitat Valenciana'], ['extremadura', 'Extremadura'],
  ['galicia', 'Galicia'], ['madrid', 'Comunidad de Madrid'], ['murcia', 'Región de Murcia'], ['navarra', 'Navarra'], ['vasco', 'País Vasco'], ['rioja', 'La Rioja'],
  ['ceuta', 'Ceuta'], ['melilla', 'Melilla']
];
/** Provincias: [clave, nombre, comunidad]. La clave es la que usa la tarea de GitHub (scripts/vivienda.mjs). */
const PROVINCIAS = [
  ['alava', 'Álava', 'vasco'], ['albacete', 'Albacete', 'mancha'], ['alicante', 'Alicante', 'valenciana'], ['almeria', 'Almería', 'andalucia'], ['asturias', 'Asturias', 'asturias'],
  ['avila', 'Ávila', 'leon'], ['badajoz', 'Badajoz', 'extremadura'], ['balears', 'Illes Balears', 'balears'], ['barcelona', 'Barcelona', 'cataluna'], ['bizkaia', 'Bizkaia', 'vasco'],
  ['burgos', 'Burgos', 'leon'], ['caceres', 'Cáceres', 'extremadura'], ['cadiz', 'Cádiz', 'andalucia'], ['cantabria', 'Cantabria', 'cantabria'], ['castellon', 'Castellón', 'valenciana'],
  ['ceuta', 'Ceuta', 'ceuta'], ['ciudad real', 'Ciudad Real', 'mancha'], ['cordoba', 'Córdoba', 'andalucia'], ['coruna', 'A Coruña', 'galicia'], ['cuenca', 'Cuenca', 'mancha'],
  ['gipuzkoa', 'Gipuzkoa', 'vasco'], ['girona', 'Girona', 'cataluna'], ['granada', 'Granada', 'andalucia'], ['guadalajara', 'Guadalajara', 'mancha'], ['huelva', 'Huelva', 'andalucia'],
  ['huesca', 'Huesca', 'aragon'], ['jaen', 'Jaén', 'andalucia'], ['leon_p', 'León', 'leon'], ['lleida', 'Lleida', 'cataluna'], ['lugo', 'Lugo', 'galicia'], ['madrid', 'Madrid', 'madrid'],
  ['malaga', 'Málaga', 'andalucia'], ['melilla', 'Melilla', 'melilla'], ['murcia', 'Murcia', 'murcia'], ['navarra', 'Navarra', 'navarra'], ['ourense', 'Ourense', 'galicia'],
  ['palencia', 'Palencia', 'leon'], ['palmas', 'Las Palmas', 'canarias'], ['pontevedra', 'Pontevedra', 'galicia'], ['rioja', 'La Rioja', 'rioja'], ['salamanca', 'Salamanca', 'leon'],
  ['tenerife', 'Santa Cruz de Tenerife', 'canarias'], ['segovia', 'Segovia', 'leon'], ['sevilla', 'Sevilla', 'andalucia'], ['soria', 'Soria', 'leon'], ['tarragona', 'Tarragona', 'cataluna'],
  ['teruel', 'Teruel', 'aragon'], ['toledo', 'Toledo', 'mancha'], ['valencia', 'Valencia', 'valenciana'], ['valladolid', 'Valladolid', 'leon'], ['zamora', 'Zamora', 'leon'], ['zaragoza', 'Zaragoza', 'aragon']
];
/** Zona del inmueble (columna ccaa): una provincia ('granada') o, en fichas antiguas, una comunidad ('andalucia'). */
function zonaDe(i) {
  const k = i && i.ccaa; if (!k) return null;
  const p = PROVINCIAS.find(x => x[0] === k), c = CCAA.find(x => x[0] === (p ? p[2] : k));
  return { prov: p ? p[0] : null, provNombre: p ? p[1] : null, ccaa: c ? c[0] : null, ccaaNombre: c ? c[1] : null };
}
/* ---------- Índice de Precios de Vivienda (INE) ---------- */
/** Datos que guarda la tarea automática: { actualizado, ultimo:'2026T2', series: { madrid: { '2025T4': 2.1, … }, nacional: {…} } } (variación trimestral %). */
function ipvInfo() { const r = (S.ajustesRows || []).find(x => x.clave === 'indice_vivienda'); return r && r.valor && r.valor.series ? r.valor : null; }
const trimestreDe = iso => `${iso.slice(0, 4)}T${Math.floor((+iso.slice(5, 7) - 1) / 3) + 1}`;
const cmpTrim = (a, b) => a < b ? -1 : a > b ? 1 : 0;   // 'AAAAT1' se ordena bien como texto
/** Factor acumulado de precios desde el trimestre de la fecha base (sin incluirlo) hasta el último publicado. */
function factorIPV(i, fechaBase) {
  const I = ipvInfo(), z = zonaDe(i); if (!I || !z || !fechaBase) return null;
  // Lo más cercano que haya: provincia (Ministerio de Vivienda) → comunidad (INE) → España
  const opciones = [[z.prov && I.series['p:' + z.prov], z.provNombre, 'Ministerio de Vivienda'], [I.series[z.ccaa], z.ccaaNombre, 'INE'], [I.series.nacional, 'España', 'INE']];
  const [serie, ambito, fuente] = opciones.find(o => o[0] && Object.keys(o[0]).length) || []; if (!serie) return null;
  const tb = trimestreDe(fechaBase), qs = Object.keys(serie).filter(q => cmpTrim(q, tb) > 0).sort(cmpTrim);
  return { factor: qs.reduce((f, q) => f * (1 + num(serie[q]) / 100), 1), desde: tb, hasta: qs.length ? qs[qs.length - 1] : tb, n: qs.length, ambito, fuente };
}
/** €/m² de venta de la zona actualizado con el INE a partir del último valor que metiste tú. */
function m2Actualizado(i) {
  if (!num(i.precio_m2_base) || !i.fecha_m2_base) return null;
  const f = factorIPV(i, i.fecha_m2_base); if (!f) return null;
  return { ...f, m2: round2(num(i.precio_m2_base) * f.factor) };
}
/** Tras cada carga: si el INE ha publicado un trimestre nuevo, actualiza €/m², valor y el histórico (una vez por trimestre). */
async function actualizarInmueblesIPV() {
  if (!S.v11 || S.offline || !ipvInfo()) return;
  let cambios = 0;
  for (const i of S.inmuebles) {
    if (i.valor_automatico === false) continue;
    const u = m2Actualizado(i); if (!u || u.n === 0 || i.trimestre_ipv === u.hasta) continue;
    const v = { ...stripInm(i), precio_m2_venta: u.m2, fecha_precio_m2: todayISO(), trimestre_ipv: u.hasta };
    await guardarInmueble(i.id, v, { auto: true }); cambios++;
  }
  if (cambios) toast(`🏠 Precio de venta actualizado con el INE (${ipvInfo().ultimo})`, 'ok', 4000);
}
AfterLoad.push(actualizarInmueblesIPV);

function bloqueM2(i, x) {
  if (!S.v4) return '';
  const idx = S.inmuebles.indexOf(i), hist = S.precios_m2.filter(p => p.inmueble_id === i.id);
  if (!x.m2) return `<div class="banner blue">Añade los m² construidos, tu comunidad autónoma y el precio medio €/m² de tu zona (✎). A partir de ahí el precio de venta se actualiza solo cada trimestre.</div>`;
  const car = ajusteCaracteristicas(i), u = S.v11 ? m2Actualizado(i) : null, I = ipvInfo();
  const auto = i.valor_automatico !== false;
  const revisar = i.fecha_m2_base && diasEntre(i.fecha_m2_base, todayISO()) > 365;
  const estado = !S.v11 ? '' : !i.ccaa ? '<div class="banner amber" style="margin-bottom:10px">Indica la provincia (✎) para que el precio se actualice solo cada trimestre.</div>'
    : !I ? '<div class="banner blue" style="margin-bottom:10px">Esperando los datos oficiales: la tarea automática los descarga en su próxima ejecución.</div>'
    : revisar ? `<div class="banner blue" style="margin-bottom:10px">Ha pasado un año desde tu €/m² de referencia: compruébalo en el <a href="${NOTARIADO}" target="_blank" rel="noopener">portal del notariado ↗</a> buscando tu código postal. <button class="btn sm" data-action="inm-m2" data-id="${i.id}">Corregir</button></div>` : '';
  return `<div class="sub-title">Valor de venta estimado ${auto ? '<span class="badge green">se actualiza solo</span>' : '<span class="badge">manual</span>'}</div>
    ${estado}
    <div class="inm-calc">
      <div class="ic-big"><span>Precio de venta estimado</span><b>${x.ventaCalc !== null ? fmtEUR(x.ventaCalc, 0) : '—'}</b>
        <small>${fmtNum(x.m2, 0)} m² × ${i.precio_m2_venta ? fmtEUR(i.precio_m2_venta, 0) : '—'}/m²${(num(i.ajuste_pct) + car.pct) ? ` × ${fmtPct((num(i.ajuste_pct) + car.pct) / 100 + 1, 0)}` : ''}${num(i.valor_anejos) ? ` + anejos ${fmtEUR(i.valor_anejos, 0)}` : ''}</small></div>
      <div class="ic-steps">
        <div><span>€/m² de referencia que metiste</span><b>${i.precio_m2_base ? `${fmtEUR(i.precio_m2_base, 0)} <small>(${fmtDate(i.fecha_m2_base)})</small>` : i.precio_m2_venta ? fmtEUR(i.precio_m2_venta, 0) : '—'}</b></div>
        ${u && u.n ? `<div><span>Evolución ${esc(u.ambito)} <small class="muted">(${u.fuente})</small> ${u.desde} → ${u.hasta}</span><b class="${u.factor >= 1 ? 'pos' : 'neg'}">${u.factor >= 1 ? '+' : ''}${fmtNum((u.factor - 1) * 100, 1)} %</b></div>` : ''}
        <div><span>€/m² de la zona hoy</span><b>${i.precio_m2_venta ? fmtEUR(i.precio_m2_venta, 0) : '—'}</b></div>
        ${car.partes.map(p => `<div class="ic-aj"><span>${esc(p[0])}</span><b>${p[1] > 0 ? '+' : ''}${p[1]} %</b></div>`).join('')}
        ${num(i.ajuste_pct) ? `<div class="ic-aj"><span>Ajuste adicional</span><b>${num(i.ajuste_pct) > 0 ? '+' : ''}${fmtNum(num(i.ajuste_pct), 1)} %</b></div>` : ''}
      </div>
    </div>
    <div class="metrics" style="margin-top:10px">
      ${metric('€/m² alquiler zona', i.precio_m2_alquiler ? fmtEUR(i.precio_m2_alquiler) + '/mes' : '—')}
      ${metric('Alquiler estimado', x.rentaCalc !== null ? fmtEUR(x.rentaCalc, 0) + '/mes' : '—', 'pos')}
      ${metric('Tu coste por m²', x.costeM2 ? fmtEUR(x.costeM2, 0) : '—')}
      ${metric(`Actualizado${i.trimestre_ipv ? ` · ${i.trimestre_ipv}` : ''}`, i.fecha_precio_m2 ? fmtDate(i.fecha_precio_m2) : '—')}
    </div>
    <div class="btn-row" style="margin-top:8px"><button class="btn sm" data-action="inm-m2" data-id="${i.id}">Corregir €/m² de la zona</button>${S.v11 ? `<button class="btn sm" data-action="inm-car" data-id="${i.id}">Características del piso</button>` : ''}</div>
    ${hist.length >= 2 ? `<div class="chart-box sm" style="margin-top:10px"><canvas id="ch-m2-${idx}"></canvas></div>` : ''}`;
}
function chartM2(id, i) {
  const h = S.precios_m2.filter(p => p.inmueble_id === i.id).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  if (h.length < 2) return;
  mkChart(id, { type: 'line', data: { labels: h.map(p => fmtDate(p.fecha)), datasets: [
    { label: '€/m² venta', data: h.map(p => num(p.m2_venta)), borderColor: '#1e3a8a', backgroundColor: '#1e3a8a', tension: .25, yAxisID: 'y' },
    { label: '€/m² alquiler (mes)', data: h.map(p => num(p.m2_alquiler)), borderColor: '#16a34a', backgroundColor: '#16a34a', tension: .25, yAxisID: 'y1' }
  ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtEUR(ctx.parsed.y)}` } } },
    scales: { y: { ...euroAxis, title: { display: true, text: 'Venta €/m²' } }, y1: { position: 'right', grid: { display: false }, ticks: { callback: v => fmtNum(v, 1) + ' €' }, title: { display: true, text: 'Alquiler €/m²' } }, x: { grid: { display: false } } } } });
}
/** Guarda un inmueble aplicando la valoración automática y registrando el histórico de €/m² si ha cambiado. */
async function guardarInmueble(id, v, { auto = false } = {}) {
  const prev = id ? S.inmuebles.find(x => x.id === id) : null;
  // El formulario muestra el €/m² de referencia: si no lo has cambiado, se mantiene el actualizado
  if (S.v11 && !auto && prev && prev.precio_m2_base && num(v.precio_m2_venta) === num(prev.precio_m2_base)) {
    v.precio_m2_venta = prev.precio_m2_venta; v.fecha_precio_m2 = prev.fecha_precio_m2;
  } else if (S.v11 && !auto && num(v.precio_m2_venta) && (!prev || num(prev.precio_m2_venta) !== num(v.precio_m2_venta) || !prev.precio_m2_base)) {
    // Un €/m² metido a mano es la nueva referencia: desde aquí lo actualiza el INE
    v.precio_m2_base = v.precio_m2_venta; v.fecha_m2_base = v.fecha_precio_m2 || todayISO(); v.trimestre_ipv = trimestreDe(v.fecha_m2_base);
  }
  if (S.v4 && v.valor_automatico !== false) {
    const c = calcM2(v);
    if (c.ventaCalc !== null) { v.valor_mercado = c.ventaCalc; v.fecha_valoracion = v.fecha_precio_m2 || todayISO(); }
    if (c.rentaCalc !== null) v.renta_mensual = c.rentaCalc;
  }
  let saved;
  if (id) saved = (await DB.update('inmuebles', id, v))[0]; else saved = (await DB.insert('inmuebles', [v]))[0];
  const cambio = !prev || num(prev.precio_m2_venta) !== num(v.precio_m2_venta) || num(prev.precio_m2_alquiler) !== num(v.precio_m2_alquiler);
  if (S.v4 && saved && cambio && (num(v.precio_m2_venta) || num(v.precio_m2_alquiler))) {
    const c = calcM2(v);
    await DB.insert('precios_m2', [{ inmueble_id: saved.id, fecha: v.fecha_precio_m2 || todayISO(), m2_venta: v.precio_m2_venta, m2_alquiler: v.precio_m2_alquiler, valor_venta: c.ventaCalc, renta_mensual: c.rentaCalc }]);
    await reloadTable('precios_m2');
  }
  await reloadTable('inmuebles');
}
const NOTARIADO = 'https://penotariado.com';
const FIELDS_INM_M2 = [
  { name: 'ccaa', label: 'Provincia', type: 'select', cls: 'v11', options: [{ v: '', l: '— Elige —' }, ...PROVINCIAS.map(([v, l]) => ({ v, l })), ...CCAA.map(([v, l]) => ({ v, l: `${l} (toda la comunidad)` }))], hint: 'El precio se actualiza solo cada trimestre con la evolución oficial de tu provincia' },
  { name: 'metros_construidos', label: 'm² construidos', type: 'number', cls: 'v4', hint: 'Los del Catastro' },
  { name: 'precio_m2_venta', label: 'Precio medio venta de tu código postal (€/m²)', type: 'number', cls: 'v4', hint: `Del <a href="${NOTARIADO}" target="_blank" rel="noopener">portal del notariado ↗</a> (precios reales de compraventa). Una vez al año basta` },
  { name: 'fecha_precio_m2', label: 'Fecha de ese precio', type: 'date', cls: 'v4' },
  { name: 'precio_m2_alquiler', label: 'Alquiler medio de la zona (€/m²/mes)', type: 'number', cls: 'v4' },
  { name: 'valor_anejos', label: 'Parking + trastero (€)', type: 'number', cls: 'v4', hint: 'Si no están en los m²' },
  { name: 'ajuste_pct', label: 'Ajuste adicional (%)', type: 'number', cls: 'v4', hint: 'Además de las características del piso' },
  { name: 'valor_automatico', label: 'Calcular solo el valor de mercado', type: 'checkbox', def: true, full: true, cls: 'v4' }
];
const FIELDS_INM = [
  { name: 'nombre', label: 'Nombre', required: true }, { name: 'descripcion', label: 'Descripción', ph: 'Piso + plaza de parking + trastero' },
  { name: 'direccion', label: 'Dirección', full: true },
  { name: 'fecha_compra', label: 'Fecha de compra', type: 'date' }, { name: 'precio_compra', label: 'Precio de compra (€)', type: 'number' },
  { name: 'gastos_adquisicion', label: 'Gastos de adquisición (€)', type: 'number', hint: 'Impuestos, notaría, registro, gestoría, reformas' },
  { name: 'valor_mercado', label: 'Valor actual de mercado (€)', type: 'number' }, { name: 'fecha_valoracion', label: 'Fecha de la valoración', type: 'date' },
  { name: 'renta_mensual', label: 'Renta mensual estimada (€)', type: 'number', hint: 'Para calcular la rentabilidad potencial' },
  { name: 'meses_vacio', label: 'Meses vacío / año', type: 'number', ph: '0', hint: 'Prudente: 0,5 – 1' },
  { name: 'gastos_ibi', label: 'IBI anual (€)', type: 'number' }, { name: 'gastos_comunidad', label: 'Comunidad anual (€)', type: 'number' },
  { name: 'gastos_seguro', label: 'Seguro anual (€)', type: 'number' }, { name: 'gastos_mantenimiento', label: 'Mantenimiento anual (€)', type: 'number' },
  { name: 'notas', label: 'Notas', type: 'textarea', full: true }
];
Views.inmuebles = renderInmuebles;

/** Campos del formulario: los de m² solo si la migración v4 está aplicada. */
const camposInm = () => camposV4([...FIELDS_INM.slice(0, 3), ...FIELDS_INM_M2, ...FIELDS_INM.slice(3)]);
/** Copia editable de un inmueble (sin id ni metadatos). */
const stripInm = i => { const o = { ...i }; delete o.id; delete o.created_at; return o; };

Object.assign(Actions, {
  'inm-new': () => openForm({ title: 'Nuevo inmueble', fields: camposInm(), values: { valor_automatico: true }, onSubmit: v => guardarInmueble(null, v) }),
  'inm-edit': el => { const i = S.inmuebles.find(x => x.id === el.dataset.id); openForm({ title: 'Editar inmueble', fields: camposInm(), values: { ...i, ...(i.precio_m2_base ? { precio_m2_venta: i.precio_m2_base, fecha_precio_m2: i.fecha_m2_base } : {}) }, onSubmit: v => guardarInmueble(i.id, v) }); },
  'inm-car': el => {
    const i = S.inmuebles.find(x => x.id === el.dataset.id), c = i.caracteristicas || {};
    const yn = [{ v: '', l: '—' }, { v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }], b = x => x === true ? 'si' : x === false ? 'no' : '';
    openForm({ title: `Características · ${i.nombre}`, intro: '<p class="small muted">Ajustan el precio medio de la zona a tu piso (valores orientativos de tasación).</p>',
      fields: [
        { name: 'estado', label: 'Estado', type: 'select', options: [{ v: '', l: '—' }, ...Object.entries(CAR_ESTADO).map(([v, x]) => ({ v, l: `${x[0]} (${x[1] > 0 ? '+' : ''}${x[1]} %)` }))] },
        { name: 'planta', label: 'Planta', type: 'select', options: [{ v: '', l: '—' }, ...Object.entries(CAR_PLANTA).map(([v, x]) => ({ v, l: x[0] }))] },
        { name: 'ascensor', label: 'Ascensor', type: 'select', options: yn }, { name: 'exterior', label: 'Exterior', type: 'select', options: yn },
        { name: 'terraza', label: 'Terraza', type: 'select', options: yn }, { name: 'garaje', label: 'Garaje incluido en el precio', type: 'select', options: yn },
        { name: 'anio', label: 'Año de construcción', type: 'int' }],
      values: { ...c, ascensor: b(c.ascensor), exterior: b(c.exterior), terraza: b(c.terraza), garaje: b(c.garaje) },
      onSubmit: v => { const bb = x => x === 'si' ? true : x === 'no' ? false : null;
        const car = { estado: v.estado || null, planta: v.planta || null, ascensor: bb(v.ascensor), exterior: bb(v.exterior), terraza: bb(v.terraza), garaje: bb(v.garaje), anio: v.anio || null };
        return guardarInmueble(i.id, { ...stripInm(i), caracteristicas: car }, { auto: true }); } });
  },
  'inm-m2': el => {
    const i = S.inmuebles.find(x => x.id === el.dataset.id);
    openForm({ title: `€/m² de la zona · ${i.nombre}`, intro: `<p class="small muted">Busca tu código postal en el <a href="${NOTARIADO}" target="_blank" rel="noopener">portal del notariado ↗</a> (pisos, segunda mano) y copia el €/m². Será la nueva referencia; desde ahí se actualiza solo cada trimestre.</p>`,
      fields: [{ name: 'precio_m2_venta', label: 'Venta (€/m²)', type: 'number' }, { name: 'precio_m2_alquiler', label: 'Alquiler (€/m²/mes)', type: 'number' }, { name: 'fecha_precio_m2', label: 'Fecha', type: 'date' }],
      values: { precio_m2_venta: i.precio_m2_venta, precio_m2_alquiler: i.precio_m2_alquiler, fecha_precio_m2: todayISO() },
      onSubmit: v => guardarInmueble(i.id, { ...stripInm(i), ...v, fecha_precio_m2: v.fecha_precio_m2 || todayISO() }) });
  },
  'inm-del': async el => { const i = S.inmuebles.find(x => x.id === el.dataset.id); if (!(await confirmDlg(`¿Eliminar <b>${esc(i.nombre)}</b>?`, 'Eliminar'))) return; await withSaving(null, async () => { await DB.remove('inmuebles', i.id); await Promise.all([reloadTable('inmuebles'), reloadTable('deudas')]); }, 'Eliminado'); render(); }
});
