# Patrimonio Familiar · Guía rápida de puesta en marcha

Tiempo estimado: 15 minutos. Coste: 0 €.

## 1. Crear la base de datos en Supabase

1. Entra en <https://supabase.com> → **Start your project** → regístrate (con GitHub es lo más cómodo).
2. **New project**:
   - Nombre: `patrimonio-familiar`
   - Database password: genera una y guárdala en tu gestor de contraseñas.
   - Región: **West EU (Ireland)** o **Central EU (Frankfurt)**.
3. Cuando termine de crearse (1-2 min), ve a **SQL Editor → New query**.
4. Pega el contenido completo de `supabase_schema.sql` y pulsa **Run**. Debe aparecer *Success. No rows returned*.
5. Comprueba en **Table Editor** que existen las tablas `cuentas`, `categorias`, `movimientos`, `inmuebles`, `vehiculos`, `deudas`, `snapshots` y `ajustes` (ya con tus 5 cuentas y categorías de ejemplo).
6. Ve a **Project Settings → API** (o **API Keys**) y copia:
   - **Project URL** → `https://xxxxxxxx.supabase.co`
   - **anon public key** (o la nueva **publishable key**, `sb_publishable_…`). Nunca uses la `service_role` / `secret`.

## 2. Publicar la web en GitHub Pages

1. En <https://github.com> → **New repository** → nombre p. ej. `patrimonio` → **Create**.
2. **Add file → Upload files** → sube `index.html` (puedes subir también este README y el `.sql`) → **Commit changes**.
3. **Settings → Pages** → *Build and deployment*: Source **Deploy from a branch**, Branch **main** / **(root)** → **Save**.
4. En 1-2 minutos tendrás la web en `https://TU-USUARIO.github.io/patrimonio/`.

> **Importante (seguridad):** en GitHub gratuito el repositorio de Pages es **público**: cualquiera puede ver el código.
> Por eso **no pegues la URL ni la clave dentro de `index.html`**. Configúralas desde la propia app (paso 3); se guardan solo en tu navegador.

## 3. Conectar la app (ordenador y móvil)

1. Abre la URL de GitHub Pages → pestaña **⚙️ Ajustes** → pega Project URL y clave → **Guardar y conectar**.
2. Repite lo mismo **una vez en el móvil** (Safari/Chrome).
3. Añádela a la pantalla de inicio para usarla como app:
   - iPhone (Safari): Compartir → **Añadir a pantalla de inicio**.
   - Android (Chrome): ⋮ → **Añadir a pantalla de inicio**.

## 4. Configuración inicial dentro de la app

1. **💳 Cuentas** → en cada cuenta pulsa **Conciliar saldo** e introduce su saldo real de hoy. En las de inversión usa **Actualizar valor**.
2. **🏦 Deudas** → edita la hipoteca: capital inicial, fecha de la 1ª cuota, plazo en meses, TIN, cuota y capital pendiente del último recibo.
3. **🏠 Inmuebles y vehículos** → completa precio de compra, gastos, valor de mercado y renta estimada; y las fichas de coche, moto y autocaravana.
4. **🏷️ Categorías** → crea, renombra o borra categorías y asigna presupuestos mensuales.
5. **⚙️ Ajustes → Regla de nómina**: por defecto, los ingresos ≥ 300 € recibidos en los últimos 5 días laborables del mes se imputan al mes siguiente. Ajústalo a tu caso.

## 5. Rutina

| Cuándo | Qué |
|---|---|
| Al momento (móvil) | Botón verde **+** → gasto en efectivo, o transferencia (p. ej. retirada de cajero → Efectivo). |
| Cada domingo | Descarga el Excel de Unicaja de la semana (domingo → sábado), con tus anotaciones ya revisadas → **💳 Cuentas → Importar extracto** → revisa la previsualización → Guardar. |
| Cada mes | **📊 Dashboard** en modo *Mes*: KPIs, presupuesto vs. real. |
| Fin de trimestre | Actualiza valor de inversiones, inmueble, vehículos y capital pendiente → **📸 Auditoría → Guardar foto**. Descarga una copia de seguridad en **⚙️ Ajustes**. |

## Notas

- **Pausa por inactividad:** en el plan gratuito, Supabase pausa el proyecto tras ~7 días sin uso. Con el uso semanal no debería pasar; si ocurre, entra en el panel de Supabase y pulsa **Restore project** (los datos no se pierden).
- **Importador:** la primera vez te pedirá confirmar qué columna es cada dato (fecha, concepto, anotaciones, importe o cargo/abono). Lo recuerda para las siguientes. Las categorías que asignes se "aprenden" por concepto y se proponen automáticamente después. Los duplicados se detectan por fecha + importe + concepto del banco.
- **Transferencias internas:** se guardan como dos apuntes enlazados (uno en cada cuenta) y nunca cuentan como gasto. Su naturaleza (liquidez / ahorro / inversión) alimenta la tasa de inversión del dashboard.
- **Más adelante:** si quieres blindar el acceso, el siguiente paso sería activar Supabase Auth (login por enlace al email) y cambiar las políticas RLS a `authenticated`.
