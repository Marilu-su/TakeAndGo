# MVP-10 · Checkout y estado en la web

La [issue #106](https://github.com/Marilu-su/TakeAndGo/issues/106) corresponde a T15. La web inicia el pago, abre el enlace de checkout y consulta el resultado al volver. El alcance local cubre respuestas simuladas. La verificación con Mercado Pago sandbox corresponde a MVP-18.

MVP-10 reutiliza el [contrato de checkout MVP-05](MVP-05-contrato-checkout.md). Parte del pedido `RESERVED` de [MVP-09](MVP-09-ventanas-retiro.md), que ya tiene stock reservado, importe, vencimiento y los datos de retiro. La rama de trabajo parte del commit `9dd5a9e9fd1e345ceb1402ef09545257e3eb4abe`. Para revisar el diff aislado, usar como base inicial del PR la rama de MVP-09.

## Inicio y retorno

El detalle habilita **Pagar con Mercado Pago** para una reserva vigente. Vuelve a comprobar `reservedUntil` al pulsar y envía un POST autenticado sin cuerpo a `/api/v1/orders/:orderId/payment`. El backend determina el monto y el vencimiento y reutiliza el enlace de un pago pendiente ya iniciado.

La web abre en la misma pestaña el `checkoutUrl` original. Admite enlaces HTTPS y retornos del proveedor fake relativos o HTTP del mismo origen. Rechaza credenciales incrustadas, esquemas inseguros, barras invertidas y destinos relativos al protocolo. El POST exitoso indica que se inició el checkout. El resultado se obtiene de la consulta de estado.

La página del pedido reconoce exclusivamente `pago=retorno` para iniciar la consulta automática. Los datos de estado que pueda incluir el proveedor en la URL se ignoran. Al reabrir el detalle sin ese indicador, el cliente puede pulsar **Consultar estado del pago**. El GET autenticado a `/api/v1/orders/:orderId/payment` puede aplicar un resultado de negocio del proveedor. Por eso abrir una reserva normal no dispara ese GET automáticamente.

## Consulta y presentación

La primera consulta es inmediata. Después de cada respuesta `PENDING`, se agenda la siguiente tres segundos después de que termine la anterior. El ciclo aplaza solicitudes mientras la pestaña está oculta o la acción compartida está ocupada. Los temporizadores se limpian al desmontar el detalle o cambiar de pedido. Las respuestas de ciclos invalidados se descartan. Un resultado terminal detiene la consulta automática y refresca el detalle.

El mismo bloqueo síncrono coordina iniciar el pago, consultar al proveedor, confirmar o ejecutar una cancelación y solicitar credenciales de retiro. El bloqueo se libera entre consultas. Si la cancelación devuelve conflicto, se refresca el pedido y se reconsulta el pago cuando la verificación ya había sido iniciada.

La cuenta regresiva se calcula a partir de una fecha absoluta. Usa `reservedUntil` antes de recibir información del pago y `expiresAt` para un pago pendiente. A cero se bloquea el inicio y se espera la confirmación de la API. Si no hay una verificación de pago iniciada, se refresca el detalle una sola vez para ese vencimiento.

| `checkoutState` | Presentación y acciones |
| --- | --- |
| `PENDING` | Esperando confirmación, con plazo y aviso de consulta automática o pausada. Se puede verificar de nuevo tras un fallo recuperable, y cancelar si el pedido sigue siendo cancelable. |
| `CONFIRMED` | Pago aprobado. El pago y la cancelación quedan bloqueados, incluso si el detalle aún dice `RESERVED`. |
| `REJECTED` | Pago rechazado y enlace para volver al catálogo. |
| `EXPIRED` | Plazo vencido y enlace para volver al catálogo. Si la orden todavía figura `RESERVED`, se indica que su estado está actualizándose. |
| `CANCELLED` | Pedido cancelado. Si nunca hubo un pago, el detalle puede mostrar la cancelación informada por el endpoint del pedido. |

`checkoutState` muestra el resultado del pago. El detalle conserva el estado operativo real, como `PREPARING` o `READY_FOR_PICKUP`, y los productos, adicionales, importe, ventana, tolerancia y credenciales QR/manual según el estado operativo. El intervalo y la tolerancia se muestran como datos originales ante rechazo, cancelación o vencimiento.

Los mensajes dinámicos usan `role="status"` y los errores `role="alert"`. El reloj usa `role="timer"` y `aria-live="off"`. El aviso de llegada a cero se anuncia por separado.

## Errores y reintentos

- Los fallos de sesión, permisos o pedido inexistente detienen la consulta. Los mensajes omiten detalles internos.
- `PAYMENT_NOT_FOUND` indica que aún no hay un pago y provoca un refresco del detalle. Una reserva que sigue vigente puede iniciar el pago.
- `ORDER_NOT_PAYABLE` y `RESERVATION_EXPIRED` bloquean el inicio y refrescan el detalle.
- Un fallo técnico de proveedor, red o timeout conserva la última respuesta válida y permite una recuperación explícita. Un fallo ambiguo del POST se informa como inicio sin verificar.
- La auditoría F corrigió un caso en que el primer GET fallido al volver o al consultar manualmente dejaba disponible **Pagar** con un resultado incierto. Una vez iniciada esa verificación, la opción se recupera para una reserva vigente cuando la API confirma `PAYMENT_NOT_FOUND`.

## Matriz de aceptación de #106

| Requisito | Implementación | Evidencia automatizada | Evidencia simulada | Interactivo y MVP-18 |
| --- | --- | --- | --- | --- |
| Iniciar el pago desde la web | Botón, bloqueo compartido y POST autenticado sin cuerpo. | Elegibilidad, cliente HTTP y contrato de rutas. | Token y respuesta `201` simulados. | Pendiente el doble clic y la coordinación real con cancelación. MVP-18 verifica concurrencia con el proveedor. |
| Abrir el checkout | Navegación en la misma pestaña con el enlace original validado. | Conservación de la URL, enlaces fake y rechazo de destinos inseguros. | Respuesta con enlace HTTPS o relativo de prueba. | Pendiente la navegación en navegador y el enlace real del sandbox en MVP-18. |
| Consultar al volver | Indicador exacto y GET autenticado. Acción manual al reabrir. | Retorno, parámetros manipulados y cliente GET. | Respuesta de API simulada independiente de la query del proveedor. | Pendiente el retorno en navegador y la consulta real al proveedor en MVP-18. |
| `PENDING` | Estado, reloj, consulta periódica y recuperación manual. | Controlador con reloj simulado y renderizado estático del panel real. | Demora, error de red y conservación del estado. | Pendientes el ciclo React en navegador y los anuncios de lector de pantalla. |
| `CONFIRMED` | Termina la consulta y reconcilia el detalle, conservando el estado operativo. | Secuencia desde `PENDING` y acciones bloqueadas con detalle obsoleto. | Confirmación devuelta por la API. | Pendiente el recorrido completo. La aprobación real se verifica en MVP-18. |
| `REJECTED` | Termina la consulta y ofrece volver al catálogo. | Secuencia terminal y acciones limitadas. | Rechazo devuelto por la API. | Pendiente el enlace en navegador. El rechazo real se valida en MVP-18. |
| `EXPIRED` | Termina la consulta, bloquea pagar y distingue el estado operativo pendiente de actualización. | Secuencia terminal, reloj a cero y detalle todavía reservado. | Vencimiento devuelto por la API. | Pendiente el recorrido en navegador y la observación del proveedor al vencer en MVP-18. |
| `CANCELLED` · MVP-05 | Estado de pago cancelado o cancelación del pedido cuando no se inició pago. | Secuencia terminal y pruebas con y sin pago. | Cancelación devuelta por la API de pago o de pedidos. | Pendiente el diálogo real y su coordinación con la consulta. |

## Reproducir la validación

Resultado de F: **102 pruebas aprobadas**, 46 web y 56 de pagos, sin fallos ni omisiones. Pasaron ambos typechecks, Next typegen, ESLint y el build de producción con 15 de 15 páginas generadas. Las suites de pagos seleccionadas utilizan dobles y no requieren PostgreSQL ni Mercado Pago.

Desde `apps/web`:

```powershell
npm.cmd test
npm.cmd exec -- next typegen
npm.cmd run typecheck
.\node_modules\.bin\eslint.cmd -- src/components/order-view.tsx src/components/order-checkout.tsx src/lib/checkout.ts src/lib/checkout-polling.ts test/checkout.test.mjs 'src/app/(customer)/pedidos/[id]/page.tsx'
npm.cmd run build
```

Desde `apps/api`, en una sesión de prueba sin `DATABASE_URL`:

```powershell
npm.cmd run typecheck
.\node_modules\.bin\tsx.cmd --test test/modules/payment/startCheckout.test.ts test/modules/payment/paymentStatus.test.ts test/modules/payment/paymentRoutes.test.ts test/modules/payment/syncPayment.test.ts test/modules/payment/expireReservationsJob.test.ts test/modules/payment/mercadoPagoPaymentPort.test.ts
```

Si `tsx` devuelve `uv_os_get_passwd: ENOMEM` en Windows, usar la precarga temporal en memoria empleada en F. Mantener la selección explícita de seis archivos. El script general de backend incluye integraciones con base de datos.

## Pendientes de integración

- Recorrido en navegador con ciclo completo de React, cambio de pedido, navegación en la misma pestaña, doble clic, diálogo de cancelación, consultas concurrentes y lector de pantalla. Las pruebas de lógica y el renderizado estático cubren solo parte de ese recorrido.
- Sandbox, regreso real, conciliación y concurrencia de inicio ante el proveedor en MVP-18.
- Hallazgo medio preexistente: la obtención de `/api/auth/token` no tiene el límite de tiempo de `apiRequest` y puede mantener ocupado el detalle. El cambio en el cliente de sesión compartido queda para acordar con el equipo.
- Regresión conjunta y revisión de conflictos con `develop` cuando se integre MVP-09. Revisar entonces la base del PR dependiente.
