# Pruebas automáticas

Se ejecutan solas en GitHub (*Actions → Pruebas y publicación*) en cada cambio. La web solo se publica si todas pasan.

En local: `pip install pytest playwright && python -m playwright install chromium && python -m pytest tests -q`
(para incluir la prueba del SQL, define `PG_DSN` con una base PostgreSQL vacía).

- `test_sintaxis.py`: todos los JavaScript se leen sin errores, versiones coherentes y archivos de la caché existentes.
- `test_pantallas.py`: todas las pestañas y subvistas se dibujan sin errores, en ordenador y en móvil, sin desbordar.
- `test_calculos.py`: mes de nómina, balance líquido, capital de la hipoteca, participaciones y reparto, anualidades y gastos fijos.
- `test_flujos.py`: conciliar y apuntar un gasto, calendario, cierre de mes, menú de movimientos, historial y usuario sin acceso.
- `test_precios.py`: la tarea diaria de precios con las APIs simuladas.
- `test_sql.py`: el SQL completo dos veces seguidas, la lista de acceso y el historial.

`stub/` contiene un Supabase simulado con datos ficticios: las pruebas nunca tocan datos reales.
