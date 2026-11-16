-- =====================================================================
--  PATRIMONIO FAMILIAR · Migración v2 (pestaña Inversiones)
--  SOLO AÑADE una tabla nueva. No modifica ni borra ningún dato existente.
--  Ejecutar en: Supabase → SQL Editor → New query → Run
-- =====================================================================

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
create policy acceso_personal on public.valoraciones for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.valoraciones to anon, authenticated;

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
