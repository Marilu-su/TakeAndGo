---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0013 — Puntos y Fidelización

## 1. Contexto de negocio

### Objetivo
Implementar saldo y movimientos de puntos por organización, acreditando puntualidad al retirar pedidos normales con los intervalos exactos definidos en Master V3.

### Roles involucrados
- `CUSTOMER`
- Módulos Retiro/Historial

### Reglas de negocio relacionadas
`RN-137` a `RN-148`.

### Alcance
- Cuenta de puntos por organización.
- Movimientos inmutables/auditables.
- Acreditación por pickup de pedido normal.
- Tramos exactos 10/7/5/3.
- 0 puntos en NO_RETIRADO y canjes.
- Puntos no vencen.
- Consulta de saldo/historial.
- Ventana replanificada como referencia vigente.

### Dependencias
- `TDD-0003` Organization.
- `TDD-0007` Order/ventana.
- `TDD-0010` pickedUpAt/evento de retiro.
- `TDD-0014` consume/spend/refund points para recompensas.

---

## 2. Criterios de aceptación

### CA-01 — Saldo por organización

**Dado** puntos ganados en un buffet  
**Cuando** se consulta saldo en otro buffet de la misma organización  
**Entonces** están disponibles; en otra organización no

**RN relacionadas:** `RN-137`, `RN-138`

### CA-02 — 10 puntos

**Dado** t0 inicio de ventana vigente  
**Cuando** t0 <= pickedUpAt < t0+2min  
**Entonces** acreditar 10 puntos

**RN relacionadas:** `RN-141`

### CA-03 — 7 puntos

**Dado** ventana vigente  
**Cuando** t0+2min <= pickedUpAt < t0+4min  
**Entonces** acreditar 7 puntos

**RN relacionadas:** `RN-142`

### CA-04 — 5 puntos

**Dado** ventana vigente  
**Cuando** t0+4min <= pickedUpAt < t0+5min  
**Entonces** acreditar 5 puntos

**RN relacionadas:** `RN-143`

### CA-05 — 3 puntos

**Dado** ventana vigente  
**Cuando** t0+5min <= pickedUpAt <= t0+10min  
**Entonces** acreditar 3 puntos

**RN relacionadas:** `RN-144`

### CA-06 — Sin puntos por no-show/canje

**Dado** NO_RETIRADO o canje físico  
**Cuando** se cierra/retira  
**Entonces** no se acreditan puntos de puntualidad

**RN relacionadas:** `RN-140`, `RN-145`

### CA-07 — Replanificación

**Dado** CocIA cambió la ventana  
**Cuando** se calcula puntualidad  
**Entonces** se usa la ventana nueva vigente

**RN relacionadas:** `RN-146`

### CA-08 — Beneficio 10% no quita puntos

**Dado** pedido normal con 10% aplicado  
**Cuando** se retira  
**Entonces** genera puntos normalmente

**RN relacionadas:** `RN-147`

---

## 3. Diseño técnico

### Modelo de dominio
- `OrganizationLoyaltyAccount(customerId, organizationId, balance)`
- `PointMovement` inmutable con type, points, sourceOperationId, createdAt.
- `PickupPointsPolicy` pura.

**Invariantes principales**
- Saldo nunca se mezcla entre organizaciones.
- Puntos ganados no vencen.
- Un sourceOperationId acredita puntualidad como máximo una vez.
- Movimientos son inmutables; balance derivable/auditable.

### Casos de uso
- `GetOrganizationBalance`
- `AwardPickupPoints`
- `SpendPoints`
- `RefundPoints`
- `ListPointMovements`

### Puertos requeridos
- `LoyaltyAccountRepositoryPort`
- `PointMovementRepositoryPort`
- `OrderPickupDataPort`
- `Clock`

### Contratos / API
- `GET /api/v1/organizations/:orgId/me/loyalty`
- `GET /api/v1/organizations/:orgId/me/points/movements`
- `Spend/refund se exponen preferentemente a TDD-0014 por port.`

### Persistencia
- OrganizationLoyaltyAccount UNIQUE(customerId, organizationId).
- PointMovement UNIQUE(sourceOperationId, movementReason) para idempotencia.

### Eventos y asincronía
- Consume `OperationPickedUp`; puede emitir `PointsAwarded`, `PointsSpent`, `PointsRefunded`.

### Servicios externos / adaptadores
- No servicio externo obligatorio.

---

## 4. Seguridad y aislamiento

### RBAC
- CUSTOMER consulta su saldo.
- Spend/refund solo casos de uso autorizados, no edición directa por cliente.

### Tenant scope
- organizationId validado contra operación/contexto; no mover puntos cross-org.

### Datos sensibles y auditoría
- Movimientos inmutables con source/reason.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- Crear movimiento + actualizar balance todo-o-nada.

### Concurrencia
- Gastos/acreditaciones concurrentes deben serializar/usar conditional update para no perder saldo.

### Idempotencia
- Pickup event duplicado no acredita doble.
- Refund/spend con operationId deduplicado.

### Reintentos y compensación
- Reprocesar evento usa unique key y devuelve resultado existente.

---

## 6. Tiempo y dinero

### Tiempo
- Cálculo exacto con intervalos del Master y Clock; pickedUpAt es dato del retiro.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- No aplica; los puntos son enteros.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### Borde 2:00 exacto

**Condición:** pickedUpAt = t0+2min  
**Resultado esperado:** 7 puntos, no 10  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** un movimiento.

### Borde 4:00 exacto

**Condición:** pickedUpAt = t0+4min  
**Resultado esperado:** 5 puntos  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** un movimiento.

### Borde 5:00 exacto

**Condición:** pickedUpAt = t0+5min  
**Resultado esperado:** 3 puntos  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** un movimiento.

### Borde 10:00 exacto

**Condición:** pickedUpAt = t0+10min  
**Resultado esperado:** 3 puntos  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** un movimiento.

### Evento duplicado

**Condición:** mismo pickup procesado dos veces  
**Resultado esperado:** una acreditación  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** saldo correcto.

---

## 8. Estrategia de testing

### Tests de dominio
- Todos los límites temporales exactos.
- Scope organización y no vencimiento.

### Tests de aplicación
- Award/get/spend/refund/movements.

### Tests de integración
- Concurrencia de balance.
- Unique idempotency de PointMovement.

### Seguridad
- Saldo ajeno/cross-org rechazado.

### Casos críticos
- Eventos pickup duplicados.
- Gasto y acreditación simultáneos.
- Ventana replanificada.

---

## 9. BLOCKERS y decisiones abiertas

`Sin BLOCKERS conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- Tramos exactos cubiertos con tests de borde.
- Movimientos idempotentes/auditables.
- Saldo por organización consistente.
- Tests pasan.
- Sin BLOCKERS.
