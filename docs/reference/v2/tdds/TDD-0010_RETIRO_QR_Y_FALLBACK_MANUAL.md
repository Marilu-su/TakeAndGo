---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0010 — Retiro, QR y Fallback Manual

## 1. Contexto de negocio

### Objetivo
Implementar la entrega segura de operaciones mediante QR single-use y retiro manual auditado, provocando la transición a RETIRADO y el consumo definitivo de stock.

### Roles involucrados
- `CUSTOMER`
- `STORE_EMPLOYEE`

### Reglas de negocio relacionadas
`RN-113` a `RN-119`; integración con canjes físicos del TDD-0014.

### Alcance
- Generar/habilitar QR solo en PARA_RETIRAR.
- Token seguro single-use.
- Validar operación, Store, estado, vigencia y uso previo.
- Retiro manual por código corto cuando QR falla.
- pickedUpAt y consumo de stock.
- Auditoría del retiro manual.

### Dependencias
- `TDD-0005` consume stock.
- `TDD-0007` estado Order.
- `TDD-0009` staff operativo.
- `TDD-0013` consume pickedUpAt para puntos.
- `TDD-0014` reutiliza retiro para redemptions.

---

## 2. Criterios de aceptación

### CA-01 — QR solo PARA_RETIRAR

**Dado** una operación en otro estado  
**Cuando** CUSTOMER solicita QR  
**Entonces** no se entrega token habilitado

**RN relacionadas:** `RN-113`

### CA-02 — Validación QR

**Dado** token válido single-use  
**Cuando** se escanea en el buffet correcto  
**Entonces** backend valida vigencia/estado/uso y marca RETIRADO con pickedUpAt

**RN relacionadas:** `RN-114` a `RN-116`

### CA-03 — Token reutilizado

**Dado** QR ya consumido  
**Cuando** se vuelve a escanear  
**Entonces** se rechaza sin segundo retiro/consumo

**RN relacionadas:** `RN-114`, `RN-115`

### CA-04 — Retiro manual

**Dado** QR ilegible  
**Cuando** STORE_EMPLOYEE busca por código corto y confirma  
**Entonces** se registra RETIRADO y se audita actor/momento/operación

**RN relacionadas:** `RN-117`, `RN-118`

### CA-05 — No entregar por nombre

**Dado** solo un nombre de CUSTOMER  
**Cuando** se intenta entregar  
**Entonces** el sistema no permite validar retiro únicamente con ese dato

**RN relacionadas:** `RN-119`

---

## 3. Diseño técnico

### Modelo de dominio
- `PickupToken`
- `ShortPickupCode`
- `PickupValidationResult`

**Invariantes principales**
- Token criptográficamente no predecible y single-use.
- Token ligado a operationId + storeId + vigencia.
- pickedUpAt se registra una sola vez.

### Casos de uso
- `IssuePickupToken`
- `ValidatePickupToken`
- `ConfirmManualPickup`
- `GetPickupOperationByShortCode`

### Puertos requeridos
- `PickupTokenRepositoryPort`
- `OrderPickupPort`
- `InventoryPort`
- `RewardPickupPort`
- `Clock`
- `AuditPort`

### Contratos / API
- `GET /api/v1/operations/:id/pickup-token`
- `POST /api/v1/stores/:storeId/pickup/scan`
- `GET /api/v1/stores/:storeId/pickup/by-code/:code`
- `POST /api/v1/stores/:storeId/pickup/manual-confirm`

### Persistencia
- PickupToken hash/metadata, no token secreto reutilizable en claro si no es necesario.
- usedAt, expiresAt, operationId, storeId.
- pickedUpAt pertenece a operación dueña.

### Eventos y asincronía
- `OperationPickedUp` con operationType/id, storeId, pickedUpAt.

### Servicios externos / adaptadores
- Lector/cámara es cliente UI; backend no depende de hardware específico.

---

## 4. Seguridad y aislamiento

### RBAC
- CUSTOMER obtiene QR solo de sus operaciones.
- Solo staff del Store valida/retira.

### Tenant scope
- Token y código corto deben validar Store exacto.

### Datos sensibles y auditoría
- Retiro manual: actor, momento, operación.
- Escaneos fallidos pueden registrarse sin exponer token completo.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- Marcar RETIRADO + consumir stock + consumir token deben ser atómicos o idempotentemente coordinados.

### Concurrencia
- Dos escaneos simultáneos del mismo QR: solo uno puede consumir.

### Idempotencia
- Reintento de confirmación de un retiro ya completado no consume stock ni puntos dos veces; responde estado existente.

### Reintentos y compensación
- Evento OperationPickedUp puede reintentarse con operationId como clave.

---

## 6. Tiempo y dinero

### Tiempo
- Vigencia y pickedUpAt con Clock.
- El cálculo de puntos ocurre en TDD-0013 usando pickedUpAt y ventana vigente.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- No aplica.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### QR de otro buffet

**Condición:** token válido pero escaneado en Store distinto  
**Resultado esperado:** rechazar  
**Error de dominio / HTTP:** `PICKUP_STORE_MISMATCH` / 403  
**Efectos laterales:** token no consumido.

### QR vencido/inválido

**Condición:** token fuera de vigencia o corrupto  
**Resultado esperado:** rechazar  
**Error de dominio / HTTP:** `INVALID_PICKUP_TOKEN` / 410/422  
**Efectos laterales:** ninguno.

### Doble escaneo

**Condición:** mismo token concurrente  
**Resultado esperado:** un retiro efectivo  
**Error de dominio / HTTP:** segundo recibe `ALREADY_PICKED_UP`  
**Efectos laterales:** un solo consumo.

---

## 8. Estrategia de testing

### Tests de dominio
- Token single-use, vigencia, scope.

### Tests de aplicación
- QR válido/inválido, manual, código corto.

### Tests de integración
- Race de doble scan.
- Transacción token+Order+Inventory.

### Seguridad
- Token ajeno/cross-store; retiro por nombre no permitido.

### Casos críticos
- Escaneo simultáneo.
- Falla entre marcar retirado y consumir stock.

---

## 9. BLOCKERS y decisiones abiertas

`Sin BLOCKERS conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- QR single-use seguro.
- Manual auditado.
- Retiro/stock consistentes e idempotentes.
- Tests pasan.
- Sin BLOCKERS.
