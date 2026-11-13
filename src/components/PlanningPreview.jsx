import React, { useId, useState } from 'react';
const money = value => value == null ? 'Indeterminado' : new Intl.NumberFormat('es-NZ', { style: 'currency', currency: 'NZD' }).format(value / 100);
const empty = () => ({ adjustments: [], assignments: [], obligations: [] });
const amount = value => {
  value = value.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
};
const groups = { weekly: 'Semanal', monthly: 'Mensual (provisión conjunta 7/30)', variables: 'Variable semanal' };
const states = { 'pending-review': 'Pendiente de revisión', excluded: 'Excluida del futuro', 'unknown-income': 'Ingreso desconocido', hypothetical: 'Margen hipotético' };
const incomeLabels = { unknown: 'Sin datos de ingreso', 'explicit-zero': 'Neto estimado cero: puede faltar roster', estimated: 'Ingreso estimado' };
const weekLabels = { unregistered: 'Semana no registrada', active: 'Semana activa', closed: 'Semana cerrada', reopened: 'Semana reabierta' };
const coverageLabel = value => value === 'partial' ? 'Cobertura parcial' : 'Cobertura desconocida';
const button = 'rounded border border-stone-400 px-3 py-2';
function AmountInput({ label, value, onChange }) {
  const id = useId();
  const [text, setText] = useState(value == null ? '' : (value / 100).toString());
  return <label htmlFor={id} className="block">{label} (NZD)
    <input id={id} type="text" inputMode="decimal" value={text}
      onChange={event => { setText(event.target.value); onChange(amount(event.target.value)); }} className="ml-2 w-28 rounded border p-2" />
  </label>;
}
function WeekCard({ income, result, base, assumptions, disabled, onEdit, labels }) {
  const [error, setError] = useState('');
  const [selectedExpense, setSelectedExpense] = useState('');
  const draft = assumptions ?? empty();
  const rows = Object.entries(base).flatMap(([group, values]) => (values ?? []).map(row => ({ ...row, group })));
  const update = next => {
    setError('');
    try { onEdit(income.start, next, false); }
    catch {
      onEdit(income.start, empty(), false);
      setError('El supuesto excede el rango de centavos seguros. Supuestos descartados; revisá nuevamente.');
    }
  };
  const patch = (group, index, change) => update({ ...draft, [group]: draft[group].map((row, i) => i === index ? { ...row, ...change } : row) });
  const remove = (group, index) => update({ ...draft, [group]: draft[group].filter((_, i) => i !== index) });
  const add = (group, row) => update({ ...draft, [group]: [...draft[group], row] });
  const targets = [
    ...rows.filter(row => row.id).map(row => ({ id: row.id, label: labels[row.id] })),
    ...draft.adjustments.flatMap((row, i) => row.targetId ? [] : [{ id: row.id, label: `Gasto adicional ${i + 1}` }]),
    ...draft.assignments.map((row, i) => ({ id: row.id, label: `Asignación ${i + 1} (${row.destination === 'debt' ? 'deuda' : 'ahorro'})` })),
  ];
  const targetLabel = id => targets.find(row => row.id === id)?.label ?? 'Vínculo eliminado';
  const review = () => {
    setError('');
    try { onEdit(income.start, draft, true); }
    catch { setError('No se puede calcular: revisá importes, fechas, vínculos y datos base faltantes. Los importes requieren centavos válidos y no negativos.'); }
  };
  return <article className="min-w-0 space-y-3 rounded-lg border border-stone-300 bg-white p-3" data-testid="planning-week">
    <h3 className="font-bold">{income.start} → {income.end}</h3>
    <p className="text-sm">{disabled ? 'Base de gastos desactualizada' : states[result.state]} · {incomeLabels[income.incomeState]} · {weekLabels[income.weekState]} · {coverageLabel(income.coverage)}</p>
    <dl className="grid grid-cols-2 gap-3" data-testid="week-summary">
      <div><dt>Neto estimado</dt><dd className="font-semibold">{money(income.knownIncomeCents)}</dd></div>
      <div><dt>Gastos</dt><dd>{!disabled && result.expenses ? money(result.expenses.totalCents) : 'Por revisar'}</dd></div>
      <div><dt>Aportes</dt><dd>{!disabled && result.expenses ? `Deuda ${money(result.debtCents)} · Ahorro ${money(result.savingCents)}` : 'Por revisar'}</dd></div>
      <div><dt>Margen hipotético</dt><dd className="font-bold" data-testid="week-margin">{money(disabled ? null : result.marginCents)}</dd></div>
    </dl>
    <details data-testid="week-editor"><summary className="cursor-pointer rounded border border-stone-400 p-3 font-semibold">Revisar esta semana</summary>
    <div className="mt-3 space-y-3">
      <p>{income.periodCount} cobros por fecha de pago · Neto estimado: {money(income.knownIncomeCents)} · {coverageLabel(income.coverage)}</p>
      <p>Días de pago: {income.periods.map(row => row.payDate).join(', ') || 'Sin datos de ingreso; no equivale a cero.'}</p>
      {income.incomeState === 'explicit-zero' && <p>Neto estimado cero: puede faltar roster.</p>}
      <p>Origen de gastos: base del presupuesto, solo lectura. Los reemplazos y aportes son únicamente de esta semana y sesión.</p>
      <details><summary className="cursor-pointer p-2 font-semibold">Ver desglose de gastos base</summary>
      {Object.entries(base).map(([group, values]) => <div key={group}>
        <h4 className="font-semibold">{groups[group]}</h4>
        {!values && <p role="alert">Datos base ausentes; no se asumen cero.</p>}
        {values?.length === 0 && <p>Lista base explícitamente vacía.</p>}
        {values?.map((row, index) => <p key={`${row.id}-${index}`} className="break-words">{labels[row.id] || 'Gasto sin identidad válida'}: {money(row.amountCents)}{row.amountCents == null ? ' · Importe ausente o inválido' : ''}</p>)}
      </div>)}
      </details>
      <fieldset disabled={disabled} className="space-y-3">
        <legend className="font-bold">Supuestos hipotéticos de {income.start}</legend>
        <p>Deuda y ahorro/sobres son salidas adicionales. No ingreses de nuevo un gasto ya contado en el presupuesto. No son recomendaciones de pago.</p>
        <details open><summary className="cursor-pointer p-2 font-semibold">Gastos</summary>
        <div className="space-y-2">
          <label className="block">Gasto a sustituir <select aria-label="Gasto a sustituir" className="block w-full rounded border p-2" value={selectedExpense} onChange={e => setSelectedExpense(e.target.value)}>
            <option value="">Seleccionar gasto</option>
            {rows.filter(row => row.id && !draft.adjustments.some(a => a.targetId === row.id)).map(row => <option key={row.id} value={row.id}>{labels[row.id]}</option>)}
          </select></label>
          <button className={button} type="button" disabled={!rows.some(row => row.id === selectedExpense) || draft.adjustments.some(row => row.targetId === selectedExpense)} onClick={() => {
            const row = rows.find(row => row.id === selectedExpense);
            add('adjustments', { targetId: row.id, amountCents: row.amountCents });
            setSelectedExpense('');
          }}>Sustituir gasto seleccionado</button>
          <button className={button} type="button" onClick={() => add('adjustments', { id: `gasto-${crypto.randomUUID()}`, amountCents: null })}>Agregar gasto hipotético</button>
        </div>
        {draft.adjustments.map((row, i) => <div key={row.targetId ?? row.id} className="rounded border p-2">
          <AmountInput label={row.targetId ? `Reemplazo ${labels[row.targetId]}` : `Gasto adicional ${i + 1}`} value={row.amountCents} onChange={amountCents => patch('adjustments', i, { amountCents })} />
          <button className={button} type="button" onClick={() => remove('adjustments', i)}>Quitar gasto {i + 1}</button>
        </div>)}
        {!draft.adjustments.length && <p>Sin ajustes. Al revisar confirmás explícitamente esta lista vacía.</p>}
        </details>
        <details><summary className="cursor-pointer p-2 font-semibold">Deudas y ahorro</summary>
        <button className={button} type="button" onClick={() => add('assignments', { id: `aporte-${crypto.randomUUID()}`, destination: 'debt', amountCents: null })}>Agregar asignación</button>
        {draft.assignments.map((row, i) => <div key={row.id} className="rounded border p-2">
          <label>Destino asignación {i + 1} <select className="rounded border p-2" value={row.destination} onChange={e => patch('assignments', i, { destination: e.target.value })}>
            <option value="debt">Deuda adicional</option><option value="saving">Ahorro / sobre adicional</option>
          </select></label>
          <AmountInput label={`Asignación ${i + 1}`} value={row.amountCents} onChange={amountCents => patch('assignments', i, { amountCents })} />
          <button className={button} type="button" onClick={() => remove('assignments', i)}>Quitar asignación {i + 1}</button>
        </div>)}
        {!draft.assignments.length && <p>Sin asignaciones. Al revisar confirmás explícitamente esta lista vacía.</p>}
        </details>
        <details><summary className="cursor-pointer p-2 font-semibold">Vencimientos manuales opcionales ({draft.obligations.length})</summary>
          <p>Listas vacías: ninguno revisado. Son anotaciones, no una segunda resta; un margen positivo no declara pagos cubiertos.</p>
          <button className={button} type="button" onClick={() => add('obligations', { id: crypto.randomUUID(), targetId: targets[0]?.id ?? '', dueDate: '', amountCents: null, reviewed: true })}>Agregar vencimiento</button>
          {draft.obligations.map((row, i) => <div key={row.id} className="space-y-2 rounded border p-2">
            <label>Fecha vencimiento {i + 1} <input className="rounded border p-2" type="date" value={row.dueDate} onChange={e => patch('obligations', i, { dueDate: e.target.value })} /></label>
            <label className="block">Gasto o asignación vinculada {i + 1} <select className="max-w-full rounded border p-2" value={row.targetId} onChange={e => patch('obligations', i, { targetId: e.target.value })}>
              <option value="">Seleccionar vínculo</option>{targets.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
            </select></label>
            <AmountInput label={`Vencimiento ${i + 1}`} value={row.amountCents} onChange={amountCents => patch('obligations', i, { amountCents })} />
            <button className={button} type="button" onClick={() => remove('obligations', i)}>Quitar vencimiento {i + 1}</button>
          </div>)}
        </details>
        <div className="flex flex-wrap gap-2">
          <button className={button} type="button" onClick={review}>Revisar y calcular{!draft.assignments.length ? ' · sin asignaciones' : ''}</button>
          <button className={button} type="button" onClick={() => update(empty())}>Restablecer supuestos</button>
        </div>
      </fieldset>
      {error && <p role="alert" className="text-red-800">{error}</p>}
      {!disabled && <div role="status" className="space-y-2">
        <p>Estado: {states[result.state]} · {coverageLabel(result.coverage)}</p>
        {result.expenses && <p>Gastos: semanales {money(result.expenses.fixedCents)} + provisión mensual 7/30 {money(result.expenses.monthlyProvisionCents)} + variables {money(result.expenses.variableCents)} = subtotal {money(result.expenses.totalCents)}. Deuda adicional {money(result.debtCents)}; ahorro adicional {money(result.savingCents)}.</p>}

        {result.obligations.length === 0 && <p>Vencimientos: ninguno revisado.</p>}
        {result.obligations.map((row, i) => <p key={i}>Vencimiento revisado: {row.dueDate} · {targetLabel(row.targetId)} · {money(row.amountCents)}. No implica pago cubierto.
          {income.periods.some(period => row.dueDate < period.payDate) && <strong> Alerta: vencimiento previo al cobro estimado.</strong>}
        </p>)}
        {result.warnings.map((warning, i) => <p key={i}>{warning.message ?? (warning.code === 'DUE_BEFORE_PAY_DATE' ? 'Alerta: vencimiento previo al cobro estimado.' : warning.code)}</p>)}
      </div>}
    </div>
  </details></article>;
}
export function PlanningPreview({ budget, plan, weekCount, onHorizon, onEdit, onRebuild, notice }) {
  const labels = Object.fromEntries(['weeklyExpenses', 'monthlyExpenses'].flatMap(group =>
    (budget?.[group] ?? []).map((row, i) => [row.id, typeof row.name === 'string' && row.name.trim()
      ? row.name.trim() : `${group === 'weeklyExpenses' ? 'Gasto semanal' : 'Gasto mensual'} ${i + 1}`])));
  labels.groceries = 'Supermercado'; labels.fuel = 'Combustible';
  return <section aria-labelledby="planning-title" data-testid="planning-preview" className="space-y-4 border-t pt-4">
    <h2 id="planning-title" className="text-xl font-bold">Planificación (simulación)</h2>
    <p className="rounded border border-amber-300 bg-amber-50 p-3 font-semibold">Estimado, no cobrado, no dinero disponible. Margen hipotético parcial, no saldo bancario, caja ni recomendación operativa. Solo en memoria.</p>
    <label htmlFor="planning-horizon">Horizonte desde próximo martes civil NZ <select id="planning-horizon" className="rounded border p-2" value={weekCount} onChange={e => onHorizon(Number(e.target.value))}>
      {[4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} semanas completas</option>)}
    </select></label>
    <p>{plan.incomePlan.startTuesday} → {plan.incomePlan.endMonday} (martes–lunes). Cambiar horizonte descarta todos los supuestos y requiere revisión.</p>
    {notice && <p role="status">{notice}</p>}
    {plan.stale && <div role="alert"><p>Base de gastos desactualizada: cambió el presupuesto. Resultados detenidos.</p><button className={button} type="button" onClick={onRebuild}>Actualizar base y descartar supuestos</button></div>}
    <div className="grid items-start gap-4 lg:grid-cols-2">{plan.incomePlan.weeks.map((income, i) => <WeekCard key={`${income.start}-${plan.generation}`}
      income={income} result={plan.result?.weeks[i]} base={plan.base} assumptions={plan.assumptions[income.start]}
      disabled={plan.stale} onEdit={onEdit} labels={labels} />)}</div>
    <p role="status" data-testid="planning-total">{plan.result?.totalMarginCents != null ? `Total hipotético parcial del horizonte: ${money(plan.result.totalMarginCents)}` : 'Total/acumulado completo oculto: hay semanas desconocidas, pendientes, excluidas o base desactualizada.'}</p>
    <details><summary>Períodos fuera del rango ({plan.incomePlan.outsidePeriodCount})</summary>
      {plan.incomePlan.outsidePeriods.map(row => <p key={row.periodId}>{row.periodStart} → {row.periodEnd}: cobro {row.payDate} · {money(row.netCents)}</p>)}
    </details>
  </section>;
}
