# Evidencia sintética INT-03C2

- [Pruebas unitarias y regresiones financieras](npm-test.txt)
- [Build](build.txt)
- [Resultado planificador](planner-result.json) y [log](browser.txt)
- [Escritorio](planner-desktop.png), [móvil](planner-mobile.png)
- [Regresión visor existente](preview/int-02b-ui-result.json)
- [Contrato y límites](../../int-03c2-planning-ui.md)

Perfil Chromium efímero nuevo, solo localhost, reloj NZ controlado. Los valores
proceden del fixture sintético versionado y sampleFinanceData; no se usa el perfil
real ni se cargan datos financieros personales. Se instrumenta después de sembrar
el perfil. Las únicas escrituras esperadas son las acciones deliberadas en la UI
normal del presupuesto/semanas sintéticas; cada bloque siguiente compara contra
un baseline nuevo. En reload se reinicia el contador de instrumentación y se
verifica nuevamente persistencia idéntica y cero escrituras en esa nueva página.
El payload financeData de dos backups descargados también se compara en memoria;
no se conserva ningún backup como artefacto.

## Reproducir

```sh
npm ci
npm test
npm run build
npm run serve
# En otra terminal; requiere Playwright y Chromium instalados fuera del proyecto:
CHROMIUM_PATH=/usr/bin/chromium \
PLAYWRIGHT_MODULE=/workspace/.cloud-tools/node_modules/playwright/index.mjs \
npm run test:planning-ui
CHROMIUM_PATH=/usr/bin/chromium \
PLAYWRIGHT_MODULE=/workspace/.cloud-tools/node_modules/playwright/index.mjs \
VALIDATION_OUTPUT_DIR=docs/validation/int-03c2/preview npm run test:taura-ui
git diff --check
```

Sin TAURA_EXPORTER_MODULE usa el fixture ya exportado de Taura. Para reproducir
exactamente el pase registrado con exportador real, recuperar desde GitHub el
blob `d2ba6ea982d159907b432351000a4d4dd1582a6b` de marcosgaier/taura-roster-pay,
decodificar su contenido a `/tmp/taura-incomeProjections.ts` y usar Node 24:

```sh
gh api repos/marcosgaier/taura-roster-pay/git/blobs/d2ba6ea982d159907b432351000a4d4dd1582a6b \
  --jq .content | base64 --decode > /tmp/taura-incomeProjections.ts
TAURA_EXPORTER_MODULE=/tmp/taura-incomeProjections.ts \
CHROMIUM_PATH=/usr/bin/chromium \
PLAYWRIGHT_MODULE=/workspace/.cloud-tools/node_modules/playwright/index.mjs \
npm run test:planning-ui
```

En este entorno se obtuvo ese archivo mediante el conector GitHub (el CLI `gh api`
no tiene acceso), sin modificar Taura. No se cambió ninguna dependencia de Finance.
El resultado declara si se ejecutó el exportador o solo el fixture. Cambiar las
rutas de herramientas según el entorno. Los scripts rechazan destinos no locales.
