-- =====================================================================
--  PATRIMONIO FAMILIAR · Esquema de base de datos para Supabase
--  Ejecutar COMPLETO en: Supabase → SQL Editor → New query → Run
--  Es idempotente: puedes volver a ejecutarlo sin perder datos.
-- =====================================================================

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
    execute format('create policy acceso_personal on public.%I for all to anon, authenticated using (true) with check (true)', t);
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
