'use strict';
/* =====================================================================
   HISTORIAL DE CAMBIOS
   ---------------------------------------------------------------------
   La base de datos anota cada alta, cambio o borrado (tabla "historial",
   bloque 13 del SQL) con quién lo hizo y qué campos cambiaron.
   Aquí se muestra en lenguaje normal: en ⚙️ Ajustes (todo) y desde el
   menú ⋯ de un movimiento (solo ese movimiento).
   Depende de: datos.js, ui.js, calculos.js
   ===================================================================== */

const TABLA_HIST = { movimientos: 'Movimiento', cuentas: 'Cuenta', categorias: 'Categoría', inmuebles: 'Inmueble', vehiculos: 'Vehículo', deudas: 'Préstamo',
  snapshots: 'Foto trimestral', ajustes: 'Ajuste', amortizaciones: 'Amortización', amortizaciones_plan: 'Plan de amortización', aportaciones_periodicas: 'Aportación periódica',
  posiciones: 'Producto de inversión', seguros: 'Seguro', reglas_categoria: 'Regla de categoría', partidas_previstas: 'Partida prevista', metas: 'Meta',
  usuarios_permitidos: 'Usuario con acceso', precios_m2: 'Precio del m²' };
const CAMPO_HIST = { importe: 'importe', fecha: 'fecha', concepto: 'concepto', categoria_id: 'categoría', cuenta_id: 'cuenta', cuenta_contraria_id: 'cuenta contraria',
  mes_imputacion: 'mes', tipo: 'tipo', notas: 'notas', nombre: 'nombre', presupuesto_mensual: 'presupuesto', presupuesto_anual: 'presupuesto anual', gasto_fijo: 'gasto fijo',
  saldo_inicial: 'saldo', fecha_saldo_inicial: 'fecha del saldo', valor_mercado: 'valor de mercado', capital_pendiente: 'capital pendiente', fecha_capital_pendiente: 'fecha del capital',
  interes: 'TIN', cuota_mensual: 'cuota', porcentaje: '% de reparto', participaciones: 'participaciones', isin: 'ISIN', a_cobrar: 'te deben', reembolso_de: 'devolución de',
  subtipo_transferencia: 'naturaleza', activa: 'activa', valor: 'valor', patron: 'texto', email: 'email' };

const quien = u => !u || u === 'sistema' ? 'Sistema' : (Auth.user && u.toLowerCase() === (Auth.user.email || '').toLowerCase() ? 'Tú' : u.split('@')[0]);
function valorHist(k, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (k === 'categoria_id') return catName(v) || '(categoría borrada)';
  if (k === 'cuenta_id' || k === 'cuenta_contraria_id' || k === 'cuenta_origen_id') return (cuentaById(v) || {}).nombre || '(cuenta borrada)';
  if (k === 'reembolso_de') { const m = S.movimientos.find(x => x.id === v); return m ? m.concepto : '(gasto)'; }
  if (k === 'mes_imputacion') return ymLabel(ymOf(v), true);
  if (/^fecha/.test(k) && /^\d{4}-\d{2}-\d{2}/.test(v)) return fmtDate(String(v).slice(0, 10));
  if (['importe', 'saldo_inicial', 'valor_mercado', 'capital_pendiente', 'cuota_mensual', 'presupuesto_mensual', 'presupuesto_anual', 'a_cobrar', 'valor'].includes(k)) return fmtEUR(num(v));
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v === 'object') return '…';
  return String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v);
}
/** Nombre legible del registro afectado ("Mercadona · −45,20 €", "Cuenta Principal"…). */
function nombreHist(r) {
  const x = { ...(r.antes || {}), ...(r.despues || {}) };
  const actual = r.tabla === 'movimientos' ? S.movimientos.find(m => m.id === r.registro_id) : r.tabla === 'cuentas' ? cuentaById(r.registro_id) : r.tabla === 'categorias' ? catById(r.registro_id) : null;
  const o = { ...(actual || {}), ...x };
  if (r.tabla === 'movimientos') return `${o.concepto || '—'}${o.importe !== undefined ? ' · ' + fmtEUR(num(o.importe)) : ''}`;
  if (r.tabla === 'ajustes') return { cierres: 'cierre de mes', alertas_ocultas: 'avisos ocultos', regla_nomina: 'regla de nómina', cuenta_anualidades: 'cuenta de anualidades', patrimonio_inicio_anio: 'patrimonio a 1 de enero', alertas: 'avisos' }[r.registro_id] || r.registro_id;
  return o.nombre || o.concepto || o.email || o.patron || o.isin || '';
}
function filaHist(r) {
  const acc = { alta: ['➕', 'añadió'], cambio: ['✎', 'cambió'], borrado: ['🗑', 'borró'] }[r.accion] || ['•', r.accion];
  let det = '';
  if (r.accion === 'cambio' && r.despues) {
    const ks = Object.keys(r.despues).filter(k => k !== 'id' && !(r.tabla === 'ajustes' && k === 'valor'));
    det = ks.slice(0, 4).map(k => `<span class="hist-ch"><b>${esc(CAMPO_HIST[k] || k.replace(/_/g, ' '))}</b>: ${esc(valorHist(k, (r.antes || {})[k]))} → ${esc(valorHist(k, r.despues[k]))}</span>`).join('') + (ks.length > 4 ? `<span class="muted small"> y ${ks.length - 4} más</span>` : '');
  }
  const d = new Date(r.fecha);
  return `<div class="hist-row"><span class="hist-ic">${acc[0]}</span><div class="hist-main">
      <div><b>${esc(quien(r.usuario))}</b> ${acc[1]} ${esc((TABLA_HIST[r.tabla] || r.tabla).toLowerCase())} <b>${esc(nombreHist(r))}</b></div>
      ${det ? `<div class="hist-det">${det}</div>` : ''}</div>
    <span class="hist-when" title="${d.toLocaleString('es-ES')}">${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span></div>`;
}
async function cargarHistorial({ tabla = '', usuario = '', registro = '', limite = 60 } = {}) {
  let q = DB.client.from('historial').select('*').order('fecha', { ascending: false }).limit(limite);
  if (tabla) q = q.eq('tabla', tabla);
  if (usuario) q = q.eq('usuario', usuario);
  if (registro) q = q.eq('registro_id', registro);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* ---------- Tarjeta en Ajustes ---------- */
S.histFiltro = S.histFiltro || { tabla: '', usuario: '', limite: 60 };
function renderHistorialCard() {
  setTimeout(pintarHistorial, 0);
  const f = S.histFiltro;
  return `<div class="card"><div class="card-head"><h3>🕘 Historial de cambios</h3>
      <div class="btn-row"><select id="hist-tabla"><option value="">Todo</option>${Object.entries(TABLA_HIST).map(([k, l]) => `<option value="${k}" ${f.tabla === k ? 'selected' : ''}>${l}s</option>`).join('')}</select>
      <select id="hist-usuario"><option value="">Todos</option><option value="sistema" ${f.usuario === 'sistema' ? 'selected' : ''}>Sistema</option>${Auth.user ? `<option value="${esc(Auth.user.email)}" ${f.usuario === Auth.user.email ? 'selected' : ''}>Tú</option>` : ''}</select></div></div>
    <div id="hist-list" class="small muted">Cargando…</div></div>`;
}
async function pintarHistorial() {
  const box = $('#hist-list'); if (!box) return;
  try {
    const f = S.histFiltro, rows = await cargarHistorial(f);
    box.innerHTML = rows.length ? rows.map(filaHist).join('') + (rows.length >= f.limite ? `<div style="text-align:center;padding:10px"><button class="btn sm" data-action="hist-mas">Ver más</button></div>` : '')
      : '<div class="empty">Sin cambios registrados todavía.</div>';
  } catch (e) {
    box.innerHTML = '<div class="banner amber">Ejecuta <code>sql/esquema_completo.sql</code> en Supabase (bloque 13) para activar el historial de cambios.</div>';
  }
}
/** Historial de un registro concreto (desde el menú ⋯ de un movimiento). */
async function abrirHistorialDe(tabla, id, titulo) {
  const m = modal(`<h3>🕘 Historial · ${esc(titulo)}</h3><div id="hist-uno" class="small muted">Cargando…</div><div class="actions" style="margin-top:12px"><button class="btn" data-close>Cerrar</button></div>`);
  m.el.querySelector('[data-close]').addEventListener('click', m.close);
  try {
    const rows = await cargarHistorial({ tabla, registro: id, limite: 50 });
    m.el.querySelector('#hist-uno').innerHTML = rows.length ? rows.map(filaHist).join('') : '<div class="empty">Sin cambios registrados desde que se activó el historial.</div>';
  } catch (e) { m.el.querySelector('#hist-uno').innerHTML = '<div class="banner amber">El historial aún no está activado (bloque 13 del SQL).</div>'; }
}

Object.assign(Actions, {
  'hist-mas': () => { S.histFiltro.limite += 60; pintarHistorial(); },
  'mov-hist': el => { const mv = S.movimientos.find(x => x.id === el.dataset.id); abrirHistorialDe('movimientos', el.dataset.id, mv ? mv.concepto || 'movimiento' : 'movimiento'); }
});
Object.assign(Changes, {
  'hist-tabla': el => { S.histFiltro = { ...S.histFiltro, tabla: el.value, limite: 60 }; pintarHistorial(); },
  'hist-usuario': el => { S.histFiltro = { ...S.histFiltro, usuario: el.value, limite: 60 }; pintarHistorial(); }
});
