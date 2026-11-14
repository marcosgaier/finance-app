# ARCH-01B3a — contrato del editor sintético

[Issue autorizada #31](https://github.com/marcosgaier/taura-roster-pay/issues/31),
subetapa de [arquitectura #30](https://github.com/marcosgaier/taura-roster-pay/issues/30).
Finance main verificado `64ca62dfabbef5e790c96036aa100abaae037436`.
Taura ShiftEditor/shiftTemplates/types consultados directamente en GitHub al SHA
`22665a594a0dc8230aa7ed6a28736297a1ed32f2`; no se copian sus hooks ni efectos.

## Propiedad de datos

`DemoSession`, dentro del error boundary de Trabajo, deriva una copia mutable de
`validateDemo().shifts`. Es el único estado React del escenario. Resumen, Roster
y Pagos reciben la misma lista ordenada por fecha/inicio (incluidos múltiples
turnos del mismo día). Las fórmulas y pantallas salariales son las existentes;
solo cambia su entrada ficticia. No se modifican fixtures congelados, settings,
payslips, preferencias overtime ni el motor puro. App, Dashboard y las ocho
pestañas permanecen intactos. Salir de Trabajo desmonta DemoSession y recargar o
reabrir restaura el ejemplo; «Restablecer ejemplo» exige confirmación y también
restaura calendario/selección iniciales.

`editor/shiftDraft.ts` es un adaptador puro: crear borrador, validar, commit de un
único ID y acciones explícitas. No conoce componentes financieros ni repositorios.
Cada retorno es una copia profunda. Commit preserva ID original, created_at y
campos desconocidos; no se reemplazan otros turnos por coincidir la fecha.
Duplicar crea ID distinto y estado planificado, sin horas trabajadas ni timestamps
heredados. Cancelar conserva el registro con status cancelled; el motor fijado
lo excluye de horas y pagos. Eliminar exige confirmación y solo afecta el ID
elegido, irreversiblemente durante esta demo; restablecer recupera el fixture.

## Validación y estados

- Fecha civil estricta, año del ejemplo 2026–27, horarios completos y válidos;
  inicio en la fecha elegida y fin posterior. Se informa que cambiar fecha exige
  ajustar horarios. Tipo nuevo restablece explícitamente horario/datos trabajados
  del borrador, sin perder campos ajenos al editor.
- Diurno, nocturno, libre, licencias anual/enfermedad y personalizado del modelo
  existente. Libre tiene horas/rate cero y ningún horario; licencias usan estados
  planificado/pago/no pago/cancelado. No se introduce holiday ni reglas PAY-01.
- Números finitos no negativos, horas pagadas hasta 12, pausas sin consumir todo
  el turno, horas no superiores al intervalo disponible. Máximo 12 horas civiles
  del turno; en otoño NZ pueden ser 13 transcurridas con 1 de pausa y 12 pagadas.
  El nocturno de primavera tiene 11 horas transcurridas; no se normaliza a 12.
- Resolución explícita Pacific/Auckland para las transiciones del año del ejemplo:
  +12/+13. Horarios inexistentes o ambiguos por DST se rechazan con explicación;
  no se adivina offset. El motor vendorizado conserva su comportamiento original
  de zona local; los pases ejecutables usan TZ Pacific/Auckland.
- Datos trabajados opcionales tipados, separados del plan. Solo estados worked/
  modified consumen esos valores según el motor existente; no se autoconfirma
  trabajo o cobro al editar. No se ofrecen payslip/confirmed. Un registro recibido
  con esos estados (también el inválido paid) bloquea editar/duplicar/cancelar/
  eliminar en UI y API pura: consulta exclusivamente.
- Validación fallida nunca hace commit. Todo salario visible sigue siendo una
  estimación ficticia, sin entradas de ingreso confirmado de Finance.

## UI y aislamiento

DayDetails presenta cada turno por ID y acciones individuales, también «Agregar
turno» en días vacíos. El editor usa dialog nativo modal, nombre/descripción,
labels, error role=alert, foco inicial, Tab encerrado, Escape sin guardar y retorno
de foco. Eliminación retorna el foco al título de detalle. CSS Modules encapsula
controles y scroll del diálogo a 360/390/1280 px; no se importa CSS global Taura.
B1 y la salida «Volver a Finanzas» conservan su comportamiento.

No hay lecturas/escrituras de almacenamiento, API/red, cachés, descargas, SW,
filesystem o rutas nuevas desde el módulo. No se importa Taura App/useRoster,
repositorios/adaptadores, migraciones, exportadores ni configuración/PWA. Las
únicas escrituras en filesystem son logs/capturas sintéticos de los tests.

## Verificación, riesgos y rollback

Ver [logs, capturas y reproducción](validation/arch-01b3a/README.md). Se verifican
invariantes del fixture/IDs/campos futuros, errores sin mutación, cancelación,
eliminación confirmada, fechas/nocturnos/DST, tipos/estados y protección renderizada.
Chromium comprueba edición y recálculo coherente entre Resumen/Pagos, navegación,
reset/salida/reload sin efectos. Se reejecutan las suites financieras, Work/B1/
recovery, 20 pagos UI y planificador. El motor conserva paridad upstream ejecutable.

Riesgos pendientes manuales: teclado y scroll Android físico, PWA, lector de
pantalla, zoom nativo y otras zonas/navegadores. No se certifica ningún origen de
producción ni migración futura. La confirmación nativa de eliminación/reset
requiere validación manual con esas tecnologías de asistencia. Sin merge
aprobado, el rollback consiste en cerrar este PR; tras una integración aprobada,
revertir su commit restituye Work de solo lectura, sin migraciones ni datos que
reparar. El usuario debe revisar visualmente la demo antes de autorizar merge.
