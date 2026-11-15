# Deselección después de aplicar un lote

Base local y remota verificada: `560c8f51603383aea5904b059a546aefa84e320c`.
Misma rama `feat/arch-01b3a-demo-editor`, mismo PR #16. El SHA publicado y la
preview Vercel de ese SHA se registran en el comentario de ejecución del PR.
Sin merge, sin nuevo PR, sin cambios en PR #15.

El flujo es calendario → preview → aplicación síncrona validada en memoria →
selección vacía y foco en los controles. Solo RosterPage.tsx cambia en producto.
Después de que onBatch retorna sin error, se limpia dates si alguna fila crea
un turno o cambia los campos de la plantilla. Se mantiene multi activo y el
mensaje existente. El efecto de foco corre al cerrar el preview, después de
la restauración de foco del diálogo; evita dejarlo en un botón deshabilitado.

Cancelar/Escape no llegan a esta limpieza. Una excepción de validación o
snapshot/generación interrumpe onBatch antes de limpiar; el diálogo conserva
su manejo de error. Las pruebas de dominio existentes verifican esos rechazos
y la atomicidad. No se inyectaron fallos de concurrencia en el navegador.
Un lote totalmente omitido mantiene Confirmar deshabilitado y la selección.
Una plantilla idéntica puede confirmarse como antes, pero conserva la selección:
no hay cambio efectivo. La comparación usa únicamente los seis campos que
la plantilla modifica, evitando confundir metadatos clonados con cambios.

## Evidencia

- [npm test](npm-test.log): PASS, con paridad independiente de Taura mediante
  TAURA_PARITY_ROOT=node_modules/.cache/taura-upstream.
- [Typecheck](typecheck.log), [build](build.log), [diff-check](diff-check.log): PASS.
- [Navegador](browser.log), [resultado](editor/editor-result.json): PASS en
  360/390/1280. Noche con crear/cambiar/omitir → cero seleccionados, aria-pressed
  false, contador/enlace cero, multi activo, controles deshabilitados y foco
  accesible. Luego Día en otra fecha sin alternar el modo ni limpiar manualmente.
  Cancelar conserva selección; Escape conserva tres fechas; plantilla idéntica
  conserva selección; todas protegidas impiden confirmar. Se comprueban ambos
  tipos aplicados y continúan las regresiones editor/IDs/resumen/pagos/reset.
- Capturas después del primer lote: [360 · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/deselection/editor/batch-cleared-360.png),
  [390 · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/deselection/editor/batch-cleared-390.png), [1280 · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/deselection/editor/batch-cleared-1280.png).
- [Work/Finance](work-regression.log): PASS en los tres anchos, ocho pestañas,
  recuperación, navegación externa interceptada y aislamiento.
- [Pagos](payments.log): 20 PASS.
- Planificador [escritorio](planning.log) y [móvil](planning-mobile.log): PASS.

Chrome con perfiles sintéticos, zona Pacific/Auckland; red externa interceptada.
Spies/snapshots comprueban cero efectos nuevos de Work sobre storage/IDB/red/
cachés/SW/descargas y Finance intacto. Sin datos reales ni acceso a Taura real.
La primera ejecución restringida no pudo navegar a localhost; las pruebas se
ejecutaron con permiso local para Chrome y servidor. La primera aserción del
nuevo test esperaba «Día» en vez de la etiqueta existente «Diurno»; corregida.

Motor, snapshot, generación, aplicación atómica, registros protegidos, fixtures,
storage y Taura permanecen intactos por diff. Android/PWA físico y lector de
pantalla real siguen pendientes. Estas pruebas certifican el build local;
el estado de despliegue se comprueba aparte en GitHub/Vercel.

Reproducción: npm test, npm run typecheck:work, npm run build, git diff --check;
npm run test:work-editor-ui, npm run test:work-ui, npm run test:payments-ui.
Definir PLAYWRIGHT_MODULE, CHROMIUM_PATH y VALIDATION_OUTPUT_DIR para UI.
Servir dist en localhost:4173 y ejecutar test:planning-ui; repetir con MOBILE=1.
Rollback: revertir el commit, sin migraciones.
