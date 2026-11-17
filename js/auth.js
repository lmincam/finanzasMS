'use strict';
/* =====================================================================
   ACCESO (Supabase Auth · email + contraseña)
   ---------------------------------------------------------------------
   Pantalla de inicio de sesión, sesión recordada en el dispositivo,
   recuperación y cambio de contraseña, y cierre de sesión.
   Los usuarios se crean en Supabase (no hay registro público).
   Depende de: config.js, utilidades.js, estado.js, datos.js, ui.js
   ===================================================================== */

const Auth = { user: null, started: false };

const traducirErrorAuth = e => {
  const m = String((e && e.message) || e || '');
  if (/invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'El usuario no está confirmado. En Supabase, edítalo y confírmalo (o créalo con “Auto Confirm User”).';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
  if (/password should be at least|weak/i.test(m)) return 'La contraseña es demasiado corta o débil (mínimo 8 caracteres).';
  if (/failed to fetch|network/i.test(m)) return 'No hay conexión con Supabase. Revisa internet y la URL del proyecto.';
  return m;
};

function bloquearApp(on) { document.body.classList.toggle('locked', on); }

/** Pinta la pantalla de acceso. mode: 'login' | 'olvido' | 'recuperar' | 'config' */
function renderLogin(mode = 'login', msg = '') {
  let box = $('#auth-screen');
  if (!box) { box = document.createElement('div'); box.id = 'auth-screen'; document.body.appendChild(box); }
  const c = getConn(), fija = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  if (!c.url || !c.key) mode = 'config';
  const aviso = msg ? `<div class="banner ${msg.startsWith('✓') ? 'blue' : 'red'}" style="margin-bottom:12px">${esc(msg)}</div>` : '';
  let body;
  if (mode === 'config') body = `<h3>Conexión con Supabase</h3>
      <p class="small muted">Solo la primera vez en cada dispositivo. Los datos están en Supabase → Project Settings → API.</p>${aviso}
      <form id="auth-form" data-mode="config" class="form-grid" style="grid-template-columns:1fr">
        <div><label>Project URL</label><input id="au-url" value="${esc(c.url)}" placeholder="https://xxxxxxxx.supabase.co" ${fija ? 'disabled' : ''}></div>
        <div><label>Clave anon / publishable</label><input id="au-key" type="password" value="${esc(c.key)}" placeholder="eyJhbGciOi… o sb_publishable_…" ${fija ? 'disabled' : ''}></div>
        <button class="btn primary" type="submit" style="justify-content:center">Guardar y continuar</button>
      </form>`;
  else if (mode === 'olvido') body = `<h3>Recuperar contraseña</h3>
      <p class="small muted">Te enviaremos un enlace para crear una contraseña nueva.</p>${aviso}
      <form id="auth-form" data-mode="olvido" class="form-grid" style="grid-template-columns:1fr">
        <div><label>Email</label><input id="au-email" type="email" autocomplete="username" required></div>
        <button class="btn primary" type="submit" style="justify-content:center">Enviar enlace</button>
        <button class="btn ghost" type="button" data-action="auth-modo" data-m="login" style="justify-content:center">← Volver</button>
      </form>`;
  else if (mode === 'recuperar') body = `<h3>Nueva contraseña</h3>${aviso}
      <form id="auth-form" data-mode="recuperar" class="form-grid" style="grid-template-columns:1fr">
        <div><label>Nueva contraseña</label><input id="au-p1" type="password" autocomplete="new-password" minlength="8" required></div>
        <div><label>Repítela</label><input id="au-p2" type="password" autocomplete="new-password" minlength="8" required></div>
        <button class="btn primary" type="submit" style="justify-content:center">Guardar contraseña</button>
      </form>`;
  else body = `<h3>Iniciar sesión</h3>${aviso}
      <form id="auth-form" data-mode="login" class="form-grid" style="grid-template-columns:1fr">
        <div><label>Email</label><input id="au-email" type="email" autocomplete="username" required></div>
        <div><label>Contraseña</label><input id="au-pass" type="password" autocomplete="current-password" required></div>
        <button class="btn primary" type="submit" style="justify-content:center">Entrar</button>
      </form>
      <div class="auth-links"><a href="#" data-action="auth-modo" data-m="olvido">¿Olvidaste la contraseña?</a>${fija ? '' : '<a href="#" data-action="auth-modo" data-m="config">Conexión</a>'}</div>`;
  box.innerHTML = `<div class="auth-card"><div class="auth-logo"><div class="logo">€</div><div class="brand">Patrimonio Miñán Sánchez<small>Acceso privado · v${APP_VERSION}</small></div></div>${body}
    <p class="small muted" style="margin:16px 0 0;text-align:center">🔒 Solo los usuarios creados en tu proyecto de Supabase pueden entrar.</p></div>`;
  box.querySelector('#auth-form').addEventListener('submit', enviarAuth);
  const f = box.querySelector('input:not([disabled])'); if (f && window.innerWidth > 700) setTimeout(() => f.focus(), 50);
}
function ocultarLogin() { const b = $('#auth-screen'); if (b) b.remove(); }

async function enviarAuth(e) {
  e.preventDefault();
  const form = e.target, mode = form.dataset.mode, btn = form.querySelector('[type=submit]');
  const orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Un momento…';
  try {
    if (mode === 'config') {
      const url = $('#au-url').value.trim().replace(/\/+$/, ''), key = $('#au-key').value.trim();
      if (!/^https:\/\/.+/.test(url) || !key) throw new Error('Introduce una URL https válida y la clave');
      localStorage.setItem('pf_sb_url', url); localStorage.setItem('pf_sb_key', key);
      location.reload(); return;
    }
    if (mode === 'login') {
      const { error } = await DB.client.auth.signInWithPassword({ email: $('#au-email').value.trim(), password: $('#au-pass').value });
      if (error) throw error;
      return; // onAuthStateChange inicia la sesión
    }
    if (mode === 'olvido') {
      const { error } = await DB.client.auth.resetPasswordForEmail($('#au-email').value.trim(), { redirectTo: location.origin + location.pathname });
      if (error) throw error;
      renderLogin('login', '✓ Si el email existe, te llegará un enlace en unos minutos. Ábrelo en este mismo dispositivo.'); return;
    }
    if (mode === 'recuperar') {
      const p1 = $('#au-p1').value, p2 = $('#au-p2').value;
      if (p1.length < 8) throw new Error('Mínimo 8 caracteres');
      if (p1 !== p2) throw new Error('Las contraseñas no coinciden');
      const { data, error } = await DB.client.auth.updateUser({ password: p1 });
      if (error) throw error;
      history.replaceState(null, '', location.pathname);
      toast('Contraseña actualizada ✓', 'ok');
      iniciarSesion(data.user ? { user: data.user } : null, true);
    }
  } catch (err) {
    renderLogin(mode, traducirErrorAuth(err));
  } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = orig; } }
}

function iniciarSesion(session, forzar = false) {
  if (!session || !session.user) return;
  Auth.user = session.user;
  if (Auth.started && !forzar) return;
  Auth.started = true;
  ocultarLogin(); bloquearApp(false);
  const u = $('#user-chip'); if (u) u.textContent = Auth.user.email ? Auth.user.email[0].toUpperCase() : '·';
  comprobarPermiso().then(ok => { if (ok) loadAll(); });
}
/** ¿Está este usuario en la lista de acceso? (si la lista aún no existe en la base de datos, se deja pasar como antes) */
async function comprobarPermiso() {
  try {
    const { data, error } = await DB.client.rpc('es_permitido');
    if (error || data !== false) { S.listaAcceso = !error; return true; }
  } catch (e) { return true; }
  bloquearApp(true);
  try { sessionStorage.setItem('pf_auth_msg', `La cuenta ${Auth.user.email} no está autorizada para ver estos datos. Pide que la añadan en ⚙️ Ajustes → Usuarios con acceso.`); } catch (e) { /* sin almacenamiento */ }
  await borrarCopiaLocal().catch(() => {});
  await DB.client.auth.signOut().catch(() => {});   // recarga la página y muestra el aviso en el login
  return false;
}

/** Arranque: comprueba si hay sesión guardada; si no, muestra el login. */
async function arrancarAuth() {
  if (!DB.init()) { bloquearApp(true); renderLogin('config'); return; }
  const recuperando = /type=recovery/.test(location.hash);
  DB.client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { bloquearApp(true); renderLogin('recuperar'); return; }
    if (event === 'SIGNED_IN' && session && !recuperando) iniciarSesion(session);
    if (event === 'SIGNED_OUT') { location.hash = ''; location.reload(); }
  });
  if (recuperando) { bloquearApp(true); renderLogin('recuperar'); return; }
  const { data } = await DB.client.auth.getSession();
  if (data && data.session) iniciarSesion(data.session);
  else { bloquearApp(true); let msg = ''; try { msg = sessionStorage.getItem('pf_auth_msg') || ''; sessionStorage.removeItem('pf_auth_msg'); } catch (e) { /* — */ } renderLogin('login', msg); }
}

/* ---------- Usuarios con acceso (lista usuarios_permitidos) ---------- */
async function cargarAccesos() {
  const box = $('#accesos-list'); if (!box) return;
  const { data, error } = await DB.client.from('usuarios_permitidos').select('email, created_at').order('email');
  if (error) { box.innerHTML = '<div class="banner amber">Ejecuta <code>sql/esquema_completo.sql</code> en Supabase para activar la lista de usuarios con acceso.</div>'; return; }
  const yo = (Auth.user && Auth.user.email || '').toLowerCase();
  box.innerHTML = data.map(r => `<div class="acc-row"><span>👤 <b>${esc(r.email)}</b>${r.email === yo ? ' <span class="badge green">tú</span>' : ''}</span>
    ${r.email === yo ? '' : `<button class="mini" data-action="acceso-del" data-email="${esc(r.email)}" title="Quitar acceso">🗑</button>`}</div>`).join('') || '<div class="small muted">Lista vacía</div>';
}
function renderAccesosCard() {
  setTimeout(cargarAccesos, 0);
  return `<div class="card"><div class="card-head"><h3>🔐 Usuarios con acceso</h3></div>
    <p class="small muted" style="margin-top:0">Solo estas cuentas pueden ver y modificar los datos, aunque alguien consiga crearse un usuario en tu Supabase. Para añadir a alguien: créale el usuario en Supabase → Authentication → Users y añade aquí su email.</p>
    <div id="accesos-list" class="small muted">Cargando…</div>
    <div class="btn-row" style="margin-top:10px"><button class="btn sm" data-action="acceso-add">+ Añadir email</button></div>
    <div class="banner blue" style="margin-top:12px">🛡️ Recomendado: en Supabase → Authentication → <strong>Sign In / Providers</strong>, desactiva <strong>"Allow new users to sign up"</strong>. Así nadie puede crearse una cuenta en tu proyecto; tú sigues pudiendo crear usuarios desde Authentication → Users → Add user.</div></div>`;
}

/* ---------- Tarjeta de sesión en Ajustes ---------- */
function renderSesionCard() {
  const u = Auth.user;
  return `<div class="card"><div class="card-head"><h3>👤 Sesión</h3><span class="badge green">Conectado</span></div>
    <p style="margin-top:0">Has iniciado sesión como <b>${esc(u ? u.email : '—')}</b>.</p>
    <p class="small muted">La sesión se recuerda en este dispositivo.</p>
    <div class="btn-row"><button class="btn" data-action="auth-cambiar">Cambiar contraseña</button><button class="btn ghost" data-action="auth-logout">Cerrar sesión</button></div></div>`;
}

Object.assign(Actions, {
  'acceso-add': () => openForm({ title: 'Dar acceso a un usuario', fields: [{ name: 'email', label: 'Email (el mismo con el que entra)', type: 'email', required: true }],
    onSubmit: async v => { const { error } = await DB.client.from('usuarios_permitidos').insert([{ email: v.email.trim().toLowerCase() }]); if (error) throw error; toast('Acceso añadido ✓', 'ok'); } }),
  'acceso-del': async el => {
    if (!(await confirmDlg(`¿Quitar el acceso a <b>${esc(el.dataset.email)}</b>? No podrá ver ni modificar nada.`, 'Quitar acceso'))) return;
    const r = await withSaving(null, async () => { const { error } = await DB.client.from('usuarios_permitidos').delete().eq('email', el.dataset.email); if (error) throw error; }, 'Acceso retirado');
    if (r !== FAIL) cargarAccesos();
  },
  'auth-modo': el => renderLogin(el.dataset.m),
  'auth-logout': async () => {
    if (!(await confirmDlg('¿Cerrar sesión en este dispositivo?', 'Cerrar sesión', false))) return;
    await borrarCopiaLocal(); // los datos guardados en el dispositivo no deben quedarse tras cerrar sesión
    await DB.client.auth.signOut();
  },
  'auth-cambiar': () => openForm({ title: 'Cambiar contraseña', fields: [
      { name: 'p1', label: 'Nueva contraseña', type: 'password', required: true }, { name: 'p2', label: 'Repítela', type: 'password', required: true }],
    onSubmit: async v => {
      if (v.p1.length < 8) throw new Error('Mínimo 8 caracteres');
      if (v.p1 !== v.p2) throw new Error('Las contraseñas no coinciden');
      const { error } = await DB.client.auth.updateUser({ password: v.p1 }); if (error) throw new Error(traducirErrorAuth(error));
      toast('Contraseña cambiada ✓', 'ok');
    } })
});
