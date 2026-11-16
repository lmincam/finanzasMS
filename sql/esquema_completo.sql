-- =====================================================================
--  PATRIMONIO FAMILIAR · ESQUEMA COMPLETO DE BASE DE DATOS (v5.0)
--  ---------------------------------------------------------------------
--  Un único script para Supabase → SQL Editor → New query → Run.
--
--  • En una base de datos nueva: lo crea todo.
--  • En tu base de datos actual: solo añade lo que falte.
--  • Se puede ejecutar todas las veces que quieras: NUNCA borra ni
--    modifica tus datos (solo "create … if not exists", "add column
--    if not exists" y datos de ejemplo únicamente si las tablas están vacías).
--
--  SEGURIDAD (v5): solo pueden leer y escribir los usuarios que hayan
--  iniciado sesión (Supabase Auth). El acceso anónimo queda bloqueado.
--  ⚠ Ejecútalo DESPUÉS de crear vuestros usuarios y de subir la app v5.
--
--  Al terminar muestra una tabla de comprobación con ✅ / ❌.
-- =====================================================================


-- #####################################################################
--  BLOQUE 1 · Tablas base, seguridad y datos iniciales
-- #####################################################################
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. CUENTAS (corriente, ahorro, efectivo, inversión)
-- ---------------------------------------------------------------------
create table if not exists public.cuentas (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text not null,
  entidad              text,
  tipo                 text not null check (tipo in ('corriente','ahorro','efectivo','inversion')),
  saldo_inicial        numeric(14,2) not null default 0,     -- saldo real a cierre de "fecha_saldo_inicial"
  fecha_saldo_inicial  date not null default current_date,
  valor_mercado        numeric(14,2),                        -- solo inversión: valor de mercado actualizado a mano
  fecha_valor_mercado  date,
  color                text default '#1e3a5f',
  orden                int  default 0,
  activa               boolean default true,
  notas                text,
  created_at           timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 2. CATEGORÍAS (dinámicas, con subcategorías y presupuesto mensual)
-- ---------------------------------------------------------------------
create table if not exists public.categorias (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text not null,
  tipo                 text not null check (tipo in ('gasto','ingreso')),
  parent_id            uuid references public.categorias(id) on delete cascade,
  presupuesto_mensual  numeric(12,2) default 0,
  color                text,
  orden                int default 0,
  created_at           timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 3. INMUEBLES
-- ---------------------------------------------------------------------
create table if not exists public.inmuebles (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  descripcion           text,
  direccion             text,
  fecha_compra          date,
  precio_compra         numeric(14,2) default 0,
  gastos_adquisicion    numeric(14,2) default 0,   -- ITP/IVA, notaría, registro, gestoría, reformas
  valor_mercado         numeric(14,2) default 0,
  fecha_valoracion      date,
  renta_mensual         numeric(12,2) default 0,   -- renta estimada si se alquilase
  meses_vacio           numeric(4,1)  default 0,   -- meses/año sin inquilino estimados
  gastos_ibi            numeric(12,2) default 0,   -- €/año
  gastos_comunidad      numeric(12,2) default 0,   -- €/año
  gastos_seguro         numeric(12,2) default 0,   -- €/año
  gastos_mantenimiento  numeric(12,2) default 0,   -- €/año
  notas                 text,
  created_at            timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 4. DEUDAS (hipoteca y otros préstamos)
-- ---------------------------------------------------------------------
create table if not exists public.deudas (
  id                       uuid primary key default gen_random_uuid(),
  nombre                   text not null,
  tipo                     text default 'hipoteca' check (tipo in ('hipoteca','prestamo_personal','prestamo_vehiculo','otro')),
  entidad                  text,
  capital_inicial          numeric(14,2) default 0,
  fecha_inicio             date,
  plazo_meses              int,
  tipo_interes             text default 'fijo' check (tipo_interes in ('fijo','variable','mixto')),
  interes                  numeric(6,3) default 0,       -- TIN anual vigente en %
  cuota_mensual            numeric(12,2),
  capital_pendiente        numeric(14,2),
  fecha_capital_pendiente  date,
  inmueble_id              uuid references public.inmuebles(id) on delete set null,
  activa                   boolean default true,
  notas                    text,
  created_at               timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 5. VEHÍCULOS
-- ---------------------------------------------------------------------
create table if not exists public.vehiculos (
  id                   uuid primary key default gen_random_uuid(),
  tipo                 text default 'coche' check (tipo in ('coche','moto','autocaravana','otro')),
  nombre               text not null,
  marca_modelo         text,
  matricula            text,
  anio                 int,
  fecha_compra         date,
  valor_compra         numeric(14,2) default 0,
  valor_actual         numeric(14,2) default 0,
  fecha_valoracion     date,
  km                   int,
  gasto_seguro         numeric(12,2) default 0,   -- €/año
  gasto_impuesto       numeric(12,2) default 0,   -- €/año (IVTM)
  gasto_mantenimiento  numeric(12,2) default 0,   -- €/año
  notas                text,
  created_at           timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 6. MOVIMIENTOS
--    importe con signo: negativo = sale de la cuenta, positivo = entra.
--    Una transferencia interna se guarda como 2 filas (una por cuenta)
--    unidas por transfer_id. Nunca computan como gasto.
-- ---------------------------------------------------------------------
create table if not exists public.movimientos (
  id                     uuid primary key default gen_random_uuid(),
  cuenta_id              uuid not null references public.cuentas(id) on delete cascade,
  fecha                  date not null,
  mes_imputacion         date not null,              -- 1er día del mes al que se imputa (regla de nómina)
  concepto               text,
  notas                  text,                       -- concepto original del banco al importar
  importe                numeric(14,2) not null,
  tipo                   text not null check (tipo in ('gasto','ingreso','transferencia')),
  subtipo_transferencia  text check (subtipo_transferencia in ('liquidez','ahorro','inversion')),
  categoria_id           uuid references public.categorias(id) on delete set null,
  transfer_id            uuid,
  cuenta_contraria_id    uuid references public.cuentas(id) on delete set null,
  origen                 text default 'manual' check (origen in ('manual','import')),
  hash_import            text,
  created_at             timestamptz default now()
);

create unique index if not exists movimientos_hash_import_uq on public.movimientos(hash_import) where hash_import is not null;
create index if not exists movimientos_mes_idx      on public.movimientos(mes_imputacion);
create index if not exists movimientos_cuenta_idx   on public.movimientos(cuenta_id, fecha);
create index if not exists movimientos_transfer_idx on public.movimientos(transfer_id);
create index if not exists categorias_parent_idx    on public.categorias(parent_id);

-- ---------------------------------------------------------------------
-- 7. SNAPSHOTS TRIMESTRALES (auditoría patrimonial)
-- ---------------------------------------------------------------------
create table if not exists public.snapshots (
  id               uuid primary key default gen_random_uuid(),
  anio             int not null,
  trimestre        int not null check (trimestre between 1 and 4),
  fecha            date not null default current_date,
  liquidez         numeric(14,2) default 0,
  inversiones      numeric(14,2) default 0,
  inmuebles        numeric(14,2) default 0,
  vehiculos        numeric(14,2) default 0,
  deudas           numeric(14,2) default 0,
  patrimonio_neto  numeric(14,2) default 0,
  detalle          jsonb default '{}'::jsonb,
  notas            text,
  created_at       timestamptz default now(),
  unique (anio, trimestre)
);

-- ---------------------------------------------------------------------
-- 8. AJUSTES (compartidos entre móvil y ordenador)
-- ---------------------------------------------------------------------
create table if not exists public.ajustes (
  clave       text primary key,
  valor       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 9. SEGURIDAD: RLS activado con política abierta (uso personal sin login)
--    ⚠ Cualquiera que tenga tu URL + clave anon puede leer/escribir.
--      No publiques la clave en un repositorio público.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cuentas','categorias','movimientos','inmuebles','vehiculos','deudas','snapshots','ajustes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists acceso_personal on public.%I', t);
    execute format('create policy acceso_personal on public.%I for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 10. DATOS INICIALES (solo si las tablas están vacías)
-- ---------------------------------------------------------------------
do $$
declare v_inm uuid;
begin
  if not exists (select 1 from public.cuentas) then
    insert into public.cuentas (nombre, entidad, tipo, orden, color) values
      ('Cuenta Principal',    'Unicaja',        'corriente', 1, '#1d4ed8'),
      ('Fondo de Emergencia', 'MyInvestor',     'ahorro',    2, '#0891b2'),
      ('Efectivo',            null,             'efectivo',  3, '#65a30d'),
      ('Inversión Niños',     'Trade Republic', 'inversion', 4, '#7c3aed'),
      ('Inversión Familia',   'MyInvestor',     'inversion', 5, '#c026d3');
  end if;

  if not exists (select 1 from public.categorias) then
    insert into public.categorias (nombre, tipo, orden, color) values
      ('Vivienda',                'gasto',   1,  '#1e3a8a'),
      ('Alimentación',            'gasto',   2,  '#16a34a'),
      ('Transporte y vehículos',  'gasto',   3,  '#0891b2'),
      ('Hijos',                   'gasto',   4,  '#db2777'),
      ('Salud',                   'gasto',   5,  '#dc2626'),
      ('Ocio y viajes',           'gasto',   6,  '#ca8a04'),
      ('Compras',                 'gasto',   7,  '#7c3aed'),
      ('Suscripciones',           'gasto',   8,  '#ea580c'),
      ('Impuestos y comisiones',  'gasto',   9,  '#475569'),
      ('Otros gastos',            'gasto',   10, '#94a3b8'),
      ('Nómina',                  'ingreso', 1,  '#15803d'),
      ('Otros ingresos',          'ingreso', 2,  '#0d9488');

    insert into public.categorias (nombre, tipo, parent_id, orden)
    select s.hijo, p.tipo, p.id, s.ord
    from (values
      ('Vivienda','Hipoteca',1), ('Vivienda','Comunidad',2), ('Vivienda','Luz',3), ('Vivienda','Agua',4),
      ('Vivienda','Gas',5), ('Vivienda','Internet y móvil',6), ('Vivienda','Seguro hogar',7),
      ('Vivienda','IBI y tasas',8), ('Vivienda','Mantenimiento hogar',9),
      ('Alimentación','Supermercado',1), ('Alimentación','Restaurantes y bares',2),
      ('Transporte y vehículos','Combustible',1), ('Transporte y vehículos','Mantenimiento vehículos',2),
      ('Transporte y vehículos','Seguros vehículos',3), ('Transporte y vehículos','Impuestos vehículos',4),
      ('Transporte y vehículos','Peajes y parking',5), ('Transporte y vehículos','Autocaravana',6),
      ('Hijos','Colegio y material',1), ('Hijos','Extraescolares',2), ('Hijos','Ropa y calzado',3),
      ('Salud','Farmacia',1), ('Salud','Médicos y seguros',2),
      ('Ocio y viajes','Viajes',1), ('Ocio y viajes','Ocio',2), ('Ocio y viajes','Deporte',3),
      ('Compras','Ropa adultos',1), ('Compras','Hogar y electrónica',2), ('Compras','Regalos',3),
      ('Impuestos y comisiones','Hacienda',1), ('Impuestos y comisiones','Comisiones bancarias',2),
      ('Otros ingresos','Devolución Hacienda',1), ('Otros ingresos','Intereses y dividendos',2),
      ('Otros ingresos','Ventas',3), ('Otros ingresos','Ayudas y prestaciones',4)
    ) as s(padre, hijo, ord)
    join public.categorias p on p.nombre = s.padre and p.parent_id is null;
  end if;

  if not exists (select 1 from public.inmuebles) then
    insert into public.inmuebles (nombre, descripcion)
    values ('Vivienda habitual', 'Piso + plaza de parking + trastero')
    returning id into v_inm;

    if not exists (select 1 from public.deudas) then
      insert into public.deudas (nombre, tipo, inmueble_id, tipo_interes)
      values ('Hipoteca vivienda', 'hipoteca', v_inm, 'fijo');
    end if;
  end if;

  if not exists (select 1 from public.vehiculos) then
    insert into public.vehiculos (tipo, nombre) values
      ('coche', 'Coche'), ('moto', 'Moto'), ('autocaravana', 'Autocaravana');
  end if;

  insert into public.ajustes (clave, valor)
  values ('regla_nomina', '{"dias": 5, "umbral": 300}'::jsonb)
  on conflict (clave) do nothing;
end $$;

-- #####################################################################
--  BLOQUE 2 · Histórico de valoraciones de inversión
-- #####################################################################
-- Histórico de valoraciones de las cuentas de inversión
create table if not exists public.valoraciones (
  id             uuid primary key default gen_random_uuid(),
  cuenta_id      uuid not null references public.cuentas(id) on delete cascade,
  fecha          date not null default current_date,
  valor          numeric(14,2) not null,          -- valor de mercado de la cuenta ese día
  aportado_neto  numeric(14,2),                   -- capital aportado neto a esa fecha
  notas          text,
  created_at     timestamptz default now()
);
create index if not exists valoraciones_cuenta_idx on public.valoraciones(cuenta_id, fecha);

-- Mismo acceso que el resto de tablas (uso personal sin login)
alter table public.valoraciones enable row level security;
drop policy if exists acceso_personal on public.valoraciones;
create policy acceso_personal on public.valoraciones for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.valoraciones to authenticated;

-- Punto de partida: guarda como primera valoración el valor actual que ya tengas introducido
insert into public.valoraciones (cuenta_id, fecha, valor, aportado_neto)
select c.id, coalesce(c.fecha_valor_mercado, current_date), c.valor_mercado, null
from public.cuentas c
where c.tipo = 'inversion' and c.valor_mercado is not null
  and not exists (select 1 from public.valoraciones v where v.cuenta_id = c.id);

-- Ajustes por defecto de las alertas del Dashboard
insert into public.ajustes (clave, valor)
values ('alertas', '{"extra_umbral": 300, "fondo_meses": 6}'::jsonb)
on conflict (clave) do nothing;

-- #####################################################################
--  BLOQUE 3 · Seguros, amortizaciones, aportaciones periódicas, posiciones y m²
-- #####################################################################
-- ---------------------------------------------------------------------
-- 1. Movimientos: permitir el origen 'auto' (aportaciones periódicas)
--    Solo se amplía la regla de valores permitidos; los datos no cambian.
-- ---------------------------------------------------------------------
alter table public.movimientos drop constraint if exists movimientos_origen_check;
alter table public.movimientos add constraint movimientos_origen_check check (origen in ('manual','import','auto'));

-- ---------------------------------------------------------------------
-- 2. Inmuebles: superficie y precio por m²
-- ---------------------------------------------------------------------
alter table public.inmuebles add column if not exists referencia_catastral text;
alter table public.inmuebles add column if not exists metros_construidos  numeric(8,2);
alter table public.inmuebles add column if not exists metros_utiles       numeric(8,2);
alter table public.inmuebles add column if not exists precio_m2_venta     numeric(10,2);   -- €/m² zona
alter table public.inmuebles add column if not exists precio_m2_alquiler  numeric(8,2);    -- €/m²/mes zona
alter table public.inmuebles add column if not exists fecha_precio_m2     date;
alter table public.inmuebles add column if not exists ajuste_pct          numeric(6,2) default 0;  -- +/- % por estado, planta, reforma…
alter table public.inmuebles add column if not exists valor_anejos        numeric(14,2) default 0; -- parking + trastero
alter table public.inmuebles add column if not exists renta_anejos        numeric(10,2) default 0; -- €/mes parking + trastero
alter table public.inmuebles add column if not exists valor_automatico    boolean default true;
alter table public.inmuebles add column if not exists url_precios         text;

create table if not exists public.precios_m2 (
  id            uuid primary key default gen_random_uuid(),
  inmueble_id   uuid not null references public.inmuebles(id) on delete cascade,
  fecha         date not null default current_date,
  m2_venta      numeric(10,2),
  m2_alquiler   numeric(8,2),
  valor_venta   numeric(14,2),
  renta_mensual numeric(12,2),
  created_at    timestamptz default now()
);
create index if not exists precios_m2_inm_idx on public.precios_m2(inmueble_id, fecha);

-- ---------------------------------------------------------------------
-- 3. Deudas: comisión por amortización anticipada y amortizaciones
-- ---------------------------------------------------------------------
alter table public.deudas add column if not exists comision_amortizacion numeric(5,2) default 0;  -- % sobre lo amortizado

create table if not exists public.amortizaciones (
  id                  uuid primary key default gen_random_uuid(),
  deuda_id            uuid not null references public.deudas(id) on delete cascade,
  fecha               date not null,
  importe             numeric(14,2) not null,
  modo                text not null default 'plazo' check (modo in ('plazo','cuota')),
  comision            numeric(12,2) default 0,
  pendiente_antes     numeric(14,2),
  cuota_antes         numeric(12,2),
  cuota_despues       numeric(12,2),
  meses_ahorrados     int,
  ahorro_intereses    numeric(14,2),     -- ahorro total previsto calculado al registrarla
  notas               text,
  created_at          timestamptz default now()
);
create index if not exists amortizaciones_deuda_idx on public.amortizaciones(deuda_id, fecha);

create table if not exists public.amortizaciones_plan (
  id          uuid primary key default gen_random_uuid(),
  deuda_id    uuid not null references public.deudas(id) on delete cascade,
  importe     numeric(14,2) not null,
  cada_meses  int not null default 12,
  desde       date not null,
  hasta       date,
  modo        text not null default 'plazo' check (modo in ('plazo','cuota')),
  activo      boolean default true,
  notas       text,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 4. Inversiones: aportaciones periódicas y posiciones (ISIN / producto)
-- ---------------------------------------------------------------------
create table if not exists public.aportaciones_periodicas (
  id               uuid primary key default gen_random_uuid(),
  cuenta_id        uuid not null references public.cuentas(id) on delete cascade,   -- cuenta de inversión destino
  cuenta_origen_id uuid references public.cuentas(id) on delete set null,           -- de dónde sale el dinero
  importe          numeric(12,2) not null,
  dia_mes          int not null default 1 check (dia_mes between 1 and 28),
  desde            date not null default current_date,
  hasta            date,
  activo           boolean default true,
  omitidos         text[] default '{}',      -- meses (AAAA-MM) que no deben generarse (borrados a mano)
  notas            text,
  created_at       timestamptz default now()
);

create table if not exists public.posiciones (
  id           uuid primary key default gen_random_uuid(),
  cuenta_id    uuid not null references public.cuentas(id) on delete cascade,
  nombre       text not null,
  isin         text,
  tipo_activo  text default 'fondo',      -- fondo, etf, accion, bono, plan_pensiones, monetario, cripto, liquidez, otro
  clase        text default 'renta_variable',  -- renta_variable, renta_fija, monetario, liquidez, inmobiliario, materias_primas, cripto, otro
  region       text,                      -- Global, EEUU, Europa, Emergentes, España…
  porcentaje   numeric(6,2),              -- % de la cuenta (opción A)
  valor        numeric(14,2),             -- valor en € (opción B)
  orden        int default 0,
  notas        text,
  created_at   timestamptz default now()
);
create index if not exists posiciones_cuenta_idx on public.posiciones(cuenta_id);

-- ---------------------------------------------------------------------
-- 5. Seguros
-- ---------------------------------------------------------------------
create table if not exists public.seguros (
  id                  uuid primary key default gen_random_uuid(),
  tipo                text not null default 'otro',   -- vehiculo, hogar, salud, vida, mascota, decesos, responsabilidad_civil, viaje, accidentes, otro
  nombre              text not null,
  aseguradora         text,
  poliza              text,
  tomador             text,
  asegurado           text,                           -- persona o bien asegurado
  vehiculo_id         uuid references public.vehiculos(id) on delete set null,
  inmueble_id         uuid references public.inmuebles(id) on delete set null,
  prima_anual         numeric(12,2) default 0,
  forma_pago          text default 'anual' check (forma_pago in ('anual','semestral','trimestral','mensual')),
  fecha_inicio        date,
  fecha_vencimiento   date,
  renovacion_auto     boolean default true,
  capital_asegurado   numeric(14,2),
  franquicia          numeric(12,2),
  coberturas          text,
  telefono_asistencia text,
  cuenta_id           uuid references public.cuentas(id) on delete set null,
  activo              boolean default true,
  notas               text,
  created_at          timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 6. Acceso (mismo criterio que el resto: uso personal sin login)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['precios_m2','amortizaciones','amortizaciones_plan','aportaciones_periodicas','posiciones','seguros'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists acceso_personal on public.%I', t);
    execute format('create policy acceso_personal on public.%I for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- Recarga la caché del API para que vea las columnas nuevas al momento
notify pgrst, 'reload schema';

-- #####################################################################
--  BLOQUE 4 · Reglas de categorización
-- #####################################################################
-- Reglas "si el concepto contiene X → categoría Y" que la app aprende de ti
create table if not exists public.reglas_categoria (
  id                   uuid primary key default gen_random_uuid(),
  patron               text not null,                 -- palabra clave en minúsculas, sin acentos (ej: 'glovo')
  tipo_mov             text not null default 'gasto' check (tipo_mov in ('gasto','ingreso','transferencia')),
  categoria_id         uuid references public.categorias(id) on delete cascade,
  cuenta_contraria_id  uuid references public.cuentas(id) on delete cascade,
  subtipo              text check (subtipo in ('liquidez','ahorro','inversion')),
  origen               text not null default 'usuario' check (origen in ('usuario','aprendida')),
  activa               boolean default true,
  usos                 int default 0,
  ultima_vez           date,
  created_at           timestamptz default now()
);
create unique index if not exists reglas_patron_uq on public.reglas_categoria (lower(patron));

alter table public.reglas_categoria enable row level security;
drop policy if exists acceso_personal on public.reglas_categoria;
create policy acceso_personal on public.reglas_categoria for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.reglas_categoria to authenticated;

-- Subcategoría útil para las reglas predefinidas (Glovo, Just Eat, Uber Eats…)
insert into public.categorias (nombre, tipo, parent_id, orden)
select 'Comida a domicilio', 'gasto', p.id, 3
from public.categorias p
where p.nombre = 'Alimentación' and p.parent_id is null
  and not exists (select 1 from public.categorias c where c.parent_id = p.id and c.nombre = 'Comida a domicilio');

notify pgrst, 'reload schema';

-- #####################################################################
--  BLOQUE 5 · Seguridad: solo usuarios con sesión + espacio para copias
-- #####################################################################
-- Quita cualquier permiso del rol anónimo en las tablas de la app
do $$
declare t text;
begin
  foreach t in array array['cuentas','categorias','movimientos','inmuebles','vehiculos','deudas','snapshots','ajustes',
                           'valoraciones','precios_m2','amortizaciones','amortizaciones_plan','aportaciones_periodicas',
                           'posiciones','seguros','reglas_categoria'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon', t);
    end if;
  end loop;
end $$;

-- Espacio privado "copias" para las copias de seguridad automáticas (Supabase Storage)
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('copias', 'copias', false) on conflict (id) do nothing;
    execute 'drop policy if exists copias_familia on storage.objects';
    execute $p$create policy copias_familia on storage.objects for all to authenticated
              using (bucket_id = 'copias') with check (bucket_id = 'copias')$p$;
  end if;
end $$;

notify pgrst, 'reload schema';


-- #####################################################################
--  COMPROBACIÓN FINAL (solo lectura)
-- #####################################################################
select 'Tabla ' || t as elemento,
       case when to_regclass('public.' || t) is not null then '✅ OK' else '❌ FALTA' end as estado
from unnest(array['cuentas','categorias','movimientos','inmuebles','vehiculos','deudas','snapshots','ajustes',
                  'valoraciones','precios_m2','amortizaciones','amortizaciones_plan','aportaciones_periodicas',
                  'posiciones','seguros','reglas_categoria']) as t
union all
select 'Columna ' || tb || '.' || col,
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = tb and column_name = col)
            then '✅ OK' else '❌ FALTA' end
from (values ('inmuebles','metros_construidos'), ('inmuebles','precio_m2_venta'),
             ('deudas','comision_amortizacion'), ('aportaciones_periodicas','omitidos')) as y(tb, col)
union all
select 'Acceso anónimo bloqueado',
       case when exists (select 1 from pg_roles where rolname = 'anon')
                 and not has_table_privilege('anon', 'public.movimientos', 'select') then '✅ OK' else '❌ REVISAR' end
union all
select 'Espacio de copias de seguridad',
       case when to_regclass('storage.buckets') is null then '— (solo en Supabase)'
            when (xpath('/row/n/text()', query_to_xml('select count(*) as n from storage.buckets where id = ''copias''', false, true, '')))[1]::text::int > 0
              then '✅ OK' else '❌ FALTA' end;
