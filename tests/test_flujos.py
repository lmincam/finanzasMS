"""Flujos de uso: registrar, conciliar, calendario, cierre de mes, menú de movimientos, acceso e historial."""


def test_gasto_tras_conciliar_resta(app):
    a = app
    a.ir('cuentas')
    a.page.click('.acc-card[data-id="c"]'); a.page.click('.modal [data-op="cuenta-conciliar"]'); a.page.fill('.modal [name="saldo"]', '150'); a.page.click('.modal [type=submit]'); a.page.wait_for_timeout(250)
    a.page.click('.nav-plus'); a.page.fill('#q-imp', '12,50'); a.page.fill('#q-concepto', 'Panadería'); a.page.click('#q-form [type=submit]'); a.page.wait_for_timeout(250)
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
    a.page.click('.mv .mv-more >> nth=0'); a.page.wait_for_timeout(150)
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


def test_mantenimiento_de_vehiculo(app):
    a = app
    a.ir('vehiculos')
    assert a.page.locator('.mant-row').count() == 2
    a.page.click('[data-action="mant-new"][data-id="v1"]'); a.page.wait_for_timeout(150)
    a.page.select_option('.modal [name="tipo"]', 'neumaticos')
    a.page.fill('.modal [name="km"]', '64000'); a.page.fill('.modal [name="coste"]', '320'); a.page.fill('.modal [name="descripcion"]', '4 neumáticos')
    a.page.click('.modal [type=submit]'); a.page.wait_for_timeout(300)
    assert a.page.locator('.veh-card').first.locator('.mant-row').count() == 3
    assert a.ev("S.vehiculos.find(v => v.id === 'v1').km") == 64000       # actualiza los km del coche
    a.ir('dashboard')
    assert 'Coche: ITV' in a.texto('#tab-dashboard')                       # la ITV vence en menos de 45 días


def test_editar_inmueble_mantiene_precio_actualizado(app):
    """El formulario enseña el €/m² de referencia; guardarlo sin tocarlo no deshace la actualización trimestral."""
    a = app
    a.ir('inmuebles')
    antes = a.ev("S.inmuebles[0].precio_m2_venta")
    a.page.click('[data-action="inm-edit"]'); a.page.wait_for_timeout(150)
    assert a.page.input_value('.modal [name="precio_m2_venta"]') in ('2500', '2500,00', '2.500,00')
    a.page.click('.modal [type=submit]'); a.page.wait_for_timeout(300)
    assert a.ev("S.inmuebles[0].precio_m2_venta") == antes and a.ev("S.inmuebles[0].precio_m2_base") == 2500
    # Un €/m² nuevo pasa a ser la referencia
    a.page.click('[data-action="inm-edit"]'); a.page.wait_for_timeout(150)
    a.page.fill('.modal [name="precio_m2_venta"]', '2900'); a.page.fill('.modal [name="fecha_precio_m2"]', '2026-11-17')
    a.page.click('.modal [type=submit]'); a.page.wait_for_timeout(300)
    assert a.ev("S.inmuebles[0].precio_m2_base") == 2900 and a.ev("S.inmuebles[0].trimestre_ipv") == '2026T4'


def test_movimientos_solo_cuentas_y_lista(app):
    """Anualidades dentro de su cuenta (y su detalle en una ventana); nada entre las cuentas y la lista de movimientos."""
    a = app
    a.ev("S.categorias.find(c => c.nombre === 'Alimentación').presupuesto_anual = 600; S.ajustesRows.push({ clave: 'cuenta_anualidades', valor: { id: 'b' } })")
    a.ir('cuentas')
    assert a.page.locator('#tab-cuentas .anual-card').count() == 0
    a.page.click('.acc-card[data-id="b"]'); a.page.wait_for_timeout(150)
    assert a.page.locator('.modal .acc-anual').count() == 1
    a.page.click('.modal .acc-anual'); a.page.wait_for_timeout(200)
    assert a.page.locator('.modal .anual-card').count() == 1


def test_iconos_de_comercio(app):
    """Comercio conocido → su icono; sin conocer → el de su categoría; y se puede elegir uno propio que se aplica a todo el comercio."""
    a = app
    a.ir('cuentas')
    ids = a.ev("Object.fromEntries(S.movimientos.map(m => [m.concepto, m.id]))")
    assert 'icon-cart' in a.page.inner_html(f'.mv[data-id="{ids["Mercadona"]}"] .mv-ico') or a.page.locator(f'.mv[data-id="{ids["Mercadona"]}"] .mv-ico svg').count() == 1
    assert a.page.inner_text(f'.mv[data-id="{ids["NETFLIX.COM"]}"] .mv-ico').strip() == 'N'
    assert a.ev("claveComercio('COMPRA TARJ. 4512XXXX MERCADONA GRANADA 12/11')") == 'mercadona granada'
    assert a.ev("iconoCategoria(S.movimientos.find(m => /Tasca/.test(m.concepto)).categoria_id)") == 'fork'
    # Elegir icono propio para "Lavadora nueva"
    a.page.click(f'.mv[data-id="{ids["Lavadora nueva"]}"] .mv-more'); a.page.wait_for_timeout(150)
    a.page.click('.mv-op[data-action="mov-icono"]'); a.page.wait_for_timeout(150)
    a.page.fill('#ico-letras', 'LV'); a.page.click('.modal [data-guardar]'); a.page.wait_for_timeout(300)
    assert a.page.inner_text(f'.mv[data-id="{ids["Lavadora nueva"]}"] .mv-ico').strip() == 'LV'


def test_selector_de_mes(movil):
    """Movimientos: ‹ mes › con selector propio (sin <input type=month>), incluido "Todos los meses"."""
    a = movil
    a.ir('cuentas')
    assert a.page.locator('#tab-cuentas input[type=month]').count() == 0
    a.page.click('[data-action="mf-mes-pick"]'); a.page.wait_for_timeout(150)
    a.page.click('.modal [data-ym="2026-09"]'); a.page.wait_for_timeout(200)
    assert a.ev('S.movFilter.mes') == '2026-09'
    a.page.click('[data-action="mf-mes-shift"][data-d="1"]'); a.page.wait_for_timeout(150)
    assert a.ev('S.movFilter.mes') == '2026-10'
    a.page.click('[data-action="mf-mes-pick"]'); a.page.wait_for_timeout(150)
    a.page.click('.modal [data-todos]'); a.page.wait_for_timeout(200)
    assert a.ev('S.movFilter.mes') == ''
    assert 'Todos los meses' in a.texto('[data-action="mf-mes-pick"]')
    # Inicio: el mismo selector
    a.ir('dashboard')
    a.page.click('[data-action="mes-pick"]'); a.page.wait_for_timeout(150)
    a.page.click('.modal [data-ym="2026-08"]'); a.page.wait_for_timeout(200)
    assert a.ev('S.period.ref') == '2026-08'


def test_cuentas_liquidez_2x2(app):
    """Orden de la cuadrícula: corriente, efectivo, ahorro (fondo de emergencia) y anualidades."""
    a = app
    a.ev("S.ajustesRows.push({ clave: 'cuenta_anualidades', valor: { id: 'b' } }); S.cuentas.push({ ...S.cuentas.find(c => c.id === 'b'), id: 'fe', nombre: 'Fondo emergencia', tipo: 'ahorro', orden: 99 })")
    a.ir('cuentas')
    nombres = a.ev("[...document.querySelectorAll('.acc-liq .acc-name')].map(x => x.textContent)")
    assert nombres[0] == 'Cuenta Principal' and nombres[1] == 'Efectivo' and nombres[2] == 'Fondo emergencia'
    assert nombres[3] == a.ev("S.cuentas.find(c => c.id === 'b').nombre")
    assert a.ev("getComputedStyle(document.querySelector('.acc-liq')).gridTemplateColumns.split(' ').length") == 2


def test_pertenencias(app):
    """No suman al neto; venta estimada con depreciación por categoría; aviso si el contenido del seguro no cubre la reposición."""
    a = app
    neto = a.ev("Calc.patrimonio().neto")
    T = a.ev("pertTotales()")
    assert T['n'] == 4 and T['repo'] == 2600 + 1599 + 450 + 700
    assert a.ev("pertInfo(S.pertenencias.find(p => p.id === 'pe3')).venta") == 300         # valor de venta puesto a mano
    assert a.ev("pertInfo(S.pertenencias.find(p => p.id === 'pe4')).venta") < 700 * 0.7     # se deprecia sola
    assert a.ev("Calc.patrimonio().neto") == neto                                          # el neto no cambia
    a.ir('pertenencias')
    assert 'no cubre' in a.texto('#tab-pertenencias')
    a.ir('patrimonio')
    assert 'Con pertenencias' in a.texto('#tab-patrimonio')
    a.ir('dashboard')
    assert 'Contenido infraasegurado' in a.ev("document.querySelector('.crs-alertas').textContent")
    # Alta nueva
    a.ir('pertenencias')
    a.page.click('[data-action="pert-new"]'); a.page.wait_for_timeout(150)
    a.page.fill('.modal [name="nombre"]', 'Apple Watch'); a.page.fill('.modal [name="cantidad"]', '2'); a.page.fill('.modal [name="precio_compra"]', '900')
    a.page.click('.modal [type=submit]'); a.page.wait_for_timeout(300)
    assert a.ev("pertTotales().n") == 5


COLORES = ['#16a34a', '#15803d', '#22c55e', '#65a30d', '#059669', '#047857', '#4d7c0f', '#10b981', '#166534', '#84cc16', '#3f6212', '#34d399']


def test_presupuestos_menu_categoria(app):
    a = app
    a.ir('categorias')
    assert a.page.locator('#tab-categorias .cat-r').count() >= 5
    assert a.page.locator('#tab-categorias .cat-r [data-action="cat-del"]').count() == a.page.locator('#tab-categorias .cat-r').count()
    a.page.click('.cat-r [data-action="cat-edit"] >> nth=0'); a.page.wait_for_timeout(150)
    assert a.page.locator('.modal [name="nombre"]').count() == 1
    assert a.page.locator('.modal [name="color"]').count() == 0                       # el color lo pone la app
    cols = a.ev("S.categorias.filter(c => c.tipo === 'gasto' && !c.parent_id).map(c => c.color)")
    assert len(set(cols)) == len(cols) and not any(c in COLORES for c in cols)


def test_donde_va_el_dinero(app):
    a = app
    a.ir('dashboard')
    assert 'Dónde va vuestro dinero' in a.texto('#tab-dashboard')
    izq = a.page.locator('.dv-col:not(.dv-r) .dv-leg li').all_inner_texts()
    assert izq and izq[0].strip()[0].isdigit()                       # el % va delante
    der = a.page.locator('.dv-r .dv-leg li').all_inner_texts()
    assert der and der[-1].strip().endswith('%')                     # el % va al final
    r = a.ev("(() => { const st = periodStats(periodMonths()); const d = destinosAhorro(st); return [st.ingresos, st.gastosCaja + d.reduce((x, y) => x + y.v, 0)] })()")
    assert abs(r[0] - r[1]) < 0.01                                   # gastos + ahorro + lo que queda = 100 % de lo ingresado


def test_foto_de_perfil(app, tmp_path):
    import base64
    a = app
    png = tmp_path / 'yo.png'
    png.write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg=='))
    a.page.click('#user-chip'); a.page.wait_for_timeout(200)
    a.page.set_input_files('#av-file', str(png)); a.page.wait_for_timeout(600)
    assert a.page.locator('#user-chip img').count() == 1                  # la foto sale en el círculo de arriba
    assert a.page.locator('#tabs [data-sec="ajustes"]').count() == 0      # Ajustes ya no está en la barra
    assert a.page.locator('#tabs .nav-plus').count() == 1                 # + en medio de la barra


def test_notas(app):
    a = app
    a.ir('notas')
    assert 'Notas' in a.texto('#tab-notas')
    for t in ('Primera nota\nCambiar de tarifa de luz', 'Segunda nota\nRevisar seguro del coche en enero'):
        a.page.click('[data-action="nota-new"]'); a.page.fill('.modal [name="texto"]', t)
        a.page.click('.modal [type="submit"]'); a.page.wait_for_timeout(300)
    tit = a.page.locator('.nota-card .nota-tit').all_inner_texts()
    assert tit[:2] == ['Segunda nota', 'Primera nota']                    # de la más nueva a la más antigua
    assert 'Resumen en camino' in a.texto('#tab-notas')
    # con resumen al día se muestra el de la IA
    a.ev("(() => { const n = S.notas[0]; n.resumen = 'Resumen de prueba'; n.resumen_de = huellaNota(n.texto); renderNotas(); })()")
    assert 'Resumen de prueba' in a.texto('#tab-notas')
