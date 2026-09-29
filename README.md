# Take&Go

**Take&Go — Plataforma SaaS de Take Away Inteligente**

Take&Go es una plataforma orientada a buffets internos de universidades, empresas y organizaciones.

El objetivo es reducir filas, mejorar la previsibilidad de los retiros y optimizar la carga de trabajo de cocina mediante pedidos programados, control de stock e Inteligencia Artificial.

## Componentes principales

### MenIA

Asistente conversacional orientado al cliente.

Permite, entre otras funciones:

- consultar productos disponibles;
- recibir recomendaciones;
- armar pedidos;
- seleccionar ventanas de retiro;
- consultar puntos y recompensas.

### CocIA

Componente orientado a la operación de cocina.

Su objetivo es:

- estimar tiempos de preparación;
- considerar la carga actual de cocina;
- organizar la preparación de pedidos;
- recalcular ventanas cuando existen demoras.

## Arquitectura

Take&Go se desarrolla como una solución SaaS Cloud-Native.

La arquitectura definitiva y las decisiones tecnológicas se documentan mediante ADRs dentro de:

```text
docs/architecture/
```

La integración base del sistema es:

```text
Usuario
   │
   ▼
Frontend
   │
   ▼
Backend / API
   │
   ▼
PostgreSQL
```

La arquitectura también contempla servicios de autenticación, Inteligencia Artificial, observabilidad y CI/CD.

## Estructura del repositorio

```text
TakeAndGo/
│
├── apps/
│   ├── web/                 # Frontend
│   └── api/                 # Backend / API
│
├── docs/
│   ├── architecture/        # ADRs, contratos y diagramas
│   └── tdds/                # Especificaciones técnicas
│
├── .github/
│   └── workflows/           # GitHub Actions / CI-CD
│
├── AI-DECISIONS.md          # Registro de decisiones asistidas por IA
├── CONTRIBUTING.md          # Flujo Git y reglas de contribución
├── .gitignore
└── README.md
```

## Clonar el repositorio

El repositorio utiliza acceso mediante SSH.

```bash
git clone git@github.com:Marilu-su/TakeAndGo.git
cd TakeAndGo
```

## Entorno de desarrollo local

### Requisitos

Para ejecutar Take&Go localmente es necesario contar con:

- Git;
- Node.js;
- npm.

### Instalar dependencias del backend

Desde la raíz del repositorio:

```bash
cd apps/api
npm install
```

En PowerShell, si la política de ejecución de Windows impide ejecutar `npm`, se puede utilizar:

```powershell
npm.cmd install
```

### Configurar el frontend

El frontend utiliza la variable de entorno `NEXT_PUBLIC_API_URL` para conocer la URL del backend.

Desde `apps/web`, crear el archivo local a partir del ejemplo:

```powershell
Copy-Item .env.example .env.local
```

El entorno local utiliza:

```text
NEXT_PUBLIC_API_URL=http://localhost:3001
```

El archivo `.env.local` es configuración local y no debe versionarse.

### Instalar dependencias del frontend

Desde la raíz del repositorio:

```bash
cd apps/web
npm install
```

En PowerShell también puede utilizarse:

```powershell
npm.cmd install
```

### Levantar el backend

Desde `apps/api`:

```bash
npm start
```

En PowerShell:

```powershell
npm.cmd start
```

Por defecto, el backend queda disponible en:

```text
http://localhost:3001
```

### Verificar el backend

Con el backend ejecutándose:

```text
http://localhost:3001/health
```

La API debe responder con estado `200` e indicar:

```json
{
  "status": "ok"
}
```

Desde PowerShell también puede verificarse mediante:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

### Levantar el frontend

En una segunda terminal, desde `apps/web`:

```bash
npm run dev
```

En PowerShell:

```powershell
npm.cmd run dev
```

Por defecto, el frontend queda disponible en:

```text
http://localhost:3000
```

### Verificar la integración local

Con frontend y backend ejecutándose simultáneamente, acceder a:

```text
http://localhost:3000
```

La pantalla inicial debe indicar que el backend se encuentra disponible.

El flujo local esperado es:

```text
Frontend :3000
      │
      │ NEXT_PUBLIC_API_URL
      ▼
Backend :3001
      │
      ▼
GET /health
```

## Flujo de trabajo Git

El proyecto utiliza:

```text
main
  ↑
develop
  ↑
feature/* | docs/* | fix/*
```

### `main`

Contiene versiones estables del proyecto.

### `develop`

Es la rama de integración del equipo.

### Ramas de trabajo

Cada tarea se desarrolla en una rama independiente creada desde `develop`.

Ejemplo:

```bash
git switch develop
git pull origin develop
git switch -c feature/C2-01-project-setup
```

También se utilizan:

```text
feature/...   nuevas funcionalidades
docs/...      documentación
fix/...       correcciones
```

Los detalles completos del flujo se encuentran en:

```text
CONTRIBUTING.md
```

## Pull Requests

Los cambios no se incorporan directamente a `main` ni a `develop`.

El flujo esperado es:

```text
Rama de trabajo
      │
      ▼
Pull Request
      │
      ▼
Revisión de otro integrante
      │
      ▼
develop
```

Cada Pull Request requiere al menos una aprobación de otro integrante del equipo.

El autor de la PR no puede aprobar su propio cambio como revisión válida.

## Commits

Se utilizan **Conventional Commits**.

Ejemplos:

```text
feat: agregar endpoint de health check
fix: corregir conexión con base de datos
docs: actualizar documentación de arquitectura
chore: configurar estructura del repositorio
test: agregar pruebas del health check
```

Las descripciones de los commits se escriben en español.

## Variables de entorno

No deben almacenarse secretos o credenciales dentro del repositorio.

No versionar:

```text
.env
.env.local
passwords
API keys
tokens
claves privadas
connection strings reales
```

Los archivos `.env.example` pueden utilizarse para documentar las variables requeridas usando valores ficticios.

## Contrato de integración

Los contratos base de integración son:

```text
Frontend → NEXT_PUBLIC_API_URL → Backend

Backend:
GET /health

Backend → DATABASE_URL → PostgreSQL
```

La definición inicial se encuentra en:

```text
docs/architecture/CHK1-INTEGRATION-CONTRACT.md
```

## Inteligencia Artificial

Take&Go utiliza IA tanto como parte del producto como durante el proceso de desarrollo.

Las decisiones relevantes donde una herramienta de IA influya sobre código, arquitectura, testing o documentación técnica deben registrarse en:

```text
AI-DECISIONS.md
```

Toda propuesta generada mediante IA debe ser revisada y validada por un integrante del equipo.

## Checkpoint 1

El objetivo del primer checkpoint fue dejar establecida la base técnica del proyecto:

- arquitectura Cloud;
- repositorio con actividad individual;
- estrategia Git;
- frontend inicial;
- backend inicial;
- PostgreSQL;
- health check;
- infraestructura inicial;
- diagrama de arquitectura;
- ADR;
- GitHub Project;
- CI/CD inicial.

## Estado del proyecto

Proyecto en desarrollo.

**Materia:** Desarrollo de Software Cloud  
**Universidad:** UTN Facultad Regional La Plata  
**Ciclo lectivo:** 2026