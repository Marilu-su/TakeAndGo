# Take&Go — Frontend

Aplicación web de Take&Go, desarrollada con Next.js y TypeScript.

En el Checkpoint 1, la página principal verifica la comunicación con el backend consultando el endpoint `GET /health`, según lo definido en `docs/architecture/CHK1-INTEGRATION-CONTRACT.md`.

## Requisitos

- Node.js 20 o superior
- npm

## Configuración

Todos los comandos se ejecutan desde `apps/web`.

1. Instalar dependencias:

```bash
   npm install
```

2. Crear el archivo de variables de entorno a partir del ejemplo:

```bash
   cp .env.example .env.local
```

   En Windows (PowerShell): `copy .env.example .env.local`

3. Ajustar los valores de `.env.local` si es necesario.

## Variables de entorno

| Variable | Descripción | Ejemplo |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | URL base del backend, sin barra final | `http://localhost:3001` |

El archivo `.env.local` no se versiona. En producción, las variables se configuran desde la plataforma de despliegue.

Las variables `NEXT_PUBLIC_*` se incorporan al código durante el build: si se modifica su valor en producción, es necesario volver a desplegar.

## Ejecución local

```bash
npm run dev
```

La aplicación queda disponible en http://localhost:3000.

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Ejecuta el build de producción |
| `npm run lint` | Análisis estático con ESLint |

## Estado del sistema

La página principal muestra el estado del backend:

- 🟡 **Consultando:** la solicitud está en curso.
- 🟢 **Backend operativo:** `GET /health` respondió `{ "status": "ok" }`.
- 🔴 **Backend no disponible:** error de conexión, timeout (5 segundos), código HTTP distinto de 2xx o respuesta inesperada.

Si el backend incluye el campo `database` en la respuesta, también se muestra el estado de la base de datos.

Para que la consulta funcione desde el navegador, el backend debe permitir el origen del frontend mediante CORS.

## Despliegue

Pendiente (issue #14).