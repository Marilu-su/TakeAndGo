---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0014 — Recompensas, Canjes y Beneficio 10%

## 1. Contexto de negocio

### Objetivo
Implementar catálogo fijo de recompensas Take&Go, ofertas por buffet, canjes físicos y beneficio de 10%, integrando puntos, stock, capacidad, retiro y sanciones.

### Roles involucrados
- `CUSTOMER`
- `STORE_ADMIN`

### Reglas de negocio relacionadas
`RN-149` a `RN-184`.

### Alcance
- Tipos/costos fijos de recompensa.
- STORE_ADMIN habilita tipos y hasta 2 productos por recompensa física.
- Elegibilidad por saldo/stock.
- Canje físico con horario/capacidad.
- Máximo un canje físico activo por organización.
- Coexistencia/retiro combinado con pedido.
- Reglas específicas café/snack/panadería/bebida ante no retiro.
- Beneficio 10%: 500 pts, uno activo, 30 días, single-use, sin tope, sobre total final, restauración ante cancelación buffet.

### Dependencias
- `TDD-0003` Store/Organization.
- `TDD-0004` productos.
- `TDD-0005` stock/recovery.
- `TDD-0007` ventanas/pago/quote.
- `TDD-0008` capacidad.
- `TDD-0010` pickup.
- `TDD-0011` no-show/strike.
- `TDD-0013` puntos.

---

## 2. Criterios de aceptación

### CA-01 — Rewards fijas

**Dado** configuración de recompensas  
**Cuando** admin consulta tipos/costos  
**Entonces** son Café 250, Snack 300, Panadería 350, Bebida fría 350, 10% 500 y no son editables

**RN relacionadas:** `RN-149` a `RN-151`

### CA-02 — Oferta por buffet

**Dado** STORE_ADMIN  
**Cuando** habilita una recompensa física  
**Entonces** puede elegir hasta 2 productos concretos de su buffet

**RN relacionadas:** `RN-152`, `RN-153`

### CA-03 — Elegibilidad

**Dado** CUSTOMER consulta canje  
**Cuando** se calculan opciones  
**Entonces** solo aparecen rewards costeables y físicas con producto/stock disponible

**RN relacionadas:** `RN-154`, `RN-155`, `RN-156` a `RN-158`

### CA-04 — Canje físico confirmado

**Dado** saldo, stock y horario válidos  
**Cuando** CUSTOMER confirma  
**Entonces** se descuentan puntos y reservan recursos; el canje no genera puntos

**RN relacionadas:** `RN-159` a `RN-165`

### CA-05 — No cancelar canje

**Dado** canje físico confirmado  
**Cuando** CUSTOMER intenta cancelar  
**Entonces** se rechaza

**RN relacionadas:** `RN-166`

### CA-06 — Cancelación buffet de canje

**Dado** causa propia del buffet  
**Cuando** se cancela  
**Entonces** se reintegran todos los puntos

**RN relacionadas:** `RN-167`

### CA-07 — No-show de canje

**Dado** canje físico no retirado  
**Cuando** cierra tolerancia sin aviso previo válido  
**Entonces** pierde puntos y aplica strike; recursos se tratan según tipo

**RN relacionadas:** `RN-168` a `RN-172`

### CA-08 — Beneficio 10% activo

**Dado** CUSTOMER con >=500 puntos y sin beneficio activo  
**Cuando** canjea 10%  
**Entonces** se descuentan 500 puntos y nace beneficio single-use por 30 días

**RN relacionadas:** `RN-173` a `RN-178`

### CA-09 — Aplicar 10%

**Dado** beneficio activo  
**Cuando** CUSTOMER decide aplicarlo a un pedido  
**Entonces** descuenta 10% del precio final incluidos adicionales, sin tope y solo un beneficio por compra

**RN relacionadas:** `RN-179` a `RN-182`

### CA-10 — No consumir por fallo de pago

**Dado** beneficio elegido  
**Cuando** pago falla/expira  
**Entonces** el beneficio sigue activo con vencimiento original

**RN relacionadas:** `RN-183`

### CA-11 — Restaurar por cancelación buffet

**Dado** pedido confirmado que consumió el 10%  
**Cuando** buffet cancela  
**Entonces** beneficio se restaura con vencimiento original

**RN relacionadas:** `RN-184`

---

## 3. Diseño técnico

### Modelo de dominio
- `RewardType` fijo (enum/config de sistema).
- `StoreRewardOffering`
- `StoreRewardProduct`
- `PhysicalRewardRedemption`
- `DiscountBenefit`

**Invariantes principales**
- Costos/tipos no editables por tenants.
- Máximo 2 productos por offering físico.
- Máximo un physical redemption activo por CUSTOMER+Organization.
- Máximo un DiscountBenefit activo por CUSTOMER+Organization.
- Canje físico nunca genera puntos.
- 10% es single-use y vence 30 días después del canje.

### Casos de uso
- `ConfigureStoreRewardOffering`
- `GetEligibleRewards`
- `CreatePhysicalRedemption`
- `CancelPhysicalRedemptionByStore`
- `HandleRedemptionNoShow`
- `CreateTenPercentBenefit`
- `ApplyTenPercentBenefit`
- `RestoreTenPercentBenefit`
- `ExpireDiscountBenefit`

### Puertos requeridos
- `LoyaltyPort`
- `InventoryPort`
- `CatalogPort`
- `CocIAPort`
- `OrderPort`
- `PickupPort`
- `DisciplinePort`
- `StoreRewardRepositoryPort`
- `DiscountBenefitRepositoryPort`
- `Clock`

### Contratos / API
- `GET /api/v1/stores/:storeId/rewards`
- `PUT /api/v1/stores/:storeId/reward-offerings`
- `POST /api/v1/stores/:storeId/reward-redemptions`
- `GET /api/v1/organizations/:orgId/me/benefits`
- `POST /api/v1/organizations/:orgId/me/benefits/ten-percent`

### Persistencia
- StoreRewardOffering + StoreRewardProduct.
- PhysicalRewardRedemption con status, scheduled window y product snapshot.
- DiscountBenefit(status, redeemedAt, expiresAt, usedAt?, originalExpiresAt).

### Eventos y asincronía
- `RewardRedeemed`, `PhysicalRedemptionConfirmed/Cancelled/NoShow/PickedUp`, `DiscountBenefitCreated/Consumed/Restored/Expired`.

### Servicios externos / adaptadores
- No servicio externo adicional; usa puertos de otros módulos.

---

## 4. Seguridad y aislamiento

### RBAC
- STORE_ADMIN configura offerings solo de su Store.
- CUSTOMER consulta/canjea solo con su saldo/organización.

### Tenant scope
- Puntos/beneficios/canje activo son por organización; producto/stock/offer es por Store.

### Datos sensibles y auditoría
- Movimientos de puntos ya auditados por Loyalty; guardar source redemption/benefit.
- Restauraciones/cancelaciones con motivo.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- Crear canje: spend points + reserva de recursos + redemption debe ser todo-o-nada/compensable.
- Crear beneficio: spend 500 + benefit activo atómico.
- Consumir 10% solo al confirmar pago; coordinación idempotente con Order.

### Concurrencia
- Dos canjes simultáneos no pueden gastar el mismo saldo ni crear dos redemptions/benefits activos.

### Idempotencia
- Crear/confirmar/cancelar/restaurar por operationId sin duplicar puntos/stock.

### Reintentos y compensación
- Si falla reserva después de gastar puntos, refund compensatorio.
- Si cancelación buffet restaura benefit, reintento no crea segundo beneficio.

---

## 6. Tiempo y dinero

### Tiempo
- Canjes físicos usan mismas ventanas/horarios que pedido.
- DiscountBenefit expiresAt = redeemedAt + 30 días con Clock.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- 10% se calcula sobre precio final incluido adicionales usando Money seguro.
- No tiene tope máximo.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### Saldo insuficiente

**Condición:** balance < costo  
**Resultado esperado:** reward no elegible/rechazar canje  
**Error de dominio / HTTP:** `INSUFFICIENT_POINTS` / 409  
**Efectos laterales:** sin gasto.

### Segundo canje activo

**Condición:** ya existe physical redemption activo en organización  
**Resultado esperado:** rechazar  
**Error de dominio / HTTP:** `ACTIVE_REDEMPTION_EXISTS` / 409  
**Efectos laterales:** sin gasto/reserva.

### Segundo 10% activo

**Condición:** beneficio activo vigente  
**Resultado esperado:** no mostrar ni crear otro  
**Error de dominio / HTTP:** `ACTIVE_DISCOUNT_BENEFIT_EXISTS` / 409  
**Efectos laterales:** sin gasto.

### Beneficio vence

**Condición:** Clock > expiresAt sin uso  
**Resultado esperado:** marcar expirado, puntos no vuelven  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** no refund.

### Pago falla con 10%

**Condición:** beneficio seleccionado pero Order no confirma  
**Resultado esperado:** beneficio permanece activo  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** no usedAt.

---

## 8. Estrategia de testing

### Tests de dominio
- Eligibility, límites activos, 30 días, 10% sobre total final.
- Tratamiento no-show por tipo de reward.

### Tests de aplicación
- Config offerings, physical redemption, cancel/no-show, create/apply/restore/expire 10%.

### Tests de integración
- Transacciones puntos+stock+redemption.
- Concurrencia de dos canjes/benefits.
- Integración Order para consumo/restauración.

### Seguridad
- STORE_ADMIN cross-store rechazado; CUSTOMER cross-org rechazado.

### Casos críticos
- Dos canjes simultáneos con saldo justo.
- Falla entre spendPoints y reserveStock.
- Pago confirmado y callback duplicado de consumo benefit.
- Cancelación buffet después de usar benefit.

---

## 9. BLOCKERS y decisiones abiertas

`Sin BLOCKERS conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- Rewards/costos fijos correctos.
- Canjes y beneficio 10% cumplen RN.
- Puntos/stock/benefit consistentes e idempotentes.
- Reglas de no-show integradas.
- Tests pasan.
- Sin BLOCKERS.
