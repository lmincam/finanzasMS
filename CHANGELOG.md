# Historial de versiones

## 3.0.0 — 16/11/2026 · Reorganización en módulos
- El código pasa de un único `index.html` a `index.html` + `css/` + `js/` (18 módulos).
- Sin cambios funcionales ni de datos: misma base de datos, mismas pantallas, mismos cálculos.
- Número de versión visible en la cabecera y en ⚙️ Ajustes.
- Los archivos se cargan con `?v=3.0.0` para que el navegador no use copias antiguas al actualizar.
- SQL: no requiere ningún script nuevo.

## 2.0.0 — 16/11/2026 · Inversiones y alertas
- Nueva pestaña 📈 Inversiones (cartera, valoraciones, aportaciones, evolución).
- Alertas y consejos en el Dashboard (presupuestos, gastos extraordinarios, fondo de emergencia, ahorro, hipoteca…).
- SQL: `sql/02_migracion_v2_inversiones.sql` (añade la tabla `valoraciones`).

## 1.0.0 — 16/11/2026 · Primera versión
- Dashboard, cuentas y movimientos, importador de Unicaja, inmuebles y vehículos, deudas, auditoría trimestral, categorías.
- SQL: `sql/01_esquema_inicial.sql`.
