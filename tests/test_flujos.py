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


def test_importar_desde_icono(app):
    """Ya no hay tarjeta fija de importación: el icono pide la cuenta y el archivo en una ventana."""
    a = app
    a.ir('cuentas')
    assert a.ev("document.querySelector('#import-card').hidden") is True
    assert a.page.locator('.acc-btns .btn').count() == 4
    a.page.click('[data-action="imp-open"]'); a.page.wait_for_timeout(150)
    assert a.page.locator('.modal #imp-cuenta').count() == 1
    assert a.page.locator('.modal #imp-file').count() == 1
    a.page.click('.modal [data-close]'); a.page.wait_for_timeout(100)
    assert a.page.locator('.modal').count() == 0


def test_devolucion_indica_el_gasto(app):
    a = app
    a.ev("""(() => { const g = S.movimientos.find(m => /Tasca/.test(m.concepto)); S.v6 = true;
        S.movimientos.push({ ...g, id: 'dv1', concepto: 'Bizum de Ana', importe: 66.5, reembolso_de: g.id, fecha: '2026-11-08', mes_imputacion: '2026-11-01' }); })()""")
    a.ir('cuentas')
    fila = a.texto('.mv[data-id="dv1"]')
    assert 'Devolución de' in fila and 'Restaurante La Tasca' in fila
    assert 'Te devolvieron' in a.texto(f".mv[data-id=\"{a.ev('S.movimientos.find(m => /Tasca/.test(m.concepto)).id')}\"]")
