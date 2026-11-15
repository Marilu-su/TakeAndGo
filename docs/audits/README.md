# T04 — Índice y cierre documental reducido

Consolidación: 14/11/2026, America/Buenos_Aires. Rama: feature/T04-auditoria-cumplimiento.
Base de código auditada: `54b84064dc393477ec197c202a5ebd8a48b56aa8` de develop.
Las consultas de GitHub/web del 14/11 no equivalen a nuevas ejecuciones de suites.
Este cierre documenta límites y brechas; no certifica el MVP ni declara T04 DONE.

## Entregas y cronología

| Documento | Finalidad / límite |
|---|---|
| [Resumen ejecutivo](T04-RESUMEN-EJECUTIVO.md) | Dictamen vigente, responsables y pendientes |
| [Matriz RN](T04-MATRIZ-CUMPLIMIENTO.md) | 184 evaluaciones; 6 PROBADO, sin porcentajes de cumplimiento |
| [Frontend](T04-FRONTEND.md) | 39 pantallas; recorrido autenticado, responsive y accesibilidad pendientes |
| [Backend](T04-BACKEND.md) | 35 rutas registradas y distinción entre código, exposición y funcionamiento |
| [Testing](T04-TESTING.md) | 59 archivos/329 declaraciones; resultados de producto históricos con skips |
| [Infraestructura](T04-INFRAESTRUCTURA.md) | GitHub/CI/CD consultados el 14/11; paneles cloud no verificados |
| [Despliegue público](T04-DESPLIEGUE-PUBLICO-2026-11-13.md) | Observaciones separadas del 13/11 y 14/11: portada 200, rutas 404 y URL API no disponible en circuito observado |
| [Relevamiento inicial](T04-RELEVAMIENTO-INICIAL.md) | Snapshot del 12/11, no estado actual |
| [Seguimiento](T04-SEGUIMIENTO-2026-11-13.md) | Snapshot del 13/11 y caracterización B07; no describe commits posteriores |

Commits ya realizados: 7c524db (RN), 5a6a307 (frontend), de8a43d (backend/testing),
afbb927 (infraestructura/despliegue). El cierre reducido todavía espera aprobación
para git add/commits. Cada futura operación Git requiere autorización; antes de
cada commit se presentan archivos, pruebas y mensaje. No se autoriza push, merge,
PR, configuración o despliegue por el mero hecho de completar documentación.

## Fuentes preservadas

Se seleccionaron 20 fuentes originales, sin editar. Sus hashes originales se
conservan en [source-sha256.json](evidence/source-sha256.json): Master y plan ya
versionados más 18 referencias nuevas. El manifiesto enumera el alcance exacto;
no promete preservar todo el paquete local recibido.

- [Master V2.0](../reference/v2/TAKEANDGO_MASTER_V2_0.md): autoridad funcional RN-001–184.
- [Pantallas V2.0](../reference/v2/PANTALLAS_V2_0.md): 39 pantallas y 13 estados visuales.
- [Plan oficial](../reference/planning/TAKEANDGO_PLAN_VERIFICADO_REPO_2026-11-12.md): tareas y responsables.
- [Solicitud original](../reference/planning/T04-SOLICITUD.md): alcance histórico; las autorizaciones posteriores del usuario prevalecen sobre restricciones originales.
- [Consigna TPI](../reference/tpi/CONSIGNA-TPI-2026.pdf): fuente académica.
- Los 14 TDD-0001–0014 y [su índice](../reference/v2/tdds/TDD_INDEX_V1.md), enumerados
  individualmente en el manifiesto: borradores de referencia para contrastes del
  backend, no especificaciones aprobadas/promovidas a docs/tdds/. El índice y
  algunos TDD mencionan V3; para T04 prevalece Master V2.0.

Permanecen exclusivamente locales siete copias auxiliares bajo docs/reference/v2/:
AGENTS(1).md, AI-DECISIONS.md (plantilla), CODEX_WORKFLOW.md,
ONE_PAGER_TAKEANDGO_V2_0.md, PROJECT_START_HERE.md, README.md y
tdds/TDD_TEMPLATE_TAKEANDGO_V1.md. No se borraron ni movieron; no forman parte del
manifiesto reducido ni del commit propuesto. El historial AI-DECISIONS.md de la raíz
es otro archivo y no se modifica en este cierre.

## Evidencias y prueba auxiliar

- [github-snapshot.json](evidence/github-snapshot.json): snapshot del 12/11, no consulta actual.
- [followup-2026-11-13.json](evidence/followup-2026-11-13.json): seguimiento y resultado histórico B07.
- [npm-audit-production.json](evidence/npm-audit-production.json): 13 paquetes afectados, evidencia histórica; no prueba explotabilidad actual.
- [Caracterización B07](tests/payment-compensation.characterization.test.ts): caso real con dependencias en memoria. PASS reproduce el bloqueo de retry; no resuelve el reembolso ni acredita DB/proveedor.

Los snapshots no son logs TAP completos. La reconsulta del 14/11 está documentada
en infraestructura/despliegue; no se fabricó un snapshot nuevo ni se reescribieron
los históricos. No se conservan tokens, contraseñas ni valores privados.

## Estados y reproducción documental

PROBADO se limita al circuito indicado; PARCIAL indica implementación incompleta;
PENDIENTE_INTEGRACION distingue trabajo fuera de BASE; PENDIENTE_VALIDACION indica
evidencia insuficiente; NO_LOCALIZADO no demuestra ausencia absoluta; BLOCKER señala
un impedimento concreto. No se calculan porcentajes ni se equipara archivo con función.

Desde la raíz, sin escribir:

```powershell
python -B docs/audits/scripts/validate_audit.py
python -B docs/audits/scripts/build_matrices.py --check
```

Estos comandos validan solo las 184 RN: IDs, textos del Master, campos, tareas y
sincronización JSON/matriz. No validan automáticamente pantallas, enlaces, hashes,
este cierre, servicios cloud o pruebas de producto. Sus controles se realizan aparte.
La matriz RN se genera desde data/rn-cumplimiento.json y Master; la de pantallas
se mantiene manualmente. No se cambiaron sus evaluaciones en este cierre.

La operación explícita build_matrices.py --update-hashes recalcula únicamente las
rutas ya registradas en el manifiesto: no descubre otras fuentes locales. No debe
usarse para ocultar cambios de originales: comparar hashes con evidencia aprobada.
Añadir una fuente nueva requiere selección y revisión documental explícitas.

B07 se puede ejecutar con dependencias locales, sin DB ni servicios externos:

```powershell
node apps/api/node_modules/tsx/dist/cli.mjs --test docs/audits/tests/payment-compensation.characterization.test.ts
```

PostgreSQL, Neon, pasarela, flujos autenticados y pruebas de producción requieren
entorno dedicado/autorizado y no se ejecutan como parte del cierre reducido.
El plan T04 también pide publicación/revisión; no se declara completada ni se crean
issues/PR sin autorización. Los bloqueos de aceptación permanecen explícitos.
