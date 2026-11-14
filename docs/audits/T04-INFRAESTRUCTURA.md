# T04 — GitHub, CI/CD, despliegue y consigna

Consulta inicial: 12/11/2026. Observación pública inicial: 13/11/2026.
Reconsulta aprobada: **14/11/2026, America/Buenos_Aires**.
Repo: [TakeAndGo](https://github.com/Marilu-su/TakeAndGo).
Detalle público: [observaciones del 13/11 y 14/11](T04-DESPLIEGUE-PUBLICO-2026-11-13.md).

## Alcance y cronología de evidencia

El 14/11 se ejecutó git fetch origin --prune y se consultaron recursos GitHub GET,
workflows versionados, logs históricos y seis rutas públicas por GET. Se leyó la
portada con JavaScript en navegador sin login ni formularios. El fetch actualizó
referencias, sin cambiar rama, checkout ni archivos del proyecto.

La fecha de consulta no es fecha de ejecución de CI: los runs del 09/11 y 10/11
son históricos, reconsultados el 14/11. No se reejecutaron workflows ni suites.
La actualización documental posterior conserva esa evidencia; no es otra consulta.
Los snapshots evidence/github-snapshot.json y evidence/followup-2026-11-13.json
son históricos (12/11 y 13/11), no snapshots nuevos de la reconsulta del 14/11.
No se accedió al panel de Vercel, consolas cloud ni valores secretos.

## Ramas consultadas el 14/11/2026

| Rama | SHA remoto tras fetch | Situación comprobada |
|---|---|---|
| main | 23d857dbe159db6d9a005251106b9adf9a77480f | Sin protección efectiva visible; no se presupone versión productiva |
| develop | 54b84064dc393477ec197c202a5ebd8a48b56aa8 | Base de código de las matrices RN/frontend/backend |
| feature/C2-frontend-rutas-base | 7831234b2875c67c01daf81508b52e76e0e60b9b | PR #89 abierto hacia develop, no integrado |
| feature/C3-01-menia | fae7add08f318e6a554947067328bdf3049bb1b4 | Tres commits delante de develop; no integrado; sin PR abierto devuelto |
| feat/C2-19-pickup | a65c40f44e41e284688485bfca7752b90373b912 | Conserva archivo E2E fuera de BASE; no significa ausencia de todo pickup |
| feat/C2-20-e2e-kitchen-pickup | 3c21a2d16a3590e43c22f6e843bdd521d9f05328 | E2E pendiente fuera de BASE; ver T04-TESTING.md |

Evidencia: git fetch y refs origin; GET
https://api.github.com/repos/Marilu-su/TakeAndGo/branches?per_page=100.
No se detectaron cambios de esos SHA respecto del relevamiento anterior.

## Gobierno Git: confirmado y no verificado

| Control | Evidencia GET del 14/11 | Resultado / límite |
|---|---|---|
| main/develop | /repos/Marilu-su/TakeAndGo/branches/main y /branches/develop | protected=false; protection.enabled=false; required_status_checks enforcement_level=off, contexts/checks vacíos |
| Protección administrativa detallada | /branches/main/protection y /branches/develop/protection | 403 Resource not accessible by integration: detalle administrativo NO VERIFICADO; no se sustituye por una suposición de permisos |
| Ruleset | [23904079](https://github.com/Marilu-su/TakeAndGo/rules/23904079), GET /rulesets y /rulesets/23904079 | enforcement=disabled; incluye main/develop; deletion/non_fast_forward/required_signatures; no reglas de PR/reviews/checks obligatorios en ese ruleset |
| Revisión cruzada/checks obligatorios | Metadata de ramas y ruleset anterior; flujo en Master/CONTRIBUTING | Documentados pero no exigidos por los controles efectivos visibles; no se afirma auditoría de toda configuración administrativa/organizacional |
| PRs abiertos | GET /pulls?state=open&per_page=100 | Un resultado: #89; no se devolvió PR abierto MenIA |
| PR #89 | [PR](https://github.com/Marilu-su/TakeAndGo/pull/89), GET /pulls/89 y /pulls/89/reviews | open, merged=false, 49 archivos, mergeable=true/clean, reviews=[]; fusionable no equivale a aprobado ni funcionalmente completo |
| Rama default | Metadata histórica del 12/11 | develop en consulta original; no se revalidó ese campo específicamente el 14/11 |
| Projects/WIP | Referencia documental en CONTRIBUTING | Panel/límites NO VERIFICADO; no atribuir cumplimiento efectivo |
| Conventional Commits | Inspección histórica de mensajes y CONTRIBUTING | Convención documentada; enforcement no localizado en controles visibles; no nueva auditoría individual |

## Workflows y últimas ejecuciones

Archivos existentes, confirmados en árbol remoto develop y copia local sin diff:
.github/workflows/api-ci.yml y .github/workflows/deploy-web.yml. .gitkeep no es un
workflow. La colección API /actions/workflows fue rechazada por el conector; se
usó GET /contents/.github/workflows?ref=develop y /actions/runs?per_page=10.
No se interpreta el rechazo del conector como ausencia de workflows.

| Flujo / alcance | Fecha del run (UTC) | SHA | Resultado reconsultado el 14/11 |
|---|---|---|---|
| API CI, último global y del PR #89: [42827448480](https://github.com/Marilu-su/TakeAndGo/actions/runs/42827448480) | 2026-11-10 13:45:32 | 7831234b2875c67c01daf81508b52e76e0e60b9b | success; job Typecheck y tests success; no se extrajo conteo TAP de ese run ni se equipara a develop |
| API CI, último de develop: [42688463114](https://github.com/Marilu-su/TakeAndGo/actions/runs/42688463114) | 2026-11-09 19:58:33 | 54b84064dc393477ec197c202a5ebd8a48b56aa8 | success; install/typecheck/migrate/test success; 326 PASS/3 SKIP es conteo histórico documentado en T04-TESTING.md, no ejecución nueva |
| Deploy frontend, último devuelto: [42688463183](https://github.com/Marilu-su/TakeAndGo/actions/runs/42688463183) | 2026-11-09 19:58:33 | 54b84064dc393477ec197c202a5ebd8a48b56aa8 | failure al instalar; Vercel CLI/pull/build/deploy skipped |

Log del job deploy 129401536191 reconsultado: npm ci devuelve EUSAGE y declara
faltantes ajv@8.20.0, fast-uri@3.1.9, json-schema-traverse@1.0.0 y
require-from-string@2.0.2 en lockfile. No se modificó lockfile ni se reprodujo
instalación ahora. Un npm ci local histórico con Node24/npm11 exitoso no invalida
el fallo del runner Node20. No se deduce fallo del servicio publicado por este run.

| Workflow | Disparadores / versiones | Cobertura y límites |
|---|---|---|
| api-ci.yml | PR hacia main/develop; push develop; filtros apps/api/** y propio workflow; Node22, PostgreSQL16, localhost:5432/takeandgo_test | npm ci, typecheck, db:deploy, npm test; sin build separado. Tres tests exigen 127.0.0.1:5434/takeandgo y se omiten en CI; HTTP/fakes no prueban Neon/pasarela. Ver testing |
| deploy-web.yml | Push develop con filtro apps/web/** y propio workflow; workflow_dispatch; Node20; Vercel CLI latest | npm ci, vercel pull production, vercel build --prod y deploy --prebuilt --prod. Sin lint/tests explícitos. Requiere secrets cuyos valores/presencia efectiva no se consultaron; promoción develop/main por definir |

## Producción y servicios cloud

| Área | Evidencia | Estado al 14/11 / límite |
|---|---|---|
| Frontend público | GET https://take-and-go-web.vercel.app/ | HTTP 200, título Take&Go, servidor Vercel; solo portada acreditada |
| Rutas públicas del código | GET /login, /registro, /buffets, /pedidos y /admin | Todas 404; tres primeras confirmadas también el 13/11 |
| API URL efectiva en frontend | Navegador con JavaScript | Mensaje NEXT_PUBLIC_API_URL no configurada; solo prueba el circuito publicado observado |
| SHA/proyecto/entorno/variables Vercel | Sin panel; x-vercel-id es identificador de respuesta | NO VERIFICADO; no inferir commit ni valor de variables del panel |
| URL backend pública | README/ejemplos solo localhost; no URL operativa identificada | NO VERIFICADO; no afirmar que backend está caído o no existe |
| /health público y PostgreSQL cloud | Sin URL backend; sin consola DB | NO VERIFICADO. Código /health devuelve 200 aun con database:error; interpretar cuerpo cuando pueda consultarse |
| CORS efectivo | app.ts lee CORS_ORIGIN, fallback http://localhost:3000 | Código confirmado, origen desplegado/respuesta pública NO VERIFICADO |
| Jobs y observabilidad | index.ts: setInterval 10 s para activar retiros; Morgan/console | Inspección de código, sin acreditar job durable, centralización, métricas/trazas/alertas o ejecución cloud |
| Rollback | Sin procedimiento reproducible localizado | NO VERIFICADO operativamente; identificar versión y compatibilidad de migraciones |

La portada sigue sin los accesos presentes en apps/web/src/app/page.tsx de la base
auditada. Es diferencia observable; versión anterior o configuración distinta son
hipótesis, no causas demostradas. No hubo login, cambios de variables ni despliegue.

## Seguimiento priorizado — problemas, impacto y tarea dueña

Severidad prioriza trabajo, no es clasificación de vulnerabilidad ni prueba de caída.
Alta = bloquea demo/pipeline o control de integración; media = trazabilidad/operación
sin validación suficiente. Los estados NO VERIFICADO expresan falta de evidencia.

| ID | Evidencia y estado | Severidad justificada / impacto | Tarea | Verificación o resolución posterior |
|---|---|---|---|---|
| GH-01 | main/develop protected=false; checks off; ruleset disabled; revisión no exigida en controles visibles | Alta de gobierno: cambios pueden integrarse sin controles cruzados/checks exigidos | T08 | Revisar y acordar enforcement de PR, reviews y checks; después comprobar configuración efectiva, sin cambiarla dentro de T04. |
| GH-02 | PR89 abierto, reviews vacías; MenIA sin PR abierto y no integrada | Media de integración: trabajo pendiente no acredita funcionalidad de develop | T08/T32 | Mantener estado pendiente y exigir revisión/CI antes de promocionar; integración funcional corresponde a T01/T02, no a esta auditoría. |
| CI-01 | Node22/API, Node20/web; API sin build separado, web sin lint/tests; tres DB tests omitidos por guard | Alta de validación: verde parcial no cubre todos los flujos ni reproducción en destino | T08/T32 | Alinear entorno y guards de DB dedicada sin quitar seguridad; completar checks/build y validar promoción acordada. |
| OPS-01 | Sin evidencia de rollback probado ni jobs/observabilidad cloud | Media operativa: recuperación, fallos y tareas periódicas no acreditados | T32 | Documentar rollback y observar logs/alertas/jobs efectivos en entorno identificado. |
| DEP-01 | URL backend, /health, PostgreSQL cloud y CORS efectivo: NO VERIFICADO; solo ejemplos localhost en README/.env.example y código | Alta para aceptación de demo: impide acreditar el circuito; no demuestra una caída ni un incidente de seguridad | T32 | Identificar servicio/URL/revisión; GET público /health e interpretar cuerpo, comprobar DB y CORS desde origen Vercel; registrar evidencia sin secretos. |
| DEP-02 | 13/11 y 14/11: navegador muestra NEXT_PUBLIC_API_URL no configurada; variables del panel NO VERIFICADO | Alta funcional: frontend observado no puede consultar API; causa de configuración/build por determinar | T08/T32 | Inspeccionar proyecto, entorno y disponibilidad de la URL durante build; corregir por tarea dueña y luego comprobar petición a API; no inventar valores. |
| DEP-03 | 14/11: GET /login, /registro, /buffets, /pedidos y /admin devuelve 404; las tres primeras ya el 13/11 | Alta funcional: rutas del código auditado no están disponibles en ese dominio | T32 | Identificar revisión y root directory; contrastar rutas publicadas con develop y repetir smoke de rutas tras resolver. |
| DEP-04 | SHA desplegado, proyecto/entorno, rama y variables de Vercel: NO VERIFICADO; portada diferente del código con accesos | Media de trazabilidad: impide vincular pruebas de código con producción y planificar rollback | T32 | Vincular deployment con proyecto, commit, raíz y entorno mediante evidencia del panel autorizado; no inferir SHA por nombre de chunk o x-vercel-id. |
| DEP-05 | Run 42688463183/job 129401536191: npm ci EUSAGE por entradas faltantes en lock; build/deploy skipped | Alta para pipeline: bloquea esa ejecución; no demuestra que nunca existieron otros despliegues | T08/T32 | Reproducir instalación con versiones del runner; alinear package/lock en tarea posterior y exigir build/deploy exitosos más smoke. |

## Consigna oficial y trazabilidad — relevamiento histórico del 12/11

Se leyó el PDF externo `TPI - Desarrollo de Software Cloud.pdf`, preservado como
[consigna](../reference/tpi/CONSIGNA-TPI-2026.pdf) (4 páginas), SHA256
`df486fb7ed4b85a5985c7357d44b6722d68e926517b8e0c88eca08b98820039e`.
Extracción mediante pypdf del runtime, sin modificar el documento. Define defensa
30/11/2026 y estos criterios verificables:

| Criterio de la consigna | Evidencia histórica / brecha pendiente |
|---|---|
| MVP SaaS cloud con IA como diferenciador | Arquitectura documentada; IA y producción integradas no demostradas |
| Decisiones técnicas justificadas | ADR-0001/0002 y diagrama; faltan decisiones específicas de pagos, predictor, STT/push según TDD |
| AI-DECISIONS y validación humana | Historial raíz existe, varias entradas declaran validación humana pendiente; plantilla externa se conserva sin sustituir historial |
| Conventional Commits/contribución individual | Historial consultado; no se realizó evaluación individual completa ni auditoría de frecuencia |
| PR cruzados | Flujo documentado; #89 sin reviews a la consulta; no enforcement efectivo |
| GitHub Projects y WIP | Mencionado; tablero/límites no verificados |
| Observabilidad | Morgan/console; métricas/logs centralizados/alertas/trazas no acreditados |
| CI/CD y demo en producción | API CI verde con skips; deploy frontend fallido y demo pública no validada |

## Bloqueos que requieren datos o decisión

1. B-INFRA-01: URL frontend resuelta el 13/11 y smoke de portada realizado; faltan URL API/revisión desplegada y resolver las limitaciones verificadas para smoke integral.
2. B-INFRA-02: identificar base cloud/entorno de pruebas y responsables; no compartir secretos en docs.
3. B-INFRA-03: elegir/proveer ADR de pago, predictor, LLM/STT, push y jobs; no inferir proveedores.
4. B-DOC-01: confirmar referencias V3 de TDD borrador frente a autoridad V2 y resolver ambigüedad de retry QR.
5. B-QA-01: PostgreSQL dedicado y cuentas de cuatro roles para pruebas que hoy están omitidas/no realizadas.

Estos bloqueos son límites de validación, no autorización para implementar T08/T32 dentro de T04.
