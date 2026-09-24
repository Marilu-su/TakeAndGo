# Checkpoint 1 — Contrato de integración

Este documento define los contratos mínimos entre los componentes desarrollados en paralelo durante el Checkpoint 1.

El objetivo es permitir que frontend, backend y base de datos puedan desarrollarse independientemente y luego integrarse sin depender de detalles internos de implementación.

## Frontend → Backend

El frontend debe obtener la URL del backend mediante la variable de entorno:

```text
NEXT_PUBLIC_API_URL
```

No se deben hardcodear URLs locales ni de producción en el código.

Ejemplo:

```text
NEXT_PUBLIC_API_URL=http://localhost:3001
```

El valor real utilizado en producción deberá configurarse desde la plataforma de despliegue.

## Health Check del Backend

El backend debe exponer el endpoint:

```http
GET /health
```

Respuesta mínima esperada:

```json
{
  "status": "ok"
}
```

Código HTTP esperado:

```text
200 OK
```

Este endpoint permitirá:

- verificar que el backend está disponible;
- validar la comunicación frontend → backend;
- utilizarlo posteriormente en monitoreo y CI/CD.

## Backend → Base de datos

El backend debe obtener la conexión a PostgreSQL mediante:

```text
DATABASE_URL
```

Ejemplo de formato:

```text
postgresql://usuario:password@host:5432/database
```

El valor real nunca debe almacenarse en Git.

## Variables de entorno

Cada aplicación podrá incluir un archivo:

```text
.env.example
```

con nombres de variables y valores ficticios.

No deben versionarse:

- `.env`;
- contraseñas;
- API keys;
- tokens;
- connection strings reales;
- claves privadas.

## Integración esperada

```text
Usuario
   │
   ▼
Frontend
   │
   │ NEXT_PUBLIC_API_URL
   ▼
Backend
   │
   │ DATABASE_URL
   ▼
PostgreSQL
```

## Responsabilidades

### Frontend

Debe:

- ejecutarse desde `apps/web`;
- utilizar `NEXT_PUBLIC_API_URL`;
- poder consultar `GET /health`;
- no depender de detalles internos del backend.

### Backend

Debe:

- ejecutarse desde `apps/api`;
- exponer `GET /health`;
- utilizar `DATABASE_URL` para acceder a PostgreSQL;
- no exponer secretos al frontend.

### Base de datos

Debe:

- utilizar PostgreSQL;
- aceptar conexión desde el backend;
- disponer de una migración inicial;
- disponer de un seed mínimo para validar funcionamiento.

## Criterio de integración del Checkpoint 1

La integración mínima se considera satisfactoria cuando puede demostrarse:

```text
Frontend
   ↓
GET /health
   ↓
Backend
   ↓
conexión
   ↓
PostgreSQL
```

No es necesario implementar funcionalidades de negocio para validar este contrato.