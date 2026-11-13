# INT-03A — API de ingresos proyectados (sin UI)

Alcance: [issue #12](https://github.com/marcosgaier/taura-roster-pay/issues/12),
con [aprobación por etapas](https://github.com/marcosgaier/taura-roster-pay/issues/11#issuecomment-6864600822).
El módulo no está conectado a la app. No calcula gastos, deudas, sobres, margen,
acumulados ni fondos disponibles; no lee ni escribe persistencia.

```js
import { parseTauraPreview } from '../src/services/tauraPreview.js';
import { nextPlanningTuesday, buildIncomePlan } from '../src/services/incomePlanning.js';

const preview = await parseTauraPreview(jsonText);
const plan = buildIncomePlan(preview, {
  startTuesday: nextPlanningTuesday(clockInstantMs),
  // weekCount: 4, // entero 4..8, predeterminado 4
  // weeklyRecords: [{ weekStartDate: '2026-11-24' }],
  // activeWeek: { weekDate: '2026-12-01', reopenedFromHistory: true },
});
```

`nextPlanningTuesday` requiere un instante numérico en milisegundos desde epoch,
interpreta el día en Pacific/Auckland mediante Intl y devuelve el martes
**estrictamente siguiente** (martes actual → +7 días). No consulta el reloj.
`buildIncomePlan` requiere un martes civil real YYYY-MM-DD; permite fechas
pasadas para consulta. Usa días civiles UTC para la aritmética del calendario,
sin depender del TZ del host ni de semanas de 168 horas en NZ. No cambia
`destinationWeek`. El horizonte completo debe caber en el calendario de 4 dígitos.

La precondición obligatoria es pasar el resultado de `parseTauraPreview`, no el
JSON crudo ni un objeto de forma similar. Solo ese validador decide contrato,
hash, duplicados idénticos y conflictos; no se agrega otro importador permisivo.
Un cálculo usa una única sesión validada y reemplaza al anterior. No conserva
estado, combina archivos, ordena hashes ni interpreta generatedAt como recencia.

## Resultado para una futura fase B

- `weeks`: exactamente 4..8 filas completas martes–lunes. Cada `periods` contiene
  copias profundas de los ítems validados: identidad, rango trabajado, payDate,
  revisión opaca, reglas y advertencias originales. Se agrupa únicamente por
  payDate, sumando centavos enteros sin convertir a dólares.
- `incomeState`: `unknown` sin ítems (`knownIncomeCents: null`), `explicit-zero`
  si la suma de los ítems es cero, o `estimated` si es positiva. Un cero individual,
  incluso junto a otro ítem positivo, añade `ZERO_MAY_BE_INCOMPLETE_ROSTER`.
  Nunca equivale a «sin sueldo confirmado» ni habilita weeklyIncome de respaldo.
- `coverage`: `unknown` sin ítems, `partial` con ítems. La cobertura global siempre
  es `partial`: una selección de períodos no prueba exhaustividad. `warnings`
  de cada fila agrega avisos de selección/cero; las advertencias salariales
  originales permanecen en cada período. Todo ingreso sigue siendo estimado.
- `weekState`: `unregistered`, `active`, `closed` o `reopened`. Se compara solo
  weekStartDate (o weekDate legacy) de los metadatos recibidos; reapertura activa
  tiene precedencia, luego histórico cerrado, luego activa. Todas las filas son
  `readOnly`; cualquier semana registrada tiene `excludedFromFuture: true`,
  incluso activa con ingreso cero o sin ingreso registrado. No se inspecciona
  realIncome, no se confirma cobro ni se infiere conciliación.
- `outsidePeriods` / `outsidePeriodCount`: períodos completos fuera del horizonte,
  con `position: before|after` y `destinationWeek`; excluidos de todos los subtotales.
- `totals.knownIncomeCents`: subtotal conocido dentro del horizonte, incluidas
  las filas registradas solo como referencia. `eligibleKnownIncomeCents`: subtotal
  conocido de filas no registradas. Ambos son **subtotales del archivo**, nunca
  ingreso completo del horizonte, margen o caja. Cero con cero semanas con datos
  es la suma vacía del subtotal; las filas siguen desconocidas.
- `periodCount`, `weeksWithItems`, `unknownWeekCount`, `excludedWeekCount` en
  `totals` permiten mostrar cobertura/exclusiones sin sustituir ingresos faltantes.
  Los conteos de períodos del horizonte no incluyen outsidePeriods.

Toda suma semanal y del horizonte se comprueba con Number.isSafeInteger;
overflow lanza error y no devuelve un resultado parcial, incluso si la semana
que causa el exceso está excluida. Las entradas no se mutan y los metadatos de
salida no comparten objetos anidados con la sesión original.

La fase B deberá revisar sus propios supuestos e incertidumbre antes de calcular
escenarios. Estos subtotales no aprueban inclusión automática de períodos con
Student Loan/código configurado incompatible. No extrapolar semanas sin datos
ni extender la cobertura fiscal del validador (M/2026–27). No hay función de
confirmación, persistencia, conciliación ni recomendaciones de pago.

## Validación sintética

`npm test` incorpora `scripts/income-planning-tests.mjs`, con fixtures en memoria
que pasan por el validador v1 y hashes reales. Cubre próximo martes NZ, límites
martes/lunes, 4..8, varios períodos, cero/ausencia, cobertura parcial, duplicados,
conflictos, reemplazo/payDate, exclusiones, mes/año/bisiesto/DST, tres TZ de host,
overflow semanal/global, entradas inválidas, congelación profunda, copias de
salida y prohibición de acceso a almacenamiento/red/reloj implícito.

Regresión requerida: `npm test`, `npm run build`, `git diff --check` con Node 22.
Finance no tiene script lint. La UI y los motores existentes no se modifican.
