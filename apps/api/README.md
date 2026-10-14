# Take&Go — API

Backend de Take&Go, desarrollado con Node.js, TypeScript y Express. Utiliza PostgreSQL como base de datos y Prisma ORM 7 como capa de acceso a datos.

## Requisitos

- Node.js 22 o superior
- npm
- Una base de datos PostgreSQL (local o gestionada, por ejemplo Neon)

## Configuración

Todos los comandos se ejecutan desde `apps/api`.

1. Instalar dependencias:

```bash
   npm install
```

   Al finalizar, se ejecuta automáticamente `prisma generate`, que genera el cliente de Prisma en `src/generated/prisma`. Esa carpeta no se versiona.

2. Crear el archivo de variables de entorno a partir del ejemplo:

```bash
   cp .env.example .env
```

   En Windows (PowerShell): `Copy-Item .env.example .env`

3. Completar `DATABASE_URL` en `.env` con la conexión a tu base de datos.

## Variables de entorno

| Variable | Descripción | Ejemplo |
| --- | --- | --- |
| `PORT` | Puerto del servidor | `3001` |
| `CORS_ORIGIN` | Origen permitido para CORS (URL del frontend) | `http://localhost:3000` |
| `DATABASE_URL` | Conexión a PostgreSQL | `postgresql://USER:PASSWORD@HOST:5432/takeandgo?sslmode=verify-full` |

El archivo `.env` no se versiona. Nunca subir connection strings reales al repositorio.

## Base de datos de desarrollo

Cada integrante utiliza su propia base de datos de desarrollo. Lo que se comparte a través del repositorio son las **migraciones** y el **seed**, de modo que todas las bases tengan la misma estructura y los mismos datos iniciales.

Para crear una base gratuita en Neon:

1. Crear una cuenta en https://neon.tech y un proyecto nuevo.
2. En **Connect**, desactivar **Connection pooling** y copiar la connection string. Las migraciones de Prisma requieren conexión directa.
3. Pegarla en `DATABASE_URL` dentro de `.env`, reemplazando `sslmode=require` por `sslmode=verify-full` (mantiene la verificación del certificado y evita el aviso de seguridad de `pg`).

## Comandos de base de datos

| Comando | Descripción |
| --- | --- |
| `npm run db:migrate` | Crea y aplica migraciones en desarrollo |
| `npm run db:deploy` | Aplica las migraciones existentes sin crear nuevas (producción) |
| `npm run db:seed` | Carga los datos iniciales |
| `npm run db:generate` | Regenera el cliente de Prisma |
| `npm run db:studio` | Abre Prisma Studio para inspeccionar los datos |

### Preparar una base desde cero

```bash
npm run db:deploy
npm run db:seed
```

### Modificar el modelo de datos

1. Editar `prisma/schema.prisma`.
2. Crear la migración con un nombre descriptivo:

```bash
   npx prisma migrate dev --name agregar_organization
```

   En PowerShell no usar `npm run db:migrate -- --name ...`: PowerShell descarta el `--` y Prisma termina pidiendo el nombre de forma interactiva.

3. Versionar el cambio en `schema.prisma` junto con la carpeta generada en `prisma/migrations`.

No modificar migraciones que ya fueron integradas a `develop`: cada cambio se agrega como una migración nueva.

## Acceso a la base desde el código

El backend accede a la base exclusivamente mediante el cliente compartido:

```ts
import { getPrisma } from './infrastructure/database/prisma';
```

No crear instancias propias de `PrismaClient` ni conexiones directas a PostgreSQL.

## Ejecución

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Compila a JavaScript en `dist` |
| `npm start` | Ejecuta la versión compilada |
| `npm test` | Ejecuta los tests |
| `npm run typecheck` | Verifica tipos sin compilar |

## Health check

`GET /health` responde siempre `200` con `status: "ok"` mientras la API esté disponible, e informa el estado de la base de datos en el campo `database`:

```json
{
  "status": "ok",
  "service": "take-and-go-api",
  "database": "ok",
  "timestamp": "2026-10-07T23:56:35.760Z"
}
```

`database` vale `"error"` si la base no responde dentro de 3 segundos o si `DATABASE_URL` no está configurada.

## Endpoints

### Organización y buffets

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/v1/organizations/:organizationId/stores` | Crea un buffet en la organización (solo ORGANIZATION_ADMIN de esa organización) |

Cuerpo:

```json
{
  "name": "Buffet Sistemas",
  "code": "SIS001"
}
```

| Código | Caso |
| --- | --- |
| `201` | Buffet creado, en estado `PENDING_SETUP` |
| `400` | Faltan `name` o `code` (`INVALID_REQUEST`) |
| `401` | Usuario no autenticado (`UNAUTHENTICATED`) |
| `403` | El usuario no administra esa organización (`FORBIDDEN`) |
| `404` | La organización no existe (`ORGANIZATION_NOT_FOUND`) |
| `409` | El código ya existe (`STORE_CODE_ALREADY_EXISTS`) |
| `422` | Código o nombre inválidos (`INVALID_STORE_CODE`, `INVALID_STORE_NAME`) |

### Categorías

Solo el administrador del buffet (STORE_ADMIN) puede administrar sus categorías.

Dentro de un mismo buffet no puede haber dos categorías **activas** con el mismo nombre. La comparación no distingue mayúsculas de minúsculas e ignora los espacios al principio y al final ("Bebidas", "bebidas" y " BEBIDAS " son el mismo nombre). Las categorías desactivadas no cuentan: al desactivar una categoría, su nombre queda libre para una nueva. Buffets diferentes pueden usar los mismos nombres.

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/v1/stores/:storeId/categories` | Crea una categoría (cuerpo: `{ "name": "Bebidas" }`) |
| `GET` | `/api/v1/stores/:storeId/categories` | Lista todas las categorías del buffet, activas e inactivas |
| `PATCH` | `/api/v1/stores/:storeId/categories/:categoryId` | Renombra una categoría (cuerpo: `{ "name": "Bebidas frías" }`) |
| `POST` | `/api/v1/stores/:storeId/categories/:categoryId/deactivate` | Desactiva una categoría sin borrarla |

| Código | Caso |
| --- | --- |
| `200` / `201` | Operación exitosa |
| `400` | Falta `name` (`INVALID_REQUEST`) |
| `401` | Usuario no autenticado (`UNAUTHENTICATED`) |
| `403` | El usuario no administra ese buffet (`FORBIDDEN`) |
| `404` | El buffet o la categoría no existen (`STORE_NOT_FOUND`, `CATEGORY_NOT_FOUND`) |
| `409` | Ya existe una categoría activa con ese nombre en el buffet (`CATEGORY_NAME_ALREADY_EXISTS`) |
| `422` | Nombre inválido (`INVALID_CATEGORY_NAME`) |

### Productos

Solo el administrador del buffet (STORE_ADMIN) puede administrar sus productos. Los precios se expresan en **centavos** como números enteros (por ejemplo, `150000` = $1.500) para evitar errores de redondeo. El tiempo base de preparación se expresa en **segundos**.

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/v1/stores/:storeId/products` | Crea un producto |
| `GET` | `/api/v1/stores/:storeId/products` | Lista los productos del buffet, activos e inactivos |
| `PATCH` | `/api/v1/stores/:storeId/products/:productId` | Modifica uno o más campos de un producto |
| `POST` | `/api/v1/stores/:storeId/products/:productId/deactivate` | Desactiva un producto sin borrarlo |
| `GET` | `/api/v1/stores/:storeId/products/:productId/additions` | Lista los adicionales configurados para el producto |
| `PUT` | `/api/v1/stores/:storeId/products/:productId/additions` | Reemplaza la lista de adicionales del producto |

Cuerpo para crear un producto (`description` es opcional):

```json
{
  "categoryId": "id-de-la-categoria",
  "name": "Café con leche",
  "description": "Taza grande",
  "priceCents": 150000,
  "basePreparationSeconds": 120
}
```

Cuerpo para configurar adicionales (una lista vacía quita todos):

```json
{
  "additionIds": ["id-adicional-1", "id-adicional-2"]
}
```

La categoría y los adicionales deben pertenecer al mismo buffet que el producto. Esta regla también está garantizada por la base de datos mediante claves foráneas compuestas. Configurar adicionales es una operación atómica: si algún adicional es inválido, no se guarda ningún cambio.

### Adicionales

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/v1/stores/:storeId/additions` | Crea un adicional (cuerpo: `{ "name": "Queso", "priceCents": 30000 }`) |
| `GET` | `/api/v1/stores/:storeId/additions` | Lista los adicionales del buffet, activos e inactivos |
| `PATCH` | `/api/v1/stores/:storeId/additions/:additionId` | Modifica el nombre o el precio |
| `POST` | `/api/v1/stores/:storeId/additions/:additionId/deactivate` | Desactiva un adicional sin borrarlo |

El tiempo extra de preparación por adicional no se configura en cada adicional: es un único valor por buffet (30 segundos por defecto), que se incorporará junto con los parámetros de planificación de cocina.

### Errores de productos y adicionales

| Código | Caso |
| --- | --- |
| `400` | Faltan campos, tienen un tipo incorrecto o la modificación no indica ningún campo (`INVALID_REQUEST`) |
| `401` | Usuario no autenticado (`UNAUTHENTICATED`) |
| `403` | El usuario no administra ese buffet (`FORBIDDEN`) |
| `404` | El buffet, el producto o el adicional no existen (`STORE_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `ADDITION_NOT_FOUND`) |
| `422` | Nombre, precio o tiempo inválidos (`INVALID_PRODUCT_NAME`, `INVALID_ADDITION_NAME`, `INVALID_PRICE`, `INVALID_PREPARATION_TIME`), o categoría o adicional de otro buffet (`INVALID_CATEGORY_SCOPE`, `INVALID_ADDITION_SCOPE`) |

### Catálogo del buffet

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/v1/stores/:storeId/catalog` | Devuelve el catálogo del buffet tal como lo ve el cliente |

El catálogo agrupa los productos por categoría e incluye, para cada producto, su precio base, su tiempo de preparación y sus adicionales con el precio de cada uno. Solo muestra lo que se puede pedir:

- categorías, productos y adicionales **activos** (una categoría desactivada oculta todos sus productos);
- productos y adicionales **con disponibilidad**;
- categorías que tengan al menos un producto para mostrar.

```json
{
  "storeId": "id-del-buffet",
  "categories": [
    {
      "id": "id-categoria",
      "name": "Bebidas",
      "products": [
        {
          "id": "id-producto",
          "name": "Café con leche",
          "description": null,
          "priceCents": 150000,
          "basePreparationSeconds": 120,
          "additions": [
            { "id": "id-adicional", "name": "Leche de almendras", "priceCents": 50000 }
          ]
        }
      ]
    }
  ]
}
```

**Quién puede verlo:**

| Rol | Acceso |
| --- | --- |
| CUSTOMER | Si está asociado al buffet |
| STORE_EMPLOYEE / STORE_ADMIN | Si pertenece a ese buffet |
| ORGANIZATION_ADMIN y otros | No (`403`) |

**Disponibilidad provisoria:** hasta que exista el módulo de stock, todos los productos y adicionales activos se consideran disponibles (`AllAvailableCatalogAvailability`). El módulo de stock debe reemplazarla implementando `CatalogAvailabilityPort`.

**Uso desde otros módulos:** pedidos y MenIA deben obtener el catálogo mediante `getStoreCatalog` de `catalogModule`, sin acceder a las tablas del catálogo.

**Autenticación pendiente:** las reglas de autorización están implementadas y testeadas, pero todavía no existe la autenticación. Hasta entonces, el resolver de actor (`src/shared/http/actorResolver.ts`) no identifica a ningún usuario y los endpoints protegidos responden `401`.