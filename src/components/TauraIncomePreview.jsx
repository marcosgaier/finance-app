import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPlanningSession } from '../services/planningSession.js';
import { PlanningPreview } from './PlanningPreview.jsx';
import { MAX_PREVIEW_BYTES, parseTauraPreview, previewRows } from '../services/tauraPreview.js';

const money = cents => new Intl.NumberFormat('es-NZ', { style: 'currency', currency: 'NZD' }).format(cents / 100);
const workLabels = { projected: 'Proyectado', partially_worked: 'Parcialmente trabajado', worked: 'Trabajado (no implica cobrado)' };

// Only allowlisted read-only budget/week metadata; no finance setter or restore API.
export function TauraIncomePreview({ weeklyRecords = [], activeWeek = null, budget }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const session = useRef(null);
  if (!session.current) session.current = createPlanningSession();
  const [plan, setPlan] = useState(null);
  const [weekCount, setWeekCount] = useState(4);
  const [notice, setNotice] = useState('');
  const metadata = JSON.stringify({ weeklyRecords: weeklyRecords.map(row => ({
    weekStartDate: row.weekStartDate, weekDate: row.weekDate, reopenedFromHistory: row.reopenedFromHistory,
  })), activeWeek: activeWeek && { weekStartDate: activeWeek.weekStartDate,
    weekDate: activeWeek.weekDate, reopenedFromHistory: activeWeek.reopenedFromHistory } });
  // Before paint: never display a margin from a closed/reopened week or stale base.
  useLayoutEffect(() => {
    if (!preview) return;
    const previous = session.current.read();
    session.current.checkBudget(budget);
    const next = session.current.configure(preview, { weekCount, ...JSON.parse(metadata) });
    if (previous && JSON.stringify(previous.incomePlan) !== JSON.stringify(next.incomePlan)) {
      setNotice('Horizonte o semanas operativas cambiaron: supuestos descartados; revisá nuevamente.');
    }
    setPlan(next);
  }, [preview, budget, weekCount, metadata]);
  const input = useRef(null);
  function discard() {
    request.current++;
    session.current.discard();
    setPlan(null);
    setNotice('');
    setPreview(null);
    setError('');
    setBusy(false);
    if (input.current) input.current.value = '';
  }
  async function selectFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const selection = ++request.current;
    const token = session.current.beginImport();
    setPlan(null);
    setNotice('');
    setPreview(null);
    setError('');
    setBusy(true);
    try {
      if (file.size > MAX_PREVIEW_BYTES) throw new Error('Archivo demasiado grande (máximo 1 MiB).');
      const next = await parseTauraPreview(await file.text());
      if (selection === request.current) {
        session.current.acceptValidated(token, next, budget, { nowMs: Date.now(), weekCount,
          ...JSON.parse(metadata) });
        setPreview(next);
        setPlan(session.current.read());
      }
    } catch (cause) {
      if (selection === request.current) {
        session.current.rejectImport(token);
        setPlan(null);
        setPreview(null);
        setError(cause.message || 'No se pudo leer el archivo.');
      }
    } finally {
      if (selection === request.current) setBusy(false);
      event.target.value = '';
    }
  }
  const rows = preview ? previewRows(preview, weeklyRecords, activeWeek) : [];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return (
    <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm" aria-labelledby="taura-title">
      <h2 id="taura-title" className="text-xl font-bold">Ingresos Taura · vista previa temporal</h2>
      <p className="rounded border border-amber-300 bg-amber-50 p-3 font-semibold">Estimado / no cobrado. No es dinero disponible para gastar. Cobertura salarial y fiscal incompleta.</p>
      <p>Seleccioná el JSON v1 de «Exportar ingresos estimados» de Taura (máximo 1 MiB, 104 períodos). Solo se muestra en memoria; podés descartarlo o refrescar la página.</p>
      <p className="text-sm text-stone-600">Cada selección reemplaza toda la vista previa, incluso si el archivo se rechaza. No se acumulan archivos ni revisiones. El origen taura-local no identifica una instalación; la fecha de generación y el hash no prueban cuál revisión es más reciente.</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="font-semibold" htmlFor="taura-file">{preview ? 'Reemplazar archivo de estimaciones' : 'Seleccionar archivo de estimaciones'}</label>
        <input ref={input} id="taura-file" type="file" accept=".json,application/json" onChange={selectFile} className="max-w-full text-sm" />
        <button type="button" onClick={discard} className="rounded border border-stone-400 px-4 py-2">Descartar vista previa</button>
      </div>
      {busy && <p role="status">Validando archivo…</p>}
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {!preview && !busy && <p className="text-stone-600">Sin estimaciones en esta sesión.</p>}
      {preview && <div className="space-y-4" data-testid="taura-preview">
        <p>Origen: {preview.sourceId} · {preview.sourceRevision}<br />Generado: <time dateTime={preview.generatedAt}>{preview.generatedAt}</time> (UTC) · NZD · Pacific/Auckland</p>
        <p role="status">{rows.length} períodos únicos · {preview.duplicates} repeticiones idénticas omitidas. Los períodos ausentes no equivalen a cero ni eliminan datos.</p>
        {(Date.now() - Date.parse(preview.generatedAt) > 30 * 86400000 || Date.parse(preview.generatedAt) > Date.now()) && <p className="text-amber-900">Generación antigua (más de 30 días) o futura: revisá manualmente la vigencia. No se determina recencia por hash.</p>}
        {rows.map((item, index) => <article key={item.periodId} className="space-y-2 rounded border border-stone-300 p-3">
          <h3 className="font-bold">Período trabajado: {item.periodStart} → {item.periodEnd} (domingo–sábado)</h3>
          <p>{workLabels[item.workStatus]} · Estimado / no cobrado</p>
          <p>Fecha de cobro estimada: <strong>{item.payDate}</strong><br />Semana destino Finance: <strong>{item.week.start} → {item.week.end}</strong> (martes–lunes)</p>
          <p className="font-semibold text-amber-900">{item.weekState}{item.weekState.includes('cerrada') || item.weekState.includes('reabierta') ? ': solo consulta; no se modifica.' : ''}</p>
          {item.payDate < today && <p className="text-amber-900">Fecha de cobro pasada; no acredita un pago real. Revisá esta proyección.</p>}
          {index > 0 && Date.parse(item.periodStart) - Date.parse(rows[index - 1].periodStart) > 7 * 86400000 && <p className="text-amber-900">Hay períodos omitidos entre estas estimaciones: cobertura temporal incompleta.</p>}
          <dl className="grid gap-2 sm:grid-cols-2">
            <div><dt>Bruto estimado</dt><dd>{money(item.grossCents)}</dd></div>
            <div><dt>PAYE estimado (incluye ACC)</dt><dd>{money(item.deductions.payeCents)}</dd></div>
            <div><dt>KiwiSaver estimado</dt><dd>{money(item.deductions.kiwiSaverCents)}</dd></div>
            <div><dt>Neto estimado / no cobrado</dt><dd className="font-bold">{money(item.netCents)}</dd></div>
          </dl>
          <details><summary className="cursor-pointer font-semibold">Advertencias y reglas de cálculo</summary>
            <ul className="ml-5 list-disc text-sm">{item.warnings.map(warning => <li key={warning.code}>{warning.message}</li>)}</ul>
            <p className="mt-2 text-sm">Motor {item.rulesSnapshot.engineVersion}; código aplicado {item.rulesSnapshot.taxCode}; año {item.rulesSnapshot.taxYear}; código configurado {item.rulesSnapshot.configuredTaxCode ?? 'ausente'}; Student Loan solicitado: {item.rulesSnapshot.studentLoanRequested ? 'sí (no calculado)' : 'no'}. Reglas actuales, no históricas.</p>
            <p className="break-all text-xs">{item.periodId} · Revisión opaca: {item.revision}</p>
          </details>
        </article>)}
      </div>}
      {preview && plan && <PlanningPreview plan={plan} weekCount={weekCount}
        onHorizon={setWeekCount} notice={notice}
        onRebuild={() => { setPlan(session.current.rebuildBudget(budget)); setNotice('Base actualizada; supuestos descartados.'); }}
        onEdit={(start, draft, review) => {
          session.current.editWeek(start, draft);
          setPlan(session.current.read());
          if (review) setPlan(session.current.reviewWeek(start));
        }} />}
    </section>
  );
}
