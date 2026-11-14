# PR #9 — precisión de etiquetas con saldo inicial

Observación: https://github.com/marcosgaier/finance-app/pull/9#issuecomment-6868984413

Solo etiquetas: «Saldo inicial + ingresos ingresados» para los totales del seguimiento activo, histórico y MoneyFlowPanel (también reemplaza «Ingresó», que incluía arrastre). «Fondos considerados en el plan» en WeeklyActionPlan. No se cambian operaciones, valores, persistencia ni datos financieros.

Validación final:
- `TZ=Pacific/Auckland; npm test`: cuatro scripts existentes y 61/61 tests Node PASS ([log](npm-test.txt)).
- `npm run build`: PASS ([log](build.txt)).
- `git diff --check`: PASS.
- `node scripts/validate-sim-01a-ui.mjs`: 10/10 PASS ([log](ui-log.txt), [JSON](ui-results.json)). Conserva los ocho escenarios anteriores y suma opening en 360/1280 px: saldo inicial 125 + ingreso 400 = 525, etiquetas del plan, resumen activo, panel de resultado e historial, cero escrituras y JSON intacto al navegar.

Reproducir UI con PLAYWRIGHT_MODULE apuntando a Playwright externo y VALIDATION_OUTPUT_DIR=docs/validation/sim-01a/review-labels, tras build. Chrome aislado, servidor localhost efímero, fixtures sintéticos y tráfico externo bloqueado. Capturas plan-opening y opening en ambos tamaños. Sin merge ni despliegue.
