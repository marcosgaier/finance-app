# Roster: calendario primero y controles compactos

Refinamiento pedido por el director en PR #16, misma rama
`feat/arch-01b3a-demo-editor`. Head local y remoto comprobados antes de editar:
`9598cd40e4aee9d0f6baf6e13f598e15f0b3f057`. Sin merge; PR #15 intacto.
El SHA publicado y el estado Vercel posterior al push se informan en el comentario
de ejecución del PR, para que correspondan al commit realmente publicado.

## Comparación directa con Taura

Se leyeron `src/pages/RosterPage.tsx` y `src/workflows.css` del checkout original
`marcosgaier/taura-roster-pay`, HEAD `d58ad29ea5a9b25d9136e1da959bd0414f46fca1`.
Esos archivos no tenían diff local y no se modificaron. Taura coloca `bulkBar`
después de MonthGrid/WeekGrid; usa `segmented`, `dateNav`, etiquetas cortas,
iconos y botones secundarios transparentes. Finance tenía acciones de lote antes
de la grilla, dos filas de navegación, hero de 24 px y botones con relleno
13×17 px y márgenes verticales de 14 px.

Se adopta la jerarquía de Taura con diferencias deliberadas de accesibilidad:

- Calendario antes de Día/Noche/Libre en DOM y pantalla. Arriba queda solo el
  modo «Seleccionar varios días» y un enlace con contador que enfoca y desplaza
  a «Elegir turno». La barra permanece al pie, sin tapar celdas con un overlay.
- Mes/Semana agrupados; flechas con nombres accesibles completos y «Ejemplo»
  para volver a la fecha ficticia. Se elimina el hero oscuro del Roster.
- Celdas mensuales de 52 px de alto frente a 76 px anteriores. No se replican
  los pequeños selectDot/shiftMark táctiles de Taura: toda la celda sigue siendo
  un botón accesible. Medidos al menos 44×44 px en 360/390/1280.
- Tres accesos alineados, iconos y horario en segunda línea. Los nombres
  accesibles conservan los textos completos, incluida la noche del día siguiente.
  Las fechas completas se despliegan con un details nativo de blanco de 44 px;
  el contador vivo y el enlace superior mantienen visible el estado de selección.
- Preview más breve, filas separadas con crear/cambiar/omitir y motivo completo;
  confirmación/cancelación al pie con anclaje durante scroll. Se conserva la
  confirmación explícita de cambios ficticios.

Todo el CSS nuevo está en `src/modules/work/roster.module.css`, limitado al
Roster y al diálogo de lote. Sin modificaciones de CSS global ni del módulo
compartido. No se cambia el editor individual ni la navegación exterior de Work.

## Evidencia de ejecución

Chrome 157.0.8103.52, Node v22.23.2, perfiles nuevos con datos sintéticos y zona
Pacific/Auckland. Build local, red externa interceptada. La primera ejecución
sin escalación no pudo acceder a localhost; se ejecutaron Chrome y servidor con
el mismo permiso de localhost. No fue un fallo de la aplicación.

| Verificación | Evidencia |
|---|---|
| npm test: suites Finance, 70 Node y 11 editor/lote; paridad independiente | [log](npm-test.log) |
| Typecheck Work | [log](typecheck.log) |
| Build | [log](build.log) |
| diff --check | [log](diff-check.log) |
| Roster/editor 360/390/1280 | [resultado](after/editor-result.json), [log](browser.log) |
| Work, ocho pestañas Finance, recovery, B1 interceptado | [resultado](work-regression/ui-results.json), [log](work-regression.log) |
| Pagos Finance: 20 PASS | [log](payments.log) |
| Planificador escritorio | [resultado](planning/planner-result.json), [log](planning.log) |
| Planificador móvil | [resultado](planning-mobile/planner-result.json), [log](planning-mobile.log) |
| Alcance y archivos intactos | [invariantes](scope-invariants.json) |

El test UI agrega aserciones de orden DOM y geometría calendario→barra, span de
calendario mensual a barra menor de 470 px, blancos táctiles, enlace por Enter,
foco del pie visible y siguiente Tab. Mantiene pruebas mes/semana, selección por
Espacio, Día/Noche/Libre, preview, conflictos trabajados/múltiples, cancel/Escape,
foco devuelto, aplicación, IDs, errores, resumen/pagos, reset/salida/reload.
Spies/snapshots detectan cero efectos nuevos Work en storage/IDB/red/cachés/
BroadcastChannel/SW/descargas y Finance intacto. No se usaron datos reales.

Paridad independiente: los diez archivos se obtuvieron por el conector GitHub
del SHA Taura fijado `22665a594a0dc8230aa7ed6a28736297a1ed32f2` en un árbol
ignorado externo al producto, `node_modules/.cache/taura-upstream`. La descarga
raw sin autenticar dio 404; no se usó ese resultado. npm test verifica bytes,
hashes y resultados ejecutables contra los archivos autenticados independientes.

## Antes y después

Antes: build del head inicial, validación de editor/lotes PASS en los tres anchos
antes de reconstruir. [Resultado anterior](before/editor-result.json).

| Ancho | Antes: selección / preview | Después: selección / semana / preview |
|---|---|---|
| 360 | [mes · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/before/batch-selection-360.png) · [preview · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/before/batch-preview-360.png) | [mes · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/after/batch-selection-360.png) · [semana · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/after/batch-week-360.png) · [preview · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/after/batch-preview-360.png) |
| 390 | [mes · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/before/batch-selection-390.png) · [preview · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/before/batch-preview-390.png) | [mes · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/after/batch-selection-390.png) · [semana · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/after/batch-week-390.png) · [preview · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/after/batch-preview-390.png) |
| 1280 | [mes · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/before/batch-selection-1280.png) · [preview · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/before/batch-preview-1280.png) | [mes · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/after/batch-selection-1280.png) · [semana · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/after/batch-week-1280.png) · [preview · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/refinement/after/batch-preview-1280.png) |

## Límites y reproducción

Revisión React aplicada a los dos componentes: hooks y estado conservados,
identidades estables, semántica de botones/dialog/details, nombres accesibles,
aria-pressed y foco visible. Lectura con un lector de pantalla real, Android
físico/PWA, zoom nativo y otros navegadores requieren revisión manual. Las
capturas locales no certifican una sesión de la preview alojada ni constituyen
la aprobación visual del director.

`npm test`, `npm run typecheck:work`, `npm run build`, `git diff --check`.
Para paridad ejecutable definir TAURA_PARITY_ROOT al árbol independiente fijado.
Para UI: PLAYWRIGHT_MODULE al Playwright externo y CHROMIUM_PATH a Chrome;
VALIDATION_OUTPUT_DIR a una carpeta nueva. Ejecutar test:work-editor-ui,
test:work-ui, test:payments-ui. Servir dist en localhost:4173 y ejecutar
test:planning-ui con PREVIEW_URL; repetir con MOBILE=1.

Sesión/generación, snapshot, plan puro, protección de conflictos, aplicación
atómica React, motor fijado, fixtures, Finance, storage, PAY-01 y settings #32
permanecen intactos. Sin copia de semanas, dependencias nuevas ni cambios de Taura.
Rollback: revertir este commit; no hay migraciones ni limpieza de datos.
