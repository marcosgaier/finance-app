# Etapa 1: Pagos y Resumen

Base verificada local y remota: bb1cd129971cf8e5ab9b1ce4d0cc950a84c5a57e.
Misma rama feat/arch-01b3a-demo-editor, PR #16, sin merge.

Comparación directa con Taura original local (d58ad29ea5a9b25d9136e1da959bd0414f46fca1): src/App.tsx, pages/DashboardPage.tsx, pages/PaymentsPage.tsx y workflows.css. Se adopta la jerarquía fecha/estado/horas/neto, el verde existente y KPIs compactos. No se importan hooks, efectos, estilos globales ni controles de cobro del original. Paridad del motor contra upstream fijado independiente 22665a594a0dc8230aa7ed6a28736297a1ed32f2.

Pagos: se elimina el hero duplicado, neto antes del detalle, fecha/estado y horas siempre visibles, details nativos para horas, tratamiento overtime e impuestos/adicionales. Resumen: hero semanal compacto, próximo pago, KPIs 2 columnas móvil/4 escritorio, desglose semanal plegable. Todos los importes, fechas y estados provienen de los mismos cálculos. Pagado sigue siendo explícitamente ficticio y sin confirmar.

Banner sticky ampliado: datos ficticios, no sueldos reales ni depósitos confirmados, sin guardado ni incorporación a Finanzas. Fecha fija, reset y límites en details informativos. Se conservan los nombres accesibles de las vistas y fecha estimada de cobro. CSS aislado en módulo. Revisión react-best-practices: sin nuevos hooks/estado/efectos/dependencias, keys estables, details nativos y foco visible.

Calendario, botonera y autodesselección preservados. Colores del calendario y editor quedan como etapas separadas sujetas a validación visual. Sin cambios a App.jsx, Finance, vendor, fixtures, PAY-01, #32, historial, backups, storage ni Taura real. PR #15 comprobado en 1783afb9edfc731011db0d057561f00fb440f26c.

## Evidencia

- [npm test y paridad ejecutable](npm-test.log), [typecheck](typecheck.log), [build](build.log).
- [Work/Finance](work.log), [resultados](work/ui-results.json): 360/390/1280, ocho pestañas, DOM/estado/scroll/CSS, recuperación, cero efectos nuevos storage/IDB/red/cache/SW/descargas. Disclosures Enter/Space, foco y targets >=44px; 200% CSS zoom escritorio.
- [Editor/calendario](editor.log), [resultado](editor/editor-result.json): selección, preview, conflictos, autodesselección, cancelación/Escape/no-op, actualización de Resumen/Pagos, reset/salida/recarga.
- [Pagos Finance](payments.log): 20 PASS.
- Planificador [escritorio](planning.log) y [móvil](planning-mobile.log): PASS.

| Vista | 360 | 390 | 1280 |
|---|---|---|---|
| Pagos cerrado | [captura · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/payments-summary/work/payments-compact-360.png) | [captura · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/payments-summary/work/payments-compact-390.png) | [captura · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/payments-summary/work/payments-compact-1280.png) |
| Pagos detalle | [captura · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/payments-summary/work/payments-360.png) | [captura · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/payments-summary/work/payments-390.png) | [captura · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/payments-summary/work/payments-1280.png) |
| Resumen | [captura · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/payments-summary/work/summary-360.png) | [captura · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/payments-summary/work/summary-390.png) | [captura · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/payments-summary/work/summary-1280.png) |

Inspección visual: 360px legible, sin solapamientos; neto destacado, explicación inequívoca, jerarquía y contraste conservados (#173e35/blanco, #435e55/fondos claros, banner #59400b/#fff4d7). Capturas 390/1280 disponibles. Antes de esta etapa: evidencia del head base en ../toolbar/work-regression/ (Pagos y calendario).

Adaptaciones semánticas: Próximo pago, Período trabajado y Hours Bank sustituyen etiquetas repetidas; Fecha estimada de cobro permanece como nombre accesible; se abren details antes de comprobar los importes exactos y el tratamiento. Aviso exacto ampliado. No se eliminan aserciones de importes, fechas, no edición/exportación, protección de confirmados ni ausencia de efectos. Fallos iniciales: Chrome restringido sin acceso localhost; aserción antigua del banner; servidor del planificador inaccesible, resuelto sirviendo en 4175. Suites finales PASS.

Reproducir: TAURA_PARITY_ROOT=node_modules/.cache/taura-upstream npm test; npm run typecheck:work; npm run build; git diff --check. Suites browser usan PLAYWRIGHT_MODULE externo y CHROMIUM_PATH a Chrome, VALIDATION_OUTPUT_DIR por suite; planificador PREVIEW_URL a servidor local. Sin nuevas dependencias. Chrome 157, Node 22.23.2, perfiles sintéticos, Pacific/Auckland.

Límites: pruebas locales, no certificación de preview alojada, Android/PWA físico, lector real o zoom nativo. Vercel/SHA se registran en comentario del PR. Rollback: revertir este commit; sin migraciones ni cambios de datos.
