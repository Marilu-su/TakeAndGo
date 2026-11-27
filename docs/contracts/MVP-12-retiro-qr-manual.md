# MVP-12 · Retiro por QR y código manual

T19 verifica dos pedidos distintos, uno por QR y otro por código manual, con aislamiento entre buffets y un solo consumo de stock. [Issue #109](https://github.com/Marilu-su/TakeAndGo/issues/109) · [TDD-0010](../reference/v2/tdds/TDD-0010_RETIRO_QR_Y_FALLBACK_MANUAL.md)

## Contrato HTTP

Las rutas bajo `/api/v1` usan los casos de uso y adaptadores Prisma existentes de `modules/pickup`. La emisión requiere sesión del cliente titular. La búsqueda y confirmación requieren staff autorizado del buffet.

| Método y ruta | Solicitud | Éxito |
| --- | --- | --- |
| POST `/orders/:orderId/pickup/qr` | Sin cuerpo | `201`, `token` y `expiresAt` |
| POST `/orders/:orderId/pickup/manual` | Sin cuerpo | `201`, `orderId`, `storeId`, `orderNumber` y `code` |
| POST `/stores/:storeId/pickup/by-code` | `{ code }` | `200`, `orderId`, `storeId`, `orderNumber` y `status: READY_FOR_PICKUP` |
| POST `/stores/:storeId/pickup/orders/:orderId/confirm` | `{ credential: { type: "QR", token } }` o `{ credential: { type: "MANUAL", code } }` | `200`, resultado de confirmación |

El cuerpo de error usa `{ error, code }`. Se devuelve `400` para entrada inválida, `401` sin sesión, `403` sin permiso, `404` para pedido no encontrado o no disponible, `409 PICKUP_CONFLICT` para estado o escritura incompatible y `422 INVALID_PICKUP_CREDENTIAL` para una credencial inválida o vencida.

`ConfirmPickupResult` contiene `orderId` y `storeId` como cadenas, `status: "COMPLETED"`, `pickedUpAt` como fecha en el dominio y cadena ISO 8601 en JSON, y `alreadyPickedUp: boolean`.

- La primera entrega devuelve `200` y `alreadyPickedUp: false`. La web muestra «Retiro confirmado.».
- La repetición con la credencial exacta de la entrega anterior devuelve `200`, `alreadyPickedUp: true` y la fecha original. La web muestra «Pedido ya retirado. No entregar nuevamente.» como alerta. La auditoría, el token y el inventario conservan sus valores.
- El adaptador verifica el pedido, buffet, método y credencial antes de devolver el resultado existente. Los actores no autorizados y las credenciales inválidas siguen recibiendo un error. El formulario solicita comprobar el estado del pedido si falta el indicador booleano.

## Emisión, entrega y concurrencia

La emisión exige `READY_FOR_PICKUP`. El QR usa 32 bytes aleatorios y vigencia de cinco minutos. Su SHA-256 queda ligado al pedido y al buffet. El bloqueo del pedido durante la emisión serializa solicitudes concurrentes e invalida el QR vigente anterior. El código manual tiene 12 caracteres Base64URL y también se guarda como SHA-256. La búsqueda manual se limita a pedidos listos del buffet y devuelve `404` una vez completados.

`PrismaConfirmPickupAdapter.confirm` comprueba vigencia y uso previo del QR al confirmar una entrega nueva. En una transacción consume el token cuando corresponde, cambia el pedido a `COMPLETED`, registra `pickedUpAt`, `pickedUpByUserId` y `pickupMethod`, decrementa el reservado de productos y adicionales y crea sus movimientos `ORDER_FULFILLED`. El disponible ya bajó al reservar. Las escrituras condicionales permiten una sola entrega efectiva. Un conflicto concurrente puede rechazarse y un fallo de stock revierte el conjunto de escrituras.

En la web, el cliente renderiza el SVG real con `react-qr-code`, codifica el JSON `{ orderId, token }` y muestra el vencimiento y la opción de regenerar. El bloqueo síncrono evita emisiones duplicadas y el cambio de pedido descarta credenciales o respuestas tardías. En staff, el bloqueo abarca búsqueda y confirmación, deshabilita la edición y separa las alertas de retiro de los errores de preparación. Al cambiar de buffet o sesión, una respuesta anterior no actualiza la cola nueva ni continúa una búsqueda manual pendiente.

El [proceso de cocina](MVP-11-cocina-operativa.md) se ejecuta al arrancar y cada diez segundos. Un pedido preparado sigue en `PREPARING` hasta que el proceso constate `promisedFrom ≤ ahora < promisedTo`. Al pasar a `READY_FOR_PICKUP` desaparece de la cola de preparación y el cliente puede emitir su credencial.

## Evidencia de validación local

| Verificación | Resultado |
| --- | --- |
| Pickup y cocina sin PostgreSQL | 25 y 43 pruebas específicas aprobadas |
| DOM dirigido | 8 pruebas del cliente y 8 de cocina y retiro aprobadas |
| Suite web | 73 aprobadas, 0 fallidas, 0 omitidas |
| Suite API sin PostgreSQL | 429 aprobadas, 0 fallidas, 30 omisiones previstas |
| PostgreSQL descartable | 6 aprobadas, 0 fallidas, 0 omitidas |
| Calidad | Builds de API y web, ESLint sin advertencias, typechecks y whitespace aprobados |

Las pruebas dirigidas se incluyen en las suites generales cuando corresponde. En Windows reapareció `uv_os_get_passwd: ENOMEM` al cargar `tsx`. Se reutilizó la precarga temporal autorizada fuera del repositorio.

Las integraciones usaron PostgreSQL descartable en loopback, JWT y JWKS locales, fixtures exclusivos y el proveedor de pago simulado. Verificaron HTTP, permisos entre buffets, persistencia, rollback y concurrencia. En la prueba conjunta, ambos pedidos siguieron `PREPARING` tras un ciclo anterior a la ventana y las dos emisiones devolvieron `404`. El proceso periódico real habilitó los dos dentro de su ventana. Las dos emisiones posteriores devolvieron `201`, y las entregas y repeticiones devolvieron el indicador correspondiente. Los cuatro movimientos coincidieron con los identificadores, cantidades y pedidos.

| Momento | Producto disponible / reservado | Adicional disponible / reservado | Movimientos acumulados |
| --- | ---: | ---: | ---: |
| Antes del retiro | 7 / 3 | 6 / 4 | 0 |
| Después del QR | 7 / 1 | 6 / 3 | 2 |
| Después de repetir QR | 7 / 1 | 6 / 3 | 2 |
| Después del código manual | 7 / 0 | 6 / 0 | 4 |
| Después de repetir código manual | 7 / 0 | 6 / 0 | 4 |

## Cumplimiento y pendientes de #109

| Criterio | Estado |
| --- | --- |
| Retiro QR y manual en pedidos distintos | Verificado localmente por HTTP, PostgreSQL y el proceso real de cocina. |
| Staff de otro buffet rechazado | Verificado mediante HTTP `403` y ausencia de escrituras. |
| Consumo de stock una sola vez | Verificado para productos y adicionales, incluyendo repeticiones y concurrencia. |
| Rechazo de reutilización | La interfaz indica que no se debe volver a entregar y se conserva la auditoría original. La aceptación del contrato HTTP sigue pendiente. |

#109 y CA-03 de TDD-0010 piden rechazar una credencial reutilizada. La sección de idempotencia del mismo TDD pide devolver el estado existente en un reintento. El comportamiento provisional conserva `200` al devolver un resultado anterior para la credencial exacta. Corresponde acordar si el rechazo operativo es suficiente o si se requiere un error HTTP para cerrar #109.

Quedan pendientes el ensayo autenticado en navegador real, la lectura con escáner, el checkout sandbox de MVP-18 y el ensayo público de MVP-20. La evidencia DOM y PostgreSQL corresponde a verificaciones locales.
