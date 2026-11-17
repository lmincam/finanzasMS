# Historial de versiones

## 5.11.0 — 17/11/2026 · Seguridad: solo vuestros usuarios
- Nueva lista **usuarios_permitidos**. Todas las tablas y las copias de seguridad solo se pueden leer o modificar con un email de esa lista, aunque alguien consiga crearse una cuenta en el proyecto de Supabase. La primera vez se rellena sola con los usuarios que ya existen.
- Si entra una cuenta que no está en la lista, la app no carga nada, cierra la sesión y lo explica.
- ⚙️ Ajustes → **Usuarios con acceso**: ver, añadir y quitar emails.
- La comprobación final del SQL muestra quién tiene acceso y avisa si queda alguna tabla abierta.
- Requiere ejecutar `sql/esquema_completo.sql` (bloque 0) y se recomienda desactivar "Allow new users to sign up" en Supabase.

## 5.10.2 — 17/11/2026 · Tasa de ahorro real y capital de la hipoteca exacto
- **Tasa de ahorro**: ahora es lo que pasas de verdad a cuentas de ahorro (neto) ÷ ingresos, no lo que sobra en la cuenta. Lo que va a la cuenta de anualidades se muestra aparte y no cuenta como ahorro.
- **Capital pendiente de los préstamos**: se calcula cuota a cuota desde el último dato del banco, con el importe y la fecha reales de cada cuota registrada. El capital amortizado del Dashboard y el pendiente salen de la misma cuenta.
- **Base de cálculo de intereses** (mensual fija, días/360 o días/365). Al copiar el capital pendiente de un recibo con "Comparar con el banco", la app mide su desfase y elige la base que lo hace cuadrar, para no tener que reajustar cada poco.
- Nueva tabla "🧾 Cuotas desde el último dato del banco" en el detalle del préstamo: intereses, capital y pendiente de cada cuota, real o estimada.
- Requiere ejecutar `sql/esquema_completo.sql` (bloque 11: `deudas.base_interes`).

## 5.10.1 — 17/11/2026 · Balance mensual
- "Capacidad de ahorro" pasa a llamarse **Balance mensual** y ocupa una tarjeta doble bajo Ingresos y Gastos, con la cuenta desglosada (ingresos − gastos operativos − capital de deuda). Verde si es positivo, rojo si es negativo.
- Debajo, **Tasa de ahorro** (nueva tarjeta, con el mismo diseño que la de inversión) y **Tasa de inversión**. Liquidez y patrimonio van a la derecha en el ordenador, y debajo en el móvil.

## 5.10.0 — 17/11/2026 · Mes de nómina
- Cada "mes" va del día en que cobras la nómina al día antes del siguiente cobro (p. ej. noviembre = 27 oct → 26 nov). Los gastos de después de cobrar cuentan en el mes de esa nómina, así que ingresos y gastos se comparan sobre el mismo tramo y la capacidad de ahorro cuadra.
- El inicio de cada mes se detecta con la fecha real de la nómina. Mientras no llega la siguiente, el fin se estima con tu día habitual de cobro, y si la nómina se retrasa, el mes sigue abierto hasta que entre.
- Se aplica en toda la app: Dashboard, presupuestos, avisos (el ritmo de gasto usa los días del mes de nómina), calendario (muestra del día de cobro al día anterior al siguiente), detalle, año en curso, anualidades, metas y proyecciones.
- Los movimientos que imputaste a mano a otro mes siguen donde los pusiste. Las devoluciones de gastos compartidos van al mes del gasto que devuelven.
- Se puede desactivar en ⚙️ Ajustes → Regla de nómina para volver a meses naturales.

## 5.9.1 — 17/11/2026 · Diseño del Dashboard
- Indicadores con fondo suave de su color: ingresos en verde, gastos en rojo, ahorro e inversión en amarillo, y liquidez y patrimonio en azul claro. Liquidez disponible va ahora antes que patrimonio neto.
- Selector de periodo rediseñado: modos arriba (en el móvil, en dos filas de tres), debajo ‹ mes › con el mes escrito como botón que abre el selector, y 📅 Calendario siempre en el mismo sitio. En "Mes" ya no se repite el nombre del mes; en el resto de modos se indica el rango.

## 5.9.0 — 17/11/2026 · Dashboard: ahorro líquido, detalle y año en curso
- **Capacidad de ahorro líquida**: ingresos − todo lo que sale en gastos, con la cuota del préstamo completa. El capital amortizado ya no se suma (no es dinero disponible: es vivienda); se muestra aparte. Gastos operativos sigue sin incluir ese capital. Las alertas de tasa de ahorro y la línea "Ahorro líquido" del gráfico usan el mismo criterio.
- **Ingresos y Gastos operativos se pueden pulsar**: abren el detalle del periodo con el resumen por categoría (cargos, devoluciones de Bizum y capital desglosados) y la lista de movimientos, que se pueden abrir para corregir.
- **Año en curso** (debajo de los indicadores, sea cual sea el periodo): ingresos de enero a hoy y aumento de patrimonio del año, con su desglose en ahorro líquido, capital amortizado y revalorización. El patrimonio a 1 de enero sale de la foto de diciembre o del Q4, o lo indicas tú con ✎.
- Capacidad de ahorro y tasa de inversión en amarillo.

## 5.8.0 — 17/11/2026 · Anualidades, gastos fijos y explicaciones
- **Presupuesto anual o mensual** por categoría (🏷️ Categorías). Un pago anual (seguro de 600 €) se reparte solo: 50 €/mes. Las anualidades se comparan con lo gastado en el año, no con el mes del cargo, y no saltan como gasto extraordinario.
- **Tarjeta 🗓️ Anualidades** en Cuentas: cuánto pasar cada mes a la cuenta de anualidades (suma de 1/12 de cada pago anual), lo que llevas pasado este mes, el saldo apartado, el último y el próximo cargo de cada pago, y aviso si el saldo no alcanza para lo que vence en 3 meses. La cuenta se elige en la tarjeta (por defecto, la que se llama "Anualidades") y su saldo ya no cuenta como fondo de emergencia.
- **Gasto fijo** por categoría: automático, sí o no. Los fijos van aparte y plegados en el Dashboard y no avisan por estar al 100 %.
- **Presupuesto vs. gastado real** con orden: más cerca del límite (por defecto), mayor gasto o por categorías. Grupos: variables, anualidades y fijos. En el móvil se ve en tarjetas, sin desplazamiento lateral.
- **ⓘ en cada indicador del Dashboard**: qué es, cómo se calcula y la cuenta hecha con tus números (p. ej., la capacidad de ahorro y a dónde ha ido ese dinero).
- Requiere ejecutar `sql/esquema_completo.sql` (bloque 10: `categorias.presupuesto_anual` y `gasto_fijo`).

## 5.7.4 — 16/11/2026 · iPhone (app instalada): título nítido
- En la app instalada, el contenido de la cabecera baja un poco para quedar fuera del difuminado que iOS 26 aplica bajo la barra de estado. En el navegador y en el ordenador no cambia nada.

## 5.7.3 — 16/11/2026 · iPhone (app instalada): franja superior sin neblina
- El fondo de la página pasa a ser el azul de la cabecera y el gris claro va en una capa fija detrás del contenido. iOS 26 difumina la zona de la isla con el color de fondo de la página: ahora ese color es el mismo azul, así que no se nota.

## 5.7.2 — 16/11/2026 · iPhone: franja superior sin neblina
- La cabecera pasa a ser fija (antes "sticky"). Safari en iOS 26 solo toma el color de la zona de la isla de un elemento fijo pegado arriba; si no lo encuentra, pinta una sombra difuminada con el fondo claro de la página.

## 5.7.1 — 16/11/2026 · Nombre e iPhone
- La app pasa a llamarse **Patrimonio Miñán Sánchez** (cabecera, menú, acceso, pestaña del navegador y app instalada).
- iPhone: la franja de la isla dinámica ya no se ve borrosa. La cabecera fija tiene fondo sólido y el rebote al tirar hacia abajo toma el mismo azul.

## 5.7.0 — 16/11/2026 · Calendario de gastos
- Botón **📅 Calendario** en el Dashboard: muestra el mes o periodo seleccionado con cada gasto en su día (por fecha de operación) y el total diario. Los días se colorean según cuánto se gastó.
- Total y media diaria de cada mes, y día de más gasto del periodo. Pulsando un gasto se abre para verlo o corregirlo. Flechas ‹ › para cambiar de mes sin salir.
- En el móvil se ve como una lista de los días con gastos.
- No incluye transferencias internas ni amortizaciones de deuda; las devoluciones de gastos compartidos restan del día.

## 5.6.0 — 16/11/2026 · Avisos útiles, no avisos por avisar
- **Gastos fijos** (cuota de un préstamo, o importe casi idéntico cada mes: hipoteca, alquiler, gimnasio…): ya no avisan por estar al 100 % del presupuesto. Solo avisan si el cargo sube por encima de lo presupuestado.
- Eliminado el aviso "cerca del límite". En gastos variables queda: presupuesto superado, o "a este ritmo te pasarás" con lo que puedes gastar al día los días que quedan. La proyección ya no extrapola los cargos fijos.
- "Gastas más que tu media" compara solo el gasto variable, y no se repite si esa categoría ya tiene aviso de presupuesto o un gasto extraordinario.
- Gastos extraordinarios: no cuentan las amortizaciones de deuda, los cargos anuales que ya se repitieron hace un año por un importe parecido (IBI, seguros…) ni los gastos sin categoría (ya tienen su propio aviso).
- Tasa de ahorro y destino del ahorro: solo con meses cerrados (con el mes a medias no tienen sentido). Dinero ocioso: también se mira el saldo a fin del mes pasado, no solo justo después de cobrar.
- Quitadas las felicitaciones fijas (fondo completo, buena tasa de inversión…).
- Cada aviso tiene ✕ para ocultarlo un tiempo (30 días; 90-180 en los consejos generales). Vuelve si la situación sigue igual. Se comparte con tu pareja.

## 5.5.3 — 16/11/2026 · Corrección definitiva del saldo tras conciliar
- Al conciliar una cuenta (o fijar el saldo del banco al importar), el saldo se guarda como el del día anterior, descontando los movimientos ya apuntados ese día. Así cuentan todos los movimientos de ese día, los apuntados antes y después, sin depender de la hora del móvil ni del SQL nuevo.
- Lectura de fechas de Supabase compatible con Safari (iPhone).

## 5.5.2 — 16/11/2026 · Corrección: gastos del mismo día que una conciliación
- Si fijabas el saldo de una cuenta (conciliar, editar el saldo de partida o fijar el del banco al importar) y después apuntabas un movimiento con esa misma fecha, el movimiento no se sumaba ni restaba. Ahora la app guarda el momento exacto en que fijas el saldo y cuenta los movimientos de ese día apuntados después. Lo mismo para la valoración de mercado de las inversiones.
- Requiere ejecutar `sql/esquema_completo.sql` (bloque 9: columnas `cuentas.saldo_actualizado` y `valor_actualizado`). Sin él la app funciona como antes.

## 5.5.1 — 16/11/2026 · Bizum enviados
- Los Bizum enviados siguen siendo gastos que categorizas tú. Por defecto no se recuerdan, pero si marcas "Recordar" sí se crea la regla (antes la casilla no tenía efecto).
- Para los Bizum la palabra clave propuesta es el nombre completo (p. ej. "maria ruiz limpieza") y no solo el primer nombre.

## 5.5.0 — 16/11/2026 · Gastos compartidos y Bizum
- **Gastos compartidos** (👥 en un gasto): indicas entre cuántas personas se reparte o cuánto te deben. Tarjeta "Te deben" en Cuentas, con lo cobrado y lo pendiente, y opción de darlo por saldado.
- **Reembolsos**: un Bizum o transferencia recibida se puede vincular al gasto que te devuelven (↩). Resta de la categoría de ese gasto y en su mes, y no cuenta como ingreso.
- **Importador**: los Bizum recibidos van a una tarjeta propia. Se proponen solos como reembolso cuando su importe coincide con la parte de una o varias personas de un gasto compartido; si no, te pregunta (reembolso de un gasto, también de uno del mismo Excel, o ingreso).
- **Los Bizum nunca generan reglas** ni se aprenden por el nombre de la persona.
- La previsión de tesorería ignora las devoluciones al detectar recurrentes. Alerta en el Dashboard de lo que te deben desde hace más de 10 días.
- Nuevo módulo `js/compartidos.js`. SQL: ejecutar de nuevo `sql/esquema_completo.sql` (bloque 8).

## 5.4.0 — 16/11/2026 · App instalable, sin conexión y avisos
- **App instalable (PWA)**: icono propio, se abre a pantalla completa y arranca al instante (`manifest.json`, `sw.js`, carpeta `icons/`).
- **Sin cobertura**: abre con los últimos datos guardados en el dispositivo, en modo solo lectura y con una barra que lo indica. La copia local se borra al cerrar sesión.
- **Avisos al abrir la app** con las alertas importantes (máximo 3 al día, sin repetir el mismo en una semana). Se activan por dispositivo en ⚙️ Ajustes → App en el móvil.
- Las versiones nuevas se aplican solas al abrir la app.
- Nuevo módulo `js/pwa.js`. Sin cambios de SQL.

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
