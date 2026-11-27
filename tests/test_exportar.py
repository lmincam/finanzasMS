"""Exportar para Claude: el informe se genera completo con los datos simulados y sin datos identificativos."""


def test_informe_completo(app):
    md = app.ev("informeClaude({ movimientos: true })")
    for t in ['## 1. Patrimonio neto hoy', '## 2. Cuentas', '## 6. Deudas', '## 7. Ingresos, gastos y ahorro', '## 8. Gasto por categoría', '## 16. Movimientos']:
        assert t in md, t
    assert 'No se pudo generar' not in md, md
    assert 'NaN' not in md and 'undefined' not in md and '[object' not in md


def test_sin_datos_identificativos(app):
    md = app.ev("informeClaude({ movimientos: true })")
    for campo in ['matricula', 'poliza', 'direccion', 'referencia_catastral', 'telefono_asistencia']:
        vals = app.ev(f"[...S.vehiculos, ...S.seguros, ...S.inmuebles].map(x => x['{campo}']).filter(v => v && String(v).length > 3)")
        for v in vals:
            assert str(v) not in md, f'{campo}: {v}'


def test_tarjeta_en_ajustes(movil):
    movil.ir('ajustes')
    assert 'Exportar para Claude' in movil.texto('#tab-ajustes')
    movil.page.click('[data-action="exp-copiar"]')
    movil.page.wait_for_timeout(300)
