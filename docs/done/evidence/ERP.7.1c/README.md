# ERP.7.1c — entrega del ejecutor

Implementación aplicada; ítem sin cerrar. Ejecutado por: Codex (ejecutor). Sin delegar, sin commit y sin editar PLAN.md/NEXT.md.

- Selector de modo visible con proyecto, default Auto-edit, persistencia `orchestos.approvalMode`.
- El envío del chat valida y persiste el modo; cliente antiguo sin campo usa auto-edit.
- Capacidad declarada en `KNOWN_CLIS`, solo Codex soporta aprobación por acción; el resto recibe full en el harness.
- `taskReport` conserva pedido/efectivo y nombre del CLI del registro; la tarjeta muestra el aviso cuando difieren.
- No cambia el default de Codex fuera del chat, adaptadores Claude/OpenCode, franja ni manual/yolo.

## Gates y salida cruda

Comandos exactos y códigos de salida: [gates.json](gates.json).

| Gate | Exit | Salida completa |
|---|---:|---|
| bunx tsc --noEmit | 0 | [tsc.log](tsc.log), vacío |
| typecheck raíz + app | 0 | [typecheck.log](typecheck.log) |
| Tests nuevos/afectados | 0 | [tests.log](tests.log): 106 pass, 0 fail, 445 aserciones |
| lint | 0 | [lint.log](lint.log): 952 warnings, 378 infos, 0 errores |
| build:app | 0 | [build-app.log](build-app.log) |
| Gate en vivo | 1 | [live.log](live.log); intento inicial [live-fixed-port.log](live-fixed-port.log) |
| security:gate | 1 | [security-gate.log](security-gate.log): 1845 pass, 2 skip, 4 fail |

El servidor real no pudo abrirse: EADDRINUSE con puerto fijo 62473 y con puerto dinámico 0; lsof no mostró un listener en 62473.
No se llegó a Playwright ni a los CLI: no hay capturas ni evidencia de UI aprobada. `live.ts` queda listo para correr fuera del sandbox.
`../ERP.7.1c-live.json` declara `pass: false`.

Los cuatro fallos de security:gate son adversarial-review (2: sandbox anidado/EPERM), run_readonly (1: warning de confstr/DARWIN_USER_TEMP_DIR
alterando su salida esperada) y csrf-origin (1: EADDRINUSE al abrir el servidor). No se modificaron esos módulos/tests ni se relajaron los gates.

La primera ejecución de tests tuvo un ReferenceError introducido al modificar el helper del test task-report; corregido.
La salida inicial se conserva en `tests-initial.log`; `tests-before-final.log` guarda la tanda previa a las últimas aserciones.
`composer-selectors.log` contiene la búsqueda requerida en todos los ui-gates; los textos/selectores existentes del modelo y franja se conservan.
`format.log`/`format-final.log` y `handoff.log` conservan las salidas auxiliares. JSON de evidencia formateados con Biome.

Los cambios ajenos `.orchestos/feature-status.json` y `runs-summary.json` se dejaron intactos. No se borró el spec.
