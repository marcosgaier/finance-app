# PR #8: compatibilidad de pagos activos legacy

Corrección de la [observación técnica](https://github.com/marcosgaier/finance-app/pull/8#issuecomment-6868496643), dentro de [AUD-01B](https://github.com/marcosgaier/taura-roster-pay/issues/20). Base revisada: aad4baf3041c753c32f81b6fcddfc835ef14e555.

UI, alta y baja comparten `sanitizePayments`. Los IDs únicos existentes se conservan; los ausentes y todas las ocurrencias de IDs repetidos reciben identidades deterministas distintas, evitando colisiones con IDs existentes. Un alta/baja válida guarda los sobrevivientes saneados en la semana activa, por lo que una segunda baja con el mismo ID no apunta a otra fila tras cambiar los índices. Abrir/ver no escribe datos. No se deduplica por importe: dos pagos iguales siguen siendo eventos independientes.

La baja reintegra únicamente el pago identificado. El alta vuelve a sanear los pagos existentes, con fechas/origen/importe compatibles con la UI anterior, y rechaza colisiones con IDs brutos o derivados. Semanas reabiertas continúan bloqueadas antes del saneamiento. No se migran `weeklyRecords`, ni se cambian los helpers de cierre/reapertura, fórmulas GEM, Taura o datos personales.

## Validaciones ejecutadas

- `TZ=Pacific/Auckland; npm test`: PASS, cuatro scripts existentes y 61/61 tests Node. Tres nuevos casos parametrizados: sin ID, IDs repetidos y colisión entre ID existente y fallback. Ver [log](npm-test.txt).
- `npm run build`: PASS, ver [log](build.txt).
- `git diff --check`: PASS.
- UI: 20/20 PASS en 360 y 1280 px; [log](ui-log.txt), [resultados](ui-results.json). Ocho escenarios nuevos: baja directa y alta/baja/recarga para cada clase legacy, en ambos tamaños. Doble clic reintegra una vez, quedan las otras filas y la recarga conserva las identidades. Los doce escenarios anteriores también pasan. Sin errores de consola/página ni tráfico externo.
- Unitarios: entradas congeladas sin mutación; fechas e importes legacy saneados; baja repetida sin reintegro; origen semanal sin reintegro; cierre/reapertura/recierre conserva registros, pagos brutos, snapshots y reservas; alta/baja reabierta bloqueada.

Reproducción UI tras build (PowerShell):

```powershell
$env:PLAYWRIGHT_MODULE='C:\Users\marco\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright\index.mjs'
$env:VALIDATION_OUTPUT_DIR='docs/validation/aud-01b/legacy-fix'
node scripts/validate-card-payments-ui.mjs
```

Se usó Chrome headless aislado con servidor localhost efímero, fixtures ficticios y sin perfil personal. El sandbox impidió localhost inicialmente; la ejecución final autorizada fuera del sandbox pasó. Se corrigieron dos expectativas del arnés: conservar el historial preexistente al cerrar y sembrar el fixture una sola vez para permitir recargar almacenamiento persistido.

## Límites

El saneamiento se persiste solo tras una edición explícita de la semana activa; no corrige ni migra historial. Conserva los defaults y filtrado de pagos inválidos anteriores (además excluye importes no finitos). No puede reconstruir la identidad original ausente ni conciliar retiros manuales. Continúa sin coordinación entre pestañas/dispositivos y con aritmética monetaria preexistente. Avisos confirmables y demás límites del informe AUD-01B siguen vigentes.

Subida a la misma rama/PR para revisión del director; sin merge ni despliegue de producción.
