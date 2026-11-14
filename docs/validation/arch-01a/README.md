# ARCH-01A — contrato Taura → Finance, fase 0

Alcance: [issue #24](https://github.com/marcosgaier/taura-roster-pay/issues/24), basado en [ARCH-01](https://github.com/marcosgaier/taura-roster-pay/issues/23). Solo tests, fixture sintético y documentación en Finance; sin cambios a src, package.json, dependencias, UI, configuración, persistencia ni Taura.

## Fuentes y procedencia

- Base Finance main vigente al crear rama: `cef55063b7cd038fc623a23e3479d053ed236249`.
- Taura main verificado: `22665a594a0dc8230aa7ed6a28736297a1ed32f2`.
- Productor: [src/services/incomeProjections.ts](https://github.com/marcosgaier/taura-roster-pay/blob/22665a594a0dc8230aa7ed6a28736297a1ed32f2/src/services/incomeProjections.ts); [contrato v1](https://github.com/marcosgaier/taura-roster-pay/blob/22665a594a0dc8230aa7ed6a28736297a1ed32f2/docs/income-projections-v1.md).
- SHA-256 de los bytes UTF-8/LF del productor ejecutado: `5152a593238218f6a2470a423d2180bcd5c87f2c5201b8348838a0b12fae0974`.
- Consumidor sin modificar: `src/services/tauraPreview.js` (`parseTauraPreview`, `revisionFor`, `destinationWeek`) e `incomePlanning.js` (`buildIncomePlan`, `nextPlanningTuesday`). Se revisaron las suites existentes taura-preview e income-planning antes de añadir esta prueba cruzada.

`scripts/arch-01a-producer-fixture.mjs` transpila con esbuild (ya disponible a través de Vite) **el exportador real externo sin modificarlo**, y lo ejecuta en Node sobre agregados inventados congelados. No copia el exportador ni motor al repo ni carga App, useRoster, repositorios o storage Taura. La única escritura opcional `--write` es el fixture ficticio `scripts/fixtures/arch-01a-taura-v1.json`; `--check` no escribe y exige equivalencia determinista con ese fixture, además de aceptarlo con el parser real Finance. Solo normaliza CRLF→LF al comparar el archivo guardado, para soportar checkout Windows.

Los siete períodos usan entradas sintéticas explícitas: bruto 1200.17, PAYE 200.03, KiwiSaver 36.01, neto 964.13, más un período cero; no se calculan tasas ni nómina alternativa. Se prueba serialización/contrato, **no la corrección fiscal o salarial de esos agregados**. Mismo payDate para distintos períodos es una entrada deliberada para probar agrupación; no se afirma que sea el calendario normal del motor Taura. Fecha de exportación fija: 2026-11-14T00:00:00.000Z. El checkout local Taura estaba en otra revisión: no se usó como productor ni se actualizó; se obtuvo el archivo remoto fijado a la SHA indicada en un temporal externo.

## Comandos reproducibles

Desde Finance con sus dependencias existentes y Node 22 (ejecutado v22.23.2):

```powershell
$env:TZ='Pacific/Auckland'
node --test scripts/arch-01a-contract-tests.mjs
npm test
npm run build
git diff --check
```

El nuevo test offline no requiere red, Taura instalado, deployment, navegador ni perfil. No se cambia package.json: el comando Node directo es suficiente y debe ejecutarse junto a npm test para revisar ARCH-01A; **npm test por sí solo no incorpora esta nueva suite**.

Para reproducir el productor, guardar fuera del repo los bytes UTF-8 de la URL raw fijada:

`https://raw.githubusercontent.com/marcosgaier/taura-roster-pay/22665a594a0dc8230aa7ed6a28736297a1ed32f2/src/services/incomeProjections.ts`

Luego, sustituyendo la ruta externa correspondiente:

```powershell
node scripts/arch-01a-producer-fixture.mjs C:/ruta/externa/incomeProjections.ts --check
```

`--write` regenera únicamente el fixture, para revisión consciente; no usarlo para ocultar un fallo de compatibilidad. El script muestra el hash de fuente y compara dos ejecuciones idénticas. Para evaluar un cambio futuro, proporcionar el productor de la nueva SHA: un formato inválido falla con `Taura → Finance contract incompatible`; una salida diferente aunque válida falla con `Producer drift`. Revisar contrato y actualizar procedencia solo tras decidir compatibilidad. La suite offline protege el consumidor contra cambios usando el fixture fijado; no puede observar por sí sola cambios remotos. Este gate de productor es explícito, no una sincronización automática ni una nueva configuración CI.

## Matriz de invariantes

| Invariante | Prueba/aserción |
|---|---|
| V1 real y centavos exactos | 7 ítems, bruto 120017 y neto 96413; deducciones una vez, ACC incluido. |
| Revisión íntegra | Hash calculado independientemente con node:crypto y contrastado con revisionFor; corrupción rechazada. |
| Solo campos permitidos/estimados | Mutaciones de versión, campos de envelope/item/rules/deductions y paid/confirmed fallan, incluso resignadas correctamente. |
| Cobro vs período trabajado | Períodos de 06/09 y 13/09 pagan 28/09; destino 22/09, no sus semanas de trabajo. |
| Calendario civil | Lunes/martes; 29/09→05/10, 04/01→05/01; inicio/fin DST NZ y nextPlanningTuesday con instantes explícitos. |
| Agregación sin duplicar | Dos períodos mismo payDate suman 192826 centavos; duplicado idéntico omitido; totales del horizonte 289239. |
| Cero ≠ ausencia | Semana cero explicit-zero/0 con advertencia; semana ausente unknown/null. Cobertura siempre parcial. |
| Cambio fecha/revisión | payDate cambia hash y semana, conserva periodId; lote con dos revisiones del mismo período falla. Cambio de importe también es conflicto; generatedAt no cambia revisiones. |
| Rechazo seguro | JSON corrupto, backups Finance/Taura, >1 MiB UTF-8, 0/105 ítems, fecha inexistente, centavos fraccionarios, neto inconsistente o ausente. |
| Histórico y reapertura | Metadata congelada intacta, semanas closed/reopened excluidas, eligibleKnownIncomeCents=0. |
| Sin efectos laterales | Entradas profundamente congeladas, comparaciones antes/después, salida separada; browser storage y fetch bloqueados antes de importar módulos. Productor aislado tiene los mismos guardas. |

## Resultados reales

- Nuevo script: **9/9 PASS**, sin skips ([contract-tests.txt](contract-tests.txt)).
- `npm test`: cuatro scripts existentes y **61/61 Node PASS** ([npm-test.txt](npm-test.txt)).
- `npm run build`: **PASS** ([build.txt](build.txt)).
- Exportador real `--check`: **PASS**, fixture reproducido determinísticamente y parser compatible ([producer-check.txt](producer-check.txt)).
- Prueba adversarial adicional: copia temporal del exportador con `status:'confirmed'` en lugar de estimated, sin otro cambio; `--check` devuelve error y mensaje legible de contrato incompatible. El original y Taura permanecen intactos ([adversarial-check.txt](adversarial-check.txt)).
- `git diff --check`: **PASS**.

No se ejecutó E2E de UI: no hay cambios de UI ni requisito de deployment en esta fase. Los tests no leen datos personales ni browser storage; las salidas son exclusivamente sintéticas. Los guardas cubren las APIs browser/red indicadas, no constituyen un sandbox para ejecutar código externo no confiable. Solo se ejecutó el exportador revisado/fijado y su mutación controlada.

## Fuera de alcance / límites

El contrato v1 sigue siendo solo proyección, no depósito, y no identifica una instalación global. No se infiere recencia por hash ni generatedAt. No hay motor duplicado, shell, proveedor sobre datos reales, migración, cambios GEM/PAYE ni confirmación de ingresos. No se modifica realIncome, INC-01 ni ARCH-01B. Las limitaciones fiscales y de fechas del productor siguen vigentes; esta prueba verifica interoperabilidad, no certifica sueldo ni saldos bancarios. PR independiente para revisión, sin merge.
