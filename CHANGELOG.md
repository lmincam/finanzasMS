# Historial de versiones

## 5.30.1 — 26/11/2026 · Cada cuota con su interés y capital reales
- Hipoteca: se ajusta una sola vez a los recibos de Unicaja (TIN 1,90 %, días reales/365, pendiente 112.808,32 € a 01/11/2026).
- Las cuotas anteriores al dato del banco ya no se estiman con una media: se reconstruyen hacia atrás desde ese pendiente con la regla del banco, así cada cargo tiene su interés y su capital exactos (validado con 15 recibos reales, diferencia ≤ 1 céntimo). Esto corrige el «capital amortizado» de Inicio y Patrimonio.

## 5.30.0 — 26/11/2026 · Intereses calculados como el banco
- Préstamos con «Días reales / 360» (o /365): los intereses de cada recibo se calculan con los días entre vencimientos (p. ej. del 1 al 1), no entre fechas de cargo, y se redondean al céntimo cada mes, igual que el banco. Validado céntimo a céntimo con 15 recibos reales de Unicaja (TIN 1,875 %).
- La previsión de cuotas futuras y el tramo teórico de la tabla usan el mismo método.

## 5.29.2 — 26/11/2026 · Mes en curso en la tabla de amortización
- La tabla ya no se salta el mes actual cuando su cargo aún no está registrado: aparece como «por cobrar» y se puede comparar con el banco.

## 5.29.1 — 26/11/2026 · Menos ruido en Deudas
- Quitada la tarjeta «Cuotas desde el último dato del banco» (lo cubre la tabla de amortización). Se mantienen los avisos de cuadre; el botón para actualizar el pendiente pasa a la tabla.

## 5.29.0 — 26/11/2026 · Tabla de amortización mes a mes
- Deudas: en el detalle de cada préstamo, tabla francesa completa por años (nº de cuota, mes, día de cobro, cuota, intereses, capital, pendiente) desde la primera cuota hasta la última.
- Columna «Banco»: apuntas el capital del recibo y la app marca ✓ si coincide o la diferencia; se guarda por préstamo y la cabecera cuenta cuántos meses cuadran.

## 5.28.9 — 26/11/2026 · TIN a la vista
- Deudas: cada préstamo muestra su TIN y cómo se calculan sus intereses en la tarjeta («sin TIN ⚠» si falta), y en el detalle junto al nombre.

## 5.28.8 — 26/11/2026 · De dónde sale el capital amortizado
- Detalle de gastos: nueva tabla cuota a cuota con el préstamo, la cuota, los intereses y el capital que calcula la app y cómo lo calcula (TIN, base, dato del banco), para compararla con los recibos.
- Préstamos: aviso si no tienen TIN (la app contaba toda la cuota como capital).

## 5.28.7 — 26/11/2026 · Ajuste fino
- Inicio móvil: Liquidez y Patrimonio suben unos píxeles para no quedar pegados a la barra inferior.

## 5.28.6 — 26/11/2026 · Barra de patrimonio interactiva
- Patrimonio: al tocar un tramo de la barra (o su nombre en la leyenda) se resalta y aparece su % con un decimal y su importe sobre lo que tenéis; al volver a tocarlo se quita.

## 5.28.5 — 26/11/2026 · Inicio móvil a medida
- Móvil: se devuelve el relleno de las tarjetas (unos 26 px) para que Liquidez y Patrimonio queden justo encima de la barra inferior, sin hueco.

## 5.28.4 — 26/11/2026 · Inicio móvil: ajuste mínimo
- Se deshace la compactación fuerte de la 5.28.3: vuelven los tamaños de antes y solo se recorta un poco el relleno y la separación (unos 40 px en total). Vuelve la leyenda de la barra de gastos.
- Corregido: la flecha › de la tarjeta de gastos ya no se monta sobre la barra.

## 5.28.3 — 26/11/2026 · Inicio compacto en el móvil
- Móvil: Inicio más compacto (aviso de cierre, periodo y tarjetas con menos relleno y cifras algo más pequeñas) para que en un iPhone 16 Pro Max se vea hasta Liquidez y Patrimonio sin desplazarse.

## 5.28.2 — 26/11/2026 · Balance más compacto
- Inicio › Balance: la cuenta (Ingresos − Gastos) queda pegada a la cifra, sin el hueco de antes.

## 5.28.1 — 26/11/2026 · Inicio: periodo, gastos y balance
- Selector de periodo rediseñado: una sola tarjeta con el mes (‹ ›), su rango y el calendario arriba, y los periodos como pastillas (Mes · 2 · 3 · 6 meses · Año · Rango); en el móvil caben todas en una fila.
- Gastos en una sola tarjeta: en grande lo que ha salido de las cuentas y debajo el gasto sin capital amortizado, con una barra que separa gasto y capital.
- Ingresos muestra de dónde vienen (principales categorías).
- Balance vuelve a ocupar el doble, con la cuenta Ingresos − Gastos = Balance.

## 5.28.0 — 26/11/2026 · Revisión completa
- Nuevo: Ajustes › **Revisar mis datos**. Repasa tus datos reales y avisa de duplicados, transferencias sin pareja o descuadradas, devoluciones huérfanas o mayores que el gasto, gastos en positivo sin vincular, ingresos negativos, movimientos de cuentas o categorías borradas, sin categoría, con fecha futura, imputados a meses lejanos o que no suman al saldo, cuentas del día a día en negativo y préstamos que no cuadran. Cada aviso lleva al movimiento o préstamo.
- Corregido: la garantía de las pertenencias salía un día antes (desfase horario de España).
- Corregido: Inicio, el cierre de mes y las explicaciones ya no muestran un último día del mes de nómina inventado mientras no llega la siguiente nómina («27/10 – próxima nómina»).
- Revisado sin errores: todas las pestañas en ordenador y móvil, claro y oscuro (sin errores, sin NaN, sin desbordes) y las cuentas cruzadas (gastos = operativos + capital, presupuesto = gastos, gastos + ahorro = ingresos, patrimonio = activos − deudas).

## 5.27.5 — 26/11/2026 · Préstamos: capital pendiente que cuadra con Inicio
- Las amortizaciones anticipadas registradas después del último dato del banco ya bajan el capital pendiente (antes solo lo hacían si al registrarlas se marcaba «actualizar el préstamo»), y aparecen en la tabla de cuotas.
- Si dos préstamos comparten la categoría de la cuota, cada cargo se asigna al de cuota más parecida (antes los dos contaban el mismo cargo y el pendiente bajaba el doble).
- Cada préstamo avisa de lo que puede descuadrar Inicio y el pendiente: cuota sin categoría vinculada, cuotas sin cargo registrado («estimadas»), cargos mayores que la cuota en esa categoría, categoría compartida y amortizaciones pagadas sin registrar. En la lista, «⚠ revisar».

## 5.27.4 — 26/11/2026 · Barra de abajo fija en el iPhone
- Móvil: la barra de navegación inferior ya no se desplaza al llegar al final de la página (se desactiva el rebote de iOS y la barra va en su propia capa).

## 5.27.3 — 26/11/2026 · Seguros al mes
- Seguros: cada póliza muestra en grande lo que equivale al mes; bajo el coste anual total sale el total al mes, y cada grupo por tipo indica €/mes y €/año.

## 5.27.2 — 26/11/2026 · Mayores gastos netos de devoluciones
- Inicio › Mayores gastos: se ordenan por lo que de verdad habéis pagado, restando las devoluciones vinculadas (Bizum) y lo pendiente de cobrar. Debajo del importe se ve cuánto pagaste y cuánto te devolvieron. Las devoluciones ya no aparecen en la lista.

## 5.27.1 — 26/11/2026 · Fechas por día, mes y año
- Todos los formularios (y el registro rápido) eligen la fecha con tres desplegables independientes: día, mes y año (de 1940 a 40 años vista), más un botón «Hoy». Si eliges un día que no existe en ese mes (31 de febrero), se ajusta solo al último día.

## 5.27.0 — 26/11/2026 · Formulario de seguros según el tipo
- Seguros: al elegir el tipo, el formulario solo muestra lo que tiene sentido. Vehículo: vehículo asegurado, valor del vehículo y franquicia. Hogar: vivienda, continente, contenido y franquicia. Salud, vida, mascota, decesos, accidentes, viaje y RC: sus propios campos y textos de ayuda. Al guardar, lo que no corresponde al tipo se vacía.

## 5.26.9 — 26/11/2026 · Pertenencias en «Lo que tenéis»
- Patrimonio: el recuadro de Pertenencias pasa de «Seguimiento» a «Lo que tenéis», junto a liquidez, inversiones, inmuebles y vehículos, con la venta estimada y el coste de reponerlo todo. Sigue sin sumar al patrimonio neto.

## 5.26.8 — 26/11/2026 · Movimientos que no sumaban al saldo
- Un movimiento apuntado a mano después de conciliar una cuenta, pero con fecha anterior a la conciliación, no suma al saldo (se entiende que el saldo real ya lo incluía). Ahora se ve: la fila lleva «no suma al saldo» y, al abrir la cuenta, un aviso con la lista y el botón «Que cuenten en el saldo» para corregirlo en un toque.

## 5.26.7 — 26/11/2026 · Gastos totales y sin capital, cada uno en su tarjeta
- Inicio: fila de cuatro tarjetas iguales: Ingresos · Gastos (todo lo salido de cuenta) · Gastos sin capital · Balance (más compacto, con ingresos − gastos debajo).
- Detalle de gastos/ingresos: cada categoría ocupa una fila de la misma altura (nombre y, debajo, nº de movimientos y devoluciones o capital), con las barras alineadas y separadores finos.

## 5.26.6 — 26/11/2026 · Gastos con y sin capital
- Inicio: la tarjeta de gastos muestra los gastos operativos (grande) y, debajo, el total salido de cuenta con el capital amortizado que incluye.
- Detalle de gastos/ingresos: las barras por categoría quedan alineadas (columnas de ancho fijo).

## 5.26.5 — 26/11/2026 · Actualizar cartera
- Inversiones: botón «⟳ Actualizar cartera» que lanza en el momento la tarea «Precios diarios» de GitHub, espera a que termine (1-2 min) y recarga los datos. La primera vez pide un token de GitHub (solo permiso de Actions sobre finanzasMS) que se guarda únicamente en ese dispositivo.

## 5.26.4 — 26/11/2026 · Ver los movimientos de cada partida del presupuesto
- Inicio › Presupuesto vs. gastado real: al pulsar una partida se abren todos sus movimientos del periodo (o del año, si es anual), con lo gastado, lo devuelto por Bizum, lo pendiente de cobrar y el total que cuenta en el presupuesto, que cuadra con la fila.

## 5.26.3 — 26/11/2026 · Presupuesto con los Bizum por cobrar
- Inicio › Presupuesto vs. gastado real: lo que te deben de un gasto compartido (Bizum pendiente) ya no cuenta como gastado; debajo de lo gastado aparece «↩ X € por cobrar». Las devoluciones ya cobradas y vinculadas al gasto seguían descontándose.

## 5.26.2 — 26/11/2026 · Último movimiento cargado
- Movimientos: antes de la lista, dos recuadros con la fecha del último movimiento de la cuenta principal y del efectivo (hace cuántos días, concepto e importe), para saber desde qué día retomar la carga. Si pasa de una semana, se resalta en ámbar. Al pulsarlo, se filtra la lista por esa cuenta.

## 5.26.1 — 20/11/2026 · Notas sin IA
- Notas sin resumen por IA: cada tarjeta muestra el principio del texto. Se quita la tarea «Resumen de notas» y las columnas de resumen del bloque 16.

## 5.26.0 — 20/11/2026 · Notas con resumen por IA
- Nueva pestaña Planificar › Notas: notas de texto libre (título opcional), de la más nueva a la más antigua, con buscador, autor y fecha. Al pulsar una se lee entera y se puede editar o eliminar.
- Cada nota lleva un resumen breve hecho por IA. Lo genera la tarea de GitHub «Resumen de notas» (cada 10 minutos, `scripts/notas.mjs`); si cambias el texto, se vuelve a resumir. Mientras llega se ve el principio de la nota.
- **Base de datos:** ejecutar `sql/esquema_completo.sql` (bloque 16, tabla `notas`).
- **GitHub:** añadir el secreto `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions). Sin él, las notas funcionan pero sin resumen.

## 5.25.2 — 19/11/2026 · + centrado dentro del círculo
- Ordenador: el símbolo + queda exactamente en el centro del círculo verde (heredaba el relleno de las pestañas).

## 5.25.1 — 19/11/2026 · + centrado
- Ordenador: el botón + queda exactamente en el centro de la barra de secciones.

## 5.25.0 — 19/11/2026 · Foto de perfil y barra del ordenador como la del móvil
- Ordenador: Ajustes sale de la barra y se abre desde el círculo del usuario; el botón verde + para añadir movimientos va en medio de la barra (desaparece «+ Añadir» de la cabecera).
- Foto de perfil: en Ajustes › Tu cuenta, cada usuario puede subir su foto (se recorta en cuadrado y se reduce); aparece en el círculo de arriba en todos sus dispositivos. También se puede quitar.

## 5.24.4 — 19/11/2026 · Cuentas con el logo de su banco
- Cada cuenta muestra el logo de su entidad (Unicaja, MyInvestor, Trade Republic y los bancos habituales), deducido del campo «Entidad» o, si está vacío, del nombre de la cuenta. El efectivo lleva una hucha rosa.
- Tarjetas rediseñadas: logo a la izquierda, nombre y entidad al lado y el saldo grande debajo.

## 5.24.3 — 19/11/2026 · Orden con una flecha
- Movimientos: el orden por fecha se cambia con un botón de flecha (↓ más recientes primero, ↑ más antiguos primero), a la izquierda de «Regla de nómina».

## 5.24.2 — 19/11/2026 · Mes de nómina sin adivinar el día de cobro
- El mes de nómina en curso no tiene fecha de fin hasta que llega la siguiente nómina: todo lo anterior a ese cobro cuenta en el mes («desde el 29/10»). Los meses ya cerrados muestran su rango real.
- El periodo aparece debajo del nombre del mes, sin juntarse.
- Movimientos vuelve a ordenarse de más reciente a más antiguo (la nómina queda abajo), con un botón para invertir el orden que se recuerda.

## 5.24.1 — 19/11/2026 · Movimientos por mes de nómina
- Movimientos muestra el mes de nómina elegido completo: desde el día en que entra la nómina hasta el día antes de la siguiente (por ejemplo, del 27/10 al 26/11), con las fechas bajo el nombre del mes.
- Con un mes elegido, el orden es cronológico: primero la nómina y después los gastos. Con «Todos los meses», lo más reciente primero.
- Al abrir la app, Movimientos arranca en el mes de nómina en curso.

## 5.24.0 — 19/11/2026 · ¿Dónde va vuestro dinero?
- Inicio: la tarjeta del gráfico circular muestra el 100 % de lo ingresado en el periodo. A la izquierda, los gastos por categoría; a la derecha, lo aportado a cada cuenta de ahorro e inversión, lo apartado para anualidades y lo que queda en cuenta.
- Debajo de cada gráfico, su lista con el % de los ingresos: a la izquierda con el % delante; a la derecha con el % al final.

## 5.23.9 — 19/11/2026 · Gastos en % de los ingresos
- Inicio: el gráfico circular de gastos indica junto a cada categoría qué % de los ingresos del periodo elegido se ha llevado.

## 5.23.8 — 19/11/2026 · Barra «Patrimonio › Apartado» en su sitio
- Corregido: en los apartados de Patrimonio la barra para volver quedaba encima del contenido y tapaba el título (efecto secundario del bloqueo de desplazamiento lateral de la 5.23.7).
- Pertenencias: el aviso del seguro de hogar se lee de corrido.

## 5.23.7 — 19/11/2026 · Pertenencias y formularios
- Pertenencias: la garantía ya no aparece en cada fila; se ve al abrir la pertenencia.
- Ningún formulario ni ventana se puede desplazar de lado en el móvil.

## 5.23.6 — 19/11/2026 · Presupuestos primero
- Presupuestos es la primera pestaña de Planificar, por delante de Previsión y metas.
- En las subcategorías el importe va junto al lápiz, sin dejar el hueco del +.

## 5.23.5 — 19/11/2026 · Presupuestos en el móvil
- Los botones +, editar y eliminar ya no se montan sobre el importe de la categoría.

## 5.23.4 — 19/11/2026 · Colores de categorías automáticos
- Cada categoría principal tiene su propio color, asignado por la app y sin repetir; sus subcategorías, el mismo color más claro. Los verdes quedan reservados a los ingresos. Ya no se elige el color al editar.
- Presupuestos: botones de editar (lápiz) y eliminar (papelera) a la vista, y + para añadir subcategoría, en lugar del menú ⋯.

## 5.23.3 — 19/11/2026 · Cuentas de un vistazo
- Tarjetas de cuenta con letra más grande y el saldo bien destacado; liquidez total en la cabecera.
- «Cuadra con el banco» y el resumen de anualidades pasan al detalle que se abre al pulsar cada cuenta.

## 5.23.2 — 19/11/2026 · Un solo estilo y cuentas compactas
- Los indicadores de todas las pantallas usan el estilo de Inicio: marca de color arriba y etiqueta en versalitas.
- Movimientos: tarjetas de cuenta más pequeñas y sin botones; al pulsar una cuenta se abre su menú (conciliar saldo, ver sus movimientos, editar, eliminar).

## 5.23.1 — 19/11/2026 · Inicio y Movimientos como antes
- Inicio y Movimientos recuperan el diseño de la 5.22.2 (banner de cierre, tarjetas de cuenta con Conciliar/✎/🗑, regla de nómina en Movimientos, céntimos). El resto de pantallas mantiene la revisión visual de la 5.23.0.

## 5.23.0 — 19/11/2026 · Revisión visual completa
- Sistema visual común: tarjetas de cifras con el mismo borde, sombra y etiquetas en minúscula; importes grandes sin céntimos; cabeceras de tabla alineadas con sus columnas; un solo azul para las acciones principales.
- Escritorio: botón «+ Añadir» en la cabecera (el + flotante queda solo en el móvil). Migas de pan «Patrimonio › Sección» para volver.
- Inicio: aviso de cierre de mes en una línea discreta; balance y variaciones redondeados.
- Movimientos: las transferencias salen una sola vez («A → B»); cada cuenta con menú ⋯ (conciliar, ver movimientos, editar, eliminar) y lo que ha entrado y salido este mes; la regla de nómina pasa a Ajustes.
- Previsión y metas: títulos con explicación, tabla mensual desplazable en el móvil, recurrentes con el icono del comercio y nombres legibles, botones de metas iguales.
- Proyección: supuestos como etiquetas, «Vivir de tus inversiones» en vez de «Libertad financiera» y escenarios, pensión y aceleradores plegados.
- Seguros: sin tarjetas vacías, recibo solo si difiere de la prima y continente/contenido en hogar.
- Inversiones: TIR en gris con menos de un año, leyenda del gráfico en una línea, resumen de precios con la fecha de la última descarga.
- Deudas: fechas «oct 2044», sin «Ahorro por amortizaciones» si es 0.
- Evolución: primero la mensual automática, luego las fotos trimestrales; el formulario de foto plegado al final.

## 5.22.2 — 19/11/2026 · Presupuestos más limpio
- Cada categoría con sus subcategorías en un bloque; el nombre a la izquierda con sus etiquetas debajo (cuota préstamo, fijo…), el importe alineado a la derecha y un único botón ⋯ (editar, añadir subcategoría, eliminar) en lugar de tres botones.
- Total del presupuesto destacado en la cabecera; la nota de anualidades en su propia línea.
- Reglas: cabecera corta y "Categorizar con las reglas" en una franja aparte cuando hay movimientos sin categoría.

## 5.22.1 — 19/11/2026
- Inicio: "Mayores gastos" ya no cuenta los gastos fijos (hipoteca, recibos…).
- Previsión: la **nómina** se detecta sola aunque el banco ponga un concepto distinto cada mes (y sin contar las pagas extra en el importe previsto). Si aun así los ingresos previstos salen a 0, la tarjeta enlaza a "+ Partida" para añadirla a mano.
- Previsión: el aviso de saldo negativo o bajo está bien maquetado (título, meses en etiquetas con su saldo y la recomendación).

## 5.22.0 — 19/11/2026 · Pertenencias
- Nuevo apartado **Pertenencias** en Patrimonio: inventario de lo que hay en cada vivienda (tecnología, electrodomésticos, cocina, muebles, bebé, deporte, herramientas, joyas…). **No suma al patrimonio neto**; se muestra aparte como "Con pertenencias".
- Cada objeto tiene **valor de reposición** (lo que costaría comprarlo nuevo; para el seguro) y **valor de venta estimado**, que se deprecia solo según la categoría (o el que pongas tú).
- **Seguro de hogar**: nuevo campo "Capital de contenido". Para cada vivienda la app comprueba si cubre la reposición de lo que hay dentro y avisa en Inicio si te quedas corto.
- **Garantías**: 3 años desde la compra por defecto (o la fecha que indiques); aviso en Inicio un mes antes de que venzan.
- SQL: bloque 15 (tabla `pertenencias`, columna `seguros.capital_contenido`).

## 5.21.2 — 18/11/2026
- Movimientos: las cuentas de liquidez en una cuadrícula de 2×2 — arriba la cuenta corriente y el efectivo, abajo el fondo de emergencia y la cuenta de anualidades (también en el móvil).

## 5.21.1 — 17/11/2026
- Patrimonio vuelve a sus recuadros en rejilla (Lo que tenéis · Lo que debéis · Seguimiento). El carrusel se queda solo en Alertas y consejos de Inicio.

## 5.21.0 — 17/11/2026 · Carruseles
- **Alertas y consejos** de Inicio en un carrusel infinito, en orden de importancia (alertas, avisos, consejos). Avanza despacio, se para al tocarlo o pasar el ratón y se puede arrastrar.
- **Patrimonio**: los recuadros (liquidez, inversiones, inmuebles, vehículos, hipoteca, préstamos, evolución) en el mismo carrusel justo debajo del reparto del patrimonio, con una etiqueta "Lo que tenéis / Lo que debéis".
- Si las tarjetas caben en pantalla, se quedan quietas. Respeta la opción "reducir movimiento" del sistema.

## 5.20.2 — 17/11/2026 · Selector de mes que funciona en todos los navegadores
- Movimientos: el filtro de mes es ‹ mes › con un selector propio (año y los 12 meses, "Este mes" y "Todos los meses"). Ya no se puede quedar en texto vacío.
- Inicio: el mes del periodo usa el mismo selector.

## 5.20.1 — 17/11/2026 · Vuelve el Inicio anterior, con más aire, y logos reales
- **Inicio**: vuelve el diseño anterior (rejilla de indicadores y "año en curso"), con más espacio entre recuadros y un separador del año más grande y despejado. "Mayores gastos" sigue debajo del presupuesto.
- **Logos de los comercios**: los comercios conocidos (unos 90 con web: Mercadona, Netflix, Iberdrola, Amazon, Repsol, Renfe…) muestran el icono de su propia web; si no carga, la inicial o el icono genérico. Si el concepto trae una web (p. ej. "NETFLIX.COM"), se usa esa. En ⋯ → "Icono de este comercio" puedes escribir la web de cualquier comercio (p. ej. el bar de tu barrio) para usar su logo.

## 5.20.0 — 17/11/2026 · Inicio más tranquilo, iconos de comercios y Ajustes ordenados
- **Inicio**: la misma información en dos tarjetas en lugar de nueve recuadros. Arriba el periodo (Ingresos · Gastos · Balance con su cuenta y las tasas de ahorro e inversión); debajo la situación (Liquidez · Patrimonio neto · Ingresos del año · Patrimonio en el año). Importes sin céntimos en los indicadores.
- **Mayores gastos** debajo del presupuesto también en el ordenador, con el icono de cada comercio.
- **Iconos en cada movimiento**: comercios conocidos (supermercados, plataformas, telefonía, energía, gasolineras, tiendas, transporte, seguros…) con su inicial o su icono; el resto, el icono de su categoría (restaurante, gasolina, luz…). Con ⋯ → "Icono de este comercio" eliges uno (o unas letras y un color) y se aplica a todos sus movimientos.
- **Ajustes**: tarjetas agrupadas (Tu cuenta con la apariencia · App · Mes de nómina · Alertas · Copias · Usuarios · Historial) sin textos de ayuda largos; la conexión con Supabase queda plegada cuando funciona. Fuera la "Rutina recomendada".
- La barra de secciones del ordenador va centrada.

## 5.19.2 — 17/11/2026 · Movimientos: cuentas y lista, nada más
- Las **anualidades** van dentro de la tarjeta de su cuenta (lo que toca pasar este mes y si falta); al tocarla se abre el reparto completo.
- "Te deben" (gastos compartidos) pasa a ser un botón en la cabecera de Movimientos.
- La pestaña queda: todas las cuentas con su saldo y, justo debajo, la lista de movimientos del periodo elegido.

## 5.19.1 — 17/11/2026 · Precio de la vivienda más fino
- El precio de venta se actualiza con la evolución de **tu provincia** (valor tasado del Ministerio de Vivienda, trimestral). Si no hubiera dato provincial, usa la comunidad (INE) y, en último caso, España.
- El €/m² de referencia se toma de tu **código postal** en el portal del notariado (precios reales de compraventa); la app avisa una vez al año para revisarlo.
- Formulario del inmueble más corto: provincia, m², €/m² de tu código postal y poco más. Al editar se ve tu €/m² de referencia y no se pierde la actualización trimestral.
- Nueva tarea de GitHub "Precio de la vivienda" (`.github/workflows/vivienda.yml`, los lunes o a mano).

## 5.19.0 — 17/11/2026 · Patrimonio, inmuebles automáticos, mantenimiento y simulador
- **Patrimonio** abre un **resumen**: patrimonio neto de la familia, en qué está (barra de composición) y recuadros de Liquidez (cuentas, fondo de emergencia, anualidades, efectivo), Inversiones (al cierre del día anterior), Inmuebles, Vehículos, Hipoteca y Préstamos. Cada recuadro abre su apartado y desde ahí "‹ Volver a Patrimonio". Sin pestañas arriba.
- **Seguros** pasa a **Planificar** (junto a Presupuestos y Proyección). **Inmuebles** y **Vehículos** son pestañas separadas.
- **Inmuebles**: el precio de venta se **actualiza solo cada trimestre** con el Índice de Precios de Vivienda del **INE** (segunda mano, por comunidad autónoma). Metes una vez el €/m² de tu zona y la comunidad; la app aplica la evolución oficial de cada trimestre nuevo, guarda el histórico y muestra el cálculo paso a paso. Nuevas **características del piso** (estado, planta, ascensor, exterior, terraza, garaje, año) que ajustan el precio de la zona.
- **Vehículos**: **libro de mantenimiento** por vehículo (fecha, km, qué se hizo, taller, coste, notas) con la **próxima revisión** por fecha o km; avisa en Inicio cuando se acerca o ha vencido y actualiza los km del vehículo.
- **Inversiones**: **simulador de interés compuesto** (botón junto a "+ Cuenta de inversión"): capital inicial, aportación y frecuencia, momento de la aportación, subida anual, duración, rentabilidad, capitalización, comisiones, inflación, IRPF del ahorro 2026 al rescatar, escenarios pesimista/optimista, objetivo (aportación necesaria y años) y tabla año a año. Botón "Usar mi cartera".
- SQL: bloque 14 (tabla `mantenimientos`; columnas de inmuebles `ccaa`, `caracteristicas`, `precio_m2_base`, `fecha_m2_base`, `trimestre_ipv`). Tarea de GitHub: nuevo paso `scripts/vivienda.mjs` (consulta el INE una vez por semana).

## 5.18.0 — 17/11/2026 · Inicio más limpio, calendario y movimientos
- **Inicio (ordenador)** rediseñado con la misma información: el periodo en una sola línea; indicadores en una rejilla alineada de 4 columnas (Ingresos · Gastos · Balance mensual / Tasas · Liquidez · Patrimonio); avisos en dos columnas; gráfico de ingresos vs. gastos más ancho; presupuesto y mayores gastos uno al lado del otro.
- Botón **📅 Calendario** con el emoji de nuevo.
- **Calendario**: celdas del color de la tarjeta (se ve bien en modo oscuro). El gasto del día se marca con una barra lateral y el total en una etiqueta de color (amarillo → rojo según lo alto que sea). En el ordenador cada gasto muestra el concepto completo y el importe debajo.
- La línea de **ahorro** del gráfico Ingresos vs. gastos es blanca en modo oscuro.
- **Movimientos**: las devoluciones (Bizum…) dicen a qué gasto corresponden ("↩ Devolución de Restaurante La Tasca · 07/11 · −200 €") y el gasto original muestra cuánto te han devuelto.
- Botones **+ Cuenta**, **+ Movimiento** y **⇄ Transferencia** iguales, y al lado un **icono para importar el extracto** del banco: pregunta la cuenta y abre el selector de archivo. Ya no hay tarjeta fija "Importar extracto"; la revisión aparece solo al subir un archivo.
- Móvil: filtros sin solapes (buscador arriba, después mes/cuenta y tipo/todos los meses), y en cada movimiento primero **⋯** y después el **importe**, alineado.

## 5.17.1 — 17/11/2026 · Ajustes desde el círculo de usuario
- Ajustes se abre tocando el **círculo de usuario** (arriba a la derecha), que se resalta mientras estás en Ajustes. En el móvil la barra inferior queda con 4 secciones y el **+** en el centro.

## 5.17.0 — 17/11/2026 · Nuevo diseño
- **Navegación en 5 secciones**: Inicio, Movimientos, Patrimonio (inversiones, inmuebles y vehículos, deudas, seguros, evolución), Planificar (previsión y metas, presupuestos, proyección) y Ajustes. En el móvil van en una **barra inferior** con el botón **+** en el centro; dentro de cada sección, sub-pestañas arriba. Recuerda la última sub-pestaña de cada sección.
- **Iconos propios** (SVG, mismo trazo en toda la app) en lugar de emojis en títulos, avisos y botones.
- **Menos texto en todas las pestañas**, con el mismo criterio que el Dashboard: títulos cortos, fuera notas y párrafos explicativos; los subtítulos de los indicadores van en ⓘ. Seguros sin pólizas muestra un único botón para añadir la primera.
- **Botón +**: en el móvil ya no tapa contenido (está en la barra inferior); en el ordenador queda espacio libre al final de la página. Botones pequeños (✎, papelera, ⓘ) más grandes para el dedo.
- **Modo oscuro**: automático según el móvil/ordenador, o fijo en Ajustes → Apariencia (Automático · Claro · Oscuro). Gráficos incluidos.
- Pruebas nuevas: navegación móvil y modo oscuro (25 en total).

## 5.16.0 — 17/11/2026 · Historial de cambios y pruebas automáticas
- **Historial de cambios** (bloque 13 del SQL): la base de datos anota cada alta, cambio o borrado con quién lo hizo y qué campos cambiaron, de forma que no se puede saltar desde la app. No anota la valoración automática diaria de las inversiones ni ajustes internos. Se guarda 2 años.
- ⚙️ Ajustes → **🕘 Historial de cambios**, en lenguaje normal (p. ej. "Tú cambiaste movimiento Mercadona · −120,50 €: categoría Alimentación → Supermercado"), con filtros por tipo y por persona. En el menú ⋯ de cada movimiento: "Ver historial de cambios".
- **Pruebas automáticas** en `tests/` (23 pruebas): sintaxis y versiones; todas las pantallas en ordenador y móvil; cálculos clave (mes de nómina, balance, hipoteca, participaciones, anualidades); flujos (conciliar, calendario, cierre de mes, menú, historial, usuario sin acceso); tarea de precios; y SQL en PostgreSQL real.
- Nuevo flujo `.github/workflows/pruebas.yml`: ejecuta las pruebas en cada cambio y solo publica la web si todas pasan.

## 5.15.0 — 17/11/2026 · Menos ruido
- **Dashboard**: los indicadores muestran solo el dato, más grande; las explicaciones van en ⓘ. Ingresos y Gastos llevan una flecha › para ver los movimientos. El balance mantiene su cuenta en una línea por concepto. El rango del mes de nómina va en una sola línea (📅 27/10 – 26/11).
- Fuera: la tarjeta de movimientos internos y la composición del patrimonio (están en los ⓘ y en sus pestañas), los subtítulos y notas al pie de gráficos, presupuesto y avisos. "Mayores gastos" muestra los 5 primeros y se pueden abrir.
- **Año en curso**: solo las dos cifras; el desglose del aumento de patrimonio va en su ⓘ.
- **Calendario**: sin gastos fijos (hipoteca, alquiler, cuotas…) por defecto, para que el "día de más gasto" sea útil. Casilla para incluirlos.
- **Movimientos (Cuentas)**: lista agrupada por día con el neto diario. Cada fila tiene concepto, categoría · cuenta, importe y un botón ⋯. Al tocar la fila se edita; las demás acciones (imputar a otro mes, gasto compartido, devolución, eliminar) van en el menú ⋯. Ya no se solapan botones en el móvil.

## 5.14.2 — 17/11/2026 · Versión junto al nombre
- La versión de la app aparece en la cabecera justo después de "Patrimonio Miñán Sánchez", también en el móvil.

## 5.14.1 — 17/11/2026 · Corrección del reparto de la aportación
- Si algún producto de la cuenta tenía el % vacío o a 0 (por ejemplo, un fondo al que ya no aportas), la app ignoraba todos los % y repartía la aportación según el valor de cada producto. Ahora siempre usa el % de cada producto, y el que tiene 0 % no recibe nada. Solo si ningún producto tiene % se reparte por valor.
- La tarjeta "Aportación mensual" muestra el % aplicado a cada producto.

## 5.14.0 — 17/11/2026 · Pestaña Inversiones rediseñada
- **Resumen arriba**: valor total, variación del último día, invertido de tu bolsillo, ganancia (€ y %), rentabilidad anual (TIR) y aportación mensual.
- **Avisos solo cuando hace falta**: ISIN sin precio, descarga diaria parada, productos sin participaciones, reparto que no suma 100 % o valor manual antiguo.
- Tarjetas de cuenta más claras (valor, invertido, ganancia, último día y próxima aportación). Distribución en una sola tarjeta con pestañas Producto / Clase / Región. Precios automáticos y planes, en un desplegable.
- **Detalle de cuenta**: tabla de productos con reparto de la aportación (% y €/mes), participaciones actuales (incluidas las compradas desde la fecha indicada), precio con variación del día, valor y peso real frente al reparto elegido.
- **Aportación mensual**: cuántas participaciones compra cada mes en cada producto. **Últimas compras**: participaciones y precio de cada aportación.
- Las aportaciones mensuales se convierten solas en participaciones según el % de cada producto, y actualizan tanto lo invertido como el valor de la cartera.

## 5.13.0 — 17/11/2026 · Valor de las inversiones automático por ISIN
- Tarea diaria en GitHub Actions (`.github/workflows/precios.yml` + `scripts/precios.mjs`): descarga el precio de cierre de cada ISIN de tus productos desde EODHD (clave gratuita) o Yahoo Finance, y lo guarda en la tabla `precios`. Se ejecuta de lunes a viernes por la noche (ETF y acciones) y a primera hora del día siguiente (valor liquidativo de los fondos). También se puede lanzar a mano.
- Cada producto admite **participaciones** y su fecha. Valor = participaciones × último precio. Las aportaciones y retiradas posteriores se convierten solas en participaciones al precio de su día, repartidas según el % de cada producto.
- Al abrir la app, las cuentas con todos sus productos valorables actualizan solas su valor de mercado y guardan una valoración diaria (gráficos y TIR al día).
- Tarjeta "📡 Precios automáticos" en Inversiones: último precio de cada ISIN, fuente, errores y guía de activación.
- Requiere ejecutar `sql/esquema_completo.sql` (bloque 12) y configurar 3 secretos en GitHub.

## 5.12.0 — 17/11/2026 · Cierre de mes guiado
- Al empezar un mes de nómina, el Dashboard propone **cerrar el anterior** (📋 Empezar cierre). Pasos:
  1. Movimientos al día hasta el último día del mes.
  2. Saldos cuadrados con el banco (con botón Conciliar en cada cuenta).
  3. Todo categorizado (se elige la categoría desde la propia lista).
  4. Dinero que te deben de gastos compartidos.
  5. Traspasos: lo que sobró y sigue sin mover, con botón que prepara la transferencia a ahorro con el importe exacto, y la aportación del mes a anualidades.
  6. Capital pendiente de los préstamos comparado con el recibo.
  7. Valor de las inversiones.
- Los pasos que la app puede comprobar se marcan solos; el resto con "Hecho". Al cerrar se guarda un resumen del mes (ingresos, gastos, balance, ahorro, inversión, patrimonio y presupuestos superados), que se puede consultar o reabrir.
- El registro rápido acepta importe y concepto ya rellenos.

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
