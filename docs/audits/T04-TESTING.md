# T04 — Ejecución de verificaciones

Fecha: 12/11/2026. Base de código: `54b84064dc393477ec197c202a5ebd8a48b56aa8`.
Entorno local histórico: Windows, Node `24.22.0`, npm `11.19.1`, Python `3.12.2`.
CI usa Node 22 para API y Node 20 para frontend; no se equiparan estos entornos.


## Qué se comprobó en esta revisión — 14/11/2026

Inspección estática de código y suites en feature/T04-auditoria-cumplimiento, HEAD
`5a6a307538c306852aa595532b9321ed8f3359ae`; apps/api y workflow API sin diferencias
respecto de develop `54b84064dc393477ec197c202a5ebd8a48b56aa8`.
No se reejecutaron npm ci/typecheck/build/test, servicios, Docker o migraciones.
Los únicos controles actuales son integridad documental, inventario de archivos,
coherencia de referencias y comprobación de matrices. No son pruebas del producto.

306 PASS/23 SKIP/0 FAIL corresponde al npm test local del 12/11 registrado en esta
bitácora; no hay log TAP completo persistido en evidence para revalidar cada caso.
326 PASS/3 SKIP/0 FAIL corresponde al CI 42688463114, job 129401536313, consultado
históricamente. evidence/github-snapshot.json y evidence/followup-2026-11-13.json
preservan estado/SHA del run, no sustituyen el log íntegro de sus 329 resultados.
No se reconsultó GitHub en esta etapa. Los 2 PASS B07 constan además en followup;
son caracterización con fakes, no se suman a las 329 de apps/api/test.

## Resultados locales históricos — 12/11/2026

| Directorio | Comando | Resultado y límite |
|---|---|---|
| apps/api | `npm ci` | Intento sandbox falló ENOTFOUND al descargar; repetición autorizada con `--fetch-retries=0 --fetch-timeout=15000` pasó; 273 paquetes y generación Prisma 7.10.1 |
| apps/api | `npm run typecheck` | PASS, exit 0 |
| apps/api | `npm run build` | PASS, exit 0 |
| apps/api | `npm test` en sandbox | Falló por conexiones HTTP localhost EACCES; no se interpreta como regresión de negocio |
| apps/api | `npm test` fuera del sandbox | PASS condicionado: 329 tests, **306 pass, 0 fail, 23 skipped**; duración ~54 s |
| apps/web | `npm ci --fetch-retries=0 --fetch-timeout=15000` fuera del sandbox | PASS con npm 11; 561 paquetes; advertencias de peers/deprecaciones; no se modificaron package/lockfiles |
| apps/web | `npm run typecheck` antes de build | FAIL: `src/app/layout.tsx(20,50): Cannot find name LayoutProps` por tipos Next aún no generados |
| apps/web | `npm run lint` | FAIL: `src/app/(auth)/alta-cliente/page.tsx:11`, `react-hooks/set-state-in-effect`; 1 error |
| apps/web | `npm test` | PASS: **13 pass, 0 fail, 0 skipped**; HTTP/carrito/precios/sesión con simulación de fetch |
| apps/web | `npm run build` en sandbox | FAIL al obtener Geist/Geist Mono desde Google Fonts; restricción de red |
| apps/web | `npm run build` fuera del sandbox | FAIL Turbopack: proceso CSS termina antes de conexión; no demuestra fallo en Linux cloud |
| apps/web | `npm run build -- --webpack` fuera del sandbox | PASS: compilación, TypeScript, prerender y trazas; rutas actuales generadas |
| apps/web | `npm run typecheck` después del build Webpack | PASS, exit 0; dependencia de tipos generados documentada, no se cambió layout |
| apps/web | `npm audit --json --omit=dev` | Exit 1 por **13 dependencias afectadas**: 6 low, 0 moderate, 5 high, 2 critical. [Informe completo](evidence/npm-audit-production.json) |

La instalación inicial frontend en sandbox se interrumpió; la evidencia válida de
instalación completa es la repetición autorizada. La instalación completa informó
20 dependencias afectadas incluyendo desarrollo; el informe persistido excluye dev.
No se ejecutó `audit fix` ni se cambiaron dependencias. Los avisos no prueban que una
configuración explotable esté activa: revisar alcance real, advisories y actualizar
con regresión en T08. Se conserva la consulta para la fecha de auditoría.

## PostgreSQL y diferencias con CI — evidencia histórica

El 12/11 no se encontró DATABASE_URL de pruebas configurada y Docker Desktop no tenía daemon
accesible (`docker version`: pipe dockerDesktopLinuxEngine inexistente). No se
arrancó Docker ni se eligió una base cloud desconocida. No se aplicaron migraciones,
seeds, ni operaciones de limpieza sobre datos del usuario.

Los 23 skips locales incluyen persistencia Customer/membership, catálogo,
organización/staff, reservas concurrentes, pagos, cocina y retiro. Por ello no se
afirma que la atomicidad PostgreSQL haya sido demostrada en esta ejecución local.

El [CI del 09/11](https://github.com/Marilu-su/TakeAndGo/actions/runs/42688463114)
según la consulta histórica registrada para la misma base instaló, verificó tipos, aplicó migraciones y ejecutó
PostgreSQL 16: **329 tests, 326 pass, 0 fail, 3 skipped**. Logs del job
`129401536313` consultados con el conector GitHub. Los tres skips son relevantes:

- `test/paymentPersistence.test.ts`.
- `test/paymentOrderStockPersistence.test.ts`.
- `test/kitchen/kitchenPersistence.test.ts`.

Estos tests solo se habilitan para `127.0.0.1:5434/takeandgo`, mientras el CI define
PostgreSQL en `localhost:5432/takeandgo_test`. Un CI verde no acredita esas tres
integraciones. T08/T31 debe alinear el destino de pruebas sin borrar sus guards de
seguridad ni presentar mocks como prueba de persistencia.

## Cobertura localizada y brechas

- Auth: firma, expiración, emisor, extracción Bearer, Actor y `/me` con claves locales; el verificador configura audience, sin atribuir una prueba negativa específica de audiencia no localizada. Sin login/recovery real Neon.
- Catálogo/organización: reglas y HTTP por rol/tenant; persistencia local omitida.
- Pedidos: identidad/precio no confiados al browser, membresía, adicionales,
  cancelación y ocultación de código; tests reales de última unidad existen pero
  requieren PostgreSQL. El monto del caso de uso se calcula desde catálogo.
- Pagos: estados, retries, aprobación tardía y compensación con puertos simulados;
  sin proveedor/webhook ni prueba integral real.
- Cocina/retiro: estados y permisos HTTP; guard temporal de retiro no cubre toda
  ventana/tolerancia y QR/manual requieren repetir carrera real.
- Frontend: 13 tests de utilidades, sin suite de navegador/render de pantallas en develop.
- Rama `feat/C2-20-e2e-kitchen-pickup` contiene
  `apps/api/test/e2e/kitchenPickup.e2e.test.ts` (328 líneas), fuera de develop;
  también existe en el árbol de `feat/C2-19-pickup` (no se afirma aquí exclusividad de patch). No se ejecutó ni se
  contó dentro de las 329 pruebas. Revisar/reutilizar en T03/T31, sin integrar en T04.
- Nuevas reglas CocIA, no-show, sanciones, notificaciones, puntos y canjes carecen de
  implementación integrada localizada; no hay pruebas que certifiquen su cumplimiento.

## Reproducción y siguientes verificaciones

Desde apps/api: `npm ci`, `npm run typecheck`, `npm run build`, `npm test`.
Usar PostgreSQL **dedicado de pruebas**, aplicar migraciones allí y comprobar que
los guards habiliten los tests esperados. Ejecutar desde cero y base existente de
prueba, sin apuntar a producción.

Desde apps/web: `npm ci`, `npm run build -- --webpack`, `npm run typecheck`,
`npm run lint`, `npm test`. El build estándar sigue siendo una verificación aparte;
Webpack exitoso no convierte el script estándar en PASS. Si se usa typecheck antes
del build en checkout limpio, definir generación explícita de tipos Next en T08.

Desde raíz: `python -B docs/audits/scripts/validate_audit.py` valida exclusivamente
las 184 RN, campos, estados, tareas y sincronización con la matriz generada;
`python -B docs/audits/scripts/build_matrices.py --check` comprueba RN sin escribir.
Ninguno valida toda T04, la matriz de pantallas, estos informes o servicios reales.
No se añadieron ni reescribieron pruebas productivas ni lógica para forzar resultados.

## Continuación del 13/11/2026

Se añadieron fuera de la suite productiva dos pruebas de caracterización, en
`docs/audits/tests/payment-compensation.characterization.test.ts`, que importan el
caso de uso real. Comando desde raíz:
`node apps/api/node_modules/tsx/dist/cli.mjs --test docs/audits/tests/payment-compensation.characterization.test.ts`.
Resultado: 2 pass, 0 fail, 0 skipped. Reproducen el bloqueo del retry tras fallo
provider o fallo al registrar refund, con puertos en memoria. No aumentan el conteo
de la suite histórica de 329 ni acreditan PostgreSQL/pasarela. Los tests de aceptación
de producto no se modificaron. Detalle en [seguimiento](T04-SEGUIMIENTO-2026-11-13.md).

## Inventario de los 59 archivos de pruebas

Conteo estático: 329 declaraciones test/it en 59 archivos *.test.ts bajo apps/api/test.
No es cobertura de RN ni una ejecución. Los 16 archivos DB contienen 23 pruebas;
los otros 43 contienen 306. Un archivo DB puede agrupar varias aserciones/escenarios
en una sola prueba; no se cuentan aserciones como tests adicionales.
Rutas de esta tabla relativas a apps/api/. Unidad/aplicación/HTTP indica inspección
del tipo de prueba, no certifica integración de toda la aplicación.

| Archivo | Pruebas identificadas | Tipo / dependencia |
|---|---|---|
| `test/app.test.ts` | 5 | HTTP/utilidad con dependencias de prueba; app.test también consulta health con defaultDependencies |
| `test/infrastructure/auth/createActorResolver.test.ts` | 8 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/infrastructure/auth/jwtTokenVerifier.test.ts` | 8 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/infrastructure/auth/meRoutes.test.ts` | 2 | HTTP/utilidad con dependencias de prueba; app.test también consulta health con defaultDependencies |
| `test/kitchen/activateEligiblePickups.test.ts` | 2 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/kitchen/activatePickupWhenEligible.test.ts` | 6 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/kitchen/finishPreparation.test.ts` | 10 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/kitchen/kitchenPersistence.test.ts` | 1 | PostgreSQL; guard estricto 127.0.0.1:5434/takeandgo (omitido en CI histórico) |
| `test/kitchen/kitchenRoutes.test.ts` | 17 | HTTP/utilidad con dependencias de prueba; app.test también consulta health con defaultDependencies |
| `test/kitchen/startPreparation.test.ts` | 8 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/catalog/application/additionUseCases.test.ts` | 12 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/catalog/application/categoryUseCases.test.ts` | 17 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/catalog/application/getStoreCatalog.test.ts` | 4 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/catalog/application/productUseCases.test.ts` | 11 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/catalog/application/viewStoreCatalog.test.ts` | 6 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/catalog/domain/catalogDomain.test.ts` | 8 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/catalog/domain/productAdditionDomain.test.ts` | 14 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/catalog/domain/storeCatalog.test.ts` | 8 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/catalog/infrastructure/categoryRoutes.test.ts` | 7 | HTTP/utilidad con dependencias de prueba; app.test también consulta health con defaultDependencies |
| `test/modules/catalog/infrastructure/prismaCategoryRepository.test.ts` | 1 | PostgreSQL; guard DATABASE_URL presente |
| `test/modules/catalog/infrastructure/prismaCategoryUniqueness.test.ts` | 1 | PostgreSQL; guard DATABASE_URL presente |
| `test/modules/catalog/infrastructure/prismaProductRepository.test.ts` | 1 | PostgreSQL; guard DATABASE_URL presente |
| `test/modules/catalog/infrastructure/productAdditionRoutes.test.ts` | 11 | HTTP/utilidad con dependencias de prueba; app.test también consulta health con defaultDependencies |
| `test/modules/catalog/infrastructure/storeCatalogIntegration.test.ts` | 1 | PostgreSQL; guard DATABASE_URL presente |
| `test/modules/catalog/infrastructure/storeCatalogRoutes.test.ts` | 3 | HTTP/utilidad con dependencias de prueba; app.test también consulta health con defaultDependencies |
| `test/modules/customer/application/associateCustomerToStore.test.ts` | 6 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/customer/application/createCustomer.test.ts` | 3 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/customer/application/getCustomer.test.ts` | 2 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/customer/application/listCustomerStores.test.ts` | 3 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/customer/application/registerCustomer.test.ts` | 4 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/customer/domain/customerDomain.test.ts` | 5 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/customer/infrastructure/customerRoutes.test.ts` | 4 | HTTP/utilidad con dependencias de prueba; app.test también consulta health con defaultDependencies |
| `test/modules/customer/infrastructure/customerStoreRoutes.test.ts` | 2 | HTTP/utilidad con dependencias de prueba; app.test también consulta health con defaultDependencies |
| `test/modules/customer/infrastructure/prismaCustomerAuthLink.test.ts` | 1 | PostgreSQL; guard DATABASE_URL presente |
| `test/modules/customer/infrastructure/prismaCustomerRepository.test.ts` | 2 | PostgreSQL; guard DATABASE_URL presente |
| `test/modules/customer/infrastructure/prismaCustomerStoreMembershipRepository.test.ts` | 3 | PostgreSQL; guard DATABASE_URL presente |
| `test/modules/customer/integration/customerStoreFlow.test.ts` | 4 | PostgreSQL; guard DATABASE_URL presente |
| `test/modules/organization/application/assignStaffRole.test.ts` | 6 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/organization/application/listOrganizationStores.test.ts` | 1 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/organization/application/organizationUseCases.test.ts` | 14 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/organization/domain/organizationDomain.test.ts` | 13 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/organization/domain/staffScopeDomain.test.ts` | 5 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/modules/organization/infrastructure/organizationRoutes.test.ts` | 4 | HTTP/utilidad con dependencias de prueba; app.test también consulta health con defaultDependencies |
| `test/modules/organization/infrastructure/prismaStaffScopeRepository.test.ts` | 1 | PostgreSQL; guard DATABASE_URL presente |
| `test/modules/organization/infrastructure/prismaStoreRepository.test.ts` | 2 | PostgreSQL; guard DATABASE_URL presente |
| `test/orderReservationIntegration.test.ts` | 1 | PostgreSQL; guard DATABASE_URL presente |
| `test/orderRoutes.test.ts` | 7 | HTTP/utilidad con dependencias de prueba; app.test también consulta health con defaultDependencies |
| `test/orderStock.test.ts` | 3 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/payment.test.ts` | 24 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/paymentCompensation.test.ts` | 4 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/paymentOrderStock.test.ts` | 3 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/paymentOrderStockPersistence.test.ts` | 1 | PostgreSQL; guard estricto 127.0.0.1:5434/takeandgo (omitido en CI histórico) |
| `test/paymentPersistence.test.ts` | 1 | PostgreSQL; guard estricto 127.0.0.1:5434/takeandgo (omitido en CI histórico) |
| `test/pickup/confirmPickupUseCase.test.ts` | 7 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/pickup/issuePickupTokenUseCase.test.ts` | 3 | Unidad/dominio/aplicación con memoria/fakes; JWT con claves locales |
| `test/pickup/pickupRoutes.test.ts` | 14 | HTTP/utilidad con dependencias de prueba; app.test también consulta health con defaultDependencies |
| `test/pickup/prismaConfirmPickupAdapter.test.ts` | 1 | PostgreSQL; guard DATABASE_URL presente |
| `test/pickup/prismaPickupConcurrency.test.ts` | 1 | PostgreSQL; guard DATABASE_URL presente |
| `test/stockCatalogAvailability.test.ts` | 2 | HTTP/utilidad con dependencias de prueba; app.test también consulta health con defaultDependencies |

### Concurrencia PostgreSQL y simulación

- test/orderReservationIntegration.test.ts usa placeReservedOrder y Promise.allSettled
  sobre una última unidad: verifica una reserva ganadora, rollback, cancelaciones
  idempotentes y visibilidad de catálogo. Una prueba DB; skip sin DATABASE_URL.
- test/pickup/prismaPickupConcurrency.test.ts verifica emisión/reemplazo de QR y
  confirmaciones QR/manual concurrentes con consumo único. Una prueba DB; skip sin URL.
- test/pickup/prismaConfirmPickupAdapter.test.ts agrupa casos de estado, credencial,
  persistencia y consumo. Una prueba DB; no acredita guard temporal completo.
- Tests unitarios de cocina simulan conflicto compare-and-set; no son por sí solos
  carreras reales PostgreSQL. HTTP con Actor inyectado tampoco acredita Neon real.
- Dependencias locales omitidas (23) y tres omitidas en CI se conservan como SKIP,
  nunca PASS. No se ejecutó ninguna de esas pruebas durante esta revisión documental.

### Tres guards incompatibles con CI

paymentPersistence.test.ts, paymentOrderStockPersistence.test.ts y
kitchen/kitchenPersistence.test.ts exigen protocolo postgresql, host 127.0.0.1,
puerto 5434 y base /takeandgo. .github/workflows/api-ci.yml ofrece PostgreSQL 16 en
localhost:5432/takeandgo_test. Aunque DATABASE_URL exista, sus guards devuelven false.
Los otros 20 tests DB se habilitan por presencia de DATABASE_URL; eso no acredita
que el destino sea una base dedicada. No se apuntó a ninguna DB en esta revisión.
RN-001,006–009,026,029–034,072–075,081–084,108,113–118; T08/T19/T31/T34.

## Límites de scripts, tipos, Prisma y servicios externos

- apps/api/package.json: typecheck = tsc --noEmit y build = tsc -p tsconfig.json.
  tsconfig.json incluye src/**/*.ts; test/tsconfig.json existe pero esos scripts
  no lo invocan. npm test usa tsx --test, no un typecheck completo de tests.
  Un build histórico PASS no certifica tipado de todas las pruebas ni integración.
- prisma7.config.ts declara schema, migraciones, seed y datasource desde DATABASE_URL.
  Los scripts prisma generate/migrate/seed no pasan --config; no se verificó en
  checkout limpio qué configuración selecciona la CLI. Es un punto de reproducción
  pendiente T08/T32, no un fallo actual demostrado. Runtime usa PrismaPg con URL.
  Hay 16 migraciones; no se aplicaron ni se verificó drift/base existente en esta etapa.
- Dependencias/generated Prisma instalados pueden influir en el build local; npm ci
  ejecuta postinstall prisma generate. No se reinstaló ni se regeneró el cliente.
- Sin NEON_AUTH_URL, authModule.ts usa resolvers sin identidad; las rutas protegidas
  no se vuelven públicas. Neon/JWKS/login/recovery reales requieren configuración
  y cuentas de prueba; suite JWT usa claves locales. RN-001–004; T08/T34.
- PaymentPort/PaymentRefundPort se simulan: no hay pasarela ni webhook integrado que
  permita certificar pagos/refunds reales. RN-068–077; T14/T15/T31.
- No existen pruebas integradas de LLM/STT/predictor/push/puntos/canjes que certifiquen
  sus RN; no se confunde ausencia del módulo con cumplimiento. T09/T16/T17/T24/T26–T28.
- /health devuelve HTTP 200 con database=error ante fallo DB: un test de status 200
  no equivale a disponibilidad de persistencia o de flujos operativos.

## E2E en ramas no integradas

| Rama | SHA local verificado | Archivo / alcance |
|---|---|---|
| feat/C2-20-e2e-kitchen-pickup | 3c21a2d16a3590e43c22f6e843bdd521d9f05328 | apps/api/test/e2e/kitchenPickup.e2e.test.ts, 328 líneas |
| feat/C2-19-pickup | a65c40f44e41e284688485bfca7752b90373b912 | Mismo path presente en ese árbol, 328 líneas |

No están en apps/api/test de la base develop auditada ni cuentan entre sus 329 tests.
El E2E usa Supertest, createApp con Actor de prueba y Prisma; exige la DB local
127.0.0.1:5434/takeandgo y modifica/limpia datos de prueba. No certifica login Neon,
pasarela ni un navegador real. No se integró ni ejecutó en T04. Referencias locales,
sin fetch ni consulta de vigencia remota en esta etapa. RN-108,113–119; T03/T19/T31.

## Coherencia con las matrices versionadas

RN-026 sigue PENDIENTE_VALIDACION, RN-112 PARCIAL y RN-070 PARCIAL con T14/T15.
La prueba PostgreSQL de staff existe, sin atribuirle una ejecución individual nueva.
Los 2 PASS de caracterización B07 demuestran el bloqueo, no completan RN-075/077.
Las 39 pantallas conservan sus estados: API registrada no implica UI integrada;
PR89 y MenIA siguen fuera de BASE. No se modificó ninguna matriz en esta etapa.
