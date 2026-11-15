# Punto 2 — edición de turnos trabajados

PR #16, rama existente `feat/arch-01b3a-demo-editor`, sin merge.
HEAD remoto y local verificados antes de editar: `82633ff20d5e26ba0389711f7ff375c85f8d3e79`.

## Resultado

- «Marcar como trabajado» cambia solo el borrador, campo por campo con `??`: nunca sustituye valores reales existentes, incluidos cero y notas vacías. Permite día/noche/custom planificado/trabajado/modificado; conserva modificado. Libre, licencias, cancelado y estados protegidos no permiten esta acción.
- Cálculo explícito de horas planificadas o trabajadas: instantes Pacific/Auckland, segundos sin redondeo intermedio, descanso del grupo correspondiente (real ausente = 0, como Taura), validación de fecha/inicio/fin y máximo contractual existente. Rechaza horas civiles ambiguas/inexistentes por DST. Noche de primavera = 11 h; otoño = 13 h transcurridas y requiere 1 h de descanso para 12 h pagadas. No recorta silenciosamente.
- Notas planificadas/reales editables en desplegables; comparación compartida con detalle del día, diferencia firmada y «Sin horas reales / Pendiente» cuando faltan horas. Cero real es un dato y muestra diferencia.
- Tipo/plantillas quedan deshabilitados si existe cualquier dato real, para evitar borrarlo. Metadatos originales se conservan. Duplicar limpia también `actual_notes`, igual que el comportamiento upstream.
- Solo Guardar pasa por `validateDraft` y `commitDraft` existentes. Cerrar/Escape descartan acciones y notas. Sin nuevos efectos, persistencia, red ni confirmaciones de salario real.

Referencias revisadas en Taura original, solo lectura: `ShiftEditor.tsx`, `DayDetails.tsx`, `useRoster.ts`. Se adapta su copia nullish y cálculo explícito al perímetro demo y la validación NZ más estricta de Finance. Revisados también `RosterPage.tsx`, `shiftDraft.ts` y `DayDetails.tsx` de Finance; el punto de commit seguro permanece intacto.

## Evidencia visual

Capturas reales del build, Chrome 157.0.8103.52 / Node 22.23.2, timezone Pacific/Auckland, viewport de 900 px de alto. Antes capturado sobre dist del HEAD inicial, antes de construir los cambios; después sobre build final. Inspección visual de capturas antes/después y datos reales abiertos: controles legibles, sin desbordamiento horizontal, pie Guardar/Cerrar accesible, scroll interno al desplegar opcionales. Altura del diálogo limitada a 88dvh.

| Ancho | Antes | Después | Datos reales abiertos y foco | Guardado y notas |
| --- | --- | --- | --- | --- |
| 360 | [Antes](before/editor-360.png) | [Después](after/editor-360.png) | [Trabajado](after/worked-editor-360.png) | [Detalle](after/worked-saved-360.png) |
| 390 | [Antes](before/editor-390.png) | [Después](after/editor-390.png) | [Trabajado](after/worked-editor-390.png) | [Detalle](after/worked-saved-390.png) |
| 1280 | [Antes](before/editor-1280.png) | [Después](after/editor-1280.png) | [Trabajado](after/worked-editor-1280.png) | [Detalle](after/worked-saved-1280.png) |

## Verificación

- [npm test](npm-test.log): PASS, Finance y 16 pruebas editor/batch/overtime; incluye paridad independiente de bytes y ejecución con upstream fijo (`TAURA_PARITY_ROOT=node_modules/.cache/taura-upstream`). Casos nuevos: copia nullish, cada campo real parcial/ceros/notas vacías, idempotencia, metadatos anidados, sin mutación sobre objetos congelados, día/noche, DST otoño/primavera, segundos, descanso, 12 h, horarios inválidos y protecciones. Comparación sin horas/cero/diferencia y escape HTML de notas.
- [typecheck:work](typecheck.log), [build](build.log), [diff-check](diff-check.log): PASS.
- [Editor responsive](editor.log), [resultado](after/editor-result.json): PASS 360/390/1280. Flujo adicional implementado en `scripts/validate-work-editor-ui.mjs`: calcular plan con 0.5 h de descanso, copiar notas al marcar, Escape sin guardar, guardar datos reales parciales de cero, reabrir y marcar sin sobrescribirlos, calcular reales, notas distintas, diferencia -1 h, guardar/reabrir/cerrar descartando cambios. Targets visibles >=44x44, foco visible mediante Tab/Shift+Tab, Enter y disclosures nativos. Batch, identidad, conflictos, atomicidad, pay/bank/pay, resumen/pagos, reset/salida/reload y cero efectos Work siguen cubiertos.
- [Work/Finance](work.log): PASS 360/390/1280; ocho pestañas Finance, DOM/CSS/scroll/estado/retorno/recovery, sin cambios de storage/history del módulo.
- [Pagos Finance](payments.log): 20 PASS.
- Planificador [escritorio](planning.log) y [móvil](planning-mobile.log): PASS, `externalRequests: []`, `consoleErrors: []`.

Para reproducir: `npm test`, `npm run typecheck:work`, `npm run build`, `git diff --check`.
UI: `PLAYWRIGHT_MODULE` apunta a Playwright externo (index.mjs), `CHROMIUM_PATH` a Chrome instalado y `VALIDATION_OUTPUT_DIR` a una carpeta de evidencia. Ejecutar `npm run test:work-editor-ui`, `npm run test:work-ui`, `npm run test:payments-ui`. Planificador: servidor aislado `scripts/serve-dist.mjs`, `PREVIEW_URL` a localhost, `node scripts/validate-planning-ui.mjs`, y repetir con `MOBILE=1`. Sin dependencias nuevas.

Revisión React con skill react-best-practices: estado de borrador clonado, funciones puras, sin efectos nuevos, componentes con controles nativos y etiquetas accesibles estables; estilos acotados a Trabajo. Producto limitado a editor, helpers de borrador, comparación, detalle y CSS de Trabajo. Vendor/motor, reglas, tarifas, fixtures, preferencias, historial Finance y punto de commit no modificados. PR #15, main y Taura original no editados. Ciclos de roster y auditoría salarial Taura #33 siguen pospuestos.

Límites: validación local con perfiles exclusivamente sintéticos; no certifica una sesión de preview alojada, dispositivos físicos/PWA, teclado móvil del sistema o lector de pantalla real. SHA y estado Vercel final se registran en el mismo PR tras subir los cambios. Rollback: revertir este commit, sin migraciones.
