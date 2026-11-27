# MVP-13 · Casos de prueba del MVP

T31 prepara los datos, pasos y resultados esperados de [#108](https://github.com/Marilu-su/TakeAndGo/issues/108). CP-01 a CP-06 cubren el criterio de cierre. CP-07 complementa el recorrido de retiro. La ejecución pública y el registro de resultados corresponden a [MVP-20 #114](https://github.com/Marilu-su/TakeAndGo/issues/114), sobre el candidato publicado de MVP-04.

## Preparación común

1. Ivo confirma las URL web y API, el entorno, los SHA desplegados y la disponibilidad del proceso periódico. Registrar fecha, hora y zona del ensayo. Verificar que el ambiente de demo y el proveedor de pago sean los autorizados.
2. El equipo de MVP-02 confirma Buffet Sistemas activo (`SIS001`), horarios, catálogo y saldo real. La configuración integrada usa `America/Argentina/Buenos_Aires`, apertura 08:00, cierre digital 21:30 y cierre operativo 22:00. Usar una ventana que ofrezca efectivamente la aplicación ese día. El inicio requiere al menos 20 minutos desde la solicitud, incluidos hasta cinco minutos para pagar. La ventana dura cinco minutos y la tolerancia otros cinco. La tolerancia debe terminar estrictamente antes del cierre operativo. Confirmar la configuración en el SHA desplegado. [PR #131](https://github.com/Marilu-su/TakeAndGo/pull/131) · [Contrato MVP-09](../contracts/MVP-09-ventanas-retiro.md)
3. El seed de referencia de [PR #130](https://github.com/Marilu-su/TakeAndGo/pull/130) contiene Café con leche (30 unidades iniciales), Sándwich de miga (20) y Medialuna (30). Los adicionales Leche de almendras (10) y Medialuna extra (15) están vinculados a Café con leche. Los números son del seed, y el saldo del ensayo se registra antes de cada caso. Usar un Café con leche y un adicional disponible para comprobar ambos tipos de inventario cuando corresponda. Si faltan datos o stock, registrar el bloqueo y coordinar su preparación mediante el flujo autorizado de MVP-02 antes de ensayar.
4. Obtener un `CUSTOMER` asociado a SIS001, un `STORE_EMPLOYEE` de SIS001 y otro `STORE_EMPLOYEE` de un segundo buffet real del ambiente de prueba. El equipo de demo asigna los ámbitos antes de la ejecución. Usar sesiones de navegador separadas y verificar sus roles. Lauti proporciona el acceso al sandbox autorizado y las cuentas de prueba de comprador y vendedor por el canal del equipo. La documentación no contiene credenciales. [Evidencia local de roles](../architecture/T08-INFRAESTRUCTURA-CI-CD.md) · [MVP-05, sandbox](../contracts/MVP-05-contrato-checkout.md#7-cómo-probar-un-pago-en-el-sandbox)
5. Usar un pedido nuevo por caso, salvo que un mismo intento sea el objeto de repetición dentro del caso. Capturar ID de pedido, estados y saldos `availableStock` y `reservedStock` de las líneas. Usar evidencia autorizada de lectura para los movimientos por referencia de pedido. Evitar operaciones simultáneas sobre el mismo stock o identificarlas por referencia. En evidencia compartida, ocultar tokens, QR, códigos manuales, cabeceras de autenticación y datos de pago.
6. Al terminar, conservar la trazabilidad de los pedidos completados. Para reservas pendientes usar la cancelación autorizada o dejar que el proceso de expiración las libere. Etiquetar los pedidos de ensayo con su ID en el registro, sin editar estados, balances ni auditoría en la base pública. Los fixtures de pruebas automatizadas se crean y eliminan exclusivamente en el entorno aislado.

### Borde del horario digital de SIS001

| Hora local de la solicitud | Resultado esperado | Evidencia |
| --- | --- | --- |
| 21:29:00 | Si se cumplen las demás precondiciones, se puede reservar para las 21:49. La ventana termina a las 21:54 y la tolerancia a las 21:59. | La prueba local de #131 obtuvo `201` y `RESERVED`. |
| Desde 21:29:01 y antes de las 21:30:00 | El redondeo al minuto siguiente desplaza el primer inicio posible a las 21:50. La tolerancia terminaría a las 22:00, por lo que no hay una ventana válida. | Resultado derivado del redondeo y del límite estricto en el código integrado. |
| 21:30:00 | Cierra el canal digital. El pedido para la ventana anteriormente ofrecida se rechaza. | La prueba local de #131 obtuvo `409 PICKUP_WINDOW_UNAVAILABLE` y comprobó que no hubo escrituras. |

La verificación de estos límites en el despliegue público queda pendiente de MVP-20. [Prueba local de creación de pedidos](../../apps/api/test/modules/order/createOrderPickupWindow.test.ts) · [Regla de generación de ventanas](../../apps/api/src/modules/order/domain/pickupWindow.ts)

### Evidencia local y alcance

| Frente | Evidencia previa | Alcance pendiente |
| --- | --- | --- |
| Reserva y checkout | MVP-09 verificó creación, ventana y stock con PostgreSQL. MVP-10 verificó la UI con respuestas simuladas. El repositorio incluye pruebas de confirmación, rechazo, expiración y avisos duplicados en `paymentConfirmationPersistence.test.ts`, `paymentOrderStockPersistence.test.ts`, `paymentRoutes.test.ts` y `expireReservationsJob.test.ts`. | Navegador real, proveedor sandbox y ejecución pública para los casos de este documento. |
| Cocina | El PR #132 se integró en `develop` en `15c4fec426f4aa877fb4c545e5db163302b5efc0` y la issue #107 está cerrada. La validación local comprobó la cola, el aislamiento y la activación periódica con PostgreSQL. | Verificar en navegador y en el entorno público. Registrar el SHA del candidato. |
| Retiro | El checkpoint local `fa506df2679f2a83f9b9c6278aa91dece31aeaef` conserva 25 pruebas unitarias/HTTP sin PostgreSQL, dos integraciones de persistencia/concurrencia, ocho pruebas DOM dirigidas y una integración HTTP con dos pedidos y PostgreSQL, todas aprobadas. | El checkpoint no está incorporado a `develop`. Pendientes la comprobación en navegador, lectura de QR con escáner, interfaz de staff y resolución del criterio HTTP de reutilización. |

[Contrato MVP-10](../contracts/MVP-10-checkout-web.md) · [Contrato MVP-11 integrado](../contracts/MVP-11-cocina-operativa.md) · [PR #132](https://github.com/Marilu-su/TakeAndGo/pull/132) · [Plan del checkpoint](https://docs.google.com/document/d/1HP8r4fZtZ1CRMrANtDGg-p33-y-NDrQ1KLqxvJ-DVpA)

## CP-01 — Compra exitosa

**Objetivo y trazabilidad.** Completar un pedido nuevo desde catálogo hasta retiro. #104, #106, #107, #109, #115 y #57.

**Roles, datos y dependencias.** Cliente y staff de SIS001, ventana del día, producto y adicional, sandbox de MVP-18 y candidato de MVP-20. Aplicar la preparación común. Reservar tiempo para completar la entrega dentro de la ventana y tolerancia.

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Abrir el catálogo, agregar producto y adicional y elegir una ventana ofrecida. Registrar saldos y horario. | Los ítems están disponibles y la ventana corresponde al día local. |
| 2 | Confirmar el carrito. | Pedido `RESERVED` con ventana persistida y reserva de hasta cinco minutos. Para cada línea, el disponible baja y el reservado sube por la cantidad pedida. |
| 3 | Iniciar el pago, abrir el enlace del sandbox, usar la cuenta de comprador de prueba y el caso `APRO` de MVP-05. Volver al detalle. | La web consulta el resultado. `paymentStatus: APPROVED`, `orderStatus: CONFIRMED`, `checkoutState: CONFIRMED`. No hay otro descuento de disponible. |
| 4 | Localizarlo como staff, iniciar y finalizar la preparación. Actualizar la cola. | Pasa a `PREPARING`. Finalizar registra `preparedAt` y actor, conservando `PREPARING` hasta que el backend habilite el retiro dentro de la ventana prometida. Tras `READY_FOR_PICKUP`, desaparece del GET de cola. |
| 5 | Generar y presentar el QR. Confirmar como staff y actualizar el detalle del cliente. | `COMPLETED`, con fecha, actor y método QR. Disminuye el reservado por las cantidades entregadas. El disponible permanece igual y hay un solo consumo documentado por cada línea. |

**Evidencia y cierre.** Capturas de catálogo, ventana, estado de pago y cola, y extracto de auditoría y movimientos. Conservar el pedido completado. **Estado: no ejecutado de extremo a extremo en navegador, sandbox ni entorno público en MVP-13.**

## CP-02 — Pago rechazado

**Objetivo y trazabilidad.** Verificar rechazo, mensaje y liberación. #106, #115, #52 y RN-073.

**Roles, datos y dependencias.** Cliente titular, pedido nuevo con una reserva vigente y caso `OTHE` del sandbox documentado en MVP-05. Requiere MVP-08 y MVP-18. Preparar saldo y ventana conforme a la sección común.

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Reservar e iniciar checkout antes del vencimiento. | `RESERVED`, con pago iniciado y stock reservado. |
| 2 | Ejecutar el rechazo sandbox y volver a la web sin aprobar otro pago en ese checkout. | El aviso de rechazo por sí solo no cancela. La consulta de estado reconcilia el rechazo mientras el pago está pendiente. Si se vence antes de confirmar el rechazo, registrar la situación y repetir con otro pedido. |
| 3 | Consultar el detalle y el inventario. | `paymentStatus: REJECTED`, `orderStatus: CANCELLED`, `checkoutState: REJECTED`. La web muestra «El pago fue rechazado» y ofrece volver al catálogo. El disponible se restaura y el reservado se reduce una sola vez, con movimientos `ORDER_CANCELLED` por las líneas liberadas. |
| 4 | Volver a consultar. | Se conservan los estados. La segunda consulta no libera stock otra vez. |

**Evidencia y cierre.** Registrar el resultado del proveedor de prueba, respuesta del GET de pago, UI y saldos antes y después. Conservar el pedido cancelado. **Estado: cobertura local automatizada previa. Navegador, sandbox y público pendientes para este caso.**

## CP-03 — Reserva vencida

**Objetivo y trazabilidad.** Verificar expiración, bloqueo del checkout y liberación automática. #104, #106, #115, #52, RN-070 y RN-074.

**Roles, datos y dependencias.** Cliente, reserva nueva y proceso de expiración activo. Para verificar el contrato HTTP sin una intención previa, usar un pedido sin pago iniciado. Para observar `checkoutState` con intención, usar un segundo pedido de control y mantener el pago pendiente en el sandbox. No usar el proveedor fake para comprobar que un pago iniciado permanece pendiente al consultar.

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Crear la reserva, registrar `reservedUntil` y saldos. No aprobar un pago. | `RESERVED`, con decremento del disponible e incremento del reservado. |
| 2 | Dejar vencer los cinco minutos y observar el proceso automático. | El proceso se ejecuta al arrancar y cada 30 segundos. Tras procesar el pedido, queda `EXPIRED` y se libera la reserva mediante `ORDER_CANCELLED`. Observar el ciclo y registrar la demora real. |
| 3 | Recargar el detalle e intentar continuar por la interfaz. Si se comprueba la API autorizada, intentar iniciar el pago con el titular. | La interfaz comunica el vencimiento y no habilita otro pago. El POST devuelve `409 RESERVATION_EXPIRED` si el plazo venció y el pedido sigue `RESERVED`, o `409 ORDER_NOT_PAYABLE` si ya pasó a `EXPIRED`. Sin intención previa, el GET de pago puede devolver `404 PAYMENT_NOT_FOUND`. Con intención todavía pendiente, `checkoutState` es `EXPIRED` al vencer y `paymentStatus` puede seguir `PENDING`. |
| 4 | Volver a comprobar estados e inventario tras otro ciclo. | Disponible restaurado y ninguna segunda liberación. El pedido sigue `EXPIRED`. |

**Evidencia y cierre.** Registrar tiempos de reserva y proceso, detalle, respuesta HTTP si se consultó, y los movimientos. Dejar que expire cualquier pedido de control. **Estado: cobertura local automatizada previa. Navegador y público pendientes. Variante con pago pendiente en sandbox pendiente.**

## CP-04 — Evento de pago duplicado

**Objetivo y trazabilidad.** Verificar que el mismo aviso válido se aplica una sola vez. #108, #115, MVP-07 y MVP-17.

**Roles, datos y dependencias.** Cliente con una compra sandbox nueva. Lauti valida el pago y el aviso. Ivo confirma la recepción en la API del ambiente autorizado y el mecanismo de reentrega habilitado por el proveedor o el entorno. La UI no tiene una acción de reenvío.

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Reservar e iniciar checkout. Aprobar en sandbox y coordinar las observaciones con Lauti sin usar la consulta web para confirmar primero. | Aviso válido recibido en `POST /api/v1/payments/webhooks/mercadopago`. La API verifica la firma con el entorno configurado, consulta al proveedor y aplica la aprobación. |
| 2 | Verificar el primer aviso y solicitar la reentrega autorizada del mismo evento. Si no hay un mecanismo disponible, registrar el caso público bloqueado y usar como evidencia separada el test aislado de avisos duplicados. | Un aviso válido procesado o repetido recibe `200`. La API devuelve error de firma para un aviso inválido. Una simulación local no cuenta como reentrega pública. |
| 3 | Comparar pago, pedido y movimientos para la misma referencia. | Un pago `APPROVED` y un pedido `CONFIRMED`. El stock sigue reservado para retiro. No se crean reservas, liberaciones ni consumos adicionales por el duplicado. |

**Evidencia y cierre.** Registrar referencia del evento, respuestas, órdenes y saldos sin firmas ni cabeceras. Completar la entrega del pedido aprobado por el flujo normal en el entorno de prueba o conservarlo identificado para el equipo. **Estado: cobertura local con proveedor simulado. Reentrega sandbox y validación pública pendientes.**

## CP-05 — QR reutilizado

**Objetivo y trazabilidad.** Demostrar una sola entrega física y un solo consumo. #109, #57, RN-113 a RN-116 y CA-03 de TDD-0010.

**Roles, datos y dependencias.** Titular y staff de SIS001. Pedido nuevo llevado a `READY_FOR_PICKUP` por el flujo normal en el ensayo público. Para el ensayo aislado se puede preparar un fixture listo. Usar su QR vigente y capturar saldos antes de confirmar.

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Generar QR como titular y confirmar una vez como staff. | `COMPLETED`, con `pickedUpAt`, actor y método QR registrados. El token queda consumido. El reservado baja y se agrega `ORDER_FULFILLED` por cada línea aplicable. El disponible no vuelve a bajar. |
| 2 | Presentar la misma credencial para el mismo pedido y buffet. Registrar versión y respuesta. | En `develop`, la repetición exacta puede devolver `200` con el `COMPLETED` y fecha originales. La UI de staff puede mostrar «Retiro confirmado» en ambas respuestas. La propuesta provisional del checkpoint local devuelve `alreadyPickedUp: false` en la primera y `true` en la repetida, ambas `200`. Este resultado sigue pendiente de acuerdo como criterio de aceptación de #109. |
| 3 | Comparar inventario, uso del token y auditoría con la primera entrega. | El segundo intento no autoriza otra entrega física. Fecha y actor originales, stock y movimientos permanecen iguales. Registrar el mensaje observado y cualquier diferencia entre el criterio operativo y el HTTP. |

**Evidencia y cierre.** Guardar estados, método, hora, actor y conteo de movimientos antes, después y al repetir, con el QR oculto. Conservar el pedido completado y descartar la credencial del material de prueba. **Estado: integración local aprobada en el checkpoint. Navegador, escáner y público pendientes. El rechazo HTTP estricto queda pendiente de acuerdo.**

## CP-06 — Permisos entre buffets

**Objetivo y trazabilidad.** Verificar aislamiento de cola, preparación y entrega. #107, #109, #57 y RN-115.

**Roles, datos y dependencias.** Titular, staff de SIS001 y staff de otro buffet comprobado. Preparar un pedido confirmado propio de SIS001 y, cuando esté listo, emitir su código manual como titular. Usar sesiones separadas y solicitudes autenticadas únicamente en el ambiente autorizado.

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Consultar desde el buffet ajeno y solicitar la cola de SIS001 con ese actor. | Su propia cola no contiene pedidos de SIS001. El GET directo de cocina de SIS001 devuelve `403`. |
| 2 | Intentar iniciar como staff ajeno mientras está confirmado y finalizar como staff ajeno después de que el staff propio lo inicie. | Ambos POST al buffet propietario devuelven `403`. Cada rechazo deja el estado y auditoría de preparación intactos. |
| 3 | Cuando el pedido esté listo, intentar buscar el código y confirmar con el actor ajeno. | `403` al dirigir los POST al buffet propietario. La credencial, el pedido y el stock conservan sus valores. |
| 4 | Confirmar con el staff de SIS001. | Se permite una sola entrega y se registran el actor correcto y los movimientos esperados. |

**Evidencia y cierre.** Registrar rol y ámbito de ambos actores, códigos HTTP y estado antes y después de cada intento. Cerrar por la entrega autorizada dentro de la ventana y tolerancia. **Estado: aislamiento automatizado verificado por separado en MVP-11 y en el checkpoint de MVP-12. Recorrido conjunto en navegador y público pendiente.**

## CP-07 — Retiro por código manual

**Objetivo y trazabilidad.** Verificar el mecanismo manual en un pedido distinto del QR. #109 y RN-117 a RN-118.

**Roles, datos y dependencias.** Cliente titular, staff autorizado de SIS001 y pedido nuevo `READY_FOR_PICKUP`. Generarlo por el flujo normal en público y por fixture únicamente en integración aislada.

| Paso | Acción | Resultado esperado |
| --- | --- | --- |
| 1 | Generar código manual desde el detalle listo. | Se muestran 12 caracteres. El persistido es el hash. La evidencia de almacenamiento corresponde a la integración aislada. |
| 2 | Ingresarlo en cocina y confirmar. | La búsqueda autorizada devuelve el pedido listo y la confirmación devuelve `200`. El pedido queda `COMPLETED` con fecha, actor y método `MANUAL`. El reservado baja una vez, el disponible se conserva y se registran los movimientos `ORDER_FULFILLED`. |
| 3 | Buscar nuevamente el código. Si se prueba la confirmación directa autorizada, repetirla por separado. | La búsqueda del pedido completado devuelve `404`. La confirmación directa repetida puede devolver `200` idempotente, con `alreadyPickedUp: true` en el checkpoint. Se conservan auditoría y stock. |

**Evidencia y cierre.** Guardar resultado de búsqueda y confirmación, auditoría y movimientos por referencia con el código oculto. Conservar el pedido completado. **Estado: integración local aprobada en el checkpoint. Navegador y entorno público pendientes.**

## Registro para MVP-20

Completar una fila por caso y por ejecución. Estados permitidos: aprobado, fallido, bloqueado o no ejecutado.

| Caso | Fecha y hora con zona | Entorno y URL | SHA | Resultado esperado | Resultado obtenido | Estado | Evidencia | Incidencia |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CP-01 | — | — | — | Compra nueva hasta `COMPLETED` | — | No ejecutado | — | — |
| CP-02 | — | — | — | Rechazo, cancelación y liberación única | — | No ejecutado | — | — |
| CP-03 | — | — | — | Expiración, checkout bloqueado y liberación única | — | No ejecutado | — | — |
| CP-04 | — | — | — | Aviso duplicado sin efectos adicionales | — | No ejecutado | — | — |
| CP-05 | — | — | — | Repetición sin segunda entrega ni consumo | — | No ejecutado | — | — |
| CP-06 | — | — | — | Staff ajeno rechazado | — | No ejecutado | — | — |
| CP-07 | — | — | — | Retiro manual único y búsqueda posterior rechazada | — | No ejecutado | — | — |

**Fuentes de reglas y alcance.** [Master](../reference/v2/TAKEANDGO_MASTER_V2_0.md) · [TDD-0005](../reference/v2/tdds/TDD-0005_INVENTARIO_RESERVAS_Y_MOVIMIENTOS.md) · [TDD-0007](../reference/v2/tdds/TDD-0007_PEDIDOS_VENTANAS_PAGO_Y_REEMBOLSO.md) · [TDD-0009](../reference/v2/tdds/TDD-0009_COCINA_Y_VENTA_PRESENCIAL.md) · [TDD-0010](../reference/v2/tdds/TDD-0010_RETIRO_QR_Y_FALLBACK_MANUAL.md) · [#52](https://github.com/Marilu-su/TakeAndGo/issues/52) · [#57](https://github.com/Marilu-su/TakeAndGo/issues/57) · [#104](https://github.com/Marilu-su/TakeAndGo/issues/104) · [#106](https://github.com/Marilu-su/TakeAndGo/issues/106) · [#107](https://github.com/Marilu-su/TakeAndGo/issues/107) · [#109](https://github.com/Marilu-su/TakeAndGo/issues/109) · [#115](https://github.com/Marilu-su/TakeAndGo/issues/115).
