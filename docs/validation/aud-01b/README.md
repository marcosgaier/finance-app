# AUD-01B — Validación de pagos desde reservas

Implementación de [AUD-01B](https://github.com/marcosgaier/taura-roster-pay/issues/20), sobre main 632bcc73498d53407bca3a6d9895482f75429935. Rama: codex/aud-01b-payment-safety. Fixtures completamente ficticios.

## Cambios
- El formulario informa nombre/saldo del sobre y que registrar el pago ya descuenta ese dinero.
- Advertencias con continuar/cancelar para saldo insuficiente, fecha futura local y potencial duplicado de tarjeta+fecha+centavos, buscando en semanas activas e históricas. Los pagos iguales legítimos se pueden confirmar.
- Alta y baja del pago con su ajuste de reserva en una sola actualización de estado. Bloqueo síncrono de doble clic; repetir una baja no reintegra dos veces.
- Retiros manuales disponibles con explicación para evitar registrar dos veces un pago.
- Fecha local para movimientos manuales nuevos; historial derivado con fecha real e identidades visuales estables. Fallback por índice para pagos antiguos sin ID o con ID repetido. No se reescriben IDs ni fechas persistidos.
- Adaptador de presentación para evitar −0 con residuos inferiores a medio centavo. No redondea dinero almacenado ni cambia el motor.

## Historia verificada
Registrar desde UI → validar/confirmar → actualizar pago y sobre juntos → guardar una vez en localStorage → mostrar saldo/pago. Es una aplicación local; no hay API ni base remota en este flujo.

Cancelar advertencias y editar el formulario no escriben datos. Se probaron los tres avisos por separado, aceptación de dos pagos legítimos iguales, doble clic en alta/baja y retiro manual, fecha NZ a las 00:30. Sin errores de consola/página ni solicitudes externas en los casos ejecutados.

## Comandos y resultados
PowerShell desde la raíz:

```powershell
$env:TZ='Pacific/Auckland'
npm test
npm run build
git diff --check
```

PASS: cuatro scripts existentes (motor, persistencia, pagos históricos y reapertura) más 58 casos node:test (48 existentes + 10 nuevos). Build PASS. Diff check PASS.
Logs: [npm-test.txt](npm-test.txt), [build.txt](build.txt).

Interfaz:

```powershell
$env:PLAYWRIGHT_MODULE='C:\Users\marco\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright\index.mjs'
node scripts/validate-card-payments-ui.mjs
```

Disponible también como npm run test:payments-ui. Admite una instalación externa de Playwright y CHROMIUM_PATH; no se agregó dependencia al proyecto. Requiere build previo.

PASS: 12 escenarios, seis en 360×850 y seis en 1280×850, zona Pacific/Auckland. [Resultados JSON](ui-results.json).
El test sirve dist en un puerto efímero propio y usa contextos nuevos de Chrome, sin perfiles ni almacenamiento personal, bloqueando tráfico externo.

Capturas: [pago móvil](payment-360.png), [retiro móvil](manual-360.png), [pago escritorio](payment-1280.png), [retiro escritorio](manual-1280.png). Se inspeccionó visualmente el pago móvil.

Los tests nuevos verifican además: reconocimiento del pago una vez por el ciclo; planes/recomendaciones intactos al registrar; margen según origen; 19/20; centavos/reversión; cierre/reapertura/recierre y protección histórica; IDs/fechas sin mutar entradas; visualización de residuos; fecha local NZ y DST.

## Incidencias durante la validación
- Puerto 4173 ocupado: no se detuvo ese proceso; se pasó a un servidor de prueba propio.
- Acceso de Chrome a localhost bloqueado en sandbox; la prueba final se ejecutó con permiso fuera del sandbox.
- Se descartó una instalación incompleta de Playwright sin playwright-core y se usó la instalación completa existente.
- Se corrigieron selectores del test para abrir «Pago elegido esta semana» y se ajustó la comparación de planes a la normalización preexistente. Eran errores del arnés, no cambios de fórmulas.
- Resultado final sin casos fallidos. Capturas y JSON corresponden a la ejecución aprobada.

## Alcance protegido y riesgos pendientes
No se modificaron financeEngine, reglas GEM, ciclo 20–19, validadores de backups, importaciones, schemas, snapshots ni helpers de protección histórica. No se tocó Taura ni se accedió a datos financieros personales.

La aritmética de coma flotante se conserva: solo se corrige su representación como −0.
Los avisos permiten continuar conscientemente; todavía se puede registrar un pago futuro, sobregiro o duplicado confirmado. El ciclo cuenta pagos futuros dentro del ciclo según sus reglas actuales.
No puede inferirse con certeza que un retiro manual y un pago son el mismo evento: se advierte, no se enlazan ni compensan automáticamente.
No hay conciliación/migración histórica. El motor sigue sin descontar Fondo GEM de su recomendación.
El bloqueo de doble clic es del formulario y del estado activo; no introduce coordinación entre pestañas ni dispositivos.
Las advertencias usan confirmación nativa; conviene revisarlas en el dispositivo habitual antes de integrar.

PR para revisión; sin merge ni despliegue manual.
