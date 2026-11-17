"""Flujos de uso: registrar, conciliar, calendario, cierre de mes, menú de movimientos, acceso e historial."""


def test_gasto_tras_conciliar_resta(app):
    a = app
    a.ir('cuentas')
    a.page.click('[data-action="cuenta-conciliar"][data-id="c"]'); a.page.fill('.modal [name="saldo"]', '150'); a.page.click('.modal [type=submit]'); a.page.wait_for_timeout(250)
    a.page.click('.fab'); a.page.fill('#q-imp', '12,50'); a.page.fill('#q-concepto', 'Panadería'); a.page.click('#q-form [type=submit]'); a.page.wait_for_timeout(250)
    assert a.ev("Calc.saldo(cuentaById('c'))") == 137.5


def test_calendario_sin_fijos(app):
    a = app
    a.page.click('[data-action="cal-open"]'); a.page.wait_for_timeout(200)
    assert a.page.locator('.cal-item:has-text("Hipoteca")').count() == 0
    a.page.check('#cal-fijos'); a.page.wait_for_timeout(200)
    assert a.page.locator('.cal-item:has-text("Hipoteca")').count() == 1


def test_cierre_de_mes(app):
    a = app
    a.ir('dashboard')
    assert a.page.locator('.cz-banner [data-action="cierre-open"]').count() == 1
    a.page.click('.cz-banner [data-action="cierre-open"]'); a.page.wait_for_timeout(250)
    assert a.page.locator('.cz-paso').count() >= 5
    a.page.click('[data-action="cierre-cerrar"]'); a.page.wait_for_timeout(300)
    assert 'Mes cerrado' in a.texto('#tab-dashboard')


def test_menu_de_movimiento(movil):
    a = movil
    a.ir('cuentas')
    a.ev("S.movFilter.mes=''; renderMovList()")
    a.page.click('.mv-more >> nth=0'); a.page.wait_for_timeout(150)
    ops = a.ev("[...document.querySelectorAll('.mv-op')].map(b=>b.dataset.action)")
    assert 'mov-edit' in ops and 'mov-del' in ops and 'mov-hist' in ops
    a.page.click('.mv-op[data-action="mov-edit"]'); a.page.wait_for_timeout(200)
    assert 'Editar movimiento' in a.texto('.modal h3')


def test_historial(app):
    a = app
    a.ir('ajustes'); a.page.wait_for_timeout(300)
    t = a.texto('#hist-list')
    assert 'cambió' in t and 'categoría' in t


def test_usuario_no_autorizado(abrir, navegador):
    page = navegador.new_page()
    errores = []
    page.on('pageerror', lambda e: errores.append(str(e)))
    from conftest import STUB, RAIZ, INICIO
    page.route('**/*', lambda r: r.fulfill(path=str(STUB / 'supabase.js'), content_type='text/javascript') if 'supabase-js' in r.request.url
               else (r.continue_() if r.request.url.startswith('file:') else r.fulfill(body='', content_type='text/plain')))
    page.add_init_script(INICIO + "localStorage.setItem('stub_deny','1');")
    page.goto((RAIZ / 'index.html').as_uri())
    page.wait_for_timeout(1500)
    assert page.evaluate('window.__signedOut') is True
    assert page.evaluate('S.movimientos.length') == 0
    page.close()
    assert not errores
