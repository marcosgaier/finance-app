# Validación INT-03D

Fecha NZ: 14/11/2026. Base: `7e510b03200c3eb8a29c04f55ee01b1682a34c8f`.

- `npm test`: PASS, cuatro suites operativas y 48/48 pruebas unitarias; ver `npm-test.txt`.
- `npm run build`: PASS; ver `build.txt`.
- `git diff --check`: PASS.
- Planificador: 14 escenarios PASS en escritorio 1280 px y en móvil 360 px, con comprobación adicional a 390 px. Resultados en `desktop/planner-result.json` y `mobile/planner-result.json`.
- Visor/importador: 8 escenarios PASS; `preview/int-02b-ui-result.json`.
- Importación de 12 períodos: resumen y cuatro tarjetas visibles sin expandir; detalle de ingresos cerrado, sin aviso de descarte inicial. Apertura del detalle conserva los doce períodos. Capturas `desktop/overview.png` y `mobile/overview.png`.
- Selector probado con nueve gastos semanales, uno mensual y dos variables: un solo botón de sustitución, `targetId=rent` correcto, margen base 932,00 NZD y margen negativo −63,10 NZD sin cambios respecto de C2. Desglose mensual 7/30 y total condicional comprobados.
- Horizonte 4–8, revisión explícita, cero vs desconocido, edición inválida, stale/reconstrucción, cierre/reapertura, importaciones concurrentes, hash inválido, backups rechazados, tamaño, descarte y reload cubiertos.
- Cero escrituras Storage/IDB, actividad de caché/canales o tráfico externo atribuibles al plan. Dashboard, historial, deudas, reservas y backup exportado comparados. Las acciones operativas deliberadas usan exclusivamente datos sintéticos y un baseline separado; ver límites del runner en los JSON.

Entorno: Node 22.23.2, Chrome/Chromium 157.0.8103.52, Playwright externo del runtime. Perfil nuevo no persistente; red externa bloqueada. Sin datos reales, deployment, Taura ni dependencias nuevas. Sin certificación PWA/offline, otros navegadores, dispositivo físico o lector de pantalla real. Se revisaron las capturas de resumen y editor.

Los primeros intentos encontraron aislamiento de localhost, un límite temporal del servicio de aprobación y el problema EISDIR del servidor de pruebas en Windows. Corregida la ruta raíz del servidor, se completaron los escenarios. Los selectores del runner se actualizaron para los nuevos acordeones y controles; las aserciones de importación, cifras y persistencia se conservaron.

Wireframe, comparación anterior/posterior, explicación del aviso y reproducción: [documento de implementación](../../int-03d-mobile-estimates.md).
