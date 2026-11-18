# TAKE&GO — Documento Maestro Funcional V2.0

**Proyecto:** Desarrollo de Software Cloud — UTN FRLP — 2026  
**Producto:** Take&Go — Plataforma SaaS de Take Away Inteligente  
**Equipo:** 4 integrantes  
**Estado:** Línea base funcional para desarrollo  
**Fecha:** 2026-09-06

> Este archivo es la **fuente de verdad funcional** del MVP. Si el código, un TDD o una propuesta de IA contradicen este documento, se detiene esa parte del desarrollo y se actualiza primero la documentación. Ningún agente debe inventar reglas faltantes.

---

# 0. Propósito y forma de uso

Take&Go busca reducir filas, tiempos perdidos y desperdicio en buffets/comedor interno. El CUSTOMER elige un buffet, conversa con **MenIA**, arma y paga pedidos digitales, recibe una ventana de retiro y valida la entrega por QR. **CocIA** estima tiempos y organiza la cocina. El sistema además administra stock, ventas presenciales, no-retiros, sanciones y fidelización por puntos.

## Regla de documentación

- Las `RN-xxx` son obligatorias para el MVP.
- Los TDDs describen cómo implementar verticalmente estas reglas.
- Las decisiones de proveedor cloud se documentan con ADR y no cambian por sí solas el negocio.
- Toda regla nueva debe ser aprobada por el equipo antes de codificarse.
- `AI-DECISIONS.md` registra decisiones relevantes asistidas por IA.

---

# 1. One-line product statement

> **Take&Go es una plataforma SaaS que permite pedir comida anticipadamente en buffets internos, pagar digitalmente y retirarla en una ventana coordinada, mientras MenIA facilita la interacción y CocIA planifica la cocina para reducir filas, retrasos y desperdicio.**

---

# 2. Roles

## CUSTOMER
Cuenta global. Puede asociarse a múltiples buffets, incluso de distintas organizaciones; usa MenIA, paga, retira, administra perfil/preferencias, consulta historial y participa del sistema de puntos.

## STORE_EMPLOYEE
Personal operativo de un único buffet. Opera cocina, ventas presenciales, QR y retiro manual.

## STORE_ADMIN
Administrador operativo de un único buffet. Define catálogo, categorías, precios, adicionales, stock, horarios, configuración CocIA, empleados y recompensas ofrecidas por su buffet.

## ORGANIZATION_ADMIN
Administrador de una única organización. Supervisa sus buffets, crea/dada de baja buffets, asigna STORE_ADMIN, ve KPIs y administra rehabilitaciones por sanciones. No opera el catálogo/precios/stock local.

---

# 3. Reglas de negocio V2.0

## 3.1 Identidad, acceso y asociación

**RN-001.** La cuenta CUSTOMER es global a Take&Go y se identifica de manera única por email.

**RN-002.** El alta CUSTOMER solicita nombre, email, contraseña y al menos un código de buffet.

**RN-003.** En el MVP no se exige verificación de email para comenzar a operar.

**RN-004.** Debe existir recuperación de contraseña mediante “Olvidé mi contraseña” y el email registrado.

**RN-005.** Cada buffet posee un código fijo con formato de 3 letras seguidas de 3 números, por ejemplo `ABC123`.

**RN-006.** Como baseline del MVP, el código de buffet es único en toda la plataforma para evitar asociaciones ambiguas.

**RN-007.** La asociación CUSTOMER-buffet mediante código es inmediata y no requiere aprobación del STORE_ADMIN.

**RN-008.** Un CUSTOMER puede asociarse a múltiples buffets, incluso de organizaciones diferentes.

**RN-009.** El CUSTOMER puede agregar nuevos buffets posteriormente desde su área global.

**RN-010.** La organización, el primer buffet y el primer ORGANIZATION_ADMIN pueden provisionarse manualmente durante el despliegue/configuración inicial del MVP.

---

## 3.2 Navegación y contexto

**RN-011.** La pantalla inicial de un CUSTOMER autenticado es global: muestra los buffets asociados y accesos a Perfil, Preferencias e Historial.

**RN-012.** MenIA no es la primera pantalla. Para realizar acciones de un buffet, el CUSTOMER debe primero entrar a ese buffet.

**RN-013.** Una vez seleccionado un buffet, catálogo, precios, stock, horarios, capacidad, recompensas y pedidos se evalúan en el contexto de ese buffet.

**RN-014.** Al cambiar de buffet, la interfaz debe indicar claramente el nuevo contexto activo.

**RN-015.** No se guarda historial persistente del chat de MenIA. Sí se guarda la información funcional/transaccional resultante.

---

## 3.3 Perfil, preferencias, exclusiones y dieta

**RN-016.** Las preferencias del CUSTOMER son globales para toda Take&Go y se expresan a nivel de producto/concepto.

**RN-017.** Las exclusiones y restricciones alimentarias son globales. Las exclusiones pueden referirse a producto o ingrediente; el perfil también puede declarar restricciones de dieta como **Sin TACC, Vegetariano y Vegano**.

**RN-018.** Exclusiones y restricciones de dieta son filtros duros: MenIA no debe recomendar una opción incompatible con ellas.

**RN-019.** Una preferencia es un criterio de ranking: si existe una opción preferida, disponible y factible, MenIA debe priorizarla.

**RN-020.** El historial de pedidos es global e indica en qué buffet y organización se realizó cada operación.

**RN-021.** El historial puede utilizarse como señal secundaria de afinidad para recomendaciones.

**RN-022.** El CUSTOMER puede guardar una rutina semanal. Sirve para orientar recomendaciones, no para impedir pedidos explícitos fuera de ella.

**RN-023.** Las excepciones puntuales a la rutina pueden usarse en el contexto actual sin alterar la rutina guardada.

**RN-024.** Los filtros de presupuesto son contextuales y no se guardan como preferencia permanente.

**RN-025.** Toda modificación persistente de perfil, preferencias, exclusiones, restricciones de dieta o rutina propuesta por MenIA requiere una confirmación estructurada del usuario.

---

## 3.4 Organización, buffet y staff

**RN-026.** Cada STORE_ADMIN administra un único buffet.

**RN-027.** Cuando se crea un buffet, su STORE_ADMIN completa un formulario/plantilla mínima antes de habilitar la operación.

**RN-028.** Cada buffet administra sus propias categorías, catálogo, precios, adicionales, stock, horarios y parámetros operativos de CocIA.

**RN-029.** Cada producto pertenece a una única categoría.

**RN-030.** El STORE_ADMIN puede crear, editar y desactivar categorías de su buffet.

**RN-031.** Todos los precios son definidos por el STORE_ADMIN del buffet.

**RN-032.** Un producto base puede tener cero o más adicionales y cada adicional tiene precio propio.

**RN-033.** Los tiempos base de preparación se configuran por producto a nivel buffet.

**RN-034.** Los productos pueden desactivarse sin eliminar las referencias históricas de pedidos ya existentes.

**RN-035.** El STORE_ADMIN administra las cuentas STORE_EMPLOYEE de su único buffet.

---

## 3.5 MenIA

**RN-036.** MenIA es la interfaz principal para consultar productos y realizar pedidos digitales.

**RN-037.** MenIA acepta texto y audio. El audio se transforma a texto/intención antes de ejecutar reglas de negocio.

**RN-038.** MenIA puede entender lo que el usuario pide y proponer acciones, pero **ninguna acción real se ejecuta solo porque MenIA la diga**. Antes de crear/modificar pedidos, perfil, puntos o cualquier dato, el backend debe validar permisos, stock, horarios, sanciones y demás reglas correspondientes.

**RN-039.** Las acciones transaccionales o persistentes propuestas por MenIA deben presentarse mediante componentes estructurados de confirmación; no se autoriza una operación irreversible interpretando solamente un “sí” libre en el chat.

**RN-040.** Si el usuario pide “mostrar catálogo”, MenIA muestra todo el catálogo actualmente disponible del buffet, agrupado por categorías.

**RN-041.** En catálogo MenIA muestra primero el precio base; al seleccionar un producto muestra los adicionales disponibles y el precio de cada uno.

**RN-042.** Un producto o adicional sin stock/disponibilidad no se muestra como opción.

**RN-043.** Si un producto o adicional seleccionado se agota antes de reservar/pagar, MenIA informa exactamente qué cambió y permite modificar la propuesta.

**RN-044.** Si el producto base se agota, MenIA informa que ya no está disponible y busca alternativas válidas.

**RN-045.** Ante una solicitud genérica con restricciones de tiempo, presupuesto, dieta o preferencia, MenIA muestra como máximo 4 recomendaciones válidas.

**RN-046.** Si existen menos de 4 opciones válidas, muestra únicamente las existentes; no rellena con opciones incompatibles.

**RN-047.** El límite de 4 no aplica cuando el CUSTOMER pide explícitamente el catálogo completo.

**RN-048.** Si el CUSTOMER solicita algo para una hora concreta, MenIA solo ofrece productos que puedan cumplir esa restricción según disponibilidad y planificación.

**RN-049.** Si el horario solicitado no es posible, MenIA debe ofrecer el primer horario disponible, permitir ver otros horarios y ofrecer “Mostrarme opciones que lleguen para el horario que pedí”.

**RN-050.** Si ninguna alternativa puede entregarse dentro de la operación del buffet, MenIA informa la imposibilidad y ofrece opciones que sí puedan cumplirse o la compra presencial si corresponde.

**RN-051.** MenIA no inicia conversaciones/recomendaciones de manera proactiva. Actúa cuando el usuario inicia la interacción.

**RN-052.** Fuera del horario habilitado para nuevos pedidos digitales del buffet, MenIA no permite crear pedidos y muestra “MenIA está durmiendo”; el resto de la aplicación permanece navegable.

**RN-053.** MenIA puede proponer una planificación semanal basada en rutina, preferencias, dieta, exclusiones, historial y catálogo. La planificación no crea pedidos por sí sola; los pedidos concretos requieren confirmación y deben caer dentro de la ventana futura habilitada.

---

## 3.6 Pedidos, anticipación, ventanas y estados

**RN-054.** Los pedidos digitales pueden programarse para una fecha futura dentro de una **ventana máxima de 7 días por defecto**. El ORGANIZATION_ADMIN puede configurar el máximo de anticipación permitido para su organización.

**RN-055.** No existe un horario universal 21:30/22:00 para toda Take&Go. Cada buffet configura sus horarios de apertura, cierre de pedidos digitales y cierre operativo. Las reglas de MenIA y retiro usan los horarios del buffet activo.

**RN-056.** Deben existir al menos 15 minutos entre la confirmación efectiva del pedido y el comienzo de su ventana de retiro. Para pedidos programados con mayor anticipación esta regla se satisface naturalmente.

**RN-057.** La ventana de retiro dura 5 minutos y puede comenzar en cualquier minuto; no existen slots globales fijos.

**RN-058.** Después de la ventana existe una tolerancia adicional de 5 minutos.

**RN-059.** Ventana + tolerancia deben finalizar antes del cierre operativo configurado del buffet para ese día.

**RN-060.** Flujo normal: `RESERVADO -> CONFIRMADO -> EN_PREPARACIÓN -> PARA_RETIRAR -> RETIRADO`.

**RN-061.** Un pedido RESERVADO puede pasar a CANCELADO por pago rechazado, expiración o cancelación del CUSTOMER antes de la aprobación.

**RN-062.** Un pedido PARA_RETIRAR pasa a NO_RETIRADO cuando finaliza la tolerancia sin validación de retiro.

**RN-063.** El buffet puede cancelar excepcionalmente un pedido pagado por error de stock, falla operativa, cierre anticipado u otra causa justificada; debe registrar motivo y devolver el dinero.

**RN-064.** No existe estado PREPARADO separado.

**RN-065.** Si el pedido está físicamente listo antes de la ventana se registra `readyAt`, pero `PARA_RETIRAR` solo se activa cuando el producto está listo y la ventana ya comenzó.

**RN-066.** Un pedido con varios productos/unidades se promete para una única ventana y debe estar completo para entregarse.

**RN-067.** Al ofrecer un horario antes del pago, el sistema debe contemplar que el usuario puede tardar hasta **5 minutos** en completar el pago. No debe prometer una ventana que, si el pago se aprueba al final de esos 5 minutos, deje menos de 15 minutos de anticipación.

**RN-068.** El único medio de pago de pedidos digitales del MVP es una pasarela de pago virtual integrada.

**RN-069.** Los estados principales de pago son `PENDIENTE`, `APROBADO`, `RECHAZADO` y `REEMBOLSADO`.

**RN-070.** Al crear la intención de pedido, el pedido queda RESERVADO por un máximo de **5 minutos** para completar el pago.

**RN-071.** Mientras el pago está PENDIENTE, el pedido todavía no se considera confirmado para iniciar el cómputo operativo de preparación.

**RN-072.** Pago APROBADO provoca `RESERVADO -> CONFIRMADO`.

**RN-073.** Pago RECHAZADO provoca `RESERVADO -> CANCELADO`.

**RN-074.** Si transcurren **5 minutos** sin aprobación, el pedido se cancela y se liberan los recursos reservados temporalmente.

**RN-075.** Una aprobación tardía recibida después de la expiración no reactiva el pedido; se trata como excepción y debe revertirse/reembolsarse.

**RN-076.** El CUSTOMER no puede cancelar un pedido después de que el pago fue aprobado.

**RN-077.** Cuando corresponde devolver el dinero, el pago puede terminar en `REEMBOLSADO`; además debe conservarse trazabilidad del reembolso (motivo, proveedor, momento, referencia).

**RN-078.** Un CUSTOMER no puede crear un nuevo pedido si ya tiene un pedido activo en estado `EN_PREPARACIÓN` o `PARA_RETIRAR` dentro de su ventana de retiro activa. Esta regla evita pedidos normales solapados durante la instancia de retiro.

---

## 3.7 Stock e inventario

**RN-079.** El stock base se administra por unidades de producto base; no requiere modelar obligatoriamente materias primas/receta completa.

**RN-080.** Los adicionales pueden tener stock propio cuando corresponda y solo se ofrecen si están disponibles.

**RN-081.** La reserva y el consumo de stock deben realizarse como una operación de **“todo o nada”**: si no se puede reservar correctamente todo lo necesario, no se reserva ninguna parte. Así se evita que dos clientes compren simultáneamente la misma última unidad.

**RN-082.** La disponibilidad mostrada al CUSTOMER es informativa; el backend vuelve a validarla al confirmar/reservar la operación.

**RN-083.** Al aprobarse el pago, las unidades necesarias quedan RESERVADAS para el pedido, incluso si es un pedido programado dentro de la ventana futura permitida.

**RN-084.** Al retirar el pedido, el stock reservado pasa a consumido definitivamente.

**RN-085.** Si un pedido preparado termina NO_RETIRADO, la comida preparada no vuelve como stock base; se crea una unidad recuperada con su configuración exacta.

**RN-086.** Una unidad recuperada solo puede reasignarse a una operación con la misma combinación exacta de producto y adicionales.

**RN-087.** La unidad recuperada tiene prioridad absoluta frente a preparar una unidad nueva idéntica.

**RN-088.** Una unidad recuperada puede asignarse a venta digital o presencial compatible y se vende al precio normal vigente.

**RN-089.** Si la unidad recuperada no se vende antes del cierre del día, se descarta y se registra como desperdicio/pérdida.

**RN-090.** El STORE_ADMIN puede registrar reabastecimientos y ajustes manuales; todo ajuste debe auditar delta, momento, actor y motivo.

**RN-091.** La cocina realiza una revisión operativa del stock base los lunes a primera hora; durante la semana se actualiza por movimientos y reabastecimientos.

---

## 3.8 CocIA

**RN-092.** CocIA se divide conceptualmente en una capa predictiva que estima tiempo y una capa determinística que planifica cuándo comenzar/priorizar.

**RN-093.** Ordenar pedidos solamente por hora de retiro no se considera IA; el valor de IA está en mejorar la estimación de tiempos reales.

**RN-094.** Para carga activa se consideran pedidos `CONFIRMADO`, `EN_PREPARACIÓN` y ventas presenciales en preparación.

**RN-095.** `RESERVADO`, `PARA_RETIRAR`, `RETIRADO`, `NO_RETIRADO` y `CANCELADO` no cuentan como carga activa actual.

**RN-096.** Cada producto tiene un tiempo base configurable por el STORE_ADMIN.

**RN-097.** Cada adicional suma por defecto 30 segundos, valor configurable por buffet.

**RN-098.** Cada unidad adicional del mismo producto suma por defecto 3 minutos, valor configurable por buffet.

**RN-099.** Penalización default por carga: 0-5 +0 min; 6-10 +3 min; 11-15 +6 min; más de 15 +10 min. Configurable por buffet.

**RN-100.** El fallback determinístico usa tiempos base, cantidad, adicionales y penalización de carga.

**RN-101.** CocIA no usa cantidad de personal como variable del MVP.

**RN-102.** La planificación busca que el pedido completo esté listo dentro de su ventana, evitando retrasos y preparación excesivamente temprana.

**RN-103.** Un pedido nuevo no puede romper compromisos previamente aceptados.

**RN-104.** Si el predictor IA no está disponible, la cocina continúa con fallback determinístico.

**RN-105.** Si se detecta retraso, CocIA recalcula la ventana y la tolerancia, y el sistema notifica al CUSTOMER.

**RN-106.** Para pedidos futuros, CocIA debe considerar compromisos ya confirmados para esa fecha/hora al evaluar nuevas ventanas.

---

## 3.9 Cocina y venta presencial

**RN-107.** STORE_EMPLOYEE ve una cola operativa ordenada por planificación CocIA.

**RN-108.** STORE_EMPLOYEE puede marcar inicio y finalización de preparación.

**RN-109.** Una venta presencial se registra como VENTA_PRESENCIAL y no requiere CUSTOMER.

**RN-110.** En venta presencial, pago y retiro comercial son inmediatos y el stock se descuenta al registrar la venta.

**RN-111.** Si una venta presencial requiere preparación, genera tarea de cocina y cuenta como carga activa hasta finalizar.

**RN-112.** STORE_EMPLOYEE no puede modificar precios, catálogo, parámetros CocIA ni configuración administrativa.

---

## 3.10 Retiro y QR

**RN-113.** El QR del pedido se habilita únicamente cuando el pedido está PARA_RETIRAR.

**RN-114.** El QR usa un token seguro y de un solo uso; no debe depender únicamente de un ID secuencial.

**RN-115.** Al escanear, el backend valida operación, buffet, estado, vigencia y uso previo.

**RN-116.** QR válido provoca `PARA_RETIRAR -> RETIRADO`, registra `pickedUpAt` y finaliza el consumo de stock.

**RN-117.** Si el QR no puede leerse, STORE_EMPLOYEE puede buscar por código corto y confirmar retiro manual.

**RN-118.** El retiro manual debe auditar quién lo confirmó, cuándo y qué operación entregó.

**RN-119.** No se entrega una operación identificando al CUSTOMER únicamente por nombre.

---

## 3.11 No retiro, aviso previo, recuperación y sanciones

**RN-120.** Si finaliza ventana + tolerancia sin retiro, el pedido pasa a NO_RETIRADO.

**RN-121.** Un NO_RETIRADO suma 1 strike en la organización **salvo** que el CUSTOMER haya avisado mediante la aplicación, antes de comenzar la ventana de retiro, que no podrá buscarlo.

**RN-122.** Si el CUSTOMER avisa antes de comenzar la ventana que no podrá retirar, no recibe strike, pero **no recibe reembolso** por el pedido. El aviso debe quedar registrado con fecha/hora.

**RN-123.** Avisar después de comenzar la ventana no evita el strike si finalmente no se retira.

**RN-124.** Strikes, advertencias y bloqueos se contabilizan por organización.

**RN-125.** Al llegar a 3 strikes en una organización, el CUSTOMER queda bloqueado para nuevas operaciones transaccionales en esa organización.

**RN-126.** El bloqueo de una organización no impide usar Take&Go en otras organizaciones donde no esté bloqueado.

**RN-127.** Un ORGANIZATION_ADMIN de la organización afectada puede rehabilitar al CUSTOMER.

**RN-128.** Al rehabilitar: strikes vuelven a 0 y se suma 1 advertencia.

**RN-129.** Al llegar a 2 advertencias en una organización, el bloqueo es permanente en esa organización.

**RN-130.** Un CUSTOMER bloqueado conserva acceso de solo visualización a cuenta, historial, puntos, recompensas y beneficios de esa organización, pero no puede pedir, canjear ni utilizar beneficios.

**RN-131.** Si el CUSTOMER no avisó a tiempo y se generó un strike, la recuperación o reventa posterior de la comida **no elimina ese strike**. Si había avisado antes de la ventana, el strike nunca se genera.

---

## 3.12 Notificaciones

**RN-132.** El MVP usa notificaciones in-app y push.

**RN-133.** El evento PARA_RETIRAR genera una notificación de pedido listo.

**RN-134.** Una replanificación de CocIA genera una notificación con la nueva ventana.

**RN-135.** No se envía una notificación separada solo porque comienza la tolerancia.

**RN-136.** Las notificaciones transaccionales pueden ser proactivas; la regla de MenIA no proactiva solo se refiere a iniciar conversaciones/recomendaciones.

---

# 4. Sistema de puntos y recompensas

## 4.1 Puntos

**RN-137.** Los puntos se acumulan por organización, no globalmente en toda Take&Go.

**RN-138.** Los puntos ganados en cualquier buffet de una organización pueden usarse en cualquier buffet de esa misma organización.

**RN-139.** Los puntos acumulados no vencen.

**RN-140.** Solo los pedidos normales generan puntos por puntualidad. Los canjes físicos nunca generan puntos.

**RN-141.** Un pedido normal retirado dentro de los primeros 2 minutos desde el inicio de su ventana vigente genera 10 puntos.

**RN-142.** Un pedido normal retirado en los minutos 3 y 4 genera 7 puntos.

**RN-143.** Un pedido normal retirado en el minuto 5 genera 5 puntos.

**RN-144.** Un pedido normal retirado durante los 5 minutos de tolerancia genera 3 puntos.

**RN-145.** Un NO_RETIRADO genera 0 puntos.

**RN-146.** Si CocIA replanifica la ventana, los puntos se calculan contra la ventana nueva.

**RN-147.** Si un pedido normal utiliza el beneficio de 10% de descuento, sigue generando puntos por puntualidad normalmente.

**RN-148.** Los movimientos de puntos se muestran integrados en el historial global de operaciones.

---

## 4.2 Recompensas fijas de Take&Go

**RN-149.** Los tipos de recompensa y sus costos en puntos son definidos por Take&Go y no pueden modificarlos ORGANIZATION_ADMIN ni STORE_ADMIN.

**RN-150.** Costos fijos: Café gratis 250 pts; Snack 300 pts; Producto de panadería 350 pts; Bebida fría 350 pts; 10% de descuento 500 pts.

**RN-151.** No existe recompensa de descuento fijo `$X` en el MVP.

**RN-152.** Cada STORE_ADMIN decide cuáles de los tipos de recompensa ofrece su buffet.

**RN-153.** Para cada recompensa física (Café, Snack, Panadería, Bebida fría), el STORE_ADMIN puede seleccionar hasta 2 productos concretos de su buffet.

**RN-154.** MenIA solo muestra recompensas cuyo costo sea menor o igual al saldo de puntos disponible del CUSTOMER en esa organización.

**RN-155.** Para recompensa física, MenIA muestra únicamente productos elegibles con disponibilidad. Si ninguno está disponible, la recompensa no aparece.

---

## 4.3 Flujo de canje en MenIA

**RN-156.** El CUSTOMER puede preguntar a MenIA “¿Cuántos puntos tengo?”. MenIA responde el saldo de la organización del buffet activo y pregunta si desea canjearlos.

**RN-157.** Si responde No, el flujo termina sin acción.

**RN-158.** Si responde Sí, MenIA muestra solo recompensas alcanzables y disponibles según las reglas anteriores.

---

## 4.4 Canje físico

**RN-159.** Para un canje físico, el CUSTOMER elige recompensa, producto disponible, horario y confirma.

**RN-160.** Un canje físico usa la misma lógica de horarios y capacidad que un pedido normal, incluyendo la ventana futura permitida, stock, CocIA, horarios y cierre.

**RN-161.** Al confirmar un canje físico, los puntos se descuentan y se reservan los recursos necesarios como en una compra.

**RN-162.** El CUSTOMER puede tener como máximo un canje físico confirmado/activo por organización.

**RN-163.** Un canje físico puede coexistir con un pedido normal.

**RN-164.** Si pedido normal y canje físico comparten la misma ventana, la UI los presenta como una única instancia de retiro, aunque internamente sean operaciones separadas.

**RN-165.** El canje físico nunca genera puntos, ni siquiera cuando se retira junto a un pedido normal.

**RN-166.** El CUSTOMER no puede cancelar un canje físico ya confirmado.

**RN-167.** Si el buffet cancela un canje físico por una causa propia, devuelve automáticamente todos los puntos y muestra un mensaje de disculpas.

**RN-168.** Si un canje físico no se retira, los puntos utilizados se pierden y se aplica 1 strike dentro del mismo sistema de sanciones de la organización, salvo la misma excepción de aviso previo antes de la ventana definida para pedidos.

**RN-169.** Si una recompensa de café es canjeada, el café se prepara cuando el CUSTOMER se presenta/valida la llegada. Para sanciones importa la hora de presentación, no cuánto tarda el buffet en prepararlo después.

**RN-170.** Si una recompensa de panadería preparada no se retira, pasa a la lógica de producto recuperado.

**RN-171.** Si una recompensa de snack cerrado no se retira, vuelve al stock normal.

**RN-172.** Si una recompensa de bebida fría envasada, como agua o gaseosa, no se retira, vuelve al stock normal porque no es un producto preparado de descarte inmediato.

---

## 4.5 Beneficio de 10% de descuento

**RN-173.** El beneficio de 10% cuesta 500 puntos.

**RN-174.** El CUSTOMER puede tener como máximo un beneficio activo de 10% por organización.

**RN-175.** Mientras exista un 10% activo, MenIA no muestra la opción de canjear otro.

**RN-176.** El beneficio de 10% es de un solo uso.

**RN-177.** El beneficio vence 30 días después del canje.

**RN-178.** Si vence sin utilizarse, los puntos gastados se pierden y no se reintegran.

**RN-179.** El 10% no tiene tope máximo y se calcula sobre el precio final del pedido, incluidos adicionales.

**RN-180.** Solo puede aplicarse un beneficio por compra.

**RN-181.** Si el CUSTOMER tiene un 10% activo al realizar una compra, MenIA le pregunta si quiere aplicarlo.

**RN-182.** Si el CUSTOMER decide no usarlo, lo conserva hasta su vencimiento.

**RN-183.** Si el pago falla o la reserva expira antes de confirmarse, el beneficio no se consume y conserva su vencimiento original.

**RN-184.** Si el buffet cancela un pedido confirmado que utilizaba el 10%, el beneficio se restaura automáticamente con la fecha de vencimiento original.

---

# 5. Flujos punta a punta

## 5.1 Registro

1. CUSTOMER ingresa nombre, email, contraseña y código `AAA999`.
2. Se valida identidad/código.
3. Se crea cuenta global y asociación inmediata.
4. Se muestra Home global.

## 5.2 Pedido digital

1. CUSTOMER selecciona buffet.
2. Abre MenIA.
3. Pide producto/catálogo/recomendación.
4. MenIA consulta perfil, dieta, exclusiones, catálogo, stock y CocIA.
5. MenIA presenta propuesta estructurada.
6. CUSTOMER confirma.
7. Se crea `RESERVADO` y pago `PENDIENTE` por máximo 5 min.
8. Pago aprobado -> `CONFIRMADO` y stock reservado.
9. CocIA agenda `recommendedStartAt`.
10. Cocina -> `EN_PREPARACIÓN`.
11. Listo + ventana iniciada -> `PARA_RETIRAR`.
12. QR/manual -> `RETIRADO`.
13. Si es pedido normal, se acreditan puntos según puntualidad.

## 5.3 Pedido futuro

1. CUSTOMER solicita fecha/hora futura.
2. Backend valida que la fecha esté dentro del máximo configurado por la organización (7 días default).
3. Valida horario del buffet para ese día, capacidad/compromisos y stock.
4. El resto del flujo es igual a un pedido normal: confirmación, pago y reserva.
5. La cocina lo ejecuta cuando corresponde según CocIA.

## 5.4 Pago expirado

1. Pedido RESERVADO.
2. Transcurren 5 min sin aprobación.
3. Pedido -> CANCELADO.
4. Se liberan recursos.
5. Aprobación tardía -> no reactiva; se revierte/reembolsa.

## 5.5 Aviso de no retiro

1. CUSTOMER sabe que no podrá llegar.
2. Antes de comenzar la ventana, utiliza la acción de aviso en la app.
3. Se registra fecha/hora.
4. No recibe reembolso.
5. Si finalmente no retira, el pedido puede cerrar como NO_RETIRADO pero no genera strike.
6. La comida se trata según las reglas de recuperación/stock.

## 5.6 Canje físico

1. CUSTOMER pregunta saldo a MenIA.
2. MenIA pregunta si desea canjear.
3. MenIA muestra solo recompensas alcanzables/disponibles.
4. CUSTOMER elige tipo, producto y horario.
5. Confirma.
6. Se descuentan puntos y se reservan recursos.
7. Retiro usa QR/flujo operativo correspondiente.
8. El canje no genera puntos.

## 5.7 Beneficio 10%

1. CUSTOMER canjea 500 puntos.
2. Se crea beneficio activo por 30 días.
3. En una compra futura MenIA pregunta si desea aplicarlo.
4. Si se aplica y el pago se confirma, se consume.
5. Si pago falla/expira, sigue activo.
6. Si buffet cancela pedido confirmado, se restaura con vencimiento original.

---

# 6. Máquinas de estado

## Pedido

```text
RESERVADO --pago aprobado--> CONFIRMADO
RESERVADO --rechazo/expiración/cancelación pre-pago--> CANCELADO
CONFIRMADO --inicio cocina--> EN_PREPARACIÓN
CONFIRMADO/EN_PREPARACIÓN --cancelación buffet--> CANCELADO
EN_PREPARACIÓN --listo + ventana iniciada--> PARA_RETIRAR
PARA_RETIRAR --QR/manual--> RETIRADO
PARA_RETIRAR --fin tolerancia--> NO_RETIRADO
```

## Pago

```text
PENDIENTE -> APROBADO
PENDIENTE -> RECHAZADO
APROBADO -> REEMBOLSADO   (cuando corresponde devolución)
```

---

# 7. Modelo de dominio propuesto

> Es guía técnica para TDDs; puede ajustarse mediante ADR sin romper las RN.

- `User`
- `Organization`
- `Store`
- `StoreOperatingHours`
- `CustomerStoreMembership`
- `StaffScope`
- `UserPreference`
- `DietaryRestriction`
- `WeeklyAvailability`
- `Category`
- `Product`
- `Addition`
- `ProductAddition`
- `InventoryBalance`
- `StockMovement`
- `Order`
- `OrderItem`
- `OrderItemAddition`
- `Payment`
- `Refund`
- `RecoveredPreparedUnit`
- `KitchenTicket`
- `PresentialSale`
- `PickupToken`
- `OrganizationDiscipline`
- `Notification`
- `OrganizationLoyaltyAccount`
- `PointMovement`
- `StoreRewardOffering`
- `StoreRewardProduct`
- `PhysicalRewardRedemption`
- `DiscountBenefit`
- `WeeklyPlan`

## Campos clave nuevos/actualizados

### Organization
- `maxAdvanceDays` default 7.

### StoreOperatingHours
- `storeId`
- `dayOfWeek/dateOverride`
- `openAt`
- `digitalOrderCloseAt`
- `closeAt`

### Order
- `scheduledForDate`
- `promisedFrom`
- `promisedTo`
- `toleranceUntil`
- `noShowNoticeAt?`

### Payment
- `status`: PENDIENTE/APROBADO/RECHAZADO/REEMBOLSADO
- `expiresAt`: creación + 5 minutos

### DietaryRestriction
MVP inicial:
- `GLUTEN_FREE_SIN_TACC`
- `VEGETARIAN`
- `VEGAN`

### PointMovement
Movimientos inmutables/auditables.

---

# 8. Contratos de módulos

## Inventory Port

```text
checkAvailability()
reserveStock()
releaseReservation()
consumeReservedStock()
assignRecoveredUnit()
returnPackagedItemToStock()
```

## CocIA Port

```text
estimatePreparationTime()
findAvailablePickupWindow()
scheduleOperation()
replanOperation()
```

## Loyalty Port

```text
getOrganizationBalance()
awardPickupPoints()
spendPoints()
refundPoints()
getEligibleRewards()
```

## MenIA Tools

```text
getAvailableCatalog()
getCustomerProfile()
getRecommendations()
quoteOrder()
confirmOrder()
getLoyaltyBalance()
getEligibleRewards()
createPhysicalRedemption()
createTenPercentBenefit()
```

---

# 9. Arquitectura baseline

- Frontend: Next.js + React + TypeScript.
- Backend: Node.js + TypeScript, API modular.
- Persistencia: PostgreSQL gestionado + Prisma como baseline.
- Auth: servicio gestionado o adapter equivalente según ADR.
- MenIA: LLM gestionado + speech-to-text.
- CocIA: predictor desacoplado + scheduler determinístico.
- Async: event bus/queue gestionado.
- Observabilidad: logs, métricas, alertas, trazas.
- CI/CD: GitHub Actions.
- Arquitectura hexagonal / ports & adapters.

---

# 10. Reglas técnicas críticas

- Backend es autoridad funcional.
- RBAC + tenant scoping siempre en backend.
- Dinero no se maneja con float binario.
- Tiempo se abstrae mediante `Clock` para testear 5 min, 15 min, ventanas, tolerancias, 30 días y pedidos futuros.
- Timezone se toma del buffet/organización, no del navegador.
- Webhooks y operaciones críticas deben ser idempotentes.
- Stock/puntos/canjes usan transacciones de todo-o-nada.
- Pedidos conservan snapshots históricos de nombres/precios.
- No acceder a tablas de otro módulo evitando sus puertos/contratos.

---

# 11. Feature Branch Workflow

Ramas permanentes:

```text
main
 develop
```

Trabajo:

```text
feature/TDD-0007-order-reservation
feature/TDD-0016-rewards-benefits
```

Flujo:

```text
develop -> feature/* -> PR -> develop -> release PR -> main
```

- No commits directos en `main`/`develop`.
- No ramas permanentes por persona.
- PR cruzado obligatorio.
- CI verde antes del merge.
- Conventional Commits.

---

# 12. Criterio de cierre funcional

A partir de V2.0 no se reabre relevamiento general. Las nuevas dudas se resuelven solo si bloquean una feature/TDD concreto, se documenta la decisión y se continúa.
