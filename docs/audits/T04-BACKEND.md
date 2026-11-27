# T04 — Backend, base de datos y contratos

Fecha: 12/11/2026. Base integrada: `54b84064dc393477ec197c202a5ebd8a48b56aa8`.
Actualización B07: [13/11/2026](T04-SEGUIMIENTO-2026-11-13.md), reproducido en
dos pruebas del caso de uso con dependencias en memoria; no integración externa.
Fuentes: Master V2.0, 14 TDD de referencia, ADR-0001/0002 y código real.
Las rutas siguientes son relativas a `apps/api/`. Clasificaciones por RN:
[matriz completa](T04-MATRIZ-CUMPLIMIENTO.md). Pruebas: [resultados](T04-TESTING.md).


## Alcance de la revisión del 14/11/2026

Rama inspeccionada: feature/T04-auditoria-cumplimiento; HEAD documental
`5a6a307538c306852aa595532b9321ed8f3359ae`. Código productivo y workflow API sin
diferencias respecto de la base develop indicada arriba. No se actualizaron refs remotas.
Esta etapa realizó inspección estática: no arrancó la API, no hizo llamadas HTTP reales,
no ejecutó suites de producto ni migraciones. Los PASS/SKIP anteriores son históricos,
con origen y límites en T04-TESTING.md, no certificación de funcionamiento actual.
La matriz RN conserva sus evaluaciones y la de 39 pantallas sus clasificaciones.

Convenciones: ruta registrada = handler montado en createApp; no implica éxito con
credenciales/DB reales ni accesibilidad pública. Caso interno = clase/función existente
sin endpoint público que la invoque. Ausencia localizada = búsqueda en app.ts, index.ts,
módulos, schema y scripts; no prueba absoluta de inexistencia fuera del alcance.

## Módulos, exposición y persistencia

| Módulo | Entidades / migraciones / casos de uso | Exposición registrada en src/app.ts | RBAC / tenant y consistencia | Estado y brecha |
|---|---|---|---|---|
| Auth | JWT/JWKS Neon; StaffScope; Customer.authUserId; migraciones auth/staff | GET `/api/v1/me`, POST `/api/v1/me/customer` | Firma, issuer/audience y Actor; usuario de staff prevalece sobre Customer; pruebas de tokens/resolver | PARCIAL: alta no exige código; recovery sin UI; proveedor real no validado Referencias: RN-001–004; T08/T34. |
| Organización/buffets | Organization.maxAdvanceDays=7, Store.status/code; dominio y asignación staff interna | POST/GET org stores; POST store deactivate | Scope ORGANIZATION_ADMIN; roles de buffet con storeId singular | PARCIAL: sin horarios ni setup/activación completos; staff UI en PR #89 Referencias: RN-005–006,026–028,035,054–055; T02/T06/T10/T11/T34. |
| Clientes/membresía | Customer email unique, membresía composite customer/store; repositorios y asociación | GET/POST `/api/v1/me/stores` | Customer derivado del Actor; código normalizado; sin aprobación administrativa | PENDIENTE_VALIDACION del recorrido real; perfil/exclusiones/rutina incompletos Referencias: RN-001–002,007–009,016–025; T05/T08/T25/T34. |
| Catálogo | Category, Product, Addition, ProductAddition; FKs por buffet y nombre activo único | CRUD categorías/productos/adicionales, asociaciones, GET catálogo | STORE_ADMIN local administra; CUSTOMER asociado o staff local consulta; pruebas negativas | Base implementada; PASS HTTP/dominio histórico, no reejecutado; DB/UI real por verificar Referencias: RN-029–034,040–043,096; T13/T34. |
| Stock | ProductStock/AdditionStock/StockMovement; balances y movimientos | GET stock para STORE_ADMIN; ajustes en PR #89 | Reserva con decrementos condicionales; movimientos dentro de transacción | PARCIAL: stock sin balance se admite; ajustes auditados y revisión lunes pendientes Referencias: RN-079–091; T03/T07/T19/T23/T31. |
| Pedidos | Order/items/snapshots; reserva/cancelación/expiración; campos de ventana nullable | POST/GET orders, GET detalle, POST cancel; release-expired siempre deniega | Propiedad del cliente, membresía, precio backend; transacción compartida y advisory lock por buffet | PARCIAL: 15 min de reserva, sin fechas/horarios/capacidad y sin job expiración Referencias: RN-054–067,070–071,074,076,078; T11/T14/T15/T31/T32. |
| Pago | Payment y PaymentCompensation; Create/Resolve/ProcessPaymentResult/compensación | **Ningún router payment registrado** | Transiciones condicionales y transacciones en adaptador; puertos provider/refund | PARCIAL: casos de uso internos, sin pasarela/webhook real ni cancelación pagada del buffet Referencias: RN-063,068–077; T14/T15/T18/T31. |
| Cocina | Inicio/fin y activación por ventana; preparedAt, preparedByUserId | POST start/finish; GET cola solo en PR #89 | Staff local; transición compare-and-set; funciones now inyectables | PARCIAL: sin scheduler/venta presencial; activación periódica volátil en index.ts Referencias: RN-060,065,092–112; T12/T16/T18/T20. |
| Retiro | PickupToken hash/usedAt/expiresAt; QR/manual y auditoría | POST QR/manual/by-code/confirm | Customer propietario emite; staff local confirma; estado+stock+token en transacción | PARCIAL: controles temporales incompletos; UI en PR; pruebas PostgreSQL locales omitidas Referencias: RN-113–119; T19/T22/T31. |
| MenIA | Módulo/chat en feature/C3-01-menia, sin migración de chat | No registrado en develop | Rama declara Customer/membresía/buffet activo y responder solo lectura | PENDIENTE_INTEGRACION; no LLM/STT/recomendaciones completas Referencias: RN-015,018–025,036–053,156–158; T01/T09/T13/T17/T21/T29. |
| CocIA | Sin módulo/predictor/scheduler localizado; Product.basePreparationSeconds existe | Sin port funcional integrado localizado | No hay compromiso atómico de capacidad ni timezone operativo | NO_LOCALIZADO: T12/T16/T20 Referencias: RN-092–106; T12/T16/T20. |
| No retiro/sanciones | Sin modelo OrganizationDiscipline/noShowNotice ni estado NO_RETIRADO | Sin rutas/job localizados | No se verifican strikes/bloqueo por organización | NO_LOCALIZADO: T22 Referencias: RN-062,120–131; T22/T23. |
| Recuperados | Sin RecoveredPreparedUnit ni descarte al cierre | Sin rutas/job localizados | No hay reasignación exacta/prioridad/retorno de envasados | NO_LOCALIZADO: T23 Referencias: RN-085–089,170–172; T23/T27. |
| Loyalty/rewards/10% | Sin cuentas, ledger, offerings, redemption o benefit en schema base | Sin rutas/tools localizados | Sin spend/refund atómico ni exclusividad por organización | NO_LOCALIZADO: T26/T27/T28 Referencias: RN-137–184; T21/T25/T26/T27/T28. |
| Notificaciones | Sin entidad/subscription/provider/event consumers | Sin rutas localizadas | Sin outbox/reintentos/idempotencia notificaciones | NO_LOCALIZADO: T24 Referencias: RN-132–136; T24. |

## Inventario de las 35 rutas HTTP registradas

src/app.ts monta los routers bajo /api/v1; /health se registra directamente.
La tabla incluye el prefijo completo y archivo que declara cada handler. Las rutas
protegidas requieren identidad, rol y/o scope según el router; no se probaron en vivo.
No se cuentan CORS/OPTIONS automáticos, middleware ni el fallback 404 como endpoints.

| Método | Ruta completa | Archivo de implementación (apps/api/) | Alcance |
|---|---|---|---|
| GET | `/health` | `src/app.ts` | Pública; siempre HTTP 200, database puede ser error: no certifica DB operativa |
| POST | `/api/v1/stores/:storeId/additions` | `src/modules/catalog/infrastructure/http/additionRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| GET | `/api/v1/stores/:storeId/additions` | `src/modules/catalog/infrastructure/http/additionRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| PATCH | `/api/v1/stores/:storeId/additions/:additionId` | `src/modules/catalog/infrastructure/http/additionRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/stores/:storeId/additions/:additionId/deactivate` | `src/modules/catalog/infrastructure/http/additionRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/stores/:storeId/categories` | `src/modules/catalog/infrastructure/http/categoryRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| GET | `/api/v1/stores/:storeId/categories` | `src/modules/catalog/infrastructure/http/categoryRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| PATCH | `/api/v1/stores/:storeId/categories/:categoryId` | `src/modules/catalog/infrastructure/http/categoryRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/stores/:storeId/categories/:categoryId/deactivate` | `src/modules/catalog/infrastructure/http/categoryRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/stores/:storeId/products` | `src/modules/catalog/infrastructure/http/productRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| GET | `/api/v1/stores/:storeId/products` | `src/modules/catalog/infrastructure/http/productRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| PATCH | `/api/v1/stores/:storeId/products/:productId` | `src/modules/catalog/infrastructure/http/productRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/stores/:storeId/products/:productId/deactivate` | `src/modules/catalog/infrastructure/http/productRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| GET | `/api/v1/stores/:storeId/products/:productId/additions` | `src/modules/catalog/infrastructure/http/productRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| PUT | `/api/v1/stores/:storeId/products/:productId/additions` | `src/modules/catalog/infrastructure/http/productRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| GET | `/api/v1/stores/:storeId/catalog` | `src/modules/catalog/infrastructure/http/storeCatalogRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/me/customer` | `src/modules/customer/infrastructure/http/customerRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| GET | `/api/v1/me/stores` | `src/modules/customer/infrastructure/http/customerStoreRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/me/stores` | `src/modules/customer/infrastructure/http/customerStoreRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/stores/:storeId/kitchen/orders/:orderId/start` | `src/modules/kitchen/infrastructure/http/kitchenRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/stores/:storeId/kitchen/orders/:orderId/finish` | `src/modules/kitchen/infrastructure/http/kitchenRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/orders` | `src/modules/order/infrastructure/http/orderRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| GET | `/api/v1/orders` | `src/modules/order/infrastructure/http/orderRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/orders/release-expired` | `src/modules/order/infrastructure/http/orderRoutes.ts` | Registrada pero no ejecuta el caso: 401 sin Actor, FORBIDDEN tras autenticación |
| GET | `/api/v1/orders/:id` | `src/modules/order/infrastructure/http/orderRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/orders/:id/cancel` | `src/modules/order/infrastructure/http/orderRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/organizations/:organizationId/stores` | `src/modules/organization/infrastructure/http/organizationRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| GET | `/api/v1/organizations/:organizationId/stores` | `src/modules/organization/infrastructure/http/storeManagementRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/stores/:storeId/deactivate` | `src/modules/organization/infrastructure/http/storeManagementRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/orders/:orderId/pickup/qr` | `src/modules/pickup/infrastructure/http/pickupRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/orders/:orderId/pickup/manual` | `src/modules/pickup/infrastructure/http/pickupRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/stores/:storeId/pickup/by-code` | `src/modules/pickup/infrastructure/http/pickupRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| POST | `/api/v1/stores/:storeId/pickup/orders/:orderId/confirm` | `src/modules/pickup/infrastructure/http/pickupRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| GET | `/api/v1/stores/:storeId/stock` | `src/modules/stock/infrastructure/http/stockRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |
| GET | `/api/v1/me` | `src/infrastructure/auth/http/meRoutes.ts` | Registrada; autenticación/permisos y dependencias según handler |

## Casos internos y procesos automáticos

- Pagos: CreatePaymentUseCase, ResolvePaymentUseCase, ProcessPaymentResultUseCase y
  ProcessLatePaymentCompensationUseCase existen en src/modules/payment/application/.
  app.ts no registra router payment, checkout ni webhook. El adaptador de pagos sí se
  reutiliza internamente para expireOrder; eso no expone ni integra una pasarela.
  RN-068–077; T14/T15/T31.
- createOrderModule inyecta placeReservedOrder/cancelReservedOrder en los casos de
  creación/cancelación. prismaOrderReservation.ts coordina pedido y stock con
  transacción y advisory lock por buffet. La alternativa sin ese puerto del caso de
  uso no acredita la atomicidad de la composición productiva ni viceversa.
  RN-076,081–084; T03/T14/T19/T31.
- ReleaseExpiredReservationsUseCase.execute está construido en orderModule.ts,
  pero no se localizó invocación de job en index.ts/scripts. La ruta release-expired
  lo deniega en vez de ejecutarlo. RN-061,070,074; T14/T15/T32.
- index.ts sí llama processEligiblePickups al arrancar y cada 10 segundos, con guard
  local de ejecución superpuesta. Activa preparados dentro de ventana; no es
  scheduler CocIA, expiración de reservas ni cierre por no retiro. No se ejecutó
  ni se comprobó durabilidad/multiproceso en esta revisión. RN-065,092–106,120;
  T12/T18/T20/T22/T32.
- Asignación de staff/configuración maxAdvanceDays tienen casos internos y scripts,
  pero no sus rutas de gestión en BASE. PR #89 incorpora ampliaciones: no deben
  figurar como endpoints integrados. RN-026,035,054; T02/T10/T11/T34.
- Sin jobs integrados localizados para no retiro, sanciones, recuperados/descarte,
  notificaciones ni beneficios. RN-062,085–089,120–136,173–184;
  T22/T23/T24/T28/T32.

Referencias no integradas: PR #89 según snapshot, rama feature/C2-frontend-rutas-base
@ `7831234b2875c67c01daf81508b52e76e0e60b9b`; MenIA feature/C3-01-menia
@ `fae7add08f318e6a554947067328bdf3049bb1b4`. Se inspeccionaron objetos locales;
no se revalidó estado remoto. La auditoría de pantallas conserva esas dependencias.

## Hallazgos: código confirmado frente a riesgos por reproducir

Confirmado por código no significa reproducido contra DB/proveedor. Los resultados
históricos de pruebas se identifican expresamente; no se ejecutaron pruebas nuevas.

| ID | Evidencia concreta y nivel de comprobación | Brecha, RN y tarea |
|---|---|---|
| B01 | Código: src/modules/customer/application/registerCustomer.ts: makeRegisterCustomer registra nombre/email sin código; customerRoutes.ts: POST /me/customer | Alta puede quedar sin membresía inicial. RN-002; T08/T05. Falta recorrido real de registro/asociación obligatoria. |
| B02 | Código: src/modules/order/application/createOrderUseCase.ts: execute, reservedUntil = Date.now() + 15 * 60 * 1000 | Desvío RN-070: implementa 15 minutos, Master exige máximo 5. Corregir reloj/límites coherentes con checkout y pago; T14/T15, como la matriz RN. No se cambió implementación. |
| B03 | Código: order/application/releaseExpiredReservationsUseCase.ts: execute; order/infrastructure/orderModule.ts; src/index.ts | Caso interno sin job invocador localizado; ruta pública deniega. Falta liberar automáticamente al vencer. RN-061,070,074; T14/T15/T32. Existencia del caso no prueba ejecución automática. |
| B04 | Código: pickup/infrastructure/prismaIssuePickupTokenAdapter.ts: issue (now+5 min); prismaConfirmPickupAdapter.ts: confirm; prismaManualPickupAdapter.ts: issue/findByCode | Se exige READY_FOR_PICKUP, hash/uso/expiración de token, pero no promisedFrom/toleranceUntil de operación. Manual sin expiración propia. Riesgo de retiro fuera de tolerancia por reproducir en PostgreSQL. RN-113–116,120; T19/T22/T31. |
| B05 | Riesgo estático: stock/infrastructure/prismaStockRepository.ts: hasSufficientStock/reserveStock; catalog/infrastructure/stockCatalogAvailability.ts: getAvailability; pickup/infrastructure/prismaConfirmPickupAdapter.ts: confirm | Sin balance se permite disponibilidad/reserva, pero retiro exige reservedStock y puede devolver STOCK_RESERVATION_CONFLICT. Falta reproducir circuito DB y acordar política; no se afirma incidente demostrado. RN-079–084; T03/T07/T19/T31. |
| B06 | Riesgo estático: order/infrastructure/http/orderRoutes.ts: POST /orders; order/application/createOrderUseCase.ts: execute; order/infrastructure/prismaOrderReservation.ts: placeReservedOrder | Router valida total/adicionales en primera lectura; caso relee catálogo fuera de la transacción de reserva y no valida ProductAddition. Cambio concurrente puede desalinear validaciones. Falta reproducción precio/edición, sin exploit demostrado. RN-031–032,043,081–082; T03/T11/T31. |
| B07 | Código: payment/application/processLatePaymentCompensationUseCase.ts: execute. Dos caracterizaciones históricas en docs/audits/tests/payment-compensation.characterization.test.ts, 2 PASS con puertos en memoria | Tras crear PENDING, fallo del provider o al persistir resultado bloquea retry con COMPENSATION_ALREADY_EXISTS. Falta reconciliación durable. PASS caracteriza defecto, no refund real ni DB. RN-075,077; T14/T31. |
| B08 | Código: createOrderUseCase.ts usa Date.now; schema Store sin timezone/horarios; index.ts usa reloj del proceso | Dinero en centavos/snapshots presente; falta autoridad temporal uniforme para horarios y ventanas. RN-054–059,065,067,077; T06/T11/T12/T14. Configuración efectiva cloud no comprobada. |
| B09 | Código: payment/infrastructure/prismaPaymentOrderStockAdapter.ts: expireOrder, status EXPIRED; orderModule.ts inyecta ese puerto | La composición productiva difiere del fallback que usa CANCELLED. Master exige CANCELADO al expirar; alinear compensación y fronteras. RN-061,074–075; T11/T14/T31. |
| B10 | Código: payment/application/createPaymentUseCase.ts: execute recibe expiresAt, comprueba fecha futura; no impone cinco minutos | No hay límite propio de 5 min ni circuito público que lo garantice. RN-070,074; T14/T15. No equivale a pago integrado correcto. |
| B11 | Código: CreateOrderRequest solo storeId/customerId/items; execute no consulta activos ni genera/valida fecha/ventana, horarios o capacidad | Sin programación/horizonte, 15 min de anticipación, ventana 5 min/tolerancia/cierre ni guard de solapamiento. Campos nullable no implementan política. RN-054–059,066–067,078; T06/T11/T12/T15/T31. |

## TDD de referencia contrastados

| TDD | Criterios / reglas vinculados | Resultado del contraste |
|---|---|---|
| 0001 | Registro, código obligatorio, login/recovery; RN-001–010 | Alta sin código y recovery sin UI; Neon real pendiente |
| 0002 | Membresía, contexto y perfil; RN-005–025 | Asociación existente, perfil/rutina/historial incompletos |
| 0003 | Gobierno, horarios y staff; RN-026–035/054–055 | Horarios/setup ausentes; staff en PR |
| 0004 | Categorías, productos, adicionales y snapshots | Base integrada con tests; persistencia local pendiente |
| 0005 | Reserva todo-o-nada, liberación, consumo, recovered | Transacción presente; jobs/recovered faltan, mención V3 pendiente |
| 0006 | Catálogo/recomendaciones, filtros, confirmación, audio | Chat en rama sin LLM ni tools completos |
| 0007 | Ventana, reserva 5 min, pago, refunds/overlap | Reserva 15 min y sin flujo pago/ventana integrado |
| 0008 | Fallback, carga, scheduler/replan | Sin motor integrado localizado |
| 0009 | Cola, inicio/fin, venta presencial y permisos | Start/finish presentes; cola en PR, presencial ausente |
| 0010 | QR/manual, vigencia, single-use y auditoría | Hash/rol y control de uso localizados; no certificación integral; temporalidad/retry por cerrar |
| 0011 | No retiro, aviso, strikes, rehabilitación, recuperación | Sin implementación integrada localizada |
| 0012 | In-app/push, ready/replan, no aviso solo tolerancia | Sin implementación integrada localizada |
| 0013 | Saldo organizacional, límites puntos, ledger | Sin implementación integrada; menciona V3, no se modifica V2 |
| 0014 | Oferta fija, canje atómico, 10%, expiración/restauración | Sin implementación integrada localizada |

## Arquitectura y contratos

El dominio está mayormente separado de Express/Prisma. Hay acoplamientos a revisar:
`order/application/createOrderUseCase.ts` importa `getPrisma` y lee catálogo/Store;
`pickup/infrastructure/prismaConfirmPickupAdapter.ts` escribe Order y Stock directamente;
`payment/infrastructure/prismaPaymentOrderStockAdapter.ts` coordina tablas de pago,
pedido y stock. La atomicidad lograda es útil, pero no demuestra cumplimiento de la
frontera de puertos definida en el Master. Registrar ADR/contrato antes de ampliar,
sin refactorizar productivo dentro de la auditoría.

Los TDD son BORRADOR y varios paths HTTP propuestos difieren de los implementados.
Ejemplo TDD-0010: GET operations pickup-token frente a POST orders pickup/qr;
by-code se implementa como POST para no filtrar código en URL. Es una diferencia
de contrato a documentar, no por sí sola una violación funcional. TDD-0010 CA-03
pide rechazo de token usado mientras sección 5 permite respuesta idempotente del
retiro ya existente: aclarar resultado HTTP sin permitir un segundo consumo.

El comentario de assignStaffRole excluye UI staff del MVP, pero RN-035 la exige:
prevalece el Master. Los ejemplos de modelo del Master son guía técnica; no se
declara una RN incumplida por usar otro nombre de entidad o enum equivalente.

## Base de datos y seguridad

Se inspeccionaron schema y migraciones versionadas: claves únicas, FKs por scope,
snapshots, campos de retiro, pagos y compensación. No se aplicaron migraciones a
ninguna base. Las 23 pruebas omitidas en la ejecución local histórica limitan su validación PostgreSQL.
El CI histórico sí ejecutó migraciones sobre PostgreSQL 16, con tres pruebas omitidas.
No se certifica migración sobre base existente ni ausencia de drift cloud.

Las pruebas negativas existentes cubren roles/identidad/propiedad con dependencias de prueba; su PASS local es histórico.
No se declara seguridad total: falta probar todos los perfiles con Neon real,
retiro temporal, reglas de sanción y nuevos endpoints tras integrar ramas.
`domainErrorHandler` traduce errores de dominio; errores genéricos van a 500 con
mensaje externo genérico. Revisar logs antes de producción para no registrar
credenciales. No se recopilaron variables privadas ni tokens.
