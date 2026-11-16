# Patrimonio Familiar · v3

App web personal de control de patrimonio y finanzas familiares.
Interfaz en **GitHub Pages**, datos en **Supabase**.

## Estructura

```
index.html            Estructura de la página y carga de módulos (en orden)
css/estilos.css       Todo el diseño
js/
  config.js           Versión de la app y claves de Supabase (vacías: se configuran en Ajustes)
  utilidades.js       Formato €, números, fechas, texto
  estado.js           Estado global (S), constantes y registros de módulos
  datos.js            Única capa que habla con Supabase
  calculos.js         Saldos, patrimonio, préstamos, inmuebles, inversiones, periodos
  ui.js               Toasts, modales, formularios, selects, tarjetas
  graficos.js         Configuración común de Chart.js
  alertas.js          Motor de alertas y consejos del Dashboard
  dashboard.js        Pestaña Dashboard
  cuentas.js          Pestaña Cuentas y movimientos + registro rápido
  importador.js       Importador de extractos de Unicaja
  inversiones.js      Pestaña Inversiones (global + detalle, posiciones, aportaciones periódicas)
  inmuebles.js        Pestaña Inmuebles y vehículos
  deudas.js           Pestaña Deudas (vista general + detalle, simulador, amortizaciones)
  seguros.js          Pestaña Seguros
  auditoria.js        Pestaña Auditoría trimestral
  categorias.js       Pestaña Categorías y presupuestos
  ajustes.js          Pestaña Ajustes
  app.js              Navegación, eventos y arranque (se carga el último)
sql/                  Scripts de base de datos, numerados en el orden en que se ejecutan
CHANGELOG.md          Qué cambia en cada versión
```

## Cómo publicar una versión nueva

1. Descarga una copia de tus datos: **⚙️ Ajustes → Descargar copia (.json)**.
2. Si la versión trae un script SQL nuevo (lo indica el `CHANGELOG.md`), ejecútalo en Supabase → **SQL Editor → Run**. Los scripts solo añaden cosas, nunca borran datos.
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
3. Añadirla a `TABS` en `estado.js`.
4. Si necesita guardar datos nuevos, crear `sql/0X_migracion_....sql` solo con `create table if not exists` o `add column if not exists`.

Reglas de la casa: solo `datos.js` habla con Supabase; `calculos.js` no toca la pantalla; los scripts SQL nunca borran ni modifican datos existentes.
