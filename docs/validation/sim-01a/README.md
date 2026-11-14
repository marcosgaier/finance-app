# SIM-01A — presentación del seguimiento semanal

Alcance: https://github.com/marcosgaier/taura-roster-pay/issues/21. Rama independiente desde main 323b4d9. Implementación autorizada explícitamente por el director en este chat.

Solo cambian textos y presentación en WeeklyActionPlan, WeeklyTracker y Dashboard. Se distingue plan estimado con presupuesto de movimientos registrados parciales. El registro de compras continúa opcional y colapsado; cero compras se describe como ausencia de registros. Los ingresos ingresados no se certifican como depósitos bancarios. Historial y editores usan etiquetas neutrales. Los paneles permiten encoger su ancho para títulos largos en móvil.

No cambian cálculos, campos almacenados (incluido realWeeklyMargin), handlers, IDs, snapshots, cierre/reapertura, reservas, fórmulas GEM, prorrateos ni persistencia. No se accedió a datos personales ni se modificó Taura. Revisión del diff y checklist react-best-practices: sin cambios a hooks, efectos, eventos ni dependencias; se conservan botones, labels y acceso a formularios.

## Verificación

- `TZ=Pacific/Auckland; npm test`: PASS, cuatro scripts existentes y 61/61 tests Node. [Log](npm-test.txt).
- `npm run build`: PASS. [Log](build.txt).
- `git diff --check`: PASS.
- `node scripts/validate-sim-01a-ui.mjs`: 8/8 PASS. [Log](ui-log.txt), [JSON](ui-results.json).

UI reproducible con PLAYWRIGHT_MODULE apuntando al index.mjs externo de Playwright y Chrome instalado; no hay nuevas dependencias del proyecto. Servidor efímero propio, contextos aislados, zona Pacific/Auckland, fecha ficticia fija y tráfico externo bloqueado. Se prueban cero compras, compras parciales, compra desde reserva e ingreso esperado con ingreso ingresado cero en 360 y 1280 px. Se verifica copy, compras colapsadas por defecto y accesibles, ausencia de errores de consola/página, cero escrituras al navegar y JSON idéntico antes/después. Cerrar sin compras funciona y conserva registros anteriores y saldos de reserva. Los tests existentes cubren fórmulas, persistencia, pagos y reapertura. No se afirma una comparación bancaria ni conciliación automática.

Capturas de plan y seguimiento por escenario y tamaño en esta carpeta. Se inspeccionó visualmente empty-360.png; los títulos se ajustan al panel móvil. Los primeros intentos del arnés requirieron respetar mayúsculas visuales y abrir el panel de pagos que contiene Cerrar semana; la ejecución final pasa.

## Límites

Los resultados siguen dependiendo de entradas manuales y presupuestos fijos; no son saldos bancarios. Se conserva el fallback de ingreso esperado existente. No se introducen gastos supuestos, modo persistente ni conciliación; cualquier cambio posterior de cálculo o automatización requiere otro alcance. Sin merge ni despliegue de producción.
