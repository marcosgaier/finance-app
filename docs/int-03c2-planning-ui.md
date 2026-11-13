# INT-03C2 — planificación visible y efímera

Implementa [Taura #16](https://github.com/marcosgaier/taura-roster-pay/issues/16),
sobre Finance main `561002fdb5638792249d294a650846d1326bbb49` (C1 integrado).
Instrucciones y contrato C1 leídos desde GitHub. No hay cambios en Taura,
dependencias, persistencia, motor financiero, balances ni reglas de deuda.

## Flujo y límites de datos

Estimaciones Taura → importador existente `parseTauraPreview` → única instancia
`createPlanningSession` por `useRef` → motores puros → tarjetas semanales.
El JSON validado vive en un único estado React del visor. El controlador conserva
solo su escenario derivado; no crea un segundo importador/restaurador. La pestaña
sigue montada al navegar. No hay API servidor, credenciales, red de proyecciones,
serialización, setter financiero, botones de pago ni sincronización.

Dashboard entrega copias de id/amount de weeklyExpenses/monthlyExpenses y solo
groceries/fuel. No entrega ingresos, balances, deudas ni callbacks financieros.
El adaptador C1 mantiene los datos ausentes/invalidos indeterminados. Se presentan
las fuentes semanales, mensuales (7/30 conjunto), variables y subtotal calculado.
Los reemplazos mensuales conservan su unidad mensual antes de provisionar 7/30.

La selección borra inmediatamente escenario y visor anteriores, antes de leer el
archivo. Conserva ambas guardas: `request.current` y token de C1. Rechazo, backup,
conflicto, hash/código inválido, exceso de tamaño, descarte y reload no restauran
un escenario anterior. Ningún cambio se guarda en Storage, IDB, URL, caché o cloud.

Por defecto son cuatro semanas desde el próximo martes civil NZ, con 5..8
opcionales. La fecha inicial se fija al importar, incluso si pasa el tiempo.
`configure` reconstruye del mismo preview validado; al cambiar horizonte o el
estado relevante de una semana operativa descarta **todos** los supuestos. Es una
decisión conservadora: también obliga a revisar nuevamente semanas no afectadas.
Su `generation` remonta editores locales (incluido texto de importes inválidos).
Una sincronización idéntica conserva revisiones. No se reparten días trabajados:
la agrupación sigue siendo por payDate.

`useLayoutEffect` sincroniza base y metadatos antes del siguiente paint; no muestra
un margen que acaba de quedar obsoleto. `checkBudget` bloquea todos los resultados
hasta «Actualizar base y descartar supuestos»; cambiar horizonte no evita ese
bloqueo. No se actualiza el snapshot silenciosamente. Cerrar/reabrir/volver a
cerrar una semana desde la UI normal la excluye del futuro y borra revisiones.

Cada edición llama `editWeek` y vuelve a pendiente. Solo «Revisar y calcular»
llama después `reviewWeek`; las tres listas son explícitas. «Sin asignaciones» se
confirma con esa acción; no se inventan pagos ni mínimos. Los importes admiten
punto/coma decimal, centavos seguros y no negativos; los inválidos bloquean la
revisión. Un desborde al combinar importes descarta los supuestos de esa semana,
con error visible, en lugar de mantener el margen previo.

Deuda y ahorro/sobres son siempre aportes adicionales, con ayuda contra doble
conteo. No se expone financiación de gastos ya presupuestados. Las guardas C1
siguen intactas para consumidores internos. Vencimientos son anotaciones
manuales ligadas a un gasto/aporte; no restan de nuevo. Se listan todos los
revisados, también fuera de semana y después del cobro, con alerta si preceden a
algún payDate. No se infieren vencimientos operativos ni cobertura de pagos.

Los estados son textuales además de visuales: pendiente, excluido, desconocido,
cero explícito, hipotético y cobertura parcial. Cero puede significar roster
incompleto. Un hueco pendiente/unknown/excluido oculta total/acumulado completo,
aunque otras semanas tengan márgenes. Cuando todas se revisaron y tienen ingreso
conocido, el total sigue rotulado **hipotético parcial**, nunca saldo disponible.
Las advertencias PAYE/feriados/cobertura del visor se conservan.

## Verificación reproducible (14 noviembre 2026, NZ)

Ver [evidencia](validation/int-03c2/README.md), logs, JSON y capturas versionadas.
Node v24.22.1; Chromium 156.0.8078.79; Playwright externo 1.65.0; perfil temporal
nuevo con datos sintéticos, sin sesión de usuario y solicitudes externas bloqueadas.

- `npm test`: suites financieras, persistencia, pagos históricos, cerrar/reabrir/
  cerrar y 48 tests del parser/motores/controlador, incluidos cambios 4..8,
  sincronización sin pérdida de revisión, invalidación por semanas y base stale.
- `npm run build` y `git diff --check`.
- Chromium sobre build local: exportador v1 real invocado con proyecciones
  sintéticas → archivo → visor/plan; revisión de gastos/reemplazos/deuda/ahorro,
  centavos y coma decimal, vencimientos anteriores/posteriores, déficit, cero y
  unknown, total condicionado, tabs, móvil/teclado y errores accesibles.
- Cambios de presupuesto y ciclo cerrar/reabrir/cerrar efectuados por la UI
  normal **solo en el perfil sintético** para verificar invalidaciones. Se crea
  un nuevo baseline tras cada acción operativa deliberada.
- Instrumentación compara Storage, IDB, BroadcastChannel, cachés y URL. Cero
  actividad atribuible al plan; persistencia, Dashboard, historial, deudas,
  reservas y payload financiero de backup exportado sin cambios por planificación.
- Regresión independiente del visor: ocho flujos, incluido conflicto, backup,
  tamaño/hash, tokens obsoletos, descarte/reload y móvil.

No certifica deployment, PWA/offline, Safari/Firefox, lector de pantalla real ni
el botón de exportación en la UI de Taura. El exportador real (blob inmutable
`d2ba6ea982d159907b432351000a4d4dd1582a6b`) se leyó de GitHub y se ejecutó en
Node antes del upload Chromium; el cálculo de nómina de Taura no forma parte de
esta entrega. Accesibilidad verificada con labels/roles, teclado y viewport móvil,
no auditoría WCAG completa. Ningún dato financiero personal fue leído o modificado.
