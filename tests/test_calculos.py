"""Cálculos clave con datos conocidos (stub): si alguno cambia sin querer, la prueba falla."""


def test_mes_de_nomina(app):
    a = app
    a.ev("""(()=>{S.ajustes.nomina_umbral=1000; const add=(id,f,mi,imp,tipo,cat,c)=>S.movimientos.push({id,cuenta_id:'a',fecha:f,mes_imputacion:mi,importe:imp,tipo,categoria_id:cat,concepto:c});
      add('t_n','2026-10-27','2026-11-01',2500,'ingreso','i1','NOMINA'); add('t_g1','2026-10-30','2026-10-01',-80,'gasto','gR','CENA'); add('t_g2','2026-10-20','2026-10-01',-30,'gasto','gR','CAFE');
      S.movimientos=[...S.movimientos];})()""")
    assert a.ev("mesDe(S.movimientos.find(m=>m.id==='t_g1'))") == '2026-11'   # gasto tras cobrar → mes de esa nómina
    assert a.ev("mesDe(S.movimientos.find(m=>m.id==='t_g2'))") == '2026-10'
    a.ev("S.ajustes.mes_nomina=false; _ciclos=null")
    assert a.ev("mesDe(S.movimientos.find(m=>m.id==='t_g1'))") == '2026-10'   # desactivado → mes natural


def test_balance_liquido_y_capital(app):
    st = app.ev("(()=>{const s=periodStats(['2026-11']); return {i:s.ingresos,gc:s.gastosCaja,c:s.capital,g:s.gastos,b:s.ahorro}})()")
    assert abs(st['g'] - (st['gc'] - st['c'])) < 0.01          # gastos operativos = cargos − capital
    assert abs(st['b'] - (st['i'] - st['gc'])) < 0.01          # balance líquido = ingresos − todos los cargos
    assert st['c'] > 0


def test_hipoteca_base_de_intereses(app):
    a = app
    a.ev("""(()=>{for (const f of ['2026-06-03','2026-07-03','2026-08-03','2026-09-03','2026-10-03']) S.movimientos.push({id:'q'+f,cuenta_id:'a',fecha:f,mes_imputacion:f.slice(0,7)+'-01',importe:-650,tipo:'gasto',categoria_id:'g2',concepto:'CUOTA'}); S.movimientos=[...S.movimientos]; _deudaCache=new Map();})()""")
    banco = a.ev("ledgerDeuda(S.deudas[0],'act/360','2026-11-03').pendiente")
    cal = a.ev(f"calibrarBase(S.deudas[0], {banco}, '2026-11-03')")
    assert cal['base'] == 'act/360' and abs(cal['dif']) < 0.01 and abs(cal['difAntes']) > 1


def test_inversion_participaciones_y_reparto(app):
    a = app
    A = a.ev("(()=>{const A=valorAutoCuenta(cuentaById('d')); return {v:A.valor, pos:[...A.pos.values()].map(x=>[x.acciones,x.peso])}})()")
    pesos = sorted(round(p[1], 3) for p in A['pos'])
    assert pesos == [0.3, 0.7]                                   # se respeta el % de cada producto
    # aportación del 05/10 (100 €) al precio del 06/10: 70 € / 10 € = 7 participaciones del fondo
    compra = a.ev("valorAutoCuenta(cuentaById('d')).compras.find(c=>c.fecha==='2026-10-05').items.find(i=>i.id==='ps1').acciones")
    assert abs(compra - 7) < 1e-9
    # un producto con 0 % no debe romper el reparto de los demás
    a.ev("S.posiciones.push({id:'ps3',cuenta_id:'d',nombre:'Antiguo',isin:'ES0165237001',porcentaje:0,participaciones:1,fecha_participaciones:'2026-10-01'})")
    pesos = sorted(round(v, 3) for v in a.ev("[...valorAutoCuenta(cuentaById('d')).pos.values()].map(x=>x.peso)"))
    assert pesos == [0, 0.3, 0.7]


def test_anualidades(app):
    a = app
    a.ev("""S.categorias.push({id:'a1',nombre:'Seguro',tipo:'gasto',presupuesto_anual:600,presupuesto_mensual:50},{id:'a2',nombre:'IBI',tipo:'gasto',presupuesto_anual:300,presupuesto_mensual:25},{id:'a3',nombre:'ITV',tipo:'gasto',presupuesto_anual:60,presupuesto_mensual:5})""")
    assert a.ev("sum(partidasAnuales(),'mensual')") == 80


def test_gasto_fijo_no_avisa_al_100(app):
    a = app
    a.ev("catById('g2').gasto_fijo = true; catById('g2').presupuesto_mensual = 650; render()")
    titulos = a.ev("[...document.querySelectorAll('.alert b.t')].map(e=>e.textContent)")
    assert not any('Hipoteca' in t for t in titulos)


def test_simulador_interes_compuesto(app):
    a = app
    # 1.000 € al 10 % anual con capitalización anual durante 10 años, sin aportaciones ni costes
    r = a.ev("simular({ ...SIM_DEF, inicial: 1000, aport: 0, rent: 10, cap: 1, anios: 10, meses: 0, ter: 0, infl: 0, impuestos: false }).saldo")
    assert abs(r - 1000 * 1.1 ** 10) < 0.01
    # 100 €/mes al final de cada mes, 12 % nominal capitalizado mensualmente, 1 año → valor futuro de una renta
    r = a.ev("simular({ ...SIM_DEF, inicial: 0, aport: 100, freq: 12, momento: 'final', rent: 12, cap: 12, anios: 1, meses: 0, ter: 0, subida: 0 }).saldo")
    assert abs(r - 100 * ((1.01 ** 12 - 1) / 0.01)) < 0.01
    # Escala del ahorro: 6.000 al 19 % + 4.000 al 21 %
    assert abs(a.ev("irpfAhorro(10000)") - 1980) < 0.001
    # La aportación necesaria lleva exactamente al objetivo
    need = a.ev("aportacionPara({ ...SIM_DEF, inicial: 0, rent: 5, anios: 10, meses: 0 }, 50000)")
    assert abs(a.ev(f"simular({{ ...SIM_DEF, inicial: 0, rent: 5, anios: 10, meses: 0, aport: {need} }}).saldo") - 50000) < 1


def test_inmueble_se_actualiza_con_el_ine(app):
    """El €/m² metido en mayo de 2025 (2025T2) se actualiza con los trimestres publicados después (T3 2025 … T2 2026)."""
    a = app
    i = a.ev("S.inmuebles[0]")
    assert i['trimestre_ipv'] == '2026T2'
    esperado = 2500 * 1.02 * 1.03 * 1.04 * 1.01
    assert abs(i['precio_m2_venta'] - round(esperado, 2)) < 0.01
    assert i['precio_m2_base'] == 2500                    # la referencia no cambia
    # Reformado (+8 %) y planta alta con ascensor (+3 %)
    assert abs(i['valor_mercado'] - round(90 * round(esperado, 2) * 1.11, 2)) < 0.02
