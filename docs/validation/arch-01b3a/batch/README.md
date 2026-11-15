# B3a UX — multiselección y accesos rápidos

Implementado sobre PR #16, rama existente `feat/arch-01b3a-demo-editor`.
Head y base verificadas antes de editar: `d834ab1a21af25717a9538a1f081f5645a1e022b` / `64ca62dfabbef5e790c96036aa100abaae037436`.
Autorización: comentarios #6874089331 y #6874054094; Taura issue #31.

## Comportamiento

Activar «Seleccionar varios días», tocar fechas o usar Tab/Espacio en mes o semana.
Contador, lista de fechas, marcas compactas con leyenda y aria-pressed. La selección
se conserva al navegar; «Limpiar selección» la vacía. Fuera de ese modo sigue
el detalle individual y Agregar turno. Día 06–18, Noche 18–06 siguiente día y
Libre 0 h están disponibles también en el editor individual.

Cada acceso de lote construye un plan puro, congelado y validado. El diálogo
lista todas las fechas: crear, cambiar u omitir y motivo. Solo un turno planned
sin datos actual/worked/confirmed/paid/payslip es compatible. Varios turnos y
otros estados se omiten; no se crean duplicados en esas fechas. La confirmación
explícita revalida contenido completo y generación de sesión, vuelve a construir
el plan y aplica un único array en DemoSession. Una sesión modificada exige
cancelar y generar otro preview, incluso si sus valores volvieron al original.
Cancelar, Escape y errores no hacen commit. Se preservan ID, created_at, notas y
campos desconocidos; los nuevos IDs se comprueban únicos.

Resumen/Pagos reciben el mismo array; no hay cambios de fórmulas ni motor.
Los accesos usan la tarifa sintética existente. El nocturno de primavera NZ
expone 11 h transcurridas en preview; el de otoño (13 h sin pausa) se omite con
motivo y requiere revisión individual. No se inventa una pausa ni horas pagadas.
No se agregó deshacer: cancelar preview y restablecer con confirmación cubren
el descarte del escenario sin sumar otro estado de restauración.

## Verificación

- [npm test](npm-test.log): 70 tests existentes + 11 de editor/lote, suites
  financieras/históricas/persistencia, auditoría de imports/efectos: PASS.
- En ese mismo log: paridad independiente de bytes y ejecución contra diez archivos
  obtenidos por GitHub del SHA Taura `22665a594a0dc8230aa7ed6a28736297a1ed32f2`.
- [Typecheck](typecheck.log), [build](build.log), [diff check](diff-check.log): PASS.
- [Editor/lote](editor-result.json), [log](browser.log): Chrome 157.0.8103.52, Node 22.23.2,
  360/390/1280. Mes/semana, teclado/selección, Día/Noche/Libre, vacías/ocupadas,
  múltiples/trabajados omitidos, cancelación por botón/Escape, foco/Tab/scroll,
  IDs, recálculo, errores, reset, salir/reabrir/reload. Spies sin actividad nueva
  Work en Storage/IDB/red/cachés/BC/SW/descargas; Finance intacto.
- [Work/B1/recuperación](work-regression/ui-results.json), [log](work-regression.log):
  ocho pestañas, Finance DOM/estado, B1 interceptado, errores de recovery/render: PASS.
- [Pagos Finance](payments.log): 20 PASS.
- [Planificador](planning/planner-result.json), [log](planning.log): 14 flujos PASS,
  respaldo y almacenamiento preservados, cero conexiones externas.
- [Invariantes de alcance](scope-invariants.json): App/recovery, Dashboard,
  fixtures, Resumen/Pagos y motor byte-idénticos al contenido Git de main.

## Capturas

| Ancho | Selección | Preview |
|---|---|---|
|360|[calendario · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/batch/batch-selection-360.png)|[confirmación · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/batch/batch-preview-360.png)|
|390|[calendario · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/batch/batch-selection-390.png)|[confirmación · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/batch/batch-preview-390.png)|
|1280|[calendario · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/batch/batch-selection-1280.png)|[confirmación · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/batch/batch-preview-1280.png)|

## Reproducir y límites

`npm test`, `npm run typecheck:work`, `npm run build`, `git diff --check`.
Para navegador, definir PLAYWRIGHT_MODULE (instalación externa), CHROMIUM_PATH y
VALIDATION_OUTPUT_DIR; ejecutar test:work-editor-ui, test:work-ui,
test:payments-ui. Para test:planning-ui servir dist en localhost y definir
PREVIEW_URL. La paridad independiente usa TAURA_PARITY_ROOT apuntando a un árbol
src de los diez archivos del manifiesto, obtenidos del SHA fijado.

Solo perfiles nuevos con fixtures sintéticos; ningún dato financiero real.
Sin persistencia, importaciones, ajustes #32, PAY-01, copia de semanas ni cambios
Taura. Sin nuevas dependencias. Las primeras ejecuciones detectaron foco de
Tab/autofocus y se corrigieron antes de guardar estos resultados finales.
El servidor y navegador deben compartir permisos de localhost en Windows.

Pendiente revisión independiente y visual del director; Android físico/PWA,
lector de pantalla, zoom nativo y otros navegadores siguen manuales.
No fusionar. Rollback de esta mejora: revertir su commit, sin migraciones.
