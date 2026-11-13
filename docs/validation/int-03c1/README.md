# Evidencia INT-03C1 — 2026-11-14 (NZ)

- Node v22.23.2, Vite 6.4.2, Chrome/Chromium 157.0.8103.52, Windows.
- `npm test`: PASS; cuatro suites operativas y 46/46 tests node:test.
  Salida real en `npm-test.txt`.
- `npm run build`: PASS; 49 módulos. Salida real en `build.txt`.
- `git diff --check`: PASS.
- Regresión sintética del visor: PASS, ocho grupos; resultado real en
  `int-02b-ui-result.json` (el nombre conserva el del runner original).
  Cero escrituras Storage/IDB, cero aperturas IDB/canales, sin solicitudes
  externas ni errores de página. Dashboard y persistencia idénticos.

## Reproducir

Ejecutar `npm test`, `npm run build` y `git diff --check`.
Para navegador, usar Playwright externo sin cambiar dependencias del proyecto:
definir `PLAYWRIGHT_MODULE` al `index.mjs` instalado y `CHROMIUM_PATH` al binario.
Definir `PREVIEW_URL=http://127.0.0.1:4175` y
`VALIDATION_OUTPUT_DIR=docs/validation/int-03c1`.
En Windows se ejecutó servidor y runner en el mismo proceso:

```js
// node --input-type=module -e '<este código>'
const { preview } = await import('vite');
await preview({ preview: { host: '127.0.0.1', port: 4175, strictPort: true } });
try {
  await import('./scripts/validate-taura-preview.mjs');
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
```

El runner usa exclusivamente el fixture sintético de Taura PR #9 y datos sample,
perfil temporal y bloqueo de tráfico externo. Se corrigió `fileURLToPath` en
sus capturas para Windows y se añadió directorio configurable para no reemplazar
evidencia anterior. Las capturas generadas no forman parte del PR.

Hubo intentos previos fallidos por aislamiento de localhost, por el servidor
auxiliar `serve-dist.mjs` con rutas Windows y por rutas de capturas; el resultado
PASS corresponde al comando final con Vite preview y rutas corregidas.

## Alcance certificado

El build de producción conserva exactamente el visor existente, sin importar
el módulo interno nuevo. La regresión de navegador verifica ese visor, no una
pantalla C2. El controlador de C1 se ejecuta directamente en tests sintéticos
con APIs de Storage/IDB/red y campos operativos prohibidos mediante getters:
cero accesos y entradas congeladas sin mutación. No se usaron perfiles reales.
La futura conexión React debe cumplir el ciclo documentado antes de exponerse.
No se afirma validación de deployment, PWA ni todos los navegadores.
