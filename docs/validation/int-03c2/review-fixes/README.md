# Correcciones de usabilidad del PR #6

Se atienden exclusivamente los dos puntos de la revision publicada en GitHub: nombres legibles y estados en espanol. Dashboard copia name como texto permitido; PlanningPreview lo usa solo para presentacion, con fallback Gasto semanal/mensual N y nombres de variables. El snapshot del motor sigue usando id/importe; targetId y aritmetica no cambian. No se modificaron motores, persistencia ni dependencias.

Validacion local: Node 22.23.2, Chrome/Chromium 157.0.8103.52, Playwright del runtime externo, perfil temporal sintetico, trafico externo bloqueado.

- npm test: cuatro suites operativas y 48/48 tests PASS (npm-test.txt).
- npm run build: PASS (build.txt); git diff --check: PASS.
- 13 flujos planificador PASS (planner-result.json), con aserciones adicionales de nombre distinto del ID, fallback sin nombre, targetId rent conservado y textos en espanol en escritorio/movil. Margen base 932 NZD y deficit -63.10 NZD conservados.
- 8 flujos visor PASS (preview/int-02b-ui-result.json).
- Capturas desktop/mobile revisadas; comparaciones existentes de Storage/IDB/canales/cache, URL, Dashboard/historial/deudas/reservas y backup PASS, sin errores de consola ni solicitudes externas. Se conserva el limite del runner: el baseline posterior al ciclo operativo no atribuye por separado actividad durante ese ciclo.

Reproduccion Windows: npm run build; usar node node_modules/vite/bin/vite.js preview --host 127.0.0.1 y, en otra terminal, configurar PLAYWRIGHT_MODULE al index.mjs externo, CHROMIUM_PATH al chrome.exe local y VALIDATION_OUTPUT_DIR a esta carpeta antes de npm run test:planning-ui. Para el visor usar su subcarpeta preview y npm run test:taura-ui.

Intentos iniciales: el sandbox impidio localhost; ejecutar servidor y runner juntos fuera del aislamiento resolvio el acceso. scripts/serve-dist.mjs fallo con EISDIR en Windows; se uso Vite Preview sin modificar ese servidor. Una primera prueba detecto etiquetas aun sin traducir y se corrigieron antes del PASS final.

Se uso el fixture sintetico versionado (actualExporter=false), sin volver a ejecutar el exportador TypeScript de Taura. No certifica deployment, PWA/offline, otros navegadores ni lector de pantalla real. No se accedio a datos personales. No se fusiono main.
