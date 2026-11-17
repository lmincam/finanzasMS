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


def test_indice_vivienda_ine():
    """scripts/vivienda.mjs: variación trimestral de segunda mano por comunidad, encadenando la tabla antigua (índices) y la nueva."""
    import json
    e = {**os.environ, 'SUPABASE_URL': 'https://x.supabase.co', 'SUPABASE_SERVICE_ROLE_KEY': 'sb_secret_prueba'}
    r = subprocess.run(['node', '--import', str(RAIZ / 'tests' / 'stub' / 'vivienda_mock.mjs'), str(RAIZ / 'scripts' / 'vivienda.mjs')],
                       capture_output=True, text=True, env=e, timeout=60)
    assert r.returncode == 0, r.stderr
    v = json.loads(r.stdout.split('IPV:', 1)[1])
    assert v['ultimo'] == '2026T2'
    m = v['series']['madrid']
    assert m['2025T2'] == 5.0 and m['2025T3'] == 2.0 and m['2025T4'] == 3.0   # de los índices
    assert m['2026T1'] == 4.0 and m['2026T2'] == 1.0                           # variaciones de la tabla nueva
    assert '2026T1' in v['series']['nacional']
    # Ministerio de Vivienda por provincia: solo vivienda libre, total; "León" no se confunde con "Castilla y León"
    g = v['series']['p:granada']
    assert g['2026T1'] == 2.0 and g['2026T2'] == 2.0
    assert v['series']['p:leon_p']['2026T2'] == 1.0
    assert v['series']['p:coruna']['2026T2'] == 1.0
    assert 'sb_secret_prueba' not in r.stdout + r.stderr


def test_valor_tasado_formato_ancho(tmp_path):
    """Si el CSV del Ministerio viene con un trimestre por columna (y con comas), también se entiende."""
    import json
    f = tmp_path / 'mivau.csv'
    f.write_text('Comunidad / Provincia,2025 T4,2026 T1,2026 T2\n"Andalucía",2000,2050,2100\n"Granada","1500,0","1545,0","1575,9"\n"Valencia/València",1800,1800,1836\n', encoding='utf-8')
    e = {**os.environ, 'SUPABASE_URL': 'https://x.supabase.co', 'SUPABASE_SERVICE_ROLE_KEY': 'sb_secret_prueba', 'MIVAU_FIXTURE': str(f)}
    r = subprocess.run(['node', '--import', str(RAIZ / 'tests' / 'stub' / 'vivienda_mock.mjs'), str(RAIZ / 'scripts' / 'vivienda.mjs')],
                       capture_output=True, text=True, env=e, timeout=60)
    assert r.returncode == 0, r.stderr
    v = json.loads(r.stdout.split('IPV:', 1)[1])
    assert v['series']['p:granada'] == {'2026T1': 3.0, '2026T2': 2.0}
    assert v['series']['p:valencia']['2026T2'] == 2.0
    assert 'p:andalucia' not in v['series']
