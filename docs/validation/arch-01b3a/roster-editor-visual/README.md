# Trabajo: calendario y editor, refinamiento visual

Base local y remota: `338e4de1eee5d125a7e0dc0a3b295beadf059ddd`.
Misma rama `feat/arch-01b3a-demo-editor`, mismo PR #16, sin merge.
El comentario de publicación registra el SHA final y el status Vercel correspondiente.

## Referencia directa

Consultados directamente por GitHub y en la copia local de Taura:

- `src/pages/RosterPage.tsx`, blob `e41e44840baee95f9b08dec3d126959d46c4aa47`: símbolos, distintivos por turno y tratamiento separado de selección.
- `src/components/ShiftEditor.tsx`, blob `4f3ec8f18ea654bc93a8b7a1b05862f0dd4f4334`: tres plantillas prominentes, datos del turno agrupados y horario prioritario.
- `src/workflows.css`, blob `50243ad3c4673c5b464e6b47ef21db3bc48c65e3`: amarillo #fff1b9, azul #dfe5ff, libre #e7ecea, licencias #ffe0da, borde de trabajado/confirmado, cancelado tachado.

No se modificó Taura original. No se trasladan acciones, cálculo ni persistencia del editor original.

## Fase 1: calendario

Solo RosterPage y roster.module.css: distintivos suaves de Taura dentro del botón del día.
Un distintivo y contador +N en mes; todos los turnos y sus estados completos en semana.
El nombre accesible del día conserva todos los registros; abrirlo mantiene el detalle completo.
P/T/C/×/M/R/LP/LS distinguen cada estado; confirmado/recibo usa doble borde,
trabajado borde simple, modificado discontinuo y cancelado tachado. Leyenda desplegable
nativa con todos los códigos. Tipos día/noche/libre/licencias/personalizado diferenciados.
La fecha fija del ejemplo mantiene borde y número oscuro; no se presenta como la fecha real.
Selección múltiple verde con contorno, foco visible independiente y targets >=44x44.

La primera prueba con dos marcas y celdas de 70px falló el límite previo de altura.
Se corrigió a una marca + contador y mínimo 52px; se conserva la aserción de calendario
y acciones dentro de 470px. [Fase 1 PASS](phase1.log), con el editor y CSS del editor
originales de la base (build temporal; fuentes restauradas antes del build final).

| Ancho | Antes | Calendario nuevo, editor previo | Final |
| --- | --- | --- | --- |
| 360 | [Antes](before/batch-selection-360.png) | [Fase 1](phase1/batch-selection-360.png) | [Final](after/batch-selection-360.png) |
| 390 | [Antes](before/batch-selection-390.png) | [Fase 1](phase1/batch-selection-390.png) | [Final](after/batch-selection-390.png) |
| 1280 | [Antes](before/batch-selection-1280.png) | [Fase 1](phase1/batch-selection-1280.png) | [Final](after/batch-selection-1280.png) |

## Fase 2: editor

Solo DemoShiftEditor y reglas de su CSS Module: plantillas Día/Noche/Libre con símbolos,
horarios y selección visible; fecha/tipo en dos columnas, estado visible, horario y horas
prioritarios. Descanso y tarifa se agrupan en details con sus valores visibles en el resumen.
Datos trabajados conservan todos sus campos. Advertencia DEMOSTRACIÓN y máximo 12h
permanecen visibles; se reduce texto repetido. Guardar/cerrar siguen accesibles en pie sticky.
Se conservan exactamente handlers, validación, borradores, plantillas y envío originales.

| Ancho | Antes | Después | Secundarios abiertos por teclado |
| --- | --- | --- | --- |
| 360 | [Antes](before/editor-360.png) | [Después](after/editor-360.png) | [Descanso/tarifa](after/editor-secondary-360.png) |
| 390 | [Antes](before/editor-390.png) | [Después](after/editor-390.png) | [Descanso/tarifa](after/editor-secondary-390.png) |
| 1280 | [Antes](before/editor-1280.png) | [Después](after/editor-1280.png) | [Descanso/tarifa](after/editor-secondary-1280.png) |

Capturas comparables, mismo flujo/día/datos, viewport 900px de alto. Inspección visual:
sin recortes de controles ni desbordamiento, acciones presentes, textos legibles.

## Validación y reproducción

- [npm test](npm-test.log): PASS, paridad independiente ejecutable y bytes upstream con `TAURA_PARITY_ROOT=node_modules/.cache/taura-upstream`.
- [typecheck:work](typecheck.log), [build final](build.log), [diff-check](diff-check.log): PASS.
- [Editor final](editor.log), [resultado](after/editor-result.json): PASS 360/390/1280. Pay predeterminado, bank/pay manual, coherencia de cálculo/resumen/pagos, teclado, foco restaurado, Escape, IDs, datos inválidos, duplicar/cancelar/eliminar, navegación mes/semana, reset/salida/recarga, multiselección y autodesselección, preview, conflictos, lotes sin cambio y atomicidad. Cero efectos nuevos Work; Finance intacto.
- Nueva aserción abre/cierra descanso/tarifa con Enter, verifica ambos campos visibles y controles visibles del editor >=44x44.
- [Estados](states.log), [resultado](states/result.json): espécimen del componente Roster con props sintéticas para todos los tipos/estados, +2, contraste calculado >=4.5:1, foco/Space y targets >=44x44. [360](states/states-360.png), [390](states/states-390.png), [1280](states/states-1280.png). No altera fixtures ni permite editar protegidos; esta prueba es aislada del flujo de aplicación.
- [Work/Finance](work.log): PASS 360/390/1280, ocho pestañas, retorno/DOM/CSS/scroll/estado/recovery, pagos del ejemplo y persistencia intacta.
- [Pagos Finance](payments.log): 20 PASS.
- Planificador [escritorio](planning.log) y [móvil](planning-mobile.log): PASS, servidor aislado localhost:52981 del build final, datos sintéticos, sin peticiones externas ni errores de consola.

Node 22.23.2, Chrome 157.0.8103.52, Pacific/Auckland. Los JSON registran la versión real del navegador.
Para reproducir: `npm test`, `npm run typecheck:work`, `npm run build`, `git diff --check`.
UI: definir PLAYWRIGHT_MODULE a Playwright externo y CHROMIUM_PATH a Chrome instalado;
VALIDATION_OUTPUT_DIR por suite; ejecutar test:work-ui, test:work-editor-ui, test:payments-ui
y `node scripts/validate-work-visual-states.mjs`. Planificador usa PREVIEW_URL al servidor
de scripts/serve-dist.mjs y MOBILE=1 para móvil. Sin nuevas dependencias.
Chrome necesitó ejecución fuera del sandbox para acceder a localhost; el intento restringido
falló con ERR_NETWORK_ACCESS_DENIED antes de ejecutar los flujos.

Producto limitado a cuatro archivos de Trabajo. Motor/vendor, tarifas, horas, overtime/default pay,
preferencias bank, historial, protecciones, conflictos, idempotencia, atomicidad, reset/reload,
fixtures y persistencia sin cambios. Finance main/App, PR #15 y Taura original sin modificaciones.
Revisión React: sin nuevos efectos, hooks ni dependencias; listas con key, controles nativos,
labels y foco existentes conservados. Auditoría salarial Taura #33 sigue FUTURA.

Límites: pruebas en build local y espécimen aislado. Dispositivos físicos Android/iOS, PWA,
teclado móvil, zoom del sistema y lectores reales pendientes de revisión del director.
La evidencia local no certifica la sesión de preview alojada ni logs de build remotos.
El comentario del PR distingue el status Vercel y cualquier límite de acceso remoto.
El conector Vercel devolvió 403 forbidden al listar finance-app/margab27;
no hay CLI vercel instalada. El estado del SHA se consulta mediante GitHub.
Rollback: revertir este refinamiento, sin migraciones.
