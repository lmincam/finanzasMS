# Patrimonio Miñán Sánchez · v3

App web personal de control de patrimonio y finanzas familiares.
Interfaz en **GitHub Pages**, datos en **Supabase**.

## Estructura

```
index.html            Estructura de la página y carga de módulos (en orden)
manifest.json         Datos de la app instalable (nombre, iconos, colores)
sw.js                 Service worker: abre al instante y sin conexión
icons/                Iconos de la app
css/estilos.css       Todo el diseño
js/
  config.js           Versión de la app y claves de Supabase (vacías: se configuran en Ajustes)
  utilidades.js       Formato €, números, fechas, texto
  iconos.js           Iconos SVG propios (icono('home')) y cambio automático de emojis por iconos
  tema.js             Modo claro/oscuro (automático o elegido en Ajustes)
  patrimonio.js       Resumen de Patrimonio (lo que tenéis y lo que debéis; cada recuadro abre su apartado)
  vehiculos.js        Vehículos y su libro de mantenimiento
  simulador.js        Simulador de interés compuesto (pestaña Inversiones)
  estado.js           Estado global (S), constantes y registros de módulos
  datos.js            Única capa que habla con Supabase
  calculos.js         Saldos, patrimonio, préstamos, inmuebles, inversiones, periodos
  ui.js               Toasts, modales, formularios, selects, tarjetas
  graficos.js         Configuración común de Chart.js
  alertas.js          Motor de alertas y consejos del Dashboard
  dashboard.js        Pestaña Dashboard
  cuentas.js          Pestaña Cuentas y movimientos + registro rápido
  compartidos.js      Gastos compartidos y reembolsos (Bizum)
  reglas.js           Motor de reglas de categorización (predefinidas + aprendidas)
  importador.js       Importador de extractos de Unicaja
  prevision.js        Previsión de tesorería (recurrentes, partidas previstas)
  metas.js            Metas de ahorro y pestaña Previsión y metas
  inversiones.js      Pestaña Inversiones (global + detalle, posiciones, aportaciones periódicas)
  inmuebles.js        Pestaña Inmuebles (precio de venta actualizado con el INE cada trimestre)
  futuro.js           Proyección, independencia financiera e inflación
  deudas.js           Pestaña Deudas (vista general + detalle, simulador, amortizaciones)
  seguros.js          Pestaña Seguros
  auditoria.js        Pestaña Auditoría trimestral
  categorias.js       Pestaña Categorías y presupuestos
  ajustes.js          Pestaña Ajustes
  auth.js             Inicio de sesión (Supabase Auth)
  copias.js           Copias de seguridad automáticas y restauración
  pwa.js              App instalable, modo sin conexión y avisos
  app.js              Navegación, eventos y arranque (se carga el último)
sql/esquema_completo.sql  Base de datos completa en UN ÚNICO script, ejecutable las veces que quieras
CHANGELOG.md          Qué cambia en cada versión
```

## Acceso (desde la v5)

- Los usuarios se crean en Supabase → **Authentication → Users → Add user → Create new user** (marcando *Auto Confirm User*).
- Desactiva el registro público: Supabase → **Authentication → Sign In / Providers** (o *Settings*) → desactivar **Allow new users to sign up**.
- Para que funcione "¿Olvidaste la contraseña?": Supabase → **Authentication → URL Configuration → Site URL** = la dirección de GitHub Pages de la app.

## Cómo publicar una versión nueva

1. Descarga una copia de tus datos: **⚙️ Ajustes → Descargar copia (.json)**.
2. Si el `CHANGELOG.md` indica cambios de base de datos, ejecuta **entero** `sql/esquema_completo.sql` en Supabase → **SQL Editor → Run**. Solo añade lo que falte, nunca borra datos, y al final muestra una comprobación con ✅/❌.
3. En GitHub: **Add file → Upload files** → arrastra los archivos que hayan cambiado, **respetando sus carpetas** → **Commit changes**.
4. Espera 1-3 minutos (pestaña **Actions** en verde) y recarga la app. Comprueba el número de versión en la cabecera.

## Cómo está pensada para crecer

Cada pestaña es un módulo independiente que se da de alta en unos registros comunes (`estado.js`):

- `Views.<pestaña> = renderX;` → qué función pinta la pestaña.
- `Object.assign(Actions, { 'mi-boton': el => … })` → qué hace cada botón con `data-action="mi-boton"`.
- `Object.assign(Changes, { 'mi-campo': el => … })` → cambios en un campo con ese `id`.

Para añadir una pestaña nueva:
1. Crear `js/nueva.js` con su función de pintado y sus acciones.
2. Añadir su `<section id="tab-nueva">` y su `<script>` en `index.html` (antes de `app.js`).
3. Añadirla a `TABS` en `estado.js` y a una de las 5 secciones de `SECCIONES` (Inicio, Movimientos, Patrimonio, Planificar, Ajustes). En Patrimonio, añade también su recuadro en `patrimonio.js`.
   Colores: usa siempre las variables de `:root` (`var(--card)`, `var(--txt)`…), así funciona sola en modo oscuro.
4. Si necesita guardar datos nuevos, añadir un bloque al final de `sql/esquema_completo.sql` solo con `create table if not exists` o `add column if not exists`.

Reglas de la casa: solo `datos.js` habla con Supabase; `calculos.js` no toca la pantalla; los scripts SQL nunca borran ni modifican datos existentes.
