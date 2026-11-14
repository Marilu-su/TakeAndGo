# T04 — Auditoría frontend y 39 pantallas

Fecha inicial: 12/11/2026. Revisión documental: 13/11/2026.
Base productiva inspeccionada (BASE/develop): `54b84064dc393477ec197c202a5ebd8a48b56aa8`.
Fuente: [PANTALLAS V2.0](../reference/v2/PANTALLAS_V2_0.md).

## Método y límites

Se contrastaron individualmente los 39 IDs/nombres oficiales con rutas, componentes,
formularios, sesión, llamadas HTTP y contratos API localizados. Hay 11 archivos page.tsx
en BASE; una ruta puede representar varias pantallas y una pantalla puede ser un estado
operativo dentro de otra vista. No se infiere cumplimiento contando archivos.
Esta revisión es estática: no se ejecutaron nuevos tests frontend ni recorridos en navegador.
Las pruebas históricas de utilidades usan fetch simulado: no acreditan renderizado ni proveedor real.

Para las 39 entradas: recorrido autenticado = PENDIENTE_VALIDACION;
responsive = PENDIENTE_VALIDACION; accesibilidad = PENDIENTE_VALIDACION.
En pantallas ausentes o de ramas no integradas, esas verificaciones requieren primero
implementación/integración. CSS con auto-fit/clamp/flex-wrap y roles ARIA no prueban
responsive, foco, teclado ni lector de pantalla. No se certifica producción.

## Procedencia de evidencias

- BASE identifica código integrado de develop en el SHA indicado arriba. El commit
  documental 7c524db no implementa pantallas nuevas.
- PR89 identifica PR #89 según snapshot y rama `feature/C2-frontend-rutas-base`, SHA
  `7831234b2875c67c01daf81508b52e76e0e60b9b`. Sus archivos se inspeccionaron en ese
  objeto Git local; no forman parte de BASE. No se reconsultó el estado actual del PR.
- MENIA identifica rama `feature/C3-01-menia`, SHA
  `fae7add08f318e6a554947067328bdf3049bb1b4`. Su chat no está integrado en BASE.
- Rutas relativas de componentes parten de `apps/web/src/components/`; `app/` y `lib/`
  parten de `apps/web/src/`. Las rutas de navegador no equivalen a pruebas de despliegue.
- C = CUSTOMER mediante SessionShell; A = STORE_ADMIN/ORGANIZATION_ADMIN;
  S = roles operativos en PR89. LEr = loading/error de ResourceState y empty local.

## API frente a simulación

En BASE, lib/use-resource.ts usa sessionRequest; lib/session.ts obtiene token por
/api/auth/token y lib/api.ts hace fetch contra NEXT_PUBLIC_API_URL con Bearer y timeout.
AuthForm usa Neon Auth. No se localizaron datos simulados que sustituyan las listas
operativas en producción; carrito/selección son estado local derivado del catálogo API.
Una llamada HTTP existente no acredita conexión efectiva ni éxito con cuentas reales.
Los componentes ausentes no se cuentan como pantallas visuales con mocks.

MENIA usa context/messages por HTTP, pero
apps/api/src/modules/menia/infrastructure/deterministicResponder.ts: respond en esa rama
responde texto fijo y cards/actions vacíos. menia-chat.tsx no renderiza esas cards/acciones.
PR89 conecta sus componentes con endpoints de su rama; algunas rutas (QR/manual,
inicio/fin de cocina) ya existen en BASE, sin que ello integre su UI.

## Conteos de pantallas

- `PROBADO`: 0.
- `PARCIAL`: 12.
- `PENDIENTE_INTEGRACION`: 8.
- `NO_LOCALIZADO`: 17.
- `PENDIENTE_VALIDACION`: 2.

Total: 39. Se conservan todas las clasificaciones de la matriz anterior.

## Matriz oficial

| ID | Pantalla | Estado | Ruta / componente evidenciado | Endpoint / integración | Formularios y rol | Loading/empty/error | Brecha funcional / dependencia |
|---|---|---|---|---|---|---|---|
| 1 | Login | PARCIAL | BASE: /login; auth-form.tsx: AuthForm | BASE: Neon SDK signIn.email; token de sesión y GET /api/v1/me; llamadas reales en código, proveedor no recorrido | email/password HTML; público | local | Falta Olvidé mi contraseña y cuenta real validada; T08 |
| 2 | Registro | PARCIAL | BASE: /registro; auth-form.tsx: AuthForm(register) | BASE: Neon signUp.email y POST /api/v1/me/customer; llamadas reales en código, sin asociación obligatoria | nombre/email/password, sin código; público | local | Código inicial obligatorio ausente; alta puede quedar sin membresía; T08/T05 |
| 3 | Home global | PARCIAL | BASE: /buffets; app/(customer)/buffets/page.tsx: BuffetsPage; session-shell.tsx | BASE: GET/POST /api/v1/me/stores; llamadas HTTP autenticadas | código AAA999; C | LEr + submit | Falta organización visible y accesos perfil/preferencias; T05/T25 |
| 4 | Perfil / Preferencias | PENDIENTE_INTEGRACION | PR89: /perfil; customer-preferences.tsx: CustomerPreferences | PR89: GET/PATCH /api/v1/me/preferences; rutas API en la misma rama, no en BASE | C en PR; validación por revisar | PR89: ResourceState loading/error; carga de preferencias y submit/error/success; no recorrido | Faltan datos personales editables, preferencias por producto, exclusiones completas y rutina semanal; dieta/alergias solo en rama. Integrar y ejecutar con cuenta real; T02/T05 |
| 5 | Historial global | PARCIAL | BASE: /pedidos; order-view.tsx: OrdersList | BASE: GET /api/v1/orders; pedidos reales solicitados por HTTP, sin canjes/puntos | sin filtros; C | LEr | Sin filtros fecha/org/buffet/estado ni canjes/puntos/organización visible; T05/T25 |
| 6 | MenIA — contexto buffet | PENDIENTE_INTEGRACION | MENIA: /buffets/[storeId]/menia; menia-chat.tsx: MeniaChat/MeniaConversation; lib/menia.ts: createMeniaConversation | MENIA: GET /api/v1/stores/:id/menia/context y POST /api/v1/stores/:id/menia/messages; responder fijo sin LLM/cards/acciones | C; texto en rama | MENIA: ResourceState loading/error; conversación vacía, pendiente, error/reintento y acceso denegado; no recorrido | Organización mostrada por ID. Sin audio/STT, cards renderizadas, acciones de compra, LLM ni cierre digital. Responder de rama devuelve mensaje fijo y arrays vacíos; T01/T09/T17 |
| 7 | Catálogo dentro de MenIA | PARCIAL | BASE: /buffets/[storeId]/catalogo; catalog.tsx: StoreCatalog; product-picker.tsx: ProductPicker | BASE: GET /api/v1/stores/:id/catalog; filtro de disponibilidad del backend, no chat | búsqueda, cantidad, adicionales; C | LEr; agotados ocultos | Catálogo independiente del chat, header sin nombre de buffet/org; T13/T29 |
| 8 | Recomendaciones | NO_LOCALIZADO | No localizada en BASE. Búsqueda: catalog.tsx y MENIA menia-chat.tsx: sin cards de recomendaciones | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Filtros duros/ranking/máximo 4/ventana factible; T13 |
| 9 | Pedido programado | NO_LOCALIZADO | No localizada en BASE. Búsqueda: cart-panel.tsx y product-picker.tsx: sin selector de fecha/ventana | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | maxAdvanceDays, CocIA y horarios; T11/T15 |
| 10 | Confirmación de pedido | PARCIAL | BASE: /buffets/[storeId]/catalogo; cart-panel.tsx: CartPanel/place | BASE: POST /api/v1/orders; carrito local derivado del catálogo API, sin cotización previa ni pago | review estructurado, enteros; C | submit/error; carrito vacío | Faltan fecha/ventana, cotización backend previa y acceso a pago. Permite volver al carrito/quitar productos, sin botón explícito Cancelar propuesta; T15 |
| 11 | Pago | NO_LOCALIZADO | No localizada en BASE. Búsqueda: cart-panel.tsx: place crea reserva, declara pagos para otra etapa | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Sin pasarela, contador 5:00 ni outcomes; T14/T15 |
| 12 | Seguimiento | PARCIAL | BASE: /pedidos/[id]; order-view.tsx: OrderDetail/cancel | BASE: GET /api/v1/orders/:id y POST /api/v1/orders/:id/cancel; polling 30 s | confirmación de cancelación; C | LEr + submit | Texto de estado, sin stepper completo/ventana; T15/T25 |
| 13 | Avisar que no podré retirar | NO_LOCALIZADO | No localizada en BASE. Búsqueda: order-view.tsx: OrderDetail, sin acción de aviso | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Confirmación y límite antes de ventana; T22/T25 |
| 14 | Retraso CocIA | NO_LOCALIZADO | No localizada en BASE. Búsqueda: order-view.tsx: OrderDetail, sin banner de replanificación | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | CocIA y notificaciones; T20/T24/T25 |
| 15 | Para retirar | PENDIENTE_INTEGRACION | PR89: /pedidos/[id]; order-view.tsx: OrderDetail/issuePickup | UI solo PR89: POST /api/v1/orders/:id/pickup/qr y /pickup/manual; endpoints presentes en BASE, no UI QR | C en PR | PR89: carga/error del pedido; generación busy/error; QR/código emitido; expiración solo texto, no recorrido | issuePickup solo aparece para READY_FOR_PICKUP y renderiza react-qr-code o código manual; muestra expiresAt del QR, no ventana/tolerancia del pedido. Falta probar generación, lectura, expiración, cambio de estado y vigencia operativa autenticados; T02/T19/T25 |
| 16 | Puntos en MenIA | NO_LOCALIZADO | No localizada en BASE. Búsqueda: MENIA menia-chat.tsx y lib/menia.ts: sin saldo ni botones de canje | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Saldo organizacional y propuesta; T21/T26 |
| 17 | Recompensas elegibles | NO_LOCALIZADO | No localizada en BASE. Búsqueda: catalog.tsx y MENIA menia-chat.tsx: sin catálogo de recompensas | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Saldo/oferta/stock/beneficio activo; T21/T27/T28 |
| 18 | Canje físico | NO_LOCALIZADO | No localizada en BASE. Búsqueda: cart-panel.tsx y product-picker.tsx: sin selección/confirmación de canje | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Puntos+stock+ventana atómicos; T27 |
| 19 | Canje físico activo | NO_LOCALIZADO | No localizada en BASE. Búsqueda: order-view.tsx: OrdersList/OrderDetail, sin vista de canje activo | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Estado/QR/leyenda no puntos; T25/T27 |
| 20 | Café canjeado | NO_LOCALIZADO | No localizada en BASE. Búsqueda: order-view.tsx y PR89 kitchen-queue.tsx: sin validación de llegada/café | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Preparación al llegar; T27 |
| 21 | Beneficio 10% | NO_LOCALIZADO | No localizada en BASE. Búsqueda: cart-panel.tsx y order-view.tsx: sin beneficio/aplicación/vigencia | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Vigencia/aplicación/consumo/restauración; T28/T25 |
| 22 | Organización bloqueada | NO_LOCALIZADO | No localizada en BASE. Búsqueda: session-shell.tsx y order-view.tsx: sin modo bloqueado por organización | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Solo lectura por organización; T22/T25 |
| 23 | Cola CocIA | PENDIENTE_INTEGRACION | PR89: /cocina; kitchen-queue.tsx: KitchenQueue/transition | PR89: GET /api/v1/stores/:id/kitchen/orders; POST /kitchen/orders/:orderId/start y /finish ya existen en BASE | S en PR | PR89: loading/error/cola vacía; errores start/finish; no validación visual | Solo lista pedidos CONFIRMED/PREPARING con promisedFrom opcional e inicio/fin. Sin prioridad/estimación CocIA, recommendedStartAt, canjes ni ventas presenciales; T02/T12/T18 |
| 24 | Venta presencial | NO_LOCALIZADO | No localizada en BASE. Búsqueda: PR89 kitchen-queue.tsx: solo pedidos, sin formulario de venta presencial | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Consumo inmediato/carga cocina; T18 |
| 25 | Escaneo QR | PENDIENTE_INTEGRACION | PR89: /cocina; kitchen-queue.tsx: KitchenQueue/confirmPickup | PR89: POST /api/v1/stores/:id/pickup/orders/:orderId/confirm con credential QR; endpoint en BASE | credencial; S en PR | PR89: Validando, éxito/error genéricos; sin estados de cámara ni resumen de operación | confirmPickup interpreta JSON pegado/ingresado en un input; no se localizó getUserMedia, cámara ni decoder. Lector externo que escriba en el campo no probado. Confirma y muestra éxito/error genérico; falta mostrar operación a entregar y validar lectura real; T19 |
| 26 | Retiro manual | PENDIENTE_INTEGRACION | PR89: /cocina; kitchen-queue.tsx: KitchenQueue/confirmPickup | PR89: POST /api/v1/stores/:id/pickup/by-code seguido de /pickup/orders/:orderId/confirm; endpoints en BASE | input QR/código; S en PR89; sin resumen previo | PR89: Validando, éxito/error; sin resumen previo ni confirmación separada | confirmPickup consulta by-code y envía confirm inmediatamente: no presenta resumen previo ni segundo paso de confirmación humana. Solo informa éxito/error; falta integrar vista previa y verificar vigencia y permisos con cuentas reales; T02/T19 |
| 27 | Retiro combinado | NO_LOCALIZADO | No localizada en BASE. Búsqueda: order-view.tsx y PR89 kitchen-queue.tsx: sin card de retiro combinado | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Mantener operaciones separadas; T19/T27 |
| 28 | Dashboard buffet | PARCIAL | BASE: /admin; app/(store-admin)/admin/page.tsx: AdminPage (STORE_ADMIN) | BASE: GET /api/v1/me y enlaces a catálogo/stock; solo estructura de accesos, sin API de KPIs | A; rama STORE_ADMIN | Sin KPIs | No mide pedidos/ventas/carga/no retiros/desperdicio; T30 |
| 29 | Configuración inicial | NO_LOCALIZADO | No localizada en BASE. Búsqueda: organization-admin.tsx y app/(store-admin)/admin/page.tsx: sin setup operativo | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | PENDING_SETUP no equivale a setup funcional; T06 |
| 30 | Categorías | PENDIENTE_VALIDACION | BASE: /admin/catalogo; catalog-admin.tsx: CatalogAdmin (categories) | BASE: GET/POST /api/v1/stores/:id/categories; PATCH /categories/:categoryId; POST /categories/:categoryId/deactivate | nombre+confirmación; STORE_ADMIN | LEr + submit | CRUD conectado en código, falta prueba UI autenticada; T34 |
| 31 | Productos | PENDIENTE_VALIDACION | BASE: /admin/catalogo; catalog-admin.tsx: CatalogAdmin (products) | BASE: GET/POST /api/v1/stores/:id/products; PATCH /products/:productId; POST /products/:productId/deactivate | categoría/precio entero/tiempo; STORE_ADMIN | LEr + submit | Validar edición real y snapshots históricos; T34 |
| 32 | Adicionales | PARCIAL | BASE: /admin/catalogo; catalog-admin.tsx: CatalogAdmin/ProductAdditions (additions) | BASE: GET/POST /api/v1/stores/:id/additions; PATCH y POST deactivate; GET/PUT /products/:productId/additions | precio+confirmación; STORE_ADMIN | LEr + submit | Sin extra de preparación configurable ni gestión completa stock; T06/T07 |
| 33 | Stock | PARCIAL | BASE: /admin/stock; stock-view.tsx: StockView | BASE: GET /api/v1/stores/:id/stock; PR89 agrega PUT en esa ruta para ajuste con motivo | lectura, STORE_ADMIN | LEr | BASE solo consulta disponible/reservado. PR89 permite fijar disponible con motivo; no equivale a flujo de restock separado ni vista de movimientos. Falta trazabilidad completa y recorrido autenticado; T02/T07 |
| 34 | Empleados | PENDIENTE_INTEGRACION | PR89: /admin; store-staff-admin.tsx: StoreStaffAdmin/assign | PR89: POST /api/v1/stores/:id/staff con email y STORE_EMPLOYEE; no listado ni baja UI; BASE solo script de asignación | email de cuenta existente; STORE_ADMIN en PR89; sin listado/baja | PR89: Habilitando, éxito/error; no lista ni empty de empleados | StoreStaffAdmin asigna por email una cuenta existente y reemplaza el rol anterior; no crea la cuenta ni muestra listado o desactivación. Esas funciones no se localizaron en el componente PR89. Falta completar/integrar y comprobar scopes y reemplazos; T02/T10 |
| 35 | Recompensas del buffet | NO_LOCALIZADO | No localizada en BASE. Búsqueda: catalog-admin.tsx y app/(store-admin)/admin/page.tsx: sin formulario de recompensas | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Tipos/costos readonly, hasta 2 productos; T27/T30 |
| 36 | Dashboard organización | PARCIAL | BASE: /admin; organization-admin.tsx: OrganizationAdmin | BASE: GET/POST /api/v1/organizations/:id/stores y POST /api/v1/stores/:id/deactivate; sin API de KPIs | ORGANIZATION_ADMIN | LEr | Hay listado/altas/bajas, sin KPIs consolidados ni sanciones; T30 |
| 37 | Buffets | PARCIAL | BASE: /admin; organization-admin.tsx: OrganizationAdmin/create/deactivate | BASE: GET/POST /api/v1/organizations/:id/stores y POST /api/v1/stores/:id/deactivate; PR89 agrega POST /api/v1/organizations/:id/staff | nombre/código+confirmación; ORGANIZATION_ADMIN | LEr + submit | BASE crea/desactiva buffets. Asignación/reemplazo de administrador solo PR89 mediante formulario de email/buffet/rol; falta integrar y verificar alcance organizacional con cuentas reales; T02/T10 |
| 38 | Configuración organización | PENDIENTE_INTEGRACION | PR89: /admin; organization-admin.tsx: OrganizationAdmin/saveAdvanceDays | PR89: GET/PATCH /api/v1/organizations/:id/settings; BASE tiene caso de uso maxAdvanceDays pero no esta UI/ruta HTTP | ORGANIZATION_ADMIN en PR | PR89: loading/error settings y submit/éxito/error; sin recorrido | PR89 usa formulario de días (default UI 7, límites UI 1–30). Falta validar límites efectivos backend/persistencia y su aplicación al crear pedidos; no acredita pedido programado; T02/T10/T11 |
| 39 | Sanciones | NO_LOCALIZADO | No localizada en BASE. Búsqueda: organization-admin.tsx y app/(store-admin)/admin/page.tsx: sin sanciones/rehabilitación | Sin pantalla funcional ni llamada API específica integrada para esta función; no es una vista implementada con datos simulados | — | — | Strikes/warnings/bloqueo por organización; T22/T30 |

## Los 13 estados visuales obligatorios

PRESENTE_EN_CODIGO no significa probado visualmente ni disponible en las 39 pantallas.

| Estado obligatorio | Diagnóstico | Evidencia de código / búsqueda | Pendiente |
|---|---|---|---|
| loading | PRESENTE_EN_CODIGO | resource-state.tsx: ResourceState; lib/use-resource.ts; SessionShell verifica sesión | Validar renderizado/recuperación en cada ruta existente y luego en las ausentes. |
| empty | PRESENTE_EN_CODIGO | BuffetsPage, OrdersList, StoreCatalog, CatalogAdmin, StockView, OrganizationAdmin | No acreditado universalmente; PR89 cola vacía y MENIA conversación vacía solo en sus ramas. |
| error | PRESENTE_EN_CODIGO | ResourceState y estados locales de AuthForm, CartPanel, CatalogAdmin, OrderDetail | Validar errores de red/permisos, reintentos, foco y mensajes accesibles. |
| sin stock | PARCIAL | StoreCatalog muestra catálogo vacío; backend StockCatalogAvailability filtra agotados; CartPanel muestra error de API | No distingue siempre producto agotado exacto; sin balance se considera sin control; falta flujo conversacional. |
| sin horario disponible | NO_LOCALIZADO | Sin selector/ventana en CartPanel y ProductPicker | Faltan alternativas y mensaje ante imposibilidad horaria. |
| pago pendiente (5 min) | NO_LOCALIZADO | OrderDetail muestra reservedUntil como texto, sin contador ni checkout | No equivale al estado de pago pendiente con máximo 5:00. |
| pago rechazado | NO_LOCALIZADO | Sin pantalla/componente de pago en BASE | Falta resultado de pasarela y recuperación de la propuesta. |
| pago reembolsado | NO_LOCALIZADO | Sin pantalla/componente de pago en BASE | Falta mensaje y trazabilidad visible de reembolso. |
| MenIA durmiendo | NO_LOCALIZADO | Sin MenIA integrada; rama MENIA no implementa cierre digital | Falta bloqueo por horario con navegación restante disponible. |
| CocIA fallback | NO_LOCALIZADO | Sin indicador ni predictor/fallback integrado | Falta informar operación con fallback determinístico. |
| usuario bloqueado/solo visualización | NO_LOCALIZADO | SessionShell verifica rol/sesión, no sanción organizacional | Falta conservar lectura y deshabilitar transacciones por organización. |
| beneficio vencido | NO_LOCALIZADO | Sin vista de beneficios en CartPanel/OrderDetail | Falta vencimiento visible y acciones coherentes. |
| recompensa no disponible | NO_LOCALIZADO | Sin vista de recompensas integrada | Falta manejo de elegibilidad/stock y pérdida de disponibilidad. |

Resumen: 3 presentes en código con validación visual pendiente, 1 parcial y 9 no
localizados como flujos completos integrados. Las ausencias de negocio no se
consideran estados aprobados por no existir todavía su pantalla.

## Hallazgos y próximas verificaciones

15: PR89 genera QR/manual solo para READY_FOR_PICKUP, sin ventana/tolerancia visible.
25: input de JSON/token no demuestra cámara ni lector real; falta operación a entregar.
26: by-code seguido de confirm automático no cumple resumen previo y confirmación humana.
34: habilitación por email de cuenta existente no equivale a listado/creación de cuenta/baja.
Registro carece de código buffet; login carece de recuperación. Los dashboards son
accesos/listados sin KPIs; el carrito crea reserva sin fecha/ventana ni pago.
Integrar ramas no resuelve automáticamente sus brechas. Faltan recorridos CUSTOMER,
STORE_EMPLOYEE, STORE_ADMIN y ORGANIZATION_ADMIN con cuentas reales y scopes distintos.

## Protección frente a regeneración

build_matrices.py genera exclusivamente T04-MATRIZ-CUMPLIMIENTO.md desde
rn-cumplimiento.json y Master V2.0; no genera ni escribe este informe de pantallas.
Su modo --check valida solo RN y no certifica las 39 pantallas. Por ello no hay
segunda fuente generada que pueda restaurar evaluaciones antiguas de esta matriz.
Este informe se mantiene manualmente; cobertura/nombres/estados se contrastan con
PANTALLAS_V2_0.md. No se alteraron el generador ni las evaluaciones RN en esta etapa.
