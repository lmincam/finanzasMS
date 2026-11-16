# Historial de versiones

## 5.3.1 — 16/11/2026 · Corrección
- Al abrir un formulario, el cursor ya no salta al primer campo si has empezado a escribir en otro (podía hacer que lo tecleado acabara en el campo equivocado). Ajuste visual en el recuadro de supuestos de la proyección.

## 5.3.0 — 16/11/2026 · Fase 4: proyección, libertad financiera, TIR e inflación
- Nueva pestaña **🚀 Proyección y libertad financiera**: patrimonio neto proyectado a N años en tres escenarios (prudente/medio/optimista), con aportación creciente, cuota de los préstamos reinvertida al terminar, revalorización de la vivienda, depreciación de vehículos y calendario real de las deudas. Vista **en euros de hoy** (descontada la inflación) o nominal. Hitos previstos y tabla cada 5 años.
- **Independencia financiera**: capital necesario según tu gasto y la tasa de retiro, progreso, años y edad estimados por escenario, efecto de la pensión pública y qué la acelera (aportar más, rentar más, gastar menos).
- **Rentabilidad real (TIR/XIRR)** de cada cuenta de inversión y de toda la cartera, nominal y descontada la inflación, teniendo en cuenta cuándo aportaste cada euro.
- Supuestos editables (rentabilidades, inflación, revalorización, tasa de retiro, año de nacimiento, pensión). Sin cambios de SQL.

## 5.2.0 — 16/11/2026 · Fase 3: previsión de tesorería y metas
- Nueva pestaña **🎯 Previsión y metas**.
- **Previsión de tesorería** a 3, 6 o 12 meses del dinero en cuentas operativas: detecta los ingresos y recibos recurrentes de tu historial (nómina, luz, suscripciones, colegio…) y los combina con cuotas de préstamos, recibos de seguros, aportaciones periódicas, plan de amortizaciones, gasto variable estimado y aportación a metas. Gráfico, detalle por mes, próximos 30 días y aviso de meses en los que la cuenta se queda corta.
- **Partidas previstas** manuales (pagas extra, IBI, matrícula…) y posibilidad de descartar recurrentes detectados.
- **Metas de ahorro** como hucha virtual o vinculadas a una cuenta: progreso, aportación mensual necesaria, ritmo real, fecha estimada y estado. Botón para crear la meta del fondo de emergencia con el importe calculado.
- Alertas nuevas en el Dashboard: meses con saldo previsto bajo o negativo, metas retrasadas o conseguidas, metas que piden más de lo que ahorras.
- SQL: ejecutar de nuevo `sql/esquema_completo.sql` (bloque 7).

## 5.1.0 — 16/11/2026 · Fase 2: números exactos
- **Conciliación con el saldo del banco**: el importador lee la columna Saldo del Excel y comprueba que el saldo calculado coincide con el del banco tras el último movimiento. Si no cuadra, lo avisa con la diferencia y permite fijar el saldo del banco como punto de control. Cada cuenta muestra si cuadra.
- **Cuotas de préstamos separadas en intereses y capital**: los intereses cuentan como gasto operativo y el capital como ahorro (reduce deuda). Categoría de la cuota configurable en cada préstamo (por defecto "Hipoteca"). Nueva subcategoría "Amortización anticipada" que cuenta entera como ahorro. Desglose de la cuota del mes en el detalle del préstamo.
- **Evolución mensual automática del patrimonio**: se guarda una foto cada mes al abrir la app; gráfico, tabla y variación vs. mes anterior en el Dashboard y en Auditoría.
- SQL: ejecutar de nuevo `sql/esquema_completo.sql` (bloque 6).

## 5.0.0 — 16/11/2026 · Fase 1: seguridad y copias de seguridad
- **Acceso con email y contraseña** (Supabase Auth) para los usuarios que crees en Supabase. Sesión recordada en cada dispositivo, recuperación de contraseña por email, cambio de contraseña y cierre de sesión en ⚙️ Ajustes.
- **Base de datos cerrada al acceso anónimo**: solo los usuarios con sesión pueden leer o escribir.
- **Copias de seguridad automáticas semanales** en un espacio privado de Supabase (se guardan las 12 últimas), copia manual en la nube o descargada, y **restauración** desde la nube o desde archivo (modo fusionar, con copia previa automática). Acepta copias de versiones anteriores.
- Nuevos módulos: `js/auth.js`, `js/copias.js`.
- SQL: ejecutar de nuevo `sql/esquema_completo.sql` (bloque 5: seguridad y espacio de copias).

## 4.2.0 — 16/11/2026 · Menú de secciones en el móvil
- En pantallas estrechas las pestañas se sustituyen por una barra con la sección actual y un menú lateral (☰) con todas las secciones y un acceso a "Registrar movimiento".
- Se cierra al elegir sección, al tocar fuera o con Escape. En el ordenador se mantienen las pestañas.
- Archivos: `index.html`, `css/estilos.css`, `js/app.js`, `js/config.js`, `js/cuentas.js`.
- SQL unificado: los 4 scripts anteriores pasan a ser **`sql/esquema_completo.sql`**, ejecutable siempre (crea lo que falte y nunca borra datos). Termina con una tabla de comprobación ✅/❌.

## 4.1.0 — 16/11/2026 · Categorización automática que aprende
- Motor de reglas "si el concepto contiene X → categoría Y" (nuevo módulo `js/reglas.js`).
- Al importar el Excel, la app categoriza sola con: tus reglas → conceptos ya categorizados → transferencias internas → nómina → ~200 reglas predefinidas de comercios españoles.
- Lo que no sabe te lo pregunta agrupado por comercio, con palabra clave propuesta; puedes crear categorías nuevas desde ahí mismo.
- Lo que categorizas o corriges se guarda como regla (aprendida) y la próxima importación ya lo hace sola. Indicador "% categorizado automáticamente".
- Gestión de reglas en 🏷️ Categorías (buscar, editar, desactivar) y botón para aplicar las reglas a movimientos antiguos sin categoría.
- SQL: `sql/04_migracion_reglas.sql` (tabla de reglas + subcategoría "Comida a domicilio").

## 4.0.0 — 16/11/2026 · Seguros, préstamos en detalle, cartera por producto y m²
- **Nueva pestaña 🛡️ Seguros**: pólizas de vehículos, hogar, salud, vida, mascota, decesos… con prima, recibos, vencimientos, renovación, coberturas y vínculo a vehículos/inmuebles. Alertas de vencimiento en el Dashboard.
- **🏦 Deudas**: vista general + detalle de cada préstamo con cuadro de amortización mensual/anual, simulador exacto (sin amortizar / reducir plazo / reducir cuota / invertir), comisión, amortizaciones realizadas con ahorro previsto y ya conseguido, y plan de amortizaciones periódicas.
- **📈 Inversiones**: visión global + detalle por cuenta; productos por ISIN (con validación) y % o €; gráfico Asset Location por cuenta y global, por clase de activo y por región; aportaciones periódicas automáticas (con control de duplicados en el importador).
- **🏠 Inmuebles**: m², €/m² de venta y alquiler de la zona, ajuste propio y anejos; cálculo automático de precio de venta y alquiler; histórico trimestral del €/m².
- Paginación estable al cargar más de 1.000 movimientos.
- SQL: `sql/03_migracion_v4.sql` (solo añade tablas y columnas).

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
