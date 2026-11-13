# INT-03C1 — conexión interna en memoria

Alcance: [Taura #15](https://github.com/marcosgaier/taura-roster-pay/issues/15).
Base: Finance main `b849997c59d52ea67dd93bbf4ef30fdd49bd3598` (PR #3 y #4 fusionados).

## API disponible, aún sin montar en React

`createPlanningSession()` en `src/services/planningSession.js` es un controlador
interno por vida de página. No importa React, almacenamiento, red, reloj implícito
ni funciones financieras. No acepta callbacks financieros. No modifica el visor,
Dashboard, contrato v1 ni sus textos/controles; no hay pantalla ni wiring nuevo.
La conexión visible y la verificación E2E de la futura pantalla pertenecen a C2.

La secuencia testeada es el mismo validador `parseTauraPreview` → sesión validada →
`buildIncomePlan` → `snapshotPlanningExpenses` → `buildExpensePlan`. Nunca entregar
JSON crudo a `acceptValidated`: la validación sigue siendo responsabilidad del
importador existente, sin parser alternativo. El reloj explícito `nowMs` calcula
el próximo martes NZ; `weekCount` admite 4..8, predeterminado 4. Los metadatos de
semanas operativas se copian por allowlist para excluir activas/cerradas/reabiertas.
El presupuesto solo aporta weeklyExpenses/monthlyExpenses y groceries/fuel.

## Contrato para la futura integración C2 (no implementada aquí)

Mantener una única instancia mediante `useRef` dentro del visor montado. No
recrear al navegar pestañas. Mantener el guard `request.current` existente:

1. Al seleccionar/reemplazar, incrementar `request.current` y llamar
   `beginImport()` inmediatamente, antes del tamaño/lectura/validación. Guardar
   su token junto con la selección. Esto elimina todo el escenario previo.
2. Reutilizar `await parseTauraPreview(await file.text())`. Solo si sigue vigente
   `request.current`, llamar `acceptValidated(token, preview, budget, options)`.
   El token interno también rechaza finalizaciones obsoletas y es de un solo uso.
3. En catch vigente, llamar `rejectImport(token)`; al descartar, incrementar el
   request existente y llamar `discard()`. Nunca aceptar una validación anterior
   tras un descarte. En refresh se crea una instancia vacía. No serializar.
4. Pasar solo una copia permitida de presupuesto, sin `setFinanceData`.
   Ejecutar `checkBudget` al cambiar esa fuente y antes de consumir resultados.
   Una diferencia invalida el resultado (`null`), desmarca revisiones y conserva
   ajustes como borrador junto al snapshot anterior (`stale: true`). No se
   recupera automáticamente si el presupuesto vuelve al valor previo.
5. `rebuildBudget` es una acción manual explícita: recrea el snapshot y borra
   todas las revisiones/ajustes. No recalcula un escenario como ya revisado.

La API no observa React ni cambios externos por sí sola. El consumidor debe
cumplir estos eventos; por eso no se afirma una pantalla integrada en esta etapa.

## Supuestos y resultados

`read()` devuelve una copia desacoplada de `{ incomePlan, base, assumptions,
stale, result }`, o `null` si no hay sesión. Todos los valores devueltos son copias.
`editWeek(start, draft)` reemplaza el borrador completo y desmarca revisión;
`draft` debe incluir arrays explícitos `adjustments`, `assignments`, `obligations`
con el contrato de INT-03B. `reviewWeek(start)` es la acción consciente separada;
solo confirma si todos los supuestos son válidos. Si falla no cambia el estado.
No se autoconfirma al importar, editar, navegar ni reconstruir.

Los resultados conservan cobertura parcial, cero explícito frente a ausencia,
márgenes negativos, centavos seguros, exclusiones y acumulado bloqueado por
huecos. Son márgenes hipotéticos, nunca saldos, pagos ni recomendaciones.

## Financiación y vencimientos

La futura UI V1 deberá ofrecer solo aportes adicionales, sin exponer
`fundingExpenseId`. El motor puro conserva vínculos válidos para consumidores
internos, pero ahora marca `pending-review` y margen `null` si:

- El gasto no existe, su importe es inválido o la identidad es ambigua.
- Un vínculo o la suma de vínculos supera el gasto semanal efectivo, después
  de ajustes. La suma se verifica en BigInt, sin overflow silencioso.
- Se repite la combinación gasto + destino debt/saving, aunque los IDs de
  asignación sean diferentes. Los IDs duplicados ya eran inválidos.
- El gasto es mensual: `assignment.monthlyFundingUnsupported`. No se compara
  contra el mensual bruto ni se inventa un reparto del redondeo global 7/30.

Vínculos válidos no restan de nuevo un gasto ya provisionado. No cambian GEM,
BBVA, saldos ni reglas operativas.

Cada semana de `buildExpensePlan` ahora devuelve `obligations`: copia permitida
de todas las obligaciones con fecha/importe/target válidos y revisión explícita
de obligación y semana. Incluye posteriores al cobro y fuera de esa semana;
el consumidor puede listarlas sin inferir cobertura. La alerta
`DUE_BEFORE_PAY_DATE` conserva su alcance original dentro de la semana.
Las obligaciones nunca son una segunda deducción. Una semana con otros errores
puede listar metadatos revisados, pero su `state/pending` sigue bloqueando margen.

## Validación y límites

`npm test` incluye fixtures exclusivamente sintéticos y el controlador real:
4/8 semanas, revisión, invalidación, tokens obsoletos, staleness, copias profundas,
getters prohibidos para datos operativos y APIs de Storage/IDB/red. Las suites
existentes cubren cero/ausencia, exclusión, centavos, negativos y overflow.
Los tests de motor añaden financiación excesiva/duplicada/mensual/ausente y
listado desacoplado de vencimientos antes/después del cobro.

La regresión del visor existente se ejecuta en Chromium con perfil temporal,
fixture sintético y tráfico externo bloqueado. Ver evidencia en
`docs/validation/int-03c1/`. Esta regresión verifica la UI existente; el ciclo
de la nueva API se prueba directamente, ya que no se expone en producción.
No certifica deployment/PWA ni otros navegadores. No se inició C2.
