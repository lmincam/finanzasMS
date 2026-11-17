"""Pruebas automáticas de la app (se ejecutan en GitHub antes de publicar y en local con `pytest tests`).

Abren index.html en un Chromium sin ventana, con Supabase y Chart.js simulados (tests/stub), así que no
tocan datos reales. Cada prueba falla también si la página lanza cualquier error de JavaScript."""
import pathlib
import pytest
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
STUB = pathlib.Path(__file__).resolve().parent / 'stub'
INICIO = ("localStorage.setItem('pf_sb_url','https://x.supabase.co');localStorage.setItem('pf_sb_key','k');"
          "localStorage.setItem('stub_sess',JSON.stringify({user:{email:'luis@x.es',id:'u'}}));")


@pytest.fixture(scope='session')
def navegador():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


class App:
    def __init__(self, page, errores):
        self.page, self.errores = page, errores

    def ev(self, js):
        return self.page.evaluate(js)

    def ir(self, tab):
        self.page.evaluate(f"S.tab='{tab}'; S.dashCierre=null; S.dashCal=false; S.dashDet=null; S.invSel=null; render()")
        self.page.wait_for_timeout(150)

    def texto(self, sel):
        return self.page.inner_text(sel)


def _abrir(navegador, ancho, alto, extra=''):
    page = navegador.new_page(viewport={'width': ancho, 'height': alto})
    errores = []
    page.on('pageerror', lambda e: errores.append(str(e)))

    def ruta(r):
        u = r.request.url
        if 'supabase-js' in u:
            r.fulfill(path=str(STUB / 'supabase.js'), content_type='text/javascript')
        elif 'chart.js' in u or 'chart.umd' in u:
            r.fulfill(path=str(STUB / 'chart.js'), content_type='text/javascript')
        elif u.startswith('file:'):
            r.continue_()
        else:
            r.fulfill(body='', content_type='text/plain')
    page.route('**/*', ruta)
    page.add_init_script(INICIO + extra)
    page.goto((RAIZ / 'index.html').as_uri() + '#dashboard')
    page.wait_for_function("typeof S !== 'undefined' && S.connected && S.cuentas.length > 0", timeout=15000)
    page.wait_for_timeout(600)
    page.evaluate("document.querySelectorAll('.toast').forEach(t => t.remove())")
    return page, errores


@pytest.fixture
def app(navegador):
    page, errores = _abrir(navegador, 1300, 950)
    a = App(page, errores)
    yield a
    page.close()
    assert not errores, f'Errores de JavaScript: {errores}'


@pytest.fixture
def movil(navegador):
    page, errores = _abrir(navegador, 390, 844)
    a = App(page, errores)
    yield a
    page.close()
    assert not errores, f'Errores de JavaScript: {errores}'


@pytest.fixture
def abrir(navegador):
    """Para pruebas que necesitan abrir la app con un estado inicial distinto."""
    pages = []

    def _f(extra='', ancho=1300, alto=950):
        page, errores = _abrir(navegador, ancho, alto, extra)
        pages.append((page, errores))
        return App(page, errores)
    yield _f
    for page, errores in pages:
        page.close()
