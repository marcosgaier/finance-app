# ARCH-01B1 — acceso externo a Taura

Fecha: 14/11/2026 (Pacific/Auckland). Base: Finance main `700a0857c73a1e60b719ce64c42cfcf9cc947e5a`.

## Alcance y fuentes

Se leyó completa la issue [ARCH-01B #25](https://github.com/marcosgaier/taura-roster-pay/issues/25), el [informe de Codex](https://github.com/marcosgaier/taura-roster-pay/issues/25#issuecomment-6869804112), la revisión funcional y la [confirmación del origen](https://github.com/marcosgaier/taura-roster-pay/issues/25#issuecomment-6869863264). La autorización de implementación, rama, PR sin merge y registro de resultados proviene del pedido explícito del director en este chat.

Únicamente se agrega ModuleAccessLinks a Dashboard: sección accesible, anchor HTTPS fijo `https://taura-roster-pay-676l.vercel.app` (ele minúscula), target `_blank`, rel `noopener noreferrer`, sin query/hash. Copy explícito de apps/datos separados, alternativa de icono instalado y continuidad de Finance si el destino falla. Tailwind existente; sin dependencias ni estilos globales nuevos.

Las ocho pestañas, activeTab, handlers, cálculos y TauraIncomePreview montado en hidden permanecen intactos. App.jsx/recuperación, salarios, GEM, presupuestos, motores, import/export, almacenamiento, PWA, dominios y Taura no se modifican. No hay import Taura, iframe, consulta de disponibilidad en runtime, migración, sincronización ni acceso a datos Taura. B2/B3 e INC-01 quedan fuera.

## Disponibilidad del destino

HEAD HTTPS independiente de las pruebas: HTTP 200 OK, Content-Type text/html, servidor Vercel, 14/11/2026 02:05:15 UTC. No se usó otro host. La herramienta web y el shell restringido no lograron acceder; curl fuera del sandbox verificó el mismo host aprobado. Esto acredita respuesta HTTP, no disponibilidad futura ni contenido financiero/PWA del usuario.

## Validación

- `npm test`: PASS, suites existentes de motor, persistencia, pagos históricos/reapertura y 70 pruebas node:test, incluidas ARCH-01A.
- `npm run build`: PASS (Vite 6.4.2).
- `node scripts/validate-module-access-ui.mjs`: PASS en Chrome headless, 360/390/1280 px; resultados en ui-results.json, ui.log y capturas access-*.png.
- `git diff --check` y diff staged: PASS; ver diff-check.log.

El script UI crea servidor de producción y perfiles efímeros propios. Usa sampleFinanceData, semana sintética inicializada y fixture JSON Taura sintético existente. La ejecución final intercepta todas las solicitudes externas y bloquea DNS del host Taura; éxito/404/offline son respuestas simuladas. Comprueba href/target/rel, ausencia de referrer y opener, teclado Tab/Shift+Tab/Enter, foco visible, tamaño táctil >=44px, ausencia de overflow de página, ocho destinos, planificación importada/editada tras ida/vuelta por todas las pestañas y apertura externa, presupuesto editado conservado, storage/history invariantes respecto de su baseline, recuperación incompatible/read-error/unsaved. El baseline financiero se toma antes de navegar; editar presupuesto es una acción financiera existente y usa un baseline propio posterior.

Se corrigieron únicamente problemas del nuevo harness durante su desarrollo: fixture sin semana activa que disparaba inicialización existente, rutas Windows codificadas, cierre prematuro de popup y reintentos de Chrome offline. Un intento inicial sin bloqueo DNS dejó cargar recursos públicos de Taura en un perfil efímero; no se accedió a perfiles ni datos personales. La ejecución final usa bloqueo DNS e interceptación y sus logs son los entregados.

## Reproducir

Ejecutar npm test y npm run build. Usar Playwright externo, como los validadores existentes, sin instalar dependencias en el proyecto:

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/ruta/a/playwright/index.mjs'
$env:CHROMIUM_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node scripts/validate-module-access-ui.mjs
```

El test posee su propio servidor localhost. En este entorno se necesitó ejecución fuera del sandbox porque Chrome no podía navegar a localhost.

## Límites y revisión pendiente

No se ejecutó lector de pantalla, menú contextual/copia manual, Cmd/Ctrl+click fiable en automatización ni dispositivo físico Android/PWA. Ctrl+click abrió una pestaña de fondo cuya navegación no se completó de manera fiable en el harness; no se presenta como PASS. El anchor conserva su semántica nativa sin onClick preventivo. Las capturas móviles fueron inspeccionadas; los controles y texto caben sin scroll horizontal de página, con el menú horizontal original intacto. No se garantiza conservar memoria tras recarga, cierre o descarte del navegador.

## Rollback

Revertir el commit B1 o retirar el componente y sus dos líneas de inserción/import en Dashboard. No limpiar storage/IndexedDB/caché, reinstalar PWA, cambiar dominios ni restaurar/migrar datos. La PR se dirige a main y queda sin merge; no se realiza despliegue productivo manual.

Regresión adicional: node scripts/validate-card-payments-ui.mjs PASS, 20 casos UI a 360/1280 px. Evidencias en payments-regression/ y payments-ui.log (fixture sintético; servidor y perfil propios).
