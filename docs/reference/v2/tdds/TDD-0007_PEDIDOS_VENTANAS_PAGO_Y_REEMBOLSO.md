---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0007 — Pedidos, Ventanas, Pago y Reembolso

## 1. Contexto de negocio

### Objetivo
Implementar el núcleo transaccional de pedidos digitales: cotización, ventana, reserva de 5 minutos, pago, estados, pedidos futuros, cancelaciones excepcionales y reembolsos.

### Roles involucrados
- `CUSTOMER`
- `STORE_EMPLOYEE`/`STORE_ADMIN` para estados/cancelación operativa cuando corresponda

### Reglas de negocio relacionadas
`RN-054` a `RN-078`; integra `RN-070`/`RN-074` con TDD-0005.

### Alcance
- Pedido normal y programado.
- Validación de maxAdvanceDays y horarios.
- Anticipación mínima 15 min considerando hasta 5 min de pago.
- Ventana 5 min + tolerancia 5 min.
- Máquina de estados Order/Payment.
- Reserva temporal de 5 min y coordinación con Inventory.
- Pago virtual, webhook idempotente, rechazo, expiración y aprobación tardía.
- Cancelación excepcional del buffet con reembolso.
- Restricción de pedido solapado en EN_PREPARACIÓN/PARA_RETIRAR.

### Dependencias
- `TDD-0002` customer/contexto/sanciones visibles.
- `TDD-0003` horarios y maxAdvanceDays.
- `TDD-0004` catálogo/snapshots.
- `TDD-0005` reserva de stock.
- `TDD-0008` disponibilidad de ventana/schedule.
- `TDD-0014` beneficio 10% cuando corresponda.

---

## 2. Criterios de aceptación

### CA-01 — Ventana válida

**Dado** una solicitud de pedido  
**Cuando** se ofrece una ventana  
**Entonces** está dentro de maxAdvanceDays, horario del buffet y deja al menos 15 min aun si el pago tarda 5 min

**RN relacionadas:** `RN-054` a `RN-059`, `RN-067`

### CA-02 — Reserva y pago pendiente

**Dado** stock y ventana factibles  
**Cuando** CUSTOMER confirma intención  
**Entonces** Order queda RESERVADO, Payment PENDIENTE y stock temporal reservado por máximo 5 min

**RN relacionadas:** `RN-068` a `RN-071`

### CA-03 — Pago aprobado

**Dado** RESERVADO vigente  
**Cuando** webhook válido aprueba el pago  
**Entonces** Order pasa a CONFIRMADO y Inventory consolida la reserva

**RN relacionadas:** `RN-072`

### CA-04 — Pago rechazado/expirado

**Dado** RESERVADO  
**Cuando** pago se rechaza o vence  
**Entonces** Order pasa a CANCELADO y se libera reserva temporal

**RN relacionadas:** `RN-073`, `RN-074`

### CA-05 — Aprobación tardía

**Dado** Order ya expirado  
**Cuando** llega aprobación posterior  
**Entonces** no se reactiva y se procesa reversión/reembolso

**RN relacionadas:** `RN-075`

### CA-06 — No cancelar después de pago

**Dado** Order CONFIRMADO  
**Cuando** CUSTOMER intenta cancelar  
**Entonces** la operación se rechaza

**RN relacionadas:** `RN-076`

### CA-07 — Cancelación del buffet

**Dado** pedido pagado y causa justificada  
**Cuando** buffet cancela  
**Entonces** Order CANCELADO, motivo trazado y Payment termina REEMBOLSADO cuando se completa devolución

**RN relacionadas:** `RN-063`, `RN-077`

### CA-08 — Sin pedido solapado

**Dado** CUSTOMER con pedido EN_PREPARACIÓN o PARA_RETIRAR en ventana activa  
**Cuando** intenta crear otro pedido normal  
**Entonces** se rechaza la nueva operación

**RN relacionadas:** `RN-078`

---

## 3. Diseño técnico

### Modelo de dominio
- `Order`, `OrderItem`, `OrderItemAddition` con snapshots.
- `Payment` y `Refund`.
- Value Objects: `PickupWindow`, `Money`, `OrderStatus`, `PaymentStatus`.

**Invariantes principales**
- Transiciones según máquina del Master.
- Un Order usa una única ventana para todos sus ítems.
- PARA_RETIRAR no se activa solo por estar listo antes de ventana.
- Pago y Order mantienen estados consistentes.

### Casos de uso
- `QuoteOrder`
- `CreateOrderReservation`
- `ApprovePayment`
- `RejectPayment`
- `ExpireOrderReservation`
- `CancelPaidOrderByStore`
- `HandleLatePaymentApproval`
- `StartOrderPreparation`
- `MarkOrderReady`
- `ActivatePickupWhenEligible`

### Puertos requeridos
- `OrderRepositoryPort`
- `PaymentPort`
- `InventoryPort`
- `CocIAPort`
- `StoreSchedulePort`
- `CustomerDisciplinePort`
- `DiscountBenefitPort`
- `Clock`
- `EventBusPort`

### Contratos / API
- `POST /api/v1/stores/:storeId/orders/quote`
- `POST /api/v1/stores/:storeId/orders`
- `GET /api/v1/orders/:orderId`
- `POST /api/v1/payments/webhook`
- `POST /api/v1/orders/:orderId/store-cancel`

### Persistencia
- Order con scheduledForDate, promisedFrom, promisedTo, toleranceUntil, readyAt?, status.
- OrderItem/Addition con snapshots de nombre/precio.
- Payment(status, expiresAt, provider refs).
- Refund(motivo, proveedor, momento, referencia).

### Eventos y asincronía
- `OrderReserved`, `OrderConfirmed`, `OrderCancelled`, `OrderExpired`, `OrderReady`, `OrderPickupWindowActivated`, `RefundRequested/Completed`.

### Servicios externos / adaptadores
- Pasarela de pago virtual detrás de `PaymentPort`.

---

## 4. Seguridad y aislamiento

### RBAC
- CUSTOMER crea/consulta sus pedidos.
- Solo staff autorizado del Store puede ejecutar cancelación operativa correspondiente.

### Tenant scope
- Order siempre ligado a Store/Organization del contexto validado.
- No consultar/modificar pedidos cross-store/cross-customer sin permiso.

### Datos sensibles y auditoría
- Guardar motivo de cancelación del buffet y trazabilidad de refund.
- Webhooks almacenan referencia/idempotency metadata sin secretos.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- Crear Order RESERVADO + reservar stock + registrar Payment intent debe ser consistente; usar transacción/saga según boundaries.
- Transiciones de estado y efectos asociados deben ser atómicos o compensables.

### Concurrencia
- Aprobación, rechazo y expiración pueden competir; solo una transición terminal válida gana.

### Idempotencia
- Webhook de pago idempotente por provider event/payment reference.
- Expire/cancel/approve no duplican efectos.

### Reintentos y compensación
- Aprobación tardía dispara compensación segura.
- Refund puede reintentarse sin devolver dos veces.

---

## 6. Tiempo y dinero

### Tiempo
- Clock para 5 min reserva, 15 min anticipación, ventana 5 min, tolerancia 5 min y fechas futuras.
- Timezone del Store para calendario/horarios.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- Quote y Payment usan Money seguro.
- Refund conserva monto/referencia.
- Descuento, si aplica, se integra por TDD-0014.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### Pago y expiración simultáneos

**Condición:** approval llega en el límite  
**Resultado esperado:** una única transición basada en instante/lock definido  
**Error de dominio / HTTP:** Estado conflictivo si pierde carrera  
**Efectos laterales:** sin doble confirmación/liberación.

### Ventana no factible tras quote

**Condición:** capacidad cambia antes de reservar  
**Resultado esperado:** revalidar y ofrecer nueva ventana  
**Error de dominio / HTTP:** `PICKUP_WINDOW_UNAVAILABLE` / 409  
**Efectos laterales:** no cobrar.

### Aprobación tardía

**Condición:** pago aprobado después de expiresAt y Order cancelado  
**Resultado esperado:** no reactivar  
**Error de dominio / HTTP:** No aplica al cliente; proceso compensatorio  
**Efectos laterales:** revertir/reembolsar una sola vez.

### Cancelación cliente post-pago

**Condición:** Order ya CONFIRMADO  
**Resultado esperado:** rechazar  
**Error de dominio / HTTP:** `ORDER_NOT_CANCELLABLE` / 409  
**Efectos laterales:** ninguno.

---

## 8. Estrategia de testing

### Tests de dominio
- Máquinas Order/Payment.
- PickupWindow y reglas 15/5/5.
- Snapshots.

### Tests de aplicación
- Quote/reserve/approve/reject/expire/late approval/refund/overlap.

### Tests de integración
- Webhook idempotente.
- Integración Inventory/CocIA/Payment fake.
- Persistencia de state transitions.

### Seguridad
- Pedidos ajenos/cross-store rechazados.
- Cancelación buffet solo staff autorizado.

### Casos críticos
- Races approve vs expire/reject.
- Webhook duplicado.
- Pago aprobado después de caída intermedia.
- Clock en límites exactos.

---

## 9. BLOCKERS y decisiones abiertas

**Decisión abierta:** proveedor de pagos y forma de webhook se define por ADR. Los contratos de `PaymentPort` permiten avanzar.

`Sin BLOCKERS funcionales conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- CA y máquina de estados implementados.
- Reserva/pago/Inventory consistentes.
- Webhooks idempotentes.
- Reglas temporales testeadas con Clock.
- Refund trazable.
- Tests pasan y no hay BLOCKERS funcionales.
