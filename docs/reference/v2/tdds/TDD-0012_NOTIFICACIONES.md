---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0012 — Notificaciones

## 1. Contexto de negocio

### Objetivo
Implementar notificaciones in-app y push para eventos transaccionales obligatorios sin confundirlas con la proactividad de MenIA.

### Roles involucrados
- `CUSTOMER`

### Reglas de negocio relacionadas
`RN-132` a `RN-136`.

### Alcance
- Notificaciones in-app.
- Push.
- Pedido PARA_RETIRAR → pedido listo.
- Replanificación CocIA → nueva ventana.
- No enviar notificación separada solo por inicio de tolerancia.
- Persistencia/estado de entrega mínimo para in-app.

### Dependencias
- `TDD-0007` eventos de Order.
- `TDD-0008` replanificación.
- `TDD-0010` estados de retiro.
- `TDD-0011` puede publicar eventos disciplinarios futuros, no obligatorios en RN actuales.

---

## 2. Criterios de aceptación

### CA-01 — Pedido listo

**Dado** un pedido pasa a PARA_RETIRAR  
**Cuando** se procesa el evento  
**Entonces** se crea notificación in-app y se intenta push al CUSTOMER

**RN relacionadas:** `RN-132`, `RN-133`

### CA-02 — Replanificación

**Dado** CocIA cambia ventana/tolerancia  
**Cuando** se confirma la replanificación  
**Entonces** CUSTOMER recibe notificación con nueva ventana

**RN relacionadas:** `RN-134`

### CA-03 — Sin aviso por tolerancia

**Dado** comienza la tolerancia sin otro cambio  
**Cuando** se procesa el reloj/evento  
**Entonces** no se genera una notificación separada solo por ese motivo

**RN relacionadas:** `RN-135`

### CA-04 — Proactividad permitida

**Dado** un evento transaccional  
**Cuando** debe notificarse  
**Entonces** se envía aunque MenIA no haya iniciado conversación

**RN relacionadas:** `RN-136`

---

## 3. Diseño técnico

### Modelo de dominio
- `Notification(id, customerId, type, payload, createdAt, readAt?)`
- `PushDelivery` opcional para estado técnico de envío.

**Invariantes principales**
- Una notificación transaccional se deriva de un evento real/confirmado.
- No inventar mensajes de estado que backend no confirmó.

### Casos de uso
- `CreateInAppNotification`
- `SendPushNotification`
- `ListCustomerNotifications`
- `MarkNotificationRead`
- `HandleOrderReadyEvent`
- `HandleWindowReplannedEvent`

### Puertos requeridos
- `NotificationRepositoryPort`
- `PushPort`
- `CustomerDevicePort`

### Contratos / API
- `GET /api/v1/me/notifications`
- `POST /api/v1/me/notifications/:id/read`
- `Registro/actualización de push token según adapter elegido.`

### Persistencia
- Notification por customerId y payload estructurado.
- DeduplicationKey/eventId para evitar duplicados.

### Eventos y asincronía
- Consume `OrderPickupWindowActivated`/`OrderReadyForPickup` y `PickupWindowReplanned`.

### Servicios externos / adaptadores
- Proveedor push detrás de `PushPort`.

---

## 4. Seguridad y aislamiento

### RBAC
- CUSTOMER solo lee/marca sus notificaciones.

### Tenant scope
- Notificaciones globales del CUSTOMER pero el payload conserva Store/Organization de origen cuando aplique.

### Datos sensibles y auditoría
- No incluir datos sensibles innecesarios en push visible en pantalla bloqueada.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- La creación in-app puede ser transaccional con consumo idempotente del evento; el push externo es side effect reintentable.

### Concurrencia
- Dos consumidores del mismo evento no crean duplicados.

### Idempotencia
- Deduplicar por eventId + notificationType.

### Reintentos y compensación
- Push fallido puede reintentarse sin crear una nueva notificación in-app.

---

## 6. Tiempo y dinero

### Tiempo
- createdAt/readAt con Clock; no hay regla de expiración funcional definida.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- No aplica.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### Push token inválido

**Condición:** proveedor rechaza token  
**Resultado esperado:** in-app permanece; marcar/desactivar token según adapter  
**Error de dominio / HTTP:** Error técnico controlado  
**Efectos laterales:** no duplicar notificación.

### Evento duplicado

**Condición:** mismo eventId recibido dos veces  
**Resultado esperado:** una sola notificación  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** deduplicado.

---

## 8. Estrategia de testing

### Tests de dominio
- Tipos/payload mínimo de Notification.

### Tests de aplicación
- Order ready, replan, read/list, ausencia de tolerance-only notification.

### Tests de integración
- Consumer idempotente y Push fake.

### Seguridad
- CUSTOMER no accede notificaciones ajenas.

### Casos críticos
- Push falla después de persistir in-app.
- Evento duplicado.

---

## 9. BLOCKERS y decisiones abiertas

**Decisión abierta:** proveedor push se define por ADR. No bloquea el contrato.

`Sin BLOCKERS funcionales conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- Eventos obligatorios generan in-app/push.
- No se notifica solo inicio de tolerancia.
- Consumer idempotente.
- Tests pasan.
- Sin BLOCKERS funcionales.
