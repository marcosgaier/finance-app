# ARCH-01B3a — editor de turnos ficticios en memoria

Orden: [taura-roster-pay#31](https://github.com/marcosgaier/taura-roster-pay/issues/31), subetapa de #30. Implementado en rama `codex/arch-01b3a-memory-shift-editor`, **PR sin merge**. Base comprobada antes de crear rama: `64ca62dfabbef5e790c96036aa100abaae037436`. Taura main remoto consultado: `22665a594a0dc8230aa7ed6a28736297a1ed32f2`.

## Comportamiento

- Trabajo → Roster conserva mes/semana, cursor y detalle. Un día vacío permite agregar; cada registro tiene acciones individuales para editar, duplicar, cancelar y eliminar. Los turnos simultáneos no se reemplazan en lote.
- El estado React pertenece a cada apertura de Trabajo. Roster, Resumen y Pagos reciben la misma copia del escenario, ordenada por fecha; las fórmulas existentes recalculan exclusivamente la demo. Cambiar de subvista conserva el escenario; salir de Trabajo o recargar lo destruye. Restablecer y eliminar requieren confirmación nativa.
- Editar conserva ID, created_at y campos desconocidos. Duplicar crea ID único, conserva el plan y vuelve a planned con datos trabajados vacíos. Cancelar conserva el registro con cancelled; el motor original excluye sus horas. Eliminar afecta solo al ID seleccionado y mueve el foco al detalle.
- Se prohíben todas las acciones sobre payslip/confirmed tanto en UI como en el controlador de dominio; el editor no permite crear esos estados ni confirmar recibos. No se editan preferencias overtime, banco de horas, reglas ni feriados.
- Tipos compatibles: diurno, nocturno, libre, licencias y personalizado. El formulario distingue planificado y trabajado ficticio; los campos trabajados son opcionales y se usan conforme al motor existente. La tarifa planificada sigue siendo la ficticia de la plantilla (30 NZD); la tarifa trabajada opcional pertenece solo al registro ficticio.
- Se validan fecha civil y rango fiscal del ejemplo, pares de horarios, números finitos no negativos, pausas y máximo de 12 horas pagadas. Las horas se derivan del horario menos la pausa con el motor intacto; sin horario trabajado se admiten horas trabajadas opcionales. Un libre tiene cero horas y no tiene horarios. El error no publica cambios.
- El fin nocturno se ingresa con fecha del día siguiente. Se usa la zona horaria del dispositivo, igual que el motor fijado. En Pacific/Auckland se prueban DST, medianoche y 12 h; se bloquean horas civiles inexistentes o ambiguas en vez de adivinar un offset. No es certificación de equivalencia entre dispositivos con distintas zonas.

## Archivos y aislamiento

Producción: `WorkDemo.tsx`, `pages/RosterPage.tsx`, `components/DayDetails.tsx`, nuevo `components/ShiftEditor.tsx`, nuevo `demo/editor.ts` y `work-demo.module.css`, todos dentro de `src/modules/work/`.

Pruebas: `work-editor-tests.mjs`, `validate-work-editor-ui.mjs`; test:work incorpora el test de editor sin dependencias nuevas. El script de regresión Work acepta un directorio propio de evidencia y el nuevo banner. El script de planificación espera 32 ms del reloj simulado después de cambiar de pestaña para capturar la expansión de prioridades de PlanList después de su efecto React. No cambia código de Finance.

`protected-files.json` compara contenido con la base: App.jsx/recovery, Dashboard.jsx de Finance, fixture, manifiesto, lock y diez fuentes Taura permanecen iguales. El manifiesto y la prueba de paridad verifican bytes upstream y resultados contra un árbol independiente de Taura fijado. `reference-files.json` identifica las referencias de editor/plantillas/tipos; no se importa el hook de almacenamiento ni ShiftEditor original.

Los spies de navegador registran Storage get/set/remove/clear, IDB open/deleteDatabase, red, canales, workers, caches, beacon, SW y descargas; el snapshot completo local/session, URL e historial permanece igual durante agregar/editar/duplicar/cancelar/eliminar/restablecer/salir. Se comprueba identidad del DOM de Finance, y recarga/restauración del fixture. Las pruebas usan perfiles efímeros y datos sintéticos, con toda red externa interceptada. Ninguna visita al origen Taura real.

## Resultados y evidencia

| Comprobación | Resultado | Evidencia |
|---|---|---|
| npm test: suites Finance, 70 Node y Work/editor | PASS | [npm-test.log](npm-test.log) |
| Paridad independiente Taura y blobs upstream | PASS | npm-test.log, protected-files.json |
| TypeScript / build / diff --check | PASS | typecheck.log, build.log, diff-check.log |
| Editor 360/390/1280, teclado, foco, Escape, scroll, confirmaciones, errores, múltiples turnos, reset, salida/recarga y cero efectos | PASS | [editor/ui-results.json](editor/ui-results.json), editor-ui.log |
| Roster/Resumen/Pagos, ocho pestañas, B1, navegación/scroll, recovery, planificación y presupuesto conservados | PASS | [regression/ui-results.json](regression/ui-results.json), regression-ui.log |
| 20 pruebas UI de pagos Finance | PASS | payments-finance.log |
| Planificación escritorio y móvil, presupuesto, historial, persistencia y backup | PASS | planning-desktop.log, planning-mobile-settled.log |

Se conservan los logs de la discrepancia móvil inicial (`planning-mobile.log`, `planning-mobile-retry.log`) y la comparación con main (`main-mobile-baseline.log`). El test leía el texto de Deudas antes de que el efecto de expansión de prioridades terminara: sincronizar el reloj de prueba resolvió la discrepancia, sin tocar PlanList, Dashboard ni persistencia. La comparación main pasó. Las pruebas completas posteriores de ambos tamaños pasan con esa sincronización.

Capturas inspeccionadas: [editor 390](editor/editor-390.png), [editor 1280](editor/editor-1280.png), [editor 360](editor/editor-360.png), [error accesible](editor/error-390.png), [Pagos recalculados](editor/recalculated-390.png) y [zoom CSS 200%](editor/editor-zoom-200.png). Las páginas largas conservan scroll dentro del diálogo; los controles finales siguen accesibles.

## Reproducción

```powershell
$env:TAURA_PARITY_ROOT='<árbol independiente LF de Taura 22665a5>'
npm test
npm run typecheck:work
npm run build
git diff --check
$env:PLAYWRIGHT_MODULE='<Playwright externo>/index.mjs'
$env:CHROMIUM_PATH='<Chrome>/chrome.exe'
node scripts/validate-work-editor-ui.mjs
$env:VALIDATION_OUTPUT_DIR='docs/validation/arch-01b3a/regression'
node scripts/validate-work-demo-ui.mjs
$env:VALIDATION_OUTPUT_DIR='docs/validation/arch-01b3a/payments-finance'
node scripts/validate-card-payments-ui.mjs
# Servir dist en otro proceso: PORT libre, node scripts/serve-dist.mjs.
$env:PREVIEW_URL='http://127.0.0.1:<puerto>'
$env:VALIDATION_OUTPUT_DIR='docs/validation/arch-01b3a/planning-desktop'
node scripts/validate-planning-ui.mjs
$env:MOBILE='1'
$env:VALIDATION_OUTPUT_DIR='docs/validation/arch-01b3a/planning-mobile'
node scripts/validate-planning-ui.mjs
```

## Límites y rollback

Pendientes revisión de ChatGPT y prueba visual del director. No se certificaron Android/PWA físico, lector de pantalla, zoom nativo/pinch ni otros navegadores. El zoom CSS 200% se prueba en escritorio; el mínimo global existente de Finance de 320 px sigue fuera de alcance. Recovery verifica gates y disponibilidad de botones; no contenido de recuperación ni reinstalación. No hay datos reales, migración ni B3b/B3c/PAY-01.

Antes de integración basta cerrar el PR. Si se autorizara integrar posteriormente, revertir el commit de B3a conserva la base B2.2b. Nunca limpiar storage/IDB/backups, reinstalar PWA, cambiar origen ni tocar Taura original. **No fusionar sin autorización específica.**
