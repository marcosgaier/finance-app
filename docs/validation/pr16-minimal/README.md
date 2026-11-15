# PR #16 — corrección y limpieza mínima (2026-11-15 NZ)

Base y HEAD remoto revalidados antes de editar y antes de subir: main
`64ca62dfabbef5e790c96036aa100abaae037436`, rama
`feat/arch-01b3a-demo-editor` en `b5d08af909377960b505d922b9f87ecac6ea5473`.
GitHub informó PR abierto, mergeable. Sin merge ni auto-merge.

## Corrección

El lote comparte ahora `hasActualData` con el editor: `actual_notes: ''`
es dato real y exige revisión individual. No se elimina, normaliza ni sobrescribe
la nota. Las notas ausentes, undefined o null siguen permitiendo editar el plan.
La regresión prueba Día/Noche/Libre, identidad de presencia del campo, contenido,
nota planificada, fuentes congeladas y ausencia de mutaciones; siguen pasando
las protecciones de estados, datos parciales, ceros, recibos y confirmaciones.
Solo cambia código de producto en `batchPlan.ts`, además de la prueba específica.
Vendor, Taura original, salarios, tarifas, fixtures, overtime, configuración,
persistencia y contratos de importación no fueron modificados.

## Validación del build local

- [npm test](npm-test.log): PASS; 17 pruebas editor/lotes y suites Finance.
  Incluye paridad independiente ejecutable y de bytes con upstream fijado.
- [typecheck:work](typecheck.log), [build](build.log),
  [diff-check](diff-check.log), [diff contra main](diff-main-check.log): PASS.
- [Editor](editor.log), [resultado](editor-result.json): PASS 360/390/1280.
- [Work/Finance](work.log), [resultado](work-result.json): PASS 360/390/1280.
- [Pagos Finance](payments.log): 20 PASS.
- Planificador [escritorio](planning.log) y [móvil](planning-mobile.log): PASS.
- [Importación Taura](taura.log), [resultado](taura-result.json): PASS.
- Perfiles sintéticos, solicitudes externas interceptadas; sin datos reales.
  No certifica dispositivos físicos/PWA ni interacción manual en preview remoto.
  El estado del despliegue del SHA nuevo se reporta tras el push.

Muestra de la nueva ejecución: [lote 360](batch-preview-360.png),
[resultado 390](batch-week-390.png), [editor trabajado 1280](worked-editor-1280.png).
El [informe anterior](../arch-01b3a/worked-editor/README.md) conserva antes/después
en los tres anchos, notas trabajadas y detalle guardado.

## Limpieza conservadora

El [manifiesto](cleanup-manifest.json) enumera exactamente 599 PNG retirados
(79.106.654 bytes = 79,11 MB decimales), todos añadidos en este PR desde la base.
Conserva 24 capturas anteriores representativas, README/informes, logs y JSON.
Se añaden solo tres capturas nuevas. Ninguna prueba ni script existente eliminado.
Ocho Markdown reparados apuntan las capturas retiradas al commit auditado,
marcadas como archivo histórico. Estas referencias conservan su contexto temporal.

Reproducción de pruebas: ver variables y comandos del informe anterior.
`scripts/pr16-evidence-cleanup.mjs` registra la selección exacta aplicada una vez
sobre el HEAD auditado; no ejecutar sobre el árbol ya limpiado.
`node scripts/pr16-size-report.mjs` mide bytes y objetos sin modificar historial.
El [reporte de tamaño](size-report.json) distingue árbol de evidencias completo
(incluye archivos anteriores a este PR) e historial de objetos exclusivos de rama.

Medición del commit de producto/limpieza `f8d62a8` antes de este cierre documental:
diff total 794 → 219 archivos; suma de bytes de archivos cambiados del árbol
81.929.491 → 3.133.932. Evidencias del diff: 773 → 196 archivos,
81.749.119 → 2.948.335 bytes. Historial exclusivo de rama: 35.854.922 bytes de
blobs únicos lógicos; no incluye blobs compartidos con main. Los informes de
cierre añaden unos pocos KB. El historial no disminuyó: antes eran 35.674.052
bytes únicos, con numerosas capturas repetidas que comparten el mismo blob.
El almacén Git local completo medía 55.716 KiB sueltos + 853 KiB empaquetados;
incluye objetos de otras referencias y no mide una transferencia de este PR.

La verificación de enlaces detectó también tres referencias previas inexistentes
`editor-secondary-*`: corregidas al pie del editor archivado, con etiqueta fiel.
Todos los enlaces locales PNG de los ocho informes reparados fueron comprobados.
Vercel SUCCESS confirmado por GitHub para `f8d62a8`; inspección directa por el
conector Vercel devolvió 404. El SHA documental final se verifica tras su push.

**Limitación Git:** borrar en un commit nuevo reduce el diff final y el árbol,
pero todos los blobs anteriores siguen accesibles en el historial. No hubo
force push, rebase, reescritura ni garbage collection. La suma de tamaños lógicos
de blobs únicos no equivale al tamaño comprimido de una descarga o de `.git`.

GO técnico para revisión final de esta demo sintética si el SHA nuevo tiene
checks correctos y continúa sin conflictos. El merge requiere autorización final
específica después de estos resultados. PR #15 intacto; Escenarios, ciclos y
auditoría salarial Taura #33 siguen fuera del alcance.
