# ARCH-01B2.2a — Roster sintético de solo lectura

14/11/2026, Pacific/Auckland. Alcance autorizado expresamente por el director en este chat: exclusivamente B2.2a, rama nueva y PR a main sin merge ni despliegue productivo. Leídas issue Taura #27, propuesta 6871854136 y condiciones 6871873009. B2.2b/B3 permanecen fuera del alcance.

## Base y procedencia

HEAD remoto verificado antes de editar y nuevamente antes de publicar:

- Finance main: aa42690a7d152291a5bdb9b047ea0d7e34272d29, merge B2.1 #12.
- Taura main: 22665a594a0dc8230aa7ed6a28736297a1ed32f2.
- Finance local estaba en la rama B2.1, 4ae9677, con árbol idéntico a main y limpio. La nueva rama codex/arch-01b2-2a-readonly-roster parte del main remoto.
- Taura local está en d58ad29 y tiene una carpeta ajena no versionada .codex-remote-attachments; no se modificó ni se usó como autoridad para paridad. La autoridad es el commit remoto fijado, descargado independientemente vía GitHub.

Única ampliación del motor: src/domain/rosterWeeks.ts → src/modules/work/vendor/taura/domain/rosterWeeks.ts, byte a byte. Blob decb55c020622d16602129d0d2bf4c76ffd9d305, SHA256 ab1c7e75f5b35e433d644101a4ce15ce0bc95c70362e9d71a61800df4ac7b931. Los nueve archivos previos conservan sus bytes, hashes y fórmulas; provenance.json registra los diez.

Presentación adaptada de pages/RosterPage.tsx, blob e41e44840baee95f9b08dec3d126959d46c4aa47, y components/DayDetails.tsx, blob 074d14f39c7b49e7c1246613cfd118b17775a6e7, ambos del mismo commit Taura. No son copias íntegras: se conservan la representación de 42 días/7 días y la selección de filas de la semana contractual; se eliminan iconos externos, editor, callbacks operativos, selección masiva, copiar/pegar y afirmaciones de datos reales. El detalle es una región inline informativa. No se invoca planRosterWeekCopy.

## Contrato y navegación

Mismos siete días 20–26/09/2026, tarifas sintéticas, preferencia bank y fecha fija 2026-09-24 de B2.1. Freeze recursivo del fixture compilado y snapshots protegidos por llamada; ninguna fuente editable. Se validan enums, IDs demo, fechas, pares de tiempos y orden/duración, números finitos de turno/settings y preferencias. No se cambian reglas salariales. La semana del ejemplo sigue dando 60 h totales, 40 ordinarias, 20 overtime y +10 h bank. Se calcula con TODOS los turnos antes de seleccionar la semana; Resumen conserva su resultado.

WorkDemo sigue siendo la frontera y conserva el retorno fuera del error boundary. Solo Resumen/Roster, sin Pagos. Ambas subpantallas permanecen montadas con hidden; al alternar se conserva cursor, mes/semana, detalle y scroll por subvista. Se enfoca el heading visible con preventScroll. El detalle recibe foco y al cerrarlo retorna al día; cambiar período/vista cierra el detalle para no retener un origen de foco desmontado. La salida desmonta Trabajo como B2.1; reabrir reinicia en Resumen y la fecha fija.

No se agregan entradas de historial ni se captura Atrás del navegador/Android; hay aviso visible y botón Atrás al resumen. Finance y TauraIncomePreview conservan sus instancias, estado, borradores y ocho pestañas. App.jsx/recovery, Dashboard.jsx, ModuleAccessLinks.jsx, planificador, package/lock y motores Finance no cambian. B1 conserva https://taura-roster-pay-676l.vercel.app.

Banner sticky y aviso de no guardar/exportar; botones nativos con nombres completos, aria-current/pressed/expanded, indicadores textuales, foco visible y controles de calendario de al menos 44 × 44 px a los anchos probados. CSS Modules locales, sin CSS global Taura ni router. No cambia origen, PWA/SW, persistencia, salarios, impuestos, GEM, presupuestos, cobros o proyecciones operativas.

## Evidencia

- npm-test.log: npm test PASS, suites Finance incluidas y 70 pruebas Node; test:work incluye identidad de diez blobs/SHA256, grafo transitivo cerrado, auditoría de efectos y casos inválidos/inmutabilidad, fechas, overtime pay/bank, noche/weekend y motor fiscal.
- Paridad independiente obligatoria en esta ejecución: TAURA_PARITY_ROOT apuntó a un árbol temporal descargado por GitHub al SHA fijado, no al checkout vecino ni a una copia del vendor. Comparación byte a byte de diez archivos; paridad ejecutable de proyecciones pay/bank y helpers Roster en septiembre, cambio de mes y año. El PASS queda en npm-test.log.
- typecheck.log y build.log: PASS. diff-check.log: PASS.
- ui.log/ui-results.json: Chrome aislado, 360/390/1280. Mes/semana, anterior/siguiente/fecha fija, día vacío/nocturno, detalle, teclado, foco visible/retornado, banner sticky, contexto y scroll internos, resumen sin cambios; ida/vuelta desde ocho pestañas, identidad DOM Finance/planificador y foco/scroll Finance, sesión sintética con supuesto 12.34 y presupuesto 42 conservados.
- Spies anteriores al boot: Storage get/set/remove/clear, IDB, red, workers/canales, caches y registro SW. Snapshots completos de local/sessionStorage, historial/URL y contadores idénticos antes/después de Trabajo. Sin nuevos efectos de Trabajo. Fuentes auditadas sin hooks/servicios/exports/backups. B1 éxito/404/offline interceptados; nunca se consultó Taura productivo. JSON Finance completo conserva saldos, GEM, presupuestos e históricos.
- Recovery incompatible/read-error/unsaved y fallo de render sintético: PASS, con retorno seguro y estado Finance intacto.
- payments.log: 20 PASS, regresión UI pagos. planning.log/planning-mobile.log y subdirectorios: PASS escritorio/móvil, sin requests externos ni errores de consola.
- Capturas access-*, work-*, week-* y detail-*; revisión visual móvil y escritorio.

El primer intento UI encontró imports React faltantes bajo el transformador JSX de Vite; corregidos antes del PASS final. Un intento de planificación no alcanzó el servidor dentro del sandbox; se ejecutó finalmente con servidor efímero y Chrome en el mismo entorno. Se ajustó el harness de foco para activar modalidad de teclado antes de comprobar :focus-visible. No se ocultaron fallos del producto.

Limitaciones: sin Android/PWA físico, lector de pantalla o auditoría completa de accesibilidad/zoom 200%; quedan como comprobaciones manuales pendientes, no PASS. Sin datos personales, backups reales ni perfil habitual de navegador.

## Reproducción y rollback

Ejecutar npm test, npm run typecheck:work, npm run build y git diff --check. Para paridad independiente, obtener un checkout/archivo de Taura 22665a594a0dc8230aa7ed6a28736297a1ed32f2 en carpeta temporal y definir TAURA_PARITY_ROOT con esa raíz antes de npm test. No apuntar a un main sin comprobar SHA.

Para UI, PLAYWRIGHT_MODULE apunta a un Playwright externo y CHROMIUM_PATH a Chrome; npm run test:work-ui usa servidor y perfil efímeros. Pagos: VALIDATION_OUTPUT_DIR propio y node scripts/validate-card-payments-ui.mjs. Planificación: servidor local propio npm run serve (PORT libre), PREVIEW_URL localhost correspondiente, VALIDATION_OUTPUT_DIR propio y node scripts/validate-planning-ui.mjs; repetir con MOBILE=1. Las herramientas externas no se agregan al package/lock.

Antes de merge basta cerrar el PR y descartar la rama. Si se integrara posteriormente, revertir el commit B2.2a completo conserva B2.1/B1 y todos sus archivos originales. No limpiar storage, IDB, caches, reinstalar PWA, cambiar dominios ni migrar datos. No se ejecuta merge, promoción o despliegue productivo. La siguiente etapa necesita autorización separada.
