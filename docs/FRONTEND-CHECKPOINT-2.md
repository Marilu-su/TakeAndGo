# Frontend Checkpoint 2 — entrega y demostración

Fecha: 5 de noviembre de 2026. Rama: `feature/C2-frontend-rutas-base`.

## Actualización de integración — 9 de noviembre de 2026

Se incorpora `develop` en `b322e8d` con los módulos backend de cocina y retiro, preservando la autorización de pedidos, catálogo con stock real y transacciones de reservas/cancelaciones de esta rama. Las respuestas generales de pedidos no exponen códigos de retiro, incluido el historial. Esto no agrega pantallas de cocina o retiro al frontend.

Se aplicaron las migraciones versionadas pendientes y se ejecutaron 329 pruebas backend: 326 aprobadas, 0 fallidas y 3 omitidas. TypeScript frontend y sus 13 pruebas pasan. La comprobación de tipos del código versionado del backend pasa al excluir únicamente el test local sin seguimiento mencionado abajo; el comando estándar conserva ese bloqueo local. El recorrido autenticado por roles continúa pendiente. El detalle original siguiente corresponde al cierre del 5 de noviembre.

## Alcance implementado

- Sesión Neon Auth: formularios de registro/login, logout, token por solicitud, alta de Customer y autorización basada en el Actor de la API.
- Inicio con accesos, buffets asociados, asociación por código y selección mediante navegación al catálogo del buffet.
- Catálogo real agrupado por categoría, búsqueda, precios, descripciones y adicionales disponibles.
- Administración por rol: organización lista/crea/desactiva buffets; STORE_ADMIN gestiona categorías, productos, adicionales y su asociación.
- Carrito en memoria por pantalla/buffet con variantes, cantidades y resumen estimado; la API calcula los precios definitivos.
- Creación, historial, detalle y cancelación de reservas propias. Creación/reserva y cancelación/liberación son transaccionales; hay pruebas de concurrencia y rollback.
- Stock disponible/reservado para el administrador; agotados ocultos del catálogo. Un registro de stock ausente mantiene el comportamiento previo de stock sin control.
- Estados de carga, vacío y error, formularios con validación, confirmaciones y estilos adaptables.

## Contratos consumidos

Todas las rutas de negocio llevan prefijo `/api/v1` y JWT:

| Área | Endpoints |
| --- | --- |
| Identidad | GET `/me`, POST `/me/customer` |
| Buffets del cliente | GET y POST `/me/stores` |
| Catálogo | GET `/stores/:storeId/catalog` |
| Organización | GET y POST `/organizations/:organizationId/stores`, POST `/stores/:storeId/deactivate` |
| Categorías | GET/POST `/stores/:storeId/categories`, PATCH `.../:id`, POST `.../:id/deactivate` |
| Productos | GET/POST `/stores/:storeId/products`, PATCH `.../:id`, POST `.../:id/deactivate` |
| Adicionales | GET/POST `/stores/:storeId/additions`, PATCH `.../:id`, POST `.../:id/deactivate` |
| Adicionales de producto | GET/PUT `/stores/:storeId/products/:productId/additions` |
| Pedidos | POST/GET `/orders`, GET `/orders/:id`, POST `/orders/:id/cancel` |
| Stock | GET `/stores/:storeId/stock` |

Next.js delega `/api/auth/*` al SDK oficial de Neon. `/health` conserva el diagnóstico de conectividad.

## Ejecución

1. Instalar dependencias con `npm ci` dentro de `apps/api` y `apps/web`.
2. Configurar `apps/api/.env` según `.env.example`: DATABASE_URL, NEON_AUTH_URL, PORT=3001 y CORS_ORIGIN=http://localhost:3000.
3. Configurar `apps/web/.env.local`: NEXT_PUBLIC_API_URL=http://localhost:3001, NEON_AUTH_BASE_URL del mismo entorno y NEON_AUTH_COOKIE_SECRET aleatorio de al menos 32 caracteres. No versionar valores reales.
4. Aplicar las migraciones aprobadas con `npm run db:deploy` desde `apps/api`.
5. Ejecutar `npm run dev` en cada aplicación. Abrir http://localhost:3000.
6. Para producción frontend: `npm run build -- --webpack` y `npm start`. Webpack se usó para evitar el fallo de inicio del proceso CSS de Turbopack observado en este equipo.

Los roles de staff se asignan por el procedimiento existente del backend (`apps/api/scripts/assign-staff-role.ts`); no se permite elegir el rol en el navegador.

## Recorrido de demostración

1. Ingresar como STORE_ADMIN de un buffet ACTIVE preparado: crear categoría, producto y adicional, asociar el adicional y comprobar stock.
2. Registrar o ingresar como Customer; completar el perfil si hace falta.
3. Asociar el buffet por código, abrir su catálogo, seleccionar cantidades y adicionales y revisar el resumen.
4. Confirmar la reserva, abrir Mis pedidos y consultar el detalle. El importe definitivo viene de la API.
5. Comprobar stock reservado desde la cuenta de administrador; cancelar la reserva desde el cliente y actualizar stock/catálogo.
6. Comprobar rechazo de rutas con otro rol o buffet. Cerrar sesión y abrir una ruta protegida.
7. Ingresar como ORGANIZATION_ADMIN para listar/crear/desactivar buffets. Los nuevos quedan PENDING_SETUP según el contrato existente.

## Verificación y límites

- Frontend: ESLint y TypeScript correctos; 13 pruebas unitarias de HTTP, dinero, carrito y sesión exitosas.
- Build de producción Webpack verificado; repetir después de cualquier cambio.
- Backend: 256 pruebas exitosas y 2 omitidas que requieren PostgreSQL local. Se ejecutó integración real de reservas concurrentes, rollback, cancelación y disponibilidad del catálogo.
- `npm run typecheck` del backend falla por `apps/api/src/modules/customer/application/associateCustomerToStore.test.ts`, archivo ajeno sin seguimiento que se conserva intacto y fuera de los commits.
- Se revisaron login y registro en navegador y se comprobó que `/buffets` sin sesión redirige al login. Se completó el secreto de cookies en el entorno local ignorado por Git; `/api/auth/token` devuelve 401 sin sesión, como corresponde. El recorrido completo de registro/login con Neon, cookies/JWT en navegador y operaciones por cada rol queda pendiente de una cuenta de demostración y validación humana. Las pruebas de contratos no equivalen a esa validación.
- No se encontraron MASTER, PANTALLAS_V2_0, TDD de funcionalidades ni consigna TPI en el repositorio. La correspondencia exacta con esas especificaciones debe contrastarse con el equipo.
- No hay contrato de edición/activación de buffets ni interfaz de ajuste manual de stock en esta entrega. Preparar un buffet ACTIVE y stock con las herramientas existentes del backend.
- El carrito no persiste al recargar. No hay actualización en tiempo real: pedidos y stock se actualizan con el botón correspondiente.
- Pagos, compensaciones, cocina, preparación, entrega, QR y retiro quedan fuera de esta entrega. El seguimiento llega hasta la reserva; no se presenta como circuito de compra completo.
- Pendientes de defensa: validación humana por roles, contraste con las especificaciones faltantes y revisión del equipo de los cambios transaccionales de pedidos.

## Archivos principales

Frontend: `src/components/auth-form.tsx`, `session-shell.tsx`, `stock-view.tsx`, componentes de catálogo/administración/pedidos; páginas de `src/app`; `src/lib/api.ts`, `session.ts`, `cart.ts` y `auth/`; pruebas en `apps/web/test`.
Backend: adaptadores HTTP de Customer, organización, pedidos y stock; composición de catálogo con disponibilidad real; repositorio/transacciones de reservas; pruebas HTTP e integración PostgreSQL. Decisiones en `AI-DECISIONS.md`.

## Commits funcionales

- 4cc306d: sesión Neon Auth.
- b5ce582: buffets y asociación por código.
- d4edd1d: catálogo real.
- 936d35a: administración de buffets.
- 68a59f1: gestión de catálogo.
- 0e4d08b: carrito.
- c34dc5b: pedidos y reservas seguras.
- e76d919: stock y disponibilidad real.

Se conservan los tres commits iniciales 749dea3, a62b36b y 78ccbd2. La publicación se realiza en la rama feature; el PR y su merge corresponden a Luana.
