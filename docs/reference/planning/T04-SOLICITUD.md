# TAKE&GO — T04: Auditoría de cumplimiento, GitHub y despliegue

Actuá como un **Senior Software Engineer, QA Lead y Technical Project Manager** del proyecto Take&Go.

## 1. Contexto

Repositorio: https://github.com/Marilu-su/TakeAndGo

Rama base: `develop`

Nueva rama de trabajo: `feature/T04-auditoria-cumplimiento`

**Tarea:** T04 — Auditoría de cumplimiento, GitHub y despliegue.

El objetivo es construir una auditoría verificable del estado actual de Take&Go, identificando exactamente qué funcionalidades están implementadas, cuáles están parcialmente implementadas, cuáles existen en ramas pendientes de integración y cuáles todavía no están desarrolladas.

La fuente de verdad funcional es `TAKEANDGO_MASTER_V2_0.md` (RN-001 a RN-184).

También debés utilizar:

- `PANTALLAS_V2_0.md`: mapa de 39 pantallas y estados visuales.
- `AGENTS.md`: reglas de desarrollo.
- `CODEX_WORKFLOW.md`: metodología de trabajo.
- `AI-DECISIONS.md`: trazabilidad del uso de IA.
- La consigna oficial del TPI.
- ADRs y contratos existentes.
- El código real del repositorio.

Si alguno de estos documentos no está en el repositorio ni disponible en tu contexto, **no inventes su contenido**. Identificá el faltante como BLOCKER y continuá con la evidencia disponible.

## 2. Reglas obligatorias de trabajo

### Git y ramas

1. Verificá el estado del repositorio antes de modificar archivos.
2. No descartes cambios locales preexistentes.
3. Partí de `develop` actualizado.
4. Trabajá exclusivamente en `feature/T04-auditoria-cumplimiento`.
5. No modifiques directamente `develop` ni `main`.
6. No mezcles tareas T05, T08 u otras en esta rama.

### Commits atómicos

Organizá los cambios en unidades pequeñas, independientes y revisables.

Cada unidad debe tener una finalidad concreta y un mensaje propuesto siguiendo Conventional Commits, en español.

Ejemplos:

- `docs(audit): crear matriz de cumplimiento funcional`
- `docs(audit): registrar evidencias de frontend y backend`
- `docs(audit): documentar brechas de infraestructura`
- `test(audit): agregar verificaciones de contratos existentes`

**No ejecutes commits, push ni merge automáticamente.**

Después de cada unidad, mostrame los archivos modificados, el diff, las pruebas ejecutadas y el mensaje de commit propuesto. Yo revisaré y realizaré el commit manualmente antes de avanzar.

### Calidad

- No inventes reglas de negocio.
- No declares funcionalidades terminadas por encontrar solamente una entidad, endpoint, pantalla o test.
- No crees implementaciones nuevas que corresponden a tareas posteriores.
- No modifiques lógica productiva salvo que sea imprescindible para una verificación y lo justifiques previamente.
- No elimines ni reescribas pruebas existentes.
- Respetá la arquitectura actual y los módulos existentes.
- No incluyas secretos, tokens ni credenciales en documentación o logs.

## 3. Trabajo a desarrollar

### Etapa A — Inspección inicial

Analizá el estado de:

- `main` y `develop`.
- Pull Requests abiertos.
- Ramas de funcionalidades pendientes.
- Backend `apps/api`.
- Frontend `apps/web`.
- Esquema Prisma y migraciones.
- Pruebas unitarias, integración y E2E.
- Workflows de GitHub Actions.
- Documentación técnica.
- Configuración y evidencia de despliegue.

Prestá especial atención al PR #89 y a la rama `feature/C3-01-menia`.

No los consideres integrados si todavía no están fusionados en `develop`.

**Entregable:** informe inicial de componentes, estado y evidencias.

### Etapa B — Matriz de las 184 reglas del Master

Creá:

`docs/audits/T04-MATRIZ-CUMPLIMIENTO.md`

Para cada regla RN-001 a RN-184 registrá:

- ID y descripción resumida.
- Módulo afectado.
- Estado.
- Evidencia concreta: archivo, test, endpoint, PR o commit.
- Qué falta implementar o verificar.
- Tarea del plan de desarrollo que resolverá la brecha.

Usá estos estados:

- `PROBADO`: implementación integrada con pruebas relevantes verificadas.
- `PARCIAL`: existe implementación incompleta.
- `NO_LOCALIZADO`: no se identificó implementación.
- `PENDIENTE_INTEGRACION`: existe trabajo en una rama/PR sin integrar.
- `PENDIENTE_VALIDACION`: existe implementación, pero falta demostrar su funcionamiento.
- `BLOCKER`: no es posible continuar o validar por falta de una decisión o dependencia.

No asignes porcentajes de avance arbitrarios.

### Etapa C — Auditoría del frontend

Revisá todas las pantallas definidas en `PANTALLAS_V2_0.md`.

Verificá:

1. Existencia de cada pantalla o ruta.
2. Componentes funcionales.
3. Integración con endpoints reales.
4. Validación de formularios.
5. Control de acceso por rol.
6. Estados loading, empty y error.
7. Estados de negocio obligatorios.
8. Adaptación responsive.
9. Dependencias de backend pendientes.

Creá:

`docs/audits/T04-FRONTEND.md`

Incluí una matriz de las 39 pantallas con evidencia concreta y estado.

Una pantalla visual sin integración funcional debe quedar como parcial.

### Etapa D — Auditoría del backend y base de datos

Analizá:

- Organización y buffets.
- Autenticación y permisos.
- Clientes y membresías.
- Catálogo y adicionales.
- Stock y movimientos.
- Pedidos y reservas.
- Ventanas de retiro.
- Pagos y compensaciones.
- Cocina y retiro.
- MenIA y CocIA.
- Sanciones y no-retiros.
- Puntos y recompensas.
- Notificaciones.

Verificá para cada módulo:

1. Entidades y migraciones.
2. Reglas de dominio.
3. Casos de uso.
4. Persistencia.
5. Endpoints registrados en la aplicación.
6. Autorización por usuario, buffet y organización.
7. Transacciones e idempotencia cuando corresponda.
8. Pruebas existentes y brechas.

Diferenciá explícitamente entre un caso de uso implementado y una funcionalidad expuesta e integrada.

Creá:

`docs/audits/T04-BACKEND.md`

### Etapa E — Testing

Ejecutá los comandos de validación existentes, cuando el entorno lo permita:

Backend:

- Typecheck.
- Build.
- Tests unitarios.
- Tests de integración con PostgreSQL.

Frontend:

- Typecheck.
- ESLint.
- Build.
- Tests existentes.

Si faltan variables, proveedores o servicios, identificá qué impide ejecutar cada prueba.

Cuando una funcionalidad existente carezca de una verificación importante, podés agregar tests de caracterización que documenten su comportamiento actual, **sin cambiar las reglas de negocio**.

No crees pruebas que simulen un éxito falso ni uses mocks como evidencia de integración real.

Creá:

`docs/audits/T04-TESTING.md`

Incluí comandos ejecutados, resultados, errores y pruebas que faltan.

### Etapa F — GitHub, CI/CD y despliegue

Auditá:

- Protección de `main` y `develop`.
- Pull Requests obligatorios.
- Revisión cruzada.
- Checks requeridos.
- Conventional Commits.
- Workflows de frontend y backend.
- Últimos resultados de GitHub Actions.
- Despliegue frontend.
- Despliegue backend.
- Base de datos cloud.
- Endpoint `/health`.
- Logs, métricas y alertas.
- Documentación de arquitectura y ADR.

No cambies configuraciones remotas ni hagas despliegues automáticamente.

Si no tenés acceso a GitHub Actions, Vercel o al proveedor cloud, registrá la limitación en lugar de afirmar que están operativos.

Creá:

`docs/audits/T04-INFRAESTRUCTURA.md`

### Etapa G — Consolidación

Creá:

`docs/audits/T04-RESUMEN-EJECUTIVO.md`

Debe contener:

1. Estado general verificable del proyecto.
2. Funcionalidades completas.
3. Funcionalidades parciales.
4. Funcionalidades sin implementación localizada.
5. Trabajo pendiente de integrar.
6. Problemas de seguridad o integridad detectados.
7. Riesgos técnicos para la entrega final.
8. Bloqueos que requieren decisión.
9. Dependencias con T05–T36.
10. Recomendación de prioridades para continuar.

No agregues requisitos ajenos al Master o a la consigna del TPI.

## 4. Organización de cambios atómicos

Dividí el trabajo en estas unidades:

**Unidad 1:** relevamiento inicial y estructura de documentación.

**Unidad 2:** matriz RN-001 a RN-184.

**Unidad 3:** auditoría frontend y backend.

**Unidad 4:** ejecución de pruebas y registro de resultados.

**Unidad 5:** auditoría GitHub/CI/CD y consolidación ejecutiva.

Cada unidad debe terminar con:

- Archivos creados o modificados.
- Resumen del trabajo.
- Evidencias utilizadas.
- Comandos y resultados de pruebas.
- Diff revisable.
- Mensaje de commit propuesto.

Detenete para mi revisión entre unidades.

## 5. Criterio de terminado de T04

La tarea solamente estará completa cuando:

- Las 184 reglas estén clasificadas.
- Las 39 pantallas estén auditadas.
- Frontend, backend y base de datos tengan evidencias verificables.
- Las pruebas estén ejecutadas o sus bloqueos documentados.
- El estado de GitHub y despliegue esté documentado.
- Los PR pendientes estén identificados.
- Exista una lista concreta de bloqueos y tareas pendientes.
- Todos los documentos estén versionados en la rama de T04.
- Los cambios estén organizados en commits atómicos revisados.
- No existan cambios innecesarios en lógica de negocio.

## 6. Cómo comenzar

Primero:

1. Leé las instrucciones y documentos disponibles.
2. Verificá Git y el estado del workspace.
3. Revisá la rama `develop` y los PR relevantes.
4. Mostrame el plan de ejecución.
5. Enumerá los archivos que vas a crear o modificar.
6. Indicá los riesgos y posibles bloqueos.

**No modifiques archivos hasta mostrarme ese plan.**

Una vez revisado, comenzá únicamente con la Unidad 1.

La prioridad es obtener una auditoría real, trazable y reproducible de Take&Go, no completar documentación de manera superficial.