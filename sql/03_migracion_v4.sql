-- =====================================================================
--  PATRIMONIO FAMILIAR · Migración v4
--  Seguros, amortizaciones anticipadas, aportaciones periódicas,
--  posiciones de inversión (ISIN) y precio por m² de inmuebles.
--
--  SOLO AÑADE tablas y columnas. No borra ni modifica ningún dato.
--  Ejecutar en: Supabase → SQL Editor → New query → Run
-- =====================================================================

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
    execute format('create policy acceso_personal on public.%I for all to anon, authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- Recarga la caché del API para que vea las columnas nuevas al momento
notify pgrst, 'reload schema';
