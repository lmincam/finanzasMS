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
  box.innerHTML = `<div class="auth-card"><div class="auth-logo"><div class="logo">€</div><div class="brand">Patrimonio Familiar<small>Acceso privado · v${APP_VERSION}</small></div></div>${body}
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
  loadAll();
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
  else { bloquearApp(true); renderLogin('login'); }
}

/* ---------- Tarjeta de sesión en Ajustes ---------- */
function renderSesionCard() {
  const u = Auth.user;
  return `<div class="card"><div class="card-head"><h3>👤 Sesión</h3><span class="badge green">Conectado</span></div>
    <p style="margin-top:0">Has iniciado sesión como <b>${esc(u ? u.email : '—')}</b>.</p>
    <p class="small muted">La sesión se recuerda en este dispositivo. Para añadir o quitar usuarios: Supabase → Authentication → Users.</p>
    <div class="btn-row"><button class="btn" data-action="auth-cambiar">Cambiar contraseña</button><button class="btn ghost" data-action="auth-logout">Cerrar sesión</button></div></div>`;
}

Object.assign(Actions, {
  'auth-modo': el => renderLogin(el.dataset.m),
  'auth-logout': async () => {
    if (!(await confirmDlg('¿Cerrar sesión en este dispositivo?', 'Cerrar sesión', false))) return;
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
