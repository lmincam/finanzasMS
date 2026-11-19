"""Cada pestaña se dibuja sin errores, en ordenador y en móvil, y sin desbordar el ancho de la pantalla."""
import pytest

TABS_JS = "TABS.map(t => t[0])"


def _recorrer(a, ancho):
    tabs = a.ev(TABS_JS)
    assert len(tabs) >= 10
    for t in tabs:
        a.ir(t)
        assert a.ev(f"document.querySelector('#tab-{t}').innerHTML.length") > 50, f'La pestaña {t} está vacía'
        anchura = a.ev("document.documentElement.scrollWidth")
        assert anchura <= ancho + 2, f'La pestaña {t} desborda: {anchura}px de ancho'


def test_todas_las_pestanas_ordenador(app):
    _recorrer(app, 1300)


def test_todas_las_pestanas_movil(movil):
    _recorrer(movil, 390)


def test_detalles_y_subvistas(app):
    a = app
    a.ir('dashboard')
    for k in ['ingresos', 'gastos']:
        a.page.click(f'.kpi.clickable[data-k="{k}"]'); a.page.wait_for_timeout(150)
        assert a.page.locator('.det-mov').count() > 0
        a.page.click('[data-action="det-close"]'); a.page.wait_for_timeout(100)
    a.page.click('[data-action="cal-open"]'); a.page.wait_for_timeout(150)
    assert a.page.locator('.cal-month').count() == 1
    a.page.click('[data-action="cal-close"]'); a.page.wait_for_timeout(100)
    for k in ['ingresos', 'gastos', 'ahorro', 'tasa-ahorro', 'inversion', 'patrimonio', 'liquidez', 'presupuesto', 'anio']:
        a.page.click(f'[data-action="kpi-info"][data-k="{k}"]'); a.page.wait_for_timeout(80)
        assert a.page.locator('.modal .exp').count() == 1, k
        a.page.click('.modal [data-close]'); a.page.wait_for_timeout(80)
    a.ir('inversiones')
    a.page.click('.inv-card2[data-id="d"]'); a.page.wait_for_timeout(200)
    assert a.page.locator('.prod-tbl tbody tr').count() == 2
    a.ir('deudas')
    a.ev("S.deudaSel = S.deudas[0].id; render()")
    assert 'Cuotas desde el último dato del banco' in a.texto('#tab-deudas')


def test_estructura_dashboard(app):
    """Evita volver a publicar la tarjeta de balance descolocada (un </div> de menos la rompió una vez)."""
    a = app
    a.ir('dashboard')
    assert a.ev("[...document.querySelectorAll('.kpi-grid > .kpi')].length") == 7
    assert a.ev("document.querySelector('.kpi-grid > .kpi-wide > .bal-calc') !== null")
    assert a.ev("document.querySelector('.ytd') !== null")


def test_navegacion_movil(movil):
    """En el móvil: barra inferior con 4 secciones + botón de añadir. Patrimonio abre su resumen y desde sus recuadros cada apartado."""
    a = movil
    assert a.page.locator('#bottomnav .bn-item').count() == 4
    assert a.page.locator('#bottomnav .bn-plus').count() == 1
    a.page.click('#bottomnav [data-action="sec"][data-sec="patrimonio"]'); a.page.wait_for_timeout(200)
    assert a.ev('S.tab') == 'patrimonio'
    assert a.ev("document.querySelector('#subtabs').hidden") is True
    a.page.click('.pz-box[data-k="vehiculos"]'); a.page.wait_for_timeout(200)
    assert a.ev('S.tab') == 'vehiculos'
    a.page.click('.sub-back button[data-tab="patrimonio"]'); a.page.wait_for_timeout(200)
    assert a.ev('S.tab') == 'patrimonio'
    a.page.click('#bottomnav [data-action="sec"][data-sec="planificar"]'); a.page.wait_for_timeout(200)
    assert [x.strip() for x in a.page.locator('#subtabs button').all_inner_texts()] == ['Presupuestos', 'Previsión y metas', 'Proyección', 'Seguros', 'Notas']


def test_modo_oscuro(abrir):
    a = abrir("localStorage.setItem('pf_tema','dark');")
    assert a.ev("document.documentElement.dataset.theme") == 'dark'
    fondo = a.ev("getComputedStyle(document.querySelector('.card')).backgroundColor")
    assert fondo != 'rgb(255, 255, 255)', 'Las tarjetas deben oscurecerse'
    a.ir('ajustes')
    a.page.click('[data-action="tema"][data-v="light"]'); a.page.wait_for_timeout(150)
    assert a.ev("document.documentElement.dataset.theme") == 'light'
    assert a.ev("getComputedStyle(document.querySelector('.card')).backgroundColor") == 'rgb(255, 255, 255)'


def test_ajustes_desde_el_circulo_de_usuario(movil):
    a = movil
    a.page.click('#user-chip'); a.page.wait_for_timeout(200)
    assert a.ev('S.tab') == 'ajustes'


def test_carruseles(app):
    """Alertas de Inicio en carrusel infinito, en orden (alertas rojas primero); Patrimonio sin carrusel."""
    a = app
    a.ir('dashboard'); a.page.wait_for_timeout(300)
    niveles = a.ev("[...document.querySelectorAll('.crs-alertas .crs-it:not([aria-hidden]) .alert')].map(x => x.classList[1])")
    orden = {'red': 0, 'amber': 1, 'blue': 2, 'green': 3}
    assert niveles and [orden[n] for n in niveles] == sorted(orden[n] for n in niveles)
    assert a.page.locator('#tab-patrimonio [data-crs]').count() == 0


def test_mayores_gastos_sin_fijos(app):
    a = app
    a.ir('dashboard')
    hip = a.ev("S.movimientos.filter(m => m.tipo === 'gasto' && esGastoFijo(m.categoria_id, mesActual())).map(m => m.id)")
    assert hip, 'el stub debería tener algún gasto fijo (cuota de la hipoteca)'
    ids = a.ev("[...document.querySelectorAll('.top-list .it')].map(x => x.dataset.id)")
    assert ids and not set(ids) & set(hip)
