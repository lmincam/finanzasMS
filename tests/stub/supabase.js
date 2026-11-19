/* Simulador de Supabase para las pruebas automáticas (tests/). Datos ficticios; no conecta con ningún servidor.
   Lo carga la página en lugar de supabase-js. localStorage 'stub_deny' simula un usuario sin acceso. */
(function(){
 const id=()=>Math.random().toString(36).slice(2);
 const T={cuentas:[{id:'a',nombre:'Cuenta Principal',entidad:'Unicaja',tipo:'corriente',saldo_inicial:2000,fecha_saldo_inicial:'2026-10-01',orden:1,activa:true,color:'#1d4ed8'},{id:'b',nombre:'Fondo de Emergencia',entidad:'MyInvestor',tipo:'ahorro',saldo_inicial:10000,fecha_saldo_inicial:'2026-10-01',orden:2,activa:true},{id:'c',nombre:'Efectivo',tipo:'efectivo',saldo_inicial:150,fecha_saldo_inicial:'2026-10-01',orden:3,activa:true},{id:'d',nombre:'Inversión Niños',entidad:'Trade Republic',tipo:'inversion',saldo_inicial:3000,fecha_saldo_inicial:'2026-10-01',valor_mercado:3500,fecha_valor_mercado:'2026-11-01',orden:4,activa:true}],
 categorias:[{id:'g1',nombre:'Vivienda',tipo:'gasto',presupuesto_mensual:900,orden:1,color:'#1e3a8a'},{id:'g2',nombre:'Hipoteca',tipo:'gasto',parent_id:'g1',presupuesto_mensual:0},{id:'g3',nombre:'Alimentación',tipo:'gasto',presupuesto_mensual:0,orden:2,color:'#16a34a'},{id:'gR',nombre:'Restaurantes y bares',tipo:'gasto',parent_id:'g3',presupuesto_mensual:150},{id:'g4',nombre:'Supermercado',tipo:'gasto',parent_id:'g3',presupuesto_mensual:100},{id:'i1',nombre:'Nómina',tipo:'ingreso',orden:1}],
 movimientos:[{id:'h1',cuenta_id:'a',fecha:'2026-09-10',mes_imputacion:'2026-09-01',concepto:'Mercadona',importe:-60,tipo:'gasto',categoria_id:'g4'},{id:'h2',cuenta_id:'a',fecha:'2026-10-10',mes_imputacion:'2026-10-01',concepto:'Mercadona',importe:-70,tipo:'gasto',categoria_id:'g4'},{id:'h3',cuenta_id:'a',fecha:'2026-10-11',mes_imputacion:'2026-10-01',concepto:'Taller',importe:-90,tipo:'gasto',categoria_id:'g3'},{id:'x1',cuenta_id:'a',fecha:'2026-11-09',mes_imputacion:'2026-11-01',concepto:'Lavadora nueva',importe:-1200,tipo:'gasto',categoria_id:null},{id:'tasca',cuenta_id:'a',fecha:'2026-11-07',mes_imputacion:'2026-11-01',concepto:'Restaurante La Tasca',importe:-200,tipo:'gasto',categoria_id:'gR',origen:'import'},{id:'m2',cuenta_id:'a',fecha:'2026-11-03',mes_imputacion:'2026-11-01',concepto:'Hipoteca',importe:-650,tipo:'gasto',categoria_id:'g2'},{id:'m3',cuenta_id:'a',fecha:'2026-11-05',mes_imputacion:'2026-11-01',concepto:'Mercadona',importe:-120.5,tipo:'gasto',categoria_id:'g4'},{id:'m4',cuenta_id:'a',fecha:'2026-11-06',mes_imputacion:'2026-11-01',concepto:'Aport. Trade Republic',importe:-200,tipo:'transferencia',subtipo_transferencia:'inversion',transfer_id:'t1',cuenta_contraria_id:'d'},{id:'m5',cuenta_id:'d',fecha:'2026-11-06',mes_imputacion:'2026-11-01',concepto:'Aport. Trade Republic',importe:200,tipo:'transferencia',subtipo_transferencia:'inversion',transfer_id:'t1',cuenta_contraria_id:'a'}],
 inmuebles:[{id:'h1',nombre:'Vivienda habitual',descripcion:'Piso + parking + trastero',metros_construidos:90,precio_m2_venta:2500,precio_m2_base:2500,fecha_m2_base:'2025-05-10',fecha_precio_m2:'2025-05-10',trimestre_ipv:'2025T2',ccaa:'granada',valor_automatico:true,caracteristicas:{estado:'reformado',planta:'alta',ascensor:true,exterior:true},precio_compra:180000,gastos_adquisicion:20000,valor_mercado:240000,renta_mensual:950,meses_vacio:1,gastos_ibi:400,gastos_comunidad:600,gastos_seguro:250,gastos_mantenimiento:500}],
 vehiculos:[{id:'v1',tipo:'coche',nombre:'Coche',valor_compra:25000,valor_actual:15000,anio:2020,km:63000},{id:'v2',tipo:'autocaravana',nombre:'Autocaravana',valor_compra:60000,valor_actual:52000,fecha_compra:'2023-05-01',notas:'ITV mayo'}],
 deudas:[{id:'d1',nombre:'Hipoteca vivienda',tipo:'hipoteca',capital_inicial:150000,fecha_inicio:'2020-01-01',plazo_meses:300,interes:2,cuota_mensual:650,capital_pendiente:120000,fecha_capital_pendiente:'2026-06-01',inmueble_id:'h1',activa:true}],
 snapshots:[{id:'s1',anio:2026,trimestre:2,fecha:'2026-06-30',liquidez:14000,inversiones:3000,inmuebles:240000,vehiculos:70000,deudas:121000,patrimonio_neto:206000}],
 valoraciones:[{id:'vv1',cuenta_id:'d',fecha:'2026-08-01',valor:3100,aportado_neto:2900},{id:'vv2',cuenta_id:'d',fecha:'2026-11-01',valor:3500,aportado_neto:null}],
 seguros:[{id:'sg1',tipo:'hogar',nombre:'Hogar',aseguradora:'Mapfre',inmueble_id:'h1',prima_anual:240,forma_pago:'anual',capital_asegurado:150000,capital_contenido:3000,activo:true}], amortizaciones:[], amortizaciones_plan:[], aportaciones_periodicas:[{id:'ap1',cuenta_id:'d',cuenta_origen_id:'a',importe:100,dia_mes:5,desde:'2026-10-05',activo:true}], posiciones:[{id:'ps1',cuenta_id:'d',nombre:'Mutuafondo Global',isin:'ES0165237001',tipo_activo:'fondo',clase:'renta_variable',region:'Global',porcentaje:70,participaciones:250,fecha_participaciones:'2026-10-01',orden:1},{id:'ps2',cuenta_id:'d',nombre:'iShares MSCI World',isin:'IE00B4L5Y983',tipo_activo:'etf',clase:'renta_variable',region:'Global',porcentaje:30,participaciones:8,fecha_participaciones:'2026-10-01',orden:2}], precios_m2:[], partidas_previstas:[], metas:[], reglas_categoria:[], patrimonio_mensual:[{id:'pm1',anio_mes:'2026-10',fecha:'2026-10-31',liquidez:12000,inversiones:3500,inmuebles:240000,vehiculos:67000,deudas:118500,patrimonio_neto:204000}],
 ajustes:[{clave:'regla_nomina',valor:{dias:5,umbral:300}},{clave:'indice_vivienda',valor:{consultado:'2026-11-10',ultimo:'2026T2',series:{'p:granada':{'2025T2':5,'2025T3':2,'2025T4':3,'2026T1':4,'2026T2':1},andalucia:{'2025T3':9,'2025T4':9,'2026T1':9,'2026T2':9},nacional:{'2026T1':3.5,'2026T2':2}}}}],
 notas:[],
 pertenencias:[{id:'pe1',nombre:'MacBook Air',categoria:'tecnologia',inmueble_id:'h1',cantidad:2,fecha_compra:'2025-11-01',precio_compra:2600},{id:'pe2',nombre:'Thermomix TM7',categoria:'cocina',inmueble_id:'h1',cantidad:1,fecha_compra:'2025-06-15',precio_compra:1599},{id:'pe3',nombre:'Cuna',categoria:'bebe',inmueble_id:'h1',cantidad:1,fecha_compra:'2026-01-10',precio_compra:450,valor_venta:300},{id:'pe4',nombre:'Roborock',categoria:'electro',inmueble_id:'h1',cantidad:1,fecha_compra:'2023-12-01',precio_compra:700}],
 mantenimientos:[{id:'mt1',vehiculo_id:'v1',fecha:'2026-03-12',tipo:'revision',descripcion:'Aceite y filtros',km:61000,coste:189.9,taller:'Talleres Pérez',proximo_km:76000,proxima_fecha:'2027-03-12'},{id:'mt2',vehiculo_id:'v1',fecha:'2025-11-20',tipo:'itv',descripcion:'ITV favorable',km:58000,coste:45,proxima_fecha:'2026-11-30'}], usuarios_permitidos:[{email:'luis@x.es'}], historial:[{id:2,fecha:'2026-11-17T10:30:00Z',usuario:'luis@x.es',tabla:'movimientos',registro_id:'m3',accion:'cambio',antes:{categoria_id:'g3'},despues:{categoria_id:'g4'}},{id:1,fecha:'2026-11-16T09:00:00Z',usuario:'pareja@x.es',tabla:'categorias',registro_id:'gR',accion:'cambio',antes:{presupuesto_mensual:100},despues:{presupuesto_mensual:150}}], precios:[{id:'p1',isin:'ES0165237001',fecha:'2026-10-01',precio:9.8,fuente:'EODHD'},{id:'p2',isin:'ES0165237001',fecha:'2026-10-06',precio:10,fuente:'EODHD'},{id:'p3',isin:'ES0165237001',fecha:'2026-11-05',precio:10.5,fuente:'EODHD'},{id:'p4',isin:'ES0165237001',fecha:'2026-11-13',precio:10.9,fuente:'EODHD'},{id:'p5',isin:'ES0165237001',fecha:'2026-11-16',precio:11,fuente:'EODHD'},{id:'q1',isin:'IE00B4L5Y983',fecha:'2026-10-01',precio:95,fuente:'Yahoo Finance'},{id:'q2',isin:'IE00B4L5Y983',fecha:'2026-10-06',precio:96,fuente:'Yahoo Finance'},{id:'q3',isin:'IE00B4L5Y983',fecha:'2026-11-05',precio:99,fuente:'Yahoo Finance'},{id:'q4',isin:'IE00B4L5Y983',fecha:'2026-11-13',precio:101.5,fuente:'Yahoo Finance'},{id:'q5',isin:'IE00B4L5Y983',fecha:'2026-11-16',precio:100.8,fuente:'Yahoo Finance'}]};
 function Q(t){this.t=t;this.op='select';this.f=[];}
 Q.prototype.select=function(){return this};Q.prototype.limit=function(){return this};Q.prototype.order=function(){return this};
 Q.prototype.range=function(a,b){this.r=[a,b];return this};
 Q.prototype.eq=function(c,v){this.f.push([c,v]);return this};Q.prototype.in=function(c,vals){this.fin=[c,vals];return this};
 Q.prototype.insert=function(rows){this.op='insert';this.rows=rows;return this};
 Q.prototype.update=function(p){this.op='update';this.p=p;return this};
 Q.prototype.delete=function(){this.op='delete';return this};
 Q.prototype.upsert=function(r){this.op='upsert';this.rows=[r];return this};
 Q.prototype.then=function(res){const t=T[this.t];const m=x=>this.f.every(([c,v])=>x[c]===v)&&(!this.fin||this.fin[1].includes(x[this.fin[0]]));let data=null;
  if(this.op==='select'){data=t.slice(this.r?this.r[0]:0,this.r?this.r[1]+1:undefined).map(x=>({...x}));}
  if(this.op==='insert'){data=this.rows.map(r=>({id:id(),created_at:new Date().toISOString(),...r}));t.push(...data);}
  if(this.op==='update'){t.filter(m).forEach(x=>Object.assign(x,this.p));data=t.filter(m);}
  if(this.op==='delete'){for(let i=t.length-1;i>=0;i--) if(m(t[i])) t.splice(i,1);}
  if(this.op==='upsert'){const k=this.oc||'id'; for(const r of this.rows){const e=t.find(x=>x[k]===r[k]); if(e)Object.assign(e,r); else t.push({...r});} data=this.rows;}
  return Promise.resolve({data,error:null}).then(res);};

 const USERS={'luis@x.es':'clave1234','pareja@x.es':'clave5678'};
 const store=new Map(); let cbs=[];
 const sess=()=>{try{return JSON.parse(localStorage.getItem('stub_sess')||'null')}catch(e){return null}};
 const auth={
  getSession:async()=>({data:{session:sess()}}),
  onAuthStateChange:(cb)=>{cbs.push(cb); return {data:{subscription:{unsubscribe(){}}}}},
  signInWithPassword:async({email,password})=>{ if(USERS[email]!==password) return {error:{message:'Invalid login credentials'}}; const s={user:{email,id:email}}; localStorage.setItem('stub_sess',JSON.stringify(s)); setTimeout(()=>cbs.forEach(c=>c('SIGNED_IN',s)),10); return {data:{session:s},error:null}; },
  signOut:async()=>{ localStorage.removeItem('stub_sess'); window.__signedOut=true; return {error:null}; },
  updateUser:async({password})=>{ window.__newPass=password; return {data:{user:(sess()||{}).user},error:null}; },
  resetPasswordForEmail:async(e,o)=>{ window.__reset=[e,o]; return {error:null}; }
 };
 const storage={from:(b)=>({
  list:async()=>({data:[...store.keys()].map(name=>({name,metadata:{size:store.get(name).length}})),error:null}),
  upload:async(name,blob)=>{ store.set(name, await blob.text()); return {error:null}; },
  download:async(name)=>({data:new Blob([store.get(name)]),error:null}),
  remove:async(names)=>{ names.forEach(n=>store.delete(n)); return {error:null}; }
 })};
 window.__store=store; window.__T=T;
 Q.prototype.upsert=function(r,o){this.op='upsert';this.rows=Array.isArray(r)?r:[r];this.oc=(o&&o.onConflict)||'id';return this};

 (function(){ const M=T.movimientos; const add=(f,c,imp,tipo,cat,n)=>M.push({id:'h'+M.length,cuenta_id:'a',fecha:f,mes_imputacion:f.slice(0,7)+'-01',concepto:c,notas:n||null,importe:imp,tipo,categoria_id:cat,origen:'import'});
   ['05','06','07','08','09','10'].forEach((mm,i)=>{ add('2026-'+mm+'-27','TRANSF NOMINA MINISTERIO DEFENSA',3200,'ingreso','i1');
     add('2026-'+mm+'-05','RECIBO IBERDROLA CLIENTES',-(55+i*3),'gasto','g1'); add('2026-'+mm+'-12','NETFLIX.COM',-12.99,'gasto','g1');
     add('2026-'+mm+'-02','RECIBO GIMNASIO ALTAFIT',-40,'gasto','g1'); add('2026-'+mm+'-08','COMPRA MERCADONA',-(250+i*37%90),'gasto','g4'); add('2026-'+mm+'-19','COMPRA MERCADONA',-(180+i*13),'gasto','g4');
     if (mm==='06'||mm==='09') add('2026-'+mm+'-10','RECIBO COLEGIO SAN JOSE',-300,'gasto','g1'); });
   add('2026-11-02','RECIBO GIMNASIO ALTAFIT',-40,'gasto','g1'); add('2026-11-05','RECIBO IBERDROLA CLIENTES',-70,'gasto','g1'); add('2026-11-12','NETFLIX.COM',-12.99,'gasto','g1');
 })();
 window.supabase={createClient:()=>({from:t=>new Q(t),auth,storage,rpc:async(fn)=>({data: fn==="es_permitido" ? !localStorage.getItem("stub_deny") : null, error:null})})};
})();
