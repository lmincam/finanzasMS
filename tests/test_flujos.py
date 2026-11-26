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
    a.page.fill('.modal [name="precio_m2_venta"]', '2900'); a.page.select_option('.modal #f_fecha_precio_m2__d', '17'); a.page.select_option('.modal [name="fecha_precio_m2"] ~ .ds-m, .modal #f_fecha_precio_m2__d ~ .ds-m', '11'); a.page.select_option('.modal #f_fecha_precio_m2__d ~ .ds-y', '2026')
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
    assert 'Revisar seguro del coche' in a.texto('#tab-notas')         # se ve el principio del texto


def test_presupuesto_descuenta_bizum_pendiente(app):
    a = app
    r = a.ev("""(() => {
      const c = S.categorias.find(x => x.tipo === 'gasto' && x.parent_id && !presAnual(x) && !presAnual(catById(x.parent_id)));
      const g = { id: 'gx', tipo: 'gasto', importe: -150, a_cobrar: 75, categoria_id: c.id, fecha: todayISO(), cuenta_id: S.cuentas[0].id };
      const ant = budgetRows([g], 1, [mesActual()]).find(x => x.catId === c.id);
      const dev = { id: 'dx', tipo: 'gasto', importe: 50, reembolso_de: 'gx', categoria_id: c.id, fecha: todayISO(), cuenta_id: S.cuentas[0].id };
      S.movimientos.push(g, dev);
      const des = budgetRows([g, dev], 1, [mesActual()]).find(x => x.catId === c.id);
      S.movimientos = S.movimientos.filter(m => m.id !== 'gx' && m.id !== 'dx');
      return [ant.spent, ant.pend, des.spent, des.pend];
    })()""")
    assert r[0] == 75 and r[1] == 75          # 150 gastados, 75 por cobrar → cuentan 75
    assert r[2] == 75 and r[3] == 25          # cobrados 50 por Bizum: siguen contando 75 (25 aún por cobrar)


def test_presupuesto_ver_movimientos(app):
    a = app
    a.ir('dashboard')
    filas = a.page.locator('#tab-dashboard tr.bud-click')
    assert filas.count() > 0
    for i in range(min(filas.count(), 6)):
        f = filas.nth(i); esperado = float(f.get_attribute('data-spent'))
        f.click(); a.page.wait_for_timeout(150)
        tot = a.page.locator('.modal .bv-sum .tot b').inner_text()
        n = float(tot.replace('€', '').replace('.', '').replace(',', '.').replace('\u2212', '-').strip())
        assert abs(n - esperado) < 0.01, (f.get_attribute('data-nombre'), n, esperado)   # el detalle cuadra con la fila
        a.page.click('.modal [data-close]'); a.page.wait_for_timeout(100)


def test_actualizar_cartera_pide_token(app):
    a = app
    a.ir('inversiones')
    a.page.click('[data-action="inv-actualizar"]'); a.page.wait_for_timeout(200)
    assert a.page.locator('.modal #gh-tok').count() == 1                 # sin token, explica cómo crearlo
    a.page.click('.modal [data-x]')


def test_movimiento_fuera_de_saldo(app):
    """Un reajuste apuntado tras conciliar pero con fecha anterior no sumaba: ahora se avisa y se puede contar."""
    a = app
    a.ir('cuentas')
    cid = a.ev("(() => { const c = S.cuentas.find(x => x.tipo === 'corriente'); c.fecha_saldo_inicial = diaAnterior(todayISO()); c.saldo_actualizado = new Date().toISOString(); return c.id; })()")
    base = a.ev(f"num(cuentaById('{cid}').saldo_inicial)")
    antes = a.ev(f"Calc.saldo(cuentaById('{cid}'))")
    a.ev(f"S.movimientos.push({{ id: 'fx', cuenta_id: '{cid}', fecha: diaAnterior(diaAnterior(todayISO())), importe: -100, tipo: 'gasto', concepto: 'Reajuste', created_at: new Date(Date.now() + 5000).toISOString(), mes_imputacion: todayISO() }}); renderCuentas()")
    assert a.ev(f"Calc.saldo(cuentaById('{cid}'))") == antes                       # no suma (comportamiento de siempre)
    assert 'no suma al saldo' in a.texto('#tab-cuentas')
    a.page.click(f'.acc-card[data-id="{cid}"]'); a.page.wait_for_timeout(150)
    assert a.page.locator('.modal .acc-fuera').count() == 1
    a.page.click('.modal [data-op="cuenta-contar-fuera"]'); a.page.wait_for_timeout(400)
    assert abs(a.ev(f"num(cuentaById('{cid}').saldo_inicial)") - (base - 100)) < 0.01         # el saldo de partida ya lo incluye


def test_formulario_seguro_segun_tipo(app):
    a = app
    a.ir('seguros')
    a.ev("Actions['seg-new']()"); a.page.wait_for_timeout(150)
    vis = lambda n: a.page.locator(f'.modal [name="{n}"]').is_visible()
    assert vis('vehiculo_id') and not vis('capital_contenido') and not vis('inmueble_id')    # coche: sin contenido
    a.page.select_option('.modal [name="tipo"]', 'hogar')
    assert vis('inmueble_id') and not vis('vehiculo_id')
    if a.page.locator('.modal [name="capital_contenido"]').count(): assert vis('capital_contenido')
    a.page.select_option('.modal [name="tipo"]', 'salud')
    assert vis('asegurado') and not vis('capital_asegurado')


def test_selector_fecha_tres_partes(app):
    a = app
    a.ir('pertenencias')
    a.page.click('[data-action="pert-new"]'); a.page.wait_for_timeout(150)
    a.page.select_option('.modal #f_fecha_compra__d', '31')
    a.page.select_option('.modal #f_fecha_compra__d ~ .ds-m', '2')       # febrero: el 31 se ajusta al 28
    a.page.select_option('.modal #f_fecha_compra__d ~ .ds-y', '1998')
    assert a.page.input_value('.modal [name="fecha_compra"]') == '1998-02-28'
    a.page.click('.modal [name="fecha_compra"] ~ .ds-hoy')
    assert a.page.input_value('.modal [name="fecha_compra"]') == a.ev("todayISO()")


def test_mayores_gastos_netos_de_devoluciones(app):
    a = app
    a.ev("""(() => { const c = S.categorias.find(x => x.tipo === 'gasto' && !x.gasto_fijo && !(x.parent_id && (catById(x.parent_id) || {}).gasto_fijo)); const cu = S.cuentas[0].id, f = todayISO();
      S.movimientos.push({ id: 'g100', tipo: 'gasto', importe: -1000, concepto: 'Cena grande', categoria_id: c.id, fecha: f, cuenta_id: cu, mes_imputacion: f },
        { id: 'd50', tipo: 'gasto', importe: 500, reembolso_de: 'g100', concepto: 'Bizum', categoria_id: c.id, fecha: f, cuenta_id: cu, mes_imputacion: f },
        { id: 'g75', tipo: 'gasto', importe: -750, concepto: 'Compra mayor', categoria_id: c.id, fecha: f, cuenta_id: cu, mes_imputacion: f }); })()""")
    a.ir('dashboard')
    top = a.page.locator('.top-list .it b').all_inner_texts()
    assert top.index('Compra mayor') < top.index('Cena grande')      # 750 > 1000 − 500
    assert 'Bizum' not in top


def test_amortizacion_sin_actualizar_baja_el_pendiente(app):
    """Una amortización anticipada registrada después del dato del banco tiene que bajar el capital pendiente (y subir el patrimonio)."""
    a = app
    r = a.ev("""(() => { const d = S.deudas.find(x => x.activa !== false && num(x.interes) > 0); if (!d) return null;
      _deudaCache = new Map(); const antes = deudaInfo(d).pendienteHoy;
      S.amortizaciones = (S.amortizaciones || []).concat([{ id: 'ax', deuda_id: d.id, fecha: todayISO(), importe: 3000 }]);
      _deudaCache = new Map(); const despues = deudaInfo(d).pendienteHoy;
      S.amortizaciones = S.amortizaciones.filter(x => x.id !== 'ax'); _deudaCache = new Map();
      return [antes, despues]; })()""")
    assert r is not None
    assert abs((r[0] - r[1]) - 3000) < 1


def test_chequeo_de_datos(app):
    a = app
    r = a.ev("""(() => { const m = S.movimientos.find(x => x.tipo === 'gasto');
      S.movimientos.push({ ...m, id: 'dup1' });
      const sec = chequeoDatos(); S.movimientos = S.movimientos.filter(x => x.id !== 'dup1');
      return sec.find(s => s.titulo.startsWith('Posibles movimientos duplicados')).items.length; })()""")
    assert r >= 1
    a.ir('ajustes'); a.page.click('[data-action="chequeo-datos"]'); a.page.wait_for_timeout(200)
    assert 'Revisión de tus datos' in a.page.locator('.modal').inner_text()

def test_garantia_sin_desfase_horario(app):
    assert app.ev("garantiaDe({ fecha_compra: '2025-03-10' })") == '2028-03-10'
    assert app.ev("garantiaDe({ fecha_compra: '2024-02-29' })") == '2027-02-28'


def test_tabla_amortizacion_compara_banco(app):
    a = app
    a.ir('deudas')
    a.ev("Actions['deu-open']({dataset:{id:S.deudas[0].id}})"); a.page.wait_for_timeout(250)
    assert a.page.locator('.ta-card .ta-tbl tr').count() > 12
    inp = a.page.locator('.ta-anio[open] .ta-in >> nth=0')
    k = inp.get_attribute('data-k')
    fila = a.ev(f"filasAmortizacion(S.deudas[0]).find(f=>f.ym==='{k}')")
    inp.fill(str(fila['capital'])); inp.dispatch_event('change'); a.page.wait_for_timeout(300)
    assert a.ev(f"capBanco(S.deudas[0])['{k}']") is not None
    assert '✓' in a.texto('.ta-anio[open] .ta-tbl')
