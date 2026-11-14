# ARCH-01B2.2b — Pagos sintéticos de solo lectura

14/11/2026, Pacific/Auckland. Implementación de Taura #28, conforme a la orden de continuación 6872480974 y la petición directa del director. Rama y PR separados, SIN MERGE. PAY-01 #29, feriados, edición, datos reales y refinamiento visual del calendario quedan fuera del alcance.

## Base, fuente y alcance

- Finance main verificado al iniciar: `2a42847b6424a4eaf07cc9e75103b17fccf2f7fc`, merge del PR #13. Rama creada desde origin/main actualizado, árbol limpio.
- Taura main: `22665a594a0dc8230aa7ed6a28736297a1ed32f2`.
- Fuente de presentación: `src/pages/PaymentsPage.tsx`, blob `8694a226789b857d32b9e33042cdac2c97c11522`; registrada en provenance.json. No es copia íntegra.
- Imports originales: IncomeProjectionExport (serialización/descarga, excluido), lucide-react (excluido), types, payPeriods, dates. Solo se conserva el cierre puro ya vendorizado; ningún archivo nuevo de motor ni dependencia externa.
- Se adapta la presentación a `src/modules/work/pages/PaymentsPage.tsx`: cuatro próximas y dos recientes, relativas a la fecha fija 2026-09-24. Se usa buildPayProjections con TODOS los turnos, settings, referenceDate, 4 y overtimePreferences.
- Sin select de overtime, editor, exportación, descargas, servicios, hooks Taura, storage, red, callbacks financieros o efectos SW/PWA. Ninguna regla salarial o de feriados cambia. No se afirma cobertura de feriados.
- Se eliminan las afirmaciones originales de martes fijo, payslips confirmados y cobros conciliados. Fechas calculadas, estados ficticios y bruto/neto estimados; PAYE ya incluye ACC. Semana vacía no implica ausencia de ingresos reales.
- Mismos fixtures, congelación y fecha B2.1/B2.2a, sin modificaciones. Resultado visible del período 20–26/09: pago miércoles 30/09, 48 h diurnas + 12 h nocturnas, 40 h ordinarias + 20 h overtime, +10 h bank, base 1800, nocturno 36, weekend 48, enhanced 0, bruto 1884, PAYE 460.02, KiwiSaver 56.52, neto 1367.46 NZD.
- WorkDemo añade Pagos a su navegación local. Tres subvistas montadas con hidden, heading/foco y scroll por vista; Roster conserva cursor/vista/detalle. Salir desmonta Trabajo y reabrir vuelve a Resumen, como antes. Botón de retorno fuera del boundary; sin historial/router nuevo.
- CSS Modules locales, hero verde, tarjetas, listas de definición y valores monetarios legibles. No cambios en App.jsx, Dashboard.jsx, B1, ocho pestañas, planificador, motores Finance/Taura, package/lock ni configuración PWA/Vercel.
- Revisión React aplicada: componentes a nivel de módulo, hooks incondicionales, estado solo de navegación, cálculos derivados sin efectos, claves estables, props de lectura, sin paquetes nuevos, controles nativos y encabezados/etiquetas accesibles.

## Pruebas y evidencia

- `npm-test.log`: cuatro suites operativas Finance y 70 pruebas Node PASS; test:work comprueba diez blobs/SHA256, grafo transitivo, ausencia de efectos, fixtures congelados, overtime pay/bank, fechas/motor fiscal. Añade render de Pagos con ambos tratamientos, fechas calculadas, seis tarjetas y ausencia de controles operativos, sin mutar entradas.
- Paridad independiente ejecutada: clon temporal autenticado Taura; bytes extraídos mediante git show del commit fijado. Identidad de diez archivos y comparación ejecutable de proyecciones pay/bank y helpers Roster. No se utilizó como autoridad el checkout vecino ni el vendor. El PASS está en npm-test.log.
- `typecheck.log`, `build.log`: PASS.
- `diff-check.log`: git diff --check PASS.
- `ui.log` / `ui-results.json`: Chrome aislado 360/390/1280, fechas e importes exactos, próximas/recientes/vacías, sin inputs/select/download, teclado, foco, scroll de Pagos, detalle Roster retenido al visitar Pagos y regreso seguro a Finance.
- Se conservan identidad DOM Finance/planificador, ocho pestañas, borrador hipotético 12.34, presupuesto sintético 42, snapshots completos local/sessionStorage, URL e historial. Spies de Storage/IDB/red/canales/workers/caches/SW sin nuevos efectos de Trabajo. Solicitudes al enlace B1 interceptadas; nunca se consulta Taura productivo.
- Fallo de render demo contenido y gates recovery incompatible/read-error/unsaved conservados. Se verifica disponibilidad de reintento/descarga de recuperación; no se certifican aquí su ejecución ni contenido descargado.
- `payments.log`: 20 escenarios de regresión UI Finance PASS.
- `planning.log` y `planning-mobile.log`: planificación escritorio/móvil PASS, presupuesto, historial, cierre/reapertura, snapshots y backup exportado sin cambios; cero solicitudes externas/errores de consola. Son pruebas sintéticas, no una ejecución del exportador operativo Taura.
- Capturas `payments-360/390/1280.png`, `payments-zoom200-1280.png` y regresión Roster. Revisión visual de tarjetas, etiquetas, importes y wrapping móvil/escritorio.

## Límites y primeros intentos

No Android/PWA físico, lector de pantalla, navegador alternativo ni validación productiva. Zoom/reflow CSS 200% PASS a 1280px (640 CSS px); zoom nativo y pinch móvil pendientes. La prueba inicial 360px/200% expuso el mínimo global Finance existente de 320px (180 CSS px efectivos, desborde); no se cambia el diseño global y no se declara PASS ese caso.

La primera prueba de paridad desde el sandbox apuntó a un TEMP diferente y no encontró el árbol. La siguiente detectó conversión CRLF del checkout independiente; se extrajeron bytes originales desde objetos Git, tras lo cual la comparación exacta pasó. Acceso raw anónimo devolvió 404; se obtuvo la fuente mediante Git autenticado. No se alteró Taura original ni sus datos.

## Reproducción y rollback

PowerShell, con Node y dependencias ya instaladas:

```powershell
$env:TZ='Pacific/Auckland'
$env:TAURA_PARITY_ROOT='<árbol independiente de Taura al SHA fijado, bytes originales LF>'
npm test
npm run typecheck:work
npm run build
git diff --check
$env:PLAYWRIGHT_MODULE='<Playwright externo>/index.mjs'
$env:CHROMIUM_PATH='<Chrome>/chrome.exe'
node scripts/validate-work-demo-ui.mjs
$env:VALIDATION_OUTPUT_DIR='<directorio propio de pagos>'
node scripts/validate-card-payments-ui.mjs
# En otro proceso: PORT libre y node scripts/serve-dist.mjs
$env:PREVIEW_URL='http://127.0.0.1:<puerto>'
$env:VALIDATION_OUTPUT_DIR='<directorio propio de planificación>'
node scripts/validate-planning-ui.mjs
$env:MOBILE='1'
$env:VALIDATION_OUTPUT_DIR='<directorio propio de planificación móvil>'
node scripts/validate-planning-ui.mjs
```

El test estándar permite paridad sin árbol externo por identidad de blobs; esta entrega sí ejecutó la comparación independiente. Playwright se instaló exclusivamente en TEMP, sin cambiar package/lock.

Antes de merge, cerrar el PR basta. Si se integrase posteriormente con autorización, revertir el commit B2.2b conserva B2.2a/B1 y Finance. No limpiar storage/IDB/caches, reinstalar PWA, cambiar dominio ni migrar datos. La integración queda reservada al director.
