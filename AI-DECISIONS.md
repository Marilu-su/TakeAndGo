# AI-DECISIONS.md V2 — Take&Go

Este documento registra decisiones relevantes donde una herramienta de Inteligencia Artificial haya influido en código, arquitectura, testing o documentación técnica.

No es necesario registrar interacciones triviales. El objetivo es mantener trazabilidad sobre las propuestas realizadas por IA y su posterior validación humana.

---

## Plantilla

### YYYY-MM-DD — [Título de la decisión]

**TDD / Issue:**  
**Autor humano:**  
**Herramienta/modelo:**  
**Prompt / instrucción utilizada:**  

#### Problema

Describir qué se necesitaba resolver.

#### Contexto dado a la IA

Resumir archivos, reglas, restricciones y antecedentes utilizados.

No incluir secretos, credenciales, tokens ni información sensible.

#### Propuesta de la IA

Resumir qué solución, cambio o enfoque sugirió o generó la IA.

#### Validación humana

Indicar qué revisó el integrante o el equipo, documentación consultada y verificaciones realizadas.

#### Correcciones o cambios hechos por el equipo

Registrar qué partes de la propuesta se modificaron, descartaron o ajustaron y por qué.

---

## Decisiones

### 2026-09-24 — Estrategia Git y flujo de Pull Requests para Checkpoint 1

**TDD / Issue:** CHK1-02 — Definir estrategia de repositorio y ramas  
**Autor humano:** Suarez Luana  
**Herramienta/modelo:** ChatGPT — GPT-5.6 Sol  
**Prompt / instrucción utilizada:** Guiar paso a paso la creación del repositorio y definir una estrategia Git apropiada para el trabajo de cuatro integrantes en Take&Go.

#### Problema

Era necesario definir una estrategia de trabajo Git que permitiera desarrollar Take&Go en paralelo entre cuatro integrantes, mantener trazabilidad individual y cumplir con los requisitos de ingeniería establecidos para el Checkpoint 1.

#### Contexto dado a la IA

Se consideraron:

- la consigna oficial del Trabajo Práctico Integrador;
- la necesidad de conservar historial individual de Git;
- el uso obligatorio de Pull Requests cruzados;
- el trabajo paralelo entre cuatro integrantes;
- la necesidad de mantener una rama estable y una rama de integración;
- la utilización de GitHub Projects;
- el desarrollo incremental de Take&Go.

#### Propuesta de la IA

Se propuso utilizar:

- `main` como rama estable;
- `develop` como rama de integración;
- ramas independientes por tarea, utilizando prefijos como `feature/`, `docs/` y `fix/`;
- Pull Requests hacia `develop`;
- protección de `main` y `develop`;
- una aprobación obligatoria de otro integrante antes de realizar el merge;
- eliminación de la rama de trabajo después de su integración;
- Conventional Commits para mantener un historial claro.

#### Validación humana

La estrategia fue revisada durante la configuración real del repositorio.

Se verificó:

- creación y publicación de `main` y `develop`;
- creación de ramas independientes;
- funcionamiento del acceso mediante SSH;
- creación de Pull Requests hacia `develop`;
- configuración de reglas de protección de ramas;
- creación de un GitHub Project para el Checkpoint 1.

#### Correcciones o cambios hechos por el equipo

Durante la validación humana se realizaron los siguientes ajustes:

- se decidió utilizar mensajes de commit con descripción en español;
- se descartó asignar un revisor fijo a cada integrante;
- se estableció que cualquier integrante distinto del autor puede aprobar una Pull Request;
- se definió una aprobación mínima obligatoria;
- GitHub Actions y los status checks obligatorios se configurarán cuando existan frontend y backend mínimos sobre los cuales ejecutar validaciones reales.

---

### 2026-09-26 — Inicialización del frontend y consumo del health check

**TDD / Issue:** #10 — Inicializar frontend  
**Autor humano:** Flores Lautaro  
**Herramienta/modelo:** Claude (Anthropic) — Claude Opus 5.5  
**Prompt / instrucción utilizada:** Guiar paso a paso la inicialización del frontend de Take&Go en `apps/web` con Next.js y TypeScript, y la implementación de una página que consulte `GET /health` del backend según el contrato de integración del Checkpoint 1.

#### Problema

Era necesario crear la base del frontend y demostrar la comunicación frontend → backend requerida por el Checkpoint 1, sin depender de que el backend estuviera terminado.

#### Contexto dado a la IA

Se consideraron:

- la consigna oficial del Trabajo Práctico Integrador;
- el One-Pager de Take&Go;
- la división de tareas del Checkpoint 1;
- `docs/architecture/CHK1-INTEGRATION-CONTRACT.md`;
- la convención de ramas y Conventional Commits.

#### Propuesta de la IA

Se propuso:

- inicializar el proyecto con `create-next-app` (TypeScript, ESLint, App Router, Tailwind, carpeta `src`);
- obtener la URL del backend desde `NEXT_PUBLIC_API_URL`, con un `.env.example` versionado;
- separar la consulta al backend en `src/lib/health.ts`, con timeout de 5 segundos y mensajes de error diferenciados;
- implementar la consulta desde el navegador, para validar la comunicación real frontend → backend;
- contemplar un campo opcional `database` en la respuesta de `/health`;


#### Validación humana

Se verificó:

- ejecución local con `npm run dev`;
- estado de error sin backend disponible;
- estado operativo mediante un servidor mock local de `/health`, ubicado fuera del repositorio;
- bloqueo de la solicitud por el navegador al quitar el encabezado CORS del mock;
- que `.env.local` no quedara versionado;
- ejecución exitosa de `npm run lint` y `npm run build`.

#### Correcciones o cambios hechos por el equipo

- La IA sugirió inicialmente mensajes de commit en inglés; se corrigieron a español para respetar la convención definida por el equipo.
- Se decidió conservar los archivos `AGENTS.md` y `CLAUDE.md` generados por Next.js en `apps/web`, ya que son regenerados por la herramienta.
- Se sugirió en la revisión del contrato de integración (PR #24) documentar la configuración de CORS y agregar el estado de la base de datos al health check.

---

### 2026-09-26 — Despliegue del frontend en Vercel

**TDD / Issue:** #14 — Desplegar frontend  
**Autor humano:** Flores Lautaro  
**Herramienta/modelo:** Claude (Anthropic) — Claude Opus 5.5  
**Prompt / instrucción utilizada:** Despliegue del frontend de `apps/web` en Vercel.

#### Problema

Era necesario desplegar el frontend para el Checkpoint 1. La integración de Vercel con GitHub no permitía importar el repositorio, ya que pertenece a la cuenta de otra integrante y la app de Vercel solo tenía acceso a los repositorios propios.

#### Contexto dado a la IA

- contrato de integración del Checkpoint 1;
- estructura del monorepo con el frontend en `apps/web`.

#### Propuesta de la IA

- desplegar mediante la CLI de Vercel desde `apps/web`, sin depender de la integración con GitHub;
- no conectar el repositorio a Vercel durante la configuración, por falta de permisos sobre la cuenta dueña del repositorio;
- configurar `NEXT_PUBLIC_API_URL` desde el panel de Vercel y no desde archivos locales;
- dejar el despliegue automático para una etapa posterior mediante GitHub Actions.

#### Validación humana

Se verificó:

- que el proyecto quedó publicado en https://take-and-go-web.vercel.app;
- que el sitio muestra el estado de error esperado al no tener configurada la URL del backend, lo que confirma que `.env.local` no fue incluido en el despliegue;
- que la carpeta `.vercel` generada por la CLI quedó excluida de Git.

#### Correcciones o cambios hechos por el equipo

- El despliegue automático queda pendiente de coordinación con la integrante responsable de CI/CD.

### 2026-09-27 — Definición de Arquitectura Cloud y ADR-0001

**TDD / Issue:** Checkpoint 1 - Infraestructura y Arquitectura Cloud (Issues #2, #18, #19, #31)  
**Autor humano:** Romero Olmo Macarena  
**Herramienta/modelo:** Asistente de IA (Compañero colaborativo guiado)  
**Prompt / instrucción utilizada:** Guiar paso a paso la creación del ADR-0001 y el diagrama de infraestructura Cloud en formato Mermaid cumpliendo con el Checkpoint 1.

#### Problema

Era necesario definir, formalizar y documentar la arquitectura cloud-native del sistema Take&Go exigida para el Checkpoint 1, asegurando la trazabilidad de las decisiones de infraestructura (Node.js, TypeScript, PostgreSQL gestionado y Prisma ORM bajo arquitectura hexagonal).

#### Contexto dado a la IA

- Fuentes de verdad oficiales: `TAKEANDGO_MASTER_V2_0.md` (Sección 9 y 10), el One-Pager del proyecto y las reglas de higiene de ingeniería (`AGENTS.md`).
- Restricción estricta: Operar bajo un flujo iterativo y pausado ("regla de oro"), sin inventar reglas de negocio ni saltarse validaciones técnicas.

#### Propuesta de la IA

- Estructuración de la especificación técnica para el archivo `docs/architecture/ADR-0001-cloud-stack.md`.
- Generación de la especificación visual de la infraestructura en código Mermaid para el archivo `docs/diagrams/cloud-architecture.md`, separando la capa de cliente (PaaS), CDN, cómputo (API modular), IA (MenIA y CocIA) y persistencia gestionada.

#### Validación humana

- Revisión y validación de los componentes arquitectónicos frente a los requerimientos funcionales del MVP (transacciones ACID de todo o nada para stock y puntos).
- Ejecución manual de los commits siguiendo estrictamente el estándar de Conventional Commits (`docs(architecture): ...` y `docs(diagrams): ...`) y apertura del Pull Request hacia `develop`.

#### Correcciones o cambios hechos por el equipo

- Se realizaron ajustes de formato en el código Mermaid del diagrama para garantizar su correcta visualización y se mantuvieron los mensajes de commit en ingles.

---

### 2026-10-07 — Configuración de PostgreSQL y Prisma

**TDD / Issue:** C2-07 — Configurar PostgreSQL + Prisma  
**Autor humano:** Flores Lautaro  
**Herramienta/modelo:** Claude (Anthropic) — Claude Opus 5.5  
**Prompt / instrucción utilizada:** Dudas en onfiguración de PostgreSQL y Prisma en `apps/api`

#### Problema

Era necesario incorporar la capa de base de datos compartida del backend: conexión a PostgreSQL, Prisma, cliente único, migraciones, seed y verificación de la conexión.

#### Contexto dado a la IA

- definición de alcance de C2-07 acordada por el equipo;
- documentación oficial de Prisma ORM 7, consultada durante la sesión.

#### Propuesta de la IA

- Utilizar Prisma ORM 7 en lugar de Prisma 8, por ser la versión estable con documentación y ecosistema más maduros, frente a una versión 8 recién publicada con cambios de paradigma.
- Utilizar Neon como PostgreSQL gestionado para desarrollo, con una base por integrante y estructura compartida mediante migraciones.
- Corregir el orden de carga de variables de entorno en `index.ts`.
- Diferir la primera migración a C2-06, ya que C2-07 no incluye modelos de negocio.

#### Validación humana

Se verificó:

- versión 7.10.0 de `prisma` y `@prisma/client`;
- conexión a Neon mediante `prisma migrate status`;
- que `.env` y `src/generated` no se versionan;
- ejecución exitosa de `npm run typecheck` y de los tests;
- `GET /health` con `database: "ok"` usando la base real;
- integración local Frontend → Backend → PostgreSQL desde la página del frontend;
- ejecución de `npm run db:seed`.

#### Correcciones o cambios hechos por el equipo

- `prisma init` generó carpetas de skills para asistentes de IA (`.agents`, `.claude`, `.windsurf`) y `skills-lock.json`; se eliminaron por no formar parte de la tarea.
- Se reemplazó la conexión con pooler de Neon por la conexión directa, requerida por las migraciones.
- Se detectó que `.env.example` quedaba ignorado por una regla `.env*`; se agregó la excepción `!.env.example` en `apps/api/.gitignore`.
- El equipo definió que la primera migración y el seed con datos se incorporen en C2-06.

---

### 2026-10-07 — Organización y buffets (TDD-0003)

**TDD / Issue:** C2-06 — Implementar Organization y Buffet 
**Autor humano:** Flores Lautaro  
**Herramienta/modelo:** Claude (Anthropic) — Claude Opus 5.5  
**Prompt / instrucción utilizada:** Preguntas sobre la implementación de Organization y Store en etapas, con arquitectura hexagonal y tests en cada etapa.

#### Problema

Implementar el organizaciones y buffets sin que exista todavía la autenticación, sin dejar afuera las reglas de autorización.

#### Propuesta de la IA

- Estructura por módulo: `src/modules/organization/{domain,application,infrastructure}`, con `src/shared` para errores de dominio y el `Actor`.
- Unicidad del código garantizada por la constraint de la base (P2002 → `STORE_CODE_ALREADY_EXISTS`), para cubrir pedidos concurrentes.
- `GetStoreConfiguration` como contrato interno entre módulos, sin control de permisos de usuario.
- Traducción centralizada de errores de dominio a códigos HTTP.
- Resolver de actor inyectable que, hasta TDD-0001, no identifica usuarios (`401`).


#### Validación humana

Se verificó:

- migración desde base vacía (`prisma migrate reset`) y seed idempotente ejecutado dos veces;
- 37 tests (dominio, casos de uso, HTTP e integración con PostgreSQL);
- `401` del endpoint sin autenticación mediante una request manual.

#### Correcciones o cambios hechos por el equipo

- La IA propuso inicialmente implementar los endpoints sin control de permisos y dejar el RBAC pendiente. El equipo lo rechazó porque contradice lo planificado, y definió separar autenticación de autorización (implementada y testeada ahora mediante un `Actor`).
- Se decidió normalizar el código de buffet a mayúsculas, ya que el master no define si distingue mayúsculas y minúsculas; queda a validar con C2-04 (asociación por código).
- Los códigos de error `INVALID_STORE_CODE`, `INVALID_STORE_NAME`, `INVALID_REQUEST`, `ORGANIZATION_NOT_FOUND` y `STORE_NOT_FOUND` se nombraron siguiendo el estilo de los existentes.
- Solo se expuso por HTTP la creación de buffets; los casos de uso de baja y configuración de anticipación quedan implementados y testeados, pendientes de exponer.
- Se reemplazó `sslmode=require` por `sslmode=verify-full` a partir de un aviso de seguridad de `pg`.

---

### 2026-10-09 — Customer y persistencia

**TDD / Issue:** C2-03 — Customer + persistencia  
**Autor humano:** Suarez Luana  
**Herramienta/modelo:** ChatGPT — GPT-5.6 Sol  
**Prompt / instrucción utilizada:** Asistir en las decisiones de diseño para implementar Customer y su persistencia respetando la arquitectura y el alcance definido para C2-03.

#### Problema

Era necesario definir cómo incorporar Customer al backend sin mezclar responsabilidades correspondientes a autenticación o a la asociación Customer-Buffet.

#### Contexto dado a la IA

Se consideraron:

- la arquitectura modular existente `domain / application / infrastructure`;
- el módulo `organization` de C2-06 como referencia;
- PostgreSQL + Prisma ya configurados en C2-07;
- la separación de alcance entre C2-03, C2-04 y TDD-0001.

#### Propuesta de la IA

Se propusieron las siguientes decisiones:

- modelar `Customer` inicialmente con `id`, `name` y `email`;
- mantener contraseña y demás datos de autenticación fuera del dominio Customer hasta implementar TDD-0001;
- mantener la relación Customer-Buffet fuera de C2-03 y resolverla en C2-04;
- normalizar el email antes de persistirlo y garantizar su unicidad mediante una constraint de PostgreSQL;
- mantener la capa de aplicación desacoplada de Prisma mediante `CustomerRepositoryPort`;
- traducir la violación de unicidad de Prisma a un error de dominio `CUSTOMER_EMAIL_ALREADY_EXISTS`;
- mantener para Customer la misma separación `domain / application / infrastructure` utilizada por el módulo Organization;
- no exponer todavía un endpoint HTTP de registro de Customer, ya que el registro completo depende de autenticación y de la asociación inicial a un buffet.

#### Validación humana

El equipo revisó estas decisiones contra el alcance de C2-03 y la arquitectura ya implementada.

Se verificó además que la solución mantiene separados dominio, aplicación e infraestructura y que la persistencia y la unicidad del email funcionan mediante pruebas automatizadas.

#### Correcciones o cambios hechos por el equipo

- Se descartó implementar contraseña o autenticación dentro de Customer por pertenecer a TDD-0001.
- Se descartó incorporar la relación Customer-Buffet dentro de C2-03 por pertenecer a C2-04.
- Se decidió no crear un endpoint HTTP parcial de registro para evitar definir prematuramente un contrato que dependa de funcionalidades todavía no implementadas.---

 #### Correcciones o cambios hechos por el equipo

- Se descartó implementar contraseña o autenticación dentro de Customer por pertenecer a TDD-0001.
- Se descartó incorporar la relación Customer-Buffet dentro de C2-03 por pertenecer a C2-04.
- Se decidió no crear un endpoint HTTP parcial de registro para evitar definir prematuramente un contrato que dependa de funcionalidades todavía no implementadas.