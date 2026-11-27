# MVP-09 · Pedido para retirar hoy

La [issue #104](https://github.com/Marilu-su/TakeAndGo/issues/104) cubre catálogo, disponibilidad, elección de una ventana del día, creación de un pedido `RESERVED` y rechazo por stock insuficiente. El catálogo se consulta con `GET /api/v1/stores/:storeId/catalog` mediante la sesión del cliente y su membresía.

`GET /api/v1/stores/:storeId/pickup-windows`

Enviar un token Bearer de un cliente con membresía en el buffet. `storeId` es el ID del buffet. La consulta usa el día actual en la zona horaria de su configuración y no requiere parámetros de consulta ni cuerpo.

## Respuesta

HTTP `200 OK` con `Cache-Control: no-store`. Cada fecha se serializa en ISO 8601 en UTC. Las ventanas se ordenan por inicio.

```json
{
  "requiresPickupWindow": true,
  "windows": [
    {
      "promisedFrom": "2026-11-28T00:49:00.000Z",
      "promisedTo": "2026-11-28T00:54:00.000Z",
      "toleranceUntil": "2026-11-28T00:59:00.000Z"
    }
  ]
}
```

El cuerpo muestra la última entrada de una consulta el 27 de noviembre a las 20:59:59 en Buenos Aires. La ventana empieza a las 21:49 del mismo día local.

`requiresPickupWindow` indica si el buffet tiene el horario de demo habilitado. Con `true`, `windows` puede estar vacío fuera del horario digital o si ya no quedan opciones válidas. Con `false`, el buffet continúa con el flujo de pedido sin ventana y `windows` está vacío.

## Errores

| HTTP | Código | Caso |
| --- | --- | --- |
| `401` | `UNAUTHENTICATED` | Falta autenticación válida. |
| `403` | `FORBIDDEN` | El perfil no es cliente o no tiene acceso al buffet solicitado. Un ID sin membresía se trata igual aunque el buffet no exista. |

Los errores de autenticación y acceso siguen el formato `{"error":"mensaje","code":"CÓDIGO"}`.

## Alcance de la disponibilidad

Buffet Sistemas (`SIS001`) usa la zona `America/Argentina/Buenos_Aires`. La API resuelve el buffet por código y habilita el horario para su ID cuando está `ACTIVE`.

Se ofrecen ventanas para el día local, todos los días, desde la apertura a las 08:00 inclusive hasta el cierre digital a las 21:30 exclusivo. El inicio debe estar al menos 20 minutos después de la validación, contemplando cinco minutos para pagar y quince para preparar. Puede comenzar en cualquier minuto. La ventana dura cinco minutos y tiene otros cinco de tolerancia. La tolerancia debe finalizar estrictamente antes del cierre operativo de las 22:00.

**BLOCKER de capacidad de cocina.** Las ventanas acreditan factibilidad temporal. La validación de carga y compromisos de cocina sigue pendiente.

## Crear un pedido con ventana

`POST /api/v1/orders` conserva la autenticación y la membresía del flujo de pedidos. Enviá el inicio elegido con fecha, hora, segundos y zona explícita (`Z` o desplazamiento `±HH:mm`). El servidor calcula los demás campos.

```json
{
  "storeId": "id-del-buffet",
  "items": [{"productId": "id-del-producto", "quantity": 1, "additionIds": []}],
  "promisedFrom": "2026-11-28T00:30:00.000Z"
}
```

HTTP `201 Created`. Extracto de la respuesta para una reserva creada el 27 de noviembre a las 20:59 en Buenos Aires:

```json
{
  "id": "id-del-pedido",
  "storeId": "id-del-buffet",
  "status": "RESERVED",
  "totalCents": 230000,
  "reservedUntil": "2026-11-28T00:04:00.000Z",
  "scheduledForDate": "2026-11-27T00:00:00.000Z",
  "promisedFrom": "2026-11-28T00:30:00.000Z",
  "promisedTo": "2026-11-28T00:35:00.000Z",
  "toleranceUntil": "2026-11-28T00:40:00.000Z"
}
```

`scheduledForDate` representa la fecha de calendario del buffet codificada a medianoche UTC. Los tres campos de la ventana representan instantes reales. El detalle y el historial del cliente devuelven estos campos. La reserva para pagar dura cinco minutos.

| HTTP | Código | Caso |
| --- | --- | --- |
| `400` | `INVALID_REQUEST` | Falta `promisedFrom` en un pedido del buffet de demo habilitado, o el valor enviado tiene formato incorrecto o fecha inválida. |
| `409` | `PICKUP_WINDOW_UNAVAILABLE` | La hora elegida ya no cumple las reglas de hoy al reservar o el buffet carece de horario habilitado. Volvé a consultar las opciones. |
| `409` | `INSUFFICIENT_STOCK` | La ventana es válida y el stock disponible no alcanza. |

La API revalida la hora elegida después de adquirir el bloqueo del buffet, usando el horario cargado previamente y la misma lectura del reloj con la que calcula `reservedUntil`. Una ventana desactualizada se rechaza antes de escribir. El pedido y la reserva de stock se confirman en una única transacción.

Los pedidos nuevos del buffet de demo habilitado requieren `promisedFrom`. Los demás buffets pueden seguir omitiéndolo. Si se envía el campo, se valida siempre. Los pedidos históricos pueden carecer de los campos de retiro.

## Flujo web

El carrito consulta los horarios con la sesión del cliente cada vez que se abre el resumen. Si la selección es obligatoria, muestra los intervalos en hora de Buenos Aires y habilita la confirmación cuando el cliente elige una ventana vigente. Muestra la tolerancia para la opción elegida. Durante la recarga conserva los ítems y la selección. Si la opción desaparece, limpia la selección y avisa. Si la consulta falla, el cliente puede reintentar. Una lista vacía para el buffet de demo deja la confirmación deshabilitada.

Al confirmar, el carrito envía el `promisedFrom` original de la API. Ante `PICKUP_WINDOW_UNAVAILABLE`, limpia la selección y vuelve a consultar las opciones, conservando los ítems. El detalle del pedido muestra por separado el plazo para pagar, el intervalo de retiro y la tolerancia cuando el pedido tiene esos datos.

## Compatibilidad con checkout

El [contrato MVP-05](MVP-05-contrato-checkout.md) sigue vigente. El pedido devuelve `id`, `status: RESERVED`, `totalCents` y `reservedUntil` para el checkout. El POST de pedidos reserva stock. El inicio del pago conserva su endpoint separado. La integración del checkout y del estado de pago en la web corresponde a MVP-10.

## Matriz de aceptación de #104

| Criterio real | Estado e implementación | Evidencia automatizada | Evidencia de integración | Verificación pendiente |
| --- | --- | --- | --- | --- |
| Verificar catálogo y disponibilidad | Implementado. El catálogo requiere acceso al buffet y aplica la disponibilidad de stock. | `storeCatalogRoutes.test.ts`, `stockCatalogAvailability.test.ts`. | Catálogo real con autorización por buffet y escenario A con producto visible de stock finito. | Navegador con autenticación real. En público, MVP-02 y confirmación de SIS001. |
| Elegir una ventana válida del día | Implementado y verificado localmente para factibilidad temporal. La web exige selección en el buffet de demo y la API revalida la opción. | `listPickupWindowsUseCase.test.ts`, `pickupWindowRoutes.test.ts`, `pickup-windows.test.mjs`. | A y B consultaron ventanas del día. C rechazó una vencida sin escrituras. | Navegador y verificación pública. La capacidad de cocina queda abierta si el equipo la exige para considerar válida la ventana. |
| Reservar el pedido en estado `RESERVED` | Implementado y verificado localmente. Se persisten los cuatro campos de retiro y se reserva stock por cinco minutos. | `createOrderPickupWindow.test.ts`, `reservationExpiration.test.ts`. | B verificó el POST, la lectura del detalle, el saldo y el movimiento vinculado. La suite de concurrencia verificó rollback. | Recorrido web autenticado y verificación pública. |
| Rechazar una cantidad sin stock | Implementado y verificado localmente con stock finito. | `orderStock.test.ts`, `createOrderPickupWindow.test.ts`. | A verificó `409 INSUFFICIENT_STOCK` sin crear pedido ni alterar saldos o movimientos. | Repetir el rechazo desde el recorrido web autenticado y el entorno público. |

Los resultados, el procedimiento reproducible y las limitaciones de entorno están en el [informe de integración E.2](MVP-09-integracion-E2.md).
