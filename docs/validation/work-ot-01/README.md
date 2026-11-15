# WORK-OT-01 — overtime en DemoSession

Implementación sobre PR #16, rama `feat/arch-01b3a-demo-editor`, base remota verificada `ee1c253356b93ad7f928353ead4d6beff74526f5`. Issue #17 leída completa antes de editar.

Selector semanal `pay` / `bank` en Trabajo → Pagos, dentro del detalle de overtime. Preferencias en React memory de DemoSession, compartidas por Resumen/Roster/Pagos. El fixture original sigue en bank para 2026-09-20; reset confirmado, salida y reload restauran la copia original. Reset cancelado conserva la edición. Actualización inmutable por semana, sin cambios a IDs de turnos, selección, preview ni generaciones de lotes.

Protección doble: no se muestra selector y el actualizador rechaza cambios si el período está paid o contiene registros confirmed/payslip/paid. Sin overtime no hay selector ni actualización. Referencia visual/estructura: PaymentsPage.tsx y useRoster.ts upstream en `22665a594a0dc8230aa7ed6a28736297a1ed32f2`; se usa solo la forma de OvertimePreference, sin incorporar repositorios o efectos upstream.

Motor y fixture intactos: base de las horas extra siempre pagada; Hours Bank suma overtime × (multiplicador − 1). Para el ejemplo de 60 h / 20 h overtime y multiplicador 1.5: base NZD 1800 en ambos tratamientos y banco +10 h al elegir bank. Bruto, PAYE, KS, neto y horas se derivan del mismo motor puro fijado, sin modificar fórmulas, tasas, PAY-01, feriados ni settings #32.

## Evidencia

- [npm test](npm-test.log): PASS, incluyendo nuevos tests de ida/vuelta pay → bank → pay, semanas independientes, sin overtime, protección, exactitud de campos respecto al motor fijado, no mutación y copia restaurada. Paridad ejecutable independiente con `TAURA_PARITY_ROOT=node_modules/.cache/taura-upstream`, además de blobs exactos e import graph cerrado.
- [Typecheck](typecheck.log), [build](build.log), [diff check](diff-check.log): PASS.
- [Editor y overtime](editor-ui.log), [resultado](editor-result.json): PASS 360/390/1280. Cambio bank/pay/bank/pay, coherencia Resumen/Pagos, foco/Tab, targets >=44px, sin overflow, reset aceptar/cancelar, salida/reload, editor/lotes y cero efectos storage/IDB/red/cachés/SW/descargas.
- [Finance](work-finance-ui.log): regresión completa de navegación, DOM/CSS/scroll y persistencia sintética, ocho pestañas y retorno a Finance; resultados detallados en finance/.
- [Pagos](payments-ui.log): 20 PASS.
- Planificador [desktop](planning-ui.log) y [móvil](planning-mobile-ui.log): PASS; resultados y capturas en planning/ y planning-mobile/.
- Capturas selector: [bank 360](overtime-bank-360.png), [pay 360](overtime-pay-360.png), [bank 390](overtime-bank-390.png), [pay 390](overtime-pay-390.png), [bank 1280](overtime-bank-1280.png), [pay 1280](overtime-pay-1280.png).

Node 22.23.2, Chrome 157.0.8103.52, Pacific/Auckland; perfiles exclusivamente sintéticos. La primera ejecución restringida bloqueó localhost; se repitió con permiso para Chrome y servidores locales. Se actualizaron expectativas antiguas de “sin select” para admitir exactamente el control autorizado; el nuevo test de reload renueva su handle DOM y abre detalles de forma idempotente. Puerto 4173 ocupado: planificador ejecutado en servidor propio 4187. Los logs finales son las ejecuciones corregidas.

Reproducir: npm test con TAURA_PARITY_ROOT indicado; npm run typecheck:work; npm run build; git diff --check; test:work-editor-ui; test:work-ui; test:payments-ui; test:planning-ui con PREVIEW_URL local, y luego MOBILE=1. PLAYWRIGHT_MODULE apunta a instalación externa del runtime, CHROMIUM_PATH al Chrome local; sin nuevas dependencias.

Límites: validación browser del build local, no prueba de una preview alojada. Resultado Vercel y SHA publicados en el comentario de ejecución del PR. Android/PWA físico y lector de pantalla real siguen pendientes. La auditoría salarial Taura #33 es futura y no se ejecutó. No se modificaron Taura original, datos reales, Finance persistente, main ni PR #15. Sin merge ni nuevo PR. Rollback: revertir este commit, sin migraciones.
