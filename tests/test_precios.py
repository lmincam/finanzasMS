"""La tarea diaria de precios (scripts/precios.mjs) con las APIs simuladas: EODHD para fondos, Yahoo de respaldo."""
import os
import pathlib
import subprocess

RAIZ = pathlib.Path(__file__).resolve().parent.parent


def _run(**env):
    e = {**os.environ, 'SUPABASE_URL': 'https://x.supabase.co', 'SUPABASE_SERVICE_ROLE_KEY': 'sb_secret_prueba', **env}
    return subprocess.run(['node', '--import', str(RAIZ / 'tests' / 'stub' / 'precios_mock.mjs'), str(RAIZ / 'scripts' / 'precios.mjs')],
                          capture_output=True, text=True, env=e, timeout=60)


def test_precios_con_eodhd():
    r = _run(EODHD_API_KEY='k')
    assert r.returncode == 0, r.stderr
    assert '✅ ES0165237001' in r.stdout and 'EODHD' in r.stdout
    assert '✅ IE00B4L5Y983' in r.stdout          # sin datos en EODHD → Yahoo
    assert '❌ LU0000000000' in r.stdout          # ISIN inexistente: se informa, no rompe


def test_precios_sin_clave_no_falla():
    r = _run()
    assert r.returncode == 0, r.stderr
    assert 'Yahoo Finance' in r.stdout


def test_no_muestra_secretos():
    r = _run(EODHD_API_KEY='clave-super-secreta')
    assert 'clave-super-secreta' not in r.stdout + r.stderr
    assert 'sb_secret_prueba' not in r.stdout + r.stderr
