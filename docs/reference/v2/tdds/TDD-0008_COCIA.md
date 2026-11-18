---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0008 — CocIA

## 1. Contexto de negocio

### Objetivo
Implementar CocIA separando estimación predictiva de tiempo y planificación determinística de cocina, con fallback obligatorio, capacidad, compromisos futuros y replanificación ante retrasos.

### Roles involucrados
- `STORE_ADMIN` para parámetros
- `STORE_EMPLOYEE` como consumidor de cola
- `CUSTOMER` como receptor de ventana/replanificación

### Reglas de negocio relacionadas
`RN-092` a `RN-106`.

### Alcance
- Estimación de preparación.
- Fallback determinístico con tiempo base, cantidad, adicionales y carga.
- Carga activa por estados definidos.
- Cálculo de ventana factible y recommendedStartAt.
- No romper compromisos existentes.
- Pedidos futuros.
- Replanificación y nueva ventana/tolerancia.

### Dependencias
- `TDD-0003` parámetros/horarios.
- `TDD-0004` tiempo base/adicionales.
- `TDD-0007` pedidos/ventanas.
- `TDD-0009` estados operativos/carga.
- `TDD-0012` notifica replanificación.

---

## 2. Criterios de aceptación

### CA-01 — Fallback determinístico

**Dado** datos de producto/cantidad/adicionales/carga  
**Cuando** se estima sin predictor IA  
**Entonces** se aplica tiempo base + extras + penalización configurada

**RN relacionadas:** `RN-096` a `RN-100`, `RN-104`

### CA-02 — Carga activa correcta

**Dado** operaciones en distintos estados  
**Cuando** se calcula carga  
**Entonces** solo CONFIRMADO, EN_PREPARACIÓN y venta presencial en preparación cuentan

**RN relacionadas:** `RN-094`, `RN-095`

### CA-03 — Planificar sin romper compromisos

**Dado** pedidos ya confirmados  
**Cuando** se evalúa un nuevo pedido  
**Entonces** solo se ofrecen ventanas que no hagan inviables compromisos aceptados

**RN relacionadas:** `RN-102`, `RN-103`, `RN-106`

### CA-04 — No usar personal

**Dado** información de staffing  
**Cuando** se estima en MVP  
**Entonces** la cantidad de personal no se usa como variable

**RN relacionadas:** `RN-101`

### CA-05 — Replanificar retraso

**Dado** un pedido con retraso detectado  
**Cuando** CocIA replanifica  
**Entonces** se actualizan ventana y tolerancia y se emite evento de notificación

**RN relacionadas:** `RN-105`

---

## 3. Diseño técnico

### Modelo de dominio
- `PreparationEstimate`
- `KitchenCommitment`
- `PickupWindowProposal`
- `SchedulePlan`
- Configuración de penalización/carga.

**Invariantes principales**
- Predictor y scheduler son capas separadas.
- Scheduler debe funcionar sin predictor.
- No prometer una ventana que rompa un compromiso previo.
- La salida predictiva se valida/sanitiza antes de usarla.

### Casos de uso
- `EstimatePreparationTime`
- `EstimateFallbackTime`
- `GetActiveKitchenLoad`
- `FindAvailablePickupWindow`
- `ScheduleOperation`
- `ReplanOperation`

### Puertos requeridos
- `PreparationPredictorPort`
- `CatalogPreparationDataPort`
- `KitchenLoadPort`
- `OrderCommitmentPort`
- `StoreSchedulePort`
- `Clock`
- `EventBusPort`

### Contratos / API
- `Preferentemente contrato interno `CocIAPort`; endpoints administrativos solo para configuración/diagnóstico si se requieren.`

### Persistencia
- `KitchenTicket`/schedule data puede almacenar estimatedPreparationTime, recommendedStartAt y versión de planificación.
- Persistir la ventana prometida en Order (TDD-0007), no duplicar autoridad.

### Eventos y asincronía
- `OperationScheduled`, `PickupWindowReplanned`, `PredictorFallbackActivated`.

### Servicios externos / adaptadores
- Predictor IA detrás de `PreparationPredictorPort`; puede ser servicio gestionado/modelo propio según ADR.

---

## 4. Seguridad y aislamiento

### RBAC
- STORE_ADMIN configura parámetros solo de su buffet.
- STORE_EMPLOYEE consume cola; no modifica parámetros.

### Tenant scope
- Carga y compromisos siempre calculados por Store.

### Datos sensibles y auditoría
- Registrar si la estimación provino de predictor o fallback y parámetros/versiones necesarias para diagnóstico.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- Actualizar planificación y ventana prometida debe coordinarse con Order para no exponer estados inconsistentes.

### Concurrencia
- Nuevas órdenes simultáneas compiten por capacidad; find+commit debe evitar aceptar dos ventanas que juntas violen capacidad.

### Idempotencia
- Replanificar el mismo evento/retry no crea múltiples ventanas contradictorias.

### Reintentos y compensación
- Si predictor falla/timeout, usar fallback; no bloquear cocina.

---

## 6. Tiempo y dinero

### Tiempo
- Todos los cálculos usan Clock/timezone Store.
- Extras default: adicional +30s, unidad adicional +3min, carga 0-5:+0, 6-10:+3, 11-15:+6, >15:+10 salvo configuración.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- No aplica.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### Predictor no disponible

**Condición:** timeout/error  
**Resultado esperado:** usar fallback determinístico  
**Error de dominio / HTTP:** No propagar fallo como indisponibilidad total  
**Efectos laterales:** registrar fallback.

### Salida predictiva inválida

**Condición:** tiempo negativo/extremo/no parseable  
**Resultado esperado:** descartar y fallback  
**Error de dominio / HTTP:** `INVALID_PREDICTION` interno  
**Efectos laterales:** sin ventana corrupta.

### Capacidad cambia concurrentemente

**Condición:** otra orden confirma antes del commit  
**Resultado esperado:** recalcular/rechazar propuesta obsoleta  
**Error de dominio / HTTP:** `WINDOW_CAPACITY_CHANGED`  
**Efectos laterales:** no romper compromisos.

---

## 8. Estrategia de testing

### Tests de dominio
- Fallback exacto por cantidad/adicionales/carga.
- Clasificación de carga activa.
- Scheduler con compromisos.

### Tests de aplicación
- Predictor vs fallback, find window, schedule, replan.

### Tests de integración
- Concurrency de commits de capacidad.
- Contrato con Order/Kitchen.

### Seguridad
- Configuración solo STORE_ADMIN del Store.

### Casos críticos
- Predictor caído.
- Dos nuevos pedidos simultáneos.
- Pedidos futuros en misma franja.
- Replanificación preserva tolerancia desplazada.

---

## 9. BLOCKERS y decisiones abiertas

**Decisión abierta:** tecnología/modelo predictivo se define por ADR/experimento. El fallback permite avanzar y operar sin ella.

`Sin BLOCKERS funcionales conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- Fallback implementado y testeado.
- Planificación no rompe compromisos.
- Predictor desacoplado.
- Replanificación emite evento.
- Concurrencia/capacidad verificada.
- No quedan BLOCKERS funcionales.
