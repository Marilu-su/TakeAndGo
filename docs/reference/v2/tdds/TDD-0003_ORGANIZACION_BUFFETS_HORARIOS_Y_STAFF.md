---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0003 — Organización, Buffets, Horarios y Staff

## 1. Contexto de negocio

### Objetivo
Implementar el gobierno multi-organización/multi-buffet: organizaciones, stores, código único, configuración inicial, horarios operativos, anticipación máxima y administración del staff con scopes correctos.

### Roles involucrados
- `STORE_ADMIN`
- `ORGANIZATION_ADMIN`
- `STORE_EMPLOYEE`

### Reglas de negocio relacionadas
`RN-010`, `RN-026` a `RN-028`, `RN-035`, `RN-054`, `RN-055`; además las responsabilidades de roles definidas en el Master.

### Alcance
- Provisionamiento inicial manual de Organization/primer Store/primer ORGANIZATION_ADMIN.
- Crear y dar de baja buffets y asignar/reemplazar STORE_ADMIN.
- Código fijo `AAA999` único globalmente.
- Configuración inicial del buffet.
- Horarios por día y cierre de pedidos digitales/operativo.
- `maxAdvanceDays` por organización, default 7.
- Alta/asignación/desactivación de STORE_EMPLOYEE del buffet.

### Dependencias
- `TDD-0001` para identidades/roles.
- Contratos consumidos por TDD-0002, 0004, 0007, 0008 y 0014.

---

## 2. Criterios de aceptación

### CA-01 — Crear buffet con scope

**Dado** un ORGANIZATION_ADMIN válido  
**Cuando** crea un buffet  
**Entonces** el Store queda dentro de su organización, con código único y requiere configuración mínima antes de operar

**RN relacionadas:** `RN-010`, `RN-027`, `RN-028`

### CA-02 — Un STORE_ADMIN por buffet

**Dado** un Store  
**Cuando** se asigna o reemplaza su STORE_ADMIN  
**Entonces** el administrador resultante queda limitado a ese único buffet

**RN relacionadas:** `RN-026`

### CA-03 — Horarios configurables

**Dado** un STORE_ADMIN de su buffet  
**Cuando** configura apertura, cierre digital y cierre operativo  
**Entonces** los horarios quedan disponibles para validaciones de pedidos/retiro

**RN relacionadas:** `RN-028`, `RN-055`

### CA-04 — Anticipación por organización

**Dado** una organización sin override  
**Cuando** se consulta maxAdvanceDays  
**Entonces** el valor es 7; si ORGANIZATION_ADMIN lo cambia, se usa el configurado

**RN relacionadas:** `RN-054`

### CA-05 — Administrar empleados

**Dado** un STORE_ADMIN  
**Cuando** crea/asigna/desactiva STORE_EMPLOYEE  
**Entonces** solo afecta staff de su propio buffet

**RN relacionadas:** `RN-035`

---

## 3. Diseño técnico

### Modelo de dominio
- `Organization(maxAdvanceDays)`
- `Store(code, organizationId, status)`
- `StoreOperatingHours(day/dateOverride, openAt, digitalOrderCloseAt, closeAt)`
- `StaffScope(userId, role, organizationId?, storeId?)`

**Invariantes principales**
- Store pertenece a una sola Organization.
- Código de Store único globalmente y con formato 3 letras + 3 números.
- STORE_ADMIN administra un único Store.
- STORE_EMPLOYEE opera un único Store.
- Los horarios deben ser internamente coherentes: apertura <= cierre digital <= cierre operativo.

### Casos de uso
- `CreateStore`
- `DeactivateStore`
- `AssignStoreAdmin`
- `ConfigureStore`
- `ConfigureStoreOperatingHours`
- `SetOrganizationMaxAdvanceDays`
- `CreateStoreEmployee`
- `DeactivateStoreEmployee`
- `GetStoreConfiguration`

### Puertos requeridos
- `OrganizationRepositoryPort`
- `StoreRepositoryPort`
- `StoreOperatingHoursRepositoryPort`
- `StaffScopeRepositoryPort`
- `IdentityDirectoryPort`

### Contratos / API
- `POST /api/v1/organizations/:organizationId/stores`
- `PATCH /api/v1/stores/:storeId`
- `PUT /api/v1/stores/:storeId/hours`
- `PUT /api/v1/organizations/:organizationId/settings`
- `POST /api/v1/stores/:storeId/employees`
- `PATCH /api/v1/stores/:storeId/admin`

### Persistencia
- Organization con `maxAdvanceDays` default 7.
- Store con código UNIQUE global.
- StoreOperatingHours con configuración semanal y posibilidad de override por fecha.
- StaffScope con restricciones de rol/scope.

### Eventos y asincronía
- `StoreCreated`, `StoreConfigurationChanged`, `StoreDeactivated` pueden publicarse para consumidores; no deben contener secretos.

### Servicios externos / adaptadores
- No requiere proveedor externo específico; identidad se consulta mediante port.

---

## 4. Seguridad y aislamiento

### RBAC
- ORGANIZATION_ADMIN: crea/baja stores, asigna STORE_ADMIN, configura maxAdvanceDays.
- STORE_ADMIN: configura solo su buffet y administra STORE_EMPLOYEE.
- STORE_EMPLOYEE: no modifica configuración administrativa.

### Tenant scope
- Toda operación de ORGANIZATION_ADMIN valida organizationId.
- Toda operación STORE_ADMIN/EMPLOYEE valida storeId del scope.

### Datos sensibles y auditoría
- Auditar cambios de horarios, admins, empleados y configuración sensible con actor/momento.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- Asignar/reemplazar STORE_ADMIN debe dejar un único scope efectivo.

### Concurrencia
- Generación/asignación de códigos debe soportar colisiones sin duplicar.
- Dos cambios simultáneos de admin no pueden dejar dos administradores activos si el modelo exige uno.

### Idempotencia
- Reintentos de provisión/configuración deben evitar duplicados mediante IDs/constraints.

### Reintentos y compensación
- Eventos derivados pueden reintentarse sin duplicar estado principal.

---

## 6. Tiempo y dinero

### Tiempo
- StoreOperatingHours usa timezone del buffet/organización.
- Overrides por fecha prevalecen sobre patrón semanal.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- No aplica directamente.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### Código duplicado

**Condición:** el código ya pertenece a otro Store  
**Resultado esperado:** rechazar creación/asignación  
**Error de dominio / HTTP:** `STORE_CODE_ALREADY_EXISTS` / 409  
**Efectos laterales:** no crear Store parcial.

### Horario inválido

**Condición:** cierre digital u operativo es incoherente con apertura  
**Resultado esperado:** rechazar configuración  
**Error de dominio / HTTP:** `INVALID_OPERATING_HOURS` / 422  
**Efectos laterales:** conservar configuración anterior.

### Cross-tenant admin

**Condición:** ORGANIZATION_ADMIN intenta modificar otra organización  
**Resultado esperado:** rechazar  
**Error de dominio / HTTP:** 403  
**Efectos laterales:** ninguno.

---

## 8. Estrategia de testing

### Tests de dominio
- Formato/únicidad lógica de store code.
- Coherencia de horarios.
- Scopes de staff.

### Tests de aplicación
- Crear/bajar store, asignar admin, configurar horarios/maxAdvanceDays, staff CRUD.

### Tests de integración
- Constraints de Store.code y StaffScope.
- Consultas de horarios/overrides.

### Seguridad
- Cross-tenant y cross-store rechazados.
- STORE_EMPLOYEE sin permisos administrativos.

### Casos críticos
- Asignación concurrente de admin.
- Código duplicado concurrente.
- Cambio de horarios con pedidos consumidores en paralelo.

---

## 9. BLOCKERS y decisiones abiertas

`Sin BLOCKERS conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- CA implementados.
- Configuración de Organization/Store disponible por contratos.
- RBAC y tenant scope cubiertos.
- Tests relevantes pasan.
- No quedan BLOCKERS abiertos.
