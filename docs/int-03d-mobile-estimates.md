# INT-03D — Estimaciones Taura en móvil

Base leída: `main` de Finance App, `7e510b03200c3eb8a29c04f55ee01b1682a34c8f`.
Alcance aprobado en [Taura #17](https://github.com/marcosgaier/taura-roster-pay/issues/17#issuecomment-6866553819).

## Wireframe implementado

```text
Estimaciones Taura
Estimado / no cobrado / no disponible
Cómo importar y límites [desplegable]
[Reemplazar archivo] [Descartar]
Generación · origen
Archivo importado correctamente · N períodos
Advertencia fiscal / roster y acceso al detalle
Planificación · horizonte 4–8 semanas
┌ Semana martes → lunes ──────────────────┐
│ Estado · cobertura                     │
│ Neto estimado      Gastos / por revisar│
│ Aportes            Margen indeterminado│
│ ▶ Revisar esta semana                 │
│   ▶ Ver desglose de gastos base        │
│   ▼ Gastos: selector + importe temporal│
│   ▶ Deudas y ahorro                    │
│   ▶ Vencimientos opcionales            │
│   [Revisar y calcular] [Restablecer]    │
└────────────────────────────────────────┘
Otras semanas (4 iniciales; grilla en escritorio)
Total condicional · períodos fuera del rango
▶ Detalle de ingresos · N períodos
  Visor completo de bruto / PAYE / KiwiSaver / neto
  Advertencias y reglas por período
```

Antes: el visor salarial completo precedía al plan y el editor presentaba un botón por gasto. Véanse las [capturas del main previo](validation/int-03c2/review-fixes/preview/int-02b-preview-mobile.png) y el [editor previo](validation/int-03c2/review-fixes/planner-mobile.png). Después: [resumen móvil con 12 períodos](validation/int-03d/mobile/overview.png), [editor móvil](validation/int-03d/mobile/planner-mobile.png) y [escritorio](validation/int-03d/desktop/overview.png). Son datos sintéticos; las capturas anteriores usan el fixture original de tres períodos, por lo que no constituyen una comparación de cifras con el escenario nuevo de doce.

## Cambios y límites

- Solo componentes de estimaciones, CSS acotado, scripts de validación y documentación. Sin dependencias nuevas.
- Las tarjetas usan directamente los resultados existentes: ningún importe de gastos/aportes se muestra como revisado antes de la confirmación. El margen sigue indeterminado si falta revisión o ingreso, hay exclusión o presupuesto stale. El total conserva el criterio del motor.
- El selector conserva `targetId`; el reemplazo usa el mismo editor temporal y requiere revisión explícita. Las secciones permiten agregar, editar y quitar los supuestos existentes, y confirmar listas vacías.
- El input conserva su reset técnico y el flujo asíncrono original. Un botón accesible abre el selector; la confirmación visible no depende del valor vacío del input. No se guarda nombre ni archivo.
- El aviso anterior dependía de cualquier diferencia serializada del plan, sin exigir supuestos existentes. Ahora solo anuncia descarte cuando existían supuestos y el controlador efectivamente cambia el plan. Distingue rango de ciclo de semanas. La configuración e invalidación conservadora del controlador no cambian. No se reproduce ni se atribuye una causa exacta a la captura del usuario con datos reales.
- Acordeones nativos, foco visible, controles de al menos 44 px y pruebas a 360/390 px. Sin auditoría con lector de pantalla real.
- Corrección auxiliar en `serve-dist.mjs`: comprobar la ruta raíz antes de normalizarla en Windows; antes `/` se convertía en `\\` y el servidor intentaba leer un directorio (EISDIR). No cambia la aplicación.
- Sin modificaciones en parse/hash, ingresos Taura, `incomePlanning`, `expensePlanning`, `planningSession`, motor operativo, historial, backups, persistencia o datos de Taura. No se detectó una falla de cálculo que requiriese intervenir en el motor.

## Reproducción

Ejecutar `npm test`, `npm run build`, `git diff --check`; iniciar `node scripts/serve-dist.mjs`. Configurar `PLAYWRIGHT_MODULE` con el `index.mjs` del Playwright externo del runtime, `CHROMIUM_PATH` con Chrome local y `PREVIEW_URL` con localhost. Ejecutar `node scripts/validate-planning-ui.mjs` con `VALIDATION_OUTPUT_DIR` separado para escritorio y móvil (`MOBILE=1`). Ejecutar también `node scripts/validate-taura-preview.mjs` con otra carpeta de salida. No se necesita instalar dependencias ni usar perfiles reales.

Los escenarios operativos de presupuesto y ciclo de semana modifican exclusivamente el perfil sintético aislado para provocar la invalidación; el runner compara un nuevo baseline después de cada acción operativa. No atribuye al plan esas escrituras operativas. Las comprobaciones del plan comparan Storage, IDB, caché, canales, URL, otras pestañas y backup exportado.
