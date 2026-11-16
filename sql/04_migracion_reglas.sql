-- =====================================================================
--  PATRIMONIO FAMILIAR · Migración v4.1 (reglas de categorización)
--  SOLO AÑADE una tabla y una subcategoría. No modifica ni borra datos.
--  Ejecutar en: Supabase → SQL Editor → New query → Run
-- =====================================================================

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
create policy acceso_personal on public.reglas_categoria for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.reglas_categoria to anon, authenticated;

-- Subcategoría útil para las reglas predefinidas (Glovo, Just Eat, Uber Eats…)
insert into public.categorias (nombre, tipo, parent_id, orden)
select 'Comida a domicilio', 'gasto', p.id, 3
from public.categorias p
where p.nombre = 'Alimentación' and p.parent_id is null
  and not exists (select 1 from public.categorias c where c.parent_id = p.id and c.nombre = 'Comida a domicilio');

notify pgrst, 'reload schema';
