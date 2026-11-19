# T03 — Auditoría transaccional: pedidos, pagos, stock y retiro

**Responsable:** Flores Lautaro  
**Fecha:** 18/11/2026  
**Base auditada:** rama `develop` (commit `e427639`)  
**Referencia funcional:** `TAKEANDGO_MASTER_V2_0.md` (RN-054 a RN-091 y RN-113 a RN-119)

## Alcance y método

Se revisaron los módulos `order`, `payment`, `stock`, `kitchen` y `pickup` de `apps/api`: rutas registradas en `app.ts`, casos de uso, adaptadores Prisma, esquema de base de datos y pruebas automatizadas.

Se ejecutó la suite completa de la API: **334 tests, 331 aprobados, 0 fallidos y 3 omitidos**. Los 3 omitidos son pruebas de persistencia que solo corren contra una base local (`kitchenPersistence`, `paymentPersistence` y `paymentOrderStockPersistence`); en el CI, que usa una base PostgreSQL local temporal, sí se ejecutan.

Se distingue entre **código interno** (caso de uso existente) y **funcionalidad accesible** (expuesta por un endpoint HTTP). Una funcionalidad sin endpoint no puede usarse desde el frontend ni mostrarse en la demo.

Estados usados en la matriz:

- **OK:** implementado, accesible y con prueba.
- **Parcial:** implementado con diferencias respecto del documento funcional, o sin exposición HTTP.
- **Falta:** no se localizó implementación.

## 1. Endpoints existentes

| Módulo | Método y ruta | Quién | Caso de uso |
| --- | --- | --- | --- |
| Pedidos | `POST /api/v1/orders` | CUSTOMER | `CreateOrderUseCase` |
| Pedidos | `GET /api/v1/orders` | CUSTOMER | Listado propio |
| Pedidos | `GET /api/v1/orders/:id` | CUSTOMER (dueño) | `GetOrderByIdUseCase` |
| Pedidos | `POST /api/v1/orders/:id/cancel` | CUSTOMER (dueño) | `CancelOrderUseCase` |
| Pedidos | `POST /api/v1/orders/release-expired` | Bloqueado (403) | Operación interna |
| Stock | `GET /api/v1/stores/:storeId/stock` | Staff del buffet | Consulta |
| Stock | `PUT /api/v1/stores/:storeId/stock` | STORE_ADMIN | Ajuste |
| Cocina | `GET /api/v1/stores/:storeId/kitchen/orders` | Staff del buffet | Cola |
| Cocina | `POST .../kitchen/orders/:orderId/start` | Staff del buffet | `StartPreparationUseCase` |
| Cocina | `POST .../kitchen/orders/:orderId/finish` | Staff del buffet | `FinishPreparationUseCase` |
| Retiro | `POST /api/v1/orders/:orderId/pickup/qr` | CUSTOMER | `IssuePickupTokenUseCase` |
| Retiro | `POST /api/v1/orders/:orderId/pickup/manual` | CUSTOMER | Código manual |
| Retiro | `POST /api/v1/stores/:storeId/pickup/by-code` | Staff del buffet | Búsqueda por código |
| Retiro | `POST /api/v1/stores/:storeId/pickup/orders/:orderId/confirm` | Staff del buffet | `ConfirmPickupUseCase` |
| **Pagos** | **Ninguno** | — | Casos de uso sin rutas |

## 2. Matriz de reglas

### Reserva y stock

| RN | Regla | Evidencia | Prueba | Estado |
| --- | --- | --- | --- | --- |
| RN-070 | Reserva de 5 minutos para pagar | `createOrderUseCase.ts` usa `15 * 60 * 1000` (15 minutos) | — | **Parcial** |
| RN-074 | Sin pago en 5 minutos, se cancela y se libera stock | `ReleaseExpiredReservationsUseCase` existe, pero ningún proceso lo ejecuta automáticamente | `orderStock.test.ts` | **Parcial** |
| RN-081 | Reserva de stock todo-o-nada | `placeReservedOrder`: transacción, bloqueo por buffet (`pg_advisory_xact_lock`) y `updateMany` condicionado a `availableStock >= cantidad` | `orderReservationIntegration.test.ts` (concurrencia y rollback) | OK |
| RN-082 | El backend revalida disponibilidad al reservar | Ruta recalcula productos y precios desde el catálogo; la reserva vuelve a validar stock | `orderRoutes.test.ts` | OK |
| RN-080 | Stock propio de adicionales | Reserva incluye adicionales con la misma condición | `orderStock.test.ts` | OK |
| RN-090 | Ajustes auditables (delta, actor, motivo, momento) | Modelo `StockMovement` con `reason` y `actorUserId` | Revisar en T07 | Parcial |
| RN-084 | Al retirar, el stock reservado pasa a consumido | Confirmación de retiro dentro de transacción | `prismaConfirmPickupAdapter.test.ts` | OK |

### Pedido y precios

| RN | Regla | Evidencia | Prueba | Estado |
| --- | --- | --- | --- | --- |
| — | Snapshots históricos de nombre y precio | `OrderItemSnapshot` y `OrderItemAdditionSnapshot` | `orderRoutes.test.ts` | OK |
| — | Precio calculado por el backend, no por el cliente | La ruta toma precios del catálogo y valida adicionales del producto | `orderRoutes.test.ts` | OK |
| — | Dinero sin decimales binarios | Centavos enteros (`totalCents`) con control de desborde | `orderRoutes.test.ts` | OK |
| RN-061 | El CUSTOMER puede cancelar antes de pagar | `POST /orders/:id/cancel` solo desde RESERVADO | `orderRoutes.test.ts` | OK |
| RN-076 | No cancelar después de pagar | Rechaza estados distintos de RESERVADO (`ORDER_STATE_CONFLICT`) | `orderRoutes.test.ts` | OK |
| RN-054 | Pedidos futuros hasta 7 días | `scheduledForDate` existe en el modelo, pero `createOrder` no lo recibe | — | **Falta** (T11) |
| RN-055, RN-059 | Horarios y cierre operativo del buffet | No se valida contra horarios al crear el pedido | — | **Falta** (T06/T11) |
| RN-056, RN-057, RN-058, RN-067 | Ventana de 5 minutos, tolerancia de 5 y anticipación mínima de 15 | `promisedFrom`, `promisedTo` y `toleranceUntil` existen en el modelo, pero **`createOrder` no los asigna** | — | **Falta** (T11) |
| RN-078 | No permitir nuevo pedido con otro activo en retiro | No se localizó la validación | — | **Falta** (T11) |

### Pago

| RN | Regla | Evidencia | Prueba | Estado |
| --- | --- | --- | --- | --- |
| RN-068 | Pasarela de pago virtual | No hay proveedor integrado ni endpoints | — | **Falta** (T14) |
| RN-069 | Estados PENDIENTE, APROBADO, RECHAZADO, REEMBOLSADO | `payment.ts` con transiciones válidas | `payment.test.ts` (24 tests) | OK (interno) |
| RN-072 | Pago aprobado → CONFIRMADO | `ProcessPaymentResultUseCase` + `prismaPaymentOrderStockAdapter` | `paymentOrderStock.test.ts` | Parcial: sin endpoint |
| RN-073 | Pago rechazado → CANCELADO y liberación | Mismo adaptador | `paymentOrderStock.test.ts` | Parcial: sin endpoint |
| RN-075 | Aprobación tardía no reactiva; se compensa | `ProcessLatePaymentCompensationUseCase` exige pedido EXPIRED | `paymentCompensation.test.ts` | Parcial: sin endpoint ni webhook |
| — | Idempotencia de resultados repetidos | Solo procesa pagos en PENDIENTE; un resultado repetido no vuelve a aplicarse | `payment.test.ts` | Parcial: falta clave de idempotencia del proveedor (T14) |

### Cocina y retiro

| RN | Regla | Evidencia | Prueba | Estado |
| --- | --- | --- | --- | --- |
| RN-060 | Flujo CONFIRMADO → EN_PREPARACIÓN → PARA_RETIRAR → RETIRADO | Casos de uso de cocina y retiro | `kitchen/*.test.ts`, `pickup/*.test.ts` | Parcial: sin pago no se llega a CONFIRMADO |
| RN-065 | PARA_RETIRAR solo con pedido listo y ventana iniciada | `ActivatePickupWhenEligibleUseCase` exige `promisedFrom` y `promisedTo` | `activatePickupWhenEligible.test.ts` | Parcial: los pedidos reales no tienen ventana (ver B2) |
| RN-113 | QR solo en PARA_RETIRAR | Emisión de token condicionada al estado | `issuePickupTokenUseCase.test.ts` | OK |
| RN-114 | QR seguro y de un solo uso | Se guarda el hash del token; se consume con `updateMany` condicionado a `usedAt: null` y vigencia | `prismaPickupConcurrency.test.ts` | OK |
| RN-115, RN-116 | Validar buffet, estado, vigencia y uso; registrar retiro | Confirmación en transacción con verificación de cantidad afectada | `confirmPickupUseCase.test.ts` | OK |
| RN-117, RN-118 | Retiro manual por código, auditado | Rutas `pickup/manual` y `by-code` | `pickupRoutes.test.ts` | OK (revisar auditoría en T19) |
| RN-062, RN-120 | Sin retiro al fin de la tolerancia → NO_RETIRADO | No existe el estado NO_RETIRADO ni el proceso que lo aplica | — | **Falta** (T22) |

## 3. Brechas prioritarias

| # | Brecha | Impacto | Tarea |
| --- | --- | --- | --- |
| B1 | **No hay endpoints de pago.** Un pedido queda en RESERVADO y nunca llega a CONFIRMADO por HTTP. | Bloquea la demo: sin pago no hay cocina ni retiro. | T14 |
| B2 | **`createOrder` no asigna ventana de retiro** (`promisedFrom`, `promisedTo`, `toleranceUntil`). La activación de PARA_RETIRAR la exige. | Aun con pago, un pedido nunca quedaría listo para retirar. | T11 |
| B3 | **La reserva dura 15 minutos**, no 5 como indica el documento funcional. | Incumple RN-070 y RN-074; afecta el cálculo de ventanas (RN-067). | T11 |
| B4 | **Nadie libera las reservas vencidas automáticamente.** El único proceso periódico (`index.ts`) activa retiros, y corre dentro del servidor. | Stock retenido indefinidamente; en hosting que se suspende sin tráfico, tampoco corre el proceso de retiros. | T11 / T32 |
| B5 | **No existe NO_RETIRADO** ni el cierre por fin de tolerancia. | Sin esto no hay sanciones (RN-121), puntos por no retiro ni unidades recuperadas. | T22 |
| B6 | Sin validación de horarios, anticipación máxima ni pedido activo superpuesto. | Se pueden crear pedidos fuera del horario del buffet. | T06 / T11 |

## 4. Riesgos

- **Procesos automáticos dentro del servidor.** `setInterval` en `index.ts` depende de que el proceso esté siempre encendido. Hay que definir el mecanismo en la nube (T32) antes de agregar más procesos (expiración, NO_RETIRADO, descarte).
- **Pruebas de persistencia omitidas localmente.** Tres pruebas solo corren contra una base local; conviene confirmar en cada PR que el CI las ejecuta.
- **Reloj.** Los cálculos de reserva usan `Date.now()` directamente; el documento técnico pide un reloj inyectable para probar vencimientos de 5 minutos sin esperar.

## 5. Conclusión

El núcleo transaccional que existe está bien protegido: la reserva de stock es atómica y resiste concurrencia, el QR es de un solo uso, los precios los calcula el backend y los pedidos conservan snapshots.

El problema es la **conexión entre las piezas**: falta exponer el pago (B1) y asignar la ventana de retiro (B2). Sin esas dos, el recorrido reserva → pago → cocina → retiro no puede completarse por HTTP. Se recomienda priorizar B1 (T14) y B2 junto con B3 (T11), y definir el mecanismo de procesos automáticos (B4) antes de implementar NO_RETIRADO (B5).
