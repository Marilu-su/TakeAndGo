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
| `DATABASE_URL` | Conexión a PostgreSQL | `postgresql://USER:PASSWORD@HOST:5432/takeandgo?sslmode=require` |

El archivo `.env` no se versiona. Nunca subir connection strings reales al repositorio.

## Base de datos de desarrollo

Cada integrante utiliza su propia base de datos de desarrollo. Lo que se comparte a través del repositorio son las **migraciones** y el **seed**, de modo que todas las bases tengan la misma estructura y los mismos datos iniciales.

Para crear una base gratuita en Neon:

1. Crear una cuenta en https://neon.tech y un proyecto nuevo.
2. En **Connect**, desactivar **Connection pooling** y copiar la connection string. Las migraciones de Prisma requieren conexión directa.
3. Pegarla en `DATABASE_URL` dentro de `.env`.

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
   npm run db:migrate -- --name agregar_organization
```

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