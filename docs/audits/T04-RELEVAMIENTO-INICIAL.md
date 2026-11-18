# T04 — Unidad 1: relevamiento inicial

Fecha: 12/11/2026 (America/Buenos_Aires). Estado: pendiente de revisión humana.

> Actualización posterior del mismo día: el usuario aportó Master, PANTALLAS,
> reglas/workflow y TDD, ahora preservados en [fuentes seleccionadas para el cierre](README.md#fuentes-preservadas).
> Los faltantes y la ausencia de pruebas descritos abajo corresponden al snapshot
> inicial de Unidad 1. Quedaron actualizados en los informes de [testing](T04-TESTING.md),
> [infraestructura](T04-INFRAESTRUCTURA.md) y [resumen](T04-RESUMEN-EJECUTIVO.md).
> No utilizar este informe histórico como estado final de T04.
> Nota de consolidación del 14/11: se preservan 20 fuentes seleccionadas, no todas
> las copias auxiliares locales. Los cuatro commits posteriores constan en el README.
> La revisión/commit pendiente al final describe exclusivamente el momento inicial.

## 1. Método y límites

Se actualizaron referencias con `git fetch origin`, se verificó el workspace limpio
y se creó `feature/T04-auditoria-cumplimiento` desde `origin/develop`.
`develop` ya coincidía con el remoto; no fue necesario incorporar commits.
No se modificó lógica, configuración, migraciones ni pruebas. No se ejecutaron
aplicaciones, suites, migraciones ni consultas a la base durante esta unidad.

La inspección es estática y preliminar: no certifica RN, pantallas, seguridad completa
ni funcionamiento de producción. La auditoría remota de PR procede de la lectura
del PR #89 durante la preparación de T04; los SHA locales se comprobaron nuevamente
después del fetch. La lista completa de PR abiertos y las protecciones siguen pendientes.

## 2. Snapshot de Git

| Referencia | SHA | Observación |
|---|---|---|
| `origin/develop` | `54b84064dc393477ec197c202a5ebd8a48b56aa8` | Base de la auditoría |
| `origin/main` | `23d857dbe159db6d9a005251106b9adf9a77480f` | Mensaje: `chore: initialize repository`; no inferir despliegue desde esta referencia |
| `origin/feature/C3-01-menia` | `fae7add08f318e6a554947067328bdf3049bb1b4` | Tres commits exclusivos frente a develop; cero exclusivos de develop |

`git rev-list --left-right --count origin/develop...origin/feature/C2-frontend-rutas-base`
devolvió `1 5`: ramas divergentes, con un commit exclusivo de develop y cinco de la feature.

[PR #89](https://github.com/Marilu-su/TakeAndGo/pull/89): abierto, no fusionado,
base `develop`, head `7831234b2875c67c01daf81508b52e76e0e60b9b`, 49 archivos
modificados según la consulta remota preparatoria. La descripción declara gestión
administrativa, preferencias, stock, cocina/retiro y ajustes de deploy; no se toma
esa descripción como prueba funcional. Su integración corresponde a T02.

MenIA modifica 22 archivos frente a la base común. Su documento
`docs/C3-01-MENIA.md`, leído con `git show`, describe chat/endpoint y respondedor
determinístico, sin LLM, recomendaciones ni herramientas de pedido. Es evidencia
de alcance declarado y código pendiente de integración, no IA completa. T01 debe
revisar e integrar; las ampliaciones corresponden a T09/T13/T17/T21.

## 3. Fuentes disponibles y faltantes

| Fuente | Evidencia / ubicación | Límite |
|---|---|---|
| Master V2.0 | No localizado en el árbol versionado inspeccionado | BLOCKER para describir y clasificar fielmente las 184 RN |
| PANTALLAS V2.0 | No localizado en el árbol versionado inspeccionado | BLOCKER para cotejar las 39 pantallas oficiales |
| AGENTS general del proyecto | No localizado en la raíz inspeccionada | No atribuir reglas de otros proyectos |
| Reglas frontend | `apps/web/AGENTS.md` | Instrucción específica de Next.js; consultar sus guías locales antes de editar código frontend |
| CODEX_WORKFLOW | No localizado en el árbol versionado inspeccionado | Metodología específica pendiente; se sigue la solicitud T04 y CONTRIBUTING |
| Flujo Git | `CONTRIBUTING.md` | PR, revisión cruzada y commits en español documentados; aplicación remota no comprobada |
| Uso de IA | `AI-DECISIONS.md` | Evidencia histórica declarada; no sustituye ejecución actual |
| Arquitectura | `docs/architecture/ADR-0001-cloud-stack.md`, `ADR-0002-autenticacion.md` | Decisiones documentadas; no acreditan recursos cloud activos |
| Contrato inicial | `docs/architecture/CHK1-INTEGRATION-CONTRACT.md` | Variables, CORS y health; verificar contratos actuales por módulo después |
| Frontend | `docs/FRONTEND-CHECKPOINT-2.md` | Documento de checkpoint; cotejo detallado pendiente |
| TDD | `docs/tdds/` contiene solo `.gitkeep` | No se localizaron TDD funcionales en ese directorio |
| Consigna TPI | PDF externo localizado en Descargas: `TPI - Desarrollo de Software Cloud.pdf` | Contenido y versión todavía no revisados; no afirmar requisitos oficiales |
| Plan de tareas | Documento suministrado `TAKEANDGO_PLAN_VERIFICADO_REPO_2026-11-12.md` | Sirve para vincular T01–T36; no reemplaza al Master |

El `AGENTS.md` de Descargas inspeccionado corresponde a Hockey DT y queda excluido.
Las ubicaciones externas no son fuentes versionadas del repositorio. No se afirma
haber agotado todas las ubicaciones posibles ni revisado archivos ZIP externos.

## 4. Componentes localizados

| Componente | Evidencia estática | Falta verificar / tarea relacionada |
|---|---|---|
| API y persistencia | `apps/api/package.json`, `src/app.ts`, `prisma/schema.prisma`, `prisma/migrations/` | Build, tipos, migraciones e integración real: unidades 3–4; T03/T08 |
| Autenticación | `src/infrastructure/auth/`, ADR-0002; frontend `src/lib/auth/` | Login, recuperación, aprovisionamiento y permisos con cuentas reales: T08/T34 |
| Organización, clientes y catálogo | `src/modules/{organization,customer,catalog}/`; modelos Organization, Store, Customer, StaffScope y catálogo | Cotejo de reglas, permisos y exposición por caso de uso: T02/T05/T06/T10 |
| Stock y reservas | `src/modules/stock/`, `order/infrastructure/prismaOrderReservation.ts`; modelos de stock/movimientos | Atomicidad, ajustes y expiración efectiva: T03/T07/T11 |
| Pedidos, cocina y retiro | Routers registrados en `src/app.ts`; modelos Order/PickupToken | Ventanas completas, jobs, operación UI y concurrencia: T11/T12/T18/T19 |
| Pagos | `src/modules/payment/`, modelos Payment y PaymentCompensation | No hay router de pagos registrado en `app.ts`; proveedor/webhook/UI no demostrados: T14/T15 |
| MenIA | Código y contrato en rama separada | PENDIENTE_INTEGRACION para ese trabajo; no forma parte de develop: T01 |
| CocIA | Hay tiempos base en Product y campos de ventana en Order | No se localizó módulo CocIA en el inventario; no equivale a scheduler ni predictor: T12/T16/T20 |
| Sanciones, fidelización, recuperados y notificaciones | No se localizaron modelos específicos en el schema examinado | Inspección exhaustiva pendiente; no afirmar inexistencia en todas las ramas: T22–T28 |
| Frontend | Next.js; rutas y componentes en `apps/web/src/` | Integración, permisos, estados y responsive pendientes de validar |

Todas las rutas de código de esta tabla, salvo indicación contraria, son relativas
a `apps/api/`. Localizar una entidad o un caso de uso no declara el módulo PROBADO.

## 5. Inventario inicial de páginas

Se localizaron 11 archivos `page.tsx` bajo `apps/web/src/app`:

- `page.tsx`.
- `(auth)/alta-cliente/page.tsx`, `(auth)/login/page.tsx`, `(auth)/registro/page.tsx`.
- `(customer)/buffets/page.tsx`, `(customer)/buffets/[storeId]/catalogo/page.tsx`.
- `(customer)/pedidos/page.tsx`, `(customer)/pedidos/[id]/page.tsx`.
- `(store-admin)/admin/page.tsx`, `(store-admin)/admin/catalogo/page.tsx`, `(store-admin)/admin/stock/page.tsx`.

Es un inventario de archivos de ruta, no un conteo de pantallas funcionales ni una
comparación 11/39: una ruta puede representar varios estados o pantallas. No se
validaron navegación, sesión, endpoints consumidos ni presentación visual.

## 6. Pruebas y CI: evidencia localizada, no ejecutada

API: scripts `typecheck`, `build` y `test` en `apps/api/package.json`; pruebas
de dominio, HTTP, persistencia y concurrencia bajo `apps/api/test/`.
Frontend: scripts `typecheck`, `lint`, `build`, `test` y pruebas bajo `apps/web/test/`.
No se atribuyen resultados históricos a esta auditoría.

`.github/workflows/api-ci.yml` usa Node 22, PostgreSQL 16, instala con `npm ci`,
verifica tipos, aplica migraciones y ejecuta tests. Sus filtros de paths no incluyen
documentación. `.github/workflows/deploy-web.yml` usa Node 20 y Vercel CLI; el flujo
estático examinado no tiene pasos explícitos de lint/tests antes del deploy.
Resultados actuales de Actions y configuración efectiva: pendientes en Unidad 5.

`GET /health` en `apps/api/src/app.ts` responde HTTP 200 y `status: ok` aun si
`checkDatabase` devuelve falso; el campo `database` pasa a `error`. Un monitor que
solo mire el código HTTP no demuestra salud de PostgreSQL. Es una observación
estática concordante con el README de la API; no se cambió su contrato.

No se verificaron URL productiva, proveedor backend, base cloud, alertas, logs,
protecciones ni checks obligatorios. Tampoco se ejecutaron despliegues.

## 7. Bloqueos y prioridades

1. Obtener Master y PANTALLAS autorizados antes de certificar reglas y pantallas
   (Unidad 2 y cotejo funcional de Unidad 3). Continuar inventario con evidencia disponible.
2. Revisar consigna oficial y localizar workflow/reglas generales de Take&Go.
3. Mantener separada la evidencia de develop, PR #89 y MenIA; volver a revisar si
   cambian los SHA. Coordinar integración con T01/T02 sin incorporarla en T04.
4. Antes de pruebas de persistencia, identificar una base apta para pruebas;
   no ejecutar migraciones o seeds sobre una base de destino desconocido.
5. Verificar cloud y configuración remota en Unidad 5; los fixes quedan en T08/T32.

## 8. Comandos y resultados de esta unidad

| Comando / acción | Resultado |
|---|---|
| `git status --short --branch` previo | Workspace limpio en develop |
| `git fetch origin` | Primer intento denegado por permisos sobre FETCH_HEAD; repetición autorizada exitosa |
| `git rev-list --left-right --count develop...origin/develop` | `0 0` |
| `git switch -c feature/T04-auditoria-cumplimiento origin/develop` | Rama creada desde la base actualizada |
| `git log -1` / `git rev-parse` sobre referencias | SHA registrados arriba |
| `git rev-list --left-right --count` sobre features | MenIA `0 3`; frontend `1 5` |
| `git diff --stat origin/develop...origin/feature/C3-01-menia` | 22 archivos; 1483 inserciones y 1 eliminación |
| `git show origin/feature/C3-01-menia:docs/C3-01-MENIA.md` | Contrato y límites de la entrega consultados |
| Inventario con `rg --files` y lectura de archivos | Fuentes, módulos, páginas y workflows registrados |
| Suites, builds, migraciones y pruebas humanas | No ejecutados; corresponden a unidades posteriores |

## 9. Revisión de la unidad

Archivos nuevos: este informe y `docs/audits/README.md`.
Propuesta: `docs(audit): documentar relevamiento inicial y fuentes de evidencia`.
Pendiente: revisión y commit manual del usuario antes de Unidad 2.
