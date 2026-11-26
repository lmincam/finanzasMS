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


def test_prevision_detecta_nomina(app):
    """La nómina se detecta aunque el concepto cambie cada mes, y la paga extra no altera el importe previsto."""
    a = app
    a.ev("""(() => { S.movimientos = S.movimientos.filter(m => m.tipo !== 'ingreso'); const ms = [['2026-06-27', 2400, 'NOMINA JUNIO REF 1182'], ['2026-06-27', 2400, 'PAGA EXTRA JUNIO NOMINA'], ['2026-07-28', 2410, 'TRANSF NOMINA JULIO REF 2211'],
        ['2026-08-27', 2400, 'NOMINA AGOSTO 3301'], ['2026-09-26', 2420, 'NOMINA SEPT 4410'], ['2026-10-28', 2415, 'NOMINA OCTUBRE 5521']];
      ms.forEach(([f, i, c], k) => S.movimientos.push({ id: 'nm' + k, cuenta_id: 'a', tipo: 'ingreso', fecha: f, mes_imputacion: f.slice(0, 7) + '-01', importe: i, concepto: c })); })()""")
    rs = a.ev("detectarRecurrentes().filter(r => r.key === 'ingreso|nomina')")
    assert len(rs) == 1
    assert 2400 <= rs[0]['importe'] <= 2420 and rs[0]['freq'] == 1
    assert a.ev("calcularPrevision().meses.slice(1).every(m => m.ingresos >= 2400)")


import pytest


@pytest.mark.parametrize("tin,base,p0,pend,dias", [(1.875, "act/360", 116399.55, 112745.31, 360), (1.90, "act/365", 116462.27, 112808.03, 365)])
def test_hipoteca_act360_cuadra_con_recibos_del_banco(app, tin, base, p0, pend, dias):
    # Recibos reales de Unicaja: cuota 425,62 €, TIN 1,875 %, días reales entre vencimientos (día 1) / 360
    banco = [("2025-09-01",237.68,187.94),("2025-10-01",244.12,181.50),("2025-11-03",238.46,187.16),("2025-12-01",244.87,180.75),("2026-01-02",239.24,186.38),("2026-02-02",239.63,185.99),("2026-03-02",257.98,167.64),("2026-04-01",240.43,185.19),("2026-05-04",246.78,178.84),("2026-06-01",241.22,184.40),("2026-07-01",247.54,178.08),("2026-08-03",242.01,183.61),("2026-09-01",242.40,183.22),("2026-10-01",248.69,176.93),("2026-11-02",243.19,182.43)]
    movs = [{"id": f"hb{i}", "cuenta_id": "a", "fecha": f, "importe": -425.62, "tipo": "gasto", "categoria_id": "gHB", "concepto": "Hipoteca"} for i, (f, _, _) in enumerate(banco)]
    r = app.ev("""(movs => { S.categorias.push({id:'gHB',tipo:'gasto',nombre:'Hipoteca banco',parent_id:null}); S.movimientos.push(...movs);
      const d = {id:'dHB',nombre:'Hipoteca Unicaja',tipo:'prestamo',interes:TIN,base_interes:'BASE',cuota_mensual:425.62,capital_pendiente:P0,fecha_capital_pendiente:'2025-08-01',categoria_cuota_id:'gHB',activa:true};
      S.deudas.push(d); _deudaCache.clear(); const L = ledgerDeuda(d, 'BASE', '2026-11-26');
      const I = deudaInfo(d); return { pagos: L.pagos.map(p => [p.interes, p.capital]), pend: L.pendiente, sig: I.sched[0] }; })""".replace("TIN", str(tin)).replace("BASE", base).replace("P0", str(p0)) + f"({__import__('json').dumps(movs)})")
    assert [p[0] for p in r['pagos']] == [b[2] for b in banco]
    assert [p[1] for p in r['pagos']] == [b[1] for b in banco]
    assert abs(r['pend'] - pend) < 0.01
    # Diciembre (30 días de noviembre): 112745,31 × 1,875 % × 30 / 360
    assert r['sig']['ym'] == '2026-12' and r['sig']['interes'] == round(pend * tin / 100 * 30 / dias, 2)


def test_hipoteca_cuotas_anteriores_al_dato_del_banco(app):
    # Mismo caso real, pero con el pendiente del banco tras el último recibo: las cuotas pasadas se reconstruyen hacia atrás
    banco = [("2025-09-01",237.68,187.94),("2025-10-01",244.12,181.50),("2025-11-03",238.46,187.16),("2025-12-01",244.87,180.75),("2026-01-02",239.24,186.38),("2026-02-02",239.63,185.99),("2026-03-02",257.98,167.64),("2026-04-01",240.43,185.19),("2026-05-04",246.78,178.84),("2026-06-01",241.22,184.40),("2026-07-01",247.54,178.08),("2026-08-03",242.01,183.61),("2026-09-01",242.40,183.22),("2026-10-01",248.69,176.93),("2026-11-02",243.19,182.43)]
    movs = [{"id": f"hc{i}", "cuenta_id": "a", "fecha": f, "importe": -425.62, "tipo": "gasto", "categoria_id": "gHC", "concepto": "Hipoteca"} for i, (f, _, _) in enumerate(banco)]
    import json
    r = app.ev("""(movs => { S.categorias.push({id:'gHC',tipo:'gasto',nombre:'Hipoteca C',parent_id:null}); S.movimientos.push(...movs);
      const d = {id:'dHC',nombre:'Hipoteca',tipo:'prestamo',interes:1.9,base_interes:'act/365',cuota_mensual:425.62,capital_pendiente:112808.32,fecha_capital_pendiente:'2026-11-01',categoria_cuota_id:'gHC',activa:true};
      S.deudas.push(d); _deudaCache.clear();
      return { atras: ledgerAtras(d).map(p => p.interes), cap: movs.map(m => capitalDeMovimiento(m)), fwd: ledgerDeuda(d).pagos.filter(p => p.real).length }; })""" + f"({json.dumps(movs)})")
    difs = [abs(a - b[2]) for a, b in zip(r['atras'], banco)]
    assert len(r['atras']) == 15 and max(difs) <= 0.01
    assert max(abs(c - b[1]) for c, b in zip(r['cap'], banco)) <= 0.01
    assert r['fwd'] == 0  # el recibo del 1/11 ya está en el dato del banco: no se cuenta dos veces


def test_prestamo_autocaravana_act365_dia_23(app):
    banco = [("2026-02-23",345.03,347.24),("2026-03-23",380.88,311.39),("2026-04-23",350.27,342.00),("2026-05-25",363.75,328.52),("2026-06-23",355.42,336.85),("2026-07-23",368.77,323.50),("2026-08-24",360.65,331.62),("2026-09-23",363.25,329.02),("2026-10-23",376.41,315.86),("2026-11-23",368.59,323.68)]
    movs = [{"id": f"ac{i}", "cuenta_id": "a", "fecha": f, "importe": -692.27, "tipo": "gasto", "categoria_id": "gAC", "concepto": "Préstamo autocaravana"} for i, (f, _, _) in enumerate(banco)]
    import json
    base = """(movs => { S.categorias.push({id:'gAC',tipo:'gasto',nombre:'Autocaravana',parent_id:null}); S.movimientos.push(...movs);
      const d = {id:'dAC',nombre:'Autocaravana',tipo:'prestamo',interes:8.5,base_interes:'act/365',cuota_mensual:692.27,capital_inicial:48100,fecha_inicio:'2026-01-23',plazo_meses:84,ANCLA,categoria_cuota_id:'gAC',activa:true};
      S.deudas.push(d); _deudaCache.clear(); return movs.map(m => [capitalDeMovimiento(m), Math.abs(m.importe) - capitalDeMovimiento(m)]); })"""
    # Desde la formalización (hacia delante) y desde el pendiente tras el último recibo (hacia atrás)
    for ancla in ("capital_pendiente:48100,fecha_capital_pendiente:'2026-01-23'", "capital_pendiente:44466.98,fecha_capital_pendiente:'2026-11-23'"):
        app.ev("S.deudas = S.deudas.filter(d => d.id !== 'dAC'); S.movimientos = S.movimientos.filter(m => m.categoria_id !== 'gAC')")
        r = app.ev(base.replace('ANCLA', ancla) + f"({json.dumps(movs)})")
        assert max(abs(c - b[1]) for (c, _), b in zip(r, banco)) <= 0.01, (ancla, r)
        assert max(abs(i - b[2]) for (_, i), b in zip(r, banco)) <= 0.011, (ancla, r)
