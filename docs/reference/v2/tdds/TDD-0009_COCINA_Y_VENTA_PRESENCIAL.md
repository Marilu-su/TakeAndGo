---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0009 — Cocina y Venta Presencial

## 1. Contexto de negocio

### Objetivo
Implementar la operación diaria de cocina y la venta presencial, integradas a la planificación CocIA y al inventario.

### Roles involucrados
- `STORE_EMPLOYEE`

### Reglas de negocio relacionadas
`RN-107` a `RN-112`.

### Alcance
- Cola operativa ordenada por CocIA.
- Iniciar y finalizar preparación.
- Venta presencial sin CUSTOMER.
- Descuento inmediato de stock en venta presencial.
- KitchenTicket para ventas que requieren preparación.
- Restricciones de permisos del empleado.

### Dependencias
- `TDD-0004` catálogo/precios.
- `TDD-0005` stock.
- `TDD-0007` pedidos.
- `TDD-0008` cola/planificación.

---

## 2. Criterios de aceptación

### CA-01 — Cola CocIA

**Dado** operaciones activas  
**Cuando** STORE_EMPLOYEE abre cocina  
**Entonces** ve cola ordenada según planificación CocIA con datos necesarios

**RN relacionadas:** `RN-107`

### CA-02 — Inicio/final de preparación

**Dado** una tarea válida  
**Cuando** empleado inicia/finaliza  
**Entonces** se actualiza el estado operativo correspondiente

**RN relacionadas:** `RN-108`

### CA-03 — Venta presencial inmediata

**Dado** productos disponibles  
**Cuando** se registra venta presencial  
**Entonces** no requiere CUSTOMER y el stock comercial se descuenta al registrar

**RN relacionadas:** `RN-109`, `RN-110`

### CA-04 — Venta presencial con preparación

**Dado** una venta que requiere cocina  
**Cuando** se registra  
**Entonces** genera KitchenTicket y cuenta como carga activa hasta finalizar

**RN relacionadas:** `RN-111`

### CA-05 — Permisos limitados

**Dado** STORE_EMPLOYEE  
**Cuando** intenta cambiar precios/catálogo/CocIA/config  
**Entonces** se rechaza

**RN relacionadas:** `RN-112`

---

## 3. Diseño técnico

### Modelo de dominio
- `KitchenTicket`
- `PresentialSale`
- Estados operativos de preparación.

**Invariantes principales**
- KitchenTicket pertenece a un Store y a una operación fuente.
- Una venta presencial no requiere customerId.
- Registrar una venta no puede dejar stock negativo.

### Casos de uso
- `GetKitchenQueue`
- `StartPreparation`
- `FinishPreparation`
- `RegisterPresentialSale`

### Puertos requeridos
- `CocIAPort`
- `InventoryPort`
- `CatalogPort`
- `OrderPort`
- `KitchenTicketRepositoryPort`
- `PresentialSaleRepositoryPort`

### Contratos / API
- `GET /api/v1/stores/:storeId/kitchen/queue`
- `POST /api/v1/kitchen/tickets/:id/start`
- `POST /api/v1/kitchen/tickets/:id/finish`
- `POST /api/v1/stores/:storeId/presential-sales`

### Persistencia
- KitchenTicket con sourceType/sourceId, estimated/recommendedStartAt, status.
- PresentialSale + items/snapshots y total.

### Eventos y asincronía
- `PreparationStarted`, `PreparationFinished`, `PresentialSaleRegistered`.

### Servicios externos / adaptadores
- No proveedor externo obligatorio para venta presencial en MVP según Master.

---

## 4. Seguridad y aislamiento

### RBAC
- Solo STORE_EMPLOYEE/STORE_ADMIN autorizado del Store accede a operación; empleado no modifica configuración.

### Tenant scope
- Todos los tickets/ventas scoped al Store del staff.

### Datos sensibles y auditoría
- Registrar actor y timestamps de inicio/finalización/venta.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- Venta presencial + descuento de stock + ticket si aplica debe ser consistente.

### Concurrencia
- Venta presencial compite con reservas digitales por mismo stock; Inventory arbitra atómicamente.

### Idempotencia
- Registrar venta debe soportar protección contra doble submit si la UI reintenta (clientRequestId recomendado).
- Start/finish repetidos no duplican transición.

### Reintentos y compensación
- Si falla creación de ticket después de descontar stock, rollback o compensar toda la venta.

---

## 6. Tiempo y dinero

### Tiempo
- Timestamps operativos con Clock del Store.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- Total de venta desde snapshots de catálogo con Money seguro.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### Stock agotado durante venta

**Condición:** otra operación consumió la última unidad  
**Resultado esperado:** rechazar venta/recalcular selección  
**Error de dominio / HTTP:** `INSUFFICIENT_STOCK` / 409  
**Efectos laterales:** no registrar venta parcial.

### Finalizar ticket no iniciado

**Condición:** transición inválida  
**Resultado esperado:** rechazar  
**Error de dominio / HTTP:** `INVALID_KITCHEN_STATE` / 409  
**Efectos laterales:** sin cambio.

---

## 8. Estrategia de testing

### Tests de dominio
- Estados KitchenTicket.
- PresentialSale sin CUSTOMER.

### Tests de aplicación
- Queue/start/finish/register sale.

### Tests de integración
- Competencia stock digital/presencial.
- Transacción venta+stock+ticket.

### Seguridad
- Cross-store y modificación administrativa rechazados.

### Casos críticos
- Doble click venta.
- Dos ventas por última unidad.
- Falla entre stock y ticket.

---

## 9. BLOCKERS y decisiones abiertas

`Sin BLOCKERS conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- Cola y transiciones operativas funcionando.
- Venta presencial consistente con stock.
- RBAC correcto.
- Tests pasan.
- Sin BLOCKERS.
