"""Todos los JavaScript de la app y el script de precios se pueden leer (sin errores de sintaxis)."""
import pathlib
import subprocess

RAIZ = pathlib.Path(__file__).resolve().parent.parent


def test_sintaxis_js():
    ficheros = sorted((RAIZ / 'js').glob('*.js')) + [RAIZ / 'sw.js', RAIZ / 'scripts' / 'precios.mjs']
    for f in ficheros:
        r = subprocess.run(['node', '--check', str(f)], capture_output=True, text=True)
        assert r.returncode == 0, f'{f.name}: {r.stderr}'


def test_version_coherente():
    """La versión de config.js, la caché del service worker y los ?v= de index.html coinciden."""
    import re
    cfg = (RAIZ / 'js' / 'config.js').read_text()
    v = re.search(r"APP_VERSION\s*=\s*'([\d.]+)'", cfg).group(1)
    assert f"patrimonio-v{v}" in (RAIZ / 'sw.js').read_text()
    html = (RAIZ / 'index.html').read_text()
    vs = set(re.findall(r'\?v=([\d.]+)"', html))
    assert vs == {v}, f'index.html tiene versiones {vs}, config.js {v}'
    for src in re.findall(r'src="(js/[^"?]+)', html):
        assert (RAIZ / src).exists(), f'index.html carga {src}, que no existe'


def test_service_worker_shell_existe():
    import re
    sw = (RAIZ / 'sw.js').read_text()
    for f in re.findall(r"'\./([^']+)'", re.search(r'SHELL = \[(.*?)\]', sw).group(1)):
        assert (RAIZ / f).exists(), f'sw.js guarda {f}, que no existe'
