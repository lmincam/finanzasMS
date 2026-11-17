"""El SQL completo se puede ejecutar dos veces seguidas sin errores y la seguridad funciona.
Necesita una base PostgreSQL (en GitHub la pone el propio flujo); en local se salta si no hay PG_DSN."""
import os
import pathlib
import subprocess
import pytest

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DSN = os.environ.get('PG_DSN')
pytestmark = pytest.mark.skipif(not DSN, reason='sin base de datos de pruebas (PG_DSN)')

PREPARAR = """
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key default gen_random_uuid(), email text);
insert into auth.users(email) select 'luis@x.es' where not exists (select 1 from auth.users);
create or replace function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $f$;
grant usage on schema auth to authenticated; grant execute on function auth.jwt() to authenticated;
"""


def psql(sql=None, fichero=None):
    cmd = ['psql', DSN, '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A']
    cmd += ['-f', str(fichero)] if fichero else ['-c', sql]
    r = subprocess.run(cmd, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return r.stdout


def test_esquema_idempotente_y_seguro():
    psql(PREPARAR)
    for _ in range(2):
        salida = psql(fichero=RAIZ / 'sql' / 'esquema_completo.sql')
    assert '❌' not in salida, salida
    def como(email, sql):
        return psql(f"begin; set local role authenticated; set local request.jwt.claims = '{{\"email\":\"{email}\"}}'; {sql}; rollback;")
    assert int(como('luis@x.es', 'select count(*) from public.categorias').strip().splitlines()[-1]) > 0
    assert int(como('intruso@x.es', 'select count(*) from public.categorias').strip().splitlines()[-1]) == 0
    # el historial anota quién cambia qué, y nadie puede escribir en él directamente
    out = como('luis@x.es', "update public.categorias set presupuesto_mensual = 99 where id = (select id from public.categorias limit 1); select usuario || '|' || accion from public.historial order by id desc limit 1")
    assert 'luis@x.es|cambio' in out
    r = subprocess.run(['psql', DSN, '-c', "begin; set local role authenticated; insert into public.historial(tabla, accion) values ('x','y'); rollback;"], capture_output=True, text=True)
    assert 'permission denied' in r.stderr
