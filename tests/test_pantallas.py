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
    assert a.ev("[...document.querySelectorAll('.kpi-flujo > .kpi')].length") == 5
    assert a.ev("document.querySelector('.kpi-wide > .bal-calc') !== null")
    assert a.ev("document.querySelector('.kpi-hoy').children.length") == 2
    assert a.ev("document.querySelector('.ytd') !== null")


def test_navegacion_movil(movil):
    """En el móvil: barra inferior con 5 secciones + botón de añadir, y sub-pestañas dentro de cada sección."""
    a = movil
    assert a.page.locator('#bottomnav .bn-item').count() == 4
    assert a.page.locator('#bottomnav .bn-plus').count() == 1
    a.page.click('#bottomnav [data-action="sec"][data-sec="patrimonio"]'); a.page.wait_for_timeout(200)
    assert a.ev('S.tab') == 'inversiones'
    assert a.page.locator('#subtabs button').count() == 5
    a.page.click('#subtabs button:has-text("Deudas")'); a.page.wait_for_timeout(200)
    assert a.ev('S.tab') == 'deudas'
    a.page.click('#bottomnav [data-action="sec"][data-sec="inicio"]'); a.page.wait_for_timeout(150)
    a.page.click('#bottomnav [data-action="sec"][data-sec="patrimonio"]'); a.page.wait_for_timeout(150)
    assert a.ev('S.tab') == 'deudas', 'Debe recordar la última sub-pestaña de la sección'


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
