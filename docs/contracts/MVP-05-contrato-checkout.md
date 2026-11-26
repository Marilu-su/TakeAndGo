# MVP-05 — Contrato de checkout

**Responsables:** Flores Lautaro (API de pago) y Romero Olmo Macarena (checkout web)  
**Estado:** Acordado  
**Proveedor:** Mercado Pago, Checkout Pro en modo sandbox (credenciales de prueba)

## Flujo

```
Cliente            Web (Maca)                    API (Lauti)                       Mercado Pago
   │  Confirma pedido   │                              │                                  │
   │───────────────────►│ POST /orders                 │                                  │
   │                    │─────────────────────────────►│ Pedido RESERVADO (5 minutos)     │
   │  "Pagar"           │                              │                                  │
   │───────────────────►│ POST /orders/:id/payment     │                                  │
   │                    │─────────────────────────────►│ Crea el pago y la preferencia ──►│
   │                    │◄─────────── checkoutUrl ─────│                                  │
   │  Redirección a checkoutUrl ──────────────────────────────────────────────────────────►│
   │                    │                              │◄──── Webhook (aviso de pago) ────│
   │                    │                              │ Consulta el pago real al proveedor
   │◄──── Vuelve a /pedidos/:id?pago=retorno ───────────────────────────────────────────────│
   │                    │ GET /orders/:id/payment      │                                  │
   │                    │─────────────────────────────►│ Si sigue pendiente, consulta     │
   │                    │◄──── estado del pedido ──────│ al proveedor y aplica el resultado
```

La web **nunca** decide si el pago fue aprobado: los parámetros que agrega Mercado Pago al volver no se usan. El estado siempre se pide a la API, que lo verifica con el proveedor.

## 1. Iniciar el pago

`POST /api/v1/orders/:orderId/payment` — CUSTOMER dueño del pedido. Sin cuerpo.

Crea el pago por el total del pedido (`totalCents`) con vencimiento igual a la reserva (`reservedUntil`). Es **idempotente**: si el pedido ya tiene un pago pendiente, devuelve el mismo `checkoutUrl`.

**Respuesta `201`:**

```json
{
  "paymentId": "6b1d…",
  "orderId": "a3c9…",
  "status": "PENDING",
  "amountCents": 230000,
  "expiresAt": "2026-11-27T15:05:00.000Z",
  "checkoutUrl": "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=…"
}
```

## 2. Consultar el estado

`GET /api/v1/orders/:orderId/payment` — CUSTOMER dueño del pedido.

Si el pago sigue pendiente, la API consulta a Mercado Pago y, si ya hay resultado, lo aplica antes de responder. La web llama a este endpoint al volver del checkout y puede repetirlo cada 3 segundos mientras `checkoutState` sea `PENDING`.

**Respuesta `200`:**

```json
{
  "paymentId": "6b1d…",
  "orderId": "a3c9…",
  "paymentStatus": "APPROVED",
  "orderStatus": "CONFIRMED",
  "checkoutState": "CONFIRMED",
  "amountCents": 230000,
  "expiresAt": "2026-11-27T15:05:00.000Z"
}
```

**`checkoutState`** es el campo que debe usar la pantalla:

| `checkoutState` | Cuándo | Qué mostrar |
| --- | --- | --- |
| `PENDING` | Pago pendiente y reserva vigente | "Esperando confirmación del pago" + cuenta regresiva hasta `expiresAt` |
| `CONFIRMED` | Pago aprobado, pedido confirmado | "Pago aprobado. Tu pedido está confirmado" |
| `REJECTED` | Pago rechazado, pedido cancelado y stock liberado | "El pago fue rechazado" |
| `EXPIRED` | Venció la reserva sin pago aprobado | "Se venció el tiempo para pagar" |

## 3. Aviso del proveedor (webhook)

`POST /api/v1/payments/webhooks/mercadopago` — público, solo para Mercado Pago.

La API valida la firma del aviso, consulta el pago real a Mercado Pago y aplica el resultado **una sola vez**: los avisos repetidos no vuelven a confirmar el pedido ni a liberar stock. Siempre responde `200` a un aviso válido, aunque ya se haya procesado.

## 4. Errores

Mismo formato que el resto de la API: `{ "error": "mensaje", "code": "CÓDIGO" }`.

| HTTP | `code` | Caso |
| --- | --- | --- |
| `401` | `UNAUTHENTICATED` | Sin sesión |
| `404` | `ORDER_NOT_FOUND` | El pedido no existe o no es del cliente |
| `404` | `PAYMENT_NOT_FOUND` | Consulta de estado sin pago iniciado |
| `409` | `ORDER_NOT_PAYABLE` | El pedido no está RESERVADO (ya pagado, cancelado o vencido) |
| `409` | `RESERVATION_EXPIRED` | Venció la reserva antes de iniciar el pago |
| `502` | `PAYMENT_PROVIDER_ERROR` | Mercado Pago no respondió; se puede reintentar |

## 5. Reglas acordadas

- La reserva dura **5 minutos** (RN-070). Si vence sin pago aprobado, el pedido pasa a `EXPIRED` y se libera el stock automáticamente.
- Una aprobación que llega después del vencimiento **no confirma** el pedido: el pago se reembolsa en el sandbox.
- El cliente no puede cancelar un pedido con pago aprobado (RN-076).

## 6. Pruebas sin el proveedor

Para que la web avance sin depender de la integración real, la API acepta `PAYMENT_PROVIDER=fake` en desarrollo: `checkoutUrl` apunta a `/pedidos/:id?pago=retorno` y el pago se aprueba al consultarlo. Nunca se usa en producción.

## 7. Configuración del backend

| Variable | Uso |
| --- | --- |
| `PAYMENT_PROVIDER` | `mercadopago` o `fake` |
| `MERCADOPAGO_ACCESS_TOKEN` | Access token de prueba (secreto) |
| `MERCADOPAGO_WEBHOOK_SECRET` | Clave para validar la firma de los avisos (secreto) |
| `PUBLIC_API_URL` | URL pública de la API, para el webhook |
| `FRONTEND_URL` | URL de la web, para la vuelta del checkout |
