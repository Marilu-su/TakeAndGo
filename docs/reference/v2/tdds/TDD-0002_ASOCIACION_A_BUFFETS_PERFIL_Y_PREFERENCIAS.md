---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0002 — Asociación a Buffets, Perfil y Preferencias

## 1. Contexto de negocio

### Objetivo
Implementar la relación global del CUSTOMER con uno o más buffets y administrar su contexto, perfil, preferencias, exclusiones, restricciones alimentarias, rutina semanal e historial global.

### Roles involucrados
- `CUSTOMER`

### Reglas de negocio relacionadas
`RN-005` a `RN-025`.

### Alcance
- Resolver códigos de buffet y crear asociaciones inmediatas.
- Permitir múltiples asociaciones, incluso entre organizaciones.
- Home global y selección/cambio de buffet activo.
- Perfil, preferencias, exclusiones, dieta y rutina semanal globales.
- Historial global con buffet/organización.
- Confirmación estructurada para cambios persistentes propuestos por MenIA.

### Dependencias
- `TDD-0001` para identidad CUSTOMER.
- `TDD-0003` como dueño de Store/Organization y códigos de buffet.
- Contratos de historial de `TDD-0007`, `TDD-0013` y `TDD-0014` para consolidar operaciones.

---

## 2. Criterios de aceptación

### CA-01 — Asociación inmediata por código

**Dado** un CUSTOMER autenticado y un código válido  
**Cuando** solicita asociarse  
**Entonces** se crea la membresía al buffet sin aprobación del STORE_ADMIN

**RN relacionadas:** `RN-005`, `RN-006`, `RN-007`, `RN-009`

### CA-02 — Múltiples buffets

**Dado** un CUSTOMER con una asociación existente  
**Cuando** agrega otro buffet incluso de otra organización  
**Entonces** conserva ambas asociaciones dentro de la misma cuenta global

**RN relacionadas:** `RN-008`, `RN-009`

### CA-03 — Home global

**Dado** un CUSTOMER autenticado  
**Cuando** entra a la aplicación  
**Entonces** ve sus buffets asociados y accesos a Perfil, Preferencias e Historial antes de entrar a MenIA

**RN relacionadas:** `RN-011`, `RN-012`

### CA-04 — Contexto activo explícito

**Dado** un CUSTOMER con varios buffets  
**Cuando** selecciona o cambia de buffet  
**Entonces** las operaciones dependientes de buffet usan ese contexto y la UI lo muestra claramente

**RN relacionadas:** `RN-013`, `RN-014`

### CA-05 — Filtros duros de dieta/exclusión

**Dado** restricciones o exclusiones persistidas  
**Cuando** otro módulo consulta el perfil  
**Entonces** recibe información suficiente para tratarlas como filtros duros

**RN relacionadas:** `RN-017`, `RN-018`

### CA-06 — Preferencias y rutina

**Dado** un CUSTOMER con preferencias y rutina  
**Cuando** las modifica explícitamente  
**Entonces** se persisten globalmente sin convertir la rutina en una prohibición de compra

**RN relacionadas:** `RN-016`, `RN-019`, `RN-022`, `RN-023`, `RN-024`

### CA-07 — Confirmación de cambios desde MenIA

**Dado** que MenIA propone persistir un cambio de perfil/rutina  
**Cuando** el usuario no confirmó mediante componente estructurado  
**Entonces** el cambio no se persiste

**RN relacionadas:** `RN-025`

---

## 3. Diseño técnico

### Modelo de dominio
- `CustomerStoreMembership` para asociación CUSTOMER-Store.
- `UserPreference`, `DietaryRestriction`, `WeeklyAvailability` y exclusiones globales.
- `CustomerContext`/selección de store como concepto de aplicación, no como autoridad de tenant.
- Read model de historial global compuesto desde operaciones.

**Invariantes principales**
- Un código de buffet se resuelve de forma no ambigua.
- No duplicar la misma membresía CUSTOMER-Store.
- Preferencias/dieta/rutina son globales al CUSTOMER.
- El contexto activo nunca sustituye validaciones backend de tenant.
- Filtros de presupuesto son contextuales y no se persisten como preferencia permanente.

### Casos de uso
- `AssociateCustomerToStore`
- `ListCustomerStores`
- `SelectStoreContext`
- `GetCustomerProfile`
- `UpdateCustomerPreferences`
- `UpdateDietaryRestrictions`
- `UpdateWeeklyRoutine`
- `GetGlobalHistory`

### Puertos requeridos
- `CustomerStoreMembershipRepositoryPort`
- `StoreDirectoryPort`
- `CustomerProfileRepositoryPort`
- `OrderHistoryPort`
- `LoyaltyHistoryPort`
- `RewardHistoryPort`

### Contratos / API
- `POST /api/v1/me/stores/associations`
- `GET /api/v1/me/stores`
- `GET /api/v1/me/profile`
- `PATCH /api/v1/me/profile`
- `PUT /api/v1/me/preferences`
- `PUT /api/v1/me/dietary-restrictions`
- `PUT /api/v1/me/weekly-routine`
- `GET /api/v1/me/history`

### Persistencia
- `CustomerStoreMembership(customerId, storeId, createdAt)` UNIQUE(customerId, storeId).
- Preferencias/exclusiones/restricciones/rutina ligadas a customerId, no a storeId.
- No persistir historial del chat de MenIA; solo resultados funcionales/transaccionales.

### Eventos y asincronía
- Opcionalmente `CustomerAssociatedToStore` para integraciones futuras; no obligatorio para cumplir el flujo.
- Cambios de perfil pueden ser síncronos.

### Servicios externos / adaptadores
- No requiere proveedor externo específico.

---

## 4. Seguridad y aislamiento

### RBAC
- Solo el CUSTOMER dueño puede editar su perfil/asociaciones.
- MenIA actúa mediante casos de uso del CUSTOMER autenticado, no con permisos propios.

### Tenant scope
- El CUSTOMER puede pertenecer a varios tenants; cada operación dependiente de buffet valida la membresía y el store activo.
- Nunca confiar únicamente en un storeId proveniente del cliente.

### Datos sensibles y auditoría
- Mantener timestamps de asociaciones y cambios relevantes.
- No registrar contenido de chat como historial persistente.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- Crear una membresía debe ser atómico y no duplicable.
- Actualizaciones de conjuntos de restricciones/preferencias deben dejar un estado consistente.

### Concurrencia
- Dos asociaciones simultáneas al mismo buffet no crean duplicados.

### Idempotencia
- Repetir la misma asociación puede responder éxito existente sin crear una segunda fila.

### Reintentos y compensación
- Fallos de read models de historial no deben corromper perfil/membresías.

---

## 6. Tiempo y dinero

### Tiempo
- La rutina semanal requiere representación consistente de días/horarios según timezone funcional cuando corresponda.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- Filtros de presupuesto son input contextual de recomendación y no se persisten aquí.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### Código inexistente

**Condición:** el código no resuelve ningún Store activo  
**Resultado esperado:** rechazar asociación  
**Error de dominio / HTTP:** `INVALID_STORE_CODE` / 422  
**Efectos laterales:** ninguna membresía.

### Asociación duplicada

**Condición:** la membresía ya existe  
**Resultado esperado:** no duplicar  
**Error de dominio / HTTP:** 200/409 según contrato final  
**Efectos laterales:** mantener una sola membresía.

### Acceso a perfil ajeno

**Condición:** un usuario intenta operar sobre otro customerId  
**Resultado esperado:** rechazar  
**Error de dominio / HTTP:** 403  
**Efectos laterales:** ninguno.

### Cambio persistente desde MenIA sin confirmación

**Condición:** falta confirmación estructurada  
**Resultado esperado:** no persistir  
**Error de dominio / HTTP:** `CONFIRMATION_REQUIRED`  
**Efectos laterales:** ninguno.

---

## 8. Estrategia de testing

### Tests de dominio
- Preferencia vs exclusión/restricción.
- Rutina no impide pedidos fuera de ella.
- Presupuesto no se persiste.

### Tests de aplicación
- Asociación válida/duplicada/inválida.
- CRUD de perfil/restricciones/rutina.
- Home global e historial compuesto.

### Tests de integración
- UNIQUE de membresía.
- Integración con StoreDirectoryPort e history ports.

### Seguridad
- CUSTOMER solo edita su propia cuenta.
- Validación de membresía al seleccionar contexto.

### Casos críticos
- Customer con buffets de dos organizaciones.
- Cambio concurrente de preferencias.
- Historial parcial por dependencia temporalmente caída.

---

## 9. BLOCKERS y decisiones abiertas

`Sin BLOCKERS conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- CA implementados.
- `RN-005` a `RN-025` cubiertas en lo correspondiente a este TDD.
- Membresías, perfil y contexto validados en backend.
- Tests relevantes pasan.
- No se persiste chat MenIA.
- No quedan BLOCKERS abiertos.
