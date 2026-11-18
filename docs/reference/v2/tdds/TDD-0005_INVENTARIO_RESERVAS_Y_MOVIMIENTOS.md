---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0005 — Inventario, Reservas y Movimientos

## 1. Contexto de negocio

### Objetivo
Implementar inventario por buffet, disponibilidad, reservas temporales de 5 minutos, consolidación, liberación, consumo, ajustes y unidades recuperadas, garantizando atomicidad y evitando sobreventa.

### Roles involucrados
- `STORE_ADMIN`
- `STORE_EMPLOYEE` como consumidor operativo
- Módulos Pedido/Canje/Venta Presencial

### Reglas de negocio relacionadas
`RN-070`, `RN-074`, `RN-079` a `RN-091`; relacionadas `RN-110`, `RN-161`, `RN-170` a `RN-172`.

### Alcance
- Stock base por unidades de producto.
- Stock de adicionales cuando corresponda.
- Reserva temporal atómica al iniciar pago.
- Consolidar reserva al aprobar pago sin descontar dos veces.
- Liberar al expirar/rechazar/cancelar antes de aprobación.
- Consumir al retirar o al registrar venta presencial según contrato.
- Restock y ajustes auditados.
- RecoveredPreparedUnit y devolución de productos envasados cuando aplique.

### Dependencias
- `TDD-0003` Store y scopes.
- `TDD-0004` productos/adicionales.
- `TDD-0007` dispara reserva/consolidación/liberación.
- `TDD-0011` dispara recuperación/desperdicio.

---

## 2. Criterios de aceptación

### CA-01 — Reserva temporal todo-o-nada

**Dado** un pedido con varios ítems/adicionales disponibles  
**Cuando** se crea la intención de pago  
**Entonces** se reserva temporalmente todo lo necesario; si falta algo, no se reserva ninguna parte

**RN relacionadas:** `RN-070`, `RN-081`, `RN-082`

### CA-02 — Evitar doble venta

**Dado** una última unidad  
**Cuando** dos operaciones intentan reservarla concurrentemente  
**Entonces** solo una obtiene la reserva

**RN relacionadas:** `RN-081`

### CA-03 — Consolidar sin doble descuento

**Dado** una reserva temporal vigente  
**Cuando** el pago se aprueba  
**Entonces** la reserva se consolida para el pedido confirmado sin reservar/descontar otra vez

**RN relacionadas:** `RN-083`

### CA-04 — Liberar al expirar

**Dado** una reserva temporal pendiente  
**Cuando** vence/rechaza/cancela antes de aprobación  
**Entonces** el stock vuelve a estar disponible inmediatamente

**RN relacionadas:** `RN-074`

### CA-05 — Consumir al retirar

**Dado** stock reservado para un pedido  
**Cuando** el retiro se valida  
**Entonces** la reserva pasa a consumo definitivo

**RN relacionadas:** `RN-084`

### CA-06 — Ajustes auditados

**Dado** un STORE_ADMIN de su buffet  
**Cuando** hace restock o ajuste manual  
**Entonces** se registra delta, momento, actor y motivo

**RN relacionadas:** `RN-090`

### CA-07 — Unidad recuperada

**Dado** un producto preparado NO_RETIRADO  
**Cuando** se recupera  
**Entonces** se guarda su configuración exacta y tiene prioridad para una operación idéntica

**RN relacionadas:** `RN-085` a `RN-089`

---

## 3. Diseño técnico

### Modelo de dominio
- `InventoryBalance`
- `StockReservation` (temporal/consolidada)
- `StockMovement`
- `RecoveredPreparedUnit`

**Invariantes principales**
- available >= 0.
- Una reserva referencia una operación y conjunto exacto de recursos.
- Estados de reserva no permiten consolidar/consumir dos veces.
- RecoveredPreparedUnit solo se reasigna a configuración exacta.

### Casos de uso
- `CheckAvailability`
- `ReserveStock`
- `ConsolidateReservation`
- `ReleaseReservation`
- `ConsumeReservedStock`
- `Restock`
- `AdjustStock`
- `CreateRecoveredUnit`
- `AssignRecoveredUnit`
- `DiscardRecoveredUnit`
- `ReturnPackagedItemToStock`

### Puertos requeridos
- `InventoryRepositoryPort`
- `ProductCatalogPort`
- `Clock`
- `AuditPort`

### Contratos / API
- `API administrativa de stock `/api/v1/stores/:storeId/inventory` y movimientos.`
- `Las operaciones transaccionales se exponen preferentemente como puertos de Application a otros módulos, no como manipulación directa de tablas.`

### Persistencia
- InventoryBalance por store/product o addition.
- StockMovement inmutable/auditable.
- StockReservation con operationId, status, expiresAt y cantidades.
- RecoveredPreparedUnit con snapshot exacto de producto/adicionales y fecha.

### Eventos y asincronía
- `StockReserved`, `StockReleased`, `StockConsumed`, `StockAdjusted`, `RecoveredUnitCreated/Discarded` si la arquitectura de eventos los requiere.

### Servicios externos / adaptadores
- No requiere servicio externo; locking/transaction semantics dependen del datastore ADR.

---

## 4. Seguridad y aislamiento

### RBAC
- STORE_ADMIN puede restock/ajustar su buffet.
- Otros módulos invocan puertos internos autorizados; CUSTOMER nunca manipula balance directamente.

### Tenant scope
- Todos los balances/movimientos/reservas están scoped al Store de la operación.

### Datos sensibles y auditoría
- Ajustes manuales obligatoriamente auditan delta, actor, momento y motivo.
- Movimientos transaccionales conservan operationId/correlationId.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- ReserveStock es todo-o-nada.
- Consolidate/Release/Consume son atómicos respecto del estado de reserva y balance.

### Concurrencia
- Usar mecanismo de locking/optimistic concurrency/conditional update que impida stock negativo y doble reserva.

### Idempotencia
- Consolidar, liberar y consumir la misma reserva repetida no duplica movimiento.
- operationId/idempotency key evita doble reserva por reintento.

### Reintentos y compensación
- Reintentos deben detectar el estado actual de la reserva.
- Si una transacción falla, rollback completo.

---

## 6. Tiempo y dinero

### Tiempo
- Reserva temporal usa expiresAt provisto por la operación de pedido y `Clock`.
- Recovered units no vendidas al cierre del día se descartan según TDD-0011/horario del Store.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- Inventario no calcula precios; recovered units se venden al precio vigente consultado al catálogo.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### Stock parcial

**Condición:** falta cualquier producto/adicional requerido  
**Resultado esperado:** rechazar reserva completa  
**Error de dominio / HTTP:** `INSUFFICIENT_STOCK` / 409  
**Efectos laterales:** cero reservas parciales.

### Reserva ya consolidada

**Condición:** se recibe confirmación duplicada  
**Resultado esperado:** responder idempotentemente  
**Error de dominio / HTTP:** No aplica/estado existente  
**Efectos laterales:** no descontar dos veces.

### Liberación duplicada

**Condición:** expiración/rechazo procesado dos veces  
**Resultado esperado:** no aumentar stock dos veces  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** un único movimiento efectivo.

### Recovered unit incompatible

**Condición:** la operación no coincide exactamente  
**Resultado esperado:** no asignarla  
**Error de dominio / HTTP:** `RECOVERED_UNIT_NOT_COMPATIBLE`  
**Efectos laterales:** permanece disponible.

---

## 8. Estrategia de testing

### Tests de dominio
- Máquina de estados de reserva.
- Compatibilidad exacta de recovered unit.
- Ajustes/movimientos.

### Tests de aplicación
- reserve/consolidate/release/consume y ajustes.
- Prioridad recovered unit.

### Tests de integración
- Concurrencia real con última unidad.
- Transacciones y constraints.
- Idempotencia de movimientos.

### Seguridad
- Cross-store stock adjustment rechazado.

### Casos críticos
- 100+ intentos concurrentes sobre stock limitado.
- Confirmación y expiración compitiendo.
- Webhook duplicado que intenta consolidar dos veces.

---

## 9. BLOCKERS y decisiones abiertas

`Sin BLOCKERS conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- Reserva temporal y consolidación cumplen Master V3.
- No existe sobreventa en tests concurrentes.
- Movimientos idempotentes/auditables.
- Recovered units cubiertas.
- RBAC/tenant verificados.
- Tests pasan y no hay BLOCKERS.
