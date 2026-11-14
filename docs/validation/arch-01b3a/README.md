# ARCH-01B3a — editor ficticio en memoria

Issue: [Taura #31](https://github.com/marcosgaier/taura-roster-pay/issues/31).
Base Finance `64ca62dfabbef5e790c96036aa100abaae037436`. Verificación 14/11/2026 NZ.
Node v24.22.1, Chromium 156.0.8078.79, Playwright 1.65.0 externo. Solo builds
locales y contextos nuevos con datos sintéticos; nunca perfil ni bases reales.

## Resultado

- [npm test](npm-test.log): cuatro suites históricas/financieras/persistencia,
  70 tests existentes, auditoría cerrada de imports Work y **8 tests nuevos** de
  edición/validación/guardas/UI protegida. Todo PASS.
- [Typecheck](typecheck.log), [build](build.log) y [diff check](diff-check.log): PASS.
- [Editor Chromium](editor-result.json), [log](editor-browser.log): PASS en
  **360, 390 y 1280 px**. Editar/ID/validación sin efectos, diálogo/Tab/Escape/
  retorno de foco/scroll, Resumen/Pagos coherentes, múltiples turnos, duplicado,
  cancelación, eliminación confirmada/rechazada, día vacío, nocturno, mes/semana,
  restablecer con confirmación y descarte al salir/recargar.
- [Regresión Work/B1/Finance](work-regression/ui-results.json),
  [log](work-regression-browser.log): PASS. Ocho pestañas, estilos e identidad DOM,
  presupuesto/historial, sesión del planificador, foco/scroll, enlace B1,
  Resumen/Roster/Pagos y gates de recuperación, incluido fallo de render demo.
  Los destinos de B1 se interceptan con respuestas sintéticas (ok/404/offline);
  no hay conexiones a Taura en producción.
- [20 pruebas Chromium de pagos Finance](payments-browser.log): **20 PASS**.
- [14 flujos Chromium del planificador](planning/planner-result.json),
  [log](planning-browser.log): PASS; exclusivamente fixture ya exportado, sin
  acceder a Taura. Preservación de backups financieros incluida en esa suite.
- [Invariantes de alcance](scope-invariants.json): App/recovery, Dashboard,
  fixtures/validateDemo, Resumen, Pagos, manifiesto y diez archivos del motor
  fijado permanecen byte-idénticos a main.

Los spies comparan el baseline de carga de Finance con el estado después de
abrir/editar/duplicar/cancelar/borrar/restablecer/salir de Work. Storage (get y
write), IDB, red, cachés, BroadcastChannel, beacon, SW/Workers y descargas no
registran actividad nueva de Work. El reload ejecuta la lectura inicial normal
de Finance: se compara con ese mismo baseline de una página nueva. No se siembran
ni abren colecciones Taura. El import graph de Work no permite repositorios,
hooks, adaptadores, estilos globales, SW ni módulos ajenos a su subárbol/React.

## Capturas

| Ancho | Editor (inicio) | Editor (scroll) | Roster editado |
|---|---|---|---|
| 360 | [editor](editor-360.png) | [controles](editor-bottom-360.png) | [roster](roster-edited-360.png) |
| 390 | [editor](editor-390.png) | [controles](editor-bottom-390.png) | [roster](roster-edited-390.png) |
| 1280 | [editor](editor-1280.png) | [controles](editor-bottom-1280.png) | [roster](roster-edited-1280.png) |

## Reproducir

```sh
npm ci --cache /tmp/finance-npm-cache
npm test
npm run typecheck:work
npm run build
CHROMIUM_PATH=/usr/bin/chromium \
PLAYWRIGHT_MODULE=/workspace/.cloud-tools/node_modules/playwright/index.mjs \
npm run test:work-editor-ui
VALIDATION_OUTPUT_DIR=docs/validation/arch-01b3a/work-regression \
CHROMIUM_PATH=/usr/bin/chromium \
PLAYWRIGHT_MODULE=/workspace/.cloud-tools/node_modules/playwright/index.mjs \
npm run test:work-ui
VALIDATION_OUTPUT_DIR=docs/validation/arch-01b3a/payments \
CHROMIUM_PATH=/usr/bin/chromium \
PLAYWRIGHT_MODULE=/workspace/.cloud-tools/node_modules/playwright/index.mjs \
npm run test:payments-ui
```

El test de Work valida siempre hashes del manifiesto upstream. Para el pase
independiente registrado se descargaron por GitHub **solo los diez archivos** de
`provenance.json` desde Taura `22665a594a0dc8230aa7ed6a28736297a1ed32f2` a
`/tmp/b3a-taura-upstream/src/`, sin modificar el checkout Taura. Ejecutar:

```sh
TAURA_PARITY_ROOT=/tmp/b3a-taura-upstream npm test
```

Esto compara bytes independientes y ejecuta paridad de proyecciones pay/bank y
helpers calendario. Para la regresión del planificador, iniciar `npm run serve`
en otra terminal (solo localhost) y ejecutar `npm run test:planning-ui` con las
mismas variables de Chromium/Playwright y VALIDATION_OUTPUT_DIR terminada en
`/planning`. Ajustar rutas de herramientas al equipo. No se añadieron dependencias.

## Límites y revisión manual

No se certifican Android físico, instalación/PWA, funcionamiento offline,
lectores de pantalla reales, zoom nativo ni todos los navegadores. La regresión
incluye reflow con CSS zoom al 200% en 1280; el mínimo global preexistente de
Finance de 320 px queda fuera de este diff. El diálogo usa el comportamiento
nativo de Chromium; validar teclado virtual/scroll con Android y lector real
antes de integrar. No hay migración, backups de Trabajo, persistencia, datos
reales, feriados PAY-01 ni confirmación de pagos. B3b/B3c siguen fuera de alcance.
