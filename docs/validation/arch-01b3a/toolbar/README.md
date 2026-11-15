# Botonera superior de Trabajo

Base local y remota verificada antes de editar: `3abd2685eba9df5ce53cc6fe2cb3cf52c8f2835d`.
Rama existente `feat/arch-01b3a-demo-editor`, mismo PR #16. El comentario de
publicación registra el SHA final, status Vercel y preview. Sin merge ni nuevo PR.
PR #15 comprobado sin cambios: `1783afb9edfc731011db0d057561f00fb440f26c`.

## Comparación directa con Taura

Se leyeron directamente por GitHub los archivos del original fijado en
`22665a594a0dc8230aa7ed6a28736297a1ed32f2`:

- [App.tsx](https://github.com/marcosgaier/taura-roster-pay/blob/22665a594a0dc8230aa7ed6a28736297a1ed32f2/src/App.tsx): navegación con Home, CalendarDays y WalletCards, iconos de línea y texto; selección visual de una única vista.
- [styles.css](https://github.com/marcosgaier/taura-roster-pay/blob/22665a594a0dc8230aa7ed6a28736297a1ed32f2/src/styles.css): nav transparente, iconos 21px, etiquetas pequeñas, verde #173e35 para activo; secundario blanco/verde con borde #cddbd6; contenedor máximo 700px.

Finance antes usaba los botones primarios generales del módulo (padding 13px
17px, márgenes 14px), tres párrafos introductorios y retorno duplicado.
Ahora se adapta esa jerarquía al requisito de navegación superior segmentada:
iconos inline 18px sin dependencias, etiquetas 13px, padding 6px 8px, gap 4px,
fondo neutro y una sola vista activa blanca con borde. No se copia la navegación
inferior fija de Taura ni sus estilos globales o mecanismos de almacenamiento.
Volver a Finanzas y Restablecer ejemplo son secundarios discretos de 44px.
La pestaña Resumen sustituye al retorno duplicado y conserva el mismo navigate.

La advertencia DEMOSTRACIÓN — datos ficticios; no es tu roster sigue visible
y sticky. Solo en memoria permanece visible; un details nativo accesible contiene
la fecha fija y las explicaciones completas de reset/salida/recarga/no importación.
No se cambia el estado de sesión, cálculo, editor, calendario o aplicación de lotes.
Producto: únicamente WorkDemo.tsx y su CSS Module; sin App/Finance/recovery,
PAY-01, #32, fixtures, vendor, dependencias, storage, red ni Taura original.

## Capturas comparativas

Misma vista Roster, mismo día seleccionado y fecha fija; viewport 900px de alto.
Los enlaces Antes corresponden a la evidencia ya publicada de la base aprobada.

| Ancho | Antes | Después | Cabecera y foco teclado |
| --- | --- | --- | --- |
| 360 | [Antes · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/deselection/work-regression/work-360.png) | [Después · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/toolbar/work-regression/work-360.png) | [Segmentos · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/toolbar/work-regression/toolbar-360.png) |
| 390 | [Antes · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/deselection/work-regression/work-390.png) | [Después · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/toolbar/work-regression/work-390.png) | [Segmentos · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/toolbar/work-regression/toolbar-390.png) |
| 1280 | [Antes · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/deselection/work-regression/work-1280.png) | [Después · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/toolbar/work-regression/work-1280.png) | [Segmentos · archivo histórico](https://github.com/marcosgaier/finance-app/blob/b5d08af909377960b505d922b9f87ecac6ea5473/docs/validation/arch-01b3a/toolbar/work-regression/toolbar-1280.png) |

Inspección visual de las capturas: etiquetas completas, tres segmentos en una fila,
sin desbordes ni solapamientos en los tres anchos. La advertencia sigue inequívoca.
Texto secundario #435e55 sobre #e7efec y activo #173e35 sobre blanco; foco de 3px
#3c725e. Blancos táctiles mínimos 44x44, incluido retorno y reset.

## Validación

- [npm test](npm-test.log): PASS; incluye paridad independiente ejecutable con Taura vía TAURA_PARITY_ROOT=node_modules/.cache/taura-upstream.
- [typecheck:work](typecheck.log), [build](build.log), [diff-check](diff-check.log): PASS.
- [Work/Finance navegador](work-regression.log): PASS, 360/390/1280, ocho pestañas, recuperación, DOM/CSS/estado/scroll y retorno. Prueba nueva: details abrir/cerrar; orden Resumen/Roster/Pagos; Enter activa cada vista; aria-current único; foco visible; Tab retorno → details → Resumen; blancos >=44 y ausencia de overflow.
- [Editor](editor.log), [resultado](editor/editor-result.json): PASS en tres anchos; preview, conflictos protegidos, lotes Día/Noche, autodesselección tras commit efectivo, cancelación/Escape/sin cambios, IDs, resumen/pagos, reset/salida/recarga.
- [Pagos Finance](payments.log): 20 PASS.
- Planificador [escritorio](planning.log) y [móvil](planning-mobile.log): PASS.

Chrome 157 / Node 22.23.2, zona Pacific/Auckland, perfiles exclusivamente sintéticos,
red externa interceptada. Spies/snapshots certifican cero nuevos efectos Work en
storage/IDB/red/cachés/SW/descargas y persistencia Finance intacta.
La primera ejecución restringida no pudo navegar a localhost; se ejecutó con permiso
para Chrome/servidores locales. La primera aserción nueva de foco programático
necesitó activar modalidad de teclado con Tab antes de comprobar focus-visible.
No se modificó producto para adaptar esa prueba. Tras quitar el retorno duplicado
se repitieron npm test, typecheck, build, Work/Finance y editor.

El conector Vercel respondió 403 al listar deployments de finance-app/margab27;
no hay CLI vercel instalada. El status del SHA se verifica por GitHub y se enlaza
al publicar. Los logs de este directorio certifican el build local; no se presentan
como logs remotos Vercel. Android/PWA físico y lector de pantalla real pendientes.

Reproducir: npm test; npm run typecheck:work; npm run build; git diff --check.
Para UI definir PLAYWRIGHT_MODULE al Playwright externo y CHROMIUM_PATH a Chrome,
y VALIDATION_OUTPUT_DIR para cada suite. Ejecutar test:work-ui, test:work-editor-ui,
test:payments-ui. Servir dist con scripts/serve-dist.mjs en localhost:4173 y ejecutar
test:planning-ui, luego con MOBILE=1. Sin dependencias añadidas.
Rollback: revertir este refinamiento, sin migraciones ni limpieza de datos.
