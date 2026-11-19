'use strict';
/* =====================================================================
   PESTAÑA · NOTAS (Planificar › Notas)
   ---------------------------------------------------------------------
   Notas de texto libre de la familia, de la más nueva a la más antigua.
   Cada nota lleva un resumen breve escrito por IA: lo genera la tarea de
   GitHub "Resumen de notas" (scripts/notas.mjs) cada pocos minutos.
   Mientras llega, se ve el principio del texto.
   Tabla: notas (bloque 16 del SQL). Depende de: datos.js, ui.js
   ===================================================================== */

const notasOk = () => !(S.missing && S.missing.has('notas'));
/** Huella del texto (la misma que calcula scripts/notas.mjs) para saber si el resumen corresponde a la versión actual. */
function huellaNota(t) { let h = 5381; const s = String(t || ''); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
const tituloNota = n => (n.titulo || '').trim() || String(n.texto || '').trim().split('\n')[0].slice(0, 80) || 'Sin título';
const resumenAlDia = n => n.resumen && n.resumen_de === huellaNota(n.texto);
function haceCuanto(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 90) return 'ahora mismo';
  if (d < 3600) return `hace ${Math.round(d / 60)} min`;
  if (d < 86400) return `hace ${Math.round(d / 3600)} h`;
  if (d < 86400 * 7) { const n = Math.round(d / 86400); return n === 1 ? 'ayer' : `hace ${n} días`; }
  return fmtDate(String(iso).slice(0, 10));
}

function renderNotas() {
  const el = $('#tab-notas');
  if (!notasOk()) { el.innerHTML = `<div class="section-head"><div><h2>Notas</h2></div></div><div class="banner amber">Para usar las notas, ejecuta entero <code>sql/esquema_completo.sql</code> en Supabase → SQL Editor (bloque 16) y recarga.</div>`; return; }
  const q = normText(S.notasQ || '');
  const todas = [...(S.notas || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const lista = q ? todas.filter(n => normText(`${n.titulo || ''} ${n.texto} ${n.resumen || ''}`).includes(q)) : todas;
  el.innerHTML = `
    <div class="section-head"><div><h2>Notas</h2><div class="sub">Ideas, decisiones y apuntes de la familia · con un resumen hecho por IA</div></div>
      <div class="btn-row"><button class="btn primary" data-action="nota-new">+ Nota</button></div></div>
    ${todas.length > 3 ? `<input class="notas-q" id="notas-q" type="search" placeholder="Buscar en las notas…" value="${esc(S.notasQ || '')}">` : ''}
    ${lista.length ? `<div class="notas-list">${lista.map(n => {
      const ok = resumenAlDia(n);
      return `<button class="nota-card" data-action="nota-ver" data-id="${n.id}">
        <div class="nota-top"><b class="nota-tit">${esc(tituloNota(n))}</b><span class="nota-fecha" title="${esc(fmtDate(String(n.created_at).slice(0, 10)))}">${esc(haceCuanto(n.created_at))}</span></div>
        ${ok ? `<div class="nota-res"><span class="nota-ia">✨ IA</span>${esc(n.resumen)}</div>`
             : `<div class="nota-prev">${esc(String(n.texto).slice(0, 220))}</div><div class="nota-pend">✨ ${n.resumen ? 'Actualizando el resumen…' : 'Resumen en camino…'}</div>`}
        ${n.autor ? `<div class="nota-autor">${esc(n.autor.split('@')[0])}</div>` : ''}
      </button>`; }).join('')}</div>`
    : `<div class="card empty-card"><div class="empty">${q ? 'Ninguna nota contiene ese texto.' : 'Aún no hay notas. Apunta aquí decisiones, ideas o cosas pendientes de la familia: se ordenan de la más nueva a la más antigua y cada una lleva un resumen.'}</div></div>`}`;
  const inp = $('#notas-q');
  if (inp) inp.addEventListener('input', () => { S.notasQ = inp.value; const pos = inp.selectionStart; renderNotas(); const i2 = $('#notas-q'); if (i2) { i2.focus(); i2.setSelectionRange(pos, pos); } });
}
Views.notas = renderNotas;

const FIELDS_NOTA = () => [
  { name: 'titulo', label: 'Título (opcional)', full: true, ph: 'Si lo dejas vacío, se usa la primera línea' },
  { name: 'texto', label: 'Nota', type: 'textarea', full: true, required: true, ph: 'Escribe lo que quieras recordar…' }
];
async function guardarNota(id, v) {
  const vals = { titulo: (v.titulo || '').trim() || null, texto: String(v.texto || '').trim(), updated_at: new Date().toISOString() };
  if (!id) vals.autor = (Auth.user && Auth.user.email) || null;
  await saveEntity('notas', id, vals);
}
Object.assign(Actions, {
  'nota-new': () => openForm({ title: 'Nueva nota', fields: FIELDS_NOTA(), values: {}, onSubmit: v => guardarNota(null, v) }),
  'nota-ver': el => {
    const n = (S.notas || []).find(x => x.id === el.dataset.id); if (!n) return;
    const ok = resumenAlDia(n);
    const md = modal(`<div class="nota-ver">
      <h3>${esc(tituloNota(n))}</h3>
      <div class="small muted">${esc(fmtDate(String(n.created_at).slice(0, 10)))}${n.autor ? ` · ${esc(n.autor.split('@')[0])}` : ''}${n.updated_at && String(n.updated_at).slice(0, 16) !== String(n.created_at).slice(0, 16) ? ` · editada ${esc(haceCuanto(n.updated_at))}` : ''}</div>
      <div class="nota-res grande">${ok ? `<span class="nota-ia">✨ Resumen IA</span>${esc(n.resumen)}` : '<span class="nota-ia">✨ Resumen IA</span><span class="muted">Se está generando; aparecerá en unos minutos.</span>'}</div>
      <div class="nota-texto">${esc(n.texto)}</div>
      <div class="actions"><button class="btn danger" data-op="del" style="margin-right:auto">Eliminar</button><button class="btn" data-op="edit">✎ Editar</button><button class="btn primary" data-op="ok">Cerrar</button></div></div>`);
    md.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-op]'); if (!b) return;
      if (b.dataset.op === 'ok') return md.close();
      if (b.dataset.op === 'edit') { md.close(); return openForm({ title: 'Editar nota', fields: FIELDS_NOTA(), values: n, onSubmit: v => guardarNota(n.id, v) }); }
      if (!(await confirmDlg(`¿Eliminar la nota <b>${esc(tituloNota(n))}</b>?`, 'Eliminar'))) return;
      md.close(); await withSaving(null, async () => { await DB.remove('notas', n.id); await reloadTable('notas'); }, 'Nota eliminada'); render();
    });
  }
});

// Mientras haya resúmenes pendientes y estés en Notas, se comprueba cada minuto si ya han llegado
setInterval(async () => {
  if (S.tab !== 'notas' || document.hidden || !notasOk() || !(S.notas || []).some(n => !resumenAlDia(n))) return;
  try { await reloadTable('notas'); if (S.tab === 'notas' && !document.querySelector('.modal-back')) renderNotas(); } catch (e) { /* sin conexión: se reintenta */ }
}, 60000);
