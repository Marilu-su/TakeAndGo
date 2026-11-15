---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0011 — No Retiro, Recuperación y Sanciones

## 1. Contexto de negocio

### Objetivo
Implementar no-retiro, aviso previo, disciplina por organización, rehabilitación y recuperación/desperdicio de productos no retirados.

### Roles involucrados
- `CUSTOMER`
- `ORGANIZATION_ADMIN`
- Módulos operativos/Inventory

### Reglas de negocio relacionadas
`RN-120` a `RN-131`; relacionadas `RN-085` a `RN-089`, `RN-168`, `RN-170` a `RN-172`.

### Alcance
- Transición a NO_RETIRADO al finalizar tolerancia.
- Aviso previo antes del inicio de ventana, sin reembolso y sin strike.
- Strikes/warnings/bloqueos por organización.
- Rehabilitación y bloqueo permanente a 2 warnings.
- Modo solo lectura para bloqueados.
- Disparar recuperación/desperdicio según producto.

### Dependencias
- `TDD-0003` Organization/roles/horarios.
- `TDD-0005` recovered units/return stock.
- `TDD-0007` pedidos y ventana.
- `TDD-0010` confirma retiro.
- `TDD-0014` no-show de canjes.

---

## 2. Criterios de aceptación

### CA-01 — No retiro automático

**Dado** operación PARA_RETIRAR no retirada  
**Cuando** finaliza tolerancia  
**Entonces** pasa a NO_RETIRADO

**RN relacionadas:** `RN-120`

### CA-02 — Aviso previo evita strike

**Dado** CUSTOMER avisa antes del inicio de ventana  
**Cuando** finalmente no retira  
**Entonces** no recibe strike y no recibe reembolso; aviso queda timestamped

**RN relacionadas:** `RN-121`, `RN-122`

### CA-03 — Aviso tardío no evita strike

**Dado** aviso después del inicio  
**Cuando** no retira  
**Entonces** se aplica strike

**RN relacionadas:** `RN-123`

### CA-04 — Bloqueo a 3 strikes

**Dado** disciplina de organización llega a 3 strikes  
**Cuando** se procesa el no-show  
**Entonces** CUSTOMER queda bloqueado para transacciones de esa organización, no de otras

**RN relacionadas:** `RN-124` a `RN-126`

### CA-05 — Rehabilitación

**Dado** bloqueo rehabilitable  
**Cuando** ORGANIZATION_ADMIN rehabilita  
**Entonces** strikes=0 y warnings+1; a 2 warnings el bloqueo es permanente

**RN relacionadas:** `RN-127` a `RN-129`

### CA-06 — Bloqueado solo lectura

**Dado** CUSTOMER bloqueado  
**Cuando** usa esa organización  
**Entonces** puede ver cuenta/historial/puntos/rewards pero no operar transaccionalmente

**RN relacionadas:** `RN-130`

### CA-07 — Recuperación no elimina strike

**Dado** strike generado por no-show  
**Cuando** producto se recupera/revende  
**Entonces** el strike permanece

**RN relacionadas:** `RN-131`

---

## 3. Diseño técnico

### Modelo de dominio
- `OrganizationDiscipline(customerId, organizationId, strikes, warnings, status)`
- `NoShowNotice` o `noShowNoticeAt` en operación.
- Política de recuperación delegada a Inventory según tipo/configuración.

**Invariantes principales**
- Disciplina es por organización.
- Aviso válido solo si timestamp < promisedFrom vigente.
- Bloqueo permanente no se rehabilita por flujo normal si Master lo define permanente.
- Recuperación/reventa no altera disciplina ya aplicada.

### Casos de uso
- `NotifyWillNotPickup`
- `CloseAsNoShow`
- `ApplyOrganizationStrike`
- `RehabilitateCustomer`
- `GetDisciplineStatus`
- `RecoverNoShowResources`
- `DiscardExpiredRecoveredUnits`

### Puertos requeridos
- `DisciplineRepositoryPort`
- `OrderNoShowPort`
- `RewardNoShowPort`
- `InventoryPort`
- `OrganizationScopePort`
- `Clock`
- `EventBusPort`

### Contratos / API
- `POST /api/v1/operations/:id/no-show-notice`
- `GET /api/v1/organizations/:orgId/discipline`
- `POST /api/v1/organizations/:orgId/customers/:customerId/rehabilitate`

### Persistencia
- OrganizationDiscipline UNIQUE(customerId, organizationId).
- noShowNoticeAt auditable.
- Status ACTIVE/BLOCKED/PERMANENT_BLOCKED o equivalente.

### Eventos y asincronía
- `OperationNoShow`, `CustomerBlocked`, `CustomerRehabilitated`, `RecoveredResourceRequested`.

### Servicios externos / adaptadores
- No servicio externo obligatorio.

---

## 4. Seguridad y aislamiento

### RBAC
- CUSTOMER solo avisa sobre su operación.
- ORGANIZATION_ADMIN solo rehabilita dentro de su organización.

### Tenant scope
- Disciplina y bloqueo scoped a organizationId; nunca global.

### Datos sensibles y auditoría
- Registrar noShowNoticeAt, strikes/warnings, actor de rehabilitación y timestamps.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- Cerrar NO_RETIRADO + aplicar disciplina + disparar recuperación debe evitar duplicar strikes en reintentos.

### Concurrencia
- Dos jobs/requests no pueden aplicar doble strike al mismo no-show.
- Rehabilitación y nuevo strike concurrentes requieren locking/versionado.

### Idempotencia
- operationId como clave para aplicar no-show una sola vez.
- Rehabilitación request repetida no suma warnings múltiples.

### Reintentos y compensación
- Recovery de Inventory puede reintentarse por operationId/resourceId.

---

## 6. Tiempo y dinero

### Tiempo
- Clock para límite exacto del aviso y fin de tolerancia.
- Timezone de ventana ya resuelta por Order.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- Aviso previo no produce reembolso.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### Aviso en el instante de inicio

**Condición:** noShowNoticeAt >= promisedFrom  
**Resultado esperado:** no cuenta como aviso previo  
**Error de dominio / HTTP:** `NO_SHOW_NOTICE_TOO_LATE` o registro tardío  
**Efectos laterales:** si no retira, strike.

### No-show procesado dos veces

**Condición:** job/event duplicado  
**Resultado esperado:** un solo strike  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** una sola recuperación.

### Cross-org rehab

**Condición:** admin intenta rehabilitar otra organización  
**Resultado esperado:** rechazar  
**Error de dominio / HTTP:** 403  
**Efectos laterales:** ninguno.

### Segundo warning

**Condición:** rehabilitación lleva warnings a 2  
**Resultado esperado:** status permanente según regla  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** bloqueo permanente en esa organización.

---

## 8. Estrategia de testing

### Tests de dominio
- Política strikes/warnings.
- Validez temporal del aviso.
- Scope organizacional.

### Tests de aplicación
- Notify/no-show/rehab/read-only/recovery trigger.

### Tests de integración
- Idempotencia de job no-show.
- Race strike/rehab.

### Seguridad
- Cross-org y operación ajena rechazados.

### Casos críticos
- Borde exacto promisedFrom.
- Duplicación de evento.
- Recuperación falla después de aplicar strike: reintentar sin duplicar disciplina.

---

## 9. BLOCKERS y decisiones abiertas

`Sin BLOCKERS conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- No-show/aviso/sanciones cumplen Master.
- Idempotencia evita doble strike.
- Bloqueos son por organización.
- Recovery integrada por port.
- Tests pasan.
- Sin BLOCKERS.
