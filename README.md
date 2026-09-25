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

Para el Checkpoint 1 se busca validar inicialmente la siguiente integración:

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
git switch -c feature/CHK1-api-bootstrap
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
passwords
API keys
tokens
claves privadas
connection strings reales
```

Los archivos `.env.example` pueden utilizarse para documentar las variables requeridas usando valores ficticios.

## Contrato de integración

Durante el Checkpoint 1 se utilizan como contratos mínimos:

```text
Frontend → NEXT_PUBLIC_API_URL → Backend

Backend:
GET /health

Backend → DATABASE_URL → PostgreSQL
```

La definición completa se encuentra en:

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

El objetivo del primer checkpoint es dejar establecida la base técnica del proyecto:

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