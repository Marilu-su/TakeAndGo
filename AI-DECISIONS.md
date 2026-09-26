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