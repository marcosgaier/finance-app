# INT-03B: margen hipotético en memoria

Alcance aprobado: https://github.com/marcosgaier/taura-roster-pay/issues/13#issuecomment-6864949672

`expensePlanning.js` no está conectado a la UI ni al estado operativo. No lee
almacenamiento, reloj, ingresos reales, deudas, saldos de sobres ni movimientos.

## Contrato

1. Validar el JSON con `await parseTauraPreview(text)`.
2. Crear el calendario con `buildIncomePlan(preview, options)` (INT-03A sin cambios).
3. Obtener una copia permitida con `snapshotPlanningExpenses(financeData)`.
   Solo lee `weeklyExpenses`, `monthlyExpenses`, `variableBudgets.groceries/fuel`.
   Convierte dólares con precisión de centavo; faltantes/invalidaciones quedan
   como `null`, nunca plantillas ni cero automático. Arrays vacíos son explícitos.
4. Llamar `buildExpensePlan(incomePlan, snapshot, assumptions)`.

`assumptions` usa la fecha `week.start` como clave. Cada semana requiere:

```js
{
  reviewed: true,
  adjustments: [
    { targetId: 'rent', amountCents: 50000 }, // reemplaza, no suma dos veces
    { id: 'repair', amountCents: 2000 } // gasto adicional semanal
  ],
  assignments: [
    { id: 'manual-debt', destination: 'debt', amountCents: 1000 },
    { id: 'extra-saving', destination: 'saving', amountCents: 500 },
    // Financiar un gasto ya contado no añade otra salida:
    { id: 'fund-repair', destination: 'saving', amountCents: 2000, fundingExpenseId: 'repair' }
  ],
  obligations: [
    { targetId: 'rent', reviewed: true, dueDate: '2026-09-23', amountCents: 50000 }
  ]
}
```

Arrays vacíos expresan revisión sin ajustes/asignaciones/vencimientos conocidos.
Las identidades económicas deben ser únicas entre gastos y asignaciones; los
sobres que financian gastos existentes deben usar `fundingExpenseId`. No se
deducen equivalencias entre nombres, ni reglas GEM/BBVA. Los vencimientos son
anotaciones explícitas, no una segunda resta. Importe/fecha/revisión ausentes
bloquean el margen; `DUE_BEFORE_PAY_DATE` solo avisa, no confirma cobertura.
No se infieren vencimientos mensuales a partir de la provisión.

## Aritmética y límites

`E = fijos + round(sumaMensualCentavos × 7/30) + variables`.
`M = netosEstimadosIncluidos - E - deudaManual - ahorroManual`.
Los reemplazos mensuales conservan su periodicidad; las adiciones son semanales.
Todas las sumas y el prorrateo usan enteros exactos (BigInt internamente); la
salida exige enteros seguros y lanza error por overflow. M puede ser negativo.

Cada margen calculado conserva `coverage: partial` y las advertencias de INT-03A.
La revisión manual de gastos no certifica que Taura contenga todos los cobros.
Un cero explícito permite un margen hipotético con advertencia de roster; ingreso
ausente devuelve `unknown-income`. Supuestos incompletos devuelven
`pending-review`; semanas operativas cerradas, activas o reabiertas, `excluded`.
Sus ingresos/márgenes quedan `null`.

El acumulado comienza en cero solo como suma teórica de márgenes. Una semana
desconocida, excluida o pendiente lo vuelve `null` para todo el resto del horizonte
y para `totalMarginCents`, aunque posteriores márgenes individuales sean conocidos.
Nunca representa saldo bancario, fondos disponibles, conciliación o recomendación.

Sin UI, guardado, escenarios avanzados ni INT-03C. Pruebas exclusivamente sintéticas.
