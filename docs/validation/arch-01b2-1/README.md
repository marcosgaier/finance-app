# ARCH-01B2.1 — Trabajo de demostración

14/11/2026, Pacific/Auckland. Autorización exclusiva del director en el pedido de este chat: implementar B2.1, rama nueva y PR a main sin merge. Leídos #26, propuesta 6871394954, dictamen 6871439767, #25/B1 y PR Finance #11 integrado. Base Finance `6f7e9c4e752f56359bba9b63a85df88595b83281`; fuente Taura `22665a594a0dc8230aa7ed6a28736297a1ed32f2`.

## Implementación y procedencia

Una sola vista: adaptación de `pages/DashboardPage.tsx` de Taura. Conserva expresiones de cálculo y estructura de hero, próximo pago, horas, desglose y próximos turnos. Cambios de presentación: referencia fija 2026-09-24, copy ficticio/domingo–sábado, eliminación de acciones y lucide, próximo pago como artículo, CSS Modules. Banner sticky persistente y retorno fuera del error boundary. Sin formularios de Trabajo.

`src/modules/work/provenance.json` enumera nueve archivos puros (~20 KB), commit upstream, Git blob SHA-1 y SHA-256 por archivo. Las fuentes vendorizadas son idénticas byte por byte; incluyen tipos, fechas, payroll, contrato, períodos, weekend y tax. No se modifican fórmulas. El cierre quedó pequeño: no hizo falta ampliar a paquetes/páginas/servicios ni recurrir a otra alternativa. El manifiesto también registra el blob de la presentación adaptada.

Es un puente provisional con duplicación física. Actualizar primero Taura, fijar una nueva revisión y actualizar snapshot, manifiesto y paridad juntos. Sustituir por librería compartida antes de integrar datos reales o extender mantenimiento del motor a ambos repos; requiere tarea y autorización aparte. No mantener dos políticas salariales.

## Aislamiento y estado

Fixtures compilados tipados y validados antes del cálculo; sin entradas de usuario/archivos/red, storage ni conexión a Finance. No se importa App/main/useRoster/appStorage, repositorios, exportador, backups, Supabase, PWA ni CSS global Taura. Grafo transitivo cerrado y auditado. React 18 del anfitrión; nuevas dependencias de desarrollo: TypeScript y tipos React/DOM. `tsconfig.work.json` solo comprueba este módulo, no convierte Finance a TS. Tests usan esbuild ya provisto por Vite para ejecutar TS con Node 22.

Dashboard mantiene el mismo árbol financiero en una región estable, ocultada con hidden. Ocho pestañas, activeTab y div hidden original de TauraIncomePreview intactos. Abrir/cerrar demo no desmonta Finance; foco de entrada en título, retorno al botón y scroll restaurado. No hay rutas, recargas ni history push. App.jsx y su guard permanecen sin cambios. El enlace B1 conserva exactamente `https://taura-roster-pay-676l.vercel.app`, target y rel. No hay cambios a Taura, salarios, GEM, presupuestos, persistencia, ingresos reales o INC-01.

## Validación

- `npm test`: PASS, suites Finance existentes, 70 pruebas Node y nuevo `test:work`.
- `npm run typecheck:work`: PASS. `npm run build`: PASS.
- Motor: hashes contra blobs upstream y SHA-256, cierre de imports, auditoría de efectos y CSS, APIs prohibidas antes del import/ejecución, invariancia de fixture, validación negativa, overtime pay/bank, nocturno/weekend, domingo y fechas, PAYE/KS. Paridad de proyecciones con árbol independiente descargado mediante GitHub del SHA fijado, tratamientos pay y bank. Ver parity.log.
- UI sintética 360/390/1280: PASS. Ida/vuelta desde cada pestaña, identidad DOM Finance/planificador, computed display:none, foco, estilos Finance antes/después, sin overflow, ocho pestañas, sesión importada y supuesto 12.34 conservados, presupuesto 42 conservado, storage completo/historial iguales respecto de baseline. El JSON completo conserva saldo/GEM/presupuesto/semana. Capturas access-* y work-*.
- APIs: spies desde init antes del boot para Storage get/set/remove/clear, IDB open/delete (bloqueado), fetch/XHR/WebSocket/EventSource/Worker/SharedWorker/BroadcastChannel, beacon, cache y registro SW. Entrada/salida sin nuevas operaciones. Red externa interceptada; B1 éxito/404/offline simulados, sin visitar Taura vivo. La auditoría de fuentes complementa los spies; no se atribuyen las escrituras legítimas de Finance a la demo.
- Recuperación incompatible/read-error/unsaved conservada. Fallo sintético del formatter usado por demo: error boundary contiene fallo, se puede volver y Finance conserva snapshot.
- Regresión pagos existente: 20 PASS. Planificación existente: PASS escritorio y móvil; resultados y capturas en subdirectorios.
- `git diff --check`: ver diff-check.log.

Se revisaron capturas móviles y desktop. Sin prueba física Android/PWA, lector de pantalla ni auditoría automatizada completa de accesibilidad; no se presentan como verificados. No se garantiza memoria tras recarga/descarte de navegador. Contraste y foco revisados visualmente; tamaño de retorno y acceso >=44px por CSS, layout comprobado por UI. Los primeros intentos corrigieron solo el harness (espera del planner aún vacío y regex de imports que confundía un sufijo de tipo). Fecha ajustada al jueves para mostrar próximo pago con turnos del ejemplo, sin cambiar motor. Build y Chrome requirieron ejecución fuera del sandbox; perfiles propios.

## Reproducción

`npm ci`, `npm test`, `npm run typecheck:work`, `npm run build`. `npm run test:work` siempre verifica identidad con los blobs fijados offline. Para comparación ejecutable independiente, descargar solo los archivos del manifiesto desde ese SHA en un árbol temporal y establecer TAURA_PARITY_ROOT a su raíz antes de test:work; no usar producción ni el checkout vecino sin verificar revisión.

Para UI, establecer PLAYWRIGHT_MODULE a un Playwright externo y CHROMIUM_PATH a Chrome; `npm run test:work-ui` crea su servidor efímero. Pagos: VALIDATION_OUTPUT_DIR apuntando a un directorio propio, `node scripts/validate-card-payments-ui.mjs`. Planificación requiere `npm run serve` en localhost:4173, VALIDATION_OUTPUT_DIR propio y `node scripts/validate-planning-ui.mjs`; repetir con MOBILE=1.

## Rollback y límites

Revertir el commit B2.1, o retirar únicamente imports/estado/regiones de demo de Dashboard, callback/botón interno de ModuleAccessLinks y módulo work/toolchain/tests. Mantener B1, ocho pestañas y App.jsx. No limpiar storage/IDB/caché, reinstalar PWA, migrar backups ni cambiar dominios. Sin despliegue productivo ni cambios Taura. PR abierto sin merge; B2.2/B2.3/B3 e INC-01 no autorizados.
