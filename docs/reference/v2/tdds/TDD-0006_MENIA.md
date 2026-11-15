---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0006 — MenIA

## 1. Contexto de negocio

### Objetivo
Implementar MenIA como interfaz conversacional de texto/audio que consulta catálogo y contexto, genera recomendaciones válidas y propone acciones estructuradas sin convertirse en autoridad de negocio.

### Roles involucrados
- `CUSTOMER`

### Reglas de negocio relacionadas
`RN-036` a `RN-053`; integraciones relacionadas `RN-156` a `RN-158`, `RN-181`.

### Alcance
- Entrada de texto y audio→texto/intención.
- Catálogo conversacional y cards.
- Recomendaciones filtradas y rankeadas, máximo 4 salvo catálogo completo.
- Restricciones de dieta/exclusión como filtros duros y preferencias como ranking.
- Solicitudes por horario, alternativas y estado “MenIA está durmiendo”.
- Planificación semanal no transaccional.
- Confirmaciones estructuradas para acciones persistentes/transaccionales.
- Tools/casos de uso para pedidos, perfil, puntos y recompensas.

### Dependencias
- `TDD-0002` perfil/preferencias/contexto.
- `TDD-0004` catálogo.
- `TDD-0005` disponibilidad.
- `TDD-0007` quote/confirm order.
- `TDD-0008` ventanas factibles.
- `TDD-0013` saldo.
- `TDD-0014` rewards/benefits.

---

## 2. Criterios de aceptación

### CA-01 — Catálogo completo

**Dado** un CUSTOMER dentro de un buffet  
**Cuando** pide “mostrar catálogo”  
**Entonces** MenIA muestra todo lo actualmente disponible agrupado por categorías sin límite de 4

**RN relacionadas:** `RN-040`, `RN-041`, `RN-042`, `RN-047`

### CA-02 — Recomendaciones válidas

**Dado** una solicitud genérica con restricciones  
**Cuando** MenIA recomienda  
**Entonces** muestra hasta 4 opciones compatibles, sin rellenar con opciones inválidas

**RN relacionadas:** `RN-045`, `RN-046`

### CA-03 — Filtros duros

**Dado** exclusiones o dieta incompatible  
**Cuando** MenIA arma alternativas  
**Entonces** no recomienda productos incompatibles

**RN relacionadas:** `RN-038`, `RN-043`, `RN-044` y perfil TDD-0002

### CA-04 — Horario solicitado

**Dado** el CUSTOMER pide una hora concreta  
**Cuando** se evalúan opciones  
**Entonces** solo se ofrecen opciones factibles; si no, se ofrece primer horario/otros horarios/opciones que sí lleguen

**RN relacionadas:** `RN-048`, `RN-049`, `RN-050`

### CA-05 — No ejecutar por texto libre

**Dado** MenIA propone una operación persistente  
**Cuando** el usuario responde libremente sin confirmación estructurada  
**Entonces** la operación no se ejecuta

**RN relacionadas:** `RN-038`, `RN-039`

### CA-06 — Fuera de horario digital

**Dado** el buffet no acepta nuevos pedidos digitales  
**Cuando** CUSTOMER intenta pedir por MenIA  
**Entonces** se bloquea la creación y se muestra “MenIA está durmiendo” manteniendo navegación

**RN relacionadas:** `RN-052`

### CA-07 — Audio

**Dado** audio del CUSTOMER  
**Cuando** se procesa correctamente  
**Entonces** se convierte a texto/intención antes de invocar reglas de negocio

**RN relacionadas:** `RN-037`

---

## 3. Diseño técnico

### Modelo de dominio
- MenIA no posee entidades transaccionales propias; usa `ConversationContext` efímero y respuestas/cards estructuradas.
- `RecommendationCandidate` como DTO de aplicación calculado desde puertos.
- No persistir historial del chat.

**Invariantes principales**
- El LLM nunca escribe DB ni decide permisos/stock/horarios por sí mismo.
- Toda tool transaccional vuelve a validar en backend.
- Máximo 4 solo para recomendaciones genéricas, no catálogo explícito.
- MenIA no inicia conversación/recomendaciones proactivamente.

### Casos de uso
- `HandleMenIAInput`
- `TranscribeAudio`
- `GetConversationalCatalog`
- `GetRecommendations`
- `QuoteOrderThroughMenIA`
- `ConfirmStructuredAction`
- `BuildWeeklyPlan`
- `GetLoyaltyBalanceThroughMenIA`
- `GetEligibleRewardsThroughMenIA`

### Puertos requeridos
- `LLMPort`
- `SpeechToTextPort`
- `CustomerProfilePort`
- `CatalogPort`
- `InventoryPort`
- `OrderPort`
- `CocIAPort`
- `LoyaltyPort`
- `RewardsPort`

### Contratos / API
- `POST /api/v1/stores/:storeId/menia/messages`
- `POST /api/v1/stores/:storeId/menia/audio`
- `POST /api/v1/stores/:storeId/menia/actions/:actionId/confirm`

### Persistencia
- No chat history persistente.
- Puede persistirse únicamente la información funcional resultante mediante los módulos dueños.
- Opcional: telemetría técnica anonimizada según ADR, sin convertirse en historial funcional.

### Eventos y asincronía
- No requiere eventos de negocio propios; acciones confirmadas producen eventos en módulos dueños.

### Servicios externos / adaptadores
- LLM gestionado detrás de `LLMPort`.
- Speech-to-text detrás de `SpeechToTextPort`.

---

## 4. Seguridad y aislamiento

### RBAC
- Solo CUSTOMER autenticado en contexto de un buffet asociado usa tools de cliente.
- MenIA no eleva privilegios.

### Tenant scope
- Cada consulta/acción usa storeId validado contra membresía; tools revalidan tenant en backend.

### Datos sensibles y auditoría
- No incluir secretos ni datos innecesarios en prompts/logs.
- Acciones persistentes quedan auditadas por módulos dueños, no por texto del chat.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- MenIA no coordina transacciones DB directamente; invoca casos de uso atómicos de módulos.

### Concurrencia
- Una recomendación puede quedar obsoleta; al confirmar se revalida stock/horarios/beneficios.

### Idempotencia
- Confirmaciones estructuradas deben usar actionId/nonce para evitar doble ejecución por doble click/retry.

### Reintentos y compensación
- Fallback de error conversacional no puede “asumir” éxito de una tool fallida.

---

## 6. Tiempo y dinero

### Tiempo
- Validar horarios mediante Store/CocIA, no con reloj del cliente.
- Plan semanal respeta ventana futura al convertir luego una propuesta en pedido.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- Precios siempre vienen de catálogo/quote backend; LLM no calcula importes autoritativos.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### LLM propone producto agotado

**Condición:** respuesta generada quedó obsoleta  
**Resultado esperado:** backend rechaza/actualiza propuesta e informa qué cambió  
**Error de dominio / HTTP:** `AVAILABILITY_CHANGED`  
**Efectos laterales:** sin reserva/pago inválido.

### STT falla

**Condición:** audio no puede transcribirse  
**Resultado esperado:** pedir texto/reintento  
**Error de dominio / HTTP:** `TRANSCRIPTION_FAILED`  
**Efectos laterales:** ninguna acción.

### LLM/servicio caído

**Condición:** adapter no disponible  
**Resultado esperado:** error controlado sin saltear validaciones  
**Error de dominio / HTTP:** 503  
**Efectos laterales:** ninguna acción transaccional.

### Confirmación duplicada

**Condición:** misma actionId confirmada dos veces  
**Resultado esperado:** ejecución idempotente  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** una sola operación.

---

## 8. Estrategia de testing

### Tests de dominio
- Filtrado/ranking determinístico alrededor de candidatos válidos.
- Límite de 4 vs catálogo completo.

### Tests de aplicación
- Tools mockeadas, confirmación estructurada, horarios, dieta/exclusiones, MenIA dormida.

### Tests de integración
- Adapters LLM/STT con fakes.
- Contrato de actionId y módulos.

### Seguridad
- Prompt injection no permite bypass de RBAC/tenant.
- LLM no recibe acceso directo a DB.

### Casos críticos
- LLM devuelve datos inválidos/hallucinated IDs.
- Disponibilidad cambia entre recomendación y confirmación.
- Tool timeout después de acción potencialmente ejecutada.

---

## 9. BLOCKERS y decisiones abiertas

**Decisiones abiertas:** proveedor/modelo LLM y STT se definirán por ADR. No bloquean los contratos.

`Sin BLOCKERS funcionales conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- CA implementados.
- RN MenIA cubiertas.
- Ninguna regla crítica vive solo en prompts.
- Confirmaciones son estructuradas e idempotentes.
- Tests de herramientas/fallback pasan.
- Sin BLOCKERS funcionales.
